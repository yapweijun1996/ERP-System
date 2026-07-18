/* ============================================================
   ARIA ERP — app shell controller: router, nav, palette, theme
   ============================================================ */
/* SCREENS is declared in ui.js (loads before screen files) */
const ROUTE_MODULE = {};       // route -> module id (for active state)
let CURRENT_ROUTE = null;
let CURRENT_ROUTE_PARAMS = {};
let SCREEN_RENDER_SEQUENCE = 0;
const DEMO_AUTH_KEY = 'aria-demo-auth';

function demoUser(){
  return DB.user || { name:'Demo Admin', email:'admin@example.com', initials:'DA', role:'Administrator' };
}
function demoAuthSession(){
  try{ return JSON.parse(localStorage.getItem(DEMO_AUTH_KEY)||'null'); }catch(e){ return null; }
}
function isDemoSignedIn(){
  const s=demoAuthSession();
  return !!(s&&s.signedIn);
}
function setAuthShell(onLogin){
  document.body.classList.toggle('auth-locked',!!onLogin);
  const app=$('#app'), tabs=$('#tabbar');
  if(app) app.setAttribute('aria-hidden',onLogin?'true':'false');
  if(tabs) tabs.setAttribute('aria-hidden',onLogin?'true':'false');
}
function syncAccountUi(){
  const u=demoUser();
  const av=$('#avatarBtn');
  if(av){ av.textContent=u.initials; av.setAttribute('data-tip','Account · '+u.name); }
  const menu=$('#acctMenu');
  if(menu){
    const headAv=menu.querySelector('.acct-head .av');
    const name=menu.querySelector('.acct-head .who b');
    const email=menu.querySelector('.acct-head .who small');
    const role=menu.querySelector('.acct-role');
    if(headAv) headAv.textContent=u.initials;
    if(name) name.textContent=u.name;
    if(email) email.textContent=u.email;
    if(role) role.innerHTML=`${ic('shield')}${esc(u.role||'Demo user')}`;
  }
}
/* TASK-019: shown instead of the normal shell when VITE_DATA_MODE=api and the
   TASK-011 API server isn't reachable yet. Must not read DB.* — nothing has
   been populated (there is no PGlite boot in api mode), unlike renderLogin(). */
function renderApiUnavailable(){
  setAuthShell(true);
  if(typeof closeAllPops==='function') closeAllPops();
  let host=document.getElementById('apiUnavailableView');
  if(!host){
    host=document.createElement('main');
    host.id='apiUnavailableView';
    host.className='auth-view';
    host.setAttribute('aria-label','API unavailable');
    document.body.insertBefore(host,$('#app'));
  }
  host.innerHTML=`<section class="auth-panel">
    <div class="auth-brand"><span class="mark">${ic('box')}</span><span><b>Aria ERP</b><small>Production mode</small></span></div>
    <h2 class="wiz-h">Waiting for the API</h2>
    <p class="wiz-p">This build was compiled with <code>VITE_DATA_MODE=api</code>, but no API server
      answered at <code>/health</code>. Start the TASK-011 API server (or Docker Compose stack once
      TASK-012 ships), then retry.</p>
    <div class="set-savebar" style="border-radius:12px;margin-top:16px"><span></span><div class="grow"></div>
      ${btn('Retry',{icon:'refresh',cls:'primary',attrs:'id="apiRetryBtn"'})}
    </div>
  </section>`;
  host.querySelector('#apiRetryBtn').addEventListener('click',()=>location.reload());
}
function renderLogin(){
  const u=demoUser();
  /* TASK-024: in api mode, DB.company is either unset or still holds stale
     mock data from data-core.js's static defaults (no dashboard load without
     a session — see erp-system-api-adapter.js) — never show it pre-auth. Demo
     mode's adapter always finishes loading real data before renderLogin() can
     be reached, so DB.company.name is trustworthy there. */
  const apiMode=typeof window.erpDataMode==='function' && window.erpDataMode()==='api';
  const companyLabel=(!apiMode && DB.company && DB.company.name) ? (esc(DB.company.name)+' · Static demo') : (apiMode?'Production':'Static demo');
  setAuthShell(true);
  closeAllPops();
  closePalette();
  closeModal();
  let auth=$('#authView');
  if(!auth){
    auth=document.createElement('main');
    auth.id='authView';
    auth.className='auth-view';
    auth.setAttribute('aria-label','Sign in');
    document.body.insertBefore(auth,$('#app'));
  }
  auth.innerHTML=`<section class="auth-panel">
    <div class="auth-brand">
      <span class="mark">${ic('box')}</span>
      <span><b>Aria ERP</b><small>${companyLabel}</small></span>
    </div>
    <div class="auth-copy">
      <h1>Sign in</h1>
      <p>${apiMode
        ? 'Sign in with your account. Sessions are server-side; this browser only holds a session cookie.'
        : 'Use the demo account to open the ERP workspace. This static build stores only a local browser session.'}</p>
    </div>
    <form class="auth-form" id="loginForm">
      <div class="fld"><span>Email</span><input id="loginEmail" type="email" autocomplete="username" value="${apiMode?'':esc(u.email)}" placeholder="${apiMode?'admin@acme.co':''}"></div>
      <div class="fld"><span>Password</span><input id="loginPassword" type="password" autocomplete="current-password" placeholder="${apiMode?'':'Any demo password'}"></div>
      <div class="auth-error" id="loginError" role="alert"></div>
      <button class="btn primary lg" type="submit">${ic('signout')}<span>Sign in</span></button>
      ${apiMode?'':`<button class="btn soft lg" type="button" id="demoLoginBtn">${ic('user')}<span>Continue as ${esc(u.name)}</span></button>`}
    </form>
    <div class="auth-foot">
      ${apiMode
        ? `<span class="cap ok"><span class="dot"></span>Production</span><span>Real session — see docs/STATUS.md for current auth scope</span>`
        : `<span class="cap ok"><span class="dot"></span>Demo only</span><span>No server auth or real credentials</span>`}
    </div>
  </section>`;
  const doLogin=(email)=>{
    try{ localStorage.setItem(DEMO_AUTH_KEY,JSON.stringify({ signedIn:true, email:email||u.email, at:new Date().toISOString() })); }catch(e){}
    location.reload();
  };
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=$('#loginEmail').value.trim()||(apiMode?'':u.email);
    const pass=$('#loginPassword').value.trim();
    if(apiMode){
      if(!email||!pass){ $('#loginError').textContent='Enter your email and password.'; return; }
      const btnEl=$('#loginForm').querySelector('button[type="submit"]');
      btnEl&&btnEl.setAttribute('disabled','');
      try{
        await window.ErpSystemDemo.login(email,pass);
        location.reload();
      }catch(err){
        $('#loginError').textContent=(err&&err.message)||'Sign in failed.';
        btnEl&&btnEl.removeAttribute('disabled');
      }
      return;
    }
    if(!pass){
      $('#loginError').textContent='Enter any demo password, or use Continue as demo user.';
      $('#loginPassword').focus();
      return;
    }
    if(window.ErpSystemDemo&&typeof window.ErpSystemDemo.login==='function'){
      await window.ErpSystemDemo.login(email,pass);
      location.reload();
      return;
    }
    doLogin(email);
  });
  const demoBtn=$('#demoLoginBtn');
  demoBtn&&demoBtn.addEventListener('click',async ()=>{
    if(window.ErpSystemDemo&&typeof window.ErpSystemDemo.login==='function'){
      await window.ErpSystemDemo.login(u.email);
      location.reload();
      return;
    }
    doLogin(u.email);
  });
  setTimeout(()=>$('#loginPassword').focus(),60);
}
async function signOutDemo(){
  /* api mode: destroy the real server-side session, not just a local flag. */
  if(window.ErpSystemDemo&&typeof window.ErpSystemDemo.logout==='function'){
    try{ await window.ErpSystemDemo.logout(); }catch(e){}
  }
  try{ localStorage.removeItem(DEMO_AUTH_KEY); }catch(e){}
  try{ history.replaceState({},'',location.pathname+location.search); }catch(e){}
  location.reload();
}

function isModuleAdmin(){
  const role=String(DB.user&&DB.user.role||'').toLowerCase().replace(/\s+/g,'');
  return role==='admin'||role==='superadmin'||role.includes('superadmin');
}
function currentMasterFn(){
  return (DB.erpSystem&&DB.erpSystem.scope&&DB.erpSystem.scope.masterFn)
    || (DB.masters&&DB.masters[0]&&DB.masters[0].id)
    || (DB.company&&DB.company.name)
    || 'default-master';
}
function moduleControlKey(){ return 'aria-module-activation:'+currentMasterFn(); }
function moduleControlItems(){
  return DB.nav.flatMap(g=>g.items.map(m=>({
    ...m,
    group:g.group,
    required:m.id==='home'||m.id==='admin',
  })));
}
function defaultModuleControl(){
  const cfg={};
  moduleControlItems().forEach(m=>{ cfg[m.id]={ visible:true, active:true }; });
  return cfg;
}
function readModuleControl(){
  const cfg=defaultModuleControl();
  try{
    const saved=JSON.parse(localStorage.getItem(moduleControlKey())||'{}');
    Object.keys(cfg).forEach(id=>{
      if(saved[id]){
        cfg[id].visible=saved[id].visible!==false;
        cfg[id].active=saved[id].active!==false;
      }
    });
  }catch(e){}
  moduleControlItems().forEach(m=>{
    if(m.required) cfg[m.id]={ visible:true, active:true };
    if(!cfg[m.id].visible) cfg[m.id].active=false;
  });
  return cfg;
}
function writeModuleControl(cfg){
  moduleControlItems().forEach(m=>{
    if(m.required) cfg[m.id]={ visible:true, active:true };
    if(cfg[m.id]&&!cfg[m.id].visible) cfg[m.id].active=false;
  });
  try{ localStorage.setItem(moduleControlKey(),JSON.stringify(cfg)); }catch(e){}
}
function moduleState(moduleId){
  return readModuleControl()[moduleId]||{ visible:true, active:true };
}
function notificationStateKey(){ return 'aria-notification-state:'+currentMasterFn(); }
function readNotificationState(){
  try{
    const saved=JSON.parse(localStorage.getItem(notificationStateKey())||'{}');
    return saved&&typeof saved==='object'&&saved.items&&typeof saved.items==='object'?saved:{ items:{} };
  }catch(e){ return { items:{} }; }
}
function writeNotificationState(state){
  try{ localStorage.setItem(notificationStateKey(),JSON.stringify(state)); }catch(e){}
}
function saveNotificationState(id, patch){
  if(!id) return;
  const state=readNotificationState();
  state.items[id]={ ...(state.items[id]||{}), ...patch };
  writeNotificationState(state);
}
function applyNotificationState(){
  const state=readNotificationState();
  (DB.notifications||[]).forEach(n=>{
    const st=state.items[n.id];
    if(!st) return;
    if(st.read) n.unread=false;
    if(st.dismissed){ n.dismissed=true; n.unread=false; }
  });
}
function markNotificationRead(id){
  const n=(DB.notifications||[]).find(x=>x.id===id);
  if(!n) return null;
  n.unread=false;
  saveNotificationState(id,{ read:true });
  return n;
}
function dismissNotification(id){
  const n=(DB.notifications||[]).find(x=>x.id===id);
  if(!n) return null;
  n.dismissed=true;
  n.unread=false;
  saveNotificationState(id,{ read:true, dismissed:true });
  return n;
}
function markAllNotificationsRead(){
  const state=readNotificationState();
  (DB.notifications||[]).forEach(n=>{
    if(n.dismissed) return;
    n.unread=false;
    state.items[n.id]={ ...(state.items[n.id]||{}), read:true };
  });
  writeNotificationState(state);
}
function dismissAllNotifications(){
  const state=readNotificationState();
  (DB.notifications||[]).forEach(n=>{
    n.dismissed=true;
    n.unread=false;
    state.items[n.id]={ ...(state.items[n.id]||{}), read:true, dismissed:true };
  });
  writeNotificationState(state);
}
function routeModuleId(route){ return ROUTE_MODULE[route]; }
function routeAllowed(route){
  const mod=routeModuleId(route);
  if(!mod||mod==='settings') return true;
  const st=moduleState(mod);
  return st.visible&&st.active;
}
function routeShownInCommands(route){
  const mod=routeModuleId(route);
  if(!mod||mod==='settings') return true;
  const st=moduleState(mod);
  return st.visible&&st.active;
}
function moduleBlockedPanel(route){
  const mod=routeModuleId(route);
  const item=moduleControlItems().find(m=>m.id===mod);
  const label=item?item.label:(mod||route);
  const st=mod?moduleState(mod):{ visible:true, active:true };
  const reason=st.visible?'inactive for this client':'hidden for this client';
  const action=isModuleAdmin()
    ? btn('Open Module Activation Control',{icon:'sliders',cls:'primary',attrs:"onclick=\"navigate('module-activation-control')\""})
    : '';
  return `<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,'Module access'])}
      <div class="h1row"><h1>${esc(label)} unavailable</h1>${cap(reason,'warn')}</div>
      <div class="h1sub">This module is controlled at master/client level for ${esc(currentMasterFn())}.</div>
    </div>
    ${statePanel({icon:'lock',title:'Module is not available',body:'Ask an admin or superadmin to enable this module in Module Activation Control.',action})}
  </section></div>`;
}
function ensureModuleActivationMenuItem(){
  const menu=$('#acctMenu'); if(!menu) return;
  const existing=menu.querySelector('[data-acct="module-control"]');
  if(!isModuleAdmin()){ if(existing) existing.remove(); return; }
  if(existing) return;
  const firstSection=menu.querySelector('.menu-section');
  if(!firstSection) return;
  const btnEl=document.createElement('button');
  btnEl.className='menu-item';
  btnEl.setAttribute('data-acct','module-control');
  btnEl.innerHTML=`${ic('sliders')}<span>Module Activation Control</span><span class="meta">${ic('arrowR')}</span>`;
  firstSection.appendChild(btnEl);
}

/* TASK-024: demo mode only — "allow switching among seeded users". Not offered
   in api mode (DB.erpSystem.users is a demo-adapter-only field; switching to
   another real user without their password isn't offered — sign out and sign
   in as them instead). */
function ensureUserSwitcherMenuItem(){
  const menu=$('#acctMenu'); if(!menu) return;
  const existing=menu.querySelector('[data-acct="switch-user"]');
  const users=(DB.erpSystem&&DB.erpSystem.users)||[];
  if(users.length<2){ if(existing) existing.remove(); return; }
  if(existing) return;
  const firstSection=menu.querySelector('.menu-section');
  if(!firstSection) return;
  const btnEl=document.createElement('button');
  btnEl.className='menu-item';
  btnEl.setAttribute('data-acct','switch-user');
  btnEl.innerHTML=`${ic('people')}<span>Switch demo user</span><span class="meta">${ic('arrowR')}</span>`;
  firstSection.appendChild(btnEl);
}
function openUserSwitcher(){
  const users=(DB.erpSystem&&DB.erpSystem.users)||[];
  const rows=users.map(u=>{
    const name=u.full_name||u.email;
    const current=DB.user&&DB.user.email===u.email;
    return `<button class="menu-item" style="width:100%" ${current?'disabled':''} data-switch-email="${esc(u.email)}">
      ${ic(u.is_superadmin?'shield':'user')}
      <span>${esc(name)}<small style="display:block;color:var(--muted);font-size:11px">${esc(u.email)} · ${u.is_superadmin?'Superadmin':'Viewer'}</small></span>
      <span class="meta">${current?ic('check'):''}</span></button>`;
  }).join('');
  appModal({ icon:'people', title:'Switch demo user', body:`<div style="display:grid;gap:4px">${rows}</div>`, width:360 });
  $$('#modalEl [data-switch-email]').forEach(b=>b.addEventListener('click',async ()=>{
    const email=b.dataset.switchEmail;
    closeModal();
    if(window.ErpSystemDemo&&typeof window.ErpSystemDemo.switchUser==='function'){
      try{ await window.ErpSystemDemo.switchUser(email); }catch(e){}
    }
    location.reload();
  }));
}

/* map every module's primary route + known sub-routes to a module id */
const SUBROUTES = {
  sales:['sales-home','sales-orders','sales-order','quotation','delivery-order','sales-invoice','new-sales-order',
    'enquiries','quotations','so-approvals','delivery-orders','sales-invoices','sales-returns','sales-return',
    'credit-notes','credit-note','debit-notes','price-lists','discount-mgmt','credit-control','sales-commission',
    'sales-reports','report-sales-customer','report-sales-rep','report-quote-conversion','report-generic','new-quotation','txn-view'], purchasing:['purchasing-home','suppliers','purchase-requisitions','rfqs','supplier-quotations','purchase-orders','po-approval','po-approvals','goods-receipts','goods-receipt','supplier-invoices','supplier-invoice','purchase-requisitions','purchase-request','purchase-returns','supplier-credit-notes','supplier-debit-notes','supplier-price-lists','landed-cost','vendor-performance','purchasing-reports','report-pur-supplier','report-pur-buyer','report-pur-price-var','report-pur-vendor','report-pur-generic','new-purchase-order','pur-txn-view'],
  inventory:['stock-on-hand','item-master','new-item','stock-movement','new-stock-adjustment','inv-valuation'], warehouse:['picking'],
  crm:['crm-pipeline','opportunity','new-opportunity','crm-customer'],
  manufacturing:['work-orders','work-order','new-work-order','bom','mrp'],
  quality:['qc-inspection','qc-report','ncr'],
  service:['service-ticket','service-order','service-contracts'],
  asset:['asset-register','asset-detail','depreciation'],
  project:['project-pl','project-detail','timesheet'],
  integration:['integration','integration-logs','data-import'],
  finance:['gl','account-ledger','journal-entry','new-journal-entry','payment-voucher','new-payment-voucher','bank-rec','pnl','ar-aging'], hr:['leave-approval','hr-directory','employee','new-employee','payroll-run','payslip'],
  workflow:['po-approval'], bi:['bi-dashboard','sales-analysis','stock-aging'], admin:['role-permission','master-control','user-mgmt','audit-log','sys-settings','module-activation-control'],
};
DB.nav.forEach(g=>g.items.forEach(m=>{ ROUTE_MODULE[m.route]=m.id; }));
Object.entries(SUBROUTES).forEach(([mod,routes])=>routes.forEach(r=>{ if(!ROUTE_MODULE[r]) ROUTE_MODULE[r]=mod; }));
ROUTE_MODULE['settings']='settings';

/* ---------- screen maturity / productionization metadata ---------- */
/* Route-level, not module-level: Purchasing and CRM already contain a mix of
   canonical PGlite-backed routes and original sample-data routes. New vertical
   slices move one route at a time from preview -> canonical. */
const CANONICAL_SCREEN_ROUTES = new Set([
  'dashboard',
  'sales-orders','sales-order','sales-invoices','sales-invoice',
  'stock-on-hand','stock-movement','inv-valuation',
  'gl','account-ledger','journal-entry','pnl','ar-aging',
  'suppliers','purchase-orders','goods-receipts','supplier-invoices','new-purchase-order',
  'crm-pipeline','new-opportunity',
  'settings',
  'picking',
  'new-stock-adjustment',
  'work-orders','work-order','new-work-order',
]);
const API_SCREEN_ROUTES = new Set([
  'dashboard',
  'stock-on-hand','stock-movement','inv-valuation',
  'sales-orders','sales-order','sales-invoices','sales-invoice',
  'gl','account-ledger','journal-entry','pnl','ar-aging',
  'suppliers','purchase-orders','goods-receipts','supplier-invoices','new-purchase-order',
  'crm-pipeline','new-opportunity',
  'settings',
  'picking',
  'new-stock-adjustment',
  'work-orders','work-order','new-work-order',
]);
const SCREEN_ACTIVE_ALIASES = {
  quotation:'quotations','delivery-order':'delivery-orders','sales-invoice':'sales-invoices',
  'sales-order':'sales-orders','new-sales-order':'sales-orders','sales-return':'sales-returns',
  'credit-note':'credit-notes','new-quotation':'quotations','txn-view':'enquiries',
  'purchase-request':'purchase-requisitions','goods-receipt':'goods-receipts',
  'supplier-invoice':'supplier-invoices','po-approval':'po-approvals',
  'new-purchase-order':'purchase-orders','pur-txn-view':'purchase-orders',
  'new-item':'item-master','new-stock-adjustment':'stock-movement',
  'work-order':'work-orders','new-work-order':'work-orders',
  'qc-report':'qc-inspection',
  opportunity:'crm-pipeline','new-opportunity':'crm-pipeline','crm-customer':'crm-pipeline',
  employee:'hr-directory','new-employee':'hr-directory','payslip':'payroll-run',
  'project-detail':'project-pl',
  'asset-detail':'asset-register',
  'new-journal-entry':'journal-entry','new-payment-voucher':'payment-voucher',
};
const MODULE_DEFS = {
  finance:{ labelKey:'nav.finance', home:'gl', items:[
    ['gl','General Ledger','book'],['account-ledger','Account Ledger','list'],
    ['journal-entry','Journal Entries','receipt'],['payment-voucher','Payment Vouchers','coins'],
    ['bank-rec','Bank Reconciliation','refresh'],['pnl','Profit & Loss','chart'],
    ['ar-aging','AR Aging','clock'],
  ]},
  crm:{ labelKey:'nav.crm', home:'crm-pipeline', items:[
    ['crm-pipeline','Pipeline','flow'],['crm-customer','Customer 360','user'],
  ]},
  warehouse:{ labelKey:'nav.warehouse', home:'picking', items:[
    ['picking','Picking','warehouse'],
  ]},
  manufacturing:{ labelKey:'nav.manufacturing', home:'work-orders', items:[
    ['work-orders','Work Orders','factory'],['bom','Bill of Materials','box'],['mrp','MRP','flow'],
  ]},
  quality:{ labelKey:'nav.quality', home:'qc-inspection', items:[
    ['qc-inspection','Inspections','checkc'],['ncr','Non-conformance','shield'],
  ]},
  hr:{ labelKey:'nav.hr', home:'hr-directory', items:[
    ['hr-directory','Directory','people'],['leave-approval','Leave','calendar'],
    ['payroll-run','Payroll','coins'],
  ]},
  project:{ labelKey:'nav.project', home:'project-pl', items:[
    ['project-pl','Projects','project'],['timesheet','Timesheets','clock'],
  ]},
  service:{ labelKey:'nav.service', home:'service-ticket', items:[
    ['service-ticket','Tickets','wrench'],['service-order','Service Orders','list'],
    ['service-contracts','Contracts','receipt'],
  ]},
  asset:{ labelKey:'nav.asset', home:'asset-register', items:[
    ['asset-register','Asset Register','asset'],['depreciation','Depreciation','chart'],
  ]},
  bi:{ labelKey:'nav.bi', home:'bi-dashboard', items:[
    ['bi-dashboard','Dashboard','grid'],['sales-analysis','Sales Analysis','chart'],
    ['stock-aging','Stock Aging','clock'],
  ]},
  integration:{ labelKey:'nav.integration', home:'integration', items:[
    ['integration','Overview','plug'],['integration-logs','Logs','history'],
    ['data-import','Data Import','upload'],
  ]},
  admin:{ labelKey:'nav.admin', home:'user-mgmt', items:[
    ['user-mgmt','Users','people'],['role-permission','Roles & Permissions','shield'],
    ['master-control','Master Control','grid'],['audit-log','Audit Log','history'],
    ['sys-settings','System Settings','gear'],['module-activation-control','Module Activation','sliders'],
  ]},
};
const MODULE_READ_PERMISSION = {
  home:'dashboard.read', sales:'sales.read', purchasing:'purchasing.read',
  crm:'crm.read', inventory:'inventory.read', warehouse:'warehouse.read',
  manufacturing:'manufacturing.read', quality:'quality.read', finance:'finance.read',
  hr:'hr.read', project:'project.read', service:'service.read', asset:'asset.read',
  workflow:'approval.read', bi:'reporting.read', admin:'admin.read',
  integration:'integration.read', settings:'settings.read',
};
const SCREEN_FIXTURES = {
  'txn-view':'sales-enquiry',
  'pur-txn-view':'purchasing-rfq',
};
const SCREEN_META = {};
Object.keys(SCREENS).forEach(route=>{
  const moduleId=ROUTE_MODULE[route]||(
    route==='dashboard'?'home':
    route==='settings'?'settings':
    ['notifications','my-activity'].includes(route)?'admin':'unmapped'
  );
  const canonical=CANONICAL_SCREEN_ROUTES.has(route);
  SCREEN_META[route]=Object.freeze({
    route,
    module:moduleId,
    maturity:canonical?'canonical':'preview',
    dataSource:canonical?'canonical':'sample',
    supportedModes:canonical?(API_SCREEN_ROUTES.has(route)?['demo','api']:['demo']):['demo'],
    activeSection:SCREEN_ACTIVE_ALIASES[route]||route,
    permission:MODULE_READ_PERMISSION[moduleId]||null,
    fixture:SCREEN_FIXTURES[route]||null,
  });
});
window.SCREEN_META=SCREEN_META;

function getScreenMeta(route){
  return SCREEN_META[route]||{
    route, module:ROUTE_MODULE[route]||'unmapped', maturity:'preview',
    dataSource:'sample', supportedModes:['demo'], activeSection:route,
    permission:null, fixture:null,
  };
}
function moduleMaturity(moduleId){
  const rows=Object.values(SCREEN_META).filter(m=>m.module===moduleId);
  if(!rows.length) return 'preview';
  const canonical=rows.filter(m=>m.maturity==='canonical').length;
  return canonical===0?'preview':canonical===rows.length?'canonical':'partial';
}
function moduleNav(moduleId, active){
  if(moduleId==='sales' && typeof salesNav==='function') return salesNav(active);
  if(moduleId==='purchasing' && typeof purNav==='function') return purNav(active);
  if(moduleId==='inventory' && typeof inventoryNav==='function') return inventoryNav(active);
  const def=MODULE_DEFS[moduleId];
  if(!def) return '';
  active=SCREEN_ACTIVE_ALIASES[active]||active;
  return `<div class="sales-subnav standard-module-subnav" role="tablist" aria-label="${esc(t(def.labelKey))}">
    ${def.items.map(item=>`<button class="ssub ${item[0]===active?'on':''}" role="tab" aria-selected="${item[0]===active}" onclick="navigate('${item[0]}')">${ic(item[2])}<span>${esc(tf('route.'+item[0],item[1]))}</span></button>`).join('')}
  </div>`;
}
function modulePage(o){
  const def=MODULE_DEFS[o.module];
  const title=o.title||'';
  const crumb=o.crumb||[DB.company.name,{label:def?t(def.labelKey):o.module,route:def&&def.home},{cur:title}];
  return `<div class="content full"><section class="master" data-module-shell="${esc(o.module)}">
    <div class="scrollarea">
      <div class="pagehead">
        ${crumbs(crumb)}
        ${moduleNav(o.module,o.active||o.route)}
        <div class="h1row" style="margin-top:13px"><h1>${esc(title)}</h1>${o.count!=null?`<span class="countchip">${esc(String(o.count))}</span>`:''}<div class="grow"></div>${o.action||''}</div>
        ${o.sub?`<div class="h1sub">${esc(o.sub)}</div>`:''}
      </div>
      ${o.body||''}
    </div>
  </section></div>`;
}
window.MODULE_DEFS=MODULE_DEFS;
window.modulePage=modulePage;

function ensureModuleShell(root, meta){
  const usesLegacyModuleNav=['sales','purchasing','inventory'].includes(meta?.module);
  if(!root || !meta || (!MODULE_DEFS[meta.module] && !usesLegacyModuleNav)) return;
  const shell=root.querySelector('.master')||root.querySelector('.content')||root.firstElementChild;
  if(shell) shell.setAttribute('data-module-shell',meta.module);
  if(root.querySelector('.sales-subnav')) return;
  const navHtml=moduleNav(meta.module,meta.activeSection);
  if(!navHtml) return;
  const holder=document.createElement('div');
  holder.innerHTML=navHtml;
  const nav=holder.firstElementChild;
  const pagehead=root.querySelector('.pagehead');
  if(pagehead){
    const crumb=pagehead.querySelector('.crumb');
    if(crumb) crumb.after(nav); else pagehead.prepend(nav);
    return;
  }
  const docpage=root.querySelector('.docpage');
  if(docpage){
    const crumb=docpage.querySelector('.crumb');
    if(crumb) crumb.after(nav); else docpage.prepend(nav);
    return;
  }
  const master=root.querySelector('.master');
  if(master){
    const wrapper=document.createElement('div');
    wrapper.className='pagehead module-shell-head';
    wrapper.appendChild(nav);
    master.prepend(wrapper);
    return;
  }
  root.prepend(nav);
}
const PREVIEW_WRITE_RE=/\b(new|create|save|post|approve|reject|delete|edit|receive|convert|issue|release|adjust|transfer|reconcile|import|upload|invite|add|run payroll|start|complete|dispose|record payment)\b/i;
function isPreviewWriteButton(button){
  if(!button || button.disabled) return false;
  if(button.closest('.crumb,.sales-subnav,.tabs,.filterchips,.seg,.viewsel')) return false;
  return PREVIEW_WRITE_RE.test((button.textContent||'').replace(/\s+/g,' ').trim());
}
function decorateScreen(root, route){
  if(!root || CURRENT_ROUTE!==route) return;
  const meta=getScreenMeta(route);
  root.dataset.screenRoute=route;
  root.dataset.screenModule=meta.module;
  root.dataset.screenMaturity=meta.maturity;

  ensureModuleShell(root,meta);
  const active=root.querySelector('.sales-subnav [aria-selected="true"]');
  if(active){
    requestAnimationFrame(()=>active.scrollIntoView({block:'nearest',inline:'nearest'}));
  }

  if(meta.maturity!=='preview') return;
  if(!root.querySelector('[data-preview-banner]')){
    const banner=document.createElement('div');
    banner.className='screen-preview-banner';
    banner.dataset.previewBanner='true';
    banner.setAttribute('role','status');
    banner.innerHTML=`${ic('warn')}<div><b>${esc(t('preview.label'))}</b><span>${esc(t('preview.desc'))}</span></div>`;
    root.prepend(banner);
  }
  root.querySelectorAll('button').forEach(button=>{
    if(!isPreviewWriteButton(button)) return;
    button.disabled=true;
    button.classList.add('preview-write-disabled');
    button.setAttribute('aria-disabled','true');
    button.setAttribute('data-tip',t('preview.disabled'));
    button.title=t('preview.disabled');
  });
}

/* `DB.built` — live single source of truth for which routes are implemented,
   derived from the SCREENS registry that screen files populate at load time.
   app.js is the last script, so SCREENS is fully populated by now; a getter
   keeps it correct even if screens register lazily. navigate() gates on the
   same SCREENS lookup, so build-state can never drift from the registry. */
Object.defineProperty(DB, 'built', {
  configurable: true,
  get(){ return new Set(Object.keys(SCREENS)); }
});

/* ---------- sidebar ---------- */
function renderSidebar(){
  const el=$('#sidebar');
  let h=`<button class="brand" id="brandBtn" data-tip="Go to Home">
    <div class="mark">${ic('box')}</div>
    <div class="brandtext"><b>Aria</b><small>${esc(DB.company.name.split(' ')[0])} Mfg.</small></div>
  </button>`;
  DB.nav.forEach(g=>{
    const items=g.items.filter(m=>moduleState(m.id).visible);
    if(!items.length) return;
    h+=`<div class="navgroup"><h6>${esc(tf('group.'+g.group, g.group))}</h6>`;
    items.forEach(m=>{
      const st=moduleState(m.id);
      const label=tf('nav.'+m.id, m.label);
      const maturity=moduleMaturity(m.id);
      h+=`<button class="nav ${st.active?'':'is-disabled'}" data-route="${m.route}" data-mod="${m.id}" data-tip="${esc(st.active?label:label+' · inactive')}" ${st.active?'':'aria-disabled="true"'}>
        ${ic(m.icon)}<span class="navlabel">${esc(label)}</span>
        ${st.active&&m.badge?`<span class="badge ${m.id==='workflow'||m.id==='purchasing'?'warn':''}">${m.badge}</span>`:''}
        ${maturity!=='canonical'?`<span class="nav-maturity ${maturity}">${esc(t(maturity==='preview'?'preview.short':'preview.partial'))}</span>`:''}
      </button>`;
    });
    h+=`</div>`;
  });
  h+=`<div class="sidebar-foot"><button class="nav" data-route="settings" data-mod="settings" data-tip="${esc(t('nav.settings'))}">${ic('gear')}<span class="navlabel">${esc(t('nav.settings'))}</span></button></div>`;
  el.innerHTML=h;
  el.querySelectorAll('.nav[data-route]').forEach(b=>b.addEventListener('click',()=>{
    if(b.getAttribute('aria-disabled')==='true'){ toast('Module inactive for this client','warn'); return; }
    navigate(b.dataset.route);
  }));
  const bb=el.querySelector('#brandBtn');
  bb&&bb.addEventListener('click',()=>setNavCollapsed(!$('#app').classList.contains('nav-collapsed'), true));
}
function setActiveNav(route){
  const mod=ROUTE_MODULE[route];
  $$('#sidebar .nav').forEach(n=>n.classList.toggle('active',n.dataset.mod===mod));
  $$('.tabbar button[data-route]').forEach(n=>n.classList.toggle('active',ROUTE_MODULE[n.dataset.route]===mod));
}

/* ---------- router ---------- */
function screenLoadingHtml(route){
  const meta=getScreenMeta(route);
  const title=tf('route.'+route, route.replace(/-/g,' '));
  const body=`<div class="screen-loading" role="status" aria-live="polite" aria-label="${esc(title)}">
    ${skeletonRows(7)}
  </div>`;
  if(meta.module && meta.module!=='home' && meta.module!=='settings'){
    return modulePage({module:meta.module,route,active:meta.activeSection,title,body});
  }
  return `<div class="content full"><section class="master"><div class="scrollarea">
    <div class="pagehead"><div class="h1row"><h1>${esc(title)}</h1></div></div>${body}
  </div></section></div>`;
}
function screenErrorHtml(route,error){
  const requestId=error && (error.requestId || (error.error&&error.error.requestId));
  const message=error && error.message ? error.message : String(error||'Unknown rendering error');
  const action=btn('Retry',{icon:'refresh',cls:'primary',attrs:'onclick="retryCurrentScreen()"'});
  const panel=statePanel({
    icon:'warn',
    title:'This page could not be loaded',
    body:`${esc(message)} Please retry. No sample data was substituted.`,
    code:requestId||undefined,
    action,
  });
  const meta=getScreenMeta(route);
  if(meta.module && meta.module!=='home' && meta.module!=='settings'){
    return modulePage({
      module:meta.module,route,active:meta.activeSection,
      title:tf('route.'+route,route.replace(/-/g,' ')),body:panel,
    });
  }
  return `<div class="content full"><section class="master screen-render-error">${panel}</section></div>`;
}
function finishScreenRender(root,route,sequence,output){
  if(sequence!==SCREEN_RENDER_SEQUENCE || CURRENT_ROUTE!==route) return false;
  if(typeof output==='string') root.innerHTML=output;
  decorateScreen(root,route);
  root.scrollTop=0;
  return true;
}
function failScreenRender(root,route,sequence,error){
  if(sequence!==SCREEN_RENDER_SEQUENCE || CURRENT_ROUTE!==route) return false;
  root.innerHTML=screenErrorHtml(route,error);
  const panel=root.querySelector('.statepanel');
  if(panel) panel.closest('.master')?.classList.add('screen-render-error');
  decorateScreen(root,route);
  root.scrollTop=0;
  return true;
}
function retryCurrentScreen(){
  if(CURRENT_ROUTE) return navigate(CURRENT_ROUTE,CURRENT_ROUTE_PARAMS);
  return Promise.resolve(false);
}
window.retryCurrentScreen=retryCurrentScreen;

function navigate(route, params){
  const root=$('#viewRoot');
  const sequence=++SCREEN_RENDER_SEQUENCE;
  CURRENT_ROUTE=route;
  CURRENT_ROUTE_PARAMS=Object.assign({},params||{});
  if(!routeAllowed(route)){
    root.innerHTML=moduleBlockedPanel(route);
    setActiveNav(route); closeAllPops(); return Promise.resolve(false);
  }
  if(!SCREENS[route]){
    // unbuilt module -> graceful panel inside a simple shell
    const mod=DB.nav.flatMap(g=>g.items).find(m=>m.route===route);
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name, mod?mod.label:'Module'])}
        <div class="h1row"><h1>${mod?esc(mod.label):'Module'}</h1></div></div>
      ${notBuilt(mod?mod.label:'This module')}
    </section></div>`;
    setActiveNav(route); closeAllPops(); return Promise.resolve(false);
  }
  root.innerHTML='';
  setActiveNav(route);
  closeAllPops();
  try{ history.replaceState({},'',`#${route}`); }catch(e){}
  let output;
  try{
    output=SCREENS[route](root,params||{});
  }catch(error){
    failScreenRender(root,route,sequence,error);
    return Promise.resolve(false);
  }
  if(output && typeof output.then==='function'){
    root.innerHTML=screenLoadingHtml(route);
    decorateScreen(root,route);
    root.scrollTop=0;
    return Promise.resolve(output).then(result=>{
      return finishScreenRender(root,route,sequence,result);
    }).catch(error=>{
      return failScreenRender(root,route,sequence,error);
    });
  }
  finishScreenRender(root,route,sequence,output);
  return Promise.resolve(true);
}

/* Some prototype screens re-render asynchronously or replace their root after
   filters/actions. Re-apply route metadata without requiring every screen to
   remember the preview contract. */
const screenMetaObserver=new MutationObserver(()=>{
  const route=CURRENT_ROUTE;
  if(!route) return;
  requestAnimationFrame(()=>decorateScreen($('#viewRoot'),route));
});
screenMetaObserver.observe($('#viewRoot'),{childList:true,subtree:true});

/* ---------- theme ---------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem('aria-theme',t);}catch(e){}
  const moon=$('#themeBtn'); if(moon)moon.innerHTML=ic(t==='dark'?'sun':'moon');
  const sw=$('#acctThemeSw'); if(sw)sw.classList.toggle('on',t==='dark');
}
function toggleTheme(){ applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); }

/* ---------- sidebar collapse ---------- */
let navUserSet=false;
function setNavCollapsed(on, fromUser){
  $('#app').classList.toggle('nav-collapsed',on);
  const bb=$('#brandBtn'); if(bb) bb.setAttribute('data-tip', on?'Expand sidebar':'Collapse sidebar');
  if(fromUser){ navUserSet=true; try{localStorage.setItem('aria-nav',on?'1':'0');}catch(e){} }
}
/* default state: honour an explicit user choice; otherwise auto-collapse on tablet widths */
function autoNav(){
  if(navUserSet) return;
  let stored=null; try{stored=localStorage.getItem('aria-nav');}catch(e){}
  if(stored==='0'||stored==='1'){ navUserSet=true; setNavCollapsed(stored==='1'); return; }
  setNavCollapsed(innerWidth<1180);
}

/* ---------- popovers ---------- */
function closeAllPops(){ $$('.pop.show').forEach(p=>p.classList.remove('show')); $$('[aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false')); }
function togglePop(id, anchorBtn){
  const p=$('#'+id); if(!p) return;
  const open=p.classList.contains('show'); closeAllPops();
  if(!open){
    // position under anchor (right-aligned)
    const r=anchorBtn.getBoundingClientRect();
    p.style.top=(r.bottom+8)+'px';
    p.style.right=(innerWidth-r.right)+'px'; p.style.left='auto';
    p.classList.add('show'); anchorBtn.setAttribute('aria-expanded','true');
  }
}

/* ---------- command palette ---------- */
const PAL_COMMANDS=[
  {cat:'Go to', items:[
    {label:'Home / Dashboard', icon:'home', route:'dashboard'},
    {label:'Sales Dashboard', icon:'grid', route:'sales-home'},
    {label:'Sales Orders', icon:'bag', route:'sales-orders'},
    {label:'Enquiries', icon:'comment', route:'enquiries'},
    {label:'Quotations', icon:'receipt', route:'quotations'},
    {label:'Sales Order Approvals', icon:'flow', route:'so-approvals'},
    {label:'Delivery Orders', icon:'truck', route:'delivery-orders'},
    {label:'Sales Invoices', icon:'receipt', route:'sales-invoices'},
    {label:'Sales Returns / RMA', icon:'refresh', route:'sales-returns'},
    {label:'Credit Notes', icon:'coins', route:'credit-notes'},
    {label:'Debit Notes', icon:'coins', route:'debit-notes'},
    {label:'Price Lists', icon:'tag', route:'price-lists'},
    {label:'Discount Management', icon:'percent', route:'discount-mgmt'},
    {label:'Credit Control', icon:'shield', route:'credit-control'},
    {label:'Sales Commission', icon:'coins', route:'sales-commission'},
    {label:'Sales Reports', icon:'chart', route:'sales-reports'},
    {label:'Quotation · Meridian', icon:'receipt', route:'quotation'},
    {label:'Delivery Order · Meridian', icon:'truck', route:'delivery-order'},
    {label:'Sales Invoice · Meridian', icon:'receipt', route:'sales-invoice'},
    {label:'Sales Pipeline', icon:'handshake', route:'crm-pipeline'},
    {label:'Customers (CRM)', icon:'user', route:'crm-customer'},
    {label:'Purchasing Dashboard', icon:'grid', route:'purchasing-home'},
    {label:'Suppliers', icon:'truck', route:'suppliers'},
    {label:'Purchase Requisitions', icon:'list', route:'purchase-requisitions'},
    {label:'Requests for Quotation (RFQ)', icon:'comment', route:'rfqs'},
    {label:'Supplier Quotations', icon:'receipt', route:'supplier-quotations'},
    {label:'Purchase Orders', icon:'cart', route:'purchase-orders'},
    {label:'Purchase Request · PCB shortage', icon:'cart', route:'purchase-request'},
    {label:'Goods Receipts', icon:'receive', route:'goods-receipts'},
    {label:'Supplier Invoices', icon:'receipt', route:'supplier-invoices'},
    {label:'Purchase Returns', icon:'refresh', route:'purchase-returns'},
    {label:'Supplier Credit Notes', icon:'coins', route:'supplier-credit-notes'},
    {label:'Supplier Debit Notes', icon:'coins', route:'supplier-debit-notes'},
    {label:'Supplier Price Lists', icon:'tag', route:'supplier-price-lists'},
    {label:'Landed Cost', icon:'truck', route:'landed-cost'},
    {label:'Vendor Performance', icon:'shield', route:'vendor-performance'},
    {label:'Purchasing Reports', icon:'chart', route:'purchasing-reports'},
    {label:'PO Approvals queue', icon:'flow', route:'po-approvals', meta:'3'},
    {label:'Stock on Hand', icon:'box', route:'stock-on-hand'},
    {label:'Item Master', icon:'tag', route:'item-master'},
    {label:'Stock Movement Ledger', icon:'history', route:'stock-movement'},
    {label:'Work Orders', icon:'factory', route:'work-orders'},
    {label:'Bill of Materials', icon:'box', route:'bom'},
    {label:'MRP — Material Requirements', icon:'chart', route:'mrp'},
    {label:'Quality Inspections', icon:'checkc', route:'qc-inspection'},
    {label:'Non-conformance (NCR)', icon:'shield', route:'ncr'},
    {label:'Service Tickets', icon:'wrench', route:'service-ticket'},
    {label:'Service Contracts', icon:'receipt', route:'service-contracts'},
    {label:'Asset Register', icon:'asset', route:'asset-register'},
    {label:'Depreciation Run', icon:'chart', route:'depreciation'},
    {label:'Projects — Portfolio', icon:'project', route:'project-pl'},
    {label:'Project P&L · Meridian', icon:'project', route:'project-detail'},
    {label:'My Timesheet', icon:'clock', route:'timesheet'},
    {label:'Integration — Connectors', icon:'plug', route:'integration'},
    {label:'Integration Logs', icon:'history', route:'integration-logs'},
    {label:'Import Data (CSV/Excel)', icon:'upload', route:'data-import'},
    {label:'Management Dashboard', icon:'chart', route:'bi-dashboard'},
    {label:'Sales Analysis', icon:'chart', route:'sales-analysis'},
    {label:'Stock Aging', icon:'box', route:'stock-aging'},
    {label:'Inventory Valuation Report', icon:'chart', route:'inv-valuation'},
    {label:'General Ledger · Chart of accounts', icon:'book', route:'gl'},
    {label:'Bank Reconciliation', icon:'bank', route:'bank-rec'},
    {label:'Income Statement (P&L)', icon:'chart', route:'pnl'},
    {label:'AR Aging', icon:'receipt', route:'ar-aging'},
    {label:'Journal Entry', icon:'book', route:'journal-entry'},
    {label:'Payment Voucher', icon:'coins', route:'payment-voucher'},
    {label:'Leave Approval', icon:'people', route:'leave-approval'},
    {label:'Employee Directory', icon:'people', route:'hr-directory'},
    {label:'Employee · M. Silva', icon:'idcard', route:'employee'},
    {label:'Payroll Run · June', icon:'coins', route:'payroll-run'},
    {label:'Payslip · M. Silva', icon:'receipt', route:'payslip'},
    {label:'Warehouse Picking', icon:'warehouse', route:'picking'},
    {label:'User Management', icon:'people', route:'user-mgmt'},
    {label:'Audit Log', icon:'history', route:'audit-log'},
    {label:'System Settings · numbering, tax, currency', icon:'gear', route:'sys-settings'},
    {label:'Role Permissions', icon:'shield', route:'role-permission'},
    {label:'Master Control · tenants & users', icon:'grid', route:'master-control'},
    {label:'Module Activation Control', icon:'sliders', route:'module-activation-control'},
    {label:'Notifications center', icon:'bell', route:'notifications'},
  ]},
  {cat:'Create', items:[
    {label:'New Sales Order', icon:'plus', action:()=>navigate('new-sales-order')},
    {label:'New Purchase Order', icon:'plus', action:()=>navigate('new-purchase-order')},
    {label:'New Journal Entry', icon:'plus', action:()=>navigate('new-journal-entry')},
    {label:'New Work Order', icon:'plus', action:()=>navigate('new-work-order')},
    {label:'New Opportunity', icon:'plus', action:()=>navigate('new-opportunity')},
    {label:'New Employee', icon:'plus', action:()=>navigate('new-employee')},
    {label:'New Payment Voucher', icon:'plus', action:()=>navigate('new-payment-voucher')},
    {label:'New Stock Adjustment', icon:'plus', action:()=>navigate('new-stock-adjustment')},
    {label:'New Item', icon:'plus', action:()=>navigate('new-item')},
  ]},
  {cat:'Open document', items:[
    {label:'SO-26-0418 · Meridian Robotics', icon:'file', route:'sales-order'},
    {label:'PO-26-0291 · Shenzhen Microcircuit', icon:'file', route:'po-approval'},
    {label:'JE-26-0611 · FX revaluation', icon:'file', route:'journal-entry'},
  ]},
];
let palIndex=0, palFlat=[];
function openPalette(){ $('#scrim').classList.add('show'); $('#palette').classList.add('show'); const i=$('#palInput'); i.value=''; renderPalette(''); setTimeout(()=>i.focus(),60); }
function closePalette(){ $('#scrim').classList.remove('show'); $('#palette').classList.remove('show'); }
function renderPalette(q){
  q=q.toLowerCase().trim(); const list=$('#palList'); palFlat=[]; let h='';
  PAL_COMMANDS.forEach(group=>{
    const items=group.items.filter(it=>(!it.route||routeShownInCommands(it.route))&&(!q||it.label.toLowerCase().includes(q)));
    if(!items.length) return;
    h+=`<div class="pcat">${esc(tf('pal.cat.'+group.cat, group.cat))}</div>`;
    items.forEach(it=>{ const idx=palFlat.length; palFlat.push(it);
      h+=`<div class="pitem" data-i="${idx}">${ic(it.icon||'arrowR')}<span>${esc(it.label)}</span>${it.meta?`<span class="meta kbd">${it.meta}</span>`:`<span class="meta">${it.route?'↵':t('pal.run')}</span>`}</div>`;
    });
  });
  if(!palFlat.length) h=`<div class="pcat">${esc(t('pal.nomatch'))}</div><div class="pitem"><span style="color:var(--muted)">${esc(t('pal.hint'))}</span></div>`;
  list.innerHTML=h; palIndex=0; highlightPal();
  list.querySelectorAll('.pitem[data-i]').forEach(el=>{
    el.addEventListener('mouseenter',()=>{palIndex=+el.dataset.i;highlightPal();});
    el.addEventListener('click',()=>runPal(+el.dataset.i));
  });
}
function highlightPal(){ $$('#palList .pitem').forEach(el=>el.classList.toggle('active',+el.dataset.i===palIndex)); const a=$(`#palList .pitem[data-i="${palIndex}"]`); a&&a.scrollIntoView({block:'nearest'}); }
function runPal(i){ const it=palFlat[i]; if(!it) return; closePalette(); if(it.route)navigate(it.route); else if(it.action)it.action(); }

/* ---------- notification center ---------- */
let notifFilter='all';
function notifUnreadCount(){ return DB.notifications.filter(n=>n.unread&&!n.dismissed).length; }
function updateBellBadge(){
  const el=$('#bellDot'); if(!el) return;
  const n=notifUnreadCount();
  if(n>0){ el.textContent=n>9?'9+':n; el.classList.add('count'); el.style.display=''; }
  else { el.textContent=''; el.classList.remove('count'); el.style.display='none'; }
}
function notifRow(n){
  return `<div class="nc-item ${n.unread?'unread':''}" data-route="${esc(n.route)}" data-id="${esc(n.id)}">
    <span class="ni wc-ic ${n.clr}">${ic(n.ic)}</span>
    <div class="nc-body">
      <b>${esc(n.title)}</b>
      <p>${esc(n.body)}</p>
      <span class="nc-meta"><span class="nc-cat">${esc(DB.notifCats[n.cat]||n.cat)}</span> · ${esc(n.t)}</span>
    </div>
    ${n.unread?`<span class="nc-dot"></span>`:''}
    <button class="nc-x" data-dismiss="${esc(n.id)}" data-tip="Dismiss" aria-label="Dismiss">${ic('x')}</button>
  </div>`;
}
function buildNotifCenter(){
  const items=DB.notifications.filter(n=>!n.dismissed);
  const unread=items.filter(n=>n.unread).length;
  const filtered=items.filter(n=> notifFilter==='all'?true : notifFilter==='unread'?n.unread : n.cat==='approval');
  const tabs=[['all',t('notif.all')],['unread',t('notif.unread')],['approval',t('notif.approvals')]];
  let body='';
  [['today',t('notif.today')],['earlier',t('notif.earlier')]].forEach(([g,label])=>{
    const rows=filtered.filter(n=>n.group===g);
    if(rows.length) body+=`<div class="nc-group">${esc(label)}</div>`+rows.map(notifRow).join('');
  });
  if(!filtered.length) body=`<div class="nc-empty">${ic('checkc')}<b>${esc(t('notif.empty.title'))}</b><span>${esc(t('notif.empty.body'))}</span></div>`;
  return `
    <div class="nc-head">
      <div class="nc-title">${esc(t('notif.title'))} ${unread?`<span class="nc-count">${unread}</span>`:''}</div>
      <button class="nc-act" type="button" data-nc="readall" data-tip="${esc(t('notif.readall'))}" aria-label="${esc(t('notif.readall'))}" ${unread?'':'disabled'}>${ic('checkc')}</button>
      <button class="nc-act" type="button" data-nc="settings" data-tip="${esc(t('notif.settings'))}" aria-label="${esc(t('notif.settings'))}">${ic('gear')}</button>
    </div>
    <div class="nc-tabs">${tabs.map(t2=>`<button class="nc-tab ${t2[0]===notifFilter?'on':''}" data-tab="${t2[0]}">${esc(t2[1])}${t2[0]==='unread'&&unread?`<span class="nc-tabn">${unread}</span>`:''}</button>`).join('')}</div>
    <div class="nc-list">${body}</div>
    <div class="nc-foot"><button data-nc="viewall">${esc(t('notif.viewall'))}</button></div>`;
}
function wireNotifCenter(){
  const menu=$('#notifMenu');
  menu.querySelectorAll('.nc-tab').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();notifFilter=b.dataset.tab;refreshNotifs();}));
  menu.querySelectorAll('.nc-item[data-route]').forEach(it=>it.addEventListener('click',e=>{
    if(e.target.closest('[data-dismiss]')) return;
    markNotificationRead(it.dataset.id);
    refreshNotifs();
    navigate(it.dataset.route);
  }));
  menu.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    dismissNotification(b.dataset.dismiss);
    refreshNotifs(); toast('Notification dismissed','info');
  }));
  const ra=menu.querySelector('[data-nc="readall"]'); ra&&ra.addEventListener('click',e=>{e.stopPropagation();markAllNotificationsRead();refreshNotifs();toast('All caught up','ok');});
  const st=menu.querySelector('[data-nc="settings"]'); st&&st.addEventListener('click',e=>{e.stopPropagation();closeAllPops();navigate('settings',{section:'set-notifications'});});
  const va=menu.querySelector('[data-nc="viewall"]'); va&&va.addEventListener('click',e=>{e.stopPropagation();closeAllPops();navigate('notifications');});
}
function refreshNotifs(){ applyNotificationState(); const m=$('#notifMenu'); if(m){ m.innerHTML=buildNotifCenter(); wireNotifCenter(); } updateBellBadge(); }
function buildQuickCreate(){
  const items=[[t('qc.so'),'bag','new-sales-order'],[t('qc.po'),'cart','new-purchase-order'],[t('qc.wo'),'factory','new-work-order'],[t('qc.je'),'book','new-journal-entry'],[t('qc.pv'),'coins','new-payment-voucher'],[t('qc.adj'),'adjust','new-stock-adjustment'],[t('qc.item'),'tag','new-item']];
  return `<div class="menu-section"><div class="menu-head">${esc(t('qc.title'))}</div>`+items.map(([l,i,r])=>`<button class="menu-item" data-route="${r}">${ic(i)}<span>${esc(l)}</span></button>`).join('')+`</div>`;
}
function buildCompanyMenu(){
  /* Canonical companies (ERP-System PGlite schema), not the unrelated Aria
     "Master Control" mock hierarchy in DB.masters — this switches the real
     active company scope via ErpSystemDemo.switchCompany(). */
  const companies=(DB.erpSystem && DB.erpSystem.companies) || [];
  const activeFn=DB.erpSystem && DB.erpSystem.scope && DB.erpSystem.scope.companyFn;
  const masterName=(DB.erpSystem && DB.erpSystem.master && DB.erpSystem.master.name) || DB.company.name;
  const head=`<div class="menu-head">${esc(masterName)}</div>`;
  /* demo adapter's raw SQL rows use snake_case (company_fn); the api adapter's
     JSON (Drizzle/Express) uses camelCase (companyFn) — support both so this one
     shared render function works under either data mode. */
  const rows=companies.map(c=>{
    const fn=c.company_fn||c.companyFn;
    return `<button class="menu-item" data-co="${esc(fn)}">
    <span class="mc-logo" style="width:26px;height:26px;font-size:9.5px;border-radius:7px">${esc(c.name.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase())}</span>
    <span>${esc(c.name)}<small style="display:block;color:var(--muted);font-size:11px">${esc(c.currency)} · ${esc(c.country)}</small></span>
    <span class="meta">${fn===activeFn?ic('check'):''}</span></button>`;
  }).join('');
  return `<div class="menu-section">${head}${rows}</div>
    <div class="menu-section"><button class="menu-item" data-co-action="master">${ic('grid')}<span>Master Control</span><span class="meta">${ic('arrowR')}</span></button></div>`;
}
/* (re)render the company switcher popover and wire its [data-co] buttons.
   Called on boot and again after a successful switch, since the button
   list itself changes (checkmark moves to the newly active company). */
function wireCompanyMenu(){
  $('#companyMenu').innerHTML=buildCompanyMenu();
  $('#companyMenu').querySelectorAll('[data-co]').forEach(b=>b.addEventListener('click',()=>{
    closeAllPops();
    const fn=b.dataset.co;
    if(!window.ErpSystemDemo||!window.ErpSystemDemo.switchCompany){ toast('Company switch needs the PGlite adapter.','warn'); return; }
    if(!DB.erpSystem||!DB.erpSystem.scope||fn===DB.erpSystem.scope.companyFn) return;
    window.ErpSystemDemo.switchCompany(fn).then(()=>{
      $('#ctxCompany').innerHTML=`<b>${esc(DB.company.name)} ${ic('chevD')}</b><small>${esc(DB.company.branch)}</small>`;
      wireCompanyMenu();
      if(CURRENT_ROUTE) navigate(CURRENT_ROUTE);
      toast('Switched to '+DB.company.name,'ok');
    }).catch(e=>toast('Switch failed: '+((e&&e.message)||e),'danger'));
  }));
  $('#companyMenu').querySelector('[data-co-action="master"]').addEventListener('click',()=>{ closeAllPops(); navigate('master-control'); });
}

/* ---------- fiscal period switcher + FY setup ---------- */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function fiscalPeriods(f){
  f=f||DB.fiscal; const out=[];
  for(let i=1;i<=f.periodCount;i++){
    const mi=(f.startMonth-1+(i-1))%12;
    const yr=f.startYear+Math.floor((f.startMonth-1+(i-1))/12);
    const code='P'+String(i).padStart(2,'0');
    const label=f.periodCount===4 ? ('Q'+i+' '+yr) : (MONTHS[mi]+' '+yr);
    out.push({ i, code, label, status:i<f.currentPeriod?'Closed':i===f.currentPeriod?'Open':'Future', current:i===f.currentPeriod, selected:i===f.selectedPeriod });
  }
  return out;
}
function fyRangeLabel(f){ const ps=fiscalPeriods(f); if(!ps.length) return ''; return ps[0].label.split(' ')[0]+' – '+ps[ps.length-1].label.split(' ')[0]; }
function selectFy(label){
  const fy=(DB.fiscalYears||[]).find(y=>y.fyLabel===label); if(!fy||fy===DB.fiscal) return;
  DB.fiscal=fy;
  applyPeriod(fy.selectedPeriod);
  wirePeriodMenu(); closeAllPops();
  toast('Working fiscal year set to '+fy.fyLabel,'ok');
}
function applyPeriod(i){
  const p=fiscalPeriods().find(x=>x.i===i); if(!p) return;
  DB.fiscal.selectedPeriod=i;
  DB.company.period=DB.fiscal.fyLabel+' · '+p.code;
  DB.company.periodLabel=p.label;
  try{ localStorage.setItem('aria-period', DB.fiscal.fyLabel+'|'+i); }catch(e){}
  const cp=$('#ctxPeriod'); if(cp) cp.innerHTML=`<b>${esc(DB.company.period)} ${ic('chevD')}</b><small>${esc(DB.company.periodLabel)} · ${esc(DB.company.currency)}</small>`;
}
function buildPeriodMenu(){
  const ps=fiscalPeriods();
  const tone=s=>s==='Open'?'ok':s==='Closed'?'neutral':'';
  const fyTone=s=>s==='Current'?'ok':s==='Future'?'':'neutral';
  // ── fiscal-year selector ──
  const years=DB.fiscalYears||[DB.fiscal];
  const fyRows=years.map(fy=>`<button class="menu-item" data-fy="${esc(fy.fyLabel)}">
    <span style="font-family:var(--mono);font-size:11px;color:var(--muted);min-width:30px;flex:none">${esc(fy.fyLabel.replace(/^FY/,''))}</span>
    <span>${esc(fy.fyLabel)}<small style="display:block;color:var(--muted);font-size:11px">${esc(fyRangeLabel(fy))} · ${fy.periodCount} periods</small></span>
    <span class="meta">${fy===DB.fiscal?ic('check'):cap(fy.state||'',fyTone(fy.state))}</span></button>`).join('');
  const fySection=`<div class="menu-section"><div class="menu-head">Fiscal year</div>${fyRows}
    <button class="menu-item" data-period-action="new">${ic('plus')||ic('add')||''}<span>New fiscal year…</span><span class="meta">${ic('arrowR')}</span></button></div>`;
  // ── period selector for the working FY ──
  const head=`<div class="menu-head">${esc(DB.fiscal.fyLabel)} periods · <span style="text-transform:none;letter-spacing:0;margin-left:4px">${esc(fyRangeLabel())}</span></div>`;
  const rows=ps.map(p=>`<button class="menu-item" data-period="${p.i}">
    <span style="font-family:var(--mono);font-size:11px;color:var(--muted);min-width:30px;flex:none">${esc(p.code)}</span>
    <span>${esc(p.label)}<small style="display:block;color:var(--muted);font-size:11px">${p.status==='Open'?'Open · current posting period':p.status==='Closed'?'Closed for posting':'Future period'}</small></span>
    <span class="meta">${p.selected?ic('check'):cap(p.status,tone(p.status))}</span></button>`).join('');
  return `${fySection}<div class="menu-section">${head}<div style="max-height:264px;overflow:auto">${rows}</div></div>
    <div class="menu-section"><button class="menu-item" data-period-action="setup">${ic('gear')}<span>Set up ${esc(DB.fiscal.fyLabel)}…</span><span class="meta">${ic('arrowR')}</span></button></div>`;
}
function wirePeriodMenu(){
  const m=$('#periodMenu'); if(!m) return;
  m.innerHTML=buildPeriodMenu();
  m.querySelectorAll('[data-fy]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); selectFy(b.dataset.fy); }));
  m.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); applyPeriod(+b.dataset.period); wirePeriodMenu(); closeAllPops(); toast('Working period set to '+DB.company.periodLabel,'ok'); }));
  m.querySelector('[data-period-action="setup"]').addEventListener('click',e=>{ e.stopPropagation(); closeAllPops(); openFySetup(); });
  m.querySelector('[data-period-action="new"]').addEventListener('click',e=>{ e.stopPropagation(); closeAllPops(); openFySetup(null,true); });
}
function openFySetup(fyArg,isNew){
  const f=isNew
    ? { fyLabel:'FY'+((DB.fiscalYears[DB.fiscalYears.length-1]?.startYear||DB.fiscal.startYear)+1), startYear:(DB.fiscalYears[DB.fiscalYears.length-1]?.startYear||DB.fiscal.startYear)+1, startMonth:DB.fiscal.startMonth, scheme:DB.fiscal.scheme, periodCount:DB.fiscal.periodCount, currentPeriod:1, selectedPeriod:1, state:'Future' }
    : (fyArg||DB.fiscal);
  const schemes=['Monthly (12 periods)','Quarterly (4 periods)','4-4-5 (12 periods)'];
  const monthOpts=MONTHS.map((mn,i)=>`<option value="${i+1}" ${f.startMonth===i+1?'selected':''}>${mn}</option>`).join('');
  const schemeOpts=schemes.map(s=>`<option ${s===f.scheme?'selected':''}>${s}</option>`).join('');
  const periodOpts=fiscalPeriods(f).map(p=>`<option value="${p.i}" ${f.currentPeriod===p.i?'selected':''}>${p.code} · ${p.label}</option>`).join('');
  openModal(`<div class="modal-head">${ic('calendar')}<h3>${isNew?'New fiscal year':'Set up '+esc(f.fyLabel)}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body"><div class="set-grid">
      <div class="fld"><span>Fiscal year label</span><input id="fyLabel" value="${esc(f.fyLabel)}"></div>
      <div class="fld"><span>Starting year</span><input id="fyYear" type="number" value="${f.startYear}"></div>
      <div class="fld"><span>First month</span><select id="fyMonth">${monthOpts}</select></div>
      <div class="fld"><span>Period scheme</span><select id="fyScheme">${schemeOpts}</select></div>
      <div class="fld" style="grid-column:1/-1"><span>Current open period</span><select id="fyCurrent">${periodOpts}</select></div>
    </div>
    <p style="margin:12px 2px 0;font-size:11.5px;color:var(--muted)">Periods before the open period are <b>Closed</b>; later periods are <b>Future</b>. Posting is blocked outside the open period.</p></div>
    <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(isNew?'Create fiscal year':'Save fiscal year',{icon:'save',cls:'primary',attrs:'data-save="1"'})}</div>`);
  const rebuildCurrent=()=>{
    const scheme=$('#fyScheme').value, count=scheme.startsWith('Quarterly')?4:12;
    const tmp={ fyLabel:$('#fyLabel').value, startYear:+$('#fyYear').value||f.startYear, startMonth:+$('#fyMonth').value, periodCount:count, currentPeriod:0, selectedPeriod:0 };
    const cur=Math.min(+$('#fyCurrent').value||1,count);
    $('#fyCurrent').innerHTML=fiscalPeriods(tmp).map(p=>`<option value="${p.i}" ${cur===p.i?'selected':''}>${p.code} · ${p.label}</option>`).join('');
  };
  ['fyScheme','fyMonth','fyYear','fyLabel'].forEach(id=>{ const el=$('#'+id); if(el){ el.addEventListener('change',rebuildCurrent); el.addEventListener('input',rebuildCurrent); } });
  $('#modalEl').querySelector('[data-save]').addEventListener('click',()=>{
    const scheme=$('#fyScheme').value, count=scheme.startsWith('Quarterly')?4:12;
    const target=isNew?f:DB.fiscal;
    target.fyLabel=$('#fyLabel').value.trim()||'FY';
    target.startYear=+$('#fyYear').value||target.startYear;
    target.startMonth=+$('#fyMonth').value;
    target.scheme=scheme; target.periodCount=count;
    target.currentPeriod=Math.min(+$('#fyCurrent').value||1,count);
    if(isNew){
      if(!target.state) target.state='Future';
      DB.fiscalYears.push(target);
      DB.fiscalYears.sort((a,b)=>a.startYear-b.startYear);
      DB.fiscal=target;
    }
    if(target.selectedPeriod>count) target.selectedPeriod=target.currentPeriod;
    applyPeriod(DB.fiscal.currentPeriod);
    closeModal(); wirePeriodMenu();
    toast(target.fyLabel+(isNew?' created':' saved')+' · '+count+' periods','ok');
  });
}

/* ---------- mobile tab bar ---------- */
function renderTabbar(){
  const tabs=[['dashboard','home',t('tab.home')],['sales-orders','bag',t('tab.sales')],['po-approval','flow',t('tab.approve')],['stock-on-hand','box',t('tab.stock')],['picking','warehouse',t('tab.pick')]];
  $('#tabbar').innerHTML=tabs.filter(([r])=>routeShownInCommands(r)).map(([r,i,l])=>`<button data-route="${r}">${ic(i)}${esc(l)}</button>`).join('')+`<button onclick="openPalette()">${ic('search')}${esc(t('tab.search'))}</button>`;
  $$('#tabbar button[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
}

/* ---------- boot ---------- */
async function boot(){
  if(typeof window.erpDataMode==='function' && window.erpDataMode()==='api' &&
     (!window.ErpSystemDemo || window.ErpSystemDemo.mode==='api-unavailable')){
    renderApiUnavailable();
    return;
  }
  /* TASK-024: both adapters implement needsSetup()/isSignedIn() now (api mode
     asks the server — a real per-deployment lock, not per-browser localStorage;
     demo mode wraps the existing local flags) — prefer that uniform contract,
     falling back to the legacy demo-only globals only if an adapter method is
     somehow missing. isSignedIn() in api mode also loads the dashboard as a
     side effect (see erp-system-api-adapter.js), so DB.* is ready by the time
     we reach the shell below. */
  const ed=window.ErpSystemDemo;
  const needsWizard = (ed && typeof ed.needsSetup==='function') ? await ed.needsSetup()
    : (typeof needsSetupWizard==='function' && needsSetupWizard());
  if(needsWizard){
    renderSetupWizard();
    return;
  }
  const signedIn = (ed && typeof ed.isSignedIn==='function') ? await ed.isSignedIn() : isDemoSignedIn();
  if(!signedIn){
    renderLogin();
    return;
  }
  setAuthShell(false);
  const auth=$('#authView'); if(auth) auth.remove();
  const wiz=$('#setupWizardView'); if(wiz) wiz.remove();
  const apiUnavail=$('#apiUnavailableView'); if(apiUnavail) apiUnavail.remove();
  // theme
  let themePref='light'; try{themePref=localStorage.getItem('aria-theme')||'light';}catch(e){}
  applyTheme(themePref);
  // personal prefs: accent + density
  try{ const ac=localStorage.getItem('aria-accent'); if(ac){ document.documentElement.style.setProperty('--accent',ac); document.documentElement.style.setProperty('--accent-tint','color-mix(in srgb, '+ac+' 14%, transparent)'); } }catch(e){}
  try{ if(localStorage.getItem('aria-density')==='compact') document.documentElement.setAttribute('data-density','compact'); }catch(e){}
  try{ const ts=localStorage.getItem('aria-textsize'); if(ts && ts!=='1') document.documentElement.style.setProperty('--fs',ts); }catch(e){}
  renderSidebar(); renderTabbar(); initTooltip();
  // default/restore sidebar collapse state (+ sets the toggle icon)
  autoNav();
  addEventListener('resize',autoNav);
  // topbar context
  $('#ctxCompany').innerHTML=`<b>${esc(DB.company.name)} ${ic('chevD')}</b><small>${esc(DB.company.branch)}</small>`;
  const envEl=$('.env'); if(envEl) envEl.textContent=DB.company.env||envEl.textContent;
  syncAccountUi();
  ensureModuleActivationMenuItem();
  ensureUserSwitcherMenuItem();
  applyNotificationState();
  // restore persisted working period, then paint the fiscal-period switcher
  try{ const sp=localStorage.getItem('aria-period'); if(sp){ const parts=sp.split('|'); const fy=(DB.fiscalYears||[]).find(y=>y.fyLabel===parts[0]); if(fy){ DB.fiscal=fy; const i=+parts[1]; if(i>=1&&i<=fy.periodCount) fy.selectedPeriod=i; } } }catch(e){}
  applyPeriod(DB.fiscal.selectedPeriod);
  wirePeriodMenu();
  // popovers fill
  refreshNotifs();
  $('#qcMenu').innerHTML=buildQuickCreate();
  $('#qcMenu').querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
  // company switcher
  wireCompanyMenu();
  // language switcher
  $('#langBtn').innerHTML=ic('globe');
  $('#langBtn').setAttribute('aria-label',t('tip.language'));
  $('#langMenu').innerHTML=buildLangMenu(); wireLangMenu();
  $('#langBtn').addEventListener('click',e=>{e.stopPropagation();togglePop('langMenu',$('#langBtn'));});
  // wiring
  $('#themeBtn').addEventListener('click',toggleTheme);
  $('#acctTheme')&&$('#acctTheme').addEventListener('click',e=>{e.stopPropagation();toggleTheme();});
  $('#globalSearch').addEventListener('click',openPalette);
  $('#bellBtn').addEventListener('click',e=>{e.stopPropagation();togglePop('notifMenu',$('#bellBtn'));});
  $('#qcBtn').addEventListener('click',e=>{e.stopPropagation();togglePop('qcMenu',$('#qcBtn'));});
  $('#avatarBtn').addEventListener('click',e=>{e.stopPropagation();togglePop('acctMenu',$('#avatarBtn'));});
  $('#ctxCompany').addEventListener('click',e=>{e.stopPropagation();togglePop('companyMenu',$('#ctxCompany'));});
  $('#ctxPeriod').addEventListener('click',e=>{e.stopPropagation();togglePop('periodMenu',$('#ctxPeriod'));});
  $('#scrim').addEventListener('click',closePalette);
  document.addEventListener('click',e=>{ if(!e.target.closest('.pop')&&!e.target.closest('#bellBtn,#qcBtn,#avatarBtn,#ctxCompany,#ctxPeriod,#langBtn')) closeAllPops(); });
  // keyboard
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#palette').classList.contains('show')?closePalette():openPalette();}
    else if(e.key==='Escape'){closePalette();closeAllPops();closeModal();}
    else if($('#palette').classList.contains('show')){
      if(e.key==='ArrowDown'){e.preventDefault();palIndex=Math.min(palFlat.length-1,palIndex+1);highlightPal();}
      else if(e.key==='ArrowUp'){e.preventDefault();palIndex=Math.max(0,palIndex-1);highlightPal();}
      else if(e.key==='Enter'){e.preventDefault();runPal(palIndex);}
    }
    else { handleHotkey(e); }
  });
  $('#palInput').addEventListener('input',e=>renderPalette(e.target.value));
  // account menu items
  $$('#acctMenu .menu-item[data-acct]').forEach(b=>b.addEventListener('click',()=>{ const a=b.dataset.acct; if(a==='signout'){signOutDemo(); return;} else if(a==='module-control'){navigate('module-activation-control');} else if(a==='switch-user'){closeAllPops();openUserSwitcher();return;} else if(a==='prefs'){navigate('settings',{section:'set-appearance'});} else if(a==='profile'){navigate('settings');} else if(a==='activity'){navigate('my-activity');} else if(a==='shortcuts'){openShortcuts();} else if(a!=='theme'){toast(b.textContent.trim()+' — not in this build','info');} closeAllPops(); }));
  // initial route
  let start=(location.hash||'').replace('#','');
  if(!SCREENS[start]&&!DB.nav.flatMap(g=>g.items).some(m=>m.route===start)) start='dashboard';
  // apply the persisted language across the whole shell
  if(typeof applyI18n==='function') applyI18n();
  const envAfterI18n=$('.env'); if(envAfterI18n) envAfterI18n.textContent=DB.company.env||envAfterI18n.textContent;
  navigate(start);
}
/* ---------- keyboard shortcuts reference ---------- */
const SHORTCUTS=[
  {head:'General',rows:[
    {label:'Open command palette',keys:['\u2318','K']},
    {label:'Search everything',keys:['/']},
    {label:'Show this shortcuts panel',keys:['?']},
    {label:'Close menu, dialog or panel',keys:['Esc']},
  ]},
  {head:'Go to',sub:'Press G, then…',rows:[
    {label:'Dashboard',keys:['G','D']},
    {label:'Sales orders',keys:['G','S']},
    {label:'Purchase approvals',keys:['G','P']},
    {label:'Stock on hand',keys:['G','I']},
    {label:'Picking',keys:['G','K']},
  ]},
  {head:'Actions',rows:[
    {label:'Quick create',keys:['C']},
    {label:'Notifications',keys:['N']},
    {label:'Toggle dark appearance',keys:['\u21E7','D']},
  ]},
  {head:'Command palette',sub:'while it’s open',rows:[
    {label:'Move selection',keys:['\u2191','\u2193']},
    {label:'Run selected',keys:['\u21B5']},
    {label:'Dismiss',keys:['Esc']},
  ]},
];
function openShortcuts(){
  const groups=SHORTCUTS.map(g=>`<section class="ksgroup">
    <div class="kshead">${esc(g.head)}${g.sub?`<span>${esc(g.sub)}</span>`:''}</div>
    ${g.rows.map(r=>`<div class="ksrow"><span class="kslabel">${esc(r.label)}</span><span class="kskeys">${r.keys.map(k=>`<kbd class="kbd">${esc(k)}</kbd>`).join('')}</span></div>`).join('')}
  </section>`).join('');
  openModal(`<div class="modal-head">${ic('keyboard')}<h3>Keyboard shortcuts</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body kssheet">${groups}</div>
    <div class="ksfoot">Tip · press <kbd class="kbd">?</kbd> anywhere to reopen this</div>`);
}
let gArmed=0;
function inField(e){ const el=e.target; return !!(el&&(el.isContentEditable||(el.matches&&el.matches('input,textarea,select')))); }
function handleHotkey(e){
  if(e.metaKey||e.ctrlKey||e.altKey||e.repeat) return;
  if(inField(e)) return;
  if($('#modalEl')) return;
  const k=e.key;
  if(gArmed && Date.now()-gArmed<1300){
    gArmed=0;
    const map={d:'dashboard',s:'sales-orders',p:'po-approval',i:'stock-on-hand',k:'picking'};
    const r=map[k.toLowerCase()];
    if(r){ e.preventDefault(); closeAllPops(); navigate(r); }
    return;
  }
  if(k==='g'||k==='G'){ gArmed=Date.now(); return; }
  if(k==='?'){ e.preventDefault(); openShortcuts(); return; }
  if(k==='/'){ e.preventDefault(); openPalette(); return; }
  if(k==='c'||k==='C'){ e.preventDefault(); togglePop('qcMenu',$('#qcBtn')); return; }
  if(k==='n'||k==='N'){ e.preventDefault(); togglePop('notifMenu',$('#bellBtn')); return; }
  if(k==='D'){ e.preventDefault(); toggleTheme(); return; }
}
/* Defer boot until the ERP-System demo adapter has loaded canonical data from
   PGlite (or applied its offline fallback) — see erp-system-data-adapter.js. */
document.addEventListener('DOMContentLoaded',()=>{
  (window.ErpSystemDemoReady||Promise.resolve()).then(boot);
});
