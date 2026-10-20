import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from './data/schema';
import { seedDemo } from './data/seed';
import { resolveOrganizationEmployeeIdsWithin } from './auth/organizationScope';

const masters = readFileSync('web/public/db/erp-system-demo-organization-v1.sql', 'utf8');
const assignments = readFileSync('web/public/db/erp-system-demo-organization-assignments-v1.sql', 'utf8');
const manifest = JSON.parse(readFileSync('web/public/db/erp-system-demo-organization-v1.json', 'utf8'));
const client = new PGlite();
const db = drizzle(client, { schema });
const scope = { masterFn: 'M1', companyFn: 'C-SG' };
async function authority() {
  const result: Record<string, unknown> = {};
  for (const table of ['app_user', 'role', 'role_permission', 'user_company_role', 'role_resource_scope', 'user_company_role_scope', 'user_permission_override']) {
    result[table] = (await client.query(`select * from ${table} order by 1`)).rows;
  }
  return result;
}
beforeAll(async () => {
  await client.exec(readFileSync('web/public/db/erp-system-schema.sql', 'utf8'));
  await seedDemo(db);
});
afterAll(async () => { await client.close(); });

describe('separate fictional organization pack', () => {
  it('has checked content and assigns only the fresh sample company without granting authority', async () => {
    expect(createHash('sha256').update(masters).digest('hex')).toBe(manifest.sha256);
    expect(createHash('sha256').update(assignments).digest('hex')).toBe(manifest.freshAssignmentsSha256);
    const beforeAuthority = await authority();
    const labels = (await client.query('select id,department,job_title,manager_id from employee order by id')).rows;
    await client.exec(`BEGIN; ${masters} ${assignments} COMMIT;`);
    expect((await client.query('select * from hr_business_unit')).rows).toHaveLength(3);
    expect((await client.query('select * from hr_position')).rows).toHaveLength(6);
    expect((await client.query("select * from employee where company_fn='C-SG' and business_unit_id is not null and position_id is not null and organization_version=1")).rows).toHaveLength(12);
    expect((await client.query("select * from employee where company_fn='C-MY' and (business_unit_id is not null or position_id is not null)")).rows).toHaveLength(0);
    expect((await client.query('select id,department,job_title,manager_id from employee order by id')).rows).toEqual(labels);
    expect(await authority()).toEqual(beforeAuthority);
  });

  it('retained pack replay preserves edits, inactivity, null assignments and all permissions', async () => {
    await client.exec("update hr_business_unit set name='Fictional edited unit',is_active=false,version=2 where code='DEMO-OPERATIONS'; update employee set business_unit_id=null,position_id=null,organization_version=2 where employee_no='EMP-1095';");
    const beforeAuthority = await authority();
    const units = (await client.query('select * from hr_business_unit order by id')).rows;
    const employees = (await client.query('select * from employee order by id')).rows;
    // Retained loader deliberately never executes assignments, including version-zero staff.
    await client.exec(masters);
    await client.exec(masters);
    expect((await client.query('select * from hr_business_unit order by id')).rows).toEqual(units);
    expect((await client.query('select * from employee order by id')).rows).toEqual(employees);
    expect(await authority()).toEqual(beforeAuthority);
  });

  it('organization projections remain tenant-qualified and fail closed for inactive/unassigned actors', async () => {
    const [actor] = (await client.query<{ user_id: number; business_unit_id: number; position_id: number; id: number }>("select user_id,business_unit_id,position_id,id from employee where company_fn='C-SG' and user_id is not null and business_unit_id is not null limit 1")).rows;
    const positions = await resolveOrganizationEmployeeIdsWithin(db, scope, Number(actor.user_id), 'position');
    expect(positions).toContain(Number(actor.id));
    expect(await resolveOrganizationEmployeeIdsWithin(db, { masterFn: 'OTHER', companyFn: 'C-SG' }, Number(actor.user_id), 'position')).toEqual([]);
    await client.query('update hr_position set is_active=false where id=$1', [actor.position_id]);
    expect(await resolveOrganizationEmployeeIdsWithin(db, scope, Number(actor.user_id), 'position')).toEqual([]);
    await client.query('update employee set business_unit_id=null,position_id=null where id=$1', [actor.id]);
    expect(await resolveOrganizationEmployeeIdsWithin(db, scope, Number(actor.user_id), 'business_unit')).toEqual([]);
    expect(await resolveOrganizationEmployeeIdsWithin(db, scope, Number(actor.user_id), 'position')).toEqual([]);
  });
});
