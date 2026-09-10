import { createReceiptAssistantProviderFactory } from './receiptAssistantProvider';
import { configureAgentProviderWithin } from '../modules/agent/providerConfiguration';
import { encryptToken } from '../auth/tokenCrypto';
import { createOpenAiProvider, OPENAI_RECEIPT_SNAPSHOT } from '../modules/agent/openAiProvider';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  agentGrant,
  agentProviderConfig,
  companyModule,
  companyReceiptPack,
  documentScanJob,
  masterModule,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { createAgentGrant, createAgentPrincipal } from '../modules/agent/agentIdentity';
import type {
  AiProvider,
  AiProviderResponse,
  AiRuntimeLimits,
  AiToolCall,
} from '../modules/agent/aiRuntime';
import type { SessionData } from '../auth/session';
import { withTenantTransaction } from '../data/tenantTransaction';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { freshDb } from '../test/helpers';
import { createApp } from './app';
import {
  resolveReceiptAssistantIdentity,
  runReceiptAssistant,
  type ReceiptAssistantProviderFactory,
} from './receiptAssistant';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const limits: AiRuntimeLimits = {
  maxProviderCalls: 8,
  maxRetries: 1,
  maxDurationMs: 15_000,
  maxInputChars: 16_000,
  maxOutputChars: 4_000,
  maxCostMicros: 500_000,
  costReservationPolicy: 'reserve_before_call_release_on_preflight_failure',
};

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair) throw new Error('Login did not return a CSRF cookie.');
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

interface ScriptedResponse {
  text?: string;
  toolCalls?: readonly AiToolCall[];
}

function scriptedProvider(responses: readonly ScriptedResponse[]): AiProvider {
  let index = 0;
  return {
    provider: 'deterministic.zero_spend',
    model: 'erp-test-zero-spend-v1',
    costPerCallMicros: 0,
    async complete(request): Promise<AiProviderResponse> {
      const scripted = responses[index] ?? { text: 'The server could not continue safely.' };
      index += 1;
      return {
        provider: request.provider,
        model: request.model,
        text: scripted.text ?? '',
        toolCalls: scripted.toolCalls ?? [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costMicros: 0,
        finishReason: scripted.toolCalls?.length ? 'tool_call' : 'stop',
      };
    },
  };
}

function protocolFetch(responses: readonly ScriptedResponse[]): typeof fetch {
  let index = 0;
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { tools: Array<{ name: string; description: string }> };
    const scripted = responses[index++];
    if (!scripted) throw new Error('Unexpected fixture provider call.');
    return new Response(JSON.stringify({
      object: 'response', status: 'completed', model: OPENAI_RECEIPT_SNAPSHOT,
      error: null, incomplete_details: null,
      output: scripted.toolCalls?.map((call) => ({
        type: 'function_call', call_id: call.callId, arguments: JSON.stringify(call.arguments),
        name: body.tools.find((tool) => tool.description.startsWith(`${call.name}:`))?.name,
      })) ?? [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: scripted.text }] }],
      usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 },
    }));
  };
}

const fixturePricing = { inputMicrosPerMillionTokens: 400_000, outputMicrosPerMillionTokens: 1_600_000, maxOutputTokens: 1024 };
function protocolProvider(responses: readonly ScriptedResponse[]): AiProvider {
  return createOpenAiProvider({
    apiKey: 'synthetic-http-fixture-key', model: 'gpt-4.1-mini', ...fixturePricing,
    timeoutMs: 1000, fetch: protocolFetch(responses),
  });
}

describe('server-owned Receipt assistant', () => {
  let db: DB;
  let server: Server | undefined;
  let baseUrl: string;
  let admin: typeof appUser.$inferSelect;
  let adminSession: SessionData;
  let assistantPrincipalId: number;
  let providerFactory: ReceiptAssistantProviderFactory;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, scope.masterFn),
      eq(masterModule.moduleKey, 'expenses_tax'),
    ));
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, scope.masterFn),
      eq(companyModule.companyFn, scope.companyFn),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    adminSession = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: scope.companyFn,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    const principal = await createAgentPrincipal(db, adminSession, {
      principalKey: 'receipt-assistant',
      displayName: 'Receipt Assistant',
      ownerUserId: admin.userId,
    }, 'receipt-assistant-principal');
    assistantPrincipalId = principal.id;
    for (const [index, actionName] of [
      'receipt.search',
      'receipt.get',
      'receipt_pack.prepare',
      'receipt_pack.create',
      'receipt_pack.get',
      'receipt_pack.export',
    ].entries()) {
      await createAgentGrant(db, adminSession, {
        agentPrincipalId: assistantPrincipalId,
        actionName,
        permissionKey: 'expenses.company_receipts.read_company',
        resourceKey: actionName.startsWith('receipt.')
          ? 'expenses/company_receipts'
          : 'expenses/company_receipt_packs',
        scope: 'company',
        targetType: 'none',
        targetId: '',
        fieldAllowlist: ['*'],
      }, `receipt-assistant-grant-${index}`);
    }
    providerFactory = () => scriptedProvider([]);
    server = createApp(db, {
      receiptAssistant: {
        providerFactory: (context) => providerFactory(context),
        limits,
        agentPrincipalKey: 'receipt-assistant',
      },
    }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing Receipt assistant server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  it('carries unknown retry costs into the next tool turn before another provider call', async () => {
    let calls = 0;
    const base = scriptedProvider([{ toolCalls: [{ callId: 'budget-search', name: 'receipt.search', arguments: {} }] }]);
    const result = await runReceiptAssistant(db, {
      runId: 'assistant-cost-carry', requestId: 'assistant-cost-carry', session: adminSession,
      message: 'Find receipts.', limits: { ...limits, maxCostMicros: 20 },
      provider: {
        ...base, costPerCallMicros: 10,
        async complete(request) {
          calls += 1;
          if (calls === 1) throw new Error('Injected transport failure.');
          return { ...await base.complete(request), costMicros: 3 };
        },
      },
    });
    expect(calls).toBe(2);
    expect(result).toMatchObject({ state: 'failed', error: { code: 'budget_exhausted' }, spentCostMicros: 3, reservedCostMicros: 13 });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('does not reset the retry allowance after a successful tool turn', async () => {
    let calls = 0;
    const base = scriptedProvider([{ toolCalls: [{ callId: 'retry-search', name: 'receipt.search', arguments: {} }] }]);
    const result = await runReceiptAssistant(db, {
      runId: 'assistant-retry-carry', requestId: 'assistant-retry-carry', session: adminSession,
      message: 'Find receipts.', limits,
      provider: {
        ...base,
        async complete(request) {
          calls += 1;
          if (calls === 1 || calls >= 3) throw new Error('Injected transport failure.');
          return base.complete(request);
        },
      },
    });
    expect(calls).toBe(3);
    expect(result).toMatchObject({ state: 'failed', error: { code: 'provider_failed' }, retries: 1 });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  async function saveProvider(overrides: Record<string, unknown> = {}) {
    return withTenantTransaction(db, scope, (tx) => configureAgentProviderWithin(tx, scope,
      { userId: admin.userId, requestId: 'provider-fixture-config' }, {
        provider: 'openai', model: 'gpt-4.1-mini', dataRegion: 'global',
        dataPolicy: 'tenant_no_training', maxProviderCalls: 8, maxRetries: 1,
        maxCostMicros: 500_000, maxDurationMs: 15_000,
        credentialEnvelope: encryptToken('synthetic-company-key', Buffer.alloc(32, 7)),
        ...overrides,
      }));
  }

  function companyFactory(send: typeof fetch, enabled = true) {
    return createReceiptAssistantProviderFactory({ enabled, ...fixturePricing,
      agentPrincipalKey: 'receipt-assistant', tokenEncryptionKey: Buffer.alloc(32, 7).toString('hex'), fetch: send });
  }

  it.each([
    ['disabled', { enabled: false }],
    ['tenant only', { dataPolicy: 'tenant_only' }],
    ['local region', { dataRegion: 'tenant-local' }],
    ['unsupported model', { model: 'gpt-5-mini' }],
    ['zero budget', { maxCostMicros: 0 }],
  ])('rejects %s Company configuration before egress', async (_label, overrides) => {
    await saveProvider(overrides);
    let calls = 0;
    providerFactory = companyFactory(async () => { calls += 1; throw new Error('Must not send.'); });
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/assistant/receipts`, {
      method: 'POST', headers: mutationHeaders(auth), body: JSON.stringify({ message: 'Find receipts.' }),
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('synthetic-company-key');
    expect(calls).toBe(0);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('requires explicit activation and never reads another Company configuration', async () => {
    await saveProvider();
    let calls = 0;
    const send: typeof fetch = async () => { calls += 1; throw new Error('Must not send.'); };
    const context = { db, session: adminSession, requestId: 'scope-test', runId: 'scope-test' };
    await expect(companyFactory(send, false)(context)).rejects.toMatchObject({ code: 'assistant_provider_unavailable' });
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, scope.masterFn), eq(companyModule.companyFn, 'C-MY'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    const otherSession = { ...adminSession, activeCompanyFn: 'C-MY' };
    const otherPrincipal = await createAgentPrincipal(db, otherSession, {
      principalKey: 'receipt-assistant', displayName: 'Other Company Assistant', ownerUserId: admin.userId,
    }, 'other-company-principal');
    await createAgentGrant(db, otherSession, {
      agentPrincipalId: otherPrincipal.id, actionName: 'receipt.search',
      permissionKey: 'expenses.company_receipts.read_company', resourceKey: 'expenses/company_receipts',
      scope: 'company', targetType: 'none', targetId: '', fieldAllowlist: ['*'],
    }, 'other-company-grant');
    await expect(companyFactory(send)({ ...context, session: otherSession })).rejects.toMatchObject({ code: 'assistant_provider_unavailable' });
    await db.delete(agentProviderConfig).where(and(eq(agentProviderConfig.masterFn, scope.masterFn), eq(agentProviderConfig.companyFn, scope.companyFn)));
    await expect(companyFactory(send)(context)).rejects.toMatchObject({ code: 'assistant_provider_unavailable' });
    expect(calls).toBe(0);
  });

  it.each(['rotation', 'revocation'])('stops %s before sending a second provider request', async (change) => {
    await saveProvider();
    let calls = 0;
    const send = protocolFetch([{ toolCalls: [{ callId: 'live-search', name: 'receipt.search', arguments: {} }] }]);
    providerFactory = companyFactory(async (url, init) => {
      calls += 1;
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer synthetic-company-key');
      const response = await send(url, init);
      if (change === 'rotation') await saveProvider({ credentialEnvelope: encryptToken('rotated-fixture-key', Buffer.alloc(32, 7)) });
      else await db.update(agentGrant).set({ revokedAt: new Date() }).where(eq(agentGrant.agentPrincipalId, assistantPrincipalId));
      return response;
    });
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/assistant/receipts`, {
      method: 'POST', headers: mutationHeaders(auth), body: JSON.stringify({ message: 'Find receipts.' }),
    });
    expect(response.status).toBe(422);
    expect(calls).toBe(1);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('uses persisted Company call limits instead of route fixture limits', async () => {
    await saveProvider({ maxProviderCalls: 1, maxRetries: 0 });
    providerFactory = companyFactory(protocolFetch([{ toolCalls: [{ callId: 'limited-search', name: 'receipt.search', arguments: {} }] }]));
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/assistant/receipts`, {
      method: 'POST', headers: mutationHeaders(auth), body: JSON.stringify({ message: 'Find receipts.' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { providerCalls: 1, authoritativeCompletion: false, state: 'succeeded' } });
  });

  afterEach(async () => {
    if (!server) return;
    const activeServer = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => activeServer.close((error) =>
      error ? reject(error) : resolve()));
  });

  async function createReceipt(merchant = 'Assistant Merchant') {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: `assistant-${merchant.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      fileName: 'assistant-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'receipt-assistant-test',
      resultCode: 'clean',
      completedAt: new Date('2026-09-09T08:00:00.000Z'),
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    return withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(tx, scope, admin.userId, {
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      transactionDate: '2026-09-09',
      merchant,
      receiptNumber: `ASSIST-${uploaded.version.id}`,
      amount: '18.2500',
      currency: 'SGD',
      category: 'Travel',
      businessPurpose: 'Receipt assistant test',
    }));
  }

  async function login(): Promise<{ header: string; csrf: string }> {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: 'admin', password: 'demo1234' }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function mutationHeaders(auth: { header: string; csrf: string }) {
    return {
      cookie: auth.header,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
    };
  }

  it.each(['scripted', 'openai-http-fixture', 'company-config'])('runs %s search, exact confirmation and persisted Pack/artifact verification', async (mode) => {
    const receipt = await createReceipt();
    const steps: ScriptedResponse[] = [
      {
        toolCalls: [{
          callId: 'search-001',
          name: 'receipt.search',
          arguments: { limit: 10, dateFrom: '2026-09-01', dateTo: '2026-09-30' },
        }],
      },
      {
        toolCalls: [{
          callId: 'prepare-001',
          name: 'receipt_pack.prepare',
          arguments: { dateFrom: '2026-09-01', dateTo: '2026-09-30', locale: 'en' },
        }],
      },
      { text: 'The exact Receipt Pack contents are ready for your confirmation.' },
    ];
    if (mode === 'company-config') {
      await saveProvider();
      providerFactory = companyFactory(protocolFetch(steps));
    } else providerFactory = () => (mode === 'scripted' ? scriptedProvider : protocolProvider)(steps);
    const auth = await login();
    const start = await fetch(`${baseUrl}/api/assistant/receipts`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({ message: 'Find September receipts and prepare a Receipt Pack.' }),
    });
    const startBody = await start.json() as {
      data: {
        state: string;
        preview: { rows: Array<{ receiptId: number }>; selectionDigest: string };
        confirmation: {
          available: boolean;
          intentId: number;
          intentVersion: number;
          intentKey: string;
          packKey: string;
          payloadDigest: string;
          selectionDigest: string;
        };
        sources: Array<{ sourceType: string; sourceId: string }>;
        authoritativeCompletion: boolean;
      };
    };
    expect(start.status, JSON.stringify(startBody)).toBe(200);
    expect(startBody.data).toMatchObject({
      state: 'waiting',
      authoritativeCompletion: false,
      preview: {
        rows: [expect.objectContaining({ receiptId: receipt.id })],
        selectionDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      confirmation: {
        available: true,
        intentId: expect.any(Number),
        intentVersion: 1,
        intentKey: expect.stringContaining('assistant-intent-'),
        packKey: expect.stringContaining('assistant-'),
        payloadDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(startBody.data.sources.some((source) => source.sourceType === 'receipt')).toBe(true);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);

    const confirmation = startBody.data.confirmation;
    const approve = await fetch(`${baseUrl}/api/assistant/receipts/actions/approve`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({
        intentId: confirmation.intentId,
        expectedVersion: confirmation.intentVersion,
        reason: 'I reviewed the exact Receipt Pack contents.',
      }),
    });
    expect(approve.status).toBe(200);
    expect(await approve.json()).toMatchObject({
      data: { id: confirmation.intentId, status: 'approved', version: 2 },
      meta: { humanDecision: 'approve' },
    });

    const execute = await fetch(`${baseUrl}/api/assistant/receipts/actions/execute`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({
        packKey: confirmation.packKey,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
        executionIntentId: confirmation.intentId,
        executionIntentKey: confirmation.intentKey,
        selectionDigest: confirmation.selectionDigest,
        payloadDigest: confirmation.payloadDigest,
      }),
    });
    const executeBody = await execute.json() as {
      data: {
        state: string;
        replayed: boolean;
        pack: { id: number; rows: Array<{ receiptId: number }>; sourceSha256: string };
        verification: { pack: { id: number; sourceSha256: string }; artifact: {
          artifactSha256: string;
          sourceSha256: string;
          byteLength: number;
        } };
      };
    };
    expect(execute.status, JSON.stringify(executeBody)).toBe(200);
    expect(executeBody.data).toMatchObject({
      state: 'succeeded',
      replayed: false,
      pack: { rows: [expect.objectContaining({ receiptId: receipt.id })] },
      verification: {
        pack: { id: expect.any(Number), sourceSha256: executeBody.data.pack.sourceSha256 },
        artifact: {
          artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          sourceSha256: executeBody.data.pack.sourceSha256,
          byteLength: expect.any(Number),
        },
      },
    });
    expect(executeBody.data.verification.artifact.byteLength).toBeGreaterThan(0);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);

    const replay = await fetch(`${baseUrl}/api/assistant/receipts/actions/execute`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({
        packKey: confirmation.packKey,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
        executionIntentId: confirmation.intentId,
        executionIntentKey: confirmation.intentKey,
        selectionDigest: confirmation.selectionDigest,
        payloadDigest: confirmation.payloadDigest,
      }),
    });
    expect(replay.status).toBe(200);
    expect((await replay.json()).data).toMatchObject({
      state: 'succeeded',
      replayed: true,
      pack: { id: executeBody.data.pack.id, sourceSha256: executeBody.data.pack.sourceSha256 },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  });

  it('fails closed for a denied detail tool call and never creates a Pack', async () => {
    await createReceipt();
    providerFactory = () => scriptedProvider([{
      text: 'I cannot disclose that record.',
      toolCalls: [{
        callId: 'foreign-001',
        name: 'receipt.get',
        arguments: { receiptId: 999999 },
      }],
    }]);
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/assistant/receipts`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({ message: 'Open receipt 999999.' }),
    });
    const body = await response.json() as {
      data: {
        state: string;
        authoritativeCompletion: boolean;
        toolResults: Array<{ ok: boolean; error?: { code: string } }>;
      };
    };
    expect(response.status).toBe(422);
    expect(body.data).toMatchObject({
      state: 'failed',
      authoritativeCompletion: false,
      toolResults: [{ ok: false, error: { code: 'company_receipt_not_found' } }],
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('rejects malformed provider tool input without allowing guessed authority or a Pack write', async () => {
    providerFactory = () => scriptedProvider([{
      toolCalls: [{
        callId: 'tampered-001',
        name: 'receipt.search',
        arguments: {
          limit: 10,
          companyFn: 'C-MY',
        },
      }],
    }]);
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/assistant/receipts`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({ message: 'Search my receipts.' }),
    });
    const body = await response.json() as {
      data: { state: string; toolResults: Array<{ ok: boolean; error?: { code: string } }> };
    };
    expect(response.status).toBe(422);
    expect(body.data).toMatchObject({
      state: 'failed',
      toolResults: [{ ok: false, error: { code: 'tenant_scope_is_session_derived' } }],
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it.each(['factory', 'provider'] as const)(
    'cancels the pending %s when the client disconnects without creating a Pack',
    async (phase) => {
      const auth = await login();
      let entered = false;
      let aborted = false;
      let release: () => void = () => {};
      const pending = new Promise<void>((resolve) => { release = resolve; });
      const waitForAbort = async (signal?: AbortSignal) => {
        entered = true;
        const onAbort = () => { aborted = true; release(); };
        if (signal?.aborted) onAbort();
        else signal?.addEventListener('abort', onAbort, { once: true });
        try { await pending; }
        finally { signal?.removeEventListener('abort', onAbort); }
      };
      providerFactory = async (context) => {
        if (phase === 'factory') await waitForAbort(context.signal);
        const provider = scriptedProvider([{ text: 'No business action was executed.' }]);
        return {
          ...provider,
          async complete(request) {
            if (phase === 'provider') await waitForAbort(request.signal);
            return provider.complete(request);
          },
        };
      };
      const controller = new AbortController();
      const response = fetch(`${baseUrl}/api/assistant/receipts`, {
        method: 'POST', headers: mutationHeaders(auth), signal: controller.signal,
        body: JSON.stringify({ message: 'Find receipts.' }),
      }).catch(() => null);
      try {
        await expect.poll(() => entered, { timeout: 2_000 }).toBe(true);
        controller.abort();
        await response;
        await expect.poll(() => aborted, { timeout: 2_000 }).toBe(true);
        expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
      } finally {
        controller.abort();
        release();
        await response;
      }
    },
  );

  it('returns an actionable unavailable-provider error instead of a simulated answer', async () => {
    const auth = await login();
    const unavailableServer = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => unavailableServer.once('listening', resolve));
    const address = unavailableServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing unavailable-provider address.');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      const response = await fetch(`${url}/api/assistant/receipts`, {
        method: 'POST',
        headers: {
          ...mutationHeaders(auth),
        },
        body: JSON.stringify({ message: 'Find receipts.' }),
      });
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('assistant_provider_unavailable');
    } finally {
      await new Promise<void>((resolve, reject) => unavailableServer.close((error) =>
        error ? reject(error) : resolve()));
    }
  });

  it('keeps the assistant identity tenant-scoped when the active Company changes', async () => {
    const switchedSession = { ...adminSession, activeCompanyFn: 'C-MY' };
    expect(await resolveReceiptAssistantIdentity(db, switchedSession, 'receipt-assistant')).toBeNull();
    const grants = await db.select().from(agentGrant).where(eq(agentGrant.agentPrincipalId, assistantPrincipalId));
    expect(grants.length).toBe(6);
    expect(grants.every((grant) => grant.companyFn === scope.companyFn)).toBe(true);
  });

  it('keeps a cancelled confirmation in a truthful terminal state with no Pack write', async () => {
    await createReceipt('Cancelled Assistant Merchant');
    providerFactory = () => scriptedProvider([{
      toolCalls: [{
        callId: 'prepare-cancel-001',
        name: 'receipt_pack.prepare',
        arguments: { dateFrom: '2026-09-01', dateTo: '2026-09-30', locale: 'en' },
      }],
    }, { text: 'Confirmation is required.' }]);
    const auth = await login();
    const start = await fetch(`${baseUrl}/api/assistant/receipts`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({ message: 'Prepare a Receipt Pack for September.' }),
    });
    expect(start.status).toBe(200);
    const confirmation = (await start.json() as {
      data: { confirmation: { intentId: number; intentVersion: number; intentKey: string; packKey: string; selectionDigest: string; payloadDigest: string } };
    }).data.confirmation;
    const cancel = await fetch(`${baseUrl}/api/assistant/receipts/actions/cancel`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({
        intentId: confirmation.intentId,
        expectedVersion: confirmation.intentVersion,
        reason: 'The user cancelled this proposed Pack.',
      }),
    });
    expect(cancel.status).toBe(200);
    expect((await cancel.json()).data).toMatchObject({
      id: confirmation.intentId,
      status: 'cancelled',
      version: 2,
    });
    const execute = await fetch(`${baseUrl}/api/assistant/receipts/actions/execute`, {
      method: 'POST',
      headers: mutationHeaders(auth),
      body: JSON.stringify({
        packKey: confirmation.packKey,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
        executionIntentId: confirmation.intentId,
        executionIntentKey: confirmation.intentKey,
        selectionDigest: confirmation.selectionDigest,
        payloadDigest: confirmation.payloadDigest,
      }),
    });
    expect(execute.status).toBe(428);
    expect((await execute.json()).error.code).toBe('agent_execution_intent_not_approved');
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });
});
