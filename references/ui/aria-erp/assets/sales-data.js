/* ============================================================
   ARIA ERP — Sales module: extended seed data
   Northwind Manufacturing (USD, FY2026 · P06 June).
   Cross-links to existing DB.customers / DB.salesOrders /
   DB.quote0188 / DB.delivery0204 / DB.invoice0331.
   ============================================================ */

DB.salesReps = ['J. Okafor','L. Tan','M. Silva','Dana Reyes'];

/* ---- ENQUIRIES (pre-quote) ---- */
DB.enquiries = [
  { no:'ENQ-26-0061', date:'2026-06-11', cust:'Meridian Robotics', custCode:'C-0007', subject:'Conveyor drive units — Plant 3 expansion', channel:'Email', owner:'J. Okafor', value:128000, status:'New' },
  { no:'ENQ-26-0060', date:'2026-06-10', cust:'Tycho Automation', custCode:'C-0033', subject:'Pricing & lead time — pneumatic cylinders', channel:'Phone', owner:'J. Okafor', value:42000, status:'Quoted' },
  { no:'ENQ-26-0059', date:'2026-06-09', cust:'Apex Industrial Group', custCode:'C-0012', subject:'Bearing 6206 availability for July', channel:'Web form', owner:'L. Tan', value:18600, status:'New' },
  { no:'ENQ-26-0058', date:'2026-06-06', cust:'Coastal Packaging Co', custCode:'C-0021', subject:'Carton line spares — special terms request', channel:'Email', owner:'M. Silva', value:9400, status:'On hold' },
  { no:'ENQ-26-0057', date:'2026-06-05', cust:'Meridian Robotics', custCode:'C-0007', subject:'Hydraulic pump assembly — repeat order', channel:'Phone', owner:'J. Okafor', value:31000, status:'Converted' },
  { no:'ENQ-26-0056', date:'2026-06-03', cust:'Pinnacle Foods Mfg', custCode:'C-0044', subject:'Packaging line — Model X quotation', channel:'Email', owner:'L. Tan', value:96000, status:'Lost' },
  { no:'ENQ-26-0055', date:'2026-06-02', cust:'Apex Industrial Group', custCode:'C-0012', subject:'Aluminium extrusion — bulk pricing', channel:'Phone', owner:'M. Silva', value:24800, status:'Quoted' },
  { no:'ENQ-26-0054', date:'2026-05-29', cust:'Tycho Automation', custCode:'C-0033', subject:'Drive unit retrofit kit', channel:'Web form', owner:'J. Okafor', value:54000, status:'Converted' },
];

/* ---- QUOTATIONS (list; Q-26-0188 opens the existing quotation doc) ---- */
DB.quotations = [
  { no:'Q-26-0190', date:'2026-06-11', cust:'Tycho Automation', custCode:'C-0033', valid:'2026-06-25', owner:'J. Okafor', total:42180.00, prob:60, status:'Sent' },
  { no:'Q-26-0189', date:'2026-06-09', cust:'Apex Industrial Group', custCode:'C-0012', valid:'2026-06-23', owner:'M. Silva', total:24960.00, prob:40, status:'Sent' },
  { no:'Q-26-0188', date:'2026-05-28', cust:'Meridian Robotics', custCode:'C-0007', valid:'2026-06-11', owner:'J. Okafor', total:96420.00, prob:100, status:'Converted', doc:true },
  { no:'Q-26-0187', date:'2026-06-04', cust:'Coastal Packaging Co', custCode:'C-0021', valid:'2026-06-18', owner:'M. Silva', total:15750.00, prob:75, status:'Accepted' },
  { no:'Q-26-0186', date:'2026-06-02', cust:'Pinnacle Foods Mfg', custCode:'C-0044', valid:'2026-06-16', owner:'L. Tan', total:96400.00, prob:0, status:'Rejected' },
  { no:'Q-26-0185', date:'2026-05-30', cust:'Tycho Automation', custCode:'C-0033', valid:'2026-06-13', owner:'J. Okafor', total:54300.00, prob:100, status:'Converted' },
  { no:'Q-26-0184', date:'2026-05-22', cust:'Apex Industrial Group', custCode:'C-0012', valid:'2026-06-05', owner:'L. Tan', total:31200.00, prob:0, status:'Expired' },
  { no:'Q-26-0183', date:'2026-05-20', cust:'Meridian Robotics', custCode:'C-0007', valid:'2026-06-03', owner:'J. Okafor', total:12640.00, prob:50, status:'Draft' },
];

/* ---- DELIVERY ORDERS (list; DO-26-0204 opens the existing delivery doc) ---- */
DB.deliveries = [
  { no:'DO-26-0205', date:'2026-06-12', cust:'Tycho Automation', custCode:'C-0033', so:'SO-26-0416', warehouse:'KL-Main', carrier:'City-Link', items:4, done:2, status:'Picking' },
  { no:'DO-26-0204', date:'2026-06-16', cust:'Meridian Robotics', custCode:'C-0007', so:'SO-26-0418', warehouse:'KL-Main', carrier:'DHL Express', items:6, done:5, status:'Shipped', doc:true },
  { no:'DO-26-0203', date:'2026-06-10', cust:'Apex Industrial Group', custCode:'C-0012', so:'SO-26-0413', warehouse:'KL-Main', carrier:'DHL Express', items:7, done:7, status:'Delivered' },
  { no:'DO-26-0202', date:'2026-06-09', cust:'Coastal Packaging Co', custCode:'C-0021', so:'SO-26-0415', warehouse:'Penang DC', carrier:'Pos Laju', items:3, done:3, status:'Delivered' },
  { no:'DO-26-0201', date:'2026-06-08', cust:'Apex Industrial Group', custCode:'C-0012', so:'SO-26-0408', warehouse:'KL-Main', carrier:'City-Link', items:3, done:1, status:'Partially Delivered' },
  { no:'DO-26-0200', date:'2026-06-05', cust:'Coastal Packaging Co', custCode:'C-0021', so:'SO-26-0407', warehouse:'Penang DC', carrier:'Pos Laju', items:2, done:0, status:'Draft' },
];

/* ---- SALES INVOICES (list; INV-26-0331 opens the existing invoice doc) ---- */
DB.salesInvoices = [
  { no:'INV-26-0333', date:'2026-06-12', due:'2026-07-12', cust:'Apex Industrial Group', custCode:'C-0012', so:'SO-26-0413', total:74250.00, paid:0, status:'Posted' },
  { no:'INV-26-0332', date:'2026-06-11', due:'2026-07-11', cust:'Coastal Packaging Co', custCode:'C-0021', so:'SO-26-0415', total:31480.00, paid:31480.00, status:'Paid' },
  { no:'INV-26-0331', date:'2026-06-16', due:'2026-07-16', cust:'Meridian Robotics', custCode:'C-0007', so:'SO-26-0418', total:91804.20, paid:15000.00, status:'Partially Paid', doc:true },
  { no:'INV-26-0330', date:'2026-05-12', due:'2026-06-11', cust:'Coastal Packaging Co', custCode:'C-0021', so:'SO-26-0414', total:18900.00, paid:0, status:'Overdue' },
  { no:'INV-26-0329', date:'2026-05-28', due:'2026-06-27', cust:'Tycho Automation', custCode:'C-0033', so:'SO-26-0409', total:23100.00, paid:11000.00, status:'Partially Paid' },
  { no:'INV-26-0328', date:'2026-05-25', due:'2026-06-24', cust:'Apex Industrial Group', custCode:'C-0012', so:'SO-26-0410', total:47350.00, paid:47350.00, status:'Paid' },
  { no:'INV-26-0327', date:'2026-05-05', due:'2026-06-04', cust:'Coastal Packaging Co', custCode:'C-0021', so:'SO-26-0407', total:15750.00, paid:0, status:'Overdue' },
  { no:'INV-26-0326', date:'2026-05-30', due:'2026-06-29', cust:'Meridian Robotics', custCode:'C-0007', so:'SO-26-0412', total:12640.00, paid:0, status:'Draft' },
];

/* ---- SALES RETURNS / RMA ---- */
DB.salesReturns = [
  { no:'RMA-26-0044', date:'2026-06-11', cust:'Meridian Robotics', custCode:'C-0007', ref:'INV-26-0331', reason:'Damaged in transit', qty:2, value:2960.00, disposition:'Credit note', status:'Inspected', owner:'Quality' },
  { no:'RMA-26-0043', date:'2026-06-09', cust:'Coastal Packaging Co', custCode:'C-0021', ref:'DO-26-0202', reason:'Wrong item shipped', qty:6, value:1110.00, disposition:'Replacement', status:'Received', owner:'Warehouse' },
  { no:'RMA-26-0042', date:'2026-06-07', cust:'Tycho Automation', custCode:'C-0033', ref:'INV-26-0329', reason:'Over-supply vs. PO', qty:12, value:1152.00, disposition:'Credit note', status:'Approved', owner:'M. Silva' },
  { no:'RMA-26-0041', date:'2026-06-05', cust:'Apex Industrial Group', custCode:'C-0012', ref:'INV-26-0328', reason:'Quality — surface finish', qty:4, value:5920.00, disposition:'Pending decision', status:'Requested', owner:'L. Tan' },
  { no:'RMA-26-0040', date:'2026-06-02', cust:'Pinnacle Foods Mfg', custCode:'C-0044', ref:'INV-26-0319', reason:'Customer cancelled line', qty:1, value:8650.00, disposition:'Rejected', status:'Rejected', owner:'J. Okafor' },
  { no:'RMA-26-0039', date:'2026-05-28', cust:'Coastal Packaging Co', custCode:'C-0021', ref:'INV-26-0312', reason:'Damaged — forklift', qty:8, value:840.00, disposition:'Credit note', status:'Credited', owner:'Quality' },
];

/* lines for RMA-26-0044 (detail) */
DB.rma0044 = {
  no:'RMA-26-0044', cust:'Meridian Robotics', custCode:'C-0007', date:'2026-06-11', ref:'INV-26-0331', do:'DO-26-0204',
  reason:'Damaged in transit', disposition:'Credit note', status:'Inspected', owner:'Quality', warehouse:'KL-Main', contact:'Goods Inwards · K. Rahman',
  lines:[
    { item:'NW-9001', name:'Conveyor Drive Unit', qty:2, uom:'ea', price:1480.00, condition:'Damaged casing', accept:true },
  ],
};

/* ---- CREDIT NOTES ---- */
DB.creditNotes = [
  { no:'CN-26-0028', date:'2026-06-11', cust:'Meridian Robotics', custCode:'C-0007', ref:'INV-26-0331', reason:'Goods returned — RMA-26-0044', amount:2960.00, applied:0, status:'Draft' },
  { no:'CN-26-0027', date:'2026-06-07', cust:'Tycho Automation', custCode:'C-0033', ref:'INV-26-0329', reason:'Over-supply credit', amount:1152.00, applied:1152.00, status:'Applied' },
  { no:'CN-26-0026', date:'2026-06-04', cust:'Apex Industrial Group', custCode:'C-0012', ref:'INV-26-0328', reason:'Price adjustment — contract rate', amount:2360.00, applied:2360.00, status:'Applied' },
  { no:'CN-26-0025', date:'2026-05-28', cust:'Coastal Packaging Co', custCode:'C-0021', ref:'INV-26-0312', reason:'Damaged goods — RMA-26-0039', amount:840.00, applied:840.00, status:'Posted' },
  { no:'CN-26-0024', date:'2026-05-20', cust:'Apex Industrial Group', custCode:'C-0012', ref:'INV-26-0305', reason:'Discount correction', amount:1480.00, applied:0, status:'Posted' },
];

/* ---- DEBIT NOTES ---- */
DB.debitNotes = [
  { no:'DN-26-0012', date:'2026-06-10', cust:'Coastal Packaging Co', custCode:'C-0021', ref:'INV-26-0330', reason:'Additional freight — expedited', amount:480.00, status:'Posted' },
  { no:'DN-26-0011', date:'2026-06-06', cust:'Pinnacle Foods Mfg', custCode:'C-0044', ref:'INV-26-0319', reason:'Late payment charge', amount:225.00, status:'Posted' },
  { no:'DN-26-0010', date:'2026-06-03', cust:'Tycho Automation', custCode:'C-0033', ref:'SO-26-0416', reason:'Price undercharged — correction', amount:640.00, status:'Draft' },
  { no:'DN-26-0009', date:'2026-05-26', cust:'Apex Industrial Group', custCode:'C-0012', ref:'INV-26-0301', reason:'Installation service charge', amount:1200.00, status:'Posted' },
];

/* ---- PRICE LISTS ---- */
DB.priceLists = [
  { code:'PL-STD', name:'Standard List (2026)', basis:'Item', currency:'USD', scope:'All customers', items:142, effective:'2026-01-01', status:'Active', def:true },
  { code:'PL-DIST', name:'Distributor Tier', basis:'Customer group', currency:'USD', scope:'Distributors', items:142, effective:'2026-01-01', status:'Active' },
  { code:'PL-MR', name:'Meridian Robotics — Contract', basis:'Customer', currency:'USD', scope:'Meridian Robotics', items:18, effective:'2026-04-01', status:'Active' },
  { code:'PL-EXP', name:'Export (Zero-rated)', basis:'Currency', currency:'USD', scope:'Export customers', items:96, effective:'2026-01-01', status:'Active' },
  { code:'PL-PROMO', name:'Q3 Volume Promotion', basis:'Promotion', currency:'USD', scope:'Components ≥ 500 units', items:24, effective:'2026-07-01', status:'Scheduled' },
  { code:'PL-2025', name:'Standard List (2025)', basis:'Item', currency:'USD', scope:'All customers', items:138, effective:'2025-01-01', status:'Archived' },
];

/* sample matrix rows for the Meridian contract list */
DB.priceListRows = [
  { sku:'NW-9001', name:'Conveyor Drive Unit', uom:'ea', list:1798.00, contract:1480.00, min:1364.00 },
  { sku:'NW-1042', name:'Hydraulic Pump Assembly', uom:'ea', list:359.60, contract:312.00, min:285.20 },
  { sku:'NW-5500', name:'Pneumatic Cylinder 32mm', uom:'ea', list:107.30, contract:96.00, min:85.10 },
  { sku:'NW-3310', name:'Industrial Bearing 6204', uom:'ea', list:9.86, contract:9.20, min:7.82 },
  { sku:'NW-4402', name:'Aluminium Extrusion 40×40', uom:'m', list:13.34, contract:13.40, min:10.58 },
];

/* ---- DISCOUNT RULES ---- */
DB.discountRules = [
  { code:'DR-001', name:'Standard cash discount', type:'Standard', scope:'All orders', value:'2%', threshold:'—', approval:'None', status:'Active' },
  { code:'DR-002', name:'Meridian volume tier', type:'Customer', scope:'Meridian Robotics', value:'12%', threshold:'≥ $50k', approval:'Sales lead', status:'Active' },
  { code:'DR-003', name:'Components 500+ units', type:'Quantity', scope:'Components category', value:'8%', threshold:'≥ 500 ea', approval:'None', status:'Active' },
  { code:'DR-004', name:'Q3 campaign', type:'Campaign', scope:'Conveyor + drive units', value:'10%', threshold:'Jul–Sep', approval:'None', status:'Scheduled' },
  { code:'DR-005', name:'Clearance — 2025 stock', type:'Item', scope:'Tagged items', value:'15%', threshold:'—', approval:'Manager', status:'Active' },
  { code:'DR-006', name:'Discretionary cap', type:'Control', scope:'All reps', value:'Max 15%', threshold:'> 15% → approval', approval:'Finance', status:'Active' },
];

/* ---- SALES COMMISSION ---- */
DB.commissions = [
  { rep:'J. Okafor', period:'May 2026', basis:'Collected', sales:418600, rate:'2.5%', commission:10465.00, status:'Approved' },
  { rep:'L. Tan', period:'May 2026', basis:'Collected', sales:362400, rate:'2.5%', commission:9060.00, status:'Approved' },
  { rep:'M. Silva', period:'May 2026', basis:'Gross profit', sales:184200, rate:'6.0% GP', commission:5240.00, status:'Approved' },
  { rep:'J. Okafor', period:'Jun 2026', basis:'Collected', sales:286400, rate:'2.5%', commission:7160.00, status:'Pending' },
  { rep:'L. Tan', period:'Jun 2026', basis:'Collected', sales:198200, rate:'2.5%', commission:4955.00, status:'Pending' },
  { rep:'M. Silva', period:'Jun 2026', basis:'Gross profit', sales:96800, rate:'6.0% GP', commission:2710.00, status:'Review' },
];

/* ---- ANALYTICS ---- */
DB.salesByMonth = [
  { m:'Jan', val:402000 }, { m:'Feb', val:388000 }, { m:'Mar', val:471000 },
  { m:'Apr', val:512000 }, { m:'May', val:498000 }, { m:'Jun', val:386000 },
  { m:'Jul', val:430000, fc:true }, { m:'Aug', val:445000, fc:true }, { m:'Sep', val:468000, fc:true },
  { m:'Oct', val:489000, fc:true }, { m:'Nov', val:510000, fc:true }, { m:'Dec', val:534000, fc:true },
];
DB.salesByRep = [
  { rep:'J. Okafor', sales:1284000, target:1200000, deals:38 },
  { rep:'L. Tan', sales:1042000, target:1100000, deals:31 },
  { rep:'M. Silva', sales:624000, target:700000, deals:22 },
  { rep:'Dana Reyes', sales:198000, target:250000, deals:7 },
];
DB.topCustomers = [
  { cust:'Apex Industrial Group', custCode:'C-0012', ytd:842600, share:31 },
  { cust:'Meridian Robotics', custCode:'C-0007', ytd:618400, share:23 },
  { cust:'Tycho Automation', custCode:'C-0033', ytd:412800, share:15 },
  { cust:'Coastal Packaging Co', custCode:'C-0021', ytd:286500, share:11 },
  { cust:'Pinnacle Foods Mfg', custCode:'C-0044', ytd:142000, share:5 },
];

/* reports catalogue for the Reports hub */
DB.reportsCatalog = [
  { group:'Sales analysis', items:[
    { id:'report-sales-customer', name:'Sales by Customer', icon:'handshake', desc:'Revenue, orders & margin per customer.', built:true },
    { id:'report-sales-item', name:'Sales by Item', icon:'box', desc:'Units & revenue per SKU and category.' },
    { id:'report-sales-rep', name:'Sales by Salesperson', icon:'user', desc:'Revenue vs. target by rep.', built:true },
    { id:'report-sales-region', name:'Sales by Region', icon:'location', desc:'Revenue split by state / territory.' },
    { id:'report-sales-month', name:'Sales by Month', icon:'chart', desc:'Monthly revenue trend & YoY.' },
    { id:'report-gross-profit', name:'Gross Profit Report', icon:'percent', desc:'Margin by customer, item & order.' },
  ]},
  { group:'Operational', items:[
    { id:'report-outstanding-so', name:'Outstanding Sales Orders', icon:'bag', desc:'Open order book by status & age.' },
    { id:'report-pending-delivery', name:'Pending Delivery', icon:'truck', desc:'Approved orders awaiting dispatch.' },
    { id:'report-pending-invoice', name:'Pending Invoice', icon:'receipt', desc:'Delivered but not yet invoiced.' },
    { id:'report-overdue-customer', name:'Overdue Customer', icon:'warn', desc:'Aged receivables by customer.' },
    { id:'report-quote-conversion', name:'Quotation Conversion', icon:'flow', desc:'Win-rate from quote to order.', built:true },
    { id:'report-cancelled-so', name:'Cancelled Sales Orders', icon:'xc', desc:'Cancellations with reason analysis.' },
  ]},
  { group:'Returns & adjustments', items:[
    { id:'report-sales-return', name:'Sales Return Report', icon:'refresh', desc:'Returns by reason & disposition.' },
    { id:'report-credit-note', name:'Credit Note Report', icon:'coins', desc:'Credits issued by reason & period.' },
    { id:'report-target-actual', name:'Sales Target vs Actual', icon:'target', desc:'Performance against quota by rep.' },
  ]},
];
