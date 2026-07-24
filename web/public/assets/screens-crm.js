/* ============================================================
   ARIA ERP — screens: CRM (pipeline, opportunity, customer 360)
   ============================================================ */

function crmStageTone(st){
  return {Lead:'neutral',Qualified:'info',Proposal:'accent',Negotiation:'warn',Won:'ok',Lost:'danger'}[st]||'neutral';
}
function crmStageColor(st){
  return {Lead:'var(--muted)',Qualified:'var(--accent)',Proposal:'var(--teal)',Negotiation:'var(--warn)',Won:'var(--ok)'}[st]||'var(--muted)';
}

function crmNumber(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

/* Canonical CRM presentation model. Customers, opportunities and conversion
   stock choices come from the same bounded resource contract in Demo/API.
   Joins below are display-only; create and conversion remain shared domain
   commands executed by the adapter/server transaction. */
async function prepareCanonicalCrmData(){
  const adapter=window.ErpSystemData;
  if(adapter&&adapter.mode==='fallback'){
    if(Array.isArray(DB.pipeline)&&Array.isArray(DB.customers)&&Array.isArray(DB.items)) return;
    throw new Error('The offline canonical CRM snapshot is unavailable.');
  }
  const pages=await Promise.all([
    listPage('crm/customers'),
    listPage('crm/opportunities'),
    listPage('inventory/products'),
    listPage('inventory/warehouses'),
    listPage('inventory/stock-levels'),
  ]);
  const [customers,opportunities,products,warehouses,stockLevels]=pages.map(page=>page.data);
  const customerById=new Map(customers.map(row=>[row.id,row]));
  const onHandByProduct=new Map();
  stockLevels.forEach(row=>{
    onHandByProduct.set(
      row.productId,
      (onHandByProduct.get(row.productId)||0)+crmNumber(row.qty),
    );
  });

  DB.customers=customers.map(row=>({
    id:row.id,
    code:row.code,
    name:row.name,
    terms:'—',
    limit:0,
    balance:0,
    overdue:0,
    status:'Active',
  }));
  DB.crmWarehouses=warehouses.map(row=>({
    id:row.id,code:row.code,name:row.name,
  }));
  DB.items=products.map(row=>({
    id:row.id,
    sku:row.sku,
    name:row.name,
    uom:row.uom,
    cost:crmNumber(row.standardCost),
    onHand:onHandByProduct.get(row.id)||0,
    alloc:0,
    status:(onHandByProduct.get(row.id)||0)>0?'In stock':'No stock',
  }));
  DB.crmCanonical={customers,opportunities};

  const stageUi={lead:'Lead',qualified:'Qualified',proposal:'Proposal',negotiation:'Negotiation',won:'Won'};
  DB.pipeline=Object.keys(stageUi).map(stage=>{
    const items=opportunities.filter(row=>row.stage===stage).map(row=>{
      const customer=customerById.get(row.customerId)||{};
      const ownerName=DB.user&&DB.user.name||'Unassigned';
      return {
        id:row.id,
        version:row.version,
        no:row.docNo,
        cust:customer.name||`Customer #${row.customerId}`,
        custCode:customer.code||'—',
        customerId:row.customerId,
        title:row.title,
        value:crmNumber(row.value),
        currency:row.currency,
        owner:ownerName,
        ownerImageUrl:(DB.user&&(DB.user.avatarUrl||DB.user.imageUrl||DB.user.photoUrl))||'',
        close:dateValue(row.closeDate),
        prob:crmNumber(row.probability),
        rawStage:row.stage,
        orderId:row.orderId,
        createdAt:row.createdAt,
        updatedAt:row.updatedAt,
      };
    });
    return {stage:stageUi[stage],items};
  });
  DB.crmReadMeta={
    truncated:pages.some(page=>Boolean(page.nextCursor)),
    nextCursors:pages.map(page=>page.nextCursor),
  };
}

/* ---------------- SALES PIPELINE (kanban — module landing) ---------------- */
SCREENS['crm-pipeline'] = async function(root){
  await prepareCanonicalCrmData();
  const total=DB.pipeline.reduce((s,c)=>s+c.items.reduce((a,o)=>a+o.value,0),0);
  const weighted=DB.pipeline.reduce((s,c)=>s+c.items.reduce((a,o)=>a+o.value*o.prob/100,0),0);
  const openCount=DB.pipeline.filter(c=>c.stage!=='Won').reduce((s,c)=>s+c.items.length,0);
  const won=DB.pipeline.find(c=>c.stage==='Won');
  const wonVal=won?won.items.reduce((a,o)=>a+o.value,0):0;

  const cols=DB.pipeline.map(col=>{
    const cv=col.items.reduce((a,o)=>a+o.value,0);
    const cards=col.items.map(o=>`<div class="kcard ${o.hot?'hot':''}" data-opp="${esc(o.no)}" data-id="${o.id}">
        <div class="kc-cust">${ic('handshake')}${esc(o.cust)}${o.warn?` · <span style="color:var(--warn)" data-tip="${esc(o.warn)}">⚠</span>`:''}</div>
        <div class="kc-title">${esc(o.title)}</div>
        <div class="kc-val">${money0(o.value)}</div>
        <div class="kprob"><i style="width:${o.prob}%;background:${crmStageColor(col.stage)}"></i></div>
        <div class="kc-foot">
          ${profileAvatar({name:o.owner||o.ownerName||'Opportunity owner',src:o.ownerImageUrl||o.avatarUrl,size:22})}
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
    navigate('opportunity',{opportunityId:Number(c.dataset.id)});
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
function crmOpportunityCopy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      pipeline:'Pipeline',customer360:'Customer 360',value:'Value',probability:'Probability',expectedClose:'Expected close',age:'Age',owner:'Owner',days:'days',
      nextActions:'Next actions',closeOverdue:'Expected close is overdue',closeDue:'Expected close in {days} days',closeToday:'Expected close is today',
      openGuidance:'Keep the next activity current before converting this opportunity.',wonGuidance:'This opportunity was converted to a sales order.',lostGuidance:'This opportunity is closed as lost.',
      activityTimeline:'Activity timeline',noActivity:'No activity has been logged for this opportunity.',dealValue:'Deal value',weighted:'Weighted',stage:'Stage',
      primaryContact:'Primary contact',noContact:'No customer contact is on file.',name:'Name',role:'Role',email:'Email',phone:'Phone',related:'Related',customer:'Customer',salesOrder:'Sales order',
      logActivity:'Log activity',markLost:'Mark lost',convert:'Convert to sales order',viewOrder:'View sales order',openFooter:'Converting creates and confirms a real sales order.',wonFooter:'Converted opportunity',lostFooter:'Closed opportunity',
      cancel:'Cancel',type:'Type',note:'Note',call:'Call',details:'Details',activityPlaceholder:'What happened?',activityRequired:'Activity details are required.',activityLogged:'Activity logged.',activitySaveError:'Activity could not be saved.',
      lossReason:'Loss reason',lossPlaceholder:'e.g. Budget withdrawn or competitor selected',lossRequired:'A loss reason is required.',markLostConfirm:'Mark opportunity lost',markedLost:'Opportunity marked lost.',markLostError:'Opportunity could not be marked lost.',
      convertTitle:'Convert to sales order',item:'Item',qty:'Qty',unitPrice:'Unit price',convertConfirm:'Convert',noItems:'No items available to convert against',productWarehouseRequired:'A product and warehouse are required for conversion.',converted:'{no} converted — {order} created · {total}',
    },
    ms:{
      pipeline:'Saluran jualan',customer360:'Paparan Pelanggan 360',value:'Nilai',probability:'Kebarangkalian',expectedClose:'Tarikh tutup dijangka',age:'Umur',owner:'Pemilik',days:'hari',
      nextActions:'Tindakan seterusnya',closeOverdue:'Tarikh tutup dijangka telah lewat',closeDue:'Tarikh tutup dalam {days} hari',closeToday:'Tarikh tutup ialah hari ini',
      openGuidance:'Pastikan aktiviti seterusnya dikemas kini sebelum menukar peluang ini.',wonGuidance:'Peluang ini telah ditukar kepada pesanan jualan.',lostGuidance:'Peluang ini ditutup sebagai gagal.',
      activityTimeline:'Garis masa aktiviti',noActivity:'Belum ada aktiviti direkodkan untuk peluang ini.',dealValue:'Nilai peluang',weighted:'Berwajaran',stage:'Peringkat',
      primaryContact:'Kenalan utama',noContact:'Tiada kenalan pelanggan direkodkan.',name:'Nama',role:'Peranan',email:'E-mel',phone:'Telefon',related:'Berkaitan',customer:'Pelanggan',salesOrder:'Pesanan jualan',
      logActivity:'Log aktiviti',markLost:'Tanda gagal',convert:'Tukar kepada pesanan jualan',viewOrder:'Lihat pesanan jualan',openFooter:'Penukaran mencipta dan mengesahkan pesanan jualan sebenar.',wonFooter:'Peluang telah ditukar',lostFooter:'Peluang ditutup',
      cancel:'Batal',type:'Jenis',note:'Nota',call:'Panggilan',details:'Butiran',activityPlaceholder:'Apa yang berlaku?',activityRequired:'Butiran aktiviti diperlukan.',activityLogged:'Aktiviti direkodkan.',activitySaveError:'Aktiviti tidak dapat disimpan.',
      lossReason:'Sebab gagal',lossPlaceholder:'cth. Bajet ditarik balik atau pesaing dipilih',lossRequired:'Sebab gagal diperlukan.',markLostConfirm:'Tanda peluang gagal',markedLost:'Peluang ditanda gagal.',markLostError:'Peluang tidak dapat ditanda gagal.',
      convertTitle:'Tukar kepada pesanan jualan',item:'Item',qty:'Kuantiti',unitPrice:'Harga unit',convertConfirm:'Tukar',noItems:'Tiada item tersedia untuk penukaran',productWarehouseRequired:'Produk dan gudang diperlukan untuk penukaran.',converted:'{no} ditukar — {order} dicipta · {total}',
    },
    zh:{
      pipeline:'销售管道',customer360:'客户 360',value:'金额',probability:'成交概率',expectedClose:'预计成交日',age:'商机天数',owner:'负责人',days:'天',
      nextActions:'下一步行动',closeOverdue:'预计成交日已逾期',closeDue:'预计 {days} 天后成交',closeToday:'预计今天成交',
      openGuidance:'转换商机前，请保持下一项活动为最新状态。',wonGuidance:'此商机已转换为销售订单。',lostGuidance:'此商机已结案为失败。',
      activityTimeline:'活动时间线',noActivity:'此商机暂无活动记录。',dealValue:'商机金额',weighted:'加权金额',stage:'阶段',
      primaryContact:'主要联系人',noContact:'客户暂无联系人。',name:'姓名',role:'职务',email:'邮箱',phone:'电话',related:'相关记录',customer:'客户',salesOrder:'销售订单',
      logActivity:'记录活动',markLost:'标记失败',convert:'转换为销售订单',viewOrder:'查看销售订单',openFooter:'转换后会创建并确认真实销售订单。',wonFooter:'已转换商机',lostFooter:'已关闭商机',
      cancel:'取消',type:'类型',note:'备注',call:'电话',details:'详情',activityPlaceholder:'发生了什么？',activityRequired:'请填写活动详情。',activityLogged:'活动已记录。',activitySaveError:'活动保存失败。',
      lossReason:'失败原因',lossPlaceholder:'例如：预算取消或选择竞争对手',lossRequired:'请填写失败原因。',markLostConfirm:'确认标记失败',markedLost:'商机已标记失败。',markLostError:'无法标记商机失败。',
      convertTitle:'转换为销售订单',item:'物料',qty:'数量',unitPrice:'单价',convertConfirm:'转换',noItems:'没有可用于转换的物料',productWarehouseRequired:'转换需要产品和仓库。',converted:'{no} 已转换 — 已创建 {order} · {total}',
    },
    ja:{
      pipeline:'パイプライン',customer360:'顧客 360',value:'金額',probability:'確度',expectedClose:'受注予定日',age:'経過日数',owner:'担当者',days:'日',
      nextActions:'次のアクション',closeOverdue:'受注予定日を過ぎています',closeDue:'受注予定まで {days} 日',closeToday:'受注予定日は本日です',
      openGuidance:'商談を変換する前に次の活動を最新にしてください。',wonGuidance:'この商談は受注に変換されました。',lostGuidance:'この商談は失注として終了しました。',
      activityTimeline:'活動履歴',noActivity:'この商談の活動はまだありません。',dealValue:'商談金額',weighted:'加重金額',stage:'ステージ',
      primaryContact:'主担当者',noContact:'顧客の連絡先が登録されていません。',name:'氏名',role:'役職',email:'メール',phone:'電話',related:'関連',customer:'顧客',salesOrder:'受注',
      logActivity:'活動を記録',markLost:'失注にする',convert:'受注に変換',viewOrder:'受注を表示',openFooter:'変換すると実際の受注が作成・確定されます。',wonFooter:'変換済み商談',lostFooter:'終了済み商談',
      cancel:'キャンセル',type:'種類',note:'メモ',call:'電話',details:'詳細',activityPlaceholder:'何がありましたか？',activityRequired:'活動の詳細を入力してください。',activityLogged:'活動を記録しました。',activitySaveError:'活動を保存できませんでした。',
      lossReason:'失注理由',lossPlaceholder:'例：予算中止、競合を選定',lossRequired:'失注理由を入力してください。',markLostConfirm:'失注として確定',markedLost:'商談を失注にしました。',markLostError:'商談を失注にできませんでした。',
      convertTitle:'受注に変換',item:'品目',qty:'数量',unitPrice:'単価',convertConfirm:'変換',noItems:'変換できる品目がありません',productWarehouseRequired:'変換には製品と倉庫が必要です。',converted:'{no} を変換 — {order} を作成 · {total}',
    },
    vi:{
      pipeline:'Cơ hội bán hàng',customer360:'Khách hàng 360',value:'Giá trị',probability:'Xác suất',expectedClose:'Ngày chốt dự kiến',age:'Số ngày',owner:'Người phụ trách',days:'ngày',
      nextActions:'Hành động tiếp theo',closeOverdue:'Đã quá ngày chốt dự kiến',closeDue:'Còn {days} ngày đến ngày chốt',closeToday:'Ngày chốt dự kiến là hôm nay',
      openGuidance:'Cập nhật hoạt động tiếp theo trước khi chuyển đổi cơ hội.',wonGuidance:'Cơ hội này đã được chuyển thành đơn bán hàng.',lostGuidance:'Cơ hội này đã đóng với trạng thái thất bại.',
      activityTimeline:'Dòng thời gian hoạt động',noActivity:'Chưa có hoạt động nào cho cơ hội này.',dealValue:'Giá trị cơ hội',weighted:'Giá trị trọng số',stage:'Giai đoạn',
      primaryContact:'Liên hệ chính',noContact:'Khách hàng chưa có liên hệ.',name:'Tên',role:'Vai trò',email:'Email',phone:'Điện thoại',related:'Liên quan',customer:'Khách hàng',salesOrder:'Đơn bán hàng',
      logActivity:'Ghi hoạt động',markLost:'Đánh dấu thất bại',convert:'Chuyển thành đơn bán hàng',viewOrder:'Xem đơn bán hàng',openFooter:'Chuyển đổi sẽ tạo và xác nhận đơn bán hàng thực.',wonFooter:'Cơ hội đã chuyển đổi',lostFooter:'Cơ hội đã đóng',
      cancel:'Hủy',type:'Loại',note:'Ghi chú',call:'Cuộc gọi',details:'Chi tiết',activityPlaceholder:'Đã xảy ra điều gì?',activityRequired:'Vui lòng nhập chi tiết hoạt động.',activityLogged:'Đã ghi hoạt động.',activitySaveError:'Không thể lưu hoạt động.',
      lossReason:'Lý do thất bại',lossPlaceholder:'vd: Hủy ngân sách hoặc chọn đối thủ',lossRequired:'Vui lòng nhập lý do thất bại.',markLostConfirm:'Xác nhận thất bại',markedLost:'Đã đánh dấu cơ hội thất bại.',markLostError:'Không thể đánh dấu cơ hội thất bại.',
      convertTitle:'Chuyển thành đơn bán hàng',item:'Mặt hàng',qty:'Số lượng',unitPrice:'Đơn giá',convertConfirm:'Chuyển đổi',noItems:'Không có mặt hàng để chuyển đổi',productWarehouseRequired:'Cần có sản phẩm và kho để chuyển đổi.',converted:'Đã chuyển {no} — tạo {order} · {total}',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

function openConvertOpportunityModal(o,onConverted){
  const s=crmOpportunityCopy();
  const items=DB.items;
  if(!items.length){ toast(s('noItems'),'warn'); return; }
  const suggestQty=(it)=>Math.max(1,Math.round(o.value/(it.cost||1)));
  appModal({
    icon:'bag', title:s('convertTitle'), width:420,
    body:`<p style="color:var(--muted);font-size:13px;margin:0 0 14px">${esc(o.title)} · ${esc(o.cust)} · ${money0(o.value)}</p>
      <div class="fld"><span>${esc(s('item'))}</span><select id="cvItem">${items.map(it=>`<option value="${esc(it.sku)}">${esc(it.sku)} · ${esc(it.name)} — ${money(it.cost)}/${esc(it.uom)}</option>`).join('')}</select></div>
      <div class="fldrow c2" style="margin-top:12px">
        <div class="fld"><span>${esc(s('qty'))}</span><input type="number" id="cvQty" min="1" value="${suggestQty(items[0])}"></div>
        <div class="fld"><span>${esc(s('unitPrice'))}</span><input type="number" id="cvPrice" min="0" step="0.01" value="${items[0].cost}"></div>
      </div>`,
    actions: btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})
      + btn(s('convertConfirm'),{icon:'check',cls:'primary',attrs:'id="cvConfirm"'}),
  });
  const itemSel=$('#cvItem'), qtyEl=$('#cvQty'), priceEl=$('#cvPrice');
  itemSel.addEventListener('change',()=>{
    const it=items.find(x=>x.sku===itemSel.value);
    qtyEl.value=suggestQty(it); priceEl.value=it.cost;
  });
  $('#cvConfirm').addEventListener('click', async ()=>{
    const adapter=window.ErpSystemData;
    if(!adapter||typeof adapter.action!=='function'){ toast('ERP data adapter not loaded','warn'); return; }
    const confirmBtn=$('#cvConfirm'); confirmBtn.disabled=true;
    try{
      const item=items.find(x=>x.sku===itemSel.value);
      const warehouse=(DB.crmWarehouses||[]).find(x=>x.code==='WH-SALES')
        ||(DB.crmWarehouses||[])[0];
      if(!item||!warehouse) throw new Error(s('productWarehouseRequired'));
      const today=new Date().toISOString().slice(0,10);
      const response=await adapter.action('crm/opportunities',o.id,'convert',{
        docNo:`SO-CRM-${o.id}`,
        orderDate:today,
        lines:[{
          productId:item.id,
          warehouseId:warehouse.id,
          qty:Math.max(1,+qtyEl.value||1),
          unitPrice:Math.max(0,+priceEl.value||0),
          taxCode:DB.company&&DB.company.taxRegime==='SST'?'SV':'SR',
        }],
      },`crm-convert-${o.id}`);
      const res=response.data||{};
      closeModal();
      if(typeof onConverted==='function') await onConverted(res);
      else navigate('crm-pipeline');
      toast(s('converted').replace('{no}',o.no).replace('{order}',`SO-CRM-${o.id}`).replace('{total}',money(res.total)),'ok');
    }catch(e){
      toast((e&&e.message)||'Convert failed','danger');
      confirmBtn.disabled=false;
    }
  });
}

/* ---------------- OPPORTUNITY (canonical document) ---------------- */
async function prepareOpportunityDetail(requestedId){
  await prepareCanonicalCrmData();
  const canonical=DB.crmCanonical||{customers:[],opportunities:[]};
  const rows=canonical.opportunities||[];
  const selected=requestedId?rows.find(row=>row.id===requestedId):rows.find(row=>!['won','lost'].includes(row.stage))||rows[0];
  if(!selected) throw new Error('No opportunity found for the active company.');
  const [activityPage,contactPage,orderPage]=await Promise.all([
    listPage('crm/activities'),listPage('crm/contacts'),listPage('sales/orders'),
  ]);
  return {
    opportunity:selected,
    customer:(canonical.customers||[]).find(row=>row.id===selected.customerId)||null,
    activities:activityPage.data.filter(row=>row.opportunityId===selected.id).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt)),
    contact:contactPage.data.find(row=>row.customerId===selected.customerId)||null,
    order:selected.orderId?orderPage.data.find(row=>row.id===selected.orderId)||null:null,
  };
}

function crmStageLabel(stage){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{lead:'Lead',qualified:'Qualified',proposal:'Proposal',negotiation:'Negotiation',won:'Won',lost:'Lost'},
    ms:{lead:'Prospek',qualified:'Layak',proposal:'Cadangan',negotiation:'Rundingan',won:'Menang',lost:'Gagal'},
    zh:{lead:'潜在线索',qualified:'已验证',proposal:'已报价',negotiation:'谈判中',won:'已成交',lost:'已失败'},
    ja:{lead:'リード',qualified:'有望',proposal:'提案',negotiation:'交渉',won:'受注',lost:'失注'},
    vi:{lead:'Tiềm năng',qualified:'Đủ điều kiện',proposal:'Đề xuất',negotiation:'Đàm phán',won:'Thành công',lost:'Thất bại'},
  };
  return (packs[lang]&&packs[lang][stage])||packs.en[stage]||stage;
}

SCREENS['opportunity'] = async function(root,params){
  const requestedId=params&&params.opportunityId?Number(params.opportunityId):null;
  let detail=await prepareOpportunityDetail(requestedId);

  function openLogActivity(){
    const s=crmOpportunityCopy();
    appModal({icon:'comment',title:s('logActivity'),width:430,
      body:`<div class="fld"><span>${esc(s('type'))}</span><select id="oppActivityKind"><option value="note">${esc(s('note'))}</option><option value="call">${esc(s('call'))}</option><option value="email">${esc(s('email'))}</option></select></div><div class="fld" style="margin-top:12px"><span>${esc(s('details'))}</span><textarea id="oppActivityBody" rows="4" placeholder="${esc(s('activityPlaceholder'))}"></textarea></div>`,
      actions:btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})+btn(s('logActivity'),{icon:'check',cls:'primary',attrs:'id="oppActivitySave"'})});
    const save=$('#oppActivitySave');
    save.addEventListener('click',async()=>{
      const body=$('#oppActivityBody').value.trim();
      if(!requireField(body,s('activityRequired'),'#oppActivityBody')) return;
      save.disabled=true;
      try{
        const d=detail.opportunity;
        await window.ErpSystemData.create('crm/activities',{opportunityId:d.id,customerId:d.customerId,kind:$('#oppActivityKind').value,body});
        closeModal(); detail=await prepareOpportunityDetail(d.id); render(); toast(s('activityLogged'),'ok');
      }catch(error){save.disabled=false;toast(error&&error.message?error.message:s('activitySaveError'),'danger');}
    });
  }

  function openMarkLost(){
    const s=crmOpportunityCopy();
    appModal({icon:'x',title:s('markLost'),width:430,
      body:`<div class="fld"><span>${esc(s('lossReason'))}</span><textarea id="oppLossReason" rows="4" placeholder="${esc(s('lossPlaceholder'))}"></textarea></div>`,
      actions:btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})+btn(s('markLostConfirm'),{icon:'x',cls:'danger',attrs:'id="oppLostSave"'})});
    const save=$('#oppLostSave');
    save.addEventListener('click',async()=>{
      const reason=$('#oppLossReason').value.trim();
      if(!requireField(reason,s('lossRequired'),'#oppLossReason')) return;
      save.disabled=true;
      try{
        const d=detail.opportunity;
        await window.ErpSystemData.action('crm/opportunities',d.id,'mark-lost',{reason},`crm-lost-${d.id}-v${d.version}`);
        closeModal(); detail=await prepareOpportunityDetail(d.id); render(); toast(s('markedLost'),'ok');
      }catch(error){save.disabled=false;toast(error&&error.message?error.message:s('markLostError'),'danger');}
    });
  }

  function render(){
    const s=crmOpportunityCopy(),d=detail.opportunity;
    const c=detail.customer||{id:d.customerId,code:'—',name:`Customer #${d.customerId}`};
    const value=crmNumber(d.value),probability=crmNumber(d.probability),stage=d.stage||'lead';
    const terminal=['won','lost'].includes(stage),stages=['lead','qualified','proposal','negotiation','won'];
    const currentIndex=stage==='lost'?-1:stages.indexOf(stage);
    const steps=stages.map((name,i)=>{const done=stage==='won'||(currentIndex>=0&&i<currentIndex),current=i===currentIndex;return `<div class="step ${done?'done':current?'current':''}"><span class="sdot">${done?ic('check'):current?ic('clock'):''}</span>${esc(crmStageLabel(name))}</div>${i<stages.length-1?`<span class="stepline ${done?'done':''}"></span>`:''}`;}).join('');
    const created=new Date(d.createdAt||Date.now()),ageDays=Math.max(0,Math.floor((Date.now()-created.getTime())/86400000));
    const today=new Date();today.setHours(0,0,0,0);
    const closeDate=new Date(`${dateValue(d.closeDate)}T00:00:00`),daysToClose=Math.ceil((closeDate.getTime()-today.getTime())/86400000);
    const closeTitle=daysToClose<0?s('closeOverdue'):daysToClose===0?s('closeToday'):s('closeDue').replace('{days}',daysToClose);
    const guidance=stage==='won'?s('wonGuidance'):stage==='lost'?s('lostGuidance'):s('openGuidance');
    const events=detail.activities.map(row=>({kind:row.kind==='system'?'sys':row.kind,when:dateValue(row.occurredAt),what:esc(row.body),who:(DB.user&&DB.user.name)||'—'}));
    const contact=detail.contact;
    const related=[detail.order?{no:detail.order.docNo,label:s('salesOrder'),meta:dateValue(detail.order.orderDate),status:crmStageLabel('won')}:null,{no:c.code||String(c.id),label:c.name,meta:s('customer360'),status:'Active'}].filter(Boolean);
    const footerHint=stage==='won'?s('wonFooter'):stage==='lost'?s('lostFooter'):s('openFooter');
    const uiOpportunity={id:d.id,no:d.docNo,title:d.title,cust:c.name,customerId:d.customerId,value,currency:d.currency,prob:probability,rawStage:stage,version:d.version};

    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,t('nav.crm'),{label:s('pipeline'),route:'crm-pipeline'},{cur:d.docNo}])}
      <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('handshake')}${esc(d.title)} <span class="dnum">${esc(d.docNo)}</span></div><div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(c.name)} · ${esc(s('owner'))} ${esc((DB.user&&DB.user.name)||'—')}</div></div><div class="dactions">${cap(crmStageLabel(stage),crmStageTone(stage.charAt(0).toUpperCase()+stage.slice(1)))}${btn(s('customer360'),{icon:'user',cls:'soft',attrs:'data-customer="1"'})}</div></div>
        <div class="stepper">${steps}</div><div class="docmeta"><div class="dm"><small>${esc(s('value'))}</small><b>${money(value)}</b></div><div class="dm"><small>${esc(s('probability'))}</small><b>${probability}%</b></div><div class="dm"><small>${esc(s('expectedClose'))}</small><b>${esc(dateValue(d.closeDate))}</b></div><div class="dm"><small>${esc(s('age'))}</small><b>${ageDays} ${esc(s('days'))}</b></div><div class="dm"><small>${esc(s('owner'))}</small><b>${esc((DB.user&&DB.user.name)||'—')}</b></div></div></div>
      <div class="appr-layout"><div class="docmain"><div class="panel"><div class="panel-h"><h3>${esc(s('nextActions'))}</h3></div><div class="panel-body" style="padding-top:12px"><div class="risk ${terminal?(stage==='won'?'ok':'danger'):(daysToClose<0?'danger':'warn')}">${ic(stage==='won'?'checkc':stage==='lost'?'x':'clock')}<div><b>${esc(terminal?crmStageLabel(stage):closeTitle)}</b><small>${esc(guidance)}</small></div></div></div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('activityTimeline'))}</h3></div><div class="panel-body">${events.length?auditTrail(events):`<div class="detail-empty">${ic('comment')}<div>${esc(s('noActivity'))}</div></div>`}</div></div></div>
        <aside><div class="sumcard" style="margin-bottom:14px"><div class="sectitle" style="margin-top:0">${esc(s('dealValue'))}</div><div class="sumrow"><span class="sk2">${esc(s('value'))}</span><span class="sv tnum">${money(value)}</span></div><div class="sumrow"><span class="sk2">${esc(s('probability'))}</span><span class="sv tnum">${probability}%</span></div><div class="sumrow total"><span class="sk2">${esc(s('weighted'))}</span><span class="sv tnum">${money(value*probability/100)}</span></div><div class="indicator ${stage==='lost'?'danger':stage==='won'?'ok':'warn'}" style="margin-top:12px"><div class="ind-top">${ic('flow')}<span>${esc(s('stage'))}</span><span class="ind-r">${esc(crmStageLabel(stage))}</span></div><div class="track"><i style="width:${probability}%"></i></div></div></div>
          <div class="sumcard" style="margin-bottom:14px"><div class="sectitle" style="margin-top:0">${esc(s('primaryContact'))}</div>${contact?`<div class="field"><span class="k">${esc(s('name'))}</span><span class="v">${esc(contact.name)}</span></div><div class="field"><span class="k">${esc(s('role'))}</span><span class="v">${esc(contact.role)}</span></div><div class="field"><span class="k">${esc(s('email'))}</span><span class="v">${esc(contact.email||'—')}</span></div><div class="field"><span class="k">${esc(s('phone'))}</span><span class="v">${esc(contact.phone||'—')}</span></div>`:`<div style="color:var(--muted);font-size:13px">${esc(s('noContact'))}</div>`}</div><div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('related'))}</div>${relatedDocs(related)}</div></aside></div>
      </div></div><div class="responsive-actionbar"><div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${esc(footerHint)}</div><div class="grow"></div>${btn(s('logActivity'),{icon:'comment',cls:'soft',attrs:'data-log="1"'})}${!terminal?btn(s('markLost'),{icon:'x',cls:'danger',attrs:'data-lost="1"'}):''}${stage==='won'&&detail.order?btn(s('viewOrder'),{icon:'bag',cls:'primary',sm:false,attrs:'data-order="1"'}):!terminal?btn(s('convert'),{icon:'bag',cls:'primary',sm:false,attrs:'data-convert-detail="1"'}):''}</div></section></div>`;
    root.querySelector('[data-customer]')?.addEventListener('click',()=>navigate('crm-customer',{customerId:c.id}));
    root.querySelector('[data-log]')?.addEventListener('click',openLogActivity);
    root.querySelector('[data-lost]')?.addEventListener('click',openMarkLost);
    root.querySelector('[data-order]')?.addEventListener('click',()=>navigate('sales-order',{no:detail.order.docNo}));
    root.querySelector('[data-convert-detail]')?.addEventListener('click',()=>openConvertOpportunityModal(uiOpportunity,async()=>{detail=await prepareOpportunityDetail(d.id);render();}));
  }
  render();
};

/* ---------------- CUSTOMER 360 (master / profile) ---------------- */
function customer360Copy(){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{
      account:'Account',paymentTerms:'Payment terms',net30:'Net 30',creditLimit:'Credit limit',notSet:'Not set',
      accountOwner:'Account owner',contacts:'Contacts',addContact:'Add contact',noContactsYet:'No contacts yet.',
      openOrders:'Open orders',noOpenOrders:'No open orders.',openOpportunities:'Open opportunities',
      noOpenOpportunities:'No open opportunities.',activity:'Activity',logActivity:'Log activity',
      noActivityYet:'No activity logged yet.',receivables:'Receivables',balance:'Balance',overdue:'Overdue',
      limitUsed:'Limit used',noCreditProfile:'No credit profile on file yet.',
      customerSince:'customer since',owner:'owner',unassigned:'Unassigned',newSalesOrder:'New sales order',
      salesOrder:'Sales order',customers:'Customers',
      nameLabel:'Name',roleLabel:'Role',emailLabel:'Email',phoneLabel:'Phone',
      namePlaceholder:'e.g. Alex Chen',rolePlaceholder:'e.g. Buyer',optional:'optional',
      nameRoleRequired:'Name and role are required',contactAdded:'Contact {name} added',
      contactSaveError:'Contact could not be saved',
      type:'Type',note:'Note',call:'Call',email:'Email',details:'Details',whatHappened:'What happened?',
      detailsRequired:'Details are required',activityLogged:'Activity logged',
      activitySaveError:'Activity could not be logged',
      limitUsedBody:'{balance} of {limit} · {overdue} overdue.',
    },
    ms:{
      account:'Akaun',paymentTerms:'Terma bayaran',net30:'Net 30 hari',creditLimit:'Had kredit',notSet:'Belum ditetapkan',
      accountOwner:'Pemilik akaun',contacts:'Kenalan',addContact:'Tambah kenalan',noContactsYet:'Belum ada kenalan.',
      openOrders:'Pesanan terbuka',noOpenOrders:'Tiada pesanan terbuka.',openOpportunities:'Peluang terbuka',
      noOpenOpportunities:'Tiada peluang terbuka.',activity:'Aktiviti',logActivity:'Log aktiviti',
      noActivityYet:'Belum ada aktiviti direkodkan.',receivables:'Belum terima',balance:'Baki',overdue:'Tertunggak',
      limitUsed:'Had digunakan',noCreditProfile:'Belum ada profil kredit.',
      customerSince:'pelanggan sejak',owner:'pemilik',unassigned:'Belum ditugaskan',newSalesOrder:'Pesanan jualan baharu',
      salesOrder:'Pesanan jualan',customers:'Pelanggan',
      nameLabel:'Nama',roleLabel:'Peranan',emailLabel:'E-mel',phoneLabel:'Telefon',
      namePlaceholder:'cth. Alex Chen',rolePlaceholder:'cth. Pembeli',optional:'pilihan',
      nameRoleRequired:'Nama dan peranan diperlukan',contactAdded:'Kenalan {name} ditambah',
      contactSaveError:'Kenalan tidak dapat disimpan',
      type:'Jenis',note:'Nota',call:'Panggilan',email:'E-mel',details:'Butiran',whatHappened:'Apa yang berlaku?',
      detailsRequired:'Butiran diperlukan',activityLogged:'Aktiviti direkodkan',
      activitySaveError:'Aktiviti tidak dapat direkodkan',
      limitUsedBody:'{balance} daripada {limit} · {overdue} tertunggak.',
    },
    zh:{
      account:'账户',paymentTerms:'付款条件',net30:'净30天',creditLimit:'信用额度',notSet:'未设置',
      accountOwner:'客户负责人',contacts:'联系人',addContact:'添加联系人',noContactsYet:'暂无联系人。',
      openOrders:'未结订单',noOpenOrders:'暂无未结订单。',openOpportunities:'未结商机',
      noOpenOpportunities:'暂无未结商机。',activity:'活动记录',logActivity:'记录活动',
      noActivityYet:'暂无活动记录。',receivables:'应收账款',balance:'余额',overdue:'逾期金额',
      limitUsed:'额度已用',noCreditProfile:'暂无信用档案。',
      customerSince:'客户始于',owner:'负责人',unassigned:'未分配',newSalesOrder:'新建销售订单',
      salesOrder:'销售订单',customers:'客户',
      nameLabel:'姓名',roleLabel:'职务',emailLabel:'邮箱',phoneLabel:'电话',
      namePlaceholder:'例如:陈伟',rolePlaceholder:'例如:采购员',optional:'选填',
      nameRoleRequired:'请填写姓名和职务',contactAdded:'联系人 {name} 已添加',
      contactSaveError:'联系人保存失败',
      type:'类型',note:'备注',call:'电话',email:'邮件',details:'详情',whatHappened:'发生了什么?',
      detailsRequired:'请填写详情',activityLogged:'活动已记录',
      activitySaveError:'活动记录失败',
      limitUsedBody:'{balance} / {limit} · 逾期 {overdue}。',
    },
    ja:{
      account:'アカウント',paymentTerms:'支払条件',net30:'掛売30日',creditLimit:'与信限度額',notSet:'未設定',
      accountOwner:'担当者',contacts:'連絡先',addContact:'連絡先を追加',noContactsYet:'連絡先はまだありません。',
      openOrders:'未完了受注',noOpenOrders:'未完了の受注はありません。',openOpportunities:'進行中の商談',
      noOpenOpportunities:'進行中の商談はありません。',activity:'アクティビティ',logActivity:'活動を記録',
      noActivityYet:'活動記録はまだありません。',receivables:'売掛金',balance:'残高',overdue:'延滞額',
      limitUsed:'与信使用率',noCreditProfile:'与信情報が未登録です。',
      customerSince:'取引開始',owner:'担当者',unassigned:'未割当',newSalesOrder:'新規受注',
      salesOrder:'受注',customers:'顧客',
      nameLabel:'氏名',roleLabel:'役職',emailLabel:'メール',phoneLabel:'電話',
      namePlaceholder:'例:山田太郎',rolePlaceholder:'例:購買担当',optional:'任意',
      nameRoleRequired:'氏名と役職を入力してください',contactAdded:'連絡先 {name} を追加しました',
      contactSaveError:'連絡先を保存できませんでした',
      type:'種類',note:'メモ',call:'電話',email:'メール',details:'詳細',whatHappened:'内容を入力してください',
      detailsRequired:'詳細を入力してください',activityLogged:'活動を記録しました',
      activitySaveError:'活動を記録できませんでした',
      limitUsedBody:'{limit} 中 {balance}(延滞 {overdue}）。',
    },
    vi:{
      account:'Tài khoản',paymentTerms:'Điều khoản thanh toán',net30:'Net 30 ngày',creditLimit:'Hạn mức tín dụng',notSet:'Chưa thiết lập',
      accountOwner:'Người phụ trách',contacts:'Liên hệ',addContact:'Thêm liên hệ',noContactsYet:'Chưa có liên hệ nào.',
      openOrders:'Đơn hàng đang mở',noOpenOrders:'Không có đơn hàng đang mở.',openOpportunities:'Cơ hội đang mở',
      noOpenOpportunities:'Không có cơ hội đang mở.',activity:'Hoạt động',logActivity:'Ghi nhận hoạt động',
      noActivityYet:'Chưa có hoạt động nào được ghi nhận.',receivables:'Công nợ phải thu',balance:'Số dư',overdue:'Quá hạn',
      limitUsed:'Hạn mức đã dùng',noCreditProfile:'Chưa có hồ sơ tín dụng.',
      customerSince:'khách hàng từ',owner:'phụ trách',unassigned:'Chưa phân công',newSalesOrder:'Tạo đơn bán hàng',
      salesOrder:'Đơn bán hàng',customers:'Khách hàng',
      nameLabel:'Tên',roleLabel:'Vai trò',emailLabel:'Email',phoneLabel:'Điện thoại',
      namePlaceholder:'vd: Nguyễn Văn A',rolePlaceholder:'vd: Nhân viên mua hàng',optional:'không bắt buộc',
      nameRoleRequired:'Vui lòng nhập tên và vai trò',contactAdded:'Đã thêm liên hệ {name}',
      contactSaveError:'Không thể lưu liên hệ',
      type:'Loại',note:'Ghi chú',call:'Cuộc gọi',email:'Email',details:'Chi tiết',whatHappened:'Đã xảy ra điều gì?',
      detailsRequired:'Vui lòng nhập chi tiết',activityLogged:'Đã ghi nhận hoạt động',
      activitySaveError:'Không thể ghi nhận hoạt động',
      limitUsedBody:'{balance} trên {limit} · quá hạn {overdue}.',
    },
  };
  const pack=packs[lang]||packs.en;
  return key=>pack[key]||packs.en[key]||key;
}

/* Fetches the bounded resource set Customer-360 needs and joins/filters it
   client-side by customerId — the demo adapter's list() ignores query filters
   entirely (it only understands cursor/limit), so server-side filtering (added
   for API mode in src/api/resources.ts) can't be relied on in both modes. */
async function prepareCustomerDetail(customerId){
  const pages=await Promise.all([
    listPage('crm/customers'),
    listPage('sales/credit-profiles'),
    listPage('crm/contacts'),
    listPage('sales/orders'),
    listPage('crm/opportunities'),
    listPage('sales/invoices'),
    listPage('crm/activities'),
  ]);
  const [customers,creditProfiles,contacts,orders,opportunities,invoices,activities]=pages.map(p=>p.data);
  const customer=customerId?customers.find(row=>row.id===customerId):customers[0];
  if(!customer) throw new Error('No customer found for the active company.');

  const creditProfile=creditProfiles.find(row=>row.customerId===customer.id)||null;
  const custInvoices=invoices.filter(row=>row.customerId===customer.id&&row.status==='unpaid');
  const asAt=new Date();
  let balance=0, overdue=0;
  custInvoices.forEach(row=>{
    const amount=crmNumber(row.totalAmount);
    balance+=amount;
    const due=new Date(`${dateValue(row.invoiceDate)}T00:00:00`);
    due.setDate(due.getDate()+30);
    if(asAt.getTime()>due.getTime()) overdue+=amount;
  });

  return {
    customer,
    creditProfile,
    contacts:contacts.filter(row=>row.customerId===customer.id),
    orders:orders.filter(row=>row.customerId===customer.id&&row.status!=='cancelled'),
    opportunities:opportunities.filter(row=>
      row.customerId===customer.id&&row.stage!=='won'&&row.stage!=='lost'),
    activities:activities.filter(row=>row.customerId===customer.id)
      .sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt)),
    balance, overdue,
  };
}

SCREENS['crm-customer'] = async function(root, params){
  const requestedId=params&&params.customerId?Number(params.customerId):null;
  let detail=await prepareCustomerDetail(requestedId);

  function render(){
    const s=customer360Copy();
    const c=detail.customer;
    const limit=detail.creditProfile?crmNumber(detail.creditProfile.creditLimit):0;
    const usedPct=limit>0?Math.round(detail.balance/limit*100):0;
    const ownerLabel=c.ownerUserId?((DB.user&&DB.user.name)||s('unassigned')):s('unassigned');
    const since=dateValue(c.createdAt);
    const notSet=s('notSet');
    const openOrders=detail.orders.map(row=>({
      no:row.docNo,label:s('salesOrder'),
      meta:`${dateValue(row.orderDate)} · ${money(crmNumber(row.totalAmount))}`,
      status:ts(row.status),
    }));
    const openOpps=detail.opportunities.map(row=>({
      no:row.docNo,label:row.title,
      meta:`${money0(crmNumber(row.value))} · ${crmNumber(row.probability)}%`,
      status:ts(row.stage),
    }));
    const activityEvents=detail.activities.map(row=>({
      kind:'sys',when:dateValue(row.occurredAt),what:esc(row.body),
      who:(DB.user&&DB.user.name)||'—',
    }));

    root.innerHTML=`<div class="content full"><section class="master"><div class="docwrap"><div class="docpage" style="max-width:960px">
      ${crumbs([DB.company.name,t('nav.crm'),s('customers'),{cur:c.code}])}
      <div class="dochead">
        <div class="dh-row1"><div><div class="dt">${ic('user')}${esc(c.name)} <span class="dnum">${esc(c.code)}</span></div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(c.industry||'—')} · ${esc(s('customerSince'))} ${esc(since)} · ${esc(s('owner'))} ${esc(ownerLabel)}</div></div>
          <div class="dactions">${cap(ts('Active'),'ok')}${btn(t('crm.newopp'),{icon:'plus',cls:'soft',attrs:'onclick="navigate(\'new-opportunity\')"'})}${btn(s('newSalesOrder'),{icon:'bag',cls:'primary',attrs:'onclick="navigate(\'sales-orders\')"'})}</div></div>
      </div>
      <div class="doclayout">
        <div class="docmain">
          <div class="panel"><div class="panel-h"><h3>${esc(s('account'))}</h3></div><div class="panel-body">
            <div class="fldrow c3">
              <div class="fld"><span>${esc(s('paymentTerms'))}</span><input value="${esc(s('net30'))}" readonly></div>
              <div class="fld"><span>${esc(s('creditLimit'))}</span><input value="${detail.creditProfile?money(limit):notSet}" readonly></div>
              <div class="fld"><span>${esc(s('accountOwner'))}</span><input value="${esc(ownerLabel)}" readonly></div>
            </div>
          </div></div>
          <div class="panel"><div class="panel-h"><h3>${esc(s('contacts'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${detail.contacts.length}</span>${btn(s('addContact'),{icon:'plus',cls:'soft',sm:true,attrs:'data-add-contact="1"'})}</div>
            <div class="panel-body" style="padding:6px 0">${detail.contacts.length?detail.contacts.map(p=>
              `<div class="oprow">${profileAvatar({name:p.name,src:p.photoUrl||p.imageUrl||p.avatarUrl,size:30})}<div class="opmain"><b>${esc(p.name)}</b><small>${esc(p.role)}${p.email?' · '+esc(p.email):''}</small></div></div>`
            ).join(''):`<div style="color:var(--muted);font-size:13px;padding:8px 0">${esc(s('noContactsYet'))}</div>`}</div>
          </div>
          <div class="panel"><div class="panel-h"><h3>${esc(s('openOrders'))}</h3></div><div class="panel-body">${openOrders.length?relatedDocs(openOrders):`<div style="color:var(--muted);font-size:13px;padding:8px 0">${esc(s('noOpenOrders'))}</div>`}</div></div>
          <div class="panel"><div class="panel-h"><h3>${esc(s('openOpportunities'))}</h3></div><div class="panel-body">${openOpps.length?relatedDocs(openOpps):`<div style="color:var(--muted);font-size:13px;padding:8px 0">${esc(s('noOpenOpportunities'))}</div>`}</div></div>
          <div class="panel"><div class="panel-h"><h3>${esc(s('activity'))}</h3><span style="margin-left:auto"></span>${btn(s('logActivity'),{icon:'comment',cls:'soft',sm:true,attrs:'data-log-activity="1"'})}</div><div class="panel-body">${activityEvents.length?auditTrail(activityEvents):`<div style="color:var(--muted);font-size:13px;padding:8px 0">${esc(s('noActivityYet'))}</div>`}</div></div>
        </div>
        <aside class="summary">
          <div class="sumcard"><div class="sectitle" style="margin-top:0">${esc(s('receivables'))}</div>
            <div class="sumrow"><span class="sk2">${esc(s('balance'))}</span><span class="sv tnum">${money(detail.balance)}</span></div>
            <div class="sumrow"><span class="sk2">${esc(s('overdue'))}</span><span class="sv tnum" style="color:var(--danger)">${money(detail.overdue)}</span></div>
            <div class="sumrow total"><span class="sk2">${esc(s('creditLimit'))}</span><span class="sv tnum">${detail.creditProfile?money(limit):notSet}</span></div>
            ${detail.creditProfile?`<div class="indicator ${usedPct>90?'danger':usedPct>70?'warn':'ok'}" style="margin-top:12px">
              <div class="ind-top">${ic('receipt')}<span>${esc(s('limitUsed'))}</span><span class="ind-r">${usedPct}%</span></div>
              <div class="track"><i style="width:${Math.min(100,usedPct)}%"></i></div>
              <small>${esc(s('limitUsedBody').replace('{balance}',money(detail.balance)).replace('{limit}',money(limit)).replace('{overdue}',money(detail.overdue)))}</small>
            </div>`:`<div style="color:var(--muted);font-size:12.5px;margin-top:12px">${esc(s('noCreditProfile'))}</div>`}
          </div>
        </aside>
      </div>
      <div style="height:60px"></div>
    </div></div></section></div>`;
    wire();
  }

  async function reload(){
    detail=await prepareCustomerDetail(detail.customer.id);
    render();
  }

  function wire(){
    const s=customer360Copy();
    const addContactBtn=root.querySelector('[data-add-contact]');
    addContactBtn&&addContactBtn.addEventListener('click',()=>{
      appModal({
        icon: 'plus',
        title: s('addContact'),
        body: `<div class="set-grid">
          <div class="fld"><span>${esc(s('nameLabel'))} <span class="req">*</span></span><input id="ctName" placeholder="${esc(s('namePlaceholder'))}"></div>
          <div class="fld"><span>${esc(s('roleLabel'))} <span class="req">*</span></span><input id="ctRole" placeholder="${esc(s('rolePlaceholder'))}"></div>
          <div class="fld"><span>${esc(s('emailLabel'))}</span><input id="ctEmail" type="email" placeholder="${esc(s('optional'))}"></div>
          <div class="fld"><span>${esc(s('phoneLabel'))}</span><input id="ctPhone" placeholder="${esc(s('optional'))}"></div>
        </div>`,
        actions: `${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('addContact'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}`,
      });
      const saveBtn=$('#modalEl').querySelector('[data-save]');
      saveBtn.addEventListener('click',async()=>{
        const name=$('#ctName').value.trim(), role=$('#ctRole').value.trim();
        if(!requireField(name, s('nameRoleRequired'))) return;
        if(!requireField(role, s('nameRoleRequired'))) return;
        saveBtn.disabled=true;
        try{
          await window.ErpSystemData.create('crm/contacts',{
            customerId:detail.customer.id, name, role,
            email:$('#ctEmail').value.trim()||null, phone:$('#ctPhone').value.trim()||null,
          });
          closeModal();
          toast(s('contactAdded').replace('{name}',name),'ok');
          await reload();
        }catch(error){
          saveBtn.disabled=false;
          toast(error&&error.message?error.message:s('contactSaveError'),'danger');
        }
      });
    });

    const logActivityBtn=root.querySelector('[data-log-activity]');
    logActivityBtn&&logActivityBtn.addEventListener('click',()=>{
      appModal({
        icon: 'comment',
        title: s('logActivity'),
        body: `<div class="set-grid">
          <div class="fld"><span>${esc(s('type'))}</span><select id="acKind"><option value="note">${esc(s('note'))}</option><option value="call">${esc(s('call'))}</option><option value="email">${esc(s('email'))}</option></select></div>
          <div class="fld" style="grid-column:1/-1"><span>${esc(s('details'))} <span class="req">*</span></span><textarea id="acBody" rows="3" placeholder="${esc(s('whatHappened'))}"></textarea></div>
        </div>`,
        actions: `${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('logActivity'),{icon:'comment',cls:'primary',attrs:'data-save="1"'})}`,
      });
      const saveBtn=$('#modalEl').querySelector('[data-save]');
      saveBtn.addEventListener('click',async()=>{
        const body=$('#acBody').value.trim();
        if(!requireField(body, s('detailsRequired'))) return;
        saveBtn.disabled=true;
        try{
          await window.ErpSystemData.create('crm/activities',{
            customerId:detail.customer.id, kind:$('#acKind').value, body,
          });
          closeModal();
          toast(s('activityLogged'),'ok');
          await reload();
        }catch(error){
          saveBtn.disabled=false;
          toast(error&&error.message?error.message:s('activitySaveError'),'danger');
        }
      });
    });
  }

  render();
};
