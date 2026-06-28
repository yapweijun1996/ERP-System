/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   sales — orders, the open SO document, and the quote→delivery→invoice (order-to-cash) chain
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ---- sales orders ---- */
/* status = ORDER status (Draft → Pending Approval → Approved → Closed; or Cancelled).
   Fulfilment is derived from done/items; posting is a separate boolean; payStatus is its own axis. */
DB.soNow = '2026-06-12'; // operational "today" used for delivery urgency
DB.salesOrders = [
  { no:'SO-26-0418', cust:'Meridian Robotics', custCode:'C-0007', date:'2026-06-03', deliver:'2026-06-18', status:'Pending Approval', total:96420.00, currency:'USD', owner:'J. Okafor', items:6, done:0, posted:false, payStatus:'Unpaid', flag:'Discount 12% > threshold' },
  { no:'SO-26-0417', cust:'Apex Industrial Group', custCode:'C-0012', date:'2026-06-02', deliver:'2026-06-20', status:'Approved', total:142800.00, currency:'USD', owner:'L. Tan', items:9, done:0, posted:false, payStatus:'Unpaid' },
  { no:'SO-26-0416', cust:'Tycho Automation', custCode:'C-0033', date:'2026-06-02', deliver:'2026-06-14', status:'Approved', total:58200.00, currency:'USD', owner:'J. Okafor', items:4, done:2, posted:false, payStatus:'Partial' },
  { no:'SO-26-0415', cust:'Coastal Packaging Co', custCode:'C-0021', date:'2026-06-01', deliver:'2026-06-12', status:'Closed', total:31480.00, currency:'USD', owner:'M. Silva', items:3, done:3, posted:true, payStatus:'Paid' },
  { no:'SO-26-0414', cust:'Coastal Packaging Co', custCode:'C-0021', date:'2026-05-30', deliver:'2026-06-10', status:'Closed', total:18900.00, currency:'USD', owner:'M. Silva', items:2, done:2, posted:true, payStatus:'Overdue' },
  { no:'SO-26-0413', cust:'Apex Industrial Group', custCode:'C-0012', date:'2026-05-29', deliver:'2026-06-05', status:'Closed', total:74250.00, currency:'USD', owner:'L. Tan', items:7, done:7, posted:true, payStatus:'Paid' },
  { no:'SO-26-0412', cust:'Meridian Robotics', custCode:'C-0007', date:'2026-05-28', deliver:'2026-06-08', status:'Draft', total:12640.00, currency:'USD', owner:'Dana Reyes', items:2, done:0, posted:false, payStatus:'—' },
  { no:'SO-26-0411', cust:'Pinnacle Foods Mfg', custCode:'C-0044', date:'2026-05-27', deliver:'2026-06-02', status:'Cancelled', total:9800.00, currency:'USD', owner:'J. Okafor', items:1, done:0, posted:false, payStatus:'—', flag:'Customer on credit hold' },
  { no:'SO-26-0410', cust:'Northwind Components', custCode:'C-0058', date:'2026-05-26', deliver:'2026-06-16', status:'Approved', total:47350.00, currency:'USD', owner:'L. Tan', items:5, done:5, posted:false, payStatus:'Unpaid' },
  { no:'SO-26-0409', cust:'Tycho Automation', custCode:'C-0033', date:'2026-05-25', deliver:'2026-06-09', status:'Pending Approval', total:88600.00, currency:'USD', owner:'J. Okafor', items:8, done:0, posted:false, payStatus:'Unpaid', flag:'Over credit limit' },
  { no:'SO-26-0408', cust:'Apex Industrial Group', custCode:'C-0012', date:'2026-05-24', deliver:'2026-06-22', status:'Approved', total:23100.00, currency:'USD', owner:'M. Silva', items:3, done:1, posted:false, payStatus:'Partial' },
  { no:'SO-26-0407', cust:'Coastal Packaging Co', custCode:'C-0021', date:'2026-05-22', deliver:'2026-06-01', status:'Closed', total:15750.00, currency:'USD', owner:'M. Silva', items:2, done:2, posted:true, payStatus:'Overdue' },
];

/* detail lines for SO-26-0418 (the open document) */
DB.so0418 = {
  no:'SO-26-0418', cust:DB.customers[0], date:'2026-06-03', deliver:'2026-06-18', ref:'PO# MR-99821',
  status:'Pending Approval', owner:'J. Okafor', warehouse:'KL-Main', currency:'USD', rate:1.0, terms:'Net 30',
  lines:[
    { item:'NW-9001', name:'Conveyor Drive Unit', qty:9, uom:'ea', price:1480.00, disc:10, avail:14 },
    { item:'NW-1042', name:'Hydraulic Pump Assembly', qty:24, uom:'ea', price:312.00, disc:12, avail:52 },
    { item:'NW-5500', name:'Pneumatic Cylinder 32mm', qty:30, uom:'ea', price:96.00, disc:12, avail:4 },
    { item:'NW-3310', name:'Industrial Bearing 6204', qty:200, uom:'ea', price:9.20, disc:5, avail:520 },
    { item:'NW-4402', name:'Aluminium Extrusion 40×40', qty:120, uom:'m', price:13.40, disc:0, avail:264 },
    { item:'NW-6610', name:'Carton Box 600×400×300', qty:300, uom:'ea', price:1.85, disc:0, avail:1640 },
  ],
  discountPct:12, shipping:850.00, taxRate:0.06,
  billTo:{ name:'Meridian Robotics Sdn Bhd', line1:'Lot 14, Jalan Teknologi 3/5', line2:'Kota Damansara', city:'Petaling Jaya', state:'Selangor', post:'47810', country:'Malaysia', contact:'Accounts Payable', email:'ap@meridian-robotics.com', tax:'GST C24-118-09221' },
  shipTo:{ name:'Meridian Robotics — Plant 2', line1:'PLO 38, Kawasan Perindustrian Senai', line2:'Loading Bay D', city:'Senai', state:'Johor', post:'81400', country:'Malaysia', contact:'Goods Inwards · K. Rahman', email:'receiving@meridian-robotics.com' },
  note:'Deliver to Plant 2 loading bay D only; gate pass required 24h in advance. Pallets must be heat-treated (ISPM-15). Partial deliveries accepted for line 3.',
  memo:'12% on lines 1–3 approved verbally by sales lead against Q3 volume commitment — confirm Pneumatic Cylinder backfill from PO-26-0291 before promising the 18 Jun date.',
};

/* ===================== SALES order-to-cash chain (quote, delivery, invoice) ===================== */
DB.quote0188 = {
  no:'Q-26-0188', cust:'Meridian Robotics', code:'C-0007', owner:'J. Okafor',
  date:'May 28, 2026', valid:'Jun 11, 2026', status:'Converted', terms:'Net 30', currency:'USD', taxRate:0.06, shipping:850,
  contact:{ name:'Elena Marsh', role:'Head of Automation', email:'e.marsh@meridian.co' },
  lines:[
    { item:'NW-9001', name:'Conveyor Drive Unit', qty:9, uom:'ea', price:1480.00, disc:10 },
    { item:'NW-1042', name:'Hydraulic Pump Assembly', qty:24, uom:'ea', price:312.00, disc:12 },
    { item:'NW-5500', name:'Pneumatic Cylinder 32mm', qty:30, uom:'ea', price:96.00, disc:12 },
    { item:'NW-3310', name:'Industrial Bearing 6204', qty:200, uom:'ea', price:9.20, disc:5 },
    { item:'NW-4402', name:'Aluminium Extrusion 40×40', qty:120, uom:'m', price:13.40, disc:0 },
    { item:'NW-6610', name:'Carton Box 600×400×300', qty:300, uom:'ea', price:1.85, disc:0 },
  ],
};
DB.delivery0204 = {
  no:'DO-26-0204', so:'SO-26-0418', cust:'Meridian Robotics', code:'C-0007',
  date:'Jun 16, 2026', warehouse:'KL-Main', carrier:'DHL Express', tracking:'JD0149820236', weight:'1,240 kg', packages:14, status:'In transit', eta:'Jun 18, 2026', picker:'T. Fielding',
  lines:[
    { item:'NW-9001', name:'Conveyor Drive Unit', ordered:9, delivered:9, uom:'ea' },
    { item:'NW-1042', name:'Hydraulic Pump Assembly', ordered:24, delivered:24, uom:'ea' },
    { item:'NW-5500', name:'Pneumatic Cylinder 32mm', ordered:30, delivered:4, uom:'ea' },
    { item:'NW-3310', name:'Industrial Bearing 6204', ordered:200, delivered:200, uom:'ea' },
    { item:'NW-4402', name:'Aluminium Extrusion 40×40', ordered:120, delivered:120, uom:'m' },
    { item:'NW-6610', name:'Carton Box 600×400×300', ordered:300, delivered:300, uom:'ea' },
  ],
};
DB.invoice0331 = {
  no:'INV-26-0331', so:'SO-26-0418', do:'DO-26-0204', cust:'Meridian Robotics', code:'C-0007',
  date:'Jun 16, 2026', due:'Jul 16, 2026', terms:'Net 30', currency:'USD', taxRate:0.06, shipping:850,
  status:'Partially Paid', paid:15000, owner:'J. Okafor', custBalance:130800, custLimit:240000,
  lines:[
    { item:'NW-9001', name:'Conveyor Drive Unit', qty:9, uom:'ea', price:1480.00, disc:10 },
    { item:'NW-1042', name:'Hydraulic Pump Assembly', qty:24, uom:'ea', price:312.00, disc:12 },
    { item:'NW-5500', name:'Pneumatic Cylinder 32mm', qty:4, uom:'ea', price:96.00, disc:12 },
    { item:'NW-3310', name:'Industrial Bearing 6204', qty:200, uom:'ea', price:9.20, disc:5 },
    { item:'NW-4402', name:'Aluminium Extrusion 40×40', qty:120, uom:'m', price:13.40, disc:0 },
    { item:'NW-6610', name:'Carton Box 600×400×300', qty:300, uom:'ea', price:1.85, disc:0 },
  ],
};
