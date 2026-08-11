/* ============================================================
   ARIA ERP — canonical integration and tenant control plane
   ============================================================ */

function controlPlaneCopy(){
  const packs={
    en:{loading:'Loading canonical data…',loadError:'Could not load canonical data.',retry:'Retry',all:'All',active:'Active',attention:'Attention',configured:'Configured',records:'Records processed',connector:'Connector',direction:'Direction',schedule:'Schedule',lastCheck:'Last check',status:'Status',actions:'Actions',check:'Check health',pause:'Pause',resume:'Resume',configure:'Configure',logs:'Delivery log',imports:'Data import',integration:'Integrations',integrationSub:'Manage the active company’s connector registry. Secrets are encrypted by the production server and are never returned to the browser.',noConnectors:'No connectors are registered for this company.',secretBoundary:'Credential boundary',secretHelp:'Production credentials are encrypted with AES-GCM. Offline Demo never stores connector secrets.',credential:'Credential',label:'Credential label',endpoint:'Endpoint hostname',save:'Save configuration',cancel:'Cancel',demoSecret:'Offline Demo does not store secrets. Use API mode to configure credentials.',saved:'Connector configuration saved.',tenant:'Tenant control',tenantSub:'Current-session tenant facts only. Cross-tenant data is never exposed.',companies:'Companies',users:'Active company users',roles:'Roles',modules:'Modules',company:'Company',country:'Country',currency:'Currency',tax:'Tax regime',userCount:'Users',current:'Current',user:'User',role:'Role',access:'Company access',enabled:'Enabled',disabled:'Disabled',manageUsers:'Manage users',manageRoles:'Manage roles',manageModules:'Manage modules',settings:'System settings',settingsSub:'Audited company policy, document sequences, effective-dated tax rules and accounting periods.',general:'Company policy',dateFormat:'Date format',negativeStock:'Negative stock',block:'Block',warn:'Allow with warning',threshold:'Approval threshold',timeout:'Session timeout (minutes)',warehouse:'Default warehouse',saveSettings:'Save settings',sequences:'Document sequences',document:'Document',employeeNumber:'Employee number',employeeSequenceHelp:'Employee numbers are generated server-side. The prefix and yearly/monthly reset policy apply only to new employees; existing employee numbers never change.',prefix:'Prefix',next:'Next number',padding:'Padding',reset:'Reset',edit:'Edit',taxRules:'Tax rules',code:'Code',rate:'Rate',validFrom:'Valid from',validTo:'Valid to',periods:'Accounting periods',period:'Period',dates:'Dates',lock:'Lock',reopen:'Reopen',open:'Open',locked:'Locked',currencies:'Currencies',companyFacts:'Company facts',policySaved:'Company policy saved.',sequenceSaved:'Document sequence saved.',periodSaved:'Accounting period updated.',noData:'No canonical records exist yet.'},
    zh:{loading:'正在加载真实数据…',loadError:'无法加载真实数据。',retry:'重试',all:'全部',active:'运行中',attention:'需处理',configured:'已配置',records:'已处理记录',connector:'连接器',direction:'方向',schedule:'计划',lastCheck:'最近检查',status:'状态',actions:'操作',check:'健康检查',pause:'暂停',resume:'恢复',configure:'配置',logs:'投递日志',imports:'数据导入',integration:'集成',integrationSub:'管理当前公司的连接器注册表。凭据只由生产服务端加密，浏览器永远不会收到密文或明文。',noConnectors:'当前公司尚未注册连接器。',secretBoundary:'凭据边界',secretHelp:'生产凭据使用 AES-GCM 加密。离线 Demo 不保存连接器密钥。',credential:'凭据',label:'凭据标签',endpoint:'端点主机名',save:'保存配置',cancel:'取消',demoSecret:'离线 Demo 不保存密钥。请切换到 API 模式配置凭据。',saved:'连接器配置已保存。',tenant:'租户控制',tenantSub:'只显示当前 Session 的租户事实；绝不暴露跨租户数据。',companies:'公司',users:'当前公司用户',roles:'角色',modules:'模块',company:'公司',country:'国家/地区',currency:'币种',tax:'税制',userCount:'用户',current:'当前',user:'用户',role:'角色',access:'公司权限',enabled:'已启用',disabled:'已停用',manageUsers:'管理用户',manageRoles:'管理角色',manageModules:'管理模块',settings:'系统设置',settingsSub:'可审计的公司政策、单据序列、有效期税务规则与会计期间。',general:'公司政策',dateFormat:'日期格式',negativeStock:'负库存',block:'阻止',warn:'允许并警告',threshold:'审批门槛',timeout:'Session 超时（分钟）',warehouse:'默认仓库',saveSettings:'保存设置',sequences:'单据序列',document:'单据',employeeNumber:'员工编号',employeeSequenceHelp:'员工编号由服务端生成。前缀及年度/月份重置规则只影响新员工，已有员工编号不会改变。',prefix:'前缀',next:'下一个号码',padding:'补零位数',reset:'重置',edit:'编辑',taxRules:'税务规则',code:'代码',rate:'税率',validFrom:'生效日期',validTo:'失效日期',periods:'会计期间',period:'期间',dates:'日期',lock:'锁定',reopen:'重新开放',open:'开放',locked:'已锁定',currencies:'币种',companyFacts:'公司资料',policySaved:'公司政策已保存。',sequenceSaved:'单据序列已保存。',periodSaved:'会计期间已更新。',noData:'尚无真实记录。'},
    ms:{
  "loading": "Memuatkan data kanonik…",
  "loadError": "Data kanonik tidak dapat dimuatkan.",
  "retry": "Cuba lagi",
  "all": "Semua",
  "active": "Aktif",
  "attention": "Perlu perhatian",
  "configured": "Dikonfigurasi",
  "records": "Rekod diproses",
  "connector": "Penyambung",
  "direction": "Arah",
  "schedule": "Jadual",
  "lastCheck": "Semakan terakhir",
  "status": "Status",
  "actions": "Tindakan",
  "check": "Semak kesihatan",
  "pause": "Jeda",
  "resume": "Sambung",
  "configure": "Konfigurasi",
  "logs": "Log penghantaran",
  "imports": "Import data",
  "integration": "Integrasi",
  "integrationSub": "Urus daftar penyambung syarikat aktif. Rahsia disulitkan oleh pelayan produksi dan tidak dikembalikan kepada pelayar.",
  "noConnectors": "Tiada penyambung didaftarkan untuk syarikat ini.",
  "secretBoundary": "Sempadan kelayakan",
  "secretHelp": "Kelayakan produksi disulitkan dengan AES-GCM. Demo luar talian tidak menyimpan rahsia.",
  "credential": "Kelayakan",
  "label": "Label kelayakan",
  "endpoint": "Nama hos titik akhir",
  "save": "Simpan konfigurasi",
  "cancel": "Batal",
  "demoSecret": "Demo luar talian tidak menyimpan rahsia. Gunakan mod API.",
  "saved": "Konfigurasi penyambung disimpan.",
  "tenant": "Kawalan penyewa",
  "tenantSub": "Fakta penyewa sesi semasa sahaja. Data silang penyewa tidak didedahkan.",
  "companies": "Syarikat",
  "users": "Pengguna syarikat aktif",
  "roles": "Peranan",
  "modules": "Modul",
  "company": "Syarikat",
  "country": "Negara",
  "currency": "Mata wang",
  "tax": "Rejim cukai",
  "userCount": "Pengguna",
  "current": "Semasa",
  "user": "Pengguna",
  "role": "Peranan",
  "access": "Akses syarikat",
  "enabled": "Aktif",
  "disabled": "Tidak aktif",
  "manageUsers": "Urus pengguna",
  "manageRoles": "Urus peranan",
  "manageModules": "Urus modul",
  "settings": "Tetapan sistem",
  "settingsSub": "Polisi syarikat, jujukan dokumen, cukai bertarikh dan tempoh perakaunan yang diaudit.",
  "general": "Polisi syarikat",
  "dateFormat": "Format tarikh",
  "negativeStock": "Stok negatif",
  "block": "Sekat",
  "warn": "Benarkan dengan amaran",
  "threshold": "Ambang kelulusan",
  "timeout": "Tamat sesi (minit)",
  "warehouse": "Gudang lalai",
  "saveSettings": "Simpan tetapan",
  "sequences": "Jujukan dokumen",
  "document": "Dokumen",
  "employeeNumber": "Nombor pekerja",
  "employeeSequenceHelp": "Nombor pekerja dijana oleh pelayan. Dasar awalan dan tetapan semula tahunan/bulanan hanya terpakai kepada pekerja baharu; nombor pekerja sedia ada tidak berubah.",
  "prefix": "Awalan",
  "next": "Nombor seterusnya",
  "padding": "Digit",
  "reset": "Tetapan semula",
  "edit": "Sunting",
  "taxRules": "Peraturan cukai",
  "code": "Kod",
  "rate": "Kadar",
  "validFrom": "Sah dari",
  "validTo": "Sah hingga",
  "periods": "Tempoh perakaunan",
  "period": "Tempoh",
  "dates": "Tarikh",
  "lock": "Kunci",
  "reopen": "Buka semula",
  "open": "Terbuka",
  "locked": "Dikunci",
  "currencies": "Mata wang",
  "companyFacts": "Fakta syarikat",
  "policySaved": "Polisi syarikat disimpan.",
  "sequenceSaved": "Jujukan dokumen disimpan.",
  "periodSaved": "Tempoh perakaunan dikemas kini.",
  "noData": "Belum ada rekod kanonik."
},
    ja:{loading:'標準データを読み込み中…',loadError:'標準データを読み込めません。',retry:'再試行',all:'すべて',active:'稼働中',attention:'要対応',configured:'設定済み',records:'処理済みレコード',connector:'コネクター',direction:'方向',schedule:'スケジュール',lastCheck:'最終確認',status:'ステータス',actions:'操作',check:'ヘルス確認',pause:'停止',resume:'再開',configure:'設定',logs:'配信ログ',imports:'データインポート',integration:'連携',integrationSub:'現在の会社のコネクターを管理します。シークレットは本番サーバーで暗号化され、ブラウザーへ返されません。',noConnectors:'この会社にはコネクターがありません。',secretBoundary:'認証情報の境界',secretHelp:'本番認証情報はAES-GCMで暗号化します。オフラインDemoはシークレットを保存しません。',credential:'認証情報',label:'認証情報ラベル',endpoint:'エンドポイントホスト名',save:'設定を保存',cancel:'キャンセル',demoSecret:'オフラインDemoはシークレットを保存しません。APIモードを使用してください。',saved:'コネクター設定を保存しました。',tenant:'テナント管理',tenantSub:'現在のセッションのテナント情報のみ。テナント間データは公開しません。',companies:'会社',users:'現在の会社のユーザー',roles:'ロール',modules:'モジュール',company:'会社',country:'国',currency:'通貨',tax:'税制度',userCount:'ユーザー',current:'現在',user:'ユーザー',role:'ロール',access:'会社アクセス',enabled:'有効',disabled:'無効',manageUsers:'ユーザー管理',manageRoles:'ロール管理',manageModules:'モジュール管理',settings:'システム設定',settingsSub:'監査対象の会社ポリシー、採番、期間付き税ルール、会計期間。',general:'会社ポリシー',dateFormat:'日付形式',negativeStock:'マイナス在庫',block:'禁止',warn:'警告して許可',threshold:'承認しきい値',timeout:'セッション時間（分）',warehouse:'既定倉庫',saveSettings:'設定を保存',sequences:'文書採番',document:'文書',employeeNumber:'従業員番号',employeeSequenceHelp:'従業員番号はサーバーで生成されます。接頭辞と年次・月次リセットポリシーは新規従業員にのみ適用され、既存の番号は変わりません。',prefix:'接頭辞',next:'次番号',padding:'桁数',reset:'リセット',edit:'編集',taxRules:'税ルール',code:'コード',rate:'税率',validFrom:'開始日',validTo:'終了日',periods:'会計期間',period:'期間',dates:'日付',lock:'ロック',reopen:'再開',open:'オープン',locked:'ロック済み',currencies:'通貨',companyFacts:'会社情報',policySaved:'会社ポリシーを保存しました。',sequenceSaved:'文書採番を保存しました。',periodSaved:'会計期間を更新しました。',noData:'標準レコードがありません。'},
    vi:{loading:'Đang tải dữ liệu chuẩn…',loadError:'Không thể tải dữ liệu chuẩn.',retry:'Thử lại',all:'Tất cả',active:'Hoạt động',attention:'Cần xử lý',configured:'Đã cấu hình',records:'Bản ghi đã xử lý',connector:'Trình kết nối',direction:'Hướng',schedule:'Lịch',lastCheck:'Kiểm tra gần nhất',status:'Trạng thái',actions:'Thao tác',check:'Kiểm tra sức khỏe',pause:'Tạm dừng',resume:'Tiếp tục',configure:'Cấu hình',logs:'Nhật ký chuyển phát',imports:'Nhập dữ liệu',integration:'Tích hợp',integrationSub:'Quản lý trình kết nối của công ty hiện hành. Bí mật được máy chủ sản xuất mã hóa và không trả về trình duyệt.',noConnectors:'Công ty này chưa có trình kết nối.',secretBoundary:'Ranh giới thông tin xác thực',secretHelp:'Thông tin sản xuất được mã hóa AES-GCM. Demo ngoại tuyến không lưu bí mật.',credential:'Thông tin xác thực',label:'Nhãn thông tin',endpoint:'Tên máy chủ điểm cuối',save:'Lưu cấu hình',cancel:'Hủy',demoSecret:'Demo ngoại tuyến không lưu bí mật. Hãy dùng chế độ API.',saved:'Đã lưu cấu hình trình kết nối.',tenant:'Quản lý tenant',tenantSub:'Chỉ dữ kiện tenant của phiên hiện tại. Không bao giờ lộ dữ liệu xuyên tenant.',companies:'Công ty',users:'Người dùng công ty hiện hành',roles:'Vai trò',modules:'Mô-đun',company:'Công ty',country:'Quốc gia',currency:'Tiền tệ',tax:'Chế độ thuế',userCount:'Người dùng',current:'Hiện tại',user:'Người dùng',role:'Vai trò',access:'Quyền công ty',enabled:'Bật',disabled:'Tắt',manageUsers:'Quản lý người dùng',manageRoles:'Quản lý vai trò',manageModules:'Quản lý mô-đun',settings:'Cài đặt hệ thống',settingsSub:'Chính sách công ty, chuỗi chứng từ, quy tắc thuế theo thời hạn và kỳ kế toán có kiểm toán.',general:'Chính sách công ty',dateFormat:'Định dạng ngày',negativeStock:'Tồn kho âm',block:'Chặn',warn:'Cho phép và cảnh báo',threshold:'Ngưỡng phê duyệt',timeout:'Hết phiên (phút)',warehouse:'Kho mặc định',saveSettings:'Lưu cài đặt',sequences:'Chuỗi chứng từ',document:'Chứng từ',employeeNumber:'Mã nhân viên',employeeSequenceHelp:'Mã nhân viên được máy chủ tạo. Tiền tố và chính sách đặt lại theo năm/tháng chỉ áp dụng cho nhân viên mới; mã hiện có không thay đổi.',prefix:'Tiền tố',next:'Số kế tiếp',padding:'Số chữ số',reset:'Đặt lại',edit:'Sửa',taxRules:'Quy tắc thuế',code:'Mã',rate:'Thuế suất',validFrom:'Hiệu lực từ',validTo:'Hiệu lực đến',periods:'Kỳ kế toán',period:'Kỳ',dates:'Ngày',lock:'Khóa',reopen:'Mở lại',open:'Mở',locked:'Đã khóa',currencies:'Tiền tệ',companyFacts:'Thông tin công ty',policySaved:'Đã lưu chính sách công ty.',sequenceSaved:'Đã lưu chuỗi chứng từ.',periodSaved:'Đã cập nhật kỳ kế toán.',noData:'Chưa có bản ghi chuẩn.'}
  };
  const p=i18nLegacy(packs);
  return key=>p[key]||packs.en[key]||key;
}

function controlPlaneDate(value){
  if(!value) return '—'; const d=new Date(value); if(Number.isNaN(d.getTime())) return esc(String(value));
  return new Intl.DateTimeFormat({en:'en-SG',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'}[getLang()]||'en-SG',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
function controlPlaneKey(scope){
  const nonce=globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function'?globalThis.crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
  return scope+'-'+nonce;
}
function controlPlaneError(root,route,title,sub,error){
  const c=controlPlaneCopy(); root.innerHTML=modulePage({module:ROUTE_MODULE[route],route,title,sub,body:statePanel({icon:'warn',title:c('loadError'),body:error&&error.message||c('loadError'),action:btn(c('retry'),{icon:'refresh',cls:'primary',attrs:`onclick="navigate('${route}')"`})})});
}

SCREENS['integration']=async function(root){
  const c=controlPlaneCopy(); let rows=[]; let filter='all';
  try{rows=(await listPage('integration/connectors',{limit:100})).data||[];}catch(error){controlPlaneError(root,'integration',c('integration'),c('integrationSub'),error);return;}
  const tone=s=>({connected:'ok',setup:'warn',paused:'neutral',error:'danger'}[s]||'neutral');
  const renderRows=()=>rows.filter(row=>filter==='all'||(filter==='active'?row.status==='connected':row.status!=='connected')).map(row=>`<tr data-connector="${row.id}"><td class="l li-name"><b>${esc(row.displayName)}</b><small>${esc(row.category)} · ${esc(row.connectorKey)}</small></td><td class="l">${esc(row.direction)}</td><td class="l">${esc(row.schedule)}</td><td class="tnum">${num(row.recordsProcessed||0)}</td><td class="l">${esc(controlPlaneDate(row.lastCheckedAt))}</td><td class="l">${cap(row.status,tone(row.status))}</td><td class="r"><span class="rowact"><button data-connector-act="check-health" data-tip="${esc(c('check'))}" aria-label="${esc(c('check'))}">${ic('refresh')}</button>${row.enabled?`<button data-connector-act="pause" data-tip="${esc(c('pause'))}" aria-label="${esc(c('pause'))}">${ic('pause')}</button>`:`<button data-connector-act="resume" data-tip="${esc(c('resume'))}" aria-label="${esc(c('resume'))}">${ic('play')}</button>`}<button data-connector-act="configure" data-tip="${esc(c('configure'))}" aria-label="${esc(c('configure'))}">${ic('gear')}</button></span></td></tr>`).join('');
  function draw(){
    const active=rows.filter(r=>r.status==='connected').length, attention=rows.length-active;
    const body=`<div data-canonical-integration="true"><div class="statwrap"><div class="statcards">${[[c('active'),active],[c('attention'),attention],[c('configured'),rows.filter(r=>r.credentialLabel||!r.credentialRequired).length],[c('records'),rows.reduce((n,r)=>n+Number(r.recordsProcessed||0),0)]].map(([l,v])=>`<div class="card" style="padding:13px 15px"><small style="display:block;margin-bottom:5px">${esc(l)}</small><b class="tnum" style="display:block;font-size:24px">${num(v)}</b></div>`).join('')}</div></div><div class="alert info" style="margin:0 24px 14px">${ic('shield')}<span><b>${esc(c('secretBoundary'))}</b> ${esc(c('secretHelp'))}</span></div><div class="toolbar"><div class="filterchips">${[['all',c('all')],['active',c('active')],['attention',c('attention')]].map(([k,l])=>`<button class="chip ${filter===k?'on':''}" data-cp-filter="${k}">${esc(l)}</button>`).join('')}</div><div class="grow"></div>${btn(c('logs'),{icon:'history',cls:'soft',attrs:'onclick="navigate(\'integration-logs\')"'})}${btn(c('imports'),{icon:'upload',cls:'soft',attrs:'onclick="navigate(\'data-import\')"'})}</div><div class="tablewrap"><table class="lines"><thead><tr><th class="l">${esc(c('connector'))}</th><th class="l">${esc(c('direction'))}</th><th class="l">${esc(c('schedule'))}</th><th>${esc(c('records'))}</th><th class="l">${esc(c('lastCheck'))}</th><th class="l">${esc(c('status'))}</th><th></th></tr></thead><tbody data-cp-connectors>${renderRows()||`<tr><td colspan="7">${statePanel({icon:'plug',title:c('noConnectors')})}</td></tr>`}</tbody></table></div></div>`;
    root.innerHTML=modulePage({module:'integration',route:'integration',active:'integration',title:c('integration'),sub:c('integrationSub'),count:rows.length,body}); wire();
  }
  function wire(){
    root.querySelectorAll('[data-cp-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.cpFilter;draw();}));
    root.querySelectorAll('[data-connector-act]').forEach(b=>b.addEventListener('click',async()=>{const row=b.closest('[data-connector]'), item=rows.find(r=>String(r.id)===row.dataset.connector), action=b.dataset.connectorAct;if(action==='configure'){if(window.ErpSystemData&&window.ErpSystemData.mode==='demo'){toast(c('demoSecret'),'info');return;}appModal({icon:'shield',title:c('configure')+' · '+item.displayName,body:`<div class="set-grid"><div class="fld"><span>${esc(c('credential'))}</span><input id="cpSecret" type="password" autocomplete="new-password"></div><div class="fld"><span>${esc(c('label'))}</span><input id="cpLabel" value="${esc(item.credentialLabel||'Primary credential')}"></div><div class="fld"><span>${esc(c('endpoint'))}</span><input id="cpEndpoint" value="${esc(item.endpointHost||'')}"></div></div>`,actions:`${btn(c('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c('save'),{icon:'check',cls:'primary',attrs:'data-cp-save'})}`});$('#modalEl').querySelector('[data-cp-save]').addEventListener('click',async()=>{const payload={secret:$('#cpSecret').value,label:$('#cpLabel').value,endpointHost:$('#cpEndpoint').value};closeModal();try{await window.ErpSystemData.action('integration/connectors',item.id,'configure',payload,controlPlaneKey('connector-configure'));toast(c('saved'),'ok');navigate('integration');}catch(error){toast(error.message,'danger');}});return;}b.disabled=true;try{await window.ErpSystemData.action('integration/connectors',item.id,action,{},controlPlaneKey('connector-'+action));navigate('integration');}catch(error){b.disabled=false;toast(error.message,'danger');}}));
  }
  draw();
};

SCREENS['master-control']=async function(root){
  const c=controlPlaneCopy(); let data;
  try{data=(await listPage('admin/master-control')).data;}catch(error){controlPlaneError(root,'master-control',c('tenant'),c('tenantSub'),error);return;}
  const companyRows=(data.companies||[]).map(row=>`<tr><td class="l li-name"><b>${esc(row.name)}</b><small>${esc(row.companyFn)}</small></td><td class="l">${esc(row.country)}</td><td class="l">${esc(row.currency)}</td><td class="l">${esc(row.taxRegime)}</td><td class="tnum">${num(row.userCount)}</td><td class="l">${row.companyFn===data.activeCompanyFn?cap(c('current'),'accent'):''}</td></tr>`).join('');
  const userRows=(data.users||[]).map(row=>`<tr><td class="l li-name"><b>${esc(row.fullName)}</b><small>${esc(row.email)}</small></td><td class="l">${esc(row.roleName)}</td><td class="l mono">${esc(row.companyFn)}</td><td class="l">${cap(row.isActive?c('active'):c('disabled'),row.isActive?'ok':'neutral')}</td></tr>`).join('');
  const body=`<div data-canonical-master-control="true"><div class="statwrap"><div class="statcards">${[[c('companies'),data.companies.length],[c('users'),data.users.length],[c('roles'),data.roles.length]].map(([l,v])=>`<div class="card" style="padding:13px 15px"><small style="display:block;margin-bottom:5px">${esc(l)}</small><b class="tnum" style="display:block;font-size:24px">${num(v)}</b></div>`).join('')}</div></div><div class="toolbar"><b>${esc(data.master.name)}</b><span class="mono">${esc(data.master.masterFn)}</span><div class="grow"></div>${btn(c('manageUsers'),{icon:'people',cls:'soft',attrs:'onclick="navigate(\'user-mgmt\')"'})}${btn(c('manageRoles'),{icon:'shield',cls:'soft',attrs:'onclick="navigate(\'role-permission\')"'})}</div><div class="panel" style="margin:0 24px 14px"><div class="panel-h"><h3>${esc(c('companies'))}</h3></div><div class="tablewrap"><table class="lines"><thead><tr><th class="l">${esc(c('company'))}</th><th class="l">${esc(c('country'))}</th><th class="l">${esc(c('currency'))}</th><th class="l">${esc(c('tax'))}</th><th>${esc(c('userCount'))}</th><th class="l"></th></tr></thead><tbody>${companyRows}</tbody></table></div></div><div class="panel" style="margin:0 24px 24px"><div class="panel-h"><h3>${esc(c('users'))}</h3></div><div class="tablewrap"><table class="lines"><thead><tr><th class="l">${esc(c('user'))}</th><th class="l">${esc(c('role'))}</th><th class="l">${esc(c('access'))}</th><th class="l">${esc(c('status'))}</th></tr></thead><tbody>${userRows}</tbody></table></div></div></div>`;
  root.innerHTML=modulePage({module:'admin',route:'master-control',active:'master-control',title:c('tenant'),sub:c('tenantSub'),count:data.companies.length,action:btn(c('settings'),{icon:'gear',cls:'primary',attrs:'onclick="navigate(\'sys-settings\')"'}),body});
};

SCREENS['sys-settings']=async function(root){
  const c=controlPlaneCopy(); let data;
  try{data=(await listPage('settings/overview')).data;}catch(error){controlPlaneError(root,'sys-settings',c('settings'),c('settingsSub'),error);return;}
  const policy=data.policy||{dateFormat:'YYYY-MM-DD',negativeStockPolicy:'block',approvalThreshold:'0.00',sessionTimeoutMinutes:30,defaultWarehouseCode:''};
  const sequenceLabel=row=>row.documentType==='employee'?c('employeeNumber'):row.documentType;
  const sequencePreview=row=>{
    const number=String(row.nextNumber).padStart(row.padding,'0');
    if(row.resetPolicy==='yearly') return `${row.prefix}-${new Date().getUTCFullYear()}-${number}`;
    if(row.resetPolicy==='monthly') return `${row.prefix}-${new Date().toISOString().slice(0,7).replace('-','')}-${number}`;
    return `${row.prefix}-${number}`;
  };
  const seqRows=(data.sequences||[]).map(row=>`<tr data-sequence="${row.id}"><td class="l li-name"><b>${esc(sequenceLabel(row))}</b><small>${esc(sequencePreview(row))}</small></td><td class="l mono">${esc(row.prefix)}</td><td class="tnum">${num(row.nextNumber)}</td><td class="tnum">${num(row.padding)}</td><td class="l">${esc(row.resetPolicy)}</td><td class="r"><button class="btn plain sm" data-seq-edit>${ic('edit')}<span>${esc(c('edit'))}</span></button></td></tr>`).join('');
  const taxRows=(data.taxes||[]).map(row=>`<tr><td class="l li-name"><b>${esc(row.taxCode)}</b><small>${esc(row.taxRegime)}</small></td><td class="tnum">${esc(row.rate)}%</td><td class="l">${esc(String(row.validFrom).slice(0,10))}</td><td class="l">${esc(row.validTo?String(row.validTo).slice(0,10):'—')}</td></tr>`).join('');
  const periodRows=(data.periods||[]).map(row=>`<tr data-period="${row.id}"><td class="l li-name"><b>${esc(row.label)}</b><small>FY${esc(row.fiscalYear)} · P${String(row.periodNo).padStart(2,'0')}</small></td><td class="l">${esc(String(row.startDate).slice(0,10))} → ${esc(String(row.endDate).slice(0,10))}</td><td class="l">${cap(c(row.status),row.status==='open'?'ok':'warn')}</td><td class="r"><button class="btn soft sm" data-period-status="${row.status==='open'?'locked':'open'}">${ic(row.status==='open'?'lock':'refresh')}<span>${esc(row.status==='open'?c('lock'):c('reopen'))}</span></button></td></tr>`).join('');
  const body=`<div data-canonical-system-settings="true"><div class="panel" style="margin:0 24px 14px"><div class="panel-h"><h3>${esc(c('companyFacts'))}</h3></div><div class="docmeta"><div class="dm"><small>${esc(c('company'))}</small><b>${esc(data.company.name)}</b></div><div class="dm"><small>${esc(c('country'))}</small><b>${esc(data.company.country)}</b></div><div class="dm"><small>${esc(c('currency'))}</small><b>${esc(data.company.currency)}</b></div><div class="dm"><small>${esc(c('tax'))}</small><b>${esc(data.company.taxRegime)}</b></div></div></div><div class="panel" style="margin:0 24px 14px"><div class="panel-h"><h3>${esc(c('general'))}</h3></div><div class="panel-body"><div class="fldrow c3"><div class="fld"><span>${esc(c('dateFormat'))}</span><select id="cpDateFormat">${['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY'].map(v=>`<option ${v===policy.dateFormat?'selected':''}>${v}</option>`).join('')}</select></div><div class="fld"><span>${esc(c('negativeStock'))}</span><select id="cpStockPolicy"><option value="block" ${policy.negativeStockPolicy==='block'?'selected':''}>${esc(c('block'))}</option><option value="warn" ${policy.negativeStockPolicy==='warn'?'selected':''}>${esc(c('warn'))}</option></select></div><div class="fld"><span>${esc(c('threshold'))}</span><input id="cpThreshold" inputmode="decimal" value="${esc(policy.approvalThreshold)}"></div></div><div class="fldrow c3"><div class="fld"><span>${esc(c('timeout'))}</span><input id="cpTimeout" type="number" min="15" max="1440" value="${num(policy.sessionTimeoutMinutes)}"></div><div class="fld"><span>${esc(c('warehouse'))}</span><input id="cpWarehouse" value="${esc(policy.defaultWarehouseCode||'')}"></div><div class="fld" style="justify-content:flex-end">${btn(c('saveSettings'),{icon:'check',cls:'primary',attrs:'data-policy-save'})}</div></div></div></div><div class="panel" style="margin:0 24px 14px"><div class="panel-h"><h3>${esc(c('sequences'))}</h3></div><div class="tablewrap"><table class="lines"><thead><tr><th class="l">${esc(c('document'))}</th><th class="l">${esc(c('prefix'))}</th><th>${esc(c('next'))}</th><th>${esc(c('padding'))}</th><th class="l">${esc(c('reset'))}</th><th></th></tr></thead><tbody>${seqRows||`<tr><td colspan="6">${esc(c('noData'))}</td></tr>`}</tbody></table></div></div><div class="panel" style="margin:0 24px 14px"><div class="panel-h"><h3>${esc(c('periods'))}</h3></div><div class="tablewrap"><table class="lines"><thead><tr><th class="l">${esc(c('period'))}</th><th class="l">${esc(c('dates'))}</th><th class="l">${esc(c('status'))}</th><th></th></tr></thead><tbody>${periodRows||`<tr><td colspan="4">${esc(c('noData'))}</td></tr>`}</tbody></table></div></div><div class="panel" style="margin:0 24px 24px"><div class="panel-h"><h3>${esc(c('taxRules'))}</h3></div><div class="tablewrap"><table class="lines"><thead><tr><th class="l">${esc(c('code'))}</th><th>${esc(c('rate'))}</th><th class="l">${esc(c('validFrom'))}</th><th class="l">${esc(c('validTo'))}</th></tr></thead><tbody>${taxRows||`<tr><td colspan="4">${esc(c('noData'))}</td></tr>`}</tbody></table></div></div></div>`;
  root.innerHTML=modulePage({module:'admin',route:'sys-settings',active:'sys-settings',title:c('settings'),sub:c('settingsSub'),body});
  root.querySelector('[data-policy-save]').addEventListener('click',async b=>{const button=b.currentTarget;button.disabled=true;try{await window.ErpSystemData.action('settings/policy','current','update',{dateFormat:$('#cpDateFormat').value,negativeStockPolicy:$('#cpStockPolicy').value,approvalThreshold:$('#cpThreshold').value,sessionTimeoutMinutes:Number($('#cpTimeout').value),defaultWarehouseCode:$('#cpWarehouse').value},controlPlaneKey('settings-policy'));toast(c('policySaved'),'ok');navigate('sys-settings');}catch(error){button.disabled=false;toast(error.message,'danger');}});
  root.querySelectorAll('[data-seq-edit]').forEach(button=>button.addEventListener('click',()=>{const id=Number(button.closest('[data-sequence]').dataset.sequence),row=data.sequences.find(x=>x.id===id);appModal({icon:'edit',title:c('edit')+' · '+sequenceLabel(row),body:`<div class="set-grid"><div class="fld"><span>${esc(c('prefix'))}</span><input id="seqPrefix" value="${esc(row.prefix)}"></div><div class="fld"><span>${esc(c('next'))}</span><input id="seqNext" type="number" min="1" value="${num(row.nextNumber)}"></div><div class="fld"><span>${esc(c('padding'))}</span><input id="seqPadding" type="number" min="2" max="10" value="${num(row.padding)}"></div><div class="fld"><span>${esc(c('reset'))}</span><select id="seqReset">${['never','yearly','monthly'].map(v=>`<option ${v===row.resetPolicy?'selected':''}>${v}</option>`).join('')}</select></div></div>`,actions:`${btn(c('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(c('save'),{icon:'check',cls:'primary',attrs:'data-seq-save'})}`});$('#modalEl').querySelector('[data-seq-save]').addEventListener('click',async()=>{const payload={prefix:$('#seqPrefix').value,nextNumber:Number($('#seqNext').value),padding:Number($('#seqPadding').value),resetPolicy:$('#seqReset').value};closeModal();try{await window.ErpSystemData.action('settings/sequences',id,'update',payload,controlPlaneKey('settings-sequence'));toast(c('sequenceSaved'),'ok');navigate('sys-settings');}catch(error){toast(error.message,'danger');}});}));
  root.querySelectorAll('[data-period-status]').forEach(button=>button.addEventListener('click',async()=>{const id=Number(button.closest('[data-period]').dataset.period);button.disabled=true;try{await window.ErpSystemData.action('settings/periods',id,'set-status',{status:button.dataset.periodStatus},controlPlaneKey('settings-period'));toast(c('periodSaved'),'ok');navigate('sys-settings');}catch(error){button.disabled=false;toast(error.message,'danger');}}));
};
