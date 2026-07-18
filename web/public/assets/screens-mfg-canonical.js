/* ============================================================
   ARIA ERP — canonical manufacturing work-order screens
   Formal ErpSystemData resources only. BOM/MRP master screens remain Preview
   until their authoring and run commands are delivered.
   ============================================================ */
(function canonicalManufacturingScreens(){
  function mfgCopy(){
    const lang=typeof getLang==='function'?getLang():'en';
    const all={
      en:{
        orders:'Work orders',newOrder:'New work order',product:'Product',quantity:'Quantity',
        start:'Start',due:'Due',status:'Status',priority:'Priority',progress:'Progress',
        materials:'Material requirements',operations:'Operations',release:'Release work order',
        released:'Work order released',issue:'Issue materials',issuedDone:'Materials issued',
        report:'Complete operation',reported:'Operation reported',completeOrder:'Complete & receive FG',
        orderCompleted:'Finished goods received',create:'Create work order',createRelease:'Create and release',
        schedule:'Schedule',warehouse:'Production warehouse',bom:'BOM revision',routing:'Routing',
        demand:'Demand source',cancel:'Cancel',empty:'No canonical work orders are available.',
        emptyDesc:'Create a work order to snapshot its active BOM and routing.',
        planned:'Planned',releasedStatus:'Released',inProgress:'In progress',onHold:'On hold',
        completed:'Completed',closed:'Closed',cancelled:'Cancelled',required:'Required',
        issued:'Issued',available:'Available',cost:'Unit cost',workCenter:'Work centre',
        plannedHours:'Planned hours',actualHours:'Actual hours',dataLimit:'Showing the first 100 canonical rows per resource.',
      },
      ms:{
        orders:'Arahan kerja',newOrder:'Arahan kerja baharu',product:'Produk',quantity:'Kuantiti',
        start:'Mula',due:'Tarikh siap',status:'Status',priority:'Keutamaan',progress:'Kemajuan',
        materials:'Keperluan bahan',operations:'Operasi',release:'Lepaskan arahan kerja',
        released:'Arahan kerja dilepaskan',issue:'Keluarkan bahan',issuedDone:'Bahan dikeluarkan',
        report:'Selesaikan operasi',reported:'Operasi direkodkan',completeOrder:'Selesai & terima barang siap',
        orderCompleted:'Barang siap telah diterima',create:'Cipta arahan kerja',createRelease:'Cipta dan lepaskan',
        schedule:'Jadual',warehouse:'Gudang pengeluaran',bom:'Semakan BOM',routing:'Laluan',
        demand:'Sumber permintaan',cancel:'Batal',empty:'Tiada arahan kerja kanonik.',
        emptyDesc:'Cipta arahan kerja untuk menyimpan petikan BOM dan laluan aktif.',
        planned:'Dirancang',releasedStatus:'Dilepaskan',inProgress:'Sedang berjalan',onHold:'Ditahan',
        completed:'Selesai',closed:'Ditutup',cancelled:'Dibatalkan',required:'Diperlukan',
        issued:'Dikeluarkan',available:'Tersedia',cost:'Kos unit',workCenter:'Pusat kerja',
        plannedHours:'Jam dirancang',actualHours:'Jam sebenar',dataLimit:'Menunjukkan 100 baris kanonik pertama bagi setiap sumber.',
      },
      zh:{
        orders:'生产工单',newOrder:'新建工单',product:'成品',quantity:'计划数量',
        start:'开始日期',due:'到期日期',status:'状态',priority:'优先级',progress:'进度',
        materials:'物料需求',operations:'工序',release:'释放工单',
        released:'工单已释放',issue:'领用物料',issuedDone:'物料已领用',
        report:'完成当前工序',reported:'工序报工完成',completeOrder:'完工并入库',
        orderCompleted:'成品已入库',create:'创建工单',createRelease:'创建并释放',
        schedule:'生产排程',warehouse:'生产仓库',bom:'BOM 版本',routing:'工艺路线',
        demand:'需求来源',cancel:'取消',empty:'目前没有标准生产工单。',
        emptyDesc:'创建工单后，系统会保存当时生效的 BOM 和工艺路线快照。',
        planned:'已计划',releasedStatus:'已释放',inProgress:'生产中',onHold:'暂停',
        completed:'已完成',closed:'已关闭',cancelled:'已取消',required:'需求',
        issued:'已领料',available:'可用',cost:'单位成本',workCenter:'工作中心',
        plannedHours:'计划工时',actualHours:'实际工时',dataLimit:'每项资源显示前 100 条标准记录。',
      },
    };
    const copy=all[lang]||all.en;
    return key=>copy[key]||all.en[key]||key;
  }

  function statusLabel(s,status){
    return ({
      planned:s('planned'),released:s('releasedStatus'),in_progress:s('inProgress'),
      on_hold:s('onHold'),completed:s('completed'),closed:s('closed'),cancelled:s('cancelled'),
    })[status]||status;
  }
  function statusTone(status){
    return ({
      planned:'neutral',released:'accent',in_progress:'info',on_hold:'warn',
      completed:'ok',closed:'neutral',cancelled:'danger',
    })[status]||'neutral';
  }
  function dateLabel(value){
    const lang=typeof getLang==='function'?getLang():'en';
    const date=new Date(String(value||'')+'T00:00:00');
    if(Number.isNaN(date.getTime())) return String(value||'—');
    return new Intl.DateTimeFormat(lang==='zh'?'zh-CN':lang==='ms'?'ms-MY':'en-SG',{
      year:'numeric',month:'short',day:'numeric',
    }).format(date);
  }
  function adapter(){
    if(!window.ErpSystemData) throw new Error('ERP data adapter is unavailable.');
    return window.ErpSystemData;
  }
  function byId(rows){ return new Map((rows||[]).map(row=>[Number(row.id),row])); }
  function openWorkOrder(id){
    window.ACTIVE_WORK_ORDER_ID=Number(id);
    navigate('work-order');
  }

  SCREENS['work-orders']=async function(root){
    const a=adapter(),s=mfgCopy();
    const [orderPage,productPage]=await Promise.all([
      a.list('manufacturing/work-orders',{limit:100}),
      a.list('inventory/products',{limit:100}),
    ]);
    const orders=orderPage.data||[];
    const products=byId(productPage.data);
    let active='all';
    function filtered(){
      return active==='all'?orders:orders.filter(order=>order.status===active);
    }
    function table(){
      return buildTable({
        rowId:row=>row.id,
        columns:[
          {label:s('orders'),sticky:true,render:row=>{
            const item=products.get(Number(row.productId))||{};
            return `<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b>
              <small>${esc(item.sku||'#'+row.productId)} · ${esc(item.name||s('product'))}</small></div>`;
          }},
          {label:s('quantity'),align:'r',render:row=>`<span class="tnum">${num(Number(row.plannedQty))}</span>`},
          {label:s('start'),render:row=>esc(dateLabel(row.startDate))},
          {label:s('due'),render:row=>esc(dateLabel(row.dueDate))},
          {label:s('priority'),render:row=>cap(row.priority,row.priority==='urgent'?'danger':row.priority==='high'?'warn':'neutral')},
          {label:s('progress'),align:'r',render:row=>{
            const pct=Number(row.plannedQty)?Math.round(Number(row.completedQty)/Number(row.plannedQty)*100):0;
            return `<span class="minibar"><i class="${pct>=100?'ok':pct>0?'warn':''}" style="width:${pct}%"></i></span> ${pct}%`;
          }},
          {label:s('status'),render:row=>cap(statusLabel(s,row.status),statusTone(row.status))},
        ],
        rows:filtered(),
      });
    }
    const chips=[
      ['all',t('common.all')],['planned',s('planned')],['released',s('releasedStatus')],
      ['in_progress',s('inProgress')],['completed',s('completed')],
    ];
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.manufacturing'),s('orders')])}
        <div class="h1row"><h1>${esc(s('orders'))}</h1><span class="countchip" id="mfgCount">${orders.length}</span>
          <div class="headright">${btn(s('newOrder'),{icon:'plus',cls:'primary',attrs:'data-new-work-order'})}</div>
        </div>
      </div>
      <div class="toolbar"><div class="filterchips" id="mfgFilters">
        ${chips.map(([key,label])=>`<button class="chip ${key==='all'?'on':''}" data-status="${key}">${esc(label)}</button>`).join('')}
      </div><div class="grow"></div><small style="color:var(--muted)">${esc(s('dataLimit'))}</small></div>
      <div class="tablewrap" id="mfgOrders">${orders?table():''}</div>
      ${!orders.length?`<div class="statepanel empty">${ic('factory')}<h3>${esc(s('empty'))}</h3><p>${esc(s('emptyDesc'))}</p></div>`:''}
    </section></div>`;
    const tableRoot=root.querySelector('#mfgOrders');
    function wire(){
      if(tableRoot) wireTable(tableRoot,{onRow:id=>openWorkOrder(id)});
    }
    wire();
    root.querySelector('[data-new-work-order]')?.addEventListener('click',()=>navigate('new-work-order'));
    root.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{
      root.querySelector('.chip.on')?.classList.remove('on');
      button.classList.add('on');
      active=button.dataset.status;
      if(tableRoot){ tableRoot.innerHTML=table(); wire(); }
      root.querySelector('#mfgCount').textContent=String(filtered().length);
    }));
  };

  SCREENS['work-order']=async function(root){
    const a=adapter(),s=mfgCopy();
    const pages=await Promise.all([
      a.list('manufacturing/work-orders',{limit:100}),
      a.list('manufacturing/work-order-materials',{limit:100}),
      a.list('manufacturing/work-order-operations',{limit:100}),
      a.list('inventory/products',{limit:100}),
      a.list('inventory/warehouses',{limit:100}),
      a.list('inventory/stock-levels',{limit:100}),
      a.list('manufacturing/work-centers',{limit:100}),
      a.list('manufacturing/bom-versions',{limit:100}),
      a.list('manufacturing/routings',{limit:100}),
    ]);
    const orders=pages[0].data||[];
    const id=Number(window.ACTIVE_WORK_ORDER_ID)||Number(orders[0]?.id);
    const order=orders.find(row=>Number(row.id)===id)||orders[0];
    if(!order){
      root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty">
        ${ic('factory')}<h3>${esc(s('empty'))}</h3><p>${esc(s('emptyDesc'))}</p></div></section></div>`;
      return;
    }
    window.ACTIVE_WORK_ORDER_ID=Number(order.id);
    const products=byId(pages[3].data),warehouses=byId(pages[4].data);
    const centers=byId(pages[6].data),versions=byId(pages[7].data),routings=byId(pages[8].data);
    const stock=new Map();
    (pages[5].data||[]).forEach(row=>{
      const key=Number(row.productId);
      stock.set(key,(stock.get(key)||0)+Number(row.qty));
    });
    const materials=(pages[1].data||[]).filter(row=>Number(row.workOrderId)===Number(order.id));
    const operations=(pages[2].data||[]).filter(row=>Number(row.workOrderId)===Number(order.id))
      .sort((x,y)=>Number(x.sequence)-Number(y.sequence));
    const finished=products.get(Number(order.productId))||{};
    const location=warehouses.get(Number(order.warehouseId))||{};
    const version=versions.get(Number(order.bomVersionId))||{};
    const routing=routings.get(Number(order.routingId))||{};
    const pct=Number(order.plannedQty)?Math.round(Number(order.completedQty)/Number(order.plannedQty)*100):0;
    const allMaterialsIssued=materials.length>0&&materials.every(line=>Number(line.issuedQty)===Number(line.requiredQty));
    const activeOperation=operations.find(operation=>!['completed','skipped'].includes(operation.status));
    const allOperationsComplete=operations.length>0&&!activeOperation;
    const executionActions=[
      order.status==='planned'?btn(s('release'),{icon:'play',cls:'primary',attrs:'data-release-work-order'}):'',
      order.status==='released'?btn(s('issue'),{icon:'transfer',cls:'primary',attrs:'data-issue-work-order'}):'',
      order.status==='in_progress'&&activeOperation?btn(s('report'),{
        icon:'factory',cls:'soft',attrs:`data-report-operation="${activeOperation.id}"`,
      }):'',
      order.status==='in_progress'&&allMaterialsIssued&&allOperationsComplete?btn(s('completeOrder'),{
        icon:'check',cls:'primary',attrs:'data-complete-work-order',
      }):'',
    ].join('');
    const materialRows=materials.map((line,index)=>{
      const item=products.get(Number(line.productId))||{};
      const available=stock.get(Number(line.productId))||0;
      const short=available<Number(line.requiredQty)-Number(line.issuedQty);
      return `<tr><td class="lineno">${index+1}</td>
        <td class="l li-name"><b>${esc(item.name||'#'+line.productId)}</b><small>${esc(item.sku||'')}</small></td>
        <td class="tnum">${num(Number(line.requiredQty))} ${esc(item.uom||'')}</td>
        <td class="tnum">${num(Number(line.issuedQty))}</td>
        <td class="tnum ${short?'neg':''}">${num(available)}</td>
        <td class="tnum">${money(Number(line.unitCost))}</td></tr>`;
    }).join('');
    const operationRows=operations.map(operation=>{
      const center=centers.get(Number(operation.workCenterId))||{};
      return `<div class="oprow"><span class="opseq">${operation.sequence}</span>
        <div class="opmain"><b>${esc(operation.name)}</b><small>${esc(center.code||'')} · ${esc(center.name||s('workCenter'))}</small></div>
        <div class="tnum">${num(Number(operation.actualHours))}/${num(Number(operation.plannedHours))} h</div>
        ${cap(statusLabel(s,operation.status),operation.status==='completed'?'ok':operation.status==='blocked'?'danger':'neutral')}
      </div>`;
    }).join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,t('nav.manufacturing'),s('orders'),{cur:order.docNo}])}
      <div class="dochead"><div class="dh-row1"><div>
        <div class="dt">${ic('factory')}${esc(order.docNo)} <span class="dnum">${esc(finished.sku||'')}</span></div>
        <div class="h1sub">${esc(finished.name||s('product'))} · ${num(Number(order.plannedQty))} ${esc(finished.uom||'')}</div>
      </div><div class="dactions">${cap(statusLabel(s,order.status),statusTone(order.status))}
        ${executionActions}
      </div></div>
      <div class="progressbig"><i style="width:${pct}%"></i></div>
      <div class="docmeta">
        <div class="dm"><small>${esc(s('start'))}</small><b>${esc(dateLabel(order.startDate))}</b></div>
        <div class="dm"><small>${esc(s('due'))}</small><b>${esc(dateLabel(order.dueDate))}</b></div>
        <div class="dm"><small>${esc(s('warehouse'))}</small><b>${esc(location.code||'#'+order.warehouseId)}</b></div>
        <div class="dm"><small>${esc(s('bom'))}</small><b>${esc(version.revision||'#'+order.bomVersionId)}</b></div>
        <div class="dm"><small>${esc(s('routing'))}</small><b>${esc(routing.code||'#'+order.routingId)}</b></div>
      </div></div>
      <div class="doclayout"><div class="docmain">
        <div class="panel"><div class="panel-h"><h3>${esc(s('materials'))}</h3></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('product'))}</th>
            <th>${esc(s('required'))}</th><th>${esc(s('issued'))}</th><th>${esc(s('available'))}</th><th>${esc(s('cost'))}</th>
          </tr></thead><tbody>${materialRows}</tbody></table></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('operations'))}</h3></div>
          <div class="panel-body" style="padding:6px 0">${operationRows}</div></div>
      </div><aside class="summary"><div class="sumcard">
        <div class="sectitle" style="margin-top:0">${esc(s('progress'))}</div>
        <div class="sumrow total"><span class="sk2">${esc(s('quantity'))}</span>
          <span class="sv tnum">${num(Number(order.completedQty))}/${num(Number(order.plannedQty))}</span></div>
        <div class="sumrow"><span class="sk2">${esc(s('priority'))}</span><span class="sv">${cap(order.priority,'neutral')}</span></div>
        <div class="sumrow"><span class="sk2">${esc(s('demand'))}</span><span class="sv">${esc(order.demandSource||'—')}</span></div>
      </div></aside></div>
    </div></div></section></div>`;
    root.querySelector('[data-release-work-order]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      button.disabled=true;
      try{
        await a.action('manufacturing/work-orders',order.id,'release',{},`release-work-order-${order.id}`);
        toast(s('released'),'ok');
        await navigate('work-order');
      }catch(error){
        button.disabled=false;
        toast(error&&error.message||'Manufacturing action failed','danger');
      }
    });
    root.querySelector('[data-issue-work-order]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      button.disabled=true;
      try{
        await a.action('manufacturing/work-orders',order.id,'issue-materials',{},`issue-work-order-${order.id}`);
        toast(s('issuedDone'),'ok');
        await navigate('work-order');
      }catch(error){
        button.disabled=false;
        toast(error&&error.message||'Manufacturing issue failed','danger');
      }
    });
    root.querySelector('[data-report-operation]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      const operation=operations.find(row=>Number(row.id)===Number(button.dataset.reportOperation));
      button.disabled=true;
      try{
        const remaining=Math.max(0.0001,Number(operation.plannedHours)-Number(operation.actualHours));
        await a.action('manufacturing/work-orders',order.id,'report-operation',{
          operationId:Number(operation.id),hours:String(remaining),complete:true,
        },`report-work-order-${order.id}-operation-${operation.id}`);
        toast(s('reported'),'ok');
        await navigate('work-order');
      }catch(error){
        button.disabled=false;
        toast(error&&error.message||'Manufacturing operation failed','danger');
      }
    });
    root.querySelector('[data-complete-work-order]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      button.disabled=true;
      try{
        await a.action('manufacturing/work-orders',order.id,'complete',{},`complete-work-order-${order.id}`);
        toast(s('orderCompleted'),'ok');
        await navigate('work-order');
      }catch(error){
        button.disabled=false;
        toast(error&&error.message||'Manufacturing completion failed','danger');
      }
    });
  };

  SCREENS['new-work-order']=async function(root){
    const a=adapter(),s=mfgCopy();
    const pages=await Promise.all([
      a.list('inventory/products',{limit:100}),
      a.list('inventory/warehouses',{limit:100}),
      a.list('manufacturing/boms',{limit:100}),
      a.list('manufacturing/bom-versions',{limit:100}),
      a.list('manufacturing/routings',{limit:100}),
      a.list('manufacturing/work-orders',{limit:100}),
    ]);
    const products=byId(pages[0].data),warehouses=pages[1].data||[];
    const boms=pages[2].data||[],versions=pages[3].data||[],routings=pages[4].data||[];
    const configs=versions.filter(version=>version.status==='active').map(version=>{
      const bom=boms.find(row=>Number(row.id)===Number(version.bomId)&&row.status==='active');
      const routing=bom&&routings.find(row=>Number(row.productId)===Number(bom.productId)&&row.status==='active');
      const item=bom&&products.get(Number(bom.productId));
      return bom&&routing&&item?{bom,version,routing,item}:null;
    }).filter(Boolean);
    const today=new Date().toISOString().slice(0,10);
    const dueDate=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    const docNo=`WO-${(pages[5].data||[]).length+1}`;
    if(!configs.length||!warehouses.length){
      root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty">
        ${ic('factory')}<h3>${esc(s('empty'))}</h3><p>${esc(s('emptyDesc'))}</p></div></section></div>`;
      return;
    }
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,t('nav.manufacturing'),s('orders'),{cur:s('newOrder')}])}
        <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('factory')}${esc(s('newOrder'))}</div>
          <div class="h1sub">${esc(docNo)} · ${esc(DB.company.name)}</div></div>${cap(s('planned'),'neutral')}</div></div>
        <div class="doclayout"><div class="docmain">
          <div class="panel"><div class="panel-h"><h3>${esc(s('product'))}</h3></div><div class="panel-body">
            <div class="fldrow c2"><div class="fld"><span>${esc(s('product'))}</span><select id="mfgConfig">
              ${configs.map((config,index)=>`<option value="${index}">${esc(config.item.sku)} · ${esc(config.item.name)} · ${esc(config.version.revision)}</option>`).join('')}
            </select></div><div class="fld"><span>${esc(s('quantity'))}</span><input id="mfgQty" type="number" min="0.0001" step="0.0001" value="5"></div></div>
            <div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(s('bom'))}</span><input id="mfgBom" readonly></div>
              <div class="fld"><span>${esc(s('routing'))}</span><input id="mfgRouting" readonly></div></div>
          </div></div>
          <div class="panel"><div class="panel-h"><h3>${esc(s('schedule'))}</h3></div><div class="panel-body">
            <div class="fldrow c3"><div class="fld"><span>${esc(s('start'))}</span><input id="mfgStart" type="date" value="${today}"></div>
              <div class="fld"><span>${esc(s('due'))}</span><input id="mfgDue" type="date" value="${dueDate}"></div>
              <div class="fld"><span>${esc(s('priority'))}</span><select id="mfgPriority">
                <option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option>
              </select></div></div>
            <div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(s('warehouse'))}</span><select id="mfgWarehouse">
              ${warehouses.map(row=>`<option value="${row.id}">${esc(row.code)} · ${esc(row.name)}</option>`).join('')}
            </select></div><div class="fld"><span>${esc(s('demand'))}</span><input id="mfgDemand" placeholder="e.g. replenishment / SO-1"></div></div>
          </div></div>
        </div><aside class="summary"><div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('newOrder'))}</div>
          <p style="font-size:12.5px;color:var(--muted)">${esc(s('emptyDesc'))}</p>
          <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="mfgRelease" checked> ${esc(s('createRelease'))}</label>
        </div></aside></div>
      </div></div>
      <div class="set-savebar"><div class="grow"></div>${btn(s('cancel'),{cls:'soft',attrs:'data-cancel-work-order'})}
        ${btn(s('create'),{icon:'check',cls:'primary',sm:false,attrs:'data-create-work-order'})}</div>
    </section></div>`;
    function updateConfig(){
      const selected=configs[Number(root.querySelector('#mfgConfig').value)]||configs[0];
      root.querySelector('#mfgBom').value=`${selected.bom.code} · ${selected.version.revision}`;
      root.querySelector('#mfgRouting').value=`${selected.routing.code} · ${selected.routing.name}`;
    }
    updateConfig();
    root.querySelector('#mfgConfig').addEventListener('change',updateConfig);
    root.querySelector('[data-cancel-work-order]').addEventListener('click',()=>navigate('work-orders'));
    root.querySelector('[data-create-work-order]').addEventListener('click',async event=>{
      const button=event.currentTarget;
      const selected=configs[Number(root.querySelector('#mfgConfig').value)]||configs[0];
      const payload={
        docNo,
        productId:Number(selected.item.id),
        bomVersionId:Number(selected.version.id),
        routingId:Number(selected.routing.id),
        warehouseId:Number(root.querySelector('#mfgWarehouse').value),
        plannedQty:String(root.querySelector('#mfgQty').value),
        startDate:root.querySelector('#mfgStart').value,
        dueDate:root.querySelector('#mfgDue').value,
        priority:root.querySelector('#mfgPriority').value,
        demandSource:root.querySelector('#mfgDemand').value,
      };
      button.disabled=true;
      try{
        const response=await a.create('manufacturing/work-orders',payload);
        const created=response.data||response;
        window.ACTIVE_WORK_ORDER_ID=Number(created.id);
        if(root.querySelector('#mfgRelease').checked){
          await a.action('manufacturing/work-orders',created.id,'release',{},`release-work-order-${created.id}`);
        }
        await navigate('work-order');
      }catch(error){
        button.disabled=false;
        toast(error&&error.message||'Manufacturing create failed','danger');
      }
    });
  };
})();
