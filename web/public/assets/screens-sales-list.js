/* ============================================================
   ARIA ERP — Sales module: transaction list screens
   Enquiries · Quotations · Approvals · Delivery Orders · Invoices
   (registered through the shared transactionListPage SSOT)
   ============================================================ */

/* read-only quick-view (master-data records) — routes through the shared appModal builder */
function salesModal({icon='receipt', no, title, metaRows=[], lines='', foot}){
  const meta = metaRows.length ? `<div class="docmeta" style="margin-top:0">`+metaRows.map(([k,v])=>`<div class="dm"><small>${esc(k)}</small><b>${v}</b></div>`).join('')+`</div>` : '';
  appModal({ icon, title:`${no} · ${title}`, body:meta+(lines||''), actions: foot||btn('Close',{cls:'soft',attrs:'onclick="closeModal()"'}) });
}
function pct100(v){ return Math.max(0,Math.min(100,Math.round(v))); }
function miniProgress(done,total){
  const p=pct100(done/Math.max(1,total)*100), tone=done>=total?'ok':done>0?'warn':'';
  return `<span class="fulcell"><span class="minibar"><i class="${tone}" style="width:${p}%"></i></span><b class="fnum">${done} / ${total}</b></span>`;
}

/* ---------------- ENQUIRIES ---------------- */
/* ENQ_TONE → TONES.enquiry (defined in data-core.js) */
registerSalesTransactionList({
  route:'enquiries', title:'Enquiries', unit:'enquiries',
  sub:'Customer requests captured before a quotation — availability, pricing, lead-time and special terms. Convert a qualified enquiry straight to a quotation.',
  rows:()=>DB.enquiries, rowId:e=>e.no,
  chips:[['all','All'],['new','New'],['quoted','Quoted'],['converted','Converted'],['lost','Lost / on hold']],
  filterFn:(e,f)=>({new:'New',quoted:'Quoted',converted:'Converted'}[f]?e.status===({new:'New',quoted:'Quoted',converted:'Converted'}[f]):['Lost','On hold'].includes(e.status)),
  kpis:(r)=>[
    {label:'Open enquiries', val:r.filter(e=>['New','Quoted','On hold'].includes(e.status)).length, f:'new'},
    {label:'Est. pipeline', val:money0(r.filter(e=>!['Lost'].includes(e.status)).reduce((a,e)=>a+e.value,0))},
    {label:'Converted', val:r.filter(e=>e.status==='Converted').length, f:'converted'},
    {label:'Lost', val:r.filter(e=>e.status==='Lost').length, neg:true, f:'lost'},
  ],
  newBtn:{label:'New enquiry', onClick:()=>toast('New enquiry — capture form opens','info')},
  columns:[
    {label:'Enquiry', w:'minmax(140px,1.3fr)', render:e=>docNoCell(e.no, e.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.5fr)', render:e=>custCell(e.cust,e.custCode)},
    {label:'Subject', align:'l', w:'minmax(200px,2.2fr)', render:e=>`<span class="li-subj">${esc(e.subject)}</span>`},
    {label:'Channel', align:'l', w:'minmax(90px,0.9fr)', render:e=>`<span style="color:var(--muted)">${esc(e.channel)}</span>`},
    {label:'Owner', align:'l', w:'minmax(90px,0.9fr)', render:e=>esc(e.owner)},
    {label:'Est. value', align:'r', sortable:true, w:'minmax(96px,0.9fr)', render:e=>`<b class="tnum">${money0(e.value)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(110px,1fr)', render:e=>cap(e.status,ENQ_TONE[e.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(e)=>[
    {id:'view',icon:'ext',label:'View enquiry',run:()=>openEnquiry(e)},
    {id:'quote',icon:'receipt',label:'Convert to quotation',run:()=>{navigate('quotations');setTimeout(()=>toast(`Quotation drafted from ${e.no}`,'ok'),180);}},
    {id:'lost',icon:'x',label:'Mark as lost',danger:true,sep:true,run:()=>toast(`${e.no} marked lost`,'danger')},
  ],
  onOpen:(e)=>openEnquiry(e),
});
function openEnquiry(e){ openTxn('enquiry', e); }

/* ---------------- QUOTATIONS ---------------- */
/* QUO_TONE → TONES.quotation (defined in data-core.js) */
registerSalesTransactionList({
  route:'quotations', title:'Quotations', unit:'quotes',
  sub:'Formal offers issued to customers with validity, pricing and terms. Accepted quotations convert to a sales order in one step.',
  rows:()=>DB.quotations, rowId:q=>q.no,
  chips:[['all','All'],['draft','Draft'],['sent','Sent'],['accepted','Accepted'],['converted','Converted'],['closed','Rejected / expired']],
  filterFn:(q,f)=>({draft:'Draft',sent:'Sent',accepted:'Accepted',converted:'Converted'}[f]?q.status===({draft:'Draft',sent:'Sent',accepted:'Accepted',converted:'Converted'}[f]):['Rejected','Expired'].includes(q.status)),
  kpis:(r)=>[
    {label:'Open quotes', val:r.filter(q=>['Draft','Sent','Accepted'].includes(q.status)).length, f:'sent'},
    {label:'Open value', val:money0(r.filter(q=>['Draft','Sent','Accepted'].includes(q.status)).reduce((a,q)=>a+q.total,0))},
    {label:'Converted', val:r.filter(q=>q.status==='Converted').length, f:'converted', accent:true},
    {label:'Win rate', val:Math.round(r.filter(q=>q.status==='Converted').length/Math.max(1,r.filter(q=>['Converted','Rejected','Expired'].includes(q.status)).length)*100)+'%'},
  ],
  newBtn:{label:'New quotation', onClick:()=>navigate('new-quotation')},
  columns:[
    {label:'Quote', w:'minmax(140px,1.3fr)', render:q=>docNoCell(q.no, 'issued '+q.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.6fr)', render:q=>custCell(q.cust,q.custCode)},
    {label:'Valid until', align:'l', w:'minmax(96px,1fr)', render:q=>`<span class="muted-date">${esc(q.valid)}</span>`},
    {label:'Owner', align:'l', w:'minmax(86px,0.9fr)', render:q=>esc(q.owner)},
    {label:'Win %', align:'l', w:'minmax(96px,1fr)', render:q=>`<span class="wincell"><span class="bartrack" style="width:60px;display:inline-block;vertical-align:middle"><i style="width:${q.prob}%;background:${q.prob>=75?'var(--ok)':q.prob>=40?'var(--accent)':'var(--warn)'}"></i></span> <b class="tnum" style="font-size:12px">${q.prob}%</b></span>`},
    {label:'Total', align:'r', sortable:true, w:'minmax(104px,0.9fr)', render:q=>`<b class="tnum">${money(q.total)}</b>`},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(118px,1.1fr)', render:q=>cap(q.status,QUO_TONE[q.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(q)=>[
    {id:'view',icon:'ext',label:'Open quotation',run:()=>openQuote(q)},
    {id:'pdf',icon:'filepdf',label:'Download PDF',run:()=>toast('Quotation PDF generated','ok')},
    {id:'so',icon:'bag',label:'Convert to order',run:()=>{navigate('new-sales-order');},},
    {id:'edit',icon:'edit',label:'Edit quotation',run:()=>navigate('new-quotation',{edit:q.no})},
    {id:'dup',icon:'copy',label:'Duplicate',sep:true,run:()=>toast(`${q.no} duplicated`,'info')},
    {id:'del',icon:'trash',label:'Delete',danger:true,run:()=>deleteQuotation(q)},
  ],
  onOpen:(q)=>openQuote(q),
});
function openQuote(q){
  if(q.doc){ navigate('quotation'); return; }
  openTxn('quotation', q);
}
/* delete with confirm — uses the shared confirmModal; removes from DB.quotations and refreshes */
function deleteQuotation(q){
  confirmModal({ icon:'trash', title:`Delete ${esc(q.no)}?`, danger:true, confirmLabel:'Delete quotation',
    message:`This permanently removes the quotation for <b>${esc(q.cust)}</b> (${money(q.total)}). This can't be undone.`,
    onConfirm:`()=>confirmDeleteQuotation('${q.no}')` });
}
function confirmDeleteQuotation(no){
  const i=DB.quotations.findIndex(x=>x.no===no);
  if(i>=0) DB.quotations.splice(i,1);
  closeModal(); navigate('quotations'); setTimeout(()=>toast(`${no} deleted`,'danger'),160);
}

/* ---------------- SALES ORDER APPROVALS ---------------- */
function soApprove(no, ok){ toast(`${no} ${ok?'approved — released to fulfilment':'rejected — returned to sales'}`, ok?'ok':'danger'); }
registerSalesTransactionList({
  route:'so-approvals', active:'so-approvals', title:'Sales Order Approvals',
  sub:'Orders held for sign-off by business rules — credit limit, discount threshold, overdue customer or special terms. Approve to release to fulfilment.',
  rows:()=>DB.salesOrders.filter(s=>s.status==='Pending Approval'),
  rowId:s=>s.no, unit:'awaiting',
  kpis:(r)=>[
    {label:'Awaiting approval', val:r.length, accent:r.length>0},
    {label:'Value held', val:money0(r.reduce((a,s)=>a+s.total,0))},
    {label:'Over credit limit', val:r.filter(s=>/credit/i.test(s.flag||'')).length, neg:true},
    {label:'Discount flags', val:r.filter(s=>/discount/i.test(s.flag||'')).length},
  ],
  columns:[
    {label:'Order', w:'minmax(132px,1.2fr)', render:s=>docNoCell(s.no, s.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.5fr)', render:s=>custCell(s.cust,s.custCode)},
    {label:'Trigger', align:'l', w:'minmax(160px,1.8fr)', render:s=>s.flag?`<span class="appr-reason">${ic('warn')}${esc(s.flag)}</span>`:`<span style="color:var(--muted)">Manual review</span>`},
    {label:'Owner', align:'l', w:'minmax(86px,0.9fr)', render:s=>esc(s.owner)},
    {label:'Total', align:'r', sortable:true, w:'minmax(104px,0.9fr)', render:s=>`<b class="tnum">${money(s.total)}</b>`},
    {label:'', align:'r', w:'minmax(168px,168px)', render:s=>`<span class="appr-acts">${btn('Reject',{icon:'x',cls:'soft',attrs:`onclick="event.stopPropagation();soApprove('${s.no}',false)"`})}${btn('Approve',{icon:'check',cls:'primary',attrs:`onclick="event.stopPropagation();soApprove('${s.no}',true)"`})}</span>`},
  ],
  onOpen:(s)=>{ s.no==='SO-26-0418' ? navigate('sales-order') : toast(`Opening ${s.no}`,'info'); },
});

/* ---------------- DELIVERY ORDERS ---------------- */
/* DO_TONE → TONES.delivery (defined in data-core.js) */
registerSalesTransactionList({
  route:'delivery-orders', active:'delivery-orders', title:'Delivery Orders', unit:'deliveries',
  sub:'Outbound fulfilment from approved orders — pick, pack, dispatch and proof of delivery. Supports partial shipments and backorders.',
  rows:()=>DB.deliveries, rowId:d=>d.no,
  chips:[['all','All'],['open','Open'],['shipped','Shipped'],['delivered','Delivered']],
  filterFn:(d,f)=>f==='open'?['Draft','Picking','Packed','Partially Delivered'].includes(d.status):f==='shipped'?d.status==='Shipped':d.status==='Delivered',
  kpis:(r)=>[
    {label:'Open deliveries', val:r.filter(d=>!['Delivered','Cancelled'].includes(d.status)).length, f:'open'},
    {label:'In transit', val:r.filter(d=>d.status==='Shipped').length, f:'shipped'},
    {label:'Backorders', val:r.filter(d=>d.status==='Partially Delivered').length, neg:true},
    {label:'Delivered', val:r.filter(d=>d.status==='Delivered').length, f:'delivered'},
  ],
  newBtn:{label:'New delivery', onClick:()=>toast('New delivery order — select an approved SO','info')},
  columns:[
    {label:'Delivery', w:'minmax(132px,1.2fr)', render:d=>docNoCell(d.no, d.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.5fr)', render:d=>custCell(d.cust,d.custCode)},
    {label:'From order', align:'l', w:'minmax(110px,1fr)', render:d=>`<span class="mono" style="font-size:12px">${esc(d.so)}</span>`},
    {label:'Warehouse', align:'l', w:'minmax(96px,1fr)', render:d=>`<span style="color:var(--muted)">${esc(d.warehouse)}</span>`},
    {label:'Carrier', align:'l', w:'minmax(92px,0.9fr)', render:d=>esc(d.carrier)},
    {label:'Progress', align:'l', w:'minmax(116px,1.1fr)', render:d=>miniProgress(d.done,d.items)},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(130px,1.2fr)', render:d=>cap(d.status,DO_TONE[d.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(d)=>[
    {id:'view',icon:'ext',label:'Open delivery',run:()=>openDelivery(d)},
    {id:'print',icon:'print',label:'Print packing list',run:()=>toast('Packing list sent to printer','info')},
    {id:'track',icon:'location',label:'Track shipment',run:()=>toast(`Tracking ${d.no} — ${d.carrier}`,'info')},
    {id:'inv',icon:'receipt',label:'Create invoice',sep:true,run:()=>{navigate('sales-invoices');}},
  ],
  onOpen:(d)=>openDelivery(d),
});
function openDelivery(d){
  if(d.doc){ navigate('delivery-order'); return; }
  openTxn('delivery', d);
}

/* ---------------- SALES INVOICES ---------------- */
/* INV_TONE → TONES.invoice (defined in data-core.js) */
registerSalesTransactionList({
  route:'sales-invoices', active:'sales-invoices', title:'Sales Invoices', unit:'invoices',
  prepare:prepareCanonicalSalesData,
  sub:'Customer billing posted to Accounts Receivable. Track payment status and outstanding balance; raise credit notes against any invoice.',
  rows:()=>DB.salesInvoices, rowId:i=>i.no,
  chips:[['all','All'],['unpaid','Unpaid'],['overdue','Overdue'],['paid','Paid'],['draft','Draft']],
  filterFn:(i,f)=>f==='unpaid'?['Posted','Partially Paid'].includes(i.status):f==='overdue'?i.status==='Overdue':f==='paid'?i.status==='Paid':i.status==='Draft',
  kpis:(r)=>[
    {label:'Outstanding', val:money0(r.filter(i=>['Posted','Partially Paid','Overdue'].includes(i.status)).reduce((a,i)=>a+(i.total-i.paid),0)), f:'unpaid'},
    {label:'Overdue', val:money0(r.filter(i=>i.status==='Overdue').reduce((a,i)=>a+(i.total-i.paid),0)), neg:true, f:'overdue'},
    {label:'Posted this period', val:r.filter(i=>i.status!=='Draft'&&i.status!=='Cancelled').length},
    {label:'Paid', val:r.filter(i=>i.status==='Paid').length, f:'paid'},
  ],
  columns:[
    {label:'Invoice', w:'minmax(132px,1.2fr)', render:i=>docNoCell(i.no, i.date)},
    {label:'Customer', align:'l', w:'minmax(150px,1.5fr)', render:i=>custCell(i.cust,i.custCode)},
    {label:'Due date', align:'l', w:'minmax(94px,1fr)', render:i=>`<span class="muted-date ${i.status==='Overdue'?'due-danger':''}">${esc(i.due)}</span>`},
    {label:'From order', align:'l', w:'minmax(104px,1fr)', render:i=>`<span class="mono" style="font-size:12px">${esc(i.so)}</span>`},
    {label:'Total', align:'r', sortable:true, w:'minmax(104px,0.9fr)', render:i=>`<b class="tnum">${money(i.total)}</b>`},
    {label:'Balance', align:'r', w:'minmax(100px,0.9fr)', render:i=>{const b=i.total-i.paid;return `<b class="tnum" style="color:${b>0?(i.status==='Overdue'?'var(--danger)':'var(--fg)'):'var(--ok)'}">${b>0?money(b):'—'}</b>`;}},
    {label:'Status', align:'l', cls:'cap-cell', w:'minmax(120px,1.1fr)', render:i=>cap(i.status,INV_TONE[i.status])},
    {label:'', align:'c', w:'52px', render:()=>transactionRowMenuButton()},
  ],
  rowMenu:(i)=>[
    {id:'view',icon:'ext',label:'Open invoice',run:()=>openInvoice(i)},
    {id:'pdf',icon:'filepdf',label:'Download PDF',run:()=>toast('Invoice PDF generated','ok')},
  ],
  onOpen:(i)=>openInvoice(i),
});
function openInvoice(i){
  if(DB.salesInvoiceDocs&&DB.salesInvoiceDocs[i.no]){ navigate('sales-invoice',{no:i.no}); return; }
  if(i.doc){ navigate('sales-invoice'); return; }
  openTxn('invoice', i);
}
