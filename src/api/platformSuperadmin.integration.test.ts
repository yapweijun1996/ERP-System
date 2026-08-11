import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { auditLog, platformSimulationSession } from '../data/schema';
import { seedDemo } from '../data/seed';
import { provisionPlatformPrincipal } from '../auth/platformSupport';
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

describe('Platform Superadmin password realm and tenant simulation', () => {
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
});
