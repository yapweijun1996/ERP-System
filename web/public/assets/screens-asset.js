/* ============================================================
   ARIA ERP — screens: Fixed Assets (register, asset detail, depreciation)
   ============================================================ */

function assetTone(s){ return {'In use':'ok','Under maintenance':'warn','Idle':'neutral','Disposed':'danger'}[s]||'neutral'; }

/* ---------------- ASSET REGISTER (listing) ---------------- */
SCREENS['asset-register'] = function(root){
  let filter='all';
  const cats=[...new Set(DB.assets.map(a=>a.cat))];
  const chips=[['all',t('common.all')],...cats.map(c=>[c,c])];
  function rows(){ return filter==='all'?DB.assets:DB.assets.filter(a=>a.cat===filter); }
  const totCost=DB.assets.reduce((s,a)=>s+a.cost,0);
  const totNbv=DB.assets.reduce((s,a)=>s+a.nbv,0);
  const totMo=DB.assets.reduce((s,a)=>s+a.monthly,0);
  function table(){
    return buildTable({
      checkable:true, rowId:a=>a.id,
      columns:[
        {label:t('fa.col.asset'),sticky:true,render:a=>`<div class="cellsub"><b>${esc(a.name)}</b><small>${esc(a.id)} · ${esc(a.loc)}</small></div>`},
        {label:t('fa.col.category'),align:'l',render:a=>esc(a.cat)},
        {label:t('fa.col.acquired'),align:'l',sortable:true,render:a=>esc(a.acq)},
        {label:t('fa.col.cost'),align:'r',sortable:true,render:a=>`<span class="tnum">${money0(a.cost)}</span>`},
        {label:t('fa.col.accdep'),align:'r',render:a=>`<span class="tnum" style="color:var(--muted)">${money0(a.accDep)}</span>`},
        {label:t('fa.col.nbv'),align:'r',sortable:true,render:a=>`<b class="tnum">${money0(a.nbv)}</b>`},
        {label:t('fa.col.depmo'),align:'r',render:a=>`<span class="tnum">${money0(a.monthly)}</span>`},
        {label:t('col.status'),align:'l',render:a=>cap(ts(a.status),assetTone(a.status))},
        {label:'',align:'c',render:a=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.asset'),t('fa.crumb')])}
      <div class="h1row"><h1>${esc(t('fa.title'))}</h1><span class="countchip" id="faCount"></span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('fa.kpi.gross'))}</small><b class="tnum">${money0(totCost)}</b></div>
          <div class="kfig"><small>${esc(t('fa.col.nbv'))}</small><b class="tnum">${money0(totNbv)}</b></div>
          <div class="kfig"><small>${esc(t('fa.kpi.depmo'))}</small><b class="tnum">${money0(totMo)}</b></div>
        </div></div>
    </div>
    <div class="toolbar">
      <div class="filterchips" id="faChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${esc(c[0])}">${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('fa.deprun'))}" onclick="navigate('depreciation')">${ic('chart')}${esc(t('fa.deprun'))}</button>
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('fa.new'),{icon:'plus',cls:'primary',attrs:'onclick="toast(\'New asset — acquisition wizard not in this build\',\'info\')"'})}
    </div>
    <div class="tablewrap" id="faTable">${table()}</div>
    <div id="faBulk"></div>
  </section></div>`;
  const wrap=$('#faTable');
  $('#faCount').textContent=rows().length+' '+t('fa.assets');
  function rewire(){
    wireTable(wrap,{
      onRow:(id)=>{ id==='FA-1001'?navigate('asset-detail'):toast('Opening '+id,'info'); },
      onSelectionChange:(n)=>{ $('#faBulk').innerHTML=n?`<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('fa.transfer'),{icon:'transfer',cls:'soft'})}${btn(t('fa.dispose'),{icon:'x',cls:'danger'})}</div>`:''; }
    });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const id=b.closest('.dt-r').dataset.row;id==='FA-1001'?navigate('asset-detail'):toast('Opening '+id,'info');}));
  }
  rewire();
  $('#faChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#faChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#faCount').textContent=rows().length+' '+t('fa.assets'); $('#faBulk').innerHTML=''; rewire();
  }));
};

/* ---------------- ASSET DETAIL (master + schedule) ---------------- */
SCREENS['asset-detail'] = function(root){
  const a=DB.asset1001;
  const depPct=Math.round(a.accDep/a.cost*100);
  const schedRows=a.schedule.map(s=>`<tr class="${s.current?'editing':''}">
    <td class="l li-name"><b>${esc(s.yr)}</b>${s.current?`<small>Current year</small>`:''}</td>
    <td class="tnum">${money0(s.open)}</td>
    <td class="tnum">${money0(s.dep)}</td>
    <td class="tnum"><b>${money0(s.close)}</b></td>
  </tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,'Fixed Assets','Register',{cur:a.id}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('asset')}${esc(a.name)} <span class="dnum">${esc(a.id)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(a.cat)} · ${esc(a.loc)} · ${esc(a.method)} ${a.life}yr</div></div>
        <div class="dactions">${cap(a.status,assetTone(a.status))}${btn('Transfer',{icon:'transfer',cls:'soft'})}${btn('Dispose',{icon:'x',cls:'soft'})}</div></div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Acquisition</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Acquisition date</span><input value="${esc(a.acq)}" readonly></div>
            <div class="fld"><span>Original cost</span><input value="${money(a.cost)}" readonly></div>
            <div class="fld"><span>Supplier</span><input value="${esc(a.supplier)}" readonly></div>
            <div class="fld"><span>Source PO</span><input value="${esc(a.po)}" readonly></div>
            <div class="fld"><span>Useful life</span><input value="${a.life} years" readonly></div>
            <div class="fld"><span>Residual value</span><input value="${money(a.residual)}" readonly></div>
          </div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Depreciation</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Method</span><select><option>Straight-line</option><option>Reducing balance</option><option>Units of production</option></select></div>
            <div class="fld"><span>Monthly charge</span><input value="${money(a.monthly)}" readonly></div>
            <div class="fld"><span>GL expense account</span><input value="6400 · Depreciation" readonly></div>
          </div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Depreciation schedule</h3></div>
          <table class="lines"><thead><tr><th class="l">Period</th><th>Opening NBV</th><th>Depreciation</th><th>Closing NBV</th></tr></thead><tbody>${schedRows}</tbody></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Book value</div>
          <div class="sumrow"><span class="sk2">Original cost</span><span class="sv tnum">${money(a.cost)}</span></div>
          <div class="sumrow"><span class="sk2">Accum. depreciation</span><span class="sv tnum" style="color:var(--muted)">(${money(a.accDep)})</span></div>
          <div class="sumrow total"><span class="sk2">Net book value</span><span class="sv tnum">${money(a.nbv)}</span></div>
          <div class="indicator ok" style="margin-top:12px">
            <div class="ind-top">${ic('chart')}<span>Depreciated</span><span class="ind-r">${depPct}%</span></div>
            <div class="track"><i style="width:${depPct}%"></i></div>
            <small>${money(a.monthly)}/mo · ${a.life}-year straight line.</small>
          </div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Maintenance</div>
          <div class="field"><span class="k">Last service</span><span class="v">${esc(a.lastMaint)}</span></div>
          <div class="field"><span class="k">Next due</span><span class="v" style="color:var(--warn)">${esc(a.nextMaint)}</span></div>
          ${btn('Log maintenance',{icon:'wrench',cls:'soft',attrs:'onclick="toast(\'Maintenance logged\',\'ok\')"'})}
        </div>
      </aside>
    </div>
    <div style="height:60px"></div>
  </div></div></section></div>`;
};

/* ---------------- DEPRECIATION RUN (report) ---------------- */
SCREENS['depreciation'] = function(root){
  const totDep=DB.depRun.reduce((s,g)=>s+g.dep,0);
  const totOpen=DB.depRun.reduce((s,g)=>s+g.open,0);
  function table(){
    const tpl='minmax(220px,2.4fr) 90px 150px 140px 150px';
    let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
      <div class="dt-r dt-head"><div class="dt-c l">Category</div><div class="dt-c r">Assets</div><div class="dt-c r">Opening NBV</div><div class="dt-c r">Depreciation</div><div class="dt-c r">Closing NBV</div></div>
      <div class="dt-body">`;
    DB.depRun.forEach(g=>{
      h+=`<div class="dt-r"><div class="dt-c l"><b>${esc(g.cat)}</b></div><div class="dt-c r tnum">${g.n}</div><div class="dt-c r tnum">${money0(g.open)}</div><div class="dt-c r tnum">${money0(g.dep)}</div><div class="dt-c r tnum">${money0(g.open-g.dep)}</div></div>`;
    });
    h+=`<div class="dt-r grandtotal"><div class="dt-c l">Total — June 2026 (P06)</div><div class="dt-c r tnum">${DB.assets.length}</div><div class="dt-c r tnum">${money0(totOpen)}</div><div class="dt-c r tnum">${money0(totDep)}</div><div class="dt-c r tnum">${money0(totOpen-totDep)}</div></div>`;
    h+=`</div></div></div>`; return h;
  }
  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Run parameters</h3>
      <div class="fld"><span>Period</span><select><option>FY2026 · P06 (June)</option><option>FY2026 · P05 (May)</option></select></div>
      <div class="fld"><span>Company</span><select><option>Northwind Manufacturing</option></select></div>
      <div class="fld"><span>Method</span><select><option>As configured per asset</option><option>Straight-line</option></select></div>
      <div class="fld"><span>Group by</span><select><option>Category</option><option>Location</option></select></div>
      ${btn('Run depreciation',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Depreciation calculated — '+money0(totDep)+'\',\'ok\')"'})}
      <div class="note rule" style="border:1px solid var(--hairline);border-left:3px solid var(--ok);background:var(--surface);border-radius:0 var(--r-m) var(--r-m) 0;padding:11px 13px;font-size:12.5px;margin-top:6px">
        <b style="display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:3px">Posting</b>
        Posts <b>${money0(totDep)}</b> to GL as a single journal — see <a href="javascript:navigate('journal-entry')">JE-26-0610</a>.
      </div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Depreciation Run</b><div class="report-meta">June 2026 · ${DB.assets.length} assets · straight-line</div></div>
        <div class="grow"></div>
        ${btn('Post to GL',{icon:'book',cls:'primary',attrs:'onclick="navigate(\'journal-entry\')"'})}
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div class="tablewrap">${table()}</div>
    </div>
  </div></section></div>`;
};
