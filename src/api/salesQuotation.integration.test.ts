import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  customer,
  glEntry,
  invoice,
  product,
  salesEnquiry,
  salesOrder,
  salesOrderApproval,
  salesOrderLine,
  salesQuotation,
  salesQuotationLine,
  stockMovement,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) =>
    Array.from(value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
      (match) => `${match[1]}=${match[2]}`));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair) throw new Error('Missing CSRF cookie');
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

async function login(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@acme.co', password: 'demo1234' }),
  });
  expect(response.status).toBe(200);
  return responseCookies(response);
}

describe('sales enquiry and quotation API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let baseline: number[];

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    // seedDemo() itself seeds a real posted progress claim + supplier invoice
    // (EPIC-024) with their own real GL legs, so "no side effects" below must compare
    // against this post-seed baseline, not an assumed-empty table.
    baseline = (await Promise.all([
      db.select({ value: count() }).from(stockMovement),
      db.select({ value: count() }).from(invoice),
      db.select({ value: count() }).from(glEntry),
    ])).map(([row]) => row.value);
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

  it('converts an enquiry through an accepted quotation into an approval-gated order idempotently', async () => {
    const [buyer] = await db.select({ id: customer.id }).from(customer).limit(1);
    const [item] = await db.select({ id: product.id }).from(product).limit(1);
    const cookies = await login(baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const createResponse = await fetch(`${baseUrl}/api/sales/enquiries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'ENQ-API-1',
        customerId: buyer.id,
        subject: 'API production line enquiry',
        channel: 'direct',
        estimatedValue: '109.00',
        currency: 'SGD',
        ownerName: 'Demo Sales',
        enquiryDate: '2026-07-19',
      }),
    });
    expect(createResponse.status).toBe(201);
    const enquiry = (await createResponse.json()).data;

    async function action(
      resource: 'enquiries' | 'quotations',
      id: number,
      name: string,
      key: string,
      payload: Record<string, unknown>,
    ) {
      return fetch(`${baseUrl}/api/sales/${resource}/${id}/actions/${name}`, {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': key },
        body: JSON.stringify(payload),
      });
    }

    const quotePayload = {
      docNo: 'Q-API-1',
      quoteDate: '2026-07-19',
      validUntil: '2026-08-19',
      currency: 'SGD',
      probability: '65',
      lines: [{
        productId: item.id,
        qty: '1',
        unitPrice: '100',
        taxCode: 'SR',
      }],
    };
    const convertResponse = await action(
      'enquiries',
      enquiry.id,
      'convert-to-quotation',
      'sales-api-enquiry-convert',
      quotePayload,
    );
    expect(convertResponse.status).toBe(200);
    const converted = (await convertResponse.json()).data;
    const replayResponse = await action(
      'enquiries',
      enquiry.id,
      'convert-to-quotation',
      'sales-api-enquiry-convert',
      quotePayload,
    );
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers.get('idempotency-replayed')).toBe('true');
    expect((await replayResponse.json()).data).toEqual(converted);

    expect((await action(
      'quotations', converted.quotationId, 'issue', 'sales-api-quote-issue', {},
    )).status).toBe(200);
    expect((await action(
      'quotations', converted.quotationId, 'accept', 'sales-api-quote-accept', {},
    )).status).toBe(200);
    const orderResponse = await action(
      'quotations',
      converted.quotationId,
      'convert-to-order',
      'sales-api-quote-order',
      { docNo: 'SO-API-QUOTE-1', orderDate: '2026-07-19' },
    );
    expect(orderResponse.status).toBe(200);
    const orderResult = (await orderResponse.json()).data;

    expect(await db.select().from(salesEnquiry).where(eq(salesEnquiry.id, enquiry.id)))
      .toMatchObject([{ status: 'quoted' }]);
    expect(await db.select().from(salesQuotation)
      .where(eq(salesQuotation.id, converted.quotationId)))
      .toMatchObject([{ status: 'converted', orderId: orderResult.orderId }]);
    expect(await db.select().from(salesQuotationLine))
      .toMatchObject([{ netAmount: '100.00', taxAmount: '9.00' }]);
    expect(await db.select().from(salesOrder).where(eq(salesOrder.id, orderResult.orderId)))
      .toMatchObject([{ status: 'pending_approval', totalAmount: '109.00' }]);
    expect(await db.select().from(salesOrderApproval)
      .where(eq(salesOrderApproval.orderId, orderResult.orderId)))
      .toMatchObject([{
        status: 'pending',
        reason: 'Accepted quotation Q-API-1 requires order approval.',
      }]);
    expect(await db.select().from(salesOrderLine))
      .toMatchObject([{ netAmount: '100.00', taxAmount: '9.00' }]);

    const sideEffects = await Promise.all([
      db.select({ value: count() }).from(stockMovement),
      db.select({ value: count() }).from(invoice),
      db.select({ value: count() }).from(glEntry),
    ]);
    expect(sideEffects.map(([row], index) => row.value - baseline[index])).toEqual([0, 0, 0]);
  });
});
