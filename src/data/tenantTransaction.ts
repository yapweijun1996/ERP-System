import { sql } from 'drizzle-orm';
import type { DB } from './db';
import type { Scope } from './repo';

/**
 * Establish the transaction-local tenant context used by PostgreSQL FORCE RLS.
 * Callers that generate a tenant key inside an existing transaction (for
 * example Platform Company provisioning) must invoke this before their first
 * write to a tenant-protected table.
 */
export async function setTenantContext(exec: DB, scope: Scope): Promise<void> {
  await exec.execute(sql`select set_config('app.master_fn', ${scope.masterFn}, true)`);
  await exec.execute(sql`select set_config('app.company_fn', ${scope.companyFn}, true)`);
}

/**
 * Every production business query runs inside a transaction with tenant
 * settings. PostgreSQL RLS policies read these transaction-local values;
 * PGlite accepts the same settings so both adapters exercise one call shape.
 */
export function withTenantTransaction<T>(
  db: DB,
  scope: Scope,
  command: (tx: DB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, scope);
    return command(tx);
  });
}

/**
 * Reporting workers need to claim jobs before a tenant is known. Production
 * RLS grants this transaction-local flag only to the report queue/artifact
 * policies; business tables still require the tenant context above.
 */
export function withReportingWorkerTransaction<T>(
  db: DB,
  command: (tx: DB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.reporting_worker', 'on', true)`);
    return command(tx);
  });
}

/** Document workers may claim only scan/extraction queues before tenant discovery. */
export function withDocumentWorkerTransaction<T>(
  db: DB,
  command: (tx: DB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.document_worker', 'on', true)`);
    return command(tx);
  });
}

/** Calendar workers claim cross-tenant appointment/leave projections before a
 * tenant is known. The production RLS policy grants this flag only to the
 * calendar queue/source tables listed in deploy/sql/production-rls.sql. */
export function withCalendarWorkerTransaction<T>(
  db: DB,
  command: (tx: DB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.calendar_worker', 'on', true)`);
    return command(tx);
  });
}
