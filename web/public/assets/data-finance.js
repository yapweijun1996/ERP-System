/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   finance — journals, chart of accounts, account ledger, bank rec, P&L, AR aging
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ---- journal entries ---- */
DB.journals = [
  { no:'JE-26-0612', date:'2026-06-04', memo:'June payroll accrual', status:'Posted', dr:128400, period:'P06', by:'P. Nwosu' },
  { no:'JE-26-0611', date:'2026-06-04', memo:'FX revaluation — EUR payables', status:'Pending Approval', dr:4280, period:'P06', by:'A. Costa' },
  { no:'JE-26-0610', date:'2026-06-03', memo:'Depreciation run — June', status:'Posted', dr:18650, period:'P06', by:'System' },
  { no:'JE-26-0609', date:'2026-06-02', memo:'Reclass — freight to COGS', status:'Draft', dr:2140, period:'P06', by:'A. Costa' },
  { no:'JE-26-0608', date:'2026-05-31', memo:'May close — accruals', status:'Posted', dr:96200, period:'P05', by:'P. Nwosu', locked:true },
];
DB.je0611 = {
  no:'JE-26-0611', date:'2026-06-04', memo:'FX revaluation — EUR payables', period:'P06', status:'Pending Approval', by:'A. Costa', source:'Auto · FX engine',
  lines:[
    { acct:'2100', name:'Accounts Payable — EUR', dr:0, cr:4280.00, dim:'EuroSteel' },
    { acct:'7820', name:'FX Loss (unrealised)', dr:4280.00, cr:0, dim:'Finance' },
  ],
};

/* ===================== FINANCE depth (GL, ledger, bank rec, P&L, AR aging) ===================== */
DB.coa = [
  { grp:'Assets', accts:[
    { code:'1000', name:'Cash at bank — HSBC Operating', mvt:128400, bal:842300, dc:'Dr' },
    { code:'1010', name:'Cash at bank — CIMB MYR', mvt:-42100, bal:318400, dc:'Dr' },
    { code:'1100', name:'Accounts Receivable', mvt:96200, bal:1284500, dc:'Dr' },
    { code:'1200', name:'Inventory — Raw materials', mvt:18600, bal:642800, dc:'Dr' },
    { code:'1210', name:'Inventory — Work in progress', mvt:-9400, bal:188200, dc:'Dr' },
    { code:'1220', name:'Inventory — Finished goods', mvt:24100, bal:421600, dc:'Dr' },
    { code:'1500', name:'Property, plant & equipment', mvt:0, bal:3120000, dc:'Dr' },
    { code:'1510', name:'Accumulated depreciation', mvt:-23700, bal:980400, dc:'Cr' },
  ]},
  { grp:'Liabilities', accts:[
    { code:'2000', name:'Accounts Payable', mvt:-58200, bal:712300, dc:'Cr' },
    { code:'2100', name:'GST / Tax payable', mvt:12800, bal:96400, dc:'Cr' },
    { code:'2200', name:'Accrued payroll', mvt:4200, bal:142800, dc:'Cr' },
    { code:'2500', name:'Bank loan — term', mvt:-18000, bal:1250000, dc:'Cr' },
  ]},
  { grp:'Equity', accts:[
    { code:'3000', name:'Share capital', mvt:0, bal:1000000, dc:'Cr' },
    { code:'3100', name:'Retained earnings', mvt:0, bal:1860000, dc:'Cr' },
  ]},
  { grp:'Income', accts:[
    { code:'4000', name:'Sales — Products', mvt:486200, bal:4820000, dc:'Cr' },
    { code:'4100', name:'Sales — Service & contracts', mvt:54800, bal:612000, dc:'Cr' },
    { code:'4900', name:'Sales returns & allowances', mvt:6200, bal:84200, dc:'Dr' },
  ]},
  { grp:'Expenses', accts:[
    { code:'5000', name:'Cost of goods sold', mvt:291000, bal:2910000, dc:'Dr' },
    { code:'6000', name:'Salaries & wages', mvt:96200, bal:962000, dc:'Dr' },
    { code:'6100', name:'Rent & utilities', mvt:18400, bal:184000, dc:'Dr' },
    { code:'6200', name:'Depreciation expense', mvt:23700, bal:142000, dc:'Dr' },
    { code:'6300', name:'Marketing & selling', mvt:14200, bal:96400, dc:'Dr' },
    { code:'6900', name:'Other operating expense', mvt:7800, bal:78200, dc:'Dr' },
  ]},
];
DB.acctLedger = {
  code:'1000', name:'Cash at bank — HSBC Operating', period:'FY2026 · P06', open:713900, close:842300,
  rows:[
    { date:'Jun 02', je:'JE-26-0588', memo:'Customer receipt — Apex Industrial', dr:48200, cr:0 },
    { date:'Jun 04', je:'PV-26-0203', memo:'Supplier payment — Shenzhen Microcircuit', dr:0, cr:42600 },
    { date:'Jun 07', je:'JE-26-0594', memo:'Customer receipt — Meridian Robotics', dr:97200, cr:0 },
    { date:'Jun 10', je:'JE-26-0601', memo:'Payroll run — June H1', dr:0, cr:88400 },
    { date:'Jun 12', je:'JE-26-0605', memo:'Customer receipt — Delta Process', dr:31500, cr:0 },
    { date:'Jun 15', je:'PV-26-0208', memo:'Utilities & rent — June', dr:0, cr:18400 },
    { date:'Jun 18', je:'JE-26-0611', memo:'Customer receipt — Harbor Freight', dr:64800, cr:0 },
    { date:'Jun 19', je:'JE-26-0613', memo:'Bank charges & FX', dr:0, cr:1700 },
  ],
};
DB.bankRec = {
  account:'Cash at bank — HSBC Operating ••4021', period:'June 2026', stmtClose:840600, bookClose:842300,
  lines:[
    { date:'Jun 18', desc:'INWARD TT — Harbor Freight Co.', amount:64800, je:'JE-26-0611', matched:true },
    { date:'Jun 15', desc:'DIRECT DEBIT — TNB Utilities', amount:-12200, je:'PV-26-0208', matched:true },
    { date:'Jun 15', desc:'STANDING ORDER — KL HQ Rent', amount:-6200, je:'PV-26-0208', matched:true },
    { date:'Jun 12', desc:'INWARD TT — Delta Process Systems', amount:31500, je:'JE-26-0605', matched:true },
    { date:'Jun 10', desc:'PAYROLL — June H1 (88 staff)', amount:-88400, je:'JE-26-0601', matched:true },
    { date:'Jun 19', desc:'BANK CHARGE — wire & facility fee', amount:-5100, je:null, matched:false },
    { date:'Jun 20', desc:'INTEREST CREDIT — operating a/c', amount:3400, je:null, matched:false },
  ],
};
DB.arAging = [
  { cust:'Meridian Robotics', code:'CUST-0007', cur:84200, b30:46600, b60:0, b90:0, b90p:0 },
  { cust:'Apex Industrial', code:'CUST-0102', cur:118400, b30:22100, b60:14600, b90:0, b90p:0 },
  { cust:'Delta Process Systems', code:'CUST-0210', cur:64800, b30:0, b60:0, b90:0, b90p:0 },
  { cust:'Harbor Freight Co.', code:'CUST-0044', cur:12200, b30:8400, b60:0, b90:9200, b90p:6800 },
  { cust:'Pinnacle Foods Sdn', code:'CUST-0188', cur:0, b30:0, b60:18200, b90:11400, b90p:24600 },
  { cust:'Orion Aerospace', code:'CUST-0231', cur:96400, b30:31200, b60:0, b90:0, b90p:0 },
  { cust:'Vertex Machine Tools', code:'CUST-0119', cur:42800, b30:16400, b60:8600, b90:0, b90p:0 },
];
