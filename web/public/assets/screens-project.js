/* ============================================================
   ARIA ERP — screens: Projects (portfolio, project detail, timesheet)
   project-pl/project-detail are wired to real project/progress_claim data;
   timesheet uses actor-owned project_time_entry facts with audited voids.
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
    start:dateValue(row.startDate),
    due:row.dueDate?dateValue(row.dueDate):null,
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
  const chips=[['all',t('common.all'),null],['customer',ts('Customer'),'accent'],['internal',ts('Internal'),'teal'],['on_hold',ts('On hold'),'warn'],['completed',ts('Completed'),'ok']];
  function matches(p,filter){
    if(filter==='customer') return p.client!=null;
    if(filter==='internal') return p.client==null;
    if(filter==='on_hold') return p.status==='on_hold';
    if(filter==='completed') return p.status==='completed';
    return true;
  }
  function headroomCell(p){
    const hr=p.contract-p.billed;
    const cls=hr<0?'neg':'pos';
    return `<b class="tnum delta ${cls}">${hr<0?'−':''}${money0(Math.abs(hr))}</b>`;
  }
  const openProjects=DB.projects.filter(p=>p.status==='open');
  const contractTotal=openProjects.reduce((sum,p)=>sum+p.contract,0);
  const billedTotal=DB.projects.reduce((sum,p)=>sum+p.billed,0);
  const headroomTotal=openProjects.reduce((sum,p)=>sum+(p.contract-p.billed),0);
  const overBilled=DB.projects.filter(p=>p.billed>p.contract);

  transactionListPage(root,{
    module:'project',route:'project-pl',title:t('nav.project'),
    rows:DB.projects,rowId:p=>p.id,
    filters:chips.map(([key,label])=>[key,label]),filterFn:matches,
    kpis:[
      {label:t('prj.kpi.acv'),value:money0(contractTotal)},
      {label:s('colBilled'),value:money0(billedTotal)},
      {label:t('prj.col.headroom'),value:money0(headroomTotal),negative:headroomTotal<0},
      {label:s('overBilledAlert').replace('{n}',overBilled.length),value:overBilled.length,negative:overBilled.length>0},
    ],
    primaryAction:{label:t('prj.new'),icon:'plus',onClick:()=>projectForm(s)},
    toolbarActions:[{label:t('prj.timesheet'),icon:'clock',onClick:()=>navigate('timesheet')}],
    columns:[
      {label:t('prj.col.project'),render:p=>`<div class="cellsub"><b class="docnum">${esc(p.no)}</b><small>${esc(p.name)}${p.client?' · '+esc(p.client):''}</small></div>`},
      {label:t('qc.col.type'),align:'l',render:p=>p.client?cap(ts('Customer'),'accent'):cap(ts('Internal'),'teal')},
      {label:t('prj.col.manager'),align:'l',render:p=>esc(p.pm)},
      {label:t('prj.col.contract'),align:'r',render:p=>`<span class="tnum">${money0(p.contract)}</span>`},
      {label:s('colBilled'),align:'r',render:p=>`<span class="tnum">${money0(p.billed)}</span>`},
      {label:t('prj.col.headroom'),align:'r',render:headroomCell},
      {label:t('col.status'),align:'l',render:p=>projectStatusBadge(p.status)},
    ],
    onOpen:p=>navigate('project-detail',{projectId:Number(p.id)}),
    empty:{icon:'project',title:'No projects'},
  });
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
    .sort((a,b)=>dateValue(a.claimDate).localeCompare(dateValue(b.claimDate))||a.id-b.id);
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
    date:dateValue(row.invoiceDate),
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
      <td class="l li-name"><b>${esc(c.docNo)}</b><small>${esc(dateValue(c.claimDate))}</small></td>
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
  activities.push({kind:'add',when:p.createdAt?dateTimeValue(p.createdAt):'',what:s('activityProjectCreated'),who:esc(p.managerName)});
  claims.forEach(c=>{
    activities.push({kind:'add',when:c.createdAt?dateTimeValue(c.createdAt):'',
      what:s('activityClaimCreated').replace('{no}',esc(c.docNo)).replace('{amount}',money0(projectNumber(c.totalAmount))),who:esc(p.managerName)});
    if(c.status==='posted'){
      activities.push({kind:'current',when:c.updatedAt?dateTimeValue(c.updatedAt):'',
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
              <div style="color:var(--muted);font-size:13px;margin-top:4px">${customer?esc(customer.name):esc(s('internalProject'))} · ${esc(p.managerName)} · ${esc(dateValue(p.startDate))}${p.dueDate?' → '+esc(dateValue(p.dueDate)):''}</div>
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

/* ---------------- TIMESHEET (Canonical user-owned time facts) ---------------- */
function timesheetCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      title:'Timesheet',sub:'Your audited project time facts for {week}. Voided entries remain visible.',
      previous:'Previous week',next:'Next week',current:'Current week',add:'Log time',
      total:'Active hours',projects:'Projects',days:'Days worked',entries:'entries',
      date:'Date',project:'Project',task:'Task',hours:'Hours',status:'Status',action:'Action',
      active:'Active',voided:'Voided',empty:'No time logged for this week',
      emptyBody:'Log time against an open project. Approval and payroll are separate workflows and are not fabricated here.',
      loading:'Loading your timesheet…',loadError:'Timesheet could not be loaded',retry:'Retry',
      formTitle:'Log project time',selectProject:'Select an open project',workDate:'Work date',
      taskPlaceholder:'e.g. Commissioning review',hoursHint:'0.01–24.00 hours',
      projectRequired:'Choose a project.',dateRequired:'Choose a work date.',taskRequired:'Enter a task.',
      hoursRequired:'Enter hours greater than 0 and no more than 24.',created:'Time entry saved.',
      createError:'Time entry could not be saved.',noOpen:'No open project is available for time entry.',
      void:'Void',voidTitle:'Void time entry',voidBody:'The original hours stay in the audit history and no longer count toward totals.',
      reason:'Reason',reasonPlaceholder:'e.g. Logged to the wrong work package',reasonRequired:'Enter a void reason.',
      confirmVoid:'Void entry',voidedToast:'Time entry voided.',voidError:'Time entry could not be voided.',
      owner:'Signed-in user',bounded:'This weekly view is bounded to 100 entries.',
    },
    ms:{
      title:'Lembaran masa',sub:'Fakta masa projek anda yang diaudit untuk {week}. Entri dibatalkan kekal kelihatan.',
      previous:'Minggu sebelumnya',next:'Minggu seterusnya',current:'Minggu semasa',add:'Log masa',
      total:'Jam aktif',projects:'Projek',days:'Hari bekerja',entries:'entri',
      date:'Tarikh',project:'Projek',task:'Tugas',hours:'Jam',status:'Status',action:'Tindakan',
      active:'Aktif',voided:'Dibatalkan',empty:'Tiada masa direkod untuk minggu ini',
      emptyBody:'Log masa kepada projek terbuka. Kelulusan dan gaji ialah aliran berasingan dan tidak direka di sini.',
      loading:'Memuatkan lembaran masa…',loadError:'Lembaran masa tidak dapat dimuatkan',retry:'Cuba lagi',
      formTitle:'Log masa projek',selectProject:'Pilih projek terbuka',workDate:'Tarikh kerja',
      taskPlaceholder:'cth. Semakan pentauliahan',hoursHint:'0.01–24.00 jam',
      projectRequired:'Pilih projek.',dateRequired:'Pilih tarikh kerja.',taskRequired:'Masukkan tugas.',
      hoursRequired:'Masukkan jam melebihi 0 dan tidak melebihi 24.',created:'Entri masa disimpan.',
      createError:'Entri masa tidak dapat disimpan.',noOpen:'Tiada projek terbuka untuk entri masa.',
      void:'Batal',voidTitle:'Batalkan entri masa',voidBody:'Jam asal kekal dalam sejarah audit dan tidak lagi dikira.',
      reason:'Sebab',reasonPlaceholder:'cth. Dilog kepada pakej kerja yang salah',reasonRequired:'Masukkan sebab pembatalan.',
      confirmVoid:'Batalkan entri',voidedToast:'Entri masa dibatalkan.',voidError:'Entri masa tidak dapat dibatalkan.',
      owner:'Pengguna log masuk',bounded:'Paparan mingguan ini dihadkan kepada 100 entri.',
    },
    zh:{
      title:'工时表',sub:'{week} 的个人项目工时审计记录。作废记录仍会保留显示。',
      previous:'上一周',next:'下一周',current:'本周',add:'记录工时',
      total:'有效工时',projects:'项目',days:'工作天数',entries:'条记录',
      date:'日期',project:'项目',task:'任务',hours:'小时',status:'状态',action:'操作',
      active:'有效',voided:'已作废',empty:'本周尚无工时记录',
      emptyBody:'请将工时记录到开放项目。审批和薪资属于独立流程，此处不会虚构。',
      loading:'正在加载工时表…',loadError:'无法加载工时表',retry:'重试',
      formTitle:'记录项目工时',selectProject:'选择开放项目',workDate:'工作日期',
      taskPlaceholder:'例如：调试验收评审',hoursHint:'0.01–24.00 小时',
      projectRequired:'请选择项目。',dateRequired:'请选择工作日期。',taskRequired:'请输入任务。',
      hoursRequired:'工时必须大于 0 且不超过 24。',created:'工时记录已保存。',
      createError:'无法保存工时记录。',noOpen:'当前没有可记录工时的开放项目。',
      void:'作废',voidTitle:'作废工时记录',voidBody:'原始工时会保留在审计历史中，但不再计入合计。',
      reason:'原因',reasonPlaceholder:'例如：记录到了错误的工作包',reasonRequired:'请输入作废原因。',
      confirmVoid:'确认作废',voidedToast:'工时记录已作废。',voidError:'无法作废工时记录。',
      owner:'当前登录用户',bounded:'本周视图最多显示 100 条记录。',
    },
    ja:{
      title:'タイムシート',sub:'{week} の監査可能なプロジェクト工数です。無効化した記録も表示されます。',
      previous:'前週',next:'次週',current:'今週',add:'工数を記録',
      total:'有効時間',projects:'プロジェクト',days:'作業日数',entries:'件',
      date:'日付',project:'プロジェクト',task:'作業',hours:'時間',status:'状態',action:'操作',
      active:'有効',voided:'無効',empty:'この週の工数はありません',
      emptyBody:'進行中のプロジェクトに工数を記録します。承認と給与は別のワークフローです。',
      loading:'タイムシートを読み込み中…',loadError:'タイムシートを読み込めません',retry:'再試行',
      formTitle:'プロジェクト工数を記録',selectProject:'進行中のプロジェクトを選択',workDate:'作業日',
      taskPlaceholder:'例：試運転レビュー',hoursHint:'0.01～24.00 時間',
      projectRequired:'プロジェクトを選択してください。',dateRequired:'作業日を選択してください。',taskRequired:'作業を入力してください。',
      hoursRequired:'0 より大きく 24 以下の時間を入力してください。',created:'工数を保存しました。',
      createError:'工数を保存できませんでした。',noOpen:'工数を記録できる進行中のプロジェクトがありません。',
      void:'無効化',voidTitle:'工数を無効化',voidBody:'元の時間は監査履歴に残り、合計から除外されます。',
      reason:'理由',reasonPlaceholder:'例：誤った作業パッケージに記録',reasonRequired:'無効化の理由を入力してください。',
      confirmVoid:'無効化する',voidedToast:'工数を無効化しました。',voidError:'工数を無効化できませんでした。',
      owner:'ログインユーザー',bounded:'週次表示は 100 件までです。',
    },
    vi:{
      title:'Bảng chấm công',sub:'Dữ liệu thời gian dự án có kiểm toán của bạn cho {week}. Mục hủy vẫn được hiển thị.',
      previous:'Tuần trước',next:'Tuần sau',current:'Tuần hiện tại',add:'Ghi thời gian',
      total:'Giờ hiệu lực',projects:'Dự án',days:'Ngày làm việc',entries:'mục',
      date:'Ngày',project:'Dự án',task:'Công việc',hours:'Giờ',status:'Trạng thái',action:'Thao tác',
      active:'Hiệu lực',voided:'Đã hủy',empty:'Chưa có thời gian trong tuần này',
      emptyBody:'Ghi thời gian vào dự án đang mở. Phê duyệt và lương là quy trình riêng, không được giả lập ở đây.',
      loading:'Đang tải bảng chấm công…',loadError:'Không thể tải bảng chấm công',retry:'Thử lại',
      formTitle:'Ghi thời gian dự án',selectProject:'Chọn dự án đang mở',workDate:'Ngày làm việc',
      taskPlaceholder:'vd. Đánh giá chạy thử',hoursHint:'0.01–24.00 giờ',
      projectRequired:'Hãy chọn dự án.',dateRequired:'Hãy chọn ngày làm việc.',taskRequired:'Hãy nhập công việc.',
      hoursRequired:'Giờ phải lớn hơn 0 và không quá 24.',created:'Đã lưu thời gian.',
      createError:'Không thể lưu thời gian.',noOpen:'Không có dự án đang mở để ghi thời gian.',
      void:'Hủy',voidTitle:'Hủy mục thời gian',voidBody:'Giờ ban đầu vẫn nằm trong lịch sử kiểm toán và không còn tính vào tổng.',
      reason:'Lý do',reasonPlaceholder:'vd. Ghi nhầm gói công việc',reasonRequired:'Hãy nhập lý do hủy.',
      confirmVoid:'Hủy mục',voidedToast:'Đã hủy mục thời gian.',voidError:'Không thể hủy mục thời gian.',
      owner:'Người dùng đăng nhập',bounded:'Chế độ xem tuần giới hạn 100 mục.',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function timesheetAddDays(iso,days){
  const date=new Date(iso+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}
function timesheetWeekStart(value){
  let date=/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))
    ?new Date(String(value)+'T00:00:00Z'):new Date();
  if(Number.isNaN(date.getTime())) date=new Date();
  const mondayOffset=(date.getUTCDay()+6)%7;
  date.setUTCDate(date.getUTCDate()-mondayOffset);
  return date.toISOString().slice(0,10);
}
function timesheetDateLabel(iso,includeYear){
  const lang=typeof getLang==='function'?getLang():'en';
  const locale={en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'}[lang]||'en-SG';
  const normalized=typeof dateValue==='function'?dateValue(iso):String(iso||'').slice(0,10);
  return new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:includeYear?'numeric':undefined,timeZone:'UTC'})
    .format(new Date(normalized+'T00:00:00Z'));
}
function timesheetWeekLabel(start,end){
  return `${timesheetDateLabel(start,false)} – ${timesheetDateLabel(end,true)}`;
}
async function timesheetList(resource,query){
  const response=await window.ErpSystemData.list(resource,query||{});
  return Array.isArray(response)?response:(response&&Array.isArray(response.data)?response.data:[]);
}

SCREENS['timesheet'] = function(root,params){
  const s=timesheetCopy();
  const weekStart=timesheetWeekStart(params&&params.weekStart);
  const weekEnd=timesheetAddDays(weekStart,6);
  const weekLabel=timesheetWeekLabel(weekStart,weekEnd);
  const routeStillActive=()=>CURRENT_ROUTE==='timesheet'&&root.isConnected;

  async function load(){
    renderList({status:'loading'});
    try{
      const [entries,projects,session]=await Promise.all([
        timesheetList('project/time-entries',{from:weekStart,to:weekEnd,limit:100}),
        timesheetList('project/projects',{limit:100}),
        window.ErpSystemData.session(),
      ]);
      if(!routeStillActive()) return;
      renderList({status:'ready',entries,projects,session:session||{}});
    }catch(error){
      if(!routeStillActive()) return;
      renderList({status:'error',error});
    }
  }

  function renderList({status,entries=[],projects=[],session={},error=null}){
    const ready=status==='ready';
    const projectById=new Map(projects.map(project=>[Number(project.id),project]));
    const openProjects=projects.filter(project=>project.status==='open');
    const activeEntries=entries.filter(entry=>entry.status==='active');
    const totalHours=activeEntries.reduce((sum,entry)=>sum+(Number(entry.hours)||0),0);
    const projectCount=new Set(activeEntries.map(entry=>Number(entry.projectId))).size;
    const dayCount=new Set(activeEntries.map(entry=>entry.workDate)).size;
    const ownerName=session.fullName||(session.user&&session.user.name)||(DB.user&&DB.user.name)||s('owner');
    const rows=entries.slice().sort((a,b)=>dateValue(a.workDate).localeCompare(dateValue(b.workDate))||Number(a.id)-Number(b.id));
    const empty=status==='loading'
      ?{icon:'clock',title:s('loading'),description:weekLabel}
      :status==='error'
        ?{icon:'alert',title:s('loadError'),description:error&&error.message?error.message:s('loadError')}
        :{icon:'clock',title:s('empty'),description:s('emptyBody')};
    const toolbarContent=`<div class="filterchips" data-ts-week-controls>
      <button class="viewsel" data-ts-week="${timesheetAddDays(weekStart,-7)}"
        data-tip="${esc(s('previous'))}" aria-label="${esc(s('previous'))}">${ic('chevL')}</button>
      <span class="viewsel" data-ts-week-label>${ic('calendar')}${esc(weekLabel)}</span>
      <button class="viewsel" data-ts-week="${timesheetAddDays(weekStart,7)}"
        data-tip="${esc(s('next'))}" aria-label="${esc(s('next'))}">${ic('chevR')}</button>
      <button class="viewsel" data-ts-current>${esc(s('current'))}</button>
    </div>`;

    transactionListPage(root,{
      module:'project',route:'timesheet',active:'timesheet',title:s('title'),
      description:s('sub').replace('{week}',weekLabel),
      rows,rowId:entry=>entry.id,count:ready?activeEntries.length:0,
      kpis:ready?[
        {label:s('total'),value:`${totalHours.toFixed(2)} h`},
        {label:s('projects'),value:projectCount},
        {label:s('days'),value:dayCount},
      ]:[],
      note:`${ownerName} · ${s('bounded')}`,
      toolbarContent,
      toolbarActions:status==='error'
        ?[{label:s('retry'),icon:'refresh',onClick:load}]
        :[],
      primaryAction:{
        label:s('add'),icon:'plus',
        disabled:!ready||!openProjects.length,
        onClick:()=>openCreate(openProjects),
      },
      columns:[
        {label:s('date'),align:'l',render:entry=>`<span class="tnum">${esc(timesheetDateLabel(entry.workDate,false))}</span>`},
        {label:s('project'),align:'l',render:entry=>{
          const project=projectById.get(Number(entry.projectId));
          return `<div class="cellsub"><b class="docnum">${esc(project&&project.projectNo||'#'+entry.projectId)}</b><small>${esc(project&&project.name||'')}</small></div>`;
        }},
        {label:s('task'),align:'l',render:entry=>esc(entry.task)},
        {label:s('hours'),align:'r',render:entry=>`<b class="tnum">${Number(entry.hours).toFixed(2)}</b>`},
        {label:s('status'),align:'l',render:entry=>cap(entry.status==='active'?s('active'):s('voided'),entry.status==='active'?'ok':'neutral')},
        {label:s('action'),align:'c',render:entry=>entry.status==='active'
          ?transactionRowMenuButton(s('action'))
          :`<span class="muted" title="${esc(entry.voidReason||'')}">—</span>`},
      ],
      rowMenu:entry=>entry.status==='active'?[
        {id:'void',label:s('void'),icon:'x',danger:true,run:()=>openVoid(Number(entry.id),Number(entry.version))},
      ]:[],
      empty,
      afterRender:()=>{
        const listRoot=root.querySelector('[data-list-route="timesheet"]');
        if(ready) listRoot?.setAttribute('data-canonical-timesheet','true');
        root.querySelectorAll('[data-ts-week]').forEach(button=>button.addEventListener('click',()=>{
          navigate('timesheet',{weekStart:button.dataset.tsWeek});
        }));
        root.querySelector('[data-ts-current]')?.addEventListener('click',()=>navigate('timesheet'));
      },
    });
  }

  function openCreate(openProjects){
    if(!openProjects.length){ toast(s('noOpen'),'warn'); return; }
    const today=new Date().toISOString().slice(0,10);
    const defaultDate=today>=weekStart&&today<=weekEnd?today:weekStart;
    appModal({
      icon:'clock',title:s('formTitle'),
      body:`<div class="set-grid">
        <label class="fld" style="grid-column:1/-1"><span>${esc(s('project'))} <span class="req">*</span></span>
          <select id="tsProject"><option value="">${esc(s('selectProject'))}</option>${openProjects.map(project=>`<option value="${project.id}">${esc(project.projectNo)} · ${esc(project.name)}</option>`).join('')}</select></label>
        <label class="fld"><span>${esc(s('workDate'))} <span class="req">*</span></span><input id="tsDate" type="date" min="${weekStart}" max="${weekEnd}" value="${defaultDate}"></label>
        <label class="fld"><span>${esc(s('hours'))} <span class="req">*</span></span><input id="tsHours" type="number" min="0.01" max="24" step="0.25" value="1.00"><span class="hint">${esc(s('hoursHint'))}</span></label>
        <label class="fld" style="grid-column:1/-1"><span>${esc(s('task'))} <span class="req">*</span></span><input id="tsTask" maxlength="200" placeholder="${esc(s('taskPlaceholder'))}"></label>
      </div>`,
      actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('add'),{icon:'plus',cls:'primary',attrs:'data-ts-save'})}`,
    });
    const save=$('#modalEl').querySelector('[data-ts-save]');
    save.addEventListener('click',async()=>{
      const projectId=Number($('#tsProject').value);
      const workDate=$('#tsDate').value;
      const task=$('#tsTask').value.trim();
      const hours=$('#tsHours').value.trim();
      if(!Number.isSafeInteger(projectId)||projectId<=0){ toast(s('projectRequired'),'warn'); $('#tsProject').focus(); return; }
      if(!workDate||workDate<weekStart||workDate>weekEnd){ toast(s('dateRequired'),'warn'); $('#tsDate').focus(); return; }
      if(!task){ toast(s('taskRequired'),'warn'); $('#tsTask').focus(); return; }
      const hourNumber=Number(hours);
      if(!Number.isFinite(hourNumber)||hourNumber<=0||hourNumber>24){ toast(s('hoursRequired'),'warn'); $('#tsHours').focus(); return; }
      save.disabled=true;
      try{
        await window.ErpSystemData.create('project/time-entries',{projectId,workDate,task,hours});
        closeModal();
        toast(s('created'),'ok');
        navigate('timesheet',{weekStart});
      }catch(error){
        save.disabled=false;
        toast(error&&error.message?error.message:s('createError'),'danger');
      }
    });
  }

  function openVoid(entryId,version){
    appModal({
      icon:'x',title:s('voidTitle'),
      body:`<p class="muted" style="margin:0 0 14px">${esc(s('voidBody'))}</p>
        <label class="fld"><span>${esc(s('reason'))} <span class="req">*</span></span><textarea id="tsVoidReason" maxlength="300" rows="3" placeholder="${esc(s('reasonPlaceholder'))}"></textarea></label>`,
      actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('confirmVoid'),{icon:'x',cls:'danger',attrs:'data-ts-confirm-void'})}`,
    });
    const confirm=$('#modalEl').querySelector('[data-ts-confirm-void]');
    confirm.addEventListener('click',async()=>{
      const reason=$('#tsVoidReason').value.trim();
      if(!reason){ toast(s('reasonRequired'),'warn'); $('#tsVoidReason').focus(); return; }
      confirm.disabled=true;
      try{
        await window.ErpSystemData.action(
          'project/time-entries',entryId,'void',{reason},`void-time-entry-${entryId}-${version}`,
        );
        closeModal();
        toast(s('voidedToast'),'ok');
        navigate('timesheet',{weekStart});
      }catch(error){
        confirm.disabled=false;
        toast(error&&error.message?error.message:s('voidError'),'danger');
      }
    });
  }

  load();
};
