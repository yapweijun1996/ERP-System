import { describe, it, expect } from 'vitest';
import type { DB } from '../../data/db';
import { product, warehouse, stockLevel } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { issueStock, getStockQty, countMovements, InsufficientStockError } from './stock';

async function seedProductStock(db: DB, qty: number) {
  const [p] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'T-SKU', name: 'Test Product', uom: 'unit',
  }).returning({ id: product.id });
  const [w] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'T-WH', name: 'Test Warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, productId: p.id, warehouseId: w.id, qty: String(qty),
  });
  return { productId: p.id, warehouseId: w.id };
}

describe('issueStock', () => {
  it('deducts qty and records exactly one movement on success', async () => {
    const db = await freshDb();
    const { productId, warehouseId } = await seedProductStock(db, 10);

    const result = await issueStock(db, SCOPE, { productId, warehouseId, qty: 4 });

    expect(result.remaining).toBe(6);
    expect(await getStockQty(db, SCOPE, productId, warehouseId)).toBe(6);
    expect(await countMovements(db, SCOPE, productId, warehouseId)).toBe(1);
  });

  it('throws InsufficientStockError and changes nothing when qty exceeds on-hand', async () => {
    const db = await freshDb();
    const { productId, warehouseId } = await seedProductStock(db, 3);

    await expect(issueStock(db, SCOPE, { productId, warehouseId, qty: 10 }))
      .rejects.toThrow(InsufficientStockError);

    expect(await getStockQty(db, SCOPE, productId, warehouseId)).toBe(3);
    expect(await countMovements(db, SCOPE, productId, warehouseId)).toBe(0);
  });

  it('rejects a second issue that would take stock negative, after a first issue succeeds', async () => {
    const db = await freshDb();
    const { productId, warehouseId } = await seedProductStock(db, 5);

    await issueStock(db, SCOPE, { productId, warehouseId, qty: 5 });
    expect(await getStockQty(db, SCOPE, productId, warehouseId)).toBe(0);

    await expect(issueStock(db, SCOPE, { productId, warehouseId, qty: 1 }))
      .rejects.toThrow(InsufficientStockError);
    expect(await getStockQty(db, SCOPE, productId, warehouseId)).toBe(0);
  });

  it('allows issuing exactly the full on-hand quantity (boundary: qty === available)', async () => {
    const db = await freshDb();
    const { productId, warehouseId } = await seedProductStock(db, 7);

    const result = await issueStock(db, SCOPE, { productId, warehouseId, qty: 7 });

    expect(result.remaining).toBe(0);
    expect(await getStockQty(db, SCOPE, productId, warehouseId)).toBe(0);
  });
});
