import { and, asc, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  glEntry,
  inventoryAdjustment,
  inventoryAdjustmentLine,
  product,
  stockLevel,
  warehouse,
} from '../../data/schema';
import {
  fixedString,
  fixedUnits,
  moneyString,
  roundedMoneyUnits,
} from './decimal';
import { issueStockWithin, receiveStockWithin } from './stock';
import { assertOpenAccountingPeriod } from '../finance/postingPeriod';

export class InventoryAdjustmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryAdjustmentValidationError';
  }
}

export class InvalidInventoryAdjustmentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInventoryAdjustmentStateError';
  }
}

export class InventorySnapshotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventorySnapshotConflictError';
  }
}

export interface InventoryAdjustmentLineInput {
  productId: number;
  countedQty: string | number;
}

export interface CreateInventoryAdjustmentInput {
  docNo: string;
  warehouseId: number;
  adjustmentDate: string;
  reason: string;
  reference?: string | null;
  lines: InventoryAdjustmentLineInput[];
}

function validateInput(input: CreateInventoryAdjustmentInput) {
  if (!input.docNo?.trim()) throw new InventoryAdjustmentValidationError('docNo is required');
  if (!Number.isSafeInteger(input.warehouseId) || input.warehouseId <= 0) {
    throw new InventoryAdjustmentValidationError('warehouseId must be a positive integer');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.adjustmentDate)) {
    throw new InventoryAdjustmentValidationError('adjustmentDate must be YYYY-MM-DD');
  }
  if (!input.reason?.trim()) throw new InventoryAdjustmentValidationError('reason is required');
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new InventoryAdjustmentValidationError('At least one adjustment line is required');
  }
  const ids = new Set<number>();
  for (const line of input.lines) {
    if (!Number.isSafeInteger(line.productId) || line.productId <= 0 || ids.has(line.productId)) {
      throw new InventoryAdjustmentValidationError('Line productId values must be unique positive integers');
    }
    ids.add(line.productId);
    if (fixedUnits(line.countedQty) < 0n) {
      throw new InventoryAdjustmentValidationError('countedQty cannot be negative');
    }
  }
}

export async function createInventoryAdjustmentWithin(
  exec: DB,
  scope: Scope,
  input: CreateInventoryAdjustmentInput,
) {
  validateInput(input);
  const [location] = await exec.select({ id: warehouse.id }).from(warehouse).where(and(
    eq(warehouse.masterFn, scope.masterFn),
    eq(warehouse.companyFn, scope.companyFn),
    eq(warehouse.id, input.warehouseId),
  ));
  if (!location) throw new InventoryAdjustmentValidationError('Warehouse does not exist in this company');

  const [header] = await exec.insert(inventoryAdjustment).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: input.docNo.trim(),
    warehouseId: input.warehouseId,
    adjustmentDate: input.adjustmentDate,
    reason: input.reason.trim(),
    reference: input.reference?.trim() || null,
  }).returning({
    id: inventoryAdjustment.id,
    docNo: inventoryAdjustment.docNo,
    status: inventoryAdjustment.status,
    version: inventoryAdjustment.version,
  });

  let lineNo = 0;
  let changedLines = 0;
  for (const line of input.lines) {
    const [item] = await exec.select({
      id: product.id,
      standardCost: product.standardCost,
    }).from(product).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      eq(product.id, line.productId),
    ));
    if (!item) {
      throw new InventoryAdjustmentValidationError(`Product ${line.productId} does not exist in this company`);
    }
    const [level] = await exec.select({ qty: stockLevel.qty }).from(stockLevel).where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, line.productId),
      eq(stockLevel.warehouseId, input.warehouseId),
    ));
    const systemUnits = fixedUnits(level?.qty ?? '0');
    const countedUnits = fixedUnits(line.countedQty);
    const varianceUnits = countedUnits - systemUnits;
    if (varianceUnits !== 0n) changedLines += 1;
    const costUnits = fixedUnits(item.standardCost);
    lineNo += 1;
    await exec.insert(inventoryAdjustmentLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      adjustmentId: header.id,
      lineNo,
      productId: line.productId,
      systemQty: fixedString(systemUnits),
      countedQty: fixedString(countedUnits),
      varianceQty: fixedString(varianceUnits),
      unitCost: fixedString(costUnits),
      valueImpact: moneyString(roundedMoneyUnits(varianceUnits, costUnits)),
    });
  }
  if (changedLines === 0) {
    throw new InventoryAdjustmentValidationError('At least one line must have a variance');
  }
  return { ...header, lines: lineNo };
}

export async function postInventoryAdjustmentWithin(
  exec: DB,
  scope: Scope,
  adjustmentId: number,
) {
  const [header] = await exec.select({
    id: inventoryAdjustment.id,
    docNo: inventoryAdjustment.docNo,
    status: inventoryAdjustment.status,
    version: inventoryAdjustment.version,
    warehouseId: inventoryAdjustment.warehouseId,
    adjustmentDate: inventoryAdjustment.adjustmentDate,
  }).from(inventoryAdjustment).where(and(
    eq(inventoryAdjustment.masterFn, scope.masterFn),
    eq(inventoryAdjustment.companyFn, scope.companyFn),
    eq(inventoryAdjustment.id, adjustmentId),
  )).for('update');
  if (!header) throw new InvalidInventoryAdjustmentStateError(`Adjustment ${adjustmentId} not found`);
  if (header.status !== 'draft') {
    throw new InvalidInventoryAdjustmentStateError(
      `Adjustment ${header.docNo} is '${header.status}', not 'draft'`,
    );
  }
  await assertOpenAccountingPeriod(
    exec,
    scope,
    header.adjustmentDate,
    (message) => new InventoryAdjustmentValidationError(message),
  );

  const lines = await exec.select({
    productId: inventoryAdjustmentLine.productId,
    systemQty: inventoryAdjustmentLine.systemQty,
    varianceQty: inventoryAdjustmentLine.varianceQty,
    valueImpact: inventoryAdjustmentLine.valueImpact,
  }).from(inventoryAdjustmentLine).where(and(
    eq(inventoryAdjustmentLine.masterFn, scope.masterFn),
    eq(inventoryAdjustmentLine.companyFn, scope.companyFn),
    eq(inventoryAdjustmentLine.adjustmentId, header.id),
  )).orderBy(asc(inventoryAdjustmentLine.productId));
  if (!lines.length) throw new InventoryAdjustmentValidationError('Adjustment has no lines');

  const movementIds: number[] = [];
  let totalImpactCents = 0n;
  for (const line of lines) {
    await exec.insert(stockLevel).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      productId: line.productId,
      warehouseId: header.warehouseId,
      qty: '0',
    }).onConflictDoNothing();
    const [level] = await exec.select({ qty: stockLevel.qty }).from(stockLevel).where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, line.productId),
      eq(stockLevel.warehouseId, header.warehouseId),
    )).for('update');
    if (fixedUnits(level?.qty ?? '0') !== fixedUnits(line.systemQty)) {
      throw new InventorySnapshotConflictError(
        `Stock changed after adjustment ${header.docNo} was counted; recount is required`,
      );
    }
    const variance = fixedUnits(line.varianceQty);
    if (variance > 0n) {
      const received = await receiveStockWithin(exec, scope, {
        productId: line.productId,
        warehouseId: header.warehouseId,
        qty: Number(fixedString(variance)),
        refType: 'inventory_adjustment',
        refId: header.id,
      });
      movementIds.push(received.movementId);
    } else if (variance < 0n) {
      const issued = await issueStockWithin(exec, scope, {
        productId: line.productId,
        warehouseId: header.warehouseId,
        qty: Number(fixedString(-variance)),
        refType: 'inventory_adjustment',
        refId: header.id,
      });
      movementIds.push(issued.movementId);
    }
    totalImpactCents += fixedUnits(line.valueImpact, 2);
  }

  if (totalImpactCents !== 0n) {
    const accounts = await exec.select({ id: account.id, code: account.code }).from(account).where(and(
      eq(account.masterFn, scope.masterFn),
      eq(account.companyFn, scope.companyFn),
    ));
    const inventoryId = accounts.find((row) => row.code === '1400')?.id;
    const varianceId = accounts.find((row) => row.code === '5800')?.id;
    if (!inventoryId || !varianceId) {
      throw new InventoryAdjustmentValidationError('Accounts 1400 and 5800 must be configured');
    }
    const amount = moneyString(totalImpactCents < 0n ? -totalImpactCents : totalImpactCents);
    await exec.insert(glEntry).values(totalImpactCents > 0n ? [
      { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: header.docNo, accountId: inventoryId, debit: amount, credit: '0', memo: 'Inventory adjustment' },
      { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: header.docNo, accountId: varianceId, debit: '0', credit: amount, memo: 'Inventory variance' },
    ] : [
      { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: header.docNo, accountId: varianceId, debit: amount, credit: '0', memo: 'Inventory variance' },
      { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: header.docNo, accountId: inventoryId, debit: '0', credit: amount, memo: 'Inventory adjustment' },
    ]);
  }

  await exec.update(inventoryAdjustment).set({
    status: 'posted',
    version: header.version + 1,
    postedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(inventoryAdjustment.id, header.id));
  return {
    adjustmentId: header.id,
    docNo: header.docNo,
    status: 'posted',
    version: header.version + 1,
    movementIds,
    valueImpact: moneyString(totalImpactCents),
  };
}

export function createInventoryAdjustment(
  db: DB,
  scope: Scope,
  input: CreateInventoryAdjustmentInput,
) {
  return db.transaction((tx) => createInventoryAdjustmentWithin(tx, scope, input));
}

export function postInventoryAdjustment(db: DB, scope: Scope, adjustmentId: number) {
  return db.transaction((tx) => postInventoryAdjustmentWithin(tx, scope, adjustmentId));
}
