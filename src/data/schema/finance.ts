// Finance module: chart of accounts + general ledger, plus Treasury documents
// (bank_receipt, payment_voucher) that post into the GL. gl_entry is double-entry:
// each posting writes balanced legs (sum debit = sum credit), tied by journal_ref.
// High-volume → range-partitioned by posted_at in production (raw-SQL migration;
// drizzle-kit does not emit PARTITION BY). See docs/SCALABILITY.md.
//
// bank_receipt/payment_voucher live here (Treasury is Finance's function) even though
// they reference progress_claim (Project) and supplier/supplier_invoice (Purchasing) by
// FK — cross-domain schema references are already established (purchasing.ts imports
// product/warehouse from inventory.ts).
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, index, uniqueIndex, check,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { progressClaim } from './project';
import { supplier, supplierInvoice } from './purchasing';

export const account = pgTable('account', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),                 // '1100' AR, '4000' Revenue, '2200' GST Output
  name: text('name').notNull(),
  type: text('type').notNull(),                 // asset | liability | equity | income | expense
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_account_code').on(t.masterFn, t.companyFn, t.code),
]);

export const glEntry = pgTable('gl_entry', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
  journalRef: text('journal_ref').notNull(),    // ties the balanced legs of one posting
  accountId: bigint('account_id', { mode: 'number' }).notNull().references(() => account.id),
  debit: numeric('debit', { precision: 18, scale: 2 }).notNull().default('0'),
  credit: numeric('credit', { precision: 18, scale: 2 }).notNull().default('0'),
  memo: text('memo'),
  ...timestamps,
}, (t) => [
  index('idx_gl_tenant_posted').on(t.masterFn, t.companyFn, t.postedAt, t.id),
  index('idx_gl_journal').on(t.masterFn, t.companyFn, t.journalRef),
]);

/** A manual journal is authored as a versioned draft before any GL fact exists.
 * Posting copies its validated lines into immutable gl_entry legs. Corrections never
 * mutate those facts: reverse creates a second posted journal with swapped legs and
 * links it back to the original. */
export const journalHeader = pgTable('journal_header', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  postingDate: date('posting_date').notNull(),
  journalType: text('journal_type').notNull().default('standard'),
  memo: text('memo').notNull(),
  reference: text('reference'),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  reversalOfId: bigint('reversal_of_id', { mode: 'number' }),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_journal_header_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_journal_header_reversal').on(t.masterFn, t.companyFn, t.reversalOfId),
  index('idx_journal_header_status').on(t.masterFn, t.companyFn, t.status, t.id),
  foreignKey({
    name: 'fk_journal_header_reversal',
    columns: [t.reversalOfId],
    foreignColumns: [t.id],
  }),
  check('ck_journal_header_type', sql`${t.journalType} in ('standard', 'accrual', 'reclassification', 'reversal')`),
  check('ck_journal_header_status', sql`${t.status} in ('draft', 'posted', 'reversed')`),
]);

export const journalLine = pgTable('journal_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  journalId: bigint('journal_id', { mode: 'number' }).notNull().references(() => journalHeader.id),
  lineNo: integer('line_no').notNull(),
  accountId: bigint('account_id', { mode: 'number' }).notNull().references(() => account.id),
  dimension: text('dimension'),
  debit: numeric('debit', { precision: 18, scale: 2 }).notNull().default('0'),
  credit: numeric('credit', { precision: 18, scale: 2 }).notNull().default('0'),
  memo: text('memo'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_journal_line_number').on(t.masterFn, t.companyFn, t.journalId, t.lineNo),
  index('idx_journal_line_journal').on(t.masterFn, t.companyFn, t.journalId, t.id),
  check('ck_journal_line_side', sql`(
    (${t.debit} > 0 and ${t.credit} = 0)
    or (${t.credit} > 0 and ${t.debit} = 0)
  )`),
]);

/** Collects a posted progress claim's AR in full — one receipt per claim, no partial
 *  tracking (mirrors receiveGoods/postSupplierInvoice's one-document-settles-one-thing
 *  convention). Whether a claim is already receipted is derived by checking for an
 *  existing bank_receipt row, not a stored flag on progress_claim — same
 *  computed-not-stored precedent as EPIC-023's "Converted" requisition status. */
export const bankReceipt = pgTable('bank_receipt', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  progressClaimId: bigint('progress_claim_id', { mode: 'number' }).notNull().references(() => progressClaim.id),
  receivedDate: date('received_date').notNull(),
  bankRef: text('bank_ref'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_bank_receipt_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_bank_receipt_claim').on(t.masterFn, t.companyFn, t.progressClaimId),
  check('ck_bank_receipt_amount', sql`${t.amount} > 0`),
]);

/** Settles one or more of one supplier's unpaid invoices in full per line — no
 *  partial-payment tracking (same one-document-settles-one-thing convention). */
export const paymentVoucher = pgTable('payment_voucher', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  paymentDate: date('payment_date').notNull(),
  bankRef: text('bank_ref'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_payment_voucher_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_payment_voucher_supplier').on(t.masterFn, t.companyFn, t.supplierId),
]);

export const paymentVoucherLine = pgTable('payment_voucher_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  paymentVoucherId: bigint('payment_voucher_id', { mode: 'number' }).notNull().references(() => paymentVoucher.id),
  lineNo: integer('line_no').notNull(),
  supplierInvoiceId: bigint('supplier_invoice_id', { mode: 'number' }).notNull().references(() => supplierInvoice.id),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  index('idx_pvl_voucher').on(t.masterFn, t.companyFn, t.paymentVoucherId),
]);
