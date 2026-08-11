import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATION = readFileSync(path.join(ROOT, 'drizzle/0094_platform_module_entitlement.sql'), 'utf8');

describe('platform entitlement migration preservation', () => {
  it('normalizes Master entitlement from the union without rewriting Company allocations', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create table master (master_fn text primary key);
        create table master_module (
          master_fn text not null, module_key text not null, enabled boolean not null default true,
          created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
          primary key (master_fn, module_key)
        );
        create table company_module (
          master_fn text not null, company_fn text not null, module_key text not null,
          enabled boolean not null default false, configured boolean not null default false,
          created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
          primary key (master_fn, company_fn, module_key)
        );
        insert into master values ('M1'), ('M2');
        insert into master_module (master_fn,module_key,enabled) values ('M1','sales',false);
        insert into company_module (master_fn,company_fn,module_key,enabled,configured) values
          ('M1','C1','sales',true,true), ('M1','C2','sales',false,true),
          ('M1','C1','crm',false,true);
      `);
      await db.exec(MIGRATION);
      const masterRows = await db.query<{
        master_fn: string; module_key: string; enabled: boolean; default_company_allocated: boolean;
      }>(`select master_fn,module_key,enabled,default_company_allocated from master_module
          where module_key in ('sales','crm','expenses_tax') order by master_fn,module_key`);
      expect(masterRows.rows).toEqual(expect.arrayContaining([
        { master_fn: 'M1', module_key: 'sales', enabled: true, default_company_allocated: true },
        { master_fn: 'M1', module_key: 'crm', enabled: false, default_company_allocated: false },
        { master_fn: 'M1', module_key: 'expenses_tax', enabled: false, default_company_allocated: false },
        { master_fn: 'M2', module_key: 'sales', enabled: false, default_company_allocated: false },
      ]));
      const allocations = await db.query<{ company_fn: string; enabled: boolean }>(
        `select company_fn,enabled from company_module where master_fn='M1' and module_key='sales' order by company_fn`,
      );
      expect(allocations.rows).toEqual([
        { company_fn: 'C1', enabled: true }, { company_fn: 'C2', enabled: false },
      ]);
    } finally {
      await db.close();
    }
  });
});
