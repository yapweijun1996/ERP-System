/* ============================================================
   ARIA ERP — Canonical manual journal composer
   Real journal_header/journal_line drafts in Demo/API. Posting
   and reversal use the shared TypeScript domain commands.
   ============================================================ */
(function(){
  const COPY={
    en:{finance:'Finance',journals:'Journal entries',title:'New journal entry',sub:'Save a balanced manual journal as a real draft, then post immutable GL legs.',draft:'Draft',posted:'Posted',number:'Journal number',date:'Posting date',type:'Journal type',standard:'Standard',accrual:'Accrual',reclassification:'Reclassification',memo:'Memo / description',memoPh:'Explain the business reason for this entry',reference:'Reference',refPh:'Source document or batch reference',details:'Entry details',lines:'Journal lines',add:'Add line',account:'Account',dimension:'Dimension',dimPh:'Cost centre / project',debit:'Debit',credit:'Credit',remove:'Remove line',coded:'coded lines',totalDebit:'Total debit',totalCredit:'Total credit',difference:'Difference',balanced:'Balanced',empty:'Empty',out:'Out of balance',ready:'Balanced · ready to post',must:'Debits must equal credits before posting',entryBalances:'Entry balances',mustBalance:'Must balance to post',drHeavy:'Debit is higher',crHeavy:'Credit is higher',enter:'Enter debits and credits.',addSide:'Add {amount} to the {side} side.',cancel:'Cancel',save:'Save draft',savePost:'Save & post',post:'Post to GL',saving:'Saving…',posting:'Posting…',saved:'Journal draft saved',postedMsg:'Journal posted to the General Ledger',select:'Select account…',loading:'Loading chart of accounts…',loadFail:'Could not load the canonical chart of accounts.',retry:'Retry',noAccounts:'No finance accounts are configured for this company.',limit:'The account selector is bounded to the first 500 accounts.',dateHelp:'The posting date is persisted on every GL leg. Period locking will be enforced when the separate period-policy domain is delivered.',confirmTitle:'Post journal to the General Ledger?',confirmBody:'Posting creates immutable ledger facts. Any correction must use a separately numbered reversal journal.',confirm:'Confirm & post',requiredMemo:'Memo is required.',requiredAccount:'Every line needs an account.',invalidAmount:'Each line must contain exactly one positive debit or credit with at most 2 decimals.',invalidBalance:'Debit and credit totals must be equal and greater than zero.',createdBoundary:'The draft is stored but has not changed the General Ledger.',savedNo:'Saved draft {docNo}',serverError:'The journal could not be saved.',sideDebit:'credit',sideCredit:'debit'},
    ms:{
  "finance": "Kewangan",
  "journals": "Catatan jurnal",
  "title": "Catatan jurnal baharu",
  "sub": "Simpan jurnal manual seimbang sebagai draf sebenar, kemudian pos kaki GL yang tidak boleh diubah.",
  "draft": "Draf",
  "posted": "Dipos",
  "number": "Nombor jurnal",
  "date": "Tarikh posting",
  "type": "Jenis jurnal",
  "standard": "Standard",
  "accrual": "Akruan",
  "reclassification": "Pengelasan semula",
  "memo": "Memo / penerangan",
  "memoPh": "Terangkan sebab perniagaan catatan ini",
  "reference": "Rujukan",
  "refPh": "Dokumen sumber atau rujukan kelompok",
  "details": "Butiran catatan",
  "lines": "Baris jurnal",
  "add": "Tambah baris",
  "account": "Akaun",
  "dimension": "Dimensi",
  "dimPh": "Pusat kos / projek",
  "debit": "Debit",
  "credit": "Kredit",
  "remove": "Buang baris",
  "coded": "baris berkod",
  "totalDebit": "Jumlah debit",
  "totalCredit": "Jumlah kredit",
  "difference": "Perbezaan",
  "balanced": "Seimbang",
  "empty": "Kosong",
  "out": "Tidak seimbang",
  "ready": "Seimbang · sedia dipos",
  "must": "Debit mesti sama dengan kredit sebelum posting",
  "entryBalances": "Catatan seimbang",
  "mustBalance": "Mesti seimbang untuk dipos",
  "drHeavy": "Debit lebih tinggi",
  "crHeavy": "Kredit lebih tinggi",
  "enter": "Masukkan debit dan kredit.",
  "addSide": "Tambah {amount} pada bahagian {side}.",
  "cancel": "Batal",
  "save": "Simpan draf",
  "savePost": "Simpan & pos",
  "post": "Pos ke GL",
  "saving": "Menyimpan…",
  "posting": "Mempos…",
  "saved": "Draf jurnal disimpan",
  "postedMsg": "Jurnal dipos ke Lejar Am",
  "select": "Pilih akaun…",
  "loading": "Memuatkan carta akaun…",
  "loadFail": "Carta akaun kanonik tidak dapat dimuatkan.",
  "retry": "Cuba lagi",
  "noAccounts": "Tiada akaun kewangan dikonfigurasi untuk syarikat ini.",
  "limit": "Pemilih akaun dihadkan kepada 500 akaun pertama.",
  "dateHelp": "Tarikh posting disimpan pada setiap kaki GL. Kunci tempoh akan dikuatkuasakan apabila domain polisi tempoh berasingan disiapkan.",
  "confirmTitle": "Pos jurnal ke Lejar Am?",
  "confirmBody": "Posting mencipta fakta lejar yang tidak boleh diubah. Pembetulan mesti menggunakan jurnal pembalikan bernombor berasingan.",
  "confirm": "Sahkan & pos",
  "requiredMemo": "Memo diperlukan.",
  "requiredAccount": "Setiap baris memerlukan akaun.",
  "invalidAmount": "Setiap baris mesti mempunyai tepat satu debit atau kredit positif dengan maksimum 2 perpuluhan.",
  "invalidBalance": "Jumlah debit dan kredit mesti sama dan melebihi sifar.",
  "createdBoundary": "Draf disimpan tetapi belum mengubah Lejar Am.",
  "savedNo": "Draf {docNo} disimpan",
  "serverError": "Jurnal tidak dapat disimpan.",
  "sideDebit": "kredit",
  "sideCredit": "debit"
},
    zh:{finance:'财务',journals:'会计凭证',title:'新建会计凭证',sub:'将借贷平衡的手工凭证保存为真实草稿，再过账为不可变的总账分录。',draft:'草稿',posted:'已过账',number:'凭证编号',date:'过账日期',type:'凭证类型',standard:'标准',accrual:'预提',reclassification:'重分类',memo:'摘要 / 说明',memoPh:'说明本凭证的业务原因',reference:'参考编号',refPh:'来源单据或批次编号',details:'凭证资料',lines:'凭证明细',add:'新增明细',account:'科目',dimension:'维度',dimPh:'成本中心 / 项目',debit:'借方',credit:'贷方',remove:'删除明细',coded:'条已选科目',totalDebit:'借方合计',totalCredit:'贷方合计',difference:'差额',balanced:'借贷平衡',empty:'未填写',out:'借贷不平',ready:'借贷平衡 · 可以过账',must:'过账前借方必须等于贷方',entryBalances:'借贷已平衡',mustBalance:'必须平衡后才能过账',drHeavy:'借方较多',crHeavy:'贷方较多',enter:'请输入借方和贷方金额。',addSide:'请在{side}增加 {amount}。',cancel:'取消',save:'保存草稿',savePost:'保存并过账',post:'过账至总账',saving:'保存中…',posting:'过账中…',saved:'凭证草稿已保存',postedMsg:'凭证已过账至总账',select:'选择科目…',loading:'正在加载科目表…',loadFail:'无法加载真实科目表。',retry:'重试',noAccounts:'当前公司尚未配置财务科目。',limit:'科目选择器最多显示前 500 个科目。',dateHelp:'每条总账分录都会保存过账日期。独立期间政策模块完成后，系统将在服务端执行期间锁定。',confirmTitle:'将凭证过账至总账？',confirmBody:'过账将创建不可修改的总账事实。如需更正，必须建立独立编号的冲销凭证。',confirm:'确认并过账',requiredMemo:'必须填写摘要。',requiredAccount:'每条明细必须选择科目。',invalidAmount:'每条明细必须且只能填写一项正数借方或贷方，最多两位小数。',invalidBalance:'借贷合计必须相等且大于零。',createdBoundary:'草稿已保存，但尚未改变总账。',savedNo:'草稿 {docNo} 已保存',serverError:'无法保存凭证。',sideDebit:'贷方',sideCredit:'借方'},
    ja:{finance:'財務',journals:'仕訳伝票',title:'新規仕訳伝票',sub:'貸借一致した手動仕訳を実際の下書きとして保存し、不変のGL明細を転記します。',draft:'下書き',posted:'転記済',number:'仕訳番号',date:'転記日',type:'仕訳タイプ',standard:'標準',accrual:'見越',reclassification:'振替',memo:'摘要 / 説明',memoPh:'この仕訳の業務上の理由を入力',reference:'参照',refPh:'元伝票またはバッチ参照',details:'仕訳詳細',lines:'仕訳明細',add:'明細を追加',account:'勘定科目',dimension:'ディメンション',dimPh:'原価センター / プロジェクト',debit:'借方',credit:'貸方',remove:'明細を削除',coded:'件の科目設定済み',totalDebit:'借方合計',totalCredit:'貸方合計',difference:'差額',balanced:'貸借一致',empty:'未入力',out:'不一致',ready:'貸借一致 · 転記可能',must:'転記前に借方と貸方を一致させてください',entryBalances:'仕訳は一致しています',mustBalance:'転記には貸借一致が必要',drHeavy:'借方超過',crHeavy:'貸方超過',enter:'借方と貸方を入力してください。',addSide:'{side}に {amount} を追加してください。',cancel:'取消',save:'下書き保存',savePost:'保存して転記',post:'GLへ転記',saving:'保存中…',posting:'転記中…',saved:'仕訳下書きを保存しました',postedMsg:'仕訳を総勘定元帳へ転記しました',select:'勘定科目を選択…',loading:'勘定科目表を読み込み中…',loadFail:'標準勘定科目表を読み込めませんでした。',retry:'再試行',noAccounts:'この会社には財務勘定が設定されていません。',limit:'勘定選択は先頭500件に制限されています。',dateHelp:'転記日は各GL明細に保存されます。別の期間ポリシードメインが完成後、期間ロックを適用します。',confirmTitle:'仕訳を総勘定元帳へ転記しますか？',confirmBody:'転記すると不変の元帳事実が作成されます。訂正には別番号の逆仕訳が必要です。',confirm:'確認して転記',requiredMemo:'摘要は必須です。',requiredAccount:'すべての明細に勘定科目が必要です。',invalidAmount:'各明細には小数2桁以内の正の借方または貸方を1つだけ入力してください。',invalidBalance:'借方と貸方の合計は正数で一致する必要があります。',createdBoundary:'下書きは保存済みですが、総勘定元帳は変更していません。',savedNo:'下書き {docNo} を保存しました',serverError:'仕訳を保存できませんでした。',sideDebit:'貸方',sideCredit:'借方'},
    vi:{finance:'Tài chính',journals:'Bút toán nhật ký',title:'Bút toán nhật ký mới',sub:'Lưu bút toán thủ công cân bằng thành bản nháp thật rồi ghi các dòng GL bất biến.',draft:'Bản nháp',posted:'Đã ghi sổ',number:'Số bút toán',date:'Ngày ghi sổ',type:'Loại bút toán',standard:'Chuẩn',accrual:'Dồn tích',reclassification:'Phân loại lại',memo:'Diễn giải',memoPh:'Mô tả lý do nghiệp vụ của bút toán',reference:'Tham chiếu',refPh:'Chứng từ nguồn hoặc lô',details:'Chi tiết bút toán',lines:'Dòng bút toán',add:'Thêm dòng',account:'Tài khoản',dimension:'Chiều phân tích',dimPh:'Trung tâm chi phí / dự án',debit:'Nợ',credit:'Có',remove:'Xóa dòng',coded:'dòng đã chọn tài khoản',totalDebit:'Tổng Nợ',totalCredit:'Tổng Có',difference:'Chênh lệch',balanced:'Cân bằng',empty:'Trống',out:'Không cân bằng',ready:'Cân bằng · sẵn sàng ghi sổ',must:'Nợ phải bằng Có trước khi ghi sổ',entryBalances:'Bút toán cân bằng',mustBalance:'Phải cân bằng để ghi sổ',drHeavy:'Nợ lớn hơn',crHeavy:'Có lớn hơn',enter:'Nhập số tiền Nợ và Có.',addSide:'Thêm {amount} vào bên {side}.',cancel:'Hủy',save:'Lưu nháp',savePost:'Lưu & ghi sổ',post:'Ghi vào GL',saving:'Đang lưu…',posting:'Đang ghi sổ…',saved:'Đã lưu bút toán nháp',postedMsg:'Đã ghi bút toán vào Sổ cái',select:'Chọn tài khoản…',loading:'Đang tải hệ thống tài khoản…',loadFail:'Không thể tải hệ thống tài khoản chuẩn.',retry:'Thử lại',noAccounts:'Chưa cấu hình tài khoản tài chính cho công ty này.',limit:'Bộ chọn giới hạn ở 500 tài khoản đầu tiên.',dateHelp:'Ngày ghi sổ được lưu trên mỗi dòng GL. Khóa kỳ sẽ được áp dụng khi miền chính sách kỳ riêng hoàn tất.',confirmTitle:'Ghi bút toán vào Sổ cái?',confirmBody:'Ghi sổ tạo dữ kiện sổ cái bất biến. Mọi điều chỉnh phải dùng một bút toán đảo riêng có số riêng.',confirm:'Xác nhận & ghi sổ',requiredMemo:'Bắt buộc có diễn giải.',requiredAccount:'Mỗi dòng cần một tài khoản.',invalidAmount:'Mỗi dòng phải có đúng một số Nợ hoặc Có dương, tối đa 2 chữ số thập phân.',invalidBalance:'Tổng Nợ và Có phải bằng nhau và lớn hơn 0.',createdBoundary:'Bản nháp đã lưu nhưng chưa thay đổi Sổ cái.',savedNo:'Đã lưu bản nháp {docNo}',serverError:'Không thể lưu bút toán.',sideDebit:'Có',sideCredit:'Nợ'}
  };
  COPY.en.dateHelp='Posting is allowed only when exactly one open accounting period covers this date; locked or missing periods are rejected.';
  COPY.ms.dateHelp='Posting hanya dibenarkan apabila tepat satu tempoh perakaunan terbuka meliputi tarikh ini; tempoh terkunci atau tiada akan ditolak.';
  COPY.zh.dateHelp='只有一个开放会计期间准确覆盖此日期时才可过账；锁定或缺失期间会被拒绝。';
  COPY.ja.dateHelp='この日付を含む開いている会計期間が1件だけ存在する場合に限り転記できます。ロック済みまたは未設定の期間は拒否されます。';
  COPY.vi.dateHelp='Chỉ được ghi sổ khi đúng một kỳ kế toán đang mở bao phủ ngày này; kỳ bị khóa hoặc bị thiếu sẽ bị từ chối.';
  const LOCALE={en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'};
  function c(){return i18nLegacy(COPY);}
  function today(){return typeof workingPeriodEndDate==='function'?workingPeriodEndDate():new Date().toISOString().slice(0,10);}
  function newNumber(){const now=new Date(),stamp=now.toISOString().replace(/[-:TZ.]/g,'').slice(0,14);return `MJ-${stamp}`;}
  function blank(){return {accountId:'',dimension:'',debit:'',credit:''};}
  function cents(value){
    const text=String(value||'').trim();
    if(!/^(?:0|[1-9]\d*)(?:\.\d{0,2})?$/.test(text)) return null;
    const parts=text.split('.');
    return BigInt(parts[0])*100n+BigInt((parts[1]||'').padEnd(2,'0'));
  }
  function amountText(value){const parsed=cents(value);return parsed==null?null:(parsed/100n).toString()+'.'+String(parsed%100n).padStart(2,'0');}
  function fmt(value){
    return new Intl.NumberFormat(LOCALE[typeof getLang==='function'?getLang():'en']||'en-SG',{
      style:'currency',currency:(DB.company&&DB.company.currency)||'SGD',minimumFractionDigits:2,maximumFractionDigits:2,
    }).format(Number(value)/100);
  }
  function totals(lines){
    let debit=0n,credit=0n,valid=true,coded=0;
    lines.forEach(line=>{
      if(line.accountId) coded+=1;
      const dr=cents(line.debit||'0'),cr=cents(line.credit||'0');
      if(dr==null||cr==null){valid=false;return;}
      debit+=dr;credit+=cr;
      if((dr>0n)===(cr>0n)) valid=false;
    });
    return {debit,credit,diff:debit-credit,coded,valid,balanced:valid&&debit>0n&&debit===credit};
  }
  async function loadAccounts(){
    const rows=[];let cursor=null;
    for(let page=0;page<5;page+=1){
      const response=await window.ErpSystemData.list('finance/accounts',{limit:100,...(cursor?{cursor}:{})});
      rows.push(...(response.data||[]));cursor=response.meta&&response.meta.nextCursor;
      if(!cursor) return {rows,truncated:false};
    }
    return {rows,truncated:!!cursor};
  }
  function typeLabel(type){return c()[type]||type;}

  SCREENS['new-journal-entry']=async function(root){
    root.innerHTML=`<div class="content full"><section class="master"><div class="statepanel">${ic('loader')}<h3>${esc(c().loading)}</h3></div></section></div>`;
    let accountResult;
    try{accountResult=await loadAccounts();}
    catch(error){
      root.innerHTML=`<div class="content full"><section class="master" data-manual-journal="error">${statePanel({icon:'warn',title:c().loadFail,body:(error&&error.message)||c().serverError})}<div style="padding:0 24px">${btn(c().retry,{icon:'refresh',cls:'primary',attrs:'data-journal-retry'})}</div></section></div>`;
      root.querySelector('[data-journal-retry]')?.addEventListener('click',()=>SCREENS['new-journal-entry'](root));
      return;
    }
    const accounts=accountResult.rows.slice().sort((a,b)=>String(a.code).localeCompare(String(b.code)));
    const S={docNo:newNumber(),postingDate:today(),journalType:'standard',memo:'',reference:'',lines:[blank(),blank()],saved:null,busy:false};
    function options(selected){return `<option value="">${esc(c().select)}</option>`+accounts.map(row=>`<option value="${row.id}" ${String(row.id)===String(selected)?'selected':''}>${esc(row.code)} · ${esc(row.name)}</option>`).join('');}
    function lineRows(){return S.lines.map((line,index)=>`<tr data-line="${index}"><td class="lineno">${index+1}</td><td class="l"><select class="lineinput j-account" ${S.saved?'disabled':''}>${options(line.accountId)}</select></td><td class="l"><input class="lineinput j-dimension" value="${esc(line.dimension)}" placeholder="${esc(c().dimPh)}" ${S.saved?'disabled':''}></td><td><input class="lineinput j-debit" inputmode="decimal" value="${esc(line.debit)}" placeholder="0.00" ${S.saved?'disabled':''}></td><td><input class="lineinput j-credit" inputmode="decimal" value="${esc(line.credit)}" placeholder="0.00" ${S.saved?'disabled':''}></td><td><button class="iconbtn j-remove" aria-label="${esc(c().remove)}" ${S.saved||S.lines.length<=2?'disabled':''}>${ic('trash')}</button></td></tr>`).join('');}
    function balanceSummary(){const t=totals(S.lines),abs=t.diff<0n?-t.diff:t.diff,side=t.diff>0n?c().sideDebit:c().sideCredit;return `<div class="sumcard"><div class="sumrow"><span class="sk2">${esc(c().totalDebit)}</span><span class="sv tnum">${fmt(t.debit)}</span></div><div class="sumrow"><span class="sk2">${esc(c().totalCredit)}</span><span class="sv tnum">${fmt(t.credit)}</span></div><div class="sumrow total"><span class="sk2">${esc(c().difference)}</span><span class="sv tnum">${fmt(abs)}</span></div><div style="margin-top:10px">${t.balanced?indicator({tone:'ok',icon:'checkc',label:c().entryBalances,value:'Dr = Cr'}):indicator({tone:t.debit||t.credit?'danger':'warn',icon:'warn',label:c().mustBalance,value:t.diff>0n?c().drHeavy:t.diff<0n?c().crHeavy:'—',sub:t.debit||t.credit?c().addSide.replace('{amount}',fmt(abs)).replace('{side}',side):c().enter})}</div></div>`;}
    function foot(){const t=totals(S.lines);return `<div class="linefoot" style="display:flex;align-items:center;justify-content:flex-end;gap:26px;font-weight:600;padding:12px 14px"><span style="color:var(--muted);margin-right:auto">${t.coded} ${esc(c().coded)}</span><span class="tnum">Dr ${fmt(t.debit)}</span><span class="tnum">Cr ${fmt(t.credit)}</span>${t.balanced?cap(c().balanced,'ok'):cap(t.debit||t.credit?c().out:c().empty,t.debit||t.credit?'danger':'neutral')}</div>`;}
    function actions(){const t=totals(S.lines);if(S.saved)return `${btn(c().cancel,{cls:'soft',attrs:'data-journal-cancel'})}<div class="grow"></div><span class="hideonsmall" style="color:var(--muted);font-size:12.5px">${esc(c().createdBoundary)}</span>${btn(S.busy?c().posting:c().post,{icon:'check',cls:'primary',sm:false,attrs:`data-journal-post ${S.busy?'disabled':''}`})}`;return `<span class="hideonsmall" style="color:${t.balanced?'var(--ok)':'var(--muted)'}">${esc(t.balanced?c().ready:c().must)}</span><div class="grow"></div>${btn(c().cancel,{cls:'soft',attrs:'data-journal-cancel'})}${btn(S.busy?c().saving:c().save,{icon:'save',cls:'soft',attrs:`data-journal-save ${S.busy?'disabled':''}`})}${btn(S.busy?c().posting:c().savePost,{icon:'check',cls:'primary',sm:false,attrs:`data-journal-save-post ${!t.balanced||S.busy?'disabled':''}`})}`;}
    function render(){
      root.innerHTML=`<div class="content full"><section class="master" data-manual-journal="canonical" data-journal-status="${S.saved?'draft':'new'}"><div class="scrollarea"><div class="docwrap"><div class="docpage">${crumbs([DB.company.name,{label:c().finance,route:'gl'},{label:c().journals,route:'journal-entry'},{cur:c().title}])}<div class="dochead"><div class="dh-row1"><div><h1 class="dt">${ic('book')} ${esc(c().title)}</h1><div class="h1sub">${esc(c().sub)}</div></div><div class="dactions">${cap(c().draft,'neutral')}</div></div></div>
        ${accounts.length?`<div class="panel"><div class="panel-h"><h3>${esc(c().details)}</h3></div><div class="panel-body"><div class="fldrow c3"><div class="fld"><span>${esc(c().number)} <span class="req">*</span></span><input data-journal-number value="${esc(S.docNo)}" ${S.saved?'disabled':''}></div><div class="fld"><span>${esc(c().date)} <span class="req">*</span></span><input type="date" data-journal-date value="${esc(S.postingDate)}" ${S.saved?'disabled':''}></div><div class="fld"><span>${esc(c().type)}</span><select data-journal-type ${S.saved?'disabled':''}>${['standard','accrual','reclassification'].map(type=>`<option value="${type}" ${S.journalType===type?'selected':''}>${esc(typeLabel(type))}</option>`).join('')}</select></div></div><div class="fldrow c2" style="margin-top:12px"><div class="fld"><span>${esc(c().memo)} <span class="req">*</span></span><input data-journal-memo value="${esc(S.memo)}" placeholder="${esc(c().memoPh)}" ${S.saved?'disabled':''}></div><div class="fld"><span>${esc(c().reference)}</span><input data-journal-reference value="${esc(S.reference)}" placeholder="${esc(c().refPh)}" ${S.saved?'disabled':''}></div></div></div></div>
        <div class="doclayout"><div class="docmain"><div class="panel"><div class="panel-h"><h3>${esc(c().lines)}</h3><button class="btn soft sm" data-journal-add ${S.saved?'disabled':''}>${ic('plus')}<span>${esc(c().add)}</span></button></div><div class="tablewrap"><table class="lines"><thead><tr><th class="lineno">#</th><th class="l">${esc(c().account)}</th><th class="l">${esc(c().dimension)}</th><th>${esc(c().debit)}</th><th>${esc(c().credit)}</th><th></th></tr></thead><tbody data-journal-lines>${lineRows()}</tbody></table></div><div data-journal-foot>${foot()}</div></div></div><aside class="summary" data-journal-summary>${balanceSummary()}<div class="callout info">${ic('info')}<span>${esc(c().dateHelp)}</span></div>${accountResult.truncated?`<div class="callout warn">${ic('warn')}<span>${esc(c().limit)}</span></div>`:''}</aside></div>`:`${statePanel({icon:'book',title:c().noAccounts,body:c().loadFail})}`}</div></div></div><div class="responsive-actionbar" data-journal-actions>${accounts.length?actions():btn(c().cancel,{cls:'soft',attrs:'data-journal-cancel'})}</div></section></div>`;
      wire();
    }
    function rerenderDynamic(){const summary=root.querySelector('[data-journal-summary]'),footEl=root.querySelector('[data-journal-foot]'),actionEl=root.querySelector('[data-journal-actions]');if(summary)summary.innerHTML=balanceSummary()+`<div class="callout info">${ic('info')}<span>${esc(c().dateHelp)}</span></div>`+(accountResult.truncated?`<div class="callout warn">${ic('warn')}<span>${esc(c().limit)}</span></div>`:'');if(footEl)footEl.innerHTML=foot();if(actionEl){actionEl.innerHTML=actions();wireActions();}}
    function wire(){
      const bind=(selector,key,event='input')=>root.querySelector(selector)?.addEventListener(event,e=>{S[key]=e.target.value;});
      bind('[data-journal-number]','docNo');bind('[data-journal-date]','postingDate','change');bind('[data-journal-type]','journalType','change');bind('[data-journal-memo]','memo');bind('[data-journal-reference]','reference');
      root.querySelector('[data-journal-add]')?.addEventListener('click',()=>{S.lines.push(blank());render();});
      root.querySelectorAll('[data-line]').forEach(row=>{const index=Number(row.dataset.line),line=S.lines[index],account=row.querySelector('.j-account'),dimension=row.querySelector('.j-dimension'),debit=row.querySelector('.j-debit'),credit=row.querySelector('.j-credit');account?.addEventListener('change',()=>{line.accountId=account.value;rerenderDynamic();});dimension?.addEventListener('input',()=>{line.dimension=dimension.value;});debit?.addEventListener('input',()=>{line.debit=debit.value;if((cents(line.debit)||0n)>0n){line.credit='';credit.value='';}rerenderDynamic();});credit?.addEventListener('input',()=>{line.credit=credit.value;if((cents(line.credit)||0n)>0n){line.debit='';debit.value='';}rerenderDynamic();});row.querySelector('.j-remove')?.addEventListener('click',()=>{if(S.lines.length>2){S.lines.splice(index,1);render();}});});
      wireActions();
    }
    function wireActions(){root.querySelector('[data-journal-cancel]')?.addEventListener('click',()=>navigate('journal-entry'));root.querySelector('[data-journal-save]')?.addEventListener('click',()=>save(false));root.querySelector('[data-journal-save-post]')?.addEventListener('click',confirmPost);root.querySelector('[data-journal-post]')?.addEventListener('click',confirmPost);}
    function validation(){
      if(!S.memo.trim())return c().requiredMemo;
      if(S.lines.some(line=>!line.accountId))return c().requiredAccount;
      const t=totals(S.lines);if(!t.valid)return c().invalidAmount;if(!t.balanced)return c().invalidBalance;return null;
    }
    function confirmPost(){
      const error=validation();if(error){toast(error,'danger');return;}
      appModal({icon:'book',title:c().confirmTitle,body:`<div class="risk warn">${ic('warn')}<div><b>${esc(c().confirmBody)}</b><small>Dr ${fmt(totals(S.lines).debit)} · Cr ${fmt(totals(S.lines).credit)}</small></div></div>`,actions:`${btn(c().cancel,{cls:'soft',attrs:'data-manual-journal-close'})}${btn(c().confirm,{icon:'check',cls:'primary',attrs:'data-manual-journal-confirm'})}`});
      document.querySelector('[data-manual-journal-close]')?.addEventListener('click',closeModal);
      document.querySelector('[data-manual-journal-confirm]')?.addEventListener('click',()=>{closeModal();S.saved?post():save(true);});
    }
    async function save(postAfter){
      const error=validation();if(error){toast(error,'danger');return;}
      S.busy=true;rerenderDynamic();
      try{
        const response=await window.ErpSystemData.create('finance/journals',{
          docNo:S.docNo.trim(),postingDate:S.postingDate,journalType:S.journalType,memo:S.memo.trim(),reference:S.reference.trim()||null,
          lines:S.lines.map(line=>({accountId:Number(line.accountId),dimension:line.dimension.trim()||null,debit:amountText(line.debit||'0'),credit:amountText(line.credit||'0')})),
        });
        S.saved=response.data;S.busy=false;toast(c().savedNo.replace('{docNo}',S.saved.docNo),'ok');render();if(postAfter)await post();
      }catch(error2){S.busy=false;rerenderDynamic();toast((error2&&error2.message)||c().serverError,'danger');}
    }
    async function post(){
      if(!S.saved)return;
      S.busy=true;rerenderDynamic();
      try{
        await window.ErpSystemData.action('finance/journals',S.saved.id,'post',{},`manual-journal-post-${S.saved.id}`);
        toast(c().postedMsg,'ok');await prepareCanonicalFinanceData();navigate('journal-entry',{no:S.saved.docNo});
      }catch(error){S.busy=false;rerenderDynamic();toast((error&&error.message)||c().serverError,'danger');}
    }
    render();
  };
})();
