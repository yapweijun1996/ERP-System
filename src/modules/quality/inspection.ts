import { and, eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  inventoryLot,
  product,
  qualityCorrectiveAction,
  qualityInspection,
  qualityInspectionPlan,
  qualityInspectionPlanItem,
  qualityInspectionResult,
  qualityNcr,
} from '../../data/schema';

export class QualityInspectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QualityInspectionError';
  }
}

function positiveDecimal(value: string | number, label: string): Decimal {
  let decimal: Decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new QualityInspectionError(`${label} must be a positive decimal.`);
  }
  if (!decimal.isFinite() || !decimal.isPositive()) {
    throw new QualityInspectionError(`${label} must be a positive decimal.`);
  }
  return decimal;
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new QualityInspectionError(`${label} is required.`);
  return normalized;
}

export interface CreateInspectionInput {
  docNo: string;
  planId: number;
  productId: number;
  lotId?: number | null;
  sourceType: 'goods_receipt' | 'work_order' | 'manual';
  sourceId?: number | null;
  sourceRef?: string | null;
  lotQty: string | number;
  sampleQty: string | number;
  inspectorName: string;
  inspectionDate: string;
}

export async function createInspectionWithin(
  exec: DB,
  scope: Scope,
  input: CreateInspectionInput,
) {
  const docNo = required(input.docNo, 'Inspection number');
  const inspectorName = required(input.inspectorName, 'Inspector');
  if (!Number.isSafeInteger(input.planId) || input.planId <= 0) {
    throw new QualityInspectionError('planId must be a positive integer.');
  }
  if (!Number.isSafeInteger(input.productId) || input.productId <= 0) {
    throw new QualityInspectionError('productId must be a positive integer.');
  }
  if (!['goods_receipt', 'work_order', 'manual'].includes(input.sourceType)) {
    throw new QualityInspectionError('Unsupported inspection source.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.inspectionDate)) {
    throw new QualityInspectionError('inspectionDate must use YYYY-MM-DD.');
  }
  const lotQty = positiveDecimal(input.lotQty, 'lotQty');
  const sampleQty = positiveDecimal(input.sampleQty, 'sampleQty');
  if (sampleQty.gt(lotQty)) {
    throw new QualityInspectionError('sampleQty cannot exceed lotQty.');
  }

  const [plan] = await exec.select({
    id: qualityInspectionPlan.id,
    inspectionType: qualityInspectionPlan.inspectionType,
    productId: qualityInspectionPlan.productId,
    sampleSize: qualityInspectionPlan.sampleSize,
  }).from(qualityInspectionPlan).where(and(
    eq(qualityInspectionPlan.masterFn, scope.masterFn),
    eq(qualityInspectionPlan.companyFn, scope.companyFn),
    eq(qualityInspectionPlan.id, input.planId),
    eq(qualityInspectionPlan.isActive, true),
  ));
  if (!plan) throw new QualityInspectionError('Inspection plan does not exist or is inactive.');
  if (plan.productId != null && plan.productId !== input.productId) {
    throw new QualityInspectionError('Inspection plan does not apply to this product.');
  }
  if (sampleQty.lt(plan.sampleSize)) {
    throw new QualityInspectionError(`sampleQty must be at least the plan sample size ${plan.sampleSize}.`);
  }

  const [item] = await exec.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    eq(product.id, input.productId),
  ));
  if (!item) throw new QualityInspectionError('Product does not exist in this company.');

  if (input.lotId != null) {
    if (!Number.isSafeInteger(input.lotId) || input.lotId <= 0) {
      throw new QualityInspectionError('lotId must be a positive integer.');
    }
    const [lot] = await exec.select({ id: inventoryLot.id }).from(inventoryLot).where(and(
      eq(inventoryLot.masterFn, scope.masterFn),
      eq(inventoryLot.companyFn, scope.companyFn),
      eq(inventoryLot.id, input.lotId),
      eq(inventoryLot.productId, input.productId),
    ));
    if (!lot) throw new QualityInspectionError('Lot does not belong to this product.');
  }

  const planItems = await exec.select({
    id: qualityInspectionPlanItem.id,
    sequence: qualityInspectionPlanItem.sequence,
    characteristic: qualityInspectionPlanItem.characteristic,
    specification: qualityInspectionPlanItem.specification,
    method: qualityInspectionPlanItem.method,
  }).from(qualityInspectionPlanItem).where(and(
    eq(qualityInspectionPlanItem.masterFn, scope.masterFn),
    eq(qualityInspectionPlanItem.companyFn, scope.companyFn),
    eq(qualityInspectionPlanItem.planId, plan.id),
  )).orderBy(qualityInspectionPlanItem.sequence);
  if (planItems.length === 0) {
    throw new QualityInspectionError('Inspection plan must contain at least one characteristic.');
  }

  const [inspection] = await exec.insert(qualityInspection).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    inspectionType: plan.inspectionType,
    planId: plan.id,
    productId: input.productId,
    lotId: input.lotId ?? null,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    sourceRef: input.sourceRef?.trim() || null,
    lotQty: lotQty.toFixed(4),
    sampleQty: sampleQty.toFixed(4),
    inspectorName,
    inspectionDate: input.inspectionDate,
  }).returning({
    id: qualityInspection.id,
    docNo: qualityInspection.docNo,
    status: qualityInspection.status,
    version: qualityInspection.version,
  });

  await exec.insert(qualityInspectionResult).values(planItems.map((planItem) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    inspectionId: inspection.id,
    planItemId: planItem.id,
    sequence: planItem.sequence,
    characteristic: planItem.characteristic,
    specification: planItem.specification,
    method: planItem.method,
  })));

  return { ...inspection, resultCount: planItems.length };
}

export interface CompleteInspectionResultInput {
  resultId: number;
  measuredValue: string;
  result: 'pass' | 'fail';
  defectClass?: 'critical' | 'major' | 'minor' | null;
}

export interface CompleteInspectionInput {
  inspectionId: number;
  results: CompleteInspectionResultInput[];
}

export async function completeInspectionWithin(
  exec: DB,
  scope: Scope,
  input: CompleteInspectionInput,
) {
  const [inspection] = await exec.select({
    id: qualityInspection.id,
    status: qualityInspection.status,
    lotId: qualityInspection.lotId,
  }).from(qualityInspection).where(and(
    eq(qualityInspection.masterFn, scope.masterFn),
    eq(qualityInspection.companyFn, scope.companyFn),
    eq(qualityInspection.id, input.inspectionId),
  )).for('update');
  if (!inspection) throw new QualityInspectionError('Inspection does not exist in this company.');
  if (!['scheduled', 'in_inspection'].includes(inspection.status)) {
    throw new QualityInspectionError(`Inspection is already '${inspection.status}'.`);
  }

  const storedResults = await exec.select({
    id: qualityInspectionResult.id,
  }).from(qualityInspectionResult).where(and(
    eq(qualityInspectionResult.masterFn, scope.masterFn),
    eq(qualityInspectionResult.companyFn, scope.companyFn),
    eq(qualityInspectionResult.inspectionId, inspection.id),
  )).for('update');
  const submitted = Array.isArray(input.results) ? input.results : [];
  const submittedIds = new Set(submitted.map((row) => row.resultId));
  if (
    storedResults.length === 0
    || submitted.length !== storedResults.length
    || submittedIds.size !== storedResults.length
    || storedResults.some((row) => !submittedIds.has(row.id))
  ) {
    throw new QualityInspectionError('Every inspection characteristic must have exactly one result.');
  }

  let failed = false;
  for (const row of submitted) {
    if (!['pass', 'fail'].includes(row.result) || !row.measuredValue?.trim()) {
      throw new QualityInspectionError('Each result requires a measured value and pass/fail outcome.');
    }
    if (
      row.result === 'fail'
      && row.defectClass != null
      && !['critical', 'major', 'minor'].includes(row.defectClass)
    ) {
      throw new QualityInspectionError('Invalid defect class.');
    }
    failed ||= row.result === 'fail';
    await exec.update(qualityInspectionResult).set({
      measuredValue: row.measuredValue.trim(),
      result: row.result,
      defectClass: row.result === 'fail' ? row.defectClass ?? 'major' : null,
      updatedAt: sql`now()`,
    }).where(and(
      eq(qualityInspectionResult.masterFn, scope.masterFn),
      eq(qualityInspectionResult.companyFn, scope.companyFn),
      eq(qualityInspectionResult.inspectionId, inspection.id),
      eq(qualityInspectionResult.id, row.resultId),
    ));
  }

  const status = failed ? 'failed' : 'passed';
  const [completedInspection] = await exec.update(qualityInspection).set({
    status,
    version: sql`${qualityInspection.version} + 1`,
    completedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(qualityInspection.id, inspection.id))
    .returning({ version: qualityInspection.version });

  let lotQualityStatus: string | null = null;
  if (failed && inspection.lotId != null) {
    const [lot] = await exec.select({
      id: inventoryLot.id,
      qualityStatus: inventoryLot.qualityStatus,
    }).from(inventoryLot).where(and(
      eq(inventoryLot.masterFn, scope.masterFn),
      eq(inventoryLot.companyFn, scope.companyFn),
      eq(inventoryLot.id, inspection.lotId),
    )).for('update');
    if (!lot) throw new QualityInspectionError('Inspection lot no longer exists.');
    if (lot.qualityStatus === 'rejected') {
      throw new QualityInspectionError('A rejected lot cannot be returned to quality hold.');
    }
    await exec.update(inventoryLot).set({
      qualityStatus: 'hold',
      updatedAt: sql`now()`,
    }).where(eq(inventoryLot.id, lot.id));
    lotQualityStatus = 'hold';
  }

  return {
    inspectionId: inspection.id,
    status,
    lotQualityStatus,
    version: completedInspection.version,
  };
}

export interface CreateNcrInput {
  docNo: string;
  inspectionId: number;
  severity: 'critical' | 'major' | 'minor';
  affectedQty: string | number;
  defectDescription: string;
  actions?: Array<{
    action: string;
    ownerName: string;
    dueDate: string;
  }>;
}

export async function createNcrWithin(
  exec: DB,
  scope: Scope,
  input: CreateNcrInput,
) {
  const docNo = required(input.docNo, 'NCR number');
  const defectDescription = required(input.defectDescription, 'Defect description');
  if (!Number.isSafeInteger(input.inspectionId) || input.inspectionId <= 0) {
    throw new QualityInspectionError('inspectionId must be a positive integer.');
  }
  if (!['critical', 'major', 'minor'].includes(input.severity)) {
    throw new QualityInspectionError('Invalid NCR severity.');
  }
  const affectedQty = positiveDecimal(input.affectedQty, 'affectedQty');

  const [inspection] = await exec.select({
    id: qualityInspection.id,
    status: qualityInspection.status,
    productId: qualityInspection.productId,
    lotId: qualityInspection.lotId,
    lotQty: qualityInspection.lotQty,
  }).from(qualityInspection).where(and(
    eq(qualityInspection.masterFn, scope.masterFn),
    eq(qualityInspection.companyFn, scope.companyFn),
    eq(qualityInspection.id, input.inspectionId),
  )).for('update');
  if (!inspection || inspection.status !== 'failed') {
    throw new QualityInspectionError('NCRs can only be raised from a failed inspection.');
  }
  if (affectedQty.gt(inspection.lotQty)) {
    throw new QualityInspectionError('affectedQty cannot exceed the inspected lot quantity.');
  }

  const actions = input.actions ?? [];
  if (actions.some((action) =>
    !action.action?.trim()
    || !action.ownerName?.trim()
    || !/^\d{4}-\d{2}-\d{2}$/.test(action.dueDate)
  )) {
    throw new QualityInspectionError('Each corrective action requires action, ownerName and dueDate.');
  }

  const [ncr] = await exec.insert(qualityNcr).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    inspectionId: inspection.id,
    productId: inspection.productId,
    lotId: inspection.lotId,
    severity: input.severity,
    affectedQty: affectedQty.toFixed(4),
    defectDescription,
  }).returning({
    id: qualityNcr.id,
    docNo: qualityNcr.docNo,
    status: qualityNcr.status,
    version: qualityNcr.version,
  });

  if (actions.length) {
    await exec.insert(qualityCorrectiveAction).values(actions.map((action, index) => ({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      ncrId: ncr.id,
      sequence: index + 1,
      action: action.action.trim(),
      ownerName: action.ownerName.trim(),
      dueDate: action.dueDate,
    })));
  }
  if (inspection.lotId != null) {
    await exec.update(inventoryLot).set({
      qualityStatus: 'hold',
      updatedAt: sql`now()`,
    }).where(and(
      eq(inventoryLot.masterFn, scope.masterFn),
      eq(inventoryLot.companyFn, scope.companyFn),
      eq(inventoryLot.id, inspection.lotId),
    ));
  }

  return { ...ncr, correctiveActionCount: actions.length };
}

export async function disposeNcrWithin(
  exec: DB,
  scope: Scope,
  ncrId: number,
  disposition: 'release' | 'scrap',
) {
  const [ncr] = await exec.select({
    id: qualityNcr.id,
    status: qualityNcr.status,
    inspectionId: qualityNcr.inspectionId,
    lotId: qualityNcr.lotId,
  }).from(qualityNcr).where(and(
    eq(qualityNcr.masterFn, scope.masterFn),
    eq(qualityNcr.companyFn, scope.companyFn),
    eq(qualityNcr.id, ncrId),
  )).for('update');
  if (!ncr) throw new QualityInspectionError('NCR does not exist in this company.');
  if (ncr.status === 'closed') throw new QualityInspectionError('NCR is already closed.');

  let lotQualityStatus: 'released' | 'rejected' | null = null;
  if (ncr.lotId != null) {
    lotQualityStatus = disposition === 'release' ? 'released' : 'rejected';
    const [updatedLot] = await exec.update(inventoryLot).set({
      qualityStatus: lotQualityStatus,
      updatedAt: sql`now()`,
    }).where(and(
      eq(inventoryLot.masterFn, scope.masterFn),
      eq(inventoryLot.companyFn, scope.companyFn),
      eq(inventoryLot.id, ncr.lotId),
    )).returning({ id: inventoryLot.id });
    if (!updatedLot) throw new QualityInspectionError('NCR lot no longer exists.');
  }

  await exec.update(qualityNcr).set({
    status: 'closed',
    disposition,
    version: sql`${qualityNcr.version} + 1`,
    closedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(qualityNcr.id, ncr.id));
  await exec.update(qualityInspection).set({
    status: 'closed',
    version: sql`${qualityInspection.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(qualityInspection.masterFn, scope.masterFn),
    eq(qualityInspection.companyFn, scope.companyFn),
    eq(qualityInspection.id, ncr.inspectionId),
  ));

  return {
    ncrId: ncr.id,
    status: 'closed',
    disposition,
    lotQualityStatus,
  };
}

export function createInspection(db: DB, scope: Scope, input: CreateInspectionInput) {
  return db.transaction((tx) => createInspectionWithin(tx, scope, input));
}

export function completeInspection(db: DB, scope: Scope, input: CompleteInspectionInput) {
  return db.transaction((tx) => completeInspectionWithin(tx, scope, input));
}

export function createNcr(db: DB, scope: Scope, input: CreateNcrInput) {
  return db.transaction((tx) => createNcrWithin(tx, scope, input));
}

export function disposeNcr(
  db: DB,
  scope: Scope,
  ncrId: number,
  disposition: 'release' | 'scrap',
) {
  return db.transaction((tx) => disposeNcrWithin(tx, scope, ncrId, disposition));
}
