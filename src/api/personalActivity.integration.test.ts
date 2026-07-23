import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { appendAudit } from './audit';
import { createApp } from './app';

function cookieHeader(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return (headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''])
    .flatMap((value) => Array.from(value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g), (match) => `${match[1]}=${match[2]}`)).join('; ');
}

describe('personal activity API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function login(email = 'admin@acme.co', password = 'demo1234'): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    expect(response.status).toBe(200);
    return cookieHeader(response);
  }

  it('serves a sanitized actor-owned page without requiring auditor permission', async () => {
    await appendAudit(db, { masterFn: 'M1', companyFn: 'C-SG', actorUserId: 2, requestId: 'viewer-own', entity: 'crm/opportunities', entityId: 7, action: 'update', after: { secret: 'hidden' } });
    await appendAudit(db, { masterFn: 'M1', companyFn: 'C-SG', actorUserId: 1, requestId: 'admin-other', entity: 'app_user', entityId: 1, action: 'password_reset' });
    const cookie = await login('viewer@acme.co', 'viewer1234');
    const response = await fetch(`${baseUrl}/api/account/activity?limit=1`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ data: [{ category: 'crm', entityKey: 'opportunities', entityId: '7', actionKind: 'update' }], meta: { nextCursor: null } });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('viewer-own');
    expect(serialized).not.toContain('actorUserId');
    expect(serialized).not.toContain('password_reset');
  });

  it('requires authentication and rejects offsets, oversized limits and malformed cursors', async () => {
    expect((await fetch(`${baseUrl}/api/account/activity`)).status).toBe(401);
    const cookie = await login();
    for (const query of ['offset=1', 'limit=101', 'cursor=not-a-cursor']) {
      const response = await fetch(`${baseUrl}/api/account/activity?${query}`, { headers: { cookie } });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: 'invalid_query' } });
    }
  });
});
