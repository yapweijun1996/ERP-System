import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4192','--strictPort'],{cwd:process.cwd()+'/web',stdio:'ignore'});
const baseUrl='http://127.0.0.1:4192';
for(let attempt=0;attempt<100;attempt++){try{if((await fetch(baseUrl)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.addInitScript(()=>{localStorage.setItem('aria-setup-wizard-complete','1');localStorage.setItem('aria-demo-auth',JSON.stringify({signedIn:true,email:'admin@acme.co',at:new Date(0).toISOString()}));});
  await page.goto(baseUrl+'/#hr-directory',{waitUntil:'domcontentloaded'});
  await page.locator('[data-hr-organization]').waitFor({timeout:90000});
  await page.locator('[data-hr-organization]').click();
  await page.locator('[data-org-new="business_unit"]').waitFor({timeout:60000});
  await page.locator('[data-org-new="business_unit"]').click();
  await page.locator('[data-org-editor] [name=code]').fill('TEST-BU');
  await page.locator('[data-org-editor] [name=name]').fill('Fictional BU');
  await page.locator('[data-org-editor] [type=submit]').click();
  await page.locator('[data-org-new="position"]').waitFor({timeout:60000});
  await page.locator('[data-org-new="position"]').click();
  await page.locator('[data-org-editor] [name=code]').fill('TEST-POS');
  await page.locator('[data-org-editor] [name=name]').fill('Fictional Position');
  await page.locator('[data-org-editor] [type=submit]').click();
  await page.locator('[data-org-assign]').waitFor({timeout:60000});
  const result=await page.evaluate(async()=>{const db=ErpSystemData.db;return{unit:(await db.query("select id from hr_business_unit where code='TEST-BU'")).rows[0].id,position:(await db.query("select id from hr_position where code='TEST-POS'")).rows[0].id,staff:(await db.query("select id from employee where company_fn='C-SG' and is_active=true order by id limit 1")).rows[0].id};});
  await page.locator('[data-org-assign]').click();
  await page.locator('[data-org-assignment] [name=employee]').selectOption(String(result.staff));
  await page.locator('[data-org-assignment] [name=unit]').selectOption(String(result.unit));
  await page.locator('[data-org-assignment] [name=position]').selectOption(String(result.position));
  await page.locator('[data-org-assignment] [name=reason]').fill('Explicit fictional assignment for browser QA');
  await page.locator('[data-org-assignment] [type=submit]').click();
  await page.locator('[data-org-assign]').waitFor({timeout:60000});
  const persisted=await page.evaluate(async id=>(await ErpSystemData.db.query('select business_unit_id,position_id,organization_version from employee where id=$1',[id])).rows[0],result.staff);
  assert.equal(Number(persisted.business_unit_id),Number(result.unit));assert.equal(Number(persisted.position_id),Number(result.position));assert.equal(Number(persisted.organization_version),1);
  await page.locator('[data-org-close]').click();
  const layouts=[];
  for(const width of [1280,768,375]){
    await page.setViewportSize({width,height:900});
    for(const lang of ['en','zh','ms','ja','vi']){
      await page.locator('#langBtn').click();await page.locator('#langMenu [data-lang="'+lang+'"]').click();
      await page.waitForFunction(code=>getLang()===code,lang);
      await page.locator('[data-hr-organization]').waitFor({timeout:60000});await page.locator('[data-hr-organization]').click();
      await page.locator('[data-org-assign]').waitFor({timeout:60000});
      const state=await page.evaluate(()=>{const dialog=document.querySelector('.hr-organization-dialog');return{width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,title:dialog.querySelector('h2').textContent,expected:t('hr.org.title'),inside:dialog.contains(document.activeElement),dialogScroll:dialog.scrollWidth,dialogWidth:dialog.clientWidth};});
      assert.equal(state.title,state.expected);assert(!state.title.startsWith('hr.org.'));
      assert(state.scroll<=state.width);assert(state.dialogScroll<=state.dialogWidth+1);assert(state.inside);
      if(lang==='en')await page.screenshot({path:'docs/evidence/TASK-256-organization-'+width+'.png'});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.hr-organization-dialog').count(),0);
      assert(await page.locator('[data-hr-organization]').evaluate(button=>button===document.activeElement));
      layouts.push({width,lang});
    }
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,persisted,layouts,errors}));
  if(process.env.ERP_HR_REGRESSION==='1') {
    for(const suite of ['staff-directory-mvp','leave-overlap-mvp']) {
      execFileSync(process.execPath,['tests/e2e/'+suite+'.spec.mjs'],{env:{...process.env,ERP_E2E_BASE_URL:baseUrl},stdio:'inherit',timeout:240000});
    }
  }
}catch(error){console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,4000)}));await page.screenshot({path:'docs/evidence/TASK-256-ui-failure.png'});throw error;}finally{await browser.close();preview.kill('SIGTERM');}
