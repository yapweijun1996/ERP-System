/* ============================================================
   ARIA ERP — Sales module: controls, returns & adjustments
   Returns/RMA (+doc) · Credit Notes (+doc) · Debit Notes ·
   Price Lists · Discount Management · Credit Control · Commission
   ============================================================ */

/* ---------------- SALES RETURNS / RMA ---------------- */
/* RMA_TONE → TONES.rma (defined in data-core.js) */
registerSalesTransactionList({
  route:'sales-returns', active:'sales-returns', title:'Sales Returns / RMA', unit:'returns',
  sub:'Customer returns linked to the original invoice or delivery — approve, receive, inspect, then decide credit, replacement or rejection. Accepted goods update inventory.',
  rows:()=>DB.salesReturns, rowId:r=>r.no,
  chips:[['all','All'],['open','Open'],['received','Received / inspected'],['credited','Credited'],['rejected','Rejected']],
  filterFn:(r,f)=>f==='open'?['Requested','Approved'].includes(r.status):f==='received'?['Received','Inspected'].includes(r.status):f==='credited'?r.status==='Credited':r.status==='Rejected',
  kpis:(r)=>[
    {label:'Open RMAs', val:r.filter(x=>['Requested','Approved','Received','Inspected'].includes(x.status)).length, f:'open'},
    {label:'Return value', val:money0(r.filter(x=>x.status!=='Rejected').reduce((a,x)=>a+x.value,0))},
    {label:'Awaiting decision', val:r.filter(x=>x.disposition==='Pending decision').length, accent:true},
    {label:'Credited', val:r.filter(x=>x.status==='Credited').length, f:'credited'},
  ],
  newBtn:{label:'New return', onClick:()=>toast('New RMA — link to an invoice or delivery','info')},
  columns:[
    {label:'RMA', w:'minmax(130px,1.2fr)', render:r=>docNoCell(r.no, r.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.5fr)', render:r=>custCell(r.cust,r.custCode)},
    {label:'Against', align:'l', w:'minmax(104px,1fr)', render:r=>`<span class="mono" style="font-size:12px">${esc(r.ref)}</span>`},
    {label:'Reason', align:'l', w:'minmax(150px,1.6fr)', render:r=>`<span class="li-subj">${esc(r.reason)}</span>`},
    {label:'Disposition', align:'l', w:'minmax(120px,1.1fr)', render:r=>`<span style="color:var(--muted)">${esc(r.disposition)}</span>`},
    {label:'Value', align:'r', sortable:true, w:'minmax(92px,0.9fr)', render:r=>`<b class="tnum">${money0(r.value)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(112px,1fr)', render:r=>cap(r.status,RMA_TONE[r.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(r)=>[
    {id:'view',icon:'ext',label:'Open RMA',run:()=>openReturn(r)},
    {id:'approve',icon:'check',label:'Approve return',run:()=>toast(`${r.no} approved`,'ok')},
    {id:'cn',icon:'coins',label:'Issue credit note',run:()=>{navigate('credit-notes');}},
    {id:'reject',icon:'x',label:'Reject return',danger:true,sep:true,run:()=>toast(`${r.no} rejected`,'danger')},
  ],
  rowAction:{
    label:r=>`${t('common.open')} ${r.no}`,
    run:r=>openReturn(r),
  },
});
function openReturn(r){
  if(r.no==='RMA-26-0044'){ navigate('sales-return'); return; }
  openTxn('return', r);
}

/* full RMA document (RMA-26-0044) */
SCREENS['sales-return'] = function(root){
  const d=DB.rma0044; const val=d.lines.reduce((a,l)=>a+l.qty*l.price,0);
  const lineRows=d.lines.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
    <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}</small></td>
    <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td><td class="tnum">${money(l.price)}</td>
    <td class="l">${esc(l.condition)}</td><td class="l">${l.accept?cap('Accept back','ok'):cap('Scrap','danger')}</td>
    <td class="tnum"><b>${money(l.qty*l.price)}</b></td></tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master" data-screen-label="Sales · RMA"><div class="scrollarea">
    <div class="pagehead">${crumbs([DB.company.name,{label:'Sales',route:'sales-home'},{label:'Returns',route:'sales-returns'},{cur:d.no}])}${salesNav('sales-returns')}</div>
    <div class="docwrap"><div class="docpage" style="padding-top:4px">
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('refresh')}Sales Return <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.cust)} · against ${esc(d.ref)} · ${esc(d.reason)}</div></div>
        <div class="dactions">${cap(d.status,RMA_TONE[d.status])}${btn('Print',{icon:'print',cls:'soft'})}</div>
      </div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Requested</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Approved</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Received</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('check')}</span>Inspected</div><span class="stepline"></span>
        <div class="step"><span class="sdot"></span>Credited</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Customer</small><div class="partner">${profileAvatar({name:d.cust,cls:'pav',size:26})}<b>${esc(d.cust)}</b></div></div>
        <div class="dm"><small>Against invoice</small><b>${esc(d.ref)}</b></div>
        <div class="dm"><small>From delivery</small><b>${esc(d.do)}</b></div>
        <div class="dm"><small>Warehouse</small><b>${esc(d.warehouse)}</b></div>
        <div class="dm"><small>Disposition</small><b>${esc(d.disposition)}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Returned items</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lines.length} line · inspected</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Unit price</th><th class="l">Condition</th><th class="l">Decision</th><th>Value</th></tr></thead><tbody>${lineRows}</tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Inspection & activity</h3></div><div class="panel-body">${auditTrail([
          {kind:'current',when:'Jun 11 · 15:20',what:'Inspection complete — casing damaged in transit, accept back &amp; credit',who:'Quality · T. Fielding'},
          {kind:'add',when:'Jun 11 · 11:05',what:'Goods received at KL-Main dock',who:'Warehouse'},
          {kind:'add',when:'Jun 11 · 09:30',what:'Return approved against <b>'+esc(d.ref)+'</b>',who:'J. Okafor'},
        ])}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Return summary</div>
          <div class="sumrow"><span class="sk2">Items</span><span class="sv tnum">${d.lines.reduce((a,l)=>a+l.qty,0)} ea</span></div>
          <div class="sumrow"><span class="sk2">Disposition</span><span class="sv">${esc(d.disposition)}</span></div>
          <div class="sumrow total"><span class="sk2">Credit value</span><span class="sv tnum">${money(val)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Next step</div>
          ${indicator({tone:'ok',icon:'coins',label:'Ready to credit',value:money0(val),sub:'Inspection passed — raise a credit note to settle the customer balance.'})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:d.ref,label:'Sales invoice',meta:'Meridian Robotics',status:'Partially Paid'},
            {no:d.do,label:'Delivery order',meta:'14 packages',status:'In transit'},
            {no:'CN-26-0028',label:'Credit note (draft)',meta:'from this RMA',status:'Draft'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Inspection passed · ${money(val)} to credit.</div>
      <div class="grow"></div>
      ${btn('Reject return',{icon:'x',cls:'soft',attrs:'onclick="toast(\'Return rejected\',\'danger\')"'})}
      ${btn('Issue credit note',{icon:'coins',cls:'primary',sm:false,attrs:'onclick="navigate(\'credit-note\')"'})}
    </div>
    </div></div>
  </div></section></div>`;
};

/* ---------------- CREDIT NOTES ---------------- */
/* CN_TONE → TONES.creditNote (defined in data-core.js) */
registerSalesTransactionList({
  route:'credit-notes', active:'credit-notes', title:'Credit Notes', unit:'notes',
  sub:'Customer credit adjustments from returns, overcharges, price corrections or damage. Posted credits reduce the receivable and can be applied to open invoices.',
  rows:()=>DB.creditNotes, rowId:c=>c.no,
  chips:[['all','All'],['draft','Draft'],['posted','Posted'],['applied','Applied']],
  filterFn:(c,f)=>c.status===({draft:'Draft',posted:'Posted',applied:'Applied'}[f]),
  kpis:(r)=>[
    {label:'Credit notes', val:r.length},
    {label:'Total credited', val:money0(r.reduce((a,c)=>a+c.amount,0))},
    {label:'Unapplied', val:money0(r.reduce((a,c)=>a+(c.amount-c.applied),0)), accent:true},
    {label:'Draft', val:r.filter(c=>c.status==='Draft').length, f:'draft'},
  ],
  newBtn:{label:'New credit note', onClick:()=>toast('New credit note — select an invoice','info')},
  columns:[
    {label:'Credit note', w:'minmax(132px,1.2fr)', render:c=>docNoCell(c.no, c.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.5fr)', render:c=>custCell(c.cust,c.custCode)},
    {label:'Against', align:'l', w:'minmax(104px,1fr)', render:c=>`<span class="mono" style="font-size:12px">${esc(c.ref)}</span>`},
    {label:'Reason', align:'l', w:'minmax(160px,1.8fr)', render:c=>`<span class="li-subj">${esc(c.reason)}</span>`},
    {label:'Amount', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:c=>`<b class="tnum">${money(c.amount)}</b>`},
    {label:'Applied', align:'r', w:'minmax(92px,0.9fr)', render:c=>`<span class="tnum" style="color:${c.applied>=c.amount?'var(--ok)':'var(--muted)'}">${c.applied?money(c.applied):'—'}</span>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(104px,1fr)', render:c=>cap(c.status,CN_TONE[c.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(c)=>[
    {id:'view',icon:'ext',label:'Open credit note',run:()=>openCredit(c)},
    {id:'pdf',icon:'filepdf',label:'Download PDF',run:()=>toast('Credit note PDF generated','ok')},
    {id:'apply',icon:'check',label:'Apply to invoice',run:()=>toast(`${c.no} applied to ${c.ref}`,'ok')},
  ],
  rowAction:{
    label:c=>`${t('common.open')} ${c.no}`,
    run:c=>openCredit(c),
  },
});
function openCredit(c){
  if(c.no==='CN-26-0028'){ navigate('credit-note'); return; }
  openTxn('credit', c);
}

/* full credit note document (CN-26-0028) */
SCREENS['credit-note'] = function(root){
  const c=DB.creditNotes.find(x=>x.no==='CN-26-0028');
  const tax=c.amount*0.06/1.06, net=c.amount-tax;
  root.innerHTML=`<div class="content full"><section class="master" data-screen-label="Sales · Credit Note"><div class="scrollarea">
    <div class="pagehead">${crumbs([DB.company.name,{label:'Sales',route:'sales-home'},{label:'Credit Notes',route:'credit-notes'},{cur:c.no}])}${salesNav('credit-notes')}</div>
    <div class="docwrap"><div class="docpage" style="padding-top:4px">
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('coins')}Credit Note <span class="dnum">${esc(c.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(c.cust)} · against ${esc(c.ref)} · ${esc(c.reason)}</div></div>
        <div class="dactions">${cap(c.status,CN_TONE[c.status])}${btn('Download PDF',{icon:'filepdf',cls:'soft'})}</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Customer</small><div class="partner">${profileAvatar({name:c.cust,cls:'pav',size:26})}<b>${esc(c.cust)}</b></div></div>
        <div class="dm"><small>Date</small><b>${esc(c.date)}</b></div>
        <div class="dm"><small>Against invoice</small><b>${esc(c.ref)}</b></div>
        <div class="dm"><small>Source</small><b>RMA-26-0044</b></div>
        <div class="dm"><small>Reason</small><b>Goods returned</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Credit lines</h3></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody><tr><td class="lineno">1</td><td class="l li-name"><b>Conveyor Drive Unit</b><small>NW-9001 · returned, damaged casing</small></td><td class="tnum">2 ea</td><td class="tnum">${money(1480)}</td><td class="tnum"><b>${money(2960)}</b></td></tr></tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Audit trail</h3></div><div class="panel-body">${auditTrail([
          {kind:'current',when:'Jun 11 · 15:40',what:'Credit note drafted from <b>RMA-26-0044</b>',who:'J. Okafor'},
          {kind:'add',when:'Jun 11 · 15:20',what:'Return inspection passed',who:'Quality'},
        ])}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">
          <div class="sumrow"><span class="sk2">Net</span><span class="sv tnum">${money(net)}</span></div>
          <div class="sumrow"><span class="sk2">GST (6%)</span><span class="sv tnum">${money(tax)}</span></div>
          <div class="sumrow total"><span class="sk2">Credit total</span><span class="sv tnum">${money(c.amount)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Application</div>
          ${indicator({tone:'warn',icon:'receipt',label:'Unapplied credit',value:money0(c.amount),sub:`Will reduce the balance on ${esc(c.ref)} when posted.`})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:'RMA-26-0044',label:'Source return',meta:'inspected',status:'Inspected'},
            {no:c.ref,label:'Sales invoice',meta:'Meridian Robotics',status:'Partially Paid'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div class="grow"></div>
      ${btn('Post & apply',{icon:'check',cls:'primary',sm:false,attrs:`onclick="toast('Credit note posted &amp; applied to ${c.ref}','ok')"`})}
    </div>
    </div></div>
  </div></section></div>`;
};

/* ---------------- DEBIT NOTES ---------------- */
/* DN_TONE → TONES.debitNote (defined in data-core.js) */
registerSalesTransactionList({
  route:'debit-notes', active:'debit-notes', title:'Debit Notes', unit:'notes',
  sub:'Additional charges raised to a customer — freight, services, undercharges or late-payment fees. Posted debit notes increase the receivable.',
  rows:()=>DB.debitNotes, rowId:d=>d.no,
  chips:[['all','All'],['draft','Draft'],['posted','Posted']],
  filterFn:(d,f)=>d.status===({draft:'Draft',posted:'Posted'}[f]),
  kpis:(r)=>[
    {label:'Debit notes', val:r.length},
    {label:'Total charged', val:money0(r.reduce((a,d)=>a+d.amount,0))},
    {label:'Posted', val:r.filter(d=>d.status==='Posted').length, f:'posted'},
    {label:'Draft', val:r.filter(d=>d.status==='Draft').length, f:'draft'},
  ],
  newBtn:{label:'New debit note', onClick:()=>toast('New debit note — add a charge','info')},
  columns:[
    {label:'Debit note', w:'minmax(132px,1.2fr)', render:d=>docNoCell(d.no, d.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.5fr)', render:d=>custCell(d.cust,d.custCode)},
    {label:'Reference', align:'l', w:'minmax(104px,1fr)', render:d=>`<span class="mono" style="font-size:12px">${esc(d.ref)}</span>`},
    {label:'Reason', align:'l', w:'minmax(170px,1.9fr)', render:d=>`<span class="li-subj">${esc(d.reason)}</span>`},
    {label:'Amount', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:d=>`<b class="tnum">${money(d.amount)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(104px,1fr)', render:d=>cap(d.status,DN_TONE[d.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(d)=>[
    {id:'view',icon:'ext',label:'View debit note',run:()=>openTxn('debit', d)},
    {id:'pdf',icon:'filepdf',label:'Download PDF',run:()=>toast('Debit note PDF generated','ok')},
    {id:'post',icon:'check',label:'Post to finance',run:()=>toast(`${d.no} posted`,'ok')},
  ],
  rowAction:{
    label:d=>`${t('common.open')} ${d.no}`,
    run:d=>openTxn('debit',d),
  },
});

/* ---------------- PRICE LISTS ---------------- */
/* PL_TONE → TONES.priceList (defined in data-core.js) */
SCREENS['price-lists'] = function(root){
  const P=DB.priceLists;
  const kpis=[
    {label:'Active lists', val:P.filter(p=>p.status==='Active').length},
    {label:'Contracts', val:P.filter(p=>p.basis==='Customer').length},
    {label:'Scheduled', val:P.filter(p=>p.status==='Scheduled').length},
    {label:'Archived', val:P.filter(p=>p.status==='Archived').length},
  ];
  const table=buildTable({ checkable:true, rows:P, rowId:p=>p.code, columns:[
    {label:'Price list', w:'minmax(180px,1.8fr)', render:p=>`<div class="cellsub"><b>${esc(p.name)}${p.def?' <span class="pl-def">Default</span>':''}</b><small class="mono">${esc(p.code)}</small></div>`},
    {label:'Basis', align:'l', w:'minmax(110px,1.1fr)', render:p=>esc(p.basis)},
    {label:'Scope', align:'l', w:'minmax(140px,1.6fr)', render:p=>`<span style="color:var(--muted)">${esc(p.scope)}</span>`},
    {label:'Currency', align:'l', w:'minmax(80px,0.7fr)', render:p=>esc(p.currency)},
    {label:'Items', align:'r', w:'minmax(70px,0.7fr)', render:p=>`<span class="tnum">${num(p.items)}</span>`},
    {label:'Effective', align:'l', w:'minmax(96px,1fr)', render:p=>`<span class="muted-date" data-i18n-format="date" data-i18n-value="${esc(dateValue(p.effective))}">${esc(formatDate(dateValue(p.effective)))}</span>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(100px,1fr)', render:p=>cap(p.status,PL_TONE[p.status])},
  ]});
  const m=DB.priceListRows;
  const matrix=`<div class="panel" style="margin:18px 0 0"><div class="panel-h">${ic('tag')}<h3>Meridian Robotics — Contract pricing</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${m.length} of 18 items · effective 2026-04-01</span></div>
    <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Std list</th><th>Contract</th><th>Min sell</th><th>Discount</th><th class="l">Margin guard</th></tr></thead>
    <tbody>${m.map((r,i)=>{const disc=Math.round((1-r.contract/r.list)*100);const safe=r.contract>=r.min;return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(r.name)}</b><small>${esc(r.sku)} · per ${esc(r.uom)}</small></td>
      <td class="tnum">${money(r.list)}</td><td class="tnum"><b>${money(r.contract)}</b></td><td class="tnum" style="color:var(--muted)">${money(r.min)}</td>
      <td class="tnum" style="color:${disc>0?'var(--warn)':'var(--muted)'}">${disc>0?disc+'%':'—'}</td>
      <td class="l">${safe?cap('Above floor','ok'):cap('Below floor','danger')}</td></tr>`;}).join('')}</tbody></table></div>`;

  root.innerHTML=salesPage({ active:'price-lists', title:'Price Lists', count:P.length+' lists',
    sub:'Pricing by customer, group, item, category or currency — with effective dates, contract rates and minimum selling-price floors.',
    action:btn('New price list',{icon:'plus',cls:'primary',attrs:'data-new'}),
    body:`<div class="sales-body"><div class="so-kpibar">${kpis.map(k=>`<button class="so-kpi" disabled><small>${esc(k.label)}</small><b class="tnum">${k.val}</b></button>`).join('')}</div>
      <div class="sales-tablewrap" id="plTable">${table}</div>${matrix}</div>` });
  wireTable($('#plTable'),{onRow:(id)=>toast('Price list '+id,'info')});
  const nb=$('#viewRoot [data-new]'); nb&&nb.addEventListener('click',()=>toast('New price list — define basis & scope','info'));
};

/* ---------------- DISCOUNT MANAGEMENT ---------------- */
/* DRULE_TONE → TONES.discountRule (defined in data-core.js) */
registerSalesTransactionList({
  route:'discount-mgmt', active:'discount-mgmt', title:'Discount Management', unit:'rules',
  sub:'Standard, customer, item, quantity and campaign discounts — with maximum-discount control that routes over-threshold deals for approval.',
  rows:()=>DB.discountRules, rowId:d=>d.code,
  chips:[['all','All'],['active','Active'],['scheduled','Scheduled']],
  filterFn:(d,f)=>d.status===({active:'Active',scheduled:'Scheduled'}[f]),
  kpis:(r)=>[
    {label:'Active rules', val:r.filter(d=>d.status==='Active').length},
    {label:'Approval-gated', val:r.filter(d=>d.approval!=='None').length, accent:true},
    {label:'Campaigns', val:r.filter(d=>d.type==='Campaign').length},
    {label:'Discount cap', val:'15%'},
  ],
  newBtn:{label:'New rule', onClick:()=>toast('New discount rule','info')},
  columns:[
    {label:'Rule', w:'minmax(170px,1.7fr)', render:d=>`<div class="cellsub"><b>${esc(d.name)}</b><small class="mono">${esc(d.code)}</small></div>`},
    {label:'Type', align:'l', w:'minmax(96px,0.9fr)', render:d=>esc(d.type)},
    {label:'Scope', align:'l', w:'minmax(140px,1.6fr)', render:d=>`<span style="color:var(--muted)">${esc(d.scope)}</span>`},
    {label:'Value', align:'l', w:'minmax(80px,0.8fr)', render:d=>`<b>${esc(d.value)}</b>`},
    {label:'Threshold', align:'l', w:'minmax(96px,1fr)', render:d=>`<span style="color:var(--muted)">${esc(d.threshold)}</span>`},
    {label:'Approval', align:'l', w:'minmax(96px,1fr)', render:d=>d.approval==='None'?'<span style="color:var(--muted)">Auto</span>':cap(d.approval,'warn')},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(96px,0.9fr)', render:d=>cap(d.status,DRULE_TONE[d.status]||'neutral')},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(d)=>[
    {id:'edit',icon:'edit',label:'Edit rule',run:()=>toast('Editing '+d.code,'info')},
    {id:'dup',icon:'copy',label:'Duplicate',run:()=>toast(d.code+' duplicated','info')},
    {id:'off',icon:'x',label:'Deactivate',danger:true,sep:true,run:()=>toast(d.code+' deactivated','danger')},
  ],
  rowAction:{
    label:d=>`${t('common.open')} ${d.code}`,
    run:d=>salesModal({icon:'percent',no:d.code,title:d.name,metaRows:[['Type',esc(d.type)],['Scope',esc(d.scope)],['Value',esc(d.value)],['Threshold',esc(d.threshold)],['Approval',esc(d.approval)],['Status',cap(d.status,DRULE_TONE[d.status]||'neutral')]]}),
  },
});

/* ---------------- CREDIT CONTROL ---------------- */
SCREENS['credit-control'] = function(root){
  const openByCust={};
  DB.salesOrders.filter(s=>s.status!=='Closed'&&s.status!=='Cancelled').forEach(s=>{ openByCust[s.custCode]=(openByCust[s.custCode]||0)+s.total; });
  const data=DB.customers.map(c=>{
    const openSO=openByCust[c.code]||0;
    const exposure=c.balance+openSO;
    const available=c.limit-exposure;
    const pct=Math.round(exposure/c.limit*100);
    const hold=c.status==='On hold'||available<0;
    return {...c, openSO, exposure, available, pct, hold};
  });
  const totExp=data.reduce((a,c)=>a+c.exposure,0), totOver=data.reduce((a,c)=>a+c.overdue,0);
  const kpis=[
    {label:'Total exposure', val:money0(totExp)},
    {label:'Overdue', val:money0(totOver), neg:true},
    {label:'Over / near limit', val:data.filter(c=>c.pct>=90).length, accent:true},
    {label:'On credit hold', val:data.filter(c=>c.hold).length, neg:data.some(c=>c.hold)},
  ];
  const table=buildTable({ checkable:true, rows:data, rowId:c=>c.code, columns:[
    {label:'Customer', w:'minmax(170px,1.8fr)', render:c=>custCell(c.name,c.code)},
    {label:'Terms', align:'l', w:'minmax(76px,0.7fr)', render:c=>esc(c.terms)},
    {label:'Limit', align:'r', w:'minmax(94px,0.9fr)', render:c=>`<span class="tnum">${money0(c.limit)}</span>`},
    {label:'AR balance', align:'r', w:'minmax(96px,0.9fr)', render:c=>`<span class="tnum">${money0(c.balance)}</span>`},
    {label:'Open orders', align:'r', w:'minmax(96px,0.9fr)', render:c=>`<span class="tnum" style="color:var(--muted)">${c.openSO?money0(c.openSO):'—'}</span>`},
    {label:'Overdue', align:'r', w:'minmax(90px,0.9fr)', render:c=>`<span class="tnum" style="color:${c.overdue>0?'var(--danger)':'var(--muted)'}">${c.overdue>0?money0(c.overdue):'—'}</span>`},
    {label:'Utilisation', align:'l', w:'minmax(130px,1.4fr)', render:c=>`<span class="util"><span class="bartrack" style="width:84px;display:inline-block;vertical-align:middle"><i style="width:${pct100(c.pct)}%;background:${c.pct>=100?'var(--danger)':c.pct>=85?'var(--warn)':'var(--ok)'}"></i></span> <b class="tnum" style="font-size:12px;color:${c.pct>=100?'var(--danger)':'var(--fg)'}">${c.pct}%</b></span>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(108px,1.1fr)', render:c=>c.hold?cap('Credit hold','danger'):c.pct>=90?cap('Near limit','warn'):cap('OK','ok')},
  ]});
  root.innerHTML=salesPage({ active:'credit-control', title:'Credit Control', count:data.length+' customers',
    sub:'Live credit exposure across receivables and open orders. Block or warn at order entry when a customer is over limit or has overdue invoices.',
    body:`<div class="sales-body"><div class="so-kpibar">${kpis.map(k=>`<button class="so-kpi ${k.neg?'neg':''} ${k.accent?'accent':''}" disabled><small>${esc(k.label)}</small><b class="tnum">${k.val}</b></button>`).join('')}</div>
      <div class="sales-tablewrap" id="ccTable">${table}</div></div>` });
  wireTable($('#ccTable'),{onRow:(id)=>{ const c=data.find(x=>x.code===id);
    salesModal({icon:'shield',no:c.code,title:c.name,
      metaRows:[['Terms',esc(c.terms)],['Credit limit',money0(c.limit)],['AR balance',money0(c.balance)],['Open orders',c.openSO?money0(c.openSO):'—'],['Available',money0(c.available)],['Status',c.hold?cap('Credit hold','danger'):cap('OK','ok')]],
      lines:`<div class="sectitle">Exposure</div>${indicator({tone:c.pct>=100?'danger':c.pct>=85?'warn':'ok',icon:'shield',label:'Limit utilisation',value:c.pct+'%',sub:`${money0(c.exposure)} of ${money0(c.limit)} used${c.overdue>0?` · ${money0(c.overdue)} overdue`:''}.`,pct:c.pct})}`,
      foot:`${btn('Statement',{icon:'receipt',cls:'soft',attrs:'onclick="toast(\'Statement generated\',\'info\')"'})}${c.hold?btn('Release hold',{icon:'unlock',cls:'primary',attrs:`onclick="closeModal();toast('${c.name} hold released','ok')"`}):btn('Place on hold',{icon:'lock',cls:'soft',attrs:`onclick="closeModal();toast('${c.name} placed on hold','danger')"`})}`});
  }});
};

/* ---------------- SALES COMMISSION ---------------- */
/* COMM_TONE → TONES.commission (defined in data-core.js) */
registerSalesTransactionList({
  route:'sales-commission', active:'sales-commission', title:'Sales Commission', unit:'runs',
  sub:'Commission calculated on collected revenue or gross profit by salesperson and period. Review and approve before payout.',
  rows:()=>DB.commissions, rowId:c=>c.rep+'·'+c.period,
  chips:[['all','All'],['pending','Pending'],['approved','Approved']],
  filterFn:(c,f)=>f==='pending'?c.status!=='Approved':c.status==='Approved',
  kpis:(r)=>[
    {label:'Total commission', val:money0(r.reduce((a,c)=>a+c.commission,0))},
    {label:'Pending review', val:r.filter(c=>c.status!=='Approved').length, accent:true, f:'pending'},
    {label:'This period', val:money0(r.filter(c=>c.period==='Jun 2026').reduce((a,c)=>a+c.commission,0))},
    {label:'Reps', val:new Set(r.map(c=>c.rep)).size},
  ],
  columns:[
    {label:'Salesperson', w:'minmax(150px,1.5fr)', render:c=>custCell(c.rep,c.period)},
    {label:'Period', align:'l', w:'minmax(96px,1fr)', render:c=>esc(c.period)},
    {label:'Basis', align:'l', w:'minmax(110px,1.1fr)', render:c=>`<span style="color:var(--muted)">${esc(c.basis)}</span>`},
    {label:'Eligible sales', align:'r', w:'minmax(110px,1fr)', render:c=>`<span class="tnum">${money0(c.sales)}</span>`},
    {label:'Rate', align:'l', w:'minmax(80px,0.8fr)', render:c=>esc(c.rate)},
    {label:'Commission', align:'r', sortable:true, w:'minmax(104px,1fr)', render:c=>`<b class="tnum">${money(c.commission)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(100px,1fr)', render:c=>cap(c.status,COMM_TONE[c.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(c)=>[
    {id:'view',icon:'ext',label:'View statement',run:()=>openTxn('commission', c)},
    {id:'approve',icon:'check',label:'Approve',run:()=>toast(`${c.rep} ${c.period} commission approved`,'ok')},
    {id:'export',icon:'download',label:'Export',sep:true,run:()=>toast('Commission report exported','ok')},
  ],
  rowAction:{
    label:c=>`${t('common.open')} ${c.rep} ${c.period}`,
    run:c=>openTxn('commission',c),
  },
});
