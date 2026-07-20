import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account,
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
  stockMovement,
  glEntry,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createWorkOrder,
  completeWorkOrderWithin,
  issueWorkOrderMaterialsWithin,
  ManufacturingWorkOrderError,
  reportWorkOrderOperationWithin,
  releaseWorkOrderWithin,
} from './workOrder';

async function fixture(db: DB, componentStock = 20) {
  await db.insert(product).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      sku: 'FG-1', name: 'Finished Good', uom: 'unit', standardCost: '30',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      sku: 'RM-1', name: 'Raw Material', uom: 'kg', standardCost: '4.25',
    },
  ]).returning({ id: product.id });
  const rows = await db.select({ id: product.id }).from(product)
    .where(and(eq(product.masterFn, SCOPE.masterFn), eq(product.companyFn, SCOPE.companyFn)))
    .orderBy(product.id);
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'MFG', name: 'Manufacturing',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    productId: rows[1].id,
    warehouseId: location.id,
    qty: String(componentStock),
  });
  await db.insert(account).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      code: '1400', name: 'Inventory', type: 'asset',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      code: '1450', name: 'Work in Progress', type: 'asset',
    },
  ]);
  const [center] = await db.insert(workCenter).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'WC-1', name: 'Assembly',
  }).returning({ id: workCenter.id });
  const [bom] = await db.insert(manufacturingBom).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'BOM-FG-1', name: 'FG BOM', productId: rows[0].id,
  }).returning({ id: manufacturingBom.id });
  const [version] = await db.insert(bomVersion).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    bomId: bom.id, revision: 'A', status: 'active',
    effectiveFrom: '2026-07-01', outputQty: '1', uom: 'unit',
  }).returning({ id: bomVersion.id });
  await db.insert(bomComponent).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    bomVersionId: version.id, lineNo: 1, productId: rows[1].id,
    qtyPer: '2', scrapPct: '10',
  });
  const [routing] = await db.insert(manufacturingRouting).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'RT-FG-1', name: 'FG routing', productId: rows[0].id,
  }).returning({ id: manufacturingRouting.id });
  await db.insert(routingOperation).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    routingId: routing.id, sequence: 10, workCenterId: center.id,
    name: 'Assemble', setupHours: '0.5', runHoursPerUnit: '0.25',
  });
  return {
    finishedProductId: rows[0].id,
    bomVersionId: version.id,
    routingId: routing.id,
    warehouseId: location.id,
  };
}

describe('manufacturing work orders', () => {
  it('creates immutable material and operation snapshots from active master data', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const created = await createWorkOrder(db, SCOPE, {
      docNo: 'WO-1',
      productId: fx.finishedProductId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '5',
      startDate: '2026-07-19',
      dueDate: '2026-07-20',
    });

    expect(created).toMatchObject({
      docNo: 'WO-1', status: 'planned', materialLines: 1, operationLines: 1,
    });
    expect(await db.select().from(workOrderMaterial)).toMatchObject([
      { requiredQty: '11.0000', issuedQty: '0.0000', unitCost: '4.2500' },
    ]);
    expect(await db.select().from(workOrderOperation)).toMatchObject([
      { plannedHours: '1.7500', status: 'pending' },
    ]);
  });

  it('releases only when every material has sufficient stock', async () => {
    const db = await freshDb();
    const fx = await fixture(db, 11);
    const created = await createWorkOrder(db, SCOPE, {
      docNo: 'WO-2',
      productId: fx.finishedProductId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '5',
      startDate: '2026-07-19',
      dueDate: '2026-07-20',
    });
    await expect(db.transaction((tx) =>
      releaseWorkOrderWithin(tx, SCOPE, created.id)))
      .resolves.toEqual({ workOrderId: created.id, status: 'released' });
    expect(await db.select().from(workOrder)).toMatchObject([{ status: 'released', version: 2 }]);
    expect(await db.select().from(workOrderOperation)).toMatchObject([{ status: 'ready' }]);
  });

  it('rolls back release on shortage and rejects mismatched tenant configuration', async () => {
    const db = await freshDb();
    const fx = await fixture(db, 10);
    const created = await createWorkOrder(db, SCOPE, {
      docNo: 'WO-3',
      productId: fx.finishedProductId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '5',
      startDate: '2026-07-19',
      dueDate: '2026-07-20',
    });
    await expect(db.transaction((tx) =>
      releaseWorkOrderWithin(tx, SCOPE, created.id)))
      .rejects.toThrow('is short');
    expect(await db.select().from(workOrder)).toMatchObject([{ status: 'planned', version: 1 }]);

    await expect(createWorkOrder(db, { masterFn: 'OTHER', companyFn: 'OTHER-C' }, {
      docNo: 'WO-X',
      productId: fx.finishedProductId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '1',
      startDate: '2026-07-19',
      dueDate: '2026-07-20',
    })).rejects.toThrow(ManufacturingWorkOrderError);
  });

  it('issues material, reports operations and completes finished goods with balanced WIP GL', async () => {
    const db = await freshDb();
    const fx = await fixture(db, 20);
    const created = await createWorkOrder(db, SCOPE, {
      docNo: 'WO-EXEC',
      productId: fx.finishedProductId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '5',
      startDate: '2026-07-19',
      dueDate: '2026-07-20',
    });
    await db.transaction((tx) => releaseWorkOrderWithin(tx, SCOPE, created.id));
    const issued = await db.transaction((tx) =>
      issueWorkOrderMaterialsWithin(tx, SCOPE, created.id));
    expect(issued).toMatchObject({
      status: 'in_progress',
      materialValue: '46.75',
      journalRef: 'WO-ISSUE-WO-EXEC',
    });
    expect(issued.movementIds).toHaveLength(1);

    const [operation] = await db.select({ id: workOrderOperation.id })
      .from(workOrderOperation);
    await db.transaction((tx) => reportWorkOrderOperationWithin(tx, SCOPE, {
      workOrderId: created.id,
      operationId: operation.id,
      hours: '1.75',
      complete: true,
    }));
    const completed = await db.transaction((tx) =>
      completeWorkOrderWithin(tx, SCOPE, created.id));
    expect(completed).toMatchObject({
      status: 'completed',
      materialValue: '46.75',
      journalRef: 'WO-COMPLETE-WO-EXEC',
    });
    expect(await db.select().from(workOrder)).toMatchObject([
      { status: 'completed', plannedQty: '5.0000', completedQty: '5.0000' },
    ]);
    expect(await db.select().from(stockMovement)).toMatchObject([
      { direction: 'out', qty: '11.0000', refType: 'work_order_material' },
      { direction: 'in', qty: '5.0000', refType: 'work_order_completion' },
    ]);
    const entries = await db.select().from(glEntry);
    const debit = entries.reduce((sum, row) => sum + Number(row.debit), 0);
    const credit = entries.reduce((sum, row) => sum + Number(row.credit), 0);
    expect(debit).toBe(93.5);
    expect(credit).toBe(93.5);
  });

  it('rolls back an incomplete execution and rejects duplicate material issue', async () => {
    const db = await freshDb();
    const fx = await fixture(db, 20);
    const created = await createWorkOrder(db, SCOPE, {
      docNo: 'WO-GUARDS',
      productId: fx.finishedProductId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '5',
      startDate: '2026-07-19',
      dueDate: '2026-07-20',
    });
    await db.transaction((tx) => releaseWorkOrderWithin(tx, SCOPE, created.id));
    await expect(db.transaction((tx) => completeWorkOrderWithin(tx, SCOPE, created.id)))
      .rejects.toThrow('cannot be completed');
    await db.transaction((tx) => issueWorkOrderMaterialsWithin(tx, SCOPE, created.id));
    await expect(db.transaction((tx) => issueWorkOrderMaterialsWithin(tx, SCOPE, created.id)))
      .rejects.toThrow('already issued');
    await expect(db.transaction((tx) => completeWorkOrderWithin(tx, SCOPE, created.id)))
      .rejects.toThrow('Every operation');
    expect(await db.select().from(stockMovement)).toHaveLength(1);
  });

  it('rejects a zero planned quantity without creating a work order', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await expect(createWorkOrder(db, SCOPE, {
      docNo: 'WO-ZERO',
      productId: fx.finishedProductId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '0',
      startDate: '2026-07-19',
      dueDate: '2026-07-20',
    })).rejects.toThrow('plannedQty must be a positive decimal');
    expect(await db.select().from(workOrder)).toHaveLength(0);
  });
});
