/* ============================================================
   ARIA ERP — Add Employee onboarding wizard (create flow)
   3 steps: Personal & role → Compensation & employment →
   Account setup & invite. Live directory-row preview, auto
   initials/avatar, and a provisioning checklist. Reached from
   Quick create, the command palette and the People directory.
   ============================================================ */
SCREENS['new-employee'] = function(root){
  const DEPTS=[...new Set(DB.employees.map(e=>e.dept))];
  const AV_CLRS=['#0a84ff','#1f9d57','#FF9500','#ff375f','#bf5af2','#0B6E7C','#9A6712','#3457D5'];
  const MGRS=DB.employees.filter(e=>/Director|Lead|Manager|Supervisor/.test(e.role));
  const PAYGRADES=[['G1','G1 · Associate'],['G2','G2 · Professional'],['G3','G3 · Senior'],['G4','G4 · Lead / Manager'],['G5','G5 · Director']];

  const S={ step:0, reached:0,
    first:'', last:'', email:'', phone:'',
    dept:DEPTS[0], role:'', type:'Full-time', manager:(MGRS[0]&&MGRS[0].name)||'', start:'2026-07-01',
    grade:'G2', salary:72000, payCycle:'Monthly', location:'KL HQ', leaveDays:18,
    sendInvite:true, kit:true, payroll:true, provision:{email:true,laptop:true,access:true} };

  function initials(){ const a=(S.first[0]||''),b=(S.last[0]||''); return (a+b).toUpperCase()||'?'; }
  function fullName(){ return `${S.first} ${S.last}`.trim(); }
  function avClr(){ const n=fullName()||'x'; let h=0; for(const c of n)h=(h*31+c.charCodeAt(0))>>>0; return AV_CLRS[h%AV_CLRS.length]; }
  const empId='EMP-1188';

  /* ---------------- live preview ---------------- */
  function previewRow(){
    return `<div style="display:flex;align-items:center;gap:11px">
      <span class="kc-av" style="background:${avClr()};width:34px;height:34px;font-size:12px">${initials()}</span>
      <div class="cellsub"><b>${esc(fullName()||'New employee')}</b><small>${empId} · ${esc(S.dept)}</small></div></div>`;
  }
  function sidebar(){
    const monthly=S.payCycle==='Monthly'?S.salary/12:S.salary/26;
    return `<div class="sumcard">
      <div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Directory preview</div>
      <div style="background:var(--surface-2);border-radius:var(--r-m);padding:12px">${previewRow()}</div>
      <div class="sumrow" style="margin-top:12px"><span class="sk2">Role</span><span class="sv">${esc(S.role||'—')}</span></div>
      <div class="sumrow"><span class="sk2">Reports to</span><span class="sv">${esc(S.manager||'—')}</span></div>
      <div class="sumrow"><span class="sk2">Employment</span><span class="sv">${esc(S.type)}</span></div>
      <div class="sumrow"><span class="sk2">Start date</span><span class="sv">${esc(S.start)}</span></div>
    </div>
    <div class="sumcard">
      <div class="sumrow"><span class="sk2">Pay grade</span><span class="sv">${esc(S.grade)}</span></div>
      <div class="sumrow"><span class="sk2">Annual salary</span><span class="sv tnum">${money(S.salary)}</span></div>
      <div class="sumrow total"><span class="sk2">${S.payCycle==='Monthly'?'Monthly':'Bi-weekly'} gross</span><span class="sv tnum">${money(monthly)}</span></div>
    </div>`;
  }
  function refreshSide(){ const a=$('#wSide'); if(a)a.innerHTML=sidebar(); }

  /* ---------------- STEP 1 — personal & role ---------------- */
  function step1(){
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('user')}<h3>Personal details</h3></div>
        <div class="panel-body">
          <div class="fldrow c2">
            <div class="fld"><span>First name <span class="req">*</span></span><input id="wFirst" value="${esc(S.first)}" placeholder="e.g. Nadia"></div>
            <div class="fld"><span>Last name <span class="req">*</span></span><input id="wLast" value="${esc(S.last)}" placeholder="e.g. Hassan"></div>
          </div>
          <div class="fldrow c2" style="margin-top:12px">
            <div class="fld"><span>Work email <span class="req">*</span></span><input id="wEmail" value="${esc(S.email)}" placeholder="name@northwind.example"></div>
            <div class="fld"><span>Phone</span><input id="wPhone" value="${esc(S.phone)}" placeholder="+60 12-345 6789"></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('people')}<h3>Role &amp; reporting</h3></div>
        <div class="panel-body">
          <div class="fldrow c2">
            <div class="fld"><span>Department</span><select id="wDept">${DEPTS.map(d=>`<option ${d===S.dept?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
            <div class="fld"><span>Job title <span class="req">*</span></span><input id="wRole" value="${esc(S.role)}" placeholder="e.g. Account Executive"></div>
          </div>
          <div class="fldrow c3" style="margin-top:12px">
            <div class="fld"><span>Employment type</span><select id="wType">${['Full-time','Part-time','Contract','Intern'].map(t=>`<option ${t===S.type?'selected':''}>${t}</option>`).join('')}</select></div>
            <div class="fld"><span>Reports to</span><select id="wMgr">${MGRS.map(m=>`<option ${m.name===S.manager?'selected':''}>${esc(m.name)} · ${esc(m.role)}</option>`).join('')}</select></div>
            <div class="fld"><span>Start date</span><input type="date" id="wStart" value="${S.start}"></div>
          </div>
        </div>
      </div>
    </div>
    <aside class="summary" id="wSide">${sidebar()}</aside></div>`;
  }
  function wire1(){
    const b=(id,key,ev='input',fn)=>{ const el=$('#'+id); el&&el.addEventListener(ev,()=>{ S[key]=el.value; fn&&fn(); refreshSide(); updateFooter(); }); };
    b('wFirst','first'); b('wLast','last'); b('wEmail','email'); b('wPhone','phone');
    b('wRole','role');
    const mgr=$('#wMgr'); mgr&&mgr.addEventListener('change',()=>{ S.manager=mgr.value.split(' · ')[0]; refreshSide(); });
    const dept=$('#wDept'); dept&&dept.addEventListener('change',()=>{ S.dept=dept.value; refreshSide(); });
    const type=$('#wType'); type&&type.addEventListener('change',()=>{ S.type=type.value; refreshSide(); });
    const start=$('#wStart'); start&&start.addEventListener('change',()=>{ S.start=start.value; refreshSide(); });
  }

  /* ---------------- STEP 2 — compensation & employment ---------------- */
  function step2(){
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('coins')}<h3>Compensation</h3></div>
        <div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Pay grade</span><select id="wGrade">${PAYGRADES.map(g=>`<option value="${g[0]}" ${g[0]===S.grade?'selected':''}>${esc(g[1])}</option>`).join('')}</select></div>
            <div class="fld"><span>Annual salary (USD) <span class="req">*</span></span><input type="number" id="wSalary" min="0" step="1000" value="${S.salary}"></div>
            <div class="fld"><span>Pay cycle</span><select id="wCycle">${['Monthly','Bi-weekly'].map(c=>`<option ${c===S.payCycle?'selected':''}>${c}</option>`).join('')}</select></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('location')}<h3>Employment terms</h3></div>
        <div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Primary location</span><select id="wLoc">${['KL HQ','Penang Plant','Singapore Office','Remote'].map(l=>`<option ${l===S.location?'selected':''}>${l}</option>`).join('')}</select></div>
            <div class="fld"><span>Annual leave (days)</span><input type="number" id="wLeave" min="0" max="40" value="${S.leaveDays}"></div>
            <div class="fld"><span>Employee ID</span><input value="${empId}" readonly></div>
          </div>
          <div class="risk" style="margin-top:14px;background:var(--accent-tint);border:none">${ic('shield')}<div><b>Statutory contributions auto-enrolled</b><small>EPF, SOCSO and EIS are configured from the pay grade and location on save.</small></div></div>
        </div>
      </div>
    </div>
    <aside class="summary" id="wSide">${sidebar()}</aside></div>`;
  }
  function wire2(){
    const gr=$('#wGrade'); gr&&gr.addEventListener('change',()=>{ S.grade=gr.value; refreshSide(); });
    const sal=$('#wSalary'); sal&&sal.addEventListener('input',()=>{ S.salary=Math.max(0,+sal.value||0); refreshSide(); updateFooter(); });
    const cyc=$('#wCycle'); cyc&&cyc.addEventListener('change',()=>{ S.payCycle=cyc.value; refreshSide(); });
    const loc=$('#wLoc'); loc&&loc.addEventListener('change',()=>S.location=loc.value);
    const lv=$('#wLeave'); lv&&lv.addEventListener('input',()=>S.leaveDays=Math.max(0,+lv.value||0));
  }

  /* ---------------- STEP 3 — account setup & invite ---------------- */
  function provItem(key,icon,title,desc){
    const on=S.provision[key];
    return `<label class="set-row" data-prov="${key}" style="cursor:pointer;border-radius:var(--r-m)">
      <span class="si" style="width:34px;height:34px;border-radius:9px;background:var(--surface-2);display:grid;place-items:center;color:var(--muted);flex:none">${ic(icon)}</span>
      <div class="set-row-t"><b>${title}</b><small>${desc}</small></div>
      <div class="set-row-c"><button type="button" class="set-tgl ${on?'on':''}" role="switch" aria-checked="${on}"><span class="set-tgl-k"></span></button></div></label>`;
  }
  function step3(){
    const monthly=S.payCycle==='Monthly'?S.salary/12:S.salary/26;
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('checkc')}<h3>Review</h3></div>
        <div class="panel-body">
          <div class="docmeta" style="margin:0">
            <div class="dm"><small>Employee</small><div class="partner"><span class="pav" style="background:${avClr()}">${initials()}</span><b>${esc(fullName())}</b></div></div>
            <div class="dm"><small>Role</small><b>${esc(S.role||'—')} · ${esc(S.dept)}</b></div>
            <div class="dm"><small>Reports to</small><b>${esc(S.manager||'—')}</b></div>
            <div class="dm"><small>Start date</small><b>${esc(S.start)}</b></div>
            <div class="dm"><small>Salary</small><b>${money(S.salary)} · ${esc(S.payCycle)}</b></div>
            <div class="dm"><small>Email</small><b>${esc(S.email||'—')}</b></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('sliders')}<h3>Provisioning</h3></div>
        <div style="padding:6px 10px">
          ${provItem('email','idcard','Create email &amp; SSO account',`Provision ${esc(S.email||'work email')} and add to ${esc(S.dept)} groups.`)}
          ${provItem('laptop','grid','Issue equipment',`Trigger an IT request for a laptop and access card.`)}
          ${provItem('access','lock','Grant module access',`Default ${esc(S.dept)} role permissions in Aria ERP.`)}
        </div>
      </div>
    </div>
    <aside class="summary">
      <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">On save</div>
        ${indicator({tone:'ok',icon:'checkc',label:'Adds to People directory',value:empId,sub:`${esc(S.type)} · ${esc(S.dept)} · starts ${esc(S.start)}.`})}
        <div style="margin-top:8px">${indicator({tone:'accent',icon:'coins',label:'Enrols in payroll',value:money0(monthly),sub:`${esc(S.payCycle)} gross · statutory contributions auto-set.`})}</div>
      </div>
      <label class="sumcard" id="wInviteCard" style="cursor:pointer;display:flex;align-items:center;gap:12px">
        <button type="button" class="set-tgl ${S.sendInvite?'on':''}" id="wInvite" role="switch" aria-checked="${S.sendInvite}"><span class="set-tgl-k"></span></button>
        <div><b style="font-size:13.5px">Send welcome invite</b><small style="display:block;color:var(--muted);font-size:12px;margin-top:2px">Email onboarding steps to ${esc(S.email||'the new hire')} on save.</small></div>
      </label>
    </aside></div>`;
  }
  function wire3(){
    $$('#viewRoot [data-prov]').forEach(l=>l.addEventListener('click',e=>{ e.preventDefault();
      const k=l.dataset.prov; S.provision[k]=!S.provision[k];
      const t=l.querySelector('.set-tgl'); t.classList.toggle('on',S.provision[k]); t.setAttribute('aria-checked',S.provision[k]); }));
    const inv=$('#wInviteCard'); inv&&inv.addEventListener('click',e=>{ e.preventDefault(); S.sendInvite=!S.sendInvite;
      const t=$('#wInvite'); t.classList.toggle('on',S.sendInvite); t.setAttribute('aria-checked',S.sendInvite); });
  }

  /* ---------------- shell ---------------- */
  const steps=[['Personal & role','user'],['Compensation','coins'],['Setup & invite','checkc']];
  function stepper(){ return wizardStepper(steps, S.step, S.reached); }
  function canAdvance(){
    if(S.step===0) return S.first.trim()&&S.last.trim()&&S.email.trim()&&S.role.trim();
    if(S.step===1) return S.salary>0;
    return true;
  }
  function footer(){
    const adv=canAdvance();
    const right=S.step<2
      ? btn('Continue',{icon:'arrowR',cls:'primary',sm:false,attrs:`id="wNext" ${adv?'':'disabled style=\"opacity:.5;pointer-events:none\"'}`})
      : btn('Add employee',{icon:'check',cls:'primary',sm:false,attrs:'id="wCreate"'});
    const left=S.step>0?btn('Back',{icon:'chevL',cls:'soft',attrs:'id="wBack"'}):btn('Cancel',{cls:'soft',attrs:'id="wCancel"'});
    const hint=S.step===0?'Step 1 of 3 · who they are and what they’ll do'
      :S.step===1?'Step 2 of 3 · pay and employment terms'
      :'Step 3 of 3 · provision access, then add';
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div><div class="grow"></div>${left}${right}`;
  }
  function body(){ return S.step===0?step1():S.step===1?step2():step3(); }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="Add Employee">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'HR','Directory',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('people')}Add Employee</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">Onboarding · ${esc(DB.company.name)} · ${esc(DB.company.branch)}</div></div>
            <div class="dactions">${cap('Draft','neutral')}</div>
          </div>
          ${stepper()}
        </div>
        <div id="wizBody">${body()}</div>
        <div style="height:8px"></div>
      </div></div>
      <div class="set-savebar" id="wizFoot">${footer()}</div>
    </section></div>`;
    wireShell();
    if(S.step===0)wire1(); else if(S.step===1)wire2(); else wire3();
  }
  function updateFooter(){ const f=$('#wizFoot'); if(f){ f.innerHTML=footer(); wireShell(); } }
  function wireShell(){
    $$('#viewRoot .step[data-step]').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.step; render(); }));
    const next=$('#wNext'); next&&next.addEventListener('click',()=>{ if(!canAdvance())return; S.step++; S.reached=Math.max(S.reached,S.step); render(); });
    const back=$('#wBack'); back&&back.addEventListener('click',()=>{ S.step--; render(); });
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('hr-directory'));
    const create=$('#wCreate'); create&&create.addEventListener('click',()=>{
      navigate('hr-directory');
      const extra=S.sendInvite?' · invite sent':'';
      setTimeout(()=>toast(`${fullName()} added to People · ${empId} · ${S.dept}${extra}`,'ok'),180);
    });
  }
  render();
};
