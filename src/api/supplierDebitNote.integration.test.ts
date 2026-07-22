import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { auditLog, glEntry, stockMovement, supplierDebitNote, supplierInvoice } from '../data/schema';
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

describe('supplier debit note API vertical slice', () => {
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

  async function auth(email = 'admin@acme.co', password = 'demo1234') {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const state = cookies(login);
    return { cookie: state.header, 'content-type': 'application/json', 'x-csrf-token': state.csrf };
  }

  it('creates and idempotently posts a balanced no-stock supplier claim with audit evidence', async () => {
    const [invoice] = await db.select({ id: supplierInvoice.id }).from(supplierInvoice)
      .where(and(eq(supplierInvoice.companyFn, 'C-SG'), eq(supplierInvoice.status, 'unpaid')));
    const headers = await auth();
    const beforeMovements = (await db.select({ id: stockMovement.id }).from(stockMovement)).length;
    const createdResponse = await fetch(`${baseUrl}/api/purchasing/supplier-debit-notes`, {
      method: 'POST', headers,
      body: JSON.stringify({
        docNo: 'SDN-API-1', supplierInvoiceId: invoice.id, noteDate: '2026-07-22',
        reason: 'Fictional API short-supply claim', netAmount: '10', taxCode: 'SR',
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    expect(created).toMatchObject({ status: 'draft', totalAmount: '10.90' });

    const action = () => fetch(
      `${baseUrl}/api/purchasing/supplier-debit-notes/${created.id}/actions/post`,
      { method: 'POST', headers: { ...headers, 'idempotency-key': 'supplier-debit-api-post' }, body: '{}' },
    );
    const postedResponse = await action();
    expect(postedResponse.status).toBe(200);
    const posted = await postedResponse.json();
    expect(posted.data).toMatchObject({ status: 'posted', version: 2, totalAmount: '10.90' });
    const replay = await action();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(posted);

    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'SDN-API-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(10.9);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(10.9);
    expect((await db.select({ id: stockMovement.id }).from(stockMovement)).length).toBe(beforeMovements);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'purchasing/supplier-debit-notes'),
      eq(auditLog.entityId, String(created.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create' }),
      expect.objectContaining({ action: 'post' }),
    ]));
  });

  it('denies a read-only viewer from creating a supplier claim', async () => {
    const [invoice] = await db.select({ id: supplierInvoice.id }).from(supplierInvoice)
      .where(and(eq(supplierInvoice.companyFn, 'C-SG'), eq(supplierInvoice.status, 'unpaid')));
    const response = await fetch(`${baseUrl}/api/purchasing/supplier-debit-notes`, {
      method: 'POST', headers: await auth('viewer@acme.co', 'viewer1234'),
      body: JSON.stringify({
        docNo: 'SDN-DENIED', supplierInvoiceId: invoice.id, noteDate: '2026-07-22',
        reason: 'Denied', netAmount: '10', taxCode: 'SR',
      }),
    });
    expect(response.status).toBe(403);
    expect(await db.select().from(supplierDebitNote)).toHaveLength(0);
  });
});
