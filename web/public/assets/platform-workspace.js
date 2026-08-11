/* Platform Superadmin workspace (TASK-187). This file deliberately keeps the
 * platform realm outside the tenant data adapter: it talks only to /api/platform
 * and never creates, reads or writes erp_session/client tenant state. */
(function platformWorkspace(){
  if(typeof window.erpDataMode==='function'&&window.erpDataMode()!=='api') return;

  var API_BASE=(window.__ERP_API_BASE__||'/api').replace(/\/$/,'');
  var PLATFORM_BASE=API_BASE+'/platform';
  var cachedSession=null;
  var state={session:null,tenants:[],masterFn:'',companyFn:'',masterModules:[],companyModules:[],targets:[]};

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }
  function cookieValue(name){
    var prefix=name+'=';
    return (document.cookie||'').split(';').map(function(value){ return value.trim(); })
      .filter(function(value){ return value.indexOf(prefix)===0; })
      .map(function(value){ return decodeURIComponent(value.slice(prefix.length)); })[0]||'';
  }
  function errorFrom(response,body){
    var detail=body&&body.error;
    var error=new Error((detail&&detail.message)||('Platform request failed (HTTP '+response.status+').'));
    error.code=(detail&&detail.code)||'platform_http_'+response.status;
    error.status=response.status;
    return error;
  }
  async function request(path,options){
    options=options||{};
    var method=(options.method||'GET').toUpperCase();
    var headers=Object.assign({},options.headers||{});
    if(options.body!=null&&!headers['Content-Type']) headers['Content-Type']='application/json';
    if(!['GET','HEAD','OPTIONS'].includes(method)&&!headers['X-Platform-CSRF-Token']){
      var csrf=cookieValue('erp_platform_csrf');
      if(csrf) headers['X-Platform-CSRF-Token']=csrf;
    }
    var response=await fetch(PLATFORM_BASE+'/'+String(path||'').replace(/^\/+/,''),{
      method:method,credentials:'same-origin',cache:'no-store',headers:headers,
      body:options.body==null?undefined:JSON.stringify(options.body),
    });
    var body=null; try{ body=await response.json(); }catch{}
    if(!response.ok) throw errorFrom(response,body);
    return body&&Object.prototype.hasOwnProperty.call(body,'data')?body.data:body;
  }
  async function getSession(){
    try{
      var response=await fetch(PLATFORM_BASE+'/session',{method:'GET',credentials:'same-origin',cache:'no-store'});
      if(!response.ok){ cachedSession=null; return null; }
      var body=await response.json();
      cachedSession=body&&body.data||null;
      state.session=cachedSession;
      return cachedSession;
    }catch{ cachedSession=null; return null; }
  }
  function authView(){
    var view=document.getElementById('authView');
    if(!view){
      view=document.createElement('main');
      view.id='authView'; view.className='auth-view';
      document.body.insertBefore(view,document.getElementById('app'));
    }
    return view;
  }
  function authShell(on){
    if(typeof window.setAuthShell==='function') window.setAuthShell(on);
    else {
      document.body.classList.toggle('auth-locked',!!on);
      var app=document.getElementById('app'); if(app) app.setAttribute('aria-hidden',on?'true':'false');
    }
  }
  function setError(message){
    var target=document.getElementById('platformWorkspaceError')||document.getElementById('loginError');
    if(target) target.textContent=message||'';
  }
  function renderLogin(){
    authShell(true);
    var view=authView();
    view.setAttribute('aria-label','Sign in');
    view.innerHTML=`<section class="auth-panel">
      <div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>Secure workspace</small></span></div>
      <div class="auth-copy"><h1>Sign in</h1><p>Choose the tenant workspace or the independent Platform Superadmin realm.</p></div>
      <div class="platform-realm-tabs" role="tablist" aria-label="Sign-in realm">
        <button type="button" class="btn soft active" data-realm="tenant" role="tab" aria-selected="true">Tenant workspace</button>
        <button type="button" class="btn soft" data-realm="platform" role="tab" aria-selected="false">Platform Superadmin</button>
      </div>
      <form class="auth-form" id="platformAwareLoginForm" autocomplete="off">
        <div id="tenantCredentials">
          <div class="fld"><span>Organization code</span><input id="tenantOrganizationCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. ACME"></div>
          <div class="fld"><span>Username</span><input id="tenantUsername" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. admin"></div>
          <label class="auth-remember"><input id="tenantRememberDevice" type="checkbox"><span>Remember this device (up to 30 days)</span></label>
        </div>
        <div id="platformCredentials" hidden>
          <div class="fld"><span>Platform principal key</span><input id="platformPrincipalKey" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. platform-admin"></div>
          <p class="auth-help">Platform sessions are limited to one hour. Remember Me is not available.</p>
        </div>
        <div class="fld"><span>Password</span><input id="realmPassword" type="password" autocomplete="current-password"></div>
        <div class="auth-error" id="loginError" role="alert"></div>
        <button class="btn primary lg" type="submit">Sign in</button>
      </form>
      <div class="auth-foot"><span class="cap ok"><span class="dot"></span>Production</span><span>Credentials and sessions are isolated by realm.</span></div>
    </section>`;
    var realm='tenant';
    function toggle(next){
      realm=next;
      view.querySelector('#tenantCredentials').hidden=realm!=='tenant';
      view.querySelector('#platformCredentials').hidden=realm!=='platform';
      view.querySelectorAll('[data-realm]').forEach(function(button){
        var active=button.dataset.realm===realm;
        button.classList.toggle('active',active); button.setAttribute('aria-selected',String(active));
      });
      setTimeout(function(){
        var field=view.querySelector(realm==='platform'?'#platformPrincipalKey':'#tenantOrganizationCode');
        if(field) field.focus();
      },0);
    }
    view.querySelectorAll('[data-realm]').forEach(function(button){ button.addEventListener('click',function(){ toggle(button.dataset.realm); }); });
    view.querySelector('#platformAwareLoginForm').addEventListener('submit',async function(event){
      event.preventDefault(); setError('');
      var password=view.querySelector('#realmPassword').value;
      var submit=view.querySelector('button[type="submit"]');
      if(!password){ setError('Password is required.'); return; }
      submit.disabled=true;
      try{
        if(realm==='platform'){
          var principalKey=view.querySelector('#platformPrincipalKey').value.trim();
          if(!principalKey) throw new Error('Platform principal key is required.');
          await request('login',{method:'POST',body:{principalKey:principalKey,password:password,rememberDevice:false}});
        }else{
          var organizationCode=view.querySelector('#tenantOrganizationCode').value.trim();
          var username=view.querySelector('#tenantUsername').value.trim();
          if(!organizationCode||!username) throw new Error('Organization code and username are required.');
          if(!window.ErpSystemDemo||typeof window.ErpSystemDemo.login!=='function') throw new Error('Tenant login is unavailable.');
          await window.ErpSystemDemo.login(organizationCode,username,password,{rememberDevice:!!view.querySelector('#tenantRememberDevice').checked});
        }
        location.reload();
      }catch(error){ setError(error&&error.message||'Sign in failed.'); submit.disabled=false; }
    });
    toggle('tenant');
  }
  function currentMaster(){ return state.tenants.find(function(item){ return item.masterFn===state.masterFn; })||null; }
  function currentCompany(){
    var master=currentMaster();
    return master&&(master.companies||[]).find(function(item){ return item.companyFn===state.companyFn; })||null;
  }
  function options(items,value,key,label){
    return (items||[]).map(function(item){ return `<option value="${esc(item[key])}" ${item[key]===value?'selected':''}>${esc(item[label])} (${esc(item[key])})</option>`; }).join('');
  }
  async function loadDetails(){
    if(!state.masterFn) return;
    var master=currentMaster();
    if(master&&!(master.companies||[]).some(function(item){ return item.companyFn===state.companyFn; })) state.companyFn=(master.companies||[])[0]?.companyFn||'';
    var all=await Promise.all([
      request('masters/'+encodeURIComponent(state.masterFn)+'/modules'),
      state.companyFn?request('masters/'+encodeURIComponent(state.masterFn)+'/companies/'+encodeURIComponent(state.companyFn)+'/modules'):Promise.resolve([]),
      state.companyFn?request('simulation-targets?masterFn='+encodeURIComponent(state.masterFn)+'&companyFn='+encodeURIComponent(state.companyFn)):Promise.resolve([]),
    ]);
    state.masterModules=all[0]||[]; state.companyModules=all[1]||[]; state.targets=all[2]||[];
  }
  function switchMarkup(){
    return `<div class="platform-workspace-controls">
      <label class="fld"><span>Master</span><select id="platformMasterSelect">${options(state.tenants,state.masterFn,'masterFn','name')}</select></label>
      <label class="fld"><span>Company</span><select id="platformCompanySelect">${options((currentMaster()||{}).companies||[],state.companyFn,'companyFn','name')}</select></label>
    </div>`;
  }
  function modulesMarkup(){
    var allocation=new Map((state.companyModules||[]).map(function(item){ return [item.moduleKey,item]; }));
    var masterRows=(state.masterModules||[]).map(function(item){
      return `<tr data-module="${esc(item.moduleKey)}" data-version="${Number(item.version)||0}"><td><b>${esc(item.name)}</b><small>${esc((item.dependencies||[]).join(', ')||'No dependencies')}</small></td><td><input class="platform-master-enabled" type="checkbox" ${item.masterEnabled?'checked':''}></td><td><input class="platform-master-default" type="checkbox" ${item.defaultCompanyAllocated?'checked':''}></td><td><button type="button" class="btn soft platform-save-master">Save</button></td></tr>`;
    }).join('');
    var companyRows=(state.masterModules||[]).map(function(item){
      var row=allocation.get(item.moduleKey)||{};
      return `<tr data-module="${esc(item.moduleKey)}" data-version="${Number(row.version)||0}"><td><b>${esc(item.name)}</b></td><td>${item.masterEnabled?'Enabled':'Disabled'}</td><td><input class="platform-company-allocated" type="checkbox" ${row.companyAllocated?'checked':''}></td><td>${row.effectiveEnabled?'Enabled':'Disabled'}</td><td><button type="button" class="btn soft platform-save-company">Save</button></td></tr>`;
    }).join('');
    return `<div class="platform-workspace-grid">
      <section><h2>Master commercial entitlements</h2><p>Master state masks Company allocation; allocation is preserved while a Master module is disabled.</p><div class="platform-table-wrap"><table><thead><tr><th>Module</th><th>Enabled</th><th>Default new Company allocation</th><th></th></tr></thead><tbody>${masterRows}</tbody></table></div></section>
      <section><h2>Company allocation</h2><p>${esc((currentCompany()||{}).name||state.companyFn)}. Effective access requires Master enabled and Company allocated.</p><div class="platform-table-wrap"><table><thead><tr><th>Module</th><th>Master</th><th>Allocated</th><th>Effective</th><th></th></tr></thead><tbody>${companyRows}</tbody></table></div></section>
    </div>`;
  }
  function simulationMarkup(){
    return `<section class="platform-simulation-panel"><h2>Tenant user simulation</h2><p>Enter one active user's exact tenant authority for up to 15 minutes. Platform permissions are never added to the target user.</p>
      <div class="platform-simulation-controls"><label class="fld"><span>Active tenant user</span><select id="platformSimulationTarget">${options(state.targets,'','userId','username')}</select></label><button class="btn primary" id="platformStartSimulation" type="button">Enter tenant simulation</button></div></section>`;
  }
  async function renderWorkspace(session){
    state.session=session||await getSession();
    authShell(true);
    var view=authView();
    view.classList.add('platform-workspace-view');
    view.setAttribute('aria-label','Platform Superadmin workspace');
    view.innerHTML=`<section class="auth-panel" style="max-width:1180px;width:min(1180px,calc(100vw - 32px));margin:20px auto;"><div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>Platform Superadmin workspace</small></span><button type="button" class="btn soft" id="platformLogoutBtn">Sign out</button></div><div class="auth-copy"><h1>Loading platform workspace…</h1></div></section>`;
    try{
      state.tenants=await request('entitlements');
      state.masterFn=state.masterFn&&state.tenants.some(function(item){ return item.masterFn===state.masterFn; })?state.masterFn:(state.tenants[0]||{}).masterFn||'';
      await loadDetails();
      view.innerHTML=`<section class="auth-panel" style="max-width:1180px;width:min(1180px,calc(100vw - 32px));margin:20px auto;"><div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>Platform Superadmin workspace · ${esc(state.session&&state.session.displayName||'')}</small></span><button type="button" class="btn soft" id="platformLogoutBtn">Sign out</button></div><div class="auth-copy"><h1>Module entitlement control</h1><p>Immediate platform-only controls with optimistic version checks and audit evidence.</p></div>${switchMarkup()}<div class="auth-error" id="platformWorkspaceError" role="alert"></div>${modulesMarkup()}${simulationMarkup()}</section>`;
      wireWorkspace(view);
    }catch(error){ view.querySelector('.auth-copy').innerHTML=`<h1>Platform workspace unavailable</h1><p>${esc(error&&error.message||'Unable to load platform entitlement data.')}</p>`; }
  }
  function wireWorkspace(view){
    view.querySelector('#platformLogoutBtn').addEventListener('click',async function(){ try{ await request('logout',{method:'POST',body:{}}); }finally{ cachedSession=null; location.reload(); } });
    view.querySelector('#platformMasterSelect').addEventListener('change',async function(event){ state.masterFn=event.target.value; state.companyFn=''; await renderWorkspace(state.session); });
    view.querySelector('#platformCompanySelect').addEventListener('change',async function(event){ state.companyFn=event.target.value; await renderWorkspace(state.session); });
    view.querySelectorAll('.platform-save-master').forEach(function(button){ button.addEventListener('click',async function(){
      var row=button.closest('tr'); button.disabled=true; setError('');
      try{ await request('masters/'+encodeURIComponent(state.masterFn)+'/modules/'+encodeURIComponent(row.dataset.module),{method:'PATCH',body:{enabled:row.querySelector('.platform-master-enabled').checked,defaultCompanyAllocated:row.querySelector('.platform-master-default').checked,expectedVersion:Number(row.dataset.version)}}); await renderWorkspace(state.session); }
      catch(error){ setError(error&&error.message||'Module update failed.'); button.disabled=false; }
    }); });
    view.querySelectorAll('.platform-save-company').forEach(function(button){ button.addEventListener('click',async function(){
      var row=button.closest('tr'); button.disabled=true; setError('');
      try{ await request('masters/'+encodeURIComponent(state.masterFn)+'/companies/'+encodeURIComponent(state.companyFn)+'/modules/'+encodeURIComponent(row.dataset.module),{method:'PATCH',body:{allocated:row.querySelector('.platform-company-allocated').checked,expectedVersion:Number(row.dataset.version)}}); await renderWorkspace(state.session); }
      catch(error){ setError(error&&error.message||'Company allocation update failed.'); button.disabled=false; }
    }); });
    view.querySelector('#platformStartSimulation').addEventListener('click',async function(event){
      var target=Number(view.querySelector('#platformSimulationTarget').value); var button=event.currentTarget;
      if(!Number.isSafeInteger(target)||target<=0){ setError('Select an active tenant user.'); return; }
      button.disabled=true; setError('');
      try{ await request('simulations',{method:'POST',body:{masterFn:state.masterFn,companyFn:state.companyFn,targetUserId:target}}); location.reload(); }
      catch(error){ setError(error&&error.message||'Unable to enter tenant simulation.'); button.disabled=false; }
    });
  }
  async function returnFromSimulation(){ await request('simulations/actions/return',{method:'POST',body:{}}); cachedSession=null; location.reload(); }
  async function syncSimulationBanner(){
    var session=await getSession();
    if(!session||!session.simulation) return;
    var banner=document.getElementById('impersonationBanner');
    if(!banner) return;
    var target=session.simulation.target||{};
    banner.hidden=false;
    banner.innerHTML=`<div class="impersonation-copy"><span><b>Platform simulation active</b><small>Viewing as ${esc(target.fullName||target.username||'tenant user')} · exact tenant permissions only · expires ${esc(new Date(session.simulation.expiresAt).toLocaleTimeString())}</small></span></div><button class="impersonation-return" id="returnToPlatformWorkspaceBtn" type="button">Return to Platform workspace</button>`;
    banner.querySelector('#returnToPlatformWorkspaceBtn').addEventListener('click',async function(event){
      event.currentTarget.disabled=true;
      try{ await returnFromSimulation(); }catch(error){ event.currentTarget.disabled=false; setError(error&&error.message||'Unable to return to the Platform workspace.'); }
    });
  }
  // A tenant-shell sign-out while simulated must end the platform session, not
  // leave the browser silently inside the target user's workspace.
  document.addEventListener('click',function(event){
    var signout=event.target&&event.target.closest&&event.target.closest('[data-acct="signout"]');
    if(!signout||!cachedSession||!cachedSession.simulation) return;
    event.preventDefault(); event.stopImmediatePropagation();
    request('logout',{method:'POST',body:{}}).finally(function(){ cachedSession=null; location.reload(); });
  },true);

  window.ErpPlatformWorkspace={getSession:getSession,renderLogin:renderLogin,renderWorkspace:renderWorkspace,syncSimulationBanner:syncSimulationBanner,returnFromSimulation:returnFromSimulation};
})();
