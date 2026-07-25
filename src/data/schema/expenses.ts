import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
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
import { documentVersion, receiptInboxItem } from './documents';
import { budgetLine, budgetVersion } from './reporting';
import { approvalInstance } from './approval';
import { employee } from './hr';

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

export const expenseClaim = pgTable('expense_claim', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  claimKey: text('claim_key').notNull(),
  claimNo: text('claim_no').notNull(),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  submissionKind: text('submission_kind').notNull().default('none'),
  submittedByUserId: bigint('submitted_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  systemActorKey: text('system_actor_key'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  factsSha256: text('facts_sha256'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_claim_key').on(t.masterFn, t.companyFn, t.claimKey),
  uniqueIndex('uq_expense_claim_number').on(t.masterFn, t.companyFn, t.claimNo),
  index('idx_expense_claim_owner_status')
    .on(t.masterFn, t.companyFn, t.ownerUserId, t.status, t.id),
  check('ck_expense_claim_key', sql`${t.claimKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_expense_claim_title', sql`char_length(${t.title}) between 3 and 160`),
  check('ck_expense_claim_status',
    sql`${t.status} in (
      'draft','submitted','pending_approval','partially_approved',
      'approved','rejected','returned','voided','posted'
    )`),
  check('ck_expense_claim_version', sql`${t.version} > 0`),
  check('ck_expense_claim_submission',
    sql`(${t.status} = 'draft'
      and ${t.submissionKind} = 'none'
      and ${t.submittedByUserId} is null
      and ${t.systemActorKey} is null
      and ${t.submittedAt} is null
      and ${t.factsSha256} is null)
      or (${t.status} <> 'draft'
        and ${t.submissionKind} in ('employee','system')
        and ${t.submittedByUserId} is not null
        and (${t.submissionKind} = 'employee' and ${t.systemActorKey} is null
          or ${t.submissionKind} = 'system'
            and ${t.systemActorKey} = 'expense-auto-submit-v1')
        and ${t.submittedAt} is not null
        and char_length(${t.factsSha256}) = 64
        and ${t.factsSha256} ~ '^[0-9a-f]{64}$')`),
]);

export const expenseClaimLine = pgTable('expense_claim_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  claimId: bigint('claim_id', { mode: 'number' }).notNull()
    .references(() => expenseClaim.id),
  lineNo: integer('line_no').notNull(),
  merchant: text('merchant').notNull(),
  merchantTaxNumber: text('merchant_tax_number'),
  transactionDate: date('transaction_date').notNull(),
  purpose: text('purpose').notNull(),
  categoryCode: text('category_code').notNull(),
  paymentSource: text('payment_source').notNull(),
  originalCurrency: text('original_currency').notNull().references(() => currency.code),
  originalNet: numeric('original_net', { precision: 18, scale: 4 }).notNull(),
  originalTax: numeric('original_tax', { precision: 18, scale: 4 }).notNull(),
  originalGross: numeric('original_gross', { precision: 18, scale: 4 }).notNull(),
  receiptInboxItemId: bigint('receipt_inbox_item_id', { mode: 'number' })
    .references(() => receiptInboxItem.id),
  policySnapshotId: bigint('policy_snapshot_id', { mode: 'number' })
    .references(() => expenseLinePolicySnapshot.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_claim_line_number')
    .on(t.masterFn, t.companyFn, t.claimId, t.lineNo),
  uniqueIndex('uq_expense_claim_line_receipt')
    .on(t.masterFn, t.companyFn, t.receiptInboxItemId),
  uniqueIndex('uq_expense_claim_line_snapshot')
    .on(t.masterFn, t.companyFn, t.policySnapshotId),
  index('idx_expense_claim_line_claim').on(t.masterFn, t.companyFn, t.claimId, t.id),
  check('ck_expense_claim_line_no', sql`${t.lineNo} > 0`),
  check('ck_expense_claim_line_text',
    sql`char_length(${t.merchant}) between 1 and 160
      and char_length(${t.purpose}) between 3 and 500
      and ${t.categoryCode} ~ '^[A-Z][A-Z0-9_-]{1,31}$'`),
  check('ck_expense_claim_line_tax_number',
    sql`${t.merchantTaxNumber} is null
      or char_length(${t.merchantTaxNumber}) between 3 and 80`),
  check('ck_expense_claim_line_payment',
    sql`${t.paymentSource} in ('employee_paid','company_paid')`),
  check('ck_expense_claim_line_amounts',
    sql`${t.originalNet} >= 0 and ${t.originalTax} >= 0 and ${t.originalGross} > 0
      and ${t.originalNet} + ${t.originalTax} = ${t.originalGross}`),
]);

export const expenseAllocation = pgTable('expense_allocation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  lineId: bigint('line_id', { mode: 'number' }).notNull()
    .references(() => expenseClaimLine.id),
  allocationNo: integer('allocation_no').notNull(),
  mode: text('mode').notNull(),
  dimensionType: text('dimension_type').notNull(),
  dimensionKey: text('dimension_key').notNull(),
  amountOriginal: numeric('amount_original', { precision: 18, scale: 4 }).notNull(),
  percentage: numeric('percentage', { precision: 7, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_allocation_number')
    .on(t.masterFn, t.companyFn, t.lineId, t.allocationNo),
  index('idx_expense_allocation_dimension')
    .on(t.masterFn, t.companyFn, t.dimensionType, t.dimensionKey, t.id),
  check('ck_expense_allocation_no', sql`${t.allocationNo} > 0`),
  check('ck_expense_allocation_mode', sql`${t.mode} in ('amount','percentage')`),
  check('ck_expense_allocation_dimension',
    sql`${t.dimensionType} in ('department','cost_center','project')
      and char_length(${t.dimensionKey}) between 1 and 80`),
  check('ck_expense_allocation_values',
    sql`${t.amountOriginal} >= 0 and ${t.percentage} >= 0 and ${t.percentage} <= 100`),
]);

export const expenseClaimSubmissionAuthorization = pgTable(
  'expense_claim_submission_authorization',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    ...tenant,
    claimId: bigint('claim_id', { mode: 'number' }).notNull()
      .references(() => expenseClaim.id),
    ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
      .references(() => appUser.userId),
    autoSubmitAuthorized: boolean('auto_submit_authorized').notNull().default(false),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    statementVersion: text('statement_version').notNull().default('expense-auto-submit-v1'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_expense_claim_submission_authorization')
      .on(t.masterFn, t.companyFn, t.claimId),
    check('ck_expense_claim_submission_authorization',
      sql`(${t.autoSubmitAuthorized} and ${t.authorizedAt} is not null)
        or (not ${t.autoSubmitAuthorized} and ${t.authorizedAt} is null)`),
    check('ck_expense_claim_submission_statement',
      sql`${t.statementVersion} = 'expense-auto-submit-v1'`),
  ],
);

export const expenseClaimRevision = pgTable('expense_claim_revision', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  claimId: bigint('claim_id', { mode: 'number' }).notNull()
    .references(() => expenseClaim.id),
  claimVersion: integer('claim_version').notNull(),
  factsSha256: text('facts_sha256').notNull(),
  facts: jsonb('facts').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_claim_revision')
    .on(t.masterFn, t.companyFn, t.claimId, t.claimVersion),
  check('ck_expense_claim_revision_version', sql`${t.claimVersion} > 0`),
  check('ck_expense_claim_revision_hash',
    sql`char_length(${t.factsSha256}) = 64
      and ${t.factsSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const expenseClaimEvent = pgTable('expense_claim_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  claimId: bigint('claim_id', { mode: 'number' }).notNull()
    .references(() => expenseClaim.id),
  eventType: text('event_type').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  reason: text('reason').notNull(),
  claimVersion: integer('claim_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_expense_claim_event_claim')
    .on(t.masterFn, t.companyFn, t.claimId, t.id),
  check('ck_expense_claim_event_type',
    sql`${t.eventType} in (
      'created','draft_replaced','submitted','system_submitted','approval_updated'
    )`),
  check('ck_expense_claim_event_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
  check('ck_expense_claim_event_version', sql`${t.claimVersion} > 0`),
]);

/** Confirmed effective-dated duplicate and budget behavior used at submission. */
export const expenseControlPolicyVersion = pgTable('expense_control_policy_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  policyKey: text('policy_key').notNull(),
  versionNo: integer('version_no').notNull(),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  status: text('status').notNull().default('confirmed'),
  duplicateHighRiskScore: integer('duplicate_high_risk_score').notNull().default(70),
  budgetAction: text('budget_action').notNull().default('warn'),
  budgetTolerancePct: numeric('budget_tolerance_pct', { precision: 7, scale: 4 })
    .notNull().default('0'),
  budgetExtraApprovalPermissionKey: text('budget_extra_approval_permission_key'),
  confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_control_policy_version')
    .on(t.masterFn, t.companyFn, t.policyKey, t.versionNo),
  index('idx_expense_control_policy_effective')
    .on(t.masterFn, t.companyFn, t.status, t.validFrom, t.validTo, t.id),
  check('ck_expense_control_policy_key',
    sql`${t.policyKey} ~ '^[a-z][a-z0-9._-]{2,63}$'`),
  check('ck_expense_control_policy_version_no', sql`${t.versionNo} > 0`),
  check('ck_expense_control_policy_dates',
    sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`),
  check('ck_expense_control_policy_status', sql`${t.status} = 'confirmed'`),
  check('ck_expense_control_policy_duplicate_score',
    sql`${t.duplicateHighRiskScore} between 1 and 100`),
  check('ck_expense_control_policy_budget_action',
    sql`${t.budgetAction} in ('warn','extra_approval','block')`),
  check('ck_expense_control_policy_budget_tolerance',
    sql`${t.budgetTolerancePct} between 0.0000 and 100.0000`),
  check('ck_expense_control_policy_budget_extra',
    sql`${t.budgetAction} <> 'extra_approval'
      or char_length(${t.budgetExtraApprovalPermissionKey}) between 3 and 120`),
]);

/** Immutable duplicate/budget snapshot evaluated before a line enters approval. */
export const expenseLineControlAssessment = pgTable('expense_line_control_assessment', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  claimId: bigint('claim_id', { mode: 'number' }).notNull()
    .references(() => expenseClaim.id),
  lineId: bigint('line_id', { mode: 'number' }).notNull()
    .references(() => expenseClaimLine.id),
  claimVersion: integer('claim_version').notNull(),
  controlPolicyVersionId: bigint('control_policy_version_id', { mode: 'number' }).notNull()
    .references(() => expenseControlPolicyVersion.id),
  duplicateRiskScore: integer('duplicate_risk_score').notNull(),
  duplicateRiskLevel: text('duplicate_risk_level').notNull(),
  budgetAction: text('budget_action').notNull(),
  budgetVersionId: bigint('budget_version_id', { mode: 'number' })
    .references(() => budgetVersion.id),
  budgetLineId: bigint('budget_line_id', { mode: 'number' })
    .references(() => budgetLine.id),
  budgetAmount: numeric('budget_amount', { precision: 18, scale: 4 }),
  consumedAmount: numeric('consumed_amount', { precision: 18, scale: 4 }).notNull(),
  lineAmount: numeric('line_amount', { precision: 18, scale: 4 }).notNull(),
  remainingAfter: numeric('remaining_after', { precision: 18, scale: 4 }),
  budgetBreached: boolean('budget_breached').notNull(),
  assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_line_control_assessment')
    .on(t.masterFn, t.companyFn, t.lineId, t.claimVersion),
  index('idx_expense_line_control_risk')
    .on(t.masterFn, t.companyFn, t.duplicateRiskLevel, t.budgetBreached, t.id),
  check('ck_expense_line_control_version', sql`${t.claimVersion} > 0`),
  check('ck_expense_line_control_duplicate_score',
    sql`${t.duplicateRiskScore} between 0 and 100`),
  check('ck_expense_line_control_duplicate_level',
    sql`${t.duplicateRiskLevel} in ('none','low','medium','high')`),
  check('ck_expense_line_control_budget_action',
    sql`${t.budgetAction} in ('warn','extra_approval','block')`),
  check('ck_expense_line_control_amounts',
    sql`${t.consumedAmount} >= 0 and ${t.lineAmount} > 0
      and (${t.budgetAmount} is null or ${t.budgetAmount} >= 0)`),
]);

/** Immutable weighted evidence contributing to duplicate risk. */
export const expenseDuplicateSignal = pgTable('expense_duplicate_signal', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  assessmentId: bigint('assessment_id', { mode: 'number' }).notNull()
    .references(() => expenseLineControlAssessment.id),
  lineId: bigint('line_id', { mode: 'number' }).notNull()
    .references(() => expenseClaimLine.id),
  matchedLineId: bigint('matched_line_id', { mode: 'number' })
    .references(() => expenseClaimLine.id),
  signalType: text('signal_type').notNull(),
  signalHash: text('signal_hash').notNull(),
  riskPoints: integer('risk_points').notNull(),
  detail: jsonb('detail').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_duplicate_signal')
    .on(t.masterFn, t.companyFn, t.assessmentId, t.signalType, t.matchedLineId),
  index('idx_expense_duplicate_signal_line')
    .on(t.masterFn, t.companyFn, t.lineId, t.id),
  check('ck_expense_duplicate_signal_type',
    sql`${t.signalType} in ('file_hash','image_fingerprint','business_key')`),
  check('ck_expense_duplicate_signal_hash',
    sql`char_length(${t.signalHash}) = 64 and ${t.signalHash} ~ '^[0-9a-f]{64}$'`),
  check('ck_expense_duplicate_signal_points', sql`${t.riskPoints} between 1 and 100`),
]);

/** Finance-only, reasoned high-risk duplicate override. */
export const expenseDuplicateOverride = pgTable('expense_duplicate_override', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  assessmentId: bigint('assessment_id', { mode: 'number' }).notNull()
    .references(() => expenseLineControlAssessment.id),
  reason: text('reason').notNull(),
  overriddenByUserId: bigint('overridden_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  overriddenAt: timestamp('overridden_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_duplicate_override')
    .on(t.masterFn, t.companyFn, t.assessmentId),
  check('ck_expense_duplicate_override_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
]);

/** Mutable workflow projection; employee facts stay in immutable claim lines. */
export const expenseLineApproval = pgTable('expense_line_approval', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  claimId: bigint('claim_id', { mode: 'number' }).notNull()
    .references(() => expenseClaim.id),
  lineId: bigint('line_id', { mode: 'number' }).notNull()
    .references(() => expenseClaimLine.id),
  claimVersion: integer('claim_version').notNull(),
  assessmentId: bigint('assessment_id', { mode: 'number' }).notNull()
    .references(() => expenseLineControlAssessment.id),
  approvalInstanceId: bigint('approval_instance_id', { mode: 'number' }).notNull()
    .references(() => approvalInstance.id),
  status: text('status').notNull().default('pending'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_line_approval_line')
    .on(t.masterFn, t.companyFn, t.lineId, t.claimVersion),
  uniqueIndex('uq_expense_line_approval_instance')
    .on(t.masterFn, t.companyFn, t.approvalInstanceId),
  index('idx_expense_line_approval_queue')
    .on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_expense_line_approval_version', sql`${t.claimVersion} > 0`),
  check('ck_expense_line_approval_status',
    sql`${t.status} in ('pending','approved','rejected','returned')`),
]);

/** Immutable source file and statement identity for a bounded card import. */
export const corporateCardImport = pgTable('corporate_card_import', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  importKey: text('import_key').notNull(),
  issuer: text('issuer').notNull(),
  statementRef: text('statement_ref').notNull(),
  fileName: text('file_name').notNull(),
  fileFormat: text('file_format').notNull(),
  sourceSha256: text('source_sha256').notNull(),
  rowCount: integer('row_count').notNull(),
  importedByUserId: bigint('imported_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_corporate_card_import_key')
    .on(t.masterFn, t.companyFn, t.importKey),
  uniqueIndex('uq_corporate_card_import_source')
    .on(t.masterFn, t.companyFn, t.sourceSha256),
  uniqueIndex('uq_corporate_card_import_statement')
    .on(t.masterFn, t.companyFn, t.issuer, t.statementRef),
  index('idx_corporate_card_import_time')
    .on(t.masterFn, t.companyFn, t.importedAt, t.id),
  check('ck_corporate_card_import_format', sql`${t.fileFormat} in ('csv','xlsx')`),
  check('ck_corporate_card_import_hash',
    sql`char_length(${t.sourceSha256}) = 64
      and ${t.sourceSha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_corporate_card_import_rows', sql`${t.rowCount} between 1 and 1000`),
  check('ck_corporate_card_import_text',
    sql`char_length(${t.importKey}) between 8 and 128
      and char_length(${t.issuer}) between 2 and 120
      and char_length(${t.statementRef}) between 2 and 120
      and char_length(${t.fileName}) between 1 and 240`),
]);

/** Imported issuer facts plus reviewable evidence-match projection. */
export const corporateCardTransaction = pgTable('corporate_card_transaction', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  importId: bigint('import_id', { mode: 'number' }).notNull()
    .references(() => corporateCardImport.id),
  lineNo: integer('line_no').notNull(),
  externalTransactionId: text('external_transaction_id').notNull(),
  holderEmployeeNo: text('holder_employee_no').notNull(),
  holderEmployeeId: bigint('holder_employee_id', { mode: 'number' })
    .references(() => employee.id),
  cardLast4: text('card_last4').notNull(),
  transactionDate: date('transaction_date').notNull(),
  postedDate: date('posted_date').notNull(),
  merchant: text('merchant').notNull(),
  currency: text('currency').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  lineFingerprint: text('line_fingerprint').notNull(),
  status: text('status').notNull().default('unmatched'),
  matchedReceiptInboxItemId: bigint('matched_receipt_inbox_item_id', { mode: 'number' })
    .references(() => receiptInboxItem.id),
  matchConfidence: numeric('match_confidence', { precision: 5, scale: 4 }),
  matchMethod: text('match_method'),
  matchedByUserId: bigint('matched_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  matchedAt: timestamp('matched_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_corporate_card_transaction_import_line')
    .on(t.masterFn, t.companyFn, t.importId, t.lineNo),
  uniqueIndex('uq_corporate_card_transaction_external')
    .on(t.masterFn, t.companyFn, t.externalTransactionId),
  uniqueIndex('uq_corporate_card_transaction_fingerprint')
    .on(t.masterFn, t.companyFn, t.lineFingerprint),
  uniqueIndex('uq_corporate_card_transaction_receipt')
    .on(t.masterFn, t.companyFn, t.matchedReceiptInboxItemId)
    .where(sql`${t.matchedReceiptInboxItemId} is not null`),
  index('idx_corporate_card_transaction_queue')
    .on(t.masterFn, t.companyFn, t.status, t.postedDate, t.id),
  index('idx_corporate_card_transaction_holder')
    .on(t.masterFn, t.companyFn, t.holderEmployeeId, t.status, t.id),
  check('ck_corporate_card_transaction_line', sql`${t.lineNo} > 0`),
  check('ck_corporate_card_transaction_card', sql`${t.cardLast4} ~ '^[0-9]{4}$'`),
  check('ck_corporate_card_transaction_dates', sql`${t.postedDate} >= ${t.transactionDate}`),
  check('ck_corporate_card_transaction_currency', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_corporate_card_transaction_amount', sql`${t.amount} > 0`),
  check('ck_corporate_card_transaction_hash',
    sql`char_length(${t.lineFingerprint}) = 64
      and ${t.lineFingerprint} ~ '^[0-9a-f]{64}$'`),
  check('ck_corporate_card_transaction_status',
    sql`${t.status} in ('unmatched','suggested','matched','missing_receipt','waived')`),
  check('ck_corporate_card_transaction_match',
    sql`(${t.status} = 'matched'
      and ${t.matchedReceiptInboxItemId} is not null
      and ${t.matchConfidence} between 0.0000 and 1.0000
      and ${t.matchMethod} in ('automatic_review','manual')
      and ${t.matchedByUserId} is not null
      and ${t.matchedAt} is not null)
      or (${t.status} <> 'matched'
        and ${t.matchedReceiptInboxItemId} is null
        and ${t.matchConfidence} is null
        and ${t.matchMethod} is null
        and ${t.matchedByUserId} is null
        and ${t.matchedAt} is null)`),
  check('ck_corporate_card_transaction_version', sql`${t.version} > 0`),
]);

/** Persisted, explainable automatic suggestion that Finance must accept or reject. */
export const corporateCardMatchCandidate = pgTable('corporate_card_match_candidate', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  transactionId: bigint('transaction_id', { mode: 'number' }).notNull()
    .references(() => corporateCardTransaction.id),
  receiptInboxItemId: bigint('receipt_inbox_item_id', { mode: 'number' }).notNull()
    .references(() => receiptInboxItem.id),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  reasons: jsonb('reasons').$type<string[]>().notNull(),
  status: text('status').notNull().default('suggested'),
  reviewedByUserId: bigint('reviewed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  reviewReason: text('review_reason'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_corporate_card_match_candidate')
    .on(t.masterFn, t.companyFn, t.transactionId, t.receiptInboxItemId),
  index('idx_corporate_card_match_candidate_status')
    .on(t.masterFn, t.companyFn, t.status, t.confidence, t.id),
  check('ck_corporate_card_match_candidate_confidence',
    sql`${t.confidence} between 0.0000 and 1.0000`),
  check('ck_corporate_card_match_candidate_status',
    sql`${t.status} in ('suggested','accepted','rejected')`),
  check('ck_corporate_card_match_candidate_review',
    sql`(${t.status} = 'suggested'
      and ${t.reviewedByUserId} is null
      and ${t.reviewReason} is null
      and ${t.reviewedAt} is null)
      or (${t.status} in ('accepted','rejected')
        and ${t.reviewedByUserId} is not null
        and char_length(${t.reviewReason}) between 3 and 1000
        and ${t.reviewedAt} is not null)`),
]);

/** Persistent work item for unresolved holder, evidence, or rejected suggestions. */
export const corporateCardFollowUp = pgTable('corporate_card_follow_up', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  transactionId: bigint('transaction_id', { mode: 'number' }).notNull()
    .references(() => corporateCardTransaction.id),
  followUpType: text('follow_up_type').notNull(),
  status: text('status').notNull().default('open'),
  assignedEmployeeId: bigint('assigned_employee_id', { mode: 'number' })
    .references(() => employee.id),
  reason: text('reason').notNull(),
  resolutionReason: text('resolution_reason'),
  resolvedByUserId: bigint('resolved_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_corporate_card_follow_up')
    .on(t.masterFn, t.companyFn, t.transactionId, t.followUpType),
  index('idx_corporate_card_follow_up_queue')
    .on(t.masterFn, t.companyFn, t.status, t.dueAt, t.id),
  check('ck_corporate_card_follow_up_type',
    sql`${t.followUpType} in ('holder_unresolved','missing_receipt','unmatched_transaction')`),
  check('ck_corporate_card_follow_up_status',
    sql`${t.status} in ('open','resolved','waived')`),
  check('ck_corporate_card_follow_up_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
  check('ck_corporate_card_follow_up_resolution',
    sql`(${t.status} = 'open'
      and ${t.resolutionReason} is null
      and ${t.resolvedByUserId} is null
      and ${t.resolvedAt} is null)
      or (${t.status} in ('resolved','waived')
        and char_length(${t.resolutionReason}) between 3 and 1000
        and ${t.resolvedByUserId} is not null
        and ${t.resolvedAt} is not null)`),
]);

/** Append-only import, suggestion, review, and follow-up history. */
export const corporateCardEvent = pgTable('corporate_card_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  importId: bigint('import_id', { mode: 'number' }).notNull()
    .references(() => corporateCardImport.id),
  transactionId: bigint('transaction_id', { mode: 'number' })
    .references(() => corporateCardTransaction.id),
  eventType: text('event_type').notNull(),
  reason: text('reason').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  detail: jsonb('detail').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_corporate_card_event_import')
    .on(t.masterFn, t.companyFn, t.importId, t.id),
  index('idx_corporate_card_event_transaction')
    .on(t.masterFn, t.companyFn, t.transactionId, t.id),
  check('ck_corporate_card_event_type',
    sql`${t.eventType} in (
      'imported','match_suggested','match_accepted','match_rejected',
      'follow_up_opened','follow_up_resolved','follow_up_waived'
    )`),
  check('ck_corporate_card_event_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
]);
