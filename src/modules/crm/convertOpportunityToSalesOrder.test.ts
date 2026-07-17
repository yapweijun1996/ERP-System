import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { product, warehouse, stockLevel, customer, account, taxRule, opportunity, glEntry } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { getStockQty } from '../inventory/stock';
import { InsufficientStockError } from '../inventory/stock';
import { createOpportunity } from './createOpportunity';
import { convertOpportunityToSalesOrder } from './convertOpportunityToSalesOrder';
import { InvalidOpportunityStateError } from './errors';

async function seedCrmFixture(db: DB) {
  const [widget] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'WIDGET', name: 'Widget', uom: 'unit',
  }).returning({ id: product.id });
  const [wh] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'WH', name: 'Main Warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, productId: widget.id, warehouseId: wh.id, qty: '100',
  });
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
  const opp = await createOpportunity(db, SCOPE, {
    docNo: 'OPP-T1', customerId: cust.id, title: 'Widget expansion',
    value: 50000, currency: 'SGD', closeDate: '2024-07-01',
  });
  return { widgetId: widget.id, warehouseId: wh.id, customerId: cust.id, opportunityId: opp.opportunityId };
}

describe('convertOpportunityToSalesOrder', () => {
  it('success: creates a real sales order (stock deducted, balanced GL) and marks the opportunity won', async () => {
    const db = await freshDb();
    const fx = await seedCrmFixture(db);

    const res = await convertOpportunityToSalesOrder(db, SCOPE, {
      opportunityId: fx.opportunityId, docNo: 'SO-T1', orderDate: '2024-06-01',
      lines: [{ productId: fx.widgetId, warehouseId: fx.warehouseId, qty: 5, unitPrice: 10, taxCode: 'SR' }],
    });

    expect(res.net).toBe(50);
    expect(res.tax).toBe(4.5);
    expect(res.total).toBe(54.5);
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(95);

    const legs = await db.select().from(glEntry).where(and(
      eq(glEntry.masterFn, SCOPE.masterFn), eq(glEntry.companyFn, SCOPE.companyFn), eq(glEntry.journalRef, res.invDocNo),
    ));
    const totalDebit = legs.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = legs.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);

    const [opp] = await db.select({ stage: opportunity.stage, orderId: opportunity.orderId }).from(opportunity)
      .where(and(eq(opportunity.masterFn, SCOPE.masterFn), eq(opportunity.companyFn, SCOPE.companyFn), eq(opportunity.id, fx.opportunityId)));
    expect(opp.stage).toBe('won');
    expect(opp.orderId).toBe(res.orderId);
  });

  it('rollback: converting an already-won opportunity throws and creates no second order', async () => {
    const db = await freshDb();
    const fx = await seedCrmFixture(db);
    await convertOpportunityToSalesOrder(db, SCOPE, {
      opportunityId: fx.opportunityId, docNo: 'SO-T2A', orderDate: '2024-06-01',
      lines: [{ productId: fx.widgetId, warehouseId: fx.warehouseId, qty: 5, unitPrice: 10, taxCode: 'SR' }],
    });

    await expect(convertOpportunityToSalesOrder(db, SCOPE, {
      opportunityId: fx.opportunityId, docNo: 'SO-T2B', orderDate: '2024-06-02',
      lines: [{ productId: fx.widgetId, warehouseId: fx.warehouseId, qty: 1, unitPrice: 10, taxCode: 'SR' }],
    })).rejects.toThrow(InvalidOpportunityStateError);

    // Still 95 (only the first conversion's deduction), not 94 — the second attempt left no trace.
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(95);
  });

  it('rollback: a failure inside the composed sales-order transaction (insufficient stock) leaves the opportunity untouched, not half-converted', async () => {
    const db = await freshDb();
    const fx = await seedCrmFixture(db);

    await expect(convertOpportunityToSalesOrder(db, SCOPE, {
      opportunityId: fx.opportunityId, docNo: 'SO-T3', orderDate: '2024-06-01',
      lines: [{ productId: fx.widgetId, warehouseId: fx.warehouseId, qty: 99999, unitPrice: 10, taxCode: 'SR' }],
    })).rejects.toThrow(InsufficientStockError);

    // The opportunity must still be exactly as createOpportunity left it — proves the
    // outer transaction (opportunity update) and the composed inner one (confirmSalesOrderWithin)
    // are genuinely ONE atomic unit, not two independently-committing steps.
    const [opp] = await db.select({ stage: opportunity.stage, orderId: opportunity.orderId }).from(opportunity)
      .where(and(eq(opportunity.masterFn, SCOPE.masterFn), eq(opportunity.companyFn, SCOPE.companyFn), eq(opportunity.id, fx.opportunityId)));
    expect(opp.stage).toBe('lead');
    expect(opp.orderId).toBeNull();
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(100);
  });
});
