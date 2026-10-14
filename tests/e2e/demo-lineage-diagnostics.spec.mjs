import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { chromium, webkit } from 'playwright';

const root=fileURLToPath(new URL('../../',import.meta.url));
const port=process.env.DEMO_LINEAGE_PORT||'4338';
const url=process.env.DEMO_LINEAGE_URL||`http://127.0.0.1:${port}/`;
const engine=process.env.DEMO_STARTUP_ENGINE==='webkit'?webkit:chromium;
const executable=engine===webkit?process.env.DEMO_WEBKIT_EXECUTABLE:process.env.DEMO_CHROMIUM_EXECUTABLE;
const preview=process.env.DEMO_LINEAGE_URL?null:spawn(process.execPath,[root+'web/node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',port,'--strictPort'],{cwd:root+'web',stdio:'ignore'});
const browser=await engine.launch({headless:true,...(executable?{executablePath:executable}:{})});
const context=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'allow'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const canonical=readFileSync(root+'web/public/db/erp-system-schema.sql','utf8');
const latestMigration=JSON.parse(readFileSync(root+'drizzle/meta/_journal.json','utf8')).entries.at(-1);
const lineage=JSON.parse(readFileSync(root+'src/demo/schemaLineage.generated.ts','utf8').split('export const DEMO_SCHEMA_LINEAGE = ')[1].split(' as const;')[0]);
const hrIdentity=lineage.identities.find(identity=>identity.version===118);
const prior=new PGlite();
let priorChecks=[];
try{
  await prior.exec(canonical.slice(0,canonical.indexOf('-- 0118_classy_ronan')));
  priorChecks=(await prior.query(`select relation.relname as table_name,constraint_row.conname as name,pg_get_constraintdef(constraint_row.oid) as definition from pg_constraint constraint_row join pg_class relation on relation.oid=constraint_row.conrelid where constraint_row.conname in ('ck_role_resource_scope_value','ck_user_company_role_scope_value','ck_user_permission_override_scope','ck_user_permission_override_target_type') order by constraint_row.conname`)).rows;
}finally{await prior.close();}
assert.equal(priorChecks.length,4);
mkdirSync(root+'output',{recursive:true});
async function ready(target=page){await target.waitForFunction(()=>window.ErpSystemData?.databaseReady===true,null,{timeout:180000});}
async function preservation(target=page){return target.evaluate(async()=>({
  company:(await ErpSystemData.db.query("select company_fn,name from company order by company_fn")).rows,
  staff:(await ErpSystemData.db.query('select id,employee_no,full_name,department,job_title from employee order by id')).rows,
  roles:(await ErpSystemData.db.query('select role_id,master_fn,company_fn,name,is_superadmin from role order by role_id')).rows,
  profiles:(await ErpSystemData.db.query("select count(*)::int as n from pg_tables where schemaname='public' and tablename='company_profile'")).rows[0].n?(await ErpSystemData.db.query('select master_fn,company_fn,registration_no,tax_no,address_line_1,version from company_profile order by master_fn,company_fn')).rows:[],
  authority:(await ErpSystemData.db.query('select assignment_id,user_id,company_fn,role_id,valid_from,valid_until,revoked_at from user_company_role order by assignment_id')).rows,
  sentinel:localStorage.getItem('lineage-preservation-sentinel'),
}));}
try{
  for(let attempt=0;attempt<100;attempt++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await ready();
  assert.equal(await page.evaluate(()=>localStorage.getItem('aria-demo-auth')),null);
  await page.evaluate(async()=>{
    await ErpSystemData.db.query("update company set name=$1 where master_fn='M1' and company_fn='C-SG'",['Fictional retained lineage Company']);
    await ErpSystemData.db.query("insert into company_profile(master_fn,company_fn,registration_no,tax_no,address_line_1,version) values('M1','C-SG',$1,$2,$3,7) on conflict(master_fn,company_fn) do update set registration_no=excluded.registration_no,tax_no=excluded.tax_no,address_line_1=excluded.address_line_1,version=excluded.version",['FICTIONAL-REG','FICTIONAL-TAX','Fictional preserved profile address']);
    // The modern sample has company-local duplicate role names. An old group-wide
    // index could not have contained them; prepare unique fictional names before
    // capturing the preservation baseline, without changing IDs/grants/authority.
    await ErpSystemData.db.exec("update role set name=name||' fictional legacy fixture '||role_id");
    const owner=(await ErpSystemData.db.query("select user_id from app_user where lower(email)='admin@acme.co' and master_fn='M1'")).rows[0];
    await ErpSystemData.db.query("update user_company_role set revoked_at=current_timestamp where user_id=$1 and company_fn='C-SG'",[owner.user_id]);
    localStorage.setItem('lineage-preservation-sentinel','fictional retained sentinel');
  });
  const before=await preservation();
  // Reproduce the evidenced early-v73 preview shape only in this disposable context.
  await page.evaluate(async()=>ErpSystemData.db.exec('drop table "_erp_demo_schema_identity";create unique index uq_role_master_name on role(master_fn,name)'));
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  assert.deepEqual(await preservation(),before);
  assert.deepEqual(await page.evaluate(async()=>(await ErpSystemData.db.query("select indexname from pg_indexes where schemaname='public' and indexname='uq_role_master_name'")).rows),[]);
  // An unrelated extension's same-name index must survive the actual late runner.
  await page.evaluate(async()=>ErpSystemData.db.exec("create table retained_extension(id int primary key,note text);insert into retained_extension values(1,'fictional extension preserved');create unique index uq_role_master_name on retained_extension(id)"));
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  assert.deepEqual(await preservation(),before);
  assert.equal(await page.evaluate(async()=>(await ErpSystemData.db.query("select tablename from pg_indexes where schemaname='public' and indexname='uq_role_master_name'")).rows[0].tablename),'retained_extension');
  // Remove this test-only index so the following legacy-role reconstruction can use its name.
  await page.evaluate(async()=>ErpSystemData.db.exec('drop index uq_role_master_name'));
  // Reproduce the actual d29 source path: full canonical119 metadata with the
  // historical118 marker and the canonical HR118 identity. Profile values remain.
  await page.evaluate(async hr=>{
    const db=ErpSystemData.db;
    await db.exec('delete from "_erp_demo_schema_identity";delete from "_erp_demo_migration" where version>118;insert into "_erp_demo_migration"(version) values(118) on conflict(version) do nothing');
    await db.query('insert into "_erp_demo_schema_identity"(version,tag,sql_hash) values(118,$1,$2)',[hr.tag,hr.sqlHash]);
  },hrIdentity);
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  assert.deepEqual(await preservation(),before);
  // Reconstruct the exact source-backed historical117+CompanyProfile118 metadata
  // in this disposable context, retaining every fictional Profile value/version.
  // Its source identification does not establish a real owner's stored lineage.
  await page.evaluate(async checks=>{
    const db=ErpSystemData.db;
    await db.exec('alter table employee drop column business_unit_id;alter table employee drop column position_id;alter table employee drop column organization_version;drop table hr_business_unit;drop table hr_position;drop table "_erp_demo_schema_identity";delete from "_erp_demo_migration" where version>118;insert into "_erp_demo_migration"(version) values(118) on conflict(version) do nothing;create unique index uq_role_master_name on role(master_fn,name);');
    for(const check of checks)await db.exec('alter table "'+check.table_name+'" drop constraint "'+check.name+'";alter table "'+check.table_name+'" add constraint "'+check.name+'" '+check.definition+';');
  },priorChecks);
  const historicalBefore=await preservation();
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  assert.deepEqual(await preservation(),historicalBefore);
  const repaired=await page.evaluate(async()=>({
    identities:(await ErpSystemData.db.query('select version,tag from "_erp_demo_schema_identity" order by version')).rows,
    hrTables:(await ErpSystemData.db.query("select table_name from information_schema.tables where table_schema='public' and table_name in ('hr_business_unit','hr_position') order by table_name")).rows.map(row=>row.table_name),
    moduleCount:ErpSystemData.setupModuleCatalog().length,
  }));
  assert.deepEqual(repaired.identities,[{version:118,tag:'0118_classy_ronan'},{version:119,tag:'0119_company_profile'}]);
  assert.deepEqual(repaired.hrTables,['hr_business_unit','hr_position']);
  assert(repaired.moduleCount>0);
  const denied=await page.evaluate(async()=>{try{await ErpSystemData.openShowcase();return false;}catch{return localStorage.getItem('aria-demo-auth')===null;}});
  assert.equal(denied,true);
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  assert.deepEqual(await preservation(),historicalBefore);
  // Keep the original bare117/118 regression in a SEPARATE blank context whose
  // Profile table has no records. Never discard the Profile preservation fixture.
  const bareContext=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});
  const barePage=await bareContext.newPage();const bareErrors=[];
  barePage.on('pageerror',error=>bareErrors.push(error.message));
  barePage.on('console',message=>{if(message.type()==='error')bareErrors.push(message.text());});
  await barePage.goto(url,{waitUntil:'domcontentloaded'});await ready(barePage);
  const bareBefore=await preservation(barePage);assert.deepEqual(bareBefore.profiles,[]);
  await barePage.evaluate(async checks=>{
    const db=ErpSystemData.db;
    await db.exec('alter table employee drop column business_unit_id;alter table employee drop column position_id;alter table employee drop column organization_version;drop table hr_business_unit;drop table hr_position;drop table company_profile;drop table "_erp_demo_schema_identity";delete from "_erp_demo_migration" where version>118;insert into "_erp_demo_migration"(version) values(118) on conflict(version) do nothing;');
    for(const check of checks)await db.exec('alter table "'+check.table_name+'" drop constraint "'+check.name+'";alter table "'+check.table_name+'" add constraint "'+check.name+'" '+check.definition+';');
  },priorChecks);
  await barePage.reload({waitUntil:'domcontentloaded'});await ready(barePage);
  assert.deepEqual(await preservation(barePage),bareBefore);assert.deepEqual(bareErrors,[]);
  await bareContext.close();
  // Unrecognized drift remains unchanged and produces visible, safe diagnostics.
  await page.evaluate(async()=>ErpSystemData.db.exec("alter table employee add column unknown_retained_value text default 'fictional private record sentinel'"));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__ERP_DEMO_PROGRESS__?.phase==='failed',null,{timeout:180000});
  for(let step=0;step<4;step++)await page.locator('#wizNext').click();
  assert.equal(await page.locator('#wizNext').isEnabled(),false);
  assert.equal(await page.locator('#wizardShowcase').isEnabled(),false);
  const panel=page.locator('#setupWizardView .demo-startup-diagnostic');
  assert.equal(await panel.isVisible(),true);
  assert.match(await panel.innerText(),/demo_schema_lineage_unknown/);
  assert.match(await panel.innerText(),/Checking database compatibility/);
  assert.match(await panel.innerText(),/VALIDATE DEMO SCHEMA LINEAGE/);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedDiagnostic=text;}}}));
  await panel.getByRole('button',{name:'Copy diagnostic',exact:true}).click();
  const diagnostic=await page.evaluate(()=>JSON.parse(window.copiedDiagnostic));
  assert.deepEqual(Object.keys(diagnostic).sort(),['buildId','code','lineage','mode','phase','ready','stage','statement']);
  assert.equal(diagnostic.code,'demo_schema_lineage_unknown');
  assert.equal(diagnostic.mode,'fallback');
  assert.equal(diagnostic.ready,false);
  assert.equal(diagnostic.lineage.marker,latestMigration.idx);
  assert.equal(diagnostic.lineage.identityCount,repaired.identities.length);
  assert.equal(diagnostic.lineage.legacyRoleIndex,'absent');
  assert.equal(diagnostic.lineage.matchedVersion,null);
  assert.equal(diagnostic.lineage.normalizedMatchedVersion,null);
  assert.match(diagnostic.lineage.structuralHash,/^[a-f0-9]{64}$/);
  assert.deepEqual(diagnostic.lineage.categories.filter(item=>item.hash!==item.expectedHash).map(item=>item.name),['columns']);
  assert(!JSON.stringify(diagnostic).includes('fictional'));
  assert(!JSON.stringify(diagnostic).includes('unknown_retained_value'));
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('fictional clipboard unavailable');}}}));
  await panel.getByRole('button',{name:'Copy diagnostic',exact:true}).click();
  assert.match(await panel.innerText(),/Could not copy/);
  await panel.locator('summary').click();
  assert.equal(await panel.locator('pre').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
  for(const [language,label] of Object.entries({en:'Copy diagnostic',zh:'复制诊断',ms:'Salin diagnostik',ja:'診断をコピー',vi:'Sao chép chẩn đoán'})){
    await page.locator('#wizTopLang').selectOption(language);
    assert.equal(await panel.getByRole('button',{name:label,exact:true}).isVisible(),true);
  }
  await page.locator('#wizTopLang').selectOption('en');
  await page.screenshot({path:root+'output/demo-lineage-diagnostic-'+(engine===webkit?'webkit':'chromium')+'-375.png',fullPage:true});
  await page.setViewportSize({width:942,height:818});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
  await page.screenshot({path:root+'output/demo-lineage-diagnostic-'+(engine===webkit?'webkit':'chromium')+'-desktop.png',fullPage:true});
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),panel.getByRole('button',{name:'Reload to retry',exact:true}).click()]);
  await page.waitForFunction(()=>window.__ERP_DEMO_PROGRESS__?.phase==='failed',null,{timeout:180000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('lineage-preservation-sentinel')),'fictional retained sentinel');
  const retainedAfterFailure=await page.evaluate(async()=>{
    const opened=ErpDemoRuntime.openDatabase('idb://erp-system-demo');
    try{return {company:(await opened.client.query('select company_fn,name from company order by company_fn')).rows,staff:(await opened.client.query('select id,employee_no,full_name,department,job_title from employee order by id')).rows,roles:(await opened.client.query('select role_id,master_fn,company_fn,name,is_superadmin from role order by role_id')).rows,profiles:(await opened.client.query('select master_fn,company_fn,registration_no,tax_no,address_line_1,version from company_profile order by master_fn,company_fn')).rows,authority:(await opened.client.query('select assignment_id,user_id,company_fn,role_id,valid_from,valid_until,revoked_at from user_company_role order by assignment_id')).rows,sentinel:localStorage.getItem('lineage-preservation-sentinel'),unknown:(await opened.client.query('select unknown_retained_value from employee limit 1')).rows[0].unknown_retained_value};}
    finally{await opened.client.close();}
  });
  assert.equal(retainedAfterFailure.unknown,'fictional private record sentinel');
  delete retainedAfterFailure.unknown;
  assert.deepEqual(retainedAfterFailure,historicalBefore);
  assert.deepEqual(errors,[]);
  // A persisted signed-in flag must not hide an immediate or watchdog-late failure.
  for(const late of [false,true]){
    const signed=await browser.newContext({viewport:{width:942,height:818},serviceWorkers:'block'});
    await signed.addInitScript(()=>{localStorage.setItem('aria-setup-wizard-complete','1');localStorage.setItem('aria-demo-auth',JSON.stringify({signedIn:true,email:'admin@acme.co',at:'fictional'}));localStorage.setItem('signed-failure-sentinel','fictional preserved session');});
    const signedPage=await signed.newPage();const signedErrors=[];
    signedPage.on('pageerror',error=>signedErrors.push(error.message));
    if(late){await signed.route('**/db/erp-system-demo-sales-credit.sql*',async route=>{await new Promise(resolve=>setTimeout(resolve,50000));const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('ON CONFLICT (master_fn, company_fn, customer_id)','ON CONFLICT (credit_limit)')});});}
    else{await signed.route('**/db/erp-system-schema.sql*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\n-- fictional mixed-build asset'});});}
    await signedPage.goto(url,{waitUntil:'domcontentloaded'});
    await signedPage.waitForFunction(()=>window.__ERP_DEMO_PROGRESS__?.phase==='failed',null,{timeout:180000});
    await signedPage.locator('#demoFailureView .demo-startup-diagnostic').waitFor({state:'visible',timeout:30000});
    assert.equal(await signedPage.evaluate(()=>document.body.classList.contains('auth-locked')),true);
    const flags=await signedPage.evaluate(()=>({setup:localStorage.getItem('aria-setup-wizard-complete'),session:JSON.parse(localStorage.getItem('aria-demo-auth')),sentinel:localStorage.getItem('signed-failure-sentinel')}));
    assert.equal(flags.setup,'1');assert.equal(flags.session.signedIn,true);assert.equal(flags.sentinel,'fictional preserved session');
    assert.deepEqual(signedErrors,[]);
    await signed.close();
  }
  console.log(JSON.stringify({ok:true,engine:engine===webkit?'webkit':'chromium',realFreshEntry:true,exactLegacyRoleIndexNormalized:true,extensionIndexPreserved:true,sourceBackedHistoricalProfile118Repair:true,knownD29AdvancedProfileRepair:true,profileValuesAndVersionPreserved:true,syntheticKnown117To118Repair:true,repeatedReload:true,recordsAndRevokedAuthorityPreserved:true,unknownLineageFailedClosed:true,visibleSafeDiagnostic:diagnostic,fiveLanguages:true,mobileWidth:375,ownerRootCauseConfirmed:false}));
}catch(error){await page.screenshot({path:root+'output/demo-lineage-failure-'+(engine===webkit?'webkit':'chromium')+'.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();preview?.kill('SIGTERM');}
