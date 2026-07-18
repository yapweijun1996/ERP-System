import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  inventorySerial,
  product,
  stockLocationBalance,
  stockMovement,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  countMovements,
  getStockLocationQty,
  getStockQty,
  issueStock,
  receiveStock,
} from './stock';
import {
  createInventoryLot,
  createWarehouseBin,
  InventoryTrackingError,
  registerInventorySerial,
} from './tracking';

async function productAndWarehouse(db: DB, trackingType: 'none' | 'lot' | 'serial') {
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: `TRACK-${trackingType}`,
    name: `Tracked ${trackingType}`,
    trackingType,
  }).returning({ id: product.id });
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: `WH-${trackingType}`,
    name: `${trackingType} Warehouse`,
  }).returning({ id: warehouse.id });
  const bin = await createWarehouseBin(db, SCOPE, {
    warehouseId: location.id,
    code: 'A-01',
    name: 'Aisle A 01',
  });
  return { productId: item.id, warehouseId: location.id, binId: bin.id };
}

describe('inventory bin/lot/serial tracking', () => {
  it('keeps aggregate and lot/bin location projections in sync', async () => {
    const db = await freshDb();
    const fx = await productAndWarehouse(db, 'lot');
    const lot = await createInventoryLot(db, SCOPE, {
      productId: fx.productId,
      lotNo: 'LOT-2607-A',
      manufacturedDate: '2026-07-01',
      expiryDate: '2027-07-01',
    });

    await receiveStock(db, SCOPE, {
      ...fx,
      lotId: lot.id,
      qty: 5,
      refType: 'goods_receipt',
      refId: 10,
    });
    await issueStock(db, SCOPE, {
      ...fx,
      lotId: lot.id,
      qty: 2,
      refType: 'sales_order',
      refId: 20,
    });

    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(3);
    expect(await getStockLocationQty(
      db,
      SCOPE,
      fx.productId,
      fx.warehouseId,
      fx.binId,
      `lot:${lot.id}`,
    )).toBe(3);
    const movements = await db.select().from(stockMovement);
    expect(movements).toHaveLength(2);
    expect(movements.every((row) =>
      row.binId === fx.binId && row.lotId === lot.id && row.serialId == null)).toBe(true);
  });

  it('allows receiving a held lot but blocks every outbound issue', async () => {
    const db = await freshDb();
    const fx = await productAndWarehouse(db, 'lot');
    const lot = await createInventoryLot(db, SCOPE, {
      productId: fx.productId,
      lotNo: 'LOT-HOLD',
      qualityStatus: 'hold',
    });
    await receiveStock(db, SCOPE, { ...fx, lotId: lot.id, qty: 4 });
    await expect(issueStock(db, SCOPE, { ...fx, lotId: lot.id, qty: 1 }))
      .rejects.toThrow(InventoryTrackingError);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(4);
    expect(await countMovements(db, SCOPE, fx.productId, fx.warehouseId)).toBe(1);
  });

  it('enforces serial quantity one and a registered→available→issued lifecycle', async () => {
    const db = await freshDb();
    const fx = await productAndWarehouse(db, 'serial');
    const serial = await registerInventorySerial(db, SCOPE, {
      productId: fx.productId,
      serialNo: 'SN-0001',
    });
    await expect(receiveStock(db, SCOPE, { ...fx, serialId: serial.id, qty: 2 }))
      .rejects.toThrow(InventoryTrackingError);

    await receiveStock(db, SCOPE, { ...fx, serialId: serial.id, qty: 1 });
    let [serialRow] = await db.select().from(inventorySerial)
      .where(eq(inventorySerial.id, serial.id));
    expect(serialRow.status).toBe('available');
    await expect(receiveStock(db, SCOPE, { ...fx, serialId: serial.id, qty: 1 }))
      .rejects.toThrow(InventoryTrackingError);

    await issueStock(db, SCOPE, { ...fx, serialId: serial.id, qty: 1 });
    [serialRow] = await db.select().from(inventorySerial)
      .where(eq(inventorySerial.id, serial.id));
    expect(serialRow.status).toBe('issued');
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(0);
    const [balance] = await db.select().from(stockLocationBalance);
    expect(Number(balance.qty)).toBe(0);
    expect(await db.select().from(stockMovement)).toHaveLength(2);
  });

  it('rejects tracking data that does not match the product policy', async () => {
    const db = await freshDb();
    const fx = await productAndWarehouse(db, 'none');
    await expect(receiveStock(db, SCOPE, {
      ...fx,
      lotId: 999,
      qty: 1,
    })).rejects.toThrow(InventoryTrackingError);
    expect(await getStockQty(db, SCOPE, fx.productId, fx.warehouseId)).toBe(0);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
  });
});
