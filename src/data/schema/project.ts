// Project module: project register + progress-claim billing. Tenant-scoped.
// A progress claim posts the exact same AR/Revenue/Output-Tax legs as a sales
// debit note (see modules/sales/debitNote.ts) — one document, one balanced
// journal, no new chart-of-accounts codes. No `type` column: Customer vs.
// Internal is derived from `customer_id` presence rather than stored
// redundantly. `billed_to_date` is a running aggregate incremented when a
// claim posts, mirroring `asset.accumulated_depreciation`'s aggregate-plus-
// ledger shape.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { customer } from './sales';
import { appUser } from './tenancy';

export const PROJECT_STATUSES = ['open', 'on_hold', 'completed'] as const;
export const PROJECT_TIME_ENTRY_STATUSES = ['active', 'voided'] as const;

export const project = pgTable('project', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  projectNo: text('project_no').notNull(),
  name: text('name').notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).references(() => customer.id),
  managerName: text('manager_name').notNull(),
  status: text('status').notNull().default('open'),
  startDate: date('start_date').notNull(),
  dueDate: date('due_date'),
  contractValue: numeric('contract_value', { precision: 18, scale: 2 }).notNull().default('0'),
  billedToDate: numeric('billed_to_date', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_project_no').on(t.masterFn, t.companyFn, t.projectNo),
  index('idx_project_status').on(t.masterFn, t.companyFn, t.status, t.id),
  index('idx_project_customer').on(t.masterFn, t.companyFn, t.customerId),
  check('ck_project_status', sql`${t.status} in ('open', 'on_hold', 'completed')`),
  check('ck_project_contract', sql`${t.contractValue} >= 0`),
]);

export const progressClaim = pgTable('progress_claim', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  projectId: bigint('project_id', { mode: 'number' }).notNull().references(() => project.id),
  status: text('status').notNull().default('draft'), // draft | posted
  version: integer('version').notNull().default(1),
  claimDate: date('claim_date').notNull(),
  description: text('description').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_progress_claim_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_progress_claim_project').on(t.masterFn, t.companyFn, t.projectId, t.id),
  index('idx_progress_claim_status').on(t.masterFn, t.companyFn, t.status, t.claimDate, t.id),
  check('ck_progress_claim_status', sql`${t.status} in ('draft', 'posted')`),
  check('ck_progress_claim_amount', sql`${t.netAmount} > 0 and ${t.taxAmount} >= 0`),
]);

/**
 * One auditable time fact owned by the signed-in ERP user. Time entries stay
 * deliberately separate from HR employees: an employee master record does not
 * imply a login, while every entry must have an authenticated actor. Corrections
 * void the original fact instead of deleting or overwriting it.
 */
export const projectTimeEntry = pgTable('project_time_entry', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  projectId: bigint('project_id', { mode: 'number' }).notNull()
    .references(() => project.id),
  workDate: date('work_date').notNull(),
  task: text('task').notNull(),
  hours: numeric('hours', { precision: 5, scale: 2 }).notNull(),
  status: text('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
  voidReason: text('void_reason'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('idx_project_time_entry_user_date').on(
    t.masterFn, t.companyFn, t.actorUserId, t.workDate, t.id,
  ),
  index('idx_project_time_entry_project_date').on(
    t.masterFn, t.companyFn, t.projectId, t.workDate, t.id,
  ),
  check('ck_project_time_entry_hours', sql`${t.hours} > 0 and ${t.hours} <= 24`),
  check('ck_project_time_entry_status', sql`${t.status} in ('active', 'voided')`),
  check(
    'ck_project_time_entry_void_state',
    sql`(${t.status} = 'active' and ${t.voidReason} is null and ${t.voidedAt} is null)
      or (${t.status} = 'voided' and ${t.voidReason} is not null and ${t.voidedAt} is not null)`,
  ),
]);
