import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  product,
  stockMovement,
  stockLevel,
  stockReservation,
  warehouse,
  warehouseBin,
  warehousePick,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { getStockQty, setStockQtyForFixture } from '../inventory/stock';
import {
  completeWarehousePickWithin,
  createWarehousePick,
  recordWarehousePickWithin,
  WarehousePickError,
} from './picking';

async function fixture(db: DB) {
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'PICK-ITEM',
    name: 'Pick Item',
    uom: 'box',
  }).returning({ id: product.id });
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'PICK-WH',
    name: 'Picking Warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    productId: item.id,
    warehouseId: location.id,
    qty: '0',
  });
  await setStockQtyForFixture(db, SCOPE, item.id, location.id, 10);
  const [bin] = await db.select({ id: warehouseBin.id }).from(warehouseBin).where(and(
    eq(warehouseBin.masterFn, SCOPE.masterFn),
    eq(warehouseBin.companyFn, SCOPE.companyFn),
    eq(warehouseBin.warehouseId, location.id),
  ));
  return { productId: item.id, warehouseId: location.id, binId: bin.id };
}

describe('warehouse picking', () => {
  it('reserves, records and atomically issues a completed pick', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const pick = await createWarehousePick(db, SCOPE, {
      docNo: 'PICK-1',
      warehouseId: fx.warehouseId,
      pickDate: '2026-07-19',
      assignee: 'Warehouse operator',
      lines: [{ productId: fx.productId, binId: fx.binId, qty: 4 }],
    });
    expect(pick.lines).toHaveLength(1);
    expect(await db.select().from(stockReservation)).toMatchObject([
      { pickId: pick.id, qty: '4.0000', status: 'active' },
    ]);

    await db.transaction((tx) => recordWarehousePickWithin(tx, SCOPE, {
      pickId: pick.id,
      lineId: pick.lines[0].id,
      qty: 4,
    }));
    const completed = await db.transaction((tx) =>
      completeWarehousePickWithin(tx, SCOPE, pick.id));

    expect(completed).toMatchObject({ pickId: pick.id, status: 'picked' });
    expect(completed.movementIds).toHaveLength(1);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(6);
    expect(await db.select().from(stockMovement)).toMatchObject([
      { direction: 'out', refType: 'warehouse_pick', refId: pick.id, qty: '4.0000' },
    ]);
    expect(await db.select().from(stockReservation)).toMatchObject([
      { status: 'consumed' },
    ]);
  });

  it('prevents over-reservation and incomplete completion without changing stock', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const pick = await createWarehousePick(db, SCOPE, {
      docNo: 'PICK-2',
      warehouseId: fx.warehouseId,
      pickDate: '2026-07-19',
      lines: [{ productId: fx.productId, binId: fx.binId, qty: 7 }],
    });
    await expect(createWarehousePick(db, SCOPE, {
      docNo: 'PICK-OVER',
      warehouseId: fx.warehouseId,
      pickDate: '2026-07-19',
      lines: [{ productId: fx.productId, binId: fx.binId, qty: 4 }],
    })).rejects.toThrow('Insufficient unreserved stock');

    await db.transaction((tx) => recordWarehousePickWithin(tx, SCOPE, {
      pickId: pick.id,
      lineId: pick.lines[0].id,
      qty: 2,
    }));
    await expect(db.transaction((tx) =>
      completeWarehousePickWithin(tx, SCOPE, pick.id)))
      .rejects.toThrow('fully picked');
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(10);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
  });

  it('cannot complete the same pick twice', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const pick = await createWarehousePick(db, SCOPE, {
      docNo: 'PICK-3',
      warehouseId: fx.warehouseId,
      pickDate: '2026-07-19',
      lines: [{ productId: fx.productId, binId: fx.binId, qty: 2 }],
    });
    await db.transaction((tx) => recordWarehousePickWithin(tx, SCOPE, {
      pickId: pick.id,
      lineId: pick.lines[0].id,
      qty: 2,
    }));
    await db.transaction((tx) => completeWarehousePickWithin(tx, SCOPE, pick.id));
    await expect(db.transaction((tx) =>
      completeWarehousePickWithin(tx, SCOPE, pick.id)))
      .rejects.toThrow(WarehousePickError);
    expect(await db.select().from(stockMovement)).toHaveLength(1);
    expect((await db.select().from(warehousePick))[0].status).toBe('picked');
  });
});
