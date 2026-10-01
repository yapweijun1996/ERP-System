import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../data/schema';
import { seedDemo } from '../data/seed';
import { ensureDemoUniqueIndexes } from './schemaIntegrity';
import { DEMO_UNIQUE_INDEXES } from './uniqueIndexes.generated';

const client = new PGlite();
const creditIndex = DEMO_UNIQUE_INDEXES.find(index => index.name === 'uq_sales_credit_profile_customer')!;
const priceIndex = DEMO_UNIQUE_INDEXES.find(index => index.name === 'uq_account_code')!;
const creditFixture = readFileSync('web/public/db/erp-system-demo-sales-credit.sql', 'utf8');
beforeAll(async () => {
  await client.exec(readFileSync('web/public/db/erp-system-schema.sql', 'utf8'));
  await seedDemo(drizzle(client, { schema }));
  await client.exec(creditFixture);
});
afterAll(async () => { await client.close(); });
async function retainedData() {
  const result: Record<string, unknown> = {};
  for (const table of ['company','employee','sales_credit_profile','role','app_user','role_permission','user_company_role','role_resource_scope','user_company_role_scope','user_permission_override']) {
    result[table] = (await client.query(`select * from ${table} order by 1`)).rows;
  }
  return result;
}
describe('retained Demo unique-index integrity', () => {
  it('leaves a healthy schema and all tenant/authority records unchanged', async () => {
    const before = await retainedData();
    expect(await ensureDemoUniqueIndexes(client)).toEqual([]);
    expect(await retainedData()).toEqual(before);
  });
  it('reproduces SQLSTATE42P10 then repairs the missing arbiter without modifying retained data', async () => {
    await client.exec('DROP INDEX uq_sales_credit_profile_customer');
    await expect(client.exec(creditFixture)).rejects.toMatchObject({ code: '42P10' });
    const before = await retainedData();
    expect(await ensureDemoUniqueIndexes(client)).toEqual(['uq_sales_credit_profile_customer']);
    expect(await retainedData()).toEqual(before);
    await expect(client.exec(creditFixture)).resolves.toBeDefined();
    expect(await retainedData()).toEqual(before);
    expect(await ensureDemoUniqueIndexes(client)).toEqual([]);
  });
  it('fails closed on duplicate rows and atomically rolls back every pending index repair', async () => {
    await client.exec('DROP INDEX uq_sales_credit_profile_customer; DROP INDEX uq_account_code;');
    const duplicate = await client.query<{ id: number }>(`insert into sales_credit_profile
      (master_fn,company_fn,customer_id,currency,credit_limit,status,version)
      select master_fn,company_fn,customer_id,currency,credit_limit,status,version
      from sales_credit_profile limit 1 returning id`);
    const before = await retainedData();
    await expect(ensureDemoUniqueIndexes(client)).rejects.toMatchObject({ code: '23505' });
    expect(await retainedData()).toEqual(before);
    expect((await client.query("select indexname from pg_indexes where indexname in ('uq_sales_credit_profile_customer','uq_account_code')")).rows).toEqual([]);
    await client.query('delete from sales_credit_profile where id=$1', [duplicate.rows[0].id]);
    expect(await ensureDemoUniqueIndexes(client)).toHaveLength(2);
  });
  it('does not replace a same-name nonunique index or bypass missing primary constraints', async () => {
    await client.exec('DROP INDEX uq_sales_credit_profile_customer; CREATE INDEX uq_sales_credit_profile_customer ON sales_credit_profile (master_fn,company_fn,customer_id);');
    const before = await retainedData();
    await expect(ensureDemoUniqueIndexes(client)).rejects.toThrow('demo_schema_index_mismatch:uq_sales_credit_profile_customer');
    expect(await retainedData()).toEqual(before);
    await client.exec('DROP INDEX uq_sales_credit_profile_customer; ' + creditIndex.definition);
    await client.exec('ALTER TABLE role_permission DROP CONSTRAINT role_permission_role_id_permission_key_pk; DROP INDEX uq_account_code;');
    await expect(ensureDemoUniqueIndexes(client)).rejects.toThrow('demo_schema_constraint_missing:role_permission_role_id_permission_key_pk');
    expect((await client.query("select indexname from pg_indexes where indexname='uq_account_code'")).rows).toEqual([]);
    await client.exec('ALTER TABLE role_permission ADD CONSTRAINT role_permission_role_id_permission_key_pk PRIMARY KEY(role_id,permission_key); ' + priceIndex.definition);
    expect(await retainedData()).toEqual(before);
  });
});
