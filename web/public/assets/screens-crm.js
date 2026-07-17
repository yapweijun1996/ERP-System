/* ============================================================
   ARIA ERP — screens: CRM (pipeline, opportunity, customer 360)
   ============================================================ */

function crmStageTone(st){
  return {Lead:'neutral',Qualified:'info',Proposal:'accent',Negotiation:'warn',Won:'ok',Lost:'danger'}[st]||'neutral';
}
function crmStageColor(st){
  return {Lead:'var(--muted)',Qualified:'var(--accent)',Proposal:'var(--teal)',Negotiation:'var(--warn)',Won:'var(--ok)'}[st]||'var(--muted)';
}

/* ---------------- SALES PIPELINE (kanban — module landing) ---------------- */
SCREENS['crm-pipeline'] = function(root){
  const total=DB.pipeline.reduce((s,c)=>s+c.items.reduce((a,o)=>a+o.value,0),0);
  const weighted=DB.pipeline.reduce((s,c)=>s+c.items.reduce((a,o)=>a+o.value*o.prob/100,0),0);
  const openCount=DB.pipeline.filter(c=>c.stage!=='Won').reduce((s,c)=>s+c.items.length,0);
  const won=DB.pipeline.find(c=>c.stage==='Won');
  const wonVal=won?won.items.reduce((a,o)=>a+o.value,0):0;

  const cols=DB.pipeline.map(col=>{
    const cv=col.items.reduce((a,o)=>a+o.value,0);
    const cards=col.items.map(o=>`<div class="kcard ${o.hot?'hot':''}" data-opp="${esc(o.no)}">
        <div class="kc-cust">${ic('handshake')}${esc(o.cust)}${o.warn?` · <span style="color:var(--warn)" data-tip="${esc(o.warn)}">⚠</span>`:''}</div>
        <div class="kc-title">${esc(o.title)}</div>
        <div class="kc-val">${money0(o.value)}</div>
        <div class="kprob"><i style="width:${o.prob}%;background:${crmStageColor(col.stage)}"></i></div>
        <div class="kc-foot">
          <span class="kc-av" style="background:${o.clr}">${esc(o.av)}</span>
          <span class="kc-close">${ic('calendar')} ${esc(o.close)}</span>
          <span class="kc-prob">${o.prob}%</span>
          ${col.stage!=='Won'?`<button class="iconbtn" data-tip="Convert to sales order" data-convert="${esc(o.no)}" style="margin-left:auto;width:24px;height:24px">${ic('bag')}</button>`:''}
        </div>
      </div>`).join('');
    return `<div class="kcol">
      <div class="kcol-h"><span class="stagedot" style="background:${crmStageColor(col.stage)}"></span><b>${esc(ts(col.stage))}</b><span class="kc-count">${col.items.length}</span><span class="kc-val">${money0(cv)}</span></div>
      ${cards||`<div style="font-size:12px;color:var(--faint);padding:14px;text-align:center;border:1px dashed var(--border);border-radius:var(--r-m)">${esc(t('crm.nodeals'))}</div>`}
    </div>`;
  }).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">
      ${crumbs([DB.company.name,t('nav.crm'),t('crm.pipeline')])}
      <div class="h1row"><h1>${esc(t('crm.title'))}</h1><span class="countchip">${openCount} ${esc(t('crm.open'))}</span>
        <div class="headright">
          <div class="kfig"><small>${esc(t('crm.kpi.value'))}</small><b class="tnum">${money0(total)}</b></div>
          <div class="kfig"><small>${esc(t('crm.kpi.weighted'))}</small><b class="tnum">${money0(weighted)}</b></div>
          <div class="kfig"><small>${esc(t('crm.kpi.won'))}</small><b class="tnum pos">${money0(wonVal)}</b></div>
        </div></div>
    </div>
    <div class="toolbar">
      <div class="filterchips"><button class="chip on">${esc(t('crm.chip.allowners'))}</button><button class="chip">${esc(t('crm.chip.mydeals'))}</button><button class="chip">${esc(t('crm.chip.closing'))}</button><button class="chip">${esc(t('crm.chip.hot'))}</button></div>
      <div class="grow"></div>
      <button class="viewsel" data-tip="${esc(t('crm.groupbytip'))}">${ic('flow')}${esc(t('crm.groupby'))}${ic('chevD')}</button>
      ${btn(t('common.export'),{icon:'download',cls:'soft'})}
      ${btn(t('crm.newopp'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-opportunity\')"'})}
    </div>
    <div class="kanban">${cols}</div>
  </section></div>`;
  root.querySelectorAll('.kcard[data-opp]').forEach(c=>c.addEventListener('click',()=>{
    c.dataset.opp==='OPP-26-0091'?navigate('opportunity'):toast('Opening '+c.dataset.opp,'info');
  }));
  root.querySelectorAll('[data-convert]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const opp=DB.pipeline.flatMap(c=>c.items).find(o=>o.no===b.dataset.convert);
    if(opp) openConvertOpportunityModal(opp);
  }));
};

/* TASK-028: opportunities have no line items of their own (exact SKU/qty are
   decided at conversion time — see src/data/schema/crm.ts's header comment),
   so converting needs a small form, unlike Purchasing's one-click receive/
   post actions. Defaults the qty to roughly match the opportunity's value at
   the picked item's cost, editable before confirming. */
function openConvertOpportunityModal(o){
  const items=DB.items;
  if(!items.length){ toast('No items available to convert against','warn'); return; }
  const suggestQty=(it)=>Math.max(1,Math.round(o.value/(it.cost||1)));
  appModal({
    icon:'bag', title:'Convert to sales order', width:420,
    body:`<p style="color:var(--muted);font-size:13px;margin:0 0 14px">${esc(o.title)} · ${esc(o.cust)} · ${money0(o.value)}</p>
      <div class="fld"><span>Item</span><select id="cvItem">${items.map(it=>`<option value="${esc(it.sku)}">${esc(it.sku)} · ${esc(it.name)} — ${money(it.cost)}/${esc(it.uom)}</option>`).join('')}</select></div>
      <div class="fldrow c2" style="margin-top:12px">
        <div class="fld"><span>Qty</span><input type="number" id="cvQty" min="1" value="${suggestQty(items[0])}"></div>
        <div class="fld"><span>Unit price</span><input type="number" id="cvPrice" min="0" step="0.01" value="${items[0].cost}"></div>
      </div>`,
    actions: btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})
      + btn('Convert',{icon:'check',cls:'primary',attrs:'id="cvConfirm"'}),
  });
  const itemSel=$('#cvItem'), qtyEl=$('#cvQty'), priceEl=$('#cvPrice');
  itemSel.addEventListener('change',()=>{
    const it=items.find(x=>x.sku===itemSel.value);
    qtyEl.value=suggestQty(it); priceEl.value=it.cost;
  });
  $('#cvConfirm').addEventListener('click', async ()=>{
    if(!(window.ErpSystemDemo&&typeof window.ErpSystemDemo.convertOpportunityToSalesOrder==='function')){ toast('Demo adapter not loaded','warn'); return; }
    const confirmBtn=$('#cvConfirm'); confirmBtn.disabled=true;
    try{
      const res=await window.ErpSystemDemo.convertOpportunityToSalesOrder(
        o.no, itemSel.value, Math.max(1,+qtyEl.value||1), Math.max(0,+priceEl.value||0));
      closeModal();
      navigate('crm-pipeline');
      toast(`${o.no} converted — ${res.docNo} created · ${money(res.total)}`,'ok');
    }catch(e){
      toast((e&&e.message)||'Convert failed','danger');
      confirmBtn.disabled=false;
    }
  });
}

/* ---------------- OPPORTUNITY (document) ---------------- */
SCREENS['opportunity'] = function(root){
  const d=DB.opp0091, c=d.cust;
  const order=['Lead','Qualified','Proposal','Negotiation','Won'];
  const curIdx=order.indexOf(d.stage);
  const steps=order.map((st,i)=>{
    const cls=i<curIdx?'done':i===curIdx?'current':'';
    return `<div class="step ${cls}"><span class="sdot">${i<curIdx?ic('check'):i===curIdx?ic('clock'):''}</span>${st}</div>${i<order.length-1?`<span class="stepline ${i<curIdx?'done':''}"></span>`:''}`;
  }).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,'CRM','Pipeline',{cur:d.no}])}
      <div class="dochead">
        <div class="dh-row1">
          <div>
            <div class="dt">${ic('handshake')}${esc(d.title)} <span class="dnum">${esc(d.no)}</span></div>
            <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(c.name)} · owner ${esc(d.owner)} · ${esc(d.source)}</div>
          </div>
          <div class="dactions">${cap(d.stage,crmStageTone(d.stage))}${btn('Customer 360',{icon:'user',cls:'soft',attrs:'onclick="navigate(\'crm-customer\')"'})}</div>
        </div>
        <div class="stepper">${steps}</div>
        <div class="docmeta">
          <div class="dm"><small>Value</small><b>${money(d.value)}</b></div>
          <div class="dm"><small>Probability</small><b>${d.prob}%</b></div>
          <div class="dm"><small>Expected close</small><b>${esc(d.close)}</b></div>
          <div class="dm"><small>Age</small><b>${esc(d.age)}</b></div>
          <div class="dm"><small>Owner</small><b>${esc(d.owner)}</b></div>
        </div>
      </div>

      <div class="appr-layout">
        <div class="docmain">
          <div class="panel">
            <div class="panel-h"><h3>Next actions</h3></div>
            <div class="panel-body" style="padding-top:12px">
              <div class="risk warn">${ic('clock')}<div><b>Close date in 14 days</b><small>Customer is pushing for Jun 18 delivery — quote includes a 12% volume discount above the standard threshold and is pending sales approval as SO-26-0418.</small></div></div>
              <div class="risk danger">${ic('warn')}<div><b>Account has overdue balance</b><small>${esc(c.name)} is carrying ${money(c.overdue)} overdue against a ${money(c.limit)} limit — confirm credit before converting.</small></div></div>
              <div class="risk ok">${ic('checkc')}<div><b>Technical scope agreed</b><small>Site walkthrough complete; 9 Conveyor Drive Units scoped against current BOM Rev C.</small></div></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Activity timeline</h3></div>
            <div class="panel-body">${auditTrail(d.activities)}</div>
          </div>
        </div>

        <aside>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Deal value</div>
            <div class="sumrow"><span class="sk2">Opportunity value</span><span class="sv tnum">${money(d.value)}</span></div>
            <div class="sumrow"><span class="sk2">Probability</span><span class="sv tnum">${d.prob}%</span></div>
            <div class="sumrow total"><span class="sk2">Weighted</span><span class="sv tnum">${money(d.value*d.prob/100)}</span></div>
            <div class="indicator warn" style="margin-top:12px">
              <div class="ind-top">${ic('flow')}<span>Stage</span><span class="ind-r">${esc(d.stage)}</span></div>
              <div class="track"><i style="width:${d.prob}%"></i></div>
              <small>${d.prob}% — one approval from Closed Won.</small>
            </div>
          </div>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Primary contact</div>
            <div class="field"><span class="k">Name</span><span class="v">${esc(d.contact.name)}</span></div>
            <div class="field"><span class="k">Role</span><span class="v">${esc(d.contact.role)}</span></div>
            <div class="field"><span class="k">Email</span><span class="v">${esc(d.contact.email)}</span></div>
            <div class="field"><span class="k">Phone</span><span class="v">${esc(d.contact.phone)}</span></div>
          </div>
          <div class="sumcard">
            <div class="sectitle" style="margin-top:0">Related</div>
            ${relatedDocs([
              {no:'SO-26-0418',label:'Sales order (from quote)',meta:'12% discount',status:'Pending Approval'},
              {no:c.code,label:esc(c.name),meta:'Customer 360',status:'Active'},
            ])}
          </div>
        </aside>
      </div>
    </div></div>

    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Stage <b style="color:var(--fg)">Negotiation</b> · converting creates a sales order in Draft.</div>
      <div class="grow"></div>
      ${btn('Log activity',{icon:'comment',cls:'soft',attrs:'onclick="toast(\'Activity logged\',\'ok\')"'})}
      ${btn('Mark lost',{icon:'x',cls:'danger',attrs:'onclick="toast(\'Opportunity marked lost\',\'danger\')"'})}
      ${btn('Convert to sales order',{icon:'bag',cls:'primary',sm:false,attrs:'onclick="navigate(\'sales-order\')"'})}
    </div>
  </section></div>`;
};

/* ---------------- CUSTOMER 360 (master / profile) ---------------- */
SCREENS['crm-customer'] = function(root){
  const c=DB.cust0007;
  const usedPct=Math.round(c.balance/c.limit*100);
  root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
    ${crumbs([DB.company.name,'CRM','Customers',{cur:c.code}])}
    <div class="dochead">
      <div class="dh-row1"><div><div class="dt">${ic('user')}${esc(c.name)} <span class="dnum">${esc(c.code)}</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(c.industry)} · customer since ${esc(c.since)} · owner ${esc(c.owner)}</div></div>
        <div class="dactions">${cap(c.status,'ok')}${btn('New opportunity',{icon:'plus',cls:'soft',attrs:'onclick="navigate(\'opportunity\')"'})}${btn('New sales order',{icon:'bag',cls:'primary',attrs:'onclick="navigate(\'new-sales-order\')"'})}</div></div>
    </div>
    <div class="doclayout">
      <div class="docmain">
        <div class="panel"><div class="panel-h"><h3>Account</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Payment terms</span><input value="${esc(c.terms)}" readonly></div>
            <div class="fld"><span>Credit limit</span><input value="${money(c.limit)}" readonly></div>
            <div class="fld"><span>Account owner</span><input value="${esc(c.owner)}" readonly></div>
          </div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Contacts</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${c.contacts.length}</span></div>
          <div class="panel-body" style="padding:6px 0">${c.contacts.map(p=>`<div class="oprow"><span class="kc-av" style="background:${p.clr};width:30px;height:30px;font-size:11px">${esc(p.av)}</span><div class="opmain"><b>${esc(p.name)}</b><small>${esc(p.role)}</small></div>${btn('Email',{icon:'send',cls:'soft'})}</div>`).join('')}</div>
        </div>
        <div class="panel"><div class="panel-h"><h3>Open orders</h3></div><div class="panel-body">${relatedDocs(c.openOrders)}</div></div>
        <div class="panel"><div class="panel-h"><h3>Open opportunities</h3></div><div class="panel-body">${relatedDocs(c.opps)}</div></div>
        <div class="panel"><div class="panel-h"><h3>Activity</h3></div><div class="panel-body">${auditTrail(c.activities)}</div></div>
      </div>
      <aside class="summary">
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Receivables</div>
          <div class="sumrow"><span class="sk2">Balance</span><span class="sv tnum">${money(c.balance)}</span></div>
          <div class="sumrow"><span class="sk2">Overdue</span><span class="sv tnum" style="color:var(--danger)">${money(c.overdue)}</span></div>
          <div class="sumrow total"><span class="sk2">Credit limit</span><span class="sv tnum">${money(c.limit)}</span></div>
          <div class="indicator ${usedPct>90?'danger':usedPct>70?'warn':'ok'}" style="margin-top:12px">
            <div class="ind-top">${ic('receipt')}<span>Limit used</span><span class="ind-r">${usedPct}%</span></div>
            <div class="track"><i style="width:${Math.min(100,usedPct)}%"></i></div>
            <small>${money(c.balance)} of ${money(c.limit)} · ${money(c.overdue)} overdue.</small>
          </div>
        </div>
        <div class="sumcard"><div class="sectitle" style="margin-top:0">Lifetime</div>
          <div class="sumrow"><span class="sk2">Open pipeline</span><span class="sv tnum">${money0(114420)}</span></div>
          <div class="sumrow"><span class="sk2">Won (FY26)</span><span class="sv tnum">${money0(312800)}</span></div>
          <div class="sumrow"><span class="sk2">Avg. terms</span><span class="sv">${esc(c.terms)}</span></div>
        </div>
      </aside>
    </div>
    <div style="height:60px"></div>
  </div></div></section></div>`;
};
