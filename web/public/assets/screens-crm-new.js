/* ============================================================
   ARIA ERP — New Opportunity composer (create flow)
   Single-screen CRM deal editor with a live pipeline-card
   preview and weighted-value readout. Stage drives a suggested
   win probability. Reached from Quick create, the command
   palette and the Sales Pipeline. Confirms to the pipeline.
   ============================================================ */
SCREENS['new-opportunity'] = async function(root){
  await prepareCanonicalCrmData();
  const STAGES=[['Lead',10],['Qualified',30],['Proposal',50],['Negotiation',70]];
  const stageProb=st=>(STAGES.find(s=>s[0]===st)||[null,10])[1];
  const currentOwner=(DB.user&&DB.user.name)||'Unassigned';
  const OWNER={name:currentOwner,imageUrl:(DB.user&&(DB.user.avatarUrl||DB.user.imageUrl||DB.user.photoUrl))||''};
  const today=new Date().toISOString().slice(0,10);
  const closeDefault=new Date(Date.now()+42*24*60*60*1000).toISOString().slice(0,10);
  const opportunitySuffix=typeof crypto!=='undefined'&&crypto.randomUUID
    ?crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()
    :String(Date.now()).slice(-8);
  const opportunityDocNo=`OPP-${today.replaceAll('-','')}-${opportunitySuffix}`;

  const S={ title:'', custCode:'', value:50000, stage:'Lead', prob:10,
    close:closeDefault, probTouched:false };

  const cust=()=>DB.customers.find(c=>c.code===S.custCode);
  const owner=()=>OWNER;
  const weighted=()=> S.value*S.prob/100;
  const canCreate=()=> S.title.trim() && S.custCode && S.value>0;

  /* ---------------- live preview card ---------------- */
  function previewCard(){
    const o=owner(), c=cust();
    const clr=crmStageColor(S.stage);
    return `<div class="kcard" style="cursor:default;max-width:none">
      <div class="kc-cust">${ic('handshake')}${esc(c?c.name:'— select customer —')}</div>
      <div class="kc-title">${esc(S.title||'Untitled opportunity')}</div>
      <div class="kc-val">${money0(S.value)}</div>
      <div class="kprob"><i style="width:${S.prob}%;background:${clr}"></i></div>
      <div class="kc-foot">
        ${profileAvatar({name:o.name,src:o.imageUrl,size:22})}
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
      ${btn('Create opportunity',{icon:'check',cls:'primary',sm:false,attrs:`id="wCreate" ${ok?'':'disabled style="opacity:.5;pointer-events:none"'}`})}`;
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
              <div class="fld" style="margin-top:12px"><span>Customer <span class="req">*</span></span>
                ${combobox({id:'wCust',value:S.custCode,placeholder:'Search customers…',options:DB.customers.map(c=>({value:c.code,label:c.name,sub:c.code}))})}</div>
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
                <div class="fld"><span>Currency</span><input value="${esc(DB.company.currency)}" readonly></div>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h">${ic('user')}<h3>Ownership</h3></div>
            <div class="panel-body">
              <div class="fldrow c2">
                <div class="fld"><span>Created by</span><input value="${esc(currentOwner)}" readonly></div>
                <div class="fld"><span>Opportunity number</span><input value="${esc(opportunityDocNo)}" readonly></div>
              </div>
              <div style="margin-top:12px;color:var(--muted);font-size:12.5px">Activity notes and owner assignment will be added with the canonical CRM activity workflow.</div>
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
    const v=$('#wValue'); v.addEventListener('input',()=>{ S.value=Math.max(0,+v.value||0); refreshSidebar(); refreshBar(); });
    const st=$('#wStage'); st.addEventListener('change',()=>{ S.stage=st.value;
      if(!S.probTouched){ S.prob=stageProb(S.stage); $('#wProb').value=S.prob; } refreshSidebar(); });
    const pr=$('#wProb'); pr.addEventListener('input',()=>{ S.prob=Math.min(100,Math.max(0,+pr.value||0)); S.probTouched=true; refreshSidebar(); });
    const cl=$('#wClose'); cl.addEventListener('change',()=>{ S.close=cl.value; refreshSidebar(); });
  }
  function wireBar(){
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('crm-pipeline'));
    const create=$('#wCreate'); create&&create.addEventListener('click',async()=>{
      if(!canCreate())return;
      const adapter=window.ErpSystemData;
      if(!adapter||typeof adapter.create!=='function'){ toast('ERP data adapter not loaded','warn'); return; }
      create.disabled=true;
      try{
        const c=cust();
        const response=await adapter.create('crm/opportunities',{
          docNo:opportunityDocNo,
          customerId:c.id,
          title:S.title.trim(),
          value:S.value,
          currency:DB.company.currency,
          stage:S.stage.toLowerCase(),
          probability:S.prob,
          closeDate:S.close,
        });
        const res=response.data||{};
        navigate('crm-pipeline');
        toast(`Opportunity ${res.docNo||opportunityDocNo} created · ${c.name} · ${money0(S.value)} · ${S.stage}`,'ok');
      }catch(e){
        toast((e&&e.message)||'Create opportunity failed','danger');
        create.disabled=false;
      }
    });
  }
  render();
};
