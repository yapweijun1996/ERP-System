/* Receipt & Tax Evidence Center — employee-attributed, immutable report packs. */
(function receiptTaxEvidenceScreen(){
  function copy(){
    return i18nLegacy({
      en:{
        title:'Receipt & Tax Evidence',sub:'Filter posted employee expenses, review OCR and paper custody, then generate one immutable evidence pack.',parameters:'Parameters',start:'Start date',end:'End date',employee:'Employee',allEmployees:'All employees',category:'Category codes',project:'Project keys',currency:'Currency',allCurrencies:'All currencies',status:'Evidence status',allStatuses:'All statuses',complete:'Complete',missingReceipt:'Missing receipt',unverifiedReceipt:'Unverified receipt',paper:'Paper custody',allPaper:'All paper states',run:'Run report',running:'Building snapshot…',generate:'Generate PDF · Excel · ZIP',generating:'Generating package…',empty:'Run the report to review employee-attributed receipt evidence.',noMatch:'No posted expense evidence matches these filters.',rows:'Expense lines',documents:'Receipts',gross:'Base gross',employees:'Employees',reportDetail:'Report detail',userFallback:'Unlinked user',receiptMissing:'No receipt',ocrNone:'No OCR fields',confidence:'confidence',paperNone:'Digital-born / no paper original',paperEmployee:'Held by employee',paperFinance:'Finance archive',paperReturned:'Returned',paperDestroyed:'Certified destroyed',paperAction:'Paper status',provider:'OCR & Vision provider',providerLabel:'Provider',providerSub:'Local OCR is the default. OpenAI-compatible supports OpenRouter, LM Studio and custom endpoints through the governed gateway.',localOcr:'Local OCR',openai:'OpenAI',google:'Google Gemini',compatible:'OpenAI compatible',region:'Data region',retention:'Provider retention days',baseUrl:'Provider base URL',model:'Model',credential:'API credential',credentialHelp:'Leave blank to keep the configured credential. Credentials are encrypted server-side and never returned.',credentialRequired:'This endpoint requires a credential',saveProvider:'Save provider',savedProvider:'Document processing provider saved.',providerUnavailable:'Provider settings are unavailable for this account.',apiOnly:'Package generation requires production API mode and the report worker.',artifacts:'Generated artifacts',download:'Download',print:'Print PDF',paperTitle:'Paper-original custody',paperReference:'Custody / destruction reference',paperReason:'Reason and evidence note',save:'Save',cancel:'Cancel',paperSaved:'Paper custody updated.',legalHold:'Legal hold',retainedUntil:'Retain until',purpose:'Finance receipt and tax evidence review.',jobTimeout:'The report worker did not finish within one minute. You can run the report again to check later.',error:'The report could not be completed.'
      },
      zh:{
        title:'收据与税务证据',sub:'按员工筛选已过账费用，检查 OCR 与纸本保管状态，然后生成不可变更的证据包。',parameters:'筛选条件',start:'开始日期',end:'结束日期',employee:'员工',allEmployees:'全部员工',category:'费用类别代码',project:'项目代码',currency:'币种',allCurrencies:'全部币种',status:'凭证状态',allStatuses:'全部状态',complete:'完整',missingReceipt:'缺少收据',unverifiedReceipt:'未验证收据',paper:'纸本保管',allPaper:'全部纸本状态',run:'运行报表',running:'正在建立快照…',generate:'生成 PDF · Excel · ZIP',generating:'正在生成证据包…',empty:'请先运行报表，以查看已关联员工的收据证据。',noMatch:'所选条件没有已过账费用证据。',rows:'费用明细',documents:'收据文件',gross:'本位币总额',employees:'员工人数',reportDetail:'报表明细',userFallback:'未关联员工的用户',receiptMissing:'缺少收据',ocrNone:'没有 OCR 字段',confidence:'置信度',paperNone:'原生电子／无纸本原件',paperEmployee:'员工保管',paperFinance:'财务归档',paperReturned:'已退还',paperDestroyed:'已认证销毁',paperAction:'纸本状态',provider:'OCR 与 Vision Provider',providerLabel:'提供方',providerSub:'默认使用本地 OCR。OpenAI-compatible 可通过受治理网关支持 OpenRouter、LM Studio 和自定义端点。',localOcr:'本地 OCR',openai:'OpenAI',google:'Google Gemini',compatible:'OpenAI-compatible',region:'数据区域',retention:'Provider 保存天数',baseUrl:'Provider Base URL',model:'模型',credential:'API Credential',credentialHelp:'留空会保留现有 Credential。密钥只在服务端加密保存，页面不会回显。',credentialRequired:'这个端点需要 Credential',saveProvider:'保存 Provider',savedProvider:'文件识别 Provider 已保存。',providerUnavailable:'当前账号不能读取 Provider 设置。',apiOnly:'证据包生成需要 Production API 模式及 Report Worker。',artifacts:'已生成文件',download:'下载',print:'打印 PDF',paperTitle:'纸本原件保管',paperReference:'保管／销毁参考编号',paperReason:'原因与证明说明',save:'保存',cancel:'取消',paperSaved:'纸本保管状态已更新。',legalHold:'法律保留',retainedUntil:'保留至',purpose:'财务收据与税务证据审查。',jobTimeout:'Report Worker 一分钟内尚未完成；稍后可重新运行查看。',error:'无法完成报表。'
      },
      ms:{
        title:'Resit & Bukti Cukai',
        sub:'Tapis perbelanjaan pekerja yang telah diposkan, semak OCR dan jagaan kertas, kemudian jana satu pakej bukti tidak berubah.',
        parameters:'Parameter',start:'Tarikh mula',end:'Tarikh tamat',employee:'Pekerja',allEmployees:'Semua pekerja',category:'Kod kategori',project:'Kunci projek',currency:'Mata wang',allCurrencies:'Semua mata wang',status:'Status bukti',allStatuses:'Semua status',complete:'Lengkap',missingReceipt:'Tiada resit',unverifiedReceipt:'Resit belum disahkan',paper:'Jagaan kertas',allPaper:'Semua status kertas',run:'Jalankan laporan',running:'Membina syot kilat…',generate:'Jana PDF · Excel · ZIP',generating:'Menjana pakej…',empty:'Jalankan laporan untuk menyemak bukti resit yang dikaitkan dengan pekerja.',noMatch:'Tiada bukti perbelanjaan yang telah diposkan sepadan dengan penapis ini.',rows:'Baris perbelanjaan',documents:'Resit',gross:'Jumlah kasar asas',employees:'Pekerja',reportDetail:'Butiran laporan',userFallback:'Pengguna tidak dipautkan',receiptMissing:'Tiada resit',ocrNone:'Tiada medan OCR',confidence:'keyakinan',paperNone:'Dijana secara digital / tiada asal kertas',paperEmployee:'Disimpan oleh pekerja',paperFinance:'Arkib kewangan',paperReturned:'Dipulangkan',paperDestroyed:'Dimusnahkan secara disahkan',paperAction:'Status kertas',provider:'Penyedia OCR & Vision',providerLabel:'Penyedia',providerSub:'OCR tempatan ialah lalai. OpenAI-compatible menyokong OpenRouter, LM Studio dan titik akhir tersuai melalui get laluan yang ditadbir.',localOcr:'OCR tempatan',openai:'OpenAI',google:'Google Gemini',compatible:'OpenAI compatible',region:'Wilayah data',retention:'Hari penyimpanan penyedia',baseUrl:'URL asas penyedia',model:'Model',credential:'Kelayakan API',credentialHelp:'Biarkan kosong untuk mengekalkan kelayakan yang dikonfigurasikan. Kelayakan disulitkan di pelayan dan tidak pernah dipulangkan.',credentialRequired:'Titik akhir ini memerlukan kelayakan',saveProvider:'Simpan penyedia',savedProvider:'Penyedia pemprosesan dokumen disimpan.',providerUnavailable:'Tetapan penyedia tidak tersedia untuk akaun ini.',apiOnly:'Penjanaan pakej memerlukan mod Production API dan worker laporan.',artifacts:'Artifak yang dijana',download:'Muat turun',print:'Cetak PDF',paperTitle:'Jagaan asal kertas',paperReference:'Rujukan jagaan / pemusnahan',paperReason:'Sebab dan nota bukti',save:'Simpan',cancel:'Batal',paperSaved:'Status jagaan kertas dikemas kini.',legalHold:'Tahanan undang-undang',retainedUntil:'Simpan sehingga',purpose:'Semakan resit kewangan dan bukti cukai.',jobTimeout:'Worker laporan tidak selesai dalam satu minit. Anda boleh menjalankan laporan sekali lagi untuk menyemak kemudian.',error:'Laporan tidak dapat diselesaikan.'
      },
      ja:{
        title:'領収書・税務証憑',
        sub:'計上済みの従業員経費を絞り込み、OCRと紙原本の保管状況を確認して、変更できない証憑パックを生成します。',
        parameters:'パラメーター',start:'開始日',end:'終了日',employee:'従業員',allEmployees:'すべての従業員',category:'カテゴリコード',project:'プロジェクトキー',currency:'通貨',allCurrencies:'すべての通貨',status:'証憑ステータス',allStatuses:'すべてのステータス',complete:'完了',missingReceipt:'領収書なし',unverifiedReceipt:'未確認の領収書',paper:'紙原本の保管',allPaper:'すべての紙原本状態',run:'レポートを実行',running:'スナップショットを作成中…',generate:'PDF・Excel・ZIPを生成',generating:'パッケージを生成中…',empty:'従業員に関連付けられた領収書証憑を確認するには、レポートを実行してください。',noMatch:'条件に一致する計上済み経費証憑はありません。',rows:'経費明細',documents:'領収書',gross:'基準総額',employees:'従業員',reportDetail:'レポート詳細',userFallback:'未関連付けユーザー',receiptMissing:'領収書なし',ocrNone:'OCRフィールドなし',confidence:'信頼度',paperNone:'デジタル原本／紙原本なし',paperEmployee:'従業員保管',paperFinance:'財務アーカイブ',paperReturned:'返却済み',paperDestroyed:'認証済み廃棄',paperAction:'紙原本の状態',provider:'OCR・Visionプロバイダー',providerLabel:'プロバイダー',providerSub:'ローカルOCRが既定です。OpenAI互換は、管理ゲートウェイ経由でOpenRouter、LM Studio、カスタムエンドポイントに対応します。',localOcr:'ローカルOCR',openai:'OpenAI',google:'Google Gemini',compatible:'OpenAI互換',region:'データリージョン',retention:'プロバイダー保持日数',baseUrl:'プロバイダーのベースURL',model:'モデル',credential:'API認証情報',credentialHelp:'設定済みの認証情報を保持するには空欄にしてください。認証情報はサーバー側で暗号化され、返却されません。',credentialRequired:'このエンドポイントには認証情報が必要です',saveProvider:'プロバイダーを保存',savedProvider:'文書処理プロバイダーを保存しました。',providerUnavailable:'このアカウントではプロバイダー設定を利用できません。',apiOnly:'パッケージ生成にはProduction APIモードとレポートワーカーが必要です。',artifacts:'生成済みアーティファクト',download:'ダウンロード',print:'PDFを印刷',paperTitle:'紙原本の保管',paperReference:'保管／廃棄参照番号',paperReason:'理由と証拠メモ',save:'保存',cancel:'キャンセル',paperSaved:'紙原本の保管状態を更新しました。',legalHold:'法的保留',retainedUntil:'保持期限',purpose:'財務領収書および税務証憑の確認。',jobTimeout:'レポートワーカーが1分以内に完了しませんでした。後でレポートを再実行して確認できます。',error:'レポートを完了できませんでした。'
      },
      vi:{
        title:'Biên lai & Chứng từ thuế',
        sub:'Lọc các khoản chi phí nhân viên đã ghi sổ, kiểm tra OCR và việc lưu giữ bản giấy, sau đó tạo một gói chứng từ bất biến.',
        parameters:'Tham số',start:'Ngày bắt đầu',end:'Ngày kết thúc',employee:'Nhân viên',allEmployees:'Tất cả nhân viên',category:'Mã danh mục',project:'Khóa dự án',currency:'Tiền tệ',allCurrencies:'Tất cả tiền tệ',status:'Trạng thái chứng từ',allStatuses:'Tất cả trạng thái',complete:'Hoàn tất',missingReceipt:'Không có biên lai',unverifiedReceipt:'Biên lai chưa xác minh',paper:'Lưu giữ bản giấy',allPaper:'Tất cả trạng thái bản giấy',run:'Chạy báo cáo',running:'Đang tạo bản chụp…',generate:'Tạo PDF · Excel · ZIP',generating:'Đang tạo gói…',empty:'Chạy báo cáo để xem chứng từ biên lai gắn với nhân viên.',noMatch:'Không có chứng từ chi phí đã ghi sổ nào khớp với bộ lọc này.',rows:'Dòng chi phí',documents:'Biên lai',gross:'Tổng gộp cơ sở',employees:'Nhân viên',reportDetail:'Chi tiết báo cáo',userFallback:'Người dùng chưa liên kết',receiptMissing:'Không có biên lai',ocrNone:'Không có trường OCR',confidence:'độ tin cậy',paperNone:'Sinh ra kỹ thuật số / không có bản giấy gốc',paperEmployee:'Nhân viên lưu giữ',paperFinance:'Lưu trữ tài chính',paperReturned:'Đã trả lại',paperDestroyed:'Đã hủy có chứng nhận',paperAction:'Trạng thái bản giấy',provider:'Nhà cung cấp OCR & Vision',providerLabel:'Nhà cung cấp',providerSub:'OCR cục bộ là mặc định. OpenAI-compatible hỗ trợ OpenRouter, LM Studio và endpoint tùy chỉnh qua gateway được quản trị.',localOcr:'OCR cục bộ',openai:'OpenAI',google:'Google Gemini',compatible:'OpenAI tương thích',region:'Khu vực dữ liệu',retention:'Số ngày lưu giữ của nhà cung cấp',baseUrl:'URL cơ sở của nhà cung cấp',model:'Mô hình',credential:'Thông tin xác thực API',credentialHelp:'Để trống để giữ thông tin xác thực đã cấu hình. Thông tin xác thực được mã hóa phía máy chủ và không bao giờ được trả về.',credentialRequired:'Endpoint này yêu cầu thông tin xác thực',saveProvider:'Lưu nhà cung cấp',savedProvider:'Đã lưu nhà cung cấp xử lý tài liệu.',providerUnavailable:'Cài đặt nhà cung cấp không khả dụng cho tài khoản này.',apiOnly:'Tạo gói yêu cầu chế độ Production API và worker báo cáo.',artifacts:'Tệp đã tạo',download:'Tải xuống',print:'In PDF',paperTitle:'Lưu giữ bản giấy gốc',paperReference:'Tham chiếu lưu giữ / hủy',paperReason:'Lý do và ghi chú chứng từ',save:'Lưu',cancel:'Hủy',paperSaved:'Đã cập nhật trạng thái lưu giữ bản giấy.',legalHold:'Lưu giữ pháp lý',retainedUntil:'Giữ lại đến',purpose:'Rà soát biên lai tài chính và chứng từ thuế.',jobTimeout:'Worker báo cáo chưa hoàn tất trong một phút. Bạn có thể chạy lại báo cáo để kiểm tra sau.',error:'Không thể hoàn tất báo cáo.'
      }
    });
  }

  function listValues(value,{upper=false}={}){
    const rows=String(value||'').split(/[\s,;]+/).map(item=>item.trim()).filter(Boolean);
    const normalized=rows.map(item=>upper?item.toUpperCase():item);
    return [...new Set(normalized)];
  }

  function moneyValue(value,currency){
    const amount=Number(value)||0;
    try{return new Intl.NumberFormat(getLocale(),{style:'currency',currency:currency||'USD'}).format(amount);}
    catch{return `${currency||''} ${amount.toFixed(2)}`.trim();}
  }

  function dateOnly(value){return value?String(value).slice(0,10):'—';}

  function paperLabel(status,s){
    return {none:s.paperNone,employee:s.paperEmployee,finance_archive:s.paperFinance,returned:s.paperReturned,destroyed:s.paperDestroyed}[status]||'—';
  }

  function confidenceValue(value){
    const number=Number(value);
    return Number.isFinite(number)?`${(number*100).toFixed(1)}%`:'—';
  }

  SCREENS['receipt-tax-evidence']=async function(root){
    const s=copy();
    const adapter=window.ErpSystemData&&window.ErpSystemData.my;
    if(!adapter) throw new Error('Receipt evidence adapter is unavailable.');
    let employees=[],policy=null,visionConnector=null;
    const reads=await Promise.allSettled([
      window.ErpSystemData.list('hr/employees',{limit:500}),
      adapter.documentProcessingPolicy(),
      window.ErpSystemData.list('integration/connectors'),
    ]);
    if(reads[0].status==='fulfilled') employees=Array.isArray(reads[0].value.data)?reads[0].value.data:[];
    if(reads[1].status==='fulfilled') policy=reads[1].value.data;
    if(reads[2].status==='fulfilled') visionConnector=(reads[2].value.data||[]).find(item=>item.connectorKey==='document-vision')||null;

    const today=new Date().toISOString().slice(0,10);
    const yearStart=today.slice(0,4)+'-01-01';
    const employeeOptions=employees
      .filter(item=>item&&item.id)
      .sort((a,b)=>String(a.employeeNo||'').localeCompare(String(b.employeeNo||'')))
      .map(item=>`<option value="${esc(item.id)}">${esc(item.employeeNo||('#'+item.id))} · ${esc(item.fullName||s.userFallback)}${item.userId?' · User #'+esc(item.userId):''}</option>`).join('');
    const providerValue=policy&&policy.extractionProvider==='byok_vision'?(policy.visionProvider||'openai'):'local_ocr';
    const params=`
      <label class="fld"><span>${esc(s.start)}</span><input type="date" value="${yearStart}" data-tax-start></label>
      <label class="fld"><span>${esc(s.end)}</span><input type="date" value="${today}" data-tax-end></label>
      <label class="fld"><span>${esc(s.employee)}</span><select data-tax-employee><option value="">${esc(s.allEmployees)}</option>${employeeOptions}</select></label>
      <label class="fld"><span>${esc(s.category)}</span><input type="text" placeholder="TRAVEL, FUEL" data-business-text data-tax-category><small class="tax-evidence-param-help">${esc(s.category)}</small></label>
      <label class="fld"><span>${esc(s.project)}</span><input type="text" placeholder="PROJECT-ALPHA" data-tax-project></label>
      <label class="fld"><span>${esc(s.currency)}</span><select data-tax-currency><option value="">${esc(s.allCurrencies)}</option><option>MYR</option><option>SGD</option><option>USD</option></select></label>
      <label class="fld"><span>${esc(s.status)}</span><select data-tax-completeness><option value="">${esc(s.allStatuses)}</option><option value="complete">${esc(s.complete)}</option><option value="missing_receipt">${esc(s.missingReceipt)}</option><option value="unverified_receipt">${esc(s.unverifiedReceipt)}</option></select></label>
      <label class="fld"><span>${esc(s.paper)}</span><select data-tax-paper><option value="">${esc(s.allPaper)}</option><option value="none">${esc(s.paperNone)}</option><option value="employee">${esc(s.paperEmployee)}</option><option value="finance_archive">${esc(s.paperFinance)}</option><option value="returned">${esc(s.paperReturned)}</option><option value="destroyed">${esc(s.paperDestroyed)}</option></select></label>
      <div class="tax-evidence-actions">
        ${btn(s.run,{icon:'refresh',cls:'primary',attrs:'data-tax-run'})}
        ${btn(s.generate,{icon:'filepdf',cls:'soft',attrs:'data-tax-generate disabled'})}
      </div>`;
    const providerPanel=policy?`<section class="panel tax-evidence-provider" data-provider-panel>
      <div class="panel-h"><div><h3>${esc(s.provider)}</h3><small>${esc(s.providerSub)}</small></div></div>
      <div class="panel-body tax-evidence-provider-grid">
        <label class="fld"><span>${esc(s.providerLabel)}</span><select data-provider-kind>
          <option value="local_ocr" ${providerValue==='local_ocr'?'selected':''}>${esc(s.localOcr)}</option>
          <option value="openai" ${providerValue==='openai'?'selected':''}>${esc(s.openai)}</option>
          <option value="google" ${providerValue==='google'?'selected':''}>${esc(s.google)}</option>
          <option value="openai_compatible" ${providerValue==='openai_compatible'?'selected':''}>${esc(s.compatible)}</option>
        </select></label>
        <label class="fld" data-vision-only><span>${esc(s.region)}</span><input data-provider-region value="${esc(policy.visionRegion||'ap-southeast-1')}"></label>
        <label class="fld" data-vision-only><span>${esc(s.retention)}</span><input type="number" min="0" max="365" data-provider-retention value="${esc(policy.visionRetentionDays==null?0:policy.visionRetentionDays)}"></label>
        <label class="fld" data-business-text data-compatible-only><span>${esc(s.baseUrl)}</span><input type="url" placeholder="https://openrouter.ai/api/v1" data-provider-base value="${esc(policy.visionBaseUrl||'')}"></label>
        <label class="fld" data-business-text data-compatible-only><span>${esc(s.model)}</span><input placeholder="google/gemini-2.5-flash" data-provider-model value="${esc(policy.visionModel||'')}"></label>
        <label class="fld" data-vision-only><span>${esc(s.credential)}</span><input type="password" autocomplete="new-password" placeholder="${visionConnector&&visionConnector.credentialLabel?'Configured · '+esc(visionConnector.credentialLabel):''}" data-provider-secret><small>${esc(s.credentialHelp)}</small></label>
        <label class="checkline" data-compatible-only><input type="checkbox" data-provider-credential-required ${policy.visionCredentialRequired!==false?'checked':''}> <span>${esc(s.credentialRequired)}</span></label>
      </div>
      <div class="panel-body tax-evidence-provider-actions">
        ${btn(s.saveProvider,{icon:'check',cls:'primary',attrs:'data-provider-save'})}
        <span class="tax-evidence-status-note">${ic('shield')}<span>${esc(s.credentialHelp)}</span></span>
      </div>
    </section>`:`<div class="callout warn">${ic('info')}<span>${esc(s.providerUnavailable)}</span></div>`;
    root.innerHTML=modulePage({
      module:'mywork',route:'receipt-tax-evidence',active:'receipt-tax-evidence',title:s.title,sub:s.sub,
      body:`<div class="report tax-evidence-screen">
        <aside class="report-params"><h3>${esc(s.parameters)}</h3>${params}</aside>
        <div class="report-result">
          <div class="report-toolbar"><div><b>${esc(s.title)}</b><div class="report-meta" data-tax-meta>${esc(s.empty)}</div></div><div class="grow"></div><div class="tax-evidence-actions" data-artifact-actions></div></div>
          <div class="tax-evidence-body"><div data-tax-result>${statePanel({icon:'receipt',title:s.empty})}</div>${providerPanel}</div>
        </div>
      </div>`,
    });

    const resultHost=root.querySelector('[data-tax-result]');
    const metaHost=root.querySelector('[data-tax-meta]');
    const artifactHost=root.querySelector('[data-artifact-actions]');
    const runButton=root.querySelector('[data-tax-run]');
    const generateButton=root.querySelector('[data-tax-generate]');
    let currentSnapshot=null,currentLines=[],currentArtifacts=[];

    function renderReport(){
      const facts=currentLines.map(row=>row.facts||row);
      if(!facts.length){resultHost.innerHTML=statePanel({icon:'receipt',title:s.noMatch});return;}
      const employeeCount=new Set(facts.map(row=>row.employeeId||('user-'+row.ownerUserId))).size;
      const documentCount=new Set(facts.map(row=>row.evidenceVersionId).filter(Boolean)).size;
      const rows=facts.map(row=>{
        const ocr=(row.ocrFields||[]).slice(0,3).map(field=>`<small><b>${esc(field.fieldKey)}</b>: ${esc(field.normalizedValue||field.value)}</small>`).join('');
        const employeeName=row.employeeName||`${s.userFallback} #${row.ownerUserId}`;
        return `<tr data-document-id="${row.evidenceDocumentId||''}">
          <td class="l tax-evidence-employee"><b>${esc(employeeName)}</b><small>${esc(row.employeeNo||'—')} · Employee #${esc(row.employeeId||'—')} · User #${esc(row.ownerUserId)}</small></td>
          <td class="l"><b>${esc(row.merchant)}</b><small>${esc(row.claimNo)} · ${esc(row.categoryCode)} · ${esc(row.projectKeys||[])}</small></td>
          <td class="l">${esc(dateOnly(row.transactionDate))}</td>
          <td class="tnum">${esc(moneyValue(row.originalGross,row.originalCurrency))}</td>
          <td class="l tax-evidence-file"><b>${esc(row.evidenceFileName||s.receiptMissing)}</b><small>${esc(row.completeness)}</small></td>
          <td class="l tax-evidence-ocr">${ocr||`<small>${esc(s.ocrNone)}</small>`}<small>${esc(confidenceValue(row.ocrMinConfidence))} ${esc(s.confidence)}</small></td>
          <td class="l"><span class="badge ${row.paperCustodyStatus==='destroyed'?'warn':'neutral'}">${esc(paperLabel(row.paperCustodyStatus,s))}</span>${row.legalHold?`<small>${esc(s.legalHold)}</small>`:''}</td>
          <td class="l">${row.evidenceDocumentId?btn(s.paperAction,{icon:'archive',sm:true,attrs:`data-paper-action="${esc(row.evidenceDocumentId)}"`}):'—'}</td>
        </tr>`;
      }).join('');
      resultHost.innerHTML=`<div class="tax-evidence-summary">
        <div class="tax-evidence-stat"><small>${esc(s.rows)}</small><b>${facts.length}</b></div>
        <div class="tax-evidence-stat"><small>${esc(s.documents)}</small><b>${documentCount}</b></div>
        <div class="tax-evidence-stat"><small>${esc(s.employees)}</small><b>${employeeCount}</b></div>
        <div class="tax-evidence-stat"><small>${esc(s.gross)}</small><b>${esc(currentSnapshot.baseGross)}</b></div>
      </div><section class="panel"><div class="panel-h"><h3>${esc(s.reportDetail)}</h3></div><div class="tablewrap"><table class="lines tax-evidence-table"><thead><tr><th class="l">${esc(s.employee)}</th><th class="l">Merchant / claim</th><th class="l">Date</th><th>Amount</th><th class="l">${esc(s.documents)}</th><th class="l">OCR</th><th class="l">${esc(s.paper)}</th><th class="l"></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
      metaHost.textContent=`${facts.length} ${s.rows} · ${employeeCount} ${s.employees} · SHA-256 ${currentSnapshot.sourceSha256.slice(0,12)}…`;
    }

    async function runReport(){
      const start=root.querySelector('[data-tax-start]').value;
      const end=root.querySelector('[data-tax-end]').value;
      if(!start||!end||end<start){toast(s.error,'danger');return;}
      const employeeId=Number(root.querySelector('[data-tax-employee]').value)||null;
      const currency=root.querySelector('[data-tax-currency]').value;
      const completeness=root.querySelector('[data-tax-completeness]').value;
      const paper=root.querySelector('[data-tax-paper]').value;
      runButton.disabled=true;runButton.innerHTML=`${ic('refresh')}<span>${esc(s.running)}</span>`;
      generateButton.disabled=true;artifactHost.innerHTML='';currentArtifacts=[];
      try{
        const response=await adapter.createTaxEvidenceSnapshot({
          snapshotKey:'receipt-evidence-'+crypto.randomUUID(),
          filters:{startDate:start,endDate:end,
            employeeIds:employeeId?[employeeId]:[],
            categoryCodes:listValues(root.querySelector('[data-tax-category]').value,{upper:true}),
            projectKeys:listValues(root.querySelector('[data-tax-project]').value),
            currencyCodes:currency?[currency]:[],
            completeness:completeness?[completeness]:[],
            paperCustodyStatuses:paper?[paper]:[],
          },
        });
        currentSnapshot=response.data.snapshot;currentLines=response.data.lines||[];
        renderReport();generateButton.disabled=Boolean(response.meta&&response.meta.demo);
      }catch(error){
        const rawMessage=(error&&error.message)||s.error;
        const message=rawMessage==='No posted expense evidence matches the selected filters.'?s.noMatch:rawMessage;
        resultHost.innerHTML=statePanel({icon:'receipt',title:message,description:window.erpDataMode&&window.erpDataMode()==='demo'?s.apiOnly:''});
        metaHost.textContent=s.noMatch;
      }finally{runButton.disabled=false;runButton.innerHTML=`${ic('refresh')}<span>${esc(s.run)}</span>`;}
    }

    function renderArtifacts(){
      artifactHost.innerHTML=currentArtifacts.map(item=>btn(
        item.artifactType==='register_pdf'?s.print:s.download,
        {icon:item.artifactType.includes('pdf')?'filepdf':item.artifactType.includes('xlsx')?'filexls':'download',cls:'soft',sm:true,attrs:`data-artifact-id="${esc(item.id)}" data-artifact-type="${esc(item.artifactType)}"`},
      )).join('');
    }

    async function generatePack(){
      if(!currentSnapshot)return;
      generateButton.disabled=true;generateButton.innerHTML=`${ic('refresh')}<span>${esc(s.generating)}</span>`;
      try{
        const queued=await adapter.createTaxEvidenceJob({jobKey:'receipt-pack-'+crypto.randomUUID(),snapshotId:currentSnapshot.id,locale:getLang()});
        const jobId=queued.data.job.id;
        let completed=null;
        for(let attempt=0;attempt<60;attempt+=1){
          const response=await adapter.taxEvidenceJob(jobId);
          if(response.data.job.status==='succeeded'||response.data.job.status==='failed'){completed=response.data;break;}
          await new Promise(resolve=>setTimeout(resolve,1000));
        }
        if(!completed)throw new Error(s.jobTimeout);
        if(completed.job.status!=='succeeded')throw new Error(completed.job.lastError||s.error);
        currentArtifacts=completed.artifacts||[];renderArtifacts();toast(s.artifacts,'ok');
      }catch(error){toast((error&&error.message)||s.error,'danger');}
      finally{generateButton.disabled=false;generateButton.innerHTML=`${ic('filepdf')}<span>${esc(s.generate)}</span>`;}
    }

    async function accessArtifact(button){
      const artifact=currentArtifacts.find(item=>String(item.id)===button.dataset.artifactId);if(!artifact)return;
      button.disabled=true;
      try{
        const shouldPrint=artifact.artifactType==='register_pdf';
        const response=await adapter.accessTaxEvidenceArtifact(artifact.id,{accessKey:crypto.randomUUID(),action:shouldPrint?'print':'download',purpose:s.purpose});
        const url=URL.createObjectURL(new Blob([response.data.content],{type:response.data.mimeType||artifact.mimeType}));
        if(shouldPrint)window.open(url,'_blank','noopener');
        else{const link=document.createElement('a');link.href=url;link.download=artifact.fileName;link.click();}
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(error){toast((error&&error.message)||s.error,'danger');}
      finally{button.disabled=false;}
    }

    async function openPaperCustody(documentId){
      try{
        const response=await adapter.documentGovernance(documentId);const document=response.data.document;
        appModal({icon:'archive',title:s.paperTitle,body:`
          <label class="fld"><span>${esc(s.paper)}</span><select data-paper-status><option value="none">${esc(s.paperNone)}</option><option value="employee">${esc(s.paperEmployee)}</option><option value="finance_archive">${esc(s.paperFinance)}</option><option value="returned">${esc(s.paperReturned)}</option><option value="destroyed">${esc(s.paperDestroyed)}</option></select></label>
          <label class="fld"><span>${esc(s.paperReference)}</span><input data-paper-reference maxlength="160" value="${esc(document.paperOriginalReference||'')}"></label>
          <label class="fld"><span>${esc(s.paperReason)}</span><textarea data-paper-reason rows="3" maxlength="1000"></textarea></label>
          <div class="callout warn">${ic('info')}<span>${esc(s.retainedUntil)} ${esc(dateOnly(document.retentionUntil))}${document.legalHold?' · '+esc(s.legalHold):''}</span></div>`,
          actions:`${btn(s.cancel,{attrs:'onclick="closeModal()"'})}${btn(s.save,{icon:'check',cls:'primary',attrs:'data-paper-save'})}`});
        const modal=document.querySelector('#modalEl');const status=modal.querySelector('[data-paper-status]');status.value=document.paperCustodyStatus||'none';
        const syncReference=()=>{const none=status.value==='none';modal.querySelector('[data-paper-reference]').disabled=none;if(none)modal.querySelector('[data-paper-reference]').value='';};status.addEventListener('change',syncReference);syncReference();
        modal.querySelector('[data-paper-save]').addEventListener('click',async event=>{
          const button=event.currentTarget,reference=modal.querySelector('[data-paper-reference]').value.trim(),reason=modal.querySelector('[data-paper-reason]').value.trim();
          if(reason.length<3||(status.value!=='none'&&!reference)){toast(s.error,'danger');return;}
          button.disabled=true;
          try{
            const updated=await adapter.setDocumentPaperCustody(documentId,{expectedVersion:Number(document.recordVersion),status:status.value,reference:reference||null,reason},crypto.randomUUID());
            currentLines.forEach(row=>{if((row.facts||row).evidenceDocumentId===Number(documentId)){const facts=row.facts||row;facts.paperCustodyStatus=updated.data.paperCustodyStatus;facts.paperOriginalReference=updated.data.paperOriginalReference;}});
            closeModal();renderReport();toast(s.paperSaved,'ok');
          }catch(error){toast((error&&error.message)||s.error,'danger');button.disabled=false;}
        });
      }catch(error){toast((error&&error.message)||s.error,'danger');}
    }

    function syncProviderFields(){
      const kind=root.querySelector('[data-provider-kind]')?.value;if(!kind)return;
      root.querySelectorAll('[data-vision-only]').forEach(node=>node.hidden=kind==='local_ocr');
      root.querySelectorAll('[data-compatible-only]').forEach(node=>node.hidden=kind!=='openai_compatible');
    }

    async function saveProvider(){
      const button=root.querySelector('[data-provider-save]'),kind=root.querySelector('[data-provider-kind]').value;button.disabled=true;
      try{
        let payload={extractionProvider:'local_ocr'};
        if(kind!=='local_ocr'){
          const credentialRequired=kind==='openai_compatible'?root.querySelector('[data-provider-credential-required]').checked:true;
          const secret=root.querySelector('[data-provider-secret]').value;
          if(secret&&visionConnector){
            await window.ErpSystemData.action('integration/connectors',visionConnector.id,'configure',{secret,label:`${kind} receipt vision`,endpointHost:null},crypto.randomUUID());
          }
          payload={extractionProvider:'byok_vision',visionProvider:kind,visionRegion:root.querySelector('[data-provider-region]').value.trim(),visionRetentionDays:Number(root.querySelector('[data-provider-retention]').value),visionCredentialRequired:credentialRequired};
          if(kind==='openai_compatible'){payload.visionBaseUrl=root.querySelector('[data-provider-base]').value.trim();payload.visionModel=root.querySelector('[data-provider-model]').value.trim();}
        }
        const response=await adapter.updateDocumentProcessingPolicy(payload,crypto.randomUUID());policy=response.data;root.querySelector('[data-provider-secret]').value='';toast(s.savedProvider,'ok');
      }catch(error){toast((error&&error.message)||s.error,'danger');}
      finally{button.disabled=false;}
    }

    runButton.addEventListener('click',runReport);generateButton.addEventListener('click',generatePack);
    resultHost.addEventListener('click',event=>{const button=event.target.closest('[data-paper-action]');if(button)openPaperCustody(Number(button.dataset.paperAction));});
    artifactHost.addEventListener('click',event=>{const button=event.target.closest('[data-artifact-id]');if(button)accessArtifact(button);});
    root.querySelector('[data-provider-kind]')?.addEventListener('change',syncProviderFields);
    root.querySelector('[data-provider-save]')?.addEventListener('click',saveProvider);
    syncProviderFields();
  };
})();
