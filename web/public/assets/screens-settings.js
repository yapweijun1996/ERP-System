/* ============================================================
   ARIA ERP — canonical settings

   The account and session panels only render data returned by the formal
   ErpSystemData session contract. Appearance preferences are intentionally
   device-local and apply immediately. Unsupported account/security writes
   are not simulated.
   ============================================================ */
SCREENS['settings'] = async function(root, params){
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.session!=='function'){
    throw new Error('ERP data adapter is not available.');
  }

  const rawSession=await adapter.session();
  if(!rawSession) throw new Error('Your session is no longer available. Sign in again.');

  const apiMode=typeof window.erpDataMode==='function'&&window.erpDataMode()==='api';
  const sessionUser=rawSession.user||rawSession;
  const scope=rawSession.scope||{
    masterFn:rawSession.masterFn,
    companyFn:rawSession.activeCompanyFn,
  };
  const currentCompanyFn=scope.companyFn||rawSession.activeCompanyFn||
    (DB.erpSystem&&DB.erpSystem.scope&&DB.erpSystem.scope.companyFn);
  const companies=(DB.erpSystem&&Array.isArray(DB.erpSystem.companies))
    ? DB.erpSystem.companies : [];
  const currentCompany=companies.find(c=>
    (c.companyFn||c.company_fn)===currentCompanyFn
  );
  const userName=sessionUser.fullName||sessionUser.name||DB.user.name||sessionUser.email;
  const userEmail=sessionUser.email||DB.user.email||'';
  const userRole=DB.user.role||'Signed in';
  const userAvatarSrc=sessionUser.avatarUrl||sessionUser.imageUrl||sessionUser.photoUrl||'';
  const companyName=(currentCompany&&currentCompany.name)||DB.company.name;
  const companyCurrency=(currentCompany&&currentCompany.currency)||DB.company.currency||'—';
  const lang=typeof getLang==='function'?getLang():'en';

  const COPY={
    en:{
      title:'Settings', subtitle:'Account context and preferences for this device',
      rail:'Settings', profile:'Account', appearance:'Appearance',
      localization:'Language & region', security:'Current session', demo:'Demo data',
      verified:'Session verified', fullName:'Full name', workEmail:'Work email',
      access:'Access', company:'Active company', companyDesc:'Controlled by your authenticated session.',
      theme:'Theme', themeDesc:'Applied immediately and stored only in this browser.',
      light:'Light', dark:'Dark', palette:'Colour palette',
      paletteDesc:'A device preference used throughout the application.',
      accent:'Accent colour', accentDesc:'Used for links, highlights and active states.',
      sidebar:'Sidebar', sidebarDesc:'Expanded or collapsed on this device.',
      expanded:'Expanded', collapsed:'Collapsed', density:'Density',
      densityDesc:'Comfortable or compact spacing on this device.',
      comfortable:'Comfortable', compact:'Compact', textSize:'Text size',
      textSizeDesc:'Five browser-local text scales.', small:'Small', normal:'Default',
      large:'Large', larger:'Larger', largest:'Largest',
      language:'Interface language', languageDesc:'Stored in this browser until account language preferences are available.',
      timeZone:'Browser time zone', currency:'Company currency',
      mode:'Data mode', scope:'Tenant scope', signedInAs:'Signed in as',
      sessionDesc:'This is the authenticated session currently used by the application.',
      signOut:'Sign out', deviceOnly:'Device preferences · applied and saved immediately',
      reset:'Reset device preferences', resetConfirm:'Reset appearance preferences on this device?',
      resetDone:'Device preferences reset', dataSource:'Data source',
      pgliteInfo:'PGlite · in-browser PostgreSQL persisted to IndexedDB',
      fallbackInfo:'Static fallback · PGlite unavailable in this session',
      rerunWizard:'Re-run setup wizard',
      rerunWizardDesc:'Replay setup screens without changing existing demo data.',
      rerunWizardConfirm:'Re-run the setup wizard? Existing demo data is kept.',
      rerunWizardToast:'Reloading into the setup wizard…',
      resetDemo:'Reset demo data',
      resetDemoDesc:'Drop and reseed the canonical browser demo database.',
      resetDemoConfirm:'Reset demo data? The browser database will be dropped and reseeded.',
      resetting:'Resetting demo data…', adapterMissing:'Demo reset is unavailable.',
      paletteApplied:'palette applied',
    },
    ms:{
      title:'Tetapan', subtitle:'Konteks akaun dan keutamaan untuk peranti ini',
      rail:'Tetapan', profile:'Akaun', appearance:'Penampilan',
      localization:'Bahasa & rantau', security:'Sesi semasa', demo:'Data demo',
      verified:'Sesi disahkan', fullName:'Nama penuh', workEmail:'E-mel kerja',
      access:'Akses', company:'Syarikat aktif', companyDesc:'Dikawal oleh sesi disahkan anda.',
      theme:'Tema', themeDesc:'Digunakan serta-merta dan disimpan dalam pelayar ini sahaja.',
      light:'Cerah', dark:'Gelap', palette:'Palet warna',
      paletteDesc:'Keutamaan peranti yang digunakan di seluruh aplikasi.',
      accent:'Warna aksen', accentDesc:'Digunakan untuk pautan, sorotan dan keadaan aktif.',
      sidebar:'Bar sisi', sidebarDesc:'Dibuka atau diringkaskan pada peranti ini.',
      expanded:'Dibuka', collapsed:'Diringkaskan', density:'Ketumpatan',
      densityDesc:'Jarak selesa atau padat pada peranti ini.',
      comfortable:'Selesa', compact:'Padat', textSize:'Saiz teks',
      textSizeDesc:'Lima skala teks setempat pelayar.', small:'Kecil', normal:'Lalai',
      large:'Besar', larger:'Lebih besar', largest:'Terbesar',
      language:'Bahasa antara muka', languageDesc:'Disimpan dalam pelayar ini sehingga keutamaan bahasa akaun tersedia.',
      timeZone:'Zon masa pelayar', currency:'Mata wang syarikat',
      mode:'Mod data', scope:'Skop penyewa', signedInAs:'Log masuk sebagai',
      sessionDesc:'Ini ialah sesi disahkan yang sedang digunakan oleh aplikasi.',
      signOut:'Log keluar', deviceOnly:'Keutamaan peranti · digunakan dan disimpan serta-merta',
      reset:'Tetapkan semula keutamaan peranti', resetConfirm:'Tetapkan semula keutamaan penampilan pada peranti ini?',
      resetDone:'Keutamaan peranti ditetapkan semula', dataSource:'Sumber data',
      pgliteInfo:'PGlite · PostgreSQL dalam pelayar disimpan ke IndexedDB',
      fallbackInfo:'Sandaran statik · PGlite tidak tersedia dalam sesi ini',
      rerunWizard:'Jalankan semula wizard persediaan',
      rerunWizardDesc:'Mainkan semula skrin persediaan tanpa mengubah data demo.',
      rerunWizardConfirm:'Jalankan semula wizard persediaan? Data demo dikekalkan.',
      rerunWizardToast:'Memuat semula ke wizard persediaan…',
      resetDemo:'Tetapkan semula data demo',
      resetDemoDesc:'Gugur dan tanam semula pangkalan data demo pelayar.',
      resetDemoConfirm:'Tetapkan semula data demo? Pangkalan data pelayar akan digugur dan ditanam semula.',
      resetting:'Menetapkan semula data demo…', adapterMissing:'Tetapan semula demo tidak tersedia.',
      paletteApplied:'palet digunakan',
    },
    zh:{
      title:'设置', subtitle:'此设备的账户环境与偏好设置',
      rail:'设置', profile:'账户', appearance:'外观',
      localization:'语言与地区', security:'当前会话', demo:'演示数据',
      verified:'会话已验证', fullName:'姓名', workEmail:'工作邮箱',
      access:'访问身份', company:'当前公司', companyDesc:'由您已验证的登录会话控制。',
      theme:'主题', themeDesc:'立即生效，仅保存在此浏览器。',
      light:'浅色', dark:'深色', palette:'配色方案',
      paletteDesc:'应用于整个系统的本机偏好。',
      accent:'强调色', accentDesc:'用于链接、高亮和活动状态。',
      sidebar:'侧栏', sidebarDesc:'在此设备展开或收起。',
      expanded:'展开', collapsed:'收起', density:'显示密度',
      densityDesc:'在此设备使用舒适或紧凑间距。',
      comfortable:'舒适', compact:'紧凑', textSize:'文字大小',
      textSizeDesc:'五级浏览器本机文字比例。', small:'小', normal:'默认',
      large:'大', larger:'较大', largest:'最大',
      language:'界面语言', languageDesc:'暂存于此浏览器，直到账户语言偏好功能上线。',
      timeZone:'浏览器时区', currency:'公司币种',
      mode:'数据模式', scope:'租户范围', signedInAs:'当前账户',
      sessionDesc:'这是系统当前正在使用的真实验证会话。',
      signOut:'退出登录', deviceOnly:'设备偏好 · 立即应用并保存',
      reset:'重置设备偏好', resetConfirm:'重置此设备的外观偏好吗？',
      resetDone:'设备偏好已重置', dataSource:'数据来源',
      pgliteInfo:'PGlite · 浏览器内 PostgreSQL，持久化到 IndexedDB',
      fallbackInfo:'静态备用 · 此会话无法使用 PGlite',
      rerunWizard:'重新运行设置向导',
      rerunWizardDesc:'重播设置画面，不更改现有演示数据。',
      rerunWizardConfirm:'重新运行设置向导？现有演示数据会保留。',
      rerunWizardToast:'正在重新载入设置向导…',
      resetDemo:'重置演示数据',
      resetDemoDesc:'删除并重新植入标准浏览器演示数据库。',
      resetDemoConfirm:'重置演示数据？浏览器数据库将被删除并重新植入。',
      resetting:'正在重置演示数据…', adapterMissing:'无法重置演示数据。',
      paletteApplied:'配色已应用',
    },

    "ja":{
      "title": "設定",
      "subtitle": "このデバイスのアカウント コンテキストと設定",
      "rail": "設定",
      "profile": "アカウント",
      "appearance": "外観",
      "localization": "言語と地域",
      "security": "現在のセッション",
      "demo": "デモデータ",
      "verified": "セッションが検証されました",
      "fullName": "フルネーム",
      "workEmail": "仕事用メール",
      "access": "アクセス",
      "company": "活動中の企業",
      "companyDesc": "認証されたセッションによって制御されます。",
      "theme": "テーマ",
      "themeDesc": "すぐに適用され、このブラウザーにのみ保存されます。",
      "light": "ライト",
      "dark": "暗い",
      "palette": "カラーパレット",
      "paletteDesc": "アプリケーション全体で使用されるデバイス設定。",
      "accent": "アクセントカラー",
      "accentDesc": "リンク、ハイライト、アクティブ状態に使用されます。",
      "sidebar": "サイドバー",
      "sidebarDesc": "このデバイスでは展開または折りたたまれています。",
      "expanded": "拡張された",
      "collapsed": "崩壊した",
      "density": "密度",
      "densityDesc": "このデバイスの快適またはコンパクトな間隔。",
      "comfortable": "快適",
      "compact": "コンパクト",
      "textSize": "文字サイズ",
      "textSizeDesc": "5 つのブラウザー ローカル テキスト スケール。",
      "small": "小さい",
      "normal": "デフォルト",
      "large": "大きい",
      "larger": "より大きな",
      "largest": "最大",
      "language": "インターフェース言語",
      "languageDesc": "アカウントの言語設定が利用可能になるまで、このブラウザに保存されます。",
      "timeZone": "ブラウザのタイムゾーン",
      "currency": "会社通貨",
      "mode": "データモード",
      "scope": "テナントの範囲",
      "signedInAs": "としてサインインしました",
      "sessionDesc": "これは、アプリケーションが現在使用している認証済みセッションです。",
      "signOut": "サインアウト",
      "deviceOnly": "デバイス設定 · すぐに適用され、保存されます",
      "reset": "デバイス設定をリセットする",
      "resetConfirm": "このデバイスの外観設定をリセットしますか?",
      "resetDone": "デバイス設定のリセット",
      "dataSource": "データソース",
      "pgliteInfo": "PGlite · IndexedDB に永続化されたブラウザ内 PostgreSQL",
      "fallbackInfo": "静的フォールバック · このセッションでは PGlite は使用できません",
      "rerunWizard": "セットアップウィザードを再実行する",
      "rerunWizardDesc": "既存のデモ データを変更せずにセットアップ画面を再生します。",
      "rerunWizardConfirm": "セットアップ ウィザードを再実行しますか?既存のデモ データは保持されます。",
      "rerunWizardToast": "セットアップ ウィザードをリロードしています…",
      "resetDemo": "デモデータをリセットする",
      "resetDemoDesc": "正規のブラウザ デモ データベースを削除して再シードします。",
      "resetDemoConfirm": "デモデータをリセットしますか?ブラウザ データベースは削除され、再シードされます。",
      "resetting": "デモデータをリセットしています…",
      "adapterMissing": "デモリセットは利用できません。",
      "paletteApplied": "パレットが適用されました"
    },
    "vi":{
      "title": "Cài đặt",
      "subtitle": "Bối cảnh tài khoản và tùy chọn cho thiết bị này",
      "rail": "Cài đặt",
      "profile": "Tài khoản",
      "appearance": "Vẻ bề ngoài",
      "localization": "Ngôn ngữ & khu vực",
      "security": "Phiên hiện tại",
      "demo": "Dữ liệu demo",
      "verified": "Đã xác minh phiên",
      "fullName": "Tên đầy đủ",
      "workEmail": "Email công việc",
      "access": "Truy cập",
      "company": "Công ty đang hoạt động",
      "companyDesc": "Kiểm soát bởi phiên xác thực của bạn.",
      "theme": "chủ đề",
      "themeDesc": "Áp dụng ngay lập tức và chỉ được lưu trữ trong trình duyệt này.",
      "light": "Ánh sáng",
      "dark": "Tối tăm",
      "palette": "Bảng màu",
      "paletteDesc": "Tùy chọn thiết bị được sử dụng trong suốt ứng dụng.",
      "accent": "Màu nhấn",
      "accentDesc": "Được sử dụng cho các liên kết, điểm nổi bật và trạng thái hoạt động.",
      "sidebar": "Thanh bên",
      "sidebarDesc": "Đã mở rộng hoặc thu gọn trên thiết bị này.",
      "expanded": "Đã mở rộng",
      "collapsed": "Đã thu gọn",
      "density": "Tỉ trọng",
      "densityDesc": "Khoảng cách thoải mái hoặc nhỏ gọn trên thiết bị này.",
      "comfortable": "Thoải mái",
      "compact": "Nhỏ gọn",
      "textSize": "Kích thước văn bản",
      "textSizeDesc": "Năm thang đo văn bản cục bộ của trình duyệt.",
      "small": "Bé nhỏ",
      "normal": "Mặc định",
      "large": "Lớn",
      "larger": "lớn hơn",
      "largest": "lớn nhất",
      "language": "Ngôn ngữ giao diện",
      "languageDesc": "Được lưu trữ trong trình duyệt này cho đến khi có tùy chọn ngôn ngữ tài khoản.",
      "timeZone": "Múi giờ của trình duyệt",
      "currency": "Tiền tệ của công ty",
      "mode": "Chế độ dữ liệu",
      "scope": "phạm vi người thuê nhà",
      "signedInAs": "Đã đăng nhập với tư cách",
      "sessionDesc": "Đây là phiên xác thực hiện đang được ứng dụng sử dụng.",
      "signOut": "Đăng xuất",
      "deviceOnly": "Tùy chọn thiết bị · được áp dụng và lưu ngay lập tức",
      "reset": "Đặt lại tùy chọn thiết bị",
      "resetConfirm": "Đặt lại tùy chọn giao diện trên thiết bị này?",
      "resetDone": "Đặt lại tùy chọn thiết bị",
      "dataSource": "Nguồn dữ liệu",
      "pgliteInfo": "PGlite · PostgreSQL trong trình duyệt vẫn tồn tại ở IndexedDB",
      "fallbackInfo": "Dự phòng tĩnh · PGlite không có sẵn trong phiên này",
      "rerunWizard": "Chạy lại trình hướng dẫn thiết lập",
      "rerunWizardDesc": "Phát lại màn hình thiết lập mà không thay đổi dữ liệu demo hiện có.",
      "rerunWizardConfirm": "Chạy lại trình hướng dẫn thiết lập? Dữ liệu demo hiện có được lưu giữ.",
      "rerunWizardToast": "Đang tải lại vào trình hướng dẫn thiết lập…",
      "resetDemo": "Đặt lại dữ liệu demo",
      "resetDemoDesc": "Thả và khởi tạo lại cơ sở dữ liệu demo trình duyệt chuẩn.",
      "resetDemoConfirm": "Đặt lại dữ liệu demo? Cơ sở dữ liệu trình duyệt sẽ bị loại bỏ và gieo hạt lại.",
      "resetting": "Đang đặt lại dữ liệu demo…",
      "adapterMissing": "Đặt lại bản demo không có sẵn.",
      "paletteApplied": "bảng màu được áp dụng"
    },};
  const copy=i18nLegacy(COPY);
  const s=key=>copy[key]||COPY.en[key]||key;
  const row=(title,desc,control,top=false)=>`<div class="set-row${top?' top':''}">
    <div class="set-row-t"><b>${esc(title)}</b>${desc?`<small>${esc(desc)}</small>`:''}</div>
    <div class="set-row-c">${control}</div></div>`;
  const seg=(group,options,current)=>`<div class="seg" data-seg="${group}">${options.map(option=>
    `<button data-v="${esc(option[0])}" class="${option[0]===current?'on':''}">${esc(option[1])}</button>`
  ).join('')}</div>`;
  const panel=(id,icon,title,content)=>`<section class="set-sec" id="${id}"><div class="panel">
    <div class="panel-h">${ic(icon)}<h3>${esc(title)}</h3></div>${content}</div></section>`;
  const readonlyField=(label,value)=>`<div class="fld"><span>${esc(label)}</span>
    <input value="${esc(value==null?'—':String(value))}" readonly aria-readonly="true"></div>`;

  let storedTheme=document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';
  let storedTextSize='1';
  let storedAccent='#0071E3';
  let storedPalette='';
  try{
    storedTextSize=localStorage.getItem('aria-textsize')||'1';
    storedAccent=localStorage.getItem('aria-accent')||'#0071E3';
    storedPalette=localStorage.getItem('aria-palette')||'';
  }catch{}
  const storedSidebar=$('#app').classList.contains('nav-collapsed')?'collapsed':'expanded';
  const storedDensity=document.documentElement.getAttribute('data-density')==='compact'?'compact':'comfortable';
  const accents=[
    ['#0071E3','Blue'],['#5E5CE6','Indigo'],['#0a7d8c','Teal'],
    ['#1f9d57','Green'],['#FF9500','Amber'],['#FF375F','Pink'],
  ];
  const palettes=[
    ['Aria','#0071E3',['#0071E3','#5E5CE6','#0a7d8c']],
    ['Slate','#5b6472',['#5b6472','#8a94a6','#0071E3']],
    ['Forest','#1f9d57',['#1f9d57','#0a7d8c','#34C759']],
    ['Sunset','#FF375F',['#FF375F','#FF9500','#FF2D55']],
    ['Royal','#5E5CE6',['#5E5CE6','#7d5cff','#0071E3']],
    ['Amber','#FF9500',['#FF9500','#FFB340','#FF375F']],
  ];

  const profile=panel('set-profile','user',s('profile'),`
    <div class="set-row top">
      <div class="set-row-t" style="display:flex;gap:16px;align-items:center">
        ${profileAvatar({name:userName,src:userAvatarSrc,cls:'set-avatar',size:62})}
        <div><b style="font-size:15px">${esc(userName)}</b>
          <small style="margin-top:3px">${esc(userRole)} · ${esc(companyName)}</small></div>
      </div>
      <div class="set-row-c">${cap(s('verified'),'ok')}</div>
    </div>
    <div class="set-grid">
      ${readonlyField(s('fullName'),userName)}
      ${readonlyField(s('workEmail'),userEmail)}
      ${readonlyField(s('access'),userRole)}
      ${readonlyField(s('company'),companyName)}
    </div>`);

  const appearance=panel('set-appearance','sun',s('appearance'),`
    ${row(s('theme'),s('themeDesc'),seg('theme',[
      ['light',s('light')],['dark',s('dark')],
    ],storedTheme))}
    ${row(s('palette'),s('paletteDesc'),`<div class="set-palettes">${palettes.map(p=>
      `<button class="set-pal ${p[0]===storedPalette?'on':''}" data-c="${p[1]}" data-name="${p[0]}" aria-label="${p[0]}">
        <span class="set-pal-sw">${p[2].map(c=>`<i style="background:${c}"></i>`).join('')}</span>
        <span class="set-pal-l">${p[0]}</span></button>`
    ).join('')}</div>`)}
    ${row(s('accent'),s('accentDesc'),`<div class="set-swatches">${accents.map(a=>
      `<button class="set-sw ${a[0]===storedAccent?'on':''}" data-c="${a[0]}" style="background:${a[0]}" aria-label="${a[1]}"></button>`
    ).join('')}</div>`)}
    ${row(s('sidebar'),s('sidebarDesc'),seg('sidebar',[
      ['expanded',s('expanded')],['collapsed',s('collapsed')],
    ],storedSidebar))}
    ${row(s('density'),s('densityDesc'),seg('density',[
      ['comfortable',s('comfortable')],['compact',s('compact')],
    ],storedDensity))}
    ${row(s('textSize'),s('textSizeDesc'),seg('textsize',[
      ['0.9',s('small')],['1',s('normal')],['1.12',s('large')],
      ['1.25',s('larger')],['1.4',s('largest')],
    ],storedTextSize))}`);

  const languageOptions=(typeof I18N_LANGS!=='undefined'?I18N_LANGS:[])
    .map(item=>[item.code,item.native]);
  const browserTimeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'—';
  const localization=panel('set-localization','location',s('localization'),`
    ${row(s('language'),s('languageDesc'),seg('language',languageOptions,lang))}
    ${row(s('timeZone'),'',cap(browserTimeZone,'accent'))}
    ${row(s('currency'),'',cap(companyCurrency,'accent'))}`);

  const modeLabel=apiMode?'Production API':
    (DB.erpSystem&&DB.erpSystem.dataMode==='pglite'?'PGlite demo':'Static demo');
  const scopeLabel=[scope.masterFn,currentCompanyFn].filter(Boolean).join(' / ')||'—';
  const security=panel('set-security','lock',s('security'),`
    ${row(s('signedInAs'),s('sessionDesc'),`<span>${esc(userEmail)}</span>`,true)}
    ${row(s('mode'),'',cap(modeLabel,apiMode?'ok':'accent'))}
    ${row(s('scope'),'',`<span>${esc(scopeLabel)}</span>`)}
    ${row(s('company'),s('companyDesc'),`<span>${esc(companyName)}</span>`)}
    <div class="set-row"><div class="grow"></div>
      ${btn(s('signOut'),{icon:'signout',cls:'soft',attrs:'data-act="signout"'})}
    </div>`);

  let demoData='';
  if(!apiMode){
    const pglite=DB.erpSystem&&DB.erpSystem.dataMode==='pglite';
    demoData=panel('set-demo','box',s('demo'),`
      ${row(s('dataSource'),pglite?s('pgliteInfo'):s('fallbackInfo'),cap(pglite?'PGlite':'Fallback',pglite?'ok':'warn'))}
      ${row(s('rerunWizard'),s('rerunWizardDesc'),btn(s('rerunWizard'),{icon:'flag',cls:'soft',attrs:'data-act="rerun-wizard"'}))}
      ${row(s('resetDemo'),s('resetDemoDesc'),btn(s('resetDemo'),{icon:'refresh',cls:'soft',attrs:'data-act="demo-reset"'}))}`);
  }

  const railItems=[
    ['set-profile','user',s('profile')],
    ['set-appearance','sun',s('appearance')],
    ['set-localization','location',s('localization')],
    ['set-security','lock',s('security')],
  ];
  if(!apiMode) railItems.push(['set-demo','box',s('demo')]);

  root.innerHTML=`<div class="content full"><section class="master" data-screen-label="Settings">
    <div class="pagehead">${crumbs([companyName,s('title')])}
      <div class="h1row"><h1>${esc(s('title'))}</h1></div>
      <p style="margin:6px 0 0;color:var(--muted);font-size:13px">${esc(s('subtitle'))} · ${esc(userEmail)}</p>
    </div>
    <div class="set-body">
      <nav class="set-rail" aria-label="${esc(s('rail'))}">
        <div class="set-railhead">${esc(s('rail'))}</div>
        ${railItems.map((item,index)=>`<button class="set-navitem ${index===0?'on':''}" data-target="${item[0]}">
          ${ic(item[1])}<span>${esc(item[2])}</span></button>`).join('')}
      </nav>
      <div class="set-scroll"><div class="set-page">
        ${profile}${appearance}${localization}${security}${demoData}
      </div></div>
    </div>
    <div class="set-savebar">
      <div class="hideonsmall" style="font-size:12.5px;color:var(--muted)">${esc(s('deviceOnly'))}</div>
      <div class="grow"></div>
      ${btn(s('reset'),{icon:'refresh',cls:'soft',attrs:'data-act="reset-device"'})}
    </div>
  </section></div>`;

  const scroller=root.querySelector('.set-scroll');
  const sections=[...root.querySelectorAll('.set-sec')];
  const navItems=[...root.querySelectorAll('.set-navitem')];
  const topOf=element=>element.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
  function spy(){
    const scrollTop=scroller.scrollTop+40;
    let current=sections[0]&&sections[0].id;
    sections.forEach(section=>{ if(topOf(section)<=scrollTop) current=section.id; });
    navItems.forEach(item=>item.classList.toggle('on',item.dataset.target===current));
  }
  scroller.addEventListener('scroll',spy);
  navItems.forEach(item=>item.addEventListener('click',()=>{
    const section=root.querySelector('#'+item.dataset.target);
    if(section) scroller.scrollTop=Math.max(0,topOf(section)-8);
  }));

  root.querySelectorAll('.seg[data-seg]').forEach(control=>{
    control.querySelectorAll('button').forEach(button=>button.addEventListener('click',async()=>{
      const group=control.dataset.seg;
      const value=button.dataset.v;
      if(group==='language'){
        if(typeof setLang==='function') await setLang(value);
        return;
      }
      control.querySelectorAll('button').forEach(item=>item.classList.toggle('on',item===button));
      if(group==='theme') applyTheme(value);
      else if(group==='sidebar') setNavCollapsed(value==='collapsed',true);
      else if(group==='density'){
        document.documentElement.setAttribute('data-density',value==='compact'?'compact':'default');
        try{ localStorage.setItem('aria-density',value); }catch{}
      }else if(group==='textsize'){
        if(value==='1') document.documentElement.style.removeProperty('--fs');
        else document.documentElement.style.setProperty('--fs',value);
        try{ localStorage.setItem('aria-textsize',value); }catch{}
      }
    }));
  });

  function applyAccent(colour){
    document.documentElement.style.setProperty('--accent',colour);
    document.documentElement.style.setProperty('--accent-tint','color-mix(in srgb, '+colour+' 14%, transparent)');
    try{ localStorage.setItem('aria-accent',colour); }catch{}
    root.querySelectorAll('.set-sw').forEach(item=>item.classList.toggle('on',item.dataset.c===colour));
  }
  root.querySelectorAll('.set-pal').forEach(palette=>palette.addEventListener('click',()=>{
    root.querySelectorAll('.set-pal').forEach(item=>item.classList.toggle('on',item===palette));
    applyAccent(palette.dataset.c);
    try{ localStorage.setItem('aria-palette',palette.dataset.name); }catch{}
    toast(palette.dataset.name+' '+s('paletteApplied'),'ok');
  }));
  root.querySelectorAll('.set-sw').forEach(swatch=>swatch.addEventListener('click',()=>{
    root.querySelectorAll('.set-pal').forEach(item=>item.classList.remove('on'));
    try{ localStorage.removeItem('aria-palette'); }catch{}
    applyAccent(swatch.dataset.c);
  }));

  root.querySelector('[data-act="signout"]')?.addEventListener('click',()=>signOutDemo());
  root.querySelector('[data-act="reset-device"]')?.addEventListener('click',()=>{
    if(!confirm(s('resetConfirm'))) return;
    [
      'aria-theme','aria-nav','aria-density','aria-textsize',
      'aria-accent','aria-palette',
    ].forEach(key=>{ try{ localStorage.removeItem(key); }catch{} });
    toast(s('resetDone'),'ok');
    setTimeout(()=>location.reload(),250);
  });
  root.querySelector('[data-act="demo-reset"]')?.addEventListener('click',async()=>{
    if(!adapter||typeof adapter.reset!=='function'){
      toast(s('adapterMissing'),'warn');
      return;
    }
    if(!confirm(s('resetDemoConfirm'))) return;
    toast(s('resetting'),'info');
    try{ await adapter.reset(); }
    catch(error){ toast(error&&error.message||s('adapterMissing'),'warn'); }
  });
  root.querySelector('[data-act="rerun-wizard"]')?.addEventListener('click',()=>{
    if(!confirm(s('rerunWizardConfirm'))) return;
    if(typeof clearSetupWizardFlag==='function') clearSetupWizardFlag();
    toast(s('rerunWizardToast'),'info');
    setTimeout(()=>location.reload(),300);
  });

  spy();
  if(params&&params.section){
    const item=navItems.find(candidate=>candidate.dataset.target===params.section);
    const section=item&&root.querySelector('#'+params.section);
    if(section) scroller.scrollTop=Math.max(0,topOf(section)-8);
  }
};
