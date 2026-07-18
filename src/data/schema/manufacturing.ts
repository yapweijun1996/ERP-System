// Manufacturing module: work centres, versioned BOM/routing master data and
// immutable work-order snapshots. All quantities and costs use fixed-point
// numeric columns and every table is tenant scoped.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, boolean,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { product, warehouse } from './inventory';

export const workCenter = pgTable('work_center', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  capacityHoursPerDay: numeric('capacity_hours_per_day', { precision: 10, scale: 2 })
    .notNull().default('8'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_work_center_code').on(t.masterFn, t.companyFn, t.code),
  index('idx_work_center_active').on(t.masterFn, t.companyFn, t.isActive, t.id),
  check('ck_work_center_capacity', sql`${t.capacityHoursPerDay} > 0`),
]);

export const manufacturingBom = pgTable('manufacturing_bom', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'), // active | inactive
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_manufacturing_bom_code').on(t.masterFn, t.companyFn, t.code),
  index('idx_manufacturing_bom_product').on(t.masterFn, t.companyFn, t.productId, t.status),
  check('ck_manufacturing_bom_status', sql`${t.status} in ('active', 'inactive')`),
]);

export const bomVersion = pgTable('bom_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  bomId: bigint('bom_id', { mode: 'number' }).notNull().references(() => manufacturingBom.id),
  revision: text('revision').notNull(),
  status: text('status').notNull().default('draft'), // draft | active | obsolete
  effectiveFrom: date('effective_from').notNull(),
  outputQty: numeric('output_qty', { precision: 18, scale: 4 }).notNull().default('1'),
  uom: text('uom').notNull(),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_bom_version_revision').on(t.masterFn, t.companyFn, t.bomId, t.revision),
  index('idx_bom_version_active').on(t.masterFn, t.companyFn, t.bomId, t.status, t.effectiveFrom),
  check('ck_bom_version_status', sql`${t.status} in ('draft', 'active', 'obsolete')`),
  check('ck_bom_version_output_qty', sql`${t.outputQty} > 0`),
]);

export const bomComponent = pgTable('bom_component', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  bomVersionId: bigint('bom_version_id', { mode: 'number' }).notNull().references(() => bomVersion.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qtyPer: numeric('qty_per', { precision: 18, scale: 4 }).notNull(),
  scrapPct: numeric('scrap_pct', { precision: 7, scale: 4 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_bom_component_line').on(t.masterFn, t.companyFn, t.bomVersionId, t.lineNo),
  index('idx_bom_component_product').on(t.masterFn, t.companyFn, t.productId, t.bomVersionId),
  check('ck_bom_component_qty', sql`${t.qtyPer} > 0`),
  check('ck_bom_component_scrap', sql`${t.scrapPct} >= 0 and ${t.scrapPct} <= 100`),
]);

export const manufacturingRouting = pgTable('manufacturing_routing', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'), // active | inactive
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_manufacturing_routing_code').on(t.masterFn, t.companyFn, t.code),
  index('idx_manufacturing_routing_product').on(t.masterFn, t.companyFn, t.productId, t.status),
  check('ck_manufacturing_routing_status', sql`${t.status} in ('active', 'inactive')`),
]);

export const routingOperation = pgTable('routing_operation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  routingId: bigint('routing_id', { mode: 'number' }).notNull()
    .references(() => manufacturingRouting.id),
  sequence: integer('sequence').notNull(),
  workCenterId: bigint('work_center_id', { mode: 'number' }).notNull().references(() => workCenter.id),
  name: text('name').notNull(),
  setupHours: numeric('setup_hours', { precision: 10, scale: 4 }).notNull().default('0'),
  runHoursPerUnit: numeric('run_hours_per_unit', { precision: 10, scale: 4 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_routing_operation_sequence').on(
    t.masterFn, t.companyFn, t.routingId, t.sequence,
  ),
  index('idx_routing_operation_work_center').on(
    t.masterFn, t.companyFn, t.workCenterId, t.routingId,
  ),
  check('ck_routing_operation_hours', sql`${t.setupHours} >= 0 and ${t.runHoursPerUnit} >= 0`),
]);

export const workOrder = pgTable('work_order', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('planned'),
  version: integer('version').notNull().default(1),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  bomVersionId: bigint('bom_version_id', { mode: 'number' }).notNull().references(() => bomVersion.id),
  routingId: bigint('routing_id', { mode: 'number' }).notNull().references(() => manufacturingRouting.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  plannedQty: numeric('planned_qty', { precision: 18, scale: 4 }).notNull(),
  completedQty: numeric('completed_qty', { precision: 18, scale: 4 }).notNull().default('0'),
  startDate: date('start_date').notNull(),
  dueDate: date('due_date').notNull(),
  priority: text('priority').notNull().default('normal'),
  demandSource: text('demand_source'),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_work_order_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_work_order_status').on(t.masterFn, t.companyFn, t.status, t.dueDate, t.id),
  index('idx_work_order_product').on(t.masterFn, t.companyFn, t.productId, t.id),
  check('ck_work_order_status', sql`${t.status} in ('planned', 'released', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled')`),
  check('ck_work_order_qty', sql`${t.plannedQty} > 0 and ${t.completedQty} >= 0 and ${t.completedQty} <= ${t.plannedQty}`),
  check('ck_work_order_priority', sql`${t.priority} in ('low', 'normal', 'high', 'urgent')`),
  check('ck_work_order_dates', sql`${t.dueDate} >= ${t.startDate}`),
]);

export const workOrderMaterial = pgTable('work_order_material', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  workOrderId: bigint('work_order_id', { mode: 'number' }).notNull().references(() => workOrder.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  requiredQty: numeric('required_qty', { precision: 18, scale: 4 }).notNull(),
  issuedQty: numeric('issued_qty', { precision: 18, scale: 4 }).notNull().default('0'),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_work_order_material_line').on(
    t.masterFn, t.companyFn, t.workOrderId, t.lineNo,
  ),
  index('idx_work_order_material_product').on(
    t.masterFn, t.companyFn, t.productId, t.workOrderId,
  ),
  check('ck_work_order_material_qty', sql`${t.requiredQty} > 0 and ${t.issuedQty} >= 0 and ${t.issuedQty} <= ${t.requiredQty}`),
]);

export const workOrderOperation = pgTable('work_order_operation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  workOrderId: bigint('work_order_id', { mode: 'number' }).notNull().references(() => workOrder.id),
  sequence: integer('sequence').notNull(),
  workCenterId: bigint('work_center_id', { mode: 'number' }).notNull().references(() => workCenter.id),
  name: text('name').notNull(),
  plannedHours: numeric('planned_hours', { precision: 12, scale: 4 }).notNull(),
  actualHours: numeric('actual_hours', { precision: 12, scale: 4 }).notNull().default('0'),
  status: text('status').notNull().default('pending'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_work_order_operation_sequence').on(
    t.masterFn, t.companyFn, t.workOrderId, t.sequence,
  ),
  index('idx_work_order_operation_work_center').on(
    t.masterFn, t.companyFn, t.workCenterId, t.status,
  ),
  check('ck_work_order_operation_hours', sql`${t.plannedHours} >= 0 and ${t.actualHours} >= 0`),
  check('ck_work_order_operation_status', sql`${t.status} in ('pending', 'ready', 'in_progress', 'completed', 'blocked', 'skipped')`),
]);

export const mrpRun = pgTable('mrp_run', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('completed'), // running | completed | failed
  version: integer('version').notNull().default(1),
  planningDate: date('planning_date').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_mrp_run_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_mrp_run_date').on(t.masterFn, t.companyFn, t.planningDate, t.id),
  check('ck_mrp_run_status', sql`${t.status} in ('running', 'completed', 'failed')`),
]);

export const mrpSuggestion = pgTable('mrp_suggestion', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  mrpRunId: bigint('mrp_run_id', { mode: 'number' }).notNull().references(() => mrpRun.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  grossRequirement: numeric('gross_requirement', { precision: 18, scale: 4 }).notNull(),
  onHand: numeric('on_hand', { precision: 18, scale: 4 }).notNull(),
  onOrder: numeric('on_order', { precision: 18, scale: 4 }).notNull().default('0'),
  netRequirement: numeric('net_requirement', { precision: 18, scale: 4 }).notNull(),
  action: text('action').notNull(), // purchase | sufficient
  status: text('status').notNull().default('open'), // open | accepted | dismissed
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_mrp_suggestion_product').on(
    t.masterFn, t.companyFn, t.mrpRunId, t.productId,
  ),
  index('idx_mrp_suggestion_action').on(
    t.masterFn, t.companyFn, t.action, t.status, t.id,
  ),
  check('ck_mrp_suggestion_qty', sql`${t.grossRequirement} >= 0 and ${t.onHand} >= 0 and ${t.onOrder} >= 0`),
  check('ck_mrp_suggestion_action', sql`${t.action} in ('purchase', 'sufficient')`),
  check('ck_mrp_suggestion_status', sql`${t.status} in ('open', 'accepted', 'dismissed')`),
]);
