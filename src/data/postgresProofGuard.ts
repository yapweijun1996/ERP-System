import { Client } from 'pg';

export interface PostgresProofDatabaseInventory {
  databaseName: string;
  relationCount: number;
  relationNames: string[];
}

export class PostgresProofDatabaseNotEmptyError extends Error {
  constructor(readonly inventory: PostgresProofDatabaseInventory) {
    const sample = inventory.relationNames.slice(0, 5).join(', ');
    const suffix = inventory.relationCount > 5 ? ', …' : '';
    super(
      `PostgreSQL proof refused database "${inventory.databaseName}": found `
      + `${inventory.relationCount} user table(s)${sample ? ` (${sample}${suffix})` : ''}. `
      + 'Use a new empty disposable database. No migrations or seed data were written.',
    );
    this.name = 'PostgresProofDatabaseNotEmptyError';
  }
}

export function assertPostgresProofDatabaseEmpty(
  inventory: PostgresProofDatabaseInventory,
): void {
  if (inventory.relationCount > 0) {
    throw new PostgresProofDatabaseNotEmptyError(inventory);
  }
}

/**
 * Read-only preflight for `POSTGRES_URL npm run demo`. It runs before the migrator,
 * so an existing application, UAT or previously used proof database is never changed.
 */
export async function guardPostgresProofDatabase(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{
      database_name: string;
      relation_count: number;
      relation_names: string[];
    }>(`
      select
        current_database() as database_name,
        count(*)::int as relation_count,
        coalesce(
          json_agg(format('%I.%I', n.nspname, c.relname) order by n.nspname, c.relname)
            filter (where c.oid is not null),
          '[]'::json
        ) as relation_names
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p')
        and n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname not like 'pg_toast%'
        and n.nspname not like 'pg_temp_%'
    `);
    const row = result.rows[0];
    assertPostgresProofDatabaseEmpty({
      databaseName: row.database_name,
      relationCount: row.relation_count,
      relationNames: row.relation_names,
    });
  } finally {
    await client.end();
  }
}
