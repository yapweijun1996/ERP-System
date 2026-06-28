/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   fixed assets — register, the open asset, depreciation run
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ============================================================
   FIXED ASSETS — plant, equipment, vehicles, IT
   Spine: monthly straight-line depreciation totals $18,650 —
   exactly JE-26-0610 "Depreciation run — June" in Finance.
   ============================================================ */
DB.assets = [
  { id:'FA-1001', name:'CNC Machining Centre', cat:'Plant & Machinery', acq:'2023-01-10', cost:420000, life:10, accDep:168000, nbv:252000, monthly:3500, status:'In use', loc:'KL Plant · Bay 1' },
  { id:'FA-1002', name:'Assembly Line 1 (WC-10–50)', cat:'Plant & Machinery', acq:'2022-06-01', cost:285000, life:10, accDep:142500, nbv:142500, monthly:2375, status:'In use', loc:'KL Plant · Line 1' },
  { id:'FA-1009', name:'Injection Moulding Machine', cat:'Plant & Machinery', acq:'2023-05-20', cost:540000, life:10, accDep:166500, nbv:373500, monthly:4500, status:'In use', loc:'KL Plant · Bay 3' },
  { id:'FA-1010', name:'HVAC & Compressor Plant', cat:'Plant & Machinery', acq:'2022-03-15', cost:174000, life:10, accDep:73950, nbv:100050, monthly:1450, status:'Under maintenance', loc:'KL Plant · Utilities' },
  { id:'FA-1003', name:'Forklift — Toyota 2.5t', cat:'Vehicles', acq:'2024-03-05', cost:38000, life:5, accDep:9500, nbv:28500, monthly:633, status:'In use', loc:'KL Warehouse' },
  { id:'FA-1004', name:'Delivery Truck — 5t', cat:'Vehicles', acq:'2021-09-12', cost:96000, life:5, accDep:67200, nbv:28800, monthly:1600, status:'In use', loc:'Fleet' },
  { id:'FA-1005', name:'CMM Inspection Machine', cat:'Lab Equipment', acq:'2023-08-22', cost:124000, life:8, accDep:31000, nbv:93000, monthly:1292, status:'In use', loc:'QA Lab' },
  { id:'FA-1006', name:'Office Fit-out — KL HQ', cat:'Furniture & Fixtures', acq:'2021-01-20', cost:78000, life:5, accDep:62400, nbv:15600, monthly:1300, status:'In use', loc:'KL HQ' },
  { id:'FA-1007', name:'ERP & IT Infrastructure', cat:'IT Equipment', acq:'2024-01-15', cost:54000, life:3, accDep:18000, nbv:36000, monthly:1500, status:'In use', loc:'KL HQ · Server room' },
  { id:'FA-1008', name:'Pallet Racking System', cat:'Warehouse Equipment', acq:'2022-11-08', cost:42000, life:7, accDep:14700, nbv:27300, monthly:500, status:'In use', loc:'KL Warehouse' },
];
DB.asset1001 = {
  id:'FA-1001', name:'CNC Machining Centre', cat:'Plant & Machinery', status:'In use', loc:'KL Plant · Bay 1',
  acq:'2023-01-10', cost:420000, life:10, residual:0, method:'Straight-line', monthly:3500, accDep:168000, nbv:252000,
  supplier:'Daido Precision Ltd', po:'PO-23-0118', lastMaint:'2026-05-12', nextMaint:'2026-08-12',
  schedule:[
    { yr:'FY2023', open:420000, dep:42000, close:378000 },
    { yr:'FY2024', open:378000, dep:42000, close:336000 },
    { yr:'FY2025', open:336000, dep:42000, close:294000 },
    { yr:'FY2026', open:294000, dep:42000, close:252000, current:true },
    { yr:'FY2027', open:252000, dep:42000, close:210000 },
  ],
};
DB.depRun = [
  { cat:'Plant & Machinery', n:4, open:879875, dep:11825 },
  { cat:'Vehicles', n:2, open:59533, dep:2233 },
  { cat:'Lab Equipment', n:1, open:94292, dep:1292 },
  { cat:'IT Equipment', n:1, open:37500, dep:1500 },
  { cat:'Furniture & Fixtures', n:1, open:16900, dep:1300 },
  { cat:'Warehouse Equipment', n:1, open:27800, dep:500 },
];
