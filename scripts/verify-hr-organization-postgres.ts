import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../src/data/schema';
import { seedDemo } from '../src/data/seed';
import { withTenantTransaction } from '../src/data/tenantTransaction';
import { saveOrganizationWithin, listOrganizationWithin } from '../src/modules/hr/organization';

const container='erp-hr-scope-qa-'+process.pid;
const password=randomBytes(24).toString('hex');
const rolePassword=randomBytes(24).toString('hex');
let owner: Pool|undefined, runtime: Pool|undefined;
let baselineFolder: string|undefined;
try {
  execFileSync('docker',['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD='+password,'-e','POSTGRES_DB=hr_scope_qa','-p','127.0.0.1::5432','postgres:16-alpine'],{stdio:'pipe'});
  const published=execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim();
  let port=Number(published.split(':').at(-1));
  owner=new Pool({host:'127.0.0.1',port,user:'postgres',password,database:'hr_scope_qa'});
  for(let attempt=0;;attempt++){try{await owner.query('select 1');break;}catch{if(attempt===100)throw new Error('Disposable PostgreSQL did not become ready');await new Promise(resolve=>setTimeout(resolve,100));}}
  const db=drizzle(owner,{schema});
  await migrate(db,{migrationsFolder:'drizzle'});
  const blank=await owner.query('select count(*)::int as count from company');
  assert.equal(blank.rows[0].count,0);
  const firstJournal=await owner.query('select count(*)::int as count from drizzle.__drizzle_migrations');
  await migrate(db,{migrationsFolder:'drizzle'});
  const secondJournal=await owner.query('select count(*)::int as count from drizzle.__drizzle_migrations');
  assert.equal(firstJournal.rows[0].count,secondJournal.rows[0].count);
  // Rehearse upgrading an isolated restore of populated committed-main schema.
  const journal=JSON.parse(await readFile('drizzle/meta/_journal.json','utf8'));
  baselineFolder=await mkdtemp(join(tmpdir(),'erp-hr-baseline-'));
  await mkdir(join(baselineFolder,'meta'));
  const baselineEntries=journal.entries.slice(0,-1);
  await writeFile(join(baselineFolder,'meta/_journal.json'),JSON.stringify({...journal,entries:baselineEntries}));
  for(const entry of baselineEntries)await copyFile('drizzle/'+entry.tag+'.sql',join(baselineFolder,entry.tag+'.sql'));
  await owner.query('CREATE DATABASE hr_upgrade_baseline');
  const baseline=new Pool({host:'127.0.0.1',port,user:'postgres',password,database:'hr_upgrade_baseline'});
  try {
    await migrate(drizzle(baseline,{schema}),{migrationsFolder:baselineFolder});
    await baseline.query("INSERT INTO currency(code,name) VALUES('SGD','Synthetic dollar'); INSERT INTO master(master_fn,login_code,name) VALUES('QA-M','QA-M','Synthetic upgrade master'); INSERT INTO company(company_fn,master_fn,name,country,currency,tax_regime) VALUES('QA-C','QA-M','Synthetic upgrade company','SG','SGD','GST')");
    await baseline.query("INSERT INTO employee(master_fn,company_fn,employee_no,full_name,email,department,job_title,start_date,base_salary) VALUES('QA-M','QA-C','QA-1','Fictional upgrade staff','fictional@example.invalid','Synthetic department','Synthetic position','2026-01-01',1000)");
  } finally {await baseline.end();}
  const baselineDump=execFileSync('docker',['exec',container,'pg_dump','-U','postgres','-Fc','hr_upgrade_baseline'],{maxBuffer:32*1024*1024});
  execFileSync('docker',['exec',container,'createdb','-U','postgres','hr_upgrade_restore'],{stdio:'pipe'});
  execFileSync('docker',['exec','-i',container,'pg_restore','-U','postgres','-d','hr_upgrade_restore'],{input:baselineDump,stdio:['pipe','pipe','pipe']});
  const upgrade=new Pool({host:'127.0.0.1',port,user:'postgres',password,database:'hr_upgrade_restore'});
  try {
    await migrate(drizzle(upgrade,{schema}),{migrationsFolder:'drizzle'});
    await migrate(drizzle(upgrade,{schema}),{migrationsFolder:'drizzle'});
    const retained=await upgrade.query("SELECT full_name,department,job_title,organization_version,business_unit_id,position_id FROM employee WHERE employee_no='QA-1'");
    assert.deepEqual(retained.rows[0],{full_name:'Fictional upgrade staff',department:'Synthetic department',job_title:'Synthetic position',organization_version:0,business_unit_id:null,position_id:null});
    const units=await upgrade.query('SELECT count(*)::int AS count FROM hr_business_unit');
    assert.equal(units.rows[0].count,0);
    const grants=await upgrade.query('SELECT count(*)::int AS count FROM user_company_role_scope');
    assert.equal(grants.rows[0].count,0);
  } finally {await upgrade.end();}
  // This fixture seed is confined to this disposable QA container.
  await seedDemo(db);
  const [admin]=await db.select().from(schema.appUser).where(eq(schema.appUser.username,'admin'));
  const actor={userId:admin.userId,requestId:'disposable-postgres-organization'};
  const sg={masterFn:'M1',companyFn:'C-SG'},my={masterFn:'M1',companyFn:'C-MY'};
  const unit=await withTenantTransaction(db,sg,tx=>saveOrganizationWithin(tx,sg,actor,'business_unit',{code:'PG-SG',name:'Synthetic SG',isActive:true,expectedVersion:0}));
  await withTenantTransaction(db,my,tx=>saveOrganizationWithin(tx,my,actor,'business_unit',{code:'PG-MY',name:'Synthetic MY',isActive:true,expectedVersion:0}));
  await owner.query("CREATE ROLE hr_scope_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '"+rolePassword+"'");
  await owner.query('GRANT USAGE ON SCHEMA public TO hr_scope_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO hr_scope_runtime; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO hr_scope_runtime');
  await owner.query(await readFile('deploy/sql/production-rls.sql','utf8'));
  runtime=new Pool({host:'127.0.0.1',port,user:'hr_scope_runtime',password:rolePassword,database:'hr_scope_qa'});
  const restricted=drizzle(runtime,{schema});
  const role=await runtime.query("select rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user");
  assert.deepEqual(role.rows[0],{rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false});
  const visible=await withTenantTransaction(restricted,sg,tx=>listOrganizationWithin(tx,sg,'business_unit'));
  assert.deepEqual(visible.map(row=>row.code),['PG-SG']);
  await assert.rejects(withTenantTransaction(restricted,sg,tx=>tx.insert(schema.hrPosition).values({...my,code:'DENIED',name:'Cross tenant denied'})),error=>String((error as {cause?:{code?:string}}).cause?.code)==='42501');
  const results=await Promise.allSettled(['A','B'].map(name=>withTenantTransaction(restricted,sg,tx=>saveOrganizationWithin(tx,sg,actor,'business_unit',{id:unit.id,code:unit.code,name:'Synthetic '+name,isActive:true,expectedVersion:1}))));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected'&&(result.reason as {code:string}).code==='organization_version_conflict').length,1);
  const dump=execFileSync('docker',['exec',container,'pg_dump','-U','postgres','-Fc','hr_scope_qa'],{maxBuffer:32*1024*1024});
  execFileSync('docker',['exec',container,'createdb','-U','postgres','hr_scope_restore'],{stdio:'pipe'});
  execFileSync('docker',['exec','-i',container,'pg_restore','-U','postgres','-d','hr_scope_restore'],{input:dump,stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024});
  const restored=new Pool({host:'127.0.0.1',port,user:'postgres',password,database:'hr_scope_restore'});
  try {
    const count=await restored.query('select count(*)::int as count from hr_business_unit');assert.equal(count.rows[0].count,2);
    await migrate(drizzle(restored,{schema}),{migrationsFolder:'drizzle'});
    const journal=await restored.query('select count(*)::int as count from drizzle.__drizzle_migrations');
    assert.equal(journal.rows[0].count,firstJournal.rows[0].count);
    const compatible=await restored.query('select id,full_name,department,job_title from employee limit 1');
    assert.equal(compatible.rows.length,1);
  } finally{await restored.end();}
  await runtime.end();runtime=undefined;await owner.end();owner=undefined;
  execFileSync('docker',['restart',container],{stdio:'pipe'});
  port=Number(execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim().split(':').at(-1));
  owner=new Pool({host:'127.0.0.1',port,user:'postgres',password,database:'hr_scope_qa'});
  for(let attempt=0;;attempt++){try{await owner.query('select 1');break;}catch{if(attempt===100)throw new Error('Restart readiness failed');await new Promise(resolve=>setTimeout(resolve,100));}}
  runtime=new Pool({host:'127.0.0.1',port,user:'hr_scope_runtime',password:rolePassword,database:'hr_scope_qa'});
  const restarted=await withTenantTransaction(drizzle(runtime,{schema}),sg,tx=>listOrganizationWithin(tx,sg,'business_unit'));
  assert.equal(restarted.length,1);
  const persistedJournal=await owner.query('select count(*)::int as count from drizzle.__drizzle_migrations');
  assert.equal(persistedJournal.rows[0].count,firstJournal.rows[0].count);
  console.log(JSON.stringify({ok:true,blankCompaniesBeforeFixture:0,migrations:firstJournal.rows[0].count,runtimeRole:role.rows[0],crossTenantWrite:'42501',concurrentVersions:'one success, one conflict',backupRestore:'passed',restoredMigrationReplay:'passed',restartRuntimeRls:'passed',compatibleOldEmployeeRead:'passed',populatedMainRestoreUpgrade:'passed',noAssignmentOrGrantBackfill:'passed',deploymentChanged:false}));
} finally {
  await runtime?.end();await owner?.end();
  if(baselineFolder)await rm(baselineFolder,{recursive:true,force:true});
  execFileSync('docker',['rm','-f',container],{stdio:'ignore'});
}
