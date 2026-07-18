import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  inventoryLot,
  product,
  qualityInspection,
  qualityInspectionPlan,
  qualityInspectionPlanItem,
  qualityInspectionResult,
  qualityNcr,
  stockMovement,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { issueStock, receiveStock } from '../inventory/stock';
import {
  createInventoryLot,
  createWarehouseBin,
  InventoryTrackingError,
} from '../inventory/tracking';
import {
  completeInspection,
  createInspection,
  createNcr,
  disposeNcr,
  QualityInspectionError,
} from './inspection';

async function fixture(db: DB) {
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'QC-LOT-ITEM',
    name: 'Quality lot item',
    trackingType: 'lot',
  }).returning({ id: product.id });
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'QC-WH',
    name: 'Quality warehouse',
  }).returning({ id: warehouse.id });
  const bin = await createWarehouseBin(db, SCOPE, {
    warehouseId: location.id,
    code: 'QC-01',
    name: 'Quality bin',
  });
  const lot = await createInventoryLot(db, SCOPE, {
    productId: item.id,
    lotNo: 'QC-LOT-1',
  });
  await receiveStock(db, SCOPE, {
    productId: item.id,
    warehouseId: location.id,
    binId: bin.id,
    lotId: lot.id,
    qty: 10,
  });
  const [plan] = await db.insert(qualityInspectionPlan).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'QIP-IN-1',
    name: 'Incoming material inspection',
    inspectionType: 'incoming',
    productId: item.id,
    sampleSize: '2',
  }).returning({ id: qualityInspectionPlan.id });
  await db.insert(qualityInspectionPlanItem).values([
    {
      masterFn: SCOPE.masterFn,
      companyFn: SCOPE.companyFn,
      planId: plan.id,
      sequence: 10,
      characteristic: 'Thickness',
      specification: '2.00 ± 0.05 mm',
      method: 'Micrometer',
    },
    {
      masterFn: SCOPE.masterFn,
      companyFn: SCOPE.companyFn,
      planId: plan.id,
      sequence: 20,
      characteristic: 'Surface',
      specification: 'No visible damage',
      method: 'Visual',
    },
  ]);
  return {
    productId: item.id,
    warehouseId: location.id,
    binId: bin.id,
    lotId: lot.id,
    planId: plan.id,
  };
}

async function newInspection(db: DB, docNo = 'QI-1') {
  const fx = await fixture(db);
  const inspection = await createInspection(db, SCOPE, {
    docNo,
    planId: fx.planId,
    productId: fx.productId,
    lotId: fx.lotId,
    sourceType: 'goods_receipt',
    sourceId: 1,
    sourceRef: 'GRN-DEMO',
    lotQty: '10',
    sampleQty: '2',
    inspectorName: 'Demo QA',
    inspectionDate: '2026-07-19',
  });
  const results = await db.select({ id: qualityInspectionResult.id })
    .from(qualityInspectionResult)
    .where(eq(qualityInspectionResult.inspectionId, inspection.id))
    .orderBy(qualityInspectionResult.sequence);
  return { fx, inspection, results };
}

describe('quality inspections and non-conformance', () => {
  it('snapshots plan characteristics and keeps a passed lot released', async () => {
    const db = await freshDb();
    const { fx, inspection, results } = await newInspection(db);
    expect(inspection).toMatchObject({
      status: 'scheduled',
      resultCount: 2,
    });
    await completeInspection(db, SCOPE, {
      inspectionId: inspection.id,
      results: [
        { resultId: results[0].id, measuredValue: '2.01 mm', result: 'pass' },
        { resultId: results[1].id, measuredValue: 'Clear', result: 'pass' },
      ],
    });
    expect(await db.select().from(qualityInspection)).toMatchObject([
      { status: 'passed', version: 2 },
    ]);
    expect(await db.select().from(inventoryLot)).toMatchObject([
      { id: fx.lotId, qualityStatus: 'released' },
    ]);
  });

  it('places a failed lot on hold, blocks issue, then releases it through NCR disposition', async () => {
    const db = await freshDb();
    const { fx, inspection, results } = await newInspection(db);
    const failed = await completeInspection(db, SCOPE, {
      inspectionId: inspection.id,
      results: [
        {
          resultId: results[0].id,
          measuredValue: '2.12 mm',
          result: 'fail',
          defectClass: 'major',
        },
        { resultId: results[1].id, measuredValue: 'Clear', result: 'pass' },
      ],
    });
    expect(failed).toMatchObject({ status: 'failed', lotQualityStatus: 'hold' });
    await expect(issueStock(db, SCOPE, {
      productId: fx.productId,
      warehouseId: fx.warehouseId,
      binId: fx.binId,
      lotId: fx.lotId,
      qty: 1,
    })).rejects.toThrow(InventoryTrackingError);

    const ncr = await createNcr(db, SCOPE, {
      docNo: 'NCR-1',
      inspectionId: inspection.id,
      severity: 'major',
      affectedQty: '10',
      defectDescription: 'Thickness exceeds tolerance.',
      actions: [{
        action: 'Review supplier measurement process',
        ownerName: 'Demo QA',
        dueDate: '2026-07-26',
      }],
    });
    expect(ncr).toMatchObject({ status: 'open', correctiveActionCount: 1 });
    expect(await disposeNcr(db, SCOPE, ncr.id, 'release')).toMatchObject({
      status: 'closed',
      lotQualityStatus: 'released',
    });
    await expect(issueStock(db, SCOPE, {
      productId: fx.productId,
      warehouseId: fx.warehouseId,
      binId: fx.binId,
      lotId: fx.lotId,
      qty: 1,
    })).resolves.toMatchObject({ remaining: 9 });
    expect(await db.select().from(stockMovement)).toHaveLength(2);
  });

  it('rejects duplicate completion, cross-tenant access and keeps scrapped lots blocked', async () => {
    const db = await freshDb();
    const { fx, inspection, results } = await newInspection(db);
    const payload = {
      inspectionId: inspection.id,
      results: [
        {
          resultId: results[0].id,
          measuredValue: '2.12 mm',
          result: 'fail' as const,
          defectClass: 'major' as const,
        },
        { resultId: results[1].id, measuredValue: 'Damaged', result: 'fail' as const },
      ],
    };
    await completeInspection(db, SCOPE, payload);
    await expect(completeInspection(db, SCOPE, payload))
      .rejects.toThrow(QualityInspectionError);
    await expect(createNcr(db, { masterFn: 'OTHER', companyFn: 'OTHER-C' }, {
      docNo: 'NCR-OTHER',
      inspectionId: inspection.id,
      severity: 'major',
      affectedQty: '1',
      defectDescription: 'Must not cross tenant.',
    })).rejects.toThrow(QualityInspectionError);

    const ncr = await createNcr(db, SCOPE, {
      docNo: 'NCR-SCRAP',
      inspectionId: inspection.id,
      severity: 'critical',
      affectedQty: '10',
      defectDescription: 'Critical dimensional failure.',
    });
    await disposeNcr(db, SCOPE, ncr.id, 'scrap');
    expect(await db.select().from(qualityNcr)).toMatchObject([
      { status: 'closed', disposition: 'scrap', version: 2 },
    ]);
    expect(await db.select().from(inventoryLot)).toMatchObject([
      { qualityStatus: 'rejected' },
    ]);
    await expect(issueStock(db, SCOPE, {
      productId: fx.productId,
      warehouseId: fx.warehouseId,
      binId: fx.binId,
      lotId: fx.lotId,
      qty: 1,
    })).rejects.toThrow(InventoryTrackingError);
  });
});
