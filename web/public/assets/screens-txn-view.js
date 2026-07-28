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
  function copy(){

    const packs={
      en:{sales:'Sales',enquiries:'Enquiries',title:'Enquiry',request:'Customer request',customer:'Customer',date:'Enquiry date',channel:'Channel',owner:'Owner',estimated:'Estimated value',currency:'Currency',status:'Status',newStatus:'New',quoted:'Quoted',lost:'Lost',trace:'Canonical trace',captured:'Enquiry captured',linked:'Linked quotation',related:'Related quotation',noQuote:'No quotation has been created from this enquiry.',back:'Back to enquiries',convert:'Convert to quotation',viewQuote:'View quotation',empty:'No canonical enquiry is available.',emptyHelp:'Create an enquiry from the register to begin the sales process.',source:'Canonical source',sourceHelp:'This workspace re-reads the selected enquiry and its linked quotation from the active company. No sample activity is substituted.',limit:'One enquiry can create at most one linked quotation.',created:'Created',updated:'Last updated'},
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
  "updated": "Kemas kini terakhir"
},
      zh:{sales:'销售',enquiries:'询价',title:'询价',request:'客户需求',customer:'客户',date:'询价日期',channel:'渠道',owner:'负责人',estimated:'预计金额',currency:'币种',status:'状态',newStatus:'新建',quoted:'已报价',lost:'已丢失',trace:'标准追踪',captured:'询价已记录',linked:'已关联报价单',related:'关联报价单',noQuote:'此询价尚未生成报价单。',back:'返回询价列表',convert:'转为报价单',viewQuote:'查看报价单',empty:'没有可用的标准询价。',emptyHelp:'请从询价列表创建记录以开始销售流程。',source:'标准数据来源',sourceHelp:'此工作区会从当前公司重新读取所选询价及其关联报价单，不会替换成示例活动。',limit:'每个询价最多生成一张关联报价单。',created:'创建时间',updated:'最后更新'},
      ja:{sales:'販売',enquiries:'引合',title:'引合',request:'顧客依頼',customer:'顧客',date:'引合日',channel:'チャネル',owner:'担当者',estimated:'見込金額',currency:'通貨',status:'ステータス',newStatus:'新規',quoted:'見積済',lost:'失注',trace:'標準トレース',captured:'引合を記録',linked:'見積書を関連付け',related:'関連見積書',noQuote:'この引合から見積書はまだ作成されていません。',back:'引合一覧へ戻る',convert:'見積書へ変換',viewQuote:'見積書を表示',empty:'利用可能な標準引合はありません。',emptyHelp:'販売プロセスを開始するには一覧から引合を作成してください。',source:'標準データソース',sourceHelp:'このワークスペースはアクティブ会社から選択した引合と関連見積書を再読込します。サンプル活動への置換はありません。',limit:'1件の引合から作成できる関連見積書は1件です。',created:'作成日時',updated:'最終更新'},
      vi:{sales:'Bán hàng',enquiries:'Yêu cầu báo giá',title:'Yêu cầu báo giá',request:'Yêu cầu khách hàng',customer:'Khách hàng',date:'Ngày yêu cầu',channel:'Kênh',owner:'Người phụ trách',estimated:'Giá trị ước tính',currency:'Tiền tệ',status:'Trạng thái',newStatus:'Mới',quoted:'Đã báo giá',lost:'Đã mất',trace:'Dấu vết chuẩn',captured:'Đã ghi nhận yêu cầu',linked:'Đã liên kết báo giá',related:'Báo giá liên quan',noQuote:'Chưa có báo giá được tạo từ yêu cầu này.',back:'Quay lại danh sách',convert:'Chuyển thành báo giá',viewQuote:'Xem báo giá',empty:'Không có yêu cầu chuẩn khả dụng.',emptyHelp:'Tạo yêu cầu từ danh sách để bắt đầu quy trình bán hàng.',source:'Nguồn chuẩn',sourceHelp:'Không gian này đọc lại yêu cầu đã chọn và báo giá liên kết từ công ty hiện tại. Không thay thế bằng hoạt động mẫu.',limit:'Mỗi yêu cầu chỉ có thể tạo một báo giá liên kết.',created:'Đã tạo',updated:'Cập nhật lần cuối'},
    };
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
    const enquiry=Number.isSafeInteger(Number(id))&&Number(id)>0
      ?(await a.get('sales/enquiries',Number(id))).data||null
      :(await a.list('sales/enquiries',{limit:1})).data?.[0]||null;
    if(!enquiry) return {enquiry:null,customer:null,quotations:[],products:[]};
    const [customerPage,quotationPage,productPage]=await Promise.all([
      a.get('sales/customers',Number(enquiry.customerId)),
      a.list('sales/quotations',{limit:100,enquiryId:Number(enquiry.id)}),
      a.list('inventory/products',{limit:100}),
    ]);
    return {
      enquiry,
      customer:customerPage.data||null,
      quotations:quotationPage.data||[],
      products:productPage.data||[],
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
    const quotation=data.quotations[0]||null;
    const timeline=[
      `<div class="tl ${quotation?'':'current'}"><span class="tldot"></span><div class="tlbody"><div class="when">${esc(dateTimeValue(enquiry.createdAt||enquiry.enquiryDate))}</div><div class="what">${esc(s('captured'))}</div><div class="det">${esc(enquiry.ownerName)} · ${esc(enquiry.channel)}</div></div></div>`,
      quotation?`<div class="tl current"><span class="tldot"></span><div class="tlbody"><div class="when">${esc(dateTimeValue(quotation.createdAt||quotation.quoteDate))}</div><div class="what">${esc(s('linked'))} · ${esc(quotation.docNo)}</div><div class="det">${esc(statusLabel(s,quotation.status))}</div></div></div>`:'',
    ].join('');
    const related=quotation
      ?`<button class="related" data-open-related-quote><span><b>${esc(quotation.docNo)}</b><small>${esc(dateValue(quotation.quoteDate))} · ${esc(amount(quotation.totalAmount,quotation.currency))}</small></span>${cap(statusLabel(s,quotation.status),statusTone(quotation.status))}</button>`
      :`<p class="h1sub">${esc(s('noQuote'))}</p>`;
    const primary=quotation
      ?btn(s('viewQuote'),{icon:'receipt',cls:'primary',attrs:'data-view-related-quote'})
      :enquiry.status==='new'&&typeof window.openCanonicalEnquiryConversion==='function'
        ?btn(s('convert'),{icon:'receipt',cls:'primary',attrs:'data-convert-enquiry'})
        :'';
    root.innerHTML=`<div class="content full"><section class="master" data-sales-transaction="canonical" data-record-id="${Number(enquiry.id)}" data-related-count="${data.quotations.length}"><div class="scrollarea">
      <div class="pagehead">${crumbs([DB.company.name,{label:s('sales'),route:'sales-home'},{label:s('enquiries'),route:'enquiries'},{cur:enquiry.docNo}])}${typeof salesNav==='function'?salesNav('enquiries'):''}</div>
      <div class="docwrap"><div class="docpage"><div class="dochead"><div class="dh-row1"><div><h1 class="dt">${ic('comment')}${esc(s('title'))} <span class="dnum">${esc(enquiry.docNo)}</span></h1><div class="h1sub">${esc(enquiry.subject)}</div></div><div class="dactions">${cap(statusLabel(s,enquiry.status),statusTone(enquiry.status))}</div></div>
        <div class="docmeta"><div class="dm"><small>${esc(s('customer'))}</small><div class="partner">${profileAvatar({name:customer.name||'#'+enquiry.customerId,src:customer.imageUrl||customer.photoUrl||customer.avatarUrl,cls:'pav',size:26})}<b>${esc(customer.name||'#'+enquiry.customerId)}</b></div></div><div class="dm"><small>${esc(s('date'))}</small><b>${esc(dateValue(enquiry.enquiryDate))}</b></div><div class="dm"><small>${esc(s('channel'))}</small><b>${esc(enquiry.channel)}</b></div><div class="dm"><small>${esc(s('owner'))}</small><b>${esc(enquiry.ownerName)}</b></div><div class="dm"><small>${esc(s('status'))}</small><b>${esc(statusLabel(s,enquiry.status))}</b></div></div></div>
        <div class="doclayout"><div class="docmain"><div class="panel"><div class="panel-h">${ic('comment')}<h3>${esc(s('request'))}</h3></div><div class="panel-body"><p style="margin:0;line-height:1.6">${esc(enquiry.subject)}</p></div></div><div class="panel"><div class="panel-h">${ic('history')}<h3>${esc(s('trace'))}</h3></div><div class="panel-body"><div class="timeline">${timeline}</div></div></div><div class="alert info">${ic('lock')}<span><b>${esc(s('source'))}:</b> ${esc(s('sourceHelp'))}</span></div></div>
          <aside class="summary"><div class="sumcard"><div class="sumrow"><span class="sk2">${esc(s('estimated'))}</span><span class="sv tnum">${esc(amount(enquiry.estimatedValue,enquiry.currency))}</span></div><div class="sumrow"><span class="sk2">${esc(s('currency'))}</span><span class="sv">${esc(enquiry.currency)}</span></div><div class="sumrow"><span class="sk2">${esc(s('updated'))}</span><span class="sv">${esc(dateValue(enquiry.updatedAt||enquiry.enquiryDate))}</span></div></div><div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('related'))}</div>${related}<p class="h1sub" style="margin-top:10px">${esc(s('limit'))}</p></div></aside></div>
      </div></div><div class="responsive-actionbar">${btn(s('back'),{icon:'chevL',cls:'soft',attrs:'data-back-enquiries'})}<div class="grow"></div>${primary}</div>
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
      window.openCanonicalEnquiryConversion(enquiry,{products:data.products});
    });
  };
})();
