/* ============================================================
   ARIA ERP — Sales module: hub, shared shell, list factory, reports
   Provides:  SALES_SECTIONS, salesNav(), salesPage(), registerSalesTransactionList()
   Screens:   sales-home, sales-reports, report-sales-customer,
              report-sales-rep, report-quote-conversion, report-generic
   ============================================================ */

/* ---- module map (drives the sub-nav strip + the hub directory) ---- */
const SALES_SECTIONS = [
  { group:'Overview', items:[
    { route:'sales-home', label:'Dashboard', icon:'grid', desc:'KPIs & order-to-cash status' },
  ]},
  { group:'Transactions', items:[
    { route:'enquiries',       label:'Enquiries',       icon:'comment', desc:'Pre-quote customer requests' },
    { route:'quotations',      label:'Quotations',      icon:'receipt', desc:'Offers issued to customers' },
    { route:'sales-orders',    label:'Sales Orders',    icon:'bag',     desc:'Confirmed customer orders' },
    { route:'delivery-orders', label:'Delivery Orders', icon:'truck',   desc:'Picking, packing & dispatch' },
    { route:'sales-invoices',  label:'Invoices',        icon:'receipt', desc:'Billing & receivables' },
    { route:'sales-returns',   label:'Returns / RMA',   icon:'refresh', desc:'Customer returns & inspection' },
    { route:'credit-notes',    label:'Credit Notes',    icon:'coins',   desc:'Customer credit adjustments' },
    { route:'debit-notes',     label:'Debit Notes',     icon:'coins',   desc:'Additional customer charges' },
  ]},
  { group:'Controls', items:[
    { route:'so-approvals',    label:'Approvals',       icon:'flow',    desc:'Orders awaiting sign-off' },
    { route:'credit-control',  label:'Credit Control',  icon:'shield',  desc:'Exposure & credit holds' },
    { route:'price-lists',     label:'Price Lists',     icon:'tag',     desc:'Pricing rules & contracts' },
    { route:'discount-mgmt',   label:'Discounts',       icon:'percent', desc:'Discount rules & approval caps' },
    { route:'sales-commission',label:'Commission',      icon:'coins',   desc:'Salesperson commission runs' },
  ]},
  { group:'Reports', items:[
    { route:'sales-reports',   label:'Reports',         icon:'chart',   desc:'Operational & management reports' },
  ]},
];
const SALES_FLAT = SALES_SECTIONS.flatMap(s=>s.items);
/* alias map: a deep-doc route highlights its list section in the sub-nav */
const SALES_ALIAS = { quotation:'quotations', 'delivery-order':'delivery-orders', 'sales-invoice':'sales-invoices',
  'sales-order':'sales-orders', 'new-sales-order':'sales-orders', 'sales-return':'sales-returns', 'credit-note':'credit-notes' };

/* ---- sub-nav strip (shown on every Sales screen we build) ----
   Thin delegate to the generic moduleNav() (app.js) -- kept as a named function
   since ~20 sales detail screens call salesNav(active) directly rather than going
   through modulePage() (TASK-045: SALES_SECTIONS/SALES_ALIAS stay here as the
   single real source, referenced by MODULE_DEFS.sales in app.js, not duplicated). */
function salesNav(active){
  return moduleNav('sales', active);
}

/* ---- standard Sales page shell (crumbs + sub-nav + title) ---- */
function salesPage(o){
  const crumb = o.crumb || [DB.company.name,{label:'Sales',route:'sales-home'},{cur:o.title}];
  return `<div class="content full"><section class="master" data-screen-label="Sales · ${esc(o.title)}">
    <div class="scrollarea">
      <div class="pagehead">
        ${crumbs(crumb)}
        ${salesNav(o.active||o.route)}
        <div class="h1row" style="margin-top:13px"><h1>${esc(o.title)}</h1>${o.count!=null?`<span class="countchip">${o.count}</span>`:''}<div class="grow"></div>${o.action||''}</div>
        ${o.sub?`<div class="h1sub">${o.sub}</div>`:''}
      </div>
      ${o.body||''}
    </div>
  </section></div>`;
}

/* ---- shared cells ---- */
function custCell(name, code){
  return `<div class="partnercell">${profileAvatar({name,cls:'pmini',size:26})}<span class="cellsub"><b>${esc(name)}</b><small>${esc(code||'')}</small></span></div>`;
}
function docNoCell(no, sub){ return `<div class="cellsub"><b class="docnum linknum">${esc(no)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>`; }

function salesNumber(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

function salesDueDate(value){
  const normalized=dateValue(value);
  const date=new Date(`${normalized}T00:00:00`);
  if(Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate()+30);
  return date.toISOString().slice(0,10);
}

/* Canonical order-to-cash presentation model. Every row comes from the
   bounded ErpSystemData resource contract in both Demo and API modes. */
async function prepareCanonicalSalesData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(
      Array.isArray(DB.customers)
      &&Array.isArray(DB.salesOrders)
      &&Array.isArray(DB.salesInvoices)
      &&DB.salesOrderDocs
      &&DB.salesInvoiceDocs
    ) return;
    throw new Error('The offline canonical sales snapshot is unavailable.');
  }
  const pages=await Promise.all([
    listPage('sales/customers'),
    listPage('sales/orders'),
    listPage('sales/order-lines'),
    listPage('sales/invoices'),
    listPage('inventory/products'),
    listPage('inventory/warehouses'),
    listPage('inventory/stock-levels'),
    listPage('sales/order-approvals'),
  ]);
  const [
    customers,orders,orderLines,invoices,products,warehouses,stockLevels,approvals,
  ]=pages.map(page=>page.data);
  const customerById=new Map(customers.map(row=>[row.id,row]));
  const orderById=new Map(orders.map(row=>[row.id,row]));
  const productById=new Map(products.map(row=>[row.id,row]));
  const invoiceByOrderId=new Map(invoices.map(row=>[row.orderId,row]));
  const approvalByOrderId=new Map(approvals.map(row=>[row.orderId,row]));
  const defaultWarehouseResource=warehouses.find(row=>row.code==='WH-SALES')||warehouses[0]||null;
  const onHandByProduct=new Map();
  const onHandByProductWarehouse=new Map();
  stockLevels.forEach(row=>{
    onHandByProduct.set(
      row.productId,
      (onHandByProduct.get(row.productId)||0)+salesNumber(row.qty),
    );
    onHandByProductWarehouse.set(
      `${row.productId}:${row.warehouseId}`,
      salesNumber(row.qty),
    );
  });
  const linesByOrderId=new Map();
  orderLines.forEach(row=>{
    const product=productById.get(row.productId)||{};
    const lines=linesByOrderId.get(row.orderId)||[];
    lines.push({
      id:row.id,
      productId:row.productId,
      item:product.sku||`Product #${row.productId}`,
      name:product.name||`Product #${row.productId}`,
      qty:salesNumber(row.qty),
      uom:product.uom||'unit',
      price:salesNumber(row.unitPrice),
      disc:0,
      avail:defaultWarehouseResource
        ?(onHandByProductWarehouse.get(`${row.productId}:${defaultWarehouseResource.id}`)||0)
        :0,
      taxCode:row.taxCode,
      taxRate:salesNumber(row.taxRate)/100,
    });
    linesByOrderId.set(row.orderId,lines);
  });
  const invoiceBalanceByCustomer=new Map();
  invoices.forEach(row=>{
    if(row.status==='unpaid'){
      invoiceBalanceByCustomer.set(
        row.customerId,
        (invoiceBalanceByCustomer.get(row.customerId)||0)+salesNumber(row.totalAmount),
      );
    }
  });

  DB.salesWarehouses=warehouses.map(row=>({
    id:row.id,code:row.code,name:row.name,
  }));
  DB.customers=customers.map(row=>({
    id:row.id,
    code:row.code,
    name:row.name,
    terms:'—',
    limit:null,
    balance:invoiceBalanceByCustomer.get(row.id)||0,
    overdue:0,
    status:'Active',
  }));
  const customerViewById=new Map(DB.customers.map(row=>[row.id,row]));
  DB.items=products.map(row=>({
    id:row.id,
    sku:row.sku,
    name:row.name,
    uom:row.uom,
    cost:salesNumber(row.standardCost),
    onHand:onHandByProduct.get(row.id)||0,
    alloc:0,
    reorder:0,
    roq:0,
    status:(onHandByProduct.get(row.id)||0)>0?'In stock':'No stock',
  }));

  const ORDER_STATUS_UI={pending_approval:'Pending Approval',approved:'Approved',draft:'Draft',confirmed:'Closed',rejected:'Rejected',cancelled:'Cancelled'};
  const INVOICE_STATUS_UI={unpaid:'Posted',paid:'Paid',cancelled:'Cancelled'};
  DB.salesOrders=orders.map(row=>{
    const customer=customerById.get(row.customerId)||{};
    const lines=linesByOrderId.get(row.id)||[];
    const relatedInvoice=invoiceByOrderId.get(row.id);
    const approvalStatus=approvalByOrderId.get(row.id)?.status||null;
    const effectiveStatus=row.status==='draft'
      ?(approvalStatus==='pending'
        ?'pending_approval'
        :(approvalStatus==='rejected'
          ?'rejected'
          :(approvalStatus==='approved'?'approved':row.status)))
      :row.status;
    return {
      id:row.id,
      version:row.version,
      no:row.docNo,
      cust:customer.name||`Customer #${row.customerId}`,
      customerId:row.customerId,
      custCode:customer.code||'—',
      date:dateValue(row.orderDate),
      deliver:dateValue(row.orderDate),
      status:ORDER_STATUS_UI[effectiveStatus]||effectiveStatus,
      rawStatus:row.status,
      approvalStatus,
      total:salesNumber(row.totalAmount),
      net:salesNumber(row.netAmount),
      tax:salesNumber(row.taxAmount),
      currency:row.currency,
      owner:DB.user&&DB.user.name||'System',
      items:lines.length,
      done:row.status==='confirmed'?lines.length:0,
      posted:row.status==='confirmed',
      payStatus:relatedInvoice
        ?(relatedInvoice.status==='paid'?'Paid':'Unpaid')
        :'—',
    };
  });
  DB.salesOrderDocs={};
  const defaultWarehouse=DB.salesWarehouses.find(row=>row.id===defaultWarehouseResource?.id)
    ||DB.salesWarehouses[0]||null;
  DB.salesOrders.forEach(row=>{
    const customer=customerViewById.get(row.customerId)||{
      id:row.customerId,name:row.cust,code:row.custCode,terms:'—',
      limit:null,balance:0,overdue:0,
    };
    const taxRate=row.net>0?row.tax/row.net:0;
    DB.salesOrderDocs[row.no]={
      id:row.id,
      version:row.version,
      no:row.no,
      cust:customer,
      date:row.date,
      deliver:row.deliver,
      ref:'—',
      status:row.status,
      rawStatus:row.rawStatus,
      approvalStatus:row.approvalStatus,
      owner:row.owner,
      warehouse:defaultWarehouse?`${defaultWarehouse.code} · ${defaultWarehouse.name}`:'—',
      warehouseId:defaultWarehouse&&defaultWarehouse.id,
      currency:row.currency,
      rate:1,
      terms:customer.terms||'—',
      lines:linesByOrderId.get(row.id)||[],
      discountPct:0,
      shipping:0,
      taxRate,
      billTo:null,
      shipTo:null,
      note:'Canonical sales order. Customer notes are not modeled yet.',
      memo:'Created from the canonical order-to-cash ledger.',
    };
  });
  DB.so0418=DB.salesOrderDocs[DB.salesOrders[0]&&DB.salesOrders[0].no]||null;

  DB.salesInvoices=invoices.map(row=>{
    const customer=customerById.get(row.customerId)||{};
    const order=orderById.get(row.orderId)||{};
    const total=salesNumber(row.totalAmount);
    return {
      id:row.id,
      version:row.version,
      no:row.docNo,
      date:dateValue(row.invoiceDate),
      due:salesDueDate(row.invoiceDate),
      cust:customer.name||`Customer #${row.customerId}`,
      customerId:row.customerId,
      custCode:customer.code||'—',
      so:order.docNo||`Order #${row.orderId}`,
      orderId:row.orderId,
      total,
      paid:row.status==='paid'?total:0,
      status:INVOICE_STATUS_UI[row.status]||row.status,
      rawStatus:row.status,
      currency:row.currency,
      doc:true,
    };
  });
  DB.salesInvoiceDocs={};
  DB.salesInvoices.forEach(row=>{
    const invoiceRow=invoices.find(item=>item.id===row.id)||{};
    const order=orderById.get(row.orderId)||{};
    const customer=customerById.get(row.customerId)||{};
    const taxRate=salesNumber(invoiceRow.netAmount)>0
      ?salesNumber(invoiceRow.taxAmount)/salesNumber(invoiceRow.netAmount)
      :0;
    DB.salesInvoiceDocs[row.no]={
      id:row.id,
      version:row.version,
      no:row.no,
      so:row.so,
      do:'—',
      cust:row.cust,
      code:customer.code||'—',
      date:row.date,
      due:row.due,
      terms:'—',
      currency:row.currency,
      taxRate,
      shipping:0,
      status:row.status,
      rawStatus:row.rawStatus,
      paid:row.paid,
      owner:DB.user&&DB.user.name||'System',
      lines:linesByOrderId.get(order.id)||[],
    };
  });
  DB.invoice0331=DB.salesInvoiceDocs[DB.salesInvoices[0]&&DB.salesInvoices[0].no]||null;
  DB.soNow=typeof workingBusinessDate==='function'?workingBusinessDate():new Date().toISOString().slice(0,10);
  DB.salesReadMeta={
    truncated:pages.some(page=>Boolean(page.nextCursor)),
    nextCursors:pages.map(page=>page.nextCursor),
  };
}

function registerSalesTransactionList(config){
  registerTransactionList({...config,module:'sales'});
}

/* ============================================================
   SALES DASHBOARD (module landing)
   ============================================================ */
SCREENS['sales-home'] = function(root){
  const SO=DB.salesOrders, INV=DB.salesInvoices, now=new Date(DB.soNow);
  const open=SO.filter(s=>s.status!=='Closed'&&s.status!=='Cancelled');
  const openVal=open.reduce((a,s)=>a+s.total,0);
  const pending=SO.filter(s=>s.status==='Pending Approval').length;
  const dueWeek=open.filter(s=>{const d=(new Date(s.deliver)-now)/86400000;return d>=0&&d<=7;}).length;
  const overdueDel=DB.deliveries.filter(d=>['Draft','Picking','Packed','Partially Delivered'].includes(d.status) && new Date(d.date)<now).length
                  + open.filter(s=>new Date(s.deliver)<now).length;
  const pendingInv=INV.filter(i=>['Posted','Partially Paid','Overdue'].includes(i.status)).length;
  const overduePay=INV.filter(i=>i.status==='Overdue').reduce((a,i)=>a+(i.total-i.paid),0);

  const kpis=[
    {label:'Open orders', val:open.length, route:'sales-orders'},
    {label:'Open order value', val:money0(openVal), route:'sales-orders'},
    {label:'Pending approval', val:pending, route:'so-approvals', accent:pending>0},
    {label:'Due this week', val:dueWeek, route:'sales-orders'},
    {label:'Overdue deliveries', val:overdueDel, route:'delivery-orders', neg:overdueDel>0},
    {label:'Pending invoices', val:pendingInv, route:'sales-invoices'},
    {label:'Overdue payments', val:money0(overduePay), route:'credit-control', neg:overduePay>0},
  ];
  const kpibar=`<div class="so-kpibar">`+kpis.map(k=>`<button class="so-kpi ${k.neg?'neg':''} ${k.accent?'accent':''} clickable" onclick="navigate('${k.route}')"><small>${esc(k.label)}</small><b class="tnum">${k.val}</b></button>`).join('')+`</div>`;

  /* charts */
  const maxM=Math.max(...DB.salesByMonth.map(m=>m.val));
  const ytd=DB.salesByMonth.filter(m=>!m.fc).reduce((a,m)=>a+m.val,0);
  const monthBars=`<div class="mbars">`+DB.salesByMonth.map(m=>{
    const h=Math.round(m.val/maxM*100);
    return `<div class="mbar" data-tip="${m.m} · ${m.fc?'forecast ':''}${money0(m.val)}"><span class="mbar-track"><i class="${m.fc?'fc':''}" style="height:${h}%"></i></span><span class="mbar-l">${m.m[0]}</span></div>`;
  }).join('')+`</div>`;

  const maxR=Math.max(...DB.salesByRep.map(r=>Math.max(r.sales,r.target)));
  const repBars=`<div class="repbars">`+DB.salesByRep.map(r=>{
    const pct=Math.round(r.sales/maxR*100), tpct=Math.round(r.target/maxR*100), hit=r.sales>=r.target;
    return `<div class="repbar"><div class="rb-top"><span>${esc(r.rep)}</span><b class="tnum">${money0(r.sales)}</b></div>
      <div class="rb-track"><i style="width:${pct}%;background:${hit?'var(--ok)':'var(--accent)'}"></i><span class="rb-tick" style="left:${tpct}%" data-tip="Target ${money0(r.target)}"></span></div>
      <div class="rb-sub">${hit?'<span style="color:var(--ok)">Target met</span>':`${Math.round(r.sales/r.target*100)}% of ${money0(r.target)} target`} · ${r.deals} deals</div></div>`;
  }).join('')+`</div>`;

  const topCust=barList(DB.topCustomers.map(c=>({label:c.cust, value:c.ytd, text:money0(c.ytd), clr:'var(--accent)'})));

  const qOpen=DB.quotations.filter(q=>['Draft','Sent','Accepted'].includes(q.status));
  const qOpenVal=qOpen.reduce((a,q)=>a+q.total,0);
  const qConv=DB.quotations.filter(q=>q.status==='Converted').length;
  const qDecided=DB.quotations.filter(q=>['Converted','Rejected','Expired'].includes(q.status)).length;
  const winRate=Math.round(qConv/Math.max(1,qDecided)*100);

  /* module directory tiles */
  function counts(route){
    switch(route){
      case 'enquiries': return DB.enquiries.filter(e=>['New','Quoted','On hold'].includes(e.status)).length;
      case 'quotations': return qOpen.length;
      case 'sales-orders': return open.length;
      case 'delivery-orders': return DB.deliveries.filter(d=>d.status!=='Delivered'&&d.status!=='Cancelled').length;
      case 'sales-invoices': return INV.filter(i=>['Posted','Partially Paid','Overdue'].includes(i.status)).length;
      case 'sales-returns': return DB.salesReturns.filter(r=>!['Credited','Closed','Rejected'].includes(r.status)).length;
      case 'credit-notes': return DB.creditNotes.filter(c=>c.status==='Draft').length;
      case 'debit-notes': return DB.debitNotes.filter(d=>d.status==='Draft').length;
      case 'so-approvals': return pending;
      case 'credit-control': return DB.customers.filter(c=>c.overdue>0||c.balance/c.limit>=0.9||c.status==='On hold').length;
      case 'price-lists': return DB.priceLists.filter(p=>p.status==='Active').length;
      case 'discount-mgmt': return DB.discountRules.filter(d=>d.status==='Active').length;
      /* The canonical page computes its own live run count. Do not surface the
         legacy sample commission badge on the Sales directory. */
      case 'sales-commission': return 0;
      case 'sales-reports': return DB.reportsCatalog.flatMap(g=>g.items).length;
      default: return null;
    }
  }
  function tile(it){ const c=counts(it.route);
    return `<button class="stile" onclick="navigate('${it.route}')">
      <span class="stile-ic">${ic(it.icon)}</span>
      <span class="stile-main"><b>${esc(it.label)}</b><small>${esc(it.desc)}</small></span>
      ${c!=null?`<span class="stile-meta">${c}</span>`:''}
      <span class="stile-go">${ic('chevR')}</span></button>`;
  }
  function group(name){ const sec=SALES_SECTIONS.find(s=>s.group===name); return `<div class="stile-grid">${sec.items.map(tile).join('')}</div>`; }

  root.innerHTML = salesPage({
    active:'sales-home', title:'Sales',
    crumb:[DB.company.name,{cur:'Sales'}],
    sub:'Order-to-cash command centre — from enquiry through quotation, order, delivery, invoice and collection.',
    action: btn('New sales order',{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-sales-order\')"'}),
    body:`<div class="sales-body">
      ${kpibar}
      <div class="sb-grid">
        <div class="wcard sb-span2"><div class="sb-h"><h3>Revenue — FY2026</h3><div class="sb-h-r"><b class="tnum">${money0(ytd)}</b><small>YTD · 6 mo</small></div></div>${monthBars}<div class="sb-legend"><span><i style="background:var(--accent)"></i>Actual</span><span><i class="fc-swatch"></i>Forecast</span></div></div>
        <div class="wcard"><div class="sb-h"><h3>Quote pipeline</h3></div>
          <div class="sb-stat"><div><small>Open quotes</small><b class="tnum">${money0(qOpenVal)}</b><span>${qOpen.length} live</span></div><div><small>Win rate</small><b class="tnum">${winRate}%</b><span>${qConv} won</span></div></div>
          ${btn('Open quotations',{icon:'receipt',cls:'soft',sm:false,attrs:'onclick="navigate(\'quotations\')"'})}
        </div>
        <div class="wcard"><div class="sb-h"><h3>Top customers</h3><a class="sb-link" onclick="navigate('report-sales-customer')">Report</a></div>${topCust}</div>
        <div class="wcard sb-span2"><div class="sb-h"><h3>Sales by salesperson</h3><a class="sb-link" onclick="navigate('report-sales-rep')">Report</a></div>${repBars}</div>
      </div>

      <div class="dash-sectitle"><span>Transactions</span><span class="ln"></span></div>
      ${group('Transactions')}
      <div class="dash-sectitle"><span>Controls</span><span class="ln"></span></div>
      ${group('Controls')}
      <div class="dash-sectitle"><span>Reports</span><span class="ln"></span></div>
      ${group('Reports')}
    </div>`
  });
};

/* ============================================================
   REPORTS HUB
   ============================================================ */
let SALES_REPORT_PENDING = null;
function openSalesReport(id){
  const meta = DB.reportsCatalog.flatMap(g=>g.items).find(r=>r.id===id);
  if(meta && meta.built) navigate(id);
  else { SALES_REPORT_PENDING = meta; navigate('report-generic'); }
}
SCREENS['sales-reports'] = function(root){
  function card(r){ return `<button class="rep-card ${r.built?'built':''}" onclick="openSalesReport('${r.id}')">
    <span class="rep-ic">${ic(r.icon)}</span>
    <span class="rep-main"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></span>
    ${r.built?`<span class="rep-tag">Live</span>`:''}${ic('chevR')}</button>`; }
  const groups=DB.reportsCatalog.map(g=>`<div class="dash-sectitle"><span>${esc(g.group)}</span><span class="ln"></span></div><div class="rep-grid">${g.items.map(card).join('')}</div>`).join('');
  root.innerHTML = salesPage({
    active:'sales-reports', title:'Reports', sub:'Operational and management reports across the sales lifecycle. Filter by date, customer, item, salesperson and status; export to Excel or PDF.',
    body:`<div class="sales-body">${groups}</div>`
  });
};

/* ---- report shell ---- */
function reportShell({title, meta, params, result}){
  return `<div class="content full"><section class="master" data-screen-label="Report · ${esc(title)}"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      ${params}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:6px;display:flex;flex-direction:column;gap:8px">
        ${btn('Run report',{icon:'refresh',cls:'primary',sm:false,attrs:'onclick="toast(\'Report refreshed\',\'ok\')"'})}
        ${btn('Back to reports',{icon:'chevL',cls:'soft',attrs:'onclick="navigate(\'sales-reports\')"'})}
      </div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">${esc(title)}</b><div class="report-meta">${meta}</div></div>
        <div class="grow"></div>
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div style="padding:16px 22px;overflow:auto">${result}</div>
    </div>
  </div></section></div>`;
}
const REPORT_PARAMS_COMMON = `
  <div class="fld"><span>Period</span><select><option>FY2026 · YTD</option><option>P06 · June 2026</option><option>Q2 2026</option><option>FY2025</option></select></div>
  <div class="fld"><span>Customer</span><select><option>All customers</option><option>Meridian Robotics</option><option>Apex Industrial Group</option><option>Tycho Automation</option></select></div>
  <div class="fld"><span>Salesperson</span><select><option>All reps</option><option>J. Okafor</option><option>L. Tan</option><option>M. Silva</option></select></div>`;

/* ---- Sales by Customer ---- */
SCREENS['report-sales-customer'] = function(root){
  const data=DB.topCustomers, tot=data.reduce((a,c)=>a+c.ytd,0);
  const rows=data.map((c,i)=>`<tr><td class="lineno">${i+1}</td><td class="l li-name"><b>${esc(c.cust)}</b><small>${esc(c.custCode)}</small></td>
    <td class="tnum">${money0(c.ytd)}</td><td class="tnum">${c.share}%</td>
    <td class="l"><span class="bartrack" style="width:140px;display:inline-block;vertical-align:middle"><i style="width:${Math.round(c.ytd/data[0].ytd*100)}%"></i></span></td></tr>`).join('');
  root.innerHTML=reportShell({
    title:'Sales by Customer', meta:`FY2026 YTD · ${money0(tot)} revenue · ${data.length} customers`,
    params:REPORT_PARAMS_COMMON,
    result:`<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Revenue by customer</h3></div><div class="panel-body" style="padding:14px 18px">${barList(data.map(c=>({label:c.cust,value:c.ytd,text:money0(c.ytd),clr:'var(--accent)',route:'report-sales-customer'})))}</div></div>
      <div class="panel"><div class="panel-h"><h3>Detail</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${data.length} customers</span></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Customer</th><th>Revenue YTD</th><th>Share</th><th class="l">Distribution</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" style="font-weight:600">Total</td><td class="tnum"><b>${money0(tot)}</b></td><td class="tnum">100%</td><td></td></tr></tfoot></table></div>`
  });
};

/* ---- Sales by Salesperson ---- */
SCREENS['report-sales-rep'] = function(root){
  const data=DB.salesByRep, tot=data.reduce((a,r)=>a+r.sales,0), totT=data.reduce((a,r)=>a+r.target,0);
  const rows=data.map((r,i)=>{ const pct=Math.round(r.sales/r.target*100), hit=r.sales>=r.target;
    return `<tr><td class="lineno">${i+1}</td><td class="l li-name"><b>${esc(r.rep)}</b><small>${r.deals} deals closed</small></td>
    <td class="tnum">${money0(r.sales)}</td><td class="tnum">${money0(r.target)}</td>
    <td class="tnum" style="color:${hit?'var(--ok)':'var(--warn)'}">${pct}%</td>
    <td class="l">${hit?cap('On target','ok'):cap('Below','warn')}</td></tr>`;}).join('');
  root.innerHTML=reportShell({
    title:'Sales by Salesperson', meta:`FY2026 YTD · ${money0(tot)} of ${money0(totT)} target · ${Math.round(tot/totT*100)}% attainment`,
    params:REPORT_PARAMS_COMMON,
    result:`<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Attainment vs. target</h3></div><div class="panel-body" style="padding:14px 18px">${barList(data.map(r=>({label:r.rep,value:r.sales,text:money0(r.sales),clr:r.sales>=r.target?'var(--ok)':'var(--accent)'})))}</div></div>
      <div class="panel"><div class="panel-h"><h3>Detail</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${data.length} reps</span></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Salesperson</th><th>Sales</th><th>Target</th><th>Attain</th><th class="l">Status</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" style="font-weight:600">Total</td><td class="tnum"><b>${money0(tot)}</b></td><td class="tnum">${money0(totT)}</td><td class="tnum">${Math.round(tot/totT*100)}%</td><td></td></tr></tfoot></table></div>`
  });
};

/* ---- Quotation Conversion ---- */
SCREENS['report-quote-conversion'] = function(root){
  const Q=DB.quotations;
  const byStatus=['Draft','Sent','Accepted','Converted','Rejected','Expired'].map(s=>({s, n:Q.filter(q=>q.status===s).length, v:Q.filter(q=>q.status===s).reduce((a,q)=>a+q.total,0)}));
  const conv=Q.filter(q=>q.status==='Converted').length, decided=Q.filter(q=>['Converted','Rejected','Expired'].includes(q.status)).length;
  const win=Math.round(conv/Math.max(1,decided)*100);
  const tone={Draft:'neutral',Sent:'info',Accepted:'accent',Converted:'ok',Rejected:'danger',Expired:'warn'};
  const rows=byStatus.map((b,i)=>`<tr><td class="lineno">${i+1}</td><td class="l">${cap(b.s,tone[b.s])}</td><td class="tnum">${b.n}</td><td class="tnum">${money0(b.v)}</td><td class="tnum">${Math.round(b.n/Q.length*100)}%</td></tr>`).join('');
  root.innerHTML=reportShell({
    title:'Quotation Conversion', meta:`${Q.length} quotations · ${conv} converted · ${win}% win-rate (of decided)`,
    params:REPORT_PARAMS_COMMON,
    result:`<div class="sb-stat" style="margin-bottom:16px;max-width:520px"><div><small>Win rate</small><b class="tnum">${win}%</b><span>${conv} of ${decided} decided</span></div><div><small>Open value</small><b class="tnum">${money0(Q.filter(q=>['Draft','Sent','Accepted'].includes(q.status)).reduce((a,q)=>a+q.total,0))}</b><span>${Q.filter(q=>['Draft','Sent','Accepted'].includes(q.status)).length} live</span></div><div><small>Converted value</small><b class="tnum">${money0(Q.filter(q=>q.status==='Converted').reduce((a,q)=>a+q.total,0))}</b><span>won</span></div></div>
      <div class="panel"><div class="panel-h"><h3>By status</h3></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Status</th><th>Count</th><th>Value</th><th>Share</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" style="font-weight:600">Total</td><td class="tnum"><b>${Q.length}</b></td><td class="tnum">${money0(Q.reduce((a,q)=>a+q.total,0))}</td><td class="tnum">100%</td></tr></tfoot></table></div>`
  });
};

/* ---- generic (not-yet-configured) report ---- */
SCREENS['report-generic'] = function(root){
  const m=SALES_REPORT_PENDING || {name:'Report', desc:'', icon:'chart'};
  root.innerHTML=reportShell({
    title:m.name, meta:'Configure parameters, then run',
    params:REPORT_PARAMS_COMMON + `<div class="fld"><span>Status</span><select><option>All</option><option>Open</option><option>Closed</option></select></div><div class="fld"><span>Group by</span><select><option>Customer</option><option>Item</option><option>Salesperson</option><option>Month</option></select></div>`,
    result:`<div class="rep-empty">${ic(m.icon)}<h3>${esc(m.name)}</h3><p>${esc(m.desc||'')}</p><p style="color:var(--faint);font-size:13px">Set the parameters on the left and run the report. This report shares the standard sales report engine — results render as a chart plus an exportable table.</p>${btn('Run report',{icon:'refresh',cls:'primary',sm:false,attrs:'onclick="toast(\'Report queued — results ready shortly\',\'info\')"'})}</div>`
  });
};
