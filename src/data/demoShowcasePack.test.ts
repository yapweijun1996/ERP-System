import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';
import { seedDemo } from './seed';

describe('deterministic enterprise Demo pack', () => {
  it('verifies SHA-256, fixed counts, references and balanced journals', async () => {
    const [schemaSql, packSql, manifestText] = await Promise.all([
      readFile('web/public/db/erp-system-schema.sql', 'utf8'),
      readFile('web/public/db/erp-system-showcase-v1.sql', 'utf8'),
      readFile('web/public/db/erp-system-showcase-v1.json', 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText) as {
      version: string;
      personas: number;
      sha256: string;
      records: { total: number };
    };
    expect(manifest.version).toBe('2');
    expect(manifest.personas).toBe(12);
    expect(createHash('sha256').update(packSql).digest('hex')).toBe(manifest.sha256);
    const client = new PGlite();
    await client.exec(schemaSql);
    const db = drizzle(client, { schema });
    await seedDemo(db);
    await client.exec(packSql);
    const counts = (await client.query<{
      activities: number; movements: number; gl_entries: number;
    }>(`
      select
        (select count(*)::int from activity where body like 'Deterministic showcase activity %') as activities,
        (select count(*)::int from stock_movement where ref_type='demo_pack') as movements,
        (select count(*)::int from gl_entry where journal_ref like 'DEMO-JE-%') as gl_entries
    `)).rows[0];
    expect(Number(counts.activities) + Number(counts.movements) + Number(counts.gl_entries))
      .toBe(manifest.records.total);
    const unbalanced = (await client.query(`
      select journal_ref from gl_entry where journal_ref like 'DEMO-JE-%'
      group by master_fn,company_fn,journal_ref
      having abs(sum(debit)-sum(credit)) > 0.005
    `)).rows;
    expect(unbalanced).toHaveLength(0);
    const masterCounts = (await client.query<{
      employees: number; customers: number; suppliers: number; products: number;
    }>(`
      select
        (select count(*)::int from employee) as employees,
        (select count(*)::int from customer) as customers,
        (select count(*)::int from supplier) as suppliers,
        (select count(*)::int from product) as products
    `)).rows[0];
    expect(Number(masterCounts.employees)).toBeGreaterThanOrEqual(100);
    expect(Number(masterCounts.customers)).toBeGreaterThanOrEqual(199);
    expect(Number(masterCounts.suppliers)).toBeGreaterThanOrEqual(100);
    expect(Number(masterCounts.products)).toBeGreaterThanOrEqual(500);
    const personas = (await client.query<{
      username: string; is_superadmin: boolean; roles: string[]; companies: string[];
    }>(`
      select u.username, bool_or(r.is_superadmin) as is_superadmin,
        array_agg(distinct r.name order by r.name) as roles,
        array_agg(distinct ucr.company_fn order by ucr.company_fn) as companies
      from app_user u
      join user_company_role ucr on ucr.user_id=u.user_id
      join role r on r.role_id=ucr.role_id
      where u.master_fn='M1' and u.username in (
        'admin','company-admin','manager','sales','buyer','warehouse','production',
        'finance-preparer','finance-checker','hr','service','viewer'
      )
      group by u.user_id,u.username order by u.username
    `)).rows;
    expect(personas).toHaveLength(12);
    const superadmin = personas.find((row) => row.username === 'admin');
    expect(superadmin).toMatchObject({ is_superadmin: true, companies: ['C-MY', 'C-SG'] });
    expect(superadmin?.roles).toContain('Superadmin');
    const viewer = personas.find((row) => row.username === 'viewer');
    expect(viewer?.roles).toContain('Viewer');
    await client.close();
  }, 30_000);
});
