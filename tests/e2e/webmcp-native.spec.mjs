#!/usr/bin/env node
/* TASK-229 native WebMCP acceptance: real Chrome WebMCPTesting execution over
   the local Demo adapter. This test never contacts a production origin. */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR=path.join(ROOT,'web');
const PORT=process.env.WEBMCP_NATIVE_PORT||'4329';
const BASE_URL=`http://localhost:${PORT}`;
const TIMEOUT=60000;
const ACTIONS=[
  'receipt.search','receipt.get','receipt_pack.prepare',
  'receipt_pack.create','receipt_pack.get','receipt_pack.export',
];

function assert(condition,message){if(!condition) throw new Error(message);}
function parseToolValue(value){
  if(typeof value!=='string') return value;
  try{return JSON.parse(value);}catch{return value;}
}
async function waitForServer(){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    try{if((await fetch(BASE_URL)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`${BASE_URL} did not respond.`);
}
async function waitForDemo(page){
  await page.waitForFunction(
    ()=>window.DB&&window.DB.user&&Array.isArray(window.DB.user.permissionKeys),
    null,{timeout:TIMEOUT},
  );
}
async function waitForNativeRegistration(page){
  await page.waitForFunction(
    ()=>window.ErpWebMcp?.getState?.().reason==='registered',
    null,{timeout:TIMEOUT},
  );
}
async function nativeCall(page,name,input){
  return page.evaluate(async({name,input})=>{
    const tools=await document.modelContext.getTools();
    const tool=tools.find(item=>item.name===name);
    if(!tool) throw new Error(`Native WebMCP tool is missing: ${name}`);
    try{
      const raw=await document.modelContext.executeTool(tool,JSON.stringify(input));
      return {ok:true,value:parseValue(raw)};
    }catch(error){
      return {ok:false,error:{name:error?.name,message:error?.message,code:error?.code}};
    }
    function parseValue(value){
      if(typeof value!=='string') return value;
      try{return JSON.parse(value);}catch{return value;}
    }
  },{name,input});
}
async function packCount(page,packKey){
  return page.evaluate(async key=>{
    const result=await ErpSystemData.db.query(
      'select count(*) as count from company_receipt_pack where master_fn=$1 and company_fn=$2 and pack_key=$3',
      ['M1','C-SG',key],
    );
    return Number(result.rows?.[0]?.count||0);
  },packKey);
}

async function main(){
  if(!existsSync(path.join(WEB_DIR,'dist','index.html'))){
    throw new Error('web/dist/index.html not found. Run npm run build:demo first.');
  }
  const preview=spawn(path.join(WEB_DIR,'node_modules','.bin','vite'),
    ['preview','--port',PORT,'--strictPort'],{cwd:WEB_DIR,stdio:['ignore','pipe','pipe']});
  const pageErrors=[];
  let browser;
  try{
    await waitForServer();
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-features=WebMCPTesting']});
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage();
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.addInitScript(()=>{
      localStorage.setItem('aria-setup-wizard-complete','1');
      localStorage.setItem('aria-demo-auth',JSON.stringify({
        signedIn:true,email:'admin@acme.co',at:new Date(0).toISOString(),
      }));
    });
    await page.goto(`${BASE_URL}/?webmcp-native-e2e=${Date.now()}#dashboard`,{
      waitUntil:'domcontentloaded',timeout:30000,
    });
    await waitForDemo(page);

    const setup=await page.evaluate(async()=>{
      const db=window.DB;
      const adapter=window.ErpSystemData;
      await adapter.db.query("update master_module set enabled=true where master_fn='M1' and module_key='expenses_tax'");
      await adapter.db.query("update company_module set enabled=true where master_fn='M1' and company_fn='C-SG' and module_key='expenses_tax'");
      await adapter.refresh();
      db.user.permissionKeys=Array.from(new Set([
        ...(db.user.permissionKeys||[]),
        'finance.read','employee.self.read',
        'expenses.company_receipts.read_company','expenses.company_receipts.create',
      ]));
      db.erpSystem.selfServiceOnly=false;
      const module=db.erpSystem.modules.find(row=>String(row?.moduleKey||row?.module_key||'')==='expenses_tax');
      if(module) module.enabled=true;
      else db.erpSystem.modules.push({module_key:'expenses_tax',enabled:true,configured:true});
      await loadModuleControl();
      return {email:db.user.email,scope:db.erpSystem.scope,module:module||null};
    });
    assert(setup.scope?.masterFn==='M1'&&setup.scope?.companyFn==='C-SG',
      'native E2E fixture did not expose the expected local tenant scope');
    assert(setup.module?.enabled===true,'Expenses & Tax Demo entitlement was not enabled');

    void page.evaluate(()=>{void navigate('company-receipts');});
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    await waitForNativeRegistration(page);
    const nativeTools=await page.evaluate(async()=>{
      const tools=await document.modelContext.getTools();
      return tools.map(tool=>({name:tool.name,origin:tool.origin,annotations:tool.annotations}));
    });
    assert(JSON.stringify(nativeTools.map(tool=>tool.name).sort())===JSON.stringify(ACTIONS.slice().sort()),
      `native tool set mismatch: ${nativeTools.map(tool=>tool.name).join(', ')}`);
    assert(nativeTools.every(tool=>tool.origin===BASE_URL),'native tools must be bound to the local page origin');
    const createTool=nativeTools.find(tool=>tool.name==='receipt_pack.create');
    /* Chrome exposes the supported read-only hint and keeps the consequential
       boundary in the visible confirmation flow; unknown annotation fields
       are intentionally not used as the authorization boundary. */
    assert(createTool?.annotations?.readOnlyHint===false,
      'Receipt Pack creation must not be advertised as read-only');

    const draftKey=`webmcp-native-e2e-${Date.now()}`;
    const evidence=await page.evaluate(async clientDraftId=>{
      const uploaded=await ErpSystemData.my.uploadReceipt({
        id:clientDraftId,name:`${clientDraftId}.jpg`,type:'image/jpeg',
        blob:new Blob([new Uint8Array([
          0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,0x02,0x03,
        ])],{type:'image/jpeg'}),autoSubmitAuthorized:false,
      });
      const receipts=await ErpSystemData.my.receipts();
      const evidence=(receipts.data||[]).find(row=>row.id===uploaded.data.id);
      if(!evidence?.documentVersionId) throw new Error('Demo upload did not return a governed document version.');
      await ErpSystemData.db.query(
        "update document_scan_job set status='clean',scanner='chrome-webmcp-e2e',result_code='clean',completed_at=now() where master_fn='M1' and company_fn='C-SG' and version_id=$1",
        [evidence.documentVersionId],
      );
      await ErpSystemData.refresh();
      return {id:evidence.id,documentVersionId:evidence.documentVersionId,originalFileName:evidence.originalFileName};
    },draftKey);

    void page.evaluate(()=>{void navigate('company-receipts');});
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-company-receipt-confirm]').click();
    await page.locator(`[data-company-receipt-evidence="${evidence.documentVersionId}"]`).click();
    await page.locator('[data-company-receipt-confirm-form]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-receipt-confirm-date]').fill('2026-08-12');
    await page.locator('[data-receipt-confirm-merchant]').fill('Native WebMCP Merchant');
    await page.locator('[data-receipt-confirm-number]').fill(`NATIVE-${Date.now()}`);
    await page.locator('[data-receipt-confirm-category]').fill('Travel');
    await page.locator('[data-receipt-confirm-amount]').fill('42.5000');
    await page.locator('[data-receipt-confirm-currency]').fill('SGD');
    await page.locator('[data-receipt-confirm-purpose]').fill('Native WebMCP browser acceptance');
    await page.locator('[data-receipt-confirm-save]').click();
    await page.waitForFunction(
      ()=>Array.from(document.querySelectorAll('.dt-body .dt-r')).some(row=>row.textContent.includes('Native WebMCP Merchant')),
      null,{timeout:TIMEOUT},
    );

    const search=await nativeCall(page,'receipt.search',{limit:10,search:'Native WebMCP Merchant'});
    assert(search.ok&&search.value?.data?.length===1,'native receipt.search did not return the confirmed record');
    const row=search.value.data[0];
    const detail=await nativeCall(page,'receipt.get',{receiptId:Number(row.id)});
    assert(detail.ok&&detail.value?.data?.merchant==='Native WebMCP Merchant',
      'native receipt.get did not return the confirmed record');
    const prepared=await nativeCall(page,'receipt_pack.prepare',{
      dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en',
    });
    assert(prepared.ok&&prepared.value?.data?.rowCount===1&&prepared.value?.data?.totals?.[0]?.amount==='42.5000',
      'native receipt_pack.prepare did not return the exact selection and totals');

    const cancelKey=`webmcp-native-cancel-${Date.now()}`;
    await page.evaluate(input=>{
      window.__webmcpNativeCancelController=new AbortController();
      window.__webmcpNativeCancelPromise=(async()=>{
        try{
          const tool=(await document.modelContext.getTools()).find(item=>item.name==='receipt_pack.create');
          return {ok:true,value:await document.modelContext.executeTool(
            tool,JSON.stringify(input),{signal:window.__webmcpNativeCancelController.signal},
          )};
        }catch(error){
          return {ok:false,error:{name:error?.name,message:error?.message,code:error?.code}};
        }
      })();
    },{packKey:cancelKey,dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en'});
    await page.locator('[data-company-receipt-pack-cancel]').waitFor({timeout:TIMEOUT});
    const cancelText=await page.locator('#modalEl').innerText();
    assert(cancelText.includes('Review Receipt Pack')&&cancelText.includes('42.5000'),
      'native create did not show the exact visible review before cancellation');
    await page.evaluate(()=>window.__webmcpNativeCancelController.abort());
    const cancelled=await page.evaluate(()=>window.__webmcpNativeCancelPromise);
    assert(!cancelled.ok&&(cancelled.error?.name==='AbortError'||cancelled.error?.code===20),
      `native cancellation did not return an abort result: ${JSON.stringify(cancelled)}`);
    assert(await packCount(page,cancelKey)===0,'native cancellation created a Receipt Pack unexpectedly');

    const packKey=`webmcp-native-confirm-${Date.now()}`;
    await page.evaluate(input=>{
      window.__webmcpNativeCreatePromise=(async()=>{
        try{
          const tool=(await document.modelContext.getTools()).find(item=>item.name==='receipt_pack.create');
          return {ok:true,value:await document.modelContext.executeTool(tool,JSON.stringify(input))};
        }catch(error){
          return {ok:false,error:{name:error?.name,message:error?.message,code:error?.code}};
        }
      })();
    },{packKey,dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en'});
    await page.locator('[data-company-receipt-pack-confirm]').waitFor({timeout:TIMEOUT});
    const reviewText=await page.locator('#modalEl').innerText();
    assert(reviewText.includes('Review Receipt Pack')&&reviewText.includes('Native WebMCP Merchant'),
      'native create did not show the selected receipt in the visible review');
    await page.locator('[data-company-receipt-pack-confirm]').click();
    const created=await page.evaluate(()=>window.__webmcpNativeCreatePromise);
    const createdValue=parseToolValue(created.value);
    assert(created.ok&&createdValue?.data?.pack?.id,`native create failed: ${JSON.stringify(created)}`);
    const packId=Number(createdValue.data.pack.id);
    assert(await packCount(page,packKey)===1,'native confirmation did not persist exactly one Receipt Pack');
    const stored=await page.evaluate(async id=>{
      const result=await ErpSystemData.db.query(
        'select id,pack_key,row_count,document_count,source_sha256 from company_receipt_pack where master_fn=$1 and company_fn=$2 and id=$3',
        ['M1','C-SG',id],
      );
      return result.rows?.[0]||null;
    },packId);
    assert(stored&&Number(stored.id)===packId&&Number(stored.row_count)===1,
      'native-created Receipt Pack was not persisted with one frozen row');

    const persisted=await nativeCall(page,'receipt_pack.get',{packId});
    assert(persisted.ok&&Number(persisted.value?.data?.id)===packId,
      'native receipt_pack.get did not read back the persisted Pack');
    const exported=await nativeCall(page,'receipt_pack.export',{packId,action:'view'});
    assert(exported.ok&&exported.value?.data?.contentEncoding==='base64',
      'native receipt_pack.export did not return JSON-safe base64 content');
    const pdfBase64=exported.value.data.content;
    const pdf=Buffer.from(pdfBase64,'base64');
    const artifactSha256=createHash('sha256').update(pdf).digest('hex');
    assert(exported.value.data.mimeType==='application/pdf'
      &&Number(exported.value.data.byteLength)===pdf.length
      &&pdf.subarray(0,8).toString('ascii')==='%PDF-1.7',
    'native PDF export did not return a valid PDF artifact');

    const revoked=await page.evaluate(async()=>{
      const tool=(await document.modelContext.getTools()).find(item=>item.name==='receipt.search');
      const saved=[...(window.DB.user.permissionKeys||[])];
      window.DB.user.permissionKeys=[];
      try{
        await document.modelContext.executeTool(tool,JSON.stringify({limit:1}));
        return {ok:false};
      }catch(error){
        const retired=window.ErpWebMcp.getState();
        return {ok:true,name:error?.name,message:error?.message,code:error?.code,
          retiredRegistered:retired.registered.length,retiredReason:retired.reason};
      }finally{
        window.DB.user.permissionKeys=saved;
        await window.ErpWebMcp.sync('permission-restored');
      }
    });
    assert(revoked.ok&&revoked.retiredRegistered===0,
      `native permission revocation was not rejected: ${JSON.stringify(revoked)}`);
    await waitForNativeRegistration(page);

    const stale=await page.evaluate(async()=>{
      const tool=(await document.modelContext.getTools()).find(item=>item.name==='receipt.search');
      const saved=window.DB.erpSystem.scope.companyFn;
      window.DB.erpSystem.scope.companyFn='C-MY';
      try{
        await document.modelContext.executeTool(tool,JSON.stringify({limit:1}));
        return {ok:false};
      }catch(error){
        const retired=window.ErpWebMcp.getState();
        return {ok:true,name:error?.name,message:error?.message,code:error?.code,
          retiredRegistered:retired.registered.length,retiredReason:retired.reason};
      }finally{
        window.DB.erpSystem.scope.companyFn=saved;
        await window.ErpWebMcp.sync('company-restored');
      }
    });
    assert(stale.ok&&stale.retiredRegistered===0,
      `native Company scope change was not rejected: ${JSON.stringify(stale)}`);
    await waitForNativeRegistration(page);

    await page.evaluate(()=>{void navigate('dashboard');});
    await page.waitForFunction(()=>window.ErpWebMcp?.getState?.().registered?.length===0,
      null,{timeout:TIMEOUT});
    await page.evaluate(()=>{void navigate('company-receipts');});
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    await waitForNativeRegistration(page);

    await page.setViewportSize({width:375,height:812});
    await page.evaluate(()=>{void navigate('company-receipts');});
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    const mobile=await page.evaluate(()=>({
      scrollWidth:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth,
      rows:document.querySelectorAll('.dt-body .dt-r').length,
      headerDisplay:getComputedStyle(document.querySelector('.dt-head')).display,
    }));
    assert(mobile.scrollWidth<=mobile.clientWidth&&mobile.rows>=1&&mobile.headerDisplay==='none',
      `mobile native journey overflowed or lost receipt facts: ${JSON.stringify(mobile)}`);
    assert(pageErrors.length===0,`browser page errors: ${pageErrors.join(' | ')}`);
    console.log(`PASS WebMCP native E2E (Chrome ${await browser.version()}): six tools, native receipt reads, visible cancellation/confirmation, persisted Pack ${packId}, PDF ${pdf.length} bytes sha256=${artifactSha256}, permission/scope/navigation retirement, 375px bounds`);
  }finally{
    await browser?.close();
    preview.kill('SIGTERM');
  }
}

main().catch(error=>{
  console.error(`FAIL WebMCP native E2E: ${error.stack||error.message}`);
  process.exitCode=1;
});
