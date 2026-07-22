import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
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

describe('sales analytics API', () => {
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
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  });

  async function login(email = 'admin@acme.co', password = 'demo1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(200);
    return cookieHeader(response);
  }

  it('serves a bounded, tenant-scoped analytics resource to sales readers', async () => {
    const cookie = await login();
    const response = await fetch(`${baseUrl}/api/sales/analytics?limit=100`, {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [expect.objectContaining({
        kind: 'summary', recognizedRevenue: '0.00', invoiceCount: 0,
      })],
      meta: { nextCursor: null },
    });

    const viewerCookie = await login('viewer@acme.co', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/sales/analytics`, {
      headers: { cookie: viewerCookie },
    })).status).toBe(200);
  });

  it('requires authentication and rejects offset or unregistered filters', async () => {
    expect((await fetch(`${baseUrl}/api/sales/analytics`)).status).toBe(401);
    const cookie = await login();
    const unsupported = await fetch(`${baseUrl}/api/sales/analytics?offset=1`, {
      headers: { cookie },
    });
    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toMatchObject({
      error: { code: 'invalid_query', message: expect.stringContaining('unsupported filter') },
    });
  });
});
