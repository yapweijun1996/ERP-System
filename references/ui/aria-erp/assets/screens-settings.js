/* ============================================================
   ARIA ERP — screens: Settings (personal preferences)
   Profile · Appearance · Notifications · Language & region ·
   Defaults · Security. Destination for the sidebar "Settings"
   button and the account-menu "Preferences" item.
   ============================================================ */
SCREENS['settings'] = function(root, params){
  const u=DB.user;
  const companies=DB.masters[0].companies;
  const modules=DB.nav.flatMap(g=>g.items);

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
  const accents=[['#0071E3','Blue'],['#5E5CE6','Indigo'],['#0a7d8c','Teal'],['#1f9d57','Green'],['#FF9500','Amber'],['#FF375F','Pink']];
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
  const profile=panel('set-profile','user','Profile',`
    <div class="set-row top">
      <div class="set-row-t" style="display:flex;gap:16px;align-items:center">
        <span class="set-avatar">${esc(u.initials)}</span>
        <div><b style="font-size:15px">${esc(u.name)}</b>
          <small style="margin-top:3px">${esc(u.role)} · ${esc(DB.company.name)}</small></div>
      </div>
      <div class="set-row-c">${btn('Change photo',{icon:'camera',cls:'soft',attrs:'data-act="photo"'})}${btn('Remove',{cls:'plain',attrs:'data-act="rmphoto"'})}</div>
    </div>
    <div class="set-grid">
      <div class="fld"><span>Full name</span><input value="${esc(u.name)}"></div>
      <div class="fld"><span>Job title</span><input value="${esc(u.role)}"></div>
      <div class="fld"><span>Work email</span><input value="${esc(u.email)}"></div>
      <div class="fld"><span>Phone</span><input value="+60 12-345 6789"></div>
      <div class="fld"><span>Department</span><input value="Operations"></div>
      <div class="fld"><span>Reports to</span><input value="Priya Nwosu · CFO" readonly></div>
    </div>`);

  /* ---- APPEARANCE ---- */
  const appearance=panel('set-appearance','sun','Appearance',`
    ${row('Theme','Choose how Aria looks. System follows your device setting.',seg('theme',[['light','Light'],['dark','Dark'],['system','System']],curTheme))}
    ${row('Colour palette','Apply a curated preset across the app, or fine-tune the accent below.',
      `<div class="set-palettes">${palettes.map(p=>`<button class="set-pal ${p[0]===curPalette?'on':''}" data-c="${p[1]}" data-name="${p[0]}" aria-label="${p[0]} palette"><span class="set-pal-sw">${p[2].map(c=>`<i style="background:${c}"></i>`).join('')}</span><span class="set-pal-l">${p[0]}</span></button>`).join('')}</div>`)}
    ${row('Accent colour','Used for highlights, links and active states across the app.',
      `<div class="set-swatches">${accents.map(a=>`<button class="set-sw ${a[0]===curAccent?'on':''}" data-c="${a[0]}" style="background:${a[0]}" data-tip="${a[1]}" aria-label="${a[1]}"></button>`).join('')}</div>`)}
    ${row('Sidebar','Keep the primary navigation expanded or collapsed to icons.',seg('sidebar',[['expanded','Expanded'],['collapsed','Collapsed']],curSidebar))}
    ${row('Density','Comfortable spacing, or compact rows to fit more on screen.',seg('density',[['comfortable','Comfortable'],['compact','Compact']],curDensity))}
    ${row('Text size','Make the text larger or smaller across the app, without changing the layout. Five levels, from small to largest.',
      `<div class="seg" data-seg="textsize">${[['0.9','Small'],['1','Default'],['1.12','Large'],['1.25','Larger'],['1.4','Largest']].map((o,i)=>`<button data-v="${o[0]}" class="${o[0]===curTextsize?'on':''}" data-tip="${o[1]}" aria-label="${o[1]} text" style="font-size:${11+i*1.6}px;line-height:1;min-width:30px;justify-content:center">A</button>`).join('')}</div>`)}`);

  /* ---- NOTIFICATIONS ---- */
  const notifications=panel('set-notifications','bell','Notifications',`
    ${row('Approvals awaiting me','Purchase orders, journals and discounts that need your decision.',tgl(true))}
    ${row('Mentions &amp; comments','When someone @mentions you on a document or thread.',tgl(true))}
    ${row('Document status changes','Orders you own move to picked, posted, shipped or paid.',tgl(true))}
    ${row('Stock-out &amp; low-stock alerts','Items you watch drop below their reorder point.',tgl(true))}
    ${row('Period-close reminders','Reminders ahead of month-end and fiscal close.',tgl(false))}
    ${row('Email digest','How often Aria emails a summary of what needs you.',seg('digest',[['off','Off'],['daily','Daily'],['realtime','Realtime']],'daily'))}
    ${row('Desktop push','Show alerts in this browser while you are signed in.',tgl(true))}`);

  /* ---- LANGUAGE & REGION ---- */
  const localization=panel('set-localization','location','Language &amp; region',`
    <div class="set-grid">
      <div class="fld"><span>Language</span>${sel(['English (US)','English (UK)','Bahasa Melayu','简体中文','日本語'],'English (US)')}</div>
      <div class="fld"><span>Time zone</span>${sel(['(GMT+8) Kuala Lumpur','(GMT+8) Singapore','(GMT+0) London','(GMT-5) New York'],'(GMT+8) Kuala Lumpur')}</div>
      <div class="fld"><span>Date format</span>${sel(['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY'],'YYYY-MM-DD')}</div>
      <div class="fld"><span>Number format</span>${sel(['1,234.56','1.234,56','1 234.56'],'1,234.56')}</div>
      <div class="fld"><span>First day of week</span>${sel(['Monday','Sunday','Saturday'],'Monday')}</div>
      <div class="fld"><span>Currency display</span>${sel(['Symbol — $1,240','Code — USD 1,240'],'Symbol — $1,240')}</div>
    </div>`);

  /* ---- DEFAULTS ---- */
  const defaults=panel('set-defaults','sliders','Defaults',`
    ${row('Default company','The company &amp; branch loaded when you sign in.',sel(companies.map(c=>c.name),companies.find(c=>c.current).name))}
    ${row('Landing page','Where Aria takes you after sign-in.',sel(modules.map(m=>m.label),'Home'))}
    ${row('Default warehouse','Pre-selected on stock, picking and transfer screens.',sel(['KL-Main','KL-Overflow','Penang DC'],'KL-Main'))}
    ${row('Rows per page','Default page size for lists and tables.',seg('rows',[['25','25'],['50','50'],['100','100']],'50'))}`);

  /* ---- SECURITY ---- */
  const sessions=[
    ['grid','Chrome · macOS','Kuala Lumpur, MY · Active now',true],
    ['user','Safari · iPhone 15','Kuala Lumpur, MY · 2 hours ago',false],
    ['grid','Firefox · Windows','Singapore, SG · 3 days ago',false],
  ];
  const security=panel('set-security','lock','Security',`
    ${row('Password','Last changed 12 March 2026.',btn('Change password',{icon:'lock',cls:'soft',attrs:'data-act="pw"'}))}
    ${row('Two-factor authentication','Authenticator app enrolled.',`${cap('Enabled','ok')}${btn('Manage',{cls:'soft',attrs:'data-act="2fa"'})}`)}
    ${row('Recovery codes','Single-use codes for when you lose your device.',btn('View codes',{cls:'soft',attrs:'data-act="codes"'}))}
    <div class="panel-h" style="border-top:1px solid var(--hairline)"><h3 style="font-size:12.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Active sessions</h3></div>
    ${sessions.map((s,i)=>`<div class="set-sess">
      <span class="si">${ic(s[0])}</span>
      <div class="sm"><b>${s[1]}</b><small>${s[2]}</small></div>
      ${s[3]?cap('This device','accent'):btn('Revoke',{cls:'plain',attrs:`data-revoke="${i}"`})}</div>`).join('')}
    <div class="set-row">${btn('Sign out all other sessions',{icon:'signout',cls:'soft',attrs:'data-act="signout-all"'})}</div>`);

  const railItems=[
    ['set-profile','user','Profile'],['set-appearance','sun','Appearance'],
    ['set-notifications','bell','Notifications'],['set-localization','location','Language & region'],
    ['set-defaults','sliders','Defaults'],['set-security','lock','Security'],
  ];

  root.innerHTML=`<div class="content full"><section class="master" data-screen-label="Settings">
    <div class="pagehead">${crumbs([DB.company.name,'Settings'])}
      <div class="h1row"><h1>Settings</h1></div>
      <p style="margin:6px 0 0;color:var(--muted);font-size:13px">Your profile, preferences and security · ${esc(u.email)}</p>
    </div>
    <div class="set-body">
      <nav class="set-rail" aria-label="Settings sections">
        <div class="set-railhead">Settings</div>
        ${railItems.map((r,i)=>`<button class="set-navitem ${i===0?'on':''}" data-target="${r[0]}">${ic(r[1])}<span>${r[2]}</span></button>`).join('')}
      </nav>
      <div class="set-scroll"><div class="set-page">
        ${profile}${appearance}${notifications}${localization}${defaults}${security}
      </div></div>
    </div>
    <div class="set-savebar">
      <div class="hideonsmall" style="font-size:12.5px;color:var(--muted)">Personal preferences · saved to your account</div>
      <div class="grow"></div>
      ${btn('Reset',{cls:'soft',attrs:'data-act="reset"'})}
      ${btn('Save changes',{icon:'check',cls:'primary',sm:false,attrs:'data-act="save"'})}
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
    openModal(`<div class="modal-head">${ic('lock')}<h3>Change password</h3><button class="iconbtn x" onclick="closeModal()">${ic('x')}</button></div>
      <div class="modal-body">
        <div class="fld"><span>Current password</span><input type="password" placeholder="••••••••"></div>
        <div class="fld" style="margin-top:10px"><span>New password</span><input type="password" placeholder="At least 12 characters"></div>
        <div class="fld" style="margin-top:10px"><span>Confirm new password</span><input type="password"></div>
        <p style="margin:10px 0 0;font-size:11.5px;color:var(--muted)">Use 12+ characters with a mix of letters, numbers and symbols.</p>
      </div>
      <div class="modal-foot">${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Update password',{icon:'check',cls:'primary',attrs:'onclick="closeModal();toast(\'Password updated\',\'ok\')"'})}</div>`);
  });
  const tfa=root.querySelector('[data-act="2fa"]'); tfa&&tfa.addEventListener('click',()=>toast('Manage 2FA — not in this build','info'));
  const codes=root.querySelector('[data-act="codes"]'); codes&&codes.addEventListener('click',()=>toast('Recovery codes — not in this build','info'));
  root.querySelectorAll('[data-revoke]').forEach(b=>b.addEventListener('click',()=>{
    b.closest('.set-sess').remove(); toast('Session revoked','ok');
  }));
  const soa=root.querySelector('[data-act="signout-all"]'); soa&&soa.addEventListener('click',()=>{
    root.querySelectorAll('.set-sess [data-revoke]').forEach(b=>b.closest('.set-sess').remove());
    toast('Signed out of all other sessions','ok');
  });

  /* ---- profile photo + save/reset ---- */
  const ph=root.querySelector('[data-act="photo"]'); ph&&ph.addEventListener('click',()=>toast('Upload photo — not in this build','info'));
  const rmph=root.querySelector('[data-act="rmphoto"]'); rmph&&rmph.addEventListener('click',()=>toast('Photo removed','info'));
  root.querySelector('[data-act="save"]').addEventListener('click',()=>toast('Settings saved','ok'));
  root.querySelector('[data-act="reset"]').addEventListener('click',()=>toast('Changes reset','info'));

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
