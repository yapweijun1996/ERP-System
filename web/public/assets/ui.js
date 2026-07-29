/* ============================================================
   ARIA ERP — shared UI helpers (render strings + behaviours)
   ============================================================ */
const SCREENS = {};            // route -> fn(root)  (populated by screen files)
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---- small render helpers ---- */
function profileAvatarMedia({name='',src='',title=''}={}){
  const label=title||(typeof tf==='function'
    ?tf('common.profileImage','{name} profile image',{name:name||'User'})
    :`${name||'User'} profile image`);
  const candidate=String(src||'').trim();
  const safeSrc=/^(https?:|data:image\/|blob:|\/|\.\/|\.\.\/)/i.test(candidate)?candidate:'';
  const fallback=`<svg class="profile-avatar-fallback" xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${esc(label)}"
      ${safeSrc?'hidden':''}>
    <title>${esc(label)}</title><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>
  </svg>`;
  return `${safeSrc?`<img class="profile-avatar-image" src="${esc(safeSrc)}" alt="${esc(label)}"
    onerror="this.hidden=true;this.nextElementSibling.hidden=false">`:''}${fallback}`;
}
function profileAvatar({name='',src='',cls='kc-av',size=null,title='',attrs=''}={}){
  const style=size?` style="width:${Number(size)}px;height:${Number(size)}px"`:'';
  return `<span class="${esc(cls)} profile-avatar"${style} ${attrs}>${
    profileAvatarMedia({name,src,title})
  }</span>`;
}
window.profileAvatarMedia=profileAvatarMedia;
window.profileAvatar=profileAvatar;
function cap(label, tone){ return `<span class="cap ${tone||statusCap(label)}"><span class="dot"></span>${esc(label)}</span>`; }
function statusBadge(st){
  const value=String(st==null?'':st).trim();
  if(!value||value==='—') return cap('—','neutral');
  return cap(typeof ts==='function'?ts(value):value,statusCap(value));
}
function btn(label, {icon,cls='soft',sm=true,attrs=''}={}){
  return `<button class="btn ${cls} ${sm?'sm':''}" ${attrs}>${icon?ic(icon):''}${label?`<span>${esc(label)}</span>`:''}</button>`;
}
/* ---- wizard progress stepper (SINGLE SOURCE OF TRUTH for multi-step create flows) ----
   steps: [[label, icon], …]; curStep + reached drive state. Steps up to `reached`
   carry data-step="i" so each wizard can wire click-to-jump in its shell. */
function wizardStepper(steps, curStep, reached){
  return `<div class="stepper">${steps.map((s,i)=>{
    const label=Array.isArray(s)?s[0]:s;
    const cls=i<curStep?'done':i===curStep?'current':'';
    const dot=i<curStep?ic('check'):'';
    const clickable=i<=reached;
    return `${i?`<span class="stepline ${i<=curStep?'done':''}"></span>`:''}<div class="step ${cls}" ${clickable?`data-step="${i}" style="cursor:pointer"`:''}><span class="sdot">${dot||`<span style="font-size:10px;font-weight:700">${i+1}</span>`}</span>${esc(label)}</div>`;
  }).join('')}</div>`;
}
function crumbs(parts){ // parts: ['Sales', {label:'Orders',route:'sales-orders'}, {cur:'SO-26-0418'}]
  // SSOT for breadcrumbs. Standard: a segment is clickable IFF it carries a route.
  // Routed → <button>; plain label → non-interactive <span class="step"> (not a dead button).
  return `<nav class="crumb" aria-label="${esc(typeof t==='function'?t('common.breadcrumb'):'Breadcrumb')}">`+parts.map((p,i)=>{
    const last=i===parts.length-1;
    const obj = p!=null && typeof p==='object';
    const lbl = obj ? (p.cur!=null?p.cur:p.label) : p;
    if(last) return `<span class="cur" aria-current="page">${esc(lbl)}</span>`;
    const route = obj ? p.route : null;
    const seg = route
      ? `<button onclick="navigate('${route}')">${esc(lbl)}</button>`
      : `<span class="step">${esc(lbl)}</span>`;
    return seg+`<span class="sep" aria-hidden="true">›</span>`;
  }).join('')+`</nav>`;
}

/* ---- combobox (searchable single-select; preferred over <select> for >2 options) ----
   render:  combobox({id,value,options:[{value,label,sub}],placeholder})
   wire:    wireCombobox(id,{options,onChange:(value,opt)=>{}})
   The input carries the chosen value in its data-value attribute. */
function combobox({id, value='', options=[], placeholder='Search…'}={}){
  const sel = options.find(o=>String(o.value)===String(value));
  return `<div class="combo">
    <span class="combo-ic">${ic('search')}</span>
    <input id="${id}" class="combo-in" type="text" role="combobox" autocomplete="off" spellcheck="false"
      aria-expanded="false" aria-autocomplete="list" placeholder="${esc(placeholder)}"
      value="${sel?esc(sel.label):''}" data-value="${esc(value)}">
    <button type="button" class="combo-caret" tabindex="-1" aria-label="${esc(typeof t==='function'?t('common.showOptions'):'Show options')}">${ic('chevD')}</button>
    <div class="combo-pop" role="listbox" hidden></div>
  </div>`;
}
function wireCombobox(id, {options=[], onChange}={}){
  const input=$('#'+id); if(!input) return;
  const wrap=input.closest('.combo'); if(!wrap) return;
  const pop=wrap.querySelector('.combo-pop'), caret=wrap.querySelector('.combo-caret');
  let filtered=options.slice(), active=-1;
  const labelFor=v=>{ const o=options.find(o=>String(o.value)===String(v)); return o?o.label:''; };
  const isOpen=()=>wrap.classList.contains('open');
  function scrollActive(){ const el=pop.querySelector('.combo-opt.active'); if(!el) return;
    const t=el.offsetTop, b=t+el.offsetHeight;
    if(t<pop.scrollTop) pop.scrollTop=t; else if(b>pop.scrollTop+pop.clientHeight) pop.scrollTop=b-pop.clientHeight; }
  function renderList(){
    if(!filtered.length){ pop.innerHTML=`<div class="combo-empty">No matches</div>`; return; }
    const cur=input.dataset.value;
    pop.innerHTML=filtered.map((o,i)=>{
      const seld=String(o.value)===String(cur);
      return `<div class="combo-opt${i===active?' active':''}${seld?' sel':''}" role="option" data-i="${i}" aria-selected="${seld}"><span class="combo-opt-main">${esc(o.label)}${o.sub?`<small>${esc(o.sub)}</small>`:''}</span>${seld?ic('check'):''}</div>`;
    }).join('');
    scrollActive();
  }
  function position(){
    const r=input.getBoundingClientRect();
    pop.style.position='fixed';
    pop.style.left=r.left+'px';
    pop.style.right='auto';
    pop.style.width=r.width+'px';
    const ph=pop.offsetHeight, below=r.bottom+5, above=r.top-5-ph;
    pop.style.top=((below+ph>innerHeight-8 && above>8)?above:below)+'px';
  }
  let onScroll=null;
  function open(){ if(isOpen()) return; wrap.classList.add('open'); input.setAttribute('aria-expanded','true');
    document.body.appendChild(pop); pop.hidden=false; renderList(); position();
    onScroll=()=>position(); window.addEventListener('scroll',onScroll,true); window.addEventListener('resize',onScroll); }
  function close(){ wrap.classList.remove('open'); input.setAttribute('aria-expanded','false'); pop.hidden=true; active=-1;
    if(onScroll){ window.removeEventListener('scroll',onScroll,true); window.removeEventListener('resize',onScroll); onScroll=null; }
    pop.removeAttribute('style'); pop.hidden=true;
    if(pop.parentElement!==wrap) wrap.appendChild(pop); }
  function doFilter(){
    const q=input.value.trim().toLowerCase();
    filtered = q ? options.filter(o=>(o.label+' '+(o.sub||'')).toLowerCase().includes(q)) : options.slice();
    const ci=filtered.findIndex(o=>String(o.value)===String(input.dataset.value));
    active = ci>=0 ? ci : (filtered.length?0:-1);
  }
  function commit(o){ input.dataset.value=o.value; input.value=o.label; close(); onChange && onChange(o.value, o); }
  function restore(){ input.value=labelFor(input.dataset.value); }
  input.addEventListener('focus',()=>{ doFilter(); open(); input.select(); });
  input.addEventListener('input',()=>{ doFilter(); open(); renderList(); });
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); if(!isOpen()){ doFilter(); open(); return; } active=Math.min(filtered.length-1,active+1); renderList(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); active=Math.max(0,active-1); renderList(); }
    else if(e.key==='Enter'){ if(isOpen()&&active>=0&&filtered[active]){ e.preventDefault(); commit(filtered[active]); } }
    else if(e.key==='Escape'){ if(isOpen()){ e.preventDefault(); close(); restore(); } }
  });
  input.addEventListener('blur',()=>{ close(); restore(); });
  caret.addEventListener('mousedown',e=>{ e.preventDefault(); if(isOpen()){ close(); } else { input.focus(); doFilter(); open(); } });
  pop.addEventListener('mousedown',e=>{ const o=e.target.closest('.combo-opt'); if(!o) return; e.preventDefault(); commit(filtered[+o.dataset.i]); });
}

/* ---- state panels ---- */
function statePanel({icon='inbox',title,body,code,action}){
  return `<div class="statepanel">
    <div class="ic">${ic(icon)}</div>
    <h3>${esc(title)}</h3>
    ${body?`<p>${body}</p>`:''}
    ${code?`<span class="code">${esc(code)}</span>`:''}
    ${action?`<div style="margin-top:4px">${action}</div>`:''}
  </div>`;
}
function notBuilt(name){
  return statePanel({icon:'layers',title:`${name} isn’t in this prototype build`,
    body:`This module is fully specified in the Aria ERP UX document and follows the same screen templates you can explore in the built modules. Jump to a working screen from the sidebar or ⌘K.`,
    action:btn('Open command palette',{icon:'search',cls:'soft',attrs:'onclick="openPalette()"'})});
}
function skeletonRows(n=8){
  let r='';for(let i=0;i<n;i++){r+=`<div style="display:flex;gap:14px;padding:10px 24px;align-items:center"><div class="sk" style="width:18px;height:18px;border-radius:5px"></div><div class="sk sk-line" style="flex:2"></div><div class="sk sk-line" style="flex:1"></div><div class="sk sk-line" style="flex:1"></div><div class="sk sk-line" style="width:70px"></div></div>`;}
  return `<div style="padding:8px 0">${r}</div>`;
}

/* ---- toast ---- */
function toast(msg, tone='ok'){
  let host=$('#toaster'); if(!host){host=document.createElement('div');host.id='toaster';document.body.appendChild(host);}
  const tip={ok:'tk',warn:'tw',danger:'td',info:''}[tone]||'';
  const icn={ok:'checkc',warn:'warn',danger:'xc',info:'info'}[tone]||'checkc';
  const el=document.createElement('div'); el.className='toast';
  el.innerHTML=`<span class="${tip}">${ic(icn)}</span>${esc(msg)}`;
  host.appendChild(el); requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{el.classList.remove('show'); setTimeout(()=>el.remove(),300);},2600);
}

/* ---- cursor-following tooltip ---- */
let _tipEl;
function initTooltip(){
  _tipEl=document.createElement('div'); _tipEl.id='cursorTip'; document.body.appendChild(_tipEl);
  let cur=null;
  document.addEventListener('mousemove',e=>{
    const t=e.target.closest('[data-tip]');
    if(t){ const tx=t.getAttribute('data-tip'); if(tx!==cur){cur=tx;_tipEl.textContent=tx;} _tipEl.classList.add('show');
      let x=e.clientX+14,y=e.clientY+18; const w=_tipEl.offsetWidth,h=_tipEl.offsetHeight;
      if(x+w>innerWidth-8)x=e.clientX-w-12; if(y+h>innerHeight-8)y=e.clientY-h-12;
      _tipEl.style.transform=`translate(${x}px,${y}px)`;
    } else if(cur!==null){ cur=null; _tipEl.classList.remove('show'); }
  });
  document.addEventListener('mouseleave',()=>_tipEl.classList.remove('show'));
}

/* ---- modal ---- */
function openModal(html){
  // A new modal replaces the current one synchronously. closeModal() deliberately
  // keeps its node for the exit animation, which would otherwise leave duplicate
  // modalEl/modalScrim ids and let immediate follow-up actions bind to the old DOM.
  document.querySelectorAll('#modalEl,#modalScrim').forEach(node=>node.remove());
  const scrim=document.createElement('div'); scrim.className='scrim show'; scrim.id='modalScrim';
  scrim.style.zIndex=110;
  const m=document.createElement('div'); m.className='modal'; m.id='modalEl'; m.innerHTML=html;
  document.body.appendChild(scrim); document.body.appendChild(m);
  requestAnimationFrame(()=>m.classList.add('show'));
  scrim.addEventListener('click',closeModal);
}
function closeModal(){ const m=$('#modalEl'),s=$('#modalScrim'); if(m){m.classList.remove('show');setTimeout(()=>m.remove(),200);} if(s)s.remove(); }

/* ---- standard modal builder (SINGLE SOURCE OF TRUTH for modal chrome) ----
   appModal({icon,title,body,actions,width}) renders the head/body/foot shell.
   confirmModal(...) is the standard confirm dialog built on top of it. */
function appModal({icon, title, body='', actions='', width}={}){
  const closeLabel=typeof t==='function'?t('common.close'):'Close';
  openModal(`<div class="modal-head">${icon?ic(icon):''}<h3>${esc(title)}</h3><button class="iconbtn x" onclick="closeModal()" aria-label="${esc(closeLabel)}">${ic('x')}</button></div>
    <div class="modal-body">${body}</div>
    ${actions?`<div class="modal-foot">${actions}</div>`:''}`);
  if(width){
    const m=$('#modalEl');
    if(m){
      m.style.width=typeof width==='number'?`min(${width}px, calc(100vw - 24px))`:width;
      m.style.maxWidth='calc(100vw - 24px)';
    }
  }
}
/* confirm dialog — pass a GLOBAL fn name string for onConfirm so the inline handler can reach it */
function confirmModal({icon='warn', title, message, confirmLabel='Confirm', cancelLabel='Cancel', danger=false, onConfirm}){
  appModal({ icon, title,
    body:`<p style="color:var(--muted);font-size:13.5px;line-height:1.5">${message}</p>`,
    actions: btn(cancelLabel,{cls:'soft',attrs:'onclick="closeModal()"'})
      + btn(confirmLabel,{icon:danger?'trash':'check',cls:'primary',attrs:`onclick="closeModal();(${onConfirm})()"`}) });
}

/* ---- audit timeline builder (shared across docs) ---- */
function auditTrail(events){
  return `<div class="timeline">`+events.map(e=>`
    <div class="tl ${e.kind||'sys'}">
      <span class="tldot"></span>
      <div class="tlbody">
        <div class="when">${esc(e.when)}</div>
        <div class="what">${e.what}</div>
        <div class="who">${esc(e.who)}</div>
        ${e.change?`<div class="det"><div class="chg"><span>${esc(e.change.field)}</span><span><span class="old">${esc(e.change.old)}</span> → <span class="new">${esc(e.change.new)}</span></span></div>${e.change.reason?`<div style="margin-top:4px">Reason: ${esc(e.change.reason)}</div>`:''}</div>`:''}
      </div>
    </div>`).join('')+`</div>`;
}

/* generic audit events used by several documents */
function genericAudit(doc, by){
  return auditTrail([
    {kind:'current',when:'Jun 4, 2026 · 14:22',what:'Submitted for approval',who:'J. Okafor'},
    {kind:'sys',when:'Jun 4, 2026 · 11:40',what:'Discount changed on line 2',who:'J. Okafor',change:{field:'Line discount',old:'8%',new:'12%',reason:'Volume commitment for Q3'}},
    {kind:'add',when:'Jun 3, 2026 · 16:05',what:`${doc} created`,who:by||'J. Okafor'},
  ]);
}

/* ---- attachments / comments blocks ---- */
function attachments(list){
  if(!list||!list.length) return statePanel({icon:'paperclip',title:'No attachments',body:'Drag a file here or use Add attachment. Camera upload is available on mobile.'});
  return list.map(a=>`<div class="attach"><div class="fi">${ic(a.ic||'file')}</div><div class="fn"><b>${esc(a.name)}</b><small>${esc(a.meta)}</small></div><button class="iconbtn dl" data-tip="Download">${ic('download')}</button></div>`).join('')
    +`<div style="margin-top:6px">${btn('Add attachment',{icon:'plus',cls:'plain'})}</div>`;
}
function comments(list){
  const body=(list||[]).map(c=>`<div class="comment">${profileAvatar({name:c.who,src:c.imageUrl||c.photoUrl||c.avatarUrl,cls:'cav',size:30})}<div class="cb"><div class="ch"><b>${esc(c.who)}</b><small>${esc(c.when)}</small></div><p>${esc(c.text)}</p></div></div>`).join('');
  return body+`<div class="commentbox"><input placeholder="Write a comment…  @mention to notify" /><button class="btn primary sm">${ic('send')}</button></div>`;
}

/* ---- related documents list ---- */
function relatedDocs(list){
  return `<div class="minilist">`+list.map(d=>`<div class="mli"><span class="ml-doc">${esc(d.no)}</span><div class="ml-main">${esc(d.label)}<small>${esc(d.meta)}</small></div>${d.status?statusBadge(d.status):''}</div>`).join('')+`</div>`;
}

/* ---- indicator (credit limit / stock / balance) ---- */
function indicator({tone='ok',icon='money',label,value,sub,pct}){
  return `<div class="indicator ${tone}">
    <div class="ind-top">${ic(icon)}<span>${esc(label)}</span><span class="ind-r tnum">${value}</span></div>
    ${pct!=null?`<div class="track"><i style="width:${Math.min(100,pct)}%"></i></div>`:''}
    ${sub?`<small>${sub}</small>`:''}
  </div>`;
}

/* ---- generic listing table builder (CSS-grid div implementation) ----
   cfg: { columns:[{key,label,align,cls,render,sortable,w,grow}], rows, rowId, checkable }
   Rendered as role=table divs so it rasterises reliably and never collapses. */
function gridTemplate(cfg){
  const tracks=[];
  if(cfg.checkable) tracks.push('38px');
  cfg.columns.forEach((c,i)=>{
    if(c.w){ tracks.push(c.w); return; }
    const left = c.align!=='r' && c.align!=='c';
    if(i===0 && left) tracks.push('minmax(190px,2.3fr)');
    else if(left) tracks.push('minmax(108px,1.3fr)');
    else tracks.push('minmax(74px,1fr)');
  });
  return tracks.join(' ');
}
function buildTable(cfg){
  const tpl=gridTemplate(cfg);
  let h=`<div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">`;
  // header
  h+=`<div class="dt-r dt-head" role="row">`;
  if(cfg.checkable) h+=`<div class="dt-c colcheck"><input type="checkbox" class="checkbox" data-checkall aria-label="Select all"></div>`;
  cfg.columns.forEach((c,i)=>{
    const al=c.align==='r'?'r':(c.align==='c'?'c':'l');
    h+=`<div class="dt-c ${al} ${c.sortable?'sortable':''}" role="columnheader" data-col="${i}">${esc(c.label)}${c.sortable?`<span class="sortarrow">▲</span>`:''}</div>`;
  });
  h+=`</div><div class="dt-body">`;
  cfg.rows.forEach(row=>{
    const id=cfg.rowId?cfg.rowId(row):'';
    const interaction=typeof cfg.rowInteraction==='function'
      ?cfg.rowInteraction(row,id)
      :null;
    const interactive=Boolean(interaction&&interaction.kind&&interaction.kind!=='none');
    const kind=interactive?String(interaction.kind):'none';
    const label=interactive?String(interaction.label||id):'';
    h+=`<div class="dt-r ${interactive?'is-interactive':''}" role="row"
        data-row="${esc(id)}" data-row-interaction="${esc(kind)}"
        ${interactive?`tabindex="0" aria-label="${esc(label)}"`:''}>`;
    if(cfg.checkable) h+=`<div class="dt-c colcheck"><input type="checkbox" class="checkbox" data-rowcheck aria-label="Select row"></div>`;
    cfg.columns.forEach(c=>{
      const al=c.align==='r'?'r':(c.align==='c'?'c':'l');
      h+=`<div class="dt-c ${al} ${c.cls||''}" role="cell">${c.render?c.render(row):esc(row[c.key])}</div>`;
    });
    h+=`</div>`;
  });
  h+=`</div></div></div>`;
  return h;
}

/* wire row clicks + checkbox behaviour after injecting a buildTable result */
function wireTable(scope, {onRow, onSelectionChange}={}){
  const tbl=scope.querySelector('.dt[role="table"]'); if(!tbl) return;
  tbl.querySelectorAll('.dt-body .dt-r[data-row]').forEach(tr=>{
    if(typeof onRow!=='function'||tr.dataset.rowInteraction==='none') return;
    const activate=e=>{
      if(e.target.closest('[data-rowcheck],.rowact,button,a,input,select,textarea,[role="button"]')) return;
      tbl.querySelectorAll('.dt-r.sel').forEach(x=>x.classList.remove('sel'));
      tr.classList.add('sel');
      onRow(tr.dataset.row,tr);
    };
    tr.addEventListener('click',activate);
    tr.addEventListener('keydown',e=>{
      if(e.key!=='Enter'&&e.key!==' ') return;
      e.preventDefault();
      activate(e);
    });
  });
  const all=tbl.querySelector('[data-checkall]');
  const boxes=()=>[...tbl.querySelectorAll('[data-rowcheck]')];
  function sync(){
    const checked=boxes().filter(b=>b.checked);
    boxes().forEach(b=>b.closest('.dt-r').classList.toggle('checked',b.checked));
    if(all){ all.checked=checked.length&&checked.length===boxes().length; all.indeterminate=checked.length>0&&checked.length<boxes().length; }
    onSelectionChange && onSelectionChange(checked.length);
  }
  all && all.addEventListener('change',()=>{ boxes().forEach(b=>b.checked=all.checked); sync(); });
  boxes().forEach(b=>b.addEventListener('change',sync));
  tbl.querySelectorAll('.dt-c.sortable').forEach(th=>th.addEventListener('click',()=>{
    const was=th.classList.contains('sorted')&&th.classList.contains('asc');
    tbl.querySelectorAll('.dt-c').forEach(x=>x.classList.remove('sorted','asc','desc'));
    th.classList.add('sorted',was?'desc':'asc');
    const sa=th.querySelector('.sortarrow'); if(sa)sa.textContent=was?'▼':'▲';
  }));
}
