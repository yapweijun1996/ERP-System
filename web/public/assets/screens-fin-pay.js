/* ============================================================
   ARIA ERP — New Payment Voucher wizard (create flow)
   2 steps: Select invoices → Payment & review. Pick a supplier, choose which
   of their real unpaid invoices to settle in full, set a payment date and
   optional bank reference, then post. Wired to real data (EPIC-024) — no
   partial payments or early-pay discounts (no schema backs either), no bank
   account or payment-method picker (no schema backs them either).
   ============================================================ */
SCREENS['new-payment-voucher'] = async function(root){
  await prepareCanonicalPaymentVoucherData();
  const TODAY=typeof workingPeriodEndDate==='function'?workingPeriodEndDate():new Date().toISOString().slice(0,10);
  const pc=(key,vars)=>{
    let value=t('paymentVoucher.'+key);
    Object.entries(vars||{}).forEach(([name,replacement])=>{ value=value.replaceAll(`{${name}}`,String(replacement)); });
    return value;
  };

  function openInvoicesFor(supplierId){
    return DB.supplierInvoices
      .filter(i=>i.supplierId===supplierId&&i.rawStatus==='unpaid'&&i.outstanding>0)
      .map(i=>({id:i.id,no:i.no,due:i.due,amount:i.outstanding,original:i.total,sel:true}));
  }
  function nextPvNo(vouchers){
    let max=0;
    (vouchers||[]).forEach(v=>{ const m=/(\d+)\s*$/.exec(v.no||''); if(m&&+m[1]>max)max=+m[1]; });
    return 'PV-'+new Date().getFullYear()+'-'+String(max+1).padStart(4,'0');
  }
  const pvDocNo=nextPvNo(DB.paymentVouchers);

  const S={ step:0, reached:0,
    supplierId:null, paymentDate:TODAY, bankRef:'', invoices:[] };

  const sup=()=>DB.suppliers.find(s=>s.id===S.supplierId);
  function totals(){
    let gross=0; S.invoices.filter(i=>i.sel).forEach(i=>gross+=i.amount);
    return {gross, count:S.invoices.filter(i=>i.sel).length};
  }

  /* ---------------- STEP 1 — supplier & invoice selection ---------------- */
  function invRows(){
    if(!S.invoices.length) return `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:26px">${esc(pc(S.supplierId?'noInvoices':'selectSupplierPrompt'))}</td></tr>`;
    return S.invoices.map((inv,i)=>`<tr data-i="${i}" style="${inv.sel?'':'opacity:.5'}">
      <td style="text-align:center"><button class="set-tgl ${inv.sel?'on':''}" data-sel="${i}" role="switch" aria-checked="${inv.sel}" style="width:38px;height:23px"><span class="set-tgl-k" style="width:17px;height:17px"></span></button></td>
      <td class="l li-name"><b>${esc(inv.no)}</b></td>
      <td class="l">${esc(inv.due)}</td>
      <td class="tnum"><b>${money(inv.amount)}</b>${inv.original!==inv.amount?`<small style="display:block;color:var(--muted)">Original ${money(inv.original)}</small>`:''}</td></tr>`).join('');
  }
  function step1(){
    const s=sup();
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('truck')}<h3>${esc(pc('payToSupplier'))}</h3></div>
        <div class="panel-body">
          <div class="fld"><span>${esc(pc('supplier'))} <span class="req">*</span></span>
            <input type="search" id="wSupSearch" class="select-filter" autocomplete="off" placeholder="${esc(t('quickCreate.searchSuppliers'))}" aria-label="${esc(t('quickCreate.searchSuppliers'))}">
            <select id="wSup"><option value="">${esc(pc('chooseSupplier'))}</option>
              ${DB.suppliers.map(s=>`<option value="${s.id}" ${s.id===S.supplierId?'selected':''}>${esc(s.name)} · open ${money0(s.balance)}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>${esc(t('quickCreate.openInvoices'))}</h3>
          ${s?`<div style="margin-left:auto;display:flex;gap:6px"><button class="btn soft sm" id="wAll">${esc(pc('selectAll'))}</button><button class="btn soft sm" id="wNone">${esc(pc('clear'))}</button></div>`:''}</div>
        <table class="lines"><thead><tr><th style="width:54px"></th><th class="l">${esc(t('quickCreate.invoice'))}</th><th class="l">${esc(t('common.date'))}</th><th>${esc(t('appr.col.amount'))}</th></tr></thead>
          <tbody id="wInv">${invRows()}</tbody></table>
      </div>
    </div>
    <aside class="summary" id="wSide">${summaryCard()}</aside></div>`;
  }
  function summaryCard(){
    const total=totals(), s=sup();
    return `<div class="sumcard">
      <div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">${esc(t('quickCreate.paymentSummary'))}</div>
      <div class="sumrow"><span class="sk2">${esc(t('quickCreate.invoicesSelected'))}</span><span class="sv tnum">${total.count}</span></div>
      <div class="sumrow total"><span class="sk2">${esc(t('quickCreate.paymentTotal'))}</span><span class="sv tnum">${money(total.gross)}</span></div>
    </div>
    ${s?`<div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">${esc(pc('supplierBalance'))}</div>
      ${indicator({tone:'ok',icon:'bank',label:pc('openBalanceAfter'),value:money0(s.balance-total.gross),sub:pc('wasBalance',{amount:money0(s.balance)})})}</div>`:''}`;
  }
  function refreshStep1(){ $('#wInv').innerHTML=invRows(); $('#wSide').innerHTML=summaryCard(); bindInv(); updateFooter(); }
  function bindInv(){
    $$('#wInv [data-sel]').forEach(b=>b.addEventListener('click',()=>{
      const i=+b.dataset.sel; S.invoices[i].sel=!S.invoices[i].sel; refreshStep1();
    }));
  }
  function wire1(){
    const su=$('#wSup'); su.addEventListener('change',()=>{
      S.supplierId=su.value?Number(su.value):null;
      S.invoices=S.supplierId?openInvoicesFor(S.supplierId):[];
      render();
    });
    bindSelectFilter($('#wSupSearch'),su,t('quickCreate.noMatches'));
    const all=$('#wAll'); all&&all.addEventListener('click',()=>{ S.invoices.forEach(i=>i.sel=true); refreshStep1(); });
    const none=$('#wNone'); none&&none.addEventListener('click',()=>{ S.invoices.forEach(i=>i.sel=false); refreshStep1(); });
    bindInv();
  }

  /* ---------------- STEP 2 — payment & review ---------------- */
  function step2(){
    const t=totals(), s=sup();
    const rows=S.invoices.filter(i=>i.sel).map((inv,idx)=>`<tr><td class="lineno">${idx+1}</td>
      <td class="l li-name"><b>${esc(inv.no)}</b></td>
      <td class="tnum"><b>${money(inv.amount)}</b></td></tr>`).join('');
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('bank')}<h3>${esc(pc('paymentDetails'))}</h3></div>
        <div class="panel-body">
          <div class="fldrow c2">
            <div class="fld"><span>${esc(pc('paymentDate'))}</span><input type="date" id="wDate" value="${S.paymentDate}"></div>
            <div class="fld"><span>${esc(pc('bankReference'))}</span><input id="wRef" value="${esc(S.bankRef)}" placeholder="${esc(pc('bankPlaceholder'))}"></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('receipt')}<h3>${esc(pc('invoicesSettled'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${esc(pc('invoiceCount',{count:t.count}))}</span></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Invoice</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>
    <aside class="summary">
      <div class="docmeta" style="margin:0 0 14px;grid-template-columns:1fr">
        <div class="dm"><small>${esc(pc('payTo'))}</small><div class="partner">${profileAvatar({name:s.name,src:s.imageUrl||s.photoUrl||s.avatarUrl,cls:'pav',size:26})}<b>${esc(s.name)}</b></div></div>
      </div>
      ${summaryCard()}
      <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">${esc(pc('posting'))}</div>
        ${indicator({tone:'accent',icon:'flow',label:pc('settlesAp'),value:money0(t.gross),sub:pc('postingDesc')})}
      </div>
    </aside></div>`;
  }
  function wire2(){
    const b=(id,key,ev='change')=>{ const el=$('#'+id); el&&el.addEventListener(ev,()=>S[key]=el.value); };
    b('wDate','paymentDate'); b('wRef','bankRef','input');
  }

  /* ---------------- shell ---------------- */
  const steps=[[pc('stepSelect'),'receipt'],[pc('stepReview'),'bank']];
  function stepper(){ return wizardStepper(steps, S.step, S.reached); }
  function canAdvance(){ if(S.step===0) return !!S.supplierId && totals().count>0; return true; }
  function footer(){
    const adv=canAdvance();
    const right=S.step<1
      ? btn('Continue',{icon:'arrowR',cls:'primary',sm:false,attrs:`id="wNext" ${adv?'':'disabled style="opacity:.5;pointer-events:none"'}`})
      : btn(pc('postPayment'),{icon:'check',cls:'primary',sm:false,attrs:'id="wCreate"'});
    const left=S.step>0?btn('Back',{icon:'chevL',cls:'soft',attrs:'id="wBack"'}):btn('Cancel',{cls:'soft',attrs:'id="wCancel"'});
    const t=totals();
    const hint=S.step===0?(S.supplierId?pc('stepOneSelected',{count:t.count,amount:money0(t.gross)}):pc('stepOneChoose'))
      :pc('stepTwo',{amount:money0(t.gross),supplier:sup().name});
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div><div class="grow"></div>${left}${right}`;
  }
  function body(){ return S.step===0?step1():step2(); }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Payment Voucher">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,t('nav.finance'),t('route.payment-voucher'),{cur:t('quickCreate.new')}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><h1 class="dt">${ic('coins')}${esc(pc('title'))}</h1>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(pc('subtitle',{company:DB.company.name}))}</div></div>
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
    const create=$('#wCreate'); create&&create.addEventListener('click',async()=>{
      const t=totals(), s=sup();
      const adapter=window.ErpSystemData;
      if(!adapter||typeof adapter.create!=='function'){ toast('ERP data adapter not loaded','warn'); return; }
      create.disabled=true;
      try{
        const response=await adapter.create('finance/payment-vouchers',{
          docNo:pvDocNo,
          supplierId:s.id,
          paymentDate:S.paymentDate,
          bankRef:S.bankRef.trim()||null,
          supplierInvoiceIds:S.invoices.filter(i=>i.sel).map(i=>i.id),
        });
        const res=response.data;
        await navigate('payment-voucher',{voucherId:res.id});
        toast(`Payment voucher ${pvDocNo} posted · ${s.name} · ${money0(t.gross)}`,'ok');
      }catch(e){
        toast((e&&e.message)||'Post payment failed','danger');
        create.disabled=false;
      }
    });
  }
  render();
};
