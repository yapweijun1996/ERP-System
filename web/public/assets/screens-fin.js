/* ============================================================
   ARIA ERP — screens: Sales Orders, Sales Order doc, Journal, Payment
   ============================================================ */

/* ---------------- SALES ORDERS (listing) ---------------- */
SCREENS['sales-orders'] = function(root){
  const NOW=DB.soNow||'2026-06-12';
  let filter='all';
  let selected=null;

  const isOpen = s => s.status!=='Closed' && s.status!=='Cancelled';
  const daysTo = d => Math.round((new Date(d)-new Date(NOW))/86400000);
  function initials(name){ const p=name.trim().split(/\s+/); return (((p[0]||'')[0]||'')+((p[1]||'')[0]||'')).toUpperCase(); }
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
  function rows(){ return DB.salesOrders.filter(s=> filter==='all' ? true : s.status===chipMap[filter]); }

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
  function kpiBar(){
    return kpiData().map(k=>`<button class="so-kpi ${k.neg?'neg':''} ${k.accent?'accent':''} ${k.f?'clickable':''}" ${k.f?`data-f="${k.f}"`:'disabled'}>
      <small>${esc(k.label)}</small><b class="tnum">${k.val}</b></button>`).join('');
  }

  /* ---- main table ---- */
  function fulCell(s){ const f=fulfil(s); const pct=Math.round(s.done/Math.max(1,s.items)*100);
    return `<span class="fulcell"><span class="minibar"><i class="${f.bar}" style="width:${pct}%"></i></span><b class="fnum" data-tip="${esc(f.label)}">${s.done} / ${s.items}</b></span>`; }
  function dueCell(s){ const u=urgency(s); return `<span class="duecell ${u?('due-'+u.tone):''}">${esc(s.deliver)}${u?`<small>${esc(u.label)}</small>`:''}</span>`; }
  function table(){
    const compact = !!selected;  // detail panel open → condensed columns so nothing is cut off
    const colFull=[
        {label:t('so.col.no'),sticky:true,w:'minmax(140px,1.4fr)',render:s=>`<div class="cellsub"><b class="docnum">${esc(s.no)}</b><small><span class="posttag ${s.posted?'posted':''}">${esc(s.posted?t('so.post.posted'):t('so.post.unposted'))}</span></small></div>`},
        {label:t('so.col.customer'),align:'l',sortable:true,w:'minmax(140px,1.6fr)',render:s=>`<div class="partnercell"><span class="pmini">${esc(initials(s.cust))}</span><span class="cellsub"><b>${esc(s.cust)}</b><small>${esc(s.custCode)}</small></span></div>`},
        {label:t('so.col.date'),align:'l',sortable:true,w:'minmax(92px,0.9fr)',render:s=>`<span class="muted-date">${esc(s.date)}</span>`},
        {label:t('so.col.deliver'),align:'l',w:'minmax(100px,1fr)',render:dueCell},
        {label:t('col.owner'),align:'l',w:'minmax(84px,0.9fr)',render:s=>esc(s.owner)},
        {label:t('so.col.fulfilled'),align:'l',w:'minmax(116px,1.1fr)',render:fulCell},
        {label:t('col.payment'),align:'l',w:'minmax(90px,1fr)',render:s=>cap(ts(s.payStatus),payTone(s.payStatus))},
        {label:t('col.total'),align:'r',sortable:true,w:'minmax(108px,0.9fr)',render:s=>`<b class="tnum">${money(s.total)}</b>`},
        {label:t('so.col.order'),align:'l',cls:'cap-cell',w:'minmax(146px,1.3fr)',render:s=>statusBadge(s.status)+(s.flag?` <span class="flagic" data-tip="${esc(s.flag)}">${ic('warn')}</span>`:'')},
        {label:'',align:'c',w:'56px',render:s=>`<span class="rowact"><button class="so-menu" data-tip="${esc(t('so.act.menu'))}" aria-haspopup="menu" aria-label="${esc(t('so.act.menu'))}" data-no="${esc(s.no)}">${ic('more')}</button></span>`},
    ];
    const colCompact=[
        {label:t('so.col.no'),sticky:true,w:'minmax(150px,1.7fr)',render:s=>`<div class="partnercell"><span class="pmini">${esc(initials(s.cust))}</span><span class="cellsub"><b class="docnum">${esc(s.no)}</b><small>${esc(s.cust)}</small></span></div>`},
        {label:t('so.col.deliver'),align:'l',w:'minmax(94px,1fr)',render:dueCell},
        {label:t('so.col.fulfilled'),align:'l',w:'minmax(96px,1fr)',render:fulCell},
        {label:t('col.total'),align:'r',sortable:true,w:'minmax(104px,0.9fr)',render:s=>`<b class="tnum">${money(s.total)}</b>`},
        {label:t('so.col.order'),align:'l',cls:'cap-cell',w:'minmax(140px,1.4fr)',render:s=>statusBadge(s.status)+(s.flag?` <span class="flagic" data-tip="${esc(s.flag)}">${ic('warn')}</span>`:'')},
        // no per-row ⋯ in compact: the open preview panel already carries the row's actions
    ];
    return buildTable({ checkable:true, rowId:s=>s.no, columns: compact?colCompact:colFull, rows:rows() });
  }

  /* ---- mobile cards ---- */
  function cards(){
    return rows().map(s=>{ const u=urgency(s), pa=primaryAction(s);
      return `<div class="so-card" data-no="${esc(s.no)}">
        <div class="sc-top"><b class="docnum">${esc(s.no)}</b>${statusBadge(s.status)}</div>
        <div class="sc-cust"><span class="pmini">${esc(initials(s.cust))}</span><b>${esc(s.cust)}</b></div>
        <div class="sc-grid">
          <div><small>${esc(t('col.total'))}</small><b class="tnum">${money(s.total)}</b></div>
          <div><small>${esc(t('so.col.deliver'))}</small><b class="${u?('due-'+u.tone):''}">${esc(s.deliver)}${u?` · ${esc(u.label)}`:''}</b></div>
          <div><small>${esc(t('col.payment'))}</small>${cap(ts(s.payStatus),payTone(s.payStatus))}</div>
          <div><small>${esc(t('so.dt.fulfilment'))}</small><b>${s.done} / ${s.items}</b></div>
        </div>
        <div class="sc-act">${btn(pa.label,{icon:pa.icon,cls:'primary',attrs:`data-act="${pa.id}" data-no="${esc(s.no)}"`})}</div>
      </div>`;
    }).join('');
  }

  /* ---- actions ---- */
  function primaryAction(s){
    if(s.status==='Pending Approval') return {id:'approve',icon:'check',label:t('so.act.approve')};
    if(s.status==='Draft') return {id:'edit',icon:'edit',label:t('so.act.edit')};
    if(s.status==='Approved'&&s.done<s.items) return {id:'createdo',icon:'truck',label:t('so.act.createdo')};
    if(s.status==='Approved'&&s.done>=s.items) return {id:'createinv',icon:'receipt',label:t('so.act.createinv')};
    return {id:'view',icon:'ext',label:t('so.act.view')};
  }
  function menuItems(s){
    const it=[{id:'view',icon:'ext',label:t('so.act.view')}];
    if(s.status==='Draft'||s.status==='Pending Approval') it.push({id:'edit',icon:'edit',label:t('so.act.edit')});
    it.push({id:'print',icon:'print',label:t('so.act.print')});
    if(s.status==='Pending Approval') it.push({id:'approve',icon:'check',label:t('so.act.approve')});
    if(s.status==='Approved'&&s.done<s.items) it.push({id:'createdo',icon:'truck',label:t('so.act.createdo')});
    if((s.status==='Approved'||s.status==='Closed')&&s.done>0) it.push({id:'createinv',icon:'receipt',label:t('so.act.createinv')});
    it.push({id:'duplicate',icon:'copy',label:t('so.act.duplicate')});
    if(isOpen(s)) it.push({id:'cancel',icon:'x',label:t('so.act.cancel'),danger:true,sep:true});
    return it;
  }
  function openDoc(no){ (DB.salesOrderDocs&&DB.salesOrderDocs[no]) ? navigate('sales-order',{no}) : toast(t('so.act.view')+' · '+no,'info'); }
  function runAction(id,s){
    if(id==='view'){ openDoc(s.no); return; }
    if(id==='edit'){ navigate('new-sales-order'); return; }
    const msg={print:'Sales order sent to printer',approve:'Order approved',createdo:'Delivery order created',createinv:'Invoice created',duplicate:'Order duplicated',cancel:'Order cancelled'}[id]||id;
    const tone={approve:'ok',createdo:'ok',createinv:'ok',cancel:'danger',duplicate:'info',print:'info'}[id]||'info';
    toast(msg+' · '+s.no,tone);
  }
  function openRowMenu(btnEl,s){
    closeAllPops();
    const r=btnEl.getBoundingClientRect();
    const m=document.createElement('div'); m.className='pop show somenu';
    m.style.cssText=`width:224px;top:${r.bottom+6}px;left:auto;right:${Math.max(8,window.innerWidth-r.right)}px;padding:6px;transform-origin:top right`;
    m.innerHTML=menuItems(s).map(x=>`${x.sep?'<div class="menusep"></div>':''}<button class="menu-item ${x.danger?'danger':''}" data-id="${x.id}">${ic(x.icon)}<span>${esc(x.label)}</span></button>`).join('');
    document.body.appendChild(m);
    const close=()=>{m.remove();document.removeEventListener('click',out);};
    const out=e=>{ if(!m.contains(e.target)&&e.target!==btnEl) close(); };
    m.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>{ runAction(b.dataset.id,s); close(); }));
    setTimeout(()=>document.addEventListener('click',out),10);
  }

  /* ---- detail preview panel ---- */
  function lifecycle(s){
    if(s.status==='Cancelled') return `<div class="tl-step danger"><span class="tl-dot">${ic('x')}</span>${esc(ts('Cancelled'))}</div>`;
    const stages=[ts('Draft'),ts('Pending Approval'),ts('Approved'),t('so.ful.full'),ts('Closed')];
    let reached={Draft:0,'Pending Approval':1,Approved:2,Closed:4}[s.status];
    if(s.status==='Approved'&&s.done>=s.items) reached=3;
    return stages.map((lbl,i)=>{
      const st=i<reached?'done':(i===reached?'current':'');
      return `<div class="tl-step ${st}"><span class="tl-dot">${i<reached?ic('check'):''}</span>${esc(lbl)}</div>`;
    }).join('');
  }
  function detailHTML(){
    const s=DB.salesOrders.find(x=>x.no===selected);
    if(!s) return `<div class="sd-empty">${ic('bag')}<b>${esc(t('so.dt.empty'))}</b><span>${esc(t('so.dt.emptysub'))}</span></div>`;
    const f=fulfil(s), u=urgency(s), pct=Math.round(s.done/Math.max(1,s.items)*100);
    const cust=(DB.customers||[]).find(c=>c.code===s.custCode);
    return `<div class="sd-head">
        <div class="sd-id"><div class="sd-no">${esc(s.no)}</div><div class="sd-cust"><span class="pmini">${esc(initials(s.cust))}</span><b>${esc(s.cust)}</b></div></div>
        <div class="sd-headr">${statusBadge(s.status)}<button class="sd-close" data-sd-close data-tip="Close preview" aria-label="Close preview">${ic('x')}</button></div>
      </div>
      ${s.flag?`<div class="sd-flag">${ic('warn')}<span>${esc(s.flag)}</span></div>`:''}
      <div class="sd-amt"><div><small>${esc(t('col.total'))}</small><b class="tnum">${money(s.total)}</b></div>${cap(ts(s.payStatus),payTone(s.payStatus))}</div>
      <div class="sd-facts">
        <div><small>${esc(t('so.col.date'))}</small><b>${esc(s.date)}</b></div>
        <div><small>${esc(t('so.col.deliver'))}</small><b class="${u?('due-'+u.tone):''}">${esc(s.deliver)}${u?` · ${esc(u.label)}`:''}</b></div>
        <div><small>${esc(t('col.owner'))}</small><b>${esc(s.owner)}</b></div>
        <div><small>${esc(t('so.dt.posting'))}</small><b>${esc(s.posted?t('so.post.posted'):t('so.post.unposted'))}</b></div>
      </div>
      <div class="sd-sec">
        <div class="sd-sec-h"><span>${esc(t('so.dt.fulfilment'))}</span>${cap(f.label,f.tone)}</div>
        <div class="sd-ful"><span class="minibar lg"><i class="${f.bar}" style="width:${pct}%"></i></span><b>${s.done} / ${s.items} ${esc(t('common.lines.suffix'))}</b></div>
      </div>
      <div class="sd-sec">
        <div class="sd-sec-h"><span>${esc(t('so.dt.lifecycle'))}</span></div>
        <div class="sd-timeline">${lifecycle(s)}</div>
      </div>
      ${cust?`<div class="sd-sec"><div class="sd-sec-h"><span>${esc(t('so.dt.creditpos'))}</span></div>
        ${indicator({tone:cust.overdue>0?'warn':'ok',icon:'handshake',label:esc(cust.terms||t('common.customer')),value:money0(cust.balance)+' / '+money0(cust.limit),sub:cust.overdue>0?money0(cust.overdue)+' overdue':t('doc.withinlimit')})}</div>`:''}
      <div class="sd-actions">
        ${btn(t('so.dt.open'),{icon:'ext',cls:'primary',sm:false,attrs:`data-act="view" data-no="${esc(s.no)}"`})}
        <div class="sd-actrow">
          ${s.status==='Pending Approval'?btn(t('common.approve'),{icon:'check',cls:'soft',attrs:`data-act="approve" data-no="${esc(s.no)}"`}):''}
          ${btn(t('common.print'),{icon:'print',cls:'soft',attrs:`data-act="print" data-no="${esc(s.no)}"`})}
        </div>
      </div>`;
  }

  /* ---- compose ---- */
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,t('so.crumb'),t('so.title')])}
      ${typeof salesNav==='function'?salesNav('sales-orders'):''}
      <div class="h1row"><h1>${esc(t('so.title'))}</h1><span class="countchip" id="soCount"></span></div>
    </div>
    <div class="so-kpibar" id="soKpis">${kpiBar()}</div>
    <div class="toolbar">
      <div class="filterchips" id="soChips">${chips.map(c=>`<button class="chip ${c[0]===filter?'on':''}" data-f="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" id="soViews">${ic('star')}<span class="star"></span>${esc(t('so.view.allopen'))}${ic('chevD')}</button>
      ${btn(t('common.filter'),{icon:'filter',cls:'soft'})}${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('so.new'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-sales-order\')"'})}
    </div>
    <div class="so-split">
      <div class="so-tablewrap" id="soTable">${table()}</div>
      <aside class="so-detailwrap ${selected?'':'is-empty'}" id="soDetail">${detailHTML()}</aside>
    </div>
    <div class="so-cards" id="soCards">${cards()}</div>
    <div id="soBulk"></div>
  </section></div>`;

  const setCount=()=>{ $('#soCount').textContent=rows().length+' '+t('so.orders'); };
  setCount();

  function selectRow(no){
    const wasOpen=!!selected;
    selected = (no===selected) ? null : no;   // click selected row again to close
    const nowOpen=!!selected;
    const d=$('#soDetail'); d.classList.toggle('is-empty',!selected); d.innerHTML=detailHTML();
    if(wasOpen!==nowOpen){ $('#soTable').innerHTML=table(); rewire(); }  // swap full ⇄ condensed columns
    $('#soTable').querySelectorAll('.dt-r.sel').forEach(x=>x.classList.remove('sel'));
    if(selected){ const tr=$('#soTable').querySelector(`.dt-r[data-row="${selected}"]`); if(tr) tr.classList.add('sel'); }
    wireDetail();
  }
  function wireDetail(){
    $('#soDetail').querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>{
      const s=DB.salesOrders.find(x=>x.no===b.dataset.no); if(s) runAction(b.dataset.act,s);
    }));
    const x=$('#soDetail').querySelector('[data-sd-close]'); if(x) x.addEventListener('click',()=>selectRow(selected));
  }
  function wireMenus(scope){
    scope.querySelectorAll('.so-menu').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation(); const s=DB.salesOrders.find(x=>x.no===b.dataset.no); if(s) openRowMenu(b,s);
    }));
  }
  function wireCards(){
    $('#soCards').querySelectorAll('.so-card').forEach(card=>{
      card.addEventListener('click',e=>{ if(e.target.closest('[data-act]')) return; openDoc(card.dataset.no); });
    });
    $('#soCards').querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation(); const s=DB.salesOrders.find(x=>x.no===b.dataset.no); if(s) runAction(b.dataset.act,s);
    }));
  }
  function rewire(){
    wireTable($('#soTable'),{
      onRow:(id)=>selectRow(id),
      onSelectionChange:(n)=>{ $('#soBulk').innerHTML=n?`<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('so.bulk.approve'),{icon:'check',cls:'soft'})}${btn(t('so.bulk.release'),{icon:'truck',cls:'soft'})}${btn(t('common.print'),{icon:'print',cls:'soft'})}${btn(t('common.export'),{icon:'download',cls:'soft'})}</div>`:''; }
    });
    wireMenus($('#soTable'));
    $('#soTable').querySelectorAll('.docnum').forEach(el=>{
      el.classList.add('linknum');
      el.addEventListener('click',e=>{
        e.stopPropagation();
        const tr=el.closest('[data-row]'); openDoc(tr?tr.dataset.row:el.textContent.trim());
      });
    });
    if(selected){ const tr=$('#soTable').querySelector(`.dt-r[data-row="${selected}"]`); if(tr) tr.classList.add('sel'); }
  }
  function refreshList(){ $('#soTable').innerHTML=table(); $('#soCards').innerHTML=cards(); setCount(); $('#soBulk').innerHTML=''; rewire(); wireCards(); }

  rewire(); wireCards(); wireDetail();

  function setFilter(f){
    filter=f;
    $('#soChips .chip').forEach(c=>c.classList.toggle('on',c.dataset.f===f));
    $('#soKpis .so-kpi').forEach(k=>k.classList.toggle('active',k.dataset.f===f&&f!=='all'));
    refreshList();
  }
  $('#soChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>setFilter(c.dataset.f)));
  $('#soKpis').querySelectorAll('.so-kpi.clickable').forEach(k=>k.addEventListener('click',()=>setFilter(k.dataset.f)));
  $('#soViews').addEventListener('click',()=>{
    togglePopList('#soViews', DB.savedViews['sales-orders'].map(v=>({label:v,icon:v.includes('My')?'user':'list'})), (v)=>toast('View: '+v,'info'));
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
SCREENS['sales-order'] = function(root, params){
  const d=(params&&params.no&&DB.salesOrderDocs&&DB.salesOrderDocs[params.no])||DB.so0418, c=d.cust;
  const calc=()=>{
    let sub=0; d.lines.forEach(l=>sub+=l.qty*l.price*(1-l.disc/100));
    const tax=sub*d.taxRate; const total=sub+tax+d.shipping;
    return {sub,tax,total};
  };
  const {sub,tax,total}=calc();
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
  const creditUsed=c.balance+total, creditPct=Math.round(creditUsed/c.limit*100), overLimit=creditUsed>c.limit;

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
        <div class="dm"><small>${esc(t('common.customer'))}</small><div class="partner"><span class="pav">MR</span><b>${esc(c.name)}</b></div></div>
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
          <div class="panel-h"><h3>${esc(t('appr.panel.lines'))}</h3><div class="ph-act">${btn(t('doc.addline'),{icon:'plus',cls:'plain'})}</div></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(t('appr.col.item'))}</th><th>${esc(t('appr.col.qty'))}</th><th>${esc(t('appr.col.unitprice'))}</th><th>${esc(t('doc.col.disc'))}</th><th class="c">${esc(t('doc.col.stock'))}</th><th>${esc(t('appr.col.amount'))}</th></tr></thead><tbody>${lineRows}</tbody></table>
          <div class="linefoot" style="display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px"><span>${esc(t('doc.linesunits').replaceAll('{n}',d.lines.length).replaceAll('{u}',d.lines.reduce((s,l)=>s+l.qty,0)))}</span><span>${esc(t('doc.inlineedit'))}</span></div>
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
            <div class="ph-act" id="soTabs"><button class="tab on" data-t="audit">${esc(t('doc.tab.audit'))}</button><button class="tab" data-t="attach">${esc(t('doc.tab.attach'))}<span class="tc">2</span></button><button class="tab" data-t="comments">${esc(t('doc.tab.comments'))}<span class="tc">2</span></button><button class="tab" data-t="related">${esc(t('doc.tab.related'))}</button></div>
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
          ${indicator({tone:overLimit?'danger':creditPct>85?'warn':'ok',icon:'handshake',label:overLimit?t('doc.overcredit'):t('doc.creditlimit'),value:money0(creditUsed)+' / '+money0(c.limit),sub:t('doc.balanceplus').replaceAll('{b}',money0(c.balance)).replaceAll('{t}',money0(total)).replaceAll('{x}',overLimit?t('doc.apprrequired'):t('doc.withinlimit')),pct:creditPct})}
          ${c.overdue>0?`<div style="margin-top:8px">${indicator({tone:'warn',icon:'receipt',label:t('doc.overduerec'),value:money0(c.overdue),sub:t('doc.overduesub')})}</div>`:''}
        </div>
        <div class="sumcard">
          <div class="sectitle" style="margin-top:0">${esc(t('doc.actions'))}</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${btn(t('doc.approveorder'),{icon:'check',cls:'primary',sm:false,attrs:'onclick="toast(\'Order approved — credit override logged\',\'ok\')"'})}
            ${btn(t('appr.btn.change'),{icon:'comment',cls:'soft',sm:false,attrs:'onclick="toast(\'Change requested\',\'warn\')"'})}
            ${btn(t('common.reject'),{icon:'x',cls:'danger',sm:false,attrs:'onclick="toast(\'Order rejected\',\'danger\')"'})}
          </div>
          <p style="font-size:11.5px;color:var(--muted);margin:10px 0 0">${esc(t('doc.glnote'))}</p>
        </div>
      </aside>
    </div>
    <div style="height:50px"></div>
  </div></div></section></div>
  <div class="pop moremenu" id="soMoreMenu" style="width:250px" role="menu" aria-label="More actions">
    <div class="menu-section">
      <div class="menu-head">${esc(d.no)}</div>
      <button class="menu-item" data-act="duplicate" role="menuitem">${ic('copy')}<span>Duplicate order</span></button>
      <button class="menu-item" data-act="send" role="menuitem">${ic('send')}<span>Send to customer</span></button>
      <button class="menu-item" data-act="export" role="menuitem">${ic('download')}<span>Export as PDF</span></button>
      <button class="menu-item" data-act="link" role="menuitem">${ic('link')}<span>Copy link</span><span class="meta mono">${esc(d.no)}</span></button>
    </div>
    <div class="menu-section">
      <button class="menu-item" data-act="comment" role="menuitem">${ic('comment')}<span>Add internal note</span></button>
      <button class="menu-item" data-act="history" role="menuitem">${ic('history')}<span>View change history</span></button>
    </div>
    <div class="menu-section">
      <button class="menu-item danger" data-act="cancel" role="menuitem">${ic('x')}<span>Cancel order</span></button>
    </div>
  </div>`;

  const body=$('#soTabBody');
  function tab(t){
    $$('#soTabs .tab').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
    if(t==='audit') body.innerHTML=genericAudit('Sales order','J. Okafor');
    else if(t==='attach') body.innerHTML=attachments([{name:'Customer PO — MR-99821.pdf',meta:'PDF · 240 KB · J. Okafor',ic:'filepdf'},{name:'Signed quote Q-26-0188.pdf',meta:'PDF · 180 KB · System',ic:'filepdf'}]);
    else if(t==='comments') body.innerHTML=comments([{av:'JO',clr:'#0a84ff',who:'J. Okafor',when:'2h ago',text:'Customer committed to Q3 volume — that’s why the 12% discount. Flagging for your approval.'},{av:'DR',clr:'#FF9500',who:'Dana Reyes',when:'1h ago',text:'Noted. Confirm Pneumatic Cylinder backfill from the inbound PO before we promise the date.'}]);
    else body.innerHTML=relatedDocs([{no:'Q-26-0188',label:'Originating quotation',meta:'converted Jun 3',status:'Completed'},{no:'PO-26-0291',label:'Inbound PO covers shortage',meta:'+300 ea Jun 22',status:'Pending Approval'},{no:'C-0007',label:'Customer · Meridian Robotics',meta:'Net 30 · 4 open orders'}]);
  }
  $$('#soTabs .tab').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.t)));
  tab('audit');

  /* ---- Confirm draft: live cross-module transaction in PGlite ---- */
  const confirmBtn=root.querySelector('[data-act="confirm-order"]');
  confirmBtn&&confirmBtn.addEventListener('click',async()=>{
    if(!(window.ErpSystemDemo&&window.ErpSystemDemo.confirmOrder)){ toast('Demo adapter not loaded','warn'); return; }
    confirmBtn.disabled=true; confirmBtn.querySelector('span')&&(confirmBtn.querySelector('span').textContent='Confirming…');
    try{
      const res=await window.ErpSystemDemo.confirmOrder(d.no);
      toast(d.no+' confirmed — stock issued, '+res.invDocNo+' posted to GL ('+money(res.total)+')','ok');
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
    if(a==='duplicate') toast('Duplicated to '+d.no.replace(/\d+$/,m=>String(+m+16).padStart(m.length,'0'))+' · saved as draft','ok');
    else if(a==='send') toast('Order PDF emailed to '+c.name,'ok');
    else if(a==='export') toast('Exporting '+d.no+' as PDF…','info');
    else if(a==='link'){ const url=location.origin+location.pathname+'#sales-order'; (navigator.clipboard&&navigator.clipboard.writeText(url).catch(()=>{})); toast('Link to '+d.no+' copied','ok'); }
    else if(a==='comment'){ tab('comments'); toast('Jump to comments to add an internal note','info'); }
    else if(a==='history'){ tab('audit'); toast('Showing change history','info'); }
    else if(a==='cancel') toast('Sales order '+d.no+' cancelled','danger');
  }));
};

/* ---------------- JOURNAL ENTRY (finance transaction) ---------------- */
SCREENS['journal-entry'] = function(root){
  const j=DB.je0611;
  const totDr=j.lines.reduce((s,l)=>s+l.dr,0), totCr=j.lines.reduce((s,l)=>s+l.cr,0);
  const balanced=Math.abs(totDr-totCr)<0.005;
  // listing of journals on the left as a compact table, detail on right
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
    ${crumbs([DB.company.name,t('nav.finance'),t('je.title'),{cur:j.no}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('book')}${esc(t('je.title'))} <span class="dnum">${esc(j.no)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(j.memo)} · ${esc(t('je.source'))} ${esc(j.source)}</div></div>
        <div class="dactions">${statusBadge(j.status)}</div></div>
      <div class="docmeta">
        <div class="dm"><small>${esc(t('common.date'))}</small><b>${esc(j.date)}</b></div>
        <div class="dm"><small>${esc(t('je.period'))}</small><b>${esc(j.period)} · ${esc(t('je.open'))}</b></div>
        <div class="dm"><small>${esc(t('je.prepared'))}</small><b>${esc(j.by)}</b></div>
        <div class="dm"><small>${esc(t('qc.col.type'))}</small><b>${esc(t('je.fxreval'))}</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel">
          <div class="panel-h"><h3>${esc(t('je.lines'))}</h3><div class="ph-act">${btn(t('doc.addline'),{icon:'plus',cls:'plain'})}</div></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(t('gl.col.account'))}</th><th class="l">${esc(t('je.col.dim'))}</th><th>${esc(t('je.col.debit'))}</th><th>${esc(t('je.col.credit'))}</th></tr></thead><tbody>
            ${j.lines.map((l,i)=>`<tr><td class="lineno">${i+1}</td>
              <td class="l li-name"><b>${esc(l.acct)} · ${esc(l.name)}</b></td>
              <td class="l" style="color:var(--muted)">${esc(l.dim)}</td>
              <td class="tnum">${l.dr?money(l.dr):'—'}</td>
              <td class="tnum">${l.cr?money(l.cr):'—'}</td></tr>`).join('')}
          </tbody></table>
          <div class="linefoot" style="display:flex;justify-content:flex-end;gap:30px;font-weight:600">
            <span style="color:var(--muted)">${esc(t('je.totals'))}</span>
            <span class="tnum">Dr ${money(totDr)}</span><span class="tnum">Cr ${money(totCr)}</span>
            <span>${balanced?cap(t('je.balanced'),'ok'):cap(t('je.outofbalance'),'danger')}</span>
          </div>
        </div>
        <div class="panel"><div class="panel-h"><h3>${esc(t('doc.tab.audit'))}</h3></div><div class="panel-body">
          ${auditTrail([
            {kind:'current',when:'Jun 4 · 08:00',what:'Submitted for approval',who:'A. Costa'},
            {kind:'add',when:'Jun 4 · 08:00',what:'Auto-generated by FX revaluation engine',who:'System',change:{field:'EUR rate',old:'1.071',new:'1.083',reason:'Daily ECB close'}},
          ])}
        </div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">
          <div class="sumrow"><span class="sk2">${esc(t('je.totaldebit'))}</span><span class="sv tnum">${money(totDr)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(t('je.totalcredit'))}</span><span class="sv tnum">${money(totCr)}</span></div>
          <div class="sumrow total"><span class="sk2">${esc(t('je.difference'))}</span><span class="sv tnum">${money(Math.abs(totDr-totCr))}</span></div>
          <div style="margin-top:10px">${balanced?indicator({tone:'ok',icon:'checkc',label:t('je.entrybalances'),value:'Dr = Cr'}):indicator({tone:'danger',icon:'warn',label:t('je.mustbalance'),value:'≠'})}</div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(t('je.posttogl'))}</div>
          <p style="font-size:12.5px;color:var(--muted);margin:0 0 10px">${esc(t('je.postirrev').replaceAll('{p}',j.period))}</p>
          ${DB.user.perms.post?btn(t('je.approvepost'),{icon:'check',cls:'primary',sm:false,attrs:'onclick="postJE(this)"'})
            :`<button class="btn primary" disabled data-tip="${esc(t('je.noperm'))}" style="width:100%;justify-content:center">${ic('lock')}${esc(t('je.approvepost'))}</button><div class="fld" style="margin-top:6px"><span class="locked">${ic('lock')} ${esc(t('je.requiresperm'))}</span></div>`}
          <div style="margin-top:8px">${btn(t('common.reject'),{icon:'x',cls:'danger',sm:false,attrs:'onclick="toast(\'Journal rejected\',\'danger\')"'})}</div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(t('je.periodstatus'))}</div>
          ${indicator({tone:'ok',icon:'unlock',label:'P06 · June 2026',value:t('je.open')})}
          <div style="margin-top:8px">${indicator({tone:'warn',icon:'lock',label:'P05 · May 2026',value:t('je.locked'),sub:t('je.p05blocked')})}</div>
        </div>
      </aside>
    </div>
    <div style="height:40px"></div>
  </div></div></section></div>`;
};
function postJE(btnEl){
  openModal(`<div class="modal-head">${ic('book')}<h3>${esc(t('je.m.title'))}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body"><div class="risk warn" style="margin:0 0 10px">${ic('warn')}<div><b>${esc(t('je.m.irrev'))}</b><small>${esc(t('je.m.irrevsub'))}</small></div></div>
    <div class="fld"><span>${esc(t('je.m.period'))}</span><select><option>P06 · June 2026 (${esc(t('je.open'))})</option><option disabled>P05 · May 2026 (${esc(t('je.locked'))})</option></select></div></div>
    <div class="modal-foot">${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(t('je.m.confirm'),{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\'JE-26-0611 posted to GL · P06\',\'ok\')"'})}</div>`);
}

/* ---------------- PAYMENT VOUCHER ---------------- */
SCREENS['payment-voucher'] = function(root){
  const supp=DB.suppliers[2];
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,'Finance','Payment Voucher',{cur:'PV-26-0203'}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('coins')}Payment Voucher <span class="dnum">PV-26-0203</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">Supplier settlement · bank transfer</div></div>
        <div class="dactions">${btn('New voucher',{icon:'plus',cls:'soft',attrs:'onclick="navigate(\'new-payment-voucher\')"'})}${cap('Pending Approval','warn')}</div></div>
      <div class="docmeta">
        <div class="dm"><small>Pay to</small><div class="partner"><span class="pav">SM</span><b>${esc(supp.name)}</b></div></div>
        <div class="dm"><small>Date</small><b>2026-06-04</b></div>
        <div class="dm"><small>Bank</small><b>HSBC · ••4021</b></div>
        <div class="dm"><small>Method</small><b>Telegraphic transfer</b></div>
      </div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Invoices being settled</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">3 of 5 open</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Supplier invoice</th><th class="l">Due</th><th>Amount</th><th>Discount</th><th>Paid now</th></tr></thead><tbody>
            <tr><td class="lineno">1</td><td class="l li-name"><b>SI-26-0610</b><small>GRN-26-0186</small></td><td class="l">2026-06-10</td><td class="tnum">${money(18400)}</td><td class="tnum">—</td><td class="tnum"><b>${money(18400)}</b></td></tr>
            <tr><td class="lineno">2</td><td class="l li-name"><b>SI-26-0604</b><small>GRN-26-0181</small></td><td class="l">2026-06-08</td><td class="tnum">${money(15200)}</td><td class="tnum" style="color:var(--ok)">${money(304)}</td><td class="tnum"><b>${money(14896)}</b></td></tr>
            <tr><td class="lineno">3</td><td class="l li-name"><b>SI-26-0598</b><small>GRN-26-0177</small></td><td class="l">2026-06-12</td><td class="tnum">${money(9304)}</td><td class="tnum">—</td><td class="tnum"><b>${money(9304)}</b></td></tr>
          </tbody></table>
        </div>
        <div class="panel"><div class="panel-h"><h3>Audit trail</h3></div><div class="panel-body">${auditTrail([
          {kind:'current',when:'Jun 4 · 10:20',what:'Submitted for approval',who:'A. Costa'},
          {kind:'add',when:'Jun 4 · 10:18',what:'Voucher created — 3 invoices selected',who:'A. Costa'},
        ])}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard">
          <div class="sumrow"><span class="sk2">Gross</span><span class="sv tnum">${money(42904)}</span></div>
          <div class="sumrow disc"><span class="sk2">Early-pay discount</span><span class="sv tnum">−${money(304)}</span></div>
          <div class="sumrow total"><span class="sk2">Net payment</span><span class="sv tnum">${money(42600)}</span></div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Supplier balance</div>
          ${indicator({tone:'ok',icon:'bank',label:'Open balance after pay',value:money0(supp.balance-42600),sub:`Was ${money0(supp.balance)} · Net 30 terms`})}
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Approve payment</div>
          ${btn('Approve & schedule',{icon:'check',cls:'primary',sm:false,attrs:'onclick="toast(\'Payment approved — scheduled for tonight’s run\',\'ok\')"'})}
          <div style="margin-top:8px">${btn('Hold',{icon:'clock',cls:'soft',sm:false,attrs:'onclick="toast(\'Payment placed on hold\',\'warn\')"'})}</div>
        </div>
      </aside>
    </div>
    <div style="height:40px"></div>
  </div></div></section></div>`;
};
