/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   service / maintenance — tickets, the open repair order, service contracts
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ============================================================
   SERVICE / MAINTENANCE — after-sales for sold equipment
   Spine: a Conveyor Drive Unit (NW-9001) sold to Tycho Automation
   is overheating → SVC-26-0042 → repair order with technician +
   spare parts drawn from inventory, under a Gold SLA contract.
   ============================================================ */
DB.serviceTickets = [
  { no:'SVC-26-0042', cust:'Tycho Automation', custCode:'C-0033', asset:'Conveyor Drive Unit', sn:'CDU-2291', issue:'Drive unit overheating, intermittent stop', priority:'High', sla:'4h left', tech:'K. Mensah', status:'In Progress', cover:'In warranty', opened:'2026-06-04' },
  { no:'SVC-26-0041', cust:'Apex Industrial Group', custCode:'C-0012', asset:'Packaging Line — Model X', sn:'PLX-0033', issue:'Sensor calibration drift on infeed', priority:'Medium', sla:'1d left', tech:'Unassigned', status:'Open', cover:'Contract', opened:'2026-06-04' },
  { no:'SVC-26-0040', cust:'Meridian Robotics', custCode:'C-0007', asset:'Conveyor Drive Unit', sn:'CDU-2188', issue:'Scheduled preventive maintenance', priority:'Low', sla:'Jun 12', tech:'K. Mensah', status:'Scheduled', cover:'Contract', opened:'2026-06-03' },
  { no:'SVC-26-0039', cust:'Coastal Packaging Co', custCode:'C-0021', asset:'Carton Former CF-200', sn:'CF-0091', issue:'Drive belt replacement', priority:'Medium', sla:'6h left', tech:'R. Diaz', status:'In Progress', cover:'Out of warranty', opened:'2026-06-03' },
  { no:'SVC-26-0038', cust:'Tycho Automation', custCode:'C-0033', asset:'Conveyor Drive Unit', sn:'CDU-2290', issue:'Bearing noise on gearbox', priority:'High', sla:'Met', tech:'K. Mensah', status:'Resolved', cover:'In warranty', opened:'2026-05-30' },
  { no:'SVC-26-0037', cust:'Pinnacle Foods Mfg', custCode:'C-0044', asset:'Packaging Line — Model X', sn:'PLX-0019', issue:'Will not power on after outage', priority:'Critical', sla:'Met', tech:'R. Diaz', status:'Closed', cover:'Out of warranty', opened:'2026-05-28' },
];
DB.svc0042 = {
  no:'SVC-26-0042', cust:DB.customers[3], asset:'Conveyor Drive Unit', sku:'NW-9001', sn:'CDU-2291',
  installed:'2025-03-14', warrantyTo:'2026-09-14', contract:'Gold SLA · 4h response', priority:'High', status:'In Progress',
  tech:'K. Mensah', opened:'2026-06-04 08:10', due:'2026-06-04 12:10', cover:'In warranty',
  symptom:'Unit overheats after ~40 min run; thermal trip halts the line. Customer reports burning smell near gearbox.',
  diagnosis:'Worn drive bearing increasing friction load; control module over-current protection tripping. Replace bearing set + inspect PCB.',
  parts:[
    { item:'NW-3310', name:'Industrial Bearing 6204', qty:4, uom:'ea', cost:6.80, avail:520 },
    { item:'NW-3315', name:'Industrial Bearing 6206', qty:2, uom:'ea', cost:9.40, avail:34 },
    { item:'NW-1180', name:'Control Module PCB v3', qty:1, uom:'ea', cost:118.00, avail:0 },
  ],
  labourHrs:3.5, labourRate:55.00,
  activity:[
    { kind:'current', when:'Jun 4 · 09:40', what:'On-site — bearing wear confirmed, awaiting PCB stock', who:'K. Mensah' },
    { kind:'sys', when:'Jun 4 · 08:25', what:'Assigned to K. Mensah · Gold SLA 4h', who:'Dispatch' },
    { kind:'add', when:'Jun 4 · 08:10', what:'Ticket raised by customer call', who:'Service desk' },
  ],
};
DB.serviceContracts = [
  { no:'SC-0007', cust:'Tycho Automation', plan:'Gold', sla:'4h on-site', assets:6, start:'2025-04-01', expiry:'2027-03-31', value:48000, status:'Active' },
  { no:'SC-0012', cust:'Apex Industrial Group', plan:'Gold', sla:'4h on-site', assets:9, start:'2025-01-15', expiry:'2026-12-31', value:72000, status:'Active' },
  { no:'SC-0021', cust:'Coastal Packaging Co', plan:'Silver', sla:'Next business day', assets:3, start:'2024-06-01', expiry:'2026-05-31', value:18000, status:'Expiring' },
  { no:'SC-0033', cust:'Meridian Robotics', plan:'Gold', sla:'4h on-site', assets:4, start:'2025-08-01', expiry:'2027-07-31', value:36000, status:'Active' },
  { no:'SC-0044', cust:'Pinnacle Foods Mfg', plan:'Bronze', sla:'Best effort', assets:1, start:'2024-02-01', expiry:'2025-01-31', value:6000, status:'Expired' },
];
