import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  customer,
  product,
  salesEnquiry,
  salesEnquiryLine,
  salesOrder,
  salesOrderApproval,
  salesOrderLine,
  salesQuotation,
  salesQuotationLine,
  taxRule,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  convertEnquiryToQuotationWithin,
  convertQuotationToOrderWithin,
  createSalesEnquiry,
  getSalesEnquiryAggregateWithin,
  createSalesQuotation,
  replaceSalesEnquiryLinesWithin,
  SalesQuotationError,
  saveSalesEnquiryDraftWithin,
  transitionQuotationWithin,
} from './quotation';

async function fixture(db: DB) {
  const [buyer] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'QCUST',
    name: 'Quotation customer',
  }).returning({ id: customer.id });
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'QITEM',
    name: 'Quotation item',
  }).returning({ id: product.id });
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    taxRegime: 'GST',
    taxCode: 'SR',
    rate: '9',
    validFrom: '2024-01-01',
  });
  return { customerId: buyer.id, productId: item.id };
}

describe('sales enquiry and quotation chain', () => {
  it('assigns an identity-backed enquiry number only when Quick Create succeeds', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const enquiry = await createSalesEnquiry(db, SCOPE, {
      customerId: fx.customerId,
      subject: 'Server-numbered enquiry',
      channel: 'direct',
      estimatedValue: '0',
      currency: 'SGD',
      ownerName: 'Demo Sales',
      enquiryDate: '2026-08-04',
    });

    expect(enquiry.docNo).toBe(`ENQ-${String(enquiry.id).padStart(7, '0')}`);
    expect(await db.select({ docNo: salesEnquiry.docNo }).from(salesEnquiry))
      .toEqual([{ docNo: enquiry.docNo }]);
  });

  it('replaces enquiry items atomically and derives the header estimate', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const enquiry = await createSalesEnquiry(db, SCOPE, {
      docNo: 'ENQ-ITEMS',
      customerId: fx.customerId,
      subject: 'Canonical item requirements',
      channel: 'direct',
      estimatedValue: '999.00',
      currency: 'SGD',
      ownerName: 'Demo Sales',
      enquiryDate: '2026-08-03',
    });

    const first = await db.transaction((tx) => replaceSalesEnquiryLinesWithin(
      tx,
      SCOPE,
      enquiry.id,
      {
        expectedVersion: enquiry.version,
        lines: [
          { productId: fx.productId, qty: '2', estimatedUnitPrice: '12.345' },
          { productId: fx.productId, qty: '0.5', estimatedUnitPrice: '10' },
        ],
      },
    ));
    expect(first).toMatchObject({ version: 2, estimatedValue: '29.69', lineCount: 2 });
    expect(await db.select().from(salesEnquiryLine)).toMatchObject([
      { lineNo: 1, lineType: 'stock', description: 'Quotation item', uom: 'unit', qty: '2.0000', estimatedUnitPrice: '12.3450' },
      { lineNo: 2, lineType: 'stock', description: 'Quotation item', uom: 'unit', qty: '0.5000', estimatedUnitPrice: '10.0000' },
    ]);

    await expect(db.transaction((tx) => replaceSalesEnquiryLinesWithin(
      tx,
      SCOPE,
      enquiry.id,
      { expectedVersion: 1, lines: [] },
    ))).rejects.toThrow('version changed');
    expect(await db.select().from(salesEnquiryLine)).toHaveLength(2);

    const cleared = await db.transaction((tx) => replaceSalesEnquiryLinesWithin(
      tx,
      SCOPE,
      enquiry.id,
      { expectedVersion: first.version, lines: [] },
    ));
    expect(cleared).toMatchObject({ version: 3, estimatedValue: '0.00', lineCount: 0 });
    expect(await db.select().from(salesEnquiryLine)).toHaveLength(0);
  });

  it('reads and saves the complete enquiry aggregate with optimistic versioning', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const enquiry = await createSalesEnquiry(db, SCOPE, {
      docNo: 'ENQ-AGGREGATE',
      customerId: fx.customerId,
      subject: 'Aggregate before edit',
      channel: 'direct',
      estimatedValue: '999.00',
      currency: 'SGD',
      ownerName: 'Demo Sales',
      enquiryDate: '2026-08-04',
    });

    const before = await db.transaction((tx) =>
      getSalesEnquiryAggregateWithin(tx, SCOPE, enquiry.id));
    expect(before).toMatchObject({
      enquiry: { id: enquiry.id, subject: 'Aggregate before edit', version: 1 },
      customer: { id: fx.customerId, name: 'Quotation customer' },
      lines: [],
      quotations: [],
    });

    const saved = await db.transaction((tx) => saveSalesEnquiryDraftWithin(
      tx,
      SCOPE,
      enquiry.id,
      {
        expectedVersion: enquiry.version,
        header: {
          customerId: fx.customerId,
          subject: 'Aggregate after edit',
          channel: 'email',
          currency: 'SGD',
          ownerName: 'Inside Sales',
          enquiryDate: '2026-08-05',
        },
        lines: [
          { productId: fx.productId, qty: '2', estimatedUnitPrice: '12.345' },
          {
            lineType: 'non_stock',
            productId: null,
            description: 'On-site installation',
            uom: 'job',
            qty: '1',
            estimatedUnitPrice: '100',
          },
        ],
      },
    ));
    expect(saved).toMatchObject({
      enquiry: {
        id: enquiry.id,
        subject: 'Aggregate after edit',
        channel: 'email',
        ownerName: 'Inside Sales',
        enquiryDate: '2026-08-05',
        version: 2,
        estimatedValue: '124.69',
      },
      lineCount: 2,
    });

    const after = await db.transaction((tx) =>
      getSalesEnquiryAggregateWithin(tx, SCOPE, enquiry.id));
    expect(after?.lines).toMatchObject([
      { lineNo: 1, lineType: 'stock', productId: fx.productId, qty: '2.0000', estimatedUnitPrice: '12.3450' },
      { lineNo: 2, lineType: 'non_stock', productId: null, description: 'On-site installation', uom: 'job' },
    ]);

    await expect(db.transaction((tx) => saveSalesEnquiryDraftWithin(
      tx,
      SCOPE,
      enquiry.id,
      {
        expectedVersion: saved.enquiry.version,
        header: {
          customerId: fx.customerId,
          subject: 'Should roll back',
          channel: 'email',
          currency: 'SGD',
          ownerName: 'Inside Sales',
          enquiryDate: '2026-08-05',
        },
        lines: [{
          lineType: 'non_stock',
          productId: null,
          description: '   ',
          uom: 'job',
          qty: '1',
          estimatedUnitPrice: '1',
        }],
      },
    ))).rejects.toThrow('Line description is required');

    const unchanged = await db.transaction((tx) =>
      getSalesEnquiryAggregateWithin(tx, SCOPE, enquiry.id));
    expect(unchanged).toMatchObject({
      enquiry: { subject: 'Aggregate after edit', version: 2, estimatedValue: '124.69' },
    });
    expect(unchanged?.lines).toHaveLength(2);
  });

  it('persists mixed stock and free-text non-stock lines through quotation conversion', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const enquiry = await createSalesEnquiry(db, SCOPE, {
      docNo: 'ENQ-NON-STOCK',
      customerId: fx.customerId,
      subject: 'Product with installation service',
      channel: 'direct',
      estimatedValue: '0',
      currency: 'SGD',
      ownerName: 'Demo Sales',
      enquiryDate: '2026-08-04',
    });
    await db.transaction((tx) => replaceSalesEnquiryLinesWithin(tx, SCOPE, enquiry.id, {
      expectedVersion: enquiry.version,
      lines: [
        { productId: fx.productId, description: 'Configured quotation item', qty: '2', estimatedUnitPrice: '30' },
        { lineType: 'non_stock', productId: null, description: 'On-site installation and commissioning', uom: 'job', qty: '1', estimatedUnitPrice: '120' },
      ],
    }));
    expect(await db.select().from(salesEnquiryLine)).toMatchObject([
      { lineNo: 1, lineType: 'stock', productId: fx.productId, description: 'Configured quotation item', uom: 'unit' },
      { lineNo: 2, lineType: 'non_stock', productId: null, description: 'On-site installation and commissioning', uom: 'job' },
    ]);
    expect(await db.select().from(salesEnquiry)).toMatchObject([{ estimatedValue: '180.00' }]);

    const converted = await db.transaction((tx) => convertEnquiryToQuotationWithin(tx, SCOPE, enquiry.id, {
      docNo: 'Q-NON-STOCK',
      quoteDate: '2026-08-04',
      validUntil: '2026-09-04',
      currency: 'SGD',
      lines: [
        { qty: '999', unitPrice: '35', taxCode: 'SR' },
        { qty: '999', unitPrice: '150', taxCode: 'SR' },
      ],
    }));
    expect(await db.select().from(salesQuotationLine)).toMatchObject([
      { lineType: 'stock', productId: fx.productId, description: 'Configured quotation item', qty: '2.0000', unitPrice: '35.0000' },
      { lineType: 'non_stock', productId: null, description: 'On-site installation and commissioning', uom: 'job', qty: '1.0000', unitPrice: '150.0000' },
    ]);

    await db.transaction((tx) => transitionQuotationWithin(tx, SCOPE, converted.quotationId, 'issue'));
    await db.transaction((tx) => transitionQuotationWithin(tx, SCOPE, converted.quotationId, 'accept'));
    const order = await db.transaction((tx) => convertQuotationToOrderWithin(tx, SCOPE, converted.quotationId, {
      docNo: 'SO-NON-STOCK', orderDate: '2026-08-05',
    }));
    expect(order).toMatchObject({
      quotationId: converted.quotationId,
      orderDocNo: 'SO-NON-STOCK',
      orderStatus: 'pending_approval',
    });
    expect(await db.select().from(salesOrder)).toMatchObject([{
      id: order.orderId,
      docNo: 'SO-NON-STOCK',
      status: 'pending_approval',
    }]);
    expect(await db.select({
      lineType: salesOrderLine.lineType,
      productId: salesOrderLine.productId,
      description: salesOrderLine.description,
      uom: salesOrderLine.uom,
    }).from(salesOrderLine).where(eq(salesOrderLine.orderId, order.orderId))).toEqual([
      {
        lineType: 'stock',
        productId: fx.productId,
        description: 'Configured quotation item',
        uom: 'unit',
      },
      {
        lineType: 'non_stock',
        productId: null,
        description: 'On-site installation and commissioning',
        uom: 'job',
      },
    ]);
  });

  it('rejects blank non-stock descriptions and mixed line identities', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const enquiry = await createSalesEnquiry(db, SCOPE, {
      docNo: 'ENQ-BAD-NON-STOCK', customerId: fx.customerId, subject: 'Invalid line',
      channel: 'direct', estimatedValue: '0', currency: 'SGD', ownerName: 'Demo Sales',
      enquiryDate: '2026-08-04',
    });
    await expect(db.transaction((tx) => replaceSalesEnquiryLinesWithin(tx, SCOPE, enquiry.id, {
      expectedVersion: enquiry.version,
      lines: [{ lineType: 'non_stock', productId: null, description: '   ', qty: '1', estimatedUnitPrice: '10' }],
    }))).rejects.toThrow('Line description is required');
    await expect(db.transaction((tx) => replaceSalesEnquiryLinesWithin(tx, SCOPE, enquiry.id, {
      expectedVersion: enquiry.version,
      lines: [{ lineType: 'non_stock', productId: fx.productId, description: 'Invalid service', qty: '1', estimatedUnitPrice: '10' }],
    }))).rejects.toThrow('must not use one');
  });

  it('converts an enquiry into a quotation with immutable tax totals', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const enquiry = await createSalesEnquiry(db, SCOPE, {
      docNo: 'ENQ-1',
      customerId: fx.customerId,
      subject: 'Pricing and lead time',
      channel: 'email',
      estimatedValue: '1000',
      currency: 'SGD',
      ownerName: 'Demo Sales',
      enquiryDate: '2026-07-19',
    });
    await db.transaction((tx) => replaceSalesEnquiryLinesWithin(tx, SCOPE, enquiry.id, {
      expectedVersion: enquiry.version,
      lines: [{ productId: fx.productId, qty: '3', estimatedUnitPrice: '80' }],
    }));
    const converted = await db.transaction((tx) => convertEnquiryToQuotationWithin(
      tx,
      SCOPE,
      enquiry.id,
      {
        docNo: 'Q-1',
        quoteDate: '2026-07-19',
        validUntil: '2026-08-19',
        currency: 'SGD',
        probability: '75',
        lines: [{ productId: fx.productId, qty: '999', unitPrice: '100', taxCode: 'SR' }],
      },
    ));
    expect(converted).toMatchObject({ enquiryId: enquiry.id, status: 'quoted' });
    expect(await db.select().from(salesEnquiry)).toMatchObject([
      { status: 'quoted', version: 3 },
    ]);
    expect(await db.select().from(salesQuotation)).toMatchObject([
      {
        status: 'draft',
        netAmount: '300.00',
        taxAmount: '27.00',
        totalAmount: '327.00',
        probability: '75.00',
      },
    ]);
    expect(await db.select().from(salesQuotationLine)).toMatchObject([
      { qty: '3.0000', unitPrice: '100.0000', taxRate: '9.000' },
    ]);
  });

  it('issues, accepts and converts a quotation into an approval-gated sales order', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const quote = await createSalesQuotation(db, SCOPE, {
      docNo: 'Q-ORDER',
      customerId: fx.customerId,
      quoteDate: '2026-07-19',
      validUntil: '2026-08-19',
      currency: 'SGD',
      lines: [{ productId: fx.productId, qty: '2.5', unitPrice: '40', taxCode: 'SR' }],
    });
    await db.transaction((tx) => transitionQuotationWithin(tx, SCOPE, quote.id, 'issue'));
    await db.transaction((tx) => transitionQuotationWithin(tx, SCOPE, quote.id, 'accept'));
    const converted = await db.transaction((tx) => convertQuotationToOrderWithin(
      tx,
      SCOPE,
      quote.id,
      { docNo: 'SO-Q-1', orderDate: '2026-07-20' },
    ));
    expect(converted).toMatchObject({
      orderDocNo: 'SO-Q-1',
      orderStatus: 'pending_approval',
    });
    expect(await db.select().from(salesQuotation)).toMatchObject([
      { status: 'converted', version: 4, orderId: converted.orderId },
    ]);
    expect(await db.select().from(salesOrder)).toMatchObject([
      { status: 'pending_approval', netAmount: '100.00', taxAmount: '9.00', totalAmount: '109.00' },
    ]);
    expect(await db.select().from(salesOrderApproval)).toMatchObject([
      {
        id: converted.approvalId,
        status: 'pending',
        reason: 'Accepted quotation Q-ORDER requires order approval.',
      },
    ]);
    expect(await db.select().from(salesOrderLine)).toMatchObject([
      { qty: '2.5000', unitPrice: '40.0000', taxRate: '9.000' },
    ]);
  });

  it('creates a mixed multi-line quotation with server-derived totals', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const quote = await createSalesQuotation(db, SCOPE, {
      docNo: 'Q-MULTI-LINE',
      customerId: fx.customerId,
      quoteDate: '2026-08-04',
      validUntil: '2026-09-04',
      currency: 'SGD',
      lines: [
        {
          lineType: 'stock', productId: fx.productId, description: 'Configured item',
          uom: 'unit', qty: '2', unitPrice: '40', taxCode: 'SR',
        },
        {
          lineType: 'non_stock', productId: null, description: 'Installation service',
          uom: 'job', qty: '1', unitPrice: '100', taxCode: 'SR',
        },
      ],
    });

    expect(quote).toMatchObject({ lineCount: 2, totalAmount: '196.20' });
    expect(await db.select().from(salesQuotation)).toMatchObject([{
      netAmount: '180.00', taxAmount: '16.20', totalAmount: '196.20',
    }]);
    expect(await db.select().from(salesQuotationLine)).toMatchObject([
      { lineNo: 1, lineType: 'stock', productId: fx.productId, description: 'Configured item', qty: '2.0000', netAmount: '80.00' },
      { lineNo: 2, lineType: 'non_stock', productId: null, description: 'Installation service', uom: 'job', qty: '1.0000', netAmount: '100.00' },
    ]);
  });

  it('rejects invalid state, product and cross-tenant conversion without partial rows', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const quote = await createSalesQuotation(db, SCOPE, {
      docNo: 'Q-GUARD',
      customerId: fx.customerId,
      quoteDate: '2026-07-19',
      validUntil: '2026-08-19',
      currency: 'SGD',
      lines: [{ productId: fx.productId, qty: '1', unitPrice: '10', taxCode: 'SR' }],
    });
    await expect(db.transaction((tx) => convertQuotationToOrderWithin(
      tx,
      SCOPE,
      quote.id,
      { docNo: 'SO-EARLY', orderDate: '2026-07-20' },
    ))).rejects.toThrow(SalesQuotationError);
    await expect(createSalesQuotation(db, SCOPE, {
      docNo: 'Q-BAD-PRODUCT',
      customerId: fx.customerId,
      quoteDate: '2026-07-19',
      validUntil: '2026-08-19',
      currency: 'SGD',
      lines: [{ productId: 999999, qty: '1', unitPrice: '10', taxCode: 'SR' }],
    })).rejects.toThrow(SalesQuotationError);
    await expect(db.transaction((tx) => transitionQuotationWithin(
      tx,
      { masterFn: 'OTHER', companyFn: 'OTHER-C' },
      quote.id,
      'issue',
    ))).rejects.toThrow(SalesQuotationError);
    expect(await db.select().from(salesOrder)).toHaveLength(0);
    expect(await db.select().from(salesQuotation)).toHaveLength(1);
  });

  it('rejects a zero line quantity', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await expect(createSalesQuotation(db, SCOPE, {
      docNo: 'Q-ZERO-QTY',
      customerId: fx.customerId,
      quoteDate: '2026-07-19',
      validUntil: '2026-08-19',
      currency: 'SGD',
      lines: [{ productId: fx.productId, qty: '0', unitPrice: '10', taxCode: 'SR' }],
    })).rejects.toThrow('Line quantity must be greater than zero.');
  });
});
