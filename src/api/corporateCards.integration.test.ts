import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { appUser, auditLog } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  return values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  )).join('; ');
}

const statement = new TextEncoder().encode([
  'external_transaction_id,holder_employee_no,card_last4,transaction_date,posted_date,merchant,currency,amount',
  'API-CARD-0001,EMP-1042,4242,2026-07-20,2026-07-21,API Hotel,SGD,125.00',
].join('\n'));

describe('corporate-card API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function login(username: 'admin' | 'viewer', password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  it('enforces Finance permission and imports, lists and waives persistent follow-up', async () => {
    const viewerCookie = await login('viewer', 'viewer1234');
    const viewerCsrf = decodeURIComponent(
      viewerCookie.match(/(?:^|;\s*)erp_csrf=([^;]+)/)?.[1] ?? '',
    );
    const denied = await fetch(`${baseUrl}/api/corporate-cards/imports`, {
      method: 'POST',
      headers: {
        cookie: viewerCookie,
        'x-csrf-token': viewerCsrf,
        'x-erp-import-key': 'api-card-import-0001',
        'x-erp-card-issuer': 'Example Bank',
        'x-erp-statement-ref': 'API-JUL-2026',
        'x-erp-file-name': 'api-card.csv',
        'x-erp-file-format': 'csv',
        'content-type': 'text/csv',
      },
      body: statement,
    });
    expect(denied.status).toBe(403);

    const adminCookie = await login('admin', 'demo1234');
    const adminCsrf = decodeURIComponent(
      adminCookie.match(/(?:^|;\s*)erp_csrf=([^;]+)/)?.[1] ?? '',
    );
    const importHeaders = {
      cookie: adminCookie,
      'x-csrf-token': adminCsrf,
      'x-erp-import-key': 'api-card-import-0001',
      'x-erp-card-issuer': 'Example Bank',
      'x-erp-statement-ref': 'API-JUL-2026',
      'x-erp-file-name': 'api-card.csv',
      'x-erp-file-format': 'csv',
      'content-type': 'text/csv',
    };
    const imported = await fetch(`${baseUrl}/api/corporate-cards/imports`, {
      method: 'POST',
      headers: importHeaders,
      body: statement,
    });
    expect(imported.status).toBe(201);
    expect(await imported.json()).toMatchObject({
      data: {
        import: { rowCount: 1, fileFormat: 'csv' },
        transactions: [{
          externalTransactionId: 'API-CARD-0001',
          status: 'missing_receipt',
        }],
        matching: { suggestions: 0, followUps: 1 },
      },
    });
    const replay = await fetch(`${baseUrl}/api/corporate-cards/imports`, {
      method: 'POST',
      headers: importHeaders,
      body: statement,
    });
    expect(replay.status).toBe(200);
    expect((await replay.json()).data.replayed).toBe(true);

    const queue = await fetch(`${baseUrl}/api/corporate-cards/queue`, {
      headers: { cookie: adminCookie },
    });
    expect(queue.status).toBe(200);
    const queueBody = await queue.json() as {
      data: { followUps: Array<{ id: number; status: string }> };
    };
    expect(queueBody.data.followUps).toHaveLength(1);
    const waived = await fetch(
      `${baseUrl}/api/corporate-cards/follow-ups/${queueBody.data.followUps[0].id}/actions/waive`,
      {
        method: 'POST',
        headers: {
          cookie: adminCookie,
          'x-csrf-token': adminCsrf,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Finance approved a documented missing-receipt exception.',
        }),
      },
    );
    expect(waived.status).toBe(200);
    expect(await waived.json()).toMatchObject({ data: { status: 'waived' } });

    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const audits = await db.select().from(auditLog)
      .where(eq(auditLog.actorUserId, admin.userId));
    expect(audits.map((row) => `${row.entity}:${row.action}`)).toEqual(
      expect.arrayContaining([
        'corporate_card_import:import',
        'corporate_card_import:import_replay',
        'corporate_card_follow_up:waive',
      ]),
    );
  });
});
