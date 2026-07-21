/* ============================================================
   ARIA ERP — screens: Projects (portfolio, project detail, timesheet)
   project-pl/project-detail are wired to real project/progress_claim data
   (EPIC-021); timesheet has no schema and stays mock, deferred alongside
   payroll-run/payslip.
   ============================================================ */

const PROJECT_STATUS_LABEL = { open:'Open', on_hold:'On hold', completed:'Completed' };
const PROJECT_STATUS_TONE = { open:'ok', on_hold:'warn', completed:'neutral' };
function projectStatusBadge(status){
  return cap(ts(PROJECT_STATUS_LABEL[status]||status), PROJECT_STATUS_TONE[status]||'neutral');
}

function projectCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      colBilled:'Billed to date',overBilledAlert:'{n} project(s) have billed more than their contract value.',
      fieldProjectNo:'Project no.',systemNumbered:'System-numbered',fieldName:'Project name',
      namePlaceholder:'e.g. Beta Pte Ltd — Cell Integration',fieldCustomer:'Customer',
      internalOption:'Internal project (no customer)',fieldManager:'Project manager',
      managerPlaceholder:'e.g. Liam Cardoso',fieldStatus:'Status',fieldStartDate:'Start date',
      fieldDueDate:'Due date',optional:'optional',fieldContractValue:'Contract value',
      nameRequired:'Project name is required',managerRequired:'Project manager is required',
      projectCreated:'Project {no} registered',projectSaveError:'Project could not be registered',
      createProject:'Register project',internalNote:'Internal projects have no customer and cannot receive a progress claim.',
      completedNote:'This project is completed and cannot receive a new progress claim.',
      claimsPanel:'Progress Claims',claimsEmpty:'No progress claims yet.',
      colClaimNo:'Claim',colClaimDate:'Date',colDescription:'Description',colNet:'Net',colTax:'Tax',colTotal:'Total',
      newClaim:'New progress claim',fieldClaimNo:'Claim no.',fieldClaimDate:'Claim date',fieldDescriptionField:'Description',
      descriptionPlaceholder:'e.g. Fabrication 50% complete',fieldNetAmount:'Net amount',
      descriptionRequired:'Description is required',claimCreated:'Progress claim {no} created',
      claimSaveError:'Progress claim could not be created',postClaim:'Post',
      claimPosted:'Progress claim {no} posted — {amount} to GL',claimPostError:'Progress claim could not be posted',
      billingSummary:'Billing summary',contractValue:'Contract value',headroom:'Headroom',
      overBilledIndicator:'Over-billed',onTrackIndicator:'Within contract',
      activityProjectCreated:'Project registered',activityClaimCreated:'Progress claim {no} drafted — {amount}',
      activityClaimPosted:'Progress claim {no} posted — {amount} to GL',
      internalProject:'Internal project',linkedCustomer:'Linked customer',customer360:'Customer 360',
    },
    ms:{
      colBilled:'Dibil setakat ini',overBilledAlert:'{n} projek telah membilkan lebih daripada nilai kontrak.',
      fieldProjectNo:'No. projek',systemNumbered:'Bernombor sistem',fieldName:'Nama projek',
      namePlaceholder:'cth. Beta Pte Ltd — Integrasi Sel',fieldCustomer:'Pelanggan',
      internalOption:'Projek dalaman (tiada pelanggan)',fieldManager:'Pengurus projek',
      managerPlaceholder:'cth. Liam Cardoso',fieldStatus:'Status',fieldStartDate:'Tarikh mula',
      fieldDueDate:'Tarikh akhir',optional:'pilihan',fieldContractValue:'Nilai kontrak',
      nameRequired:'Nama projek diperlukan',managerRequired:'Pengurus projek diperlukan',
      projectCreated:'Projek {no} didaftarkan',projectSaveError:'Projek tidak dapat didaftarkan',
      createProject:'Daftar projek',internalNote:'Projek dalaman tiada pelanggan dan tidak boleh menerima tuntutan kemajuan.',
      completedNote:'Projek ini telah selesai dan tidak boleh menerima tuntutan kemajuan baharu.',
      claimsPanel:'Tuntutan Kemajuan',claimsEmpty:'Belum ada tuntutan kemajuan.',
      colClaimNo:'Tuntutan',colClaimDate:'Tarikh',colDescription:'Keterangan',colNet:'Bersih',colTax:'Cukai',colTotal:'Jumlah',
      newClaim:'Tuntutan kemajuan baharu',fieldClaimNo:'No. tuntutan',fieldClaimDate:'Tarikh tuntutan',fieldDescriptionField:'Keterangan',
      descriptionPlaceholder:'cth. Fabrikasi 50% siap',fieldNetAmount:'Jumlah bersih',
      descriptionRequired:'Keterangan diperlukan',claimCreated:'Tuntutan kemajuan {no} dicipta',
      claimSaveError:'Tuntutan kemajuan tidak dapat dicipta',postClaim:'Catat',
      claimPosted:'Tuntutan kemajuan {no} dicatat — {amount} ke GL',claimPostError:'Tuntutan kemajuan tidak dapat dicatat',
      billingSummary:'Ringkasan bilan',contractValue:'Nilai kontrak',headroom:'Ruang baki',
      overBilledIndicator:'Lebih bil',onTrackIndicator:'Dalam kontrak',
      activityProjectCreated:'Projek didaftarkan',activityClaimCreated:'Tuntutan kemajuan {no} didraf — {amount}',
      activityClaimPosted:'Tuntutan kemajuan {no} dicatat — {amount} ke GL',
      internalProject:'Projek dalaman',linkedCustomer:'Pelanggan berkaitan',customer360:'Customer 360',
    },
    zh:{
      colBilled:'累计已开账单',overBilledAlert:'{n} 个项目的开单金额已超过合约价值。',
      fieldProjectNo:'项目编号',systemNumbered:'系统编号',fieldName:'项目名称',
      namePlaceholder:'例如:Beta Pte Ltd — 单元集成',fieldCustomer:'客户',
      internalOption:'内部项目(无客户)',fieldManager:'项目经理',
      managerPlaceholder:'例如:Liam Cardoso',fieldStatus:'状态',fieldStartDate:'开始日期',
      fieldDueDate:'截止日期',optional:'可选',fieldContractValue:'合约价值',
      nameRequired:'请填写项目名称',managerRequired:'请填写项目经理',
      projectCreated:'项目 {no} 已登记',projectSaveError:'项目登记失败',
      createProject:'登记项目',internalNote:'内部项目没有客户,无法开立进度账单。',
      completedNote:'该项目已完成,无法开立新的进度账单。',
      claimsPanel:'进度账单',claimsEmpty:'尚无进度账单。',
      colClaimNo:'账单编号',colClaimDate:'日期',colDescription:'说明',colNet:'净额',colTax:'税额',colTotal:'总额',
      newClaim:'新建进度账单',fieldClaimNo:'账单编号',fieldClaimDate:'账单日期',fieldDescriptionField:'说明',
      descriptionPlaceholder:'例如:制造进度达50%',fieldNetAmount:'净额',
      descriptionRequired:'请填写说明',claimCreated:'进度账单 {no} 已创建',
      claimSaveError:'进度账单创建失败',postClaim:'过账',
      claimPosted:'进度账单 {no} 已过账 — {amount} 至总账',claimPostError:'进度账单过账失败',
      billingSummary:'开单摘要',contractValue:'合约价值',headroom:'剩余额度',
      overBilledIndicator:'超额开单',onTrackIndicator:'合约范围内',
      activityProjectCreated:'项目已登记',activityClaimCreated:'进度账单 {no} 已建立草稿 — {amount}',
      activityClaimPosted:'进度账单 {no} 已过账 — {amount} 至总账',
      internalProject:'内部项目',linkedCustomer:'关联客户',customer360:'客户 360',
    },
    ja:{
      colBilled:'請求累計',overBilledAlert:'{n} 件のプロジェクトが契約金額を超えて請求されています。',
      fieldProjectNo:'プロジェクト番号',systemNumbered:'システム採番',fieldName:'プロジェクト名',
      namePlaceholder:'例:Beta Pte Ltd — セル統合',fieldCustomer:'顧客',
      internalOption:'社内プロジェクト(顧客なし)',fieldManager:'プロジェクトマネージャー',
      managerPlaceholder:'例:Liam Cardoso',fieldStatus:'ステータス',fieldStartDate:'開始日',
      fieldDueDate:'期限日',optional:'任意',fieldContractValue:'契約金額',
      nameRequired:'プロジェクト名を入力してください',managerRequired:'プロジェクトマネージャーを入力してください',
      projectCreated:'プロジェクト {no} を登録しました',projectSaveError:'プロジェクトを登録できませんでした',
      createProject:'プロジェクトを登録',internalNote:'社内プロジェクトには顧客がなく、出来高請求を作成できません。',
      completedNote:'このプロジェクトは完了しており、新しい出来高請求を作成できません。',
      claimsPanel:'出来高請求',claimsEmpty:'出来高請求はまだありません。',
      colClaimNo:'請求番号',colClaimDate:'日付',colDescription:'内容',colNet:'税抜額',colTax:'税額',colTotal:'合計',
      newClaim:'出来高請求を作成',fieldClaimNo:'請求番号',fieldClaimDate:'請求日',fieldDescriptionField:'内容',
      descriptionPlaceholder:'例:製作50%完了',fieldNetAmount:'税抜額',
      descriptionRequired:'内容を入力してください',claimCreated:'出来高請求 {no} を作成しました',
      claimSaveError:'出来高請求を作成できませんでした',postClaim:'計上',
      claimPosted:'出来高請求 {no} を計上しました — {amount} を総勘定元帳へ',claimPostError:'出来高請求を計上できませんでした',
      billingSummary:'請求サマリー',contractValue:'契約金額',headroom:'残余枠',
      overBilledIndicator:'超過請求',onTrackIndicator:'契約範囲内',
      activityProjectCreated:'プロジェクトを登録しました',activityClaimCreated:'出来高請求 {no} を下書き作成 — {amount}',
      activityClaimPosted:'出来高請求 {no} を計上 — {amount} を総勘定元帳へ',
      internalProject:'社内プロジェクト',linkedCustomer:'関連顧客',customer360:'顧客360',
    },
    vi:{
      colBilled:'Đã xuất hóa đơn lũy kế',overBilledAlert:'{n} dự án đã xuất hóa đơn vượt giá trị hợp đồng.',
      fieldProjectNo:'Mã dự án',systemNumbered:'Đánh số tự động',fieldName:'Tên dự án',
      namePlaceholder:'vd: Beta Pte Ltd — Tích hợp cụm',fieldCustomer:'Khách hàng',
      internalOption:'Dự án nội bộ (không có khách hàng)',fieldManager:'Quản lý dự án',
      managerPlaceholder:'vd: Liam Cardoso',fieldStatus:'Trạng thái',fieldStartDate:'Ngày bắt đầu',
      fieldDueDate:'Ngày kết thúc',optional:'tùy chọn',fieldContractValue:'Giá trị hợp đồng',
      nameRequired:'Vui lòng nhập tên dự án',managerRequired:'Vui lòng nhập quản lý dự án',
      projectCreated:'Đã đăng ký dự án {no}',projectSaveError:'Không thể đăng ký dự án',
      createProject:'Đăng ký dự án',internalNote:'Dự án nội bộ không có khách hàng nên không thể lập đợt xuất hóa đơn tiến độ.',
      completedNote:'Dự án này đã hoàn thành và không thể lập đợt xuất hóa đơn tiến độ mới.',
      claimsPanel:'Hóa Đơn Tiến Độ',claimsEmpty:'Chưa có hóa đơn tiến độ nào.',
      colClaimNo:'Số hóa đơn',colClaimDate:'Ngày',colDescription:'Mô tả',colNet:'Tiền chưa thuế',colTax:'Thuế',colTotal:'Tổng cộng',
      newClaim:'Hóa đơn tiến độ mới',fieldClaimNo:'Số hóa đơn',fieldClaimDate:'Ngày hóa đơn',fieldDescriptionField:'Mô tả',
      descriptionPlaceholder:'vd: Chế tạo hoàn thành 50%',fieldNetAmount:'Tiền chưa thuế',
      descriptionRequired:'Vui lòng nhập mô tả',claimCreated:'Đã tạo hóa đơn tiến độ {no}',
      claimSaveError:'Không thể tạo hóa đơn tiến độ',postClaim:'Ghi sổ',
      claimPosted:'Đã ghi sổ hóa đơn tiến độ {no} — {amount} vào sổ cái',claimPostError:'Không thể ghi sổ hóa đơn tiến độ',
      billingSummary:'Tóm tắt hóa đơn',contractValue:'Giá trị hợp đồng',headroom:'Hạn mức còn lại',
      overBilledIndicator:'Vượt hóa đơn',onTrackIndicator:'Trong hạn mức hợp đồng',
      activityProjectCreated:'Đã đăng ký dự án',activityClaimCreated:'Hóa đơn tiến độ {no} đã lập nháp — {amount}',
      activityClaimPosted:'Hóa đơn tiến độ {no} đã ghi sổ — {amount} vào sổ cái',
      internalProject:'Dự án nội bộ',linkedCustomer:'Khách hàng liên kết',customer360:'Customer 360',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function projectNumber(value){ const parsed=Number(value); return Number.isFinite(parsed)?parsed:0; }

/* PGlite/Drizzle return `date`/`timestamp` columns as JS Date objects, not
   strings — matching screens-fin2.js's financeDateValue, template-literal
   interpolation would otherwise coerce them via Date.prototype.toString()
   ("Wed Mar 04 2026 08:00:00 GMT+0800…") instead of a clean value. */
function projectDateValue(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const text=String(value==null?'':value);
  const match=text.match(/^\d{4}-\d{2}-\d{2}/);
  return match?match[0]:text;
}
function projectDateTimeValue(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())) return value.toISOString().slice(0,16).replace('T',' · ');
  const text=String(value==null?'':value);
  const match=text.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  return match?match[0].replace('T',' · '):text;
}

/* Reuses the mock's original field names (no/name/client/pm/contract/billed/
   start/due/status) so the offline fallback snapshot in data-projects.js
   keeps rendering through the same table/detail code, matching the
   convention established by Fixed Assets/CRM/Inventory. */
async function prepareCanonicalProjectData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(Array.isArray(DB.projects)) return;
    throw new Error('The offline canonical project snapshot is unavailable.');
  }
  const pages=await Promise.all([
    listPage('project/projects'),
    listPage('sales/customers'),
  ]);
  const [projects,customers]=pages.map(p=>p.data);
  const customerById=new Map(customers.map(c=>[c.id,c]));
  /* Refresh DB.customers to the full real shape (incl. id) — mirrors
     screens-crm.js's own prepare function, since DB.customers otherwise
     reflects whichever screen's boot payload last wrote it (the generic
     dashboard payload has no id at all). New Project's customer picker
     needs a real id to link project.customer_id. */
  DB.customers=customers.map(row=>({
    id:row.id, code:row.code, name:row.name, terms:'—', limit:0, balance:0, overdue:0, status:'Active',
  }));
  DB.projects=projects.map(row=>({
    id:row.id,
    no:row.projectNo,
    name:row.name,
    customerId:row.customerId,
    client:row.customerId!=null?(customerById.get(row.customerId)?.name||('Customer #'+row.customerId)):null,
    pm:row.managerName,
    status:row.status,
    start:projectDateValue(row.startDate),
    due:row.dueDate?projectDateValue(row.dueDate):null,
    contract:projectNumber(row.contractValue),
    billed:projectNumber(row.billedToDate),
  }));
  DB.projectReadMeta={ truncated:pages.some(p=>Boolean(p.nextCursor)) };
}

function nextProjectNo(projects){
  let max=0;
  (projects||[]).forEach(p=>{ const m=/(\d+)\s*$/.exec(p.no||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'PRJ-'+new Date().getFullYear()+'-'+String(max+1).padStart(3,'0');
}

/* ---------------- PROJECT PORTFOLIO (listing — module landing) ---------------- */
SCREENS['project-pl'] = async function(root){
  await prepareCanonicalProjectData();
  const s=projectCopy();
  let filter='all';
  const chips=[['all',t('common.all'),null],['customer',ts('Customer'),'accent'],['internal',ts('Internal'),'teal'],['on_hold',ts('On hold'),'warn'],['completed',ts('Completed'),'ok']];
  function rows(){
    return DB.projects.filter(p=>{
      if(filter==='all') return true;
      if(filter==='customer') return p.client!=null;
      if(filter==='internal') return p.client==null;
      if(filter==='on_hold') return p.status==='on_hold';
      if(filter==='completed') return p.status==='completed';
      return true;
    });
  }
  function headroomCell(p){
    const hr=p.contract-p.billed;
    const cls=hr<0?'neg':'pos';
    return `<b class="tnum delta ${cls}">${hr<0?'−':''}${money0(Math.abs(hr))}</b>`;
  }
  function table(){
    return buildTable({
      rowId:p=>p.id,
      columns:[
        {label:t('prj.col.project'),render:p=>`<div class="cellsub"><b class="docnum">${esc(p.no)}</b><small>${esc(p.name)}${p.client?' · '+esc(p.client):''}</small></div>`},
        {label:t('qc.col.type'),align:'l',render:p=>p.client?cap(ts('Customer'),'accent'):cap(ts('Internal'),'teal')},
        {label:t('prj.col.manager'),align:'l',render:p=>esc(p.pm)},
        {label:t('prj.col.contract'),align:'r',render:p=>`<span class="tnum">${money0(p.contract)}</span>`},
        {label:s('colBilled'),align:'r',render:p=>`<span class="tnum">${money0(p.billed)}</span>`},
        {label:t('prj.col.headroom'),align:'r',render:headroomCell},
        {label:t('col.status'),align:'l',render:p=>projectStatusBadge(p.status)},
        {label:'',align:'c',render:()=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const openProjects=DB.projects.filter(p=>p.status==='open');
  const contractTotal=openProjects.reduce((sum,p)=>sum+p.contract,0);
  const billedTotal=DB.projects.reduce((sum,p)=>sum+p.billed,0);
  const headroomTotal=openProjects.reduce((sum,p)=>sum+(p.contract-p.billed),0);
  const overBilled=DB.projects.filter(p=>p.billed>p.contract);

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.project'),t('prj.crumb')])}
      <div class="h1row"><h1>${esc(t('nav.project'))}</h1><span class="countchip" id="prjCount"></span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('prj.kpi.acv'))}</small><b class="tnum">${money0(contractTotal)}</b></div>
          <div class="kfig"><small>${esc(s('colBilled'))}</small><b class="tnum">${money0(billedTotal)}</b></div>
          <div class="kfig"><small>${esc(t('prj.col.headroom'))}</small><b class="tnum">${money0(headroomTotal)}</b></div>
        </div></div>
    </div>
    ${overBilled.length?`<div class="alert warn"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(s('overBilledAlert').replace('{n}',overBilled.length))}</b></span></div>`:''}
    <div class="toolbar">
      <div class="filterchips" id="prjChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('prj.timesheettip'))}" onclick="navigate('timesheet')">${ic('clock')}${esc(t('prj.timesheet'))}</button>
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('prj.new'),{icon:'plus',cls:'primary',attrs:'data-new="1"'})}
    </div>
    <div class="tablewrap" id="prjTable">${table()}</div>
  </section></div>`;
  const wrap=$('#prjTable');
  $('#prjCount').textContent=rows().length+' '+t('prj.projects');
  function openProject(id){ navigate('project-detail',{projectId:Number(id)}); }
  function rewire(){
    wireTable(wrap,{ onRow:openProject });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openProject(b.closest('.dt-r').dataset.row);}));
  }
  rewire();
  $('#prjChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#prjChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#prjCount').textContent=rows().length+' '+t('prj.projects'); rewire();
  }));
  root.querySelector('[data-new]').addEventListener('click',()=>projectForm(s));
};

function projectForm(s){
  const projectNo=nextProjectNo(DB.projects);
  const today=new Date().toISOString().slice(0,10);
  const customers=(DB.customers||[]).slice();
  appModal({
    icon:'plus',
    title:t('prj.new'),
    body:`<div class="set-grid">
      <div class="fld"><span>${esc(s('fieldName'))} <span class="req">*</span></span><input id="pfName" placeholder="${esc(s('namePlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldProjectNo'))}</span><input value="${esc(projectNo)}" readonly><span class="locked">${ic('lock')} ${esc(s('systemNumbered'))}</span></div>
      <div class="fld"><span>${esc(s('fieldCustomer'))}</span><select id="pfCustomer"><option value="">${esc(s('internalOption'))}</option>${customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="fld"><span>${esc(s('fieldManager'))} <span class="req">*</span></span><input id="pfManager" placeholder="${esc(s('managerPlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldStatus'))}</span><select id="pfStatus"><option value="open">${esc(ts('Open'))}</option><option value="on_hold">${esc(ts('On hold'))}</option><option value="completed">${esc(ts('Completed'))}</option></select></div>
      <div class="fld"><span>${esc(s('fieldStartDate'))}</span><input id="pfStart" type="date" value="${today}"></div>
      <div class="fld"><span>${esc(s('fieldDueDate'))} (${esc(s('optional'))})</span><input id="pfDue" type="date"></div>
      <div class="fld"><span>${esc(s('fieldContractValue'))}</span><input id="pfContract" type="number" min="0" step="0.01" class="tnum" value="0"></div>
    </div>`,
    actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('createProject'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const name=$('#pfName').value.trim();
    if(!requireField(name, s('nameRequired'), '#pfName')) return;
    const managerName=$('#pfManager').value.trim();
    if(!requireField(managerName, s('managerRequired'), '#pfManager')) return;
    const customerId=$('#pfCustomer').value?Number($('#pfCustomer').value):null;
    const payload={
      projectNo, name, customerId, managerName,
      status:$('#pfStatus').value, startDate:$('#pfStart').value,
      dueDate:$('#pfDue').value||null, contractValue:Math.max(0,+$('#pfContract').value||0),
    };
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.create('project/projects',payload);
      closeModal();
      toast(s('projectCreated').replace('{no}',projectNo),'ok');
      navigate('project-pl');
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:s('projectSaveError'),'danger');
    }
  });
}

async function prepareProjectDetail(projectId){
  const pages=await Promise.all([
    listPage('project/projects'),
    listPage('sales/customers'),
    listPage('project/progress-claims'),
    listPage('finance/bank-receipts'),
    listPage('purchasing/supplier-invoices'),
    listPage('purchasing/suppliers'),
  ]);
  const [projects,customers,claims,receipts,supplierInvoices,suppliers]=pages.map(p=>p.data);
  const project=projectId?projects.find(row=>row.id===projectId):projects[0];
  if(!project) throw new Error('No project found for the active company.');
  const customer=project.customerId!=null?customers.find(c=>c.id===project.customerId):null;
  const projectClaims=claims.filter(c=>c.projectId===project.id)
    .sort((a,b)=>String(a.claimDate).localeCompare(String(b.claimDate))||a.id-b.id);
  /* doc_no is unique per tenant, not per project — nextClaimNo()/nextReceiptNo() must
     scan every project's own docs, not just this project's, or two projects' first
     documents would both try the same numbered doc_no and the second insert would
     fail on the real unique-index constraint. */
  const receiptedClaimIds=new Set(receipts.map(r=>r.progressClaimId));
  const supplierById=new Map(suppliers.map(row=>[row.id,row]));
  const projectCosts=supplierInvoices.filter(row=>row.projectId===project.id).map(row=>({
    id:row.id,
    docNo:row.docNo,
    supplierName:(supplierById.get(row.supplierId)||{}).name||`Supplier #${row.supplierId}`,
    date:projectDateValue(row.invoiceDate),
    total:projectNumber(row.totalAmount),
    status:row.status,
  })).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return {
    project,customer,claims:projectClaims,allClaims:claims,
    receiptedClaimIds,allReceipts:receipts,projectCosts,
  };
}

function nextClaimNo(claims){
  let max=0;
  (claims||[]).forEach(c=>{ const m=/(\d+)\s*$/.exec(c.docNo||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'PC-'+new Date().getFullYear()+'-'+String(max+1).padStart(4,'0');
}

function nextReceiptNo(receipts){
  let max=0;
  (receipts||[]).forEach(r=>{ const m=/(\d+)\s*$/.exec(r.docNo||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'BR-'+new Date().getFullYear()+'-'+String(max+1).padStart(4,'0');
}

/* ---------------- PROJECT DETAIL (register + progress claims) ---------------- */
SCREENS['project-detail'] = async function(root, params){
  const s=projectCopy();
  const requestedId=params&&params.projectId?Number(params.projectId):null;
  const detail=await prepareProjectDetail(requestedId);
  const {project:p,customer}=detail;
  let claims=detail.claims;
  let allClaims=detail.allClaims;
  let receiptedClaimIds=detail.receiptedClaimIds;
  let allReceipts=detail.allReceipts;
  let projectCosts=detail.projectCosts;

  function renderClaimsRows(){
    if(!claims.length) return `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">${esc(s('claimsEmpty'))}</td></tr>`;
    return claims.map((c,i)=>{
      const receipted=receiptedClaimIds.has(c.id);
      let action='';
      if(c.status==='draft') action=` <button class="btn soft sm" data-post="${c.id}">${esc(s('postClaim'))}</button>`;
      else if(c.status==='posted') action=receipted
        ?` ${cap('Receipted','ok')}`
        :` <button class="btn soft sm" data-receipt="${c.id}">Record receipt</button>`;
      return `<tr>
      <td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(c.docNo)}</b><small>${esc(projectDateValue(c.claimDate))}</small></td>
      <td class="l">${esc(c.description)}</td>
      <td class="tnum">${money0(projectNumber(c.netAmount))}</td>
      <td class="tnum" style="color:var(--muted)">${money0(projectNumber(c.taxAmount))}</td>
      <td class="tnum"><b>${money0(projectNumber(c.totalAmount))}</b></td>
      <td class="l">${statusBadge(c.status==='posted'?'Posted':'Draft')}${action}</td>
    </tr>`;}).join('');
  }

  const canBill=project_canBill(p);
  function project_canBill(project){ return project.customerId!=null && project.status!=='completed'; }

  const contract=projectNumber(p.contractValue), billed=projectNumber(p.billedToDate), headroom=contract-billed;
  const overBilled=billed>contract;

  const activities=[];
  activities.push({kind:'add',when:p.createdAt?projectDateTimeValue(p.createdAt):'',what:s('activityProjectCreated'),who:esc(p.managerName)});
  claims.forEach(c=>{
    activities.push({kind:'add',when:c.createdAt?projectDateTimeValue(c.createdAt):'',
      what:s('activityClaimCreated').replace('{no}',esc(c.docNo)).replace('{amount}',money0(projectNumber(c.totalAmount))),who:esc(p.managerName)});
    if(c.status==='posted'){
      activities.push({kind:'current',when:c.updatedAt?projectDateTimeValue(c.updatedAt):'',
        what:s('activityClaimPosted').replace('{no}',esc(c.docNo)).replace('{amount}',money0(projectNumber(c.totalAmount))),who:esc(p.managerName)});
    }
  });
  activities.reverse();

  function render(){
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,{label:t('nav.project'),route:'project-pl'},t('prj.crumb'),{cur:p.projectNo}])}
        <div class="dochead">
          <div class="dh-row1">
            <div>
              <div class="dt">${ic('project')}${esc(p.name)} <span class="dnum">${esc(p.projectNo)}</span></div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">${customer?esc(customer.name):esc(s('internalProject'))} · ${esc(p.managerName)} · ${esc(projectDateValue(p.startDate))}${p.dueDate?' → '+esc(projectDateValue(p.dueDate)):''}</div>
            </div>
            <div class="dactions">${projectStatusBadge(p.status)}${customer?btn(s('customer360'),{icon:'user',cls:'soft',attrs:'onclick="navigate(\'crm-customer\')"'}):''}</div>
          </div>
          <div class="docmeta">
            <div class="dm"><small>${esc(s('contractValue'))}</small><b>${money0(contract)}</b></div>
            <div class="dm"><small>${esc(s('colBilled'))}</small><b>${money0(billed)}</b></div>
            <div class="dm"><small>${esc(s('headroom'))}</small><b style="color:${headroom<0?'var(--danger)':'var(--fg)'}">${headroom<0?'−':''}${money0(Math.abs(headroom))}</b></div>
            <div class="dm"><small>${esc(t('col.status'))}</small><b>${esc(ts(PROJECT_STATUS_LABEL[p.status]||p.status))}</b></div>
          </div>
        </div>

        <div class="appr-layout">
          <div class="docmain">
            <div class="panel">
              <div class="panel-h"><h3>${esc(s('claimsPanel'))}</h3>
                <span style="margin-left:auto">${canBill?btn(s('newClaim'),{icon:'plus',cls:'soft',attrs:'data-new-claim="1"'}):''}</span>
              </div>
              ${!canBill?`<div style="padding:0 16px 12px;font-size:12.5px;color:var(--muted)">${esc(p.status==='completed'?s('completedNote'):s('internalNote'))}</div>`:''}
              <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('colClaimNo'))}</th><th class="l">${esc(s('colDescription'))}</th><th>${esc(s('colNet'))}</th><th>${esc(s('colTax'))}</th><th>${esc(s('colTotal'))}</th><th class="l">${esc(t('col.status'))}</th></tr></thead>
              <tbody>${renderClaimsRows()}</tbody></table>
            </div>
            <div class="panel">
              <div class="panel-h"><h3>${esc(t('doc.activity'))}</h3></div>
              <div class="panel-body">${auditTrail(activities)}</div>
            </div>
          </div>

          <aside>
            <div class="sumcard" style="margin-bottom:14px">
              <div class="sectitle" style="margin-top:0">${esc(s('billingSummary'))}</div>
              <div class="sumrow"><span class="sk2">${esc(s('contractValue'))}</span><span class="sv tnum">${money0(contract)}</span></div>
              <div class="sumrow"><span class="sk2">${esc(s('colBilled'))}</span><span class="sv tnum">${money0(billed)}</span></div>
              <div class="sumrow total"><span class="sk2">${esc(s('headroom'))}</span><span class="sv tnum" style="color:${headroom<0?'var(--danger)':'var(--ok)'}">${headroom<0?'−':''}${money0(Math.abs(headroom))}</span></div>
              <div class="indicator ${overBilled?'danger':'ok'}" style="margin-top:12px">
                <div class="ind-top">${ic('percent')}<span>${esc(overBilled?s('overBilledIndicator'):s('onTrackIndicator'))}</span><span class="ind-r">${contract?Math.round(billed/contract*100):0}%</span></div>
                <div class="track"><i style="width:${contract?Math.min(100,Math.round(billed/contract*100)):0}%"></i></div>
              </div>
            </div>
            <div class="sumcard">
              <div class="sectitle" style="margin-top:0">Related</div>
              ${customer
                ?relatedDocs([{no:customer.code||('CUST-'+customer.id),label:s('linkedCustomer'),meta:customer.name,status:'Active'}])
                :`<div style="color:var(--muted);font-size:13px">${esc(s('internalProject'))}</div>`}
            </div>
            <div class="sumcard">
              <div class="sectitle" style="margin-top:0">Project costs</div>
              ${projectCosts.length
                ?relatedDocs(projectCosts.map(c=>({no:c.docNo,label:c.supplierName,meta:money0(c.total),status:c.status==='paid'?'Paid':'Approved'})))
                :`<div style="color:var(--muted);font-size:13px">No supplier invoices tagged to this project yet — tag a project when creating a purchase order.</div>`}
              ${projectCosts.length?`<div class="sumrow total" style="margin-top:8px"><span class="sk2">Total</span><span class="sv tnum">${money0(projectCosts.reduce((sum,c)=>sum+c.total,0))}</span></div>`:''}
            </div>
          </aside>
        </div>
      </div></div>

      <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
        <div class="grow"></div>
        ${btn(t('prj.timesheet'),{icon:'clock',cls:'soft',attrs:'onclick="navigate(\'timesheet\')"'})}
      </div>
    </section></div>`;
    wire();
  }

  function wire(){
    root.querySelectorAll('[data-post]').forEach(b=>b.addEventListener('click',async()=>{
      b.disabled=true;
      const claimId=Number(b.dataset.post);
      const claim=claims.find(c=>c.id===claimId);
      try{
        await window.ErpSystemData.action('project/progress-claims',claimId,'post',{},`post-progress-claim-${claimId}`);
        toast(s('claimPosted').replace('{no}',claim.docNo).replace('{amount}',money0(projectNumber(claim.totalAmount))),'ok');
        const refreshed=await prepareProjectDetail(p.id);
        claims=refreshed.claims;
        allClaims=refreshed.allClaims;
        Object.assign(p,refreshed.project);
        navigate('project-detail',{projectId:p.id});
      }catch(error){
        toast(error&&error.message?error.message:s('claimPostError'),'danger');
        b.disabled=false;
      }
    }));
    const newClaimBtn=root.querySelector('[data-new-claim]');
    newClaimBtn&&newClaimBtn.addEventListener('click',()=>progressClaimForm(s,p,allClaims,async()=>{
      const refreshed=await prepareProjectDetail(p.id);
      claims=refreshed.claims;
      allClaims=refreshed.allClaims;
      Object.assign(p,refreshed.project);
      navigate('project-detail',{projectId:p.id});
    }));
    root.querySelectorAll('[data-receipt]').forEach(b=>b.addEventListener('click',()=>{
      const claim=claims.find(c=>c.id===Number(b.dataset.receipt));
      recordReceiptForm(claim,allReceipts,async()=>{
        const refreshed=await prepareProjectDetail(p.id);
        claims=refreshed.claims;
        allClaims=refreshed.allClaims;
        receiptedClaimIds=refreshed.receiptedClaimIds;
        allReceipts=refreshed.allReceipts;
        projectCosts=refreshed.projectCosts;
        navigate('project-detail',{projectId:p.id});
      });
    }));
  }

  render();
};

function progressClaimForm(s,project,allClaims,onSaved){
  const docNo=nextClaimNo(allClaims);
  const today=new Date().toISOString().slice(0,10);
  appModal({
    icon:'receipt',
    title:s('newClaim')+' — '+project.projectNo,
    body:`<div class="set-grid">
      <div class="fld"><span>${esc(s('fieldClaimNo'))}</span><input value="${esc(docNo)}" readonly><span class="locked">${ic('lock')} ${esc(s('systemNumbered'))}</span></div>
      <div class="fld"><span>${esc(s('fieldClaimDate'))}</span><input id="cfDate" type="date" value="${today}"></div>
      <div class="fld" style="grid-column:1/-1"><span>${esc(s('fieldDescriptionField'))} <span class="req">*</span></span><input id="cfDesc" placeholder="${esc(s('descriptionPlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldNetAmount'))}</span><input id="cfNet" type="number" min="0" step="0.01" class="tnum" value="0"></div>
    </div>`,
    actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('newClaim'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const description=$('#cfDesc').value.trim();
    if(!requireField(description, s('descriptionRequired'), '#cfDesc')) return;
    const payload={
      docNo, projectId:project.id, claimDate:$('#cfDate').value, description,
      netAmount:Math.max(0,+$('#cfNet').value||0),
      taxCode:(DB.company&&DB.company.taxRegime==='SST')?'SV':'SR',
    };
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.create('project/progress-claims',payload);
      closeModal();
      toast(s('claimCreated').replace('{no}',docNo),'ok');
      await onSaved();
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:s('claimSaveError'),'danger');
    }
  });
}

/* Bank Receipt against a posted progress claim's AR (EPIC-024) — one receipt per
   claim, full amount only, mirroring createBankReceiptWithin's own full-settlement
   shape. Amount is locked to the claim's real total since the backend requires an
   exact match. */
function recordReceiptForm(claim,allReceipts,onSaved){
  const docNo=nextReceiptNo(allReceipts);
  const today=new Date().toISOString().slice(0,10);
  const total=projectNumber(claim.totalAmount);
  appModal({
    icon:'bank',
    title:'Record receipt — '+claim.docNo,
    body:`<div class="set-grid">
      <div class="fld"><span>Receipt no.</span><input value="${esc(docNo)}" readonly><span class="locked">${ic('lock')} System-numbered</span></div>
      <div class="fld"><span>Received date</span><input id="brDate" type="date" value="${today}"></div>
      <div class="fld"><span>Bank reference (optional)</span><input id="brRef" placeholder="e.g. HSBC TT-88213"></div>
      <div class="fld"><span>Amount</span><input value="${money0(total)}" readonly><span class="locked">${ic('lock')} Full claim total</span></div>
    </div>`,
    actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Record receipt',{icon:'check',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const receivedDate=$('#brDate').value;
    if(!requireField(receivedDate,'Received date is required','#brDate')) return;
    const payload={
      docNo, progressClaimId:claim.id, receivedDate,
      bankRef:$('#brRef').value.trim()||null, amount:claim.totalAmount,
    };
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.create('finance/bank-receipts',payload);
      closeModal();
      toast(`Receipt ${docNo} recorded for ${claim.docNo}`,'ok');
      await onSaved();
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:'Receipt could not be recorded','danger');
    }
  });
}

/* ---------------- TIMESHEET (weekly grid) ---------------- */
SCREENS['timesheet'] = function(root){
  const t=DB.timesheet;
  const rowTot=r=>r.h.reduce((s,h)=>s+h,0);
  const dayTot=di=>t.rows.reduce((s,r)=>s+r.h[di],0);
  const grand=t.rows.reduce((s,r)=>s+rowTot(r),0);
  function cell(v){ return `<input class="lineinput" style="text-align:center" value="${v?v:''}" placeholder="·">`; }
  const bodyRows=t.rows.map(r=>`<tr>
      <td class="l li-name"><b>${esc(r.proj)}</b><small>${esc(r.task)}</small></td>
      ${r.h.map(h=>`<td class="c">${cell(h)}</td>`).join('')}
      <td class="tnum"><b>${rowTot(r).toFixed(1)}</b></td>
    </tr>`).join('');
  const footCells=t.days.map((_,di)=>{ const dv=dayTot(di); return `<td class="c tnum" style="color:${dv>8?'var(--warn)':'var(--muted)'}">${dv?dv.toFixed(1):'—'}</td>`; }).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,'Projects','Timesheet'])}
      <div class="h1row"><h1>Timesheet</h1><span class="countchip">${esc(t.status)}</span>
        <div class="headright">
          <div class="kfig"><small>Logged this week</small><b class="tnum">${grand.toFixed(1)} h</b></div>
          <div class="kfig"><small>Capacity</small><b class="tnum">${t.capacity} h</b></div>
        </div></div>
    </div>
    <div class="toolbar">
      <button class="viewsel" data-tip="Previous week" onclick="toast('Previous week','info')">${ic('chevL')}</button>
      <button class="viewsel" style="font-weight:600">${ic('calendar')}${esc(t.week)}</button>
      <button class="viewsel" data-tip="Next week" onclick="toast('Next week','info')">${ic('chevR')}</button>
      <div class="grow"></div>
      ${btn('Copy last week',{icon:'copy',cls:'soft',attrs:'onclick="toast(\'Last week copied\',\'ok\')"'})}
      ${btn('Add line',{icon:'plus',cls:'soft',attrs:'onclick="toast(\'Add a project line\',\'info\')"'})}
      ${btn('Submit for approval',{icon:'check',cls:'primary',attrs:'data-act="submit"'})}
    </div>
    <div class="docpage" style="max-width:none;margin:0;padding:0;border:none;background:transparent">
      <div class="panel">
        <div class="panel-h"><h3>${esc(t.employee)} · ${esc(t.week)}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${t.rows.length} lines</span></div>
        <table class="lines tssheet">
          <thead><tr><th class="l">Project / Task</th>${t.days.map(d=>`<th class="c">${d}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>${bodyRows}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Daily total</td>${footCells}<td class="tnum"><b>${grand.toFixed(1)}</b></td></tr></tfoot>
        </table>
      </div>
      <div style="max-width:420px;margin-top:14px">
        <div class="indicator ${grand>t.capacity?'warn':'ok'}">
          <div class="ind-top">${ic('clock')}<span>Utilisation</span><span class="ind-r">${Math.round(grand/t.capacity*100)}%</span></div>
          <div class="track"><i style="width:${Math.min(100,grand/t.capacity*100)}%"></i></div>
          <small>${grand.toFixed(1)} h logged of ${t.capacity} h capacity · ${(t.capacity-grand).toFixed(1)} h remaining.</small>
        </div>
      </div>
      <div style="height:40px"></div>
    </div>
  </section></div>`;

  root.querySelector('[data-act="submit"]').addEventListener('click',()=>{
    toast('Timesheet submitted for approval','ok');
  });
};
