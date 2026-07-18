/* ============================================================
   ARIA ERP — canonical sales delivery proof
   Fulfilment created atomically by Sales order confirmation.
   ============================================================ */
(function canonicalSalesDeliveryScreens(){
  function copy(){
    const lang=typeof getLang==='function'?getLang():'en';
    const packs={
      en:{deliveries:'Delivery orders',delivery:'Delivery order',customer:'Customer',order:'Sales order',
        invoice:'Invoice',date:'Delivery date',status:'Status',items:'Delivered items',product:'Product',
        warehouse:'Warehouse',quantity:'Delivered quantity',all:'All',draft:'Draft',delivered:'Delivered',
        cancelled:'Cancelled',empty:'No canonical deliveries yet.',help:'Confirm a draft sales order to create its delivery, inventory issue and invoice in one transaction.',
        trace:'Fulfilment trace',viewOrder:'View sales order',viewInvoice:'View invoice',limit:'Showing the first 100 canonical delivery records.'},
      ms:{deliveries:'Pesanan penghantaran',delivery:'Pesanan penghantaran',customer:'Pelanggan',order:'Pesanan jualan',
        invoice:'Invois',date:'Tarikh penghantaran',status:'Status',items:'Item dihantar',product:'Produk',
        warehouse:'Gudang',quantity:'Kuantiti dihantar',all:'Semua',draft:'Draf',delivered:'Dihantar',
        cancelled:'Dibatalkan',empty:'Belum ada penghantaran kanonik.',help:'Sahkan draf pesanan jualan untuk mencipta penghantaran, pengeluaran stok dan invois dalam satu transaksi.',
        trace:'Jejak pemenuhan',viewOrder:'Lihat pesanan jualan',viewInvoice:'Lihat invois',limit:'Memaparkan 100 rekod penghantaran kanonik pertama.'},
      zh:{deliveries:'交货单',delivery:'交货单',customer:'客户',order:'销售订单',
        invoice:'销售发票',date:'交货日期',status:'状态',items:'已交付项目',product:'产品',
        warehouse:'仓库',quantity:'交付数量',all:'全部',draft:'草稿',delivered:'已交付',
        cancelled:'已取消',empty:'目前没有标准交货单。',help:'确认销售订单草稿后，系统会在同一事务中创建交货单、库存出库和发票。',
        trace:'履约追踪',viewOrder:'查看销售订单',viewInvoice:'查看发票',limit:'显示前 100 条标准交货记录。'},
      ja:{deliveries:'出荷伝票',delivery:'出荷伝票',customer:'顧客',order:'受注',
        invoice:'請求書',date:'出荷日',status:'ステータス',items:'出荷明細',product:'製品',
        warehouse:'倉庫',quantity:'出荷数量',all:'すべて',draft:'ドラフト',delivered:'出荷済',
        cancelled:'キャンセル',empty:'標準出荷伝票はありません。',help:'受注ドラフトを確定すると、出荷・在庫払出・請求書を同一トランザクションで作成します。',
        trace:'履行トレース',viewOrder:'受注を表示',viewInvoice:'請求書を表示',limit:'最初の100件の標準出荷レコードを表示しています。'},
      vi:{deliveries:'Phiếu giao hàng',delivery:'Phiếu giao hàng',customer:'Khách hàng',order:'Đơn bán hàng',
        invoice:'Hóa đơn',date:'Ngày giao',status:'Trạng thái',items:'Hàng đã giao',product:'Sản phẩm',
        warehouse:'Kho',quantity:'Số lượng đã giao',all:'Tất cả',draft:'Nháp',delivered:'Đã giao',
        cancelled:'Đã hủy',empty:'Chưa có phiếu giao hàng chuẩn.',help:'Xác nhận đơn bán hàng nháp để tạo giao hàng, xuất kho và hóa đơn trong cùng một giao dịch.',
        trace:'Truy vết thực hiện',viewOrder:'Xem đơn bán hàng',viewInvoice:'Xem hóa đơn',limit:'Hiển thị 100 bản ghi giao hàng chuẩn đầu tiên.'},
    };
    const pack=packs[lang]||packs.en;
    return key=>pack[key]||packs.en[key]||key;
  }
  function adapter(){
    if(!window.ErpSystemData) throw new Error('ERP data adapter is unavailable.');
    return window.ErpSystemData;
  }
  function byId(rows){ return new Map((rows||[]).map(row=>[Number(row.id),row])); }
  function statusLabel(s,status){ return s(status)||status; }
  function statusTone(status){ return status==='delivered'?'ok':status==='cancelled'?'danger':'neutral'; }
  function openDelivery(id){
    window.ACTIVE_SALES_DELIVERY_ID=Number(id);
    navigate('delivery-order');
  }
  async function load(){
    const a=adapter();
    const pages=await Promise.all([
      a.list('sales/deliveries',{limit:100}),
      a.list('sales/delivery-lines',{limit:100}),
      a.list('sales/orders',{limit:100}),
      a.list('sales/customers',{limit:100}),
      a.list('sales/invoices',{limit:100}),
      a.list('inventory/products',{limit:100}),
      a.list('inventory/warehouses',{limit:100}),
    ]);
    return {
      deliveries:pages[0].data||[],lines:pages[1].data||[],orders:pages[2].data||[],
      customers:pages[3].data||[],invoices:pages[4].data||[],products:pages[5].data||[],
      warehouses:pages[6].data||[],
    };
  }

  SCREENS['delivery-orders']=async function(root){
    const s=copy(),data=await load();
    const orders=byId(data.orders),customers=byId(data.customers),invoices=byId(data.invoices);
    let active='all';
    function filtered(){ return active==='all'?data.deliveries:data.deliveries.filter(row=>row.status===active); }
    function table(){
      return buildTable({
        rowId:row=>row.id,
        columns:[
          {label:s('delivery'),render:row=>`<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b><small>${esc(row.deliveryDate)}</small></div>`},
          {label:s('customer'),render:row=>{
            const order=orders.get(Number(row.orderId))||{};
            return esc((customers.get(Number(order.customerId))||{}).name||'#'+order.customerId);
          }},
          {label:s('order'),render:row=>`<span class="mono">${esc((orders.get(Number(row.orderId))||{}).docNo||'#'+row.orderId)}</span>`},
          {label:s('invoice'),render:row=>`<span class="mono">${esc((invoices.get(Number(row.invoiceId))||{}).docNo||'—')}</span>`},
          {label:s('date'),render:row=>esc(row.deliveryDate)},
          {label:s('status'),render:row=>cap(statusLabel(s,row.status),statusTone(row.status))},
        ],rows:filtered(),
      });
    }
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.sales'),s('deliveries')])}${typeof salesNav==='function'?salesNav('delivery-orders'):''}
        <div class="h1row"><h1>${esc(s('deliveries'))}</h1><span class="countchip" data-delivery-count>${data.deliveries.length}</span></div>
        <div class="h1sub">${esc(s('help'))}</div></div>
      <div class="toolbar"><div class="filterchips" data-delivery-filters>
        ${[['all',s('all')],['draft',s('draft')],['delivered',s('delivered')],['cancelled',s('cancelled')]]
          .map(([key,label])=>`<button class="chip ${key==='all'?'on':''}" data-status="${key}">${esc(label)}</button>`).join('')}
      </div><div class="grow"></div><small style="color:var(--muted)">${esc(s('limit'))}</small></div>
      <div class="tablewrap" data-delivery-table>${table()}</div>
      ${!data.deliveries.length?`<div class="statepanel empty">${ic('truck')}<h3>${esc(s('empty'))}</h3><p>${esc(s('help'))}</p></div>`:''}
    </section></div>`;
    const tableRoot=root.querySelector('[data-delivery-table]');
    function wire(){ wireTable(tableRoot,{onRow:id=>openDelivery(id)}); }
    wire();
    root.querySelectorAll('[data-delivery-filters] [data-status]').forEach(button=>button.addEventListener('click',()=>{
      root.querySelector('[data-delivery-filters] .chip.on')?.classList.remove('on');
      button.classList.add('on'); active=button.dataset.status;
      tableRoot.innerHTML=table(); wire();
      root.querySelector('[data-delivery-count]').textContent=String(filtered().length);
    }));
  };

  SCREENS['delivery-order']=async function(root){
    const s=copy(),data=await load();
    const id=Number(window.ACTIVE_SALES_DELIVERY_ID)||Number(data.deliveries[0]?.id);
    const delivery=data.deliveries.find(row=>Number(row.id)===id)||data.deliveries[0];
    if(!delivery){
      root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty">
        ${ic('truck')}<h3>${esc(s('empty'))}</h3><p>${esc(s('help'))}</p></div></section></div>`;
      return;
    }
    window.ACTIVE_SALES_DELIVERY_ID=Number(delivery.id);
    const order=byId(data.orders).get(Number(delivery.orderId))||{};
    const invoice=byId(data.invoices).get(Number(delivery.invoiceId))||{};
    const customer=byId(data.customers).get(Number(order.customerId))||{};
    const products=byId(data.products),warehouses=byId(data.warehouses);
    const lines=data.lines.filter(row=>Number(row.deliveryId)===Number(delivery.id))
      .sort((a,b)=>Number(a.lineNo)-Number(b.lineNo));
    const rows=lines.map((line,index)=>{
      const item=products.get(Number(line.productId))||{};
      const wh=warehouses.get(Number(line.warehouseId))||{};
      return `<tr><td class="lineno">${index+1}</td><td class="l li-name"><b>${esc(item.name||'#'+line.productId)}</b>
        <small>${esc(item.sku||'')}</small></td><td class="l">${esc(wh.name||'#'+line.warehouseId)}</td>
        <td class="tnum"><b>${num(Number(line.deliveredQty))}</b> ${esc(item.uom||'')}</td></tr>`;
    }).join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="pagehead">
      ${crumbs([DB.company.name,{label:t('nav.sales'),route:'sales-home'},{label:s('deliveries'),route:'delivery-orders'},{cur:delivery.docNo}])}
      ${typeof salesNav==='function'?salesNav('delivery-orders'):''}</div><div class="docwrap"><div class="docpage">
      <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('truck')}${esc(s('delivery'))}
        <span class="dnum">${esc(delivery.docNo)}</span></div><div class="h1sub">${esc(customer.name||'#'+order.customerId)}</div></div>
        <div class="dactions">${cap(statusLabel(s,delivery.status),statusTone(delivery.status))}</div></div>
        <div class="docmeta"><div class="dm"><small>${esc(s('customer'))}</small><b>${esc(customer.name||'—')}</b></div>
          <div class="dm"><small>${esc(s('order'))}</small><b>${esc(order.docNo||'—')}</b></div>
          <div class="dm"><small>${esc(s('invoice'))}</small><b>${esc(invoice.docNo||'—')}</b></div>
          <div class="dm"><small>${esc(s('date'))}</small><b>${esc(delivery.deliveryDate)}</b></div>
          <div class="dm"><small>${esc(s('status'))}</small><b>${esc(statusLabel(s,delivery.status))}</b></div>
        </div></div>
      <div class="panel"><div class="panel-h"><h3>${esc(s('items'))}</h3></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('product'))}</th>
          <th class="l">${esc(s('warehouse'))}</th><th>${esc(s('quantity'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="panel"><div class="panel-h"><h3>${esc(s('trace'))}</h3></div><div class="panel-body">
        ${relatedDocs([{no:order.docNo||'#'+delivery.orderId,label:s('order'),meta:s('delivered'),status:order.status||'confirmed'},
          {no:invoice.docNo||'#'+delivery.invoiceId,label:s('invoice'),meta:s('trace'),status:invoice.status||'unpaid'}])}
      </div></div></div></div>
      <div class="set-savebar"><div class="grow"></div>
        ${btn(s('viewOrder'),{icon:'bag',cls:'soft',attrs:'data-view-delivery-order'})}
        ${btn(s('viewInvoice'),{icon:'receipt',cls:'primary',attrs:'data-view-delivery-invoice'})}</div>
    </section></div>`;
    root.querySelector('[data-view-delivery-order]')?.addEventListener('click',()=>navigate('sales-order',{no:order.docNo}));
    root.querySelector('[data-view-delivery-invoice]')?.addEventListener('click',()=>navigate('sales-invoice',{no:invoice.docNo}));
  };
})();
