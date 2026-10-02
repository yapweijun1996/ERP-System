import type { PGlite, Transaction } from '@electric-sql/pglite';
import { DEMO_SCHEMA_LINEAGE } from './schemaLineage.generated';
import { DEMO_STRUCTURAL_CATEGORIES, demoStructuralHash, demoStructuralCategoryEvidence, demoTextHash, readDemoStructuralContract, type DemoStructuralContract } from './schemaLineage';

type IdentityRow = { version: number; tag: string; sqlHash: string };
type Client = Pick<PGlite | Transaction, 'query' | 'exec'>;
const latest=DEMO_SCHEMA_LINEAGE.identities[DEMO_SCHEMA_LINEAGE.identities.length-1];

function lineageError(code: string, statement='VALIDATE DEMO SCHEMA LINEAGE', evidence?: unknown) {
  return Object.assign(new Error(code),{code,demoBootStatement:statement,...(evidence?{demoBootLineage:evidence}:{})});
}
async function lineageEvidence(tx: Transaction,contract: DemoStructuralContract,current: number,structuralHash: string,recorded: IdentityRow[]) {
  const expected=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===current);
  const known=DEMO_SCHEMA_LINEAGE.identities.slice().reverse().find(identity=>identity.structuralHash===structuralHash);
  const categories=await demoStructuralCategoryEvidence(contract);
  const legacy=await legacyRoleIndexState(tx);
  const normalizedHash=legacy==='known_legacy'?await demoStructuralHash({...contract,indexes:contract.indexes.filter(index=>index.name!==DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index.name)}):null;
  const normalizedKnown=normalizedHash?DEMO_SCHEMA_LINEAGE.identities.slice().reverse().find(identity=>identity.structuralHash===normalizedHash):null;
  return {marker:current,structuralHash,expectedStructuralHash:expected?.structuralHash??null,matchedVersion:known?.version??null,
    identityCount:recorded.length,legacyRoleIndex:legacy,normalizedMatchedVersion:normalizedKnown?.version??null,
    categories:DEMO_STRUCTURAL_CATEGORIES.map(name=>({name,hash:categories[name].hash,count:categories[name].count,expectedHash:expected?.categories[name].hash??null,expectedCount:expected?.categories[name].count??null}))};
}
async function marker(client: Client): Promise<number> {
  const present=(await client.query<{ n: number }>("select count(*)::int as n from pg_tables where schemaname='public' and tablename='_erp_demo_migration'")).rows[0].n;
  if(!present)return 0;
  return Number((await client.query<{ version: number }>('select coalesce(max(version),0)::int as version from "_erp_demo_migration"')).rows[0].version);
}
async function recordedIdentities(client: Client): Promise<IdentityRow[]> {
  const present=(await client.query<{ n: number }>("select count(*)::int as n from pg_tables where schemaname='public' and tablename='_erp_demo_schema_identity'")).rows[0].n;
  if(!present)return [];
  try {
    const rows=(await client.query<IdentityRow>('select version,tag,sql_hash as "sqlHash" from "_erp_demo_schema_identity" order by version')).rows;
    for(const row of rows){
      const expected=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===Number(row.version));
      if(!expected||row.tag!==expected.tag||row.sqlHash!==expected.sqlHash)throw lineageError('demo_schema_lineage_mismatch','VALIDATE DEMO MIGRATION IDENTITY');
    }
    return rows;
  } catch(error) {
    if(error&&typeof error==='object'&&'code' in error&&error.code==='demo_schema_lineage_mismatch')throw error;
    throw lineageError('demo_schema_identity_invalid','VALIDATE DEMO MIGRATION IDENTITY');
  }
}
async function recordIdentity(client: Client, identity: typeof latest) {
  await client.exec('create table if not exists "_erp_demo_schema_identity" ("version" integer primary key,"tag" text not null,"sql_hash" text not null,"applied_at" timestamptz not null default now())');
  await client.query('insert into "_erp_demo_schema_identity" (version,tag,sql_hash) values($1,$2,$3) on conflict(version) do nothing',[identity.version,identity.tag,identity.sqlHash]);
}

/** Reject mixed/stale cached schema assets before executing any of their SQL. */
export async function assertDemoSchemaAsset(name: string, text: string): Promise<void> {
  if(name!=='erp-system-schema.sql'&&name!=='erp-system-migrations.sql')throw lineageError('demo_schema_lineage_unknown');
  if(await demoTextHash(text)!==DEMO_SCHEMA_LINEAGE.assetHashes[name])throw lineageError('demo_schema_lineage_mismatch',name);
}

async function hrIndexes(client: Client) {
  return (await client.query<{name:string;table:string;definition:string;valid:boolean;ready:boolean;immediate:boolean;constraint:string}>(`
    select index_class.relname as name, table_class.relname as "table",
           pg_get_indexdef(index_class.oid) as definition,
           index_row.indisvalid as valid,index_row.indisready as ready,index_row.indimmediate as immediate,
           coalesce(constraint_row.contype::text,'') as constraint
    from pg_index index_row join pg_class index_class on index_class.oid=index_row.indexrelid
    join pg_class table_class on table_class.oid=index_row.indrelid
    join pg_namespace namespace on namespace.oid=index_class.relnamespace
    left join pg_constraint constraint_row on constraint_row.conindid=index_class.oid
      and constraint_row.conrelid=table_class.oid and constraint_row.contype in ('p','u')
    where namespace.nspname='public' and index_class.relname in ('uq_hr_business_unit_code','uq_hr_business_unit_tenant_id','uq_hr_position_code','uq_hr_position_tenant_id')`)).rows;
}
async function validateHrIndexes(client: Client) {
  const rows=await hrIndexes(client);
  for(const expected of DEMO_SCHEMA_LINEAGE.hrRepair.indexes){
    const actual=rows.find(row=>row.name===expected.name);
    if(!actual||actual.table!==expected.table||actual.definition!==expected.definition||!actual.valid||!actual.ready||!actual.immediate||actual.constraint!=='')throw lineageError('demo_schema_lineage_unknown');
  }
}

/** Early-v73 Demo previews retained this exact obsolete source-owned role index.
 * Recognize the complete normalized canonical contract before any DDL. Never drop
 * an extension's same-name index, a changed definition, or a tracked identity. */
async function legacyRoleIndexState(tx: Transaction): Promise<'absent'|'known_legacy'|'ineligible'> {
  const known=DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index;
  const rows=(await tx.query<{table:string;definition:string;valid:boolean;ready:boolean;immediate:boolean;constraint:string}>(`
    select table_class.relname as "table",pg_get_indexdef(index_class.oid) as definition,
      index_row.indisvalid as valid,index_row.indisready as ready,index_row.indimmediate as immediate,
      coalesce(constraint_row.contype::text,'') as constraint
    from pg_index index_row join pg_class index_class on index_class.oid=index_row.indexrelid
    join pg_class table_class on table_class.oid=index_row.indrelid
    join pg_namespace namespace on namespace.oid=index_class.relnamespace
    left join pg_constraint constraint_row on constraint_row.conindid=index_class.oid and constraint_row.conrelid=table_class.oid
    where namespace.nspname='public' and index_class.relname='uq_role_master_name'`)).rows;
  if(!rows.length)return 'absent';
  if(rows.length!==1)return 'ineligible';
  const actual=rows[0];
  if(actual.table!==known.table||actual.definition!==known.definition||!actual.valid||!actual.ready||!actual.immediate||actual.constraint!=='')return 'ineligible';
  return 'known_legacy';
}
async function normalizeLegacyRoleIndex(tx: Transaction,contract: DemoStructuralContract,current: number,recorded: IdentityRow[],finalValidation: boolean): Promise<boolean> {
  if(finalValidation||recorded.length||current<DEMO_SCHEMA_LINEAGE.legacyRoleRepair.absentSinceVersion)return false;
  const expected=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===current);
  if(!expected||await legacyRoleIndexState(tx)!=='known_legacy')return false;
  const known=DEMO_SCHEMA_LINEAGE.legacyRoleRepair.index;
  const normalized={...contract,indexes:contract.indexes.filter(index=>index.name!==known.name)};
  const hash=await demoStructuralHash(normalized);
  const collided=current===DEMO_SCHEMA_LINEAGE.hrRepair.toVersion&&(hash===DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===DEMO_SCHEMA_LINEAGE.hrRepair.fromVersion)!.structuralHash||hash===DEMO_SCHEMA_LINEAGE.historicalCompanyProfile.structuralHash);
  if(hash!==expected.structuralHash&&!collided)return false;
  try {await tx.exec('drop index "public"."uq_role_master_name"');}
  catch {throw lineageError('demo_schema_repair_failed','REPAIR DEMO LEGACY ROLE INDEX');}
  return true;
}

/** Static Demo only. Recognize canonical metadata before any DDL; never infer owner lineage from a numeric marker. */
export async function ensureDemoMigrationIdentity(client: PGlite, finalValidation=false): Promise<{ repaired: boolean; version: number }> {
  return client.transaction(tx=>ensureDemoMigrationIdentityWithin(tx,finalValidation));
}

async function ensureDemoMigrationIdentityWithin(tx: Transaction,finalValidation: boolean): Promise<{repaired:boolean;version:number}> {
    const current=await marker(tx);
    if(!Number.isInteger(current)||current<0||current>latest.version)throw lineageError('demo_schema_lineage_unknown');
    const recorded=await recordedIdentities(tx);
    let contract=await readDemoStructuralContract(tx,DEMO_SCHEMA_LINEAGE.ownedTables,DEMO_SCHEMA_LINEAGE.ownedFunctions);
    const roleRepaired=await normalizeLegacyRoleIndex(tx,contract,current,recorded,finalValidation);
    if(roleRepaired)contract=await readDemoStructuralContract(tx,DEMO_SCHEMA_LINEAGE.ownedTables,DEMO_SCHEMA_LINEAGE.ownedFunctions);
    const structuralHash=await demoStructuralHash(contract);
    const unknown=async()=>lineageError('demo_schema_lineage_unknown','VALIDATE DEMO SCHEMA LINEAGE',await lineageEvidence(tx,contract,current,structuralHash,recorded));
    const expected=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===current);
    const actualIsLatest=structuralHash===latest.structuralHash;
    const hrPrior=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===DEMO_SCHEMA_LINEAGE.hrRepair.fromVersion)!;
    const hrTarget=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===DEMO_SCHEMA_LINEAGE.hrRepair.toVersion)!;
    const collided=current===hrTarget.version&&structuralHash===hrPrior.structuralHash;
    const profile=DEMO_SCHEMA_LINEAGE.historicalCompanyProfile;
    const profileTarget=DEMO_SCHEMA_LINEAGE.identities.find(identity=>identity.version===profile.targetVersion)!;
    const historicalProfile=current===profile.marker&&structuralHash===profile.structuralHash;
    // d29 deliberately ignored an unrelated Profile extension while recognizing
    // canonical HR118. Main119 now owns that exact historical table; its full
    // canonical119 contract plus the old118 marker/identity is a known source path.
    const advancedProfile=current===profile.marker&&structuralHash===profileTarget.structuralHash&&recorded.every(row=>Number(row.version)===hrTarget.version);
    if(recorded.some(row=>Number(row.version)>current))throw lineageError('demo_schema_lineage_mismatch','VALIDATE DEMO MIGRATION IDENTITY');
    if(collided&&recorded.some(row=>Number(row.version)>=hrTarget.version))throw lineageError('demo_schema_lineage_mismatch','VALIDATE DEMO MIGRATION IDENTITY');
    if(historicalProfile&&recorded.length)throw lineageError('demo_schema_lineage_mismatch','VALIDATE DEMO MIGRATION IDENTITY');
    if(finalValidation){
      if(current!==latest.version||!actualIsLatest)throw await unknown();
      await validateHrIndexes(tx);
      await recordIdentity(tx,latest);
      return {repaired:roleRepaired,version:current};
    }
    if(current===latest.version&&actualIsLatest){
      await validateHrIndexes(tx);
      await recordIdentity(tx,latest);
      return {repaired:roleRepaired,version:current};
    }
    if(historicalProfile||advancedProfile){
      // No owner rows are read or rewritten. Execute only the evidenced missing
      // HR DDL and canonical idempotent Profile119 section, then validate before
      // atomically advancing marker/identities. A failure restores everything.
      try{
        if(historicalProfile){
          if((await hrIndexes(tx)).length)throw await unknown();
          await tx.exec(DEMO_SCHEMA_LINEAGE.hrRepair.sql);
        }
        await tx.exec(profile.sql);
      }catch(error){
        if(error&&typeof error==='object'&&'code' in error&&error.code==='demo_schema_lineage_unknown')throw error;
        throw lineageError('demo_schema_repair_failed','REPAIR DEMO HISTORICAL COMPANY PROFILE');
      }
      if(await demoStructuralHash(await readDemoStructuralContract(tx,DEMO_SCHEMA_LINEAGE.ownedTables,DEMO_SCHEMA_LINEAGE.ownedFunctions))!==profileTarget.structuralHash)throw lineageError('demo_schema_repair_failed','REPAIR DEMO HISTORICAL COMPANY PROFILE');
      await validateHrIndexes(tx);
      await tx.query('insert into "_erp_demo_migration"(version) values($1) on conflict(version) do nothing',[profile.targetVersion]);
      await recordIdentity(tx,hrTarget);
      await recordIdentity(tx,profileTarget);
      return {repaired:true,version:profile.targetVersion};
    }
    if(collided){
      // Only the exact source-derived117 contract can repair a legacy bare118.
      // All canonical column/constraint metadata must match; partial/unknown drift is rejected.
      // Names in a preserved extension must not make IF NOT EXISTS skip HR indexes.
      if((await hrIndexes(tx)).length)throw await unknown();
      try { await tx.exec(DEMO_SCHEMA_LINEAGE.hrRepair.sql); }
      catch { throw lineageError('demo_schema_repair_failed','REPAIR DEMO HR ORGANIZATION'); }
      if(await demoStructuralHash(await readDemoStructuralContract(tx,DEMO_SCHEMA_LINEAGE.ownedTables,DEMO_SCHEMA_LINEAGE.ownedFunctions))!==hrTarget.structuralHash){
        throw lineageError('demo_schema_repair_failed','REPAIR DEMO HR ORGANIZATION');
      }
      await validateHrIndexes(tx);
      await recordIdentity(tx,hrTarget);
      return {repaired:true,version:hrTarget.version};
    }
    if(!expected||structuralHash!==expected.structuralHash)throw await unknown();
    // A recognized older prefix follows the existing ordered compatibility runner.
    // Record nothing until its complete current structural contract is verified.
    return {repaired:roleRepaired,version:current};
}

/** Precheck, ordered DDL/data upgrades, marker and final identity commit together. */
export async function upgradeDemoSchema(client: PGlite, upgrade: (tx: Transaction)=>Promise<unknown>): Promise<void> {
  await client.transaction(async tx=>{
    await ensureDemoMigrationIdentityWithin(tx,false);
    await upgrade(tx);
    await ensureDemoMigrationIdentityWithin(tx,true);
  });
}

/** An existing unseeded/partial/future database is never silently bootstrapped. */
export async function preflightDemoBootstrap(client: Pick<PGlite | Transaction,'query'>): Promise<void> {
  const tables=(await client.query<{name:string}>("select tablename as name from pg_tables where schemaname='public'")).rows.map(row=>row.name);
  if(!tables.length)return;
  if(tables.includes('master')&&(await client.query<{n:number}>('select count(*)::int as n from master')).rows[0].n>0)return;
  throw lineageError('demo_schema_lineage_unknown');
}

/** A new local database is seeded atomically and committed only after identity validation. */
export async function initializeDemoDatabase(client: PGlite, seed: (tx: Transaction)=>Promise<unknown>): Promise<void> {
  await client.transaction(async tx=>{
    await preflightDemoBootstrap(tx);
    await seed(tx);
    await ensureDemoMigrationIdentityWithin(tx,true);
  });
}
