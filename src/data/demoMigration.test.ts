import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LEGACY_SCHEMA = readFileSync(path.join(ROOT, 'drizzle/0000_init.sql'), 'utf8');
const BROWSER_MIGRATIONS = readFileSync(
  path.join(ROOT, 'web/public/db/erp-system-migrations.sql'),
  'utf8',
);

describe('browser demo compatibility migrations', () => {
  it('upgrades a populated 0000 database without losing existing rows', async () => {
    const db = new PGlite();
    try {
      await db.exec(LEGACY_SCHEMA);
      await db.exec(`
        insert into master (master_fn, name) values ('M-LEGACY', 'Legacy Group');
        insert into app_user (master_fn, email, full_name, language)
        values ('M-LEGACY', 'legacy@example.com', 'Legacy Admin', 'en');
      `);

      await db.exec(BROWSER_MIGRATIONS);
      await db.exec(BROWSER_MIGRATIONS); // retry/reload must remain safe

      const columns = await db.query<{ column_name: string; is_nullable: string }>(`
        select column_name, is_nullable
        from information_schema.columns
        where table_schema = 'public' and table_name = 'app_user'
      `);
      expect(columns.rows).toContainEqual({
        column_name: 'password_hash',
        is_nullable: 'NO',
      });

      const legacyUser = await db.query<{ email: string; password_hash: string }>(`
        select email, password_hash from app_user where email = 'legacy@example.com'
      `);
      expect(legacyUser.rows).toHaveLength(1);
      expect(legacyUser.rows[0].password_hash).toMatch(/^pbkdf2\$100000\$/);

      const addedTables = await db.query<{ table_name: string }>(`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('supplier', 'purchase_order', 'opportunity', 'activity')
        order by table_name
      `);
      expect(addedTables.rows.map((row) => row.table_name)).toEqual([
        'activity',
        'opportunity',
        'purchase_order',
        'supplier',
      ]);

      const master = await db.query<{ name: string }>(`
        select name from master where master_fn = 'M-LEGACY'
      `);
      expect(master.rows).toEqual([{ name: 'Legacy Group' }]);

      await db.query(
        `insert into app_user (master_fn, email, full_name, password_hash, language)
         values ($1, $2, $3, $4, $5)`,
        [
          'M-LEGACY',
          'new-admin@example.com',
          'New Admin',
          legacyUser.rows[0].password_hash,
          'en',
        ],
      );
      const count = await db.query<{ n: number }>(
        `select count(*)::int as n from app_user where master_fn = 'M-LEGACY'`,
      );
      expect(count.rows[0].n).toBe(2);
    } finally {
      await db.close();
    }
  });
});
