/* ============================================================
   ARIA ERP — canonical Reporting / BI
   Bounded, rebuildable facts from ErpSystemData bi/analytics.
   No KPI store, sample fallback, fake export or toast-only report run.
   ============================================================ */
(function(){
  const COPY={
    en:{
      bi:'Reporting / BI', dashboard:'Management dashboard', dashboardSub:'A bounded management view rebuilt from canonical commercial, purchasing, inventory and ledger facts.',
      sales:'Sales analysis', salesSub:'Product-category invoice revenue less traceable product credit lines.', stock:'Stock activity aging', stockSub:'Current valued stock grouped by days since its latest recorded inbound movement.',
      recognized:'Recognized revenue', receivables:'Open receivables', inventory:'Inventory value', cash:'Cash / bank balance', openSales:'Open sales orders', openPurchases:'Open purchase orders',
      monthly:'Monthly recognized revenue', customers:'Top customers', category:'Sales by product category', aging:'Stock aging positions', open:'Open report',
      invoiced:'Invoiced revenue', credits:'Product credits', productRevenue:'Product-attributed revenue', units:'Net units', invoices:'Invoices', share:'Share',
      item:'Item', warehouse:'Warehouse', lastInbound:'Latest inbound', age:'Age', bucket:'Bucket', qty:'On hand', value:'Value at cost',
      current:'0–30 days', medium:'31–60 days', older:'61–90 days', slow:'Over 90 days', noHistory:'No inbound trace', days:'days',
      source:'Canonical source', sourceBody:'Totals refresh from current canonical facts. No independent dashboard number is stored.',
      categoryNote:'Category revenue deducts product-linked credit-note lines. Header-only debit notes remain in company recognized revenue but are not falsely allocated to a category.',
      agingNote:'Age means days since the latest inbound movement for each current product/warehouse balance. It is not FIFO layer age because inventory cost layers are not stored.',
      bounded:'The interactive report shows at most 100 highest-value stock positions. Company inventory value includes all positions.', displayed:'Displayed value', positions:'Stock positions', slowValue:'Over-90-day value',
      empty:'No matching canonical reporting facts yet.', loading:'Loading canonical reporting facts…', error:'Reporting facts could not be loaded.', retry:'Retry', updated:'As of',
    },
    ms:{
      bi:'Pelaporan / BI', dashboard:'Papan pemuka pengurusan', dashboardSub:'Paparan pengurusan terhad yang dibina semula daripada fakta komersial, pembelian, inventori dan lejar kanonik.',
      sales:'Analisis jualan', salesSub:'Hasil invois mengikut kategori produk selepas kredit produk yang boleh dijejak.', stock:'Penuaan aktiviti stok', stockSub:'Stok bernilai semasa mengikut hari sejak pergerakan masuk terkini direkodkan.',
      recognized:'Hasil diiktiraf', receivables:'Belum terima terbuka', inventory:'Nilai inventori', cash:'Baki tunai / bank', openSales:'Pesanan jualan terbuka', openPurchases:'Pesanan belian terbuka',
      monthly:'Hasil bulanan diiktiraf', customers:'Pelanggan utama', category:'Jualan mengikut kategori produk', aging:'Kedudukan penuaan stok', open:'Buka laporan',
      invoiced:'Hasil diinvois', credits:'Kredit produk', productRevenue:'Hasil berpunca produk', units:'Unit bersih', invoices:'Invois', share:'Bahagian',
      item:'Item', warehouse:'Gudang', lastInbound:'Masuk terkini', age:'Umur', bucket:'Kumpulan', qty:'Stok semasa', value:'Nilai kos',
      current:'0–30 hari', medium:'31–60 hari', older:'61–90 hari', slow:'Lebih 90 hari', noHistory:'Tiada jejak masuk', days:'hari',
      source:'Sumber kanonik', sourceBody:'Jumlah disegar daripada fakta kanonik semasa. Tiada nombor papan pemuka bebas disimpan.',
      categoryNote:'Hasil kategori menolak baris nota kredit berpaut produk. Nota debit peringkat kepala kekal dalam hasil syarikat tetapi tidak diagih secara palsu.',
      agingNote:'Umur ialah hari sejak pergerakan masuk terakhir bagi baki produk/gudang semasa. Ia bukan umur lapisan FIFO kerana lapisan kos tidak disimpan.',
      bounded:'Laporan interaktif menunjukkan paling banyak 100 kedudukan stok bernilai tertinggi. Nilai inventori syarikat merangkumi semua kedudukan.', displayed:'Nilai dipaparkan', positions:'Kedudukan stok', slowValue:'Nilai lebih 90 hari',
      empty:'Belum ada fakta pelaporan kanonik yang sepadan.', loading:'Memuatkan fakta pelaporan kanonik…', error:'Fakta pelaporan tidak dapat dimuatkan.', retry:'Cuba lagi', updated:'Setakat',
    },
    zh:{
      bi:'报表 / BI', dashboard:'管理驾驶舱', dashboardSub:'从真实销售、采购、库存与总账事实即时重建的有界管理视图。',
      sales:'销售分析', salesSub:'按产品类别统计发票收入，并扣除可追溯到产品的贷项明细。', stock:'库存活动账龄', stockSub:'按最近一次真实入库活动距今天数，分析当前计价库存。',
      recognized:'已确认收入', receivables:'未收应收款', inventory:'库存价值', cash:'现金 / 银行余额', openSales:'未结销售订单', openPurchases:'未结采购订单',
      monthly:'每月已确认收入', customers:'主要客户', category:'按产品类别销售', aging:'库存账龄明细', open:'打开报表',
      invoiced:'发票收入', credits:'产品贷项', productRevenue:'产品归属收入', units:'净数量', invoices:'发票', share:'占比',
      item:'物料', warehouse:'仓库', lastInbound:'最近入库', age:'账龄', bucket:'区间', qty:'现有量', value:'成本价值',
      current:'0–30 天', medium:'31–60 天', older:'61–90 天', slow:'超过 90 天', noHistory:'无入库轨迹', days:'天',
      source:'Canonical 数据源', sourceBody:'所有数值都从当前真实业务事实重新计算，不保存独立 KPI 数字。',
      categoryNote:'类别收入会扣除可追溯至产品的贷项明细。仅有单头的借项仍计入公司已确认收入，但不会被虚假分摊至产品类别。',
      agingNote:'账龄指当前产品/仓库余额距离最近一次入库移动的天数。由于系统尚未储存 FIFO 成本层，因此不会冒充 FIFO 层账龄。',
      bounded:'交互报表最多显示价值最高的 100 个库存位置；公司库存总值仍涵盖全部位置。', displayed:'已显示价值', positions:'库存位置', slowValue:'超过 90 天价值',
      empty:'目前没有符合条件的真实报表数据。', loading:'正在读取真实报表数据…', error:'无法加载报表数据。', retry:'重试', updated:'截至',
    },
    ja:{
      bi:'レポート / BI', dashboard:'経営ダッシュボード', dashboardSub:'販売、購買、在庫、元帳の標準事実から再構築する上限付き管理ビューです。',
      sales:'販売分析', salesSub:'商品カテゴリ別の請求売上から追跡可能な商品クレジットを控除します。', stock:'在庫活動エージング', stockSub:'最新の入庫移動からの経過日数で現在の評価在庫を分類します。',
      recognized:'認識済み売上', receivables:'未収金', inventory:'在庫価値', cash:'現金 / 銀行残高', openSales:'未完了受注', openPurchases:'未完了発注',
      monthly:'月次認識済み売上', customers:'上位顧客', category:'商品カテゴリ別売上', aging:'在庫エージング明細', open:'レポートを開く',
      invoiced:'請求売上', credits:'商品クレジット', productRevenue:'商品帰属売上', units:'正味数量', invoices:'請求書', share:'構成比',
      item:'品目', warehouse:'倉庫', lastInbound:'最新入庫', age:'経過', bucket:'区分', qty:'現在庫', value:'原価価値',
      current:'0～30日', medium:'31～60日', older:'61～90日', slow:'90日超', noHistory:'入庫履歴なし', days:'日',
      source:'標準ソース', sourceBody:'数値は現在の標準事実から再計算され、独立したKPI値は保存しません。',
      categoryNote:'カテゴリ売上は商品に紐づくクレジット明細を控除します。ヘッダーのみのデビットは会社売上に残りますが、カテゴリへ仮配賦しません。',
      agingNote:'経過日数は現在の商品・倉庫残高に対する最新入庫から計算します。原価レイヤーを保存していないためFIFOレイヤー年齢ではありません。',
      bounded:'対話型レポートは価値上位100在庫位置まで表示します。会社在庫価値は全位置を含みます。', displayed:'表示価値', positions:'在庫位置', slowValue:'90日超価値',
      empty:'該当する標準レポート事実はまだありません。', loading:'標準レポート事実を読み込み中…', error:'レポート事実を読み込めません。', retry:'再試行', updated:'基準日',
    },
    vi:{
      bi:'Báo cáo / BI', dashboard:'Bảng điều hành quản trị', dashboardSub:'Góc nhìn quản trị có giới hạn được dựng lại từ dữ kiện bán hàng, mua hàng, tồn kho và sổ cái chuẩn.',
      sales:'Phân tích bán hàng', salesSub:'Doanh thu hóa đơn theo nhóm sản phẩm trừ các dòng tín dụng truy vết được.', stock:'Tuổi hoạt động tồn kho', stockSub:'Tồn kho hiện tại theo số ngày kể từ biến động nhập gần nhất.',
      recognized:'Doanh thu ghi nhận', receivables:'Phải thu còn mở', inventory:'Giá trị tồn kho', cash:'Số dư tiền / ngân hàng', openSales:'Đơn bán đang mở', openPurchases:'Đơn mua đang mở',
      monthly:'Doanh thu ghi nhận theo tháng', customers:'Khách hàng hàng đầu', category:'Bán hàng theo nhóm sản phẩm', aging:'Chi tiết tuổi tồn kho', open:'Mở báo cáo',
      invoiced:'Doanh thu hóa đơn', credits:'Tín dụng sản phẩm', productRevenue:'Doanh thu gắn sản phẩm', units:'Số lượng ròng', invoices:'Hóa đơn', share:'Tỷ trọng',
      item:'Mặt hàng', warehouse:'Kho', lastInbound:'Nhập gần nhất', age:'Tuổi', bucket:'Nhóm', qty:'Tồn hiện tại', value:'Giá trị vốn',
      current:'0–30 ngày', medium:'31–60 ngày', older:'61–90 ngày', slow:'Trên 90 ngày', noHistory:'Không có dấu nhập', days:'ngày',
      source:'Nguồn chuẩn', sourceBody:'Các tổng số được tính lại từ dữ kiện chuẩn hiện tại; không lưu KPI độc lập.',
      categoryNote:'Doanh thu nhóm trừ các dòng tín dụng gắn sản phẩm. Phiếu ghi nợ chỉ có đầu chứng từ vẫn thuộc doanh thu công ty nhưng không bị phân bổ giả.',
      agingNote:'Tuổi là số ngày từ lần nhập gần nhất của số dư sản phẩm/kho hiện tại. Đây không phải tuổi lớp FIFO vì hệ thống chưa lưu lớp chi phí.',
      bounded:'Báo cáo tương tác hiển thị tối đa 100 vị trí tồn kho có giá trị cao nhất. Tổng giá trị công ty bao gồm mọi vị trí.', displayed:'Giá trị hiển thị', positions:'Vị trí tồn kho', slowValue:'Giá trị trên 90 ngày',
      empty:'Chưa có dữ kiện báo cáo chuẩn phù hợp.', loading:'Đang tải dữ kiện báo cáo chuẩn…', error:'Không thể tải dữ kiện báo cáo.', retry:'Thử lại', updated:'Tính đến',
    },
  };
  const LOCALE={en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'};
  const state={rows:[],sequence:0};
  function c(){return COPY[getLang()]||COPY.en;}
  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function amount(value){return new Intl.NumberFormat(LOCALE[getLang()]||'en-SG',{style:'currency',currency:(DB.company&&DB.company.currency)||'SGD',maximumFractionDigits:2}).format(number(value));}
  function quantity(value){return new Intl.NumberFormat(LOCALE[getLang()]||'en-SG',{maximumFractionDigits:4}).format(number(value));}
  function integer(value){return new Intl.NumberFormat(LOCALE[getLang()]||'en-SG',{maximumFractionDigits:0}).format(number(value));}
  function date(value){if(!value)return '—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':new Intl.DateTimeFormat(LOCALE[getLang()]||'en-SG',{dateStyle:'medium'}).format(parsed);}
  function rows(kind){return state.rows.filter(row=>row.kind===kind);}
  function summary(){return rows('summary')[0]||{};}
  function empty(){return statePanel({icon:'chart',title:c().empty});}
  function kpis(items){return `<div class="so-kpibar">${items.map(item=>`<div class="so-kpi"><small>${esc(item[0])}</small><b class="tnum">${esc(item[1])}</b></div>`).join('')}</div>`;}
  function bars(data,label,value,format=amount){
    if(!data.length)return empty();
    const maximum=Math.max(1,...data.map(row=>Math.abs(value(row))));
    return `<div class="repbars">${data.map(row=>`<div class="repbar"><div class="rb-top"><span>${esc(label(row))}</span><b class="tnum">${esc(format(value(row)))}</b></div><div class="rb-track"><i style="width:${Math.max(2,Math.round(Math.abs(value(row))/maximum*100))}%"></i></div></div>`).join('')}</div>`;
  }
  function panel(title,body,route){return `<div class="wcard"><div class="sb-h"><h3>${esc(title)}</h3>${route?`<button class="sb-link" onclick="navigate('${route}')">${esc(c().open)}</button>`:''}</div>${body}</div>`;}
  function loading(root,route,title,sub){root.innerHTML=modulePage({module:'bi',route,active:route,title,sub,body:`<div data-bi-loading="true">${skeletonRows(7)}</div>`});}
  function error(root,route,title,sub,problem){root.innerHTML=modulePage({module:'bi',route,active:route,title,sub,body:statePanel({icon:'warn',title:c().error,body:(problem&&problem.message)||c().error,action:btn(c().retry,{icon:'refresh',cls:'primary',attrs:`onclick="SCREENS['${route}'](document.getElementById('viewRoot'))"`})})});}
  async function load(){
    const sequence=++state.sequence,all=[];let cursor;
    for(let page=0;page<5;page+=1){
      const result=await window.ErpSystemData.list('bi/analytics',{limit:100,...(cursor==null?{}:{cursor})});
      all.push(...(result.data||[]));cursor=result.meta&&result.meta.nextCursor;if(cursor==null)break;
    }
    if(sequence===state.sequence)state.rows=all;
    return all;
  }
  function sourceNote(text){return `<div class="panel"><div class="panel-body"><b>${esc(c().source)}</b><p class="h1sub">${esc(text)}</p></div></div>`;}
  function bucketLabel(value){return ({'0-30':c().current,'31-60':c().medium,'61-90':c().older,'90+':c().slow,'no-history':c().noHistory})[value]||value;}
  function bucketTone(value){return value==='90+'?'danger':value==='61-90'?'warn':value==='no-history'?'neutral':'ok';}

  async function dashboard(root){
    loading(root,'bi-dashboard',c().dashboard,c().dashboardSub);
    try{await load();}catch(problem){error(root,'bi-dashboard',c().dashboard,c().dashboardSub,problem);return;}
    const s=summary(),months=rows('monthly-revenue'),customers=rows('customer-revenue').slice(0,6),categories=rows('sales-category').slice(0,6),stocks=rows('stock-aging');
    root.innerHTML=modulePage({module:'bi',route:'bi-dashboard',active:'bi-dashboard',title:c().dashboard,sub:c().dashboardSub,body:`<div class="sales-body" data-bi-dashboard="canonical">
      ${kpis([[c().recognized,amount(s.recognizedRevenue)],[c().receivables,amount(s.openReceivables)],[c().inventory,amount(s.inventoryValue)],[c().cash,amount(s.cashBalance)],[c().openSales,amount(s.openSalesOrderValue)],[c().openPurchases,amount(s.openPurchaseOrderValue)]])}
      <div class="sb-grid"><div class="wcard sb-span2"><div class="sb-h"><h3>${esc(c().monthly)}</h3><small>${esc(c().sourceBody)}</small></div>${bars(months,row=>row.period,row=>number(row.recognizedRevenue))}</div>
      ${panel(c().customers,bars(customers,row=>row.customerName,row=>number(row.recognizedRevenue)),'sales-analysis')}
      ${panel(c().category,bars(categories,row=>row.category,row=>number(row.productRevenue)),'sales-analysis')}
      ${panel(c().aging,bars(stocks.slice(0,6),row=>`${row.sku} · ${bucketLabel(row.bucket)}`,row=>number(row.inventoryValue)),'stock-aging')}</div>
      ${sourceNote(c().sourceBody)}
    </div>`});
  }

  async function salesAnalysis(root){
    loading(root,'sales-analysis',c().sales,c().salesSub);
    try{await load();}catch(problem){error(root,'sales-analysis',c().sales,c().salesSub,problem);return;}
    const s=summary(),data=rows('sales-category').sort((a,b)=>number(b.productRevenue)-number(a.productRevenue));
    const total=data.reduce((sum,row)=>sum+number(row.productRevenue),0),units=data.reduce((sum,row)=>sum+number(row.netUnits),0);
    const body=data.map((row,index)=>`<tr><td class="lineno">${index+1}</td><td class="l"><b>${esc(row.category)}</b></td><td class="tnum">${integer(row.invoiceCount)}</td><td class="tnum">${quantity(row.invoicedUnits)}</td><td class="tnum">${amount(row.invoicedRevenue)}</td><td class="tnum">${amount(row.creditedRevenue)}</td><td class="tnum"><b>${amount(row.productRevenue)}</b></td><td class="tnum">${total?Math.round(number(row.productRevenue)/total*100):0}%</td></tr>`).join('');
    root.innerHTML=modulePage({module:'bi',route:'sales-analysis',active:'sales-analysis',title:c().sales,sub:c().salesSub,body:`<div class="sales-body" data-bi-sales-analysis="canonical">
      ${kpis([[c().productRevenue,amount(total)],[c().units,quantity(units)],[c().category,integer(data.length)],[c().recognized,amount(s.recognizedRevenue)]])}
      <div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>${esc(c().category)}</h3></div><div class="panel-body">${bars(data,row=>row.category,row=>number(row.productRevenue))}</div></div>
      <div class="panel">${data.length?`<div class="tablewrap"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(c().category)}</th><th>${esc(c().invoices)}</th><th>${esc(c().units)}</th><th>${esc(c().invoiced)}</th><th>${esc(c().credits)}</th><th>${esc(c().productRevenue)}</th><th>${esc(c().share)}</th></tr></thead><tbody>${body}</tbody></table></div>`:empty()}</div>
      <div style="margin-top:16px">${sourceNote(c().categoryNote)}</div>
    </div>`});
  }

  async function stockAging(root){
    loading(root,'stock-aging',c().stock,c().stockSub);
    try{await load();}catch(problem){error(root,'stock-aging',c().stock,c().stockSub,problem);return;}
    const s=summary(),data=rows('stock-aging'),displayed=data.reduce((sum,row)=>sum+number(row.inventoryValue),0),slow=data.filter(row=>row.bucket==='90+').reduce((sum,row)=>sum+number(row.inventoryValue),0);
    const body=data.map((row,index)=>`<tr><td class="lineno">${index+1}</td><td class="l"><div class="cellsub"><b>${esc(row.productName)}</b><small>${esc(row.sku)} · ${esc(row.category)}</small></div></td><td class="l"><b>${esc(row.warehouseCode)}</b><small>${esc(row.warehouseName)}</small></td><td class="l">${esc(date(row.lastInboundAt))}</td><td class="tnum">${row.ageDays==null?'—':`${integer(row.ageDays)} ${esc(c().days)}`}</td><td>${cap(bucketLabel(row.bucket),bucketTone(row.bucket))}</td><td class="tnum">${quantity(row.qty)}</td><td class="tnum"><b>${amount(row.inventoryValue)}</b></td></tr>`).join('');
    root.innerHTML=modulePage({module:'bi',route:'stock-aging',active:'stock-aging',title:c().stock,sub:c().stockSub,action:btn(c().inventory,{icon:'chart',cls:'soft',attrs:'onclick="navigate(\'inv-valuation\')"'}),body:`<div class="sales-body" data-bi-stock-aging="canonical">
      ${kpis([[c().inventory,amount(s.inventoryValue)],[c().positions,integer(s.inventoryPositionCount)],[c().displayed,amount(displayed)],[c().slowValue,amount(slow)]])}
      <div class="panel">${data.length?`<div class="tablewrap"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(c().item)}</th><th class="l">${esc(c().warehouse)}</th><th class="l">${esc(c().lastInbound)}</th><th>${esc(c().age)}</th><th>${esc(c().bucket)}</th><th>${esc(c().qty)}</th><th>${esc(c().value)}</th></tr></thead><tbody>${body}</tbody></table></div>`:empty()}</div>
      <div style="margin-top:16px">${sourceNote(`${c().agingNote} ${c().bounded}`)}</div>
    </div>`});
  }

  SCREENS['bi-dashboard']=dashboard;
  SCREENS['sales-analysis']=salesAnalysis;
  SCREENS['stock-aging']=stockAging;
})();
