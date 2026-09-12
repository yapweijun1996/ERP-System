import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import type { SessionData } from '../auth/session';
import {
  agentExecutionIntent,
  agentGrant,
  appUser,
  auditLog,
  companyModule,
  companyReceiptPack,
  documentScanJob,
  masterModule,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { createAgentGrant, createAgentPrincipal } from '../modules/agent/agentIdentity';
import {
  approveAgentExecutionIntentWithin,
  prepareAgentExecutionIntentWithin,
} from '../modules/agent/agentExecutionIntent';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { withTenantTransaction } from '../data/tenantTransaction';
import { freshDb } from '../test/helpers';
import { createApp } from './app';
import {
  createLocalMcpAuthorizationFixture,
  newLocalMcpFixtureToken,
  MCP_ENDPOINT_PATH,
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCE_SCOPES,
  type McpAuthenticatedIdentity,
} from './mcpAuthorization';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const issuer = 'https://mcp-issuer.example.test';
const resourceUri = 'http://127.0.0.1/api/mcp/v1';
const PYTHON_BIN = process.env.MCP_S4_PYTHON ?? '/tmp/erp-system-mcp-s4-venv/bin/python';
const PYTHON_SCRIPT = 'tests/e2e/mcp-python-client.py';

interface PythonInteropResult {
  client: string;
  version: string;
  protocolVersion: string;
  tools: string[];
  searchIsError: boolean;
  search: { action: string; body: { data: unknown[] } };
  replay: {
    structuredContent: {
      action: string;
      body: { data: { pack: { id: number }; replayed: boolean } };
    };
  };
  conflict: { isError: boolean; errorText: string[] };
  pack: {
    structuredContent: {
      action: string;
      body: { data: { id: number } };
    };
  };
  export: {
    isError?: boolean;
    structuredContent: {
      action: string;
      body: { artifactSha256: string; sourceSha256: string; byteLength: number };
    };
    resourceByteLength: number;
    resourceSha256: string;
  };
}

function runPythonClient(input: {
  endpoint: string;
  token: string;
  packId: number;
  createInput: Record<string, unknown>;
}): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [
      PYTHON_SCRIPT,
      '--endpoint', input.endpoint,
      '--token', input.token,
      '--pack-id', String(input.packId),
      '--create-input', JSON.stringify(input.createInput),
      '--protocol-version', MCP_PROTOCOL_VERSION,
    ], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

describe.skipIf(!existsSync(PYTHON_BIN))('MCP two-client interoperability', () => {
  let db: DB;
  let preparedAt: Date;
  let server: Server | undefined;
  let baseUrl: string;
  let admin: typeof appUser.$inferSelect;
  let adminSession: SessionData;
  let principalId: number;
  let token: string;
  let activeClient: Client | undefined;

  beforeEach(async () => {
    // The HTTP executor uses real time; keep short-lived fixture intents current.
    preparedAt = new Date();
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
      principalKey: 'mcp-s4-agent',
      displayName: 'MCP S4 Agent',
      ownerUserId: admin.userId,
    }, 'mcp-s4-principal');
    principalId = principal.id;
    const grantCases = [
      ['receipt.search', 'expenses/company_receipts', 'mcp-s4-search'],
      ['receipt.get', 'expenses/company_receipts', 'mcp-s4-get'],
      ['receipt_pack.prepare', 'expenses/company_receipt_packs', 'mcp-s4-prepare'],
      ['receipt_pack.create', 'expenses/company_receipt_packs', 'mcp-s4-create'],
      ['receipt_pack.get', 'expenses/company_receipt_packs', 'mcp-s4-pack-get'],
      ['receipt_pack.export', 'expenses/company_receipt_packs', 'mcp-s4-export'],
    ] as const;
    for (const [actionName, resourceKey, idempotencyKey] of grantCases) {
      await createAgentGrant(db, adminSession, {
        agentPrincipalId: principalId,
        actionName,
        permissionKey: 'expenses.company_receipts.read_company',
        resourceKey,
        scope: 'company',
        targetType: 'none',
        targetId: '',
        fieldAllowlist: ['*'],
      }, idempotencyKey);
    }

    const identity: McpAuthenticatedIdentity = {
      agentPrincipalId: principalId,
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      issuer,
      audience: resourceUri,
      subject: 'mcp-s4-agent',
      scopes: [...MCP_RESOURCE_SCOPES],
    };
    const fixture = createLocalMcpAuthorizationFixture({ issuer, resourceUri });
    token = newLocalMcpFixtureToken();
    fixture.issue(token, {
      identity,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });

    const activeServer = createApp(db, {
      mcpAuthorization: fixture.adapter,
      mcpIssuer: issuer,
      mcpResourceUri: resourceUri,
    }).listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve) => activeServer.once('listening', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing MCP S4 server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await activeClient?.close().catch(() => undefined);
    activeClient = undefined;
    if (!server) return;
    const activeServer = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => activeServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  });

  async function createReceipt(): Promise<number> {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: 'mcp-s4-receipt-0001',
      fileName: 'mcp-s4-receipt.png',
      declaredMimeType: 'image/png',
      content: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x04]),
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'mcp-s4-test',
      resultCode: 'clean',
      completedAt: preparedAt,
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    const receipt = await withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(tx, scope, admin.userId, {
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      transactionDate: '2026-09-08',
      merchant: 'MCP S4 Merchant',
      receiptNumber: 'MCP-S4-001',
      amount: '18.2500',
      currency: 'SGD',
      category: 'Travel',
      businessPurpose: 'MCP S4 interoperability',
    }));
    return receipt.id;
  }

  it('runs the receipt-to-Pack pilot through TypeScript and Python clients with dropped-response replay', async () => {
    const receiptId = await createReceipt();
    let dropCreateResponse = false;
    const client = new Client({ name: 'erp-system-typescript-s4', version: '1.30.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}${MCP_ENDPOINT_PATH}`),
      {
        requestInit: {
          headers: {
            authorization: `Bearer ${token}`,
            'mcp-protocol-version': MCP_PROTOCOL_VERSION,
          },
        },
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          const requestBody = typeof init?.body === 'string' ? init.body : '';
          if (dropCreateResponse && requestBody.includes('receipt_pack.create')) {
            dropCreateResponse = false;
            await response.arrayBuffer();
            throw new Error('S4 simulated dropped MCP response after server commit.');
          }
          return response;
        },
      },
    );
    activeClient = client;
    await client.connect(transport);
    expect(transport.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(6);

    const search = await client.callTool({
      name: 'receipt.search',
      arguments: { limit: 10 },
    });
    expect(search.isError).not.toBe(true);
    expect(search.structuredContent).toMatchObject({
      action: 'receipt.search',
      body: { data: [expect.objectContaining({ id: receiptId })] },
    });

    const detail = await client.callTool({
      name: 'receipt.get',
      arguments: { receiptId },
    });
    expect(detail.isError).not.toBe(true);
    expect(detail.structuredContent).toMatchObject({
      action: 'receipt.get',
      body: { data: { id: receiptId, version: 1 } },
    });

    const firstPage = await client.callTool({
      name: 'receipt.search',
      arguments: { limit: 1 },
    });
    expect(firstPage.isError).not.toBe(true);
    expect(firstPage.structuredContent).toMatchObject({
      body: { data: [expect.objectContaining({ id: receiptId })] },
    });
    const emptyPage = await client.callTool({
      name: 'receipt.search',
      arguments: { limit: 10, afterId: receiptId },
    });
    expect(emptyPage.isError).not.toBe(true);
    expect(emptyPage.structuredContent).toMatchObject({ body: { data: [] } });
    const invalidInput = await client.callTool({
      name: 'receipt.search',
      arguments: { limit: 0 },
    });
    expect(invalidInput.isError).toBe(true);

    const preparation = await client.callTool({
      name: 'receipt_pack.prepare',
      arguments: {
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
      },
    });
    expect(preparation.isError, JSON.stringify(preparation)).not.toBe(true);
    const preparationBody = preparation.structuredContent as {
      body: { data: { selectionDigest: string } };
    };
    expect(preparation.structuredContent, JSON.stringify(preparation)).toBeDefined();
    expect(preparationBody.body.data.selectionDigest, JSON.stringify(preparation)).toBeDefined();
    expect(preparationBody.body.data.selectionDigest).toMatch(/^[0-9a-f]{64}$/);

    const intentKey = 'mcp-s4-intent-key-0001';
    const packKey = 'mcp-s4-pack-0001';
    const prepared = await withTenantTransaction(db, scope, (tx) =>
      prepareAgentExecutionIntentWithin(tx, scope, {
        agentPrincipalId: principalId,
        actorUserId: admin.userId,
        intentKey,
        packKey,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
        visibility: 'company',
        selectionDigest: preparationBody.body.data.selectionDigest,
        requestId: 'mcp-s4-prepare-0001',
      }, preparedAt));
    expect(prepared.intent.expiresAt.getTime(), 'Fixture intent must be current before the HTTP boundary').toBeGreaterThan(Date.now());
    const approved = await withTenantTransaction(db, scope, (tx) =>
      approveAgentExecutionIntentWithin(tx, scope, {
        intentId: prepared.intent.id,
        expectedVersion: prepared.intent.version,
        decisionByUserId: admin.userId,
        reason: 'MCP S4 human-reviewed exact receipt selection',
        requestId: 'mcp-s4-approve-0001',
      }, preparedAt));
    const createInput = {
      packKey,
      dateFrom: approved.filters.dateFrom,
      dateTo: approved.filters.dateTo,
      locale: approved.locale,
      executionIntentId: approved.id,
      executionIntentKey: intentKey,
      selectionDigest: approved.selectionDigest,
      payloadDigest: approved.payloadDigest,
    };

    dropCreateResponse = true;
    await expect(client.callTool({
      name: 'receipt_pack.create',
      arguments: createInput,
    })).rejects.toThrow('simulated dropped MCP response');
    await client.close().catch(() => undefined);

    const [storedPack] = await db.select().from(companyReceiptPack)
      .where(and(
        eq(companyReceiptPack.masterFn, scope.masterFn),
        eq(companyReceiptPack.companyFn, scope.companyFn),
      ));
    expect(storedPack).toBeDefined();
    expect(storedPack.rows).toEqual([expect.objectContaining({ receiptId })]);

    const python = await runPythonClient({
      endpoint: `${baseUrl}${MCP_ENDPOINT_PATH}`,
      token,
      packId: storedPack.id,
      createInput,
    });
    expect(python.exitCode, python.stderr).toBe(0);
    const result = JSON.parse(python.stdout.trim()) as PythonInteropResult;
    expect(result, JSON.stringify(result)).toMatchObject({
      client: '@modelcontextprotocol/python-sdk',
      version: '1.27.2',
      protocolVersion: MCP_PROTOCOL_VERSION,
      searchIsError: false,
      tools: [
        'receipt.search',
        'receipt.get',
        'receipt_pack.prepare',
        'receipt_pack.create',
        'receipt_pack.get',
        'receipt_pack.export',
      ],
      replay: {
        structuredContent: {
          action: 'receipt_pack.create',
          body: { data: { pack: { id: storedPack.id }, replayed: true } },
        },
      },
      conflict: { isError: true },
      pack: {
        structuredContent: {
          action: 'receipt_pack.get',
          body: { data: { id: storedPack.id } },
        },
      },
      export: {
        isError: false,
        structuredContent: {
          action: 'receipt_pack.export',
          body: {
            contentType: 'application/pdf',
            byteLength: expect.any(Number),
            artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
            sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          },
        },
      },
    });
    expect(result.conflict.errorText.join('\n'))
      .toContain('company_receipt_pack_key_conflict');
    expect(result.search.body.data).toEqual([expect.objectContaining({ id: receiptId })]);
    expect(result.export.resourceByteLength).toBeGreaterThan(0);
    expect(result.export.resourceByteLength)
      .toBe(result.export.structuredContent.body.byteLength);
    expect(result.export.resourceSha256)
      .toBe(result.export.structuredContent.body.artifactSha256);

    const persistedPacks = await db.select().from(companyReceiptPack).where(and(
      eq(companyReceiptPack.masterFn, scope.masterFn),
      eq(companyReceiptPack.companyFn, scope.companyFn),
    ));
    expect(persistedPacks).toHaveLength(1);
    expect(persistedPacks[0].id).toBe(storedPack.id);
    expect(await db.select().from(agentExecutionIntent).where(
      eq(agentExecutionIntent.id, approved.id),
    )).toHaveLength(1);
    expect(await db.select().from(agentGrant).where(and(
      eq(agentGrant.agentPrincipalId, principalId),
      eq(agentGrant.actionName, 'receipt_pack.export'),
    ))).toHaveLength(1);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'company_receipt_pack'),
      eq(auditLog.entityId, String(storedPack.id)),
    ))).toHaveLength(3);
  });
});
