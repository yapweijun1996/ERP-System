import type { PGlite } from '@electric-sql/pglite';
import { DEMO_UNIQUE_INDEXES } from './uniqueIndexes.generated';

/** Static browser Demo only. No production migration, seed, permission or data repair. */
export async function ensureDemoUniqueIndexes(client: PGlite): Promise<string[]> {
  return client.transaction(async (tx) => {
    const { rows } = await tx.query<{
      name: string; table: string; definition: string; valid: boolean; ready: boolean;
    }>(`
      select index_class.relname as name, table_class.relname as table,
             pg_get_indexdef(index_class.oid) as definition,
             index_row.indisvalid as valid, index_row.indisready as ready
      from pg_index index_row
      join pg_class index_class on index_class.oid=index_row.indexrelid
      join pg_class table_class on table_class.oid=index_row.indrelid
      join pg_namespace namespace on namespace.oid=table_class.relnamespace
      where namespace.nspname='public'`);
    const tables = new Set((await tx.query<{ name: string }>(
      "select tablename as name from pg_tables where schemaname='public'",
    )).rows.map(row => row.name));
    const existing = new Map(rows.map(row => [row.name, row]));
    const missing = [];
    // Validate the entire contract before any DDL. Same-name mismatches or lost
    // primary/unique constraints need explicit investigation, never blind replacement.
    for (const expected of DEMO_UNIQUE_INDEXES) {
      if (!tables.has(expected.table)) throw new Error(`demo_schema_table_missing:${expected.table}`);
      const actual = existing.get(expected.name);
      if (actual) {
        if (actual.definition !== expected.definition || !actual.valid || !actual.ready) {
          throw new Error(`demo_schema_index_mismatch:${expected.name}`);
        }
      } else {
        if (expected.constraint) throw new Error(`demo_schema_constraint_missing:${expected.name}`);
        missing.push(expected);
      }
    }
    // Missing canonical ordinary unique indexes are additive schema repairs.
    // Duplicate rows fail CREATE UNIQUE INDEX and roll back every repair. No
    // deduplication, deletion, grant activation or migration-marker rewrite occurs.
    for (const index of missing) await tx.exec(index.definition);
    return missing.map(index => index.name);
  });
}
