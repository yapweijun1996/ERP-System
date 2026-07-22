import { and, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account,
  glEntry,
  goodsReceipt,
  landedCost,
  landedCostLine,
  product,
  purchaseOrder,
  purchaseOrderLine,
  stockLevel,
  stockMovement,
  supplier,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  allocateLandedCost,
  createLandedCost,
  LandedCostError,
} from './landedCost';

async function fixture(db: DB) {
  const [vendor] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'LC-SUP', name: 'Fictional Freight Parts Supplier',
  }).returning({ id: supplier.id });
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'LC-WH', name: 'Landed Cost Warehouse',
  }).returning({ id: warehouse.id });
  const items = await db.insert(product).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      sku: 'LC-A', name: 'Landed Item A', uom: 'unit', standardCost: '10.0000',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      sku: 'LC-B', name: 'Landed Item B', uom: 'unit', standardCost: '10.0000',
    },
  ]).returning({ id: product.id });
  const [order] = await db.insert(purchaseOrder).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    docNo: 'PO-LC-1', supplierId: vendor.id, status: 'received',
    orderDate: '2026-06-01', currency: 'SGD',
    netAmount: '400.00', taxAmount: '36.00', totalAmount: '436.00',
  }).returning({ id: purchaseOrder.id });
  await db.insert(purchaseOrderLine).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      orderId: order.id, lineNo: 1, productId: items[0].id, qty: '10', unitCost: '10',
      netAmount: '100', taxCode: 'SR', taxRate: '9', taxAmount: '9',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      orderId: order.id, lineNo: 2, productId: items[1].id, qty: '30', unitCost: '10',
      netAmount: '300', taxCode: 'SR', taxRate: '9', taxAmount: '27',
    },
  ]);
  const [receipt] = await db.insert(goodsReceipt).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    docNo: 'GR-LC-1', orderId: order.id, warehouseId: location.id,
    receivedDate: '2026-06-03',
  }).returning({ id: goodsReceipt.id });
  await db.insert(stockLevel).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      productId: items[0].id, warehouseId: location.id, qty: '20',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      productId: items[1].id, warehouseId: location.id, qty: '30',
    },
  ]);
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2300', name: 'Landed Cost Accrual', type: 'liability' },
  ]);
  return { receiptId: receipt.id, items };
}

describe('landed cost', () => {
  it('allocates exact cents by value, revalues inventory and posts balanced GL without quantity movement', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createLandedCost(db, SCOPE, {
      docNo: 'LC-1', goodsReceiptId: fx.receiptId, costDate: '2026-06-05',
      allocationBasis: 'value', freightAmount: '7.01', dutyAmount: '3',
    });
    expect(draft).toMatchObject({ status: 'draft', goodsValue: '400.00', totalAddedCost: '10.01', lines: 2 });
    const draftLines = await db.select().from(landedCostLine)
      .where(eq(landedCostLine.landedCostId, draft.id));
    expect(draftLines.map((line) => line.allocatedAmount)).toEqual(['2.50', '7.51']);
    expect(await db.select().from(glEntry)).toHaveLength(0);

    const allocated = await allocateLandedCost(db, SCOPE, draft.id);
    expect(allocated).toMatchObject({ status: 'allocated', version: 2, totalAddedCost: '10.01' });
    const costRows = await db.select({ id: product.id, averageCost: product.averageCost })
      .from(product).where(and(
        eq(product.masterFn, SCOPE.masterFn), eq(product.companyFn, SCOPE.companyFn),
      ));
    expect(costRows).toEqual([
      { id: fx.items[0].id, averageCost: '10.12500000' },
      { id: fx.items[1].id, averageCost: '10.25033333' },
    ]);
    const valuationIncrease = new Decimal(costRows[0].averageCost!).minus(10).mul(20)
      .plus(new Decimal(costRows[1].averageCost!).minus(10).mul(30))
      .toDecimalPlaces(2);
    expect(valuationIncrease.toFixed(2)).toBe('10.01');
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'LC-1'));
    expect(legs.map((leg) => [leg.debit, leg.credit])).toEqual([['10.01', '0.00'], ['0.00', '10.01']]);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
  });

  it('uses deterministic largest-remainder rounding and rejects duplicate allocation', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createLandedCost(db, SCOPE, {
      docNo: 'LC-QTY', goodsReceiptId: fx.receiptId, costDate: '2026-06-05',
      allocationBasis: 'quantity', otherAmount: '0.01',
    });
    const lines = await db.select().from(landedCostLine)
      .where(eq(landedCostLine.landedCostId, draft.id));
    expect(lines.map((line) => line.allocatedAmount)).toEqual(['0.00', '0.01']);
    await allocateLandedCost(db, SCOPE, draft.id);
    await expect(allocateLandedCost(db, SCOPE, draft.id)).rejects.toThrow(LandedCostError);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'LC-QTY'))).toHaveLength(2);
  });

  it('rejects another tenant receipt and rolls every effect back when a product has no stock', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await expect(createLandedCost(db, { masterFn: SCOPE.masterFn, companyFn: 'OTHER' }, {
      docNo: 'LC-FOREIGN', goodsReceiptId: fx.receiptId, costDate: '2026-06-05',
      allocationBasis: 'value', freightAmount: '10',
    })).rejects.toThrow('unavailable in this company');
    await db.delete(stockLevel).where(eq(stockLevel.productId, fx.items[1].id));
    const draft = await createLandedCost(db, SCOPE, {
      docNo: 'LC-NO-STOCK', goodsReceiptId: fx.receiptId, costDate: '2026-06-05',
      allocationBasis: 'value', freightAmount: '10',
    });
    await expect(allocateLandedCost(db, SCOPE, draft.id)).rejects.toThrow('has no on-hand quantity');
    const [header] = await db.select().from(landedCost).where(eq(landedCost.id, draft.id));
    expect(header.status).toBe('draft');
    const items = await db.select({ averageCost: product.averageCost }).from(product)
      .where(and(eq(product.masterFn, SCOPE.masterFn), eq(product.companyFn, SCOPE.companyFn)));
    expect(items.every((item) => item.averageCost == null)).toBe(true);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'LC-NO-STOCK'))).toHaveLength(0);
  });
});
