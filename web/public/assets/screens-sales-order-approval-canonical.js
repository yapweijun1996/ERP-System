/* ============================================================
   ARIA ERP — canonical direct sales-order authoring + approval
   Formal ErpSystemData resources only; no sample sales datasets.
   Creating/approving is stock, invoice and GL neutral. Existing
   confirmation remains the only posting boundary.
   ============================================================ */
(function canonicalSalesOrderApprovalScreens(){
  function copy(){

    const packs={
      en:{newOrder:'New sales order',newSub:'Create a real order with effective-dated tax snapshots. Every direct order enters the audited approval queue before fulfilment.',orderNo:'Order number',orderDate:'Order date',customer:'Customer',currency:'Currency',lines:'Order lines',product:'Product',qty:'Quantity',unitPrice:'Unit price',taxCode:'Tax code',net:'Estimated net',addLine:'Add line',remove:'Remove',approvalReason:'Approval reason',reasonDefault:'Direct sales order requires approval.',taxHelp:'The server calculates authoritative tax from the rule effective on the order date.',back:'Back to orders',submit:'Submit for approval',creating:'Creating…',created:'Sales order submitted for approval',emptyCustomers:'No canonical customers are available.',emptyProducts:'No canonical products are available.',approvals:'Sales Order Approvals',approvalSub:'Review direct and quotation-converted orders before confirmation. Decisions are audited and do not move stock or post accounting.',all:'All',pending:'Pending',approved:'Approved',rejected:'Rejected',awaiting:'Awaiting approval',queueValue:'Value awaiting approval',order:'Sales order',submitted:'Submitted',status:'Decision',reason:'Approval trigger',review:'Review',approve:'Approve order',reject:'Reject order',approveTitle:'Approve sales order?',rejectTitle:'Reject sales order?',approvePrompt:'Record why this order may proceed to fulfilment.',rejectPrompt:'Record why this order must not proceed.',note:'Decision note',notePlaceholder:'Enter a concise, auditable reason…',cancel:'Cancel',confirm:'Confirm decision',approvedDone:'Sales order approved and released as draft',rejectedDone:'Sales order rejected',decision:'Decision record',decidedBy:'Decided by',decidedAt:'Decided at',orderStatus:'Order status',boundary:'Approval changes document state only. Stock, delivery, invoice and GL begin only when an approved draft is confirmed.',empty:'There are no canonical sales-order approval requests in this company.',dataLimit:'Showing the first 100 canonical requests.'},
      ms:{newOrder:'Pesanan jualan baharu',newSub:'Cipta pesanan sebenar dengan petikan cukai mengikut tarikh. Setiap pesanan terus memasuki barisan kelulusan beraudit sebelum pemenuhan.',orderNo:'Nombor pesanan',orderDate:'Tarikh pesanan',customer:'Pelanggan',currency:'Mata wang',lines:'Baris pesanan',product:'Produk',qty:'Kuantiti',unitPrice:'Harga unit',taxCode:'Kod cukai',net:'Anggaran bersih',addLine:'Tambah baris',remove:'Buang',approvalReason:'Sebab kelulusan',reasonDefault:'Pesanan jualan terus memerlukan kelulusan.',taxHelp:'Pelayan mengira cukai muktamad daripada peraturan yang berkuat kuasa pada tarikh pesanan.',back:'Kembali ke pesanan',submit:'Hantar untuk kelulusan',creating:'Mencipta…',created:'Pesanan jualan dihantar untuk kelulusan',emptyCustomers:'Tiada pelanggan kanonik tersedia.',emptyProducts:'Tiada produk kanonik tersedia.',approvals:'Kelulusan Pesanan Jualan',approvalSub:'Semak pesanan terus dan pesanan daripada sebut harga sebelum pengesahan. Keputusan diaudit tanpa pergerakan stok atau perakaunan.',all:'Semua',pending:'Menunggu',approved:'Diluluskan',rejected:'Ditolak',awaiting:'Menunggu kelulusan',queueValue:'Nilai menunggu kelulusan',order:'Pesanan jualan',submitted:'Dihantar',status:'Keputusan',reason:'Pencetus kelulusan',review:'Semak',approve:'Luluskan pesanan',reject:'Tolak pesanan',approveTitle:'Luluskan pesanan jualan?',rejectTitle:'Tolak pesanan jualan?',approvePrompt:'Catat sebab pesanan boleh diteruskan ke pemenuhan.',rejectPrompt:'Catat sebab pesanan tidak boleh diteruskan.',note:'Nota keputusan',notePlaceholder:'Masukkan sebab ringkas yang boleh diaudit…',cancel:'Batal',confirm:'Sahkan keputusan',approvedDone:'Pesanan diluluskan dan dilepaskan sebagai draf',rejectedDone:'Pesanan jualan ditolak',decision:'Rekod keputusan',decidedBy:'Diputuskan oleh',decidedAt:'Masa keputusan',orderStatus:'Status pesanan',boundary:'Kelulusan hanya mengubah status dokumen. Stok, penghantaran, invois dan GL bermula selepas draf diluluskan dan disahkan.',empty:'Tiada permintaan kelulusan pesanan jualan kanonik untuk syarikat ini.',dataLimit:'Memaparkan 100 permintaan kanonik pertama.'},
      zh:{newOrder:'新建销售订单',newSub:'创建真实销售订单，并按订单日期保存有效税率快照。每张直接订单在履约前都必须进入可审计审批队列。',orderNo:'订单编号',orderDate:'订单日期',customer:'客户',currency:'币种',lines:'订单明细',product:'产品',qty:'数量',unitPrice:'单价',taxCode:'税码',net:'预计未税金额',addLine:'添加明细',remove:'删除',approvalReason:'审批原因',reasonDefault:'直接创建的销售订单需要审批。',taxHelp:'服务器将根据订单日期生效的税务规则计算最终税额。',back:'返回销售订单',submit:'提交审批',creating:'正在创建…',created:'销售订单已提交审批',emptyCustomers:'目前没有可用的标准客户。',emptyProducts:'目前没有可用的标准产品。',approvals:'销售订单审批',approvalSub:'在确认前审核直接订单和报价转订单。所有决定均可审计，审批本身不移动库存或过账会计。',all:'全部',pending:'待审批',approved:'已批准',rejected:'已拒绝',awaiting:'待审批数量',queueValue:'待审批金额',order:'销售订单',submitted:'提交时间',status:'审批结果',reason:'审批触发原因',review:'审核',approve:'批准订单',reject:'拒绝订单',approveTitle:'批准这张销售订单？',rejectTitle:'拒绝这张销售订单？',approvePrompt:'请记录允许订单进入履约流程的原因。',rejectPrompt:'请记录不允许订单继续执行的原因。',note:'审批备注',notePlaceholder:'请输入简洁、可审计的原因…',cancel:'取消',confirm:'确认决定',approvedDone:'销售订单已批准并释放为草稿',rejectedDone:'销售订单已拒绝',decision:'审批记录',decidedBy:'审批人',decidedAt:'审批时间',orderStatus:'订单状态',boundary:'审批只改变单据状态；只有批准后的草稿被确认时，才会产生库存、交货、发票和总账记录。',empty:'当前公司没有标准销售订单审批申请。',dataLimit:'显示前 100 条标准审批申请。'},
      ja:{newOrder:'受注を作成',newSub:'有効日付き税率スナップショットを持つ実受注を作成します。直接受注は出荷前に監査可能な承認待ちになります。',orderNo:'受注番号',orderDate:'受注日',customer:'顧客',currency:'通貨',lines:'受注明細',product:'製品',qty:'数量',unitPrice:'単価',taxCode:'税コード',net:'税抜見込',addLine:'明細を追加',remove:'削除',approvalReason:'承認理由',reasonDefault:'直接受注には承認が必要です。',taxHelp:'サーバーは受注日に有効な税務ルールから確定税額を計算します。',back:'受注一覧へ戻る',submit:'承認申請',creating:'作成中…',created:'受注を承認申請しました',emptyCustomers:'利用可能な標準顧客がありません。',emptyProducts:'利用可能な標準製品がありません。',approvals:'受注承認',approvalSub:'直接受注と見積変換受注を確定前に審査します。判断は監査され、在庫・会計は転記しません。',all:'すべて',pending:'承認待ち',approved:'承認済',rejected:'却下',awaiting:'承認待ち',queueValue:'承認待ち金額',order:'受注',submitted:'申請日時',status:'判断',reason:'承認トリガー',review:'確認',approve:'受注を承認',reject:'受注を却下',approveTitle:'受注を承認しますか？',rejectTitle:'受注を却下しますか？',approvePrompt:'この受注を出荷へ進める理由を記録してください。',rejectPrompt:'この受注を進めない理由を記録してください。',note:'判断メモ',notePlaceholder:'簡潔で監査可能な理由を入力…',cancel:'キャンセル',confirm:'判断を確定',approvedDone:'受注を承認しドラフトへ解放しました',rejectedDone:'受注を却下しました',decision:'判断記録',decidedBy:'判断者',decidedAt:'判断日時',orderStatus:'受注ステータス',boundary:'承認は伝票状態のみ変更します。在庫、出荷、請求、GL は承認済ドラフトの確定時にのみ開始します。',empty:'この会社には標準受注承認申請がありません。',dataLimit:'最初の100件の標準申請を表示しています。'},
      vi:{newOrder:'Tạo đơn bán hàng',newSub:'Tạo đơn thực với ảnh chụp thuế theo ngày hiệu lực. Mọi đơn trực tiếp phải vào hàng đợi phê duyệt có kiểm toán trước khi thực hiện.',orderNo:'Số đơn hàng',orderDate:'Ngày đặt hàng',customer:'Khách hàng',currency:'Tiền tệ',lines:'Dòng đơn hàng',product:'Sản phẩm',qty:'Số lượng',unitPrice:'Đơn giá',taxCode:'Mã thuế',net:'Ước tính trước thuế',addLine:'Thêm dòng',remove:'Xóa',approvalReason:'Lý do phê duyệt',reasonDefault:'Đơn bán hàng trực tiếp cần được phê duyệt.',taxHelp:'Máy chủ tính thuế chính thức theo quy tắc có hiệu lực vào ngày đặt hàng.',back:'Quay lại đơn hàng',submit:'Gửi phê duyệt',creating:'Đang tạo…',created:'Đã gửi đơn bán hàng để phê duyệt',emptyCustomers:'Không có khách hàng chuẩn.',emptyProducts:'Không có sản phẩm chuẩn.',approvals:'Phê duyệt đơn bán hàng',approvalSub:'Xem xét đơn trực tiếp và đơn chuyển từ báo giá trước khi xác nhận. Quyết định được kiểm toán, không ghi kho hay kế toán.',all:'Tất cả',pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Đã từ chối',awaiting:'Đang chờ duyệt',queueValue:'Giá trị chờ duyệt',order:'Đơn bán hàng',submitted:'Đã gửi',status:'Quyết định',reason:'Lý do kích hoạt',review:'Xem xét',approve:'Duyệt đơn',reject:'Từ chối đơn',approveTitle:'Duyệt đơn bán hàng?',rejectTitle:'Từ chối đơn bán hàng?',approvePrompt:'Ghi lý do cho phép đơn chuyển sang thực hiện.',rejectPrompt:'Ghi lý do không cho phép đơn tiếp tục.',note:'Ghi chú quyết định',notePlaceholder:'Nhập lý do ngắn gọn, có thể kiểm toán…',cancel:'Hủy',confirm:'Xác nhận quyết định',approvedDone:'Đã duyệt và mở đơn ở trạng thái nháp',rejectedDone:'Đã từ chối đơn bán hàng',decision:'Biên bản quyết định',decidedBy:'Người quyết định',decidedAt:'Thời điểm quyết định',orderStatus:'Trạng thái đơn',boundary:'Phê duyệt chỉ đổi trạng thái chứng từ. Kho, giao hàng, hóa đơn và GL chỉ bắt đầu khi xác nhận bản nháp đã duyệt.',empty:'Không có yêu cầu phê duyệt đơn bán hàng chuẩn trong công ty này.',dataLimit:'Hiển thị 100 yêu cầu chuẩn đầu tiên.'},
    };
    const lineCopy={
      en:{addStockLine:'Add stock line',addNewStockItem:'Add new stock item',addServiceLine:'Add service line',lineTypeStock:'Stock item',lineTypeNonStock:'Service / free text',description:'Description',descriptionPlaceholder:'Describe the product or service',uom:'UoM',selectProduct:'Select a product',noLines:'No order lines yet.',noLinesHelp:'Add a standard stock item or enter a service description.',noProductsHelp:'There are no standard products yet. Create one here or add a service description without creating inventory master data.',newProduct:'Create stock item',sku:'SKU',itemName:'Item name',category:'Category',baseUom:'Base UoM',createAndAdd:'Create and add',creating:'Creating…',itemCreated:'Stock item created and added to the order.',itemRequired:'Enter both an SKU and item name.',createFailed:'Could not create the stock item.',serviceHelp:'Service lines do not reserve or deduct inventory.',lineRequired:'Add at least one complete order line.',customerRequired:'Select a customer before submitting the order.',newItemHint:'Starts with zero stock; receive stock later through the inventory ledger.'},
      ms:{addStockLine:'Tambah baris stok',addNewStockItem:'Tambah item stok baharu',addServiceLine:'Tambah baris perkhidmatan',lineTypeStock:'Item stok',lineTypeNonStock:'Perkhidmatan / teks bebas',description:'Penerangan',descriptionPlaceholder:'Terangkan produk atau perkhidmatan',uom:'UoM',selectProduct:'Pilih produk',noLines:'Belum ada baris pesanan.',noLinesHelp:'Tambah item stok standard atau masukkan penerangan perkhidmatan.',noProductsHelp:'Tiada produk standard lagi. Cipta satu di sini atau tambah penerangan perkhidmatan tanpa mencipta data inventori.',newProduct:'Cipta item stok',sku:'SKU',itemName:'Nama item',category:'Kategori',baseUom:'UoM asas',createAndAdd:'Cipta dan tambah',creating:'Mencipta…',itemCreated:'Item stok dicipta dan ditambah kepada pesanan.',itemRequired:'Masukkan SKU dan nama item.',createFailed:'Item stok tidak dapat dicipta.',serviceHelp:'Baris perkhidmatan tidak menempah atau menolak inventori.',lineRequired:'Tambah sekurang-kurangnya satu baris pesanan yang lengkap.',customerRequired:'Pilih pelanggan sebelum menghantar pesanan.',newItemHint:'Bermula dengan stok sifar; terima stok kemudian melalui lejar inventori.'},
      zh:{addStockLine:'添加库存行',addNewStockItem:'新增库存商品',addServiceLine:'添加服务行',lineTypeStock:'库存商品',lineTypeNonStock:'服务 / 自由文本',description:'描述',descriptionPlaceholder:'输入产品或服务说明',uom:'单位',selectProduct:'选择产品',noLines:'尚未添加订单明细。',noLinesHelp:'添加标准库存商品，或直接输入服务说明。',noProductsHelp:'当前还没有标准产品。可以在这里创建商品，也可以直接添加服务说明，不建立库存主数据。',newProduct:'创建库存商品',sku:'SKU',itemName:'商品名称',category:'类别',baseUom:'基本单位',createAndAdd:'创建并加入',creating:'正在创建…',itemCreated:'库存商品已创建并加入订单。',itemRequired:'请输入 SKU 和商品名称。',createFailed:'无法创建库存商品。',serviceHelp:'服务行不会预留或扣减库存。',lineRequired:'请至少添加一条完整的订单明细。',customerRequired:'提交订单前请选择客户。',newItemHint:'新商品从零库存开始，之后通过库存台账收货。'},
      ja:{addStockLine:'在庫行を追加',addNewStockItem:'在庫品目を追加',addServiceLine:'サービス行を追加',lineTypeStock:'在庫品目',lineTypeNonStock:'サービス / フリーテキスト',description:'説明',descriptionPlaceholder:'製品またはサービスを説明',uom:'単位',selectProduct:'製品を選択',noLines:'受注明細はまだありません。',noLinesHelp:'標準在庫品目を追加するか、サービス説明を入力してください。',noProductsHelp:'標準製品がまだありません。ここで作成するか、在庫マスタを作らずサービス説明を追加できます。',newProduct:'在庫品目を作成',sku:'SKU',itemName:'品目名',category:'カテゴリ',baseUom:'基本単位',createAndAdd:'作成して追加',creating:'作成中…',itemCreated:'在庫品目を作成して受注に追加しました。',itemRequired:'SKU と品目名を入力してください。',createFailed:'在庫品目を作成できませんでした。',serviceHelp:'サービス行は在庫を引当・減算しません。',lineRequired:'完全な受注明細を1行以上追加してください。',customerRequired:'受注を送信する前に顧客を選択してください。',newItemHint:'在庫ゼロで開始し、後で在庫台帳から入庫します。'},
      vi:{addStockLine:'Thêm dòng tồn kho',addNewStockItem:'Thêm mặt hàng tồn kho',addServiceLine:'Thêm dòng dịch vụ',lineTypeStock:'Mặt hàng tồn kho',lineTypeNonStock:'Dịch vụ / văn bản tự do',description:'Mô tả',descriptionPlaceholder:'Mô tả sản phẩm hoặc dịch vụ',uom:'ĐVT',selectProduct:'Chọn sản phẩm',noLines:'Chưa có dòng đơn hàng.',noLinesHelp:'Thêm mặt hàng tồn kho chuẩn hoặc nhập mô tả dịch vụ.',noProductsHelp:'Chưa có sản phẩm chuẩn. Tạo sản phẩm tại đây hoặc thêm mô tả dịch vụ mà không tạo dữ liệu gốc tồn kho.',newProduct:'Tạo mặt hàng tồn kho',sku:'SKU',itemName:'Tên mặt hàng',category:'Danh mục',baseUom:'ĐVT cơ bản',createAndAdd:'Tạo và thêm',creating:'Đang tạo…',itemCreated:'Đã tạo mặt hàng tồn kho và thêm vào đơn hàng.',itemRequired:'Nhập SKU và tên mặt hàng.',createFailed:'Không thể tạo mặt hàng tồn kho.',serviceHelp:'Dòng dịch vụ không giữ chỗ hoặc trừ tồn kho.',lineRequired:'Thêm ít nhất một dòng đơn hàng hoàn chỉnh.',customerRequired:'Chọn khách hàng trước khi gửi đơn.',newItemHint:'Bắt đầu với tồn kho bằng không; nhập kho sau qua sổ tồn kho.'},
    };
    Object.keys(lineCopy).forEach(locale=>Object.assign(packs[locale],lineCopy[locale]));
    const pack=i18nLegacy(packs);
    return key=>pack[key]||packs.en[key]||key;
  }

  function adapter(){
    if(!window.ErpSystemData) throw new Error('ERP data adapter is unavailable.');
    return window.ErpSystemData;
  }
  function today(){return typeof workingBusinessDate==='function'?workingBusinessDate():new Date().toISOString().slice(0,10);}
  function sequence(){return `SO-${Date.now().toString().slice(-8)}`;}
  function currency(){return DB.company&&DB.company.currency||'SGD';}
  function taxCode(){return DB.company&&DB.company.country==='MY'?'SV':'SR';}
  function amount(value,code){
    try{return new Intl.NumberFormat(undefined,{style:'currency',currency:code||currency()}).format(Number(value||0));}
    catch{return `${code||currency()} ${Number(value||0).toFixed(2)}`;}
  }
  function label(s,status){return s(status==='pending'?'pending':status==='approved'?'approved':'rejected');}
  function tone(status){return status==='approved'?'ok':status==='rejected'?'danger':'warn';}
  function lineNet(line){return Number(line.qty||0)*Number(line.unitPrice||0);}

  async function loadAuthoringData(){
    const customers=await adapter().list('sales/customers',{limit:100});
    let products={data:[]},productReadDenied=false;
    try{products=await adapter().list('inventory/products',{limit:100});}
    catch(error){if(error&&error.status===403)productReadDenied=true;else throw error;}
    return {customers:customers.data||[],products:products.data||[],productReadDenied};
  }

  SCREENS['new-sales-order']=async function(root){
    const s=copy(),data=await loadAuthoringData();
    const state={lines:[],idempotencyKey:`sales-order-create-${Date.now()}-${Math.random().toString(36).slice(2,8)}`};
    const productById=new Map(data.products.map(row=>[Number(row.id),row]));
    function productOptions(selected){return `<option value="">${esc(s('selectProduct'))}</option>${data.products.map(row=>`<option value="${row.id}" ${Number(selected)===Number(row.id)?'selected':''}>${esc(row.sku)} · ${esc(row.name)}</option>`).join('')}`;}
    function newLine(lineType){return {lineType,productId:null,description:'',uom:'unit',qty:'1',unitPrice:'0.00',taxCode:taxCode()};}
    function appendStockLine(productId=null){
      const item=productById.get(Number(productId));
      state.lines.push({lineType:'stock',productId:item?Number(item.id):null,description:item?.name||'',uom:item?.uom||'unit',qty:'1',unitPrice:'0.00',taxCode:taxCode()});
      renderLines();
      setTimeout(()=>root.querySelector(`[data-line="${state.lines.length-1}"] [data-product]`)?.focus(),0);
    }
    function appendServiceLine(){
      state.lines.push(newLine('non_stock'));
      renderLines();
      setTimeout(()=>root.querySelector(`[data-line="${state.lines.length-1}"] [data-description]`)?.focus(),0);
    }
    function renderLines(){
      const body=root.querySelector('[data-so-lines]');if(!body)return;
      body.innerHTML=state.lines.length?state.lines.map((line,index)=>{
        const stock=line.lineType==='stock',item=productById.get(Number(line.productId));
        return `<tr data-line="${index}" data-line-type="${esc(line.lineType)}"><td class="lineno" data-label="#">${index+1}</td><td class="l" data-label="${esc(s('product'))}">${stock?`<select class="lineinput" data-product aria-label="${esc(s('product'))} ${index+1}">${productOptions(line.productId)}</select>`:`<span class="cap info" data-business-text><span class="dot"></span>${esc(s('lineTypeNonStock'))}</span>`}</td><td class="l line-description-cell" data-label="${esc(s('description'))}"><input class="lineinput l" data-description maxlength="500" value="${esc(line.description)}" placeholder="${esc(stock?(item?.name||s('selectProduct')):s('descriptionPlaceholder'))}" aria-label="${esc(s('description'))} ${index+1}"></td><td data-label="${esc(s('qty'))}"><input class="lineinput" data-qty type="number" min="0.0001" step="0.0001" value="${esc(line.qty)}" aria-label="${esc(s('qty'))} ${index+1}"></td><td data-label="${esc(s('uom'))}"><input class="lineinput line-uom-input" data-uom maxlength="40" value="${esc(line.uom)}" aria-label="${esc(s('uom'))} ${index+1}" ${stock&&item?'readonly':''}></td><td data-label="${esc(s('unitPrice'))}"><input class="lineinput" data-price type="number" min="0" step="0.0001" value="${esc(line.unitPrice)}" aria-label="${esc(s('unitPrice'))} ${index+1}"></td><td data-label="${esc(s('taxCode'))}"><input class="lineinput" data-tax maxlength="12" value="${esc(line.taxCode)}" aria-label="${esc(s('taxCode'))} ${index+1}"></td><td class="tnum" data-label="${esc(s('net'))}"><b data-line-net>${amount(lineNet(line))}</b></td><td style="text-align:center"><button class="iconbtn" data-remove data-tip="${esc(s('remove'))}" aria-label="${esc(s('remove'))}">${ic('trash')}</button></td></tr>`;
      }).join(''):`<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px"><div class="sales-order-lines-empty">${ic('box')}<b>${esc(s('noLines'))}</b><small data-business-text>${esc(data.products.length?s('noLinesHelp'):s('noProductsHelp'))}</small></div></td></tr>`;
      body.querySelectorAll('tr[data-line]').forEach(row=>{
        const index=Number(row.dataset.line),line=state.lines[index];
        row.querySelector('[data-product]')?.addEventListener('change',event=>{line.productId=Number(event.target.value)||null;const item=productById.get(Number(line.productId));line.description=item?.name||'';line.uom=item?.uom||'unit';renderLines();});
        row.querySelector('[data-qty]').addEventListener('input',event=>{line.qty=event.target.value;refreshTotals();});
        row.querySelector('[data-price]').addEventListener('input',event=>{line.unitPrice=event.target.value;refreshTotals();});
        row.querySelector('[data-tax]').addEventListener('input',event=>{line.taxCode=event.target.value.trim().toUpperCase();});
        row.querySelector('[data-description]')?.addEventListener('input',event=>{line.description=event.target.value;});
        row.querySelector('[data-uom]')?.addEventListener('input',event=>{line.uom=event.target.value;});
        row.querySelector('[data-remove]').addEventListener('click',()=>{state.lines.splice(index,1);renderLines();refreshTotals();});
      });
      refreshTotals();
    }
    function refreshTotals(){
      root.querySelectorAll('tr[data-line]').forEach(row=>{const line=state.lines[Number(row.dataset.line)];const el=row.querySelector('[data-line-net]');if(el)el.textContent=amount(lineNet(line));});
      const total=state.lines.reduce((sum,line)=>sum+lineNet(line),0);
      const target=root.querySelector('[data-so-net]');if(target)target.textContent=amount(total);
    }
    function openQuickProduct(){
      const suggestedSku=`ITEM-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      const categories=['Components','Raw Materials','Finished Goods','Consumables','Packaging'];
      const uoms=['unit','ea','set','box','kg','g','m','cm','L','sheet','pair'];
      appModal({icon:'box',title:s('newProduct'),width:'min(620px, calc(100vw - 24px))',body:`<p class="h1sub" style="margin:0 0 16px">${esc(s('newItemHint'))}</p><div class="fldrow c2"><label class="fld"><span>${esc(s('sku'))} <span class="req">*</span></span><input data-so-product-sku maxlength="80" autocomplete="off" value="${esc(suggestedSku)}" style="text-transform:uppercase"></label><label class="fld"><span>${esc(s('itemName'))} <span class="req">*</span></span><input data-so-product-name maxlength="200" autocomplete="off" autofocus></label><label class="fld"><span>${esc(s('category'))}</span><select data-so-product-category>${categories.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label><label class="fld"><span>${esc(s('baseUom'))}</span><select data-so-product-uom>${uoms.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label></div><div class="risk danger" data-so-product-error role="alert" aria-live="polite" hidden></div>`,actions:btn(s('cancel'),{cls:'soft',attrs:'data-so-product-cancel'})+btn(s('createAndAdd'),{icon:'plus',cls:'primary',attrs:'data-so-product-create'})});
      const modal=document.querySelector('#modalEl'),skuInput=modal?.querySelector('[data-so-product-sku]'),nameInput=modal?.querySelector('[data-so-product-name]'),errorBox=modal?.querySelector('[data-so-product-error]');
      modal?.querySelector('[data-so-product-cancel]')?.addEventListener('click',closeModal);
      skuInput?.addEventListener('input',()=>{skuInput.value=skuInput.value.toUpperCase();});
      modal?.querySelector('[data-so-product-create]')?.addEventListener('click',async event=>{
        const button=event.currentTarget,sku=skuInput?.value.trim().toUpperCase()||'',name=nameInput?.value.trim()||'';
        if(!sku||!name){if(errorBox){errorBox.textContent=s('itemRequired');errorBox.hidden=false;}(!sku?skuInput:nameInput)?.focus();return;}
        button.disabled=true;const original=button.innerHTML;button.textContent=s('creating');
        try{
          const category=modal.querySelector('[data-so-product-category]').value,uom=modal.querySelector('[data-so-product-uom]').value;
          const result=await adapter().create('inventory/products',{sku,name,category,uom,standardCost:'0',reorderPoint:'0',reorderQty:'0'},`sales-order-product-${sku}`);
          const created={id:Number(result.data.id),sku,name,category,uom,standardCost:'0',reorderPoint:'0',reorderQty:'0'};
          data.products.push(created);productById.set(created.id,created);closeModal();appendStockLine(created.id);toast(s('itemCreated'),'ok');
        }catch(error){button.disabled=false;button.innerHTML=original;if(errorBox){errorBox.textContent=error&&error.message||s('createFailed');errorBox.hidden=false;}toast(error&&error.message||s('createFailed'),'danger');}
      });
      setTimeout(()=>nameInput?.focus(),80);
    }
    const customerOptions=data.customers.map(row=>`<option value="${row.id}">${esc(row.code)} · ${esc(row.name)}</option>`).join('');
    root.innerHTML=`<div class="content full"><section class="master" data-canonical-sales-order-authoring="true"><div class="scrollarea"><div class="pagehead">${crumbs([DB.company.name,{label:t('nav.sales'),route:'sales-home'},{label:'Sales Orders',route:'sales-orders'},{cur:s('newOrder')}])}${salesNav('sales-orders')}<div class="h1row" style="margin-top:13px"><h1>${esc(s('newOrder'))}</h1>${cap(s('pending'),'warn')}</div><div class="h1sub">${esc(s('newSub'))}</div></div>
      ${!data.customers.length?`<div class="statepanel empty">${ic('bag')}<h3>${esc(s('emptyCustomers'))}</h3></div>`:`<div class="docwrap"><div class="docpage"><div class="doclayout"><div class="docmain"><div class="panel"><div class="panel-h">${ic('receipt')}<h3>${esc(s('newOrder'))}</h3></div><div class="panel-body"><div class="fldrow c2"><div class="fld"><span>${esc(s('orderNo'))}</span><input id="canonicalSoNo" value="${esc(sequence())}"></div><div class="fld"><span>${esc(s('orderDate'))}</span><input id="canonicalSoDate" type="date" value="${today()}"></div></div><div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(s('customer'))}</span><select id="canonicalSoCustomer">${customerOptions}</select></div><div class="fld"><span>${esc(s('currency'))}</span><input id="canonicalSoCurrency" maxlength="3" value="${esc(currency())}"></div></div><div class="fld" style="margin-top:12px"><span>${esc(s('approvalReason'))}</span><input id="canonicalSoReason" maxlength="1000" value="${esc(s('reasonDefault'))}"></div></div></div>
        <div class="panel"><div class="panel-h">${ic('box')}<h3>${esc(s('lines'))}</h3><div class="grow"></div><div class="sales-order-line-actions">${btn(s('addStockLine'),{icon:'plus',cls:'soft',attrs:'data-add-stock-line'})}${btn(s('addNewStockItem'),{icon:'tag',cls:'soft',attrs:'data-add-new-stock'})}${btn(s('addServiceLine'),{icon:'edit',cls:'soft',attrs:'data-add-service-line'})}</div></div><div class="tablewrap"><table class="lines sales-order-lines-table"><thead><tr><th class="lineno">#</th><th class="l">${esc(s('product'))}</th><th class="l">${esc(s('description'))}</th><th>${esc(s('qty'))}</th><th>${esc(s('uom'))}</th><th>${esc(s('unitPrice'))}</th><th>${esc(s('taxCode'))}</th><th>${esc(s('net'))}</th><th></th></tr></thead><tbody data-so-lines></tbody></table></div><div class="panel-body sales-order-lines-help"><div class="callout info">${ic('info')}<span>${esc(s('taxHelp'))} ${esc(s('serviceHelp'))}</span></div></div></div>
        <aside class="summary"><div class="sumcard"><div class="sumrow total"><span class="sk2">${esc(s('net'))}</span><span class="sv tnum" data-so-net>${amount(0)}</span></div></div><div class="sumcard" style="margin-top:14px"><div class="sectitle" style="margin-top:0">${esc(s('approvalReason'))}</div><p style="font-size:13px;color:var(--muted);margin:0">${esc(s('boundary'))}</p></div></aside></div></div></div>`}</div>
      ${data.customers.length?`<div class="responsive-actionbar">${btn(s('back'),{icon:'chevleft',cls:'soft',attrs:'data-so-back'})}<div class="grow"></div>${btn(s('submit'),{icon:'flow',cls:'primary',sm:false,attrs:'data-submit-so'})}</div>`:''}</section></div>`;
    if(!data.customers.length)return;
    renderLines();
    root.querySelector('[data-add-stock-line]').addEventListener('click',()=>{if(!data.products.length){openQuickProduct();return;}appendStockLine();});
    root.querySelector('[data-add-new-stock]').addEventListener('click',openQuickProduct);
    root.querySelector('[data-add-service-line]').addEventListener('click',appendServiceLine);
    root.querySelector('[data-add-stock-line]')?.setAttribute('title',data.products.length?s('addStockLine'):s('noProductsHelp'));
    root.querySelector('[data-so-back]').addEventListener('click',()=>navigate('sales-orders'));
    root.querySelector('[data-submit-so]').addEventListener('click',async event=>{
      const button=event.currentTarget;
      if(!Number(root.querySelector('#canonicalSoCustomer').value)){toast(s('customerRequired'),'warn');return;}
      if(!state.lines.length){toast(s('lineRequired'),'warn');return;}
      const docNo=root.querySelector('#canonicalSoNo').value.trim();
      const reason=root.querySelector('#canonicalSoReason').value.trim();
      const invalid=state.lines.find(line=>line.lineType!=='stock'&&line.lineType!=='non_stock'||line.lineType==='stock'&&(!Number(line.productId)||!productById.has(Number(line.productId)))||!String(line.description||'').trim()||!String(line.uom||'').trim()||Number(line.qty)<=0||Number(line.unitPrice)<0||!String(line.taxCode||'').trim());
      if(!docNo||!reason||invalid){toast(s('lineRequired'),'warn');return;}
      button.disabled=true;button.textContent=s('creating');
      try{
        await adapter().create('sales/orders',{docNo,customerId:Number(root.querySelector('#canonicalSoCustomer').value),orderDate:root.querySelector('#canonicalSoDate').value,currency:root.querySelector('#canonicalSoCurrency').value.trim().toUpperCase(),approvalReason:reason,lines:state.lines.map(line=>({lineType:line.lineType,productId:line.lineType==='stock'?Number(line.productId):null,description:String(line.description).trim(),uom:String(line.uom).trim(),qty:String(line.qty),unitPrice:String(line.unitPrice),taxCode:line.taxCode}))},state.idempotencyKey);
        toast(s('created'),'ok');navigate('so-approvals');
      }catch(error){button.disabled=false;button.innerHTML=`${ic('flow')}<span>${esc(s('submit'))}</span>`;toast(error&&error.message||'Create failed','danger');}
    });
  };

  async function loadApprovals(){
    const pages=await Promise.all([
      adapter().list('sales/order-approvals',{limit:100}),adapter().list('sales/orders',{limit:100}),adapter().list('sales/order-lines',{limit:100}),adapter().list('sales/customers',{limit:100}),
    ]);
    let productsPage={data:[]};
    try{productsPage=await adapter().list('inventory/products',{limit:100});}catch(error){if(!error||error.status!==403)throw error;}
    const approvals=pages[0].data||[],orders=pages[1].data||[],lines=pages[2].data||[],customers=pages[3].data||[],products=productsPage.data||[];
    const orderById=new Map(orders.map(row=>[Number(row.id),row]));
    const customerById=new Map(customers.map(row=>[Number(row.id),row]));
    const productById=new Map(products.map(row=>[Number(row.id),row]));
    return approvals.map(approval=>{const order=orderById.get(Number(approval.orderId))||{};return {...approval,order,customer:customerById.get(Number(order.customerId))||{},lines:lines.filter(line=>Number(line.orderId)===Number(order.id)).map(line=>({...line,product:productById.get(Number(line.productId))||{}})).sort((a,b)=>Number(a.lineNo)-Number(b.lineNo))};});
  }

  function openDecision(request,decision){
    const s=copy(),approve=decision==='approve';
    appModal({icon:approve?'checkc':'x',title:s(approve?'approveTitle':'rejectTitle'),width:560,body:`<p style="color:var(--muted);font-size:13.5px;margin-top:0">${esc(s(approve?'approvePrompt':'rejectPrompt'))}</p><div class="fld"><span>${esc(s('note'))}</span><textarea id="salesApprovalNote" maxlength="1000" placeholder="${esc(s('notePlaceholder'))}"></textarea></div>`,actions:btn(s('cancel'),{cls:'soft',attrs:'data-sales-decision-cancel'})+btn(s('confirm'),{icon:approve?'check':'x',cls:approve?'primary':'danger',attrs:'data-sales-decision-confirm'})});
    document.querySelector('[data-sales-decision-cancel]')?.addEventListener('click',closeModal);
    document.querySelector('[data-sales-decision-confirm]')?.addEventListener('click',async event=>{const button=event.currentTarget,note=document.querySelector('#salesApprovalNote').value.trim();if(!note){toast(s('notePlaceholder'),'warn');return;}button.disabled=true;try{await adapter().action('sales/orders',request.order.id,decision,{note},`sales-order-approval-${request.id}-v${request.version}-${decision}`);closeModal();toast(s(approve?'approvedDone':'rejectedDone'),'ok');navigate('so-approvals');}catch(error){button.disabled=false;toast(error&&error.message||'Decision failed','danger');}});
  }

  function openReview(request){
    const s=copy();
    const lineTable=buildTable({rowId:line=>line.id,columns:[{label:s('product'),render:line=>{const nonStock=line.lineType==='non_stock'||line.productId==null;return `<div class="cellsub"><b>${esc(nonStock?line.description:(line.product.name||'#'+line.productId))}</b><small>${esc(nonStock?`${s('lineTypeNonStock')} · ${line.uom||'unit'}`:(line.product.sku||line.uom||''))}</small></div>`;}},{label:s('qty'),align:'r',render:line=>`<span class="tnum">${num(Number(line.qty))}</span>`},{label:s('unitPrice'),align:'r',render:line=>`<span class="tnum">${amount(line.unitPrice,request.order.currency)}</span>`},{label:s('taxCode'),render:line=>esc(line.taxCode)},{label:s('net'),align:'r',render:line=>`<b class="tnum">${amount(line.netAmount,request.order.currency)}</b>`}],rows:request.lines});
    const decision=request.status==='pending'?`<div class="callout info">${ic('clock')}<span>${esc(s('pending'))}</span></div>`:`<div class="timeline"><div class="tl ${request.status==='approved'?'ok':'danger'}"><span class="tldot"></span><div class="tlbody"><div class="when">${esc(request.decidedAt?dateValue(request.decidedAt):'—')}</div><div class="what">${esc(label(s,request.status))} · ${esc(request.decidedByName||'—')}</div><div class="det">${esc(request.decisionNote||'—')}</div></div></div></div>`;
    appModal({icon:'flow',title:`${s('review')} · ${request.order.docNo}`,width:860,body:`<div class="docmeta"><div class="dm"><small>${esc(s('customer'))}</small><b>${esc(request.customer.name||'#'+request.order.customerId)}</b></div><div class="dm"><small>${esc(s('orderDate'))}</small><b>${esc(dateValue(request.order.orderDate))}</b></div><div class="dm"><small>${esc(s('orderStatus'))}</small><b>${esc(request.order.status)}</b></div><div class="dm"><small>${esc(s('status'))}</small><b>${esc(label(s,request.status))}</b></div></div><div class="callout info" style="margin-top:12px">${ic('flow')}<span><b>${esc(s('reason'))}:</b> ${esc(request.reason)}</span></div><div class="tablewrap" style="margin-top:12px">${lineTable}</div><div class="sumcard" style="margin-top:12px"><div class="sumrow total"><span class="sk2">${esc(s('net'))}</span><span class="sv tnum">${amount(request.order.netAmount,request.order.currency)}</span></div></div><div style="margin-top:12px">${decision}</div><div class="callout info" style="margin-top:12px">${ic('lock')}<span>${esc(s('boundary'))}</span></div>`,actions:btn(s('cancel'),{cls:'soft',attrs:'data-sales-review-close'})+(request.status==='pending'?btn(s('reject'),{icon:'x',cls:'danger',attrs:'data-sales-review-reject'})+btn(s('approve'),{icon:'check',cls:'primary',attrs:'data-sales-review-approve'}):'')});
    document.querySelector('[data-sales-review-close]')?.addEventListener('click',closeModal);
    document.querySelector('[data-sales-review-approve]')?.addEventListener('click',()=>{closeModal();openDecision(request,'approve');});
    document.querySelector('[data-sales-review-reject]')?.addEventListener('click',()=>{closeModal();openDecision(request,'reject');});
  }

  SCREENS['so-approvals']=async function(root){
    const s=copy(),requests=await loadApprovals();
    const pending=requests.filter(row=>row.status==='pending');
    transactionListPage(root,{
      module:'sales',route:'so-approvals',title:s('approvals'),description:s('approvalSub'),
      rows:requests,rowId:row=>row.id,
      filters:[['all',s('all')],['pending',s('pending')],['approved',s('approved')],['rejected',s('rejected')]],
      filterFn:(row,status)=>row.status===status,
      kpis:[
        {label:s('awaiting'),value:pending.length,filter:'pending',accent:true},
        {label:s('queueValue'),value:amount(pending.reduce((sum,row)=>sum+Number(row.order.totalAmount||0),0))},
        {label:s('approved'),value:requests.filter(row=>row.status==='approved').length,filter:'approved'},
        {label:s('rejected'),value:requests.filter(row=>row.status==='rejected').length,filter:'rejected'},
      ],
      primaryAction:{label:s('newOrder'),icon:'plus',onClick:()=>navigate('new-sales-order')},
      note:s('dataLimit'),
      columns:[
        {label:s('order'),render:row=>`<div class="cellsub"><b class="docnum">${esc(row.order.docNo||'#'+row.orderId)}</b><small>${esc(dateValue(row.order.orderDate||row.submittedAt))}</small></div>`},
        {label:s('customer'),render:row=>`<div class="cellsub"><b>${esc(row.customer.name||'#'+row.order.customerId)}</b><small>${esc(row.customer.code||'')}</small></div>`},
        {label:s('reason'),render:row=>`<span style="color:var(--muted)" data-business-text>${esc(row.reason)}</span>`},
        {label:s('queueValue'),align:'r',render:row=>`<b class="tnum">${amount(row.order.totalAmount,row.order.currency)}</b>`},
        {label:s('submitted'),render:row=>esc(dateValue(row.submittedAt))},
        {label:s('status'),render:row=>cap(label(s,row.status),tone(row.status))},
        {label:'',align:'r',render:row=>btn(s('review'),{icon:'ext',cls:'soft',attrs:`data-review-approval="${row.id}" onclick="event.stopPropagation()"`})},
      ],
      rowAction:{
        label:row=>`${t('common.open')} ${row.order.docNo||row.orderId}`,
        run:row=>openReview(row),
      },
      empty:{icon:'flow',title:s('empty')},
      afterRender:({root:pageRoot,rows})=>{
        pageRoot.querySelector('[data-module-shell]')?.setAttribute('data-canonical-sales-order-approval','true');
        pageRoot.querySelectorAll('[data-review-approval]').forEach(button=>button.addEventListener('click',()=>{
          const request=rows.find(row=>Number(row.id)===Number(button.dataset.reviewApproval));
          if(request) openReview(request);
        }));
      },
    });
  };
})();
