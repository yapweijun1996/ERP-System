// Finance module: chart of accounts + general ledger. Tenant-scoped.
// gl_entry is double-entry: each posting writes balanced legs (sum debit = sum credit),
// tied by journal_ref. High-volume → range-partitioned by posted_at in production
// (raw-SQL migration; drizzle-kit does not emit PARTITION BY). See docs/SCALABILITY.md.
import {
  pgTable, text, bigint, numeric, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenant, timestamps } from './_shared';

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
