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

  const stageUi={lead:'Lead',qualified:'Qualified',proposal:'Proposal',negotiation:'Negotiation',won:'Won'};
  DB.pipeline=Object.keys(stageUi).map(stage=>{
    const items=opportunities.filter(row=>row.stage===stage).map(row=>{
      const customer=customerById.get(row.customerId)||{};
      const ownerName=DB.user&&DB.user.name||'Unassigned';
      const initials=(ownerName.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean)
        .slice(0,2).map(word=>word[0]).join('').toUpperCase())||'U';
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
        av:initials,
        clr:'#0a84ff',
        close:row.closeDate,
        prob:crmNumber(row.probability),
        rawStage:row.stage,
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
    const cards=col.items.map(o=>`<div class="kcard ${o.hot?'hot':''}" data-opp="${esc(o.no)}">
        <div class="kc-cust">${ic('handshake')}${esc(o.cust)}${o.warn?` · <span style="color:var(--warn)" data-tip="${esc(o.warn)}">⚠</span>`:''}</div>
        <div class="kc-title">${esc(o.title)}</div>
        <div class="kc-val">${money0(o.value)}</div>
        <div class="kprob"><i style="width:${o.prob}%;background:${crmStageColor(col.stage)}"></i></div>
        <div class="kc-foot">
          <span class="kc-av" style="background:${o.clr}">${esc(o.av)}</span>
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
    c.dataset.opp==='OPP-26-0091'?navigate('opportunity'):toast('Opening '+c.dataset.opp,'info');
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
function openConvertOpportunityModal(o){
  const items=DB.items;
  if(!items.length){ toast('No items available to convert against','warn'); return; }
  const suggestQty=(it)=>Math.max(1,Math.round(o.value/(it.cost||1)));
  appModal({
    icon:'bag', title:'Convert to sales order', width:420,
    body:`<p style="color:var(--muted);font-size:13px;margin:0 0 14px">${esc(o.title)} · ${esc(o.cust)} · ${money0(o.value)}</p>
      <div class="fld"><span>Item</span><select id="cvItem">${items.map(it=>`<option value="${esc(it.sku)}">${esc(it.sku)} · ${esc(it.name)} — ${money(it.cost)}/${esc(it.uom)}</option>`).join('')}</select></div>
      <div class="fldrow c2" style="margin-top:12px">
        <div class="fld"><span>Qty</span><input type="number" id="cvQty" min="1" value="${suggestQty(items[0])}"></div>
        <div class="fld"><span>Unit price</span><input type="number" id="cvPrice" min="0" step="0.01" value="${items[0].cost}"></div>
      </div>`,
    actions: btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})
      + btn('Convert',{icon:'check',cls:'primary',attrs:'id="cvConfirm"'}),
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
      if(!item||!warehouse) throw new Error('A product and warehouse are required for conversion.');
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
      navigate('crm-pipeline');
      toast(`${o.no} converted — SO-CRM-${o.id} created · ${money(res.total)}`,'ok');
    }catch(e){
      toast((e&&e.message)||'Convert failed','danger');
      confirmBtn.disabled=false;
    }
  });
}

/* ---------------- OPPORTUNITY (document) ---------------- */
SCREENS['opportunity'] = function(root){
  const d=DB.opp0091, c=d.cust;
  const order=['Lead','Qualified','Proposal','Negotiation','Won'];
  const curIdx=order.indexOf(d.stage);
  const steps=order.map((st,i)=>{
    const cls=i<curIdx?'done':i===curIdx?'current':'';
    return `<div class="step ${cls}"><span class="sdot">${i<curIdx?ic('check'):i===curIdx?ic('clock'):''}</span>${st}</div>${i<order.length-1?`<span class="stepline ${i<curIdx?'done':''}"></span>`:''}`;
  }).join('');

  root.innerHTML=`<div class="content full"><section class="master">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,'CRM','Pipeline',{cur:d.no}])}
      <div class="dochead">
        <div class="dh-row1">
          <div>
            <div class="dt">${ic('handshake')}${esc(d.title)} <span class="dnum">${esc(d.no)}</span></div>
            <div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(c.name)} · owner ${esc(d.owner)} · ${esc(d.source)}</div>
          </div>
          <div class="dactions">${cap(d.stage,crmStageTone(d.stage))}${btn('Customer 360',{icon:'user',cls:'soft',attrs:'onclick="navigate(\'crm-customer\')"'})}</div>
        </div>
        <div class="stepper">${steps}</div>
        <div class="docmeta">
          <div class="dm"><small>Value</small><b>${money(d.value)}</b></div>
          <div class="dm"><small>Probability</small><b>${d.prob}%</b></div>
          <div class="dm"><small>Expected close</small><b>${esc(d.close)}</b></div>
          <div class="dm"><small>Age</small><b>${esc(d.age)}</b></div>
          <div class="dm"><small>Owner</small><b>${esc(d.owner)}</b></div>
        </div>
      </div>

      <div class="appr-layout">
        <div class="docmain">
          <div class="panel">
            <div class="panel-h"><h3>Next actions</h3></div>
            <div class="panel-body" style="padding-top:12px">
              <div class="risk warn">${ic('clock')}<div><b>Close date in 14 days</b><small>Customer is pushing for Jun 18 delivery — quote includes a 12% volume discount above the standard threshold and is pending sales approval as SO-26-0418.</small></div></div>
              <div class="risk danger">${ic('warn')}<div><b>Account has overdue balance</b><small>${esc(c.name)} is carrying ${money(c.overdue)} overdue against a ${money(c.limit)} limit — confirm credit before converting.</small></div></div>
              <div class="risk ok">${ic('checkc')}<div><b>Technical scope agreed</b><small>Site walkthrough complete; 9 Conveyor Drive Units scoped against current BOM Rev C.</small></div></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Activity timeline</h3></div>
            <div class="panel-body">${auditTrail(d.activities)}</div>
          </div>
        </div>

        <aside>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Deal value</div>
            <div class="sumrow"><span class="sk2">Opportunity value</span><span class="sv tnum">${money(d.value)}</span></div>
            <div class="sumrow"><span class="sk2">Probability</span><span class="sv tnum">${d.prob}%</span></div>
            <div class="sumrow total"><span class="sk2">Weighted</span><span class="sv tnum">${money(d.value*d.prob/100)}</span></div>
            <div class="indicator warn" style="margin-top:12px">
              <div class="ind-top">${ic('flow')}<span>Stage</span><span class="ind-r">${esc(d.stage)}</span></div>
              <div class="track"><i style="width:${d.prob}%"></i></div>
              <small>${d.prob}% — one approval from Closed Won.</small>
            </div>
          </div>
          <div class="sumcard" style="margin-bottom:14px">
            <div class="sectitle" style="margin-top:0">Primary contact</div>
            <div class="field"><span class="k">Name</span><span class="v">${esc(d.contact.name)}</span></div>
            <div class="field"><span class="k">Role</span><span class="v">${esc(d.contact.role)}</span></div>
            <div class="field"><span class="k">Email</span><span class="v">${esc(d.contact.email)}</span></div>
            <div class="field"><span class="k">Phone</span><span class="v">${esc(d.contact.phone)}</span></div>
          </div>
          <div class="sumcard">
            <div class="sectitle" style="margin-top:0">Related</div>
            ${relatedDocs([
              {no:'SO-26-0418',label:'Sales order (from quote)',meta:'12% discount',status:'Pending Approval'},
              {no:c.code,label:esc(c.name),meta:'Customer 360',status:'Active'},
            ])}
          </div>
        </aside>
      </div>
    </div></div>

    <div style="position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--hairline);padding:12px 24px;display:flex;gap:10px;align-items:center;flex:none">
      <div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">Stage <b style="color:var(--fg)">Negotiation</b> · converting creates a sales order in Draft.</div>
      <div class="grow"></div>
      ${btn('Log activity',{icon:'comment',cls:'soft',attrs:'onclick="toast(\'Activity logged\',\'ok\')"'})}
      ${btn('Mark lost',{icon:'x',cls:'danger',attrs:'onclick="toast(\'Opportunity marked lost\',\'danger\')"'})}
      ${btn('Convert to sales order',{icon:'bag',cls:'primary',sm:false,attrs:'onclick="navigate(\'sales-order\')"'})}
    </div>
  </section></div>`;
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

function crmDateValue(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const text=String(value==null?'':value);
  const match=text.match(/^\d{4}-\d{2}-\d{2}/);
  if(match) return match[0];
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?text:parsed.toISOString().slice(0,10);
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
    const due=new Date(`${crmDateValue(row.invoiceDate)}T00:00:00`);
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
    const since=crmDateValue(c.createdAt);
    const notSet=s('notSet');
    const openOrders=detail.orders.map(row=>({
      no:row.docNo,label:s('salesOrder'),
      meta:`${crmDateValue(row.orderDate)} · ${money(crmNumber(row.totalAmount))}`,
      status:ts(row.status),
    }));
    const openOpps=detail.opportunities.map(row=>({
      no:row.docNo,label:row.title,
      meta:`${money0(crmNumber(row.value))} · ${crmNumber(row.probability)}%`,
      status:ts(row.stage),
    }));
    const activityEvents=detail.activities.map(row=>({
      kind:'sys',when:crmDateValue(row.occurredAt),what:esc(row.body),
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
            <div class="panel-body" style="padding:6px 0">${detail.contacts.length?detail.contacts.map(p=>{
              const initials=(p.name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
              return `<div class="oprow"><span class="kc-av" style="background:#0a84ff;width:30px;height:30px;font-size:11px">${esc(initials)}</span><div class="opmain"><b>${esc(p.name)}</b><small>${esc(p.role)}${p.email?' · '+esc(p.email):''}</small></div></div>`;
            }).join(''):`<div style="color:var(--muted);font-size:13px;padding:8px 0">${esc(s('noContactsYet'))}</div>`}</div>
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
      openModal(`<div class="modal-head">${ic('plus')}<h3>${esc(s('addContact'))}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
        <div class="modal-body"><div class="set-grid">
          <div class="fld"><span>${esc(s('nameLabel'))} <span class="req">*</span></span><input id="ctName" placeholder="${esc(s('namePlaceholder'))}"></div>
          <div class="fld"><span>${esc(s('roleLabel'))} <span class="req">*</span></span><input id="ctRole" placeholder="${esc(s('rolePlaceholder'))}"></div>
          <div class="fld"><span>${esc(s('emailLabel'))}</span><input id="ctEmail" type="email" placeholder="${esc(s('optional'))}"></div>
          <div class="fld"><span>${esc(s('phoneLabel'))}</span><input id="ctPhone" placeholder="${esc(s('optional'))}"></div>
        </div></div>
        <div class="modal-foot">${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('addContact'),{icon:'plus',cls:'primary',attrs:'data-save="1"'})}</div>`);
      const saveBtn=$('#modalEl').querySelector('[data-save]');
      saveBtn.addEventListener('click',async()=>{
        const name=$('#ctName').value.trim(), role=$('#ctRole').value.trim();
        if(!name||!role){ toast(s('nameRoleRequired'),'danger'); return; }
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
      openModal(`<div class="modal-head">${ic('comment')}<h3>${esc(s('logActivity'))}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
        <div class="modal-body"><div class="set-grid">
          <div class="fld"><span>${esc(s('type'))}</span><select id="acKind"><option value="note">${esc(s('note'))}</option><option value="call">${esc(s('call'))}</option><option value="email">${esc(s('email'))}</option></select></div>
          <div class="fld" style="grid-column:1/-1"><span>${esc(s('details'))} <span class="req">*</span></span><textarea id="acBody" rows="3" placeholder="${esc(s('whatHappened'))}"></textarea></div>
        </div></div>
        <div class="modal-foot">${btn(t('common.cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('logActivity'),{icon:'comment',cls:'primary',attrs:'data-save="1"'})}</div>`);
      const saveBtn=$('#modalEl').querySelector('[data-save]');
      saveBtn.addEventListener('click',async()=>{
        const body=$('#acBody').value.trim();
        if(!body){ toast(s('detailsRequired'),'danger'); return; }
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
