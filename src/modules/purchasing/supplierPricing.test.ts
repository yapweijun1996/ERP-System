import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  goodsReceipt,
  product,
  purchaseOrder,
  purchaseOrderLine,
  purchaseReturn,
  purchaseRfq,
  supplier,
  supplierInvoice,
  supplierPriceList,
  supplierPriceListLine,
  supplierQuotation,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  activateSupplierPriceList,
  createSupplierPriceList,
  SupplierPricingError,
} from './supplierPricing';
import { listVendorPerformanceWithin } from './vendorPerformance';

async function fixture(db: DB) {
  const [vendor] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'SUP-PERF', name: 'Fictional Performance Supplier',
  }).returning({ id: supplier.id });
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    sku: 'SUP-PRICE-ITEM', name: 'Fictional Contract Item', standardCost: '8',
  }).returning({ id: product.id });
  return { vendor, item };
}

describe('supplier price lists and derived vendor performance', () => {
  it('creates a tenant-safe contract and activates a unique effective product range', async () => {
    const db = await freshDb();
    const { vendor, item } = await fixture(db);
    const draft = await createSupplierPriceList(db, SCOPE, {
      code: 'SPL-TEST-2026', name: 'Fictional supplier contract',
      supplierId: vendor.id, currency: 'SGD', effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31', leadTimeDays: 7, isPreferred: true,
      lines: [{ productId: item.id, minQty: '10', unitCost: '9.50' }],
    });
    expect(draft).toMatchObject({ status: 'draft', version: 1, isPreferred: true });
    expect(await db.select().from(supplierPriceListLine)
      .where(eq(supplierPriceListLine.priceListId, draft.id)))
      .toMatchObject([{ minQty: '10.0000', unitCost: '9.5000' }]);
    await expect(activateSupplierPriceList(db, SCOPE, draft.id))
      .resolves.toMatchObject({ status: 'active', version: 2 });
    await expect(activateSupplierPriceList(db, SCOPE, draft.id))
      .rejects.toThrow(SupplierPricingError);

    const overlapping = await createSupplierPriceList(db, SCOPE, {
      code: 'SPL-OVERLAP', name: 'Overlapping contract', supplierId: vendor.id,
      currency: 'SGD', effectiveFrom: '2026-06-01', effectiveTo: '2027-01-01',
      lines: [{ productId: item.id, unitCost: '9.25' }],
    });
    await expect(activateSupplierPriceList(db, SCOPE, overlapping.id))
      .rejects.toThrow('already covers one of these products');
    expect(await db.select().from(supplierPriceList)
      .where(eq(supplierPriceList.id, overlapping.id)))
      .toMatchObject([{ status: 'draft', version: 1 }]);
  });

  it('rejects duplicate tiers without leaving a partial contract', async () => {
    const db = await freshDb();
    const { vendor, item } = await fixture(db);
    await expect(createSupplierPriceList(db, SCOPE, {
      code: 'SPL-DUP', name: 'Invalid duplicate tiers', supplierId: vendor.id,
      currency: 'SGD', effectiveFrom: '2026-01-01', lines: [
        { productId: item.id, minQty: '1', unitCost: '9' },
        { productId: item.id, minQty: '1.0000', unitCost: '8.50' },
      ],
    })).rejects.toThrow('Duplicate product quantity tiers');
    expect(await db.select().from(supplierPriceList)).toHaveLength(0);
  });

  it('serializes concurrent activation of overlapping contracts', async () => {
    const db = await freshDb();
    const { vendor, item } = await fixture(db);
    const createDraft = (code: string) => createSupplierPriceList(db, SCOPE, {
      code, name: `${code} contract`, supplierId: vendor.id, currency: 'SGD',
      effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
      lines: [{ productId: item.id, unitCost: '9.00' }],
    });
    const [first, second] = await Promise.all([
      createDraft('SPL-RACE-A'), createDraft('SPL-RACE-B'),
    ]);
    const results = await Promise.allSettled([
      activateSupplierPriceList(db, SCOPE, first.id),
      activateSupplierPriceList(db, SCOPE, second.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await db.select().from(supplierPriceList)
      .where(eq(supplierPriceList.status, 'active'))).toHaveLength(1);
  });

  it('derives the scorecard only from canonical purchasing facts', async () => {
    const db = await freshDb();
    const { vendor, item } = await fixture(db);
    const [location] = await db.insert(warehouse).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      code: 'SUP-PERF-WH', name: 'Performance Warehouse',
    }).returning({ id: warehouse.id });
    const [rfq] = await db.insert(purchaseRfq).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo: 'RFQ-PERF',
      subject: 'Performance fixture', rfqDate: '2026-01-01',
      responseDueDate: '2026-01-05', status: 'awarded',
    }).returning({ id: purchaseRfq.id });
    const [quote] = await db.insert(supplierQuotation).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo: 'SQT-PERF',
      rfqId: rfq.id, supplierId: vendor.id, quoteDate: '2026-01-02',
      validUntil: '2026-02-01', currency: 'SGD', leadTimeDays: 7,
      paymentTerms: '30 days', status: 'converted', netAmount: '100',
      taxAmount: '9', totalAmount: '109',
    }).returning({ id: supplierQuotation.id });
    const [order] = await db.insert(purchaseOrder).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo: 'PO-PERF',
      supplierId: vendor.id, supplierQuotationId: quote.id, status: 'received',
      orderDate: '2026-01-10', currency: 'SGD', netAmount: '100',
      taxAmount: '9', totalAmount: '109',
    }).returning({ id: purchaseOrder.id });
    await db.insert(purchaseOrderLine).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, orderId: order.id,
      lineNo: 1, productId: item.id, qty: '10', unitCost: '10', netAmount: '100',
      taxCode: 'SR', taxRate: '9', taxAmount: '9',
    });
    const [receipt] = await db.insert(goodsReceipt).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo: 'GR-PERF',
      orderId: order.id, warehouseId: location.id, receivedDate: '2026-01-15',
    }).returning({ id: goodsReceipt.id });
    const [invoice] = await db.insert(supplierInvoice).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo: 'SI-PERF',
      orderId: order.id, supplierId: vendor.id, invoiceDate: '2026-01-15',
      currency: 'SGD', netAmount: '100', taxAmount: '9', totalAmount: '109',
    }).returning({ id: supplierInvoice.id });
    await db.insert(purchaseReturn).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo: 'PRET-PERF',
      goodsReceiptId: receipt.id, supplierInvoiceId: invoice.id, warehouseId: location.id,
      returnDate: '2026-01-20', reason: 'Fictional damaged unit', status: 'credited',
      netAmount: '9.17', taxAmount: '0.83', totalAmount: '10.00',
    });
    const contract = await createSupplierPriceList(db, SCOPE, {
      code: 'SPL-PERF', name: 'Performance coverage contract', supplierId: vendor.id,
      currency: 'SGD', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
      lines: [{ productId: item.id, minQty: '1', unitCost: '10' }],
    });
    await activateSupplierPriceList(db, SCOPE, contract.id);

    const page = await listVendorPerformanceWithin(db, SCOPE, { limit: 20 });
    expect(page.data).toMatchObject([{
      supplierCode: 'SUP-PERF', orderCount: 1, receivedCount: 1,
      receivedPct: '100.0', invoicedSpend: '109.00', avgLeadDays: '5.0',
      onTimePct: '100.0', returnRatePct: '9.2', invoiceMatchPct: '100.0',
      contractCoveragePct: '100.0', rating: '4.5',
    }]);
  });
});
