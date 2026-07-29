import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { account, auditLog, glEntry, journalHeader } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) =>
    Array.from(value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
      (match) => `${match[1]}=${match[2]}`));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrfPair.slice(9)) };
}

describe('manual journal API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let arId: number;
  let revenueId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const rows = await db.select({ id: account.id, code: account.code }).from(account).where(and(
      eq(account.masterFn, 'M1'),
      eq(account.companyFn, 'C-SG'),
    ));
    arId = rows.find((row) => row.code === '1100')!.id;
    revenueId = rows.find((row) => row.code === '4000')!.id;
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
      body: JSON.stringify({ organizationCode: 'ACME', username: email.split('@')[0], password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  it('creates, posts and reverses one audited journal with idempotent actions', async () => {
    const auth = await login();
    const headers = {
      cookie: auth.header,
      'content-type': 'application/json',
      'x-csrf-token': auth.csrf,
    };
    const createResponse = await fetch(`${baseUrl}/api/finance/journals`, {
      method: 'POST', headers: { ...headers, 'x-request-id': 'manual-journal-create' },
      body: JSON.stringify({
        docNo: 'MJ-API-1', postingDate: '2026-06-22', journalType: 'standard',
        memo: 'Fictional API journal', reference: 'API-TEST',
        lines: [
          { accountId: arId, dimension: 'SG', debit: '75.25', credit: '0' },
          { accountId: revenueId, dimension: 'SG', debit: '0', credit: '75.25' },
        ],
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()).data;
    expect(created).toMatchObject({ status: 'draft', version: 1, total: '75.25' });
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'MJ-API-1'))).toHaveLength(0);

    const detail = await fetch(`${baseUrl}/api/finance/journals/${created.id}`, {
      headers: { cookie: auth.header },
    });
    expect(detail.status).toBe(200);
    expect(detail.headers.get('etag')).toBe('"1"');
    const lines = await fetch(
      `${baseUrl}/api/finance/journal-lines?limit=100&journalId=${created.id}`,
      { headers: { cookie: auth.header } },
    );
    expect(lines.status).toBe(200);
    expect((await lines.json()).data).toHaveLength(2);

    const post = () => fetch(`${baseUrl}/api/finance/journals/${created.id}/actions/post`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'manual-journal-post' },
      body: '{}',
    });
    const postedResponse = await post();
    expect(postedResponse.status).toBe(200);
    const posted = await postedResponse.json();
    expect(posted.data).toMatchObject({ status: 'posted', version: 2, total: '75.25' });
    const postReplay = await post();
    expect(postReplay.status).toBe(200);
    expect(postReplay.headers.get('idempotency-replayed')).toBe('true');
    expect(await postReplay.json()).toEqual(posted);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'MJ-API-1'))).toHaveLength(2);

    const reverse = () => fetch(`${baseUrl}/api/finance/journals/${created.id}/actions/reverse`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'manual-journal-reverse' },
      body: JSON.stringify({
        docNo: 'MJ-API-REV-1', postingDate: '2026-06-23', reason: 'Fictional correction',
      }),
    });
    const reversedResponse = await reverse();
    expect(reversedResponse.status).toBe(200);
    const reversed = await reversedResponse.json();
    expect(reversed.data.original).toMatchObject({ status: 'reversed', version: 3 });
    expect(reversed.data.reversal).toMatchObject({
      docNo: 'MJ-API-REV-1', status: 'posted', reversalOfId: created.id, total: '75.25',
    });
    const reverseReplay = await reverse();
    expect(reverseReplay.status).toBe(200);
    expect(reverseReplay.headers.get('idempotency-replayed')).toBe('true');
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'MJ-API-REV-1'))).toHaveLength(2);

    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'finance/journals'),
      eq(auditLog.entityId, String(created.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create', requestId: 'manual-journal-create' }),
      expect.objectContaining({ action: 'post' }),
      expect.objectContaining({ action: 'reverse' }),
    ]));
  });

  it('denies Viewer writes while preserving read access', async () => {
    const auth = await login('viewer@acme.co', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/finance/journals`, {
      headers: { cookie: auth.header },
    })).status).toBe(200);
    const denied = await fetch(`${baseUrl}/api/finance/journals`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrf,
      },
      body: JSON.stringify({
        docNo: 'MJ-VIEWER-DENIED', postingDate: '2026-07-22', journalType: 'standard',
        memo: 'Unauthorized',
        lines: [
          { accountId: arId, debit: '1.00', credit: '0' },
          { accountId: revenueId, debit: '0', credit: '1.00' },
        ],
      }),
    });
    expect(denied.status).toBe(403);
    expect(await db.select().from(journalHeader)).toHaveLength(0);
  });

  it('rejects an unbalanced payload without persisting a header', async () => {
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/finance/journals`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrf,
      },
      body: JSON.stringify({
        docNo: 'MJ-API-INVALID', postingDate: '2026-07-22', journalType: 'standard',
        memo: 'Invalid',
        lines: [
          { accountId: arId, debit: '5.00', credit: '0' },
          { accountId: revenueId, debit: '0', credit: '4.00' },
        ],
      }),
    });
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('validation_failed');
    expect(await db.select().from(journalHeader)).toHaveLength(0);
  });
});
