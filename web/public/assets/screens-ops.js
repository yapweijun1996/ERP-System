/* ============================================================
   ARIA ERP — screens: Dashboard, Purchase Orders, PO Approval, Picking
   ============================================================ */

/* ---------------- DASHBOARD ---------------- */
SCREENS['dashboard'] = function(root){
  const u=DB.user;
  const m=DB.dashboardMetrics||{};
  /* TASK-026: only the PGlite/fallback demo adapter's canonical-values narrative
     applies here (SG-WIDGET, Beta Pte Ltd, etc.) — api mode has DB.erpSystem set
     too (for the company switcher) but must fall through to the generic i18n copy,
     same distinction Settings already makes for its data-source panel. */
  const erpDemo=!!DB.erpSystem && DB.erpSystem.dataMode!=='api';
  const fmt=(n)=>typeof n==='number'?num(n):n;
  const wc = (o)=>`<button class="wcard ${o.span?'span2':''}" data-route="${o.route||''}">
    <div class="wc-top"><span class="wc-ic ${o.tone}">${ic(o.icon)}</span><h4>${esc(o.title)}</h4>${o.meta?`<span class="wc-meta">${esc(o.meta)}</span>`:''}</div>
    ${o.num!=null?`<div class="wc-num"><b class="tnum">${o.num}</b>${o.delta?`<span class="wc-delta ${o.deltaDir}">${esc(o.delta)}</span>`:''}</div>`:''}
    <p>${o.body}</p>
    ${o.list?o.list:''}
    <div class="wc-act">${esc(o.cta)} ${ic('arrowR')}</div>
  </button>`;

  const attention=[
    wc({tone:(m.approvals||0)>0?'danger':'ok',icon:'flow',title:t('dash.c.approvals'),num:fmt(m.approvals??DB.approvals.length),meta:erpDemo?'demo queue':t('dash.c.approvals.meta'),body:erpDemo?'Setup follow-up and draft sales order are queued for the demo workspace.':t('dash.c.approvals.body'),cta:t('dash.c.approvals.cta'),route:'po-approval'}),
    wc({tone:(m.glIssues||0)>0?'danger':'ok',icon:'error',title:erpDemo?'GL posting status':t('dash.c.gl'),num:fmt(m.glIssues??0),body:erpDemo?'INV-SO-1 posted a balanced AR, revenue, and GST journal. No posting exception is active.':t('dash.c.gl.body'),cta:t('dash.c.gl.cta'),route:'journal-entry'}),
    wc({tone:(m.stockAlerts||0)>0?'warn':'ok',icon:'box',title:t('dash.c.stock'),num:fmt(m.stockAlerts??0),meta:erpDemo?'canonical stock':t('dash.c.stock.meta'),body:erpDemo?'SG-WIDGET and SG-GADGET balances come from the ERP-System sales transaction proof.':t('dash.c.stock.body'),cta:t('dash.c.stock.cta'),route:'stock-on-hand'}),
    wc({tone:(m.arOpen||0)>0?'warn':'ok',icon:'receipt',title:t('dash.c.ar'),num:money(m.arOpen??0,DB.company.currency),deltaDir:'up',delta:erpDemo?'':DB.company.currency,body:erpDemo?'Beta Pte Ltd has one open posted invoice from SO-1.':t('dash.c.ar.body'),cta:t('dash.c.ar.cta'),route:'dashboard'}),
  ];
  const ops=[
    wc({tone:'accent',icon:'truck',title:t('dash.c.deliver'),num:fmt(m.openDeliveries??0),body:erpDemo?'The canonical order is already delivered; new draft orders can be added next.':t('dash.c.deliver.body'),cta:t('dash.c.deliver.cta'),route:'sales-orders'}),
    wc({tone:'accent',icon:'receive',title:t('dash.c.grn'),num:fmt(m.goodsReceipts??0),body:erpDemo?'Purchasing data will be connected after the sales and inventory slice.':t('dash.c.grn.body'),cta:t('dash.c.grn.cta'),route:'purchase-orders'}),
    wc({tone:'teal',icon:'warehouse',title:t('dash.c.pick'),num:fmt(m.pickTasks??0),meta:erpDemo?'demo ready':t('dash.c.pick.meta'),body:erpDemo?'WH-SALES stock movement rows are visible in Inventory.':t('dash.c.pick.body'),cta:t('dash.c.pick.cta'),route:'picking'}),
    wc({tone:'violet',icon:'people',title:t('dash.c.leave'),num:fmt(m.leaveRequests??0),body:erpDemo?'HR remains part of the cloned layout and will be wired in a later module task.':t('dash.c.leave.body'),cta:t('dash.c.leave.cta'),route:'leave-approval'}),
  ];

  /* approvals mini-table */
  const apprList=`<div class="minilist">`+DB.approvals.slice(0,5).map(a=>`
    <div class="mli" data-route="${a.route}">
      <span class="ml-doc">${esc(a.no)}</span>
      <div class="ml-main">${esc(a.kind)}<small>${esc(a.who)} · ${esc(a.age)} ago</small></div>
      ${a.amt!=null?`<span class="ml-amt tnum">${money0(a.amt)}</span>`:''}
      ${a.risk==='high'?cap(t('dash.cap.high'),'danger'):a.risk==='warn'?cap(t('dash.cap.check'),'warn'):cap(t('dash.cap.routine'),'neutral')}
    </div>`).join('')+`</div>`;

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="scrollarea">
      <div class="pagehead">
        ${crumbs([DB.company.name, t('nav.home')])}
        <div class="h1row">
          <h1>${esc(t('dash.greeting'))}, ${esc(u.name.split(' ')[0])}</h1>
          <div class="headright">
            <div class="kfig"><small>${esc(t('dash.kpi.openorder'))}</small><b class="tnum">${money(m.openOrderValue??0,DB.company.currency)}</b></div>
            <div class="kfig"><small>${esc(t('dash.kpi.cash'))}</small><b class="tnum">${money(m.cash??0,DB.company.currency)}</b></div>
            <div class="kfig"><small>${esc(t('dash.kpi.mtd'))}</small><b class="tnum pos">${money(m.mtdSales??0,DB.company.currency)}</b></div>
          </div>
        </div>
        <div class="h1sub">${esc(DB.company.branch)} · ${esc(DB.company.period)} · ${esc(t('dash.sub'))}</div>
      </div>

      <div class="dash">
        <div class="dash-sectitle"><span>${esc(t('dash.sec.attention'))}</span><span class="ln"></span><span style="color:var(--danger)">${attention.length} ${esc(t('dash.items'))}</span></div>
        <div class="dashgrid">${attention.join('')}</div>

        <div class="dash-sectitle"><span>${esc(t('dash.sec.ops'))}</span><span class="ln"></span></div>
        <div class="dashgrid">${ops.join('')}</div>

        <div class="dash-sectitle"><span>${esc(t('dash.sec.queue'))}</span><span class="ln"></span><span><a href="javascript:navigate('po-approval')">${esc(t('dash.openall'))}</a></span></div>
        <div class="dashgrid">
          <button class="wcard span2" style="cursor:default" onclick="event.stopPropagation()">
            <div class="wc-top"><span class="wc-ic accent">${ic('flow')}</span><h4>${esc(t('dash.q.pending'))}</h4><span class="wc-meta">${esc(t('dash.q.modules'))}</span></div>
            ${apprList}
          </button>
          <div class="wcard" style="cursor:default">
            <div class="wc-top"><span class="wc-ic ok">${ic('checkc')}</span><h4>${esc(t('dash.q.cleared'))}</h4></div>
            <div class="wc-num"><b class="tnum">${fmt(m.cleared??0)}</b><span class="wc-delta up">${esc(t('dash.q.ontime'))}</span></div>
            <p>${t('dash.q.body')}</p>
          </div>
        </div>
      </div>
    </div>
  </section></div>`;

  root.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',e=>{
    const r=el.dataset.route; if(r) navigate(r);
  }));
};

/* ---------------- PURCHASE ORDERS (listing) ---------------- */
SCREENS['purchase-orders'] = function(root){
  let filter='all';
  const chips=[['all',t('common.all'),null],['pending',ts('Pending Approval'),'warn'],['approved',ts('Approved'),'accent'],['receiving',t('po.chip.receiving'),'info'],['done',ts('Completed'),'ok']];
  function rows(){
    return DB.purchaseOrders.filter(p=>{
      if(filter==='all')return true;
      if(filter==='pending')return p.status==='Pending Approval';
      if(filter==='approved')return p.status==='Approved';
      if(filter==='receiving')return p.status==='Partially Completed';
      if(filter==='done')return p.status==='Completed';
      return true;
    });
  }
  function table(){
    return buildTable({
      checkable:true, rowId:p=>p.no,
      columns:[
        {label:t('po.col.no'),sticky:true,render:p=>`<div class="cellsub"><b class="docnum">${esc(p.no)}</b><small>${esc(p.supp)}</small></div>`},
        {label:t('common.date'),align:'l',sortable:true,render:p=>esc(p.date)},
        {label:t('po.col.expected'),align:'l',render:p=>esc(p.expect)},
        {label:t('po.col.buyer'),align:'l',render:p=>esc(p.buyer)},
        {label:t('col.lines'),align:'r',render:p=>p.items},
        {label:t('po.col.received'),align:'r',render:p=>`<span class="minibar"><i class="${p.recv>=100?'ok':p.recv>0?'warn':''}" style="width:${p.recv}%"></i></span> ${p.recv}%`},
        {label:t('col.total'),align:'r',sortable:true,render:p=>`<b class="tnum">${money(p.total,p.currency)}</b>${p.currency!=='USD'?`<div style="font-size:11px;color:var(--muted)">${p.currency}</div>`:''}`},
        {label:t('col.status'),align:'l',render:p=>statusBadge(p.status)+(p.flag?` <span data-tip="${esc(p.flag)}">${ic('warn')}</span>`:'')},
        {label:'',align:'c',render:p=>`<span class="rowact"><button data-tip="${esc(t('common.open'))}" data-act="open">${ic('ext')}</button><button data-tip="${esc(t('common.duplicate'))}">${ic('copy')}</button></span>`},
      ],
      rows:rows(),
    });
  }
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.purchasing'),t('po.title')])}
      <div class="h1row"><h1>${esc(t('po.title'))}</h1><span class="countchip" id="poCount"></span>
        <div class="headright"><div class="kfig"><small>${esc(t('po.kpi.commit'))}</small><b class="tnum">$313k</b></div></div></div>
    </div>
    <div class="alert warn"><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 10v5M12 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span class="grow"><b>${esc(t('po.alert'))}</b> ${esc(t('po.alert2'))}</span>
      ${btn(t('po.reviewnow'),{icon:'flow',cls:'soft',attrs:'onclick="navigate(\'po-approval\')"'})}</div>
    <div class="toolbar">
      <div class="filterchips" id="poChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${c[2]?`<span class="dot" style="background:var(--${c[2]==='accent'?'accent':c[2]})"></span>`:''}${esc(c[1])}</button>`).join('')}</div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('common.saveview'))}">${ic('star')}<span class="star"></span>${esc(t('po.allopen'))}<svg viewBox="0 0 24 24" width="14" height="14"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg></button>
      ${btn(t('common.filter'),{icon:'filter',cls:'soft'})}
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('po.new'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-purchase-order\')"'})}
    </div>
    <div class="tablewrap" id="poTable">${table()}</div>
    <div id="poBulk"></div>
  </section></div>`;
  const wrap=$('#poTable');
  $('#poCount').textContent=rows().length+' '+t('so.orders');
  function rewire(){
    wireTable(wrap,{
      onRow:(id)=>{ if(id==='PO-26-0291'){navigate('po-approval');} else toast('Opening '+id,'info'); },
      onSelectionChange:(n)=>{ $('#poBulk').innerHTML = n? `<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('common.approve'),{icon:'check',cls:'soft'})}${btn(t('common.export'),{icon:'download',cls:'soft'})}${btn(t('common.cancel'),{icon:'x',cls:'danger'})}</div>`:''; }
    });
    wrap.querySelectorAll('[data-act="open"]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const no=b.closest('tr').dataset.row;no==='PO-26-0291'?navigate('po-approval'):toast('Opening '+no,'info');}));
  }
  rewire();
  $('#poChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
    $('#poChips .chip.on').classList.remove('on'); c.classList.add('on'); filter=c.dataset.f;
    wrap.innerHTML=table(); $('#poCount').textContent=rows().length+' '+t('so.orders'); $('#poBulk').innerHTML=''; rewire();
  }));
};

/* ---------------- PO APPROVAL (approval template) ---------------- */
SCREENS['po-approval'] = function(root){
  const d=DB.po0291;
  const subtotal=d.lines.reduce((s,l)=>s+l.qty*l.price,0);
  const budgetTotal=d.lines.reduce((s,l)=>s+l.qty*l.budgetPrice,0);
  const tax=subtotal*0.06, total=subtotal+tax;
  const overBudget=subtotal-budgetTotal, overPct=Math.round(overBudget/budgetTotal*100);

  const lineRows=d.lines.map((l,i)=>{
    const ext=l.qty*l.price, over=l.price>l.budgetPrice;
    return `<tr><td class="lineno">${i+1}</td>
      <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)} · ${l.qty} ${l.uom} @ ${money(l.price)}</small></td>
      <td class="tnum">${num(l.qty)}</td>
      <td class="tnum">${money(l.price)}</td>
      <td class="tnum">${over?`<span style="color:var(--warn)" data-tip="Budget price ${money(l.budgetPrice)}">${money(l.price)} ${ic('warn')}</span>`:money(l.budgetPrice)}</td>
      <td class="tnum"><b>${money(ext)}</b></td></tr>`;
  }).join('');

  const apprTl=d.approvers.map(a=>{
    const kind=a.state==='approved'?'ok':a.state==='current'?'current':'pending';
    const lbl=a.state==='approved'?ts('Approved'):a.state==='current'?t('appr.awaiting'):t('appr.pending');
    return `<div class="tl ${kind}"><span class="tldot"></span><div class="tlbody"><div class="when">${esc(a.when)}</div>
      <div class="what">${esc(a.name)} · ${lbl}</div>
      <div class="who">${esc(a.role)}</div>
      ${a.note?`<div class="det">${esc(a.note)}</div>`:''}</div></div>`;
  }).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,t('nav.workflow'),{cur:d.no}])}
      ${typeof purNav==='function'?'<div style="padding:0 0 4px">'+purNav('po-approvals')+'</div>':''}
      <div class="dochead">
        <div class="dh-row1">
          <div>
            <div class="dt">${ic('cart')}${esc(t('appr.doc.po'))} <span class="dnum">${esc(d.no)}</span></div>
            <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(t('appr.requestedby'))} ${esc(d.requestedBy)} · ${esc(t('po.col.buyer'))} ${esc(d.buyer)}</div>
          </div>
          <div class="dactions">${statusBadge(d.status)}</div>
        </div>
        <div class="stepper">
          <div class="step done"><span class="sdot">${ic('check')}</span>${esc(ts('Draft'))}</div><span class="stepline done"></span>
          <div class="step done"><span class="sdot">${ic('check')}</span>${esc(t('appr.step.submitted'))}</div><span class="stepline done"></span>
          <div class="step current"><span class="sdot">${ic('clock')}</span>${esc(ts('Pending Approval'))}</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>${esc(ts('Approved'))}</div><span class="stepline"></span>
          <div class="step"><span class="sdot"></span>${esc(t('appr.step.sent'))}</div>
        </div>
        <div class="docmeta">
          <div class="dm"><small>${esc(t('common.supplier'))}</small><div class="partner"><span class="pav">SM</span><b>${esc(d.supp.name)}</b></div></div>
          <div class="dm"><small>${esc(t('so.col.date'))}</small><b>${esc(d.date)}</b></div>
          <div class="dm"><small>${esc(t('common.expected'))}</small><b>${esc(d.expect)}</b></div>
          <div class="dm"><small>${esc(t('common.warehouse'))}</small><b>${esc(d.warehouse)}</b></div>
          <div class="dm"><small>${esc(t('appr.budgetline'))}</small><b>${esc(d.budgetLine)}</b></div>
        </div>
      </div>

      <div class="appr-layout">
        <div class="docmain">
          <div class="panel">
            <div class="panel-h"><h3>${esc(t('appr.panel.risk'))}</h3></div>
            <div class="panel-body" style="padding-top:12px">
              <div class="risk danger">${ic('warn')}<div><b>${esc(t('appr.r1.title'))}</b><small>${t('appr.r1.body').replaceAll('{sub}',money(subtotal)).replaceAll('{bud}',money(budgetTotal)).replaceAll('{line}',esc(d.budgetLine)).replaceAll('{cap}',money0(d.budget)).replaceAll('{var}',money(overBudget))}</small></div></div>
              <div class="risk warn">${ic('info')}<div><b>${esc(t('appr.r2.title'))}</b><small>${esc(t('appr.r2.body'))}</small></div></div>
              <div class="risk ok">${ic('checkc')}<div><b>${esc(t('appr.r3.title'))}</b><small>${t('appr.r3.body').replaceAll('{bal}',money((DB.suppliers[2]||DB.suppliers[DB.suppliers.length-1]||{balance:0}).balance))}</small></div></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>${esc(t('appr.panel.lines'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${d.lines.length} ${esc(t('common.lines.suffix'))}</span></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(t('appr.col.item'))}</th><th>${esc(t('appr.col.qty'))}</th><th>${esc(t('appr.col.unitprice'))}</th><th>${esc(t('appr.col.budget'))}</th><th>${esc(t('appr.col.amount'))}</th></tr></thead><tbody>${lineRows}</tbody></table>
          </div>
        </div>

        <aside>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sumrow"><span class="sk2">${esc(t('appr.subtotal'))}</span><span class="sv tnum">${money(subtotal)}</span></div>
            <div class="sumrow"><span class="sk2">${esc(t('appr.tax'))}</span><span class="sv tnum">${money(tax)}</span></div>
            <div class="sumrow total"><span class="sk2">${esc(t('col.total'))}</span><span class="sv tnum">${money(total)}</span></div>
            <div class="indicator danger" style="margin-top:12px">
              <div class="ind-top">${ic('warn')}<span>${esc(t('appr.budgetimpact'))}</span><span class="ind-r">+${overPct}%</span></div>
              <div class="track"><i style="width:100%"></i></div>
              <small>${t('appr.bi.body').replaceAll('{sub}',money(subtotal)).replaceAll('{cap}',money0(d.budget)).replaceAll('{over}',money(overBudget))}</small>
            </div>
          </div>
          <div class="sumcard">
            <div class="sectitle" style="margin-top:0">${esc(t('appr.route'))}</div>
            <div class="timeline">${apprTl}</div>
          </div>
        </aside>
      </div>
    </div></div>

    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${t('appr.footer')}</div>
      <div class="grow"></div>
      ${btn(t('appr.btn.change'),{icon:'comment',cls:'soft',attrs:'onclick="toast(\'Change requested — returned to buyer\',\'warn\')"'})}
      ${btn(t('common.reject'),{icon:'x',cls:'danger',attrs:'data-act="reject"'})}
      ${btn(t('appr.btn.approve'),{icon:'check',cls:'primary',sm:false,attrs:'data-act="approve"'})}
    </div>
  </section></div>`;

  root.querySelector('[data-act="approve"]').addEventListener('click',()=>{
    openModal(`<div class="modal-head">${ic('checkc')}<h3>${esc(t('appr.approveq'))} ${esc(d.no)}?</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><p style="color:var(--muted);font-size:13.5px">${esc(t('appr.modal.desc').replaceAll('{over}',money(overBudget)))}</p>
      <div class="fld"><span>${esc(t('appr.note'))}</span><textarea placeholder="e.g. Approved — urgent line stoppage risk; variance accepted for Q2.">Approved — PCB shortage risk to SO-26-0418; budget variance accepted.</textarea></div></div>
      <div class="modal-foot">${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(t('appr.confirm'),{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\'PO-26-0291 approved — routed to CFO\',\'ok\')"'})}</div>`);
  });
  root.querySelector('[data-act="reject"]').addEventListener('click',()=>{
    openModal(`<div class="modal-head">${ic('xc')}<h3>${esc(t('appr.rejectq'))} ${esc(d.no)}?</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="fld err"><span>${esc(t('appr.reason'))} <span class="req">*</span></span><textarea placeholder="Required — returned to buyer with this note."></textarea><span class="hint bad">${esc(t('appr.modal.reasonreq'))}</span></div></div>
      <div class="modal-foot">${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(t('appr.rejectreturn'),{icon:'x',cls:'danger-solid',attrs:'onclick="closeModal();toast(\'PO-26-0291 rejected — returned to R. Haddad\',\'danger\')"'})}</div>`);
  });
};

/* ---------------- WAREHOUSE PICKING ---------------- */
SCREENS['picking'] = function(root){
  const pk=JSON.parse(JSON.stringify(DB.pickList));
  let sideOpen=true;
  function render(){
    const total=pk.lines.reduce((s,l)=>s+l.qty,0);
    const done=pk.lines.reduce((s,l)=>s+l.picked,0);
    const pct=total?Math.round(done/total*100):0;
    const linesDone=pk.lines.filter(l=>l.picked>=l.qty).length;
    const activeIdx=pk.lines.findIndex(l=>l.picked<l.qty);
    const rows=pk.lines.map((l,i)=>{
      const isDone=l.picked>=l.qty, isActive=i===activeIdx;
      return `<div class="pickrow ${isDone?'done':''} ${isActive?'active':''}" data-i="${i}">
        <div class="pick-check">${ic('check')}</div>
        <div class="pick-bin">${esc(l.bin)}</div>
        <div class="pick-item"><b>${esc(l.name)}</b><small>${esc(l.item)} · ${esc(t('pick.binword'))} ${esc(l.bin)}</small></div>
        <div class="pick-qty"><b class="tnum">${l.picked}/${l.qty}</b><small>${esc(l.uom)} ${esc(t('pick.pickedsuffix'))}</small></div>
        ${isDone?cap(t('pick.picked'),'ok'):isActive?btn(t('pick.confirm'),{icon:'check',cls:'primary',attrs:`data-pick="${i}"`}):btn(t('pick.pick'),{cls:'soft',attrs:`data-pick="${i}"`})}
        <div class="pick-actions">
          ${btn('',{icon:'eye',cls:'ghost',attrs:`data-view="${i}" aria-label="View line" data-tip="View"`})}
          ${btn('',{icon:'edit',cls:'ghost',attrs:`data-editl="${i}" aria-label="Edit line" data-tip="Edit"`})}
          ${btn('',{icon:'trash',cls:'ghost',attrs:`data-dell="${i}" aria-label="Delete line" data-tip="Delete"`})}
        </div>
      </div>`;
    }).join('');
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">
        ${crumbs([DB.company.name,t('nav.warehouse'),t('pick.crumb'),{cur:pk.no}])}
        <div class="h1row"><h1>${esc(t('pick.title'))} ${esc(pk.no)}</h1>${cap(pk.priority,'danger')}
          <div class="headright"><div class="kfig"><small>${esc(t('common.progress'))}</small><b class="tnum">${pct}%</b></div></div></div>
        <div class="h1sub">${esc(pk.order)} · ${esc(pk.wave)} · ${esc(t('pick.assignedto'))} ${esc(pk.assignee)}</div>
      </div>
      <div class="pick-layout ${sideOpen?'':'side-collapsed'}">
        <div class="pick-main">
          <button class="scanbtn" id="scanBtn">${ic('scan')}${esc(t('pick.scan'))}</button>
          <div class="progressbig"><i style="width:${pct}%"></i></div>
          <div class="pick-tools">
            <div style="font-size:12.5px;color:var(--muted)">${linesDone} ${esc(t('pick.of'))} ${pk.lines.length} ${esc(t('pick.linescomplete'))} · ${done}/${total} ${esc(t('pick.units'))}</div>
            <div class="grow"></div>
            ${sideOpen?'':btn(t('pick.ordersummary'),{icon:'info',cls:'soft',attrs:'id="sideOpen"'})}
            ${btn('Add line',{icon:'plus',cls:'soft',attrs:'data-addl="1"'})}
          </div>
          ${pk.lines.length?rows:`<div class="detail-empty" style="padding:40px 0">${ic('box')}<div>No pick lines. Add a line to start picking.</div></div>`}
        </div>
        <aside class="pick-side">
          <div class="sectitle pick-side-head" style="margin-top:0">${esc(t('pick.ordersummary'))}<button class="iconbtn x pick-side-close" id="sideClose" data-tip="Hide summary" aria-label="Hide summary">${ic('x')}</button></div>
          <div class="field"><span class="k">${esc(t('pick.f.order'))}</span><span class="v">SO-26-0416</span></div>
          <div class="field"><span class="k">${esc(t('pick.f.customer'))}</span><span class="v">Tycho Automation</span></div>
          <div class="field"><span class="k">${esc(t('pick.f.shipto'))}</span><span class="v">Penang DC<span class="vs">Bay 4 · dock 2</span></span></div>
          <div class="field"><span class="k">${esc(t('pick.f.carrier'))}</span><span class="v">Internal fleet</span></div>
          <div class="sectitle">${esc(t('pick.after'))}</div>
          <p style="font-size:12.5px;color:var(--muted);margin:0 0 12px">${t('pick.afterbody')}</p>
          ${btn(t('pick.reportshort'),{icon:'warn',cls:'soft',attrs:'onclick="toast(\'Short-pick exception raised\',\'warn\')"'})}
          <div style="height:8px"></div>
          ${btn(pct===100?t('pick.complete'):t('pick.pickall'),{icon:pct===100?'check':'play',cls:pct===100?'ok-solid':'primary',sm:false,attrs:'data-finish="1"'})}
        </aside>
      </div>
    </section></div>`;
    root.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const i=+b.dataset.pick;pk.lines[i].picked=pk.lines[i].qty;toast(`Picked ${pk.lines[i].qty} ${pk.lines[i].uom} from ${pk.lines[i].bin}`,'ok');render();}));
    root.querySelector('#scanBtn').addEventListener('click',()=>{ const i=pk.lines.findIndex(l=>l.picked<l.qty); if(i<0){toast('All lines already picked','info');return;} pk.lines[i].picked=pk.lines[i].qty; toast(`Scanned ${pk.lines[i].item} — picked from ${pk.lines[i].bin}`,'ok'); render(); });
    root.querySelector('[data-finish]').addEventListener('click',()=>{ const total=pk.lines.reduce((s,l)=>s+l.qty,0),done=pk.lines.reduce((s,l)=>s+l.picked,0); if(total&&done>=total){toast('Pick complete — released to Packing','ok');} else {pk.lines.forEach(l=>l.picked=l.qty);render();toast('All lines picked','ok');} });
    root.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();viewLine(+b.dataset.view);}));
    root.querySelectorAll('[data-editl]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();lineForm(+b.dataset.editl);}));
    root.querySelectorAll('[data-dell]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();confirmDeleteLine(+b.dataset.dell);}));
    const addl=root.querySelector('[data-addl]'); addl&&addl.addEventListener('click',()=>lineForm(null));
    const sc=root.querySelector('#sideClose'); sc&&sc.addEventListener('click',()=>{sideOpen=false;render();});
    const so=root.querySelector('#sideOpen'); so&&so.addEventListener('click',()=>{sideOpen=true;render();});
  }

  /* ---- view / edit / add / delete a pick line ---- */
  function viewLine(idx){
    const l=pk.lines[idx]; if(!l)return; const isDone=l.picked>=l.qty;
    openModal(`<div class="modal-head">${ic('box')}<h3>${esc(l.name)}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body">
        <div class="field"><span class="k">Item code</span><span class="v mono">${esc(l.item)}</span></div>
        <div class="field"><span class="k">Bin location</span><span class="v mono">${esc(l.bin)}</span></div>
        <div class="field"><span class="k">Quantity to pick</span><span class="v tnum">${l.qty} ${esc(l.uom)}</span></div>
        <div class="field"><span class="k">Picked so far</span><span class="v tnum">${l.picked} ${esc(l.uom)}</span></div>
        <div class="field"><span class="k">Status</span><span class="v">${isDone?cap('Picked','ok'):l.picked>0?cap('Partial','warn'):cap('Open','accent')}</span></div>
      </div>
      <div class="modal-foot">${btn('Close',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Edit line',{icon:'edit',cls:'primary',attrs:`data-editfromview="${idx}"`})}</div>`);
    $('#modalEl').querySelector('[data-editfromview]').addEventListener('click',()=>{ closeModal(); lineForm(idx); });
  }

  function lineForm(idx){
    const edit=idx!=null;
    const l=edit?pk.lines[idx]:{bin:'',item:'',name:'',qty:1,picked:0,uom:'ea'};
    const uoms=['ea','m','kg','box','set','pr','L'];
    const itemOpts=(window.DB&&DB.items?DB.items:[]).map(it=>`<option value="${esc(it.sku)}" data-name="${esc(it.name)}" data-uom="${esc(it.uom)}" ${edit&&l.item===it.sku?'selected':''}>${esc(it.sku)} · ${esc(it.name)}</option>`).join('');
    openModal(`<div class="modal-head">${ic(edit?'edit':'plus')}<h3>${edit?'Edit pick line':'Add pick line'}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="set-grid">
        <div class="fld" style="grid-column:1/-1"><span>Pick from item master</span><select id="plItem"><option value="">— Choose to auto-fill, or enter manually below —</option>${itemOpts}</select></div>
        <div class="fld"><span>Item name <span class="req">*</span></span><input id="plName" value="${edit?esc(l.name):''}" placeholder="e.g. Pneumatic Cylinder 32mm"></div>
        <div class="fld"><span>Item code</span><input id="plCode" value="${edit?esc(l.item):''}" placeholder="NW-0000"></div>
        <div class="fld"><span>Bin <span class="req">*</span></span><input id="plBin" value="${edit?esc(l.bin):''}" placeholder="A-00-00"></div>
        <div class="fld"><span>UoM</span><select id="plUom">${uoms.map(u=>`<option ${(edit?l.uom:'ea')===u?'selected':''}>${u}</option>`).join('')}</select></div>
        <div class="fld"><span>Qty to pick <span class="req">*</span></span><input id="plQty" type="number" min="1" class="tnum" value="${edit?l.qty:1}"></div>
        <div class="fld"><span>Already picked</span><input id="plPicked" type="number" min="0" class="tnum" value="${edit?l.picked:0}"></div>
      </div></div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(edit?'Save changes':'Add line',{icon:edit?'save':'plus',cls:'primary',attrs:'data-save="1"'})}</div>`);
    const m=$('#modalEl');
    m.querySelector('#plItem').addEventListener('change',e=>{ const o=e.target.selectedOptions[0]; if(!o||!o.value)return; m.querySelector('#plName').value=o.dataset.name||''; m.querySelector('#plCode').value=o.value; if(o.dataset.uom)m.querySelector('#plUom').value=o.dataset.uom; });
    m.querySelector('[data-save]').addEventListener('click',()=>{
      const name=m.querySelector('#plName').value.trim();
      const bin=m.querySelector('#plBin').value.trim();
      const qty=Math.max(1,+m.querySelector('#plQty').value||0);
      if(!name){ toast('Item name is required','danger'); m.querySelector('#plName').focus(); return; }
      if(!bin){ toast('Bin is required','danger'); m.querySelector('#plBin').focus(); return; }
      const picked=Math.min(qty,Math.max(0,+m.querySelector('#plPicked').value||0));
      const d={ bin, item:m.querySelector('#plCode').value.trim()||'—', name, qty, picked, uom:m.querySelector('#plUom').value };
      closeModal();
      if(edit){ Object.assign(pk.lines[idx],d); toast(`Pick line “${name}” updated`,'ok'); }
      else { pk.lines.push(d); toast(`Pick line “${name}” added`,'ok'); }
      render();
    });
  }

  function confirmDeleteLine(idx){
    const l=pk.lines[idx]; if(!l)return;
    openModal(`<div class="modal-head">${ic('trash')}<h3>Delete pick line?</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="risk danger">${ic('warn')}<div><b>Remove ${esc(l.name)} (${esc(l.item)})</b><small>${l.picked>0?`${l.picked} ${esc(l.uom)} already recorded as picked will be discarded. `:''}This line is removed from pick list ${esc(pk.no)}.</small></div></div></div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Delete line',{icon:'trash',cls:'danger-solid',attrs:'data-del="1"'})}</div>`);
    $('#modalEl').querySelector('[data-del]').addEventListener('click',()=>{ closeModal(); pk.lines.splice(idx,1); toast('Pick line deleted','danger'); render(); });
  }

  render();
};
