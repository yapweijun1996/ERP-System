/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   reporting / BI — KPIs, revenue trend & mix, top customers, sales analysis, stock aging
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ===================== REPORTING / BI (dashboard, sales analysis, stock aging) ===================== */
DB.biKpis = {
  revenueYtd:5347800, revenueDelta:8.4,
  marginPct:45.6, marginDelta:1.1,
  openOrders:398000, ordersDelta:-3.2,
  cash:1160700, cashDelta:12.0,
};
DB.revTrend = [382,401,418,372,455,470,438,492,476,510,498,534]; // trailing 12 months, $k
DB.revMonths = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
DB.revBySegment = [
  { name:'Industrial Automation', value:2240000, clr:'var(--accent)' },
  { name:'Components & Parts', value:1480000, clr:'var(--teal)' },
  { name:'Service & Contracts', value:612000, clr:'var(--violet)' },
  { name:'Spare Parts', value:548000, clr:'var(--ok)' },
  { name:'Custom Projects', value:468000, clr:'var(--warn)' },
];
DB.topCustomers = [
  { name:'Meridian Robotics', value:486000 },
  { name:'Apex Industrial', value:412000 },
  { name:'Orion Aerospace', value:318000 },
  { name:'Delta Process Systems', value:264000 },
  { name:'Vertex Machine Tools', value:198000 },
];
DB.salesAnalysis = {
  byCategory:[
    { name:'Drive Units', revenue:1284000, units:842, margin:38.2 },
    { name:'Hydraulics', revenue:864000, units:2760, margin:41.0 },
    { name:'Bearings', revenue:612000, units:48200, margin:33.5 },
    { name:'Pneumatics', revenue:486000, units:5120, margin:36.8 },
    { name:'Extrusion & Frame', revenue:398000, units:18400, margin:29.4 },
    { name:'Packaging', revenue:142000, units:96000, margin:22.1 },
  ],
};
DB.stockAging = [
  { grp:'0–30 days', tone:'ok', items:[
    { sku:'NW-3310', name:'Industrial Bearing 6204', qty:640, value:4352 },
    { sku:'NW-1042', name:'Hydraulic Pump Assembly', qty:88, value:21824 },
    { sku:'NW-4402', name:'Aluminium Extrusion 40×40', qty:264, value:3538 },
  ]},
  { grp:'31–60 days', tone:'accent', items:[
    { sku:'NW-6610', name:'Carton Box 600×400×300', qty:1640, value:3034 },
    { sku:'NW-9001', name:'Conveyor Drive Unit', qty:14, value:20720 },
  ]},
  { grp:'61–90 days', tone:'warn', items:[
    { sku:'NW-2271', name:'Stainless Steel Sheet 2mm', qty:14, value:595 },
    { sku:'NW-3315', name:'Industrial Bearing 6206', qty:420, value:3948 },
  ]},
  { grp:'90+ days · slow movers', tone:'danger', items:[
    { sku:'NW-5500', name:'Pneumatic Cylinder 32mm', qty:46, value:4416 },
    { sku:'NW-7720', name:'Legacy Controller v1', qty:62, value:18600 },
    { sku:'NW-8810', name:'Obsolete Sensor Kit', qty:130, value:9100 },
  ]},
];
