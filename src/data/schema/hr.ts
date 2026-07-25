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

export const leaveRequest = pgTable('leave_request', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employee.id),
  leaveType: text('leave_type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  days: integer('days').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('idx_leave_request_employee').on(t.masterFn, t.companyFn, t.employeeId, t.id),
  index('idx_leave_request_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_leave_request_type', sql`${t.leaveType} in ('Annual', 'Medical', 'Unpaid')`),
  check('ck_leave_request_status', sql`${t.status} in ('pending', 'approved', 'rejected')`),
  check('ck_leave_request_days', sql`${t.days} > 0`),
  check('ck_leave_request_dates', sql`${t.endDate} >= ${t.startDate}`),
]);
