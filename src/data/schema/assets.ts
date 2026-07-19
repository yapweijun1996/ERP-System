// Fixed Assets: register → depreciation run → balanced GL posting. Tenant-scoped.
// See docs/DATA_MODEL.md. asset.accumulated_depreciation is a running aggregate
// (mirrors inventory's stock_level); depreciation_run_line is the real, append-only
// posting ledger (mirrors stock_movement) — no fabricated future schedule is stored,
// only what has actually been posted.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';

export const ASSET_CATEGORIES = [
  'Plant & Machinery', 'Vehicles', 'Lab Equipment',
  'Furniture & Fixtures', 'IT Equipment', 'Warehouse Equipment',
] as const;

export const asset = pgTable('asset', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  assetNo: text('asset_no').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  location: text('location'),
  acquisitionDate: date('acquisition_date').notNull(),
  cost: numeric('cost', { precision: 18, scale: 2 }).notNull(),
  residualValue: numeric('residual_value', { precision: 18, scale: 2 }).notNull().default('0'),
  usefulLifeYears: integer('useful_life_years').notNull(),
  method: text('method').notNull().default('straight_line'),
  accumulatedDepreciation: numeric('accumulated_depreciation', { precision: 18, scale: 2 })
    .notNull().default('0'),
  status: text('status').notNull().default('in_use'),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_asset_no').on(t.masterFn, t.companyFn, t.assetNo),
  index('idx_asset_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check(
    'ck_asset_category',
    sql`${t.category} in ('Plant & Machinery', 'Vehicles', 'Lab Equipment', 'Furniture & Fixtures', 'IT Equipment', 'Warehouse Equipment')`,
  ),
  check(
    'ck_asset_status',
    sql`${t.status} in ('in_use', 'under_maintenance', 'idle', 'disposed')`,
  ),
  check('ck_asset_method', sql`${t.method} = 'straight_line'`),
  check(
    'ck_asset_amounts',
    sql`${t.cost} >= 0 and ${t.residualValue} >= 0 and ${t.residualValue} <= ${t.cost} and ${t.usefulLifeYears} > 0`,
  ),
]);

export const depreciationRun = pgTable('depreciation_run', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  runDate: date('run_date').notNull(),
  status: text('status').notNull().default('draft'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  version: integer('version').notNull().default(1),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_depreciation_run_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_depreciation_run_date').on(t.masterFn, t.companyFn, t.runDate, t.id),
  check(
    'ck_depreciation_run_status',
    sql`${t.status} in ('draft', 'posted', 'cancelled')`,
  ),
]);

export const depreciationRunLine = pgTable('depreciation_run_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  runId: bigint('run_id', { mode: 'number' }).notNull().references(() => depreciationRun.id),
  lineNo: integer('line_no').notNull(),
  assetId: bigint('asset_id', { mode: 'number' }).notNull().references(() => asset.id),
  openingNbv: numeric('opening_nbv', { precision: 18, scale: 2 }).notNull(),
  depreciationAmount: numeric('depreciation_amount', { precision: 18, scale: 2 }).notNull(),
  closingNbv: numeric('closing_nbv', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_depreciation_run_line').on(t.masterFn, t.companyFn, t.runId, t.lineNo),
  index('idx_depreciation_run_line_asset').on(t.masterFn, t.companyFn, t.assetId, t.runId),
  check('ck_depreciation_run_line_amounts', sql`${t.depreciationAmount} >= 0`),
]);
