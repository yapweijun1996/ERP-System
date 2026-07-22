/* ============================================================
   ARIA ERP — canonical sales enquiry / quotation front chain
   Formal ErpSystemData resources only; no data-*.js dependency.
   ============================================================ */
(function canonicalSalesFrontScreens(){
  function copy(){
    const lang=typeof getLang==='function'?getLang():'en';
    const packs={
      en:{
        enquiries:'Enquiries',quotations:'Quotations',newEnquiry:'New enquiry',
        newQuotation:'New quotation',subject:'Subject',channel:'Channel',customer:'Customer',
        owner:'Owner',date:'Date',estimated:'Estimated value',status:'Status',
        quoteDate:'Quote date',validUntil:'Valid until',probability:'Win probability',
        total:'Total',lines:'Quoted items',product:'Product',quantity:'Quantity',
        unitPrice:'Unit price',tax:'Tax',net:'Net',create:'Create',cancel:'Cancel',
        convert:'Convert to quotation',issue:'Issue quotation',accept:'Accept quotation',
        toOrder:'Convert to sales order',created:'Record created',converted:'Enquiry converted',
        issued:'Quotation issued',accepted:'Quotation accepted',orderCreated:'Draft sales order created',
        emptyEnquiry:'No canonical enquiries yet.',emptyQuotation:'No canonical quotations yet.',
        emptyHelp:'Create a record to start the customer sales chain.',
        all:'All',newStatus:'New',quoted:'Quoted',lost:'Lost',draft:'Draft',sent:'Sent',
        acceptedStatus:'Accepted',convertedStatus:'Converted',rejected:'Rejected',expired:'Expired',
        details:'Quotation details',currency:'Currency',dataLimit:'Showing the first 100 canonical records.',
        enquiryHelp:'Capture a customer request before pricing and formal quotation.',
        quotationHelp:'Formal offers with tax snapshots, validity and controlled conversion to an order.',
        orderNo:'Sales order number',quotationNo:'Quotation number',enquiryNo:'Enquiry number',
        direct:'Direct',email:'Email',phone:'Phone',web:'Web',back:'Back',
      },
      ms:{
        enquiries:'Pertanyaan',quotations:'Sebut harga',newEnquiry:'Pertanyaan baharu',
        newQuotation:'Sebut harga baharu',subject:'Subjek',channel:'Saluran',customer:'Pelanggan',
        owner:'Pemilik',date:'Tarikh',estimated:'Nilai anggaran',status:'Status',
        quoteDate:'Tarikh sebut harga',validUntil:'Sah sehingga',probability:'Kebarangkalian menang',
        total:'Jumlah',lines:'Item sebut harga',product:'Produk',quantity:'Kuantiti',
        unitPrice:'Harga unit',tax:'Cukai',net:'Bersih',create:'Cipta',cancel:'Batal',
        convert:'Tukar kepada sebut harga',issue:'Keluarkan sebut harga',accept:'Terima sebut harga',
        toOrder:'Tukar kepada pesanan jualan',created:'Rekod dicipta',converted:'Pertanyaan ditukar',
        issued:'Sebut harga dikeluarkan',accepted:'Sebut harga diterima',orderCreated:'Draf pesanan jualan dicipta',
        emptyEnquiry:'Belum ada pertanyaan kanonik.',emptyQuotation:'Belum ada sebut harga kanonik.',
        emptyHelp:'Cipta rekod untuk memulakan rantaian jualan pelanggan.',
        all:'Semua',newStatus:'Baharu',quoted:'Telah disebut',lost:'Hilang',draft:'Draf',sent:'Dihantar',
        acceptedStatus:'Diterima',convertedStatus:'Ditukar',rejected:'Ditolak',expired:'Tamat tempoh',
        details:'Butiran sebut harga',currency:'Mata wang',dataLimit:'Memaparkan 100 rekod kanonik pertama.',
        enquiryHelp:'Rekod permintaan pelanggan sebelum harga dan sebut harga rasmi.',
        quotationHelp:'Tawaran rasmi dengan petikan cukai, tempoh sah dan penukaran pesanan terkawal.',
        orderNo:'Nombor pesanan jualan',quotationNo:'Nombor sebut harga',enquiryNo:'Nombor pertanyaan',
        direct:'Terus',email:'E-mel',phone:'Telefon',web:'Web',back:'Kembali',
      },
      zh:{
        enquiries:'询价',quotations:'报价单',newEnquiry:'新建询价',
        newQuotation:'新建报价单',subject:'主题',channel:'渠道',customer:'客户',
        owner:'负责人',date:'日期',estimated:'预计金额',status:'状态',
        quoteDate:'报价日期',validUntil:'有效期至',probability:'赢单概率',
        total:'总额',lines:'报价项目',product:'产品',quantity:'数量',
        unitPrice:'单价',tax:'税额',net:'未税金额',create:'创建',cancel:'取消',
        convert:'转为报价单',issue:'发出报价单',accept:'确认客户接受',
        toOrder:'转为销售订单',created:'记录已创建',converted:'询价已转为报价单',
        issued:'报价单已发出',accepted:'报价单已接受',orderCreated:'销售订单草稿已创建',
        emptyEnquiry:'目前没有标准询价。',emptyQuotation:'目前没有标准报价单。',
        emptyHelp:'创建记录以开始客户销售流程。',
        all:'全部',newStatus:'新建',quoted:'已报价',lost:'已丢失',draft:'草稿',sent:'已发出',
        acceptedStatus:'已接受',convertedStatus:'已转订单',rejected:'已拒绝',expired:'已过期',
        details:'报价详情',currency:'币种',dataLimit:'显示前 100 条标准记录。',
        enquiryHelp:'在定价和正式报价前记录客户需求。',
        quotationHelp:'包含税率快照、有效期及受控订单转换的正式报价。',
        orderNo:'销售订单编号',quotationNo:'报价单编号',enquiryNo:'询价编号',
        direct:'直接',email:'电邮',phone:'电话',web:'网站',back:'返回',
      },
      ja:{
        enquiries:'引合',quotations:'見積書',newEnquiry:'引合を作成',
        newQuotation:'見積書を作成',subject:'件名',channel:'チャネル',customer:'顧客',
        owner:'担当者',date:'日付',estimated:'見込金額',status:'ステータス',
        quoteDate:'見積日',validUntil:'有効期限',probability:'受注確度',
        total:'合計',lines:'見積明細',product:'製品',quantity:'数量',
        unitPrice:'単価',tax:'税額',net:'税抜額',create:'作成',cancel:'キャンセル',
        convert:'見積書へ変換',issue:'見積書を発行',accept:'受注承認',
        toOrder:'受注へ変換',created:'レコードを作成しました',converted:'引合を見積書へ変換しました',
        issued:'見積書を発行しました',accepted:'見積書を承認しました',orderCreated:'受注ドラフトを作成しました',
        emptyEnquiry:'標準引合はありません。',emptyQuotation:'標準見積書はありません。',
        emptyHelp:'レコードを作成して販売フローを開始します。',
        all:'すべて',newStatus:'新規',quoted:'見積済',lost:'失注',draft:'ドラフト',sent:'送付済',
        acceptedStatus:'承認済',convertedStatus:'受注変換済',rejected:'却下',expired:'期限切れ',
        details:'見積詳細',currency:'通貨',dataLimit:'最初の100件の標準レコードを表示しています。',
        enquiryHelp:'価格設定と正式見積の前に顧客要求を記録します。',
        quotationHelp:'税率スナップショット、有効期限、受注変換管理を持つ正式提案です。',
        orderNo:'受注番号',quotationNo:'見積番号',enquiryNo:'引合番号',
        direct:'直接',email:'メール',phone:'電話',web:'Web',back:'戻る',
      },
      vi:{
        enquiries:'Yêu cầu báo giá',quotations:'Báo giá',newEnquiry:'Tạo yêu cầu',
        newQuotation:'Tạo báo giá',subject:'Chủ đề',channel:'Kênh',customer:'Khách hàng',
        owner:'Phụ trách',date:'Ngày',estimated:'Giá trị ước tính',status:'Trạng thái',
        quoteDate:'Ngày báo giá',validUntil:'Hiệu lực đến',probability:'Xác suất thắng',
        total:'Tổng cộng',lines:'Dòng báo giá',product:'Sản phẩm',quantity:'Số lượng',
        unitPrice:'Đơn giá',tax:'Thuế',net:'Trước thuế',create:'Tạo',cancel:'Hủy',
        convert:'Chuyển thành báo giá',issue:'Phát hành báo giá',accept:'Chấp nhận báo giá',
        toOrder:'Chuyển thành đơn bán hàng',created:'Đã tạo bản ghi',converted:'Đã chuyển yêu cầu thành báo giá',
        issued:'Đã phát hành báo giá',accepted:'Đã chấp nhận báo giá',orderCreated:'Đã tạo đơn bán hàng nháp',
        emptyEnquiry:'Chưa có yêu cầu chuẩn.',emptyQuotation:'Chưa có báo giá chuẩn.',
        emptyHelp:'Tạo bản ghi để bắt đầu quy trình bán hàng.',
        all:'Tất cả',newStatus:'Mới',quoted:'Đã báo giá',lost:'Thất bại',draft:'Nháp',sent:'Đã gửi',
        acceptedStatus:'Đã chấp nhận',convertedStatus:'Đã chuyển đổi',rejected:'Từ chối',expired:'Hết hạn',
        details:'Chi tiết báo giá',currency:'Tiền tệ',dataLimit:'Hiển thị 100 bản ghi chuẩn đầu tiên.',
        enquiryHelp:'Ghi nhận yêu cầu khách hàng trước khi định giá và báo giá chính thức.',
        quotationHelp:'Đề nghị chính thức với thuế chụp tại thời điểm tạo, hiệu lực và chuyển đổi có kiểm soát.',
        orderNo:'Số đơn bán hàng',quotationNo:'Số báo giá',enquiryNo:'Số yêu cầu',
        direct:'Trực tiếp',email:'Email',phone:'Điện thoại',web:'Web',back:'Quay lại',
      },
    };
    const pack=packs[lang]||packs.en;
    return key=>pack[key]||packs.en[key]||key;
  }

  function adapter(){
    if(!window.ErpSystemData) throw new Error('ERP data adapter is unavailable.');
    return window.ErpSystemData;
  }
  function byId(rows){ return new Map((rows||[]).map(row=>[Number(row.id),row])); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function plusDays(days){
    return new Date(Date.now()+days*86400000).toISOString().slice(0,10);
  }
  function sequence(prefix){
    return `${prefix}-${Date.now().toString().slice(-7)}`;
  }
  function currency(){
    return (DB.company&&DB.company.currency)||'SGD';
  }
  function amountLabel(value,code){
    const n=Number(value||0);
    try{
      return new Intl.NumberFormat(undefined,{style:'currency',currency:code||currency()}).format(n);
    }catch{ return `${code||currency()} ${n.toFixed(2)}`; }
  }
  function statusLabel(s,status){
    return ({
      new:s('newStatus'),quoted:s('quoted'),lost:s('lost'),draft:s('draft'),sent:s('sent'),
      accepted:s('acceptedStatus'),converted:s('convertedStatus'),rejected:s('rejected'),
      expired:s('expired'),
    })[status]||status;
  }
  function statusTone(status){
    return ({
      new:'info',quoted:'accent',lost:'danger',draft:'neutral',sent:'info',
      accepted:'ok',converted:'accent',rejected:'danger',expired:'warn',
    })[status]||'neutral';
  }
  function openQuote(id){
    window.ACTIVE_SALES_QUOTATION_ID=Number(id);
    navigate('quotation');
  }
  function openEnquiry(id){
    window.ACTIVE_SALES_ENQUIRY_ID=Number(id);
    return navigate('txn-view');
  }
  window.openSalesEnquiry=openEnquiry;

  async function loadFrontData(){
    const a=adapter();
    const pages=await Promise.all([
      a.list('sales/enquiries',{limit:100}),
      a.list('sales/quotations',{limit:100}),
      a.list('sales/quotation-lines',{limit:100}),
      a.list('sales/customers',{limit:100}),
      a.list('inventory/products',{limit:100}),
    ]);
    return {
      enquiries:pages[0].data||[],
      quotations:pages[1].data||[],
      lines:pages[2].data||[],
      customers:pages[3].data||[],
      products:pages[4].data||[],
    };
  }

  function openNewEnquiry(data,onDone){
    const s=copy();
    const options=data.customers.map(row=>
      `<option value="${row.id}">${esc(row.code)} · ${esc(row.name)}</option>`).join('');
    appModal({
      icon:'chat',title:s('newEnquiry'),width:560,
      body:`<div class="fldrow c2">
        <div class="fld"><span>${esc(s('enquiryNo'))}</span><input id="salesEnquiryNo" value="${esc(sequence('ENQ'))}"></div>
        <div class="fld"><span>${esc(s('date'))}</span><input id="salesEnquiryDate" type="date" value="${today()}"></div>
      </div><div class="fld"><span>${esc(s('customer'))}</span><select id="salesEnquiryCustomer">${options}</select></div>
      <div class="fld"><span>${esc(s('subject'))}</span><input id="salesEnquirySubject" required></div>
      <div class="fldrow c2"><div class="fld"><span>${esc(s('channel'))}</span>
        <select id="salesEnquiryChannel"><option value="direct">${esc(s('direct'))}</option>
          <option value="email">${esc(s('email'))}</option><option value="phone">${esc(s('phone'))}</option>
          <option value="web">${esc(s('web'))}</option></select></div>
        <div class="fld"><span>${esc(s('estimated'))}</span><input id="salesEnquiryValue" type="number" min="0" step="0.01" value="0"></div>
      </div><div class="fld"><span>${esc(s('owner'))}</span><input id="salesEnquiryOwner" value="Demo Sales"></div>`,
      actions:btn(s('cancel'),{cls:'soft',attrs:'data-enquiry-cancel'})
        +btn(s('create'),{icon:'plus',cls:'primary',attrs:'data-enquiry-create'}),
    });
    document.querySelector('[data-enquiry-cancel]')?.addEventListener('click',closeModal);
    document.querySelector('[data-enquiry-create]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;
      const subject=document.querySelector('#salesEnquirySubject').value.trim();
      if(!subject){ document.querySelector('#salesEnquirySubject').focus(); return; }
      button.disabled=true;
      try{
        await adapter().create('sales/enquiries',{
          docNo:document.querySelector('#salesEnquiryNo').value.trim(),
          customerId:Number(document.querySelector('#salesEnquiryCustomer').value),
          subject,
          channel:document.querySelector('#salesEnquiryChannel').value,
          estimatedValue:document.querySelector('#salesEnquiryValue').value||'0',
          currency:currency(),
          ownerName:document.querySelector('#salesEnquiryOwner').value.trim()||'Demo Sales',
          enquiryDate:document.querySelector('#salesEnquiryDate').value,
        });
        closeModal(); toast(s('created'),'ok'); onDone();
      }catch(error){ button.disabled=false; toast(error&&error.message||'Create failed','danger'); }
    });
  }

  function openEnquiryConversion(enquiry,data){
    const s=copy();
    if(!data.products.length){ toast(s('emptyHelp'),'warn'); return; }
    const options=data.products.map(row=>
      `<option value="${row.id}">${esc(row.sku)} · ${esc(row.name)}</option>`).join('');
    appModal({
      icon:'receipt',title:`${s('convert')} · ${enquiry.docNo}`,width:600,
      body:`<div class="fldrow c2">
        <div class="fld"><span>${esc(s('quotationNo'))}</span><input id="salesConvertNo" value="${esc(sequence('Q'))}"></div>
        <div class="fld"><span>${esc(s('validUntil'))}</span><input id="salesConvertValid" type="date" value="${plusDays(30)}"></div>
      </div><div class="fld"><span>${esc(s('product'))}</span><select id="salesConvertProduct">${options}</select></div>
      <div class="fldrow c2"><div class="fld"><span>${esc(s('quantity'))}</span>
        <input id="salesConvertQty" type="number" min="0.0001" step="0.0001" value="1"></div>
        <div class="fld"><span>${esc(s('unitPrice'))}</span>
        <input id="salesConvertPrice" type="number" min="0" step="0.01" value="${Number(enquiry.estimatedValue||0).toFixed(2)}"></div></div>`,
      actions:btn(s('cancel'),{cls:'soft',attrs:'data-convert-cancel'})
        +btn(s('convert'),{icon:'receipt',cls:'primary',attrs:'data-convert-save'}),
    });
    document.querySelector('[data-convert-cancel]')?.addEventListener('click',closeModal);
    document.querySelector('[data-convert-save]')?.addEventListener('click',async event=>{
      const button=event.currentTarget; button.disabled=true;
      try{
        const result=await adapter().action('sales/enquiries',enquiry.id,'convert-to-quotation',{
          docNo:document.querySelector('#salesConvertNo').value.trim(),
          quoteDate:today(),validUntil:document.querySelector('#salesConvertValid').value,
          currency:enquiry.currency||currency(),probability:'50',
          lines:[{
            productId:Number(document.querySelector('#salesConvertProduct').value),
            qty:document.querySelector('#salesConvertQty').value,
            unitPrice:document.querySelector('#salesConvertPrice').value,
            taxCode:'SR',
          }],
        },`convert-sales-enquiry-${enquiry.id}`);
        closeModal(); toast(s('converted'),'ok'); openQuote(result.data.quotationId);
      }catch(error){ button.disabled=false; toast(error&&error.message||'Conversion failed','danger'); }
    });
  }
  /* txn-view owns the record-specific read workspace, while this module owns
     the already-audited conversion command and its product-entry form. Share
     that one workflow rather than grow a second browser-side implementation. */
  window.openCanonicalEnquiryConversion=openEnquiryConversion;

  SCREENS['enquiries']=async function(root){
    const s=copy(),data=await loadFrontData();
    const customers=byId(data.customers);
    let active='all';
    function filtered(){
      return active==='all'?data.enquiries:data.enquiries.filter(row=>row.status===active);
    }
    function renderTable(){
      return buildTable({
        rowId:row=>row.id,
        columns:[
          {label:s('enquiries'),render:row=>`<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b><small>${esc(dateValue(row.enquiryDate))}</small></div>`},
          {label:s('customer'),render:row=>esc((customers.get(Number(row.customerId))||{}).name||'#'+row.customerId)},
          {label:s('subject'),render:row=>esc(row.subject)},
          {label:s('channel'),render:row=>esc(row.channel)},
          {label:s('owner'),render:row=>esc(row.ownerName)},
          {label:s('estimated'),align:'r',render:row=>`<b class="tnum">${esc(amountLabel(row.estimatedValue,row.currency))}</b>`},
          {label:s('status'),render:row=>cap(statusLabel(s,row.status),statusTone(row.status))},
        ],rows:filtered(),
      });
    }
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.sales'),s('enquiries')])}${typeof salesNav==='function'?salesNav('enquiries'):''}
        <div class="h1row"><h1>${esc(s('enquiries'))}</h1><span class="countchip" id="salesEnquiryCount">${data.enquiries.length}</span>
          <div class="headright">${btn(s('newEnquiry'),{icon:'plus',cls:'primary',attrs:'data-new-enquiry'})}</div>
        </div><div class="h1sub">${esc(s('enquiryHelp'))}</div>
      </div>
      <div class="toolbar"><div class="filterchips" data-enquiry-filters>
        ${[['all',s('all')],['new',s('newStatus')],['quoted',s('quoted')],['lost',s('lost')]]
          .map(([key,label])=>`<button class="chip ${key==='all'?'on':''}" data-status="${key}">${esc(label)}</button>`).join('')}
      </div><div class="grow"></div><small style="color:var(--muted)">${esc(s('dataLimit'))}</small></div>
      <div class="tablewrap" data-enquiry-table>${renderTable()}</div>
      ${!data.enquiries.length?`<div class="statepanel empty">${ic('chat')}<h3>${esc(s('emptyEnquiry'))}</h3><p>${esc(s('emptyHelp'))}</p></div>`:''}
    </section></div>`;
    const tableRoot=root.querySelector('[data-enquiry-table]');
    function wire(){
      wireTable(tableRoot,{onRow:id=>{
        const enquiry=data.enquiries.find(row=>Number(row.id)===Number(id));
        if(enquiry) openEnquiry(enquiry.id);
      }});
    }
    wire();
    root.querySelector('[data-new-enquiry]')?.addEventListener('click',()=>openNewEnquiry(data,()=>navigate('enquiries')));
    root.querySelectorAll('[data-enquiry-filters] [data-status]').forEach(button=>button.addEventListener('click',()=>{
      root.querySelector('[data-enquiry-filters] .chip.on')?.classList.remove('on');
      button.classList.add('on'); active=button.dataset.status;
      tableRoot.innerHTML=renderTable(); wire();
      root.querySelector('#salesEnquiryCount').textContent=String(filtered().length);
    }));
  };

  SCREENS['quotations']=async function(root){
    const s=copy(),data=await loadFrontData(),customers=byId(data.customers);
    let active='all';
    function filtered(){
      return active==='all'?data.quotations:data.quotations.filter(row=>row.status===active);
    }
    function renderTable(){
      return buildTable({
        rowId:row=>row.id,
        columns:[
          {label:s('quotations'),render:row=>`<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b><small>${esc(dateValue(row.quoteDate))}</small></div>`},
          {label:s('customer'),render:row=>esc((customers.get(Number(row.customerId))||{}).name||'#'+row.customerId)},
          {label:s('validUntil'),render:row=>esc(dateValue(row.validUntil))},
          {label:s('probability'),align:'r',render:row=>`<span class="tnum">${num(Number(row.probability))}%</span>`},
          {label:s('total'),align:'r',render:row=>`<b class="tnum">${esc(amountLabel(row.totalAmount,row.currency))}</b>`},
          {label:s('status'),render:row=>cap(statusLabel(s,row.status),statusTone(row.status))},
        ],rows:filtered(),
      });
    }
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,t('nav.sales'),s('quotations')])}${typeof salesNav==='function'?salesNav('quotations'):''}
        <div class="h1row"><h1>${esc(s('quotations'))}</h1><span class="countchip" id="salesQuoteCount">${data.quotations.length}</span>
          <div class="headright">${btn(s('newQuotation'),{icon:'plus',cls:'primary',attrs:'data-new-quotation'})}</div>
        </div><div class="h1sub">${esc(s('quotationHelp'))}</div>
      </div>
      <div class="toolbar"><div class="filterchips" data-quote-filters>
        ${[['all',s('all')],['draft',s('draft')],['sent',s('sent')],['accepted',s('acceptedStatus')],['converted',s('convertedStatus')]]
          .map(([key,label])=>`<button class="chip ${key==='all'?'on':''}" data-status="${key}">${esc(label)}</button>`).join('')}
      </div><div class="grow"></div><small style="color:var(--muted)">${esc(s('dataLimit'))}</small></div>
      <div class="tablewrap" data-quote-table>${renderTable()}</div>
      ${!data.quotations.length?`<div class="statepanel empty">${ic('receipt')}<h3>${esc(s('emptyQuotation'))}</h3><p>${esc(s('emptyHelp'))}</p></div>`:''}
    </section></div>`;
    const tableRoot=root.querySelector('[data-quote-table]');
    function wire(){ wireTable(tableRoot,{onRow:id=>openQuote(id)}); }
    wire();
    root.querySelector('[data-new-quotation]')?.addEventListener('click',()=>navigate('new-quotation'));
    root.querySelectorAll('[data-quote-filters] [data-status]').forEach(button=>button.addEventListener('click',()=>{
      root.querySelector('[data-quote-filters] .chip.on')?.classList.remove('on');
      button.classList.add('on'); active=button.dataset.status;
      tableRoot.innerHTML=renderTable(); wire();
      root.querySelector('#salesQuoteCount').textContent=String(filtered().length);
    }));
  };

  SCREENS['quotation']=async function(root){
    const s=copy(),data=await loadFrontData();
    const id=Number(window.ACTIVE_SALES_QUOTATION_ID)||Number(data.quotations[0]?.id);
    const quotation=data.quotations.find(row=>Number(row.id)===id)||data.quotations[0];
    if(!quotation){
      root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty">
        ${ic('receipt')}<h3>${esc(s('emptyQuotation'))}</h3><p>${esc(s('emptyHelp'))}</p></div></section></div>`;
      return;
    }
    window.ACTIVE_SALES_QUOTATION_ID=Number(quotation.id);
    const customer=byId(data.customers).get(Number(quotation.customerId))||{};
    const products=byId(data.products);
    const lines=data.lines.filter(row=>Number(row.quotationId)===Number(quotation.id))
      .sort((a,b)=>Number(a.lineNo)-Number(b.lineNo));
    const rows=lines.map((line,index)=>{
      const item=products.get(Number(line.productId))||{};
      return `<tr><td class="lineno">${index+1}</td><td class="l li-name"><b>${esc(item.name||'#'+line.productId)}</b>
        <small>${esc(item.sku||'')}</small></td><td class="tnum">${num(Number(line.qty))}</td>
        <td class="tnum">${esc(amountLabel(line.unitPrice,quotation.currency))}</td>
        <td class="tnum">${esc(amountLabel(line.netAmount,quotation.currency))}</td>
        <td class="tnum">${esc(amountLabel(line.taxAmount,quotation.currency))}</td></tr>`;
    }).join('');
    const actions=[
      quotation.status==='draft'?btn(s('issue'),{icon:'send',cls:'primary',attrs:'data-quote-action="issue"'}):'',
      quotation.status==='sent'?btn(s('accept'),{icon:'check',cls:'primary',attrs:'data-quote-action="accept"'}):'',
      quotation.status==='accepted'?btn(s('toOrder'),{icon:'bag',cls:'primary',attrs:'data-quote-action="convert-to-order"'}):'',
      quotation.status==='converted'&&quotation.orderId
        ?btn(s('toOrder'),{icon:'bag',cls:'primary',attrs:'data-view-order'}):'',
    ].join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="pagehead">
      ${crumbs([DB.company.name,{label:t('nav.sales'),route:'sales-home'},{label:s('quotations'),route:'quotations'},{cur:quotation.docNo}])}
      ${typeof salesNav==='function'?salesNav('quotations'):''}</div><div class="docwrap"><div class="docpage">
      <div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('receipt')}${esc(s('details'))}
        <span class="dnum">${esc(quotation.docNo)}</span></div>
        <div class="h1sub">${esc(customer.name||'#'+quotation.customerId)}</div></div>
        <div class="dactions">${cap(statusLabel(s,quotation.status),statusTone(quotation.status))}</div></div>
        <div class="docmeta">
          <div class="dm"><small>${esc(s('customer'))}</small><b>${esc(customer.name||'#'+quotation.customerId)}</b></div>
          <div class="dm"><small>${esc(s('quoteDate'))}</small><b>${esc(dateValue(quotation.quoteDate))}</b></div>
          <div class="dm"><small>${esc(s('validUntil'))}</small><b>${esc(dateValue(quotation.validUntil))}</b></div>
          <div class="dm"><small>${esc(s('probability'))}</small><b>${num(Number(quotation.probability))}%</b></div>
          <div class="dm"><small>${esc(s('currency'))}</small><b>${esc(quotation.currency)}</b></div>
        </div></div>
      <div class="doclayout"><div class="docmain"><div class="panel"><div class="panel-h"><h3>${esc(s('lines'))}</h3></div>
        <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('product'))}</th>
          <th>${esc(s('quantity'))}</th><th>${esc(s('unitPrice'))}</th><th>${esc(s('net'))}</th><th>${esc(s('tax'))}</th>
        </tr></thead><tbody>${rows}</tbody></table></div></div>
        <aside class="summary"><div class="sumcard"><div class="sumrow"><span class="sk2">${esc(s('net'))}</span>
          <span class="sv tnum">${esc(amountLabel(quotation.netAmount,quotation.currency))}</span></div>
          <div class="sumrow"><span class="sk2">${esc(s('tax'))}</span><span class="sv tnum">${esc(amountLabel(quotation.taxAmount,quotation.currency))}</span></div>
          <div class="sumrow total"><span class="sk2">${esc(s('total'))}</span><span class="sv tnum">${esc(amountLabel(quotation.totalAmount,quotation.currency))}</span></div>
        </div></aside></div>
      </div></div>
      <div class="set-savebar">${btn(s('back'),{icon:'chevL',cls:'soft',attrs:'data-back-quotes'})}<div class="grow"></div>${actions}</div>
    </section></div>`;
    root.querySelector('[data-back-quotes]')?.addEventListener('click',()=>navigate('quotations'));
    root.querySelector('[data-view-order]')?.addEventListener('click',()=>navigate('sales-order'));
    root.querySelectorAll('[data-quote-action]').forEach(button=>button.addEventListener('click',async()=>{
      const name=button.dataset.quoteAction; button.disabled=true;
      try{
        const payload=name==='convert-to-order'?{docNo:sequence('SO'),orderDate:today()}:{};
        const result=await adapter().action(
          'sales/quotations',quotation.id,name,payload,`sales-quotation-${quotation.id}-${name}`);
        if(name==='issue') toast(s('issued'),'ok');
        if(name==='accept') toast(s('accepted'),'ok');
        if(name==='convert-to-order'){
          toast(s('orderCreated'),'ok');
          navigate('sales-order',{no:result.data.orderDocNo});
          return;
        }
        navigate('quotation');
      }catch(error){ button.disabled=false; toast(error&&error.message||'Action failed','danger'); }
    }));
  };

  SCREENS['new-quotation']=async function(root){
    const s=copy(),data=await loadFrontData();
    const customerOptions=data.customers.map(row=>
      `<option value="${row.id}">${esc(row.code)} · ${esc(row.name)}</option>`).join('');
    const productOptions=data.products.map(row=>
      `<option value="${row.id}">${esc(row.sku)} · ${esc(row.name)}</option>`).join('');
    root.innerHTML=`<div class="content full"><section class="master">
      <div class="pagehead">${crumbs([DB.company.name,{label:t('nav.sales'),route:'sales-home'},{label:s('quotations'),route:'quotations'},{cur:s('newQuotation')}])}
        ${typeof salesNav==='function'?salesNav('quotations'):''}</div>
      <div class="docwrap"><div class="docpage"><div class="dochead"><div class="dh-row1"><div>
        <div class="dt">${ic('receipt')}${esc(s('newQuotation'))}</div>
        <div class="h1sub">${esc(s('quotationHelp'))}</div></div>${cap(s('draft'),'neutral')}</div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('details'))}</h3></div><div class="panel-body">
          <div class="fldrow c2"><div class="fld"><span>${esc(s('quotationNo'))}</span><input id="newQuoteNo" value="${esc(sequence('Q'))}"></div>
            <div class="fld"><span>${esc(s('customer'))}</span><select id="newQuoteCustomer">${customerOptions}</select></div></div>
          <div class="fldrow c3"><div class="fld"><span>${esc(s('quoteDate'))}</span><input id="newQuoteDate" type="date" value="${today()}"></div>
            <div class="fld"><span>${esc(s('validUntil'))}</span><input id="newQuoteValid" type="date" value="${plusDays(30)}"></div>
            <div class="fld"><span>${esc(s('probability'))}</span><input id="newQuoteProbability" type="number" min="0" max="100" value="50"></div></div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>${esc(s('lines'))}</h3></div><div class="panel-body">
          <div class="fld"><span>${esc(s('product'))}</span><select id="newQuoteProduct">${productOptions}</select></div>
          <div class="fldrow c2"><div class="fld"><span>${esc(s('quantity'))}</span><input id="newQuoteQty" type="number" min="0.0001" step="0.0001" value="1"></div>
            <div class="fld"><span>${esc(s('unitPrice'))}</span><input id="newQuotePrice" type="number" min="0" step="0.01" value="100"></div></div>
        </div></div>
      </div></div>
      <div class="set-savebar">${btn(s('cancel'),{icon:'chevL',cls:'soft',attrs:'data-cancel-quote'})}<div class="grow"></div>
        ${btn(s('create'),{icon:'plus',cls:'primary',attrs:'data-create-quote'})}</div>
    </section></div>`;
    root.querySelector('[data-cancel-quote]')?.addEventListener('click',()=>navigate('quotations'));
    root.querySelector('[data-create-quote]')?.addEventListener('click',async event=>{
      const button=event.currentTarget; button.disabled=true;
      try{
        const result=await adapter().create('sales/quotations',{
          docNo:root.querySelector('#newQuoteNo').value.trim(),
          customerId:Number(root.querySelector('#newQuoteCustomer').value),
          quoteDate:root.querySelector('#newQuoteDate').value,
          validUntil:root.querySelector('#newQuoteValid').value,
          currency:currency(),probability:root.querySelector('#newQuoteProbability').value,
          lines:[{
            productId:Number(root.querySelector('#newQuoteProduct').value),
            qty:root.querySelector('#newQuoteQty').value,
            unitPrice:root.querySelector('#newQuotePrice').value,
            taxCode:'SR',
          }],
        });
        toast(s('created'),'ok'); openQuote(result.data.id);
      }catch(error){ button.disabled=false; toast(error&&error.message||'Create failed','danger'); }
    });
  };
})();
