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
import { employee } from './hr';

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
    sql`${t.grossPay} >= 0 and ${t.employeeStatutoryDeduction} >= 0 and ${t.incomeTaxDeduction} >= 0
      and ${t.employerStatutoryContribution} >= 0 and ${t.employerAdditionalContribution} >= 0 and ${t.netPay} >= 0`,
  ),
]);
