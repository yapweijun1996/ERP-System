/* ============================================================
   ARIA ERP — sample dataset (split from data.js)
   integration — connector stats, connectors, sync logs, import wizard
   Load order matters: data-core.js declares `const DB` and the
   shared helpers and MUST load first; master data loads before the
   sales / CRM / service files that reference DB.customers.
   ============================================================ */

/* ===================== INTEGRATION (module 16) ===================== */
DB.integrationStats = { active:8, calls:'48,210', success:99.2, failed:384, queued:12 };
DB.connectors = [
  { name:'Stripe',            cat:'Payments',       dir:'Two-way', status:'Connected', last:'3m ago',  freq:'Hourly',   records:'1,284',  health:'ok',      ic:'coins' },
  { name:'Salesforce CRM',    cat:'CRM',            dir:'Two-way', status:'Connected', last:'12m ago', freq:'15 min',   records:'642',    health:'ok',      ic:'handshake' },
  { name:'DHL Express',       cat:'Shipping',       dir:'Outbound',status:'Connected', last:'1m ago',  freq:'Realtime', records:'318',    health:'ok',      ic:'truck' },
  { name:'CIMB Bank Feed',    cat:'Banking',        dir:'Inbound', status:'Error',     last:'2h ago',  freq:'Daily',    records:'0',      health:'danger',  ic:'bank' },
  { name:'Avalara Tax',       cat:'Tax',            dir:'Outbound',status:'Connected', last:'8m ago',  freq:'Realtime', records:'5,210',  health:'ok',      ic:'percent' },
  { name:'Microsoft 365',     cat:'Email / Calendar',dir:'Two-way',status:'Connected', last:'5m ago',  freq:'Realtime', records:'2,940',  health:'ok',      ic:'comment' },
  { name:'Shopify Store',     cat:'Sales channel',  dir:'Inbound', status:'Paused',    last:'1d ago',  freq:'15 min',   records:'0',      health:'neutral', ic:'bag' },
  { name:'Power BI',          cat:'Analytics',      dir:'Outbound',status:'Connected', last:'22m ago', freq:'Hourly',   records:'18,400', health:'ok',      ic:'chart' },
  { name:'Webhook · WMS',     cat:'Warehouse',      dir:'Outbound',status:'Connected', last:'30s ago', freq:'Realtime', records:'9,120',  health:'ok',      ic:'link' },
  { name:'SAP Ariba',         cat:'Procurement',    dir:'Two-way', status:'Setup',     last:'—',       freq:'—',        records:'—',      health:'neutral', ic:'cart' },
];
DB.syncLogs = [
  { t:'14:42:08', conn:'CIMB Bank Feed',  event:'bank.statement.import', dir:'In',  status:'Failed',  rec:'0',        dur:'1.2s',  detail:'401 — OAuth token expired, re-authorize connector' },
  { t:'14:41:55', conn:'Webhook · WMS',   event:'stock.moved → WMS',     dir:'Out', status:'Success', rec:'14',       dur:'0.3s',  detail:'Bin transfers pushed to warehouse system' },
  { t:'14:40:31', conn:'Stripe',          event:'payment.succeeded',     dir:'In',  status:'Success', rec:'6',        dur:'0.5s',  detail:'Auto-matched to AR receipts' },
  { t:'14:39:10', conn:'Avalara Tax',     event:'tax.calculate',         dir:'Out', status:'Success', rec:'22',       dur:'0.2s',  detail:'SO-26-0418 tax lines computed' },
  { t:'14:38:02', conn:'Salesforce CRM',  event:'opportunity.sync',      dir:'In',  status:'Partial', rec:'38 / 41',  dur:'2.1s',  detail:'3 records skipped — missing email address' },
  { t:'14:35:44', conn:'DHL Express',     event:'shipment.label',        dir:'Out', status:'Success', rec:'5',        dur:'0.8s',  detail:'Labels generated for DO-26-0204' },
  { t:'14:34:19', conn:'Shopify Store',   event:'order.import',          dir:'In',  status:'Retry',   rec:'—',        dur:'—',     detail:'Connector paused by user — queued' },
  { t:'14:30:05', conn:'Power BI',        event:'dataset.refresh',       dir:'Out', status:'Success', rec:'18,400',   dur:'41.0s', detail:'Sales & inventory cubes refreshed' },
  { t:'14:22:50', conn:'Microsoft 365',   event:'calendar.push',         dir:'Out', status:'Success', rec:'12',       dur:'0.4s',  detail:'Service visits synced to technician calendars' },
  { t:'14:15:33', conn:'Stripe',          event:'payout.reconcile',      dir:'In',  status:'Success', rec:'3',        dur:'0.6s',  detail:'Daily payout matched to bank deposit' },
];
/* import wizard sample */
DB.importJob = {
  file:'customers_q2.csv', rows:1284, size:'412 KB', target:'Customer master',
  ready:1256, warnings:22, errors:6,
  mapping:[
    { src:'Company Name',   field:'Customer name',     status:'Mapped' },
    { src:'Reg. No',        field:'Registration no.',  status:'Mapped' },
    { src:'Email',          field:'Primary email',     status:'Mapped' },
    { src:'Terms',          field:'Payment terms',     status:'Mapped' },
    { src:'Credit',         field:'Credit limit',      status:'Mapped' },
    { src:'Sales Rep',      field:'Account owner',     status:'Review' },
    { src:'Tax ID',         field:'— unmapped —',      status:'Skip' },
  ],
  preview:[
    { a:'Apex Industrial Sdn Bhd', b:'CUST-0102', c:'ar@apex.example', d:'Net 30', ok:true },
    { a:'Meridian Robotics',       b:'CUST-0007', c:'e.marsh@meridian.co', d:'Net 45', ok:true },
    { a:'Harbor Freight Co.',      b:'—', c:'(missing email)', d:'Net 30', ok:false },
    { a:'Delta Process Systems',   b:'CUST-0210', c:'buy@deltaproc.example', d:'Net 60', ok:true },
  ],
};
