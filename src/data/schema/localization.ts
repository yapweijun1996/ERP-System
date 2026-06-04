// Localization: currency, FX, and effective-dated tax rules.
// See docs/LOCALIZATION.md. Tax is a MODEL (per-company regime + dated rules), not a
// single rate field — SG GST (input/output credit) and MY SST (single-stage) differ.
import {
  pgTable, text, bigint, integer, numeric, date, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
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
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),                 // NULL = open-ended until superseded
  ...timestamps,
}, (t) => [
  // Tenant-leading lookup by code + date window (see docs/SCALABILITY.md).
  index('idx_tax_rule_lookup').on(t.masterFn, t.companyFn, t.taxCode, t.validFrom),
]);
