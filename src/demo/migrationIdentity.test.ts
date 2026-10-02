import { readFileSync } from 'node:fs';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { assertDemoSchemaAsset, ensureDemoMigrationIdentity, initializeDemoDatabase, preflightDemoBootstrap, upgradeDemoSchema } from './migrationIdentity';
import { DEMO_SCHEMA_LINEAGE } from './schemaLineage.generated';
import { demoStructuralHash, readDemoStructuralContract } from './schemaLineage';

const schema=readFileSync('web/public/db/erp-system-schema.sql','utf8');
const latestIdentity=DEMO_SCHEMA_LINEAGE.identities.at(-1)!;
const hrIdentity=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===118)!;
const priorSchema=schema.slice(0,schema.indexOf('-- 0118_classy_ronan'));
const profileSql=readFileSync('drizzle/0119_company_profile.sql','utf8');
const hrSchema=schema.slice(0,schema.indexOf('-- 0119_company_profile'));
async function fixture(version=118,current: boolean|'hr'=false) {
  const db=new PGlite();
  await db.exec(current==='hr'?hrSchema:current?schema:priorSchema);
  await db.exec('create table "_erp_demo_migration"(version integer primary key,applied_at timestamptz not null default now())');
  await db.query('insert into "_erp_demo_migration"(version) values($1)',[version]);
  await db.exec(`
    insert into master(master_fn,login_code,name) values('M-FIXTURE','FIXTURE','Fictional retained Group');
    insert into currency(code,name,symbol) values('SGD','Singapore Dollar','S$');
    insert into company(master_fn,company_fn,name,country,currency,tax_regime) values('M-FIXTURE','C-FIXTURE','Fictional retained Company','SG','SGD','GST');
    insert into app_user(master_fn,username,email,full_name,password_hash,language) values('M-FIXTURE','fictional','fictional@example.test','Fictional retained user','public fictional fixture hash','en');
    insert into role(master_fn,company_fn,name,is_superadmin) values('M-FIXTURE','C-FIXTURE','Fictional retained role',false);
    insert into user_company(user_id,company_fn,role_id) select app_user.user_id,'C-FIXTURE',role.role_id from app_user,role;
    insert into user_company_role(user_id,company_fn,role_id,revoked_at) select app_user.user_id,'C-FIXTURE',role.role_id,current_timestamp from app_user,role;
    insert into employee(master_fn,company_fn,employee_no,full_name,email,department,job_title,start_date,base_salary) values('M-FIXTURE','C-FIXTURE','FICT-1','Fictional retained employee','fictional-employee@example.test','Existing Department','Existing Job','2026-01-01',1000);
    create table retained_custom_note(id integer primary key,note text);
    insert into retained_custom_note values(1,'Fictional unrelated retained extension');
  `);
  if((await db.query<{n:number}>("select count(*)::int as n from pg_tables where schemaname='public' and tablename='company_profile'")).rows[0].n)await db.query("insert into company_profile(master_fn,company_fn,registration_no,tax_no,address_line_1) values('M-FIXTURE','C-FIXTURE',$1,$2,$3)",['FICTIONAL-REG','FICTIONAL-TAX','Fictional preserved profile address']);
  return db;
}
async function preserved(db:PGlite) {
  const result:Record<string,unknown>={};
  for(const table of ['master','company','app_user','role','user_company_role','retained_custom_note'])result[table]=(await db.query('select * from '+table+' order by 1')).rows;
  result.employee=(await db.query('select id,master_fn,company_fn,employee_no,full_name,department,job_title from employee order by id')).rows;
  result.company_profile=(await db.query<{n:number}>("select count(*)::int as n from pg_tables where schemaname='public' and tablename='company_profile'")).rows[0].n?(await db.query('select * from company_profile order by master_fn,company_fn')).rows:[];
  return result;
}
async function identityTable(db:PGlite) {return (await db.query<{n:number}>("select count(*)::int as n from pg_tables where schemaname='public' and tablename='_erp_demo_schema_identity'")).rows[0].n;}
async function structure(db:PGlite) {return demoStructuralHash(await readDemoStructuralContract(db,DEMO_SCHEMA_LINEAGE.ownedTables,DEMO_SCHEMA_LINEAGE.ownedFunctions));}
async function historicalProfileFixture(modern=false,tracked=false) {
  const db=await fixture();
  await db.exec(profileSql);
  await db.query("insert into company_profile(master_fn,company_fn,registration_no,tax_no,address_line_1,version) values('M-FIXTURE','C-FIXTURE',$1,$2,$3,7)",['FICTIONAL-REG','FICTIONAL-TAX','Fictional historical profile address']);
  if(modern)await db.exec(DEMO_SCHEMA_LINEAGE.hrRepair.sql);
  if(tracked){
    await db.exec('create table "_erp_demo_schema_identity"(version integer primary key,tag text not null,sql_hash text not null,applied_at timestamptz not null default now())');
    await db.query('insert into "_erp_demo_schema_identity"(version,tag,sql_hash) values(118,$1,$2)',[hrIdentity.tag,hrIdentity.sqlHash]);
  }
  return db;
}
async function profileForeignKey(db:PGlite){return (await db.query("select pg_get_constraintdef(oid) as definition,convalidated as validated from pg_constraint where conname='fk_company_profile_company'")).rows;}

function orderedRunner() {
  const adapter=readFileSync('web/public/assets/erp-system-data-adapter.js','utf8');
  const start=adapter.indexOf('  async function ensureSchemaUpToDate(db){');
  const end=adapter.indexOf('\n  async function ensureWarehousePickFixture',start);
  const context=vm.createContext({DEMO_SCHEMA_VERSION:latestIdentity.version,console:{info:()=>{}},state:{runtime:{assertDemoSchemaAsset}},fetchSql:async()=>readFileSync('web/public/db/erp-system-migrations.sql','utf8'),execBootStatement:async(tx:Transaction,_label:string,sql:string)=>tx.exec(sql)});
  vm.runInContext(adapter.slice(start,end)+'\n globalThis.upgrade=ensureSchemaUpToDate;',context);
  return context.upgrade as (tx:Transaction)=>Promise<unknown>;
}

describe('identity-aware bounded retained Demo compatibility',()=>{
  it.each(['historical118','historical118 plus exact legacy role','d29-repaired tracked118','advanced untracked118'])('upgrades exact source-backed CompanyProfile lineage %s without rewriting profile values/version/FK or authority',async scenario=>{
    const db=await historicalProfileFixture(scenario.includes('repaired')||scenario.includes('advanced'),scenario.includes('tracked')&&!scenario.includes('untracked'));
    try{
      if(scenario.includes('legacy role'))await db.exec(DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index.definition);
      const before=await preserved(db),fkBefore=await profileForeignKey(db);
      const identityBefore=await identityTable(db)?(await db.query('select * from "_erp_demo_schema_identity" order by version')).rows:[];
      expect(await ensureDemoMigrationIdentity(db)).toEqual({repaired:true,version:119});
      expect(await preserved(db)).toEqual(before);
      expect(await profileForeignKey(db)).toEqual(fkBefore);
      expect(await structure(db)).toBe(latestIdentity.structuralHash);
      expect((await db.query('select version,tag from "_erp_demo_schema_identity" order by version')).rows).toEqual([{version:118,tag:hrIdentity.tag},{version:119,tag:'0119_company_profile'}]);
      if(identityBefore.length)expect((await db.query('select * from "_erp_demo_schema_identity" where version=118')).rows).toEqual(identityBefore);
      expect((await db.query('select max(version)::int as version from "_erp_demo_migration"')).rows).toEqual([{version:119}]);
      await upgradeDemoSchema(db,orderedRunner());
      expect(await ensureDemoMigrationIdentity(db)).toEqual({repaired:false,version:119});
      expect(await preserved(db)).toEqual(before);
      expect(await profileForeignKey(db)).toEqual(fkBefore);
    }finally{await db.close();}
  });
  it.each(['changed profile default','changed profile FK','extra owned drift','partial HR','contradictory HR identity','historical tag recorded','future marker','wrong119 marker'])('rejects CompanyProfile near-match %s before schema/marker/identity changes',async scenario=>{
    const db=await historicalProfileFixture(false,scenario==='contradictory HR identity');
    try{
      const changes:Record<string,string>={
        'changed profile default':"alter table company_profile alter column registration_no set default 'fictional private schema literal'",
        'changed profile FK':'alter table company_profile drop constraint fk_company_profile_company;alter table company_profile add constraint fk_company_profile_company foreign key(master_fn,company_fn) references company(master_fn,company_fn) on delete cascade',
        'extra owned drift':'alter table employee add column unknown_retained_value text',
        'partial HR':'create table hr_business_unit(id integer primary key)',
        'contradictory HR identity':'select 1',
        'historical tag recorded':'create table "_erp_demo_schema_identity"(version integer primary key,tag text not null,sql_hash text not null,applied_at timestamptz not null default now())',
        'future marker':'insert into "_erp_demo_migration"(version) values(120)',
        'wrong119 marker':'insert into "_erp_demo_migration"(version) values(119)',
      };
      await db.exec(changes[scenario]);
      if(scenario==='historical tag recorded')await db.query('insert into "_erp_demo_schema_identity"(version,tag,sql_hash) values(118,$1,$2)',[DEMO_SCHEMA_LINEAGE.historicalCompanyProfile.sourceTag,DEMO_SCHEMA_LINEAGE.historicalCompanyProfile.sourceSqlHash]);
      const before=await preserved(db),metadataBefore=await structure(db),markerBefore=(await db.query('select * from "_erp_demo_migration" order by version')).rows;
      const identityBefore=await identityTable(db)?(await db.query('select * from "_erp_demo_schema_identity" order by version')).rows:[];
      await expect(upgradeDemoSchema(db,orderedRunner())).rejects.toMatchObject({code:scenario.includes('identity')||scenario==='historical tag recorded'?'demo_schema_lineage_mismatch':'demo_schema_lineage_unknown'});
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect((await db.query('select * from "_erp_demo_migration" order by version')).rows).toEqual(markerBefore);
      expect(await identityTable(db)?(await db.query('select * from "_erp_demo_schema_identity" order by version')).rows:[]).toEqual(identityBefore);
    }finally{await db.close();}
  });
  it.each(['historical HR interruption','119 marker interruption','119 identity interruption'])('rolls back every known CompanyProfile repair step on %s and retries preserving profile/authority',async scenario=>{
    const db=await historicalProfileFixture();
    try{
      if(scenario==='historical HR interruption')await db.exec(DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index.definition);
      const before=await preserved(db),metadataBefore=await structure(db),fkBefore=await profileForeignKey(db);
      const interrupted={transaction:async(callback:(tx:Transaction)=>Promise<unknown>)=>db.transaction(async tx=>callback(new Proxy(tx,{get(target,key){
        if(key==='exec')return async(sql:string)=>{const result=await target.exec(sql);if(scenario==='historical HR interruption'&&sql===DEMO_SCHEMA_LINEAGE.hrRepair.sql)throw new Error('fictional historical HR interruption');return result;};
        if(key==='query')return async(sql:string,parameters?:unknown[])=>{const result=await target.query(sql,parameters);if((scenario==='119 marker interruption'&&sql.startsWith('insert into "_erp_demo_migration"'))||(scenario==='119 identity interruption'&&sql.startsWith('insert into "_erp_demo_schema_identity"')&&parameters?.[0]===119))throw new Error('fictional interrupted historical repair');return result;};
        const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
      }})))} as unknown as PGlite;
      await expect(ensureDemoMigrationIdentity(interrupted)).rejects.toThrow(/fictional|demo_schema_repair_failed/);
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect(await profileForeignKey(db)).toEqual(fkBefore);
      expect((await db.query('select max(version)::int as version from "_erp_demo_migration"')).rows).toEqual([{version:118}]);
      expect(await identityTable(db)).toBe(0);
      await upgradeDemoSchema(db,orderedRunner());
      expect(await preserved(db)).toEqual(before);
      expect(await profileForeignKey(db)).toEqual(fkBefore);
    }finally{await db.close();}
  });
  it.each([['current119',latestIdentity.version,true],['canonical118',118,'hr'],['genuine117',117,false],['bare118 actual117',118,false]] as const)('normalizes only the exact untracked obsolete role index for %s and preserves records/authority',async(_name,version,current)=>{
    const db=await fixture(version,current);
    try{
      await db.exec(DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index.definition);
      const before=await preserved(db);
      await upgradeDemoSchema(db,orderedRunner());
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(DEMO_SCHEMA_LINEAGE.identities.at(-1)!.structuralHash);
      expect((await db.query("select indexname from pg_indexes where schemaname='public' and indexname='uq_role_master_name'")).rows).toEqual([]);
      expect((await db.query('select version,tag from "_erp_demo_schema_identity" order by version')).rows).toEqual(version===118&&!current?[{version:118,tag:hrIdentity.tag},{version:latestIdentity.version,tag:latestIdentity.tag}]:[{version:latestIdentity.version,tag:latestIdentity.tag}]);
      await upgradeDemoSchema(db,orderedRunner());
      expect(await preserved(db)).toEqual(before);
    }finally{await db.close();}
  });
  it.each(['nonunique','different columns','partial predicate','constraint-backed','extra owned drift','tracked identity'])('rejects %s obsolete-name variation without changing data or structure',async scenario=>{
    const db=await fixture(latestIdentity.version,true);
    try{
      const sql:Record<string,string>={
        nonunique:'create index uq_role_master_name on role(master_fn,name)',
        'different columns':'create unique index uq_role_master_name on role(master_fn,role_id)',
        'partial predicate':'create unique index uq_role_master_name on role(master_fn,name) where is_superadmin=false',
        'constraint-backed':'alter table role add constraint uq_role_master_name unique(master_fn,name)',
        'extra owned drift':DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index.definition+';alter table employee add column unknown_retained_value text',
        'tracked identity':DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index.definition,
      };
      if(scenario==='tracked identity')await ensureDemoMigrationIdentity(db);
      await db.exec(sql[scenario]);
      const before=await preserved(db),metadataBefore=await structure(db);
      const identityBefore=await identityTable(db);
      await expect(upgradeDemoSchema(db,orderedRunner())).rejects.toMatchObject({code:'demo_schema_lineage_unknown'});
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect(await identityTable(db)).toBe(identityBefore);
    }finally{await db.close();}
  });
  it('preserves an unrelated extension index with the obsolete name through the actual late runner',async()=>{
    const db=await fixture(latestIdentity.version,true);
    try{
      await db.exec('create unique index uq_role_master_name on retained_custom_note(id)');
      const before=await preserved(db);
      await upgradeDemoSchema(db,orderedRunner());
      expect(await preserved(db)).toEqual(before);
      expect((await db.query("select indexdef from pg_indexes where schemaname='public' and indexname='uq_role_master_name'")).rows).toEqual([{indexdef:'CREATE UNIQUE INDEX uq_role_master_name ON public.retained_custom_note USING btree (id)'}]);
    }finally{await db.close();}
  });
  it.each([true,false])('rolls back obsolete-index normalization and identity/HR changes on interrupted %s initialization',async current=>{
    const db=await fixture(current?latestIdentity.version:118,current);
    try{
      await db.exec(DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index.definition);
      const before=await preserved(db),metadataBefore=await structure(db);
      const interrupted={transaction:async(callback:(tx:Transaction)=>Promise<unknown>)=>db.transaction(async tx=>callback(new Proxy(tx,{get(target,key){
        if(key==='query')return async(sql:string,parameters?:unknown[])=>{if(sql.startsWith('insert into "_erp_demo_schema_identity"'))throw new Error('fictional interruption after normalization');return target.query(sql,parameters);};
        const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
      }})))} as unknown as PGlite;
      await expect(ensureDemoMigrationIdentity(interrupted)).rejects.toThrow('fictional interruption after normalization');
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect(await identityTable(db)).toBe(0);
      await upgradeDemoSchema(db,orderedRunner());
      expect(await preserved(db)).toEqual(before);
    }finally{await db.close();}
  });
  it('recognizes exact117 mis-marked118, repairs only HR schema and preserves tenant data/revoked authority/extensions',async()=>{
    const db=await fixture();
    try{
      const before=await preserved(db);
      expect(await ensureDemoMigrationIdentity(db)).toEqual({repaired:true,version:118});
      expect(await preserved(db)).toEqual(before);
      const identity=(await db.query('select version,tag,sql_hash from "_erp_demo_schema_identity"')).rows;
      const latest=hrIdentity;
      expect(identity).toEqual([{version:118,tag:latest.tag,sql_hash:latest.sqlHash}]);
      expect(await structure(db)).toBe(latest.structuralHash);
      expect((await db.query('select organization_version,business_unit_id,position_id from employee')).rows).toEqual([{organization_version:0,business_unit_id:null,position_id:null}]);
      expect(await ensureDemoMigrationIdentity(db)).toEqual({repaired:false,version:118});
      await upgradeDemoSchema(db,orderedRunner());
      expect(await ensureDemoMigrationIdentity(db,true)).toEqual({repaired:false,version:latestIdentity.version});
      expect(await preserved(db)).toEqual(before);
    }finally{await db.close();}
  });
  it('lets a genuine117 use ordered compatibility through the latest migration and records identity only after complete validation',async()=>{
    const db=await fixture(117);
    try{
      const before=await preserved(db);
      expect(await ensureDemoMigrationIdentity(db)).toEqual({repaired:false,version:117});
      expect(await identityTable(db)).toBe(0);
      await upgradeDemoSchema(db,orderedRunner());
      expect(await preserved(db)).toEqual(before);
      expect(await identityTable(db)).toBe(1);
    }finally{await db.close();}
  });
  it('adopts the healthy untracked latest schema once without changing any tenant records',async()=>{
    const db=await fixture(latestIdentity.version,true);
    try{
      const before=await preserved(db);
      await ensureDemoMigrationIdentity(db);
      await ensureDemoMigrationIdentity(db);
      expect(await preserved(db)).toEqual(before);
      expect((await db.query('select count(*)::int as n from "_erp_demo_schema_identity"')).rows).toEqual([{n:1}]);
    }finally{await db.close();}
  });
  it.each(['future marker','unknown canonical column','partial HR schema'])('rejects %s before DDL/identity writes and preserves records',async scenario=>{
    const db=await fixture(scenario==='future marker'?latestIdentity.version+1:118);
    try{
      if(scenario==='unknown canonical column')await db.exec("alter table employee add column unknown_retained_value text default 'fictional private sentinel'");
      if(scenario==='partial HR schema')await db.exec('create table hr_business_unit(id integer primary key)');
      const before=await preserved(db),metadataBefore=await structure(db);
      await expect(ensureDemoMigrationIdentity(db)).rejects.toMatchObject({code:'demo_schema_lineage_unknown',demoBootStatement:'VALIDATE DEMO SCHEMA LINEAGE',message:'demo_schema_lineage_unknown'});
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect(await identityTable(db)).toBe(0);
    }finally{await db.close();}
  });
  it('reports only schema digests and category counts when rejecting private-literal structural drift',async()=>{
    const db=await fixture(latestIdentity.version,true);
    try{
      await db.exec("alter table employee add column unknown_retained_value text default 'fictional private sentinel'");
      const before=await preserved(db),metadataBefore=await structure(db);
      const error=await ensureDemoMigrationIdentity(db).catch(error=>error);
      expect(error).toMatchObject({code:'demo_schema_lineage_unknown',demoBootLineage:{marker:latestIdentity.version,structuralHash:metadataBefore,expectedStructuralHash:DEMO_SCHEMA_LINEAGE.identities.at(-1)!.structuralHash,matchedVersion:null}});
      const evidence=error.demoBootLineage;
      expect(evidence.categories).toHaveLength(7);
      expect(evidence.categories.filter((item:{hash:string;expectedHash:string})=>item.hash!==item.expectedHash).map((item:{name:string})=>item.name)).toEqual(['columns']);
      expect(JSON.stringify(evidence)).not.toMatch(/fictional|private|employee|unknown_retained_value|default/);
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect(await identityTable(db)).toBe(0);
    }finally{await db.close();}
  });
  it.each(['wrong tag/hash','identity claims118 over actual117'])('rejects %s without rewriting markers or identity records',async scenario=>{
    const db=await fixture();
    try{
      const latest=hrIdentity;
      await db.exec('create table "_erp_demo_schema_identity"(version integer primary key,tag text not null,sql_hash text not null,applied_at timestamptz not null default now())');
      await db.query('insert into "_erp_demo_schema_identity"(version,tag,sql_hash) values(118,$1,$2)',scenario==='wrong tag/hash'?['fictional private tag','fictional private hash']:[latest.tag,latest.sqlHash]);
      const before=await preserved(db),metadataBefore=await structure(db);
      const identityBefore=(await db.query('select * from "_erp_demo_schema_identity"')).rows;
      await expect(ensureDemoMigrationIdentity(db)).rejects.toMatchObject({code:'demo_schema_lineage_mismatch',demoBootStatement:'VALIDATE DEMO MIGRATION IDENTITY',message:'demo_schema_lineage_mismatch'});
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect((await db.query('select * from "_erp_demo_schema_identity"')).rows).toEqual(identityBefore);
      expect((await db.query('select max(version)::int as version from "_erp_demo_migration"')).rows).toEqual([{version:118}]);
    }finally{await db.close();}
  });
  it('rolls back an interruption after HR DDL and allows the same bounded repair to retry',async()=>{
    const db=await fixture();
    try{
      const before=await preserved(db),metadataBefore=await structure(db);
      const interrupted={transaction:async(callback:(tx:Transaction)=>Promise<unknown>)=>db.transaction(async tx=>callback(new Proxy(tx,{get(target,key){
        if(key==='exec')return async(sql:string)=>{const result=await target.exec(sql);if(sql===DEMO_SCHEMA_LINEAGE.hrRepair.sql)throw new Error('fictional interruption');return result;};
        const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
      }})))} as unknown as PGlite;
      await expect(ensureDemoMigrationIdentity(interrupted)).rejects.toMatchObject({code:'demo_schema_repair_failed',demoBootStatement:'REPAIR DEMO HR ORGANIZATION'});
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect(await identityTable(db)).toBe(0);
      await ensureDemoMigrationIdentity(db);
      expect(await preserved(db)).toEqual(before);
    }finally{await db.close();}
  });
  it('commits the actual genuine117 ordered runner, numeric marker and identity atomically across interruption',async()=>{
    const db=await fixture(117);
    try{
      const before=await preserved(db),metadataBefore=await structure(db);
      const upgrade=orderedRunner();
      await expect(upgradeDemoSchema(db,tx=>upgrade(new Proxy(tx,{get(target,key){
        if(key==='query')return async(sql:string,parameters?:unknown[])=>{if(sql.includes('insert into "_erp_demo_migration"'))throw new Error('fictional interruption before marker');return target.query(sql,parameters);};
        const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
      }})))).rejects.toThrow('fictional interruption before marker');
      expect(await structure(db)).toBe(metadataBefore);
      expect(await preserved(db)).toEqual(before);
      expect(await identityTable(db)).toBe(0);
      expect((await db.query('select max(version)::int as version from "_erp_demo_migration"')).rows).toEqual([{version:117}]);
      await upgradeDemoSchema(db,upgrade);
      expect(await preserved(db)).toEqual(before);
      expect((await db.query('select version,tag from "_erp_demo_schema_identity"')).rows).toEqual([{version:latestIdentity.version,tag:latestIdentity.tag}]);
    }finally{await db.close();}
  });
  it.each(['monetary precision','disabled append-only trigger','changed trigger function','identity sequence options','non-startup index','HR index name collision'])('rejects material %s drift without schema/data repair',async scenario=>{
    const db=await fixture();
    try{
      const mutations:Record<string,string>={
        'monetary precision':'alter table invoice alter column total_amount type numeric(18,8)',
        'disabled append-only trigger':'alter table leave_balance_entry disable trigger leave_balance_entry_append_only',
        'changed trigger function':'create or replace function prevent_leave_balance_entry_mutation() returns trigger language plpgsql as $$ begin return new; end; $$',
        'identity sequence options':'alter sequence employee_id_seq increment by 7',
        'non-startup index':'create index unknown_retained_index on employee(full_name)',
        'HR index name collision':'create unique index uq_hr_business_unit_code on retained_custom_note(id)',
      };
      await db.exec(mutations[scenario]);
      const before=await preserved(db),metadataBefore=await structure(db);
      await expect(ensureDemoMigrationIdentity(db)).rejects.toMatchObject({code:'demo_schema_lineage_unknown',demoBootStatement:'VALIDATE DEMO SCHEMA LINEAGE'});
      expect(await preserved(db)).toEqual(before);
      expect(await structure(db)).toBe(metadataBefore);
      expect(await identityTable(db)).toBe(0);
    }finally{await db.close();}
  });
  it('rejects stale/mixed schema assets before SQL and identifies only the source-owned asset',async()=>{
    await expect(assertDemoSchemaAsset('erp-system-schema.sql',schema)).resolves.toBeUndefined();
    await expect(assertDemoSchemaAsset('erp-system-migrations.sql',readFileSync('web/public/db/erp-system-migrations.sql','utf8'))).resolves.toBeUndefined();
    await expect(assertDemoSchemaAsset('erp-system-migrations.sql','fictional private stale bundle')).rejects.toMatchObject({code:'demo_schema_lineage_mismatch',demoBootStatement:'erp-system-migrations.sql',message:'demo_schema_lineage_mismatch'});
  });
  it('rejects future/partial unseeded storage before bootstrap writes and atomically rolls back failed fresh initialization',async()=>{
    const future=new PGlite();
    try{
      await future.exec(`create table "_erp_demo_migration"(version integer primary key);insert into "_erp_demo_migration" values(${latestIdentity.version+1});create table retained_custom_note(note text);insert into retained_custom_note values('fictional retained extension')`);
      const before=await readDemoStructuralContract(future);
      await expect(preflightDemoBootstrap(future)).rejects.toMatchObject({code:'demo_schema_lineage_unknown'});
      await expect(initializeDemoDatabase(future,tx=>tx.exec(schema))).rejects.toMatchObject({code:'demo_schema_lineage_unknown'});
      expect(await readDemoStructuralContract(future)).toEqual(before);
      expect((await future.query('select note from retained_custom_note')).rows).toEqual([{note:'fictional retained extension'}]);
    }finally{await future.close();}
    const blank=new PGlite();
    try{
      await expect(initializeDemoDatabase(blank,async tx=>{await tx.exec(schema);throw new Error('fictional seed interruption');})).rejects.toThrow('fictional seed interruption');
      expect((await blank.query("select tablename from pg_tables where schemaname='public'")).rows).toEqual([]);
      await initializeDemoDatabase(blank,async tx=>{await tx.exec(schema);await tx.exec('create table "_erp_demo_migration"(version integer primary key);insert into "_erp_demo_migration" values('+latestIdentity.version+')');});
      expect(await identityTable(blank)).toBe(1);
    }finally{await blank.close();}
  });
});
