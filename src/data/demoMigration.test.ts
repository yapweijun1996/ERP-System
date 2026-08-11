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
        insert into currency (code, name, symbol)
        values ('SGD', 'Singapore Dollar', 'S$');
        insert into company (
          company_fn, master_fn, name, country, currency, tax_regime
        ) values (
          'C-LEGACY', 'M-LEGACY', 'Legacy Company', 'SG', 'SGD', 'SG_GST'
        );
        insert into app_user (master_fn, email, full_name, language)
        values ('M-LEGACY', 'legacy@example.com', 'Legacy Admin', 'en');
        insert into role (master_fn, name, is_superadmin)
        values ('M-LEGACY', 'Legacy Admin Role', true);
        insert into user_company (user_id, company_fn, role_id)
        select app_user.user_id, 'C-LEGACY', role.role_id
        from app_user, role
        where app_user.email = 'legacy@example.com'
          and role.name = 'Legacy Admin Role';
        insert into product (master_fn, company_fn, sku, name)
        values ('M-LEGACY', 'C-LEGACY', 'LEGACY-SKU', 'Legacy Product');
        insert into warehouse (master_fn, company_fn, code, name)
        values ('M-LEGACY', 'C-LEGACY', 'LEGACY-WH', 'Legacy Warehouse');
        insert into stock_level (
          master_fn, company_fn, product_id, warehouse_id, qty
        )
        select
          'M-LEGACY', 'C-LEGACY', product.id, warehouse.id, 7
        from product, warehouse
        where product.sku = 'LEGACY-SKU'
          and warehouse.code = 'LEGACY-WH';
        insert into stock_movement (
          master_fn, company_fn, product_id, warehouse_id,
          qty, direction, ref_type
        )
        select
          'M-LEGACY', 'C-LEGACY', product.id, warehouse.id,
          7, 'in', 'legacy_seed'
        from product, warehouse
        where product.sku = 'LEGACY-SKU'
          and warehouse.code = 'LEGACY-WH';
      `);

      await db.exec(BROWSER_MIGRATIONS);
      /* The browser runner records schema version 73 and, on reload, selects
         only headers newer than that marker. Replaying every historic data
         migration against the expanded company-role schema is intentionally
         avoided because those migrations targeted superseded constraints. */
      await db.exec(`
        create table if not exists "_erp_demo_migration" (
          "version" integer primary key,
          "applied_at" timestamptz not null default now()
        );
        insert into "_erp_demo_migration" ("version") values (73)
        on conflict ("version") do nothing;
      `);

      const columns = await db.query<{ column_name: string; is_nullable: string }>(`
        select column_name, is_nullable
        from information_schema.columns
        where table_schema = 'public' and table_name = 'app_user'
      `);
      expect(columns.rows).toContainEqual({
        column_name: 'password_hash',
        is_nullable: 'NO',
      });

      const legacyUser = await db.query<{
        email: string;
        username: string;
        password_hash: string;
      }>(`
        select email, username, password_hash
        from app_user
        where email = 'legacy@example.com'
      `);
      expect(legacyUser.rows).toHaveLength(1);
      expect(legacyUser.rows[0].username).toBe('legacy');
      expect(legacyUser.rows[0].password_hash).toMatch(/^pbkdf2\$100000\$/);

      const migratedIdentity = await db.query<{
        login_code: string;
        role_name: string;
      }>(`
        select master.login_code, role.name as role_name
        from app_user
        join master on master.master_fn = app_user.master_fn
        join user_company_role assignment
          on assignment.user_id = app_user.user_id
         and assignment.company_fn = 'C-LEGACY'
        join role on role.role_id = assignment.role_id
        where app_user.email = 'legacy@example.com'
      `);
      expect(migratedIdentity.rows).toEqual([{
        login_code: 'M-LEGACY',
        role_name: 'Company Owner',
      }]);

      const roleIndexes = await db.query<{ indexname: string }>(`
        select indexname from pg_indexes
        where schemaname = 'public'
          and indexname in ('uq_role_master_name', 'uq_role_company_name')
        order by indexname
      `);
      expect(roleIndexes.rows).toEqual([{ indexname: 'uq_role_company_name' }]);

      const addedTables = await db.query<{ table_name: string }>(`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'supplier', 'purchase_order', 'opportunity', 'activity',
            'app_session', 'api_idempotency', 'audit_log', 'role_permission'
          )
        order by table_name
      `);
      expect(addedTables.rows.map((row) => row.table_name)).toEqual([
        'activity',
        'api_idempotency',
        'app_session',
        'audit_log',
        'opportunity',
        'purchase_order',
        'role_permission',
        'supplier',
      ]);

      const calendarTables = await db.query<{ table_name: string }>(`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'calendar_outbound_connection', 'calendar_outbound_event'
          )
        order by table_name
      `);
      expect(calendarTables.rows.map((row) => row.table_name)).toEqual([
        'calendar_outbound_connection',
        'calendar_outbound_event',
      ]);

      const versionColumns = await db.query<{ table_name: string }>(`
        select table_name
        from information_schema.columns
        where table_schema = 'public'
          and column_name = 'version'
          and table_name in (
            'sales_order', 'invoice', 'purchase_order',
            'supplier_invoice', 'opportunity'
          )
        order by table_name
      `);
      expect(versionColumns.rows.map((row) => row.table_name)).toEqual([
        'invoice',
        'opportunity',
        'purchase_order',
        'sales_order',
        'supplier_invoice',
      ]);

      const locationProjection = await db.query<{
        code: string;
        tracking_key: string;
        qty: string;
        movement_bin_id: string;
      }>(`
        select
          bin.code,
          balance.tracking_key,
          balance.qty::text,
          movement.bin_id::text as movement_bin_id
        from stock_location_balance balance
        join warehouse_bin bin on bin.id = balance.bin_id
        join stock_movement movement
          on movement.product_id = balance.product_id
         and movement.warehouse_id = balance.warehouse_id
        where balance.master_fn = 'M-LEGACY'
          and balance.company_fn = 'C-LEGACY'
      `);
      expect(locationProjection.rows).toHaveLength(1);
      expect(locationProjection.rows[0]).toMatchObject({
        code: 'DEFAULT',
        tracking_key: 'none',
        qty: '7.0000',
      });
      expect(locationProjection.rows[0].movement_bin_id).not.toBeNull();

      const master = await db.query<{ name: string }>(`
        select name from master where master_fn = 'M-LEGACY'
      `);
      expect(master.rows).toEqual([{ name: 'Legacy Group' }]);

      await db.query(
        `insert into app_user (
           master_fn, username, email, full_name, password_hash, language
         ) values ($1, $2, $3, $4, $5, $6)`,
        [
          'M-LEGACY',
          'new-admin',
          'new-admin@example.com',
          'New Admin',
          legacyUser.rows[0].password_hash,
          'en',
        ],
      );
      await db.query(
        `insert into app_user (
           master_fn, username, email, full_name, password_hash, language
         ) values ($1, $2, null, $3, $4, $5)`,
        [
          'M-LEGACY',
          'preactivated-user',
          'Preactivated User',
          legacyUser.rows[0].password_hash,
          'en',
        ],
      );
      const count = await db.query<{ n: number }>(
        `select count(*)::int as n from app_user where master_fn = 'M-LEGACY'`,
      );
      expect(count.rows[0].n).toBe(3);
    } finally {
      await db.close();
    }
  });
});
