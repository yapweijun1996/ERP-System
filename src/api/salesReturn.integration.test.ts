import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  customer,
  glEntry,
  product,
  salesCreditNote,
  salesDebitNote,
  salesDeliveryLine,
  salesDiscountRule,
  salesPriceList,
  salesReturn,
  stockLevel,
  stockMovement,
  warehouse,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { confirmSalesOrder } from '../modules/sales/confirmOrder';
import { setStockQtyForFixture } from '../modules/inventory/stock';
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

describe('sales return API vertical slice', () => {
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

  it('creates, receives and credits an RMA with idempotent replay', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [buyer] = await db.select({ id: customer.id }).from(customer)
      .where(eq(customer.code, 'CUST1'));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'RMA-API-WH',
      name: 'RMA API warehouse',
    }).returning({ id: warehouse.id });
    await db.insert(stockLevel).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: location.id,
      qty: '0',
    });
    await setStockQtyForFixture(db, { masterFn: 'M1', companyFn: 'C-SG' }, item.id, location.id, 20);
    const posted = await confirmSalesOrder(db, { masterFn: 'M1', companyFn: 'C-SG' }, {
      docNo: 'SO-RMA-API',
      customerId: buyer.id,
      orderDate: '2026-07-19',
      currency: 'SGD',
      lines: [{
        productId: item.id,
        warehouseId: location.id,
        qty: 2,
        unitPrice: 10,
        taxCode: 'SR',
      }],
    });
    const [deliveryLine] = await db.select({ id: salesDeliveryLine.id })
      .from(salesDeliveryLine).where(eq(salesDeliveryLine.deliveryId, posted.deliveryId));
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
    const createdResponse = await fetch(`${baseUrl}/api/sales/returns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'RMA-API-1',
        deliveryId: posted.deliveryId,
        invoiceId: posted.invoiceId,
        warehouseId: location.id,
        returnDate: '2026-07-19',
        reason: 'Fictional API return',
        lines: [{ deliveryLineId: deliveryLine.id, qty: '1' }],
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    const action = () => fetch(
      `${baseUrl}/api/sales/returns/${created.id}/actions/receive-and-credit`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'sales-rma-api-credit' },
        body: JSON.stringify({ creditDocNo: 'CN-API-1', noteDate: '2026-07-19' }),
      },
    );
    const creditedResponse = await action();
    expect(creditedResponse.status).toBe(200);
    const credited = await creditedResponse.json();
    expect(credited.data).toMatchObject({ status: 'credited', totalAmount: '10.90' });
    const replay = await action();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(credited);
    expect(await db.select().from(salesReturn).where(eq(salesReturn.id, created.id)))
      .toMatchObject([{ status: 'credited' }]);
    expect(await db.select().from(salesCreditNote)
      .where(eq(salesCreditNote.returnId, created.id))).toHaveLength(1);
    expect(await db.select().from(stockMovement).where(and(
      eq(stockMovement.refType, 'sales_return'),
      eq(stockMovement.refId, created.id),
    )))
      .toMatchObject([expect.objectContaining({ refType: 'sales_return', direction: 'in' })]);
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'CN-API-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(10.9);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(10.9);

    const debitCreatedResponse = await fetch(`${baseUrl}/api/sales/debit-notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'DN-API-1',
        invoiceId: posted.invoiceId,
        noteDate: '2026-07-19',
        reason: 'Fictional handling charge',
        netAmount: '10.00',
        taxCode: 'SR',
      }),
    });
    expect(debitCreatedResponse.status).toBe(201);
    const debitCreated = (await debitCreatedResponse.json()).data;
    const postDebit = () => fetch(
      `${baseUrl}/api/sales/debit-notes/${debitCreated.id}/actions/post`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'sales-debit-api-post' },
        body: '{}',
      },
    );
    const debitPostedResponse = await postDebit();
    expect(debitPostedResponse.status).toBe(200);
    const debitPosted = await debitPostedResponse.json();
    expect(debitPosted.data).toMatchObject({ status: 'posted', totalAmount: '10.90' });
    const debitReplay = await postDebit();
    expect(debitReplay.status).toBe(200);
    expect(debitReplay.headers.get('idempotency-replayed')).toBe('true');
    expect(await debitReplay.json()).toEqual(debitPosted);
    expect(await db.select().from(salesDebitNote)
      .where(eq(salesDebitNote.id, debitCreated.id)))
      .toMatchObject([{ status: 'posted', version: 2 }]);
    const debitLegs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'DN-API-1'));
    expect(debitLegs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(10.9);
    expect(debitLegs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(10.9);

    const priceResponse = await fetch(`${baseUrl}/api/sales/price-lists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: 'PL-API-1',
        name: 'Fictional API price list',
        basis: 'customer',
        customerId: buyer.id,
        currency: 'SGD',
        effectiveFrom: '2026-07-19',
        lines: [{ productId: item.id, minQty: '1', unitPrice: '12', floorPrice: '9' }],
      }),
    });
    expect(priceResponse.status).toBe(201);
    const priceList = (await priceResponse.json()).data;
    const activatePrice = () => fetch(
      `${baseUrl}/api/sales/price-lists/${priceList.id}/actions/activate`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'sales-price-api-activate' },
        body: '{}',
      },
    );
    expect((await activatePrice()).status).toBe(200);
    const priceReplay = await activatePrice();
    expect(priceReplay.headers.get('idempotency-replayed')).toBe('true');
    expect(await db.select().from(salesPriceList).where(eq(salesPriceList.id, priceList.id)))
      .toMatchObject([{ status: 'active', version: 2 }]);

    const discountResponse = await fetch(`${baseUrl}/api/sales/discount-rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: 'DR-API-1',
        name: 'Fictional API discount',
        ruleType: 'customer',
        customerId: buyer.id,
        minOrderAmount: '1000',
        discountPct: '5',
        approvalThresholdPct: '10',
        effectiveFrom: '2026-07-19',
      }),
    });
    expect(discountResponse.status).toBe(201);
    const discount = (await discountResponse.json()).data;
    const activateDiscount = () => fetch(
      `${baseUrl}/api/sales/discount-rules/${discount.id}/actions/activate`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'sales-discount-api-activate' },
        body: '{}',
      },
    );
    expect((await activateDiscount()).status).toBe(200);
    const discountReplay = await activateDiscount();
    expect(discountReplay.headers.get('idempotency-replayed')).toBe('true');
    expect(await db.select().from(salesDiscountRule)
      .where(eq(salesDiscountRule.id, discount.id)))
      .toMatchObject([{ status: 'active', version: 2 }]);
  });
});
