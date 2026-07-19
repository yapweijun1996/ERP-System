/* ============================================================
   ARIA ERP — screens: Fixed Assets (register, asset detail, depreciation)
   ============================================================ */

const ASSET_CATEGORIES = ['Plant & Machinery','Vehicles','Lab Equipment','Furniture & Fixtures','IT Equipment','Warehouse Equipment'];
const ASSET_CATEGORY_KEY = {
  'Plant & Machinery':'catPlantMachinery','Vehicles':'catVehicles','Lab Equipment':'catLabEquipment',
  'Furniture & Fixtures':'catFurnitureFixtures','IT Equipment':'catItEquipment','Warehouse Equipment':'catWarehouseEquipment',
};
const ASSET_STATUS_LABEL = { in_use:'In use', under_maintenance:'Under maintenance', idle:'Idle', disposed:'Disposed' };

function assetCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      catPlantMachinery:'Plant & Machinery',catVehicles:'Vehicles',catLabEquipment:'Lab Equipment',
      catFurnitureFixtures:'Furniture & Fixtures',catItEquipment:'IT Equipment',catWarehouseEquipment:'Warehouse Equipment',
      category:'Category',fieldName:'Asset name',namePlaceholder:'e.g. CNC Milling Machine',
      fieldAssetNo:'Asset no.',systemNumbered:'System-numbered',fieldLocation:'Location',locationPlaceholder:'e.g. Plant 1',
      fieldAcquisitionDate:'Acquisition date',fieldCost:'Cost',fieldResidualValue:'Residual value',
      fieldUsefulLife:'Useful life (years)',years:'years',nameRequired:'Asset name is required',
      assetCreated:'Asset {name} registered',assetSaveError:'Asset could not be registered',createAsset:'Register asset',
      acquisition:'Acquisition',depreciationPanel:'Depreciation',fieldOriginalCost:'Original cost',
      fieldMethod:'Method',straightLine:'Straight-line',fieldMonthlyCharge:'Monthly charge',
      fieldGlAccounts:'GL accounts',scheduleHeader:'Depreciation history',colRun:'Run',colOpening:'Opening NBV',
      colDep:'Depreciation',colClosing:'Closing NBV',noHistoryYet:'No depreciation has been posted for this asset yet.',
      bookValue:'Book value',originalCost:'Original cost',accumDep:'Accum. depreciation',netBookValue:'Net book value',
      depreciated:'Depreciated',yearStraightLine:'year straight line',
      runParameters:'Run parameters',fieldDocNo:'Run no.',fieldRunDate:'Run date',runButton:'Run depreciation',
      runTitle:'Depreciation Run',noRunYet:'No depreciation run yet',
      noRunBody:'Run depreciation to compute straight-line charges for every asset with remaining depreciable value.',
      assetsWord:'assets',colAssets:'Assets',total:'Total',postButton:'Post to GL',viewGl:'View General Ledger',
      draftNote:'Draft — {amount} pending posting. Post to GL to update accumulated depreciation.',
      postedNote:'Posted — {amount} to GL as Dr 6200 Depreciation Expense / Cr 1510 Accumulated Depreciation.',
      runCreated:'Depreciation run created',
      runError:'Depreciation run could not be created',postSuccess:'Posted — {amount} to GL',
      postError:'Depreciation run could not be posted',
      pendingRunNote:'Post the pending run before starting a new one.',
    },
    ms:{
      catPlantMachinery:'Loji & Jentera',catVehicles:'Kenderaan',catLabEquipment:'Peralatan Makmal',
      catFurnitureFixtures:'Perabot & Kelengkapan',catItEquipment:'Peralatan IT',catWarehouseEquipment:'Peralatan Gudang',
      category:'Kategori',fieldName:'Nama aset',namePlaceholder:'cth. Mesin Kisar CNC',
      fieldAssetNo:'No. aset',systemNumbered:'Bernombor sistem',fieldLocation:'Lokasi',locationPlaceholder:'cth. Kilang 1',
      fieldAcquisitionDate:'Tarikh perolehan',fieldCost:'Kos',fieldResidualValue:'Nilai baki',
      fieldUsefulLife:'Hayat guna (tahun)',years:'tahun',nameRequired:'Nama aset diperlukan',
      assetCreated:'Aset {name} didaftarkan',assetSaveError:'Aset tidak dapat didaftarkan',createAsset:'Daftar aset',
      acquisition:'Perolehan',depreciationPanel:'Susut nilai',fieldOriginalCost:'Kos asal',
      fieldMethod:'Kaedah',straightLine:'Garis lurus',fieldMonthlyCharge:'Caj bulanan',
      fieldGlAccounts:'Akaun GL',scheduleHeader:'Sejarah susut nilai',colRun:'Larian',colOpening:'NBV pembukaan',
      colDep:'Susut nilai',colClosing:'NBV penutup',noHistoryYet:'Belum ada susut nilai dicatat untuk aset ini.',
      bookValue:'Nilai buku',originalCost:'Kos asal',accumDep:'Susut nilai terkumpul',netBookValue:'Nilai buku bersih',
      depreciated:'Disusutnilaikan',yearStraightLine:'tahun garis lurus',
      runParameters:'Parameter larian',fieldDocNo:'No. larian',fieldRunDate:'Tarikh larian',runButton:'Jalankan susut nilai',
      runTitle:'Larian Susut Nilai',noRunYet:'Belum ada larian susut nilai',
      noRunBody:'Jalankan susut nilai untuk mengira caj garis lurus bagi setiap aset yang masih ada nilai boleh susut.',
      assetsWord:'aset',colAssets:'Aset',total:'Jumlah',postButton:'Catat ke GL',viewGl:'Lihat Lejar Am',
      draftNote:'Draf — {amount} menunggu catatan. Catat ke GL untuk kemas kini susut nilai terkumpul.',
      postedNote:'Dicatat — {amount} ke GL sebagai Dr 6200 Perbelanjaan Susut Nilai / Kr 1510 Susut Nilai Terkumpul.',
      runCreated:'Larian susut nilai dicipta',
      runError:'Larian susut nilai tidak dapat dicipta',postSuccess:'Dicatat — {amount} ke GL',
      postError:'Larian susut nilai tidak dapat dicatat',
      pendingRunNote:'Catat larian yang belum selesai sebelum memulakan larian baharu.',
    },
    zh:{
      catPlantMachinery:'厂房及机器',catVehicles:'车辆',catLabEquipment:'实验室设备',
      catFurnitureFixtures:'家具及装置',catItEquipment:'IT 设备',catWarehouseEquipment:'仓库设备',
      category:'类别',fieldName:'资产名称',namePlaceholder:'例如:数控铣床',
      fieldAssetNo:'资产编号',systemNumbered:'系统编号',fieldLocation:'位置',locationPlaceholder:'例如:一号厂房',
      fieldAcquisitionDate:'购置日期',fieldCost:'成本',fieldResidualValue:'残值',
      fieldUsefulLife:'使用年限(年)',years:'年',nameRequired:'请填写资产名称',
      assetCreated:'资产 {name} 已登记',assetSaveError:'资产登记失败',createAsset:'登记资产',
      acquisition:'购置',depreciationPanel:'折旧',fieldOriginalCost:'原始成本',
      fieldMethod:'方法',straightLine:'直线法',fieldMonthlyCharge:'月折旧额',
      fieldGlAccounts:'总账科目',scheduleHeader:'折旧历史',colRun:'折旧运算',colOpening:'期初账面净值',
      colDep:'折旧额',colClosing:'期末账面净值',noHistoryYet:'该资产尚无已过账的折旧记录。',
      bookValue:'账面价值',originalCost:'原始成本',accumDep:'累计折旧',netBookValue:'账面净值',
      depreciated:'已折旧',yearStraightLine:'年直线法',
      runParameters:'运算参数',fieldDocNo:'运算编号',fieldRunDate:'运算日期',runButton:'运行折旧',
      runTitle:'折旧运算',noRunYet:'尚无折旧运算',
      noRunBody:'运行折旧以计算每项仍有可折旧余值的资产的直线折旧额。',
      assetsWord:'项资产',colAssets:'资产数',total:'合计',postButton:'过账到总账',viewGl:'查看总账',
      draftNote:'草稿 — {amount} 待过账。过账到总账以更新累计折旧。',
      postedNote:'已过账 — {amount} 至总账,借:6200 折旧费用 / 贷:1510 累计折旧。',
      runCreated:'折旧运算已创建',
      runError:'折旧运算创建失败',postSuccess:'已过账 — {amount} 至总账',
      postError:'折旧运算过账失败',
      pendingRunNote:'请先过账待处理的运算,再开始新的运算。',
    },
    ja:{
      catPlantMachinery:'機械装置',catVehicles:'車両',catLabEquipment:'実験機器',
      catFurnitureFixtures:'什器備品',catItEquipment:'IT機器',catWarehouseEquipment:'倉庫設備',
      category:'カテゴリ',fieldName:'資産名',namePlaceholder:'例:CNCフライス盤',
      fieldAssetNo:'資産番号',systemNumbered:'システム採番',fieldLocation:'設置場所',locationPlaceholder:'例:第1工場',
      fieldAcquisitionDate:'取得日',fieldCost:'取得原価',fieldResidualValue:'残存価額',
      fieldUsefulLife:'耐用年数',years:'年',nameRequired:'資産名を入力してください',
      assetCreated:'資産 {name} を登録しました',assetSaveError:'資産を登録できませんでした',createAsset:'資産を登録',
      acquisition:'取得情報',depreciationPanel:'減価償却',fieldOriginalCost:'取得原価',
      fieldMethod:'方法',straightLine:'定額法',fieldMonthlyCharge:'月次償却額',
      fieldGlAccounts:'総勘定元帳科目',scheduleHeader:'償却履歴',colRun:'償却実行',colOpening:'期首帳簿価額',
      colDep:'償却額',colClosing:'期末帳簿価額',noHistoryYet:'この資産にはまだ計上済みの償却履歴がありません。',
      bookValue:'帳簿価額',originalCost:'取得原価',accumDep:'減価償却累計額',netBookValue:'正味帳簿価額',
      depreciated:'償却進捗',yearStraightLine:'年定額法',
      runParameters:'実行パラメータ',fieldDocNo:'実行番号',fieldRunDate:'実行日',runButton:'減価償却を実行',
      runTitle:'減価償却実行',noRunYet:'まだ減価償却が実行されていません',
      noRunBody:'減価償却を実行すると、償却対象残高が残っているすべての資産について定額法償却額を計算します。',
      assetsWord:'件の資産',colAssets:'資産数',total:'合計',postButton:'総勘定元帳に計上',viewGl:'総勘定元帳を見る',
      draftNote:'下書き — {amount} が計上待ちです。計上すると減価償却累計額が更新されます。',
      postedNote:'計上済み — {amount} を借方6200減価償却費/貸方1510減価償却累計額として計上しました。',
      runCreated:'減価償却実行を作成しました',
      runError:'減価償却実行を作成できませんでした',postSuccess:'{amount} を総勘定元帳に計上しました',
      postError:'減価償却実行を計上できませんでした',
      pendingRunNote:'新しい実行を開始する前に、保留中の実行を計上してください。',
    },
    vi:{
      catPlantMachinery:'Nhà xưởng & Máy móc',catVehicles:'Xe cộ',catLabEquipment:'Thiết bị phòng thí nghiệm',
      catFurnitureFixtures:'Nội thất & Trang bị',catItEquipment:'Thiết bị CNTT',catWarehouseEquipment:'Thiết bị kho',
      category:'Danh mục',fieldName:'Tên tài sản',namePlaceholder:'vd: Máy phay CNC',
      fieldAssetNo:'Mã tài sản',systemNumbered:'Đánh số tự động',fieldLocation:'Vị trí',locationPlaceholder:'vd: Nhà máy 1',
      fieldAcquisitionDate:'Ngày mua',fieldCost:'Nguyên giá',fieldResidualValue:'Giá trị thu hồi',
      fieldUsefulLife:'Thời gian sử dụng (năm)',years:'năm',nameRequired:'Vui lòng nhập tên tài sản',
      assetCreated:'Đã đăng ký tài sản {name}',assetSaveError:'Không thể đăng ký tài sản',createAsset:'Đăng ký tài sản',
      acquisition:'Thông tin mua',depreciationPanel:'Khấu hao',fieldOriginalCost:'Nguyên giá',
      fieldMethod:'Phương pháp',straightLine:'Đường thẳng',fieldMonthlyCharge:'Mức khấu hao/tháng',
      fieldGlAccounts:'Tài khoản sổ cái',scheduleHeader:'Lịch sử khấu hao',colRun:'Đợt khấu hao',colOpening:'GTCL đầu kỳ',
      colDep:'Khấu hao',colClosing:'GTCL cuối kỳ',noHistoryYet:'Tài sản này chưa có khấu hao nào được ghi sổ.',
      bookValue:'Giá trị sổ sách',originalCost:'Nguyên giá',accumDep:'Hao mòn lũy kế',netBookValue:'Giá trị còn lại',
      depreciated:'Đã khấu hao',yearStraightLine:'năm đường thẳng',
      runParameters:'Tham số đợt chạy',fieldDocNo:'Số đợt chạy',fieldRunDate:'Ngày chạy',runButton:'Chạy khấu hao',
      runTitle:'Đợt Chạy Khấu Hao',noRunYet:'Chưa có đợt chạy khấu hao nào',
      noRunBody:'Chạy khấu hao để tính mức khấu hao đường thẳng cho mọi tài sản còn giá trị có thể khấu hao.',
      assetsWord:'tài sản',colAssets:'Số tài sản',total:'Tổng cộng',postButton:'Ghi sổ cái',viewGl:'Xem Sổ Cái',
      draftNote:'Nháp — {amount} đang chờ ghi sổ. Ghi sổ cái để cập nhật hao mòn lũy kế.',
      postedNote:'Đã ghi sổ — {amount} vào sổ cái: Nợ 6200 Chi phí khấu hao / Có 1510 Hao mòn lũy kế.',
      runCreated:'Đã tạo đợt chạy khấu hao',
      runError:'Không thể tạo đợt chạy khấu hao',postSuccess:'Đã ghi {amount} vào sổ cái',
      postError:'Không thể ghi sổ đợt chạy khấu hao',
      pendingRunNote:'Hãy ghi sổ đợt đang chờ trước khi bắt đầu đợt mới.',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

async function assetListPage(resource){
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.list!=='function'){
    throw new Error('The canonical ERP data adapter is unavailable.');
  }
  const response=await adapter.list(resource,{limit:100});
  if(!response||!Array.isArray(response.data)){
    throw new Error(`Unexpected ${resource} response.`);
  }
  return { data:response.data, nextCursor:response.meta&&response.meta.nextCursor||null };
}

function assetNumber(value){ const parsed=Number(value); return Number.isFinite(parsed)?parsed:0; }

function assetMonthlyDepreciation(cost,residual,life,accumulated){
  if(life<=0) return 0;
  const monthly=(cost-residual)/(life*12);
  const remaining=cost-residual-accumulated;
  if(remaining<=0) return 0;
  return Math.min(monthly,remaining);
}

/* Canonical asset presentation model — reuses the mock's original field
   names (cat/loc/acq/accDep/nbv/monthly/status) so the offline fallback
   snapshot in data-assets.js keeps rendering through the same table/detail
   code, matching the convention already established by Inventory/CRM. */
async function prepareCanonicalAssetData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(Array.isArray(DB.assets)) return;
    throw new Error('The offline canonical asset snapshot is unavailable.');
  }
  const page=await assetListPage('assets/assets');
  DB.assets=page.data.map(row=>{
    const cost=assetNumber(row.cost);
    const residual=assetNumber(row.residualValue);
    const life=assetNumber(row.usefulLifeYears);
    const accDep=assetNumber(row.accumulatedDepreciation);
    return {
      id:row.id,
      assetNo:row.assetNo,
      name:row.name,
      cat:row.category,
      loc:row.location,
      acq:row.acquisitionDate,
      cost,
      residual,
      life,
      accDep,
      nbv:cost-accDep,
      monthly:assetMonthlyDepreciation(cost,residual,life,accDep),
      status:ASSET_STATUS_LABEL[row.status]||row.status,
      version:row.version,
    };
  });
  DB.assetReadMeta={ truncated:Boolean(page.nextCursor) };
}

/* ---------------- ASSET REGISTER (listing) ---------------- */
SCREENS['asset-register'] = async function(root){
  await prepareCanonicalAssetData();
  const s=assetCopy();
  let filter='all';
  const cats=[...new Set(DB.assets.map(a=>a.cat))];
  const chips=[['all',t('common.all')],...cats.map(c=>[c,s(ASSET_CATEGORY_KEY[c]||c)])];
  function rows(){ return filter==='all'?DB.assets:DB.assets.filter(a=>a.cat===filter); }
  const totCost=DB.assets.reduce((sum,a)=>sum+a.cost,0);
  const totNbv=DB.assets.reduce((sum,a)=>sum+a.nbv,0);
  const totMo=DB.assets.reduce((sum,a)=>sum+a.monthly,0);
  function table(){
    return buildTable({
      rowId:a=>a.id,
      columns:[
        {label:t('fa.col.asset'),sticky:true,render:a=>`<div class="cellsub"><b>${esc(a.name)}</b><small>${esc(a.assetNo||a.id)}${a.loc?' · '+esc(a.loc):''}</small></div>`},
        {label:t('fa.col.category'),align:'l',render:a=>esc(s(ASSET_CATEGORY_KEY[a.cat]||a.cat))},
        {label:t('fa.col.acquired'),align:'l',sortable:true,render:a=>esc(a.acq)},
        {label:t('fa.col.cost'),align:'r',sortable:true,render:a=>`<span class="tnum">${money0(a.cost)}</span>`},
        {label:t('fa.col.accdep'),align:'r',render:a=>`<span class="tnum" style="color:var(--muted)">${money0(a.accDep)}</span>`},
        {label:t('fa.col.nbv'),align:'r',sortable:true,render:a=>`<b class="tnum">${money0(a.nbv)}</b>`},
        {label:t('fa.col.depmo'),align:'r',render:a=>`<span class="tnum">${money0(a.monthly)}</span>`},
        {label:t('col.status'),align:'l',render:a=>statusBadge(a.status)},
        {label:'',align:'c',render:a=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.asset'),t('fa.crumb')])}
      <div class="h1row"><h1>${esc(t('fa.title'))}</h1><span class="countchip" id="faCount"></span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('fa.kpi.gross'))}</small><b class="tnum">${money0(totCost)}</b></div>
          <div class="kfig"><small>${esc(t('fa.col.nbv'))}</small><b class="tnum">${money0(totNbv)}</b></div>
          <div class="kfig"><small>${esc(t('fa.kpi.depmo'))}</small><b class="tnum">${money0(totMo)}</b></div>
        </div></div>
    </div>
    <div class="toolbar">
      <div class="filterchips" id="faChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${esc(c[0])}">${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('fa.deprun'))}" onclick="navigate('depreciation')">${ic('chart')}${esc(t('fa.deprun'))}</button>
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('fa.new'),{icon:'plus',cls:'primary',attrs:'data-new="1"'})}
    </div>
    <div class="tablewrap" id="faTable">${table()}</div>
  </section></div>`;
  const wrap=$('#faTable');
  $('#faCount').textContent=rows().length+' '+t('fa.assets');
  function openAsset(id){ navigate('asset-detail',{assetId:Number(id)}); }
  function rewire(){
    wireTable(wrap,{ onRow:openAsset });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openAsset(b.closest('.dt-r').dataset.row);}));
  }
  rewire();
  $('#faChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#faChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#faCount').textContent=rows().length+' '+t('fa.assets'); rewire();
  }));
  root.querySelector('[data-new]').addEventListener('click',()=>assetForm(s));
};

function nextAssetNo(){
  let max=1000;
  DB.assets.forEach(a=>{ const m=/(\d+)\s*$/.exec(a.assetNo||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'FA-'+(max+1);
}

function assetForm(s){
  const assetNo=nextAssetNo();
  const today=new Date().toISOString().slice(0,10);
  openModal(`<div class="modal-head">${ic('plus')}<h3>${esc(t('fa.new'))}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body"><div class="set-grid">
      <div class="fld"><span>${esc(s('fieldName'))} <span class="req">*</span></span><input id="afName" placeholder="${esc(s('namePlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldAssetNo'))}</span><input value="${esc(assetNo)}" readonly><span class="locked">${ic('lock')} ${esc(s('systemNumbered'))}</span></div>
      <div class="fld"><span>${esc(s('category'))}</span><select id="afCat">${ASSET_CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(s(ASSET_CATEGORY_KEY[c]))}</option>`).join('')}</select></div>
      <div class="fld"><span>${esc(s('fieldLocation'))}</span><input id="afLoc" placeholder="${esc(s('locationPlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldAcquisitionDate'))}</span><input id="afDate" type="date" value="${today}"></div>
      <div class="fld"><span>${esc(s('fieldUsefulLife'))}</span><input id="afLife" type="number" min="1" class="tnum" value="5"></div>
      <div class="fld"><span>${esc(s('fieldCost'))} (USD)</span><input id="afCost" type="number" min="0" step="0.01" class="tnum" value="0"></div>
      <div class="fld"><span>${esc(s('fieldResidualValue'))} (USD)</span><input id="afResidual" type="number" min="0" step="0.01" class="tnum" value="0"></div>
    </div></div>
    <div class="modal-foot">${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('createAsset'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}</div>`);
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const name=$('#afName').value.trim();
    if(!name){ toast(s('nameRequired'),'danger'); $('#afName').focus(); return; }
    const payload={
      assetNo, name, category:$('#afCat').value, location:$('#afLoc').value.trim()||null,
      acquisitionDate:$('#afDate').value, usefulLifeYears:Math.max(1,+$('#afLife').value||1),
      cost:Math.max(0,+$('#afCost').value||0), residualValue:Math.max(0,+$('#afResidual').value||0),
    };
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.create('assets/assets',payload);
      closeModal();
      toast(s('assetCreated').replace('{name}',name),'ok');
      navigate('asset-register');
    }catch(error){
      saveBtn.disabled=false;
      toast(error&&error.message?error.message:s('assetSaveError'),'danger');
    }
  });
}

/* ---------------- ASSET DETAIL (master + real posted history) ---------------- */
async function prepareAssetDetail(assetId){
  const pages=await Promise.all([
    assetListPage('assets/assets'),
    assetListPage('assets/depreciation-runs'),
    assetListPage('assets/depreciation-run-lines'),
  ]);
  const [assets,runs,lines]=pages.map(p=>p.data);
  const asset=assetId?assets.find(row=>row.id===assetId):assets[0];
  if(!asset) throw new Error('No asset found for the active company.');
  const postedRunById=new Map(runs.filter(row=>row.status==='posted').map(row=>[row.id,row]));
  const history=lines.filter(line=>line.assetId===asset.id&&postedRunById.has(line.runId))
    .map(line=>Object.assign({},line,{run:postedRunById.get(line.runId)}))
    .sort((a,b)=>String(a.run.runDate).localeCompare(String(b.run.runDate))||a.id-b.id);
  return {asset,history};
}

SCREENS['asset-detail'] = async function(root, params){
  const s=assetCopy();
  const requestedId=params&&params.assetId?Number(params.assetId):null;
  const detail=await prepareAssetDetail(requestedId);
  const a=detail.asset;
  const cost=assetNumber(a.cost), residual=assetNumber(a.residualValue), accDep=assetNumber(a.accumulatedDepreciation);
  const nbv=cost-accDep;
  const life=assetNumber(a.usefulLifeYears);
  const monthly=assetMonthlyDepreciation(cost,residual,life,accDep);
  const depPct=cost>0?Math.round(accDep/cost*100):0;
  const statusLabel=ASSET_STATUS_LABEL[a.status]||a.status;
  const catLabel=s(ASSET_CATEGORY_KEY[a.category]||a.category);
  const historyRows=detail.history.map(line=>`<tr>
    <td class="l li-name"><b>${esc(line.run.docNo)}</b><small>${esc(line.run.runDate)}</small></td>
    <td class="tnum">${money0(assetNumber(line.openingNbv))}</td>
    <td class="tnum">${money0(assetNumber(line.depreciationAmount))}</td>
    <td class="tnum"><b>${money0(assetNumber(line.closingNbv))}</b></td>
  </tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,t('nav.asset'),t('fa.title'),{cur:a.assetNo}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('asset')}${esc(a.name)} <span class="dnum">${esc(a.assetNo)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(catLabel)} · ${esc(a.location||'—')} · ${esc(s('straightLine'))} · ${life} ${esc(s('years'))}</div></div>
        <div class="dactions">${statusBadge(statusLabel)}</div></div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>${esc(s('acquisition'))}</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>${esc(s('fieldAcquisitionDate'))}</span><input value="${esc(a.acquisitionDate)}" readonly></div>
            <div class="fld"><span>${esc(s('fieldOriginalCost'))}</span><input value="${money(cost)}" readonly></div>
            <div class="fld"><span>${esc(s('category'))}</span><input value="${esc(catLabel)}" readonly></div>
            <div class="fld"><span>${esc(s('fieldLocation'))}</span><input value="${esc(a.location||'—')}" readonly></div>
            <div class="fld"><span>${esc(s('fieldUsefulLife'))}</span><input value="${life} ${esc(s('years'))}" readonly></div>
            <div class="fld"><span>${esc(s('fieldResidualValue'))}</span><input value="${money(residual)}" readonly></div>
          </div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('depreciationPanel'))}</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>${esc(s('fieldMethod'))}</span><input value="${esc(s('straightLine'))}" readonly></div>
            <div class="fld"><span>${esc(s('fieldMonthlyCharge'))}</span><input value="${money(monthly)}" readonly></div>
            <div class="fld"><span>${esc(s('fieldGlAccounts'))}</span><input value="6200 · 1510" readonly></div>
          </div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('scheduleHeader'))}</h3></div>
          ${detail.history.length
            ?`<table class="lines"><thead><tr><th class="l">${esc(s('colRun'))}</th><th>${esc(s('colOpening'))}</th><th>${esc(s('colDep'))}</th><th>${esc(s('colClosing'))}</th></tr></thead><tbody>${historyRows}</tbody></table>`
            :`<div style="color:var(--muted);font-size:13px;padding:0 16px 16px">${esc(s('noHistoryYet'))}</div>`}
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('bookValue'))}</div>
          <div class="sumrow"><span class="sk2">${esc(s('originalCost'))}</span><span class="sv tnum">${money(cost)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('accumDep'))}</span><span class="sv tnum" style="color:var(--muted)">(${money(accDep)})</span></div>
          <div class="sumrow total"><span class="sk2">${esc(s('netBookValue'))}</span><span class="sv tnum">${money(nbv)}</span></div>
          <div class="indicator ${depPct>=100?'danger':'ok'}" style="margin-top:12px">
            <div class="ind-top">${ic('chart')}<span>${esc(s('depreciated'))}</span><span class="ind-r">${depPct}%</span></div>
            <div class="track"><i style="width:${Math.min(100,depPct)}%"></i></div>
            <small>${money(monthly)}/mo · ${life}-${esc(s('yearStraightLine'))}</small>
          </div>
        </div>
      </aside>
    </div>
    <div style="height:60px"></div>
  </div></div></section></div>`;
};

/* ---------------- DEPRECIATION RUN (compute + post to GL) ---------------- */
SCREENS['depreciation'] = async function(root){
  const s=assetCopy();
  await prepareCanonicalAssetData();

  async function loadRuns(){
    const page=await assetListPage('assets/depreciation-runs');
    return page.data.slice().sort((a,b)=>b.id-a.id);
  }
  async function loadLines(runId){
    const page=await assetListPage('assets/depreciation-run-lines');
    return page.data.filter(line=>line.runId===runId);
  }
  function nextDocNo(runs){
    let max=0;
    runs.forEach(r=>{ const m=/(\d+)\s*$/.exec(r.docNo||''); if(m&&+m[1]>max) max=+m[1]; });
    return 'DEP-'+String(max+1).padStart(4,'0');
  }
  function groupTable(lines){
    const assetById=new Map(DB.assets.map(a=>[a.id,a]));
    const byCat=new Map();
    let totOpen=0, totDep=0;
    lines.forEach(line=>{
      const asset=assetById.get(line.assetId);
      const cat=asset?asset.cat:'—';
      const cur=byCat.get(cat)||{cat,n:0,open:0,dep:0};
      cur.n+=1; cur.open+=assetNumber(line.openingNbv); cur.dep+=assetNumber(line.depreciationAmount);
      byCat.set(cat,cur);
      totOpen+=assetNumber(line.openingNbv); totDep+=assetNumber(line.depreciationAmount);
    });
    const tpl='minmax(220px,2.4fr) 90px 150px 140px 150px';
    let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
      <div class="dt-r dt-head"><div class="dt-c l">${esc(t('fa.col.category'))}</div><div class="dt-c r">${esc(s('colAssets'))}</div><div class="dt-c r">${esc(s('colOpening'))}</div><div class="dt-c r">${esc(s('colDep'))}</div><div class="dt-c r">${esc(s('colClosing'))}</div></div>
      <div class="dt-body">`;
    Array.from(byCat.values()).forEach(g=>{
      h+=`<div class="dt-r"><div class="dt-c l"><b>${esc(s(ASSET_CATEGORY_KEY[g.cat]||g.cat))}</b></div><div class="dt-c r tnum">${g.n}</div><div class="dt-c r tnum">${money0(g.open)}</div><div class="dt-c r tnum">${money0(g.dep)}</div><div class="dt-c r tnum">${money0(g.open-g.dep)}</div></div>`;
    });
    h+=`<div class="dt-r grandtotal"><div class="dt-c l">${esc(s('total'))}</div><div class="dt-c r tnum">${lines.length}</div><div class="dt-c r tnum">${money0(totOpen)}</div><div class="dt-c r tnum">${money0(totDep)}</div><div class="dt-c r tnum">${money0(totOpen-totDep)}</div></div>`;
    h+='</div></div></div>';
    return h;
  }

  let runs=await loadRuns();

  async function render(){
    const latest=runs[0]||null;
    const lines=latest?await loadLines(latest.id):[];
    const isDraft=latest&&latest.status==='draft';
    const isPosted=latest&&latest.status==='posted';
    root.innerHTML=`<div class="content full"><section class="master"><div class="report">
      <aside class="report-params">
        <h3>${esc(s('runParameters'))}</h3>
        <div class="fld"><span>${esc(s('fieldDocNo'))}</span><input id="depDocNo" value="${esc(nextDocNo(runs))}" readonly></div>
        <div class="fld"><span>${esc(s('fieldRunDate'))}</span><input id="depRunDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="fld"><span>${esc(s('fieldMethod'))}</span><input value="${esc(s('straightLine'))}" readonly></div>
        ${btn(s('runButton'),{icon:'play',cls:'primary',sm:false,attrs:`data-run="1"${isDraft?' disabled':''} title="${isDraft?esc(s('pendingRunNote')):''}"`})}
        ${latest?`<div class="note rule" style="border:1px solid var(--hairline);border-left:3px solid ${isPosted?'var(--ok)':'var(--warn)'};background:var(--surface);border-radius:0 var(--r-m) var(--r-m) 0;padding:11px 13px;font-size:12.5px;margin-top:6px">
          <b style="display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:3px">${esc(latest.docNo)}</b>
          ${esc((isPosted?s('postedNote'):s('draftNote')).replace('{amount}',money0(assetNumber(latest.totalAmount))))}
        </div>`:''}
      </aside>
      <div class="report-result">
        <div class="report-toolbar">
          <div><b style="font-size:15px">${esc(s('runTitle'))}</b><div class="report-meta">${latest?esc(latest.docNo)+' · '+esc(latest.runDate)+' · '+lines.length+' '+esc(s('assetsWord')):esc(s('noRunYet'))}</div></div>
          <div class="grow"></div>
          ${isDraft?btn(s('postButton'),{icon:'book',cls:'primary',attrs:'data-post="1"'}):''}
          ${isPosted?btn(s('viewGl'),{icon:'book',cls:'soft',attrs:'onclick="navigate(\'gl\')"'}):''}
        </div>
        <div class="tablewrap" id="depTable">${latest?groupTable(lines):statePanel({icon:'chart',title:s('noRunYet'),body:s('noRunBody')})}</div>
      </div>
    </div></section></div>`;
    wire();
  }

  function wire(){
    const runBtn=root.querySelector('[data-run]');
    runBtn&&runBtn.addEventListener('click',async()=>{
      runBtn.disabled=true;
      try{
        const docNo=$('#depDocNo').value.trim();
        const runDate=$('#depRunDate').value;
        await window.ErpSystemData.create('assets/depreciation-runs',{docNo,runDate});
        toast(s('runCreated'),'ok');
        runs=await loadRuns();
        await render();
      }catch(error){
        toast(error&&error.message?error.message:s('runError'),'danger');
        runBtn.disabled=false;
      }
    });
    const postBtn=root.querySelector('[data-post]');
    postBtn&&postBtn.addEventListener('click',async()=>{
      postBtn.disabled=true;
      const latest=runs[0];
      try{
        await window.ErpSystemData.action('assets/depreciation-runs',latest.id,'post',{},`post-depreciation-run-${latest.id}`);
        toast(s('postSuccess').replace('{amount}',money0(assetNumber(latest.totalAmount))),'ok');
        runs=await loadRuns();
        await prepareCanonicalAssetData();
        await render();
      }catch(error){
        toast(error&&error.message?error.message:s('postError'),'danger');
        postBtn.disabled=false;
      }
    });
  }

  await render();
};
