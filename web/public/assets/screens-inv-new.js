/* ============================================================
   ARIA ERP — Canonical new-item composer
   Creates product master data through ErpSystemData in Demo and
   API modes. Stock always starts at zero and can only enter the
   movement ledger through a stock adjustment or purchase receipt.
   ============================================================ */

function newItemCopy(){

  const packs={
    en:{
      title:'New item',sub:'Create inventory master data for the active company.',draft:'Draft',master:'Product master',
      basic:'Basic information',sku:'SKU',skuPlaceholder:'e.g. SG-HOSE-12',skuHelp:'A unique company item code. It cannot be changed after creation.',
      name:'Item name',namePlaceholder:'e.g. Hydraulic Hose 12mm',category:'Category',uom:'Base UoM',
      settings:'Inventory planning',standardCost:'Standard cost',costHelp:'Used as the valuation fallback until a valued receipt establishes an average cost.',
      reorderPoint:'Reorder point',reorderQty:'Reorder quantity',zeroTitle:'Starts with zero stock',
      zeroBody:'Creating master data never writes an opening balance. Receive stock through a purchase receipt or post a Stock Adjustment so every quantity has a movement trail.',
      next:'Next step after creation',nextBody:'Open Stock Adjustment when you need to establish an initial physical count.',
      cancel:'Cancel',create:'Create item',saving:'Creating…',ready:'Ready to create product master data',
      incomplete:'Enter the required SKU and item name',skuRequired:'SKU is required.',nameRequired:'Item name is required.',
      invalidNumber:'Cost and reorder values must be non-negative numbers.',created:'Item {sku} created with zero stock.',
      failed:'The item could not be created.',catComponents:'Components',catRaw:'Raw Materials',catFinished:'Finished Goods',catConsumables:'Consumables',catPackaging:'Packaging',
    },
    ms:{
  "title": "Item baharu",
  "sub": "Cipta data induk inventori untuk syarikat aktif.",
  "draft": "Draf",
  "master": "Induk produk",
  "basic": "Maklumat asas",
  "sku": "SKU",
  "skuPlaceholder": "cth. SG-HOSE-12",
  "skuHelp": "Kod item syarikat yang unik. Ia tidak boleh diubah selepas dicipta.",
  "name": "Nama item",
  "namePlaceholder": "cth. Hos Hidraulik 12mm",
  "category": "Kategori",
  "uom": "UoM asas",
  "settings": "Perancangan inventori",
  "standardCost": "Kos standard",
  "costHelp": "Digunakan sebagai nilai sandaran sehingga penerimaan bernilai menetapkan kos purata.",
  "reorderPoint": "Titik pesan semula",
  "reorderQty": "Kuantiti pesan semula",
  "zeroTitle": "Bermula dengan stok sifar",
  "zeroBody": "Penciptaan data induk tidak pernah merekod baki pembukaan. Terima stok melalui penerimaan pembelian atau Pelarasan Stok supaya setiap kuantiti mempunyai jejak pergerakan.",
  "next": "Langkah seterusnya selepas dicipta",
  "nextBody": "Buka Pelarasan Stok apabila anda perlu menetapkan kiraan fizikal awal.",
  "cancel": "Batal",
  "create": "Cipta item",
  "saving": "Mencipta…",
  "ready": "Sedia mencipta data induk produk",
  "incomplete": "Masukkan SKU dan nama item yang diperlukan",
  "skuRequired": "SKU diperlukan.",
  "nameRequired": "Nama item diperlukan.",
  "invalidNumber": "Kos dan nilai pesanan semula mestilah nombor bukan negatif.",
  "created": "Item {sku} dicipta dengan stok sifar.",
  "failed": "Item tidak dapat dicipta.",
  "catComponents": "Komponen",
  "catRaw": "Bahan Mentah",
  "catFinished": "Barang Siap",
  "catConsumables": "Barang Guna Habis",
  "catPackaging": "Pembungkusan"
},
    zh:{
  "title": "新增物料",
  "sub": "为当前公司创建真实的库存主数据。",
  "draft": "草稿",
  "master": "商品主数据",
  "basic": "基本信息",
  "sku": "存货单位",
  "skuPlaceholder": "例如 SG-HOSE-12",
  "skuHelp": "当前公司的唯一物料编码，创建后不可更改。",
  "name": "物料名称",
  "namePlaceholder": "例如：液压软管 12mm",
  "category": "类别",
  "uom": "基本计量单位",
  "settings": "库存计划",
  "standardCost": "标准成本",
  "costHelp": "在有计价收货建立移动平均成本之前，作为估值的后备成本。",
  "reorderPoint": "再订货点",
  "reorderQty": "再订货量",
  "zeroTitle": "初始库存为零",
  "zeroBody": "创建主数据不会写入期初余额。请通过采购收货或库存调整接收库存，确保每个数量都有库存流水。",
  "next": "创建后的下一步",
  "nextBody": "需要建立首次实盘数量时，请打开“库存调整”。",
  "cancel": "取消",
  "create": "创建物料",
  "saving": "正在创建…",
  "ready": "可以创建商品主数据",
  "incomplete": "请输入必填的 SKU 和物料名称",
  "skuRequired": "请输入 SKU。",
  "nameRequired": "请输入物料名称。",
  "invalidNumber": "成本和再订货数值必须是非负数。",
  "created": "物料 {sku} 已创建，当前库存为零。",
  "failed": "物料创建失败。",
  "catComponents": "零部件",
  "catRaw": "原材料",
  "catFinished": "成品",
  "catConsumables": "耗材",
  "catPackaging": "包装"
},
    ja:{
  "title": "新規品目",
  "sub": "現在の会社の在庫マスタデータを作成します。",
  "draft": "下書き",
  "master": "品目マスタ",
  "basic": "基本情報",
  "sku": "SKU",
  "skuPlaceholder": "例 SG-HOSE-12",
  "skuHelp": "会社内で一意の品目コードです。作成後は変更できません。",
  "name": "品目名",
  "namePlaceholder": "例：油圧ホース 12mm",
  "category": "カテゴリ",
  "uom": "基本単位",
  "settings": "在庫計画",
  "standardCost": "標準原価",
  "costHelp": "評価済み入庫で平均原価が確立するまで、評価の代替原価として使用されます。",
  "reorderPoint": "発注点",
  "reorderQty": "発注数量",
  "zeroTitle": "在庫ゼロで開始",
  "zeroBody": "マスタ作成では期首在庫を記録しません。すべての数量に入出庫履歴を残すため、購買入庫または在庫調整で受け入れてください。",
  "next": "作成後の次の手順",
  "nextBody": "初回の実地棚卸数量を設定する場合は、在庫調整を開いてください。",
  "cancel": "キャンセル",
  "create": "品目を作成",
  "saving": "作成中…",
  "ready": "品目マスタを作成できます",
  "incomplete": "必須の SKU と品目名を入力してください",
  "skuRequired": "SKU を入力してください。",
  "nameRequired": "品目名を入力してください。",
  "invalidNumber": "原価と発注値は 0 以上の数値でなければなりません。",
  "created": "品目 {sku} を在庫ゼロで作成しました。",
  "failed": "品目を作成できませんでした。",
  "catComponents": "部品",
  "catRaw": "原材料",
  "catFinished": "完成品",
  "catConsumables": "消耗品",
  "catPackaging": "梱包資材"
},
    vi:{
  "title": "Mặt hàng mới",
  "sub": "Tạo dữ liệu gốc tồn kho cho công ty đang hoạt động.",
  "draft": "Bản nháp",
  "master": "Dữ liệu gốc sản phẩm",
  "basic": "Thông tin cơ bản",
  "sku": "Mã hàng",
  "skuPlaceholder": "vd. SG-HOSE-12",
  "skuHelp": "Mã mặt hàng duy nhất trong công ty. Không thể đổi sau khi tạo.",
  "name": "Tên mặt hàng",
  "namePlaceholder": "vd. Ống thủy lực 12mm",
  "category": "Danh mục",
  "uom": "ĐVT cơ bản",
  "settings": "Kế hoạch tồn kho",
  "standardCost": "Chi phí tiêu chuẩn",
  "costHelp": "Dùng làm giá dự phòng cho đến khi phiếu nhập có giá thiết lập chi phí bình quân.",
  "reorderPoint": "Điểm đặt hàng lại",
  "reorderQty": "SL đặt hàng lại",
  "zeroTitle": "Bắt đầu với tồn kho bằng không",
  "zeroBody": "Tạo dữ liệu gốc không bao giờ ghi số dư đầu kỳ. Hãy nhập hàng qua phiếu nhận mua hoặc Điều chỉnh tồn kho để mọi số lượng đều có lịch sử biến động.",
  "next": "Bước tiếp theo sau khi tạo",
  "nextBody": "Mở Điều chỉnh tồn kho khi cần thiết lập số lượng kiểm kê ban đầu.",
  "cancel": "Hủy",
  "create": "Tạo mặt hàng",
  "saving": "Đang tạo…",
  "ready": "Sẵn sàng tạo dữ liệu gốc sản phẩm",
  "incomplete": "Nhập SKU và tên mặt hàng bắt buộc",
  "skuRequired": "Cần nhập SKU.",
  "nameRequired": "Cần nhập tên mặt hàng.",
  "invalidNumber": "Chi phí và giá trị đặt lại phải là số không âm.",
  "created": "Đã tạo mặt hàng {sku} với tồn kho bằng không.",
  "failed": "Không thể tạo mặt hàng.",
  "catComponents": "Linh kiện",
  "catRaw": "Nguyên liệu",
  "catFinished": "Thành phẩm",
  "catConsumables": "Vật tư tiêu hao",
  "catPackaging": "Bao bì"
},
  };
  const pack=i18nLegacy(packs);
  return key=>pack[key]||packs.en[key]||key;
}

SCREENS['new-item'] = function(root){
  const s=newItemCopy();
  const adapter=window.ErpSystemData;
  const CATS=[
    ['Components','catComponents'],['Raw Materials','catRaw'],['Finished Goods','catFinished'],
    ['Consumables','catConsumables'],['Packaging','catPackaging'],
  ];
  const UOMS=['ea','unit','kg','g','m','cm','L','sheet','box','pair','set'];
  const currency=(DB.company&&DB.company.currency)||'SGD';

  if(!adapter){
    root.innerHTML=modulePage({module:'inventory',route:'new-item',active:'item-master',title:s('title'),sub:s('sub'),body:statePanel({icon:'warn',title:s('failed'),body:'ERP data adapter is unavailable.'})});
    return;
  }

  root.innerHTML=`<div class="content full"><section class="master" data-screen-label="${esc(s('title'))}" data-canonical-new-item="true">
    <div class="docwrap"><div class="docpage">
      ${crumbs([DB.company.name,{label:t('nav.inventory'),route:'stock-on-hand'},{label:t('inv.nav.items'),route:'item-master'},{cur:s('title')}])}
      <div class="dochead"><div class="dh-row1">
        <div><div class="dt">${ic('tag')}${esc(s('title'))}</div><div style="color:var(--muted);font-size:13px;margin-top:4px">${esc(s('draft'))} · ${esc(s('master'))} · ${esc(DB.company.name)}</div></div>
        <div class="dactions">${cap(s('draft'),'neutral')}</div>
      </div></div>

      <div class="doclayout"><div class="docmain">
        <div class="panel"><div class="panel-h">${ic('tag')}<h3>${esc(s('basic'))}</h3></div><div class="panel-body">
          <div class="fldrow c2">
            <label class="fld"><span>${esc(s('sku'))} <span class="req">*</span></span><input id="niSku" autocomplete="off" maxlength="80" placeholder="${esc(s('skuPlaceholder'))}" style="text-transform:uppercase"><span class="locked">${ic('lock')} ${esc(s('skuHelp'))}</span></label>
            <label class="fld"><span>${esc(s('name'))} <span class="req">*</span></span><input id="niName" autocomplete="off" maxlength="200" placeholder="${esc(s('namePlaceholder'))}"></label>
            <label class="fld"><span>${esc(s('category'))}</span><select id="niCategory">${CATS.map(([value,key])=>`<option value="${esc(value)}">${esc(s(key))}</option>`).join('')}</select></label>
            <label class="fld"><span>${esc(s('uom'))}</span><select id="niUom">${UOMS.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('')}</select></label>
          </div>
        </div></div>

        <div class="panel"><div class="panel-h">${ic('sliders')}<h3>${esc(s('settings'))}</h3></div><div class="panel-body">
          <div class="fldrow c3">
            <label class="fld"><span>${esc(s('standardCost'))} (${esc(currency)})</span><input id="niCost" type="number" min="0" step="0.0001" value="0" class="tnum"><span class="locked">${esc(s('costHelp'))}</span></label>
            <label class="fld"><span>${esc(s('reorderPoint'))}</span><input id="niReorder" type="number" min="0" step="0.0001" value="0" class="tnum"></label>
            <label class="fld"><span>${esc(s('reorderQty'))}</span><input id="niRoq" type="number" min="0" step="0.0001" value="0" class="tnum"></label>
          </div>
          <div class="risk" style="margin-top:14px">${ic('info')}<div><b>${esc(s('zeroTitle'))}</b><small>${esc(s('zeroBody'))}</small></div></div>
          <div id="niError" class="risk danger" role="alert" aria-live="polite" style="display:none;margin-top:12px"></div>
        </div></div>
      </div>
      <aside class="summary"><div class="sumcard">
        ${indicator({tone:'neutral',icon:'box',label:s('zeroTitle'),value:'0',sub:s('zeroBody')})}
      </div><div class="sumcard">
        <div class="sectitle" style="margin-top:0">${esc(s('next'))}</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.55;margin:0">${esc(s('nextBody'))}</p>
      </div></aside></div>
      <div style="height:8px"></div>
    </div></div>
    <div class="set-savebar" id="niBar">
      <div id="niHint" style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${esc(s('incomplete'))}</div>
      <div class="grow"></div>
      ${btn(s('cancel'),{cls:'soft',attrs:'id="niCancel"'})}
      ${btn(s('create'),{icon:'check',cls:'primary',sm:false,attrs:'id="niCreate" disabled'})}
    </div>
  </section></div>`;

  const skuInput=root.querySelector('#niSku');
  const nameInput=root.querySelector('#niName');
  const createButton=root.querySelector('#niCreate');
  const hint=root.querySelector('#niHint');
  const errorBox=root.querySelector('#niError');
  let saving=false;

  function setError(message){
    errorBox.textContent=message||'';
    errorBox.style.display=message?'block':'none';
  }
  function ready(){ return Boolean(skuInput.value.trim()&&nameInput.value.trim()); }
  function syncButton(){
    createButton.disabled=saving||!ready();
    hint.textContent=ready()?s('ready'):s('incomplete');
  }
  skuInput.addEventListener('input',()=>{
    const start=skuInput.selectionStart;
    skuInput.value=skuInput.value.toUpperCase();
    if(start!=null) skuInput.setSelectionRange(start,start);
    setError(''); syncButton();
  });
  nameInput.addEventListener('input',()=>{setError('');syncButton();});
  root.querySelector('#niCancel').addEventListener('click',()=>navigate('item-master'));
  createButton.addEventListener('click',async()=>{
    const sku=skuInput.value.trim().toUpperCase();
    const name=nameInput.value.trim();
    if(!sku){ setError(s('skuRequired')); skuInput.focus(); return; }
    if(!name){ setError(s('nameRequired')); nameInput.focus(); return; }
    const values=['niCost','niReorder','niRoq'].map(id=>root.querySelector('#'+id).value.trim());
    if(values.some(value=>value===''||!Number.isFinite(Number(value))||Number(value)<0)){
      setError(s('invalidNumber')); return;
    }
    saving=true; setError(''); syncButton();
    const original=createButton.innerHTML;
    createButton.textContent=s('saving');
    try{
      await adapter.create('inventory/products',{
        sku,name,
        category:root.querySelector('#niCategory').value,
        uom:root.querySelector('#niUom').value,
        standardCost:values[0],
        reorderPoint:values[1],
        reorderQty:values[2],
      });
      navigate('item-master');
      setTimeout(()=>toast(s('created').replace('{sku}',sku),'ok'),180);
    }catch(error){
      saving=false;
      createButton.innerHTML=original;
      const message=error&&error.message?error.message:s('failed');
      setError(message); toast(message,'danger'); syncButton();
    }
  });
  syncButton();
};
