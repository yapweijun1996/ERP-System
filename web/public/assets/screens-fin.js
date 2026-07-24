/* ============================================================
   ARIA ERP — screens: Sales Orders, Sales Order doc, Journal, Payment
   ============================================================ */

/* ---------------- SALES ORDERS (listing) ---------------- */
SCREENS['sales-orders'] = async function(root){
  await prepareCanonicalSalesData();
  const NOW=DB.soNow||'2026-06-12';

  const isOpen = s => s.status!=='Closed' && s.status!=='Cancelled';
  const daysTo = d => Math.round((new Date(d)-new Date(NOW))/86400000);
  function payTone(p){ return {Paid:'ok',Partial:'info',Overdue:'danger',Unpaid:'neutral','—':'neutral'}[p]||'neutral'; }

  /* derived fulfilment status from done / items */
  function fulfil(s){
    if(s.done<=0) return {key:'not',label:t('so.ful.not'),tone:'neutral',bar:''};
    if(s.done>=s.items) return {key:'full',label:t('so.ful.full'),tone:'ok',bar:'ok'};
    return {key:'partial',label:t('so.ful.partial'),tone:'info',bar:'warn'};
  }
  /* delivery urgency for open orders only */
  function urgency(s){
    if(!isOpen(s)) return null;
    const dd=daysTo(s.deliver);
    if(dd<0) return {tone:'danger',label:t('so.due.late')};
    if(dd<=3) return {tone:'warn',label:t('so.due.soon')};
    return null;
  }

  const chips=[['all',t('common.all')],['draft',ts('Draft')],['approval',ts('Pending Approval')],['approved',ts('Approved')],['closed',ts('Closed')],['cancelled',ts('Cancelled')]];
  const chipMap={draft:'Draft',approval:'Pending Approval',approved:'Approved',closed:'Closed',cancelled:'Cancelled'};

  /* ---- KPI summary ---- */
  function kpiData(){
    const open=DB.salesOrders.filter(isOpen);
    const openVal=open.reduce((a,s)=>a+s.total,0);
    const overdue=DB.salesOrders.filter(s=>s.payStatus==='Overdue').reduce((a,s)=>a+s.total,0);
    const pending=DB.salesOrders.filter(s=>s.status==='Pending Approval').length;
    const dueWeek=open.filter(s=>{const d=daysTo(s.deliver);return d>=0&&d<=7;}).length;
    return [
      {label:t('so.kpi.openorders'),val:open.length,f:'all'},
      {label:t('so.kpi.open'),val:money0(openVal)},
      {label:t('so.kpi.overdueamt'),val:money0(overdue),neg:true},
      {label:t('so.kpi.pending'),val:pending,f:'approval',accent:pending>0},
      {label:t('so.kpi.dueweek'),val:dueWeek},
    ];
  }

  /* ---- main table ---- */
  function fulCell(s){ const f=fulfil(s); const pct=Math.round(s.done/Math.max(1,s.items)*100);
    return `<span class="fulcell"><span class="minibar"><i class="${f.bar}" style="width:${pct}%"></i></span><b class="fnum" data-tip="${esc(f.label)}">${s.done} / ${s.items}</b></span>`; }
  function dueCell(s){ const u=urgency(s); return `<span class="duecell ${u?('due-'+u.tone):''}">${esc(s.deliver)}${u?`<small>${esc(u.label)}</small>`:''}</span>`; }

  /* ---- actions ---- */
  function canOpen(no){ return Boolean(DB.salesOrderDocs&&DB.salesOrderDocs[no]); }
  function menuItems(s){
    return [
      ...(canOpen(s.no)?[{id:'view',icon:'ext',label:t('so.act.view')}]:[]),
      {id:'print',icon:'print',label:t('so.act.print')},
    ];
  }
  function openDoc(no){ if(canOpen(no)) navigate('sales-order',{no}); }
  function runAction(id,s){
    if(id==='view'){ openDoc(s.no); return; }
    const msg={print:'Sales order sent to printer'}[id]||id;
    const tone={print:'info'}[id]||'info';
    toast(msg+' · '+s.no,tone);
  }
  const columns=[
    {label:t('so.col.no'),sticky:true,w:'minmax(140px,1.4fr)',render:s=>`<div class="cellsub"><b class="docnum">${esc(s.no)}</b><small><span class="posttag ${s.posted?'posted':''}">${esc(s.posted?t('so.post.posted'):t('so.post.unposted'))}</span></small></div>`},
    {label:t('so.col.customer'),align:'l',sortable:true,w:'minmax(140px,1.6fr)',render:s=>`<div class="partnercell">${profileAvatar({name:s.cust,cls:'pmini',size:26})}<span class="cellsub"><b>${esc(s.cust)}</b><small>${esc(s.custCode)}</small></span></div>`},
    {label:t('so.col.date'),align:'l',sortable:true,w:'minmax(92px,0.9fr)',render:s=>`<span class="muted-date">${esc(s.date)}</span>`},
    {label:t('so.col.deliver'),align:'l',w:'minmax(100px,1fr)',render:dueCell},
    {label:t('col.owner'),align:'l',w:'minmax(84px,0.9fr)',render:s=>esc(s.owner)},
    {label:t('so.col.fulfilled'),align:'l',w:'minmax(116px,1.1fr)',render:fulCell},
    {label:t('col.payment'),align:'l',w:'minmax(90px,1fr)',render:s=>cap(ts(s.payStatus),payTone(s.payStatus))},
    {label:t('col.total'),align:'r',sortable:true,w:'minmax(108px,0.9fr)',render:s=>`<b class="tnum">${money(s.total)}</b>`},
    {label:t('so.col.order'),align:'l',cls:'cap-cell',w:'minmax(146px,1.3fr)',render:s=>statusBadge(s.status)+(s.flag?` <span class="flagic" data-tip="${esc(s.flag)}">${ic('warn')}</span>`:'')},
    {label:'',align:'c',w:'56px',render:()=>transactionRowMenuButton(t('so.act.menu'))},
  ];
  transactionListPage(root,{
    module:'sales',
    route:'sales-orders',
    title:t('so.title'),
    description:t('so.subtitle'),
    rows:DB.salesOrders,
    rowId:s=>s.no,
    count:visible=>`${visible.length} ${t('so.orders')}`,
    checkable:true,
    primaryAction:{label:t('so.new'),icon:'plus',onClick:()=>navigate('new-sales-order')},
    kpis:kpiData().map(k=>({
      label:k.label,
      value:k.val,
      filter:k.f,
      negative:k.neg,
      accent:k.accent,
    })),
    filters:chips,
    filterFn:(s,key)=>s.status===chipMap[key],
    columns,
    rowMenu:s=>menuItems(s).map(item=>({
      ...item,
      run:()=>runAction(item.id,s),
    })),
    rowAction:{
      label:s=>`${t('common.open')} ${s.no}`,
      enabled:s=>canOpen(s.no),
      run:s=>openDoc(s.no),
    },
    empty:{icon:'bag',title:t('so.empty')},
  });
};

/* tiny inline dropdown helper for saved views */
function togglePopList(anchorSel, items, onPick){
  const a=$(anchorSel); const r=a.getBoundingClientRect();
  let m=document.createElement('div'); m.className='pop show'; m.style.cssText=`width:220px;top:${r.bottom+6}px;left:${r.left}px;right:auto;padding:6px`;
  m.innerHTML=items.map(it=>`<button class="menu-item" data-v="${esc(it.label)}">${ic(it.icon||'list')}<span>${esc(it.label)}</span></button>`).join('')+`<div style="border-top:1px solid var(--hairline);margin-top:4px"><button class="menu-item" style="color:var(--accent)">${ic('plus')}<span>${esc(typeof t==='function'?t('common.saveview'):'Save current view…')}</span></button></div>`;
  document.body.appendChild(m);
  const close=()=>{m.remove();document.removeEventListener('click',out);};
  const out=(e)=>{ if(!m.contains(e.target)&&e.target!==a){close();} };
  m.querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click',()=>{onPick(b.dataset.v);close();}));
  setTimeout(()=>document.addEventListener('click',out),10);
}

/* ---------------- SALES ORDER (transaction document) ---------------- */
SCREENS['sales-order'] = async function(root, params){
  await prepareCanonicalSalesData();
  const d=(params&&params.no&&DB.salesOrderDocs&&DB.salesOrderDocs[params.no])||DB.so0418;
  if(!d) throw new Error('No canonical sales order is available.');
  const c=d.cust||{name:'Unknown customer',balance:0,limit:null,overdue:0};
  const calc=()=>{
    let sub=0; d.lines.forEach(l=>sub+=l.qty*l.price*(1-l.disc/100));
    const tax=sub*d.taxRate; const total=sub+tax+d.shipping;
    return {sub,tax,total};
  };
  const {tax,total}=calc();
  const addrBlock=(icon,label,a,withTax)=>{
    if(!a) return '';
    const cityline=[a.city,a.state].filter(Boolean).join(', ')+(a.post?' '+a.post:'');
    return `<div class="addr-col">
      <div class="addr-h">${ic(icon)}${esc(label)}</div>
      <div class="addr-name">${esc(a.name)}</div>
      <div class="addr-lines">${[a.line1,a.line2,cityline,a.country].filter(Boolean).map(esc).join('<br>')}</div>
      ${a.contact?`<div class="addr-meta">${esc(a.contact)}${a.email?` · <a href="#" onclick="return false">${esc(a.email)}</a>`:''}</div>`:''}
      ${withTax&&a.tax?`<div class="addr-meta">${esc(t('doc.taxid'))} ${esc(a.tax)}</div>`:''}
    </div>`;
  };
  const hasCreditLimit=Number(c.limit)>0;
  const creditUsed=salesNumber(c.balance)+total;
  const creditPct=hasCreditLimit?Math.round(creditUsed/Number(c.limit)*100):0;
  const overLimit=hasCreditLimit&&creditUsed>Number(c.limit);

  /* status-aware stepper: Closed/Invoiced orders show the full chain as done */
  const STEP_LABELS=[ts('Draft'),t('appr.step.submitted'),ts('Pending Approval'),ts('Approved'),t('doc.step.delivered'),t('doc.step.invoiced')];
  const stepIdx=({'Draft':0,'Submitted':1,'Pending Approval':2,'Approved':3,'Delivered':4,'Invoiced':6,'Closed':6})[d.status]??2;
  const stepperHtml=`<div class="stepper">${STEP_LABELS.map((s,i)=>{
    const cls=i<stepIdx?'done':(i===stepIdx?'current':'');
    const dot=i<stepIdx?ic('check'):(i===stepIdx?ic('clock'):'');
    return `<div class="step ${cls}"><span class="sdot">${dot}</span>${esc(s)}</div>`+(i<STEP_LABELS.length-1?`<span class="stepline ${i<stepIdx?'done':''}"></span>`:'');
  }).join('')}</div>`;

  /* approval alert only when the DATA warrants it (short stock / discount over threshold) */
  const shortNames=d.lines.filter(l=>l.qty>l.avail).map(l=>l.name);
  const discLines=d.lines.filter(l=>l.disc>10).map(l=>`${l.disc}% on ${l.name}`);
  const alertReasons=[
    ...discLines.map(x=>`a line discount (${x}) exceeds the 10% rep threshold`),
    ...shortNames.map(n=>`${n} is short on stock`),
  ];
  const showAlert=d.status!=='Closed'&&d.status!=='Invoiced'&&alertReasons.length>0;
  const taxLabel=`Tax (${Math.round(d.taxRate*100)}% ${(DB.company&&DB.company.taxRegime)||'GST'})`;

  const lineRows=d.lines.map((l,i)=>{
    const ext=l.qty*l.price*(1-l.disc/100); const short=l.qty>l.avail;
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)}${short?` · <span style="color:var(--danger)">${esc(t('doc.onlyavail').replaceAll('{n}',l.avail))}</span>`:` · ${esc(t('doc.avail').replaceAll('{n}',l.avail))}`}</small></td>
      <td class="tnum">${num(l.qty)} ${esc(l.uom)}</td>
      <td class="tnum">${money(l.price)}</td>
      <td class="tnum">${l.disc?`<span style="color:var(--warn)">${l.disc}%</span>`:'—'}</td>
      <td class="c">${short?cap(t('doc.short'),'danger'):cap(t('doc.ok'),'ok')}</td>
      <td class="tnum"><b>${money(ext)}</b></td></tr>`;
  }).join('');

  root.innerHTML=`<div class="content full"><section class="master"><div class="pagehead">${crumbs([DB.company.name,{label:t('nav.sales'),route:'sales-home'},{label:t('so.title'),route:'sales-orders'},{cur:d.no}])}${typeof salesNav==='function'?salesNav('sales-orders'):''}</div><div class="docwrap"><div class="docpage" style="padding-top:4px">
    <div class="dochead">
      <div class="dh-row1">
        <div><div class="dt">${ic('bag')}${esc(t('doc.so'))} <span class="dnum">${esc(d.no)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(t('doc.custref'))} ${esc(d.ref)} · ${esc(t('doc.owner'))} ${esc(d.owner)}</div></div>
        <div class="dactions">${statusBadge(d.status)}${d.status==='Draft'?btn('Confirm order',{icon:'check',cls:'primary',attrs:'data-act="confirm-order"'}):''}${btn(t('common.print'),{icon:'print',cls:'soft'})}<button class="btn soft sm" id="soMoreBtn" data-tip="More actions" aria-haspopup="menu" aria-expanded="false" aria-label="More actions">${ic('more')}<span>${esc(t('usr.more'))}</span></button></div>
      </div>
      ${stepperHtml}
      <div class="docmeta">
        <div class="dm"><small>${esc(t('common.customer'))}</small><div class="partner">${profileAvatar({name:c.name,cls:'pav',size:26})}<b>${esc(c.name)}</b></div></div>
        <div class="dm"><small>${esc(t('so.col.date'))}</small><b>${esc(d.date)}</b></div>
        <div class="dm"><small>${esc(t('so.col.deliver'))}</small><b>${esc(d.deliver)}</b></div>
        <div class="dm"><small>${esc(t('common.warehouse'))}</small><b>${esc(d.warehouse)}</b></div>
        <div class="dm"><small>${esc(t('doc.terms'))}</small><b>${esc(d.terms)} · ${esc(d.currency)}</b></div>
      </div>
      <div class="docaddr">
        ${addrBlock('receipt',t('doc.billto'),d.billTo,true)}
        ${addrBlock('truck',t('doc.shipto'),d.shipTo,false)}
      </div>
    </div>

    ${showAlert?`<div class="alert warn" style="margin:0 0 14px"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('doc.so.alert'))}</b> ${esc(alertReasons.join(', and '))}.</span></div>`:''}

    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>${esc(t('appr.panel.lines'))}</h3></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(t('appr.col.item'))}</th><th>${esc(t('appr.col.qty'))}</th><th>${esc(t('appr.col.unitprice'))}</th><th>${esc(t('doc.col.disc'))}</th><th class="c">${esc(t('doc.col.stock'))}</th><th>${esc(t('appr.col.amount'))}</th></tr></thead><tbody>${lineRows}</tbody></table>
          <div class="linefoot" style="display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px"><span>${esc(t('doc.linesunits').replaceAll('{n}',d.lines.length).replaceAll('{u}',d.lines.reduce((s,l)=>s+l.qty,0)))}</span><span>Canonical order lines</span></div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>${t('doc.notes')}</h3></div>
          <div class="panel-body docnotes">
            <div class="note-block">
              <div class="note-h">${ic('comment')}${esc(t('doc.custnote'))}<span class="note-sub">${t('doc.custnote.sub')}</span></div>
              <p>${esc(d.note)}</p>
            </div>
            <div class="note-block internal">
              <div class="note-h">${ic('lock')}${esc(t('doc.intmemo'))}<span class="note-sub">${t('doc.intmemo.sub')}</span></div>
              <p>${esc(d.memo)}</p>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>${esc(t('doc.activity'))}</h3>
            <div class="ph-act" id="soTabs"><button class="tab on" data-t="audit">${esc(t('doc.tab.audit'))}</button><button class="tab" data-t="attach">${esc(t('doc.tab.attach'))}</button><button class="tab" data-t="comments">${esc(t('doc.tab.comments'))}</button><button class="tab" data-t="related">${esc(t('doc.tab.related'))}</button></div>
          </div>
          <div class="panel-body" id="soTabBody"></div>
        </div>
      </div>

      <aside class="summary">
        <div class="sumcard">
          <div class="sumrow"><span class="sk2">${esc(t('doc.sub.afterdisc'))}</span><span class="sv tnum">${money(d.lines.reduce((s,l)=>s+l.qty*l.price,0))}</span></div>
          <div class="sumrow disc"><span class="sk2">${esc(t('doc.discgiven'))}</span><span class="sv tnum">−${money(d.lines.reduce((s,l)=>s+l.qty*l.price*(l.disc/100),0))}</span></div>
          <div class="sumrow"><span class="sk2">${esc(t('doc.shipping'))}</span><span class="sv tnum">${money(d.shipping)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(taxLabel)}</span><span class="sv tnum">${money(tax)}</span></div>
          <div class="sumrow total"><span class="sk2">${esc(t('col.total'))}</span><span class="sv tnum">${money(total)}</span></div>
        </div>
        <div class="sumcard">
          <div class="sectitle" style="margin-top:0">${esc(t('doc.custcredit'))}</div>
          ${hasCreditLimit
            ?indicator({tone:overLimit?'danger':creditPct>85?'warn':'ok',icon:'handshake',label:overLimit?t('doc.overcredit'):t('doc.creditlimit'),value:money0(creditUsed)+' / '+money0(c.limit),sub:t('doc.balanceplus').replaceAll('{b}',money0(c.balance)).replaceAll('{t}',money0(total)).replaceAll('{x}',overLimit?t('doc.apprrequired'):t('doc.withinlimit')),pct:creditPct})
            :indicator({tone:'neutral',icon:'handshake',label:t('doc.creditlimit'),value:'—',sub:'Credit limits are not modeled in the canonical customer master yet.'})}
          ${c.overdue>0?`<div style="margin-top:8px">${indicator({tone:'warn',icon:'receipt',label:t('doc.overduerec'),value:money0(c.overdue),sub:t('doc.overduesub')})}</div>`:''}
        </div>
        <div class="sumcard">
          <div class="sectitle" style="margin-top:0">${esc(t('doc.actions'))}</div>
          <p style="font-size:12px;color:var(--muted);margin:0">${d.rawStatus==='draft'?'Confirming this draft issues stock, creates the invoice and posts the balanced journal in one transaction.':'This posted order is immutable. Corrections must use a return or reversal workflow.'}</p>
        </div>
      </aside>
    </div>
    <div style="height:50px"></div>
  </div></div></section></div>
  <div class="pop moremenu" id="soMoreMenu" style="width:250px" role="menu" aria-label="More actions">
    <div class="menu-section">
      <div class="menu-head">${esc(d.no)}</div>
      <button class="menu-item" data-act="export" role="menuitem">${ic('download')}<span>Export as PDF</span></button>
      <button class="menu-item" data-act="link" role="menuitem">${ic('link')}<span>Copy link</span><span class="meta mono">${esc(d.no)}</span></button>
    </div>
    <div class="menu-section">
      <button class="menu-item" data-act="history" role="menuitem">${ic('history')}<span>View change history</span></button>
    </div>
  </div>`;

  const body=$('#soTabBody');
  function tab(t){
    $$('#soTabs .tab').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
    if(t==='audit') body.innerHTML=auditTrail([
      {kind:'current',when:esc(d.date),what:`Order status — <b>${esc(d.status)}</b>`,who:'System'},
      {kind:'add',when:esc(d.date),what:'Canonical sales order created',who:'System'},
    ]);
    else if(t==='attach') body.innerHTML='<div class="empty">No canonical attachments.</div>';
    else if(t==='comments') body.innerHTML='<div class="empty">No canonical comments.</div>';
    else body.innerHTML=relatedDocs(
      d.rawStatus==='confirmed'
        ?[{no:'INV-'+d.no,label:'Posted sales invoice',meta:d.cust.name,status:'Posted'}]
        :[],
    );
  }
  $$('#soTabs .tab').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.t)));
  tab('audit');

  /* ---- Confirm draft: live cross-module transaction in PGlite ---- */
  const confirmBtn=root.querySelector('[data-act="confirm-order"]');
  confirmBtn&&confirmBtn.addEventListener('click',async()=>{
    if(!(window.ErpSystemData&&window.ErpSystemData.action)){ toast('ERP data adapter not loaded','warn'); return; }
    confirmBtn.disabled=true; confirmBtn.querySelector('span')&&(confirmBtn.querySelector('span').textContent='Confirming…');
    try{
      if(!Number.isSafeInteger(d.warehouseId)) throw new Error('No warehouse is available for this order.');
      const response=await window.ErpSystemData.action(
        'sales/orders',
        d.id,
        'confirm',
        {warehouseId:d.warehouseId},
        'sales-confirm-'+d.id,
      );
      const res=response.data;
      toast(d.no+' confirmed — stock issued, '+res.invDocNo+' posted to GL ('+money(res.total)+')','ok');
      await prepareCanonicalSalesData();
      navigate('sales-order',{no:d.no});   // re-render from refreshed data
    }catch(e){
      toast((e&&e.message)||'Confirm failed','danger');
      confirmBtn.disabled=false; confirmBtn.querySelector('span')&&(confirmBtn.querySelector('span').textContent='Confirm order');
    }
  });

  /* ---- More overflow menu ---- */
  const moreBtn=$('#soMoreBtn');
  moreBtn&&moreBtn.addEventListener('click',e=>{ e.stopPropagation(); togglePop('soMoreMenu', moreBtn); });
  $$('#soMoreMenu [data-act]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation(); closeAllPops();
    const a=b.dataset.act;
    if(a==='export') toast('Exporting '+d.no+' as PDF…','info');
    else if(a==='link'){ const url=location.origin+location.pathname+'#sales-order'; (navigator.clipboard&&navigator.clipboard.writeText(url).catch(()=>{})); toast('Link to '+d.no+' copied','ok'); }
    else if(a==='history'){ tab('audit'); toast('Showing change history','info'); }
  }));
};

/* ---------------- JOURNAL ENTRY (finance transaction) ---------------- */
function manualJournalViewCopy(){
  const packs={
    en:{back:'Back to journals',reverse:'Reverse journal',title:'Reverse this journal?',body:'A reversal never edits the posted facts. It creates a separately numbered journal with every debit and credit swapped.',number:'Reversal number',date:'Posting date',reason:'Correction reason',reasonPh:'Explain why this posted journal must be reversed',cancel:'Cancel',confirm:'Create reversal',working:'Reversing…',done:'Reversal journal posted',required:'Number, posting date and reason are required.',immutable:'Posted journal legs are immutable.',correct:'Corrections require a separately numbered reversal journal.',postedAudit:'Posted to GL — balanced debit and credit',sourceAudit:'Created from canonical source'},
    ms:{back:'Kembali ke jurnal',reverse:'Balikkan jurnal',title:'Balikkan jurnal ini?',body:'Pembalikan tidak mengubah fakta yang telah dipos. Ia mencipta jurnal bernombor berasingan dengan debit dan kredit ditukar.',number:'Nombor pembalikan',date:'Tarikh posting',reason:'Sebab pembetulan',reasonPh:'Terangkan sebab jurnal ini perlu dibalikkan',cancel:'Batal',confirm:'Cipta pembalikan',working:'Membalikkan…',done:'Jurnal pembalikan dipos',required:'Nombor, tarikh posting dan sebab diperlukan.',immutable:'Baris jurnal yang telah dipos tidak boleh diubah.',correct:'Pembetulan memerlukan jurnal pembalikan bernombor berasingan.',postedAudit:'Dipos ke GL — debit dan kredit seimbang',sourceAudit:'Dicipta daripada sumber kanonik'},
    zh:{back:'返回凭证列表',reverse:'冲销凭证',title:'冲销此凭证？',body:'冲销不会修改已过账事实，而是创建独立编号、借贷方向完全相反的新凭证。',number:'冲销凭证编号',date:'过账日期',reason:'更正原因',reasonPh:'说明为什么必须冲销此已过账凭证',cancel:'取消',confirm:'创建冲销凭证',working:'冲销中…',done:'冲销凭证已过账',required:'必须填写编号、过账日期和原因。',immutable:'已过账凭证明细不可修改。',correct:'更正必须使用独立编号的冲销凭证。',postedAudit:'已过账至总账 — 借贷平衡',sourceAudit:'由真实数据源创建'},
    ja:{back:'仕訳一覧へ戻る',reverse:'仕訳を取消',title:'この仕訳を逆仕訳しますか？',body:'逆仕訳は転記済事実を編集せず、借方と貸方を入れ替えた別番号の仕訳を作成します。',number:'逆仕訳番号',date:'転記日',reason:'訂正理由',reasonPh:'転記済仕訳を取り消す理由を入力',cancel:'取消',confirm:'逆仕訳を作成',working:'処理中…',done:'逆仕訳を転記しました',required:'番号、転記日、理由は必須です。',immutable:'転記済仕訳明細は変更できません。',correct:'訂正には別番号の逆仕訳が必要です。',postedAudit:'GLへ転記 — 貸借一致',sourceAudit:'標準ソースから作成'},
    vi:{back:'Về danh sách bút toán',reverse:'Đảo bút toán',title:'Đảo bút toán này?',body:'Bút toán đảo không sửa dữ kiện đã ghi sổ. Nó tạo bút toán số riêng với toàn bộ Nợ và Có được hoán đổi.',number:'Số bút toán đảo',date:'Ngày ghi sổ',reason:'Lý do điều chỉnh',reasonPh:'Giải thích vì sao phải đảo bút toán đã ghi sổ',cancel:'Hủy',confirm:'Tạo bút toán đảo',working:'Đang đảo…',done:'Đã ghi sổ bút toán đảo',required:'Bắt buộc có số, ngày ghi sổ và lý do.',immutable:'Các dòng đã ghi sổ là bất biến.',correct:'Điều chỉnh phải dùng bút toán đảo có số riêng.',postedAudit:'Đã ghi vào GL — Nợ và Có cân bằng',sourceAudit:'Tạo từ nguồn chuẩn'},
  };
  return packs[typeof getLang==='function'?getLang():'en']||packs.en;
}

function journalDetailCopy(){
  const packs={
    en:{title:'Journal Entry',source:'source',date:'Date',period:'Period',prepared:'Prepared by',type:'Type',lines:'Journal lines',account:'Account',dimension:'Dimension',debit:'Debit',credit:'Credit',totals:'Totals',balanced:'Balanced',out:'Out of balance',audit:'Audit trail',totalDebit:'Total debit',totalCredit:'Total credit',difference:'Difference',entryBalances:'Entry balances',mustBalance:'Entry must balance',postToGl:'Posted to General Ledger',postIrrev:'Posting is irreversible and writes to the ledger for period {p}.',periodStatus:'Period status',open:'Open',empty:'No journal entry is available',emptyHelp:'No canonical posted journal exists for the current company.',error:'Journal entry could not be loaded.',retry:'Retry'},
    ms:{title:'Catatan Jurnal',source:'sumber',date:'Tarikh',period:'Tempoh',prepared:'Disediakan oleh',type:'Jenis',lines:'Baris jurnal',account:'Akaun',dimension:'Dimensi',debit:'Debit',credit:'Kredit',totals:'Jumlah',balanced:'Seimbang',out:'Tidak seimbang',audit:'Jejak audit',totalDebit:'Jumlah debit',totalCredit:'Jumlah kredit',difference:'Perbezaan',entryBalances:'Catatan seimbang',mustBalance:'Catatan mesti seimbang',postToGl:'Dipos ke Lejar Am',postIrrev:'Posting tidak boleh dibatalkan dan menulis ke lejar untuk tempoh {p}.',periodStatus:'Status tempoh',open:'Terbuka',empty:'Tiada catatan jurnal tersedia',emptyHelp:'Tiada jurnal kanonik dipos untuk syarikat semasa.',error:'Catatan jurnal tidak dapat dimuatkan.',retry:'Cuba lagi'},
    zh:{title:'会计凭证',source:'来源',date:'日期',period:'期间',prepared:'制单人',type:'类型',lines:'凭证明细',account:'科目',dimension:'维度',debit:'借方',credit:'贷方',totals:'合计',balanced:'已平衡',out:'不平衡',audit:'审计轨迹',totalDebit:'借方合计',totalCredit:'贷方合计',difference:'差额',entryBalances:'借贷平衡',mustBalance:'凭证必须平衡',postToGl:'已过账至总账',postIrrev:'过账不可撤销，并写入 {p} 期间的总账。',periodStatus:'期间状态',open:'开放',empty:'没有可用的会计凭证',emptyHelp:'当前公司尚无 Canonical 已过账凭证。',error:'无法加载会计凭证。',retry:'重试'},
    ja:{title:'仕訳伝票',source:'ソース',date:'日付',period:'期間',prepared:'作成者',type:'種類',lines:'仕訳明細',account:'勘定科目',dimension:'ディメンション',debit:'借方',credit:'貸方',totals:'合計',balanced:'貸借一致',out:'貸借不一致',audit:'監査証跡',totalDebit:'借方合計',totalCredit:'貸方合計',difference:'差額',entryBalances:'仕訳は貸借一致',mustBalance:'仕訳は一致が必要',postToGl:'総勘定元帳へ転記済',postIrrev:'転記は取り消せず、期間 {p} の元帳に記録されます。',periodStatus:'期間ステータス',open:'オープン',empty:'利用可能な仕訳がありません',emptyHelp:'現在の会社には Canonical 転記済仕訳がありません。',error:'仕訳を読み込めませんでした。',retry:'再試行'},
    vi:{title:'Bút toán nhật ký',source:'nguồn',date:'Ngày',period:'Kỳ',prepared:'Người lập',type:'Loại',lines:'Dòng bút toán',account:'Tài khoản',dimension:'Chiều phân tích',debit:'Nợ',credit:'Có',totals:'Tổng cộng',balanced:'Cân bằng',out:'Không cân bằng',audit:'Dấu vết kiểm toán',totalDebit:'Tổng Nợ',totalCredit:'Tổng Có',difference:'Chênh lệch',entryBalances:'Bút toán cân bằng',mustBalance:'Bút toán phải cân bằng',postToGl:'Đã ghi vào Sổ Cái',postIrrev:'Việc ghi sổ không thể hoàn tác và được ghi vào kỳ {p}.',periodStatus:'Trạng thái kỳ',open:'Mở',empty:'Không có bút toán khả dụng',emptyHelp:'Công ty hiện tại chưa có bút toán Canonical đã ghi sổ.',error:'Không thể tải bút toán.',retry:'Thử lại'},
  };
  return packs[typeof getLang==='function'?getLang():'en']||packs.en;
}

function openJournalReversal(j,mj){
  const date=new Date().toISOString().slice(0,10);
  appModal({icon:'refresh',title:mj.title,body:`<div class="risk warn">${ic('warn')}<div><b>${esc(mj.body)}</b></div></div><div class="fldrow c2" style="margin-top:14px"><div class="fld"><span>${esc(mj.number)}</span><input data-reversal-number value="${esc(j.no+'-REV')}"></div><div class="fld"><span>${esc(mj.date)}</span><input type="date" data-reversal-date value="${date}"></div></div><div class="fld" style="margin-top:12px"><span>${esc(mj.reason)}</span><textarea data-reversal-reason placeholder="${esc(mj.reasonPh)}"></textarea></div>`,actions:`${btn(mj.cancel,{cls:'soft',attrs:'data-reversal-cancel'})}${btn(mj.confirm,{icon:'refresh',cls:'primary',attrs:'data-reversal-confirm'})}`});
  document.querySelector('[data-reversal-cancel]')?.addEventListener('click',closeModal);
  document.querySelector('[data-reversal-confirm]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    const docNo=document.querySelector('[data-reversal-number]')?.value.trim();
    const postingDate=document.querySelector('[data-reversal-date]')?.value;
    const reason=document.querySelector('[data-reversal-reason]')?.value.trim();
    if(!docNo||!postingDate||!reason){toast(mj.required,'danger');return;}
    button.disabled=true;button.querySelector('span')&&(button.querySelector('span').textContent=mj.working);
    try{
      const response=await window.ErpSystemData.action('finance/journals',j.manualJournalId,'reverse',{docNo,postingDate,reason},`manual-journal-reverse-${j.manualJournalId}-${docNo}`);
      closeModal();toast(mj.done,'ok');await prepareCanonicalFinanceData();navigate('journal-entry',{no:response.data.reversal.docNo});
    }catch(error){toast((error&&error.message)||mj.required,'danger');button.disabled=false;button.querySelector('span')&&(button.querySelector('span').textContent=mj.confirm);}
  });
}

SCREENS['journal-entry'] = async function(root, params){
  const mj=manualJournalViewCopy();
  const copy=journalDetailCopy();
  try{
    await prepareCanonicalFinanceData();
  }catch(error){
    postingDetailPage(root,{
      module:'finance',route:'journal-entry',title:copy.title,description:copy.error,
      error:{title:copy.error,description:error&&error.message||copy.error,retryLabel:copy.retry,onRetry:()=>navigate('journal-entry',params)},
      empty:{icon:'book',title:copy.empty,description:copy.emptyHelp},
    });
    return;
  }
  const j=(params&&params.no&&DB.journalDocs&&DB.journalDocs[params.no])||DB.je0611;
  if(!j){
    postingDetailPage(root,{
      module:'finance',route:'journal-entry',title:copy.title,description:copy.emptyHelp,
      empty:{icon:'book',title:copy.empty,description:copy.emptyHelp},
    });
    return;
  }
  const totDr=j.lines.reduce((s,l)=>s+l.dr,0), totCr=j.lines.reduce((s,l)=>s+l.cr,0);
  const balanced=Math.abs(totDr-totCr)<0.005;
  const canReverse=!!(j.manualJournalId&&j.rawStatus==='posted'&&j.journalType!=='reversal');
  const main=`<section class="posting-detail-card" data-posting-lines>
      <div class="posting-detail-card-head"><h3>${esc(copy.lines)}</h3></div>
      <div class="posting-lines-scroll">
        <table class="posting-lines-table"><thead><tr>
          <th class="c">#</th><th class="l">${esc(copy.account)}</th><th class="l">${esc(copy.dimension)}</th>
          <th class="r">${esc(copy.debit)}</th><th class="r">${esc(copy.credit)}</th>
        </tr></thead><tbody>${j.lines.map((line,index)=>`<tr>
          <td class="c">${index+1}</td>
          <td class="l"><b>${esc(line.acct)} · ${esc(line.name)}</b></td>
          <td class="l"><small>${esc(line.dim)}</small></td>
          <td class="r tnum">${line.dr?money(line.dr):'—'}</td>
          <td class="r tnum">${line.cr?money(line.cr):'—'}</td>
        </tr>`).join('')}</tbody></table>
      </div>
      <div class="posting-lines-footer" data-posting-totals>
        <small>${esc(copy.totals)}</small><span class="tnum">Dr ${money(totDr)}</span>
        <span class="tnum">Cr ${money(totCr)}</span>${balanced?cap(copy.balanced,'ok'):cap(copy.out,'danger')}
      </div>
    </section>
    <section class="posting-detail-card" data-posting-audit>
      <div class="posting-detail-card-head"><h3>${esc(copy.audit)}</h3></div>
      <div class="posting-audit-body">${auditTrail([
        {kind:'current',when:esc(j.date),what:mj.postedAudit,who:j.by},
        {kind:'add',when:esc(j.date),what:mj.sourceAudit+' — '+esc(j.memo),who:j.by},
      ])}</div>
    </section>`;
  const context={body:`<section class="posting-context-card" data-posting-balance>
      <small>${esc(copy.entryBalances)}</small>
      <div class="posting-balance-row"><span>${esc(copy.totalDebit)}</span><b class="tnum">${money(totDr)}</b></div>
      <div class="posting-balance-row"><span>${esc(copy.totalCredit)}</span><b class="tnum">${money(totCr)}</b></div>
      <div class="posting-balance-row total"><span>${esc(copy.difference)}</span><b class="tnum">${money(Math.abs(totDr-totCr))}</b></div>
      ${balanced?indicator({tone:'ok',icon:'checkc',label:copy.entryBalances,value:'Dr = Cr'}):indicator({tone:'danger',icon:'warn',label:copy.mustBalance,value:'≠'})}
    </section>
    <section class="posting-context-card"><small>${esc(copy.postToGl)}</small>
      <p>${esc(j.manualJournalId?`${mj.immutable} ${mj.correct}`:copy.postIrrev.replaceAll('{p}',j.period))}</p>
    </section>
    <section class="posting-context-card"><small>${esc(copy.periodStatus)}</small>
      ${indicator({tone:'neutral',icon:'lock',label:j.period,value:j.status,sub:mj.immutable})}
    </section>`};
  const actions=j.manualJournalId?[
    {label:mj.back,icon:'chevleft',cls:'soft',attrs:'data-manual-journal-back',onClick:()=>navigate('journal-entry')},
    ...(canReverse?[{label:mj.reverse,icon:'refresh',cls:'primary',sm:false,attrs:'data-manual-journal-reverse',onClick:()=>openJournalReversal(j,mj)}]:[]),
  ]:[];
  const postingRoot=postingDetailPage(root,{
    module:'finance',route:'journal-entry',title:copy.title,
    description:`${j.memo} · ${copy.source} ${j.source}`,
    identity:{title:copy.title,code:j.no,meta:j.memo},
    status:{label:j.status,tone:j.status==='Posted'?'teal':'neutral'},
    facts:[
      {label:copy.date,value:j.date},
      {label:copy.period,value:`${j.period}${j.manualJournalId?'':` · ${copy.open}`}`},
      {label:copy.prepared,value:j.by},
      {label:copy.type,value:j.source},
    ],
    main,context,actions,
  });
  if(j.manualJournalId)postingRoot?.setAttribute('data-manual-journal-detail','canonical');
};

/* ---------------- PAYMENT VOUCHER ----------------
   Real per-voucher detail (not a hardcoded PV-26-0203 record). No approval workflow
   exists in the schema — a voucher is created-and-settled atomically — so there's no
   Approve/Hold action here, matching the honest "one document, one balanced posting"
   shape createPaymentVoucherWithin implements. */
async function prepareCanonicalPaymentVoucherData(){
  await prepareCanonicalPurchasingData();
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(Array.isArray(DB.paymentVouchers)) return;
    throw new Error('The offline canonical payment voucher snapshot is unavailable.');
  }
  const pages=await Promise.all([
    listPage('finance/payment-vouchers'),
    listPage('finance/payment-voucher-lines'),
  ]);
  const [vouchers,lines]=pages.map(p=>p.data);
  const supplierById=new Map(DB.suppliers.map(s=>[s.id,s]));
  const invoiceById=new Map(DB.supplierInvoices.map(i=>[i.id,i]));
  const linesByVoucher=new Map();
  lines.forEach(row=>{
    const arr=linesByVoucher.get(row.paymentVoucherId)||[];
    arr.push(row);
    linesByVoucher.set(row.paymentVoucherId,arr);
  });
  DB.paymentVouchers=vouchers.map(row=>{
    const supplier=supplierById.get(row.supplierId)||{};
    const voucherLines=(linesByVoucher.get(row.id)||[]).map(l=>{
      const invoice=invoiceById.get(l.supplierInvoiceId)||{};
      return {supplierInvoiceId:l.supplierInvoiceId,invoiceNo:invoice.no||`#${l.supplierInvoiceId}`,amount:financeNumber(l.amount)};
    });
    return {
      id:row.id,
      no:row.docNo,
      date:dateValue(row.paymentDate),
      bankRef:row.bankRef||'',
      supplierId:row.supplierId,
      supplierName:supplier.name||`Supplier #${row.supplierId}`,
      total:financeNumber(row.totalAmount),
      lines:voucherLines,
    };
  }).sort((a,b)=>b.id-a.id);
}

function paymentVoucherCopy(){
  const packs={
    en:{title:'Payment Voucher',sub:'Canonical supplier settlement',posted:'Posted',payTo:'Pay to',date:'Date',bankRef:'Bank reference',invoiceCount:'Invoices settled',invoices:'Invoices settled',supplierInvoice:'Supplier invoice',amount:'Amount',net:'Net payment',balance:'Payment balances',debit:'Debit · Accounts Payable',credit:'Credit · Cash & Bank',difference:'Difference',balanced:'Posting balances',supplierBalance:'Supplier balance',remaining:'Remaining open balance',outstanding:'unpaid invoices still outstanding.',recent:'Recent vouchers',audit:'Audit trail',postedAudit:'Payment posted — supplier invoices settled',sourceAudit:'Created from canonical payment voucher',newVoucher:'New voucher',empty:'No payment vouchers yet',emptyHelp:'Settle a real unpaid supplier invoice to see it here.',error:'Payment vouchers could not be loaded.',retry:'Retry'},
    ms:{title:'Baucar Bayaran',sub:'Penyelesaian pembekal kanonik',posted:'Dipos',payTo:'Bayar kepada',date:'Tarikh',bankRef:'Rujukan bank',invoiceCount:'Invois diselesaikan',invoices:'Invois diselesaikan',supplierInvoice:'Invois pembekal',amount:'Amaun',net:'Bayaran bersih',balance:'Baki posting',debit:'Debit · Akaun Belum Bayar',credit:'Kredit · Tunai & Bank',difference:'Perbezaan',balanced:'Posting seimbang',supplierBalance:'Baki pembekal',remaining:'Baki terbuka',outstanding:'invois belum bayar masih tertunggak.',recent:'Baucar terkini',audit:'Jejak audit',postedAudit:'Bayaran dipos — invois pembekal diselesaikan',sourceAudit:'Dicipta daripada baucar bayaran kanonik',newVoucher:'Baucar baharu',empty:'Belum ada baucar bayaran',emptyHelp:'Selesaikan invois pembekal sebenar yang belum dibayar untuk melihatnya di sini.',error:'Baucar bayaran tidak dapat dimuatkan.',retry:'Cuba lagi'},
    zh:{title:'付款凭证',sub:'Canonical 供应商结算',posted:'已过账',payTo:'付款对象',date:'日期',bankRef:'银行参考号',invoiceCount:'已结算发票',invoices:'已结算发票',supplierInvoice:'供应商发票',amount:'金额',net:'付款净额',balance:'过账平衡',debit:'借方 · 应付账款',credit:'贷方 · 现金与银行',difference:'差额',balanced:'借贷平衡',supplierBalance:'供应商余额',remaining:'剩余未结余额',outstanding:'未付款发票仍待结算。',recent:'最近付款凭证',audit:'审计轨迹',postedAudit:'付款已过账 — 供应商发票已结算',sourceAudit:'由 Canonical 付款凭证创建',newVoucher:'新建付款凭证',empty:'尚无付款凭证',emptyHelp:'结算一张真实的未付款供应商发票后即可在此查看。',error:'无法加载付款凭证。',retry:'重试'},
    ja:{title:'支払伝票',sub:'Canonical 仕入先決済',posted:'転記済',payTo:'支払先',date:'日付',bankRef:'銀行参照',invoiceCount:'決済済請求書',invoices:'決済済請求書',supplierInvoice:'仕入先請求書',amount:'金額',net:'正味支払額',balance:'転記残高',debit:'借方 · 買掛金',credit:'貸方 · 現金・預金',difference:'差額',balanced:'転記は貸借一致',supplierBalance:'仕入先残高',remaining:'未決済残高',outstanding:'未払請求書が残っています。',recent:'最近の伝票',audit:'監査証跡',postedAudit:'支払を転記 — 仕入先請求書を決済',sourceAudit:'Canonical 支払伝票から作成',newVoucher:'新規伝票',empty:'支払伝票はまだありません',emptyHelp:'実際の未払仕入先請求書を決済すると、ここに表示されます。',error:'支払伝票を読み込めませんでした。',retry:'再試行'},
    vi:{title:'Phiếu chi',sub:'Thanh toán nhà cung cấp Canonical',posted:'Đã ghi sổ',payTo:'Thanh toán cho',date:'Ngày',bankRef:'Tham chiếu ngân hàng',invoiceCount:'Hóa đơn đã thanh toán',invoices:'Hóa đơn đã thanh toán',supplierInvoice:'Hóa đơn nhà cung cấp',amount:'Số tiền',net:'Thanh toán ròng',balance:'Cân đối ghi sổ',debit:'Nợ · Phải trả người bán',credit:'Có · Tiền mặt & Ngân hàng',difference:'Chênh lệch',balanced:'Bút toán cân bằng',supplierBalance:'Số dư nhà cung cấp',remaining:'Số dư còn mở',outstanding:'hóa đơn chưa thanh toán vẫn còn.',recent:'Phiếu gần đây',audit:'Dấu vết kiểm toán',postedAudit:'Đã ghi sổ thanh toán — hóa đơn nhà cung cấp đã tất toán',sourceAudit:'Tạo từ phiếu chi Canonical',newVoucher:'Phiếu mới',empty:'Chưa có phiếu chi',emptyHelp:'Thanh toán một hóa đơn nhà cung cấp thực tế để xem tại đây.',error:'Không thể tải phiếu chi.',retry:'Thử lại'},
  };
  return packs[typeof getLang==='function'?getLang():'en']||packs.en;
}

SCREENS['payment-voucher'] = async function(root, params){
  const copy=paymentVoucherCopy();
  const newVoucherAction={label:copy.newVoucher,icon:'plus',cls:'primary',onClick:()=>navigate('new-payment-voucher')};
  try{
    await prepareCanonicalPaymentVoucherData();
  }catch(error){
    postingDetailPage(root,{
      module:'finance',route:'payment-voucher',title:copy.title,description:copy.error,
      error:{title:copy.error,description:error&&error.message||copy.error,retryLabel:copy.retry,onRetry:()=>navigate('payment-voucher',params)},
      empty:{icon:'coins',title:copy.empty,description:copy.emptyHelp},
      headerAction:newVoucherAction,
    });
    return;
  }
  const requestedId=params&&params.voucherId?Number(params.voucherId):null;
  const v=requestedId?DB.paymentVouchers.find(x=>x.id===requestedId):DB.paymentVouchers[0];
  if(!v){
    postingDetailPage(root,{
      module:'finance',route:'payment-voucher',title:copy.title,description:copy.emptyHelp,
      headerAction:newVoucherAction,
      empty:{icon:'coins',title:copy.empty,description:copy.emptyHelp,action:newVoucherAction},
    });
    return;
  }
  const supplier=DB.suppliers.find(s=>s.id===v.supplierId);
  const recent=DB.paymentVouchers.slice(0,8);
  const main=`<section class="posting-detail-card" data-posting-lines>
      <div class="posting-detail-card-head"><h3>${esc(copy.invoices)}</h3><span class="grow"></span><small class="tnum">${v.lines.length}</small></div>
      <div class="posting-lines-scroll">
        <table class="posting-lines-table"><thead><tr>
          <th class="c">#</th><th class="l">${esc(copy.supplierInvoice)}</th><th class="r">${esc(copy.amount)}</th>
        </tr></thead><tbody>${v.lines.length?v.lines.map((line,index)=>`<tr>
          <td class="c">${index+1}</td><td class="l"><b>${esc(line.invoiceNo)}</b></td>
          <td class="r tnum"><b>${money(line.amount)}</b></td>
        </tr>`).join(''):`<tr><td colspan="3"><div class="posting-inline-empty">${ic('receipt')}<span>${esc(copy.emptyHelp)}</span></div></td></tr>`}</tbody></table>
      </div>
      <div class="posting-lines-footer" data-posting-totals><small>${esc(copy.net)}</small><span class="tnum">${money(v.total)}</span>${cap(copy.posted,'ok')}</div>
    </section>
    <section class="posting-detail-card" data-posting-audit>
      <div class="posting-detail-card-head"><h3>${esc(copy.audit)}</h3></div>
      <div class="posting-audit-body">${auditTrail([
        {kind:'current',when:esc(v.date),what:copy.postedAudit,who:'System'},
        {kind:'add',when:esc(v.date),what:`${copy.sourceAudit} — ${esc(v.supplierName)}`,who:'System'},
      ])}</div>
    </section>`;
  const context={body:`<section class="posting-context-card" data-posting-balance>
      <small>${esc(copy.balance)}</small>
      <div class="posting-balance-row"><span>${esc(copy.debit)}</span><b class="tnum">${money(v.total)}</b></div>
      <div class="posting-balance-row"><span>${esc(copy.credit)}</span><b class="tnum">${money(v.total)}</b></div>
      <div class="posting-balance-row total"><span>${esc(copy.difference)}</span><b class="tnum">${money(0)}</b></div>
      ${indicator({tone:'ok',icon:'checkc',label:copy.balanced,value:'Dr = Cr'})}
    </section>
    ${supplier?`<section class="posting-context-card"><small>${esc(copy.supplierBalance)}</small>
      ${indicator({tone:'ok',icon:'bank',label:copy.remaining,value:money0(supplier.balance),sub:`${esc(supplier.name)} · ${esc(copy.outstanding)}`})}
    </section>`:''}
    ${recent.length>1?`<section class="posting-context-card"><small>${esc(copy.recent)}</small>
      <div data-related-vouchers>${relatedDocs(recent.map(row=>({no:row.no,label:row.supplierName,meta:money0(row.total),status:copy.posted})))}</div>
    </section>`:''}`};
  const postingRoot=postingDetailPage(root,{
    module:'finance',route:'payment-voucher',title:copy.title,
    description:`${v.supplierName} · ${copy.sub}`,
    identity:{title:copy.title,code:v.no,meta:v.supplierName},
    status:{label:copy.posted,tone:'ok'},
    facts:[
      {label:copy.payTo,value:v.supplierName},
      {label:copy.date,value:v.date},
      {label:copy.bankRef,value:v.bankRef||'—'},
      {label:copy.invoiceCount,value:v.lines.length,numeric:true},
    ],
    main,context,headerAction:newVoucherAction,
  });
  postingRoot?.setAttribute('data-payment-voucher-detail','canonical');
  postingRoot?.querySelectorAll('[data-related-vouchers] .mli').forEach((element,index)=>{
    element.addEventListener('click',()=>navigate('payment-voucher',{voucherId:recent[index].id}));
  });
};
