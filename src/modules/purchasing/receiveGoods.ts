// Purchasing — receive goods: the purchasing-side mirror of inventory/stock.ts's
// issueStockWithin, but incrementing instead of decrementing. Receives EVERY line of
// a purchase order in one transaction (mirrors confirmOrder.ts's all-lines-at-once
// shape): stock_level goes up (created if this is the first stock ever for that
// product+warehouse), a stock_movement(direction='in') is appended per line, and the
// PO is marked 'received' so it cannot be received twice. Any failure (most notably
// receiving a PO that isn't 'open') rolls the whole receipt back — no partial stock
// increase. See docs/DATA_MODEL.md §4.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { goodsReceipt, purchaseOrder, purchaseOrderLine, stockLevel, stockMovement } from '../../data/schema';
import { InvalidPurchaseOrderStateError } from './errors';

export interface ReceiveGoodsInput {
  purchaseOrderId: number;
  warehouseId: number;
  docNo: string;
  receivedDate: string; // YYYY-MM-DD
}

export async function receiveGoods(db: DB, scope: Scope, input: ReceiveGoodsInput) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: purchaseOrder.id, status: purchaseOrder.status })
      .from(purchaseOrder)
      .where(and(
        eq(purchaseOrder.masterFn, scope.masterFn),
        eq(purchaseOrder.companyFn, scope.companyFn),
        eq(purchaseOrder.id, input.purchaseOrderId),
      ))
      .for('update'); // row lock: a concurrent receipt attempt waits here until we commit

    if (!order) throw new InvalidPurchaseOrderStateError(`Purchase order ${input.purchaseOrderId} not found`);
    if (order.status !== 'open') {
      throw new InvalidPurchaseOrderStateError(
        `Purchase order ${input.purchaseOrderId} is '${order.status}', not 'open' — cannot receive goods twice`,
      ); // → ROLLBACK
    }

    const lines = await tx
      .select({ productId: purchaseOrderLine.productId, qty: purchaseOrderLine.qty })
      .from(purchaseOrderLine)
      .where(and(
        eq(purchaseOrderLine.masterFn, scope.masterFn),
        eq(purchaseOrderLine.companyFn, scope.companyFn),
        eq(purchaseOrderLine.orderId, order.id),
      ));

    const [receipt] = await tx.insert(goodsReceipt).values({
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      docNo: input.docNo, orderId: order.id, warehouseId: input.warehouseId,
      receivedDate: input.receivedDate,
    }).returning({ id: goodsReceipt.id });

    const movementIds: number[] = [];
    for (const ln of lines) {
      const qty = Number(ln.qty);

      await tx.insert(stockLevel)
        .values({
          masterFn: scope.masterFn, companyFn: scope.companyFn,
          productId: ln.productId, warehouseId: input.warehouseId, qty: String(qty),
        })
        .onConflictDoUpdate({
          target: [stockLevel.masterFn, stockLevel.companyFn, stockLevel.productId, stockLevel.warehouseId],
          set: { qty: sql`${stockLevel.qty} + ${qty}`, updatedAt: sql`now()` },
        });

      const [mv] = await tx.insert(stockMovement).values({
        masterFn: scope.masterFn, companyFn: scope.companyFn,
        productId: ln.productId, warehouseId: input.warehouseId,
        qty: String(qty), direction: 'in', refType: 'goods_receipt', refId: receipt.id,
      }).returning({ id: stockMovement.id });
      movementIds.push(mv.id);
    }

    await tx.update(purchaseOrder).set({ status: 'received', updatedAt: sql`now()` })
      .where(eq(purchaseOrder.id, order.id));

    return { receiptId: receipt.id, lines: lines.length, movementIds };
  });
}
