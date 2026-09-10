import { accessDemoDocument } from './demoDocumentAccess';
import { and, eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { freshDb } from '../test/helpers';
import { seedDemo } from './seed';
import { agentCredential, agentPrincipal, appUser, companyReceiptPack, documentScanJob } from './schema';
import { withTenantTransaction } from './tenantTransaction';
import { appendAudit } from '../api/audit';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { createCompanyReceiptPackCommands, CompanyReceiptPackError } from '../modules/expenses/companyReceiptPackCommands';
import { createAgentExecutionIntentCommands } from '../modules/agent/agentExecutionIntentCommands';
import { createDemoReceiptAssistantCommands } from './demoReceiptAssistant';

it('persists Demo approval, denies other identities/cancellation and replays through fresh bindings', async () => {
  const db = await freshDb(); await seedDemo(db);
  const scope = { masterFn: 'M1', companyFn: 'C-SG' };
  const users = await db.select().from(appUser);
  const admin = users.find(row => row.username === 'admin')!.userId;
  const viewer = users.find(row => row.username === 'viewer')!.userId;
  const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  const bind = () => createDemoReceiptAssistantCommands(createAgentExecutionIntentCommands({
    ...createCompanyReceiptPackCommands(sha256), sha256, appendAudit,
    isPackError: error => error instanceof CompanyReceiptPackError,
  }));
  const bridge = bind();
  const uploaded = await uploadReceiptDocument(db, scope, { userId: admin }, {
    clientDraftId: 'demo-approval-source-0001', fileName: 'synthetic.png', declaredMimeType: 'image/png',
    content: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zsx8AAAAASUVORK5CYII=', 'base64')),
  });
  await expect(accessDemoDocument(db, scope, { userId: admin, canManage: false }, uploaded.document.id, uploaded.version.versionNo)).rejects.toThrow();
  await db.update(documentScanJob).set({ status: 'clean', scanner: 'test', resultCode: 'clean', completedAt: new Date() }).where(and(eq(documentScanJob.masterFn, scope.masterFn), eq(documentScanJob.companyFn, scope.companyFn), eq(documentScanJob.versionId, uploaded.version.id)));
  const evidence = await accessDemoDocument(db, scope, { userId: admin, canManage: false }, uploaded.document.id, uploaded.version.versionNo);
  expect(evidence.version.sha256).toBe(uploaded.version.sha256);
  expect(evidence.access.versionId).toBe(uploaded.version.id);
  await expect(accessDemoDocument(db, scope, { userId: viewer, canManage: false }, uploaded.document.id, uploaded.version.versionNo)).rejects.toMatchObject({ code: 'document_access_denied' });
  await expect(accessDemoDocument(db, { masterFn: 'M1', companyFn: 'C-MY' }, { userId: admin, canManage: true }, uploaded.document.id, uploaded.version.versionNo)).rejects.toMatchObject({ code: 'document_missing' });
  await withTenantTransaction(db, scope, tx => createCompanyReceiptWithin(tx, scope, admin, {
    documentId: uploaded.document.id, documentVersionId: uploaded.version.id, transactionDate: '2026-08-12',
    merchant: 'Synthetic Cafe', businessPurpose: 'Synthetic approval test', amount: '12.00', currency: 'SGD', category: 'Meals',
  }));
  const input = { packKey: 'demo-approval-pack-0001', intentKey: 'demo-approval-intent-0001', search: '', dateFrom: '2026-08-12', dateTo: '2026-08-12', locale: 'en' };
  const prepared = await withTenantTransaction(db, scope, tx => bridge.prepare(tx, scope, admin, 'company', input));
  const intent = prepared.intent;
  const execution = { ...input, executionIntentId: intent.id, executionIntentKey: input.intentKey, selectionDigest: intent.selectionDigest, payloadDigest: intent.payloadDigest };
  const decision = { intentId: intent.id, expectedVersion: intent.version, reason: 'Reviewed synthetic receipt' };
  await expect(withTenantTransaction(db, scope, tx => bridge.execute(tx, scope, admin, 'company', execution))).rejects.toMatchObject({ code: 'agent_execution_intent_not_approved' });
  await expect(withTenantTransaction(db, scope, tx => bridge.decide(tx, scope, viewer, 'approve', decision))).rejects.toMatchObject({ code: 'assistant_identity_mismatch' });
  const otherScope = { masterFn: 'M1', companyFn: 'C-MY' };
  await expect(withTenantTransaction(db, otherScope, tx => bridge.decide(tx, otherScope, admin, 'approve', decision))).rejects.toMatchObject({ code: 'agent_execution_intent_not_found' });
  await withTenantTransaction(db, scope, tx => bridge.decide(tx, scope, admin, 'cancel', decision));
  await expect(withTenantTransaction(db, scope, tx => bind().execute(tx, scope, admin, 'company', execution))).rejects.toMatchObject({ code: 'agent_execution_intent_not_approved' });
  expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  const nextInput = { ...input, packKey: 'demo-approval-pack-0002', intentKey: 'demo-approval-intent-0002' };
  const next = await withTenantTransaction(db, scope, tx => bridge.prepare(tx, scope, admin, 'company', nextInput));
  await withTenantTransaction(db, scope, tx => bridge.decide(tx, scope, admin, 'approve', { ...decision, intentId: next.intent.id }));
  const nextExecution = { ...nextInput, executionIntentId: next.intent.id, executionIntentKey: nextInput.intentKey, selectionDigest: next.intent.selectionDigest, payloadDigest: next.intent.payloadDigest };
  const created = await withTenantTransaction(db, scope, tx => bind().execute(tx, scope, admin, 'company', nextExecution));
  const replay = await withTenantTransaction(db, scope, tx => bind().execute(tx, scope, admin, 'company', nextExecution));
  expect(replay.replayed).toBe(true); expect(replay.pack.id).toBe(created.pack.id);
  expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  const principals = await db.select().from(agentPrincipal);
  expect(principals).toHaveLength(1);
  const [actor] = await db.select().from(appUser).where(eq(appUser.userId, principals[0].actorUserId));
  expect(actor).toMatchObject({ identityKind: 'agent', loginEnabled: false });
  expect(await db.select().from(agentCredential)).toHaveLength(0);
});
