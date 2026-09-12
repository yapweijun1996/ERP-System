#!/usr/bin/env node
/*
 * TASK-234/S4 contextual Receipt assistant workspace contract.
 *
 * The adapter fixture is intentionally deterministic and zero-spend. It proves
 * the browser state machine, cited preview, human decision boundary, recovery,
 * tenant-scope guard, locale/theme rendering and desktop/mobile layout. The
 * governed Demo and server execution postconditions are covered by focused
 * adapter/API tests, not replaced by this UI fixture.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

const ROOT=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR=path.join(ROOT,'web');
const DIST_INDEX=path.join(WEB_DIR,'dist','index.html');
const PORT=process.env.RECEIPT_ASSISTANT_E2E_PORT||'4334';
const BASE_URL=`http://localhost:${PORT}`;
const TIMEOUT=60000;
const LANGUAGES=['en','zh','ms','vi','ja'];

function assert(condition,message){if(!condition) throw new Error(message);}

async function waitForServer(){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    try{if((await fetch(BASE_URL)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`${BASE_URL} did not respond.`);
}

async function configureFixture(page){
  const document=await PDFDocument.create();document.addPage();
  const pdfBytes=Array.from(await document.save());
  await page.evaluate(async(pdfBytes)=>{
    setLang('en');
    DB.user.permissionKeys=Array.from(new Set([
      ...(Array.isArray(DB.user.permissionKeys)?DB.user.permissionKeys:[]),
      'expenses.company_receipts.read_company','expenses.company_receipts.create',
    ]));
    DB.erpSystem={...(DB.erpSystem||{}),selfServiceOnly:false,
      scope:{...(DB.erpSystem?.scope||{}),companyFn:'C-SG'},
      modules:[
        ...(Array.isArray(DB.erpSystem?.modules)?DB.erpSystem.modules:[])
          .filter(row=>String(row?.moduleKey||row?.module_key||'')!=='expenses_tax'),
        {moduleKey:'expenses_tax',enabled:true},
      ]};
    await loadModuleControl();
    const row={id:41,transactionDate:'2026-08-12',merchant:'UI Fixture Merchant',receiptNumber:'UI-41',category:'Travel',amount:'42.5000',currency:'SGD',uploaderUserId:1,uploaderName:'Finance User',status:'ready',version:1};
    ErpSystemData.companyReceipts=async()=>({data:[row],meta:{scope:'company',actorUserId:1,limit:25,nextCursor:null,actions:{create:true,edit:false,void:false}}});
    const assistantWaiting=payload=>({data:{
      runId:'ui-fixture-run-1',state:'waiting',stateHistory:['draft','running','waiting'],
      provider:'deterministic-ui-fixture',model:'receipt-ui-fixture-v1',providerCalls:0,retries:0,spentCostMicros:0,authoritativeCompletion:false,
      message:'The exact Receipt Pack contents are ready for your confirmation.',
      sources:[{sourceType:'receipt',sourceId:'company-receipt:41:v1',recordId:41,recordVersion:1,sourceSha256:'b'.repeat(64),artifactSha256:null,asOf:'2026-08-12T00:00:00.000Z'}],
      toolResults:[],preview:{selectionDigest:'ui-selection-digest',visibility:'company',filters:{search:String(payload.search||''),dateFrom:payload.dateFrom,dateTo:payload.dateTo},rows:[{receiptId:41,receiptVersion:1,transactionDate:payload.dateFrom,merchant:'UI Fixture Merchant',receiptNumber:'UI-41',originalFileName:'ui-receipt.jpg'}],totals:[{currency:'SGD',amount:'42.5000',receiptCount:1}],rowCount:1,documentCount:1},
      confirmation:{required:true,available:true,reason:'human_confirmation_required',intentId:501,intentVersion:1,intentKey:'ui-intent-key',packKey:'ui-pack-key',filters:{search:String(payload.search||''),dateFrom:payload.dateFrom,dateTo:payload.dateTo},locale:payload.locale||'en',visibility:'company',selectionDigest:'ui-selection-digest',payloadDigest:'ui-payload-digest',expiresAt:null},
    }});
    window.__receiptAssistantMode='waiting';
    window.__receiptAssistantCalls=[];
    window.__receiptAssistantDecisions=[];
    window.__receiptAssistantExecutions=[];
    const pdfContent=new Uint8Array(pdfBytes);
    window.__receiptAssistantPdfHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pdfContent)),byte=>byte.toString(16).padStart(2,'0')).join('');
    window.__receiptAssistantPdfReads=[];
    window.__receiptAssistantBadPdf=true;
    ErpSystemData.companyReceiptPackPdf=async(id,action)=>{
      window.__receiptAssistantPdfReads.push({id,action});
      return {data:{content:window.__receiptAssistantBadPdf?new Uint8Array([0]):pdfContent}};
    };
    window.__receiptEvidenceBad=true;
    window.__receiptEvidenceReads=[];
    ErpSystemData.companyReceipt=async id=>({data:{id,version:1,documentId:id+59,documentVersionId:id+159,documentVersionNo:2,documentSha256:window.__receiptAssistantPdfHash}});
    ErpSystemData.documentContent=async(id,versionNo)=>{
      window.__receiptEvidenceReads.push({id,versionNo});
      return {data:{content:window.__receiptEvidenceBad?new Uint8Array([0]):pdfContent,contentType:'application/pdf',versionNo:2,sha256:window.__receiptAssistantPdfHash}};
    };
    ErpSystemData.receiptAssistant=async(payload,options={})=>{
      window.__receiptAssistantCalls.push({payload:{...payload}});
      if(window.__receiptAssistantMode==='hang'){
        await new Promise((resolve,reject)=>{
          const abort=()=>{window.__receiptAssistantAbortCount=(window.__receiptAssistantAbortCount||0)+1;const error=new Error('aborted');error.name='AbortError';reject(error);};
          if(options.signal?.aborted) abort();
          else options.signal?.addEventListener('abort',abort,{once:true});
        });
      }
      const response=assistantWaiting(payload);
      response.data.preview.rows=Array.from({length:21},(_,index)=>({
        ...response.data.preview.rows[0],receiptId:41+index,merchant:`UI Fixture Merchant ${index+1}`,
        amount:'42.5000',currency:'SGD',category:'Travel',businessPurpose:`Reviewed purpose ${index+1}`,
        documentId:100+index,documentVersionId:200+index,documentSha256:window.__receiptAssistantPdfHash,
      }));
      response.data.sources=response.data.preview.rows.map(row=>({...response.data.sources[0],sourceId:`company-receipt:${row.receiptId}:v1`,recordId:row.receiptId}));
      response.data.preview.rowCount=21;response.data.preview.documentCount=21;
      response.data.preview.totals=[{currency:'SGD',amount:'892.5000',receiptCount:21}];
      return response;
    };
    ErpSystemData.receiptAssistantDecision=async(decision,payload)=>{
      window.__receiptAssistantDecisions.push({decision,payload:{...payload}});
      return {data:{status:decision==='cancel'?'cancelled':'approved',version:2}};
    };
    ErpSystemData.receiptAssistantExecute=async(payload)=>{
      window.__receiptAssistantExecutions.push({...payload});
      return {data:{state:'succeeded',action:'receipt_pack.create',pack:{id:901,packKey:payload.packKey,filters:{search:payload.search,dateFrom:payload.dateFrom,dateTo:payload.dateTo},rowCount:21,sourceSha256:'c'.repeat(64)},replayed:false,verification:{pack:{id:901},artifact:{contentType:'application/pdf',byteLength:pdfContent.byteLength,artifactSha256:window.__receiptAssistantPdfHash,sourceSha256:'c'.repeat(64),accessPurpose:'assistant_verified_receipt_pack'}}}};
    };
    await navigate('company-receipts');
  },pdfBytes);
  await page.locator('[data-company-receipt-register="canonical"]').waitFor({state:'visible',timeout:TIMEOUT});
}

async function assertNoOverflow(page,label){
  const metrics=await page.evaluate(()=>{
    const modal=document.querySelector('#modalEl');
    const rect=modal?.getBoundingClientRect();
    return {documentWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
      modalWidth:rect?.width||0,modalHeight:rect?.height||0,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,
      theme:document.documentElement.dataset.theme};
  });
  assert(metrics.scrollWidth<=metrics.documentWidth+1,`${label}: page overflows horizontally`);
  if(metrics.modalWidth){
    assert(metrics.modalWidth<=metrics.viewportWidth+1,`${label}: assistant modal exceeds viewport width`);
    assert(metrics.modalHeight<=metrics.viewportHeight+1,`${label}: assistant modal exceeds viewport height`);
  }
  return metrics;
}

async function runViewport(browser,viewport){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},hasTouch:viewport.width<=980,isMobile:viewport.width<=980});
  const page=await context.newPage();
  const browserErrors=[];
  page.on('console',message=>{if(message.type()==='error')browserErrors.push(`[console.error] ${message.text()}`);});
  page.on('pageerror',error=>browserErrors.push(`[pageerror] ${error.message}`));
  try{
    await page.addInitScript(()=>{
      localStorage.setItem('aria-setup-wizard-complete','1');
      localStorage.setItem('aria-lang','en');
      localStorage.setItem('aria-theme','light');
      localStorage.setItem('aria-demo-auth',JSON.stringify({signedIn:true,email:'admin@acme.co',at:new Date(0).toISOString()}));
    });
    await page.goto(`${BASE_URL}/?receipt-assistant-e2e=${viewport.label}-${Date.now()}#dashboard`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.ErpSystemData&&window.navigate,{timeout:TIMEOUT});
    await page.waitForFunction(()=>typeof DB!=='undefined'&&DB.user&&Array.isArray(DB.user.permissionKeys),null,{timeout:TIMEOUT});
    await configureFixture(page);
    const open=page.locator('[data-receipt-assistant-open]');
    await open.click();
    await page.locator('#modalEl.receipt-assistant-modal').waitFor({state:'visible',timeout:TIMEOUT});
    assert(await page.locator('#modalEl').getAttribute('aria-modal')==='true',`${viewport.label}: assistant modal must be modal to assistive technology`);
    assert(await page.locator('[data-receipt-assistant-message]').count()===1,`${viewport.label}: draft input missing`);
    await page.waitForFunction(()=>document.querySelector('#modalEl')?.contains(document.activeElement),null,{timeout:TIMEOUT});
    const activeInside=await page.evaluate(()=>document.querySelector('#modalEl')?.contains(document.activeElement));
    assert(activeInside,`${viewport.label}: focus did not move into the assistant modal`);
    await assertNoOverflow(page,`${viewport.label} draft`);

    await page.locator('[data-receipt-assistant-message]').fill('Prepare the selected Company Receipt Pack.');
    await page.locator('[data-receipt-assistant-from]').fill('2026-08-12');
    await page.locator('[data-receipt-assistant-to]').fill('2026-08-12');
    const draft=await page.locator('[data-receipt-assistant-message]').inputValue();
    await page.locator('[data-receipt-assistant-close]').click();
    await open.click();
    assert(await page.locator('[data-receipt-assistant-message]').inputValue()===draft,`${viewport.label}: closing the modal lost the draft`);
    assert(await page.locator('[data-receipt-assistant-from]').inputValue()==='2026-08-12',`${viewport.label}: closing the modal lost Date from`);
    assert(await page.locator('[data-receipt-assistant-to]').inputValue()==='2026-08-12',`${viewport.label}: closing the modal lost Date to`);

    await page.evaluate(()=>{window.__receiptAssistantMode='hang';});
    await page.locator('[data-receipt-assistant-submit]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="running"]').waitFor({state:'visible',timeout:TIMEOUT});
    await page.locator('[data-receipt-assistant-cancel]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="cancelled"]').waitFor({state:'visible',timeout:TIMEOUT});
    assert(await page.locator('.receipt-assistant-error').innerText().then(text=>text.includes('cancelled')||text.includes('cancel')),`${viewport.label}: cancellation recovery message missing`);
    assert(await page.evaluate(()=>window.__receiptAssistantExecutions.length===0),`${viewport.label}: cancelled run reached execution`);
    assert(await page.evaluate(()=>window.__receiptAssistantAbortCount===1),`${viewport.label}: cancellation did not abort the active run`);

    await page.evaluate(()=>{window.__receiptAssistantMode='waiting';});
    await page.locator('[data-receipt-assistant-submit]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="waiting"]').waitFor({state:'visible',timeout:TIMEOUT});
    assert(await page.locator('[data-receipt-assistant-preview]').count()===1,`${viewport.label}: exact Pack preview missing`);
    assert(await page.locator('.receipt-assistant-source-list code').first().innerText()==='company-receipt:41:v1',`${viewport.label}: cited source missing`);
    assert(await page.locator('[data-receipt-assistant-preview]').innerText().then(text=>text.includes('UI Fixture Merchant')),`${viewport.label}: cited preview row missing`);
    assert(await page.locator('[data-receipt-assistant-row]').count()===20,`${viewport.label}: preview initial batch must remain bounded`);
    await page.locator('[data-receipt-assistant-more]').click();
    assert(await page.locator('[data-receipt-assistant-row]').count()===21,`${viewport.label}: last selected receipt is unreachable`);
    const lastRow=await page.locator('[data-receipt-assistant-row]').last().innerText();
    assert(lastRow.includes('Reviewed purpose 21')&&lastRow.includes('42.5000 SGD')&&lastRow.includes('220')&&lastRow.includes(await page.evaluate(()=>window.__receiptAssistantPdfHash)),`${viewport.label}: exact row review facts are missing`);
    assert(await page.locator('[data-receipt-assistant-more]').count()===0,`${viewport.label}: exhausted preview still offers more`);
    await assertNoOverflow(page,`${viewport.label} expanded selection`);
    await page.locator('[data-receipt-assistant-evidence="0"]').click();
    await page.locator('.receipt-assistant-error').waitFor({state:'visible'});
    assert(await page.locator('[data-receipt-assistant-evidence-preview]').count()===0,`${viewport.label}: changed source bytes rendered`);
    await page.evaluate(()=>{window.__receiptEvidenceBad=false;});
    await page.locator('[data-receipt-assistant-evidence="0"]').click();
    await page.locator('[data-receipt-assistant-evidence-preview] iframe').waitFor({state:'visible'});
    assert(await page.evaluate(()=>window.__receiptEvidenceReads.length===2&&window.__receiptEvidenceReads.every(row=>row.id===100&&row.versionNo===2)&&window.__receiptAssistantExecutions.length===0&&window.__receiptAssistantDecisions.length===0),`${viewport.label}: inspection bypassed exact-version read or created a decision`);
    await assertNoOverflow(page,`${viewport.label} source preview`);

    await page.locator('[data-receipt-assistant-reason]').fill('Reviewed exact cited preview');
    await page.locator('[data-receipt-assistant-cancel]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="cancelled"]').waitFor({state:'visible',timeout:TIMEOUT});
    assert(await page.evaluate(()=>window.__receiptAssistantDecisions.some(item=>item.decision==='cancel')),`${viewport.label}: waiting cancellation did not call decision boundary`);
    assert(await page.evaluate(()=>window.__receiptAssistantExecutions.length===0),`${viewport.label}: waiting cancellation created a Pack`);

    await page.locator('[data-receipt-assistant-submit]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="waiting"]').waitFor({state:'visible',timeout:TIMEOUT});
    await page.locator('[data-receipt-assistant-reason]').fill('Reviewed exact cited preview');
    await page.locator('[data-receipt-assistant-approve]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="succeeded"]').waitFor({state:'visible',timeout:TIMEOUT});
    const expectedHash=await page.evaluate(()=>window.__receiptAssistantPdfHash);
    assert(await page.locator('.receipt-assistant-success').innerText().then(text=>text.includes('901')&&text.includes(expectedHash)),`${viewport.label}: verified completion evidence missing`);
    assert(await page.evaluate(()=>window.__receiptAssistantDecisions.some(item=>item.decision==='approve')),`${viewport.label}: approval decision was not recorded`);
    assert(await page.evaluate(()=>window.__receiptAssistantExecutions.length===1),`${viewport.label}: governed execution should run exactly once`);
    await assertNoOverflow(page,`${viewport.label} success`);
    await page.locator('[data-receipt-assistant-open-pdf]').click();
    await page.locator('.receipt-assistant-error').waitFor({state:'visible'});
    assert(await page.locator('[data-receipt-assistant-pdf]').count()===0,`${viewport.label}: mismatched PDF rendered`);
    await page.evaluate(()=>{window.__receiptAssistantBadPdf=false;});
    await page.locator('[data-receipt-assistant-open-pdf]').click();
    await page.locator('[data-receipt-assistant-pdf]').waitFor({state:'visible'});
    assert(await page.evaluate(()=>window.__receiptAssistantPdfReads.length===2&&window.__receiptAssistantPdfReads.every(row=>row.id===901&&row.action==='view')&&window.__receiptAssistantExecutions.length===1),`${viewport.label}: PDF opening must read the existing Pack without executing again`);
    await assertNoOverflow(page,`${viewport.label} PDF preview`);

    await page.locator('[data-receipt-assistant-close]').click();
    await page.locator('[data-receipt-assistant-open]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="succeeded"]').waitFor({state:'visible'});
    assert(await page.locator('[data-receipt-assistant-pdf]').count()===0,`${viewport.label}: closed preview retained a temporary PDF URL`);
    await page.locator('[data-receipt-assistant-close]').click();
    await page.evaluate(async()=>navigate('company-receipts'));
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({state:'visible',timeout:TIMEOUT});
    await page.locator('[data-receipt-assistant-open]').click();
    const originalScope=await page.evaluate(()=>DB.erpSystem.scope.companyFn);
    await page.evaluate(()=>{DB.erpSystem.scope.companyFn='C-OTHER';});
    await page.locator('[data-receipt-assistant-message]').fill('This must remain in the original Company.');
    await page.locator('[data-receipt-assistant-from]').fill('2026-08-12');
    await page.locator('[data-receipt-assistant-to]').fill('2026-08-12');
    await page.locator('[data-receipt-assistant-submit]').click();
    await page.locator('[data-receipt-assistant-workspace][data-state="failed"]').waitFor({state:'visible',timeout:TIMEOUT});
    assert(await page.locator('.receipt-assistant-error').innerText().then(text=>text.includes('Company')),`${viewport.label}: scope-change recovery message missing`);
    assert(await page.evaluate(()=>window.__receiptAssistantCalls.length===3),`${viewport.label}: scope guard allowed a cross-Company assistant call`);
    await page.evaluate(scope=>{DB.erpSystem.scope.companyFn=scope;},originalScope);
    await page.locator('[data-receipt-assistant-close]').click();

    for(const theme of ['light','dark']){
      for(const language of LANGUAGES){
        await page.evaluate(async({language,theme})=>{setLang(language);applyTheme(theme);await navigate('company-receipts');},{language,theme});
        await page.locator('[data-company-receipt-register="canonical"]').waitFor({state:'visible',timeout:TIMEOUT});
        await page.locator('[data-receipt-assistant-open]').click();
        await page.locator('#modalEl.receipt-assistant-modal').waitFor({state:'visible',timeout:TIMEOUT});
        assert(await page.locator('#modalEl h3').innerText().then(text=>!text.includes('receiptAssistant.')),`${viewport.label}/${theme}/${language}: raw i18n key leaked`);
        await page.waitForFunction(()=>document.querySelector('#modalEl')?.contains(document.activeElement),null,{timeout:TIMEOUT});
        await page.waitForTimeout(250);
        const metrics=await assertNoOverflow(page,`${viewport.label}/${theme}/${language}`);
        assert(metrics.theme===theme,`${viewport.label}/${theme}/${language}: theme was not applied`);
        const focusWithin=await page.evaluate(()=>document.querySelector('#modalEl')?.contains(document.activeElement));
        assert(focusWithin,`${viewport.label}/${theme}/${language}: focus escaped modal`);
        if(viewport.width<=980){
          const targets=await page.locator('#modalEl .modal-foot .btn,#modalEl .modal-head .x').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{const rect=node.getBoundingClientRect();return {width:rect.width,height:rect.height};}));
          assert(targets.every(rect=>rect.width>=44&&rect.height>=44),`${viewport.label}/${theme}/${language}: touch target below 44px ${JSON.stringify(targets)}`);
        }
        await page.locator('[data-receipt-assistant-close]').click();
      }
    }
    assert(browserErrors.length===0,`${viewport.label}: browser errors detected:\n${browserErrors.join('\n')}`);
    console.log(`PASS Receipt assistant workspace E2E: ${viewport.label} desktop/mobile state, cancel/recovery, scope guard, five locales, both themes and focus/overflow checks`);
  }finally{
    await context.close();
  }
}

async function main(){
  if(!existsSync(DIST_INDEX)) throw new Error('web/dist/index.html not found. Run npm run build:demo first.');
  const preview=spawn(path.join(WEB_DIR,'node_modules','.bin','vite'),['preview','--port',PORT,'--strictPort'],{cwd:WEB_DIR,stdio:['ignore','pipe','pipe']});
  try{
    await waitForServer();
    const browser=await chromium.launch({headless:true});
    try{
      for(const viewport of [{label:'desktop',width:1280,height:900},{label:'mobile',width:375,height:812}]){
        await runViewport(browser,viewport);
      }
    }finally{await browser.close();}
  }finally{preview.kill();}
}

main().catch(error=>{console.error(`FAIL Receipt assistant workspace E2E: ${error.stack||error.message}`);process.exitCode=1;});
