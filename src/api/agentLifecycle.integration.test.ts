import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  agentCredential,
  appUser,
  companyModule,
  masterModule,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrfCookie = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfCookie) throw new Error('Missing CSRF cookie.');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrfCookie.slice(9)) };
}

describe('Agent lifecycle management boundary', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let adminId: number;
  let adminAuth: { header: string; csrf: string };

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, 'M1'),
      eq(masterModule.moduleKey, 'expenses_tax'),
    ));
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, 'M1'),
      eq(companyModule.companyFn, 'C-SG'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    adminId = admin.userId;
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing lifecycle test server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: 'admin', password: 'demo1234' }),
    });
    expect(login.status).toBe(200);
    adminAuth = responseCookies(login);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function adminRequest(path: string, body?: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: body == null ? 'GET' : 'POST',
      headers: {
        cookie: adminAuth.header,
        ...(body == null ? {} : {
          'content-type': 'application/json',
          'x-csrf-token': adminAuth.csrf,
        }),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
  }

  async function createPrincipal(principalKey: string): Promise<{ id: number; version: number }> {
    const response = await adminRequest('/api/admin/agents', {
      principalKey,
      displayName: `Lifecycle ${principalKey}`,
      ownerUserId: adminId,
    });
    expect(response.status).toBe(201);
    return (await response.json()).data;
  }

  async function createGrant(agentPrincipalId: number): Promise<{ id: number; version: number }> {
    const response = await adminRequest(`/api/admin/agents/${agentPrincipalId}/grants`, {
      actionName: 'receipt.search',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipts',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id', 'merchant'],
    });
    expect(response.status).toBe(201);
    return (await response.json()).data;
  }

  async function rotateCredential(agentPrincipalId: number, expectedVersion: number): Promise<string> {
    const response = await adminRequest(`/api/admin/agents/${agentPrincipalId}/actions/rotate-credential`, {
      expectedVersion,
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.meta).toMatchObject({ credentialDelivery: 'show_once' });
    expect(body.data.token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    return body.data.token;
  }

  async function agentRequest(token: string): Promise<Response> {
    return fetch(`${baseUrl}/api/agent/actions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'receipt.search', input: { limit: 1 } }),
    });
  }

  async function review(): Promise<Array<Record<string, unknown>>> {
    const response = await adminRequest('/api/admin/agents');
    expect(response.status).toBe(200);
    return (await response.json()).data;
  }

  it('reviews safely, rotates hash-only credentials and enforces a two-call revocation boundary', async () => {
    const viewerLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: 'viewer', password: 'viewer1234' }),
    });
    expect(viewerLogin.status).toBe(200);
    const viewerAuth = responseCookies(viewerLogin);
    const unauthorizedReview = await fetch(`${baseUrl}/api/admin/agents`, {
      headers: { cookie: viewerAuth.header },
    });
    expect(unauthorizedReview.status).toBe(403);

    const principal = await createPrincipal('lifecycle-a');
    const grant = await createGrant(principal.id);
    const token = await rotateCredential(principal.id, principal.version);
    const first = await agentRequest(token);
    expect(first.status).toBe(200);

    const rows = await review();
    const reviewed = rows.find((row) => row.id === principal.id) as {
      version: number;
      grants: Array<{ id: number; version: number; status: string }>;
      credentials: Array<Record<string, unknown>>;
    };
    expect(reviewed).toBeTruthy();
    expect(reviewed.credentials).toHaveLength(1);
    expect(reviewed.credentials[0]).not.toHaveProperty('tokenHash');
    expect(JSON.stringify(reviewed)).not.toContain(token);

    const paused = await adminRequest(`/api/admin/agents/${principal.id}/actions/pause`, {
      expectedVersion: reviewed.version,
      reason: 'pause during controlled task test',
    });
    expect(paused.status).toBe(200);
    expect((await paused.json()).data.status).toBe('paused');
    const pausedCall = await agentRequest(token);
    expect(pausedCall.status).toBe(403);
    expect(await pausedCall.json()).toMatchObject({ error: { code: 'agent_principal_inactive' } });

    const pausedReview = (await review()).find((row) => row.id === principal.id) as { version: number };
    const resumed = await adminRequest(`/api/admin/agents/${principal.id}/actions/resume`, {
      expectedVersion: pausedReview.version,
      reason: 'controlled task resumed before grant revocation',
    });
    expect(resumed.status).toBe(200);
    expect((await resumed.json()).data.status).toBe('active');
    expect((await agentRequest(token)).status).toBe(200);

    const revoked = await adminRequest(
      `/api/admin/agents/${principal.id}/grants/${grant.id}/actions/revoke`,
      { expectedVersion: grant.version, reason: 'controlled task authority revoked' },
    );
    expect(revoked.status).toBe(200);
    const resumedAfterRevoke = await agentRequest(token);
    expect(resumedAfterRevoke.status).toBe(403);
    expect(await resumedAfterRevoke.json()).toMatchObject({ error: { code: 'agent_grant_inactive' } });

    const stored = await db.select().from(agentCredential).where(eq(agentCredential.agentPrincipalId, principal.id));
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(token);
  });

  it('disables one Agent without widening or disabling another Company principal', async () => {
    const firstPrincipal = await createPrincipal('isolated-a');
    const secondPrincipal = await createPrincipal('isolated-b');
    await createGrant(firstPrincipal.id);
    await createGrant(secondPrincipal.id);
    const firstToken = await rotateCredential(firstPrincipal.id, firstPrincipal.version);
    const secondToken = await rotateCredential(secondPrincipal.id, secondPrincipal.version);
    const firstReview = (await review()).find((row) => row.id === firstPrincipal.id) as { version: number };

    const disabled = await adminRequest(`/api/admin/agents/${firstPrincipal.id}/actions/disable`, {
      expectedVersion: firstReview.version,
      reason: 'emergency disable isolated Agent',
    });
    expect(disabled.status).toBe(200);
    expect((await agentRequest(firstToken)).status).toBe(401);
    expect((await agentRequest(secondToken)).status).toBe(200);

    const secondRows = await review();
    const secondReview = secondRows.find((row) => row.id === secondPrincipal.id) as {
      status: string;
      credentials: Array<{ status: string }>;
    };
    expect(secondReview.status).toBe('active');
    expect(secondReview.credentials[0].status).toBe('active');
  });

  it('rotates credentials atomically and rejects the old token while preserving the new token boundary', async () => {
    const principal = await createPrincipal('rotation-a');
    await createGrant(principal.id);
    const oldToken = await rotateCredential(principal.id, principal.version);
    const current = (await review()).find((row) => row.id === principal.id) as { version: number };
    const newToken = await rotateCredential(principal.id, current.version);

    const oldCall = await agentRequest(oldToken);
    expect(oldCall.status).toBe(401);
    const newCall = await agentRequest(newToken);
    expect(newCall.status).toBe(200);
    const rows = await review();
    const credentials = (rows.find((row) => row.id === principal.id) as {
      credentials: Array<{ status: string; tokenHint: string }>;
    }).credentials;
    expect(credentials.map((credential) => credential.status)).toEqual(['revoked', 'active']);
    expect(credentials.map((credential) => credential.tokenHint)).not.toContain(oldToken);
  });
});
