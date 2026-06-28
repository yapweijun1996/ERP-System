/* ============================================================
   ARIA ERP — screens: Service (tickets, service order, contracts)
   ============================================================ */

function svcPriorityTone(p){ return {Critical:'danger',High:'warn',Medium:'info',Low:'neutral'}[p]||'neutral'; }
function coverTone(c){ return {'In warranty':'ok','Out of warranty':'neutral','Contract':'violet'}[c]||'neutral'; }

/* ---------------- SERVICE TICKETS (listing) ---------------- */
SCREENS['service-ticket'] = function(root){
  let filter='all';
  const svcMet=t('svc.met'), svcOpen=t('common.open');
  const chips=[['all',t('common.all'),null],['open',ts('Open'),'warn'],['progress',ts('In Progress'),'info'],['scheduled',ts('Scheduled'),'accent'],['done',ts('Resolved'),'ok']];
  function rows(){
    return DB.serviceTickets.filter(t=>{
      if(filter==='all')return true;
      if(filter==='open')return t.status==='Open';
      if(filter==='progress')return t.status==='In Progress';
      if(filter==='scheduled')return t.status==='Scheduled';
      if(filter==='done')return t.status==='Resolved'||t.status==='Closed';
      return true;
    });
  }
  function table(){
    return buildTable({
      checkable:true, rowId:t=>t.no,
      columns:[
        {label:t('svc.col.ticket'),sticky:true,render:t=>`<div class="cellsub"><b class="docnum">${esc(t.no)}</b><small>${esc(t.cust)}</small></div>`},
        {label:t('svc.col.asset'),align:'l',render:t=>`<div class="cellsub"><b>${esc(t.asset)}</b><small>SN ${esc(t.sn)}</small></div>`},
        {label:t('svc.col.issue'),align:'l',render:t=>`<span style="color:var(--muted)">${esc(t.issue)}</span>`},
        {label:t('svc.col.priority'),align:'l',render:t=>cap(ts(t.priority),svcPriorityTone(t.priority))},
        {label:t('svc.col.cover'),align:'l',render:t=>cap(ts(t.cover),coverTone(t.cover))},
        {label:t('svc.col.tech'),align:'l',render:t=>t.tech==='Unassigned'?`<span style="color:var(--warn)">${esc(ts(t.tech))}</span>`:esc(t.tech)},
        {label:'SLA',align:'l',render:t=>t.sla==='Met'?cap(svcMet,'ok'):`<span class="tnum">${esc(t.sla)}</span>`},
        {label:t('col.status'),align:'l',render:t=>statusBadge(t.status)},
        {label:'',align:'c',render:t=>`<span class="rowact"><button data-tip="${esc(svcOpen)}" data-act="open">${ic('ext')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const openN=DB.serviceTickets.filter(t=>t.status==='Open'||t.status==='In Progress').length;
  const sla=DB.serviceTickets.filter(t=>t.sla==='Met').length;
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.service'),t('svc.crumb')])}
      <div class="h1row"><h1>${esc(t('svc.title'))}</h1><span class="countchip" id="svcCount"></span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('svc.kpi.open'))}</small><b class="tnum">${openN}</b></div>
          <div class="kfig"><small>${esc(t('svc.kpi.sla'))}</small><b class="tnum pos">96%</b></div>
        </div></div>
    </div>
    <div class="alert warn"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('svc.alert'))}</b> ${esc(t('svc.alert2'))}</span>
      ${btn(t('svc.openticket'),{icon:'wrench',cls:'soft',attrs:'onclick="navigate(\'service-order\')"'})}</div>
    <div class="toolbar">
      <div class="filterchips" id="svcChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('svc.contractstip'))}" onclick="navigate('service-contracts')">${ic('receipt')}${esc(t('svc.contracts'))}</button>
      ${btn(t('svc.new'),{icon:'plus',cls:'primary',attrs:'onclick="toast(\'New service ticket — draft started\',\'ok\')"'})}
    </div>
    <div class="tablewrap" id="svcTable">${table()}</div>
    <div id="svcBulk"></div>
  </section></div>`;
  const wrap=$('#svcTable');
  $('#svcCount').textContent=rows().length+' '+t('svc.tickets');
  function rewire(){
    wireTable(wrap,{
      onRow:(id)=>{ id==='SVC-26-0042'?navigate('service-order'):toast('Opening '+id,'info'); },
      onSelectionChange:(n)=>{ $('#svcBulk').innerHTML=n?`<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('svc.assign'),{icon:'people',cls:'soft'})}${btn(t('common.close'),{icon:'check',cls:'soft'})}</div>`:''; }
    });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const no=b.closest('.dt-r').dataset.row;no==='SVC-26-0042'?navigate('service-order'):toast('Opening '+no,'info');}));
  }
  rewire();
  $('#svcChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#svcChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#svcCount').textContent=rows().length+' '+t('svc.tickets'); $('#svcBulk').innerHTML=''; rewire();
  }));
};

/* ---------------- SERVICE ORDER (document) ---------------- */
SCREENS['service-order'] = function(root){
  const d=DB.svc0042, c=d.cust;
  const partRows=d.parts.map((p,i)=>{
    const short=p.qty>p.avail;
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(p.name)}</b><small>${esc(p.item)} · ${p.qty} ${esc(p.uom)} @ ${money(p.cost)}</small></td>
      <td class="tnum">${num(p.qty)}</td>
      <td class="tnum" style="color:${short?'var(--danger)':'var(--muted)'}">${num(p.avail)}</td>
      <td class="tnum"><b>${money(p.qty*p.cost)}</b></td>
      <td class="l">${short?cap('Short','danger'):cap('In stock','ok')}</td></tr>`;
  }).join('');
  const partsCost=d.parts.reduce((s,p)=>s+p.qty*p.cost,0);
  const labour=d.labourHrs*d.labourRate, total=partsCost+labour;
  const shortParts=d.parts.filter(p=>p.qty>p.avail);

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,'Service','Tickets',{cur:d.no}])}
      <div class="dochead">
        <div class="dh-row1">
          <div>
            <div class="dt">${ic('wrench')}Service Order <span class="dnum">${esc(d.no)}</span></div>
            <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.asset)} · SN ${esc(d.sn)} · ${esc(c.name)}</div>
          </div>
          <div class="dactions">${cap(d.priority,svcPriorityTone(d.priority))}${cap(d.status,statusCap(d.status))}</div>
        </div>
        <div class="stepper">
          <div class="step done"><span class="sdot">${ic('check')}</span>Logged</div><span class="stepline done"></span>
          <div class="step done"><span class="sdot">${ic('check')}</span>Assigned</div><span class="stepline done"></span>
          <div class="step current"><span class="sdot">${ic('clock')}</span>On-site</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>Resolved</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>Closed</div>
        </div>
        <div class="docmeta">
          <div class="dm"><small>Customer</small><div class="partner"><span class="pav">TY</span><b>${esc(c.name)}</b></div></div>
          <div class="dm"><small>Technician</small><b>${esc(d.tech)}</b></div>
          <div class="dm"><small>Coverage</small><b>${esc(d.cover)}</b></div>
          <div class="dm"><small>Warranty to</small><b>${esc(d.warrantyTo)}</b></div>
          <div class="dm"><small>Contract</small><b>${esc(d.contract)}</b></div>
        </div>
      </div>

      <div class="appr-layout">
        <div class="docmain">
          <div class="panel">
            <div class="panel-h"><h3>Diagnosis</h3></div>
            <div class="panel-body" style="padding-top:12px">
              <div class="risk warn">${ic('info')}<div><b>Reported symptom</b><small>${esc(d.symptom)}</small></div></div>
              <div class="risk ok">${ic('checkc')}<div><b>Technician diagnosis</b><small>${esc(d.diagnosis)}</small></div></div>
              ${shortParts.length?`<div class="risk danger">${ic('warn')}<div><b>Part shortage blocks completion</b><small>${esc(shortParts[0].name)} (0 on hand) — same item inbound on PO-26-0291. SLA at risk.</small></div></div>`:''}
            </div>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Spare parts</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.parts.length} lines</span></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Part</th><th>Qty</th><th>Available</th><th>Cost</th><th class="l">Status</th></tr></thead><tbody>${partRows}</tbody></table>
          </div>
        </div>

        <aside>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">SLA</div>
            <div class="indicator danger">
              <div class="ind-top">${ic('clock')}<span>Response due</span><span class="ind-r">4h left</span></div>
              <div class="track"><i style="width:78%"></i></div>
              <small>Gold SLA · opened ${esc(d.opened)} · due ${esc(d.due)}.</small>
            </div>
            <div class="sumrow" style="margin-top:10px"><span class="sk2">Coverage</span><span class="sv">${cap(d.cover,coverTone(d.cover))}</span></div>
            <div class="sumrow"><span class="sk2">Billable</span><span class="sv">${d.cover==='In warranty'?'No — under warranty':'Yes'}</span></div>
          </div>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Cost (warranty)</div>
            <div class="sumrow"><span class="sk2">Parts</span><span class="sv tnum">${money(partsCost)}</span></div>
            <div class="sumrow"><span class="sk2">Labour · ${d.labourHrs}h @ ${money(d.labourRate)}</span><span class="sv tnum">${money(labour)}</span></div>
            <div class="sumrow total"><span class="sk2">Service cost</span><span class="sv tnum">${money(total)}</span></div>
          </div>
          <div class="sumcard">
            <div class="sectitle" style="margin-top:0">Related</div>
            ${relatedDocs([
              {no:'PO-26-0291',label:'Inbound — Control Module PCB',meta:'+300 ea',status:'Pending Approval'},
              {no:'SC-0033',label:'Service contract — Gold',meta:'4h SLA',status:'Active'},
              {no:c.code,label:esc(c.name),meta:'Customer 360',status:'Active'},
            ])}
          </div>
        </aside>
      </div>
    </div></div>

    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Technician <b style="color:var(--fg)">${esc(d.tech)}</b> on-site · blocked on PCB stock.</div>
      <div class="grow"></div>
      ${btn('Reassign',{icon:'people',cls:'soft',attrs:'onclick="toast(\'Reassign technician\',\'info\')"'})}
      ${btn('Order part',{icon:'cart',cls:'soft',attrs:'onclick="navigate(\'po-approval\')"'})}
      ${btn('Resolve & close',{icon:'check',cls:'primary',sm:false,attrs:'onclick="toast(\'Cannot close — part shortage\',\'warn\')"'})}
    </div>
  </section></div>`;
};

/* ---------------- SERVICE CONTRACTS (master list) ---------------- */
SCREENS['service-contracts'] = function(root){
  function planTone(p){ return {Gold:'violet',Silver:'slate',Bronze:'neutral'}[p]||'neutral'; }
  const active=DB.serviceContracts.filter(c=>c.status==='Active').length;
  const arr=DB.serviceContracts.reduce((s,c)=>s+c.value,0);
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,'Service','Contracts'])}
      <div class="h1row"><h1>Service Contracts</h1><span class="countchip">${DB.serviceContracts.length} contracts</span>
        <div class="headright">
          <div class="kfig"><small>Active</small><b class="tnum">${active}</b></div>
          <div class="kfig"><small>Annual value</small><b class="tnum">${money0(arr)}</b></div>
        </div></div>
      <div class="h1sub">Warranty &amp; maintenance agreements that drive SLA on every service ticket. 2 renewals due this quarter.</div>
    </div>
    <div class="toolbar">
      <div class="filterchips"><button class="chip on">All</button><button class="chip">Active</button><button class="chip">Expiring</button><button class="chip">Gold</button></div>
      <div class="grow"></div>
      ${btn('Back to tickets',{icon:'wrench',cls:'soft',attrs:'onclick="navigate(\'service-ticket\')"'})}
      ${btn('New contract',{icon:'plus',cls:'primary',attrs:'onclick="toast(\'New service contract — draft started\',\'ok\')"'})}
    </div>
    <div class="tablewrap">${buildTable({
      rowId:c=>c.no,
      columns:[
        {label:'Contract',sticky:true,render:c=>`<div class="cellsub"><b class="docnum">${esc(c.no)}</b><small>${esc(c.cust)}</small></div>`},
        {label:'Plan',align:'l',render:c=>cap(c.plan,planTone(c.plan))},
        {label:'SLA',align:'l',render:c=>esc(c.sla)},
        {label:'Assets',align:'r',render:c=>`<span class="tnum">${c.assets}</span>`},
        {label:'Start',align:'l',render:c=>esc(c.start)},
        {label:'Expiry',align:'l',render:c=>c.status==='Expiring'?`<span style="color:var(--warn)">${esc(c.expiry)}</span>`:esc(c.expiry)},
        {label:'Annual value',align:'r',sortable:true,render:c=>`<b class="tnum">${money(c.value)}</b>`},
        {label:'Status',align:'l',render:c=>statusBadge(c.status)},
      ],
      rows:DB.serviceContracts,
    })}</div>
  </section></div>`;
  wireTable(root.querySelector('.tablewrap'),{onRow:(id)=>toast('Opening contract '+id,'info')});
};
