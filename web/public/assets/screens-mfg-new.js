/* ============================================================
   ARIA ERP — New Work Order wizard (create flow)
   2 steps: Product & schedule → Materials & release.
   Explodes the product BOM against live stock, flags shortages,
   rolls up cost, and releases (or saves as planned). Reached
   from Quick create, the command palette and the Work Orders list.
   ============================================================ */
SCREENS['new-work-order'] = function(root){
  const TODAY='2026-06-26', DUE='2026-07-08';
  // products that have a bill of materials
  const BOMS={ 'NW-9001': DB.bom };
  const buildable=DB.items.filter(it=>BOMS[it.sku]);
  const workCentres=['Assembly Line 1','Assembly Line 2','Machining Cell','Finishing & Pack'];
  const whOut=['KL-Main','KL-Overflow','Penang DC'];

  const S={ step:0, reached:0,
    fg:(buildable[0]&&buildable[0].sku)||'', qty:10, start:TODAY, due:DUE,
    wc:'Assembly Line 1', warehouse:'KL-Main', demand:'', priority:'Normal' };

  const bom=()=>BOMS[S.fg];
  const fgItem=()=>DB.items.find(i=>i.sku===S.fg);
  function explode(){
    const b=bom(); if(!b) return [];
    return b.components.map(c=>{
      const req=+(c.qty*S.qty*(1+(c.scrap||0)/100)).toFixed(2);
      const it=DB.items.find(i=>i.sku===c.item);
      const avail=it?Math.max(0,it.onHand-it.alloc):0;
      const short=Math.max(0,+(req-avail).toFixed(2));
      return {...c, req, avail, short};
    });
  }
  function rollup(){
    const b=bom(); if(!b) return {matUnit:0,matTotal:0,qty:S.qty};
    const matUnit=b.components.reduce((s,c)=>s+c.qty*c.cost*(1+(c.scrap||0)/100),0);
    return {matUnit, matTotal:matUnit*S.qty, qty:S.qty};
  }
  function shortages(){ return explode().filter(l=>l.short>0); }

  /* ---------------- STEP 1 — product & schedule ---------------- */
  function step1(){
    const b=bom();
    const r=rollup();
    const sidebar=b?`${indicator({tone:'ok',icon:'box',label:'Bill of materials',value:`${b.components.length} parts`,sub:`${esc(b.rev)} · effective ${esc(b.effective)} · std cost ${money(b.stdCost)}/unit.`})}
      <div style="margin-top:8px">${indicator({tone:'accent',icon:'coins',label:'Material cost',value:money0(r.matTotal),sub:`${money(r.matUnit)} per unit × ${num(S.qty)} ${esc(b.uom)} (incl. scrap).`})}</div>`
      :`<div style="color:var(--muted);font-size:13px;padding:6px 2px">This product has no active bill of materials.</div>`;
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('factory')}<h3>Product to build</h3></div>
        <div class="panel-body">
          <div class="fldrow c2">
            <div class="fld"><span>Finished good <span class="req">*</span></span>
              <select id="wFg">${buildable.map(it=>`<option value="${it.sku}" ${it.sku===S.fg?'selected':''}>${esc(it.sku)} · ${esc(it.name)}</option>`).join('')}</select></div>
            <div class="fld"><span>Build quantity <span class="req">*</span></span>
              <div style="display:flex;align-items:center;gap:8px"><input type="number" id="wQty" min="1" value="${S.qty}" style="width:120px"><span style="color:var(--muted);font-size:13px">${b?esc(b.uom):'ea'}</span></div></div>
          </div>
          ${b?`<div class="fldrow c2" style="margin-top:12px">
            <div class="fld"><span>BOM revision</span><input value="${esc(b.rev)} · ${esc(b.status)}" readonly></div>
            <div class="fld"><span>Routing</span><input value="${workCentres.length} work centres" readonly></div></div>`:''}
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">${ic('clock')}<h3>Schedule</h3></div>
        <div class="panel-body">
          <div class="fldrow c3">
            <div class="fld"><span>Planned start</span><input type="date" id="wStart" value="${S.start}"></div>
            <div class="fld"><span>Due date</span><input type="date" id="wDue" value="${S.due}"></div>
            <div class="fld"><span>Priority</span><select id="wPrio">${['Low','Normal','High','Urgent'].map(p=>`<option ${p===S.priority?'selected':''}>${p}</option>`).join('')}</select></div>
          </div>
          <div class="fldrow c3" style="margin-top:12px">
            <div class="fld"><span>Work centre</span><select id="wWc">${workCentres.map(w=>`<option ${w===S.wc?'selected':''}>${w}</option>`).join('')}</select></div>
            <div class="fld"><span>Receive into</span><select id="wWh">${whOut.map(w=>`<option ${w===S.warehouse?'selected':''}>${w}</option>`).join('')}</select></div>
            <div class="fld"><span>Demand source</span><input id="wDemand" value="${esc(S.demand)}" placeholder="e.g. SO-26-0417 / stock"></div>
          </div>
        </div>
      </div>
    </div>
    <aside class="summary"><div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Build summary</div>${sidebar}</div></aside></div>`;
  }
  function wire1(){
    const fg=$('#wFg'); fg&&fg.addEventListener('change',()=>{ S.fg=fg.value; render(); });
    const qty=$('#wQty'); qty&&qty.addEventListener('input',()=>{ S.qty=Math.max(1,+qty.value||1);
      const card=$('.summary .sumcard'); if(card){ const r=rollup(),b=bom();
        card.innerHTML=`<div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Build summary</div>${indicator({tone:'ok',icon:'box',label:'Bill of materials',value:`${b.components.length} parts`,sub:`${esc(b.rev)} · effective ${esc(b.effective)} · std cost ${money(b.stdCost)}/unit.`})}<div style="margin-top:8px">${indicator({tone:'accent',icon:'coins',label:'Material cost',value:money0(r.matTotal),sub:`${money(r.matUnit)} per unit × ${num(S.qty)} ${esc(b.uom)} (incl. scrap).`})}</div>`; } });
    const b=(id,key,ev='change')=>{ const el=$('#'+id); el&&el.addEventListener(ev,()=>S[key]=el.value); };
    b('wStart','start'); b('wDue','due'); b('wPrio','priority'); b('wWc','wc'); b('wWh','warehouse'); b('wDemand','demand','input');
  }

  /* ---------------- STEP 2 — materials & release ---------------- */
  function step2(){
    const lines=explode(), r=rollup(), shorts=shortages();
    const rows=lines.map((l,i)=>{
      const state=l.short>0?cap('Short '+num(l.short),'danger'):cap('Available','ok');
      return `<tr><td class="lineno">${i+1}</td>
        <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.item)} · ${l.qty} ${esc(l.uom)}/unit${l.scrap?` · ${l.scrap}% scrap`:''} @ ${money(l.cost)}</small></td>
        <td class="tnum">${num(l.req)} ${esc(l.uom)}</td>
        <td class="tnum" style="color:${l.short>0?'var(--danger)':'var(--muted)'}">${num(l.avail)}</td>
        <td class="tnum"><b>${money(l.req*l.cost)}</b></td>
        <td class="l">${state}</td></tr>`;
    }).join('');
    const ready=lines.length-shorts.length;
    const matCard=shorts.length
      ? indicator({tone:'warn',icon:'warn',label:`${shorts.length} material shortage${shorts.length>1?'s':''}`,value:`${ready}/${lines.length} ready`,sub:'Released anyway as Planned — shortages route to MRP for procurement.'})
      : indicator({tone:'ok',icon:'checkc',label:'All materials available',value:`${lines.length}/${lines.length} ready`,sub:'Stock can be allocated and the order released to the floor.'});
    return `<div class="doclayout"><div class="docmain">
      <div class="panel">
        <div class="panel-h">${ic('box')}<h3>Material requirements</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${lines.length} components · ${num(S.qty)} ${esc(bom().uom)}</span></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Component</th><th>Required</th><th>Available</th><th>Ext. cost</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody></table>
        <div class="linefoot" style="display:flex;justify-content:flex-end;gap:30px;font-weight:600;padding:12px 14px">
          <span style="color:var(--muted);margin-right:auto;padding-left:6px">Material cost roll-up</span>
          <span class="tnum">${money(r.matUnit)}/unit</span><span class="tnum">${money(r.matTotal)} total</span></div>
      </div>
    </div>
    <aside class="summary">
      <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Order summary</div>
        <div class="sumrow"><span class="sk2">Product</span><span class="sv">${esc(fgItem().name)}</span></div>
        <div class="sumrow"><span class="sk2">Quantity</span><span class="sv tnum">${num(S.qty)} ${esc(bom().uom)}</span></div>
        <div class="sumrow"><span class="sk2">Work centre</span><span class="sv">${esc(S.wc)}</span></div>
        <div class="sumrow"><span class="sk2">Due</span><span class="sv">${esc(S.due)}</span></div>
        <div class="sumrow total"><span class="sk2">Material cost</span><span class="sv tnum">${money(r.matTotal)}</span></div>
      </div>
      <div class="sumcard"><div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Material readiness</div>${matCard}</div>
    </aside></div>`;
  }

  /* ---------------- shell / render ---------------- */
  const steps=[['Product & schedule','factory'],['Materials & release','box']];
  function stepper(){ return wizardStepper(steps, S.step, S.reached); }
  function canAdvance(){ if(S.step===0) return !!S.fg && S.qty>0; return true; }
  function footer(){
    const adv=canAdvance();
    let right;
    if(S.step<1){
      right=btn('Continue',{icon:'arrowR',cls:'primary',sm:false,attrs:`id="wNext" ${adv?'':'disabled style="opacity:.5;pointer-events:none"'}`});
    } else {
      const shorts=shortages().length;
      right=shorts
        ? btn('Save as planned',{icon:'check',cls:'primary',sm:false,attrs:'id="wCreate"'})
        : btn('Release work order',{icon:'check',cls:'primary',sm:false,attrs:'id="wCreate"'});
    }
    const left=S.step>0?btn('Back',{icon:'chevL',cls:'soft',attrs:'id="wBack"'}):btn('Cancel',{cls:'soft',attrs:'id="wCancel"'});
    const hint=S.step===0?'Step 1 of 2 · what to build and when'
      :(shortages().length?`Step 2 of 2 · ${shortages().length} shortage(s) — will save as Planned`:'Step 2 of 2 · materials ready to release');
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div><div class="grow"></div>${left}${right}`;
  }
  function body(){ return S.step===0?step1():step2(); }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Work Order">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'Manufacturing','Work Orders',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('factory')}New Work Order</div>
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
    if(S.step===0)wire1();
  }
  function wireShell(){
    $$('#viewRoot .step[data-step]').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.step; render(); }));
    const next=$('#wNext'); next&&next.addEventListener('click',()=>{ if(!canAdvance())return; S.step++; S.reached=Math.max(S.reached,S.step); render(); });
    const back=$('#wBack'); back&&back.addEventListener('click',()=>{ S.step--; render(); });
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('work-orders'));
    const create=$('#wCreate'); create&&create.addEventListener('click',()=>{
      const shorts=shortages().length;
      navigate('work-orders');
      setTimeout(()=>toast(`Work order WO-26-0083 created · ${num(S.qty)} × ${fgItem().name}${shorts?` · saved as Planned (${shorts} shortage${shorts>1?'s':''})`:' · released to '+S.wc}`,shorts?'info':'ok'),180);
    });
  }
  render();
};
