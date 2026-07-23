(function salesPricingCanonical(){
  function adapter(){if(!window.ErpSystemData)throw new Error('ERP data adapter is unavailable.');return window.ErpSystemData;}
  function pack(packs){const lang=typeof getLang==='function'?getLang():'en';return packs[lang]||packs.en;}
  function byId(rows){return new Map((rows||[]).map(row=>[Number(row.id),row]));}
  function tone(status){return status==='active'?'ok':status==='draft'?'neutral':'warn';}
  function err(error,fallback){return error&&error.message||fallback;}
  const priceText={
    en:{title:'Price lists',sub:'Effective-dated standard and customer prices with protected selling floors.',new:'New price list',code:'Code',name:'Name',basis:'Basis',standard:'Standard',customer:'Customer',promotion:'Promotion',currency:'Currency',from:'Effective from',to:'Effective to',item:'Item',minQty:'Minimum quantity',price:'Unit price',floor:'Floor price',lines:'Lines',status:'Status',activate:'Activate',create:'Create draft',cancel:'Cancel',default:'Default',empty:'No canonical price lists yet.',created:'Price list drafted',activated:'Price list activated'},
    ms:{title:'Senarai harga',sub:'Harga standard dan pelanggan berkuat kuasa dengan lantai jualan terlindung.',new:'Senarai harga baharu',code:'Kod',name:'Nama',basis:'Asas',standard:'Standard',customer:'Pelanggan',promotion:'Promosi',currency:'Mata wang',from:'Berkuat kuasa dari',to:'Berkuat kuasa hingga',item:'Item',minQty:'Kuantiti minimum',price:'Harga unit',floor:'Harga lantai',lines:'Baris',status:'Status',activate:'Aktifkan',create:'Cipta draf',cancel:'Batal',default:'Lalai',empty:'Belum ada senarai harga kanonik.',created:'Draf senarai harga dicipta',activated:'Senarai harga diaktifkan'},
    zh:{title:'价格表',sub:'按生效日期管理标准价与客户价，并强制保护最低售价。',new:'新建价格表',code:'编码',name:'名称',basis:'计价基础',standard:'标准',customer:'客户',promotion:'促销',currency:'币种',from:'生效日期',to:'失效日期',item:'物料',minQty:'最低数量',price:'单价',floor:'最低售价',lines:'明细',status:'状态',activate:'启用',create:'创建草稿',cancel:'取消',default:'默认',empty:'目前没有标准价格表。',created:'价格表草稿已创建',activated:'价格表已启用'},
    ja:{title:'価格表',sub:'有効日付きの標準・顧客価格と販売下限を管理します。',new:'価格表を作成',code:'コード',name:'名称',basis:'基準',standard:'標準',customer:'顧客',promotion:'プロモーション',currency:'通貨',from:'開始日',to:'終了日',item:'品目',minQty:'最小数量',price:'単価',floor:'下限価格',lines:'明細',status:'ステータス',activate:'有効化',create:'ドラフト作成',cancel:'キャンセル',default:'デフォルト',empty:'標準価格表はありません。',created:'価格表ドラフトを作成しました',activated:'価格表を有効化しました'},
    vi:{title:'Bảng giá',sub:'Quản lý giá chuẩn, giá khách hàng theo hiệu lực và giá sàn bảo vệ.',new:'Tạo bảng giá',code:'Mã',name:'Tên',basis:'Cơ sở',standard:'Chuẩn',customer:'Khách hàng',promotion:'Khuyến mãi',currency:'Tiền tệ',from:'Hiệu lực từ',to:'Hiệu lực đến',item:'Mặt hàng',minQty:'Số lượng tối thiểu',price:'Đơn giá',floor:'Giá sàn',lines:'Dòng',status:'Trạng thái',activate:'Kích hoạt',create:'Tạo nháp',cancel:'Hủy',default:'Mặc định',empty:'Chưa có bảng giá chuẩn.',created:'Đã tạo nháp bảng giá',activated:'Đã kích hoạt bảng giá'},
  };
  const discountText={
    en:{title:'Discount management',sub:'Bounded discount rules with effective dates and explicit approval thresholds.',new:'New rule',code:'Code',name:'Name',type:'Type',standard:'Standard',customer:'Customer',product:'Product',quantity:'Quantity',campaign:'Campaign',target:'Target',discount:'Discount',approval:'Approval threshold',minOrder:'Minimum order',from:'Effective from',to:'Effective to',status:'Status',activate:'Activate',create:'Create draft',cancel:'Cancel',empty:'No canonical discount rules yet.',created:'Discount rule drafted',activated:'Discount rule activated'},
    ms:{title:'Pengurusan diskaun',sub:'Peraturan diskaun terkawal dengan tarikh kuat kuasa dan ambang kelulusan.',new:'Peraturan baharu',code:'Kod',name:'Nama',type:'Jenis',standard:'Standard',customer:'Pelanggan',product:'Produk',quantity:'Kuantiti',campaign:'Kempen',target:'Sasaran',discount:'Diskaun',approval:'Ambang kelulusan',minOrder:'Pesanan minimum',from:'Berkuat kuasa dari',to:'Berkuat kuasa hingga',status:'Status',activate:'Aktifkan',create:'Cipta draf',cancel:'Batal',empty:'Belum ada peraturan diskaun kanonik.',created:'Draf peraturan diskaun dicipta',activated:'Peraturan diskaun diaktifkan'},
    zh:{title:'折扣管理',sub:'按生效日期控制折扣规则，并明确设置审批阈值。',new:'新建规则',code:'编码',name:'名称',type:'类型',standard:'标准',customer:'客户',product:'物料',quantity:'数量',campaign:'活动',target:'适用对象',discount:'折扣率',approval:'审批阈值',minOrder:'最低订单金额',from:'生效日期',to:'失效日期',status:'状态',activate:'启用',create:'创建草稿',cancel:'取消',empty:'目前没有标准折扣规则。',created:'折扣规则草稿已创建',activated:'折扣规则已启用'},
    ja:{title:'割引管理',sub:'有効日と承認しきい値を持つ制限付き割引ルールです。',new:'ルールを作成',code:'コード',name:'名称',type:'種類',standard:'標準',customer:'顧客',product:'製品',quantity:'数量',campaign:'キャンペーン',target:'対象',discount:'割引率',approval:'承認しきい値',minOrder:'最小注文額',from:'開始日',to:'終了日',status:'ステータス',activate:'有効化',create:'ドラフト作成',cancel:'キャンセル',empty:'標準割引ルールはありません。',created:'割引ルールを作成しました',activated:'割引ルールを有効化しました'},
    vi:{title:'Quản lý chiết khấu',sub:'Quy tắc chiết khấu có giới hạn, ngày hiệu lực và ngưỡng phê duyệt rõ ràng.',new:'Tạo quy tắc',code:'Mã',name:'Tên',type:'Loại',standard:'Chuẩn',customer:'Khách hàng',product:'Sản phẩm',quantity:'Số lượng',campaign:'Chiến dịch',target:'Đối tượng',discount:'Chiết khấu',approval:'Ngưỡng phê duyệt',minOrder:'Đơn hàng tối thiểu',from:'Hiệu lực từ',to:'Hiệu lực đến',status:'Trạng thái',activate:'Kích hoạt',create:'Tạo nháp',cancel:'Hủy',empty:'Chưa có quy tắc chiết khấu chuẩn.',created:'Đã tạo nháp quy tắc',activated:'Đã kích hoạt quy tắc'},
  };
  SCREENS['price-lists']=async function(root){
    const d=pack(priceText),a=adapter(),pages=await Promise.all([a.list('sales/price-lists',{limit:100}),a.list('sales/price-list-lines',{limit:100}),a.list('inventory/products',{limit:100}),a.list('sales/customers',{limit:100})]);
    const lists=pages[0].data||[],lines=pages[1].data||[],products=pages[2].data||[],customers=pages[3].data||[],customerMap=byId(customers),counts=new Map();
    lines.forEach(line=>counts.set(Number(line.priceListId),(counts.get(Number(line.priceListId))||0)+1));
    const columns=[
      {label:d.title,render:r=>`<div class="cellsub"><b>${esc(r.name)}${r.isDefault?` <span class="pl-def">${esc(d.default)}</span>`:''}</b><small class="mono">${esc(r.code)}</small></div>`},
      {label:d.basis,render:r=>esc(d[r.basis]||r.basis)},{label:d.customer,render:r=>esc((customerMap.get(Number(r.customerId))||{}).name||'—')},{label:d.currency,render:r=>esc(r.currency)},
      {label:d.from,render:r=>esc(r.effectiveFrom)},{label:d.lines,align:'r',render:r=>String(counts.get(Number(r.id))||0)},{label:d.status,render:r=>cap(r.status,tone(r.status))},
      {label:'',align:'r',render:r=>r.status==='draft'?`<span class="rowact">${btn(d.activate,{icon:'check',cls:'primary',attrs:`data-activate-price="${r.id}"`})}</span>`:''},
    ];
    function openCreate(){
      const itemOptions=products.map(r=>`<option value="${r.id}">${esc(r.sku)} · ${esc(r.name)}</option>`).join(''),customerOptions=`<option value="">—</option>`+customers.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
      appModal({icon:'tag',title:d.new,width:680,body:`<div class="fldrow c2"><div class="fld"><span>${esc(d.code)}</span><input id="priceCode" value="${esc(seq('PL'))}"></div><div class="fld"><span>${esc(d.name)}</span><input id="priceName"></div></div>
        <div class="fldrow c3"><div class="fld"><span>${esc(d.basis)}</span><select id="priceBasis"><option value="standard">${esc(d.standard)}</option><option value="customer">${esc(d.customer)}</option><option value="promotion">${esc(d.promotion)}</option></select></div><div class="fld"><span>${esc(d.customer)}</span><select id="priceCustomer">${customerOptions}</select></div><div class="fld"><span>${esc(d.currency)}</span><input id="priceCurrency" value="${esc(DB.company.currency||'SGD')}"></div></div>
        <div class="fldrow c2"><div class="fld"><span>${esc(d.from)}</span><input id="priceFrom" type="date" value="${today()}"></div><div class="fld"><span>${esc(d.to)}</span><input id="priceTo" type="date"></div></div>
        <div class="fld"><span>${esc(d.item)}</span><select id="priceProduct">${itemOptions}</select></div><div class="fldrow c3"><div class="fld"><span>${esc(d.minQty)}</span><input id="priceMinQty" type="number" min="0.0001" step="1" value="1"></div><div class="fld"><span>${esc(d.price)}</span><input id="priceUnit" type="number" min="0" step="0.01" value="10"></div><div class="fld"><span>${esc(d.floor)}</span><input id="priceFloor" type="number" min="0" step="0.01" value="8"></div></div>`,
        actions:btn(d.cancel,{cls:'soft',attrs:'data-price-cancel'})+btn(d.create,{icon:'plus',cls:'primary',attrs:'data-price-create'})});
      document.querySelector('[data-price-cancel]')?.addEventListener('click',closeModal);
      document.querySelector('[data-price-create]')?.addEventListener('click',async event=>{const b=event.currentTarget;b.disabled=true;const basis=document.querySelector('#priceBasis').value,customer=document.querySelector('#priceCustomer').value;
        try{await a.create('sales/price-lists',{code:document.querySelector('#priceCode').value.trim(),name:document.querySelector('#priceName').value.trim(),basis,customerId:basis==='customer'?Number(customer):null,currency:document.querySelector('#priceCurrency').value.trim().toUpperCase(),effectiveFrom:document.querySelector('#priceFrom').value,effectiveTo:document.querySelector('#priceTo').value||null,lines:[{productId:Number(document.querySelector('#priceProduct').value),minQty:document.querySelector('#priceMinQty').value,unitPrice:document.querySelector('#priceUnit').value,floorPrice:document.querySelector('#priceFloor').value}]});closeModal();toast(d.created,'ok');navigate('price-lists');}catch(e){b.disabled=false;toast(err(e,'Create failed'),'danger');}});
    }
    transactionListPage(root,{
      module:'sales',route:'price-lists',title:d.title,description:d.sub,
      rows:lists,rowId:r=>r.id,columns,
      primaryAction:{label:d.new,icon:'plus',onClick:openCreate},
      empty:{icon:'tag',title:d.empty,description:d.sub},
      afterRender:({root:pageRoot})=>{
        pageRoot.querySelectorAll('[data-activate-price]').forEach(b=>b.addEventListener('click',async e=>{e.stopPropagation();b.disabled=true;try{await a.action('sales/price-lists',Number(b.dataset.activatePrice),'activate',{},`activate-price-list-${b.dataset.activatePrice}`);toast(d.activated,'ok');navigate('price-lists');}catch(x){b.disabled=false;toast(err(x,'Activation failed'),'danger');}}));
      },
    });
  };
  SCREENS['discount-mgmt']=async function(root){
    const d=pack(discountText),a=adapter(),pages=await Promise.all([a.list('sales/discount-rules',{limit:100}),a.list('sales/customers',{limit:100}),a.list('inventory/products',{limit:100})]);
    const rules=pages[0].data||[],customers=pages[1].data||[],products=pages[2].data||[],customerMap=byId(customers),productMap=byId(products),target=r=>(customerMap.get(Number(r.customerId))||productMap.get(Number(r.productId))||{}).name||'—';
    const columns=[
      {label:d.name,render:r=>`<div class="cellsub"><b>${esc(r.name)}</b><small class="mono">${esc(r.code)}</small></div>`},{label:d.type,render:r=>esc(d[r.ruleType]||r.ruleType)},{label:d.target,render:r=>esc(target(r))},
      {label:d.discount,align:'r',render:r=>`<b>${esc(Number(r.discountPct).toFixed(2))}%</b>`},{label:d.approval,align:'r',render:r=>r.approvalThresholdPct==null?'—':`${esc(Number(r.approvalThresholdPct).toFixed(2))}%`},
      {label:d.from,render:r=>esc(r.effectiveFrom)},{label:d.status,render:r=>cap(r.status,tone(r.status))},{label:'',align:'r',render:r=>r.status==='draft'?`<span class="rowact">${btn(d.activate,{icon:'check',cls:'primary',attrs:`data-activate-discount="${r.id}"`})}</span>`:''},
    ];
    function openCreate(){
      const customerOptions=`<option value="">—</option>`+customers.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join(''),productOptions=`<option value="">—</option>`+products.map(r=>`<option value="${r.id}">${esc(r.sku)} · ${esc(r.name)}</option>`).join('');
      appModal({icon:'percent',title:d.new,width:680,body:`<div class="fldrow c2"><div class="fld"><span>${esc(d.code)}</span><input id="discountCode" value="${esc(seq('DR'))}"></div><div class="fld"><span>${esc(d.name)}</span><input id="discountName"></div></div>
        <div class="fldrow c3"><div class="fld"><span>${esc(d.type)}</span><select id="discountType"><option value="standard">${esc(d.standard)}</option><option value="customer">${esc(d.customer)}</option><option value="product">${esc(d.product)}</option><option value="quantity">${esc(d.quantity)}</option><option value="campaign">${esc(d.campaign)}</option></select></div><div class="fld"><span>${esc(d.customer)}</span><select id="discountCustomer">${customerOptions}</select></div><div class="fld"><span>${esc(d.product)}</span><select id="discountProduct">${productOptions}</select></div></div>
        <div class="fldrow c3"><div class="fld"><span>${esc(d.discount)} %</span><input id="discountPct" type="number" min="0" max="100" step="0.1" value="2"></div><div class="fld"><span>${esc(d.approval)} %</span><input id="discountApproval" type="number" min="0" max="100" step="0.1" value="10"></div><div class="fld"><span>${esc(d.minOrder)}</span><input id="discountMinOrder" type="number" min="0" step="0.01" value="0"></div></div>
        <div class="fldrow c2"><div class="fld"><span>${esc(d.from)}</span><input id="discountFrom" type="date" value="${today()}"></div><div class="fld"><span>${esc(d.to)}</span><input id="discountTo" type="date"></div></div>`,
        actions:btn(d.cancel,{cls:'soft',attrs:'data-discount-cancel'})+btn(d.create,{icon:'plus',cls:'primary',attrs:'data-discount-create'})});
      document.querySelector('[data-discount-cancel]')?.addEventListener('click',closeModal);
      document.querySelector('[data-discount-create]')?.addEventListener('click',async event=>{const b=event.currentTarget;b.disabled=true,type=document.querySelector('#discountType').value;
        try{await a.create('sales/discount-rules',{code:document.querySelector('#discountCode').value.trim(),name:document.querySelector('#discountName').value.trim(),ruleType:type,customerId:type==='customer'?Number(document.querySelector('#discountCustomer').value):null,productId:type==='product'?Number(document.querySelector('#discountProduct').value):null,discountPct:document.querySelector('#discountPct').value,approvalThresholdPct:document.querySelector('#discountApproval').value||null,minOrderAmount:document.querySelector('#discountMinOrder').value||null,minQty:type==='quantity'?'1':null,effectiveFrom:document.querySelector('#discountFrom').value,effectiveTo:document.querySelector('#discountTo').value||null});closeModal();toast(d.created,'ok');navigate('discount-mgmt');}catch(x){b.disabled=false;toast(err(x,'Create failed'),'danger');}});
    }
    transactionListPage(root,{
      module:'sales',route:'discount-mgmt',title:d.title,description:d.sub,
      rows:rules,rowId:r=>r.id,columns,
      primaryAction:{label:d.new,icon:'plus',onClick:openCreate},
      empty:{icon:'percent',title:d.empty,description:d.sub},
      afterRender:({root:pageRoot})=>{
        pageRoot.querySelectorAll('[data-activate-discount]').forEach(b=>b.addEventListener('click',async e=>{e.stopPropagation();b.disabled=true;try{await a.action('sales/discount-rules',Number(b.dataset.activateDiscount),'activate',{},`activate-discount-${b.dataset.activateDiscount}`);toast(d.activated,'ok');navigate('discount-mgmt');}catch(x){b.disabled=false;toast(err(x,'Activation failed'),'danger');}}));
      },
    });
  };
  SCREENS['credit-control']=async function(root){
    const packs={
      en:{title:'Credit control',sub:'Live unpaid-invoice exposure with enforced limits and manual credit holds.',customer:'Customer',limit:'Credit limit',exposure:'Exposure',available:'Available',util:'Utilisation',status:'Status',open:'Open',held:'Credit hold',new:'New credit profile',currency:'Currency',create:'Create',cancel:'Cancel',hold:'Place hold',release:'Release',reason:'Hold reason',empty:'No canonical credit profiles yet.',created:'Credit profile created',heldMsg:'Customer placed on hold',released:'Credit hold released'},
      ms:{title:'Kawalan kredit',sub:'Pendedahan invois belum dibayar dengan had dikuatkuasakan dan pegangan manual.',customer:'Pelanggan',limit:'Had kredit',exposure:'Pendedahan',available:'Tersedia',util:'Penggunaan',status:'Status',open:'Terbuka',held:'Pegangan kredit',new:'Profil kredit baharu',currency:'Mata wang',create:'Cipta',cancel:'Batal',hold:'Letak pegangan',release:'Lepaskan',reason:'Sebab pegangan',empty:'Belum ada profil kredit kanonik.',created:'Profil kredit dicipta',heldMsg:'Pelanggan diletakkan dalam pegangan',released:'Pegangan kredit dilepaskan'},
      zh:{title:'信用控制',sub:'以未付发票计算实时暴露额，并强制执行信用额度与人工冻结。',customer:'客户',limit:'信用额度',exposure:'暴露额',available:'可用额度',util:'使用率',status:'状态',open:'正常',held:'信用冻结',new:'新建信用档案',currency:'币种',create:'创建',cancel:'取消',hold:'冻结',release:'解除冻结',reason:'冻结原因',empty:'目前没有标准信用档案。',created:'信用档案已创建',heldMsg:'客户已冻结',released:'信用冻结已解除'},
      ja:{title:'与信管理',sub:'未払請求の与信残高、限度額、手動保留を実際に強制します。',customer:'顧客',limit:'与信限度',exposure:'与信残高',available:'利用可能',util:'利用率',status:'ステータス',open:'利用可',held:'与信保留',new:'与信プロファイル作成',currency:'通貨',create:'作成',cancel:'キャンセル',hold:'保留',release:'解除',reason:'保留理由',empty:'標準与信プロファイルはありません。',created:'与信プロファイルを作成しました',heldMsg:'顧客を保留しました',released:'与信保留を解除しました'},
      vi:{title:'Kiểm soát tín dụng',sub:'Dư nợ hóa đơn chưa thanh toán với hạn mức bắt buộc và khóa thủ công.',customer:'Khách hàng',limit:'Hạn mức',exposure:'Dư nợ',available:'Còn lại',util:'Sử dụng',status:'Trạng thái',open:'Mở',held:'Khóa tín dụng',new:'Tạo hồ sơ tín dụng',currency:'Tiền tệ',create:'Tạo',cancel:'Hủy',hold:'Đặt khóa',release:'Mở khóa',reason:'Lý do khóa',empty:'Chưa có hồ sơ tín dụng chuẩn.',created:'Đã tạo hồ sơ tín dụng',heldMsg:'Đã khóa khách hàng',released:'Đã mở khóa tín dụng'},
    };
    const d=pack(packs),a=adapter(),pages=await Promise.all([a.list('sales/credit-profiles',{limit:100}),a.list('sales/customers',{limit:100}),a.list('sales/invoices',{limit:100})]);
    const profiles=pages[0].data||[],customers=pages[1].data||[],invoices=pages[2].data||[],customerMap=byId(customers),profileCustomers=new Set(profiles.map(r=>Number(r.customerId))),exposure=new Map();
    invoices.filter(i=>i.status==='unpaid').forEach(i=>exposure.set(Number(i.customerId),(exposure.get(Number(i.customerId))||0)+Number(i.totalAmount)));
    const columns=[
      {label:d.customer,render:r=>{const c=customerMap.get(Number(r.customerId))||{};return `<div class="cellsub"><b>${esc(c.name||'—')}</b><small class="mono">${esc(c.code||'')}</small></div>`;}},
      {label:d.limit,align:'r',render:r=>esc(money(r.creditLimit,r.currency))},{label:d.exposure,align:'r',render:r=>esc(money(exposure.get(Number(r.customerId))||0,r.currency))},
      {label:d.available,align:'r',render:r=>esc(money(Number(r.creditLimit)-(exposure.get(Number(r.customerId))||0),r.currency))},
      {label:d.util,align:'r',render:r=>`${Math.round((exposure.get(Number(r.customerId))||0)/Math.max(Number(r.creditLimit),1)*100)}%`},
      {label:d.status,render:r=>cap(r.status==='held'?d.held:d.open,r.status==='held'?'danger':'ok')},
      {label:'',align:'r',render:r=>`<span class="rowact">${r.status==='held'?btn(d.release,{icon:'unlock',cls:'primary',attrs:`data-credit-release="${r.id}"`}):btn(d.hold,{icon:'lock',cls:'soft',attrs:`data-credit-hold="${r.id}"`})}</span>`},
    ];
    function openCreate(){
      const options=customers.filter(c=>!profileCustomers.has(Number(c.id))).map(c=>`<option value="${c.id}">${esc(c.code)} · ${esc(c.name)}</option>`).join('');
      appModal({icon:'shield',title:d.new,width:520,body:`<div class="fld"><span>${esc(d.customer)}</span><select id="creditCustomer">${options}</select></div><div class="fldrow c2"><div class="fld"><span>${esc(d.currency)}</span><input id="creditCurrency" value="${esc(DB.company.currency||'SGD')}"></div><div class="fld"><span>${esc(d.limit)}</span><input id="creditLimit" type="number" min="0" step="0.01" value="5000"></div></div>`,actions:btn(d.cancel,{cls:'soft',attrs:'data-credit-cancel'})+btn(d.create,{icon:'plus',cls:'primary',attrs:'data-credit-create'})});
      document.querySelector('[data-credit-cancel]')?.addEventListener('click',closeModal);
      document.querySelector('[data-credit-create]')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{await a.create('sales/credit-profiles',{customerId:Number(document.querySelector('#creditCustomer').value),currency:document.querySelector('#creditCurrency').value.trim().toUpperCase(),creditLimit:document.querySelector('#creditLimit').value});closeModal();toast(d.created,'ok');navigate('credit-control');}catch(x){b.disabled=false;toast(err(x,'Create failed'),'danger');}});
    }
    transactionListPage(root,{
      module:'sales',route:'credit-control',title:d.title,description:d.sub,
      rows:profiles,rowId:r=>r.id,columns,
      primaryAction:{label:d.new,icon:'plus',onClick:openCreate},
      empty:{icon:'shield',title:d.empty,description:d.sub},
      afterRender:({root:pageRoot})=>{
        pageRoot.querySelectorAll('[data-credit-hold]').forEach(b=>b.addEventListener('click',async()=>{const reason=prompt(d.reason,'Fictional overdue review');if(!reason)return;b.disabled=true;try{await a.action('sales/credit-profiles',Number(b.dataset.creditHold),'hold',{reason},`credit-hold-${b.dataset.creditHold}`);toast(d.heldMsg,'ok');navigate('credit-control');}catch(x){b.disabled=false;toast(err(x,'Hold failed'),'danger');}}));
        pageRoot.querySelectorAll('[data-credit-release]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await a.action('sales/credit-profiles',Number(b.dataset.creditRelease),'release',{},`credit-release-${b.dataset.creditRelease}`);toast(d.released,'ok');navigate('credit-control');}catch(x){b.disabled=false;toast(err(x,'Release failed'),'danger');}}));
      },
    });
  };
})();
