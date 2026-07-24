/* ============================================================
   ARIA ERP — screens: Purchasing procure-to-pay chain
   (Purchase Request → Goods Receipt → Supplier Invoice)
   ============================================================ */

function purTone(s){ return {Draft:'neutral',Submitted:'info',Approved:'accent',Ordered:'accent','QC hold':'warn',Received:'ok',Putaway:'ok','Pending Approval':'warn',Posted:'teal',Matched:'ok'}[s]||'neutral'; }

/* ---------------- PURCHASE REQUEST (document) ---------------- */
async function prepareRequisitionDetail(requisitionId){
  await prepareCanonicalPurchasingData();
  const req=requisitionId?DB.purchaseReqs.find(x=>x.id===requisitionId):DB.purchaseReqs[0];
  if(!req) throw new Error('No purchase requisition found for the active company.');
  return req;
}
async function approveRequisition(r,onDone){
  try{
    await window.ErpSystemData.action('purchasing/purchase-requisitions',r.id,'approve',{});
    toast(`${r.no} approved`,'ok');
    if(onDone) await onDone();
  }catch(error){
    toast((error&&error.message)||'Requisition could not be approved','danger');
  }
}
function rejectRequisitionModal(r,onDone){
  appModal({
    icon:'xc',
    title:`Reject ${r.no}?`,
    body:`<div class="fld err"><span>Rejection reason <span class="req">*</span></span><textarea id="rjReason" placeholder="Why this requisition is being rejected"></textarea><span class="hint bad">A rejection reason is required</span></div>`,
    actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Reject',{icon:'x',cls:'danger-solid',attrs:'data-save="1"'})}`,
  });
  const saveBtn=$('#modalEl').querySelector('[data-save]');
  saveBtn.addEventListener('click',async()=>{
    const rejectionReason=$('#rjReason').value.trim();
    if(!requireField(rejectionReason,'A rejection reason is required','#rjReason')) return;
    saveBtn.disabled=true;
    try{
      await window.ErpSystemData.action('purchasing/purchase-requisitions',r.id,'reject',{rejectionReason});
      closeModal();
      toast(`${r.no} rejected`,'danger');
      if(onDone) await onDone();
    }catch(error){
      saveBtn.disabled=false;
      toast((error&&error.message)||'Requisition could not be rejected','danger');
    }
  });
}
function reqStepper(d){
  if(d.rawStatus==='rejected'){
    return `<div class="stepper">
      <div class="step done"><span class="sdot">${ic('check')}</span>Submitted</div><span class="stepline"></span>
      <div class="step" style="color:var(--danger)"><span class="sdot" style="background:var(--danger);color:#fff">${ic('x')}</span>Rejected</div>
    </div>`;
  }
  const labels=['Submitted','Approved','Converted'];
  const idx=d.status==='Converted'?2:d.status==='Approved'?1:0;
  return `<div class="stepper">${labels.map((lbl,i)=>{
    const cls=i<idx?'done':(i===idx?'current':'');
    const dot=i<idx?ic('check'):(i===idx?ic('clock'):'');
    return `<div class="step ${cls}"><span class="sdot">${dot}</span>${esc(lbl)}</div>`+(i<labels.length-1?`<span class="stepline ${i<idx?'done':''}"></span>`:'');
  }).join('')}</div>`;
}
SCREENS['purchase-request'] = async function(root, params){
  const requestedId=params&&params.requisitionId?Number(params.requisitionId):null;
  const d=await prepareRequisitionDetail(requestedId);
  const convertedOrder=d.convertedOrderId?DB.purchaseOrders.find(p=>p.id===d.convertedOrderId):null;
  const lineRows=d.lineItems.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
    <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.sku)}</small></td>
    <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td>
    <td class="tnum">${money(l.estimatedUnitCost)}</td>
    <td class="tnum"><b>${money(l.qty*l.estimatedUnitCost)}</b></td></tr>`).join('');

  function outcomePanel(){
    if(d.status==='Converted') return indicator({tone:'accent',icon:'checkc',label:'Converted to PO',value:d.ref,sub:`This requisition was converted to purchase order ${esc(d.ref)}.`});
    if(d.rawStatus==='rejected') return indicator({tone:'danger',icon:'xc',label:'Rejected',value:d.decidedAt||'—',sub:d.rejectionReason?esc(d.rejectionReason):'No reason recorded.'});
    if(d.status==='Approved') return indicator({tone:'ok',icon:'checkc',label:'Approved',value:d.decidedAt||'—',sub:'Ready to convert to a purchase order.'});
    return indicator({tone:'warn',icon:'clock',label:'Awaiting approval',value:d.date,sub:'This requisition has not been decided yet.'});
  }

  root.innerHTML=`<div class="content full"><section class="master" data-screen-label="Purchase Requisition ${esc(d.no)}"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,{label:'Purchasing',route:'purchasing-home'},{label:'Requisitions',route:'purchase-requisitions'},{cur:d.no}])}
    ${typeof purNav==='function'?'<div style="padding:0 0 4px">'+purNav('purchase-requisitions')+'</div>':''}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('list')}Purchase Requisition <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.requestedBy)} · ${esc(d.dept)} · needed by ${esc(d.need)}</div></div>
        <div class="dactions">${cap(d.status,PR_TONE[d.status])}${btn('Print',{icon:'print',cls:'soft'})}</div>
      </div>
      ${reqStepper(d)}
      <div class="docmeta">
        <div class="dm"><small>Requested by</small><b>${esc(d.requestedBy)}</b></div>
        <div class="dm"><small>Department</small><b>${esc(d.dept)}</b></div>
        <div class="dm"><small>Date</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>Needed by</small><b>${esc(d.need)}</b></div>
        <div class="dm"><small>Priority</small><b>${esc(d.priority)}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        ${d.justification?`<div class="panel"><div class="panel-h"><h3>Justification</h3></div><div class="panel-body" style="padding-top:12px">
          <div class="risk warn">${ic('warn')}<div><small>${esc(d.justification)}</small></div></div>
        </div></div>`:''}
        <div class="panel">
          <div class="panel-h"><h3>Requested items</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lineItems.length} lines</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Est. unit</th><th>Est. amount</th></tr></thead><tbody>${lineRows}</tbody>
          <tfoot><tr><td></td><td class="l" style="font-weight:600">Estimated total</td><td></td><td></td><td class="tnum"><b>${money(d.value)}</b></td></tr></tfoot></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Outcome</div>${outcomePanel()}</div>
        ${convertedOrder?`<div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>${relatedDocs([{no:d.ref,label:'Purchase order (from requisition)',meta:money(convertedOrder.total,convertedOrder.currency),status:convertedOrder.status}])}</div>`:''}
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div class="grow"></div>
      ${d.rawStatus==='submitted'?btn('Reject',{icon:'x',cls:'danger',attrs:'data-act="reject"'})+btn('Approve',{icon:'check',cls:'primary',sm:false,attrs:'data-act="approve"'}):''}
      ${d.status==='Approved'?btn('Convert to PO',{icon:'cart',cls:'primary',sm:false,attrs:'data-act="convert"'}):''}
      ${d.status==='Converted'?btn('View purchase order',{icon:'cart',cls:'primary',sm:false,attrs:'data-act="viewpo"'}):''}
    </div>
  </div></div></section></div>`;

  const approveBtn=root.querySelector('[data-act="approve"]');
  approveBtn&&approveBtn.addEventListener('click',()=>approveRequisition(d,async()=>{ navigate('purchase-request',{requisitionId:d.id}); }));
  const rejectBtn=root.querySelector('[data-act="reject"]');
  rejectBtn&&rejectBtn.addEventListener('click',()=>rejectRequisitionModal(d,async()=>{ navigate('purchase-request',{requisitionId:d.id}); }));
  const convertBtn=root.querySelector('[data-act="convert"]');
  convertBtn&&convertBtn.addEventListener('click',()=>navigate('new-purchase-order',{requisitionId:d.id}));
  const viewPoBtn=root.querySelector('[data-act="viewpo"]');
  viewPoBtn&&viewPoBtn.addEventListener('click',()=>{
    if(convertedOrder) openPO(convertedOrder); else navigate('purchase-orders');
  });
};

/* ---------------- GOODS RECEIPT / GRN (document) ---------------- */
SCREENS['goods-receipt'] = function(root){
  const d=DB.grn0188;
  const short=d.lines.filter(l=>l.received<l.ordered);
  const toQC=d.lines.filter(l=>l.dispo==='To QC');
  const lineRows=d.lines.map((l,i)=>{
    const bo=l.ordered-l.received;
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}</small></td>
      <td class="tnum">${num(l.ordered)} ${esc(l.uom)}</td>
      <td class="tnum"><b>${num(l.received)}</b></td>
      <td class="tnum" style="color:${bo?'var(--danger)':'var(--muted)'}">${bo?num(bo):'—'}</td>
      <td class="l">${l.dispo==='To QC'?cap('To QC','warn'):cap('Putaway','ok')}</td></tr>`;
  }).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,'Purchasing','Goods Receipt',{cur:d.no}])}
    ${typeof purNav==='function'?'<div style="padding:0 0 4px">'+purNav('goods-receipt')+'</div>':''}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('receive')}Goods Receipt <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.supplier)} · against ${esc(d.po)} · ${esc(d.carrier)}</div></div>
        <div class="dactions">${cap(d.status,purTone(d.status))}${btn('Print GRN',{icon:'print',cls:'soft'})}</div>
      </div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Draft</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Received</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('clock')}</span>QC</div><span class="stepline"></span>
        <div class="step"><span class="sdot"></span>Putaway</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Supplier</small><div class="partner">${profileAvatar({name:d.supplier,cls:'pav',size:26})}<b>${esc(d.supplier)}</b></div></div>
        <div class="dm"><small>Receipt date</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>Warehouse</small><b>${esc(d.warehouse)}</b></div>
        <div class="dm"><small>Received by</small><b>${esc(d.receiver)}</b></div>
        <div class="dm"><small>PO reference</small><b>${esc(d.po)}</b></div>
      </div>
    </div>
    <div class="alert warn" style="margin:0 0 14px"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${toQC.length} line to inspect, ${short.length} short.</b> Control Module PCB v3 is quarantined for incoming QC; Bearing 6206 received 600 of 1,000 — ${num(short[0].ordered-short[0].received)} remain on the PO.</span>
      ${btn('Open inspection',{icon:'checkc',cls:'soft',attrs:'onclick="navigate(\'qc-inspection\')"'})}</div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>Received lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lines.length} lines</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Ordered</th><th>Received</th><th>Short</th><th class="l">Disposition</th></tr></thead><tbody>${lineRows}</tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Carrier &amp; waybill</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Carrier</span><input value="${esc(d.carrier)}" readonly></div>
            <div class="fld"><span>Waybill</span><input value="${esc(d.waybill)}" readonly></div>
            <div class="fld"><span>Received by</span><input value="${esc(d.receiver)}" readonly></div>
          </div>
        </div></div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Receipt</div>
          <div class="sumrow"><span class="sk2">Lines received</span><span class="sv tnum">${d.lines.length}</span></div>
          <div class="sumrow"><span class="sk2">To QC inspection</span><span class="sv tnum">${toQC.length}</span></div>
          <div class="sumrow"><span class="sk2">Short / backorder</span><span class="sv tnum">${short.length}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Quality hold</div>
          ${indicator({tone:'warn',icon:'shield',label:'PCB v3 quarantined',value:'300 ea',sub:'Incoming inspection required before stock is available to issue.'})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:d.po,label:'Purchase order',meta:'Shenzhen Microcircuit',status:'Pending Approval'},
            {no:'SI-26-0615',label:'Supplier invoice (3-way match)',meta:'awaiting approval',status:'Pending Approval'},
            {no:'QC-26-0140',label:'Incoming inspection',meta:'PCB v3 · 300 ea',status:'Scheduled'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${d.lines.length} lines booked to ${esc(d.warehouse)} · 1 line on QC hold.</div>
      <div class="grow"></div>
      ${btn('Send PCB to QC',{icon:'checkc',cls:'soft',attrs:'onclick="navigate(\'qc-inspection\')"'})}
      ${btn('Match to invoice',{icon:'receipt',cls:'soft',attrs:'onclick="navigate(\'supplier-invoice\')"'})}
      ${btn('Post receipt & putaway',{icon:'check',cls:'primary',sm:false,attrs:'onclick="toast(\'GRN-26-0188 posted · stock updated, PCB held for QC\',\'ok\')"'})}
    </div>
  </div></div></section></div>`;
};

/* ---------------- SUPPLIER INVOICE / 3-WAY MATCH (document) ---------------- */
SCREENS['supplier-invoice'] = function(root){
  const d=DB.suppInvoice0615;
  const sub=d.lines.reduce((s,l)=>s+l.invQty*l.invPrice,0);
  const varTotal=d.lines.reduce((s,l)=>s+l.invQty*(l.invPrice-l.poPrice),0);
  const tax=sub*d.taxRate, total=sub+tax;
  function lineMatch(l){
    if(l.invPrice!==l.poPrice) return cap('Price var','warn');
    if(l.recvQty<l.poQty) return cap('Part recv','info');
    return cap('Matched','ok');
  }
  const lineRows=d.lines.map((l,i)=>{
    const v=l.invQty*(l.invPrice-l.poPrice);
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}</small></td>
      <td class="tnum">${num(l.poQty)}</td>
      <td class="tnum">${num(l.recvQty)}</td>
      <td class="tnum"><b>${num(l.invQty)}</b></td>
      <td class="tnum">${money(l.poPrice)}</td>
      <td class="tnum" style="${l.invPrice!==l.poPrice?'color:var(--warn)':''}">${money(l.invPrice)}</td>
      <td class="tnum" style="color:${v?'var(--danger)':'var(--muted)'}">${v?'+'+money(v):'—'}</td>
      <td class="l">${lineMatch(l)}</td></tr>`;
  }).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,'Purchasing','Supplier Invoices',{cur:d.no}])}
    ${typeof purNav==='function'?'<div style="padding:0 0 4px">'+purNav('supplier-invoice')+'</div>':''}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('receipt')}Supplier Invoice <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.supplier)} · ref ${esc(d.suppRef)} · due ${esc(d.due)}</div></div>
        <div class="dactions">${cap(d.status,purTone(d.status))}${btn('Download',{icon:'filepdf',cls:'soft'})}</div>
      </div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Draft</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('clock')}</span>Matched</div><span class="stepline"></span>
        <div class="step"><span class="sdot"></span>Approved</div><span class="stepline"></span>
        <div class="step"><span class="sdot"></span>Posted to AP</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Supplier</small><div class="partner">${profileAvatar({name:d.supplier,cls:'pav',size:26})}<b>${esc(d.supplier)}</b></div></div>
        <div class="dm"><small>Invoice date</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>Due date</small><b>${esc(d.due)}</b></div>
        <div class="dm"><small>Terms</small><b>${esc(d.terms)} · ${esc(d.currency)}</b></div>
        <div class="dm"><small>Matches</small><b>${esc(d.po)} · ${esc(d.grn)}</b></div>
      </div>
    </div>
    <div class="alert warn" style="margin:0 0 14px"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>Price variance ${'+'+money(varTotal)} needs approval.</b> Control Module PCB v3 invoiced at ${money(120)}/ea vs PO ${money(118)}/ea. PO and GRN quantities otherwise match.</span></div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>3-way match — PO · GRN · Invoice</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lines.length} lines</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>PO qty</th><th>Recv'd</th><th>Inv qty</th><th>PO price</th><th>Inv price</th><th>Var</th><th class="l">Match</th></tr></thead><tbody>${lineRows}</tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Audit trail</h3></div><div class="panel-body">${auditTrail([
          {kind:'current',when:'Jun 5 · 14:05',what:'Submitted for variance approval',who:'A. Costa'},
          {kind:'sys',when:'Jun 5 · 14:02',what:'Auto-matched against GRN-26-0188',who:'System',change:{field:'PCB unit price',old:'$118.00',new:'$120.00',reason:'Supplier price increase — not in PO'}},
          {kind:'add',when:'Jun 5 · 11:40',what:'Supplier invoice captured (OCR)',who:'A. Costa'},
        ])}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">
          <div class="sumrow"><span class="sk2">Subtotal</span><span class="sv tnum">${money(sub)}</span></div>
          <div class="sumrow"><span class="sk2">of which price variance</span><span class="sv tnum" style="color:var(--warn)">+${money(varTotal)}</span></div>
          <div class="sumrow"><span class="sk2">Tax (6% GST)</span><span class="sv tnum">${money(tax)}</span></div>
          <div class="sumrow total"><span class="sk2">Invoice total</span><span class="sv tnum">${money(total)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Match status</div>
          ${indicator({tone:'warn',icon:'flow',label:'2 of 3 lines clean',value:'1 variance',sub:`Quantities match GRN; ${money(varTotal)} price variance on PCB awaiting approval.`})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:d.po,label:'Purchase order',meta:'Shenzhen Microcircuit',status:'Pending Approval'},
            {no:d.grn,label:'Goods receipt',meta:'received Jun 4',status:'On hold'},
            {no:'PV-26-0203',label:'Payment voucher (on approval)',meta:'Net 30',status:'Pending Approval'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Posting debits expense/inventory and credits AP for <b style="color:var(--fg)">${money(total)}</b>.</div>
      <div class="grow"></div>
      ${btn('Dispute variance',{icon:'comment',cls:'soft',attrs:'onclick="toast(\'Variance query sent to supplier\',\'warn\')"'})}
      ${btn('Reject',{icon:'x',cls:'danger',attrs:'onclick="toast(\'Invoice rejected\',\'danger\')"'})}
      ${btn('Approve & post to AP',{icon:'check',cls:'primary',sm:false,attrs:'data-act="post"'})}
    </div>
  </div></div></section></div>`;
  root.querySelector('[data-act="post"]').addEventListener('click',()=>{
    appModal({
      icon: 'book',
      title: `Approve variance & post ${d.no}?`,
      body: `<div class="risk warn" style="margin:0 0 10px">${ic('warn')}<div><b>Price variance of ${money(varTotal)} will be accepted.</b><small>Posting credits Accounts Payable ${money(total)} and is eligible for the next payment run via a payment voucher.</small></div></div>`,
      actions: `${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Post & schedule payment',{icon:'check',cls:'primary',attrs:'onclick="closeModal();navigate(\'payment-voucher\');setTimeout(()=>toast(\'SI-26-0615 posted to AP · added to payment voucher\',\'ok\'),200)"'})}`,
    });
  });
};
