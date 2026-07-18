import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  product,
  stockLevel,
  stockTransfer,
  stockTransferLine,
  warehouse,
} from '../../data/schema';
import { fixedString, fixedUnits } from './decimal';
import { issueStockWithin, receiveStockWithin } from './stock';

export class StockTransferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockTransferValidationError';
  }
}

export class InvalidStockTransferStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStockTransferStateError';
  }
}

export interface CreateStockTransferInput {
  docNo: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  transferDate: string;
  reference?: string | null;
  lines: Array<{ productId: number; qty: string | number }>;
}

export async function createStockTransferWithin(
  exec: DB,
  scope: Scope,
  input: CreateStockTransferInput,
) {
  if (!input.docNo?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.transferDate)) {
    throw new StockTransferValidationError('docNo and a valid transferDate are required');
  }
  if (
    !Number.isSafeInteger(input.fromWarehouseId)
    || !Number.isSafeInteger(input.toWarehouseId)
    || input.fromWarehouseId <= 0
    || input.toWarehouseId <= 0
    || input.fromWarehouseId === input.toWarehouseId
  ) {
    throw new StockTransferValidationError('Source and destination warehouses must be different');
  }
  if (!Array.isArray(input.lines) || !input.lines.length) {
    throw new StockTransferValidationError('At least one transfer line is required');
  }
  const locations = await exec.select({ id: warehouse.id }).from(warehouse).where(and(
    eq(warehouse.masterFn, scope.masterFn),
    eq(warehouse.companyFn, scope.companyFn),
    inArray(warehouse.id, [input.fromWarehouseId, input.toWarehouseId]),
  ));
  if (locations.length !== 2) {
    throw new StockTransferValidationError('Both warehouses must exist in this company');
  }
  const ids = new Set<number>();
  for (const line of input.lines) {
    if (
      !Number.isSafeInteger(line.productId)
      || line.productId <= 0
      || ids.has(line.productId)
      || fixedUnits(line.qty) <= 0n
    ) {
      throw new StockTransferValidationError('Lines require unique products and positive quantities');
    }
    ids.add(line.productId);
  }
  const items = await exec.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    inArray(product.id, [...ids]),
  ));
  if (items.length !== ids.size) {
    throw new StockTransferValidationError('Every product must exist in this company');
  }

  const [header] = await exec.insert(stockTransfer).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: input.docNo.trim(),
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    transferDate: input.transferDate,
    reference: input.reference?.trim() || null,
  }).returning({
    id: stockTransfer.id,
    docNo: stockTransfer.docNo,
    status: stockTransfer.status,
    version: stockTransfer.version,
  });
  await exec.insert(stockTransferLine).values(input.lines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    transferId: header.id,
    lineNo: index + 1,
    productId: line.productId,
    qty: fixedString(fixedUnits(line.qty)),
  })));
  return { ...header, lines: input.lines.length };
}

export async function completeStockTransferWithin(exec: DB, scope: Scope, transferId: number) {
  const [header] = await exec.select({
    id: stockTransfer.id,
    docNo: stockTransfer.docNo,
    status: stockTransfer.status,
    version: stockTransfer.version,
    fromWarehouseId: stockTransfer.fromWarehouseId,
    toWarehouseId: stockTransfer.toWarehouseId,
  }).from(stockTransfer).where(and(
    eq(stockTransfer.masterFn, scope.masterFn),
    eq(stockTransfer.companyFn, scope.companyFn),
    eq(stockTransfer.id, transferId),
  )).for('update');
  if (!header) throw new InvalidStockTransferStateError(`Transfer ${transferId} not found`);
  if (header.status !== 'draft') {
    throw new InvalidStockTransferStateError(
      `Transfer ${header.docNo} is '${header.status}', not 'draft'`,
    );
  }
  const lines = await exec.select({
    productId: stockTransferLine.productId,
    qty: stockTransferLine.qty,
  }).from(stockTransferLine).where(and(
    eq(stockTransferLine.masterFn, scope.masterFn),
    eq(stockTransferLine.companyFn, scope.companyFn),
    eq(stockTransferLine.transferId, header.id),
  )).orderBy(asc(stockTransferLine.productId));
  if (!lines.length) throw new StockTransferValidationError('Transfer has no lines');

  const movementIds: number[] = [];
  const warehouseIds = [header.fromWarehouseId, header.toWarehouseId].sort((a, b) => a - b);
  for (const line of lines) {
    for (const warehouseId of warehouseIds) {
      await exec.insert(stockLevel).values({
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        productId: line.productId,
        warehouseId,
        qty: '0',
      }).onConflictDoNothing();
    }
    // Opposite-direction transfers lock the same two rows in the same order.
    await exec.select({ id: stockLevel.id }).from(stockLevel).where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, line.productId),
      inArray(stockLevel.warehouseId, warehouseIds),
    )).orderBy(asc(stockLevel.warehouseId)).for('update');

    const qty = Number(line.qty);
    const movementGroup = `stock-transfer:${header.id}:${line.productId}`;
    const out = await issueStockWithin(exec, scope, {
      productId: line.productId,
      warehouseId: header.fromWarehouseId,
      qty,
      refType: 'stock_transfer',
      refId: header.id,
      movementGroup,
    });
    const inbound = await receiveStockWithin(exec, scope, {
      productId: line.productId,
      warehouseId: header.toWarehouseId,
      qty,
      refType: 'stock_transfer',
      refId: header.id,
      movementGroup,
    });
    movementIds.push(out.movementId, inbound.movementId);
  }
  await exec.update(stockTransfer).set({
    status: 'completed',
    version: header.version + 1,
    completedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(stockTransfer.id, header.id));
  return {
    transferId: header.id,
    docNo: header.docNo,
    status: 'completed',
    version: header.version + 1,
    movementIds,
  };
}

export function createStockTransfer(db: DB, scope: Scope, input: CreateStockTransferInput) {
  return db.transaction((tx) => createStockTransferWithin(tx, scope, input));
}

export function completeStockTransfer(db: DB, scope: Scope, transferId: number) {
  return db.transaction((tx) => completeStockTransferWithin(tx, scope, transferId));
}
