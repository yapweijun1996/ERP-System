/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   quality control — inspection queue, the failed inspection record, NCR/CAPA
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ============================================================
   QUALITY CONTROL — inspection queue, inspection record, NCR / CAPA
   Narrative spine: incoming inspection QC-26-0138 fails EuroSteel
   stainless sheet on thickness → reject → raises NCR-26-0021
   (quarantine + return + supplier corrective action).
   ============================================================ */
DB.inspections = [
  { no:'QC-26-0144', type:'Final', source:'WO-26-0081', item:'NW-9001', name:'Conveyor Drive Unit', lot:15, sample:'—', status:'Scheduled', inspector:'—', date:'2026-06-24' },
  { no:'QC-26-0143', type:'Incoming', source:'GRN-26-0190', item:'NW-1180', name:'Control Module PCB v3', lot:300, sample:32, status:'Scheduled', inspector:'A. Rahman', date:'2026-06-22' },
  { no:'QC-26-0142', type:'Incoming', source:'GRN-26-0188', item:'NW-3310', name:'Industrial Bearing 6204', lot:500, sample:50, status:'Pass', inspector:'A. Rahman', date:'2026-06-04' },
  { no:'QC-26-0141', type:'In-process', source:'WO-26-0079', item:'NW-9001', name:'Conveyor Drive Unit', lot:10, sample:'op 20', status:'Pass', inspector:'M. Lim', date:'2026-06-04' },
  { no:'QC-26-0140', type:'Incoming', source:'GRN-26-0187', item:'NW-6610', name:'Carton Box 600×400×300', lot:2000, sample:80, status:'Pass', inspector:'A. Rahman', date:'2026-06-02' },
  { no:'QC-26-0139', type:'Final', source:'WO-26-0077', item:'NW-9001', name:'Conveyor Drive Unit', lot:8, sample:8, status:'Pass', inspector:'M. Lim', date:'2026-06-03' },
  { no:'QC-26-0138', type:'Incoming', source:'GRN-26-0185', item:'NW-2271', name:'Stainless Steel Sheet 2mm', lot:30, sample:8, status:'Fail', inspector:'A. Rahman', date:'2026-06-03', flag:'Thickness out of tolerance — NCR raised' },
  { no:'QC-26-0137', type:'Incoming', source:'GRN-26-0186', item:'NW-1180', name:'Control Module PCB v3', lot:120, sample:20, status:'Concession', inspector:'A. Rahman', date:'2026-05-30', flag:'Used-as-is under deviation DV-26-0007' },
];

/* the open inspection record (QC-26-0138 — incoming, failed) */
DB.qc0138 = {
  no:'QC-26-0138', type:'Incoming', source:'GRN-26-0185', item:'NW-2271', name:'Stainless Steel Sheet 2mm',
  supplier:'EuroSteel Trading', supplierCode:'S-0118', po:'PO-26-0286', lot:30, uom:'sheet',
  sample:8, aql:'2.5 · Level II', accept:0, reject:1, inspector:'A. Rahman', date:'2026-06-03', status:'Fail',
  characteristics:[
    { c:'Thickness', spec:'2.00 ± 0.05 mm', method:'Micrometer', measured:'1.92 mm', result:'Fail' },
    { c:'Width', spec:'1219 ± 2 mm', method:'Caliper', measured:'1219.5 mm', result:'Pass' },
    { c:'Length', spec:'2438 ± 3 mm', method:'Tape', measured:'2437 mm', result:'Pass' },
    { c:'Surface finish', spec:'No.4 brushed, no scratch', method:'Visual', measured:'Scratches on 2 sheets', result:'Fail' },
    { c:'Flatness', spec:'≤ 2 mm/m', method:'Feeler gauge', measured:'1.4 mm/m', result:'Pass' },
    { c:'Hardness', spec:'70–90 HRB', method:'Hardness tester', measured:'82 HRB', result:'Pass' },
    { c:'Material cert (3.1)', spec:'Required', method:'Document', measured:'Present', result:'Pass' },
  ],
  found:{ critical:0, major:2, minor:0 },
};

/* non-conformance report (NCR-26-0021) */
DB.ncr0021 = {
  no:'NCR-26-0021', source:'QC-26-0138', item:'NW-2271', name:'Stainless Steel Sheet 2mm',
  supplier:'EuroSteel Trading', supplierCode:'S-0118', po:'PO-26-0286', qty:30, uom:'sheet', cost:42.50,
  severity:'Major', status:'Open', raisedBy:'A. Rahman', date:'2026-06-03', disposition:'Return to supplier',
  defect:'Thickness 1.92 mm vs 2.00 ± 0.05 mm specification (−1.6 mm below LSL on 2 of 8 sampled sheets); minor surface scratching.',
  rootCause:'Supplier rolling-mill thickness gauge drifted out of calibration; lot shipped without final thickness verification. No incoming deviation flagged on the 3.1 cert.',
  actions:[
    { a:'Quarantine affected lot (30 sheet) to QH-01', owner:'A. Rahman · QA', due:'2026-06-05', status:'Completed' },
    { a:'Return to supplier + raise debit note', owner:'R. Haddad · Purchasing', due:'2026-06-09', status:'In Progress' },
    { a:'Request supplier corrective action (8D)', owner:'A. Bauer · Procurement', due:'2026-06-12', status:'Open' },
    { a:'Tighten incoming AQL to Level III for EuroSteel', owner:'A. Rahman · QA', due:'2026-06-16', status:'Open' },
  ],
};
