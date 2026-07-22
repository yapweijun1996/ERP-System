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
    ...(p.approval?[{id:'approve',icon:'flow',label:'Review approval',run:()=>navigate('po-approval',{purchaseOrderId:p.id})}]:[]),
    {id:'grn',icon:'receive',label:'Receive goods',run:()=>doReceiveGoods(p)},
    {id:'inv',icon:'receipt',label:'Post supplier invoice',run:()=>doPostSupplierInvoice(p)},
  ],
  onOpen:(p)=>openPO(p),
});
function openPO(p){ if(p.approval){navigate('po-approval',{purchaseOrderId:p.id});return;} toast('Opening '+p.no,'info'); }

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
  newBtn:{label:'Receive approved PO', onClick:()=>navigate('purchase-orders')},
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
function openGRN(g){ navigate('goods-receipt',{receiptId:g.id}); }

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
    {id:'match',icon:'flow',label:'Open 3-way match',run:()=>openSINV(i)},
    {id:'pay',icon:'coins',label:'Schedule payment',run:()=>navigate('payment-voucher')},
  ],
  onOpen:(i)=>openSINV(i),
});
function openSINV(i){ navigate('supplier-invoice',{invoiceId:i.id}); }

/* ---------------- PURCHASE RETURNS ---------------- */
function purchaseReturnCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{returns:'Purchase Returns',returnUnit:'returns',returnSub:'Request a return against a real goods receipt and unpaid supplier invoice. Shipping posts the inventory issue and supplier credit atomically.',credits:'Supplier Credit Notes',creditUnit:'credit notes',creditSub:'Posted credits created from shipped purchase returns, with direct invoice, inventory movement and GL traceability.',all:'All',requested:'Requested',credited:'Credited',rejected:'Rejected',open:'Open returns',returnValue:'Return value',newReturn:'New return',returnNo:'Return',supplier:'Supplier',againstGrn:'Against GRN',invoice:'Supplier invoice',reason:'Reason',qty:'Qty',value:'Value',status:'Status',view:'View details',shipCredit:'Ship & create credit',reject:'Reject return',date:'Return date',lines:'Return lines',item:'Item',unitCost:'Unit cost',net:'Net',tax:'Tax',total:'Total',cancel:'Cancel',create:'Create return',chooseSource:'Choose a received invoice',source:'Received invoice',noSource:'No unpaid supplier invoice with a goods receipt is available.',addQty:'Return qty',required:'Complete the required fields and enter at least one quantity.',created:'Purchase return created',shipped:'Goods returned and supplier credit posted',rejectedMsg:'Purchase return rejected',creditNo:'Credit note',noteDate:'Credit date',warehouse:'Warehouse',tracking:'Stock tracking',lot:'Lot',serial:'Serial',noTracking:'No eligible stock tracking record is available.',posted:'Posted',creditValue:'Credit value',againstReturn:'Against return',originalInvoice:'Original invoice',accounting:'AP debit · Inventory and input-tax credit',immutable:'Posted supplier credits are immutable and can only originate from a purchase return.'},
    ms:{returns:'Pulangan Belian',returnUnit:'pulangan',returnSub:'Mohon pulangan terhadap penerimaan barang dan invois pembekal belum dibayar. Penghantaran mempos keluaran stok dan kredit pembekal secara atomik.',credits:'Nota Kredit Pembekal',creditUnit:'nota kredit',creditSub:'Kredit dipos daripada pulangan belian yang dihantar, dengan jejak invois, pergerakan inventori dan lejar.',all:'Semua',requested:'Dimohon',credited:'Dikreditkan',rejected:'Ditolak',open:'Pulangan terbuka',returnValue:'Nilai pulangan',newReturn:'Pulangan baharu',returnNo:'Pulangan',supplier:'Pembekal',againstGrn:'Terhadap GRN',invoice:'Invois pembekal',reason:'Sebab',qty:'Kuantiti',value:'Nilai',status:'Status',view:'Lihat butiran',shipCredit:'Hantar & cipta kredit',reject:'Tolak pulangan',date:'Tarikh pulangan',lines:'Baris pulangan',item:'Item',unitCost:'Kos unit',net:'Bersih',tax:'Cukai',total:'Jumlah',cancel:'Batal',create:'Cipta pulangan',chooseSource:'Pilih invois diterima',source:'Invois diterima',noSource:'Tiada invois pembekal belum dibayar dengan penerimaan barang tersedia.',addQty:'Kuantiti pulangan',required:'Lengkapkan medan wajib dan masukkan sekurang-kurangnya satu kuantiti.',created:'Pulangan belian dicipta',shipped:'Barang dipulangkan dan kredit pembekal dipos',rejectedMsg:'Pulangan belian ditolak',creditNo:'Nota kredit',noteDate:'Tarikh kredit',warehouse:'Gudang',tracking:'Penjejakan stok',lot:'Lot',serial:'Siri',noTracking:'Tiada rekod penjejakan stok yang layak.',posted:'Dipos',creditValue:'Nilai kredit',againstReturn:'Terhadap pulangan',originalInvoice:'Invois asal',accounting:'Debit AP · Kredit inventori dan cukai input',immutable:'Kredit pembekal yang dipos tidak boleh diubah dan hanya berasal daripada pulangan belian.'},
    zh:{returns:'采购退货',returnUnit:'张退货单',returnSub:'基于真实收货单和未付款供应商发票申请退货；发货时原子执行库存出库并生成供应商贷项。',credits:'供应商贷项通知单',creditUnit:'张贷项单',creditSub:'由已发出的采购退货生成的已过账贷项，可直接追溯原发票、库存流水和总账。',all:'全部',requested:'待退货',credited:'已贷项',rejected:'已拒绝',open:'待处理退货',returnValue:'退货金额',newReturn:'新建退货',returnNo:'退货单',supplier:'供应商',againstGrn:'对应收货单',invoice:'供应商发票',reason:'退货原因',qty:'数量',value:'金额',status:'状态',view:'查看详情',shipCredit:'发出退货并生成贷项',reject:'拒绝退货',date:'退货日期',lines:'退货明细',item:'物料',unitCost:'单位成本',net:'未税金额',tax:'税额',total:'合计',cancel:'取消',create:'创建退货单',chooseSource:'选择已收货发票',source:'已收货发票',noSource:'没有同时具备收货单的未付款供应商发票。',addQty:'退货数量',required:'请填写必填项，并至少输入一个退货数量。',created:'采购退货单已创建',shipped:'货物已退回，供应商贷项已过账',rejectedMsg:'采购退货已拒绝',creditNo:'贷项单号',noteDate:'贷项日期',warehouse:'仓库',tracking:'库存追踪',lot:'批次',serial:'序列号',noTracking:'没有符合条件的库存追踪记录。',posted:'已过账',creditValue:'贷项金额',againstReturn:'对应退货单',originalInvoice:'原供应商发票',accounting:'借记应付账款 · 贷记库存及进项税',immutable:'已过账供应商贷项不可修改，且只能由采购退货生成。'},
    ja:{returns:'仕入返品',returnUnit:'件',returnSub:'実際の入荷と未払仕入先請求書に対して返品を申請し、出荷時に在庫払出と仕入先クレジットを同一取引で計上します。',credits:'仕入先クレジットノート',creditUnit:'件',creditSub:'出荷済み仕入返品から作成された計上済みクレジットを、請求書・在庫移動・GLまで追跡します。',all:'すべて',requested:'返品待ち',credited:'クレジット済み',rejected:'却下',open:'未処理返品',returnValue:'返品額',newReturn:'返品作成',returnNo:'返品',supplier:'仕入先',againstGrn:'入荷参照',invoice:'仕入先請求書',reason:'理由',qty:'数量',value:'金額',status:'状態',view:'詳細を表示',shipCredit:'返品出荷・クレジット作成',reject:'返品を却下',date:'返品日',lines:'返品明細',item:'品目',unitCost:'単位原価',net:'税抜',tax:'税',total:'合計',cancel:'キャンセル',create:'返品を作成',chooseSource:'入荷済み請求書を選択',source:'入荷済み請求書',noSource:'入荷に紐づく未払仕入先請求書がありません。',addQty:'返品数量',required:'必須項目と1件以上の返品数量を入力してください。',created:'仕入返品を作成しました',shipped:'返品を出荷し仕入先クレジットを計上しました',rejectedMsg:'仕入返品を却下しました',creditNo:'クレジット番号',noteDate:'クレジット日',warehouse:'倉庫',tracking:'在庫追跡',lot:'ロット',serial:'シリアル',noTracking:'利用可能な在庫追跡レコードがありません。',posted:'計上済み',creditValue:'クレジット額',againstReturn:'返品参照',originalInvoice:'元請求書',accounting:'AP借方・在庫/仮払税金貸方',immutable:'計上済み仕入先クレジットは変更不可で、仕入返品からのみ作成されます。'},
    vi:{returns:'Trả hàng mua',returnUnit:'phiếu trả',returnSub:'Yêu cầu trả theo phiếu nhận hàng và hóa đơn nhà cung cấp chưa thanh toán; khi xuất trả sẽ ghi xuất kho và tín dụng nhà cung cấp trong một giao dịch.',credits:'Phiếu tín dụng nhà cung cấp',creditUnit:'phiếu tín dụng',creditSub:'Tín dụng đã ghi sổ từ phiếu trả hàng, truy vết trực tiếp đến hóa đơn, biến động tồn kho và sổ cái.',all:'Tất cả',requested:'Chờ trả',credited:'Đã ghi tín dụng',rejected:'Đã từ chối',open:'Phiếu trả mở',returnValue:'Giá trị trả',newReturn:'Tạo phiếu trả',returnNo:'Phiếu trả',supplier:'Nhà cung cấp',againstGrn:'Theo GRN',invoice:'Hóa đơn NCC',reason:'Lý do',qty:'Số lượng',value:'Giá trị',status:'Trạng thái',view:'Xem chi tiết',shipCredit:'Xuất trả & tạo tín dụng',reject:'Từ chối trả',date:'Ngày trả',lines:'Dòng trả hàng',item:'Mặt hàng',unitCost:'Đơn giá vốn',net:'Trước thuế',tax:'Thuế',total:'Tổng',cancel:'Hủy',create:'Tạo phiếu trả',chooseSource:'Chọn hóa đơn đã nhận',source:'Hóa đơn đã nhận',noSource:'Không có hóa đơn nhà cung cấp chưa thanh toán kèm phiếu nhận hàng.',addQty:'SL trả',required:'Hoàn tất trường bắt buộc và nhập ít nhất một số lượng.',created:'Đã tạo phiếu trả hàng mua',shipped:'Đã xuất trả và ghi sổ tín dụng nhà cung cấp',rejectedMsg:'Đã từ chối phiếu trả hàng',creditNo:'Số phiếu tín dụng',noteDate:'Ngày tín dụng',warehouse:'Kho',tracking:'Theo dõi tồn kho',lot:'Lô',serial:'Sê-ri',noTracking:'Không có bản ghi theo dõi tồn kho phù hợp.',posted:'Đã ghi sổ',creditValue:'Giá trị tín dụng',againstReturn:'Theo phiếu trả',originalInvoice:'Hóa đơn gốc',accounting:'Nợ AP · Có tồn kho và thuế đầu vào',immutable:'Tín dụng nhà cung cấp đã ghi sổ là bất biến và chỉ được tạo từ phiếu trả hàng mua.'},
  };
  return packs[lang]||packs.en;
}

function purchaseReturnStatus(row){ const c=purchaseReturnCopy(); return c[row.rawStatus]||row.status; }

function eligiblePurchaseReturnInvoices(){
  return (DB.supplierInvoices||[]).filter(invoice=>invoice.rawStatus==='unpaid'&&DB.goodsReceipts.some(receipt=>receipt.orderId===invoice.orderId));
}

function nextPurchaseReturnNo(){ return nextSourcingNo(DB.purchaseReturns,'PRET'); }
function nextSupplierCreditNo(){ return nextSourcingNo(DB.supplierCreditNotes,'SCN'); }

function newPurchaseReturnModal(preselectedInvoiceId){
  const c=purchaseReturnCopy(), invoices=eligiblePurchaseReturnInvoices();
  if(!invoices.length){ toast(c.noSource,'info'); return; }
  const docNo=nextPurchaseReturnNo(), today=new Date().toISOString().slice(0,10);
  appModal({icon:'refresh',title:c.newReturn,width:760,body:`<div class="set-grid">
    <div class="fld"><span>${c.returnNo}</span><input value="${esc(docNo)}" readonly></div>
    <div class="fld"><span>${c.date} *</span><input id="pretDate" type="date" value="${today}"></div>
    <div class="fld" style="grid-column:1/-1"><span>${c.source} *</span><select id="pretInvoice">${invoices.map(invoice=>`<option value="${invoice.id}" ${invoice.id===preselectedInvoiceId?'selected':''}>${esc(invoice.no)} · ${esc(invoice.supplier)} · ${money(invoice.total,invoice.currency)}</option>`).join('')}</select></div>
    <div class="fld" style="grid-column:1/-1"><span>${c.reason} *</span><textarea id="pretReason" placeholder="${esc(c.reason)}"></textarea></div>
  </div><div class="panel"><div class="panel-h"><h3>${c.lines}</h3></div><div class="panel-body"><table class="lines"><thead><tr><th class="l">${c.item}</th><th>${c.qty}</th><th>${c.unitCost}</th><th>${c.addQty}</th></tr></thead><tbody id="pretLines"></tbody></table></div></div>`,actions:`${btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c.create,{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`});
  const render=()=>{
    const invoice=invoices.find(row=>row.id===Number($('#pretInvoice').value));
    const lines=invoice?(DB.purchaseOrderLines||[]).filter(line=>line.orderId===invoice.orderId):[];
    $('#pretLines').innerHTML=lines.map(line=>{
      const returned=(DB.purchaseReturns||[]).filter(ret=>ret.rawStatus!=='rejected').flatMap(ret=>ret.lines||[]).filter(retLine=>retLine.purchaseOrderLineId===line.id).reduce((sum,retLine)=>sum+retLine.qty,0);
      const remaining=Math.max(0,line.qty-returned), max=line.trackingType==='serial'?Math.min(1,remaining):remaining;
      return `<tr data-line="${line.id}"><td class="l"><b>${esc(line.name)}</b><small>${esc(line.sku)} · ${esc(line.trackingType)}</small></td><td class="tnum">${num(remaining)} / ${num(line.qty)}</td><td class="tnum">${money(line.unitCost,invoice.currency)}</td><td><input class="lineinput pretQty" type="number" min="0" max="${max}" step="${line.trackingType==='serial'?'1':'0.0001'}" value="0" ${max<=0?'disabled':''}></td></tr>`;
    }).join('')||`<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px">${c.noSource}</td></tr>`;
  };
  $('#pretInvoice').addEventListener('change',render); render();
  $('#modalEl [data-save]').addEventListener('click',async function(){
    const invoice=invoices.find(row=>row.id===Number($('#pretInvoice').value));
    const receipt=invoice&&DB.goodsReceipts.find(row=>row.orderId===invoice.orderId);
    const lines=$$('#pretLines tr[data-line]').map(row=>({purchaseOrderLineId:Number(row.dataset.line),qty:Number(row.querySelector('.pretQty').value)})).filter(line=>line.qty>0);
    const reason=$('#pretReason').value.trim();
    if(!invoice||!receipt||!reason||!$('#pretDate').value||!lines.length){ toast(c.required,'danger'); return; }
    this.disabled=true;
    try{
      await window.ErpSystemData.create('purchasing/purchase-returns',{docNo,goodsReceiptId:receipt.id,supplierInvoiceId:invoice.id,returnDate:$('#pretDate').value,reason,lines});
      closeModal(); toast(c.created,'ok'); navigate('purchase-returns');
    }catch(error){ this.disabled=false; toast(error&&error.message||c.required,'danger'); }
  });
}

function purchaseTrackingField(line,returnRow,c){
  if(line.trackingType==='none') return '';
  const data=DB.purchasingTracking||{bins:[],lots:[],serials:[],balances:[]};
  const balances=data.balances.filter(row=>row.productId===line.productId&&row.warehouseId===returnRow.warehouseId&&Number(row.qty)>0);
  const binById=new Map(data.bins.map(row=>[row.id,row]));
  let options;
  if(line.trackingType==='lot'){
    options=balances.filter(row=>row.lotId&&Number(row.qty)>=line.qty).map(row=>{ const lot=data.lots.find(item=>item.id===row.lotId); const bin=binById.get(row.binId); return {value:`${row.binId}|${row.lotId}|`,label:`${lot&&lot.lotNo||'#'+row.lotId} · ${bin&&bin.code||'#'+row.binId} · ${num(row.qty)}`}; });
  }else{
    options=balances.filter(row=>row.serialId&&Number(row.qty)>=1).map(row=>{ const serial=data.serials.find(item=>item.id===row.serialId); const bin=binById.get(row.binId); return {value:`${row.binId}||${row.serialId}`,label:`${serial&&serial.serialNo||'#'+row.serialId} · ${bin&&bin.code||'#'+row.binId}`}; });
  }
  return `<div class="fld" style="margin-top:8px"><span>${line.trackingType==='lot'?c.lot:c.serial} · ${esc(line.sku)}</span><select class="pretTracking" data-line="${line.id}"><option value="">${c.tracking}</option>${options.map(option=>`<option value="${option.value}">${esc(option.label)}</option>`).join('')}</select>${options.length?'':`<small style="color:var(--danger)">${c.noTracking}</small>`}</div>`;
}

function shipPurchaseReturnModal(returnRow){
  const c=purchaseReturnCopy(), creditDocNo=nextSupplierCreditNo(), today=new Date().toISOString().slice(0,10);
  appModal({icon:'coins',title:c.shipCredit,width:680,body:`<div class="set-grid"><div class="fld"><span>${c.creditNo}</span><input id="pretCreditNo" value="${esc(creditDocNo)}"></div><div class="fld"><span>${c.noteDate}</span><input id="pretNoteDate" type="date" value="${today}"></div></div><div class="panel"><div class="panel-h"><h3>${c.lines}</h3></div><div class="panel-body">${returnRow.lines.map(line=>`<div class="sumrow"><span><b>${esc(line.name)}</b><small>${esc(line.sku)} · ${num(line.qty)} ${esc(line.uom)}</small></span><b>${money(line.net+line.tax,returnRow.currency)}</b></div>${purchaseTrackingField(line,returnRow,c)}`).join('')}<div class="sumrow total"><span>${c.total}</span><b>${money(returnRow.value,returnRow.currency)}</b></div></div></div><div class="callout info" style="margin-top:12px">${ic('info')}<span>${c.accounting}</span></div>`,actions:`${btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c.shipCredit,{icon:'coins',cls:'primary',attrs:'data-save="1"'})}`});
  $('#modalEl [data-save]').addEventListener('click',async function(){
    const tracking=[];
    for(const line of returnRow.lines){
      if(line.trackingType==='none') continue;
      const select=$(`.pretTracking[data-line="${line.id}"]`), parts=select&&select.value.split('|');
      if(!parts||!select.value){ toast(c.noTracking,'danger'); return; }
      tracking.push({returnLineId:line.id,binId:Number(parts[0]),lotId:parts[1]?Number(parts[1]):undefined,serialId:parts[2]?Number(parts[2]):undefined});
    }
    const creditNo=$('#pretCreditNo').value.trim(), noteDate=$('#pretNoteDate').value;
    if(!creditNo||!noteDate){ toast(c.required,'danger'); return; }
    this.disabled=true;
    try{
      await window.ErpSystemData.action('purchasing/purchase-returns',returnRow.id,'ship-and-credit',{creditDocNo:creditNo,noteDate,tracking},`purchase-return-credit-${returnRow.id}-v${returnRow.version}`);
      closeModal(); toast(c.shipped,'ok'); navigate('supplier-credit-notes');
    }catch(error){ this.disabled=false; toast(error&&error.message||c.required,'danger'); }
  });
}

async function rejectPurchaseReturn(returnRow){
  const c=purchaseReturnCopy();
  try{
    await window.ErpSystemData.action('purchasing/purchase-returns',returnRow.id,'reject',{},`purchase-return-reject-${returnRow.id}-v${returnRow.version}`);
    closeModal(); toast(c.rejectedMsg,'ok'); navigate('purchase-returns');
  }catch(error){ toast(error&&error.message||c.required,'danger'); }
}

function openPurchaseReturnDetails(returnRow){
  const c=purchaseReturnCopy();
  appModal({icon:'refresh',title:`${returnRow.no} · ${returnRow.supplier}`,width:760,body:`<div class="docmeta" style="margin-bottom:16px"><div class="dm"><small>${c.againstGrn}</small><b>${esc(returnRow.grn)}</b></div><div class="dm"><small>${c.invoice}</small><b>${esc(returnRow.invoice)}</b></div><div class="dm"><small>${c.status}</small>${cap(purchaseReturnStatus(returnRow),PRET_TONE[returnRow.status]||'neutral')}</div></div><div class="sectitle">${c.reason}</div><p>${esc(returnRow.reason)}</p><table class="lines"><thead><tr><th class="l">${c.item}</th><th>${c.qty}</th><th>${c.unitCost}</th><th>${c.total}</th></tr></thead><tbody>${returnRow.lines.map(line=>`<tr><td class="l"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></td><td>${num(line.qty)}</td><td>${money(line.unitCost,returnRow.currency)}</td><td>${money(line.net+line.tax,returnRow.currency)}</td></tr>`).join('')}</tbody></table><div class="sumrow"><span>${c.net}</span><b>${money(returnRow.net,returnRow.currency)}</b></div><div class="sumrow"><span>${c.tax}</span><b>${money(returnRow.tax,returnRow.currency)}</b></div><div class="sumrow total"><span>${c.total}</span><b>${money(returnRow.value,returnRow.currency)}</b></div>`,actions:`${btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})}${returnRow.rawStatus==='requested'?btn(c.reject,{icon:'x',cls:'soft',attrs:`onclick="rejectPurchaseReturn(DB.purchaseReturns.find(r=>r.id===${returnRow.id}))"`}):''}${returnRow.rawStatus==='requested'?btn(c.shipCredit,{icon:'coins',cls:'primary',attrs:`onclick="closeModal();shipPurchaseReturnModal(DB.purchaseReturns.find(r=>r.id===${returnRow.id}))"`}):''}`});
}

makePurList({
  route:'purchase-returns', title:()=>purchaseReturnCopy().returns, unit:()=>purchaseReturnCopy().returnUnit, prepare:prepareCanonicalPurchasingData,
  sub:()=>purchaseReturnCopy().returnSub,
  rows:()=>DB.purchaseReturns, rowId:r=>r.no,
  chips:[['all',()=>purchaseReturnCopy().all],['requested',()=>purchaseReturnCopy().requested],['credited',()=>purchaseReturnCopy().credited],['rejected',()=>purchaseReturnCopy().rejected]],
  filterFn:(r,f)=>r.rawStatus===f,
  kpis:(r)=>[
    {label:()=>purchaseReturnCopy().open, val:r.filter(x=>x.rawStatus==='requested').length, accent:true, f:'requested'},
    {label:()=>purchaseReturnCopy().returnValue, val:money0(r.reduce((a,x)=>a+x.value,0))},
    {label:()=>purchaseReturnCopy().credited, val:r.filter(x=>x.rawStatus==='credited').length, f:'credited'},
    {label:()=>purchaseReturnCopy().rejected, val:r.filter(x=>x.rawStatus==='rejected').length, f:'rejected'},
  ],
  newBtn:{label:()=>purchaseReturnCopy().newReturn, onClick:()=>newPurchaseReturnModal()},
  columns:[
    {label:()=>purchaseReturnCopy().returnNo, w:'minmax(140px,1.3fr)', render:r=>docNoCell(r.no, r.date)},
    {label:()=>purchaseReturnCopy().supplier, align:'l', w:'minmax(160px,1.6fr)', render:r=>suppCell(r.supplier,r.code)},
    {label:()=>purchaseReturnCopy().againstGrn, align:'l', w:'minmax(116px,1fr)', render:r=>`<span class="mono" style="font-size:12px">${esc(r.grn)}</span>`},
    {label:()=>purchaseReturnCopy().reason, align:'l', w:'minmax(170px,1.8fr)', render:r=>`<span class="li-subj">${esc(r.reason)}</span>`},
    {label:()=>purchaseReturnCopy().qty, align:'r', w:'minmax(60px,0.6fr)', render:r=>num(r.qty)},
    {label:()=>purchaseReturnCopy().value, align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:r=>`<b class="tnum">${money(r.value,r.currency)}</b>`},
    {label:()=>purchaseReturnCopy().status, align:'l', cls:'cap-cell', w:'minmax(116px,1.1fr)', render:r=>cap(purchaseReturnStatus(r),PRET_TONE[r.status]||'neutral')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(r)=>[
    {id:'view',icon:'ext',label:purchaseReturnCopy().view,run:()=>openPurchaseReturnDetails(r)},
    ...(r.rawStatus==='requested'?[{id:'ship',icon:'coins',label:purchaseReturnCopy().shipCredit,run:()=>shipPurchaseReturnModal(r)},{id:'reject',icon:'x',label:purchaseReturnCopy().reject,danger:true,sep:true,run:()=>rejectPurchaseReturn(r)}]:[]),
  ],
  onOpen:(r)=>openPurchaseReturnDetails(r),
});

/* ---------------- SUPPLIER CREDIT NOTES ---------------- */
function openSupplierCreditDetails(credit){
  const c=purchaseReturnCopy();
  appModal({icon:'coins',title:`${credit.no} · ${credit.supplier}`,width:720,body:`<div class="docmeta" style="margin-bottom:16px"><div class="dm"><small>${c.againstReturn}</small><b>${esc(credit.ref)}</b></div><div class="dm"><small>${c.originalInvoice}</small><b>${esc((DB.purchaseReturns.find(row=>row.id===credit.returnId)||{}).invoice||'—')}</b></div><div class="dm"><small>${c.status}</small>${cap(c.posted,'teal')}</div></div><table class="lines"><thead><tr><th class="l">${c.item}</th><th>${c.qty}</th><th>${c.net}</th><th>${c.tax}</th></tr></thead><tbody>${credit.lines.map(line=>`<tr><td class="l"><b>${esc(line.name)}</b><small>${esc(line.sku)}</small></td><td>${num(line.qty)}</td><td>${money(line.net,credit.currency)}</td><td>${money(line.tax,credit.currency)}</td></tr>`).join('')}</tbody></table><div class="sumrow total"><span>${c.creditValue}</span><b>${money(credit.amount,credit.currency)}</b></div><div class="callout info" style="margin-top:12px">${ic('lock')}<span>${c.immutable}<br>${c.accounting}</span></div>`,actions:btn(c.cancel,{cls:'soft',attrs:'onclick="closeModal()"'})});
}

makePurList({
  route:'supplier-credit-notes', title:()=>purchaseReturnCopy().credits, unit:()=>purchaseReturnCopy().creditUnit, prepare:prepareCanonicalPurchasingData,
  sub:()=>purchaseReturnCopy().creditSub,
  rows:()=>DB.supplierCreditNotes, rowId:c=>c.no,
  chips:[['all',()=>purchaseReturnCopy().all],['posted',()=>purchaseReturnCopy().posted]],
  filterFn:(c,f)=>c.rawStatus===f,
  kpis:(r)=>[
    {label:()=>purchaseReturnCopy().posted, val:r.length, f:'posted'},
    {label:()=>purchaseReturnCopy().creditValue, val:money0(r.reduce((a,c)=>a+c.amount,0))},
  ],
  columns:[
    {label:()=>purchaseReturnCopy().creditNo, w:'minmax(140px,1.2fr)', render:c=>docNoCell(c.no, c.date)},
    {label:()=>purchaseReturnCopy().supplier, align:'l', w:'minmax(160px,1.6fr)', render:c=>suppCell(c.supplier,c.code)},
    {label:()=>purchaseReturnCopy().againstReturn, align:'l', w:'minmax(116px,1fr)', render:c=>`<span class="mono" style="font-size:12px">${esc(c.ref)}</span>`},
    {label:()=>purchaseReturnCopy().reason, align:'l', w:'minmax(180px,1.9fr)', render:c=>`<span class="li-subj">${esc(c.reason)}</span>`},
    {label:()=>purchaseReturnCopy().value, align:'r', sortable:true, w:'minmax(100px,0.9fr)', render:c=>`<b class="tnum">${money(c.amount,c.currency)}</b>`},
    {label:()=>purchaseReturnCopy().status, align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:()=>cap(purchaseReturnCopy().posted,'teal')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(c)=>[
    {id:'view',icon:'ext',label:purchaseReturnCopy().view,run:()=>openSupplierCreditDetails(c)},
  ],
  onOpen:(c)=>openSupplierCreditDetails(c),
});

/* ---------------- SUPPLIER DEBIT NOTES ---------------- */
function supplierDebitCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'Supplier Debit Notes',unit:'debit notes',sub:'Commercial claims against unpaid supplier invoices. Posting reduces AP without changing physical stock.',all:'All',draft:'Draft',posted:'Posted',claimValue:'Claim value',newNote:'New debit note',noteNo:'Debit note number',supplier:'Supplier',invoice:'Supplier invoice',against:'Against invoice',reason:'Reason',date:'Date',net:'Net amount',tax:'Tax',total:'Total',status:'Status',open:'Open debit note',post:'Post to finance',create:'Create draft',cancel:'Cancel',created:'Supplier debit note drafted',postedDone:'Supplier debit note posted',remaining:'Remaining payable',accounting:'Posting debits Accounts Payable and credits Purchase Variance / Input Tax. It creates no stock movement.',empty:'No canonical supplier debit notes yet.',selectInvoice:'Choose an unpaid supplier invoice',shortSupply:'Fictional short-supply claim'},
    ms:{title:'Nota Debit Pembekal',unit:'nota debit',sub:'Tuntutan komersial terhadap invois pembekal belum dibayar. Posting mengurangkan AP tanpa mengubah stok fizikal.',all:'Semua',draft:'Draf',posted:'Diposting',claimValue:'Nilai tuntutan',newNote:'Nota debit baharu',noteNo:'Nombor nota debit',supplier:'Pembekal',invoice:'Invois pembekal',against:'Terhadap invois',reason:'Sebab',date:'Tarikh',net:'Amaun bersih',tax:'Cukai',total:'Jumlah',status:'Status',open:'Buka nota debit',post:'Posting ke kewangan',create:'Cipta draf',cancel:'Batal',created:'Draf nota debit pembekal dicipta',postedDone:'Nota debit pembekal diposting',remaining:'Baki belum bayar',accounting:'Posting mendebit Akaun Belum Bayar dan mengkredit Varians Belian / Cukai Input. Tiada pergerakan stok.',empty:'Belum ada nota debit pembekal kanonik.',selectInvoice:'Pilih invois pembekal belum dibayar',shortSupply:'Tuntutan kekurangan bekalan fiksyen'},
    zh:{title:'供应商借项单',unit:'张借项单',sub:'针对未付供应商发票的商业索赔。过账会减少应付账款，但不会改变实物库存。',all:'全部',draft:'草稿',posted:'已过账',claimValue:'索赔金额',newNote:'新建借项单',noteNo:'借项单编号',supplier:'供应商',invoice:'供应商发票',against:'对应发票',reason:'原因',date:'日期',net:'未税金额',tax:'税额',total:'总额',status:'状态',open:'打开借项单',post:'过账至财务',create:'创建草稿',cancel:'取消',created:'供应商借项单草稿已创建',postedDone:'供应商借项单已过账',remaining:'剩余应付',accounting:'过账借记应付账款，贷记采购差异及进项税；不会生成库存流水。',empty:'目前没有标准供应商借项单。',selectInvoice:'选择未付供应商发票',shortSupply:'虚构短供索赔'},
    ja:{title:'仕入先デビットノート',unit:'件',sub:'未払仕入先請求書に対する商取引上の請求です。転記で買掛金を減額し、実在庫は変更しません。',all:'すべて',draft:'ドラフト',posted:'転記済',claimValue:'請求額',newNote:'デビットノートを作成',noteNo:'デビット番号',supplier:'仕入先',invoice:'仕入先請求書',against:'対象請求書',reason:'理由',date:'日付',net:'税抜金額',tax:'税額',total:'合計',status:'ステータス',open:'デビットノートを開く',post:'会計へ転記',create:'ドラフト作成',cancel:'キャンセル',created:'仕入先デビットノートを作成しました',postedDone:'仕入先デビットノートを転記しました',remaining:'未払残高',accounting:'買掛金を借記し、購入差異・仮払税を貸記します。在庫移動は作成しません。',empty:'標準仕入先デビットノートはありません。',selectInvoice:'未払仕入先請求書を選択',shortSupply:'架空の数量不足請求'},
    vi:{title:'Phiếu ghi nợ nhà cung cấp',unit:'phiếu',sub:'Yêu cầu thương mại theo hóa đơn nhà cung cấp chưa thanh toán. Ghi sổ giảm phải trả nhưng không thay đổi tồn kho vật lý.',all:'Tất cả',draft:'Nháp',posted:'Đã ghi sổ',claimValue:'Giá trị yêu cầu',newNote:'Tạo phiếu ghi nợ',noteNo:'Số phiếu ghi nợ',supplier:'Nhà cung cấp',invoice:'Hóa đơn nhà cung cấp',against:'Theo hóa đơn',reason:'Lý do',date:'Ngày',net:'Trước thuế',tax:'Thuế',total:'Tổng cộng',status:'Trạng thái',open:'Mở phiếu ghi nợ',post:'Ghi sổ tài chính',create:'Tạo bản nháp',cancel:'Hủy',created:'Đã tạo phiếu ghi nợ nhà cung cấp',postedDone:'Đã ghi sổ phiếu ghi nợ nhà cung cấp',remaining:'Còn phải trả',accounting:'Ghi Nợ Phải trả và Có Chênh lệch mua hàng / Thuế đầu vào. Không tạo biến động kho.',empty:'Chưa có phiếu ghi nợ nhà cung cấp chuẩn.',selectInvoice:'Chọn hóa đơn nhà cung cấp chưa thanh toán',shortSupply:'Yêu cầu thiếu hàng giả lập'},
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}
function nextSupplierDebitNo(){ return nextSourcingNo(DB.supplierDebitNotes,'SDN'); }
function openSupplierDebitDetails(note){
  const s=supplierDebitCopy();
  const invoice=DB.supplierInvoices.find(row=>row.id===note.supplierInvoiceId)||{};
  appModal({icon:'coins',title:`${note.no} · ${note.supplier}`,width:680,body:
    `<div class="docmeta" style="margin-bottom:16px"><div class="dm"><small>${esc(s('against'))}</small><b>${esc(note.ref)}</b></div><div class="dm"><small>${esc(s('date'))}</small><b>${esc(note.date)}</b></div><div class="dm"><small>${esc(s('status'))}</small>${cap(s(note.rawStatus),note.rawStatus==='posted'?'teal':'neutral')}</div></div>
    <div class="panel"><div class="panel-body">${txnDetails([[s('reason'),esc(note.reason)],[s('net'),money(note.net,note.currency)],[s('tax'),money(note.tax,note.currency)],[s('total'),money(note.amount,note.currency)],[s('remaining'),money(invoice.outstanding||0,note.currency)]])}</div></div>
    <div class="callout info" style="margin-top:12px">${ic('lock')}<span>${esc(s('accounting'))}</span></div>`,
    actions:btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})+(note.rawStatus==='draft'?btn(s('post'),{icon:'check',cls:'primary',attrs:`data-post-supplier-debit="${note.id}"`}):'')});
  document.querySelector('[data-post-supplier-debit]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{await window.ErpSystemData.action('purchasing/supplier-debit-notes',note.id,'post',{},`supplier-debit-${note.id}-post`);closeModal();toast(s('postedDone'),'ok');navigate('supplier-debit-notes');}
    catch(error){button.disabled=false;toast(error&&error.message||'Post failed','danger');}
  });
}
function newSupplierDebitModal(){
  const s=supplierDebitCopy();
  const invoices=DB.supplierInvoices.filter(row=>row.rawStatus==='unpaid'&&row.outstanding>0);
  const options=invoices.map(row=>`<option value="${row.id}">${esc(row.no)} · ${esc(row.supplier)} · ${esc(s('remaining'))} ${money(row.outstanding,row.currency)}</option>`).join('');
  appModal({icon:'coins',title:s('newNote'),width:600,body:
    `<div class="fldrow c2"><div class="fld"><span>${esc(s('noteNo'))}</span><input id="supplierDebitNo" value="${esc(nextSupplierDebitNo())}"></div><div class="fld"><span>${esc(s('date'))}</span><input id="supplierDebitDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div>
    <div class="fld"><span>${esc(s('invoice'))}</span><select id="supplierDebitInvoice"><option value="">${esc(s('selectInvoice'))}</option>${options}</select></div>
    <div class="fldrow c2"><div class="fld"><span>${esc(s('net'))}</span><input id="supplierDebitNet" type="number" min="0.01" step="0.01" value="10"></div><div class="fld"><span>${esc(s('reason'))}</span><input id="supplierDebitReason" value="${esc(s('shortSupply'))}"></div></div>`,
    actions:btn(s('cancel'),{cls:'soft',attrs:'data-supplier-debit-cancel'})+btn(s('create'),{icon:'plus',cls:'primary',attrs:'data-supplier-debit-create'})});
  document.querySelector('[data-supplier-debit-cancel]')?.addEventListener('click',closeModal);
  document.querySelector('[data-supplier-debit-create]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      const supplierInvoiceId=Number(document.querySelector('#supplierDebitInvoice').value);
      if(!supplierInvoiceId) throw new Error(s('selectInvoice'));
      await window.ErpSystemData.create('purchasing/supplier-debit-notes',{
        docNo:document.querySelector('#supplierDebitNo').value.trim(),supplierInvoiceId,
        noteDate:document.querySelector('#supplierDebitDate').value,
        reason:document.querySelector('#supplierDebitReason').value.trim(),
        netAmount:document.querySelector('#supplierDebitNet').value,
        taxCode:DB.company.country==='MY'?'SV':'SR',
      });
      closeModal();toast(s('created'),'ok');navigate('supplier-debit-notes');
    }catch(error){button.disabled=false;toast(error&&error.message||'Create failed','danger');}
  });
}
makePurList({
  route:'supplier-debit-notes', title:()=>supplierDebitCopy()('title'), unit:()=>supplierDebitCopy()('unit'), prepare:prepareCanonicalPurchasingData,
  sub:()=>supplierDebitCopy()('sub'),
  rows:()=>DB.supplierDebitNotes, rowId:d=>d.no,
  chips:[['all',()=>supplierDebitCopy()('all')],['draft',()=>supplierDebitCopy()('draft')],['posted',()=>supplierDebitCopy()('posted')]],
  filterFn:(d,f)=>d.rawStatus===f,
  kpis:(r)=>[
    {label:()=>supplierDebitCopy()('draft'), val:r.filter(d=>d.rawStatus==='draft').length, f:'draft'},
    {label:()=>supplierDebitCopy()('claimValue'), val:money0(r.reduce((a,d)=>a+d.amount,0))},
    {label:()=>supplierDebitCopy()('posted'), val:r.filter(d=>d.rawStatus==='posted').length, f:'posted'},
  ],
  newBtn:{label:()=>supplierDebitCopy()('newNote'), onClick:()=>newSupplierDebitModal()},
  columns:[
    {label:()=>supplierDebitCopy()('title'), w:'minmax(140px,1.2fr)', render:d=>docNoCell(d.no, d.date)},
    {label:()=>supplierDebitCopy()('supplier'), align:'l', w:'minmax(160px,1.6fr)', render:d=>suppCell(d.supplier,d.code)},
    {label:()=>supplierDebitCopy()('against'), align:'l', w:'minmax(116px,1fr)', render:d=>`<span class="mono" style="font-size:12px">${esc(d.ref)}</span>`},
    {label:()=>supplierDebitCopy()('reason'), align:'l', w:'minmax(180px,2fr)', render:d=>`<span class="li-subj">${esc(d.reason)}</span>`},
    {label:()=>supplierDebitCopy()('total'), align:'r', sortable:true, w:'minmax(100px,0.9fr)', render:d=>`<b class="tnum">${money(d.amount,d.currency)}</b>`},
    {label:()=>supplierDebitCopy()('status'), align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:d=>cap(supplierDebitCopy()(d.rawStatus),SDN_TONE[d.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(d)=>[
    {id:'view',icon:'ext',label:supplierDebitCopy()('open'),run:()=>openSupplierDebitDetails(d)},
    ...(d.rawStatus==='draft'?[{id:'post',icon:'check',label:supplierDebitCopy()('post'),run:()=>openSupplierDebitDetails(d)}]:[]),
  ],
  onOpen:(d)=>openSupplierDebitDetails(d),
});
