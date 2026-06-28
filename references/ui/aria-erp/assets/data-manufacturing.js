/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   manufacturing — work orders, the open work order, BOM, MRP
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ============================================================
   MANUFACTURING — work orders, BOM, routing, MRP
   Narrative spine: WO-26-0081 builds 15× Conveyor Drive Unit (NW-9001)
   but is blocked on NW-1180 Control Module PCB (0 on hand) — exactly the
   item that PO-26-0291 (pending your approval) is inbound to replenish.
   ============================================================ */
DB.workOrders = [
  { no:'WO-26-0082', fg:'NW-9001', product:'Conveyor Drive Unit', rev:'Rev C', qty:20, start:'2026-06-26', due:'2026-07-02', status:'Planned', progress:0, matReady:false, planner:'T. Becker', wc:'Assembly Line 1' },
  { no:'WO-26-0081', fg:'NW-9001', product:'Conveyor Drive Unit', rev:'Rev C', qty:15, start:'2026-06-05', due:'2026-06-24', status:'In Progress', progress:40, matReady:false, planner:'T. Becker', wc:'Assembly Line 1', flag:'Blocked — Control Module PCB short 15 ea' },
  { no:'WO-26-0080', fg:'NW-9002', product:'Packaging Line — Model X', rev:'Rev A', qty:3, start:'2026-06-08', due:'2026-06-28', status:'Released', progress:0, matReady:true, planner:'T. Becker', wc:'Assembly Line 2' },
  { no:'WO-26-0079', fg:'NW-9001', product:'Conveyor Drive Unit', rev:'Rev C', qty:10, start:'2026-06-02', due:'2026-06-19', status:'In Progress', progress:70, matReady:true, planner:'L. Park', wc:'Assembly Line 1' },
  { no:'WO-26-0078', fg:'NW-1042', product:'Hydraulic Pump Assembly', rev:'Rev B', qty:40, start:'2026-05-29', due:'2026-06-16', status:'Completed', progress:100, matReady:true, planner:'L. Park', wc:'Sub-assembly' },
  { no:'WO-26-0077', fg:'NW-9001', product:'Conveyor Drive Unit', rev:'Rev C', qty:8, start:'2026-05-26', due:'2026-06-10', status:'Completed', progress:100, matReady:true, planner:'T. Becker', wc:'Assembly Line 1' },
  { no:'WO-26-0076', fg:'NW-9002', product:'Packaging Line — Model X', rev:'Rev A', qty:2, start:'2026-05-22', due:'2026-06-06', status:'Completed', progress:100, matReady:true, planner:'T. Becker', wc:'Assembly Line 2' },
];

/* the open work order document (WO-26-0081) */
DB.wo0081 = {
  no:'WO-26-0081', fg:'NW-9001', product:'Conveyor Drive Unit', rev:'Rev C', qty:15, uom:'ea',
  start:'2026-06-05', due:'2026-06-24', warehouse:'KL-Main', planner:'T. Becker', status:'In Progress', progress:40,
  demand:'Replenishment + SO-26-0417 (Apex Industrial)',
  labourRate:36.00, overheadPct:75,
  // material requirements: qtyPer × qty, with what is already issued and live availability
  materials:[
    { item:'NW-1042', name:'Hydraulic Pump Assembly', qtyPer:1, uom:'ea', cost:248.00, avail:52, issued:15 },
    { item:'NW-3310', name:'Industrial Bearing 6204', qtyPer:4, uom:'ea', cost:6.80, avail:520, issued:60 },
    { item:'NW-4402', name:'Aluminium Extrusion 40×40', qtyPer:2.5, uom:'m', cost:9.20, avail:264, issued:37.5 },
    { item:'NW-1180', name:'Control Module PCB v3', qtyPer:1, uom:'ea', cost:118.00, avail:0, issued:0 },
    { item:'NW-3315', name:'Industrial Bearing 6206', qtyPer:2, uom:'ea', cost:9.40, avail:34, issued:30 },
    { item:'NW-6610', name:'Carton Box 600×400×300', qtyPer:1, uom:'ea', cost:1.05, avail:1640, issued:0 },
  ],
  // routing / operations
  operations:[
    { seq:10, name:'Frame Assembly', wc:'WC-10 · Mechanical', hrs:4.5, status:'Completed' },
    { seq:20, name:'Bearing & Shaft Fit', wc:'WC-20 · Mechanical', hrs:3.0, status:'In Progress' },
    { seq:30, name:'Control Module Install', wc:'WC-30 · Electrical', hrs:2.25, status:'Blocked' },
    { seq:40, name:'Function Test & QC', wc:'WC-40 · Test Bench', hrs:2.0, status:'Pending' },
    { seq:50, name:'Pack & Label', wc:'WC-50 · Packing', hrs:1.0, status:'Pending' },
  ],
};

/* Bill of Materials — Conveyor Drive Unit (NW-9001), Rev C */
DB.bom = {
  fg:'NW-9001', product:'Conveyor Drive Unit', rev:'Rev C', effective:'2026-04-01', qtyPer:1, uom:'ea', status:'Active',
  stdCost:1240.00,
  components:[
    { item:'NW-1042', name:'Hydraulic Pump Assembly', cat:'Sub-assembly', qty:1, uom:'ea', cost:248.00, scrap:0 },
    { item:'NW-3310', name:'Industrial Bearing 6204', cat:'Component', qty:4, uom:'ea', cost:6.80, scrap:2 },
    { item:'NW-4402', name:'Aluminium Extrusion 40×40', cat:'Raw Material', qty:2.5, uom:'m', cost:9.20, scrap:5 },
    { item:'NW-1180', name:'Control Module PCB v3', cat:'Component', qty:1, uom:'ea', cost:118.00, scrap:0 },
    { item:'NW-3315', name:'Industrial Bearing 6206', cat:'Component', qty:2, uom:'ea', cost:9.40, scrap:2 },
    { item:'NW-6610', name:'Carton Box 600×400×300', cat:'Packaging', qty:1, uom:'ea', cost:1.05, scrap:0 },
  ],
  whereUsed:[
    { no:'WO-26-0081', label:'Work order — 15 ea', meta:'In Progress', status:'In Progress' },
    { no:'WO-26-0079', label:'Work order — 10 ea', meta:'In Progress', status:'In Progress' },
    { no:'SO-26-0417', label:'Sales order — Apex Industrial', meta:'2 ea on order', status:'Approved' },
  ],
};

/* MRP — material requirements / net position driving procurement & WOs */
DB.mrp = [
  { item:'NW-1180', name:'Control Module PCB v3', demand:'WO-26-0081 + open SO', gross:39, onHand:0, onOrder:300, net:261, action:'PO-26-0291 pending approval', tone:'warn', route:'po-approval' },
  { item:'NW-2271', name:'Stainless Steel Sheet 2mm', demand:'Below reorder point', gross:30, onHand:14, onOrder:0, net:-16, action:'Raise PO · 200 sheet', tone:'danger', route:'purchase-orders' },
  { item:'NW-7720', name:'Epoxy Resin Compound', demand:'Below reorder point', gross:25, onHand:8, onOrder:0, net:-17, action:'Raise PO · 120 L', tone:'danger', route:'purchase-orders' },
  { item:'NW-3315', name:'Industrial Bearing 6206', demand:'WO-26-0081 + alloc', gross:118, onHand:122, onOrder:0, net:4, action:'Monitor — tight cover', tone:'warn', route:'stock-on-hand' },
  { item:'NW-5500', name:'Pneumatic Cylinder 32mm', demand:'Open allocations', gross:42, onHand:46, onOrder:0, net:4, action:'Monitor', tone:'warn', route:'stock-on-hand' },
  { item:'NW-3310', name:'Industrial Bearing 6204', demand:'WO-26-0081', gross:60, onHand:520, onOrder:0, net:460, action:'Sufficient', tone:'ok', route:'stock-on-hand' },
  { item:'NW-4402', name:'Aluminium Extrusion 40×40', demand:'WO-26-0081', gross:38, onHand:264, onOrder:0, net:226, action:'Sufficient', tone:'ok', route:'stock-on-hand' },
];
