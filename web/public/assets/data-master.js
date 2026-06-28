/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   master data — inventory items, customers, suppliers, valuation, stock movements, warehouse picking
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ---- inventory items ---- */
DB.items = [
  { sku:'NW-1042', name:'Hydraulic Pump Assembly', cat:'Components', uom:'ea', onHand:88, alloc:36, reorder:40, roq:120, cost:248.00, status:'In stock', bins:[['A-01-03',52],['A-02-11',36]] },
  { sku:'NW-2271', name:'Stainless Steel Sheet 2mm', cat:'Raw Materials', uom:'sheet', onHand:14, alloc:10, reorder:30, roq:200, cost:42.50, status:'Low', bins:[['B-04-01',14]] },
  { sku:'NW-3310', name:'Industrial Bearing 6204', cat:'Components', uom:'ea', onHand:640, alloc:120, reorder:200, roq:500, cost:6.80, status:'In stock', bins:[['A-03-07',400],['A-03-08',240]] },
  { sku:'NW-1180', name:'Control Module PCB v3', cat:'Components', uom:'ea', onHand:0, alloc:24, reorder:50, roq:150, cost:118.00, status:'Backordered', bins:[] },
  { sku:'NW-4402', name:'Aluminium Extrusion 40×40', cat:'Raw Materials', uom:'m', onHand:312, alloc:48, reorder:150, roq:600, cost:9.20, status:'In stock', bins:[['B-01-02',180],['B-01-03',132]] },
  { sku:'NW-5500', name:'Pneumatic Cylinder 32mm', cat:'Components', uom:'ea', onHand:46, alloc:42, reorder:35, roq:100, cost:74.00, status:'Reorder', bins:[['A-05-02',46]] },
  { sku:'NW-9001', name:'Conveyor Drive Unit', cat:'Finished Goods', uom:'ea', onHand:23, alloc:9, reorder:10, roq:30, cost:1240.00, status:'In stock', bins:[['C-01-01',23]] },
  { sku:'NW-9002', name:'Packaging Line — Model X', cat:'Finished Goods', uom:'ea', onHand:6, alloc:5, reorder:3, roq:8, cost:8650.00, status:'In stock', bins:[['C-02-01',6]] },
  { sku:'NW-7720', name:'Epoxy Resin Compound', cat:'Consumables', uom:'L', onHand:8, alloc:0, reorder:25, roq:120, cost:14.30, status:'Low', bins:[['D-01-04',8]], expiry:'2026-09-30' },
  { sku:'NW-6610', name:'Carton Box 600×400×300', cat:'Packaging', uom:'ea', onHand:1840, alloc:200, reorder:500, roq:2000, cost:1.05, status:'In stock', bins:[['E-02-01',1840]] },
  { sku:'NW-3315', name:'Industrial Bearing 6206', cat:'Components', uom:'ea', onHand:122, alloc:88, reorder:120, roq:400, cost:9.40, status:'Reorder', bins:[['A-03-09',122]] },
];

/* ---- partners ---- */
DB.customers = [
  { code:'C-0007', name:'Meridian Robotics', terms:'Net 30', limit:250000, balance:184200, overdue:32400, status:'Active' },
  { code:'C-0012', name:'Apex Industrial Group', terms:'Net 45', limit:500000, balance:212800, overdue:0, status:'Active' },
  { code:'C-0021', name:'Coastal Packaging Co', terms:'Net 30', limit:120000, balance:118600, overdue:14200, status:'Active' },
  { code:'C-0033', name:'Tycho Automation', terms:'Net 60', limit:300000, balance:96400, overdue:0, status:'Active' },
  { code:'C-0044', name:'Pinnacle Foods Mfg', terms:'COD', limit:80000, balance:0, overdue:0, status:'On hold' },
];
DB.suppliers = [
  { code:'S-0102', name:'Daido Precision Ltd', terms:'Net 30', balance:64200, status:'Active' },
  { code:'S-0118', name:'EuroSteel Trading', terms:'Net 45', balance:128400, status:'Active' },
  { code:'S-0140', name:'Shenzhen Microcircuit', terms:'Net 30', balance:41800, status:'Active' },
  { code:'S-0155', name:'AlumaTech Profiles', terms:'Net 30', balance:22600, status:'Active' },
];

/* ---- stock movements (ledger) ---- */
DB.movements = [
  { no:'SM-26-3814', date:'2026-06-04 14:22', item:'NW-1042', name:'Hydraulic Pump Assembly', type:'Goods Issue', ref:'DO-26-0402', qty:-24, bal:88, by:'M. Silva', wh:'KL-Main' },
  { no:'SM-26-3813', date:'2026-06-04 11:08', item:'NW-3310', name:'Industrial Bearing 6204', type:'Goods Receipt', ref:'GRN-26-0188', qty:+500, bal:640, by:'System', wh:'KL-Main' },
  { no:'SM-26-3812', date:'2026-06-04 09:41', item:'NW-2271', name:'Stainless Steel Sheet 2mm', type:'Adjustment', ref:'ADJ-26-0044', qty:-6, bal:14, by:'Dana Reyes', wh:'KL-Main' },
  { no:'SM-26-3811', date:'2026-06-03 16:55', item:'NW-5500', name:'Pneumatic Cylinder 32mm', type:'Transfer Out', ref:'WT-26-0091', qty:-20, bal:46, by:'J. Okafor', wh:'KL-Main' },
  { no:'SM-26-3810', date:'2026-06-03 16:55', item:'NW-5500', name:'Pneumatic Cylinder 32mm', type:'Transfer In', ref:'WT-26-0091', qty:+20, bal:20, by:'J. Okafor', wh:'Penang-2' },
  { no:'SM-26-3809', date:'2026-06-03 10:14', item:'NW-9001', name:'Conveyor Drive Unit', type:'FG Receipt', ref:'WO-26-0077', qty:+8, bal:23, by:'System', wh:'KL-Main' },
  { no:'SM-26-3808', date:'2026-06-02 15:30', item:'NW-4402', name:'Aluminium Extrusion 40×40', type:'Goods Issue', ref:'MI-26-0211', qty:-48, bal:312, by:'System', wh:'KL-Main' },
  { no:'SM-26-3807', date:'2026-06-02 09:02', item:'NW-6610', name:'Carton Box 600×400×300', type:'Goods Receipt', ref:'GRN-26-0187', qty:+2000, bal:1840, by:'System', wh:'KL-Main' },
];

/* ---- warehouse pick list ---- */
DB.pickList = {
  no:'PK-26-0517', order:'SO-26-0416 · Tycho Automation', wave:'Wave 12 · Morning', assignee:'Marcus Silva', priority:'High',
  lines:[
    { bin:'A-01-03', item:'NW-1042', name:'Hydraulic Pump Assembly', qty:6, picked:6, uom:'ea' },
    { bin:'A-03-07', item:'NW-3310', name:'Industrial Bearing 6204', qty:40, picked:40, uom:'ea' },
    { bin:'A-05-02', item:'NW-5500', name:'Pneumatic Cylinder 32mm', qty:12, picked:0, uom:'ea' },
    { bin:'B-01-02', item:'NW-4402', name:'Aluminium Extrusion 40×40', qty:24, picked:0, uom:'m' },
    { bin:'C-01-01', item:'NW-9001', name:'Conveyor Drive Unit', qty:2, picked:0, uom:'ea' },
  ],
};

/* ---- inventory valuation (report) ---- */
DB.valuation = [
  { cat:'Components', items:[
    { sku:'NW-1042', name:'Hydraulic Pump Assembly', qty:88, cost:248.00 },
    { sku:'NW-3310', name:'Industrial Bearing 6204', qty:640, cost:6.80 },
    { sku:'NW-5500', name:'Pneumatic Cylinder 32mm', qty:46, cost:74.00 },
    { sku:'NW-3315', name:'Industrial Bearing 6206', qty:122, cost:9.40 },
    { sku:'NW-1180', name:'Control Module PCB v3', qty:0, cost:118.00 },
  ]},
  { cat:'Raw Materials', items:[
    { sku:'NW-2271', name:'Stainless Steel Sheet 2mm', qty:14, cost:42.50 },
    { sku:'NW-4402', name:'Aluminium Extrusion 40×40', qty:312, cost:9.20 },
  ]},
  { cat:'Finished Goods', items:[
    { sku:'NW-9001', name:'Conveyor Drive Unit', qty:23, cost:1240.00 },
    { sku:'NW-9002', name:'Packaging Line — Model X', qty:6, cost:8650.00 },
  ]},
  { cat:'Packaging & Consumables', items:[
    { sku:'NW-6610', name:'Carton Box 600×400×300', qty:1840, cost:1.05 },
    { sku:'NW-7720', name:'Epoxy Resin Compound', qty:8, cost:14.30 },
  ]},
];
