import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, chmod, open, rename, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { createPgliteDb } from '../data/db';
import { seedDemo } from '../data/seed';
import { appUser, companyModule, masterModule, documentScanJob, companyReceiptPack } from '../data/schema';
import type { SessionData } from '../auth/session';
import { encryptToken } from '../auth/tokenCrypto';
import { withTenantTransaction } from '../data/tenantTransaction';
import { createAgentPrincipal, createAgentGrant } from '../modules/agent/agentIdentity';
import { listAgentActionContracts } from '../modules/agent/actionContracts';
import { configureAgentProviderWithin } from '../modules/agent/providerConfiguration';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { renderCompanyReceiptPackWithin } from '../modules/expenses/companyReceiptPack';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createReceiptAssistantProviderFactory } from '../api/receiptAssistantProvider';
import { createApp } from '../api/app';
import type { ReceiptAssistantResult, ReceiptAssistantExecutionResult } from '../api/receiptAssistant';
import { OPENAI_RECEIPT_SNAPSHOT } from '../modules/agent/openAiProvider';

export interface PilotPolicy {
  mode: 'fixture' | 'live';
  companyFn: 'C-SG' | 'C-MY';
  apiKey: string;
  approvalReference: string | null;
  maxCostMicros: number;
  inputMicrosPerMillionTokens: number;
  outputMicrosPerMillionTokens: number;
  maxOutputTokens: number;
}

/** A CLI gate, never inferred from credentials or inherited deployment activation. */
export function pilotPolicy(mode: string, companyFn: string, env: NodeJS.ProcessEnv, interactive: boolean): PilotPolicy {
  if (!['fixture', 'live'].includes(mode) || !['C-SG', 'C-MY'].includes(companyFn)) throw new Error('pilot_arguments_invalid');
  if (mode === 'fixture') return {
    mode, companyFn: companyFn as PilotPolicy['companyFn'], apiKey: 'synthetic-pilot-key', approvalReference: null,
    maxCostMicros: 1_000_000, inputMicrosPerMillionTokens: 400_000, outputMicrosPerMillionTokens: 1_600_000, maxOutputTokens: 1024,
  };
  const integer = (key: string, max: number) => {
    const raw = env[key];
    const value = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error('pilot_budget_policy_required');
    return value;
  };
  if (!interactive || env.TASK234_LIVE_APPROVED !== 'true'
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,100}$/.test(env.TASK234_APPROVAL_REFERENCE ?? '')
    || !env.TASK234_OPENAI_API_KEY?.trim()) throw new Error('pilot_live_authorization_required');
  return {
    mode: 'live', companyFn: companyFn as PilotPolicy['companyFn'], apiKey: env.TASK234_OPENAI_API_KEY,
    approvalReference: env.TASK234_APPROVAL_REFERENCE!,
    maxCostMicros: integer('TASK234_MAX_COST_MICROS', 1_000_000),
    inputMicrosPerMillionTokens: integer('TASK234_INPUT_MICROS_PER_MILLION', 1_000_000_000),
    outputMicrosPerMillionTokens: integer('TASK234_OUTPUT_MICROS_PER_MILLION', 1_000_000_000),
    maxOutputTokens: integer('TASK234_MAX_OUTPUT_TOKENS', 32_768),
  };
}

export interface PilotReview {
  companyFn: string;
  selectionDigest: string;
  preview: unknown;
  evidenceFiles: Array<{ receiptId: number; sourceSha256: string; path: string }>;
}

interface InspectedReceipt {
  id: number;
  version: number;
  documentId: number;
  documentVersionId: number;
  documentVersionNo: number;
  documentSha256: string;
}

/** Acceptance evidence must come from successful governed detail reads, not prose. */
export function verifyPilotInspection(result: Pick<ReceiptAssistantResult, 'toolResults' | 'preview'>): InspectedReceipt[] {
  const rows = (result.preview as { rows?: Array<Record<string, unknown>> } | undefined)?.rows;
  check(rows?.length, 'pilot_inspection_missing');
  return rows.map((row) => {
    const observed = result.toolResults.filter((tool) => tool.ok && tool.action === 'receipt.get')
      .map((tool) => (tool.body as { data?: InspectedReceipt } | undefined)?.data)
      .find((receipt) => receipt?.id === row.receiptId);
    check(observed && observed.version === row.receiptVersion
      && observed.documentId === row.documentId && observed.documentVersionId === row.documentVersionId
      && observed.documentSha256 === row.documentSha256
      && /^[a-f0-9]{64}$/.test(observed.documentSha256)
      && Number.isSafeInteger(observed.documentId) && observed.documentId > 0
      && Number.isSafeInteger(observed.documentVersionNo) && observed.documentVersionNo > 0,
    'pilot_inspection_missing');
    return observed;
  });
}

function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}
const client = (db: Awaited<ReturnType<typeof createPgliteDb>>) => (db as unknown as { $client: { exec(sql: string): Promise<unknown>; close(): Promise<void> } }).$client;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export class PilotFailure extends Error {
  constructor(readonly code: string, readonly outputDirectory: string) {
    super(code);
    this.name = 'PilotFailure';
  }
}

async function artifact(directory: string, name: string, content: Uint8Array | string) {
  // The directory is exclusively created for this run; targets cannot overwrite user work.
  const temporary = path.join(directory, `.${name}.${randomBytes(12).toString('hex')}.tmp`);
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(content); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, path.join(directory, name));
    const dir = await open(directory, 'r');
    try { await dir.sync(); } finally { await dir.close(); }
  } finally { await unlink(temporary).catch(() => undefined); }
}

function fixtureTransport(receiptIds: number[]): typeof fetch {
  let turn = 0;
  return async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { tools: Array<{ name: string; description: string }> };
    const actions = ['receipt.search', ...receiptIds.map(() => 'receipt.get'), 'receipt_pack.prepare'];
    const action = actions[turn++];
    const output = action ? [{ type: 'function_call', call_id: `pilot-${turn}`,
      name: request.tools.find((tool) => tool.description.startsWith(`${action}:`))?.name,
      arguments: JSON.stringify(action === 'receipt.get' ? { receiptId: receiptIds[turn - 2] }
        : { dateFrom: '2026-09-01', dateTo: '2026-09-30' }),
    }] : [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'Review the exact synthetic receipt selection.' }] }];
    return new Response(JSON.stringify({ object: 'response', status: 'completed', model: OPENAI_RECEIPT_SNAPSHOT,
      error: null, incomplete_details: null, output, usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 } }));
  };
}

/** Fresh synthetic local pilot. Live network is possible only with the explicit CLI gate. */
export async function runReceiptPilot(policy: PilotPolicy, review: (value: PilotReview) => Promise<string>) {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'erp-receipt-pilot-'));
  await chmod(outputDirectory, 0o700);
  const databasePath = path.join(outputDirectory, 'database');
  let db = await createPgliteDb(databasePath);
  let server: Server | undefined;
  const scope = { masterFn: 'M1', companyFn: policy.companyFn };
  const startedAt = Date.now();
  try {
    await client(db).exec(await readFile(path.resolve('web/public/db/erp-system-schema.sql'), 'utf8'));
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    check(admin, 'pilot_fixture_user_missing');
    const session: SessionData = { userId: admin.userId, masterFn: scope.masterFn, activeCompanyFn: scope.companyFn,
      username: admin.username, email: admin.email, fullName: admin.fullName };
    await db.update(masterModule).set({ enabled: true }).where(and(eq(masterModule.masterFn, scope.masterFn), eq(masterModule.moduleKey, 'expenses_tax')));
    await db.update(companyModule).set({ enabled: true }).where(and(eq(companyModule.masterFn, scope.masterFn), eq(companyModule.companyFn, scope.companyFn), eq(companyModule.moduleKey, 'expenses_tax')));
    const principal = await createAgentPrincipal(db, session, { principalKey: 'receipt-pilot', displayName: 'Synthetic Receipt Pilot', ownerUserId: admin.userId }, 'pilot-principal');
    for (const action of listAgentActionContracts()) await createAgentGrant(db, session, {
      agentPrincipalId: principal.id, actionName: action.name, permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: action.name.startsWith('receipt.') ? 'expenses/company_receipts' : 'expenses/company_receipt_packs',
      scope: 'company', targetType: 'none', targetId: '', fieldAllowlist: ['*'],
    }, `pilot-${action.name}`);
    const ids: number[] = [];
    for (let index = 1; index <= 2; index += 1) {
      const sourcePdf = await PDFDocument.create();
      const font = await sourcePdf.embedFont(StandardFonts.Helvetica);
      const page = sourcePdf.addPage([420, 300]);
      page.drawText(`SYNTHETIC RECEIPT ${index} - NOT A REAL TRANSACTION`, { x: 20, y: 260, size: 12, font });
      page.drawText(`Company ${scope.companyFn} | Merchant ${index} | Amount 18.25`, { x: 20, y: 230, size: 12, font });
      const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
        clientDraftId: `synthetic-pilot-${index}`, fileName: `synthetic-receipt-${index}.pdf`, declaredMimeType: 'application/pdf',
        content: await sourcePdf.save(),
      });
      await withTenantTransaction(db, scope, async (tx) => {
        await tx.update(documentScanJob).set({ status: 'clean', scanner: 'synthetic-pilot-fixture', resultCode: 'clean', completedAt: new Date() })
          .where(and(eq(documentScanJob.masterFn, scope.masterFn), eq(documentScanJob.companyFn, scope.companyFn), eq(documentScanJob.versionId, uploaded.version.id)));
        const receipt = await createCompanyReceiptWithin(tx, scope, admin.userId, {
          documentId: uploaded.document.id, documentVersionId: uploaded.version.id,
          transactionDate: `2026-09-0${index}`, merchant: `Synthetic Pilot Merchant ${index}`,
          receiptNumber: `SYNTHETIC-${index}`, amount: '18.2500', currency: scope.companyFn === 'C-SG' ? 'SGD' : 'MYR',
          category: 'Travel', businessPurpose: 'Synthetic pilot evidence; not a real transaction.',
        });
        ids.push(receipt.id);
      });
    }
    const encryptionKey = randomBytes(32);
    await withTenantTransaction(db, scope, (tx) => configureAgentProviderWithin(tx, scope, { userId: admin.userId, requestId: 'pilot-config' }, {
      provider: 'openai', model: 'gpt-4.1-mini', dataRegion: 'global', dataPolicy: 'tenant_no_training',
      credentialEnvelope: encryptToken(policy.apiKey, encryptionKey), maxProviderCalls: 8, maxRetries: 1,
      maxCostMicros: policy.maxCostMicros, maxDurationMs: 120_000, maxInputChars: 100_000, maxOutputChars: 16_000,
    }));
    const providerFactory = createReceiptAssistantProviderFactory({
      ...policy, enabled: true, agentPrincipalKey: 'receipt-pilot', tokenEncryptionKey: encryptionKey.toString('hex'),
      fetch: policy.mode === 'fixture' ? fixtureTransport(ids) : undefined,
    });
    server = createApp(db, { receiptAssistant: { providerFactory, agentPrincipalKey: 'receipt-pilot' } }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    check(address && typeof address !== 'string', 'pilot_server_unavailable');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: 'admin', password: 'demo1234' }) });
    check(login.ok, 'pilot_login_failed');
    const cookies = login.headers.getSetCookie().map((value) => value.split(';')[0]);
    const csrf = cookies.find((value) => value.startsWith('erp_csrf='));
    check(csrf, 'pilot_session_unavailable');
    const headers = { cookie: cookies.join('; '), 'x-csrf-token': decodeURIComponent(csrf.slice('erp_csrf='.length)), 'content-type': 'application/json' };
    async function post<T>(route: string, body: unknown): Promise<T> {
      const response = await fetch(`${baseUrl}/api/${route}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(125_000) });
      check(response.ok, 'pilot_api_rejected');
      return (await response.json() as { data: T }).data;
    }
    if (policy.companyFn === 'C-MY') await post('auth/session/actions/switch-company', { companyFn: 'C-MY' });
    const assistantStartedAt = Date.now();
    const conversation = await post<ReceiptAssistantResult>('assistant/receipts', {
      message: 'Find all September 2026 Company Receipts. Use receipt.get for every matching receipt to inspect its version and evidence identity, then prepare an English Receipt Pack for every matching receipt. Do not create it; wait for my confirmation.',
    });
    const providerDurationMs = Date.now() - assistantStartedAt;
    const confirmation = conversation.confirmation;
    const preview = conversation.preview as { rows?: Array<{ receiptId: number }>; totals?: unknown } | undefined;
    check(conversation.state === 'waiting' && confirmation?.available && confirmation.selectionDigest && preview?.rows, 'pilot_preview_unavailable');
    check(JSON.stringify(preview.rows.map((row) => row.receiptId).sort()) === JSON.stringify(ids.sort()), 'pilot_selection_mismatch');
    const inspected = verifyPilotInspection(conversation);
    const evidenceFiles: PilotReview['evidenceFiles'] = [];
    for (const receipt of inspected) {
      const response = await fetch(`${baseUrl}/api/documents/${receipt.documentId}/content?version=${receipt.documentVersionNo}&action=view`, {
        headers: { ...headers, 'x-document-access-purpose': 'Review synthetic Receipt pilot source before confirmation.',
          'idempotency-key': `pilot-source-${receipt.id}-${randomBytes(12).toString('hex')}` },
        signal: AbortSignal.timeout(30_000),
      });
      check(response.ok, 'pilot_source_unavailable');
      const content = new Uint8Array(await response.arrayBuffer());
      check(hash(content) === receipt.documentSha256, 'pilot_source_hash_mismatch');
      const name = `source-receipt-${receipt.id}.pdf`;
      await artifact(outputDirectory, name, content);
      evidenceFiles.push({ receiptId: receipt.id, sourceSha256: receipt.documentSha256, path: path.join(outputDirectory, name) });
    }
    check((await db.select().from(companyReceiptPack).where(and(eq(companyReceiptPack.masterFn, scope.masterFn), eq(companyReceiptPack.companyFn, scope.companyFn)))).length === 0, 'pilot_premature_pack');
    const answer = await review({ companyFn: scope.companyFn, selectionDigest: confirmation.selectionDigest, preview, evidenceFiles });
    const confirmed = answer === confirmation.selectionDigest;
    await post(`assistant/receipts/actions/${confirmed ? 'approve' : 'cancel'}`, {
      intentId: confirmation.intentId, expectedVersion: confirmation.intentVersion,
      reason: confirmed ? 'Operator reviewed the exact synthetic receipt selection.' : 'Operator declined the synthetic receipt selection.',
    });
    if (!confirmed) throw new Error('pilot_confirmation_declined');
    const execution = await post<ReceiptAssistantExecutionResult>('assistant/receipts/actions/execute', {
      ...confirmation.filters, locale: confirmation.locale, packKey: confirmation.packKey,
      executionIntentId: confirmation.intentId, executionIntentKey: confirmation.intentKey,
      selectionDigest: confirmation.selectionDigest, payloadDigest: confirmation.payloadDigest,
    });
    check(execution.state === 'succeeded', 'pilot_execution_failed');
    await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    server = undefined;
    await client(db).close();
    db = await createPgliteDb(databasePath);
    const executedPack = execution.pack as { id?: number };
    check(Number.isSafeInteger(executedPack?.id), 'pilot_pack_identity_invalid');
    const rendered = await withTenantTransaction(db, scope, (tx) => renderCompanyReceiptPackWithin(tx, scope, admin.userId, 'company', executedPack.id!, 'view'));
    check(rendered.sha256 === execution.verification.artifact.artifactSha256, 'pilot_persisted_pdf_mismatch');
    check(rendered.pack.sourceSha256 === execution.verification.artifact.sourceSha256, 'pilot_persisted_source_mismatch');
    check(JSON.stringify(rendered.pack.rows.map((row) => row.receiptId).sort()) === JSON.stringify(ids.sort()), 'pilot_persisted_selection_mismatch');
    await artifact(outputDirectory, 'receipt-pack.pdf', rendered.content);
    check(hash(await readFile(path.join(outputDirectory, 'receipt-pack.pdf'))) === rendered.sha256, 'pilot_saved_pdf_mismatch');
    const evidence = {
      version: 1, mode: policy.mode, syntheticDataOnly: true, completed: true, productionVerified: false,
      confirmationSource: policy.mode === 'fixture' ? 'simulated_fixture' : 'interactive_operator',
      approvalReference: policy.approvalReference, companyFn: scope.companyFn,
      provider: conversation.provider, model: conversation.model, providerCalls: conversation.providerCalls,
      retries: conversation.retries, estimatedCostMicros: conversation.spentCostMicros,
      usageEvidence: policy.mode === 'fixture' ? 'synthetic_fixture' : 'provider_report', costIsEstimate: true,
      reservedCostMicros: conversation.reservedCostMicros, providerDurationMs,
      elapsedMs: Date.now() - startedAt, packId: rendered.pack.id, receiptIds: ids,
      selectionDigest: confirmation.selectionDigest, sourceSha256: rendered.pack.sourceSha256,
      artifactSha256: rendered.sha256, pdfByteLength: rendered.content.byteLength,
      persistedAfterReopen: true, savedPdfVerified: true, humanViewedPdf: false,
      inspectedReceiptIds: inspected.map((receipt) => receipt.id), sourceFilesHashVerified: true,
      humanViewedSources: false,
    };
    await artifact(outputDirectory, 'evidence.json', JSON.stringify(evidence, null, 2) + '\n');
    return { outputDirectory, evidence };
  } catch (error) {
    const code = error instanceof Error && /^pilot_[a-z_]+$/.test(error.message) ? error.message : 'pilot_failed';
    await artifact(outputDirectory, 'evidence.json', JSON.stringify({
      version: 1, mode: policy.mode, syntheticDataOnly: true, completed: false,
      code, providerUsageAvailable: false, productionVerified: false, humanViewedPdf: false,
    }, null, 2) + '\n');
    throw new PilotFailure(code, outputDirectory);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await client(db).close();
  }
}
