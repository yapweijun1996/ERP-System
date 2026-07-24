/* ============================================================
   ARIA ERP — screens: Sales order-to-cash chain
   (Quotation → Delivery Order → Sales Invoice)
   ============================================================ */

function lineExt(l){ return l.qty*l.price*(1-(l.disc||0)/100); }
function salesTone(s){ return {Draft:'neutral',Sent:'info',Accepted:'accent',Converted:'accent','In transit':'info',Delivered:'ok',Posted:'teal','Partially Paid':'info',Paid:'ok',Overdue:'danger'}[s]||'neutral'; }
function docLineRows(lines){
  return lines.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
    <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}</small></td>
    <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td>
    <td class="tnum">${money(l.price)}</td>
    <td class="tnum">${l.disc?`<span style="color:var(--warn)">${l.disc}%</span>`:'—'}</td>
    <td class="tnum"><b>${money(lineExt(l))}</b></td></tr>`).join('');
}
function docTotals(d){
  const sub=d.lines.reduce((s,l)=>s+lineExt(l),0);
  const discGiven=d.lines.reduce((s,l)=>s+l.qty*l.price*((l.disc||0)/100),0);
  const tax=sub*(d.taxRate||0), total=sub+(d.shipping||0)+tax;
  return {sub,discGiven,tax,total};
}

/* ---------------- QUOTATION (document) ---------------- */
SCREENS['quotation'] = function(root){
  const d=DB.quote0188; const {sub,discGiven,tax,total}=docTotals(d);
  root.innerHTML=`<div class="content full"><section class="master"><div class="pagehead">${crumbs([DB.company.name,{label:'Sales',route:'sales-home'},{label:'Quotations',route:'quotations'},{cur:d.no}])}${typeof salesNav==='function'?salesNav('quotations'):''}</div><div class="docwrap"><div class="docpage" style="padding-top:4px">
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('receipt')}Quotation <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.cust)} · owner ${esc(d.owner)} · valid until ${esc(d.valid)}</div></div>
        <div class="dactions">${cap(d.status,salesTone(d.status))}${btn('Download PDF',{icon:'filepdf',cls:'soft'})}${btn('Duplicate',{icon:'copy',cls:'soft'})}</div>
      </div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Draft</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Sent</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Accepted</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('check')}</span>Converted</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Customer</small><div class="partner">${profileAvatar({name:d.cust,cls:'pav',size:26})}<b>${esc(d.cust)}</b></div></div>
        <div class="dm"><small>Quote date</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>Valid until</small><b>${esc(d.valid)}</b></div>
        <div class="dm"><small>Terms</small><b>${esc(d.terms)} · ${esc(d.currency)}</b></div>
        <div class="dm"><small>Converted to</small><b>SO-26-0418</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>Quoted items</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lines.length} lines</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Unit price</th><th>Disc</th><th>Amount</th></tr></thead><tbody>${docLineRows(d.lines)}</tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Activity</h3></div><div class="panel-body">${auditTrail([
          {kind:'current',when:'Jun 3 · 09:40',what:'Accepted &amp; converted to <b>SO-26-0418</b>',who:'J. Okafor'},
          {kind:'sys',when:'Jun 1 · 14:10',what:'Customer requested 12% on pumps & cylinders',who:'E. Marsh',change:{field:'Line discount',old:'8%',new:'12%',reason:'Q3 volume commitment'}},
          {kind:'add',when:'May 28 · 10:05',what:'Quotation sent to customer',who:'J. Okafor'},
        ])}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">
          <div class="sumrow"><span class="sk2">Subtotal</span><span class="sv tnum">${money(sub+discGiven)}</span></div>
          <div class="sumrow disc"><span class="sk2">Discount given</span><span class="sv tnum">−${money(discGiven)}</span></div>
          <div class="sumrow"><span class="sk2">Shipping</span><span class="sv tnum">${money(d.shipping)}</span></div>
          <div class="sumrow"><span class="sk2">Tax (${Math.round(d.taxRate*100)}% ${(DB.company&&DB.company.taxRegime)||'GST'})</span><span class="sv tnum">${money(tax)}</span></div>
          <div class="sumrow total"><span class="sk2">Quote total</span><span class="sv tnum">${money(total)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Validity</div>
          ${indicator({tone:'accent',icon:'checkc',label:'Won & converted',value:'SO-26-0418',sub:'Accepted within validity window · Jun 3.'})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Primary contact</div>
          <div class="field"><span class="k">Name</span><span class="v">${esc(d.contact.name)}</span></div>
          <div class="field"><span class="k">Role</span><span class="v">${esc(d.contact.role)}</span></div>
          <div class="field"><span class="k">Email</span><span class="v">${esc(d.contact.email)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:'SO-26-0418',label:'Sales order (from quote)',meta:'converted Jun 3',status:'Pending Approval'},
            {no:d.code,label:esc(d.cust),meta:'Customer 360',status:'Active'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">This quote has been <b style="color:var(--fg)">converted</b> to sales order SO-26-0418.</div>
      <div class="grow"></div>
      ${btn('Edit quotation',{icon:'edit',cls:'soft',attrs:'onclick="navigate(\'new-quotation\',{edit:\'Q-26-0188\'})"'})}
      ${btn('Email to customer',{icon:'send',cls:'soft',attrs:'onclick="toast(\'Quotation emailed to '+d.contact.email+'\',\'ok\')"'})}
      ${btn('View sales order',{icon:'bag',cls:'primary',sm:false,attrs:'onclick="navigate(\'sales-order\')"'})}
    </div>
  </div></div></section></div>`;
};

/* ---------------- DELIVERY ORDER (document) ---------------- */
SCREENS['delivery-order'] = function(root){
  const d=DB.delivery0204;
  const back=d.lines.filter(l=>l.delivered<l.ordered);
  const fullyShipped=d.lines.length-back.length;
  const lineRows=d.lines.map((l,i)=>{
    const bo=l.ordered-l.delivered;
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}</small></td>
      <td class="tnum">${num(l.ordered)} ${esc(l.uom)}</td>
      <td class="tnum"><b>${num(l.delivered)}</b></td>
      <td class="tnum" style="color:${bo?'var(--danger)':'var(--muted)'}">${bo?num(bo):'—'}</td>
      <td class="l">${bo?cap('Backorder','danger'):cap('Shipped','ok')}</td></tr>`;
  }).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,{label:'Sales',route:'sales-home'},{label:'Deliveries',route:'delivery-orders'},{cur:d.no}])}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('truck')}Delivery Order <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.cust)} · from ${esc(d.so)} · ${esc(d.carrier)}</div></div>
        <div class="dactions">${cap(d.status,salesTone(d.status))}${btn('Print packing list',{icon:'print',cls:'soft'})}</div>
      </div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Picked</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Packed</div><span class="stepline done"></span>
        <div class="step current"><span class="sdot">${ic('truck')}</span>Dispatched</div><span class="stepline"></span>
        <div class="step"><span class="sdot"></span>Delivered</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Customer</small><div class="partner">${profileAvatar({name:d.cust,cls:'pav',size:26})}<b>${esc(d.cust)}</b></div></div>
        <div class="dm"><small>Ship date</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>Warehouse</small><b>${esc(d.warehouse)}</b></div>
        <div class="dm"><small>Carrier</small><b>${esc(d.carrier)}</b></div>
        <div class="dm"><small>ETA</small><b>${esc(d.eta)}</b></div>
      </div>
    </div>
    ${back.length?`<div class="alert warn" style="margin:0 0 14px"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>Partial shipment — ${back.length} line${back.length>1?'s':''} on backorder.</b> ${esc(back[0].name)} short ${num(back[0].ordered-back[0].delivered)} ea; a follow-on delivery is created on receipt of inbound PO-26-0291.</span>
      ${btn('Inbound PO',{icon:'flow',cls:'soft',attrs:'onclick="navigate(\'po-approval\')"'})}</div>`:''}
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>Shipment lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${fullyShipped} of ${d.lines.length} complete</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Ordered</th><th>Delivered</th><th>Backorder</th><th class="l">Status</th></tr></thead><tbody>${lineRows}</tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Carrier &amp; tracking</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Carrier</span><input value="${esc(d.carrier)}" readonly></div>
            <div class="fld"><span>Tracking no.</span><input value="${esc(d.tracking)}" readonly></div>
            <div class="fld"><span>Picked & packed by</span><input value="${esc(d.picker)}" readonly></div>
          </div>
        </div></div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Shipment</div>
          <div class="sumrow"><span class="sk2">Packages</span><span class="sv tnum">${d.packages}</span></div>
          <div class="sumrow"><span class="sk2">Gross weight</span><span class="sv tnum">${esc(d.weight)}</span></div>
          <div class="sumrow"><span class="sk2">Tracking</span><span class="sv mono" style="font-size:12px">${esc(d.tracking)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Fulfilment</div>
          ${indicator({tone:back.length?'warn':'ok',icon:'truck',label:`${fullyShipped}/${d.lines.length} lines shipped`,value:Math.round(fullyShipped/d.lines.length*100)+'%',sub:back.length?`${back.length} line${back.length>1?'s':''} on backorder — ${esc(back.map(l=>l.name).join(', '))}.`:'All lines shipped in full.',pct:Math.round(fullyShipped/d.lines.length*100)})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:d.so,label:'Sales order',meta:'Meridian Robotics',status:'Pending Approval'},
            {no:'INV-26-0331',label:'Sales invoice (from delivery)',meta:'partially paid',status:'Partially Paid'},
          ])}
        </div>
      </aside>
    </div>
    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${esc(d.status)} · ETA ${esc(d.eta)} via ${esc(d.carrier)}.</div>
      <div class="grow"></div>
      ${btn('Track shipment',{icon:'location',cls:'soft',attrs:'onclick="toast(\'Tracking '+d.tracking+' — out for delivery\',\'info\')"'})}
      ${btn('Mark delivered',{icon:'check',cls:'soft',attrs:'onclick="toast(\'Delivery confirmed — POD captured\',\'ok\')"'})}
      ${btn('Create invoice',{icon:'receipt',cls:'primary',sm:false,attrs:'onclick="navigate(\'sales-invoice\')"'})}
    </div>
  </div></div></section></div>`;
};

/* ---------------- SALES INVOICE (document) ---------------- */
SCREENS['sales-invoice'] = async function(root, params){
  await prepareCanonicalSalesData();
  const d=(params&&params.no&&DB.salesInvoiceDocs&&DB.salesInvoiceDocs[params.no])||DB.invoice0331;
  if(!d) throw new Error('No canonical sales invoice is available.');
  const {sub,discGiven,tax,total}=docTotals(d);
  const balance=total-d.paid, paidPct=total?Math.round(d.paid/total*100):0;
  const hasPayment=d.paid>0;
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,{label:'Sales',route:'sales-home'},{label:'Invoices',route:'sales-invoices'},{cur:d.no}])}
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('receipt')}Sales Invoice <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(d.cust)} · from ${esc(d.do)} · due ${esc(d.due)}</div></div>
        <div class="dactions">${cap(d.status,salesTone(d.status))}${btn('Download PDF',{icon:'filepdf',cls:'soft'})}</div>
      </div>
      <div class="stepper">
        <div class="step done"><span class="sdot">${ic('check')}</span>Draft</div><span class="stepline done"></span>
        <div class="step done"><span class="sdot">${ic('check')}</span>Posted</div><span class="stepline ${hasPayment?'done':''}"></span>
        <div class="step ${hasPayment?(balance>0?'current':'done'):''}"><span class="sdot">${hasPayment?(balance>0?ic('clock'):ic('check')):''}</span>Part-paid</div><span class="stepline ${balance<=0?'done':''}"></span>
        <div class="step ${balance<=0?'done':''}"><span class="sdot">${balance<=0?ic('check'):''}</span>Paid</div>
      </div>
      <div class="docmeta">
        <div class="dm"><small>Customer</small><div class="partner">${profileAvatar({name:d.cust,cls:'pav',size:26})}<b>${esc(d.cust)}</b></div></div>
        <div class="dm"><small>Invoice date</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>Due date</small><b>${esc(d.due)}</b></div>
        <div class="dm"><small>Terms</small><b>${esc(d.terms)} · ${esc(d.currency)}</b></div>
        <div class="dm"><small>From delivery</small><b>${esc(d.do)}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>Invoice lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lines.length} lines · delivered qty</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Unit price</th><th>Disc</th><th>Amount</th></tr></thead><tbody>${docLineRows(d.lines)}</tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Payments</h3></div>
          <div class="panel-body" style="color:var(--muted);font-size:13px">${hasPayment?'The canonical invoice is marked paid. Receipt allocation details will be available with the receivables slice.':`No payments recorded yet — invoice is open in Accounts Receivable (due ${esc(d.due)}).`}</div>
        </div>
        <div class="panel"><div class="panel-h"><h3>Audit trail</h3></div><div class="panel-body">${auditTrail([
          {kind:'current',when:esc(d.date),what:`Invoice status — <b>${esc(d.status)}</b>`,who:'System'},
          {kind:'add',when:esc(d.date),what:'Generated from sales order <b>'+esc(d.so)+'</b> confirmation',who:'System'},
        ])}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">
          <div class="sumrow"><span class="sk2">Subtotal</span><span class="sv tnum">${money(sub+discGiven)}</span></div>
          <div class="sumrow disc"><span class="sk2">Discount given</span><span class="sv tnum">−${money(discGiven)}</span></div>
          <div class="sumrow"><span class="sk2">Shipping</span><span class="sv tnum">${money(d.shipping)}</span></div>
          <div class="sumrow"><span class="sk2">Tax (${Math.round(d.taxRate*100)}% ${(DB.company&&DB.company.taxRegime)||'GST'})</span><span class="sv tnum">${money(tax)}</span></div>
          <div class="sumrow total"><span class="sk2">Invoice total</span><span class="sv tnum">${money(total)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Payment status</div>
          <div class="sumrow"><span class="sk2">Paid</span><span class="sv tnum" style="color:var(--ok)">${money(d.paid)}</span></div>
          <div class="sumrow total"><span class="sk2">Balance due</span><span class="sv tnum">${money(balance)}</span></div>
          ${indicator({tone:'warn',icon:'receipt',label:'Outstanding',value:money0(balance),sub:`${paidPct}% paid · due ${esc(d.due)} (Net 30).`,pct:paidPct})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Related</div>
          ${relatedDocs([
            {no:d.so,label:'Sales order',meta:d.cust,status:'Completed'},
            {no:'AR Aging',label:'Receivables position',meta:'open this report'},
          ])}
        </div>
      </aside>
    </div>
    <div class="responsive-actionbar" style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Balance <b style="color:var(--fg)">${money(balance)}</b> due ${esc(d.due)}.</div>
      <div class="grow"></div>
      ${btn('View AR aging',{icon:'clock',cls:'soft',attrs:'onclick="navigate(\'ar-aging\')"'})}
    </div>
  </div></div></section></div>`;
};
