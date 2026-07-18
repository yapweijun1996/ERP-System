import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  product,
  stockLocationBalance,
  stockReservation,
  warehouse,
  warehouseBin,
  warehousePick,
  warehousePickLine,
} from '../../data/schema';
import { issueStockWithin } from '../inventory/stock';

export class WarehousePickError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WarehousePickError';
  }
}

export interface CreateWarehousePickInput {
  docNo: string;
  warehouseId: number;
  salesOrderId?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignee?: string;
  pickDate: string;
  lines: Array<{
    productId: number;
    binId: number;
    qty: number;
  }>;
}

export interface RecordPickInput {
  pickId: number;
  lineId: number;
  qty: number;
}

function assertScope(scope: Scope): void {
  if (!scope.masterFn || !scope.companyFn) {
    throw new WarehousePickError('Tenant scope is required');
  }
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function createWarehousePickWithin(
  tx: DB,
  scope: Scope,
  input: CreateWarehousePickInput,
) {
  assertScope(scope);
  if (
    typeof input.docNo !== 'string'
    || !input.docNo.trim()
    || !Number.isSafeInteger(input.warehouseId)
    || input.warehouseId <= 0
    || !validDate(input.pickDate)
    || !Array.isArray(input.lines)
    || input.lines.length === 0
  ) {
    throw new WarehousePickError(
      'docNo, warehouseId, pickDate and at least one pick line are required',
    );
  }
  if (input.lines.some((line) =>
    !Number.isSafeInteger(line.productId)
    || line.productId <= 0
    || !Number.isSafeInteger(line.binId)
    || line.binId <= 0
    || !Number.isFinite(line.qty)
    || line.qty <= 0
  )) {
    throw new WarehousePickError('Every pick line requires a product, bin and positive quantity');
  }
  const uniqueKeys = new Set(input.lines.map((line) => `${line.productId}:${line.binId}`));
  if (uniqueKeys.size !== input.lines.length) {
    throw new WarehousePickError('Duplicate product/bin pick lines are not allowed');
  }

  const [location] = await tx.select({ id: warehouse.id })
    .from(warehouse)
    .where(and(
      eq(warehouse.id, input.warehouseId),
      eq(warehouse.masterFn, scope.masterFn),
      eq(warehouse.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!location) throw new WarehousePickError('Warehouse does not belong to the active company');

  const productIds = input.lines.map((line) => line.productId);
  const binIds = input.lines.map((line) => line.binId);
  const products = await tx.select({
    id: product.id,
    uom: product.uom,
    trackingType: product.trackingType,
  }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    inArray(product.id, productIds),
  ));
  const bins = await tx.select({
    id: warehouseBin.id,
    warehouseId: warehouseBin.warehouseId,
    isActive: warehouseBin.isActive,
  }).from(warehouseBin).where(and(
    eq(warehouseBin.masterFn, scope.masterFn),
    eq(warehouseBin.companyFn, scope.companyFn),
    inArray(warehouseBin.id, binIds),
  ));
  const productById = new Map(products.map((row) => [row.id, row]));
  const binById = new Map(bins.map((row) => [row.id, row]));

  const orderedLines = input.lines.map((line, index) => {
    const item = productById.get(line.productId);
    const bin = binById.get(line.binId);
    if (!item) throw new WarehousePickError(`Product ${line.productId} does not belong to the active company`);
    if (item.trackingType !== 'none') {
      throw new WarehousePickError('Lot/serial picks require explicit tracking selection');
    }
    if (!bin || bin.warehouseId !== input.warehouseId || !bin.isActive) {
      throw new WarehousePickError(`Bin ${line.binId} is not active in the selected warehouse`);
    }
    return { ...line, lineNo: index + 1, uom: item.uom };
  }).sort((a, b) => a.productId - b.productId || a.binId - b.binId);

  for (const line of orderedLines) {
    const [balance] = await tx.select({
      qty: stockLocationBalance.qty,
    }).from(stockLocationBalance).where(and(
      eq(stockLocationBalance.masterFn, scope.masterFn),
      eq(stockLocationBalance.companyFn, scope.companyFn),
      eq(stockLocationBalance.productId, line.productId),
      eq(stockLocationBalance.warehouseId, input.warehouseId),
      eq(stockLocationBalance.binId, line.binId),
      eq(stockLocationBalance.trackingKey, 'none'),
    )).for('update');
    const [reserved] = await tx.select({
      qty: sql<string>`coalesce(sum(${stockReservation.qty}), 0)`,
    }).from(stockReservation).where(and(
      eq(stockReservation.masterFn, scope.masterFn),
      eq(stockReservation.companyFn, scope.companyFn),
      eq(stockReservation.productId, line.productId),
      eq(stockReservation.warehouseId, input.warehouseId),
      eq(stockReservation.binId, line.binId),
      eq(stockReservation.status, 'active'),
    ));
    const available = Number(balance?.qty ?? 0) - Number(reserved?.qty ?? 0);
    if (available < line.qty) {
      throw new WarehousePickError(
        `Insufficient unreserved stock for product ${line.productId}: have ${available}, need ${line.qty}`,
      );
    }
  }

  const [header] = await tx.insert(warehousePick).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: input.docNo.trim(),
    warehouseId: input.warehouseId,
    salesOrderId: input.salesOrderId ?? null,
    priority: input.priority ?? 'normal',
    assignee: input.assignee?.trim() || null,
    pickDate: input.pickDate,
  }).returning({
    id: warehousePick.id,
    docNo: warehousePick.docNo,
    status: warehousePick.status,
    version: warehousePick.version,
  });

  const createdLines = [];
  for (const line of orderedLines.sort((a, b) => a.lineNo - b.lineNo)) {
    const [created] = await tx.insert(warehousePickLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      pickId: header.id,
      lineNo: line.lineNo,
      productId: line.productId,
      binId: line.binId,
      requiredQty: String(line.qty),
      pickedQty: '0',
      uom: line.uom,
    }).returning({
      id: warehousePickLine.id,
      lineNo: warehousePickLine.lineNo,
      productId: warehousePickLine.productId,
      binId: warehousePickLine.binId,
      requiredQty: warehousePickLine.requiredQty,
      pickedQty: warehousePickLine.pickedQty,
      uom: warehousePickLine.uom,
    });
    await tx.insert(stockReservation).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      pickId: header.id,
      pickLineId: created.id,
      productId: line.productId,
      warehouseId: input.warehouseId,
      binId: line.binId,
      qty: String(line.qty),
      status: 'active',
    });
    createdLines.push(created);
  }
  return { ...header, lines: createdLines };
}

export function createWarehousePick(
  db: DB,
  scope: Scope,
  input: CreateWarehousePickInput,
) {
  return db.transaction((tx) => createWarehousePickWithin(tx, scope, input));
}

export async function recordWarehousePickWithin(
  tx: DB,
  scope: Scope,
  input: RecordPickInput,
) {
  assertScope(scope);
  if (
    !Number.isSafeInteger(input.pickId)
    || input.pickId <= 0
    || !Number.isSafeInteger(input.lineId)
    || input.lineId <= 0
    || !Number.isFinite(input.qty)
    || input.qty <= 0
  ) {
    throw new WarehousePickError('pickId, lineId and a positive quantity are required');
  }
  const [header] = await tx.select({
    id: warehousePick.id,
    status: warehousePick.status,
  }).from(warehousePick).where(and(
    eq(warehousePick.id, input.pickId),
    eq(warehousePick.masterFn, scope.masterFn),
    eq(warehousePick.companyFn, scope.companyFn),
  )).for('update');
  if (!header) throw new WarehousePickError('Pick task was not found');
  if (!['open', 'in_progress'].includes(header.status)) {
    throw new WarehousePickError(`Pick task is ${header.status} and cannot be changed`);
  }
  const [line] = await tx.select({
    id: warehousePickLine.id,
    requiredQty: warehousePickLine.requiredQty,
    pickedQty: warehousePickLine.pickedQty,
  }).from(warehousePickLine).where(and(
    eq(warehousePickLine.id, input.lineId),
    eq(warehousePickLine.pickId, header.id),
    eq(warehousePickLine.masterFn, scope.masterFn),
    eq(warehousePickLine.companyFn, scope.companyFn),
  )).for('update');
  if (!line) throw new WarehousePickError('Pick line was not found');
  const next = Number(line.pickedQty) + input.qty;
  if (next > Number(line.requiredQty)) {
    throw new WarehousePickError('Picked quantity cannot exceed the required quantity');
  }
  await tx.update(warehousePickLine).set({
    pickedQty: String(next),
    updatedAt: sql`now()`,
  }).where(eq(warehousePickLine.id, line.id));
  await tx.update(warehousePick).set({
    status: 'in_progress',
    version: sql`${warehousePick.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(warehousePick.id, header.id));
  return {
    pickId: header.id,
    lineId: line.id,
    pickedQty: String(next),
    requiredQty: line.requiredQty,
  };
}

export async function completeWarehousePickWithin(
  tx: DB,
  scope: Scope,
  pickId: number,
) {
  assertScope(scope);
  if (!Number.isSafeInteger(pickId) || pickId <= 0) {
    throw new WarehousePickError('pickId must be a positive integer');
  }
  const [header] = await tx.select({
    id: warehousePick.id,
    status: warehousePick.status,
    warehouseId: warehousePick.warehouseId,
  }).from(warehousePick).where(and(
    eq(warehousePick.id, pickId),
    eq(warehousePick.masterFn, scope.masterFn),
    eq(warehousePick.companyFn, scope.companyFn),
  )).for('update');
  if (!header) throw new WarehousePickError('Pick task was not found');
  if (!['open', 'in_progress'].includes(header.status)) {
    throw new WarehousePickError(`Pick task is already ${header.status}`);
  }
  const lines = await tx.select({
    id: warehousePickLine.id,
    productId: warehousePickLine.productId,
    binId: warehousePickLine.binId,
    requiredQty: warehousePickLine.requiredQty,
    pickedQty: warehousePickLine.pickedQty,
  }).from(warehousePickLine).where(and(
    eq(warehousePickLine.pickId, header.id),
    eq(warehousePickLine.masterFn, scope.masterFn),
    eq(warehousePickLine.companyFn, scope.companyFn),
  )).orderBy(warehousePickLine.productId, warehousePickLine.binId).for('update');
  if (!lines.length) throw new WarehousePickError('Pick task has no lines');
  if (lines.some((line) => Number(line.pickedQty) !== Number(line.requiredQty))) {
    throw new WarehousePickError('Every line must be fully picked before completion');
  }

  const movementIds: number[] = [];
  for (const line of lines) {
    const result = await issueStockWithin(tx, scope, {
      productId: line.productId,
      warehouseId: header.warehouseId,
      binId: line.binId,
      qty: Number(line.requiredQty),
      refType: 'warehouse_pick',
      refId: header.id,
      movementGroup: `warehouse-pick:${header.id}`,
    });
    movementIds.push(result.movementId);
  }
  await tx.update(stockReservation).set({
    status: 'consumed',
    updatedAt: sql`now()`,
  }).where(and(
    eq(stockReservation.masterFn, scope.masterFn),
    eq(stockReservation.companyFn, scope.companyFn),
    eq(stockReservation.pickId, header.id),
    eq(stockReservation.status, 'active'),
  ));
  await tx.update(warehousePick).set({
    status: 'picked',
    version: sql`${warehousePick.version} + 1`,
    completedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(warehousePick.id, header.id));
  return { pickId: header.id, status: 'picked', movementIds };
}
