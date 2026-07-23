/* ============================================================
   ARIA ERP — canonical RMA / customer credit chain
   ============================================================ */
(function canonicalSalesReturnScreens(){
  function copy(){
    const lang=typeof getLang==='function'?getLang():'en';
    const packs={
      en:{returns:'Sales returns / RMA',returnDoc:'Sales return',creditNotes:'Credit notes',creditNote:'Credit note',
        newReturn:'New return',customer:'Customer',against:'Against invoice',delivery:'Delivery',
        reason:'Reason',date:'Date',status:'Status',items:'Returned items',product:'Product',warehouse:'Warehouse',
        qty:'Quantity',unitPrice:'Unit price',net:'Net',tax:'Tax',total:'Total',requested:'Requested',
        credited:'Credited',rejected:'Rejected',posted:'Posted',cancelled:'Cancelled',all:'All',
        receiveCredit:'Receive & issue credit',reject:'Reject return',created:'Return requested',
        creditedDone:'Return received and credited',rejectedDone:'Return rejected',create:'Create',cancel:'Cancel',
        empty:'No canonical returns yet.',emptyCredit:'No canonical credit notes yet.',
        help:'Returns are quantity-checked against delivered lines before inventory and AR are reversed.',
        creditHelp:'Posted customer credits generated from accepted returns.',creditNo:'Credit note number',
        returnNo:'Return number',movement:'Inventory restored',gl:'AR / revenue / tax reversed',
        limit:'Showing the first 100 canonical records.'},
      ms:{returns:'Pulangan jualan / RMA',returnDoc:'Pulangan jualan',creditNotes:'Nota kredit',creditNote:'Nota kredit',
        newReturn:'Pulangan baharu',customer:'Pelanggan',against:'Terhadap invois',delivery:'Penghantaran',
        reason:'Sebab',date:'Tarikh',status:'Status',items:'Item dipulangkan',product:'Produk',warehouse:'Gudang',
        qty:'Kuantiti',unitPrice:'Harga unit',net:'Bersih',tax:'Cukai',total:'Jumlah',requested:'Diminta',
        credited:'Dikreditkan',rejected:'Ditolak',posted:'Diposting',cancelled:'Dibatalkan',all:'Semua',
        receiveCredit:'Terima & keluarkan kredit',reject:'Tolak pulangan',created:'Pulangan diminta',
        creditedDone:'Pulangan diterima dan dikreditkan',rejectedDone:'Pulangan ditolak',create:'Cipta',cancel:'Batal',
        empty:'Belum ada pulangan kanonik.',emptyCredit:'Belum ada nota kredit kanonik.',
        help:'Kuantiti pulangan disemak terhadap baris penghantaran sebelum stok dan AR diterbalikkan.',
        creditHelp:'Kredit pelanggan diposting daripada pulangan yang diterima.',creditNo:'Nombor nota kredit',
        returnNo:'Nombor pulangan',movement:'Stok dipulihkan',gl:'AR / hasil / cukai diterbalikkan',
        limit:'Memaparkan 100 rekod kanonik pertama.'},
      zh:{returns:'销售退货 / RMA',returnDoc:'销售退货',creditNotes:'贷项通知单',creditNote:'贷项通知单',
        newReturn:'新建退货',customer:'客户',against:'原销售发票',delivery:'原交货单',
        reason:'退货原因',date:'日期',status:'状态',items:'退货项目',product:'产品',warehouse:'退货仓库',
        qty:'数量',unitPrice:'单价',net:'未税金额',tax:'税额',total:'总额',requested:'已申请',
        credited:'已贷记',rejected:'已拒绝',posted:'已过账',cancelled:'已取消',all:'全部',
        receiveCredit:'接收入库并开立贷项',reject:'拒绝退货',created:'退货申请已创建',
        creditedDone:'退货已入库并贷记',rejectedDone:'退货已拒绝',create:'创建',cancel:'取消',
        empty:'目前没有标准退货。',emptyCredit:'目前没有标准贷项通知单。',
        help:'系统先按原交货行核对累计退货数量，再回补库存并冲销应收。',
        creditHelp:'由已接受退货生成并过账的客户贷项。',creditNo:'贷项通知单编号',
        returnNo:'退货编号',movement:'库存已回补',gl:'应收 / 收入 / 税额已冲销',
        limit:'显示前 100 条标准记录。'},
      ja:{returns:'返品 / RMA',returnDoc:'売上返品',creditNotes:'クレジットノート',creditNote:'クレジットノート',
        newReturn:'返品を作成',customer:'顧客',against:'対象請求書',delivery:'出荷',
        reason:'理由',date:'日付',status:'ステータス',items:'返品明細',product:'製品',warehouse:'倉庫',
        qty:'数量',unitPrice:'単価',net:'税抜',tax:'税額',total:'合計',requested:'申請済',
        credited:'クレジット済',rejected:'却下',posted:'転記済',cancelled:'キャンセル',all:'すべて',
        receiveCredit:'受入・クレジット発行',reject:'返品を却下',created:'返品を申請しました',
        creditedDone:'返品受入とクレジットを完了しました',rejectedDone:'返品を却下しました',create:'作成',cancel:'キャンセル',
        empty:'標準返品はありません。',emptyCredit:'標準クレジットノートはありません。',
        help:'出荷数量を超えないことを確認してから在庫と売掛金を戻します。',
        creditHelp:'承認済返品から転記された顧客クレジットです。',creditNo:'クレジット番号',
        returnNo:'返品番号',movement:'在庫を戻しました',gl:'売掛金・売上・税を取り消しました',
        limit:'最初の100件の標準レコードを表示しています。'},
      vi:{returns:'Hàng bán trả lại / RMA',returnDoc:'Hàng bán trả lại',creditNotes:'Phiếu ghi có',creditNote:'Phiếu ghi có',
        newReturn:'Tạo trả hàng',customer:'Khách hàng',against:'Theo hóa đơn',delivery:'Giao hàng',
        reason:'Lý do',date:'Ngày',status:'Trạng thái',items:'Hàng trả lại',product:'Sản phẩm',warehouse:'Kho',
        qty:'Số lượng',unitPrice:'Đơn giá',net:'Trước thuế',tax:'Thuế',total:'Tổng cộng',requested:'Đã yêu cầu',
        credited:'Đã ghi có',rejected:'Từ chối',posted:'Đã ghi sổ',cancelled:'Đã hủy',all:'Tất cả',
        receiveCredit:'Nhận hàng & lập phiếu ghi có',reject:'Từ chối trả hàng',created:'Đã tạo yêu cầu trả hàng',
        creditedDone:'Đã nhận hàng và ghi có',rejectedDone:'Đã từ chối trả hàng',create:'Tạo',cancel:'Hủy',
        empty:'Chưa có trả hàng chuẩn.',emptyCredit:'Chưa có phiếu ghi có chuẩn.',
        help:'Số lượng trả được kiểm tra theo dòng giao hàng trước khi hoàn kho và đảo công nợ.',
        creditHelp:'Khoản ghi có khách hàng đã ghi sổ từ hàng trả được chấp nhận.',creditNo:'Số phiếu ghi có',
        returnNo:'Số trả hàng',movement:'Đã hoàn kho',gl:'Đã đảo công nợ / doanh thu / thuế',
        limit:'Hiển thị 100 bản ghi chuẩn đầu tiên.'},
    };
    const pack=packs[lang]||packs.en;
    return key=>pack[key]||packs.en[key]||key;
  }
  function adapter(){ if(!window.ErpSystemData) throw new Error('ERP data adapter is unavailable.'); return window.ErpSystemData; }
  function byId(rows){ return new Map((rows||[]).map(row=>[Number(row.id),row])); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function seq(prefix){ return `${prefix}-${Date.now().toString().slice(-7)}`; }
  function money(value,currency){
    try{return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||DB.company.currency||'SGD'}).format(Number(value||0));}
    catch{return Number(value||0).toFixed(2);}
  }
  function tone(status){return status==='credited'||status==='posted'?'ok':status==='rejected'||status==='cancelled'?'danger':'info';}
  function openReturn(id){window.ACTIVE_SALES_RETURN_ID=Number(id);navigate('sales-return');}
  function openCredit(id){window.ACTIVE_SALES_CREDIT_ID=Number(id);navigate('credit-note');}
  async function load(){
    const a=adapter(),pages=await Promise.all([
      a.list('sales/returns',{limit:100}),a.list('sales/return-lines',{limit:100}),
      a.list('sales/credit-notes',{limit:100}),a.list('sales/credit-note-lines',{limit:100}),
      a.list('sales/deliveries',{limit:100}),a.list('sales/delivery-lines',{limit:100}),
      a.list('sales/invoices',{limit:100}),a.list('sales/orders',{limit:100}),
      a.list('sales/customers',{limit:100}),a.list('inventory/products',{limit:100}),
      a.list('inventory/warehouses',{limit:100}),
    ]);
    const k=['returns','returnLines','credits','creditLines','deliveries','deliveryLines','invoices','orders','customers','products','warehouses'];
    return Object.fromEntries(k.map((key,index)=>[key,pages[index].data||[]]));
  }
  function customerFor(data,delivery){
    const order=byId(data.orders).get(Number(delivery?.orderId))||{};
    return byId(data.customers).get(Number(order.customerId))||{};
  }
  function returnTotal(data,row){
    return data.returnLines.filter(line=>Number(line.returnId)===Number(row.id))
      .reduce((sum,line)=>sum+Number(line.netAmount)+Number(line.taxAmount),0);
  }
  function newReturnModal(data,onDone){
    const s=copy(),products=byId(data.products),deliveries=byId(data.deliveries),invoices=byId(data.invoices);
    const options=data.deliveryLines.map(line=>{
      const delivery=deliveries.get(Number(line.deliveryId))||{};
      const invoice=invoices.get(Number(delivery.invoiceId))||{};
      const product=products.get(Number(line.productId))||{};
      return `<option value="${line.id}" data-delivery="${delivery.id}" data-invoice="${delivery.invoiceId}" data-warehouse="${line.warehouseId}">
        ${esc(delivery.docNo||'')} · ${esc(invoice.docNo||'')} · ${esc(product.sku||'')} · ${esc(product.name||'')}</option>`;
    }).join('');
    appModal({icon:'refresh',title:s('newReturn'),width:620,body:
      `<div class="fldrow c2"><div class="fld"><span>${esc(s('returnNo'))}</span><input id="returnNo" value="${esc(seq('RMA'))}"></div>
      <div class="fld"><span>${esc(s('date'))}</span><input id="returnDate" type="date" value="${today()}"></div></div>
      <div class="fld"><span>${esc(s('items'))}</span><select id="returnSourceLine">${options}</select></div>
      <div class="fldrow c2"><div class="fld"><span>${esc(s('qty'))}</span><input id="returnQty" type="number" min="0.0001" step="0.0001" value="1"></div>
      <div class="fld"><span>${esc(s('reason'))}</span><input id="returnReason" value="Fictional packaging damage"></div></div>`,
      actions:btn(s('cancel'),{cls:'soft',attrs:'data-return-cancel'})+btn(s('create'),{icon:'plus',cls:'primary',attrs:'data-return-create'})});
    document.querySelector('[data-return-cancel]')?.addEventListener('click',closeModal);
    document.querySelector('[data-return-create]')?.addEventListener('click',async event=>{
      const button=event.currentTarget,select=document.querySelector('#returnSourceLine'),option=select.selectedOptions[0];
      button.disabled=true;
      try{
        const result=await adapter().create('sales/returns',{
          docNo:document.querySelector('#returnNo').value.trim(),deliveryId:Number(option.dataset.delivery),
          invoiceId:Number(option.dataset.invoice),warehouseId:Number(option.dataset.warehouse),
          returnDate:document.querySelector('#returnDate').value,
          reason:document.querySelector('#returnReason').value.trim(),
          lines:[{deliveryLineId:Number(select.value),qty:document.querySelector('#returnQty').value}],
        });
        closeModal();toast(s('created'),'ok');onDone(result.data.id);
      }catch(error){button.disabled=false;toast(error&&error.message||'Create failed','danger');}
    });
  }

  SCREENS['sales-returns']=async function(root){
    const s=copy(),data=await load(),deliveries=byId(data.deliveries),invoices=byId(data.invoices);
    transactionListPage(root,{
      module:'sales',route:'sales-returns',title:s('returns'),description:s('help'),
      rows:data.returns,rowId:row=>row.id,note:s('limit'),
      primaryAction:{label:s('newReturn'),icon:'plus',onClick:()=>newReturnModal(data,id=>openReturn(id))},
      columns:[
        {label:s('returnDoc'),render:row=>`<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b><small>${esc(dateValue(row.returnDate))}</small></div>`},
        {label:s('customer'),render:row=>esc(customerFor(data,deliveries.get(Number(row.deliveryId))).name||'—')},
        {label:s('against'),render:row=>`<span class="mono">${esc((invoices.get(Number(row.invoiceId))||{}).docNo||'—')}</span>`},
        {label:s('reason'),render:row=>esc(row.reason)},
        {label:s('total'),align:'r',render:row=>`<b>${esc(money(returnTotal(data,row),(invoices.get(Number(row.invoiceId))||{}).currency))}</b>`},
        {label:s('status'),render:row=>cap(s(row.status),tone(row.status))},
      ],
      onOpen:row=>openReturn(row.id),
      empty:{icon:'refresh',title:s('empty'),description:s('help')},
    });
  };

  SCREENS['sales-return']=async function(root){
    const s=copy(),data=await load(),id=Number(window.ACTIVE_SALES_RETURN_ID)||Number(data.returns[0]?.id);
    const row=data.returns.find(item=>Number(item.id)===id)||data.returns[0];
    if(!row){root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty"><h3>${esc(s('empty'))}</h3></div></section></div>`;return;}
    window.ACTIVE_SALES_RETURN_ID=Number(row.id);
    const deliveries=byId(data.deliveries),invoices=byId(data.invoices),products=byId(data.products),warehouses=byId(data.warehouses);
    const delivery=deliveries.get(Number(row.deliveryId))||{},inv=invoices.get(Number(row.invoiceId))||{},cust=customerFor(data,delivery);
    const lines=data.returnLines.filter(line=>Number(line.returnId)===Number(row.id));
    const rows=lines.map((line,index)=>`<tr><td class="lineno">${index+1}</td><td class="l li-name"><b>${esc((products.get(Number(line.productId))||{}).name||'#'+line.productId)}</b></td>
      <td class="tnum">${num(Number(line.qty))}</td><td class="tnum">${esc(money(line.unitPrice,inv.currency))}</td>
      <td class="tnum">${esc(money(line.netAmount,inv.currency))}</td><td class="tnum">${esc(money(line.taxAmount,inv.currency))}</td></tr>`).join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="pagehead">${crumbs([DB.company.name,{label:t('nav.sales'),route:'sales-home'},{label:s('returns'),route:'sales-returns'},{cur:row.docNo}])}${salesNav('sales-returns')}</div>
      <div class="docwrap"><div class="docpage"><div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('refresh')}${esc(s('returnDoc'))} <span class="dnum">${esc(row.docNo)}</span></div>
      <div class="h1sub">${esc(cust.name||'—')} · ${esc(row.reason)}</div></div>${cap(s(row.status),tone(row.status))}</div>
      <div class="docmeta"><div class="dm"><small>${esc(s('against'))}</small><b>${esc(inv.docNo||'—')}</b></div><div class="dm"><small>${esc(s('delivery'))}</small><b>${esc(delivery.docNo||'—')}</b></div>
      <div class="dm"><small>${esc(s('warehouse'))}</small><b>${esc((warehouses.get(Number(row.warehouseId))||{}).name||'—')}</b></div><div class="dm"><small>${esc(s('date'))}</small><b>${esc(dateValue(row.returnDate))}</b></div></div></div>
      <div class="panel"><div class="panel-h"><h3>${esc(s('items'))}</h3></div><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('product'))}</th><th>${esc(s('qty'))}</th><th>${esc(s('unitPrice'))}</th><th>${esc(s('net'))}</th><th>${esc(s('tax'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div></div>${row.status==='requested'?`<div class="set-savebar"><div class="grow"></div>${btn(s('reject'),{icon:'x',cls:'soft',attrs:'data-return-action="reject"'})}${btn(s('receiveCredit'),{icon:'coins',cls:'primary',attrs:'data-return-action="receive-and-credit"'})}</div>`:''}</section></div>`;
    root.querySelectorAll('[data-return-action]').forEach(button=>button.addEventListener('click',async()=>{
      const action=button.dataset.returnAction;root.querySelectorAll('[data-return-action]').forEach(node=>node.disabled=true);
      try{
        const payload=action==='receive-and-credit'?{creditDocNo:seq('CN'),noteDate:today()}:{};
        const result=await adapter().action('sales/returns',row.id,action,payload,`sales-return-${row.id}-${action}`);
        toast(action==='reject'?s('rejectedDone'):s('creditedDone'),'ok');
        if(action==='receive-and-credit'){openCredit(result.data.creditNoteId);return;}navigate('sales-return');
      }catch(error){root.querySelectorAll('[data-return-action]').forEach(node=>node.disabled=false);toast(error&&error.message||'Action failed','danger');}
    }));
  };

  SCREENS['credit-notes']=async function(root){
    const s=copy(),data=await load(),invoices=byId(data.invoices);
    transactionListPage(root,{
      module:'sales',route:'credit-notes',title:s('creditNotes'),description:s('creditHelp'),
      rows:data.credits,rowId:row=>row.id,note:s('limit'),
      columns:[
        {label:s('creditNote'),render:row=>`<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b><small>${esc(dateValue(row.noteDate))}</small></div>`},
        {label:s('against'),render:row=>`<span class="mono">${esc((invoices.get(Number(row.invoiceId))||{}).docNo||'—')}</span>`},
        {label:s('net'),align:'r',render:row=>esc(money(row.netAmount,row.currency))},
        {label:s('tax'),align:'r',render:row=>esc(money(row.taxAmount,row.currency))},
        {label:s('total'),align:'r',render:row=>`<b>${esc(money(row.totalAmount,row.currency))}</b>`},
        {label:s('status'),render:row=>cap(s(row.status),tone(row.status))},
      ],
      onOpen:row=>openCredit(row.id),
      empty:{icon:'coins',title:s('emptyCredit'),description:s('creditHelp')},
    });
  };

  SCREENS['credit-note']=async function(root){
    const s=copy(),data=await load(),id=Number(window.ACTIVE_SALES_CREDIT_ID)||Number(data.credits[0]?.id);
    const credit=data.credits.find(row=>Number(row.id)===id)||data.credits[0];
    if(!credit){root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel empty"><h3>${esc(s('emptyCredit'))}</h3></div></section></div>`;return;}
    const inv=byId(data.invoices).get(Number(credit.invoiceId))||{},ret=byId(data.returns).get(Number(credit.returnId))||{};
    const creditLines=data.creditLines.filter(line=>Number(line.creditNoteId)===Number(credit.id)),products=byId(data.products);
    const rows=creditLines.map((line,index)=>`<tr><td class="lineno">${index+1}</td><td class="l">${esc((products.get(Number(line.productId))||{}).name||'#'+line.productId)}</td>
      <td class="tnum">${num(Number(line.qty))}</td><td class="tnum">${esc(money(line.netAmount,credit.currency))}</td><td class="tnum">${esc(money(line.taxAmount,credit.currency))}</td></tr>`).join('');
    root.innerHTML=`<div class="content full"><section class="master"><div class="pagehead">${crumbs([DB.company.name,{label:t('nav.sales'),route:'sales-home'},{label:s('creditNotes'),route:'credit-notes'},{cur:credit.docNo}])}${salesNav('credit-notes')}</div>
      <div class="docwrap"><div class="docpage"><div class="dochead"><div class="dh-row1"><div><div class="dt">${ic('coins')}${esc(s('creditNote'))} <span class="dnum">${esc(credit.docNo)}</span></div>
      <div class="h1sub">${esc(s('against'))} ${esc(inv.docNo||'—')} · ${esc(ret.docNo||'—')}</div></div>${cap(s(credit.status),tone(credit.status))}</div>
      <div class="docmeta"><div class="dm"><small>${esc(s('date'))}</small><b>${esc(dateValue(credit.noteDate))}</b></div><div class="dm"><small>${esc(s('net'))}</small><b>${esc(money(credit.netAmount,credit.currency))}</b></div>
      <div class="dm"><small>${esc(s('tax'))}</small><b>${esc(money(credit.taxAmount,credit.currency))}</b></div><div class="dm"><small>${esc(s('total'))}</small><b>${esc(money(credit.totalAmount,credit.currency))}</b></div></div></div>
      <div class="panel"><div class="panel-h"><h3>${esc(s('items'))}</h3></div><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('product'))}</th><th>${esc(s('qty'))}</th><th>${esc(s('net'))}</th><th>${esc(s('tax'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="doclayout"><div class="panel"><div class="panel-body">${indicator({tone:'ok',icon:'box',label:s('movement'),value:creditLines.length,sub:s('gl')})}</div></div></div>
      </div></div></section></div>`;
  };

  SCREENS['debit-notes']=async function(root){
    const lang=typeof getLang==='function'?getLang():'en';
    const packs={
      en:{title:'Debit notes',newNote:'New debit note',help:'Additional customer charges are drafted, then posted with balanced AR, revenue and output-tax legs.',invoice:'Invoice',reason:'Reason',date:'Date',net:'Net amount',tax:'Tax',total:'Total',status:'Status',post:'Post',create:'Create',cancel:'Cancel',empty:'No canonical debit notes yet.',created:'Debit note drafted',posted:'Debit note posted',number:'Debit note number'},
      ms:{title:'Nota debit',newNote:'Nota debit baharu',help:'Caj tambahan pelanggan didraf, kemudian diposting dengan kaki AR, hasil dan cukai output yang seimbang.',invoice:'Invois',reason:'Sebab',date:'Tarikh',net:'Amaun bersih',tax:'Cukai',total:'Jumlah',status:'Status',post:'Posting',create:'Cipta',cancel:'Batal',empty:'Belum ada nota debit kanonik.',created:'Nota debit didraf',posted:'Nota debit diposting',number:'Nombor nota debit'},
      zh:{title:'借项通知单',newNote:'新建借项通知单',help:'客户附加收费先保存为草稿，再以平衡的应收、收入和销项税分录过账。',invoice:'原销售发票',reason:'原因',date:'日期',net:'未税金额',tax:'税额',total:'总额',status:'状态',post:'过账',create:'创建',cancel:'取消',empty:'目前没有标准借项通知单。',created:'借项通知单草稿已创建',posted:'借项通知单已过账',number:'借项通知单编号'},
      ja:{title:'デビットノート',newNote:'デビットノートを作成',help:'顧客への追加請求をドラフトし、売掛金・売上・税の均衡仕訳で転記します。',invoice:'請求書',reason:'理由',date:'日付',net:'税抜金額',tax:'税額',total:'合計',status:'ステータス',post:'転記',create:'作成',cancel:'キャンセル',empty:'標準デビットノートはありません。',created:'デビットノートを作成しました',posted:'デビットノートを転記しました',number:'デビット番号'},
      vi:{title:'Phiếu ghi nợ',newNote:'Tạo phiếu ghi nợ',help:'Khoản thu thêm được lưu nháp rồi ghi sổ với công nợ, doanh thu và thuế đầu ra cân bằng.',invoice:'Hóa đơn',reason:'Lý do',date:'Ngày',net:'Trước thuế',tax:'Thuế',total:'Tổng cộng',status:'Trạng thái',post:'Ghi sổ',create:'Tạo',cancel:'Hủy',empty:'Chưa có phiếu ghi nợ chuẩn.',created:'Đã tạo phiếu ghi nợ nháp',posted:'Đã ghi sổ phiếu ghi nợ',number:'Số phiếu ghi nợ'},
    };
    const d=packs[lang]||packs.en,a=adapter();
    const pages=await Promise.all([
      a.list('sales/debit-notes',{limit:100}),a.list('sales/invoices',{limit:100}),
    ]);
    const notes=pages[0].data||[],invoices=byId(pages[1].data||[]);
    function openCreate(){
      const opts=(pages[1].data||[]).map(inv=>`<option value="${inv.id}">${esc(inv.docNo)} · ${esc(money(inv.totalAmount,inv.currency))}</option>`).join('');
      appModal({icon:'coins',title:d.newNote,width:560,body:`<div class="fldrow c2"><div class="fld"><span>${esc(d.number)}</span><input id="debitNo" value="${esc(seq('DN'))}"></div>
        <div class="fld"><span>${esc(d.date)}</span><input id="debitDate" type="date" value="${today()}"></div></div>
        <div class="fld"><span>${esc(d.invoice)}</span><select id="debitInvoice">${opts}</select></div>
        <div class="fldrow c2"><div class="fld"><span>${esc(d.net)}</span><input id="debitNet" type="number" min="0.01" step="0.01" value="10"></div>
        <div class="fld"><span>${esc(d.reason)}</span><input id="debitReason" value="Fictional handling charge"></div></div>`,
        actions:btn(d.cancel,{cls:'soft',attrs:'data-debit-cancel'})+btn(d.create,{icon:'plus',cls:'primary',attrs:'data-debit-create'})});
      document.querySelector('[data-debit-cancel]')?.addEventListener('click',closeModal);
      document.querySelector('[data-debit-create]')?.addEventListener('click',async event=>{
        const button=event.currentTarget;button.disabled=true;
        try{await a.create('sales/debit-notes',{docNo:document.querySelector('#debitNo').value.trim(),invoiceId:Number(document.querySelector('#debitInvoice').value),
          noteDate:document.querySelector('#debitDate').value,reason:document.querySelector('#debitReason').value.trim(),netAmount:document.querySelector('#debitNet').value,taxCode:'SR'});
          closeModal();toast(d.created,'ok');navigate('debit-notes');}catch(error){button.disabled=false;toast(error&&error.message||'Create failed','danger');}
      });
    }
    transactionListPage(root,{
      module:'sales',route:'debit-notes',title:d.title,description:d.help,
      rows:notes,rowId:row=>row.id,
      primaryAction:{label:d.newNote,icon:'plus',onClick:openCreate},
      columns:[
        {label:d.title,render:row=>`<div class="cellsub"><b class="docnum">${esc(row.docNo)}</b><small>${esc(dateValue(row.noteDate))}</small></div>`},
        {label:d.invoice,render:row=>`<span class="mono">${esc((invoices.get(Number(row.invoiceId))||{}).docNo||'—')}</span>`},
        {label:d.reason,render:row=>esc(row.reason)},
        {label:d.net,align:'r',render:row=>esc(money(row.netAmount,row.currency))},
        {label:d.tax,align:'r',render:row=>esc(money(row.taxAmount,row.currency))},
        {label:d.total,align:'r',render:row=>`<b>${esc(money(row.totalAmount,row.currency))}</b>`},
        {label:d.status,render:row=>cap(row.status,row.status==='posted'?'ok':'neutral')},
        {label:'',align:'r',render:row=>row.status==='draft'?`<span class="rowact">${btn(d.post,{icon:'check',cls:'primary',attrs:`data-post-debit="${row.id}"`})}</span>`:''},
      ],
      empty:{icon:'coins',title:d.empty,description:d.help},
      afterRender:({root:pageRoot})=>{
        pageRoot.querySelectorAll('[data-post-debit]').forEach(button=>button.addEventListener('click',async event=>{
          event.stopPropagation();button.disabled=true;
          try{await a.action('sales/debit-notes',Number(button.dataset.postDebit),'post',{},`post-sales-debit-${button.dataset.postDebit}`);
            toast(d.posted,'ok');navigate('debit-notes');}catch(error){button.disabled=false;toast(error&&error.message||'Post failed','danger');}
        }));
      },
    });
  };
})();
