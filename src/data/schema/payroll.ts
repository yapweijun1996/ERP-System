// Payroll: run -> per-employee line -> balanced GL posting. Tenant-scoped. Mirrors
// assets.ts's depreciation_run/depreciation_run_line shape exactly (see
// docs/EPICS.md EPIC-026). grossPay and every deduction/contribution on a line are
// snapshotted at run time from employee.baseSalary via the per-country statutory
// engine (src/modules/payroll/statutory.ts) -- tax-snapshotted, matching
// progress_claim's "don't recompute from a since-changed source" convention.
import {
  pgTable, text, bigint, numeric, date, timestamp, integer, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';
import { employee, leaveBalanceEntry, leaveRequest } from './hr';

export const payrollRun = pgTable('payroll_run', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  payDate: date('pay_date').notNull(),
  status: text('status').notNull().default('draft'),
  totalGrossPay: numeric('total_gross_pay', { precision: 18, scale: 2 }).notNull().default('0'),
  totalNetPay: numeric('total_net_pay', { precision: 18, scale: 2 }).notNull().default('0'),
  version: integer('version').notNull().default(1),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_payroll_run_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_payroll_run_period').on(t.masterFn, t.companyFn, t.periodStart, t.id),
  check('ck_payroll_run_status', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  check('ck_payroll_run_dates', sql`${t.periodEnd} >= ${t.periodStart}`),
]);

export const payrollRunLine = pgTable('payroll_run_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  runId: bigint('run_id', { mode: 'number' }).notNull().references(() => payrollRun.id),
  lineNo: integer('line_no').notNull(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employee.id),
  baseGrossPay: numeric('base_gross_pay', { precision: 18, scale: 2 }).notNull().default('0'),
  leaveEarnings: numeric('leave_earnings', { precision: 18, scale: 2 }).notNull().default('0'),
  leaveDeductions: numeric('leave_deductions', { precision: 18, scale: 2 }).notNull().default('0'),
  grossPay: numeric('gross_pay', { precision: 18, scale: 2 }).notNull(),
  employeeStatutoryDeduction: numeric('employee_statutory_deduction', { precision: 18, scale: 2 }).notNull(),
  incomeTaxDeduction: numeric('income_tax_deduction', { precision: 18, scale: 2 }).notNull(),
  employerStatutoryContribution: numeric('employer_statutory_contribution', { precision: 18, scale: 2 }).notNull(),
  employerAdditionalContribution: numeric('employer_additional_contribution', { precision: 18, scale: 2 }).notNull(),
  netPay: numeric('net_pay', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_payroll_run_line').on(t.masterFn, t.companyFn, t.runId, t.lineNo),
  index('idx_payroll_run_line_employee').on(t.masterFn, t.companyFn, t.employeeId, t.runId),
  check(
    'ck_payroll_run_line_amounts',
    sql`${t.baseGrossPay} >= 0 and ${t.leaveEarnings} >= 0 and ${t.leaveDeductions} >= 0
      and ${t.grossPay} >= 0 and ${t.employeeStatutoryDeduction} >= 0 and ${t.incomeTaxDeduction} >= 0
      and ${t.employerStatutoryContribution} >= 0 and ${t.employerAdditionalContribution} >= 0 and ${t.netPay} >= 0`,
  ),
]);

/**
 * Immutable Payroll input created from one approved unpaid-leave revision,
 * its approved cancellation, or one policy-authorised encashment ledger fact.
 * `amount` is a positive snapshot; `effect_direction` determines whether it
 * increases or reduces gross pay.
 */
export const payrollLeaveSource = pgTable('payroll_leave_source', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  employeeId: bigint('employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  leaveRequestId: bigint('leave_request_id', { mode: 'number' })
    .references(() => leaveRequest.id),
  leaveRevisionNo: integer('leave_revision_no'),
  leaveBalanceEntryId: bigint('leave_balance_entry_id', { mode: 'number' })
    .references(() => leaveBalanceEntry.id),
  sourceType: text('source_type').notNull(),
  effectDirection: text('effect_direction').notNull(),
  sourceKey: text('source_key').notNull(),
  days: numeric('days', { precision: 8, scale: 2 }).notNull(),
  baseSalarySnapshot: numeric('base_salary_snapshot', { precision: 18, scale: 2 }).notNull(),
  divisorDays: numeric('divisor_days', { precision: 8, scale: 2 }).notNull().default('26'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  effectiveDate: date('effective_date').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_payroll_leave_source_key').on(t.masterFn, t.companyFn, t.sourceKey),
  index('idx_payroll_leave_source_period')
    .on(t.masterFn, t.companyFn, t.effectiveDate, t.employeeId, t.id),
  index('idx_payroll_leave_source_request')
    .on(t.masterFn, t.companyFn, t.leaveRequestId, t.leaveRevisionNo, t.id),
  check('ck_payroll_leave_source_type',
    sql`${t.sourceType} in ('unpaid_leave', 'unpaid_leave_cancellation', 'encashment')`),
  check('ck_payroll_leave_source_direction',
    sql`${t.effectDirection} in ('earning', 'deduction')`),
  check('ck_payroll_leave_source_values',
    sql`${t.days} > 0 and mod(${t.days} * 2, 1) = 0
      and ${t.baseSalarySnapshot} >= 0 and ${t.divisorDays} > 0 and ${t.amount} >= 0`),
  check('ck_payroll_leave_source_link',
    sql`(
      ${t.sourceType} in ('unpaid_leave', 'unpaid_leave_cancellation')
      and ${t.leaveRequestId} is not null and ${t.leaveRevisionNo} > 0
      and ${t.leaveBalanceEntryId} is null
    ) or (
      ${t.sourceType} = 'encashment'
      and ${t.leaveRequestId} is null and ${t.leaveRevisionNo} is null
      and ${t.leaveBalanceEntryId} is not null
    )`),
]);

/** One source may be consumed by only one payroll run. The signed effect is
 * snapshotted on the mapping so the run remains reproducible. */
export const payrollRunLeaveSource = pgTable('payroll_run_leave_source', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  runId: bigint('run_id', { mode: 'number' }).notNull().references(() => payrollRun.id),
  runLineId: bigint('run_line_id', { mode: 'number' }).notNull().references(() => payrollRunLine.id),
  sourceId: bigint('source_id', { mode: 'number' }).notNull().references(() => payrollLeaveSource.id),
  effectAmount: numeric('effect_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_payroll_run_leave_source').on(t.masterFn, t.companyFn, t.sourceId),
  index('idx_payroll_run_leave_source_run').on(t.masterFn, t.companyFn, t.runId, t.runLineId),
]);
