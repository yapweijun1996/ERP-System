import { sql } from 'drizzle-orm';
import type { DB } from './db';
import type { Scope } from './repo';

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
    await tx.execute(sql`select set_config('app.master_fn', ${scope.masterFn}, true)`);
    await tx.execute(sql`select set_config('app.company_fn', ${scope.companyFn}, true)`);
    return command(tx);
  });
}
