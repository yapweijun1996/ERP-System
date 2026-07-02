/* ============================================================
   ARIA ERP — screens: Finance depth
   (General Ledger, Account Ledger, Bank Reconciliation, P&L, AR Aging)
   ============================================================ */

function glTypeTone(t){ return {Assets:'accent',Liabilities:'warn',Equity:'violet',Income:'ok',Expenses:'teal'}[t]||'neutral'; }
function signed0(n){ return (n<0?'−':'')+money0(Math.abs(n)); }
function pnlCell(v){ return v<0?`<span style="color:var(--muted)">(${money0(-v)})</span>`:money0(v); }

/* ---------------- GENERAL LEDGER / CHART OF ACCOUNTS (module landing) ---------------- */
SCREENS['gl'] = function(root){
  let filter='all';
  const flat=DB.coa.flatMap(g=>g.accts.map(a=>({...a,type:g.grp})));
  const get=c=>flat.find(a=>a.code===c)?.bal||0;
  const cash=get('1000')+get('1010');
  const ar=get('1100'), ap=get('2000');
  const income=get('4000')+get('4100')-get('4900');
  const expense=['5000','6000','6100','6200','6300','6900'].reduce((s,c)=>s+get(c),0);
  const net=income-expense;
  const erpDemo=!!DB.erpSystem;

  const chips=[['all',t('common.all'),null],['Assets',ts('Assets'),'accent'],['Liabilities',ts('Liabilities'),'warn'],['Income',ts('Income'),'ok'],['Expenses',ts('Expenses'),'teal']];
  function table(){
    const tpl='minmax(240px,2.4fr) minmax(120px,1.2fr) 130px 150px 54px';
    let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
      <div class="dt-r dt-head"><div class="dt-c l">${esc(t('gl.col.account'))}</div><div class="dt-c l">${esc(t('qc.col.type'))}</div><div class="dt-c r">${esc(t('gl.col.movement'))}</div><div class="dt-c r">${esc(t('gl.col.balance'))}</div><div class="dt-c c">${esc(t('gl.col.drcr'))}</div></div>
      <div class="dt-body">`;
    DB.coa.forEach(g=>{
      if(filter!=='all'&&filter!==g.grp) return;
      const gtot=g.accts.reduce((s,a)=>s+(a.dc==='Cr'?-a.bal:a.bal),0);
      h+=`<div class="dt-r" style="background:var(--surface-3);font-weight:700"><div class="dt-c l" style="grid-column:1/3">${esc(ts(g.grp))}</div><div class="dt-c r" style="color:var(--muted)">${g.accts.length} ${esc(t('gl.accounts'))}</div><div class="dt-c r tnum">${signed0(gtot)}</div><div class="dt-c c"></div></div>`;
      g.accts.forEach(a=>{
        h+=`<div class="dt-r drill" data-code="${esc(a.code)}">
          <div class="dt-c l"><div class="cellsub"><b>${esc(a.code)} · ${esc(a.name)}</b></div></div>
          <div class="dt-c l">${cap(ts(g.grp),glTypeTone(g.grp))}</div>
          <div class="dt-c r tnum delta ${a.mvt<0?'neg':'pos'}">${a.mvt?signed0(a.mvt):'—'}</div>
          <div class="dt-c r tnum"><b>${money0(a.bal)}</b></div>
          <div class="dt-c c" style="color:var(--muted);font-size:12px">${esc(a.dc)}</div></div>`;
      });
    });
    h+=`</div></div></div>`; return h;
  }
  function statTile(label,value,sub,tone){
    return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
      <b class="tnum" style="font-size:23px;font-weight:600;letter-spacing:-.02em;color:${tone||'var(--fg)'}">${value}</b>
      <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.finance'),t('gl.title')])}
      <div class="h1row"><h1>${esc(t('gl.title'))}</h1><span class="countchip">${flat.length} ${esc(t('gl.accounts'))} · ${DB.company.period}</span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${statTile(t('gl.t.cash'),money0(cash),erpDemo?'cash seed will be wired in the next finance slice':t('gl.t.cashsub'))}
      ${statTile(t('gl.t.ar'),money0(ar),erpDemo?`from ${DB.salesInvoices.length} posted invoice${DB.salesInvoices.length===1?'':'s'} (${DB.salesInvoices.map(i=>i.no).join(', ')})`:t('gl.t.arsub'),'var(--warn)')}
      ${statTile(t('gl.t.ap'),money0(ap),erpDemo?'no supplier invoice in canonical seed yet':t('gl.t.apsub'))}
      ${statTile(t('gl.t.net'),money0(net),erpDemo?`revenue from ${DB.salesOrders.filter(o=>o.status==='Closed').length} confirmed order${DB.salesOrders.filter(o=>o.status==='Closed').length===1?'':'s'}`:t('gl.t.netsub'),'var(--ok)')}
    </div></div>
    <div class="toolbar">
      <div class="filterchips" id="glChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('gl.pnltip'))}" onclick="navigate('pnl')">${ic('chart')}${esc(t('gl.pnl'))}</button>
      <button class="viewsel" data-tip="${esc(t('gl.bankrectip'))}" onclick="navigate('bank-rec')">${ic('bank')}${esc(t('gl.reconcile'))}</button>
      ${btn(t('gl.newjournal'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-journal-entry\')"'})}
    </div>
    <div class="tablewrap" id="glTable">${table()}</div>
  </section></div>`;
  function rewire(){ root.querySelectorAll('#glTable .dt-r.drill').forEach(tr=>tr.addEventListener('click',()=>{ const c=tr.dataset.code; (DB.acctLedgerDocs&&DB.acctLedgerDocs[c])?navigate('account-ledger',{code:c}):(c==='1000'?navigate('account-ledger'):toast('Open ledger · '+c,'info')); })); }
  rewire();
  $('#glChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ $('#glChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f; $('#glTable').innerHTML=table(); rewire(); }));
};

/* ---------------- ACCOUNT LEDGER (drill target) ---------------- */
SCREENS['account-ledger'] = function(root, params){
  const a=(params&&params.code&&DB.acctLedgerDocs&&DB.acctLedgerDocs[params.code])||DB.acctLedger;
  let run=a.open;
  const rows=a.rows.map((r,i)=>{ run+=r.dr-r.cr; return `<tr class="je-link" data-je="${esc(r.je)}" style="cursor:pointer">
      <td class="lineno">${i+1}</td>
      <td class="l">${esc(r.date)}</td>
      <td class="l li-name"><b>${esc(r.je)}</b><small>${esc(r.memo)}</small></td>
      <td class="tnum">${r.dr?money(r.dr):'—'}</td>
      <td class="tnum">${r.cr?money(r.cr):'—'}</td>
      <td class="tnum"><b>${money(run)}</b></td></tr>`; }).join('');
  const totDr=a.rows.reduce((s,r)=>s+r.dr,0), totCr=a.rows.reduce((s,r)=>s+r.cr,0);
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,'Finance','General Ledger',{cur:a.code}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('book')}${esc(a.name)} <span class="dnum">${esc(a.code)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(a.period)} · ${a.rows.length} entries</div></div>
        <div class="dactions">${btn('Back to GL',{icon:'chevL',cls:'soft',attrs:'onclick="navigate(\'gl\')"'})}${btn('Export',{icon:'download',cls:'soft'})}</div></div>
      <div class="docmeta">
        <div class="dm"><small>Opening balance</small><b>${money0(a.open)}</b></div>
        <div class="dm"><small>Total debits</small><b>${money0(totDr)}</b></div>
        <div class="dm"><small>Total credits</small><b>${money0(totCr)}</b></div>
        <div class="dm"><small>Closing balance</small><b>${money0(a.close)}</b></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>Transactions</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">running balance</span></div>
      <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Date</th><th class="l">Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
      <tbody><tr style="background:var(--surface-2)"><td></td><td class="l" colspan="2" style="font-weight:600;color:var(--muted)">Opening balance</td><td></td><td></td><td class="tnum"><b>${money(a.open)}</b></td></tr>${rows}</tbody>
      <tfoot><tr><td></td><td class="l" colspan="2" style="font-weight:600">Closing balance</td><td class="tnum"><b>${money0(totDr)}</b></td><td class="tnum"><b>${money0(totCr)}</b></td><td class="tnum"><b>${money(a.close)}</b></td></tr></tfoot>
      </table>
    </div>
    <div style="height:40px"></div>
  </div></div></section></div>`;
  root.querySelectorAll('tr.je-link').forEach(tr=>tr.addEventListener('click',()=>{
    const ref=tr.dataset.je;
    (DB.journalDocs&&DB.journalDocs[ref])?navigate('journal-entry',{no:ref}):toast('Open journal · '+ref,'info');
  }));
};

/* ---------------- BANK RECONCILIATION (interactive) ---------------- */
SCREENS['bank-rec'] = function(root){
  const b=JSON.parse(JSON.stringify(DB.bankRec));
  function unmatchedNet(){ return b.lines.filter(l=>!l.matched).reduce((s,l)=>s+l.amount,0); }
  function render(){
    const matched=b.lines.filter(l=>l.matched).length;
    const unm=b.lines.filter(l=>!l.matched);
    const diff=b.bookClose-b.stmtClose; // 1,700 explained by unbooked items
    const cleared=unm.length===0;
    const list=b.lines.map((l,i)=>`<div class="pickrow ${l.matched?'done':''}" data-i="${i}">
        <div class="pick-check">${ic('check')}</div>
        <div style="flex:none;width:58px;color:var(--muted);font-size:12.5px">${esc(l.date)}</div>
        <div style="flex:1;min-width:0"><b style="font-weight:600;font-size:13.5px">${esc(l.desc)}</b><small style="display:block;color:var(--muted);font-size:11.5px">${l.je?'Matched to '+esc(l.je):'Not yet in the books — needs a journal'}</small></div>
        <div class="tnum" style="font-weight:600;color:${l.amount<0?'var(--danger)':'var(--ok)'}">${signed0(l.amount)}</div>
        <div style="flex:none;width:120px;text-align:right">${l.matched?cap('Matched','ok'):`<button class="btn soft sm" data-book="${i}">${ic('plus')}<span>Book entry</span></button>`}</div>
      </div>`).join('');
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,'Finance','Bank Reconciliation'])}
        <div class="h1row"><h1>Bank Reconciliation</h1><span class="countchip">${esc(b.period)}</span>
          <div class="headright"><div class="kfig"><small>Statement</small><b class="tnum">${money0(b.stmtClose)}</b></div><div class="kfig"><small>Book / GL</small><b class="tnum">${money0(b.bookClose)}</b></div></div></div>
      </div>
      <div class="pick-layout">
        <div class="pick-main">
          <div style="font-size:12.5px;color:var(--muted);margin:6px 2px 12px">${esc(b.account)} · ${matched} of ${b.lines.length} statement lines matched to the ledger. Book unreconciled bank-originated items to clear the difference.</div>
          ${list}
        </div>
        <aside class="pick-side">
          <div class="sectitle" style="margin-top:0">Reconciliation</div>
          <div class="sumcard">
            <div class="sumrow"><span class="sk2">Balance per statement</span><span class="sv tnum">${money0(b.stmtClose)}</span></div>
            <div class="sumrow"><span class="sk2">Balance per books (GL)</span><span class="sv tnum">${money0(b.bookClose)}</span></div>
            <div class="sumrow"><span class="sk2">Unreconciled items</span><span class="sv tnum">${unm.length?signed0(unmatchedNet()):'$0'}</span></div>
            <div class="sumrow total"><span class="sk2">Difference</span><span class="sv tnum" style="color:${cleared?'var(--ok)':'var(--warn)'}">${cleared?'$0':money0(Math.abs(diff))}</span></div>
          </div>
          <div style="margin-top:12px">${cleared
            ? indicator({tone:'ok',icon:'checkc',label:'Reconciled',value:'Balanced',sub:'Statement agrees with the general ledger. Ready to lock the period.'})
            : indicator({tone:'warn',icon:'warn',label:`${unm.length} item${unm.length>1?'s':''} to book`,value:money0(Math.abs(diff)),sub:'Bank charge & interest are on the statement but not yet in the ledger.'})}</div>
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">
            ${unm.length?btn('Book all adjustments',{icon:'book',cls:'primary',sm:false,attrs:'data-act="bookall"'}):btn('Complete reconciliation',{icon:'check',cls:'primary',sm:false,attrs:'onclick="toast(\'June reconciliation completed · period ready to lock\',\'ok\')"'})}
            ${btn('Import statement',{icon:'upload',cls:'soft',sm:false,attrs:'onclick="navigate(\'data-import\')"'})}
          </div>
        </aside>
      </div>
    </section></div>`;
    root.querySelectorAll('[data-book]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const i=+btn.dataset.book;b.lines[i].matched=true;b.lines[i].je='JE-26-06'+(20+i);render();toast('Journal posted for '+b.lines[i].desc.split('—')[0].trim(),'ok');}));
    const ba=root.querySelector('[data-act="bookall"]'); ba&&ba.addEventListener('click',()=>{b.lines.forEach((l,i)=>{if(!l.matched){l.matched=true;l.je='JE-26-06'+(20+i);}});render();toast('All adjustments booked · reconciliation balanced','ok');});
    root.querySelectorAll('.pickrow').forEach(r=>r.addEventListener('click',e=>{ if(e.target.closest('[data-book]'))return; const i=+r.dataset.i; if(b.lines[i].matched){b.lines[i].matched=false;b.lines[i].je=null;render();} }));
  }
  render();
};

/* ---------------- INCOME STATEMENT (P&L report) ---------------- */
SCREENS['pnl'] = function(root){
  function sum(rows,k){ return rows.reduce((s,r)=>s+r[k],0); }
  // compute running subtotals
  const rev=DB.pnl[0], cos=DB.pnl[1], opex=DB.pnl[3];
  const gp={cur:sum(rev.rows,'cur')+sum(cos.rows,'cur'), ytd:sum(rev.rows,'ytd')+sum(cos.rows,'ytd'), bud:sum(rev.rows,'bud')+sum(cos.rows,'bud')};
  const op={cur:gp.cur+sum(opex.rows,'cur'), ytd:gp.ytd+sum(opex.rows,'ytd'), bud:gp.bud+sum(opex.rows,'bud')};
  function varCell(ytd,bud){ const v=ytd-bud, pct=bud?v/Math.abs(bud)*100:0; const cls=v>=0?'pos':'neg'; return `<b class="tnum delta ${cls}">${v>=0?'+':''}${pct.toFixed(1)}%</b>`; }
  const tpl='minmax(220px,2.4fr) 130px 150px 150px 90px';
  let body='';
  function headRow(g){
    const cur=sum(g.rows,'cur'), ytd=sum(g.rows,'ytd'), bud=sum(g.rows,'bud');
    body+=`<div class="dt-r" style="background:var(--surface-3);font-weight:700"><div class="dt-c l">${esc(g.grp)}</div><div class="dt-c r tnum">${pnlCell(cur)}</div><div class="dt-c r tnum">${pnlCell(ytd)}</div><div class="dt-c r tnum" style="color:var(--muted)">${pnlCell(bud)}</div><div class="dt-c r">${varCell(ytd,bud)}</div></div>`;
    g.rows.forEach(r=>{ body+=`<div class="dt-r"><div class="dt-c l indent1">${esc(r.name)}</div><div class="dt-c r tnum">${pnlCell(r.cur)}</div><div class="dt-c r tnum">${pnlCell(r.ytd)}</div><div class="dt-c r tnum" style="color:var(--muted)">${pnlCell(r.bud)}</div><div class="dt-c r">${varCell(r.ytd,r.bud)}</div></div>`; });
  }
  function subtotal(label,o){
    body+=`<div class="dt-r grandtotal"><div class="dt-c l">${esc(label)}</div><div class="dt-c r tnum">${pnlCell(o.cur)}</div><div class="dt-c r tnum">${pnlCell(o.ytd)}</div><div class="dt-c r tnum" style="color:var(--muted)">${pnlCell(o.bud)}</div><div class="dt-c r">${varCell(o.ytd,o.bud)}</div></div>`;
  }
  headRow(rev); headRow(cos); subtotal('Gross profit',gp); headRow(opex); subtotal('Operating profit (Net)',op);
  const gpMargin=(op.ytd/sum(rev.rows,'ytd')*100).toFixed(1);

  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      <div class="fld"><span>Company</span><select><option>${esc(DB.company.name)}</option><option>All companies (consolidated)</option></select></div>
      <div class="fld"><span>Period</span><select><option>P06 · June 2026</option><option>Q2 FY2026</option><option>FY2026 YTD</option></select></div>
      <div class="fld"><span>Compare to</span><select><option>Budget</option><option>Prior year</option><option>Prior period</option></select></div>
      <div class="fld"><span>Basis</span><select><option>Accrual</option><option>Cash</option></select></div>
      ${btn('Run report',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Income statement refreshed\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">${btn('Balance sheet',{icon:'book',cls:'soft',attrs:'onclick="toast(\'Balance Sheet — not in this build\',\'info\')"'})}</div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Income Statement (P&amp;L)</b><div class="report-meta">${DB.company.name} · FY2026 YTD vs budget · net margin ${gpMargin}%</div></div>
        <div class="grow"></div>
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div class="tablewrap"><div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
        <div class="dt-r dt-head"><div class="dt-c l">Account</div><div class="dt-c r">This period</div><div class="dt-c r">YTD</div><div class="dt-c r">Budget YTD</div><div class="dt-c r">Var %</div></div>
        <div class="dt-body">${body}</div>
      </div></div></div>
    </div>
  </div></section></div>`;
};

/* ---------------- AR AGING (report) ---------------- */
SCREENS['ar-aging'] = function(root){
  const keys=['cur','b30','b60','b90','b90p'];
  const colTot=k=>DB.arAging.reduce((s,r)=>s+r[k],0);
  const rowTot=r=>keys.reduce((s,k)=>s+r[k],0);
  const grand=DB.arAging.reduce((s,r)=>s+rowTot(r),0);
  const overdue=colTot('b30')+colTot('b60')+colTot('b90')+colTot('b90p');
  function amt(v){ return v?`<span class="tnum">${money0(v)}</span>`:`<span style="color:var(--faint)">—</span>`; }
  const tpl='minmax(200px,2fr) 110px 110px 110px 110px 120px 130px';
  let body='';
  DB.arAging.slice().sort((a,b)=>rowTot(b)-rowTot(a)).forEach(r=>{
    const od=r.b30+r.b60+r.b90+r.b90p;
    body+=`<div class="dt-r drill" data-code="${esc(r.code)}">
      <div class="dt-c l"><div class="cellsub"><b>${esc(r.cust)}</b><small>${esc(r.code)}</small></div></div>
      <div class="dt-c r">${amt(r.cur)}</div>
      <div class="dt-c r" style="color:${r.b30?'var(--fg)':''}">${amt(r.b30)}</div>
      <div class="dt-c r" style="color:${r.b60?'var(--warn)':''}">${amt(r.b60)}</div>
      <div class="dt-c r" style="color:${r.b90?'var(--warn)':''}">${amt(r.b90)}</div>
      <div class="dt-c r" style="color:${r.b90p?'var(--danger)':''}">${amt(r.b90p)}</div>
      <div class="dt-c r tnum"><b>${money0(rowTot(r))}</b>${od>0?`<small style="display:block;color:var(--danger);font-size:10.5px">${money0(od)} overdue</small>`:''}</div></div>`;
  });
  body+=`<div class="dt-r grandtotal"><div class="dt-c l">Total receivables</div><div class="dt-c r tnum">${money0(colTot('cur'))}</div><div class="dt-c r tnum">${money0(colTot('b30'))}</div><div class="dt-c r tnum">${money0(colTot('b60'))}</div><div class="dt-c r tnum">${money0(colTot('b90'))}</div><div class="dt-c r tnum">${money0(colTot('b90p'))}</div><div class="dt-c r tnum"><b>${money0(grand)}</b></div></div>`;

  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      <div class="fld"><span>As at date</span><select><option>Jun 20, 2026</option><option>Period end</option></select></div>
      <div class="fld"><span>Aging buckets</span><select><option>30 / 60 / 90 days</option><option>15 / 30 / 45 days</option></select></div>
      <div class="fld"><span>Customer</span><select><option>All customers</option><option>Overdue only</option></select></div>
      <div class="fld"><span>Currency</span><select><option>USD (functional)</option></select></div>
      ${btn('Run report',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Aging recalculated\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">
        <div class="indicator ${overdue/grand>0.2?'warn':'ok'}"><div class="ind-top">${ic('receipt')}<span>Overdue</span><span class="ind-r">${Math.round(overdue/grand*100)}%</span></div><div class="track"><i style="width:${Math.round(overdue/grand*100)}%"></i></div><small>${money0(overdue)} of ${money0(grand)} past due.</small></div>
      </div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Accounts Receivable Aging</b><div class="report-meta">As at Jun 20, 2026 · ${DB.arAging.length} customers · ${money0(overdue)} overdue · click a customer to open 360</div></div>
        <div class="grow"></div>
        ${btn('Send reminders',{icon:'send',cls:'soft',attrs:'onclick="toast(\'Reminder emails queued for overdue accounts\',\'ok\')"'})}${btn('Excel',{icon:'filexls',cls:'soft'})}
      </div>
      <div class="tablewrap"><div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
        <div class="dt-r dt-head"><div class="dt-c l">Customer</div><div class="dt-c r">Not due</div><div class="dt-c r">1–30</div><div class="dt-c r">31–60</div><div class="dt-c r">61–90</div><div class="dt-c r">90+</div><div class="dt-c r">Total</div></div>
        <div class="dt-body">${body}</div>
      </div></div></div>
    </div>
  </div></section></div>`;
  root.querySelectorAll('.dt-r.drill').forEach(tr=>tr.addEventListener('click',()=>{ tr.dataset.code==='CUST-0007'?navigate('crm-customer'):toast('Open customer '+tr.dataset.code,'info'); }));
};
