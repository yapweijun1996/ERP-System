/* ============================================================
   ARIA ERP — Quotation workflow: create / edit builder (CRUD)
   SCREENS['new-quotation']  — 3 steps: Customer & terms →
   Quote lines → Review & issue.  Handles both create and edit
   (params.edit = quote no). Saves into DB.quotations and returns
   to the Quotations list. Delete is wired from the list.
   ============================================================ */
SCREENS['new-quotation'] = function(root, params){
  const sellPrice = it => +(it.cost*1.45).toFixed(2);
  const TODAY = DB.soNow || '2026-06-21';
  const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
  const OUTPUT_TAX = DB.taxCodes.filter(t=>t.type==='Output');
  const taxRate = code => { const t=DB.taxCodes.find(x=>x.code===code); return t?t.rate/100:0; };
  const termsOpts = ['Net 30','Net 45','Net 60','COD'];

  const editing = params && params.edit ? DB.quotations.find(q=>q.no===params.edit) : null;

  /* prefill lines when editing the seeded detailed quote */
  function seedLines(){
    if(editing && editing.no==='Q-26-0188' && DB.quote0188){
      return DB.quote0188.lines.map(l=>({ type:'stock', sku:l.item, name:l.name, remark:'', uom:l.uom, qty:l.qty, price:l.price, disc:l.disc||0, tax:'SR' }));
    }
    return [];
  }

  const S = {
    step:0, reached:0, addType:'stock',
    customer: editing?(DB.customers.find(c=>c.name===editing.cust)||{}).code||'' : (params&&params.customer)||'',
    quoteDate: editing?editing.date:TODAY,
    valid: editing?editing.valid:addDays(TODAY,14),
    terms: editing?(DB.customers.find(c=>c.name===editing.cust)||{}).terms||'Net 30':'Net 30',
    owner: editing?editing.owner:DB.user.name,
    reference:'', notes:'', prob: editing?editing.prob:50,
    lines: seedLines(),
  };

  const cust = ()=>DB.customers.find(c=>c.code===S.customer);
  const lineNet = l => l.qty*l.price*(1-(l.disc||0)/100);
  function totals(){
    let listSub=0, sub=0, tax=0;
    S.lines.forEach(l=>{ listSub+=l.qty*l.price; const net=lineNet(l); sub+=net; tax+=net*taxRate(l.tax||'SR'); });
    return { listSub, sub, discGiven:listSub-sub, tax, total:sub+tax };
  }

  /* ---------------- STEP 1 — customer & terms ---------------- */
  function step1(){
    const c=cust();
    const credit = c ? (()=>{ const avail=c.limit-c.balance, pct=Math.round(c.balance/c.limit*100);
      return indicator({tone:pct>=95?'danger':pct>=80?'warn':'ok',icon:'shield',label:'Credit available',value:money0(avail),
        sub:`${money0(c.balance)} used of ${money0(c.limit)} limit${c.overdue?` · ${money0(c.overdue)} overdue`:''}.`,pct});
    })() : `<div style="color:var(--muted);font-size:13px;padding:6px 2px">Select a customer to see their credit position.</div>`;
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('handshake')}<h3>Customer</h3></div>
        <div class="panel-body">
          <div class="fld"><span>Quote to <span class="req">*</span></span>
            ${combobox({id:'qCust',value:S.customer,placeholder:'Search customers…',options:DB.customers.map(c=>({value:c.code,label:c.name,sub:c.code}))})}</div>
          ${c?`<div class="fldrow c2" style="margin-top:12px">
            <div class="fld"><span>Default terms</span><input value="${esc(c.terms)}" readonly></div>
            <div class="fld"><span>Status</span><input value="${esc(c.status)}" readonly></div></div>`:''}
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Quote details</h3></div>
        <div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Quote date</span><input type="date" id="qDate" value="${S.quoteDate}"></div>
            <div class="fld"><span>Valid until</span><input type="date" id="qValid" value="${S.valid}"></div>
            <div class="fld"><span>Payment terms</span><select id="qTerms">${termsOpts.map(t=>`<option ${t===S.terms?'selected':''}>${t}</option>`).join('')}</select></div>
          </div>
          <div class="fldrow c2" style="margin-top:12px">
            <div class="fld"><span>Owner</span><select id="qOwner">${DB.salesReps.map(r=>`<option ${r===S.owner?'selected':''}>${esc(r)}</option>`).join('')}</select></div>
            <div class="fld"><span>Customer reference</span><input id="qRef" value="${esc(S.reference)}" placeholder="e.g. RFQ-2208"></div>
          </div>
          <div class="fld" style="margin-top:12px"><span>Notes <span style="text-transform:none;font-weight:500;color:var(--faint)">· prints on the quotation</span></span>
            <textarea id="qNotes" rows="2" placeholder="Lead time, scope, assumptions…">${esc(S.notes)}</textarea></div>
        </div>
      </div>
    </div>
    <aside class="summary"><div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Credit check</div>${credit}</div></aside></div>`;
  }
  function wire1(){
    wireCombobox('qCust',{options:DB.customers.map(c=>({value:c.code,label:c.name,sub:c.code})),onChange:v=>{ S.customer=v; const c=cust(); if(c)S.terms=c.terms; render(); }});
    const bind=(id,key)=>{ const el=$('#'+id); el&&el.addEventListener('change',()=>S[key]=el.value); };
    bind('qDate','quoteDate'); bind('qValid','valid'); bind('qTerms','terms'); bind('qOwner','owner');
    const ref=$('#qRef'); ref&&ref.addEventListener('input',()=>S.reference=ref.value);
    const nt=$('#qNotes'); nt&&nt.addEventListener('input',()=>S.notes=nt.value);
  }

  /* ---------------- STEP 2 — quote lines ---------------- */
  const taxOpts = l => OUTPUT_TAX.map(t=>`<option value="${t.code}" ${(l.tax||'SR')===t.code?'selected':''}>${t.code} · ${t.rate.toFixed(0)}%</option>`).join('');
  function lineRows(){
    if(!S.lines.length) return `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:26px">No items yet — add a stock or non-stock line above.</td></tr>`;
    return S.lines.map((l,i)=>`<tr data-i="${i}">
      <td class="lineno">${i+1}</td>
      <td class="l" style="white-space:nowrap">${l.type==='stock'?`<b class="mono" style="font-size:12px">${esc(l.sku)}</b>`:`<span class="cap neutral" style="font-size:10.5px"><span class="dot"></span>Non-stock</span>`}</td>
      <td class="l" style="min-width:190px"><input class="lineinput l qDesc" value="${esc(l.name)}" placeholder="Description"></td>
      <td><input class="lineinput qQty" type="number" min="1" value="${l.qty}" style="width:58px"></td>
      <td><input class="lineinput qUom" value="${esc(l.uom)}" style="width:50px;text-align:center" ${l.type==='stock'?'readonly':''}></td>
      <td><input class="lineinput qPrice" type="number" min="0" step="0.01" value="${l.price}" style="width:84px"></td>
      <td><input class="lineinput qDisc" type="number" min="0" max="100" value="${l.disc||0}" style="width:50px"></td>
      <td><select class="lineinput qTax" style="width:76px;text-align:left">${taxOpts(l)}</select></td>
      <td class="tnum"><b>${money(lineNet(l))}</b></td>
      <td style="text-align:center"><button class="iconbtn qDel" data-tip="Remove" style="width:28px;height:28px">${ic('trash')}</button></td></tr>`).join('');
  }
  function totalsCard(){
    const t=totals();
    return `<div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Quote summary</div>
      <div class="sumrow"><span class="sk2">Subtotal</span><span class="sv tnum">${money(t.listSub)}</span></div>
      ${t.discGiven?`<div class="sumrow disc"><span class="sk2">Discount given</span><span class="sv tnum">−${money(t.discGiven)}</span></div>`:''}
      <div class="sumrow"><span class="sk2">GST (output)</span><span class="sv tnum">${money(t.tax)}</span></div>
      <div class="sumrow total"><span class="sk2">Quote total</span><span class="sv tnum">${money(t.total)}</span></div>`;
  }
  function addItemBody(){
    if(S.addType==='nonstock'){
      return `<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div class="fld" style="flex:1;min-width:200px"><span>Description <span class="req">*</span></span><input id="qNsDesc" placeholder="e.g. Installation & commissioning"></div>
        <div class="fld" style="width:80px"><span>UoM</span><input id="qNsUom" value="lot"></div>
        <div class="fld" style="width:108px"><span>Unit price</span><input type="number" id="qNsPrice" min="0" step="0.01" value="0"></div>
        <div class="fld" style="width:74px"><span>Qty</span><input type="number" id="qNsQty" min="1" value="1"></div>
        ${btn('Add line',{icon:'plus',cls:'primary',attrs:'id="qAddNs"'})}</div>`;
    }
    return `<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div class="fld" style="flex:1;min-width:240px"><span>Stock item</span>
          <select id="qPick">${DB.items.map(it=>`<option value="${it.sku}">${esc(it.sku)} · ${esc(it.name)} — ${money(sellPrice(it))}/${esc(it.uom)}</option>`).join('')}</select></div>
        <div class="fld" style="width:92px"><span>Qty</span><input type="number" id="qAddQty" min="1" value="1"></div>
        ${btn('Add line',{icon:'plus',cls:'primary',attrs:'id="qAdd"'})}</div>`;
  }
  function step2(){
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('box')}<h3>Add item</h3>
          <div class="seg" id="qType" style="margin-left:auto">
            <button class="seg-b on" data-type="stock">Stock item</button>
            <button class="seg-b" data-type="nonstock">Non-stock</button></div>
        </div>
        <div class="panel-body" id="qAddBody">${addItemBody()}</div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Quote lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)" id="qLineCount">${S.lines.length} line${S.lines.length===1?'':'s'}</span></div>
        <div style="overflow-x:auto"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Code</th><th class="l">Description</th><th>Qty</th><th>UoM</th><th>Unit price</th><th>Disc %</th><th class="l">GST</th><th>Subtotal</th><th></th></tr></thead>
          <tbody id="qLines">${lineRows()}</tbody></table></div>
      </div>
    </div>
    <aside class="summary"><div class="sumcard" id="qTotals">${totalsCard()}</div></aside></div>`;
  }
  function wire2(){
    $$('#qType .seg-b').forEach(b=>b.addEventListener('click',()=>{ S.addType=b.dataset.type; $$('#qType .seg-b').forEach(x=>x.classList.toggle('on',x===b)); $('#qAddBody').innerHTML=addItemBody(); wireAddBody(); }));
    wireAddBody(); bindLineInputs();
  }
  function wireAddBody(){
    const add=$('#qAdd');
    if(add) add.addEventListener('click',()=>{
      const sku=$('#qPick').value, qty=Math.max(1,+$('#qAddQty').value||1);
      const it=DB.items.find(x=>x.sku===sku); if(!it) return;
      const ex=S.lines.find(l=>l.type==='stock'&&l.sku===sku);
      if(ex) ex.qty+=qty; else S.lines.push({type:'stock',sku:it.sku,name:it.name,remark:'',uom:it.uom,qty,price:sellPrice(it),disc:0,tax:'SR'});
      refreshLines();
    });
    const addNs=$('#qAddNs');
    if(addNs) addNs.addEventListener('click',()=>{
      const desc=$('#qNsDesc').value.trim(); if(!desc){ $('#qNsDesc').focus(); return; }
      S.lines.push({type:'nonstock',sku:'',name:desc,remark:'',uom:$('#qNsUom').value.trim()||'lot',qty:Math.max(1,+$('#qNsQty').value||1),price:Math.max(0,+$('#qNsPrice').value||0),disc:0,tax:'SR'});
      refreshLines();
    });
  }
  function refreshLines(){
    $('#qLines').innerHTML=lineRows();
    $('#qLineCount').textContent=`${S.lines.length} line${S.lines.length===1?'':'s'}`;
    $('#qTotals').innerHTML=totalsCard();
    bindLineInputs(); updateFooter();
  }
  function bindLineInputs(){
    $$('#qLines tr[data-i]').forEach(tr=>{
      const i=+tr.dataset.i, l=S.lines[i];
      const q=tr.querySelector('.qQty'), p=tr.querySelector('.qPrice'), d=tr.querySelector('.qDisc');
      const desc=tr.querySelector('.qDesc'), uom=tr.querySelector('.qUom'), tax=tr.querySelector('.qTax');
      const recalc=()=>{ tr.querySelector('td.tnum b').textContent=money(lineNet(l)); $('#qTotals').innerHTML=totalsCard(); };
      const upd=()=>{ l.qty=Math.max(1,+q.value||1); l.price=Math.max(0,+p.value||0); l.disc=Math.min(100,Math.max(0,+d.value||0)); recalc(); };
      [q,p,d].forEach(el=>el.addEventListener('input',upd));
      desc&&desc.addEventListener('input',()=>l.name=desc.value);
      uom&&!uom.readOnly&&uom.addEventListener('input',()=>l.uom=uom.value);
      tax&&tax.addEventListener('change',()=>{ l.tax=tax.value; recalc(); });
      tr.querySelector('.qDel').addEventListener('click',()=>{ S.lines.splice(i,1); refreshLines(); });
    });
  }

  /* ---------------- STEP 3 — review & issue ---------------- */
  function step3(){
    const c=cust(), t=totals();
    const rows=S.lines.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
      <td class="l" style="white-space:nowrap">${l.type==='stock'?`<b class="mono" style="font-size:12px">${esc(l.sku)}</b>`:`<span class="cap neutral" style="font-size:10.5px"><span class="dot"></span>Non-stock</span>`}</td>
      <td class="l li-name"><b>${esc(l.name)}</b></td>
      <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td><td class="tnum">${money(l.price)}</td>
      <td class="tnum">${l.disc?`<span style="color:var(--warn)">${l.disc}%</span>`:'—'}</td>
      <td class="l">${esc(l.tax||'SR')}</td>
      <td class="tnum"><b>${money(lineNet(l))}</b></td></tr>`).join('');
    const initials=c.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    return `<div class="docmeta" style="margin-bottom:16px">
        <div class="dm"><small>Customer</small><div class="partner"><span class="pav">${esc(initials)}</span><b>${esc(c.name)}</b></div></div>
        <div class="dm"><small>Quote date</small><b>${esc(S.quoteDate)}</b></div>
        <div class="dm"><small>Valid until</small><b>${esc(S.valid)}</b></div>
        <div class="dm"><small>Terms</small><b>${esc(S.terms)} · ${esc(DB.company.currency)}</b></div>
        <div class="dm"><small>Owner</small><b>${esc(S.owner)}</b></div>
        <div class="dm"><small>Reference</small><b>${S.reference?esc(S.reference):'—'}</b></div>
      </div>
      <div class="doclayout"><div class="docmain">
        <div class="panel"><div class="panel-h">${ic('receipt')}<h3>Quote lines</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${S.lines.length} lines</span></div>
          <div style="overflow-x:auto"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Code</th><th class="l">Description</th><th>Qty</th><th>Unit price</th><th>Disc</th><th class="l">GST</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="panel"><div class="panel-h">${ic('target')}<h3>Win probability</h3></div><div class="panel-body">
          <div style="display:flex;align-items:center;gap:14px"><input type="range" id="qProb" min="0" max="100" step="5" value="${S.prob}" style="flex:1;accent-color:var(--accent)"><b class="tnum" id="qProbV" style="font-size:18px;min-width:48px;text-align:right">${S.prob}%</b></div>
          <div style="font-size:12px;color:var(--muted);margin-top:8px">Used in the pipeline win-rate and forecast. Set 100% only once the customer has committed.</div>
        </div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">${totalsCard()}</div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Validity</div>
          ${indicator({tone:'info',icon:'clock',label:'Valid until',value:esc(S.valid),sub:`${esc(S.terms)} payment terms · expires if not accepted.`})}
        </div>
      </aside></div>`;
  }
  function wire3(){
    const pr=$('#qProb'); pr&&pr.addEventListener('input',()=>{ S.prob=+pr.value; $('#qProbV').textContent=S.prob+'%'; });
  }

  /* ---------------- shell ---------------- */
  const steps=[['Customer','handshake'],['Quote lines','box'],['Review','checkc']];
  function stepper(){ return wizardStepper(steps, S.step, S.reached); }
  function canAdvance(){ if(S.step===0) return !!S.customer; if(S.step===1) return S.lines.length>0; return true; }
  function footer(){
    const adv=canAdvance();
    const right=S.step<2
      ? btn('Continue',{icon:'arrowR',cls:'primary',sm:false,attrs:`id="qNext" ${adv?'':'disabled style="opacity:.5;pointer-events:none"'}`})
      : btn(editing?'Save quotation':'Issue quotation',{icon:'check',cls:'primary',sm:false,attrs:'id="qSave"'});
    const left=S.step>0?btn('Back',{icon:'chevL',cls:'soft',attrs:'id="qBack"'}):btn('Cancel',{cls:'soft',attrs:'id="qCancel"'});
    const hint=S.step===0?'Step 1 of 3 · who is this quote for'
      :S.step===1?`Step 2 of 3 · ${S.lines.length} line${S.lines.length===1?'':'s'} added`
      :'Step 3 of 3 · review, then issue';
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div><div class="grow"></div>${left}${right}`;
  }
  function body(){ return S.step===0?step1():S.step===1?step2():step3(); }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="${editing?'Edit':'New'} Quotation">
      <div class="scrollarea">
      <div class="pagehead">${crumbs([DB.company.name,{label:'Sales',route:'sales-home'},{label:'Quotations',route:'quotations'},{cur:editing?editing.no:'New'}])}${typeof salesNav==='function'?salesNav('quotations'):''}</div>
      <div class="docwrap" style="overflow:visible"><div class="docpage" style="padding-top:4px">
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('receipt')}${editing?`Edit Quotation <span class="dnum">${esc(editing.no)}</span>`:'New Quotation'}</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">${editing?'Editing draft':'Draft'} · ${esc(DB.company.name)} · ${esc(DB.company.branch)}</div></div>
            <div class="dactions">${cap(editing?editing.status:'Draft','neutral')}</div>
          </div>
          ${stepper()}
        </div>
        <div id="qWizBody">${body()}</div>
        <div style="height:8px"></div>
      </div></div>
      <div class="set-savebar" id="qWizFoot">${footer()}</div>
      </div>
    </section></div>`;
    wireShell();
    if(S.step===0)wire1(); else if(S.step===1)wire2(); else wire3();
  }
  function updateFooter(){ const f=$('#qWizFoot'); if(f){ f.innerHTML=footer(); wireShell(); } }
  function wireShell(){
    $$('#viewRoot .step[data-step]').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.step; render(); }));
    const next=$('#qNext'); next&&next.addEventListener('click',()=>{ if(!canAdvance())return; S.step++; S.reached=Math.max(S.reached,S.step); render(); });
    const back=$('#qBack'); back&&back.addEventListener('click',()=>{ S.step--; render(); });
    const cancel=$('#qCancel'); cancel&&cancel.addEventListener('click',()=>navigate('quotations'));
    const save=$('#qSave'); save&&save.addEventListener('click',()=>{
      const c=cust(), t=totals();
      if(editing){
        Object.assign(editing,{ cust:c.name, custCode:c.code, date:S.quoteDate, valid:S.valid, owner:S.owner, total:t.total, prob:S.prob });
        navigate('quotations'); setTimeout(()=>toast(`${editing.no} updated · ${money0(t.total)}`,'ok'),160);
      } else {
        const no = nextQuoteNo();
        DB.quotations.unshift({ no, date:S.quoteDate, cust:c.name, custCode:c.code, valid:S.valid, owner:S.owner, total:t.total, prob:S.prob, status:'Draft' });
        navigate('quotations'); setTimeout(()=>toast(`Quotation ${no} created for ${c.name} · ${money0(t.total)}`,'ok'),160);
      }
    });
  }
  render();
};

/* next sequential quote number based on existing data */
function nextQuoteNo(){
  let max=190;
  DB.quotations.forEach(q=>{ const m=/Q-26-0(\d+)/.exec(q.no); if(m) max=Math.max(max,+m[1]); });
  return 'Q-26-0'+String(max+1).padStart(3,'0');
}
