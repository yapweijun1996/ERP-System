import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account,
  accountingPeriod,
  glEntry,
  inventoryAdjustment,
  product,
  stockLevel,
  stockMovement,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createInventoryAdjustment,
  InventorySnapshotConflictError,
  InventoryAdjustmentValidationError,
  InvalidInventoryAdjustmentStateError,
  postInventoryAdjustment,
} from './adjustment';
import { getStockQty, setStockQtyForFixture } from './stock';

async function fixture(db: DB) {
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'ADJ-ITEM',
    name: 'Adjustment Item',
    standardCost: '6.5000',
  }).returning({ id: product.id });
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'ADJ-WH',
    name: 'Adjustment Warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    productId: item.id,
    warehouseId: location.id,
    qty: '10',
  });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '5800', name: 'Inventory Variance', type: 'expense' },
  ]);
  await db.insert(accountingPeriod).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, fiscalYear: 2026, periodNo: 7,
    label: 'July 2026', startDate: '2026-07-01', endDate: '2026-07-31', status: 'open',
  });
  return { productId: item.id, warehouseId: location.id };
}

describe('inventory adjustment', () => {
  it('posts signed stock movement and balanced inventory variance GL', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createInventoryAdjustment(db, SCOPE, {
      docNo: 'ADJ-1',
      warehouseId: fx.warehouseId,
      adjustmentDate: '2026-07-18',
      reason: 'Cycle count',
      lines: [{ productId: fx.productId, countedQty: '8.0000' }],
    });

    const posted = await postInventoryAdjustment(db, SCOPE, draft.id);
    expect(posted).toMatchObject({
      status: 'posted',
      version: 2,
      valueImpact: '-13.00',
    });
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(8);
    const movements = await db.select().from(stockMovement);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      direction: 'out',
      refType: 'inventory_adjustment',
      refId: draft.id,
    });
    const entries = await db.select().from(glEntry);
    expect(entries).toHaveLength(2);
    expect(entries.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(13);
    expect(entries.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(13);
  });

  it('rolls back if stock changed after the physical count snapshot', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createInventoryAdjustment(db, SCOPE, {
      docNo: 'ADJ-2',
      warehouseId: fx.warehouseId,
      adjustmentDate: '2026-07-18',
      reason: 'Cycle count',
      lines: [{ productId: fx.productId, countedQty: 12 }],
    });
    await setStockQtyForFixture(db, SCOPE, fx.productId, fx.warehouseId, 9);

    await expect(postInventoryAdjustment(db, SCOPE, draft.id))
      .rejects.toThrow(InventorySnapshotConflictError);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(9);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);
    const [header] = await db.select({ status: inventoryAdjustment.status })
      .from(inventoryAdjustment)
      .where(and(
        eq(inventoryAdjustment.masterFn, SCOPE.masterFn),
        eq(inventoryAdjustment.companyFn, SCOPE.companyFn),
        eq(inventoryAdjustment.id, draft.id),
      ));
    expect(header.status).toBe('draft');
  });

  it('cannot post the same adjustment twice', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createInventoryAdjustment(db, SCOPE, {
      docNo: 'ADJ-3',
      warehouseId: fx.warehouseId,
      adjustmentDate: '2026-07-18',
      reason: 'Cycle count',
      lines: [{ productId: fx.productId, countedQty: 11 }],
    });
    await postInventoryAdjustment(db, SCOPE, draft.id);
    await expect(postInventoryAdjustment(db, SCOPE, draft.id))
      .rejects.toThrow(InvalidInventoryAdjustmentStateError);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(11);
    expect(await db.select().from(stockMovement)).toHaveLength(1);
  });

  it('rejects a negative physical count before creating a draft', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await expect(createInventoryAdjustment(db, SCOPE, {
      docNo: 'ADJ-NEGATIVE', warehouseId: fx.warehouseId,
      adjustmentDate: '2026-07-18', reason: 'Cycle count',
      lines: [{ productId: fx.productId, countedQty: '-1' }],
    })).rejects.toThrow(InventoryAdjustmentValidationError);
    expect(await db.select().from(inventoryAdjustment)).toHaveLength(0);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);
  });

  it('leaves a draft retryable when its accounting period is locked', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await db.insert(accountingPeriod).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, fiscalYear: 2026, periodNo: 6,
      label: 'June 2026', startDate: '2026-06-01', endDate: '2026-06-30', status: 'locked',
    });
    const draft = await createInventoryAdjustment(db, SCOPE, {
      docNo: 'ADJ-LOCKED', warehouseId: fx.warehouseId,
      adjustmentDate: '2026-06-30', reason: 'Cycle count',
      lines: [{ productId: fx.productId, countedQty: '8' }],
    });
    await expect(postInventoryAdjustment(db, SCOPE, draft.id))
      .rejects.toThrow('Accounting period June 2026 is locked.');
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(10);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);
    const [header] = await db.select({ status: inventoryAdjustment.status })
      .from(inventoryAdjustment).where(eq(inventoryAdjustment.id, draft.id));
    expect(header.status).toBe('draft');
  });
});
