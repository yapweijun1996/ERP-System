/* ============================================================
   ARIA ERP — canonical warehouse picking
   Reads and writes only through ErpSystemData. No prototype pick list is used.
   ============================================================ */
SCREENS['picking'] = async function(root){
  const adapter=window.ErpSystemData;
  if(!adapter) throw new Error('ERP data adapter is unavailable.');
  const pages=await Promise.all([
    adapter.list('warehouse/picks',{limit:100}),
    adapter.list('warehouse/pick-lines',{limit:100}),
    adapter.list('inventory/products',{limit:100}),
    adapter.list('inventory/bins',{limit:100}),
    adapter.list('inventory/warehouses',{limit:100}),
  ]);
  const [pickPage,linePage,productPage,binPage,warehousePage]=pages;
  const picks=pickPage.data||[];
  const pick=picks.find(row=>row.status==='open'||row.status==='in_progress')||
    picks.slice().sort((a,b)=>Number(b.id)-Number(a.id))[0];
  const productById=new Map((productPage.data||[]).map(row=>[Number(row.id),row]));
  const binById=new Map((binPage.data||[]).map(row=>[Number(row.id),row]));
  const warehouseById=new Map((warehousePage.data||[]).map(row=>[Number(row.id),row]));

  const COPY={
    en:{
      title:'Warehouse picking', queue:'Pick queue', empty:'No canonical pick tasks are available.',
      emptyDesc:'Create a warehouse pick through the API or a released sales order.',
      assigned:'Assigned to', unassigned:'Unassigned', date:'Pick date', warehouse:'Warehouse',
      order:'Sales order', noOrder:'Not linked', progress:'Progress', lines:'lines complete',
      units:'units', bin:'Bin', picked:'Picked', remaining:'Remaining',
      confirm:'Confirm pick', next:'Pick next line', complete:'Complete pick',
      completed:'Pick completed', recorded:'Pick quantity recorded',
      fullyPicked:'All lines are fully picked. Complete the task to issue inventory.',
      issued:'Inventory was issued and the reservation was consumed atomically.',
      reserved:'Reserved inventory is issued only when the whole pick is completed.',
      status:'Status', priority:'Priority', dataLimit:'Showing the first 100 canonical rows per resource.',
      statusOpen:'Open', statusProgress:'In progress', statusPicked:'Picked', statusCancelled:'Cancelled',
      priorityLow:'Low', priorityNormal:'Normal', priorityHigh:'High', priorityUrgent:'Urgent',
      retry:'Retry', actionFailed:'The warehouse action could not be completed.',
    },
    ms:{
  "title": "Pungutan gudang",
  "queue": "Barisan pungutan",
  "empty": "Tiada tugas pungutan kanonik tersedia.",
  "emptyDesc": "Cipta pungutan gudang melalui API atau pesanan jualan yang dilepaskan.",
  "assigned": "Ditugaskan kepada",
  "unassigned": "Belum ditugaskan",
  "date": "Tarikh pungutan",
  "warehouse": "Gudang",
  "order": "Pesanan jualan",
  "noOrder": "Tidak dipautkan",
  "progress": "Kemajuan",
  "lines": "baris selesai",
  "units": "unit",
  "bin": "Tong sampah",
  "picked": "Dipungut",
  "remaining": "Baki",
  "confirm": "Sahkan pungutan",
  "next": "Pungut baris seterusnya",
  "complete": "Selesaikan pungutan",
  "completed": "Pungutan selesai",
  "recorded": "Kuantiti pungutan direkodkan",
  "fullyPicked": "Semua baris telah dipungut. Selesaikan tugas untuk mengeluarkan inventori.",
  "issued": "Inventori telah dikeluarkan dan tempahan digunakan secara atomik.",
  "reserved": "Inventori ditempah hanya dikeluarkan apabila seluruh pungutan selesai.",
  "status": "Status",
  "priority": "Keutamaan",
  "dataLimit": "Menunjukkan 100 baris kanonik pertama bagi setiap sumber.",
  "statusOpen": "Terbuka",
  "statusProgress": "Sedang dipungut",
  "statusPicked": "Dipungut",
  "statusCancelled": "Dibatalkan",
  "priorityLow": "Rendah",
  "priorityNormal": "Biasa",
  "priorityHigh": "Tinggi",
  "priorityUrgent": "Segera",
  "retry": "Cuba lagi",
  "actionFailed": "Tindakan gudang tidak dapat diselesaikan."
},
    zh:{
      title:'仓库拣货', queue:'拣货队列', empty:'目前没有标准拣货任务。',
      emptyDesc:'请通过 API 或已释放的销售订单创建仓库拣货任务。',
      assigned:'负责人', unassigned:'未分配', date:'拣货日期', warehouse:'仓库',
      order:'销售订单', noOrder:'未关联', progress:'进度', lines:'行已完成',
      units:'单位', bin:'库位', picked:'已拣', remaining:'剩余',
      confirm:'确认拣货', next:'拣下一行', complete:'完成拣货',
      completed:'拣货已完成', recorded:'拣货数量已记录',
      fullyPicked:'所有行均已拣齐。完成任务后才会正式扣减库存。',
      issued:'库存已出库，预留也已在同一事务中核销。',
      reserved:'预留库存只会在整个拣货任务完成时正式出库。',
      status:'状态', priority:'优先级', dataLimit:'每项资源显示前 100 条标准记录。',
      statusOpen:'待拣', statusProgress:'拣货中', statusPicked:'已拣完', statusCancelled:'已取消',
      priorityLow:'低', priorityNormal:'普通', priorityHigh:'高', priorityUrgent:'紧急',
      retry:'重试', actionFailed:'无法完成仓库操作。',
    },
    ja:{
      title:'倉庫ピッキング', queue:'ピッキング作業', empty:'標準ピッキングタスクはありません。',
      emptyDesc:'API またはリリース済み受注から倉庫ピッキングを作成してください。',
      assigned:'担当者', unassigned:'未割当', date:'ピッキング日', warehouse:'倉庫',
      order:'受注', noOrder:'未連携', progress:'進捗', lines:'行完了',
      units:'単位', bin:'棚番', picked:'ピッキング済み', remaining:'残数',
      confirm:'ピッキング確認', next:'次の行をピッキング', complete:'ピッキング完了',
      completed:'ピッキングを完了しました', recorded:'ピッキング数量を記録しました',
      fullyPicked:'全行のピッキングが完了しました。タスクを完了して在庫を出庫してください。',
      issued:'在庫を出庫し、引当を同一トランザクションで消費しました。',
      reserved:'引当在庫はピッキング全体の完了時にのみ出庫されます。',
      status:'ステータス', priority:'優先度', dataLimit:'各リソースの先頭100件の標準データを表示しています。',
      statusOpen:'未着手', statusProgress:'作業中', statusPicked:'完了', statusCancelled:'キャンセル済み',
      priorityLow:'低', priorityNormal:'通常', priorityHigh:'高', priorityUrgent:'緊急',
      retry:'再試行', actionFailed:'倉庫操作を完了できませんでした。',
    },
    vi:{
      title:'Soạn hàng kho', queue:'Công việc soạn hàng', empty:'Không có tác vụ soạn hàng chuẩn.',
      emptyDesc:'Tạo phiếu soạn hàng qua API hoặc từ đơn bán hàng đã phát hành.',
      assigned:'Người phụ trách', unassigned:'Chưa phân công', date:'Ngày soạn', warehouse:'Kho',
      order:'Đơn bán hàng', noOrder:'Chưa liên kết', progress:'Tiến độ', lines:'dòng hoàn tất',
      units:'đơn vị', bin:'Vị trí', picked:'Đã soạn', remaining:'Còn lại',
      confirm:'Xác nhận soạn', next:'Soạn dòng tiếp theo', complete:'Hoàn tất soạn hàng',
      completed:'Đã hoàn tất soạn hàng', recorded:'Đã ghi nhận số lượng soạn',
      fullyPicked:'Tất cả dòng đã được soạn đủ. Hoàn tất tác vụ để xuất kho.',
      issued:'Hàng đã được xuất và phần giữ chỗ được sử dụng trong cùng giao dịch.',
      reserved:'Hàng giữ chỗ chỉ được xuất khi toàn bộ tác vụ soạn hàng hoàn tất.',
      status:'Trạng thái', priority:'Ưu tiên', dataLimit:'Hiển thị 100 bản ghi chuẩn đầu tiên của mỗi tài nguyên.',
      statusOpen:'Mở', statusProgress:'Đang soạn', statusPicked:'Đã soạn', statusCancelled:'Đã hủy',
      priorityLow:'Thấp', priorityNormal:'Bình thường', priorityHigh:'Cao', priorityUrgent:'Khẩn cấp',
      retry:'Thử lại', actionFailed:'Không thể hoàn tất thao tác kho.',
    },
  };
  const copy=i18nLegacy(COPY);
  const s=key=>copy[key]||COPY.en[key]||key;
  const company=DB.company&&DB.company.name||'Company';
  const statusLabel={
    open:s('statusOpen'),in_progress:s('statusProgress'),
    picked:s('statusPicked'),cancelled:s('statusCancelled'),
  };
  const priorityLabel={
    low:s('priorityLow'),normal:s('priorityNormal'),
    high:s('priorityHigh'),urgent:s('priorityUrgent'),
  };

  if(!pick){
    operationalWorkspacePage(root,{
      module:'warehouse',
      route:'picking',
      active:'picking',
      title:s('title'),
      description:s('emptyDesc'),
      crumb:[company,t('nav.warehouse'),{cur:s('queue')}],
      progress:{
        label:s('progress'),
        value:'0%',
        percent:0,
        meta:`0/0 ${s('lines')}`,
      },
      empty:{
        icon:'warehouse',
        title:s('empty'),
        description:s('emptyDesc'),
      },
      context:{
        title:s('queue'),
        body:`<p class="operational-workspace-context-note">${esc(s('dataLimit'))}</p>`,
      },
    });
    return;
  }

  const lines=(linePage.data||[])
    .filter(row=>Number(row.pickId)===Number(pick.id))
    .sort((a,b)=>Number(a.lineNo)-Number(b.lineNo))
    .map(row=>{
      const item=productById.get(Number(row.productId))||{};
      const bin=binById.get(Number(row.binId))||{};
      return {
        ...row,
        sku:item.sku||`#${row.productId}`,
        name:item.name||`Product #${row.productId}`,
        bin:bin.code||`#${row.binId}`,
        required:Number(row.requiredQty),
        picked:Number(row.pickedQty),
      };
    });
  const required=lines.reduce((sum,line)=>sum+line.required,0);
  const picked=lines.reduce((sum,line)=>sum+line.picked,0);
  const progress=required?Math.round(picked/required*100):0;
  const completeLines=lines.filter(line=>line.picked>=line.required).length;
  const allPicked=lines.length>0&&completeLines===lines.length;
  const locked=pick.status==='picked'||pick.status==='cancelled';
  const activeLine=lines.find(line=>line.picked<line.required);
  const location=warehouseById.get(Number(pick.warehouseId));
  const statusTone=pick.status==='picked'?'ok':pick.status==='cancelled'?'danger':
    pick.status==='in_progress'?'warn':'accent';
  const lineRows=lines.map(line=>{
    const done=line.picked>=line.required;
    const active=activeLine&&Number(activeLine.id)===Number(line.id);
    return `<div class="pickrow ${done?'done':''} ${active?'active':''}">
      <div class="pick-check">${done?ic('check'):ic('box')}</div>
      <div class="pick-bin">${esc(line.bin)}</div>
      <div class="pick-item"><b>${esc(line.name)}</b>
        <small>${esc(line.sku)} · ${esc(s('bin'))} ${esc(line.bin)}</small></div>
      <div class="pick-qty"><b class="tnum">${num(line.picked)}/${num(line.required)}</b>
        <small>${esc(line.uom)} · ${esc(s('picked'))}</small></div>
      ${done?cap(s('picked'),'ok'):btn(active?s('confirm'):s('next'),{
        icon:'check',cls:active?'primary':'soft',
        attrs:`data-pick-line="${line.id}" data-pick-qty="${line.required-line.picked}"`,
      })}
    </div>`;
  }).join('');

  const contextBody=`
    <div class="field"><span class="k">${esc(s('warehouse'))}</span>
      <span class="v">${esc(location?`${location.code} · ${location.name}`:`#${pick.warehouseId}`)}</span></div>
    <div class="field"><span class="k">${esc(s('order'))}</span>
      <span class="v">${pick.salesOrderId?`#${esc(String(pick.salesOrderId))}`:esc(s('noOrder'))}</span></div>
    <div class="field"><span class="k">${esc(s('priority'))}</span>
      <span class="v">${cap(priorityLabel[pick.priority]||pick.priority,pick.priority==='high'||pick.priority==='urgent'?'danger':'neutral')}</span></div>
    <div class="field"><span class="k">${esc(s('status'))}</span>
      <span class="v">${cap(statusLabel[pick.status]||pick.status,statusTone)}</span></div>
    <div class="sectitle">${esc(s('remaining'))}</div>
    <p class="operational-workspace-context-note">
      ${esc(locked&&pick.status==='picked'?s('issued'):allPicked?s('fullyPicked'):s('reserved'))}</p>
    <p class="operational-workspace-data-limit">${esc(s('dataLimit'))}</p>`;
  const actions=locked?'':`
    <span class="operational-workspace-action-note hideonsmall">
      ${completeLines}/${lines.length} ${esc(s('lines'))} ·
      ${num(picked)}/${num(required)} ${esc(s('units'))}
    </span>
    <div class="grow"></div>
    ${activeLine?btn(s('next'),{
      icon:'scan',cls:'soft',
      attrs:`data-pick-line="${activeLine.id}" data-pick-qty="${activeLine.required-activeLine.picked}"`,
    }):''}
    ${btn(s('complete'),{
      icon:'check',cls:allPicked?'ok-solid':'primary',sm:false,
      attrs:`data-complete-pick="${pick.id}" ${allPicked?'':'disabled aria-disabled="true"'}`,
    })}`;
  operationalWorkspacePage(root,{
    module:'warehouse',
    route:'picking',
    active:'picking',
    title:`${s('title')} ${pick.docNo}`,
    description:`${s('assigned')} ${pick.assignee||s('unassigned')} · ${s('date')} ${dateLabel(pick.pickDate)}`,
    crumb:[company,t('nav.warehouse'),s('queue'),{cur:pick.docNo}],
    status:{label:statusLabel[pick.status]||pick.status,tone:statusTone},
    progress:{
      label:s('progress'),
      value:`${progress}%`,
      percent:progress,
      meta:`${completeLines}/${lines.length} ${s('lines')} · ${num(picked)}/${num(required)} ${s('units')}`,
    },
    main:lineRows||`<div class="statepanel empty operational-workspace-empty">
      ${ic('box')}<h3>${esc(s('empty'))}</h3></div>`,
    context:{title:s('queue'),body:contextBody},
    actions,
  });

  async function runAction(button,operation){
    const errorRoot=root.querySelector('[data-workspace-error]');
    if(errorRoot){
      errorRoot.hidden=true;
      errorRoot.innerHTML='';
    }
    button.disabled=true;
    try{
      await operation();
      if(root.isConnected&&CURRENT_ROUTE==='picking') await navigate('picking');
    }catch(error){
      button.disabled=false;
      const message=error&&error.message||s('actionFailed');
      if(errorRoot&&root.isConnected&&CURRENT_ROUTE==='picking'){
        errorRoot.hidden=false;
        errorRoot.innerHTML=`<div><b>${esc(s('actionFailed'))}</b><span>${esc(message)}</span></div>
          ${btn(s('retry'),{icon:'refresh',cls:'soft',attrs:'data-workspace-retry'})}`;
        errorRoot.querySelector('[data-workspace-retry]')?.addEventListener('click',event=>{
          runAction(event.currentTarget,operation);
        });
      }
      toast(message,'danger');
    }
  }
  root.querySelectorAll('[data-pick-line]').forEach(button=>button.addEventListener('click',()=>{
    const lineId=Number(button.dataset.pickLine);
    const qty=Number(button.dataset.pickQty);
    runAction(button,async()=>{
      await adapter.action(
        'warehouse/picks',pick.id,'pick-line',{lineId,qty},
        `pick-line-${pick.id}-${lineId}-${String(lines.find(line=>Number(line.id)===lineId)?.picked||0)}`,
      );
      toast(s('recorded'),'ok');
    });
  }));
  root.querySelector('[data-complete-pick]')?.addEventListener('click',event=>{
    const button=event.currentTarget;
    runAction(button,async()=>{
      await adapter.action(
        'warehouse/picks',pick.id,'complete',{},`complete-pick-${pick.id}`,
      );
      toast(s('completed'),'ok');
    });
  });
};
