// Shared column building blocks. Spread these into every business table so the
// tenancy keys and timestamps are identical everywhere (see docs/MULTI_TENANCY.md,
// docs/DATA_MODEL.md). One schema, applied to both PGlite (demo) and PostgreSQL (prod).
import { text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Tenant scope present on EVERY business row.
 *   master_fn  → top tenant (group/holding)
 *   company_fn → one legal entity per country (SG entity, MY entity, …)
 * Both are injected from the authenticated session, never from client input, and are the
 * leading columns of composite indexes.
 */
export const tenant = {
  masterFn: text('master_fn').notNull(),
  companyFn: text('company_fn').notNull(),
};

/** created_at / updated_at, UTC, on every table. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
