import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
const port = process.env.DEMO_SCHEMA_PORT || '4337';
const url = process.env.DEMO_SCHEMA_URL || `http://127.0.0.1:${port}/`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const preview = process.env.DEMO_SCHEMA_URL ? null : spawn(process.execPath, [fileURLToPath(new URL('../../web/node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: root + '/web', stdio: 'ignore' });
const engine = process.env.DEMO_STARTUP_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless:true, ...(process.env.DEMO_WEBKIT_EXECUTABLE ? { executablePath:process.env.DEMO_WEBKIT_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport:{width:942,height:818}, serviceWorkers:'allow' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
async function ready() { await page.waitForFunction(() => ErpSystemData.databaseReady === true, null, {timeout:180000}); }
try {
  for (let attempt=0;attempt<100;attempt++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(resolve=>setTimeout(resolve,200)); }
  // Actual fresh first entry; no preselected setup or authenticated session.
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await ready();
  assert.equal(await page.evaluate(() => localStorage.getItem('aria-demo-auth')), null);
  await page.locator('#wizardShowcase').click();
  await page.locator('#globalSearch').waitFor({timeout:180000});
  const before = await page.evaluate(async () => {
    const db=ErpSystemData.db;
    await db.query("update company set name=$1 where master_fn='M1' and company_fn='C-SG'",['Fictional retained Company']);
    localStorage.setItem('schema-preservation-sentinel','retained');
    const owner=(await db.query("select user_id from app_user where master_fn='M1' and lower(email)='admin@acme.co'")).rows[0];
    // Disposable revoked assignment proves index repair cannot reopen sample access.
    await db.query("update user_company_role set revoked_at=current_timestamp where user_id=$1 and company_fn='C-SG'",[owner.user_id]);
    const authority=(await db.query('select assignment_id,user_id,company_fn,role_id,valid_from,valid_until,revoked_at from user_company_role order by assignment_id')).rows;
    const staff=(await db.query('select id,employee_no,full_name,department,job_title,business_unit_id,position_id,organization_version from employee order by id')).rows;
    await ErpSystemData.logout();
    await db.exec('DROP INDEX uq_account_code; DROP INDEX uq_sales_credit_profile_customer;');
    return {authority,staff};
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await ready();
  const after=await page.evaluate(async()=>({
    name:(await ErpSystemData.db.query("select name from company where master_fn='M1' and company_fn='C-SG'")).rows[0].name,
    sentinel:localStorage.getItem('schema-preservation-sentinel'),
    authority:(await ErpSystemData.db.query('select assignment_id,user_id,company_fn,role_id,valid_from,valid_until,revoked_at from user_company_role order by assignment_id')).rows,
    staff:(await ErpSystemData.db.query('select id,employee_no,full_name,department,job_title,business_unit_id,position_id,organization_version from employee order by id')).rows,
    indexes:(await ErpSystemData.db.query("select indexname from pg_indexes where indexname in ('uq_account_code','uq_sales_credit_profile_customer') order by indexname")).rows.map(row=>row.indexname),
  }));
  assert.equal(after.name,'Fictional retained Company');
  assert.equal(after.sentinel,'retained');
  assert.deepEqual(after.authority,before.authority);
  assert.deepEqual(after.staff,before.staff);
  assert.deepEqual(after.indexes,['uq_account_code','uq_sales_credit_profile_customer']);
  const denied=await page.evaluate(async()=>{try{await ErpSystemData.openShowcase();return false;}catch{return localStorage.getItem('aria-demo-auth')===null;}});
  assert.equal(denied,true);
  // Modules are available after repaired initialization, without entering a session.
  await page.evaluate(()=>{clearSetupWizardFlag();renderSetupWizard();});
  for(let step=0;step<4;step++) await page.locator('#wizNext').click();
  await page.locator('#wizModuleSeg').waitFor({timeout:30000});
  assert.equal(await page.locator('#wizNext').isEnabled(),true);
  assert.deepEqual(errors,[]);
  // A same-name nonunique index is not silently replaced. Keep writes disabled
  // and prevent the screenshot's empty Modules screen from inviting Continue.
  await page.evaluate(async()=>{
    await ErpSystemData.db.exec('DROP INDEX uq_sales_credit_profile_customer; CREATE INDEX uq_sales_credit_profile_customer ON sales_credit_profile(master_fn,company_fn,customer_id);');
    clearSetupWizardFlag();
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__ERP_DEMO_PROGRESS__?.phase==='failed',null,{timeout:180000});
  for(let step=0;step<4;step++) await page.locator('#wizNext').click();
  assert.equal(await page.locator('#wizNext').isEnabled(),false);
  assert.equal(await page.locator('#wizardShowcase').isEnabled(),false);
  const failed=await page.evaluate(()=>({ready:ErpSystemData.databaseReady,mode:ErpSystemData.mode,sentinel:localStorage.getItem('schema-preservation-sentinel'),failure:window.__ERP_DEMO_FAILURE__}));
  assert.equal(failed.ready,false);
  assert.equal(failed.sentinel,'retained');
  assert.equal(failed.failure.stage,'Checking database compatibility');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,engine:process.env.DEMO_STARTUP_ENGINE||'chromium',freshEntry:true,retainedIndexes:after.indexes,retainedCompany:true,retainedStaff:true,revokedAssignmentDenied:true,modulesAvailable:true,mismatchedIndexBlocked:true,failedModulesContinueBlocked:true,errors}));
} finally { await browser.close();preview?.kill('SIGTERM'); }
