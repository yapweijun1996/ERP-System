// Tenancy & access: master → company → user, with M:N user↔company.
// See docs/MULTI_TENANCY.md. RLS is NOT defined here — it is a production-only migration.
import {
  pgTable, text, bigint, boolean, date, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { currency } from './localization';

/** Top tenant: a group / holding / franchise master. */
export const master = pgTable('master', {
  masterFn: text('master_fn').primaryKey(),
  name: text('name').notNull(),
  ...timestamps,
});

/** A company = ONE legal entity in ONE country. Holds country/currency/tax (L10n). */
export const company = pgTable('company', {
  companyFn: text('company_fn').primaryKey(),
  masterFn: text('master_fn').notNull().references(() => master.masterFn),
  name: text('name').notNull(),
  country: text('country').notNull(),          // 'SG' | 'MY' | …
  currency: text('currency').notNull().references(() => currency.code),
  taxRegime: text('tax_regime').notNull(),     // 'GST' | 'SST' | …
  locale: text('locale').notNull().default('en'),
  fiscalYearStart: date('fiscal_year_start'),
  ...timestamps,
}, (t) => [
  index('idx_company_master').on(t.masterFn),
]);

/** A person who logs in. Belongs to exactly ONE master. `language` = UI i18n preference. */
export const appUser = pgTable('app_user', {
  userId: bigint('user_id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  masterFn: text('master_fn').notNull().references(() => master.masterFn),
  email: text('email').notNull(),
  fullName: text('full_name'),
  language: text('language').notNull().default('en'),   // en | ms | zh | ja | vi
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_user_master_email').on(t.masterFn, t.email),
]);

/** A role within a master. `is_superadmin` sees all companies under its master. */
export const role = pgTable('role', {
  roleId: bigint('role_id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  masterFn: text('master_fn').notNull().references(() => master.masterFn),
  name: text('name').notNull(),
  isSuperadmin: boolean('is_superadmin').notNull().default(false),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_role_master_name').on(t.masterFn, t.name),
]);

/** M:N junction — a user can access MANY companies under their master, each with a role. */
export const userCompany = pgTable('user_company', {
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  companyFn: text('company_fn').notNull().references(() => company.companyFn),
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => role.roleId),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.userId, t.companyFn] }),
  index('idx_user_company_company').on(t.companyFn),
]);
