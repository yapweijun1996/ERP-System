/* ============================================================
   ARIA ERP — screens: Manufacturing (work orders, work order doc, BOM, MRP)
   ============================================================ */

function woTone(st){
  return {Planned:'neutral',Released:'accent','In Progress':'info','On Hold':'warn',Blocked:'danger',Completed:'ok',Closed:'neutral'}[st]||'neutral';
}

/* ---------------- WORK ORDERS (listing) ---------------- */
SCREENS['work-orders'] = function(root){
  let filter='all';
  const chips=[['all',t('common.all'),null],['planned',ts('Planned'),null],['released',ts('Released'),'accent'],['progress',ts('In Progress'),'info'],['done',ts('Completed'),'ok']];
  function rows(){
    return DB.workOrders.filter(w=>{
      if(filter==='all')return true;
      if(filter==='planned')return w.status==='Planned';
      if(filter==='released')return w.status==='Released';
      if(filter==='progress')return w.status==='In Progress';
      if(filter==='done')return w.status==='Completed';
      return true;
    });
  }
  function table(){
    return buildTable({
      checkable:true, rowId:w=>w.no,
      columns:[
        {label:t('wo.col.no'),sticky:true,render:w=>`<div class="cellsub"><b class="docnum">${esc(w.no)}</b><small>${esc(w.product)} · ${esc(w.rev)}</small></div>`},
        {label:t('appr.col.qty'),align:'r',render:w=>`<span class="tnum">${num(w.qty)}</span>`},
        {label:t('wo.col.start'),align:'l',sortable:true,render:w=>esc(w.start)},
        {label:t('wo.col.due'),align:'l',sortable:true,render:w=>esc(w.due)},
        {label:t('wo.col.wc'),align:'l',render:w=>esc(w.wc)},
        {label:t('wo.col.materials'),align:'c',render:w=>w.status==='Completed'?cap(t('wo.mat.consumed'),'ok'):w.matReady?cap(t('wo.mat.ready'),'ok'):cap(t('wo.mat.short'),'danger')},
        {label:t('common.progress'),align:'r',render:w=>`<span class="minibar"><i class="${w.progress>=100?'ok':w.progress>0?'warn':''}" style="width:${w.progress}%"></i></span> ${w.progress}%`},
        {label:t('col.status'),align:'l',render:w=>cap(ts(w.status),woTone(w.status))+(w.flag?` <span data-tip="${esc(w.flag)}">${ic('warn')}</span>`:'')},
        {label:'',align:'c',render:w=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button><button data-tip="${esc(t('common.duplicate'))}">${ic('copy')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const wip=DB.workOrders.filter(w=>w.status==='In Progress').length;
  const openVal=DB.workOrders.filter(w=>w.status!=='Completed').reduce((s,w)=>s+w.qty*(DB.items.find(i=>i.sku===w.fg)?.cost||0),0);
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.manufacturing'),t('wo.title')])}
      <div class="h1row"><h1>${esc(t('wo.title'))}</h1><span class="countchip" id="woCount"></span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('wo.kpi.wip'))}</small><b class="tnum">${wip}</b></div>
          <div class="kfig"><small>${esc(t('wo.kpi.openval'))}</small><b class="tnum">${money0(openVal)}</b></div>
        </div></div>
    </div>
    <div class="alert warn"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('wo.alert'))}</b> ${esc(t('wo.alert2'))}</span>
      ${btn(t('wo.reviewpo'),{icon:'flow',cls:'soft',attrs:'onclick="navigate(\'po-approval\')"'})}</div>
    <div class="toolbar">
      <div class="filterchips" id="woChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('wo.mrptip'))}" onclick="navigate('mrp')">${ic('chart')}${esc(t('wo.mrp'))}</button>
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('wo.new'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-work-order\')"'})}
    </div>
    <div class="tablewrap" id="woTable">${table()}</div>
    <div id="woBulk"></div>
  </section></div>`;
  const wrap=$('#woTable');
  $('#woCount').textContent=rows().length+' '+t('so.orders');
  function rewire(){
    wireTable(wrap,{
      onRow:(id)=>{ if(id==='WO-26-0081'){navigate('work-order');} else toast('Opening '+id,'info'); },
      onSelectionChange:(n)=>{ $('#woBulk').innerHTML=n?`<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('wo.release'),{icon:'play',cls:'soft'})}${btn(t('wo.printtrav'),{icon:'print',cls:'soft'})}${btn(t('common.cancel'),{icon:'x',cls:'danger'})}</div>`:''; }
    });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const no=b.closest('.dt-r').dataset.row;no==='WO-26-0081'?navigate('work-order'):toast('Opening '+no,'info');}));
  }
  rewire();
  $('#woChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#woChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#woCount').textContent=rows().length+' '+t('so.orders'); $('#woBulk').innerHTML=''; rewire();
  }));
};

/* ---------------- WORK ORDER (transaction document) ---------------- */
SCREENS['work-order'] = function(root){
  const d=DB.wo0081;
  const matRows=d.materials.map((l,i)=>{
    const req=l.qtyPer*d.qty, short=Math.max(0,req-l.avail), open=req-l.issued;
    const state = short>0 ? cap('Short '+num(short),'danger') : l.issued>=req ? cap('Issued','ok') : cap('Available','accent');
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)} · ${l.qtyPer} ${esc(l.uom)}/unit @ ${money(l.cost)}</small></td>
      <td class="tnum">${num(req)} ${esc(l.uom)}</td>
      <td class="tnum">${num(l.issued)}</td>
      <td class="tnum" style="color:${l.avail< (req-l.issued)?'var(--danger)':'var(--muted)'}">${num(l.avail)}</td>
      <td class="tnum"><b>${money(req*l.cost)}</b></td>
      <td class="l">${state}</td></tr>`;
  }).join('');

  // cost roll-up
  const matUnit=d.materials.reduce((s,l)=>s+l.qtyPer*l.cost,0);
  const hrsUnit=d.operations.reduce((s,o)=>s+o.hrs,0);
  const labUnit=hrsUnit*d.labourRate, ohUnit=labUnit*d.overheadPct/100, unitTotal=matUnit+labUnit+ohUnit;
  const matT=matUnit*d.qty, labT=labUnit*d.qty, ohT=ohUnit*d.qty, total=unitTotal*d.qty;
  const std=(DB.items.find(i=>i.sku===d.fg)?.cost||0)*d.qty, varT=total-std;

  const shortLines=d.materials.filter(l=>l.qtyPer*d.qty-l.avail>0);
  const readyCount=d.materials.length-shortLines.length;

  const opTone={Completed:'ok','In Progress':'info',Blocked:'danger',Pending:'neutral'};
  const opRows=d.operations.map(o=>`<div class="oprow">
      <span class="opseq">${o.seq}</span>
      <div class="opmain"><b>${esc(o.name)}</b><small>${esc(o.wc)} · ${o.hrs.toFixed(2)} h/unit · ${(o.hrs*d.qty).toFixed(1)} h total</small></div>
      ${cap(o.status,opTone[o.status]||'neutral')}
    </div>`).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,'Manufacturing','Work Orders',{cur:d.no}])}
      <div class="dochead">
        <div class="dh-row1">
          <div>
            <div class="dt">${ic('factory')}Work Order <span class="dnum">${esc(d.no)}</span></div>
            <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.product)} · ${esc(d.rev)} · ${num(d.qty)} ${esc(d.uom)} · planner ${esc(d.planner)}</div>
          </div>
          <div class="dactions">${cap(d.status,woTone(d.status))}${btn('Bill of materials',{icon:'box',cls:'soft',attrs:'onclick="navigate(\'bom\')"'})}</div>
        </div>
        <div class="stepper">
          <div class="step done"><span class="sdot">${ic('check')}</span>Draft</div><span class="stepline done"></span>
          <div class="step done"><span class="sdot">${ic('check')}</span>Released</div><span class="stepline done"></span>
          <div class="step current"><span class="sdot">${ic('clock')}</span>In Progress</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>QC</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>Completed</div>
        </div>
        <div class="docmeta">
          <div class="dm"><small>Finished good</small><b>${esc(d.fg)}</b></div>
          <div class="dm"><small>Start</small><b>${esc(d.start)}</b></div>
          <div class="dm"><small>Due</small><b>${esc(d.due)}</b></div>
          <div class="dm"><small>Warehouse</small><b>${esc(d.warehouse)}</b></div>
          <div class="dm"><small>Demand source</small><b>${esc(d.demand)}</b></div>
        </div>
      </div>

      <div class="appr-layout">
        <div class="docmain">
          <div class="panel">
            <div class="panel-h"><h3>Production status</h3></div>
            <div class="panel-body" style="padding-top:12px">
              ${shortLines.length?`<div class="risk danger">${ic('warn')}<div><b>Material shortage halts operation 30</b><small>${esc(shortLines[0].name)} short ${num(shortLines[0].qtyPer*d.qty-shortLines[0].avail)} ${esc(shortLines[0].uom)} — Control Module Install cannot start. Inbound PO-26-0291 expected Jun 22.</small></div></div>`:''}
              <div class="risk warn">${ic('info')}<div><b>Operation 20 in progress</b><small>Bearing &amp; Shaft Fit running on Assembly Line 1 — ${d.progress}% of the order complete.</small></div></div>
              <div class="risk ok">${ic('checkc')}<div><b>${readyCount} of ${d.materials.length} material lines available</b><small>Sub-assembly, bearings, extrusion and packaging are on hand for the full quantity.</small></div></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Material requirements</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.materials.length} components</span></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Component</th><th>Required</th><th>Issued</th><th>Available</th><th>Cost</th><th class="l">Status</th></tr></thead><tbody>${matRows}</tbody></table>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Routing &amp; operations</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${hrsUnit.toFixed(2)} h/unit</span></div>
            <div class="panel-body" style="padding:6px 0">${opRows}</div>
          </div>
        </div>

        <aside>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Cost roll-up</div>
            <div class="sumrow"><span class="sk2">Material</span><span class="sv tnum">${money(matT)}</span></div>
            <div class="sumrow"><span class="sk2">Labour · ${hrsUnit.toFixed(2)}h @ ${money(d.labourRate)}</span><span class="sv tnum">${money(labT)}</span></div>
            <div class="sumrow"><span class="sk2">Overhead (${d.overheadPct}%)</span><span class="sv tnum">${money(ohT)}</span></div>
            <div class="sumrow total"><span class="sk2">Planned cost</span><span class="sv tnum">${money(total)}</span></div>
            <div class="sumrow"><span class="sk2">Per unit</span><span class="sv tnum">${money(unitTotal)}</span></div>
            <div class="indicator ${Math.abs(varT)<total*0.03?'ok':'warn'}" style="margin-top:12px">
              <div class="ind-top">${ic('chart')}<span>vs standard cost</span><span class="ind-r">${varT>=0?'+':''}${money(varT)}</span></div>
              <small>Standard ${money(std)} for ${num(d.qty)} ${esc(d.uom)} · variance ${(varT/std*100).toFixed(1)}%.</small>
            </div>
          </div>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Material readiness</div>
            <div class="indicator ${shortLines.length?'danger':'ok'}">
              <div class="ind-top">${ic(shortLines.length?'warn':'checkc')}<span>${readyCount}/${d.materials.length} lines ready</span><span class="ind-r">${Math.round(readyCount/d.materials.length*100)}%</span></div>
              <div class="track"><i style="width:${Math.round(readyCount/d.materials.length*100)}%"></i></div>
              <small>${shortLines.length?`${shortLines.length} line short — release blocked until PO-26-0291 receipt.`:'All components available.'}</small>
            </div>
          </div>
          <div class="sumcard">
            <div class="sectitle" style="margin-top:0">Related</div>
            ${relatedDocs([
              {no:'BOM · '+d.rev,label:'Bill of materials',meta:esc(d.product),status:'Active'},
              {no:'PO-26-0291',label:'Inbound — Control Module PCB',meta:'+300 ea · Jun 22',status:'Pending Approval'},
              {no:'SO-26-0417',label:'Sales order — Apex Industrial',meta:'demand source',status:'Approved'},
            ])}
          </div>
        </aside>
      </div>
    </div></div>

    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Operation <b style="color:var(--fg)">20 of 50</b> running · next operation blocked on Control Module PCB.</div>
      <div class="grow"></div>
      ${btn('Issue materials',{icon:'transfer',cls:'soft',attrs:'onclick="navigate(\'stock-movement\')"'})}
      ${btn('Report production',{icon:'factory',cls:'soft',attrs:'onclick="toast(\'Production reported — 6 of 15 complete\',\'ok\')"'})}
      ${btn('Complete & receive FG',{icon:'check',cls:'primary',sm:false,attrs:'data-act="finish"'})}
    </div>
  </section></div>`;

  root.querySelector('[data-act="finish"]').addEventListener('click',()=>{
    appModal({
      icon: 'warn',
      title: `Cannot complete ${d.no}`,
      body: `<p style="color:var(--muted);font-size:13.5px">This work order has <b>1 material short</b> (Control Module PCB v3, −15 ea) and 2 open operations. Complete &amp; FG receipt is blocked until materials are issued and QC passes.</p>`,
      actions: `${btn('Close',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Go to inbound PO',{icon:'flow',cls:'primary',attrs:'onclick="closeModal();navigate(\'po-approval\')"'})}`,
    });
  });
};

/* ---------------- BOM (master data) ---------------- */
SCREENS['bom'] = function(root){
  const b=DB.bom;
  const rolled=b.components.reduce((s,c)=>s+c.qty*c.cost,0);
  const rolledScrap=b.components.reduce((s,c)=>s+c.qty*c.cost*(1+c.scrap/100),0);
  const compRows=b.components.map((c,i)=>`<tr>
      <td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(c.name)}</b><small>${esc(c.item)} · ${esc(c.cat)}</small></td>
      <td class="tnum">${num(c.qty)} ${esc(c.uom)}</td>
      <td class="tnum">${c.scrap?c.scrap+'%':'—'}</td>
      <td class="tnum">${money(c.cost)}</td>
      <td class="tnum"><b>${money(c.qty*c.cost)}</b></td>
    </tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,'Manufacturing','Bill of Materials',{cur:b.fg}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('box')}${esc(b.product)} <span class="dnum">${esc(b.fg)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(b.rev)} · effective ${esc(b.effective)} · yields ${num(b.qtyPer)} ${esc(b.uom)}</div></div>
        <div class="dactions">${cap('Active','ok')}${btn('Revise',{icon:'edit',cls:'soft'})}${btn('Create work order',{icon:'factory',cls:'primary',attrs:'onclick="navigate(\'work-order\')"'})}</div></div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>Components</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${b.components.length} lines</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Component</th><th>Qty / unit</th><th>Scrap</th><th>Unit cost</th><th>Ext. cost</th></tr></thead>
          <tbody>${compRows}</tbody>
          <tfoot><tr><td></td><td class="l" style="font-weight:600">Rolled-up material cost</td><td></td><td></td><td class="tnum" style="color:var(--muted)">incl. scrap</td><td class="tnum"><b>${money(rolled)}</b></td></tr></tfoot>
          </table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Routing</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Operations</span><input value="5 operations · 12.75 h" readonly></div>
            <div class="fld"><span>Primary work centre</span><input value="Assembly Line 1" readonly></div>
            <div class="fld"><span>Default warehouse</span><input value="KL-Main" readonly></div>
          </div>
          <div style="font-size:12.5px;color:var(--muted)">Routing detail (Frame Assembly → Bearing &amp; Shaft Fit → Control Module Install → Function Test &amp; QC → Pack &amp; Label) is applied to every work order created from this BOM.</div>
        </div></div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Cost summary</div>
          <div class="sumrow"><span class="sk2">Material (net)</span><span class="sv tnum">${money(rolled)}</span></div>
          <div class="sumrow"><span class="sk2">Material (w/ scrap)</span><span class="sv tnum">${money(rolledScrap)}</span></div>
          <div class="sumrow"><span class="sk2">Labour + overhead</span><span class="sv tnum">${money(b.stdCost-rolled)}</span></div>
          <div class="sumrow total"><span class="sk2">Standard cost</span><span class="sv tnum">${money(b.stdCost)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Where used</div>
          ${relatedDocs(b.whereUsed)}
        </div>
      </aside>
    </div>
    <div style="height:60px"></div>
  </div></div></section></div>`;
};

/* ---------------- MRP (material requirements report) ---------------- */
SCREENS['mrp'] = function(root){
  function netCell(v){ const cls=v<0?'neg':'pos'; return `<b class="tnum delta ${cls}">${v>0?'+':''}${num(v)}</b>`; }
  function table(){
    const tpl='minmax(220px,2.2fr) minmax(150px,1.4fr) 90px 90px 90px 96px minmax(170px,1.3fr)';
    let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
      <div class="dt-r dt-head"><div class="dt-c l">Item</div><div class="dt-c l">Demand source</div><div class="dt-c r">Gross req</div><div class="dt-c r">On hand</div><div class="dt-c r">On order</div><div class="dt-c r">Net</div><div class="dt-c l">Suggested action</div></div>
      <div class="dt-body">`;
    DB.mrp.forEach(m=>{
      h+=`<div class="dt-r drill" data-route="${m.route}"><div class="dt-c l"><div class="cellsub"><b>${esc(m.name)}</b><small>${esc(m.item)}</small></div></div>
        <div class="dt-c l" style="color:var(--muted)">${esc(m.demand)}</div>
        <div class="dt-c r tnum">${num(m.gross)}</div>
        <div class="dt-c r tnum">${num(m.onHand)}</div>
        <div class="dt-c r tnum" style="color:var(--muted)">${m.onOrder?num(m.onOrder):'—'}</div>
        <div class="dt-c r">${netCell(m.net)}</div>
        <div class="dt-c l">${cap(m.action,m.tone)}</div></div>`;
    });
    h+=`</div></div></div>`; return h;
  }
  const shortages=DB.mrp.filter(m=>m.net<0).length;
  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Planning parameters</h3>
      <div class="fld"><span>Plan horizon</span><select><option>4 weeks</option><option>8 weeks</option><option>This period</option></select></div>
      <div class="fld"><span>Company</span><select><option>Northwind Manufacturing</option></select></div>
      <div class="fld"><span>Warehouse</span><select><option>All warehouses</option><option>KL-Main</option></select></div>
      <div class="fld"><span>Demand sources</span><select><option>WO + Sales orders</option><option>Work orders only</option><option>Incl. forecast</option></select></div>
      <div class="fld"><span>Include safety stock</span><select><option>Yes</option><option>No</option></select></div>
      ${btn('Run MRP',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'MRP recalculated — 2 shortages\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">${btn('Generate POs',{icon:'cart',cls:'soft',attrs:'onclick="toast(\'2 draft purchase orders created\',\'ok\')"'})}</div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Material Requirements (MRP)</b><div class="report-meta">4-week horizon · WO + Sales demand · ${shortages} net shortage${shortages===1?'':'s'}</div></div>
        <div class="grow"></div>
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div class="tablewrap" id="mrpTable">${table()}</div>
    </div>
  </div></section></div>`;
  root.querySelectorAll('#mrpTable .dt-r.drill').forEach(tr=>tr.addEventListener('click',()=>navigate(tr.dataset.route)));
};
