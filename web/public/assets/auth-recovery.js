/* Tenant email recovery. Bearer links are never persisted in browser storage. */
(function tenantRecovery(){
  if(typeof window.erpDataMode!=='function'||window.erpDataMode()!=='api') return;
  var base=new URL(window.__ERP_API_BASE__||'/api',location.href).pathname.replace(/\/$/,'');
  var home=base.replace(/\/api$/,'')+'/';
  var path=home+'reset-password';
  var active=location.pathname===path;
  var token=active?new URLSearchParams(location.hash.slice(1)).get('token')||'':'';
  if(active) history.replaceState(null,'',path);
  function label(key){ return window.tf('recovery.'+key,key); }
  function escape(value){ return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function render(){
    active=true;
    history.replaceState(null,'',path);
    setAuthShell(true);
    try{applyTheme(localStorage.getItem('aria-theme')==='dark'?'dark':'light');}catch{applyTheme('light');}
    var view=document.getElementById('authView');
    if(!view){view=document.createElement('main');view.id='authView';view.className='auth-view';document.body.insertBefore(view,document.getElementById('app'));}
    var confirming=Boolean(token);
    view.setAttribute('aria-label',label('title'));
    view.innerHTML='<section class="auth-panel"><div class="auth-copy"><h1>'+escape(label('title'))+'</h1><p>'+escape(label('scope'))+'</p></div>'+
      '<form class="auth-form" id="recoveryForm">'+(confirming?
        '<label class="fld" for="recoveryPassword"><span>'+escape(label('password'))+'</span><input id="recoveryPassword" type="password" autocomplete="new-password" minlength="8" maxlength="256" required></label>'+
        '<label class="fld" for="recoveryConfirm"><span>'+escape(label('confirm'))+'</span><input id="recoveryConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="256" required></label>':
        '<label class="fld" for="recoveryEmail"><span>'+escape(label('email'))+'</span><input id="recoveryEmail" type="email" autocomplete="email" maxlength="254" required></label>')+
      '<div id="recoveryStatus" role="status" tabindex="-1"></div><button class="btn primary lg" id="recoverySubmit" type="submit">'+escape(label(confirming?'save':'send'))+'</button></form>'+
      '<a class="btn soft lg" href="'+escape(home)+'">'+escape(label('back'))+'</a></section>';
    var form=view.querySelector('#recoveryForm');
    var status=view.querySelector('#recoveryStatus');
    var button=view.querySelector('#recoverySubmit');
    form.querySelector('input').focus();
    form.addEventListener('submit',async function(event){
      event.preventDefault();
      if(button.disabled) return;
      status.textContent='';
      var password=confirming?form.querySelector('#recoveryPassword').value:'';
      if(confirming&&password!==form.querySelector('#recoveryConfirm').value){status.textContent=label('mismatch');status.focus();return;}
      button.disabled=true;
      var controller=new AbortController();
      var timeout=setTimeout(function(){controller.abort();},15000);
      try{
        var response=await fetch(base+'/auth/password-reset/actions/'+(confirming?'confirm':'request'),{
          method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
          headers:{'content-type':'application/json'},
          body:JSON.stringify(confirming?{token:token,password:password}:{email:form.querySelector('#recoveryEmail').value}),
        });
        var result=await response.json();
        if(!response.ok){
          status.textContent=label(response.status===429?'limited':result.error&&result.error.code==='reset_invalid'?'invalid':'failed');
          button.disabled=false;
        }else if(confirming&&result.data&&result.data.ok===true){
          token='';form.reset();status.textContent=label('done');
        }else if(!confirming&&response.status===202&&result.data&&result.data.accepted===true){
          form.reset();status.textContent=label('accepted');
        }else{status.textContent=label('failed');button.disabled=false;}
      }catch{status.textContent=label('failed');button.disabled=false;}
      finally{clearTimeout(timeout);if(confirming){form.querySelector('#recoveryPassword').value='';form.querySelector('#recoveryConfirm').value='';}status.focus();}
    });
  }
  // Opening the email link in an existing recovery tab can be a fragment-only
  // navigation, so no document scripts or boot handler run again.
  window.addEventListener('hashchange',function(){
    if(location.pathname!==path) return;
    var incoming=new URLSearchParams(location.hash.slice(1)).get('token');
    if(!incoming) return;
    token=incoming;
    history.replaceState(null,'',path);
    render();
  });
  window.ErpTenantRecovery={isActive:function(){return active;},render:render};
})();
