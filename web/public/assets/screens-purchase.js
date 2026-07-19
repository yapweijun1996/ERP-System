/* ============================================================
   ARIA ERP — screens: Purchasing procure-to-pay chain
   (Purchase Request → Goods Receipt → Supplier Invoice)
   ============================================================ */

function purTone(s){ return {Draft:'neutral',Submitted:'info',Approved:'accent',Ordered:'accent','QC hold':'warn',Received:'ok',Putaway:'ok','Pending Approval':'warn',Posted:'teal',Matched:'ok'}[s]||'neutral'; }

/* ---------------- PURCHASE REQUEST (document) ---------------- */
SCREENS['purchase-request'] = function(root){
  const d=DB.pr0142;
  const est=d.lines.reduce((s,l)=>s+l.qty*l.est,0);
  const lineRows=d.lines.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
    <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}</small></td>
    <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td>
    <td class="tnum">${money(l.est)}</td>
    <td class="l">${l.need==='Urgent'?cap('Urgent','danger'):cap('Stock','neutral')}</td>
    <td class="tnum"><b>${money(l.qty*l.est)}</b></td></tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,'Purchasing','Purchase Requests',{cur:d.no}])}
    ${typeof purNav==='function'?'<div style="padding:0 0 4px">'+purNav('purchase-request')+'</div>':''}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('cart')}Purchase Request <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.requestedBy)} · needed by ${esc(d.need)}</div></div>
        <div class="dactions">${cap(d.status,purTone(d.status))}${btn('Print',{icon:'print',cls:'soft'})}</div>
      </div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Draft</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Submitted</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Approved</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('check')}</span>Ordered</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Requested by</small><b>${esc(d.requestedBy.split(' · ')[0])}</b></div>
        <div class="dm"><small>Date</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>Needed by</small><b>${esc(d.need)}</b></div>
        <div class="dm"><small>Warehouse</small><b>${esc(d.warehouse)}</b></div>
        <div class="dm"><small>Cost centre</small><b>${esc(d.costCentre)}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Justification</h3></div><div class="panel-body" style="padding-top:12px">
          <div class="risk warn">${ic('warn')}<div><b>Blocks production</b><small>${esc(d.justification)}</small></div></div>
        </div></div>
        <div class="panel">
          <div class="panel-h"><h3>Requested items</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lines.length} lines</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Est. unit</th><th class="l">Priority</th><th>Est. amount</th></tr></thead><tbody>${lineRows}</tbody>
          <tfoot><tr><td></td><td class="l" style="font-weight:600">Estimated total</td><td></td><td></td><td></td><td class="tnum"><b>${money(est)}</b></td></tr></tfoot></table>
        </div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Outcome</div>
          ${indicator({tone:'accent',icon:'checkc',label:'Approved & ordered',value:'PO-26-0291',sub:'Sourced to Shenzhen Microcircuit · expected Jun 22.'})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:'PO-26-0291',label:'Purchase order (from request)',meta:'$88.5k',status:'Pending Approval'},
            {no:'WO-26-0081',label:'Driving work order',meta:'blocked on PCB',status:'On Hold'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">This request was <b style="color:var(--fg)">converted</b> to purchase order PO-26-0291.</div>
      <div class="grow"></div>
      ${btn('Duplicate',{icon:'copy',cls:'soft',attrs:'onclick="toast(\'Request duplicated as draft\',\'info\')"'})}
      ${btn('View purchase order',{icon:'cart',cls:'primary',sm:false,attrs:'onclick="navigate(\'po-approval\')"'})}
    </div>
  </div></div></section></div>`;
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
        <div class="dm"><small>Supplier</small><div class="partner"><span class="pav">SM</span><b>${esc(d.supplier)}</b></div></div>
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
        <div class="dm"><small>Supplier</small><div class="partner"><span class="pav">SM</span><b>${esc(d.supplier)}</b></div></div>
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
