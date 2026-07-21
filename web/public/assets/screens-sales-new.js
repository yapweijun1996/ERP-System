/* ============================================================
   ARIA ERP — New Sales Order wizard (create flow)
   3 steps: Customer & details → Order lines → Review & confirm.
   Reached from Quick create, the command palette, the Sales
   Orders list and a customer 360. Confirms to the SO list.
   ============================================================ */
SCREENS['new-sales-order'] = function(root, params){
  const sellPrice=it=>+(it.cost*1.45).toFixed(2);
  const TODAY=DB.soNow||'2026-06-21', DELIVERY=(()=>{const d=new Date(TODAY);d.setDate(d.getDate()+7);return d.toISOString().slice(0,10);})();
  const OUTPUT_TAX=DB.taxCodes.filter(t=>t.type==='Output'); // SR 6%, ZR 0%, EX 0%
  const taxRate=code=>{ const t=DB.taxCodes.find(x=>x.code===code); return t?t.rate/100:0; };
  const wh=['KL-Main','KL-Overflow','Penang DC'];
  const termsOpts=['Net 30','Net 45','Net 60','COD'];
  // default addresses on file per customer (street prefill on select)
  const ADDR={
    'C-0007':{line1:'Lot 14, Jalan Teknologi 3/5',line2:'Kota Damansara',city:'Petaling Jaya',state:'Selangor',post:'47810',country:'Malaysia'},
    'C-0012':{line1:'88 Jalan Industri Mas 2',line2:'Taman Mas',city:'Shah Alam',state:'Selangor',post:'40150',country:'Malaysia'},
    'C-0021':{line1:'Plot 7, Prai Industrial Estate',line2:'',city:'Perai',state:'Penang',post:'13600',country:'Malaysia'},
    'C-0033':{line1:'12 Jalan Tampoi',line2:'Kawasan Perindustrian',city:'Johor Bahru',state:'Johor',post:'81100',country:'Malaysia'},
    'C-0044':{line1:'Block C, Senawang Industrial Park',line2:'',city:'Seremban',state:'N. Sembilan',post:'70450',country:'Malaysia'},
  };
  const emptyAddr=()=>({line1:'',line2:'',city:'',state:'',post:'',country:'Malaysia'});

  // ---- wizard state (persists across step re-renders) ----
  const S={ step:0, reached:0, detailTab:'general', addType:'stock',
    customer:(params&&params.customer)||'', orderDate:TODAY, delivery:DELIVERY,
    terms:'Net 30', warehouse:'KL-Main', reference:'', notes:'', memo:'',
    billTo:emptyAddr(), shipSame:true, shipTo:emptyAddr(), attachments:[],
    lines:[] /* {sku,name,uom,qty,price,disc} */ };
  if(S.customer&&ADDR[S.customer]) S.billTo={...ADDR[S.customer]};

  const cust=()=>DB.customers.find(c=>c.code===S.customer);
  function lineNet(l){ return l.qty*l.price*(1-(l.disc||0)/100); }
  function totals(){
    let listSub=0, sub=0, tax=0;
    S.lines.forEach(l=>{ listSub+=l.qty*l.price; const net=lineNet(l); sub+=net; tax+=net*taxRate(l.tax||'SR'); });
    const discGiven=listSub-sub, total=sub+tax;
    return {listSub,sub,discGiven,tax,total};
  }

  /* ---------------- STEP 1 — customer & details ---------------- */
  function step1(){
    const c=cust();
    const credit=c?(()=>{
      const avail=c.limit-c.balance, pct=Math.round(c.balance/c.limit*100);
      return indicator({tone:pct>=95?'danger':pct>=80?'warn':'ok',icon:'shield',
        label:'Credit available',value:money0(avail),
        sub:`${money0(c.balance)} used of ${money0(c.limit)} limit${c.overdue?` · ${money0(c.overdue)} overdue`:''}.`,pct});
    })():`<div style="color:var(--muted);font-size:13px;padding:6px 2px">Select a customer to see their credit position.</div>`;
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('handshake')}<h3>Customer</h3></div>
        <div class="panel-body">
          <div class="fld"><span>Bill-to customer <span class="req">*</span></span>
            ${combobox({id:'wCust',value:S.customer,placeholder:'Search customers…',options:DB.customers.map(c=>({value:c.code,label:c.name,sub:c.code}))})}</div>
          ${c?`<div class="fldrow c2" style="margin-top:12px">
            <div class="fld"><span>Default terms</span><input value="${esc(c.terms)}" readonly></div>
            <div class="fld"><span>Status</span><input value="${esc(c.status)}" readonly></div></div>`:''}
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Order details</h3></div>
        <div class="tabs" id="odTabs" style="margin-top:0;padding:2px 14px 0">
          ${detailTabs.map(([k,lbl])=>`<div class="tab ${S.detailTab===k?'on':''}" data-dtab="${k}">${lbl}${detailTabCount(k)}</div>`).join('')}
        </div>
        <div class="panel-body" id="odBody">${detailBody()}</div>
      </div>
    </div>
    <aside class="summary"><div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Credit check</div>${credit}</div></aside></div>`;
  }
  /* ---- Order details tabbed sub-panel ---- */
  const detailTabs=[['general','General'],['address','Addresses'],['notes','Notes &amp; memo'],['files','Attachments']];
  function detailTabCount(k){
    if(k==='files'&&S.attachments.length) return `<span class="tc">${S.attachments.length}</span>`;
    if(k==='notes'&&(S.notes||S.memo)) return `<span class="tc">•</span>`;
    return '';
  }
  function detailBody(){
    if(S.detailTab==='address') return addrTab();
    if(S.detailTab==='notes')   return notesTab();
    if(S.detailTab==='files')   return filesTab();
    return generalTab();
  }
  function generalTab(){
    return `<div class="fldrow c3">
        <div class="fld"><span>Order date</span><input type="date" id="wDate" value="${S.orderDate}"></div>
        <div class="fld"><span>Requested delivery</span><input type="date" id="wDel" value="${S.delivery}"></div>
        <div class="fld"><span>Ship-from warehouse</span><select id="wWh">${wh.map(w=>`<option ${w===S.warehouse?'selected':''}>${w}</option>`).join('')}</select></div>
      </div>
      <div class="fldrow c2" style="margin-top:12px">
        <div class="fld"><span>Payment terms</span><select id="wTerms">${termsOpts.map(t=>`<option ${t===S.terms?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="fld"><span>Customer PO reference</span><input id="wRef" value="${esc(S.reference)}" placeholder="e.g. MR-99842"></div>
      </div>`;
  }
  function addrFields(a,pfx){
    return `<div class="fld"><span>Address line 1</span><input data-addr="${pfx}.line1" value="${esc(a.line1)}" placeholder="Street address"></div>
      <div class="fld" style="margin-top:11px"><span>Address line 2</span><input data-addr="${pfx}.line2" value="${esc(a.line2)}" placeholder="Unit, building (optional)"></div>
      <div class="fldrow c3" style="margin-top:11px">
        <div class="fld"><span>City</span><input data-addr="${pfx}.city" value="${esc(a.city)}"></div>
        <div class="fld"><span>State</span><input data-addr="${pfx}.state" value="${esc(a.state)}"></div>
        <div class="fld"><span>Postcode</span><input data-addr="${pfx}.post" value="${esc(a.post)}"></div>
      </div>
      <div class="fld" style="margin-top:11px"><span>Country</span><input data-addr="${pfx}.country" value="${esc(a.country)}"></div>`;
  }
  function addrTab(){
    return `<div class="fldlabel" style="margin-bottom:9px">Bill-to address</div>
      ${addrFields(S.billTo,'billTo')}
      <label style="display:flex;align-items:center;gap:8px;margin:18px 0 4px;font-size:13px;color:var(--fg);cursor:pointer">
        <input type="checkbox" id="wShipSame" ${S.shipSame?'checked':''} style="width:16px;height:16px;accent-color:var(--accent)">
        Ship-to address is the same as bill-to</label>
      ${S.shipSame
        ? `<div style="font-size:12.5px;color:var(--muted);padding:6px 2px">Goods will be delivered to the billing address above.</div>`
        : `<div style="border-top:1px solid var(--hairline);margin-top:12px;padding-top:14px"><div class="fldlabel" style="margin-bottom:9px">Ship-to address</div>${addrFields(S.shipTo,'shipTo')}</div>`}`;
  }
  function notesTab(){
    return `<div class="fld"><span>Customer note <span style="text-transform:none;font-weight:500;color:var(--faint)">· prints on the order &amp; invoice</span></span>
        <textarea id="wNotes" rows="3" placeholder="Visible to the customer — delivery instructions, packing notes…">${esc(S.notes)}</textarea></div>
      <div class="fld" style="margin-top:12px"><span>Internal memo <span style="text-transform:none;font-weight:500;color:var(--faint)">· staff only, never printed</span></span>
        <textarea id="wMemo" rows="3" placeholder="Notes for your team — pricing rationale, follow-ups…">${esc(S.memo)}</textarea></div>`;
  }
  function filesTab(){
    const list=S.attachments.length
      ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:12px">${S.attachments.map((f,i)=>`
          <div style="display:flex;align-items:center;gap:10px;border:1px solid var(--hairline);border-radius:10px;padding:8px 11px;background:var(--surface-2)">
            ${ic('receipt')}<div style="min-width:0;flex:1"><div style="font-size:13px;color:var(--fg);font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</div><div style="font-size:11.5px;color:var(--muted)">${esc(f.size)}</div></div>
            <button class="iconbtn wFileDel" data-i="${i}" data-tip="Remove" style="width:28px;height:28px">${ic('trash')}</button>
          </div>`).join('')}</div>`
      : '';
    return `<button type="button" id="wDrop" style="width:100%;border:1.5px dashed var(--border);border-radius:12px;background:var(--surface-2);padding:22px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;color:var(--muted)">
        ${ic('plus')}<div style="font-size:13px;color:var(--fg);font-weight:550">Attach a file</div>
        <div style="font-size:12px">Drop a PO, drawing or spec here — PDF, image or document</div></button>
      <input type="file" id="wFileInput" multiple hidden>${list}`;
  }
  function refreshDetail(){
    const tabs=$('#odTabs'); if(tabs) $$('#odTabs .tab').forEach(el=>el.classList.toggle('on',el.dataset.dtab===S.detailTab));
    const b=$('#odBody'); if(b){ b.innerHTML=detailBody(); wireDetailBody(); }
    // refresh count badges
    detailTabs.forEach(([k])=>{ const el=$(`#odTabs .tab[data-dtab="${k}"]`); if(el){ const cur=el.querySelector('.tc'); if(cur)cur.remove(); const c=detailTabCount(k); if(c)el.insertAdjacentHTML('beforeend',c); } });
  }
  function wireDetailBody(){
    const bind=(id,key)=>{ const el=$('#'+id); el&&el.addEventListener('change',()=>S[key]=el.value); };
    bind('wDate','orderDate'); bind('wDel','delivery'); bind('wWh','warehouse'); bind('wTerms','terms');
    const ref=$('#wRef'); ref&&ref.addEventListener('input',()=>S.reference=ref.value);
    $$('#odBody input[data-addr]').forEach(el=>{ const [grp,fld]=el.dataset.addr.split('.'); el.addEventListener('input',()=>{ S[grp][fld]=el.value; }); });
    const same=$('#wShipSame'); same&&same.addEventListener('change',()=>{ S.shipSame=same.checked; if(!S.shipSame&&!S.shipTo.line1) S.shipTo={...S.billTo}; refreshDetail(); });
    const nt=$('#wNotes'); nt&&nt.addEventListener('input',()=>S.notes=nt.value);
    const mm=$('#wMemo'); mm&&mm.addEventListener('input',()=>S.memo=mm.value);
    const drop=$('#wDrop'), fi=$('#wFileInput');
    if(drop&&fi){
      drop.addEventListener('click',()=>fi.click());
      fi.addEventListener('change',()=>{ [...fi.files].forEach(f=>S.attachments.push({name:f.name,size:fmtSize(f.size)})); fi.value=''; refreshDetail(); });
      drop.addEventListener('dragover',e=>{ e.preventDefault(); drop.style.borderColor='var(--accent)'; });
      drop.addEventListener('dragleave',()=>drop.style.borderColor='');
      drop.addEventListener('drop',e=>{ e.preventDefault(); drop.style.borderColor=''; [...e.dataTransfer.files].forEach(f=>S.attachments.push({name:f.name,size:fmtSize(f.size)})); refreshDetail(); });
    }
    $$('#odBody .wFileDel').forEach(b=>b.addEventListener('click',()=>{ S.attachments.splice(+b.dataset.i,1); refreshDetail(); }));
  }
  function fmtSize(n){ return n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB'; }

  function wire1(){
    wireCombobox('wCust',{options:DB.customers.map(c=>({value:c.code,label:c.name,sub:c.code})),onChange:v=>{ S.customer=v; const c=cust(); if(c)S.terms=c.terms; if(ADDR[v]&&!S.billTo.line1)S.billTo={...ADDR[v]}; render(); }});
    $$('#odTabs .tab').forEach(el=>el.addEventListener('click',()=>{ S.detailTab=el.dataset.dtab; refreshDetail(); }));
    wireDetailBody();
  }

  /* ---------------- STEP 2 — order lines ---------------- */
  const taxOpts=l=>OUTPUT_TAX.map(t=>`<option value="${t.code}" ${(l.tax||'SR')===t.code?'selected':''}>${t.code} · ${t.rate.toFixed(0)}%</option>`).join('');
  function lineRows(){
    if(!S.lines.length) return `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:26px">No items yet — add a stock or non-stock line above.</td></tr>`;
    return S.lines.map((l,i)=>{
      const ext=lineNet(l);
      const it=l.type==='stock'?DB.items.find(x=>x.sku===l.sku):null;
      const avail=it?it.onHand-it.alloc:0, short=it&&l.qty>avail;
      const code=l.type==='stock'
        ? `<div style="display:flex;flex-direction:column;line-height:1.3"><b class="mono" style="font-size:12px">${esc(l.sku)}</b>${short?`<small style="color:var(--warn);font-size:11px">only ${num(Math.max(0,avail))} ${esc(l.uom)} avail</small>`:`<small style="color:var(--muted);font-size:11px">${num(avail)} avail</small>`}</div>`
        : `<span class="cap neutral" style="font-size:10.5px"><span class="dot"></span>Non-stock</span>`;
      return `<tr data-i="${i}">
        <td class="lineno">${i+1}</td>
        <td class="l" style="white-space:nowrap">${code}</td>
        <td class="l" style="min-width:200px">
          <input class="lineinput l wDesc" value="${esc(l.name)}" placeholder="Description">
          <input class="lineinput l wRemark" value="${esc(l.remark||'')}" placeholder="Add remark…" style="font-size:11.5px;color:var(--muted);margin-top:2px">
        </td>
        <td><input class="lineinput wQty" type="number" min="1" value="${l.qty}" style="width:60px"></td>
        <td><input class="lineinput wUom" value="${esc(l.uom)}" style="width:54px;text-align:center" ${l.type==='stock'?'readonly':''}></td>
        <td><input class="lineinput wPrice" type="number" min="0" step="0.01" value="${l.price}" style="width:84px"></td>
        <td><input class="lineinput wDisc" type="number" min="0" max="100" value="${l.disc||0}" style="width:52px"></td>
        <td><select class="lineinput wTax" style="width:78px;text-align:left">${taxOpts(l)}</select></td>
        <td class="tnum"><b>${money(ext)}</b></td>
        <td style="text-align:center"><button class="iconbtn wDel" data-tip="Remove" style="width:28px;height:28px">${ic('trash')}</button></td></tr>`;
    }).join('');
  }
  function step2(){
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('box')}<h3>Add item</h3>
          <div class="seg" id="wType" style="margin-left:auto">
            <button class="seg-b on" data-type="stock">Stock item</button>
            <button class="seg-b" data-type="nonstock">Non-stock</button>
          </div>
        </div>
        <div class="panel-body" id="wAddBody">${addItemBody()}</div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Order lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)" id="wLineCount">${S.lines.length} line${S.lines.length===1?'':'s'}</span></div>
        <div style="overflow-x:auto"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Stock code</th><th class="l">Description &amp; remark</th><th>Qty</th><th>UoM</th><th>Unit price</th><th>Disc %</th><th class="l">GST</th><th>Subtotal</th><th></th></tr></thead>
          <tbody id="wLines">${lineRows()}</tbody></table></div>
      </div>
    </div>
    <aside class="summary"><div class="sumcard" id="wTotals">${totalsCard()}</div></aside></div>`;
  }
  function addItemBody(){
    if(S.addType==='nonstock'){
      return `<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div class="fld" style="flex:1;min-width:200px"><span>Description <span class="req">*</span></span><input id="wNsDesc" placeholder="e.g. Installation & commissioning"></div>
        <div class="fld" style="width:84px"><span>UoM</span><input id="wNsUom" value="lot"></div>
        <div class="fld" style="width:110px"><span>Unit price</span><input type="number" id="wNsPrice" min="0" step="0.01" value="0"></div>
        <div class="fld" style="width:80px"><span>Qty</span><input type="number" id="wNsQty" min="1" value="1"></div>
        ${btn('Add line',{icon:'plus',cls:'primary',attrs:'id="wAddNs"'})}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:9px">Non-stock lines (services, freight, charges) don't draw from inventory — they post straight to revenue.</div>`;
    }
    return `<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div class="fld" style="flex:1;min-width:240px"><span>Stock item</span>
          <select id="wPick">${DB.items.map(it=>`<option value="${it.sku}">${esc(it.sku)} · ${esc(it.name)} — ${money(sellPrice(it))}/${esc(it.uom)}</option>`).join('')}</select></div>
        <div class="fld" style="width:96px"><span>Qty</span><input type="number" id="wAddQty" min="1" value="1"></div>
        ${btn('Add line',{icon:'plus',cls:'primary',attrs:'id="wAdd"'})}
      </div>`;
  }
  function totalsCard(){
    const t=totals();
    return `<div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Order summary</div>
      <div class="sumrow"><span class="sk2">Subtotal</span><span class="sv tnum">${money(t.listSub)}</span></div>
      ${t.discGiven?`<div class="sumrow disc"><span class="sk2">Discount given</span><span class="sv tnum">−${money(t.discGiven)}</span></div>`:''}
      <div class="sumrow"><span class="sk2">GST (output)</span><span class="sv tnum">${money(t.tax)}</span></div>
      <div class="sumrow total"><span class="sk2">Order total</span><span class="sv tnum">${money(t.total)}</span></div>`;
  }
  function wire2(){
    $$('#wType .seg-b').forEach(b=>b.addEventListener('click',()=>{ S.addType=b.dataset.type; $$('#wType .seg-b').forEach(x=>x.classList.toggle('on',x===b)); $('#wAddBody').innerHTML=addItemBody(); wireAddBody(); }));
    wireAddBody();
    bindLineInputs();
  }
  function wireAddBody(){
    const add=$('#wAdd');
    if(add) add.addEventListener('click',()=>{
      const sku=$('#wPick').value, qty=Math.max(1,+$('#wAddQty').value||1);
      const it=DB.items.find(x=>x.sku===sku); if(!it) return;
      const ex=S.lines.find(l=>l.type==='stock'&&l.sku===sku);
      if(ex){ ex.qty+=qty; } else S.lines.push({type:'stock',sku:it.sku,name:it.name,remark:'',uom:it.uom,qty,price:sellPrice(it),disc:0,tax:'SR'});
      refreshLines();
    });
    const addNs=$('#wAddNs');
    if(addNs) addNs.addEventListener('click',()=>{
      const desc=$('#wNsDesc').value.trim(); if(!desc){ $('#wNsDesc').focus(); return; }
      S.lines.push({type:'nonstock',sku:'',name:desc,remark:'',uom:$('#wNsUom').value.trim()||'lot',qty:Math.max(1,+$('#wNsQty').value||1),price:Math.max(0,+$('#wNsPrice').value||0),disc:0,tax:'SR'});
      refreshLines();
    });
  }
  function refreshLines(){
    $('#wLines').innerHTML=lineRows();
    $('#wLineCount').textContent=`${S.lines.length} line${S.lines.length===1?'':'s'}`;
    $('#wTotals').innerHTML=totalsCard();
    bindLineInputs();
    updateFooter();
  }
  function bindLineInputs(){
    $$('#wLines tr[data-i]').forEach(tr=>{
      const i=+tr.dataset.i, l=S.lines[i];
      const q=tr.querySelector('.wQty'), p=tr.querySelector('.wPrice'), d=tr.querySelector('.wDisc');
      const desc=tr.querySelector('.wDesc'), rem=tr.querySelector('.wRemark'), uom=tr.querySelector('.wUom'), tax=tr.querySelector('.wTax');
      const recalc=()=>{ tr.querySelector('td.tnum b').textContent=money(lineNet(l)); $('#wTotals').innerHTML=totalsCard(); };
      const upd=()=>{ l.qty=Math.max(1,+q.value||1); l.price=Math.max(0,+p.value||0); l.disc=Math.min(100,Math.max(0,+d.value||0)); recalc(); };
      [q,p,d].forEach(el=>el.addEventListener('input',upd));
      desc&&desc.addEventListener('input',()=>l.name=desc.value);
      rem&&rem.addEventListener('input',()=>l.remark=rem.value);
      uom&&!uom.readOnly&&uom.addEventListener('input',()=>l.uom=uom.value);
      tax&&tax.addEventListener('change',()=>{ l.tax=tax.value; recalc(); });
      tr.querySelector('.wDel').addEventListener('click',()=>{ S.lines.splice(i,1); refreshLines(); });
    });
  }

  /* ---------------- STEP 3 — review & confirm ---------------- */
  function step3(){
    const c=cust(), t=totals();
    const avail=c.limit-c.balance, over=t.total>avail;
    const rows=S.lines.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
      <td class="l" style="white-space:nowrap">${l.type==='stock'?`<b class="mono" style="font-size:12px">${esc(l.sku)}</b>`:`<span class="cap neutral" style="font-size:10.5px"><span class="dot"></span>Non-stock</span>`}</td>
      <td class="l li-name"><b>${esc(l.name)}</b>${l.remark?`<small>${esc(l.remark)}</small>`:''}</td>
      <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td><td class="tnum">${money(l.price)}</td>
      <td class="tnum">${l.disc?`<span style="color:var(--warn)">${l.disc}%</span>`:'—'}</td>
      <td class="l">${esc(l.tax||'SR')}</td>
      <td class="tnum"><b>${money(lineNet(l))}</b></td></tr>`).join('');
    const initials=c.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    return `<div class="docmeta" style="margin-bottom:16px">
        <div class="dm"><small>Customer</small><div class="partner"><span class="pav">${esc(initials)}</span><b>${esc(c.name)}</b></div></div>
        <div class="dm"><small>Order date</small><b>${esc(S.orderDate)}</b></div>
        <div class="dm"><small>Requested delivery</small><b>${esc(S.delivery)}</b></div>
        <div class="dm"><small>Terms</small><b>${esc(S.terms)} · ${esc(DB.company.currency)}</b></div>
        <div class="dm"><small>Warehouse</small><b>${esc(S.warehouse)}</b></div>
        <div class="dm"><small>Customer PO</small><b>${S.reference?esc(S.reference):'—'}</b></div>
        <div class="dm"><small>Ship to</small><b>${(()=>{const a=S.shipSame?S.billTo:S.shipTo;return a.city?esc([a.city,a.state].filter(Boolean).join(', '))+(S.shipSame?' · same as bill-to':''):'—';})()}</b></div>
        ${S.attachments.length?`<div class="dm"><small>Attachments</small><b>${S.attachments.length} file${S.attachments.length===1?'':'s'}</b></div>`:''}
      </div>
      <div class="doclayout"><div class="docmain">
        <div class="panel"><div class="panel-h">${ic('receipt')}<h3>Order lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${S.lines.length} lines</span></div>
          <div style="overflow-x:auto"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Stock code</th><th class="l">Description</th><th>Qty</th><th>Unit price</th><th>Disc</th><th class="l">GST</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">${totalsCard()}</div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Approval routing</div>
          ${over
            ?indicator({tone:'warn',icon:'flow',label:'Over available credit',value:money0(t.total-avail),sub:`Exceeds ${money0(avail)} available — routes to Finance for approval on submit.`})
            :indicator({tone:'ok',icon:'checkc',label:'Within credit limit',value:money0(avail-t.total),sub:'Posts directly as Approved — no extra sign-off needed.'})}
        </div>
      </aside></div>`;
  }

  /* ---------------- shell / render ---------------- */
  const steps=[['Customer','handshake'],['Order lines','box'],['Review','checkc']];
  function stepper(){ return wizardStepper(steps, S.step, S.reached); }
  function canAdvance(){ if(S.step===0) return !!S.customer; if(S.step===1) return S.lines.length>0; return true; }
  function footer(){
    const adv=canAdvance();
    const right=S.step<2
      ? btn('Continue',{icon:'arrowR',cls:'primary',sm:false,attrs:`id="wNext" ${adv?'':'disabled style="opacity:.5;pointer-events:none"'}`})
      : btn('Save as draft',{icon:'file',cls:'soft',sm:false,attrs:'id="wDraft"'})+btn('Create order',{icon:'check',cls:'primary',sm:false,attrs:'id="wCreate"'});
    const left=S.step>0?btn('Back',{icon:'chevL',cls:'soft',attrs:'id="wBack"'}):btn('Cancel',{cls:'soft',attrs:'id="wCancel"'});
    const hint=S.step===0?'Step 1 of 3 · choose who this order is for'
      :S.step===1?`Step 2 of 3 · ${S.lines.length} line${S.lines.length===1?'':'s'} added`
      :'Step 3 of 3 · review, then create';
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div><div class="grow"></div>${left}${right}`;
  }
  function body(){ return S.step===0?step1():S.step===1?step2():step3(); }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Sales Order">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'Sales','Orders',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('bag')}New Sales Order</div>
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
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('sales-orders'));
    const draft=$('#wDraft'); draft&&draft.addEventListener('click',()=>{
      const t=totals(), c=cust();
      navigate('sales-orders');
      setTimeout(()=>toast(`Sales order SO-26-0419 saved as draft for ${c.name} · ${money0(t.total)}`,'ok'),180);
    });
    const create=$('#wCreate'); create&&create.addEventListener('click',()=>{
      const t=totals(), c=cust(), over=t.total>(c.limit-c.balance);
      navigate('sales-orders');
      setTimeout(()=>toast(`Sales order SO-26-0419 created for ${c.name} · ${money0(t.total)}${over?' · sent for approval':' · approved'}`,'ok'),180);
    });
  }
  render();
};
