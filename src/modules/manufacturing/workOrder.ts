import Decimal from 'decimal.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  bomComponent,
  bomVersion,
  account,
  glEntry,
  manufacturingBom,
  manufacturingRouting,
  product,
  routingOperation,
  stockLevel,
  warehouse,
  workCenter,
  workOrder,
  workOrderMaterial,
  workOrderOperation,
} from '../../data/schema';
import { issueStockWithin, receiveStockWithin } from '../inventory/stock';

export class ManufacturingWorkOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManufacturingWorkOrderError';
  }
}

export interface CreateWorkOrderInput {
  docNo: string;
  productId: number;
  bomVersionId: number;
  routingId: number;
  warehouseId: number;
  plannedQty: string | number;
  startDate: string;
  dueDate: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  demandSource?: string;
}

function requireScope(scope: Scope): void {
  if (!scope.masterFn || !scope.companyFn) {
    throw new ManufacturingWorkOrderError('Tenant scope is required');
  }
}

function positiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function dateOnly(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function positiveDecimal(value: string | number, label: string): Decimal {
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new ManufacturingWorkOrderError(`${label} must be a positive decimal`);
  }
  if (!parsed.isFinite() || !parsed.isPositive()) {
    throw new ManufacturingWorkOrderError(`${label} must be a positive decimal`);
  }
  return parsed;
}

export async function createWorkOrderWithin(
  tx: DB,
  scope: Scope,
  input: CreateWorkOrderInput,
) {
  requireScope(scope);
  if (
    typeof input.docNo !== 'string'
    || !input.docNo.trim()
    || !positiveId(input.productId)
    || !positiveId(input.bomVersionId)
    || !positiveId(input.routingId)
    || !positiveId(input.warehouseId)
    || !dateOnly(input.startDate)
    || !dateOnly(input.dueDate)
    || input.dueDate < input.startDate
  ) {
    throw new ManufacturingWorkOrderError(
      'docNo, product, BOM version, routing, warehouse and a valid schedule are required',
    );
  }
  const plannedQty = positiveDecimal(input.plannedQty, 'plannedQty');
  const priority = input.priority ?? 'normal';
  if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
    throw new ManufacturingWorkOrderError('priority is invalid');
  }

  const [configuration] = await tx.select({
    bomVersionId: bomVersion.id,
    bomStatus: bomVersion.status,
    outputQty: bomVersion.outputQty,
    bomProductId: manufacturingBom.productId,
    routingId: manufacturingRouting.id,
    routingProductId: manufacturingRouting.productId,
    routingStatus: manufacturingRouting.status,
    productId: product.id,
    warehouseId: warehouse.id,
  }).from(bomVersion)
    .innerJoin(manufacturingBom, eq(manufacturingBom.id, bomVersion.bomId))
    .innerJoin(manufacturingRouting, and(
      eq(manufacturingRouting.id, input.routingId),
      eq(manufacturingRouting.masterFn, scope.masterFn),
      eq(manufacturingRouting.companyFn, scope.companyFn),
    ))
    .innerJoin(product, and(
      eq(product.id, input.productId),
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
    ))
    .innerJoin(warehouse, and(
      eq(warehouse.id, input.warehouseId),
      eq(warehouse.masterFn, scope.masterFn),
      eq(warehouse.companyFn, scope.companyFn),
    ))
    .where(and(
      eq(bomVersion.id, input.bomVersionId),
      eq(bomVersion.masterFn, scope.masterFn),
      eq(bomVersion.companyFn, scope.companyFn),
      eq(manufacturingBom.masterFn, scope.masterFn),
      eq(manufacturingBom.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!configuration) {
    throw new ManufacturingWorkOrderError('Manufacturing configuration was not found');
  }
  if (configuration.bomStatus !== 'active' || configuration.routingStatus !== 'active') {
    throw new ManufacturingWorkOrderError('BOM version and routing must both be active');
  }
  if (
    configuration.bomProductId !== input.productId
    || configuration.routingProductId !== input.productId
  ) {
    throw new ManufacturingWorkOrderError('BOM and routing must belong to the finished product');
  }

  const components = await tx.select({
    lineNo: bomComponent.lineNo,
    productId: bomComponent.productId,
    qtyPer: bomComponent.qtyPer,
    scrapPct: bomComponent.scrapPct,
    unitCost: product.standardCost,
  }).from(bomComponent)
    .innerJoin(product, and(
      eq(product.id, bomComponent.productId),
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
    ))
    .where(and(
      eq(bomComponent.masterFn, scope.masterFn),
      eq(bomComponent.companyFn, scope.companyFn),
      eq(bomComponent.bomVersionId, input.bomVersionId),
    ))
    .orderBy(bomComponent.lineNo);
  if (!components.length) throw new ManufacturingWorkOrderError('Active BOM has no components');

  const operations = await tx.select({
    sequence: routingOperation.sequence,
    workCenterId: routingOperation.workCenterId,
    name: routingOperation.name,
    setupHours: routingOperation.setupHours,
    runHoursPerUnit: routingOperation.runHoursPerUnit,
    centerActive: workCenter.isActive,
  }).from(routingOperation)
    .innerJoin(workCenter, and(
      eq(workCenter.id, routingOperation.workCenterId),
      eq(workCenter.masterFn, scope.masterFn),
      eq(workCenter.companyFn, scope.companyFn),
    ))
    .where(and(
      eq(routingOperation.masterFn, scope.masterFn),
      eq(routingOperation.companyFn, scope.companyFn),
      eq(routingOperation.routingId, input.routingId),
    ))
    .orderBy(routingOperation.sequence);
  if (!operations.length) throw new ManufacturingWorkOrderError('Active routing has no operations');
  if (operations.some((operation) => !operation.centerActive)) {
    throw new ManufacturingWorkOrderError('Routing contains an inactive work centre');
  }

  const [header] = await tx.insert(workOrder).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: input.docNo.trim(),
    productId: input.productId,
    bomVersionId: input.bomVersionId,
    routingId: input.routingId,
    warehouseId: input.warehouseId,
    plannedQty: plannedQty.toFixed(4),
    startDate: input.startDate,
    dueDate: input.dueDate,
    priority,
    demandSource: input.demandSource?.trim() || null,
  }).returning({
    id: workOrder.id,
    docNo: workOrder.docNo,
    status: workOrder.status,
    version: workOrder.version,
  });

  const outputQty = positiveDecimal(configuration.outputQty, 'BOM outputQty');
  const materials = components.map((component) => {
    const requiredQty = plannedQty
      .mul(component.qtyPer)
      .mul(new Decimal(1).plus(new Decimal(component.scrapPct).div(100)))
      .div(outputQty)
      .toDecimalPlaces(4, Decimal.ROUND_UP);
    return {
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      workOrderId: header.id,
      lineNo: component.lineNo,
      productId: component.productId,
      requiredQty: requiredQty.toFixed(4),
      issuedQty: '0',
      unitCost: new Decimal(component.unitCost).toFixed(4),
    };
  });
  await tx.insert(workOrderMaterial).values(materials);

  const operationRows = operations.map((operation) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    workOrderId: header.id,
    sequence: operation.sequence,
    workCenterId: operation.workCenterId,
    name: operation.name,
    plannedHours: new Decimal(operation.setupHours)
      .plus(new Decimal(operation.runHoursPerUnit).mul(plannedQty))
      .toDecimalPlaces(4, Decimal.ROUND_UP)
      .toFixed(4),
    actualHours: '0',
    status: 'pending',
  }));
  await tx.insert(workOrderOperation).values(operationRows);

  return {
    ...header,
    materialLines: materials.length,
    operationLines: operationRows.length,
  };
}

export function createWorkOrder(db: DB, scope: Scope, input: CreateWorkOrderInput) {
  return db.transaction((tx) => createWorkOrderWithin(tx, scope, input));
}

export async function releaseWorkOrderWithin(tx: DB, scope: Scope, workOrderId: number) {
  requireScope(scope);
  if (!positiveId(workOrderId)) {
    throw new ManufacturingWorkOrderError('workOrderId must be a positive integer');
  }
  const [header] = await tx.select({
    id: workOrder.id,
    status: workOrder.status,
    warehouseId: workOrder.warehouseId,
  }).from(workOrder).where(and(
    eq(workOrder.id, workOrderId),
    eq(workOrder.masterFn, scope.masterFn),
    eq(workOrder.companyFn, scope.companyFn),
  )).for('update');
  if (!header) throw new ManufacturingWorkOrderError('Work order was not found');
  if (header.status !== 'planned') {
    throw new ManufacturingWorkOrderError(`Work order is ${header.status} and cannot be released`);
  }

  const materials = await tx.select({
    productId: workOrderMaterial.productId,
    requiredQty: workOrderMaterial.requiredQty,
  }).from(workOrderMaterial).where(and(
    eq(workOrderMaterial.masterFn, scope.masterFn),
    eq(workOrderMaterial.companyFn, scope.companyFn),
    eq(workOrderMaterial.workOrderId, header.id),
  )).orderBy(workOrderMaterial.productId).for('update');
  if (!materials.length) throw new ManufacturingWorkOrderError('Work order has no material snapshot');

  const productIds = materials.map((line) => line.productId);
  const balances = await tx.select({
    productId: stockLevel.productId,
    qty: sql<string>`coalesce(sum(${stockLevel.qty}), 0)`,
  }).from(stockLevel).where(and(
    eq(stockLevel.masterFn, scope.masterFn),
    eq(stockLevel.companyFn, scope.companyFn),
    eq(stockLevel.warehouseId, header.warehouseId),
    inArray(stockLevel.productId, productIds),
  )).groupBy(stockLevel.productId);
  const balanceByProduct = new Map(balances.map((row) => [row.productId, new Decimal(row.qty)]));
  const shortage = materials.find((line) =>
    (balanceByProduct.get(line.productId) ?? new Decimal(0)).lt(line.requiredQty));
  if (shortage) {
    const available = balanceByProduct.get(shortage.productId) ?? new Decimal(0);
    throw new ManufacturingWorkOrderError(
      `Material ${shortage.productId} is short: have ${available.toFixed(4)}, need ${new Decimal(shortage.requiredQty).toFixed(4)}`,
    );
  }

  await tx.update(workOrder).set({
    status: 'released',
    releasedAt: sql`now()`,
    version: sql`${workOrder.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(workOrder.id, header.id));
  await tx.update(workOrderOperation).set({
    status: 'ready',
    updatedAt: sql`now()`,
  }).where(and(
    eq(workOrderOperation.masterFn, scope.masterFn),
    eq(workOrderOperation.companyFn, scope.companyFn),
    eq(workOrderOperation.workOrderId, header.id),
    eq(workOrderOperation.status, 'pending'),
  ));
  return { workOrderId: header.id, status: 'released' as const };
}

async function manufacturingAccounts(tx: DB, scope: Scope) {
  const rows = await tx.select({ id: account.id, code: account.code })
    .from(account)
    .where(and(
      eq(account.masterFn, scope.masterFn),
      eq(account.companyFn, scope.companyFn),
      inArray(account.code, ['1400', '1450']),
    ));
  const byCode = new Map(rows.map((row) => [row.code, row.id]));
  const inventoryId = byCode.get('1400');
  const wipId = byCode.get('1450');
  if (!inventoryId || !wipId) {
    throw new ManufacturingWorkOrderError(
      'Inventory (1400) and Work in Progress (1450) accounts are required',
    );
  }
  return { inventoryId, wipId };
}

export async function issueWorkOrderMaterialsWithin(
  tx: DB,
  scope: Scope,
  workOrderId: number,
) {
  requireScope(scope);
  if (!positiveId(workOrderId)) {
    throw new ManufacturingWorkOrderError('workOrderId must be a positive integer');
  }
  const [header] = await tx.select({
    id: workOrder.id,
    docNo: workOrder.docNo,
    status: workOrder.status,
    warehouseId: workOrder.warehouseId,
  }).from(workOrder).where(and(
    eq(workOrder.id, workOrderId),
    eq(workOrder.masterFn, scope.masterFn),
    eq(workOrder.companyFn, scope.companyFn),
  )).for('update');
  if (!header) throw new ManufacturingWorkOrderError('Work order was not found');
  if (!['released', 'in_progress'].includes(header.status)) {
    throw new ManufacturingWorkOrderError(
      `Work order is ${header.status} and materials cannot be issued`,
    );
  }
  const materials = await tx.select({
    id: workOrderMaterial.id,
    productId: workOrderMaterial.productId,
    requiredQty: workOrderMaterial.requiredQty,
    issuedQty: workOrderMaterial.issuedQty,
    unitCost: workOrderMaterial.unitCost,
  }).from(workOrderMaterial).where(and(
    eq(workOrderMaterial.masterFn, scope.masterFn),
    eq(workOrderMaterial.companyFn, scope.companyFn),
    eq(workOrderMaterial.workOrderId, header.id),
  )).orderBy(workOrderMaterial.productId).for('update');
  if (!materials.length) throw new ManufacturingWorkOrderError('Work order has no material snapshot');

  const remaining = materials.map((line) => ({
    ...line,
    qty: new Decimal(line.requiredQty).minus(line.issuedQty),
  })).filter((line) => line.qty.gt(0));
  if (!remaining.length) {
    throw new ManufacturingWorkOrderError('All work-order materials are already issued');
  }

  const movementIds: number[] = [];
  let materialValue = new Decimal(0);
  for (const line of remaining) {
    const qty = line.qty.toDecimalPlaces(4).toNumber();
    const movement = await issueStockWithin(tx, scope, {
      productId: line.productId,
      warehouseId: header.warehouseId,
      qty,
      refType: 'work_order_material',
      refId: header.id,
      movementGroup: `WO-ISSUE-${header.id}`,
    });
    movementIds.push(movement.movementId);
    materialValue = materialValue.plus(line.qty.mul(line.unitCost));
    await tx.update(workOrderMaterial).set({
      issuedQty: line.requiredQty,
      updatedAt: sql`now()`,
    }).where(eq(workOrderMaterial.id, line.id));
  }
  const { inventoryId, wipId } = await manufacturingAccounts(tx, scope);
  const value = materialValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const journalRef = `WO-ISSUE-${header.docNo}`;
  await tx.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      journalRef, accountId: wipId, debit: value, credit: '0', memo: 'Material issued to WIP',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      journalRef, accountId: inventoryId, debit: '0', credit: value, memo: 'Raw material inventory',
    },
  ]);
  await tx.update(workOrder).set({
    status: 'in_progress',
    version: sql`${workOrder.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(workOrder.id, header.id));
  return {
    workOrderId: header.id,
    status: 'in_progress' as const,
    movementIds,
    materialValue: value,
    journalRef,
  };
}

export interface ReportWorkOrderOperationInput {
  workOrderId: number;
  operationId: number;
  hours: string | number;
  complete?: boolean;
}

export async function reportWorkOrderOperationWithin(
  tx: DB,
  scope: Scope,
  input: ReportWorkOrderOperationInput,
) {
  requireScope(scope);
  if (!positiveId(input.workOrderId) || !positiveId(input.operationId)) {
    throw new ManufacturingWorkOrderError('workOrderId and operationId are required');
  }
  const hours = positiveDecimal(input.hours, 'hours');
  const [header] = await tx.select({
    id: workOrder.id,
    status: workOrder.status,
  }).from(workOrder).where(and(
    eq(workOrder.id, input.workOrderId),
    eq(workOrder.masterFn, scope.masterFn),
    eq(workOrder.companyFn, scope.companyFn),
  )).for('update');
  if (!header) throw new ManufacturingWorkOrderError('Work order was not found');
  if (header.status !== 'in_progress') {
    throw new ManufacturingWorkOrderError('Materials must be issued before reporting production');
  }
  const [operation] = await tx.select({
    id: workOrderOperation.id,
    sequence: workOrderOperation.sequence,
    status: workOrderOperation.status,
    actualHours: workOrderOperation.actualHours,
  }).from(workOrderOperation).where(and(
    eq(workOrderOperation.id, input.operationId),
    eq(workOrderOperation.workOrderId, header.id),
    eq(workOrderOperation.masterFn, scope.masterFn),
    eq(workOrderOperation.companyFn, scope.companyFn),
  )).for('update');
  if (!operation) throw new ManufacturingWorkOrderError('Work-order operation was not found');
  if (['completed', 'skipped'].includes(operation.status)) {
    throw new ManufacturingWorkOrderError(`Operation is already ${operation.status}`);
  }
  const [incompletePrevious] = await tx.select({ id: workOrderOperation.id })
    .from(workOrderOperation)
    .where(and(
      eq(workOrderOperation.masterFn, scope.masterFn),
      eq(workOrderOperation.companyFn, scope.companyFn),
      eq(workOrderOperation.workOrderId, header.id),
      sql`${workOrderOperation.sequence} < ${operation.sequence}`,
      sql`${workOrderOperation.status} not in ('completed', 'skipped')`,
    ))
    .limit(1);
  if (incompletePrevious) {
    throw new ManufacturingWorkOrderError('Previous operations must be completed in sequence');
  }
  const actualHours = new Decimal(operation.actualHours).plus(hours)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
  const nextStatus = input.complete ? 'completed' : 'in_progress';
  await tx.update(workOrderOperation).set({
    actualHours,
    status: nextStatus,
    updatedAt: sql`now()`,
  }).where(eq(workOrderOperation.id, operation.id));
  if (input.complete) {
    const [next] = await tx.select({ id: workOrderOperation.id })
      .from(workOrderOperation)
      .where(and(
        eq(workOrderOperation.masterFn, scope.masterFn),
        eq(workOrderOperation.companyFn, scope.companyFn),
        eq(workOrderOperation.workOrderId, header.id),
        sql`${workOrderOperation.sequence} > ${operation.sequence}`,
        eq(workOrderOperation.status, 'pending'),
      ))
      .orderBy(workOrderOperation.sequence)
      .limit(1);
    if (next) {
      await tx.update(workOrderOperation).set({
        status: 'ready',
        updatedAt: sql`now()`,
      }).where(eq(workOrderOperation.id, next.id));
    }
  }
  return {
    workOrderId: header.id,
    operationId: operation.id,
    actualHours,
    status: nextStatus,
  };
}

export async function completeWorkOrderWithin(tx: DB, scope: Scope, workOrderId: number) {
  requireScope(scope);
  if (!positiveId(workOrderId)) {
    throw new ManufacturingWorkOrderError('workOrderId must be a positive integer');
  }
  const [header] = await tx.select({
    id: workOrder.id,
    docNo: workOrder.docNo,
    status: workOrder.status,
    productId: workOrder.productId,
    warehouseId: workOrder.warehouseId,
    plannedQty: workOrder.plannedQty,
    completedQty: workOrder.completedQty,
  }).from(workOrder).where(and(
    eq(workOrder.id, workOrderId),
    eq(workOrder.masterFn, scope.masterFn),
    eq(workOrder.companyFn, scope.companyFn),
  )).for('update');
  if (!header) throw new ManufacturingWorkOrderError('Work order was not found');
  if (header.status !== 'in_progress') {
    throw new ManufacturingWorkOrderError(`Work order is ${header.status} and cannot be completed`);
  }
  if (!new Decimal(header.completedQty).isZero()) {
    throw new ManufacturingWorkOrderError('Partial completion is not enabled for this work order');
  }
  const materials = await tx.select({
    requiredQty: workOrderMaterial.requiredQty,
    issuedQty: workOrderMaterial.issuedQty,
    unitCost: workOrderMaterial.unitCost,
  }).from(workOrderMaterial).where(and(
    eq(workOrderMaterial.masterFn, scope.masterFn),
    eq(workOrderMaterial.companyFn, scope.companyFn),
    eq(workOrderMaterial.workOrderId, header.id),
  )).for('update');
  if (materials.some((line) => !new Decimal(line.issuedQty).eq(line.requiredQty))) {
    throw new ManufacturingWorkOrderError('All required materials must be issued before completion');
  }
  const [openOperation] = await tx.select({ id: workOrderOperation.id })
    .from(workOrderOperation)
    .where(and(
      eq(workOrderOperation.masterFn, scope.masterFn),
      eq(workOrderOperation.companyFn, scope.companyFn),
      eq(workOrderOperation.workOrderId, header.id),
      sql`${workOrderOperation.status} not in ('completed', 'skipped')`,
    ))
    .limit(1)
    .for('update');
  if (openOperation) {
    throw new ManufacturingWorkOrderError('Every operation must be completed before receipt');
  }

  const qty = new Decimal(header.plannedQty).toDecimalPlaces(4).toNumber();
  const receipt = await receiveStockWithin(tx, scope, {
    productId: header.productId,
    warehouseId: header.warehouseId,
    qty,
    refType: 'work_order_completion',
    refId: header.id,
    movementGroup: `WO-COMPLETE-${header.id}`,
  });
  const materialValue = materials.reduce(
    (sum, line) => sum.plus(new Decimal(line.issuedQty).mul(line.unitCost)),
    new Decimal(0),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const { inventoryId, wipId } = await manufacturingAccounts(tx, scope);
  const journalRef = `WO-COMPLETE-${header.docNo}`;
  await tx.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      journalRef, accountId: inventoryId, debit: materialValue, credit: '0',
      memo: 'Finished goods receipt',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      journalRef, accountId: wipId, debit: '0', credit: materialValue,
      memo: 'Clear material WIP',
    },
  ]);
  await tx.update(workOrder).set({
    status: 'completed',
    completedQty: header.plannedQty,
    completedAt: sql`now()`,
    version: sql`${workOrder.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(workOrder.id, header.id));
  return {
    workOrderId: header.id,
    status: 'completed' as const,
    movementId: receipt.movementId,
    materialValue,
    journalRef,
  };
}
