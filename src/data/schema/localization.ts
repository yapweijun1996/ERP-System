// Localization: currency, FX, and effective-dated tax rules.
// See docs/LOCALIZATION.md. Tax is a MODEL (per-company regime + dated rules), not a
// single rate field — SG GST (input/output credit) and MY SST (single-stage) differ.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';

// NOTE: currency & fx_rate are intentionally GLOBAL reference/market data — no tenant
// columns. Every *business* table is tenant-scoped; reference data is shared.

/** ISO-ish currency reference (SGD, MYR, …). */
export const currency = pgTable('currency', {
  code: text('code').primaryKey(),       // 'SGD' | 'MYR'
  name: text('name').notNull(),
  symbol: text('symbol'),
  decimals: integer('decimals').notNull().default(2),
});

/** Exchange rate, effective-dated, for cross-currency documents & consolidation. */
export const fxRate = pgTable('fx_rate', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  fromCcy: text('from_ccy').notNull().references(() => currency.code),
  toCcy: text('to_ccy').notNull().references(() => currency.code),
  rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
  validFrom: date('valid_from').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_fx_pair_from').on(t.fromCcy, t.toCcy, t.validFrom),
]);

/**
 * Effective-dated tax rule. A transaction uses the rate valid on its DOCUMENT DATE, never
 * "today", so historical invoices stay reproducible (e.g. SG GST 8% in 2023, 9% in 2024).
 */
export const taxRule = pgTable('tax_rule', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,   // master_fn + company_fn as scope columns (NOT FK-bound — same rule as
               // product/warehouse/stock; tenancy is enforced at the app + RLS layer).
  taxRegime: text('tax_regime').notNull(),   // 'GST' | 'SST'
  taxCode: text('tax_code').notNull(),       // 'SR' (standard-rated), 'ZR', 'SST-S', …
  rate: numeric('rate', { precision: 6, scale: 3 }).notNull(),
  /**
   * Explicit statutory classification. Legacy rows are retained as
   * `unclassified` until a tax owner re-approves them; transaction posting
   * rejects that value instead of guessing from a tax-code string.
   */
  taxClassification: text('tax_classification').notNull().default('unclassified'),
  /** Percentage of tax eligible for input-tax recovery under this rule. */
  inputTaxRecoverablePct: numeric('input_tax_recoverable_pct', {
    precision: 7,
    scale: 4,
  }).notNull().default('0'),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),                 // NULL = open-ended until superseded
  /** Versioned source and approval facts; nullable for historical imported rows. */
  sourceUrl: text('source_url'),
  sourceEffectiveDate: date('source_effective_date'),
  approvedByUserId: bigint('approved_by_user_id', { mode: 'number' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  // Tenant-leading lookup by code + date window (see docs/SCALABILITY.md).
  index('idx_tax_rule_lookup').on(t.masterFn, t.companyFn, t.taxCode, t.validFrom),
  check('ck_tax_rule_rate', sql`${t.rate} >= 0`),
  check('ck_tax_rule_dates', sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
  check('ck_tax_rule_classification', sql`${t.taxClassification} in (
    'unclassified', 'gst_standard', 'gst_zero_rated', 'gst_exempt',
    'sst_sales', 'sst_service', 'sst_deductible', 'sst_exempt'
  )`),
  check('ck_tax_rule_recoverable_pct', sql`${t.inputTaxRecoverablePct} between 0.0000 and 100.0000`),
]);
