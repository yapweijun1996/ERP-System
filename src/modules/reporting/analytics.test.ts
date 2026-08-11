import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  account,
  customer,
  glEntry,
  invoice,
  product,
  salesOrder,
  salesOrderLine,
  stockLevel,
  stockMovement,
  warehouse,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { listReportingAnalyticsWithin } from './analytics';

const SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };

async function reportingFacts() {
  const db = await freshDb();
  await seedDemo(db);
  const [buyer] = await db.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, SCOPE.masterFn),
    eq(customer.companyFn, SCOPE.companyFn),
    eq(customer.code, 'CUST1'),
  ));
  const products = await db.select({ id: product.id, sku: product.sku }).from(product).where(and(
    eq(product.masterFn, SCOPE.masterFn),
    eq(product.companyFn, SCOPE.companyFn),
  ));
  const widget = products.find((row) => row.sku === 'SG-WIDGET')!;
  const gadget = products.find((row) => row.sku === 'SG-GADGET')!;
  const [store] = await db.insert(warehouse).values({
    ...SCOPE, code: 'BI-WH', name: 'Fictional BI warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values([
    { ...SCOPE, productId: widget.id, warehouseId: store.id, qty: '10.0000' },
    { ...SCOPE, productId: gadget.id, warehouseId: store.id, qty: '3.0000' },
  ]);
  await db.insert(stockMovement).values({
    ...SCOPE, productId: widget.id, warehouseId: store.id, qty: '10.0000',
    direction: 'in', movedAt: new Date('2026-05-01T00:00:00.000Z'),
    refType: 'test_receipt', refId: 1,
  });
  const [order] = await db.insert(salesOrder).values({
    ...SCOPE, docNo: 'SO-BI-1', customerId: buyer.id, status: 'confirmed',
    orderDate: '2026-07-01', currency: 'SGD', netAmount: '100.00',
    taxAmount: '9.00', totalAmount: '109.00',
  }).returning({ id: salesOrder.id });
  await db.insert(salesOrderLine).values({
    ...SCOPE, orderId: order.id, lineNo: 1, lineType: 'stock', productId: widget.id,
    description: 'Widget', uom: 'unit',
    qty: '2.0000', unitPrice: '50.0000', netAmount: '100.00',
    taxCode: 'SR', taxRate: '9.000', taxAmount: '9.00',
  });
  await db.insert(invoice).values({
    ...SCOPE, docNo: 'INV-SO-BI-1', orderId: order.id, customerId: buyer.id,
    status: 'unpaid', invoiceDate: '2026-07-01', currency: 'SGD',
    netAmount: '100.00', taxAmount: '9.00', totalAmount: '109.00',
  });
  const [cash] = await db.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, SCOPE.masterFn),
    eq(account.companyFn, SCOPE.companyFn),
    eq(account.code, '1000'),
  ));
  await db.insert(glEntry).values([
    { ...SCOPE, journalRef: 'BI-CASH-IN', accountId: cash.id, debit: '25.00', credit: '0' },
    { ...SCOPE, journalRef: 'BI-CASH-OUT', accountId: cash.id, debit: '0', credit: '5.00' },
  ]);
  return db;
}

async function cashBalance(db: Awaited<ReturnType<typeof freshDb>>, companyFn: string) {
  const rows = await db.select({ debit: glEntry.debit, credit: glEntry.credit })
    .from(glEntry).innerJoin(account, and(
      eq(account.id, glEntry.accountId),
      eq(account.masterFn, glEntry.masterFn),
      eq(account.companyFn, glEntry.companyFn),
    )).where(and(
      eq(glEntry.masterFn, 'M1'), eq(glEntry.companyFn, companyFn), eq(account.code, '1000'),
    ));
  return rows.reduce((total, row) => total + Number(row.debit) - Number(row.credit), 0).toFixed(2);
}

describe('canonical cross-module reporting analytics', () => {
  it('rebuilds management, category and honest inbound-activity aging facts', async () => {
    const db = await reportingFacts();
    const page = await listReportingAnalyticsWithin(
      db,
      SCOPE,
      { limit: 100 },
      new Date('2026-07-22T00:00:00.000Z'),
    );
    const expectedCash = await cashBalance(db, SCOPE.companyFn);
    expect(page.nextCursor).toBeNull();
    expect(page.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'summary', recognizedRevenue: '100.00', openReceivables: '109.00',
        inventoryValue: '104.00', inventoryProductCount: 2, cashBalance: expectedCash,
      }),
      expect.objectContaining({
        kind: 'sales-category', category: 'Finished Goods', invoiceCount: 1,
        netUnits: '2.0000', productRevenue: '100.00',
      }),
      expect.objectContaining({
        kind: 'stock-aging', sku: 'SG-WIDGET', ageDays: 82, bucket: '61-90',
        inventoryValue: '65.00',
      }),
      expect.objectContaining({
        kind: 'stock-aging', sku: 'SG-GADGET', ageDays: null,
        bucket: 'no-history', inventoryValue: '39.00',
      }),
      expect.objectContaining({
        kind: 'customer-revenue', customerCode: 'CUST1', recognizedRevenue: '100.00',
      }),
    ]));
  });

  it('uses a stable bounded cursor across heterogeneous BI rows', async () => {
    const db = await reportingFacts();
    const first = await listReportingAnalyticsWithin(db, SCOPE, { limit: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.nextCursor).toBe(first.data[1].id);
    const second = await listReportingAnalyticsWithin(db, SCOPE, {
      cursor: first.nextCursor ?? 0, limit: 100,
    });
    expect(second.data.length).toBeGreaterThan(0);
    expect(second.data.every((row) => row.id > (first.nextCursor ?? 0))).toBe(true);
  });

  it('returns an empty scoped summary without leaking another company', async () => {
    const db = await reportingFacts();
    const page = await listReportingAnalyticsWithin(
      db,
      { masterFn: 'M1', companyFn: 'C-MY' },
      { limit: 100 },
    );
    const expectedCash = await cashBalance(db, 'C-MY');
    expect(page.data).toEqual([
      expect.objectContaining({
        kind: 'summary', recognizedRevenue: '0.00', inventoryValue: '0.00',
        inventoryProductCount: 0, cashBalance: expectedCash,
      }),
    ]);
    expect(page.data.some((row) => row.kind === 'stock-aging')).toBe(false);
    expect(page.data.some((row) => row.kind === 'sales-category')).toBe(false);
  });
});
