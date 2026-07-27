import {
  pgTable, text, bigint, integer, boolean, timestamp, jsonb,
  index, uniqueIndex, primaryKey, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser, role } from './tenancy';

export const DATA_SCOPES = ['self', 'team', 'department', 'company'] as const;

/** Per-role row visibility. Absence is intentionally fail-closed for resources
 * that opt into scoped authorization. */
export const roleResourceScope = pgTable('role_resource_scope', {
  ...tenant,
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => role.roleId),
  resourceKey: text('resource_key').notNull(),
  scope: text('scope').notNull(),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.roleId, t.resourceKey] }),
  index('idx_role_resource_scope_tenant').on(
    t.masterFn, t.companyFn, t.resourceKey, t.scope, t.roleId,
  ),
  check('ck_role_resource_scope_value', sql`${t.scope} in ('self', 'team', 'department', 'company')`),
]);

/** Company-local module readiness replaces the legacy master-wide override.
 * Missing rows mean disabled for new companies; migrations and setup explicitly
 * create rows so the decision is never inferred from unrelated tenant state. */
export const companyModule = pgTable('company_module', {
  ...tenant,
  moduleKey: text('module_key').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  configured: boolean('configured').notNull().default(false),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.masterFn, t.companyFn, t.moduleKey] }),
  index('idx_company_module_state').on(t.masterFn, t.companyFn, t.enabled, t.moduleKey),
]);

/** Non-secret resumable HR draft. Initial passwords are accepted only by the
 * activation command and are never stored in this JSON. */
export const staffOnboardingDraft = pgTable('staff_onboarding_draft', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  status: text('status').notNull().default('draft'),
  employeeData: jsonb('employee_data').notNull(),
  username: text('username').notNull(),
  email: text('email').notNull(),
  roleIds: jsonb('role_ids').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  activatedUserId: bigint('activated_user_id', { mode: 'number' }).references(() => appUser.userId),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_staff_onboarding_username_active')
    .on(t.masterFn, t.companyFn, t.username)
    .where(sql`${t.status} = 'draft'`),
  index('idx_staff_onboarding_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_staff_onboarding_status', sql`${t.status} in ('draft', 'activated', 'cancelled')`),
  check('ck_staff_onboarding_version', sql`${t.version} > 0`),
]);

export const companyOnboarding = pgTable('company_onboarding', {
  ...tenant,
  status: text('status').notNull().default('setup'),
  currentStage: text('current_stage').notNull().default('company'),
  completedSteps: jsonb('completed_steps').notNull().default([]),
  goLiveAt: timestamp('go_live_at', { withTimezone: true }),
  goLiveByUserId: bigint('go_live_by_user_id', { mode: 'number' }).references(() => appUser.userId),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.masterFn, t.companyFn] }),
  index('idx_company_onboarding_status').on(t.masterFn, t.status, t.companyFn),
  check('ck_company_onboarding_status', sql`${t.status} in ('setup', 'live')`),
  check('ck_company_onboarding_stage', sql`${t.currentStage} in (
    'company', 'fiscal', 'warehouse', 'modules', 'roles', 'staff',
    'import', 'opening_balance', 'uat', 'live'
  )`),
]);

/** Bounded normalized rows only; original files and credentials are never stored. */
export const onboardingImportJob = pgTable('onboarding_import_job', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  target: text('target').notNull(),
  format: text('format').notNull(),
  fileName: text('file_name').notNull(),
  sourceHash: text('source_hash').notNull(),
  status: text('status').notNull().default('validated'),
  totalRows: integer('total_rows').notNull(),
  errorRows: integer('error_rows').notNull().default(0),
  warningRows: integer('warning_rows').notNull().default(0),
  importedRows: integer('imported_rows').notNull().default(0),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  committedAt: timestamp('committed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_onboarding_import_source').on(t.masterFn, t.companyFn, t.target, t.sourceHash),
  index('idx_onboarding_import_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_onboarding_import_format', sql`${t.format} in ('csv', 'xlsx')`),
  check('ck_onboarding_import_status', sql`${t.status} in ('validated', 'invalid', 'committed', 'failed')`),
  check('ck_onboarding_import_counts', sql`
    ${t.totalRows} >= 0 and ${t.errorRows} >= 0 and ${t.warningRows} >= 0 and ${t.importedRows} >= 0
  `),
]);

export const onboardingImportRow = pgTable('onboarding_import_row', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  jobId: bigint('job_id', { mode: 'number' }).notNull().references(() => onboardingImportJob.id),
  rowNumber: integer('row_number').notNull(),
  normalizedData: jsonb('normalized_data').notNull(),
  errors: jsonb('errors').notNull().default([]),
  warnings: jsonb('warnings').notNull().default([]),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_onboarding_import_row').on(t.masterFn, t.companyFn, t.jobId, t.rowNumber),
  index('idx_onboarding_import_row_job').on(t.masterFn, t.companyFn, t.jobId, t.id),
  check('ck_onboarding_import_row_number', sql`${t.rowNumber} > 0`),
]);
