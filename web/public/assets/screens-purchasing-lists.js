/* ============================================================
   ARIA ERP — Purchasing module: transaction & master-data lists
   Suppliers · Requisitions · RFQs · Supplier Quotations ·
   Purchase Orders · Goods Receipts · Supplier Invoices ·
   Purchase Returns · Supplier Credit / Debit Notes
   (built on the shared makePurList factory)
   ============================================================ */

/* ---- shared quick-view detail (records without a bespoke doc screen) ---- */
let PUR_TXN_OPEN = null;
function openPurTxn(kind, rec){ PUR_TXN_OPEN = { kind, rec }; navigate('pur-txn-view'); }

function buildPurTxn(kind, r){
  const C={ no:r.no, icon:'receipt', title:'Document', active:'', crumbLabel:'', crumbRoute:'',
    subtitle:'', status:r.status, tone:'neutral', meta:[], main:'', summary:'', footer:'' };

  if(kind==='rfq'){
    Object.assign(C,{ icon:'comment', title:'Request for Quotation', active:'rfqs', crumbLabel:'RFQs', crumbRoute:'rfqs',
      subtitle:`${esc(r.subject)} · ${r.responded} of ${r.suppliers} responded`, tone:RFQ_TONE[r.status],
      meta:[['Subject',`<b>${esc(r.subject)}</b>`],['Date',`<b>${esc(r.date)}</b>`],['Suppliers invited',`<b>${r.suppliers}</b>`],['Responded',`<b>${r.responded}</b>`],['Response by',`<b>${esc(r.due)}</b>`]],
      main: txnDetails([['From requisition',r.pr?esc(r.pr):'—'],['Suppliers invited',String(r.suppliers)],['Responded',`${r.responded} / ${r.suppliers}`],['Response deadline',esc(r.due)]]) +
        txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Procurement'},{kind:'add',when:r.date,what:`RFQ issued to ${r.suppliers} suppliers`,who:'Procurement'}]),
      summary: sumCard(null,[['Invited',String(r.suppliers)],['Responded',String(r.responded)]]),
      footer: btn('View quotations',{icon:'receipt',cls:'soft',attrs:`onclick="navigate('supplier-quotations')"`}) + (r.no==='RFQ-26-0061'||r.no==='RFQ-26-0060'?btn('Compare quotes',{icon:'flow',cls:'primary',sm:false,attrs:`onclick="openQuoteCompare('${r.no}')"`}):'') });
  }
  else if(kind==='squote'){
    Object.assign(C,{ icon:'receipt', title:'Supplier Quotation', active:'supplier-quotations', crumbLabel:'Quotations', crumbRoute:'supplier-quotations',
      subtitle:`${esc(r.supplier)} · ${esc(r.item)} · against ${esc(r.rfq)}`, tone:SQ_TONE[r.status],
      meta:[['Supplier',suppCellInline(r.supplier)],['RFQ',`<b>${esc(r.rfq)}</b>`],['Lead time',`<b>${r.leadTime} days</b>`],['Valid until',`<b>${esc(r.validity)}</b>`],['Terms',`<b>${esc(r.terms)}</b>`]],
      main: txnDetails([['Item',esc(r.item)],['Quantity',`${num(r.qty)} ea`],['Unit price',money(r.price,r.currency)],['Lead time',`${r.leadTime} days`],['Warranty',esc(r.warranty)],['Validity',esc(r.validity)]]) +
        txnActivity([{kind:'current',when:r.validity,what:`Status — <b>${esc(r.status)}</b>`,who:'Procurement'},{kind:'add',when:'on response',what:`Quotation received from ${esc(r.supplier)}`,who:'System'}]),
      summary: sumCard(null,[['Unit price',money(r.price,r.currency)],['Quantity',num(r.qty)],['Total',money(r.total,r.currency),'total']]),
      footer: btn('Reject',{icon:'x',cls:'soft',attrs:`onclick="toast('${r.no} rejected','danger')"`}) + (r.status!=='Converted'?btn('Select & convert to PO',{icon:'check',cls:'primary',sm:false,attrs:`onclick="navigate('new-purchase-order')"`}):'') });
  }
  else if(kind==='grn'){
    const pct=r.recvPct;
    Object.assign(C,{ icon:'receive', title:'Goods Receipt', active:'goods-receipts', crumbLabel:'Goods Receipts', crumbRoute:'goods-receipts',
      subtitle:`${esc(r.supplier)} · against ${esc(r.po)} · ${esc(r.warehouse)}`, tone:GRN_TONE[r.status],
      meta:[['Supplier',suppCellInline(r.supplier)],['PO reference',`<b>${esc(r.po)}</b>`],['Receipt date',`<b>${esc(r.date)}</b>`],['Warehouse',`<b>${esc(r.warehouse)}</b>`],['QC',`<b>${esc(r.qc)}</b>`]],
      main: txnDetails([['Lines',String(r.lines)],['Received',`${pct}%`],['QC status',esc(r.qc)]]) +
        txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Warehouse'},{kind:'add',when:r.date,what:`Goods received against ${esc(r.po)}`,who:'M. Silva'}]),
      summary: sumCard(null,[['Lines',String(r.lines)],['Received',pct+'%']]) +
        `<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:r.po,label:'Purchase order',meta:r.supplier,status:'Approved'}])}</div>`,
      footer: btn('Print GRN',{icon:'print',cls:'soft'}) + btn('Match to invoice',{icon:'receipt',cls:'primary',sm:false,attrs:`onclick="navigate('supplier-invoices')"`}) });
  }
  else if(kind==='sinvoice'){
    const bal = ['Paid'].includes(r.status)?0:r.total;
    Object.assign(C,{ icon:'receipt', title:'Supplier Invoice', active:'supplier-invoices', crumbLabel:'Supplier Invoices', crumbRoute:'supplier-invoices',
      subtitle:`${esc(r.supplier)} · ${r.po?'PO '+esc(r.po):''} · due ${esc(r.due)}`, tone:SINV_TONE[r.status],
      meta:[['Supplier',suppCellInline(r.supplier)],['PO',`<b>${esc(r.po||'—')}</b>`],['GRN',`<b>${esc(r.grn||'—')}</b>`],['Invoice date',`<b>${esc(r.date)}</b>`],['Due',`<b>${esc(r.due)}</b>`]],
      main: txnDetails([['Match status',esc(r.match)],['PO reference',esc(r.po||'—')],['GRN reference',esc(r.grn||'—')],['Currency',esc(r.currency)]]) +
        txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'A. Costa'},{kind:'add',when:r.date,what:`Supplier invoice captured (OCR)`,who:'A. Costa'}]),
      summary: sumCard(null,[['Invoice total',money(r.total,r.currency)],['Balance',money(bal,r.currency),'total']]) +
        `<div class="sumcard"><div class="sectitle" style="margin-top:0">Match status</div>${indicator({tone:r.match==='Matched'?'ok':r.match==='Mismatch'?'danger':'warn',icon:'flow',label:r.match,value:r.po?'3-way':'2-way',sub:r.grn?`Matched against ${esc(r.grn)}.`:'No goods receipt found for this invoice.'})}</div>`,
      footer: btn('Download',{icon:'filepdf',cls:'soft'}) + (['Pending Matching','Mismatch'].includes(r.status)?btn('Run 3-way match',{icon:'flow',cls:'primary',sm:false,attrs:`onclick="navigate('supplier-invoice')"`}):btn('Schedule payment',{icon:'coins',cls:'primary',sm:false,attrs:`onclick="navigate('payment-voucher')"`})) });
  }
  else if(kind==='preturn'){
    Object.assign(C,{ icon:'refresh', title:'Purchase Return', active:'purchase-returns', crumbLabel:'Purchase Returns', crumbRoute:'purchase-returns',
      subtitle:`${esc(r.supplier)} · against ${esc(r.grn)} · ${esc(r.reason)}`, tone:PRET_TONE[r.status],
      meta:[['Supplier',suppCellInline(r.supplier)],['Against GRN',`<b>${esc(r.grn)}</b>`],['Date',`<b>${esc(r.date)}</b>`],['Reason',`<b>${esc(r.reason)}</b>`]],
      main: txnDetails([['Reason',esc(r.reason)],['Return qty',num(r.qty)],['Return value',money(r.value)]]) +
        txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Warehouse'},{kind:'add',when:r.date,what:`Return raised against ${esc(r.grn)}`,who:'M. Silva'}]),
      summary: sumCard(null,[['Return qty',num(r.qty)],['Return value',money(r.value),'total']]) +
        `<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:r.grn,label:'Goods receipt',meta:r.supplier,status:'Posted'}])}</div>`,
      footer: btn('Reject',{icon:'x',cls:'soft',attrs:`onclick="toast('${r.no} rejected','danger')"`}) + btn('Issue credit note',{icon:'coins',cls:'primary',sm:false,attrs:`onclick="navigate('supplier-credit-notes')"`}) });
  }
  else if(kind==='screditnote'){
    Object.assign(C,{ icon:'coins', title:'Supplier Credit Note', active:'supplier-credit-notes', crumbLabel:'Credit Notes', crumbRoute:'supplier-credit-notes',
      subtitle:`${esc(r.supplier)} · against ${esc(r.ref)} · ${esc(r.reason)}`, tone:SCN_TONE[r.status],
      meta:[['Supplier',suppCellInline(r.supplier)],['Against',`<b>${esc(r.ref)}</b>`],['Date',`<b>${esc(r.date)}</b>`],['Reason',`<b>${esc(r.reason)}</b>`]],
      main: txnDetails([['Reason',esc(r.reason)],['Reference',esc(r.ref)],['Amount',money(r.amount)]]) +
        txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Finance'},{kind:'add',when:r.date,what:`Credit note raised against ${esc(r.ref)}`,who:'A. Costa'}]),
      summary: sumCard(null,[['Credit amount',money(r.amount),'total']]),
      footer: btn('Download',{icon:'filepdf',cls:'soft'}) + (r.status==='Draft'?btn('Apply to AP',{icon:'check',cls:'primary',sm:false,attrs:`onclick="toast('${r.no} applied to supplier balance','ok')"`}):'') });
  }
  else if(kind==='sdebitnote'){
    Object.assign(C,{ icon:'coins', title:'Supplier Debit Note', active:'supplier-debit-notes', crumbLabel:'Debit Notes', crumbRoute:'supplier-debit-notes',
      subtitle:`${esc(r.supplier)} · ${esc(r.reason)}`, tone:SDN_TONE[r.status],
      meta:[['Supplier',suppCellInline(r.supplier)],['Against',`<b>${esc(r.ref)}</b>`],['Date',`<b>${esc(r.date)}</b>`],['Reason',`<b>${esc(r.reason)}</b>`]],
      main: txnDetails([['Reason',esc(r.reason)],['Reference',esc(r.ref)],['Amount',money(r.amount)]]) +
        txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Finance'},{kind:'add',when:r.date,what:`Debit note raised against ${esc(r.ref)}`,who:'A. Costa'}]),
      summary: sumCard(null,[['Claim amount',money(r.amount),'total']]),
      footer: btn('Download',{icon:'filepdf',cls:'soft'}) + (r.status==='Draft'?btn('Post to finance',{icon:'check',cls:'primary',sm:false,attrs:`onclick="toast('${r.no} posted','ok')"`}):'') });
  }
  return C;
}
function suppCellInline(name){ return `<div class="partner"><span class="pav">${esc((String(name).trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('')).toUpperCase())}</span><b>${esc(name)}</b></div>`; }

SCREENS['pur-txn-view'] = function(root){
  if(!PUR_TXN_OPEN){ navigate('purchasing-home'); return; }
  const C = buildPurTxn(PUR_TXN_OPEN.kind, PUR_TXN_OPEN.rec);
  root.innerHTML = `<div class="content full"><section class="master" data-screen-label="${esc(C.title)} ${esc(C.no)}">
    <div class="scrollarea">
      <div class="pagehead">${crumbs([DB.company.name,{label:'Purchasing',route:'purchasing-home'},{label:C.crumbLabel,route:C.crumbRoute},{cur:C.no}])}${purNav(C.active)}</div>
      <div class="docwrap"><div class="docpage" style="padding-top:4px">
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic(C.icon)}${esc(C.title)} <span class="dnum">${esc(C.no)}</span></div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">${C.subtitle}</div></div>
            <div class="dactions">${cap(C.status,C.tone)}${btn('Print',{icon:'print',cls:'soft'})}</div>
          </div>
          <div class="docmeta">${C.meta.map(([k,v])=>`<div class="dm"><small>${esc(k)}</small>${v}</div>`).join('')}</div>
        </div>
        <div class="doclayout">
          <div class="docmain">${C.main}</div>
          <aside class="summary">${C.summary}</aside>
        </div>
        <div class="responsive-actionbar" style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
          <div class="grow"></div>${C.footer}
        </div>
      </div></div>
    </div>
  </section></div>`;
};

/* ---------------- SUPPLIERS (master data) ---------------- */
makePurList({
  route:'suppliers', title:'Suppliers', unit:'suppliers',
  prepare:prepareCanonicalPurchasingData,
  sub:'Vendor master used across RFQ, quotation, purchase order, receipt, invoice and payment. Maintain terms, currency, lead-time, category and approved-supplier status.',
  rows:()=>DB.suppliers, rowId:s=>s.code,
  chips:[['all','All'],['approved','Approved'],['review','Under review'],['active','Active']],
  filterFn:(s,f)=>f==='approved'?s.approved:f==='review'?s.status==='Review':s.status==='Active',
  kpis:(r)=>[
    {label:'Active suppliers', val:r.filter(s=>s.status==='Active').length, f:'active'},
    {label:'Approved', val:r.filter(s=>s.approved).length, f:'approved'},
    {label:'Under review', val:r.filter(s=>s.status==='Review').length, accent:true, f:'review'},
    {label:'Total payable', val:money0(r.reduce((a,s)=>a+s.balance,0))},
  ],
  columns:[
    {label:'Code', w:'minmax(88px,0.8fr)', render:s=>`<b class="docnum">${esc(s.code)}</b>`},
    {label:'Supplier', align:'l', w:'minmax(170px,1.7fr)', render:s=>suppCell(s.name)},
    {label:'Category', align:'l', w:'minmax(140px,1.4fr)', render:s=>`<span class="li-subj">${esc(s.category)}</span>`},
    {label:'Country', align:'l', w:'minmax(90px,0.9fr)', render:s=>`<span style="color:var(--muted)">${esc(s.country)}</span>`},
    {label:'Terms', align:'l', w:'minmax(80px,0.8fr)', render:s=>`${esc(s.terms)} · ${esc(s.currency)}`},
    {label:'Lead', align:'r', w:'minmax(60px,0.6fr)', render:s=>s.leadTime==null?'—':`${s.leadTime}d`},
    {label:'Rating', align:'r', sortable:true, w:'minmax(70px,0.7fr)', render:s=>s.rating==null?'—':`<b class="tnum">${s.rating.toFixed(1)}</b>`},
    {label:'Balance', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:s=>`<b class="tnum">${money0(s.balance)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(96px,0.9fr)', render:s=>s.approved==null?cap(s.status,'ok'):s.approved?cap('Approved','ok'):cap('Review','warn')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(s)=>[
    {id:'view',icon:'ext',label:'Open supplier',run:()=>toast(`Opening ${s.name}`,'info')},
    {id:'po',icon:'cart',label:'New purchase order',run:()=>navigate('new-purchase-order')},
    {id:'perf',icon:'shield',label:'View performance',run:()=>navigate('vendor-performance')},
  ],
  onOpen:(s)=>toast(`Opening ${s.name}`,'info'),
});

/* ---------------- PURCHASE REQUISITIONS ---------------- */
makePurList({
  route:'purchase-requisitions', title:'Purchase Requisitions', unit:'requisitions',
  prepare:prepareCanonicalPurchasingData,
  sub:'Internal purchase requests from warehouse, production, projects and admin. Approve, then convert directly to a purchase order.',
  rows:()=>DB.purchaseReqs, rowId:r=>r.no,
  chips:[['all','All'],['submitted','Submitted'],['approved','Approved'],['converted','Converted'],['rejected','Rejected']],
  filterFn:(r,f)=>r.status.toLowerCase()===f,
  kpis:(r)=>[
    {label:'Submitted', val:r.filter(x=>x.status==='Submitted').length, accent:true, f:'submitted'},
    {label:'Approved', val:r.filter(x=>x.status==='Approved').length, f:'approved'},
    {label:'Est. value', val:money0(r.filter(x=>x.status!=='Rejected').reduce((a,x)=>a+x.value,0))},
    {label:'Converted', val:r.filter(x=>x.status==='Converted').length, f:'converted'},
  ],
  newBtn:{label:'New requisition', onClick:()=>newRequisitionModal()},
  columns:[
    {label:'Requisition', w:'minmax(140px,1.3fr)', render:r=>docNoCell(r.no, r.date)},
    {label:'Requested by', align:'l', w:'minmax(120px,1.1fr)', render:r=>esc(r.requestedBy)},
    {label:'Department', align:'l', w:'minmax(150px,1.6fr)', render:r=>`<span class="li-subj">${esc(r.dept)}</span>`},
    {label:'Needed', align:'l', w:'minmax(96px,0.9fr)', render:r=>`<span style="color:var(--muted)">${esc(r.need)}</span>`},
    {label:'Lines', align:'r', w:'minmax(54px,0.5fr)', render:r=>r.lines},
    {label:'Est. value', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:r=>`<b class="tnum">${money0(r.value)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(120px,1.1fr)', render:r=>cap(r.status,PR_TONE[r.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(r)=>[
    {id:'view',icon:'ext',label:'View requisition',run:()=>openReq(r)},
    ...(r.rawStatus==='submitted'?[
      {id:'approve',icon:'check',label:'Approve',run:()=>approveRequisition(r,()=>navigate('purchase-requisitions'))},
      {id:'reject',icon:'x',label:'Reject',danger:true,sep:true,run:()=>rejectRequisitionModal(r,()=>navigate('purchase-requisitions'))},
    ]:[]),
    ...(r.status==='Approved'?[
      {id:'po',icon:'cart',label:'Convert to PO',sep:true,run:()=>navigate('new-purchase-order',{requisitionId:r.id})},
    ]:[]),
  ],
  onOpen:(r)=>openReq(r),
});
function openReq(r){ navigate('purchase-request',{requisitionId:r.id}); }

function nextReqNo(reqs){
  let max=0;
  (reqs||[]).forEach(r=>{ const m=/(\d+)\s*$/.exec(r.no||''); if(m&&+m[1]>max) max=+m[1]; });
  return 'PR-'+new Date().getFullYear()+'-'+String(max+1).padStart(4,'0');
}

function newRequisitionModal(){
  const reqNo=nextReqNo(DB.purchaseReqs);
  const state={ lines:[] /* {productId,sku,name,uom,qty,estimatedUnitCost} */ };
  function lineRows(){
    if(!state.lines.length) return `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:18px">No lines yet — add an item below.</td></tr>`;
    return state.lines.map((l,i)=>`<tr data-i="${i}">
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.sku)}</small></td>
      <td><input class="lineinput rqQty" type="number" min="1" value="${l.qty}" style="width:72px"></td>
      <td><input class="lineinput rqCost" type="number" min="0" step="0.01" value="${l.estimatedUnitCost}" style="width:88px"></td>
      <td class="tnum"><b>${money(l.qty*l.estimatedUnitCost)}</b></td>
      <td style="text-align:center"><button class="iconbtn rqDel" data-tip="Remove" style="width:28px;height:28px">${ic('trash')}</button></td></tr>`).join('');
  }
  function totalValue(){ return state.lines.reduce((a,l)=>a+l.qty*l.estimatedUnitCost,0); }
  function linesBlock(){
    return `<div class="panel" style="margin-top:14px">
      <div class="panel-h"><h3>Lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)" id="rqLineCount">${state.lines.length} line${state.lines.length===1?'':'s'}</span></div>
      <div class="panel-body" style="padding-top:10px">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">
          <div class="fld" style="flex:1;min-width:220px"><span>Item</span>
            <select id="rqPick">${DB.items.map(it=>`<option value="${it.sku}">${esc(it.sku)} · ${esc(it.name)} — ${money(it.cost)}/${esc(it.uom)}</option>`).join('')}</select></div>
          <div class="fld" style="width:96px"><span>Qty</span><input type="number" id="rqAddQty" min="1" value="1"></div>
          ${btn('Add line',{icon:'plus',cls:'soft',attrs:'id="rqAdd"'})}
        </div>
        <table class="lines"><thead><tr><th class="l">Item</th><th>Qty</th><th>Est. unit cost</th><th>Amount</th><th></th></tr></thead>
          <tbody id="rqLines">${lineRows()}</tbody></table>
        <div class="sumrow total" style="margin-top:10px"><span class="sk2">Estimated total</span><span class="sv tnum" id="rqTotal">${money(totalValue())}</span></div>
      </div>
    </div>`;
  }
  appModal({
    icon:'plus',
    title:'New requisition',
    width:640,
    body:`<div class="set-grid">
      <div class="fld"><span>Requisition no.</span><input value="${esc(reqNo)}" readonly><span class="locked">${ic('lock')} System-numbered</span></div>
      <div class="fld"><span>Needed by <span class="req">*</span></span><input type="date" id="rqNeed" value="${new Date(Date.now()+7*86400000).toISOString().slice(0,10)}"></div>
      <div class="fld"><span>Requested by <span class="req">*</span></span><input id="rqRequester" placeholder="e.g. M. Okeke"></div>
      <div class="fld"><span>Department <span class="req">*</span></span><input id="rqDept" placeholder="e.g. Production Planning"></div>
      <div class="fld"><span>Priority</span><select id="rqPriority"><option value="Stock" selected>Stock</option><option value="Urgent">Urgent</option><option value="Project">Project</option></select></div>
      <div class="fld" style="grid-column:1/-1"><span>Justification (optional)</span><textarea id="rqJustification" placeholder="Why this is needed"></textarea></div>
    </div>
    <div id="rqLinesBlock">${linesBlock()}</div>`,
    actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Create requisition',{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
  });
  function wireLines(){
    $('#rqAdd').addEventListener('click',()=>{
      const sku=$('#rqPick').value; const qty=Math.max(1,+$('#rqAddQty').value||1);
      const it=DB.items.find(x=>x.sku===sku); if(!it) return;
      const ex=state.lines.find(l=>l.productId===it.id);
      if(ex) ex.qty+=qty; else state.lines.push({productId:it.id,sku:it.sku,name:it.name,uom:it.uom,qty,estimatedUnitCost:it.cost});
      refreshLines();
    });
    $$('#rqLines tr[data-i]').forEach(tr=>{
      const i=+tr.dataset.i, l=state.lines[i];
      const q=tr.querySelector('.rqQty'), c=tr.querySelector('.rqCost');
      const upd=()=>{ l.qty=Math.max(1,+q.value||1); l.estimatedUnitCost=Math.max(0,+c.value||0);
        tr.querySelector('td.tnum b').textContent=money(l.qty*l.estimatedUnitCost);
        $('#rqTotal').textContent=money(totalValue()); };
      [q,c].forEach(el=>el.addEventListener('input',upd));
      tr.querySelector('.rqDel').addEventListener('click',()=>{ state.lines.splice(i,1); refreshLines(); });
    });
  }
  function refreshLines(){
    $('#rqLinesBlock').innerHTML=linesBlock();
    wireLines();
  }
  wireLines();

  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const requestedByName=$('#rqRequester').value.trim();
    if(!requireField(requestedByName,'Requested by is required','#rqRequester')) return;
    const department=$('#rqDept').value.trim();
    if(!requireField(department,'Department is required','#rqDept')) return;
    const neededByDate=$('#rqNeed').value;
    if(!requireField(neededByDate,'Needed-by date is required','#rqNeed')) return;
    if(!state.lines.length){ toast('Add at least one line','danger'); return; }
    const payload={
      reqNo, requestedByName, department, neededByDate,
      priority:$('#rqPriority').value,
      justification:$('#rqJustification').value.trim()||null,
      lines:state.lines.map(l=>({productId:l.productId,qty:l.qty,estimatedUnitCost:l.estimatedUnitCost})),
    };
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.create('purchasing/purchase-requisitions',payload);
      closeModal();
      toast(`Requisition ${reqNo} submitted`,'ok');
      navigate('purchase-requisitions');
    }catch(error){
      saveBtn.disabled=false;
      toast((error&&error.message)||'Requisition could not be created','danger');
    }
  });
}

/* ---------------- RFQs ---------------- */
function sourcingCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{rfqs:'Requests for Quotation',rfqUnit:'RFQs',rfqSub:'Invite approved suppliers, collect comparable responses and award the winning quotation.',quotes:'Supplier Quotations',quoteUnit:'quotations',quoteSub:'Compare supplier price, lead time and terms, then create a traceable purchase order.',all:'All',draft:'Draft',sent:'Sent',responded:'Responded',awarded:'Awarded',closed:'Closed',received:'Received',rejected:'Rejected',converted:'Converted',open:'Open RFQs',awaiting:'Awaiting response',fully:'Fully responded',newRfq:'New RFQ',newQuote:'Record quotation',rfq:'RFQ',subject:'Subject',fromPr:'From PR',suppliers:'Suppliers',responseBy:'Response by',status:'Status',quote:'Quote',supplier:'Supplier',item:'Item',unitPrice:'Unit price',lead:'Lead',validUntil:'Valid until',total:'Total',view:'View details',compare:'Compare quotations',issue:'Issue RFQ',close:'Close RFQ',record:'Record supplier quotation',convert:'Select & convert to PO',date:'Date',requisition:'Approved requisition',adHoc:'Ad-hoc demand',due:'Response deadline',invited:'Invited suppliers',lines:'Requested lines',qty:'Qty',create:'Create RFQ',cancel:'Cancel',quoteDate:'Quote date',currency:'Currency',leadDays:'Lead time (days)',terms:'Payment terms',warranty:'Warranty',taxCode:'Tax code',saveQuote:'Save quotation',noQuotes:'No quotations are available for comparison.',best:'Best total',select:'Select',created:'RFQ created',issued:'RFQ issued',closedMsg:'RFQ closed',quoteSaved:'Supplier quotation saved',poCreated:'Purchase order created',required:'Complete all required fields.',chooseSupplier:'Choose at least one supplier.',chooseLine:'Choose an approved requisition or enter an item quantity.',noEligible:'No issued RFQ is awaiting a supplier response.',responses:'responses'},
    ms:{rfqs:'Permintaan Sebut Harga',rfqUnit:'RFQ',rfqSub:'Jemput pembekal diluluskan, kumpul respons setara dan pilih sebut harga terbaik.',quotes:'Sebut Harga Pembekal',quoteUnit:'sebut harga',quoteSub:'Banding harga, tempoh dan syarat pembekal, kemudian cipta pesanan belian yang boleh dijejak.',all:'Semua',draft:'Draf',sent:'Dihantar',responded:'Dijawab',awarded:'Dipilih',closed:'Ditutup',received:'Diterima',rejected:'Ditolak',converted:'Ditukar',open:'RFQ terbuka',awaiting:'Menunggu respons',fully:'Respons lengkap',newRfq:'RFQ baharu',newQuote:'Rekod sebut harga',rfq:'RFQ',subject:'Subjek',fromPr:'Daripada PR',suppliers:'Pembekal',responseBy:'Tarikh respons',status:'Status',quote:'Sebut harga',supplier:'Pembekal',item:'Item',unitPrice:'Harga unit',lead:'Tempoh',validUntil:'Sah hingga',total:'Jumlah',view:'Lihat butiran',compare:'Banding sebut harga',issue:'Hantar RFQ',close:'Tutup RFQ',record:'Rekod sebut harga pembekal',convert:'Pilih & tukar ke PO',date:'Tarikh',requisition:'Rekuisisi diluluskan',adHoc:'Permintaan ad hoc',due:'Tarikh akhir respons',invited:'Pembekal dijemput',lines:'Baris diminta',qty:'Kuantiti',create:'Cipta RFQ',cancel:'Batal',quoteDate:'Tarikh sebut harga',currency:'Mata wang',leadDays:'Tempoh (hari)',terms:'Syarat bayaran',warranty:'Waranti',taxCode:'Kod cukai',saveQuote:'Simpan sebut harga',noQuotes:'Tiada sebut harga untuk dibandingkan.',best:'Jumlah terbaik',select:'Pilih',created:'RFQ dicipta',issued:'RFQ dihantar',closedMsg:'RFQ ditutup',quoteSaved:'Sebut harga disimpan',poCreated:'Pesanan belian dicipta',required:'Lengkapkan semua medan wajib.',chooseSupplier:'Pilih sekurang-kurangnya satu pembekal.',chooseLine:'Pilih rekuisisi diluluskan atau masukkan kuantiti item.',noEligible:'Tiada RFQ dihantar yang menunggu respons pembekal.',responses:'respons'},
    zh:{rfqs:'询价单',rfqUnit:'张询价单',rfqSub:'邀请已批准供应商、收集可比较报价，并选择中标报价。',quotes:'供应商报价',quoteUnit:'份报价',quoteSub:'比较供应商价格、交期和条款，然后创建可追溯的采购订单。',all:'全部',draft:'草稿',sent:'已发出',responded:'已回复',awarded:'已定标',closed:'已关闭',received:'已收到',rejected:'未中标',converted:'已转采购单',open:'进行中询价',awaiting:'等待回复',fully:'全部回复',newRfq:'新建询价单',newQuote:'录入报价',rfq:'询价单',subject:'主题',fromPr:'来源请购单',suppliers:'供应商',responseBy:'回复期限',status:'状态',quote:'报价单',supplier:'供应商',item:'物料',unitPrice:'单价',lead:'交期',validUntil:'有效期至',total:'合计',view:'查看详情',compare:'比较报价',issue:'发出询价单',close:'关闭询价单',record:'录入供应商报价',convert:'选中并转采购订单',date:'日期',requisition:'已批准请购单',adHoc:'临时需求',due:'回复截止日期',invited:'受邀供应商',lines:'询价明细',qty:'数量',create:'创建询价单',cancel:'取消',quoteDate:'报价日期',currency:'币种',leadDays:'交期（天）',terms:'付款条款',warranty:'保修',taxCode:'税码',saveQuote:'保存报价',noQuotes:'没有可比较的报价。',best:'最低总额',select:'选择',created:'询价单已创建',issued:'询价单已发出',closedMsg:'询价单已关闭',quoteSaved:'供应商报价已保存',poCreated:'采购订单已创建',required:'请填写所有必填项。',chooseSupplier:'请至少选择一个供应商。',chooseLine:'请选择已批准请购单或填写物料数量。',noEligible:'没有等待供应商回复的已发出询价单。',responses:'份回复'},
    ja:{rfqs:'見積依頼',rfqUnit:'件',rfqSub:'承認済み仕入先を招待し、比較可能な回答から採用見積を決定します。',quotes:'仕入先見積',quoteUnit:'件',quoteSub:'価格、納期、条件を比較し、追跡可能な発注書を作成します。',all:'すべて',draft:'下書き',sent:'送信済み',responded:'回答済み',awarded:'採用済み',closed:'終了',received:'受領済み',rejected:'不採用',converted:'発注書作成済み',open:'進行中RFQ',awaiting:'回答待ち',fully:'全回答済み',newRfq:'RFQ作成',newQuote:'見積登録',rfq:'RFQ',subject:'件名',fromPr:'購買依頼',suppliers:'仕入先',responseBy:'回答期限',status:'状態',quote:'見積',supplier:'仕入先',item:'品目',unitPrice:'単価',lead:'納期',validUntil:'有効期限',total:'合計',view:'詳細を表示',compare:'見積を比較',issue:'RFQを送信',close:'RFQを終了',record:'仕入先見積を登録',convert:'採用して発注書へ',date:'日付',requisition:'承認済み購買依頼',adHoc:'個別需要',due:'回答期限',invited:'招待仕入先',lines:'依頼明細',qty:'数量',create:'RFQを作成',cancel:'キャンセル',quoteDate:'見積日',currency:'通貨',leadDays:'納期（日）',terms:'支払条件',warranty:'保証',taxCode:'税コード',saveQuote:'見積を保存',noQuotes:'比較できる見積がありません。',best:'最安合計',select:'採用',created:'RFQを作成しました',issued:'RFQを送信しました',closedMsg:'RFQを終了しました',quoteSaved:'見積を保存しました',poCreated:'発注書を作成しました',required:'必須項目を入力してください。',chooseSupplier:'仕入先を1社以上選択してください。',chooseLine:'承認済み購買依頼を選ぶか品目数量を入力してください。',noEligible:'回答待ちの送信済みRFQがありません。',responses:'回答'},
    vi:{rfqs:'Yêu cầu báo giá',rfqUnit:'RFQ',rfqSub:'Mời nhà cung cấp đã duyệt, thu thập phản hồi có thể so sánh và chọn báo giá thắng.',quotes:'Báo giá nhà cung cấp',quoteUnit:'báo giá',quoteSub:'So sánh giá, thời gian giao và điều khoản, rồi tạo đơn mua có thể truy vết.',all:'Tất cả',draft:'Nháp',sent:'Đã gửi',responded:'Đã phản hồi',awarded:'Đã chọn',closed:'Đã đóng',received:'Đã nhận',rejected:'Không chọn',converted:'Đã chuyển PO',open:'RFQ đang mở',awaiting:'Chờ phản hồi',fully:'Đã phản hồi đủ',newRfq:'RFQ mới',newQuote:'Ghi báo giá',rfq:'RFQ',subject:'Chủ đề',fromPr:'Từ yêu cầu mua',suppliers:'Nhà cung cấp',responseBy:'Hạn phản hồi',status:'Trạng thái',quote:'Báo giá',supplier:'Nhà cung cấp',item:'Mặt hàng',unitPrice:'Đơn giá',lead:'Thời gian',validUntil:'Hiệu lực đến',total:'Tổng',view:'Xem chi tiết',compare:'So sánh báo giá',issue:'Gửi RFQ',close:'Đóng RFQ',record:'Ghi báo giá nhà cung cấp',convert:'Chọn & chuyển thành PO',date:'Ngày',requisition:'Yêu cầu mua đã duyệt',adHoc:'Nhu cầu đột xuất',due:'Hạn phản hồi',invited:'Nhà cung cấp được mời',lines:'Dòng yêu cầu',qty:'Số lượng',create:'Tạo RFQ',cancel:'Hủy',quoteDate:'Ngày báo giá',currency:'Tiền tệ',leadDays:'Thời gian giao (ngày)',terms:'Điều khoản thanh toán',warranty:'Bảo hành',taxCode:'Mã thuế',saveQuote:'Lưu báo giá',noQuotes:'Không có báo giá để so sánh.',best:'Tổng tốt nhất',select:'Chọn',created:'Đã tạo RFQ',issued:'Đã gửi RFQ',closedMsg:'Đã đóng RFQ',quoteSaved:'Đã lưu báo giá',poCreated:'Đã tạo đơn mua',required:'Hoàn tất các trường bắt buộc.',chooseSupplier:'Chọn ít nhất một nhà cung cấp.',chooseLine:'Chọn yêu cầu mua đã duyệt hoặc nhập số lượng mặt hàng.',noEligible:'Không có RFQ đã gửi đang chờ phản hồi.',responses:'phản hồi'},
  };
  return packs[lang]||packs.en;
}

function nextSourcingNo(rows,prefix){
  let max=0;
  (rows||[]).forEach(row=>{ const match=/(\d+)\s*$/.exec(row.no||''); if(match&&+match[1]>max) max=+match[1]; });
  return `${prefix}-${new Date().getFullYear()}-${String(max+1).padStart(4,'0')}`;
}

function sourcingRfqStatus(r){
  const c=sourcingCopy();
  return r.status==='Partially Responded'?`${c.sent} · ${r.responded}/${r.suppliers}`:(c[r.rawStatus]||r.status);
}

function sourcingQuoteStatus(q){
  const c=sourcingCopy();
  return c[q.rawStatus]||q.status;
}

async function runRfqAction(r,action){
  const c=sourcingCopy();
  try{
    await window.ErpSystemData.action('purchasing/rfqs',r.id,action,{},`rfq-${action}-${r.id}-v${r.version}`);
    toast(action==='issue'?c.issued:c.closedMsg,'ok'); navigate('rfqs');
  }catch(error){ toast(error&&error.message||c.required,'danger'); }
}

function openRfqDetails(r){
  const c=sourcingCopy();
  const invited=r.supplierIds.map(id=>DB.suppliers.find(s=>s.id===id)).filter(Boolean);
  appModal({icon:'comment',title:`${r.no} · ${r.subject}`,width:720,
    body:`<div class="docmeta" style="margin-bottom:16px"><div class="dm"><small>${c.date}</small><b>${esc(r.date)}</b></div><div class="dm"><small>${c.due}</small><b>${esc(r.due)}</b></div><div class="dm"><small>${c.status}</small>${cap(sourcingRfqStatus(r),RFQ_TONE[r.status]||'neutral')}</div></div>
      <div class="sectitle">${c.invited}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${invited.map(s=>cap(s.name,'info')).join('')}</div>
      <div class="sectitle">${c.lines}</div><table class="lines"><thead><tr><th class="l">${c.item}</th><th>${c.qty}</th></tr></thead><tbody>${r.lines.map(line=>`<tr><td class="l"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></td><td class="tnum">${num(line.qty)} ${esc(line.uom)}</td></tr>`).join('')}</tbody></table>`,
    actions:`${btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})}${r.rawStatus==='draft'?btn(c.issue,{icon:'send',cls:'primary',attrs:`onclick="closeModal();runRfqAction(DB.rfqs.find(r=>r.id===${r.id}),'issue')"`}):''}${['sent','responded'].includes(r.rawStatus)?btn(c.compare,{icon:'flow',cls:'primary',attrs:`onclick="closeModal();openQuoteCompare('${r.no}')"`}):''}`});
}

function newRfqModal(){
  const c=sourcingCopy(), today=new Date().toISOString().slice(0,10), due=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const reqs=DB.purchaseReqs.filter(r=>r.rawStatus==='approved'&&!r.convertedOrderId&&!DB.rfqs.some(q=>q.requisitionId===r.id));
  const docNo=nextSourcingNo(DB.rfqs,'RFQ');
  appModal({icon:'comment',title:c.newRfq,width:700,body:`<div class="set-grid">
    <div class="fld"><span>${c.rfq}</span><input id="srcNo" value="${esc(docNo)}" readonly></div>
    <div class="fld"><span>${c.subject} *</span><input id="srcSubject"></div>
    <div class="fld"><span>${c.date} *</span><input id="srcDate" type="date" value="${today}"></div>
    <div class="fld"><span>${c.due} *</span><input id="srcDue" type="date" value="${due}"></div>
    <div class="fld" style="grid-column:1/-1"><span>${c.requisition}</span><select id="srcReq"><option value="">${c.adHoc}</option>${reqs.map(r=>`<option value="${r.id}">${esc(r.no)} · ${esc(r.dept)}</option>`).join('')}</select></div>
    <div class="fld"><span>${c.item}</span><select id="srcItem">${DB.items.map(item=>`<option value="${item.id}">${esc(item.sku)} · ${esc(item.name)}</option>`).join('')}</select></div>
    <div class="fld"><span>${c.qty}</span><input id="srcQty" type="number" min="0.0001" step="0.0001" value="1"></div>
    <div class="fld" style="grid-column:1/-1"><span>${c.invited} *</span><div style="display:flex;gap:12px;flex-wrap:wrap;padding:8px 0">${DB.suppliers.map(s=>`<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="srcSupplier" value="${s.id}"> ${esc(s.name)}</label>`).join('')}</div></div>
  </div><div class="panel"><div class="panel-h"><h3>${c.lines}</h3></div><div class="panel-body" id="srcLineSummary"></div></div>`,actions:`${btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c.create,{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`});
  const summary=()=>{
    const req=DB.purchaseReqs.find(r=>r.id===Number($('#srcReq').value));
    const lines=req?req.lineItems:[{...DB.items.find(i=>i.id===Number($('#srcItem').value)),qty:Number($('#srcQty').value)||0}];
    $('#srcItem').disabled=Boolean(req); $('#srcQty').disabled=Boolean(req);
    $('#srcLineSummary').innerHTML=lines.map(line=>`<div class="sumrow"><span>${esc(line.sku)} · ${esc(line.name)}</span><b>${num(line.qty)} ${esc(line.uom||'')}</b></div>`).join('');
  };
  ['srcReq','srcItem','srcQty'].forEach(id=>$('#'+id).addEventListener('change',summary)); summary();
  $('#modalEl [data-save]').addEventListener('click',async function(){
    const req=DB.purchaseReqs.find(r=>r.id===Number($('#srcReq').value));
    const supplierIds=$$('input[name="srcSupplier"]:checked').map(el=>Number(el.value));
    const subject=$('#srcSubject').value.trim();
    const lines=req?req.lineItems.map(line=>({productId:line.productId,qty:line.qty})):[{productId:Number($('#srcItem').value),qty:Number($('#srcQty').value)}];
    if(!subject||!$('#srcDate').value||!$('#srcDue').value){ toast(c.required,'danger'); return; }
    if(!supplierIds.length){ toast(c.chooseSupplier,'danger'); return; }
    if(lines.some(line=>!line.productId||!(line.qty>0))){ toast(c.chooseLine,'danger'); return; }
    this.disabled=true;
    try{
      await window.ErpSystemData.create('purchasing/rfqs',{docNo,requisitionId:req?req.id:null,subject,rfqDate:$('#srcDate').value,responseDueDate:$('#srcDue').value,supplierIds,lines});
      closeModal(); toast(c.created,'ok'); navigate('rfqs');
    }catch(error){ this.disabled=false; toast(error&&error.message||c.required,'danger'); }
  });
}

makePurList({
  route:'rfqs', title:()=>sourcingCopy().rfqs, unit:()=>sourcingCopy().rfqUnit, prepare:prepareCanonicalPurchasingData,
  sub:()=>sourcingCopy().rfqSub,
  rows:()=>DB.rfqs, rowId:r=>r.no,
  chips:[['all',()=>sourcingCopy().all],['draft',()=>sourcingCopy().draft],['sent',()=>sourcingCopy().sent],['responded',()=>sourcingCopy().responded],['awarded',()=>sourcingCopy().awarded],['closed',()=>sourcingCopy().closed]],
  filterFn:(r,f)=>r.rawStatus===f,
  kpis:(r)=>[
    {label:()=>sourcingCopy().open, val:r.filter(x=>!['awarded','closed'].includes(x.rawStatus)).length},
    {label:()=>sourcingCopy().awaiting, val:r.filter(x=>x.rawStatus==='sent').length, accent:true, f:'sent'},
    {label:()=>sourcingCopy().fully, val:r.filter(x=>x.rawStatus==='responded').length, f:'responded'},
    {label:()=>sourcingCopy().awarded, val:r.filter(x=>x.rawStatus==='awarded').length, f:'awarded'},
  ],
  newBtn:{label:()=>sourcingCopy().newRfq, onClick:()=>newRfqModal()},
  columns:[
    {label:()=>sourcingCopy().rfq, w:'minmax(140px,1.2fr)', render:r=>docNoCell(r.no, r.date)},
    {label:()=>sourcingCopy().subject, align:'l', w:'minmax(200px,2.4fr)', render:r=>`<span class="li-subj">${esc(r.subject)}</span>`},
    {label:()=>sourcingCopy().fromPr, align:'l', w:'minmax(110px,1fr)', render:r=>r.pr?`<span class="mono" style="font-size:12px">${esc(r.pr)}</span>`:'<span style="color:var(--faint)">—</span>'},
    {label:()=>sourcingCopy().suppliers, align:'c', w:'minmax(86px,0.9fr)', render:r=>miniProgress(r.responded, r.suppliers)},
    {label:()=>sourcingCopy().responseBy, align:'l', w:'minmax(96px,0.9fr)', render:r=>`<span style="color:var(--muted)">${esc(r.due)}</span>`},
    {label:()=>sourcingCopy().status, align:'l', cls:'cap-cell', w:'minmax(130px,1.2fr)', render:r=>cap(sourcingRfqStatus(r),RFQ_TONE[r.status]||'neutral')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(r)=>[
    {id:'view',icon:'ext',label:sourcingCopy().view,run:()=>openRfqDetails(r)},
    ...(r.rawStatus==='draft'?[{id:'issue',icon:'send',label:sourcingCopy().issue,run:()=>runRfqAction(r,'issue')}]:[]),
    ...(['sent','responded'].includes(r.rawStatus)?[{id:'compare',icon:'flow',label:sourcingCopy().compare,run:()=>openQuoteCompare(r.no)},{id:'record',icon:'receipt',label:sourcingCopy().record,run:()=>newSupplierQuoteModal(r.id)}]:[]),
    ...(['draft','sent','responded'].includes(r.rawStatus)?[{id:'close',icon:'x',label:sourcingCopy().close,danger:true,sep:true,run:()=>runRfqAction(r,'close')}]:[]),
  ],
  onOpen:(r)=>openRfqDetails(r),
});

/* ---------------- SUPPLIER QUOTATIONS + comparison ---------------- */
function eligibleQuoteRfqs(){
  return DB.rfqs.filter(r=>['sent','responded'].includes(r.rawStatus)&&r.supplierIds.some(id=>!DB.supplierQuotes.some(q=>q.rfqId===r.id&&q.supplierId===id)));
}

function newSupplierQuoteModal(preselectedRfqId){
  const c=sourcingCopy(), eligible=eligibleQuoteRfqs();
  if(!eligible.length){ toast(c.noEligible,'info'); return; }
  const today=new Date().toISOString().slice(0,10), valid=new Date(Date.now()+30*86400000).toISOString().slice(0,10), docNo=nextSourcingNo(DB.supplierQuotes,'SQ');
  const purchaseTaxCode=DB.company.country==='MY'?'SV':'SR';
  appModal({icon:'receipt',title:c.newQuote,width:720,body:`<div class="set-grid">
    <div class="fld"><span>${c.quote}</span><input value="${esc(docNo)}" readonly></div>
    <div class="fld"><span>${c.rfq} *</span><select id="sqRfq">${eligible.map(r=>`<option value="${r.id}" ${r.id===preselectedRfqId?'selected':''}>${esc(r.no)} · ${esc(r.subject)}</option>`).join('')}</select></div>
    <div class="fld"><span>${c.supplier} *</span><select id="sqSupplier"></select></div>
    <div class="fld"><span>${c.quoteDate} *</span><input id="sqDate" type="date" value="${today}"></div>
    <div class="fld"><span>${c.validUntil} *</span><input id="sqValid" type="date" value="${valid}"></div>
    <div class="fld"><span>${c.currency}</span><input id="sqCurrency" value="${esc(DB.company.currency)}" maxlength="3"></div>
    <div class="fld"><span>${c.leadDays}</span><input id="sqLead" type="number" min="0" value="7"></div>
    <div class="fld"><span>${c.terms} *</span><input id="sqTerms" value="30 days"></div>
    <div class="fld"><span>${c.warranty}</span><input id="sqWarranty" value="12 months"></div>
  </div><div class="panel"><div class="panel-h"><h3>${c.lines}</h3></div><div class="panel-body"><table class="lines"><thead><tr><th class="l">${c.item}</th><th>${c.qty}</th><th>${c.unitPrice}</th><th>${c.taxCode}</th></tr></thead><tbody id="sqLines"></tbody></table></div></div>`,actions:`${btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c.saveQuote,{icon:'check',cls:'primary',attrs:'data-save="1"'})}`});
  const render=()=>{
    const rfq=DB.rfqs.find(r=>r.id===Number($('#sqRfq').value));
    const candidates=rfq.supplierIds.map(id=>DB.suppliers.find(s=>s.id===id)).filter(s=>s&&!DB.supplierQuotes.some(q=>q.rfqId===rfq.id&&q.supplierId===s.id));
    $('#sqSupplier').innerHTML=candidates.map(s=>`<option value="${s.id}">${esc(s.code)} · ${esc(s.name)}</option>`).join('');
    $('#sqLines').innerHTML=rfq.lines.map(line=>`<tr data-line="${line.id}"><td class="l"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></td><td class="tnum">${num(line.qty)}</td><td><input class="lineinput sqCost" type="number" min="0" step="0.0001" value="0"></td><td><select class="sqTax"><option value="${purchaseTaxCode}">${purchaseTaxCode}</option></select></td></tr>`).join('');
  };
  $('#sqRfq').addEventListener('change',render); render();
  $('#modalEl [data-save]').addEventListener('click',async function(){
    const rfq=DB.rfqs.find(r=>r.id===Number($('#sqRfq').value));
    const lines=$$('#sqLines tr').map(tr=>({rfqLineId:Number(tr.dataset.line),unitCost:Number(tr.querySelector('.sqCost').value),taxCode:tr.querySelector('.sqTax').value}));
    if(!rfq||!Number($('#sqSupplier').value)||!$('#sqDate').value||!$('#sqValid').value||!$('#sqTerms').value.trim()){ toast(c.required,'danger'); return; }
    this.disabled=true;
    try{
      await window.ErpSystemData.create('purchasing/supplier-quotations',{docNo,rfqId:rfq.id,supplierId:Number($('#sqSupplier').value),quoteDate:$('#sqDate').value,validUntil:$('#sqValid').value,currency:$('#sqCurrency').value.trim().toUpperCase(),leadTimeDays:Number($('#sqLead').value),paymentTerms:$('#sqTerms').value.trim(),warranty:$('#sqWarranty').value.trim()||null,lines});
      closeModal(); toast(c.quoteSaved,'ok'); navigate('supplier-quotations');
    }catch(error){ this.disabled=false; toast(error&&error.message||c.required,'danger'); }
  });
}

function openSupplierQuoteDetails(q){
  const c=sourcingCopy();
  appModal({icon:'receipt',title:`${q.no} · ${q.supplier}`,width:720,body:`<div class="docmeta" style="margin-bottom:16px"><div class="dm"><small>${c.rfq}</small><b>${esc(q.rfq)}</b></div><div class="dm"><small>${c.validUntil}</small><b>${esc(q.validity)}</b></div><div class="dm"><small>${c.status}</small>${cap(sourcingQuoteStatus(q),SQ_TONE[q.status]||'neutral')}</div></div><table class="lines"><thead><tr><th class="l">${c.item}</th><th>${c.qty}</th><th>${c.unitPrice}</th><th>${c.total}</th></tr></thead><tbody>${q.lines.map(line=>`<tr><td class="l"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></td><td>${num(line.qty)}</td><td>${money(line.unitCost,q.currency)}</td><td>${money(line.net+line.tax,q.currency)}</td></tr>`).join('')}</tbody></table><div class="sumrow total"><span>${c.total}</span><b>${money(q.total,q.currency)}</b></div>`,actions:`${btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})}${q.rawStatus==='received'?btn(c.convert,{icon:'check',cls:'primary',attrs:`onclick="closeModal();convertSupplierQuote(${q.id})"`}):''}`});
}

async function convertSupplierQuote(quotationId){
  const c=sourcingCopy(), q=DB.supplierQuotes.find(row=>row.id===quotationId);
  if(!q) return;
  const docNo=nextSourcingNo(DB.purchaseOrders,'PO'), orderDate=new Date().toISOString().slice(0,10);
  try{
    await window.ErpSystemData.action('purchasing/supplier-quotations',q.id,'convert-to-purchase-order',{docNo,orderDate},`award-supplier-quotation-${q.id}-v${q.version}`);
    closeModal(); toast(`${c.poCreated}: ${docNo}`,'ok'); navigate('supplier-quotations');
  }catch(error){ toast(error&&error.message||c.required,'danger'); }
}

makePurList({
  route:'supplier-quotations', title:()=>sourcingCopy().quotes, unit:()=>sourcingCopy().quoteUnit, prepare:prepareCanonicalPurchasingData,
  sub:()=>sourcingCopy().quoteSub,
  rows:()=>DB.supplierQuotes, rowId:q=>q.no,
  chips:[['all',()=>sourcingCopy().all],['received',()=>sourcingCopy().received],['rejected',()=>sourcingCopy().rejected],['converted',()=>sourcingCopy().converted]],
  filterFn:(q,f)=>q.rawStatus===f,
  kpis:(r)=>[
    {label:()=>sourcingCopy().received, val:r.filter(q=>q.rawStatus==='received').length, f:'received'},
    {label:()=>sourcingCopy().total, val:money0(r.reduce((a,q)=>a+q.total,0))},
    {label:()=>sourcingCopy().rejected, val:r.filter(q=>q.rawStatus==='rejected').length, f:'rejected'},
    {label:()=>sourcingCopy().converted, val:r.filter(q=>q.rawStatus==='converted').length, f:'converted'},
  ],
  newBtn:{label:()=>sourcingCopy().newQuote,onClick:()=>newSupplierQuoteModal()},
  columns:[
    {label:()=>sourcingCopy().quote, w:'minmax(128px,1.1fr)', render:q=>docNoCell(q.no, q.rfq)},
    {label:()=>sourcingCopy().supplier, align:'l', w:'minmax(160px,1.6fr)', render:q=>suppCell(q.supplier,q.code)},
    {label:()=>sourcingCopy().item, align:'l', w:'minmax(150px,1.6fr)', render:q=>`<span class="li-subj">${esc(q.item)}</span>`},
    {label:()=>sourcingCopy().unitPrice, align:'r', sortable:true, w:'minmax(90px,0.9fr)', render:q=>`<b class="tnum">${money(q.price,q.currency)}</b>`},
    {label:()=>sourcingCopy().lead, align:'r', sortable:true, w:'minmax(56px,0.6fr)', render:q=>`${q.leadTime}d`},
    {label:()=>sourcingCopy().validUntil, align:'l', w:'minmax(94px,0.9fr)', render:q=>`<span style="color:var(--muted)">${esc(q.validity)}</span>`},
    {label:()=>sourcingCopy().total, align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:q=>`<b class="tnum">${money(q.total,q.currency)}</b>`},
    {label:()=>sourcingCopy().status, align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:q=>cap(sourcingQuoteStatus(q),SQ_TONE[q.status]||'neutral')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(q)=>[
    {id:'view',icon:'ext',label:sourcingCopy().view,run:()=>openSupplierQuoteDetails(q)},
    {id:'compare',icon:'flow',label:sourcingCopy().compare,run:()=>openQuoteCompare(q.rfq)},
    ...(q.rawStatus==='received'?[{id:'select',icon:'check',label:sourcingCopy().convert,run:()=>convertSupplierQuote(q.id)}]:[]),
  ],
  onOpen:(q)=>openSupplierQuoteDetails(q),
});

/* quotation comparison (modal) */
function openQuoteCompare(rfqNo){
  const c=sourcingCopy(), qs=DB.supplierQuotes.filter(q=>q.rfq===rfqNo);
  if(!qs.length){ toast(c.noQuotes,'info'); return; }
  const rfq=DB.rfqs.find(r=>r.no===rfqNo);
  const best={lead:Math.min(...qs.map(q=>q.leadTime)),total:Math.min(...qs.map(q=>q.total))};
  const cols=qs.map(q=>{
    const win=q.total===best.total;
    return `<div class="cmpcol ${win?'cmpcol-best':''}">
      <div class="cmp-h">${win?`<span class="cmp-badge">${c.best}</span>`:''}<b>${esc(q.supplier)}</b><small>${esc(q.code)} · ${esc(q.no)}</small></div>
      <div class="cmp-row"><span>${c.total}</span><b class="${win?'cmp-win':''}">${money(q.total,q.currency)}</b></div>
      <div class="cmp-row"><span>${c.lead}</span><b class="${q.leadTime===best.lead?'cmp-win':''}">${q.leadTime}d</b></div>
      <div class="cmp-row"><span>${c.terms}</span><b>${esc(q.terms)}</b></div>
      <div class="cmp-row"><span>${c.warranty}</span><b>${esc(q.warranty)}</b></div>
      <div class="cmp-row"><span>${c.validUntil}</span><b>${esc(q.validity)}</b></div>
      <div class="cmp-foot">${q.rawStatus==='received'?btn(c.select,{icon:'check',cls:win?'primary':'soft',sm:false,attrs:`onclick="convertSupplierQuote(${q.id})"`}):cap(sourcingQuoteStatus(q),SQ_TONE[q.status]||'neutral')}</div>
    </div>`;
  }).join('');
  appModal({icon:'flow',title:`${c.compare} · ${rfqNo}`,width:'min(880px,94vw)',body:`<div style="color:var(--muted);font-size:13px;margin-bottom:12px">${rfq?esc(rfq.subject)+' · ':''}${qs.length} ${c.responses}</div><div class="cmpgrid">${cols}</div>`,actions:btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})});
  const mEl=document.getElementById('modalEl'); if(mEl){ mEl.style.width='min(900px,95vw)'; mEl.style.maxWidth='95vw'; }
}

/* ---------------- PURCHASE ORDERS (rebuilt on the factory) ---------------- */
/* PO_TONE → TONES.po (defined in data-core.js) */
makePurList({
  route:'purchase-orders', active:'purchase-orders', title:'Purchase Orders', unit:'orders',
  prepare:prepareCanonicalPurchasingData,
  sub:'Confirmed orders issued to suppliers after approval or supplier selection. Track approval, receiving, invoicing and payment status through to close.',
  rows:()=>DB.purchaseOrders, rowId:p=>p.no,
  chips:[['all','All'],['pending','Pending approval'],['approved','Approved'],['receiving','Receiving'],['done','Completed']],
  filterFn:(p,f)=>f==='pending'?p.status==='Pending Approval':f==='approved'?p.status==='Approved':f==='receiving'?p.status==='Partially Completed':p.status==='Completed',
  kpis:(r)=>[
    {label:'Open POs', val:r.filter(p=>!['Completed','Cancelled'].includes(p.status)).length},
    {label:'Open commitment', val:money0(r.filter(p=>!['Completed','Cancelled'].includes(p.status)).reduce((a,p)=>a+p.total,0))},
    {label:'Pending approval', val:r.filter(p=>p.status==='Pending Approval').length, accent:true, f:'pending'},
    {label:'Receiving', val:r.filter(p=>p.status==='Partially Completed').length, f:'receiving'},
  ],
  newBtn:{label:'New PO', onClick:()=>navigate('new-purchase-order')},
  columns:[
    {label:'PO Number', w:'minmax(150px,1.3fr)', render:p=>docNoCell(p.no, p.supp)},
    {label:'Date', align:'l', sortable:true, w:'minmax(96px,0.9fr)', render:p=>esc(p.date)},
    {label:'Expected', align:'l', w:'minmax(96px,0.9fr)', render:p=>esc(p.expect)},
    {label:'Buyer', align:'l', w:'minmax(96px,0.9fr)', render:p=>esc(p.buyer)},
    {label:'Lines', align:'r', w:'minmax(54px,0.5fr)', render:p=>p.items},
    {label:'Received', align:'l', w:'minmax(110px,1.1fr)', render:p=>miniProgress(Math.round(p.recv/100*p.items), p.items)},
    {label:'Total', align:'r', sortable:true, w:'minmax(108px,1fr)', render:p=>`<b class="tnum">${money(p.total,p.currency)}</b>${p.currency!=='USD'?`<div style="font-size:11px;color:var(--muted)">${p.currency}</div>`:''}`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(132px,1.2fr)', render:p=>cap(p.status,PO_TONE[p.status])+(p.flag?` <span data-tip="${esc(p.flag)}" style="color:var(--warn)">${ic('warn')}</span>`:'')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(p)=>[
    {id:'view',icon:'ext',label:'Open PO',run:()=>openPO(p)},
    {id:'approve',icon:'flow',label:'Review approval',run:()=>navigate('po-approval')},
    {id:'grn',icon:'receive',label:'Receive goods',run:()=>doReceiveGoods(p)},
    {id:'inv',icon:'receipt',label:'Post supplier invoice',run:()=>doPostSupplierInvoice(p)},
  ],
  onOpen:(p)=>openPO(p),
});
function openPO(p){ if(p.no==='PO-26-0291'){ navigate('po-approval'); return; } toast('Opening '+p.no,'info'); }

/* TASK-023: the live counterparts of confirmOrder's UI pattern — await the
   real adapter transaction, toast the real result or the real error, and
   re-navigate so the list re-renders from freshly refreshed DB.* data (the
   adapter calls refresh() itself before these promises resolve). Guarded by
   the PO's real status ('Approved'/'Completed' — this schema's only two live
   states, see erp-system-data-adapter.js) rather than hidden/disabled menu
   items, since makePurList's row menu doesn't support conditional items. */
async function doReceiveGoods(p){
  if(p.status!=='Approved'){ toast(`${p.no} is '${p.status}' — cannot receive goods (already received, or cancelled).`,'warn'); return; }
  const adapter=window.ErpSystemData;
  const location=(DB.purchasingWarehouses||[])[0];
  if(!adapter||typeof adapter.action!=='function'){ toast('ERP data adapter not loaded','warn'); return; }
  if(!location){ toast('Create a warehouse before receiving goods.','warn'); return; }
  const receivedDate=new Date().toISOString().slice(0,10);
  const docNo=`GR-PO-${p.id}`;
  try{
    const response=await adapter.action(
      'purchasing/purchase-orders',
      p.id,
      'receive',
      {warehouseId:location.id,docNo,receivedDate},
      `purchase-receive-${p.id}`,
    );
    const res=response.data;
    toast(`${docNo} posted — stock updated for ${p.no} (${res.lines} line${res.lines===1?'':'s'}).`,'ok');
    await navigate('purchase-orders');
  }catch(e){ toast((e&&e.message)||'Receive goods failed','danger'); }
}
async function doPostSupplierInvoice(p){
  if(p.status!=='Completed'){ toast(`${p.no} is '${p.status}' — receive goods before posting an invoice.`,'warn'); return; }
  if(DB.supplierInvoices.some(i=>i.po===p.no)){ toast(`${p.no} already has a posted supplier invoice.`,'info'); return; }
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.action!=='function'){ toast('ERP data adapter not loaded','warn'); return; }
  const invoiceDate=new Date().toISOString().slice(0,10);
  const docNo=`SINV-PO-${p.id}`;
  try{
    const response=await adapter.action(
      'purchasing/purchase-orders',
      p.id,
      'post-invoice',
      {docNo,invoiceDate},
      `purchase-invoice-${p.id}`,
    );
    const res=response.data;
    toast(`${docNo} posted to AP — ${money(res.total)} (Dr Inventory + Input Tax, Cr AP).`,'ok');
    await navigate('supplier-invoices');
  }catch(e){ toast((e&&e.message)||'Post invoice failed','danger'); }
}

/* ---------------- GOODS RECEIPTS ---------------- */
makePurList({
  route:'goods-receipts', active:'goods-receipts', title:'Goods Receipts', unit:'receipts',
  prepare:prepareCanonicalPurchasingData,
  sub:'Receiving against purchase orders — full or partial, with QC disposition and putaway. Posting updates inventory and feeds the 3-way match.',
  rows:()=>DB.goodsReceipts, rowId:g=>g.no,
  chips:[['all','All'],['open','Open'],['qc','QC'],['posted','Posted'],['rejected','Rejected']],
  filterFn:(g,f)=>f==='open'?['Received','Partially Received','Pending QC'].includes(g.status):f==='qc'?g.status==='Pending QC':f==='posted'?g.status==='Posted':g.status==='Rejected',
  kpis:(r)=>[
    {label:'Open receipts', val:r.filter(g=>!['Posted','Cancelled'].includes(g.status)).length, f:'open'},
    {label:'Pending QC', val:r.filter(g=>g.status==='Pending QC').length, accent:true, f:'qc'},
    {label:'Partially received', val:r.filter(g=>g.status==='Partially Received').length},
    {label:'Posted', val:r.filter(g=>g.status==='Posted').length, f:'posted'},
  ],
  newBtn:{label:'New receipt', onClick:()=>navigate('goods-receipt')},
  columns:[
    {label:'GRN', w:'minmax(140px,1.2fr)', render:g=>docNoCell(g.no, g.date)},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:g=>suppCell(g.supplier,g.code)},
    {label:'Against PO', align:'l', w:'minmax(116px,1fr)', render:g=>`<span class="mono" style="font-size:12px">${esc(g.po)}</span>`},
    {label:'Warehouse', align:'l', w:'minmax(100px,1fr)', render:g=>`<span style="color:var(--muted)">${esc(g.warehouse)}</span>`},
    {label:'Received', align:'l', w:'minmax(110px,1.1fr)', render:g=>{const p=g.recvPct,tone=p>=100?'ok':p>0?'warn':'';return `<span class="fulcell"><span class="minibar"><i class="${tone}" style="width:${p}%"></i></span><b class="fnum">${p}%</b></span>`;}},
    {label:'QC', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:g=>cap(g.qc, g.qc==='Accepted'?'ok':g.qc==='Rejected'?'danger':'warn')},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(128px,1.2fr)', render:g=>cap(g.status,GRN_TONE[g.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(g)=>[
    {id:'view',icon:'ext',label:'Open receipt',run:()=>openGRN(g)},
    {id:'qc',icon:'checkc',label:'Open inspection',run:()=>navigate('qc-inspection')},
    {id:'inv',icon:'receipt',label:'Match to invoice',run:()=>navigate('supplier-invoices')},
    {id:'ret',icon:'refresh',label:'Create return',danger:false,sep:true,run:()=>navigate('purchase-returns')},
  ],
  onOpen:(g)=>openGRN(g),
});
function openGRN(g){ if(g.no==='GRN-26-0188'){ navigate('goods-receipt'); return; } openPurTxn('grn', g); }

/* ---------------- SUPPLIER INVOICES ---------------- */
makePurList({
  route:'supplier-invoices', active:'supplier-invoices', title:'Supplier Invoices', unit:'invoices',
  prepare:prepareCanonicalPurchasingData,
  sub:'AP invoices captured against purchase orders and goods receipts. 3-way matching flags quantity and price variances before posting and payment.',
  rows:()=>DB.supplierInvoices, rowId:i=>i.no,
  chips:[['all','All'],['match','To match'],['posted','Posted'],['paid','Paid'],['overdue','Overdue']],
  filterFn:(i,f)=>f==='match'?['Pending Matching','Mismatch'].includes(i.status):f==='posted'?['Posted','Partially Paid'].includes(i.status):f==='paid'?i.status==='Paid':i.status==='Overdue',
  kpis:(r)=>[
    {label:'To match', val:r.filter(i=>['Pending Matching','Mismatch'].includes(i.status)).length, accent:true, f:'match'},
    {label:'Outstanding AP', val:money0(r.filter(i=>['Posted','Partially Paid','Overdue'].includes(i.status)).reduce((a,i)=>a+i.total,0))},
    {label:'Overdue', val:r.filter(i=>i.status==='Overdue').length, neg:true, f:'overdue'},
    {label:'Paid', val:r.filter(i=>i.status==='Paid').length, f:'paid'},
  ],
  columns:[
    {label:'Invoice', w:'minmax(140px,1.2fr)', render:i=>docNoCell(i.no, i.date)},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:i=>suppCell(i.supplier,i.code)},
    {label:'PO · GRN', align:'l', w:'minmax(150px,1.4fr)', render:i=>`<span class="mono" style="font-size:11.5px">${esc(i.po||'—')}${i.grn?' · '+esc(i.grn):''}</span>`},
    {label:'Due', align:'l', w:'minmax(96px,0.9fr)', render:i=>`<span style="color:${i.status==='Overdue'?'var(--danger)':'var(--muted)'}">${esc(i.due)}</span>`},
    {label:'Match', align:'l', cls:'cap-cell', w:'minmax(106px,1fr)', render:i=>cap(i.match, i.match==='Matched'?'ok':i.match==='Mismatch'?'danger':i.match==='No GRN'?'warn':'info')},
    {label:'Total', align:'r', sortable:true, w:'minmax(108px,1fr)', render:i=>`<b class="tnum">${money(i.total,i.currency)}</b>${i.currency!=='USD'?`<div style="font-size:11px;color:var(--muted)">${i.currency}</div>`:''}`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(128px,1.2fr)', render:i=>cap(i.status,SINV_TONE[i.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(i)=>[
    {id:'view',icon:'ext',label:'Open invoice',run:()=>openSINV(i)},
    {id:'match',icon:'flow',label:'Run 3-way match',run:()=>navigate('supplier-invoice')},
    {id:'pay',icon:'coins',label:'Schedule payment',run:()=>navigate('payment-voucher')},
  ],
  onOpen:(i)=>openSINV(i),
});
function openSINV(i){ if(i.no==='SI-26-0615'){ navigate('supplier-invoice'); return; } openPurTxn('sinvoice', i); }

/* ---------------- PURCHASE RETURNS ---------------- */
makePurList({
  route:'purchase-returns', title:'Purchase Returns', unit:'returns',
  sub:'Returns of received goods to suppliers — damaged, wrong item, quality failure or over-delivery. Accepted returns update inventory and link to a supplier credit note.',
  rows:()=>DB.purchaseReturns, rowId:r=>r.no,
  chips:[['all','All'],['open','Open'],['returned','Returned'],['credited','Credited']],
  filterFn:(r,f)=>f==='open'?['Draft','Submitted','Approved'].includes(r.status):f==='returned'?r.status==='Returned':r.status==='Credited',
  kpis:(r)=>[
    {label:'Open returns', val:r.filter(x=>['Draft','Submitted','Approved'].includes(x.status)).length, f:'open'},
    {label:'Return value', val:money0(r.reduce((a,x)=>a+x.value,0))},
    {label:'Awaiting credit', val:r.filter(x=>x.status==='Returned').length, accent:true, f:'returned'},
    {label:'Credited', val:r.filter(x=>x.status==='Credited').length, f:'credited'},
  ],
  newBtn:{label:'New return', onClick:()=>toast('New return — link to a goods receipt','info')},
  columns:[
    {label:'Return', w:'minmax(140px,1.3fr)', render:r=>docNoCell(r.no, r.date)},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:r=>suppCell(r.supplier,r.code)},
    {label:'Against GRN', align:'l', w:'minmax(116px,1fr)', render:r=>`<span class="mono" style="font-size:12px">${esc(r.grn)}</span>`},
    {label:'Reason', align:'l', w:'minmax(170px,1.8fr)', render:r=>`<span class="li-subj">${esc(r.reason)}</span>`},
    {label:'Qty', align:'r', w:'minmax(60px,0.6fr)', render:r=>num(r.qty)},
    {label:'Value', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:r=>`<b class="tnum">${money0(r.value)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(116px,1.1fr)', render:r=>cap(r.status,PRET_TONE[r.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(r)=>[
    {id:'view',icon:'ext',label:'Open return',run:()=>openPurTxn('preturn',r)},
    {id:'approve',icon:'check',label:'Approve return',run:()=>toast(`${r.no} approved`,'ok')},
    {id:'cn',icon:'coins',label:'Issue credit note',run:()=>navigate('supplier-credit-notes')},
    {id:'reject',icon:'x',label:'Reject return',danger:true,sep:true,run:()=>toast(`${r.no} rejected`,'danger')},
  ],
  onOpen:(r)=>openPurTxn('preturn', r),
});

/* ---------------- SUPPLIER CREDIT NOTES ---------------- */
makePurList({
  route:'supplier-credit-notes', title:'Supplier Credit Notes', unit:'credit notes',
  sub:'Credit adjustments from suppliers — returns, overcharges, price or tax corrections. Applying a credit note reduces the outstanding payable balance.',
  rows:()=>DB.supplierCreditNotes, rowId:c=>c.no,
  chips:[['all','All'],['draft','Draft'],['applied','Applied'],['posted','Posted']],
  filterFn:(c,f)=>f==='draft'?c.status==='Draft':f==='applied'?c.status==='Applied':c.status==='Posted',
  kpis:(r)=>[
    {label:'Draft', val:r.filter(c=>c.status==='Draft').length, f:'draft'},
    {label:'Credit value', val:money0(r.reduce((a,c)=>a+c.amount,0))},
    {label:'Applied', val:r.filter(c=>c.status==='Applied').length, f:'applied'},
    {label:'Posted', val:r.filter(c=>c.status==='Posted').length, f:'posted'},
  ],
  newBtn:{label:'New credit note', onClick:()=>toast('New supplier credit note','info')},
  columns:[
    {label:'Credit note', w:'minmax(140px,1.2fr)', render:c=>docNoCell(c.no, c.date)},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:c=>suppCell(c.supplier,c.code)},
    {label:'Against', align:'l', w:'minmax(116px,1fr)', render:c=>`<span class="mono" style="font-size:12px">${esc(c.ref)}</span>`},
    {label:'Reason', align:'l', w:'minmax(180px,1.9fr)', render:c=>`<span class="li-subj">${esc(c.reason)}</span>`},
    {label:'Amount', align:'r', sortable:true, w:'minmax(100px,0.9fr)', render:c=>`<b class="tnum">${money0(c.amount)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:c=>cap(c.status,SCN_TONE[c.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(c)=>[
    {id:'view',icon:'ext',label:'Open credit note',run:()=>openPurTxn('screditnote',c)},
    {id:'apply',icon:'check',label:'Apply to AP',run:()=>toast(`${c.no} applied`,'ok')},
    {id:'pdf',icon:'filepdf',label:'Download PDF',sep:true,run:()=>toast('Credit note PDF generated','ok')},
  ],
  onOpen:(c)=>openPurTxn('screditnote', c),
});

/* ---------------- SUPPLIER DEBIT NOTES ---------------- */
makePurList({
  route:'supplier-debit-notes', title:'Supplier Debit Notes', unit:'debit notes',
  sub:'Claims raised against suppliers — short-supply penalties, damage claims, logistics recovery or manual adjustments. Posting increases the supplier receivable.',
  rows:()=>DB.supplierDebitNotes, rowId:d=>d.no,
  chips:[['all','All'],['draft','Draft'],['posted','Posted']],
  filterFn:(d,f)=>f==='draft'?d.status==='Draft':d.status==='Posted',
  kpis:(r)=>[
    {label:'Draft', val:r.filter(d=>d.status==='Draft').length, f:'draft'},
    {label:'Claim value', val:money0(r.reduce((a,d)=>a+d.amount,0))},
    {label:'Posted', val:r.filter(d=>d.status==='Posted').length, f:'posted'},
  ],
  newBtn:{label:'New debit note', onClick:()=>toast('New supplier debit note','info')},
  columns:[
    {label:'Debit note', w:'minmax(140px,1.2fr)', render:d=>docNoCell(d.no, d.date)},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:d=>suppCell(d.supplier,d.code)},
    {label:'Against', align:'l', w:'minmax(116px,1fr)', render:d=>`<span class="mono" style="font-size:12px">${esc(d.ref)}</span>`},
    {label:'Reason', align:'l', w:'minmax(180px,2fr)', render:d=>`<span class="li-subj">${esc(d.reason)}</span>`},
    {label:'Amount', align:'r', sortable:true, w:'minmax(100px,0.9fr)', render:d=>`<b class="tnum">${money0(d.amount)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:d=>cap(d.status,SDN_TONE[d.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(d)=>[
    {id:'view',icon:'ext',label:'Open debit note',run:()=>openPurTxn('sdebitnote',d)},
    {id:'post',icon:'check',label:'Post to finance',run:()=>toast(`${d.no} posted`,'ok')},
    {id:'pdf',icon:'filepdf',label:'Download PDF',sep:true,run:()=>toast('Debit note PDF generated','ok')},
  ],
  onOpen:(d)=>openPurTxn('sdebitnote', d),
});
