/* ============================================================
   ARIA ERP — screens: Settings (personal preferences)
   Profile · Appearance · Notifications · Language & region ·
   Defaults · Security. Destination for the sidebar "Settings"
   button and the account-menu "Preferences" item.
   ============================================================ */
SCREENS['settings'] = function(root, params){
  const u=DB.user;
  /* TASK-018: prefer the real canonical company list (works in both demo and
     api mode — both adapters populate DB.erpSystem.companies/scope) over the
     mock master-tenant hierarchy in DB.masters, which still carries the
     original Aria/Northwind prototype's placeholder company names. */
  const companies=(DB.erpSystem&&DB.erpSystem.companies&&DB.erpSystem.companies.length)
    ? DB.erpSystem.companies.map(c=>({name:c.name,current:c.company_fn===DB.erpSystem.scope.companyFn}))
    : DB.masters[0].companies;
  const modules=DB.nav.flatMap(g=>g.items);
  const COPY={
    en:{
      title:'Settings', subtitle:'Your profile, preferences and security', rail:'Settings',
      profile:'Profile', appearance:'Appearance', notifications:'Notifications', localization:'Language & region', defaults:'Defaults', security:'Security', demo:'Demo data',
      changePhoto:'Change photo', remove:'Remove', fullName:'Full name', jobTitle:'Job title', workEmail:'Work email', phone:'Phone', department:'Department', reportsTo:'Reports to',
      theme:'Theme', themeDesc:'Choose how Aria looks. System follows your device setting.', light:'Light', dark:'Dark', system:'System',
      palette:'Colour palette', paletteDesc:'Apply a curated preset across the app, or fine-tune the accent below.',
      accent:'Accent colour', accentDesc:'Used for highlights, links and active states across the app.', blue:'Blue', indigo:'Indigo', teal:'Teal', green:'Green', amber:'Amber', pink:'Pink',
      sidebar:'Sidebar', sidebarDesc:'Keep the primary navigation expanded or collapsed to icons.', expanded:'Expanded', collapsed:'Collapsed',
      density:'Density', densityDesc:'Comfortable spacing, or compact rows to fit more on screen.', comfortable:'Comfortable', compact:'Compact',
      textSize:'Text size', textSizeDesc:'Make the text larger or smaller across the app, without changing the layout. Five levels, from small to largest.', small:'Small', default:'Default', large:'Large', larger:'Larger', largest:'Largest', textSuffix:'text',
      approvalsMe:'Approvals awaiting me', approvalsMeDesc:'Purchase orders, journals and discounts that need your decision.',
      mentions:'Mentions & comments', mentionsDesc:'When someone @mentions you on a document or thread.',
      statusChanges:'Document status changes', statusChangesDesc:'Orders you own move to picked, posted, shipped or paid.',
      stockAlerts:'Stock-out & low-stock alerts', stockAlertsDesc:'Items you watch drop below their reorder point.',
      closeReminders:'Period-close reminders', closeRemindersDesc:'Reminders ahead of month-end and fiscal close.',
      emailDigest:'Email digest', emailDigestDesc:'How often Aria emails a summary of what needs you.', off:'Off', daily:'Daily', realtime:'Realtime',
      desktopPush:'Desktop push', desktopPushDesc:'Show alerts in this browser while you are signed in.',
      language:'Language', timeZone:'Time zone', dateFormat:'Date format', numberFormat:'Number format', firstDay:'First day of week', currencyDisplay:'Currency display',
      defaultCompany:'Default company', defaultCompanyDesc:'The company & branch loaded when you sign in.',
      landingPage:'Landing page', landingPageDesc:'Where Aria takes you after sign-in.',
      defaultWarehouse:'Default warehouse', defaultWarehouseDesc:'Pre-selected on stock, picking and transfer screens.',
      rowsPerPage:'Rows per page', rowsPerPageDesc:'Default page size for lists and tables.',
      password:'Password', passwordDesc:'Last changed 12 March 2026.', changePassword:'Change password',
      twoFactor:'Two-factor authentication', twoFactorDesc:'Authenticator app enrolled.', enabled:'Enabled', manage:'Manage',
      recoveryCodes:'Recovery codes', recoveryCodesDesc:'Single-use codes for when you lose your device.', viewCodes:'View codes',
      activeSessions:'Active sessions', thisDevice:'This device', revoke:'Revoke', signOutOthers:'Sign out all other sessions',
      dataSource:'Data source', resetDemo:'Reset demo data', resetDemoDesc:'Drops the canonical demo database and reseeds it (companies, products, tax rules, the SO-1 transaction chain) on reload.',
      rerunWizard:'Re-run setup wizard', rerunWizardDesc:'Show the first-run setup wizard again on next reload. Existing demo data is not changed.', rerunWizardConfirm:'Re-run the setup wizard? Your demo data is kept — this only replays the setup screens.', rerunWizardToast:'Reloading into the setup wizard…',
      pgliteInfo:'PGlite · in-browser PostgreSQL persisted to IndexedDB', fallbackInfo:'Static fallback · PGlite unavailable in this session', fallback:'Fallback',
      savebar:'Personal preferences · saved to your account', reset:'Reset', save:'Save changes',
      uploadPhoto:'Upload photo — not in this build', photoRemoved:'Photo removed', settingsSaved:'Settings saved', changesReset:'Changes reset',
      manage2fa:'Manage 2FA — not in this build', codesToast:'Recovery codes — not in this build', sessionRevoked:'Session revoked', signedOutOthers:'Signed out of all other sessions',
      resetConfirm:'Reset demo data? The in-browser database is dropped and the canonical sample data is reseeded on reload.', resetting:'Resetting demo data…', adapterMissing:'Demo adapter not loaded',
      currentPassword:'Current password', newPassword:'New password', newPasswordPh:'At least 12 characters', confirmPassword:'Confirm new password', passwordHint:'Use 12+ characters with a mix of letters, numbers and symbols.', cancel:'Cancel', updatePassword:'Update password', passwordUpdated:'Password updated',
    },
    ms:{
      title:'Tetapan', subtitle:'Profil, keutamaan dan keselamatan anda', rail:'Tetapan',
      profile:'Profil', appearance:'Penampilan', notifications:'Pemberitahuan', localization:'Bahasa & rantau', defaults:'Lalai', security:'Keselamatan', demo:'Data demo',
      changePhoto:'Tukar foto', remove:'Buang', fullName:'Nama penuh', jobTitle:'Jawatan', workEmail:'E-mel kerja', phone:'Telefon', department:'Jabatan', reportsTo:'Melapor kepada',
      theme:'Tema', themeDesc:'Pilih rupa Aria. Sistem mengikut tetapan peranti anda.', light:'Cerah', dark:'Gelap', system:'Sistem',
      palette:'Palet warna', paletteDesc:'Guna pratetap pilihan merentas aplikasi, atau laraskan aksen di bawah.',
      accent:'Warna aksen', accentDesc:'Digunakan untuk sorotan, pautan dan keadaan aktif dalam aplikasi.', blue:'Biru', indigo:'Indigo', teal:'Teal', green:'Hijau', amber:'Amber', pink:'Merah jambu',
      sidebar:'Bar sisi', sidebarDesc:'Kekalkan navigasi utama dibuka atau diringkaskan kepada ikon.', expanded:'Dibuka', collapsed:'Diringkas',
      density:'Ketumpatan', densityDesc:'Jarak selesa, atau baris padat untuk memuatkan lebih banyak pada skrin.', comfortable:'Selesa', compact:'Padat',
      textSize:'Saiz teks', textSizeDesc:'Besarkan atau kecilkan teks merentas aplikasi tanpa mengubah susun atur. Lima tahap, daripada kecil hingga terbesar.', small:'Kecil', default:'Lalai', large:'Besar', larger:'Lebih besar', largest:'Terbesar', textSuffix:'teks',
      approvalsMe:'Kelulusan menunggu saya', approvalsMeDesc:'Pesanan belian, jurnal dan diskaun yang memerlukan keputusan anda.',
      mentions:'Sebutan & komen', mentionsDesc:'Apabila seseorang @menyebut anda pada dokumen atau thread.',
      statusChanges:'Perubahan status dokumen', statusChangesDesc:'Pesanan milik anda berubah kepada dipilih, dipos, dihantar atau dibayar.',
      stockAlerts:'Amaran kehabisan & stok rendah', stockAlertsDesc:'Item dipantau jatuh di bawah titik pesanan semula.',
      closeReminders:'Peringatan tutup tempoh', closeRemindersDesc:'Peringatan sebelum hujung bulan dan penutupan fiskal.',
      emailDigest:'Ringkasan e-mel', emailDigestDesc:'Kekerapan Aria menghantar ringkasan perkara yang memerlukan perhatian anda.', off:'Mati', daily:'Harian', realtime:'Masa nyata',
      desktopPush:'Push desktop', desktopPushDesc:'Tunjukkan amaran dalam pelayar ini semasa anda log masuk.',
      language:'Bahasa', timeZone:'Zon masa', dateFormat:'Format tarikh', numberFormat:'Format nombor', firstDay:'Hari pertama minggu', currencyDisplay:'Paparan mata wang',
      defaultCompany:'Syarikat lalai', defaultCompanyDesc:'Syarikat & cawangan yang dimuatkan apabila anda log masuk.',
      landingPage:'Halaman mula', landingPageDesc:'Ke mana Aria membawa anda selepas log masuk.',
      defaultWarehouse:'Gudang lalai', defaultWarehouseDesc:'Dipilih awal pada skrin stok, pungutan dan pemindahan.',
      rowsPerPage:'Baris setiap halaman', rowsPerPageDesc:'Saiz halaman lalai untuk senarai dan jadual.',
      password:'Kata laluan', passwordDesc:'Terakhir ditukar 12 Mac 2026.', changePassword:'Tukar kata laluan',
      twoFactor:'Pengesahan dua faktor', twoFactorDesc:'Aplikasi pengesah telah didaftarkan.', enabled:'Didayakan', manage:'Urus',
      recoveryCodes:'Kod pemulihan', recoveryCodesDesc:'Kod sekali guna apabila anda kehilangan peranti.', viewCodes:'Lihat kod',
      activeSessions:'Sesi aktif', thisDevice:'Peranti ini', revoke:'Batalkan', signOutOthers:'Log keluar sesi lain',
      dataSource:'Sumber data', resetDemo:'Tetapkan semula data demo', resetDemoDesc:'Menggugurkan pangkalan data demo kanonik dan menanam semula data pada muat semula.',
      rerunWizard:'Jalankan semula wizard persediaan', rerunWizardDesc:'Tunjukkan semula wizard persediaan pertama pada muat semula seterusnya. Data demo sedia ada tidak berubah.', rerunWizardConfirm:'Jalankan semula wizard persediaan? Data demo anda dikekalkan — ini hanya memainkan semula skrin persediaan.', rerunWizardToast:'Memuat semula ke wizard persediaan…',
      pgliteInfo:'PGlite · PostgreSQL dalam pelayar disimpan ke IndexedDB', fallbackInfo:'Sandaran statik · PGlite tidak tersedia dalam sesi ini', fallback:'Sandaran',
      savebar:'Keutamaan peribadi · disimpan ke akaun anda', reset:'Tetapkan semula', save:'Simpan perubahan',
      uploadPhoto:'Muat naik foto — tiada dalam binaan ini', photoRemoved:'Foto dibuang', settingsSaved:'Tetapan disimpan', changesReset:'Perubahan ditetapkan semula',
      manage2fa:'Urus 2FA — tiada dalam binaan ini', codesToast:'Kod pemulihan — tiada dalam binaan ini', sessionRevoked:'Sesi dibatalkan', signedOutOthers:'Telah log keluar semua sesi lain',
      resetConfirm:'Tetapkan semula data demo? Pangkalan data dalam pelayar akan digugurkan dan data sampel kanonik ditanam semula semasa muat semula.', resetting:'Menetapkan semula data demo…', adapterMissing:'Penyesuai demo tidak dimuatkan',
      currentPassword:'Kata laluan semasa', newPassword:'Kata laluan baharu', newPasswordPh:'Sekurang-kurangnya 12 aksara', confirmPassword:'Sahkan kata laluan baharu', passwordHint:'Gunakan 12+ aksara dengan campuran huruf, nombor dan simbol.', cancel:'Batal', updatePassword:'Kemas kini kata laluan', passwordUpdated:'Kata laluan dikemas kini',
    },
    zh:{
      title:'设置', subtitle:'您的资料、偏好设置和安全', rail:'设置',
      profile:'资料', appearance:'外观', notifications:'通知', localization:'语言与地区', defaults:'默认值', security:'安全', demo:'演示数据',
      changePhoto:'更换照片', remove:'移除', fullName:'姓名', jobTitle:'职位', workEmail:'工作邮箱', phone:'电话', department:'部门', reportsTo:'汇报对象',
      theme:'主题', themeDesc:'选择 Aria 的外观。系统会跟随您的设备设置。', light:'浅色', dark:'深色', system:'系统',
      palette:'配色方案', paletteDesc:'在整个应用中应用预设配色，也可以在下方微调强调色。',
      accent:'强调色', accentDesc:'用于应用中的高亮、链接和当前状态。', blue:'蓝色', indigo:'靛蓝', teal:'青色', green:'绿色', amber:'琥珀色', pink:'粉色',
      sidebar:'侧边栏', sidebarDesc:'保持主导航展开，或收起为图标。', expanded:'展开', collapsed:'收起',
      density:'密度', densityDesc:'使用舒适间距，或使用紧凑行距以显示更多内容。', comfortable:'舒适', compact:'紧凑',
      textSize:'文字大小', textSizeDesc:'在不改变布局的情况下调整整个应用的文字大小。共五级，从小到最大。', small:'小', default:'默认', large:'大', larger:'较大', largest:'最大', textSuffix:'文字',
      approvalsMe:'等待我审批', approvalsMeDesc:'需要您决策的采购订单、日记账和折扣。',
      mentions:'提及与评论', mentionsDesc:'当有人在文档或讨论中 @提及您时通知。',
      statusChanges:'文档状态变更', statusChangesDesc:'您负责的订单变为已拣货、已过账、已发货或已付款时通知。',
      stockAlerts:'缺货与低库存提醒', stockAlertsDesc:'您关注的物料低于再订货点时通知。',
      closeReminders:'期间结账提醒', closeRemindersDesc:'月结和财务期间关闭前的提醒。',
      emailDigest:'邮件摘要', emailDigestDesc:'Aria 向您发送待办摘要的频率。', off:'关闭', daily:'每日', realtime:'实时',
      desktopPush:'桌面推送', desktopPushDesc:'登录时在此浏览器中显示提醒。',
      language:'语言', timeZone:'时区', dateFormat:'日期格式', numberFormat:'数字格式', firstDay:'每周第一天', currencyDisplay:'货币显示',
      defaultCompany:'默认公司', defaultCompanyDesc:'登录后默认载入的公司与分支。',
      landingPage:'登录后页面', landingPageDesc:'登录后 Aria 打开的页面。',
      defaultWarehouse:'默认仓库', defaultWarehouseDesc:'在库存、拣货和调拨页面预先选择。',
      rowsPerPage:'每页行数', rowsPerPageDesc:'列表和表格的默认分页大小。',
      password:'密码', passwordDesc:'上次更改于 2026 年 3 月 12 日。', changePassword:'修改密码',
      twoFactor:'双重认证', twoFactorDesc:'已绑定身份验证器应用。', enabled:'已启用', manage:'管理',
      recoveryCodes:'恢复代码', recoveryCodesDesc:'设备丢失时可使用的一次性代码。', viewCodes:'查看代码',
      activeSessions:'活动会话', thisDevice:'此设备', revoke:'撤销', signOutOthers:'退出其他所有会话',
      dataSource:'数据来源', resetDemo:'重置演示数据', resetDemoDesc:'重新载入时删除标准演示数据库并重新植入公司、产品、税务规则和 SO-1 交易链。',
      rerunWizard:'重新运行设置向导', rerunWizardDesc:'下次重新载入时再次显示首次设置向导。现有演示数据不会更改。', rerunWizardConfirm:'重新运行设置向导?您的演示数据将被保留 — 这只会重播设置画面。', rerunWizardToast:'正在重新载入设置向导…',
      pgliteInfo:'PGlite · 浏览器内 PostgreSQL，持久化到 IndexedDB', fallbackInfo:'静态备用 · 此会话中 PGlite 不可用', fallback:'备用',
      savebar:'个人偏好 · 已保存到您的账户', reset:'重置', save:'保存更改',
      uploadPhoto:'上传照片 — 此版本未提供', photoRemoved:'照片已移除', settingsSaved:'设置已保存', changesReset:'更改已重置',
      manage2fa:'管理 2FA — 此版本未提供', codesToast:'恢复代码 — 此版本未提供', sessionRevoked:'会话已撤销', signedOutOthers:'已退出其他所有会话',
      resetConfirm:'重置演示数据？浏览器内数据库将被删除，并在重新载入时重新植入标准示例数据。', resetting:'正在重置演示数据…', adapterMissing:'演示适配器未加载',
      currentPassword:'当前密码', newPassword:'新密码', newPasswordPh:'至少 12 个字符', confirmPassword:'确认新密码', passwordHint:'请使用 12 个以上字符，并混合字母、数字和符号。', cancel:'取消', updatePassword:'更新密码', passwordUpdated:'密码已更新',
    }
  };
  const lang=(typeof getLang==='function'?getLang():'en');
  const copy=COPY[lang]||COPY.en;
  const s=k=>copy[k]||COPY.en[k]||k;

  /* ---- reusable bits ---- */
  function row(title,desc,control,top){
    return `<div class="set-row${top?' top':''}">
      <div class="set-row-t"><b>${title}</b>${desc?`<small>${desc}</small>`:''}</div>
      <div class="set-row-c">${control}</div></div>`;
  }
  function seg(group,opts,cur){
    return `<div class="seg" data-seg="${group}">${opts.map(o=>
      `<button data-v="${o[0]}" class="${o[0]===cur?'on':''}">${o[1]}</button>`).join('')}</div>`;
  }
  function tgl(on){ return `<button class="set-tgl ${on?'on':''}" role="switch" aria-checked="${!!on}"><span class="set-tgl-k"></span></button>`; }
  function sel(opts,cur){ return `<select>${opts.map(o=>`<option ${o===cur?'selected':''}>${esc(o)}</option>`).join('')}</select>`; }
  function panel(id,icon,heading,inner){
    return `<section class="set-sec" id="${id}"><div class="panel">
      <div class="panel-h">${ic(icon)}<h3>${heading}</h3></div>${inner}</div></section>`;
  }

  /* ---- current UI state (reflect reality, not assumptions) ---- */
  const curTheme=document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';
  const curSidebar=$('#app').classList.contains('nav-collapsed')?'collapsed':'expanded';
  const curDensity=document.documentElement.getAttribute('data-density')==='compact'?'compact':'comfortable';
  let curTextsize='1'; try{ curTextsize=localStorage.getItem('aria-textsize')||'1'; }catch(e){}
  let curAccent='#0071E3'; try{ curAccent=localStorage.getItem('aria-accent')||'#0071E3'; }catch(e){}
  let curPalette=''; try{ curPalette=localStorage.getItem('aria-palette')||''; }catch(e){}
  const accents=[['#0071E3',s('blue')],['#5E5CE6',s('indigo')],['#0a7d8c',s('teal')],['#1f9d57',s('green')],['#FF9500',s('amber')],['#FF375F',s('pink')]];
  /* curated presets: [name, accent, [preview swatches]] */
  const palettes=[
    ['Aria','#0071E3',['#0071E3','#5E5CE6','#0a7d8c']],
    ['Slate','#5b6472',['#5b6472','#8a94a6','#0071E3']],
    ['Forest','#1f9d57',['#1f9d57','#0a7d8c','#34C759']],
    ['Sunset','#FF375F',['#FF375F','#FF9500','#FF2D55']],
    ['Royal','#5E5CE6',['#5E5CE6','#7d5cff','#0071E3']],
    ['Amber','#FF9500',['#FF9500','#FFB340','#FF375F']],
  ];

  /* ---- PROFILE ---- */
  const profile=panel('set-profile','user',s('profile'),`
    <div class="set-row top">
      <div class="set-row-t" style="display:flex;gap:16px;align-items:center">
        <span class="set-avatar">${esc(u.initials)}</span>
        <div><b style="font-size:15px">${esc(u.name)}</b>
          <small style="margin-top:3px">${esc(u.role)} · ${esc(DB.company.name)}</small></div>
      </div>
      <div class="set-row-c">${btn(s('changePhoto'),{icon:'camera',cls:'soft',attrs:'data-act="photo"'})}${btn(s('remove'),{cls:'plain',attrs:'data-act="rmphoto"'})}</div>
    </div>
    <div class="set-grid">
      <div class="fld"><span>${esc(s('fullName'))}</span><input value="${esc(u.name)}"></div>
      <div class="fld"><span>${esc(s('jobTitle'))}</span><input value="${esc(u.role)}"></div>
      <div class="fld"><span>${esc(s('workEmail'))}</span><input value="${esc(u.email)}"></div>
      <div class="fld"><span>${esc(s('phone'))}</span><input value="+60 12-345 6789"></div>
      <div class="fld"><span>${esc(s('department'))}</span><input value="Operations"></div>
      <div class="fld"><span>${esc(s('reportsTo'))}</span><input value="Priya Nwosu · CFO" readonly></div>
    </div>`);

  /* ---- APPEARANCE ---- */
  const appearance=panel('set-appearance','sun',s('appearance'),`
    ${row(s('theme'),s('themeDesc'),seg('theme',[['light',s('light')],['dark',s('dark')],['system',s('system')]],curTheme))}
    ${row(s('palette'),s('paletteDesc'),
      `<div class="set-palettes">${palettes.map(p=>`<button class="set-pal ${p[0]===curPalette?'on':''}" data-c="${p[1]}" data-name="${p[0]}" aria-label="${p[0]} palette"><span class="set-pal-sw">${p[2].map(c=>`<i style="background:${c}"></i>`).join('')}</span><span class="set-pal-l">${p[0]}</span></button>`).join('')}</div>`)}
    ${row(s('accent'),s('accentDesc'),
      `<div class="set-swatches">${accents.map(a=>`<button class="set-sw ${a[0]===curAccent?'on':''}" data-c="${a[0]}" style="background:${a[0]}" data-tip="${a[1]}" aria-label="${a[1]}"></button>`).join('')}</div>`)}
    ${row(s('sidebar'),s('sidebarDesc'),seg('sidebar',[['expanded',s('expanded')],['collapsed',s('collapsed')]],curSidebar))}
    ${row(s('density'),s('densityDesc'),seg('density',[['comfortable',s('comfortable')],['compact',s('compact')]],curDensity))}
    ${row(s('textSize'),s('textSizeDesc'),
      `<div class="seg" data-seg="textsize">${[['0.9',s('small')],['1',s('default')],['1.12',s('large')],['1.25',s('larger')],['1.4',s('largest')]].map((o,i)=>`<button data-v="${o[0]}" class="${o[0]===curTextsize?'on':''}" data-tip="${o[1]}" aria-label="${o[1]} ${s('textSuffix')}" style="font-size:${11+i*1.6}px;line-height:1;min-width:30px;justify-content:center">A</button>`).join('')}</div>`)}`);

  /* ---- NOTIFICATIONS ---- */
  const notifications=panel('set-notifications','bell',s('notifications'),`
    ${row(s('approvalsMe'),s('approvalsMeDesc'),tgl(true))}
    ${row(s('mentions'),s('mentionsDesc'),tgl(true))}
    ${row(s('statusChanges'),s('statusChangesDesc'),tgl(true))}
    ${row(s('stockAlerts'),s('stockAlertsDesc'),tgl(true))}
    ${row(s('closeReminders'),s('closeRemindersDesc'),tgl(false))}
    ${row(s('emailDigest'),s('emailDigestDesc'),seg('digest',[['off',s('off')],['daily',s('daily')],['realtime',s('realtime')]],'daily'))}
    ${row(s('desktopPush'),s('desktopPushDesc'),tgl(true))}`);

  /* ---- LANGUAGE & REGION ---- */
  const localization=panel('set-localization','location',s('localization'),`
    <div class="set-grid">
      <div class="fld"><span>${esc(s('language'))}</span>${sel(['English (US)','English (UK)','Bahasa Melayu','简体中文','日本語'],'English (US)')}</div>
      <div class="fld"><span>${esc(s('timeZone'))}</span>${sel(['(GMT+8) Kuala Lumpur','(GMT+8) Singapore','(GMT+0) London','(GMT-5) New York'],'(GMT+8) Kuala Lumpur')}</div>
      <div class="fld"><span>${esc(s('dateFormat'))}</span>${sel(['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY'],'YYYY-MM-DD')}</div>
      <div class="fld"><span>${esc(s('numberFormat'))}</span>${sel(['1,234.56','1.234,56','1 234.56'],'1,234.56')}</div>
      <div class="fld"><span>${esc(s('firstDay'))}</span>${sel(['Monday','Sunday','Saturday'],'Monday')}</div>
      <div class="fld"><span>${esc(s('currencyDisplay'))}</span>${sel(['Symbol — $1,240','Code — USD 1,240'],'Symbol — $1,240')}</div>
    </div>`);

  /* ---- DEFAULTS ---- */
  const defaults=panel('set-defaults','sliders',s('defaults'),`
    ${row(s('defaultCompany'),s('defaultCompanyDesc'),sel(companies.map(c=>c.name),companies.find(c=>c.current).name))}
    ${row(s('landingPage'),s('landingPageDesc'),sel(modules.map(m=>tf('nav.'+m.id,m.label)),tf('nav.home','Home')))}
    ${row(s('defaultWarehouse'),s('defaultWarehouseDesc'),sel(['KL-Main','KL-Overflow','Penang DC'],'KL-Main'))}
    ${row(s('rowsPerPage'),s('rowsPerPageDesc'),seg('rows',[['25','25'],['50','50'],['100','100']],'50'))}`);

  /* ---- SECURITY ---- */
  const sessions=[
    ['grid','Chrome · macOS','Kuala Lumpur, MY · Active now',true],
    ['user','Safari · iPhone 15','Kuala Lumpur, MY · 2 hours ago',false],
    ['grid','Firefox · Windows','Singapore, SG · 3 days ago',false],
  ];
  const security=panel('set-security','lock',s('security'),`
    ${row(s('password'),s('passwordDesc'),btn(s('changePassword'),{icon:'lock',cls:'soft',attrs:'data-act="pw"'}))}
    ${row(s('twoFactor'),s('twoFactorDesc'),`${cap(s('enabled'),'ok')}${btn(s('manage'),{cls:'soft',attrs:'data-act="2fa"'})}`)}
    ${row(s('recoveryCodes'),s('recoveryCodesDesc'),btn(s('viewCodes'),{cls:'soft',attrs:'data-act="codes"'}))}
    <div class="panel-h" style="border-top:1px solid var(--hairline)"><h3 style="font-size:12.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">${esc(s('activeSessions'))}</h3></div>
    ${sessions.map((s,i)=>`<div class="set-sess">
      <span class="si">${ic(s[0])}</span>
      <div class="sm"><b>${s[1]}</b><small>${s[2]}</small></div>
      ${s[3]?cap(copy.thisDevice,'accent'):btn(copy.revoke,{cls:'plain',attrs:`data-revoke="${i}"`})}</div>`).join('')}
    <div class="set-row">${btn(s('signOutOthers'),{icon:'signout',cls:'soft',attrs:'data-act="signout-all"'})}</div>`);

  /* ---- DEMO DATA (ERP-System canonical PGlite seed) ---- */
  const demoInfo=(DB.erpSystem&&DB.erpSystem.dataMode==='pglite')
    ? s('pgliteInfo')
    : s('fallbackInfo');
  const demoData=panel('set-demo','box',s('demo'),`
    ${row(s('dataSource'),esc(demoInfo),cap(DB.erpSystem&&DB.erpSystem.dataMode==='pglite'?'PGlite':s('fallback'),DB.erpSystem&&DB.erpSystem.dataMode==='pglite'?'ok':'warn'))}
    ${row(s('rerunWizard'),s('rerunWizardDesc'),btn(s('rerunWizard'),{icon:'flag',cls:'soft',attrs:'data-act="rerun-wizard"'}))}
    ${row(s('resetDemo'),s('resetDemoDesc'),btn(s('resetDemo'),{icon:'refresh',cls:'soft',attrs:'data-act="demo-reset"'}))}`);

  const railItems=[
    ['set-profile','user',s('profile')],['set-appearance','sun',s('appearance')],
    ['set-notifications','bell',s('notifications')],['set-localization','location',s('localization')],
    ['set-defaults','sliders',s('defaults')],['set-security','lock',s('security')],
    ['set-demo','box',s('demo')],
  ];

  root.innerHTML=`<div class="content full"><section class="master" data-screen-label="Settings">
    <div class="pagehead">${crumbs([DB.company.name,s('title')])}
      <div class="h1row"><h1>${esc(s('title'))}</h1></div>
      <p style="margin:6px 0 0;color:var(--muted);font-size:13px">${esc(s('subtitle'))} · ${esc(u.email)}</p>
    </div>
    <div class="set-body">
      <nav class="set-rail" aria-label="Settings sections">
        <div class="set-railhead">${esc(s('rail'))}</div>
        ${railItems.map((r,i)=>`<button class="set-navitem ${i===0?'on':''}" data-target="${r[0]}">${ic(r[1])}<span>${r[2]}</span></button>`).join('')}
      </nav>
      <div class="set-scroll"><div class="set-page">
        ${profile}${appearance}${notifications}${localization}${defaults}${security}${demoData}
      </div></div>
    </div>
    <div class="set-savebar">
      <div class="hideonsmall" style="font-size:12.5px;color:var(--muted)">${esc(s('savebar'))}</div>
      <div class="grow"></div>
      ${btn(s('reset'),{cls:'soft',attrs:'data-act="reset"'})}
      ${btn(s('save'),{icon:'check',cls:'primary',sm:false,attrs:'data-act="save"'})}
    </div>
  </section></div>`;

  /* ---- scroll-spy nav ---- */
  const scroller=root.querySelector('.set-scroll');
  const secs=[...root.querySelectorAll('.set-sec')];
  const navs=[...root.querySelectorAll('.set-navitem')];
  const topOf=el=>el.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
  function spy(){
    const st=scroller.scrollTop+40; let cur=secs[0].id;
    secs.forEach(s=>{ if(topOf(s)<=st) cur=s.id; });
    navs.forEach(n=>n.classList.toggle('on',n.dataset.target===cur));
  }
  scroller.addEventListener('scroll',spy);
  navs.forEach(n=>n.addEventListener('click',()=>{
    const sec=root.querySelector('#'+n.dataset.target);
    navs.forEach(x=>x.classList.toggle('on',x===n));
    setTimeout(()=>{ scroller.scrollTop=Math.max(0,topOf(sec)-8); },0);
  }));

  /* ---- toggles ---- */
  root.querySelectorAll('.set-tgl').forEach(t=>t.addEventListener('click',()=>{
    const on=t.classList.toggle('on'); t.setAttribute('aria-checked',on);
  }));

  /* ---- segmented controls (some wire real app behaviour) ---- */
  root.querySelectorAll('.seg[data-seg]').forEach(s=>{
    s.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      s.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      const g=s.dataset.seg, v=b.dataset.v;
      if(g==='theme'){ const dark=v==='dark'||(v==='system'&&matchMedia('(prefers-color-scheme:dark)').matches); applyTheme(dark?'dark':'light'); }
      else if(g==='sidebar'){ setNavCollapsed(v==='collapsed',true); }
      else if(g==='density'){ document.documentElement.setAttribute('data-density',v==='compact'?'compact':'default'); try{localStorage.setItem('aria-density',v);}catch(e){} }
      else if(g==='textsize'){ if(v==='1'){ document.documentElement.style.removeProperty('--fs'); } else { document.documentElement.style.setProperty('--fs',v); } try{localStorage.setItem('aria-textsize',v);}catch(e){} }
    }));
  });

  /* ---- apply an accent colour live ---- */
  function applyAccent(c){
    document.documentElement.style.setProperty('--accent',c);
    document.documentElement.style.setProperty('--accent-tint','color-mix(in srgb, '+c+' 14%, transparent)');
    try{localStorage.setItem('aria-accent',c);}catch(e){}
    root.querySelectorAll('.set-sw').forEach(x=>x.classList.toggle('on',x.dataset.c===c));
  }

  /* ---- preset palettes (recolour live) ---- */
  root.querySelectorAll('.set-pal').forEach(p=>p.addEventListener('click',()=>{
    root.querySelectorAll('.set-pal').forEach(x=>x.classList.remove('on')); p.classList.add('on');
    applyAccent(p.dataset.c);
    try{localStorage.setItem('aria-palette',p.dataset.name);}catch(e){}
    toast(p.dataset.name+' palette applied','ok');
  }));

  /* ---- accent swatches (recolour live; clears preset selection) ---- */
  root.querySelectorAll('.set-sw').forEach(sw=>sw.addEventListener('click',()=>{
    root.querySelectorAll('.set-pal').forEach(x=>x.classList.remove('on'));
    try{localStorage.removeItem('aria-palette');}catch(e){}
    applyAccent(sw.dataset.c);
  }));

  /* ---- security actions ---- */
  const pw=root.querySelector('[data-act="pw"]'); pw&&pw.addEventListener('click',()=>{
    openModal(`<div class="modal-head">${ic('lock')}<h3>${esc(s('changePassword'))}</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body">
        <div class="fld"><span>${esc(s('currentPassword'))}</span><input type="password" placeholder="••••••••"></div>
        <div class="fld" style="margin-top:10px"><span>${esc(s('newPassword'))}</span><input type="password" placeholder="${esc(s('newPasswordPh'))}"></div>
        <div class="fld" style="margin-top:10px"><span>${esc(s('confirmPassword'))}</span><input type="password"></div>
        <p style="margin:10px 0 0;font-size:11.5px;color:var(--muted)">${esc(s('passwordHint'))}</p>
      </div>
      <div class="modal-foot">${btn(s('cancel'),{cls:'soft',attrs:'onclick="closeModal()"'})}${btn(s('updatePassword'),{icon:'check',cls:'primary',attrs:`onclick="closeModal();toast('${esc(s('passwordUpdated'))}','ok')"`})}</div>`);
  });
  const tfa=root.querySelector('[data-act="2fa"]'); tfa&&tfa.addEventListener('click',()=>toast(s('manage2fa'),'info'));
  const codes=root.querySelector('[data-act="codes"]'); codes&&codes.addEventListener('click',()=>toast(s('codesToast'),'info'));
  root.querySelectorAll('[data-revoke]').forEach(b=>b.addEventListener('click',()=>{
    b.closest('.set-sess').remove(); toast(s('sessionRevoked'),'ok');
  }));
  const soa=root.querySelector('[data-act="signout-all"]'); soa&&soa.addEventListener('click',()=>{
    root.querySelectorAll('.set-sess [data-revoke]').forEach(b=>b.closest('.set-sess').remove());
    toast(s('signedOutOthers'),'ok');
  });

  /* ---- profile photo + save/reset ---- */
  const ph=root.querySelector('[data-act="photo"]'); ph&&ph.addEventListener('click',()=>toast(s('uploadPhoto'),'info'));
  const rmph=root.querySelector('[data-act="rmphoto"]'); rmph&&rmph.addEventListener('click',()=>toast(s('photoRemoved'),'info'));
  root.querySelector('[data-act="save"]').addEventListener('click',()=>toast(s('settingsSaved'),'ok'));
  root.querySelector('[data-act="reset"]').addEventListener('click',()=>toast(s('changesReset'),'info'));
  root.querySelector('[data-act="demo-reset"]').addEventListener('click',()=>{
    if(!window.ErpSystemDemo){ toast(s('adapterMissing'),'warn'); return; }
    if(!confirm(s('resetConfirm'))) return;
    if(typeof clearSetupWizardFlag==='function') clearSetupWizardFlag();
    toast(s('resetting'),'info');
    window.ErpSystemDemo.reset();
  });
  const rerunWiz=root.querySelector('[data-act="rerun-wizard"]');
  rerunWiz&&rerunWiz.addEventListener('click',()=>{
    if(!confirm(s('rerunWizardConfirm'))) return;
    if(typeof clearSetupWizardFlag==='function') clearSetupWizardFlag();
    toast(s('rerunWizardToast'),'info');
    setTimeout(()=>location.reload(),300);
  });

  spy();

  /* ---- deep link: jump to a specific section (e.g. account-menu "Preferences") ---- */
  if(params&&params.section){
    const target=navs.find(n=>n.dataset.target===params.section);
    if(target){
      navs.forEach(x=>x.classList.toggle('on',x===target));
      const sec=root.querySelector('#'+params.section);
      if(sec){ scroller.scrollTop=Math.max(0,topOf(sec)-8); }
    }
  }
};
