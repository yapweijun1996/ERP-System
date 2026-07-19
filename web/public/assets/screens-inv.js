/* ============================================================
   ARIA ERP — screens: Inventory (stock, item master, ledger, valuation)
   ============================================================ */

/* ---- module map + standard Inventory page shell ---- */
const INVENTORY_SECTIONS = [
  { route:'stock-on-hand', labelKey:'inv.nav.stock', icon:'box' },
  { route:'item-master', labelKey:'inv.nav.items', icon:'tag' },
  { route:'stock-movement', labelKey:'inv.nav.movements', icon:'history' },
  { route:'inv-valuation', labelKey:'inv.nav.valuation', icon:'chart' },
];
const INVENTORY_ALIAS = { 'new-item':'item-master', 'new-stock-adjustment':'stock-movement' };

function inventoryNav(active){
  active = INVENTORY_ALIAS[active] || active;
  return `<div class="sales-subnav inventory-subnav" role="tablist" aria-label="${esc(t('nav.inventory'))}">
    ${INVENTORY_SECTIONS.map(it=>`<button class="ssub ${it.route===active?'on':''}" role="tab" aria-selected="${it.route===active}" onclick="navigate('${it.route}')">${ic(it.icon)}<span>${esc(t(it.labelKey))}</span></button>`).join('')}
  </div>`;
}

function inventoryPageHead(o){
  const crumb=o.crumb||[DB.company.name,{label:t('nav.inventory'),route:'stock-on-hand'},{cur:o.title}];
  const kpi=o.kpiLabel?`<div class="headright"><div class="kfig"><small>${esc(o.kpiLabel)}</small><b class="tnum ${o.kpiClass||''}">${o.kpiValue}</b></div></div>`:'';
  return `<div class="pagehead inventory-pagehead">
    ${crumbs(crumb)}
    ${inventoryNav(o.active)}
    <div class="h1row"><h1>${esc(o.title)}</h1>${o.count!=null?`<span class="countchip">${esc(String(o.count))}</span>`:''}${kpi}</div>
    ${o.sub?`<div class="h1sub">${esc(o.sub)}</div>`:''}
  </div>`;
}

function wireInventoryNav(scope){
  requestAnimationFrame(()=>{
    const nav=scope.querySelector('.inventory-subnav');
    const active=nav&&nav.querySelector('[aria-selected="true"]');
    if(active) active.scrollIntoView({block:'nearest',inline:'nearest'});
  });
}

/* Canonical inventory read model. Both adapters expose the same paginated
   resource contract, so these screens no longer depend on the demo adapter's
   monolithic DB.* payload. Joins stay presentational: stock rules and writes
   remain in the shared TypeScript domain commands/server transactions. */
async function inventoryListPage(resource){
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.list!=='function'){
    throw new Error('The canonical ERP data adapter is unavailable.');
  }
  const response=await adapter.list(resource,{limit:100});
  if(!response||!Array.isArray(response.data)){
    throw new Error(`Unexpected ${resource} response.`);
  }
  return {
    data:response.data,
    nextCursor:response.meta&&response.meta.nextCursor||null,
  };
}

function inventoryNumber(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

function inventoryMovementType(row){
  if(row.refType==='stock_transfer') return row.direction==='in'?'Transfer In':'Transfer Out';
  if(row.refType==='inventory_adjustment') return 'Adjustment';
  if(row.direction==='in') return row.refType==='purchase_order'?'Goods Receipt':'Stock Receipt';
  return row.refType==='sales_order'?'Goods Issue':'Stock Issue';
}

function inventoryReference(row){
  if(!row.refType) return 'Manual';
  const label=String(row.refType).replaceAll('_',' ');
  return row.refId==null?label:`${label} #${row.refId}`;
}

async function prepareCanonicalInventoryData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(Array.isArray(DB.items)&&Array.isArray(DB.movements)&&Array.isArray(DB.valuation)) return;
    throw new Error('The offline canonical inventory snapshot is unavailable.');
  }
  const pages=await Promise.all([
    inventoryListPage('inventory/products'),
    inventoryListPage('inventory/warehouses'),
    inventoryListPage('inventory/stock-levels'),
    inventoryListPage('inventory/stock-movements'),
    inventoryListPage('inventory/bins'),
    inventoryListPage('inventory/location-balances'),
  ]);
  const [products,warehouses,levels,movements,bins,locationBalances]=pages.map(page=>page.data);
  const warehouseById=new Map(warehouses.map(row=>[row.id,row]));
  const binById=new Map(bins.map(row=>[row.id,row]));
  const onHandByProduct=new Map();
  levels.forEach(row=>{
    onHandByProduct.set(
      row.productId,
      (onHandByProduct.get(row.productId)||0)+inventoryNumber(row.qty),
    );
  });
  const binsByProduct=new Map();
  locationBalances.forEach(row=>{
    const bin=binById.get(row.binId);
    const warehouse=warehouseById.get(row.warehouseId);
    const tracking=row.trackingKey&&row.trackingKey!=='none'?` · ${row.trackingKey}`:'';
    const label=`${warehouse?warehouse.code:'Warehouse'} / ${bin?bin.code:'Bin'}${tracking}`;
    const rows=binsByProduct.get(row.productId)||[];
    rows.push([label,inventoryNumber(row.qty)]);
    binsByProduct.set(row.productId,rows);
  });

  DB.inventoryWarehouses=warehouses.map(row=>({
    id:row.id,code:row.code,name:row.name,
  }));
  DB.items=products.map(row=>{
    const onHand=onHandByProduct.get(row.id)||0;
    return {
      id:row.id,
      sku:row.sku,
      name:row.name,
      cat:row.category||'Components',
      uom:row.uom,
      onHand,
      alloc:0,
      reorder:inventoryNumber(row.reorderPoint),
      roq:inventoryNumber(row.reorderQty),
      cost:inventoryNumber(row.standardCost),
      version:row.version,
      trackingType:row.trackingType||'none',
      status:onHand>0?'In stock':'No stock',
      bins:binsByProduct.get(row.id)||[],
    };
  });

  const productById=new Map(DB.items.map(row=>[row.id,row]));
  const signedTotals=new Map();
  movements.forEach(row=>{
    const signed=(row.direction==='out'?-1:1)*inventoryNumber(row.qty);
    signedTotals.set(row.productId,(signedTotals.get(row.productId)||0)+signed);
  });
  const running=new Map();
  DB.items.forEach(row=>{
    running.set(row.id,row.onHand-(signedTotals.get(row.id)||0));
  });
  DB.movements=movements.slice().sort((a,b)=>a.id-b.id).map(row=>{
    const item=productById.get(row.productId)||{
      sku:`Product #${row.productId}`,name:'Unknown product',
    };
    const signed=(row.direction==='out'?-1:1)*inventoryNumber(row.qty);
    const balance=(running.get(row.productId)||0)+signed;
    running.set(row.productId,balance);
    const location=warehouseById.get(row.warehouseId);
    return {
      no:`SM-${row.id}`,
      date:String(row.movedAt||row.createdAt||'').slice(0,16).replace('T',' '),
      item:item.sku,
      name:item.name,
      type:inventoryMovementType(row),
      ref:inventoryReference(row),
      qty:signed,
      bal:balance,
      by:'System',
      wh:location?location.code:`Warehouse #${row.warehouseId}`,
      productId:row.productId,
      binId:row.binId,
      lotId:row.lotId,
      serialId:row.serialId,
    };
  });
  DB.valuation=DB.items.length?[{
    cat:'Unclassified',
    items:DB.items.map(row=>({
      sku:row.sku,name:row.name,qty:row.onHand,cost:row.cost,
    })),
  }]:[];
  DB.erpSystem=Object.assign({},DB.erpSystem||{},{
    products,
    warehouses,
    stockLevels:levels,
    stockMovements:movements,
    bins,
    locationBalances,
  });
  DB.inventoryReadMeta={
    truncated:pages.some(page=>Boolean(page.nextCursor)),
    nextCursors:pages.map(page=>page.nextCursor),
  };
}

/* ---------------- STOCK ON HAND (master + detail) ---------------- */
SCREENS['stock-on-hand'] = async function(root){
  await prepareCanonicalInventoryData();
  let filter='all', selectedSku=null;
  const totVal=DB.items.reduce((s,it)=>s+it.onHand*it.cost,0);
  const chips=[['all',t('common.all')],['reorder',ts('Reorder')],['low',ts('Low')],['backorder',ts('Backordered')],['instock',ts('In stock')]];
  function rows(){
    return DB.items.filter(it=>{
      if(filter==='all')return true;
      if(filter==='reorder')return it.status==='Reorder';
      if(filter==='low')return it.status==='Low';
      if(filter==='backorder')return it.status==='Backordered';
      if(filter==='instock')return it.status==='In stock';
      return true;
    });
  }
  function table(){
    return buildTable({
      checkable:true, rowId:it=>it.sku,
      columns:[
        {label:t('inv.col.item'),sticky:true,render:it=>`<div class="cellsub"><b>${esc(it.name)}</b><small>${esc(it.sku)} · ${esc(it.cat)}</small></div>`},
        {label:t('inv.col.onhand'),align:'r',sortable:true,render:it=>`<span class="tnum">${num(it.onHand)}</span>`},
        {label:t('inv.col.alloc'),align:'r',render:it=>`<span class="tnum" style="color:var(--muted)">${num(it.alloc)}</span>`},
        {label:'Available',align:'r',sortable:true,render:it=>{const a=it.onHand-it.alloc;return `<b class="tnum" style="color:${a<=0?'var(--danger)':a<it.reorder?'var(--warn)':'var(--accent)'}">${num(a)}</b>`;}},
        {label:t('inv.col.reorder'),align:'r',render:it=>`<span class="tnum" style="color:var(--muted)">${num(it.reorder)}</span>`},
        {label:t('inv.col.unitcost'),align:'r',render:it=>`<span class="tnum">${money(it.cost)}</span>`},
        {label:t('inv.col.value'),align:'r',sortable:true,render:it=>`<b class="tnum">${money0(it.onHand*it.cost)}</b>`},
        {label:t('col.status'),align:'l',render:it=>statusBadge(it.status)},
      ],
      rows:rows(),
    });
  }
  root.innerHTML=`<div class="content inventory-content" id="invContent">
    ${inventoryPageHead({
      active:'stock-on-hand',
      title:t('inv.title'),
      count:rows().length+(DB.inventoryReadMeta&&DB.inventoryReadMeta.truncated?'+ ':' ')+t('common.items'),
      kpiLabel:t('inv.kpi.value'),
      kpiValue:money0(totVal),
    })}
    <section class="master">
      <div class="toolbar">
        <div class="filterchips" id="invChips">${chips.map(c=>`<button class="chip ${c[0]==='all'?'on':''}" data-f="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
        <div class="grow"></div>
        ${btn(t('common.columns'),{icon:'columns',cls:'soft'})}${btn(t('common.export'),{icon:'download',cls:'soft'})}
        ${btn(t('inv.newitem'),{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-item\')"'})}
        <div class="seg" id="densSeg"><button data-d="comfortable" class="on">${ic('rows')}${esc(t('common.comfortable'))}</button><button data-d="compact">${ic('rows-sm')}${esc(t('common.compact'))}</button></div>
      </div>
      <div class="tablewrap" id="invTable">${table()}</div>
      <div id="invBulk"></div>
    </section>
    <aside class="detail" id="invDetail"><div class="detail-empty">${ic('box')}<div>${esc(t('inv.empty'))}</div></div></aside>
  </div>`;
  wireInventoryNav(root);
  const content=$('#invContent');
  function showDetail(sku){
    selectedSku=sku; const it=DB.items.find(x=>x.sku===sku); if(!it)return;
    const avail=it.onHand-it.alloc;
    const itemMovements=DB.movements.filter(row=>row.item===it.sku);
    const related=itemMovements.slice(-5).reverse().map(row=>({
      no:row.no,
      label:row.type,
      meta:`${row.ref} · ${row.wh} · ${row.qty>0?'+':''}${num(row.qty)} ${it.uom}`,
      status:'Posted',
    }));
    content.classList.remove('detail-collapsed');
    $('#invDetail').classList.add('open');
    $('#invDetail').innerHTML=`
      <div class="detail-head">
        <span class="grabber"></span>
        <button class="close" onclick="document.getElementById('invContent').classList.add('detail-collapsed');document.getElementById('invDetail').classList.remove('open')">${ic('chevL')}${esc(t('common.close'))}</button>
        <div class="dh-top"><div><h2>${esc(it.name)}</h2><span class="sub">${esc(it.sku)} · ${esc(it.cat)} · ${esc(t('inv.peruom'))} ${esc(it.uom)}</span></div><div style="margin-left:auto">${statusBadge(it.status)}</div></div>
        <div class="dh-actions">${btn(t('inv.reorder'),{icon:'reorder',cls:'soft',attrs:'disabled title="Replenishment workflow is not implemented yet."'})}${btn(t('inv.receive'),{icon:'receive',cls:'soft',attrs:'disabled title="Use a canonical purchase receipt to receive stock."'})}${btn(t('inv.adjust'),{icon:'adjust',cls:'primary',attrs:'onclick="navigate(\'new-stock-adjustment\')"'})}</div>
        <div class="tabs" id="invTabs"><button class="tab on" data-t="overview">${esc(t('inv.tab.overview'))}</button><button class="tab" data-t="locations">${esc(t('inv.tab.locations'))}<span class="tc">${it.bins.length}</span></button><button class="tab" data-t="history">${esc(t('inv.tab.history'))}</button></div>
      </div>
      <div class="detail-body" id="invTabBody"></div>`;
    const body=$('#invTabBody');
    function tab(tabName){
      $$('#invTabs .tab').forEach(x=>x.classList.toggle('on',x.dataset.t===tabName));
      if(tabName==='overview'){
        body.innerHTML=`
          <div class="statgrid"><div class="stat"><small>${esc(t('inv.col.onhand'))}</small><b class="tnum">${num(it.onHand)}</b></div><div class="stat"><small>${esc(t('inv.col.alloc'))}</small><b class="tnum">${num(it.alloc)}</b></div><div class="stat accentval"><small>${esc(t('inv.col.avail'))}</small><b class="tnum">${num(avail)}</b></div><div class="stat"><small>${esc(t('inv.reorderpoint'))}</small><b class="tnum">${num(it.reorder)}</b></div></div>
          ${avail<=it.reorder?`<div class="indicator ${avail<=0?'danger':'warn'}"><div class="ind-top">${ic('warn')}<span>${avail<=0?esc(t('inv.belowzero')):esc(t('inv.atreorder'))}</span><span class="ind-r">${num(avail)} / ${num(it.reorder)}</span></div><div class="track"><i style="width:${Math.max(4,Math.min(100,avail/it.reorder*100))}%"></i></div><small>${esc(t('inv.suggested').replaceAll('{n}',num(it.roq)).replaceAll('{uom}',it.uom))}</small></div>`:''}
          <div class="card" style="margin-top:14px">
            <div class="field"><span class="k">${esc(t('inv.kpi.value'))}</span><span class="v tnum">${money(it.onHand*it.cost)}<span class="vs">${num(it.onHand)} × ${money(it.cost)}</span></span></div>
            <div class="field"><span class="k">${esc(t('inv.unitcostavg'))}</span><span class="v tnum">${money(it.cost)}</span></div>
            <div class="field"><span class="k">${esc(t('inv.reorderqty'))}</span><span class="v tnum">${num(it.roq)}</span></div>
            <div class="field"><span class="k">${esc(t('inv.category'))}</span><span class="v">${esc(it.cat)}</span></div>
            ${it.expiry?`<div class="field"><span class="k">${esc(t('inv.expiry'))}</span><span class="v" style="color:var(--warn)">${esc(it.expiry)}</span></div>`:''}
          </div>
          <div class="sectitle">${esc(t('inv.commitments'))}</div>
          ${related.length?relatedDocs(related):`<div class="card" style="color:var(--muted);font-size:13px">${esc(ts('No activity yet.'))}</div>`}`;
      } else if(tabName==='locations'){
        const sum=it.bins.reduce((s,b)=>s+b[1],0);
        body.innerHTML=`<div class="card">${it.bins.length?it.bins.map(b=>`<div class="field"><span class="k mono">${esc(b[0])}</span><span class="v tnum">${num(b[1])} ${esc(it.uom)}</span></div>`).join(''):`<div style="color:var(--muted);font-size:13px">${esc(t('inv.nobins'))}</div>`}
          ${it.bins.length?`<div class="field" style="border-top:2px solid var(--border);margin-top:4px"><span class="k"><b>${esc(t('inv.totalbins'))}</b></span><span class="v tnum"><b>${num(sum)} ${esc(it.uom)}</b> ${sum===it.onHand?cap(t('inv.reconciled'),'ok'):cap(t('inv.mismatch'),'warn')}</span></div>`:''}</div>
          <div style="margin-top:12px">${btn(t('inv.movebins'),{icon:'transfer',cls:'soft'})} ${btn(t('inv.cyclecount'),{icon:'count',cls:'soft',attrs:'onclick="toast(\'Cycle count task created\',\'ok\')"'})}</div>`;
      } else {
        const events=itemMovements.slice().reverse().map(row=>({
          kind:row.qty<0?'sub':'add',
          when:row.date||'—',
          what:esc(`${row.type} ${row.qty>0?'+':''}${num(row.qty)} · ${row.ref}`),
          who:`${row.by} · ${row.wh} · bal ${num(row.bal)}`,
        }));
        body.innerHTML=events.length
          ?auditTrail(events)
          :`<div class="card" style="color:var(--muted);font-size:13px">${esc(ts('No activity yet.'))}</div>`;
      }
    }
    $$('#invTabs .tab').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.t)));
    tab('overview');
  }
  function rewire(){
    wireTable($('#invTable'),{ onRow:showDetail, onSelectionChange:(n)=>{ $('#invBulk').innerHTML=n?`<div class="bulkbar"><b>${n} ${esc(t('common.selected'))}</b><div class="grow"></div>${btn(t('inv.reorder'),{icon:'reorder',cls:'soft',attrs:'disabled title="Replenishment workflow is not implemented yet."'})}${btn(t('inv.adjust'),{icon:'adjust',cls:'soft',attrs:'onclick="navigate(\'new-stock-adjustment\')"'})}${btn(t('common.export'),{icon:'download',cls:'soft'})}</div>`:''; } });
  }
  rewire();
  $('#invChips').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ $('#invChips .chip.on').classList.remove('on');c.classList.add('on');filter=c.dataset.f; $('#invTable').innerHTML=table(); const cc=root.querySelector('.inventory-pagehead .countchip'); if(cc)cc.textContent=rows().length+' '+t('common.items'); $('#invBulk').innerHTML=''; rewire(); }));
  $('#densSeg').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ $('#densSeg button.on').classList.remove('on');b.classList.add('on'); $('#invContent').setAttribute('data-density',b.dataset.d); }));
  // preselect first reorder item for a populated look
  setTimeout(()=>{ const tr=$('#invTable .dt-body .dt-r'); if(tr){tr.classList.add('sel');showDetail(tr.dataset.row);} },30);
};

/* ---------------- ITEM MASTER (master data) ---------------- */
SCREENS['item-master'] = async function(root){
  await prepareCanonicalInventoryData();
  const CATS=['Components','Raw Materials','Finished Goods','Consumables','Packaging'];
  const UOMS=['ea','kg','m','sheet','L','box','pair','set'];
  let selSku = DB.items[0] ? DB.items[0].sku : null;

  function statusOf(it){
    if(it.onHand<=0) return it.alloc>0 ? 'Backordered' : 'No stock';
    if(it.onHand<=it.reorder) return 'Low';
    if((it.onHand-it.alloc)<=it.reorder) return 'Reorder';
    return 'In stock';
  }

  function listTable(){
    return buildTable({
      rowId:it=>it.sku,
      columns:[
        {label:'Item',sticky:true,render:it=>`<div class="cellsub"><b>${esc(it.name)}</b><small>${esc(it.sku)}</small></div>`},
        {label:'Category',align:'l',render:it=>esc(it.cat)},
        {label:'UoM',align:'l',render:it=>esc(it.uom)},
        {label:'Reorder pt',align:'r',render:it=>`<span class="tnum" style="color:var(--muted)">${num(it.reorder)}</span>`},
        {label:'Unit cost',align:'r',sortable:true,render:it=>`<span class="tnum">${money(it.cost)}</span>`},
        {label:'On hand',align:'r',sortable:true,render:it=>`<span class="tnum">${num(it.onHand)}</span>`},
        {label:'Status',align:'l',render:it=>statusBadge(it.status)},
      ],
      rows:DB.items,
    });
  }

  function detail(){
    const it=DB.items.find(x=>x.sku===selSku);
    if(!it) return `<div class="detail-empty">${ic('tag')}<div>Select an item to view, edit or delete its master record.</div></div>`;
    const avail=it.onHand-it.alloc;
    return `
      <div class="detail-head">
        <span class="grabber"></span>
        <button class="close" data-close="1">${ic('chevL')}Close</button>
        <div class="dh-top"><div><h2>${esc(it.name)}</h2><span class="sub">${esc(it.sku)} · ${esc(it.cat)} · per ${esc(it.uom)}</span></div><div style="margin-left:auto">${statusBadge(it.status)}</div></div>
        <div class="dh-actions">${btn('Edit',{icon:'edit',cls:'primary',attrs:'data-edit="1"'})}${btn('New transaction',{icon:'transfer',cls:'soft',attrs:'onclick="navigate(\'stock-movement\')"'})}${btn('Delete',{icon:'trash',cls:'soft',attrs:'data-del="1"'})}</div>
      </div>
      <div class="detail-body">
        <div class="statgrid"><div class="stat"><small>On hand</small><b class="tnum">${num(it.onHand)}</b></div><div class="stat"><small>Allocated</small><b class="tnum">${num(it.alloc)}</b></div><div class="stat accentval"><small>Available</small><b class="tnum">${num(avail)}</b></div><div class="stat"><small>Value</small><b class="tnum">${money0(it.onHand*it.cost)}</b></div></div>
        <div class="sectitle">Master data</div>
        <div class="card">
          <div class="field"><span class="k">SKU</span><span class="v mono">${esc(it.sku)}</span></div>
          <div class="field"><span class="k">Name</span><span class="v">${esc(it.name)}</span></div>
          <div class="field"><span class="k">Category</span><span class="v">${esc(it.cat)}</span></div>
          <div class="field"><span class="k">Base UoM</span><span class="v">${esc(it.uom)}</span></div>
          <div class="field"><span class="k">Reorder point</span><span class="v tnum">${num(it.reorder)}</span></div>
          <div class="field"><span class="k">Reorder qty</span><span class="v tnum">${num(it.roq)}</span></div>
          <div class="field"><span class="k">Unit cost</span><span class="v tnum">${money(it.cost)}</span></div>
          ${it.expiry?`<div class="field"><span class="k">Expiry</span><span class="v" style="color:var(--warn)">${esc(it.expiry)}</span></div>`:''}
        </div>
        <div class="sectitle">Bin locations</div>
        <div class="card">${it.bins&&it.bins.length?it.bins.map(b=>`<div class="field"><span class="k mono">${esc(b[0])}</span><span class="v tnum">${num(b[1])} ${esc(it.uom)}</span></div>`).join(''):`<div style="color:var(--muted);font-size:13px">No bin allocations.</div>`}</div>
      </div>`;
  }

  function nextSku(){ let max=7789; DB.items.forEach(x=>{ const m=/(\d+)\s*$/.exec(x.sku); if(m&&+m[1]>max)max=+m[1]; }); return 'NW-'+(max+1); }

  function itemForm(it){
    const edit=!!it;
    const sku=edit?it.sku:nextSku();
    openModal(`<div class="modal-head">${ic(edit?'edit':'plus')}<h3>${edit?'Edit item':'New item'}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="set-grid">
        <div class="fld"><span>Item name <span class="req">*</span></span><input id="ifName" value="${edit?esc(it.name):''}" placeholder="e.g. Hydraulic Hose 12mm"></div>
        <div class="fld"><span>SKU</span><input value="${esc(sku)}" readonly><span class="locked">${ic('lock')} System-numbered</span></div>
        <div class="fld"><span>Category</span><select id="ifCat">${CATS.map(c=>`<option ${edit&&it.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="fld"><span>Base UoM</span><select id="ifUom">${UOMS.map(u=>`<option ${edit&&it.uom===u?'selected':''}>${u}</option>`).join('')}</select></div>
        <div class="fld"><span>Reorder point</span><input id="ifReorder" type="number" min="0" class="tnum" value="${edit?it.reorder:50}"></div>
        <div class="fld"><span>Reorder qty</span><input id="ifRoq" type="number" min="0" class="tnum" value="${edit?it.roq:150}"></div>
        <div class="fld"><span>Unit cost (USD)</span><input id="ifCost" type="number" min="0" step="0.01" class="tnum" value="${edit?it.cost:0}"></div>
        ${edit?'':`<div class="fld"><span>Opening qty</span><input value="0" readonly><span class="locked">${ic('lock')} Use Stock Adjustment to receive stock</span></div>`}
      </div></div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(edit?'Save changes':'Create item',{icon:edit?'save':'plus',cls:'primary',attrs:'data-save="1"'})}</div>`);
    const saveBtn=$('#modalEl').querySelector('[data-save]');
    saveBtn.addEventListener('click',async()=>{
      const name=$('#ifName').value.trim();
      if(!name){ toast('Item name is required','danger'); $('#ifName').focus(); return; }
      const d={ name, category:$('#ifCat').value, uom:$('#ifUom').value,
        reorderPoint:Math.max(0,+$('#ifReorder').value||0), reorderQty:Math.max(0,+$('#ifRoq').value||0),
        standardCost:Math.max(0,+$('#ifCost').value||0) };
      saveBtn.disabled=true;
      try{
        if(edit){
          await window.ErpSystemData.action('inventory/products', it.id, 'update', d);
          toast(`Item ${it.sku} updated`,'ok');
        }else{
          await window.ErpSystemData.create('inventory/products', Object.assign({sku},d));
          toast(`Item ${sku} “${name}” created`,'ok');
        }
        closeModal();
        await prepareCanonicalInventoryData();
        selSku=sku;
        render();
      }catch(error){
        saveBtn.disabled=false;
        toast(error&&error.message?error.message:'Item could not be saved','danger');
      }
    });
  }

  function confirmDelete(it){
    openModal(`<div class="modal-head">${ic('trash')}<h3>Delete ${esc(it.name)}?</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body"><div class="risk danger">${ic('warn')}<div><b>Deleting items isn’t supported yet</b><small>${esc(it.sku)} has real stock/movement history behind it — item deletion isn’t implemented. Archive or stop reordering it instead.</small></div></div></div>
      <div class="modal-foot">${btn('Close',{cls:'primary',attrs:'onclick="closeModal()"'})}</div>`);
  }

  function render(){
    const totVal=DB.items.reduce((s,it)=>s+it.onHand*it.cost,0);
    root.innerHTML=`<div class="content inventory-content" id="imContent">
      ${inventoryPageHead({
        active:'item-master',
        title:t('inv.nav.items'),
        count:DB.items.length+' items',
        kpiLabel:t('inv.kpi.value'),
        kpiValue:money0(totVal),
        sub:'Master data for every stocked item. Select a row to view, edit or delete — or add a new item.',
      })}
      <section class="master">
        <div class="toolbar"><div class="grow"></div>${btn('Export',{icon:'download',cls:'soft'})}${btn('New item',{icon:'plus',cls:'primary',attrs:'data-new="1"'})}</div>
        <div class="tablewrap" id="imTable">${listTable()}</div>
      </section>
      <aside class="detail ${selSku?'open':''}" id="imDetail">${detail()}</aside>
    </div>`;
    wireInventoryNav(root);
    wire();
  }

  function wire(){
    wireTable($('#imTable'),{ onRow:(sku)=>{ selSku=sku; const c=$('#imContent'); if(c)c.classList.remove('detail-collapsed'); render(); } });
    $('#imTable').querySelectorAll('.dt-r[data-row]').forEach(tr=>tr.classList.toggle('sel',tr.dataset.row===selSku));
    const nb=root.querySelector('[data-new]'); nb&&nb.addEventListener('click',()=>itemForm(null));
    const d=root.querySelector('#imDetail'); if(!d) return;
    const cl=d.querySelector('[data-close]'); cl&&cl.addEventListener('click',()=>{ $('#imContent').classList.add('detail-collapsed'); d.classList.remove('open'); selSku=null; });
    const ed=d.querySelector('[data-edit]'); ed&&ed.addEventListener('click',()=>{ const it=DB.items.find(x=>x.sku===selSku); if(it)itemForm(it); });
    const de=d.querySelector('[data-del]'); de&&de.addEventListener('click',()=>{ const it=DB.items.find(x=>x.sku===selSku); if(it)confirmDelete(it); });
  }

  render();
};

/* ---------------- STOCK MOVEMENT LEDGER ---------------- */
SCREENS['stock-movement'] = async function(root){
  await prepareCanonicalInventoryData();
  function tone(t){ return t.startsWith('Goods Receipt')||t.includes('Receipt')||t==='Transfer In'?'ok':t.includes('Issue')||t==='Transfer Out'||t==='Adjustment'?'danger':'accent'; }
  const netChange=DB.movements.reduce((s,m)=>s+m.qty,0);
  const mvDates=DB.movements.map(m=>m.date.slice(0,10)).sort();
  const fmtD=d=>{ const [y,mo,da]=d.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo-1]+' '+(+da); };
  const rangeLabel=mvDates.length?fmtD(mvDates[0])+' – '+fmtD(mvDates[mvDates.length-1]):'No movements';
  root.innerHTML=`<div class="content full"><section class="master">
    ${inventoryPageHead({
      active:'stock-movement',
      title:t('inv.nav.movements'),
      count:DB.movements.length+(DB.inventoryReadMeta&&DB.inventoryReadMeta.truncated?'+ entries':' entries'),
      kpiLabel:'Net change',
      kpiValue:(netChange>0?'+':'')+num(netChange),
      kpiClass:netChange>=0?'pos':'neg',
      sub:'Every posted in/out and adjustment — the shared truth behind on-hand balances. Drill any row to its source document.',
    })}
    <div class="toolbar">
      <div class="filterchips"><button class="chip on">All types</button><button class="chip">Receipts</button><button class="chip">Issues</button><button class="chip">Transfers</button><button class="chip">Adjustments</button></div>
      <div class="grow"></div>
      <button class="viewsel">${ic('calendar')}${rangeLabel}${ic('chevD')}</button>
      ${btn('Export',{icon:'download',cls:'soft'})}
      ${btn('New adjustment',{icon:'plus',cls:'primary',attrs:'onclick="navigate(\'new-stock-adjustment\')"'})}
    </div>
    <div class="tablewrap">${buildTable({
      rowId:m=>m.no,
      columns:[
        {label:'Movement',sticky:true,render:m=>`<div class="cellsub"><b class="docnum">${esc(m.no)}</b><small>${esc(m.date)}</small></div>`},
        {label:'Item',align:'l',render:m=>`<div class="cellsub"><b>${esc(m.name)}</b><small>${esc(m.item)}</small></div>`},
        {label:'Type',align:'l',render:m=>cap(m.type,tone(m.type))},
        {label:'Source doc',align:'l',render:m=>`<span class="docnum">${esc(m.ref)}</span>`},
        {label:'Warehouse',align:'l',render:m=>esc(m.wh)},
        {label:'Qty',align:'r',sortable:true,render:m=>`<b class="tnum delta ${m.qty>0?'pos':'neg'}">${m.qty>0?'+':''}${num(m.qty)}</b>`},
        {label:'Balance',align:'r',render:m=>`<span class="tnum">${num(m.bal)}</span>`},
        {label:'By',align:'l',render:m=>esc(m.by)},
      ],
      rows:DB.movements,
    })}</div>
  </section></div>`;
  wireInventoryNav(root);
  wireTable(root.querySelector('.tablewrap'),{onRow:(id)=>{ const m=DB.movements.find(x=>x.no===id); toast('Drill to source: '+m.ref,'info'); }});
};

/* ---------------- INVENTORY VALUATION REPORT ---------------- */
SCREENS['inv-valuation'] = async function(root){
  await prepareCanonicalInventoryData();
  const open=new Set();
  const asAt=new Date().toISOString().slice(0,10);
  function grand(){ return DB.valuation.reduce((s,g)=>s+g.items.reduce((a,it)=>a+it.qty*it.cost,0),0); }
  function table(){
    const gt=grand();
    if(!DB.valuation.length){
      return statePanel({
        icon:'box',
        title:'No inventory to value',
        body:'No canonical product or stock balance exists for this company.',
      });
    }
    const pct=value=>gt?(value/gt*100).toFixed(1):'0.0';
    const tpl='minmax(220px,2.4fr) 110px 90px 110px 140px 96px';
    let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
      <div class="dt-r dt-head"><div class="dt-c l">Category / Item</div><div class="dt-c c">SKU</div><div class="dt-c r">Qty</div><div class="dt-c r">Unit cost</div><div class="dt-c r">Value</div><div class="dt-c r">% of total</div></div>
      <div class="dt-body">`;
    DB.valuation.forEach((g,gi)=>{
      const gv=g.items.reduce((a,it)=>a+it.qty*it.cost,0);
      const isOpen=open.has(gi);
      h+=`<div class="dt-r drill ${isOpen?'open':''}" data-g="${gi}"><div class="dt-c l"><span class="twirl">${ic('chevR')}</span><b>${esc(g.cat)}</b></div><div class="dt-c c" style="color:var(--muted)">${g.items.length} items</div><div class="dt-c r"></div><div class="dt-c r"></div><div class="dt-c r"><b>${money(gv)}</b></div><div class="dt-c r tnum">${pct(gv)}%</div></div>`;
      if(isOpen) g.items.forEach(it=>{ const v=it.qty*it.cost;
        h+=`<div class="dt-r drillrow"><div class="dt-c l indent1">${esc(it.name)}</div><div class="dt-c c"><span class="docnum">${esc(it.sku)}</span></div><div class="dt-c r tnum">${num(it.qty)}</div><div class="dt-c r tnum">${money(it.cost)}</div><div class="dt-c r tnum">${money(v)}</div><div class="dt-c r tnum" style="color:var(--muted)">${pct(v)}%</div></div>`; });
    });
    h+=`<div class="dt-r grandtotal"><div class="dt-c l">Total inventory valuation</div><div class="dt-c"></div><div class="dt-c"></div><div class="dt-c"></div><div class="dt-c r tnum">${money(gt)}</div><div class="dt-c r tnum">100%</div></div>`;
    h+=`</div></div></div>`; return h;
  }
  root.innerHTML=`<div class="content full"><section class="master">
    ${inventoryPageHead({
      active:'inv-valuation',
      title:t('inv.nav.valuation'),
      sub:'Inventory value by category and item at standard cost.',
    })}
    <div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      <div class="fld"><span>As at date</span><input type="date" value="${asAt}"></div>
      <div class="fld"><span>Company</span><select><option>${esc(DB.company.name)}</option></select></div>
      <div class="fld"><span>Warehouse</span><select><option>All warehouses</option>${(DB.inventoryWarehouses||[]).map(row=>`<option>${esc(row.code)} · ${esc(row.name)}</option>`).join('')}</select></div>
      <div class="fld"><span>Costing basis</span><select><option>Standard cost</option></select></div>
      <div class="fld"><span>Group by</span><select><option>Category</option></select></div>
      <div class="fld"><span>Include zero qty</span><select><option>Yes</option><option>No</option></select></div>
      ${btn('Run report',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Report refreshed\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">${btn('Save template',{icon:'save',cls:'soft'})}</div>
    </aside>
      <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Inventory Valuation</b><div class="report-meta">As at ${esc(asAt)} · standard cost · all warehouses${DB.inventoryReadMeta&&DB.inventoryReadMeta.truncated?' · first 100 rows per resource':''}</div></div>
        <div class="grow"></div>
        ${btn('Expand all',{icon:'list',cls:'soft',attrs:'data-act="expand"'})}
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('PDF',{icon:'filepdf',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div class="tablewrap" id="valTable">${table()}</div>
    </div>
  </div></section></div>`;
  wireInventoryNav(root);
  function rewire(){
    root.querySelectorAll('.dt-r.drill').forEach(tr=>tr.addEventListener('click',()=>{ const g=+tr.dataset.g; open.has(g)?open.delete(g):open.add(g); $('#valTable').innerHTML=table(); rewire(); }));
    root.querySelectorAll('.dt-r.drillrow').forEach(tr=>tr.addEventListener('click',()=>toast('Drill: item balance → stock movements','info')));
  }
  rewire();
  root.querySelector('[data-act="expand"]').addEventListener('click',()=>{ if(open.size===DB.valuation.length){open.clear();}else{DB.valuation.forEach((_,i)=>open.add(i));} $('#valTable').innerHTML=table(); rewire(); });
};
