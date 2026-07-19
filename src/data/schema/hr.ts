// HR-lite: employee master + leave requests. Tenant-scoped. Deliberately excludes
// payroll/compensation and does not link to app_user (an HR employee record doesn't
// imply an ERP login) -- see docs/EPICS.md EPIC-020 for the scope boundary. Mirrors
// assets.ts's tenant/check-constraint conventions.
import {
  pgTable, text, bigint, integer, boolean, date, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';

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
  managerId: bigint('manager_id', { mode: 'number' }).references((): any => employee.id),
  startDate: date('start_date').notNull(),
  annualLeaveDays: integer('annual_leave_days').notNull().default(14),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_employee_no').on(t.masterFn, t.companyFn, t.employeeNo),
  index('idx_employee_active').on(t.masterFn, t.companyFn, t.isActive, t.id),
  check(
    'ck_employee_employment_type',
    sql`${t.employmentType} in ('Full-time', 'Part-time', 'Contract', 'Intern')`,
  ),
  check('ck_employee_leave_days', sql`${t.annualLeaveDays} >= 0`),
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
