import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { product, warehouse, stockLevel, customer, account, taxRule, glEntry, salesOrder, invoice } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { getStockQty, countMovements, InsufficientStockError } from '../inventory/stock';
import { confirmSalesOrder, PostingError } from './confirmOrder';

async function seedSalesFixture(db: DB) {
  const [widget] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'WIDGET', name: 'Widget', uom: 'unit',
  }).returning({ id: product.id });
  const [gadget] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'GADGET', name: 'Gadget', uom: 'unit',
  }).returning({ id: product.id });
  const [wh] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'WH', name: 'Main Warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, productId: widget.id, warehouseId: wh.id, qty: '100' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, productId: gadget.id, warehouseId: wh.id, qty: '100' },
  ]);
  const [cust] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'C1', name: 'Test Customer',
  }).returning({ id: customer.id });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '4000', name: 'Revenue', type: 'income' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2200', name: 'Output Tax', type: 'liability' },
  ]);
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR',
    rate: '9.000', validFrom: '2024-01-01', validTo: null,
  });
  return { widgetId: widget.id, gadgetId: gadget.id, warehouseId: wh.id, customerId: cust.id };
}

describe('confirmSalesOrder', () => {
  it('success: creates the order and invoice, deducts stock, and posts a balanced GL', async () => {
    const db = await freshDb();
    const fx = await seedSalesFixture(db);

    const res = await confirmSalesOrder(db, SCOPE, {
      docNo: 'SO-T1', customerId: fx.customerId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [
        { productId: fx.widgetId, warehouseId: fx.warehouseId, qty: 5, unitPrice: 10, taxCode: 'SR' },
        { productId: fx.gadgetId, warehouseId: fx.warehouseId, qty: 3, unitPrice: 20, taxCode: 'SR' },
      ],
    });

    expect(res.net).toBe(110);
    expect(res.tax).toBe(9.9);
    expect(res.total).toBe(119.9);
    expect(res.movementIds).toHaveLength(2);
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(95);
    expect(await getStockQty(db, SCOPE, fx.gadgetId, fx.warehouseId)).toBe(97);

    const legs = await db.select().from(glEntry).where(and(
      eq(glEntry.masterFn, SCOPE.masterFn), eq(glEntry.companyFn, SCOPE.companyFn), eq(glEntry.journalRef, res.invDocNo),
    ));
    const totalDebit = legs.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = legs.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(119.9, 2);
  });

  it('rollback: insufficient stock on a later line undoes the WHOLE order, including the earlier valid line', async () => {
    const db = await freshDb();
    const fx = await seedSalesFixture(db);

    await expect(confirmSalesOrder(db, SCOPE, {
      docNo: 'SO-T2', customerId: fx.customerId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [
        { productId: fx.widgetId, warehouseId: fx.warehouseId, qty: 5, unitPrice: 10, taxCode: 'SR' }, // fine alone
        { productId: fx.gadgetId, warehouseId: fx.warehouseId, qty: 99999, unitPrice: 20, taxCode: 'SR' }, // exceeds stock
      ],
    })).rejects.toThrow(InsufficientStockError);

    // The whole transaction rolled back — including the widget line that would have succeeded alone.
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(100);
    expect(await countMovements(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(0);
    expect(await getStockQty(db, SCOPE, fx.gadgetId, fx.warehouseId)).toBe(100);

    const orders = await db.select().from(salesOrder).where(and(
      eq(salesOrder.masterFn, SCOPE.masterFn), eq(salesOrder.companyFn, SCOPE.companyFn), eq(salesOrder.docNo, 'SO-T2'),
    ));
    expect(orders).toHaveLength(0);

    const invoices = await db.select().from(invoice).where(and(
      eq(invoice.masterFn, SCOPE.masterFn), eq(invoice.companyFn, SCOPE.companyFn),
    ));
    expect(invoices).toHaveLength(0);
  });

  it('throws PostingError (not a silent wrong rate) when no tax rule covers the order date', async () => {
    const db = await freshDb();
    const fx = await seedSalesFixture(db);

    await expect(confirmSalesOrder(db, SCOPE, {
      docNo: 'SO-T3', customerId: fx.customerId, orderDate: '2020-01-01', currency: 'SGD', // before the seeded rule's validFrom
      lines: [{ productId: fx.widgetId, warehouseId: fx.warehouseId, qty: 1, unitPrice: 10, taxCode: 'SR' }],
    })).rejects.toThrow(PostingError);

    // Same rollback guarantee applies to a mid-chain posting failure, not just insufficient stock.
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(100);
  });
});
