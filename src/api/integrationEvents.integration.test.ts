import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { outboxEvent } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookieHeader(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return (headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''])
    .flatMap((value) => Array.from(
      value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
      (match) => `${match[1]}=${match[2]}`,
    )).join('; ');
}

describe('integration event log API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    await db.insert(outboxEvent).values([
      {
        masterFn: 'M1', companyFn: 'C-SG', topic: 'auth.invitation.created',
        aggregateType: 'user_invitation', aggregateId: '11', attempts: 1,
        payload: { token: { ciphertext: 'API-SECRET' }, to: 'hidden@example.test' },
        deliveredAt: new Date('2026-07-23T02:00:00.000Z'),
      },
      {
        masterFn: 'M1', companyFn: 'C-MY', topic: 'auth.password-reset.requested',
        aggregateType: 'password_reset_token', aggregateId: '22',
        payload: { token: { ciphertext: 'OTHER-TENANT' } },
      },
    ]);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  });

  async function login(email = 'admin@acme.co', password = 'demo1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(200);
    return cookieHeader(response);
  }

  it('serves a bounded sanitized company log to integration readers', async () => {
    for (const credentials of [
      ['admin@acme.co', 'demo1234'],
      ['viewer@acme.co', 'viewer1234'],
    ] as const) {
      const cookie = await login(...credentials);
      const response = await fetch(`${baseUrl}/api/integration/events?limit=1`, {
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toContain('API-SECRET');
      expect(text).not.toContain('OTHER-TENANT');
      expect(text).not.toContain('hidden@example.test');
      expect(JSON.parse(text)).toMatchObject({
        data: [expect.objectContaining({
          aggregateId: '11', status: 'delivered', channel: 'email', direction: 'outbound',
        })],
        meta: { nextCursor: null },
      });
    }
  });

  it('requires authentication and rejects offset or arbitrary filters', async () => {
    expect((await fetch(`${baseUrl}/api/integration/events`)).status).toBe(401);
    const cookie = await login();
    const response = await fetch(`${baseUrl}/api/integration/events?offset=1`, {
      headers: { cookie },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'invalid_query', message: expect.stringContaining('unsupported filter') },
    });
  });
});
