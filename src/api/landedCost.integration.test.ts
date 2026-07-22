import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  auditLog,
  glEntry,
  goodsReceipt,
  landedCost,
  landedCostLine,
  product,
  purchaseOrder,
  purchaseOrderLine,
  stockLevel,
  stockMovement,
  supplier,
  warehouse,
} from '../data/schema';
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

describe('landed cost API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let receiptId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [item] = await db.select({ id: product.id }).from(product)
      .where(and(eq(product.companyFn, 'C-SG'), eq(product.sku, 'SG-WIDGET')));
    const [vendor] = await db.select({ id: supplier.id }).from(supplier)
      .where(and(eq(supplier.companyFn, 'C-SG'), eq(supplier.code, 'SUPP1')));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1', companyFn: 'C-SG', code: 'LC-API-WH', name: 'Landed Cost API Warehouse',
    }).returning({ id: warehouse.id });
    const [order] = await db.insert(purchaseOrder).values({
      masterFn: 'M1', companyFn: 'C-SG', docNo: 'PO-LC-API', supplierId: vendor.id,
      status: 'received', orderDate: '2026-07-22', currency: 'SGD',
      netAmount: '100.00', taxAmount: '9.00', totalAmount: '109.00',
    }).returning({ id: purchaseOrder.id });
    await db.insert(purchaseOrderLine).values({
      masterFn: 'M1', companyFn: 'C-SG', orderId: order.id, lineNo: 1,
      productId: item.id, qty: '10', unitCost: '10', netAmount: '100',
      taxCode: 'SR', taxRate: '9', taxAmount: '9',
    });
    const [receipt] = await db.insert(goodsReceipt).values({
      masterFn: 'M1', companyFn: 'C-SG', docNo: 'GR-LC-API', orderId: order.id,
      warehouseId: location.id, receivedDate: '2026-07-22',
    }).returning({ id: goodsReceipt.id });
    receiptId = receipt.id;
    await db.insert(stockLevel).values({
      masterFn: 'M1', companyFn: 'C-SG', productId: item.id,
      warehouseId: location.id, qty: '10',
    });
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

  it('creates and idempotently allocates with audit, GL and bounded line reads', async () => {
    const headers = await auth();
    const beforeMovements = (await db.select({ id: stockMovement.id }).from(stockMovement)).length;
    const createdResponse = await fetch(`${baseUrl}/api/purchasing/landed-costs`, {
      method: 'POST', headers: { ...headers, 'x-request-id': 'landed-create-api' },
      body: JSON.stringify({
        docNo: 'LC-API-1', goodsReceiptId: receiptId, costDate: '2026-07-22',
        allocationBasis: 'value', freightAmount: '12.34', dutyAmount: '2.66',
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    expect(created).toMatchObject({ status: 'draft', goodsValue: '100.00', totalAddedCost: '15.00' });

    const lineResponse = await fetch(`${baseUrl}/api/purchasing/landed-cost-lines?limit=100`, {
      headers: { cookie: headers.cookie },
    });
    expect(lineResponse.status).toBe(200);
    expect((await lineResponse.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ landedCostId: created.id, allocatedAmount: '15.00' }),
    ]));
    const action = () => fetch(
      `${baseUrl}/api/purchasing/landed-costs/${created.id}/actions/allocate`,
      { method: 'POST', headers: { ...headers, 'idempotency-key': 'landed-api-allocate' }, body: '{}' },
    );
    const allocatedResponse = await action();
    expect(allocatedResponse.status).toBe(200);
    const allocated = await allocatedResponse.json();
    expect(allocated.data).toMatchObject({ status: 'allocated', version: 2, totalAddedCost: '15.00' });
    const replay = await action();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(allocated);

    const [costed] = await db.select({ averageCost: product.averageCost }).from(product)
      .where(and(eq(product.companyFn, 'C-SG'), eq(product.sku, 'SG-WIDGET')));
    expect(costed.averageCost).toBe('8.00000000');
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'LC-API-1'));
    expect(legs.map((leg) => [leg.debit, leg.credit])).toEqual([['15.00', '0.00'], ['0.00', '15.00']]);
    expect((await db.select({ id: stockMovement.id }).from(stockMovement)).length).toBe(beforeMovements);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'purchasing/landed-costs'), eq(auditLog.entityId, String(created.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create', requestId: 'landed-create-api' }),
      expect.objectContaining({ action: 'allocate' }),
    ]));
  });

  it('denies a read-only viewer from creating landed cost', async () => {
    const response = await fetch(`${baseUrl}/api/purchasing/landed-costs`, {
      method: 'POST', headers: await auth('viewer@acme.co', 'viewer1234'),
      body: JSON.stringify({
        docNo: 'LC-DENIED', goodsReceiptId: receiptId, costDate: '2026-07-22',
        allocationBasis: 'value', freightAmount: '10',
      }),
    });
    expect(response.status).toBe(403);
    expect(await db.select().from(landedCost)).toHaveLength(0);
    expect(await db.select().from(landedCostLine)).toHaveLength(0);
  });
});
