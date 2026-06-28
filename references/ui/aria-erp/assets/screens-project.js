/* ============================================================
   ARIA ERP — screens: Projects (portfolio, project P&L, timesheet)
   ============================================================ */

function projTone(s){
  return {'On track':'ok','At risk':'warn','Over budget':'danger','On hold':'neutral','Completed':'accent'}[s]||'neutral';
}
function pctBar(pct){
  return `<span class="minibar"><i class="${pct>=100?'ok':pct>=60?'':'warn'}" style="width:${pct}%"></i></span> ${pct}%`;
}

/* ---------------- PROJECT PORTFOLIO (listing — module landing) ---------------- */
SCREENS['project-pl'] = function(root){
  let filter='all';
  const chips=[['all',t('common.all'),null],['customer',ts('Customer'),'accent'],['internal',ts('Internal'),'teal'],['risk',ts('At risk'),'warn'],['done',ts('Completed'),'ok']];
  function rows(){
    return DB.projects.filter(p=>{
      if(filter==='all') return true;
      if(filter==='customer') return p.type==='Customer';
      if(filter==='internal') return p.type==='Internal';
      if(filter==='risk') return p.status==='At risk'||p.status==='Over budget';
      if(filter==='done') return p.status==='Completed';
      return true;
    });
  }
  function headroomCell(p){
    const hr=p.contract-p.cost, pctv=p.contract?Math.round(hr/p.contract*100):0;
    const cls=hr<0?'neg':'pos';
    return `<b class="tnum delta ${cls}">${hr<0?'−':''}${money0(Math.abs(hr))}</b> <small style="color:var(--muted)">${pctv}%</small>`;
  }
  function table(){
    return buildTable({
      checkable:true, rowId:p=>p.no,
      columns:[
        {label:t('prj.col.project'),render:p=>`<div class="cellsub"><b class="docnum">${esc(p.no)}</b><small>${esc(p.name)} · ${esc(p.client)}</small></div>`},
        {label:t('qc.col.type'),align:'l',render:p=>cap(ts(p.type),p.type==='Customer'?'accent':'teal')},
        {label:t('prj.col.manager'),align:'l',render:p=>esc(p.pm)},
        {label:t('common.progress'),align:'r',render:p=>pctBar(p.pct)},
        {label:t('prj.col.contract'),align:'r',render:p=>`<span class="tnum">${money0(p.contract)}</span>`},
        {label:t('prj.col.cost'),align:'r',render:p=>`<span class="tnum">${money0(p.cost)}</span>`},
        {label:t('prj.col.headroom'),align:'r',render:p=>headroomCell(p)},
        {label:t('col.status'),align:'l',render:p=>cap(ts(p.status),projTone(p.status))},
        {label:'',align:'c',render:p=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button><button data-tip="${esc(t('prj.timesheet'))}" data-act="ts">${ic('clock')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const active=DB.projects.filter(p=>p.status!=='Completed');
  const wipValue=active.reduce((s,p)=>s+p.contract,0);
  const costToDate=DB.projects.reduce((s,p)=>s+p.cost,0);
  const headroom=active.reduce((s,p)=>s+(p.contract-p.cost),0);
  const atRisk=DB.projects.filter(p=>p.status==='At risk'||p.status==='Over budget').length;

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.project'),t('prj.crumb')])}
      <div class="h1row"><h1>${esc(t('nav.project'))}</h1><span class="countchip" id="prjCount"></span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('prj.kpi.acv'))}</small><b class="tnum">${money0(wipValue)}</b></div>
          <div class="kfig"><small>${esc(t('prj.col.cost'))}</small><b class="tnum">${money0(costToDate)}</b></div>
          <div class="kfig"><small>${esc(t('prj.col.headroom'))}</small><b class="tnum">${money0(headroom)}</b></div>
        </div></div>
    </div>
    <div class="alert warn"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('prj.alert').replaceAll('{n}',atRisk))}</b> ${esc(t('prj.alert2'))}</span>
      ${btn(t('prj.openmes'),{icon:'ext',cls:'soft',attrs:'onclick="toast(\'MES ↔ ERP Integration — drill-down not in this build\',\'info\')"'})}</div>
    <div class="toolbar">
      <div class="filterchips" id="prjChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('prj.timesheettip'))}" onclick="navigate('timesheet')">${ic('clock')}${esc(t('prj.timesheet'))}</button>
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('prj.new'),{icon:'plus',cls:'primary',attrs:'onclick="toast(\'New project — setup wizard not in this build\',\'info\')"'})}
    </div>
    <div class="tablewrap" id="prjTable">${table()}</div>
    <div id="prjBulk"></div>
  </section></div>`;
  const wrap=$('#prjTable');
  $('#prjCount').textContent=rows().length+' '+t('prj.projects');
  function rewire(){
    wireTable(wrap,{
      onRow:(id)=>{ id==='PRJ-26-014'?navigate('project-detail'):toast('Opening '+id,'info'); },
      onSelectionChange:(n)=>{ $('#prjBulk').innerHTML=n?`<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('prj.billms'),{icon:'receipt',cls:'soft'})}${btn(t('prj.exportpl'),{icon:'download',cls:'soft'})}${btn(t('prj.archive'),{icon:'bin',cls:'danger'})}</div>`:''; }
    });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const no=b.closest('.dt-r').dataset.row;no==='PRJ-26-014'?navigate('project-detail'):toast('Opening '+no,'info');}));
    wrap.querySelectorAll('[data-act="ts"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();navigate('timesheet');}));
  }
  rewire();
  $('#prjChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#prjChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#prjCount').textContent=rows().length+' '+t('prj.projects'); $('#prjBulk').innerHTML=''; rewire();
  }));
};

/* ---------------- PROJECT P&L (document) ---------------- */
SCREENS['project-detail'] = function(root){
  const d=DB.proj0014;
  const tB=d.costs.reduce((s,c)=>s+c.budget,0);
  const tA=d.costs.reduce((s,c)=>s+c.actual,0);
  const tC=d.costs.reduce((s,c)=>s+c.committed,0);
  const costRows=d.costs.map((c,i)=>{
    const rem=c.budget-c.actual-c.committed, used=Math.round((c.actual+c.committed)/c.budget*100);
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(c.cat)}</b></td>
      <td class="tnum">${money0(c.budget)}</td>
      <td class="tnum">${money0(c.actual)}</td>
      <td class="tnum" style="color:var(--muted)">${c.committed?money0(c.committed):'—'}</td>
      <td class="tnum" style="color:${rem<0?'var(--danger)':'var(--fg)'}"><b>${rem<0?'−':''}${money0(Math.abs(rem))}</b></td>
      <td class="l"><span class="minibar"><i class="${used>100?'':used>85?'warn':'ok'}" style="width:${Math.min(100,used)}%;${used>100?'background:var(--danger)':''}"></i></span> ${used}%</td></tr>`;
  }).join('');

  const msTone={Billed:'ok','In Progress':'info',Planned:'neutral'};
  const billed=d.milestones.filter(m=>m.status==='Billed').reduce((s,m)=>s+m.amount,0);
  const msRows=d.milestones.map((m,i)=>`<tr>
      <td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(m.name)}</b><small>target ${esc(m.date)}</small></td>
      <td class="tnum">${money0(m.amount)}</td>
      <td class="l">${cap(m.status,msTone[m.status]||'neutral')}</td></tr>`).join('');

  const team=d.team.map(p=>`<div class="oprow">
      <span class="kc-av" style="background:${p.clr};width:30px;height:30px;font-size:11px">${esc(p.av)}</span>
      <div class="opmain"><b>${esc(p.name)}</b><small>${esc(p.role)} · ${p.alloc}% · ${money(p.rate)}/h</small></div>
    </div>`).join('');

  const fMargin=d.contract-d.forecastCost, fMpct=(fMargin/d.contract*100).toFixed(1);
  const spentPct=Math.round((tA+tC)/d.contract*100);

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,'Projects','Portfolio',{cur:d.no}])}
      <div class="dochead">
        <div class="dh-row1">
          <div>
            <div class="dt">${ic('project')}${esc(d.name)} <span class="dnum">${esc(d.no)}</span></div>
            <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.client)} · PM ${esc(d.pm)} · ${esc(d.start)} → ${esc(d.due)}</div>
          </div>
          <div class="dactions">${cap('On track',projTone('On track'))}${btn('Customer 360',{icon:'user',cls:'soft',attrs:'onclick="navigate(\'crm-customer\')"'})}</div>
        </div>
        <div class="stepper">
          <div class="step done"><span class="sdot">${ic('check')}</span>Initiation</div><span class="stepline done"></span>
          <div class="step done"><span class="sdot">${ic('check')}</span>Planning</div><span class="stepline done"></span>
          <div class="step current"><span class="sdot">${ic('clock')}</span>Execution</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>Close-out</div>
        </div>
        <div class="docmeta">
          <div class="dm"><small>Contract value</small><b>${money0(d.contract)}</b></div>
          <div class="dm"><small>Cost to date</small><b>${money0(tA)}</b></div>
          <div class="dm"><small>Billed</small><b>${money0(billed)}</b></div>
          <div class="dm"><small>% complete</small><b>${d.pct}%</b></div>
          <div class="dm"><small>Sponsor</small><b>${esc(d.sponsor)}</b></div>
        </div>
      </div>

      <div class="appr-layout">
        <div class="docmain">
          <div class="panel">
            <div class="panel-h"><h3>Cost breakdown</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.costs.length} categories</span></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Category</th><th>Budget</th><th>Actual</th><th>Committed</th><th>Remaining</th><th class="l">Used</th></tr></thead>
            <tbody>${costRows}</tbody>
            <tfoot><tr><td></td><td class="l" style="font-weight:600">Total</td><td class="tnum"><b>${money0(tB)}</b></td><td class="tnum"><b>${money0(tA)}</b></td><td class="tnum">${money0(tC)}</td><td class="tnum"><b>${money0(tB-tA-tC)}</b></td><td class="l">${Math.round((tA+tC)/tB*100)}%</td></tr></tfoot>
            </table>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Billing milestones</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${money0(billed)} of ${money0(d.contract)} billed</span></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Milestone</th><th>Amount</th><th class="l">Status</th></tr></thead><tbody>${msRows}</tbody></table>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Activity</h3></div>
            <div class="panel-body">${auditTrail(d.activities)}</div>
          </div>
        </div>

        <aside>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Profitability</div>
            <div class="sumrow"><span class="sk2">Contract value</span><span class="sv tnum">${money0(d.contract)}</span></div>
            <div class="sumrow"><span class="sk2">Cost to date</span><span class="sv tnum">${money0(tA)}</span></div>
            <div class="sumrow"><span class="sk2">Committed</span><span class="sv tnum">${money0(tC)}</span></div>
            <div class="sumrow"><span class="sk2">Forecast cost (EAC)</span><span class="sv tnum">${money0(d.forecastCost)}</span></div>
            <div class="sumrow total"><span class="sk2">Forecast margin</span><span class="sv tnum" style="color:var(--ok)">${money0(fMargin)}</span></div>
            <div class="indicator ${fMpct<10?'warn':'ok'}" style="margin-top:12px">
              <div class="ind-top">${ic('percent')}<span>Margin</span><span class="ind-r">${fMpct}%</span></div>
              <div class="track"><i style="width:${Math.min(100,fMpct*4)}%"></i></div>
              <small>${money0(fMargin)} forecast on ${money0(d.contract)} contract.</small>
            </div>
          </div>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Schedule &amp; earned value</div>
            <div class="indicator ${spentPct>d.pct+8?'warn':'ok'}">
              <div class="ind-top">${ic('chart')}<span>${d.pct}% done · ${spentPct}% spent</span><span class="ind-r">${spentPct<=d.pct?'On budget':'Watch'}</span></div>
              <div class="track"><i style="width:${d.pct}%"></i></div>
              <small>Cost &amp; commitment is ${spentPct}% of budget against ${d.pct}% physical progress.</small>
            </div>
            <div class="field"><span class="k">Start</span><span class="v">${esc(d.start)}</span></div>
            <div class="field"><span class="k">Target finish</span><span class="v">${esc(d.due)}</span></div>
          </div>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Team</div>
            <div style="padding:2px 0">${team}</div>
          </div>
          <div class="sumcard">
            <div class="sectitle" style="margin-top:0">Related</div>
            ${relatedDocs([
              {no:'OPP-26-0091',label:'Source opportunity',meta:'Meridian Robotics',status:'Won'},
              {no:'CUST-0007',label:'Meridian Robotics',meta:'Customer 360',status:'Active'},
              {no:'SO-26-0418',label:'Linked sales order',meta:'9 drive units',status:'Pending Approval'},
            ])}
          </div>
        </aside>
      </div>
    </div></div>

    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Next milestone <b style="color:var(--fg)">Install &amp; commissioning</b> · ${money0(145800)} billable on completion.</div>
      <div class="grow"></div>
      ${btn('Log time',{icon:'clock',cls:'soft',attrs:'onclick="navigate(\'timesheet\')"'})}
      ${btn('Raise change order',{icon:'edit',cls:'soft',attrs:'onclick="toast(\'Change order draft started\',\'ok\')"'})}
      ${btn('Bill milestone',{icon:'receipt',cls:'primary',sm:false,attrs:'data-act="bill"'})}
    </div>
  </section></div>`;

  root.querySelector('[data-act="bill"]').addEventListener('click',()=>{
    openModal(`<div class="modal-head">${ic('receipt')}<h3>Bill milestone — ${esc(d.no)}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><p style="color:var(--muted);font-size:13.5px">Raise a progress invoice for <b>Install &amp; commissioning</b> (${money0(145800)}). The milestone is 60% complete — bill the full amount on sign-off or a partial claim now.</p>
        <div class="fld"><span>Amount to bill</span><input value="${money(145800)}" class="tnum"></div></div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Create invoice',{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\'Progress invoice INV-26-0402 created\',\'ok\')"'})}</div>`);
  });
};

/* ---------------- TIMESHEET (weekly grid) ---------------- */
SCREENS['timesheet'] = function(root){
  const t=DB.timesheet;
  const rowTot=r=>r.h.reduce((s,h)=>s+h,0);
  const dayTot=di=>t.rows.reduce((s,r)=>s+r.h[di],0);
  const grand=t.rows.reduce((s,r)=>s+rowTot(r),0);
  function cell(v){ return `<input class="lineinput" style="text-align:center" value="${v?v:''}" placeholder="·">`; }
  const bodyRows=t.rows.map(r=>`<tr>
      <td class="l li-name"><b>${esc(r.proj)}</b><small>${esc(r.task)}</small></td>
      ${r.h.map(h=>`<td class="c">${cell(h)}</td>`).join('')}
      <td class="tnum"><b>${rowTot(r).toFixed(1)}</b></td>
    </tr>`).join('');
  const footCells=t.days.map((_,di)=>{ const dv=dayTot(di); return `<td class="c tnum" style="color:${dv>8?'var(--warn)':'var(--muted)'}">${dv?dv.toFixed(1):'—'}</td>`; }).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,'Projects','Timesheet'])}
      <div class="h1row"><h1>Timesheet</h1><span class="countchip">${esc(t.status)}</span>
        <div class="headright">
          <div class="kfig"><small>Logged this week</small><b class="tnum">${grand.toFixed(1)} h</b></div>
          <div class="kfig"><small>Capacity</small><b class="tnum">${t.capacity} h</b></div>
        </div></div>
    </div>
    <div class="toolbar">
      <button class="viewsel" data-tip="Previous week" onclick="toast('Previous week','info')">${ic('chevL')}</button>
      <button class="viewsel" style="font-weight:600">${ic('calendar')}${esc(t.week)}</button>
      <button class="viewsel" data-tip="Next week" onclick="toast('Next week','info')">${ic('chevR')}</button>
      <div class="grow"></div>
      ${btn('Copy last week',{icon:'copy',cls:'soft',attrs:'onclick="toast(\'Last week copied\',\'ok\')"'})}
      ${btn('Add line',{icon:'plus',cls:'soft',attrs:'onclick="toast(\'Add a project line\',\'info\')"'})}
      ${btn('Submit for approval',{icon:'check',cls:'primary',attrs:'data-act="submit"'})}
    </div>
    <div class="docpage" style="max-width:none;margin:0;padding:0;border:none;background:transparent">
      <div class="panel">
        <div class="panel-h"><h3>${esc(t.employee)} · ${esc(t.week)}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${t.rows.length} lines</span></div>
        <table class="lines tssheet">
          <thead><tr><th class="l">Project / Task</th>${t.days.map(d=>`<th class="c">${d}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>${bodyRows}</tbody>
          <tfoot><tr><td class="l" style="font-weight:600">Daily total</td>${footCells}<td class="tnum"><b>${grand.toFixed(1)}</b></td></tr></tfoot>
        </table>
      </div>
      <div style="max-width:420px;margin-top:14px">
        <div class="indicator ${grand>t.capacity?'warn':'ok'}">
          <div class="ind-top">${ic('clock')}<span>Utilisation</span><span class="ind-r">${Math.round(grand/t.capacity*100)}%</span></div>
          <div class="track"><i style="width:${Math.min(100,grand/t.capacity*100)}%"></i></div>
          <small>${grand.toFixed(1)} h logged of ${t.capacity} h capacity · ${(t.capacity-grand).toFixed(1)} h remaining.</small>
        </div>
      </div>
      <div style="height:40px"></div>
    </div>
  </section></div>`;

  root.querySelector('[data-act="submit"]').addEventListener('click',()=>{
    toast('Timesheet submitted for approval','ok');
  });
};
