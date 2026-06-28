/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   CRM — sales pipeline, the open opportunity, customer 360
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ============================================================
   CRM — sales pipeline, opportunity, customer 360
   Spine: OPP-26-0091 (Meridian, Conveyor line expansion) is in
   Negotiation and converts to SO-26-0418 — the discount order already
   pending approval in Sales. CRM is the front of the same funnel.
   ============================================================ */
DB.pipeline = [
  { stage:'Lead', items:[
    { no:'OPP-26-0087', cust:'Pinnacle Foods Mfg', custCode:'C-0044', title:'New packaging line evaluation', value:80000, owner:'J. Okafor', av:'JO', clr:'#0a84ff', close:'2026-07-20', prob:10, warn:'Customer on credit hold' },
    { no:'OPP-26-0086', cust:'Delta Components', custCode:'C-0051', title:'Bearing supply trial', value:24000, owner:'M. Silva', av:'MS', clr:'#34c759', close:'2026-07-12', prob:15 },
  ]},
  { stage:'Qualified', items:[
    { no:'OPP-26-0088', cust:'Coastal Packaging Co', custCode:'C-0021', title:'Carton supply renewal', value:31000, owner:'M. Silva', av:'MS', clr:'#34c759', close:'2026-06-28', prob:40 },
    { no:'OPP-26-0084', cust:'Meridian Robotics', custCode:'C-0007', title:'Service contract — 12 mo', value:18000, owner:'J. Okafor', av:'JO', clr:'#0a84ff', close:'2026-07-05', prob:35 },
  ]},
  { stage:'Proposal', items:[
    { no:'OPP-26-0090', cust:'Apex Industrial Group', custCode:'C-0012', title:'Packaging Line — Model X ×3', value:142800, owner:'L. Tan', av:'LT', clr:'#ff9f0a', close:'2026-06-30', prob:55 },
  ]},
  { stage:'Negotiation', items:[
    { no:'OPP-26-0091', cust:'Meridian Robotics', custCode:'C-0007', title:'Conveyor line expansion', value:96420, owner:'J. Okafor', av:'JO', clr:'#0a84ff', close:'2026-06-18', prob:75, hot:true },
    { no:'OPP-26-0085', cust:'Apex Industrial Group', custCode:'C-0012', title:'Spare parts contract', value:46000, owner:'L. Tan', av:'LT', clr:'#ff9f0a', close:'2026-06-24', prob:60 },
  ]},
  { stage:'Won', items:[
    { no:'OPP-26-0089', cust:'Tycho Automation', custCode:'C-0033', title:'Automation retrofit', value:58200, owner:'J. Okafor', av:'JO', clr:'#0a84ff', close:'2026-06-02', prob:100 },
  ]},
];

/* the open opportunity (OPP-26-0091) */
DB.opp0091 = {
  no:'OPP-26-0091', cust:DB.customers[0], title:'Conveyor line expansion', value:96420, currency:'USD',
  stage:'Negotiation', prob:75, owner:'J. Okafor', source:'Inbound — trade show', close:'2026-06-18', age:'24 days',
  contact:{ name:'Elena Marsh', role:'Head of Operations', email:'e.marsh@meridian.co', phone:'+1 415 555 0142' },
  activities:[
    { kind:'current', when:'Jun 4 · 10:20', what:'Sent revised quote with 12% volume discount', who:'J. Okafor' },
    { kind:'sys', when:'Jun 2 · 15:40', what:'Call — customer pushing for Jun 18 delivery', who:'J. Okafor' },
    { kind:'add', when:'May 28 · 09:10', what:'Site walkthrough completed; 9 drive units scoped', who:'J. Okafor' },
    { kind:'sub', when:'May 12 · 14:00', what:'Opportunity created from trade-show lead', who:'System' },
  ],
};

/* customer 360 (Meridian Robotics) */
DB.cust0007 = {
  ...DB.customers[0],
  since:'2021', industry:'Industrial robotics', owner:'J. Okafor',
  contacts:[
    { name:'Elena Marsh', role:'Head of Operations', av:'EM', clr:'#0a84ff' },
    { name:'David Cho', role:'Procurement Manager', av:'DC', clr:'#ff375f' },
  ],
  openOrders:[
    { no:'SO-26-0418', label:'Sales order', meta:'$96,420 · 6 lines', status:'Pending Approval' },
    { no:'SO-26-0412', label:'Sales order', meta:'$12,640 · draft', status:'Draft' },
  ],
  opps:[
    { no:'OPP-26-0091', label:'Conveyor line expansion', meta:'$96,420 · 75%', status:'In Progress' },
    { no:'OPP-26-0084', label:'Service contract', meta:'$18,000 · 35%', status:'In Progress' },
  ],
  activities:[
    { kind:'current', when:'Jun 4 · 10:20', what:'Sent revised quote (OPP-26-0091)', who:'J. Okafor' },
    { kind:'sys', when:'May 30 · 11:05', what:'Invoice INV-26-0402 — $32,400 now overdue', who:'System' },
    { kind:'add', when:'May 28 · 09:10', what:'Site walkthrough completed', who:'J. Okafor' },
  ],
};
