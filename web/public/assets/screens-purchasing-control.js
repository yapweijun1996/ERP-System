/* ============================================================
   ARIA ERP — Purchasing module: controls
   PO Approvals · Supplier Price Lists / Contracts ·
   Landed Cost · Vendor Performance
   ============================================================ */

/* ---------------- PO APPROVALS (queue) ---------------- */
function poApprovalCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'Purchase Order Approvals',unit:'requests',sub:'Review every newly created purchase order before it can be received. Decisions are audited and never post inventory or accounting entries.',all:'All',pending:'Pending',approved:'Approved',rejected:'Rejected',awaiting:'Awaiting approval',queueValue:'Value awaiting approval',approvedCount:'Approved',rejectedCount:'Rejected',po:'Purchase order',supplier:'Supplier',date:'Order date',total:'Total',submitted:'Submitted',status:'Decision',review:'Review request',details:'Approval request',lineItems:'Order lines',item:'Item',qty:'Quantity',unitCost:'Unit cost',tax:'Tax',net:'Net amount',decision:'Decision record',decidedBy:'Decided by',decidedAt:'Decided at',note:'Decision note',approve:'Approve PO',reject:'Reject PO',approveTitle:'Approve purchase order?',rejectTitle:'Reject purchase order?',approvePrompt:'Record why this purchase order may proceed to receiving.',rejectPrompt:'Record why this purchase order must not proceed.',notePlaceholder:'Enter a concise, auditable reason…',cancel:'Cancel',confirm:'Confirm decision',approvedDone:'Purchase order approved',rejectedDone:'Purchase order rejected',back:'Back to approvals',orderStatus:'Order status',accountingNote:'Approval changes document status only. Stock movements begin at goods receipt; accounting begins at supplier-invoice posting.',empty:'There are no purchase-order approval requests in this company.',pendingDecision:'Awaiting an authorised decision.'},
    ms:{title:'Kelulusan Pesanan Belian',unit:'permintaan',sub:'Semak setiap pesanan belian baharu sebelum penerimaan barang. Keputusan diaudit dan tidak pernah mempost inventori atau perakaunan.',all:'Semua',pending:'Menunggu',approved:'Diluluskan',rejected:'Ditolak',awaiting:'Menunggu kelulusan',queueValue:'Nilai menunggu kelulusan',approvedCount:'Diluluskan',rejectedCount:'Ditolak',po:'Pesanan belian',supplier:'Pembekal',date:'Tarikh pesanan',total:'Jumlah',submitted:'Dihantar',status:'Keputusan',review:'Semak permintaan',details:'Permintaan kelulusan',lineItems:'Baris pesanan',item:'Item',qty:'Kuantiti',unitCost:'Kos seunit',tax:'Cukai',net:'Amaun bersih',decision:'Rekod keputusan',decidedBy:'Diputuskan oleh',decidedAt:'Masa keputusan',note:'Nota keputusan',approve:'Luluskan PO',reject:'Tolak PO',approveTitle:'Luluskan pesanan belian?',rejectTitle:'Tolak pesanan belian?',approvePrompt:'Catat sebab pesanan ini boleh diteruskan ke penerimaan.',rejectPrompt:'Catat sebab pesanan ini tidak boleh diteruskan.',notePlaceholder:'Masukkan sebab ringkas yang boleh diaudit…',cancel:'Batal',confirm:'Sahkan keputusan',approvedDone:'Pesanan belian diluluskan',rejectedDone:'Pesanan belian ditolak',back:'Kembali ke kelulusan',orderStatus:'Status pesanan',accountingNote:'Kelulusan hanya mengubah status dokumen. Pergerakan stok bermula semasa penerimaan; perakaunan bermula semasa invois pembekal diposting.',empty:'Tiada permintaan kelulusan pesanan belian untuk syarikat ini.',pendingDecision:'Menunggu keputusan pengguna yang diberi kuasa.'},
    zh:{title:'采购订单审批',unit:'项申请',sub:'每张新采购订单必须先审批才能收货。所有决定均可审计，审批本身不会过账库存或会计分录。',all:'全部',pending:'待审批',approved:'已批准',rejected:'已拒绝',awaiting:'待审批数量',queueValue:'待审批金额',approvedCount:'已批准',rejectedCount:'已拒绝',po:'采购订单',supplier:'供应商',date:'订单日期',total:'总额',submitted:'提交时间',status:'审批结果',review:'审核申请',details:'审批申请',lineItems:'订单明细',item:'物料',qty:'数量',unitCost:'单位成本',tax:'税额',net:'未税金额',decision:'审批记录',decidedBy:'审批人',decidedAt:'审批时间',note:'审批备注',approve:'批准订单',reject:'拒绝订单',approveTitle:'批准这张采购订单？',rejectTitle:'拒绝这张采购订单？',approvePrompt:'请记录允许此采购订单进入收货流程的原因。',rejectPrompt:'请记录不允许此采购订单继续执行的原因。',notePlaceholder:'请输入简洁、可审计的原因…',cancel:'取消',confirm:'确认决定',approvedDone:'采购订单已批准',rejectedDone:'采购订单已拒绝',back:'返回审批列表',orderStatus:'订单状态',accountingNote:'审批只改变单据状态；库存流水从收货开始，会计分录从供应商发票过账开始。',empty:'当前公司没有采购订单审批申请。',pendingDecision:'等待授权用户作出决定。'},
    ja:{title:'購買発注承認',unit:'件',sub:'新しい購買発注は入荷前に承認します。判断は監査され、承認自体は在庫・会計を転記しません。',all:'すべて',pending:'承認待ち',approved:'承認済',rejected:'却下',awaiting:'承認待ち',queueValue:'承認待ち金額',approvedCount:'承認済',rejectedCount:'却下',po:'購買発注',supplier:'仕入先',date:'発注日',total:'合計',submitted:'申請日時',status:'判断',review:'申請を確認',details:'承認申請',lineItems:'発注明細',item:'品目',qty:'数量',unitCost:'単価',tax:'税額',net:'税抜金額',decision:'判断記録',decidedBy:'判断者',decidedAt:'判断日時',note:'判断メモ',approve:'発注を承認',reject:'発注を却下',approveTitle:'購買発注を承認しますか？',rejectTitle:'購買発注を却下しますか？',approvePrompt:'この発注を入荷へ進める理由を記録してください。',rejectPrompt:'この発注を進めない理由を記録してください。',notePlaceholder:'簡潔で監査可能な理由を入力…',cancel:'キャンセル',confirm:'判断を確定',approvedDone:'購買発注を承認しました',rejectedDone:'購買発注を却下しました',back:'承認一覧へ戻る',orderStatus:'発注ステータス',accountingNote:'承認は伝票ステータスのみ変更します。在庫移動は入荷、会計転記は仕入先請求書から始まります。',empty:'この会社には購買発注承認申請がありません。',pendingDecision:'権限を持つユーザーの判断待ちです。'},
    vi:{title:'Phê duyệt đơn mua hàng',unit:'yêu cầu',sub:'Mọi đơn mua hàng mới phải được duyệt trước khi nhận hàng. Quyết định được kiểm toán và không tự ghi sổ kho hay kế toán.',all:'Tất cả',pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Đã từ chối',awaiting:'Đang chờ duyệt',queueValue:'Giá trị chờ duyệt',approvedCount:'Đã duyệt',rejectedCount:'Đã từ chối',po:'Đơn mua hàng',supplier:'Nhà cung cấp',date:'Ngày đặt hàng',total:'Tổng',submitted:'Đã gửi',status:'Quyết định',review:'Xem yêu cầu',details:'Yêu cầu phê duyệt',lineItems:'Dòng đơn hàng',item:'Mặt hàng',qty:'Số lượng',unitCost:'Đơn giá',tax:'Thuế',net:'Giá trị chưa thuế',decision:'Biên bản quyết định',decidedBy:'Người quyết định',decidedAt:'Thời điểm quyết định',note:'Ghi chú quyết định',approve:'Duyệt PO',reject:'Từ chối PO',approveTitle:'Duyệt đơn mua hàng?',rejectTitle:'Từ chối đơn mua hàng?',approvePrompt:'Ghi rõ lý do cho phép đơn hàng chuyển sang nhận hàng.',rejectPrompt:'Ghi rõ lý do không cho phép đơn hàng tiếp tục.',notePlaceholder:'Nhập lý do ngắn gọn, có thể kiểm toán…',cancel:'Hủy',confirm:'Xác nhận quyết định',approvedDone:'Đã duyệt đơn mua hàng',rejectedDone:'Đã từ chối đơn mua hàng',back:'Quay lại danh sách duyệt',orderStatus:'Trạng thái đơn',accountingNote:'Phê duyệt chỉ đổi trạng thái chứng từ. Biến động kho bắt đầu khi nhận hàng; bút toán bắt đầu khi ghi sổ hóa đơn nhà cung cấp.',empty:'Không có yêu cầu phê duyệt đơn mua hàng trong công ty này.',pendingDecision:'Đang chờ quyết định của người có thẩm quyền.'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}
function poApprovalLabel(status){const s=poApprovalCopy();return s(status==='pending'?'pending':status==='approved'?'approved':'rejected');}
function poApprovalTone(status){return status==='approved'?'ok':status==='rejected'?'danger':'warn';}
function openPoApprovalDecision(request,decision){
  const s=poApprovalCopy();
  const approve=decision==='approve';
  appModal({icon:approve?'checkc':'x',title:s(approve?'approveTitle':'rejectTitle'),width:560,body:
    `<p style="color:var(--muted);font-size:13.5px;margin-top:0">${esc(s(approve?'approvePrompt':'rejectPrompt'))}</p><div class="fld"><span>${esc(s('note'))}</span><textarea id="poApprovalNote" maxlength="1000" placeholder="${esc(s('notePlaceholder'))}"></textarea></div>`,
    actions:btn(s('cancel'),{cls:'soft',attrs:'data-po-decision-cancel'})+btn(s('confirm'),{icon:approve?'check':'x',cls:approve?'primary':'danger',attrs:'data-po-decision-confirm'})});
  document.querySelector('[data-po-decision-cancel]')?.addEventListener('click',closeModal);
  document.querySelector('[data-po-decision-confirm]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;const note=document.querySelector('#poApprovalNote').value.trim();
    if(!note){toast(s('notePlaceholder'),'warn');return;}
    button.disabled=true;
    try{
      await window.ErpSystemData.action('purchasing/purchase-orders',request.orderId,decision,{note},`po-approval-${request.id}-v${request.version}-${decision}`);
      closeModal();toast(s(approve?'approvedDone':'rejectedDone'),'ok');
      navigate('po-approval',{purchaseOrderId:request.orderId});
    }catch(error){button.disabled=false;toast(error&&error.message||'Decision failed','danger');}
  });
}
makePurList({
  route:'po-approvals', active:'po-approvals', title:()=>poApprovalCopy()('title'), unit:()=>poApprovalCopy()('unit'),
  sub:()=>poApprovalCopy()('sub'),prepare:prepareCanonicalPurchasingData,
  rows:()=>DB.purchaseOrderApprovals, rowId:p=>p.id,
  chips:[['all',()=>poApprovalCopy()('all')],['pending',()=>poApprovalCopy()('pending')],['approved',()=>poApprovalCopy()('approved')],['rejected',()=>poApprovalCopy()('rejected')]],
  filterFn:(p,f)=>p.status===f,
  kpis:(r)=>[
    {label:()=>poApprovalCopy()('awaiting'),val:r.filter(p=>p.status==='pending').length,accent:true,f:'pending'},
    {label:()=>poApprovalCopy()('queueValue'),val:money0(r.filter(p=>p.status==='pending').reduce((a,p)=>a+p.total,0))},
    {label:()=>poApprovalCopy()('approvedCount'),val:r.filter(p=>p.status==='approved').length,f:'approved'},
    {label:()=>poApprovalCopy()('rejectedCount'),val:r.filter(p=>p.status==='rejected').length,neg:true,f:'rejected'},
  ],
  columns:[
    {label:()=>poApprovalCopy()('po'),w:'minmax(145px,1.2fr)',render:p=>docNoCell(p.no,p.orderDate)},
    {label:()=>poApprovalCopy()('supplier'),align:'l',w:'minmax(170px,1.6fr)',render:p=>suppCell(p.supplier,p.supplierCode)},
    {label:()=>poApprovalCopy()('total'),align:'r',sortable:true,w:'minmax(110px,1fr)',render:p=>`<b class="tnum">${money(p.total,p.currency)}</b>`},
    {label:()=>poApprovalCopy()('submitted'),align:'l',w:'minmax(135px,1.2fr)',render:p=>`<span style="color:var(--muted)">${esc(p.submittedAt)}</span>`},
    {label:()=>poApprovalCopy()('status'),align:'l',cls:'cap-cell',w:'minmax(120px,1fr)',render:p=>cap(poApprovalLabel(p.status),poApprovalTone(p.status))},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(p)=>[{id:'review',icon:'ext',label:poApprovalCopy()('review'),run:()=>navigate('po-approval',{purchaseOrderId:p.orderId})}],
  onOpen:(p)=>navigate('po-approval',{purchaseOrderId:p.orderId}),
});

SCREENS['po-approval']=async function(root,params){
  const s=poApprovalCopy();
  await prepareCanonicalPurchasingData();
  const requestedId=params&&params.purchaseOrderId?Number(params.purchaseOrderId):null;
  const requests=DB.purchaseOrderApprovals||[];
  const request=(requestedId?requests.find(row=>row.orderId===requestedId):null)
    ||requests.find(row=>row.status==='pending')||requests[0];
  if(!request){root.innerHTML=purPage({route:'po-approval',active:'po-approvals',title:s('details'),sub:s('sub'),body:`<div class="emptystate"><b>${esc(s('empty'))}</b></div>`});return;}
  const lines=buildTable({rowId:line=>line.id,columns:[
    {label:s('item'),w:'minmax(190px,1.8fr)',render:line=>`<div class="cellsub"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></div>`},
    {label:s('qty'),align:'r',w:'minmax(80px,.7fr)',render:line=>`<span class="tnum">${num(line.qty)} ${esc(line.uom)}</span>`},
    {label:s('unitCost'),align:'r',w:'minmax(100px,.9fr)',render:line=>`<span class="tnum">${money(line.unitCost,request.currency)}</span>`},
    {label:s('tax'),align:'r',w:'minmax(92px,.8fr)',render:line=>`<span class="tnum">${money(line.tax,request.currency)}</span><small style="display:block;color:var(--muted)">${esc(line.taxCode)} · ${num(line.taxRate)}%</small>`},
    {label:s('net'),align:'r',w:'minmax(110px,1fr)',render:line=>`<b class="tnum">${money(line.net,request.currency)}</b>`},
  ],rows:request.lines});
  const decision=request.status==='pending'
    ?`<div class="callout info">${ic('clock')}<span>${esc(s('pendingDecision'))}</span></div>`
    :`<div class="timeline"><div class="tl ${request.status==='approved'?'ok':'danger'}"><span class="tldot"></span><div class="tlbody"><div class="when">${esc(request.decidedAt||'—')}</div><div class="what">${esc(poApprovalLabel(request.status))} · ${esc(request.decidedByName||'—')}</div><div class="det">${esc(request.decisionNote||'—')}</div></div></div></div>`;
  root.innerHTML=`<div class="content full"><section class="master"><div class="scrollarea"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,{label:s('title'),route:'po-approvals'},{cur:request.no}])}${purNav('po-approvals')}
    <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('cart')} ${esc(s('details'))} <span class="dnum">${esc(request.no)}</span></div><div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(request.supplier)} · ${esc(request.supplierCode)}</div></div><div class="dactions">${cap(poApprovalLabel(request.status),poApprovalTone(request.status))}</div></div>
      <div class="docmeta"><div class="dm"><small>${esc(s('supplier'))}</small><b>${esc(request.supplier)}</b></div><div class="dm"><small>${esc(s('date'))}</small><b>${esc(request.orderDate)}</b></div><div class="dm"><small>${esc(s('submitted'))}</small><b>${esc(request.submittedAt)}</b></div><div class="dm"><small>${esc(s('orderStatus'))}</small><b>${esc(request.orderStatus)}</b></div></div>
    </div>
    <div class="appr-layout"><div class="docmain"><div class="panel"><div class="panel-h"><h3>${esc(s('lineItems'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${request.lines.length}</span></div><div class="tablewrap">${lines}</div></div><div class="callout info" style="margin-top:14px">${ic('lock')}<span>${esc(s('accountingNote'))}</span></div></div>
      <aside><div class="sumcard"><div class="sumrow"><span class="sk2">${esc(s('net'))}</span><span class="sv tnum">${money(request.net,request.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('tax'))}</span><span class="sv tnum">${money(request.tax,request.currency)}</span></div><div class="sumrow total"><span class="sk2">${esc(s('total'))}</span><span class="sv tnum">${money(request.total,request.currency)}</span></div></div><div class="sumcard" style="margin-top:14px"><div class="sectitle" style="margin-top:0">${esc(s('decision'))}</div>${decision}</div></aside>
    </div>
  </div></div></div><div class="responsive-actionbar">${btn(s('back'),{icon:'chevleft',cls:'soft',attrs:'data-po-back'})}<div class="grow"></div>${request.status==='pending'?btn(s('reject'),{icon:'x',cls:'danger',attrs:'data-po-reject'})+btn(s('approve'),{icon:'check',cls:'primary',sm:false,attrs:'data-po-approve'}):''}</div></section></div>`;
  root.querySelector('[data-po-back]')?.addEventListener('click',()=>navigate('po-approvals'));
  root.querySelector('[data-po-approve]')?.addEventListener('click',()=>openPoApprovalDecision(request,'approve'));
  root.querySelector('[data-po-reject]')?.addEventListener('click',()=>openPoApprovalDecision(request,'reject'));
};

/* ---------------- SUPPLIER PRICE LISTS / CONTRACTS ---------------- */
makePurList({
  route:'supplier-price-lists', title:'Supplier Price Lists', unit:'contracts',
  sub:'Supplier-specific pricing and contract terms applied automatically on purchase orders — contract price, MOQ, currency, lead-time and effective dates.',
  rows:()=>DB.supplierPriceLists, rowId:p=>p.code,
  chips:[['all','All'],['active','Active'],['preferred','Preferred'],['expiring','Expiring']],
  filterFn:(p,f)=>f==='active'?p.status==='Active':f==='preferred'?p.preferred:p.status==='Expiring',
  kpis:(r)=>[
    {label:'Active contracts', val:r.filter(p=>p.status==='Active').length, f:'active'},
    {label:'Preferred', val:r.filter(p=>p.preferred).length, accent:true, f:'preferred'},
    {label:'Expiring', val:r.filter(p=>p.status==='Expiring').length, neg:true, f:'expiring'},
    {label:'Suppliers', val:new Set(r.map(p=>p.supplier)).size},
  ],
  newBtn:{label:'New price list', onClick:()=>toast('New supplier price list / contract','info')},
  columns:[
    {label:'Code', w:'minmax(130px,1.1fr)', render:p=>`<b class="docnum">${esc(p.code)}</b>`},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:p=>suppCell(p.supplier)},
    {label:'Scope', align:'l', w:'minmax(160px,1.8fr)', render:p=>`<span class="li-subj">${esc(p.scope)}</span>`},
    {label:'MOQ', align:'r', w:'minmax(64px,0.6fr)', render:p=>num(p.moq)},
    {label:'Lead', align:'r', w:'minmax(56px,0.5fr)', render:p=>`${p.leadTime}d`},
    {label:'Effective', align:'l', w:'minmax(100px,1fr)', render:p=>`<span style="color:var(--muted)">${esc(p.effective)}</span>`},
    {label:'Expiry', align:'l', w:'minmax(100px,1fr)', render:p=>`<span style="color:${p.status==='Expiring'?'var(--warn)':'var(--muted)'}">${esc(p.expiry)}</span>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:p=>(p.preferred?cap('Preferred','accent')+' ':'')+cap(p.status,SPL_TONE[p.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(p)=>[
    {id:'view',icon:'ext',label:'Open contract',run:()=>toast(`Opening ${p.code}`,'info')},
    {id:'renew',icon:'refresh',label:'Renew',run:()=>toast(`${p.code} renewal drafted`,'info')},
    {id:'pref',icon:'star',label:p.preferred?'Unset preferred':'Set preferred',run:()=>toast(`${p.supplier} ${p.preferred?'unset':'set'} preferred`,'ok')},
    {id:'end',icon:'x',label:'End contract',danger:true,sep:true,run:()=>toast(`${p.code} ended`,'danger')},
  ],
  onOpen:(p)=>toast(`Opening ${p.code}`,'info'),
});

/* ---------------- LANDED COST ---------------- */
function landedCostCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'Landed Cost',unit:'records',sub:'Capitalize tax-exclusive freight, duty and handling against received goods. Allocation revalues moving-average inventory cost without changing quantity.',all:'All',draft:'Draft',allocated:'Allocated',records:'Records',goodsValue:'Goods value',addedCost:'Added cost',newCost:'New landed cost',record:'Record',against:'Against receipt',supplier:'Supplier',basis:'Basis',byValue:'By value',byQuantity:'By quantity',goods:'Goods',status:'Status',open:'Open record',allocate:'Allocate to inventory',close:'Close',costDate:'Cost date',receipt:'Goods receipt',chooseReceipt:'Choose a posted goods receipt',freight:'Freight',duty:'Import duty',handling:'Handling',other:'Other',create:'Create draft',created:'Landed cost draft created',allocatedDone:'Landed cost allocated',totalAdded:'Total added cost',totalValue:'Total landed value',items:'Allocation lines',item:'Item',quantity:'Received qty',share:'Allocated',before:'Cost before',after:'Cost after',pending:'Pending allocation',accounting:'Allocation debits Inventory and credits Landed Cost Accrual. It creates no stock movement and excludes recoverable tax.',taxExclusive:'Enter tax-exclusive capitalization amounts; process any supplier tax invoice separately.',viewInventory:'View inventory',viewLedger:'View General Ledger',noReceipts:'No posted goods receipts are available yet.',enterCost:'Enter at least one positive cost component.'},
    ms:{title:'Kos Mendarat',unit:'rekod',sub:'Permodalkan tambang, duti dan pengendalian tanpa cukai kepada barang diterima. Peruntukan menilai semula kos purata bergerak tanpa mengubah kuantiti.',all:'Semua',draft:'Draf',allocated:'Diperuntukkan',records:'Rekod',goodsValue:'Nilai barang',addedCost:'Kos tambahan',newCost:'Kos mendarat baharu',record:'Rekod',against:'Terhadap penerimaan',supplier:'Pembekal',basis:'Asas',byValue:'Mengikut nilai',byQuantity:'Mengikut kuantiti',goods:'Barang',status:'Status',open:'Buka rekod',allocate:'Peruntuk ke inventori',close:'Tutup',costDate:'Tarikh kos',receipt:'Penerimaan barang',chooseReceipt:'Pilih penerimaan barang diposting',freight:'Tambang',duty:'Duti import',handling:'Pengendalian',other:'Lain-lain',create:'Cipta draf',created:'Draf kos mendarat dicipta',allocatedDone:'Kos mendarat diperuntukkan',totalAdded:'Jumlah kos tambahan',totalValue:'Jumlah nilai mendarat',items:'Baris peruntukan',item:'Item',quantity:'Kuantiti diterima',share:'Diperuntukkan',before:'Kos sebelum',after:'Kos selepas',pending:'Menunggu peruntukan',accounting:'Peruntukan mendebit Inventori dan mengkredit Akruan Kos Mendarat. Tiada pergerakan stok dan cukai boleh pulih dikecualikan.',taxExclusive:'Masukkan amaun permodalan tanpa cukai; proses invois cukai pembekal secara berasingan.',viewInventory:'Lihat inventori',viewLedger:'Lihat Lejar Am',noReceipts:'Belum ada penerimaan barang diposting.',enterCost:'Masukkan sekurang-kurangnya satu komponen kos positif.'},
    zh:{title:'落地成本',unit:'笔记录',sub:'将不含税的运费、关税和处理费资本化到已收货物料。分摊会重估移动平均库存成本，但不会改变数量。',all:'全部',draft:'草稿',allocated:'已分摊',records:'记录数',goodsValue:'货物价值',addedCost:'新增成本',newCost:'新建落地成本',record:'记录',against:'对应收货单',supplier:'供应商',basis:'分摊依据',byValue:'按金额',byQuantity:'按数量',goods:'货物',status:'状态',open:'打开记录',allocate:'分摊至库存',close:'关闭',costDate:'成本日期',receipt:'收货单',chooseReceipt:'选择已过账收货单',freight:'运费',duty:'进口关税',handling:'处理费',other:'其他',create:'创建草稿',created:'落地成本草稿已创建',allocatedDone:'落地成本已分摊',totalAdded:'新增成本合计',totalValue:'落地价值合计',items:'分摊明细',item:'物料',quantity:'收货数量',share:'分摊金额',before:'分摊前成本',after:'分摊后成本',pending:'等待分摊',accounting:'分摊借记库存、贷记落地成本应计；不会生成库存数量流水，也不包含可抵扣税额。',taxExclusive:'请输入不含税的资本化金额；供应商税务发票应另行处理。',viewInventory:'查看库存',viewLedger:'查看总账',noReceipts:'目前没有可用的已过账收货单。',enterCost:'请至少输入一个大于零的成本项目。'},
    ja:{title:'陸揚げ費',unit:'件',sub:'税抜の運賃・関税・取扱費を入荷済商品へ資産計上します。配賦は数量を変えず移動平均在庫原価を再評価します。',all:'すべて',draft:'ドラフト',allocated:'配賦済',records:'件数',goodsValue:'商品価額',addedCost:'追加原価',newCost:'陸揚げ費を作成',record:'記録',against:'入荷対象',supplier:'仕入先',basis:'配賦基準',byValue:'価額基準',byQuantity:'数量基準',goods:'商品',status:'ステータス',open:'記録を開く',allocate:'在庫へ配賦',close:'閉じる',costDate:'原価日',receipt:'入荷伝票',chooseReceipt:'転記済入荷伝票を選択',freight:'運賃',duty:'輸入関税',handling:'取扱費',other:'その他',create:'ドラフト作成',created:'陸揚げ費ドラフトを作成しました',allocatedDone:'陸揚げ費を配賦しました',totalAdded:'追加原価合計',totalValue:'陸揚げ価額合計',items:'配賦明細',item:'品目',quantity:'入荷数量',share:'配賦額',before:'配賦前原価',after:'配賦後原価',pending:'配賦待ち',accounting:'在庫を借記し陸揚げ費未払を貸記します。在庫数量移動は作成せず、回収可能税は含みません。',taxExclusive:'税抜の資産計上額を入力し、仕入先税務請求書は別途処理してください。',viewInventory:'在庫を表示',viewLedger:'総勘定元帳を表示',noReceipts:'利用可能な転記済入荷伝票がありません。',enterCost:'1つ以上の正の原価項目を入力してください。'},
    vi:{title:'Chi phí nhập kho',unit:'bản ghi',sub:'Vốn hóa cước, thuế nhập khẩu và xử lý chưa thuế vào hàng đã nhận. Phân bổ đánh giá lại giá vốn bình quân mà không đổi số lượng.',all:'Tất cả',draft:'Nháp',allocated:'Đã phân bổ',records:'Bản ghi',goodsValue:'Giá trị hàng',addedCost:'Chi phí thêm',newCost:'Tạo chi phí nhập kho',record:'Bản ghi',against:'Theo phiếu nhận',supplier:'Nhà cung cấp',basis:'Cơ sở',byValue:'Theo giá trị',byQuantity:'Theo số lượng',goods:'Hàng hóa',status:'Trạng thái',open:'Mở bản ghi',allocate:'Phân bổ vào tồn kho',close:'Đóng',costDate:'Ngày chi phí',receipt:'Phiếu nhận hàng',chooseReceipt:'Chọn phiếu nhận đã ghi sổ',freight:'Cước vận chuyển',duty:'Thuế nhập khẩu',handling:'Phí xử lý',other:'Khác',create:'Tạo bản nháp',created:'Đã tạo bản nháp chi phí nhập kho',allocatedDone:'Đã phân bổ chi phí nhập kho',totalAdded:'Tổng chi phí thêm',totalValue:'Tổng giá trị nhập kho',items:'Dòng phân bổ',item:'Mặt hàng',quantity:'Số lượng nhận',share:'Đã phân bổ',before:'Giá vốn trước',after:'Giá vốn sau',pending:'Chờ phân bổ',accounting:'Phân bổ ghi Nợ Tồn kho và Có Chi phí nhập kho phải trả. Không tạo biến động số lượng và không gồm thuế được khấu trừ.',taxExclusive:'Nhập số vốn hóa chưa thuế; xử lý hóa đơn thuế nhà cung cấp riêng.',viewInventory:'Xem tồn kho',viewLedger:'Xem Sổ cái',noReceipts:'Chưa có phiếu nhận hàng đã ghi sổ.',enterCost:'Nhập ít nhất một thành phần chi phí dương.'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}
function nextLandedCostNo(){ return nextSourcingNo(DB.landedCosts,'LC'); }
function landedBasisLabel(value){ const s=landedCostCopy(); return value==='quantity'?s('byQuantity'):s('byValue'); }
function openLanded(l){
  const s=landedCostCopy();
  const lineTable=buildTable({rowId:line=>line.id,columns:[
    {label:s('item'),w:'minmax(180px,1.7fr)',render:line=>`<div class="cellsub"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></div>`},
    {label:s('quantity'),align:'r',w:'minmax(90px,.8fr)',render:line=>`<span class="tnum">${num(line.qty)} ${esc(line.uom)}</span>`},
    {label:s('goodsValue'),align:'r',w:'minmax(100px,.9fr)',render:line=>`<span class="tnum">${money(line.goods,l.currency)}</span>`},
    {label:s('share'),align:'r',w:'minmax(100px,.9fr)',render:line=>`<b class="tnum">${money(line.allocated,l.currency)}</b>`},
    {label:s('after'),align:'r',w:'minmax(112px,1fr)',render:line=>line.costAfter==null?`<span style="color:var(--muted)">${esc(s('pending'))}</span>`:`<span class="tnum">${money(line.costAfter,l.currency)}</span><small style="display:block;color:var(--muted)">${money(line.costBefore,l.currency)}</small>`},
  ],rows:l.lines});
  appModal({icon:'truck',title:`${l.no} · ${l.supplier}`,width:'min(860px,96vw)',body:
    `<div class="docmeta" style="margin-top:0;margin-bottom:14px"><div class="dm"><small>${esc(s('against'))}</small><b>${esc(l.ref)}</b></div><div class="dm"><small>${esc(s('basis'))}</small><b>${esc(landedBasisLabel(l.basis))}</b></div><div class="dm"><small>${esc(s('status'))}</small>${cap(s(l.rawStatus),l.rawStatus==='allocated'?'ok':'neutral')}</div></div>
    <div class="sumcard"><div class="sumrow"><span class="sk2">${esc(s('goodsValue'))}</span><span class="sv tnum">${money(l.goods,l.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('freight'))}</span><span class="sv tnum">${money(l.freight,l.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('duty'))}</span><span class="sv tnum">${money(l.duty,l.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('handling'))}</span><span class="sv tnum">${money(l.handling,l.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('other'))}</span><span class="sv tnum">${money(l.other,l.currency)}</span></div><div class="sumrow total"><span class="sk2">${esc(s('totalAdded'))}</span><span class="sv tnum">${money(l.added,l.currency)}</span></div></div>
    <div class="sectitle" style="margin-top:16px">${esc(s('items'))}</div><div class="tablewrap">${lineTable}</div>
    <div class="callout info" style="margin-top:12px">${ic('lock')}<span>${esc(s('accounting'))}</span></div>`,
    actions:btn(s('close'),{cls:'soft',attrs:'data-landed-close'})+(l.rawStatus==='allocated'?btn(s('viewInventory'),{icon:'box',cls:'soft',attrs:'data-landed-inventory'})+btn(s('viewLedger'),{icon:'receipt',cls:'primary',attrs:'data-landed-ledger'}):btn(s('allocate'),{icon:'check',cls:'primary',attrs:`data-landed-allocate="${l.id}"`}))});
  document.querySelector('[data-landed-close]')?.addEventListener('click',closeModal);
  document.querySelector('[data-landed-inventory]')?.addEventListener('click',()=>{closeModal();navigate('inv-valuation');});
  document.querySelector('[data-landed-ledger]')?.addEventListener('click',()=>{closeModal();navigate('gl');});
  document.querySelector('[data-landed-allocate]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{await window.ErpSystemData.action('purchasing/landed-costs',l.id,'allocate',{},`landed-cost-${l.id}-allocate`);closeModal();toast(s('allocatedDone'),'ok');navigate('landed-cost');}
    catch(error){button.disabled=false;toast(error&&error.message||'Allocation failed','danger');}
  });
}
function newLandedCostModal(){
  const s=landedCostCopy();
  const options=DB.goodsReceipts.map(row=>`<option value="${row.id}">${esc(row.no)} · ${esc(row.po)} · ${esc(row.supplier)}</option>`).join('');
  appModal({icon:'truck',title:s('newCost'),width:680,body:
    `<div class="fldrow c2"><div class="fld"><span>${esc(s('record'))}</span><input id="landedNo" value="${esc(nextLandedCostNo())}"></div><div class="fld"><span>${esc(s('costDate'))}</span><input id="landedDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div>
    <div class="fld"><span>${esc(s('receipt'))}</span><select id="landedReceipt"><option value="">${esc(DB.goodsReceipts.length?s('chooseReceipt'):s('noReceipts'))}</option>${options}</select></div>
    <div class="fld"><span>${esc(s('basis'))}</span><select id="landedBasis"><option value="value">${esc(s('byValue'))}</option><option value="quantity">${esc(s('byQuantity'))}</option></select></div>
    <div class="fldrow c2"><div class="fld"><span>${esc(s('freight'))}</span><input id="landedFreight" type="number" min="0" step="0.01" value="10.00"></div><div class="fld"><span>${esc(s('duty'))}</span><input id="landedDuty" type="number" min="0" step="0.01" value="0"></div></div>
    <div class="fldrow c2"><div class="fld"><span>${esc(s('handling'))}</span><input id="landedHandling" type="number" min="0" step="0.01" value="0"></div><div class="fld"><span>${esc(s('other'))}</span><input id="landedOther" type="number" min="0" step="0.01" value="0"></div></div>
    <div class="callout info">${ic('info')}<span>${esc(s('taxExclusive'))}</span></div>`,
    actions:btn(s('close'),{cls:'soft',attrs:'data-landed-cancel'})+btn(s('create'),{icon:'plus',cls:'primary',attrs:'data-landed-create'})});
  document.querySelector('[data-landed-cancel]')?.addEventListener('click',closeModal);
  document.querySelector('[data-landed-create]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      const goodsReceiptId=Number(document.querySelector('#landedReceipt').value);
      if(!goodsReceiptId) throw new Error(s('chooseReceipt'));
      const values=['#landedFreight','#landedDuty','#landedHandling','#landedOther'].map(selector=>Number(document.querySelector(selector).value)||0);
      if(values.reduce((sum,value)=>sum+value,0)<=0) throw new Error(s('enterCost'));
      await window.ErpSystemData.create('purchasing/landed-costs',{docNo:document.querySelector('#landedNo').value.trim(),goodsReceiptId,costDate:document.querySelector('#landedDate').value,allocationBasis:document.querySelector('#landedBasis').value,freightAmount:String(values[0]),dutyAmount:String(values[1]),handlingAmount:String(values[2]),otherAmount:String(values[3])});
      closeModal();toast(s('created'),'ok');navigate('landed-cost');
    }catch(error){button.disabled=false;toast(error&&error.message||'Create failed','danger');}
  });
}
makePurList({
  route:'landed-cost', title:()=>landedCostCopy()('title'), unit:()=>landedCostCopy()('unit'), prepare:prepareCanonicalPurchasingData,
  sub:()=>landedCostCopy()('sub'),
  rows:()=>DB.landedCosts, rowId:l=>l.no,
  chips:[['all',()=>landedCostCopy()('all')],['draft',()=>landedCostCopy()('draft')],['allocated',()=>landedCostCopy()('allocated')]],
  filterFn:(l,f)=>l.rawStatus===f,
  kpis:(r)=>[
    {label:()=>landedCostCopy()('records'), val:r.length},
    {label:()=>landedCostCopy()('goodsValue'), val:money0(r.reduce((a,l)=>a+l.goods,0))},
    {label:()=>landedCostCopy()('addedCost'), val:money0(r.reduce((a,l)=>a+l.added,0)), accent:true},
    {label:()=>landedCostCopy()('draft'), val:r.filter(l=>l.rawStatus==='draft').length, f:'draft'},
  ],
  newBtn:{label:()=>landedCostCopy()('newCost'), onClick:()=>newLandedCostModal()},
  columns:[
    {label:()=>landedCostCopy()('record'), w:'minmax(130px,1.1fr)', render:l=>docNoCell(l.no,l.date)},
    {label:()=>landedCostCopy()('against'), align:'l', w:'minmax(120px,1.1fr)', render:l=>`<span class="mono" style="font-size:12px">${esc(l.ref)}</span>`},
    {label:()=>landedCostCopy()('supplier'), align:'l', w:'minmax(160px,1.6fr)', render:l=>suppCell(l.supplier,l.code)},
    {label:()=>landedCostCopy()('basis'), align:'l', w:'minmax(100px,1fr)', render:l=>`<span style="color:var(--muted)">${esc(landedBasisLabel(l.basis))}</span>`},
    {label:()=>landedCostCopy()('goods'), align:'r', w:'minmax(100px,1fr)', render:l=>`<span class="tnum">${money(l.goods,l.currency)}</span>`},
    {label:()=>landedCostCopy()('addedCost'), align:'r', sortable:true, w:'minmax(100px,1fr)', render:l=>`<b class="tnum">${money(l.added,l.currency)}</b>`},
    {label:()=>landedCostCopy()('status'), align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:l=>cap(landedCostCopy()(l.rawStatus),l.rawStatus==='allocated'?'ok':'neutral')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(l)=>[
    {id:'view',icon:'ext',label:landedCostCopy()('open'),run:()=>openLanded(l)},
    ...(l.rawStatus==='draft'?[{id:'alloc',icon:'flow',label:landedCostCopy()('allocate'),run:()=>openLanded(l)}]:[]),
  ],
  onOpen:(l)=>openLanded(l),
});

/* ---------------- VENDOR PERFORMANCE ---------------- */
SCREENS['vendor-performance'] = function(root){
  const data=DB.vendorPerf.slice().sort((a,b)=>b.rating-a.rating);
  const avgOnTime=Math.round(data.reduce((a,v)=>a+v.onTime,0)/data.length);
  const avgLead=Math.round(data.reduce((a,v)=>a+v.leadTime,0)/data.length);
  const watch=data.filter(v=>v.rating<3.8).length;

  const kpis=[
    {label:'Suppliers scored', val:data.length},
    {label:'Avg on-time', val:avgOnTime+'%'},
    {label:'Avg lead time', val:avgLead+'d'},
    {label:'On watch / review', val:watch, neg:watch>0},
  ];
  const kpibar=`<div class="so-kpibar">`+kpis.map(k=>`<button class="so-kpi ${k.neg?'neg':''}" disabled><small>${esc(k.label)}</small><b class="tnum">${k.val}</b></button>`).join('')+`</div>`;

  function ratingTag(r){ return r>=4.5?cap('Preferred','ok'):r>=4?cap('Approved','accent'):r>=3.6?cap('Watch','warn'):cap('Review','danger'); }
  function bar(v,scale,good){ // good: 'high' means higher is better
    const pct=Math.max(4,Math.min(100,Math.round(v/scale*100)));
    const tone = good==='high' ? (v>=90?'ok':v>=80?'warn':'danger') : (v<=1?'ok':v<=3?'warn':'danger');
    const clr = tone==='ok'?'var(--ok)':tone==='warn'?'var(--warn)':'var(--danger)';
    return `<span class="minibar" style="width:64px"><i style="width:${pct}%;background:${clr}"></i></span>`;
  }
  const cards=data.map(v=>`<div class="wcard vp-card">
      <div class="vp-h"><div class="partner"><span class="pav">${esc(v.supplier.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase())}</span><div><b>${esc(v.supplier)}</b><small>${esc(v.code)} · ${money0(v.spend)} spend</small></div></div><div class="vp-rate"><b class="tnum">${v.rating.toFixed(1)}</b>${ratingTag(v.rating)}</div></div>
      <div class="vp-metrics">
        <div class="vp-m"><span>On-time delivery</span><div class="vp-mr">${bar(v.onTime,100,'high')}<b class="tnum">${v.onTime}%</b></div></div>
        <div class="vp-m"><span>Avg lead time</span><div class="vp-mr"><b class="tnum">${v.leadTime} days</b></div></div>
        <div class="vp-m"><span>Quality reject</span><div class="vp-mr">${bar(v.qualityReject,6,'low')}<b class="tnum">${v.qualityReject}%</b></div></div>
        <div class="vp-m"><span>Return rate</span><div class="vp-mr">${bar(v.returnRate,6,'low')}<b class="tnum">${v.returnRate}%</b></div></div>
        <div class="vp-m"><span>Invoice mismatch</span><div class="vp-mr">${bar(v.mismatch,6,'low')}<b class="tnum">${v.mismatch}%</b></div></div>
        <div class="vp-m"><span>Price variance</span><div class="vp-mr"><b class="tnum" style="color:${v.priceVar>2?'var(--warn)':'var(--ok)'}">${v.priceVar>0?'+':''}${v.priceVar}%</b></div></div>
      </div>
    </div>`).join('');

  root.innerHTML = purPage({
    active:'vendor-performance', title:'Vendor Performance',
    sub:'Supplier scorecards across on-time delivery, lead-time, quality, returns and invoice match — the inputs behind approved-supplier status and sourcing decisions.',
    action: btn('Performance report',{icon:'chart',cls:'soft',attrs:'onclick="navigate(\'report-pur-vendor\')"'}),
    body:`<div class="sales-body">${kpibar}<div class="vp-grid">${cards}</div></div>`
  });
};
