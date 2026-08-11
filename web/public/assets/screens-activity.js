/* ============================================================
   ARIA ERP — canonical personal activity + notification center
   ============================================================ */

/* Canonical personal activity projection. This intentionally exposes only the
   current actor's sanitized, company-scoped write history. Session, IP,
   security posture and audit payloads belong to separate protected models. */
SCREENS['my-activity'] = async function(root){

  const packs={
    en:{title:'Your activity',sub:'Recorded application changes made by you in this company.',notice:'This history covers recorded application writes only. Sign-in, device and session history are not part of this log.',all:'All',today:'Today',week:'Last 7 days',categories:'Categories',loaded:'Loaded events',empty:'No recorded activity yet',emptyBody:'Actions you complete in this company will appear here.',records:'records',actions:{create:'Created',approve:'Approved',reject:'Rejected',post:'Posted',reverse:'Reversed',update:'Updated',other:'Changed'}},
    ms:{title:'Aktiviti anda',sub:'Perubahan aplikasi yang direkodkan oleh anda dalam syarikat ini.',notice:'Sejarah ini hanya merangkumi penulisan aplikasi yang direkodkan. Sejarah log masuk, peranti dan sesi tidak termasuk.',all:'Semua',today:'Hari ini',week:'7 hari lalu',categories:'Kategori',loaded:'Acara dimuat',empty:'Belum ada aktiviti direkodkan',emptyBody:'Tindakan yang anda lengkapkan dalam syarikat ini akan dipaparkan di sini.',records:'rekod',actions:{create:'Dicipta',approve:'Diluluskan',reject:'Ditolak',post:'Dipost',reverse:'Diterbalikkan',update:'Dikemas kini',other:'Diubah'}},
    zh:{title:'我的活动',sub:'您在当前公司中产生的已记录应用变更。',notice:'此记录仅涵盖已记录的应用写入；登录、设备和会话历史不属于此日志。',all:'全部',today:'今天',week:'近 7 天',categories:'类别',loaded:'已载入事件',empty:'暂无活动记录',emptyBody:'您在当前公司完成的操作将显示在这里。',records:'条记录',actions:{create:'已创建',approve:'已批准',reject:'已拒绝',post:'已过账',reverse:'已冲销',update:'已更新',other:'已变更'}},
    ja:{title:'自分のアクティビティ',sub:'この会社で自分が行った記録済みの変更です。',notice:'記録済みのアプリ書き込みのみを表示します。サインイン、端末、セッション履歴は含まれません。',all:'すべて',today:'今日',week:'過去7日',categories:'カテゴリ',loaded:'読込イベント',empty:'記録された活動はありません',emptyBody:'この会社で完了した操作がここに表示されます。',records:'件',actions:{create:'作成',approve:'承認',reject:'却下',post:'転記',reverse:'取消',update:'更新',other:'変更'}},
    vi:{title:'Hoạt động của bạn',sub:'Các thay đổi ứng dụng đã ghi nhận do bạn thực hiện trong công ty này.',notice:'Lịch sử này chỉ gồm các thao tác ghi ứng dụng đã được ghi nhận; không gồm lịch sử đăng nhập, thiết bị hoặc phiên.',all:'Tất cả',today:'Hôm nay',week:'7 ngày qua',categories:'Danh mục',loaded:'Sự kiện đã tải',empty:'Chưa có hoạt động được ghi nhận',emptyBody:'Các thao tác bạn hoàn tất trong công ty này sẽ xuất hiện tại đây.',records:'bản ghi',actions:{create:'Đã tạo',approve:'Đã duyệt',reject:'Đã từ chối',post:'Đã ghi sổ',reverse:'Đã đảo',update:'Đã cập nhật',other:'Đã thay đổi'}},
  };
  const p=i18nLegacy(packs);
  const categoryLabels={sales:'Sales',purchasing:'Purchasing',crm:'CRM',inventory:'Inventory',warehouse:'Warehouse',manufacturing:'Manufacturing',quality:'Quality',finance:'Finance',assets:'Assets',project:'Projects',service:'Service',hr:'HR',payroll:'Payroll',admin:'Administration',integration:'Integration',system:'System'};
  const entityLabels={orders:'Order',invoices:'Invoice',enquiries:'Enquiry',quotations:'Quotation',deliveries:'Delivery',returns:'Return',products:'Product',adjustments:'Adjustment',transfers:'Transfer',journals:'Journal',opportunities:'Opportunity',users:'User',user:'User',role:'Role',permission:'Permission',module:'Module',invitation:'Invitation',session:'Session',system:'System'};
  const result=await listPage('account/activity',{limit:100});
  const rows=(result.data||[]).map(row=>({...row,occurredAt:new Date(row.occurredAt)}));
  const now=new Date();
  const todayKey=dateValue(now);
  const weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-7);
  const today=rows.filter(row=>dateValue(row.occurredAt)===todayKey).length;
  const week=rows.filter(row=>row.occurredAt>=weekStart).length;
  const cats=[...new Set(rows.map(row=>row.category))];
  const tone={create:'teal',approve:'ok',reject:'danger',post:'violet',reverse:'warn',update:'accent',other:'slate'};
  const icon={create:'plus',approve:'checkc',reject:'xc',post:'book',reverse:'refresh',update:'edit',other:'history'};
  const rowHtml=row=>`<div class="act-row" data-category="${esc(row.category)}">
    <span class="act-ic ${tone[row.actionKind]||'slate'}">${ic(icon[row.actionKind]||'history')}</span>
    <div class="act-main"><div class="act-line">${esc(p.actions[row.actionKind]||p.actions.other)} <span class="obj">${esc(entityLabels[row.entityKey]||String(row.entityKey).replaceAll('-',' '))}${row.entityId?` · ${esc(row.entityId)}`:''}</span></div><small>${esc(categoryLabels[row.category]||row.category)}</small></div>
    <div class="act-right"><span class="act-time">${esc(dateTimeValue(row.occurredAt))}</span></div>
  </div>`;
  const body=`<style>
    .activity-canonical{padding:8px 24px 44px}.activity-notice{display:flex;gap:9px;align-items:flex-start;margin-bottom:14px;padding:11px 13px;border:1px solid var(--accent-border);border-radius:var(--r-m);background:var(--accent-tint);color:var(--muted);font-size:12.5px;line-height:1.45}.activity-notice svg{width:16px;height:16px;flex:none;color:var(--accent);margin-top:1px}
    .activity-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}.activity-kpi{padding:13px 15px;border:1px solid var(--hairline);border-radius:var(--r-m);background:var(--surface)}.activity-kpi small{display:block;color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.activity-kpi b{display:block;margin-top:5px;font-size:22px;font-variant-numeric:tabular-nums}
    .activity-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:10px}.activity-toolbar .filterchips{display:flex;flex-wrap:wrap;gap:6px}.activity-count{margin-left:auto;color:var(--muted);font-size:12px;white-space:nowrap}.activity-canonical .act-feed{overflow:hidden;border:1px solid var(--hairline);border-radius:var(--r-l);background:var(--surface)}.activity-canonical .act-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:13px;align-items:center;padding:13px 15px;border-bottom:1px solid var(--hairline)}.activity-canonical .act-row:last-child{border-bottom:0}.activity-canonical .act-ic{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--surface-2);color:var(--muted)}.activity-canonical .act-ic svg{width:17px;height:17px}.activity-canonical .act-ic.accent{background:var(--accent-tint);color:var(--accent)}.activity-canonical .act-ic.ok,.activity-canonical .act-ic.teal{background:var(--ok-tint);color:var(--ok)}.activity-canonical .act-ic.danger{background:var(--danger-tint);color:var(--danger)}.activity-canonical .act-ic.violet{background:var(--violet-tint);color:var(--violet)}.activity-canonical .act-ic.warn{background:var(--warn-tint);color:var(--warn)}.activity-canonical .act-main{min-width:0}.activity-canonical .act-line{font-size:13.5px;font-weight:500}.activity-canonical .act-line .obj{color:var(--accent);font-weight:600}.activity-canonical .act-main small{display:block;margin-top:2px;color:var(--muted);font-size:12px}.activity-canonical .act-time{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
    @media(max-width:700px){.activity-canonical{padding:6px 14px 32px}.activity-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.activity-canonical .act-row{grid-template-columns:34px minmax(0,1fr)}.activity-canonical .act-right{grid-column:2}.activity-count{display:none}}
  </style><div class="activity-canonical" data-personal-activity-canonical="true">
    <div class="activity-notice">${ic('info')}<span>${esc(p.notice)}</span></div>
    <div class="activity-kpis">
      <div class="activity-kpi"><small>${esc(p.loaded)}</small><b>${rows.length}</b></div>
      <div class="activity-kpi"><small>${esc(p.today)}</small><b>${today}</b></div>
      <div class="activity-kpi"><small>${esc(p.week)}</small><b>${week}</b></div>
      <div class="activity-kpi"><small>${esc(p.categories)}</small><b>${cats.length}</b></div>
    </div>
    <div class="activity-toolbar"><div class="filterchips" id="personalActivityFilters"><button class="chip on" data-filter="all">${esc(p.all)}</button>${cats.map(cat=>`<button class="chip" data-filter="${esc(cat)}">${esc(categoryLabels[cat]||cat)}</button>`).join('')}</div><span class="activity-count">${rows.length} ${esc(p.records)}</span></div>
    <div class="act-feed" id="personalActivityFeed">${rows.length?rows.map(rowHtml).join(''):statePanel({icon:'history',title:p.empty,body:p.emptyBody})}</div>
  </div>`;
  root.innerHTML=modulePage({module:'account',route:'my-activity',active:'my-activity',title:p.title,count:rows.length,sub:p.sub,body});
  root.querySelectorAll('#personalActivityFilters .chip').forEach(button=>button.addEventListener('click',()=>{
    const filter=button.dataset.filter;
    root.querySelectorAll('#personalActivityFilters .chip').forEach(chip=>chip.classList.toggle('on',chip===button));
    root.querySelectorAll('#personalActivityFeed .act-row').forEach(row=>{row.hidden=filter!=='all'&&row.dataset.category!==filter;});
  }));
};

/* First-class, actor-addressed notification feed. Read/dismiss state is stored
   in app_notification, never inferred from audit/outbox or localStorage. */
SCREENS['notifications'] = async function(root){

  const packs={
    en:{title:'Notifications',sub:'Items delivered to you in this company.',notice:'Only notifications addressed to your user and active company are shown.',total:'Active notifications',unread:'Unread',today:'Today',categories:'Categories',all:'All',earlier:'Earlier',markAll:'Mark all read',dismissAll:'Dismiss all',mark:'Mark as read',dismiss:'Dismiss',open:'Open',empty:'You’re all caught up',emptyBody:'No notifications match this filter.',loadError:'Notifications could not be loaded',retry:'Retry',done:'All notifications marked read',cleared:'Notifications dismissed',cats:{approval:'Approvals',inventory:'Inventory',quality:'Quality',finance:'Finance',sales:'Sales',integration:'Integration',system:'System'}},
    ms:{title:'Pemberitahuan',sub:'Perkara yang dihantar kepada anda dalam syarikat ini.',notice:'Hanya pemberitahuan untuk pengguna dan syarikat aktif anda dipaparkan.',total:'Pemberitahuan aktif',unread:'Belum dibaca',today:'Hari ini',categories:'Kategori',all:'Semua',earlier:'Terdahulu',markAll:'Tanda semua dibaca',dismissAll:'Tutup semua',mark:'Tanda dibaca',dismiss:'Tutup',open:'Buka',empty:'Semuanya selesai',emptyBody:'Tiada pemberitahuan sepadan dengan penapis ini.',loadError:'Pemberitahuan tidak dapat dimuatkan',retry:'Cuba lagi',done:'Semua pemberitahuan ditanda dibaca',cleared:'Pemberitahuan ditutup',cats:{approval:'Kelulusan',inventory:'Inventori',quality:'Kualiti',finance:'Kewangan',sales:'Jualan',integration:'Integrasi',system:'Sistem'}},
    zh:{title:'通知中心',sub:'当前公司中发送给您的事项。',notice:'这里只显示发送给当前用户及当前公司的通知。',total:'有效通知',unread:'未读',today:'今天',categories:'类别',all:'全部',earlier:'较早',markAll:'全部标为已读',dismissAll:'全部关闭',mark:'标为已读',dismiss:'关闭',open:'打开',empty:'目前没有待处理通知',emptyBody:'没有符合此筛选条件的通知。',loadError:'无法载入通知',retry:'重试',done:'所有通知已标为已读',cleared:'通知已关闭',cats:{approval:'审批',inventory:'库存',quality:'质量',finance:'财务',sales:'销售',integration:'集成',system:'系统'}},
    ja:{title:'通知',sub:'この会社で自分宛に配信された項目です。',notice:'現在のユーザーと会社に配信された通知だけを表示します。',total:'有効な通知',unread:'未読',today:'今日',categories:'カテゴリ',all:'すべて',earlier:'以前',markAll:'すべて既読にする',dismissAll:'すべて閉じる',mark:'既読にする',dismiss:'閉じる',open:'開く',empty:'対応は完了しています',emptyBody:'このフィルターに一致する通知はありません。',loadError:'通知を読み込めませんでした',retry:'再試行',done:'すべて既読にしました',cleared:'通知を閉じました',cats:{approval:'承認',inventory:'在庫',quality:'品質',finance:'財務',sales:'販売',integration:'連携',system:'システム'}},
    vi:{title:'Thông báo',sub:'Các mục được gửi cho bạn trong công ty này.',notice:'Chỉ hiển thị thông báo dành cho người dùng và công ty hiện tại.',total:'Thông báo đang hoạt động',unread:'Chưa đọc',today:'Hôm nay',categories:'Danh mục',all:'Tất cả',earlier:'Trước đó',markAll:'Đánh dấu tất cả đã đọc',dismissAll:'Đóng tất cả',mark:'Đánh dấu đã đọc',dismiss:'Đóng',open:'Mở',empty:'Bạn đã xử lý xong',emptyBody:'Không có thông báo phù hợp với bộ lọc này.',loadError:'Không thể tải thông báo',retry:'Thử lại',done:'Đã đánh dấu tất cả là đã đọc',cleared:'Đã đóng thông báo',cats:{approval:'Phê duyệt',inventory:'Tồn kho',quality:'Chất lượng',finance:'Tài chính',sales:'Bán hàng',integration:'Tích hợp',system:'Hệ thống'}},
  };
  const p=i18nLegacy(packs);
  let rows=[];
  try{ rows=await loadNotifications(); }
  catch(error){
    const body=`<div class="notification-error">${statePanel({icon:'error',title:p.loadError,body:(error&&error.message)||p.loadError})}<button class="btn primary" data-notification-retry>${ic('refresh')}<span>${esc(p.retry)}</span></button></div>`;
    root.innerHTML=modulePage({module:'account',route:'notifications',active:'notifications',title:p.title,sub:p.sub,body});
    root.querySelector('[data-notification-retry]')?.addEventListener('click',()=>navigate('notifications'));
    return;
  }
  let filter='all';
  let busy=false;
  const filtered=()=>filter==='all'?rows:filter==='unread'?rows.filter(row=>row.unread):rows.filter(row=>row.cat===filter);
  const rowHtml=row=>`<div class="notification-row ${row.unread?'unread':''}" data-id="${esc(row.id)}" ${row.route?`data-route="${esc(row.route)}"`:''}>
    <span class="wc-ic ${esc(row.clr)}">${ic(row.ic)}</span>
    <div class="notification-main"><div class="notification-subject"><b>${esc(row.title)}</b>${row.unread?'<span class="notification-dot"></span>':''}</div><p>${esc(row.body)}</p><small>${esc(p.cats[row.cat]||row.cat)} · ${esc(row.t)}${row.entityRef?` · ${esc(row.entityRef)}`:''}${row.route?` · <span>${esc(p.open)} ${ic('arrowR')}</span>`:''}</small></div>
    <div class="notification-actions">${row.unread?`<button class="iconbtn" data-notification-action="read" aria-label="${esc(p.mark)}" data-tip="${esc(p.mark)}">${ic('check')}</button>`:''}<button class="iconbtn" data-notification-action="dismiss" aria-label="${esc(p.dismiss)}" data-tip="${esc(p.dismiss)}">${ic('x')}</button></div>
  </div>`;
  function render(){
    const categories=[...new Set(rows.map(row=>row.cat))];
    if(filter!=='all'&&filter!=='unread'&&!categories.includes(filter))filter='all';
    const shown=filtered();
    const unread=rows.filter(row=>row.unread).length;
    const today=rows.filter(row=>row.group==='today').length;
    const chips=[['all',p.all,rows.length],['unread',p.unread,unread],...categories.map(cat=>[cat,p.cats[cat]||cat,rows.filter(row=>row.cat===cat).length])];
    const feed=[['today',p.today],['earlier',p.earlier]].map(([group,label])=>{
      const grouped=shown.filter(row=>row.group===group);
      return grouped.length?`<section class="notification-group"><div class="notification-group-title"><span>${esc(label)}</span><i></i><span>${grouped.length}</span></div><div class="notification-list">${grouped.map(rowHtml).join('')}</div></section>`:'';
    }).join('')||statePanel({icon:'checkc',title:p.empty,body:p.emptyBody});
    const body=`<style>
      .notifications-canonical{padding:8px 24px 44px}.notification-notice{display:flex;gap:9px;align-items:flex-start;margin-bottom:14px;padding:11px 13px;border:1px solid var(--accent-border);border-radius:var(--r-m);background:var(--accent-tint);color:var(--muted);font-size:12.5px;line-height:1.45}.notification-notice svg{width:16px;height:16px;color:var(--accent);flex:none;margin-top:1px}
      .notification-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}.notification-kpi{padding:13px 15px;border:1px solid var(--hairline);border-radius:var(--r-m);background:var(--surface)}.notification-kpi small{display:block;color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.notification-kpi b{display:block;margin-top:5px;font-size:22px;font-variant-numeric:tabular-nums}
      .notification-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:12px}.notification-toolbar .filterchips{display:flex;flex-wrap:wrap;gap:6px}.notification-toolbar .notification-bulk{display:flex;gap:7px;margin-left:auto}.notification-group{margin-top:15px}.notification-group-title{display:flex;align-items:center;gap:9px;margin-bottom:8px;color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.notification-group-title i{height:1px;flex:1;background:var(--hairline)}
      .notification-list{overflow:hidden;border:1px solid var(--hairline);border-radius:var(--r-l);background:var(--surface)}.notification-row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:13px;align-items:start;padding:14px 15px;border-bottom:1px solid var(--hairline);cursor:pointer}.notification-row:last-child{border-bottom:0}.notification-row:hover{background:var(--surface-2)}.notification-row.unread{background:color-mix(in srgb,var(--accent) 4%,transparent)}.notification-main{min-width:0}.notification-subject{display:flex;gap:8px;align-items:center}.notification-subject b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px}.notification-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none}.notification-main p{margin:3px 0 0;color:var(--muted);font-size:12.5px;line-height:1.45}.notification-main small{display:flex;align-items:center;gap:4px;margin-top:7px;color:var(--faint);font-size:11.5px}.notification-main small span{display:inline-flex;align-items:center;color:var(--accent);font-weight:600}.notification-main small svg{width:13px;height:13px}.notification-actions{display:flex;gap:4px;opacity:0}.notification-row:hover .notification-actions,.notification-actions:focus-within{opacity:1}.notification-error{padding:40px 24px;text-align:center}.notification-error .btn{margin-top:12px}
      @media(max-width:700px){.notifications-canonical{padding:6px 14px 32px}.notification-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.notification-toolbar{align-items:flex-start;flex-direction:column}.notification-toolbar .notification-bulk{margin-left:0;width:100%}.notification-toolbar .notification-bulk .btn{flex:1}.notification-row{grid-template-columns:34px minmax(0,1fr)}.notification-actions{grid-column:2;opacity:1}.notification-main small{flex-wrap:wrap}}
    </style><div class="notifications-canonical" data-notifications-canonical="true">
      <div class="notification-notice">${ic('info')}<span>${esc(p.notice)}</span></div>
      <div class="notification-kpis"><div class="notification-kpi"><small>${esc(p.total)}</small><b>${rows.length}</b></div><div class="notification-kpi"><small>${esc(p.unread)}</small><b>${unread}</b></div><div class="notification-kpi"><small>${esc(p.today)}</small><b>${today}</b></div><div class="notification-kpi"><small>${esc(p.categories)}</small><b>${categories.length}</b></div></div>
      <div class="notification-toolbar"><div class="filterchips" id="notificationFilters">${chips.map(([key,label,count])=>`<button class="chip ${filter===key?'on':''}" data-filter="${esc(key)}">${esc(label)} <span>${count}</span></button>`).join('')}</div><div class="notification-bulk"><button class="btn soft" data-notification-bulk="read" ${unread?'':'disabled'}>${ic('checkc')}<span>${esc(p.markAll)}</span></button><button class="btn soft" data-notification-bulk="dismiss" ${rows.length?'':'disabled'}>${ic('x')}<span>${esc(p.dismissAll)}</span></button></div></div>
      <div id="notificationFeed">${feed}</div>
    </div>`;
    root.innerHTML=modulePage({module:'account',route:'notifications',active:'notifications',title:p.title,count:rows.length,sub:p.sub,body});
    wire();
  }
  async function run(action,id){
    if(busy)return;busy=true;
    try{
      if(action==='read')await markNotificationRead(id);
      else if(action==='dismiss')await dismissNotification(id);
      else if(action==='readall')await markAllNotificationsRead();
      else await dismissAllNotifications();
      refreshNotifs();
      rows=DB.notifications.slice();
      render();
      if(action==='readall')toast(p.done,'ok');
      if(action==='dismissall')toast(p.cleared,'info');
    }catch(error){toast((error&&error.message)||p.loadError,'danger');}finally{busy=false;}
  }
  function wire(){
    root.querySelectorAll('#notificationFilters .chip').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;render();}));
    root.querySelectorAll('.notification-row').forEach(row=>row.addEventListener('click',async event=>{
      if(event.target.closest('[data-notification-action]'))return;
      try{
        if(row.classList.contains('unread')) await markNotificationRead(row.dataset.id);
        refreshNotifs();
        const destination=row.dataset.route
          ?notificationDestination({route:row.dataset.route}) : '';
        if(destination) navigate(destination);
        else{ rows=DB.notifications.slice(); render(); }
      }catch(error){toast((error&&error.message)||p.loadError,'danger');}
    }));
    root.querySelectorAll('[data-notification-action]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();run(button.dataset.notificationAction,button.closest('.notification-row').dataset.id);}));
    root.querySelector('[data-notification-bulk="read"]')?.addEventListener('click',()=>run('readall'));
    root.querySelector('[data-notification-bulk="dismiss"]')?.addEventListener('click',()=>run('dismissall'));
  }
  render();
};
