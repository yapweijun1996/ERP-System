import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  customer,
  product,
  salesEnquiry,
  salesOrder,
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
  createSalesQuotation,
  SalesQuotationError,
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
        lines: [{ productId: fx.productId, qty: '3', unitPrice: '100', taxCode: 'SR' }],
      },
    ));
    expect(converted).toMatchObject({ enquiryId: enquiry.id, status: 'quoted' });
    expect(await db.select().from(salesEnquiry)).toMatchObject([
      { status: 'quoted', version: 2 },
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

  it('issues, accepts and converts a quotation into an editable draft sales order', async () => {
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
    expect(converted).toMatchObject({ orderDocNo: 'SO-Q-1', orderStatus: 'draft' });
    expect(await db.select().from(salesQuotation)).toMatchObject([
      { status: 'converted', version: 4, orderId: converted.orderId },
    ]);
    expect(await db.select().from(salesOrder)).toMatchObject([
      { status: 'draft', netAmount: '100.00', taxAmount: '9.00', totalAmount: '109.00' },
    ]);
    expect(await db.select().from(salesOrderLine)).toMatchObject([
      { qty: '2.5000', unitPrice: '40.0000', taxRate: '9.000' },
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
});
