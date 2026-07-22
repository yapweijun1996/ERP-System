import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { auditLog, product, supplier, supplierPriceList } from '../data/schema';
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

describe('supplier pricing and performance API vertical slice', () => {
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
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return cookies(response);
  }

  it('creates and idempotently activates a supplier contract with audit evidence', async () => {
    const auth = await login();
    const headers = {
      cookie: auth.header, 'content-type': 'application/json', 'x-csrf-token': auth.csrf,
    };
    const [vendor] = await db.select({ id: supplier.id }).from(supplier)
      .where(eq(supplier.code, 'SUPP2'));
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-GADGET'));
    const createdResponse = await fetch(`${baseUrl}/api/purchasing/supplier-price-lists`, {
      method: 'POST', headers,
      body: JSON.stringify({
        code: 'SPL-API-DELTA', name: 'Fictional API supplier contract',
        supplierId: vendor.id, currency: 'SGD', effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31', leadTimeDays: 12, isPreferred: true,
        lines: [{ productId: item.id, minQty: '5', unitCost: '12.50' }],
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    expect(created).toMatchObject({ status: 'draft', version: 1, isPreferred: true });

    const activate = () => fetch(
      `${baseUrl}/api/purchasing/supplier-price-lists/${created.id}/actions/activate`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'activate-supplier-contract-api' },
        body: '{}',
      },
    );
    const activatedResponse = await activate();
    expect(activatedResponse.status).toBe(200);
    const activated = await activatedResponse.json();
    expect(activated.data).toMatchObject({ status: 'active', version: 2 });
    const replay = await activate();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(activated);

    const performance = await fetch(`${baseUrl}/api/purchasing/vendor-performance`, {
      headers: { cookie: auth.header },
    });
    expect(performance.status).toBe(200);
    expect((await performance.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ supplierCode: 'SUPP1' }),
      expect.objectContaining({ supplierCode: 'SUPP2' }),
    ]));
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'purchasing/supplier-price-lists'),
      eq(auditLog.entityId, String(created.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create' }),
      expect.objectContaining({ action: 'activate' }),
    ]));
  });

  it('denies a read-only viewer from creating a supplier contract', async () => {
    const auth = await login('viewer@acme.co', 'viewer1234');
    const [vendor] = await db.select({ id: supplier.id }).from(supplier)
      .where(eq(supplier.code, 'SUPP2'));
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-GADGET'));
    const response = await fetch(`${baseUrl}/api/purchasing/supplier-price-lists`, {
      method: 'POST', headers: {
        cookie: auth.header, 'content-type': 'application/json', 'x-csrf-token': auth.csrf,
      },
      body: JSON.stringify({
        code: 'SPL-DENIED', name: 'Denied', supplierId: vendor.id, currency: 'SGD',
        effectiveFrom: '2026-01-01', lines: [{ productId: item.id, unitCost: '12' }],
      }),
    });
    expect(response.status).toBe(403);
    expect(await db.select().from(supplierPriceList)
      .where(eq(supplierPriceList.code, 'SPL-DENIED'))).toHaveLength(0);
  });
});
