/* ============================================================
   ARIA ERP — app shell controller: router, nav, palette, theme
   ============================================================ */
/* SCREENS is declared in ui.js (loads before screen files) */
const ROUTE_MODULE = {};       // route -> module id (for active state)
let CURRENT_ROUTE = null;
let CURRENT_ROUTE_PARAMS = {};
let SCREEN_RENDER_SEQUENCE = 0;
let MY_WORK_CONTEXT = null;
const DEMO_AUTH_KEY = 'aria-demo-auth';
const API_LOGIN_HINT_KEY = 'aria-api-login-hint';

function readApiLoginHint(){
  try{
    const value=JSON.parse(localStorage.getItem(API_LOGIN_HINT_KEY)||'null');
    return {
      organizationCode:typeof value?.organizationCode==='string'?value.organizationCode:'',
      username:typeof value?.username==='string'?value.username:'',
    };
  }catch{return {organizationCode:'',username:''};}
}
function writeApiLoginHint(organizationCode,username){
  try{localStorage.setItem(API_LOGIN_HINT_KEY,JSON.stringify({organizationCode,username}));}catch{}
}
function clearApiLoginHint(){
  try{localStorage.removeItem(API_LOGIN_HINT_KEY);}catch{}
}

function isSelfServiceOnly(){
  return Boolean(DB.erpSystem&&DB.erpSystem.selfServiceOnly);
}
async function loadMyWorkContext(){
  MY_WORK_CONTEXT=DB.myWorkContext||null;
  const adapter=window.ErpSystemData;
  if(MY_WORK_CONTEXT||!adapter||!adapter.my||typeof adapter.my.context!=='function'){
    return MY_WORK_CONTEXT;
  }
  try{
    const response=await adapter.my.context();
    MY_WORK_CONTEXT=response&&response.data||null;
    DB.myWorkContext=MY_WORK_CONTEXT;
  }catch{
    MY_WORK_CONTEXT=null;
  }
  return MY_WORK_CONTEXT;
}

function demoUser(){
  return DB.user || { name:'Demo Admin', email:'admin@example.com', initials:'DA', role:'Administrator' };
}
function demoAuthSession(){
  try{ return JSON.parse(localStorage.getItem(DEMO_AUTH_KEY)||'null'); }catch{ return null; }
}
function isDemoSignedIn(){
  const s=demoAuthSession();
  return !!(s&&s.signedIn);
}
function setAuthShell(onLogin){
  const bootLoading=$('#bootLoadingView');
  if(bootLoading) bootLoading.remove();
  document.body.classList.toggle('auth-locked',!!onLogin);
  const app=$('#app'), tabs=$('#tabbar');
  if(app) app.setAttribute('aria-hidden',onLogin?'true':'false');
  if(tabs) tabs.setAttribute('aria-hidden',onLogin?'true':'false');
}
function syncDemoBootProgress(payload=window.__ERP_DEMO_PROGRESS__){
  if(!payload||!document.getElementById('bootLoadingView')) return;
  const progress=Math.max(0,Math.min(100,Number(payload.progress)||0));
  const title=$('#bootLoadingTitle');
  const percent=$('#bootLoadingPercent');
  const message=$('#bootLoadingMessage');
  const detail=$('#bootLoadingDetail');
  const bar=$('.demo-boot-progress');
  const fill=$('#bootLoadingProgress');
  if(title&&payload.title) title.textContent=String(payload.title);
  if(percent) percent.textContent=progress+'%';
  if(message&&payload.detail) message.textContent=String(payload.detail);
  if(detail&&payload.phase==='fallback') detail.textContent='Opening the bundled demo view while local storage finishes recovering.';
  if(detail&&payload.phase==='reset') detail.textContent='The original demo data will be available after the reload.';
  if(bar) bar.setAttribute('aria-valuenow',String(progress));
  if(fill) fill.style.width=progress+'%';
}
if(typeof window!=='undefined') window.addEventListener('erp:demo-progress',event=>syncDemoBootProgress(event.detail));
function syncAccountUi(){
  const u=demoUser();
  const av=$('#avatarBtn');
  const avatarSrc=u.avatarUrl||u.imageUrl||u.photoUrl||'';
  if(av){
    av.innerHTML=profileAvatarMedia({name:u.name,src:avatarSrc});
    av.setAttribute('data-tip','Account · '+u.name);
  }
  const menu=$('#acctMenu');
  if(menu){
    const headAv=menu.querySelector('.acct-head .av');
    const name=menu.querySelector('.acct-head .who b');
    const email=menu.querySelector('.acct-head .who small');
    const role=menu.querySelector('.acct-role');
    if(headAv) headAv.innerHTML=profileAvatarMedia({name:u.name,src:avatarSrc});
    if(name) name.textContent=u.name;
    if(email) email.textContent=u.email;
    if(role) role.innerHTML=`${ic('shield')}${esc(u.role||'Demo user')}`;
  }
}
function syncImpersonationUi(){
  const banner=$('#impersonationBanner');
  if(!banner) return;
  const user=DB.user||{};
  if(!user.impersonating){
    banner.hidden=true;
    banner.innerHTML='';
    return;
  }
  banner.hidden=false;
  banner.innerHTML=`<div class="impersonation-copy">${ic('shield')}<span><b>Viewing as employee</b><small>${esc(user.name||'Employee')} · Employee permissions are active</small></span></div>
    <button class="impersonation-return" id="returnToSuperadminBtn" type="button">${ic('arrowL')}<span>${esc(t('employeeWorkspace.returnOwner'))}</span></button>`;
  banner.querySelector('#returnToSuperadminBtn')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try{
      if(!window.ErpSystemData||typeof window.ErpSystemData.returnToAdmin!=='function') throw new Error('Return-to-admin is unavailable in this build.');
      await window.ErpSystemData.returnToAdmin();
      location.reload();
    }catch(error){
      button.disabled=false;
      toast(error&&error.message||t('employeeWorkspace.returnOwnerError'),'danger');
    }
  });
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
    <div class="auth-brand"><span class="mark brand-logo-mark">${window.erpBrandLogo()}</span><span><b>Aria ERP</b><small>Production mode</small></span></div>
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
async function startDemoDatabaseReset(){
  const demoResetBtn=$('#demoResetBtn');
  const errorBox=$('#loginError');
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.reset!=='function'){
    if(errorBox) errorBox.textContent='Demo reset is unavailable in this build.';
    return;
  }
  if(demoResetBtn?.disabled) return;
  if(errorBox) errorBox.textContent='';
  if(demoResetBtn){
    demoResetBtn.disabled=true;
    demoResetBtn.innerHTML=`${ic('refresh')}<span>Resetting demo database…</span>`;
  }
  try{
    await adapter.reset();
  }catch(error){
    if(demoResetBtn){
      demoResetBtn.disabled=false;
      demoResetBtn.innerHTML=`${ic('refresh')}<span>Reset demo database</span>`;
    }
    if(errorBox) errorBox.textContent=(error&&error.message)||'Demo reset failed.';
  }
}
if(typeof window!=='undefined') window.startDemoDatabaseReset=startDemoDatabaseReset;
function renderLogin(){
  const u=demoUser();
  /* TASK-024: in api mode, DB.company is either unset or still holds stale
     mock data from data-core.js's static defaults (no dashboard load without
     a session — see erp-system-api-adapter.js) — never show it pre-auth. Demo
     mode's adapter always finishes loading real data before renderLogin() can
     be reached, so DB.company.name is trustworthy there. */
  const apiMode=typeof window.erpDataMode==='function' && window.erpDataMode()==='api';
  const demoOneClickAvailable=!apiMode&&(!window.ErpSystemDemo||window.ErpSystemDemo.demoOneClickAvailable!==false);
  const companyLabel=(!apiMode && DB.company && DB.company.name) ? (esc(DB.company.name)+' · Static demo') : (apiMode?'Production':'Static demo');
  setAuthShell(true);
  closeAllPops();
  closePalette();
  closeModal();
  const loginHint=apiMode?readApiLoginHint():{organizationCode:'',username:''};
  const rememberedLogin=Boolean(loginHint.organizationCode&&loginHint.username);
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
      <span class="mark brand-logo-mark">${window.erpBrandLogo()}</span>
      <span><b>Aria ERP</b><small>${companyLabel}</small></span>
    </div>
    <div class="auth-copy">
      <h1>Sign in</h1>
      <p>${apiMode
        ? 'Sign in with your account. Sessions are server-side; this browser only holds a secure session cookie.'
        : 'Use the demo account to open the ERP workspace. This static build stores only a local browser session.'}</p>
    </div>
    <form class="auth-form" id="loginForm" autocomplete="${apiMode?'off':'on'}">
      ${apiMode
        ? `<div class="fld"><span>Organization code</span><input id="loginOrganizationCode" name="organizationCode" value="${esc(loginHint.organizationCode)}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. ACME"></div>
           <div class="fld"><span>Username</span><input id="loginUsername" name="username" value="${esc(loginHint.username)}" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. admin"></div>`
        : `<div class="fld"><span>Email</span><input id="loginEmail" type="email" autocomplete="username" value="${esc(u.email)}"></div>`}
      <div class="fld"><span>Password</span><input id="loginPassword" type="password" autocomplete="current-password" placeholder="${apiMode?'':'Account password'}"></div>
      ${apiMode?`<label class="auth-remember"><input id="loginRememberDevice" type="checkbox" name="rememberDevice" ${rememberedLogin?'checked':''}><span>Remember this device (up to 30 days)</span></label>`:''}
      <div class="auth-error" id="loginError" role="alert"></div>
      ${apiMode?'<p class="auth-help">Use the credentials created during first-run setup. The password is never stored in this browser.</p>':''}
      <button class="btn primary lg" type="submit">${ic('signout')}<span>Sign in</span></button>
      ${demoOneClickAvailable?`<button class="btn soft lg" type="button" id="demoLoginBtn">${ic('user')}<span>Continue as ${esc(u.name)}</span></button>`:''}
      ${!apiMode?`<div class="auth-demo-actions">
        <button class="btn soft" type="button" id="demoResetBtn">${ic('refresh')}<span>Reset demo database</span></button>
        <small>Restore the original demo data in this browser.</small>
      </div>`:''}
    </form>
    <div class="auth-foot">
      ${apiMode
        ? `<span class="cap ok"><span class="dot"></span>Production</span><span>Real session — see docs/STATUS.md for current auth scope</span>`
        : `<span class="cap ok"><span class="dot"></span>Demo only</span><span>${demoOneClickAvailable?'One-click access is limited to showcase personas':'Staff credentials and first-login activation are enforced'}</span>`}
    </div>
  </section>`;
  const doLogin=(email)=>{
    try{ localStorage.setItem(DEMO_AUTH_KEY,JSON.stringify({ signedIn:true, email:email||u.email, at:new Date().toISOString() })); }catch{}
    location.reload();
  };
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=apiMode?'':($('#loginEmail').value.trim()||u.email);
    const pass=$('#loginPassword').value.trim();
    if(apiMode){
      const organizationCode=$('#loginOrganizationCode').value.trim();
      const username=$('#loginUsername').value.trim();
      const rememberDevice=Boolean($('#loginRememberDevice')&&$('#loginRememberDevice').checked);
      if(!organizationCode||!username||!pass){ $('#loginError').textContent='Enter your organization code, username and password.'; return; }
      const btnEl=$('#loginForm').querySelector('button[type="submit"]');
      btnEl&&btnEl.setAttribute('disabled','');
      try{
        await window.ErpSystemDemo.login(organizationCode,username,pass,{rememberDevice:rememberDevice});
        if(rememberDevice) writeApiLoginHint(organizationCode,username); else clearApiLoginHint();
        location.reload();
      }catch(err){
        $('#loginError').textContent=(err&&err.message)||'Sign in failed.';
        btnEl&&btnEl.removeAttribute('disabled');
      }
      return;
    }
    if(!pass){
      $('#loginError').textContent=demoOneClickAvailable?'Enter the account password, or use the one-click Demo persona.':'Enter the staff account password.';
      $('#loginPassword').focus();
      return;
    }
    if(window.ErpSystemDemo&&typeof window.ErpSystemDemo.login==='function'){
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
  const demoResetBtn=$('#demoResetBtn');
  demoResetBtn&&demoResetBtn.addEventListener('click',()=>{
    const adapter=window.ErpSystemData;
    if(!adapter||typeof adapter.reset!=='function'){
      $('#loginError').textContent='Demo reset is unavailable in this build.';
      return;
    }
    if(typeof confirmModal==='function'){
      confirmModal({
        icon:'refresh',
        title:'Reset demo database',
        message:'This will remove all local demo records and reload the original demo dataset. Continue?',
        confirmLabel:'Reset database',
        cancelLabel:'Cancel',
        danger:true,
        onConfirm:'startDemoDatabaseReset',
      });
      return;
    }
    startDemoDatabaseReset();
  });
  setTimeout(()=>$(apiMode?'#loginOrganizationCode':'#loginPassword').focus(),60);
}
function renderEmployeeActivation(){

  const activationCopy={
    en:{brand:'Employee activation',title:'Complete your account',body:'Replace the temporary password and add your email before entering My Work.',email:'Email',password:'New password',confirm:'Confirm password',submit:'Activate account',signOut:'Sign out',mismatch:'Passwords do not match.',done:'Account activated. Sign in again with your new password.'},
    ms:{brand:'Pengaktifan pekerja',title:'Lengkapkan akaun anda',body:'Gantikan kata laluan sementara dan tambah e-mel sebelum memasuki My Work.',email:'E-mel',password:'Kata laluan baharu',confirm:'Sahkan kata laluan',submit:'Aktifkan akaun',signOut:'Log keluar',mismatch:'Kata laluan tidak sepadan.',done:'Akaun diaktifkan. Log masuk semula dengan kata laluan baharu.'},
    zh:{brand:'员工账号激活',title:'完成账号激活',body:'进入 My Work 前，请更换临时密码并填写邮箱。',email:'邮箱',password:'新密码',confirm:'确认密码',submit:'激活账号',signOut:'退出登录',mismatch:'两次密码不一致。',done:'账号已激活，请使用新密码重新登录。'},
    ja:{brand:'従業員アカウント有効化',title:'アカウントを有効化',body:'My Work を開く前に仮パスワードを変更し、メールを入力してください。',email:'メール',password:'新しいパスワード',confirm:'パスワード確認',submit:'アカウントを有効化',signOut:'サインアウト',mismatch:'パスワードが一致しません。',done:'有効化しました。新しいパスワードで再ログインしてください。'},
    vi:{
  "brand": "Kích hoạt nhân viên",
  "title": "Hoàn tất tài khoản",
  "body": "Đổi mật khẩu tạm thời và thêm email trước khi vào My Work.",
  "email": "E-mail",
  "password": "Mật khẩu mới",
  "confirm": "Xác nhận mật khẩu",
  "submit": "Kích hoạt tài khoản",
  "signOut": "Đăng xuất",
  "mismatch": "Mật khẩu không khớp.",
  "done": "Tài khoản đã kích hoạt. Hãy đăng nhập lại bằng mật khẩu mới."
},
  };
  const copy=i18nLegacy(activationCopy);
  setAuthShell(true);
  closeAllPops(); closePalette(); closeModal();
  let auth=$('#authView');
  if(!auth){
    auth=document.createElement('main');
    auth.id='authView';
    auth.className='auth-view';
    document.body.insertBefore(auth,$('#app'));
  }
  auth.setAttribute('aria-label',copy.title);
  auth.innerHTML=`<section class="auth-panel">
    <div class="auth-brand"><span class="mark brand-logo-mark">${window.erpBrandLogo()}</span><span><b>Aria ERP</b><small>${esc(copy.brand)}</small></span></div>
    <div class="auth-copy"><h1>${esc(copy.title)}</h1><p>${esc(copy.body)}</p></div>
    <form class="auth-form" id="activationForm">
      <div class="fld"><span>${esc(copy.email)}</span><input id="activationEmail" type="email" autocomplete="email" required></div>
      <div class="fld"><span>${esc(copy.password)}</span><input id="activationPassword" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="fld"><span>${esc(copy.confirm)}</span><input id="activationConfirm" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="auth-error" id="activationError" role="alert"></div>
      <button class="btn primary lg" type="submit">${ic('check')}<span>${esc(copy.submit)}</span></button>
    </form>
    <button class="btn soft" type="button" id="activationSignOut">${ic('signout')}<span>${esc(copy.signOut)}</span></button>
  </section>`;
  $('#activationForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const password=$('#activationPassword').value;
    const confirmPassword=$('#activationConfirm').value;
    if(password!==confirmPassword){ $('#activationError').textContent=copy.mismatch; return; }
    const button=$('#activationForm button[type="submit"]');
    button.setAttribute('disabled','');
    try{
      await window.ErpSystemDemo.completeActivation({
        email:$('#activationEmail').value.trim(),password,confirmPassword,
      });
      alert(copy.done);
      location.reload();
    }catch(error){
      $('#activationError').textContent=(error&&error.message)||'Activation failed.';
      button.removeAttribute('disabled');
    }
  });
  $('#activationSignOut').addEventListener('click',signOutDemo);
  setTimeout(()=>$('#activationEmail').focus(),60);
}
async function signOutDemo(){
  if(
    window.ErpReceiptDrafts
    && typeof window.ErpReceiptDrafts.confirmAndClearBeforeLogout==='function'
    && !await window.ErpReceiptDrafts.confirmAndClearBeforeLogout()
  ) return;
  /* api mode: destroy the real server-side session, not just a local flag. */
  if(window.ErpSystemDemo&&typeof window.ErpSystemDemo.logout==='function'){
    try{ await window.ErpSystemDemo.logout(); }catch{}
  }
  try{ localStorage.removeItem(DEMO_AUTH_KEY); }catch{}
  try{ history.replaceState({},'',location.pathname+location.search); }catch{}
  location.reload();
}

function isTenantControlAdmin(){
  return userHasAnyPermission('admin.master.read');
}
function moduleControlItems(){
  return DB.nav.flatMap(g=>g.items.map(m=>({
    ...m,
    group:g.group,
    /* My Work is the employee self-service surface. It is intentionally
       available even when optional company modules are disabled, and it is
       not part of the commercial entitlement catalog. */
    required:m.id==='home'||m.id==='mywork'||m.id==='admin',
  })));
}
/* Effective platform-owned module state, cached in-memory because
   readModuleControl()/moduleState() are called synchronously from render paths
   (renderSidebar, routeAllowed, ...) that cannot await a fetch. The authenticated
   session carries the safe effective projection for every user.
   Missing projection data fails closed; tenant code never reads allocation or
   Master-entitlement facts. */
let MODULE_CONTROL_CACHE=null;
const BASELINE_MODULE_IDS=new Set(['home','mywork','admin','settings','account']);
function moduleConfigFromRows(rows){
  const cfg={};
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    const moduleKey=String(row&&row.moduleKey||row&&row.module_key||'');
    if(!moduleKey) return;
    cfg[moduleKey]={
      visible:row.enabled===true,
      active:row.enabled===true,
      dependencies:Array.isArray(row.dependencies)?row.dependencies.map(String):[],
      blockers:Array.isArray(row.blockers)?row.blockers.map(String):[],
    };
  });
  return cfg;
}
async function loadModuleControl(){
  const sessionModules=DB.erpSystem&&DB.erpSystem.modules;
  MODULE_CONTROL_CACHE=moduleConfigFromRows(sessionModules);
}
function readModuleControl(){
  /* The authenticated session is the source for commercial modules that do
     not own a top-level legacy navigation group (for example Expenses & Tax).
     Keep that safe effective projection instead of accidentally treating an
     unlisted commercial module as disabled in the browser. */
  const cfg={...(MODULE_CONTROL_CACHE||{})};
  moduleControlItems().forEach(m=>{
    if(m.required){ cfg[m.id]={ visible:true, active:true, dependencies:[], blockers:[] }; return; }
    const cached=MODULE_CONTROL_CACHE&&MODULE_CONTROL_CACHE[m.id];
    cfg[m.id]=cached
      ?{ ...cached, visible:cached.visible, active:cached.active }
      :{ visible:false, active:false, dependencies:[], blockers:[] };
  });
  return cfg;
}
/* The session's effective decision applies to every tenant identity. */
function moduleState(moduleId){
  if(BASELINE_MODULE_IDS.has(moduleId)) return {visible:true,active:true,dependencies:[],blockers:[]};
  return readModuleControl()[moduleId]||{ visible:false, active:false };
}
const NOTIFICATION_VISUALS={
  approval:{ic:'flow',clr:'accent'},inventory:{ic:'box',clr:'warn'},quality:{ic:'shield',clr:'danger'},
  finance:{ic:'receipt',clr:'violet'},sales:{ic:'handshake',clr:'teal'},integration:{ic:'plug',clr:'accent'},
  system:{ic:'checkc',clr:'ok'},
};
/* Keep the client-side guard aligned with the server notification destination
   registry. Unknown or unregistered routes are never rendered as clickable
   notifications, even if an old row remains in the database. */
const NOTIFICATION_DESTINATION_ROUTES=new Set([
  'dashboard','purchase-orders','stock-on-hand','quotations','data-import','qc-inspection',
  'staff-calendar','leave-approval','my-approvals',
]);
function notificationUiRow(row){
  const category=row.category||'system';
  const visual=NOTIFICATION_VISUALS[category]||NOTIFICATION_VISUALS.system;
  const delivered=row.deliveredAt||new Date().toISOString();
  const rawRoute=typeof row.route==='string'?row.route.trim():'';
  const route=rawRoute?notificationDestination({ ...row, route:rawRoute }):'';
  if(rawRoute&&route==null) return null;
  return {
    id:String(row.id), rawId:Number(row.id), kind:row.kind, version:Number(row.version)||1,
    ic:visual.ic, clr:visual.clr, cat:category,
    group:dateValue(delivered)===dateValue(new Date())?'today':'earlier',
    title:row.subject||'', body:row.detail||'', t:dateTimeValue(delivered),
    unread:!row.readAt, dismissed:!!row.dismissedAt, route:route||'', entityRef:row.entityRef||null,
  };
}
function applyCanonicalNotifications(rows){
  DB.notifications=(Array.isArray(rows)?rows:[]).map(notificationUiRow).filter(Boolean);
  return DB.notifications;
}
async function loadNotifications(){
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.list!=='function') throw new Error('The canonical notification service is unavailable.');
  try{
    const result=await adapter.list('account/notifications',{limit:100});
    applyCanonicalNotifications(result&&result.data);
    return DB.notifications;
  }catch(error){
    DB.notifications=[];
    throw error;
  }
}
/* Approval work is a first-class inbox signal. The two readers intentionally
   have different permission scopes: HR users read the company-scoped queue,
   while managers and employee self-service users read their assigned queue.
   Merge whichever calls are authorised so the shell can show one trustworthy
   count without leaking leave details into navigation. */
async function loadApprovalBadge(){
  DB.hrApprovalQueue=[];
  DB.hrApprovalPendingCount=0;
  const my=window.ErpSystemData&&window.ErpSystemData.my;
  const readers=[];
  if(routeAllowed('leave-approval')&&my&&typeof my.approvalQueue==='function'){
    readers.push(my.approvalQueue());
  }
  if(routeAllowed('my-approvals')&&my&&typeof my.approvals==='function'){
    readers.push(my.approvals());
  }
  if(!readers.length) return 0;
  const settled=await Promise.allSettled(readers);
  const unique=new Map();
  settled.forEach(result=>{
    if(result.status!=='fulfilled') return;
    const rows=Array.isArray(result.value&&result.value.data)?result.value.data:[];
    rows.forEach(row=>{
      if(row&&row.status&&row.status!=='pending') return;
      const key=String(row&&((row.requestId??row.id)??''));
      if(key) unique.set(key,row);
    });
  });
  DB.hrApprovalQueue=[...unique.values()];
  DB.hrApprovalPendingCount=DB.hrApprovalQueue.length;
  return DB.hrApprovalPendingCount;
}
function approvalNavBadgeCount(route){
  return route==='leave-approval'||route==='my-approvals'
    ?Number(DB.hrApprovalPendingCount||0):0;
}
function updateApprovalNavBadges(){
  $$('#sidebar [data-nav-badge]').forEach(badge=>{
    const count=approvalNavBadgeCount(badge.dataset.navBadge);
    badge.textContent=count>99?'99+':String(count);
    badge.hidden=count<=0;
    badge.setAttribute('aria-label',`${count} pending approval${count===1?'':'s'}`);
  });
}
async function refreshApprovalBadges(){
  try{ await loadApprovalBadge(); }
  catch(error){
    DB.hrApprovalQueue=[];
    DB.hrApprovalPendingCount=0;
    console.warn('Approval badge load failed',error);
  }
  updateApprovalNavBadges();
  return DB.hrApprovalPendingCount;
}
window.refreshApprovalBadges=refreshApprovalBadges;
async function notificationAction(id,action){
  const row=(DB.notifications||[]).find(item=>String(item.id)===String(id));
  if(!row) return null;
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.action!=='function') throw new Error('The canonical notification service is unavailable.');
  const key=`notification:${row.rawId}:${action}:v${row.version}`;
  const result=await adapter.action('account/notifications',row.rawId,action,{},key);
  const updated=notificationUiRow(result.data);
  const index=DB.notifications.indexOf(row);
  if(action==='dismiss') DB.notifications.splice(index,1);
  else if(updated) DB.notifications[index]=updated;
  else DB.notifications.splice(index,1);
  return updated;
}
function markNotificationRead(id){ return notificationAction(id,'mark-read'); }
function dismissNotification(id){ return notificationAction(id,'dismiss'); }
async function markAllNotificationsRead(){
  await Promise.all((DB.notifications||[]).filter(n=>n.unread&&!n.dismissed).map(n=>markNotificationRead(n.id)));
}
async function dismissAllNotifications(){
  await Promise.all((DB.notifications||[]).filter(n=>!n.dismissed).map(n=>dismissNotification(n.id)));
}
function routeModuleId(route){
  if(route==='settings') return 'settings';
  if(route==='notifications'||route==='my-activity') return 'account';
  if(route==='company-receipts') return 'expenses_tax';
  return ROUTE_MODULE[route];
}
function userHasAnyPermission(required){
  const keys=DB.user&&Array.isArray(DB.user.permissionKeys)?DB.user.permissionKeys:[];
  if(keys.includes('*')) return true;
  const wanted=Array.isArray(required)?required:[required];
  return wanted.filter(Boolean).some(key=>keys.includes(key));
}
function canReadModule(mod){
  const hasPermissionPayload=DB.user&&Array.isArray(DB.user.permissionKeys);
  const keys=hasPermissionPayload?DB.user.permissionKeys:[];
  if(keys.includes('*')) return true;
  if(!hasPermissionPayload) return true;
  const required={
    sales:['sales.read'],purchasing:['purchasing.read'],crm:['crm.read'],
    inventory:['inventory.read'],warehouse:['warehouse.read'],manufacturing:['manufacturing.read'],
    quality:['quality.read'],finance:['finance.read'],hr:['hr.read'],project:['project.read'],
    service:['service.read'],asset:['asset.read'],workflow:[
      'sales.approve','purchasing.approve','finance.approve','hr.approve','project.approve',
      'employee.team.read','expenses.approve.manager','expenses.approve.finance',
    ],
    bi:['reporting.read'],admin:['admin.users.read','admin.roles.read','admin.master.read'],
    integration:['integration.read'],settings:['settings.read'],mywork:['employee.self.read'],
    expenses_tax:['expenses.company_receipts.read_company','expenses.company_receipts.read_own'],
  }[mod];
  return !required||required.some(key=>keys.includes(key));
}
const ROUTE_ACTION_PERMISSION={
  dashboard:'dashboard.read',
  'new-sales-order':['sales.create','sales.write'],
  'new-purchase-order':['purchasing.create','purchasing.write'],
  'new-work-order':['manufacturing.create','manufacturing.write'],
  'new-journal-entry':['finance.create','finance.write'],
  'new-payment-voucher':['finance.create','finance.write'],
  'new-stock-adjustment':'inventory.adjust',
  'new-item':['inventory.create','inventory.write'],
  'new-quotation':['sales.create','sales.write'],
  'new-opportunity':['crm.create','crm.write'],
  'new-employee':['hr.create','hr.write'],
  'receipt-tax-evidence':'expenses.tax_evidence.generate',
  'company-receipts':['expenses.company_receipts.read_company','expenses.company_receipts.read_own'],
  'so-approvals':'sales.approve',
  'po-approvals':'purchasing.approve',
  'payroll-run':'payroll.read',
  'payslip':'payroll.read',
  notifications:'notifications.read',
  'user-mgmt':'admin.users.read','role-permission':'admin.roles.read',
  'audit-log':'admin.audit.read','master-control':'admin.master.read',
  'sys-settings':'settings.read','company-onboarding':'admin.roles.write',
};
function routeCapabilityAllowed(route){
  const actionPermission=ROUTE_ACTION_PERMISSION[route];
  if(actionPermission&&!userHasAnyPermission(actionPermission)) return false;
  if(route==='team-calendar'){
    return myWorkCapabilityEnabled({capability:'team'});
  }
  if(route==='my-approvals'){
    return Boolean(MY_WORK_CONTEXT)&&userHasAnyPermission('employee.self.read');
  }
  return true;
}
function routeAllowed(route){
  const mod=routeModuleId(route);
  if(isSelfServiceOnly()&&!['mywork','settings'].includes(mod)) return false;
  if(!mod) return true;
  if(!canReadModule(mod)) return false;
  if(!routeCapabilityAllowed(route)) return false;
  const st=moduleState(mod);
  return st.visible&&st.active;
}
function routeDeniedByPermission(route){
  const mod=routeModuleId(route);
  if(isSelfServiceOnly()&&!['mywork','settings'].includes(mod)) return true;
  return Boolean(mod&&(
    !canReadModule(mod)||!routeCapabilityAllowed(route)
  ));
}
function routeShownInCommands(route){
  const mod=routeModuleId(route);
  if(isSelfServiceOnly()&&!['mywork','settings'].includes(mod)) return false;
  if(!mod) return true;
  if(!canReadModule(mod)) return false;
  if(!routeCapabilityAllowed(route)) return false;
  const st=moduleState(mod);
  return st.visible&&st.active;
}
function approvalRouteForUser(row){
  const raw=row&&row.route;
  const canHr=userHasAnyPermission(['hr.read','hr.write','hr.approve']);
  const canSelf=userHasAnyPermission('employee.self.read');
  if(raw==='my-approvals'&&canSelf){
    return 'my-approvals';
  }
  if((raw==='leave-approval'||raw==='my-approvals')&&canHr){
    return 'leave-approval';
  }
  if(raw==='leave-approval'&&!canHr
      &&userHasAnyPermission(['employee.team.read','expenses.approve.manager'])){
    return 'my-approvals';
  }
  return raw;
}
function approvalVisibleToUser(row){
  const route=approvalRouteForUser(row);
  const required=route==='so-approvals'?['sales.approve']
    :route==='po-approvals'?['purchasing.approve']
    :row&&row.route==='leave-approval'?['hr.read','hr.write','hr.approve','employee.team.read','expenses.approve.manager']
    :[];
  return required.length>0&&userHasAnyPermission(required)&&routeAllowed(route);
}
/* One destination guard for notification feeds, the bell popover and future
   notification producers. A notification with a route the current identity
   cannot open is not a useful UI item, so it is filtered before rendering. */
function notificationDestination(row){
  const raw=typeof row?.route==='string'?row.route.trim():'';
  if(!raw) return '';
  if(!NOTIFICATION_DESTINATION_ROUTES.has(raw)) return null;
  const route=raw==='leave-approval'?approvalRouteForUser(row):raw;
  const normalizedRoute=raw==='my-approvals'?approvalRouteForUser(row):route;
  return routeAllowed(normalizedRoute)?normalizedRoute:null;
}
function moduleBlockedPanel(route){
  const mod=routeModuleId(route);
  const item=moduleControlItems().find(m=>m.id===mod);
  const label=item?item.label:mod==='expenses_tax'?t('module.expensesTax'):(mod||route);
  const st=mod?moduleState(mod):{ visible:true, active:true };
  const reason=st.visible?t('access.moduleInactive'):t('access.moduleHidden');
  return `<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,t('access.moduleCrumb')])}
      <div class="h1row"><h1>${esc(t('access.moduleUnavailable',{module:label}))}</h1>${cap(reason,'warn')}</div>
      <div class="h1sub">${esc(t('access.modulePlatformControlled'))}</div>
    </div>
    ${statePanel({icon:'lock',title:t('access.moduleNotAvailable'),body:t('access.modulePlatformHelp')})}
  </section></div>`;
}
function permissionBlockedPanel(){
  const params=esc(JSON.stringify({company:DB.company.name}));
  return `<div class="content full"><section class="master" data-access-denied="403">
    <div class="pagehead">${crumbs([DB.company.name,t('access.routeCrumb')])}
      <div class="h1row"><h1 data-i18n="access.routeTitle">${esc(t('access.routeTitle'))}</h1><span class="cap danger"><span class="dot"></span><span data-i18n="access.routeBadge">${esc(t('access.routeBadge'))}</span></span></div>
      <div class="h1sub" data-i18n="access.routeHelp">${esc(t('access.routeHelp'))}</div>
    </div>
    <div class="statepanel"><div class="ic">${ic('lock')}</div>
      <h3 data-i18n="access.routeDenied">${esc(t('access.routeDenied'))}</h3>
      <p data-i18n="access.routeBody" data-i18n-params="${params}">${esc(t('access.routeBody',{company:DB.company.name}))}</p>
    </div>
  </section></div>`;
}
function isSuperadminUi(){
  return !DB.user?.impersonating && DB.user?.is_company_owner===true;
}

function ensureEmployeeWorkspaceMenuItem(){
  const menu=$('#acctMenu'); if(!menu) return;
  const existing=menu.querySelector('[data-acct="employee-workspace"]');
  if(!isSuperadminUi()){
    if(existing) existing.remove();
    return;
  }
  if(existing) return;
  const firstSection=menu.querySelector('.menu-section');
  if(!firstSection) return;
  const btnEl=document.createElement('button');
  btnEl.className='menu-item';
  btnEl.setAttribute('data-acct','employee-workspace');
  btnEl.innerHTML=`${ic('people')}<span>${esc(t('acct.employeeWorkspace'))}</span><span class="meta">${ic('arrowR')}</span>`;
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
  btnEl.innerHTML=`${ic('people')}<span>${esc(t('acct.switchDemoUser'))}</span><span class="meta">${ic('arrowR')}</span>`;
  firstSection.appendChild(btnEl);
}
function openUserSwitcher(){
  const users=(DB.erpSystem&&DB.erpSystem.users)||[];
  const ordered=[...users].sort((a,b)=>Number(!!b.is_company_owner)-Number(!!a.is_company_owner)
    ||String(a.full_name||a.email).localeCompare(String(b.full_name||b.email)));
  const rows=ordered.map(u=>{
    const name=u.full_name||u.email;
    const current=DB.user&&DB.user.email===u.email;
    const roleLabel=u.is_company_owner?'Company Owner':((u.roles||[]).join(' + ')||t('demoUser.employee'));
    const accessLabel=u.is_company_owner?'Company-scoped administration':t('demoUser.companyAccess',{count:(u.companies||[]).length||1});
    return `<button class="menu-item" style="width:100%" ${current?'disabled':''} data-switch-email="${esc(u.email)}">
      ${ic(u.is_company_owner?'shield':'user')}
      <span>${esc(name)}<small style="display:block;color:var(--muted);font-size:11px">${esc(u.email)} · ${esc(roleLabel)}</small><small style="display:block;color:var(--muted);font-size:10.5px">${esc(accessLabel)}</small></span>
      <span class="meta">${current?ic('check'):''}</span></button>`;
  }).join('');
  appModal({ icon:'people', title:t('demoUser.switchTitle'), body:`<p class="hint" style="margin:0 0 10px">${esc(t('demoUser.switchHint'))}</p><div role="list" style="display:grid;gap:4px;max-height:min(62vh,560px);overflow:auto">${rows}</div>`, width:420 });
  $$('#modalEl [data-switch-email]').forEach(b=>b.addEventListener('click',async ()=>{
    const email=b.dataset.switchEmail;
    closeModal();
    if(window.ErpSystemDemo&&typeof window.ErpSystemDemo.switchUser==='function'){
      try{ await window.ErpSystemDemo.switchUser(email); }catch{}
    }
    location.reload();
  }));
}

function employeeWorkspaceTargetName(target){
  return target.fullName||target.full_name||target.name||target.username||t('employeeWorkspace.employee');
}
function employeeWorkspaceTargetId(target){
  return Number(target.userId??target.user_id);
}
function employeeWorkspaceTargetDetail(target){
  return [
    target.employeeNo||target.employee_no,
    target.jobTitle||target.job_title,
    target.department,
  ].filter(Boolean).join(' · ');
}
function openEmployeeWorkspaceConfirm(target){
  const name=employeeWorkspaceTargetName(target);
  const detail=employeeWorkspaceTargetDetail(target);
  appModal({
    icon:'shield',
    title:t('employeeWorkspace.confirmTitle'),
    body:`<p class="hint" style="margin:0 0 14px;line-height:1.5">${esc(t('employeeWorkspace.confirmBody',{name}))}</p>
      <div class="fld"><span>${esc(t('employeeWorkspace.reason'))}</span>
        <input id="employeeWorkspaceReason" maxlength="240" value="${esc(t('employeeWorkspace.defaultReason'))}">
      </div>${detail?`<p class="hint" style="margin:10px 0 0">${esc(detail)}</p>`:''}`,
    actions:btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})
      +btn(t('employeeWorkspace.enter'),{icon:'arrowR',cls:'primary',attrs:'id="employeeWorkspaceConfirmBtn"'}),
    width:460,
  });
  $('#employeeWorkspaceConfirmBtn')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    const reason=$('#employeeWorkspaceReason')?.value.trim()||t('employeeWorkspace.defaultReason');
    try{
      if(!window.ErpSystemData||typeof window.ErpSystemData.impersonateUser!=='function'){
        throw new Error(t('employeeWorkspace.error'));
      }
      await window.ErpSystemData.impersonateUser(employeeWorkspaceTargetId(target),reason);
      closeModal();
      location.reload();
    }catch(error){
      button.disabled=false;
      toast(error&&error.message||t('employeeWorkspace.error'),'danger');
    }
  });
}
async function openEmployeeWorkspaceSwitcher(){
  appModal({
    icon:'people',
    title:t('employeeWorkspace.title'),
    body:`<p class="hint" style="margin:0 0 12px;line-height:1.5">${esc(t('employeeWorkspace.hint'))}</p>
      <div class="fld" style="margin-bottom:10px"><span>${esc(t('employeeWorkspace.search'))}</span>
        <input id="employeeWorkspaceSearch" type="search" autocomplete="off" placeholder="${esc(t('employeeWorkspace.search'))}">
      </div><div id="employeeWorkspaceTargetList" role="list" style="display:grid;gap:6px;max-height:min(54vh,480px);overflow:auto"></div>`,
    actions:btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'}),
    width:520,
  });
  const list=$('#employeeWorkspaceTargetList');
  const search=$('#employeeWorkspaceSearch');
  let targets=[];
  let loading=true;
  let failed=false;
  const render=()=>{
    if(!list) return;
    if(loading){
      list.innerHTML=`<div class="statepanel" style="padding:28px 16px"><div class="ic">${ic('loader')}</div><p>${esc(t('employeeWorkspace.loading'))}</p></div>`;
      return;
    }
    if(failed){
      list.innerHTML=`<div class="statepanel" style="padding:28px 16px"><div class="ic">${ic('warn')}</div><p>${esc(t('employeeWorkspace.error'))}</p></div>`;
      return;
    }
    const needle=String(search?.value||'').trim().toLowerCase();
    const filtered=targets.filter(target=>{
      const haystack=[employeeWorkspaceTargetName(target),employeeWorkspaceTargetDetail(target),target.username].join(' ').toLowerCase();
      return !needle||haystack.includes(needle);
    });
    if(!filtered.length){
      list.innerHTML=`<div class="statepanel" style="padding:28px 16px"><div class="ic">${ic('people')}</div><h3>${esc(t('employeeWorkspace.empty'))}</h3><p>${esc(t('employeeWorkspace.emptyBody'))}</p></div>`;
      return;
    }
    list.innerHTML=filtered.map(target=>{
      const id=employeeWorkspaceTargetId(target);
      const name=employeeWorkspaceTargetName(target);
      const detail=employeeWorkspaceTargetDetail(target)||target.username||'';
      return `<button class="menu-item" type="button" role="listitem" data-employee-target="${esc(id)}" style="width:100%;text-align:left">
        ${ic('user')}<span><b>${esc(name)}</b><small style="display:block;color:var(--muted);font-size:11px">${esc(detail)}</small></span><span class="meta">${ic('arrowR')}</span></button>`;
    }).join('');
    list.querySelectorAll('[data-employee-target]').forEach(button=>button.addEventListener('click',()=>{
      const target=targets.find(item=>employeeWorkspaceTargetId(item)===Number(button.dataset.employeeTarget));
      if(target) openEmployeeWorkspaceConfirm(target);
    }));
  };
  search?.addEventListener('input',render);
  render();
  try{
    const adapter=window.ErpSystemData;
    if(!adapter||typeof adapter.employeeWorkspaceTargets!=='function') throw new Error('Employee workspace selector is unavailable.');
    const response=await adapter.employeeWorkspaceTargets();
    targets=(Array.isArray(response?.data)?response.data:[]).filter(target=>employeeWorkspaceTargetId(target)>0);
  }catch(error){
    failed=true;
    console.error('Employee workspace target load failed',error);
  }finally{
    loading=false;
    render();
  }
}

/* map every module's primary route + known sub-routes to a module id */
const SUBROUTES = {
  sales:['sales-home','sales-orders','sales-order','quotation','delivery-order','sales-invoice','new-sales-order',
    'enquiries','quotations','so-approvals','delivery-orders','sales-invoices','sales-returns','sales-return',
    'credit-notes','credit-note','debit-notes','price-lists','discount-mgmt','credit-control','sales-commission',
    'sales-reports','report-sales-customer','report-sales-rep','report-quote-conversion','report-generic','new-quotation','txn-view'], purchasing:['purchasing-home','suppliers','supplier','purchase-requisitions','rfqs','supplier-quotations','purchase-orders','po-approval','po-approvals','goods-receipts','goods-receipt','supplier-invoices','supplier-invoice','purchase-requisitions','purchase-request','purchase-returns','supplier-credit-notes','supplier-debit-notes','supplier-price-lists','landed-cost','vendor-performance','purchasing-reports','report-pur-supplier','report-pur-buyer','report-pur-price-var','report-pur-vendor','report-pur-generic','new-purchase-order','pur-txn-view'],
  inventory:['stock-on-hand','item-master','new-item','stock-movement','new-stock-adjustment','inv-valuation'], warehouse:['picking'],
  crm:['crm-pipeline','opportunity','new-opportunity','crm-customer'],
  manufacturing:['work-orders','work-order','new-work-order','bom','mrp'],
  quality:['qc-inspection','qc-report','ncr'],
  service:['service-ticket','service-order','service-contracts','service-contract'],
  asset:['asset-register','asset-detail','depreciation'],
  project:['project-pl','project-detail','timesheet'],
  integration:['integration','integration-logs','data-import'],
  finance:['gl','account-ledger','journal-entry','new-journal-entry','payment-voucher','new-payment-voucher','bank-rec','pnl','ar-aging','company-receipts'], hr:['leave-approval','leave-workflow','hr-directory','employee','new-employee','hr-calendar','staff-calendar','payroll-run','payslip'],
  mywork:['my-leave','leave-application','my-claims','expense-claim','my-receipts','company-receipts','receipt-tax-evidence','team-calendar','my-approvals'],
  workflow:['approval-inbox'], bi:['bi-dashboard','sales-analysis','stock-aging'], admin:['role-permission','master-control','user-mgmt','audit-log','sys-settings','company-onboarding','notifications'],
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
  'approval-inbox',
  'sales-orders','sales-order','sales-invoices','sales-invoice',
  'stock-on-hand','stock-movement','inv-valuation','new-item',
  'gl','account-ledger','journal-entry','new-journal-entry','pnl','ar-aging',
  'suppliers','supplier','purchase-orders','goods-receipts','supplier-invoices','new-purchase-order',
  'crm-pipeline','opportunity','new-opportunity',
  'settings',
  'picking',
  'new-stock-adjustment',
  'work-orders','work-order','new-work-order',
  'bom','mrp',
  'qc-inspection','qc-report','ncr',
  'enquiries','quotations','quotation','new-quotation',
  'delivery-orders','delivery-order',
  'sales-returns','sales-return','credit-notes','credit-note',
  'debit-notes','price-lists','discount-mgmt','credit-control',
  'item-master','crm-customer',
  'asset-register','asset-detail','depreciation',
  'user-mgmt','audit-log','role-permission','company-onboarding',
  'hr-directory','employee','new-employee','leave-approval','leave-workflow','hr-calendar','staff-calendar','payroll-run','payslip',
  'project-pl','project-detail','timesheet',
  'my-leave','leave-application','my-claims','expense-claim','my-receipts','company-receipts','receipt-tax-evidence','team-calendar','my-approvals',
  'integration-logs','data-import',
  'service-ticket','service-order','service-contracts','service-contract',
  'purchase-requisitions','purchase-request',
  'payment-voucher','new-payment-voucher',
  'rfqs','supplier-quotations',
  'purchase-returns','supplier-credit-notes','supplier-debit-notes','landed-cost',
  'po-approvals','po-approval',
  'goods-receipt','supplier-invoice',
  'supplier-price-lists','vendor-performance',
  'purchasing-home','purchasing-reports','report-pur-supplier','report-pur-buyer',
  'report-pur-price-var','report-pur-vendor','report-pur-generic','pur-txn-view',
  'new-sales-order','so-approvals',
  'sales-home','sales-reports','report-sales-customer','report-sales-rep','report-quote-conversion','report-generic','sales-commission','txn-view',
  'bank-rec',
  'bi-dashboard','sales-analysis','stock-aging',
  'my-activity','notifications',
  'integration','master-control','sys-settings',
]);
const CANONICAL_DATA_PREVIEW_ROUTES = new Set([]);
const API_SCREEN_ROUTES = new Set([
  'dashboard',
  'approval-inbox',
  'stock-on-hand','stock-movement','inv-valuation','new-item',
  'sales-orders','sales-order','sales-invoices','sales-invoice',
  'gl','account-ledger','journal-entry','new-journal-entry','pnl','ar-aging',
  'suppliers','supplier','purchase-orders','goods-receipts','supplier-invoices','new-purchase-order',
  'crm-pipeline','opportunity','new-opportunity',
  'settings',
  'picking',
  'new-stock-adjustment',
  'work-orders','work-order','new-work-order',
  'bom','mrp',
  'qc-inspection','qc-report','ncr',
  'enquiries','quotations','quotation','new-quotation',
  'delivery-orders','delivery-order',
  'sales-returns','sales-return','credit-notes','credit-note',
  'debit-notes','price-lists','discount-mgmt','credit-control',
  'item-master','crm-customer',
  'asset-register','asset-detail','depreciation',
  'user-mgmt','audit-log','role-permission','company-onboarding',
  'hr-directory','employee','new-employee','leave-approval','leave-workflow','hr-calendar','payroll-run','payslip',
  'project-pl','project-detail','timesheet',
  'integration-logs','data-import',
  'bank-rec',
  'bi-dashboard','sales-analysis','stock-aging',
  'service-ticket','service-order','service-contracts','service-contract',
  'purchase-requisitions','purchase-request',
  'payment-voucher','new-payment-voucher',
  'rfqs','supplier-quotations',
  'purchase-returns','supplier-credit-notes','supplier-debit-notes','landed-cost',
  'po-approvals','po-approval',
  'goods-receipt','supplier-invoice',
  'supplier-price-lists','vendor-performance',
  'purchasing-home','purchasing-reports','report-pur-supplier','report-pur-buyer',
  'report-pur-price-var','report-pur-vendor','report-pur-generic','pur-txn-view',
  'new-sales-order','so-approvals',
  'sales-home','sales-reports','report-sales-customer','report-sales-rep','report-quote-conversion','report-generic','sales-commission','txn-view',
  'my-activity',
  'notifications',
  'integration','master-control','sys-settings',
  'my-leave','leave-application','my-claims','expense-claim','my-receipts','company-receipts','receipt-tax-evidence','team-calendar','my-approvals',
]);
const SCREEN_ACTIVE_ALIASES = {
  quotation:'quotations','delivery-order':'delivery-orders','sales-invoice':'sales-invoices',
  'sales-order':'sales-orders','new-sales-order':'sales-orders','sales-return':'sales-returns',
  'credit-note':'credit-notes','new-quotation':'quotations','txn-view':'enquiries',
  'purchase-request':'purchase-requisitions','supplier':'suppliers','goods-receipt':'goods-receipts',
  'supplier-invoice':'supplier-invoices','po-approval':'po-approvals',
  'new-purchase-order':'purchase-orders','pur-txn-view':'purchase-orders',
  'new-item':'item-master','new-stock-adjustment':'stock-movement',
  'work-order':'work-orders','new-work-order':'work-orders',
  'qc-report':'qc-inspection',
  opportunity:'crm-pipeline','new-opportunity':'crm-pipeline','crm-customer':'crm-pipeline',
  employee:'hr-directory','new-employee':'hr-directory','payslip':'payroll-run',
  'project-detail':'project-pl',
  'asset-detail':'asset-register',
  'service-contract':'service-contracts',
  'leave-application':'my-leave',
  'expense-claim':'my-claims',
  'new-journal-entry':'journal-entry','new-payment-voucher':'payment-voucher',
};
const MODULE_DEFS = {
  account:{ labelKey:'acct.activity', home:'my-activity', items:[
    ['my-activity','My Activity','history','acct.activity'],
    ['notifications','Notifications','bell','route.notifications'],
  ]},
  /* sales/purchasing/inventory reference the section/alias data already defined in
     screens-sales-hub.js/screens-purchasing-hub.js/screens-inv.js (loaded before
     app.js -- see the script order in index.html), rather than duplicating it here.
     Those files' own SALES_SECTIONS/PUR_SECTIONS/INVENTORY_SECTIONS are also the
     hub screens' (sales-home/purchasing-home) tile-grid data source, so this is the
     single real source of truth, not a copy (TASK-045). */
  sales:{ labelKey:'nav.sales', home:'sales-home', ariaLabel:'Sales sections',
    sections:SALES_SECTIONS, alias:SALES_ALIAS },
  purchasing:{ labelKey:'nav.purchasing', home:'purchasing-home', ariaLabel:'Purchasing sections',
    sections:PUR_SECTIONS, alias:PUR_ALIAS },
  inventory:{ labelKey:'nav.inventory', home:'stock-on-hand', navClass:'inventory-subnav',
    items:INVENTORY_SECTIONS, alias:INVENTORY_ALIAS },
  finance:{ labelKey:'nav.finance', home:'gl', items:[
    ['gl','General Ledger','book'],['account-ledger','Account Ledger','list'],
    ['journal-entry','Journal Entries','receipt'],['payment-voucher','Payment Vouchers','coins'],
    ['bank-rec','Bank Reconciliation','refresh'],['pnl','Profit & Loss','chart'],
    ['ar-aging','AR Aging','clock'],['company-receipts','Company Receipts','receipt','route.company-receipts'],
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
    {route:'leave-workflow',labelKey:'route.leave-workflow',icon:'flow'},
    ['hr-calendar','Calendar','calendar','route.hr-calendar'],
    ['staff-calendar','Staff Calendar','calendar','route.staff-calendar'],
    ['payroll-run','Payroll','coins'],
  ]},
  mywork:{ labelKey:'nav.mywork', home:'my-leave', items:[
    {route:'my-leave',labelKey:'myWork.nav.leave',icon:'calendar'},
    {route:'my-claims',labelKey:'myWork.nav.claims',icon:'receipt'},
    {route:'my-receipts',labelKey:'myWork.nav.receipts',icon:'upload'},
    {route:'company-receipts',labelKey:'route.company-receipts',icon:'receipt'},
    {route:'receipt-tax-evidence',labelKey:'myWork.nav.taxEvidence',icon:'filepdf'},
    {route:'team-calendar',labelKey:'myWork.nav.teamCalendar',icon:'people',capability:'team'},
    {route:'my-approvals',labelKey:'myWork.nav.approvals',icon:'check',capability:'approvals'},
  ]},
  workflow:{ labelKey:'nav.workflow', home:'approval-inbox', items:[
    {route:'approval-inbox',labelKey:'approvalInbox.title',icon:'flow'},
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
    ['sys-settings','System Settings','gear'],['company-onboarding','Company Onboarding','check'],
  ]},
};
const MODULE_READ_PERMISSION = {
  home:'dashboard.read', sales:'sales.read', purchasing:'purchasing.read',
  crm:'crm.read', inventory:'inventory.read', warehouse:'warehouse.read',
  manufacturing:'manufacturing.read', quality:'quality.read', finance:'finance.read',
  hr:'hr.read', project:'project.read', service:'service.read', asset:'asset.read',
  workflow:'approval.read', bi:'reporting.read', admin:'admin.read',
  integration:'integration.read', settings:'settings.read', mywork:'employee.self.read',
};
const SCREEN_FIXTURES = {
  'txn-view':'sales-enquiry',
};
const SCREEN_LAYOUT_GROUPS = Object.freeze({
  'transaction-list-v1':[
    'enquiries','quotations','sales-orders','so-approvals','delivery-orders','sales-invoices',
    'sales-returns','credit-notes','debit-notes','price-lists','discount-mgmt',
    'credit-control','suppliers','purchase-requisitions','rfqs',
    'supplier-quotations','purchase-orders','goods-receipts','supplier-invoices',
    'purchase-returns','supplier-credit-notes','supplier-debit-notes','po-approvals',
    'supplier-price-lists','landed-cost','stock-movement','work-orders',
    'qc-inspection','gl','hr-directory','project-pl','timesheet','service-ticket',
    'service-contracts','asset-register','user-mgmt',
    'my-leave','my-claims','my-receipts','company-receipts','approval-inbox',
  ],
  'master-detail-register-v1':[
    'item-master','stock-on-hand','leave-approval','leave-workflow','payroll-run','depreciation',
    'my-approvals',
  ],
  'calendar-workspace-v1':[
    'team-calendar','staff-calendar','hr-calendar',
  ],
  'report-list-v1':[
    'inv-valuation','ar-aging',
  ],
  'operational-workspace-v1':[
    'picking',
  ],
  'master-detail-editor-v1':[
    'bom','employee','service-contract','asset-detail',
  ],
  'case-detail-v1':[
    'ncr','service-order','po-approval','leave-application','expense-claim','sales-return',
  ],
  'ledger-detail-v1':[
    'account-ledger',
  ],
  'posting-detail-v1':[
    'journal-entry','payment-voucher','goods-receipt',
  ],
  'financial-statement-v1':[
    'pnl',
  ],
  dashboard:[
    'dashboard','sales-home','purchasing-home','bi-dashboard',
  ],
  report:[
    'audit-log','purchasing-reports','receipt-tax-evidence',
    'report-generic','report-pur-buyer','report-pur-generic','report-pur-price-var',
    'report-pur-supplier','report-pur-vendor','report-quote-conversion',
    'report-sales-customer','report-sales-rep','sales-analysis','sales-reports',
    'stock-aging','vendor-performance',
  ],
  'document-detail':[
    'credit-note','delivery-order',
    'opportunity','payslip','project-detail','supplier',
    'pur-txn-view','purchase-request','qc-report','quotation','sales-invoice',
    'sales-order','supplier-invoice','txn-view',
    'work-order',
  ],
  form:[
    'new-employee','new-item','new-journal-entry','new-opportunity',
    'new-payment-voucher','new-purchase-order','new-quotation','new-sales-order',
    'new-stock-adjustment','new-work-order',
  ],
  'master-detail':[
    'crm-customer','role-permission',
  ],
  workspace:[
    'bank-rec','data-import','integration','master-control',
    'company-onboarding','mrp',
    'sales-commission','settings','sys-settings',
  ],
  board:['crm-pipeline'],
  'activity-feed':['integration-logs','my-activity','notifications'],
});
const SCREEN_LAYOUTS = Object.freeze(Object.fromEntries(
  Object.entries(SCREEN_LAYOUT_GROUPS)
    .flatMap(([layout,routes])=>routes.map(route=>[route,layout])),
));
const SCREEN_META = {};
Object.keys(SCREENS).forEach(route=>{
  // Keep metadata on the same canonical resolver used by routeAllowed().
  // Notifications and account activity are also present in the Admin nav for
  // legacy layout reasons, but their access boundary is account-scoped.
  const moduleId=routeModuleId(route)||(
    route==='dashboard'?'home':
    route==='settings'?'settings':
    ['notifications','my-activity'].includes(route)?'account':'unmapped'
  );
  const canonical=CANONICAL_SCREEN_ROUTES.has(route);
  const canonicalData=canonical||CANONICAL_DATA_PREVIEW_ROUTES.has(route);
  SCREEN_META[route]=Object.freeze({
    route,
    module:moduleId,
    maturity:canonical?'canonical':'preview',
    dataSource:canonicalData?'canonical':'sample',
    supportedModes:API_SCREEN_ROUTES.has(route)?['demo','api']:['demo'],
    activeSection:SCREEN_ACTIVE_ALIASES[route]||route,
    permission:MODULE_READ_PERMISSION[moduleId]||null,
    fixture:SCREEN_FIXTURES[route]||null,
    layout:SCREEN_LAYOUTS[route]||null,
  });
});
window.SCREEN_META=SCREEN_META;

function getScreenMeta(route){
  return SCREEN_META[route]||{
    route, module:ROUTE_MODULE[route]||'unmapped', maturity:'preview',
    dataSource:'sample', supportedModes:['demo'], activeSection:route,
    permission:null, fixture:null, layout:null,
  };
}
function moduleMaturity(moduleId){
  const rows=Object.values(SCREEN_META).filter(m=>m.module===moduleId);
  if(!rows.length) return 'preview';
  const canonical=rows.filter(m=>m.maturity==='canonical').length;
  return canonical===0?'preview':canonical===rows.length?'canonical':'partial';
}
/* Single generic sub-nav renderer for every module, including sales/purchasing/
   inventory (TASK-045 -- previously special-cased to salesNav()/purNav()/
   inventoryNav(), which MODULE_DEFS-driven code like modulePage() couldn't see).
   Supports both shapes MODULE_DEFS entries use: flat def.items (tuples
   [route,label,icon] or {route,label,icon,labelKey} objects) and grouped
   def.sections ({group,items:[...]}, rendered with a ssub-sep divider between
   groups) for sales/purchasing's richer sub-nav. */
function moduleNavItem(item, active){
  const isArr=Array.isArray(item);
  const route=isArr?item[0]:item.route;
  if(!route||!routeShownInCommands(route)) return '';
  const label=isArr?item[1]:item.label;
  const icon=isArr?item[2]:item.icon;
  const labelKey=isArr?item[3]:item.labelKey;
  const text=labelKey?t(labelKey):tf('route.'+route,label);
  return `<button class="ssub ${route===active?'on':''}" role="tab" aria-selected="${route===active}" onclick="navigate('${route}')">${ic(icon)}<span>${esc(text)}</span></button>`;
}
function myWorkCapabilityEnabled(item){
  if(!item||!item.capability) return true;
  return item.capability==='team'
    ?Boolean(MY_WORK_CONTEXT&&MY_WORK_CONTEXT.capabilities&&MY_WORK_CONTEXT.capabilities.team&&MY_WORK_CONTEXT.capabilities.team.available)
    :item.capability==='approvals'
      ?Boolean(MY_WORK_CONTEXT&&MY_WORK_CONTEXT.capabilities&&MY_WORK_CONTEXT.capabilities.team&&MY_WORK_CONTEXT.capabilities.team.available)
      :false;
}
function syncTeamCalendarEntry(){
  const button=$('#calendarBtn');
  if(!button) return false;
  const available=myWorkCapabilityEnabled({capability:'team'})&&routeShownInCommands('team-calendar');
  button.hidden=!available;
  button.innerHTML=ic('calendar');
  button.setAttribute('aria-label',t('myWork.nav.teamCalendar'));
  button.setAttribute('data-tip',t('myWork.nav.teamCalendar'));
  return available;
}
function moduleNav(moduleId, active){
  const def=MODULE_DEFS[moduleId];
  if(!def) return '';
  active=(def.alias&&def.alias[active])||SCREEN_ACTIVE_ALIASES[active]||active;
  const cls='sales-subnav'+(def.navClass?' '+def.navClass:'');
  const ariaLabel=def.ariaLabel?esc(def.ariaLabel):esc(t(def.labelKey));
  const visibleSections=def.sections
    ?.map(sec=>({ ...sec, items:sec.items.filter(it=>{
      const route=Array.isArray(it)?it[0]:it.route;
      return myWorkCapabilityEnabled(it)&&routeShownInCommands(route);
    }) }))
    .filter(sec=>sec.items.length);
  const body=visibleSections
    ? visibleSections.map((sec,gi)=>(gi?`<span class="ssub-sep" aria-hidden="true"></span>`:'')+sec.items.map(it=>moduleNavItem(it,active)).join('')).join('')
    : def.items.filter(it=>{
      const route=Array.isArray(it)?it[0]:it.route;
      return myWorkCapabilityEnabled(it)&&routeShownInCommands(route);
    }).map(it=>moduleNavItem(it,active)).join('');
  return `<div class="${cls}" role="tablist" aria-label="${ariaLabel}">${body}</div>`;
}
function modulePage(o){
  const def=MODULE_DEFS[o.module];
  const title=o.title||'';
  const crumb=o.crumb||[DB.company.name,{label:def?t(def.labelKey):o.module,route:def&&def.home},{cur:title}];
  const viewRoot=document.querySelector('#viewRoot');
  const scrollState=window.erpCaptureScrollState?.(viewRoot,o.route);
  const html=`<div class="content full"><section class="master" data-module-shell="${esc(o.module)}" data-module-route="${esc(String(o.route||''))}">
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
  if(scrollState&&viewRoot){
    queueMicrotask(()=>window.erpRestoreScrollState?.(viewRoot,scrollState));
  }
  return html;
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
let MODULE_NAV_RESIZE_FRAME=0;
function revealActiveModuleTab(root){
  const active=root&&root.querySelector('.sales-subnav [aria-selected="true"]');
  if(!active) return;
  const nav=active.closest('.sales-subnav');
  if(!nav) return;
  const reveal=()=>{
    if(!active.isConnected||!nav.isConnected) return;
    const navRect=nav.getBoundingClientRect();
    const activeRect=active.getBoundingClientRect();
    const leftDelta=activeRect.left-navRect.left;
    const rightDelta=activeRect.right-navRect.right;
    if(leftDelta<0){
      nav.scrollLeft=Math.max(0,nav.scrollLeft+leftDelta);
    }else if(rightDelta>0){
      nav.scrollLeft=Math.min(nav.scrollWidth-nav.clientWidth,nav.scrollLeft+rightDelta);
    }
  };
  reveal();
  requestAnimationFrame(reveal);
  setTimeout(reveal,0);
  setTimeout(reveal,120);
}
function moduleNavWheelDelta(event, nav){
  const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
  if(!delta) return 0;
  if(event.deltaMode===1) return delta*16;
  if(event.deltaMode===2) return delta*nav.clientWidth;
  return delta;
}
function bindModuleNavWheelScroll(root){
  root?.querySelectorAll('.sales-subnav').forEach(nav=>{
    if(nav.dataset.wheelScrollBound==='true') return;
    nav.dataset.wheelScrollBound='true';
    nav.addEventListener('wheel',event=>{
      if(event.defaultPrevented||event.ctrlKey) return;
      const maxScroll=nav.scrollWidth-nav.clientWidth;
      if(maxScroll<=0) return;
      const delta=moduleNavWheelDelta(event,nav);
      if(!delta) return;
      const next=Math.max(0,Math.min(maxScroll,nav.scrollLeft+delta));
      if(next===nav.scrollLeft) return;
      nav.scrollLeft=next;
      event.preventDefault();
    },{passive:false});
  });
}
window.addEventListener('resize',()=>{
  cancelAnimationFrame(MODULE_NAV_RESIZE_FRAME);
  MODULE_NAV_RESIZE_FRAME=requestAnimationFrame(()=>revealActiveModuleTab($('#viewRoot')));
});
function decorateScreen(root, route){
  if(!root || CURRENT_ROUTE!==route) return;
  const meta=getScreenMeta(route);
  root.dataset.screenRoute=route;
  root.dataset.screenModule=meta.module;
  root.dataset.screenMaturity=meta.maturity;

  if(root.querySelector('[data-access-denied]')){
    if(typeof applyI18n==='function') applyI18n(root);
    return;
  }
  ensureModuleShell(root,meta);
  if(typeof applyI18n==='function') applyI18n(root);
  bindModuleNavWheelScroll(root);
  revealActiveModuleTab(root);

  if(meta.maturity!=='preview') return;
  if(!root.querySelector('[data-preview-banner]')){
    const banner=document.createElement('div');
    const canonicalPreview=meta.dataSource==='canonical';
    banner.className='screen-preview-banner';
    banner.dataset.previewBanner='true';
    banner.setAttribute('role','status');
    banner.innerHTML=`${ic('warn')}<div><b>${esc(t(canonicalPreview?'preview.canonical.label':'preview.label'))}</b><span>${esc(t(canonicalPreview?'preview.canonical.desc':'preview.desc'))}</span></div>`;
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
    <div class="mark brand-logo-mark">${window.erpBrandLogo()}</div>
    <div class="brandtext"><b>Aria</b><small>${esc(DB.company.name.split(' ')[0])} Mfg.</small></div>
  </button>`;
  DB.nav.forEach(g=>{
    const items=g.items.filter(m=>{
      if(m.id==='mywork') return Boolean(MY_WORK_CONTEXT);
      if(isSelfServiceOnly()) return false;
      return moduleState(m.id).visible&&canReadModule(m.id);
    });
    if(!items.length) return;
    h+=`<div class="navgroup"><h6>${esc(tf('group.'+g.group, g.group))}</h6>`;
    items.forEach(m=>{
      const st=moduleState(m.id);
      const label=tf('nav.'+m.id, m.label);
      const maturity=moduleMaturity(m.id);
      const approvalBadge=approvalNavBadgeCount(m.route);
      h+=`<button class="nav ${st.active?'':'is-disabled'}" data-route="${m.route}" data-mod="${m.id}" data-tip="${esc(st.active?label:label+' · inactive')}" ${st.active?'':'aria-disabled="true"'}>
        ${ic(m.icon)}<span class="navlabel">${esc(label)}</span>
        ${approvalBadge?`<span class="badge nav-badge" data-nav-badge="${esc(m.route)}" aria-label="${approvalBadge} pending approvals">${approvalBadge>99?'99+':approvalBadge}</span>`:`<span class="badge nav-badge" data-nav-badge="${esc(m.route)}" aria-label="0 pending approvals" hidden>0</span>`}
        ${maturity!=='canonical'?`<span class="nav-maturity ${maturity}">${esc(t(maturity==='preview'?'preview.short':'preview.partial'))}</span>`:''}
      </button>`;
    });
    h+=`</div>`;
  });
  if(routeShownInCommands('settings')){
    h+=`<div class="sidebar-foot"><button class="nav" data-route="settings" data-mod="settings" data-tip="${esc(t('nav.settings'))}">${ic('gear')}<span class="navlabel">${esc(t('nav.settings'))}</span></button></div>`;
  }
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
  const calendarButton=$('#calendarBtn');
  if(calendarButton){
    const active=route==='team-calendar';
    calendarButton.classList.toggle('active',active);
    if(active) calendarButton.setAttribute('aria-current','page');
    else calendarButton.removeAttribute('aria-current');
  }
}

/* ---------- router ---------- */
const ROUTE_TITLE_ACRONYMS=new Set(['ap','ar','bi','bom','crm','gl','hr','mrp','ncr','po','qc','rfq','rma','sku']);
function readableRouteTitle(route){
  return String(route||'')
    .split('-')
    .filter(Boolean)
    .map(word=>ROUTE_TITLE_ACRONYMS.has(word.toLowerCase())?word.toUpperCase():word.charAt(0).toUpperCase()+word.slice(1))
    .join(' ');
}
function declaredModuleItems(def){
  if(!def) return [];
  return def.sections?def.sections.flatMap(section=>section.items||[]):(def.items||[]);
}
function screenRouteTitle(route){
  const translated=tf('route.'+route,'');
  if(translated) return translated;

  const meta=getScreenMeta(route);
  const def=MODULE_DEFS[meta.module];
  if(def&&def.home===route) return t(def.labelKey);

  const item=declaredModuleItems(def).find(candidate=>(Array.isArray(candidate)?candidate[0]:candidate.route)===route);
  if(item){
    const label=Array.isArray(item)?item[1]:item.label;
    const labelKey=Array.isArray(item)?item[3]:item.labelKey;
    return labelKey?t(labelKey):tf('route.'+route,label);
  }

  const sidebarItem=DB.nav.flatMap(group=>group.items).find(candidate=>candidate.route===route);
  if(sidebarItem) return tf('nav.'+sidebarItem.id,sidebarItem.label);
  if(route==='settings') return t('nav.settings');
  return readableRouteTitle(route);
}
window.screenRouteTitle=screenRouteTitle;

function screenLoadingHtml(route){
  const meta=getScreenMeta(route);
  const title=screenRouteTitle(route);
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
      title:screenRouteTitle(route),body:panel,
    });
  }
  return `<div class="content full"><section class="master screen-render-error">${panel}</section></div>`;
}
function finishScreenRender(root,route,sequence,output){
  if(sequence!==SCREEN_RENDER_SEQUENCE || CURRENT_ROUTE!==route) return false;
  delete root.dataset.screenRenderError;
  if(typeof output==='string') root.innerHTML=output;
  decorateScreen(root,route);
  root.scrollTop=0;
  return true;
}
function failScreenRender(root,route,sequence,error){
  if(sequence!==SCREEN_RENDER_SEQUENCE || CURRENT_ROUTE!==route) return false;
  root.dataset.screenRenderError=error&&error.message
    ?error.message:String(error||'Unknown rendering error');
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
    root.innerHTML=routeDeniedByPermission(route)?permissionBlockedPanel():moduleBlockedPanel(route);
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
  try{ history.replaceState({},'',`#${route}`); }catch{}
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
function syncThemeMeta(theme){
  const normalized=theme==='dark'?'dark':'light';
  const fallback=normalized==='dark'?'#000000':'#F5F5F7';
  let statusColor=fallback;
  try{
    const token=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if(token) statusColor=token;
  }catch{}
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  if(themeMeta){
    themeMeta.setAttribute('content',statusColor);
    themeMeta.removeAttribute('media');
  }
  const appleMeta=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if(appleMeta) appleMeta.setAttribute('content',normalized==='dark'?'black':'default');
  const colorSchemeMeta=document.querySelector('meta[name="color-scheme"]');
  if(colorSchemeMeta) colorSchemeMeta.setAttribute('content',normalized);
  document.documentElement.style.colorScheme=normalized;
}
function applyTheme(t){
  const theme=t==='dark'?'dark':'light';
  document.documentElement.setAttribute('data-theme',theme);
  syncThemeMeta(theme);
  try{localStorage.setItem('aria-theme',theme);}catch{}
  const moon=$('#themeBtn'); if(moon)moon.innerHTML=ic(theme==='dark'?'sun':'moon');
  const sw=$('#acctThemeSw'); if(sw)sw.classList.toggle('on',theme==='dark');
}
function toggleTheme(){ applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); }

/* ---------- sidebar collapse ---------- */
let navUserSet=false;
function setNavCollapsed(on, fromUser){
  $('#app').classList.toggle('nav-collapsed',on);
  const bb=$('#brandBtn'); if(bb) bb.setAttribute('data-tip', on?'Expand sidebar':'Collapse sidebar');
  if(fromUser){ navUserSet=true; try{localStorage.setItem('aria-nav',on?'1':'0');}catch{} }
}
/* default state: honour an explicit user choice; otherwise auto-collapse on tablet widths */
function autoNav(){
  if(navUserSet) return;
  let stored=null; try{stored=localStorage.getItem('aria-nav');}catch{}
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
    {label:'Company Onboarding', icon:'check', route:'company-onboarding'},
    {label:'Notifications center', icon:'bell', route:'notifications'},
  ]},
  {cat:'Create', items:[
    {label:'New Sales Order',labelKey:'qc.so',icon:'plus',route:'new-sales-order'},
    {label:'New Purchase Order',labelKey:'qc.po',icon:'plus',route:'new-purchase-order'},
    {label:'New Journal Entry',labelKey:'qc.je',icon:'plus',route:'new-journal-entry'},
    {label:'New Work Order',labelKey:'qc.wo',icon:'plus',route:'new-work-order'},
    {label:'New Opportunity',labelKey:'pal.newOpportunity',icon:'plus',route:'new-opportunity'},
    {label:'New Employee',labelKey:'pal.newEmployee',icon:'plus',route:'new-employee'},
    {label:'New Payment Voucher',labelKey:'qc.pv',icon:'plus',route:'new-payment-voucher'},
    {label:'New Stock Adjustment',labelKey:'qc.adj',icon:'plus',route:'new-stock-adjustment'},
    {label:'New Item',labelKey:'qc.item',icon:'plus',route:'new-item'},
  ]},
];
function paletteModuleCommands(){
  const knownRoutes=new Set(PAL_COMMANDS.flatMap(group=>(group.items||[])
    .map(item=>item.route).filter(Boolean)));
  const items=[];
  const addItem=(candidate)=>{
    const item=Array.isArray(candidate)?{
      route:candidate[0],label:candidate[1],icon:candidate[2],labelKey:candidate[3],
    }:{...candidate};
    if(!item.route||knownRoutes.has(item.route)) return;
    knownRoutes.add(item.route);
    items.push({...item,icon:item.icon||'arrowR'});
  };

  Object.values(MODULE_DEFS).forEach(def=>{
    if(def.home){
      addItem({
        route:def.home,
        labelKey:def.labelKey,
        icon:declaredModuleItems(def)[0]?.icon||'grid',
        preserveLabel:true,
      });
    }
    declaredModuleItems(def).forEach(addItem);
  });

  return items.length?[{cat:'Modules',items}]:[];
}
let palIndex=0, palFlat=[], paletteReturnFocus=null;
function openPalette(){
  const scrim=$('#scrim'),palette=$('#palette'),input=$('#palInput');
  if(!scrim||!palette||!input) return;
  const active=document.activeElement;
  paletteReturnFocus=active&&active!==document.body?active:$('#globalSearch');
  scrim.classList.add('show');
  palette.classList.add('show');
  palette.setAttribute('aria-hidden','false');
  document.body.classList.add('palette-open');
  input.value='';
  renderPalette('');
  setTimeout(()=>input.focus(),60);
}
function closePalette(){
  const scrim=$('#scrim'),palette=$('#palette');
  if(!scrim||!palette) return;
  scrim.classList.remove('show');
  palette.classList.remove('show');
  palette.setAttribute('aria-hidden','true');
  document.body.classList.remove('palette-open');
  const returnFocus=paletteReturnFocus;
  paletteReturnFocus=null;
  if(returnFocus&&document.contains(returnFocus)&&typeof returnFocus.focus==='function'){
    returnFocus.focus({preventScroll:true});
  }
}
function paletteItemLabel(item){
  if(item.labelKey) return t(item.labelKey);
  if(item.route&&!item.preserveLabel) return screenRouteTitle(item.route);
  return item.label;
}
function paletteDocumentCommands(){
  const items=[];
  (DB.salesOrders||[]).slice(0,6).forEach(order=>items.push({
    label:`${order.no} · ${order.cust||order.customer||order.customerName||'—'}`,
    icon:'file',route:'sales-order',params:{no:order.no},preserveLabel:true,
  }));
  (DB.paymentVouchers||[]).slice(0,4).forEach(voucher=>items.push({
    label:`${voucher.no} · ${voucher.supplierName||'—'}`,
    icon:'file',route:'payment-voucher',params:{voucherId:voucher.id},preserveLabel:true,
  }));
  return items.length?[{cat:'Open document',items}]:[];
}
function paletteSearchScore(item,q){
  if(!q) return 0;
  const label=paletteItemLabel(item).toLocaleLowerCase();
  const raw=String(item.label||'').toLocaleLowerCase();
  const route=String(item.route||'').toLocaleLowerCase();
  const haystack=`${label} ${raw} ${route}`.trim();
  const tokens=q.split(/\s+/).filter(Boolean);
  const tokenHits=tokens.filter(token=>haystack.includes(token)).length;
  if(!haystack.includes(q)&&tokenHits===0) return 0;
  let score=tokenHits===tokens.length?120:tokenHits*35;
  if(label===q||raw===q) score+=1000;
  else if(label.startsWith(q)||raw.startsWith(q)) score+=800;
  else if(label.includes(q)||raw.includes(q)) score+=560;
  else if(route.includes(q)) score+=320;
  return score;
}
function renderPalette(q){
  q=q.toLocaleLowerCase().trim(); const list=$('#palList'); palFlat=[]; let h='';
  const groups=[...PAL_COMMANDS,...paletteModuleCommands(),...paletteDocumentCommands()];
  const matches=[];
  groups.forEach((group,groupIndex)=>group.items.forEach((it,itemIndex)=>{
    if(it.route&&!routeShownInCommands(it.route)) return;
    const score=paletteSearchScore(it,q);
    if(q&&!score) return;
    matches.push({group,it,score,groupIndex,itemIndex});
  }));
  if(q) matches.sort((a,b)=>b.score-a.score||a.groupIndex-b.groupIndex||a.itemIndex-b.itemIndex);
  let lastCategory=null;
  matches.forEach(({group,it})=>{
    if(group.cat!==lastCategory){
      h+=`<div class="pcat">${esc(tf('pal.cat.'+group.cat, group.cat))}</div>`;
      lastCategory=group.cat;
    }
    const idx=palFlat.length,label=paletteItemLabel(it); palFlat.push(it);
    h+=`<div class="pitem" data-i="${idx}">${ic(it.icon||'arrowR')}<span>${esc(label)}</span>${it.meta?`<span class="meta kbd">${it.meta}</span>`:`<span class="meta">${it.route?'↵':t('pal.run')}</span>`}</div>`;
  });
  if(!palFlat.length) h=`<div class="pcat">${esc(t('pal.nomatch'))}</div><div class="pitem"><span style="color:var(--muted)">${esc(t('pal.hint'))}</span></div>`;
  list.innerHTML=h;
  if(typeof applyStaticI18n==='function') applyStaticI18n(list);
  palIndex=0; highlightPal();
  list.querySelectorAll('.pitem[data-i]').forEach(el=>{
    el.addEventListener('mouseenter',()=>{palIndex=+el.dataset.i;highlightPal();});
    el.addEventListener('click',()=>runPal(+el.dataset.i));
  });
}
function highlightPal(){ $$('#palList .pitem').forEach(el=>el.classList.toggle('active',+el.dataset.i===palIndex)); const a=$(`#palList .pitem[data-i="${palIndex}"]`); a&&a.scrollIntoView({block:'nearest'}); }
function runPal(i){ const it=palFlat[i]; if(!it) return; closePalette(); if(it.route)navigate(it.route,it.params); else if(it.action)it.action(); }

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
  return `<div class="nc-item ${n.unread?'unread':''}" ${n.route?`data-route="${esc(n.route)}"`:''} data-id="${esc(n.id)}">
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
    </div>
    <div class="nc-tabs">${tabs.map(t2=>`<button class="nc-tab ${t2[0]===notifFilter?'on':''}" data-tab="${t2[0]}">${esc(t2[1])}${t2[0]==='unread'&&unread?`<span class="nc-tabn">${unread}</span>`:''}</button>`).join('')}</div>
    <div class="nc-list">${body}</div>
    <div class="nc-foot"><button data-nc="viewall">${esc(t('notif.viewall'))}</button></div>`;
}
function wireNotifCenter(){
  const menu=$('#notifMenu');
  menu.querySelectorAll('.nc-tab').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();notifFilter=b.dataset.tab;refreshNotifs();}));
  menu.querySelectorAll('.nc-item').forEach(it=>it.addEventListener('click',async e=>{
    if(e.target.closest('[data-dismiss]')) return;
    try{
      await markNotificationRead(it.dataset.id);
      refreshNotifs();
      const destination=it.dataset.route
        ?notificationDestination({route:it.dataset.route}) : '';
      if(destination) navigate(destination);
    }catch(error){ toast((error&&error.message)||'Notification could not be updated.','danger'); }
  }));
  menu.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',async e=>{
    e.stopPropagation();
    try{ await dismissNotification(b.dataset.dismiss); refreshNotifs(); toast('Notification dismissed','info'); }
    catch(error){ toast((error&&error.message)||'Notification could not be dismissed.','danger'); }
  }));
  const ra=menu.querySelector('[data-nc="readall"]'); ra&&ra.addEventListener('click',async e=>{
    e.stopPropagation();
    try{ await markAllNotificationsRead(); refreshNotifs(); toast('All caught up','ok'); }
    catch(error){ toast((error&&error.message)||'Notifications could not be updated.','danger'); }
  });
  const va=menu.querySelector('[data-nc="viewall"]'); va&&va.addEventListener('click',e=>{e.stopPropagation();closeAllPops();navigate('notifications');});
}
function refreshNotifs(){ const m=$('#notifMenu'); if(m){ m.innerHTML=buildNotifCenter(); wireNotifCenter(); } updateBellBadge(); }
function buildQuickCreate(){
  const items=[[t('qc.so'),'bag','new-sales-order'],[t('qc.po'),'cart','new-purchase-order'],[t('qc.wo'),'factory','new-work-order'],[t('qc.je'),'book','new-journal-entry'],[t('qc.pv'),'coins','new-payment-voucher'],[t('qc.adj'),'adjust','new-stock-adjustment'],[t('qc.item'),'tag','new-item']];
  const allowed=items.filter(([, ,r])=>routeShownInCommands(r));
  if(!allowed.length) return '';
  return `<div class="menu-section"><div class="menu-head">${esc(t('quickCreate.title'))}</div>`+allowed.map(([l,i,r])=>`<button class="menu-item" data-route="${r}">${ic(i)}<span>${esc(l)}</span></button>`).join('')+`</div>`;
}
function buildCompanyMenu(){
  /* Canonical companies (ERP-System PGlite schema), not the unrelated Aria
     "Master Control" mock hierarchy in DB.masters — this switches the real
     active company scope via ErpSystemDemo.switchCompany(). */
  const allCompanies=(DB.erpSystem && DB.erpSystem.companies) || [];
  const allowedFns=new Set((DB.user&&DB.user.companyFns)||[]);
  const companies=isTenantControlAdmin()?allCompanies:allCompanies.filter(c=>allowedFns.has(c.company_fn||c.companyFn));
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
  return `<div class="menu-section">${head}${rows}</div>${isTenantControlAdmin()
    ?`<div class="menu-section"><button class="menu-item" data-co-action="master">${ic('grid')}<span>Master Control</span><span class="meta">${ic('arrowR')}</span></button></div>`
    :''}`;
}
/* (re)render the company switcher popover and wire its [data-co] buttons.
   Called on boot and again after a successful switch, since the button
   list itself changes (checkmark moves to the newly active company). */
function wireCompanyMenu(){
  $('#companyMenu').innerHTML=buildCompanyMenu();
  $('#companyMenu').querySelectorAll('[data-co]').forEach(b=>b.addEventListener('click',async()=>{
    closeAllPops();
    const fn=b.dataset.co;
    if(!window.ErpSystemDemo||!window.ErpSystemDemo.switchCompany){ toast('Company switch needs the PGlite adapter.','warn'); return; }
    if(!DB.erpSystem||!DB.erpSystem.scope||fn===DB.erpSystem.scope.companyFn) return;
    window.ErpSystemDemo.switchCompany(fn).then(async()=>{
      await loadModuleControl();
      await loadNotifications();
      await refreshApprovalBadges();
      $('#ctxCompany').innerHTML=`<b>${esc(DB.company.name)} ${ic('chevD')}</b><small>${esc(DB.company.branch)}</small>`;
      /* refresh company-dependent currency in the fiscal context too; the
         period itself is shared, but its legal-entity currency is not. */
      paintPeriodContext();
      wireCompanyMenu();
      refreshNotifs();
      if(CURRENT_ROUTE) navigate(CURRENT_ROUTE);
      toast('Switched to '+DB.company.name,'ok');
    }).catch(e=>toast('Switch failed: '+((e&&e.message)||e),'danger'));
  }));
  $('#companyMenu').querySelector('[data-co-action="master"]')?.addEventListener('click',()=>{ closeAllPops(); navigate('master-control'); });
}

/* ---------- fiscal period switcher + FY setup ---------- */
function localizedMonth(index){
  return new Intl.DateTimeFormat(getLocale(),{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,index,1)));
}
function fiscalPeriods(f){
  f=f||DB.fiscal; const out=[];
  for(let i=1;i<=f.periodCount;i++){
    const mi=(f.startMonth-1+(i-1))%12;
    const yr=f.startYear+Math.floor((f.startMonth-1+(i-1))/12);
    const code='P'+String(i).padStart(2,'0');
    const label=f.periodCount===4 ? ('Q'+i+' '+yr) : new Intl.DateTimeFormat(getLocale(),{year:'numeric',month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(yr,mi,1)));
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
  toast(t('fiscal.workingYearSet',{year:fy.fyLabel}),'ok');
}
function paintPeriodContext(){
  const cp=$('#ctxPeriod');
  if(cp) cp.innerHTML=`<b>${esc(DB.company.period)} ${ic('chevD')}</b><small>${esc(DB.company.periodLabel)} · ${esc(DB.company.currency)}</small>`;
}
function applyPeriod(i){
  const p=fiscalPeriods().find(x=>x.i===i); if(!p) return;
  DB.fiscal.selectedPeriod=i;
  DB.company.period=DB.fiscal.fyLabel+' · '+p.code;
  DB.company.periodLabel=p.label;
  try{ localStorage.setItem('aria-period', DB.fiscal.fyLabel+'|'+i); }catch{}
  paintPeriodContext();
}
function buildPeriodMenu(){
  const ps=fiscalPeriods();
  const tone=s=>s==='Open'?'ok':s==='Closed'?'neutral':'';
  const fyTone=s=>s==='Current'?'ok':s==='Future'?'':'neutral';
  const periodStatus=s=>s==='Open'?t('common.open'):s==='Closed'?t('fiscal.closed'):t('fiscal.future');
  const yearStatus=s=>s==='Current'?t('fiscal.current'):s==='Future'?t('fiscal.future'):t('fiscal.closed');
  // ── fiscal-year selector ──
  const years=DB.fiscalYears||[DB.fiscal];
  const fyRows=years.map(fy=>`<button class="menu-item" data-fy="${esc(fy.fyLabel)}">
    <span style="font-family:var(--mono);font-size:11px;color:var(--muted);min-width:30px;flex:none">${esc(fy.fyLabel.replace(/^FY/,''))}</span>
    <span>${esc(fy.fyLabel)}<small style="display:block;color:var(--muted);font-size:11px">${esc(t('fiscal.periodCount',{range:fyRangeLabel(fy),count:fy.periodCount}))}</small></span>
    <span class="meta">${fy===DB.fiscal?ic('check'):cap(yearStatus(fy.state||''),fyTone(fy.state))}</span></button>`).join('');
  const fySection=`<div class="menu-section"><div class="menu-head">${esc(t('fiscal.year'))}</div>${fyRows}
    <button class="menu-item" data-period-action="new">${ic('plus')||ic('add')||''}<span>${esc(t('fiscal.newYear'))}</span><span class="meta">${ic('arrowR')}</span></button></div>`;
  // ── period selector for the working FY ──
  const head=`<div class="menu-head">${esc(t('fiscal.periods',{year:DB.fiscal.fyLabel}))} · <span style="text-transform:none;letter-spacing:0;margin-left:4px">${esc(fyRangeLabel())}</span></div>`;
  const rows=ps.map(p=>`<button class="menu-item" data-period="${p.i}">
    <span style="font-family:var(--mono);font-size:11px;color:var(--muted);min-width:30px;flex:none">${esc(p.code)}</span>
    <span>${esc(p.label)}<small style="display:block;color:var(--muted);font-size:11px">${esc(p.status==='Open'?t('fiscal.currentPostingPeriod'):p.status==='Closed'?t('fiscal.closedForPosting'):t('fiscal.futurePeriod'))}</small></span>
    <span class="meta">${p.selected?ic('check'):cap(periodStatus(p.status),tone(p.status))}</span></button>`).join('');
  return `${fySection}<div class="menu-section">${head}<div style="max-height:264px;overflow:auto">${rows}</div></div>
    <div class="menu-section"><button class="menu-item" data-period-action="setup">${ic('gear')}<span>${esc(t('fiscal.setupYear',{year:DB.fiscal.fyLabel}))}</span><span class="meta">${ic('arrowR')}</span></button></div>`;
}
function wirePeriodMenu(){
  const m=$('#periodMenu'); if(!m) return;
  m.innerHTML=buildPeriodMenu();
  m.querySelectorAll('[data-fy]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); selectFy(b.dataset.fy); }));
  m.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); applyPeriod(+b.dataset.period); wirePeriodMenu(); closeAllPops(); toast(t('fiscal.workingPeriodSet',{period:DB.company.periodLabel}),'ok'); }));
  m.querySelector('[data-period-action="setup"]').addEventListener('click',e=>{ e.stopPropagation(); closeAllPops(); openFySetup(); });
  m.querySelector('[data-period-action="new"]').addEventListener('click',e=>{ e.stopPropagation(); closeAllPops(); openFySetup(null,true); });
}
function openFySetup(fyArg,isNew){
  const f=isNew
    ? { fyLabel:'FY'+((DB.fiscalYears[DB.fiscalYears.length-1]?.startYear||DB.fiscal.startYear)+1), startYear:(DB.fiscalYears[DB.fiscalYears.length-1]?.startYear||DB.fiscal.startYear)+1, startMonth:DB.fiscal.startMonth, scheme:DB.fiscal.scheme, periodCount:DB.fiscal.periodCount, currentPeriod:1, selectedPeriod:1, state:'Future' }
    : (fyArg||DB.fiscal);
  const schemes=[
    ['Monthly (12 periods)',t('fiscal.schemeMonthly')],
    ['Quarterly (4 periods)',t('fiscal.schemeQuarterly')],
    ['4-4-5 (12 periods)',t('fiscal.scheme445')],
  ];
  const monthOpts=Array.from({length:12},(_,i)=>`<option value="${i+1}" ${f.startMonth===i+1?'selected':''}>${esc(localizedMonth(i))}</option>`).join('');
  const schemeOpts=schemes.map(([value,label])=>`<option value="${esc(value)}" ${value===f.scheme?'selected':''}>${esc(label)}</option>`).join('');
  const periodOpts=fiscalPeriods(f).map(p=>`<option value="${p.i}" ${f.currentPeriod===p.i?'selected':''}>${p.code} · ${p.label}</option>`).join('');
  appModal({
    icon: 'calendar',
    title: isNew?t('fiscal.newYearTitle'):t('fiscal.setupYearTitle',{year:f.fyLabel}),
    body: `<div class="set-grid">
      <div class="fld"><span>${esc(t('fiscal.yearLabel'))}</span><input id="fyLabel" value="${esc(f.fyLabel)}"></div>
      <div class="fld"><span>${esc(t('fiscal.startYear'))}</span><input id="fyYear" type="number" value="${f.startYear}"></div>
      <div class="fld"><span>${esc(t('fiscal.firstMonth'))}</span><select id="fyMonth">${monthOpts}</select></div>
      <div class="fld"><span>${esc(t('fiscal.periodScheme'))}</span><select id="fyScheme">${schemeOpts}</select></div>
      <div class="fld" style="grid-column:1/-1"><span>${esc(t('fiscal.currentOpenPeriod'))}</span><select id="fyCurrent">${periodOpts}</select></div>
    </div>
    <p style="margin:12px 2px 0;font-size:11.5px;color:var(--muted)">${esc(t('fiscal.closedFutureHelp'))}</p>`,
    actions: `${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(isNew?t('fiscal.createYear'):t('fiscal.saveYear'),{icon:'save',cls:'primary',attrs:'data-save="1"'})}`,
  });
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
    toast(t(isNew?'fiscal.yearCreated':'fiscal.yearSaved',{year:target.fyLabel,count}),'ok');
  });
}

/* ---------- mobile tab bar ---------- */
function renderTabbar(){
  const tabs=isSelfServiceOnly()
    ?[['my-leave','calendar',t('myWork.nav.leave')],['my-claims','receipt',t('myWork.nav.claims')],['my-receipts','upload',t('myWork.nav.receipts')]]
    :[['dashboard','home',t('tab.home')],['sales-orders','bag',t('tab.sales')],['po-approval','flow',t('tab.approve')],['stock-on-hand','box',t('tab.stock')],['picking','warehouse',t('tab.pick')]];
  $('#tabbar').innerHTML=tabs.filter(([r])=>routeShownInCommands(r)).map(([r,i,l])=>`<button data-route="${r}">${ic(i)}${esc(l)}</button>`).join('')+`<button onclick="openPalette()">${ic('search')}${esc(t('tab.search'))}</button>`;
  $$('#tabbar button[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
}

/* ---------- boot ---------- */
async function boot(){
  if(typeof initI18n==='function') await initI18n();
  /* Demo authentication is local and can say “signed in” before its PGlite
     adapter has finished opening. Wait for the adapter before any signed-in
     shell readers (notifications, approvals, module projection) run, so a
     slow first boot cannot emit a false offline-fallback error. API mode owns
     its readiness through the server session request and must not wait here. */
  if((typeof window.erpDataMode!=='function'||window.erpDataMode()!=='api')
    &&window.ErpSystemDataReady&&typeof window.ErpSystemDataReady.then==='function'){
    await window.ErpSystemDataReady;
  }
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
  const apiMode=typeof window.erpDataMode==='function' && window.erpDataMode()==='api';
  const setupStatus=(apiMode && window.ErpPlatformWorkspace&&typeof window.ErpPlatformWorkspace.getSetupStatus==='function')
    ?await window.ErpPlatformWorkspace.getSetupStatus():null;
  if(apiMode&&setupStatus&&setupStatus.requiresPlatformBootstrap
    &&window.ErpPlatformWorkspace&&typeof window.ErpPlatformWorkspace.renderBootstrap==='function'){
    window.ErpPlatformWorkspace.renderBootstrap();
    return;
  }
  const platformSession=(apiMode
    && window.ErpPlatformWorkspace&&typeof window.ErpPlatformWorkspace.getSession==='function')
    ?await window.ErpPlatformWorkspace.getSession():null;
  if(platformSession&&!platformSession.simulation){
    await window.ErpPlatformWorkspace.renderWorkspace(platformSession);
    return;
  }
  const needsWizard = (ed && typeof ed.needsSetup==='function') ? await ed.needsSetup()
    : (typeof needsSetupWizard==='function' && needsSetupWizard());
  if(needsWizard){
    renderSetupWizard();
    return;
  }
  const signedIn = (ed && typeof ed.isSignedIn==='function') ? await ed.isSignedIn() : isDemoSignedIn();
  if(!signedIn){
    if(typeof window.erpDataMode==='function' && window.erpDataMode()==='api'
      && window.ErpPlatformWorkspace&&typeof window.ErpPlatformWorkspace.renderLogin==='function'){
      window.ErpPlatformWorkspace.renderLogin(setupStatus&&setupStatus.hasPlatformAdmin&&!setupStatus.hasTenantAdmin?'platform':'tenant');
      return;
    }
    renderLogin();
    return;
  }
  if(ed&&ed.activationRequired){
    renderEmployeeActivation();
    return;
  }
  const auth=$('#authView'); if(auth) auth.remove();
  const wiz=$('#setupWizardView'); if(wiz) wiz.remove();
  const apiUnavail=$('#apiUnavailableView'); if(apiUnavail) apiUnavail.remove();
  // theme
  let themePref='light'; try{themePref=localStorage.getItem('aria-theme')||'light';}catch{}
  applyTheme(themePref);
  // personal prefs: accent + density
  try{ const ac=localStorage.getItem('aria-accent'); if(ac){ document.documentElement.style.setProperty('--accent',ac); document.documentElement.style.setProperty('--accent-tint','color-mix(in srgb, '+ac+' 14%, transparent)'); } }catch{}
  try{ if(localStorage.getItem('aria-density')==='compact') document.documentElement.setAttribute('data-density','compact'); }catch{}
  try{ const ts=localStorage.getItem('aria-textsize'); if(ts && ts!=='1') document.documentElement.style.setProperty('--fs',ts); }catch{}
  await loadModuleControl();
  await loadMyWorkContext();
  if(isSelfServiceOnly()) DB.notifications=[];
  else try{ await loadNotifications(); }catch(error){ console.error('Notification load failed',error); }
  if(isSelfServiceOnly()) DB.hrApprovalPendingCount=0;
  else await refreshApprovalBadges();
  renderSidebar(); renderTabbar(); initTooltip();
  syncTeamCalendarEntry();
  // default/restore sidebar collapse state (+ sets the toggle icon)
  autoNav();
  addEventListener('resize',autoNav);
  // topbar context
  $('#ctxCompany').innerHTML=`<b>${esc(DB.company.name)} ${ic('chevD')}</b><small>${esc(DB.company.branch)}</small>`;
  const envEl=$('.env'); if(envEl) envEl.textContent=DB.company.env||envEl.textContent;
  syncAccountUi();
  syncImpersonationUi();
  if(window.ErpPlatformWorkspace&&typeof window.ErpPlatformWorkspace.syncSimulationBanner==='function'){
    await window.ErpPlatformWorkspace.syncSimulationBanner();
  }
  ensureUserSwitcherMenuItem();
  ensureEmployeeWorkspaceMenuItem();
  // restore persisted working period, then paint the fiscal-period switcher
  try{ const sp=localStorage.getItem('aria-period'); if(sp){ const parts=sp.split('|'); const fy=(DB.fiscalYears||[]).find(y=>y.fyLabel===parts[0]); if(fy){ DB.fiscal=fy; const i=+parts[1]; if(i>=1&&i<=fy.periodCount) fy.selectedPeriod=i; } } }catch{}
  applyPeriod(DB.fiscal.selectedPeriod);
  wirePeriodMenu();
  // popovers fill
  refreshNotifs();
  const quickCreateMenu=$('#qcMenu');
  const quickCreateButton=$('#qcBtn');
  quickCreateMenu.innerHTML=buildQuickCreate();
  const hasQuickCreateActions=!!quickCreateMenu.querySelector('[data-route]');
  quickCreateButton.hidden=!hasQuickCreateActions;
  quickCreateButton.setAttribute('aria-label',t('tip.qc'));
  quickCreateMenu.hidden=!hasQuickCreateActions;
  quickCreateMenu.setAttribute('aria-hidden',String(!hasQuickCreateActions));
  quickCreateMenu.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
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
  $('#paletteClose').addEventListener('click',closePalette);
  $('#bellBtn').addEventListener('click',e=>{e.stopPropagation();togglePop('notifMenu',$('#bellBtn'));});
  $('#calendarBtn').addEventListener('click',()=>navigate('team-calendar'));
  quickCreateButton.addEventListener('click',e=>{e.stopPropagation();if(!quickCreateButton.hidden)togglePop('qcMenu',quickCreateButton);});
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
  $$('#acctMenu .menu-item[data-acct]').forEach(b=>b.addEventListener('click',()=>{ const a=b.dataset.acct; if(a==='signout'){signOutDemo(); return;} else if(a==='employee-workspace'){closeAllPops();void openEmployeeWorkspaceSwitcher();return;} else if(a==='switch-user'){closeAllPops();openUserSwitcher();return;} else if(a==='prefs'){navigate('settings',{section:'set-appearance'});} else if(a==='profile'){navigate('settings');} else if(a==='activity'){navigate('my-activity');} else if(a==='shortcuts'){openShortcuts();} else if(a!=='theme'){toast(b.textContent.trim()+' — not in this build','info');} closeAllPops(); }));
  // initial route
  let start=(location.hash||'').replace('#','');
  if(!SCREENS[start]&&!DB.nav.flatMap(g=>g.items).some(m=>m.route===start)) start='dashboard';
  if(isSelfServiceOnly()&&ROUTE_MODULE[start]!=='mywork'&&start!=='settings') start='my-leave';
  // apply the persisted language across the whole shell
  if(typeof applyI18n==='function') applyI18n();
  const envAfterI18n=$('.env'); if(envAfterI18n) envAfterI18n.textContent=DB.company.env||envAfterI18n.textContent;
  // Keep the neutral boot screen in front until the first allowed route has
  // actually rendered. This prevents prototype defaults from flashing while
  // the canonical company/session payload is still loading.
  await navigate(start);
  setAuthShell(false);
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
  if(k==='c'||k==='C'){
    const quickCreate=$('#qcBtn');
    if(quickCreate&&!quickCreate.hidden){ e.preventDefault(); togglePop('qcMenu',quickCreate); }
    return;
  }
  if(k==='n'||k==='N'){ e.preventDefault(); togglePop('notifMenu',$('#bellBtn')); return; }
  if(k==='D'){ e.preventDefault(); toggleTheme(); return; }
}
/* Defer boot until the ERP-System demo adapter has loaded canonical data from
   PGlite (or applied its offline fallback) — see erp-system-data-adapter.js. */
document.addEventListener('DOMContentLoaded',()=>{
  syncDemoBootProgress();
  (window.ErpSystemDemoReady||Promise.resolve()).then(boot);
});
