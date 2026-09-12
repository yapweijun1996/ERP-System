import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import type { SessionData } from '../auth/session';
import { appUser, companyModule, masterModule } from '../data/schema';
import { seedDemo } from '../data/seed';
import { createAgentGrant, createAgentPrincipal } from '../modules/agent/agentIdentity';
import {
  createLocalMcpAuthorizationFixture,
  newLocalMcpFixtureToken,
  MCP_ENDPOINT_PATH,
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCE_SCOPES,
} from './mcpAuthorization';
import { createApp } from './app';
import { freshDb } from '../test/helpers';

describe('MCP Streamable HTTP pilot boundary', () => {
  let db: DB;
  let server: Server | undefined;
  let baseUrl: string;
  let token: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, 'M1'),
      eq(masterModule.moduleKey, 'expenses_tax'),
    ));
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, 'M1'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const session: SessionData = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    const principal = await createAgentPrincipal(db, session, {
      principalKey: 'mcp-s2-agent',
      displayName: 'MCP S2 Agent',
      ownerUserId: admin.userId,
    }, 'mcp-s2-principal');
    await createAgentGrant(db, session, {
      agentPrincipalId: principal.id,
      actionName: 'receipt.search',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipts',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id'],
    }, 'mcp-s2-search-grant');

    const resourceUri = 'http://127.0.0.1/api/mcp/v1';
    const issuer = 'https://mcp-issuer.example.test';
    const fixture = createLocalMcpAuthorizationFixture({ issuer, resourceUri });
    token = newLocalMcpFixtureToken();
    fixture.issue(token, {
      identity: {
        agentPrincipalId: principal.id,
        masterFn: 'M1',
        companyFn: 'C-SG',
        issuer,
        audience: resourceUri,
        subject: 'mcp-s2-agent',
        scopes: [...MCP_RESOURCE_SCOPES],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    });

    const activeServer = createApp(db, {
      mcpAuthorization: fixture.adapter,
      mcpIssuer: issuer,
      mcpResourceUri: resourceUri,
    }).listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve) => activeServer.once('listening', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing MCP test server address.');
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

  it('serves RFC 9728 discovery and enforces bearer authentication', async () => {
    const discovery = await fetch(`${baseUrl}/.well-known/oauth-protected-resource${MCP_ENDPOINT_PATH}`);
    expect(discovery.status).toBe(200);
    expect(await discovery.json()).toEqual({
      resource: 'http://127.0.0.1/api/mcp/v1',
      authorization_servers: ['https://mcp-issuer.example.test'],
      scopes_supported: [...MCP_RESOURCE_SCOPES],
      resource_name: 'ERP Company Receipts',
    });

    const unauthenticated = await fetch(`${baseUrl}${MCP_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get('www-authenticate')).toContain(
      'resource_metadata="http://127.0.0.1/.well-known/oauth-protected-resource/api/mcp/v1"',
    );
  });

  it('initializes, lists the G01 tools and calls receipt.search through the official client', async () => {
    const client = new Client({ name: 'mcp-s2-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}${MCP_ENDPOINT_PATH}`),
      { requestInit: { headers: { authorization: `Bearer ${token}` } } },
    );
    await client.connect(transport);
    expect(transport.protocolVersion).toBe(MCP_PROTOCOL_VERSION);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      'receipt.search',
      'receipt.get',
      'receipt_pack.prepare',
      'receipt_pack.create',
      'receipt_pack.get',
      'receipt_pack.export',
    ]);
    expect(listed.tools.find((tool) => tool.name === 'receipt.search')?.description)
      .toContain('Search Company Receipts');

    const result = await client.callTool({
      name: 'receipt.search',
      arguments: { limit: 10 },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      action: 'receipt.search',
      version: 1,
      body: { data: [], meta: { scope: 'company', limit: 10 } },
    });
    await client.close();
  });

  it('returns a structured 429 with retry headers when the MCP budget is exhausted', async () => {
    const limitedServer = createApp(db, {
      mcpAuthorization: {
        authenticate: async ({ bearerToken }) => bearerToken === token
          ? {
            agentPrincipalId: 1,
            masterFn: 'M1',
            companyFn: 'C-SG',
            issuer: 'https://mcp-issuer.example.test',
            audience: 'http://127.0.0.1/api/mcp/v1',
            subject: 'mcp-s2-agent',
            scopes: [...MCP_RESOURCE_SCOPES],
          }
          : null,
      },
      mcpIssuer: 'https://mcp-issuer.example.test',
      mcpResourceUri: 'http://127.0.0.1/api/mcp/v1',
      mcpRateLimit: { maxRequests: 1, windowMs: 60_000 },
    }).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => limitedServer.once('listening', resolve));
      const address = limitedServer.address();
      if (!address || typeof address === 'string') throw new Error('Missing MCP rate-limit server address.');
      const endpoint = `http://127.0.0.1:${address.port}${MCP_ENDPOINT_PATH}`;
      const request = () => fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          'mcp-protocol-version': MCP_PROTOCOL_VERSION,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      expect((await request()).status).toBe(200);
      const limited = await request();
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBe('60');
      expect(limited.headers.get('ratelimit-remaining')).toBe('0');
      expect(await limited.json()).toMatchObject({
        error: { code: 'mcp_rate_limited' },
      });
    } finally {
      await new Promise<void>((resolve, reject) => limitedServer.close((error) => {
        if (error) reject(error);
        else resolve();
      }));
    }
  });
});
