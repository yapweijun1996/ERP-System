// Quality module: reusable inspection plans, immutable inspection result
// snapshots, non-conformance records and corrective actions. A failed
// lot-linked inspection places the inventory lot on quality hold through the
// shared domain command; the tables alone never bypass inventory rules.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, boolean,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { inventoryLot, product } from './inventory';

export const qualityInspectionPlan = pgTable('quality_inspection_plan', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  inspectionType: text('inspection_type').notNull(), // incoming | in_process | final
  productId: bigint('product_id', { mode: 'number' }).references(() => product.id),
  sampleSize: numeric('sample_size', { precision: 18, scale: 4 }).notNull().default('1'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_quality_inspection_plan_code').on(t.masterFn, t.companyFn, t.code),
  index('idx_quality_inspection_plan_active').on(
    t.masterFn, t.companyFn, t.inspectionType, t.isActive, t.id,
  ),
  check('ck_quality_inspection_plan_type', sql`${t.inspectionType} in ('incoming', 'in_process', 'final')`),
  check('ck_quality_inspection_plan_sample', sql`${t.sampleSize} > 0`),
]);

export const qualityInspectionPlanItem = pgTable('quality_inspection_plan_item', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  planId: bigint('plan_id', { mode: 'number' }).notNull()
    .references(() => qualityInspectionPlan.id),
  sequence: integer('sequence').notNull(),
  characteristic: text('characteristic').notNull(),
  specification: text('specification').notNull(),
  method: text('method').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_quality_inspection_plan_item_sequence').on(
    t.masterFn, t.companyFn, t.planId, t.sequence,
  ),
  index('idx_quality_inspection_plan_item').on(t.masterFn, t.companyFn, t.planId, t.id),
  check('ck_quality_inspection_plan_item_sequence', sql`${t.sequence} > 0`),
]);

export const qualityInspection = pgTable('quality_inspection', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('scheduled'),
  version: integer('version').notNull().default(1),
  inspectionType: text('inspection_type').notNull(),
  planId: bigint('plan_id', { mode: 'number' }).notNull()
    .references(() => qualityInspectionPlan.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  lotId: bigint('lot_id', { mode: 'number' }).references(() => inventoryLot.id),
  sourceType: text('source_type').notNull(),
  sourceId: bigint('source_id', { mode: 'number' }),
  sourceRef: text('source_ref'),
  lotQty: numeric('lot_qty', { precision: 18, scale: 4 }).notNull(),
  sampleQty: numeric('sample_qty', { precision: 18, scale: 4 }).notNull(),
  inspectorName: text('inspector_name').notNull(),
  inspectionDate: date('inspection_date').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_quality_inspection_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_quality_inspection_status').on(
    t.masterFn, t.companyFn, t.status, t.inspectionDate, t.id,
  ),
  index('idx_quality_inspection_lot').on(t.masterFn, t.companyFn, t.lotId, t.id),
  check('ck_quality_inspection_status', sql`${t.status} in ('scheduled', 'in_inspection', 'passed', 'failed', 'closed')`),
  check('ck_quality_inspection_type', sql`${t.inspectionType} in ('incoming', 'in_process', 'final')`),
  check('ck_quality_inspection_source', sql`${t.sourceType} in ('goods_receipt', 'work_order', 'manual')`),
  check('ck_quality_inspection_qty', sql`${t.lotQty} > 0 and ${t.sampleQty} > 0 and ${t.sampleQty} <= ${t.lotQty}`),
]);

export const qualityInspectionResult = pgTable('quality_inspection_result', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  inspectionId: bigint('inspection_id', { mode: 'number' }).notNull()
    .references(() => qualityInspection.id),
  planItemId: bigint('plan_item_id', { mode: 'number' })
    .references(() => qualityInspectionPlanItem.id),
  sequence: integer('sequence').notNull(),
  characteristic: text('characteristic').notNull(),
  specification: text('specification').notNull(),
  method: text('method').notNull(),
  measuredValue: text('measured_value'),
  result: text('result').notNull().default('pending'), // pending | pass | fail
  defectClass: text('defect_class'), // critical | major | minor
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_quality_inspection_result_sequence').on(
    t.masterFn, t.companyFn, t.inspectionId, t.sequence,
  ),
  index('idx_quality_inspection_result').on(
    t.masterFn, t.companyFn, t.inspectionId, t.result, t.id,
  ),
  check('ck_quality_inspection_result_status', sql`${t.result} in ('pending', 'pass', 'fail')`),
  check('ck_quality_inspection_result_defect', sql`${t.defectClass} is null or ${t.defectClass} in ('critical', 'major', 'minor')`),
]);

export const qualityNcr = pgTable('quality_ncr', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('open'), // open | in_progress | closed
  version: integer('version').notNull().default(1),
  inspectionId: bigint('inspection_id', { mode: 'number' }).notNull()
    .references(() => qualityInspection.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  lotId: bigint('lot_id', { mode: 'number' }).references(() => inventoryLot.id),
  severity: text('severity').notNull(),
  affectedQty: numeric('affected_qty', { precision: 18, scale: 4 }).notNull(),
  defectDescription: text('defect_description').notNull(),
  disposition: text('disposition').notNull().default('quarantine'),
  rootCause: text('root_cause'),
  raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_quality_ncr_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_quality_ncr_inspection').on(t.masterFn, t.companyFn, t.inspectionId),
  index('idx_quality_ncr_status').on(t.masterFn, t.companyFn, t.status, t.raisedAt, t.id),
  index('idx_quality_ncr_lot').on(t.masterFn, t.companyFn, t.lotId, t.id),
  check('ck_quality_ncr_status', sql`${t.status} in ('open', 'in_progress', 'closed')`),
  check('ck_quality_ncr_severity', sql`${t.severity} in ('critical', 'major', 'minor')`),
  check('ck_quality_ncr_disposition', sql`${t.disposition} in ('quarantine', 'release', 'rework', 'return', 'scrap')`),
  check('ck_quality_ncr_qty', sql`${t.affectedQty} > 0`),
]);

export const qualityCorrectiveAction = pgTable('quality_corrective_action', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  ncrId: bigint('ncr_id', { mode: 'number' }).notNull().references(() => qualityNcr.id),
  sequence: integer('sequence').notNull(),
  action: text('action').notNull(),
  ownerName: text('owner_name').notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').notNull().default('open'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_quality_corrective_action_sequence').on(
    t.masterFn, t.companyFn, t.ncrId, t.sequence,
  ),
  index('idx_quality_corrective_action_status').on(
    t.masterFn, t.companyFn, t.status, t.dueDate, t.id,
  ),
  check('ck_quality_corrective_action_status', sql`${t.status} in ('open', 'in_progress', 'completed')`),
  check('ck_quality_corrective_action_sequence', sql`${t.sequence} > 0`),
]);
