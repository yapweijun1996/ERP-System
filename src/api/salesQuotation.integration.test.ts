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
  salesEnquiryLine,
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
    body: JSON.stringify({ organizationCode: 'ACME', username: 'admin', password: 'demo1234' }),
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

  it('requires an idempotency key and replays one server-numbered Quick Create', async () => {
    const [buyer] = await db.select({ id: customer.id }).from(customer).limit(1);
    const cookies = await login(baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const payload = {
      customerId: buyer.id,
      subject: 'Idempotent Quick Create',
      channel: 'direct',
      estimatedValue: '0',
      currency: 'SGD',
      ownerName: 'Demo Sales',
      enquiryDate: '2026-08-04',
    };
    const missingKey = await fetch(`${baseUrl}/api/sales/enquiries`, {
      method: 'POST', headers, body: JSON.stringify(payload),
    });
    expect(missingKey.status).toBe(428);
    expect((await missingKey.json()).error.code).toBe('idempotency_key_required');

    const create = () => fetch(`${baseUrl}/api/sales/enquiries`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'quick-create-enquiry-v1' },
      body: JSON.stringify(payload),
    });
    const first = await create();
    expect(first.status).toBe(201);
    const created = (await first.json()).data;
    expect(created.docNo).toBe(`ENQ-${String(created.id).padStart(7, '0')}`);

    const replay = await create();
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect((await replay.json()).data).toEqual(created);
    expect(await db.select({ value: count() }).from(salesEnquiry)
      .where(eq(salesEnquiry.subject, payload.subject))).toEqual([{ value: 1 }]);
  });

  it('requires idempotency and replays a mixed multi-line quotation create', async () => {
    const [buyer] = await db.select({ id: customer.id }).from(customer).limit(1);
    const [item] = await db.select({ id: product.id }).from(product).limit(1);
    const cookies = await login(baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const payload = {
      docNo: 'Q-API-MULTI-LINE',
      customerId: buyer.id,
      quoteDate: '2026-08-04',
      validUntil: '2026-09-04',
      currency: 'SGD',
      lines: [
        {
          lineType: 'stock', productId: item.id, description: 'Configured item',
          uom: 'unit', qty: '2', unitPrice: '40', taxCode: 'SR',
        },
        {
          lineType: 'non_stock', productId: null, description: 'Installation service',
          uom: 'job', qty: '1', unitPrice: '100', taxCode: 'SR',
        },
      ],
    };
    const missingKey = await fetch(`${baseUrl}/api/sales/quotations`, {
      method: 'POST', headers, body: JSON.stringify(payload),
    });
    expect(missingKey.status).toBe(428);
    expect((await missingKey.json()).error.code).toBe('idempotency_key_required');

    const create = () => fetch(`${baseUrl}/api/sales/quotations`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'sales-api-quotation-multi-line-v1' },
      body: JSON.stringify(payload),
    });
    const first = await create();
    expect(first.status).toBe(201);
    const created = (await first.json()).data;
    expect(created).toMatchObject({ lineCount: 2, totalAmount: '196.20' });

    const replay = await create();
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect((await replay.json()).data).toEqual(created);
    expect(await db.select({ value: count() }).from(salesQuotation)
      .where(eq(salesQuotation.docNo, payload.docNo))).toEqual([{ value: 1 }]);
    expect(await db.select().from(salesQuotationLine)
      .where(eq(salesQuotationLine.quotationId, created.id))).toMatchObject([
      { lineType: 'stock', productId: item.id, netAmount: '80.00' },
      { lineType: 'non_stock', productId: null, netAmount: '100.00' },
    ]);
  });

  it('reads the enquiry aggregate and saves header plus lines as one idempotent draft action', async () => {
    const [buyer] = await db.select({ id: customer.id }).from(customer).limit(1);
    const cookies = await login(baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const createResponse = await fetch(`${baseUrl}/api/sales/enquiries`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'aggregate-create-v1' },
      body: JSON.stringify({
        customerId: buyer.id,
        subject: 'Aggregate API enquiry',
        channel: 'direct',
        estimatedValue: '0',
        currency: 'SGD',
        ownerName: 'Demo Sales',
        enquiryDate: '2026-08-04',
      }),
    });
    expect(createResponse.status).toBe(201);
    const enquiry = (await createResponse.json()).data;

    const aggregateResponse = await fetch(
      `${baseUrl}/api/sales/enquiries/${enquiry.id}/aggregate`,
      { headers: { cookie: cookies.header } },
    );
    expect(aggregateResponse.status).toBe(200);
    expect(aggregateResponse.headers.get('etag')).toBe('"1"');
    expect((await aggregateResponse.json()).data).toMatchObject({
      enquiry: { id: enquiry.id, subject: 'Aggregate API enquiry', version: 1 },
      customer: { id: buyer.id },
      lines: [],
      quotations: [],
    });

    const draftPayload = {
      expectedVersion: 1,
      header: {
        customerId: buyer.id,
        subject: 'Aggregate API enquiry saved',
        channel: 'email',
        currency: 'SGD',
        ownerName: 'Inside Sales',
        enquiryDate: '2026-08-05',
      },
      lines: [{
        lineType: 'non_stock',
        productId: null,
        description: 'Installation service',
        uom: 'job',
        qty: '1',
        estimatedUnitPrice: '250',
      }],
    };
    const save = () => fetch(
      `${baseUrl}/api/sales/enquiries/${enquiry.id}/actions/save-draft`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'aggregate-save-draft-v1' },
        body: JSON.stringify(draftPayload),
      },
    );
    const firstSave = await save();
    expect(firstSave.status).toBe(200);
    const savedBody = await firstSave.json();
    expect(savedBody.data).toMatchObject({
      enquiry: { id: enquiry.id, subject: 'Aggregate API enquiry saved', version: 2, estimatedValue: '250.00' },
      lineCount: 1,
    });

    const replaySave = await save();
    expect(replaySave.status).toBe(200);
    expect(replaySave.headers.get('idempotency-replayed')).toBe('true');
    expect((await replaySave.json()).data).toEqual(savedBody.data);

    const savedAggregateResponse = await fetch(
      `${baseUrl}/api/sales/enquiries/${enquiry.id}/aggregate`,
      { headers: { cookie: cookies.header } },
    );
    expect(savedAggregateResponse.status).toBe(200);
    expect(savedAggregateResponse.headers.get('etag')).toBe('"2"');
    expect((await savedAggregateResponse.json()).data).toMatchObject({
      enquiry: {
        subject: 'Aggregate API enquiry saved',
        channel: 'email',
        ownerName: 'Inside Sales',
        enquiryDate: '2026-08-05',
        version: 2,
        estimatedValue: '250.00',
      },
      lines: [{
        lineType: 'non_stock',
        productId: null,
        description: 'Installation service',
        uom: 'job',
        qty: '1.0000',
        estimatedUnitPrice: '250.0000',
      }],
    });

    const stale = await fetch(
      `${baseUrl}/api/sales/enquiries/${enquiry.id}/actions/save-draft`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'aggregate-save-stale-v1' },
        body: JSON.stringify({ ...draftPayload, header: { ...draftPayload.header, subject: 'Stale edit' } }),
      },
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe('invalid_state');
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
      headers: { ...headers, 'idempotency-key': 'sales-api-enquiry-create' },
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

    const itemsPayload = {
      expectedVersion: enquiry.version,
      lines: [{ productId: item.id, qty: '2', estimatedUnitPrice: '50' }],
    };
    const itemsResponse = await action(
      'enquiries', enquiry.id, 'replace-lines', 'sales-api-enquiry-lines-v1', itemsPayload,
    );
    expect(itemsResponse.status).toBe(200);
    expect((await itemsResponse.json()).data).toMatchObject({
      version: 2,
      estimatedValue: '100.00',
      lineCount: 1,
    });
    const enquiryLinesResponse = await fetch(
      `${baseUrl}/api/sales/enquiry-lines?limit=100&enquiryId=${enquiry.id}`,
      { headers: { cookie: cookies.header } },
    );
    expect(enquiryLinesResponse.status).toBe(200);
    expect((await enquiryLinesResponse.json()).data).toMatchObject([{
      enquiryId: enquiry.id,
      productId: item.id,
      qty: '2.0000',
      estimatedUnitPrice: '50.0000',
    }]);

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

    const enquiryDetailResponse = await fetch(
      `${baseUrl}/api/sales/enquiries/${enquiry.id}`,
      { headers: { cookie: cookies.header } },
    );
    expect(enquiryDetailResponse.status).toBe(200);
    expect((await enquiryDetailResponse.json()).data).toMatchObject({
      id: enquiry.id,
      docNo: 'ENQ-API-1',
      status: 'quoted',
    });
    const linkedQuotationResponse = await fetch(
      `${baseUrl}/api/sales/quotations?limit=100&enquiryId=${enquiry.id}`,
      { headers: { cookie: cookies.header } },
    );
    expect(linkedQuotationResponse.status).toBe(200);
    expect((await linkedQuotationResponse.json()).data).toMatchObject([{
      id: converted.quotationId,
      enquiryId: enquiry.id,
      docNo: 'Q-API-1',
    }]);

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
    expect(await db.select().from(salesEnquiryLine)
      .where(eq(salesEnquiryLine.enquiryId, enquiry.id)))
      .toMatchObject([{ qty: '2.0000', estimatedUnitPrice: '50.0000' }]);
    expect(await db.select().from(salesQuotation)
      .where(eq(salesQuotation.id, converted.quotationId)))
      .toMatchObject([{ status: 'converted', orderId: orderResult.orderId }]);
    expect(await db.select().from(salesQuotationLine))
      .toMatchObject([{ qty: '2.0000', netAmount: '200.00', taxAmount: '18.00' }]);
    expect(await db.select().from(salesOrder).where(eq(salesOrder.id, orderResult.orderId)))
      .toMatchObject([{ status: 'pending_approval', totalAmount: '218.00' }]);
    expect(await db.select().from(salesOrderApproval)
      .where(eq(salesOrderApproval.orderId, orderResult.orderId)))
      .toMatchObject([{
        status: 'pending',
        reason: 'Accepted quotation Q-API-1 requires order approval.',
      }]);
    expect(await db.select().from(salesOrderLine))
      .toMatchObject([{ qty: '2.0000', netAmount: '200.00', taxAmount: '18.00' }]);

    const sideEffects = await Promise.all([
      db.select({ value: count() }).from(stockMovement),
      db.select({ value: count() }).from(invoice),
      db.select({ value: count() }).from(glEntry),
    ]);
    expect(sideEffects.map(([row], index) => row.value - baseline[index])).toEqual([0, 0, 0]);
  });

  it('accepts a free-text enquiry row and preserves it in the linked quotation', async () => {
    const [buyer] = await db.select({ id: customer.id }).from(customer).limit(1);
    const cookies = await login(baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const created = await fetch(`${baseUrl}/api/sales/enquiries`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'sales-api-free-text-create' },
      body: JSON.stringify({
        docNo: 'ENQ-API-FREE-TEXT', customerId: buyer.id, subject: 'Installation service',
        channel: 'direct', estimatedValue: '0', currency: 'SGD', ownerName: 'Demo Sales',
        enquiryDate: '2026-08-04',
      }),
    });
    expect(created.status).toBe(201);
    const enquiry = (await created.json()).data;
    const action = (name: string, key: string, payload: Record<string, unknown>) => fetch(
      `${baseUrl}/api/sales/enquiries/${enquiry.id}/actions/${name}`,
      { method: 'POST', headers: { ...headers, 'idempotency-key': key }, body: JSON.stringify(payload) },
    );
    const saved = await action('replace-lines', 'sales-api-free-text-lines', {
      expectedVersion: enquiry.version,
      lines: [{
        lineType: 'non_stock', productId: null,
        description: 'On-site installation and commissioning', uom: 'job',
        qty: '1', estimatedUnitPrice: '250',
      }],
    });
    expect(saved.status).toBe(200);
    expect((await saved.json()).data).toMatchObject({ lineCount: 1, estimatedValue: '250.00' });

    const converted = await action('convert-to-quotation', 'sales-api-free-text-convert', {
      docNo: 'Q-API-FREE-TEXT', quoteDate: '2026-08-04', validUntil: '2026-09-04',
      currency: 'SGD', lines: [{
        lineType: 'non_stock', productId: null,
        description: 'On-site installation and commissioning', uom: 'job',
        qty: '1', unitPrice: '300', taxCode: 'SR',
      }],
    });
    expect(converted.status).toBe(200);
    expect(await db.select().from(salesEnquiryLine).where(eq(salesEnquiryLine.enquiryId, enquiry.id)))
      .toMatchObject([{ lineType: 'non_stock', productId: null, description: 'On-site installation and commissioning', uom: 'job' }]);
    expect(await db.select().from(salesQuotationLine))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        lineType: 'non_stock', productId: null,
        description: 'On-site installation and commissioning', uom: 'job',
        qty: '1.0000', unitPrice: '300.0000',
      })]));
  });
});
