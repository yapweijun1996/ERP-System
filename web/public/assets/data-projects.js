/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   projects — portfolio, the open project P&L, weekly timesheet
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ===================== PROJECTS (module 9) ===================== */
DB.projects = [
  { no:'PRJ-26-014', name:'Meridian Robotics — Cell Integration', client:'Meridian Robotics', type:'Customer', pm:'Liam Cardoso',
    contract:486000, cost:358200, billed:243000, pct:74, start:'Mar 04', due:'Aug 15', status:'On track' },
  { no:'PRJ-26-009', name:'Apex Conveyor Rollout — Phase 2', client:'Apex Industrial', type:'Customer', pm:'Priya Nathan',
    contract:312000, cost:281500, billed:245000, pct:88, start:'Jan 22', due:'Jul 02', status:'At risk' },
  { no:'PRJ-26-021', name:'Plant 2 Automation Retrofit', client:'Internal · Capex', type:'Internal', pm:'Dana Reyes',
    contract:720000, cost:196400, billed:0, pct:26, start:'Apr 18', due:'Nov 30', status:'On track' },
  { no:'PRJ-26-018', name:'MES ↔ ERP Integration', client:'Internal · IT', type:'Internal', pm:'Samuel Boateng',
    contract:145000, cost:152800, billed:0, pct:92, start:'Feb 10', due:'Jun 28', status:'Over budget' },
  { no:'PRJ-26-026', name:'Service Fleet Telematics Upgrade', client:'Internal · Service', type:'Internal', pm:'Rosa Delgado',
    contract:96000, cost:41200, billed:0, pct:38, start:'May 06', due:'Sep 20', status:'On track' },
  { no:'PRJ-26-031', name:'Solar Roof — KL HQ', client:'Internal · Facilities', type:'Internal', pm:'Dana Reyes',
    contract:410000, cost:16400, billed:0, pct:4, start:'Jun 02', due:'Q1 2027', status:'On hold' },
  { no:'PRJ-25-242', name:'Harbor Freight Custom Press', client:'Harbor Freight Co.', type:'Customer', pm:'Liam Cardoso',
    contract:268000, cost:240100, billed:268000, pct:100, start:'Oct 2025', due:'Apr 30', status:'Completed' },
];

DB.proj0014 = {
  no:'PRJ-26-014', name:'Meridian Robotics — Cell Integration', client:'Meridian Robotics', code:'CUST-0007',
  type:'Customer', pm:'Liam Cardoso', sponsor:'E. Marsh (Meridian)', start:'Mar 04, 2026', due:'Aug 15, 2026', pct:74,
  contract:486000, forecastCost:441000,
  costs:[
    { cat:'Engineering labour',     budget:168000, actual:132400, committed:9800 },
    { cat:'Materials & parts',      budget:142000, actual:121500, committed:14200 },
    { cat:'Electrical subcontract', budget:86000,  actual:71300,  committed:6000 },
    { cat:'Equipment & rental',     budget:42000,  actual:23000,  committed:0 },
    { cat:'Overhead & PM',          budget:48000,  actual:10000,  committed:0 },
  ],
  milestones:[
    { name:'Design & sign-off',          amount:97200,  date:'Apr 12', status:'Billed' },
    { name:'Fabrication 50%',            amount:145800, date:'May 20', status:'Billed' },
    { name:'Install & commissioning',    amount:145800, date:'Jul 30', status:'In Progress' },
    { name:'Acceptance & handover',      amount:97200,  date:'Aug 15', status:'Planned' },
  ],
  team:[
    { name:'Liam Cardoso',  role:'Project Manager',     av:'LC', clr:'#3457D5', alloc:40, rate:120 },
    { name:'Aisha Karim',   role:'Lead Controls Eng.',  av:'AK', clr:'#0B6E7C', alloc:100, rate:96 },
    { name:'Marco Reyes',   role:'Mechanical Eng.',     av:'MR', clr:'#6536BE', alloc:80, rate:88 },
    { name:'Tom Fielding',  role:'Field Technician',    av:'TF', clr:'#9A6712', alloc:100, rate:64 },
  ],
  activities:[
    { kind:'current', when:'Jun 18, 2026 · 09:15', what:'Milestone <b>Install &amp; commissioning</b> 60% complete', who:'Aisha Karim' },
    { kind:'sys', when:'Jun 12, 2026 · 16:40', what:'Change order <b>CO-03</b> approved — +$18k scope (safety fencing)', who:'Liam Cardoso', change:{field:'Contract value',old:'$468,000',new:'$486,000',reason:'Added safety fencing per site audit'} },
    { kind:'add', when:'May 20, 2026 · 11:02', what:'Milestone <b>Fabrication 50%</b> billed — invoice INV-26-0331', who:'Finance' },
    { kind:'add', when:'Mar 04, 2026 · 08:30', what:'Project created from won opportunity OPP-26-0091', who:'Liam Cardoso' },
  ],
};
