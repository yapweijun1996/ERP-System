/* ============================================================
   ARIA ERP — New Purchase Order wizard (create flow)
   3 steps: Supplier & details → Order lines → Review & confirm.
   Reached from Quick create, the command palette and the
   Purchase Orders list. Confirms to the PO list.
   Mirrors the Sales Order wizard; buys at item cost, suggests
   reorder quantities, and routes high-value POs for approval.
   ============================================================ */
SCREENS['new-purchase-order'] = function(root, params){
  const TODAY='2026-06-21', ETA='2026-07-05';
  /* TASK-023: 9% matches the real seeded SG GST rate (tax_rule 'SR', effective
     2024-01-01) — createPurchaseOrder looks this up for real per line at
     submit time; this constant is only a live preview while the user edits. */
  const TAX=0.09, APPROVAL_THRESHOLD=50000;
  /* WH-SALES is the only real warehouse seeded for this company, and the only
     one receiveGoods() ever receives into — a single real option replaces the
     old hardcoded Kuala Lumpur-only list, which made no sense once a Singapore
     company could reach this wizard. */
  const whIn=['WH-SALES'];

  const S={ step:0, reached:0,
    supplier:(params&&params.supplier)||'', orderDate:TODAY, eta:ETA,
    terms:'Net 30', warehouse:'WH-SALES', reference:'', incoterm:'DAP',
    lines:[] /* {sku,name,uom,qty,price} */ };

  const sup=()=>DB.suppliers.find(s=>s.code===S.supplier);
  // suggest the items this supplier is most likely to replenish: those at/under reorder
  const lowItems=()=>DB.items.filter(it=>it.onHand-it.alloc<=it.reorder);
  function totals(){
    let sub=0; S.lines.forEach(l=>sub+=l.qty*l.price);
    const tax=sub*TAX; return {sub,tax,total:sub+tax};
  }

  /* ---------------- STEP 1 — supplier & details ---------------- */
  function step1(){
    const s=sup();
    const lows=lowItems().length;
    const sidebar=s?indicator({tone:'ok',icon:'shield',label:'Supplier account',
        value:money0(s.balance),sub:`${esc(s.terms)} terms · ${esc(s.status)} · current payable balance.`})
      :`<div style="color:var(--muted);font-size:13px;padding:6px 2px">Select a supplier to see their account terms.</div>`;
    const repl=lows?`<div class="sumcard" style="margin-top:12px"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Replenishment</div>${indicator({tone:'warn',icon:'box',label:'Items below reorder',value:String(lows),sub:'Add them in the next step — quantities pre-filled from reorder rules.'})}</div>`:'';
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('truck')}<h3>Supplier</h3></div>
        <div class="panel-body">
          <div class="fld"><span>Pay-to supplier <span class="req">*</span></span>
            <select id="wSup"><option value="">Choose a supplier…</option>
              ${DB.suppliers.map(s=>`<option value="${s.code}" ${s.code===S.supplier?'selected':''}>${esc(s.name)} · ${esc(s.code)}</option>`).join('')}</select></div>
          ${s?`<div class="fldrow c2" style="margin-top:12px">
            <div class="fld"><span>Default terms</span><input value="${esc(s.terms)}" readonly></div>
            <div class="fld"><span>Status</span><input value="${esc(s.status)}" readonly></div></div>`:''}
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Order details</h3></div>
        <div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Order date</span><input type="date" id="wDate" value="${S.orderDate}"></div>
            <div class="fld"><span>Expected receipt</span><input type="date" id="wEta" value="${S.eta}"></div>
            <div class="fld"><span>Receive into</span><select id="wWh">${whIn.map(w=>`<option ${w===S.warehouse?'selected':''}>${w}</option>`).join('')}</select></div>
          </div>
          <div class="fldrow c3" style="margin-top:12px">
            <div class="fld"><span>Payment terms</span><select id="wTerms">${['Net 30','Net 45','Net 60','COD'].map(t=>`<option ${t===S.terms?'selected':''}>${t}</option>`).join('')}</select></div>
            <div class="fld"><span>Incoterm</span><select id="wInco">${['DAP','EXW','FOB','CIF'].map(t=>`<option ${t===S.incoterm?'selected':''}>${t}</option>`).join('')}</select></div>
            <div class="fld"><span>Internal reference</span><input id="wRef" value="${esc(S.reference)}" placeholder="e.g. MRP-26-0291"></div>
          </div>
        </div>
      </div>
    </div>
    <aside class="summary"><div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Supplier check</div>${sidebar}</div>${repl}</aside></div>`;
  }
  function wire1(){
    const su=$('#wSup'); su.addEventListener('change',()=>{ S.supplier=su.value; const s=sup(); if(s)S.terms=s.terms; render(); });
    const bind=(id,key)=>{ const el=$('#'+id); el&&el.addEventListener('change',()=>S[key]=el.value); };
    bind('wDate','orderDate'); bind('wEta','eta'); bind('wWh','warehouse'); bind('wTerms','terms'); bind('wInco','incoterm');
    const ref=$('#wRef'); ref&&ref.addEventListener('input',()=>S.reference=ref.value);
  }

  /* ---------------- STEP 2 — order lines ---------------- */
  function suggestQty(it){ return it.roq || Math.max(it.reorder - (it.onHand-it.alloc), 1); }
  function lineRows(){
    if(!S.lines.length) return `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:26px">No items yet — add items to purchase above, or use “Add all low-stock”.</td></tr>`;
    return S.lines.map((l,i)=>{
      const ext=l.qty*l.price;
      const it=DB.items.find(x=>x.sku===l.sku); const cover=it?it.onHand-it.alloc:0;
      return `<tr data-i="${i}">
        <td class="lineno">${i+1}</td>
        <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.sku)} · on hand ${num(Math.max(0,cover))} ${esc(l.uom)} · reorder at ${num(it?it.reorder:0)}</small></td>
        <td><input class="lineinput wQty" type="number" min="1" value="${l.qty}" style="width:72px"></td>
        <td><input class="lineinput wPrice" type="number" min="0" step="0.01" value="${l.price}" style="width:88px"></td>
        <td class="tnum"><b>${money(ext)}</b></td>
        <td style="text-align:center"><button class="iconbtn wDel" data-tip="Remove" style="width:28px;height:28px">${ic('trash')}</button></td></tr>`;
    }).join('');
  }
  function step2(){
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('box')}<h3>Add item</h3>
          <button class="btn soft sm" id="wAddLow" style="margin-left:auto">${ic('plus')}<span>Add all low-stock</span></button></div>
        <div class="panel-body">
          <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
            <div class="fld" style="flex:1;min-width:240px"><span>Item</span>
              <select id="wPick">${DB.items.map(it=>`<option value="${it.sku}">${esc(it.sku)} · ${esc(it.name)} — cost ${money(it.cost)}/${esc(it.uom)}</option>`).join('')}</select></div>
            <div class="fld" style="width:104px"><span>Qty</span><input type="number" id="wAddQty" min="1" value="1"></div>
            ${btn('Add line',{icon:'plus',cls:'primary',attrs:'id="wAdd"'})}
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Order lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)" id="wLineCount">${S.lines.length} line${S.lines.length===1?'':'s'}</span></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Unit cost</th><th>Amount</th><th></th></tr></thead>
          <tbody id="wLines">${lineRows()}</tbody></table>
      </div>
    </div>
    <aside class="summary"><div class="sumcard" id="wTotals">${totalsCard()}</div></aside></div>`;
  }
  function totalsCard(){
    const t=totals();
    return `<div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Order summary</div>
      <div class="sumrow"><span class="sk2">Goods subtotal</span><span class="sv tnum">${money(t.sub)}</span></div>
      <div class="sumrow"><span class="sk2">Tax (9% GST)</span><span class="sv tnum">${money(t.tax)}</span></div>
      <div class="sumrow total"><span class="sk2">PO total</span><span class="sv tnum">${money(t.total)}</span></div>`;
  }
  function addItem(sku,qty){
    const it=DB.items.find(x=>x.sku===sku); if(!it) return;
    const ex=S.lines.find(l=>l.sku===sku);
    if(ex){ ex.qty+=qty; } else S.lines.push({sku:it.sku,name:it.name,uom:it.uom,qty,price:it.cost});
  }
  function wire2(){
    $('#wAdd').addEventListener('click',()=>{
      addItem($('#wPick').value, Math.max(1,+$('#wAddQty').value||1)); refreshLines();
    });
    $('#wAddLow').addEventListener('click',()=>{
      lowItems().forEach(it=>{ if(!S.lines.find(l=>l.sku===it.sku)) addItem(it.sku, suggestQty(it)); });
      refreshLines();
    });
    bindLineInputs();
  }
  function refreshLines(){
    $('#wLines').innerHTML=lineRows();
    $('#wLineCount').textContent=`${S.lines.length} line${S.lines.length===1?'':'s'}`;
    $('#wTotals').innerHTML=totalsCard();
    bindLineInputs(); updateFooter();
  }
  function bindLineInputs(){
    $$('#wLines tr[data-i]').forEach(tr=>{
      const i=+tr.dataset.i, l=S.lines[i];
      const q=tr.querySelector('.wQty'), p=tr.querySelector('.wPrice');
      const upd=()=>{ l.qty=Math.max(1,+q.value||1); l.price=Math.max(0,+p.value||0);
        tr.querySelector('td.tnum b').textContent=money(l.qty*l.price); $('#wTotals').innerHTML=totalsCard(); };
      [q,p].forEach(el=>el.addEventListener('input',upd));
      tr.querySelector('.wDel').addEventListener('click',()=>{ S.lines.splice(i,1); refreshLines(); });
    });
  }

  /* ---------------- STEP 3 — review & confirm ---------------- */
  function step3(){
    const s=sup(), t=totals();
    const over=t.total>APPROVAL_THRESHOLD;
    const rows=S.lines.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.sku)}</small></td>
      <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td><td class="tnum">${money(l.price)}</td>
      <td class="tnum"><b>${money(l.qty*l.price)}</b></td></tr>`).join('');
    const initials=s.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    return `<div class="docmeta" style="margin-bottom:16px">
        <div class="dm"><small>Supplier</small><div class="partner"><span class="pav">${esc(initials)}</span><b>${esc(s.name)}</b></div></div>
        <div class="dm"><small>Order date</small><b>${esc(S.orderDate)}</b></div>
        <div class="dm"><small>Expected receipt</small><b>${esc(S.eta)}</b></div>
        <div class="dm"><small>Terms</small><b>${esc(S.terms)} · ${esc(S.incoterm)}</b></div>
        <div class="dm"><small>Receive into</small><b>${esc(S.warehouse)}</b></div>
        <div class="dm"><small>Reference</small><b>${S.reference?esc(S.reference):'—'}</b></div>
      </div>
      <div class="doclayout"><div class="docmain">
        <div class="panel"><div class="panel-h">${ic('receipt')}<h3>Order lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${S.lines.length} lines</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>Qty</th><th>Unit cost</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>
      <aside class="summary">
        <div class="sumcard">${totalsCard()}</div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Approval routing</div>
          ${over
            ?indicator({tone:'warn',icon:'flow',label:'Above approval threshold',value:money0(t.total),sub:`Exceeds the ${money0(APPROVAL_THRESHOLD)} limit — routes to Procurement Manager on submit.`})
            :indicator({tone:'ok',icon:'checkc',label:'Within auto-approval limit',value:money0(t.total),sub:`Under ${money0(APPROVAL_THRESHOLD)} — issues directly to the supplier.`})}
        </div>
      </aside></div>`;
  }

  /* ---------------- shell / render ---------------- */
  const steps=[['Supplier','truck'],['Order lines','box'],['Review','checkc']];
  function stepper(){ return wizardStepper(steps, S.step, S.reached); }
  function canAdvance(){ if(S.step===0) return !!S.supplier; if(S.step===1) return S.lines.length>0; return true; }
  function footer(){
    const adv=canAdvance();
    const right=S.step<2
      ? btn('Continue',{icon:'arrowR',cls:'primary',sm:false,attrs:`id="wNext" ${adv?'':'disabled style=\"opacity:.5;pointer-events:none\"'}`})
      : btn('Create PO',{icon:'check',cls:'primary',sm:false,attrs:'id="wCreate"'});
    const left=S.step>0?btn('Back',{icon:'chevL',cls:'soft',attrs:'id="wBack"'}):btn('Cancel',{cls:'soft',attrs:'id="wCancel"'});
    const hint=S.step===0?'Step 1 of 3 · choose who you’re buying from'
      :S.step===1?`Step 2 of 3 · ${S.lines.length} line${S.lines.length===1?'':'s'} added`
      :'Step 3 of 3 · review, then create';
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div><div class="grow"></div>${left}${right}`;
  }
  function body(){ return S.step===0?step1():S.step===1?step2():step3(); }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Purchase Order">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'Purchasing','Orders',{cur:'New'}])}
        ${typeof purNav==='function'?'<div style="padding:0 0 4px">'+purNav('purchase-orders')+'</div>':''}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('cart')}New Purchase Order</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">Draft · ${esc(DB.company.name)} · ${esc(DB.company.branch)}</div></div>
            <div class="dactions">${cap('Draft','neutral')}</div>
          </div>
          ${stepper()}
        </div>
        <div id="wizBody">${body()}</div>
        <div style="height:8px"></div>
      </div></div>
      <div class="set-savebar" id="wizFoot">${footer()}</div>
    </section></div>`;
    wireShell();
    if(S.step===0)wire1(); else if(S.step===1)wire2();
  }
  function updateFooter(){ const f=$('#wizFoot'); if(f){ f.innerHTML=footer(); wireShell(); } }
  function wireShell(){
    $$('#viewRoot .step[data-step]').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.step; render(); }));
    const next=$('#wNext'); next&&next.addEventListener('click',()=>{ if(!canAdvance())return; S.step++; S.reached=Math.max(S.reached,S.step); render(); });
    const back=$('#wBack'); back&&back.addEventListener('click',()=>{ S.step--; render(); });
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('purchase-orders'));
    const create=$('#wCreate'); create&&create.addEventListener('click',async()=>{
      if(!(window.ErpSystemDemo&&typeof window.ErpSystemDemo.createPurchaseOrder==='function')){ toast('Demo adapter not loaded','warn'); return; }
      const s=sup();
      create.disabled=true;
      try{
        const res=await window.ErpSystemDemo.createPurchaseOrder({
          supplierCode:S.supplier, orderDate:S.orderDate, currency:DB.company.currency,
          lines:S.lines.map(l=>({sku:l.sku,qty:l.qty,unitCost:l.price,taxCode:'SR'})),
        });
        navigate('purchase-orders');
        toast(`Purchase order ${res.docNo} created for ${s.name} · ${money0(res.total)} · issued`,'ok');
      }catch(e){
        toast((e&&e.message)||'Create PO failed','danger');
        create.disabled=false;
      }
    });
  }
  render();
};
