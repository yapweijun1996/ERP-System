/* ============================================================
   ARIA ERP — screens: HR / Payroll
   (Employee Directory, Employee Profile, Payroll Run, Payslip)
   ============================================================ */

function empTone(s){ return {Active:'ok','On leave':'info',Probation:'warn',Resigned:'neutral'}[s]||'neutral'; }
function maskSalary(v){ return DB.user.perms.salaryView ? money0(v) : '••••••'; }

/* ---------------- EMPLOYEE DIRECTORY (listing — module landing) ---------------- */
SCREENS['hr-directory'] = function(root){
  let filter='all';
  const depts=[...new Set(DB.employees.map(e=>e.dept))];
  const chips=[['all',t('common.all')]].concat(depts.map(d=>[d,d]));
  function rows(){ return filter==='all'?DB.employees:DB.employees.filter(e=>e.dept===filter); }
  function table(){
    return buildTable({
      rowId:e=>e.id,
      columns:[
        {label:t('hr.col.employee'),render:e=>`<div style="display:flex;align-items:center;gap:11px"><span class="kc-av" style="background:${e.clr};width:30px;height:30px;font-size:11px">${esc(e.av)}</span><div class="cellsub"><b>${esc(e.name)}</b><small>${esc(e.id)}</small></div></div>`},
        {label:t('hr.col.dept'),align:'l',render:e=>esc(e.dept)},
        {label:t('hr.col.role'),align:'l',render:e=>esc(e.role)},
        {label:t('qc.col.type'),align:'l',render:e=>e.type==='Contract'?cap(t('hr.emp.contract'),'violet'):cap(t('hr.emp.fulltime'),'neutral')},
        {label:t('hr.col.joined'),align:'l',render:e=>esc(e.joined)},
        {label:t('col.status'),align:'l',render:e=>cap(ts(e.status),empTone(e.status))},
        {label:'',align:'c',render:e=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const onLeave=DB.employees.filter(e=>e.status==='On leave').length;
  const probation=DB.employees.filter(e=>e.status==='Probation').length;
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:23px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.hr'),t('hr.crumb')])}
      <div class="h1row"><h1>${esc(t('hr.title'))}</h1><span class="countchip" id="hrCount"></span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile(t('hr.t.headcount'),DB.employees.length,t('hr.acrossdepts').replaceAll('{n}',depts.length))}
      ${statTile(t('hr.t.onleave'),onLeave,t('hr.t.onleavesub'),'var(--accent)')}
      ${statTile(t('hr.t.pending'),DB.leave.filter(l=>l.status==='Pending Approval').length,t('hr.t.pendingsub'),'var(--warn)')}
      ${statTile(t('hr.t.probation'),probation,t('hr.t.probationsub'),'var(--warn)')}
    </div></div>
    <div class="toolbar">
      <div class="filterchips" id="hrChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('hr.leavetip'))}" onclick="navigate('leave-approval')">${ic('calendar')}${esc(t('hr.leave'))}</button>
      <button class="viewsel" data-tip="${esc(t('hr.payrolltip'))}" onclick="navigate('payroll-run')">${ic('coins')}${esc(t('hr.payroll'))}</button>
      ${btn(t('hr.add'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-employee\')"'})}
    </div>
    <div class="tablewrap" id="hrTable">${table()}</div>
  </section></div>`;
  $('#hrCount').textContent=rows().length+' '+t('hr.employees');
  function rewire(){
    wireTable($('#hrTable'),{ onRow:(id)=>{ id==='EMP-1042'?navigate('employee'):toast('Open profile · '+id,'info'); } });
    $('#hrTable').querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const id=b.closest('.dt-r').dataset.row;id==='EMP-1042'?navigate('employee'):toast('Open profile · '+id,'info');}));
  }
  rewire();
  $('#hrChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ $('#hrChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f; $('#hrTable').innerHTML=table(); $('#hrCount').textContent=rows().length+' '+t('hr.employees'); rewire(); }));
};

/* ---------------- EMPLOYEE PROFILE (master) ---------------- */
SCREENS['employee'] = function(root){
  const e=DB.emp1042;
  const annPct=Math.round((e.leave.annualTotal-e.leave.annualUsed)/e.leave.annualTotal*100);
  const medPct=Math.round((e.leave.medTotal-e.leave.medUsed)/e.leave.medTotal*100);
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:980px">
    ${crumbs([DB.company.name,'HR','Directory',{cur:e.id}])}
    <div class="dochead">
      <div class="dh-row1">
        <div style="display:flex;gap:14px;align-items:center"><span class="kc-av" style="background:${e.clr};width:48px;height:48px;font-size:17px;border-radius:13px">${esc(e.av)}</span>
          <div><div class="dt">${esc(e.name)} <span class="dnum">${esc(e.id)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(e.role)} · ${esc(e.dept)} · reports to ${esc(e.manager)}</div></div></div>
        <div class="dactions">${cap(e.status,empTone(e.status))}${btn('Message',{icon:'send',cls:'soft'})}${btn('Edit',{icon:'edit',cls:'soft'})}</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Department</small><b>${esc(e.dept)}</b></div>
        <div class="dm"><small>Employment</small><b>${esc(e.type)}</b></div>
        <div class="dm"><small>Joined</small><b>${esc(e.joined)}</b></div>
        <div class="dm"><small>Manager</small><b>${esc(e.manager)}</b></div>
        <div class="dm"><small>Location</small><b>${esc(e.location)}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Personal &amp; contact</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Email</span><input value="${esc(e.email)}" readonly></div>
            <div class="fld"><span>Phone</span><input value="${esc(e.phone)}" readonly></div>
            <div class="fld"><span>Bank account</span><input value="${esc(e.bank)}" readonly></div>
          </div>
          <div class="fldrow c3" style="margin-top:4px">
            <div class="fld"><span>Emergency contact</span><input value="${esc(e.emergency.name)} (${esc(e.emergency.rel)})" readonly></div>
            <div class="fld"><span>Emergency phone</span><input value="${esc(e.emergency.phone)}" readonly></div>
            <div class="fld"><span>Location</span><input value="${esc(e.location)}" readonly></div>
          </div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Leave balances</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">FY2026</span></div><div class="panel-body" style="padding-top:12px">
          <div class="indicator ok" style="margin-bottom:8px"><div class="ind-top">${ic('calendar')}<span>Annual leave</span><span class="ind-r">${e.leave.annualTotal-e.leave.annualUsed} / ${e.leave.annualTotal} days</span></div><div class="track"><i style="width:${annPct}%"></i></div><small>${e.leave.annualUsed} days taken · currently on annual leave Jun 16–20.</small></div>
          <div class="indicator ok"><div class="ind-top">${ic('drop')}<span>Medical leave</span><span class="ind-r">${e.leave.medTotal-e.leave.medUsed} / ${e.leave.medTotal} days</span></div><div class="track"><i style="width:${medPct}%"></i></div><small>${e.leave.medUsed} days taken this year.</small></div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Documents</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${e.documents.length}</span></div><div class="panel-body">${attachments(e.documents)}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Compensation</div>
          ${DB.user.perms.salaryView
            ? `<div class="sumrow"><span class="sk2">Annual</span><span class="sv tnum">${money0(e.annual)}</span></div><div class="sumrow total"><span class="sk2">Monthly</span><span class="sv tnum">${money0(e.monthly)}</span></div>`
            : `<div class="sumrow"><span class="sk2">Annual</span><span class="sv tnum">${maskSalary(e.annual)}</span></div><div class="sumrow total"><span class="sk2">Monthly</span><span class="sv tnum">${maskSalary(e.monthly)}</span></div>
               <div class="indicator warn" style="margin-top:10px"><div class="ind-top">${ic('lock')}<span>Restricted field</span></div><small>Salary is masked — requires HR / Compensation permission to reveal.</small></div>`}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Tenure</div>
          <div class="field"><span class="k">Service</span><span class="v">5 years</span></div>
          <div class="field"><span class="k">Next review</span><span class="v">Sep 2026</span></div>
          <div class="field"><span class="k">Status</span><span class="v">${esc(e.status)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:'PSL-26-0642',label:'June payslip',meta:'net pay',status:'Posted'},
            {no:'LV-26-0331',label:'Annual leave',meta:'Jun 16–20',status:'Pending Approval'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div class="grow"></div>
      ${btn('View payslip',{icon:'receipt',cls:'soft',attrs:'onclick="navigate(\'payslip\')"'})}
      ${btn('Approve leave',{icon:'check',cls:'primary',sm:false,attrs:'onclick="navigate(\'leave-approval\')"'})}
    </div>
  </div></div></section></div>`;
};

/* ---------------- PAYROLL RUN (report) ---------------- */
SCREENS['payroll-run'] = function(root){
  const p=DB.payrollRun;
  const gross=p.rows.reduce((s,r)=>s+r.gross,0);
  const epf=p.rows.reduce((s,r)=>s+r.epf,0);
  const tax=p.rows.reduce((s,r)=>s+r.tax,0);
  const net=gross-epf-tax;
  const rowHtml=p.rows.map((r,i)=>`<tr class="payrow" data-emp="${esc(r.name)}">
    <td class="lineno">${i+1}</td>
    <td class="l li-name"><div style="display:flex;align-items:center;gap:10px"><span class="kc-av" style="background:${r.clr};width:26px;height:26px;font-size:10px">${esc(r.av)}</span><div><b>${esc(r.name)}</b><small>${esc(r.dept)}</small></div></div></td>
    <td class="tnum">${money0(r.gross)}</td>
    <td class="tnum" style="color:var(--muted)">${money0(r.epf)}</td>
    <td class="tnum" style="color:var(--muted)">${money0(r.tax)}</td>
    <td class="tnum"><b>${money0(r.gross-r.epf-r.tax)}</b></td></tr>`).join('');
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:22px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,'HR','Payroll',{cur:p.period}])}
      <div class="h1row"><h1>Payroll Run</h1><span class="countchip">${cap(p.status,'warn')}</span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile('Headcount',p.rows.length,'salaried staff · '+p.period)}
      ${statTile('Gross pay',money0(gross),'before deductions')}
      ${statTile('EPF + tax',money0(epf+tax),'statutory & PCB','var(--warn)')}
      ${statTile('Net pay',money0(net),'pay date '+p.payDate,'var(--ok)')}
    </div></div>
    <div class="toolbar">
      <button class="viewsel" data-tip="Period">${ic('calendar')}${esc(p.period)}${ic('chevD')}</button>
      <div class="grow"></div>
      ${btn('Export bank file',{icon:'download',cls:'soft',attrs:'onclick="toast(\'Bank giro file generated · '+p.rows.length+' credits\',\'ok\')"'})}
      ${btn('Approve & lock run',{icon:'check',cls:'primary',attrs:'data-act="lock"'})}
    </div>
    <div class="docpage" style="max-width:none;margin:0;padding:0 24px 24px;border:none;background:transparent">
      <div class="panel">
        <div class="panel-h"><h3>Employees</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">click a row for the payslip</span></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Employee</th><th>Gross</th><th>EPF</th><th>Tax (PCB)</th><th>Net pay</th></tr></thead>
          <tbody>${rowHtml}</tbody>
          <tfoot><tr><td></td><td class="l" style="font-weight:600">Totals · ${p.rows.length} staff</td><td class="tnum"><b>${money0(gross)}</b></td><td class="tnum">${money0(epf)}</td><td class="tnum">${money0(tax)}</td><td class="tnum"><b>${money0(net)}</b></td></tr></tfoot>
        </table>
      </div>
      <div style="height:30px"></div>
    </div>
  </section></div>`;
  root.querySelectorAll('.payrow').forEach(r=>r.style.cursor='pointer');
  root.querySelectorAll('.payrow').forEach(r=>r.addEventListener('click',()=>{ r.dataset.emp==='Marcus Silva'?navigate('payslip'):toast('Payslip · '+r.dataset.emp,'info'); }));
  root.querySelector('[data-act="lock"]').addEventListener('click',()=>{
    appModal({ icon:'lock', title:'Approve & lock June payroll?',
      body:`<p style="color:var(--muted);font-size:13.5px">Locking posts the payroll journal (salary expense, EPF & tax payable) and releases <b>${money0(net)}</b> in net pay across ${p.rows.length} employees on ${esc(p.payDate)}.</p>`,
      actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Approve & post',{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\'June payroll approved & posted to GL\',\'ok\')"'})}` });
  });
};

/* ---------------- PAYSLIP (document) ---------------- */
SCREENS['payslip'] = function(root){
  const s=DB.payslip1042;
  const earn=s.earnings.reduce((a,x)=>a+x.v,0);
  const ded=s.deductions.reduce((a,x)=>a+x.v,0);
  const net=earn-ded;
  const empCont=s.employer.reduce((a,x)=>a+x.v,0);
  const rows=(arr)=>arr.map(x=>`<tr><td class="l li-name"><b>${esc(x.k)}</b></td><td class="tnum">${money(x.v)}</td></tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:920px">
    ${crumbs([DB.company.name,'HR','Payslips',{cur:s.id}])}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('receipt')}Payslip <span class="dnum">${esc(s.id)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(s.emp)} · ${esc(s.role)} · ${esc(s.period)}</div></div>
        <div class="dactions">${cap('Posted','teal')}${btn('Download PDF',{icon:'filepdf',cls:'soft'})}</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Employee</small><b>${esc(s.emp)} · ${esc(s.empId)}</b></div>
        <div class="dm"><small>Period</small><b>${esc(s.period)}</b></div>
        <div class="dm"><small>Pay date</small><b>${esc(s.payDate)}</b></div>
        <div class="dm"><small>Bank</small><b>${esc(s.bank)}</b></div>
        <div class="dm"><small>Days paid</small><b>${s.days}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Earnings</h3></div>
          <table class="lines"><tbody>${rows(s.earnings)}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Gross earnings</td><td class="tnum"><b>${money(earn)}</b></td></tr></tfoot></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Deductions</h3></div>
          <table class="lines"><tbody>${rows(s.deductions)}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Total deductions</td><td class="tnum"><b>${money(ded)}</b></td></tr></tfoot></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Employer contributions</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">not deducted from pay</span></div>
          <table class="lines"><tbody>${rows(s.employer)}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Total employer cost</td><td class="tnum"><b>${money(empCont)}</b></td></tr></tfoot></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Net pay</div>
          <div class="sumrow"><span class="sk2">Gross</span><span class="sv tnum">${money(earn)}</span></div>
          <div class="sumrow disc"><span class="sk2">Deductions</span><span class="sv tnum">−${money(ded)}</span></div>
          <div class="sumrow total"><span class="sk2">Net pay</span><span class="sv tnum">${money(net)}</span></div>
          <div class="indicator ok" style="margin-top:12px"><div class="ind-top">${ic('coins')}<span>Paid to ${esc(s.bank)}</span><span class="ind-r">${money0(net)}</span></div><small>Credited on ${esc(s.payDate)}.</small></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Year to date</div>
          <div class="sumrow"><span class="sk2">Gross YTD</span><span class="sv tnum">${money0(earn*6)}</span></div>
          <div class="sumrow"><span class="sk2">EPF YTD</span><span class="sv tnum">${money0(s.deductions[0].v*6)}</span></div>
          <div class="sumrow"><span class="sk2">Tax YTD</span><span class="sv tnum">${money0(s.deductions[1].v*6)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:s.empId,label:esc(s.emp),meta:'Employee profile',status:'Active'},
            {no:'June 2026',label:'Payroll run',meta:'8 staff',status:'Pending Approval'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Net pay <b style="color:var(--fg)">${money(net)}</b> · ${esc(s.payDate)}.</div>
      <div class="grow"></div>
      ${btn('Email payslip',{icon:'send',cls:'soft',attrs:'onclick="toast(\'Payslip emailed to '+esc(s.emp)+'\',\'ok\')"'})}
      ${btn('Back to payroll',{icon:'coins',cls:'primary',sm:false,attrs:'onclick="navigate(\'payroll-run\')"'})}
    </div>
  </div></div></section></div>`;
};
