/* ============================================================
   ARIA ERP — canonical manufacturing work-order screens
   Formal ErpSystemData resources only. BOM/MRP remain read-oriented canonical
   master screens until their authoring and run commands are delivered.
   ============================================================ */
(function canonicalManufacturingScreens(){
  function mfgCopy(){

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
        bomTitle:'Bill of materials',bomDescription:'Versioned product structure, material usage, routing and rolled cost.',
        components:'Components',revision:'Revision',effective:'Effective',output:'Output',
        qtyPer:'Qty / output',scrap:'Scrap',rolled:'Rolled material cost',routingTitle:'Production routing',
        componentCount:'Component count',setupHours:'Setup hours',runHours:'Run hours / unit',
        noComponents:'This BOM version has no component lines.',noRouting:'No active routing operations are linked.',
        costContext:'Cost and production context',bomEmptyDesc:'No active canonical BOM version is available.',
        active:'Active',draft:'Draft',inactive:'Inactive',
        runMrp:'Run MRP',mrpTitle:'Material requirements planning',planningDate:'Planning horizon',
        suggestions:'Planning suggestions',gross:'Gross requirement',onHand:'On hand',onOrder:'On order',
        net:'Net requirement',action:'Action',purchase:'Purchase',sufficient:'Sufficient',
        noRun:'No MRP run exists yet.',runComplete:'MRP run completed',
      },
      ms:{
  "orders": "Arahan kerja",
  "newOrder": "Arahan kerja baharu",
  "product": "Produk",
  "quantity": "Kuantiti",
  "start": "Mula",
  "due": "Tarikh siap",
  "status": "Status",
  "priority": "Keutamaan",
  "progress": "Kemajuan",
  "materials": "Keperluan bahan",
  "operations": "Operasi",
  "release": "Lepaskan arahan kerja",
  "released": "Arahan kerja dilepaskan",
  "issue": "Keluarkan bahan",
  "issuedDone": "Bahan dikeluarkan",
  "report": "Selesaikan operasi",
  "reported": "Operasi direkodkan",
  "completeOrder": "Selesai & terima barang siap",
  "orderCompleted": "Barang siap telah diterima",
  "create": "Cipta arahan kerja",
  "createRelease": "Cipta dan lepaskan",
  "schedule": "Jadual",
  "warehouse": "Gudang pengeluaran",
  "bom": "Semakan BOM",
  "routing": "Laluan",
  "demand": "Sumber permintaan",
  "cancel": "Batal",
  "empty": "Tiada arahan kerja kanonik.",
  "emptyDesc": "Cipta arahan kerja untuk menyimpan petikan BOM dan laluan aktif.",
  "planned": "Dirancang",
  "releasedStatus": "Dilepaskan",
  "inProgress": "Sedang berjalan",
  "onHold": "Ditahan",
  "completed": "Selesai",
  "closed": "Ditutup",
  "cancelled": "Dibatalkan",
  "required": "Diperlukan",
  "issued": "Dikeluarkan",
  "available": "Tersedia",
  "cost": "Kos unit",
  "workCenter": "Pusat kerja",
  "plannedHours": "Jam dirancang",
  "actualHours": "Jam sebenar",
  "dataLimit": "Menunjukkan 100 baris kanonik pertama bagi setiap sumber.",
  "bomTitle": "Bil bahan",
  "bomDescription": "Struktur produk bersemakan, penggunaan bahan, laluan dan kos terkumpul.",
  "components": "Komponen",
  "revision": "Semakan",
  "effective": "Berkuat kuasa",
  "output": "Output",
  "qtyPer": "Kuantiti / output",
  "scrap": "Susut",
  "rolled": "Kos bahan terkumpul",
  "routingTitle": "Laluan pengeluaran",
  "componentCount": "Bilangan komponen",
  "setupHours": "Jam persediaan",
  "runHours": "Jam operasi / unit",
  "noComponents": "Versi BOM ini tidak mempunyai baris komponen.",
  "noRouting": "Tiada operasi laluan aktif dipautkan.",
  "costContext": "Konteks kos dan pengeluaran",
  "bomEmptyDesc": "Tiada versi BOM kanonik aktif.",
  "active": "Aktif",
  "draft": "Draf",
  "inactive": "Tidak aktif",
  "runMrp": "Jalankan MRP",
  "mrpTitle": "Perancangan keperluan bahan",
  "planningDate": "Horizon perancangan",
  "suggestions": "Cadangan perancangan",
  "gross": "Keperluan kasar",
  "onHand": "Stok sedia ada",
  "onOrder": "Dalam pesanan",
  "net": "Keperluan bersih",
  "action": "Tindakan",
  "purchase": "Beli",
  "sufficient": "Mencukupi",
  "noRun": "Belum ada larian MRP.",
  "runComplete": "Larian MRP selesai"
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
        bomTitle:'物料清单',bomDescription:'管理版本化产品结构、物料用量、工艺路线和滚算成本。',
        components:'组件',revision:'版本',effective:'生效日期',output:'产出',
        qtyPer:'每产出用量',scrap:'损耗',rolled:'物料滚算成本',routingTitle:'生产工艺路线',
        componentCount:'组件数量',setupHours:'准备工时',runHours:'单位运行工时',
        noComponents:'此 BOM 版本没有组件明细。',noRouting:'没有关联的有效工艺路线工序。',
        costContext:'成本与生产信息',bomEmptyDesc:'当前没有有效的标准 BOM 版本。',
        active:'有效',draft:'草稿',inactive:'停用',
        runMrp:'运行 MRP',mrpTitle:'物料需求计划',planningDate:'计划范围',
        suggestions:'计划建议',gross:'总需求',onHand:'现有库存',onOrder:'在途采购',
        net:'净需求',action:'建议动作',purchase:'采购',sufficient:'库存足够',
        noRun:'尚未运行 MRP。',runComplete:'MRP 运算完成',
      },
      ja:{
  "bomTitle": "部品表",
  "bomDescription": "版管理された製品構成、材料使用量、工程、積上原価を表示します。",
  "components": "構成部品",
  "revision": "版",
  "effective": "適用日",
  "output": "生産数量",
  "product": "製品",
  "quantity": "数量",
  "cost": "単価",
  "routing": "工程",
  "qtyPer": "生産単位当たり数量",
  "scrap": "廃棄率",
  "rolled": "積上材料原価",
  "routingTitle": "生産工程",
  "componentCount": "構成部品数",
  "setupHours": "段取時間",
  "runHours": "単位当たり運転時間",
  "noComponents": "このBOM版には構成部品がありません。",
  "noRouting": "有効な工程作業が関連付けられていません。",
  "costContext": "原価と生産情報",
  "bomEmptyDesc": "有効な標準BOM版がありません。",
  "active": "有効",
  "draft": "下書き",
  "inactive": "無効",
  "newOrder": "新しい作業命令",
  "start": "始める",
  "due": "期限",
  "status": "状態",
  "priority": "優先度",
  "materials": "材料要件",
  "progress": "進捗",
  "operations": "運営",
  "orders": "作業指示",
  "issue": "発行資料",
  "issuedDone": "発行資料",
  "released": "作業命令がリリースされました",
  "release": "作業指示書をリリースする",
  "report": "完全な操作",
  "completeOrder": "コンプリート＆FG受け取り",
  "orderCompleted": "完成品が届きました",
  "reported": "運用報告",
  "schedule": "スケジュール",
  "create": "作業指示書を作成する",
  "createRelease": "作成してリリースする",
  "cancel": "キャンセル",
  "bom": "BOM リビジョン",
  "demand": "需要源",
  "warehouse": "生産倉庫",
  "planned": "計画済み",
  "inProgress": "進行中",
  "releasedStatus": "リリースされました",
  "closed": "閉店",
  "onHold": "保留中",
  "completed": "完了",
  "cancelled": "キャンセル",
  "required": "必須",
  "issued": "発行済み",
  "available": "利用可能",
  "workCenter": "ワークセンター",
  "emptyDesc": "作業指示書を作成して、アクティブな BOM と工順のスナップショットを作成します。",
  "empty": "正規の作業命令は利用できません。",
  "dataLimit": "リソースごとに最初の 100 正規行を表示します。",
  "runMrp": "MRPの実行",
  "plannedHours": "予定時間",
  "actualHours": "実際の時間",
  "onHand": "手元にあります",
  "suggestions": "企画提案",
  "mrpTitle": "資材要件の計画",
  "action": "アクション",
  "purchase": "購入",
  "sufficient": "十分な",
  "net": "正味要件",
  "gross": "総要件",
  "onOrder": "注文中",
  "planningDate": "計画期間",
  "noRun": "MRP 実行はまだ存在しません。",
  "runComplete": "MRP実行が完了しました"
},
      vi:{
  "bomTitle": "Định mức nguyên vật liệu",
  "bomDescription": "Cấu trúc sản phẩm theo phiên bản, mức sử dụng vật liệu, quy trình và chi phí tổng hợp.",
  "components": "Thành phần",
  "revision": "Phiên bản",
  "effective": "Hiệu lực",
  "output": "Sản lượng",
  "product": "Sản phẩm",
  "quantity": "Số lượng",
  "cost": "Đơn giá",
  "routing": "Quy trình",
  "qtyPer": "Số lượng / sản lượng",
  "scrap": "Hao hụt",
  "rolled": "Chi phí vật liệu tổng hợp",
  "routingTitle": "Quy trình sản xuất",
  "componentCount": "Số thành phần",
  "setupHours": "Giờ chuẩn bị",
  "runHours": "Giờ chạy / đơn vị",
  "noComponents": "Phiên bản BOM này chưa có dòng thành phần.",
  "noRouting": "Chưa liên kết công đoạn quy trình đang hoạt động.",
  "costContext": "Chi phí và thông tin sản xuất",
  "bomEmptyDesc": "Không có phiên bản BOM chuẩn đang hoạt động.",
  "active": "Hoạt động",
  "draft": "Bản nháp",
  "inactive": "Ngừng hoạt động",
  "start": "Bắt đầu",
  "newOrder": "Lệnh làm việc mới",
  "due": "Quá hạn",
  "status": "Trạng thái",
  "priority": "Sự ưu tiên",
  "progress": "Tiến triển",
  "materials": "Yêu cầu về vật liệu",
  "operations": "Hoạt động",
  "orders": "Lệnh làm việc",
  "issue": "Tài liệu phát hành",
  "release": "Phát hành lệnh làm việc",
  "issuedDone": "Tài liệu đã ban hành",
  "released": "Lệnh công việc được phát hành",
  "completeOrder": "Hoàn thành và nhận FG",
  "report": "Hoàn thành vận hành",
  "reported": "Đã báo cáo hoạt động",
  "schedule": "Lịch trình",
  "orderCompleted": "Đã nhận được hàng thành phẩm",
  "warehouse": "Kho sản xuất",
  "bom": "Sửa đổi BOM",
  "createRelease": "Tạo và phát hành",
  "create": "Tạo trật tự công việc",
  "cancel": "Hủy bỏ",
  "planned": "Đã lên kế hoạch",
  "releasedStatus": "Phát hành",
  "inProgress": "Đang tiến hành",
  "onHold": "Đang chờ",
  "completed": "Hoàn thành",
  "closed": "Đã đóng",
  "cancelled": "Đã hủy",
  "required": "Yêu cầu",
  "issued": "Đã phát hành",
  "available": "Có sẵn",
  "workCenter": "Trung tâm làm việc",
  "emptyDesc": "Tạo một lệnh sản xuất để chụp nhanh BOM đang hoạt động và định tuyến của nó.",
  "empty": "Không có lệnh sản xuất chuẩn nào có sẵn.",
  "actualHours": "Số giờ thực tế",
  "plannedHours": "Số giờ dự kiến",
  "dataLimit": "Hiển thị 100 hàng chuẩn đầu tiên cho mỗi tài nguyên.",
  "demand": "Nguồn cầu",
  "mrpTitle": "Lập kế hoạch yêu cầu vật tư",
  "onHand": "Trên tay",
  "gross": "Tổng yêu cầu",
  "suggestions": "Đề xuất quy hoạch",
  "planningDate": "chân trời quy hoạch",
  "runMrp": "Chạy MRP",
  "action": "Hoạt động",
  "purchase": "Mua",
  "sufficient": "Hợp lý",
  "onOrder": "Theo đơn đặt hàng",
  "net": "Yêu cầu ròng",
  "noRun": "Chưa có hoạt động MRP nào tồn tại.",
  "runComplete": "Chạy MRP đã hoàn tất"
},
    };
    const copy=i18nLegacy(all);
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
  function bomStatusLabel(s,status){
    return ({active:s('active'),draft:s('draft'),inactive:s('inactive')})[status]||status;
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
    transactionListPage(root,{
      module:'manufacturing',
      route:'work-orders',
      title:s('orders'),
      rows:orders,
      rowId:row=>row.id,
      count:rows=>rows.length,
      primaryAction:{
        label:s('newOrder'),icon:'plus',onClick:()=>navigate('new-work-order'),
      },
      kpis:rows=>[
        {label:s('orders'),value:rows.length,filter:'all'},
        {label:s('planned'),value:rows.filter(row=>row.status==='planned').length,filter:'planned'},
        {label:s('inProgress'),value:rows.filter(row=>row.status==='in_progress').length,filter:'in_progress'},
        {label:s('completed'),value:rows.filter(row=>row.status==='completed').length,filter:'completed'},
      ],
      filters:[
        ['all',t('common.all')],['planned',s('planned')],['released',s('releasedStatus')],
        ['in_progress',s('inProgress')],['completed',s('completed')],
      ],
      filterFn:(row,filter)=>row.status===filter,
      note:s('dataLimit'),
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
      empty:{icon:'factory',title:s('empty'),description:s('emptyDesc')},
      rowAction:{
        label:row=>`${t('common.open')} ${row.docNo}`,
        run:row=>openWorkOrder(row.id),
      },
    });
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
      return `<div class="oprow work-order-operation"><span class="opseq">${operation.sequence}</span>
        <div class="opmain"><b>${esc(operation.name)}</b><small>${esc(center.code||'')} · ${esc(center.name||s('workCenter'))}</small></div>
        <div class="work-order-operation-hours tnum"><small>${esc(s('actualHours'))} / ${esc(s('plannedHours'))}</small>
          <b>${num(Number(operation.actualHours))}/${num(Number(operation.plannedHours))} h</b></div>
        ${cap(statusLabel(s,operation.status),operation.status==='completed'?'ok':operation.status==='blocked'?'danger':'neutral')}
      </div>`;
    }).join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage work-order-detail" data-work-order-detail="canonical">
      ${crumbs([DB.company.name,t('nav.manufacturing'),s('orders'),{cur:order.docNo}])}
      <div class="dochead"><div class="dh-row1"><div>
        <div class="dt">${ic('factory')}${esc(order.docNo)} <span class="dnum">${esc(finished.sku||'')}</span></div>
        <div class="h1sub">${esc(finished.name||s('product'))} · ${num(Number(order.plannedQty))} ${esc(finished.uom||'')}</div>
      </div><div class="dactions">${cap(statusLabel(s,order.status),statusTone(order.status))}
        ${executionActions}
      </div></div>
      <div class="work-order-progress" role="progressbar" aria-label="${esc(s('progress'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <i style="width:${pct}%"></i></div>
      <div class="docmeta">
        <div class="dm"><small>${esc(s('start'))}</small><b>${esc(dateLabel(order.startDate))}</b></div>
        <div class="dm"><small>${esc(s('due'))}</small><b>${esc(dateLabel(order.dueDate))}</b></div>
        <div class="dm"><small>${esc(s('warehouse'))}</small><b>${esc(location.code||'#'+order.warehouseId)}</b></div>
        <div class="dm"><small>${esc(s('bom'))}</small><b>${esc(version.revision||'#'+order.bomVersionId)}</b></div>
        <div class="dm"><small>${esc(s('routing'))}</small><b>${esc(routing.code||'#'+order.routingId)}</b></div>
      </div></div>
      <div class="doclayout"><div class="docmain">
        <div class="panel work-order-materials"><div class="panel-h"><h3>${esc(s('materials'))}</h3></div>
          <div class="work-order-table-scroll" role="region" aria-label="${esc(s('materials'))}" tabindex="0">
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('components'))}</th>
            <th>${esc(s('required'))}</th><th>${esc(s('issued'))}</th><th>${esc(s('available'))}</th><th>${esc(s('cost'))}</th>
          </tr></thead><tbody>${materialRows}</tbody></table></div></div>
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

  SCREENS['bom']=async function(root){
    const a=adapter(),s=mfgCopy();
    const pages=await Promise.all([
      a.list('manufacturing/boms',{limit:100}),
      a.list('manufacturing/bom-versions',{limit:100}),
      a.list('manufacturing/bom-components',{limit:100}),
      a.list('inventory/products',{limit:100}),
      a.list('manufacturing/routings',{limit:100}),
      a.list('manufacturing/routing-operations',{limit:100}),
      a.list('manufacturing/work-centers',{limit:100}),
    ]);
    const boms=pages[0].data||[],versions=pages[1].data||[];
    const version=versions.find(row=>row.status==='active')||versions[0];
    const bom=version&&boms.find(row=>Number(row.id)===Number(version.bomId));
    if(!bom||!version){
      masterDetailEditorPage(root,{
        module:'manufacturing',
        route:'bom',
        title:s('bomTitle'),
        description:s('bomDescription'),
        empty:{icon:'box',title:s('bomTitle'),description:s('bomEmptyDesc')},
      });
      return;
    }
    const products=byId(pages[3].data),centers=byId(pages[6].data);
    const finished=products.get(Number(bom.productId))||{};
    const components=(pages[2].data||[]).filter(row=>Number(row.bomVersionId)===Number(version.id))
      .sort((x,y)=>Number(x.lineNo)-Number(y.lineNo));
    const routing=(pages[4].data||[]).find(row=>Number(row.productId)===Number(bom.productId)&&row.status==='active');
    const operations=(pages[5].data||[]).filter(row=>Number(row.routingId)===Number(routing&&routing.id))
      .sort((x,y)=>Number(x.sequence)-Number(y.sequence));
    const rolled=components.reduce((sum,line)=>{
      const item=products.get(Number(line.productId))||{};
      return sum+Number(line.qtyPer)*Number(item.standardCost||0)*(1+Number(line.scrapPct||0)/100);
    },0);
    const componentRows=components.map((line,index)=>{
      const item=products.get(Number(line.productId))||{};
      return `<tr><td class="lineno">${index+1}</td><td class="l li-name"><b>${esc(item.name||'#'+line.productId)}</b>
        <small>${esc(item.sku||'')} · ${esc(item.uom||'')}</small></td>
        <td class="tnum">${num(Number(line.qtyPer))}</td><td class="tnum">${num(Number(line.scrapPct))}%</td>
        <td class="tnum">${money(Number(item.standardCost||0))}</td></tr>`;
    }).join('');
    const operationRows=operations.map(operation=>{
      const center=centers.get(Number(operation.workCenterId))||{};
      return `<div class="oprow"><span class="opseq">${operation.sequence}</span>
        <div class="opmain"><b>${esc(operation.name)}</b><small>${esc(center.code||'')} · ${esc(center.name||'')}</small></div>
        <div class="tnum">${esc(s('setupHours'))}: ${num(Number(operation.setupHours))} h · ${esc(s('runHours'))}: ${num(Number(operation.runHoursPerUnit))} h</div>
      </div>`;
    }).join('');
    const componentsBody=componentRows
      ? `<div class="master-detail-editor-table-scroll"><table class="lines"><thead><tr>
          <th class="lineno">#</th><th class="l">${esc(s('product'))}</th>
          <th>${esc(s('qtyPer'))}</th><th>${esc(s('scrap'))}</th><th>${esc(s('cost'))}</th>
        </tr></thead><tbody>${componentRows}</tbody></table></div>`
      : `<div class="master-detail-editor-inline-empty" data-master-detail-components-empty>${ic('box')}<span>${esc(s('noComponents'))}</span></div>`;
    const routingBody=operationRows
      ? `<div class="panel-body" style="padding:6px 0">${operationRows}</div>`
      : `<div class="master-detail-editor-inline-empty" data-master-detail-routing-empty>${ic('flow')}<span>${esc(s('noRouting'))}</span></div>`;
    masterDetailEditorPage(root,{
      module:'manufacturing',
      route:'bom',
      title:s('bomTitle'),
      description:s('bomDescription'),
      status:{label:bomStatusLabel(s,version.status),tone:version.status==='active'?'ok':'neutral'},
      overview:{
        title:finished.name||bom.name||bom.code,
        code:[bom.code,finished.sku].filter(Boolean).join(' · '),
        facts:[
          {label:s('revision'),value:version.revision||'—'},
          {label:s('effective'),value:dateLabel(version.effectiveFrom)},
          {label:s('output'),value:`${num(Number(version.outputQty))} ${version.uom||''}`,numeric:true},
        ],
      },
      main:`
        <div class="panel"><div class="panel-h"><h3>${esc(s('components'))}</h3></div>${componentsBody}</div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('routingTitle'))}</h3></div>${routingBody}</div>`,
      context:{
        title:s('costContext'),
        body:`
          <div class="sumrow total"><span class="sk2">${esc(s('rolled'))}</span><span class="sv tnum">${money(rolled)}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('output'))}</span><span class="sv tnum">${num(Number(version.outputQty))} ${esc(version.uom||'')}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('routing'))}</span><span class="sv">${esc(routing&&routing.code||'—')}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('componentCount'))}</span><span class="sv tnum">${components.length}</span></div>`,
      },
    });
  };

  SCREENS['mrp']=async function(root){
    const a=adapter(),s=mfgCopy();
    const [runPage,suggestionPage,productPage]=await Promise.all([
      a.list('manufacturing/mrp-runs',{limit:100}),
      a.list('manufacturing/mrp-suggestions',{limit:100}),
      a.list('inventory/products',{limit:100}),
    ]);
    const runs=(runPage.data||[]).sort((x,y)=>Number(y.id)-Number(x.id));
    const run=runs[0];
    const products=byId(productPage.data);
    const suggestions=(suggestionPage.data||[]).filter(row=>run&&Number(row.mrpRunId)===Number(run.id));
    const shortageCount=suggestions.filter(row=>row.action==='purchase').length;
    const rows=suggestions.map(row=>{
      const item=products.get(Number(row.productId))||{};
      return `<tr><td class="l li-name"><b>${esc(item.name||'#'+row.productId)}</b><small>${esc(item.sku||'')}</small></td>
        <td class="tnum">${num(Number(row.grossRequirement))}</td><td class="tnum">${num(Number(row.onHand))}</td>
        <td class="tnum">${num(Number(row.onOrder))}</td>
        <td class="tnum ${Number(row.netRequirement)>0?'neg':'pos'}">${num(Number(row.netRequirement))}</td>
        <td>${cap(row.action==='purchase'?s('purchase'):s('sufficient'),row.action==='purchase'?'danger':'ok')}</td></tr>`;
    }).join('');
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.manufacturing'),s('mrpTitle')])}
        <div class="h1row"><h1>${esc(s('mrpTitle'))}</h1>${run?cap(statusLabel(s,run.status),'ok'):''}
          <div class="headright"><div class="kfig"><small>${esc(s('purchase'))}</small><b>${shortageCount}</b></div>
            ${btn(s('runMrp'),{icon:'chart',cls:'primary',attrs:'data-run-mrp'})}</div></div>
        ${run?`<div class="h1sub">${esc(run.docNo)} · ${esc(s('planningDate'))} ${esc(dateLabel(run.planningDate))}</div>`:''}
      </div>
      ${run?`<div class="panel"><div class="panel-h"><h3>${esc(s('suggestions'))}</h3></div>
        <table class="lines"><thead><tr><th class="l">${esc(s('product'))}</th><th>${esc(s('gross'))}</th>
          <th>${esc(s('onHand'))}</th><th>${esc(s('onOrder'))}</th><th>${esc(s('net'))}</th><th>${esc(s('action'))}</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`:
        `<div class="statepanel empty">${ic('chart')}<h3>${esc(s('noRun'))}</h3><p>${esc(s('emptyDesc'))}</p></div>`}
    </section></div>`;
    root.querySelector('[data-run-mrp]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      const horizon=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
      button.disabled=true;
      try{
        await a.create('manufacturing/mrp-runs',{
          docNo:`MRP-${runs.length+1}`,planningDate:horizon,
        });
        toast(s('runComplete'),'ok');
        await navigate('mrp');
      }catch(error){
        button.disabled=false;
        toast(error&&error.message||'MRP run failed','danger');
      }
    });
  };
})();
