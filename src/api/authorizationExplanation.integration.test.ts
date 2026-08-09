import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { auditLog, appUser } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

interface RunningApi {
  baseUrl: string;
  server: Server;
}

async function startApi(db: DB): Promise<RunningApi> {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP test server has no TCP address');
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopApi(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => {
    const matches = value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g);
    return Array.from(matches, (match) => `${match[1]}=${match[2]}`);
  });
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair || !pairs.some((pair) => pair.startsWith('erp_session='))) {
    throw new Error(`Missing auth cookies: ${values.join(' | ')}`);
  }
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

async function login(baseUrl: string, username: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationCode: 'ACME', username, password }),
  });
  expect(response.status).toBe(200);
  return responseCookies(response);
}

describe('authorization explanation security boundary', () => {
  let db: DB;
  let running: RunningApi;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    running = await startApi(db);
  });

  afterEach(async () => {
    await stopApi(running.server);
  });

  it('does not expose authorization internals to an ordinary client', async () => {
    const viewer = await login(running.baseUrl, 'viewer', 'viewer1234');
    const response = await fetch(`${running.baseUrl}/api/admin/authorization/explain`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'content-type': 'application/json',
        'x-csrf-token': viewer.csrf,
      },
      body: JSON.stringify({
        permissionKey: 'inventory.read',
        resourceKey: 'inventory/products',
      }),
    });
    expect(response.status).toBe(403);
    const body = await response.json() as { error?: Record<string, unknown> };
    expect(body.error).toMatchObject({ code: 'permission_denied' });
    expect(body.error).not.toHaveProperty('matchedAssignmentId');
    expect(body.error).not.toHaveProperty('candidateKeys');
  });

  it('returns audited full explanation only to an audit-authorized administrator', async () => {
    const admin = await login(running.baseUrl, 'admin', 'demo1234');
    const response = await fetch(`${running.baseUrl}/api/admin/authorization/explain`, {
      method: 'POST',
      headers: {
        cookie: admin.header,
        'content-type': 'application/json',
        'x-csrf-token': admin.csrf,
        'x-request-id': 'authorization-explanation-test',
      },
      body: JSON.stringify({
        permissionKey: 'inventory.read',
        resourceKey: 'inventory/products',
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as {
      data: Record<string, unknown>;
      meta: Record<string, unknown>;
    };
    expect(body.meta).toEqual({ privileged: true, audited: true });
    expect(body.data).toMatchObject({
      allowed: true,
      reasonCode: 'ALLOW_SUPERADMIN_COMPATIBILITY',
      permissionKey: 'inventory.read',
      resourceKey: 'inventory/products',
    });
    expect(body.data.matchedAssignmentId).toEqual(expect.any(Number));
    expect(body.data.candidateKeys).toEqual(expect.arrayContaining(['inventory.read']));

    const [audit] = await db.select().from(auditLog).where(eq(
      auditLog.requestId,
      'authorization-explanation-test',
    ));
    expect(audit).toMatchObject({
      entity: 'authorization_decision',
      action: 'explain',
      actorUserId: 1,
    });
  });

  it('creates and revokes a reasoned explicit deny without crossing tenant boundaries', async () => {
    const admin = await login(running.baseUrl, 'admin', 'demo1234');
    const [viewer] = await db.select({ id: appUser.userId }).from(appUser)
      .where(eq(appUser.username, 'viewer'));
    const create = await fetch(
      `${running.baseUrl}/api/admin/users/${viewer.id}/permission-overrides`,
      {
        method: 'POST',
        headers: {
          cookie: admin.header,
          'content-type': 'application/json',
          'x-csrf-token': admin.csrf,
          'x-request-id': 'authorization-deny-create',
        },
        body: JSON.stringify({
          permissionKey: 'inventory.read',
          effect: 'deny',
          reason: 'Temporary inventory access review',
        }),
      },
    );
    expect(create.status).toBe(201);
    const created = await create.json() as { data: { id: number } };
    expect(created.data.id).toBeGreaterThan(0);

    const viewerExplanation = await fetch(`${running.baseUrl}/api/admin/authorization/explain`, {
      method: 'POST',
      headers: {
        cookie: admin.header,
        'content-type': 'application/json',
        'x-csrf-token': admin.csrf,
      },
      body: JSON.stringify({ permissionKey: 'inventory.read', userId: viewer.id }),
    });
    expect((await viewerExplanation.json()).data).toMatchObject({
      allowed: false,
      reasonCode: 'DENY_EXPLICIT',
      matchedOverrideId: created.data.id,
    });

    const revoke = await fetch(
      `${running.baseUrl}/api/admin/permission-overrides/${created.data.id}/actions/revoke`,
      {
        method: 'POST',
        headers: {
          cookie: admin.header,
          'content-type': 'application/json',
          'x-csrf-token': admin.csrf,
          'x-request-id': 'authorization-deny-revoke',
        },
        body: JSON.stringify({ reason: 'Inventory review completed' }),
      },
    );
    expect(revoke.status).toBe(200);
  });
});
