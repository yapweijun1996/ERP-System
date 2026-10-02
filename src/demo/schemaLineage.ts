import type { PGlite, Transaction } from '@electric-sql/pglite';
import { DEMO_UNIQUE_INDEXES } from './uniqueIndexes.generated';

type MetadataClient = Pick<PGlite | Transaction, 'query'>;
type Column = { table: string; name: string; type: string; collation: string; nullable: boolean; default: string | null; identity: string; generated: string };
type Constraint = { table: string; name: string; type: string; definition: string; deferrable: boolean; deferred: boolean; validated: boolean };
type Index = { table: string; name: string; definition: string; valid: boolean; ready: boolean; immediate: boolean };
type Sequence = { table: string; column: string; start: string; increment: string; min: string; max: string; cache: string; cycle: boolean };
type Trigger = { table: string; name: string; definition: string; enabled: string };
type FunctionDefinition = { signature: string; definition: string };
export type DemoStructuralContract = { tables: string[]; columns: Column[]; constraints: Constraint[]; indexes: Index[]; sequences: Sequence[]; triggers: Trigger[]; functions: FunctionDefinition[] };
export const DEMO_STRUCTURAL_CATEGORIES = ['tables','columns','constraints','indexes','sequences','triggers','functions'] as const;
export type DemoStructuralCategory = typeof DEMO_STRUCTURAL_CATEGORIES[number];

/** Digests and counts only. Definitions/defaults can contain private literals and must never be exported. */
export async function demoStructuralCategoryEvidence(contract: DemoStructuralContract): Promise<Record<DemoStructuralCategory,{hash:string;count:number}>> {
  const entries=await Promise.all(DEMO_STRUCTURAL_CATEGORIES.map(async category=>[
    category,{hash:await demoTextHash(JSON.stringify(contract[category])),count:contract[category].length},
  ] as const));
  return Object.fromEntries(entries) as Record<DemoStructuralCategory,{hash:string;count:number}>;
}

/** Schema metadata only. Never read ERP rows or ordinary index contents. */
export async function readDemoStructuralContract(client: MetadataClient, ownedTables?: readonly string[], ownedFunctions?: readonly string[]): Promise<DemoStructuralContract> {
  const tables = (await client.query<{ name: string }>(
    "select tablename as name from pg_tables where schemaname='public' order by tablename",
  )).rows.map(row => row.name);
  const owned = new Set(ownedTables ?? tables);
  const columns = (await client.query<Column>(`
    select column_row.table_name as "table", column_row.column_name as name,
           format_type(attribute_row.atttypid,attribute_row.atttypmod) as type,
           coalesce(collation_namespace.nspname||'.'||collation_row.collname,'') as collation,
           (column_row.is_nullable='YES') as nullable, column_row.column_default as "default",
           coalesce(column_row.identity_generation,'') as identity, column_row.is_generated as generated
    from information_schema.columns column_row
    join pg_namespace namespace on namespace.nspname=column_row.table_schema
    join pg_class table_class on table_class.relnamespace=namespace.oid and table_class.relname=column_row.table_name
    join pg_attribute attribute_row on attribute_row.attrelid=table_class.oid and attribute_row.attname=column_row.column_name
    left join pg_collation collation_row on collation_row.oid=attribute_row.attcollation
    left join pg_namespace collation_namespace on collation_namespace.oid=collation_row.collnamespace
    where column_row.table_schema='public'
    order by column_row.table_name, column_row.column_name`)).rows;
  const constraints = (await client.query<Constraint>(`
    select table_class.relname as "table", constraint_row.conname as name,
           constraint_row.contype::text as type,
           pg_get_constraintdef(constraint_row.oid) as definition,
           constraint_row.condeferrable as deferrable,
           constraint_row.condeferred as deferred, constraint_row.convalidated as validated
    from pg_constraint constraint_row
    join pg_class table_class on table_class.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=table_class.relnamespace
    where namespace.nspname='public'
    order by table_class.relname, constraint_row.conname`)).rows;
  const indexes=(await client.query<Index>(`
    select table_class.relname as "table",index_class.relname as name,pg_get_indexdef(index_class.oid) as definition,
           index_row.indisvalid as valid,index_row.indisready as ready,index_row.indimmediate as immediate
    from pg_index index_row join pg_class index_class on index_class.oid=index_row.indexrelid
    join pg_class table_class on table_class.oid=index_row.indrelid
    join pg_namespace namespace on namespace.oid=table_class.relnamespace
    where namespace.nspname='public' order by table_class.relname,index_class.relname`)).rows;
  const sequences=(await client.query<Sequence>(`
    select table_class.relname as "table",attribute_row.attname as "column",
           sequence_row.seqstart::text as start,sequence_row.seqincrement::text as increment,
           sequence_row.seqmin::text as min,sequence_row.seqmax::text as max,
           sequence_row.seqcache::text as cache,sequence_row.seqcycle as cycle
    from pg_sequence sequence_row join pg_depend dependency on dependency.objid=sequence_row.seqrelid and dependency.deptype in ('a','i')
    join pg_class table_class on table_class.oid=dependency.refobjid
    join pg_namespace namespace on namespace.oid=table_class.relnamespace
    join pg_attribute attribute_row on attribute_row.attrelid=table_class.oid and attribute_row.attnum=dependency.refobjsubid
    where namespace.nspname='public' order by table_class.relname,attribute_row.attname`)).rows;
  const triggers=(await client.query<Trigger>(`
    select table_class.relname as "table",trigger_row.tgname as name,
           pg_get_triggerdef(trigger_row.oid) as definition,trigger_row.tgenabled::text as enabled
    from pg_trigger trigger_row join pg_class table_class on table_class.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=table_class.relnamespace
    where namespace.nspname='public' and not trigger_row.tgisinternal
    order by table_class.relname,trigger_row.tgname`)).rows;
  const functions=(await client.query<FunctionDefinition>(`
    select function_row.proname||'('||pg_get_function_identity_arguments(function_row.oid)||')' as signature,
           pg_get_functiondef(function_row.oid) as definition
    from pg_proc function_row join pg_namespace namespace on namespace.oid=function_row.pronamespace
    where namespace.nspname='public' and function_row.prokind in ('f','p')
    order by function_row.proname,pg_get_function_identity_arguments(function_row.oid)`)).rows;
  const sourceFunctions=new Set(ownedFunctions??functions.map(row=>row.signature));
  // Only these explicitly validated/repairable startup arbiters are checked separately.
  const startupIndexes=new Set(DEMO_UNIQUE_INDEXES.map(index=>index.name as string));
  return {
    tables: tables.filter(name => owned.has(name)),
    columns: columns.filter(row => owned.has(row.table)),
    constraints: constraints.filter(row => owned.has(row.table)),
    indexes:indexes.filter(row=>owned.has(row.table)&&!startupIndexes.has(row.name)),
    sequences:sequences.filter(row=>owned.has(row.table)),
    triggers:triggers.filter(row=>owned.has(row.table)),
    functions:functions.filter(row=>sourceFunctions.has(row.signature)),
  };
}

export async function demoStructuralHash(contract: DemoStructuralContract): Promise<string> {
  return demoTextHash(JSON.stringify(contract));
}

export async function demoTextHash(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
