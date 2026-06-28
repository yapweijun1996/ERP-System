/* ============================================================
   ARIA ERP — New Payment Voucher wizard (create flow)
   2 steps: Select invoices → Payment & review. Pick a supplier,
   choose which open AP invoices to settle (early-pay discounts
   applied automatically), set the bank / method / date, then
   post. Closes the procure-to-pay loop. Reached from Quick
   create, the command palette and the Payment Voucher screen.
   ============================================================ */
SCREENS['new-payment-voucher'] = function(root){
  const TODAY='2026-06-22';
  const BANKS=[
    {id:'hsbc',  label:'HSBC Operating · ••4021', cur:'USD'},
    {id:'mayb',  label:'Maybank Current · ••8830', cur:'USD'},
    {id:'ocbc',  label:'OCBC FCY · ••1107', cur:'USD'},
  ];
  const METHODS=['Telegraphic transfer','Local bank transfer','Cheque'];

  // Synthesize each supplier's open invoices so the set sums to their AP balance.
  function openInvoices(code){
    const sup=DB.suppliers.find(s=>s.code===code); if(!sup) return [];
    let h=0; for(const c of code)h=(h*31+c.charCodeAt(0))>>>0;
    const n=2+(h%3); // 2–4 invoices
    const weights=Array.from({length:n},(_,i)=>((h>>(i*3))&7)+2);
    const wsum=weights.reduce((a,b)=>a+b,0);
    const grns=['0186','0181','0177','0173'];
    return weights.map((w,i)=>{
      const amt=Math.round(sup.balance*w/wsum/100)*100;
      const dueDay=5+((h>>>(i*3))%25); // 5–29, always valid
      const due=`2026-06-${String(dueDay).padStart(2,'0')}`;
      const early=dueDay>22; // due after today (2026-06-22) → 2% early-pay discount
      return { no:`SI-26-0${610-i}`, grn:`GRN-26-${grns[i]||'0170'}`, amount:amt, due,
        disc: early?Math.round(amt*0.02):0, sel:true };
    });
  }

  const S={ step:0, reached:0,
    supplier:'', date:TODAY, bank:'hsbc', method:'Telegraphic transfer', reference:'', invoices:[] };

  const sup=()=>DB.suppliers.find(s=>s.code===S.supplier);
  function totals(){
    let gross=0, disc=0;
    S.invoices.filter(i=>i.sel).forEach(i=>{ gross+=i.amount; disc+=i.disc; });
    return {gross, disc, net:gross-disc, count:S.invoices.filter(i=>i.sel).length};
  }

  /* ---------------- STEP 1 — supplier & invoice selection ---------------- */
  function invRows(){
    if(!S.invoices.length) return `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:26px">Select a supplier to load their open invoices.</td></tr>`;
    return S.invoices.map((inv,i)=>`<tr data-i="${i}" style="${inv.sel?'':'opacity:.5'}">
      <td style="text-align:center"><button class="set-tgl ${inv.sel?'on':''}" data-sel="${i}" role="switch" aria-checked="${inv.sel}" style="width:38px;height:23px"><span class="set-tgl-k" style="width:17px;height:17px"></span></button></td>
      <td class="l li-name"><b>${esc(inv.no)}</b><small>${esc(inv.grn)}</small></td>
      <td class="l">${esc(inv.due)}</td>
      <td class="tnum">${money(inv.amount)}</td>
      <td class="tnum" style="color:${inv.disc?'var(--ok)':'var(--muted)'}">${inv.disc?'−'+money(inv.disc):'—'}</td>
      <td class="tnum"><b>${money(inv.amount-inv.disc)}</b></td></tr>`).join('');
  }
  function step1(){
    const s=sup();
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('truck')}<h3>Pay to supplier</h3></div>
        <div class="panel-body">
          <div class="fld"><span>Supplier <span class="req">*</span></span>
            <select id="wSup"><option value="">Choose a supplier…</option>
              ${DB.suppliers.map(s=>`<option value="${s.code}" ${s.code===S.supplier?'selected':''}>${esc(s.name)} · open ${money0(s.balance)}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Open invoices</h3>
          ${s?`<div style="margin-left:auto;display:flex;gap:6px"><button class="btn soft sm" id="wAll">Select all</button><button class="btn soft sm" id="wNone">Clear</button></div>`:''}</div>
        <table class="lines"><thead><tr><th style="width:54px"></th><th class="l">Invoice</th><th class="l">Due</th><th>Amount</th><th>Early-pay disc.</th><th>Pay now</th></tr></thead>
          <tbody id="wInv">${invRows()}</tbody></table>
      </div>
    </div>
    <aside class="summary" id="wSide">${summaryCard()}</aside></div>`;
  }
  function summaryCard(){
    const t=totals(), s=sup();
    return `<div class="sumcard">
      <div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Payment summary</div>
      <div class="sumrow"><span class="sk2">Invoices selected</span><span class="sv tnum">${t.count}</span></div>
      <div class="sumrow"><span class="sk2">Gross</span><span class="sv tnum">${money(t.gross)}</span></div>
      ${t.disc?`<div class="sumrow disc"><span class="sk2">Early-pay discount</span><span class="sv tnum">−${money(t.disc)}</span></div>`:''}
      <div class="sumrow total"><span class="sk2">Net payment</span><span class="sv tnum">${money(t.net)}</span></div>
    </div>
    ${s?`<div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Supplier balance</div>
      ${indicator({tone:'ok',icon:'bank',label:'Open balance after pay',value:money0(s.balance-t.net),sub:`Was ${money0(s.balance)} · ${esc(s.terms)} terms.`})}</div>`:''}`;
  }
  function refreshStep1(){ $('#wInv').innerHTML=invRows(); $('#wSide').innerHTML=summaryCard(); bindInv(); updateFooter(); }
  function bindInv(){
    $$('#wInv [data-sel]').forEach(b=>b.addEventListener('click',()=>{
      const i=+b.dataset.sel; S.invoices[i].sel=!S.invoices[i].sel; refreshStep1();
    }));
  }
  function wire1(){
    const su=$('#wSup'); su.addEventListener('change',()=>{ S.supplier=su.value; S.invoices=openInvoices(su.value); render(); });
    const all=$('#wAll'); all&&all.addEventListener('click',()=>{ S.invoices.forEach(i=>i.sel=true); refreshStep1(); });
    const none=$('#wNone'); none&&none.addEventListener('click',()=>{ S.invoices.forEach(i=>i.sel=false); refreshStep1(); });
    bindInv();
  }

  /* ---------------- STEP 2 — payment & review ---------------- */
  function step2(){
    const t=totals(), s=sup(), bank=BANKS.find(b=>b.id===S.bank);
    const rows=S.invoices.filter(i=>i.sel).map((inv,idx)=>`<tr><td class="lineno">${idx+1}</td>
      <td class="l li-name"><b>${esc(inv.no)}</b><small>${esc(inv.grn)} · due ${esc(inv.due)}</small></td>
      <td class="tnum">${money(inv.amount)}</td>
      <td class="tnum" style="color:${inv.disc?'var(--ok)':'var(--muted)'}">${inv.disc?'−'+money(inv.disc):'—'}</td>
      <td class="tnum"><b>${money(inv.amount-inv.disc)}</b></td></tr>`).join('');
    const initials=s.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('bank')}<h3>Payment details</h3></div>
        <div class="panel-body">
          <div class="fldrow c2">
            <div class="fld"><span>Pay from bank</span><select id="wBank">${BANKS.map(b=>`<option value="${b.id}" ${b.id===S.bank?'selected':''}>${esc(b.label)}</option>`).join('')}</select></div>
            <div class="fld"><span>Method</span><select id="wMethod">${METHODS.map(m=>`<option ${m===S.method?'selected':''}>${m}</option>`).join('')}</select></div>
          </div>
          <div class="fldrow c2" style="margin-top:12px">
            <div class="fld"><span>Payment date</span><input type="date" id="wDate" value="${S.date}"></div>
            <div class="fld"><span>Reference / memo</span><input id="wRef" value="${esc(S.reference)}" placeholder="e.g. June AP run"></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>Invoices being settled</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${t.count} invoice${t.count===1?'':'s'}</span></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Invoice</th><th>Amount</th><th>Discount</th><th>Paid now</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>
    <aside class="summary">
      <div class="docmeta" style="margin:0 0 14px;grid-template-columns:1fr">
        <div class="dm"><small>Pay to</small><div class="partner"><span class="pav">${esc(initials)}</span><b>${esc(s.name)}</b></div></div>
      </div>
      ${summaryCard()}
      <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Posting</div>
        ${indicator({tone:'accent',icon:'flow',label:'Settles to AP',value:money0(t.net),sub:`Debits Accounts Payable, credits ${esc(bank.label)}.`})}
      </div>
    </aside></div>`;
  }
  function wire2(){
    const b=(id,key,ev='change')=>{ const el=$('#'+id); el&&el.addEventListener(ev,()=>S[key]=el.value); };
    b('wBank','bank'); b('wMethod','method'); b('wDate','date'); b('wRef','reference','input');
  }

  /* ---------------- shell ---------------- */
  const steps=[['Select invoices','receipt'],['Payment & review','bank']];
  function stepper(){ return wizardStepper(steps, S.step, S.reached); }
  function canAdvance(){ if(S.step===0) return !!S.supplier && totals().count>0; return true; }
  function footer(){
    const adv=canAdvance();
    const right=S.step<1
      ? btn('Continue',{icon:'arrowR',cls:'primary',sm:false,attrs:`id="wNext" ${adv?'':'disabled style=\"opacity:.5;pointer-events:none\"'}`})
      : btn('Post payment',{icon:'check',cls:'primary',sm:false,attrs:'id="wCreate"'});
    const left=S.step>0?btn('Back',{icon:'chevL',cls:'soft',attrs:'id="wBack"'}):btn('Cancel',{cls:'soft',attrs:'id="wCancel"'});
    const t=totals();
    const hint=S.step===0?(S.supplier?`Step 1 of 2 · ${t.count} invoice(s) · ${money0(t.net)} net`:'Step 1 of 2 · choose a supplier to pay')
      :`Step 2 of 2 · ${money0(t.net)} to ${sup().name}`;
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div><div class="grow"></div>${left}${right}`;
  }
  function body(){ return S.step===0?step1():step2(); }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Payment Voucher">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'Finance','Payment Voucher',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('coins')}New Payment Voucher</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">Draft · supplier settlement · ${esc(DB.company.name)}</div></div>
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
    if(S.step===0)wire1(); else wire2();
  }
  function updateFooter(){ const f=$('#wizFoot'); if(f){ f.innerHTML=footer(); wireShell(); } }
  function wireShell(){
    $$('#viewRoot .step[data-step]').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.step; render(); }));
    const next=$('#wNext'); next&&next.addEventListener('click',()=>{ if(!canAdvance())return; S.step++; S.reached=Math.max(S.reached,S.step); render(); });
    const back=$('#wBack'); back&&back.addEventListener('click',()=>{ S.step--; render(); });
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('payment-voucher'));
    const create=$('#wCreate'); create&&create.addEventListener('click',()=>{
      const t=totals(), s=sup();
      appModal({ icon:'coins', title:'Post payment voucher?',
        body:`<p style="color:var(--muted);font-size:13.5px;margin:0 0 12px">Settle <b>${t.count}</b> invoice${t.count===1?'':'s'} for <b>${esc(s.name)}</b>. This debits Accounts Payable and credits the selected bank.</p>
          <div class="sumrow"><span class="sk2">Gross</span><span class="sv tnum">${money(t.gross)}</span></div>
          ${t.disc?`<div class="sumrow disc"><span class="sk2">Discount</span><span class="sv tnum">−${money(t.disc)}</span></div>`:''}
          <div class="sumrow total"><span class="sk2">Net payment</span><span class="sv tnum">${money(t.net)}</span></div>`,
        actions:`${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Confirm & post',{icon:'check',cls:'primary',attrs:'onclick="closeModal();window.__pvPost&&window.__pvPost()"'})}` });
      window.__pvPost=()=>{ navigate('payment-voucher'); setTimeout(()=>toast(`Payment voucher PV-26-0204 posted · ${s.name} · ${money0(t.net)} · scheduled`,'ok'),180); };
    });
  }
  render();
};
