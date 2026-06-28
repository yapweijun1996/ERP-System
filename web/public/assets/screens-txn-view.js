/* ============================================================
   ARIA ERP — unified transaction detail view (SSOT)
   One full-page document layout for every sales transaction so
   "view details" is consistent — no more modal for some and a
   full page for others. Records with rich seeded documents keep
   their dedicated screen; everything else renders here.
   openTxn(kind, record) -> navigate('txn-view')
   ============================================================ */
let TXN_OPEN = null;
function openTxn(kind, rec){ TXN_OPEN = { kind, rec }; navigate('txn-view'); }

function txnInitials(name){ const p=String(name||'').trim().split(/\s+/); return (((p[0]||'')[0]||'')+((p[1]||'')[0]||'')).toUpperCase(); }
function txnPartner(name){ return `<div class="partner"><span class="pav">${esc(txnInitials(name))}</span><b>${esc(name)}</b></div>`; }
function txnStepper(stages, curIdx, terminal){
  if(terminal) return `<div class="stepper"><div class="step danger"><span class="sdot">${ic('x')}</span>${esc(terminal)}</div></div>`;
  return `<div class="stepper">`+stages.map((s,i)=>{
    const st=i<curIdx?'done':i===curIdx?'current':''; const dot=i<curIdx?ic('check'):'';
    return `${i?`<span class="stepline ${i<=curIdx?'done':''}"></span>`:''}<div class="step ${st}"><span class="sdot">${dot}</span>${esc(s)}</div>`;
  }).join('')+`</div>`;
}
function txnActivity(events){ return `<div class="panel"><div class="panel-h">${ic('history')}<h3>Activity</h3></div><div class="panel-body">${auditTrail(events)}</div></div>`; }
function txnDetails(rows){
  return `<div class="panel"><div class="panel-h">${ic('list')}<h3>Details</h3></div><div class="panel-body">${rows.map(([k,v])=>`<div class="field"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`).join('')}</div></div>`;
}
function sumCard(title, rows){
  return `<div class="sumcard">${title?`<div class="sectitle" style="margin-top:0">${esc(title)}</div>`:''}${rows.map(r=>`<div class="sumrow ${r[2]||''}"><span class="sk2">${esc(r[0])}</span><span class="sv tnum">${r[1]}</span></div>`).join('')}</div>`;
}

/* per-kind configuration builder */
function buildTxn(kind, r){
  const C = { kind, no:r.no||r.rep, icon:'receipt', title:'Transaction', active:'sales-home', crumbLabel:'Sales', crumbRoute:'sales-home',
    subtitle:'', status:r.status, tone:'neutral', stepper:'', meta:[], main:'', summary:'', footer:'' };

  if(kind==='enquiry'){
    const terminal = r.status==='Lost'?'Lost':r.status==='On hold'?null:null;
    Object.assign(C,{ icon:'comment', title:'Enquiry', active:'enquiries', crumbLabel:'Enquiries', crumbRoute:'enquiries',
      subtitle:`${esc(r.cust)} · ${esc(r.channel)} · owner ${esc(r.owner)}`, tone:ENQ_TONE[r.status],
      stepper: txnStepper(['New','Quoted','Converted'], {New:0,Quoted:1,Converted:2,'On hold':0}[r.status]??0, r.status==='Lost'?'Lost':null),
      meta:[['Customer',txnPartner(r.cust)],['Date',`<b>${esc(r.date)}</b>`],['Channel',`<b>${esc(r.channel)}</b>`],['Owner',`<b>${esc(r.owner)}</b>`],['Est. value',`<b>${money0(r.value)}</b>`]],
      main: `<div class="panel"><div class="panel-h">${ic('comment')}<h3>Request</h3></div><div class="panel-body"><div style="font-size:14px;color:var(--fg);line-height:1.55">${esc(r.subject)}</div></div></div>`
        + txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:r.owner},{kind:'add',when:r.date,what:`Enquiry ${esc(r.no)} logged via ${esc(r.channel)}`,who:r.owner}]),
      summary: sumCard('Opportunity',[['Estimated value',money0(r.value),'total']]) + `<div class="sumcard">${indicator({tone:'info',icon:'handshake',label:'Stage',value:r.status,sub:'Convert a qualified enquiry into a formal quotation.'})}</div>`,
      footer: btn('Mark lost',{icon:'x',cls:'soft',attrs:`onclick="toast('${esc(r.no)} marked lost','danger')"`}) + btn('Convert to quotation',{icon:'receipt',cls:'primary',sm:false,attrs:`onclick="navigate('quotations');setTimeout(()=>toast('Quotation drafted from ${esc(r.no)}','ok'),160)"`}) });
  }
  else if(kind==='quotation'){
    const term = r.status==='Rejected'?'Rejected':r.status==='Expired'?'Expired':null;
    Object.assign(C,{ icon:'receipt', title:'Quotation', active:'quotations', crumbLabel:'Quotations', crumbRoute:'quotations',
      subtitle:`${esc(r.cust)} · owner ${esc(r.owner)} · valid until ${esc(r.valid)}`, tone:QUO_TONE[r.status],
      stepper: txnStepper(['Draft','Sent','Accepted','Converted'], {Draft:0,Sent:1,Accepted:2,Converted:3}[r.status]??0, term),
      meta:[['Customer',txnPartner(r.cust)],['Quote date',`<b>${esc(r.date)}</b>`],['Valid until',`<b>${esc(r.valid)}</b>`],['Owner',`<b>${esc(r.owner)}</b>`],['Win probability',`<b>${r.prob}%</b>`]],
      main: txnDetails([['Customer reference','—'],['Currency',DB.company.currency],['Win probability',r.prob+'%']]) + txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:r.owner},{kind:'add',when:r.date,what:`Quotation ${esc(r.no)} created`,who:r.owner}]),
      summary: sumCard(null,[['Quote total',money(r.total),'total']]) + `<div class="sumcard">${indicator({tone:r.prob>=75?'ok':r.prob>=40?'info':'warn',icon:'target',label:'Win probability',value:r.prob+'%',sub:`Valid until ${esc(r.valid)} · ${esc(r.status)}.`,pct:r.prob})}</div>`,
      footer: btn('Delete',{cls:'soft',attrs:`onclick="deleteQuotation({no:'${r.no}',cust:'${esc(r.cust)}',total:${r.total}})"`}) + btn('Edit',{icon:'edit',cls:'soft',attrs:`onclick="navigate('new-quotation',{edit:'${r.no}'})"`}) + btn('Convert to order',{icon:'bag',cls:'primary',sm:false,attrs:`onclick="navigate('new-sales-order')"`}) });
  }
  else if(kind==='delivery'){
    const pct=Math.round(r.done/Math.max(1,r.items)*100);
    Object.assign(C,{ icon:'truck', title:'Delivery Order', active:'delivery-orders', crumbLabel:'Deliveries', crumbRoute:'delivery-orders',
      subtitle:`${esc(r.cust)} · from ${esc(r.so)} · ${esc(r.carrier)}`, tone:DO_TONE[r.status],
      stepper: txnStepper(['Draft','Picking','Packed','Shipped','Delivered'], {Draft:0,Picking:1,Packed:2,Shipped:3,'Partially Delivered':3,Delivered:4}[r.status]??0, r.status==='Cancelled'?'Cancelled':null),
      meta:[['Customer',txnPartner(r.cust)],['From order',`<b>${esc(r.so)}</b>`],['Warehouse',`<b>${esc(r.warehouse)}</b>`],['Carrier',`<b>${esc(r.carrier)}</b>`],['Ship date',`<b>${esc(r.date)}</b>`]],
      main: txnDetails([['Lines shipped',`${r.done} of ${r.items}`],['Warehouse',esc(r.warehouse)],['Carrier',esc(r.carrier)]]) + txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Warehouse'},{kind:'add',when:r.date,what:`Delivery ${esc(r.no)} created from ${esc(r.so)}`,who:'J. Okafor'}]),
      summary: `<div class="sumcard">${indicator({tone:r.done>=r.items?'ok':'warn',icon:'truck',label:`${r.done}/${r.items} lines shipped`,value:pct+'%',sub:r.done>=r.items?'All lines shipped in full.':'Partial shipment — balance on backorder.',pct})}</div>`
        + `<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:r.so,label:'Sales order',meta:esc(r.cust),status:'Approved'}])}</div>`,
      footer: btn('Print packing list',{icon:'print',cls:'soft',attrs:`onclick="toast('Packing list sent to printer','info')"`}) + btn('Create invoice',{icon:'receipt',cls:'primary',sm:false,attrs:`onclick="navigate('sales-invoices')"`}) });
  }
  else if(kind==='invoice'){
    const bal=r.total-r.paid, paidPct=Math.round(r.paid/r.total*100);
    Object.assign(C,{ icon:'receipt', title:'Sales Invoice', active:'sales-invoices', crumbLabel:'Invoices', crumbRoute:'sales-invoices',
      subtitle:`${esc(r.cust)} · from ${esc(r.so)} · due ${esc(r.due)}`, tone:INV_TONE[r.status],
      stepper: txnStepper(['Draft','Posted','Part-paid','Paid'], {Draft:0,Posted:1,'Partially Paid':2,Overdue:2,Paid:3}[r.status]??0, r.status==='Cancelled'?'Cancelled':null),
      meta:[['Customer',txnPartner(r.cust)],['Invoice date',`<b>${esc(r.date)}</b>`],['Due date',`<b>${esc(r.due)}</b>`],['From order',`<b>${esc(r.so)}</b>`],['Terms',`<b>Net 30 · ${DB.company.currency}</b>`]],
      main: txnDetails([['From order',esc(r.so)],['Invoice date',esc(r.date)],['Due date',esc(r.due)]]) + txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Finance'},{kind:'add',when:r.date,what:`Invoice ${esc(r.no)} posted to AR`,who:'A. Costa'}]),
      summary: sumCard(null,[['Invoice total',money(r.total)],['Paid',money(r.paid)],['Balance due',money(bal),'total']]) + `<div class="sumcard">${indicator({tone:bal<=0?'ok':r.status==='Overdue'?'danger':'warn',icon:'coins',label:bal<=0?'Settled':'Outstanding',value:bal<=0?'Paid':money0(bal),sub:`${paidPct}% paid · due ${esc(r.due)}.`,pct:paidPct})}</div>`
        + `<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:r.so,label:'Sales order',meta:esc(r.cust),status:'Approved'}])}</div>`,
      footer: btn('Download PDF',{icon:'filepdf',cls:'soft',attrs:`onclick="toast('Invoice PDF generated','ok')"`}) + (bal>0?btn('Record payment',{icon:'coins',cls:'primary',sm:false,attrs:`onclick="toast('Receipt recorded against ${r.no}','ok')"`}):btn('Send receipt',{icon:'send',cls:'soft',attrs:`onclick="toast('Receipt sent','info')"`})) });
  }
  else if(kind==='return'){
    Object.assign(C,{ icon:'refresh', title:'Sales Return', active:'sales-returns', crumbLabel:'Returns', crumbRoute:'sales-returns',
      subtitle:`${esc(r.cust)} · against ${esc(r.ref)} · ${esc(r.reason)}`, tone:RMA_TONE[r.status],
      stepper: txnStepper(['Requested','Approved','Received','Inspected','Credited'], {Requested:0,Approved:1,Received:2,Inspected:3,Credited:4,Closed:4}[r.status]??0, r.status==='Rejected'?'Rejected':null),
      meta:[['Customer',txnPartner(r.cust)],['Against',`<b>${esc(r.ref)}</b>`],['Reason',`<b>${esc(r.reason)}</b>`],['Qty',`<b>${num(r.qty)}</b>`],['Disposition',`<b>${esc(r.disposition)}</b>`]],
      main: txnDetails([['Against',esc(r.ref)],['Reason',esc(r.reason)],['Disposition',esc(r.disposition)],['Owner',esc(r.owner)]]) + txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:r.owner},{kind:'add',when:r.date,what:`Return ${esc(r.no)} raised against ${esc(r.ref)}`,who:r.owner}]),
      summary: sumCard('Return',[['Qty',num(r.qty)+' ea'],['Value',money(r.value),'total']]) + `<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:r.ref,label:'Source document',meta:esc(r.cust)}])}</div>`,
      footer: btn('Reject',{icon:'x',cls:'soft',attrs:`onclick="toast('${r.no} rejected','danger')"`}) + btn('Issue credit note',{icon:'coins',cls:'primary',sm:false,attrs:`onclick="navigate('credit-notes')"`}) });
  }
  else if(kind==='credit'){
    Object.assign(C,{ icon:'coins', title:'Credit Note', active:'credit-notes', crumbLabel:'Credit Notes', crumbRoute:'credit-notes',
      subtitle:`${esc(r.cust)} · against ${esc(r.ref)} · ${esc(r.reason)}`, tone:CN_TONE[r.status],
      stepper: txnStepper(['Draft','Posted','Applied'], {Draft:0,Posted:1,Applied:2}[r.status]??0, null),
      meta:[['Customer',txnPartner(r.cust)],['Date',`<b>${esc(r.date)}</b>`],['Against',`<b>${esc(r.ref)}</b>`],['Reason',`<b>${esc(r.reason)}</b>`]],
      main: txnDetails([['Against invoice',esc(r.ref)],['Reason',esc(r.reason)],['Applied',r.applied?money(r.applied):'—']]) + txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Finance'},{kind:'add',when:r.date,what:`Credit note ${esc(r.no)} raised`,who:'J. Okafor'}]),
      summary: sumCard(null,[['Credit amount',money(r.amount)],['Applied',r.applied?money(r.applied):'—'],['Unapplied',money(r.amount-r.applied),'total']]) + `<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:r.ref,label:'Sales invoice',meta:esc(r.cust)}])}</div>`,
      footer: btn('Download PDF',{icon:'filepdf',cls:'soft',attrs:`onclick="toast('Credit note PDF generated','ok')"`}) + btn('Apply to invoice',{icon:'check',cls:'primary',sm:false,attrs:`onclick="toast('${r.no} applied to ${r.ref}','ok')"`}) });
  }
  else if(kind==='debit'){
    Object.assign(C,{ icon:'coins', title:'Debit Note', active:'debit-notes', crumbLabel:'Debit Notes', crumbRoute:'debit-notes',
      subtitle:`${esc(r.cust)} · ${esc(r.reason)}`, tone:DN_TONE[r.status],
      stepper: txnStepper(['Draft','Posted'], {Draft:0,Posted:1}[r.status]??0, null),
      meta:[['Customer',txnPartner(r.cust)],['Date',`<b>${esc(r.date)}</b>`],['Reference',`<b>${esc(r.ref)}</b>`],['Reason',`<b>${esc(r.reason)}</b>`]],
      main: txnDetails([['Reference',esc(r.ref)],['Reason',esc(r.reason)]]) + txnActivity([{kind:'current',when:r.date,what:`Status — <b>${esc(r.status)}</b>`,who:'Finance'},{kind:'add',when:r.date,what:`Debit note ${esc(r.no)} raised`,who:'Finance'}]),
      summary: sumCard(null,[['Charge amount',money(r.amount),'total']]),
      footer: btn('Download PDF',{icon:'filepdf',cls:'soft',attrs:`onclick="toast('Debit note PDF generated','ok')"`}) + btn('Post to finance',{icon:'check',cls:'primary',sm:false,attrs:`onclick="toast('${r.no} posted','ok')"`}) });
  }
  else if(kind==='commission'){
    Object.assign(C,{ no:r.rep, icon:'coins', title:'Commission', active:'sales-commission', crumbLabel:'Commission', crumbRoute:'sales-commission',
      subtitle:`${esc(r.rep)} · ${esc(r.period)} · ${esc(r.basis)}`, tone:COMM_TONE[r.status],
      stepper: txnStepper(['Calculated','Reviewed','Approved'], {Pending:0,Review:1,Approved:2}[r.status]??0, null),
      meta:[['Salesperson',txnPartner(r.rep)],['Period',`<b>${esc(r.period)}</b>`],['Basis',`<b>${esc(r.basis)}</b>`],['Rate',`<b>${esc(r.rate)}</b>`]],
      main: txnDetails([['Eligible sales',money0(r.sales)],['Rate',esc(r.rate)],['Basis',esc(r.basis)]]) + txnActivity([{kind:'current',when:r.period,what:`Status — <b>${esc(r.status)}</b>`,who:'Finance'},{kind:'add',when:r.period,what:`Commission calculated for ${esc(r.rep)}`,who:'System'}]),
      summary: sumCard(null,[['Eligible sales',money0(r.sales)],['Rate',esc(r.rate)],['Commission',money(r.commission),'total']]),
      footer: btn('Export',{icon:'download',cls:'soft',attrs:`onclick="toast('Commission report exported','ok')"`}) + (r.status!=='Approved'?btn('Approve',{icon:'check',cls:'primary',sm:false,attrs:`onclick="toast('${esc(r.rep)} ${esc(r.period)} commission approved','ok')"`}):'') });
  }
  return C;
}

SCREENS['txn-view'] = function(root){
  if(!TXN_OPEN){ navigate('sales-home'); return; }
  const C = buildTxn(TXN_OPEN.kind, TXN_OPEN.rec);
  root.innerHTML = `<div class="content full"><section class="master" data-screen-label="${esc(C.title)} ${esc(C.no)}">
    <div class="scrollarea">
      <div class="pagehead">${crumbs([DB.company.name,{label:'Sales',route:'sales-home'},{label:C.crumbLabel,route:C.crumbRoute},{cur:C.no}])}${typeof salesNav==='function'?salesNav(C.active):''}</div>
      <div class="docwrap"><div class="docpage" style="padding-top:4px">
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic(C.icon)}${esc(C.title)} <span class="dnum">${esc(C.no)}</span></div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">${C.subtitle}</div></div>
            <div class="dactions">${cap(C.status,C.tone)}${btn('Print',{icon:'print',cls:'soft'})}</div>
          </div>
          ${C.stepper}
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
