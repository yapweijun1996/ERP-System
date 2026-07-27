/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   core — DB object, company, fiscal year/period, user, nav, notifications, approvals, shared helpers (money/statusCap)
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ============================================================
   ARIA ERP — sample dataset: Northwind Manufacturing (discrete mfg)
   One tenant, base currency USD, FY2026 period P06 (June).
   ============================================================ */
const DB = {};

DB.company = { name:'Northwind Manufacturing', branch:'Kuala Lumpur HQ', currency:'USD', period:'FY2026 · P06', periodLabel:'June 2026', env:'PRODUCTION' };
/* fiscal-year configuration (drives the topbar period switcher + setup) */
/* multiple fiscal years — users can switch the working FY and set up new ones */
DB.fiscalYears = [
  { fyLabel:'FY2025', startYear:2025, startMonth:1, scheme:'Monthly (12 periods)', periodCount:12, currentPeriod:12, selectedPeriod:12, state:'Closed' },
  { fyLabel:'FY2026', startYear:2026, startMonth:1, scheme:'Monthly (12 periods)', periodCount:12, currentPeriod:6,  selectedPeriod:6,  state:'Current' },
  { fyLabel:'FY2027', startYear:2027, startMonth:1, scheme:'Monthly (12 periods)', periodCount:12, currentPeriod:1,  selectedPeriod:1,  state:'Future' }
];
/* DB.fiscal is the working fiscal year (a reference into DB.fiscalYears) */
DB.fiscal = DB.fiscalYears[1];
DB.user = { name:'Dana Reyes', email:'dana.reyes@northwind.co', initials:'DR', role:'Operations Director',
  perms:{ post:true, approve:true, salaryView:false, costView:true } };

/* ---- navigation: 4 domains × 16 modules. screen = first route ---- */
DB.nav = [
  { group:'Operations', items:[
    { id:'home', label:'Home', icon:'home', route:'dashboard' },
    { id:'sales', label:'Sales', icon:'bag', route:'sales-home' },
    { id:'purchasing', label:'Purchasing', icon:'cart', route:'purchasing-home' },
    { id:'crm', label:'CRM', icon:'handshake', route:'crm-pipeline' },
    { id:'inventory', label:'Inventory', icon:'box', route:'stock-on-hand' },
    { id:'warehouse', label:'Warehouse', icon:'warehouse', route:'picking' },
    { id:'manufacturing', label:'Manufacturing', icon:'factory', route:'work-orders' },
    { id:'quality', label:'Quality', icon:'checkc', route:'qc-inspection' },
  ]},
  { group:'Finance & Back office', items:[
    { id:'mywork', label:'My Work', icon:'user', route:'my-leave' },
    { id:'finance', label:'Finance', icon:'book', route:'gl' },
    { id:'hr', label:'HR / Payroll', icon:'people', route:'hr-directory' },
    { id:'project', label:'Projects', icon:'project', route:'project-pl' },
    { id:'service', label:'Service', icon:'wrench', route:'service-ticket' },
    { id:'asset', label:'Fixed Assets', icon:'asset', route:'asset-register' },
  ]},
  { group:'Platform', items:[
    { id:'workflow', label:'Approvals', icon:'flow', route:'po-approval' },
    { id:'bi', label:'Reporting / BI', icon:'chart', route:'bi-dashboard' },
    { id:'admin', label:'Admin', icon:'shield', route:'user-mgmt' },
    { id:'integration', label:'Integration', icon:'plug', route:'integration' },
  ]},
];

/* `DB.built` — the set of routes that are actually implemented — is defined in
   app.js as a live getter derived from the SCREENS registry (the single source
   of truth for built routes). It can't live here because data-core.js loads
   before any screen file has registered into SCREENS. navigate() also gates on
   SCREENS[route], so the two can never drift. */

/* ---- approvals queue (cross-module) ---- */
DB.approvals = [
  { no:'PO-26-0291', kind:'Purchase Order', who:'R. Haddad', amt:88500, age:'2h', risk:'high', route:'po-approval' },
  { no:'SO-26-0418', kind:'Sales Discount', who:'J. Okafor', amt:96420, age:'5h', risk:'warn', route:'sales-order' },
  { no:'JE-26-0611', kind:'Journal Entry', who:'A. Costa', amt:4280, age:'6h', risk:'low', route:'journal-entry' },
  { no:'LV-26-0331', kind:'Leave Request', who:'M. Silva', amt:null, age:'1d', risk:'low', route:'leave-approval' },
  { no:'PO-26-0290', kind:'Purchase Order', who:'R. Haddad', amt:64200, age:'1d', risk:'warn', route:'po-approval' },
  { no:'ADJ-26-0044', kind:'Stock Adjustment', who:'Dana Reyes', amt:null, age:'1d', risk:'warn', route:'stock-movement' },
  { no:'PV-26-0203', kind:'Payment Voucher', who:'A. Costa', amt:42600, age:'2d', risk:'low', route:'payment-voucher' },
];

/* Canonical notifications are loaded from account/notifications after auth. */
DB.notifications = [];
DB.notifCats = { approval:'Approval', system:'System', inventory:'Inventory', quality:'Quality', finance:'Finance', sales:'Sales' };

/* saved views per listing */
DB.savedViews = {
  'sales-orders':['All open orders','My orders','Awaiting approval','Overdue payment','This week'],
};

/* helpers */
function money(n,cur){ if(n==null) return '—'; const s=(cur&&cur!=='USD')?cur+' ':'$'; return s+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function money0(n){ return '$'+Math.round(n).toLocaleString('en-US'); }
function num(n){ return n.toLocaleString('en-US'); }
function statusCap(st){
  const map={
    'Draft':'neutral','Submitted':'info','Pending Approval':'warn','Approved':'accent','Rejected':'danger',
    'Posted':'teal','Partially Completed':'info','Completed':'ok','Cancelled':'neutral','Voided':'danger',
    'Closed':'neutral','Locked':'neutral','Active':'ok','On hold':'warn','In stock':'ok','Low':'warn',
    'Reorder':'warn','Backordered':'danger','Out of stock':'danger',
    'Paid':'ok','Unpaid':'neutral','Partial':'info','Overdue':'danger','—':'neutral',
    'High':'danger',
    'Planned':'neutral','Released':'accent','In Progress':'info','On Hold':'warn','Blocked':'danger',
    'Pass':'ok','Fail':'danger','In Inspection':'info','Scheduled':'info','Quarantine':'warn','Concession':'violet','Open':'warn',
    'Resolved':'ok','Critical':'danger','In use':'ok','Under maintenance':'warn','Idle':'neutral','Disposed':'danger',
    'In warranty':'ok','Out of warranty':'neutral','Contract':'violet','Expiring':'warn','Expired':'danger',
  };
  return map[st]||'neutral';
}

/* ============================================================
   TONES — single source of truth for per-document status→tone maps.
   These intentionally override the generic statusCap() mapping where a
   status means something different in context (e.g. 'Received' is info
   for an RMA but ok elsewhere). Defined here, in the first-loaded file,
   so screen files never depend on each other's load order to read them.
   Back-compat aliases (ENQ_TONE, PO_TONE, …) are derived below so every
   existing call site keeps working unchanged.
   ============================================================ */
const TONES = {
  /* sales */
  enquiry:           { New:'info', Quoted:'accent', Converted:'ok', 'On hold':'warn', Lost:'danger' },
  quotation:         { Draft:'neutral', Sent:'info', Accepted:'accent', Converted:'ok', Rejected:'danger', Expired:'warn' },
  delivery:          { Draft:'neutral', Picking:'info', Packed:'info', Shipped:'accent', Delivered:'ok', 'Partially Delivered':'warn', Cancelled:'danger' },
  invoice:           { Draft:'neutral', Posted:'info', 'Partially Paid':'warn', Paid:'ok', Overdue:'danger', Cancelled:'neutral' },
  rma:               { Requested:'info', Approved:'accent', Rejected:'danger', Received:'info', Inspected:'warn', Credited:'ok', Closed:'neutral' },
  creditNote:        { Draft:'neutral', Posted:'info', Applied:'ok' },
  debitNote:         { Draft:'neutral', Posted:'info' },
  priceList:         { Active:'ok', Scheduled:'info', Archived:'neutral' },
  discountRule:      { Active:'ok', Scheduled:'info', Inactive:'neutral' },
  commission:        { Approved:'ok', Pending:'warn', Review:'info' },
  /* purchasing */
  pr:                { Draft:'neutral', Submitted:'info', 'Pending Approval':'warn', Approved:'accent', Rejected:'danger', Converted:'ok', Cancelled:'neutral' },
  rfq:               { Draft:'neutral', Sent:'info', 'Partially Responded':'warn', Responded:'accent', Awarded:'ok', Closed:'neutral', Cancelled:'neutral' },
  supplierQuote:     { Draft:'neutral', Received:'info', Selected:'accent', Rejected:'danger', Expired:'warn', Converted:'ok' },
  grn:               { Draft:'neutral', Received:'info', 'Partially Received':'warn', 'Pending QC':'warn', Accepted:'ok', Rejected:'danger', Posted:'teal', Cancelled:'neutral' },
  supplierInvoice:   { Draft:'neutral', 'Pending Matching':'warn', Matched:'accent', Mismatch:'danger', Posted:'teal', 'Partially Paid':'info', Paid:'ok', Overdue:'danger', Cancelled:'neutral' },
  purchaseReturn:    { Draft:'neutral', Submitted:'info', Approved:'accent', Requested:'info', Returned:'warn', Credited:'ok', Rejected:'danger', Closed:'neutral', Cancelled:'neutral' },
  supplierCreditNote:{ Draft:'neutral', Applied:'ok', Posted:'teal', Cancelled:'neutral' },
  supplierDebitNote: { Draft:'neutral', Posted:'teal', Cancelled:'neutral' },
  supplierPriceList: { Active:'ok', Expiring:'warn', Expired:'danger', Draft:'neutral' },
  po:                { 'Pending Approval':'warn', Approved:'accent', 'Partially Completed':'info', Completed:'ok', Draft:'neutral', Cancelled:'neutral' },
};
/* back-compat aliases — derived from TONES, defined once (was scattered across screen files) */
const ENQ_TONE=TONES.enquiry, QUO_TONE=TONES.quotation, DO_TONE=TONES.delivery, INV_TONE=TONES.invoice,
      RMA_TONE=TONES.rma, CN_TONE=TONES.creditNote, DN_TONE=TONES.debitNote, PL_TONE=TONES.priceList,
      DRULE_TONE=TONES.discountRule, COMM_TONE=TONES.commission,
      PR_TONE=TONES.pr, RFQ_TONE=TONES.rfq, SQ_TONE=TONES.supplierQuote, GRN_TONE=TONES.grn,
      SINV_TONE=TONES.supplierInvoice, PRET_TONE=TONES.purchaseReturn, SCN_TONE=TONES.supplierCreditNote,
      SDN_TONE=TONES.supplierDebitNote, SPL_TONE=TONES.supplierPriceList, PO_TONE=TONES.po;
