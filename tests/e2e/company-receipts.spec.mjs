#!/usr/bin/env node
/* TASK-179/180/182 Company Receipts contract: platform entitlement plus
   permission-visible route, query-side filters, bounded cursor pagination and
   responsive required facts. */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
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
    const mockPdf=await PDFDocument.create();mockPdf.addPage([595,842]);
    const mockPdfBase64=Buffer.from(await mockPdf.save({useObjectStreams:false})).toString('base64');
    await page.evaluate(async mockPdfBase64=>{
      if(typeof setLang==='function') setLang('en');
      DB.user.permissionKeys=Array.from(new Set([
        ...DB.user.permissionKeys,'finance.read','employee.self.read',
        'expenses.company_receipts.read_company','expenses.company_receipts.create',
      ]));
      if(DB.erpSystem) DB.erpSystem.selfServiceOnly=false;
      /* Company Receipts is commercial. This fixture intentionally grants the
         safe effective projection that only the Platform workspace can mutate;
         it does not revive a tenant Module Activation control. */
      DB.erpSystem={...(DB.erpSystem||{}),modules:[
        ...(Array.isArray(DB.erpSystem&&DB.erpSystem.modules)?DB.erpSystem.modules:[])
          .filter(row=>String(row&&row.moduleKey||row&&row.module_key||'')!=='expenses_tax'),
        {moduleKey:'expenses_tax',enabled:true},
      ]};
      await loadModuleControl();
      window.__actualCompanyReceiptAdapter={
        companyReceipts:ErpSystemData.companyReceipts,
        companyReceiptConfirmation:ErpSystemData.companyReceiptConfirmation,
        createCompanyReceipt:ErpSystemData.createCompanyReceipt,
        myReceipts:ErpSystemData.my&&ErpSystemData.my.receipts,
      };
      const makeRow=id=>({
        id,transactionDate:id===50?null:'2026-08-11',merchant:`Merchant ${id}`,
        receiptNumber:`R-${id}`,category:'Travel',amount:'12.3400',currency:'SGD',
        uploaderUserId:1,uploaderName:'Finance User',status:'ready',version:1,
        createdAt:'2026-08-11T08:00:00.000Z',updatedAt:'2026-08-11T08:00:00.000Z',
      });
      window.__receiptQueries=[];window.__receiptCreates=[];
      window.__receiptPackPayloads=[];window.__receiptPackPdfActions=[];
      ErpSystemData.companyReceipts=async query=>{
        window.__receiptQueries.push({...query});
        if(query&&query.search) return {data:[{...makeRow(900),merchant:'Server Search Result'}],meta:{scope:'company',limit:25,nextCursor:null}};
        if(query&&(query.dateFrom||query.dateTo)) return {data:[makeRow(800)],meta:{scope:'company',limit:25,nextCursor:null}};
        return query&&query.afterId
          ?{data:[makeRow(1)],meta:{scope:'company',limit:25,nextCursor:null}}
          :{data:Array.from({length:25},(_,index)=>makeRow(50-index)),meta:{scope:'company',limit:25,nextCursor:26}};
      };
      ErpSystemData.companyReceiptPack=async payload=>{
        window.__receiptPackPayloads.push({...payload});
        return {data:{pack:{id:77,filters:{search:payload.search||'',dateFrom:payload.dateFrom,dateTo:payload.dateTo},
          rows:[makeRow(800)],totals:[{currency:'SGD',amount:'12.3400',receiptCount:1}],rowCount:1,documentCount:1,
          sourceSha256:'a'.repeat(64),createdAt:'2026-08-11T08:00:00.000Z'}},meta:{immutableSnapshot:true}};
      };
      ErpSystemData.companyReceiptPackPdf=async(id,action)=>{
        window.__receiptPackPdfActions.push({id,action});
        const raw=atob(mockPdfBase64),bytes=new Uint8Array(raw.length);
        for(let index=0;index<raw.length;index+=1)bytes[index]=raw.charCodeAt(index);
        return {data:{content:bytes,mimeType:'application/pdf'},meta:{immutableSnapshot:true}};
      };
      ErpSystemData.my={...(ErpSystemData.my||{}),receipts:async()=>({data:[{
        id:601,documentVersionId:701,originalFileName:'confirmed-evidence.jpg',
      }]})};
      ErpSystemData.companyReceiptConfirmation=async documentVersionId=>({data:{
        evidence:{documentId:601,documentVersionId,originalFileName:'confirmed-evidence.jpg',
          scanStatus:'clean',recordStatus:'draft',current:true},
        extraction:{status:'succeeded',candidates:[]},
        suggestedMetadata:{transactionDate:'2026-08-11',merchant:'Confirmed Merchant',
          receiptNumber:'CONF-701',amount:'28.5000',currency:'SGD'},
        manualConfirmationAllowed:true,provenanceImmutable:true,
      }});
      ErpSystemData.createCompanyReceipt=async payload=>{
        window.__receiptCreates.push({...payload});
        return {data:{id:702,...payload,status:'ready',version:1},meta:{scope:'uploader'}};
      };
      window.open=()=>({});
      await navigate('company-receipts');
    },mockPdfBase64);
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
    assert(await page.locator('[data-missing-date-route]').count()===1,
      'undated receipts must remain visible with an explicit correction action');
    await page.locator('[data-company-receipt-confirm]').click();
    await page.locator('[data-company-receipt-evidence="701"]').click();
    await page.locator('[data-company-receipt-confirm-form]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-receipt-confirm-purpose]').fill('Client-site transport');
    await page.locator('[data-receipt-confirm-save]').click();
    await page.waitForFunction(()=>window.__receiptCreates.length===1,{timeout:TIMEOUT});
    assert(await page.evaluate(()=>window.__receiptCreates[0]).then(payload=>(
      payload.documentId===601&&payload.documentVersionId===701
      &&payload.merchant==='Confirmed Merchant'&&payload.amount==='28.5000'
      &&payload.currency==='SGD'&&payload.businessPurpose==='Client-site transport'
    )), 'receipt confirmation must preserve evidence IDs and submit user-confirmed metadata');
    await page.locator('[data-company-receipts-more]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.dt-body .dt-r').length===26);
    assert(await page.locator('[data-company-receipts-more]').count()===0,
      'next-page action must disappear at the end of the cursor');
    await page.locator('[data-receipt-search]').fill('server needle');
    await page.locator('[data-company-receipt-filters] button.primary').click();
    await page.waitForFunction(()=>document.querySelectorAll('.dt-body .dt-r').length===1);
    assert((await page.locator('.dt-body .dt-r').first().innerText()).includes('Server Search Result'),
      'search must render the server result rather than filter the loaded page');
    assert(await page.evaluate(()=>window.__receiptQueries.at(-1).search)==='server needle',
      'search must be sent to the adapter');
    await page.locator('[data-receipt-preset]').selectOption('custom');
    await page.locator('[data-receipt-from]').fill('2026-08-11');
    await page.locator('[data-receipt-to]').fill('2026-08-11');
    await page.locator('[data-company-receipt-filters] button.primary').click();
    await page.waitForFunction(()=>window.__receiptQueries.at(-1)?.dateFrom==='2026-08-11');
    assert(await page.evaluate(()=>window.__receiptQueries.at(-1).dateTo)==='2026-08-11',
      'same-day inclusive range must be sent query-side');
    await page.locator('[data-receipt-pack-preview]').click();
    await page.waitForFunction(()=>window.__receiptPackPdfActions.at(-1)?.action==='view');
    assert(await page.locator('.company-receipt-pack-frame iframe').count()===1,
      'Receipt Pack preview must use the generated PDF without application chrome');
    assert(await page.evaluate(()=>window.__receiptPackPayloads.at(-1).dateFrom)==='2026-08-11',
      'Receipt Pack must use the complete active date selection');
    await page.locator('#modalEl .modal-foot button').click();
    await page.locator('[data-receipt-pack-pdf]').click();
    await page.waitForFunction(()=>window.__receiptPackPdfActions.at(-1)?.action==='download');
    await page.locator('[data-receipt-pack-print]').click();
    await page.waitForFunction(()=>window.__receiptPackPdfActions.at(-1)?.action==='print');
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
    const actualEvidence=await page.evaluate(async()=>{
      const actual=window.__actualCompanyReceiptAdapter;
      ErpSystemData.companyReceipts=actual.companyReceipts;
      ErpSystemData.companyReceiptConfirmation=actual.companyReceiptConfirmation;
      ErpSystemData.createCompanyReceipt=actual.createCompanyReceipt;
      ErpSystemData.my.receipts=actual.myReceipts;
      await ErpSystemData.switchUser('viewer@acme.co');
      const db=ErpSystemData.db;
      await db.query(`insert into role_permission (master_fn,role_id,permission_key,allowed)
        select r.master_fn,r.role_id,required.permission_key,true
        from app_user u
        join user_company_role ucr on ucr.user_id=u.user_id and ucr.company_fn='C-SG'
        join role r on r.role_id=ucr.role_id
        cross join (values
          ('expenses.company_receipts.create'),('expenses.company_receipts.read_own'),
          ('expenses.company_receipts.edit'),('expenses.company_receipts.void')
        ) as required(permission_key)
        where u.master_fn='M1' and u.email='viewer@acme.co'
        on conflict (role_id,permission_key) do update set allowed=excluded.allowed`);
      await db.query(`update master_module set enabled=true
        where master_fn='M1' and module_key='expenses_tax'`);
      await db.query(`update company_module set enabled=true
        where master_fn='M1' and company_fn='C-SG' and module_key='expenses_tax'`);
      await ErpSystemData.refresh();
      await loadModuleControl();
      const uploaded=await ErpSystemData.my.uploadReceipt({
        id:'company-receipt-e2e-clean-0001',name:'actual-demo-receipt.jpg',type:'image/jpeg',
        blob:new Blob([new Uint8Array([
          0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,0x02,0x03,
        ])],{type:'image/jpeg'}),autoSubmitAuthorized:false,
      });
      const receipts=await ErpSystemData.my.receipts();
      const evidence=receipts.data.find(row=>row.id===uploaded.data.id);
      if(!evidence) throw new Error('Uploaded Demo receipt evidence was not listed.');
      await db.query(`update document_scan_job
        set status='clean',scanner='browser-e2e',result_code='clean',completed_at=now()
        where master_fn='M1' and company_fn='C-SG' and version_id=$1`,[evidence.documentVersionId]);
      return {documentId:evidence.id,documentVersionId:evidence.documentVersionId};
    });
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>navigate('company-receipts'));
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-company-receipt-confirm]').click();
    await page.locator(`[data-company-receipt-evidence="${actualEvidence.documentVersionId}"]`).click();
    await page.locator('[data-company-receipt-confirm-form]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-receipt-confirm-date]').fill('2026-08-12');
    await page.locator('[data-receipt-confirm-merchant]').fill('Actual Demo Merchant');
    await page.locator('[data-receipt-confirm-amount]').fill('42.5000');
    await page.locator('[data-receipt-confirm-currency]').fill('SGD');
    await page.locator('[data-receipt-confirm-purpose]').fill('Browser-confirmed receipt');
    await page.locator('[data-receipt-confirm-save]').click();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('.dt-body .dt-r'))
      .some(row=>row.textContent.includes('Actual Demo Merchant')),{timeout:TIMEOUT});
    assert(await page.locator('.dt-body').innerText().then(text=>text.includes('Actual Demo Merchant')),
      'Demo adapter must confirm clean captured evidence through the shared Company Receipt command');
    assert(browserErrors.length===0,`browser errors: ${browserErrors.join(' | ')}`);
    console.log('PASS Company Receipts E2E: mock/API-shape confirmation, actual Demo clean-evidence confirmation, query-side filters, immutable PDF preview/download/print, pagination and responsive facts');
  }finally{
    await context?.close();
    await browser?.close();
    preview.kill();
  }
}
main().catch(error=>{console.error(`FAIL Company Receipts E2E: ${error.stack||error.message}`);process.exitCode=1;});
