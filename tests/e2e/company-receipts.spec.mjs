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
        companyReceipt:ErpSystemData.companyReceipt,
        documentContent:ErpSystemData.documentContent,
        companyReceiptEvidence:ErpSystemData.companyReceiptEvidence,
        companyReceiptConfirmation:ErpSystemData.companyReceiptConfirmation,
        companyReceiptPack:ErpSystemData.companyReceiptPack,
        companyReceiptPacks:ErpSystemData.companyReceiptPacks,
        companyReceiptPackGet:ErpSystemData.companyReceiptPackGet,
        companyReceiptPackPdf:ErpSystemData.companyReceiptPackPdf,
        receiptAssistant:ErpSystemData.receiptAssistant,
        receiptAssistantDecision:ErpSystemData.receiptAssistantDecision,
        receiptAssistantExecute:ErpSystemData.receiptAssistantExecute,
        createCompanyReceipt:ErpSystemData.createCompanyReceipt,
        updateCompanyReceipt:ErpSystemData.updateCompanyReceipt,
        voidCompanyReceipt:ErpSystemData.voidCompanyReceipt,
        myReceipts:ErpSystemData.my&&ErpSystemData.my.receipts,
      };
      window.__receiptActions={create:true,edit:true,void:true};
      window.__receiptDateOverrides={};
      const makeRow=id=>({
        id,transactionDate:id===50?null:'2026-08-11',merchant:`Merchant ${id}`,
        receiptNumber:`R-${id}`,category:'Travel',amount:'12.3400',currency:'SGD',
        businessPurpose:'Business purpose',notes:'',
        uploaderUserId:1,uploaderName:'Finance User',status:'ready',version:1,
        createdAt:'2026-08-11T08:00:00.000Z',updatedAt:'2026-08-11T08:00:00.000Z',
      });
      window.__receiptQueries=[];window.__receiptCreates=[];
      window.__receiptPackPayloads=[];window.__receiptPackPdfActions=[];
      window.__receiptUpdates=[];window.__receiptVoids=[];
      ErpSystemData.companyReceipts=async query=>{
        window.__receiptQueries.push({...query});
        const baseMeta={scope:'company',actorUserId:1,limit:25,nextCursor:null,actions:{...window.__receiptActions}};
        if(query&&query.search) return {data:[{...makeRow(900),merchant:'Server Search Result'}],meta:baseMeta};
        if(query&&(query.dateFrom||query.dateTo)) return {data:[makeRow(800)],meta:baseMeta};
        return query&&query.afterId
          ?{data:[makeRow(1)],meta:baseMeta}
          :{data:Array.from({length:25},(_,index)=>{const row=makeRow(50-index);if(row.id===50&&window.__receiptDateOverrides[50])row.transactionDate=window.__receiptDateOverrides[50];return row;}),meta:{...baseMeta,nextCursor:26}};
      };
      ErpSystemData.companyReceiptPackPrepare=async payload=>({data:{selectionDigest:'mock-pack-selection',visibility:'company',
        filters:{search:payload?.search||'',dateFrom:payload?.dateFrom||'',dateTo:payload?.dateTo||''},rows:[makeRow(800)],
        totals:[{currency:'SGD',amount:'12.3400',receiptCount:1}],rowCount:1,documentCount:1},meta:{preparationOnly:true}});
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
      ErpSystemData.companyReceiptEvidence=async query=>({data:[{
        id:601,documentId:601,documentVersionId:701,originalFileName:'confirmed-evidence.jpg',
        sha256:'b'.repeat(64),scanStatus:'clean',recordStatus:'draft',
      }],meta:{scope:'uploader',employeeIndependent:true,eligibleOnly:true,limit:25,nextCursor:null,filters:{search:query?.search||''}}});
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
      ErpSystemData.updateCompanyReceipt=async (id,payload)=>{
        window.__receiptUpdates.push({id,...payload});
        if(Number(id)===50) window.__receiptDateOverrides[50]=payload.transactionDate;
        return {data:{...makeRow(Number(id)),...payload,version:2},meta:{scope:'uploader'}};
      };
      ErpSystemData.voidCompanyReceipt=async (id,payload)=>{
        window.__receiptVoids.push({id,...payload});
        return {data:{...makeRow(Number(id)),status:'voided',version:2,voidReason:payload.reason},meta:{scope:'uploader',tombstone:true}};
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
    await page.evaluate(()=>{window.__receiptActions={create:false,edit:false,void:false};return navigate('company-receipts');});
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    assert(await page.locator('[data-company-receipt-confirm]').count()===0,
      'read-only users must not see the Company Receipt create action');
    await page.locator('.dt-body .dt-r').first().click();
    await page.locator('[data-company-receipt-edit-form]').waitFor({timeout:TIMEOUT});
    assert(await page.locator('[data-company-receipt-edit-save]').count()===0
      &&await page.locator('[data-company-receipt-void]').count()===0,
    'read-only users must not see edit or void actions in receipt details');
    await page.locator('#modalEl .modal-foot button').first().click();
    await page.evaluate(()=>{window.__receiptActions={create:true,edit:true,void:true};return navigate('company-receipts');});
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-missing-date-route]').click();
    await page.locator('[data-company-receipt-edit-form]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-receipt-edit-date]').fill('2026-08-12');
    await page.locator('[data-company-receipt-edit-save]').click();
    await page.waitForFunction(()=>window.__receiptUpdates.length===1,{timeout:TIMEOUT});
    assert(await page.evaluate(()=>window.__receiptUpdates[0]).then(payload=>
      Number(payload.id)===50&&payload.expectedVersion===1&&payload.transactionDate==='2026-08-12'),
    'Missing Date must reopen the metadata editor and submit the current version');
    await page.locator('.dt-body .dt-r').first().click();
    await page.locator('[data-company-receipt-void]').click();
    await page.locator('[data-company-receipt-void-form]').waitFor({timeout:TIMEOUT});
    await page.locator('[data-receipt-void-reason]').fill('Duplicate test record');
    await page.locator('[data-company-receipt-void-save]').click();
    await page.waitForFunction(()=>window.__receiptVoids.length===1,{timeout:TIMEOUT});
    assert(await page.evaluate(()=>window.__receiptVoids[0]).then(payload=>
      Number(payload.id)===50&&payload.expectedVersion===1&&payload.reason==='Duplicate test record'),
    'Authorized users must be able to retain a reasoned void with the current version');
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
    await page.evaluate(()=>{
      window.__receiptOriginalDate=Date;
      const OriginalDate=Date,fixed=OriginalDate.parse('2026-08-31T16:30:00.000Z');
      window.Date=class extends OriginalDate{
        constructor(...args){super(args.length?args[0]:fixed);}
        static now(){return fixed;}
      };
      DB.company.timeZone='Asia/Singapore';
    });
    await page.locator('[data-receipt-preset]').selectOption('thisMonth');
    assert(await page.locator('[data-receipt-from]').inputValue()==='2026-09-01'
      &&await page.locator('[data-receipt-to]').inputValue()==='2026-09-30',
    'Company Receipt presets must use the configured Company timezone at a local-day boundary');
    await page.evaluate(()=>{window.Date=window.__receiptOriginalDate;DB.company.timeZone='UTC';});
    await page.locator('[data-receipt-preset]').selectOption('custom');
    await page.locator('[data-receipt-from]').fill('2026-08-11');
    await page.locator('[data-receipt-to]').fill('2026-08-11');
    await page.locator('[data-company-receipt-filters] button.primary').click();
    await page.waitForFunction(()=>window.__receiptQueries.at(-1)?.dateFrom==='2026-08-11');
    await page.locator('[data-receipt-pack-preview]').click();
    await page.locator('[data-company-receipt-pack-confirm]').click();
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
      ErpSystemData.companyReceiptEvidence=actual.companyReceiptEvidence;
      ErpSystemData.companyReceiptConfirmation=actual.companyReceiptConfirmation;
      ErpSystemData.createCompanyReceipt=actual.createCompanyReceipt;
      ErpSystemData.updateCompanyReceipt=actual.updateCompanyReceipt;
      ErpSystemData.voidCompanyReceipt=actual.voidCompanyReceipt;
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
    const actualPack=await page.evaluate(async()=>{
      const result=await window.__actualCompanyReceiptAdapter.companyReceiptPack({
        packKey:'e2e-retention-0001',dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en',
      });
      return result.data.pack;
    });
    assert(new Date(actualPack.retentionUntil).getTime()>new Date('2026-08-12T00:00:00.000Z').getTime(),
      'Demo Receipt Pack retention must be derived from managed-document retention evidence');
    // Inject only the model transport; the Demo ERP commands remain real PGlite commands.
    await page.route('https://gpt.yapweijun1996.com/demo/**', async route=>{
      const session=route.request().url().endsWith('/session');
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session
        ?{token:'dmo_e2e-fixture'}
        :{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"search":""}'}]}]})});
    });
    const actualAssistant=await page.evaluate(async()=>{
      const actual=window.__actualCompanyReceiptAdapter;
      let run=await actual.receiptAssistant({message:'Prepare the confirmed Company Receipt Pack.',dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en'});
      if(run.data.state!=='waiting'||!run.data.preview||!run.data.confirmation?.packKey) throw new Error('Demo Receipt assistant did not return a waiting exact preview.');
      const sourceRow=run.data.preview.rows[0];
      const sourceDetail=(await actual.companyReceipt(sourceRow.receiptId)).data;
      const sourceFile=(await actual.documentContent(sourceDetail.documentId,sourceDetail.documentVersionNo)).data;
      const sourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',sourceFile.content)),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(sourceHash!==sourceRow.documentSha256||sourceFile.sha256!==sourceHash) throw new Error('Actual Demo source bytes do not match the reviewed evidence.');
      const beforeCount=(await actual.companyReceiptPacks({limit:100})).data.length;
      const execution={packKey:run.data.confirmation.packKey,search:'',dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en',executionIntentId:run.data.confirmation.intentId,executionIntentKey:run.data.confirmation.intentKey,payloadDigest:run.data.confirmation.payloadDigest};
      async function mustReject(input,code){
        let rejected=false;
        try{await actual.receiptAssistantExecute(input);}catch(error){rejected=!code||error.code===code;}
        if(!rejected) throw new Error('Unreviewed or stale Demo selection was accepted.');
        if((await actual.companyReceiptPacks({limit:100})).data.length!==beforeCount) throw new Error('Rejected Demo selection created a Pack.');
      }
      await mustReject(execution);
      await mustReject({...execution,selectionDigest:run.data.confirmation.selectionDigest},'agent_execution_intent_not_approved');
      await actual.receiptAssistantDecision('approve',{intentId:run.data.confirmation.intentId,expectedVersion:run.data.confirmation.intentVersion,reason:'Reviewed original selection before stale-facts test'});
      await mustReject({...execution,selectionDigest:'0'.repeat(64)},'agent_execution_intent_digest_mismatch');
      const receipt=run.data.preview.rows[0];
      await actual.updateCompanyReceipt(receipt.receiptId,{expectedVersion:receipt.receiptVersion,businessPurpose:'Updated after preview for selection-guard regression'});
      await mustReject({...execution,selectionDigest:run.data.confirmation.selectionDigest},'agent_execution_intent_stale');
      const cancelled=await actual.receiptAssistant({message:'Prepare the confirmed Company Receipt Pack.',dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en'});
      const cancelledIntent=cancelled.data.confirmation;
      await actual.receiptAssistantDecision('cancel',{intentId:cancelledIntent.intentId,expectedVersion:cancelledIntent.intentVersion,reason:'Cancel this prepared Pack'});
      await mustReject({...execution,packKey:cancelledIntent.packKey,executionIntentId:cancelledIntent.intentId,executionIntentKey:cancelledIntent.intentKey,selectionDigest:cancelledIntent.selectionDigest,payloadDigest:cancelledIntent.payloadDigest},'agent_execution_intent_not_approved');
      run=await actual.receiptAssistant({message:'Prepare the confirmed Company Receipt Pack.',dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en'});
      const confirmation=run.data.confirmation;
      await actual.receiptAssistantDecision('approve',{intentId:confirmation.intentId,expectedVersion:confirmation.intentVersion,reason:'Reviewed exact Demo preview'});
      const executed=await actual.receiptAssistantExecute({packKey:confirmation.packKey,search:'',dateFrom:'2026-08-12',dateTo:'2026-08-12',locale:'en',
        executionIntentId:confirmation.intentId,executionIntentKey:confirmation.intentKey,selectionDigest:confirmation.selectionDigest,payloadDigest:confirmation.payloadDigest});
      const replay=await actual.receiptAssistantExecute({...execution,packKey:confirmation.packKey,executionIntentId:confirmation.intentId,executionIntentKey:confirmation.intentKey,selectionDigest:confirmation.selectionDigest,payloadDigest:confirmation.payloadDigest});
      if(!replay.data.replayed||replay.data.pack.id!==executed.data.pack.id) throw new Error('Reviewed Demo Pack replay was not idempotent.');
      const persisted=await actual.companyReceiptPackGet(executed.data.pack.id);
      const pdf=await actual.companyReceiptPackPdf(executed.data.pack.id,'view');
      const digest=await crypto.subtle.digest('SHA-256',pdf.data.content);
      const artifactSha256=Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
      return {state:executed.data.state,packId:executed.data.pack.id,persistedId:persisted.data.id,
        artifactSha256,reportedArtifactSha256:executed.data.verification.artifact.artifactSha256,
        rowCount:persisted.data.rowCount};
    });
    assert(actualAssistant.state==='succeeded'&&actualAssistant.packId===actualAssistant.persistedId,
      'Demo Receipt assistant must read back the persisted Pack created by the governed command');
    assert(actualAssistant.rowCount===1&&/^[0-9a-f]{64}$/.test(actualAssistant.artifactSha256)
      &&actualAssistant.artifactSha256===actualAssistant.reportedArtifactSha256,
    'Demo Receipt assistant must verify the persisted PDF artifact hash before reporting success');
    for(const language of ['en','zh','ms','vi','ja']){
      await page.evaluate(async value=>{setLang(value);await navigate('company-receipts');},language);
      await page.locator('[data-company-receipt-register="canonical"]').waitFor({timeout:TIMEOUT});
      assert(await page.locator('.dt-body .dt-r').count()>0,
        `Company Receipts must remain usable after switching to ${language}`);
    }
    assert(browserErrors.length===0,`browser errors: ${browserErrors.join(' | ')}`);
    console.log('PASS Company Receipts E2E: mock/API-shape confirmation, actual Demo clean-evidence confirmation, query-side filters, immutable PDF preview/download/print, pagination and responsive facts');
  }finally{
    await context?.close();
    await browser?.close();
    preview.kill();
  }
}
main().catch(error=>{console.error(`FAIL Company Receipts E2E: ${error.stack||error.message}`);process.exitCode=1;});
