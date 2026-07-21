/* ============================================================
   ARIA ERP — screens: Quality (inspection queue, inspection record, NCR)
   ============================================================ */

function qcTone(st){
  return {Pass:'ok',Fail:'danger','In Inspection':'info',Scheduled:'neutral',Quarantine:'warn',Concession:'violet',Open:'warn',Closed:'neutral',Completed:'ok'}[st]||'neutral';
}
function qcTypeTone(t){ return {Incoming:'accent','In-process':'info',Final:'teal'}[t]||'neutral'; }

/* ---------------- INSPECTION QUEUE (listing) ---------------- */
SCREENS['qc-inspection'] = function(root){
  let filter='all';
  const chips=[['all',t('common.all'),null],['incoming',ts('Incoming'),'accent'],['inprocess',ts('In-process'),'info'],['final',ts('Final'),'teal'],['fail',t('qc.chip.failed'),'danger']];
  function rows(){
    return DB.inspections.filter(q=>{
      if(filter==='all')return true;
      if(filter==='incoming')return q.type==='Incoming';
      if(filter==='inprocess')return q.type==='In-process';
      if(filter==='final')return q.type==='Final';
      if(filter==='fail')return q.status==='Fail';
      return true;
    });
  }
  function table(){
    return buildTable({
      checkable:true, rowId:q=>q.no,
      columns:[
        {label:t('qc.col.inspection'),sticky:true,render:q=>`<div class="cellsub"><b class="docnum">${esc(q.no)}</b><small>${esc(q.name)} · ${esc(q.item)}</small></div>`},
        {label:t('qc.col.type'),align:'l',render:q=>cap(ts(q.type),qcTypeTone(q.type))},
        {label:t('qc.col.source'),align:'l',render:q=>`<span class="docnum">${esc(q.source)}</span>`},
        {label:t('qc.col.lot'),align:'r',render:q=>`<span class="tnum">${typeof q.lot==='number'?num(q.lot):esc(q.lot)}</span>`},
        {label:t('qc.col.sample'),align:'r',render:q=>`<span class="tnum" style="color:var(--muted)">${typeof q.sample==='number'?num(q.sample):esc(q.sample)}</span>`},
        {label:t('qc.col.inspector'),align:'l',render:q=>esc(q.inspector)},
        {label:t('common.date'),align:'l',sortable:true,render:q=>esc(q.date)},
        {label:t('qc.col.result'),align:'l',render:q=>cap(ts(q.status),qcTone(q.status))+(q.flag?` <span data-tip="${esc(q.flag)}">${ic('warn')}</span>`:'')},
        {label:'',align:'c',render:()=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const passCount=DB.inspections.filter(q=>q.status==='Pass').length;
  const failCount=DB.inspections.filter(q=>q.status==='Fail').length;
  const pend=DB.inspections.filter(q=>q.status==='Scheduled').length;
  const rate=Math.round(passCount/(passCount+failCount)*100);
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.quality'),t('qc.crumb')])}
      <div class="h1row"><h1>${esc(t('qc.title'))}</h1><span class="countchip" id="qcCount"></span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('qc.kpi.fpy'))}</small><b class="tnum">${rate}%</b></div>
          <div class="kfig"><small>${esc(t('qc.kpi.awaiting'))}</small><b class="tnum">${pend}</b></div>
        </div></div>
    </div>
    <div class="alert danger"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 7v6M12 16h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('qc.alert'))}</b> ${esc(t('qc.alert2'))}</span>
      ${btn(t('qc.openncr'),{icon:'shield',cls:'soft',attrs:'onclick="navigate(\'ncr\')"'})}</div>
    <div class="toolbar">
      <div class="filterchips" id="qcChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('qc.new'),{icon:'plus',cls:'primary',attrs:'onclick="toast(\'New inspection — draft started\',\'ok\')"'})}
    </div>
    <div class="tablewrap" id="qcTable">${table()}</div>
    <div id="qcBulk"></div>
  </section></div>`;
  const wrap=$('#qcTable');
  $('#qcCount').textContent=rows().length+' '+t('qc.records');
  function rewire(){
    wireTable(wrap,{
      onRow:(id)=>{ if(id==='QC-26-0138'){navigate('qc-report');} else toast('Opening '+id,'info'); },
      onSelectionChange:(n)=>{ $('#qcBulk').innerHTML=n?`<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('qc.printcoa'),{icon:'print',cls:'soft'})}${btn(t('common.export'),{icon:'download',cls:'soft'})}</div>`:''; }
    });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const no=b.closest('.dt-r').dataset.row;no==='QC-26-0138'?navigate('qc-report'):toast('Opening '+no,'info');}));
  }
  rewire();
  $('#qcChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#qcChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#qcCount').textContent=rows().length+' '+t('qc.records'); $('#qcBulk').innerHTML=''; rewire();
  }));
};

/* ---------------- INSPECTION RECORD (document) ---------------- */
SCREENS['qc-report'] = function(root){
  const d=DB.qc0138;
  const charRows=d.characteristics.map((c,i)=>{
    const fail=c.result==='Fail';
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(c.c)}</b><small>${esc(c.method)}</small></td>
      <td class="l" style="white-space:normal;color:var(--muted)">${esc(c.spec)}</td>
      <td class="l" style="white-space:normal;font-weight:600;color:${fail?'var(--danger)':'var(--fg)'}">${esc(c.measured)}</td>
      <td class="l">${cap(c.result,fail?'danger':'ok')}</td></tr>`;
  }).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,'Quality','Inspections',{cur:d.no}])}
      <div class="dochead">
        <div class="dh-row1">
          <div>
            <div class="dt">${ic('checkc')}Inspection <span class="dnum">${esc(d.no)}</span></div>
            <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.type)} · ${esc(d.name)} (${esc(d.item)}) · against ${esc(d.source)}</div>
          </div>
          <div class="dactions">${cap(d.status,'danger')}${btn('Open NCR',{icon:'shield',cls:'soft',attrs:'onclick="navigate(\'ncr\')"'})}</div>
        </div>
        <div class="stepper">
          <div class="step done"><span class="sdot">${ic('check')}</span>Logged</div><span class="stepline done"></span>
          <div class="step done"><span class="sdot">${ic('check')}</span>Sampled</div><span class="stepline done"></span>
          <div class="step done"><span class="sdot">${ic('check')}</span>Inspected</div><span class="stepline done"></span>
          <div class="step current"><span class="sdot">${ic('clock')}</span>Disposition</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>Closed</div>
        </div>
        <div class="docmeta">
          <div class="dm"><small>Supplier</small><div class="partner"><span class="pav">ES</span><b>${esc(d.supplier)}</b></div></div>
          <div class="dm"><small>Lot qty</small><b>${num(d.lot)} ${esc(d.uom)}</b></div>
          <div class="dm"><small>Sample / AQL</small><b>${d.sample} · ${esc(d.aql)}</b></div>
          <div class="dm"><small>Inspector</small><b>${esc(d.inspector)}</b></div>
          <div class="dm"><small>Date</small><b>${esc(d.date)}</b></div>
        </div>
      </div>

      <div class="appr-layout">
        <div class="docmain">
          <div class="panel">
            <div class="panel-h"><h3>Result summary</h3></div>
            <div class="panel-body" style="padding-top:12px">
              <div class="risk danger">${ic('warn')}<div><b>Lot rejected — thickness below tolerance</b><small>2 of 8 sampled sheets measured 1.92 mm vs 2.00 ± 0.05 mm spec. AQL ${esc(d.aql)}: accept ${d.accept} / reject ${d.reject} — ${d.found.major} major defect${d.found.major===1?'':'s'} found.</small></div></div>
              <div class="risk warn">${ic('info')}<div><b>Surface scratching noted</b><small>Cosmetic non-conformance on the same 2 sheets — would not pass No.4 finish requirement.</small></div></div>
              <div class="risk ok">${ic('checkc')}<div><b>Material certificate verified</b><small>Mill cert 3.1 present; chemistry and hardness within specification.</small></div></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Quality characteristics</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.characteristics.length} checks</span></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Characteristic</th><th class="l">Specification</th><th class="l">Measured</th><th class="l">Result</th></tr></thead><tbody>${charRows}</tbody></table>
          </div>
        </div>

        <aside>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Sampling result</div>
            <div class="sumrow"><span class="sk2">Lot size</span><span class="sv tnum">${num(d.lot)}</span></div>
            <div class="sumrow"><span class="sk2">Sample size</span><span class="sv tnum">${d.sample}</span></div>
            <div class="sumrow"><span class="sk2">Critical / Major / Minor</span><span class="sv tnum">${d.found.critical} / ${d.found.major} / ${d.found.minor}</span></div>
            <div class="sumrow total"><span class="sk2">Accept / Reject (${esc(d.aql)})</span><span class="sv tnum">${d.accept} / ${d.reject}</span></div>
            <div class="indicator danger" style="margin-top:12px">
              <div class="ind-top">${ic('warn')}<span>Disposition</span><span class="ind-r">Reject</span></div>
              <small>${d.found.major} major &gt; reject limit ${d.reject}. Lot quarantined, returned to supplier.</small>
            </div>
          </div>
          <div class="sumcard">
            <div class="sectitle" style="margin-top:0">Related</div>
            ${relatedDocs([
              {no:d.source,label:'Goods receipt',meta:esc(d.supplier),status:'Posted'},
              {no:'NCR-26-0021',label:'Non-conformance',meta:'Return to supplier',status:'Open'},
              {no:d.po,label:'Purchase order',meta:esc(d.supplier),status:'Completed'},
            ])}
          </div>
        </aside>
      </div>
    </div></div>

    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Recorded by <b style="color:var(--fg)">${esc(d.inspector)}</b> · pending disposition sign-off.</div>
      <div class="grow"></div>
      ${btn('Accept under concession',{icon:'comment',cls:'soft',attrs:'onclick="toast(\'Concession requires QA manager sign-off\',\'warn\')"'})}
      ${btn('Quarantine lot',{icon:'box',cls:'soft',attrs:'onclick="toast(\'Lot moved to quarantine QH-01\',\'warn\')"'})}
      ${btn('Reject & raise NCR',{icon:'shield',cls:'danger-solid',sm:false,attrs:'onclick="navigate(\'ncr\')"'})}
    </div>
  </section></div>`;
};

/* ---------------- NCR / CORRECTIVE ACTION (document) ---------------- */
SCREENS['ncr'] = function(root){
  const n=DB.ncr0021;
  const actTone={Completed:'ok','In Progress':'info',Open:'neutral'};
  const actRows=n.actions.map((a,i)=>`<div class="oprow">
      <span class="opseq">A${i+1}</span>
      <div class="opmain"><b>${esc(a.a)}</b><small>${esc(a.owner)} · due ${esc(a.due)}</small></div>
      ${cap(a.status,actTone[a.status]||'neutral')}
    </div>`).join('');
  const done=n.actions.filter(a=>a.status==='Completed').length;
  const atRisk=n.qty*n.cost;
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,'Quality','Non-conformance',{cur:n.no}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('shield')}Non-conformance <span class="dnum">${esc(n.no)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(n.name)} (${esc(n.item)}) · ${esc(n.supplier)} · raised by ${esc(n.raisedBy)}</div></div>
        <div class="dactions">${cap(n.severity,'danger')}${cap(n.status,'warn')}${btn('Inspection',{icon:'checkc',cls:'soft',attrs:'onclick="navigate(\'qc-report\')"'})}</div></div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Non-conformance</h3></div><div class="panel-body">
          <div class="fldrow c2">
            <div class="fld"><span>Source inspection</span><input value="${esc(n.source)}" readonly></div>
            <div class="fld"><span>Supplier</span><input value="${esc(n.supplier)} · ${esc(n.po)}" readonly></div>
            <div class="fld"><span>Item</span><input value="${esc(n.name)} (${esc(n.item)})" readonly></div>
            <div class="fld"><span>Quantity affected</span><input value="${num(n.qty)} ${esc(n.uom)}" readonly></div>
          </div>
          <div class="fld"><span>Defect description</span><textarea readonly style="min-height:64px">${esc(n.defect)}</textarea></div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Root cause analysis</h3></div><div class="panel-body">
          <div class="risk warn">${ic('info')}<div><b>Assignable cause</b><small>${esc(n.rootCause)}</small></div></div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Corrective &amp; preventive actions</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${done}/${n.actions.length} done</span></div>
          <div class="panel-body" style="padding:6px 0">${actRows}</div>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Disposition</div>
          <div class="indicator danger">
            <div class="ind-top">${ic('truck')}<span>${esc(n.disposition)}</span><span class="ind-r">${num(n.qty)} ${esc(n.uom)}</span></div>
            <small>Full lot quarantined to QH-01 pending collection.</small>
          </div>
          <div class="sumrow" style="margin-top:10px"><span class="sk2">Severity</span><span class="sv">${cap(n.severity,'danger')}</span></div>
          <div class="sumrow"><span class="sk2">Raised</span><span class="sv">${esc(n.date)}</span></div>
          <div class="sumrow total"><span class="sk2">Cost of quality</span><span class="sv tnum">${money(atRisk)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Action progress</div>
          <div class="indicator ${done===n.actions.length?'ok':'warn'}">
            <div class="ind-top">${ic('flow')}<span>${done} of ${n.actions.length} complete</span><span class="ind-r">${Math.round(done/n.actions.length*100)}%</span></div>
            <div class="track"><i style="width:${Math.round(done/n.actions.length*100)}%"></i></div>
            <small>Open until supplier 8D received and AQL tightened.</small>
          </div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:n.source,label:'Failed inspection',meta:'Thickness reject',status:'Fail'},
            {no:n.po,label:'Originating PO',meta:esc(n.supplier),status:'Completed'},
            {no:'DN-26-0044',label:'Debit note (draft)',meta:money(atRisk),status:'Draft'},
          ])}
        </div>
      </aside>
    </div>
    <div style="height:60px"></div>
  </div></div></section></div>`;
};
