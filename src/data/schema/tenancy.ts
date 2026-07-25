// Tenancy & access: master → company → user, with M:N user↔company.
// See docs/MULTI_TENANCY.md. RLS is NOT defined here — it is a production-only migration.
import {
  pgTable, text, bigint, boolean, date, timestamp, index, uniqueIndex, primaryKey, foreignKey, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from './_shared';
import { currency } from './localization';

/** Top tenant: a group / holding / franchise master. */
export const master = pgTable('master', {
  masterFn: text('master_fn').primaryKey(),
  loginCode: text('login_code').notNull(),
  name: text('name').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_master_login_code').on(t.loginCode),
]);

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

/** A person who logs in. Belongs to exactly ONE master. `language` = UI i18n preference.
 *  `password_hash` format: "pbkdf2$<iterations>$<saltHex>$<hashHex>" — see src/auth/password.ts
 *  (TASK-024). Never store or compare plaintext passwords. */
export const appUser = pgTable('app_user', {
  userId: bigint('user_id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  masterFn: text('master_fn').notNull().references(() => master.masterFn),
  username: text('username').notNull(),
  email: text('email'),
  fullName: text('full_name'),
  passwordHash: text('password_hash').notNull(),
  language: text('language').notNull().default('en'),   // en | ms | zh | ja | vi
  isActive: boolean('is_active').notNull().default(true),
  accountState: text('account_state').notNull().default('active'),
  passwordChangeRequired: boolean('password_change_required').notNull().default(false),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  offboardedAt: timestamp('offboarded_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_user_master_username').on(t.masterFn, t.username),
  uniqueIndex('uq_user_master_email').on(t.masterFn, t.email),
  check(
    'ck_app_user_account_state',
    sql`${t.accountState} in ('preactivated', 'active', 'offboarded')`,
  ),
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

/**
 * M:N membership — a user can access MANY companies under their master.
 * `role_id` remains as the compatibility/default role for existing integrations.
 * Authorization reads `user_company_role`, whose migration is backfilled from it.
 */
export const userCompany = pgTable('user_company', {
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  companyFn: text('company_fn').notNull().references(() => company.companyFn),
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => role.roleId),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.userId, t.companyFn] }),
  index('idx_user_company_company').on(t.companyFn),
]);

/** Multiple roles may be active for one user/company membership; permissions union. */
export const userCompanyRole = pgTable('user_company_role', {
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  companyFn: text('company_fn').notNull().references(() => company.companyFn),
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => role.roleId),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.userId, t.companyFn, t.roleId] }),
  foreignKey({
    columns: [t.userId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_user_company_role_membership',
  }),
  index('idx_user_company_role_company').on(t.companyFn, t.userId),
  index('idx_user_company_role_role').on(t.roleId),
]);
