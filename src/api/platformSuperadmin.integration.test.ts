import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  appUser,
  auditLog,
  platformPrincipalTenantActor,
  platformSimulationSession,
  platformTenantAccessSession,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { provisionPlatformPrincipal } from '../auth/platformSupport';
import { isSensitivePlatformMutation } from '../auth/platformTenantAccess';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function platformCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_platform_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_platform_csrf='));
  if (!csrfPair || !pairs.some((pair) => pair.startsWith('erp_platform_session='))) {
    throw new Error('Missing platform authentication cookies');
  }
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_platform_csrf='.length)),
  };
}

describe('Platform Superadmin password realm, tenant administration and Employee simulation', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let principalId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const principal = await provisionPlatformPrincipal(db, {
      principalKey: 'platform-test-admin',
      displayName: 'Platform Test Admin',
      password: 'platform-test-password',
      roleCodes: ['platform_superadmin'],
    });
    principalId = principal.principalId;
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function login() {
    const response = await fetch(`${baseUrl}/api/platform/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ principalKey: 'platform-test-admin', password: 'platform-test-password' }),
    });
    expect(response.status).toBe(200);
    const setCookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    expect(setCookies.join('\n')).toContain('Max-Age=3600');
    expect(setCookies.join('\n')).not.toContain('erp_session=');
    return platformCookies(response);
  }

  function headers(auth: { header: string; csrf: string }, mutate = false): Record<string, string> {
    return {
      cookie: auth.header,
      ...(mutate ? { 'x-platform-csrf-token': auth.csrf, 'content-type': 'application/json' } : {}),
    };
  }

  async function targets(auth: { header: string; csrf: string }) {
    const response = await fetch(`${baseUrl}/api/platform/simulation-targets?masterFn=M1&companyFn=C-SG`, {
      headers: headers(auth),
    });
    expect(response.status).toBe(200);
    return (await response.json() as {
      data: Array<{ userId: number; username: string }>;
    }).data;
  }

  async function start(
    auth: { header: string; csrf: string },
    targetUserId: number,
  ) {
    const response = await fetch(`${baseUrl}/api/platform/simulations`, {
      method: 'POST', headers: headers(auth, true),
      body: JSON.stringify({ masterFn: 'M1', companyFn: 'C-SG', targetUserId }),
    });
    expect(response.status).toBe(201);
    return response;
  }

  async function startTenantAccess(auth: { header: string; csrf: string }, companyFn = 'C-SG') {
    const response = await fetch(`${baseUrl}/api/platform/tenant-access`, {
      method: 'POST', headers: headers(auth, true),
      body: JSON.stringify({
        masterFn: 'M1', companyFn, reason: 'Investigate tenant issue', ticketReference: 'OPS-1001',
      }),
    });
    expect(response.status).toBe(201);
    return (await response.json()).data as { accessId: number; actorUserId: number };
  }

  it('uses separate password/cookie credentials with no Remember Me', async () => {
    const invalidRemember = await fetch(`${baseUrl}/api/platform/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        principalKey: 'platform-test-admin', password: 'platform-test-password', rememberDevice: true,
      }),
    });
    expect(invalidRemember.status).toBe(400);

    const auth = await login();
    const session = await fetch(`${baseUrl}/api/platform/session`, { headers: headers(auth) });
    expect(session.status).toBe(200);
    expect((await session.json() as { data: { principalId: number; realm: string; simulation: unknown } }).data)
      .toMatchObject({ principalId, realm: 'platform', simulation: null });

    // A platform session alone never becomes a tenant session.
    expect((await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) })).status).toBe(401);
  });

  it('classifies the approved sensitive mutation families without locking reads', () => {
    for (const path of [
      '/api/sales/orders/1/actions/approve',
      '/api/finance/gl-entries',
      '/api/payment-vouchers/1/actions/post',
      '/api/payment-batches/1/actions/release',
      '/api/payroll/runs',
      '/api/employee-payout-profiles/1/actions/reveal',
      '/api/receipt-tax-evidence/packages/1/actions/generate',
      '/api/settings/bank-credentials',
    ]) expect(isSensitivePlatformMutation('POST', path)).toBe(true);
    expect(isSensitivePlatformMutation('GET', '/api/finance/gl-entries')).toBe(false);
    expect(isSensitivePlatformMutation('POST', '/api/admin/users/1/actions/toggle-active')).toBe(false);
  });

  it('uses the exact target authority, requires a return, and blocks platform mutations while simulated', async () => {
    const auth = await login();
    const viewer = (await targets(auth)).find((target) => target.username === 'viewer');
    if (!viewer) throw new Error('Missing viewer target');
    await start(auth, viewer.userId);

    const tenantSession = await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) });
    expect(tenantSession.status).toBe(200);
    expect((await tenantSession.json() as { userId: number; username: string }).username).toBe('viewer');
    expect((await fetch(`${baseUrl}/api/dashboard`, { headers: headers(auth) })).status).toBe(200);

    // Viewer read authority is not elevated by the platform principal.
    const deniedWrite = await fetch(`${baseUrl}/api/admin/users/${viewer.userId}/actions/toggle-active`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({ isActive: false }),
    });
    expect(deniedWrite.status).toBe(403);

    // Simulation is fixed to the selected target Company and must end through
    // the platform return path, rather than reusing tenant session controls.
    const switchCompany = await fetch(`${baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(switchCompany.status).toBe(409);
    expect((await switchCompany.json()).error.code).toBe('platform_simulation_company_locked');
    const tenantLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({}),
    });
    expect(tenantLogout.status).toBe(409);
    expect((await tenantLogout.json()).error.code).toBe('platform_simulation_return_required');

    const blockedPlatformMutation = await fetch(`${baseUrl}/api/platform/masters/M1/modules/expenses_tax`, {
      method: 'PATCH', headers: headers(auth, true),
      body: JSON.stringify({ enabled: true, defaultCompanyAllocated: true, expectedVersion: 1 }),
    });
    expect(blockedPlatformMutation.status).toBe(409);
    expect((await blockedPlatformMutation.json()).error.code).toBe('platform_simulation_active');

    const returned = await fetch(`${baseUrl}/api/platform/simulations/actions/return`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({}),
    });
    expect(returned.status).toBe(200);
    expect((await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) })).status).toBe(401);
  });

  it('rejects cross-company targets and expires simulated tenant access', async () => {
    const auth = await login();
    const viewer = (await targets(auth)).find((target) => target.username === 'viewer');
    if (!viewer) throw new Error('Missing viewer target');
    const crossCompany = await fetch(`${baseUrl}/api/platform/simulations`, {
      method: 'POST', headers: headers(auth, true),
      body: JSON.stringify({ masterFn: 'M1', companyFn: 'C-MY', targetUserId: viewer.userId }),
    });
    expect(crossCompany.status).toBe(404);
    expect((await crossCompany.json()).error.code).toBe('simulation_target_not_found');

    await start(auth, viewer.userId);
    await db.update(platformSimulationSession).set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(platformSimulationSession.platformPrincipalId, principalId));
    expect((await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) })).status).toBe(401);
    expect((await (await fetch(`${baseUrl}/api/platform/session`, { headers: headers(auth) })).json()).data.simulation)
      .toBeNull();
  });

  it('dual-attributes simulated tenant writes to the target user and true platform principal', async () => {
    const auth = await login();
    const admin = (await targets(auth)).find((target) => target.username === 'admin');
    const viewer = (await targets(auth)).find((target) => target.username === 'viewer');
    if (!admin) throw new Error('Missing admin target');
    if (!viewer) throw new Error('Missing viewer target');
    await start(auth, admin.userId);
    const update = await fetch(`${baseUrl}/api/admin/users/${viewer.userId}/actions/toggle-active`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({ isActive: false }),
    });
    expect(update.status).toBe(200);
    const audits = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'app_user'),
      eq(auditLog.entityId, String(viewer.userId)),
      eq(auditLog.action, 'set_active'),
    ));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorUserId: admin.userId,
      platformPrincipalId: principalId,
    });
  });

  it('opens an isolated Platform Admin tenant session with a hidden unloginable bridge actor', async () => {
    const auth = await login();
    const access = await startTenantAccess(auth);

    const tenantSession = await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) });
    expect(tenantSession.status).toBe(200);
    const body = await tenantSession.json() as {
      userId: number;
      activeCompanyFn: string;
      actingPrincipal: { actorType: string; platformPrincipalId: number; displayName: string };
      modules: Array<{ moduleKey: string; enabled: boolean }>;
    };
    expect(body).toMatchObject({
      userId: access.actorUserId,
      activeCompanyFn: 'C-SG',
      actingPrincipal: {
        actorType: 'platform_superadmin',
        platformPrincipalId: principalId,
        displayName: 'Platform Test Admin',
      },
    });
    expect(body.modules.every((module) => typeof module.enabled === 'boolean')).toBe(true);

    const [bridge] = await db.select().from(appUser).where(eq(appUser.userId, access.actorUserId));
    expect(bridge).toMatchObject({ identityKind: 'platform_actor', loginEnabled: false, email: null });
    const [mapping] = await db.select().from(platformPrincipalTenantActor)
      .where(eq(platformPrincipalTenantActor.actorUserId, access.actorUserId));
    expect(mapping).toMatchObject({ platformPrincipalId: principalId, masterFn: 'M1' });

    const guessedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: bridge.username, password: 'anything' }),
    });
    expect(guessedLogin.status).not.toBe(200);
    const users = await fetch(`${baseUrl}/api/admin/users`, { headers: headers(auth) });
    expect(users.status).toBe(200);
    expect((await users.json()).data.users.some((user: { id: number }) => user.id === access.actorUserId)).toBe(false);
    expect((await targets(auth)).some((target) => target.userId === access.actorUserId)).toBe(false);
    const roles = await fetch(`${baseUrl}/api/admin/roles`, { headers: headers(auth) });
    expect(roles.status).toBe(200);
    expect((await roles.json()).data.some((item: { sourceTemplateKey: string }) => item.sourceTemplateKey === 'platform_tenant_admin')).toBe(false);
  });

  it('allows ordinary tenant writes, requires Company break-glass for sensitive mutations, and dual-attributes audit', async () => {
    const auth = await login();
    const access = await startTenantAccess(auth);
    const viewer = (await targets(auth)).find((target) => target.username === 'viewer');
    if (!viewer) throw new Error('Missing viewer target');

    const ordinary = await fetch(`${baseUrl}/api/admin/users/${viewer.userId}/actions/toggle-active`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({ isActive: false }),
    });
    expect(ordinary.status).toBe(200);
    const [ordinaryAudit] = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'app_user'),
      eq(auditLog.entityId, String(viewer.userId)),
      eq(auditLog.action, 'set_active'),
    ));
    expect(ordinaryAudit).toMatchObject({ actorUserId: access.actorUserId, platformPrincipalId: principalId });

    const deniedSensitive = await fetch(`${baseUrl}/api/finance/anything`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({}),
    });
    expect(deniedSensitive.status).toBe(403);
    expect((await deniedSensitive.json()).error.code).toBe('platform_break_glass_required');

    const unlock = await fetch(`${baseUrl}/api/platform/tenant-access/actions/break-glass`, {
      method: 'POST', headers: headers(auth, true),
      body: JSON.stringify({ reason: 'Validate finance issue', ticketReference: 'SEC-1002' }),
    });
    expect(unlock.status).toBe(201);
    const afterUnlock = await fetch(`${baseUrl}/api/finance/anything`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({}),
    });
    expect(afterUnlock.status).not.toBe(403);
  });

  it('switches audited scope, revokes break-glass, and keeps Employee mode mutually exclusive', async () => {
    const auth = await login();
    await startTenantAccess(auth);
    await fetch(`${baseUrl}/api/platform/tenant-access/actions/break-glass`, {
      method: 'POST', headers: headers(auth, true),
      body: JSON.stringify({ reason: 'Sensitive check', ticketReference: 'SEC-2001' }),
    });
    const viewer = (await targets(auth)).find((target) => target.username === 'viewer');
    if (!viewer) throw new Error('Missing viewer target');
    const blockedSimulation = await fetch(`${baseUrl}/api/platform/simulations`, {
      method: 'POST', headers: headers(auth, true),
      body: JSON.stringify({ masterFn: 'M1', companyFn: 'C-SG', targetUserId: viewer.userId }),
    });
    expect(blockedSimulation.status).toBe(409);
    expect((await blockedSimulation.json()).error.code).toBe('platform_tenant_access_active');

    const switched = await fetch(`${baseUrl}/api/platform/tenant-access/actions/switch-scope`, {
      method: 'POST', headers: headers(auth, true),
      body: JSON.stringify({ masterFn: 'M1', companyFn: 'C-MY' }),
    });
    expect(switched.status).toBe(200);
    expect((await switched.json()).data).toMatchObject({ masterFn: 'M1', companyFn: 'C-MY', breakGlass: null });
    expect((await (await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) })).json()).activeCompanyFn)
      .toBe('C-MY');

    const deniedAfterSwitch = await fetch(`${baseUrl}/api/finance/anything`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({}),
    });
    expect(deniedAfterSwitch.status).toBe(403);
    expect((await deniedAfterSwitch.json()).error.code).toBe('platform_break_glass_required');

    const returned = await fetch(`${baseUrl}/api/platform/tenant-access/actions/return`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({}),
    });
    expect(returned.status).toBe(200);
    const [accessRow] = await db.select().from(platformTenantAccessSession)
      .where(eq(platformTenantAccessSession.platformPrincipalId, principalId));
    expect(accessRow.revokedAt).toBeInstanceOf(Date);
  });

  it('revokes the active tenant window when the parent Platform session is revoked', async () => {
    const auth = await login();
    await startTenantAccess(auth);
    const revoked = await fetch(`${baseUrl}/api/platform/session/actions/revoke`, {
      method: 'POST', headers: headers(auth, true), body: JSON.stringify({}),
    });
    expect(revoked.status).toBe(200);
    const [accessRow] = await db.select().from(platformTenantAccessSession)
      .where(eq(platformTenantAccessSession.platformPrincipalId, principalId));
    expect(accessRow.revokedAt).toBeInstanceOf(Date);
    expect((await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) })).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/platform/session`, { headers: headers(auth) })).status).toBe(401);
  });

  it('keeps MAC fail-closed in Platform Admin mode and denies support principals', async () => {
    const auth = await login();
    const moduleRows = await fetch(`${baseUrl}/api/platform/masters/M1/modules`, { headers: headers(auth) });
    const expensesTax = ((await moduleRows.json()).data as Array<{
      moduleKey: string; enabled: boolean; defaultCompanyAllocated: boolean; version: number;
    }>).find((row) => row.moduleKey === 'expenses_tax');
    if (!expensesTax) throw new Error('Missing expenses_tax entitlement');
    const disable = await fetch(`${baseUrl}/api/platform/masters/M1/modules/expenses_tax`, {
      method: 'PATCH', headers: headers(auth, true),
      body: JSON.stringify({
        enabled: false,
        defaultCompanyAllocated: expensesTax.defaultCompanyAllocated,
        expectedVersion: expensesTax.version,
      }),
    });
    expect(disable.status).toBe(200);
    await startTenantAccess(auth);
    const tenantSession = await fetch(`${baseUrl}/api/auth/session`, { headers: headers(auth) });
    const tenantBody = await tenantSession.json() as { modules: Array<{ moduleKey: string; enabled: boolean }> };
    expect(tenantBody.modules.find((row) => row.moduleKey === 'expenses_tax')?.enabled).toBe(false);
    const direct = await fetch(`${baseUrl}/api/company-receipts`, { headers: headers(auth) });
    expect(direct.status).toBe(403);
    expect((await direct.json()).error.code).toBe('module_not_enabled');

    const supportPrincipal = await provisionPlatformPrincipal(db, {
      principalKey: 'support-test',
      displayName: 'Support Test',
      password: 'support-test-password',
      roleCodes: ['platform_support_engineer'],
    });
    expect(supportPrincipal.principalId).toBeGreaterThan(0);
    const supportLogin = await fetch(`${baseUrl}/api/platform/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ principalKey: 'support-test', password: 'support-test-password' }),
    });
    const supportAuth = platformCookies(supportLogin);
    const denied = await fetch(`${baseUrl}/api/platform/tenant-access`, {
      method: 'POST', headers: headers(supportAuth, true),
      body: JSON.stringify({
        masterFn: 'M1', companyFn: 'C-SG', reason: 'Support attempt', ticketReference: 'SUP-1',
      }),
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('platform_permission_denied');
  });
});
