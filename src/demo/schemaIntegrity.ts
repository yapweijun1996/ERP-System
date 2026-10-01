import type { PGlite } from '@electric-sql/pglite';
import { DEMO_UNIQUE_INDEXES } from './uniqueIndexes.generated';

function schemaError(code: string, objectName: string, kind = 'UNIQUE INDEX') {
  return Object.assign(new Error(`${code}:${objectName}`), {
    code, demoBootStatement: `VALIDATE ${kind} ${objectName}`,
  });
}

/** Static browser Demo only. No production migration, seed, permission or data repair. */
export async function ensureDemoUniqueIndexes(client: PGlite): Promise<string[]> {
  return client.transaction(async (tx) => {
    const { rows } = await tx.query<{
      name: string; table: string; definition: string; valid: boolean; ready: boolean;
      immediate: boolean; constraint: string; constraintName: string | null; deferrable: boolean | null; deferred: boolean | null;
    }>(`
      select index_class.relname as name, table_class.relname as table,
             pg_get_indexdef(index_class.oid) as definition,
             index_row.indisvalid as valid, index_row.indisready as ready, index_row.indimmediate as immediate,
             coalesce(constraint_row.contype::text, '') as constraint,
             constraint_row.conname as "constraintName", constraint_row.condeferrable as deferrable,
             constraint_row.condeferred as deferred
      from pg_index index_row
      join pg_class index_class on index_class.oid=index_row.indexrelid
      join pg_class table_class on table_class.oid=index_row.indrelid
      join pg_namespace namespace on namespace.oid=table_class.relnamespace
      left join pg_constraint constraint_row on constraint_row.conindid=index_class.oid
        and constraint_row.conrelid=table_class.oid and constraint_row.contype in ('p','u')
      where namespace.nspname='public'`);
    const tables = new Set((await tx.query<{ name: string }>(
      "select tablename as name from pg_tables where schemaname='public'",
    )).rows.map(row => row.name));
    const existing = new Map(rows.map(row => [row.name, row]));
    const missing = [];
    // Validate the entire contract before any DDL. Same-name mismatches or lost
    // primary/unique constraints need explicit investigation, never blind replacement.
    for (const expected of DEMO_UNIQUE_INDEXES) {
      if (!tables.has(expected.table)) throw schemaError('demo_schema_table_missing', expected.table, 'TABLE');
      const actual = existing.get(expected.name);
      if (actual) {
        // Index SQL alone cannot distinguish a missing primary constraint or
        // deferrable arbiter. ON CONFLICT requires immediate eligible uniqueness.
        if (!actual.immediate || actual.deferrable || actual.deferred) {
          throw schemaError('demo_schema_index_ineligible', expected.name);
        }
        if (actual.constraint !== expected.constraint || actual.constraintName !== expected.constraintName) {
          throw schemaError('demo_schema_constraint_mismatch', expected.name, 'CONSTRAINT');
        }
        if (actual.definition !== expected.definition || !actual.valid || !actual.ready) {
          throw schemaError('demo_schema_index_mismatch', expected.name);
        }
      } else {
        if (expected.constraint) throw schemaError('demo_schema_constraint_missing', expected.name, 'CONSTRAINT');
        missing.push(expected);
      }
    }
    // Missing canonical ordinary unique indexes are additive schema repairs.
    // Duplicate rows fail CREATE UNIQUE INDEX and roll back every repair. No
    // deduplication, deletion, grant activation or migration-marker rewrite occurs.
    for (const index of missing) {
      try { await tx.exec(index.definition); }
      catch (error) {
        // Preserve SQLSTATE for classification but expose only canonical identifiers.
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'demo_schema_index_repair_failed';
        throw Object.assign(new Error(`demo_schema_index_repair_failed:${index.name}`), {
          code, demoBootStatement: `CREATE UNIQUE INDEX ${index.name}`,
        });
      }
    }
    return missing.map(index => index.name);
  });
}
