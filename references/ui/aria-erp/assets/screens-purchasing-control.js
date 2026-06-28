/* ============================================================
   ARIA ERP — Purchasing module: controls
   PO Approvals · Supplier Price Lists / Contracts ·
   Landed Cost · Vendor Performance
   ============================================================ */

/* ---------------- PO APPROVALS (queue) ---------------- */
makePurList({
  route:'po-approvals', active:'po-approvals', title:'Purchase Order Approvals', unit:'in queue',
  sub:'Purchase orders held for sign-off — triggered by value over the approval limit, budget breach, price above last purchase, or an unapproved supplier. Approve, reject or request changes.',
  rows:()=>DB.purchaseOrders.filter(p=>p.status==='Pending Approval'), rowId:p=>p.no,
  chips:[['all','All'],['budget','Over budget'],['highval','High value']],
  filterFn:(p,f)=>f==='budget'?!!p.flag:p.total>=50000,
  kpis:(r)=>[
    {label:'Awaiting approval', val:r.length, accent:true},
    {label:'Value in queue', val:money0(r.reduce((a,p)=>a+p.total,0))},
    {label:'Over budget', val:r.filter(p=>p.flag).length, neg:true, f:'budget'},
    {label:'High value (≥$50k)', val:r.filter(p=>p.total>=50000).length, f:'highval'},
  ],
  columns:[
    {label:'PO Number', w:'minmax(150px,1.3fr)', render:p=>docNoCell(p.no, p.supp)},
    {label:'Buyer', align:'l', w:'minmax(100px,1fr)', render:p=>esc(p.buyer)},
    {label:'Date', align:'l', w:'minmax(96px,0.9fr)', render:p=>esc(p.date)},
    {label:'Trigger', align:'l', w:'minmax(160px,1.7fr)', render:p=>p.flag?`<span style="color:var(--warn)">${ic('warn')} ${esc(p.flag)}</span>`:p.total>=50000?`<span style="color:var(--muted)">Value ≥ $50k tier</span>`:`<span style="color:var(--muted)">Standard approval</span>`},
    {label:'Total', align:'r', sortable:true, w:'minmax(108px,1fr)', render:p=>`<b class="tnum">${money(p.total,p.currency)}</b>${p.currency!=='USD'?`<div style="font-size:11px;color:var(--muted)">${p.currency}</div>`:''}`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(130px,1.2fr)', render:p=>cap(p.status,'warn')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(p)=>[
    {id:'review',icon:'ext',label:'Review PO',run:()=>navigate('po-approval')},
    {id:'approve',icon:'check',label:'Approve',run:()=>toast(`${p.no} approved`,'ok')},
    {id:'changes',icon:'edit',label:'Request changes',run:()=>toast(`Change request sent for ${p.no}`,'info')},
    {id:'reject',icon:'x',label:'Reject',danger:true,sep:true,run:()=>toast(`${p.no} rejected`,'danger')},
  ],
  onOpen:(p)=>{ if(p.no==='PO-26-0291'){ navigate('po-approval'); return; } toast('Opening '+p.no,'info'); },
});

/* ---------------- SUPPLIER PRICE LISTS / CONTRACTS ---------------- */
makePurList({
  route:'supplier-price-lists', title:'Supplier Price Lists', unit:'contracts',
  sub:'Supplier-specific pricing and contract terms applied automatically on purchase orders — contract price, MOQ, currency, lead-time and effective dates.',
  rows:()=>DB.supplierPriceLists, rowId:p=>p.code,
  chips:[['all','All'],['active','Active'],['preferred','Preferred'],['expiring','Expiring']],
  filterFn:(p,f)=>f==='active'?p.status==='Active':f==='preferred'?p.preferred:p.status==='Expiring',
  kpis:(r)=>[
    {label:'Active contracts', val:r.filter(p=>p.status==='Active').length, f:'active'},
    {label:'Preferred', val:r.filter(p=>p.preferred).length, accent:true, f:'preferred'},
    {label:'Expiring', val:r.filter(p=>p.status==='Expiring').length, neg:true, f:'expiring'},
    {label:'Suppliers', val:new Set(r.map(p=>p.supplier)).size},
  ],
  newBtn:{label:'New price list', onClick:()=>toast('New supplier price list / contract','info')},
  columns:[
    {label:'Code', w:'minmax(130px,1.1fr)', render:p=>`<b class="docnum">${esc(p.code)}</b>`},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:p=>suppCell(p.supplier)},
    {label:'Scope', align:'l', w:'minmax(160px,1.8fr)', render:p=>`<span class="li-subj">${esc(p.scope)}</span>`},
    {label:'MOQ', align:'r', w:'minmax(64px,0.6fr)', render:p=>num(p.moq)},
    {label:'Lead', align:'r', w:'minmax(56px,0.5fr)', render:p=>`${p.leadTime}d`},
    {label:'Effective', align:'l', w:'minmax(100px,1fr)', render:p=>`<span style="color:var(--muted)">${esc(p.effective)}</span>`},
    {label:'Expiry', align:'l', w:'minmax(100px,1fr)', render:p=>`<span style="color:${p.status==='Expiring'?'var(--warn)':'var(--muted)'}">${esc(p.expiry)}</span>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:p=>(p.preferred?cap('Preferred','accent')+' ':'')+cap(p.status,SPL_TONE[p.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(p)=>[
    {id:'view',icon:'ext',label:'Open contract',run:()=>toast(`Opening ${p.code}`,'info')},
    {id:'renew',icon:'refresh',label:'Renew',run:()=>toast(`${p.code} renewal drafted`,'info')},
    {id:'pref',icon:'star',label:p.preferred?'Unset preferred':'Set preferred',run:()=>toast(`${p.supplier} ${p.preferred?'unset':'set'} preferred`,'ok')},
    {id:'end',icon:'x',label:'End contract',danger:true,sep:true,run:()=>toast(`${p.code} ended`,'danger')},
  ],
  onOpen:(p)=>toast(`Opening ${p.code}`,'info'),
});

/* ---------------- LANDED COST ---------------- */
makePurList({
  route:'landed-cost', title:'Landed Cost', unit:'records',
  sub:'Allocate freight, insurance, duty and handling onto received goods so inventory is valued at true landed cost. Allocate by quantity, value, weight or volume.',
  rows:()=>DB.landedCosts, rowId:l=>l.no,
  chips:[['all','All'],['draft','Draft'],['allocated','Allocated']],
  filterFn:(l,f)=>f==='draft'?l.status==='Draft':l.status==='Allocated',
  kpis:(r)=>[
    {label:'Records', val:r.length},
    {label:'Goods value', val:money0(r.reduce((a,l)=>a+l.goods,0))},
    {label:'Added cost', val:money0(r.reduce((a,l)=>a+l.freight+l.duty+l.other,0)), accent:true},
    {label:'Draft', val:r.filter(l=>l.status==='Draft').length, f:'draft'},
  ],
  newBtn:{label:'New landed cost', onClick:()=>toast('New landed cost — link to a PO or GRN','info')},
  columns:[
    {label:'Record', w:'minmax(130px,1.1fr)', render:l=>`<b class="docnum linknum">${esc(l.no)}</b>`},
    {label:'Against', align:'l', w:'minmax(120px,1.1fr)', render:l=>`<span class="mono" style="font-size:12px">${esc(l.ref)}</span>`},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:l=>suppCell(l.supplier)},
    {label:'Basis', align:'l', w:'minmax(100px,1fr)', render:l=>`<span style="color:var(--muted)">${esc(l.basis)}</span>`},
    {label:'Goods', align:'r', w:'minmax(100px,1fr)', render:l=>`<span class="tnum">${money0(l.goods)}</span>`},
    {label:'Added cost', align:'r', sortable:true, w:'minmax(100px,1fr)', render:l=>`<b class="tnum">${money0(l.freight+l.duty+l.other)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:l=>cap(l.status, l.status==='Allocated'?'ok':'neutral')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(l)=>[
    {id:'view',icon:'ext',label:'Open record',run:()=>openLanded(l)},
    {id:'alloc',icon:'flow',label:'Allocate to items',run:()=>toast(`${l.no} cost allocated to inventory`,'ok')},
  ],
  onOpen:(l)=>openLanded(l),
});
function openLanded(l){
  const total=l.goods+l.freight+l.duty+l.other, add=l.freight+l.duty+l.other;
  appModal({ icon:'truck', title:`Landed cost — ${l.no}`, width:'min(560px,94vw)',
    body:`<div class="docmeta" style="margin-top:0;margin-bottom:14px">
        <div class="dm"><small>Against</small><b>${esc(l.ref)}</b></div>
        <div class="dm"><small>Supplier</small><b>${esc(l.supplier)}</b></div>
        <div class="dm"><small>Allocation basis</small><b>${esc(l.basis)}</b></div>
      </div>
      <div class="sumcard">
        <div class="sumrow"><span class="sk2">Goods value</span><span class="sv tnum">${money(l.goods)}</span></div>
        <div class="sumrow"><span class="sk2">Freight</span><span class="sv tnum">${money(l.freight)}</span></div>
        <div class="sumrow"><span class="sk2">Import duty</span><span class="sv tnum">${money(l.duty)}</span></div>
        <div class="sumrow"><span class="sk2">Handling & other</span><span class="sv tnum">${money(l.other)}</span></div>
        <div class="sumrow"><span class="sk2">Added landed cost</span><span class="sv tnum" style="color:var(--accent)">${money(add)}</span></div>
        <div class="sumrow total"><span class="sk2">Total landed value</span><span class="sv tnum">${money(total)}</span></div>
      </div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:10px">Added cost of <b style="color:var(--fg)">${money(add)}</b> (${Math.round(add/l.goods*100)}% uplift) allocated ${l.basis.toLowerCase()} across received lines.</div>`,
    actions: btn('Close',{cls:'soft',attrs:'onclick="closeModal()"'}) + btn('Allocate to inventory',{icon:'check',cls:'primary',attrs:`onclick="closeModal();toast('${l.no} allocated · item costs updated','ok')"`}) });
}

/* ---------------- VENDOR PERFORMANCE ---------------- */
SCREENS['vendor-performance'] = function(root){
  const data=DB.vendorPerf.slice().sort((a,b)=>b.rating-a.rating);
  const avgOnTime=Math.round(data.reduce((a,v)=>a+v.onTime,0)/data.length);
  const avgLead=Math.round(data.reduce((a,v)=>a+v.leadTime,0)/data.length);
  const totSpend=data.reduce((a,v)=>a+v.spend,0);
  const watch=data.filter(v=>v.rating<3.8).length;

  const kpis=[
    {label:'Suppliers scored', val:data.length},
    {label:'Avg on-time', val:avgOnTime+'%'},
    {label:'Avg lead time', val:avgLead+'d'},
    {label:'On watch / review', val:watch, neg:watch>0},
  ];
  const kpibar=`<div class="so-kpibar">`+kpis.map(k=>`<button class="so-kpi ${k.neg?'neg':''}" disabled><small>${esc(k.label)}</small><b class="tnum">${k.val}</b></button>`).join('')+`</div>`;

  function ratingTag(r){ return r>=4.5?cap('Preferred','ok'):r>=4?cap('Approved','accent'):r>=3.6?cap('Watch','warn'):cap('Review','danger'); }
  function bar(v,scale,good){ // good: 'high' means higher is better
    const pct=Math.max(4,Math.min(100,Math.round(v/scale*100)));
    const tone = good==='high' ? (v>=90?'ok':v>=80?'warn':'danger') : (v<=1?'ok':v<=3?'warn':'danger');
    const clr = tone==='ok'?'var(--ok)':tone==='warn'?'var(--warn)':'var(--danger)';
    return `<span class="minibar" style="width:64px"><i style="width:${pct}%;background:${clr}"></i></span>`;
  }
  const cards=data.map(v=>`<div class="wcard vp-card">
      <div class="vp-h"><div class="partner"><span class="pav">${esc(v.supplier.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase())}</span><div><b>${esc(v.supplier)}</b><small>${esc(v.code)} · ${money0(v.spend)} spend</small></div></div><div class="vp-rate"><b class="tnum">${v.rating.toFixed(1)}</b>${ratingTag(v.rating)}</div></div>
      <div class="vp-metrics">
        <div class="vp-m"><span>On-time delivery</span><div class="vp-mr">${bar(v.onTime,100,'high')}<b class="tnum">${v.onTime}%</b></div></div>
        <div class="vp-m"><span>Avg lead time</span><div class="vp-mr"><b class="tnum">${v.leadTime} days</b></div></div>
        <div class="vp-m"><span>Quality reject</span><div class="vp-mr">${bar(v.qualityReject,6,'low')}<b class="tnum">${v.qualityReject}%</b></div></div>
        <div class="vp-m"><span>Return rate</span><div class="vp-mr">${bar(v.returnRate,6,'low')}<b class="tnum">${v.returnRate}%</b></div></div>
        <div class="vp-m"><span>Invoice mismatch</span><div class="vp-mr">${bar(v.mismatch,6,'low')}<b class="tnum">${v.mismatch}%</b></div></div>
        <div class="vp-m"><span>Price variance</span><div class="vp-mr"><b class="tnum" style="color:${v.priceVar>2?'var(--warn)':'var(--ok)'}">${v.priceVar>0?'+':''}${v.priceVar}%</b></div></div>
      </div>
    </div>`).join('');

  root.innerHTML = purPage({
    active:'vendor-performance', title:'Vendor Performance',
    sub:'Supplier scorecards across on-time delivery, lead-time, quality, returns and invoice match — the inputs behind approved-supplier status and sourcing decisions.',
    action: btn('Performance report',{icon:'chart',cls:'soft',attrs:'onclick="navigate(\'report-pur-vendor\')"'}),
    body:`<div class="sales-body">${kpibar}<div class="vp-grid">${cards}</div></div>`
  });
};
