// Data layer entry point. The SAME repo/seed code runs on either adapter because both
// produce a Drizzle database over the SAME schema, exposing an identical query API.
//
//   demo / dist/      → PGlite (Postgres in WASM, persists to IndexedDB in the browser)
//   production / Docker → node-postgres → PostgreSQL
//
// Repo functions accept `DB`, so they are written once and work in both modes.
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * Shared database type = the common base both adapters extend. Using the base (not a
 * union of the two concrete types) is what lets repo code call .select()/.insert()
 * once and have it accept either engine.
 */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export { schema };

/** PGlite adapter — demo mode. In-memory here; pass a path/idb:// for persistence. */
export async function createPgliteDb(dataDir?: string): Promise<PgliteDatabase<typeof schema>> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const client = new PGlite(dataDir);
  return drizzle(client, { schema });
}

/** node-postgres adapter — production mode. */
export async function createPostgresDb(connectionString: string): Promise<NodePgDatabase<typeof schema>> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}
