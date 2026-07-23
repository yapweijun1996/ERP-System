// Canonical financial reporting configuration and durable export jobs.
//
// Financial statements are derived from immutable gl_entry facts. These tables
// only describe presentation, approved plans/rates and asynchronous artifacts;
// they never duplicate actual ledger balances.
import {
  pgTable,
  text,
  bigint,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { account } from './finance';
import { appUser } from './tenancy';

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

export const financialStatementAccountMap = pgTable('financial_statement_account_map', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  accountId: bigint('account_id', { mode: 'number' }).notNull().references(() => account.id),
  section: text('section').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  // The account's natural debit/credit balance is converted to a statement
  // amount, then this policy controls whether that amount contributes positively
  // or negatively to statement totals.
  signPolicy: text('sign_policy').notNull().default('positive'),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_financial_statement_account_map')
    .on(t.masterFn, t.companyFn, t.accountId),
  index('idx_financial_statement_map_section')
    .on(t.masterFn, t.companyFn, t.section, t.displayOrder, t.accountId),
  check('ck_financial_statement_section', sql`${t.section} in (
    'revenue','cost_of_sales','operating_expense','other_income','other_expense','tax'
  )`),
  check('ck_financial_statement_sign', sql`${t.signPolicy} in ('positive','negative')`),
]);

export const budgetVersion = pgTable('budget_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  fiscalYear: integer('fiscal_year').notNull(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('draft'),
  isActive: boolean('is_active').notNull().default(false),
  version: integer('version').notNull().default(1),
  approvedByUserId: bigint('approved_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('idx_budget_version_company')
    .on(t.masterFn, t.companyFn, t.fiscalYear, t.status, t.id),
  uniqueIndex('uq_budget_version_name')
    .on(t.masterFn, t.companyFn, t.fiscalYear, t.name),
  uniqueIndex('uq_budget_version_active')
    .on(t.masterFn, t.companyFn, t.fiscalYear)
    .where(sql`${t.isActive} = true`),
  check('ck_budget_version_status', sql`${t.status} in ('draft','approved','archived')`),
  check('ck_budget_version_currency', sql`char_length(${t.currency}) = 3`),
  check('ck_budget_version_active_status', sql`not ${t.isActive} or ${t.status} = 'approved'`),
]);

export const budgetLine = pgTable('budget_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  budgetVersionId: bigint('budget_version_id', { mode: 'number' })
    .notNull().references(() => budgetVersion.id),
  accountId: bigint('account_id', { mode: 'number' }).notNull().references(() => account.id),
  periodNo: integer('period_no').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_budget_line_period_account')
    .on(t.masterFn, t.companyFn, t.budgetVersionId, t.accountId, t.periodNo),
  index('idx_budget_line_version')
    .on(t.masterFn, t.companyFn, t.budgetVersionId, t.periodNo, t.accountId),
  check('ck_budget_line_period', sql`${t.periodNo} between 1 and 53`),
  check('ck_budget_line_amount', sql`${t.amount} >= 0`),
]);

/** Approved period-average consolidation rates. company_fn is the source
 * company, so tenant RLS remains effective even when a report combines several
 * separately authorised companies. */
export const consolidationRate = pgTable('consolidation_rate', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  fiscalYear: integer('fiscal_year').notNull(),
  periodNo: integer('period_no').notNull(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  averageRate: numeric('average_rate', { precision: 18, scale: 8 }).notNull(),
  source: text('source').notNull(),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  approvedByUserId: bigint('approved_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_consolidation_rate_period')
    .on(
      t.masterFn,
      t.companyFn,
      t.fiscalYear,
      t.periodNo,
      t.fromCurrency,
      t.toCurrency,
    ),
  index('idx_consolidation_rate_lookup')
    .on(t.masterFn, t.companyFn, t.status, t.fiscalYear, t.periodNo, t.id),
  check('ck_consolidation_rate_period', sql`${t.periodNo} between 1 and 53`),
  check('ck_consolidation_rate_positive', sql`${t.averageRate} > 0`),
  check('ck_consolidation_rate_currency', sql`
    char_length(${t.fromCurrency}) = 3
    and char_length(${t.toCurrency}) = 3
    and ${t.fromCurrency} <> ${t.toCurrency}
  `),
  check('ck_consolidation_rate_status', sql`${t.status} in ('draft','approved','archived')`),
]);

export const reportJob = pgTable('report_job', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  reportKey: text('report_key').notNull(),
  format: text('format').notNull(),
  locale: text('locale').notNull().default('en'),
  presentationCurrency: text('presentation_currency').notNull(),
  filters: jsonb('filters').notNull(),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastError: text('last_error'),
  ...timestamps,
}, (t) => [
  index('idx_report_job_queue').on(t.status, t.availableAt, t.id),
  index('idx_report_job_actor')
    .on(t.masterFn, t.companyFn, t.actorUserId, t.createdAt, t.id),
  check('ck_report_job_key', sql`${t.reportKey} in ('profit_loss')`),
  check('ck_report_job_format', sql`${t.format} in ('xlsx','pdf')`),
  check('ck_report_job_status', sql`${t.status} in (
    'queued','running','succeeded','failed','expired'
  )`),
  check('ck_report_job_attempts', sql`${t.attempts} >= 0 and ${t.attempts} <= 3`),
  check('ck_report_job_currency', sql`char_length(${t.presentationCurrency}) = 3`),
]);

export const reportArtifact = pgTable('report_artifact', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  jobId: bigint('job_id', { mode: 'number' }).notNull().references(() => reportJob.id),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sha256: text('sha256').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  content: bytea('content').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_report_artifact_job').on(t.masterFn, t.companyFn, t.jobId),
  index('idx_report_artifact_expiry').on(t.expiresAt, t.id),
  check('ck_report_artifact_size', sql`${t.sizeBytes} > 0`),
]);
