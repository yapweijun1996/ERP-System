/* Platform Superadmin workspace (TASK-187). This file deliberately keeps the
 * platform realm outside the tenant data adapter: it talks only to /api/platform
 * and never creates, reads or writes erp_session/client tenant state. */
(function platformWorkspace(){
  if(typeof window.erpDataMode==='function'&&window.erpDataMode()!=='api') return;

  var API_BASE=(window.__ERP_API_BASE__||'/api').replace(/\/$/,'');
  var PLATFORM_BASE=API_BASE+'/platform';
  var cachedSession=null;
  var state={session:null,tenants:[],catalog:[],masterFn:'',companyFn:'',masterModules:[],companyModules:[],targets:[]};

  /* The platform workspace has dense entitlement tables. Keep their horizontal
   * scroll local to the table wrapper so the shared login shell never makes a
   * 375px viewport horizontally scrollable. This is intentionally scoped here
   * instead of the tenant shell's global CSS. */
  function ensureResponsiveStyles(){
    if(document.getElementById('platformWorkspaceResponsiveStyles')) return;
    var style=document.createElement('style');
    style.id='platformWorkspaceResponsiveStyles';
    style.textContent='.platform-workspace-view{overflow-x:hidden}.platform-workspace-view .auth-panel{box-sizing:border-box}.platform-workspace-controls,.platform-simulation-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.platform-workspace-grid{display:grid;gap:16px}.platform-table-wrap{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.platform-table-wrap table{min-width:620px}.platform-simulation-controls .btn{align-self:end}@media(max-width:600px){.platform-workspace-view .auth-panel{width:calc(100vw - 24px)!important;margin:12px auto!important}.platform-workspace-view .auth-brand{flex-wrap:wrap;gap:10px}.platform-workspace-controls,.platform-simulation-controls{grid-template-columns:minmax(0,1fr)}.platform-simulation-controls .btn{justify-self:stretch}.platform-table-wrap{border-radius:10px}}';
    document.head.appendChild(style);
  }

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
  async function getSetupStatus(){
    try{
      var response=await fetch(API_BASE+'/setup/status',{method:'GET',credentials:'same-origin',cache:'no-store'});
      if(!response.ok) return null;
      return await response.json();
    }catch{return null;}
  }
  function renderBootstrap(){
    authShell(true);
    var view=authView();
    view.className='platform-workspace-view';
    view.setAttribute('aria-label','Create Platform Superadmin');
    view.innerHTML=`<section class="auth-panel" style="max-width:620px;width:min(620px,calc(100vw - 24px));margin:20px auto;">
      <div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>First-run Platform setup</small></span></div>
      <div class="auth-copy"><h1>Create Platform Superadmin</h1><p>This one-time registration is available only while the production database is empty. The account is independent from tenant users.</p></div>
      <form class="auth-form" id="platformBootstrapForm" autocomplete="off">
        <div class="fld"><span>Platform principal key</span><input id="bootstrapPrincipalKey" autocomplete="username" autocapitalize="none" required placeholder="e.g. platform-admin"></div>
        <div class="fld"><span>Display name</span><input id="bootstrapDisplayName" autocomplete="name" required></div>
        <div class="fld"><span>Email</span><input id="bootstrapEmail" type="email" autocomplete="email" required></div>
        <div class="fld"><span>Password (12+ characters)</span><input id="bootstrapPassword" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="fld"><span>Confirm password</span><input id="bootstrapPasswordConfirm" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="auth-error" id="platformBootstrapError" role="alert"></div>
        <button class="btn primary lg" type="submit">Create Platform Superadmin</button>
      </form>
      <div class="auth-foot"><span class="cap ok"><span class="dot"></span>Empty database only</span><span>After creation, you will enter the Platform workspace.</span></div>
    </section>`;
    view.querySelector('#platformBootstrapForm').addEventListener('submit',async function(event){
      event.preventDefault();
      var error=view.querySelector('#platformBootstrapError');
      var submit=view.querySelector('button[type="submit"]');
      error.textContent='';
      var password=view.querySelector('#bootstrapPassword').value;
      if(password!==view.querySelector('#bootstrapPasswordConfirm').value){ error.textContent='Passwords do not match.'; return; }
      submit.disabled=true;
      try{
        var response=await fetch(API_BASE+'/setup/platform-superadmin/actions/complete',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({
          principalKey:view.querySelector('#bootstrapPrincipalKey').value.trim(),
          displayName:view.querySelector('#bootstrapDisplayName').value.trim(),
          email:view.querySelector('#bootstrapEmail').value.trim(),
          password:password,
        })});
        var body=null; try{body=await response.json();}catch{}
        if(!response.ok){ var detail=body&&body.error; throw new Error((detail&&detail.message)||('Platform bootstrap failed (HTTP '+response.status+').')); }
        location.reload();
      }catch(errorValue){ error.textContent=errorValue&&errorValue.message||'Platform bootstrap failed.'; submit.disabled=false; }
    });
  }
  function renderLogin(initialRealm){
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
    var realm=initialRealm==='platform'?'platform':'tenant';
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
    toggle(realm);
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
  function provisioningInput(id,label,type,autocomplete){
    return `<div class="fld"><span>${label}</span><input id="${id}" type="${type||'text'}" autocomplete="${autocomplete||'off'}" required></div>`;
  }
  function masterProvisioningMarkup(){
    var rows=(state.catalog||[]).map(function(item){
      var enabled=item.key!=='expenses_tax';
      return `<label class="cap" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-provision-module="${esc(item.key)}" ${enabled?'checked':''}><span>${esc(item.name)}</span></label>`;
    }).join('');
    return `<section class="platform-provision-panel"><h2>Create Master</h2><p>Define the tenant group first. Commercial modules are independent from baseline Home, My Work, Admin, Settings and Account services.</p><form id="platformCreateMasterForm" class="auth-form">
      ${provisioningInput('provisionMasterName','Master name')}${provisioningInput('provisionMasterLoginCode','Master login code')}
      <div class="platform-provision-module-grid">${rows}</div><div class="auth-error" id="platformCreateMasterError" role="alert"></div><button class="btn primary" type="submit">Create Master</button>
    </form></section>`;
  }
  function companyProvisioningMarkup(master){
    var needsMasterAdmin=!(master&&master.hasMasterAdmin);
    return `<section class="platform-provision-panel"><h2>Create Company</h2><p>Company allocation is copied from the Master defaults. Tenant onboarding cannot choose commercial modules.</p><form id="platformCreateCompanyForm" class="auth-form">
      ${provisioningInput('provisionCompanyName','Company name')}<div class="fld"><span>Country</span><select id="provisionCompanyCountry"><option value="SG">Singapore (SG)</option><option value="MY">Malaysia (MY)</option></select></div>
      ${needsMasterAdmin?`<h3>Master Admin (first Company only)</h3>${provisioningInput('provisionMasterAdminName','Master Admin name')}${provisioningInput('provisionMasterAdminUsername','Master Admin username')}${provisioningInput('provisionMasterAdminEmail','Master Admin email','email')}${provisioningInput('provisionMasterAdminPassword','Master Admin password','password','new-password')}`:''}
      <h3>Company Owner</h3>${provisioningInput('provisionCompanyOwnerName','Company Owner name')}${provisioningInput('provisionCompanyOwnerUsername','Company Owner username')}${provisioningInput('provisionCompanyOwnerEmail','Company Owner email','email')}${provisioningInput('provisionCompanyOwnerPassword','Company Owner password','password','new-password')}
      <div class="auth-error" id="platformCreateCompanyError" role="alert"></div><button class="btn primary" type="submit">Create Company</button>
    </form></section>`;
  }
  function provisioningMarkup(){
    if(!state.masterFn) return masterProvisioningMarkup();
    return companyProvisioningMarkup(currentMaster());
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
    ensureResponsiveStyles();
    state.session=session||await getSession();
    authShell(true);
    var view=authView();
    view.classList.add('platform-workspace-view');
    view.setAttribute('aria-label','Platform Superadmin workspace');
    view.innerHTML=`<section class="auth-panel" style="max-width:1180px;width:min(1180px,calc(100vw - 32px));margin:20px auto;"><div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>Platform Superadmin workspace</small></span><button type="button" class="btn soft" id="platformLogoutBtn">Sign out</button></div><div class="auth-copy"><h1>Loading platform workspace…</h1></div></section>`;
    try{
      state.tenants=await request('entitlements');
      state.catalog=await request('module-catalog');
      state.masterFn=state.masterFn&&state.tenants.some(function(item){ return item.masterFn===state.masterFn; })?state.masterFn:(state.tenants[0]||{}).masterFn||'';
      await loadDetails();
      var hasCompany=Boolean(state.companyFn);
      view.innerHTML=`<section class="auth-panel" style="max-width:1180px;width:min(1180px,calc(100vw - 32px));margin:20px auto;"><div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>Platform Superadmin workspace · ${esc(state.session&&state.session.displayName||'')}</small></span><button type="button" class="btn soft" id="platformLogoutBtn">Sign out</button></div><div class="auth-copy"><h1>${state.masterFn?(hasCompany?'Platform tenant control':'Finish tenant provisioning'):'Start tenant provisioning'}</h1><p>${state.masterFn?'Platform-only Master and Company controls with audited tenant identity provisioning.':'Create the first Master, configure its commercial defaults, then create its first Company and administrators.'}</p></div>${state.masterFn?switchMarkup():''}<div class="auth-error" id="platformWorkspaceError" role="alert"></div><div class="platform-workspace-grid">${provisioningMarkup()}</div>${hasCompany?modulesMarkup()+simulationMarkup():''}</section>`;
      wireWorkspace(view);
    }catch(error){ view.querySelector('.auth-copy').innerHTML=`<h1>Platform workspace unavailable</h1><p>${esc(error&&error.message||'Unable to load platform entitlement data.')}</p>`; }
  }
  function wireWorkspace(view){
    view.querySelector('#platformLogoutBtn').addEventListener('click',async function(){ try{ await request('logout',{method:'POST',body:{}}); }finally{ cachedSession=null; location.reload(); } });
    var masterSelect=view.querySelector('#platformMasterSelect');
    if(masterSelect) masterSelect.addEventListener('change',async function(event){ state.masterFn=event.target.value; state.companyFn=''; await renderWorkspace(state.session); });
    var companySelect=view.querySelector('#platformCompanySelect');
    if(companySelect) companySelect.addEventListener('change',async function(event){ state.companyFn=event.target.value; await renderWorkspace(state.session); });
    var createMaster=view.querySelector('#platformCreateMasterForm');
    if(createMaster) createMaster.addEventListener('submit',async function(event){
      event.preventDefault(); var error=view.querySelector('#platformCreateMasterError'); var button=createMaster.querySelector('button[type="submit"]'); error.textContent=''; button.disabled=true;
      try{
        var modules=Array.from(createMaster.querySelectorAll('[data-provision-module]')).map(function(input){ return {moduleKey:input.dataset.provisionModule,enabled:input.checked,defaultCompanyAllocated:input.checked}; });
        await request('masters',{method:'POST',headers:{'Idempotency-Key':'master-'+(crypto.randomUUID?crypto.randomUUID():Date.now())},body:{name:createMaster.querySelector('#provisionMasterName').value.trim(),loginCode:createMaster.querySelector('#provisionMasterLoginCode').value.trim(),modules:modules}});
        state.masterFn=''; state.companyFn=''; await renderWorkspace(state.session);
      }catch(errorValue){ error.textContent=errorValue&&errorValue.message||'Master creation failed.'; button.disabled=false; }
    });
    var createCompany=view.querySelector('#platformCreateCompanyForm');
    if(createCompany) createCompany.addEventListener('submit',async function(event){
      event.preventDefault(); var error=view.querySelector('#platformCreateCompanyError'); var button=createCompany.querySelector('button[type="submit"]'); error.textContent=''; button.disabled=true;
      try{
        var body={name:createCompany.querySelector('#provisionCompanyName').value.trim(),country:createCompany.querySelector('#provisionCompanyCountry').value,companyOwner:{name:createCompany.querySelector('#provisionCompanyOwnerName').value.trim(),username:createCompany.querySelector('#provisionCompanyOwnerUsername').value.trim(),email:createCompany.querySelector('#provisionCompanyOwnerEmail').value.trim(),password:createCompany.querySelector('#provisionCompanyOwnerPassword').value}};
        var masterAdminName=createCompany.querySelector('#provisionMasterAdminName');
        if(masterAdminName) body.masterAdmin={name:masterAdminName.value.trim(),username:createCompany.querySelector('#provisionMasterAdminUsername').value.trim(),email:createCompany.querySelector('#provisionMasterAdminEmail').value.trim(),password:createCompany.querySelector('#provisionMasterAdminPassword').value};
        await request('masters/'+encodeURIComponent(state.masterFn)+'/companies',{method:'POST',headers:{'Idempotency-Key':'company-'+(crypto.randomUUID?crypto.randomUUID():Date.now())},body:body});
        state.companyFn=''; await renderWorkspace(state.session);
      }catch(errorValue){ error.textContent=errorValue&&errorValue.message||'Company creation failed.'; button.disabled=false; }
    });
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
    var simulationButton=view.querySelector('#platformStartSimulation');
    if(simulationButton) simulationButton.addEventListener('click',async function(event){
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

  window.ErpPlatformWorkspace={getSession:getSession,getSetupStatus:getSetupStatus,renderBootstrap:renderBootstrap,renderLogin:renderLogin,renderWorkspace:renderWorkspace,syncSimulationBanner:syncSimulationBanner,returnFromSimulation:returnFromSimulation};
})();
