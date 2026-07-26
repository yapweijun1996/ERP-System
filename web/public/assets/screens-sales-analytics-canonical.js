/* ============================================================
   ARIA ERP — canonical Sales analytics
   Replaces the sample dashboard/reports with bounded facts from
   ErpSystemData sales/analytics in both Demo and API modes.
   ============================================================ */
(function(){
  const COPY={
    en:{sales:'Sales',dashboard:'Sales overview',dashSub:'Live commercial facts rebuilt from sales documents.',reports:'Sales reports',reportsSub:'Auditable reports based on invoices, adjustments and document status.',recognized:'Recognized revenue',receivables:'Open receivables',openOrders:'Open orders',approvals:'Pending approval',openEnquiries:'Open enquiries',returns:'Open returns',monthly:'Monthly recognized revenue',customers:'Top customers',people:'Revenue by salesperson',quotes:'Quotation status',orders:'Order status',invoices:'Invoice status',deliveries:'Delivery status',report:'Open report',customerReport:'Sales by customer',repReport:'Sales by salesperson',quoteReport:'Quotation conversion',statusReport:'Document status',customer:'Customer',salesperson:'Salesperson',revenue:'Recognized revenue',invoiced:'Invoiced',credits:'Credits',debits:'Debits',share:'Share',owner:'Owner',invoiceCount:'Invoices',customerCount:'Customers',status:'Status',count:'Count',value:'Value',period:'Period',winRate:'Win rate',converted:'Converted',decided:'Decided quotations',back:'Back to reports',empty:'No matching sales facts yet.',actualOnly:'Actual posted documents only; no target or forecast data is stored.',source:'Canonical source',sourceText:'Invoices, credit/debit notes and current document statuses.',allStatuses:'All document statuses'},
    ms:{
  "sales": "Jualan",
  "dashboard": "Gambaran jualan",
  "dashSub": "Fakta komersial langsung yang dibina semula daripada dokumen jualan.",
  "reports": "Laporan jualan",
  "reportsSub": "Laporan boleh diaudit berdasarkan invois, pelarasan dan status dokumen.",
  "recognized": "Hasil diiktiraf",
  "receivables": "Belum terima terbuka",
  "openOrders": "Pesanan terbuka",
  "approvals": "Menunggu kelulusan",
  "openEnquiries": "Pertanyaan terbuka",
  "returns": "Pulangan terbuka",
  "monthly": "Hasil bulanan diiktiraf",
  "customers": "Pelanggan utama",
  "people": "Hasil mengikut jurujual",
  "quotes": "Status sebut harga",
  "orders": "Status pesanan",
  "invoices": "Status invois",
  "deliveries": "Status penghantaran",
  "report": "Buka laporan",
  "customerReport": "Jualan mengikut pelanggan",
  "repReport": "Jualan mengikut jurujual",
  "quoteReport": "Penukaran sebut harga",
  "statusReport": "Status dokumen",
  "customer": "Pelanggan",
  "salesperson": "Jurujual",
  "revenue": "Hasil diiktiraf",
  "invoiced": "Diinvois",
  "credits": "Kredit",
  "debits": "Debit",
  "share": "Bahagian",
  "owner": "Pemilik",
  "invoiceCount": "Invois",
  "customerCount": "Pelanggan",
  "status": "Status",
  "count": "Bilangan",
  "value": "Nilai",
  "period": "Tempoh",
  "winRate": "Kadar menang",
  "converted": "Ditukar",
  "decided": "Sebut harga diputuskan",
  "back": "Kembali ke laporan",
  "empty": "Belum ada fakta jualan yang sepadan.",
  "actualOnly": "Dokumen sebenar yang dipos sahaja; tiada sasaran atau ramalan disimpan.",
  "source": "Sumber kanonik",
  "sourceText": "Invois, nota kredit/debit dan status dokumen semasa.",
  "allStatuses": "Semua status dokumen"
},
    zh:{sales:'销售',dashboard:'销售概览',dashSub:'从真实销售单据即时重建的商业数据。',reports:'销售报表',reportsSub:'基于发票、调整单及单据状态的可审计报表。',recognized:'已确认收入',receivables:'未收应收款',openOrders:'未结订单',approvals:'待审批',openEnquiries:'未结询价',returns:'待处理退货',monthly:'每月已确认收入',customers:'主要客户',people:'按销售负责人统计收入',quotes:'报价状态',orders:'订单状态',invoices:'发票状态',deliveries:'交货状态',report:'打开报表',customerReport:'按客户统计销售',repReport:'按销售负责人统计销售',quoteReport:'报价转换率',statusReport:'单据状态',customer:'客户',salesperson:'销售负责人',revenue:'已确认收入',invoiced:'发票金额',credits:'贷项',debits:'借项',share:'占比',owner:'负责人',invoiceCount:'发票',customerCount:'客户',status:'状态',count:'数量',value:'金额',period:'期间',winRate:'赢单率',converted:'已转换',decided:'已决报价',back:'返回报表',empty:'尚无符合条件的销售数据。',actualOnly:'仅统计真实已过账单据；系统未保存目标或预测数据。',source:'Canonical 数据源',sourceText:'发票、贷项/借项通知单及当前单据状态。',allStatuses:'全部单据状态'},
    ja:{sales:'販売',dashboard:'販売概要',dashSub:'販売伝票から再構築した最新の商取引データです。',reports:'販売レポート',reportsSub:'請求書、調整、伝票ステータスに基づく監査可能なレポートです。',recognized:'認識済み売上',receivables:'未収金',openOrders:'未完了受注',approvals:'承認待ち',openEnquiries:'未完了引合',returns:'未処理返品',monthly:'月次認識済み売上',customers:'上位顧客',people:'担当者別売上',quotes:'見積ステータス',orders:'受注ステータス',invoices:'請求ステータス',deliveries:'出荷ステータス',report:'レポートを開く',customerReport:'顧客別売上',repReport:'担当者別売上',quoteReport:'見積変換率',statusReport:'伝票ステータス',customer:'顧客',salesperson:'担当者',revenue:'認識済み売上',invoiced:'請求額',credits:'貸方',debits:'借方',share:'構成比',owner:'担当',invoiceCount:'請求書',customerCount:'顧客',status:'ステータス',count:'件数',value:'金額',period:'期間',winRate:'成約率',converted:'変換済み',decided:'確定見積',back:'レポートへ戻る',empty:'該当する販売データはありません。',actualOnly:'転記済み実績伝票のみ。目標・予測データは保存していません。',source:'Canonical ソース',sourceText:'請求書、貸方・借方通知書、現在の伝票ステータス。',allStatuses:'全伝票ステータス'},
    vi:{sales:'Bán hàng',dashboard:'Tổng quan bán hàng',dashSub:'Dữ liệu thương mại trực tiếp được dựng lại từ chứng từ bán hàng.',reports:'Báo cáo bán hàng',reportsSub:'Báo cáo có thể kiểm toán từ hóa đơn, điều chỉnh và trạng thái chứng từ.',recognized:'Doanh thu ghi nhận',receivables:'Phải thu còn mở',openOrders:'Đơn hàng còn mở',approvals:'Chờ phê duyệt',openEnquiries:'Yêu cầu còn mở',returns:'Trả hàng còn mở',monthly:'Doanh thu ghi nhận theo tháng',customers:'Khách hàng hàng đầu',people:'Doanh thu theo nhân viên',quotes:'Trạng thái báo giá',orders:'Trạng thái đơn hàng',invoices:'Trạng thái hóa đơn',deliveries:'Trạng thái giao hàng',report:'Mở báo cáo',customerReport:'Doanh số theo khách hàng',repReport:'Doanh số theo nhân viên',quoteReport:'Chuyển đổi báo giá',statusReport:'Trạng thái chứng từ',customer:'Khách hàng',salesperson:'Nhân viên bán hàng',revenue:'Doanh thu ghi nhận',invoiced:'Đã lập hóa đơn',credits:'Ghi có',debits:'Ghi nợ',share:'Tỷ trọng',owner:'Phụ trách',invoiceCount:'Hóa đơn',customerCount:'Khách hàng',status:'Trạng thái',count:'Số lượng',value:'Giá trị',period:'Kỳ',winRate:'Tỷ lệ thắng',converted:'Đã chuyển đổi',decided:'Báo giá đã quyết định',back:'Về báo cáo',empty:'Chưa có dữ liệu bán hàng phù hợp.',actualOnly:'Chỉ chứng từ thực tế đã ghi sổ; không lưu mục tiêu hay dự báo.',source:'Nguồn canonical',sourceText:'Hóa đơn, phiếu ghi có/ghi nợ và trạng thái chứng từ hiện tại.',allStatuses:'Tất cả trạng thái chứng từ'}
  };
  const locale={en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'};
  const state={rows:[],sequence:0};
  function c(){return i18nLegacy(COPY);}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
  function amount(v){return new Intl.NumberFormat(locale[getLang()]||'en-SG',{style:'currency',currency:(DB.company&&DB.company.currency)||'SGD',maximumFractionDigits:2}).format(num(v));}
  function integer(v){return new Intl.NumberFormat(locale[getLang()]||'en-SG',{maximumFractionDigits:0}).format(num(v));}
  function rows(kind){return (state.rows||[]).filter(row=>row.kind===kind);}
  function summary(){return rows('summary')[0]||{};}
  function statusLabel(v){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());}
  async function load(){
    const sequence=++state.sequence;
    const all=[]; let cursor;
    for(let page=0;page<4;page+=1){
      const result=await window.ErpSystemData.list('sales/analytics',{limit:100,...(cursor==null?{}:{cursor})});
      all.push(...(result.data||[]));
      cursor=result.meta&&result.meta.nextCursor;
      if(cursor==null) break;
    }
    /* A company switch or rapid navigation can finish an older request late.
       Only the newest render may replace the shared report facts. */
    if(sequence===state.sequence) state.rows=all;
    return all;
  }
  function empty(){return `<div class="statepanel empty">${ic('chart')}<h3>${esc(c().empty)}</h3></div>`;}
  function kpis(items){return `<div class="so-kpibar">${items.map(x=>`<div class="so-kpi"><small>${esc(x[0])}</small><b class="tnum">${esc(x[1])}</b></div>`).join('')}</div>`;}
  function panel(title,body,route){return `<div class="wcard"><div class="sb-h"><h3>${esc(title)}</h3>${route?`<button class="sb-link" onclick="navigate('${route}')">${esc(c().report)}</button>`:''}</div>${body}</div>`;}
  function bars(data,label,value){
    if(!data.length) return empty();
    const max=Math.max(1,...data.map(value));
    return `<div class="repbars">${data.map(row=>`<div class="repbar"><div class="rb-top"><span>${esc(label(row))}</span><b class="tnum">${esc(amount(value(row)))}</b></div><div class="rb-track"><i style="width:${Math.max(2,Math.round(value(row)/max*100))}%"></i></div></div>`).join('')}</div>`;
  }
  function statusTable(kind,title){
    const data=rows(kind);
    const body=data.map((row,i)=>`<tr><td class="lineno">${i+1}</td><td class="l">${cap(statusLabel(row.status),'neutral')}</td><td class="tnum">${integer(row.count)}</td>${kind==='delivery-status'?'':`<td class="tnum">${amount(row.value)}</td>`}</tr>`).join('');
    return `<div class="panel"><div class="panel-h"><h3>${esc(title)}</h3></div>${data.length?`<div class="tablewrap"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(c().status)}</th><th>${esc(c().count)}</th>${kind==='delivery-status'?'':`<th>${esc(c().value)}</th>`}</tr></thead><tbody>${body}</tbody></table></div>`:empty()}</div>`;
  }
  async function showDashboard(root){
    await load(); const s=summary(), months=rows('monthly-revenue'), customers=rows('customer-revenue').slice(0,6), reps=rows('salesperson-revenue').slice(0,6);
    root.innerHTML=salesPage({active:'sales-home',title:c().dashboard,crumb:[DB.company.name,{cur:c().sales}],sub:c().dashSub,body:`<div class="sales-body" data-sales-analytics="canonical">
      ${kpis([[c().recognized,amount(s.recognizedRevenue),true],[c().receivables,amount(s.openReceivables),true],[c().openOrders,integer(s.openOrderCount),true],[c().approvals,integer(s.pendingApprovalCount),true],[c().openEnquiries,integer(s.openEnquiryCount),true],[c().returns,integer(s.openReturnCount),true]])}
      <div class="sb-grid"><div class="wcard sb-span2"><div class="sb-h"><h3>${esc(c().monthly)}</h3><small>${esc(c().actualOnly)}</small></div>${bars(months,row=>row.period,row=>num(row.recognizedRevenue))}</div>
      ${panel(c().customers,bars(customers,row=>row.customerName,row=>num(row.recognizedRevenue)),'report-sales-customer')}
      ${panel(c().people,bars(reps,row=>row.salesperson,row=>num(row.recognizedRevenue)),'report-sales-rep')}</div>
      <div class="dash-sectitle"><span>${esc(c().allStatuses)}</span><span class="ln"></span></div><div class="analytics-status-grid">${statusTable('quotation-status',c().quotes)}${statusTable('order-status',c().orders)}${statusTable('invoice-status',c().invoices)}${statusTable('delivery-status',c().deliveries)}</div>
    </div>`});
  }
  const catalog=[
    ['report-sales-customer','people','customerReport','sourceText'],
    ['report-sales-rep','user','repReport','actualOnly'],
    ['report-quote-conversion','chart','quoteReport','sourceText'],
    ['report-generic','receipt','statusReport','allStatuses'],
  ];
  async function showReports(root){await load();root.innerHTML=salesPage({active:'sales-reports',title:c().reports,sub:c().reportsSub,body:`<div class="sales-body" data-sales-reports="canonical"><div class="rep-grid">${catalog.map(([route,icon,title,desc])=>`<button class="rep-card built" onclick="navigate('${route}')"><span class="rep-ic">${ic(icon)}</span><span class="rep-main"><b>${esc(c()[title])}</b><small>${esc(c()[desc])}</small></span><span class="rep-tag">Canonical</span>${ic('chevR')}</button>`).join('')}</div><div class="panel" style="margin-top:18px"><div class="panel-body"><b>${esc(c().source)}</b><p class="h1sub">${esc(c().sourceText)}</p></div></div></div>`});}
  function reportPage(root,title,marker,body){root.innerHTML=salesPage({active:'sales-reports',title,sub:c().reportsSub,action:btn(c().back,{icon:'chevL',cls:'soft',attrs:'onclick="navigate(\'sales-reports\')"'}),body:`<div class="sales-body" data-sales-report="${marker}">${body}</div>`});}
  async function customerReport(root){await load();const data=rows('customer-revenue'),total=data.reduce((sum,row)=>sum+num(row.recognizedRevenue),0);const body=data.map((row,i)=>`<tr><td class="lineno">${i+1}</td><td class="l"><b>${esc(row.customerName)}</b><small>${esc(row.customerCode||'')}</small></td><td class="l">${esc(row.ownerName||'')}</td><td class="tnum">${integer(row.invoiceCount)}</td><td class="tnum">${amount(row.invoicedNet)}</td><td class="tnum">${amount(row.creditNet)}</td><td class="tnum">${amount(row.debitNet)}</td><td class="tnum"><b>${amount(row.recognizedRevenue)}</b></td><td class="tnum">${total?Math.round(num(row.recognizedRevenue)/total*100):0}%</td></tr>`).join('');reportPage(root,c().customerReport,'customer',data.length?`<div class="panel"><div class="tablewrap"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(c().customer)}</th><th class="l">${esc(c().owner)}</th><th>${esc(c().invoiceCount)}</th><th>${esc(c().invoiced)}</th><th>${esc(c().credits)}</th><th>${esc(c().debits)}</th><th>${esc(c().revenue)}</th><th>${esc(c().share)}</th></tr></thead><tbody>${body}</tbody></table></div></div>`:empty());}
  async function repReport(root){await load();const data=rows('salesperson-revenue'),body=data.map((row,i)=>`<tr><td class="lineno">${i+1}</td><td class="l"><b>${esc(row.salesperson)}</b></td><td class="tnum">${integer(row.customerCount)}</td><td class="tnum">${integer(row.invoiceCount)}</td><td class="tnum"><b>${amount(row.recognizedRevenue)}</b></td></tr>`).join('');reportPage(root,c().repReport,'salesperson',`${kpis([[c().recognized,amount(data.reduce((sum,row)=>sum+num(row.recognizedRevenue),0)),true]])}<div class="panel"><div class="panel-h"><small>${esc(c().actualOnly)}</small></div>${data.length?`<div class="tablewrap"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(c().salesperson)}</th><th>${esc(c().customerCount)}</th><th>${esc(c().invoiceCount)}</th><th>${esc(c().revenue)}</th></tr></thead><tbody>${body}</tbody></table></div>`:empty()}</div>`);}
  async function quoteReport(root){await load();const data=rows('quotation-status'),converted=data.filter(row=>row.status==='converted').reduce((n,row)=>n+num(row.count),0),decided=data.filter(row=>['converted','rejected','expired'].includes(row.status)).reduce((n,row)=>n+num(row.count),0),win=decided?Math.round(converted/decided*100):0;reportPage(root,c().quoteReport,'quotation',`${kpis([[c().winRate,`${win}%`,true],[c().converted,integer(converted),true],[c().decided,integer(decided),true]])}${statusTable('quotation-status',c().quotes)}`);}
  async function genericReport(root){await load();reportPage(root,c().statusReport,'document-status',`<div class="analytics-status-grid">${statusTable('order-status',c().orders)}${statusTable('invoice-status',c().invoices)}${statusTable('delivery-status',c().deliveries)}</div>`);}
  SCREENS['sales-home']=showDashboard;
  SCREENS['sales-reports']=showReports;
  SCREENS['report-sales-customer']=customerReport;
  SCREENS['report-sales-rep']=repReport;
  SCREENS['report-quote-conversion']=quoteReport;
  SCREENS['report-generic']=genericReport;
})();
