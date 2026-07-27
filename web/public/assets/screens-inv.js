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

/* Thin delegate to the generic moduleNav() (app.js) -- kept as a named function
   since inventoryPageHead() below calls inventoryNav(active) directly (TASK-045:
   INVENTORY_SECTIONS/INVENTORY_ALIAS stay here as the single real source,
   referenced by MODULE_DEFS.inventory in app.js). */
function inventoryNav(active){
  return moduleNav('inventory', active);
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
    listPage('inventory/products'),
    listPage('inventory/warehouses'),
    listPage('inventory/stock-levels'),
    listPage('inventory/stock-movements'),
    listPage('inventory/bins'),
    listPage('inventory/location-balances'),
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
      cost:inventoryNumber(row.averageCost==null?row.standardCost:row.averageCost),
      standardCost:inventoryNumber(row.standardCost),
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
      date:dateTimeValue(row.movedAt||row.createdAt),
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
  const totVal=DB.items.reduce((s,it)=>s+it.onHand*it.cost,0);
  const available=DB.items.reduce((sum,it)=>sum+it.onHand-it.alloc,0);
  const needsAttention=DB.items.filter(it=>['Reorder','Low','Backordered'].includes(it.status)).length;

  function detailContent(it){
    const itemMovements=DB.movements.filter(row=>row.item===it.sku);
    const related=itemMovements.slice(-5).reverse().map(row=>({
      no:row.no,
      label:row.type,
      meta:`${row.ref} · ${row.wh} · ${row.qty>0?'+':''}${num(row.qty)} ${it.uom}`,
      status:'Posted',
    }));
    return `
      <div class="detail-head">
        <span class="grabber"></span>
        <button class="close" data-master-detail-close>${ic('chevL')}${esc(t('common.close'))}</button>
        <div class="dh-top"><div><h2>${esc(it.name)}</h2><span class="sub">${esc(it.sku)} · ${esc(it.cat)} · ${esc(t('inv.peruom'))} ${esc(it.uom)}</span></div><div style="margin-left:auto">${statusBadge(it.status)}</div></div>
        <div class="dh-actions">${btn(t('inv.reorder'),{icon:'reorder',cls:'soft',attrs:'disabled title="Replenishment workflow is not implemented yet."'})}${btn(t('inv.receive'),{icon:'receive',cls:'soft',attrs:'disabled title="Use a canonical purchase receipt to receive stock."'})}${btn(t('inv.adjust'),{icon:'adjust',cls:'primary',attrs:'onclick="navigate(\'new-stock-adjustment\')"'})}</div>
        <div class="tabs" data-inventory-tabs><button class="tab on" data-t="overview">${esc(t('inv.tab.overview'))}</button><button class="tab" data-t="locations">${esc(t('inv.tab.locations'))}<span class="tc">${it.bins.length}</span></button><button class="tab" data-t="history">${esc(t('inv.tab.history'))}</button></div>
      </div>
      <div class="detail-body" data-inventory-tab-body>
        ${detailTab(it,'overview',itemMovements,related)}
      </div>`;
  }

  function detailTab(it,tabName,itemMovements,related){
    const avail=it.onHand-it.alloc;
    if(tabName==='overview'){
      return `
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
    }
    if(tabName==='locations'){
      const sum=it.bins.reduce((s,b)=>s+b[1],0);
      return `<div class="card">${it.bins.length?it.bins.map(b=>`<div class="field"><span class="k mono">${esc(b[0])}</span><span class="v tnum">${num(b[1])} ${esc(it.uom)}</span></div>`).join(''):`<div style="color:var(--muted);font-size:13px">${esc(t('inv.nobins'))}</div>`}
        ${it.bins.length?`<div class="field" style="border-top:2px solid var(--border);margin-top:4px"><span class="k"><b>${esc(t('inv.totalbins'))}</b></span><span class="v tnum"><b>${num(sum)} ${esc(it.uom)}</b> ${sum===it.onHand?cap(t('inv.reconciled'),'ok'):cap(t('inv.mismatch'),'warn')}</span></div>`:''}</div>
        <div style="margin-top:12px">${btn(t('inv.movebins'),{icon:'transfer',cls:'soft'})} ${btn(t('inv.cyclecount'),{icon:'count',cls:'soft',attrs:'onclick="toast(\'Cycle count task created\',\'ok\')"'})}</div>`;
    }
    const events=itemMovements.slice().reverse().map(row=>({
      kind:row.qty<0?'sub':'add',
      when:row.date||'—',
      what:esc(`${row.type} ${row.qty>0?'+':''}${num(row.qty)} · ${row.ref}`),
      who:`${row.by} · ${row.wh} · bal ${num(row.bal)}`,
    }));
    return events.length
      ?auditTrail(events)
      :`<div class="card" style="color:var(--muted);font-size:13px">${esc(ts('No activity yet.'))}</div>`;
  }

  masterDetailRegisterPage(root,{
    module:'inventory',
    route:'stock-on-hand',
    title:t('inv.title'),
    description:ts('Live quantities, availability, reorder points and inventory value by item.'),
    rows:()=>DB.items,
    rowId:it=>it.sku,
    count:rows=>rows.length+(DB.inventoryReadMeta&&DB.inventoryReadMeta.truncated?'+':''),
    filters:[['all',t('common.all')],['reorder',ts('Reorder')],['low',ts('Low')],['backorder',ts('Backordered')],['instock',ts('In stock')]],
    filterFn:(it,filter)=>filter==='reorder'
      ?it.status==='Reorder'
      :filter==='low'
        ?it.status==='Low'
        :filter==='backorder'
          ?it.status==='Backordered'
          :it.status==='In stock',
    kpis:[
      {label:t('inv.kpi.value'),value:money0(totVal)},
      {label:t('common.items'),value:DB.items.length},
      {label:t('inv.col.avail'),value:num(available)},
      {label:ts('Needs attention'),value:needsAttention,accent:needsAttention>0},
    ],
    primaryAction:{label:t('inv.newitem'),icon:'plus',onClick:()=>navigate('new-item')},
    note:DB.inventoryReadMeta&&DB.inventoryReadMeta.truncated?t('inventory.showingFirst100'):null,
    columns:[
      {label:t('inv.col.item'),sticky:true,render:it=>`<div class="cellsub"><b>${esc(it.name)}</b><small>${esc(it.sku)} · ${esc(it.cat)}</small></div>`},
      {label:t('inv.col.onhand'),align:'r',sortable:true,render:it=>`<span class="tnum">${num(it.onHand)}</span>`},
      {label:t('inv.col.alloc'),align:'r',render:it=>`<span class="tnum" style="color:var(--muted)">${num(it.alloc)}</span>`},
      {label:t('inv.col.avail'),align:'r',sortable:true,render:it=>{const qty=it.onHand-it.alloc;return `<b class="tnum" style="color:${qty<=0?'var(--danger)':qty<it.reorder?'var(--warn)':'var(--accent)'}">${num(qty)}</b>`;}},
      {label:t('inv.col.reorder'),align:'r',render:it=>`<span class="tnum" style="color:var(--muted)">${num(it.reorder)}</span>`},
      {label:t('inv.col.unitcost'),align:'r',render:it=>`<span class="tnum">${money(it.cost)}</span>`},
      {label:t('inv.col.value'),align:'r',sortable:true,render:it=>`<b class="tnum">${money0(it.onHand*it.cost)}</b>`},
      {label:t('col.status'),align:'l',render:it=>statusBadge(it.status)},
    ],
    empty:{icon:'box',title:t('inv.empty')},
    detailPane:{
      rowLabel:it=>`${t('common.open')} ${it.sku}`,
      initialSelectedId:DB.items[0]&&DB.items[0].sku,
      empty:`<div class="detail-empty">${ic('box')}<div>${esc(t('inv.empty'))}</div></div>`,
      content:detailContent,
      afterRender:({detailRoot,row})=>{
        if(!detailRoot||!row) return;
        const movements=DB.movements.filter(entry=>entry.item===row.sku);
        const related=movements.slice(-5).reverse().map(entry=>({
          no:entry.no,label:entry.type,
          meta:`${entry.ref} · ${entry.wh} · ${entry.qty>0?'+':''}${num(entry.qty)} ${row.uom}`,
          status:'Posted',
        }));
        const tabs=detailRoot.querySelectorAll('[data-inventory-tabs] .tab');
        const body=detailRoot.querySelector('[data-inventory-tab-body]');
        tabs.forEach(button=>button.addEventListener('click',()=>{
          tabs.forEach(candidate=>candidate.classList.toggle('on',candidate===button));
          body.innerHTML=detailTab(row,button.dataset.t,movements,related);
        }));
      },
    },
  });
};

/* ---------------- ITEM MASTER (master data) ---------------- */
function itemMasterCopy(){

  const packs={
    en:{
      colItem:'Item',colUom:'UoM',colReorderPt:'Reorder pt',colUnitCost:'Unit cost',colStatus:'Status',
      selectItem:'Select an item to view, edit or delete its master record.',
      edit:'Edit',newTransaction:'New transaction',delete:'Delete',
      allocated:'Allocated',available:'Available',
      masterData:'Master data',fieldSku:'SKU',fieldName:'Name',fieldBaseUom:'Base UoM',
      fieldReorderPoint:'Reorder point',fieldReorderQty:'Reorder qty',fieldExpiry:'Expiry',
      binLocations:'Bin locations',noBinAllocations:'No bin allocations.',
      editItem:'Edit item',itemNameLabel:'Item name',itemNamePlaceholder:'e.g. Hydraulic Hose 12mm',
      systemNumbered:'System-numbered',openingQty:'Opening qty',
      useStockAdjustment:'Use Stock Adjustment to receive stock',
      saveChanges:'Save changes',createItem:'Create item',itemNameRequired:'Item name is required',
      itemUpdated:'Item {sku} updated',itemCreated:'Item {sku} "{name}" created',
      itemSaveError:'Item could not be saved',
      deleteTitle:'Delete {name}?',deleteNotSupported:"Deleting items isn't supported yet",
      deleteBody:"{sku} has real stock/movement history behind it — item deletion isn't implemented. Archive or stop reordering it instead.",
      subHeader:'Master data for every stocked item. Select a row to view, edit or delete — or add a new item.',
      catComponents:'Components',catRawMaterials:'Raw Materials',catFinishedGoods:'Finished Goods',
      catConsumables:'Consumables',catPackaging:'Packaging',
    },
    ms:{
  "colItem": "item",
  "colUom": "UoM",
  "colReorderPt": "Titik pesan semula",
  "colUnitCost": "Kos seunit",
  "colStatus": "Status",
  "selectItem": "Pilih item untuk lihat, edit atau padam rekod induknya.",
  "edit": "Sunting",
  "newTransaction": "Transaksi baharu",
  "delete": "Padam",
  "allocated": "Diperuntukkan",
  "available": "Tersedia",
  "masterData": "Data induk",
  "fieldSku": "SKU",
  "fieldName": "Nama",
  "fieldBaseUom": "UoM asas",
  "fieldReorderPoint": "Titik pesan semula",
  "fieldReorderQty": "Kuantiti pesan semula",
  "fieldExpiry": "Tamat tempoh",
  "binLocations": "Lokasi bin",
  "noBinAllocations": "Tiada peruntukan bin.",
  "editItem": "Edit item",
  "itemNameLabel": "Nama item",
  "itemNamePlaceholder": "cth. Hos Hidraulik 12mm",
  "systemNumbered": "Bernombor sistem",
  "openingQty": "Kuantiti pembukaan",
  "useStockAdjustment": "Guna Pelarasan Stok untuk terima stok",
  "saveChanges": "Simpan perubahan",
  "createItem": "Cipta item",
  "itemNameRequired": "Nama item diperlukan",
  "itemUpdated": "Item {sku} dikemas kini",
  "itemCreated": "Item {sku} \"{name}\" dicipta",
  "itemSaveError": "Item tidak dapat disimpan",
  "deleteTitle": "Padam {name}?",
  "deleteNotSupported": "Memadam item belum disokong",
  "deleteBody": "{sku} mempunyai sejarah stok/pergerakan sebenar — pemadaman item belum dilaksanakan. Arkibkan atau hentikan pesanan semula sebaliknya.",
  "subHeader": "Data induk untuk setiap item stok. Pilih baris untuk lihat, edit atau padam — atau tambah item baharu.",
  "catComponents": "Komponen",
  "catRawMaterials": "Bahan Mentah",
  "catFinishedGoods": "Barang Siap",
  "catConsumables": "Barang Guna Habis",
  "catPackaging": "Pembungkusan"
},
    zh:{
  "colItem": "物料",
  "colUom": "计量单位",
  "colReorderPt": "再订货点",
  "colUnitCost": "单位成本",
  "colStatus": "状态",
  "selectItem": "选择一行以查看、编辑或删除该物料主数据。",
  "edit": "编辑",
  "newTransaction": "新建交易",
  "delete": "删除",
  "allocated": "已分配",
  "available": "可用",
  "masterData": "主数据",
  "fieldSku": "存货单位",
  "fieldName": "名称",
  "fieldBaseUom": "基本计量单位",
  "fieldReorderPoint": "再订货点",
  "fieldReorderQty": "再订货量",
  "fieldExpiry": "有效期",
  "binLocations": "库位",
  "noBinAllocations": "暂无库位分配。",
  "editItem": "编辑物料",
  "itemNameLabel": "物料名称",
  "itemNamePlaceholder": "例如:液压软管 12mm",
  "systemNumbered": "系统编号",
  "openingQty": "期初数量",
  "useStockAdjustment": "请使用库存调整来接收库存",
  "saveChanges": "保存更改",
  "createItem": "创建物料",
  "itemNameRequired": "请填写物料名称",
  "itemUpdated": "物料 {sku} 已更新",
  "itemCreated": "物料 {sku}「{name}」已创建",
  "itemSaveError": "物料保存失败",
  "deleteTitle": "删除 {name}?",
  "deleteNotSupported": "暂不支持删除物料",
  "deleteBody": "{sku} 已有真实的库存/移动记录 — 尚未实现物料删除功能。请改为归档或停止再订购。",
  "subHeader": "查看所有库存物料的主数据。点击一行以查看、编辑或删除 — 或新增物料。",
  "catComponents": "零部件",
  "catRawMaterials": "原材料",
  "catFinishedGoods": "成品",
  "catConsumables": "耗材",
  "catPackaging": "包装"
},
    ja:{
  "colItem": "品目",
  "colUom": "単位",
  "colReorderPt": "発注点",
  "colUnitCost": "単価",
  "colStatus": "ステータス",
  "selectItem": "行を選択すると品目マスタの表示・編集・削除ができます。",
  "edit": "編集",
  "newTransaction": "新規取引",
  "delete": "削除",
  "allocated": "引当済",
  "available": "利用可能",
  "masterData": "マスタデータ",
  "fieldSku": "SKU",
  "fieldName": "名称",
  "fieldBaseUom": "基本単位",
  "fieldReorderPoint": "発注点",
  "fieldReorderQty": "発注数量",
  "fieldExpiry": "有効期限",
  "binLocations": "保管ロケーション",
  "noBinAllocations": "保管ロケーションの割当はありません。",
  "editItem": "品目を編集",
  "itemNameLabel": "品目名",
  "itemNamePlaceholder": "例:油圧ホース 12mm",
  "systemNumbered": "システム採番",
  "openingQty": "期首数量",
  "useStockAdjustment": "在庫を受け入れるには在庫調整を使用してください",
  "saveChanges": "変更を保存",
  "createItem": "品目を作成",
  "itemNameRequired": "品目名を入力してください",
  "itemUpdated": "品目 {sku} を更新しました",
  "itemCreated": "品目 {sku}「{name}」を作成しました",
  "itemSaveError": "品目を保存できませんでした",
  "deleteTitle": "{name} を削除しますか?",
  "deleteNotSupported": "品目の削除は未対応です",
  "deleteBody": "{sku} には実際の在庫・入出庫履歴があるため、品目削除は未実装です。アーカイブするか発注を停止してください。",
  "subHeader": "在庫品目のマスタデータです。行を選択して表示・編集・削除するか、新しい品目を追加してください。",
  "catComponents": "部品",
  "catRawMaterials": "原材料",
  "catFinishedGoods": "完成品",
  "catConsumables": "消耗品",
  "catPackaging": "梱包資材"
},
    vi:{
  "colItem": "Mặt hàng",
  "colUom": "ĐVT",
  "colReorderPt": "Điểm đặt hàng lại",
  "colUnitCost": "Đơn giá",
  "colStatus": "Trạng thái",
  "selectItem": "Chọn một dòng để xem, sửa hoặc xóa hồ sơ gốc của mặt hàng.",
  "edit": "Sửa",
  "newTransaction": "Giao dịch mới",
  "delete": "Xóa",
  "allocated": "Đã phân bổ",
  "available": "Khả dụng",
  "masterData": "Dữ liệu gốc",
  "fieldSku": "Mã hàng",
  "fieldName": "Tên",
  "fieldBaseUom": "ĐVT cơ bản",
  "fieldReorderPoint": "Điểm đặt hàng lại",
  "fieldReorderQty": "SL đặt hàng lại",
  "fieldExpiry": "Hạn sử dụng",
  "binLocations": "Vị trí kho",
  "noBinAllocations": "Chưa có vị trí kho nào.",
  "editItem": "Sửa mặt hàng",
  "itemNameLabel": "Tên mặt hàng",
  "itemNamePlaceholder": "vd: Ống thủy lực 12mm",
  "systemNumbered": "Đánh số tự động",
  "openingQty": "SL tồn đầu kỳ",
  "useStockAdjustment": "Dùng Điều chỉnh tồn kho để nhận hàng",
  "saveChanges": "Lưu thay đổi",
  "createItem": "Tạo mặt hàng",
  "itemNameRequired": "Vui lòng nhập tên mặt hàng",
  "itemUpdated": "Đã cập nhật mặt hàng {sku}",
  "itemCreated": "Đã tạo mặt hàng {sku} \"{name}\"",
  "itemSaveError": "Không thể lưu mặt hàng",
  "deleteTitle": "Xóa {name}?",
  "deleteNotSupported": "Chưa hỗ trợ xóa mặt hàng",
  "deleteBody": "{sku} đã có lịch sử tồn kho/giao dịch thực tế — chức năng xóa mặt hàng chưa được triển khai. Hãy lưu trữ hoặc ngừng đặt hàng lại thay vào đó.",
  "subHeader": "Dữ liệu gốc cho mọi mặt hàng tồn kho. Chọn một dòng để xem, sửa, xóa — hoặc thêm mặt hàng mới.",
  "catComponents": "Linh kiện",
  "catRawMaterials": "Nguyên liệu",
  "catFinishedGoods": "Thành phẩm",
  "catConsumables": "Vật tư tiêu hao",
  "catPackaging": "Bao bì"
},
  };
  const pack=i18nLegacy(packs);
  return key=>pack[key]||packs.en[key]||key;
}

SCREENS['item-master'] = async function(root){
  await prepareCanonicalInventoryData();
  const s=itemMasterCopy();
  const CATS=['Components','Raw Materials','Finished Goods','Consumables','Packaging'];
  const CAT_KEYS={Components:'catComponents','Raw Materials':'catRawMaterials','Finished Goods':'catFinishedGoods',Consumables:'catConsumables',Packaging:'catPackaging'};
  const UOMS=['ea','kg','m','sheet','L','box','pair','set'];
  let page=null;

  function detail(it){
    if(!it) return `<div class="detail-empty">${ic('tag')}<div>${esc(s('selectItem'))}</div></div>`;
    const avail=it.onHand-it.alloc;
    const catLabel=s(CAT_KEYS[it.cat]||it.cat);
    return `
      <div class="detail-head">
        <span class="grabber"></span>
        <button class="close" data-master-detail-close>${ic('chevL')}${esc(t('common.close'))}</button>
        <div class="dh-top"><div><h2>${esc(it.name)}</h2><span class="sub">${esc(it.sku)} · ${esc(catLabel)} · ${esc(t('inv.peruom'))} ${esc(it.uom)}</span></div><div style="margin-left:auto">${statusBadge(it.status)}</div></div>
        <div class="dh-actions">${btn(s('edit'),{icon:'edit',cls:'primary',attrs:'data-edit="1"'})}${btn(s('newTransaction'),{icon:'transfer',cls:'soft',attrs:'onclick="navigate(\'stock-movement\')"'})}${btn(s('delete'),{icon:'trash',cls:'soft',attrs:'data-del="1"'})}</div>
      </div>
      <div class="detail-body">
        <div class="statgrid"><div class="stat"><small>${esc(t('inv.col.onhand'))}</small><b class="tnum">${num(it.onHand)}</b></div><div class="stat"><small>${esc(s('allocated'))}</small><b class="tnum">${num(it.alloc)}</b></div><div class="stat accentval"><small>${esc(s('available'))}</small><b class="tnum">${num(avail)}</b></div><div class="stat"><small>${esc(t('inv.col.value'))}</small><b class="tnum">${money0(it.onHand*it.cost)}</b></div></div>
        <div class="sectitle">${esc(s('masterData'))}</div>
        <div class="card">
          <div class="field"><span class="k">${esc(s('fieldSku'))}</span><span class="v mono">${esc(it.sku)}</span></div>
          <div class="field"><span class="k">${esc(s('fieldName'))}</span><span class="v">${esc(it.name)}</span></div>
          <div class="field"><span class="k">${esc(t('inv.category'))}</span><span class="v">${esc(catLabel)}</span></div>
          <div class="field"><span class="k">${esc(s('fieldBaseUom'))}</span><span class="v">${esc(it.uom)}</span></div>
          <div class="field"><span class="k">${esc(s('fieldReorderPoint'))}</span><span class="v tnum">${num(it.reorder)}</span></div>
          <div class="field"><span class="k">${esc(s('fieldReorderQty'))}</span><span class="v tnum">${num(it.roq)}</span></div>
          <div class="field"><span class="k">${esc(s('colUnitCost'))}</span><span class="v tnum">${money(it.cost)}</span></div>
          ${it.expiry?`<div class="field"><span class="k">${esc(s('fieldExpiry'))}</span><span class="v" style="color:var(--warn)">${esc(it.expiry)}</span></div>`:''}
        </div>
        <div class="sectitle">${esc(s('binLocations'))}</div>
        <div class="card">${it.bins&&it.bins.length?it.bins.map(b=>`<div class="field"><span class="k mono">${esc(b[0])}</span><span class="v tnum">${num(b[1])} ${esc(it.uom)}</span></div>`).join(''):`<div style="color:var(--muted);font-size:13px">${esc(s('noBinAllocations'))}</div>`}</div>
      </div>`;
  }

  function nextSku(){ let max=7789; DB.items.forEach(x=>{ const m=/(\d+)\s*$/.exec(x.sku); if(m&&+m[1]>max)max=+m[1]; }); return 'NW-'+(max+1); }

  function itemForm(it){
    const edit=!!it;
    const sku=edit?it.sku:nextSku();
    appModal({
      icon: edit?'edit':'plus',
      title: edit?s('editItem'):t('inv.newitem'),
      body: `<div class="set-grid">
        <div class="fld"><span>${esc(s('itemNameLabel'))} <span class="req">*</span></span><input id="ifName" value="${edit?esc(it.name):''}" placeholder="${esc(s('itemNamePlaceholder'))}"></div>
        <div class="fld"><span>${esc(s('fieldSku'))}</span><input value="${esc(sku)}" readonly><span class="locked">${ic('lock')} ${esc(s('systemNumbered'))}</span></div>
        <div class="fld"><span>${esc(t('inv.category'))}</span><select id="ifCat">${CATS.map(c=>`<option value="${esc(c)}" ${edit&&it.cat===c?'selected':''}>${esc(s(CAT_KEYS[c]))}</option>`).join('')}</select></div>
        <div class="fld"><span>${esc(s('fieldBaseUom'))}</span><select id="ifUom">${UOMS.map(u=>`<option ${edit&&it.uom===u?'selected':''}>${u}</option>`).join('')}</select></div>
        <div class="fld"><span>${esc(s('fieldReorderPoint'))}</span><input id="ifReorder" type="number" min="0" class="tnum" value="${edit?it.reorder:50}"></div>
        <div class="fld"><span>${esc(s('fieldReorderQty'))}</span><input id="ifRoq" type="number" min="0" class="tnum" value="${edit?it.roq:150}"></div>
        <div class="fld"><span>${esc(s('colUnitCost'))} (USD)</span><input id="ifCost" type="number" min="0" step="0.01" class="tnum" value="${edit?it.cost:0}"></div>
        ${edit?'':`<div class="fld"><span>${esc(s('openingQty'))}</span><input value="0" readonly><span class="locked">${ic('lock')} ${esc(s('useStockAdjustment'))}</span></div>`}
      </div>`,
      actions: `${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(edit?s('saveChanges'):s('createItem'),{icon:edit?'save':'plus',cls:'primary',attrs:'data-save="1"'})}`,
    });
    const saveBtn=$('#modalEl').querySelector('[data-save]');
    saveBtn.addEventListener('click',async()=>{
      const name=$('#ifName').value.trim();
      if(!requireField(name, s('itemNameRequired'), '#ifName')) return;
      const d={ name, category:$('#ifCat').value, uom:$('#ifUom').value,
        reorderPoint:Math.max(0,+$('#ifReorder').value||0), reorderQty:Math.max(0,+$('#ifRoq').value||0),
        standardCost:Math.max(0,+$('#ifCost').value||0) };
      saveBtn.disabled=true;
      try{
        if(edit){
          await window.ErpSystemData.action('inventory/products', it.id, 'update', d);
          toast(s('itemUpdated').replace('{sku}',it.sku),'ok');
        }else{
          await window.ErpSystemData.create('inventory/products', Object.assign({sku},d));
          toast(s('itemCreated').replace('{sku}',sku).replace('{name}',name),'ok');
        }
        closeModal();
        await prepareCanonicalInventoryData();
        page.render();
        page.select(sku);
      }catch(error){
        saveBtn.disabled=false;
        toast(error&&error.message?error.message:s('itemSaveError'),'danger');
      }
    });
  }

  function confirmDelete(it){
    appModal({
      icon: 'trash',
      title: s('deleteTitle').replace('{name}',it.name),
      body: `<div class="risk danger">${ic('warn')}<div><b>${esc(s('deleteNotSupported'))}</b><small>${esc(s('deleteBody').replace('{sku}',it.sku))}</small></div></div>`,
      actions: `${btn(t('common.close'),{cls:'primary',attrs:'onclick="closeModal()"'})}`,
    });
  }

  const totVal=DB.items.reduce((sum,it)=>sum+it.onHand*it.cost,0);
  const totalOnHand=DB.items.reduce((sum,it)=>sum+it.onHand,0);
  page=masterDetailRegisterPage(root,{
    module:'inventory',
    route:'item-master',
    title:t('inv.nav.items'),
    description:s('subHeader'),
    rows:()=>DB.items,
    rowId:it=>it.sku,
    filters:[['all',t('common.all')],...CATS.map(category=>[category,s(CAT_KEYS[category])])],
    filterFn:(it,category)=>it.cat===category,
    kpis:[
      {label:t('common.items'),value:DB.items.length},
      {label:t('inv.col.onhand'),value:num(totalOnHand)},
      {label:t('inv.kpi.value'),value:money0(totVal)},
    ],
    primaryAction:{label:t('inv.newitem'),icon:'plus',onClick:()=>itemForm(null)},
    columns:[
      {label:s('colItem'),sticky:true,render:it=>`<div class="cellsub"><b>${esc(it.name)}</b><small>${esc(it.sku)}</small></div>`},
      {label:t('inv.category'),align:'l',render:it=>esc(s(CAT_KEYS[it.cat]||it.cat))},
      {label:s('colUom'),align:'l',render:it=>esc(it.uom)},
      {label:s('colReorderPt'),align:'r',render:it=>`<span class="tnum" style="color:var(--muted)">${num(it.reorder)}</span>`},
      {label:s('colUnitCost'),align:'r',sortable:true,render:it=>`<span class="tnum">${money(it.cost)}</span>`},
      {label:t('inv.col.onhand'),align:'r',sortable:true,render:it=>`<span class="tnum">${num(it.onHand)}</span>`},
      {label:s('colStatus'),align:'l',render:it=>statusBadge(it.status)},
    ],
    empty:{icon:'tag',title:s('selectItem')},
    detailPane:{
      rowLabel:it=>`${t('common.open')} ${it.sku}`,
      initialSelectedId:DB.items[0]&&DB.items[0].sku,
      empty:`<div class="detail-empty">${ic('tag')}<div>${esc(s('selectItem'))}</div></div>`,
      content:detail,
      afterRender:({detailRoot,row})=>{
        if(!detailRoot||!row) return;
        detailRoot.querySelector('[data-edit]')?.addEventListener('click',()=>itemForm(row));
        detailRoot.querySelector('[data-del]')?.addEventListener('click',()=>confirmDelete(row));
      },
    },
  });
};

/* ---------------- STOCK MOVEMENT LEDGER ---------------- */
SCREENS['stock-movement'] = async function(root){
  await prepareCanonicalInventoryData();
  function tone(t){ return t.startsWith('Goods Receipt')||t.includes('Receipt')||t==='Transfer In'?'ok':t.includes('Issue')||t==='Transfer Out'||t==='Adjustment'?'danger':'accent'; }
  function movementKind(movement){
    const type=String(movement.type||'').toLowerCase();
    if(type.includes('receipt')||type==='transfer in') return 'receipts';
    if(type.includes('issue')) return 'issues';
    if(type.includes('transfer')) return 'transfers';
    if(type.includes('adjustment')) return 'adjustments';
    return 'other';
  }
  const netChange=DB.movements.reduce((s,m)=>s+m.qty,0);
  const mvDates=DB.movements.map(m=>m.date.slice(0,10)).sort();
  const fmtD=d=>formatDate(d,{month:'short',day:'numeric'});
  const rangeLabel=mvDates.length?fmtD(mvDates[0])+' – '+fmtD(mvDates[mvDates.length-1]):'No movements';
  transactionListPage(root,{
    module:'inventory',route:'stock-movement',title:t('inv.nav.movements'),
    description:'Every posted in/out and adjustment — the shared truth behind on-hand balances. Drill any row to its source document.',
    rows:DB.movements,rowId:m=>m.no,
    filters:[['all','All types'],['receipts','Receipts'],['issues','Issues'],['transfers','Transfers'],['adjustments','Adjustments']],
    filterFn:(movement,filter)=>movementKind(movement)===filter,
    kpis:[{label:'Net change',value:(netChange>0?'+':'')+num(netChange),negative:netChange<0}],
    primaryAction:{label:'New adjustment',icon:'plus',onClick:()=>navigate('new-stock-adjustment')},
    note:rangeLabel,
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
    rowAction:null,
    empty:{icon:'transfer',title:'No stock movements'},
  });
};

/* ---------------- INVENTORY VALUATION REPORT ---------------- */
SCREENS['inv-valuation'] = async function(root){
  await prepareCanonicalInventoryData();
  const rows=DB.valuation.flatMap(group=>(group.items||[]).map(item=>({
    ...item,
    category:group.cat,
    value:item.qty*item.cost,
  })));
  const totalValue=rows.reduce((sum,row)=>sum+row.value,0);
  const totalQty=rows.reduce((sum,row)=>sum+row.qty,0);
  const categories=[...new Set(rows.map(row=>row.category))].sort();
  const locale=({en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'})[getLang()]||'en-SG';
  const asAt=new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date());

  reportListPage(root,{
    module:'inventory',
    route:'inv-valuation',
    title:t('inv.nav.valuation'),
    description:ts('Current inventory value by item and category at standard cost.'),
    rows,
    rowId:row=>row.sku,
    rowAction:null,
    filters:[['all',t('common.all')],...categories.map(category=>[category,category])],
    filterFn:(row,category)=>row.category===category,
    kpis:[
      {label:t('inv.kpi.value'),value:money(totalValue)},
      {label:t('common.items'),value:num(rows.length)},
      {label:t('inv.col.onhand'),value:num(totalQty)},
      {label:t('inv.category'),value:num(categories.length)},
    ],
    note:`${t('inv.asAtNote',{date:asAt})}${DB.inventoryReadMeta&&DB.inventoryReadMeta.truncated?` · ${t('inv.firstRows')}`:''}`,
    columns:[
      {label:t('inv.col.item'),sticky:true,render:row=>`<div class="cellsub"><b>${esc(row.name)}</b><small>${esc(row.sku)}</small></div>`},
      {label:t('inv.category'),align:'l',render:row=>esc(row.category)},
      {label:t('inv.col.onhand'),align:'r',sortable:true,render:row=>`<span class="tnum">${num(row.qty)}</span>`},
      {label:t('inv.col.unitcost'),align:'r',sortable:true,render:row=>`<span class="tnum">${money(row.cost)}</span>`},
      {label:t('inv.col.value'),align:'r',sortable:true,render:row=>`<b class="tnum">${money(row.value)}</b>`},
      {label:ts('Share'),align:'r',render:row=>`<span class="tnum">${totalValue?(row.value/totalValue*100).toFixed(1):'0.0'}%</span>`},
    ],
    empty:{
      icon:'box',
      title:ts('No inventory to value'),
      description:ts('No canonical product or stock balance exists for this company.'),
    },
  });
};
