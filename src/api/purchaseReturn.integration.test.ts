import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  auditLog,
  glEntry,
  product,
  purchaseOrderLine,
  purchaseReturn,
  stockMovement,
  supplier,
  supplierCreditNote,
  warehouse,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { createPurchaseOrder } from '../modules/purchasing/createPurchaseOrder';
import { postSupplierInvoice } from '../modules/purchasing/postSupplierInvoice';
import { receiveGoods } from '../modules/purchasing/receiveGoods';
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

describe('purchase return API vertical slice', () => {
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

  async function sourceDocuments() {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [vendor] = await db.select({ id: supplier.id }).from(supplier)
      .where(eq(supplier.code, 'SUPP1'));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1', companyFn: 'C-SG', code: 'PUR-RETURN-API-WH', name: 'API return warehouse',
    }).returning({ id: warehouse.id });
    const order = await createPurchaseOrder(db, { masterFn: 'M1', companyFn: 'C-SG' }, {
      docNo: 'PO-PRET-API', supplierId: vendor.id, orderDate: '2026-07-20', currency: 'SGD',
      lines: [{ productId: item.id, qty: '10', unitCost: '6.50', taxCode: 'SR' }],
    });
    const receipt = await receiveGoods(db, { masterFn: 'M1', companyFn: 'C-SG' }, {
      purchaseOrderId: order.orderId, warehouseId: location.id,
      docNo: 'GR-PRET-API', receivedDate: '2026-07-21',
    });
    const invoice = await postSupplierInvoice(db, { masterFn: 'M1', companyFn: 'C-SG' }, {
      purchaseOrderId: order.orderId, docNo: 'SI-PRET-API', invoiceDate: '2026-07-21',
    });
    const [line] = await db.select({ id: purchaseOrderLine.id }).from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.orderId, order.orderId));
    return { itemId: item.id, receiptId: receipt.receiptId, invoiceId: invoice.invoiceId, lineId: line.id };
  }

  it('creates a return and idempotently ships one AP credit with audit evidence', async () => {
    const source = await sourceDocuments();
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acme.co', password: 'demo1234' }),
    });
    const auth = cookies(login);
    const headers = {
      cookie: auth.header,
      'content-type': 'application/json',
      'x-csrf-token': auth.csrf,
    };
    const createdResponse = await fetch(`${baseUrl}/api/purchasing/purchase-returns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'PRET-API-1',
        goodsReceiptId: source.receiptId,
        supplierInvoiceId: source.invoiceId,
        returnDate: '2026-07-22',
        reason: 'Fictional API supplier return',
        lines: [{ purchaseOrderLineId: source.lineId, qty: '2' }],
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    expect(created).toMatchObject({ status: 'requested', totalAmount: '14.17' });

    const action = () => fetch(
      `${baseUrl}/api/purchasing/purchase-returns/${created.id}/actions/ship-and-credit`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'purchase-return-api-credit' },
        body: JSON.stringify({ creditDocNo: 'SCN-API-1', noteDate: '2026-07-22' }),
      },
    );
    const creditedResponse = await action();
    expect(creditedResponse.status).toBe(200);
    const credited = await creditedResponse.json();
    expect(credited.data).toMatchObject({ status: 'credited', totalAmount: '14.17' });
    const replay = await action();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(credited);

    expect(await db.select().from(purchaseReturn).where(eq(purchaseReturn.id, created.id)))
      .toMatchObject([{ status: 'credited', version: 2 }]);
    expect(await db.select().from(supplierCreditNote)
      .where(eq(supplierCreditNote.returnId, created.id))).toHaveLength(1);
    expect(await db.select().from(stockMovement).where(and(
      eq(stockMovement.refType, 'purchase_return'),
      eq(stockMovement.refId, created.id),
    ))).toMatchObject([expect.objectContaining({ direction: 'out', qty: '2.0000' })]);
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'SCN-API-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(14.17);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(14.17);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'purchasing/purchase-returns'),
      eq(auditLog.entityId, String(created.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create' }),
      expect.objectContaining({ action: 'ship-and-credit' }),
    ]));
  });

  it('denies a read-only viewer from creating returns', async () => {
    const source = await sourceDocuments();
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@acme.co', password: 'viewer1234' }),
    });
    const auth = cookies(login);
    const response = await fetch(`${baseUrl}/api/purchasing/purchase-returns`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrf,
      },
      body: JSON.stringify({
        docNo: 'PRET-DENIED', goodsReceiptId: source.receiptId,
        supplierInvoiceId: source.invoiceId, returnDate: '2026-07-22', reason: 'Denied',
        lines: [{ purchaseOrderLineId: source.lineId, qty: '1' }],
      }),
    });
    expect(response.status).toBe(403);
    expect(await db.select().from(purchaseReturn)).toHaveLength(0);
  });
});
