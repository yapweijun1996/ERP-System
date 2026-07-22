import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
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
} from '../../data/schema';

export class LandedCostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LandedCostError';
  }
}

export interface CreateLandedCostInput {
  docNo: string;
  goodsReceiptId: number;
  costDate: string;
  allocationBasis: 'value' | 'quantity';
  freightAmount?: string | number;
  dutyAmount?: string | number;
  handlingAmount?: string | number;
  otherAmount?: string | number;
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new LandedCostError(`${label} is required.`);
  return normalized;
}

function nonnegative(value: string | number | undefined, label: string) {
  let amount: Decimal;
  try { amount = new Decimal(value ?? 0); } catch {
    throw new LandedCostError(`${label} must be a valid decimal.`);
  }
  if (!amount.isFinite() || amount.lt(0)) {
    throw new LandedCostError(`${label} cannot be negative.`);
  }
  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Allocate whole currency cents with largest remainders. This avoids both floating
 * point drift and the "last line goes negative" bug a repeated round-half-up strategy
 * can create when many small lines share one cent. */
function allocateCurrency(total: Decimal, weights: Decimal[]) {
  const denominator = weights.reduce((sum, value) => sum.plus(value), new Decimal(0));
  if (denominator.lte(0)) throw new LandedCostError('Allocation basis total must be greater than zero.');
  const totalCents = BigInt(total.mul(100).toFixed(0));
  const raw = weights.map((weight, index) => {
    const exact = new Decimal(totalCents.toString()).mul(weight).div(denominator);
    const floor = BigInt(exact.floor().toFixed(0));
    return { index, floor, remainder: exact.minus(floor.toString()) };
  });
  let remaining = totalCents - raw.reduce((sum, row) => sum + row.floor, 0n);
  const ranked = [...raw].sort((a, b) => {
    const byRemainder = b.remainder.comparedTo(a.remainder);
    return byRemainder || a.index - b.index;
  });
  for (let i = 0; remaining > 0n; i += 1, remaining -= 1n) {
    ranked[i % ranked.length].floor += 1n;
  }
  return raw
    .sort((a, b) => a.index - b.index)
    .map((row) => new Decimal(row.floor.toString()).div(100));
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new LandedCostError(`Account ${code} is not configured.`);
  return row.id;
}

export async function createLandedCostWithin(exec: DB, scope: Scope, input: CreateLandedCostInput) {
  const docNo = required(input.docNo, 'Landed cost number');
  if (!Number.isSafeInteger(input.goodsReceiptId) || input.goodsReceiptId <= 0) {
    throw new LandedCostError('goodsReceiptId must be a positive integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.costDate)) {
    throw new LandedCostError('costDate must use YYYY-MM-DD.');
  }
  if (input.allocationBasis !== 'value' && input.allocationBasis !== 'quantity') {
    throw new LandedCostError('allocationBasis must be value or quantity.');
  }
  const freight = nonnegative(input.freightAmount, 'freightAmount');
  const duty = nonnegative(input.dutyAmount, 'dutyAmount');
  const handling = nonnegative(input.handlingAmount, 'handlingAmount');
  const other = nonnegative(input.otherAmount, 'otherAmount');
  const totalAdded = freight.plus(duty).plus(handling).plus(other);
  if (totalAdded.lte(0)) throw new LandedCostError('At least one landed-cost component is required.');

  const [receipt] = await exec.select({
    id: goodsReceipt.id,
    orderId: goodsReceipt.orderId,
  }).from(goodsReceipt).where(and(
    eq(goodsReceipt.masterFn, scope.masterFn),
    eq(goodsReceipt.companyFn, scope.companyFn),
    eq(goodsReceipt.id, input.goodsReceiptId),
  ));
  if (!receipt) throw new LandedCostError('Goods receipt is unavailable in this company.');
  const [order] = await exec.select({
    id: purchaseOrder.id,
    supplierId: purchaseOrder.supplierId,
    status: purchaseOrder.status,
    currency: purchaseOrder.currency,
  }).from(purchaseOrder).where(and(
    eq(purchaseOrder.masterFn, scope.masterFn),
    eq(purchaseOrder.companyFn, scope.companyFn),
    eq(purchaseOrder.id, receipt.orderId),
  ));
  if (!order || order.status !== 'received') {
    throw new LandedCostError('Landed cost requires a received purchase order.');
  }
  const sourceLines = await exec.select({
    id: purchaseOrderLine.id,
    lineNo: purchaseOrderLine.lineNo,
    productId: purchaseOrderLine.productId,
    qty: purchaseOrderLine.qty,
    goodsValue: purchaseOrderLine.netAmount,
  }).from(purchaseOrderLine).where(and(
    eq(purchaseOrderLine.masterFn, scope.masterFn),
    eq(purchaseOrderLine.companyFn, scope.companyFn),
    eq(purchaseOrderLine.orderId, order.id),
  )).orderBy(asc(purchaseOrderLine.lineNo));
  if (!sourceLines.length) throw new LandedCostError('The received order has no lines to allocate.');

  const goodsValue = sourceLines.reduce(
    (sum, line) => sum.plus(line.goodsValue), new Decimal(0),
  ).toDecimalPlaces(2);
  if (goodsValue.lte(0)) throw new LandedCostError('The received goods value must be greater than zero.');
  const weights = sourceLines.map((line) => new Decimal(
    input.allocationBasis === 'value' ? line.goodsValue : line.qty,
  ));
  const allocated = allocateCurrency(totalAdded, weights);

  const [created] = await exec.insert(landedCost).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    goodsReceiptId: receipt.id,
    orderId: order.id,
    supplierId: order.supplierId,
    costDate: input.costDate,
    currency: order.currency,
    allocationBasis: input.allocationBasis,
    goodsValue: goodsValue.toFixed(2),
    freightAmount: freight.toFixed(2),
    dutyAmount: duty.toFixed(2),
    handlingAmount: handling.toFixed(2),
    otherAmount: other.toFixed(2),
    totalAddedCost: totalAdded.toFixed(2),
  }).returning({
    id: landedCost.id,
    docNo: landedCost.docNo,
    status: landedCost.status,
    version: landedCost.version,
    goodsValue: landedCost.goodsValue,
    totalAddedCost: landedCost.totalAddedCost,
  });
  await exec.insert(landedCostLine).values(sourceLines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    landedCostId: created.id,
    lineNo: line.lineNo,
    purchaseOrderLineId: line.id,
    productId: line.productId,
    receivedQty: line.qty,
    goodsValue: new Decimal(line.goodsValue).toFixed(2),
    allocatedAmount: allocated[index].toFixed(2),
  })));
  return { ...created, lines: sourceLines.length };
}

export async function allocateLandedCostWithin(exec: DB, scope: Scope, landedCostId: number) {
  const [header] = await exec.select().from(landedCost).where(and(
    eq(landedCost.masterFn, scope.masterFn),
    eq(landedCost.companyFn, scope.companyFn),
    eq(landedCost.id, landedCostId),
  )).for('update');
  if (!header || header.status !== 'draft') {
    throw new LandedCostError('Only a draft landed cost can be allocated.');
  }
  const lines = await exec.select().from(landedCostLine).where(and(
    eq(landedCostLine.masterFn, scope.masterFn),
    eq(landedCostLine.companyFn, scope.companyFn),
    eq(landedCostLine.landedCostId, header.id),
  )).orderBy(asc(landedCostLine.lineNo)).for('update');
  if (!lines.length) throw new LandedCostError('The landed cost has no allocation lines.');
  const lineTotal = lines.reduce(
    (sum, line) => sum.plus(line.allocatedAmount), new Decimal(0),
  );
  if (!lineTotal.eq(header.totalAddedCost)) {
    throw new LandedCostError('Allocation lines do not equal the landed-cost total.');
  }

  const productIds = [...new Set(lines.map((line) => line.productId))];
  const products = await exec.select({
    id: product.id,
    standardCost: product.standardCost,
    averageCost: product.averageCost,
  }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    inArray(product.id, productIds),
  )).for('update');
  if (products.length !== productIds.length) {
    throw new LandedCostError('An allocated product is unavailable in this company.');
  }
  const balances = await exec.select({
    productId: stockLevel.productId,
    qty: stockLevel.qty,
  }).from(stockLevel).where(and(
    eq(stockLevel.masterFn, scope.masterFn),
    eq(stockLevel.companyFn, scope.companyFn),
    inArray(stockLevel.productId, productIds),
  )).for('update');
  const qtyByProduct = new Map<number, Decimal>();
  balances.forEach((row) => qtyByProduct.set(
    row.productId,
    (qtyByProduct.get(row.productId) ?? new Decimal(0)).plus(row.qty),
  ));
  const allocationByProduct = new Map<number, Decimal>();
  lines.forEach((line) => allocationByProduct.set(
    line.productId,
    (allocationByProduct.get(line.productId) ?? new Decimal(0)).plus(line.allocatedAmount),
  ));

  for (const item of products) {
    const onHand = qtyByProduct.get(item.id) ?? new Decimal(0);
    if (onHand.lte(0)) {
      throw new LandedCostError(`Product ${item.id} has no on-hand quantity to revalue.`);
    }
    const before = new Decimal(item.averageCost ?? item.standardCost);
    const allocated = allocationByProduct.get(item.id) ?? new Decimal(0);
    const after = before.plus(allocated.div(onHand)).toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
    await exec.update(product).set({
      averageCost: after.toFixed(8),
      version: sql`${product.version} + 1`,
      updatedAt: sql`now()`,
    }).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      eq(product.id, item.id),
    ));
    await exec.update(landedCostLine).set({
      onHandQtyAtAllocation: onHand.toFixed(4),
      averageCostBefore: before.toFixed(8),
      averageCostAfter: after.toFixed(8),
      updatedAt: sql`now()`,
    }).where(and(
      eq(landedCostLine.masterFn, scope.masterFn),
      eq(landedCostLine.companyFn, scope.companyFn),
      eq(landedCostLine.landedCostId, header.id),
      eq(landedCostLine.productId, item.id),
    ));
  }

  const inventoryId = await accountId(exec, scope, '1400');
  const accrualId = await accountId(exec, scope, '2300');
  await exec.insert(glEntry).values([
    {
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      journalRef: header.docNo,
      accountId: inventoryId,
      debit: header.totalAddedCost,
      credit: '0',
      memo: 'Capitalized landed cost',
    },
    {
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      journalRef: header.docNo,
      accountId: accrualId,
      debit: '0',
      credit: header.totalAddedCost,
      memo: 'Landed cost accrual',
    },
  ]);
  const [allocated] = await exec.update(landedCost).set({
    status: 'allocated',
    version: sql`${landedCost.version} + 1`,
    allocatedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(landedCost.masterFn, scope.masterFn),
    eq(landedCost.companyFn, scope.companyFn),
    eq(landedCost.id, header.id),
  )).returning({
    landedCostId: landedCost.id,
    status: landedCost.status,
    version: landedCost.version,
    totalAddedCost: landedCost.totalAddedCost,
  });
  return allocated;
}

export function createLandedCost(db: DB, scope: Scope, input: CreateLandedCostInput) {
  return db.transaction((tx) => createLandedCostWithin(tx, scope, input));
}

export function allocateLandedCost(db: DB, scope: Scope, landedCostId: number) {
  return db.transaction((tx) => allocateLandedCostWithin(tx, scope, landedCostId));
}
