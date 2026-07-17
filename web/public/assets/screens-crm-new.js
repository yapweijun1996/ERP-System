/* ============================================================
   ARIA ERP — New Opportunity composer (create flow)
   Single-screen CRM deal editor with a live pipeline-card
   preview and weighted-value readout. Stage drives a suggested
   win probability. Reached from Quick create, the command
   palette and the Sales Pipeline. Confirms to the pipeline.
   ============================================================ */
SCREENS['new-opportunity'] = function(root){
  const STAGES=[['Lead',10],['Qualified',30],['Proposal',50],['Negotiation',70]];
  const stageProb=st=>(STAGES.find(s=>s[0]===st)||[null,10])[1];
  const OWNERS=[
    {name:'J. Okafor', av:'JO', clr:'#0a84ff'},
    {name:'L. Tan',    av:'LT', clr:'#1f9d57'},
    {name:'A. Costa',  av:'AC', clr:'#ff9f0a'},
    {name:'M. Reyes',  av:'MR', clr:'#bf5af2'},
  ];
  const SOURCES=['Inbound enquiry','Referral','Outbound prospecting','Trade show / event','Existing customer','Partner'];

  const S={ title:'', custCode:'', value:50000, stage:'Lead', prob:10,
    close:'2026-08-29', owner:OWNERS[0].name, source:'Inbound enquiry', hot:false,
    nextStep:'', notes:'', probTouched:false };

  const cust=()=>DB.customers.find(c=>c.code===S.custCode);
  const owner=()=>OWNERS.find(o=>o.name===S.owner)||OWNERS[0];
  const weighted=()=> S.value*S.prob/100;
  const canCreate=()=> S.title.trim() && S.custCode && S.value>0;

  /* ---------------- live preview card ---------------- */
  function previewCard(){
    const o=owner(), c=cust();
    const clr=crmStageColor(S.stage);
    return `<div class="kcard ${S.hot?'hot':''}" style="cursor:default;max-width:none">
      <div class="kc-cust">${ic('handshake')}${esc(c?c.name:'— select customer —')}${S.hot?` · <span style="color:var(--warn)">⚠</span>`:''}</div>
      <div class="kc-title">${esc(S.title||'Untitled opportunity')}</div>
      <div class="kc-val">${money0(S.value)}</div>
      <div class="kprob"><i style="width:${S.prob}%;background:${clr}"></i></div>
      <div class="kc-foot">
        <span class="kc-av" style="background:${o.clr}">${esc(o.av)}</span>
        <span class="kc-close">${ic('calendar')} ${esc(S.close)}</span>
        <span class="kc-prob">${S.prob}%</span>
      </div></div>`;
  }
  function sidebar(){
    return `<div class="sumcard">
      <div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Pipeline preview</div>
      <div style="background:var(--surface-2);border-radius:var(--r-m);padding:10px">${previewCard()}</div>
    </div>
    <div class="sumcard">
      <div class="sumrow"><span class="sk2">Deal value</span><span class="sv tnum">${money(S.value)}</span></div>
      <div class="sumrow"><span class="sk2">Win probability</span><span class="sv tnum">${S.prob}%</span></div>
      <div class="sumrow total"><span class="sk2">Weighted value</span><span class="sv tnum">${money(weighted())}</span></div>
      <div style="margin-top:10px">${indicator({tone:'accent',icon:'flow',label:'Enters stage',value:esc(S.stage),sub:`Lands in the ${esc(S.stage)} column of the pipeline.`})}</div>
    </div>`;
  }
  function refreshSidebar(){ const a=$('#wSide'); if(a)a.innerHTML=sidebar(); }
  function refreshBar(){ const b=$('#wBar'); if(b){ b.innerHTML=bar(); wireBar(); } }

  /* ---------------- bar ---------------- */
  function bar(){
    const ok=canCreate();
    const hint=ok?'Ready to add to the pipeline':'Add a title, customer and value to continue';
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div>
      <div class="grow"></div>
      ${btn('Cancel',{cls:'soft',attrs:'id="wCancel"'})}
      ${btn('Create opportunity',{icon:'check',cls:'primary',sm:false,attrs:`id="wCreate" ${ok?'':'disabled style=\"opacity:.5;pointer-events:none\"'}`})}`;
  }

  /* ---------------- render ---------------- */
  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Opportunity">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'CRM','Pipeline',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('handshake')}New Opportunity</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">Draft · add a deal to the sales pipeline · ${esc(DB.company.name)}</div></div>
            <div class="dactions">${cap('Draft','neutral')}</div>
          </div>
        </div>

        <div class="doclayout"><div class="docmain">
          <div class="panel">
            <div class="panel-h">${ic('handshake')}<h3>Opportunity</h3></div>
            <div class="panel-body">
              <div class="fld"><span>Title <span class="req">*</span></span><input id="wTitle" value="${esc(S.title)}" placeholder="e.g. Packaging line expansion — Phase 2"></div>
              <div class="fldrow c2" style="margin-top:12px">
                <div class="fld"><span>Customer <span class="req">*</span></span>
                  ${combobox({id:'wCust',value:S.custCode,placeholder:'Search customers…',options:DB.customers.map(c=>({value:c.code,label:c.name,sub:c.code}))})}</div>
                <div class="fld"><span>Source</span><select id="wSource">${SOURCES.map(s=>`<option ${s===S.source?'selected':''}>${s}</option>`).join('')}</select></div>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h">${ic('coins')}<h3>Value &amp; forecast</h3></div>
            <div class="panel-body">
              <div class="fldrow c3">
                <div class="fld"><span>Deal value (${esc(DB.company.currency)}) <span class="req">*</span></span><input type="number" id="wValue" min="0" step="1000" value="${S.value}"></div>
                <div class="fld"><span>Stage</span><select id="wStage">${STAGES.map(s=>`<option ${s[0]===S.stage?'selected':''}>${s[0]}</option>`).join('')}</select></div>
                <div class="fld"><span>Win probability</span><div style="display:flex;align-items:center;gap:8px"><input type="number" id="wProb" min="0" max="100" value="${S.prob}" style="width:80px"><span style="color:var(--muted);font-size:13px">%</span></div></div>
              </div>
              <div class="fldrow c2" style="margin-top:12px">
                <div class="fld"><span>Expected close</span><input type="date" id="wClose" value="${S.close}"></div>
                <div class="fld"><span>Owner</span><select id="wOwner">${OWNERS.map(o=>`<option ${o.name===S.owner?'selected':''}>${esc(o.name)}</option>`).join('')}</select></div>
              </div>
              <label class="checkrow" id="wHotRow" style="display:flex;align-items:center;gap:10px;margin-top:14px;cursor:pointer">
                <button type="button" class="set-tgl ${S.hot?'on':''}" id="wHot" role="switch" aria-checked="${S.hot}"><span class="set-tgl-k"></span></button>
                <span><b style="font-size:13.5px">Flag as hot deal</b><small style="display:block;color:var(--muted);font-size:12px">Highlights the card and surfaces it in the “Hot” filter.</small></span>
              </label>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h">${ic('edit')}<h3>Notes &amp; next step</h3></div>
            <div class="panel-body">
              <div class="fld"><span>Next step</span><input id="wNext" value="${esc(S.nextStep)}" placeholder="e.g. Send proposal by Fri; schedule site visit"></div>
              <div class="fld" style="margin-top:12px"><span>Notes</span><textarea id="wNotes" rows="3" placeholder="Context, stakeholders, competition…" style="resize:vertical">${esc(S.notes)}</textarea></div>
            </div>
          </div>
        </div>
        <aside class="summary" id="wSide">${sidebar()}</aside></div>
        <div style="height:8px"></div>
      </div></div>
      <div class="set-savebar" id="wBar">${bar()}</div>
    </section></div>`;
    wire(); wireBar();
  }

  function wire(){
    const t=$('#wTitle'); t.addEventListener('input',()=>{ S.title=t.value; refreshSidebar(); refreshBar(); });
    wireCombobox('wCust',{options:DB.customers.map(c=>({value:c.code,label:c.name,sub:c.code})),onChange:v=>{ S.custCode=v; refreshSidebar(); refreshBar(); }});
    const src=$('#wSource'); src.addEventListener('change',()=>S.source=src.value);
    const v=$('#wValue'); v.addEventListener('input',()=>{ S.value=Math.max(0,+v.value||0); refreshSidebar(); refreshBar(); });
    const st=$('#wStage'); st.addEventListener('change',()=>{ S.stage=st.value;
      if(!S.probTouched){ S.prob=stageProb(S.stage); $('#wProb').value=S.prob; } refreshSidebar(); });
    const pr=$('#wProb'); pr.addEventListener('input',()=>{ S.prob=Math.min(100,Math.max(0,+pr.value||0)); S.probTouched=true; refreshSidebar(); });
    const cl=$('#wClose'); cl.addEventListener('change',()=>{ S.close=cl.value; refreshSidebar(); });
    const ow=$('#wOwner'); ow.addEventListener('change',()=>{ S.owner=ow.value; refreshSidebar(); });
    const hot=$('#wHot'); $('#wHotRow').addEventListener('click',e=>{ e.preventDefault(); S.hot=!S.hot; hot.classList.toggle('on',S.hot); hot.setAttribute('aria-checked',S.hot); refreshSidebar(); });
    const ns=$('#wNext'); ns.addEventListener('input',()=>S.nextStep=ns.value);
    const no=$('#wNotes'); no.addEventListener('input',()=>S.notes=no.value);
  }
  function wireBar(){
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('crm-pipeline'));
    const create=$('#wCreate'); create&&create.addEventListener('click',async()=>{
      if(!canCreate())return;
      if(!(window.ErpSystemDemo&&typeof window.ErpSystemDemo.createOpportunity==='function')){ toast('Demo adapter not loaded','warn'); return; }
      create.disabled=true;
      try{
        const c=cust();
        const res=await window.ErpSystemDemo.createOpportunity({
          customerCode:S.custCode, title:S.title.trim(), value:S.value, currency:DB.company.currency,
          stage:S.stage, probability:S.prob, closeDate:S.close,
        });
        navigate('crm-pipeline');
        toast(`Opportunity ${res.docNo} created · ${c.name} · ${money0(S.value)} · ${S.stage}${S.hot?' · hot':''}`,'ok');
      }catch(e){
        toast((e&&e.message)||'Create opportunity failed','danger');
        create.disabled=false;
      }
    });
  }
  render();
};
