import { check, foreignKey, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from './_shared';
import { company } from './tenancy';

/** Optional legal/contact profile for one Company; core tenant identity stays in company. */
export const companyProfile = pgTable('company_profile', {
  masterFn: text('master_fn').notNull(),
  companyFn: text('company_fn').notNull(),
  registrationNo: text('registration_no').notNull().default(''),
  taxNo: text('tax_no').notNull().default(''),
  addressLine1: text('address_line_1').notNull().default(''),
  addressLine2: text('address_line_2').notNull().default(''),
  city: text('city').notNull().default(''),
  region: text('region').notNull().default(''),
  postalCode: text('postal_code').notNull().default(''),
  /** Small validated raster image only. Kept out of ordinary Company queries. */
  logoDataUrl: text('logo_data_url'),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.masterFn, t.companyFn] }),
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_company_profile_company',
  }),
  check('ck_company_profile_version', sql`${t.version} > 0`),
]);
