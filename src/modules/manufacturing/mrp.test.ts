import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  bomComponent,
  bomVersion,
  manufacturingBom,
  manufacturingRouting,
  mrpRun,
  mrpSuggestion,
  product,
  routingOperation,
  stockLevel,
  warehouse,
  workCenter,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createWorkOrder } from './workOrder';
import { runMrp } from './mrp';

async function fixture(db: DB) {
  await db.insert(product).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      sku: 'MRP-FG', name: 'MRP finished', uom: 'unit',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      sku: 'MRP-RM', name: 'MRP component', uom: 'unit', standardCost: '2',
    },
  ]);
  const products = await db.select({ id: product.id, sku: product.sku }).from(product);
  const finished = products.find((row) => row.sku === 'MRP-FG')!;
  const component = products.find((row) => row.sku === 'MRP-RM')!;
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'MRP-WH', name: 'MRP warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    productId: component.id, warehouseId: location.id, qty: '7',
  });
  const [center] = await db.insert(workCenter).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'MRP-WC', name: 'MRP centre',
  }).returning({ id: workCenter.id });
  const [bom] = await db.insert(manufacturingBom).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'MRP-BOM', name: 'MRP BOM', productId: finished.id,
  }).returning({ id: manufacturingBom.id });
  const [version] = await db.insert(bomVersion).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    bomId: bom.id, revision: 'A', status: 'active',
    effectiveFrom: '2026-07-01', outputQty: '1', uom: 'unit',
  }).returning({ id: bomVersion.id });
  await db.insert(bomComponent).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    bomVersionId: version.id, lineNo: 1, productId: component.id,
    qtyPer: '2', scrapPct: '0',
  });
  const [routing] = await db.insert(manufacturingRouting).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'MRP-RT', name: 'MRP routing', productId: finished.id,
  }).returning({ id: manufacturingRouting.id });
  await db.insert(routingOperation).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    routingId: routing.id, sequence: 10, workCenterId: center.id,
    name: 'Build', runHoursPerUnit: '0.1',
  });
  return {
    finishedId: finished.id,
    componentId: component.id,
    warehouseId: location.id,
    bomVersionId: version.id,
    routingId: routing.id,
  };
}

describe('MRP run', () => {
  it('aggregates open work-order demand and creates a shortage suggestion', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await createWorkOrder(db, SCOPE, {
      docNo: 'WO-MRP-1',
      productId: fx.finishedId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '5',
      startDate: '2026-07-19',
      dueDate: '2026-07-22',
    });
    const result = await runMrp(db, SCOPE, {
      docNo: 'MRP-1',
      planningDate: '2026-07-31',
    });
    expect(result).toMatchObject({
      status: 'completed', suggestionCount: 1, shortageCount: 1,
    });
    expect(await db.select().from(mrpSuggestion)).toMatchObject([
      {
        productId: fx.componentId,
        grossRequirement: '10.0000',
        onHand: '7.0000',
        netRequirement: '3.0000',
        action: 'purchase',
      },
    ]);
  });

  it('excludes demand outside the planning horizon and never crosses tenant scope', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await createWorkOrder(db, SCOPE, {
      docNo: 'WO-MRP-FUTURE',
      productId: fx.finishedId,
      bomVersionId: fx.bomVersionId,
      routingId: fx.routingId,
      warehouseId: fx.warehouseId,
      plannedQty: '5',
      startDate: '2026-08-01',
      dueDate: '2026-08-10',
    });
    expect(await runMrp(db, SCOPE, {
      docNo: 'MRP-EMPTY',
      planningDate: '2026-07-31',
    })).toMatchObject({ suggestionCount: 0, shortageCount: 0 });
    expect(await db.select().from(mrpRun)).toHaveLength(1);
    expect(await runMrp(db, { masterFn: 'OTHER', companyFn: 'OTHER-C' }, {
      docNo: 'MRP-OTHER',
      planningDate: '2026-12-31',
    })).toMatchObject({ suggestionCount: 0 });
  });
});
