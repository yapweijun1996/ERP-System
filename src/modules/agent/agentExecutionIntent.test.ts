import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { seedDemo } from '../../data/seed';
import {
  agentExecutionIntent,
  agentPrincipal,
  appUser,
  auditLog,
  companyReceiptPack,
  documentScanJob,
} from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import { uploadReceiptDocument } from '../documents/upload';
import { createCompanyReceiptWithin, updateCompanyReceiptWithin } from '../expenses/companyReceipt';
import * as serverCommands from './agentExecutionIntent';
import { createAgentExecutionIntentCommands } from './agentExecutionIntentCommands';
import * as packCommands from '../expenses/companyReceiptPack';
import { appendAudit } from '../../api/audit';

const asyncSha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
const webCryptoCommands = createAgentExecutionIntentCommands({
  ...packCommands.createCompanyReceiptPackCommands(asyncSha256),
  appendAudit,
  isPackError: (error) => error instanceof packCommands.CompanyReceiptPackError,
  sha256: asyncSha256,
});

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const PREPARED_AT = new Date('2026-09-09T10:00:00.000Z');

describe.each([
  { name: 'server', commands: serverCommands },
  { name: 'async Web Crypto', commands: webCryptoCommands },
])('Agent execution intent ($name)', ({ commands }) => {
  const {
    approveAgentExecutionIntentWithin, cancelAgentExecutionIntentWithin,
    prepareAgentExecutionIntentWithin, rejectAgentExecutionIntentWithin,
    verifyAgentExecutionIntentWithin,
  } = commands;
  let db: DB;
  let adminId: number;
  let viewerId: number;
  let agentActorId: number;
  let principalId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const users = await db.select({
      id: appUser.userId,
      username: appUser.username,
    }).from(appUser);
    adminId = users.find((user) => user.username === 'admin')!.id;
    viewerId = users.find((user) => user.username === 'viewer')!.id;
    const [agentActor] = await db.insert(appUser).values({
      masterFn: 'M1',
      username: 'agent-execution-intent',
      email: 'agent-execution-intent@acme.co',
      fullName: 'Execution Intent Agent',
      passwordHash: 'non-login-test-hash',
      identityKind: 'agent',
      loginEnabled: false,
      language: 'en',
      isActive: true,
      accountState: 'active',
    }).returning({ id: appUser.userId });
    agentActorId = agentActor.id;
    const [principal] = await db.insert(agentPrincipal).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      principalKey: 'execution-intent-agent',
      displayName: 'Execution Intent Agent',
      kind: 'delegated_agent',
      actorUserId: agentActorId,
      ownerUserId: adminId,
      status: 'active',
    }).returning({ id: agentPrincipal.id });
    principalId = principal.id;
  });

  async function cleanReceipt(
    uploaderUserId: number,
    draftId: string,
    merchant: string,
    contentByte: number,
    transactionDate = '2026-09-08',
  ) {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: uploaderUserId }, {
      clientDraftId: draftId,
      fileName: `${draftId}.png`,
      declaredMimeType: 'image/png',
      content: Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, contentByte,
      ]),
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'agent-execution-intent-test',
      resultCode: 'clean',
      completedAt: PREPARED_AT,
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    return withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(tx, scope, uploaderUserId, {
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      transactionDate,
      merchant,
      receiptNumber: `${draftId}-number`,
      amount: '12.3400',
      currency: 'SGD',
      category: 'Office supplies',
      businessPurpose: 'Execution intent evidence',
    }));
  }

  async function prepare(
    intentKey: string,
    overrides: Record<string, unknown> = {},
    now = PREPARED_AT,
  ) {
    return withTenantTransaction(db, scope, (tx) => prepareAgentExecutionIntentWithin(tx, scope, {
      agentPrincipalId: principalId,
      actorUserId: adminId,
      intentKey,
      packKey: 'company-receipt-pack:intent-0001',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'en',
      visibility: 'company',
      requestId: 'prepare-execution-intent-request',
      ...overrides,
    }, now));
  }

  async function approve(intentId: number, version: number, now = PREPARED_AT) {
    return withTenantTransaction(db, scope, (tx) => approveAgentExecutionIntentWithin(tx, scope, {
      intentId,
      expectedVersion: version,
      decisionByUserId: adminId,
      reason: 'Reviewed exact receipt facts',
      requestId: `approve-${intentId}-${version}`,
    }, now));
  }

  it('persists server-reviewed facts with a hash-only intent key and replays safely', async () => {
    const receipt = await cleanReceipt(adminId, 'intent-receipt-0001', 'Intent Merchant', 1);
    const rawIntentKey = 'execution-intent-key-0001';
    const first = await prepare(rawIntentKey);
    expect(first.replayed).toBe(false);
    expect(first.intent.status).toBe('prepared');
    expect(first.intent.expiresAt.toISOString()).toBe('2026-09-09T10:15:00.000Z');
    expect(first.intent.reviewedFacts.rows.map((row) => row.receiptId)).toEqual([receipt.id]);
    expect(first.intent.reviewedFacts.rows[0]?.receiptVersion).toBe(1);
    const [stored] = await db.select().from(agentExecutionIntent).where(eq(
      agentExecutionIntent.id,
      first.intent.id,
    ));
    expect(stored.intentKeyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.intentKeyHash).not.toContain(rawIntentKey);
    expect(JSON.stringify(stored)).not.toContain(rawIntentKey);
    const auditRows = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'agent_execution_intent'),
      eq(auditLog.entityId, String(first.intent.id)),
    ));
    expect(JSON.stringify(auditRows)).not.toContain(rawIntentKey);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);

    const replay = await prepare(rawIntentKey);
    expect(replay).toMatchObject({ replayed: true, intent: { id: first.intent.id } });
    expect(await db.select().from(agentExecutionIntent)).toHaveLength(1);
  });

  it('allows only an active human to approve, reject or cancel with optimistic version checks', async () => {
    await cleanReceipt(adminId, 'decision-receipt-0001', 'Decision Merchant', 2);
    const approved = await prepare('execution-intent-key-0002');
    await expect(withTenantTransaction(db, scope, (tx) => approveAgentExecutionIntentWithin(tx, scope, {
      intentId: approved.intent.id,
      expectedVersion: approved.intent.version,
      decisionByUserId: viewerId,
      reason: 'Viewer lacks the pack authority',
      requestId: 'approve-viewer-denied',
    }, PREPARED_AT))).rejects.toMatchObject({
      code: 'agent_execution_intent_confirmation_denied',
      status: 403,
    });
    await expect(withTenantTransaction(db, scope, (tx) => approveAgentExecutionIntentWithin(tx, scope, {
      intentId: approved.intent.id,
      expectedVersion: approved.intent.version,
      decisionByUserId: agentActorId,
      reason: 'Agent cannot self approve',
      requestId: 'approve-agent-denied',
    }, PREPARED_AT))).rejects.toMatchObject({
      code: 'agent_execution_intent_human_confirmation_required',
      status: 403,
    });
    const accepted = await approve(approved.intent.id, approved.intent.version);
    expect(accepted).toMatchObject({
      status: 'approved',
      version: 2,
      decisionByUserId: adminId,
    });
    await expect(approve(approved.intent.id, 1)).rejects.toMatchObject({
      code: 'agent_execution_intent_version_conflict',
    });

    const rejected = await prepare('execution-intent-key-0003', {
      packKey: 'company-receipt-pack:intent-0003',
    });
    const rejectedResult = await withTenantTransaction(db, scope, (tx) => rejectAgentExecutionIntentWithin(tx, scope, {
      intentId: rejected.intent.id,
      expectedVersion: rejected.intent.version,
      decisionByUserId: adminId,
      reason: 'Human review rejected this intent',
      requestId: 'reject-human-review',
    }, PREPARED_AT));
    expect(rejectedResult.status).toBe('rejected');

    const cancelled = await prepare('execution-intent-key-0004', {
      packKey: 'company-receipt-pack:intent-0004',
    });
    const cancelledResult = await withTenantTransaction(db, scope, (tx) => cancelAgentExecutionIntentWithin(tx, scope, {
      intentId: cancelled.intent.id,
      expectedVersion: cancelled.intent.version,
      decisionByUserId: adminId,
      reason: 'Human review cancelled this intent',
      requestId: 'cancel-human-review',
    }, PREPARED_AT));
    expect(cancelledResult.status).toBe('cancelled');
  });

  it('rejects tampered intent data, stale receipt versions and newly matching rows', async () => {
    const receipt = await cleanReceipt(adminId, 'stale-receipt-0001', 'Stale Merchant', 3);
    const prepared = await prepare('execution-intent-key-0005');
    const approved = await approve(prepared.intent.id, prepared.intent.version);

    const baseInput = {
      intentId: approved.id,
      agentPrincipalId: principalId,
      actorUserId: adminId,
      intentKey: 'execution-intent-key-0005',
      packKey: 'company-receipt-pack:intent-0001',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'en',
      visibility: 'company' as const,
      requestId: 'verify-intent-0005',
    };
    await expect(withTenantTransaction(db, scope, (tx) => verifyAgentExecutionIntentWithin(tx, scope, {
      ...baseInput,
      intentKey: 'execution-intent-key-tampered',
    }, PREPARED_AT))).rejects.toMatchObject({ code: 'agent_execution_intent_key_mismatch' });
    await expect(withTenantTransaction(db, scope, (tx) => verifyAgentExecutionIntentWithin(tx, scope, {
      ...baseInput,
      search: 'different merchant',
    }, PREPARED_AT))).rejects.toMatchObject({ code: 'agent_execution_intent_stale' });
    await expect(withTenantTransaction(db, scope, (tx) => verifyAgentExecutionIntentWithin(tx, scope, {
      ...baseInput,
      payloadDigest: '0'.repeat(64),
    }, PREPARED_AT))).rejects.toMatchObject({ code: 'agent_execution_intent_digest_mismatch' });

    await updateCompanyReceiptWithin(db, scope, adminId, receipt.id, 1, {
      merchant: 'Changed after review',
    });
    await expect(withTenantTransaction(db, scope, (tx) => verifyAgentExecutionIntentWithin(tx, scope, baseInput, PREPARED_AT)))
      .rejects.toMatchObject({ code: 'agent_execution_intent_stale' });

    const unchanged = await cleanReceipt(adminId, 'stale-receipt-0002', 'Second Merchant', 4);
    const secondPrepared = await prepare('execution-intent-key-0006', {
      packKey: 'company-receipt-pack:intent-0006',
    });
    const secondApproved = await approve(secondPrepared.intent.id, secondPrepared.intent.version);
    await cleanReceipt(adminId, 'stale-receipt-0003', 'Added Merchant', 5);
    await expect(withTenantTransaction(db, scope, (tx) => verifyAgentExecutionIntentWithin(tx, scope, {
      ...baseInput,
      intentId: secondApproved.id,
      intentKey: 'execution-intent-key-0006',
      packKey: 'company-receipt-pack:intent-0006',
      requestId: 'verify-added-row',
    }, PREPARED_AT))).rejects.toMatchObject({ code: 'agent_execution_intent_stale' });
    expect(unchanged.id).not.toBe(receipt.id);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('expires prepared intents and records the terminal state without a business Pack', async () => {
    await cleanReceipt(adminId, 'expired-receipt-0001', 'Expired Merchant', 6);
    const prepared = await prepare('execution-intent-key-0007');
    await expect(withTenantTransaction(db, scope, (tx) => verifyAgentExecutionIntentWithin(tx, scope, {
      intentId: prepared.intent.id,
      agentPrincipalId: principalId,
      actorUserId: adminId,
      intentKey: 'execution-intent-key-0007',
      packKey: 'company-receipt-pack:intent-0001',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'en',
      visibility: 'company',
      requestId: 'verify-expired',
      requireApproved: false,
    }, new Date('2026-09-09T10:15:00.001Z')))).rejects.toMatchObject({
      code: 'agent_execution_intent_expired',
      status: 410,
    });
    const [expired] = await db.select().from(agentExecutionIntent).where(eq(
      agentExecutionIntent.id,
      prepared.intent.id,
    ));
    expect(expired.status).toBe('prepared');
    expect(expired.version).toBe(1);
    expect(expired.expiresAt.getTime()).toBe(new Date('2026-09-09T10:15:00.000Z').getTime());
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });
});
