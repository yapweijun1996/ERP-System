import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { product, stockLevel, stockMovement, warehouse } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { getStockQty } from './stock';
import {
  completeStockTransfer,
  createStockTransfer,
  InvalidStockTransferStateError,
} from './transfer';

async function fixture(db: DB) {
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'TRF-ITEM',
    name: 'Transfer Item',
  }).returning({ id: product.id });
  const locations = await db.insert(warehouse).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'A', name: 'Warehouse A' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'B', name: 'Warehouse B' },
  ]).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    productId: item.id,
    warehouseId: locations[0].id,
    qty: '20',
  });
  return {
    productId: item.id,
    fromWarehouseId: locations[0].id,
    toWarehouseId: locations[1].id,
  };
}

describe('stock transfer', () => {
  it('preserves total quantity and creates linked OUT/IN movement legs', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createStockTransfer(db, SCOPE, {
      docNo: 'TRF-1',
      fromWarehouseId: fx.fromWarehouseId,
      toWarehouseId: fx.toWarehouseId,
      transferDate: '2026-07-18',
      lines: [{ productId: fx.productId, qty: 7 }],
    });
    const completed = await completeStockTransfer(db, SCOPE, draft.id);
    expect(completed).toMatchObject({ status: 'completed', version: 2 });
    expect(completed.movementIds).toHaveLength(2);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.fromWarehouseId)).toBe(13);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.toWarehouseId)).toBe(7);
    const movements = await db.select().from(stockMovement);
    expect(movements.map((row) => row.direction).sort()).toEqual(['in', 'out']);
    expect(movements.every((row) =>
      row.refType === 'stock_transfer' && row.refId === draft.id)).toBe(true);
  });

  it('rolls back both legs when source stock is insufficient', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createStockTransfer(db, SCOPE, {
      docNo: 'TRF-2',
      fromWarehouseId: fx.fromWarehouseId,
      toWarehouseId: fx.toWarehouseId,
      transferDate: '2026-07-18',
      lines: [{ productId: fx.productId, qty: 25 }],
    });
    await expect(completeStockTransfer(db, SCOPE, draft.id)).rejects.toThrow('Insufficient stock');
    expect(await getStockQty(db, SCOPE, fx.productId, fx.fromWarehouseId)).toBe(20);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.toWarehouseId)).toBe(0);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
  });

  it('cannot complete the same transfer twice', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const draft = await createStockTransfer(db, SCOPE, {
      docNo: 'TRF-3',
      fromWarehouseId: fx.fromWarehouseId,
      toWarehouseId: fx.toWarehouseId,
      transferDate: '2026-07-18',
      lines: [{ productId: fx.productId, qty: 3 }],
    });
    await completeStockTransfer(db, SCOPE, draft.id);
    await expect(completeStockTransfer(db, SCOPE, draft.id))
      .rejects.toThrow(InvalidStockTransferStateError);
    expect(await db.select().from(stockMovement)).toHaveLength(2);
  });
});
