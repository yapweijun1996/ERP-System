/* ============================================================
   ARIA ERP — Purchasing module extended dataset
   Procure-to-pay: enriched suppliers, requisitions, RFQs,
   supplier quotations, goods-receipt list, supplier-invoice list,
   purchase returns, supplier credit/debit notes, price lists /
   contracts, landed cost, vendor performance, analytics & reports.
   Loads AFTER data-master.js (DB.suppliers) and data-purchasing.js.
   ============================================================ */

/* ---- enrich the supplier master (master data) ---- */
DB.suppliers = [
  { code:'S-0102', name:'Daido Precision Ltd', contact:'Kenji Mori', phone:'+81 3 5400 1180', email:'sales@daido-prec.co.jp', country:'Japan', currency:'USD', terms:'Net 30', category:'Bearings & precision', leadTime:18, rating:4.6, onTime:96, approved:true, status:'Active', balance:64200 },
  { code:'S-0118', name:'EuroSteel Trading', contact:'Marta Ríos', phone:'+34 93 220 7744', email:'orders@eurosteel.eu', country:'Spain', currency:'EUR', terms:'Net 45', category:'Raw materials — steel', leadTime:24, rating:4.1, onTime:88, approved:true, status:'Active', balance:128400 },
  { code:'S-0140', name:'Shenzhen Microcircuit', contact:'Li Wei', phone:'+86 755 8211 9000', email:'export@szmicro.cn', country:'China', currency:'USD', terms:'Net 30', category:'Electronics & PCB', leadTime:21, rating:3.8, onTime:79, approved:true, status:'Active', balance:41800 },
  { code:'S-0155', name:'AlumaTech Profiles', contact:'Dieter Holz', phone:'+49 211 540 0220', email:'vertrieb@alumatech.de', country:'Germany', currency:'USD', terms:'Net 30', category:'Aluminium extrusion', leadTime:14, rating:4.4, onTime:93, approved:true, status:'Active', balance:22600 },
  { code:'S-0163', name:'Pacific Fasteners Co', contact:'Grace Lim', phone:'+65 6722 4400', email:'sales@pacfast.sg', country:'Singapore', currency:'USD', terms:'Net 30', category:'Fasteners & hardware', leadTime:9, rating:4.7, onTime:97, approved:true, status:'Active', balance:8650 },
  { code:'S-0171', name:'Meridian Logistics', contact:'Omar Haddad', phone:'+971 4 880 9000', email:'freight@meridianlog.ae', country:'UAE', currency:'USD', terms:'Net 15', category:'Freight & forwarding', leadTime:4, rating:4.2, onTime:91, approved:true, status:'Active', balance:14300 },
  { code:'S-0188', name:'Nordic Polymers AS', contact:'Sofie Berg', phone:'+47 22 40 1100', email:'post@nordicpoly.no', country:'Norway', currency:'EUR', terms:'Net 45', category:'Resins & consumables', leadTime:28, rating:3.5, onTime:72, approved:false, status:'Review', balance:0 },
  { code:'S-0192', name:'Kowloon Packaging', contact:'Anson Chu', phone:'+852 2730 5500', email:'cs@kowloonpack.hk', country:'Hong Kong', currency:'USD', terms:'COD', category:'Packaging', leadTime:7, rating:4.0, onTime:90, approved:true, status:'Active', balance:0 },
];

/* ---- purchase requisitions (internal demand) ---- */
DB.purchaseReqs = [
  { no:'PR-26-0142', date:'2026-06-02', requestedBy:'M. Okeke', dept:'Production Planning', need:'2026-06-22', lines:3, value:64200, priority:'Urgent', status:'Converted', ref:'PO-26-0291' },
  { no:'PR-26-0141', date:'2026-06-02', requestedBy:'S. Kaur', dept:'Warehouse', need:'2026-06-20', lines:2, value:18400, priority:'Stock', status:'Approved', ref:'' },
  { no:'PR-26-0140', date:'2026-05-31', requestedBy:'T. Abara', dept:'Project · Line X retrofit', need:'2026-06-28', lines:5, value:42600, priority:'Project', status:'Pending Approval', ref:'' },
  { no:'PR-26-0139', date:'2026-05-30', requestedBy:'J. Reyes', dept:'Maintenance', need:'2026-06-18', lines:1, value:3250, priority:'Urgent', status:'Submitted', ref:'' },
  { no:'PR-26-0138', date:'2026-05-29', requestedBy:'D. Costa', dept:'Admin', need:'2026-06-25', lines:4, value:5600, priority:'Stock', status:'Draft', ref:'' },
  { no:'PR-26-0137', date:'2026-05-27', requestedBy:'L. Tan', dept:'Service', need:'2026-06-15', lines:2, value:7800, priority:'Stock', status:'Rejected', ref:'' },
];

/* ---- requests for quotation (RFQ) ---- */
DB.rfqs = [
  { no:'RFQ-26-0061', date:'2026-06-03', subject:'Control Module PCB v3 — resourcing', pr:'PR-26-0140', suppliers:3, responded:2, due:'2026-06-12', status:'Partially Responded' },
  { no:'RFQ-26-0060', date:'2026-06-02', subject:'Industrial bearings annual lot', pr:'PR-26-0141', suppliers:2, responded:2, due:'2026-06-10', status:'Responded' },
  { no:'RFQ-26-0059', date:'2026-05-30', subject:'Aluminium extrusion 40×40 — Q3', pr:'', suppliers:3, responded:3, due:'2026-06-06', status:'Closed' },
  { no:'RFQ-26-0058', date:'2026-05-28', subject:'Carton & packaging consumables', pr:'PR-26-0138', suppliers:2, responded:0, due:'2026-06-08', status:'Sent' },
  { no:'RFQ-26-0057', date:'2026-05-26', subject:'Epoxy resin compound', pr:'', suppliers:1, responded:0, due:'2026-06-04', status:'Draft' },
];

/* ---- supplier quotations (responses; comparison feeds RFQ-26-0061) ---- */
DB.supplierQuotes = [
  { no:'SQ-26-0184', rfq:'RFQ-26-0061', supplier:'Shenzhen Microcircuit', code:'S-0140', item:'Control Module PCB v3', qty:300, price:118.00, currency:'USD', leadTime:21, validity:'2026-06-30', terms:'Net 30', warranty:'12 mo', total:35400, status:'Received' },
  { no:'SQ-26-0185', rfq:'RFQ-26-0061', supplier:'Daido Precision Ltd', code:'S-0102', item:'Control Module PCB v3', qty:300, price:124.50, currency:'USD', leadTime:16, validity:'2026-07-05', terms:'Net 30', warranty:'18 mo', total:37350, status:'Received' },
  { no:'SQ-26-0186', rfq:'RFQ-26-0061', supplier:'Pacific Fasteners Co', code:'S-0163', item:'Control Module PCB v3', qty:300, price:121.00, currency:'USD', leadTime:12, validity:'2026-06-28', terms:'Net 30', warranty:'12 mo', total:36300, status:'Received' },
  { no:'SQ-26-0182', rfq:'RFQ-26-0060', supplier:'Daido Precision Ltd', code:'S-0102', item:'Industrial bearings (lot)', qty:2500, price:7.10, currency:'USD', leadTime:18, validity:'2026-07-01', terms:'Net 30', warranty:'—', total:17750, status:'Selected' },
  { no:'SQ-26-0183', rfq:'RFQ-26-0060', supplier:'EuroSteel Trading', code:'S-0118', item:'Industrial bearings (lot)', qty:2500, price:7.45, currency:'EUR', leadTime:24, validity:'2026-06-29', terms:'Net 45', warranty:'—', total:18625, status:'Rejected' },
  { no:'SQ-26-0179', rfq:'RFQ-26-0059', supplier:'AlumaTech Profiles', code:'S-0155', item:'Aluminium extrusion 40×40', qty:1200, price:9.20, currency:'USD', leadTime:14, validity:'2026-06-20', terms:'Net 30', warranty:'—', total:11040, status:'Converted' },
];

/* ---- goods receipts (GRN list; hero detail is DB.grn0188) ---- */
DB.goodsReceipts = [
  { no:'GRN-26-0188', date:'2026-06-04', po:'PO-26-0291', supplier:'Shenzhen Microcircuit', code:'S-0140', warehouse:'KL-Main', lines:3, recvPct:78, qc:'Pending QC', status:'Pending QC' },
  { no:'GRN-26-0187', date:'2026-06-02', po:'PO-26-0285', supplier:'Kowloon Packaging', code:'S-0192', warehouse:'KL-Main', lines:2, recvPct:100, qc:'Accepted', status:'Posted' },
  { no:'GRN-26-0186', date:'2026-05-31', po:'PO-26-0286', supplier:'EuroSteel Trading', code:'S-0118', warehouse:'Penang DC', lines:3, recvPct:100, qc:'Accepted', status:'Posted' },
  { no:'GRN-26-0185', date:'2026-05-29', po:'PO-26-0287', supplier:'Daido Precision Ltd', code:'S-0102', warehouse:'KL-Main', lines:4, recvPct:50, qc:'Accepted', status:'Partially Received' },
  { no:'GRN-26-0184', date:'2026-05-27', po:'PO-26-0284', supplier:'AlumaTech Profiles', code:'S-0155', warehouse:'KL-Main', lines:2, recvPct:100, qc:'Rejected', status:'Rejected' },
];

/* ---- supplier invoices (AP list; hero detail is DB.suppInvoice0615) ---- */
DB.supplierInvoices = [
  { no:'SI-26-0615', date:'2026-06-05', supplier:'Shenzhen Microcircuit', code:'S-0140', po:'PO-26-0291', grn:'GRN-26-0188', total:73620.00, currency:'USD', due:'2026-07-05', match:'Mismatch', status:'Pending Matching' },
  { no:'SI-26-0614', date:'2026-06-03', supplier:'Kowloon Packaging', code:'S-0192', po:'PO-26-0285', grn:'GRN-26-0187', total:2226.00, currency:'USD', due:'2026-06-03', match:'Matched', status:'Posted' },
  { no:'SI-26-0613', date:'2026-05-31', supplier:'EuroSteel Trading', code:'S-0118', po:'PO-26-0286', grn:'GRN-26-0186', total:58088.00, currency:'EUR', due:'2026-07-15', match:'Matched', status:'Posted' },
  { no:'SI-26-0612', date:'2026-05-28', supplier:'Daido Precision Ltd', code:'S-0102', po:'PO-26-0287', grn:'GRN-26-0185', total:16536.00, currency:'USD', due:'2026-06-27', match:'Matched', status:'Partially Paid' },
  { no:'SI-26-0611', date:'2026-05-20', supplier:'AlumaTech Profiles', code:'S-0155', po:'PO-26-0282', grn:'', total:9540.00, currency:'USD', due:'2026-06-04', match:'No GRN', status:'Overdue' },
  { no:'SI-26-0610', date:'2026-05-18', supplier:'Pacific Fasteners Co', code:'S-0163', po:'PO-26-0281', grn:'GRN-26-0181', total:4187.00, currency:'USD', due:'2026-06-17', match:'Matched', status:'Paid' },
];

/* ---- purchase returns to supplier ---- */
DB.purchaseReturns = [
  { no:'PRET-26-0019', date:'2026-06-05', supplier:'AlumaTech Profiles', code:'S-0155', grn:'GRN-26-0184', reason:'Quality failed — surface defect', qty:120, value:1104.00, status:'Approved' },
  { no:'PRET-26-0018', date:'2026-06-01', supplier:'EuroSteel Trading', code:'S-0118', grn:'GRN-26-0182', reason:'Wrong grade delivered', qty:40, value:3400.00, status:'Credited' },
  { no:'PRET-26-0017', date:'2026-05-29', supplier:'Shenzhen Microcircuit', code:'S-0140', grn:'GRN-26-0180', reason:'Over-delivery', qty:75, value:8850.00, status:'Returned' },
  { no:'PRET-26-0016', date:'2026-05-24', supplier:'Nordic Polymers AS', code:'S-0188', grn:'GRN-26-0178', reason:'Damaged in transit', qty:6, value:858.00, status:'Submitted' },
];

/* ---- supplier credit notes (reduce AP) ---- */
DB.supplierCreditNotes = [
  { no:'SCN-26-0014', date:'2026-06-05', supplier:'AlumaTech Profiles', code:'S-0155', ref:'PRET-26-0019', reason:'Return credit — surface defect', amount:1104.00, status:'Draft' },
  { no:'SCN-26-0013', date:'2026-06-01', supplier:'EuroSteel Trading', code:'S-0118', ref:'PRET-26-0018', reason:'Wrong grade — full credit', amount:3400.00, status:'Applied' },
  { no:'SCN-26-0012', date:'2026-05-22', supplier:'Shenzhen Microcircuit', code:'S-0140', ref:'SI-26-0602', reason:'Price correction', amount:640.00, status:'Applied' },
  { no:'SCN-26-0011', date:'2026-05-19', supplier:'Daido Precision Ltd', code:'S-0102', ref:'SI-26-0599', reason:'Early-settlement discount', amount:412.00, status:'Posted' },
];

/* ---- supplier debit notes (claims against supplier) ---- */
DB.supplierDebitNotes = [
  { no:'SDN-26-0009', date:'2026-06-04', supplier:'Shenzhen Microcircuit', code:'S-0140', ref:'GRN-26-0188', reason:'Short-supply penalty — 400 ea backorder', amount:1200.00, status:'Draft' },
  { no:'SDN-26-0008', date:'2026-05-30', supplier:'Nordic Polymers AS', code:'S-0188', ref:'GRN-26-0178', reason:'Damage claim — transit', amount:858.00, status:'Posted' },
  { no:'SDN-26-0007', date:'2026-05-26', supplier:'EuroSteel Trading', code:'S-0118', ref:'PO-26-0279', reason:'Logistics recovery — demurrage', amount:1450.00, status:'Posted' },
];

/* ---- supplier price lists / contracts ---- */
DB.supplierPriceLists = [
  { code:'SPL-DAIDO-26', supplier:'Daido Precision Ltd', scope:'Bearings — all SKUs', currency:'USD', moq:500, effective:'2026-01-01', expiry:'2026-12-31', leadTime:18, preferred:true, status:'Active' },
  { code:'SPL-SZM-26', supplier:'Shenzhen Microcircuit', scope:'Control Module PCB v3', currency:'USD', moq:200, effective:'2026-02-01', expiry:'2026-08-31', leadTime:21, preferred:false, status:'Active' },
  { code:'SPL-ALU-26', supplier:'AlumaTech Profiles', scope:'Aluminium extrusion', currency:'USD', moq:1000, effective:'2026-01-01', expiry:'2026-12-31', leadTime:14, preferred:true, status:'Active' },
  { code:'SPL-ESTEEL-25', supplier:'EuroSteel Trading', scope:'Steel sheet & coil', currency:'EUR', moq:5000, effective:'2025-07-01', expiry:'2026-06-30', leadTime:24, preferred:false, status:'Expiring' },
  { code:'SPL-PAC-26', supplier:'Pacific Fasteners Co', scope:'Fasteners catalogue', currency:'USD', moq:100, effective:'2026-03-01', expiry:'2027-02-28', leadTime:9, preferred:true, status:'Active' },
];

/* ---- landed cost records ---- */
DB.landedCosts = [
  { no:'LC-26-0031', ref:'GRN-26-0188', supplier:'Shenzhen Microcircuit', basis:'By value', goods:73620, freight:2400, duty:3680, other:520, status:'Allocated' },
  { no:'LC-26-0030', ref:'GRN-26-0186', supplier:'EuroSteel Trading', basis:'By weight', goods:58088, freight:5200, duty:2900, other:740, status:'Allocated' },
  { no:'LC-26-0029', ref:'PO-26-0290', supplier:'EuroSteel Trading', basis:'By value', goods:64200, freight:4100, duty:3210, other:0, status:'Draft' },
];

/* ---- vendor performance (derived/curated) ---- */
DB.vendorPerf = [
  { code:'S-0102', supplier:'Daido Precision Ltd', onTime:96, leadTime:18, priceVar:0.4, qualityReject:0.6, returnRate:0.3, mismatch:1.2, spend:312000, rating:4.6 },
  { code:'S-0163', supplier:'Pacific Fasteners Co', onTime:97, leadTime:9, priceVar:-0.2, qualityReject:0.4, returnRate:0.2, mismatch:0.8, spend:96400, rating:4.7 },
  { code:'S-0155', supplier:'AlumaTech Profiles', onTime:93, leadTime:14, priceVar:1.1, qualityReject:2.8, returnRate:1.9, mismatch:1.5, spend:184000, rating:4.4 },
  { code:'S-0118', supplier:'EuroSteel Trading', onTime:88, leadTime:24, priceVar:2.3, qualityReject:1.4, returnRate:1.1, mismatch:2.6, spend:268000, rating:4.1 },
  { code:'S-0140', supplier:'Shenzhen Microcircuit', onTime:79, leadTime:21, priceVar:3.8, qualityReject:4.2, returnRate:3.4, mismatch:5.1, spend:226000, rating:3.8 },
  { code:'S-0188', supplier:'Nordic Polymers AS', onTime:72, leadTime:28, priceVar:4.6, qualityReject:5.5, returnRate:4.8, mismatch:3.2, spend:42000, rating:3.5 },
];

/* ---- analytics ---- */
DB.purByMonth = [
  { m:'Jan', val:286000 }, { m:'Feb', val:312000 }, { m:'Mar', val:358000 },
  { m:'Apr', val:402000 }, { m:'May', val:376000 }, { m:'Jun', val:298000 },
  { m:'Jul', val:340000, fc:true }, { m:'Aug', val:362000, fc:true }, { m:'Sep', val:355000, fc:true },
  { m:'Oct', val:378000, fc:true }, { m:'Nov', val:392000, fc:true }, { m:'Dec', val:410000, fc:true },
];
DB.purByBuyer = [
  { buyer:'R. Haddad', spend:842000, target:900000, orders:46 },
  { buyer:'A. Bauer', spend:716000, target:700000, orders:39 },
  { buyer:'S. Kaur', spend:312000, target:380000, orders:21 },
];
DB.topSuppliers = [
  { supplier:'Daido Precision Ltd', code:'S-0102', ytd:312000, share:24 },
  { supplier:'EuroSteel Trading', code:'S-0118', ytd:268000, share:21 },
  { supplier:'Shenzhen Microcircuit', code:'S-0140', ytd:226000, share:18 },
  { supplier:'AlumaTech Profiles', code:'S-0155', ytd:184000, share:14 },
  { supplier:'Pacific Fasteners Co', code:'S-0163', ytd:96400, share:8 },
];

/* reports catalogue for the Purchasing Reports hub */
DB.purReportsCatalog = [
  { group:'Spend analysis', items:[
    { id:'report-pur-supplier', name:'Purchase by Supplier', icon:'truck', desc:'Spend, orders & returns per supplier.', built:true },
    { id:'report-pur-buyer', name:'Purchase by Buyer', icon:'user', desc:'Spend and order volume per buyer.', built:true },
    { id:'report-pur-item', name:'Purchase by Item', icon:'box', desc:'Spend and quantity per purchased item.', built:false },
    { id:'report-pur-month', name:'Purchase by Month', icon:'chart', desc:'Monthly spend trend vs. forecast.', built:false },
  ]},
  { group:'Operations', items:[
    { id:'report-pur-open-po', name:'Outstanding Purchase Orders', icon:'cart', desc:'Open POs and expected receipt dates.', built:false },
    { id:'report-pur-pending-grn', name:'Pending Goods Receipt', icon:'receive', desc:'Ordered but not yet received.', built:false },
    { id:'report-pur-grn-not-inv', name:'GRN Not Invoiced', icon:'receipt', desc:'Received goods awaiting supplier invoice.', built:false },
    { id:'report-pur-inv-no-grn', name:'Invoice Without GRN', icon:'warn', desc:'Invoices posted with no matched receipt.', built:false },
    { id:'report-pur-price-var', name:'Price Variance Report', icon:'percent', desc:'Invoice vs PO price differences.', built:true },
  ]},
  { group:'Supplier & finance', items:[
    { id:'report-pur-vendor', name:'Supplier Performance Report', icon:'shield', desc:'On-time, quality, lead-time & mismatch.', built:true },
    { id:'report-pur-return', name:'Purchase Return Report', icon:'refresh', desc:'Returns to supplier by reason.', built:false },
    { id:'report-pur-scn', name:'Supplier Credit Note Report', icon:'coins', desc:'Credit notes raised by supplier.', built:false },
    { id:'report-pur-sdn', name:'Supplier Debit Note Report', icon:'coins', desc:'Debit notes / claims by supplier.', built:false },
    { id:'report-pur-landed', name:'Landed Cost Report', icon:'truck', desc:'Freight, duty & allocation by shipment.', built:false },
    { id:'report-pur-ap-aging', name:'AP Aging Report', icon:'clock', desc:'Outstanding payables by bucket.', built:false },
  ]},
];
