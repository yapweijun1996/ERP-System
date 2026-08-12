import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  appUser,
  masterAdminAccount,
  role,
  rolePermission,
  userCompany,
  userCompanyRole,
} from '../data/schema';
import { MASTER_ADMIN_PERMISSION_KEYS } from '../auth/accessCatalog';
import { provisionPlatformPrincipal } from '../auth/platformSupport';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response, prefix: string) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(new RegExp(`(?:^|,\\s*)(${prefix}_(?:session|csrf))=([^;,\\s]+)`, 'g')),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrfPair = pairs.find((pair) => pair.startsWith(`${prefix}_csrf=`));
  if (!csrfPair) throw new Error(`Missing ${prefix} cookies`);
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrfPair.slice(`${prefix}_csrf=`.length)) };
}

async function startApi(db: DB) {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No API address');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopApi(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe('Platform Superadmin tenant provisioning', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) await stopApi(server);
    server = undefined;
  });

  it('creates Master, first Master Admin/Company Owner, and later Companies with idempotent platform mutations', async () => {
    const db = await freshDb();
    const running = await startApi(db);
    server = running.server;

    const bootstrap = await fetch(`${running.baseUrl}/api/setup/platform-superadmin/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        principalKey: 'platform-admin',
        displayName: 'Platform Admin',
        email: 'platform@example.test',
        password: 'platform-password-123',
      }),
    });
    expect(bootstrap.status).toBe(201);
    const platform = cookies(bootstrap, 'erp_platform');
    const platformHeaders = (mutate = false, idempotencyKey?: string) => ({
      cookie: platform.header,
      ...(mutate ? { 'x-platform-csrf-token': platform.csrf, 'content-type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    });

    await provisionPlatformPrincipal(db, {
      principalKey: 'platform-support',
      displayName: 'Platform Support',
      password: 'platform-support-password',
      roleCodes: ['platform_support_engineer'],
    });
    const supportLogin = await fetch(`${running.baseUrl}/api/platform/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ principalKey: 'platform-support', password: 'platform-support-password' }),
    });
    expect(supportLogin.status).toBe(200);
    const support = cookies(supportLogin, 'erp_platform');
    const supportMutation = await fetch(`${running.baseUrl}/api/platform/masters`, {
      method: 'POST',
      headers: { cookie: support.header, 'x-platform-csrf-token': support.csrf, 'content-type': 'application/json', 'idempotency-key': 'support-master-1' },
      body: JSON.stringify({ name: 'Should Not Exist', loginCode: 'NOPE' }),
    });
    expect(supportMutation.status).toBe(403);

    const masterBody = {
      name: 'Acme Group',
      loginCode: 'ACME',
      modules: [{ moduleKey: 'expenses_tax', enabled: true, defaultCompanyAllocated: true }],
    };
    const masterResponse = await fetch(`${running.baseUrl}/api/platform/masters`, {
      method: 'POST', headers: platformHeaders(true, 'master-1'), body: JSON.stringify(masterBody),
    });
    expect(masterResponse.status).toBe(201);
    const master = (await masterResponse.json()).data as { masterFn: string; companyCount: number };
    expect(master.companyCount).toBe(0);

    const replay = await fetch(`${running.baseUrl}/api/platform/masters`, {
      method: 'POST', headers: platformHeaders(true, 'master-1'), body: JSON.stringify(masterBody),
    });
    expect(replay.status).toBe(200);
    expect((await replay.json()).data.masterFn).toBe(master.masterFn);
    const mismatch = await fetch(`${running.baseUrl}/api/platform/masters`, {
      method: 'POST', headers: platformHeaders(true, 'master-1'),
      body: JSON.stringify({ ...masterBody, name: 'Other Group' }),
    });
    expect(mismatch.status).toBe(409);
    expect((await mismatch.json()).error.code).toBe('idempotency_key_reused');

    const firstCompany = await fetch(`${running.baseUrl}/api/platform/masters/${master.masterFn}/companies`, {
      method: 'POST',
      headers: platformHeaders(true, 'company-1'),
      body: JSON.stringify({
        name: 'Acme Singapore', country: 'SG',
        masterAdmin: {
          name: 'Master Admin', username: 'masteradmin', email: 'masteradmin@acme.test',
          password: 'master-admin-password',
        },
        companyOwner: {
          name: 'Company Owner', username: 'owner', email: 'owner@acme.test',
          password: 'company-owner-password',
        },
      }),
    });
    expect(firstCompany.status).toBe(201);
    const company = (await firstCompany.json()).data as { companyFn: string; masterAdmin: { userId: number } };
    expect(company.masterAdmin.userId).toBeGreaterThan(0);

    const secondCompany = await fetch(`${running.baseUrl}/api/platform/masters/${master.masterFn}/companies`, {
      method: 'POST',
      headers: platformHeaders(true, 'company-2'),
      body: JSON.stringify({
        name: 'Acme Malaysia', country: 'MY',
        companyOwner: {
          name: 'Malaysia Owner', username: 'myowner', email: 'myowner@acme.test',
          password: 'company-owner-password',
        },
      }),
    });
    expect(secondCompany.status).toBe(201);

    const [masterAdmin] = await db.select().from(masterAdminAccount).where(eq(masterAdminAccount.masterFn, master.masterFn));
    expect(masterAdmin).toBeTruthy();
    const memberships = await db.select().from(userCompany).where(eq(userCompany.userId, masterAdmin.userId));
    expect(memberships).toHaveLength(2);
    const roleAssignments = await db.select({ roleName: role.name }).from(userCompanyRole)
      .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
      .where(and(eq(userCompanyRole.userId, masterAdmin.userId), eq(role.sourceTemplateKey, 'master_admin')));
    expect(roleAssignments).toHaveLength(2);
    const [masterAdminRole] = await db.select({ roleId: role.roleId }).from(role)
      .where(and(eq(role.masterFn, master.masterFn), eq(role.sourceTemplateKey, 'master_admin')));
    const masterAdminPermissions = await db.select({ permissionKey: rolePermission.permissionKey })
      .from(rolePermission).where(eq(rolePermission.roleId, masterAdminRole.roleId));
    expect(masterAdminPermissions.map((row) => row.permissionKey).sort())
      .toEqual([...MASTER_ADMIN_PERMISSION_KEYS].sort());

    const tenants = await fetch(`${running.baseUrl}/api/platform/entitlements`, { headers: platformHeaders() });
    expect(tenants.status).toBe(200);
    expect((await tenants.json()).data[0]).toMatchObject({ companyCount: 2, hasMasterAdmin: true });

    const login = async (username: string, password: string) => {
      const response = await fetch(`${running.baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationCode: 'ACME', username, password }),
      });
      expect(response.status).toBe(200);
      return cookies(response, 'erp');
    };
    const masterAdminCookies = await login('masteradmin', 'master-admin-password');
    expect((await fetch(`${running.baseUrl}/api/admin/users`, { headers: { cookie: masterAdminCookies.header } })).status).toBe(200);
    expect((await fetch(`${running.baseUrl}/api/sales/orders`, { headers: { cookie: masterAdminCookies.header } })).status).toBe(403);
    const moduleMutation = await fetch(`${running.baseUrl}/api/admin/modules/finance/actions/set-enabled`, {
      method: 'POST', headers: { cookie: masterAdminCookies.header, 'x-csrf-token': masterAdminCookies.csrf, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(moduleMutation.status).toBe(403);

    const ownerCookies = await login('owner', 'company-owner-password');
    const ownerModuleMutation = await fetch(`${running.baseUrl}/api/admin/modules/finance/actions/set-enabled`, {
      method: 'POST', headers: { cookie: ownerCookies.header, 'x-csrf-token': ownerCookies.csrf, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(ownerModuleMutation.status).toBe(403);

    const users = await db.select({ username: appUser.username }).from(appUser).where(eq(appUser.masterFn, master.masterFn));
    expect(users.map((row) => row.username).sort()).toEqual(['masteradmin', 'myowner', 'owner']);
  });
});
