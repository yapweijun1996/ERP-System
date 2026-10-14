/* Read-only, allowlisted static Demo diagnostics. Never inspect records/storage. */
(function installDemoStartupDiagnostics(){
  if(typeof window.erpDataMode==='function'&&window.erpDataMode()!=='demo') return;
  var stages=new Set(['Preparing local demo database','Starting local demo database','Opening local demo database','Preparing base demo records','Checking database compatibility','Loading showcase data','Loading warehouse fixtures','Loading manufacturing fixtures','Loading quality fixtures','Loading sales fixtures','Loading delivery fixtures','Loading return fixtures','Loading debit fixtures','Loading pricing fixtures','Reading demo workspace','Demo database ready']);
  var codes=new Set(['demo_initialization_failed','demo_asset_fetch_failed','demo_manifest_invalid','demo_pack_integrity_failed','demo_schema_table_missing','demo_schema_index_ineligible','demo_schema_constraint_mismatch','demo_schema_index_mismatch','demo_schema_constraint_missing','demo_schema_index_repair_failed','demo_schema_lineage_unknown','demo_schema_lineage_mismatch','demo_schema_identity_invalid','demo_schema_repair_failed']);
  var assets=new Set(['erp-system-schema.sql','erp-system-migrations.sql','erp-system-demo-txn.sql','erp-system-demo-drafts.sql','erp-system-demo-picks.sql','erp-system-demo-manufacturing.sql','erp-system-demo-quality.sql','erp-system-demo-sales-front.sql','erp-system-demo-sales-delivery.sql','erp-system-demo-sales-return.sql','erp-system-demo-sales-debit.sql','erp-system-demo-sales-pricing.sql','erp-system-demo-sales-credit.sql','erp-system-demo-company-receipts.sql','erp-system-showcase-v1.sql','erp-system-showcase-v1.json','canonical seedDemo','VALIDATE DEMO MIGRATION IDENTITY','VALIDATE DEMO SCHEMA LINEAGE','REPAIR DEMO HR ORGANIZATION','REPAIR DEMO LEGACY ROLE INDEX','REPAIR DEMO HISTORICAL COMPANY PROFILE']);
  var objects=new Set(['uq_account_code','uq_user_master_username','uq_customer_code','uq_employee_no','uq_leave_balance_entry_key','uq_leave_policy_version','uq_leave_type_code','uq_payroll_run_docno','uq_payroll_run_line','uq_product_sku','uq_role_company_name','role_permission_role_id_permission_key_pk','role_resource_scope_role_id_resource_key_pk','uq_sales_credit_profile_customer','uq_sales_debit_note_docno','uq_sales_delivery_order','uq_sales_discount_rule_code','uq_sales_price_list_code','uq_sales_price_list_line','uq_stock_level','uq_stock_location_balance','uq_supplier_code','system_state_pkey','user_company_user_id_company_fn_pk','uq_warehouse_code','uq_warehouse_bin_code','uq_working_calendar_code','uq_working_calendar_version','account','app_user','customer','employee','leave_balance_entry','leave_policy_version','leave_type','payroll_run','payroll_run_line','product','role','role_permission','role_resource_scope','sales_credit_profile','sales_debit_note','sales_delivery','sales_discount_rule','sales_price_list','sales_price_list_line','stock_level','stock_location_balance','supplier','system_state','user_company','warehouse','warehouse_bin','working_calendar','working_calendar_version']);
  var copies={
    en:{title:'Local demo startup details',stage:'Stage',code:'Code',statement:'Source check',copy:'Copy diagnostic',copied:'Diagnostic copied',copyFailed:'Could not copy. Select the diagnostic text below.',retry:'Reload to retry',notice:'These details contain no records or credentials. Reloading does not reset stored data. Unsaved setup entries may need to be entered again.'},
    zh:{title:'本地演示启动详情',stage:'阶段',code:'代码',statement:'来源检查',copy:'复制诊断',copied:'已复制诊断',copyFailed:'无法复制，请选中下方诊断文本。',retry:'重新加载以重试',notice:'这些详情不包含记录或凭据。重新加载不会重置已存储的数据，未保存的设置内容可能需要重新输入。'},
    ms:{title:'Butiran permulaan demo setempat',stage:'Peringkat',code:'Kod',statement:'Semakan sumber',copy:'Salin diagnostik',copied:'Diagnostik disalin',copyFailed:'Tidak dapat menyalin. Pilih teks diagnostik di bawah.',retry:'Muat semula untuk cuba lagi',notice:'Butiran ini tidak mengandungi rekod atau kelayakan. Muat semula tidak menetapkan semula data tersimpan. Entri persediaan yang belum disimpan mungkin perlu dimasukkan semula.'},
    ja:{title:'ローカルデモの起動詳細',stage:'段階',code:'コード',statement:'ソース確認',copy:'診断をコピー',copied:'診断をコピーしました',copyFailed:'コピーできません。下の診断テキストを選択してください。',retry:'再読み込みして再試行',notice:'この詳細には記録や認証情報は含まれません。再読み込みしても保存済みデータはリセットされません。未保存の設定は再入力が必要な場合があります。'},
    vi:{title:'Chi tiết khởi động demo cục bộ',stage:'Giai đoạn',code:'Mã',statement:'Kiểm tra nguồn',copy:'Sao chép chẩn đoán',copied:'Đã sao chép chẩn đoán',copyFailed:'Không thể sao chép. Chọn văn bản chẩn đoán bên dưới.',retry:'Tải lại để thử lại',notice:'Chi tiết này không chứa bản ghi hoặc thông tin đăng nhập. Tải lại không đặt lại dữ liệu đã lưu. Có thể cần nhập lại các mục thiết lập chưa lưu.'},
  };
  function safeStatement(value){
    if(assets.has(value)) return value;
    if(typeof value!=='string') return null;
    var match=/^(VALIDATE (?:UNIQUE INDEX|CONSTRAINT|TABLE)|CREATE UNIQUE INDEX) ([a-z_]+)$/.exec(value);
    return match&&objects.has(match[2])?value:null;
  }
  function failure(error,stage){
    var code=error&&typeof error.code==='string'?error.code:'';
    var result={code:codes.has(code)||/^[0-9A-Z]{5}$/.test(code)?code:'demo_initialization_failed',stage:stages.has(stage)?stage:'Preparing local demo database',statement:safeStatement(error&&error.demoBootStatement)};
    if(result.code==='demo_schema_lineage_unknown'&&result.statement==='VALIDATE DEMO SCHEMA LINEAGE'){
      var lineage=safeLineage(error&&error.demoBootLineage);
      if(lineage) result.lineage=lineage;
    }
    return result;
  }
  function safeLineage(value){
    if(!value||typeof value!=='object')return null;
    function count(number){return Number.isInteger(number)&&number>=0&&number<=1000000;}
    function hash(text){return typeof text==='string'&&text.length===64&&/^[a-f0-9]{64}$/.test(text);}
    if(!count(value.marker)||!hash(value.structuralHash))return null;
    var names=['tables','columns','constraints','indexes','sequences','triggers','functions'];
    var categories=[];
    names.forEach(function(name){
      var item=Array.isArray(value.categories)&&value.categories.length<=names.length&&value.categories.find(function(entry){return entry&&entry.name===name;});
      if(!item||!hash(item.hash)||!count(item.count))return;
      categories.push({name:name,hash:item.hash,count:item.count,expectedHash:hash(item.expectedHash)?item.expectedHash:null,expectedCount:count(item.expectedCount)?item.expectedCount:null});
    });
    return {marker:value.marker,structuralHash:value.structuralHash,expectedStructuralHash:hash(value.expectedStructuralHash)?value.expectedStructuralHash:null,matchedVersion:count(value.matchedVersion)?value.matchedVersion:null,identityCount:count(value.identityCount)?value.identityCount:null,legacyRoleIndex:['absent','known_legacy','ineligible'].indexOf(value.legacyRoleIndex)!==-1?value.legacyRoleIndex:null,normalizedMatchedVersion:count(value.normalizedMatchedVersion)?value.normalizedMatchedVersion:null,categories:categories};
  }
  function snapshot(){
    var captured=window.__ERP_DEMO_FAILURE__;
    var normalized=failure({code:captured&&captured.code,demoBootStatement:captured&&captured.statement,demoBootLineage:captured&&captured.lineage},captured&&captured.stage);
    var phase=window.__ERP_DEMO_PROGRESS__&&window.__ERP_DEMO_PROGRESS__.phase;
    var adapter=window.ErpSystemData;
    var build=window.__ERP_BUILD_ID__;
    return Object.assign({code:normalized.code,stage:normalized.stage,statement:normalized.statement,phase:['loading','fallback','failed','ready'].indexOf(phase)!==-1?phase:'loading',mode:adapter&&['pending','fallback','pglite'].indexOf(adapter.mode)!==-1?adapter.mode:'pending',ready:!!(adapter&&adapter.databaseReady===true),buildId:typeof build==='string'&&/^[a-f0-9]{40}(?:-dirty)?$/.test(build)?build:'development'},normalized.lineage?{lineage:normalized.lineage}:{});
  }
  function serialize(){ return JSON.stringify(snapshot(),null,2); }
  function render(){
    if(typeof document==='undefined'||typeof document.querySelectorAll!=='function') return;
    document.querySelectorAll('[data-demo-diagnostic]').forEach(function(host){
      var failed=window.__ERP_DEMO_PROGRESS__&&window.__ERP_DEMO_PROGRESS__.phase==='failed';
      host.hidden=!failed;
      host.replaceChildren();
      if(!failed) return;
      host.className='demo-startup-diagnostic';
      var language=host.closest('[lang]')&&host.closest('[lang]').getAttribute('lang')||document.documentElement.lang||'en';
      var copy=copies[language==='zh-Hans'?'zh':language]||copies.en;
      var data=snapshot();
      var title=document.createElement('strong');title.textContent=copy.title;host.appendChild(title);
      var summary=document.createElement('p');summary.textContent=copy.stage+': '+data.stage+' · '+copy.code+': '+data.code+(data.statement?' · '+copy.statement+': '+data.statement:'');host.appendChild(summary);
      var actions=document.createElement('div');actions.className='demo-diagnostic-actions';
      var copyButton=document.createElement('button');copyButton.type='button';copyButton.className='btn soft';copyButton.textContent=copy.copy;
      var status=document.createElement('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      copyButton.addEventListener('click',async function(){
        try{if(!navigator.clipboard||typeof navigator.clipboard.writeText!=='function')throw new Error('clipboard_unavailable');await navigator.clipboard.writeText(serialize());status.textContent=copy.copied;}
        catch{status.textContent=copy.copyFailed;}
      });
      var retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent=copy.retry;retry.addEventListener('click',function(){location.reload();});
      actions.append(copyButton,retry,status);host.appendChild(actions);
      var details=document.createElement('details');var label=document.createElement('summary');label.textContent=copy.copy;var text=document.createElement('pre');text.textContent=serialize();details.append(label,text);host.appendChild(details);
      var notice=document.createElement('small');notice.textContent=copy.notice;host.appendChild(notice);
    });
  }
  window.ErpDemoDiagnostics=Object.freeze({failure:failure,snapshot:snapshot,serialize:serialize,render:render});
  window.addEventListener('erp:demo-progress',render);
})();
