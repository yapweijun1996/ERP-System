/* Platform Superadmin workspace (TASK-187). This file deliberately keeps the
 * platform realm outside the tenant data adapter: it talks only to /api/platform
 * and never creates, reads or writes erp_session/client tenant state. */
(function platformWorkspace(){
  if(typeof window.erpDataMode==='function'&&window.erpDataMode()!=='api') return;

  var API_BASE=(window.__ERP_API_BASE__||'/api').replace(/\/$/,'');
  var PLATFORM_BASE=API_BASE+'/platform';
  var cachedSession=null;
  var WORKSPACE_STAGE=Object.freeze({MASTER:'master',COMPANY:'company',CONTROL:'control'});
  var WORKSPACE_EVENT=Object.freeze({RENDER:'render',MASTER_CREATED:'master-created',COMPANY_CREATED:'company-created',MASTER_SELECTED:'master-selected',COMPANY_SELECTED:'company-selected',COMPANY_CREATE_OPENED:'company-create-opened',COMPANY_CREATE_CANCELLED:'company-create-cancelled'});
  var state={session:null,tenants:[],catalog:[],masterFn:'',companyFn:'',masterModules:[],companyModules:[],targets:[],workspaceStage:null,companyCreateOpen:false,pendingFocus:'',notice:'',entitlementTab:'master',entitlementSearch:{master:'',company:''},entitlementFilter:{master:'all',company:'all'},drafts:{bootstrap:null,master:null,company:{}}};
  var DEMO_BANNER_STORAGE_KEY='aria-platform-demo-banner-dismissed';
  var DEMO_DEFAULTS={
    bootstrap:{principalKey:'platform-admin',displayName:'Platform Admin',email:'platform-admin@acme.co',password:'demo-platform-1234'},
    master:{name:'Acme Group',loginCode:'ACME'},
    company:{name:'Acme Singapore',country:'SG',masterAdmin:{name:'Master Admin',username:'masteradmin',email:'masteradmin@acme.co',password:'demo1234'},companyOwner:{name:'Company Owner',username:'owner',email:'owner@acme.co',password:'demo1234'}},
  };

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }
  function pt(key,fallback,params){
    if(typeof window.tf==='function') return window.tf('platform.'+key,fallback,params);
    var template=String(fallback==null?key:fallback);
    return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,function(match,name){
      return params&&Object.prototype.hasOwnProperty.call(params,name)?String(params[name]??''):match;
    });
  }
  function demoAutofillEnabled(){
    if(typeof window.__ERP_PLATFORM_DEMO_AUTOFILL_OVERRIDE__==='boolean') return window.__ERP_PLATFORM_DEMO_AUTOFILL_OVERRIDE__;
    return String(window.__ERP_PLATFORM_DEMO_AUTOFILL__||'').toLowerCase()==='true';
  }
  function browserStorage(kind){
    try{ return kind==='session'?window.sessionStorage:window.localStorage; }catch{return null;}
  }
  function demoBannerDismissed(){
    var storage=browserStorage('local');
    return !!(storage&&storage.getItem(DEMO_BANNER_STORAGE_KEY)==='1');
  }
  function demoBannerMarkup(){
    if(!demoAutofillEnabled()||demoBannerDismissed()) return '';
    return `<aside class="platform-demo-banner" id="platformDemoBanner" role="status"><div><strong>${esc(pt('demo.bannerTitle','Demo quick setup · sample accounts'))}</strong><span>${esc(pt('demo.bannerBody','Sample accounts and passwords are public demo credentials. Do not use them for real business data.'))}</span></div><button type="button" class="btn soft platform-demo-banner-close" id="platformDemoBannerDismiss">${esc(pt('demo.dismiss','Dismiss'))}</button></aside>`;
  }
  function wirePasswordToggle(root,inputId,toggleId){
    var input=root&&root.querySelector('#'+inputId);
    var toggle=root&&root.querySelector('#'+toggleId);
    if(!input||!toggle) return;
    function update(visible){
      input.type=visible?'text':'password';
      toggle.setAttribute('aria-pressed',String(visible));
      toggle.setAttribute('aria-label',visible?pt('password.hide','Hide password'):pt('password.show','Show password'));
      toggle.innerHTML=visible?'<span class="auth-password-toggle-icon">'+ic('eyeoff')+'</span><span>'+esc(pt('password.hideShort','Hide'))+'</span>':'<span class="auth-password-toggle-icon">'+ic('eye')+'</span><span>'+esc(pt('password.showShort','Show'))+'</span>';
    }
    toggle.addEventListener('click',function(){ update(input.type!=='text'); });
    update(false);
  }
  function stepperMarkup(current){
    var labels=[pt('step.platform','Platform Superadmin'),pt('step.master','Master'),pt('step.companyAdmins','Company & administrators')];
    var shortLabels=[pt('step.platformShort','Platform'),pt('step.masterShort','Master'),pt('step.companyShort','Company')];
    if(current>labels.length) return '';
    return `<ol class="platform-stepper" aria-label="${esc(pt('step.progress','Provisioning progress'))}">${labels.map(function(label,index){ var number=index+1; var isComplete=number<current; var isCurrent=number===current; return `<li class="platform-step ${isComplete?'complete':''} ${isCurrent?'current':''}" aria-label="${esc(label)}" ${isCurrent?'aria-current="step"':''}><span>${isComplete?'✓':number}</span><b><span class="platform-step-label-full">${esc(label)}</span><span class="platform-step-label-short" aria-hidden="true">${esc(shortLabels[index])}</span></b></li>`; }).join('')}</ol>`;
  }
  function setFieldValue(root,id,value){
    var field=root&&root.querySelector('#'+id);
    if(!field||field.value) return;
    field.value=String(value);
  }
  function nextCompanyOrdinal(){
    var master=currentMaster();
    return ((master&&master.companies)||[]).length+1;
  }
  function demoCompanyDefaults(ordinal){
    if(ordinal<=1) return DEMO_DEFAULTS.company;
    if(ordinal===2) return {
      name:'Acme Malaysia',country:'MY',
      companyOwner:{name:'Malaysia Owner',username:'myowner',email:'myowner@acme.co',password:'demo1234'},
    };
    return {
      name:'Acme Company '+ordinal,country:'SG',
      companyOwner:{name:'Company Owner '+ordinal,username:'owner'+ordinal,email:'owner'+ordinal+'@acme.co',password:'demo1234'},
    };
  }
  function applyDemoDefaults(root,stage,needsMasterAdmin){
    if(!demoAutofillEnabled()) return;
    if(stage==='bootstrap'){
      setFieldValue(root,'bootstrapPrincipalKey',DEMO_DEFAULTS.bootstrap.principalKey);
      setFieldValue(root,'bootstrapDisplayName',DEMO_DEFAULTS.bootstrap.displayName);
      setFieldValue(root,'bootstrapEmail',DEMO_DEFAULTS.bootstrap.email);
      setFieldValue(root,'bootstrapPassword',DEMO_DEFAULTS.bootstrap.password);
      setFieldValue(root,'bootstrapPasswordConfirm',DEMO_DEFAULTS.bootstrap.password);
      return;
    }
    if(stage==='master'){
      setFieldValue(root,'provisionMasterName',DEMO_DEFAULTS.master.name);
      setFieldValue(root,'provisionMasterLoginCode',DEMO_DEFAULTS.master.loginCode);
      return;
    }
    var companyDefaults=demoCompanyDefaults(nextCompanyOrdinal());
    setFieldValue(root,'provisionCompanyName',companyDefaults.name);
    var country=root&&root.querySelector('#provisionCompanyCountry');
    if(country) country.value=companyDefaults.country;
    if(needsMasterAdmin){
      setFieldValue(root,'provisionMasterAdminName',DEMO_DEFAULTS.company.masterAdmin.name);
      setFieldValue(root,'provisionMasterAdminUsername',DEMO_DEFAULTS.company.masterAdmin.username);
      setFieldValue(root,'provisionMasterAdminEmail',DEMO_DEFAULTS.company.masterAdmin.email);
      setFieldValue(root,'provisionMasterAdminPassword',DEMO_DEFAULTS.company.masterAdmin.password);
    }
    setFieldValue(root,'provisionCompanyOwnerName',companyDefaults.companyOwner.name);
    setFieldValue(root,'provisionCompanyOwnerUsername',companyDefaults.companyOwner.username);
    setFieldValue(root,'provisionCompanyOwnerEmail',companyDefaults.companyOwner.email);
    setFieldValue(root,'provisionCompanyOwnerPassword',companyDefaults.companyOwner.password);
  }
  function companyDraftKey(){
    return String(state.masterFn||'none')+'|'+nextCompanyOrdinal();
  }
  function readDraft(stage){
    return stage===WORKSPACE_STAGE.COMPANY?state.drafts.company[companyDraftKey()]||null:state.drafts[stage];
  }
  function writeDraft(stage,draft){
    if(stage===WORKSPACE_STAGE.COMPANY) state.drafts.company[companyDraftKey()]=draft;
    else state.drafts[stage]=draft;
  }
  function snapshotDraft(root,stage){
    var form=root&&root.querySelector(stage==='bootstrap'?'#platformBootstrapForm':stage==='master'?'#platformCreateMasterForm':'#platformCreateCompanyForm');
    if(!form) return;
    var draft={};
    Array.from(form.elements||[]).forEach(function(field){
      if(!field.id) return;
      draft[field.id]=field.type==='checkbox'?field.checked:field.value;
    });
    writeDraft(stage,draft);
  }
  function restoreDraft(root,stage){
    var draft=readDraft(stage);
    if(!draft) return;
    Object.keys(draft).forEach(function(id){
      var field=root&&root.querySelector('#'+id);
      if(!field) return;
      if(field.type==='checkbox') field.checked=!!draft[id];
      else field.value=String(draft[id]??'');
    });
  }
  function clearDraft(stage){
    if(stage===WORKSPACE_STAGE.COMPANY) delete state.drafts.company[companyDraftKey()];
    else state.drafts[stage]=null;
  }
  function clearCompanyDrafts(){ state.drafts.company={}; }
  function visibleWorkspaceDraftStage(root){
    if(root&&root.querySelector('#platformCreateMasterForm')) return WORKSPACE_STAGE.MASTER;
    if(root&&root.querySelector('#platformCreateCompanyForm')) return WORKSPACE_STAGE.COMPANY;
    return null;
  }
  function transitionWorkspace(event,root,value){
    var transition=event||WORKSPACE_EVENT.RENDER;
    var visibleStage=visibleWorkspaceDraftStage(root);
    if(transition===WORKSPACE_EVENT.RENDER){
      if(visibleStage) snapshotDraft(root,visibleStage);
      return;
    }
    if(transition===WORKSPACE_EVENT.MASTER_SELECTED){
      if(visibleStage) snapshotDraft(root,visibleStage);
      state.masterFn=String(value||'');
      state.companyFn='';
      state.companyCreateOpen=false;
      return;
    }
    if(transition===WORKSPACE_EVENT.COMPANY_SELECTED){
      if(visibleStage) snapshotDraft(root,visibleStage);
      state.companyFn=String(value||'');
      state.companyCreateOpen=false;
      return;
    }
    if(transition===WORKSPACE_EVENT.COMPANY_CREATE_OPENED){
      state.companyCreateOpen=true;
      state.pendingFocus='company-create-heading';
      return;
    }
    if(transition===WORKSPACE_EVENT.COMPANY_CREATE_CANCELLED){
      if(visibleStage) snapshotDraft(root,visibleStage);
      state.companyCreateOpen=false;
      state.pendingFocus='company-create-opener';
      return;
    }
    if(transition===WORKSPACE_EVENT.MASTER_CREATED){
      clearDraft(WORKSPACE_STAGE.MASTER);
      clearCompanyDrafts();
      state.masterFn='';
      state.companyFn='';
      state.companyCreateOpen=false;
      return;
    }
    if(transition===WORKSPACE_EVENT.COMPANY_CREATED){
      clearDraft(WORKSPACE_STAGE.COMPANY);
      state.companyFn=String(value&&value.companyFn||'');
      state.companyCreateOpen=false;
      state.notice=pt('notice.companyCreated','{company} created successfully.',{company:value&&value.name||pt('field.company','Company')});
      state.pendingFocus='company-created-status';
      return;
    }
    throw new Error('Unsupported Platform workspace transition: '+transition);
  }
  function resolveWorkspaceStage(hasExistingCompany){
    if(!state.masterFn) return WORKSPACE_STAGE.MASTER;
    return hasExistingCompany?WORKSPACE_STAGE.CONTROL:WORKSPACE_STAGE.COMPANY;
  }
  function draftStageForWorkspaceStage(stage){
    return stage===WORKSPACE_STAGE.MASTER?WORKSPACE_STAGE.MASTER:WORKSPACE_STAGE.COMPANY;
  }
  function hashString(value){
    var hash=2166136261;
    for(var index=0;index<value.length;index++){ hash^=value.charCodeAt(index); hash=Math.imul(hash,16777619); }
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function formFingerprint(form){
    var values=Array.from(form.elements||[]).filter(function(field){ return field.id; }).map(function(field){ return [field.id,field.type==='checkbox'?field.checked:field.value]; });
    return hashString(JSON.stringify(values));
  }
  function stableIdempotencyKey(stage,masterFn,form){
    return 'platform-'+stage+'-'+hashString(String(masterFn||'none')+'|'+formFingerprint(form));
  }
  function wireDemoBanner(root){
    var button=root&&root.querySelector('#platformDemoBannerDismiss');
    if(!button) return;
    button.addEventListener('click',function(){
      var storage=browserStorage('local');
      if(storage) storage.setItem(DEMO_BANNER_STORAGE_KEY,'1');
      var banner=root.querySelector('#platformDemoBanner');
      if(banner) banner.remove();
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
    var error=new Error((detail&&detail.message)||pt('error.platformRequest','Platform request failed (HTTP {status}).',{status:response.status}));
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
    document.documentElement.classList.remove('platform-workspace-locked');
    var view=authView();
    snapshotDraft(view,'bootstrap');
    /* Bootstrap registration is intentionally the regular auth panel. The
     * fixed-height shell below is only for an authenticated Platform session. */
    view.className='auth-view';
    view.setAttribute('aria-label',pt('setup.ariaLabel','Create Platform Superadmin'));
    view.innerHTML=`<section class="auth-panel" style="max-width:620px;width:min(620px,calc(100vw - 24px));margin:20px auto;">
      <div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>${esc(pt('setup.brandSubtitle','First-run Platform setup'))}</small></span></div>
      <div class="auth-copy"><h1>${esc(pt('setup.title','Create Platform Superadmin'))}</h1><p>${esc(pt('setup.body','This one-time registration is available only while the production database is empty. The account is independent from tenant users.'))}</p>${stepperMarkup(1)}${demoBannerMarkup()}</div>
      <form class="auth-form" id="platformBootstrapForm" autocomplete="off">
        <div class="fld"><span>${esc(pt('field.platformPrincipalKey','Platform principal key'))}</span><input id="bootstrapPrincipalKey" autocomplete="username" autocapitalize="none" required placeholder="${esc(pt('field.platformPrincipalPlaceholder','e.g. platform-admin'))}"></div>
        <div class="fld"><span>${esc(pt('field.displayName','Display name'))}</span><input id="bootstrapDisplayName" autocomplete="name" required></div>
        <div class="fld"><span>${esc(pt('field.email','Email'))}</span><input id="bootstrapEmail" type="email" autocomplete="email" required></div>
        <div class="fld"><span>${esc(pt('field.password12','Password (12+ characters)'))}</span><input id="bootstrapPassword" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="fld"><span>${esc(pt('field.confirmPassword','Confirm password'))}</span><input id="bootstrapPasswordConfirm" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="auth-error" id="platformBootstrapError" role="alert"></div>
        <button class="btn primary lg" type="submit">${esc(pt('action.nextPlatform','Next: Create Platform Superadmin'))}</button>
      </form>
      <div class="auth-foot"><span class="cap ok"><span class="dot"></span>${esc(pt('setup.emptyDatabaseOnly','Empty database only'))}</span><span>${esc(pt('setup.afterCreation','After creation, you will enter the Platform workspace.'))}</span></div>
    </section>`;
    applyDemoDefaults(view,'bootstrap');
    restoreDraft(view,'bootstrap');
    wireDemoBanner(view);
    view.querySelector('#platformBootstrapForm').addEventListener('submit',async function(event){
      event.preventDefault();
      var error=view.querySelector('#platformBootstrapError');
      var submit=view.querySelector('button[type="submit"]');
      error.textContent='';
      var password=view.querySelector('#bootstrapPassword').value;
      if(password!==view.querySelector('#bootstrapPasswordConfirm').value){ error.textContent=pt('error.passwordMismatch','Passwords do not match.'); error.focus(); return; }
      submit.disabled=true;
      try{
        var response=await fetch(API_BASE+'/setup/platform-superadmin/actions/complete',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({
          principalKey:view.querySelector('#bootstrapPrincipalKey').value.trim(),
          displayName:view.querySelector('#bootstrapDisplayName').value.trim(),
          email:view.querySelector('#bootstrapEmail').value.trim(),
          password:password,
        })});
        var body=null; try{body=await response.json();}catch{}
        if(!response.ok){ var detail=body&&body.error; throw new Error((detail&&detail.message)||pt('error.platformBootstrapHttp','Platform bootstrap failed (HTTP {status}).',{status:response.status})); }
        location.reload();
      }catch(errorValue){ error.textContent=errorValue&&errorValue.message||pt('error.platformBootstrap','Platform bootstrap failed.'); submit.disabled=false; error.focus({preventScroll:true}); }
    });
  }
  function renderLogin(initialRealm,setupStatus){
    authShell(true);
    document.documentElement.classList.remove('platform-workspace-locked');
    var view=authView();
    var demoPlatformLoginAvailable=demoAutofillEnabled()&&Boolean(setupStatus&&setupStatus.hasPlatformAdmin);
    view.setAttribute('aria-label',pt('login.ariaLabel','Sign in'));
    view.innerHTML=`<section class="auth-panel">
      <div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>${esc(pt('login.brandSubtitle','Secure workspace'))}</small></span></div>
      <div class="auth-copy"><h1>${esc(pt('login.title','Sign in'))}</h1><p>${esc(pt('login.body','Choose the tenant workspace or the independent Platform Superadmin realm.'))}</p></div>
      <div class="platform-realm-tabs" role="tablist" aria-label="${esc(pt('login.realm','Sign-in realm'))}">
        <button type="button" class="btn soft active" data-realm="tenant" role="tab" aria-selected="true">${esc(pt('login.tenantWorkspace','Tenant workspace'))}</button>
        <button type="button" class="btn soft" data-realm="platform" role="tab" aria-selected="false">${esc(pt('step.platform','Platform Superadmin'))}</button>
      </div>
      <form class="auth-form" id="platformAwareLoginForm" autocomplete="off">
        <div id="tenantCredentials">
          <div class="fld"><span>${esc(pt('field.organizationCode','Organization code'))}</span><input id="tenantOrganizationCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(pt('field.organizationPlaceholder','e.g. ACME'))}"></div>
          <div class="fld"><span>${esc(pt('field.username','Username'))}</span><input id="tenantUsername" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${esc(pt('field.usernamePlaceholder','e.g. admin'))}"></div>
        </div>
        <div id="platformCredentials" hidden>
          ${demoPlatformLoginAvailable?`<div class="platform-demo-login"><button type="button" class="btn primary" id="platformDemoLoginButton">${esc(pt('login.demoButton','Log in as Platform Admin (Demo)'))}</button><small>${esc(pt('login.demoBody','Uses the public platform-admin sample account. Demo only.'))}</small></div>`:''}
          <div class="fld"><span>${esc(pt('field.platformPrincipalKey','Platform principal key'))}</span><input id="platformPrincipalKey" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${esc(pt('field.platformPrincipalPlaceholder','e.g. platform-admin'))}"></div>
          <p class="auth-help">${esc(pt('login.platformSessionHelp','Platform sessions are limited to one hour. Remember Me is not available.'))}</p>
        </div>
        <div class="fld"><span>${esc(pt('field.password','Password'))}</span><div class="auth-password-control"><input id="realmPassword" type="password" autocomplete="current-password"><button type="button" class="auth-password-toggle" id="realmPasswordToggle" aria-controls="realmPassword" aria-label="${esc(pt('password.show','Show password'))}" aria-pressed="false"><span class="auth-password-toggle-icon">${ic('eye')}</span><span>${esc(pt('password.showShort','Show'))}</span></button></div></div>
        <label class="auth-remember" id="tenantRememberDeviceRow" hidden><input id="tenantRememberDevice" type="checkbox"><span>${esc(pt('login.rememberDevice','Remember this device (up to 30 days)'))}</span></label>
        <div class="auth-error" id="loginError" role="alert"></div>
        <button class="btn primary lg" type="submit">${esc(pt('action.signIn','Sign in'))}</button>
      </form>
      <div class="auth-foot"><span class="cap ok"><span class="dot"></span>${esc(pt('login.production','Production'))}</span><span>${esc(pt('login.realmIsolation','Credentials and sessions are isolated by realm.'))}</span></div>
    </section>`;
    var realm=initialRealm==='platform'?'platform':'tenant';
    function toggle(next){
      realm=next;
      view.querySelector('#tenantCredentials').hidden=realm!=='tenant';
      view.querySelector('#platformCredentials').hidden=realm!=='platform';
      view.querySelector('#tenantRememberDeviceRow').hidden=realm!=='tenant';
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
      if(!password){ setError(pt('error.passwordRequired','Password is required.')); return; }
      submit.disabled=true;
      try{
        if(realm==='platform'){
          var principalKey=view.querySelector('#platformPrincipalKey').value.trim();
          if(!principalKey) throw new Error(pt('error.platformPrincipalRequired','Platform principal key is required.'));
          await request('login',{method:'POST',body:{principalKey:principalKey,password:password,rememberDevice:false}});
        }else{
          var organizationCode=view.querySelector('#tenantOrganizationCode').value.trim();
          var username=view.querySelector('#tenantUsername').value.trim();
          if(!organizationCode||!username) throw new Error(pt('error.tenantCredentialsRequired','Organization code and username are required.'));
          if(!window.ErpSystemDemo||typeof window.ErpSystemDemo.login!=='function') throw new Error(pt('error.tenantLoginUnavailable','Tenant login is unavailable.'));
          await window.ErpSystemDemo.login(organizationCode,username,password,{rememberDevice:!!view.querySelector('#tenantRememberDevice').checked});
        }
        location.reload();
      }catch(error){ setError(error&&error.message||pt('error.signInFailed','Sign in failed.')); submit.disabled=false; }
    });
    var demoLogin=view.querySelector('#platformDemoLoginButton');
    if(demoLogin) demoLogin.addEventListener('click',async function(){
      setError('');
      demoLogin.disabled=true;
      try{
        await request('login',{method:'POST',body:{principalKey:DEMO_DEFAULTS.bootstrap.principalKey,password:DEMO_DEFAULTS.bootstrap.password,rememberDevice:false}});
        location.reload();
      }catch(error){ setError(error&&error.message||pt('error.demoLoginFailed','Demo Platform login failed.')); demoLogin.disabled=false; }
    });
    wirePasswordToggle(view,'realmPassword','realmPasswordToggle');
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
    var companies=(master&&master.companies)||[];
    if(master&&!companies.some(function(item){ return item.companyFn===state.companyFn; })) state.companyFn=companies[0]?.companyFn||'';
    var all=await Promise.all([
      request('masters/'+encodeURIComponent(state.masterFn)+'/modules'),
      state.companyFn?request('masters/'+encodeURIComponent(state.masterFn)+'/companies/'+encodeURIComponent(state.companyFn)+'/modules'):Promise.resolve([]),
      state.companyFn?request('simulation-targets?masterFn='+encodeURIComponent(state.masterFn)+'&companyFn='+encodeURIComponent(state.companyFn)):Promise.resolve([]),
    ]);
    state.masterModules=all[0]||[]; state.companyModules=all[1]||[]; state.targets=all[2]||[];
  }
  function provisioningInput(id,label,type,autocomplete){
    return `<div class="fld"><span>${esc(label)}</span><input id="${id}" type="${type||'text'}" autocomplete="${autocomplete||'off'}" required></div>`;
  }
  function masterProvisioningMarkup(){
    var rows=(state.catalog||[]).map(function(item){
      var enabled=item.key!=='expenses_tax';
      return `<label class="platform-module-option"><input type="checkbox" data-provision-module="${esc(item.key)}" ${enabled?'checked':''}><span>${esc(item.name)}</span></label>`;
    }).join('');
    return `<section class="platform-provision-panel"><div class="platform-panel-heading"><div><h2>${esc(pt('provision.masterTitle','Create Master'))}</h2><p>${esc(pt('provision.masterIntro','Define the tenant group first. Commercial modules are independent from baseline Home, My Work, Admin, Settings and Account services.'))}</p></div></div><form id="platformCreateMasterForm" class="auth-form">
      <div class="platform-form-grid platform-master-identity">${provisioningInput('provisionMasterName',pt('field.masterName','Master name'))}${provisioningInput('provisionMasterLoginCode',pt('field.masterLoginCode','Master login code'))}</div>
      <fieldset class="platform-module-selection"><legend>${esc(pt('provision.commercialModules','Commercial modules'))}</legend><div class="platform-provision-module-grid">${rows}</div></fieldset>
    </form></section>`;
  }
  function companyProvisioningMarkup(master,hasExistingCompany){
    var needsMasterAdmin=!(master&&master.hasMasterAdmin);
    var title=pt('provision.companyTitle','Create Company');
    var intro=hasExistingCompany?pt('provision.companyExistingIntro','A Company already exists for this Master. Enter new unique Company and Owner details only if you want to create another one.'):pt('provision.companyDefaultIntro','Company allocation is copied from the Master defaults. Tenant onboarding cannot choose commercial modules.');
    return `<section class="platform-provision-panel" id="platformCompanyCreatePanel" aria-labelledby="platformCompanyCreateHeading"><div class="platform-panel-heading"><div><h2 id="platformCompanyCreateHeading" tabindex="-1">${esc(title)}</h2><p>${esc(intro)}</p></div></div><form id="platformCreateCompanyForm" class="auth-form">
      <section class="platform-form-section"><h3>${esc(pt('provision.companyDetails','Company details'))}</h3><div class="platform-form-grid">${provisioningInput('provisionCompanyName',pt('field.companyName','Company name'))}<div class="fld"><span>${esc(pt('field.country','Country'))}</span><select id="provisionCompanyCountry"><option value="SG">${esc(pt('field.singapore','Singapore (SG)'))}</option><option value="MY">${esc(pt('field.malaysia','Malaysia (MY)'))}</option></select></div></div></section>
      ${needsMasterAdmin?`<section class="platform-form-section"><h3>${esc(pt('provision.masterAdmin','Master Admin'))} <small>${esc(pt('provision.firstCompanyOnly','(first Company only)'))}</small></h3><div class="platform-form-grid">${provisioningInput('provisionMasterAdminName',pt('field.masterAdminName','Master Admin name'))}${provisioningInput('provisionMasterAdminUsername',pt('field.masterAdminUsername','Master Admin username'))}${provisioningInput('provisionMasterAdminEmail',pt('field.masterAdminEmail','Master Admin email'),'email')}${provisioningInput('provisionMasterAdminPassword',pt('field.masterAdminPassword','Master Admin password'),'password','new-password')}</div></section>`:''}
      <section class="platform-form-section"><h3>${esc(pt('provision.companyOwner','Company Owner'))}</h3><div class="platform-form-grid">${provisioningInput('provisionCompanyOwnerName',pt('field.companyOwnerName','Company Owner name'))}${provisioningInput('provisionCompanyOwnerUsername',pt('field.companyOwnerUsername','Company Owner username'))}${provisioningInput('provisionCompanyOwnerEmail',pt('field.companyOwnerEmail','Company Owner email'),'email')}${provisioningInput('provisionCompanyOwnerPassword',pt('field.companyOwnerPassword','Company Owner password'),'password','new-password')}</div></section>
    </form></section>`;
  }
  function provisioningMarkup(hasExistingCompany){
    if(!state.masterFn) return masterProvisioningMarkup();
    if(hasExistingCompany&&!state.companyCreateOpen) return '';
    return companyProvisioningMarkup(currentMaster(),hasExistingCompany);
  }
  function provisioningActionMarkup(hasExistingCompany){
    var masterStage=!state.masterFn;
    if(hasExistingCompany&&!state.companyCreateOpen) return '';
    var formId=masterStage?'platformCreateMasterForm':'platformCreateCompanyForm';
    var errorId=masterStage?'platformCreateMasterError':'platformCreateCompanyError';
    var actionId=masterStage?'platformCreateMasterAction':'platformCreateCompanyAction';
    var label=masterStage?pt('action.nextMaster','Next: Create Master'):(hasExistingCompany?pt('action.createCompany','Create Company'):pt('action.finishCompany','Finish: Create Company'));
    var cancel=hasExistingCompany?`<button class="btn soft" id="platformCancelCompanyCreate" type="button">${esc(pt('action.cancel','Cancel'))}</button>`:'';
    return `<footer class="platform-shell-actionbar" id="platformProvisionActionbar" aria-label="${esc(pt('provision.actionBar','Provisioning action'))}"><div class="auth-error" id="${errorId}" role="alert" aria-live="assertive" tabindex="-1"></div>${cancel}<button class="btn primary" id="${actionId}" form="${formId}" type="submit">${esc(label)}</button></footer>`;
  }
  function switchMarkup(hasExistingCompany){
    return `<div class="platform-workspace-controls platform-shell-toolbar">
      <label class="fld"><span>${esc(pt('field.master','Master'))}</span><select id="platformMasterSelect">${options(state.tenants,state.masterFn,'masterFn','name')}</select></label>
      <label class="fld"><span>${esc(pt('field.company','Company'))}</span><select id="platformCompanySelect">${options((currentMaster()||{}).companies||[],state.companyFn,'companyFn','name')}</select></label>
      ${hasExistingCompany?`<button type="button" class="btn soft platform-create-company-trigger" id="platformOpenCompanyCreate" aria-expanded="${state.companyCreateOpen?'true':'false'}" aria-controls="platformCompanyCreatePanel">+ ${esc(pt('action.createCompany','Create Company'))}</button>`:''}
    </div>`;
  }
  function entitlementBadge(kind,label){ return `<span class="platform-status-badge ${esc(kind)}">${esc(label)}</span>`; }
  function dependencyMarkup(dependencies){
    if(!dependencies||!dependencies.length) return '<span class="platform-dependency-empty">—</span>';
    return `<span class="platform-dependency-list">${dependencies.map(function(item){ return `<span>${esc(item)}</span>`; }).join('')}</span>`;
  }
  function switchControl(className,checked,label){
    return `<label class="platform-switch"><input class="${className}" role="switch" type="checkbox" aria-label="${esc(label)}" ${checked?'checked':''}><span class="platform-switch-track" aria-hidden="true"><span></span></span><span class="platform-switch-label">${esc(checked?pt('status.enabled','Enabled'):pt('status.disabled','Disabled'))}</span></label>`;
  }
  function rowActions(type){
    return `<div class="platform-row-actions"><span class="platform-row-unsaved" hidden>${esc(pt('action.unsaved','Unsaved'))}</span><button type="button" class="btn soft platform-reset-${type}" hidden>${esc(pt('action.reset','Reset'))}</button><button type="button" class="btn soft platform-save-${type}" disabled>${esc(pt('action.save','Save'))}</button></div><div class="platform-row-feedback" role="status" aria-live="polite" tabindex="-1"></div><div class="platform-row-error" role="alert" aria-live="assertive" tabindex="-1"></div><button type="button" class="btn soft platform-reload-${type}" hidden>${esc(pt('action.reloadRow','Reload row'))}</button>`;
  }
  function masterSummaryMarkup(){
    var enabled=(state.masterModules||[]).filter(function(item){ return item.masterEnabled; }).length;
    var defaults=(state.masterModules||[]).filter(function(item){ return item.defaultCompanyAllocated; }).length;
    return pt('summary.master','{enabled} enabled · {defaults} default',{enabled:enabled,defaults:defaults});
  }
  function companySummaryMarkup(){
    var allocated=(state.companyModules||[]).filter(function(item){ return item.companyAllocated; }).length;
    var effective=(state.companyModules||[]).filter(function(item){ return item.effectiveEnabled; }).length;
    return pt('summary.company','{allocated} allocated · {effective} effective',{allocated:allocated,effective:effective});
  }
  function entitlementTools(tab){
    var filter=state.entitlementFilter[tab]||'all';
    var options=tab==='master'?[['all',pt('filter.allModules','All modules')],['enabled',pt('status.enabled','Enabled')],['disabled',pt('status.disabled','Disabled')]]:[['all',pt('filter.allModules','All modules')],['effective',pt('status.effective','Effective')],['blocked',pt('status.blocked','Blocked')]];
    return `<div class="platform-entitlement-tools"><label class="fld"><span>${esc(pt('field.searchModules','Search modules'))}</span><input type="search" class="platform-module-search" data-entitlement-tab="${tab}" value="${esc(state.entitlementSearch[tab]||'')}" placeholder="${esc(pt('field.searchModulePlaceholder','Name, key or dependency'))}"></label><label class="fld"><span>${esc(pt('field.status','Status'))}</span><select class="platform-module-filter" data-entitlement-tab="${tab}">${options.map(function(option){ return `<option value="${option[0]}" ${option[0]===filter?'selected':''}>${esc(option[1])}</option>`; }).join('')}</select></label></div>`;
  }
  function modulesMarkup(){
    var allocation=new Map((state.companyModules||[]).map(function(item){ return [item.moduleKey,item]; }));
    var masterRows=(state.masterModules||[]).map(function(item){
      var search=[item.name,item.moduleKey].concat(item.dependencies||[]).join(' ').toLowerCase();
      return `<tr data-module="${esc(item.moduleKey)}" data-version="${Number(item.version)||0}" data-master-enabled="${item.masterEnabled?'true':'false'}" data-master-default="${item.defaultCompanyAllocated?'true':'false'}" data-search="${esc(search)}"><th scope="row" data-label="${esc(pt('table.module','Module'))}"><b>${esc(item.name)}</b><small>${esc(item.moduleKey)}</small></th><td data-label="${esc(pt('table.dependencies','Dependencies'))}">${dependencyMarkup(item.dependencies)}</td><td data-label="${esc(pt('table.masterEntitlement','Master entitlement'))}">${switchControl('platform-master-enabled',item.masterEnabled,pt('aria.masterEntitlement','Master entitlement for {module}',{module:item.name}))}</td><td data-label="${esc(pt('table.defaultCompany','Default for new Companies'))}">${switchControl('platform-master-default',item.defaultCompanyAllocated,pt('aria.defaultCompany','Default Company allocation for {module}',{module:item.name}))}</td><td data-label="${esc(pt('table.action','Action'))}">${rowActions('master')}</td></tr>`;
    }).join('');
    var companyRows=(state.masterModules||[]).map(function(item){
      var row=allocation.get(item.moduleKey)||{};
      var effectiveLabel=!item.masterEnabled?pt('status.blockedByMaster','Blocked by Master'):row.companyAllocated?pt('status.effective','Effective'):pt('status.notAllocated','Not allocated');
      var effectiveKind=row.effectiveEnabled?'effective':'blocked';
      return `<tr data-module="${esc(item.moduleKey)}" data-version="${Number(row.version)||0}" data-master-enabled="${item.masterEnabled?'true':'false'}" data-company-allocated="${row.companyAllocated?'true':'false'}" data-search="${esc([item.name,item.moduleKey].join(' ').toLowerCase())}"><th scope="row" data-label="${esc(pt('table.module','Module'))}"><b>${esc(item.name)}</b><small>${esc(item.moduleKey)}</small></th><td data-label="${esc(pt('table.masterStatus','Master status'))}" class="platform-company-master-status">${entitlementBadge(item.masterEnabled?'enabled':'disabled',item.masterEnabled?pt('status.enabled','Enabled'):pt('status.disabled','Disabled'))}</td><td data-label="${esc(pt('table.companyAllocation','Company allocation'))}">${switchControl('platform-company-allocated',row.companyAllocated,pt('aria.companyAllocation','Company allocation for {module}',{module:item.name}))}</td><td data-label="${esc(pt('table.effectiveAccess','Effective access'))}" class="platform-company-effective">${entitlementBadge(effectiveKind,effectiveLabel)}</td><td data-label="${esc(pt('table.action','Action'))}">${rowActions('company')}</td></tr>`;
    }).join('');
    var masterSelected=state.entitlementTab!=='company';
    return `<section class="platform-entitlement-card platform-entitlement-workspace platform-entitlement-grid" aria-labelledby="platformEntitlementHeading"><div class="platform-entitlement-heading"><div><h2 id="platformEntitlementHeading">${esc(pt('entitlement.title','Module access'))}</h2><p>${esc(pt('entitlement.intro','Master entitlement masks Company allocation without overwriting the saved allocation.'))}</p></div></div><div class="platform-entitlement-tabs" role="tablist" aria-label="${esc(pt('entitlement.scope','Module access scope'))}"><button type="button" class="platform-entitlement-tab" id="platformMasterTab" role="tab" aria-selected="${masterSelected?'true':'false'}" aria-controls="platformMasterPanel" tabindex="${masterSelected?'0':'-1'}" data-tab="master"><span>${esc(pt('entitlement.masterControls','Master controls'))}</span><small id="platformMasterSummary">${esc(masterSummaryMarkup())}</small></button><button type="button" class="platform-entitlement-tab" id="platformCompanyTab" role="tab" aria-selected="${masterSelected?'false':'true'}" aria-controls="platformCompanyPanel" tabindex="${masterSelected?'-1':'0'}" data-tab="company"><span>${esc(pt('entitlement.companyAllocation','Company allocation'))}</span><small id="platformCompanySummary">${esc(companySummaryMarkup())}</small></button></div>
      <section class="platform-entitlement-panel" id="platformMasterPanel" role="tabpanel" aria-labelledby="platformMasterTab" ${masterSelected?'':'hidden'}>${entitlementTools('master')}<div class="platform-table-wrap"><table><thead><tr><th>${esc(pt('table.module','Module'))}</th><th>${esc(pt('table.dependencies','Dependencies'))}</th><th>${esc(pt('table.masterEntitlement','Master entitlement'))}</th><th>${esc(pt('table.defaultCompany','Default for new Companies'))}</th><th>${esc(pt('table.action','Action'))}</th></tr></thead><tbody>${masterRows}</tbody></table><p class="platform-entitlement-empty" hidden>${esc(pt('entitlement.noMatches','No modules match this filter.'))}</p></div></section>
      <section class="platform-entitlement-panel" id="platformCompanyPanel" role="tabpanel" aria-labelledby="platformCompanyTab" ${masterSelected?'hidden':''}><div class="platform-entitlement-context"><strong>${esc((currentCompany()||{}).name||state.companyFn)}</strong><span>${esc(pt('entitlement.effectiveHint','Effective access requires both Master entitlement and Company allocation.'))}</span></div>${entitlementTools('company')}<div class="platform-table-wrap"><table><thead><tr><th>${esc(pt('table.module','Module'))}</th><th>${esc(pt('table.masterStatus','Master status'))}</th><th>${esc(pt('table.companyAllocation','Company allocation'))}</th><th>${esc(pt('table.effectiveAccess','Effective access'))}</th><th>${esc(pt('table.action','Action'))}</th></tr></thead><tbody>${companyRows}</tbody></table><p class="platform-entitlement-empty" hidden>${esc(pt('entitlement.noMatches','No modules match this filter.'))}</p></div></section>
    </section>`;
  }
  function boolData(value){ return String(value)==='true'; }
  function moduleRow(panelId,moduleKey){
    return Array.from(document.querySelectorAll('#'+panelId+' tbody tr')).find(function(row){ return row.dataset.module===moduleKey; })||null;
  }
  function updateSwitchLabel(input){
    var label=input&&input.closest('.platform-switch')&&input.closest('.platform-switch').querySelector('.platform-switch-label');
    if(label) label.textContent=input.checked?pt('status.enabled','Enabled'):pt('status.disabled','Disabled');
  }
  function companyEffectiveState(row){
    var masterEnabled=boolData(row.dataset.masterEnabled);
    var allocated=row.querySelector('.platform-company-allocated').checked;
    return masterEnabled&&allocated?{kind:'effective',label:pt('status.effective','Effective')}:masterEnabled?{kind:'blocked',label:pt('status.notAllocated','Not allocated')}:{kind:'blocked',label:pt('status.blockedByMaster','Blocked by Master')};
  }
  function updateCompanyEffective(row){
    var target=row.querySelector('.platform-company-effective');
    var status=companyEffectiveState(row);
    if(target) target.innerHTML=entitlementBadge(status.kind,status.label);
  }
  function syncEntitlementRow(row,type,clearFeedback){
    var dirty;
    if(type==='master'){
      var enabled=row.querySelector('.platform-master-enabled');
      var defaults=row.querySelector('.platform-master-default');
      updateSwitchLabel(enabled); updateSwitchLabel(defaults);
      dirty=enabled.checked!==boolData(row.dataset.masterEnabled)||defaults.checked!==boolData(row.dataset.masterDefault);
    }else{
      var allocated=row.querySelector('.platform-company-allocated');
      updateSwitchLabel(allocated); updateCompanyEffective(row);
      dirty=allocated.checked!==boolData(row.dataset.companyAllocated);
    }
    row.classList.toggle('is-dirty',dirty);
    var unsaved=row.querySelector('.platform-row-unsaved');
    var reset=row.querySelector('.platform-reset-'+type);
    var save=row.querySelector('.platform-save-'+type);
    if(unsaved) unsaved.hidden=!dirty;
    if(reset) reset.hidden=!dirty;
    if(save) save.disabled=!dirty;
    if(clearFeedback&&dirty){
      var feedback=row.querySelector('.platform-row-feedback');
      var error=row.querySelector('.platform-row-error');
      var reload=row.querySelector('.platform-reload-'+type);
      if(feedback) feedback.textContent='';
      if(error) error.textContent='';
      if(reload) reload.hidden=true;
    }
    return dirty;
  }
  function updateEntitlementSummaries(view){
    var masterRows=Array.from(view.querySelectorAll('#platformMasterPanel tbody tr'));
    var companyRows=Array.from(view.querySelectorAll('#platformCompanyPanel tbody tr'));
    var master=view.querySelector('#platformMasterSummary');
    var company=view.querySelector('#platformCompanySummary');
    if(master){
      var enabled=masterRows.filter(function(row){ return row.querySelector('.platform-master-enabled').checked; }).length;
      var defaults=masterRows.filter(function(row){ return row.querySelector('.platform-master-default').checked; }).length;
      var dirty=masterRows.filter(function(row){ return row.classList.contains('is-dirty'); }).length;
      master.textContent=pt(dirty?'summary.masterDirty':'summary.master','{enabled} enabled · {defaults} default'+(dirty?' · {dirty} unsaved':''),{enabled:enabled,defaults:defaults,dirty:dirty});
    }
    if(company){
      var allocated=companyRows.filter(function(row){ return row.querySelector('.platform-company-allocated').checked; }).length;
      var effective=companyRows.filter(function(row){ var status=companyEffectiveState(row); return status.kind==='effective'; }).length;
      var changed=companyRows.filter(function(row){ return row.classList.contains('is-dirty'); }).length;
      company.textContent=pt(changed?'summary.companyDirty':'summary.company','{allocated} allocated · {effective} effective'+(changed?' · {changed} unsaved':''),{allocated:allocated,effective:effective,changed:changed});
    }
  }
  function filterEntitlementPanel(view,tab){
    var panel=view.querySelector(tab==='master'?'#platformMasterPanel':'#platformCompanyPanel');
    if(!panel) return;
    var query=String(state.entitlementSearch[tab]||'').trim().toLowerCase();
    var filter=state.entitlementFilter[tab]||'all';
    var visible=0;
    panel.querySelectorAll('tbody tr').forEach(function(row){
      var matchesText=!query||String(row.dataset.search||'').includes(query);
      var matchesStatus=true;
      if(!row.classList.contains('is-dirty')&&tab==='master'&&filter!=='all') matchesStatus=row.querySelector('.platform-master-enabled').checked===(filter==='enabled');
      if(!row.classList.contains('is-dirty')&&tab==='company'&&filter!=='all') matchesStatus=(companyEffectiveState(row).kind==='effective')===(filter==='effective');
      row.hidden=!(matchesText&&matchesStatus);
      if(!row.hidden) visible++;
    });
    var empty=panel.querySelector('.platform-entitlement-empty');
    if(empty) empty.hidden=visible!==0;
  }
  function resetEntitlementRow(row,type){
    if(type==='master'){
      row.querySelector('.platform-master-enabled').checked=boolData(row.dataset.masterEnabled);
      row.querySelector('.platform-master-default').checked=boolData(row.dataset.masterDefault);
    }else row.querySelector('.platform-company-allocated').checked=boolData(row.dataset.companyAllocated);
    syncEntitlementRow(row,type,true);
  }
  function dirtyEntitlementRows(view){ return Array.from(view.querySelectorAll('.platform-entitlement-panel tbody tr.is-dirty')); }
  function discardEntitlementChanges(view){
    dirtyEntitlementRows(view).forEach(function(row){ resetEntitlementRow(row,row.closest('#platformMasterPanel')?'master':'company'); });
    updateEntitlementSummaries(view);
    filterEntitlementPanel(view,'master'); filterEntitlementPanel(view,'company');
  }
  function confirmDiscardEntitlements(view){
    if(!dirtyEntitlementRows(view).length) return true;
    if(!window.confirm(pt('confirm.discardChanges','You have unsaved module changes. Discard them?'))) return false;
    discardEntitlementChanges(view);
    return true;
  }
  function activateEntitlementTab(view,tab,focus){
    if(tab===state.entitlementTab) return true;
    if(!confirmDiscardEntitlements(view)) return false;
    state.entitlementTab=tab;
    view.querySelectorAll('.platform-entitlement-tab').forEach(function(button){
      var selected=button.dataset.tab===tab;
      button.setAttribute('aria-selected',String(selected)); button.tabIndex=selected?0:-1;
    });
    var master=view.querySelector('#platformMasterPanel');
    var company=view.querySelector('#platformCompanyPanel');
    if(master) master.hidden=tab!=='master';
    if(company) company.hidden=tab!=='company';
    filterEntitlementPanel(view,tab);
    if(focus){ var target=view.querySelector('.platform-entitlement-tab[data-tab="'+tab+'"]'); if(target) target.focus(); }
    return true;
  }
  function updateCompanyMasterState(moduleKey,masterEnabled){
    var companyModule=(state.companyModules||[]).find(function(item){ return item.moduleKey===moduleKey; });
    if(companyModule){ companyModule.masterEnabled=masterEnabled; companyModule.effectiveEnabled=masterEnabled&&!!companyModule.companyAllocated; }
    var row=moduleRow('platformCompanyPanel',moduleKey);
    if(!row) return;
    row.dataset.masterEnabled=String(masterEnabled);
    var status=row.querySelector('.platform-company-master-status');
    if(status) status.innerHTML=entitlementBadge(masterEnabled?'enabled':'disabled',masterEnabled?pt('status.enabled','Enabled'):pt('status.disabled','Disabled'));
    updateCompanyEffective(row);
  }
  function applyMasterServerRow(row,result){
    var item=(state.masterModules||[]).find(function(entry){ return entry.moduleKey===row.dataset.module; });
    var enabled=typeof result.masterEnabled==='boolean'?result.masterEnabled:row.querySelector('.platform-master-enabled').checked;
    var defaults=typeof result.defaultCompanyAllocated==='boolean'?result.defaultCompanyAllocated:row.querySelector('.platform-master-default').checked;
    if(item) Object.assign(item,result,{masterEnabled:enabled,defaultCompanyAllocated:defaults});
    row.dataset.version=String(Number(result.version)||Number(row.dataset.version));
    row.dataset.masterEnabled=String(enabled); row.dataset.masterDefault=String(defaults);
    row.querySelector('.platform-master-enabled').checked=enabled;
    row.querySelector('.platform-master-default').checked=defaults;
    updateCompanyMasterState(row.dataset.module,enabled);
    syncEntitlementRow(row,'master',false);
  }
  function applyCompanyServerRow(row,result){
    var item=(state.companyModules||[]).find(function(entry){ return entry.moduleKey===row.dataset.module; });
    var allocated=typeof result.companyAllocated==='boolean'?result.companyAllocated:row.querySelector('.platform-company-allocated').checked;
    if(item) Object.assign(item,result,{companyAllocated:allocated});
    row.dataset.version=String(Number(result.version)||Number(row.dataset.version));
    row.dataset.companyAllocated=String(allocated);
    if(typeof result.masterEnabled==='boolean') row.dataset.masterEnabled=String(result.masterEnabled);
    row.querySelector('.platform-company-allocated').checked=allocated;
    syncEntitlementRow(row,'company',false);
  }
  async function reloadEntitlementRow(view,row,type){
    var path=type==='master'?'masters/'+encodeURIComponent(state.masterFn)+'/modules':'masters/'+encodeURIComponent(state.masterFn)+'/companies/'+encodeURIComponent(state.companyFn)+'/modules';
    var list=await request(path);
    var result=(list||[]).find(function(item){ return item.moduleKey===row.dataset.module; });
    if(!result) throw new Error(pt('error.moduleUnavailable','The selected module is no longer available.'));
    if(type==='master') applyMasterServerRow(row,result); else applyCompanyServerRow(row,result);
    var error=row.querySelector('.platform-row-error'); var reload=row.querySelector('.platform-reload-'+type);
    if(error) error.textContent=''; if(reload) reload.hidden=true;
    updateEntitlementSummaries(view); filterEntitlementPanel(view,type);
  }
  function guardEntitlementUnload(event){
    var view=authView();
    if(!dirtyEntitlementRows(view).length) return;
    event.preventDefault(); event.returnValue='';
  }
  function simulationMarkup(){
    return `<section class="platform-simulation-panel platform-tenant-entry-panel"><h2>${esc(pt('simulation.openTenant','Open tenant workspace'))}</h2><p>${esc(pt('simulation.intro','Choose elevated Platform Admin access or an exact tenant user simulation. The two modes are isolated and fully audited.'))}</p>
      <div class="platform-tenant-entry-grid"><div class="platform-tenant-entry-card"><h3>${esc(pt('simulation.openAdminTitle','Open as Platform Admin'))}</h3><p>${esc(pt('simulation.adminBody','See all MAC-effective modules and use registered tenant permissions. Sensitive mutations require a separate 15-minute unlock.'))}</p><label class="fld"><span>${esc(pt('field.accessReason','Access reason'))}</span><input id="platformTenantAccessReason" maxlength="500" required placeholder="${esc(pt('field.accessReasonPlaceholder','Why tenant access is needed'))}"></label><label class="fld"><span>${esc(pt('field.ticketReference','Ticket reference'))}</span><input id="platformTenantAccessTicket" maxlength="128" required placeholder="${esc(pt('field.ticketPlaceholder','e.g. DEMO-001'))}"></label><button class="btn primary" id="platformStartTenantAccess" type="button">${esc(pt('action.openAdmin','Open as Platform Admin'))}</button></div>
      <div class="platform-tenant-entry-card"><h3>${esc(pt('simulation.employeeTitle','Login as employee'))}</h3><p>${esc(pt('simulation.employeeBody',"Use only the selected user's permissions, scope and workflow authority. Platform permissions are never added."))}</p><label class="fld"><span>${esc(pt('field.activeTenantUser','Active tenant user'))}</span><select id="platformSimulationTarget">${options(state.targets,'','userId','username')}</select></label><button class="btn soft" id="platformStartSimulation" type="button">${esc(pt('action.loginEmployee','Login as employee'))}</button></div></div></section>`;
  }
  async function renderWorkspace(session,event,value){
    state.session=session||await getSession();
    authShell(true);
    document.documentElement.classList.add('platform-workspace-locked');
    var view=authView();
    transitionWorkspace(event||WORKSPACE_EVENT.RENDER,view,value);
    view.classList.add('platform-workspace-view');
    view.setAttribute('aria-label',pt('workspace.ariaLabel','Platform Superadmin workspace'));
    view.innerHTML=`<section class="auth-panel platform-shell"><header class="platform-shell-header"><div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>${esc(pt('workspace.subtitle','Platform Superadmin workspace'))}</small></span></div><button type="button" class="btn soft" id="platformLogoutBtn">${esc(pt('action.signOut','Sign out'))}</button></header><div class="platform-shell-intro"><div class="auth-copy"><h1 tabindex="-1">${esc(pt('workspace.loading','Loading platform workspace…'))}</h1></div></div><div class="platform-shell-body"><div class="auth-error" id="platformWorkspaceError" role="alert" tabindex="-1"></div></div></section>`;
    try{
      state.tenants=await request('entitlements');
      state.catalog=await request('module-catalog');
      state.masterFn=state.masterFn&&state.tenants.some(function(item){ return item.masterFn===state.masterFn; })?state.masterFn:(state.tenants[0]||{}).masterFn||'';
      await loadDetails();
      // Treat any Company returned for the selected Master as an existing
      // continuation point, even if an older session restored an empty or
      // stale companyFn. Demo defaults use the next Company ordinal, while
      // drafts are isolated by Master and ordinal so submitted identities are
      // never restored into the following Company form.
      var selectedMaster=currentMaster();
      var hasExistingCompany=Boolean(selectedMaster&&(selectedMaster.companies||[]).length);
      if(hasExistingCompany&&!state.companyFn) state.companyFn=selectedMaster.companies[0].companyFn;
      var hasCompany=Boolean(state.companyFn||hasExistingCompany);
      state.workspaceStage=resolveWorkspaceStage(hasExistingCompany);
      var draftStage=draftStageForWorkspaceStage(state.workspaceStage);
      var stage=state.masterFn?(hasCompany?4:3):2;
      var progress=stepperMarkup(stage);
      var provisioning=provisioningMarkup(hasExistingCompany);
      var notice=state.notice;
      state.notice='';
      view.innerHTML=`<section class="auth-panel platform-shell"><header class="platform-shell-header"><div class="auth-brand"><span class="mark brand-logo-mark">${typeof window.erpBrandLogo==='function'?window.erpBrandLogo():''}</span><span><b>Aria ERP</b><small>${esc(pt('workspace.subtitleWithUser','Platform Superadmin workspace · {name}',{name:state.session&&state.session.displayName||''}))}</small></span></div><button type="button" class="btn soft" id="platformLogoutBtn">${esc(pt('action.signOut','Sign out'))}</button></header><div class="platform-shell-intro${progress?' has-progress':''}${state.masterFn?' has-toolbar':''}"><div class="auth-copy"><h1 tabindex="-1">${esc(state.masterFn?(hasCompany?pt('workspace.tenantControl','Platform tenant control'):pt('workspace.finishProvisioning','Finish tenant provisioning')):pt('workspace.startProvisioning','Start tenant provisioning'))}</h1><p>${esc(state.masterFn?pt('workspace.controlIntro','Platform-only Master and Company controls with audited tenant identity provisioning.'):pt('workspace.provisionIntro','Create the first Master, configure its commercial defaults, then create its first Company and administrators.'))}</p>${demoBannerMarkup()}</div>${state.masterFn?switchMarkup(hasExistingCompany):''}${progress?`<div class="platform-shell-progress">${progress}</div>`:''}</div><div class="platform-shell-body"><div class="auth-error" id="platformWorkspaceError" role="alert" aria-live="assertive" tabindex="-1"></div>${notice?`<div class="platform-workspace-status" id="platformCompanyCreatedStatus" role="status" tabindex="-1">${esc(notice)}</div>`:''}${provisioning?`<div class="platform-workspace-grid">${provisioning}</div>`:''}${hasCompany?modulesMarkup()+simulationMarkup():''}</div>${provisioningActionMarkup(hasExistingCompany)}</section>`;
      if(view.querySelector('#platformCreateMasterForm')||view.querySelector('#platformCreateCompanyForm')){
        applyDemoDefaults(view,draftStage,state.workspaceStage===WORKSPACE_STAGE.COMPANY?!(currentMaster()&&currentMaster().hasMasterAdmin):false);
        restoreDraft(view,draftStage);
      }
      wireWorkspace(view);
      var body=view.querySelector('.platform-shell-body');
      if(body) body.scrollTop=0;
      var focusTarget=state.pendingFocus==='company-create-heading'?view.querySelector('#platformCompanyCreateHeading'):state.pendingFocus==='company-create-opener'?view.querySelector('#platformOpenCompanyCreate'):state.pendingFocus==='company-created-status'?view.querySelector('#platformCompanyCreatedStatus'):view.querySelector('.platform-shell-intro h1');
      state.pendingFocus='';
      if(focusTarget&&typeof focusTarget.focus==='function') requestAnimationFrame(function(){ focusTarget.focus({preventScroll:true}); });
    }catch(error){ view.querySelector('.auth-copy').innerHTML=`<h1>${esc(pt('error.workspaceUnavailable','Platform workspace unavailable'))}</h1><p>${esc(error&&error.message||pt('error.entitlementLoadFailed','Unable to load platform entitlement data.'))}</p>`; }
  }
  function wireWorkspace(view){
    wireDemoBanner(view);
    window.removeEventListener('beforeunload',guardEntitlementUnload);
    window.addEventListener('beforeunload',guardEntitlementUnload);
    view.querySelector('#platformLogoutBtn').addEventListener('click',async function(){ if(!confirmDiscardEntitlements(view)) return; try{ await request('logout',{method:'POST',body:{}}); }finally{ cachedSession=null; location.reload(); } });
    var masterSelect=view.querySelector('#platformMasterSelect');
    if(masterSelect) masterSelect.addEventListener('change',async function(event){ if(!confirmDiscardEntitlements(view)){ event.target.value=state.masterFn; return; } await renderWorkspace(state.session,WORKSPACE_EVENT.MASTER_SELECTED,event.target.value); });
    var companySelect=view.querySelector('#platformCompanySelect');
    if(companySelect) companySelect.addEventListener('change',async function(event){ if(!confirmDiscardEntitlements(view)){ event.target.value=state.companyFn; return; } await renderWorkspace(state.session,WORKSPACE_EVENT.COMPANY_SELECTED,event.target.value); });
    var openCompanyCreate=view.querySelector('#platformOpenCompanyCreate');
    if(openCompanyCreate) openCompanyCreate.addEventListener('click',async function(){ if(!confirmDiscardEntitlements(view)) return; await renderWorkspace(state.session,WORKSPACE_EVENT.COMPANY_CREATE_OPENED); });
    var cancelCompanyCreate=view.querySelector('#platformCancelCompanyCreate');
    if(cancelCompanyCreate) cancelCompanyCreate.addEventListener('click',async function(){ await renderWorkspace(state.session,WORKSPACE_EVENT.COMPANY_CREATE_CANCELLED); });
    var createMaster=view.querySelector('#platformCreateMasterForm');
    if(createMaster) createMaster.addEventListener('submit',async function(event){
      event.preventDefault(); var error=view.querySelector('#platformCreateMasterError'); var button=view.querySelector('#platformCreateMasterAction')||createMaster.querySelector('button[type="submit"]'); error.textContent=''; button.disabled=true;
      try{
        var modules=Array.from(createMaster.querySelectorAll('[data-provision-module]')).map(function(input){ return {moduleKey:input.dataset.provisionModule,enabled:input.checked,defaultCompanyAllocated:input.checked}; });
        await request('masters',{method:'POST',headers:{'Idempotency-Key':stableIdempotencyKey('master','',createMaster)},body:{name:createMaster.querySelector('#provisionMasterName').value.trim(),loginCode:createMaster.querySelector('#provisionMasterLoginCode').value.trim(),modules:modules}});
        await renderWorkspace(state.session,WORKSPACE_EVENT.MASTER_CREATED);
      }catch(errorValue){ error.textContent=errorValue&&errorValue.message||pt('error.masterCreationFailed','Master creation failed.'); button.disabled=false; if(typeof error.focus==='function') error.focus({preventScroll:true}); }
    });
    var createCompany=view.querySelector('#platformCreateCompanyForm');
    if(createCompany) createCompany.addEventListener('submit',async function(event){
      event.preventDefault(); var error=view.querySelector('#platformCreateCompanyError'); var button=view.querySelector('#platformCreateCompanyAction')||createCompany.querySelector('button[type="submit"]'); error.textContent=''; button.disabled=true;
      try{
        var body={name:createCompany.querySelector('#provisionCompanyName').value.trim(),country:createCompany.querySelector('#provisionCompanyCountry').value,companyOwner:{name:createCompany.querySelector('#provisionCompanyOwnerName').value.trim(),username:createCompany.querySelector('#provisionCompanyOwnerUsername').value.trim(),email:createCompany.querySelector('#provisionCompanyOwnerEmail').value.trim(),password:createCompany.querySelector('#provisionCompanyOwnerPassword').value}};
        var masterAdminName=createCompany.querySelector('#provisionMasterAdminName');
        if(masterAdminName) body.masterAdmin={name:masterAdminName.value.trim(),username:createCompany.querySelector('#provisionMasterAdminUsername').value.trim(),email:createCompany.querySelector('#provisionMasterAdminEmail').value.trim(),password:createCompany.querySelector('#provisionMasterAdminPassword').value};
        var createdCompany=await request('masters/'+encodeURIComponent(state.masterFn)+'/companies',{method:'POST',headers:{'Idempotency-Key':stableIdempotencyKey('company',state.masterFn,createCompany)},body:body});
        await renderWorkspace(state.session,WORKSPACE_EVENT.COMPANY_CREATED,createdCompany);
      }catch(errorValue){ error.textContent=errorValue&&errorValue.message||pt('error.companyCreationFailed','Company creation failed.'); button.disabled=false; if(typeof error.focus==='function') error.focus({preventScroll:true}); }
    });
    view.querySelectorAll('.platform-entitlement-tab').forEach(function(button){
      button.addEventListener('click',function(){ activateEntitlementTab(view,button.dataset.tab,true); });
      button.addEventListener('keydown',function(event){
        var tabs=Array.from(view.querySelectorAll('.platform-entitlement-tab'));
        var index=tabs.indexOf(button); var next;
        if(event.key==='ArrowRight') next=(index+1)%tabs.length;
        else if(event.key==='ArrowLeft') next=(index-1+tabs.length)%tabs.length;
        else if(event.key==='Home') next=0;
        else if(event.key==='End') next=tabs.length-1;
        else return;
        event.preventDefault(); activateEntitlementTab(view,tabs[next].dataset.tab,true);
      });
    });
    view.querySelectorAll('.platform-module-search').forEach(function(input){ input.addEventListener('input',function(){ state.entitlementSearch[input.dataset.entitlementTab]=input.value; filterEntitlementPanel(view,input.dataset.entitlementTab); }); });
    view.querySelectorAll('.platform-module-filter').forEach(function(select){ select.addEventListener('change',function(){ state.entitlementFilter[select.dataset.entitlementTab]=select.value; filterEntitlementPanel(view,select.dataset.entitlementTab); }); });
    view.querySelectorAll('.platform-master-enabled,.platform-master-default').forEach(function(input){ input.addEventListener('change',function(){ var row=input.closest('tr'); syncEntitlementRow(row,'master',true); updateEntitlementSummaries(view); filterEntitlementPanel(view,'master'); }); });
    view.querySelectorAll('.platform-company-allocated').forEach(function(input){ input.addEventListener('change',function(){ var row=input.closest('tr'); syncEntitlementRow(row,'company',true); updateEntitlementSummaries(view); filterEntitlementPanel(view,'company'); }); });
    view.querySelectorAll('.platform-reset-master,.platform-reset-company').forEach(function(button){ button.addEventListener('click',function(){ var type=button.classList.contains('platform-reset-master')?'master':'company'; resetEntitlementRow(button.closest('tr'),type); updateEntitlementSummaries(view); filterEntitlementPanel(view,type); }); });
    view.querySelectorAll('.platform-save-master').forEach(function(button){ button.addEventListener('click',async function(){
      var row=button.closest('tr'); var errorTarget=row.querySelector('.platform-row-error'); var feedback=row.querySelector('.platform-row-feedback'); var reload=row.querySelector('.platform-reload-master');
      button.disabled=true; errorTarget.textContent=''; feedback.textContent=pt('action.saving','Saving…'); reload.hidden=true;
      try{
        var result=await request('masters/'+encodeURIComponent(state.masterFn)+'/modules/'+encodeURIComponent(row.dataset.module),{method:'PATCH',body:{enabled:row.querySelector('.platform-master-enabled').checked,defaultCompanyAllocated:row.querySelector('.platform-master-default').checked,expectedVersion:Number(row.dataset.version)}});
        applyMasterServerRow(row,result||{}); feedback.textContent=pt('action.saved','Saved'); updateEntitlementSummaries(view); filterEntitlementPanel(view,'master'); feedback.focus({preventScroll:true});
      }catch(error){ feedback.textContent=''; errorTarget.textContent=Number(error&&error.status)===409?pt('error.moduleChanged','This module changed elsewhere. Review your values or reload the row.'):error&&error.message||pt('error.moduleUpdateFailed','Module update failed.'); reload.hidden=Number(error&&error.status)!==409; syncEntitlementRow(row,'master',false); errorTarget.focus({preventScroll:true}); }
    }); });
    view.querySelectorAll('.platform-save-company').forEach(function(button){ button.addEventListener('click',async function(){
      var row=button.closest('tr'); var errorTarget=row.querySelector('.platform-row-error'); var feedback=row.querySelector('.platform-row-feedback'); var reload=row.querySelector('.platform-reload-company');
      button.disabled=true; errorTarget.textContent=''; feedback.textContent=pt('action.saving','Saving…'); reload.hidden=true;
      try{
        var result=await request('masters/'+encodeURIComponent(state.masterFn)+'/companies/'+encodeURIComponent(state.companyFn)+'/modules/'+encodeURIComponent(row.dataset.module),{method:'PATCH',body:{allocated:row.querySelector('.platform-company-allocated').checked,expectedVersion:Number(row.dataset.version)}});
        applyCompanyServerRow(row,result||{}); feedback.textContent=pt('action.saved','Saved'); updateEntitlementSummaries(view); filterEntitlementPanel(view,'company'); feedback.focus({preventScroll:true});
      }catch(error){ feedback.textContent=''; errorTarget.textContent=Number(error&&error.status)===409?pt('error.allocationChanged','This allocation changed elsewhere. Review your value or reload the row.'):error&&error.message||pt('error.companyAllocationUpdateFailed','Company allocation update failed.'); reload.hidden=Number(error&&error.status)!==409; syncEntitlementRow(row,'company',false); errorTarget.focus({preventScroll:true}); }
    }); });
    view.querySelectorAll('.platform-reload-master,.platform-reload-company').forEach(function(button){ button.addEventListener('click',async function(){
      var type=button.classList.contains('platform-reload-master')?'master':'company'; var row=button.closest('tr'); var errorTarget=row.querySelector('.platform-row-error');
      button.disabled=true;
      try{ await reloadEntitlementRow(view,row,type); row.querySelector('.platform-row-feedback').textContent=pt('action.currentValuesLoaded','Current server values loaded.'); }
      catch(error){ errorTarget.textContent=error&&error.message||pt('error.reloadFailed','Unable to reload this module.'); errorTarget.focus({preventScroll:true}); }
      finally{ button.disabled=false; }
    }); });
    filterEntitlementPanel(view,'master'); filterEntitlementPanel(view,'company'); updateEntitlementSummaries(view);
    var simulationButton=view.querySelector('#platformStartSimulation');
    if(simulationButton) simulationButton.addEventListener('click',async function(event){
      if(!confirmDiscardEntitlements(view)) return;
      var target=Number(view.querySelector('#platformSimulationTarget').value); var button=event.currentTarget;
      if(!Number.isSafeInteger(target)||target<=0){ setError(pt('error.selectActiveUser','Select an active tenant user.')); return; }
      button.disabled=true; setError('');
      try{ await request('simulations',{method:'POST',body:{masterFn:state.masterFn,companyFn:state.companyFn,targetUserId:target}}); location.reload(); }
      catch(error){ setError(error&&error.message||pt('error.simulationFailed','Unable to enter tenant simulation.')); button.disabled=false; }
    });
    var tenantAccessButton=view.querySelector('#platformStartTenantAccess');
    if(tenantAccessButton) tenantAccessButton.addEventListener('click',async function(event){
      if(!confirmDiscardEntitlements(view)) return;
      var reason=view.querySelector('#platformTenantAccessReason').value.trim();
      var ticketReference=view.querySelector('#platformTenantAccessTicket').value.trim();
      var button=event.currentTarget;
      if(!reason||!ticketReference){ setError(pt('error.accessFieldsRequired','Access reason and ticket reference are required.')); return; }
      button.disabled=true; setError('');
      try{ await request('tenant-access',{method:'POST',body:{masterFn:state.masterFn,companyFn:state.companyFn,reason:reason,ticketReference:ticketReference}}); cachedSession=null; location.reload(); }
      catch(error){ setError(error&&error.message||pt('error.adminWorkspaceFailed','Unable to open the Platform Admin tenant workspace.')); button.disabled=false; }
    });
  }
  async function returnFromSimulation(){
    var session=await getSession();
    var path=session&&session.tenantAccess?'tenant-access/actions/return':'simulations/actions/return';
    await request(path,{method:'POST',body:{}}); cachedSession=null; location.reload();
  }
  async function syncSimulationBanner(){
    var session=await getSession();
    if(!session||(!session.simulation&&!session.tenantAccess)) return;
    var banner=document.getElementById('impersonationBanner');
    if(!banner) return;
    banner.hidden=false;
    if(session.simulation){
      var target=session.simulation.target||{};
      banner.classList.remove('platform-admin-active');
      banner.innerHTML=`<div class="impersonation-copy"><span><b>${esc(pt('banner.employeeActive','Employee simulation active'))}</b><small>${esc(pt('banner.employeeDetail','Viewing as {user} · real Platform principal P-{principal} · exact tenant permissions only · expires {expires}',{user:target.fullName||target.username||pt('field.tenantUser','tenant user'),principal:session.principalId,expires:new Date(session.simulation.expiresAt).toLocaleTimeString()}))}</small></span></div><button class="impersonation-return" id="returnToPlatformWorkspaceBtn" type="button">${esc(pt('banner.return','Return to Platform workspace'))}</button>`;
    }else{
      var access=session.tenantAccess; var scopes=session.availableScopes||[];
      var masterOptions=scopes.map(function(item){ return `<option value="${esc(item.masterFn)}" ${item.masterFn===access.masterFn?'selected':''}>${esc(item.name)} (${esc(item.masterFn)})</option>`; }).join('');
      var selectedMaster=scopes.find(function(item){ return item.masterFn===access.masterFn; });
      var companyOptions=((selectedMaster&&selectedMaster.companies)||[]).map(function(item){ return `<option value="${esc(item.companyFn)}" ${item.companyFn===access.companyFn?'selected':''}>${esc(item.name)} (${esc(item.companyFn)})</option>`; }).join('');
      var principal=access.actingPrincipal||{}; var unlocked=access.breakGlass&&new Date(access.breakGlass.expiresAt)>new Date();
      banner.classList.add('platform-admin-active');
      var principalId=principal.platformPrincipalId||session.principalId;
      var adminDetail=pt('banner.adminDetail','{name} · {master} / {company} · expires {expires}',{name:principal.displayName||session.displayName||pt('simulation.openAdminTitle','Platform Admin'),master:access.masterFn,company:access.companyFn,expires:new Date(access.expiresAt).toLocaleTimeString()});
      if(unlocked) adminDetail+=' · '+pt('banner.sensitiveUntil','sensitive writes unlocked until {expires}',{expires:new Date(access.breakGlass.expiresAt).toLocaleTimeString()});
      banner.innerHTML=`<div class="impersonation-copy"><span><b>${esc(pt('banner.adminActive','Platform Admin active · P-{principal}',{principal:principalId}))}</b><small>${esc(adminDetail)}</small></span><span class="platform-admin-banner-error" id="platformTenantAccessError" role="alert"></span></div><div class="platform-admin-scope"><label><span>${esc(pt('field.master','Master'))}</span><select id="platformTenantMasterSwitch">${masterOptions}</select></label><label><span>${esc(pt('field.company','Company'))}</span><select id="platformTenantCompanySwitch">${companyOptions}</select></label></div><button class="impersonation-return platform-break-glass-button" id="platformBreakGlassBtn" type="button">${esc(unlocked?pt('banner.sensitiveUnlocked','Sensitive writes unlocked'):pt('banner.unlock','Unlock for 15 minutes'))}</button><button class="impersonation-return" id="returnToPlatformWorkspaceBtn" type="button">${esc(pt('banner.returnShort','Return'))}</button>`;
      var masterSwitch=banner.querySelector('#platformTenantMasterSwitch'); var companySwitch=banner.querySelector('#platformTenantCompanySwitch');
      var bannerError=banner.querySelector('#platformTenantAccessError');
      function showBannerError(error){ if(bannerError) bannerError.textContent=error&&error.message||String(error||pt('error.tenantAccessUpdateFailed','Unable to update Platform tenant access.')); }
      async function switchScope(masterFn,companyFn){
        if(masterSwitch) masterSwitch.disabled=true; if(companySwitch) companySwitch.disabled=true; showBannerError('');
        try{ await request('tenant-access/actions/switch-scope',{method:'POST',body:{masterFn:masterFn,companyFn:companyFn}}); cachedSession=null; location.reload(); }
        catch(error){ if(masterSwitch) masterSwitch.disabled=false; if(companySwitch) companySwitch.disabled=false; showBannerError(error); }
      }
      if(masterSwitch) masterSwitch.addEventListener('change',function(){ var targetMaster=scopes.find(function(item){ return item.masterFn===masterSwitch.value; }); var first=(targetMaster&&targetMaster.companies||[])[0]; if(first) switchScope(masterSwitch.value,first.companyFn); });
      if(companySwitch) companySwitch.addEventListener('change',function(){ switchScope(access.masterFn,companySwitch.value); });
      var unlock=banner.querySelector('#platformBreakGlassBtn');
      if(unlock) unlock.addEventListener('click',async function(){
        if(unlocked) return;
        var reason=window.prompt(pt('prompt.breakGlassReason','Reason for sensitive mutation access')); if(!reason) return;
        var ticket=window.prompt(pt('prompt.ticketReference','Ticket reference')); if(!ticket) return;
        unlock.disabled=true;
        try{ await request('tenant-access/actions/break-glass',{method:'POST',body:{reason:reason,ticketReference:ticket}}); cachedSession=null; location.reload(); }
        catch(error){ unlock.disabled=false; showBannerError(error&&error.message||pt('error.breakGlassFailed','Unable to unlock sensitive mutations.')); }
      });
    }
    banner.querySelector('#returnToPlatformWorkspaceBtn').addEventListener('click',async function(event){
      event.currentTarget.disabled=true;
      try{ await returnFromSimulation(); }catch(error){ event.currentTarget.disabled=false; var alert=banner.querySelector('#platformTenantAccessError'); if(alert) alert.textContent=error&&error.message||pt('error.returnFailed','Unable to return to the Platform workspace.'); else setError(error&&error.message||pt('error.returnFailed','Unable to return to the Platform workspace.')); }
    });
  }
  // A tenant-shell sign-out while simulated must end the platform session, not
  // leave the browser silently inside the target user's workspace.
  document.addEventListener('click',function(event){
    var signout=event.target&&event.target.closest&&event.target.closest('[data-acct="signout"]');
    if(!signout||!cachedSession||(!cachedSession.simulation&&!cachedSession.tenantAccess)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    request('logout',{method:'POST',body:{}}).finally(function(){ cachedSession=null; location.reload(); });
  },true);

  function tenantMode(){ return cachedSession&&cachedSession.simulation?'employee':cachedSession&&cachedSession.tenantAccess?'platform_admin':null; }
  window.ErpPlatformWorkspace={getSession:getSession,getSetupStatus:getSetupStatus,renderBootstrap:renderBootstrap,renderLogin:renderLogin,renderWorkspace:renderWorkspace,syncSimulationBanner:syncSimulationBanner,returnFromSimulation:returnFromSimulation,tenantMode:tenantMode};
})();
