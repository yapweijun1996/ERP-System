/* ============================================================
   ARIA ERP — Canonical purchasing transaction details
   Goods Receipt · Supplier Invoice
   ============================================================ */

function purchasingDetailCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{purchasing:'Purchasing',receipt:'Goods Receipt',receipts:'Goods Receipts',invoice:'Supplier Invoice',invoices:'Supplier Invoices',posted:'Posted',paid:'Paid',cancelled:'Cancelled',supplier:'Supplier',po:'Purchase order',date:'Document date',warehouse:'Warehouse',status:'Status',lines:'Document lines',item:'Item',ordered:'Ordered',received:'Received',quantity:'Quantity',unitCost:'Unit cost',net:'Net amount',tax:'Tax',total:'Total',inventoryTrace:'Inventory trace',movement:'Movement',direction:'Direction',reference:'Reference',accountingTrace:'Accounting trace',account:'Account',memo:'Memo',debit:'Debit',credit:'Credit',balanced:'Balanced journal',immutableReceipt:'This posted receipt is immutable. Its quantities come from the approved purchase order and every stock effect is recorded as a stock movement.',immutableInvoice:'This posted supplier invoice is immutable. Payment changes its settlement status; corrections require a return, credit note or debit note.',backReceipts:'Back to receipts',backInvoices:'Back to invoices',viewStock:'View stock movements',viewLedger:'View General Ledger',schedulePayment:'Schedule payment',noMovement:'No stock movement is linked to this receipt.',noJournal:'No accounting journal is linked to this invoice.',traceCount:'trace records',outstanding:'Outstanding',settled:'Settlement',matched:'3-way match',matchNote:'The invoice uses the same purchase-order quantity, cost and tax snapshots as the posted receipt.',receiptNote:'Receipt posting changes inventory quantity only. Supplier-invoice posting creates the AP journal.',lineCount:'lines',journalRef:'Journal reference'},
    ms:{purchasing:'Pembelian',receipt:'Penerimaan Barang',receipts:'Penerimaan Barang',invoice:'Invois Pembekal',invoices:'Invois Pembekal',posted:'Dipos',paid:'Dibayar',cancelled:'Dibatalkan',supplier:'Pembekal',po:'Pesanan belian',date:'Tarikh dokumen',warehouse:'Gudang',status:'Status',lines:'Baris dokumen',item:'Item',ordered:'Dipesan',received:'Diterima',quantity:'Kuantiti',unitCost:'Kos seunit',net:'Amaun bersih',tax:'Cukai',total:'Jumlah',inventoryTrace:'Jejak inventori',movement:'Pergerakan',direction:'Arah',reference:'Rujukan',accountingTrace:'Jejak perakaunan',account:'Akaun',memo:'Memo',debit:'Debit',credit:'Kredit',balanced:'Jurnal seimbang',immutableReceipt:'Penerimaan yang telah dipos tidak boleh diubah. Kuantitinya berasal daripada pesanan belian yang diluluskan dan setiap kesan stok direkod sebagai pergerakan stok.',immutableInvoice:'Invois pembekal yang telah dipos tidak boleh diubah. Pembayaran hanya mengubah status penyelesaian; pembetulan mesti melalui pulangan, nota kredit atau nota debit.',backReceipts:'Kembali ke penerimaan',backInvoices:'Kembali ke invois',viewStock:'Lihat pergerakan stok',viewLedger:'Lihat Lejar Am',schedulePayment:'Jadualkan pembayaran',noMovement:'Tiada pergerakan stok dipautkan kepada penerimaan ini.',noJournal:'Tiada jurnal perakaunan dipautkan kepada invois ini.',traceCount:'rekod jejak',outstanding:'Belum dibayar',settled:'Penyelesaian',matched:'Padanan 3 hala',matchNote:'Invois menggunakan gambaran kuantiti, kos dan cukai pesanan belian yang sama seperti penerimaan yang dipos.',receiptNote:'Posting penerimaan hanya mengubah kuantiti inventori. Posting invois pembekal mencipta jurnal AP.',lineCount:'baris',journalRef:'Rujukan jurnal'},
    zh:{purchasing:'采购',receipt:'收货单',receipts:'收货单',invoice:'供应商发票',invoices:'供应商发票',posted:'已过账',paid:'已付款',cancelled:'已取消',supplier:'供应商',po:'采购订单',date:'单据日期',warehouse:'仓库',status:'状态',lines:'单据明细',item:'物料',ordered:'订购数量',received:'收货数量',quantity:'数量',unitCost:'单位成本',net:'未税金额',tax:'税额',total:'合计',inventoryTrace:'库存追踪',movement:'库存流水',direction:'方向',reference:'来源',accountingTrace:'会计追踪',account:'科目',memo:'摘要',debit:'借方',credit:'贷方',balanced:'借贷平衡',immutableReceipt:'已过账收货单不可修改。数量来自已批准的采购订单，每一笔库存影响都记录为库存流水。',immutableInvoice:'已过账供应商发票不可修改。付款只会更新结算状态；更正必须通过退货、贷项或借项处理。',backReceipts:'返回收货单',backInvoices:'返回供应商发票',viewStock:'查看库存流水',viewLedger:'查看总账',schedulePayment:'安排付款',noMovement:'此收货单没有关联库存流水。',noJournal:'此发票没有关联会计凭证。',traceCount:'条追踪记录',outstanding:'未付金额',settled:'结算状态',matched:'三单匹配',matchNote:'发票采用与已过账收货单相同的采购订单数量、成本及税额快照。',receiptNote:'收货过账只改变库存数量；供应商发票过账才生成应付账款凭证。',lineCount:'行',journalRef:'凭证编号'},
    ja:{purchasing:'購買',receipt:'入荷伝票',receipts:'入荷伝票',invoice:'仕入先請求書',invoices:'仕入先請求書',posted:'転記済',paid:'支払済',cancelled:'取消済',supplier:'仕入先',po:'購買発注',date:'伝票日',warehouse:'倉庫',status:'ステータス',lines:'伝票明細',item:'品目',ordered:'発注数量',received:'入荷数量',quantity:'数量',unitCost:'単価',net:'税抜金額',tax:'税額',total:'合計',inventoryTrace:'在庫追跡',movement:'在庫移動',direction:'方向',reference:'参照',accountingTrace:'会計追跡',account:'勘定科目',memo:'摘要',debit:'借方',credit:'貸方',balanced:'貸借一致',immutableReceipt:'転記済入荷伝票は変更できません。数量は承認済購買発注から取得し、在庫への影響はすべて在庫移動として記録されます。',immutableInvoice:'転記済仕入先請求書は変更できません。支払は決済状態のみ更新し、訂正は返品・クレジットノート・デビットノートで行います。',backReceipts:'入荷一覧へ戻る',backInvoices:'請求書一覧へ戻る',viewStock:'在庫移動を表示',viewLedger:'総勘定元帳を表示',schedulePayment:'支払を予定',noMovement:'この入荷に紐づく在庫移動はありません。',noJournal:'この請求書に紐づく会計仕訳はありません。',traceCount:'件の追跡記録',outstanding:'未払額',settled:'決済',matched:'3点照合',matchNote:'請求書は転記済入荷と同じ購買発注の数量・原価・税スナップショットを使用します。',receiptNote:'入荷転記は在庫数量のみ変更し、仕入先請求書の転記でAP仕訳を作成します。',lineCount:'行',journalRef:'仕訳参照'},
    vi:{purchasing:'Mua hàng',receipt:'Phiếu nhận hàng',receipts:'Phiếu nhận hàng',invoice:'Hóa đơn nhà cung cấp',invoices:'Hóa đơn nhà cung cấp',posted:'Đã ghi sổ',paid:'Đã thanh toán',cancelled:'Đã hủy',supplier:'Nhà cung cấp',po:'Đơn mua hàng',date:'Ngày chứng từ',warehouse:'Kho',status:'Trạng thái',lines:'Dòng chứng từ',item:'Mặt hàng',ordered:'Đã đặt',received:'Đã nhận',quantity:'Số lượng',unitCost:'Đơn giá',net:'Giá trị chưa thuế',tax:'Thuế',total:'Tổng',inventoryTrace:'Truy vết tồn kho',movement:'Biến động',direction:'Hướng',reference:'Tham chiếu',accountingTrace:'Truy vết kế toán',account:'Tài khoản',memo:'Diễn giải',debit:'Nợ',credit:'Có',balanced:'Bút toán cân bằng',immutableReceipt:'Phiếu nhận đã ghi sổ là bất biến. Số lượng lấy từ đơn mua hàng đã duyệt và mọi ảnh hưởng tồn kho đều được ghi thành biến động kho.',immutableInvoice:'Hóa đơn nhà cung cấp đã ghi sổ là bất biến. Thanh toán chỉ đổi trạng thái quyết toán; điều chỉnh phải qua trả hàng, phiếu tín dụng hoặc phiếu ghi nợ.',backReceipts:'Quay lại phiếu nhận',backInvoices:'Quay lại hóa đơn',viewStock:'Xem biến động kho',viewLedger:'Xem Sổ cái',schedulePayment:'Lập lịch thanh toán',noMovement:'Không có biến động kho liên kết với phiếu nhận này.',noJournal:'Không có bút toán kế toán liên kết với hóa đơn này.',traceCount:'bản ghi truy vết',outstanding:'Còn phải trả',settled:'Quyết toán',matched:'Đối chiếu 3 bên',matchNote:'Hóa đơn dùng cùng ảnh chụp số lượng, chi phí và thuế của đơn mua hàng như phiếu nhận đã ghi sổ.',receiptNote:'Ghi sổ nhận hàng chỉ đổi số lượng tồn kho. Ghi sổ hóa đơn nhà cung cấp mới tạo bút toán AP.',lineCount:'dòng',journalRef:'Tham chiếu bút toán'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function purchasingDetailStatus(value){
  const s=purchasingDetailCopy();
  if(value==='paid'||value==='Paid') return s('paid');
  if(value==='cancelled'||value==='Cancelled') return s('cancelled');
  return s('posted');
}

function purchasingDetailTone(value){
  return value==='paid'||value==='Paid'?'ok':value==='cancelled'||value==='Cancelled'?'danger':'teal';
}

async function prepareGoodsReceiptDetail(receiptId){
  await prepareCanonicalPurchasingData();
  const receipt=(receiptId?DB.goodsReceipts.find(row=>row.id===receiptId):null)||DB.goodsReceipts[0];
  if(!receipt) throw new Error('No goods receipt exists for the active company.');
  const movements=(await listPage('inventory/stock-movements')).data
    .filter(row=>row.refType==='goods_receipt'&&Number(row.refId)===Number(receipt.id));
  return {
    receipt,
    order:DB.purchaseOrders.find(row=>row.id===receipt.orderId)||{},
    lines:DB.purchaseOrderLines.filter(row=>row.orderId===receipt.orderId),
    movements,
  };
}

async function prepareSupplierInvoiceDetail(invoiceId){
  await prepareCanonicalPurchasingData();
  const invoice=(invoiceId?DB.supplierInvoices.find(row=>row.id===invoiceId):null)||DB.supplierInvoices[0];
  if(!invoice) throw new Error('No supplier invoice exists for the active company.');
  const [entriesPage,accountsPage]=await Promise.all([
    listPage('finance/gl-entries'),
    listPage('finance/accounts'),
  ]);
  const accountById=new Map(accountsPage.data.map(row=>[row.id,row]));
  const entries=entriesPage.data.filter(row=>row.journalRef===invoice.no).map(row=>({
    ...row,
    account:accountById.get(row.accountId)||{},
  }));
  return {
    invoice,
    order:DB.purchaseOrders.find(row=>row.id===invoice.orderId)||{},
    receipt:DB.goodsReceipts.find(row=>row.orderId===invoice.orderId)||null,
    lines:DB.purchaseOrderLines.filter(row=>row.orderId===invoice.orderId),
    entries,
  };
}

function purchasingDetailLines(lines,currency,received){
  const s=purchasingDetailCopy();
  return buildTable({rowId:line=>line.id||line.lineNo,columns:[
    {label:s('item'),w:'minmax(190px,1.7fr)',render:line=>`<div class="cellsub"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></div>`},
    {label:received?s('ordered'):s('quantity'),align:'r',w:'minmax(84px,.7fr)',render:line=>`<span class="tnum">${num(line.qty)} ${esc(line.uom)}</span>`},
    ...(received?[{label:s('received'),align:'r',w:'minmax(84px,.7fr)',render:line=>`<b class="tnum">${num(line.qty)} ${esc(line.uom)}</b>`}]:[]),
    {label:s('unitCost'),align:'r',w:'minmax(100px,.9fr)',render:line=>`<span class="tnum">${money(line.unitCost,currency)}</span>`},
    {label:s('tax'),align:'r',w:'minmax(92px,.8fr)',render:line=>`<span class="tnum">${money(line.tax,currency)}</span><small style="display:block;color:var(--muted)">${esc(line.taxCode)} · ${num(line.taxRate)}%</small>`},
    {label:s('net'),align:'r',w:'minmax(108px,1fr)',render:line=>`<b class="tnum">${money(line.net,currency)}</b>`},
  ],rows:lines});
}

SCREENS['goods-receipt']=async function(root,params){
  const s=purchasingDetailCopy();
  const detail=await prepareGoodsReceiptDetail(params&&params.receiptId?Number(params.receiptId):null);
  const {receipt,order,lines,movements}=detail;
  const movementRows=movements.length?buildTable({rowId:row=>row.id,columns:[
    {label:s('movement'),w:'minmax(180px,1.7fr)',render:row=>{const line=lines.find(item=>item.productId===row.productId)||{};return `<div class="cellsub"><b>${esc(line.name||`Product #${row.productId}`)}</b><small>${esc(line.sku||`#${row.productId}`)}</small></div>`;}},
    {label:s('direction'),align:'l',w:'minmax(90px,.8fr)',render:row=>cap(String(row.direction||'in').toUpperCase(),'ok')},
    {label:s('quantity'),align:'r',w:'minmax(100px,.9fr)',render:row=>`<b class="tnum">+${num(row.qty)}</b>`},
    {label:s('reference'),align:'l',w:'minmax(160px,1.3fr)',render:row=>`<span class="mono">${esc(row.movementGroup||`${row.refType} #${row.refId}`)}</span>`},
  ],rows:movements}):`<div class="emptystate"><b>${esc(s('noMovement'))}</b></div>`;
  root.innerHTML=`<div class="content full"><section class="master" data-purchasing-detail="goods-receipt" data-doc-no="${esc(receipt.no)}" data-trace-count="${movements.length}"><div class="scrollarea"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,{label:s('purchasing'),route:'purchasing-home'},{label:s('receipts'),route:'goods-receipts'},{cur:receipt.no}])}${purNav('goods-receipts')}
    <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('receive')} ${esc(s('receipt'))} <span class="dnum">${esc(receipt.no)}</span></div><div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(receipt.supplier)} · ${esc(receipt.po)}</div></div><div class="dactions">${cap(s('posted'),'teal')}</div></div>
      <div class="docmeta"><div class="dm"><small>${esc(s('supplier'))}</small><b>${esc(receipt.supplier)}</b></div><div class="dm"><small>${esc(s('po'))}</small><b>${esc(receipt.po)}</b></div><div class="dm"><small>${esc(s('date'))}</small><b>${esc(receipt.date)}</b></div><div class="dm"><small>${esc(s('warehouse'))}</small><b>${esc(receipt.warehouse)}</b></div><div class="dm"><small>${esc(s('status'))}</small><b>${esc(s('posted'))}</b></div></div>
    </div>
    <div class="doclayout"><div class="docmain"><div class="panel"><div class="panel-h"><h3>${esc(s('lines'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${lines.length} ${esc(s('lineCount'))}</span></div><div class="tablewrap">${purchasingDetailLines(lines,order.currency||DB.company.currency,true)}</div></div>
      <div class="panel"><div class="panel-h"><h3>${esc(s('inventoryTrace'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${movements.length} ${esc(s('traceCount'))}</span></div><div class="tablewrap">${movementRows}</div></div></div>
      <aside class="summary"><div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('status'))}</div>${indicator({tone:'ok',icon:'checkc',label:s('posted'),value:receipt.date,sub:s('receiptNote')})}</div><div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('inventoryTrace'))}</div><div class="sumrow"><span class="sk2">${esc(s('lines'))}</span><span class="sv tnum">${lines.length}</span></div><div class="sumrow total"><span class="sk2">${esc(s('movement'))}</span><span class="sv tnum">${movements.length}</span></div></div><div class="callout info">${ic('lock')}<span>${esc(s('immutableReceipt'))}</span></div></aside></div>
  </div></div></div><div class="responsive-actionbar">${btn(s('backReceipts'),{icon:'chevleft',cls:'soft',attrs:'data-receipt-back'})}<div class="grow"></div>${btn(s('viewStock'),{icon:'history',cls:'primary',sm:false,attrs:'data-receipt-stock'})}</div></section></div>`;
  root.querySelector('[data-receipt-back]')?.addEventListener('click',()=>navigate('goods-receipts'));
  root.querySelector('[data-receipt-stock]')?.addEventListener('click',()=>navigate('stock-movement'));
};

SCREENS['supplier-invoice']=async function(root,params){
  const s=purchasingDetailCopy();
  const detail=await prepareSupplierInvoiceDetail(params&&params.invoiceId?Number(params.invoiceId):null);
  const {invoice,receipt,lines,entries}=detail;
  const debit=entries.reduce((sum,row)=>sum+purchasingNumber(row.debit),0);
  const credit=entries.reduce((sum,row)=>sum+purchasingNumber(row.credit),0);
  const entryRows=entries.length?buildTable({rowId:row=>row.id,columns:[
    {label:s('account'),w:'minmax(190px,1.7fr)',render:row=>`<div class="cellsub"><b>${esc(row.account.name||`Account #${row.accountId}`)}</b><small>${esc(row.account.code||`#${row.accountId}`)}</small></div>`},
    {label:s('memo'),align:'l',w:'minmax(150px,1.3fr)',render:row=>`<span style="color:var(--muted)">${esc(row.memo||'—')}</span>`},
    {label:s('debit'),align:'r',w:'minmax(100px,.9fr)',render:row=>`<span class="tnum">${purchasingNumber(row.debit)?money(row.debit,invoice.currency):'—'}</span>`},
    {label:s('credit'),align:'r',w:'minmax(100px,.9fr)',render:row=>`<span class="tnum">${purchasingNumber(row.credit)?money(row.credit,invoice.currency):'—'}</span>`},
  ],rows:entries}):`<div class="emptystate"><b>${esc(s('noJournal'))}</b></div>`;
  root.innerHTML=`<div class="content full"><section class="master" data-purchasing-detail="supplier-invoice" data-doc-no="${esc(invoice.no)}" data-trace-count="${entries.length}" data-journal-balanced="${Math.abs(debit-credit)<0.001&&debit>0?'true':'false'}"><div class="scrollarea"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,{label:s('purchasing'),route:'purchasing-home'},{label:s('invoices'),route:'supplier-invoices'},{cur:invoice.no}])}${purNav('supplier-invoices')}
    <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('receipt')} ${esc(s('invoice'))} <span class="dnum">${esc(invoice.no)}</span></div><div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(invoice.supplier)} · ${esc(invoice.po)}${receipt?` · ${esc(receipt.no)}`:''}</div></div><div class="dactions">${cap(purchasingDetailStatus(invoice.rawStatus),purchasingDetailTone(invoice.rawStatus))}</div></div>
      <div class="docmeta"><div class="dm"><small>${esc(s('supplier'))}</small><b>${esc(invoice.supplier)}</b></div><div class="dm"><small>${esc(s('po'))}</small><b>${esc(invoice.po)}</b></div><div class="dm"><small>${esc(s('date'))}</small><b>${esc(invoice.date)}</b></div><div class="dm"><small>${esc(s('matched'))}</small><b>${esc(receipt&&receipt.no||'—')}</b></div><div class="dm"><small>${esc(s('settled'))}</small><b>${esc(purchasingDetailStatus(invoice.rawStatus))}</b></div></div>
    </div>
    <div class="doclayout"><div class="docmain"><div class="panel"><div class="panel-h"><h3>${esc(s('lines'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${lines.length} ${esc(s('lineCount'))}</span></div><div class="tablewrap">${purchasingDetailLines(lines,invoice.currency,false)}</div></div>
      <div class="panel"><div class="panel-h"><h3>${esc(s('accountingTrace'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${entries.length} ${esc(s('traceCount'))}</span></div><div class="tablewrap">${entryRows}</div></div></div>
      <aside class="summary"><div class="sumcard"><div class="sumrow"><span class="sk2">${esc(s('net'))}</span><span class="sv tnum">${money(invoice.net,invoice.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('tax'))}</span><span class="sv tnum">${money(invoice.tax,invoice.currency)}</span></div><div class="sumrow total"><span class="sk2">${esc(s('total'))}</span><span class="sv tnum">${money(invoice.total,invoice.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('outstanding'))}</span><span class="sv tnum">${money(invoice.outstanding,invoice.currency)}</span></div></div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('accountingTrace'))}</div>${indicator({tone:Math.abs(debit-credit)<0.001?'ok':'danger',icon:'book',label:s('balanced'),value:`${money(debit,invoice.currency)} = ${money(credit,invoice.currency)}`,sub:`${s('journalRef')}: ${invoice.no}`})}</div><div class="callout info">${ic('lock')}<span>${esc(s('immutableInvoice'))}</span></div></aside></div>
  </div></div></div><div class="responsive-actionbar">${btn(s('backInvoices'),{icon:'chevleft',cls:'soft',attrs:'data-invoice-back'})}<div class="grow"></div>${invoice.rawStatus==='unpaid'?btn(s('schedulePayment'),{icon:'coins',cls:'soft',attrs:'data-invoice-pay'}):''}${btn(s('viewLedger'),{icon:'book',cls:'primary',sm:false,attrs:'data-invoice-ledger'})}</div></section></div>`;
  root.querySelector('[data-invoice-back]')?.addEventListener('click',()=>navigate('supplier-invoices'));
  root.querySelector('[data-invoice-pay]')?.addEventListener('click',()=>navigate('new-payment-voucher'));
  root.querySelector('[data-invoice-ledger]')?.addEventListener('click',()=>navigate('gl'));
};
