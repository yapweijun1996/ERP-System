// Integration and user-level import state. Import source files are parsed into a
// deliberately bounded, target-specific row shape before they reach this schema;
// arbitrary file contents and credentials are never stored in import_job.
import {
  pgTable, text, bigint, integer, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';
import { customer } from './sales';

export const importJob = pgTable('import_job', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  target: text('target').notNull(),
  fileName: text('file_name').notNull(),
  duplicateStrategy: text('duplicate_strategy').notNull(),
  status: text('status').notNull().default('validated'),
  totalRows: integer('total_rows').notNull(),
  readyRows: integer('ready_rows').notNull().default(0),
  errorRows: integer('error_rows').notNull().default(0),
  skippedRows: integer('skipped_rows').notNull().default(0),
  importedRows: integer('imported_rows').notNull().default(0),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' })
    .notNull().references(() => appUser.userId),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  index('idx_import_job_tenant_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_import_job_target', sql`${t.target} in ('customer')`),
  check(
    'ck_import_job_duplicate_strategy',
    sql`${t.duplicateStrategy} in ('update_existing', 'skip_existing')`,
  ),
  check(
    'ck_import_job_status',
    sql`${t.status} in ('validated', 'invalid', 'processing', 'completed', 'failed')`,
  ),
  check(
    'ck_import_job_counts',
    sql`${t.totalRows} >= 0 and ${t.readyRows} >= 0 and ${t.errorRows} >= 0 and ${t.skippedRows} >= 0 and ${t.importedRows} >= 0`,
  ),
]);

export const importJobRow = pgTable('import_job_row', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  jobId: bigint('job_id', { mode: 'number' }).notNull().references(() => importJob.id),
  rowNumber: integer('row_number').notNull(),
  code: text('code'),
  name: text('name'),
  industry: text('industry'),
  operation: text('operation').notNull(),
  status: text('status').notNull(),
  importedCustomerId: bigint('imported_customer_id', { mode: 'number' }).references(() => customer.id),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_import_job_row_number').on(t.masterFn, t.companyFn, t.jobId, t.rowNumber),
  index('idx_import_job_row_job').on(t.masterFn, t.companyFn, t.jobId, t.id),
  check('ck_import_job_row_number', sql`${t.rowNumber} > 0`),
  check('ck_import_job_row_operation', sql`${t.operation} in ('create', 'update', 'skip', 'invalid')`),
  check('ck_import_job_row_status', sql`${t.status} in ('ready', 'error', 'skipped', 'imported')`),
]);

export const importRowError = pgTable('import_row_error', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  jobId: bigint('job_id', { mode: 'number' }).notNull().references(() => importJob.id),
  rowNumber: integer('row_number').notNull(),
  field: text('field').notNull(),
  errorCode: text('error_code').notNull(),
  message: text('message').notNull(),
  ...timestamps,
}, (t) => [
  index('idx_import_row_error_job').on(t.masterFn, t.companyFn, t.jobId, t.rowNumber, t.id),
  check('ck_import_row_error_number', sql`${t.rowNumber} > 0`),
]);
