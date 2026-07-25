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
      assetProfileTitle:'Asset profile',
      assetProfileDescription:'Review acquisition, valuation and posted depreciation for the selected asset.',
      noAssetFound:'No asset found',noAssetBody:'Choose an asset from Asset Register to review its details.',
      monthlySummary:'{amount} per month · {years}-year straight-line',
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
      statusDraft:'Draft',statusPosted:'Posted',statusCancelled:'Cancelled',
      kpiTotalRuns:'Total runs',kpiDraftRuns:'Draft',kpiPostedRuns:'Posted',kpiLatestDep:'Latest depreciation',
      newRunTitle:'New depreciation run',selectRun:'Select a depreciation run',
      selectRunBody:'Choose a run to review its category totals and posting status.',
      cancelledNote:'Cancelled — this run is read-only and was not posted to GL.',
      confirmPostTitle:'Post depreciation run?',
      confirmPostBody:'Post {docNo} for {amount} as Dr 6200 Depreciation Expense / Cr 1510 Accumulated Depreciation. This cannot be reversed here.',
      runDateRequired:'Run date is required.',
      noRunLines:'No depreciation lines are attached to this run.',
      dataLimit:'Showing up to 100 depreciation runs.',
    },
    ms:{
      catPlantMachinery:'Loji & Jentera',catVehicles:'Kenderaan',catLabEquipment:'Peralatan Makmal',
      catFurnitureFixtures:'Perabot & Kelengkapan',catItEquipment:'Peralatan IT',catWarehouseEquipment:'Peralatan Gudang',
      category:'Kategori',fieldName:'Nama aset',namePlaceholder:'cth. Mesin Kisar CNC',
      fieldAssetNo:'No. aset',systemNumbered:'Bernombor sistem',fieldLocation:'Lokasi',locationPlaceholder:'cth. Kilang 1',
      fieldAcquisitionDate:'Tarikh perolehan',fieldCost:'Kos',fieldResidualValue:'Nilai baki',
      fieldUsefulLife:'Hayat guna (tahun)',years:'tahun',nameRequired:'Nama aset diperlukan',
      assetCreated:'Aset {name} didaftarkan',assetSaveError:'Aset tidak dapat didaftarkan',createAsset:'Daftar aset',
      assetProfileTitle:'Profil aset',
      assetProfileDescription:'Semak perolehan, penilaian dan susut nilai tercatat bagi aset yang dipilih.',
      noAssetFound:'Aset tidak ditemui',noAssetBody:'Pilih aset daripada Daftar Aset untuk menyemak butirannya.',
      monthlySummary:'{amount} sebulan · garis lurus {years} tahun',
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
      statusDraft:'Draf',statusPosted:'Dicatat',statusCancelled:'Dibatalkan',
      kpiTotalRuns:'Jumlah larian',kpiDraftRuns:'Draf',kpiPostedRuns:'Dicatat',kpiLatestDep:'Susut nilai terkini',
      newRunTitle:'Larian susut nilai baharu',selectRun:'Pilih larian susut nilai',
      selectRunBody:'Pilih larian untuk menyemak jumlah kategori dan status catatannya.',
      cancelledNote:'Dibatalkan — larian ini hanya boleh dibaca dan tidak dicatat ke GL.',
      confirmPostTitle:'Catat larian susut nilai?',
      confirmPostBody:'Catat {docNo} berjumlah {amount} sebagai Dr 6200 Perbelanjaan Susut Nilai / Kr 1510 Susut Nilai Terkumpul. Tindakan ini tidak boleh diterbalikkan di sini.',
      runDateRequired:'Tarikh larian diperlukan.',
      noRunLines:'Tiada baris susut nilai dilampirkan pada larian ini.',
      dataLimit:'Memaparkan sehingga 100 larian susut nilai.',
    },
    zh:{
      catPlantMachinery:'厂房及机器',catVehicles:'车辆',catLabEquipment:'实验室设备',
      catFurnitureFixtures:'家具及装置',catItEquipment:'IT 设备',catWarehouseEquipment:'仓库设备',
      category:'类别',fieldName:'资产名称',namePlaceholder:'例如:数控铣床',
      fieldAssetNo:'资产编号',systemNumbered:'系统编号',fieldLocation:'位置',locationPlaceholder:'例如:一号厂房',
      fieldAcquisitionDate:'购置日期',fieldCost:'成本',fieldResidualValue:'残值',
      fieldUsefulLife:'使用年限(年)',years:'年',nameRequired:'请填写资产名称',
      assetCreated:'资产 {name} 已登记',assetSaveError:'资产登记失败',createAsset:'登记资产',
      assetProfileTitle:'资产档案',
      assetProfileDescription:'查看所选资产的购置、估值及已过账折旧。',
      noAssetFound:'未找到资产',noAssetBody:'请从资产登记册选择资产以查看详情。',
      monthlySummary:'每月 {amount} · {years} 年直线法',
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
      statusDraft:'草稿',statusPosted:'已过账',statusCancelled:'已取消',
      kpiTotalRuns:'运算总数',kpiDraftRuns:'草稿',kpiPostedRuns:'已过账',kpiLatestDep:'最近折旧额',
      newRunTitle:'新建折旧运算',selectRun:'选择折旧运算',
      selectRunBody:'选择一项运算以查看类别汇总和过账状态。',
      cancelledNote:'已取消 — 此运算为只读且未过账到总账。',
      confirmPostTitle:'过账折旧运算？',
      confirmPostBody:'将 {docNo} 的 {amount} 以借记 6200 折旧费用／贷记 1510 累计折旧过账。此处无法撤销此操作。',
      runDateRequired:'必须填写运算日期。',
      noRunLines:'此运算没有折旧明细。',
      dataLimit:'最多显示 100 项折旧运算。',
    },
    ja:{
      catPlantMachinery:'機械装置',catVehicles:'車両',catLabEquipment:'実験機器',
      catFurnitureFixtures:'什器備品',catItEquipment:'IT機器',catWarehouseEquipment:'倉庫設備',
      category:'カテゴリ',fieldName:'資産名',namePlaceholder:'例:CNCフライス盤',
      fieldAssetNo:'資産番号',systemNumbered:'システム採番',fieldLocation:'設置場所',locationPlaceholder:'例:第1工場',
      fieldAcquisitionDate:'取得日',fieldCost:'取得原価',fieldResidualValue:'残存価額',
      fieldUsefulLife:'耐用年数',years:'年',nameRequired:'資産名を入力してください',
      assetCreated:'資産 {name} を登録しました',assetSaveError:'資産を登録できませんでした',createAsset:'資産を登録',
      assetProfileTitle:'資産プロフィール',
      assetProfileDescription:'選択した資産の取得、評価、計上済み減価償却を確認します。',
      noAssetFound:'資産が見つかりません',noAssetBody:'資産台帳から資産を選択して詳細を確認してください。',
      monthlySummary:'月額 {amount} · {years} 年定額法',
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
      statusDraft:'下書き',statusPosted:'計上済み',statusCancelled:'キャンセル済み',
      kpiTotalRuns:'実行総数',kpiDraftRuns:'下書き',kpiPostedRuns:'計上済み',kpiLatestDep:'最新の償却額',
      newRunTitle:'新しい減価償却実行',selectRun:'減価償却実行を選択',
      selectRunBody:'実行を選択してカテゴリ別合計と計上状況を確認します。',
      cancelledNote:'キャンセル済み — この実行は読み取り専用で、総勘定元帳には計上されていません。',
      confirmPostTitle:'減価償却実行を計上しますか？',
      confirmPostBody:'{docNo} の {amount} を借方 6200 減価償却費／貸方 1510 減価償却累計額として計上します。ここでは取り消せません。',
      runDateRequired:'実行日は必須です。',
      noRunLines:'この実行には減価償却明細がありません。',
      dataLimit:'最大 100 件の減価償却実行を表示しています。',
    },
    vi:{
      catPlantMachinery:'Nhà xưởng & Máy móc',catVehicles:'Xe cộ',catLabEquipment:'Thiết bị phòng thí nghiệm',
      catFurnitureFixtures:'Nội thất & Trang bị',catItEquipment:'Thiết bị CNTT',catWarehouseEquipment:'Thiết bị kho',
      category:'Danh mục',fieldName:'Tên tài sản',namePlaceholder:'vd: Máy phay CNC',
      fieldAssetNo:'Mã tài sản',systemNumbered:'Đánh số tự động',fieldLocation:'Vị trí',locationPlaceholder:'vd: Nhà máy 1',
      fieldAcquisitionDate:'Ngày mua',fieldCost:'Nguyên giá',fieldResidualValue:'Giá trị thu hồi',
      fieldUsefulLife:'Thời gian sử dụng (năm)',years:'năm',nameRequired:'Vui lòng nhập tên tài sản',
      assetCreated:'Đã đăng ký tài sản {name}',assetSaveError:'Không thể đăng ký tài sản',createAsset:'Đăng ký tài sản',
      assetProfileTitle:'Hồ sơ tài sản',
      assetProfileDescription:'Xem thông tin mua, định giá và khấu hao đã ghi sổ của tài sản được chọn.',
      noAssetFound:'Không tìm thấy tài sản',noAssetBody:'Chọn một tài sản từ Sổ đăng ký tài sản để xem chi tiết.',
      monthlySummary:'{amount} mỗi tháng · đường thẳng {years} năm',
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
      statusDraft:'Nháp',statusPosted:'Đã ghi sổ',statusCancelled:'Đã hủy',
      kpiTotalRuns:'Tổng số đợt',kpiDraftRuns:'Nháp',kpiPostedRuns:'Đã ghi sổ',kpiLatestDep:'Khấu hao gần nhất',
      newRunTitle:'Đợt chạy khấu hao mới',selectRun:'Chọn đợt chạy khấu hao',
      selectRunBody:'Chọn một đợt để xem tổng theo danh mục và trạng thái ghi sổ.',
      cancelledNote:'Đã hủy — đợt này chỉ đọc và chưa được ghi vào sổ cái.',
      confirmPostTitle:'Ghi sổ đợt khấu hao?',
      confirmPostBody:'Ghi {docNo} với số tiền {amount} theo Nợ 6200 Chi phí khấu hao / Có 1510 Hao mòn lũy kế. Không thể hoàn tác tại đây.',
      runDateRequired:'Ngày chạy là bắt buộc.',
      noRunLines:'Không có dòng khấu hao nào trong đợt này.',
      dataLimit:'Hiển thị tối đa 100 đợt chạy khấu hao.',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
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
  const page=await listPage('assets/assets');
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
      acq:dateValue(row.acquisitionDate),
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
  const cats=[...new Set(DB.assets.map(a=>a.cat))];
  const chips=[['all',t('common.all')],...cats.map(c=>[c,s(ASSET_CATEGORY_KEY[c]||c)])];
  const totCost=DB.assets.reduce((sum,a)=>sum+a.cost,0);
  const totNbv=DB.assets.reduce((sum,a)=>sum+a.nbv,0);
  const totMo=DB.assets.reduce((sum,a)=>sum+a.monthly,0);
  transactionListPage(root,{
    module:'asset',route:'asset-register',title:t('fa.title'),
    rows:DB.assets,rowId:a=>a.id,
    filters:chips,filterFn:(asset,category)=>asset.cat===category,
    kpis:[
      {label:t('fa.kpi.gross'),value:money0(totCost)},
      {label:t('fa.col.nbv'),value:money0(totNbv)},
      {label:t('fa.kpi.depmo'),value:money0(totMo)},
    ],
    primaryAction:{label:t('fa.new'),icon:'plus',onClick:()=>assetForm(s)},
    toolbarActions:[{label:t('fa.deprun'),icon:'chart',onClick:()=>navigate('depreciation')}],
    columns:[
      {label:t('fa.col.asset'),sticky:true,render:a=>`<div class="cellsub"><b>${esc(a.name)}</b><small>${esc(a.assetNo||a.id)}${a.loc?' · '+esc(a.loc):''}</small></div>`},
      {label:t('fa.col.category'),align:'l',render:a=>esc(s(ASSET_CATEGORY_KEY[a.cat]||a.cat))},
      {label:t('fa.col.acquired'),align:'l',sortable:true,render:a=>esc(a.acq)},
      {label:t('fa.col.cost'),align:'r',sortable:true,render:a=>`<span class="tnum">${money0(a.cost)}</span>`},
      {label:t('fa.col.accdep'),align:'r',render:a=>`<span class="tnum" style="color:var(--muted)">${money0(a.accDep)}</span>`},
      {label:t('fa.col.nbv'),align:'r',sortable:true,render:a=>`<b class="tnum">${money0(a.nbv)}</b>`},
      {label:t('fa.col.depmo'),align:'r',render:a=>`<span class="tnum">${money0(a.monthly)}</span>`},
      {label:t('col.status'),align:'l',render:a=>statusBadge(a.status)},
    ],
    rowAction:{
      label:a=>`${t('common.open')} ${a.assetNo||a.id}`,
      run:a=>navigate('asset-detail',{assetId:Number(a.id)}),
    },
    empty:{icon:'asset',title:'No assets'},
  });
};

function nextAssetNo(){
  let max=1000;
  DB.assets.forEach(a=>{ const m=/(\d+)\s*$/.exec(a.assetNo||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'FA-'+(max+1);
}

function assetForm(s){
  const assetNo=nextAssetNo();
  const today=new Date().toISOString().slice(0,10);
  appModal({
    icon: 'plus',
    title: t('fa.new'),
    body: `<div class="set-grid">
      <div class="fld"><span>${esc(s('fieldName'))} <span class="req">*</span></span><input id="afName" placeholder="${esc(s('namePlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldAssetNo'))}</span><input value="${esc(assetNo)}" readonly><span class="locked">${ic('lock')} ${esc(s('systemNumbered'))}</span></div>
      <div class="fld"><span>${esc(s('category'))}</span><select id="afCat">${ASSET_CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(s(ASSET_CATEGORY_KEY[c]))}</option>`).join('')}</select></div>
      <div class="fld"><span>${esc(s('fieldLocation'))}</span><input id="afLoc" placeholder="${esc(s('locationPlaceholder'))}"></div>
      <div class="fld"><span>${esc(s('fieldAcquisitionDate'))}</span><input id="afDate" type="date" value="${today}"></div>
      <div class="fld"><span>${esc(s('fieldUsefulLife'))}</span><input id="afLife" type="number" min="1" class="tnum" value="5"></div>
      <div class="fld"><span>${esc(s('fieldCost'))} (USD)</span><input id="afCost" type="number" min="0" step="0.01" class="tnum" value="0"></div>
      <div class="fld"><span>${esc(s('fieldResidualValue'))} (USD)</span><input id="afResidual" type="number" min="0" step="0.01" class="tnum" value="0"></div>
    </div>`,
    actions: `${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('createAsset'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const name=$('#afName').value.trim();
    if(!requireField(name, s('nameRequired'), '#afName')) return;
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
    listPage('assets/assets'),
    listPage('assets/depreciation-runs'),
    listPage('assets/depreciation-run-lines'),
  ]);
  const [assets,runs,lines]=pages.map(p=>p.data);
  const asset=assetId?assets.find(row=>row.id===assetId):assets[0];
  if(!asset) return {asset:null,history:[]};
  const postedRunById=new Map(runs.filter(row=>row.status==='posted').map(row=>[row.id,row]));
  const history=lines.filter(line=>line.assetId===asset.id&&postedRunById.has(line.runId))
    .map(line=>Object.assign({},line,{run:postedRunById.get(line.runId)}))
    .sort((a,b)=>dateValue(a.run.runDate).localeCompare(dateValue(b.run.runDate))||a.id-b.id);
  return {asset,history};
}

SCREENS['asset-detail'] = async function(root, params){
  const s=assetCopy();
  const rawId=params&&params.assetId;
  const requestedId=rawId==null?null:Number(rawId);
  if(rawId!=null&&(!Number.isSafeInteger(requestedId)||requestedId<=0)){
    masterDetailEditorPage(root,{
      module:'asset',route:'asset-detail',active:'asset-register',
      title:s('assetProfileTitle'),description:s('assetProfileDescription'),
      crumb:[DB.company.name,{label:t('nav.asset'),route:'asset-register'},{label:t('fa.title'),route:'asset-register'},{cur:s('assetProfileTitle')}],
      empty:{icon:'asset',title:s('noAssetFound'),description:s('noAssetBody')},
      afterRender:({editor})=>editor?.setAttribute('data-canonical-asset-detail','true'),
    });
    return;
  }
  const detail=await prepareAssetDetail(requestedId);
  const a=detail.asset;
  if(!a){
    masterDetailEditorPage(root,{
      module:'asset',route:'asset-detail',active:'asset-register',
      title:s('assetProfileTitle'),description:s('assetProfileDescription'),
      crumb:[DB.company.name,{label:t('nav.asset'),route:'asset-register'},{label:t('fa.title'),route:'asset-register'},{cur:s('assetProfileTitle')}],
      empty:{icon:'asset',title:s('noAssetFound'),description:s('noAssetBody')},
      afterRender:({editor})=>editor?.setAttribute('data-canonical-asset-detail','true'),
    });
    return;
  }
  const cost=assetNumber(a.cost), residual=assetNumber(a.residualValue), accDep=assetNumber(a.accumulatedDepreciation);
  const nbv=cost-accDep;
  const life=assetNumber(a.usefulLifeYears);
  const monthly=assetMonthlyDepreciation(cost,residual,life,accDep);
  const depPct=cost>0?Math.round(accDep/cost*100):0;
  const statusLabel=ASSET_STATUS_LABEL[a.status]||a.status;
  const catLabel=s(ASSET_CATEGORY_KEY[a.category]||a.category);
  const historyBody=detail.history.length
    ? `<div class="asset-detail-history-scroll" data-asset-depreciation-history>${buildTable({
        rows:detail.history,
        rowId:line=>line.id,
        rowInteraction:()=>({kind:'none',label:''}),
        columns:[
          {label:s('colRun'),align:'l',sticky:true,w:'minmax(160px,1.4fr)',render:line=>`<div class="cellsub"><b>${esc(line.run.docNo)}</b><small>${esc(dateValue(line.run.runDate))}</small></div>`},
          {label:s('colOpening'),align:'r',w:'130px',render:line=>`<span class="tnum">${money0(assetNumber(line.openingNbv))}</span>`},
          {label:s('colDep'),align:'r',w:'120px',render:line=>`<span class="tnum">${money0(assetNumber(line.depreciationAmount))}</span>`},
          {label:s('colClosing'),align:'r',w:'130px',render:line=>`<b class="tnum">${money0(assetNumber(line.closingNbv))}</b>`},
        ],
      })}</div>`
    : `<div class="master-detail-editor-inline-empty" data-asset-depreciation-empty>
        ${ic('chart')}<span>${esc(s('noHistoryYet'))}</span></div>`;
  const monthlySummary=s('monthlySummary')
    .replace('{amount}',money(monthly))
    .replace('{years}',life);
  const statusTone={in_use:'ok',under_maintenance:'warn',idle:'neutral',disposed:'danger'}[a.status]||'neutral';
  masterDetailEditorPage(root,{
    module:'asset',route:'asset-detail',active:'asset-register',
    title:s('assetProfileTitle'),description:s('assetProfileDescription'),
    crumb:[DB.company.name,{label:t('nav.asset'),route:'asset-register'},{label:t('fa.title'),route:'asset-register'},{cur:a.assetNo}],
    status:{label:ts(statusLabel),tone:statusTone},
    overview:{
      title:a.name,
      code:a.assetNo,
      meta:`${catLabel} · ${a.location||'—'}`,
      facts:[
        {label:s('fieldAcquisitionDate'),value:dateValue(a.acquisitionDate)},
        {label:s('fieldOriginalCost'),value:money(cost),numeric:true},
        {label:s('fieldUsefulLife'),value:`${life} ${s('years')}`},
        {label:s('fieldResidualValue'),value:money(residual),numeric:true},
      ],
    },
    main:`
      <div class="panel" data-asset-depreciation-policy>
        <div class="panel-h"><h3>${esc(s('depreciationPanel'))}</h3></div>
        <div class="master-detail-editor-facts asset-detail-policy-facts">
          <div class="master-detail-editor-fact">
            <small>${esc(s('fieldMethod'))}</small><b>${esc(s('straightLine'))}</b>
          </div>
          <div class="master-detail-editor-fact">
            <small>${esc(s('fieldMonthlyCharge'))}</small><b class="tnum">${money(monthly)}</b>
          </div>
          <div class="master-detail-editor-fact">
            <small>${esc(s('fieldGlAccounts'))}</small><b class="tnum">6200 · 1510</b>
          </div>
        </div>
      </div>
      <div class="panel asset-detail-history" data-asset-depreciation-panel>
        <div class="panel-h"><h3>${esc(s('scheduleHeader'))}</h3><span class="grow"></span><small class="tnum">${detail.history.length}</small></div>
        ${historyBody}
      </div>`,
    context:{
      title:s('bookValue'),
      body:`<div class="asset-detail-book-values" data-asset-book-value>
          <div class="sumrow"><span class="sk2">${esc(s('originalCost'))}</span><span class="sv tnum">${money(cost)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('accumDep'))}</span><span class="sv tnum">(${money(accDep)})</span></div>
          <div class="sumrow total"><span class="sk2">${esc(s('netBookValue'))}</span><span class="sv tnum">${money(nbv)}</span></div>
        </div>
        <div class="indicator ${depPct>=100?'danger':'ok'} asset-detail-progress" data-asset-depreciation-progress>
          <div class="ind-top">${ic('chart')}<span>${esc(s('depreciated'))}</span><span class="ind-r tnum">${depPct}%</span></div>
          <div class="track"><i style="width:${Math.min(100,depPct)}%"></i></div>
          <small>${esc(monthlySummary)}</small>
        </div>`,
    },
    afterRender:({editor})=>editor?.setAttribute('data-canonical-asset-detail','true'),
  });
};

/* ---------------- DEPRECIATION RUN (compute + post to GL) ---------------- */
SCREENS['depreciation'] = async function(root){
  const s=assetCopy();
  let runs=[];
  let lines=[];
  let truncated=false;
  let page;
  const isDesktop=()=>!window.matchMedia('(max-width:980px)').matches;

  async function refreshState(){
    await prepareCanonicalAssetData();
    const [runPage,linePage]=await Promise.all([
      listPage('assets/depreciation-runs'),
      listPage('assets/depreciation-run-lines'),
    ]);
    runs=runPage.data.slice().sort((a,b)=>Number(b.id)-Number(a.id));
    lines=linePage.data.slice();
    truncated=Boolean(runPage.nextCursor);
  }
  function nextDocNo(runs){
    let max=0;
    runs.forEach(r=>{ const m=/(\d+)\s*$/.exec(r.docNo||''); if(m&&+m[1]>max) max=+m[1]; });
    return 'DEP-'+String(max+1).padStart(4,'0');
  }
  function localDateIso(date){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function statusLabel(status){
    return s(status==='posted'?'statusPosted':status==='cancelled'?'statusCancelled':'statusDraft');
  }
  function statusTone(status){
    return status==='posted'?'ok':status==='cancelled'?'neutral':'warn';
  }
  function hasDraft(){
    return runs.some(run=>run.status==='draft');
  }
  function activeModal(){
    const modals=document.querySelectorAll('body > #modalEl');
    return modals[modals.length-1]||null;
  }
  function summaryFor(run){
    const runLines=lines.filter(line=>Number(line.runId)===Number(run.id));
    const assetById=new Map(DB.assets.map(a=>[a.id,a]));
    const byCat=new Map();
    let opening=0;
    let depreciation=0;
    let closing=0;
    runLines.forEach(line=>{
      const asset=assetById.get(line.assetId);
      const cat=asset?asset.cat:'—';
      const cur=byCat.get(cat)||{cat,count:0,opening:0,depreciation:0,closing:0};
      cur.count+=1;
      cur.opening+=assetNumber(line.openingNbv);
      cur.depreciation+=assetNumber(line.depreciationAmount);
      cur.closing+=assetNumber(line.closingNbv);
      byCat.set(cat,cur);
      opening+=assetNumber(line.openingNbv);
      depreciation+=assetNumber(line.depreciationAmount);
      closing+=assetNumber(line.closingNbv);
    });
    return {
      lines:runLines,
      categories:Array.from(byCat.values()).sort((a,b)=>
        s(ASSET_CATEGORY_KEY[a.cat]||a.cat).localeCompare(s(ASSET_CATEGORY_KEY[b.cat]||b.cat))),
      opening,
      depreciation,
      closing,
    };
  }
  function categoryTable(summary){
    if(!summary.categories.length){
      return `<div class="detail-empty depreciation-run-lines-empty">
        ${ic('chart')}<div><b>${esc(s('noRunLines'))}</b></div>
      </div>`;
    }
    return `<div class="depreciation-run-lines-scroll">${buildTable({
      rows:summary.categories,
      rowId:group=>group.cat,
      rowInteraction:()=>({kind:'none',label:''}),
      columns:[
        {label:t('fa.col.category'),align:'l',sticky:true,w:'minmax(170px,1.5fr)',render:group=>`<b>${esc(s(ASSET_CATEGORY_KEY[group.cat]||group.cat))}</b>`},
        {label:s('colAssets'),align:'r',w:'80px',render:group=>`<span class="tnum">${group.count}</span>`},
        {label:s('colOpening'),align:'r',w:'130px',render:group=>`<span class="tnum">${money0(group.opening)}</span>`},
        {label:s('colDep'),align:'r',w:'120px',render:group=>`<span class="tnum">${money0(group.depreciation)}</span>`},
        {label:s('colClosing'),align:'r',w:'130px',render:group=>`<b class="tnum">${money0(group.closing)}</b>`},
      ],
    })}</div>`;
  }
  function detailContent(run){
    const summary=summaryFor(run);
    const note=run.status==='posted'
      ?s('postedNote').replace('{amount}',money0(assetNumber(run.totalAmount)))
      :run.status==='cancelled'
        ?s('cancelledNote')
        :s('draftNote').replace('{amount}',money0(assetNumber(run.totalAmount)));
    const actions=run.status==='draft'
      ?btn(s('postButton'),{icon:'book',cls:'primary',sm:false,attrs:`data-depreciation-post="${run.id}"`})
      :run.status==='posted'
        ?btn(s('viewGl'),{icon:'book',cls:'soft',sm:false,attrs:'data-depreciation-gl'})
        :'';
    return `<div class="detail-head depreciation-run-detail-head">
        <span class="grabber"></span>
        <button class="close" data-master-detail-close>${ic('chevL')}${esc(t('common.close'))}</button>
        <div class="dh-top">
          <span class="depreciation-run-icon">${ic('chart')}</span>
          <div><h2>${esc(run.docNo)}</h2><span class="sub">${esc(dateValue(run.runDate))} · ${summary.lines.length} ${esc(s('assetsWord'))}</span></div>
          <div class="depreciation-run-status">${cap(statusLabel(run.status),statusTone(run.status))}</div>
        </div>
      </div>
      <div class="detail-body depreciation-run-detail-body" data-depreciation-run-detail="${run.id}">
        <div class="depreciation-run-kpis">
          <div class="stat"><small>${esc(s('colAssets'))}</small><b class="tnum">${summary.lines.length}</b></div>
          <div class="stat"><small>${esc(s('colOpening'))}</small><b class="tnum">${money0(summary.opening)}</b></div>
          <div class="stat"><small>${esc(s('colDep'))}</small><b class="tnum">${money0(summary.depreciation)}</b></div>
          <div class="stat"><small>${esc(s('colClosing'))}</small><b class="tnum">${money0(summary.closing)}</b></div>
        </div>
        <div class="card depreciation-run-facts">
          <div class="field"><span class="k">${esc(s('fieldRunDate'))}</span><span class="v">${esc(dateValue(run.runDate))}</span></div>
          <div class="field"><span class="k">${esc(s('fieldMethod'))}</span><span class="v">${esc(s('straightLine'))}</span></div>
          <div class="field"><span class="k">${esc(s('fieldGlAccounts'))}</span><span class="v">Dr 6200 · Cr 1510</span></div>
          <div class="field"><span class="k">${esc(t('col.status'))}</span><span class="v">${cap(statusLabel(run.status),statusTone(run.status))}</span></div>
        </div>
        <div class="panel depreciation-run-categories">
          <div class="panel-h"><h3>${esc(t('fa.col.category'))}</h3><small>${summary.categories.length}</small></div>
          ${categoryTable(summary)}
        </div>
        <div class="note rule depreciation-run-note ${run.status==='posted'?'ok':run.status==='cancelled'?'':'warn'}">${esc(note)}</div>
      </div>
      ${actions?`<div class="set-savebar depreciation-run-actions" data-depreciation-actions>
        <div class="grow"></div>${actions}
      </div>`:''}`;
  }
  function openCreateRun(){
    if(hasDraft()){
      toast(s('pendingRunNote'),'warn');
      return;
    }
    const docNo=nextDocNo(runs);
    appModal({
      icon:'play',
      title:s('newRunTitle'),
      width:620,
      body:`<p class="depreciation-run-modal-description">${esc(s('noRunBody'))}</p>
        <div class="alert danger depreciation-run-modal-error" data-depreciation-create-error role="alert" hidden></div>
        <div class="depreciation-run-modal-facts">
          <div><span>${esc(s('fieldDocNo'))}</span><b class="mono">${esc(docNo)}</b></div>
          <div><span>${esc(s('fieldMethod'))}</span><b>${esc(s('straightLine'))}</b></div>
        </div>
        <div class="fld depreciation-run-date-field">
          <span>${esc(s('fieldRunDate'))} <span class="req">*</span></span>
          <input id="depRunDate" type="date" value="${localDateIso(new Date())}">
        </div>`,
      actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}
        ${btn(s('runButton'),{icon:'play',cls:'primary',sm:false,attrs:'data-depreciation-create'})}`,
    });
    const modal=activeModal();
    const create=modal.querySelector('[data-depreciation-create]');
    const errorRoot=modal.querySelector('[data-depreciation-create-error]');
    create.addEventListener('click',async()=>{
      const runDate=modal.querySelector('#depRunDate').value;
      if(!runDate){
        errorRoot.hidden=false;
        errorRoot.innerHTML=`${ic('warn')}<span>${esc(s('runDateRequired'))}</span>`;
        modal.querySelector('#depRunDate').focus();
        return;
      }
      errorRoot.hidden=true;
      errorRoot.innerHTML='';
      create.disabled=true;
      try{
        const response=await window.ErpSystemData.create('assets/depreciation-runs',{docNo,runDate});
        await refreshState();
        primaryAction.disabled=hasDraft();
        const createdId=Number(response&&response.data&&response.data.id)||Number(runs[0]&&runs[0].id);
        closeModal();
        toast(s('runCreated'),'ok');
        page.render();
        if(isDesktop()&&createdId) page.select(createdId);
      }catch(error){
        const message=error&&error.message?error.message:s('runError');
        errorRoot.hidden=false;
        errorRoot.innerHTML=`${ic('warn')}<span>${esc(message)}</span>`;
        create.disabled=false;
      }
    });
  }
  function confirmPost(run){
    const body=s('confirmPostBody')
      .replace('{docNo}',run.docNo)
      .replace('{amount}',money0(assetNumber(run.totalAmount)));
    appModal({
      icon:'book',
      title:s('confirmPostTitle'),
      width:560,
      body:`<div class="alert danger depreciation-run-modal-error" data-depreciation-post-error role="alert" hidden></div>
        <p class="depreciation-run-confirm">${esc(body)}</p>`,
      actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}
        ${btn(s('postButton'),{icon:'book',cls:'primary',sm:false,attrs:`data-depreciation-post-confirm="${run.id}"`})}`,
    });
    const modal=activeModal();
    const confirm=modal.querySelector('[data-depreciation-post-confirm]');
    const errorRoot=modal.querySelector('[data-depreciation-post-error]');
    confirm.addEventListener('click',async()=>{
      confirm.disabled=true;
      errorRoot.hidden=true;
      errorRoot.innerHTML='';
      try{
        await window.ErpSystemData.action('assets/depreciation-runs',run.id,'post',{},`post-depreciation-run-${run.id}`);
        await refreshState();
        primaryAction.disabled=hasDraft();
        closeModal();
        toast(s('postSuccess').replace('{amount}',money0(assetNumber(run.totalAmount))),'ok');
        page.render();
      }catch(error){
        const message=error&&error.message?error.message:s('postError');
        errorRoot.hidden=false;
        errorRoot.innerHTML=`${ic('warn')}<span>${esc(message)}</span>`;
        confirm.disabled=false;
      }
    });
  }

  await refreshState();
  const primaryAction={
    label:s('runButton'),
    icon:'play',
    onClick:openCreateRun,
    disabled:hasDraft(),
  };
  page=masterDetailRegisterPage(root,{
    module:'asset',
    route:'depreciation',
    title:s('runTitle'),
    description:s('noRunBody'),
    rows:()=>runs,
    rowId:run=>run.id,
    initialFilter:'all',
    filters:[
      ['all',t('common.all')],
      ['draft',s('statusDraft')],
      ['posted',s('statusPosted')],
      ['cancelled',s('statusCancelled')],
    ],
    filterFn:(run,status)=>run.status===status,
    kpis:()=>{
      const latest=runs[0];
      return [
        {label:s('kpiTotalRuns'),value:runs.length,filter:'all'},
        {label:s('kpiDraftRuns'),value:runs.filter(run=>run.status==='draft').length,filter:'draft'},
        {label:s('kpiPostedRuns'),value:runs.filter(run=>run.status==='posted').length,filter:'posted'},
        {label:s('kpiLatestDep'),value:latest?money0(assetNumber(latest.totalAmount)):'—',accent:Boolean(latest)},
      ];
    },
    count:()=>runs.length,
    primaryAction,
    note:()=>hasDraft()?s('pendingRunNote'):truncated?s('dataLimit'):'',
    columns:[
      {label:s('colRun'),align:'l',sticky:true,w:'minmax(150px,1.4fr)',render:run=>`<div class="cellsub"><b>${esc(run.docNo)}</b><small>${esc(dateValue(run.runDate))}</small></div>`},
      {label:s('fieldRunDate'),align:'l',w:'120px',render:run=>esc(dateValue(run.runDate))},
      {label:s('colAssets'),align:'r',w:'90px',render:run=>`<span class="tnum">${summaryFor(run).lines.length}</span>`},
      {label:s('colDep'),align:'r',w:'140px',render:run=>`<b class="tnum">${money0(assetNumber(run.totalAmount))}</b>`},
      {label:t('col.status'),align:'l',w:'110px',render:run=>cap(statusLabel(run.status),statusTone(run.status))},
    ],
    empty:{icon:'chart',title:s('noRunYet'),description:s('noRunBody')},
    detailPane:{
      rowLabel:run=>`${t('common.open')} ${run.docNo}`,
      initialSelectedId:()=>isDesktop()?runs[0]?.id??null:null,
      selectionOnFilter:visible=>isDesktop()?visible[0]?.id??null:null,
      empty:`<div class="detail-empty">${ic('chart')}<div><b>${esc(s('selectRun'))}</b><small>${esc(s('selectRunBody'))}</small></div></div>`,
      content:detailContent,
      afterRender:({detailRoot,row})=>{
        if(!detailRoot||!row) return;
        detailRoot.querySelector('[data-depreciation-post]')?.addEventListener('click',()=>confirmPost(row));
        detailRoot.querySelector('[data-depreciation-gl]')?.addEventListener('click',()=>navigate('gl'));
      },
    },
    afterRender:({root:listRoot})=>{
      const layoutRoot=listRoot.querySelector('[data-list-route="depreciation"]');
      if(layoutRoot) layoutRoot.setAttribute('data-canonical-depreciation','true');
      const primary=listRoot.querySelector('[data-list-primary-action]');
      if(primary&&primaryAction.disabled){
        primary.title=s('pendingRunNote');
        primary.setAttribute('aria-label',`${s('runButton')}: ${s('pendingRunNote')}`);
      }
    },
  });
};
