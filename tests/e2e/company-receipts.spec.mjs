#!/usr/bin/env node
/* TASK-179 Company Receipts register contract: permission-visible route,
   bounded cursor pagination, required desktop columns and mobile cards. */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR=path.join(ROOT,'web');
const PORT=process.env.COMPANY_RECEIPTS_E2E_PORT||'4318';
const BASE_URL=`http://localhost:${PORT}`;
const TIMEOUT=60000;

function assert(condition,message){if(!condition) throw new Error(message);}
async function waitForServer(){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    try{if((await fetch(BASE_URL)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`${BASE_URL} did not respond.`);
}
async function main(){
  if(!existsSync(path.join(WEB_DIR,'dist','index.html'))){
    throw new Error('web/dist/index.html not found. Run npm run build:demo first.');
  }
  const preview=spawn(path.join(WEB_DIR,'node_modules','.bin','vite'),
    ['preview','--port',PORT,'--strictPort'],{cwd:WEB_DIR,stdio:['ignore','pipe','pipe']});
  const browserErrors=[];
  let browser;
  let context;
  try{
    await waitForServer();
    browser=await chromium.launch({headless:true});
    context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage();
    page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text());});
    page.on('pageerror',error=>browserErrors.push(error.message));
    await page.addInitScript(()=>{
      localStorage.setItem('aria-setup-wizard-complete','1');
      localStorage.setItem('aria-demo-auth',JSON.stringify({
        signedIn:true,email:'admin@acme.co',at:new Date(0).toISOString(),
      }));
    });
    await page.goto(`${BASE_URL}/?company-receipts-e2e=${Date.now()}#dashboard`,{
      waitUntil:'domcontentloaded',timeout:30000,
    });
    await page.waitForFunction(()=>window.ErpSystemData&&window.navigate,{timeout:TIMEOUT});
    await page.waitForFunction(()=>typeof DB!=='undefined'&&DB.user&&Array.isArray(DB.user.permissionKeys),
      null,{timeout:TIMEOUT});
    await page.evaluate(async()=>{
      if(typeof setLang==='function') setLang('en');
      DB.user.permissionKeys=Array.from(new Set([
        ...DB.user.permissionKeys,'finance.read','employee.self.read',
        'expenses.company_receipts.read_company',
      ]));
      if(DB.erpSystem) DB.erpSystem.selfServiceOnly=false;
      const makeRow=id=>({
        id,transactionDate:'2026-08-11',merchant:`Merchant ${id}`,
        receiptNumber:`R-${id}`,category:'Travel',amount:'12.3400',currency:'SGD',
        uploaderUserId:1,uploaderName:'Finance User',status:'ready',version:1,
        createdAt:'2026-08-11T08:00:00.000Z',updatedAt:'2026-08-11T08:00:00.000Z',
      });
      ErpSystemData.companyReceipts=async query=>query&&query.afterId
        ?{data:[makeRow(1)],meta:{scope:'company',limit:25,nextCursor:null}}
        :{data:Array.from({length:25},(_,index)=>makeRow(50-index)),
          meta:{scope:'company',limit:25,nextCursor:26}};
      await navigate('company-receipts');
    });
    const register=page.locator('[data-company-receipt-register="canonical"]');
    try{await register.waitFor({timeout:TIMEOUT});}
    catch(error){
      throw new Error(`${error.message}\nScreen: ${await page.locator('#viewRoot').innerText()}\nBrowser: ${browserErrors.join(' | ')}`);
    }
    const labels=await page.locator('.dt-head .dt-c').allTextContents();
    assert(JSON.stringify(labels)===JSON.stringify([
      'Date','Merchant','Receipt no.','Category','Amount','Currency','Uploader','Status',
    ]),`unexpected desktop columns: ${labels.join(', ')}`);
    assert(await page.locator('.dt-body .dt-r').count()===25,'first page must contain 25 rows');
    await page.locator('[data-company-receipts-more]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.dt-body .dt-r').length===26);
    assert(await page.locator('[data-company-receipts-more]').count()===0,
      'next-page action must disappear at the end of the cursor');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),
      'desktop page overflowed horizontally');

    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>navigate('company-receipts'));
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    assert(await page.locator('.dt-body .dt-r').count()===25,'mobile first page must remain bounded');
    assert(await page.locator('.dt-body .dt-r').first().locator('.dt-c[data-label]').count()===8,
      'mobile receipt card must expose all eight labelled facts');
    assert(await page.locator('.dt-head').evaluate(node=>getComputedStyle(node).display)==='none',
      'mobile register must render cards instead of a visible grid header');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),
      'mobile page overflowed horizontally');
    assert(browserErrors.length===0,`browser errors: ${browserErrors.join(' | ')}`);
    console.log('PASS Company Receipts E2E: company scope, cursor pagination, desktop columns and mobile cards');
  }finally{
    await context?.close();
    await browser?.close();
    preview.kill();
  }
}
main().catch(error=>{console.error(`FAIL Company Receipts E2E: ${error.stack||error.message}`);process.exitCode=1;});
