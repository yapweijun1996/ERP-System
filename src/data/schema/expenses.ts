import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';
import { account } from './finance';
import { currency } from './localization';
import { documentVersion } from './documents';

export const expenseCategory = pgTable('expense_category', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_category_code').on(t.masterFn, t.companyFn, t.code),
  check('ck_expense_category_code', sql`${t.code} ~ '^[A-Z][A-Z0-9_-]{1,31}$'`),
  check('ck_expense_category_name', sql`char_length(${t.name}) between 2 and 120`),
]);

export const expensePolicy = pgTable('expense_policy', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  policyKey: text('policy_key').notNull(),
  name: text('name').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_policy_key').on(t.masterFn, t.companyFn, t.policyKey),
  check('ck_expense_policy_key', sql`${t.policyKey} ~ '^[a-z][a-z0-9._-]{2,63}$'`),
  check('ck_expense_policy_name', sql`char_length(${t.name}) between 3 and 160`),
]);

export const expensePolicyVersion = pgTable('expense_policy_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  policyId: bigint('policy_id', { mode: 'number' }).notNull()
    .references(() => expensePolicy.id),
  categoryId: bigint('category_id', { mode: 'number' }).notNull()
    .references(() => expenseCategory.id),
  versionNo: integer('version_no').notNull(),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  status: text('status').notNull().default('confirmed'),
  evidenceRequired: boolean('evidence_required').notNull().default(true),
  maxGrossBase: numeric('max_gross_base', { precision: 18, scale: 4 }),
  taxTreatment: text('tax_treatment').notNull(),
  taxCode: text('tax_code'),
  inputTaxRecoverablePct: numeric('input_tax_recoverable_pct', {
    precision: 7,
    scale: 4,
  }).notNull().default('0'),
  employeePaidAllowed: boolean('employee_paid_allowed').notNull().default(true),
  companyPaidAllowed: boolean('company_paid_allowed').notNull().default(false),
  expenseAccountId: bigint('expense_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  inputTaxAccountId: bigint('input_tax_account_id', { mode: 'number' })
    .references(() => account.id),
  employeePayableAccountId: bigint('employee_payable_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  companyPaidClearingAccountId: bigint('company_paid_clearing_account_id', {
    mode: 'number',
  }).notNull().references(() => account.id),
  fxMethod: text('fx_method').notNull().default('table_rate'),
  confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_policy_version')
    .on(t.masterFn, t.companyFn, t.policyId, t.versionNo),
  index('idx_expense_policy_effective')
    .on(t.masterFn, t.companyFn, t.categoryId, t.status, t.validFrom, t.validTo),
  check('ck_expense_policy_version_no', sql`${t.versionNo} > 0`),
  check('ck_expense_policy_dates', sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`),
  check('ck_expense_policy_status', sql`${t.status} = 'confirmed'`),
  check('ck_expense_policy_limit', sql`${t.maxGrossBase} is null or ${t.maxGrossBase} > 0`),
  check('ck_expense_policy_tax_treatment',
    sql`${t.taxTreatment} in ('input_tax','non_deductible','exempt')`),
  check('ck_expense_policy_tax_config',
    sql`(${t.taxTreatment} = 'input_tax'
      and char_length(${t.taxCode}) between 1 and 20
      and ${t.inputTaxAccountId} is not null
      and ${t.inputTaxRecoverablePct} between 0.0000 and 100.0000)
      or (${t.taxTreatment} in ('non_deductible','exempt')
        and ${t.taxCode} is null
        and ${t.inputTaxAccountId} is null
        and ${t.inputTaxRecoverablePct} = 0)`),
  check('ck_expense_policy_payment_source',
    sql`${t.employeePaidAllowed} or ${t.companyPaidAllowed}`),
  check('ck_expense_policy_fx_method',
    sql`${t.fxMethod} in ('table_rate','actual_bank_allowed')`),
]);

/** Immutable policy/tax/FX/GL snapshot taken at line submission. */
export const expenseLinePolicySnapshot = pgTable('expense_line_policy_snapshot', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  lineKey: text('line_key').notNull(),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  categoryId: bigint('category_id', { mode: 'number' }).notNull()
    .references(() => expenseCategory.id),
  policyVersionId: bigint('policy_version_id', { mode: 'number' }).notNull()
    .references(() => expensePolicyVersion.id),
  transactionDate: date('transaction_date').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  paymentSource: text('payment_source').notNull(),
  originalCurrency: text('original_currency').notNull().references(() => currency.code),
  originalNet: numeric('original_net', { precision: 18, scale: 4 }).notNull(),
  originalTax: numeric('original_tax', { precision: 18, scale: 4 }).notNull(),
  originalGross: numeric('original_gross', { precision: 18, scale: 4 }).notNull(),
  functionalCurrency: text('functional_currency').notNull().references(() => currency.code),
  policyFxRate: numeric('policy_fx_rate', { precision: 18, scale: 8 }).notNull(),
  baseExpense: numeric('base_expense', { precision: 18, scale: 4 }).notNull(),
  baseInputTax: numeric('base_input_tax', { precision: 18, scale: 4 }).notNull(),
  baseGross: numeric('base_gross', { precision: 18, scale: 4 }).notNull(),
  taxTreatment: text('tax_treatment').notNull(),
  taxCode: text('tax_code'),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull(),
  inputTaxRecoverablePct: numeric('input_tax_recoverable_pct', {
    precision: 7,
    scale: 4,
  }).notNull(),
  expenseAccountId: bigint('expense_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  inputTaxAccountId: bigint('input_tax_account_id', { mode: 'number' })
    .references(() => account.id),
  creditAccountId: bigint('credit_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  fxMethod: text('fx_method').notNull(),
}, (t) => [
  uniqueIndex('uq_expense_line_policy_snapshot_key')
    .on(t.masterFn, t.companyFn, t.lineKey),
  index('idx_expense_line_policy_snapshot_owner')
    .on(t.masterFn, t.companyFn, t.ownerUserId, t.submittedAt, t.id),
  check('ck_expense_line_policy_snapshot_key',
    sql`${t.lineKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_expense_line_policy_snapshot_payment',
    sql`${t.paymentSource} in ('employee_paid','company_paid')`),
  check('ck_expense_line_policy_snapshot_amounts',
    sql`${t.originalNet} >= 0 and ${t.originalTax} >= 0 and ${t.originalGross} > 0
      and ${t.originalNet} + ${t.originalTax} = ${t.originalGross}
      and ${t.policyFxRate} > 0
      and ${t.baseExpense} >= 0 and ${t.baseInputTax} >= 0 and ${t.baseGross} > 0
      and ${t.baseExpense} + ${t.baseInputTax} = ${t.baseGross}`),
  check('ck_expense_line_policy_snapshot_tax',
    sql`${t.taxTreatment} in ('input_tax','non_deductible','exempt')
      and ${t.taxRate} >= 0
      and ${t.inputTaxRecoverablePct} between 0.0000 and 100.0000`),
  check('ck_expense_line_policy_snapshot_fx',
    sql`${t.fxMethod} in ('table_rate','actual_bank_allowed')`),
]);

/** Immutable Finance-verified actual bank charge override with evidence. */
export const expenseBankChargeOverride = pgTable('expense_bank_charge_override', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  snapshotId: bigint('snapshot_id', { mode: 'number' }).notNull()
    .references(() => expenseLinePolicySnapshot.id),
  actualBaseGross: numeric('actual_base_gross', { precision: 18, scale: 4 }).notNull(),
  actualFxRate: numeric('actual_fx_rate', { precision: 18, scale: 8 }).notNull(),
  evidenceVersionId: bigint('evidence_version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  reason: text('reason').notNull(),
  verifiedByUserId: bigint('verified_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_bank_charge_override_snapshot')
    .on(t.masterFn, t.companyFn, t.snapshotId),
  index('idx_expense_bank_charge_override_actor')
    .on(t.masterFn, t.companyFn, t.verifiedByUserId, t.verifiedAt, t.id),
  check('ck_expense_bank_charge_override_amounts',
    sql`${t.actualBaseGross} > 0 and ${t.actualFxRate} > 0`),
  check('ck_expense_bank_charge_override_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
]);
