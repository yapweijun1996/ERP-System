/* ============================================================
   ERP-System data adapter
   Maps this repository's canonical demo seed into the user-owned
   Aria ERP static UI contract without changing the layout.

   Source of truth mirrored here:
   - src/data/seed.ts
   - src/demo.ts sales confirmation proof
   ============================================================ */
(function applyErpSystemDemoData(){
  if (typeof DB === 'undefined') return;

  const scope = { masterFn:'M1', companyFn:'C-SG' };
  const master = { masterFn:'M1', name:'Acme Group' };
  const companies = [
    { companyFn:'C-SG', masterFn:'M1', name:'Acme Singapore', country:'SG', currency:'SGD', taxRegime:'GST', locale:'en' },
    { companyFn:'C-MY', masterFn:'M1', name:'Acme Malaysia', country:'MY', currency:'MYR', taxRegime:'SST', locale:'ms' },
  ];
  const products = [
    { id:1, masterFn:'M1', companyFn:'C-SG', sku:'SG-WIDGET', name:'Widget (SG)', uom:'unit', onHand:95, alloc:0, reorder:20, roq:100, cost:6.5, price:10 },
    { id:2, masterFn:'M1', companyFn:'C-SG', sku:'SG-GADGET', name:'Gadget (SG)', uom:'box', onHand:97, alloc:0, reorder:20, roq:100, cost:13, price:20 },
    { id:3, masterFn:'M1', companyFn:'C-MY', sku:'MY-WIDGET', name:'Widget (MY)', uom:'unit', onHand:50, alloc:0, reorder:15, roq:80, cost:7, price:12 },
  ];
  const customers = [
    { id:1, masterFn:'M1', companyFn:'C-SG', code:'CUST1', name:'Beta Pte Ltd', terms:'Net 30', limit:50000, balance:119.90, overdue:0, status:'Active' },
  ];
  const accounts = [
    { id:1, masterFn:'M1', companyFn:'C-SG', code:'1100', name:'Accounts Receivable', type:'asset' },
    { id:2, masterFn:'M1', companyFn:'C-SG', code:'4000', name:'Revenue', type:'income' },
    { id:3, masterFn:'M1', companyFn:'C-SG', code:'2200', name:'GST Output Tax', type:'liability' },
  ];
  const taxRules = [
    { masterFn:'M1', companyFn:'C-SG', taxRegime:'GST', taxCode:'SR', rate:8, validFrom:'2023-01-01', validTo:'2024-01-01' },
    { masterFn:'M1', companyFn:'C-SG', taxRegime:'GST', taxCode:'SR', rate:9, validFrom:'2024-01-01', validTo:null },
    { masterFn:'M1', companyFn:'C-MY', taxRegime:'SST', taxCode:'SV', rate:8, validFrom:'2025-07-01', validTo:null },
  ];

  const activeCompany = companies[0];
  const beta = customers[0];
  const widget = products[0];
  const gadget = products[1];
  const orderLines = [
    { item:widget.sku, name:widget.name, qty:5, uom:widget.uom, price:10, disc:0, avail:widget.onHand },
    { item:gadget.sku, name:gadget.name, qty:3, uom:gadget.uom, price:20, disc:0, avail:gadget.onHand },
  ];
  const orderNet = 110;
  const orderTax = 9.90;
  const orderTotal = 119.90;

  DB.erpSystem = {
    source:'ERP-System canonical demo seed',
    schema:'src/data/schema',
    seed:'src/data/seed.ts',
    transactionProof:'src/demo.ts',
    dataMode:'demo-adapter',
    scope,
    master,
    companies,
    products,
    customers,
    accounts,
    taxRules,
  };

  DB.company = {
    name:activeCompany.name,
    branch:'Singapore HQ',
    currency:activeCompany.currency,
    period:'FY2026 · P06',
    periodLabel:'June 2026',
    env:'DEMO',
  };
  DB.user = {
    name:'Admin',
    email:'admin@acme.co',
    initials:'AD',
    role:'Superadmin',
    perms:{ post:true, approve:true, salaryView:false, costView:true },
  };
  const currencySymbols = { SGD:'S$', MYR:'RM', USD:'$' };
  money = function erpSystemMoney(n, cur){
    if(n==null) return '-';
    const code = cur || DB.company.currency || 'SGD';
    const symbol = currencySymbols[code] || (code + ' ');
    return symbol + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  };
  money0 = function erpSystemMoney0(n){
    const symbol = currencySymbols[DB.company.currency] || (DB.company.currency + ' ');
    return symbol + Math.round(n).toLocaleString('en-US');
  };

  DB.items = products
    .filter((p)=>p.companyFn===activeCompany.companyFn)
    .map((p)=>({
      sku:p.sku,
      name:p.name,
      cat:'Finished Goods',
      uom:p.uom,
      onHand:p.onHand,
      alloc:p.alloc,
      reorder:p.reorder,
      roq:p.roq,
      cost:p.cost,
      status:p.onHand <= p.reorder ? 'Reorder' : 'In stock',
      bins:[[p.sku==='SG-WIDGET'?'SG-A-01':'SG-A-02', p.onHand]],
    }));
  DB.customers = customers.map((c)=>({
    code:c.code,
    name:c.name,
    terms:c.terms,
    limit:c.limit,
    balance:c.balance,
    overdue:c.overdue,
    status:c.status,
  }));

  DB.soNow = '2026-06-28';
  DB.salesOrders = [
    { no:'SO-1', cust:beta.name, custCode:beta.code, date:'2024-06-01', deliver:'2024-06-03', status:'Closed', total:orderTotal, currency:'SGD', owner:'Admin', items:2, done:2, posted:true, payStatus:'Unpaid' },
    { no:'SO-DRAFT-1', cust:beta.name, custCode:beta.code, date:'2026-06-28', deliver:'2026-07-02', status:'Draft', total:110, currency:'SGD', owner:'Admin', items:2, done:0, posted:false, payStatus:'-' },
  ];
  DB.so0418 = {
    no:'SO-1',
    cust:DB.customers[0],
    date:'2024-06-01',
    deliver:'2024-06-03',
    ref:'Canonical demo transaction',
    status:'Closed',
    owner:'Admin',
    warehouse:'WH-SALES',
    currency:'SGD',
    rate:1,
    terms:'Net 30',
    lines:orderLines,
    discountPct:0,
    shipping:0,
    taxRate:0.09,
    billTo:{ name:beta.name, line1:'Singapore demo billing address', line2:'', city:'Singapore', state:'', post:'000000', country:'Singapore', contact:'Accounts Payable', email:'ap@beta.example', tax:'GST demo' },
    shipTo:{ name:beta.name, line1:'Singapore demo warehouse', line2:'', city:'Singapore', state:'', post:'000000', country:'Singapore', contact:'Goods Inwards', email:'receiving@beta.example' },
    note:'Confirmed by ERP-System demo transaction: stock, invoice and GL are committed atomically.',
    memo:'Net S$110.00 + 9% GST S$9.90 = S$119.90.',
  };
  DB.quote0188 = {
    no:'Q-1', cust:beta.name, code:beta.code, owner:'Admin',
    date:'Jun 1, 2024', valid:'Jun 15, 2024', status:'Converted', terms:'Net 30', currency:'SGD', taxRate:0.09, shipping:0,
    contact:{ name:'Accounts Payable', role:'Finance', email:'ap@beta.example' },
    lines:orderLines,
  };
  DB.delivery0204 = {
    no:'DO-1', so:'SO-1', cust:beta.name, code:beta.code,
    date:'Jun 2, 2024', warehouse:'WH-SALES', carrier:'Demo delivery', tracking:'DEMO-DO-1', weight:'-', packages:1, status:'Delivered', eta:'Jun 3, 2024', picker:'Admin',
    lines:orderLines.map((l)=>({ item:l.item, name:l.name, ordered:l.qty, delivered:l.qty, uom:l.uom })),
  };
  DB.invoice0331 = {
    no:'INV-SO-1', so:'SO-1', do:'DO-1', cust:beta.name, code:beta.code,
    date:'Jun 1, 2024', due:'Jul 1, 2024', terms:'Net 30', currency:'SGD', taxRate:0.09, shipping:0,
    status:'Posted', paid:0, owner:'Admin', custBalance:orderTotal, custLimit:beta.limit,
    lines:orderLines,
  };
  DB.quotations = [
    { no:'Q-1', date:'2024-06-01', cust:beta.name, custCode:beta.code, valid:'2024-06-15', owner:'Admin', total:orderTotal, prob:100, status:'Converted', doc:true },
  ];
  DB.deliveries = [
    { no:'DO-1', date:'2024-06-02', cust:beta.name, custCode:beta.code, so:'SO-1', warehouse:'WH-SALES', carrier:'Demo delivery', items:2, done:2, status:'Delivered', doc:true },
  ];
  DB.salesInvoices = [
    { no:'INV-SO-1', date:'2024-06-01', due:'2024-07-01', cust:beta.name, custCode:beta.code, so:'SO-1', total:orderTotal, paid:0, status:'Posted', doc:true },
  ];
  DB.enquiries = [
    { no:'ENQ-1', date:'2026-06-28', cust:beta.name, custCode:beta.code, subject:'Demo reorder enquiry', channel:'Demo', owner:'Admin', value:110, status:'New' },
  ];

  DB.movements = [
    { no:'SM-SO-1-1', date:'2024-06-01 09:00', item:widget.sku, name:widget.name, type:'Goods Issue', ref:'SO-1', qty:-5, bal:95, by:'System', wh:'WH-SALES' },
    { no:'SM-SO-1-2', date:'2024-06-01 09:00', item:gadget.sku, name:gadget.name, type:'Goods Issue', ref:'SO-1', qty:-3, bal:97, by:'System', wh:'WH-SALES' },
  ];
  DB.valuation = [
    { cat:'Finished Goods', items:DB.items.map((it)=>({ sku:it.sku, name:it.name, qty:it.onHand, cost:it.cost })) },
  ];

  DB.coa = [
    { grp:'Assets', accts:[{ code:'1100', name:'Accounts Receivable', mvt:orderTotal, bal:orderTotal, dc:'Dr' }] },
    { grp:'Liabilities', accts:[{ code:'2200', name:'GST Output Tax', mvt:orderTax, bal:orderTax, dc:'Cr' }] },
    { grp:'Income', accts:[{ code:'4000', name:'Revenue', mvt:orderNet, bal:orderNet, dc:'Cr' }] },
  ];
  DB.journals = [
    { no:'INV-SO-1', date:'2024-06-01', memo:'Post sales invoice SO-1', status:'Posted', dr:orderTotal, period:'P06', by:'System' },
  ];
  DB.je0611 = {
    no:'INV-SO-1', date:'2024-06-01', memo:'Post sales invoice SO-1', period:'P06', status:'Posted', by:'System', source:'Sales confirmation',
    lines:[
      { acct:'1100', name:'Accounts Receivable', dr:orderTotal, cr:0, dim:beta.name },
      { acct:'4000', name:'Revenue', dr:0, cr:orderNet, dim:'Sales' },
      { acct:'2200', name:'GST Output Tax', dr:0, cr:orderTax, dim:'GST' },
    ],
  };
  DB.acctLedger = {
    code:'1100', name:'Accounts Receivable', period:'FY2026 · P06', open:0, close:orderTotal,
    rows:[{ date:'Jun 01', je:'INV-SO-1', memo:'Invoice Beta Pte Ltd', dr:orderTotal, cr:0 }],
  };
  DB.bankRec = {
    account:'Demo operating account', period:'June 2026', stmtClose:842000, bookClose:842000,
    lines:[{ date:'Jun 01', desc:'Opening demo balance', amount:842000, je:'OPENING', matched:true }],
  };
  DB.pnl = [
    { grp:'Revenue', kind:'head', rows:[{ name:'Product sales', cur:orderNet, ytd:orderNet, bud:orderNet }], total:'Net revenue' },
    { grp:'Gross profit', kind:'subtotal' },
  ];
  DB.arAging = [
    { cust:beta.name, code:beta.code, cur:orderTotal, b30:0, b60:0, b90:0, b90p:0 },
  ];

  DB.approvals = [
    { no:'SETUP-1', kind:'Company setup wizard', who:'Admin', amt:null, age:'now', risk:'low', route:'settings' },
    { no:'SO-DRAFT-1', kind:'Sales Order Draft', who:'Admin', amt:110, age:'today', risk:'low', route:'sales-orders' },
  ];
  DB.notifications = [
    { id:'erp1', ic:'checkc', clr:'ok', cat:'system', group:'today', title:'ERP-System demo seed loaded', body:'Acme Singapore · GST · SGD · canonical schema mirror.', t:'now', unread:true, route:'dashboard' },
    { id:'erp2', ic:'receipt', clr:'accent', cat:'finance', group:'today', title:'INV-SO-1 posted', body:'S$119.90 balanced to AR, revenue and GST output tax.', t:'now', unread:true, route:'gl' },
  ];

  DB.salesByMonth = [
    { m:'Jan', val:0 }, { m:'Feb', val:0 }, { m:'Mar', val:0 },
    { m:'Apr', val:0 }, { m:'May', val:0 }, { m:'Jun', val:orderNet },
    { m:'Jul', val:220, fc:true }, { m:'Aug', val:330, fc:true },
    { m:'Sep', val:440, fc:true }, { m:'Oct', val:550, fc:true },
    { m:'Nov', val:660, fc:true }, { m:'Dec', val:770, fc:true },
  ];
  DB.salesByRep = [
    { rep:'Admin', sales:orderNet, target:500, deals:1 },
  ];
  DB.topCustomers = [
    { cust:beta.name, custCode:beta.code, ytd:orderNet, share:100 },
  ];

  DB.dashboardMetrics = {
    approvals:DB.approvals.length,
    glIssues:0,
    stockAlerts:DB.items.filter((it)=>it.onHand - it.alloc <= it.reorder).length,
    arOpen:DB.salesInvoices.reduce((sum, inv)=>sum + Math.max(0, inv.total - (inv.paid || 0)), 0),
    openDeliveries:DB.deliveries.filter((d)=>d.status !== 'Delivered' && d.status !== 'Cancelled').length,
    goodsReceipts:0,
    pickTasks:0,
    leaveRequests:0,
    openOrderValue:DB.salesOrders.filter((o)=>o.status !== 'Closed' && o.status !== 'Cancelled').reduce((sum, o)=>sum + o.total, 0),
    cash:842000,
    mtdSales:orderNet,
    cleared:1,
  };

  document.title = 'ERP System - Acme Singapore Demo';
})();
