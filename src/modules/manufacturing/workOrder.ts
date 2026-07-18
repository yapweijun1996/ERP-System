import Decimal from 'decimal.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  bomComponent,
  bomVersion,
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
