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
