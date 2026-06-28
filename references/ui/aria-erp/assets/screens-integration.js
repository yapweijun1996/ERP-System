/* ============================================================
   ARIA ERP — screens: Integration (connectors, sync logs, data import)
   ============================================================ */

function connStatusTone(s){ return {Connected:'ok',Error:'danger',Paused:'neutral',Setup:'info'}[s]||'neutral'; }
function dirChip(dir){
  const m={Inbound:['receive','In'],Outbound:['upload','Out'],'Two-way':['transfer','Two-way']};
  const [icon,lbl]=m[dir]||['transfer',dir];
  return `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:12.5px">${ic(icon)}${lbl}</span>`;
}
function logStatusTone(s){ return {Success:'ok',Failed:'danger',Partial:'warn',Retry:'info'}[s]||'neutral'; }

/* ---------------- CONNECTORS HUB (listing — module landing) ---------------- */
SCREENS['integration'] = function(root){
  let filter='all';
  const chips=[['all',t('common.all'),null],['connected',ts('Connected'),'ok'],['issues',t('int.issues'),'danger'],['paused',ts('Paused'),'neutral']];
  function rows(){
    return DB.connectors.filter(c=>{
      if(filter==='all') return true;
      if(filter==='connected') return c.status==='Connected';
      if(filter==='issues') return c.status==='Error';
      if(filter==='paused') return c.status==='Paused'||c.status==='Setup';
      return true;
    });
  }
  function table(){
    return buildTable({
      rowId:c=>c.name,
      columns:[
        {label:t('int.col.connector'),render:c=>`<div style="display:flex;align-items:center;gap:11px"><span class="wc-ic ${c.health==='danger'?'red':c.health==='ok'?'green':'slate'}" style="width:30px;height:30px;border-radius:9px">${ic(c.ic)}</span><div class="cellsub"><b>${esc(c.name)}</b><small>${esc(c.cat)}</small></div></div>`},
        {label:t('int.col.direction'),align:'l',render:c=>dirChip(c.dir)},
        {label:t('int.col.frequency'),align:'l',render:c=>esc(c.freq)},
        {label:t('int.col.records'),align:'r',render:c=>`<span class="tnum">${esc(c.records)}</span>`},
        {label:t('int.col.lastsync'),align:'l',render:c=>esc(c.last)},
        {label:t('col.status'),align:'l',render:c=>cap(ts(c.status),connStatusTone(c.status))},
        {label:'',align:'c',render:c=>`<span class="rowact"><button data-tip="${esc(t('int.viewlogs'))}" data-act="logs">${ic('history')}</button><button data-tip="${esc(t('int.configure'))}">${ic('gear')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  const s=DB.integrationStats;
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:24px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.integration'),t('int.crumb')])}
      <div class="h1row"><h1>${esc(t('nav.integration'))}</h1><span class="countchip" id="connCount"></span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile(t('int.t.active'),s.active+' / '+DB.connectors.length,t('int.t.activesub'))}
      ${statTile(t('int.t.calls'),s.calls,t('int.t.callssub'))}
      ${statTile(t('int.t.success'),s.success+'%',t('int.t.successsub'),'var(--ok)')}
      ${statTile(t('int.t.failed'),s.failed,t('int.t.failedsub').replaceAll('{n}',s.queued),'var(--danger)')}
    </div></div>
    <div class="alert danger" style="margin:0 24px 4px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('int.alert'))}</b> ${esc(t('int.alert2'))}</span>
      ${btn(t('int.reauth'),{icon:'refresh',cls:'soft',attrs:'onclick="toast(\'Opening CIMB OAuth flow…\',\'info\')"'})}</div>
    <div class="toolbar">
      <div class="filterchips" id="connChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('int.logstip'))}" onclick="navigate('integration-logs')">${ic('history')}${esc(t('int.logs'))}</button>
      ${btn(t('int.import'),{icon:'upload',cls:'soft',attrs:'onclick="navigate(\'data-import\')"'})}
      ${btn(t('int.add'),{icon:'plus',cls:'primary',attrs:'onclick="toast(\'Connector catalogue — not in this build\',\'info\')"'})}
    </div>
    <div class="tablewrap" id="connTable">${table()}</div>
  </section></div>`;
  const wrap=$('#connTable');
  $('#connCount').textContent=rows().filter(c=>c.status==='Connected').length+' '+t('int.connected');
  function rewire(){
    wireTable(wrap,{ onRow:(id)=>{ const c=DB.connectors.find(x=>x.name===id); c&&c.status==='Error'?toast(id+' — re-authorization required','danger'):toast('Opening '+id,'info'); } });
    wrap.querySelectorAll('[data-act="logs"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();navigate('integration-logs');}));
  }
  rewire();
  $('#connChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#connChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); rewire();
  }));
};

/* ---------------- INTEGRATION LOGS (event stream report) ---------------- */
SCREENS['integration-logs'] = function(root){
  function table(){
    const tpl='84px minmax(150px,1.3fr) minmax(160px,1.5fr) 78px 92px 78px minmax(120px,1fr)';
    let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
      <div class="dt-r dt-head"><div class="dt-c l">Time</div><div class="dt-c l">Connector</div><div class="dt-c l">Event</div><div class="dt-c c">Dir</div><div class="dt-c r">Records</div><div class="dt-c r">Duration</div><div class="dt-c l">Status</div></div>
      <div class="dt-body">`;
    DB.syncLogs.forEach(l=>{
      h+=`<div class="dt-r logrow" data-detail="${esc(l.detail)}">
        <div class="dt-c l mono" style="color:var(--muted);font-size:12px">${esc(l.t)}</div>
        <div class="dt-c l"><b style="font-weight:600">${esc(l.conn)}</b></div>
        <div class="dt-c l mono" style="font-size:12px;color:var(--fg)">${esc(l.event)}</div>
        <div class="dt-c c" style="color:var(--muted)">${esc(l.dir)}</div>
        <div class="dt-c r tnum">${esc(l.rec)}</div>
        <div class="dt-c r tnum" style="color:var(--muted)">${esc(l.dur)}</div>
        <div class="dt-c l">${cap(l.status,logStatusTone(l.status))}</div></div>
        <div class="dt-r logdetail" style="display:none"><div class="dt-c l" style="grid-column:1/-1;color:var(--muted);font-size:12.5px;padding:2px 12px 12px 84px">${ic('info')} ${esc(l.detail)}</div></div>`;
    });
    h+=`</div></div></div>`; return h;
  }
  const failed=DB.syncLogs.filter(l=>l.status==='Failed').length;
  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Filters</h3>
      <div class="fld"><span>Connector</span><select><option>All connectors</option>${DB.connectors.map(c=>`<option>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="fld"><span>Status</span><select><option>All statuses</option><option>Success</option><option>Failed</option><option>Partial</option><option>Retry</option></select></div>
      <div class="fld"><span>Direction</span><select><option>Both</option><option>Inbound</option><option>Outbound</option></select></div>
      <div class="fld"><span>Time range</span><select><option>Last 24 hours</option><option>Last 7 days</option><option>This period</option></select></div>
      <div class="fld"><span>Event type</span><select><option>All events</option><option>sync</option><option>webhook</option><option>import</option></select></div>
      ${btn('Apply filters',{icon:'filter',cls:'primary',sm:false,attrs:'onclick="toast(\'Filters applied\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">${btn('Replay failed',{icon:'refresh',cls:'soft',attrs:'onclick="toast(\'Replaying '+failed+' failed event(s)\',\'ok\')"'})}</div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Integration event log</b><div class="report-meta">Last 24 hours · ${DB.syncLogs.length} events · ${failed} failed · click a row for detail</div></div>
        <div class="grow"></div>
        ${btn('Export',{icon:'download',cls:'soft'})}${btn('Connectors',{icon:'plug',cls:'soft',attrs:'onclick="navigate(\'integration\')"'})}
      </div>
      <div class="tablewrap" id="logTable">${table()}</div>
    </div>
  </div></section></div>`;
  root.querySelectorAll('#logTable .logrow').forEach(r=>r.addEventListener('click',()=>{
    const det=r.nextElementSibling;
    if(det&&det.classList.contains('logdetail')){ const open=det.style.display!=='none'; det.style.display=open?'none':''; r.classList.toggle('sel',!open); }
  }));
};

/* ---------------- DATA IMPORT (wizard) ---------------- */
SCREENS['data-import'] = function(root){
  const j=DB.importJob;
  const mapTone={Mapped:'ok',Review:'warn',Skip:'neutral'};
  const mapRows=j.mapping.map((m,i)=>`<tr>
      <td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(m.src)}</b></td>
      <td class="l" style="color:var(--muted)">${ic('arrowR')}</td>
      <td class="l">${m.field.includes('unmapped')?`<span style="color:var(--faint)">${esc(m.field)}</span>`:`<b style="font-weight:600">${esc(m.field)}</b>`}</td>
      <td class="l">${cap(m.status,mapTone[m.status]||'neutral')}</td></tr>`).join('');
  const prevRows=j.preview.map(p=>`<tr class="${p.ok?'':'editing'}">
      <td class="l li-name"><b>${esc(p.a)}</b></td>
      <td class="l mono" style="font-size:12px">${esc(p.b)}</td>
      <td class="l" style="color:${p.ok?'var(--fg)':'var(--danger)'}">${esc(p.c)}</td>
      <td class="l">${esc(p.d)}</td>
      <td class="c">${p.ok?cap('Ready','ok'):cap('Error','danger')}</td></tr>`).join('');

  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:1000px">
    ${crumbs([DB.company.name,'Integration','Import data'])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('upload')}Import data <span class="dnum">${esc(j.target)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(j.file)} · ${num(j.rows)} rows · ${esc(j.size)}</div></div>
        <div class="dactions">${cap('Validating','info')}${btn('Download template',{icon:'filexls',cls:'soft'})}</div></div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Upload file</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Map fields</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('clock')}</span>Validate</div><span class="stepline"></span>
        <div class="step"><span class="sdot"></span>Import</div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>Field mapping</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${j.mapping.filter(m=>m.status==='Mapped').length} of ${j.mapping.length} mapped</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Source column</th><th></th><th class="l">Aria field</th><th class="l">Status</th></tr></thead><tbody>${mapRows}</tbody></table>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>Preview &amp; validation</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">first 4 of ${num(j.rows)} rows</span></div>
          <table class="lines"><thead><tr><th class="l">Customer name</th><th class="l">Matched ID</th><th class="l">Email</th><th class="l">Terms</th><th class="c">Result</th></tr></thead><tbody>${prevRows}</tbody></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Validation summary</div>
          <div class="indicator ok" style="margin-bottom:8px"><div class="ind-top">${ic('checkc')}<span>Ready to import</span><span class="ind-r">${num(j.ready)}</span></div><div class="track"><i style="width:${Math.round(j.ready/j.rows*100)}%"></i></div><small>${Math.round(j.ready/j.rows*100)}% of rows pass validation.</small></div>
          <div class="indicator warn" style="margin-bottom:8px"><div class="ind-top">${ic('warn')}<span>Warnings</span><span class="ind-r">${j.warnings}</span></div><small>Owner not matched — will import unassigned.</small></div>
          <div class="indicator danger"><div class="ind-top">${ic('xc')}<span>Errors (skipped)</span><span class="ind-r">${j.errors}</span></div><small>Missing required email — fix &amp; re-upload to include.</small></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Options</div>
          <div class="fld"><span>On duplicate</span><select><option>Update existing</option><option>Skip</option><option>Create new</option></select></div>
          <div class="fld"><span>Match key</span><select><option>Registration no.</option><option>Email</option><option>Customer name</option></select></div>
          <label style="display:flex;align-items:center;gap:9px;padding:10px 0 2px;font-size:13px;cursor:pointer"><input type="checkbox" class="checkbox" checked style="flex:none"><span>Send notification on completion</span></label>
        </div>
      </aside>
    </div>
    <div style="height:40px"></div>
  </div></div>
  <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
    <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall"><b style="color:var(--fg)">${num(j.ready)}</b> rows will be imported · ${j.warnings} with warnings · ${j.errors} skipped.</div>
    <div class="grow"></div>
    ${btn('Back to mapping',{icon:'chevL',cls:'soft',attrs:'onclick="toast(\'Back to field mapping\',\'info\')"'})}
    ${btn('Import '+num(j.ready)+' records',{icon:'check',cls:'primary',sm:false,attrs:'data-act="run"'})}
  </div>
  </section></div>`;

  root.querySelector('[data-act="run"]').addEventListener('click',()=>{
    appModal({ icon:'upload', title:'Run import?',
      body:`<p style="color:var(--muted);font-size:13.5px">${num(j.ready)} customer records will be created or updated in <b>${esc(j.target)}</b>. ${j.errors} rows with errors are skipped and logged. This action is recorded in the audit trail.</p>`,
      actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Import now',{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\''+num(j.ready)+' records imported · job IMP-26-0044\',\'ok\')"'})}` });
  });
};
