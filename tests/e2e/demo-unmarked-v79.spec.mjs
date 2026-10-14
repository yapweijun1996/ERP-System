import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { chromium, webkit } from 'playwright';

const root=fileURLToPath(new URL('../../',import.meta.url));
const port=process.env.DEMO_UNMARKED_V79_PORT||'4339';
const url=process.env.DEMO_UNMARKED_V79_URL||`http://127.0.0.1:${port}/`;
const engine=process.env.DEMO_STARTUP_ENGINE==='webkit'?webkit:chromium;
const executable=engine===webkit?process.env.DEMO_WEBKIT_EXECUTABLE:process.env.DEMO_CHROMIUM_EXECUTABLE;
const canonical=readFileSync(root+'web/public/db/erp-system-schema.sql','utf8');
const boundary=canonical.indexOf('-- 0080_');
assert(boundary>0,'Canonical pre-0080 boundary must exist');
const lineage=JSON.parse(readFileSync(root+'src/demo/schemaLineage.generated.ts','utf8').split('export const DEMO_SCHEMA_LINEAGE = ')[1].split(' as const;')[0]);
const latest=lineage.identities.at(-1);
assert.equal(latest.version,JSON.parse(readFileSync(root+'drizzle/meta/_journal.json','utf8')).entries.at(-1).idx);
const prefixSql=canonical.slice(0,boundary);
const prefixTables=await (async()=>{const probe=new PGlite();try{await probe.exec(prefixSql);return (await probe.query("select tablename from pg_tables where schemaname='public' order by 1")).rows.map(row=>row.tablename);}finally{await probe.close();}})();
// A retained Demo is a seeded Demo: copy a freshly seeded Demo's rows into the exact pre-0080 schema.
// Tables/columns introduced later do not exist there, so they are ignored by json_populate_recordset.
async function retainedDump(seeded){
  const prior=new PGlite();
  try{
    await prior.exec(prefixSql);
    await prior.exec("set session_replication_role=replica");
    for(const [table,rows] of Object.entries(seeded))if(rows.length){
      const columns=(await prior.query("select attname from pg_attribute where attrelid=format('%I.%I','public',$1::text)::regclass and attnum>0 and not attisdropped and attgenerated=''",[table])).rows.map(row=>`"${row.attname}"`).join(',');
      await prior.query(`insert into "${table}"(${columns}) overriding system value select ${columns} from json_populate_recordset(null::"${table}",$1::json)`,[JSON.stringify(rows)]);
    }
    await prior.exec("set session_replication_role=origin");
    assert.deepEqual((await prior.query("select tablename from pg_tables where schemaname='public' and tablename in ('_erp_demo_migration','_erp_demo_schema_identity')")).rows,[]);
    const preserved=(await prior.query("select company_fn,name from company order by company_fn")).rows;
    assert(preserved.length>0,'Retained fixture must contain seeded companies');
    return {dump:Buffer.from(await (await prior.dumpDataDir()).arrayBuffer()).toString('base64'),preserved};
  }finally{await prior.close();}
}

const preview=process.env.DEMO_UNMARKED_V79_URL?null:spawn(process.execPath,[root+'web/node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',port,'--strictPort'],{cwd:root+'web',stdio:'ignore'});
let browser;
async function ready(page){
  try{await page.waitForFunction(()=>window.ErpSystemData?.databaseReady===true,null,{timeout:120000});}
  catch(error){
    const diagnostic=await page.evaluate(()=>window.ErpDemoDiagnostics?JSON.stringify(window.ErpDemoDiagnostics.snapshot()):'no diagnostics').catch(()=>'diagnostics unavailable');
    throw new Error('Demo database did not become ready: '+diagnostic,{cause:error});
  }
}
async function preservation(page){return page.evaluate(async()=>({
  masters:(await ErpSystemData.db.query("select company_fn,name from company order by company_fn")).rows,
  sentinel:localStorage.getItem('unmarked-v79-preservation-sentinel'),
}));}
try{
  browser=await engine.launch({headless:true,...(executable?{executablePath:executable}:{})});
  let serving=false;
  for(let attempt=0;attempt<100;attempt++){
    try{if((await fetch(url)).ok){serving=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert(serving,'Demo preview must become available');
  for(const viewport of [{width:375,height:812},undefined]){
    const context=await browser.newContext({...(viewport?{viewport}:{}),serviceWorkers:'allow'});
    try{
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await ready(page);
      const seeded=await page.evaluate(async tables=>{const out={};for(const table of tables)out[table]=(await ErpSystemData.db.query(`select * from "${table}"`)).rows;return out;},prefixTables);
      const {dump,preserved}=await retainedDump(seeded);
      // No existing E2E node-dump injection helper was found. This uses the
      // installed PGlite dump/load API, not a patched startup or schema downgrade.
      // Browser import/persistence is UNVERIFIED until this spec is executed.
      await page.evaluate(async encoded=>{
        const current=ErpSystemData.db;
        const Client=current.constructor;
        await current.close();
        const databases=(await indexedDB.databases()).filter(database=>database.name?.includes('erp-system-demo'));
        if(!databases.length)throw new Error('Demo IndexedDB storage not found');
        for(const database of databases)await new Promise((resolve,reject)=>{
          const request=indexedDB.deleteDatabase(database.name);
          request.onsuccess=()=>resolve();
          request.onerror=()=>reject(request.error);
          request.onblocked=()=>reject(new Error('Demo IndexedDB replacement blocked'));
        });
        const bytes=Uint8Array.from(atob(encoded),character=>character.charCodeAt(0));
        const retained=new Client('idb://erp-system-demo',{loadDataDir:new Blob([bytes])});
        try{
          await retained.waitReady;
          const metadata=await retained.query("select tablename from pg_tables where schemaname='public' and tablename in ('_erp_demo_migration','_erp_demo_schema_identity')");
          if(metadata.rows.length)throw new Error('Retained fixture must be unmarked');
          // Flush the imported filesystem before the normal app reopens it.
          await retained.exec('checkpoint');
        }finally{await retained.close();}
        localStorage.setItem('unmarked-v79-preservation-sentinel','fictional retained sentinel');
      },dump);
      const before={masters:preserved,sentinel:'fictional retained sentinel'};
      await page.reload({waitUntil:'domcontentloaded'});
      await ready(page);
      assert.deepEqual(await preservation(page),before);
      const upgraded=await page.evaluate(async()=>({
        ready:ErpSystemData.databaseReady,
        marker:(await ErpSystemData.db.query('select max(version)::int as version from "_erp_demo_migration"')).rows[0].version,
        identity:(await ErpSystemData.db.query('select version,tag,sql_hash from "_erp_demo_schema_identity" order by version desc limit 1')).rows[0],
      }));
      assert.equal(upgraded.ready,true);
      assert.equal(upgraded.marker,latest.version);
      assert.deepEqual(upgraded.identity,{version:latest.version,tag:latest.tag,sql_hash:latest.sqlHash});
      // A second boot proves that the upgraded data and metadata were persisted.
      await page.reload({waitUntil:'domcontentloaded'});
      await ready(page);
      assert.deepEqual(await preservation(page),before);
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({ok:true,scenario:'unmarked-v79',viewport:page.viewportSize(),latest:latest.version,fictionalRowsPreserved:true}));
    }finally{await context.close();}
  }
}finally{await browser?.close();preview?.kill('SIGTERM');}
