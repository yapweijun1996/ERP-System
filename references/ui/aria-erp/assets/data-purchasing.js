/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   purchasing — purchase orders, the open PO, and the PR→GRN→supplier-invoice (procure-to-pay) chain
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ---- purchase orders ---- */
DB.purchaseOrders = [
  { no:'PO-26-0291', supp:'Shenzhen Microcircuit', suppCode:'S-0140', date:'2026-06-04', expect:'2026-06-22', status:'Pending Approval', total:88500.00, currency:'USD', buyer:'R. Haddad', items:3, recv:0, flag:'34% over budget line' },
  { no:'PO-26-0290', supp:'EuroSteel Trading', suppCode:'S-0118', date:'2026-06-03', expect:'2026-06-19', status:'Pending Approval', total:64200.00, currency:'EUR', buyer:'R. Haddad', items:2, recv:0 },
  { no:'PO-26-0289', supp:'Daido Precision Ltd', suppCode:'S-0102', date:'2026-06-03', expect:'2026-06-16', status:'Pending Approval', total:42600.00, currency:'USD', buyer:'A. Bauer', items:5, recv:0 },
  { no:'PO-26-0288', supp:'AlumaTech Profiles', suppCode:'S-0155', date:'2026-06-01', expect:'2026-06-15', status:'Approved', total:22600.00, currency:'USD', buyer:'A. Bauer', items:2, recv:0 },
  { no:'PO-26-0287', supp:'Daido Precision Ltd', suppCode:'S-0102', date:'2026-05-30', expect:'2026-06-12', status:'Partially Completed', total:31200.00, currency:'USD', buyer:'R. Haddad', items:4, recv:50 },
  { no:'PO-26-0286', supp:'EuroSteel Trading', suppCode:'S-0118', date:'2026-05-28', expect:'2026-06-09', status:'Completed', total:54800.00, currency:'EUR', buyer:'A. Bauer', items:3, recv:100 },
];

/* detail for the PO under approval */
DB.po0291 = {
  no:'PO-26-0291', supp:DB.suppliers[2], date:'2026-06-04', expect:'2026-06-22', status:'Pending Approval',
  buyer:'R. Haddad', warehouse:'KL-Main', currency:'USD', terms:'Net 30', budgetLine:'MFG-RM-Q2', budget:66000, requestedBy:'Production Planning',
  lines:[
    { item:'NW-1180', name:'Control Module PCB v3', qty:300, uom:'ea', price:118.00, budgetPrice:96.00 },
    { item:'NW-3310', name:'Industrial Bearing 6204', qty:1500, uom:'ea', price:6.80, budgetPrice:6.80 },
    { item:'NW-3315', name:'Industrial Bearing 6206', qty:1000, uom:'ea', price:9.40, budgetPrice:9.10 },
  ],
  approvers:[
    { name:'A. Bauer', role:'Procurement Lead', state:'approved', when:'Jun 4, 09:12', note:'Vendor pricing verified.' },
    { name:'Dana Reyes', role:'Operations Director', state:'current', when:'Awaiting you', note:'' },
    { name:'P. Nwosu', role:'CFO', state:'pending', when:'$50k+ tier', note:'' },
  ],
};

/* ===================== PURCHASING procure-to-pay chain (PR, GRN, supplier invoice) ===================== */
DB.pr0142 = {
  no:'PR-26-0142', supplier:'Shenzhen Microcircuit', code:'S-0140', requestedBy:'M. Okeke · Production Planning',
  date:'Jun 2, 2026', need:'Jun 22, 2026', status:'Ordered', warehouse:'KL-Main', costCentre:'MFG-RM-Q2',
  justification:'Control Module PCB v3 shortage is blocking work order WO-26-0081 (Conveyor Drive Units for SO-26-0418). Bearings topped up to safety stock.',
  lines:[
    { item:'NW-1180', name:'Control Module PCB v3', qty:300, uom:'ea', est:118.00, need:'Urgent' },
    { item:'NW-3310', name:'Industrial Bearing 6204', qty:1500, uom:'ea', est:6.80, need:'Stock' },
    { item:'NW-3315', name:'Industrial Bearing 6206', qty:1000, uom:'ea', est:9.40, need:'Stock' },
  ],
};
DB.grn0188 = {
  no:'GRN-26-0188', po:'PO-26-0291', supplier:'Shenzhen Microcircuit', code:'S-0140',
  date:'Jun 4, 2026', warehouse:'KL-Main', receiver:'M. Silva', carrier:'SF Express', waybill:'SF7740921188', status:'QC hold',
  lines:[
    { item:'NW-1180', name:'Control Module PCB v3', ordered:300, received:300, uom:'ea', dispo:'To QC' },
    { item:'NW-3310', name:'Industrial Bearing 6204', ordered:1500, received:1500, uom:'ea', dispo:'Putaway' },
    { item:'NW-3315', name:'Industrial Bearing 6206', ordered:1000, received:600, uom:'ea', dispo:'Putaway' },
  ],
};
DB.suppInvoice0615 = {
  no:'SI-26-0615', po:'PO-26-0291', grn:'GRN-26-0188', supplier:'Shenzhen Microcircuit', code:'S-0140',
  date:'Jun 5, 2026', due:'Jul 5, 2026', terms:'Net 30', currency:'USD', taxRate:0.06, status:'Pending Approval', suppRef:'SZM-INV-44821',
  lines:[
    { item:'NW-1180', name:'Control Module PCB v3', poQty:300, recvQty:300, invQty:300, poPrice:118.00, invPrice:120.00, uom:'ea' },
    { item:'NW-3310', name:'Industrial Bearing 6204', poQty:1500, recvQty:1500, invQty:1500, poPrice:6.80, invPrice:6.80, uom:'ea' },
    { item:'NW-3315', name:'Industrial Bearing 6206', poQty:1000, recvQty:600, invQty:600, poPrice:9.40, invPrice:9.40, uom:'ea' },
  ],
};
