import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../auth/password';
import { setRolePermission, setRoleResourceScope } from '../auth/adminLifecycle';
import {
  appUser,
  role,
  rolePermission,
  roleResourceScope,
  userCompany,
  userCompanyRole,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

const PASSWORD = 'freshness1234';

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf) throw new Error('Login did not return a CSRF cookie.');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf.slice('erp_csrf='.length)) };
}

describe('authorization snapshot freshness', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => server!.close((error) =>
      error ? reject(error) : resolve()));
    server = null;
  });

  it('fails a stale browser snapshot closed and denies the same direct URL after refresh', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [createdRole] = await db.insert(role).values({
      masterFn: 'M1', companyFn: 'C-SG', name: 'Freshness Reader', sourceTemplateKey: 'custom',
    }).returning({ roleId: role.roleId });
    const [reader] = await db.insert(appUser).values({
      masterFn: 'M1', username: 'freshness.reader', email: 'freshness.reader@example.test',
      fullName: 'Freshness Reader', passwordHash: hashPassword(PASSWORD), language: 'en',
    }).returning({ userId: appUser.userId });
    await db.insert(userCompany).values({
      userId: reader.userId, companyFn: 'C-SG', roleId: createdRole.roleId,
    });
    await db.insert(userCompanyRole).values({
      userId: reader.userId, companyFn: 'C-SG', roleId: createdRole.roleId,
      assignedByUserId: admin.userId, assignmentSource: 'manual',
    });
    await db.insert(rolePermission).values({
      masterFn: 'M1', roleId: createdRole.roleId, permissionKey: 'inventory.read', allowed: true,
    });
    await db.insert(roleResourceScope).values({
      masterFn: 'M1', companyFn: 'C-SG', roleId: createdRole.roleId,
      resourceKey: 'inventory/*', scope: 'company',
    });

    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server address.');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: 'freshness.reader', password: PASSWORD }),
    });
    expect(login.status).toBe(200);
    const cookies = responseCookies(login);
    const initialSession = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: cookies.header },
    });
    expect(initialSession.status).toBe(200);
    const initialBody = await initialSession.json() as {
      capabilities: { authorizationVersion: number; permissions: string[] };
    };
    const initialVersion = initialBody.capabilities.authorizationVersion;
    expect(initialBody.capabilities.permissions).toContain('inventory.read');

    const before = await fetch(`${baseUrl}/api/inventory/products`, {
      headers: { cookie: cookies.header, 'x-erp-authorization-version': String(initialVersion) },
    });
    expect(before.status).toBe(200);

    const unknownResource = await fetch(`${baseUrl}/api/future/widgets`, {
      headers: { cookie: cookies.header, 'x-erp-authorization-version': String(initialVersion) },
    });
    expect(unknownResource.status).toBe(404);
    expect(await unknownResource.json()).toMatchObject({ error: { code: 'resource_not_found' } });
    const unknownAction = await fetch(`${baseUrl}/api/inventory/products/1/actions/not-registered`, {
      method: 'POST',
      headers: {
        cookie: cookies.header,
        'content-type': 'application/json',
        'x-csrf-token': cookies.csrf,
        'x-erp-authorization-version': String(initialVersion),
      },
      body: JSON.stringify({}),
    });
    expect(unknownAction.status).toBe(404);
    expect(await unknownAction.json()).toMatchObject({ error: { code: 'action_not_found' } });

    await setRolePermission(db, {
      userId: admin.userId,
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    }, createdRole.roleId, 'inventory.read', false, 'freshness-revoke');

    const stale = await fetch(`${baseUrl}/api/inventory/products`, {
      headers: { cookie: cookies.header, 'x-erp-authorization-version': String(initialVersion) },
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: {
        code: 'authorization_state_stale',
        params: { authorizationVersion: expect.any(Number) },
      },
    });
    const currentVersion = Number(stale.headers.get('x-erp-authorization-version'));
    expect(currentVersion).toBeGreaterThan(initialVersion);

    const refreshed = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: cookies.header, 'x-erp-authorization-version': String(initialVersion) },
    });
    expect(refreshed.status).toBe(200);
    const refreshedBody = await refreshed.json() as {
      capabilities: { authorizationVersion: number; permissions: string[] };
    };
    expect(refreshedBody.capabilities.authorizationVersion).toBe(currentVersion);
    expect(refreshedBody.capabilities.permissions).not.toContain('inventory.read');

    const directUrl = await fetch(`${baseUrl}/api/inventory/products`, {
      headers: { cookie: cookies.header, 'x-erp-authorization-version': String(currentVersion) },
    });
    expect(directUrl.status).toBe(403);
    expect(await directUrl.json()).toMatchObject({ error: { code: 'permission_denied' } });

    await setRolePermission(db, {
      userId: admin.userId, masterFn: 'M1', activeCompanyFn: 'C-SG', username: admin.username,
      email: admin.email, fullName: admin.fullName,
    }, createdRole.roleId, 'inventory.read', true, 'freshness-restore');
    await setRoleResourceScope(db, {
      userId: admin.userId, masterFn: 'M1', activeCompanyFn: 'C-SG', username: admin.username,
      email: admin.email, fullName: admin.fullName,
    }, createdRole.roleId, 'inventory/*', 'self', 'freshness-restrict-scope');
    const restrictedSession = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: cookies.header },
    });
    const restrictedBody = await restrictedSession.json() as {
      capabilities: { authorizationVersion: number };
    };
    const restricted = await fetch(`${baseUrl}/api/inventory/products`, {
      headers: {
        cookie: cookies.header,
        'x-erp-authorization-version': String(restrictedBody.capabilities.authorizationVersion),
      },
    });
    expect(restricted.status).toBe(403);
    expect(await restricted.json()).toMatchObject({ error: { code: 'data_scope_unavailable' } });
  });
});
