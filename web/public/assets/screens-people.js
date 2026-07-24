/* ============================================================
   ARIA ERP — screens: HR Leave Approval, Admin Role Permission
   ============================================================ */

/* ---------------- HR LEAVE APPROVAL ---------------- */
SCREENS['leave-approval'] = async function(root){
  const s=hrCopy();
  const leaveStatusTone={pending:'warn',approved:'ok',rejected:'danger'};
  const leaveStatusLabel=st=>({pending:s('statusPending'),approved:s('statusApproved'),rejected:s('statusRejected')}[st]||st);
  let {employees,leaveRequests}=await prepareHrData();
  function empOf(lv){ return employees.find(e=>e.id===lv.employeeId)||{fullName:'—',department:'—'}; }
  let filter='pending';
  let selected=leaveRequests[0]&&leaveRequests[0].id;

  function rows(){ return filter==='all'?leaveRequests:leaveRequests.filter(l=>l.status===filter); }
  async function reload(){
    const fresh=await prepareHrData();
    employees=fresh.employees; leaveRequests=fresh.leaveRequests;
  }

  function render(){
    const pendingCount=leaveRequests.filter(l=>l.status==='pending').length;
    const pendingDays=leaveRequests.filter(l=>l.status==='pending').reduce((sum,l)=>sum+l.days,0);
    const list=rows();
    const sel=list.find(l=>l.id===selected)||list[0]||leaveRequests[0];
    selected=sel&&sel.id;
    const listCols=[
      {label:t('hr.col.employee'),align:'l',w:'minmax(190px,2fr)',render:l=>{ const e=empOf(l); return `<div style="display:flex;align-items:center;gap:10px;min-width:0">${profileAvatar({name:e.fullName,src:e.photoUrl||e.imageUrl||e.avatarUrl,cls:'cav',size:30})}<div class="cellsub"><b>${esc(e.fullName)}</b><small>${esc(e.department)}</small></div></div>`; }},
      {label:'Type',align:'l',render:l=>cap(l.leaveType,l.leaveType==='Medical'?'violet':l.leaveType==='Unpaid'?'neutral':'accent')},
      {label:s('colDates'),align:'l',w:'minmax(150px,1.4fr)',render:l=>`${esc(dateValue(l.startDate))} → ${esc(dateValue(l.endDate))}`},
      {label:'Days',align:'r',w:'70px',render:l=>l.days},
      {label:t('col.status'),align:'l',render:l=>cap(leaveStatusLabel(l.status),leaveStatusTone[l.status]||'neutral')},
    ];
    const table=list.length?buildTable({rowId:l=>l.id, columns:listCols, rows:list}):statePanel({icon:'calendar',title:s('noLeaveRequests'),body:''});

    const detail=sel?(()=>{
      const e=empOf(sel);
      const decided=sel.status!=='pending';
      return `
      <div class="detail-head">
        <span class="grabber"></span>
        <button class="close" onclick="document.getElementById('lvContent').classList.add('detail-collapsed');document.getElementById('lvDetail').classList.remove('open')">${ic('chevL')}Close</button>
        <div class="dh-top">${profileAvatar({name:e.fullName,src:e.photoUrl||e.imageUrl||e.avatarUrl,cls:'cav',size:42})}
          <div><h2>${esc(e.fullName)}</h2><span class="sub">${esc(e.department)} · ${esc(e.jobTitle||'')}</span></div>
          <div style="margin-left:auto">${cap(leaveStatusLabel(sel.status),leaveStatusTone[sel.status]||'neutral')}</div></div>
      </div>
      <div class="detail-body">
        <div class="statgrid c3"><div class="stat"><small>Requested</small><b>${sel.days}d</b></div></div>
        <div class="card">
          <div class="field"><span class="k">Leave type</span><span class="v">${esc(sel.leaveType)}</span></div>
          <div class="field"><span class="k">From</span><span class="v">${esc(dateValue(sel.startDate))}</span></div>
          <div class="field"><span class="k">To</span><span class="v">${esc(dateValue(sel.endDate))}</span></div>
          <div class="field"><span class="k">${esc(s('rejectReasonLabel'))}</span><span class="v">${sel.reason?esc(sel.reason):'—'}</span></div>
          ${sel.status==='rejected'?`<div class="field"><span class="k">${esc(s('rejectReasonLabel'))} (HR)</span><span class="v">${esc(sel.rejectionReason||'')}</span></div>`:''}
          ${decided&&sel.decidedAt?`<div class="field"><span class="k">Decided</span><span class="v">${esc(dateValue(sel.decidedAt))}</span></div>`:''}
        </div>
      </div>
      <div class="approvebar">
        ${btn(s('reject'),{icon:'x',cls:'danger',sm:false,attrs:decided?'disabled':`data-lv="reject"`})}
        ${btn(sel.status==='approved'?s('statusApproved'):s('approve'),{icon:'check',cls:sel.status==='approved'?'soft':'primary',sm:false,attrs:decided?'disabled':`data-lv="approve"`})}
      </div>`;
    })():'';

    root.innerHTML=`<div class="content" id="lvContent">
      <section class="master">
        <div class="pagehead">${crumbs([DB.company.name,t('nav.hr'),t('hr.leave')])}
          <div class="h1row"><h1>${esc(s('leaveApprovalTitle'))}</h1><span class="countchip">${pendingCount} ${esc(s('statusPending').toLowerCase())}</span>
            <div class="headright"><div class="kfig"><small>${esc(s('statusPending'))}</small><b class="tnum">${pendingDays}d</b></div></div></div>
        </div>
        <div class="toolbar"><div class="filterchips" id="lvChips">
          ${[['pending',s('statusPending')],['approved',s('statusApproved')],['rejected',s('statusRejected')],['all',s('filterAllStatus')]]
            .map(([v,l])=>`<button class="chip ${v===filter?'on':''}" data-f="${v}">${esc(l)}</button>`).join('')}
        </div>
          <div class="grow"></div>${btn(t('common.export'),{icon:'download',cls:'soft',attrs:'onclick="toast(\'Export — not in this build\',\'info\')"'})}</div>
        <div class="tablewrap" id="lvTable">${table}</div>
      </section>
      <aside class="detail open" id="lvDetail">${detail}</aside>
    </div>`;

    $('#lvTable').querySelectorAll('.dt-r[data-row]').forEach(tr=>{ tr.classList.toggle('sel',Number(tr.dataset.row)===selected); tr.addEventListener('click',()=>{ selected=Number(tr.dataset.row); render(); $('#lvContent').classList.remove('detail-collapsed'); }); });
    $('#lvChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ filter=c.dataset.f; selected=null; render(); }));
    const ap=root.querySelector('[data-lv="approve"]'); if(ap)ap.addEventListener('click',async()=>{
      ap.disabled=true;
      try{
        await window.ErpSystemData.action('hr/leave-requests',sel.id,'approve',{});
        await reload();
        toast(s('approvedToast').replace('{name}',empOf(sel).fullName),'ok');
        render();
      }catch{ toast(s('actionError'),'danger'); ap.disabled=false; }
    });
    const rj=root.querySelector('[data-lv="reject"]'); if(rj)rj.addEventListener('click',()=>{
      appModal({
        icon: 'xc',
        title: s('rejectTitle').replace('{name}',empOf(sel).fullName),
        body: `<div class="fld err"><span>${esc(s('rejectReasonLabel'))} <span class="req">*</span></span><textarea id="lvRejectReason" placeholder="${esc(s('rejectReasonPlaceholder'))}"></textarea><span class="hint bad">${esc(s('rejectReasonRequired'))}</span></div>`,
        actions: `${btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('reject'),{icon:'x',cls:'danger-solid',attrs:'data-save="1"'})}`,
      });
      $('#modalEl').querySelector('[data-save]').addEventListener('click', async()=>{
        const reason=$('#lvRejectReason').value.trim();
        if(!requireField(reason, s('rejectReasonRequired'), '#lvRejectReason')) return;
        try{
          await window.ErpSystemData.action('hr/leave-requests',sel.id,'reject',{rejectionReason:reason});
          closeModal();
          await reload();
          toast(s('rejectedToast').replace('{name}',empOf(sel).fullName),'danger');
          render();
        }catch{ toast(s('actionError'),'danger'); }
      });
    });
  }
  render();
};

/* ---------------- ADMIN ROLE PERMISSION (matrix) ----------------
   Mirrors the real backend model (src/auth/permissions.ts PERMISSIONS) rather
   than the mock's fabricated 4-level None/View/Edit/Full matrix: role_permission
   is a boolean per named key, so the real UI is an honest 2-state
   allowed/not-allowed toggle instead of forcing a 4th level nothing backs. */
const ADMIN_PERMISSION_KEYS=[
  'dashboard.read',
  'inventory.read','inventory.write','inventory.adjust','inventory.transfer','inventory.track',
  'sales.read','sales.write',
  'finance.read',
  'purchasing.read','purchasing.write',
  'crm.read','crm.write',
  'manufacturing.read','manufacturing.write',
  'quality.read','quality.write',
  'asset.read','asset.write',
  'session.switch_company',
  'admin.audit.read','admin.users.invite','admin.users.read','admin.users.manage',
  'admin.roles.read','admin.roles.write',
];

SCREENS['role-permission'] = async function(root){
  const s=adminCopy();
  let roles=(await listPage('admin/roles')).data;
  let grants=(await listPage('admin/role-permissions')).data;
  function grantMap(){
    const m=new Map();
    grants.forEach(g=>{
      if(!m.has(g.roleId)) m.set(g.roleId,new Map());
      m.get(g.roleId).set(g.permissionKey,g.allowed);
    });
    return m;
  }
  function cellHtml(role,permissionKey,gm){
    if(role.isSuperadmin){
      return `<span class="cap ok" data-tip="${esc(s('superadminNote'))}" style="cursor:default;opacity:.85;justify-content:center;display:inline-flex;min-width:96px">${ic('check')}${esc(s('permAllowed'))}</span>`;
    }
    const allowed=!!(gm.get(role.roleId)&&gm.get(role.roleId).get(permissionKey));
    return `<button class="permcycle cap ${allowed?'ok':'neutral'}" data-role="${role.roleId}" data-perm="${esc(permissionKey)}" data-allowed="${allowed}" style="cursor:pointer;min-width:96px;justify-content:center">${ic(allowed?'check':'x')}${esc(allowed?s('permAllowed'):s('permDenied'))}</button>`;
  }
  function table(){
    const gm=grantMap();
    const tpl=`minmax(210px,1.6fr) repeat(${roles.length},minmax(110px,1fr))`;
    let h=`<div class="dt-page"><div class="permgrid" role="table" style="--ptpl:${tpl}">
      <div class="pg-r pg-head"><div class="pg-c modcell">${esc(t('hr.col.role'))}</div>${roles.map(r=>`<div class="pg-c c">${esc(r.name)}</div>`).join('')}</div>`;
    let lastGroup=null;
    ADMIN_PERMISSION_KEYS.forEach(permissionKey=>{
      const groupKey=permissionGroupKey(permissionKey);
      if(groupKey!==lastGroup){ h+=`<div class="pg-grp">${esc(s(groupKey))}</div>`; lastGroup=groupKey; }
      h+=`<div class="pg-r"><div class="pg-c modcell sub mono" style="font-size:12px">${esc(permissionKey)}</div>${roles.map(r=>`<div class="pg-c c">${cellHtml(r,permissionKey,gm)}</div>`).join('')}</div>`;
    });
    h+=`</div></div>`; return h;
  }
  async function render(){
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.admin'),t('usr.roles')])}
        <div class="h1row"><h1>${esc(t('usr.roles'))}</h1><span class="countchip">${roles.length} ${esc((t('usr.roles')||'roles').toLowerCase())}</span></div>
        <div class="h1sub">${esc(s('permMatrixTitle'))}</div>
      </div>
      <div class="toolbar">
        <div class="grow"></div>
        ${btn(s('addRole'),{icon:'plus',cls:'soft',attrs:'data-act="add-role"'})}
      </div>
      <div class="alert info" style="margin-top:2px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <span class="grow">${esc(s('superadminNote'))}</span></div>
      <div class="tablewrap" id="permWrap" style="padding:0 24px 24px">${table()}</div>
    </section></div>`;
    rewire();
  }
  function rewire(){
    root.querySelectorAll('.permcycle').forEach(b=>b.addEventListener('click',async()=>{
      const roleId=Number(b.dataset.role);
      const permissionKey=b.dataset.perm;
      const nextAllowed=b.dataset.allowed!=='true';
      b.disabled=true;
      try{
        await window.ErpSystemData.action('admin/roles',roleId,'set-permission',{permissionKey,allowed:nextAllowed});
        grants=(await listPage('admin/role-permissions')).data;
        toast(s('permUpdated'),'ok');
        $('#permWrap').innerHTML=table();
        rewire();
      }catch(error){
        b.disabled=false;
        toast(error&&error.message?error.message:s('permUpdateError'),'danger');
      }
    }));
    const addBtn=root.querySelector('[data-act="add-role"]');
    addBtn&&addBtn.addEventListener('click',()=>openAddRoleModal());
  }
  function openAddRoleModal(){
    appModal({
      icon: 'plus',
      title: s('addRole'),
      body: `<div class="fld"><span>${esc(s('roleNameLabel'))} <span class="req">*</span></span><input id="rnName" placeholder="${esc(s('roleNamePlaceholder'))}"></div>`,
      actions: `${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('addRole'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
    });
    const saveBtn=$('#modalEl').querySelector('[data-save]');
    saveBtn.addEventListener('click',async()=>{
      const name=$('#rnName').value.trim();
      if(!requireField(name, s('roleNameRequired'))) return;
      saveBtn.disabled=true;
      try{
        await window.ErpSystemData.create('admin/roles',{name});
        closeModal();
        toast(s('roleCreated').replace('{name}',name),'ok');
        roles=(await listPage('admin/roles')).data;
        grants=(await listPage('admin/role-permissions')).data;
        await render();
      }catch(error){
        saveBtn.disabled=false;
        toast(error&&error.message?error.message:s('roleCreateError'),'danger');
      }
    });
  }
  await render();
};

/* ---------------- MASTER CONTROL (super-admin platform console) ---------------- */
SCREENS['master-control'] = function(root){
  let selId=null, masters=[];
  const planTone=p=>({Enterprise:'violet',Business:'blue',Starter:'slate'}[p]||'neutral');
  const PLANS=['Starter','Business','Enterprise'];
  const CURS=['USD','SGD','MYR','EUR','CNY'];
  const ROLES=['Admin','Operations Director','CFO','Finance User','Sales User','Purchase User','Warehouse User','Manager','Approver','Auditor'];
  const totalsOf=()=>({
    masters:masters.length,
    companies:masters.reduce((s,m)=>s+m.companies.length,0),
    users:masters.reduce((s,m)=>s+m.users.length,0),
  });
  function logo(name){ return esc(name.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()); }

  function masterCards(){
    return masters.map(m=>`<button class="mc-card ${m.id===selId?'on':''}" data-id="${m.id}">
      <div class="mc-card-top">
        <span class="mc-logo">${logo(m.name)}</span>
        <div class="mc-card-h"><b>${esc(m.name)}</b><small>${esc(m.id)}</small></div>
        <span class="mc-status ${m.status==='Active'?'on':'off'}" data-tip="${esc(m.status)}"></span>
      </div>
      <div class="mc-card-meta">${cap(m.plan,planTone(m.plan))}<span>${esc(m.region)}</span></div>
      <div class="mc-card-stats"><span><b>${m.companies.length}</b> cos</span><span><b>${m.users.length}</b> users</span><span><b>${m.modules}</b> mods</span></div>
    </button>`).join('');
  }
  function detail(){
    const m=masters.find(x=>x.id===selId);
    if(!m) return `<div class="statepanel" style="margin:48px auto"><div class="ic">${ic('grid')}</div><h3>No master account selected</h3><p>Create a tenant master account to get started.</p><div style="margin-top:6px">${btn('New master account',{icon:'plus',cls:'primary',attrs:'data-mc="new"'})}</div></div>`;
    const rowDel=(kind,id)=>`<button class="btn soft sm mc-del" data-del="${kind}" data-rid="${esc(id)}" data-tip="Delete" aria-label="Delete" style="padding:5px 7px">${ic('trash')}</button>`;
    const compRows=m.companies.map(c=>`<tr>
      <td class="l"><span class="docnum">${esc(c.id)}</span></td>
      <td class="l li-name"><b>${esc(c.name)}</b>${c.current?`<small>Current company</small>`:''}</td>
      <td class="c">${esc(c.cur)}</td>
      <td class="tnum">${c.branches}</td>
      <td class="l">${statusBadge(c.status)}${c.current?` ${cap('Current','accent')}`:''}</td>
      <td class="c" style="width:1%">${c.current?'':rowDel('company',c.id)}</td>
    </tr>`).join('');
    const userRows=m.users.map(u=>`<tr>
      <td class="l li-name"><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td>
      <td class="l"><span class="docnum">${esc(u.id)}</span></td>
      <td class="l">${esc(u.role)}</td>
      <td class="l">${esc(u.access)}</td>
      <td class="l">${u.last==='Online'?cap('Online','ok'):`<span style="color:var(--muted)">${esc(u.last)}</span>`}</td>
      <td class="l">${statusBadge(u.status)}</td>
      <td class="c" style="width:1%">${rowDel('user',u.id)}</td>
    </tr>`).join('');
    return `
      <div class="mc-detail-head">
        <span class="mc-logo lg">${logo(m.name)}</span>
        <div><h2>${esc(m.name)}</h2><span class="mc-sub">${esc(m.id)} · owner ${esc(m.owner)} · ${esc(m.region)}</span></div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center">${cap(m.plan,planTone(m.plan))}${statusBadge(m.status)}
          ${btn('Edit',{icon:'edit',cls:'soft',attrs:'data-mc="edit"'})}${btn('',{icon:'trash',cls:'soft',attrs:'data-mc="delete" data-tip="Delete master account" aria-label="Delete master account" style="padding:7px 9px"'})}</div>
      </div>
      <div class="mc-statrow">
        <div class="mc-stat"><small>Companies</small><b class="tnum">${m.companies.length}</b></div>
        <div class="mc-stat"><small>Users</small><b class="tnum">${m.users.length}</b></div>
        <div class="mc-stat"><small>Modules enabled</small><b class="tnum">${m.modules}/16</b></div>
        <div class="mc-stat"><small>Plan</small><b>${esc(m.plan)}</b></div>
      </div>
      <div class="panel"><div class="panel-h"><h3>Companies · legal entities</h3>${btn('Add company',{icon:'plus',cls:'soft',attrs:'style="margin-left:auto" data-mc="add-company"'})}</div>
        <table class="lines"><thead><tr><th class="l">Company ID</th><th class="l">Name</th><th class="c">Currency</th><th>Branches</th><th class="l">Status</th><th></th></tr></thead><tbody>${compRows}</tbody></table>
      </div>
      <div class="panel"><div class="panel-h"><h3>Users</h3>${btn('Invite user',{icon:'plus',cls:'soft',attrs:'style="margin-left:auto" data-mc="add-user"'})}</div>
        <table class="lines"><thead><tr><th class="l">User</th><th class="l">User ID</th><th class="l">Role</th><th class="l">Company access</th><th class="l">Last active</th><th class="l">Status</th><th></th></tr></thead><tbody>${userRows}</tbody></table>
      </div>`;
  }
  function render(){
    const t=totalsOf();
    root.innerHTML=`<div class="content full"><section class="master"><div class="scrollarea">
      <div class="pagehead">
        ${crumbs([DB.company.name,'Admin','Master Control'])}
        <div class="h1row"><h1>Master Control</h1><span class="acct-role" style="font-size:11px">${ic('shield')}Super Admin</span>
          <span class="cap ${MasterStore.backend==='pg'?'ok':'warn'}" data-tip="Master accounts are stored in PGlite — in-browser Postgres — and persist across reloads"><span class="dot"></span>${esc(MasterStore.backendLabel())}</span>
          <div class="headright">
            <div class="kfig"><small>Masters</small><b class="tnum">${t.masters}</b></div>
            <div class="kfig"><small>Companies</small><b class="tnum">${t.companies}</b></div>
            <div class="kfig"><small>Users</small><b class="tnum">${t.users}</b></div>
          </div></div>
        <div class="h1sub">Platform console — create, edit and remove tenant master accounts, their company legal entities and users. Changes are saved to the in-browser Postgres database.</div>
      </div>
      <div class="mc-layout">
        <div class="mc-list">
          <div class="mc-list-h">Master accounts ${btn('New',{icon:'plus',cls:'soft',attrs:'style="margin-left:auto" data-mc="new"'})}</div>
          ${masterCards()}
        </div>
        <div class="mc-detail" id="mcDetail">${detail()}</div>
      </div>
    </div></section></div>`;
    wire();
  }

  function wire(){
    root.querySelectorAll('.mc-card').forEach(c=>c.addEventListener('click',()=>{ selId=c.dataset.id; render(); }));
    const cur=()=>masters.find(x=>x.id===selId);
    root.querySelectorAll('[data-mc]').forEach(b=>b.addEventListener('click',()=>{
      const a=b.dataset.mc;
      if(a==='new') masterForm(null);
      else if(a==='edit'){ const m=cur(); if(m) masterForm(m); }
      else if(a==='delete'){ const m=cur(); if(m) confirmDeleteMaster(m); }
      else if(a==='add-company'){ if(selId) companyForm(selId); }
      else if(a==='add-user'){ if(selId) userForm(selId); }
    }));
    root.querySelectorAll('.mc-del').forEach(b=>b.addEventListener('click',async()=>{
      const kind=b.dataset.del, id=b.dataset.rid;
      if(kind==='company'){ await MasterStore.deleteCompany(selId,id); toast('Company removed','danger'); }
      else { await MasterStore.deleteUser(selId,id); toast('User removed','danger'); }
      await refresh(selId);
    }));
  }

  async function refresh(keep){
    const list=await MasterStore.list();
    /* TASK-018: MasterStore.list() is async (IndexedDB-backed); if the user
       has already navigated to a different screen by the time it resolves,
       applying this render would overwrite whatever screen is showing now
       (found via an automated sweep: master-control's stale content leaked
       into an unrelated screen visited right after it). */
    if(CURRENT_ROUTE!=='master-control') return;
    masters=list;
    if(keep && masters.find(m=>m.id===keep)) selId=keep;
    if(!masters.find(m=>m.id===selId)) selId=masters[0]?masters[0].id:null;
    render();
  }

  /* ---- forms ---- */
  function fld(label,inner){ return `<div class="fld"><span>${label}</span>${inner}</div>`; }
  function selBox(id,opts,curv){ return `<select id="${id}">${opts.map(o=>`<option ${o===curv?'selected':''}>${esc(o)}</option>`).join('')}</select>`; }

  function masterForm(m){
    const edit=!!m;
    appModal({
      icon: edit?'edit':'plus',
      title: edit?'Edit master account':'New master account',
      body: `<div class="set-grid">
        ${fld('Account name <span class="req">*</span>',`<input id="mfName" value="${edit?esc(m.name):''}" placeholder="e.g. Northwind Group">`)}
        ${fld('Owner',`<input id="mfOwner" value="${edit&&m.owner!=='—'?esc(m.owner):''}" placeholder="Primary contact">`)}
        ${fld('Plan',selBox('mfPlan',PLANS,edit?m.plan:'Business'))}
        ${fld('Region',`<input id="mfRegion" value="${edit?esc(m.region):''}" placeholder="e.g. APAC · Singapore">`)}
        ${fld('Status',selBox('mfStatus',['Active','Suspended'],edit?m.status:'Active'))}
      </div>${edit?'':`<p style="margin:12px 2px 0;font-size:11.5px;color:var(--muted)">A master account ID (MST-####) is assigned automatically. The plan sets the default module count.</p>`}`,
      actions: `${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(edit?'Save changes':'Create account',{icon:edit?'save':'plus',cls:'primary',attrs:'data-save="1"'})}`,
    });
    $('#modalEl').querySelector('[data-save]').addEventListener('click',async()=>{
      const name=$('#mfName').value.trim();
      if(!requireField(name, 'Account name is required', '#mfName')) return;
      const d={name,owner:$('#mfOwner').value.trim()||'—',plan:$('#mfPlan').value,region:$('#mfRegion').value.trim(),status:$('#mfStatus').value};
      closeModal();
      if(edit){ await MasterStore.updateMaster(m.id,d); toast('Master account updated','ok'); await refresh(m.id); }
      else { const id=await MasterStore.createMaster(d); toast('Master account created','ok'); await refresh(id); }
    });
  }

  function confirmDeleteMaster(m){
    appModal({
      icon: 'trash',
      title: `Delete ${m.name}?`,
      body: `<div class="risk danger">${ic('warn')}<div><b>This permanently removes the master account</b><small>${m.companies.length} compan${m.companies.length===1?'y':'ies'} and ${m.users.length} user${m.users.length===1?'':'s'} will be deleted with it.</small></div></div>`,
      actions: `${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Delete account',{icon:'trash',cls:'danger-solid',attrs:'data-del="1"'})}`,
    });
    $('#modalEl').querySelector('[data-del]').addEventListener('click',async()=>{ closeModal(); await MasterStore.deleteMaster(m.id); toast('Master account deleted','danger'); await refresh(); });
  }

  function companyForm(masterId){
    appModal({
      icon: 'plus',
      title: 'Add company',
      body: `<div class="set-grid">
        ${fld('Company name <span class="req">*</span>',`<input id="cfName" placeholder="Legal entity name">`)}
        ${fld('Base currency',selBox('cfCur',CURS,'USD'))}
        ${fld('Branches',`<input id="cfBranch" type="number" min="1" value="1">`)}
        ${fld('Status',selBox('cfStatus',['Active','Suspended'],'Active'))}
      </div>`,
      actions: `${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Add company',{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
    });
    $('#modalEl').querySelector('[data-save]').addEventListener('click',async()=>{
      const name=$('#cfName').value.trim();
      if(!requireField(name, 'Company name is required', '#cfName')) return;
      const d={name,cur:$('#cfCur').value,branches:Math.max(1,parseInt($('#cfBranch').value,10)||1),status:$('#cfStatus').value};
      closeModal(); await MasterStore.addCompany(masterId,d); toast('Company added','ok'); await refresh(masterId);
    });
  }

  function userForm(masterId){
    appModal({
      icon: 'plus',
      title: 'Invite user',
      body: `<div class="set-grid">
        ${fld('Full name <span class="req">*</span>',`<input id="ufName" placeholder="e.g. Jordan Lee">`)}
        ${fld('Email',`<input id="ufEmail" type="email" placeholder="name@company.com">`)}
        ${fld('Role',selBox('ufRole',ROLES,'Sales User'))}
        ${fld('Company access',`<input id="ufAccess" value="All companies">`)}
      </div>`,
      actions: `${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Send invite',{icon:'check',cls:'primary',attrs:'data-save="1"'})}`,
    });
    $('#modalEl').querySelector('[data-save]').addEventListener('click',async()=>{
      const name=$('#ufName').value.trim();
      if(!requireField(name, 'Name is required', '#ufName')) return;
      const d={name,email:$('#ufEmail').value.trim(),role:$('#ufRole').value,access:$('#ufAccess').value.trim()||'All companies'};
      closeModal(); await MasterStore.addUser(masterId,d); toast('Invitation sent','ok'); await refresh(masterId);
    });
  }

  // boot — show a skeleton, then load from the store (PGlite, or in-memory fallback)
  root.innerHTML=`<div class="content full"><section class="master"><div class="scrollarea">
    <div class="pagehead">${crumbs([DB.company.name,'Admin','Master Control'])}
      <div class="h1row"><h1>Master Control</h1><span class="acct-role" style="font-size:11px">${ic('shield')}Super Admin</span></div>
      <div class="h1sub">Connecting to in-browser Postgres…</div></div>
    ${skeletonRows(6)}
  </div></section></div>`;
  MasterStore.ensureReady().then(()=>refresh());
};
