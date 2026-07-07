/* ============================================================
   ARIA ERP — screen: Your activity (personal account log)
   ============================================================ */

SCREENS['my-activity'] = function(root){
  const A = DB.myActivity;
  const u = DB.user;

  /* type -> icon + tone (reuses dashboard wc-ic tones) */
  const TYPE = {
    approve:{ icon:'flow',    tone:'accent', label:'Approval' },
    reject: {  icon:'xc',      tone:'danger', label:'Rejection' },
    post:   {  icon:'book',    tone:'violet', label:'Posting' },
    edit:   {  icon:'edit',    tone:'warn',   label:'Edit' },
    create: {  icon:'plus',    tone:'teal',   label:'Created' },
    comment:{  icon:'comment', tone:'teal',   label:'Comment' },
    export: {  icon:'download',tone:'slate',  label:'Export' },
    login:  {  icon:'shield',  tone:'ok',     label:'Sign-in' },
  };
  /* filter chip -> set of types */
  const FILTERS = [
    ['all',      'All',         null],
    ['approve',  'Approvals',   ['approve','reject']],
    ['post',     'Postings',    ['post']],
    ['edit',     'Edits',       ['edit','create']],
    ['comment',  'Comments',    ['comment']],
    ['login',    'Sign-ins',    ['login']],
  ];
  let filter = 'all';

  function itemRow(it){
    const ty = TYPE[it.type] || TYPE.edit;
    const clickable = it.route ? `data-route="${esc(it.route)}"` : '';
    return `<div class="act-row ${it.route?'':'noclick'}" ${clickable}>
      <span class="act-ic ${ty.tone}">${ic(ty.icon)}</span>
      <div class="act-main">
        <div class="act-line">${esc(it.what)}${it.obj?` <span class="obj">${esc(it.obj)}</span>`:''}</div>
        ${it.sub?`<small>${esc(it.sub)}</small>`:''}
        ${it.chg?`<div class="act-chg"><span class="cf">${esc(it.chg.field)}</span><span class="old">${esc(it.chg.old)}</span>${ic('arrowR')}<span class="new">${esc(it.chg.new)}</span></div>`:''}
      </div>
      <div class="act-right"><span class="act-time">${esc(it.time)}</span><span class="act-typ">${ty.label}</span></div>
    </div>`;
  }

  function feedHtml(){
    const allow = FILTERS.find(f=>f[0]===filter)[2];
    let out = '';
    A.feed.forEach(grp=>{
      const items = allow ? grp.items.filter(i=>allow.includes(i.type)) : grp.items;
      if(!items.length) return;
      out += `<div class="act-day"><span>${esc(grp.day)}</span>${grp.date?`<span class="dt">${esc(grp.date)}</span>`:''}<span class="ln"></span><span class="ct">${items.length} ${items.length===1?'action':'actions'}</span></div>
        <div class="act-feed">${items.map(itemRow).join('')}</div>`;
    });
    if(!out) out = statePanel({icon:'inbox',title:'Nothing of this kind yet',body:'Try another filter — your full history is under “All”.'});
    return out;
  }

  /* ---- right rail ---- */
  const maxMod = Math.max(...A.byModule.map(m=>m.ct));
  const modBars = A.byModule.map(m=>`<div class="modbar">
    <span class="nm">${esc(m.m)}</span>
    <span class="track"><i style="width:${Math.round(m.ct/maxMod*100)}%"></i></span>
    <span class="ct tnum">${m.ct}</span>
  </div>`).join('');

  const sessions = A.sessions.map((sx,i)=>`<div class="sess ${sx.current?'cur':''}">
    <span class="sess-ic">${ic(sx.current?'asset':'globe')}</span>
    <div class="sess-main">
      <div class="sess-h"><b>${esc(sx.device)}</b>${sx.current?cap('This device','ok'):''}${sx.flag?`<span class="sess-flag" data-tip="${esc(sx.flag)}">${ic('warn')}</span>`:''}</div>
      <small>${esc(sx.meta)} · ${esc(sx.loc)}</small>
      <small class="mono">${esc(sx.ip)} · ${esc(sx.last)}</small>
    </div>
    ${sx.current?'':`<button class="btn plain sm sess-out" data-sess="${i}">${ic('signout')}<span>Sign out</span></button>`}
  </div>`).join('');

  root.innerHTML = `
  <style>
    .act-grid{display:grid;grid-template-columns:minmax(0,1fr) 326px;gap:20px;align-items:start;padding:8px 24px 44px;}
    @media(max-width:1080px){.act-grid{grid-template-columns:1fr;}}
    .act-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--hairline);border:1px solid var(--hairline);border-radius:var(--r-m);overflow:hidden;}
    .act-stat{background:var(--surface);padding:14px 16px;}
    .act-stat small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;}
    .act-stat b{font-size:25px;font-weight:600;letter-spacing:-.02em;display:block;}
    .act-stat .d{font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.35;}

    .act-tools{display:flex;align-items:center;gap:8px;margin:18px 0 4px;}
    .act-tools .filterchips{display:flex;gap:6px;flex-wrap:wrap;}

    .act-day{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin:20px 0 9px;display:flex;align-items:center;gap:9px;}
    .act-day .dt{color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0;font-size:11.5px;}
    .act-day .ln{flex:1;height:1px;background:var(--hairline);}
    .act-day .ct{color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0;}

    .act-feed{background:var(--surface);border:1px solid var(--hairline);border-radius:var(--r-l);overflow:hidden;}
    .act-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:13px;align-items:start;padding:13px 15px;border-bottom:1px solid var(--hairline);cursor:pointer;transition:background .12s;}
    .act-row:last-child{border-bottom:none;}
    .act-row:hover{background:var(--surface-2);}
    .act-row.noclick{cursor:default;}
    .act-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;margin-top:1px;}
    .act-ic svg{width:17px;height:17px;}
    .act-ic.accent{background:var(--accent-tint);color:var(--accent);}
    .act-ic.ok{background:var(--ok-tint);color:var(--ok);}
    .act-ic.warn{background:var(--warn-tint);color:var(--warn);}
    .act-ic.danger{background:var(--danger-tint);color:var(--danger);}
    .act-ic.violet{background:var(--violet-tint);color:var(--violet);}
    .act-ic.teal{background:var(--teal-tint);color:var(--teal);}
    .act-ic.slate{background:var(--surface-2);color:var(--muted);}
    .act-main{min-width:0;}
    .act-line{font-size:13.5px;font-weight:500;letter-spacing:-.005em;}
    .act-line .obj{color:var(--accent);font-weight:600;}
    .act-main small{display:block;color:var(--muted);font-size:12px;margin-top:2px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;}
    .act-chg{display:inline-flex;align-items:center;gap:7px;margin-top:7px;font-size:12px;background:var(--surface-2);border:1px solid var(--hairline);border-radius:8px;padding:4px 9px;}
    .act-chg svg{width:13px;height:13px;color:var(--muted);}
    .act-chg .cf{color:var(--muted);}
    .act-chg .old{color:var(--danger);text-decoration:line-through;}
    .act-chg .new{color:var(--ok);font-weight:600;}
    .act-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;white-space:nowrap;}
    .act-time{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}
    .act-typ{font-size:10.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;font-weight:600;}

    .act-aside{display:flex;flex-direction:column;gap:16px;position:sticky;top:8px;}
    .act-aside .panel-body{padding:13px 15px;}
    .sess{display:flex;gap:11px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--hairline);}
    .sess:first-child{padding-top:2px;}
    .sess:last-child{border-bottom:none;padding-bottom:2px;}
    .sess-ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;background:var(--surface-2);color:var(--muted);}
    .sess.cur .sess-ic{background:var(--ok-tint);color:var(--ok);}
    .sess-ic svg{width:16px;height:16px;}
    .sess-main{flex:1;min-width:0;}
    .sess-h{display:flex;align-items:center;gap:7px;}
    .sess-h b{font-size:13px;font-weight:600;}
    .sess-flag{color:var(--warn);display:inline-flex;}
    .sess-flag svg{width:14px;height:14px;}
    .sess-main small{display:block;color:var(--muted);font-size:11.5px;margin-top:1px;}
    .sess-main small.mono{font-variant-numeric:tabular-nums;color:var(--faint);}
    .sess-out{flex:none;margin-top:2px;}

    .modbar{display:flex;align-items:center;gap:11px;padding:6px 0;font-size:12.5px;}
    .modbar .nm{width:86px;flex:none;color:var(--fg);}
    .modbar .track{flex:1;height:7px;border-radius:4px;background:var(--surface-2);overflow:hidden;}
    .modbar .track i{display:block;height:100%;background:var(--accent);border-radius:4px;}
    .modbar .ct{width:24px;text-align:right;font-weight:600;color:var(--muted);}

    .sec-foot{display:flex;align-items:center;gap:8px;padding:11px 15px;border-top:1px solid var(--hairline);font-size:12px;color:var(--muted);}
    .sec-foot svg{width:14px;height:14px;color:var(--ok);flex:none;}
  </style>

  <div class="content full"><section class="master"><div class="scrollarea">
    <div class="pagehead">
      ${crumbs([DB.company.name,'Account','Your activity'])}
      <div class="h1row">
        <h1>Your activity</h1>
        <div class="headright">
          <div class="kfig"><small>Today</small><b class="tnum">${A.stats.today}</b></div>
          <div class="kfig"><small>This week</small><b class="tnum">${A.stats.week}</b></div>
          <div class="kfig"><small>This period</small><b class="tnum">${A.stats.period}</b></div>
        </div>
      </div>
      <div class="h1sub">${esc(u.name)} · ${esc(u.role)} — a private log of everything you’ve done in Aria. Only you and auditors can see this.</div>
    </div>

    <div class="act-grid">
      <div>
        <div class="act-stats">
          ${A.summary.map(sx=>`<div class="act-stat"><small>${esc(sx.k)}</small><b class="tnum">${sx.v}</b><div class="d">${esc(sx.d)}</div></div>`).join('')}
        </div>

        <div class="act-tools">
          <div class="filterchips" id="actChips">
            ${FILTERS.map(f=>`<button class="chip ${f[0]==='all'?'on':''}" data-f="${f[0]}">${esc(f[1])}</button>`).join('')}
          </div>
          <div class="grow"></div>
          ${btn('Export log',{icon:'download',cls:'soft',attrs:'onclick="toast(\'Activity log exported\',\'ok\')"'})}
        </div>

        <div id="actFeed">${feedHtml()}</div>
      </div>

      <aside class="act-aside">
        <div class="panel">
          <div class="panel-h"><h3>Active sessions</h3><span style="margin-left:auto;font-size:11.5px;color:var(--muted)">${A.sessions.length} devices</span></div>
          <div class="panel-body">${sessions}</div>
          <div class="sec-foot" style="cursor:pointer" id="signOutAll">${ic('signout')}<span>Sign out all other sessions</span></div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>This week by module</h3></div>
          <div class="panel-body">${modBars}</div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>Security</h3><button class="btn plain sm" style="margin-left:auto" onclick="navigate('settings')">${ic('gear')}<span>Manage</span></button></div>
          <div class="panel-body" style="padding-top:6px">
            <div class="field"><span class="k">Password</span><span class="v">${esc(A.security.password)}</span></div>
            <div class="field"><span class="k">Two-factor</span><span class="v">${esc(A.security.mfa)}</span></div>
            <div class="field"><span class="k">Recovery codes</span><span class="v">${esc(A.security.recovery)}</span></div>
          </div>
          <div class="sec-foot">${ic('checkc')}<span>No unusual sign-in activity detected.</span></div>
        </div>
      </aside>
    </div>
  </div></section></div>`;

  /* ---- wiring ---- */
  function wireRows(){
    root.querySelectorAll('.act-row[data-route]').forEach(r=>r.addEventListener('click',()=>{ const rt=r.dataset.route; if(rt) navigate(rt); }));
  }
  wireRows();

  root.querySelectorAll('#actChips .chip').forEach(c=>c.addEventListener('click',()=>{
    filter = c.dataset.f;
    root.querySelectorAll('#actChips .chip').forEach(x=>x.classList.toggle('on',x===c));
    $('#actFeed').innerHTML = feedHtml();
    wireRows();
  }));

  root.querySelectorAll('.sess-out').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const card = b.closest('.sess');
    card.style.transition='opacity .2s'; card.style.opacity='0';
    setTimeout(()=>card.remove(),200);
    toast('Session signed out','ok');
  }));
  const soAll = root.querySelector('#signOutAll');
  if(soAll) soAll.addEventListener('click',()=>{
    root.querySelectorAll('.sess:not(.cur)').forEach(c=>{ c.style.transition='opacity .2s'; c.style.opacity='0'; setTimeout(()=>c.remove(),200); });
    toast('All other sessions signed out','ok');
  });
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
