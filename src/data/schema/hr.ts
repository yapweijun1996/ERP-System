// HR employee master, account lifecycle and leave requests. Employee records remain
// valid without a login; when present, `user_id` is unique within the company.
import {
  pgTable, text, bigint, integer, numeric, boolean, date, timestamp, jsonb,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'] as const;
export const LEAVE_TYPES = ['Annual', 'Medical', 'Unpaid'] as const;

export const employee = pgTable('employee', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  employeeNo: text('employee_no').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  department: text('department').notNull(),
  jobTitle: text('job_title').notNull(),
  employmentType: text('employment_type').notNull().default('Full-time'),
  userId: bigint('user_id', { mode: 'number' }).references(() => appUser.userId),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- self-referencing FK: TS can't resolve employee's own type while still defining it, Drizzle's own docs use this exact escape hatch
  managerId: bigint('manager_id', { mode: 'number' }).references((): any => employee.id),
  startDate: date('start_date').notNull(),
  annualLeaveDays: integer('annual_leave_days').notNull().default(14),
  // One flat period base salary regardless of employmentType -- no wage-type
  // modeling (hourly/piece-rate). Payroll (EPIC-026) is the only consumer today.
  baseSalary: numeric('base_salary', { precision: 18, scale: 2 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_employee_no').on(t.masterFn, t.companyFn, t.employeeNo),
  uniqueIndex('uq_employee_company_user')
    .on(t.masterFn, t.companyFn, t.userId)
    .where(sql`${t.userId} is not null`),
  index('idx_employee_active').on(t.masterFn, t.companyFn, t.isActive, t.id),
  check(
    'ck_employee_employment_type',
    sql`${t.employmentType} in ('Full-time', 'Part-time', 'Contract', 'Intern')`,
  ),
  check('ck_employee_leave_days', sql`${t.annualLeaveDays} >= 0`),
  check('ck_employee_base_salary', sql`${t.baseSalary} > 0`),
]);

/** Recoverable only before first-login completion. The JSON value is an
 * AES-256-GCM envelope, never plaintext. Cleared rows are retained as evidence. */
export const employeeActivationSecret = pgTable('employee_activation_secret', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employee.id),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  purpose: text('purpose').notNull(),
  generation: integer('generation').notNull().default(1),
  credentialEnvelope: jsonb('credential_envelope'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  clearedAt: timestamp('cleared_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_employee_activation_secret_active')
    .on(t.masterFn, t.companyFn, t.userId)
    .where(sql`${t.clearedAt} is null`),
  index('idx_employee_activation_secret_employee')
    .on(t.masterFn, t.companyFn, t.employeeId, t.id),
  check('ck_employee_activation_secret_purpose', sql`${t.purpose} in ('activation', 'reset')`),
  check('ck_employee_activation_secret_generation', sql`${t.generation} > 0`),
]);

/** Immutable summary of current-responsibility reassignment during offboarding.
 * Historical business-document attribution is deliberately untouched. */
export const employeeAccountHandoff = pgTable('employee_account_handoff', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  sourceEmployeeId: bigint('source_employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  sourceUserId: bigint('source_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  targetEmployeeId: bigint('target_employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  targetUserId: bigint('target_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  reason: text('reason').notNull(),
  directReportsTransferred: integer('direct_reports_transferred').notNull().default(0),
  customersTransferred: integer('customers_transferred').notNull().default(0),
  opportunitiesTransferred: integer('opportunities_transferred').notNull().default(0),
  notificationsTransferred: integer('notifications_transferred').notNull().default(0),
  performedByUserId: bigint('performed_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  index('idx_employee_account_handoff_source')
    .on(t.masterFn, t.companyFn, t.sourceEmployeeId, t.id),
  check('ck_employee_account_handoff_reason', sql`char_length(trim(${t.reason})) between 3 and 500`),
  check('ck_employee_account_handoff_counts', sql`
    ${t.directReportsTransferred} >= 0
    and ${t.customersTransferred} >= 0
    and ${t.opportunitiesTransferred} >= 0
    and ${t.notificationsTransferred} >= 0
  `),
]);

/** Explicit, time-bounded authority to widen a manager beyond their ordinary
 * direct reports. `tree` includes every descendant of the selected root. */
export const employeeHierarchyScope = pgTable('employee_hierarchy_scope', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  granteeEmployeeId: bigint('grantee_employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  scopeRootEmployeeId: bigint('scope_root_employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  scopeType: text('scope_type').notNull().default('direct'),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  grantedByUserId: bigint('granted_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  index('idx_employee_hierarchy_scope_grantee')
    .on(t.masterFn, t.companyFn, t.granteeEmployeeId, t.validFrom, t.validTo),
  check('ck_employee_hierarchy_scope_type', sql`${t.scopeType} in ('direct', 'tree')`),
  check(
    'ck_employee_hierarchy_scope_dates',
    sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`,
  ),
  check(
    'ck_employee_hierarchy_scope_distinct',
    sql`${t.granteeEmployeeId} <> ${t.scopeRootEmployeeId}`,
  ),
]);

/** Stable calendar identity. Effective work patterns live in immutable versions. */
export const workingCalendar = pgTable('working_calendar', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull().default('Asia/Singapore'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_working_calendar_code').on(t.masterFn, t.companyFn, t.code),
  uniqueIndex('uq_working_calendar_scope_id').on(t.id, t.masterFn, t.companyFn),
  uniqueIndex('uq_working_calendar_default')
    .on(t.masterFn, t.companyFn)
    .where(sql`${t.isDefault} = true`),
]);

/** Weekdays are ISO weekday numbers (1=Monday … 7=Sunday). */
export const workingCalendarVersion = pgTable('working_calendar_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  calendarId: bigint('calendar_id', { mode: 'number' }).notNull()
    .references(() => workingCalendar.id),
  versionNo: integer('version_no').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  weekdays: jsonb('weekdays').notNull(),
  status: text('status').notNull().default('draft'),
  confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_working_calendar_version')
    .on(t.masterFn, t.companyFn, t.calendarId, t.versionNo),
  uniqueIndex('uq_working_calendar_version_scope_id')
    .on(t.id, t.masterFn, t.companyFn),
  index('idx_working_calendar_version_effective')
    .on(t.masterFn, t.companyFn, t.calendarId, t.status, t.effectiveFrom, t.effectiveTo),
  check('ck_working_calendar_version_no', sql`${t.versionNo} > 0`),
  check(
    'ck_working_calendar_version_dates',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
  ),
  check(
    'ck_working_calendar_version_status',
    sql`${t.status} in ('draft', 'confirmed', 'retired')`,
  ),
  check(
    'ck_working_calendar_version_confirmation',
    sql`(${t.status} = 'confirmed' and ${t.confirmedAt} is not null and ${t.confirmedByUserId} is not null)
      or (${t.status} <> 'confirmed')`,
  ),
]);

/** Official imports remain draft until HR confirms them; company holidays are
 * explicit HR facts and are confirmed when created. */
export const calendarHoliday = pgTable('calendar_holiday', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  calendarVersionId: bigint('calendar_version_id', { mode: 'number' }).notNull()
    .references(() => workingCalendarVersion.id),
  holidayDate: date('holiday_date').notNull(),
  name: text('name').notNull(),
  source: text('source').notNull(),
  country: text('country'),
  status: text('status').notNull().default('draft'),
  confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_calendar_holiday')
    .on(t.masterFn, t.companyFn, t.calendarVersionId, t.holidayDate, t.name),
  index('idx_calendar_holiday_effective')
    .on(t.masterFn, t.companyFn, t.calendarVersionId, t.status, t.holidayDate),
  check('ck_calendar_holiday_source', sql`${t.source} in ('official', 'company')`),
  check('ck_calendar_holiday_status', sql`${t.status} in ('draft', 'confirmed')`),
  check(
    'ck_calendar_holiday_confirmation',
    sql`(${t.status} = 'confirmed' and ${t.confirmedAt} is not null and ${t.confirmedByUserId} is not null)
      or (${t.status} = 'draft' and ${t.confirmedAt} is null and ${t.confirmedByUserId} is null)`,
  ),
]);

/** Stable leave classification; calculation/governance rules live in versions. */
export const leaveType = pgTable('leave_type', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  paid: boolean('paid').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_leave_type_code').on(t.masterFn, t.companyFn, t.code),
  uniqueIndex('uq_leave_type_scope_id').on(t.id, t.masterFn, t.companyFn),
]);

export const leavePolicyVersion = pgTable('leave_policy_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  leaveTypeId: bigint('leave_type_id', { mode: 'number' }).notNull()
    .references(() => leaveType.id),
  calendarId: bigint('calendar_id', { mode: 'number' }).notNull()
    .references(() => workingCalendar.id),
  versionNo: integer('version_no').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: text('status').notNull().default('draft'),
  unitMode: text('unit_mode').notNull().default('full_and_half_day'),
  annualEntitlementDays: numeric('annual_entitlement_days', { precision: 8, scale: 2 })
    .notNull().default('0'),
  accrualMethod: text('accrual_method').notNull().default('upfront'),
  carryForwardDays: numeric('carry_forward_days', { precision: 8, scale: 2 })
    .notNull().default('0'),
  carryExpiryMonths: integer('carry_expiry_months'),
  evidenceAfterDays: numeric('evidence_after_days', { precision: 8, scale: 2 }),
  staffingAction: text('staffing_action').notNull().default('warn'),
  minimumStaff: integer('minimum_staff').notNull().default(0),
  encashmentAllowed: boolean('encashment_allowed').notNull().default(false),
  encashmentMaxDays: numeric('encashment_max_days', { precision: 8, scale: 2 })
    .notNull().default('0'),
  eligibleEmploymentTypes: jsonb('eligible_employment_types').notNull(),
  confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_leave_policy_version')
    .on(t.masterFn, t.companyFn, t.leaveTypeId, t.versionNo),
  index('idx_leave_policy_version_effective')
    .on(t.masterFn, t.companyFn, t.leaveTypeId, t.status, t.effectiveFrom, t.effectiveTo),
  check('ck_leave_policy_version_no', sql`${t.versionNo} > 0`),
  check(
    'ck_leave_policy_dates',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
  ),
  check('ck_leave_policy_status', sql`${t.status} in ('draft', 'confirmed', 'retired')`),
  check('ck_leave_policy_unit', sql`${t.unitMode} = 'full_and_half_day'`),
  check('ck_leave_policy_accrual', sql`${t.accrualMethod} in ('none', 'upfront', 'monthly')`),
  check(
    'ck_leave_policy_staffing',
    sql`${t.staffingAction} in ('warn', 'extra_approval', 'block') and ${t.minimumStaff} >= 0`,
  ),
  check(
    'ck_leave_policy_values',
    sql`${t.annualEntitlementDays} >= 0
      and ${t.carryForwardDays} >= 0
      and (${t.carryExpiryMonths} is null or ${t.carryExpiryMonths} > 0)
      and (${t.evidenceAfterDays} is null or ${t.evidenceAfterDays} >= 0.5)
      and ${t.encashmentMaxDays} >= 0`,
  ),
  check(
    'ck_leave_policy_encashment',
    sql`${t.encashmentAllowed} = true or ${t.encashmentMaxDays} = 0`,
  ),
  check(
    'ck_leave_policy_confirmation',
    sql`(${t.status} = 'confirmed' and ${t.confirmedAt} is not null and ${t.confirmedByUserId} is not null)
      or (${t.status} <> 'confirmed')`,
  ),
]);

/** Append-only entitlement and reservation facts. `balance_delta` changes the
 * earned/consumed balance; `reserved_delta` changes only the Pending hold. */
export const leaveBalanceEntry = pgTable('leave_balance_entry', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  employeeId: bigint('employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  leaveTypeId: bigint('leave_type_id', { mode: 'number' }).notNull()
    .references(() => leaveType.id),
  policyVersionId: bigint('policy_version_id', { mode: 'number' }).notNull()
    .references(() => leavePolicyVersion.id),
  entryType: text('entry_type').notNull(),
  entryKey: text('entry_key').notNull(),
  balanceDelta: numeric('balance_delta', { precision: 10, scale: 2 }).notNull().default('0'),
  reservedDelta: numeric('reserved_delta', { precision: 10, scale: 2 }).notNull().default('0'),
  effectiveDate: date('effective_date').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  note: text('note'),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_leave_balance_entry_key')
    .on(t.masterFn, t.companyFn, t.entryKey),
  index('idx_leave_balance_projection')
    .on(t.masterFn, t.companyFn, t.employeeId, t.leaveTypeId, t.effectiveDate, t.id),
  index('idx_leave_balance_source')
    .on(t.masterFn, t.companyFn, t.sourceType, t.sourceId, t.id),
  check(
    'ck_leave_balance_entry_type',
    sql`${t.entryType} in (
      'grant', 'accrual', 'reserve', 'use', 'release', 'cancellation',
      'adjustment', 'carry_forward', 'expiry', 'encashment'
    )`,
  ),
  check(
    'ck_leave_balance_nonzero',
    sql`${t.balanceDelta} <> 0 or ${t.reservedDelta} <> 0`,
  ),
  check(
    'ck_leave_balance_half_day',
    sql`mod(abs(${t.balanceDelta}) * 2, 1) = 0
      and mod(abs(${t.reservedDelta}) * 2, 1) = 0`,
  ),
  check(
    'ck_leave_balance_entry_shape',
    sql`
      (${t.entryType} in ('grant', 'accrual', 'carry_forward')
        and ${t.balanceDelta} > 0 and ${t.reservedDelta} = 0)
      or (${t.entryType} = 'reserve'
        and ${t.balanceDelta} = 0 and ${t.reservedDelta} > 0)
      or (${t.entryType} = 'release'
        and ${t.balanceDelta} = 0 and ${t.reservedDelta} < 0)
      or (${t.entryType} = 'use'
        and ${t.balanceDelta} < 0 and ${t.reservedDelta} < 0)
      or (${t.entryType} = 'cancellation'
        and ${t.balanceDelta} > 0 and ${t.reservedDelta} = 0)
      or (${t.entryType} in ('expiry', 'encashment')
        and ${t.balanceDelta} < 0 and ${t.reservedDelta} = 0)
      or (${t.entryType} = 'adjustment' and ${t.reservedDelta} = 0)
    `,
  ),
]);

export const leaveRequest = pgTable('leave_request', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employee.id),
  leaveTypeId: bigint('leave_type_id', { mode: 'number' }).references(() => leaveType.id),
  policyVersionId: bigint('policy_version_id', { mode: 'number' })
    .references(() => leavePolicyVersion.id),
  calendarVersionId: bigint('calendar_version_id', { mode: 'number' })
    .references(() => workingCalendarVersion.id),
  leaveType: text('leave_type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  unit: text('unit'),
  days: numeric('days', { precision: 8, scale: 2 }).notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  version: integer('version').notNull().default(1),
  currentRevisionNo: integer('current_revision_no').notNull().default(0),
  legacyPolicy: boolean('legacy_policy').notNull().default(true),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  onBehalfByUserId: bigint('on_behalf_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  decidedByUserId: bigint('decided_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('idx_leave_request_employee').on(t.masterFn, t.companyFn, t.employeeId, t.id),
  index('idx_leave_request_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check(
    'ck_leave_request_status',
    sql`${t.status} in (
      'draft', 'pending', 'approved', 'rejected', 'withdrawn', 'voided', 'cancelled'
    )`,
  ),
  check('ck_leave_request_days', sql`${t.days} > 0`),
  check('ck_leave_request_dates', sql`${t.endDate} >= ${t.startDate}`),
  check('ck_leave_request_version', sql`${t.version} > 0 and ${t.currentRevisionNo} >= 0`),
  check(
    'ck_leave_request_governance',
    sql`(
      ${t.legacyPolicy} = true
      and ${t.currentRevisionNo} = 0
      and ${t.leaveTypeId} is null
      and ${t.policyVersionId} is null
      and ${t.calendarVersionId} is null
      and ${t.unit} is null
    ) or (
      ${t.legacyPolicy} = false
      and ${t.currentRevisionNo} > 0
      and ${t.leaveTypeId} is not null
      and ${t.policyVersionId} is not null
      and ${t.calendarVersionId} is not null
      and ${t.unit} in ('full_day', 'half_day_am', 'half_day_pm')
    )`,
  ),
]);

/** Immutable submitted/draft content snapshots. The header projects only the
 * latest revision so legacy list consumers remain compatible. */
export const leaveRequestRevision = pgTable('leave_request_revision', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  requestId: bigint('request_id', { mode: 'number' }).notNull().references(() => leaveRequest.id),
  revisionNo: integer('revision_no').notNull(),
  leaveTypeId: bigint('leave_type_id', { mode: 'number' }).notNull()
    .references(() => leaveType.id),
  policyVersionId: bigint('policy_version_id', { mode: 'number' }).notNull()
    .references(() => leavePolicyVersion.id),
  calendarVersionId: bigint('calendar_version_id', { mode: 'number' }).notNull()
    .references(() => workingCalendarVersion.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  unit: text('unit').notNull(),
  days: numeric('days', { precision: 8, scale: 2 }).notNull(),
  reason: text('reason'),
  changeReason: text('change_reason'),
  evidenceRequired: boolean('evidence_required').notNull().default(false),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_leave_request_revision')
    .on(t.masterFn, t.companyFn, t.requestId, t.revisionNo),
  index('idx_leave_request_revision_current')
    .on(t.masterFn, t.companyFn, t.requestId, t.revisionNo),
  check('ck_leave_request_revision_no', sql`${t.revisionNo} > 0`),
  check('ck_leave_request_revision_days', sql`${t.days} > 0 and mod(${t.days} * 2, 1) = 0`),
  check('ck_leave_request_revision_dates', sql`${t.endDate} >= ${t.startDate}`),
  check(
    'ck_leave_request_revision_unit',
    sql`${t.unit} in ('full_day', 'half_day_am', 'half_day_pm')`,
  ),
]);

/** Append-only state history. `event_key` is the domain-level replay key; API
 * idempotency remains a separate authenticated request boundary. */
export const leaveRequestEvent = pgTable('leave_request_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  requestId: bigint('request_id', { mode: 'number' }).notNull().references(() => leaveRequest.id),
  revisionNo: integer('revision_no'),
  eventType: text('event_type').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  reason: text('reason'),
  eventKey: text('event_key').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_leave_request_event_key')
    .on(t.masterFn, t.companyFn, t.eventKey),
  index('idx_leave_request_event_history')
    .on(t.masterFn, t.companyFn, t.requestId, t.id),
  check(
    'ck_leave_request_event_type',
    sql`${t.eventType} in (
      'created_draft', 'amended', 'submitted', 'approved', 'rejected',
      'withdrawn', 'voided', 'cancellation_requested',
      'cancellation_approved', 'cancellation_rejected'
    )`,
  ),
]);

/** Evidence metadata only. Binary content remains outside this task and will be
 * linked through DocumentStorageProvider in TASK-117/118. Every row is a new fact. */
export const leaveEvidence = pgTable('leave_evidence', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  requestId: bigint('request_id', { mode: 'number' }).notNull().references(() => leaveRequest.id),
  revisionNo: integer('revision_no').notNull(),
  evidenceType: text('evidence_type').notNull().default('medical_certificate'),
  state: text('state').notNull().default('received'),
  documentReference: text('document_reference').notNull(),
  originalFileName: text('original_file_name'),
  mimeType: text('mime_type'),
  note: text('note'),
  eventKey: text('event_key').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_leave_evidence_event_key')
    .on(t.masterFn, t.companyFn, t.eventKey),
  index('idx_leave_evidence_projection')
    .on(t.masterFn, t.companyFn, t.requestId, t.revisionNo, t.id),
  check('ck_leave_evidence_revision', sql`${t.revisionNo} > 0`),
  check(
    'ck_leave_evidence_type',
    sql`${t.evidenceType} in ('medical_certificate', 'supporting_document')`,
  ),
  check('ck_leave_evidence_state', sql`${t.state} in ('received', 'verified', 'rejected')`),
  check(
    'ck_leave_evidence_reference',
    sql`char_length(trim(${t.documentReference})) between 3 and 200`,
  ),
]);

/** An approved request stays approved while its cancellation is pending. */
export const leaveCancellationRequest = pgTable('leave_cancellation_request', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  requestId: bigint('request_id', { mode: 'number' }).notNull().references(() => leaveRequest.id),
  requestVersion: integer('request_version').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'),
  version: integer('version').notNull().default(1),
  requestedByUserId: bigint('requested_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  decidedByUserId: bigint('decided_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decisionReason: text('decision_reason'),
}, (t) => [
  uniqueIndex('uq_leave_cancellation_pending')
    .on(t.masterFn, t.companyFn, t.requestId)
    .where(sql`${t.status} = 'pending'`),
  index('idx_leave_cancellation_history')
    .on(t.masterFn, t.companyFn, t.requestId, t.id),
  check('ck_leave_cancellation_request_version', sql`${t.requestVersion} > 0 and ${t.version} > 0`),
  check('ck_leave_cancellation_status', sql`${t.status} in ('pending', 'approved', 'rejected')`),
  check(
    'ck_leave_cancellation_reason',
    sql`char_length(trim(${t.reason})) between 3 and 500`,
  ),
  check(
    'ck_leave_cancellation_decision',
    sql`(${t.status} = 'pending' and ${t.decidedByUserId} is null and ${t.decidedAt} is null)
      or (${t.status} <> 'pending' and ${t.decidedByUserId} is not null and ${t.decidedAt} is not null)`,
  ),
]);
