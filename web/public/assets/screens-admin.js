/* ============================================================
   ARIA ERP — screens: Admin
   (User Management, Audit Log, System Settings)
   ============================================================ */

function userStatusTone(s){ return {Active:'ok',Invited:'info',Disabled:'neutral'}[s]||'neutral'; }
function auditTypeTone(t,ok){
  if(!ok) return 'danger';
  return {approval:'accent',post:'teal',export:'violet',edit:'info',security:'neutral',permission:'warn',create:'ok',system:'neutral',config:'warn'}[t]||'neutral';
}

/* ---------------- USER MANAGEMENT (listing — module landing) ---------------- */
SCREENS['user-mgmt'] = function(root){
  let filter='all';
  const roles=[...new Set(DB.adminUsers.map(u=>u.role))];
  const chips=[['all',t('common.all')]].concat(roles.map(r=>[r,r]));
  function rows(){ return filter==='all'?DB.adminUsers:DB.adminUsers.filter(u=>u.role===filter); }
  function table(){
    return buildTable({
      rowId:u=>u.id,
      columns:[
        {label:t('usr.col.user'),render:u=>`<div style="display:flex;align-items:center;gap:11px"><span class="kc-av" style="background:${u.clr};width:30px;height:30px;font-size:11px">${esc(u.av)}</span><div class="cellsub"><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div></div>`},
        {label:t('hr.col.role'),align:'l',render:u=>esc(u.role)},
        {label:'MFA',align:'l',render:u=>u.mfa?cap(t('usr.mfa.on'),'ok'):cap(t('usr.mfa.off'),'warn')},
        {label:t('usr.col.lastactive'),align:'l',render:u=>esc(u.last)},
        {label:t('col.status'),align:'l',render:u=>cap(ts(u.status),userStatusTone(u.status))},
        {label:'',align:'c',render:u=>`<span class="rowact"><button data-tip="${esc(t('usr.perm'))}" data-act="perm">${ic('shield')}</button><button data-tip="${esc(t('usr.more'))}">${ic('more')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const active=DB.adminUsers.filter(u=>u.status==='Active').length;
  const invited=DB.adminUsers.filter(u=>u.status==='Invited').length;
  const mfaPct=Math.round(DB.adminUsers.filter(u=>u.mfa).length/DB.adminUsers.length*100);
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:23px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,t('nav.admin'),t('usr.crumb')])}
      <div class="h1row"><h1>${esc(t('usr.title'))}</h1><span class="countchip" id="usrCount"></span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile(t('usr.t.total'),DB.adminUsers.length,t('usr.t.totalsub'))}
      ${statTile(t('usr.t.active'),active,t('usr.t.activesub'),'var(--ok)')}
      ${statTile(t('usr.t.invites'),invited,t('usr.t.invitessub'),'var(--warn)')}
      ${statTile(t('usr.t.mfa'),mfaPct+'%',mfaPct<90?t('usr.t.mfa.enforce'):t('usr.t.mfa.met'),mfaPct<90?'var(--warn)':'var(--ok)')}
    </div></div>
    <div class="toolbar">
      <div class="filterchips" id="usrChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('usr.rolestip'))}" onclick="navigate('role-permission')">${ic('shield')}${esc(t('usr.roles'))}</button>
      <button class="viewsel" data-tip="${esc(t('usr.audit'))}" onclick="navigate('audit-log')">${ic('history')}${esc(t('usr.audit'))}</button>
      ${btn(t('usr.invite'),{icon:'plus',cls:'primary',attrs:'data-act="invite"'})}
    </div>
    <div class="tablewrap" id="usrTable">${table()}</div>
  </section></div>`;
  $('#usrCount').textContent=rows().length+' '+t('usr.users');
  function rewire(){
    wireTable($('#usrTable'),{ onRow:(id)=>navigate('role-permission') });
    $('#usrTable').querySelectorAll('[data-act="perm"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();navigate('role-permission');}));
  }
  rewire();
  $('#usrChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ $('#usrChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f; $('#usrTable').innerHTML=table(); $('#usrCount').textContent=rows().length+' '+t('usr.users'); rewire(); }));
  root.querySelector('[data-act="invite"]').addEventListener('click',()=>{
    appModal({ icon:'people', title:t('usr.invite'),
      body:`<div class="fld"><span>${esc(t('usr.m.email'))}</span><input placeholder="name@northwind.co"></div>
        <div class="fldrow c2" style="margin-top:4px"><div class="fld"><span>${esc(t('hr.col.role'))}</span><select>${[...new Set(DB.adminUsers.map(u=>u.role))].map(r=>`<option>${esc(r)}</option>`).join('')}</select></div><div class="fld"><span>${esc(t('usr.m.companies'))}</span><select><option>${esc(t('usr.m.allco'))}</option><option>Northwind Mfg only</option></select></div></div>
        <label style="display:flex;align-items:center;gap:9px;padding:10px 0 2px;font-size:13px"><input type="checkbox" class="checkbox" checked style="flex:none"><span>${esc(t('usr.m.mfareq'))}</span></label>`,
      actions:`${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(t('usr.m.send'),{icon:'send',cls:'primary',attrs:'onclick="closeModal();toast(\'Invitation sent\',\'ok\')"'})}` });
  });
};

/* ---------------- AUDIT LOG (report) ---------------- */
SCREENS['audit-log'] = function(root){
  const failed=DB.auditLog.filter(l=>!l.ok).length;
  const tpl='80px minmax(130px,1.2fr) minmax(180px,1.7fr) minmax(140px,1.3fr) 110px 110px';
  let body='';
  DB.auditLog.forEach(l=>{
    body+=`<div class="dt-r logrow" data-detail="${esc(l.user)} · ${esc(l.ip)}">
      <div class="dt-c l mono" style="color:var(--muted);font-size:12px">${esc(l.t)}</div>
      <div class="dt-c l"><b style="font-weight:600">${esc(l.user)}</b></div>
      <div class="dt-c l">${esc(l.action)}</div>
      <div class="dt-c l mono" style="font-size:12px;color:${l.obj==='—'?'var(--faint)':'var(--accent)'}">${esc(l.obj)}</div>
      <div class="dt-c l">${cap(l.ok?l.type:'failed',auditTypeTone(l.type,l.ok))}</div>
      <div class="dt-c l mono" style="font-size:11.5px;color:var(--muted)">${esc(l.ip)}</div></div>`;
  });
  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Filters</h3>
      <div class="fld"><span>User</span><select><option>All users</option>${[...new Set(DB.auditLog.map(l=>l.user))].map(u=>`<option>${esc(u)}</option>`).join('')}</select></div>
      <div class="fld"><span>Action type</span><select><option>All types</option><option>Posting</option><option>Approval</option><option>Permission</option><option>Security</option><option>Export</option></select></div>
      <div class="fld"><span>Date range</span><select><option>Today</option><option>Last 7 days</option><option>This period</option></select></div>
      <div class="fld"><span>Result</span><select><option>All</option><option>Success</option><option>Failed</option></select></div>
      ${btn('Apply filters',{icon:'filter',cls:'primary',sm:false,attrs:'onclick="toast(\'Filters applied\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">
        ${failed?`<div class="indicator danger"><div class="ind-top">${ic('warn')}<span>Security events</span><span class="ind-r">${failed}</span></div><small>1 failed login from an unrecognised IP — review.</small></div>`:''}
      </div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Audit Trail</b><div class="report-meta">Today · ${DB.auditLog.length} events · ${failed} failed · immutable system log</div></div>
        <div class="grow"></div>
        ${btn('Export',{icon:'download',cls:'soft'})}${btn('Users',{icon:'people',cls:'soft',attrs:'onclick="navigate(\'user-mgmt\')"'})}
      </div>
      <div class="tablewrap"><div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
        <div class="dt-r dt-head"><div class="dt-c l">Time</div><div class="dt-c l">User</div><div class="dt-c l">Action</div><div class="dt-c l">Object</div><div class="dt-c l">Type</div><div class="dt-c l">IP</div></div>
        <div class="dt-body">${body}</div>
      </div></div></div>
    </div>
  </div></section></div>`;
};

/* ---------------- SYSTEM SETTINGS (config) ---------------- */
SCREENS['sys-settings'] = function(root){
  const numRows=DB.numbering.map(n=>`<tr>
    <td class="l li-name"><b>${esc(n.doc)}</b></td>
    <td class="l mono" style="font-size:12px">${esc(n.format)}</td>
    <td class="tnum">${n.next}</td>
    <td class="l">${esc(n.reset)}</td>
    <td class="l"><button class="btn plain sm" onclick="toast('Edit sequence — ${esc(n.doc)}','info')">${ic('edit')}</button></td></tr>`).join('');
  const taxRows=DB.taxCodes.map(t=>`<tr>
    <td class="l li-name"><b>${esc(t.code)}</b><small>${esc(t.name)}</small></td>
    <td class="tnum">${t.rate.toFixed(1)}%</td>
    <td class="l">${esc(t.type)}</td>
    <td class="l">${cap(t.status,'ok')}</td></tr>`).join('');
  const curRows=DB.currencies.map(c=>`<tr>
    <td class="l li-name"><b>${esc(c.code)}</b><small>${esc(c.name)}</small></td>
    <td class="tnum">${c.base?'—':c.rate.toFixed(4)}</td>
    <td class="l">${c.base?cap('Base','accent'):'<span style="color:var(--muted)">vs USD</span>'}</td></tr>`).join('');

  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:980px">
    ${crumbs([DB.company.name,'Admin','System Settings'])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('gear')}System Settings</div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">Numbering · tax · currency · company configuration</div></div>
        <div class="dactions"><a class="btn soft sm" href="Database Workbench.html" target="_blank" rel="noopener" data-tip="Open in-browser Postgres">${ic('grid')}<span>Database workbench</span></a><span class="env" style="position:static">PRODUCTION</span></div></div>
      <div class="docmeta">
        <div class="dm"><small>Company</small><b>${esc(DB.company.name)}</b></div>
        <div class="dm"><small>Base currency</small><b>USD</b></div>
        <div class="dm"><small>Fiscal year</small><b>FY2026 · Jan–Dec</b></div>
        <div class="dm"><small>Current period</small><b>P06 · June · Open</b></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h"><h3>Document numbering</h3><div class="ph-act">${btn('Add sequence',{icon:'plus',cls:'plain',attrs:'onclick="toast(\'New numbering sequence\',\'info\')"'})}</div></div>
      <table class="lines"><thead><tr><th class="l">Document</th><th class="l">Format</th><th>Next no.</th><th class="l">Reset</th><th class="l"></th></tr></thead><tbody>${numRows}</tbody></table>
    </div>
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h"><h3>Tax codes</h3><div class="ph-act">${btn('Add tax code',{icon:'plus',cls:'plain',attrs:'onclick="toast(\'New tax code\',\'info\')"'})}</div></div>
      <table class="lines"><thead><tr><th class="l">Code</th><th>Rate</th><th class="l">Type</th><th class="l">Status</th></tr></thead><tbody>${taxRows}</tbody></table>
    </div>
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h"><h3>Currencies &amp; FX rates</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">auto-updated daily · CIMB feed</span></div>
      <table class="lines"><thead><tr><th class="l">Currency</th><th>Rate</th><th class="l">Role</th></tr></thead><tbody>${curRows}</tbody></table>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>General</h3></div>
      <div class="panel-body">
        <div class="fldrow c3">
          <div class="fld"><span>Company name</span><input value="${esc(DB.company.name)}"></div>
          <div class="fld"><span>Default warehouse</span><input value="KL-Main"></div>
          <div class="fld"><span>Date format</span><select><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option></select></div>
        </div>
        <div class="fldrow c3" style="margin-top:4px">
          <div class="fld"><span>Negative stock</span><select><option>Block</option><option>Allow with warning</option></select></div>
          <div class="fld"><span>Approval threshold</span><input value="$50,000"></div>
          <div class="fld"><span>Session timeout</span><select><option>30 minutes</option><option>1 hour</option><option>4 hours</option></select></div>
        </div>
      </div>
    </div>
    <div style="height:50px"></div>
  </div></div>
  <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
    <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Changes are logged to the audit trail.</div>
    <div class="grow"></div>
    ${btn('Discard',{cls:'soft',attrs:'onclick="toast(\'Changes discarded\',\'info\')"'})}
    ${btn('Save settings',{icon:'check',cls:'primary',sm:false,attrs:'onclick="toast(\'Settings saved · audit entry created\',\'ok\')"'})}
  </div>
  </section></div>`;
};

/* ---------------- MODULE ACTIVATION CONTROL (master/client module toggles) ---------------- */
SCREENS['module-activation-control'] = function(root){
  if(!isModuleAdmin()){
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,'Admin','Module Activation Control'])}
        <div class="h1row"><h1>Module Activation Control</h1>${cap('Admin only','warn')}</div>
      </div>
      ${statePanel({icon:'lock',title:'Admin access required',body:'Only Admin and Superadmin accounts can manage client module activation.'})}
    </section></div>`;
    return;
  }

  let cfg=readModuleControl();
  const rows=()=>moduleControlItems();
  const activeCount=()=>rows().filter(m=>cfg[m.id]&&cfg[m.id].active).length;
  const visibleCount=()=>rows().filter(m=>cfg[m.id]&&cfg[m.id].visible).length;
  const rowTone=m=>{
    const st=cfg[m.id]||{visible:true,active:true};
    if(!st.visible) return 'neutral';
    if(!st.active) return 'warn';
    return 'ok';
  };
  const statusLabel=m=>{
    const st=cfg[m.id]||{visible:true,active:true};
    if(!st.visible) return 'Hidden';
    if(!st.active) return 'Inactive';
    return 'Active';
  };
  function persist(message){
    writeModuleControl(cfg);
    renderSidebar();
    renderTabbar();
    setActiveNav(CURRENT_ROUTE);
    toast(message||'Module activation updated','ok');
  }
  function table(){
    const body=rows().map(m=>{
      const st=cfg[m.id]||{visible:true,active:true};
      return `<tr data-module="${esc(m.id)}">
        <td class="l li-name"><b>${ic(m.icon)} ${esc(m.label)}</b><small>${esc(m.group)} · ${esc(m.route)}${m.required?' · required':''}</small></td>
        <td class="l mono">${esc(currentMasterFn())}</td>
        <td class="c"><input class="checkbox" type="checkbox" data-toggle="visible" ${st.visible?'checked':''} ${m.required?'disabled':''} aria-label="Show ${esc(m.label)}"></td>
        <td class="c"><input class="checkbox" type="checkbox" data-toggle="active" ${st.active?'checked':''} ${(!st.visible||m.required)?'disabled':''} aria-label="Activate ${esc(m.label)}"></td>
        <td class="l">${cap(statusLabel(m),rowTone(m))}</td>
        <td class="c">${m.required?cap('Required','accent'):btn('Open',{icon:'ext',cls:'plain',attrs:`data-open="${esc(m.route)}"`})}</td>
      </tr>`;
    }).join('');
    return `<table class="lines"><thead><tr><th class="l">Module</th><th class="l">Master FN</th><th class="c">Show</th><th class="c">Active</th><th class="l">Status</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
  }
  function render(){
    root.innerHTML=`<div class="content full"><section class="master"><div class="scrollarea">
      <div class="pagehead">
        ${crumbs([DB.company.name,'Admin','Module Activation Control'])}
        <div class="h1row"><h1>Module Activation Control</h1><span class="acct-role" style="font-size:11px">${ic('shield')}${esc(DB.user.role)}</span>
          <div class="headright">
            <div class="kfig"><small>Master FN</small><b class="tnum">${esc(currentMasterFn())}</b></div>
            <div class="kfig"><small>Shown</small><b class="tnum">${visibleCount()}/${rows().length}</b></div>
            <div class="kfig"><small>Active</small><b class="tnum">${activeCount()}/${rows().length}</b></div>
          </div></div>
        <div class="h1sub">Control which ERP modules are visible and active for the current master/client. Hidden modules disappear from navigation; inactive modules remain visible but cannot be opened.</div>
      </div>
      <div class="toolbar">
        ${btn('Show all',{icon:'eye',cls:'soft',attrs:'data-act="show-all"'})}
        ${btn('Activate all',{icon:'checkc',cls:'soft',attrs:'data-act="activate-all"'})}
        ${btn('Reset defaults',{icon:'refresh',cls:'soft',attrs:'data-act="reset"'})}
        <div class="grow"></div>
        ${cap('Saved locally for demo','info')}
      </div>
      <div class="panel" style="margin:0 24px 24px">
        <div class="panel-h"><h3>Client module matrix</h3><span style="margin-left:auto;color:var(--muted);font-size:12px">Applies to ${esc(DB.company.name)}</span></div>
        ${table()}
      </div>
    </div></section></div>`;

    root.querySelectorAll('[data-toggle]').forEach(input=>input.addEventListener('change',()=>{
      const id=input.closest('[data-module]').dataset.module;
      const item=rows().find(m=>m.id===id);
      if(!item||item.required) return;
      cfg[id]=cfg[id]||{visible:true,active:true};
      if(input.dataset.toggle==='visible'){
        cfg[id].visible=input.checked;
        cfg[id].active=input.checked;
      }else{
        cfg[id].active=input.checked;
      }
      render();
      persist(`${item.label} set to ${statusLabel(item).toLowerCase()}`);
    }));
    root.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.open)));
    root.querySelector('[data-act="show-all"]').addEventListener('click',()=>{
      rows().forEach(m=>{ cfg[m.id]=cfg[m.id]||{visible:true,active:true}; cfg[m.id].visible=true; });
      render(); persist('All modules shown');
    });
    root.querySelector('[data-act="activate-all"]').addEventListener('click',()=>{
      rows().forEach(m=>{ cfg[m.id]=cfg[m.id]||{visible:true,active:true}; cfg[m.id].visible=true; cfg[m.id].active=true; });
      render(); persist('All modules activated');
    });
    root.querySelector('[data-act="reset"]').addEventListener('click',()=>{
      cfg=defaultModuleControl();
      render(); persist('Module activation reset to defaults');
    });
  }
  render();
};
