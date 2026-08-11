/* ============================================================
   ARIA ERP — Canonical sales enquiry transaction workspace

   `txn-view` is the record-specific enquiry workspace. The old
   implementation accepted an entire mutable presentation record, invented
   activity/actors and exposed toast-only writes for seven document kinds.
   Canonical document kinds now own dedicated detail routes; openTxn keeps a
   narrow compatibility dispatcher while this route stores only an enquiry id
   and re-reads the formal Demo/API resource contract on every render.
   ============================================================ */
let TXN_OPEN = null;

/* These three small presentation helpers are also used by the Purchasing
   compatibility file loaded after this one. Keep them generic and side-effect
   free; Canonical txn-view itself does not use fabricated activity. */
function txnActivity(events){
  return `<div class="panel"><div class="panel-h">${ic('history')}<h3>Activity</h3></div><div class="panel-body">${auditTrail(events)}</div></div>`;
}
function txnDetails(rows){
  return `<div class="panel"><div class="panel-h">${ic('list')}<h3>Details</h3></div><div class="panel-body">${rows.map(([key,value])=>`<div class="field"><span class="k">${esc(key)}</span><span class="v">${value}</span></div>`).join('')}</div></div>`;
}
function sumCard(title,rows){
  return `<div class="sumcard">${title?`<div class="sectitle" style="margin-top:0">${esc(title)}</div>`:''}${rows.map(row=>`<div class="sumrow ${row[2]||''}"><span class="sk2">${esc(row[0])}</span><span class="sv tnum">${row[1]}</span></div>`).join('')}</div>`;
}

function openTxn(kind,record){
  const id=Number(record&&typeof record==='object'?record.id:record)||null;
  const no=record&&typeof record==='object'?(record.docNo||record.no):null;
  if(kind==='quotation'){
    window.ACTIVE_SALES_QUOTATION_ID=id;
    return navigate('quotation');
  }
  if(kind==='delivery'){
    window.ACTIVE_SALES_DELIVERY_ID=id;
    return navigate('delivery-order');
  }
  if(kind==='invoice') return navigate('sales-invoice',no?{no}:{});
  if(kind==='return'){
    window.ACTIVE_SALES_RETURN_ID=id;
    return navigate('sales-return');
  }
  if(kind==='credit'){
    window.ACTIVE_SALES_CREDIT_ID=id;
    return navigate('credit-note');
  }
  if(kind==='debit') return navigate('debit-notes');
  if(kind==='commission') return navigate('sales-commission');
  TXN_OPEN={kind:'enquiry',id};
  window.ACTIVE_SALES_ENQUIRY_ID=id;
  return navigate('txn-view');
}
window.openTxn=openTxn;
window.openSalesEnquiry=function(id){return openTxn('enquiry',id);};

(function canonicalSalesEnquiryWorkspace(){
  let activeTab='overview';
  function copy(){
    const packs={
      en:{sales:'Sales',enquiries:'Enquiries',title:'Enquiry',request:'Customer request',customer:'Customer',date:'Enquiry date',channel:'Channel',owner:'Owner',estimated:'Estimated value',currency:'Currency',status:'Status',newStatus:'New',quoted:'Quoted',lost:'Lost',trace:'Activity',captured:'Enquiry captured',linked:'Linked quotation',related:'Related document',noQuote:'No quotation has been created from this enquiry.',back:'Back to enquiries',convert:'Convert to quotation',viewQuote:'View quotation',empty:'No canonical enquiry is available.',emptyHelp:'Create an enquiry from the register to begin the sales process.',source:'Single source of truth',sourceHelp:'Header, items, totals and linked documents are re-read from the active company database. Saving Items replaces the complete row set atomically.',limit:'One enquiry can create at most one linked quotation.',created:'Created',updated:'Last updated',overview:'Overview',items:'Items',documentInfo:'Document info',activity:'Activity',addItem:'Add item',addRow:'Add row',addStockItem:'Stock item',addFreeText:'Free-text item',chooseLineType:'Choose row type',stockItemHelp:'Select an item from the product master.',freeTextHelp:'Enter a description without creating inventory master data.',nonStock:'Non-stock',description:'Description',descriptionPlaceholder:'Describe the product, service or charge',createFirstItem:'Create first item',saveItems:'Save items',product:'Product / service',quantity:'Quantity',unitPrice:'Estimated unit price',lineTotal:'Line total',remove:'Remove',noItems:'No items have been added yet.',noItemsHelp:'Add the products or services requested by the customer. The document estimate will be calculated from these rows.',noProductsHelp:'This company has no product master yet. Create the first item here and it will be added to this enquiry automatically.',newProduct:'Create product / service',sku:'SKU',itemName:'Item name',category:'Category',uom:'Base UoM',cancel:'Cancel',createAndAdd:'Create and add',creating:'Creating…',itemCreated:'Item created and added to the enquiry.',itemRequired:'Enter both an SKU and item name.',itemsSaved:'Items saved',itemsLocked:'Items are read-only after the enquiry leaves New status.',version:'Document version',documentNo:'Document number',company:'Company',rowCount:'Item rows',unsaved:'Unsaved item changes',reload:'Discard changes',saveHelp:'Saving updates the canonical item set and recalculates the estimated value.',required:'Complete every row with a description, unit, positive quantity and non-negative price.',createFailed:'Create failed',saveFailed:'Save failed'},
      ms:{
  "sales": "Jualan",
  "enquiries": "Pertanyaan",
  "title": "Pertanyaan",
  "request": "Permintaan pelanggan",
  "customer": "Pelanggan",
  "date": "Tarikh pertanyaan",
  "channel": "Saluran",
  "owner": "Pemilik",
  "estimated": "Nilai anggaran",
  "currency": "Mata wang",
  "status": "Status",
  "newStatus": "Baharu",
  "quoted": "Telah disebut",
  "lost": "Hilang",
  "trace": "Jejak kanonik",
  "captured": "Pertanyaan direkod",
  "linked": "Sebut harga dipautkan",
  "related": "Sebut harga berkaitan",
  "noQuote": "Belum ada sebut harga dicipta daripada pertanyaan ini.",
  "back": "Kembali ke pertanyaan",
  "convert": "Tukar kepada sebut harga",
  "viewQuote": "Lihat sebut harga",
  "empty": "Tiada pertanyaan kanonik tersedia.",
  "emptyHelp": "Cipta pertanyaan daripada daftar untuk memulakan proses jualan.",
  "source": "Sumber kanonik",
  "sourceHelp": "Ruang kerja ini membaca semula pertanyaan terpilih dan sebut harga terpaut daripada syarikat aktif. Tiada aktiviti sampel digantikan.",
  "limit": "Satu pertanyaan hanya boleh mencipta satu sebut harga terpaut.",
  "created": "Dicipta",
  "updated": "Kemas kini terakhir",
  "overview":"Gambaran keseluruhan","items":"Item","documentInfo":"Maklumat dokumen","activity":"Aktiviti","addItem":"Tambah item","addRow":"Tambah baris","addStockItem":"Item stok","addFreeText":"Item teks bebas","chooseLineType":"Pilih jenis baris","stockItemHelp":"Pilih item daripada induk produk.","freeTextHelp":"Masukkan penerangan tanpa mencipta data induk inventori.","nonStock":"Bukan stok","description":"Penerangan","descriptionPlaceholder":"Terangkan produk, perkhidmatan atau caj","createFirstItem":"Cipta item pertama","saveItems":"Simpan item","product":"Produk / perkhidmatan","quantity":"Kuantiti","unitPrice":"Harga unit anggaran","lineTotal":"Jumlah baris","remove":"Buang","noItems":"Belum ada item.","noItemsHelp":"Tambah produk atau perkhidmatan yang diminta pelanggan.","noProductsHelp":"Syarikat ini belum mempunyai induk produk. Cipta item pertama di sini dan ia akan ditambah kepada pertanyaan secara automatik.","newProduct":"Cipta produk / perkhidmatan","sku":"SKU","itemName":"Nama item","category":"Kategori","uom":"UoM asas","cancel":"Batal","createAndAdd":"Cipta dan tambah","creating":"Mencipta…","itemCreated":"Item dicipta dan ditambah kepada pertanyaan.","itemRequired":"Masukkan SKU dan nama item.","itemsSaved":"Item disimpan","itemsLocked":"Item hanya boleh dibaca selepas pertanyaan meninggalkan status Baharu.","version":"Versi dokumen","documentNo":"Nombor dokumen","company":"Syarikat","rowCount":"Baris item","unsaved":"Perubahan item belum disimpan","reload":"Buang perubahan","saveHelp":"Simpan untuk mengemas kini item kanonik dan mengira semula nilai anggaran.","required":"Lengkapkan setiap item dengan penerangan, unit, kuantiti positif dan harga sifar atau lebih.","createFailed":"Gagal mencipta","saveFailed":"Gagal menyimpan"
},
      zh:{sales:'销售',enquiries:'询价',title:'询价',request:'客户需求',customer:'客户',date:'询价日期',channel:'渠道',owner:'负责人',estimated:'预计金额',currency:'币种',status:'状态',newStatus:'新建',quoted:'已报价',lost:'已丢失',trace:'活动记录',captured:'询价已记录',linked:'已关联报价单',related:'关联单据',noQuote:'此询价尚未生成报价单。',back:'返回询价列表',convert:'转为报价单',viewQuote:'查看报价单',empty:'没有可用的标准询价。',emptyHelp:'请从询价列表创建记录以开始销售流程。',source:'单一真实数据源',sourceHelp:'抬头、明细、金额与关联单据都从当前公司数据库重新读取。保存明细时会在同一事务中替换整组行。',limit:'每个询价最多生成一张关联报价单。',created:'创建时间',updated:'最后更新',overview:'概览',items:'明细',documentInfo:'单据信息',activity:'活动',addItem:'添加明细',addRow:'添加一行',addStockItem:'库存商品',addFreeText:'自由文字项目',chooseLineType:'选择明细类型',stockItemHelp:'从商品主数据选择库存商品。',freeTextHelp:'直接输入说明，不建立库存商品主数据。',nonStock:'非库存',description:'说明',descriptionPlaceholder:'输入产品、服务或费用说明',createFirstItem:'创建第一件商品',saveItems:'保存明细',product:'产品 / 服务',quantity:'数量',unitPrice:'预计单价',lineTotal:'行金额',remove:'删除',noItems:'尚未添加明细。',noItemsHelp:'添加客户需要的产品或服务，预计金额将自动从明细计算。',noProductsHelp:'当前公司还没有商品主数据。可在这里创建第一件商品，系统会自动加入本询价。',newProduct:'创建产品 / 服务',sku:'SKU',itemName:'商品名称',category:'类别',uom:'基本单位',cancel:'取消',createAndAdd:'创建并加入',creating:'正在创建…',itemCreated:'商品已创建并加入询价。',itemRequired:'请输入 SKU 和商品名称。',itemsSaved:'明细已保存',itemsLocked:'询价离开“新建”状态后，明细将变为只读。',version:'单据版本',documentNo:'单据编号',company:'公司',rowCount:'明细行数',unsaved:'明细有未保存的更改',reload:'放弃更改',saveHelp:'保存后会更新标准明细，并重新计算预计金额。',required:'每一行都必须有说明、单位、正数数量和非负价格。',createFailed:'创建失败',saveFailed:'保存失败'},
      ja:{sales:'販売',enquiries:'引合',title:'引合',request:'顧客依頼',customer:'顧客',date:'引合日',channel:'チャネル',owner:'担当者',estimated:'見込金額',currency:'通貨',status:'ステータス',newStatus:'新規',quoted:'見積済',lost:'失注',trace:'アクティビティ',captured:'引合を記録',linked:'見積書を関連付け',related:'関連伝票',noQuote:'この引合から見積書はまだ作成されていません。',back:'引合一覧へ戻る',convert:'見積書へ変換',viewQuote:'見積書を表示',empty:'利用可能な標準引合はありません。',emptyHelp:'販売プロセスを開始するには一覧から引合を作成してください。',source:'単一の正規データ',sourceHelp:'ヘッダー、明細、金額、関連伝票を会社データベースから再読込します。',limit:'1件の引合から作成できる関連見積書は1件です。',created:'作成日時',updated:'最終更新',overview:'概要',items:'明細',documentInfo:'伝票情報',activity:'履歴',addItem:'明細追加',addRow:'行を追加',addStockItem:'在庫品目',addFreeText:'フリーテキスト項目',chooseLineType:'行の種類を選択',stockItemHelp:'品目マスタから在庫品目を選択します。',freeTextHelp:'在庫マスタを作成せず説明を入力します。',nonStock:'非在庫',description:'説明',descriptionPlaceholder:'製品、サービス、料金の説明を入力',createFirstItem:'最初の品目を作成',saveItems:'明細保存',product:'製品 / サービス',quantity:'数量',unitPrice:'見込単価',lineTotal:'行合計',remove:'削除',noItems:'明細はまだありません。',noItemsHelp:'顧客が必要とする製品またはサービスを追加してください。',noProductsHelp:'この会社には品目マスタがありません。最初の品目を作成すると、この引合に自動追加されます。',newProduct:'製品 / サービスを作成',sku:'SKU',itemName:'品目名',category:'カテゴリ',uom:'基本単位',cancel:'キャンセル',createAndAdd:'作成して追加',creating:'作成中…',itemCreated:'品目を作成して引合に追加しました。',itemRequired:'SKU と品目名を入力してください。',itemsSaved:'明細を保存しました',itemsLocked:'新規ステータスを離れると明細は読取専用になります。',version:'伝票バージョン',documentNo:'伝票番号',company:'会社',rowCount:'明細行数',unsaved:'未保存の明細変更',reload:'変更を破棄',saveHelp:'保存時に正規明細と見込金額を更新します。',required:'各明細に説明、単位、正の数量、0以上の価格を入力してください。',createFailed:'作成に失敗しました',saveFailed:'保存に失敗しました'},
      vi:{sales:'Bán hàng',enquiries:'Yêu cầu báo giá',title:'Yêu cầu báo giá',request:'Yêu cầu khách hàng',customer:'Khách hàng',date:'Ngày yêu cầu',channel:'Kênh',owner:'Người phụ trách',estimated:'Giá trị ước tính',currency:'Tiền tệ',status:'Trạng thái',newStatus:'Mới',quoted:'Đã báo giá',lost:'Đã mất',trace:'Hoạt động',captured:'Đã ghi nhận yêu cầu',linked:'Đã liên kết báo giá',related:'Chứng từ liên quan',noQuote:'Chưa có báo giá được tạo từ yêu cầu này.',back:'Quay lại danh sách',convert:'Chuyển thành báo giá',viewQuote:'Xem báo giá',empty:'Không có yêu cầu chuẩn khả dụng.',emptyHelp:'Tạo yêu cầu từ danh sách để bắt đầu quy trình bán hàng.',source:'Nguồn dữ liệu duy nhất',sourceHelp:'Thông tin, dòng hàng, tổng và chứng từ liên kết được đọc lại từ cơ sở dữ liệu công ty.',limit:'Mỗi yêu cầu chỉ có thể tạo một báo giá liên kết.',created:'Đã tạo',updated:'Cập nhật lần cuối',overview:'Tổng quan',items:'Mặt hàng',documentInfo:'Thông tin chứng từ',activity:'Hoạt động',addItem:'Thêm mặt hàng',addRow:'Thêm dòng',addStockItem:'Mặt hàng tồn kho',addFreeText:'Mặt hàng nhập tự do',chooseLineType:'Chọn loại dòng',stockItemHelp:'Chọn mặt hàng từ danh mục sản phẩm.',freeTextHelp:'Nhập mô tả mà không tạo dữ liệu gốc tồn kho.',nonStock:'Không tồn kho',description:'Mô tả',descriptionPlaceholder:'Mô tả sản phẩm, dịch vụ hoặc khoản phí',createFirstItem:'Tạo mặt hàng đầu tiên',saveItems:'Lưu mặt hàng',product:'Sản phẩm / dịch vụ',quantity:'Số lượng',unitPrice:'Đơn giá ước tính',lineTotal:'Tổng dòng',remove:'Xóa',noItems:'Chưa có mặt hàng.',noItemsHelp:'Thêm sản phẩm hoặc dịch vụ khách hàng yêu cầu.',noProductsHelp:'Công ty này chưa có dữ liệu gốc sản phẩm. Tạo mặt hàng đầu tiên tại đây và hệ thống sẽ tự thêm vào yêu cầu.',newProduct:'Tạo sản phẩm / dịch vụ',sku:'SKU',itemName:'Tên mặt hàng',category:'Danh mục',uom:'ĐVT cơ bản',cancel:'Hủy',createAndAdd:'Tạo và thêm',creating:'Đang tạo…',itemCreated:'Đã tạo mặt hàng và thêm vào yêu cầu.',itemRequired:'Nhập SKU và tên mặt hàng.',itemsSaved:'Đã lưu mặt hàng',itemsLocked:'Mặt hàng chỉ đọc khi yêu cầu không còn ở trạng thái Mới.',version:'Phiên bản chứng từ',documentNo:'Số chứng từ',company:'Công ty',rowCount:'Số dòng',unsaved:'Thay đổi chưa lưu',reload:'Bỏ thay đổi',saveHelp:'Lưu để cập nhật các dòng chuẩn và tính lại giá trị.',required:'Hoàn tất mô tả, đơn vị, số lượng lớn hơn 0 và giá không âm cho mỗi dòng.',createFailed:'Tạo thất bại',saveFailed:'Lưu thất bại'},
    };
    const headerCopy={
      en:{selectCustomer:'Search or select customer',subject:'Subject',headerHelp:'Header changes and item changes are saved together in one transaction.',derivedHelp:'Calculated from saved item rows.',saveChanges:'Save changes',changesSaved:'Enquiry saved',headerRequired:'Complete the required header fields.',unsaved:'Unsaved changes',saveHelp:'Saving updates the canonical header and item set, then recalculates the estimated value.',sourceHelp:'Header, items, totals and linked documents are re-read from the active company database. Saving header or items replaces the editable draft atomically.'},
      ms:{selectCustomer:'Cari atau pilih pelanggan',subject:'Subjek',headerHelp:'Perubahan header dan item disimpan bersama dalam satu transaksi.',derivedHelp:'Dikira daripada baris item yang disimpan.',saveChanges:'Simpan perubahan',changesSaved:'Pertanyaan disimpan',headerRequired:'Lengkapkan medan header yang diperlukan.',unsaved:'Perubahan belum disimpan',saveHelp:'Simpanan mengemas kini header dan set item kanonik, kemudian mengira semula nilai anggaran.',sourceHelp:'Header, item, jumlah dan dokumen terpaut dibaca semula daripada pangkalan data syarikat aktif.'},
      zh:{selectCustomer:'搜索或选择客户',subject:'主题',headerHelp:'抬头和明细的更改会在同一个事务中一起保存。',derivedHelp:'根据已保存的明细行计算。',saveChanges:'保存更改',changesSaved:'询价已保存',headerRequired:'请填写必填的抬头字段。',unsaved:'有未保存的更改',saveHelp:'保存会更新标准抬头和明细，并重新计算预计金额。',sourceHelp:'抬头、明细、金额与关联单据都从当前公司数据库重新读取。保存抬头或明细时会以原子方式更新草稿。'},
      ja:{selectCustomer:'顧客を検索または選択',subject:'件名',headerHelp:'ヘッダーと明細の変更は1つのトランザクションで保存されます。',derivedHelp:'保存済みの明細行から計算されます。',saveChanges:'変更を保存',changesSaved:'引合を保存しました',headerRequired:'必須のヘッダー項目を入力してください。',unsaved:'未保存の変更',saveHelp:'保存すると正規のヘッダーと明細を更新し、見込金額を再計算します。',sourceHelp:'ヘッダー、明細、金額、関連伝票を会社データベースから再読込します。'},
      vi:{selectCustomer:'Tìm hoặc chọn khách hàng',subject:'Chủ đề',headerHelp:'Thay đổi phần đầu và mặt hàng được lưu trong cùng một giao dịch.',derivedHelp:'Được tính từ các dòng mặt hàng đã lưu.',saveChanges:'Lưu thay đổi',changesSaved:'Đã lưu yêu cầu',headerRequired:'Hoàn tất các trường bắt buộc của phần đầu.',unsaved:'Thay đổi chưa lưu',saveHelp:'Lưu sẽ cập nhật phần đầu và danh sách mặt hàng chuẩn, sau đó tính lại giá trị.',sourceHelp:'Thông tin, dòng hàng, tổng và chứng từ liên kết được đọc lại từ cơ sở dữ liệu công ty.'},
    };
    Object.keys(headerCopy).forEach(locale=>Object.assign(packs[locale],headerCopy[locale]));
    const selectProductCopy={en:'Select inventory item',ms:'Pilih item stok',zh:'选择库存商品',ja:'在庫品目を選択',vi:'Chọn mặt hàng tồn kho'};
    Object.keys(selectProductCopy).forEach(locale=>{packs[locale].selectProduct=selectProductCopy[locale];});
    const pack=i18nLegacy(packs);
    return key=>pack[key]||packs.en[key]||key;
  }

  function adapter(){
    if(!window.ErpSystemData) throw new Error('ERP data adapter is unavailable.');
    return window.ErpSystemData;
  }
  function statusLabel(s,status){
    return ({new:s('newStatus'),quoted:s('quoted'),lost:s('lost')})[status]||status;
  }
  function statusTone(status){return status==='quoted'?'accent':status==='lost'?'danger':'info';}
  function amount(value,currency){
    const n=Number(value||0);
    try{return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||DB.company.currency}).format(n);}
    catch{return `${currency||DB.company.currency} ${n.toFixed(2)}`;}
  }
  function emptyHtml(s){
    return `<div class="content full"><section class="master"><div class="statepanel empty">${ic('comment')}<h3>${esc(s('empty'))}</h3><p>${esc(s('emptyHelp'))}</p>${btn(s('back'),{icon:'chevL',cls:'soft',attrs:'data-empty-back'})}</div></section></div>`;
  }

  async function load(id){
    const a=adapter();
    let selectedId=Number.isSafeInteger(Number(id))&&Number(id)>0?Number(id):null;
    if(!selectedId){
      const first=(await a.list('sales/enquiries',{limit:1})).data?.[0]||null;
      selectedId=Number.isSafeInteger(Number(first?.id))&&Number(first.id)>0?Number(first.id):null;
    }
    if(!selectedId) return {enquiry:null,customer:null,quotations:[],products:[],lines:[]};
    const aggregate=(await a.getSalesEnquiryAggregate(selectedId)).data||null;
    if(!aggregate) return {enquiry:null,customer:null,quotations:[],products:[],lines:[]};
    const [productPage,customerPage]=await Promise.all([
      a.list('inventory/products',{limit:100}),
      a.list('sales/customers',{limit:100}),
    ]);
    const customers=customerPage.data||[];
    if(aggregate.customer&&!customers.some(row=>Number(row.id)===Number(aggregate.customer.id))) customers.unshift(aggregate.customer);
    return {
      enquiry:aggregate.enquiry,
      customer:aggregate.customer,
      customers,
      quotations:aggregate.quotations||[],
      products:productPage.data||[],
      lines:(aggregate.lines||[]).sort((a,b)=>Number(a.lineNo)-Number(b.lineNo)),
    };
  }

  SCREENS['txn-view']=async function(root){
    const s=copy();
    const selected=Number(window.ACTIVE_SALES_ENQUIRY_ID)||Number(TXN_OPEN&&TXN_OPEN.id)||null;
    const data=await load(selected);
    const enquiry=data.enquiry;
    if(!enquiry){
      root.innerHTML=emptyHtml(s);
      root.querySelector('[data-empty-back]')?.addEventListener('click',()=>navigate('enquiries'));
      return;
    }
    window.ACTIVE_SALES_ENQUIRY_ID=Number(enquiry.id);
    TXN_OPEN={kind:'enquiry',id:Number(enquiry.id)};
    const customer=data.customer||{};
    const customerById=new Map((data.customers||[]).map(row=>[Number(row.id),row]));
    const quotation=data.quotations[0]||null;
    const productById=new Map(data.products.map(row=>[Number(row.id),row]));
    const state={header:{customerId:Number(enquiry.customerId),subject:String(enquiry.subject||''),channel:String(enquiry.channel||''),currency:String(enquiry.currency||''),ownerName:String(enquiry.ownerName||''),enquiryDate:String(enquiry.enquiryDate||'')},lines:data.lines.map(row=>{const item=productById.get(Number(row.productId))||{};return {lineType:row.lineType||'stock',productId:row.productId==null?null:Number(row.productId),description:String(row.description||item.name||''),uom:String(row.uom||item.uom||'unit'),qty:String(row.qty),estimatedUnitPrice:String(row.estimatedUnitPrice)};}),dirty:false,saving:false,saveIdempotencyKey:null};
    function markDirty(){state.dirty=true;state.saveIdempotencyKey=null;}
    function draftCurrency(){return state.header.currency||enquiry.currency||DB.company.currency;}
    function selectedCustomer(){return customerById.get(Number(state.header.customerId))||(Number(state.header.customerId)===Number(customer.id)?customer:{});}
    const timeline=[
      `<div class="tl ${quotation?'':'current'}"><span class="tldot"></span><div class="tlbody"><div class="when">${esc(dateTimeValue(enquiry.createdAt||enquiry.enquiryDate))}</div><div class="what">${esc(s('captured'))}</div><div class="det">${esc(enquiry.ownerName)} · ${esc(enquiry.channel)}</div></div></div>`,
      quotation?`<div class="tl current"><span class="tldot"></span><div class="tlbody"><div class="when">${esc(dateTimeValue(quotation.createdAt||quotation.quoteDate))}</div><div class="what">${esc(s('linked'))} · ${esc(quotation.docNo)}</div><div class="det">${esc(statusLabel(s,quotation.status))}</div></div></div>`:'',
    ].join('');
    const related=quotation
      ?`<button class="related" data-open-related-quote><span><b>${esc(quotation.docNo)}</b><small>${esc(dateValue(quotation.quoteDate))} · ${esc(amount(quotation.totalAmount,quotation.currency))}</small></span>${cap(statusLabel(s,quotation.status),statusTone(quotation.status))}</button>`
      :`<p class="h1sub">${esc(s('noQuote'))}</p>`;
    const primary=quotation
      ?btn(s('viewQuote'),{icon:'receipt',cls:'primary',attrs:'data-view-related-quote'})
      :enquiry.status==='new'&&data.lines.length&&typeof window.openCanonicalEnquiryConversion==='function'
        ?btn(s('convert'),{icon:'receipt',cls:'primary',attrs:'data-convert-enquiry'})
        :enquiry.status==='new'&&!data.lines.length
          ?btn(s('addItem'),{icon:'plus',cls:'primary',attrs:'data-open-enquiry-items'})
        :'';
    const tabs=[['overview',s('overview')],['items',s('items')],['document',s('documentInfo')],['activity',s('activity')]];
    function draftTotal(){return state.lines.reduce((sum,line)=>sum+Number(line.qty||0)*Number(line.estimatedUnitPrice||0),0);}
    function tabButton(tab,label){return `<button class="tab ${activeTab===tab?'on':''}" role="tab" aria-selected="${activeTab===tab}" aria-controls="enquiry-panel-${tab}" id="enquiry-tab-${tab}" data-enquiry-tab="${tab}">${esc(label)}${tab==='items'?`<span class="tc">${state.lines.length}</span>`:''}</button>`;}
    function summaryHtml(){return `<aside class="summary"><div class="sumcard"><div class="sumrow total"><span class="sk2">${esc(s('estimated'))}</span><span class="sv tnum" data-enquiry-total>${esc(amount(activeTab==='items'?draftTotal():enquiry.estimatedValue,draftCurrency()))}</span></div><div class="sumrow"><span class="sk2">${esc(s('currency'))}</span><span class="sv" data-enquiry-currency>${esc(draftCurrency())}</span></div><div class="sumrow"><span class="sk2">${esc(s('rowCount'))}</span><span class="sv tnum" data-enquiry-row-count>${state.lines.length}</span></div><div class="sumrow"><span class="sk2">${esc(s('updated'))}</span><span class="sv">${esc(dateValue(enquiry.updatedAt||enquiry.enquiryDate))}</span></div></div><div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('related'))}</div>${related}<p class="h1sub" style="margin-top:10px">${esc(s('limit'))}</p></div></aside>`;}
    function overviewHtml(){const headerCustomer=selectedCustomer();return `<div class="doclayout"><div class="docmain"><div class="panel enquiry-request-card"><div class="panel-h">${ic('comment')}<h3>${esc(s('request'))}</h3></div><div class="panel-body"><p>${esc(state.header.subject)}</p></div></div><div class="enquiry-overview-strip"><div><small>${esc(s('customer'))}</small><b>${esc(headerCustomer.name||'#'+state.header.customerId)}</b></div><div><small>${esc(s('owner'))}</small><b>${esc(state.header.ownerName)}</b></div><div><small>${esc(s('channel'))}</small><b>${esc(state.header.channel)}</b></div><div><small>${esc(s('items'))}</small><b>${state.lines.length}</b></div></div><div class="alert info">${ic('lock')}<span><b>${esc(s('source'))}:</b> ${esc(s('sourceHelp'))}</span></div></div>${summaryHtml()}</div>`;}
    function productOptions(selected){
      const hasSelected=Number.isSafeInteger(Number(selected))&&Number(selected)>0;
      return `<option value="" ${hasSelected?'':'selected'}>${esc(s('selectProduct'))}</option>${data.products.map(row=>`<option value="${row.id}" ${Number(row.id)===Number(selected)?'selected':''}>${esc(row.sku)} · ${esc(row.name)}</option>`).join('')}`;
    }
    function rerenderItems(focusSelector){
      activeTab='items';
      const panel=root.querySelector('[data-enquiry-tab-panel]');
      if(!panel)return;
      panel.innerHTML=itemsHtml();
      bindItems();
      refreshDraftTotals();
      if(focusSelector)setTimeout(()=>root.querySelector(focusSelector)?.focus(),0);
    }
    function appendStockLine(){
      if(!data.products.length){openQuickProduct();return;}
      const index=state.lines.length;
      state.lines.push({lineType:'stock',productId:null,description:'',uom:'unit',qty:'1',estimatedUnitPrice:'0.00'});
      markDirty();
      rerenderItems(`[data-enquiry-line="${index}"] [data-line-product]`);
    }
    function appendProductLine(productId){
      const item=productById.get(Number(productId))||{};
      state.lines.push({lineType:'stock',productId:Number(productId),description:String(item.name||''),uom:String(item.uom||'unit'),qty:'1',estimatedUnitPrice:'0.00'});
      markDirty();
      rerenderItems(`[data-enquiry-line="${state.lines.length-1}"] [data-line-description]`);
    }
    function appendFreeTextLine(){
      const index=state.lines.length;
      state.lines.push({lineType:'non_stock',productId:null,description:'',uom:'unit',qty:'1',estimatedUnitPrice:'0.00'});
      markDirty();
      rerenderItems(`[data-enquiry-line="${index}"] [data-line-description]`);
    }
    function openQuickProduct(){
      const suggestedSku=`ITEM-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      const categories=['Components','Raw Materials','Finished Goods','Consumables','Packaging'];
      const uoms=['unit','ea','set','box','kg','g','m','cm','L','sheet','pair'];
      appModal({
        icon:'box',title:s('newProduct'),width:620,
        body:`<p class="h1sub" style="margin:0 0 16px">${esc(s('noProductsHelp'))}</p><div class="fldrow c2">
          <label class="fld"><span>${esc(s('sku'))} <span class="req">*</span></span><input data-quick-product-sku maxlength="80" autocomplete="off" value="${esc(suggestedSku)}" style="text-transform:uppercase"></label>
          <label class="fld"><span>${esc(s('itemName'))} <span class="req">*</span></span><input data-quick-product-name maxlength="200" autocomplete="off" autofocus></label>
          <label class="fld"><span>${esc(s('category'))}</span><select data-quick-product-category>${categories.map(value=>`<option value="${esc(value)}" ${value==='Finished Goods'?'selected':''}>${esc(value)}</option>`).join('')}</select></label>
          <label class="fld"><span>${esc(s('uom'))}</span><select data-quick-product-uom>${uoms.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>
        </div><div class="risk danger" data-quick-product-error role="alert" aria-live="polite" hidden></div>`,
        actions:btn(s('cancel'),{cls:'soft',attrs:'data-quick-product-cancel'})+btn(s('createAndAdd'),{icon:'plus',cls:'primary',attrs:'data-quick-product-create'}),
      });
      const modal=document.querySelector('#modalEl');
      const skuInput=modal?.querySelector('[data-quick-product-sku]');
      const nameInput=modal?.querySelector('[data-quick-product-name]');
      const errorBox=modal?.querySelector('[data-quick-product-error]');
      modal?.querySelector('[data-quick-product-cancel]')?.addEventListener('click',closeModal);
      skuInput?.addEventListener('input',()=>{skuInput.value=skuInput.value.toUpperCase();});
      modal?.querySelector('[data-quick-product-create]')?.addEventListener('click',async event=>{
        const button=event.currentTarget;
        const sku=skuInput?.value.trim().toUpperCase()||'';
        const name=nameInput?.value.trim()||'';
        if(!sku||!name){if(errorBox){errorBox.textContent=s('itemRequired');errorBox.hidden=false;}(!sku?skuInput:nameInput)?.focus();return;}
        button.disabled=true;
        const original=button.innerHTML;
        button.textContent=s('creating');
        try{
          const category=modal.querySelector('[data-quick-product-category]').value;
          const uom=modal.querySelector('[data-quick-product-uom]').value;
          const result=await adapter().create('inventory/products',{sku,name,category,uom,standardCost:'0',reorderPoint:'0',reorderQty:'0'});
          const created={id:Number(result.data.id),sku,name,category,uom,standardCost:'0',reorderPoint:'0',reorderQty:'0'};
          data.products.push(created);
          productById.set(created.id,created);
          closeModal();
          appendProductLine(created.id);
          toast(s('itemCreated'),'ok');
        }catch(error){
          button.disabled=false;
          button.innerHTML=original;
          if(errorBox){errorBox.textContent=error&&error.message||s('createFailed');errorBox.hidden=false;}
          toast(error&&error.message||s('createFailed'),'danger');
        }
      });
      setTimeout(()=>nameInput?.focus(),80);
    }
    function itemsHtml(){
      const editable=enquiry.status==='new';
      const rows=state.lines.map((line,index)=>{
        const product=productById.get(Number(line.productId))||{};
        const nonStock=line.lineType==='non_stock';
        const identity=editable
          ?`${nonStock?`<div class="enquiry-line-kind">${cap(s('nonStock'),'info')}</div>`:`<select class="lineinput l" data-line-product aria-label="${esc(s('product'))} ${index+1}">${productOptions(line.productId)}</select>`}
            <div class="enquiry-line-copy"><input class="lineinput l" data-line-description maxlength="500" value="${esc(line.description)}" placeholder="${esc(s('descriptionPlaceholder'))}" aria-label="${esc(s('description'))} ${index+1}"><input class="lineinput enquiry-line-uom-input" data-line-uom maxlength="40" value="${esc(line.uom)}" aria-label="${esc(s('uom'))} ${index+1}"></div>`
          :`<div class="li-name"><b>${esc(line.description)}</b><small>${nonStock?esc(s('nonStock')):esc(product.sku||'')} · ${esc(line.uom)}</small></div>`;
        return `<tr data-enquiry-line="${index}" data-line-type="${esc(line.lineType)}"><td class="lineno" data-label="#">${index+1}</td><td class="l" data-label="${esc(s('product'))}">${identity}</td><td data-label="${esc(s('quantity'))}">${editable?`<input class="lineinput" data-line-qty type="number" inputmode="decimal" min="0.0001" step="0.0001" value="${esc(line.qty)}" aria-label="${esc(s('quantity'))} ${index+1}">`:`<span class="tnum">${esc(String(Number(line.qty)))}</span>`}</td><td data-label="${esc(s('unitPrice'))}">${editable?`<input class="lineinput" data-line-price type="number" inputmode="decimal" min="0" step="0.0001" value="${esc(line.estimatedUnitPrice)}" aria-label="${esc(s('unitPrice'))} ${index+1}">`:`<span class="tnum">${esc(amount(line.estimatedUnitPrice,draftCurrency()))}</span>`}</td><td data-label="${esc(s('lineTotal'))}"><b class="tnum" data-line-total>${esc(amount(Number(line.qty)*Number(line.estimatedUnitPrice),draftCurrency()))}</b></td><td class="enquiry-line-action">${editable?`<button class="iconbtn" data-line-remove aria-label="${esc(s('remove'))} ${index+1}" data-tip="${esc(s('remove'))}">${ic('trash')}</button>`:''}</td></tr>`;
      }).join('');
      const lineAddActions=editable?`<div class="enquiry-line-add-actions" role="group" aria-label="${esc(s('addRow'))}">${btn(s('addStockItem'),{icon:'box',cls:'primary',attrs:'data-add-stock-line'})}${btn(s('addFreeText'),{icon:'edit',cls:'soft',attrs:'data-add-free-text-line'})}</div>`:'';
      const emptyHelp=data.products.length?s('noItemsHelp'):s('noProductsHelp');
      const empty=`<div class="enquiry-items-empty">${ic('box')}<h3>${esc(s('noItems'))}</h3><p>${esc(emptyHelp)}</p>${lineAddActions}</div>`;
      const editorActions=editable?(state.lines.length?lineAddActions+btn(s('saveItems'),{icon:'check',cls:'primary',attrs:`data-save-enquiry-items ${state.dirty?'':'disabled'}`}):''):'';
      return `<div class="doclayout enquiry-items-layout"><div class="docmain"><div class="panel enquiry-items-panel"><div class="panel-h">${ic('box')}<h3>${esc(s('items'))}</h3><span class="enquiry-unsaved" data-enquiry-unsaved ${state.dirty?'':'hidden'}>${esc(s('unsaved'))}</span><div class="grow"></div>${editorActions}</div>${state.lines.length?`<div class="enquiry-items-scroll" tabindex="0"><table class="lines enquiry-items-table"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('product'))}</th><th>${esc(s('quantity'))}</th><th>${esc(s('unitPrice'))}</th><th>${esc(s('lineTotal'))}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="linefoot"><small>${esc(editable?s('saveHelp'):s('itemsLocked'))}</small></div>`:empty}</div></div>${summaryHtml()}</div>`;
    }
    function documentHtml(){
      const editable=enquiry.status==='new';
      const headerCustomer=selectedCustomer();
      const facts=[[s('documentNo'),enquiry.docNo],[s('status'),statusLabel(s,enquiry.status)],[s('estimated'),amount(enquiry.estimatedValue,draftCurrency())],[s('rowCount'),String(state.lines.length)],[s('version'),String(enquiry.version)],[s('created'),dateTimeValue(enquiry.createdAt||enquiry.enquiryDate)],[s('updated'),dateTimeValue(enquiry.updatedAt||enquiry.enquiryDate)],[s('company'),DB.company.name]];
      const customerOptions=(data.customers||[]).map(row=>({value:String(row.id),label:String(row.name||row.code||`#${row.id}`),sub:String(row.code||'')}));
      const customerPicker=customerOptions.length
        ?combobox({id:'enquiryHeaderCustomer',value:String(state.header.customerId),options:customerOptions,placeholder:s('selectCustomer')})
        :`<input value="${esc(headerCustomer.name||'#'+state.header.customerId)}" readonly>`;
      const channelValues=['direct','email','phone','web'];
      if(state.header.channel&&!channelValues.includes(state.header.channel)) channelValues.push(state.header.channel);
      const channelOptions=channelValues.map(value=>`<option value="${esc(value)}" ${value===state.header.channel?'selected':''}>${esc(value.charAt(0).toUpperCase()+value.slice(1))}</option>`).join('');
      const editor=editable?`<div class="enquiry-document-fields">
          <label class="fld span2"><span>${esc(s('customer'))} <i class="req">*</i></span>${customerPicker}</label>
          <label class="fld span2"><span>${esc(s('subject'))} <i class="req">*</i></span><input data-header-field="subject" maxlength="100" value="${esc(state.header.subject)}"></label>
          <label class="fld"><span>${esc(s('date'))} <i class="req">*</i></span><input data-header-field="enquiryDate" type="date" value="${esc(state.header.enquiryDate)}"></label>
          <label class="fld"><span>${esc(s('channel'))}</span><select data-header-field="channel">${channelOptions}</select></label>
          <label class="fld"><span>${esc(s('owner'))} <i class="req">*</i></span><input data-header-field="ownerName" maxlength="120" value="${esc(state.header.ownerName)}"></label>
          <label class="fld"><span>${esc(s('currency'))} <i class="req">*</i></span><input data-header-field="currency" maxlength="3" inputmode="text" autocapitalize="characters" value="${esc(state.header.currency)}"></label>
        </div><div class="enquiry-document-note">${ic('info')}<span>${esc(s('headerHelp'))} ${esc(s('derivedHelp'))}</span></div>`:'';
      return `<div class="panel enquiry-document-info"><div class="panel-h">${ic('receipt')}<h3>${esc(s('documentInfo'))}</h3>${editable?`<span class="enquiry-unsaved" data-enquiry-unsaved ${state.dirty?'':'hidden'}>${esc(s('unsaved'))}</span><div class="grow"></div>${btn(s('saveChanges'),{icon:'check',cls:'primary',attrs:`data-save-enquiry-header ${state.dirty?'':'disabled'}`})}`:''}</div>${editor}<div class="enquiry-info-grid">${editable?`<div><small>${esc(s('customer'))}</small><b data-enquiry-header-preview="customer">${esc(headerCustomer.name||'#'+state.header.customerId)}</b></div><div><small>${esc(s('channel'))}</small><b data-enquiry-header-preview="channel">${esc(state.header.channel||'—')}</b></div><div><small>${esc(s('owner'))}</small><b data-enquiry-header-preview="ownerName">${esc(state.header.ownerName||'—')}</b></div><div><small>${esc(s('currency'))}</small><b data-enquiry-header-preview="currency">${esc(state.header.currency||'—')}</b></div>`:''}${facts.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value||'—')}</b></div>`).join('')}</div></div>`;
    }
    function activityHtml(){return `<div class="doclayout"><div class="docmain"><div class="panel"><div class="panel-h">${ic('history')}<h3>${esc(s('trace'))}</h3></div><div class="panel-body"><div class="timeline">${timeline}</div></div></div><div class="alert info">${ic('lock')}<span><b>${esc(s('source'))}:</b> ${esc(s('sourceHelp'))}</span></div></div>${summaryHtml()}</div>`;}
    function activeHtml(){return activeTab==='items'?itemsHtml():activeTab==='document'?documentHtml():activeTab==='activity'?activityHtml():overviewHtml();}
    root.innerHTML=`<div class="content full"><section class="master enquiry-workspace" data-sales-transaction="canonical" data-record-id="${Number(enquiry.id)}" data-related-count="${data.quotations.length}"><div class="scrollarea">
      <div class="pagehead">${crumbs([DB.company.name,{label:s('sales'),route:'sales-home'},{label:s('enquiries'),route:'enquiries'},{cur:enquiry.docNo}])}${typeof salesNav==='function'?salesNav('enquiries'):''}</div>
      <div class="docwrap"><div class="docpage"><div class="dochead"><div class="dh-row1"><div><h1 class="dt">${ic('comment')}${esc(s('title'))} <span class="dnum">${esc(enquiry.docNo)}</span></h1><div class="h1sub">${esc(enquiry.subject)}</div></div><div class="dactions">${cap(statusLabel(s,enquiry.status),statusTone(enquiry.status))}</div></div>
        <div class="docmeta"><div class="dm"><small>${esc(s('customer'))}</small><div class="partner">${profileAvatar({name:customer.name||'#'+enquiry.customerId,src:customer.imageUrl||customer.photoUrl||customer.avatarUrl,cls:'pav',size:26})}<b>${esc(customer.name||'#'+enquiry.customerId)}</b></div></div><div class="dm"><small>${esc(s('date'))}</small><b>${esc(dateValue(enquiry.enquiryDate))}</b></div><div class="dm"><small>${esc(s('owner'))}</small><b>${esc(enquiry.ownerName)}</b></div><div class="dm"><small>${esc(s('estimated'))}</small><b class="tnum">${esc(amount(enquiry.estimatedValue,enquiry.currency))}</b></div></div><div class="tabs enquiry-tabs" role="tablist" aria-label="${esc(s('title'))}">${tabs.map(tab=>tabButton(tab[0],tab[1])).join('')}</div></div>
        <div class="enquiry-tab-panel" role="tabpanel" id="enquiry-panel-${activeTab}" aria-labelledby="enquiry-tab-${activeTab}" data-enquiry-tab-panel>${activeHtml()}</div>
      </div></div></div><div class="responsive-actionbar">${btn(s('back'),{icon:'chevL',cls:'soft',attrs:'data-back-enquiries'})}<div class="grow"></div>${primary}</div>
    </div></section></div>`;
    const openQuotation=()=>{
      if(!quotation) return;
      window.ACTIVE_SALES_QUOTATION_ID=Number(quotation.id);
      navigate('quotation');
    };
    root.querySelector('[data-back-enquiries]')?.addEventListener('click',()=>navigate('enquiries'));
    root.querySelector('[data-open-related-quote]')?.addEventListener('click',openQuotation);
    root.querySelector('[data-view-related-quote]')?.addEventListener('click',openQuotation);
    root.querySelector('[data-convert-enquiry]')?.addEventListener('click',()=>{
      window.openCanonicalEnquiryConversion(enquiry,{products:data.products,lines:state.lines});
    });
    root.querySelector('[data-open-enquiry-items]')?.addEventListener('click',()=>{activeTab='items';renderTab();});
    function refreshDraftTotals(){
      root.querySelectorAll('[data-enquiry-line]').forEach(row=>{const line=state.lines[Number(row.dataset.enquiryLine)];const target=row.querySelector('[data-line-total]');if(target)target.textContent=amount(Number(line.qty||0)*Number(line.estimatedUnitPrice||0),draftCurrency());});
      root.querySelectorAll('[data-enquiry-total]').forEach(node=>{node.textContent=amount(draftTotal(),draftCurrency());});
      root.querySelectorAll('[data-enquiry-currency]').forEach(node=>{node.textContent=draftCurrency();});
      root.querySelectorAll('[data-enquiry-row-count]').forEach(node=>{node.textContent=String(state.lines.length);});
      const tabCount=root.querySelector('[data-enquiry-tab="items"] .tc');if(tabCount)tabCount.textContent=String(state.lines.length);
      root.querySelectorAll('[data-enquiry-unsaved]').forEach(node=>node.toggleAttribute('hidden',!state.dirty));
      root.querySelectorAll('[data-save-enquiry-items],[data-save-enquiry-header]').forEach(button=>{button.disabled=!state.dirty||state.saving;});
      const convertButton=root.querySelector('[data-convert-enquiry]');
      if(convertButton){const blocked=state.dirty||state.saving;convertButton.disabled=blocked;convertButton.setAttribute('aria-disabled',String(blocked));}
      const headerPreview=selectedCustomer();
      root.querySelector('[data-enquiry-header-preview="customer"]')?.replaceChildren(document.createTextNode(headerPreview.name||'#'+state.header.customerId));
      root.querySelector('[data-enquiry-header-preview="channel"]')?.replaceChildren(document.createTextNode(state.header.channel||'—'));
      root.querySelector('[data-enquiry-header-preview="ownerName"]')?.replaceChildren(document.createTextNode(state.header.ownerName||'—'));
      root.querySelector('[data-enquiry-header-preview="currency"]')?.replaceChildren(document.createTextNode(draftCurrency()||'—'));
    }
    async function saveDraft(event){
      if(state.saving||!state.dirty)return;
      if(!Number.isSafeInteger(Number(state.header.customerId))||Number(state.header.customerId)<=0||!String(state.header.subject||'').trim()||!String(state.header.channel||'').trim()||!String(state.header.ownerName||'').trim()||!/^[A-Z]{3}$/.test(String(state.header.currency||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(state.header.enquiryDate||''))){toast(s('headerRequired'),'warn');return;}
      if(state.lines.some(line=>(line.lineType==='stock'&&(!Number.isSafeInteger(Number(line.productId))||Number(line.productId)<=0))||!String(line.description||'').trim()||!String(line.uom||'').trim()||!Number.isFinite(Number(line.qty))||Number(line.qty)<=0||!Number.isFinite(Number(line.estimatedUnitPrice))||Number(line.estimatedUnitPrice)<0)){toast(s('required'),'warn');return;}
      state.saving=true;if(event&&event.currentTarget)event.currentTarget.disabled=true;
      try{
        const payload={
          expectedVersion:Number(enquiry.version),
          header:{
            customerId:Number(state.header.customerId),
            subject:String(state.header.subject||'').trim(),
            channel:String(state.header.channel||'').trim(),
            currency:String(state.header.currency||'').trim().toUpperCase(),
            ownerName:String(state.header.ownerName||'').trim(),
            enquiryDate:String(state.header.enquiryDate||''),
          },
          lines:state.lines.map(line=>({
            lineType:line.lineType,
            productId:line.lineType==='stock'&&line.productId!=null?Number(line.productId):null,
            description:String(line.description).trim(),
            uom:String(line.uom).trim(),
            qty:String(line.qty),
            estimatedUnitPrice:String(line.estimatedUnitPrice),
          })),
        };
        if(!state.saveIdempotencyKey) state.saveIdempotencyKey=globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function'
          ?globalThis.crypto.randomUUID()
          :`save-enquiry-draft-${enquiry.id}-${Date.now()}`;
        await adapter().action('sales/enquiries',enquiry.id,'save-draft',payload,state.saveIdempotencyKey);
        toast(s('changesSaved'),'ok');
        await SCREENS['txn-view'](root);
      }catch(error){state.saving=false;if(event&&event.currentTarget)event.currentTarget.disabled=false;toast(error&&error.message||s('saveFailed'),'danger');}
    }
    function bindItems(){
      root.querySelectorAll('[data-add-stock-line]').forEach(button=>button.addEventListener('click',appendStockLine));
      root.querySelectorAll('[data-add-free-text-line]').forEach(button=>button.addEventListener('click',appendFreeTextLine));
      root.querySelectorAll('[data-enquiry-line]').forEach(row=>{const index=Number(row.dataset.enquiryLine),line=state.lines[index];row.querySelector('[data-line-product]')?.addEventListener('change',event=>{const value=String(event.target.value||'');line.productId=value?Number(value):null;const item=productById.get(Number(line.productId))||{};line.description=String(item.name||'');line.uom=String(item.uom||'unit');markDirty();root.querySelector('[data-enquiry-tab-panel]').innerHTML=itemsHtml();bindItems();refreshDraftTotals();});row.querySelector('[data-line-description]')?.addEventListener('input',event=>{line.description=event.target.value;markDirty();refreshDraftTotals();});row.querySelector('[data-line-uom]')?.addEventListener('input',event=>{line.uom=event.target.value;markDirty();refreshDraftTotals();});row.querySelector('[data-line-qty]')?.addEventListener('input',event=>{line.qty=event.target.value;markDirty();refreshDraftTotals();});row.querySelector('[data-line-price]')?.addEventListener('input',event=>{line.estimatedUnitPrice=event.target.value;markDirty();refreshDraftTotals();});row.querySelector('[data-line-remove]')?.addEventListener('click',()=>{state.lines.splice(index,1);markDirty();root.querySelector('[data-enquiry-tab-panel]').innerHTML=itemsHtml();bindItems();refreshDraftTotals();});});
      root.querySelector('[data-enquiry-tab-panel]')?.querySelectorAll('[data-save-enquiry-items]').forEach(button=>button.addEventListener('click',saveDraft));
    }
    function bindDocument(){
      const options=(data.customers||[]).map(row=>({value:String(row.id),label:String(row.name||row.code||`#${row.id}`),sub:String(row.code||'')}));
      wireCombobox('enquiryHeaderCustomer',{options,onChange:value=>{
        state.header.customerId=Number(value);
        markDirty();
        refreshDraftTotals();
      }});
      root.querySelectorAll('[data-header-field]').forEach(field=>{
        const update=()=>{
          if(field.dataset.headerField==='currency'){
            field.value=field.value.replace(/[^a-z]/gi,'').slice(0,3).toUpperCase();
          }
          state.header[field.dataset.headerField]=field.value;
          markDirty();
          refreshDraftTotals();
        };
        field.addEventListener(field.tagName==='SELECT'?'change':'input',update);
      });
      root.querySelectorAll('[data-save-enquiry-header]').forEach(button=>button.addEventListener('click',saveDraft));
    }
    function renderTab(){
      root.querySelectorAll('[data-enquiry-tab]').forEach(button=>{const on=button.dataset.enquiryTab===activeTab;button.classList.toggle('on',on);button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;});
      const panel=root.querySelector('[data-enquiry-tab-panel]');panel.id=`enquiry-panel-${activeTab}`;panel.setAttribute('aria-labelledby',`enquiry-tab-${activeTab}`);panel.innerHTML=activeHtml();
      bindItems();
      bindDocument();
      const bar=root.querySelector('.responsive-actionbar');bar.querySelector('[data-save-enquiry-items],[data-save-enquiry-header]')?.remove();if(activeTab==='items'&&enquiry.status==='new')bar.insertAdjacentHTML('beforeend',btn(s('saveItems'),{icon:'check',cls:'primary',attrs:`data-save-enquiry-items ${state.dirty?'':'disabled'}`}));if(activeTab==='document'&&enquiry.status==='new')bar.insertAdjacentHTML('beforeend',btn(s('saveChanges'),{icon:'check',cls:'primary',attrs:`data-save-enquiry-header ${state.dirty?'':'disabled'}`}));
      bar.querySelector('[data-save-enquiry-items],[data-save-enquiry-header]')?.addEventListener('click',saveDraft);
      root.querySelector('[data-open-related-quote]')?.addEventListener('click',openQuotation);
      refreshDraftTotals();
    }
    root.querySelectorAll('[data-enquiry-tab]').forEach((button,index)=>{button.addEventListener('click',()=>{activeTab=button.dataset.enquiryTab;renderTab();});button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activeTab=tabs[next][0];renderTab();root.querySelector(`[data-enquiry-tab="${activeTab}"]`)?.focus();});});
    renderTab();
  };
})();
