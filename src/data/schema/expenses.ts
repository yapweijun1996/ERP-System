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
import { account, glEntry } from './finance';
import { accountingPeriod } from './controlPlane';
import { currency } from './localization';
import { documentVersion, managedDocument, receiptInboxItem } from './documents';
import { budgetLine, budgetVersion } from './reporting';
import { approvalInstance } from './approval';
import { employee } from './hr';

/**
 * Company-owned receipt facts confirmed from one governed document version.
 * Evidence bytes/OCR provenance remain in the managed-document aggregate; this
 * table deliberately carries no claim, reimbursement, GL or tax decision.
 */
export const companyReceipt = pgTable('company_receipt', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  receiptKey: text('receipt_key').notNull(),
  documentId: bigint('document_id', { mode: 'number' }).notNull()
    .references(() => managedDocument.id),
  documentVersionId: bigint('document_version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  evidenceSha256: text('evidence_sha256').notNull(),
  uploaderUserId: bigint('uploader_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  transactionDate: date('transaction_date'),
  merchant: text('merchant').notNull(),
  receiptNumber: text('receipt_number'),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currencyCode: text('currency_code').notNull().references(() => currency.code),
  category: text('category').notNull(),
  businessPurpose: text('business_purpose').notNull(),
  notes: text('notes'),
  status: text('status').notNull().default('ready'),
  version: integer('version').notNull().default(1),
  voidReason: text('void_reason'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedByUserId: bigint('voided_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_company_receipt_key').on(t.masterFn, t.companyFn, t.receiptKey),
  uniqueIndex('uq_company_receipt_document').on(t.masterFn, t.companyFn, t.documentId),
  uniqueIndex('uq_company_receipt_document_version')
    .on(t.masterFn, t.companyFn, t.documentVersionId),
  uniqueIndex('uq_company_receipt_evidence_hash')
    .on(t.masterFn, t.companyFn, t.evidenceSha256),
  index('idx_company_receipt_uploader')
    .on(t.masterFn, t.companyFn, t.uploaderUserId, t.status, t.id),
  index('idx_company_receipt_transaction_date')
    .on(t.masterFn, t.companyFn, t.transactionDate, t.id),
  check('ck_company_receipt_key',
    sql`${t.receiptKey} ~ '^company-receipt:[0-9a-f-]{36}$'`),
  check('ck_company_receipt_merchant',
    sql`char_length(${t.merchant}) between 1 and 200`),
  check('ck_company_receipt_number',
    sql`${t.receiptNumber} is null or char_length(${t.receiptNumber}) between 1 and 120`),
  check('ck_company_receipt_amount', sql`${t.amount} > 0`),
  check('ck_company_receipt_evidence_hash',
    sql`char_length(${t.evidenceSha256}) = 64 and ${t.evidenceSha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_company_receipt_currency', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
  check('ck_company_receipt_category',
    sql`char_length(${t.category}) between 1 and 120`),
  check('ck_company_receipt_business_purpose',
    sql`char_length(${t.businessPurpose}) between 1 and 500`),
  check('ck_company_receipt_notes',
    sql`${t.notes} is null or char_length(${t.notes}) between 1 and 2000`),
  check('ck_company_receipt_status',
    sql`${t.status} in ('draft','processing','ready','needs_attention','voided')`),
  check('ck_company_receipt_version', sql`${t.version} > 0`),
  check('ck_company_receipt_void',
    sql`(${t.status} = 'voided'
      and char_length(${t.voidReason}) between 3 and 1000
      and ${t.voidedAt} is not null
      and ${t.voidedByUserId} is not null)
      or (${t.status} <> 'voided'
        and ${t.voidReason} is null
        and ${t.voidedAt} is null
        and ${t.voidedByUserId} is null)`),
]);

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

/** Confirmed effective-dated mileage or per-diem rate. */
export const expenseAllowancePolicyVersion = pgTable('expense_allowance_policy_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  policyKey: text('policy_key').notNull(),
  versionNo: integer('version_no').notNull(),
  allowanceType: text('allowance_type').notNull(),
  unit: text('unit').notNull(),
  rate: numeric('rate', { precision: 18, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  maximumUnits: numeric('maximum_units', { precision: 18, scale: 4 }),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: text('status').notNull().default('confirmed'),
  confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_allowance_policy_version')
    .on(t.masterFn, t.companyFn, t.policyKey, t.versionNo),
  index('idx_expense_allowance_policy_effective')
    .on(t.masterFn, t.companyFn, t.allowanceType, t.status, t.effectiveFrom, t.id),
  check('ck_expense_allowance_policy_key',
    sql`${t.policyKey} ~ '^[a-z][a-z0-9._-]{2,63}$'`),
  check('ck_expense_allowance_policy_type',
    sql`(${t.allowanceType} = 'mileage' and ${t.unit} = 'km')
      or (${t.allowanceType} = 'per_diem' and ${t.unit} = 'day')`),
  check('ck_expense_allowance_policy_rate', sql`${t.rate} > 0`),
  check('ck_expense_allowance_policy_currency', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_expense_allowance_policy_max',
    sql`${t.maximumUnits} is null or ${t.maximumUnits} > 0`),
  check('ck_expense_allowance_policy_dates',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`),
  check('ck_expense_allowance_policy_status', sql`${t.status} = 'confirmed'`),
  check('ck_expense_allowance_policy_version_no', sql`${t.versionNo} > 0`),
]);

/** Immutable non-receipt calculation snapshot; Finance controls approval/application. */
export const expenseAllowanceCalculation = pgTable('expense_allowance_calculation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  calculationKey: text('calculation_key').notNull(),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  policyVersionId: bigint('policy_version_id', { mode: 'number' }).notNull()
    .references(() => expenseAllowancePolicyVersion.id),
  allowanceType: text('allowance_type').notNull(),
  serviceDate: date('service_date').notNull(),
  unit: text('unit').notNull(),
  units: numeric('units', { precision: 18, scale: 4 }).notNull(),
  rate: numeric('rate', { precision: 18, scale: 4 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  receiptRequired: boolean('receipt_required').notNull().default(false),
  calculationEvidence: jsonb('calculation_evidence').notNull(),
  status: text('status').notNull().default('calculated'),
  approvedByUserId: bigint('approved_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_allowance_calculation_key')
    .on(t.masterFn, t.companyFn, t.calculationKey),
  index('idx_expense_allowance_calculation_owner')
    .on(t.masterFn, t.companyFn, t.ownerUserId, t.status, t.serviceDate, t.id),
  check('ck_expense_allowance_calculation_type',
    sql`(${t.allowanceType} = 'mileage' and ${t.unit} = 'km')
      or (${t.allowanceType} = 'per_diem' and ${t.unit} = 'day')`),
  check('ck_expense_allowance_calculation_amounts',
    sql`${t.units} > 0 and ${t.rate} > 0 and ${t.amount} > 0`),
  check('ck_expense_allowance_calculation_currency', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_expense_allowance_no_receipt', sql`${t.receiptRequired} = false`),
  check('ck_expense_allowance_calculation_status',
    sql`${t.status} in ('calculated','approved','applied')`),
  check('ck_expense_allowance_calculation_approval',
    sql`(${t.status} = 'calculated'
      and ${t.approvedByUserId} is null and ${t.approvedAt} is null and ${t.appliedAt} is null)
      or (${t.status} = 'approved'
        and ${t.approvedByUserId} is not null and ${t.approvedAt} is not null
        and ${t.appliedAt} is null)
      or (${t.status} = 'applied'
        and ${t.approvedByUserId} is not null and ${t.approvedAt} is not null
        and ${t.appliedAt} is not null)`),
]);

/** Employee cash advance with immutable issue facts and one exact closing settlement. */
export const cashAdvance = pgTable('cash_advance', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  advanceKey: text('advance_key').notNull(),
  advanceNo: text('advance_no').notNull(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  currency: text('currency').notNull(),
  issuedAmount: numeric('issued_amount', { precision: 18, scale: 2 }).notNull(),
  issuedDate: date('issued_date').notNull(),
  purpose: text('purpose').notNull(),
  advanceReceivableAccountId: bigint('advance_receivable_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  employeePayableAccountId: bigint('employee_payable_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  bankAccountId: bigint('bank_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  status: text('status').notNull().default('issued'),
  appliedExpenseAmount: numeric('applied_expense_amount', { precision: 18, scale: 2 })
    .notNull().default('0'),
  employeeRepaidAmount: numeric('employee_repaid_amount', { precision: 18, scale: 2 })
    .notNull().default('0'),
  employeePayableDifference: numeric('employee_payable_difference', { precision: 18, scale: 2 })
    .notNull().default('0'),
  closedByUserId: bigint('closed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_cash_advance_key').on(t.masterFn, t.companyFn, t.advanceKey),
  uniqueIndex('uq_cash_advance_no').on(t.masterFn, t.companyFn, t.advanceNo),
  index('idx_cash_advance_employee')
    .on(t.masterFn, t.companyFn, t.employeeId, t.status, t.id),
  check('ck_cash_advance_currency', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_cash_advance_amounts',
    sql`${t.issuedAmount} > 0 and ${t.appliedExpenseAmount} >= 0
      and ${t.employeeRepaidAmount} >= 0 and ${t.employeePayableDifference} >= 0`),
  check('ck_cash_advance_status', sql`${t.status} in ('issued','closed')`),
  check('ck_cash_advance_close',
    sql`(${t.status} = 'issued'
      and ${t.appliedExpenseAmount} = 0 and ${t.employeeRepaidAmount} = 0
      and ${t.employeePayableDifference} = 0
      and ${t.closedByUserId} is null and ${t.closedAt} is null)
      or (${t.status} = 'closed'
        and ${t.closedByUserId} is not null and ${t.closedAt} is not null)`),
  check('ck_cash_advance_version', sql`${t.version} > 0`),
  check('ck_cash_advance_purpose', sql`char_length(${t.purpose}) between 3 and 500`),
]);

/** Immutable approved source included in one closing settlement. */
export const cashAdvanceApplication = pgTable('cash_advance_application', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  advanceId: bigint('advance_id', { mode: 'number' }).notNull()
    .references(() => cashAdvance.id),
  sourceType: text('source_type').notNull(),
  expenseClaimLineId: bigint('expense_claim_line_id', { mode: 'number' })
    .references(() => expenseClaimLine.id),
  allowanceCalculationId: bigint('allowance_calculation_id', { mode: 'number' })
    .references(() => expenseAllowanceCalculation.id),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  appliedByUserId: bigint('applied_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_cash_advance_application_claim_line')
    .on(t.masterFn, t.companyFn, t.expenseClaimLineId)
    .where(sql`${t.expenseClaimLineId} is not null`),
  uniqueIndex('uq_cash_advance_application_allowance')
    .on(t.masterFn, t.companyFn, t.allowanceCalculationId)
    .where(sql`${t.allowanceCalculationId} is not null`),
  index('idx_cash_advance_application_advance')
    .on(t.masterFn, t.companyFn, t.advanceId, t.id),
  check('ck_cash_advance_application_source',
    sql`(${t.sourceType} = 'expense_claim_line'
      and ${t.expenseClaimLineId} is not null and ${t.allowanceCalculationId} is null)
      or (${t.sourceType} = 'allowance'
        and ${t.expenseClaimLineId} is null and ${t.allowanceCalculationId} is not null)`),
  check('ck_cash_advance_application_amount', sql`${t.amount} > 0`),
]);

/** Explicit two-leg GL evidence for issue, application, or employee repayment. */
export const cashAdvancePosting = pgTable('cash_advance_posting', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  advanceId: bigint('advance_id', { mode: 'number' }).notNull()
    .references(() => cashAdvance.id),
  postingType: text('posting_type').notNull(),
  journalRef: text('journal_ref').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  debitAccountId: bigint('debit_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  creditAccountId: bigint('credit_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  debitGlEntryId: bigint('debit_gl_entry_id', { mode: 'number' }).notNull()
    .references(() => glEntry.id),
  creditGlEntryId: bigint('credit_gl_entry_id', { mode: 'number' }).notNull()
    .references(() => glEntry.id),
  postedByUserId: bigint('posted_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_cash_advance_posting_type')
    .on(t.masterFn, t.companyFn, t.advanceId, t.postingType),
  uniqueIndex('uq_cash_advance_posting_ref')
    .on(t.masterFn, t.companyFn, t.journalRef),
  check('ck_cash_advance_posting_type',
    sql`${t.postingType} in ('issue','expense_application','employee_repayment')`),
  check('ck_cash_advance_posting_amount', sql`${t.amount} > 0`),
  check('ck_cash_advance_posting_accounts',
    sql`${t.debitAccountId} <> ${t.creditAccountId}
      and ${t.debitGlEntryId} <> ${t.creditGlEntryId}`),
]);

/** Append-only advance lifecycle evidence. */
export const cashAdvanceEvent = pgTable('cash_advance_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  advanceId: bigint('advance_id', { mode: 'number' }).notNull()
    .references(() => cashAdvance.id),
  eventType: text('event_type').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  reason: text('reason').notNull(),
  detail: jsonb('detail').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_cash_advance_event').on(t.masterFn, t.companyFn, t.advanceId, t.id),
  check('ck_cash_advance_event_type', sql`${t.eventType} in ('issued','closed')`),
  check('ck_cash_advance_event_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
]);

/** One immutable, idempotent final-Finance posting per approved expense line. */
export const expensePosting = pgTable('expense_posting', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  lineApprovalId: bigint('line_approval_id', { mode: 'number' }).notNull()
    .references(() => expenseLineApproval.id),
  claimId: bigint('claim_id', { mode: 'number' }).notNull()
    .references(() => expenseClaim.id),
  lineId: bigint('line_id', { mode: 'number' }).notNull()
    .references(() => expenseClaimLine.id),
  claimVersion: integer('claim_version').notNull(),
  policySnapshotId: bigint('policy_snapshot_id', { mode: 'number' }).notNull()
    .references(() => expenseLinePolicySnapshot.id),
  bankChargeOverrideId: bigint('bank_charge_override_id', { mode: 'number' })
    .references(() => expenseBankChargeOverride.id),
  accountingPeriodId: bigint('accounting_period_id', { mode: 'number' }).notNull()
    .references(() => accountingPeriod.id),
  journalRef: text('journal_ref').notNull(),
  postingDate: date('posting_date').notNull(),
  paymentSource: text('payment_source').notNull(),
  functionalCurrency: text('functional_currency').notNull(),
  baseExpense: numeric('base_expense', { precision: 18, scale: 2 }).notNull(),
  baseInputTax: numeric('base_input_tax', { precision: 18, scale: 2 }).notNull(),
  baseGross: numeric('base_gross', { precision: 18, scale: 2 }).notNull(),
  creditAccountId: bigint('credit_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  factsSha256: text('facts_sha256').notNull(),
  postedByUserId: bigint('posted_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_expense_posting_line_approval')
    .on(t.masterFn, t.companyFn, t.lineApprovalId),
  uniqueIndex('uq_expense_posting_journal')
    .on(t.masterFn, t.companyFn, t.journalRef),
  index('idx_expense_posting_date')
    .on(t.masterFn, t.companyFn, t.postingDate, t.id),
  check('ck_expense_posting_version', sql`${t.claimVersion} > 0`),
  check('ck_expense_posting_payment',
    sql`${t.paymentSource} in ('employee_paid','company_paid')`),
  check('ck_expense_posting_currency', sql`${t.functionalCurrency} ~ '^[A-Z]{3}$'`),
  check('ck_expense_posting_amounts',
    sql`${t.baseExpense} >= 0 and ${t.baseInputTax} >= 0 and ${t.baseGross} > 0
      and ${t.baseExpense} + ${t.baseInputTax} = ${t.baseGross}`),
  check('ck_expense_posting_hash',
    sql`char_length(${t.factsSha256}) = 64
      and ${t.factsSha256} ~ '^[0-9a-f]{64}$'`),
]);

/** Immutable link from each balanced debit/credit leg to its GL fact. */
export const expensePostingLeg = pgTable('expense_posting_leg', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  postingId: bigint('posting_id', { mode: 'number' }).notNull()
    .references(() => expensePosting.id),
  legNo: integer('leg_no').notNull(),
  legType: text('leg_type').notNull(),
  accountId: bigint('account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  debit: numeric('debit', { precision: 18, scale: 2 }).notNull().default('0'),
  credit: numeric('credit', { precision: 18, scale: 2 }).notNull().default('0'),
  glEntryId: bigint('gl_entry_id', { mode: 'number' }).notNull()
    .references(() => glEntry.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_expense_posting_leg_no')
    .on(t.masterFn, t.companyFn, t.postingId, t.legNo),
  uniqueIndex('uq_expense_posting_leg_gl')
    .on(t.masterFn, t.companyFn, t.glEntryId),
  index('idx_expense_posting_leg_posting')
    .on(t.masterFn, t.companyFn, t.postingId, t.id),
  check('ck_expense_posting_leg_no', sql`${t.legNo} > 0`),
  check('ck_expense_posting_leg_type',
    sql`${t.legType} in ('expense','input_tax','credit')`),
  check('ck_expense_posting_leg_side',
    sql`(${t.debit} > 0 and ${t.credit} = 0)
      or (${t.credit} > 0 and ${t.debit} = 0)`),
]);

/** One employee-owned payout destination. Bank facts remain encrypted at rest;
 * only deliberately masked projections are stored outside the AES-GCM envelope. */
export const employeePayoutProfile = pgTable('employee_payout_profile', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  employeeId: bigint('employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  bankCountry: text('bank_country').notNull(),
  currency: text('currency').notNull().references(() => currency.code),
  bankCode: text('bank_code').notNull(),
  bankName: text('bank_name').notNull(),
  accountHolderMasked: text('account_holder_masked').notNull(),
  accountNumberMasked: text('account_number_masked').notNull(),
  detailsEnvelope: jsonb('details_envelope').notNull(),
  verificationStatus: text('verification_status').notNull().default('unverified'),
  version: integer('version').notNull().default(1),
  verifiedByUserId: bigint('verified_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verificationReason: text('verification_reason'),
  verificationInvalidatedAt: timestamp('verification_invalidated_at', { withTimezone: true }),
  verificationInvalidatedReason: text('verification_invalidated_reason'),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  updatedByUserId: bigint('updated_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_employee_payout_profile_employee')
    .on(t.masterFn, t.companyFn, t.employeeId),
  index('idx_employee_payout_profile_verification')
    .on(t.masterFn, t.companyFn, t.verificationStatus, t.employeeId),
  check('ck_employee_payout_profile_country', sql`${t.bankCountry} ~ '^[A-Z]{2}$'`),
  check('ck_employee_payout_profile_currency', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_employee_payout_profile_bank_code',
    sql`char_length(${t.bankCode}) between 2 and 20`),
  check('ck_employee_payout_profile_bank_name',
    sql`char_length(${t.bankName}) between 2 and 120`),
  check('ck_employee_payout_profile_masks',
    sql`char_length(${t.accountHolderMasked}) between 2 and 160
      and char_length(${t.accountNumberMasked}) between 4 and 40`),
  check('ck_employee_payout_profile_status',
    sql`${t.verificationStatus} in ('unverified','verified')`),
  check('ck_employee_payout_profile_version', sql`${t.version} > 0`),
  check('ck_employee_payout_profile_verification',
    sql`(${t.verificationStatus} = 'verified'
      and ${t.verifiedByUserId} is not null
      and ${t.verifiedAt} is not null
      and char_length(${t.verificationReason}) between 3 and 500
      and ${t.verificationInvalidatedAt} is null
      and ${t.verificationInvalidatedReason} is null)
      or (${t.verificationStatus} = 'unverified'
        and ${t.verifiedByUserId} is null
        and ${t.verifiedAt} is null
        and ${t.verificationReason} is null
        and (${t.verificationInvalidatedAt} is null
          or char_length(${t.verificationInvalidatedReason}) between 3 and 500))`),
]);

/** Append-only non-sensitive lifecycle/access proof. Metadata may contain field
 * names and versions only; it must never contain an account value or envelope. */
export const employeePayoutProfileEvent = pgTable('employee_payout_profile_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  profileId: bigint('profile_id', { mode: 'number' }).notNull()
    .references(() => employeePayoutProfile.id),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  eventType: text('event_type').notNull(),
  profileVersion: integer('profile_version').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_employee_payout_profile_event_profile')
    .on(t.masterFn, t.companyFn, t.profileId, t.id),
  index('idx_employee_payout_profile_event_actor')
    .on(t.masterFn, t.companyFn, t.actorUserId, t.occurredAt, t.id),
  check('ck_employee_payout_profile_event_type',
    sql`${t.eventType} in ('created','updated','verified','revealed')`),
  check('ck_employee_payout_profile_event_version', sql`${t.profileVersion} > 0`),
  check('ck_employee_payout_profile_event_reason',
    sql`${t.reason} is null or char_length(${t.reason}) between 3 and 500`),
]);

/** Maker-authored reimbursement batch. A checker release freezes the membership,
 * encrypted payout destinations and release facts without exposing bank plaintext. */
export const reimbursementPaymentBatch = pgTable('reimbursement_payment_batch', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  batchKey: text('batch_key').notNull(),
  batchNo: text('batch_no').notNull(),
  currency: text('currency').notNull().references(() => currency.code),
  sourceBankAccountId: bigint('source_bank_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  itemCount: integer('item_count').notNull().default(0),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  preparedByUserId: bigint('prepared_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  preparedAt: timestamp('prepared_at', { withTimezone: true }).notNull().defaultNow(),
  releasedByUserId: bigint('released_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releaseReason: text('release_reason'),
  releaseFactsSha256: text('release_facts_sha256'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_reimbursement_payment_batch_key')
    .on(t.masterFn, t.companyFn, t.batchKey),
  uniqueIndex('uq_reimbursement_payment_batch_no')
    .on(t.masterFn, t.companyFn, t.batchNo),
  index('idx_reimbursement_payment_batch_status')
    .on(t.masterFn, t.companyFn, t.status, t.preparedAt, t.id),
  check('ck_reimbursement_payment_batch_key',
    sql`${t.batchKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_reimbursement_payment_batch_no',
    sql`char_length(${t.batchNo}) between 3 and 80`),
  check('ck_reimbursement_payment_batch_currency',
    sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_reimbursement_payment_batch_status',
    sql`${t.status} in ('draft','released')`),
  check('ck_reimbursement_payment_batch_version', sql`${t.version} > 0`),
  check('ck_reimbursement_payment_batch_totals',
    sql`${t.itemCount} >= 0 and ${t.totalAmount} >= 0`),
  check('ck_reimbursement_payment_batch_release',
    sql`(${t.status} = 'draft'
      and ${t.releasedByUserId} is null
      and ${t.releasedAt} is null
      and ${t.releaseReason} is null
      and ${t.releaseFactsSha256} is null)
    or (${t.status} = 'released'
      and ${t.itemCount} > 0
      and ${t.totalAmount} > 0
      and ${t.releasedByUserId} is not null
      and ${t.releasedByUserId} <> ${t.preparedByUserId}
      and ${t.releasedAt} is not null
      and char_length(${t.releaseReason}) between 3 and 500
      and char_length(${t.releaseFactsSha256}) = 64
      and ${t.releaseFactsSha256} ~ '^[0-9a-f]{64}$')`),
]);

/** Draft-selectable posted employee payable; encrypted destination is copied only
 * at checker release and ordinary projections must omit payoutEnvelopeSnapshot. */
export const reimbursementPaymentBatchLine = pgTable('reimbursement_payment_batch_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  batchId: bigint('batch_id', { mode: 'number' }).notNull()
    .references(() => reimbursementPaymentBatch.id),
  lineNo: integer('line_no').notNull(),
  expensePostingId: bigint('expense_posting_id', { mode: 'number' }).notNull()
    .references(() => expensePosting.id),
  claimId: bigint('claim_id', { mode: 'number' }).notNull()
    .references(() => expenseClaim.id),
  claimLineId: bigint('claim_line_id', { mode: 'number' }).notNull()
    .references(() => expenseClaimLine.id),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  payoutProfileId: bigint('payout_profile_id', { mode: 'number' }).notNull()
    .references(() => employeePayoutProfile.id),
  payoutProfileVersion: integer('payout_profile_version').notNull(),
  currency: text('currency').notNull().references(() => currency.code),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  payableAccountId: bigint('payable_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  claimNo: text('claim_no').notNull(),
  accountHolderMasked: text('account_holder_masked').notNull(),
  accountNumberMasked: text('account_number_masked').notNull(),
  bankName: text('bank_name').notNull(),
  payoutEnvelopeSnapshot: jsonb('payout_envelope_snapshot'),
  postingFactsSha256: text('posting_facts_sha256').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_reimbursement_payment_batch_line_no')
    .on(t.masterFn, t.companyFn, t.batchId, t.lineNo),
  uniqueIndex('uq_reimbursement_payment_batch_posting')
    .on(t.masterFn, t.companyFn, t.expensePostingId),
  index('idx_reimbursement_payment_batch_line_employee')
    .on(t.masterFn, t.companyFn, t.employeeId, t.batchId, t.id),
  check('ck_reimbursement_payment_batch_line_no', sql`${t.lineNo} > 0`),
  check('ck_reimbursement_payment_batch_line_profile_version',
    sql`${t.payoutProfileVersion} > 0`),
  check('ck_reimbursement_payment_batch_line_currency',
    sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_reimbursement_payment_batch_line_amount', sql`${t.amount} > 0`),
  check('ck_reimbursement_payment_batch_line_masks',
    sql`char_length(${t.accountHolderMasked}) between 2 and 160
      and char_length(${t.accountNumberMasked}) between 4 and 40
      and char_length(${t.bankName}) between 2 and 120`),
  check('ck_reimbursement_payment_batch_line_hash',
    sql`char_length(${t.postingFactsSha256}) = 64
      and ${t.postingFactsSha256} ~ '^[0-9a-f]{64}$'`),
]);

/** Append-only maker/checker lifecycle proof; never stores account plaintext. */
export const reimbursementPaymentBatchEvent = pgTable('reimbursement_payment_batch_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  batchId: bigint('batch_id', { mode: 'number' }).notNull()
    .references(() => reimbursementPaymentBatch.id),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  eventType: text('event_type').notNull(),
  batchVersion: integer('batch_version').notNull(),
  reason: text('reason'),
  detail: jsonb('detail').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_reimbursement_payment_batch_event')
    .on(t.masterFn, t.companyFn, t.batchId, t.id),
  index('idx_reimbursement_payment_batch_event_actor')
    .on(t.masterFn, t.companyFn, t.actorUserId, t.occurredAt, t.id),
  check('ck_reimbursement_payment_batch_event_type',
    sql`${t.eventType} in ('created','membership_replaced','released')`),
  check('ck_reimbursement_payment_batch_event_version',
    sql`${t.batchVersion} > 0`),
  check('ck_reimbursement_payment_batch_event_reason',
    sql`${t.reason} is null or char_length(${t.reason}) between 3 and 500`),
]);

/** Confirmed effective-dated CSV layout used to render a released batch. */
export const reimbursementBankTemplateVersion = pgTable(
  'reimbursement_bank_template_version',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    ...tenant,
    templateKey: text('template_key').notNull(),
    versionNo: integer('version_no').notNull(),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),
    name: text('name').notNull(),
    bankCode: text('bank_code').notNull(),
    fileFormat: text('file_format').notNull().default('csv'),
    delimiter: text('delimiter').notNull().default(','),
    includeHeader: boolean('include_header').notNull().default(true),
    fieldOrder: jsonb('field_order').notNull(),
    status: text('status').notNull().default('confirmed'),
    confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' }).notNull()
      .references(() => appUser.userId),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_reimbursement_bank_template_version')
      .on(t.masterFn, t.companyFn, t.templateKey, t.versionNo),
    index('idx_reimbursement_bank_template_effective')
      .on(t.masterFn, t.companyFn, t.templateKey, t.status, t.validFrom, t.validTo, t.id),
    check('ck_reimbursement_bank_template_key',
      sql`${t.templateKey} ~ '^[a-z][a-z0-9._-]{2,63}$'`),
    check('ck_reimbursement_bank_template_version_no', sql`${t.versionNo} > 0`),
    check('ck_reimbursement_bank_template_dates',
      sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`),
    check('ck_reimbursement_bank_template_name',
      sql`char_length(${t.name}) between 3 and 160`),
    check('ck_reimbursement_bank_template_bank',
      sql`char_length(${t.bankCode}) between 2 and 20`),
    check('ck_reimbursement_bank_template_format',
      sql`${t.fileFormat} = 'csv' and ${t.delimiter} in (',', chr(9), chr(59))`),
    check('ck_reimbursement_bank_template_status', sql`${t.status} = 'confirmed'`),
  ],
);

/** Versioned encrypted bank artifact generated from one immutable released batch. */
export const reimbursementBankExport = pgTable('reimbursement_bank_export', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  exportKey: text('export_key').notNull(),
  batchId: bigint('batch_id', { mode: 'number' }).notNull()
    .references(() => reimbursementPaymentBatch.id),
  templateVersionId: bigint('template_version_id', { mode: 'number' }).notNull()
    .references(() => reimbursementBankTemplateVersion.id),
  exportVersion: integer('export_version').notNull(),
  retryOfExportId: bigint('retry_of_export_id', { mode: 'number' }),
  artifactFileName: text('artifact_file_name').notNull(),
  artifactEnvelope: jsonb('artifact_envelope').notNull(),
  contentSha256: text('content_sha256').notNull(),
  rowCount: integer('row_count').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  generatedByUserId: bigint('generated_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_reimbursement_bank_export_key')
    .on(t.masterFn, t.companyFn, t.exportKey),
  uniqueIndex('uq_reimbursement_bank_export_version')
    .on(t.masterFn, t.companyFn, t.batchId, t.exportVersion),
  index('idx_reimbursement_bank_export_batch')
    .on(t.masterFn, t.companyFn, t.batchId, t.generatedAt, t.id),
  check('ck_reimbursement_bank_export_key',
    sql`${t.exportKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_reimbursement_bank_export_version', sql`${t.exportVersion} > 0`),
  check('ck_reimbursement_bank_export_file',
    sql`char_length(${t.artifactFileName}) between 5 and 180
      and ${t.artifactFileName} ~ '\\.csv$'`),
  check('ck_reimbursement_bank_export_hash',
    sql`char_length(${t.contentSha256}) = 64
      and ${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_reimbursement_bank_export_totals',
    sql`${t.rowCount} > 0 and ${t.totalAmount} > 0`),
]);

/** Immutable mapping from an export row to its released batch member. */
export const reimbursementBankExportLine = pgTable('reimbursement_bank_export_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  exportId: bigint('export_id', { mode: 'number' }).notNull()
    .references(() => reimbursementBankExport.id),
  lineNo: integer('line_no').notNull(),
  batchLineId: bigint('batch_line_id', { mode: 'number' }).notNull()
    .references(() => reimbursementPaymentBatchLine.id),
  currency: text('currency').notNull().references(() => currency.code),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_reimbursement_bank_export_line_no')
    .on(t.masterFn, t.companyFn, t.exportId, t.lineNo),
  uniqueIndex('uq_reimbursement_bank_export_batch_line')
    .on(t.masterFn, t.companyFn, t.exportId, t.batchLineId),
  index('idx_reimbursement_bank_export_line_batch')
    .on(t.masterFn, t.companyFn, t.batchLineId, t.exportId, t.id),
  check('ck_reimbursement_bank_export_line_no', sql`${t.lineNo} > 0`),
  check('ck_reimbursement_bank_export_line_currency',
    sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_reimbursement_bank_export_line_amount', sql`${t.amount} > 0`),
]);

/** Append-only audited access to a plaintext bank artifact. */
export const reimbursementBankExportAccessEvent = pgTable(
  'reimbursement_bank_export_access_event',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    ...tenant,
    exportId: bigint('export_id', { mode: 'number' }).notNull()
      .references(() => reimbursementBankExport.id),
    actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
      .references(() => appUser.userId),
    accessKey: text('access_key').notNull(),
    action: text('action').notNull(),
    purpose: text('purpose').notNull(),
    contentSha256: text('content_sha256').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_reimbursement_bank_export_access_key')
      .on(t.masterFn, t.companyFn, t.exportId, t.actorUserId, t.accessKey),
    index('idx_reimbursement_bank_export_access')
      .on(t.masterFn, t.companyFn, t.exportId, t.occurredAt, t.id),
    check('ck_reimbursement_bank_export_access_key',
      sql`${t.accessKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
    check('ck_reimbursement_bank_export_access_action',
      sql`${t.action} in ('generated','downloaded')`),
    check('ck_reimbursement_bank_export_access_purpose',
      sql`char_length(${t.purpose}) between 3 and 500`),
    check('ck_reimbursement_bank_export_access_hash',
      sql`char_length(${t.contentSha256}) = 64
        and ${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

/** One immutable bank-result import; imports may cover disjoint subsets of an export. */
export const reimbursementBankResultImport = pgTable('reimbursement_bank_result_import', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  importKey: text('import_key').notNull(),
  exportId: bigint('export_id', { mode: 'number' }).notNull()
    .references(() => reimbursementBankExport.id),
  bankReference: text('bank_reference').notNull(),
  paymentDate: date('payment_date').notNull(),
  sourceSha256: text('source_sha256').notNull(),
  rowCount: integer('row_count').notNull(),
  importedByUserId: bigint('imported_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_reimbursement_bank_result_import_key')
    .on(t.masterFn, t.companyFn, t.importKey),
  index('idx_reimbursement_bank_result_import_export')
    .on(t.masterFn, t.companyFn, t.exportId, t.importedAt, t.id),
  check('ck_reimbursement_bank_result_import_key',
    sql`${t.importKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_reimbursement_bank_result_import_reference',
    sql`char_length(${t.bankReference}) between 3 and 160`),
  check('ck_reimbursement_bank_result_import_hash',
    sql`char_length(${t.sourceSha256}) = 64
      and ${t.sourceSha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_reimbursement_bank_result_import_rows', sql`${t.rowCount} > 0`),
]);

/** One final bank outcome for one export attempt. Failed batch lines may be exported
 * again; a successful batch line is protected by reimbursementSettlement uniqueness. */
export const reimbursementBankLineResult = pgTable('reimbursement_bank_line_result', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  resultImportId: bigint('result_import_id', { mode: 'number' }).notNull()
    .references(() => reimbursementBankResultImport.id),
  exportLineId: bigint('export_line_id', { mode: 'number' }).notNull()
    .references(() => reimbursementBankExportLine.id),
  outcome: text('outcome').notNull(),
  bankLineReference: text('bank_line_reference').notNull(),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_reimbursement_bank_line_result_export_line')
    .on(t.masterFn, t.companyFn, t.exportLineId),
  index('idx_reimbursement_bank_line_result_import')
    .on(t.masterFn, t.companyFn, t.resultImportId, t.id),
  check('ck_reimbursement_bank_line_result_outcome',
    sql`${t.outcome} in ('success','failed')`),
  check('ck_reimbursement_bank_line_result_reference',
    sql`char_length(${t.bankLineReference}) between 1 and 160`),
  check('ck_reimbursement_bank_line_result_failure',
    sql`(${t.outcome} = 'success'
      and ${t.failureCode} is null and ${t.failureMessage} is null)
    or (${t.outcome} = 'failed'
      and char_length(${t.failureCode}) between 1 and 80
      and char_length(${t.failureMessage}) between 3 and 500)`),
]);

/** Idempotent balanced cash settlement generated only from a successful bank result. */
export const reimbursementSettlement = pgTable('reimbursement_settlement', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  batchLineId: bigint('batch_line_id', { mode: 'number' }).notNull()
    .references(() => reimbursementPaymentBatchLine.id),
  resultLineId: bigint('result_line_id', { mode: 'number' }).notNull()
    .references(() => reimbursementBankLineResult.id),
  resultImportId: bigint('result_import_id', { mode: 'number' }).notNull()
    .references(() => reimbursementBankResultImport.id),
  accountingPeriodId: bigint('accounting_period_id', { mode: 'number' }).notNull()
    .references(() => accountingPeriod.id),
  bankReference: text('bank_reference').notNull(),
  paymentDate: date('payment_date').notNull(),
  currency: text('currency').notNull().references(() => currency.code),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  payableAccountId: bigint('payable_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  bankAccountId: bigint('bank_account_id', { mode: 'number' }).notNull()
    .references(() => account.id),
  journalRef: text('journal_ref').notNull(),
  debitGlEntryId: bigint('debit_gl_entry_id', { mode: 'number' }).notNull()
    .references(() => glEntry.id),
  creditGlEntryId: bigint('credit_gl_entry_id', { mode: 'number' }).notNull()
    .references(() => glEntry.id),
  factsSha256: text('facts_sha256').notNull(),
  postedByUserId: bigint('posted_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_reimbursement_settlement_batch_line')
    .on(t.masterFn, t.companyFn, t.batchLineId),
  uniqueIndex('uq_reimbursement_settlement_result_line')
    .on(t.masterFn, t.companyFn, t.resultLineId),
  uniqueIndex('uq_reimbursement_settlement_journal')
    .on(t.masterFn, t.companyFn, t.journalRef),
  index('idx_reimbursement_settlement_date')
    .on(t.masterFn, t.companyFn, t.paymentDate, t.id),
  check('ck_reimbursement_settlement_reference',
    sql`char_length(${t.bankReference}) between 3 and 160`),
  check('ck_reimbursement_settlement_currency',
    sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('ck_reimbursement_settlement_amount', sql`${t.amount} > 0`),
  check('ck_reimbursement_settlement_accounts',
    sql`${t.payableAccountId} <> ${t.bankAccountId}
      and ${t.debitGlEntryId} <> ${t.creditGlEntryId}`),
  check('ck_reimbursement_settlement_hash',
    sql`char_length(${t.factsSha256}) = 64
      and ${t.factsSha256} ~ '^[0-9a-f]{64}$'`),
]);
