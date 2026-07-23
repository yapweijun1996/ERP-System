/* ============================================================
   ARIA ERP — canonical personal activity + notification center
   ============================================================ */

/* Canonical personal activity projection. This intentionally exposes only the
   current actor's sanitized, company-scoped write history. Session, IP,
   security posture and audit payloads belong to separate protected models. */
SCREENS['my-activity'] = async function(root){
  const lang=typeof getLang==='function'?getLang():'en';
  const packs={
    en:{title:'Your activity',sub:'Recorded application changes made by you in this company.',notice:'This history covers recorded application writes only. Sign-in, device and session history are not part of this log.',all:'All',today:'Today',week:'Last 7 days',categories:'Categories',loaded:'Loaded events',empty:'No recorded activity yet',emptyBody:'Actions you complete in this company will appear here.',records:'records',actions:{create:'Created',approve:'Approved',reject:'Rejected',post:'Posted',reverse:'Reversed',update:'Updated',other:'Changed'}},
    ms:{title:'Aktiviti anda',sub:'Perubahan aplikasi yang direkodkan oleh anda dalam syarikat ini.',notice:'Sejarah ini hanya merangkumi penulisan aplikasi yang direkodkan. Sejarah log masuk, peranti dan sesi tidak termasuk.',all:'Semua',today:'Hari ini',week:'7 hari lalu',categories:'Kategori',loaded:'Acara dimuat',empty:'Belum ada aktiviti direkodkan',emptyBody:'Tindakan yang anda lengkapkan dalam syarikat ini akan dipaparkan di sini.',records:'rekod',actions:{create:'Dicipta',approve:'Diluluskan',reject:'Ditolak',post:'Dipost',reverse:'Diterbalikkan',update:'Dikemas kini',other:'Diubah'}},
    zh:{title:'我的活动',sub:'您在当前公司中产生的已记录应用变更。',notice:'此记录仅涵盖已记录的应用写入；登录、设备和会话历史不属于此日志。',all:'全部',today:'今天',week:'近 7 天',categories:'类别',loaded:'已载入事件',empty:'暂无活动记录',emptyBody:'您在当前公司完成的操作将显示在这里。',records:'条记录',actions:{create:'已创建',approve:'已批准',reject:'已拒绝',post:'已过账',reverse:'已冲销',update:'已更新',other:'已变更'}},
    ja:{title:'自分のアクティビティ',sub:'この会社で自分が行った記録済みの変更です。',notice:'記録済みのアプリ書き込みのみを表示します。サインイン、端末、セッション履歴は含まれません。',all:'すべて',today:'今日',week:'過去7日',categories:'カテゴリ',loaded:'読込イベント',empty:'記録された活動はありません',emptyBody:'この会社で完了した操作がここに表示されます。',records:'件',actions:{create:'作成',approve:'承認',reject:'却下',post:'転記',reverse:'取消',update:'更新',other:'変更'}},
    vi:{title:'Hoạt động của bạn',sub:'Các thay đổi ứng dụng đã ghi nhận do bạn thực hiện trong công ty này.',notice:'Lịch sử này chỉ gồm các thao tác ghi ứng dụng đã được ghi nhận; không gồm lịch sử đăng nhập, thiết bị hoặc phiên.',all:'Tất cả',today:'Hôm nay',week:'7 ngày qua',categories:'Danh mục',loaded:'Sự kiện đã tải',empty:'Chưa có hoạt động được ghi nhận',emptyBody:'Các thao tác bạn hoàn tất trong công ty này sẽ xuất hiện tại đây.',records:'bản ghi',actions:{create:'Đã tạo',approve:'Đã duyệt',reject:'Đã từ chối',post:'Đã ghi sổ',reverse:'Đã đảo',update:'Đã cập nhật',other:'Đã thay đổi'}},
  };
  const p=packs[lang]||packs.en;
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
  root.innerHTML=modulePage({module:'admin',route:'my-activity',active:'my-activity',title:p.title,count:rows.length,sub:p.sub,body});
  root.querySelectorAll('#personalActivityFilters .chip').forEach(button=>button.addEventListener('click',()=>{
    const filter=button.dataset.filter;
    root.querySelectorAll('#personalActivityFilters .chip').forEach(chip=>chip.classList.toggle('on',chip===button));
    root.querySelectorAll('#personalActivityFeed .act-row').forEach(row=>{row.hidden=filter!=='all'&&row.dataset.category!==filter;});
  }));
};

/* ============================================================
   NOTIFICATION CENTER (full page) — the bell popover, expanded
   ============================================================ */
SCREENS['notifications'] = function(root){
  const CATS = DB.notifCats;
  let filter = 'all';
  const live = ()=>DB.notifications.filter(n=>!n.dismissed);
  const catTone = c=>({approval:'accent',system:'slate',inventory:'warn',quality:'danger',finance:'violet',sales:'teal'}[c]||'slate');

  function chips(){
    const it=live();
    const base=[['all','All',it.length],['unread','Unread',it.filter(n=>n.unread).length]];
    const cats=[...new Set(it.map(n=>n.cat))];
    cats.forEach(c=>base.push([c, CATS[c]||c, it.filter(n=>n.cat===c).length]));
    return base;
  }
  function filtered(){ const it=live(); return filter==='all'?it:filter==='unread'?it.filter(n=>n.unread):it.filter(n=>n.cat===filter); }

  function row(n){
    return `<div class="ntf ${n.unread?'unread':''}" data-id="${esc(n.id)}" ${n.route?`data-route="${esc(n.route)}"`:''}>
      <span class="wc-ic ${n.clr}">${ic(n.ic)}</span>
      <div class="ntf-main">
        <div class="ntf-h"><b>${esc(n.title)}</b>${n.unread?'<span class="ntf-dot"></span>':''}</div>
        <p>${esc(n.body)}</p>
        <span class="ntf-meta"><span class="ntf-cat">${esc(CATS[n.cat]||n.cat)}</span> · ${esc(n.t)}${n.route?` · <span class="ntf-go">Open${ic('arrowR')}</span>`:''}</span>
      </div>
      <div class="ntf-actions">
        ${n.unread?`<button class="iconbtn" data-act="read" data-tip="Mark as read" aria-label="Mark as read">${ic('check')}</button>`:''}
        <button class="iconbtn" data-act="dismiss" data-tip="Dismiss" aria-label="Dismiss">${ic('x')}</button>
      </div>
    </div>`;
  }
  function feed(){
    let out='';
    [['today','Today'],['earlier','Earlier']].forEach(([g,lbl])=>{
      const rows=filtered().filter(n=>n.group===g);
      if(!rows.length) return;
      out+=`<div class="ntf-day"><span>${lbl}</span><span class="ln"></span><span class="ct">${rows.length}</span></div><div class="ntf-list">${rows.map(row).join('')}</div>`;
    });
    if(!out) out=statePanel({icon:'checkc',title:'You’re all caught up',body:'No notifications match this filter — try “All”.'});
    return out;
  }
  function rail(){
    const it=live(); const cats=[...new Set(it.map(n=>n.cat))];
    const max=Math.max(1,...cats.map(c=>it.filter(n=>n.cat===c).length));
    const bars=cats.map(c=>{ const ct=it.filter(n=>n.cat===c).length; return `<button class="ntf-modbar" data-cat="${c}">
      <span class="nm">${esc(CATS[c]||c)}</span>
      <span class="track"><i style="width:${Math.round(ct/max*100)}%;background:var(--${catTone(c)==='slate'?'muted':catTone(c)})"></i></span>
      <span class="ct tnum">${ct}</span></button>`; }).join('');
    return `<aside class="ntf-aside">
      <div class="panel">
        <div class="panel-h"><h3>By category</h3></div>
        <div class="panel-body">${bars||'<div style="color:var(--muted);font-size:13px">No notifications.</div>'}</div>
      </div>
      <div class="panel">
        <div class="panel-h"><h3>Preferences</h3><button class="btn plain sm" style="margin-left:auto" onclick="navigate('settings')">${ic('gear')}<span>Manage</span></button></div>
        <div class="panel-body" style="padding-top:6px">
          <div class="field"><span class="k">Email digest</span><span class="v">Daily · 8:00</span></div>
          <div class="field"><span class="k">Approvals</span><span class="v">Push + email</span></div>
          <div class="field"><span class="k">Mentions</span><span class="v">Push</span></div>
        </div>
        <div class="sec-foot2">${ic('checkc')}<span>Only you receive these alerts.</span></div>
      </div>
    </aside>`;
  }

  function render(){
    const it=live(); const unread=it.filter(n=>n.unread).length;
    root.innerHTML=`
    <style>
      .ntf-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start;padding:8px 24px 44px;}
      @media(max-width:1080px){.ntf-grid{grid-template-columns:1fr;}}
      .ntf-tools{display:flex;align-items:center;gap:8px;margin:4px 0 2px;flex-wrap:wrap;}
      .ntf-tools .filterchips{display:flex;gap:6px;flex-wrap:wrap;}
      .ntf-tools .chip .n{margin-left:6px;color:var(--faint);font-variant-numeric:tabular-nums;}
      .ntf-tools .chip.on .n{color:var(--accent);}
      .ntf-day{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin:20px 0 9px;display:flex;align-items:center;gap:9px;}
      .ntf-day .ln{flex:1;height:1px;background:var(--hairline);}
      .ntf-day .ct{color:var(--faint);font-weight:600;}
      .ntf-list{background:var(--surface);border:1px solid var(--hairline);border-radius:var(--r-l);overflow:hidden;}
      .ntf{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:13px;align-items:start;padding:14px 15px;border-bottom:1px solid var(--hairline);cursor:pointer;transition:background .12s;position:relative;}
      .ntf:last-child{border-bottom:none;}
      .ntf:hover{background:var(--surface-2);}
      .ntf.unread{background:color-mix(in srgb,var(--accent) 4%,transparent);}
      .ntf.unread:hover{background:color-mix(in srgb,var(--accent) 7%,transparent);}
      .ntf-main{min-width:0;}
      .ntf-h{display:flex;align-items:center;gap:8px;}
      .ntf-h b{font-size:13.5px;font-weight:600;letter-spacing:-.005em;}
      .ntf-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none;}
      .ntf-main p{margin:3px 0 0;color:var(--muted);font-size:12.5px;line-height:1.45;}
      .ntf-meta{display:inline-flex;align-items:center;gap:4px;margin-top:7px;font-size:11.5px;color:var(--faint);}
      .ntf-cat{color:var(--muted);font-weight:600;}
      .ntf-go{display:inline-flex;align-items:center;gap:2px;color:var(--accent);font-weight:600;}
      .ntf-go svg{width:13px;height:13px;}
      .ntf-actions{display:flex;gap:4px;align-items:center;opacity:0;transition:opacity .12s;}
      .ntf:hover .ntf-actions{opacity:1;}
      .ntf-aside{display:flex;flex-direction:column;gap:16px;position:sticky;top:8px;}
      .ntf-aside .panel-body{padding:13px 15px;}
      .ntf-modbar{display:flex;align-items:center;gap:11px;padding:6px 0;font-size:12.5px;width:100%;text-align:left;cursor:pointer;}
      .ntf-modbar:hover .nm{color:var(--accent);}
      .ntf-modbar .nm{width:84px;flex:none;color:var(--fg);}
      .ntf-modbar .track{flex:1;height:7px;border-radius:4px;background:var(--surface-2);overflow:hidden;}
      .ntf-modbar .track i{display:block;height:100%;border-radius:4px;}
      .ntf-modbar .ct{width:22px;text-align:right;font-weight:600;color:var(--muted);}
      .sec-foot2{display:flex;align-items:center;gap:8px;padding:11px 15px;border-top:1px solid var(--hairline);font-size:12px;color:var(--muted);}
      .sec-foot2 svg{width:14px;height:14px;color:var(--ok);flex:none;}
    </style>
    <div class="content full"><section class="master"><div class="scrollarea">
      <div class="pagehead">
        ${crumbs([DB.company.name,'Account','Notifications'])}
        <div class="h1row"><h1>Notifications</h1>${unread?`<span class="countchip">${unread} unread</span>`:''}
          <div class="headright">
            ${btn('Mark all read',{icon:'checkc',cls:'soft',attrs:`data-nc="readall" ${unread?'':'disabled style="opacity:.5;pointer-events:none"'}`})}
            ${btn('Clear all',{icon:'trash',cls:'soft',attrs:`data-nc="clearall" ${it.length?'':'disabled style="opacity:.5;pointer-events:none"'}`})}
          </div></div>
        <div class="h1sub">Everything that needs your attention across Aria — approvals, exceptions and system events. Click any item to jump to its source.</div>
      </div>
      <div class="ntf-grid">
        <div>
          <div class="ntf-tools"><div class="filterchips" id="ntfChips">
            ${chips().map(c=>`<button class="chip ${c[0]===filter?'on':''}" data-f="${c[0]}">${esc(c[1])}<span class="n">${c[2]}</span></button>`).join('')}
          </div></div>
          <div id="ntfFeed">${feed()}</div>
        </div>
        ${rail()}
      </div>
    </div></section></div>`;
    wire();
  }

  function wire(){
    root.querySelectorAll('#ntfChips .chip').forEach(c=>c.addEventListener('click',()=>{ filter=c.dataset.f; render(); }));
    root.querySelectorAll('.ntf-modbar').forEach(b=>b.addEventListener('click',()=>{ filter=b.dataset.cat; render(); }));
    root.querySelectorAll('.ntf').forEach(rw=>rw.addEventListener('click',e=>{
      if(e.target.closest('[data-act]')) return;
      markNotificationRead(rw.dataset.id);
      updateBellBadge(); refreshNotifs();
      if(rw.dataset.route) navigate(rw.dataset.route);
    }));
    root.querySelectorAll('[data-act="read"]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();
      markNotificationRead(b.closest('.ntf').dataset.id);
      updateBellBadge(); refreshNotifs(); render();
    }));
    root.querySelectorAll('[data-act="dismiss"]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();
      dismissNotification(b.closest('.ntf').dataset.id);
      updateBellBadge(); refreshNotifs(); render(); toast('Notification dismissed','info');
    }));
    const ra=root.querySelector('[data-nc="readall"]'); ra&&ra.addEventListener('click',()=>{ markAllNotificationsRead(); updateBellBadge(); refreshNotifs(); render(); toast('All caught up','ok'); });
    const ca=root.querySelector('[data-nc="clearall"]'); ca&&ca.addEventListener('click',()=>{ dismissAllNotifications(); updateBellBadge(); refreshNotifs(); render(); toast('Notifications cleared','info'); });
  }

  render();
};
