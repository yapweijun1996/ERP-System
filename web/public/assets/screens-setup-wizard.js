/* ============================================================
   ARIA ERP — First-run Setup Wizard (TASK-009, TASK-010, EPIC-004)

   Collects language / organization / company / admin user /
   AI-provider (BYOK, optional — never persisted) choices, shows a
   summary, then on Finish calls the active ErpSystemData-compatible
   adapter to write the organization, company, starter chart of
   accounts, tax rule, admin app_user and user<->company link in one
   PGlite or PostgreSQL transaction. Only then does it
   mark setup complete in localStorage and reload into the normal
   login/dashboard flow — a failed write leaves the wizard open so
   the user can retry.

   Gated in app.js's boot(): needsSetupWizard() runs BEFORE the
   sign-in check, mirroring docs/SETUP_WIZARD.md's "no master ->
   wizard; master exists -> normal login" rule. Rendered outside
   the normal #app shell, the same way renderLogin() works, so it
   is not part of the SCREENS router registry.
   ============================================================ */

var SETUP_WIZARD_KEY = 'aria-setup-wizard-complete';

function needsSetupWizard(){
  try{ return localStorage.getItem(SETUP_WIZARD_KEY) !== '1'; }catch{ return false; }
}
function markSetupWizardComplete(){
  try{ localStorage.setItem(SETUP_WIZARD_KEY,'1'); }catch{}
}
function clearSetupWizardFlag(){
  try{ localStorage.removeItem(SETUP_WIZARD_KEY); }catch{}
}

function renderSetupWizard(){
  setAuthShell(true);
  if(typeof closeAllPops==='function') closeAllPops();
  if(typeof closePalette==='function') closePalette();
  if(typeof closeModal==='function') closeModal();

  var host=document.getElementById('setupWizardView');
  if(!host){
    host=document.createElement('main');
    host.id='setupWizardView';
    host.className='auth-view';
    host.setAttribute('aria-label','First-run setup');
    document.body.insertBefore(host, document.getElementById('app'));
  }

  var COUNTRY_META = {
    SG:{ currency:'SGD', symbol:'S$', taxRegime:'GST', taxLabel:'GST 9%' },
    MY:{ currency:'MYR', symbol:'RM', taxRegime:'SST', taxLabel:'SST 8%' },
  };
  var IS_API = typeof window.erpDataMode === 'function' && window.erpDataMode() === 'api';
  var PROVIDERS = [
    ['', 'None — skip for now'],
    ['openai', 'OpenAI'],
    ['gemini', 'Google Gemini'],
    ['deepseek', 'DeepSeek'],
    ['lmstudio', 'LM Studio (local)'],
  ];

  var COPY = {
    en:{
      brand:'First-run setup', back:'Back', cont:'Continue', finish:'Finish setup',
      s0:'Language', s1:'Organization', s2:'Company', s3:'Admin user', s4:'AI (optional)', s5:'Finish',
      s0h:'Choose your language', s0p:'You can change this later from the top bar.',
      s1h:'Name your organization', s1p:'The top-level group or holding entity. Every company you add belongs to it.',
      s1lbl:'Organization name', s1ph:'e.g. Acme Group', s1code:'Organization login code', s1codeph:'e.g. ACME',
      setupToken:'Deployment setup token', setupTokenPh:'Provided by your installer',
      setupTokenNote:'Used once to authorize production setup. It is kept only in this page’s memory.',
      s2h:'Add your first company', s2p:'One legal entity per country. Country sets currency and tax regime automatically.',
      s2lbl:'Company name', s2ph:'e.g. Acme Singapore', s2country:'Country',
      s3h:'Create the first admin user', s3p:'This account will have full access once setup is applied.',
      s3name:'Full name', s3nameph:'e.g. Alex Tan', s3username:'Username', s3email:'Work email', s3emailph:'e.g. admin@acme.co',
      s3password:'Password', s3passwordph:'At least 8 characters', s3passwordConfirm:'Confirm password',
      s4h:'Connect an AI provider (optional)', s4p:'Bring Your Own Key — your key is never stored or sent to us; this preview does not persist it.',
      s4provider:'Provider', s4key:'API key', s4keyph:'Not required for this preview',
      s4note:'This key is kept only in this step’s memory and is discarded on Finish/Back — nothing is saved.',
      s5h:'Review and finish', s5p:'Finishing writes the company, tax rule, chart of accounts and admin user to this browser’s demo database (PGlite/IndexedDB).',
      s5pProd:'Finishing securely creates the organization, company, tax rule, chart of accounts and first administrator in PostgreSQL.',
      sumLang:'Language', sumOrg:'Organization', sumOrgCode:'Login code', sumCompany:'Company', sumCountry:'Country', sumCurrency:'Currency', sumTax:'Tax regime',
      sumAdmin:'Admin user', sumAi:'AI provider', none:'None selected',
      errMaster:'Enter an organization name to continue.',
      errOrgCode:'Use 3–32 letters, numbers or hyphens for the organization code.',
      errSetupToken:'Enter the deployment setup token to continue.',
      errCompany:'Enter a company name to continue.',
      errAdminName:'Enter the admin user’s full name to continue.',
      errAdminUsername:'Use 3–64 lowercase letters, numbers, dots, underscores or hyphens for the username.',
      errAdminEmail:'Enter a valid email address to continue.',
      errAdminPassword:'Password must be at least 8 characters.',
      errAdminPasswordMismatch:'Passwords do not match.',
      finished:'Setup complete — reloading.',
    },
    ms:{
      brand:'Persediaan pertama', back:'Kembali', cont:'Teruskan', finish:'Selesai persediaan',
      s0:'Bahasa', s1:'Organisasi', s2:'Syarikat', s3:'Pengguna admin', s4:'AI (pilihan)', s5:'Selesai',
      s0h:'Pilih bahasa anda', s0p:'Anda boleh menukarnya kemudian dari bar atas.',
      s1h:'Namakan organisasi anda', s1p:'Kumpulan induk peringkat atas. Setiap syarikat yang anda tambah tergolong dalamnya.',
      s1lbl:'Nama organisasi', s1ph:'cth. Acme Group', s1code:'Kod log masuk organisasi', s1codeph:'cth. ACME',
      setupToken:'Token persediaan penggunaan', setupTokenPh:'Diberikan oleh pemasang anda',
      setupTokenNote:'Digunakan sekali untuk membenarkan persediaan produksi. Ia hanya disimpan dalam memori halaman ini.',
      s2h:'Tambah syarikat pertama anda', s2p:'Satu entiti sah bagi setiap negara. Negara menetapkan mata wang dan rejim cukai secara automatik.',
      s2lbl:'Nama syarikat', s2ph:'cth. Acme Malaysia', s2country:'Negara',
      s3h:'Cipta pengguna admin pertama', s3p:'Akaun ini akan mempunyai akses penuh selepas persediaan digunakan.',
      s3name:'Nama penuh', s3nameph:'cth. Aina Rahman', s3username:'Nama pengguna', s3email:'E-mel kerja', s3emailph:'cth. admin@acme.co',
      s3password:'Kata laluan', s3passwordph:'Sekurang-kurangnya 8 aksara', s3passwordConfirm:'Sahkan kata laluan',
      s4h:'Sambungkan pembekal AI (pilihan)', s4p:'Bawa Kunci Anda Sendiri — kunci anda tidak disimpan atau dihantar kepada kami; pratonton ini tidak menyimpannya.',
      s4provider:'Pembekal', s4key:'Kunci API', s4keyph:'Tidak diperlukan untuk pratonton ini',
      s4note:'Kunci ini hanya disimpan dalam memori langkah ini dan dibuang apabila Selesai/Kembali — tiada apa yang disimpan.',
      s5h:'Semak dan selesai', s5p:'Selesai akan menulis syarikat, peraturan cukai, carta akaun dan pengguna admin ke pangkalan data demo pelayar ini (PGlite/IndexedDB).',
      s5pProd:'Selesai akan mencipta organisasi, syarikat, peraturan cukai, carta akaun dan pentadbir pertama dengan selamat dalam PostgreSQL.',
      sumLang:'Bahasa', sumOrg:'Organisasi', sumOrgCode:'Kod log masuk', sumCompany:'Syarikat', sumCountry:'Negara', sumCurrency:'Mata wang', sumTax:'Rejim cukai',
      sumAdmin:'Pengguna admin', sumAi:'Pembekal AI', none:'Tiada dipilih',
      errMaster:'Masukkan nama organisasi untuk teruskan.',
      errOrgCode:'Gunakan 3–32 huruf, nombor atau tanda sempang untuk kod organisasi.',
      errSetupToken:'Masukkan token persediaan penggunaan untuk teruskan.',
      errCompany:'Masukkan nama syarikat untuk teruskan.',
      errAdminName:'Masukkan nama penuh pengguna admin untuk teruskan.',
      errAdminUsername:'Gunakan 3–64 huruf kecil, nombor, titik, garis bawah atau tanda sempang untuk nama pengguna.',
      errAdminEmail:'Masukkan alamat e-mel yang sah untuk teruskan.',
      errAdminPassword:'Kata laluan mestilah sekurang-kurangnya 8 aksara.',
      errAdminPasswordMismatch:'Kata laluan tidak sepadan.',
      finished:'Persediaan selesai — memuat semula.',
    },
    zh:{
      brand:'首次设置', back:'上一步', cont:'继续', finish:'完成设置',
      s0:'语言', s1:'组织', s2:'公司', s3:'管理员账户', s4:'AI(可选)', s5:'完成',
      s0h:'选择您的语言', s0p:'您稍后可以从顶部栏更改。',
      s1h:'为您的组织命名', s1p:'顶层集团/控股实体。您添加的每家公司都属于它。',
      s1lbl:'组织名称', s1ph:'例如 Acme Group', s1code:'组织登录代码', s1codeph:'例如 ACME',
      setupToken:'部署设置令牌', setupTokenPh:'由系统安装人员提供',
      setupTokenNote:'仅用于授权一次生产设置,只保留在本页面内存中。',
      s2h:'添加您的第一家公司', s2p:'每个国家一个法人实体。国家会自动设置货币和税制。',
      s2lbl:'公司名称', s2ph:'例如 Acme Singapore', s2country:'国家',
      s3h:'创建第一个管理员账户', s3p:'设置生效后,此账户将拥有完整权限。',
      s3name:'姓名', s3nameph:'例如 陈晓明', s3username:'用户名', s3email:'工作邮箱', s3emailph:'例如 admin@acme.co',
      s3password:'密码', s3passwordph:'至少 8 个字符', s3passwordConfirm:'确认密码',
      s4h:'连接 AI 提供商(可选)', s4p:'自带密钥 — 您的密钥不会被存储或发送给我们;此预览不会保存它。',
      s4provider:'提供商', s4key:'API 密钥', s4keyph:'此预览不需要',
      s4note:'此密钥仅保留在本步骤的内存中,点击完成/上一步后即被丢弃 — 不会被保存。',
      s5h:'检查并完成', s5p:'点击完成后,公司、税务规则、会计科目表和管理员账户将写入此浏览器的演示数据库(PGlite/IndexedDB)。',
      s5pProd:'点击完成后,组织、公司、税务规则、会计科目表和首位管理员将安全地创建到 PostgreSQL。',
      sumLang:'语言', sumOrg:'组织', sumOrgCode:'登录代码', sumCompany:'公司', sumCountry:'国家', sumCurrency:'货币', sumTax:'税制',
      sumAdmin:'管理员账户', sumAi:'AI 提供商', none:'未选择',
      errMaster:'请输入组织名称以继续。',
      errOrgCode:'组织代码须为 3–32 个字母、数字或连字符。',
      errSetupToken:'请输入部署设置令牌以继续。',
      errCompany:'请输入公司名称以继续。',
      errAdminName:'请输入管理员姓名以继续。',
      errAdminUsername:'用户名须为 3–64 个小写字母、数字、句点、下划线或连字符。',
      errAdminEmail:'请输入有效的电子邮箱地址以继续。',
      errAdminPassword:'密码至少需要 8 个字符。',
      errAdminPasswordMismatch:'两次输入的密码不一致。',
      finished:'设置完成 — 正在重新加载。',
    },

    "ja":{
      "brand": "初回実行時のセットアップ",
      "back": "戻る",
      "cont": "続く",
      "finish": "セットアップを完了する",
      "s0": "言語",
      "s1": "組織",
      "s2": "会社",
      "s3": "管理者ユーザー",
      "s4": "AI（オプション）",
      "s5": "仕上げる",
      "s0h": "言語を選択してください",
      "s0p": "これは後で上部のバーから変更できます。",
      "s1h": "組織に名前を付けます",
      "s1p": "最上位のグループまたは保持エンティティ。追加したすべての会社はそれに属します。",
      "s1lbl": "組織名",
      "s1ph": "例えばアクメグループ",
      "s1code": "組織のログインコード",
      "s1codeph": "例えばアクメ",
      "setupToken": "デプロイメントセットアップトークン",
      "setupTokenPh": "設置者によって提供される",
      "setupTokenNote": "運用セットアップを認証するために 1 回使用されます。このページのメモリ内にのみ保持されます。",
      "s2h": "最初の会社を追加する",
      "s2p": "国ごとに 1 つの法人。通貨と税制は国が自動的に設定します。",
      "s2lbl": "会社名",
      "s2ph": "例えばアクメ シンガポール",
      "s2country": "国",
      "s3h": "最初の管理者ユーザーを作成する",
      "s3p": "セットアップが適用されると、このアカウントには完全なアクセス権が付与されます。",
      "s3name": "フルネーム",
      "s3nameph": "例えばアレックス・タン",
      "s3username": "ユーザー名",
      "s3email": "仕事用メール",
      "s3emailph": "例えばadmin@acme.co",
      "s3password": "パスワード",
      "s3passwordph": "少なくとも 8 文字",
      "s3passwordConfirm": "パスワードを認証する",
      "s4h": "AI プロバイダーに接続する (オプション)",
      "s4p": "自分のキーを持参する — あなたのキーが保管されたり、当社に送信されたりすることはありません。このプレビューはそれを保持しません。",
      "s4provider": "プロバイダー",
      "s4key": "APIキー",
      "s4keyph": "このプレビューには必要ありません",
      "s4note": "このキーはこのステップのメモリ内にのみ保持され、「終了」/「戻る」時に破棄され、何も保存されません。",
      "s5h": "確認して終了",
      "s5p": "完了すると、会社、税規則、勘定科目表、および管理者ユーザーがこのブラウザのデモ データベース (PGlite/IndexedDB) に書き込まれます。",
      "s5pProd": "安全に完了すると、PostgreSQL に組織、会社、税法、勘定科目表、および最初の管理者が作成されます。",
      "sumLang": "言語",
      "sumOrg": "組織",
      "sumOrgCode": "ログインコード",
      "sumCompany": "会社",
      "sumCountry": "国",
      "sumCurrency": "通貨",
      "sumTax": "税制",
      "sumAdmin": "管理者ユーザー",
      "sumAi": "AIプロバイダー",
      "none": "何も選択されていません",
      "errMaster": "続行するには組織名を入力してください。",
      "errOrgCode": "組織コードには 3 ～ 32 文字の文字、数字、またはハイフンを使用します。",
      "errSetupToken": "続行するには、展開セットアップ トークンを入力します。",
      "errCompany": "続行するには会社名を入力してください。",
      "errAdminName": "続行するには、管理者ユーザーのフルネームを入力します。",
      "errAdminUsername": "ユーザー名には 3 ～ 64 文字の小文字、数字、ドット、アンダースコア、またはハイフンを使用します。",
      "errAdminEmail": "続行するには、有効な電子メール アドレスを入力してください。",
      "errAdminPassword": "パスワードは 8 文字以上である必要があります。",
      "errAdminPasswordMismatch": "パスワードが一致しません。",
      "finished": "セットアップが完了しました — リロード中です。"
    },
    "vi":{
      "brand": "Thiết lập lần chạy đầu tiên",
      "back": "Mặt sau",
      "cont": "Tiếp tục",
      "finish": "Hoàn tất thiết lập",
      "s0": "Ngôn ngữ",
      "s1": "Tổ chức",
      "s2": "Công ty",
      "s3": "Người dùng quản trị",
      "s4": "AI (tùy chọn)",
      "s5": "Hoàn thành",
      "s0h": "Chọn ngôn ngữ của bạn",
      "s0p": "Bạn có thể thay đổi điều này sau từ thanh trên cùng.",
      "s1h": "Đặt tên cho tổ chức của bạn",
      "s1p": "Nhóm cấp cao nhất hoặc tổ chức nắm giữ. Mọi công ty bạn thêm đều thuộc về nó.",
      "s1lbl": "Tên tổ chức",
      "s1ph": "ví dụ. Tập đoàn Acme",
      "s1code": "Mã đăng nhập tổ chức",
      "s1codeph": "ví dụ. ACME",
      "setupToken": "Mã thông báo thiết lập triển khai",
      "setupTokenPh": "Được cung cấp bởi trình cài đặt của bạn",
      "setupTokenNote": "Được sử dụng một lần để cho phép thiết lập sản xuất. Nó chỉ được lưu giữ trong bộ nhớ của trang này.",
      "s2h": "Thêm công ty đầu tiên của bạn",
      "s2p": "Một pháp nhân cho mỗi quốc gia. Quốc gia tự động thiết lập chế độ tiền tệ và thuế.",
      "s2lbl": "Tên công ty",
      "s2ph": "ví dụ. Acme Singapore",
      "s2country": "Quốc gia",
      "s3h": "Tạo người dùng quản trị đầu tiên",
      "s3p": "Tài khoản này sẽ có toàn quyền truy cập sau khi áp dụng thiết lập.",
      "s3name": "Tên đầy đủ",
      "s3nameph": "ví dụ. Alex Tân",
      "s3username": "Tên người dùng",
      "s3email": "Email công việc",
      "s3emailph": "ví dụ. quản trị@acme.co",
      "s3password": "Mật khẩu",
      "s3passwordph": "Ít nhất 8 ký tự",
      "s3passwordConfirm": "Xác nhận mật khẩu",
      "s4h": "Kết nối nhà cung cấp AI (tùy chọn)",
      "s4p": "Mang theo chìa khóa riêng của bạn - chìa khóa của bạn không bao giờ được lưu trữ hoặc gửi cho chúng tôi; bản xem trước này không tồn tại.",
      "s4provider": "nhà cung cấp",
      "s4key": "Khóa API",
      "s4keyph": "Không bắt buộc đối với bản xem trước này",
      "s4note": "Khóa này chỉ được lưu trong bộ nhớ của bước này và bị loại bỏ khi Hoàn tất/Quay lại - không có gì được lưu.",
      "s5h": "Xem xét và kết thúc",
      "s5p": "Hoàn tất ghi công ty, quy tắc thuế, biểu đồ tài khoản và người dùng quản trị vào cơ sở dữ liệu demo của trình duyệt này (PGlite/IndexedDB).",
      "s5pProd": "Việc hoàn tất một cách an toàn sẽ tạo ra tổ chức, công ty, quy tắc thuế, sơ đồ tài khoản và quản trị viên đầu tiên trong PostgreSQL.",
      "sumLang": "Ngôn ngữ",
      "sumOrg": "Tổ chức",
      "sumOrgCode": "Mã đăng nhập",
      "sumCompany": "Công ty",
      "sumCountry": "Quốc gia",
      "sumCurrency": "Tiền tệ",
      "sumTax": "Chế độ thuế",
      "sumAdmin": "Người dùng quản trị",
      "sumAi": "nhà cung cấp AI",
      "none": "Không có lựa chọn nào",
      "errMaster": "Nhập tên tổ chức để tiếp tục.",
      "errOrgCode": "Sử dụng 3–32 chữ cái, số hoặc dấu gạch nối cho mã tổ chức.",
      "errSetupToken": "Nhập mã thông báo thiết lập triển khai để tiếp tục.",
      "errCompany": "Nhập tên công ty để tiếp tục.",
      "errAdminName": "Nhập tên đầy đủ của người dùng quản trị để tiếp tục.",
      "errAdminUsername": "Sử dụng 3–64 chữ cái viết thường, số, dấu chấm, dấu gạch dưới hoặc dấu gạch nối cho tên người dùng.",
      "errAdminEmail": "Nhập địa chỉ email hợp lệ để tiếp tục.",
      "errAdminPassword": "Mật khẩu phải có ít nhất 8 ký tự.",
      "errAdminPasswordMismatch": "Mật khẩu không khớp.",
      "finished": "Thiết lập hoàn tất - đang tải lại."
    },};

  var S = {
    step:0, reached:0,
    lang:(typeof getLang==='function'?getLang():'en'),
    masterName:'', organizationCode:'', setupToken:'', companyName:'', country:'SG',
    adminName:'', adminUsername:IS_API?'admin':'', adminEmail:'', adminPassword:'', adminPasswordConfirm:'',
    aiProvider:'', aiKey:'',
  };

  var STEP_KEYS = ['s0','s1','s2','s3','s4','s5'];

  function copy(){ i18nLegacy(COPY); return COPY[S.lang]||COPY.en; }
  function s(k){ var c=copy(); return c[k]!=null?c[k]:(COPY.en[k]!=null?COPY.en[k]:k); }

  function stepper(){
    var steps = STEP_KEYS.map(function(k){ return [s(k)]; });
    return wizardStepper(steps, S.step, S.reached);
  }

  function fld(label, inputHtml){
    return '<div class="fld"><span>'+esc(label)+'</span>'+inputHtml+'</div>';
  }
  function seg(name, opts, cur, id){
    var groupLabel = name==='lang' ? s('s0') : (name==='country' ? s('s2country') : name);
    var groupClass = name==='lang' ? 'seg wiz-lang-seg' : 'seg';
    return '<div class="'+groupClass+'" id="'+id+'" role="radiogroup" aria-label="'+esc(groupLabel)+'">'+opts.map(function(o){
      var selected=o[0]===cur;
      var langAttr=name==='lang' ? ' lang="'+(o[0]==='zh'?'zh-Hans':esc(o[0]))+'"' : '';
      return '<button type="button" role="radio" aria-checked="'+selected+'" data-v="'+esc(o[0])+'" class="'+(selected?'on':'')+'"'+langAttr+'>'+esc(o[1])+'</button>';
    }).join('')+'</div>';
  }

  function stepBody(){
    if(S.step===0){
      return '<h2 class="wiz-h">'+esc(s('s0h'))+'</h2><p class="wiz-p">'+esc(s('s0p'))+'</p>'+
        seg('lang', I18N_LANGS.map(function(l){ return [l.code, l.native]; }), S.lang, 'wizLangSeg');
    }
    if(S.step===1){
      return '<h2 class="wiz-h">'+esc(s('s1h'))+'</h2><p class="wiz-p">'+esc(s('s1p'))+'</p>'+
        fld(s('s1lbl'), '<input id="wizMaster" value="'+esc(S.masterName)+'" placeholder="'+esc(s('s1ph'))+'" autofocus>')+
        fld(s('s1code'), '<input id="wizOrganizationCode" value="'+esc(S.organizationCode)+'" placeholder="'+esc(s('s1codeph'))+'" autocomplete="organization">')+
        (IS_API ? fld(s('setupToken'), '<input id="wizSetupToken" type="password" value="'+esc(S.setupToken)+'" placeholder="'+esc(s('setupTokenPh'))+'" autocomplete="off">')+
          '<p class="wiz-p" style="margin-top:6px">'+esc(s('setupTokenNote'))+'</p>' : '')+
        '<div class="auth-error" id="wizErr"></div>';
    }
    if(S.step===2){
      var meta = COUNTRY_META[S.country];
      return '<h2 class="wiz-h">'+esc(s('s2h'))+'</h2><p class="wiz-p">'+esc(s('s2p'))+'</p>'+
        fld(s('s2lbl'), '<input id="wizCompany" value="'+esc(S.companyName)+'" placeholder="'+esc(s('s2ph'))+'" autofocus>')+
        '<div class="fld" style="margin-top:10px"><span>'+esc(s('s2country'))+'</span>'+
        seg('country', [['SG','Singapore'],['MY','Malaysia']], S.country, 'wizCountrySeg')+'</div>'+
        '<p class="wiz-p" style="margin-top:10px">'+esc(s('sumCurrency'))+': <b>'+esc(meta.currency)+'</b> &middot; '+esc(s('sumTax'))+': <b>'+esc(meta.taxLabel)+'</b></p>'+
        '<div class="auth-error" id="wizErr"></div>';
    }
    if(S.step===3){
      return '<h2 class="wiz-h">'+esc(s('s3h'))+'</h2><p class="wiz-p">'+esc(s('s3p'))+'</p>'+
        fld(s('s3name'), '<input id="wizAdminName" value="'+esc(S.adminName)+'" placeholder="'+esc(s('s3nameph'))+'" autofocus>')+
        fld(s('s3username'), '<input id="wizAdminUsername" value="'+esc(S.adminUsername)+'" autocomplete="username">')+
        fld(s('s3email'), '<input id="wizAdminEmail" type="email" value="'+esc(S.adminEmail)+'" placeholder="'+esc(s('s3emailph'))+'">')+
        fld(s('s3password'), '<input id="wizAdminPassword" type="password" value="'+esc(S.adminPassword)+'" placeholder="'+esc(s('s3passwordph'))+'" autocomplete="new-password">')+
        fld(s('s3passwordConfirm'), '<input id="wizAdminPasswordConfirm" type="password" value="'+esc(S.adminPasswordConfirm)+'" autocomplete="new-password">')+
        '<div class="auth-error" id="wizErr"></div>';
    }
    if(S.step===4){
      return '<h2 class="wiz-h">'+esc(s('s4h'))+'</h2><p class="wiz-p">'+esc(s('s4p'))+'</p>'+
        fld(s('s4provider'), '<select id="wizProvider">'+PROVIDERS.map(function(p){
          return '<option value="'+esc(p[0])+'" '+(p[0]===S.aiProvider?'selected':'')+'>'+esc(p[1])+'</option>';
        }).join('')+'</select>')+
        fld(s('s4key'), '<input id="wizAiKey" type="password" value="'+esc(S.aiKey)+'" placeholder="'+esc(s('s4keyph'))+'" '+(S.aiProvider?'':'disabled')+'>')+
        '<p class="wiz-p" style="margin-top:6px">'+esc(s('s4note'))+'</p>';
    }
    // step 5 — summary
    meta = COUNTRY_META[S.country];
    var langNative = (I18N_LANGS.filter(function(l){ return l.code===S.lang; })[0]||{}).native||S.lang;
    var providerLabel = (PROVIDERS.filter(function(p){ return p[0]===S.aiProvider; })[0]||[undefined,s('none')])[1];
    return '<h2 class="wiz-h">'+esc(s('s5h'))+'</h2><p class="wiz-p">'+esc(IS_API?s('s5pProd'):s('s5p'))+'</p>'+
      '<div class="panel" style="margin-top:8px"><div class="panel-body" style="padding:14px 16px;display:grid;gap:8px;font-size:13px">'+
      ['sumLang,'+langNative, 'sumOrg,'+(S.masterName||'—'), 'sumOrgCode,'+(S.organizationCode||'—'), 'sumCompany,'+(S.companyName||'—'),
       'sumCountry,'+S.country, 'sumCurrency,'+meta.currency, 'sumTax,'+meta.taxLabel,
       'sumAdmin,'+((S.adminName||'—')+(S.adminEmail?' · '+S.adminEmail:'')),
       'sumAi,'+providerLabel].map(function(pair){
        var parts=pair.split(','); return '<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:var(--muted)">'+esc(s(parts[0]))+'</span><b>'+esc(parts.slice(1).join(','))+'</b></div>';
      }).join('')+
      '</div></div>';
  }

  function footer(){
    var isLast = S.step===STEP_KEYS.length-1;
    var right = isLast
      ? btn(s('finish'),{icon:'checkc',cls:'primary',sm:false,attrs:'id="wizFinish"'})
      : btn(s('cont'),{icon:'arrowR',cls:'primary',sm:false,attrs:'id="wizNext"'});
    var left = S.step>0 ? btn(s('back'),{icon:'chevL',cls:'soft',attrs:'id="wizBack"'}) : '<span></span>';
    return '<div class="set-savebar wizard-savebar" style="border-radius:12px;margin-top:16px">'+left+'<div class="grow"></div>'+right+'</div>';
  }

  function render(){
    host.setAttribute('lang', S.lang==='zh'?'zh-Hans':S.lang);
    host.innerHTML = '<section class="auth-panel" style="width:min(640px,100%)">'+
      '<div class="auth-brand"><span class="mark">'+ic('box')+'</span><span><b>Aria ERP</b><small>'+esc(s('brand'))+'</small></span></div>'+
      stepper()+
      '<div id="wizStepBody">'+stepBody()+'</div>'+
      footer()+
      '</section>';
    wire();
  }

  function readCurrentStepInputs(){
    if(S.step===1){
      var m=document.getElementById('wizMaster'); if(m) S.masterName=m.value;
      var oc=document.getElementById('wizOrganizationCode'); if(oc) S.organizationCode=oc.value.toUpperCase();
      var st=document.getElementById('wizSetupToken'); if(st) S.setupToken=st.value;
    }
    else if(S.step===2){ var c=document.getElementById('wizCompany'); if(c) S.companyName=c.value; }
    else if(S.step===3){
      var n=document.getElementById('wizAdminName'); if(n) S.adminName=n.value;
      var un=document.getElementById('wizAdminUsername'); if(un) S.adminUsername=un.value.toLowerCase();
      var e=document.getElementById('wizAdminEmail'); if(e) S.adminEmail=e.value;
      var pw=document.getElementById('wizAdminPassword'); if(pw) S.adminPassword=pw.value;
      var pwc=document.getElementById('wizAdminPasswordConfirm'); if(pwc) S.adminPasswordConfirm=pwc.value;
    }
    else if(S.step===4){
      var p=document.getElementById('wizProvider'); if(p) S.aiProvider=p.value;
      var k=document.getElementById('wizAiKey'); if(k) S.aiKey=k.value;
    }
  }

  function validateStep(i){
    if(i===1 && !S.masterName.trim()) return s('errMaster');
    if(i===1 && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(S.organizationCode.trim().toUpperCase())) return s('errOrgCode');
    if(i===1 && IS_API && !S.setupToken) return s('errSetupToken');
    if(i===2 && !S.companyName.trim()) return s('errCompany');
    if(i===3){
      if(!S.adminName.trim()) return s('errAdminName');
      if(!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(S.adminUsername.trim().toLowerCase())) return s('errAdminUsername');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.adminEmail.trim())) return s('errAdminEmail');
      if(S.adminPassword.length<8) return s('errAdminPassword');
      if(S.adminPassword!==S.adminPasswordConfirm) return s('errAdminPasswordMismatch');
    }
    return '';
  }

  function wire(){
    host.querySelectorAll('.step[data-step]').forEach(function(b){
      b.addEventListener('click',function(){
        var i=+b.dataset.step; if(i>S.reached) return;
        readCurrentStepInputs(); S.step=i; render();
      });
    });
    var langSeg=document.getElementById('wizLangSeg');
    if(langSeg) langSeg.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click',function(){ S.lang=b.dataset.v; render(); });
    });
    var countrySeg=document.getElementById('wizCountrySeg');
    if(countrySeg) countrySeg.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click',function(){ readCurrentStepInputs(); S.country=b.dataset.v; render(); });
    });
    var provSel=document.getElementById('wizProvider');
    if(provSel) provSel.addEventListener('change',function(){ readCurrentStepInputs(); render(); });

    var back=document.getElementById('wizBack');
    if(back) back.addEventListener('click',function(){ readCurrentStepInputs(); S.step--; render(); });
    var next=document.getElementById('wizNext');
    if(next) next.addEventListener('click',function(){
      readCurrentStepInputs();
      var err=validateStep(S.step);
      var errEl=document.getElementById('wizErr');
      if(err){ if(errEl) errEl.textContent=err; return; }
      if(S.step===1 && !S.adminUsername){
        S.adminUsername=IS_API
          ? 'admin'
          : ('admin.'+S.organizationCode.trim().toLowerCase()).slice(0,64);
      }
      S.step++; S.reached=Math.max(S.reached,S.step); render();
    });
    var finish=document.getElementById('wizFinish');
    if(finish) finish.addEventListener('click',function(){
      finish.setAttribute('disabled','');
      var dataAdapter = window.ErpSystemData || window.ErpSystemDemo;
      var run = (dataAdapter && dataAdapter.completeSetup)
        ? dataAdapter.completeSetup({
            masterName:S.masterName, organizationCode:S.organizationCode, setupToken:S.setupToken, companyName:S.companyName, country:S.country,
            adminName:S.adminName, adminUsername:S.adminUsername, adminEmail:S.adminEmail, adminPassword:S.adminPassword, language:S.lang,
          })
        : Promise.reject(new Error('ERP data adapter is not ready yet — wait a moment and try again.'));
      run.then(function(){
        try{ localStorage.setItem('aria-lang', S.lang); }catch{}
        markSetupWizardComplete();
        if(typeof toast==='function') toast(s('finished'),'ok');
        setTimeout(function(){ location.reload(); }, 350);
      }).catch(function(e){
        finish.removeAttribute('disabled');
        var msg=(e&&e.message)?e.message:String(e);
        if(typeof toast==='function') toast(msg,'danger');
      });
    });
  }

  render();
}
