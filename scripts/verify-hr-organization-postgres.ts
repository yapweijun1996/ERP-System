import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
try {
  execFileSync('docker',['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD='+password,'-e','POSTGRES_DB=hr_scope_qa','-p','127.0.0.1::5432','postgres:16-alpine'],{stdio:'pipe'});
  const published=execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim();
  const port=Number(published.split(':').at(-1));
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
  try {const count=await restored.query('select count(*)::int as count from hr_business_unit');assert.equal(count.rows[0].count,2);}finally{await restored.end();}
  console.log(JSON.stringify({ok:true,blankCompaniesBeforeFixture:0,migrations:firstJournal.rows[0].count,runtimeRole:role.rows[0],crossTenantWrite:'42501',concurrentVersions:'one success, one conflict',backupRestore:'passed',deploymentChanged:false}));
} finally {
  await runtime?.end();await owner?.end();
  execFileSync('docker',['rm','-f',container],{stdio:'ignore'});
}
