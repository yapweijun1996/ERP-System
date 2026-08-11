import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { auditLog } from '../data/schema';
import { freshDb } from '../test/helpers';
import {
  createPlatformSession,
  PLATFORM_ROLE_TEMPLATES,
  provisionPlatformPrincipal,
} from '../auth/platformSupport';
import { createApp } from './app';

describe('platform entitlement API', () => {
  let db: DB;
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const activeServer = createApp(db).listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve) => activeServer.once('listening', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    const activeServer = server;
    await new Promise<void>((resolve, reject) => activeServer.close((error) => error ? reject(error) : resolve()));
  });

  async function platformAuth(roleCode: string, principalKey: string) {
    const principal = await provisionPlatformPrincipal(db, {
      principalKey, displayName: principalKey, roleCodes: [roleCode],
    });
    return createPlatformSession(db, principal.principalId);
  }

  function headers(auth: { token: string; csrfToken: string }, csrf = false) {
    return {
      authorization: `Bearer ${auth.token}`,
      'content-type': 'application/json',
      ...(csrf ? { 'x-platform-csrf-token': auth.csrfToken } : {}),
    };
  }

  it('requires the independent Superadmin realm, CSRF and expected versions', async () => {
    expect((await fetch(`${baseUrl}/api/platform/entitlements`)).status).toBe(401);

    const support = await platformAuth(PLATFORM_ROLE_TEMPLATES.supportAdmin.code, 'support-api');
    expect((await fetch(`${baseUrl}/api/platform/entitlements`, { headers: headers(support) })).status).toBe(403);

    const admin = await platformAuth(PLATFORM_ROLE_TEMPLATES.superadmin.code, 'module-admin-api');
    const overview = await fetch(`${baseUrl}/api/platform/entitlements`, { headers: headers(admin) });
    expect(overview.status).toBe(200);
    expect((await overview.json() as { data: Array<{ masterFn: string }> }).data)
      .toEqual(expect.arrayContaining([expect.objectContaining({ masterFn: 'M1' })]));

    const noCsrf = await fetch(`${baseUrl}/api/platform/masters/M1/modules/expenses_tax`, {
      method: 'PATCH', headers: headers(admin),
      body: JSON.stringify({ enabled: true, defaultCompanyAllocated: true, expectedVersion: 1 }),
    });
    expect(noCsrf.status).toBe(403);

    const invalidBoolean = await fetch(`${baseUrl}/api/platform/masters/M1/modules/expenses_tax`, {
      method: 'PATCH', headers: headers(admin, true),
      body: JSON.stringify({ enabled: 'true', defaultCompanyAllocated: true, expectedVersion: 1 }),
    });
    expect(invalidBoolean.status).toBe(400);

    const enabled = await fetch(`${baseUrl}/api/platform/masters/M1/modules/expenses_tax`, {
      method: 'PATCH', headers: headers(admin, true),
      body: JSON.stringify({ enabled: true, defaultCompanyAllocated: true, expectedVersion: 1 }),
    });
    expect(enabled.status).toBe(200);
    expect((await enabled.json() as { data: { masterEnabled: boolean; version: number } }).data)
      .toMatchObject({ masterEnabled: true, version: 2 });

    const stale = await fetch(`${baseUrl}/api/platform/masters/M1/modules/expenses_tax`, {
      method: 'PATCH', headers: headers(admin, true),
      body: JSON.stringify({ enabled: false, defaultCompanyAllocated: false, expectedVersion: 1 }),
    });
    expect(stale.status).toBe(409);

    const allocation = await fetch(`${baseUrl}/api/platform/masters/M1/companies/C-SG/modules/expenses_tax`, {
      method: 'PATCH', headers: headers(admin, true),
      body: JSON.stringify({ allocated: true, expectedVersion: 1 }),
    });
    expect(allocation.status).toBe(200);
    expect((await allocation.json() as { data: { effectiveEnabled: boolean; version: number } }).data)
      .toMatchObject({ effectiveEnabled: true, version: 2 });

    const audits = await db.select().from(auditLog).where(eq(auditLog.action, 'platform_set_entitlement'));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ masterFn: 'M1', companyFn: null });
    expect(audits[0].platformPrincipalId).not.toBeNull();
    expect(audits[0].requestId).toBeTruthy();
  });
});
