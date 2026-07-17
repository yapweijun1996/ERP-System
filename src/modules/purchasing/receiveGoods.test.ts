import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { product, warehouse, supplier, taxRule, purchaseOrder } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { getStockQty, countMovements } from '../inventory/stock';
import { createPurchaseOrder } from './createPurchaseOrder';
import { receiveGoods } from './receiveGoods';
import { InvalidPurchaseOrderStateError } from './errors';

async function seedOpenPurchaseOrder(db: DB, qty = 20) {
  const [widget] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'WIDGET', name: 'Widget', uom: 'unit',
  }).returning({ id: product.id });
  const [wh] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'WH', name: 'Main Warehouse',
  }).returning({ id: warehouse.id });
  const [sup] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'S1', name: 'Test Supplier',
  }).returning({ id: supplier.id });
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR',
    rate: '9.000', validFrom: '2024-01-01', validTo: null,
  });
  const po = await createPurchaseOrder(db, SCOPE, {
    docNo: 'PO-T1', supplierId: sup.id, orderDate: '2024-06-01', currency: 'SGD',
    lines: [{ productId: widget.id, qty, unitCost: 6, taxCode: 'SR' }],
  });
  return { widgetId: widget.id, warehouseId: wh.id, purchaseOrderId: po.orderId };
}

describe('receiveGoods', () => {
  it('success: creates stock_level from nothing, appends one movement per line, marks the PO received', async () => {
    const db = await freshDb();
    const fx = await seedOpenPurchaseOrder(db, 20);
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(0); // no stock_level row yet

    const res = await receiveGoods(db, SCOPE, {
      purchaseOrderId: fx.purchaseOrderId, warehouseId: fx.warehouseId,
      docNo: 'GR-T1', receivedDate: '2024-06-05',
    });

    expect(res.lines).toBe(1);
    expect(res.movementIds).toHaveLength(1);
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(20);
    expect(await countMovements(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(1);

    const [po] = await db.select({ status: purchaseOrder.status }).from(purchaseOrder)
      .where(and(eq(purchaseOrder.masterFn, SCOPE.masterFn), eq(purchaseOrder.companyFn, SCOPE.companyFn), eq(purchaseOrder.id, fx.purchaseOrderId)));
    expect(po.status).toBe('received');
  });

  it('adds to existing stock rather than overwriting it, when the warehouse already stocks the product', async () => {
    const db = await freshDb();
    const fx = await seedOpenPurchaseOrder(db, 20);
    // First receipt establishes on-hand = 20; confirm a SECOND, independent PO's receipt adds on top.
    await receiveGoods(db, SCOPE, { purchaseOrderId: fx.purchaseOrderId, warehouseId: fx.warehouseId, docNo: 'GR-T2A', receivedDate: '2024-06-05' });

    const [sup] = await db.select({ id: purchaseOrder.supplierId }).from(purchaseOrder)
      .where(and(eq(purchaseOrder.masterFn, SCOPE.masterFn), eq(purchaseOrder.companyFn, SCOPE.companyFn), eq(purchaseOrder.id, fx.purchaseOrderId)));
    const po2 = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T2B', supplierId: sup.id, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 5, unitCost: 6, taxCode: 'SR' }],
    });
    await receiveGoods(db, SCOPE, { purchaseOrderId: po2.orderId, warehouseId: fx.warehouseId, docNo: 'GR-T2B', receivedDate: '2024-06-06' });

    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(25);
    expect(await countMovements(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(2);
  });

  it('rollback: receiving an already-received PO throws and changes nothing (no double stock increase)', async () => {
    const db = await freshDb();
    const fx = await seedOpenPurchaseOrder(db, 20);
    await receiveGoods(db, SCOPE, { purchaseOrderId: fx.purchaseOrderId, warehouseId: fx.warehouseId, docNo: 'GR-T3A', receivedDate: '2024-06-05' });
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(20);

    await expect(receiveGoods(db, SCOPE, {
      purchaseOrderId: fx.purchaseOrderId, warehouseId: fx.warehouseId, docNo: 'GR-T3B', receivedDate: '2024-06-06',
    })).rejects.toThrow(InvalidPurchaseOrderStateError);

    // Still 20, not 40 — the second (invalid) receipt left no trace.
    expect(await getStockQty(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(20);
    expect(await countMovements(db, SCOPE, fx.widgetId, fx.warehouseId)).toBe(1);
  });
});
