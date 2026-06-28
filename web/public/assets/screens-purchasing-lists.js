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

  if(kind==='requisition'){
    Object.assign(C,{ icon:'list', title:'Purchase Requisition', active:'purchase-requisitions', crumbLabel:'Requisitions', crumbRoute:'purchase-requisitions',
      subtitle:`${esc(r.requestedBy)} · ${esc(r.dept)} · needed ${esc(r.need)}`, tone:PR_TONE[r.status],
      meta:[['Requested by',`<b>${esc(r.requestedBy)}</b>`],['Department',`<b>${esc(r.dept)}</b>`],['Date',`<b>${esc(r.date)}</b>`],['Needed by',`<b>${esc(r.need)}</b>`],['Priority',`<b>${esc(r.priority)}</b>`]],
      main: txnDetails([['Lines',String(r.lines)],['Estimated value',money0(r.value)],['Priority',esc(r.priority)],['Converted to',r.ref?esc(r.ref):'—']]) +
        txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:r.requestedBy},{kind:'add',when:r.date,what:`Requisition raised by ${esc(r.requestedBy)}`,who:r.dept}]),
      summary: sumCard(null,[['Lines',String(r.lines)],['Est. value',money0(r.value),'total']]) +
        (r.ref?`<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:r.ref,label:'Purchase order',meta:'converted',status:'Pending Approval'}])}</div>`:''),
      footer: (['Draft','Submitted','Pending Approval'].includes(r.status)?btn('Approve',{icon:'check',cls:'soft',attrs:`onclick="toast('${r.no} approved','ok')"`}):'') + btn('Convert to RFQ',{icon:'comment',cls:'soft',attrs:`onclick="navigate('rfqs')"`}) + btn('Convert to PO',{icon:'cart',cls:'primary',sm:false,attrs:`onclick="navigate('new-purchase-order')"`}) });
  }
  else if(kind==='rfq'){
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
        <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
          <div class="grow"></div>${C.footer}
        </div>
      </div></div>
    </div>
  </section></div>`;
};

/* ---------------- SUPPLIERS (master data) ---------------- */
makePurList({
  route:'suppliers', title:'Suppliers', unit:'suppliers',
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
  newBtn:{label:'New supplier', onClick:()=>toast('New supplier — master record form opens','info')},
  columns:[
    {label:'Code', w:'minmax(88px,0.8fr)', render:s=>`<b class="docnum">${esc(s.code)}</b>`},
    {label:'Supplier', align:'l', w:'minmax(170px,1.7fr)', render:s=>suppCell(s.name)},
    {label:'Category', align:'l', w:'minmax(140px,1.4fr)', render:s=>`<span class="li-subj">${esc(s.category)}</span>`},
    {label:'Country', align:'l', w:'minmax(90px,0.9fr)', render:s=>`<span style="color:var(--muted)">${esc(s.country)}</span>`},
    {label:'Terms', align:'l', w:'minmax(80px,0.8fr)', render:s=>`${esc(s.terms)} · ${esc(s.currency)}`},
    {label:'Lead', align:'r', w:'minmax(60px,0.6fr)', render:s=>`${s.leadTime}d`},
    {label:'Rating', align:'r', sortable:true, w:'minmax(70px,0.7fr)', render:s=>`<b class="tnum">${s.rating.toFixed(1)}</b>`},
    {label:'Balance', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:s=>`<b class="tnum">${money0(s.balance)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(96px,0.9fr)', render:s=>s.approved?cap('Approved','ok'):cap('Review','warn')},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(s)=>[
    {id:'view',icon:'ext',label:'Open supplier',run:()=>toast(`Opening ${s.name}`,'info')},
    {id:'po',icon:'cart',label:'New purchase order',run:()=>navigate('new-purchase-order')},
    {id:'perf',icon:'shield',label:'View performance',run:()=>navigate('vendor-performance')},
    {id:'hold',icon:'x',label:s.approved?'Suspend supplier':'Approve supplier',danger:s.approved,sep:true,run:()=>toast(`${s.name} ${s.approved?'suspended':'approved'}`,s.approved?'danger':'ok')},
  ],
  onOpen:(s)=>toast(`Opening ${s.name}`,'info'),
});

/* ---------------- PURCHASE REQUISITIONS ---------------- */
makePurList({
  route:'purchase-requisitions', title:'Purchase Requisitions', unit:'requisitions',
  sub:'Internal purchase requests from warehouse, production, projects and admin. Approve, then convert to an RFQ or directly to a purchase order.',
  rows:()=>DB.purchaseReqs, rowId:r=>r.no,
  chips:[['all','All'],['open','Open'],['approval','Pending approval'],['approved','Approved'],['converted','Converted']],
  filterFn:(r,f)=>f==='open'?['Draft','Submitted','Pending Approval'].includes(r.status):f==='approval'?r.status==='Pending Approval':f==='approved'?r.status==='Approved':r.status==='Converted',
  kpis:(r)=>[
    {label:'Open requisitions', val:r.filter(x=>['Draft','Submitted','Pending Approval'].includes(x.status)).length, f:'open'},
    {label:'Pending approval', val:r.filter(x=>x.status==='Pending Approval').length, accent:true, f:'approval'},
    {label:'Est. value', val:money0(r.filter(x=>x.status!=='Rejected').reduce((a,x)=>a+x.value,0))},
    {label:'Converted', val:r.filter(x=>x.status==='Converted').length, f:'converted'},
  ],
  newBtn:{label:'New requisition', onClick:()=>toast('New requisition — line capture opens','info')},
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
    {id:'approve',icon:'check',label:'Approve',run:()=>toast(`${r.no} approved`,'ok')},
    {id:'rfq',icon:'comment',label:'Convert to RFQ',run:()=>navigate('rfqs')},
    {id:'po',icon:'cart',label:'Convert to PO',run:()=>navigate('new-purchase-order')},
    {id:'reject',icon:'x',label:'Reject',danger:true,sep:true,run:()=>toast(`${r.no} rejected`,'danger')},
  ],
  onOpen:(r)=>openReq(r),
});
function openReq(r){ if(r.no==='PR-26-0142'){ navigate('purchase-request'); return; } openPurTxn('requisition', r); }

/* ---------------- RFQs ---------------- */
makePurList({
  route:'rfqs', title:'Requests for Quotation', unit:'RFQs',
  sub:'Pricing requests sent to one or more suppliers. Track responses, then compare quotations side-by-side to select the best supplier.',
  rows:()=>DB.rfqs, rowId:r=>r.no,
  chips:[['all','All'],['draft','Draft'],['sent','Sent'],['responded','Responded'],['closed','Closed']],
  filterFn:(r,f)=>f==='draft'?r.status==='Draft':f==='sent'?['Sent','Partially Responded'].includes(r.status):f==='responded'?r.status==='Responded':r.status==='Closed',
  kpis:(r)=>[
    {label:'Open RFQs', val:r.filter(x=>!['Closed','Cancelled'].includes(x.status)).length},
    {label:'Awaiting response', val:r.filter(x=>['Sent','Partially Responded'].includes(x.status)).length, accent:true, f:'sent'},
    {label:'Fully responded', val:r.filter(x=>x.status==='Responded').length, f:'responded'},
    {label:'Closed', val:r.filter(x=>x.status==='Closed').length, f:'closed'},
  ],
  newBtn:{label:'New RFQ', onClick:()=>toast('New RFQ — select suppliers & items','info')},
  columns:[
    {label:'RFQ', w:'minmax(140px,1.2fr)', render:r=>docNoCell(r.no, r.date)},
    {label:'Subject', align:'l', w:'minmax(200px,2.4fr)', render:r=>`<span class="li-subj">${esc(r.subject)}</span>`},
    {label:'From PR', align:'l', w:'minmax(110px,1fr)', render:r=>r.pr?`<span class="mono" style="font-size:12px">${esc(r.pr)}</span>`:'<span style="color:var(--faint)">—</span>'},
    {label:'Suppliers', align:'c', w:'minmax(86px,0.9fr)', render:r=>miniProgress(r.responded, r.suppliers)},
    {label:'Response by', align:'l', w:'minmax(96px,0.9fr)', render:r=>`<span style="color:var(--muted)">${esc(r.due)}</span>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(130px,1.2fr)', render:r=>cap(r.status,RFQ_TONE[r.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(r)=>[
    {id:'view',icon:'ext',label:'View RFQ',run:()=>openPurTxn('rfq',r)},
    {id:'compare',icon:'flow',label:'Compare quotes',run:()=>openQuoteCompare(r.no)},
    {id:'quotes',icon:'receipt',label:'View quotations',run:()=>navigate('supplier-quotations')},
    {id:'close',icon:'x',label:'Close RFQ',danger:true,sep:true,run:()=>toast(`${r.no} closed`,'danger')},
  ],
  onOpen:(r)=>openPurTxn('rfq', r),
});

/* ---------------- SUPPLIER QUOTATIONS + comparison ---------------- */
makePurList({
  route:'supplier-quotations', title:'Supplier Quotations', unit:'quotations',
  sub:'Supplier responses to RFQs. Compare price, lead-time, terms and supplier performance, then select the winning quotation and convert it to a purchase order.',
  rows:()=>DB.supplierQuotes, rowId:q=>q.no,
  chips:[['all','All'],['received','Received'],['selected','Selected'],['rejected','Rejected'],['converted','Converted']],
  filterFn:(q,f)=>f==='received'?q.status==='Received':f==='selected'?q.status==='Selected':f==='rejected'?q.status==='Rejected':q.status==='Converted',
  kpis:(r)=>[
    {label:'Open quotes', val:r.filter(q=>q.status==='Received').length, f:'received'},
    {label:'Quoted value', val:money0(r.reduce((a,q)=>a+q.total,0))},
    {label:'Selected', val:r.filter(q=>q.status==='Selected').length, accent:true, f:'selected'},
    {label:'Converted', val:r.filter(q=>q.status==='Converted').length, f:'converted'},
  ],
  actions: btn('Compare RFQ-26-0061',{icon:'flow',cls:'soft',attrs:'onclick="openQuoteCompare(\'RFQ-26-0061\')"'}),
  columns:[
    {label:'Quote', w:'minmax(128px,1.1fr)', render:q=>docNoCell(q.no, q.rfq)},
    {label:'Supplier', align:'l', w:'minmax(160px,1.6fr)', render:q=>suppCell(q.supplier,q.code)},
    {label:'Item', align:'l', w:'minmax(150px,1.6fr)', render:q=>`<span class="li-subj">${esc(q.item)}</span>`},
    {label:'Unit price', align:'r', sortable:true, w:'minmax(90px,0.9fr)', render:q=>`<b class="tnum">${money(q.price,q.currency)}</b>`},
    {label:'Lead', align:'r', sortable:true, w:'minmax(56px,0.6fr)', render:q=>`${q.leadTime}d`},
    {label:'Valid until', align:'l', w:'minmax(94px,0.9fr)', render:q=>`<span style="color:var(--muted)">${esc(q.validity)}</span>`},
    {label:'Total', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:q=>`<b class="tnum">${money(q.total,q.currency)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:q=>cap(q.status,SQ_TONE[q.status])},
    {label:'', align:'c', w:'52px', render:()=>rowMenuBtn()},
  ],
  rowMenu:(q)=>[
    {id:'view',icon:'ext',label:'View quotation',run:()=>openPurTxn('squote',q)},
    {id:'compare',icon:'flow',label:'Compare on RFQ',run:()=>openQuoteCompare(q.rfq)},
    {id:'select',icon:'check',label:'Select & convert to PO',run:()=>navigate('new-purchase-order')},
    {id:'reject',icon:'x',label:'Reject quote',danger:true,sep:true,run:()=>toast(`${q.no} rejected`,'danger')},
  ],
  onOpen:(q)=>openPurTxn('squote', q),
});

/* quotation comparison (modal) */
function openQuoteCompare(rfqNo){
  const qs=DB.supplierQuotes.filter(q=>q.rfq===rfqNo);
  if(!qs.length){ toast('No quotations to compare for '+rfqNo,'info'); return; }
  const rfq=DB.rfqs.find(r=>r.no===rfqNo);
  const best={ price:Math.min(...qs.map(q=>q.price)), lead:Math.min(...qs.map(q=>q.leadTime)), total:Math.min(...qs.map(q=>q.total)) };
  const cols=qs.map(q=>{
    const win = q.price===best.price;
    return `<div class="cmpcol ${win?'cmpcol-best':''}">
      <div class="cmp-h">${win?`<span class="cmp-badge">Best price</span>`:''}<b>${esc(q.supplier)}</b><small>${esc(q.code)} · ${esc(q.no)}</small></div>
      <div class="cmp-row"><span>Unit price</span><b class="${q.price===best.price?'cmp-win':''}">${money(q.price,q.currency)}</b></div>
      <div class="cmp-row"><span>Total</span><b class="${q.total===best.total?'cmp-win':''}">${money(q.total,q.currency)}</b></div>
      <div class="cmp-row"><span>Lead time</span><b class="${q.leadTime===best.lead?'cmp-win':''}">${q.leadTime} days</b></div>
      <div class="cmp-row"><span>Terms</span><b>${esc(q.terms)}</b></div>
      <div class="cmp-row"><span>Warranty</span><b>${esc(q.warranty)}</b></div>
      <div class="cmp-row"><span>Valid until</span><b>${esc(q.validity)}</b></div>
      <div class="cmp-foot">${btn('Select',{icon:'check',cls:win?'primary':'soft',sm:false,attrs:`onclick="closeModal();navigate('new-purchase-order')"`})}</div>
    </div>`;
  }).join('');
  appModal({ icon:'flow', title:`Compare quotations — ${rfqNo}`, width:'min(880px,94vw)',
    body:`<div style="color:var(--muted);font-size:13px;margin-bottom:12px">${rfq?esc(rfq.subject)+' · ':''}${qs.length} responses · best price highlighted.</div><div class="cmpgrid">${cols}</div>`,
    actions: btn('Close',{cls:'soft',attrs:'onclick="closeModal()"'}) });
  const mEl=document.getElementById('modalEl'); if(mEl){ mEl.style.width='min(900px,95vw)'; mEl.style.maxWidth='95vw'; }
}

/* ---------------- PURCHASE ORDERS (rebuilt on the factory) ---------------- */
/* PO_TONE → TONES.po (defined in data-core.js) */
makePurList({
  route:'purchase-orders', active:'purchase-orders', title:'Purchase Orders', unit:'orders',
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
    {id:'grn',icon:'receive',label:'Create goods receipt',run:()=>navigate('goods-receipt')},
    {id:'dup',icon:'copy',label:'Duplicate',run:()=>toast(`${p.no} duplicated as draft`,'info')},
    {id:'cancel',icon:'x',label:'Cancel PO',danger:true,sep:true,run:()=>toast(`${p.no} cancelled`,'danger')},
  ],
  onOpen:(p)=>openPO(p),
});
function openPO(p){ if(p.no==='PO-26-0291'){ navigate('po-approval'); return; } toast('Opening '+p.no,'info'); }

/* ---------------- GOODS RECEIPTS ---------------- */
makePurList({
  route:'goods-receipts', active:'goods-receipts', title:'Goods Receipts', unit:'receipts',
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
  newBtn:{label:'Capture invoice', onClick:()=>toast('Capture supplier invoice — OCR or manual','info')},
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
    {id:'reject',icon:'x',label:'Reject invoice',danger:true,sep:true,run:()=>toast(`${i.no} rejected`,'danger')},
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
