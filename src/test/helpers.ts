// Shared test fixture helpers (TASK-025). Every test gets its own fresh, migrated
// PGlite instance — same createPgliteDb()/migrate() pattern as src/demo.ts — so
// tests never share state and can run in any order or in parallel.
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createPgliteDb, type DB } from '../data/db';
import type { Scope } from '../data/repo';

export const TEST_SCOPE: Scope = { masterFn: 'TEST-M', companyFn: 'TEST-C' };

export async function freshDb(): Promise<DB> {
  const db = await createPgliteDb();
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}
