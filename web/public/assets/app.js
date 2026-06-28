/* ============================================================
   ARIA ERP — app shell controller: router, nav, palette, theme
   ============================================================ */
/* SCREENS is declared in ui.js (loads before screen files) */
const ROUTE_MODULE = {};       // route -> module id (for active state)
let CURRENT_ROUTE = null;

/* map every module's primary route + known sub-routes to a module id */
const SUBROUTES = {
  sales:['sales-home','sales-orders','sales-order','quotation','delivery-order','sales-invoice','new-sales-order',
    'enquiries','quotations','so-approvals','delivery-orders','sales-invoices','sales-returns','sales-return',
    'credit-notes','credit-note','debit-notes','price-lists','discount-mgmt','credit-control','sales-commission',
    'sales-reports','report-sales-customer','report-sales-rep','report-quote-conversion','report-generic','new-quotation','txn-view'], purchasing:['purchasing-home','suppliers','purchase-requisitions','rfqs','supplier-quotations','purchase-orders','po-approval','po-approvals','goods-receipts','goods-receipt','supplier-invoices','supplier-invoice','purchase-requisitions','purchase-request','purchase-returns','supplier-credit-notes','supplier-debit-notes','supplier-price-lists','landed-cost','vendor-performance','purchasing-reports','report-pur-supplier','report-pur-buyer','report-pur-price-var','report-pur-vendor','report-pur-generic','new-purchase-order','pur-txn-view'],
  inventory:['stock-on-hand','item-master','new-item','stock-movement','new-stock-adjustment'], warehouse:['picking'],
  crm:['crm-pipeline','opportunity','new-opportunity','crm-customer'],
  manufacturing:['work-orders','work-order','new-work-order','bom','mrp'],
  quality:['qc-inspection','qc-report','ncr'],
  service:['service-ticket','service-order','service-contracts'],
  asset:['asset-register','asset-detail','depreciation'],
  project:['project-pl','project-detail','timesheet'],
  integration:['integration','integration-logs','data-import'],
  finance:['gl','account-ledger','journal-entry','new-journal-entry','payment-voucher','new-payment-voucher','bank-rec','pnl','ar-aging'], hr:['leave-approval','hr-directory','employee','new-employee','payroll-run','payslip'],
  workflow:['po-approval'], bi:['inv-valuation','bi-dashboard','sales-analysis','stock-aging'], admin:['role-permission','master-control','user-mgmt','audit-log','sys-settings'],
};
DB.nav.forEach(g=>g.items.forEach(m=>{ ROUTE_MODULE[m.route]=m.id; }));
Object.entries(SUBROUTES).forEach(([mod,routes])=>routes.forEach(r=>{ if(!ROUTE_MODULE[r]) ROUTE_MODULE[r]=mod; }));
ROUTE_MODULE['settings']='settings';

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
    h+=`<div class="navgroup"><h6>${esc(tf('group.'+g.group, g.group))}</h6>`;
    g.items.forEach(m=>{
      const label=tf('nav.'+m.id, m.label);
      h+=`<button class="nav" data-route="${m.route}" data-mod="${m.id}" data-tip="${esc(label)}">
        ${ic(m.icon)}<span class="navlabel">${esc(label)}</span>
        ${m.badge?`<span class="badge ${m.id==='workflow'||m.id==='purchasing'?'warn':''}">${m.badge}</span>`:''}
      </button>`;
    });
    h+=`</div>`;
  });
  h+=`<div class="sidebar-foot"><button class="nav" data-route="settings" data-mod="settings" data-tip="${esc(t('nav.settings'))}">${ic('gear')}<span class="navlabel">${esc(t('nav.settings'))}</span></button></div>`;
  el.innerHTML=h;
  el.querySelectorAll('.nav[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
  const bb=el.querySelector('#brandBtn');
  bb&&bb.addEventListener('click',()=>setNavCollapsed(!$('#app').classList.contains('nav-collapsed'), true));
}
function setActiveNav(route){
  const mod=ROUTE_MODULE[route];
  $$('#sidebar .nav').forEach(n=>n.classList.toggle('active',n.dataset.mod===mod));
  $$('.tabbar button[data-route]').forEach(n=>n.classList.toggle('active',ROUTE_MODULE[n.dataset.route]===mod));
}

/* ---------- router ---------- */
function navigate(route, params){
  const root=$('#viewRoot');
  if(!SCREENS[route]){
    // unbuilt module -> graceful panel inside a simple shell
    const mod=DB.nav.flatMap(g=>g.items).find(m=>m.route===route);
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name, mod?mod.label:'Module'])}
        <div class="h1row"><h1>${mod?esc(mod.label):'Module'}</h1></div></div>
      ${notBuilt(mod?mod.label:'This module')}
    </section></div>`;
    CURRENT_ROUTE=route; setActiveNav(route); closeAllPops(); return;
  }
  CURRENT_ROUTE=route;
  root.innerHTML='';
  SCREENS[route](root, params||{});
  setActiveNav(route);
  closeAllPops();
  root.scrollTop=0;
  try{ history.replaceState({},'',`#${route}`); }catch(e){}
}

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
    const items=group.items.filter(it=>!q||it.label.toLowerCase().includes(q));
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
      <button class="nc-act" data-nc="readall" data-tip="${esc(t('notif.readall'))}" aria-label="${esc(t('notif.readall'))}">${ic('checkc')}</button>
      <button class="nc-act" data-nc="settings" data-tip="${esc(t('notif.settings'))}" aria-label="${esc(t('notif.settings'))}">${ic('gear')}</button>
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
    const n=DB.notifications.find(x=>x.id===it.dataset.id); if(n)n.unread=false;
    navigate(it.dataset.route);
  }));
  menu.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const n=DB.notifications.find(x=>x.id===b.dataset.dismiss); if(n)n.dismissed=true;
    refreshNotifs(); toast('Notification dismissed','info');
  }));
  const ra=menu.querySelector('[data-nc="readall"]'); ra&&ra.addEventListener('click',e=>{e.stopPropagation();DB.notifications.forEach(n=>n.unread=false);refreshNotifs();toast('All caught up','ok');});
  const st=menu.querySelector('[data-nc="settings"]'); st&&st.addEventListener('click',e=>{e.stopPropagation();toast('Notification settings — not in this build','info');});
  const va=menu.querySelector('[data-nc="viewall"]'); va&&va.addEventListener('click',e=>{e.stopPropagation();closeAllPops();navigate('notifications');});
}
function refreshNotifs(){ const m=$('#notifMenu'); if(m){ m.innerHTML=buildNotifCenter(); wireNotifCenter(); } updateBellBadge(); }
function buildQuickCreate(){
  const items=[[t('qc.so'),'bag','new-sales-order'],[t('qc.po'),'cart','new-purchase-order'],[t('qc.wo'),'factory','new-work-order'],[t('qc.je'),'book','new-journal-entry'],[t('qc.pv'),'coins','new-payment-voucher'],[t('qc.adj'),'adjust','new-stock-adjustment'],[t('qc.item'),'tag','new-item']];
  return `<div class="menu-section"><div class="menu-head">${esc(t('qc.title'))}</div>`+items.map(([l,i,r])=>`<button class="menu-item" data-route="${r}">${ic(i)}<span>${esc(l)}</span></button>`).join('')+`</div>`;
}
function buildCompanyMenu(){
  const m=DB.masters[0];
  const head=`<div class="menu-head">${esc(m.name)} · <span class="mono" style="text-transform:none">${esc(m.id)}</span></div>`;
  const rows=m.companies.map(c=>`<button class="menu-item" data-co="${esc(c.id)}">
    <span class="mc-logo" style="width:26px;height:26px;font-size:9.5px;border-radius:7px">${esc(c.name.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase())}</span>
    <span>${esc(c.name)}<small style="display:block;color:var(--muted);font-size:11px">${esc(c.cur)} · ${c.branches} branch${c.branches>1?'es':''}</small></span>
    <span class="meta">${c.current?ic('check'):''}</span></button>`).join('');
  return `<div class="menu-section">${head}${rows}</div>
    <div class="menu-section"><button class="menu-item" data-co-action="master">${ic('grid')}<span>Master Control</span><span class="meta">${ic('arrowR')}</span></button></div>`;
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
  $('#tabbar').innerHTML=tabs.map(([r,i,l])=>`<button data-route="${r}">${ic(i)}${esc(l)}</button>`).join('')+`<button onclick="openPalette()">${ic('search')}${esc(t('tab.search'))}</button>`;
  $$('#tabbar button[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
}

/* ---------- boot ---------- */
function boot(){
  // theme
  let t='light'; try{t=localStorage.getItem('aria-theme')||'light';}catch(e){}
  applyTheme(t);
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
  const av=$('#avatarBtn'); if(av){ av.textContent=DB.user.initials; av.setAttribute('data-tip','Account · '+DB.user.name); }
  // restore persisted working period, then paint the fiscal-period switcher
  try{ const sp=localStorage.getItem('aria-period'); if(sp){ const parts=sp.split('|'); const fy=(DB.fiscalYears||[]).find(y=>y.fyLabel===parts[0]); if(fy){ DB.fiscal=fy; const i=+parts[1]; if(i>=1&&i<=fy.periodCount) fy.selectedPeriod=i; } } }catch(e){}
  applyPeriod(DB.fiscal.selectedPeriod);
  wirePeriodMenu();
  // popovers fill
  refreshNotifs();
  $('#qcMenu').innerHTML=buildQuickCreate();
  $('#qcMenu').querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
  // company switcher
  $('#companyMenu').innerHTML=buildCompanyMenu();
  $('#companyMenu').querySelectorAll('[data-co]').forEach(b=>b.addEventListener('click',()=>{ closeAllPops(); toast('Switched to '+b.querySelector('span').textContent.trim(),'ok'); }));
  $('#companyMenu').querySelector('[data-co-action="master"]').addEventListener('click',()=>{ closeAllPops(); navigate('master-control'); });
  // language switcher
  $('#langBtn').innerHTML=ic('globe');
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
  $$('#acctMenu .menu-item[data-acct]').forEach(b=>b.addEventListener('click',()=>{ const a=b.dataset.acct; if(a==='signout'){toast('Signed out (demo)','info');} else if(a==='prefs'){navigate('settings',{section:'set-appearance'});} else if(a==='profile'){navigate('settings');} else if(a==='activity'){navigate('my-activity');} else if(a==='shortcuts'){openShortcuts();} else if(a!=='theme'){toast(b.textContent.trim()+' — not in this build','info');} closeAllPops(); }));
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
document.addEventListener('DOMContentLoaded',boot);
