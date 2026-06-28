/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   admin & platform — roles/permissions, master control (tenants), users, audit log, numbering, tax, currencies, my activity
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ---- admin: roles & permission matrix ---- */
DB.roles = ['Sales Rep','Buyer','Warehouse','Accountant','Approver','Admin'];
DB.permModules = [
  { grp:'Sales', rows:[
    { m:'Sales Orders', p:[2,0,1,1,2,3] },
    { m:'Delivery Orders', p:[1,0,3,1,1,3] },
    { m:'Sales Invoice', p:[1,0,0,3,2,3] },
    { m:'Customer Master', p:[2,0,1,2,1,3] },
  ]},
  { grp:'Purchasing', rows:[
    { m:'Purchase Orders', p:[0,3,1,1,2,3] },
    { m:'Goods Receipt', p:[0,1,3,1,1,3] },
    { m:'Supplier Invoice', p:[0,1,0,3,2,3] },
  ]},
  { grp:'Finance', rows:[
    { m:'Journal Entry', p:[0,0,0,3,2,3] },
    { m:'Post to GL', p:[0,0,0,2,3,3] },
    { m:'Payment Voucher', p:[0,0,0,2,2,3] },
    { m:'Financial Reports', p:[0,0,0,3,1,3] },
  ]},
  { grp:'Inventory', rows:[
    { m:'Stock Adjustment', p:[0,0,2,0,2,3] },
    { m:'Stock Transfer', p:[0,0,3,0,1,3] },
    { m:'Item Cost (view)', p:[0,1,1,3,1,3] },
  ]},
];
/* permission levels: 0 none · 1 view · 2 edit · 3 full */
DB.permLevels = ['None','View','Edit','Full'];

/* ============================================================
   MASTER CONTROL — platform multi-tenancy
   Super Admin → Master accounts (tenants) → Companies (legal
   entities) + Users. Northwind Group (MST-0001) is the signed-in
   tenant; Northwind Manufacturing is its current company.
   ============================================================ */
DB.masters = [
  { id:'MST-0001', name:'Northwind Group', plan:'Enterprise', region:'APAC · Kuala Lumpur', status:'Active', owner:'Dana Reyes', modules:14, current:true,
    companies:[
      { id:'CMP-1001', name:'Northwind Manufacturing', cur:'USD', branches:3, status:'Active', current:true },
      { id:'CMP-1002', name:'Northwind Logistics', cur:'USD', branches:2, status:'Active' },
      { id:'CMP-1003', name:'Northwind Trading (SG)', cur:'SGD', branches:1, status:'Active' },
    ],
    users:[
      { id:'USR-2001', name:'Dana Reyes', email:'dana.reyes@northwind.co', role:'Operations Director', access:'All companies', status:'Active', last:'Online' },
      { id:'USR-2002', name:'Priya Nwosu', email:'p.nwosu@northwind.co', role:'CFO', access:'All companies', status:'Active', last:'2h ago' },
      { id:'USR-2003', name:'James Okafor', email:'j.okafor@northwind.co', role:'Sales User', access:'Manufacturing', status:'Active', last:'12m ago' },
      { id:'USR-2004', name:'Raj Haddad', email:'r.haddad@northwind.co', role:'Purchase User', access:'Mfg · Logistics', status:'Active', last:'1h ago' },
      { id:'USR-2005', name:'Marcus Silva', email:'m.silva@northwind.co', role:'Warehouse User', access:'Manufacturing', status:'Active', last:'30m ago' },
      { id:'USR-2006', name:'Lena Park', email:'l.park@northwind.co', role:'Sales User', access:'Trading (SG)', status:'Suspended', last:'14d ago' },
    ],
  },
  { id:'MST-0002', name:'Apex Industrial Holdings', plan:'Business', region:'APAC · Singapore', status:'Active', owner:'Clarence Lim', modules:10,
    companies:[
      { id:'CMP-2001', name:'Apex Industrial Pte', cur:'SGD', branches:2, status:'Active' },
      { id:'CMP-2002', name:'Apex Components', cur:'SGD', branches:1, status:'Active' },
    ],
    users:[
      { id:'USR-3001', name:'Clarence Lim', email:'c.lim@apex.sg', role:'Admin', access:'All companies', status:'Active', last:'1d ago' },
      { id:'USR-3002', name:'Wei Tan', email:'w.tan@apex.sg', role:'Finance User', access:'All companies', status:'Active', last:'3h ago' },
      { id:'USR-3003', name:'Nadia Yusof', email:'n.yusof@apex.sg', role:'Purchase User', access:'Components', status:'Active', last:'5h ago' },
    ],
  },
  { id:'MST-0003', name:'Coastal Packaging Co', plan:'Business', region:'APAC · Penang', status:'Active', owner:'Mei Tan', modules:8,
    companies:[ { id:'CMP-3001', name:'Coastal Packaging Sdn', cur:'MYR', branches:1, status:'Active' } ],
    users:[
      { id:'USR-4001', name:'Mei Tan', email:'mei@coastalpkg.my', role:'Admin', access:'All companies', status:'Active', last:'4h ago' },
      { id:'USR-4002', name:'Arif Rahman', email:'arif@coastalpkg.my', role:'Sales User', access:'All companies', status:'Active', last:'1d ago' },
    ],
  },
  { id:'MST-0004', name:'Meridian Robotics', plan:'Enterprise', region:'NA · San Francisco', status:'Active', owner:'Elena Marsh', modules:16,
    companies:[
      { id:'CMP-4001', name:'Meridian Robotics Inc', cur:'USD', branches:2, status:'Active' },
      { id:'CMP-4002', name:'Meridian Automation', cur:'USD', branches:1, status:'Active' },
      { id:'CMP-4003', name:'Meridian EU GmbH', cur:'EUR', branches:1, status:'Active' },
    ],
    users:[
      { id:'USR-5001', name:'Elena Marsh', email:'e.marsh@meridian.co', role:'Admin', access:'All companies', status:'Active', last:'20m ago' },
      { id:'USR-5002', name:'David Cho', email:'d.cho@meridian.co', role:'Purchase User', access:'Robotics Inc', status:'Active', last:'2h ago' },
      { id:'USR-5003', name:'Sofia Reyes', email:'s.reyes@meridian.co', role:'Finance User', access:'All companies', status:'Active', last:'6h ago' },
    ],
  },
  { id:'MST-0005', name:'Pinnacle Foods Mfg', plan:'Starter', region:'APAC · Johor', status:'Suspended', owner:'—', modules:5,
    companies:[ { id:'CMP-5001', name:'Pinnacle Foods Sdn', cur:'MYR', branches:1, status:'Suspended' } ],
    users:[
      { id:'USR-6001', name:'Hassan Ali', email:'hassan@pinnaclefoods.my', role:'Admin', access:'All companies', status:'Suspended', last:'30d ago' },
      { id:'USR-6002', name:'Grace Wong', email:'grace@pinnaclefoods.my', role:'Sales User', access:'All companies', status:'Suspended', last:'30d ago' },
    ],
  },
];

/* ===================== ADMIN (users, audit log, system settings) ===================== */
DB.adminUsers = [
  { id:'USR-2001', name:'Dana Reyes', email:'dana.reyes@northwind.co', role:'Admin', status:'Active', mfa:true, last:'2m ago', av:'DR', clr:'#FF9500' },
  { id:'USR-2002', name:'Aisha Rahman', email:'a.rahman@northwind.co', role:'Finance User', status:'Active', mfa:true, last:'1h ago', av:'AR', clr:'#ff375f' },
  { id:'USR-2003', name:'Raj Haddad', email:'r.haddad@northwind.co', role:'Purchase User', status:'Active', mfa:true, last:'3h ago', av:'RH', clr:'#7b46d3' },
  { id:'USR-2004', name:'Lena Park', email:'l.park@northwind.co', role:'Sales User', status:'Active', mfa:false, last:'Yesterday', av:'LP', clr:'#ff9500' },
  { id:'USR-2005', name:'Marcus Silva', email:'m.silva@northwind.co', role:'Warehouse User', status:'Active', mfa:true, last:'4h ago', av:'MS', clr:'#0a84ff' },
  { id:'USR-2006', name:'Aisha Karim', email:'a.karim@northwind.co', role:'Manager', status:'Active', mfa:true, last:'30m ago', av:'AK', clr:'#0B6E7C' },
  { id:'USR-2007', name:'Samuel Boateng', email:'s.boateng@northwind.co', role:'Sales User', status:'Invited', mfa:false, last:'Never', av:'SB', clr:'#9A6712' },
  { id:'USR-2008', name:'Priya Nathan', email:'p.nathan@northwind.co', role:'Manager', status:'Active', mfa:true, last:'2d ago', av:'PN', clr:'#6536BE' },
  { id:'USR-2009', name:'Tom Becker', email:'t.becker@northwind.co', role:'Approver', status:'Disabled', mfa:false, last:'30d ago', av:'TB', clr:'#34c759' },
  { id:'USR-2010', name:'External Auditor', email:'audit@kpmg.example', role:'Auditor', status:'Active', mfa:true, last:'1d ago', av:'EA', clr:'#4E5A68' },
];
DB.auditLog = [
  { t:'14:42:08', user:'Dana Reyes', action:'Approved purchase order', obj:'PO-26-0291', type:'approval', ip:'10.0.4.21', ok:true },
  { t:'14:31:55', user:'Aisha Rahman', action:'Posted journal to GL', obj:'JE-26-0611', type:'post', ip:'10.0.4.08', ok:true },
  { t:'14:18:30', user:'External Auditor', action:'Exported financial report', obj:'P&L · FY2026', type:'export', ip:'203.12.9.44', ok:true },
  { t:'13:55:12', user:'Raj Haddad', action:'Edited supplier price', obj:'S-0140 · NW-1180', type:'edit', ip:'10.0.4.31', ok:true },
  { t:'13:40:02', user:'Samuel Boateng', action:'Failed login (bad password)', obj:'—', type:'security', ip:'88.21.4.119', ok:false },
  { t:'13:22:47', user:'Dana Reyes', action:'Changed role permission', obj:'Sales User · Edit→Full', type:'permission', ip:'10.0.4.21', ok:true },
  { t:'12:58:19', user:'Lena Park', action:'Created sales order', obj:'SO-26-0418', type:'create', ip:'10.0.4.55', ok:true },
  { t:'12:30:41', user:'System', action:'Auto-matched bank statement', obj:'GRN-26-0188', type:'system', ip:'—', ok:true },
  { t:'11:47:09', user:'Marcus Silva', action:'Posted goods receipt', obj:'GRN-26-0188', type:'post', ip:'10.0.7.12', ok:true },
  { t:'11:20:55', user:'Aisha Rahman', action:'Locked period P05', obj:'FY2026 · P05', type:'config', ip:'10.0.4.08', ok:true },
  { t:'10:05:33', user:'Tom Becker', action:'Account disabled by admin', obj:'USR-2009', type:'security', ip:'10.0.4.21', ok:true },
  { t:'09:12:00', user:'Dana Reyes', action:'Signed in', obj:'—', type:'security', ip:'10.0.4.21', ok:true },
];
DB.numbering = [
  { doc:'Sales Order', prefix:'SO', format:'SO-{YY}-{####}', next:419, reset:'Yearly' },
  { doc:'Sales Invoice', prefix:'INV', format:'INV-{YY}-{####}', next:332, reset:'Yearly' },
  { doc:'Purchase Order', prefix:'PO', format:'PO-{YY}-{####}', next:292, reset:'Yearly' },
  { doc:'Goods Receipt', prefix:'GRN', format:'GRN-{YY}-{####}', next:189, reset:'Yearly' },
  { doc:'Journal Entry', prefix:'JE', format:'JE-{YY}-{####}', next:612, reset:'Never' },
  { doc:'Payment Voucher', prefix:'PV', format:'PV-{YY}-{####}', next:204, reset:'Yearly' },
];
DB.taxCodes = [
  { code:'SR', name:'Standard-rated GST', rate:6.0, type:'Output', status:'Active' },
  { code:'ZR', name:'Zero-rated (export)', rate:0.0, type:'Output', status:'Active' },
  { code:'TX', name:'Input tax — purchases', rate:6.0, type:'Input', status:'Active' },
  { code:'EX', name:'Exempt supply', rate:0.0, type:'Output', status:'Active' },
  { code:'WHT', name:'Withholding tax — services', rate:10.0, type:'Withholding', status:'Active' },
];
DB.currencies = [
  { code:'USD', name:'US Dollar', rate:1.0000, base:true },
  { code:'MYR', name:'Malaysian Ringgit', rate:4.7120, base:false },
  { code:'EUR', name:'Euro', rate:0.9230, base:false },
  { code:'SGD', name:'Singapore Dollar', rate:1.3480, base:false },
  { code:'CNY', name:'Chinese Yuan', rate:7.2410, base:false },
];

/* ===================== MY ACTIVITY (personal account log) ===================== */
DB.myActivity = {
  stats:{ today:14, week:73, period:312 },
  summary:[
    { k:'Approvals', v:18, d:'14 PO · 3 leave · 1 expense' },
    { k:'Postings', v:9, d:'GL, GRN & depreciation' },
    { k:'Edits', v:26, d:'across 11 documents' },
    { k:'Comments', v:12, d:'7 threads, 4 @mentions' },
  ],
  byModule:[
    { m:'Purchasing', ct:24 },
    { m:'Finance', ct:18 },
    { m:'Sales', ct:14 },
    { m:'Inventory', ct:9 },
    { m:'HR', ct:5 },
    { m:'Reports', ct:3 },
  ],
  sessions:[
    { device:'MacBook Pro 16″', meta:'Chrome 126 · macOS 14', loc:'Kuala Lumpur, MY', ip:'10.0.4.21', last:'Active now', current:true },
    { device:'iPhone 15 Pro', meta:'Aria for iOS 3.4', loc:'Kuala Lumpur, MY', ip:'10.0.6.88', last:'2 hours ago', current:false },
    { device:'Windows 11', meta:'Edge 126', loc:'Singapore, SG', ip:'203.12.9.44', last:'Yesterday, 18:20', current:false, flag:'Unrecognised location' },
  ],
  security:{ password:'Changed 42 days ago', mfa:'Authenticator app', recovery:'2 codes remaining' },
  feed:[
    { day:'Today', date:'Thursday, June 18', items:[
      { type:'approve', what:'Approved purchase order', obj:'PO-26-0291', sub:'Apex Industrial Supplies · $128,400', route:'po-approval', time:'14:42' },
      { type:'post', what:'Posted journal to General Ledger', obj:'JE-26-0611', sub:'Period FY2026 · P06 · balanced', route:'journal-entry', time:'14:31' },
      { type:'comment', what:'Commented on sales order', obj:'SO-26-0418', sub:'“@Lena Park can we still expedite line 3?”', route:'sales-orders', time:'13:58' },
      { type:'edit', what:'Edited credit limit', obj:'Atlas Components Ltd', sub:'Customer master', route:'sales-orders', time:'13:20', chg:{ field:'Credit limit', old:'$80,000', new:'$120,000' } },
      { type:'approve', what:'Approved leave request', obj:'Marcus Silva', sub:'Annual leave · 3 working days', route:'leave-approval', time:'11:05' },
      { type:'reject', what:'Rejected purchase requisition', obj:'PR-26-0177', sub:'Over budget line — returned to requester', route:'purchase-orders', time:'10:40' },
      { type:'export', what:'Exported Sales Analysis', obj:'FY2026 · P06', sub:'XLSX · 3.2 MB', route:'sales-analysis', time:'09:32' },
      { type:'login', what:'Signed in', obj:'', sub:'Chrome · macOS · Kuala Lumpur', route:'', time:'08:58' },
    ]},
    { day:'Yesterday', date:'Wednesday, June 17', items:[
      { type:'create', what:'Created sales order', obj:'SO-26-0418', sub:'Northstar Retail · $42,180', route:'sales-orders', time:'17:10' },
      { type:'post', what:'Posted goods receipt', obj:'GRN-26-0142', sub:'12 lines · 3 partial', route:'purchase-orders', time:'15:44' },
      { type:'approve', what:'Approved purchase order', obj:'PO-26-0288', sub:'Meridian Fasteners · $9,640', route:'po-approval', time:'11:22' },
      { type:'edit', what:'Updated reorder point', obj:'NW-1180 · Hex bolt M8', sub:'Inventory item', route:'stock-on-hand', time:'10:15', chg:{ field:'Reorder point', old:'200', new:'350' } },
      { type:'comment', what:'Replied on picking task', obj:'PICK-26-0090', sub:'“Bin C-12 short by 40 — substitute approved.”', route:'picking', time:'09:20' },
    ]},
    { day:'Tuesday, June 16', date:'', items:[
      { type:'approve', what:'Approved 3 purchase orders', obj:'Batch · $61,300', sub:'Routine — within budget', route:'purchase-orders', time:'16:30' },
      { type:'post', what:'Posted depreciation run', obj:'FA-26-06', sub:'48 assets · $14,920', route:'dashboard', time:'14:00' },
      { type:'export', what:'Exported audit trail', obj:'Today’s log', sub:'PDF · immutable', route:'audit-log', time:'11:30' },
      { type:'login', what:'Signed in', obj:'', sub:'Aria for iOS · iPhone 15 Pro', route:'', time:'08:40' },
    ]},
  ],
};
