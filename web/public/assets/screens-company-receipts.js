/* Company Receipts register (TASK-179).
   Reads are permission-scoped by the API/demo adapter; this screen never
   broadens or filters tenant data in the browser. Search/date filters belong
   to TASK-180. */
(function companyReceiptRegisterScreen(){
  'use strict';

  const COPY={
    en:{title:'Company Receipts',sub:'Confirmed receipt records in your authorised scope.',date:'Date',merchant:'Merchant',number:'Receipt no.',category:'Category',amount:'Amount',currency:'Currency',uploader:'Uploader',status:'Status',empty:'No Company Receipts',emptyBody:'Confirmed receipts will appear here.',more:'Load more',loading:'Loading…',own:'My receipts',company:'Company register',loaded:'loaded',confirm:'Confirm receipt',review:'Choose eligible evidence',noEvidence:'No eligible receipt evidence is available. Upload or capture evidence through the governed My Receipts capture flow first.',purpose:'Business purpose',notes:'Notes',save:'Save receipt',close:'Close',detail:'Receipt details',edit:'Edit metadata',void:'Void receipt',voidReason:'Reason for voiding',voidConfirm:'Void Company Receipt',version:'Version',originalFile:'Original evidence',hash:'Evidence SHA-256',searchEvidence:'Search evidence file names',moreEvidence:'Load more evidence',emptyEvidence:'No eligible evidence matches this search.',notReady:'This evidence is not ready for confirmation.'},
    zh:{title:'公司收据',sub:'显示您获授权范围内的已确认收据记录。',date:'日期',merchant:'商户',number:'收据编号',category:'类别',amount:'金额',currency:'币种',uploader:'上传者',status:'状态',empty:'暂无公司收据',emptyBody:'已确认的收据会显示在这里。',more:'加载更多',loading:'加载中…',own:'我的收据',company:'公司登记册',loaded:'已加载',confirm:'确认收据',review:'选择可用凭证',noEvidence:'没有可用的收据凭证。请先通过受治理的“我的收据”上传或拍摄凭证。',purpose:'业务用途',notes:'备注',save:'保存收据',close:'关闭',detail:'收据详情',edit:'编辑资料',void:'作废收据',voidReason:'作废原因',voidConfirm:'作废公司收据',version:'版本',originalFile:'原始凭证',hash:'凭证 SHA-256',searchEvidence:'搜索凭证文件名',moreEvidence:'加载更多凭证',emptyEvidence:'没有符合搜索条件的可用凭证。',notReady:'该凭证尚未可供确认。'},
    ms:{title:'Resit Syarikat',sub:'Rekod resit disahkan dalam skop yang dibenarkan.',date:'Tarikh',merchant:'Peniaga',number:'No. resit',category:'Kategori',amount:'Amaun',currency:'Mata wang',uploader:'Pemuat naik',status:'Status',empty:'Tiada Resit Syarikat',emptyBody:'Resit yang disahkan akan dipaparkan di sini.',more:'Muat lagi',loading:'Memuat…',own:'Resit saya',company:'Daftar syarikat',loaded:'dimuat',confirm:'Sahkan resit',review:'Pilih bukti yang layak',noEvidence:'Tiada bukti resit yang layak. Muat naik atau ambil bukti melalui aliran Resit Saya yang ditadbir dahulu.',purpose:'Tujuan perniagaan',notes:'Nota',save:'Simpan resit',close:'Tutup',detail:'Butiran resit',edit:'Edit metadata',void:'Batal resit',voidReason:'Sebab pembatalan',voidConfirm:'Batal Resit Syarikat',version:'Versi',originalFile:'Bukti asal',hash:'SHA-256 bukti',searchEvidence:'Cari nama fail bukti',moreEvidence:'Muat lagi bukti',emptyEvidence:'Tiada bukti layak sepadan dengan carian.',notReady:'Bukti ini belum sedia untuk disahkan.'},
    vi:{title:'Biên lai công ty',sub:'Các biên lai đã xác nhận trong phạm vi được cấp quyền.',date:'Ngày',merchant:'Nhà cung cấp',number:'Số biên lai',category:'Danh mục',amount:'Số tiền',currency:'Tiền tệ',uploader:'Người tải lên',status:'Trạng thái',empty:'Không có biên lai công ty',emptyBody:'Biên lai đã xác nhận sẽ xuất hiện tại đây.',more:'Tải thêm',loading:'Đang tải…',own:'Biên lai của tôi',company:'Sổ công ty',loaded:'đã tải',confirm:'Xác nhận biên lai',review:'Chọn chứng từ hợp lệ',noEvidence:'Không có chứng từ biên lai hợp lệ. Trước hết hãy tải lên hoặc chụp chứng từ qua luồng Biên lai của tôi được quản lý.',purpose:'Mục đích kinh doanh',notes:'Ghi chú',save:'Lưu biên lai',close:'Đóng',detail:'Chi tiết biên lai',edit:'Sửa thông tin',void:'Vô hiệu biên lai',voidReason:'Lý do vô hiệu',voidConfirm:'Vô hiệu biên lai công ty',version:'Phiên bản',originalFile:'Chứng từ gốc',hash:'SHA-256 chứng từ',searchEvidence:'Tìm tên tệp chứng từ',moreEvidence:'Tải thêm chứng từ',emptyEvidence:'Không có chứng từ hợp lệ phù hợp với tìm kiếm.',notReady:'Chứng từ này chưa sẵn sàng để xác nhận.'},
    ja:{title:'会社領収書',sub:'許可された範囲の確認済み領収書レコードです。',date:'日付',merchant:'加盟店',number:'領収書番号',category:'カテゴリ',amount:'金額',currency:'通貨',uploader:'アップロード者',status:'状態',empty:'会社領収書はありません',emptyBody:'確認済みの領収書がここに表示されます。',more:'さらに読み込む',loading:'読み込み中…',own:'自分の領収書',company:'会社台帳',loaded:'件読込',confirm:'領収書を確認',review:'対象証憑を選択',noEvidence:'対象となる領収書証憑がありません。先に管理された「自分の領収書」からアップロードまたは撮影してください。',purpose:'事業目的',notes:'メモ',save:'領収書を保存',close:'閉じる',detail:'領収書詳細',edit:'メタデータを編集',void:'領収書を無効化',voidReason:'無効化理由',voidConfirm:'会社領収書を無効化',version:'バージョン',originalFile:'元の証憑',hash:'証憑 SHA-256',searchEvidence:'証憑ファイル名を検索',moreEvidence:'証憑をさらに読み込む',emptyEvidence:'検索に一致する対象証憑はありません。',notReady:'この証憑はまだ確認できません。'},
  };
  const FILTER_COPY={
    en:{search:'Search merchant, receipt no., notes or category',period:'Period',thisMonth:'This Month',lastMonth:'Last Month',thisQuarter:'This Quarter',thisYear:'This Year',custom:'Custom',allDates:'All Dates',from:'Date From',to:'Date To',apply:'Apply',clear:'Clear',invalid:'Date From must be on or before Date To.',missing:'Missing Date',missingHelp:'Open this receipt to add the transaction date; dated ranges exclude it.'},
    zh:{search:'搜索商户、收据编号、备注或类别',period:'期间',thisMonth:'本月',lastMonth:'上月',thisQuarter:'本季度',thisYear:'本年',custom:'自定义',allDates:'全部日期',from:'开始日期',to:'结束日期',apply:'应用',clear:'清除',invalid:'开始日期不得晚于结束日期。',missing:'缺少日期',missingHelp:'打开此收据补充交易日期；日期范围会排除此记录。'},
    ms:{search:'Cari peniaga, no. resit, nota atau kategori',period:'Tempoh',thisMonth:'Bulan Ini',lastMonth:'Bulan Lepas',thisQuarter:'Suku Ini',thisYear:'Tahun Ini',custom:'Tersuai',allDates:'Semua Tarikh',from:'Tarikh Dari',to:'Tarikh Hingga',apply:'Guna',clear:'Kosongkan',invalid:'Tarikh Dari mesti sebelum atau sama dengan Tarikh Hingga.',missing:'Tarikh Tiada',missingHelp:'Buka resit ini untuk menambah tarikh transaksi; julat bertarikh mengecualikannya.'},
    vi:{search:'Tìm nhà cung cấp, số biên lai, ghi chú hoặc danh mục',period:'Kỳ',thisMonth:'Tháng này',lastMonth:'Tháng trước',thisQuarter:'Quý này',thisYear:'Năm nay',custom:'Tùy chỉnh',allDates:'Mọi ngày',from:'Từ ngày',to:'Đến ngày',apply:'Áp dụng',clear:'Xóa',invalid:'Từ ngày phải trước hoặc bằng Đến ngày.',missing:'Thiếu ngày',missingHelp:'Mở biên lai này để thêm ngày giao dịch; khoảng ngày sẽ loại bản ghi này.'},
    ja:{search:'加盟店、領収書番号、メモ、カテゴリを検索',period:'期間',thisMonth:'今月',lastMonth:'先月',thisQuarter:'今四半期',thisYear:'今年',custom:'カスタム',allDates:'全期間',from:'開始日',to:'終了日',apply:'適用',clear:'クリア',invalid:'開始日は終了日以前にしてください。',missing:'日付なし',missingHelp:'この領収書を開いて取引日を追加してください。日付範囲では除外されます。'},
  };
  const PACK_COPY={
    en:{preview:'Preview Pack',pdf:'PDF',print:'Print',packTitle:'Company Receipt Pack',packRange:'Choose both Date From and Date To before creating a Receipt Pack.',packBusy:'Building Receipt Pack…',packError:'Receipt Pack could not be created.',reviewTitle:'Review Receipt Pack',reviewIntro:'Review the selected evidence and totals. Nothing will be created until you confirm.',selected:'Selected evidence',total:'Totals',filters:'Filters',pending:'Pending action',confirmCreate:'Confirm and create',cancel:'Cancel',selectionChanged:'The eligible receipt selection changed. Review the latest selection before confirming.',close:'Close'},
    zh:{preview:'预览收据包',pdf:'PDF',print:'打印',packTitle:'公司收据包',packRange:'创建收据包前请选择开始日期和结束日期。',packBusy:'正在生成收据包…',packError:'无法生成收据包。',reviewTitle:'审核公司收据包',reviewIntro:'请审核已选凭证和合计金额。确认前不会创建任何收据包。',selected:'已选凭证',total:'合计',filters:'筛选条件',pending:'待执行操作',confirmCreate:'确认并创建',cancel:'取消',selectionChanged:'符合条件的收据发生变化。请确认最新选择。',close:'关闭'},
    ms:{preview:'Pratonton Pek',pdf:'PDF',print:'Cetak',packTitle:'Pek Resit Syarikat',packRange:'Pilih Tarikh Dari dan Tarikh Hingga sebelum mencipta Pek Resit.',packBusy:'Membina Pek Resit…',packError:'Pek Resit tidak dapat dicipta.',reviewTitle:'Semak Pek Resit',reviewIntro:'Semak bukti dan jumlah yang dipilih. Tiada pek akan dicipta sebelum anda mengesahkan.',selected:'Bukti dipilih',total:'Jumlah',filters:'Penapis',pending:'Tindakan menunggu',confirmCreate:'Sahkan dan cipta',cancel:'Batal',selectionChanged:'Pemilihan resit yang layak telah berubah. Semak pemilihan terkini sebelum mengesahkan.',close:'Tutup'},
    vi:{preview:'Xem trước gói',pdf:'PDF',print:'In',packTitle:'Gói biên lai công ty',packRange:'Chọn cả Từ ngày và Đến ngày trước khi tạo Gói biên lai.',packBusy:'Đang tạo Gói biên lai…',packError:'Không thể tạo Gói biên lai.',reviewTitle:'Xem lại gói biên lai',reviewIntro:'Xem lại chứng từ và tổng tiền đã chọn. Chưa có gói nào được tạo trước khi bạn xác nhận.',selected:'Chứng từ đã chọn',total:'Tổng cộng',filters:'Bộ lọc',pending:'Thao tác đang chờ',confirmCreate:'Xác nhận và tạo',cancel:'Hủy',selectionChanged:'Danh sách biên lai đủ điều kiện đã thay đổi. Hãy xem lại lựa chọn mới nhất trước khi xác nhận.',close:'Đóng'},
    ja:{preview:'パックをプレビュー',pdf:'PDF',print:'印刷',packTitle:'会社領収書パック',packRange:'領収書パックを作成する前に開始日と終了日を選択してください。',packBusy:'領収書パックを作成中…',packError:'領収書パックを作成できませんでした。',reviewTitle:'領収書パックを確認',reviewIntro:'選択した証憑と合計を確認してください。確認するまでパックは作成されません。',selected:'選択した証憑',total:'合計',filters:'フィルター',pending:'保留中の操作',confirmCreate:'確認して作成',cancel:'キャンセル',selectionChanged:'対象領収書が変更されました。確認前に最新の選択を確認してください。',close:'閉じる'},
  };
  function copy(){const lang=typeof getLang==='function'?getLang():'en';return {...COPY.en,...(COPY[lang]||{}),...FILTER_COPY.en,...(FILTER_COPY[lang]||{}),...PACK_COPY.en,...(PACK_COPY[lang]||{})};}
  const ASSISTANT_FALLBACK={
    open:'Open receipt assistant',title:'Receipt assistant',description:'Review permitted receipt facts and prepare an exact Company Receipt Pack.',
    company:'Company',gatewayNotice:'Demo AI: your request is sent to the GPT Demo gateway. Receipt files stay local; review the exact preview before creating a Pack.',fixture:'Deterministic Demo fixture',draft:'Draft',draftHelp:'The assistant can read cited receipt facts and prepare a Pack preview. Nothing is created until you approve the exact preview.',
    messageLabel:'Request',messagePlaceholder:'For example: prepare a Pack for the selected date range',dateFrom:'Date from',dateTo:'Date to',run:'Review receipts',working:'Reviewing permitted receipt facts…',
    sources:'Sources',noSources:'No cited sources yet.',preview:'Pack preview',selected:'Selected receipts',totals:'Totals',filters:'Filters',visibility:'Visibility',confirmation:'Human confirmation required',
    approve:'Approve exact Pack',cancel:'Cancel',close:'Close',retry:'Try again',statusDraft:'Draft — ready to review',statusRunning:'Running — reading permitted facts',statusWaiting:'Waiting — review and confirm',
    statusSucceeded:'Succeeded — Pack and artifact verified',statusFailed:'Failed — no Pack was created',statusCancelled:'Cancelled — no Pack was created',
    providerUnavailable:'The approved assistant provider is unavailable. Your draft is preserved; use the standard Pack preview or try again later.',cancellationNotice:'The run was cancelled before Pack creation.',
    scopeChanged:'The active Company changed. This draft cannot continue across Companies; review it again in the current Company.',rangeRequired:'Choose both Date from and Date to before asking the assistant to prepare a Pack.',
    success:'The persisted Pack was read back and its PDF evidence was verified.',packRecord:'Pack record',artifact:'PDF artifact',reason:'Confirmation reason',reasonPlaceholder:'I reviewed the cited receipts and exact Pack contents.',
  };
  function assistantCopy(){
    const result={};
    Object.keys(ASSISTANT_FALLBACK).forEach(key=>{
      const fallback=ASSISTANT_FALLBACK[key];
      result[key]=typeof tf==='function'?tf(`receiptAssistant.${key}`,fallback):fallback;
    });
    return result;
  }
  function statusTone(value){return value==='ready'?'ok':value==='voided'?'neutral':'info';}
  function statusLabel(value){
    const text=String(value||'—').replace(/_/g,' ');
    return text==='—'?text:text.charAt(0).toUpperCase()+text.slice(1);
  }
  function companyTimeZone(){
    const configured=DB&&DB.company&&DB.company.timeZone;
    return configured||'UTC';
  }
  function companyTodayParts(now){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:companyTimeZone(),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now||new Date());
      const values={};
      parts.forEach(function(part){if(part.type==='year'||part.type==='month'||part.type==='day')values[part.type]=Number(part.value);});
      if(values.year&&values.month&&values.day)return values;
    }catch{}
    const fallback=now||new Date();
    return {year:fallback.getUTCFullYear(),month:fallback.getUTCMonth()+1,day:fallback.getUTCDate()};
  }
  function isoFromUtcDate(date){return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;}
  function companyDate(year,month,day){return isoFromUtcDate(new Date(Date.UTC(year,month-1,day)));}
  function presetRange(value){
    const today=companyTodayParts(),year=today.year,month=today.month;
    if(value==='thisMonth') return [companyDate(year,month,1),companyDate(year,month+1,0)];
    if(value==='lastMonth') return [companyDate(year,month-1,1),companyDate(year,month,0)];
    if(value==='thisQuarter'){const start=Math.floor((month-1)/3)*3+1;return [companyDate(year,start,1),companyDate(year,start+3,0)];}
    if(value==='thisYear') return [`${year}-01-01`,`${year}-12-31`];
    return [null,null];
  }
  function receiptMoney(value,currency){
    const raw=String(value??'').trim();
    if(!/^-?\d+(?:\.\d+)?$/.test(raw)) return '—';
    const negative=raw.startsWith('-'),unsigned=negative?raw.slice(1):raw;
    const parts=unsigned.split('.'),integer=parts[0].replace(/^0+(?=\d)/,'')||'0';
    const fraction=(parts[1]||'').padEnd(2,'0').slice(0,2);
    const grouped=integer.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    const symbol={SGD:'S$',MYR:'RM',USD:'$'}[currency]||(currency||'')+' ';
    return (negative?'-':'')+symbol+grouped+'.'+fraction;
  }

  SCREENS['company-receipts']=async function(root){
    const c=copy();
    const adapter=window.ErpSystemData;
    if(!adapter||typeof adapter.companyReceipts!=='function'){
      throw new Error('Company Receipts adapter is unavailable.');
    }
    const pageSize=25;
    const filters={search:'',dateFrom:null,dateTo:null,preset:'allDates'};
    let response=await adapter.companyReceipts({limit:pageSize});
    let rows=Array.isArray(response&&response.data)?response.data:[];
    let meta=response&&response.meta||{};
    let loadingMore=false;
    let loadError='';
    let currentPack=null;
    let currentPackFilterKey=null;
    let page;
    const assistantSession={
      opened:false,draft:'',search:'',dateFrom:'',dateTo:'',scopeKey:null,state:'draft',result:null,
      error:null,reason:'',busy:false,executionStarted:false,controller:null,
    };
    async function reload(){
      response=await adapter.companyReceipts({limit:pageSize,search:filters.search,dateFrom:filters.dateFrom,dateTo:filters.dateTo});
      rows=Array.isArray(response&&response.data)?response.data:[];
      meta=response&&response.meta||{};
      currentPack=null;
      currentPackFilterKey=null;
    }
    function packFilterKey(input){
      return JSON.stringify({search:String(input.search||''),dateFrom:String(input.dateFrom||''),
        dateTo:String(input.dateTo||''),locale:String(input.locale||'en')});
    }
    function packRequest(input){
      input=input||{};
      const locale=['en','ms','zh','ja','vi'].includes(String(input.locale))?String(input.locale):'en';
      return {
        packKey:String(input.packKey||`company-receipt-pack:${crypto.randomUUID()}`),
        search:String(input.search||'').trim(),dateFrom:String(input.dateFrom||''),
        dateTo:String(input.dateTo||''),locale,
      };
    }
    function packActionLabel(action){
      return action==='download'?c.pdf:action==='print'?c.print:action==='view'?c.preview:c.confirmCreate;
    }
    function packTotalsText(totals){
      return (Array.isArray(totals)?totals:[]).map(total=>{
        const count=Number(total.receiptCount||0);
        return `${String(total.currency||'')} ${String(total.amount||'0')} · ${count}`;
      }).join(' · ')||'—';
    }
    function packReviewBody(prepared,request,pendingAction,status){
      const selectedRows=Array.isArray(prepared.rows)?prepared.rows:[];
      const visibleRows=selectedRows.slice(0,50).map(row=>`<li><b>${esc(row.merchant||'—')}</b><span>${esc(row.transactionDate||'—')} · ${esc(row.originalFileName||row.receiptNumber||String(row.receiptId||'—'))}</span></li>`).join('');
      const remaining=selectedRows.length>50?`<p class="hint">+ ${selectedRows.length-50} more selected records</p>`:'';
      return `<div class="callout info">${ic('shield')}<span>${esc(c.reviewIntro)}</span></div>
        <div class="docmeta" data-pack-review-facts>
          <div class="dm"><small>${esc(c.selected)}</small><b>${esc(String(prepared.rowCount||selectedRows.length))}</b></div>
          <div class="dm"><small>${esc(c.total)}</small><b>${esc(packTotalsText(prepared.totals))}</b></div>
          <div class="dm"><small>${esc(c.filters)}</small><b>${esc(`${request.dateFrom} → ${request.dateTo}${request.search?` · ${request.search}`:''}`)}</b></div>
          <div class="dm"><small>${esc(c.pending)}</small><b>${esc(packActionLabel(pendingAction))}</b></div>
        </div>
        <div class="stack" data-pack-review-selected><strong>${esc(c.selected)}</strong><ul class="stack">${visibleRows||'<li>—</li>'}</ul>${remaining}</div>
        <div class="auth-error" data-pack-review-error role="alert" aria-live="polite">${esc(status||'')}</div>`;
    }
    function cancelledPackError(){
      const error=new Error('Receipt Pack creation was cancelled.');
      error.code='webmcp_execution_cancelled';
      return error;
    }
    function restorePackFocus(target){
      if(!target) return;
      setTimeout(()=>{
        if(!target.isConnected||target.disabled||typeof target.focus!=='function') return;
        try{target.focus({preventScroll:true});}catch{target.focus();}
      },0);
    }
    async function preparePack(request){
      if(typeof adapter.companyReceiptPackPrepare!=='function') throw new Error(c.packError);
      const response=await adapter.companyReceiptPackPrepare({
        search:request.search,dateFrom:request.dateFrom,dateTo:request.dateTo,locale:request.locale,
      });
      const prepared=response&&response.data;
      if(!prepared||!prepared.selectionDigest||!Array.isArray(prepared.rows)) throw new Error(c.packError);
      return prepared;
    }
    async function showPackConfirmation(prepared,request,options){
      options=options||{};
      const signal=options.signal;
      const assertCurrent=typeof options.assertCurrent==='function'?options.assertCurrent:null;
      const pendingAction=options.pendingAction||'create';
      const returnFocus=options.returnFocus;
      if(assertCurrent) assertCurrent();
      if(signal&&signal.aborted) throw cancelledPackError();
      return new Promise((resolve,reject)=>{
        let settled=false,busy=false,reviewed=prepared;
        let clearAbort=()=>{};
        const finishCancel=()=>{if(settled)return;settled=true;clearAbort();resolve(null);restorePackFocus(returnFocus);};
        const abort=()=>{
          if(settled||busy)return;
          settled=true;clearAbort();closeModal();reject(cancelledPackError());
        };
        const onClose=()=>{if(!settled&&!busy)finishCancel();};
        appModal({icon:'shield',title:c.reviewTitle,width:'min(820px, calc(100vw - 24px))',
          body:packReviewBody(reviewed,request,pendingAction,''),
          actions:`${btn(c.cancel,{cls:'soft',attrs:'data-company-receipt-pack-cancel'})}${btn(c.confirmCreate,{icon:'check',cls:'primary',attrs:'data-company-receipt-pack-confirm'})}`,
          onClose});
        const modal=$('#modalEl');
        const confirmButton=modal?.querySelector('[data-company-receipt-pack-confirm]');
        const cancelButton=modal?.querySelector('[data-company-receipt-pack-cancel]');
        const closeButton=modal?.querySelector('.modal-head .x');
        const setBusy=(value)=>{
          busy=value;
          if(confirmButton) confirmButton.disabled=value;
          if(cancelButton) cancelButton.disabled=value;
          if(closeButton) closeButton.disabled=value;
          const scrim=$('#modalScrim');
          if(scrim) scrim.style.pointerEvents=value?'none':'';
        };
        clearAbort=()=>signal?.removeEventListener('abort',abort);
        signal?.addEventListener('abort',abort,{once:true});
        cancelButton?.addEventListener('click',()=>{if(!busy) closeModal();});
        confirmButton?.addEventListener('click',async()=>{
          if(busy||settled)return;
          setBusy(true);
          try{
            if(assertCurrent) assertCurrent();
            if(signal?.aborted) throw cancelledPackError();
            const latest=await preparePack(request);
            if(latest.selectionDigest!==reviewed.selectionDigest){
              reviewed=latest;
              const body=modal?.querySelector('.modal-body');
              if(body) body.innerHTML=packReviewBody(reviewed,request,pendingAction,c.selectionChanged);
              setBusy(false);
              return;
            }
            if(assertCurrent) assertCurrent();
            if(signal?.aborted) throw cancelledPackError();
            if(typeof adapter.companyReceiptPack!=='function') throw new Error(c.packError);
            const result=await adapter.companyReceiptPack(request);
            if(!result?.data?.pack) throw new Error(c.packError);
            settled=true;clearAbort();closeModal();resolve(result);
          }catch(error){
            if(error?.code==='webmcp_execution_cancelled'||signal?.aborted){
              settled=true;clearAbort();closeModal();reject(error?.code?error:cancelledPackError());return;
            }
            if(['webmcp_context_stale','webmcp_route_unavailable','not_authenticated','permission_denied']
              .includes(error?.code)){
              settled=true;clearAbort();closeModal();reject(error);return;
            }
            setBusy(false);
            const errorBox=modal?.querySelector('[data-pack-review-error]');
            if(errorBox) errorBox.textContent=String(error?.message||c.packError);
          }
        });
      });
    }
    function captureFilters(form){
      const previous=packFilterKey({...filters,locale:typeof getLang==='function'?getLang():'en'});
      filters.search=form.querySelector('[data-receipt-search]').value.trim();
      filters.dateFrom=form.querySelector('[data-receipt-from]').value||null;
      filters.dateTo=form.querySelector('[data-receipt-to]').value||null;
      if(filters.dateFrom&&filters.dateTo&&filters.dateFrom>filters.dateTo) throw new Error(c.invalid);
      const next=packFilterKey({...filters,locale:typeof getLang==='function'?getLang():'en'});
      if(previous!==next){currentPack=null;currentPackFilterKey=null;}
    }
    async function ensurePack(form,action,returnFocus){
      captureFilters(form);
      if(!filters.dateFrom||!filters.dateTo) throw new Error(c.packRange);
      const request=packRequest({search:filters.search,dateFrom:filters.dateFrom,dateTo:filters.dateTo,
        locale:typeof getLang==='function'?getLang():'en'});
      const key=packFilterKey(request);
      if(currentPack&&currentPackFilterKey===key)return currentPack;
      const prepared=await preparePack(request);
      const result=await showPackConfirmation(prepared,request,{pendingAction:action||'create',returnFocus});
      if(!result)return null;
      currentPack=result.data.pack;
      currentPackFilterKey=key;
      if(!currentPack) throw new Error(c.packError);
      return currentPack;
    }
    async function getPackPdf(form,action,returnFocus){
      const pack=await ensurePack(form,action,returnFocus);
      if(!pack)return null;
      if(typeof adapter.companyReceiptPackPdf!=='function') throw new Error(c.packError);
      const response=await adapter.companyReceiptPackPdf(pack.id,action);
      const content=response.data&&response.data.content;
      if(!content) throw new Error(c.packError);
      return {pack,response,url:URL.createObjectURL(new Blob([content],{type:'application/pdf'}))};
    }
    function assistantScopeKey(){
      return JSON.stringify([DB?.erpSystem?.scope?.masterFn||'',DB?.erpSystem?.scope?.companyFn||DB?.company?.name||'unknown',DB?.user?.email||'']);
    }
    function assistantErrorMessage(error,a){
      const code=String(error&&error.code||'');
      if(code==='assistant_cancelled'||code==='AbortError') return a.cancellationNotice;
      if(['assistant_provider_unavailable','assistant_agent_unavailable','assistant_provider_error'].includes(code)) return a.providerUnavailable;
      return String(error&&error.message||a.statusFailed);
    }
    function assistantStateLabel(state,a){
      return ({draft:a.statusDraft,running:a.statusRunning,waiting:a.statusWaiting,succeeded:a.statusSucceeded,
        failed:a.statusFailed,cancelled:a.statusCancelled})[state]||a.statusDraft;
    }
    function assistantStateTone(state){
      return ({draft:'neutral',running:'info',waiting:'warn',succeeded:'ok',failed:'danger',cancelled:'neutral'})[state]||'neutral';
    }
    function assistantSourceBody(result,a){
      const sources=Array.isArray(result&&result.sources)?result.sources:[];
      if(!sources.length) return `<p class="hint">${esc(a.noSources)}</p>`;
      return `<ul class="receipt-assistant-source-list">${sources.slice(0,50).map(source=>
        `<li><span class="cap info"><span class="dot"></span>${esc(String(source.sourceType||'source'))}</span><code>${esc(String(source.sourceId||'—'))}</code>${source.recordVersion!=null?`<small>v${esc(source.recordVersion)}</small>`:''}</li>`).join('')}</ul>`;
    }
    function assistantPreviewBody(result,a){
      const preview=result&&result.preview;
      if(!preview||typeof preview!=='object') return '';
      const rows=Array.isArray(preview.rows)?preview.rows:[];
      const filtersValue=preview.filters&&typeof preview.filters==='object'?preview.filters:{};
      const filtersText=`${String(filtersValue.dateFrom||'—')} → ${String(filtersValue.dateTo||'—')}${filtersValue.search?` · ${String(filtersValue.search)}`:''}`;
      const totals=packTotalsText(preview.totals);
      const visibleLimit=assistantSession.previewLimit||20;
      const visibleRows=rows.slice(0,visibleLimit).map((row,index)=>`<li data-receipt-assistant-row tabindex="-1"><b>${esc(row.merchant||'—')}</b><div>
        <span>${esc(row.transactionDate||'—')} · ${esc(row.originalFileName||'—')}</span>
        <dl class="receipt-assistant-row-facts">${[
          [c.amount,`${row.amount??'—'} ${row.currency||''}`],[c.number,row.receiptNumber],
          [c.category,row.category],[c.purpose,row.businessPurpose],[c.notes,row.notes],
          [c.detail,row.receiptId],[c.version,row.receiptVersion],[c.uploader,row.uploaderName||row.uploaderUserId],
          [c.originalFile,`${row.documentId??'—'} / ${row.documentVersionId??'—'}`],[c.hash,row.documentSha256],
        ].map(([label,value])=>`<dt>${esc(label)}</dt><dd>${esc(value==null||value===''?'—':String(value))}</dd>`).join('')}</dl>
        ${btn(c.originalFile,{icon:'eye',cls:'soft',attrs:`type="button" data-receipt-assistant-evidence="${index}" ${assistantSession.busy?'disabled':''}`})}
      </div></li>`).join('');
      return `<section class="receipt-assistant-preview" data-receipt-assistant-preview aria-labelledby="receipt-assistant-preview-title">
        <div class="receipt-assistant-section-title"><h4 id="receipt-assistant-preview-title">${esc(a.preview)}</h4><span class="cap warn"><span class="dot"></span>${esc(a.confirmation)}</span></div>
        <div class="docmeta receipt-assistant-facts">
          <div class="dm"><small>${esc(a.selected)}</small><b>${esc(String(preview.rowCount||rows.length))}</b></div>
          <div class="dm"><small>${esc(a.totals)}</small><b>${esc(totals)}</b></div>
          <div class="dm"><small>${esc(a.filters)}</small><b>${esc(filtersText)}</b></div>
          <div class="dm"><small>${esc(a.visibility)}</small><b>${esc(String(preview.visibility||'—'))}</b></div>
        </div>
        <ul class="receipt-assistant-preview-rows">${visibleRows||'<li>—</li>'}</ul>
        ${rows.length>visibleLimit?btn(`${c.more} (${rows.length-visibleLimit})`,{cls:'soft',attrs:'type="button" data-receipt-assistant-more'}):''}
      </section>`;
    }
    function assistantSuccessBody(result,a){
      const pack=result&&result.pack;
      const artifact=result&&result.verification&&result.verification.artifact||result&&result.artifact;
      if(!pack||!artifact) return '';
      return `<div class="callout ok receipt-assistant-success" role="status">${ic('checkc')}<span>${esc(a.success)}<br><b>${esc(a.packRecord)}:</b> ${esc(String(pack.id||'—'))}<br><b>${esc(a.artifact)}:</b> <code>${esc(String(artifact.artifactSha256||'—'))}</code></span></div>${assistantSession.pdfUrl?`<div class="company-receipt-pack-frame"><iframe data-receipt-assistant-pdf src="${esc(assistantSession.pdfUrl)}" title="${esc(c.packTitle)}"></iframe></div>`:''}`;
    }
    function assistantBody(a){
      const result=assistantSession.result||{};
      const waiting=assistantSession.state==='waiting';
      const formDisabled=assistantSession.busy||waiting||assistantSession.state==='succeeded';
      const error=assistantSession.error;
      const errorBody=error?`<div class="callout ${assistantSession.state==='cancelled'?'info':'warn'} receipt-assistant-error" role="alert" aria-live="polite">${ic(assistantSession.state==='cancelled'?'info':'warn')}<span>${esc(String(error.message||error))}</span></div>`:'';
      const progress=assistantSession.state==='running'?`<div class="receipt-assistant-progress" role="status" aria-live="polite"><span class="progress-spinner" aria-hidden="true"></span>${esc(a.working)}</div>`:'';
      return `<div class="receipt-assistant-workspace" data-receipt-assistant-workspace data-state="${esc(assistantSession.state)}" aria-busy="${assistantSession.busy?'true':'false'}">
        <div class="receipt-assistant-context"><div><small>${esc(a.company)}</small><strong>${esc(String(DB&&DB.company&&DB.company.name||'—'))}</strong></div><span class="cap ${assistantStateTone(assistantSession.state)}" data-receipt-assistant-status><span class="dot"></span>${esc(assistantStateLabel(assistantSession.state,a))}</span></div>
        ${assistantSession.opened&&window.erpDataMode&&window.erpDataMode()==='demo'?`<div class="callout info receipt-assistant-fixture">${ic('info')}<span>${esc(a.gatewayNotice)}</span></div>`:''}
        <p class="receipt-assistant-description">${esc(a.description)}</p>
        <form class="receipt-assistant-draft" data-receipt-assistant-form>
          <div class="receipt-assistant-section-title"><h4>${esc(a.draft)}</h4><span class="hint">${esc(a.draftHelp)}</span></div>
          <label class="fld"><span>${esc(a.messageLabel)}</span><textarea rows="3" maxlength="4000" data-receipt-assistant-message ${formDisabled?'disabled':''} placeholder="${esc(a.messagePlaceholder)}">${esc(assistantSession.draft)}</textarea></label>
          <div class="receipt-assistant-range"><label class="fld"><span>${esc(a.dateFrom)}</span><input type="date" data-receipt-assistant-from value="${esc(assistantSession.dateFrom)}" ${formDisabled?'disabled':''}></label><label class="fld"><span>${esc(a.dateTo)}</span><input type="date" data-receipt-assistant-to value="${esc(assistantSession.dateTo)}" ${formDisabled?'disabled':''}></label></div>
          ${waiting?`<label class="fld receipt-assistant-reason-field"><span>${esc(a.reason)}</span><input maxlength="500" data-receipt-assistant-reason value="${esc(assistantSession.reason||a.reasonPlaceholder)}" placeholder="${esc(a.reasonPlaceholder)}"></label>`:''}
          ${assistantSession.state==='draft'||assistantSession.state==='failed'||assistantSession.state==='cancelled'?`<button class="receipt-assistant-submit" type="submit" data-receipt-assistant-submit ${assistantSession.busy?'disabled':''}>${ic('comment')}<span>${esc(assistantSession.state==='draft'?a.run:a.retry)}</span></button>`:''}
        </form>
        ${errorBody}${progress}
        ${assistantSession.evidenceUrl?`<section class="company-receipt-pack-frame" data-receipt-assistant-evidence-preview>${assistantSession.evidenceType==='application/pdf'?`<iframe src="${esc(assistantSession.evidenceUrl)}" title="${esc(c.originalFile)}"></iframe>`:`<img src="${esc(assistantSession.evidenceUrl)}" alt="${esc(c.originalFile)}" style="max-width:100%;height:auto">`}</section>`:''}
        ${assistantPreviewBody(result,a)}
        <section class="receipt-assistant-sources" aria-labelledby="receipt-assistant-sources-title"><div class="receipt-assistant-section-title"><h4 id="receipt-assistant-sources-title">${esc(a.sources)}</h4></div>${assistantSourceBody(result,a)}</section>
        ${assistantSuccessBody(result,a)}
      </div>`;
    }
    function assistantActions(a){
      const result=assistantSession.result||{},confirmation=result.confirmation;
      const actions=[];
      if(assistantSession.state==='succeeded') actions.push(btn(c.preview,{icon:'eye',cls:'soft',attrs:`type="button" data-receipt-assistant-open-pdf ${assistantSession.busy?'disabled':''}`}));
      if(assistantSession.state==='running'&&!assistantSession.executionStarted){
        actions.push(btn(a.cancel,{cls:'soft',attrs:'type="button" data-receipt-assistant-cancel'}));
      }else if(assistantSession.state==='waiting'){
        actions.push(btn(a.cancel,{cls:'soft',attrs:'type="button" data-receipt-assistant-cancel'}));
        if(confirmation&&confirmation.available) actions.push(btn(a.approve,{icon:'check',cls:'primary',attrs:'type="button" data-receipt-assistant-approve'}));
      }
      if(assistantSession.state!=='running'||assistantSession.executionStarted) actions.push(btn(a.close,{cls:assistantSession.state==='succeeded'?'primary':'soft',attrs:'type="button" data-receipt-assistant-close'}));
      return actions.join('');
    }
    function assistantCurrentScope(){
      if(!assistantSession.scopeKey) return true;
      if(assistantScopeKey()===assistantSession.scopeKey) return true;
      assistantSession.state='failed';assistantSession.busy=false;assistantSession.error={code:'assistant_scope_changed',message:assistantCopy().scopeChanged};
      return false;
    }
    function bindAssistantModal(focusSelector){
      const modal=$('#modalEl');
      if(!modal||!modal.matches('.receipt-assistant-modal')) return;
      modal.querySelector('[data-receipt-assistant-form]')?.addEventListener('submit',event=>{event.preventDefault();void runAssistant();});
      modal.querySelector('[data-receipt-assistant-message]')?.addEventListener('input',event=>{assistantSession.draft=event.currentTarget.value;});
      modal.querySelector('[data-receipt-assistant-from]')?.addEventListener('input',event=>{assistantSession.dateFrom=event.currentTarget.value;});
      modal.querySelector('[data-receipt-assistant-to]')?.addEventListener('input',event=>{assistantSession.dateTo=event.currentTarget.value;});
      modal.querySelector('[data-receipt-assistant-reason]')?.addEventListener('input',event=>{assistantSession.reason=event.currentTarget.value;});
      modal.querySelector('[data-receipt-assistant-message]')?.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!assistantSession.busy){event.preventDefault();event.currentTarget.form?.requestSubmit();}
      });
      modal.querySelector('[data-receipt-assistant-cancel]')?.addEventListener('click',()=>{void cancelAssistant();});
      modal.querySelector('[data-receipt-assistant-approve]')?.addEventListener('click',()=>{void approveAssistant();});
      modal.querySelectorAll('[data-receipt-assistant-evidence]').forEach(button=>button.addEventListener('click',()=>{void inspectAssistantEvidence(Number(button.dataset.receiptAssistantEvidence));}));
      modal.querySelector('[data-receipt-assistant-more]')?.addEventListener('click',()=>{
        const previous=assistantSession.previewLimit||20;
        assistantSession.previewLimit=previous+20;renderAssistant();
        $('#modalEl')?.querySelectorAll('[data-receipt-assistant-row]')[previous]?.focus();
      });
      modal.querySelector('[data-receipt-assistant-open-pdf]')?.addEventListener('click',()=>{void openAssistantPdf();});
      modal.querySelector('[data-receipt-assistant-close]')?.addEventListener('click',()=>closeModal());
      if(focusSelector){
        const target=modal.querySelector(focusSelector);
        if(target){setTimeout(()=>{try{target.focus({preventScroll:true});}catch{target.focus();}},0);}
      }
    }
    function renderAssistant(focusSelector){
      const modal=$('#modalEl');
      if(!modal||!modal.matches('.receipt-assistant-modal')) return;
      const a=assistantCopy();
      const body=modal.querySelector('.modal-body'),foot=modal.querySelector('.modal-foot');
      if(body) body.innerHTML=assistantBody(a);
      if(foot) foot.innerHTML=assistantActions(a);
      bindAssistantModal(focusSelector);
    }
    function assistantPayload(){
      return {message:assistantSession.draft.trim(),search:assistantSession.search,dateFrom:assistantSession.dateFrom,dateTo:assistantSession.dateTo,
        locale:typeof getLang==='function'?getLang():'en'};
    }
    function assistantExecutionPayload(){
      const confirmation=assistantSession.result&&assistantSession.result.confirmation||{};
      const filters=confirmation.filters||{};
      return {packKey:String(confirmation.packKey||''),search:String((filters.search??assistantSession.search)||''),dateFrom:String(filters.dateFrom||assistantSession.dateFrom),
        dateTo:String(filters.dateTo||assistantSession.dateTo),locale:confirmation.locale|| (typeof getLang==='function'?getLang():'en'),
        executionIntentId:confirmation.intentId,executionIntentKey:confirmation.intentKey,selectionDigest:confirmation.selectionDigest,payloadDigest:confirmation.payloadDigest};
    }
    async function runAssistant(){
      if(assistantSession.busy) return;
      const a=assistantCopy();
      if(!assistantSession.draft.trim()){assistantSession.error={code:'assistant_message_invalid',message:a.messageLabel+' is required.'};renderAssistant('[data-receipt-assistant-message]');return;}
      if(!assistantSession.dateFrom||!assistantSession.dateTo||assistantSession.dateFrom>assistantSession.dateTo){assistantSession.error={code:'assistant_range_invalid',message:a.rangeRequired};renderAssistant('[data-receipt-assistant-from]');return;}
      if(!assistantCurrentScope()){renderAssistant();return;}
      if(typeof adapter.receiptAssistant!=='function'){assistantSession.state='failed';assistantSession.error={code:'assistant_provider_unavailable',message:a.providerUnavailable};renderAssistant();return;}
      if(assistantSession.evidenceUrl){URL.revokeObjectURL(assistantSession.evidenceUrl);assistantSession.evidenceUrl=null;}
      assistantSession.previewLimit=20;assistantSession.error=null;assistantSession.result=null;assistantSession.state='running';assistantSession.busy=true;assistantSession.executionStarted=false;
      const controller=new AbortController();assistantSession.controller=controller;renderAssistant();
      try{
        const response=await adapter.receiptAssistant(assistantPayload(),{signal:controller.signal});
        if(!assistantCurrentScope()) return;
        const result=response&&response.data||response;
        if(!result||!['waiting','succeeded','failed','cancelled'].includes(String(result.state))){throw Object.assign(new Error(a.statusFailed),{code:'assistant_result_invalid'});}
        assistantSession.result=result;assistantSession.state=result.state;assistantSession.error=result.state==='failed'?{code:'assistant_failed',message:a.statusFailed}:null;
      }catch(error){
        if(assistantSession.state==='cancelled') return;
        assistantSession.state=error&&error.name==='AbortError'?'cancelled':'failed';
        assistantSession.error={code:String(error&&error.code||''),message:assistantErrorMessage(error,a)};
      }finally{
        assistantSession.busy=false;assistantSession.controller=null;renderAssistant(assistantSession.state==='waiting'?'[data-receipt-assistant-reason]':assistantSession.state==='failed'?'[data-receipt-assistant-message]':undefined);
      }
    }
    async function cancelAssistant(){
      if(assistantSession.executionStarted) return;
      const a=assistantCopy();
      if(assistantSession.state==='running'){
        assistantSession.state='cancelled';assistantSession.error={code:'assistant_cancelled',message:a.cancellationNotice};assistantSession.busy=false;assistantSession.controller?.abort();assistantSession.controller=null;renderAssistant();return;
      }
      if(assistantSession.state!=='waiting') return;
      if(!assistantCurrentScope()){renderAssistant();return;}
      const confirmation=assistantSession.result&&assistantSession.result.confirmation;
      if(!confirmation||!confirmation.available||typeof adapter.receiptAssistantDecision!=='function'){
        assistantSession.state='cancelled';assistantSession.error={code:'assistant_cancelled',message:a.cancellationNotice};renderAssistant();return;
      }
      assistantSession.busy=true;renderAssistant();
      try{
        await adapter.receiptAssistantDecision('cancel',{intentId:confirmation.intentId,expectedVersion:confirmation.intentVersion,reason:a.cancellationNotice});
        assistantSession.state='cancelled';assistantSession.error={code:'assistant_cancelled',message:a.cancellationNotice};
      }catch(error){assistantSession.error={code:String(error&&error.code||''),message:assistantErrorMessage(error,a)};}
      finally{assistantSession.busy=false;renderAssistant();}
    }
    async function approveAssistant(){
      if(assistantSession.busy||assistantSession.state!=='waiting') return;
      const a=assistantCopy();
      if(!assistantCurrentScope()){renderAssistant();return;}
      const confirmation=assistantSession.result&&assistantSession.result.confirmation;
      if(!confirmation||!confirmation.available){assistantSession.error={code:'assistant_agent_unavailable',message:a.providerUnavailable};renderAssistant();return;}
      const modal=$('#modalEl'),reason=String(modal?.querySelector('[data-receipt-assistant-reason]')?.value||assistantSession.reason||a.reasonPlaceholder).trim();
      assistantSession.reason=reason;
      if(reason.length<3){assistantSession.error={code:'assistant_reason_invalid',message:a.reason+' is required.'};renderAssistant('[data-receipt-assistant-reason]');return;}
      assistantSession.executionStarted=true;assistantSession.busy=true;assistantSession.state='running';assistantSession.error=null;renderAssistant();
      const controller=new AbortController();assistantSession.controller=controller;
      try{
        if(typeof adapter.receiptAssistantDecision==='function'){
          await adapter.receiptAssistantDecision('approve',{intentId:confirmation.intentId,expectedVersion:confirmation.intentVersion,reason:reason},{signal:controller.signal});
        }
        if(!assistantCurrentScope()) return;
        if(typeof adapter.receiptAssistantExecute!=='function') throw Object.assign(new Error(a.statusFailed),{code:'assistant_provider_unavailable'});
        const response=await adapter.receiptAssistantExecute(assistantExecutionPayload(),{signal:controller.signal});
        if(!assistantCurrentScope()) return;
        const result=response&&response.data||response;
        if(!result||result.state!=='succeeded'||!result.pack||!result.verification?.artifact?.artifactSha256){throw Object.assign(new Error(a.statusFailed),{code:'assistant_postcondition_missing'});}
        assistantSession.result={...(assistantSession.result||{}),...result,authoritativeCompletion:true};assistantSession.state='succeeded';assistantSession.error=null;
      }catch(error){
        assistantSession.state=error&&error.name==='AbortError'?'cancelled':'failed';assistantSession.error={code:String(error&&error.code||''),message:assistantErrorMessage(error,a)};
      }finally{
        assistantSession.busy=false;assistantSession.controller=null;assistantSession.executionStarted=false;renderAssistant();
      }
    }
    async function inspectAssistantEvidence(index){
      if(assistantSession.busy||!assistantCurrentScope()) return;
      const modal=$('#modalEl'),result=assistantSession.result,row=result?.preview?.rows?.[index];
      if(!row) return;
      if(assistantSession.evidenceUrl){URL.revokeObjectURL(assistantSession.evidenceUrl);assistantSession.evidenceUrl=null;}
      assistantSession.busy=true;assistantSession.error=null;renderAssistant();
      try{
        const detail=(await adapter.companyReceipt(row.receiptId))?.data;
        if(!detail||detail.version!==row.receiptVersion||detail.documentId!==row.documentId||detail.documentVersionId!==row.documentVersionId||detail.documentSha256!==row.documentSha256) throw new Error(c.selectionChanged);
        const file=(await adapter.documentContent(detail.documentId,detail.documentVersionNo))?.data;
        const type=String(file?.contentType||'').split(';')[0];
        if(!file?.content||file.content.byteLength>20*1024*1024||!['application/pdf','image/png','image/jpeg','image/webp'].includes(type)||file.versionNo!==detail.documentVersionNo||file.sha256!==row.documentSha256) throw new Error(c.notReady);
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',file.content)),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(hash!==row.documentSha256) throw new Error(c.notReady);
        if(!modal?.isConnected||$('#modalEl')!==modal||!assistantCurrentScope()||assistantSession.result!==result) return;
        assistantSession.evidenceUrl=URL.createObjectURL(new Blob([file.content],{type:type}));assistantSession.evidenceType=type;
      }catch(error){assistantSession.error={message:assistantErrorMessage(error,assistantCopy())};}
      finally{
        assistantSession.busy=false;
        if(modal?.isConnected&&$('#modalEl')===modal) renderAssistant(`[data-receipt-assistant-evidence="${index}"]`);
      }
    }
    async function openAssistantPdf(){
      if(assistantSession.busy||assistantSession.state!=='succeeded') return;
      const modal=$('#modalEl'),result=assistantSession.result;
      if(!assistantCurrentScope()){renderAssistant();return;}
      if(assistantSession.pdfUrl){URL.revokeObjectURL(assistantSession.pdfUrl);assistantSession.pdfUrl=null;}
      assistantSession.busy=true;assistantSession.error=null;renderAssistant();
      try{
        const response=await adapter.companyReceiptPackPdf(result.pack.id,'view');
        const content=response?.data?.content;
        if(!content) throw new Error(c.packError);
        const digest=await crypto.subtle.digest('SHA-256',content);
        const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(hash!==result.verification?.artifact?.artifactSha256) throw new Error(c.packError);
        if(!modal?.isConnected||$('#modalEl')!==modal||!assistantCurrentScope()||assistantSession.result!==result) return;
        if(assistantSession.pdfUrl) URL.revokeObjectURL(assistantSession.pdfUrl);
        assistantSession.pdfUrl=URL.createObjectURL(new Blob([content],{type:'application/pdf'}));
      }catch(error){
        assistantSession.error={message:assistantErrorMessage(error,assistantCopy())};
      }finally{
        assistantSession.busy=false;
        if(modal?.isConnected&&$('#modalEl')===modal) renderAssistant('[data-receipt-assistant-open-pdf]');
      }
    }
    function openReceiptAssistant(){
      const a=assistantCopy();
      if(!assistantSession.opened){
        assistantSession.opened=true;assistantSession.scopeKey=assistantScopeKey();assistantSession.draft='';assistantSession.search=filters.search||'';assistantSession.dateFrom=filters.dateFrom||'';assistantSession.dateTo=filters.dateTo||'';assistantSession.state='draft';assistantSession.result=null;assistantSession.error=null;
      }
      appModal({icon:'comment',title:a.title,width:'min(980px, calc(100vw - 24px))',body:assistantBody(a),actions:assistantActions(a),onClose:()=>{
        if(assistantSession.evidenceUrl){URL.revokeObjectURL(assistantSession.evidenceUrl);assistantSession.evidenceUrl=null;}
        if(assistantSession.pdfUrl){URL.revokeObjectURL(assistantSession.pdfUrl);assistantSession.pdfUrl=null;}
        if(assistantSession.state==='running'&&assistantSession.busy&&!assistantSession.executionStarted){assistantSession.state='cancelled';assistantSession.error={code:'assistant_cancelled',message:assistantCopy().cancellationNotice};assistantSession.busy=false;assistantSession.controller?.abort();assistantSession.controller=null;}
      }});
      const modal=$('#modalEl');
      modal?.classList.add('receipt-assistant-modal');
      modal?.setAttribute('data-receipt-assistant-modal','true');
      bindAssistantModal();
    }
    function can(action){return meta.actions&&meta.actions[action]===true;}
    function receiptDetails(row){
      if(!row) return;
      const owns=meta.actorUserId!=null&&String(row.uploaderUserId)===String(meta.actorUserId);
      const editable=owns&&can('edit')&&row.status!=='voided'
        &&typeof adapter.updateCompanyReceipt==='function';
      const voidable=owns&&can('void')&&row.status!=='voided'
        &&typeof adapter.voidCompanyReceipt==='function';
      appModal({icon:'receipt',title:`${c.detail} · ${row.id}`,width:'min(780px, calc(100vw - 24px))',body:`
        <div class="callout info">${ic('lock')}<span>${esc(c.originalFile)}: ${esc(row.originalFileName||'—')}<br>${esc(c.hash)}: ${esc(row.evidenceSha256||row.documentSha256||'—')}</span></div>
        <form class="formgrid" data-company-receipt-edit-form>
          <label class="fld"><span>${esc(c.date)}</span><input type="date" data-receipt-edit-date value="${esc(row.transactionDate||'')}"></label>
          <label class="fld"><span>${esc(c.merchant)}</span><input required data-receipt-edit-merchant value="${esc(row.merchant||'')}"></label>
          <label class="fld"><span>${esc(c.number)}</span><input data-receipt-edit-number value="${esc(row.receiptNumber||'')}"></label>
          <label class="fld"><span>${esc(c.category)}</span><input required data-receipt-edit-category value="${esc(row.category||'')}"></label>
          <label class="fld"><span>${esc(c.amount)}</span><input required inputmode="decimal" data-receipt-edit-amount value="${esc(row.amount||'')}"></label>
          <label class="fld"><span>${esc(c.currency)}</span><input required maxlength="3" data-receipt-edit-currency value="${esc(row.currency||'')}"></label>
          <label class="fld span-2"><span>${esc(c.purpose)}</span><input required data-receipt-edit-purpose value="${esc(row.businessPurpose||'')}"></label>
          <label class="fld span-2"><span>${esc(c.notes)}</span><textarea data-receipt-edit-notes>${esc(row.notes||'')}</textarea></label>
          <div class="docmeta span-2"><div class="dm"><small>${esc(c.status)}</small><b>${esc(statusLabel(row.status))}</b></div><div class="dm"><small>${esc(c.version)}</small><b>${esc(String(row.version||'—'))}</b></div><div class="dm"><small>${esc(c.uploader)}</small><b>${esc(row.uploaderName||String(row.uploaderUserId||'—'))}</b></div></div>
          <div class="auth-error span-2" data-receipt-edit-error role="alert"></div>
        </form>`,actions:`${btn(c.close,{cls:'soft',attrs:'onclick="closeModal()"'})}${voidable?btn(c.void,{icon:'x',cls:'danger',attrs:'data-company-receipt-void'}):''}${editable?btn(c.save,{icon:'check',cls:'primary',attrs:'data-company-receipt-edit-save'}):''}`});
      const modal=$('#modalEl');
      modal.querySelector('[data-company-receipt-edit-save]')?.addEventListener('click',async event=>{
        const button=event.currentTarget,form=modal.querySelector('[data-company-receipt-edit-form]');
        if(!form.reportValidity()) return;
        button.disabled=true;
        try{
          await adapter.updateCompanyReceipt(row.id,{
            expectedVersion:Number(row.version),
            transactionDate:form.querySelector('[data-receipt-edit-date]').value||null,
            merchant:form.querySelector('[data-receipt-edit-merchant]').value,
            receiptNumber:form.querySelector('[data-receipt-edit-number]').value||null,
            category:form.querySelector('[data-receipt-edit-category]').value,
            amount:form.querySelector('[data-receipt-edit-amount]').value,
            currency:form.querySelector('[data-receipt-edit-currency]').value,
            businessPurpose:form.querySelector('[data-receipt-edit-purpose]').value,
            notes:form.querySelector('[data-receipt-edit-notes]').value||null,
          });
          closeModal();await reload();page.render();
        }catch(error){modal.querySelector('[data-receipt-edit-error]').textContent=String(error&&error.message||error);button.disabled=false;}
      });
      modal.querySelector('[data-company-receipt-void]')?.addEventListener('click',()=>receiptVoid(row));
    }
    function receiptVoid(row){
      appModal({icon:'shield',title:`${c.void} · ${row.id}`,body:`
        <form class="formgrid" data-company-receipt-void-form>
          <label class="fld span-2"><span>${esc(c.voidReason)}</span><textarea required minlength="3" data-receipt-void-reason></textarea></label>
          <div class="auth-error span-2" data-receipt-void-error role="alert"></div>
        </form>`,actions:`${btn(c.close,{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c.voidConfirm,{icon:'x',cls:'danger',attrs:'data-company-receipt-void-save'})}`});
      const modal=$('#modalEl');
      modal.querySelector('[data-company-receipt-void-save]').addEventListener('click',async event=>{
        const button=event.currentTarget,form=modal.querySelector('[data-company-receipt-void-form]');
        if(!form.reportValidity()) return;
        button.disabled=true;
        try{
          await adapter.voidCompanyReceipt(row.id,{expectedVersion:Number(row.version),reason:form.querySelector('[data-receipt-void-reason]').value});
          closeModal();await reload();page.render();
        }catch(error){modal.querySelector('[data-receipt-void-error]').textContent=String(error&&error.message||error);button.disabled=false;}
      });
    }
    async function openConfirmation(document){
      const confirmation=(await adapter.companyReceiptConfirmation(document.documentVersionId)).data;
      if(!confirmation||!confirmation.evidence) throw new Error(c.notReady);
      if(!confirmation.manualConfirmationAllowed){
        appModal({icon:'shield',title:c.review,
          body:`<div class="callout warn">${ic('shield')}<span>${esc(c.notReady)}</span></div>`,
          actions:btn(c.close,{attrs:'onclick="closeModal()"'})});
        return;
      }
      const suggested=confirmation.suggestedMetadata||{};
      appModal({icon:'receipt',title:c.confirm,width:'min(720px, calc(100vw - 24px))',body:`
        <div class="callout info">${ic('shield')}<span>${esc(confirmation.evidence.originalFileName||'')}</span></div>
        <form class="formgrid" data-company-receipt-confirm-form>
          <label class="fld"><span>${esc(c.date)}</span><input type="date" data-receipt-confirm-date value="${esc(suggested.transactionDate||'')}"></label>
          <label class="fld"><span>${esc(c.merchant)}</span><input required data-receipt-confirm-merchant value="${esc(suggested.merchant||'')}"></label>
          <label class="fld"><span>${esc(c.number)}</span><input data-receipt-confirm-number value="${esc(suggested.receiptNumber||'')}"></label>
          <label class="fld"><span>${esc(c.category)}</span><input required data-receipt-confirm-category value="General"></label>
          <label class="fld"><span>${esc(c.amount)}</span><input required inputmode="decimal" data-receipt-confirm-amount value="${esc(suggested.amount||'')}"></label>
          <label class="fld"><span>${esc(c.currency)}</span><input required maxlength="3" data-receipt-confirm-currency value="${esc(suggested.currency||DB.company&&DB.company.currency||'')}"></label>
          <label class="fld span-2"><span>${esc(c.purpose)}</span><input required data-receipt-confirm-purpose></label>
          <label class="fld span-2"><span>${esc(c.notes)}</span><textarea data-receipt-confirm-notes></textarea></label>
          <div class="auth-error span-2" data-receipt-confirm-error role="alert"></div>
        </form>`,actions:`${btn(c.close,{attrs:'onclick="closeModal()"'})}${btn(c.save,{icon:'check',cls:'primary',attrs:'data-receipt-confirm-save'})}`});
      const modal=$('#modalEl');
      modal.querySelector('[data-receipt-confirm-save]').addEventListener('click',async event=>{
        const button=event.currentTarget,form=modal.querySelector('[data-company-receipt-confirm-form]');
        if(!form.reportValidity()) return;
        button.disabled=true;
        try{
          await adapter.createCompanyReceipt({
            documentId:confirmation.evidence.documentId,documentVersionId:confirmation.evidence.documentVersionId,
            transactionDate:form.querySelector('[data-receipt-confirm-date]').value||null,
            merchant:form.querySelector('[data-receipt-confirm-merchant]').value,
            receiptNumber:form.querySelector('[data-receipt-confirm-number]').value||null,
            category:form.querySelector('[data-receipt-confirm-category]').value,
            amount:form.querySelector('[data-receipt-confirm-amount]').value,
            currency:form.querySelector('[data-receipt-confirm-currency]').value,
            businessPurpose:form.querySelector('[data-receipt-confirm-purpose]').value,
            notes:form.querySelector('[data-receipt-confirm-notes]').value||null,
          });
          closeModal();await reload();page.render();
        }catch(error){modal.querySelector('[data-receipt-confirm-error]').textContent=String(error&&error.message||error);button.disabled=false;}
      });
    }
    async function chooseConfirmationEvidence(){
      if(typeof adapter.companyReceiptEvidence!=='function') throw new Error(c.noEvidence);
      let search='';
      let response=await adapter.companyReceiptEvidence({limit:25});
      let candidates=Array.isArray(response&&response.data)?response.data:[];
      let evidenceMeta=response&&response.meta||{};
      async function renderPicker(){
        if(!candidates.length&&!search){
          appModal({icon:'upload',title:c.confirm,body:`<div class="callout info">${ic('info')}<span>${esc(c.noEvidence)}</span></div>`,actions:btn(c.close,{attrs:'onclick="closeModal()"'})});
          return;
        }
        const list=candidates.map(row=>btn(row.originalFileName||String(row.id),{icon:'receipt',attrs:`data-company-receipt-evidence="${esc(String(row.documentVersionId))}"`})).join('');
        appModal({icon:'receipt',title:c.review,width:'min(700px, calc(100vw - 24px))',body:`
          <form class="company-receipt-evidence-search" data-company-receipt-evidence-search>
            <input type="search" data-company-receipt-evidence-query value="${esc(search)}" placeholder="${esc(c.searchEvidence)}" aria-label="${esc(c.searchEvidence)}">
            ${btn(c.apply,{icon:'search',cls:'primary',attrs:'type="submit"'})}
          </form>
          <div class="stack" data-company-receipt-evidence-list>${list||`<div class="statepanel empty">${ic('search')}<h3>${esc(c.emptyEvidence)}</h3></div>`}</div>
          ${evidenceMeta.nextCursor?`<div style="margin-top:12px">${btn(c.moreEvidence,{icon:'down',cls:'soft',attrs:'data-company-receipt-evidence-more'})}</div>`:''}
          `,actions:btn(c.close,{attrs:'onclick="closeModal()"'})});
        const modal=$('#modalEl');
        modal.querySelector('[data-company-receipt-evidence-search]')?.addEventListener('submit',async event=>{
          event.preventDefault();search=modal.querySelector('[data-company-receipt-evidence-query]').value.trim();
          response=await adapter.companyReceiptEvidence({limit:25,search});
          candidates=Array.isArray(response&&response.data)?response.data:[];evidenceMeta=response&&response.meta||{};await renderPicker();
        });
        modal.querySelector('[data-company-receipt-evidence-more]')?.addEventListener('click',async event=>{
          event.currentTarget.disabled=true;
          const next=await adapter.companyReceiptEvidence({limit:25,afterId:evidenceMeta.nextCursor,search});
          const known=new Set(candidates.map(row=>String(row.documentVersionId)));
          candidates=candidates.concat((next.data||[]).filter(row=>!known.has(String(row.documentVersionId))));
          evidenceMeta=next.meta||{};await renderPicker();
        });
        modal.querySelectorAll('[data-company-receipt-evidence]').forEach(button=>button.addEventListener('click',async()=>{
          const selected=candidates.find(row=>String(row.documentVersionId)===button.dataset.companyReceiptEvidence);
          if(selected) await openConfirmation(selected);
        }));
      }
      await renderPicker();
    }
    window.ErpWebMcpConfirmation={
      execute:async function(input,options){
        const request=packRequest(input);
        if(!request.dateFrom||!request.dateTo||request.dateFrom>request.dateTo) throw new Error(c.invalid);
        const prepared=await preparePack(request);
        const result=await showPackConfirmation(prepared,request,{signal:options?.signal,
          assertCurrent:options?.assertCurrent,pendingAction:'create'});
        if(!result) throw cancelledPackError();
        return result;
      },
    };
    const scopeLabel=()=>meta.scope==='company'?c.company:c.own;
    const pagination=()=>{
      const summary=`<span>${esc(scopeLabel())} · ${rows.length} ${esc(c.loaded)}</span>`;
      const error=loadError?`<span class="danger">${esc(loadError)}</span>`:'';
      if(!meta.nextCursor) return `${summary}${error}`;
      return `${summary}${btn(loadingMore?c.loading:c.more,{icon:'down',cls:'soft',
        attrs:`data-company-receipts-more${loadingMore?' disabled':''}`})}${error}`;
    };
    page=transactionListPage(root,{
      /* The route guard remains expenses_tax in app.js.  Finance is only the
         shared visual shell that owns this register's sub-navigation. */
      module:'finance',
      route:'company-receipts',title:c.title,description:c.sub,rows:()=>rows,
      rowId:row=>row.id,onOpen:row=>receiptDetails(row),count:()=>rows.length,
      kpis:[{label:scopeLabel,value:()=>rows.length}],
      toolbarContent:()=>`<form class="company-receipt-filters" data-company-receipt-filters>
        <input type="search" data-receipt-search value="${esc(filters.search)}" placeholder="${esc(c.search)}" aria-label="${esc(c.search)}">
        <select data-receipt-preset aria-label="${esc(c.period)}">${[['allDates',c.allDates],['thisMonth',c.thisMonth],['lastMonth',c.lastMonth],['thisQuarter',c.thisQuarter],['thisYear',c.thisYear],['custom',c.custom]].map(([value,label])=>`<option value="${value}" ${filters.preset===value?'selected':''}>${esc(label)}</option>`).join('')}</select>
        <label><span>${esc(c.from)}</span><input type="date" data-receipt-from value="${esc(filters.dateFrom||'')}"></label>
        <label><span>${esc(c.to)}</span><input type="date" data-receipt-to value="${esc(filters.dateTo||'')}"></label>
        ${btn(c.apply,{icon:'search',cls:'primary',attrs:'type="submit"'})}${btn(c.clear,{cls:'soft',attrs:'type="button" data-receipt-clear'})}
        ${can('create')&&typeof adapter.companyReceiptConfirmation==='function'&&typeof adapter.createCompanyReceipt==='function'?btn(c.confirm,{icon:'check',cls:'soft',attrs:'type="button" data-company-receipt-confirm'}):''}
        ${can('create')&&typeof adapter.receiptAssistant==='function'?btn(assistantCopy().open,{icon:'comment',cls:'soft',attrs:'type="button" data-receipt-assistant-open'}):''}
        ${btn(c.preview,{icon:'eye',cls:'soft',attrs:'type="button" data-receipt-pack-preview'})}
        ${btn(c.pdf,{icon:'filepdf',cls:'soft',attrs:'type="button" data-receipt-pack-pdf'})}
        ${btn(c.print,{icon:'print',cls:'soft',attrs:'type="button" data-receipt-pack-print'})}
      </form>`,
      columns:[
        {key:'transactionDate',label:c.date,render:row=>row.transactionDate?esc(dateValue(row.transactionDate)):`<button class="badge warn" data-missing-date-route="${esc(String(row.id))}" title="${esc(c.missingHelp)}">${esc(c.missing)}</button>`},
        {key:'merchant',label:c.merchant,primary:true},
        {key:'receiptNumber',label:c.number,render:row=>esc(row.receiptNumber||'—')},
        {key:'category',label:c.category},
        {key:'amount',label:c.amount,numeric:true,render:row=>esc(receiptMoney(row.amount,row.currency))},
        {key:'currency',label:c.currency},
        {key:'uploaderName',label:c.uploader,render:row=>esc(row.uploaderName||String(row.uploaderUserId||'—'))},
        {key:'status',label:c.status,render:row=>`<span class="badge ${statusTone(row.status)}">${esc(statusLabel(row.status))}</span>`},
      ],
      pagination,
      empty:{icon:'receipt',title:c.empty,description:c.emptyBody},
      afterRender:({root:screenRoot})=>{
        const layout=screenRoot.querySelector('[data-layout="transaction-list-v1"]');
        layout?.setAttribute('data-company-receipt-register','canonical');
        const labels=Array.from(layout?.querySelectorAll('.dt-head .dt-c')||[])
          .map(cell=>cell.textContent.trim());
        layout?.querySelectorAll('.dt-body .dt-r').forEach(row=>{
          row.querySelectorAll('.dt-c').forEach((cell,index)=>{
            cell.dataset.label=labels[index]||'';
          });
        });
        screenRoot.querySelectorAll('[data-missing-date-route]').forEach(button=>button.addEventListener('click',event=>{
          event.stopPropagation();const row=rows.find(candidate=>String(candidate.id)===button.dataset.missingDateRoute);if(row) receiptDetails(row);
        }));
        screenRoot.querySelector('[data-company-receipt-confirm]')?.addEventListener('click',async()=>{
          try{await chooseConfirmationEvidence();}catch(error){loadError=String(error&&error.message||error);page.render();}
        });
        screenRoot.querySelector('[data-receipt-assistant-open]')?.addEventListener('click',()=>openReceiptAssistant());
        screenRoot.querySelector('[data-company-receipts-more]')?.addEventListener('click',async()=>{
          if(loadingMore||!meta.nextCursor) return;
          loadingMore=true;loadError='';page.render();
          try{
            response=await adapter.companyReceipts({limit:pageSize,afterId:meta.nextCursor,search:filters.search,dateFrom:filters.dateFrom,dateTo:filters.dateTo});
            const next=Array.isArray(response&&response.data)?response.data:[];
            const known=new Set(rows.map(row=>String(row.id)));
            rows=rows.concat(next.filter(row=>!known.has(String(row.id))));
            meta=response&&response.meta||{};
          }catch(error){loadError=String(error&&error.message||error);}
          finally{loadingMore=false;page.render();}
        });
        screenRoot.querySelector('[data-receipt-preset]')?.addEventListener('change',event=>{
          filters.preset=event.currentTarget.value;
          [filters.dateFrom,filters.dateTo]=presetRange(filters.preset);
          page.render();
        });
        screenRoot.querySelector('[data-company-receipt-filters]')?.addEventListener('submit',async event=>{
          event.preventDefault();
          try{captureFilters(event.currentTarget);}catch(error){loadError=String(error&&error.message||error);page.render();return;}
          loadError='';try{await reload();}catch(error){loadError=String(error&&error.message||error);}page.render();
        });
        screenRoot.querySelector('[data-receipt-clear]')?.addEventListener('click',async()=>{
          Object.assign(filters,{search:'',dateFrom:null,dateTo:null,preset:'allDates'});
          loadError='';await reload();page.render();
        });
        screenRoot.querySelector('[data-receipt-pack-preview]')?.addEventListener('click',async event=>{
          const button=event.currentTarget,form=screenRoot.querySelector('[data-company-receipt-filters]');
          button.disabled=true;loadError='';
          try{
            const result=await getPackPdf(form,'view',button);
            if(!result)return;
            appModal({icon:'filepdf',title:c.packTitle,
              body:`<div class="company-receipt-pack-frame"><iframe src="${esc(result.url)}" title="${esc(c.packTitle)}"></iframe></div>`,
              actions:btn(c.close,{attrs:'onclick="closeModal()"'})});
            setTimeout(()=>URL.revokeObjectURL(result.url),300000);
          }catch(error){loadError=String(error&&error.message||c.packError);page.render();}
          finally{button.disabled=false;}
        });
        screenRoot.querySelector('[data-receipt-pack-pdf]')?.addEventListener('click',async event=>{
          const button=event.currentTarget,form=screenRoot.querySelector('[data-company-receipt-filters]');
          button.disabled=true;loadError='';
          try{
            const result=await getPackPdf(form,'download',button);
            if(!result)return;
            const link=document.createElement('a');link.href=result.url;
            link.download=`company-receipt-pack-${result.pack.filters.dateFrom}-${result.pack.filters.dateTo}.pdf`;
            link.click();setTimeout(()=>URL.revokeObjectURL(result.url),60000);
          }catch(error){loadError=String(error&&error.message||c.packError);page.render();}
          finally{button.disabled=false;}
        });
        screenRoot.querySelector('[data-receipt-pack-print]')?.addEventListener('click',async event=>{
          const button=event.currentTarget,form=screenRoot.querySelector('[data-company-receipt-filters]');
          button.disabled=true;loadError='';
          try{
            const result=await getPackPdf(form,'print',button);
            if(!result)return;
            const opened=window.open(result.url,'_blank','noopener');
            if(!opened)throw new Error(c.packError);
            setTimeout(()=>URL.revokeObjectURL(result.url),300000);
          }catch(error){loadError=String(error&&error.message||c.packError);page.render();}
          finally{button.disabled=false;}
        });
      },
    });
    if(window.ErpWebMcp&&typeof window.ErpWebMcp.sync==='function'){
      void window.ErpWebMcp.sync('company-receipts-ready');
    }
  };
})();
