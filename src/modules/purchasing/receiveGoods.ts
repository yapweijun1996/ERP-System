// Purchasing — receive goods: the purchasing-side mirror of inventory/stock.ts's
// issueStockWithin, but incrementing instead of decrementing. Receives EVERY line of
// a purchase order in one transaction (mirrors confirmOrder.ts's all-lines-at-once
// shape): stock_level goes up (created if this is the first stock ever for that
// product+warehouse), a stock_movement(direction='in') is appended per line, and the
// PO is marked 'received' so it cannot be received twice. Any failure (most notably
// receiving a PO that isn't 'open') rolls the whole receipt back — no partial stock
// increase. See docs/DATA_MODEL.md §4.
import { and, eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  goodsReceipt,
  product,
  purchaseOrder,
  purchaseOrderLine,
  stockLevel,
  warehouse,
} from '../../data/schema';
import { InvalidPurchaseOrderStateError, PostingError } from './errors';
import { receiveStockWithin } from '../inventory/stock';

export interface ReceiveGoodsInput {
  purchaseOrderId: number;
  warehouseId: number;
  docNo: string;
  receivedDate: string; // YYYY-MM-DD
}

export async function receiveGoodsWithin(exec: DB, scope: Scope, input: ReceiveGoodsInput) {
  const [order] = await exec
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
  const [location] = await exec.select({ id: warehouse.id }).from(warehouse).where(and(
    eq(warehouse.masterFn, scope.masterFn),
    eq(warehouse.companyFn, scope.companyFn),
    eq(warehouse.id, input.warehouseId),
  ));
  if (!location) {
    throw new PostingError(`Warehouse ${input.warehouseId} is not available in this company`);
  }

  const lines = await exec
    .select({
      productId: purchaseOrderLine.productId,
      qty: purchaseOrderLine.qty,
      netAmount: purchaseOrderLine.netAmount,
    })
    .from(purchaseOrderLine)
    .where(and(
      eq(purchaseOrderLine.masterFn, scope.masterFn),
      eq(purchaseOrderLine.companyFn, scope.companyFn),
      eq(purchaseOrderLine.orderId, order.id),
    ));

  const [receipt] = await exec.insert(goodsReceipt).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, orderId: order.id, warehouseId: input.warehouseId,
    receivedDate: input.receivedDate,
  }).returning({ id: goodsReceipt.id });

  const movementIds: number[] = [];
  for (const ln of lines) {
    const [costedProduct] = await exec.select({
      id: product.id,
      standardCost: product.standardCost,
      averageCost: product.averageCost,
    }).from(product).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      eq(product.id, ln.productId),
    )).for('update');
    if (!costedProduct) throw new PostingError(`Product ${ln.productId} is not available in this company`);
    const currentBalances = await exec.select({ qty: stockLevel.qty }).from(stockLevel).where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, ln.productId),
    )).for('update');
    const currentQty = currentBalances.reduce(
      (sum, row) => sum.plus(row.qty), new Decimal(0),
    );
    const receivedQty = new Decimal(ln.qty);
    const qty = receivedQty.toNumber();
    const received = await receiveStockWithin(exec, scope, {
      productId: ln.productId,
      warehouseId: input.warehouseId,
      qty,
      refType: 'goods_receipt',
      refId: receipt.id,
      movementGroup: `goods_receipt:${receipt.id}`,
    });
    movementIds.push(received.movementId);
    const before = new Decimal(costedProduct.averageCost ?? costedProduct.standardCost);
    const newQty = currentQty.plus(receivedQty);
    const newAverage = currentQty.mul(before).plus(ln.netAmount)
      .div(newQty).toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
    await exec.update(product).set({
      averageCost: newAverage.toFixed(8),
      version: sql`${product.version} + 1`,
      updatedAt: sql`now()`,
    }).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      eq(product.id, ln.productId),
    ));
  }

  await exec.update(purchaseOrder).set({ status: 'received', updatedAt: sql`now()` })
    .where(eq(purchaseOrder.id, order.id));

  return { receiptId: receipt.id, lines: lines.length, movementIds };
}

export async function receiveGoods(db: DB, scope: Scope, input: ReceiveGoodsInput) {
  return db.transaction((tx) => receiveGoodsWithin(tx, scope, input));
}
