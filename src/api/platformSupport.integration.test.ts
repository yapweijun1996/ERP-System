import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import {
  createPlatformSession,
  getPlatformSession,
  provisionPlatformPrincipal,
} from '../auth/platformSupport';
import { createApp } from './app';

describe('platform support API boundary', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('API server did not bind a TCP address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('requires the separate platform bearer/CSRF contract and supports grant lifecycle', async () => {
    const provisioned = await provisionPlatformPrincipal(db, {
      principalKey: 'api-support-admin',
      displayName: 'API Support Admin',
      roleCodes: ['platform_support_admin'],
    });
    const credentials = await createPlatformSession(db, provisioned.principalId);
    const session = await getPlatformSession(db, credentials.token);
    if (!session) throw new Error('platform API session was not created');
    const bearer = { Authorization: `Bearer ${credentials.token}` };

    const tenantCookieOnly = await fetch(`${baseUrl}/api/platform/support-grants`, {
      headers: { cookie: 'erp_session=tenant-cookie-only' },
    });
    expect(tenantCookieOnly.status).toBe(401);

    const unauthenticated = await fetch(`${baseUrl}/api/platform/support-grants`);
    expect(unauthenticated.status).toBe(401);

    const withoutCsrf = await fetch(`${baseUrl}/api/platform/support-grants`, {
      method: 'POST',
      headers: { ...bearer, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(withoutCsrf.status).toBe(403);
    await expect(withoutCsrf.json()).resolves.toMatchObject({ error: { code: 'platform_csrf_invalid' } });

    const validFrom = new Date(Date.now() - 60_000).toISOString();
    const validUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const created = await fetch(`${baseUrl}/api/platform/support-grants`, {
      method: 'POST',
      headers: {
        ...bearer,
        'x-platform-csrf-token': credentials.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        masterFn: 'M1', companyFn: 'C-SG', reason: 'API support verification',
        ticketReference: 'SUP-API-1', mode: 'read_only', validFrom, validUntil,
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { data: { id: number } };

    const checked = await fetch(`${baseUrl}/api/platform/support-grants/${createdBody.data.id}/actions/check`, {
      method: 'POST',
      headers: {
        ...bearer,
        'x-platform-csrf-token': credentials.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ masterFn: 'M1', companyFn: 'C-SG', operation: 'read' }),
    });
    expect(checked.status).toBe(200);
    await expect(checked.json()).resolves.toMatchObject({ data: { allowed: true, reasonCode: 'ALLOWED' } });

    const revoked = await fetch(`${baseUrl}/api/platform/support-grants/${createdBody.data.id}/actions/revoke`, {
      method: 'POST',
      headers: {
        ...bearer,
        'x-platform-csrf-token': credentials.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'API verification complete' }),
    });
    expect(revoked.status).toBe(200);

    const afterRevoke = await fetch(`${baseUrl}/api/platform/support-grants/${createdBody.data.id}/actions/check`, {
      method: 'POST',
      headers: {
        ...bearer,
        'x-platform-csrf-token': credentials.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ masterFn: 'M1', companyFn: 'C-SG', operation: 'read' }),
    });
    expect(afterRevoke.status).toBe(403);
    await expect(afterRevoke.json()).resolves.toMatchObject({ error: { code: 'support_access_denied' } });

    const provisioningRoute = await fetch(`${baseUrl}/api/platform/session`, {
      method: 'POST',
      headers: { ...bearer, 'x-platform-csrf-token': credentials.csrfToken },
    });
    expect(provisioningRoute.status).toBe(405);
  });
});
