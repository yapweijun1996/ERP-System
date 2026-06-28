/* ============================================================
   ARIA ERP — screens: HR Leave Approval, Admin Role Permission
   ============================================================ */

/* ---------------- HR LEAVE APPROVAL ---------------- */
SCREENS['leave-approval'] = function(root){
  const data=JSON.parse(JSON.stringify(DB.leave));
  let selected=data[0].no;
  function statusOf(l){ return l.status; }
  function render(){
    const pending=data.filter(l=>l.status==='Pending Approval');
    const sel=data.find(l=>l.no===selected)||pending[0]||data[0];
    selected=sel.no;
    const listCols=[
      {label:'Employee',align:'l',w:'minmax(190px,2fr)',render:l=>`<div style="display:flex;align-items:center;gap:10px;min-width:0"><span class="cav" style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:11px;font-weight:600;background:${l.clr};flex:none">${esc(l.avatar)}</span><div class="cellsub"><b>${esc(l.emp)}</b><small>${esc(l.dept)} · ${esc(l.no)}</small></div></div>`},
      {label:'Type',align:'l',render:l=>cap(l.type,l.type==='Medical'?'violet':l.type==='Unpaid'?'neutral':'accent')},
      {label:'Dates',align:'l',w:'minmax(150px,1.4fr)',render:l=>`${esc(l.from)} → ${esc(l.to)}`},
      {label:'Days',align:'r',w:'70px',render:l=>l.days},
      {label:'Balance',align:'r',w:'92px',render:l=>`${l.balance}${l.warn?` <span data-tip="${esc(l.warn)}">${ic('warn')}</span>`:''}`},
      {label:'Status',align:'l',render:l=>statusBadge(l.status)},
    ];
    const table=buildTable({rowId:l=>l.no, columns:listCols, rows:data});

    // detail
    const after=sel.balance-sel.days;
    const detail=`
      <div class="detail-head">
        <span class="grabber"></span>
        <button class="close" onclick="document.getElementById('lvContent').classList.add('detail-collapsed');document.getElementById('lvDetail').classList.remove('open')">${ic('chevL')}Close</button>
        <div class="dh-top"><span class="cav" style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:15px;font-weight:600;background:${sel.clr};flex:none">${esc(sel.avatar)}</span>
          <div><h2>${esc(sel.emp)}</h2><span class="sub">${esc(sel.dept)} · ${esc(sel.no)}</span></div>
          <div style="margin-left:auto">${statusBadge(sel.status)}</div></div>
      </div>
      <div class="detail-body">
        ${sel.warn?`<div class="risk danger" style="margin-bottom:14px">${ic('warn')}<div><b>${esc(sel.warn)}</b><small>Approving will create a negative balance or unpaid leave. Add a note for HR.</small></div></div>`:''}
        ${sel.cert?`<div class="risk ok" style="margin-bottom:14px">${ic('paperclip')}<div><b>Medical certificate attached</b><small>cert-${esc(sel.no)}.pdf · verified</small></div></div>`:''}
        <div class="statgrid c3"><div class="stat"><small>Requested</small><b>${sel.days}d</b></div><div class="stat"><small>Balance</small><b>${sel.balance}d</b></div><div class="stat ${after<0?'dangerval':'okval'}"><small>After</small><b>${after}d</b></div></div>
        <div class="card">
          <div class="field"><span class="k">Leave type</span><span class="v">${esc(sel.type)}</span></div>
          <div class="field"><span class="k">From</span><span class="v">${esc(sel.from)}</span></div>
          <div class="field"><span class="k">To</span><span class="v">${esc(sel.to)}</span></div>
          <div class="field"><span class="k">Working days</span><span class="v">${sel.days}</span></div>
          <div class="field"><span class="k">Cover</span><span class="v">${esc(sel.cover)}</span></div>
          <div class="field"><span class="k">Reason</span><span class="v">${esc(sel.reason)}</span></div>
        </div>
        <div class="sectitle">Team calendar — ${esc(sel.from.slice(0,7))}</div>
        <div class="card" style="font-size:12px;color:var(--muted)">No overlapping leave in ${esc(sel.dept)} during these dates.${sel.cover==='—'?' <span style="color:var(--warn)">No cover assigned.</span>':''}</div>
        <div class="sectitle">Approval trail</div>
        ${auditTrail([{kind:'current',when:'Awaiting you',what:'Manager approval',who:DB.user.name+' · Operations Director'},{kind:'add',when:sel.from.slice(0,7)+'-01',what:'Submitted by employee',who:sel.emp}])}
      </div>
      <div class="approvebar">
        ${btn('Reject',{icon:'x',cls:'danger',sm:false,attrs:`data-lv="reject"`})}
        ${btn(sel.status==='Approved'?'Approved':'Approve',{icon:'check',cls:sel.status==='Approved'?'soft':'primary',sm:false,attrs:sel.status==='Approved'?'disabled':`data-lv="approve"`})}
      </div>`;

    root.innerHTML=`<div class="content" id="lvContent">
      <section class="master">
        <div class="pagehead">${crumbs([DB.company.name,'HR','Leave Approval'])}
          <div class="h1row"><h1>Leave Approval</h1><span class="countchip">${pending.length} pending</span>
            <div class="headright"><div class="kfig"><small>This month</small><b class="tnum">18 days</b></div></div></div>
        </div>
        <div class="toolbar"><div class="filterchips"><button class="chip on">Pending</button><button class="chip">All</button><button class="chip">My team</button></div>
          <div class="grow"></div>${btn('Export',{icon:'download',cls:'soft'})}</div>
        <div class="tablewrap" id="lvTable">${table}</div>
      </section>
      <aside class="detail open" id="lvDetail">${detail}</aside>
    </div>`;

    $('#lvTable').querySelectorAll('.dt-r[data-row]').forEach(tr=>{ tr.classList.toggle('sel',tr.dataset.row===selected); tr.addEventListener('click',()=>{ selected=tr.dataset.row; render(); $('#lvContent').classList.remove('detail-collapsed'); }); });
    const ap=root.querySelector('[data-lv="approve"]'); if(ap)ap.addEventListener('click',()=>{ sel.status='Approved'; toast(`${sel.emp}’s leave approved`,'ok'); render(); });
    const rj=root.querySelector('[data-lv="reject"]'); if(rj)rj.addEventListener('click',()=>{
      openModal(`<div class="modal-head">${ic('xc')}<h3>Reject leave — ${esc(sel.emp)}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
        <div class="modal-body"><div class="fld err"><span>Reason <span class="req">*</span></span><textarea placeholder="Shared with the employee and HR."></textarea><span class="hint bad">Required to reject.</span></div></div>
        <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Reject',{icon:'x',cls:'danger-solid',attrs:`onclick="closeModal();rejectLeave('${sel.no}')"`})}</div>`);
    });
  }
  window.rejectLeave=(no)=>{ const l=data.find(x=>x.no===no); if(l){l.status='Rejected';} toast('Leave rejected','danger'); render(); };
  render();
};

/* ---------------- ADMIN ROLE PERMISSION (matrix) ---------------- */
SCREENS['role-permission'] = function(root){
  const lvls=DB.permLevels; // None View Edit Full
  const state=JSON.parse(JSON.stringify(DB.permModules));
  function cellHtml(gi,ri,ci,level){
    // segmented control of 4 levels rendered compactly as a clickable pill cycling
    const icons=['x','eye','edit','check'];
    const tone=level===0?'':level===1?'info':level===2?'warn':'ok';
    const lbl=lvls[level];
    return `<button class="permcycle cap ${tone||'neutral'}" data-g="${gi}" data-r="${ri}" data-c="${ci}" data-tip="${esc(lbl)} — click to change" style="cursor:pointer;min-width:64px;justify-content:center">${ic(icons[level])}${esc(lbl)}</button>`;
  }
  function table(){
    const tpl=`minmax(210px,1.6fr) repeat(${DB.roles.length},minmax(82px,1fr))`;
    let h=`<div class="dt-page"><div class="permgrid" role="table" style="--ptpl:${tpl}">
      <div class="pg-r pg-head"><div class="pg-c modcell">Module / screen</div>${DB.roles.map(r=>`<div class="pg-c c">${esc(r)}</div>`).join('')}</div>`;
    state.forEach((g,gi)=>{
      h+=`<div class="pg-grp">${esc(g.grp)}</div>`;
      g.rows.forEach((row,ri)=>{
        h+=`<div class="pg-r"><div class="pg-c modcell sub">${esc(row.m)}</div>${row.p.map((lv,ci)=>`<div class="pg-c c">${cellHtml(gi,ri,ci,lv)}</div>`).join('')}</div>`;
      });
    });
    h+=`</div></div>`; return h;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,'Admin','Role Permission'])}
      <div class="h1row"><h1>Role Permissions</h1><span class="countchip">${DB.roles.length} roles</span></div>
      <div class="h1sub">Module → screen → action access per role. Click any cell to cycle None → View → Edit → Full. Data scope and field-masking are configured per role.</div>
    </div>
    <div class="toolbar">
      <div class="filterchips"><button class="chip on">All modules</button><button class="chip">Sales</button><button class="chip">Finance</button><button class="chip">Inventory</button></div>
      <div class="grow"></div>
      <button class="viewsel">${ic('user')}Role: Approver${ic('chevD')}</button>
      ${btn('Add role',{icon:'plus',cls:'soft'})}${btn('Save changes',{icon:'save',cls:'primary',attrs:'onclick="toast(\'Permission changes saved\',\'ok\')"'})}
    </div>
    <div class="alert info" style="margin-top:2px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow">Restricted actions are <b>disabled with a reason</b> rather than hidden, so users understand why they can’t proceed (e.g. “You don’t have Finance Posting permission”).</span></div>
    <div class="tablewrap" id="permWrap" style="padding:0 24px 24px">${table()}</div>
  </section></div>`;
  function rewire(){
    root.querySelectorAll('.permcycle').forEach(b=>b.addEventListener('click',()=>{
      const gi=+b.dataset.g,ri=+b.dataset.r,ci=+b.dataset.c;
      state[gi].rows[ri].p[ci]=(state[gi].rows[ri].p[ci]+1)%4;
      $('#permWrap').innerHTML=table(); rewire();
    }));
  }
  rewire();
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
    masters=await MasterStore.list();
    if(keep && masters.find(m=>m.id===keep)) selId=keep;
    if(!masters.find(m=>m.id===selId)) selId=masters[0]?masters[0].id:null;
    render();
  }

  /* ---- forms ---- */
  function fld(label,inner){ return `<div class="fld"><span>${label}</span>${inner}</div>`; }
  function selBox(id,opts,curv){ return `<select id="${id}">${opts.map(o=>`<option ${o===curv?'selected':''}>${esc(o)}</option>`).join('')}</select>`; }

  function masterForm(m){
    const edit=!!m;
    openModal(`<div class="modal-head">${ic(edit?'edit':'plus')}<h3>${edit?'Edit master account':'New master account'}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="set-grid">
        ${fld('Account name <span class="req">*</span>',`<input id="mfName" value="${edit?esc(m.name):''}" placeholder="e.g. Northwind Group">`)}
        ${fld('Owner',`<input id="mfOwner" value="${edit&&m.owner!=='—'?esc(m.owner):''}" placeholder="Primary contact">`)}
        ${fld('Plan',selBox('mfPlan',PLANS,edit?m.plan:'Business'))}
        ${fld('Region',`<input id="mfRegion" value="${edit?esc(m.region):''}" placeholder="e.g. APAC · Singapore">`)}
        ${fld('Status',selBox('mfStatus',['Active','Suspended'],edit?m.status:'Active'))}
      </div>${edit?'':`<p style="margin:12px 2px 0;font-size:11.5px;color:var(--muted)">A master account ID (MST-####) is assigned automatically. The plan sets the default module count.</p>`}</div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(edit?'Save changes':'Create account',{icon:edit?'save':'plus',cls:'primary',attrs:'data-save="1"'})}</div>`);
    $('#modalEl').querySelector('[data-save]').addEventListener('click',async()=>{
      const name=$('#mfName').value.trim();
      if(!name){ toast('Account name is required','danger'); $('#mfName').focus(); return; }
      const d={name,owner:$('#mfOwner').value.trim()||'—',plan:$('#mfPlan').value,region:$('#mfRegion').value.trim(),status:$('#mfStatus').value};
      closeModal();
      if(edit){ await MasterStore.updateMaster(m.id,d); toast('Master account updated','ok'); await refresh(m.id); }
      else { const id=await MasterStore.createMaster(d); toast('Master account created','ok'); await refresh(id); }
    });
  }

  function confirmDeleteMaster(m){
    openModal(`<div class="modal-head">${ic('trash')}<h3>Delete ${esc(m.name)}?</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="risk danger">${ic('warn')}<div><b>This permanently removes the master account</b><small>${m.companies.length} compan${m.companies.length===1?'y':'ies'} and ${m.users.length} user${m.users.length===1?'':'s'} will be deleted with it.</small></div></div></div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Delete account',{icon:'trash',cls:'danger-solid',attrs:'data-del="1"'})}</div>`);
    $('#modalEl').querySelector('[data-del]').addEventListener('click',async()=>{ closeModal(); await MasterStore.deleteMaster(m.id); toast('Master account deleted','danger'); await refresh(); });
  }

  function companyForm(masterId){
    openModal(`<div class="modal-head">${ic('plus')}<h3>Add company</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="set-grid">
        ${fld('Company name <span class="req">*</span>',`<input id="cfName" placeholder="Legal entity name">`)}
        ${fld('Base currency',selBox('cfCur',CURS,'USD'))}
        ${fld('Branches',`<input id="cfBranch" type="number" min="1" value="1">`)}
        ${fld('Status',selBox('cfStatus',['Active','Suspended'],'Active'))}
      </div></div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Add company',{icon:'plus',cls:'primary',attrs:'data-save="1"'})}</div>`);
    $('#modalEl').querySelector('[data-save]').addEventListener('click',async()=>{
      const name=$('#cfName').value.trim();
      if(!name){ toast('Company name is required','danger'); $('#cfName').focus(); return; }
      const d={name,cur:$('#cfCur').value,branches:Math.max(1,parseInt($('#cfBranch').value,10)||1),status:$('#cfStatus').value};
      closeModal(); await MasterStore.addCompany(masterId,d); toast('Company added','ok'); await refresh(masterId);
    });
  }

  function userForm(masterId){
    openModal(`<div class="modal-head">${ic('plus')}<h3>Invite user</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="set-grid">
        ${fld('Full name <span class="req">*</span>',`<input id="ufName" placeholder="e.g. Jordan Lee">`)}
        ${fld('Email',`<input id="ufEmail" type="email" placeholder="name@company.com">`)}
        ${fld('Role',selBox('ufRole',ROLES,'Sales User'))}
        ${fld('Company access',`<input id="ufAccess" value="All companies">`)}
      </div></div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Send invite',{icon:'check',cls:'primary',attrs:'data-save="1"'})}</div>`);
    $('#modalEl').querySelector('[data-save]').addEventListener('click',async()=>{
      const name=$('#ufName').value.trim();
      if(!name){ toast('Name is required','danger'); $('#ufName').focus(); return; }
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
  MasterStore.ready.then(()=>refresh());
};
