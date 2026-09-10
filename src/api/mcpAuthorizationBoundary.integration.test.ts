import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import type { SessionData } from '../auth/session';
import {
  agentExecutionIntent,
  appUser,
  companyModule,
  companyReceiptPack,
  documentScanJob,
  masterModule,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { createAgentGrant, createAgentPrincipal } from '../modules/agent/agentIdentity';
import {
  approveAgentExecutionIntentWithin,
  cancelAgentExecutionIntentWithin,
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
  type LocalMcpAuthorizationFixture,
  type McpAuthenticatedIdentity,
} from './mcpAuthorization';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const issuer = 'https://mcp-issuer.example.test';
const resourceUri = 'http://127.0.0.1/api/mcp/v1';

interface JsonRpcPayload {
  result?: {
    isError?: boolean;
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { code: number; message: string };
}

describe('MCP per-call authorization and approval boundary', () => {
  let db: DB;
  let preparedAt: Date;
  let server: Server | undefined;
  let baseUrl: string;
  let admin: typeof appUser.$inferSelect;
  let adminSession: SessionData;
  let principalId: number;
  let fixture: LocalMcpAuthorizationFixture;
  let validIdentity: McpAuthenticatedIdentity;
  let validToken: string;

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
      principalKey: 'mcp-s3-agent',
      displayName: 'MCP S3 Agent',
      ownerUserId: admin.userId,
    }, 'mcp-s3-principal');
    principalId = principal.id;
    await createAgentGrant(db, adminSession, {
      agentPrincipalId: principalId,
      actionName: 'receipt.search',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipts',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id'],
    }, 'mcp-s3-search-grant');
    await createAgentGrant(db, adminSession, {
      agentPrincipalId: principalId,
      actionName: 'receipt_pack.create',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipt_packs',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['*'],
    }, 'mcp-s3-create-grant');

    fixture = createLocalMcpAuthorizationFixture({ issuer, resourceUri });
    validIdentity = {
      agentPrincipalId: principalId,
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      issuer,
      audience: resourceUri,
      subject: 'mcp-s3-agent',
      scopes: [...MCP_RESOURCE_SCOPES],
    };
    validToken = issueToken();

    const activeServer = createApp(db, {
      mcpAuthorization: fixture.adapter,
      mcpIssuer: issuer,
      mcpResourceUri: resourceUri,
    }).listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve) => activeServer.once('listening', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing MCP S3 server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    const activeServer = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => activeServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  });

  function issueToken(
    overrides: Partial<McpAuthenticatedIdentity> = {},
    scopes: readonly McpAuthenticatedIdentity['scopes'][number][] = [...MCP_RESOURCE_SCOPES],
    expiresAt = Math.floor(Date.now() / 1000) + 300,
  ): string {
    const token = newLocalMcpFixtureToken();
    fixture.issue(token, {
      identity: { ...validIdentity, ...overrides, scopes },
      expiresAt,
    });
    return token;
  }

  async function mcpRequest(token: string, body: unknown): Promise<{
    response: Response;
    payload: JsonRpcPayload;
  }> {
    const response = await fetch(`${baseUrl}${MCP_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify(body),
    });
    return {
      response,
      payload: await response.json() as JsonRpcPayload,
    };
  }

  function toolCall(name: string, args: unknown, id = 1) {
    return {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    };
  }

  function toolError(payload: JsonRpcPayload): { code: string; message: string } {
    const text = payload.result?.content?.find((item) => item.type === 'text')?.text;
    if (!text) throw new Error(`Missing structured MCP tool error: ${JSON.stringify(payload)}`);
    return (JSON.parse(text) as { error: { code: string; message: string } }).error;
  }

  async function closeServer(activeServer: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => activeServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  }

  async function createReceipt(): Promise<void> {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: 'mcp-s3-receipt-0001',
      fileName: 'mcp-s3-receipt.png',
      declaredMimeType: 'image/png',
      content: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]),
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'mcp-s3-test',
      resultCode: 'clean',
      completedAt: preparedAt,
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    await withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(tx, scope, admin.userId, {
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      transactionDate: '2026-09-08',
      merchant: 'MCP S3 Merchant',
      receiptNumber: 'MCP-S3-001',
      amount: '12.5000',
      currency: 'SGD',
      category: 'Travel',
      businessPurpose: 'MCP S3 approval boundary',
    }));
  }

  it('rejects wrong audience, expired/revoked tokens and missing delegated scopes', async () => {
    const wrongAudienceServer = createApp(db, {
      mcpAuthorization: {
        authenticate: async () => ({
          ...validIdentity,
          audience: 'https://other.example.test/api/mcp/v1',
        }),
      },
      mcpIssuer: issuer,
      mcpResourceUri: resourceUri,
    }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => wrongAudienceServer.once('listening', resolve));
    const wrongAddress = wrongAudienceServer.address();
    if (!wrongAddress || typeof wrongAddress === 'string') throw new Error('Missing wrong-audience server address.');
    const wrongAudienceResponse = await fetch(`http://127.0.0.1:${wrongAddress.port}${MCP_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { authorization: 'Bearer synthetic-valid-length-token', 'content-type': 'application/json' },
      body: JSON.stringify(toolCall('receipt.search', { limit: 1 })),
    });
    expect(wrongAudienceResponse.status).toBe(401);
    await closeServer(wrongAudienceServer);

    const expiredToken = issueToken({}, [...MCP_RESOURCE_SCOPES], Math.floor(Date.now() / 1000) + 1);
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect((await mcpRequest(expiredToken, toolCall('receipt.search', { limit: 1 }))).response.status)
      .toBe(401);

    const revokedToken = issueToken();
    fixture.revoke(revokedToken);
    expect((await mcpRequest(revokedToken, toolCall('receipt.search', { limit: 1 }))).response.status)
      .toBe(401);

    const readOnlyToken = issueToken({}, ['erp.receipts.read']);
    const prepare = await mcpRequest(readOnlyToken, toolCall('receipt_pack.prepare', {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    }));
    expect(prepare.response.status).toBe(401);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('rejects a guessed Company without disclosure and preserves the write boundary', async () => {
    const guessedCompanyToken = issueToken({ companyFn: 'C-MY' });
    const result = await mcpRequest(guessedCompanyToken, toolCall('receipt.search', { limit: 1 }));
    expect(result.response.status).toBe(200);
    expect(result.payload.result?.isError).toBe(true);
    expect(toolError(result.payload).code).toMatch(/agent_principal_not_found|module_not_enabled/);
    expect(result.payload.result?.content?.[0]?.text).not.toContain('C-MY');
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('rejects a changed pre-commit approval without creating a Pack', async () => {
    await createReceipt();
    const prepared = await withTenantTransaction(db, scope, (tx) =>
      prepareAgentExecutionIntentWithin(tx, scope, {
        agentPrincipalId: principalId,
        actorUserId: admin.userId,
        intentKey: 'mcp-s3-intent-key-0001',
        packKey: 'mcp-s3-pack-0001',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
        visibility: 'company',
        requestId: 'mcp-s3-prepare-0001',
      }, preparedAt));
    expect(prepared.intent.expiresAt.getTime(), 'Fixture intent must be current before the HTTP boundary').toBeGreaterThan(Date.now());
    const approved = await withTenantTransaction(db, scope, (tx) =>
      approveAgentExecutionIntentWithin(tx, scope, {
        intentId: prepared.intent.id,
        expectedVersion: prepared.intent.version,
        decisionByUserId: admin.userId,
        reason: 'MCP S3 reviewed approval',
        requestId: 'mcp-s3-approve-0001',
      }, preparedAt));
    await withTenantTransaction(db, scope, (tx) => cancelAgentExecutionIntentWithin(tx, scope, {
      intentId: approved.id,
      expectedVersion: approved.version,
      decisionByUserId: admin.userId,
      reason: 'MCP S3 approval was changed before execution',
      requestId: 'mcp-s3-cancel-0001',
    }, preparedAt));

    const result = await mcpRequest(validToken, toolCall('receipt_pack.create', {
      packKey: approved.packKey,
      dateFrom: approved.filters.dateFrom,
      dateTo: approved.filters.dateTo,
      locale: approved.locale,
      executionIntentId: approved.id,
      executionIntentKey: 'mcp-s3-intent-key-0001',
      selectionDigest: approved.selectionDigest,
      payloadDigest: approved.payloadDigest,
    }));
    expect(result.response.status).toBe(200);
    expect(result.payload.result?.isError).toBe(true);
    expect(toolError(result.payload).code).toBe('agent_execution_intent_not_approved');
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    expect(await db.select().from(agentExecutionIntent).where(
      eq(agentExecutionIntent.id, approved.id),
    )).toHaveLength(1);
  });
});
