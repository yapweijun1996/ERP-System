/* ============================================================
   ARIA ERP — New Item composer (create flow)
   Single-screen item-master create: basic info, inventory
   settings, accounting, and an optional opening balance, with
   a live stock-list preview. Reached from Quick create, the
   command palette and the Item Master / Stock screens.
   ============================================================ */
SCREENS['new-item'] = function(root){
  const CATS=['Components','Raw Materials','Finished Goods','Consumables','Packaging'];
  const UOMS=['ea','kg','m','sheet','L','box','pair','set'];
  const WH=['KL-Main','KL-Overflow','Penang DC'];
  const nextSku='NW-7790';

  const S={ name:'', cat:'Components', uom:'ea', desc:'',
    costing:'Weighted Average', reorder:50, roq:150, tracking:'None', shelfLife:'', negStock:'Block',
    invAcct:'1300 · Inventory', cogsAcct:'5100 · COGS', tax:'SR · 6% GST',
    openQty:0, openCost:0, openWh:'KL-Main' };

  const statusOf=()=> S.openQty<=0 ? 'No stock' : S.openQty<=S.reorder ? 'Low' : 'In stock';
  const statusTone=()=>{ const s=statusOf(); return s==='In stock'?'ok':s==='Low'?'warn':'neutral'; };

  function previewRow(){
    return `<table class="lines" style="margin:0"><thead><tr><th class="l">Item</th><th>On hand</th><th>Status</th></tr></thead><tbody>
      <tr><td class="l li-name"><b>${esc(S.name||'New item')}</b><small>${esc(nextSku)} · ${esc(S.cat)}</small></td>
      <td class="tnum">${num(S.openQty)} ${esc(S.uom)}</td>
      <td>${cap(statusOf(),statusTone())}</td></tr></tbody></table>`;
  }
  function sidebar(){
    const val=S.openQty*S.openCost;
    return `<div class="sumcard">
      <div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Stock-list preview</div>
      <div style="background:var(--surface-2);border-radius:var(--r-m);padding:8px">${previewRow()}</div>
    </div>
    <div class="sumcard">
      <div class="sumrow"><span class="sk2">Opening qty</span><span class="sv tnum">${num(S.openQty)} ${esc(S.uom)}</span></div>
      <div class="sumrow"><span class="sk2">Unit cost</span><span class="sv tnum">${money(S.openCost)}</span></div>
      <div class="sumrow total"><span class="sk2">Opening value</span><span class="sv tnum">${money(val)}</span></div>
      <div style="margin-top:10px">${val>0
        ?indicator({tone:'ok',icon:'box',label:'Opening balance',value:money0(val),sub:`Posts a receipt of ${num(S.openQty)} ${esc(S.uom)} into ${esc(S.openWh)}.`})
        :indicator({tone:'neutral',icon:'box',label:'No opening balance',value:'0',sub:'Item is created with zero stock — receive it later via a PO or adjustment.'})}</div>
    </div>`;
  }
  function refreshSide(){ const a=$('#wSide'); if(a)a.innerHTML=sidebar(); }
  function refreshBar(){ const b=$('#wBar'); if(b){ b.innerHTML=bar(); wireBar(); } }

  function bar(){
    const ok=S.name.trim();
    const hint=ok?'Ready to create item':'Enter an item name to continue';
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div>
      <div class="grow"></div>
      ${btn('Cancel',{cls:'soft',attrs:'id="wCancel"'})}
      ${btn('Create item',{icon:'check',cls:'primary',sm:false,attrs:`id="wCreate" ${ok?'':'disabled style="opacity:.5;pointer-events:none"'}`})}`;
  }

  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Item">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'Inventory','Item Master',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('tag')}New Item</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">Draft · master data · ${esc(DB.company.name)}</div></div>
            <div class="dactions">${cap('Draft','neutral')}</div>
          </div>
        </div>

        <div class="doclayout"><div class="docmain">
          <div class="panel"><div class="panel-h">${ic('tag')}<h3>Basic information</h3></div><div class="panel-body">
            <div class="fldrow c2">
              <div class="fld"><span>Item name <span class="req">*</span></span><input id="wName" value="${esc(S.name)}" placeholder="e.g. Hydraulic Hose 12mm"></div>
              <div class="fld"><span>SKU <span class="req">*</span></span><input value="${esc(nextSku)}" readonly><span class="locked">${ic('lock')} System-numbered — not editable after first transaction</span></div>
              <div class="fld"><span>Category</span><select id="wCat">${CATS.map(c=>`<option ${c===S.cat?'selected':''}>${c}</option>`).join('')}</select></div>
              <div class="fld"><span>Base UoM</span><select id="wUom">${UOMS.map(u=>`<option ${u===S.uom?'selected':''}>${u}</option>`).join('')}</select></div>
            </div>
            <div class="fld" style="margin-top:12px"><span>Description</span><input id="wDesc" value="${esc(S.desc)}" placeholder="Optional — specs, notes"></div>
          </div></div>

          <div class="panel"><div class="panel-h">${ic('sliders')}<h3>Inventory settings</h3></div><div class="panel-body">
            <div class="fldrow c3">
              <div class="fld"><span>Costing method</span><select id="wCosting">${['Weighted Average','FIFO','Standard'].map(c=>`<option ${c===S.costing?'selected':''}>${c}</option>`).join('')}</select></div>
              <div class="fld"><span>Reorder point</span><input type="number" id="wReorder" min="0" value="${S.reorder}" class="tnum"></div>
              <div class="fld"><span>Reorder qty</span><input type="number" id="wRoq" min="0" value="${S.roq}" class="tnum"></div>
              <div class="fld"><span>Tracking</span><select id="wTrack">${['None','Batch','Serial'].map(t=>`<option ${t===S.tracking?'selected':''}>${t}</option>`).join('')}</select></div>
              <div class="fld"><span>Shelf life (days)</span><input type="number" id="wShelf" min="0" value="${S.shelfLife}" placeholder="—"></div>
              <div class="fld"><span>Negative stock</span><select id="wNeg">${['Block','Allow'].map(n=>`<option ${n===S.negStock?'selected':''}>${n}${n==='Block'?' (default)':''}</option>`).join('')}</select></div>
            </div>
          </div></div>

          <div class="panel"><div class="panel-h">${ic('book')}<h3>Accounting</h3></div><div class="panel-body">
            <div class="fldrow c3">
              <div class="fld"><span>Inventory account</span><input value="${esc(S.invAcct)}" readonly></div>
              <div class="fld"><span>COGS account</span><input value="${esc(S.cogsAcct)}" readonly></div>
              <div class="fld"><span>Tax code</span><select id="wTax">${['SR · 6% GST','ZR · 0%'].map(t=>`<option ${t===S.tax?'selected':''}>${t}</option>`).join('')}</select></div>
            </div>
          </div></div>

          <div class="panel"><div class="panel-h">${ic('box')}<h3>Opening balance <span style="font-weight:400;color:var(--muted);font-size:12px">· optional</span></h3></div><div class="panel-body">
            <div class="fldrow c3">
              <div class="fld"><span>Opening quantity</span><input type="number" id="wOpenQty" min="0" value="${S.openQty}" class="tnum"></div>
              <div class="fld"><span>Unit cost (USD)</span><input type="number" id="wOpenCost" min="0" step="0.01" value="${S.openCost}" class="tnum"></div>
              <div class="fld"><span>Into warehouse</span><select id="wOpenWh">${WH.map(w=>`<option ${w===S.openWh?'selected':''}>${w}</option>`).join('')}</select></div>
            </div>
          </div></div>
        </div>
        <aside class="summary" id="wSide">${sidebar()}</aside></div>
        <div style="height:8px"></div>
      </div></div>
      <div class="set-savebar" id="wBar">${bar()}</div>
    </section></div>`;
    wire(); wireBar();
  }
  function wire(){
    const t=(id,key,ev='input',num)=>{ const el=$('#'+id); el&&el.addEventListener(ev,()=>{ S[key]=num?Math.max(0,+el.value||0):el.value; refreshSide(); if(key==='name')refreshBar(); }); };
    t('wName','name'); t('wDesc','desc','input');
    t('wCat','cat','change'); t('wUom','uom','change');
    t('wCosting','costing','change'); t('wReorder','reorder','input',true); t('wRoq','roq','input',true);
    t('wTrack','tracking','change'); t('wShelf','shelfLife','input'); t('wNeg','negStock','change');
    t('wTax','tax','change');
    t('wOpenQty','openQty','input',true); t('wOpenCost','openCost','input',true); t('wOpenWh','openWh','change');
  }
  function wireBar(){
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('stock-on-hand'));
    const create=$('#wCreate'); create&&create.addEventListener('click',()=>{
      if(!S.name.trim())return;
      const val=S.openQty*S.openCost;
      const sku=(function(){ let max=7789; DB.items.forEach(x=>{ const m=/(\d+)\s*$/.exec(x.sku); if(m&&+m[1]>max)max=+m[1]; }); return 'NW-'+(max+1); })();
      const status = S.openQty<=0 ? 'No stock' : S.openQty<=S.reorder ? 'Low' : 'In stock';
      DB.items.unshift({ sku, name:S.name.trim(), cat:S.cat, uom:S.uom, onHand:S.openQty, alloc:0, reorder:S.reorder, roq:S.roq, cost:S.openCost, status, bins:S.openQty>0?[[S.openWh,S.openQty]]:[] });
      navigate('item-master');
      const ob=val>0?` · opening ${num(S.openQty)} ${S.uom} (${money0(val)})`:'';
      setTimeout(()=>toast(`Item ${sku} “${S.name}” created${ob}`,'ok'),180);
    });
  }
  render();
};
