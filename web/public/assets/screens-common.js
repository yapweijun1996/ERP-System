/* ============================================================
   ARIA ERP — shared screen helpers (SSOT)
   Loaded before every screens-*.js file. Do not duplicate these
   helpers locally in a module file — extend this one instead.
   ============================================================ */

/**
 * Fetch a bounded ErpSystemData resource page and normalize the response
 * shape every module's list screens rely on. Replaces the formerly
 * copy-pasted crmListPage/assetListPage/financeListPage/inventoryListPage/
 * purchasingListPage/salesListPage/adminListPage helpers (TASK-043).
 */
async function listPage(resource, query){
  const adapter=window.ErpSystemData;
  if(!adapter||typeof adapter.list!=='function'){
    throw new Error('The canonical ERP data adapter is unavailable.');
  }
  const response=await adapter.list(resource, query||{limit:100});
  if(!response||response.data==null){
    throw new Error(`Unexpected ${resource} response.`);
  }
  return { data:response.data, nextCursor:response.meta&&response.meta.nextCursor||null };
}

/**
 * Read every page for bounded child collections whose totals must never be
 * calculated from a silently truncated first page (for example payroll lines).
 */
async function listAllPages(resource, query, maxPages){
  const rows=[];
  const base=Object.assign({},query||{}, {limit:Math.min(100,Math.max(1,Number(query&&query.limit)||100))});
  let cursor=base.cursor||null;
  const pageLimit=Math.max(1,Number(maxPages)||200);
  delete base.cursor;
  for(let page=0;page<pageLimit;page+=1){
    const response=await window.ErpSystemData.list(resource,Object.assign({},base,cursor?{cursor}:{}));
    if(!response||response.data==null) throw new Error(`Unexpected ${resource} response.`);
    rows.push(...response.data);
    cursor=response.meta&&response.meta.nextCursor||null;
    if(!cursor) return {data:rows,nextCursor:null};
  }
  throw new Error(`${resource} exceeded the supported ${pageLimit*base.limit}-row page window.`);
}

/**
 * Shared render contract for same-route master-detail redraws.
 *
 * Module screens intentionally rebuild their view root when a row, filter or
 * detail action changes. Capture every scrollable surface before that redraw
 * and restore matching surfaces after the new markup has settled. The route
 * marker prevents normal navigation from inheriting the previous screen's
 * position.
 */
function erpScrollSurfaceSignature(element){
  const markers=[
    element.id||'',
    element.getAttribute('data-layout')||'',
    element.getAttribute('data-module-route')||'',
    element.hasAttribute('data-table-listing-scroll')?'table-listing-scroll':'',
    element.hasAttribute('data-list-table')?'list-table':'',
    element.hasAttribute('data-master-detail-panel')?'master-detail-panel':'',
    element.hasAttribute('data-calendar-detail')?'calendar-detail':'',
    typeof element.className==='string'?element.className:'',
  ];
  return markers.join('|');
}
function erpScrollSurfaces(root){
  if(!root) return [];
  return [...root.querySelectorAll('*')].filter(element=>{
    const style=getComputedStyle(element);
    const vertical=/auto|scroll|overlay/.test(style.overflowY)
      &&element.scrollHeight>element.clientHeight+1;
    const horizontal=/auto|scroll|overlay/.test(style.overflowX)
      &&element.scrollWidth>element.clientWidth+1;
    return vertical||horizontal||element.scrollTop!==0||element.scrollLeft!==0;
  });
}
function erpCaptureScrollState(root,route){
  if(!root) return null;
  const shell=root.querySelector('[data-module-route]');
  // Only a module shell for the same route may restore its position. This
  // prevents loading/error pages without a route marker from inheriting the
  // previous screen's scroll state during navigation.
  if(route&&(!shell||shell.getAttribute('data-module-route')!==String(route))) return null;
  const surfaces=erpScrollSurfaces(root);
  const seen=new Map();
  const entries=surfaces.map(element=>{
    const signature=erpScrollSurfaceSignature(element);
    const ordinal=seen.get(signature)||0;
    seen.set(signature,ordinal+1);
    return {
      signature,ordinal,
      top:element.scrollTop,
      left:element.scrollLeft,
    };
  });
  return {entries,windowTop:window.scrollY||0,windowLeft:window.scrollX||0};
}
function erpRestoreScrollState(root,state){
  if(!root||!state) return;
  const restore=()=>{
    const seen=new Map();
    erpScrollSurfaces(root).forEach(element=>{
      const signature=erpScrollSurfaceSignature(element);
      const ordinal=seen.get(signature)||0;
      seen.set(signature,ordinal+1);
      const saved=state.entries.find(entry=>entry.signature===signature&&entry.ordinal===ordinal);
      if(!saved) return;
      const previousBehavior=element.style.scrollBehavior;
      element.style.scrollBehavior='auto';
      element.scrollTop=saved.top;
      element.scrollLeft=saved.left;
      element.style.scrollBehavior=previousBehavior;
    });
    window.scrollTo({top:state.windowTop,left:state.windowLeft,behavior:'auto'});
  };
  restore();
  requestAnimationFrame(()=>requestAnimationFrame(restore));
  setTimeout(restore,120);
}
window.erpCaptureScrollState=erpCaptureScrollState;
window.erpRestoreScrollState=erpRestoreScrollState;

/**
 * Page-level SSOT for operational execution workspaces.
 *
 * Unlike a transaction register, an operational workspace centres one active
 * task and its commands. Module screens provide business-specific work cards,
 * context facts and actions; this helper owns the shared module header, status,
 * progress, main/context split, empty/error regions and responsive action zone.
 */
function operationalWorkspacePage(root, config){
  if(!root) throw new Error('operationalWorkspacePage requires a render root.');
  const cfg=config||{};
  const progress=cfg.progress||{};
  const rawPercent=Number(progress.percent);
  const percent=Number.isFinite(rawPercent)?Math.max(0,Math.min(100,Math.round(rawPercent))):0;
  const progressLabel=String(progress.label||'Progress');
  const progressValue=String(progress.value??`${percent}%`);
  const progressMeta=progress.meta==null?'':String(progress.meta);
  const status=cfg.status&&cfg.status.label
    ? cap(String(cfg.status.label),cfg.status.tone||'neutral')
    : '';
  const empty=cfg.empty||null;
  const main=empty
    ? `<div class="statepanel empty operational-workspace-empty" data-workspace-empty>
        ${ic(empty.icon||'inbox')}
        <h3>${esc(String(empty.title||'No work available'))}</h3>
        ${empty.description?`<p>${esc(String(empty.description))}</p>`:''}
      </div>`
    : (cfg.main||'');
  const context=cfg.context||{};
  const contextTitle=context.title
    ? `<div class="sectitle operational-workspace-context-title">${esc(String(context.title))}</div>`
    : '';
  const actions=cfg.actions||'';
  const body=`<section class="operational-workspace"
      data-layout="operational-workspace-v1"
      data-workspace-route="${esc(String(cfg.route||''))}">
    <div class="operational-workspace-progress" data-workspace-progress
        data-progress-value="${percent}" role="progressbar"
        aria-label="${esc(progressLabel)}" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${percent}">
      <div class="operational-workspace-progress-head">
        <span>${esc(progressLabel)}</span>
        <b class="tnum">${esc(progressValue)}</b>
      </div>
      <div class="operational-workspace-progress-track" aria-hidden="true">
        <i style="width:${percent}%"></i>
      </div>
      ${progressMeta?`<small>${esc(progressMeta)}</small>`:''}
    </div>
    <div class="operational-workspace-grid">
      <main class="operational-workspace-main" data-workspace-main>
        <div class="operational-workspace-error" data-workspace-error role="alert" hidden></div>
        ${main}
      </main>
      <aside class="operational-workspace-context" data-workspace-context>
        ${contextTitle}${context.body||''}
      </aside>
    </div>
    <div class="responsive-actionbar operational-workspace-actions"
        data-workspace-actions ${actions?'':'hidden'}>
      ${actions}
    </div>
  </section>`;
  root.innerHTML=modulePage({
    module:cfg.module,
    route:cfg.route,
    active:cfg.active||cfg.route,
    title:String(cfg.title||''),
    crumb:cfg.crumb,
    sub:cfg.description,
    action:status,
    body,
  });
  const workspace=root.querySelector('[data-layout="operational-workspace-v1"]');
  if(typeof cfg.afterRender==='function'){
    cfg.afterRender({
      root,
      workspace,
      errorRoot:workspace&&workspace.querySelector('[data-workspace-error]'),
    });
  }
  return workspace;
}
window.operationalWorkspacePage=operationalWorkspacePage;

/**
 * Page-level SSOT for versioned master-data detail and authoring surfaces.
 *
 * These screens are not transaction registers: one selected master record is
 * the subject, while its lines/configuration live in the main region and
 * derived facts live in the context rail. The helper owns the module shell,
 * overview, empty/error states, responsive split and action region so modules
 * do not rebuild document-detail chrome.
 */
function masterDetailEditorPage(root, config){
  if(!root) throw new Error('masterDetailEditorPage requires a render root.');
  const cfg=config||{};
  const overview=cfg.overview||{};
  const facts=Array.isArray(overview.facts)?overview.facts:[];
  const avatar=overview.avatar&&overview.avatar.name
    ? `<div class="master-detail-editor-avatar">${profileAvatar({
        name:String(overview.avatar.name),
        src:overview.avatar.src||'',
        size:Number(overview.avatar.size)||48,
      })}</div>`
    : '';
  const status=cfg.status&&cfg.status.label
    ? cap(String(cfg.status.label),cfg.status.tone||'neutral')
    : '';
  const headerActions=cfg.headerActions||'';
  const pageActions=status||headerActions
    ? `<div class="master-detail-editor-page-actions" data-master-detail-page-actions>
        ${status}${headerActions}
      </div>`
    : '';
  const hasOverview=Boolean(avatar||overview.title||overview.code||overview.meta||facts.length);
  const overviewHtml=hasOverview?`
    <div class="master-detail-editor-subject">
      ${avatar}
      <div class="master-detail-editor-identity">
        <div>
          <h2>${esc(String(overview.title||''))}</h2>
          ${overview.code?`<span class="master-detail-editor-code">${esc(String(overview.code))}</span>`:''}
        </div>
        ${overview.meta?`<p>${esc(String(overview.meta))}</p>`:''}
      </div>
    </div>
    <div class="master-detail-editor-facts ${facts.length>=4?'c4':''}">
      ${facts.map(fact=>`<div class="master-detail-editor-fact">
        <small>${esc(String(fact.label||''))}</small>
        <b class="${fact.numeric?'tnum':''}">${esc(String(fact.value??'—'))}</b>
      </div>`).join('')}
    </div>`:'';
  const empty=cfg.empty||null;
  const main=empty
    ? `<div class="statepanel empty master-detail-editor-empty" data-master-detail-empty>
        ${ic(empty.icon||'inbox')}
        <h3>${esc(String(empty.title||'No record available'))}</h3>
        ${empty.description?`<p>${esc(String(empty.description))}</p>`:''}
      </div>`
    : (cfg.main||'');
  const context=cfg.context||{};
  const actions=cfg.actions||'';
  const body=`<section class="master-detail-editor"
      data-layout="master-detail-editor-v1"
      data-master-detail-route="${esc(String(cfg.route||''))}">
    <div class="master-detail-editor-overview" data-master-detail-overview
        ${hasOverview?'':'hidden'}>${overviewHtml}</div>
    <div class="master-detail-editor-error" data-master-detail-error role="alert" hidden></div>
    <div class="master-detail-editor-grid" data-master-detail-grid>
      <main class="master-detail-editor-main" data-master-detail-main>${main}</main>
      <aside class="master-detail-editor-context" data-master-detail-context
          ${empty&&!context.body?'hidden':''}>
        ${context.title?`<div class="sectitle">${esc(String(context.title))}</div>`:''}
        ${context.body||''}
      </aside>
    </div>
    <div class="responsive-actionbar master-detail-editor-actions"
        data-master-detail-actions ${actions?'':'hidden'}>${actions}</div>
  </section>`;
  root.innerHTML=modulePage({
    module:cfg.module,
    route:cfg.route,
    active:cfg.active||cfg.route,
    title:String(cfg.title||''),
    crumb:cfg.crumb,
    sub:cfg.description,
    action:pageActions,
    body,
  });
  const editor=root.querySelector('[data-layout="master-detail-editor-v1"]');
  if(typeof cfg.afterRender==='function'){
    cfg.afterRender({
      root,
      editor,
      errorRoot:editor&&editor.querySelector('[data-master-detail-error]'),
    });
  }
  return editor;
}
window.masterDetailEditorPage=masterDetailEditorPage;

/**
 * Page-level SSOT for actionable lifecycle cases.
 *
 * A case detail is neither a transaction register nor a versioned master-data
 * editor. It presents one governed event, its source and facts, the work
 * performed against it, decision context and lifecycle actions. The helper
 * owns that chrome so case screens do not rebuild legacy document layouts.
 */
function caseDetailPage(root, config){
  if(!root) throw new Error('caseDetailPage requires a render root.');
  const cfg=config||{};
  const identity=cfg.identity||{};
  const statuses=Array.isArray(cfg.statuses)?cfg.statuses.filter(status=>status&&status.label):[];
  const facts=Array.isArray(cfg.facts)?cfg.facts:[];
  const lifecycle=cfg.lifecycle||{};
  const lifecycleSteps=Array.isArray(lifecycle.steps)
    ? lifecycle.steps.filter(step=>step&&step.label)
    : [];
  const lifecycleIndex=lifecycleSteps.findIndex(step=>String(step.key)===String(lifecycle.current));
  const lifecycleHtml=lifecycleSteps.length?`
    <ol class="case-detail-lifecycle"
        data-case-lifecycle
        aria-label="${esc(String(lifecycle.label||'Lifecycle'))}">
      ${lifecycleSteps.map((step,index)=>{
        const state=index<lifecycleIndex?'done':index===lifecycleIndex?'current':'pending';
        const marker=index<lifecycleIndex?ic('check'):index===lifecycleIndex?ic('clock'):'';
        return `<li class="${state}" data-case-lifecycle-step="${esc(String(step.key))}"
            ${state==='current'?'aria-current="step"':''}>
          <span class="case-detail-lifecycle-marker" aria-hidden="true">${marker}</span>
          <span>${esc(String(step.label))}</span>
        </li>`;
      }).join('')}
    </ol>`:'';
  const hasOverview=Boolean(identity.title||identity.code||identity.meta||identity.related
    ||statuses.length||facts.length||lifecycleSteps.length);
  const overviewHtml=hasOverview?`
    <div class="case-detail-overview-head">
      <div class="case-detail-identity">
        <div>
          <h2>${esc(String(identity.title||''))}</h2>
          ${identity.code?`<span class="case-detail-code">${esc(String(identity.code))}</span>`:''}
        </div>
        ${identity.meta?`<p>${esc(String(identity.meta))}</p>`:''}
      </div>
      <div class="case-detail-overview-actions">
        ${statuses.length?`<div class="case-detail-statuses">${statuses.map(status=>
          cap(String(status.label),status.tone||'neutral')).join('')}</div>`:''}
        ${identity.related||''}
      </div>
    </div>
    ${lifecycleHtml}
    ${facts.length?`<div class="case-detail-facts">
      ${facts.map(fact=>`<div class="case-detail-fact">
        <small>${esc(String(fact.label||''))}</small>
        <b class="${fact.numeric?'tnum':''}">${esc(String(fact.value??'—'))}</b>
      </div>`).join('')}
    </div>`:''}`:'';
  const empty=cfg.empty||null;
  const main=empty
    ? `<div class="statepanel empty case-detail-empty" data-case-empty>
        ${ic(empty.icon||'inbox')}
        <h3>${esc(String(empty.title||'No case available'))}</h3>
        ${empty.description?`<p>${esc(String(empty.description))}</p>`:''}
      </div>`
    : (cfg.main||'');
  const context=cfg.context||{};
  const actions=cfg.actions||'';
  const body=`<section class="case-detail"
      data-layout="case-detail-v1"
      data-case-route="${esc(String(cfg.route||''))}">
    <div class="case-detail-overview" data-case-overview
        ${hasOverview?'':'hidden'}>${overviewHtml}</div>
    <div class="case-detail-error" data-case-error role="alert" hidden></div>
    <div class="case-detail-grid" data-case-grid>
      <main class="case-detail-main" data-case-main>${main}</main>
      <aside class="case-detail-context" data-case-context
          ${empty&&!context.body?'hidden':''}>
        ${context.title?`<div class="sectitle">${esc(String(context.title))}</div>`:''}
        ${context.body||''}
      </aside>
    </div>
    <div class="responsive-actionbar case-detail-actions"
        data-case-actions ${actions?'':'hidden'}>${actions}</div>
  </section>`;
  root.innerHTML=modulePage({
    module:cfg.module,
    route:cfg.route,
    active:cfg.active||cfg.route,
    title:String(cfg.title||''),
    crumb:cfg.crumb,
    sub:cfg.description,
    body,
  });
  const caseRoot=root.querySelector('[data-layout="case-detail-v1"]');
  if(typeof cfg.afterRender==='function'){
    cfg.afterRender({
      root,
      caseRoot,
      errorRoot:caseRoot&&caseRoot.querySelector('[data-case-error]'),
    });
  }
  return caseRoot;
}
window.caseDetailPage=caseDetailPage;

/**
 * Page-level SSOT for immutable financial account ledgers.
 *
 * A ledger is a drill target with accounting-specific opening/running/closing
 * balance semantics. It follows the standard module/list visual language while
 * keeping those rows structurally distinct from real journal entries.
 */
function ledgerDetailPage(root, config){
  if(!root) throw new Error('ledgerDetailPage requires a render root.');
  const cfg=config||{};
  const account=cfg.account||{};
  const metrics=Array.isArray(cfg.metrics)?cfg.metrics:[];
  const columns=Array.isArray(cfg.columns)?cfg.columns:[];
  const rows=Array.isArray(cfg.rows)?cfg.rows:[];
  const opening=cfg.opening||{};
  const totals=cfg.totals||{};
  const actions=Array.isArray(cfg.actions)?cfg.actions:[];
  const error=cfg.error||null;
  const empty=cfg.empty||{};
  const hasAccount=Boolean(account.code||account.name||account.meta);
  const metricHtml=metrics.length?metrics.map(metric=>`<div class="so-kpi ${metric.tone||''}">
      <small>${esc(String(metric.label||''))}</small>
      <b class="tnum">${esc(String(metric.value??'—'))}</b>
    </div>`).join(''):'';
  const actionHtml=actions.map((action,index)=>btn(String(action.label||''),{
    icon:action.icon||null,
    cls:action.cls||'soft',
    attrs:`data-ledger-action="${index}"${action.disabled?' disabled':''}`,
  })).join('');
  const columnHtml=columns.map(column=>`<th class="${column.align==='r'?'r':column.align==='c'?'c':'l'}">${esc(String(column.label||''))}</th>`).join('');
  const rowHtml=rows.map(row=>{
    const id=typeof cfg.rowId==='function'?cfg.rowId(row):'';
    return `<tr data-ledger-row="${esc(String(id??''))}" ${typeof cfg.onOpen==='function'?'tabindex="0"':''}>
      ${columns.map(column=>`<td class="${column.align==='r'?'r tnum':column.align==='c'?'c':'l'}">${column.render?column.render(row):esc(String(row[column.key]??''))}</td>`).join('')}
    </tr>`;
  }).join('');
  const emptyHtml=!rows.length?`<tr data-ledger-empty><td colspan="${Math.max(1,columns.length)}">
    <div class="statepanel empty ledger-detail-empty">
      ${ic(empty.icon||'book')}
      <h3>${esc(String(empty.title||'No ledger entries'))}</h3>
      ${empty.description?`<p>${esc(String(empty.description))}</p>`:''}
    </div>
  </td></tr>`:'';
  const openingCells=columns.length>=2
    ? `<td class="l" colspan="${columns.length-1}">${esc(String(opening.label||'Opening balance'))}</td>
       <td class="r tnum"><b>${esc(String(opening.balance??'—'))}</b></td>`
    : `<td class="r tnum"><b>${esc(String(opening.balance??'—'))}</b></td>`;
  const errorHtml=error?`${ic('warn')}<div><b>${esc(String(error.title||'Ledger unavailable'))}</b>
      ${error.description?`<span>${esc(String(error.description))}</span>`:''}</div>
      ${typeof error.onRetry==='function'?btn(String(error.retryLabel||'Retry'),{icon:'refresh',cls:'soft',attrs:'data-ledger-retry'}):''}`:'';
  const body=`<section class="ledger-detail"
      data-layout="ledger-detail-v1"
      data-ledger-route="${esc(String(cfg.route||''))}"
      data-ledger-account="${esc(String(account.code||''))}">
    <div class="ledger-detail-overview" data-ledger-overview ${hasAccount?'':'hidden'}>
      <div class="ledger-detail-account">
        <b>${esc(String(account.code||''))}</b>
        <span>${esc(String(account.name||''))}</span>
        ${account.meta?`<small>${esc(String(account.meta))}</small>`:''}
      </div>
      <div class="so-kpibar">${metricHtml}</div>
    </div>
    <div class="ledger-detail-error" data-ledger-error role="alert" ${error?'':'hidden'}>${errorHtml}</div>
    <div class="toolbar ledger-detail-toolbar" data-ledger-toolbar>
      ${cfg.note?`<small class="transaction-list-note">${esc(String(cfg.note))}</small>`:''}
      <div class="grow"></div>${actionHtml}
    </div>
    <div class="ledger-detail-table-scroll" data-ledger-table>
      <table class="ledger-detail-table">
        <thead><tr>${columnHtml}</tr></thead>
        <tbody>
          <tr class="ledger-detail-opening" data-ledger-opening>${openingCells}</tr>
          ${rowHtml}${emptyHtml}
        </tbody>
      </table>
    </div>
    <div class="ledger-detail-footer" data-ledger-footer>
      <b>${esc(String(totals.label||'Closing balance'))}</b>
      <span><small>${esc(String(metrics[1]?.label||''))}</small><strong class="tnum">${esc(String(totals.debit??'—'))}</strong></span>
      <span><small>${esc(String(metrics[2]?.label||''))}</small><strong class="tnum">${esc(String(totals.credit??'—'))}</strong></span>
      <span><small>${esc(String(metrics[3]?.label||totals.label||''))}</small><strong class="tnum">${esc(String(totals.balance??'—'))}</strong></span>
    </div>
  </section>`;
  root.innerHTML=modulePage({
    module:cfg.module,
    route:cfg.route,
    active:cfg.active||cfg.route,
    title:String(cfg.title||account.name||''),
    crumb:cfg.crumb,
    sub:cfg.description,
    count:error?null:rows.length,
    body,
  });
  const ledgerRoot=root.querySelector('[data-layout="ledger-detail-v1"]');
  actions.forEach((action,index)=>{
    ledgerRoot?.querySelector(`[data-ledger-action="${index}"]`)?.addEventListener('click',event=>{
      if(typeof action.onClick==='function'&&!action.disabled) action.onClick(event);
    });
  });
  ledgerRoot?.querySelector('[data-ledger-retry]')?.addEventListener('click',event=>error.onRetry(event));
  if(typeof cfg.onOpen==='function'){
    ledgerRoot?.querySelectorAll('[data-ledger-row]').forEach(row=>{
      const open=()=>cfg.onOpen(rows.find(candidate=>String(cfg.rowId(candidate))===String(row.dataset.ledgerRow)),row.dataset.ledgerRow);
      row.addEventListener('click',open);
      row.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}
      });
    });
  }
  if(typeof cfg.afterRender==='function'){
    cfg.afterRender({root,ledgerRoot,errorRoot:ledgerRoot&&ledgerRoot.querySelector('[data-ledger-error]')});
  }
  return ledgerRoot;
}
window.ledgerDetailPage=ledgerDetailPage;

/**
 * Page-level SSOT for immutable operational and financial postings.
 *
 * The shell owns posting identity, status, facts, main/context placement,
 * responsive actions and standard empty/error states. Finance screens provide
 * balanced journals; inventory postings provide their stock-effect evidence.
 */
function postingDetailPage(root, config){
  if(!root) throw new Error('postingDetailPage requires a render root.');
  const cfg=config||{};
  const identity=cfg.identity||{};
  const facts=Array.isArray(cfg.facts)?cfg.facts:[];
  const actions=Array.isArray(cfg.actions)?cfg.actions:[];
  const headerAction=cfg.headerAction||null;
  const status=cfg.status||null;
  const error=cfg.error||null;
  const empty=cfg.empty||null;
  const hasIdentity=Boolean(identity.code||identity.title||identity.meta);
  const factHtml=facts.map(fact=>`<div class="posting-detail-fact">
      <small>${esc(String(fact.label||''))}</small>
      <b class="${fact.numeric?'tnum':''}">${esc(String(fact.value??'—'))}</b>
    </div>`).join('');
  const statusHtml=status?cap(
    String(status.label||''),
    status.tone||'neutral',
  ):'';
  const actionHtml=actions.map((action,index)=>btn(String(action.label||''),{
    icon:action.icon||null,
    cls:action.cls||'soft',
    sm:action.sm,
    attrs:`data-posting-action="${index}" ${action.attrs||''}${action.disabled?' disabled':''}`,
  })).join('');
  const headerActionHtml=headerAction?btn(String(headerAction.label||''),{
    icon:headerAction.icon||null,
    cls:headerAction.cls||'primary',
    sm:headerAction.sm,
    attrs:`data-posting-header-action ${headerAction.attrs||''}${headerAction.disabled?' disabled':''}`,
  }):'';
  const emptyAction=empty&&empty.action||null;
  const errorHtml=error?`${ic('warn')}<div><b>${esc(String(error.title||'Posting unavailable'))}</b>
      ${error.description?`<span>${esc(String(error.description))}</span>`:''}</div>
      ${typeof error.onRetry==='function'?btn(String(error.retryLabel||'Retry'),{icon:'refresh',cls:'soft',attrs:'data-posting-retry'}):''}`:'';
  const emptyHtml=empty?`<div class="statepanel empty posting-detail-empty" data-posting-empty>
      ${ic(empty.icon||'book')}<h3>${esc(String(empty.title||'No posting available'))}</h3>
      ${empty.description?`<p>${esc(String(empty.description))}</p>`:''}
      ${emptyAction?btn(String(emptyAction.label||''),{
        icon:emptyAction.icon||null,
        cls:emptyAction.cls||'primary',
        sm:emptyAction.sm,
        attrs:`data-posting-empty-action ${emptyAction.attrs||''}${emptyAction.disabled?' disabled':''}`,
      }):''}
    </div>`:'';
  const body=`<section class="posting-detail${empty?' is-empty':''}"
      data-layout="posting-detail-v1"
      data-posting-route="${esc(String(cfg.route||''))}"
      data-posting-code="${esc(String(identity.code||''))}">
    <div class="posting-detail-overview" data-posting-overview ${hasIdentity?'':'hidden'}>
      <div class="posting-detail-identity">
        <span>${esc(String(identity.title||''))}</span>
        <b>${esc(String(identity.code||''))}</b>
        ${identity.meta?`<small>${esc(String(identity.meta))}</small>`:''}
      </div>
      <div class="grow"></div>${statusHtml}
      <div class="posting-detail-facts">${factHtml}</div>
    </div>
    <div class="posting-detail-error" data-posting-error role="alert" ${error?'':'hidden'}>${errorHtml}</div>
    <div class="posting-detail-grid" data-posting-grid>
      <main class="posting-detail-main" data-posting-main>${emptyHtml||String(cfg.main||'')}</main>
      <aside class="posting-detail-context" data-posting-context ${empty?'hidden':''}>${String(cfg.context?.body||'')}</aside>
    </div>
    <div class="responsive-actionbar posting-detail-actions"
        data-posting-actions ${actionHtml?'':'hidden'}>${actionHtml}</div>
  </section>`;
  root.innerHTML=modulePage({
    module:cfg.module,
    route:cfg.route,
    active:cfg.active||cfg.route,
    title:String(cfg.title||identity.title||''),
    crumb:cfg.crumb,
    sub:cfg.description,
    action:headerActionHtml,
    body,
  });
  const postingRoot=root.querySelector('[data-layout="posting-detail-v1"]');
  actions.forEach((action,index)=>{
    postingRoot?.querySelector(`[data-posting-action="${index}"]`)?.addEventListener('click',event=>{
      if(typeof action.onClick==='function'&&!action.disabled) action.onClick(event);
    });
  });
  postingRoot?.closest('.master')?.querySelector('[data-posting-header-action]')?.addEventListener('click',event=>{
    if(typeof headerAction?.onClick==='function'&&!headerAction.disabled) headerAction.onClick(event);
  });
  postingRoot?.querySelector('[data-posting-empty-action]')?.addEventListener('click',event=>{
    if(typeof emptyAction?.onClick==='function'&&!emptyAction.disabled) emptyAction.onClick(event);
  });
  postingRoot?.querySelector('[data-posting-retry]')?.addEventListener('click',event=>error.onRetry(event));
  if(typeof cfg.afterRender==='function'){
    cfg.afterRender({
      root,
      postingRoot,
      errorRoot:postingRoot&&postingRoot.querySelector('[data-posting-error]'),
    });
  }
  return postingRoot;
}
window.postingDetailPage=postingDetailPage;

/**
 * Page-level SSOT for hierarchical financial statements.
 */
function financialStatementPage(root, config){
  if(!root) throw new Error('financialStatementPage requires a render root.');
  const cfg=config||{};
  const filters=Array.isArray(cfg.filters)?cfg.filters:[];
  const metrics=Array.isArray(cfg.metrics)?cfg.metrics:[];
  const sections=Array.isArray(cfg.sections)?cfg.sections:[];
  const columns=Array.isArray(cfg.columns)?cfg.columns:[];
  const actions=Array.isArray(cfg.actions)?cfg.actions:[];
  const error=cfg.error||null;
  const empty=cfg.empty||null;
  const amount=typeof cfg.formatAmount==='function'
    ?cfg.formatAmount
    :(value=>esc(String(value??'—')));
  const variance=typeof cfg.formatVariance==='function'
    ?cfg.formatVariance
    :((value,pct)=>`${amount(value)}${pct==null?'':` <small>${esc(String(pct))}%</small>`}`);
  const filterHtml=filters.map(filter=>`<label class="financial-filter">
      <span>${esc(String(filter.label||''))}</span>${filter.control||''}
    </label>`).join('');
  const metricHtml=metrics.map(metric=>`<div class="so-kpi ${metric.tone||''}">
      <small>${esc(String(metric.label||''))}</small>
      <b class="tnum">${esc(String(metric.value??'—'))}</b>
    </div>`).join('');
  const headerHtml=columns.map((column,index)=>`<div class="financial-cell ${index?'r':'l'}">
      ${esc(String(column.label||''))}
    </div>`).join('');
  const statementHtml=sections.map(section=>`<section class="financial-section"
      data-financial-section="${esc(String(section.key||''))}">
    <div class="financial-row financial-subtotal">
      <div class="financial-cell l"><b>${esc(String(section.label||section.key||''))}</b></div>
      <div class="financial-cell r tnum">${amount(section.actualPeriod)}</div>
      <div class="financial-cell r tnum">${amount(section.actualYtd)}</div>
      <div class="financial-cell r tnum">${amount(section.comparisonYtd)}</div>
      <div class="financial-cell r tnum">${variance(section.varianceYtd,section.variancePercentYtd,section.favorableYtd)}</div>
    </div>
    ${(section.rows||[]).map(row=>`<div class="financial-row financial-account-row">
      <div class="financial-cell l"><span>${esc(String(row.accountCode||''))}</span>
        <b>${esc(String(row.accountName||''))}</b>
        ${row.mapped===false?`<small class="financial-unmapped">${esc(String(cfg.unmappedLabel||'Unmapped'))}</small>`:''}
      </div>
      <div class="financial-cell r tnum">${amount(row.actualPeriod)}</div>
      <div class="financial-cell r tnum">${amount(row.actualYtd)}</div>
      <div class="financial-cell r tnum">${amount(row.comparisonYtd)}</div>
      <div class="financial-cell r tnum">${variance(row.varianceYtd,row.variancePercentYtd,row.favorableYtd)}</div>
    </div>`).join('')}
  </section>`).join('');
  const total=cfg.totals||null;
  const totalHtml=total?`<div class="financial-row financial-grandtotal">
    <div class="financial-cell l"><b>${esc(String(total.label||''))}</b></div>
    <div class="financial-cell r tnum">${amount(total.actualPeriod)}</div>
    <div class="financial-cell r tnum">${amount(total.actualYtd)}</div>
    <div class="financial-cell r tnum">${amount(total.comparisonYtd)}</div>
    <div class="financial-cell r tnum">${variance(total.varianceYtd,total.variancePercentYtd,total.favorableYtd)}</div>
  </div>`:'';
  const actionHtml=actions.map((action,index)=>btn(String(action.label||''),{
    icon:action.icon||null,cls:action.cls||'soft',
    attrs:`data-financial-action="${esc(String(action.key||index))}" ${action.disabled?'disabled':''}`,
  })).join('');
  const body=`<section class="financial-statement" data-layout="financial-statement-v1"
      data-financial-route="${esc(String(cfg.route||''))}">
    <div class="financial-summary so-kpis" data-financial-summary>${metricHtml}</div>
    <div class="financial-filters" data-financial-filters>
      <button class="btn soft financial-filter-toggle" data-financial-filter-toggle>
        ${ic('filter')}<span>${esc(String(cfg.filterLabel||'Filters'))}</span></button>
      <div class="financial-filter-fields">${filterHtml}</div><div class="grow"></div>
      ${cfg.runLabel?btn(String(cfg.runLabel),{icon:'play',cls:'primary',attrs:'data-financial-run'}):''}
    </div>
    <div class="financial-error" data-financial-error role="alert" ${error?'':'hidden'}>
      ${error?`<div>${ic('warn')}<span>${esc(String(error.message||error))}</span>
        ${cfg.retryLabel?btn(String(cfg.retryLabel),{icon:'refresh',cls:'soft',attrs:'data-financial-retry'}):''}</div>`:''}
    </div>
    <div class="financial-statement-body" data-financial-statement>
      ${empty?`<div class="statepanel empty">${ic(empty.icon||'chart')}
        <h3>${esc(String(empty.title||''))}</h3>
        ${empty.description?`<p>${esc(String(empty.description))}</p>`:''}</div>`:
        `<div class="financial-tablewrap"><div class="financial-row financial-head">${headerHtml}</div>
          ${statementHtml}${totalHtml}</div>`}
    </div>
    <div class="responsive-actionbar financial-actions" data-financial-actions ${actionHtml?'':'hidden'}>
      <span class="financial-report-meta">${esc(String(cfg.reportMeta||''))}</span>
      <div class="grow"></div>${actionHtml}
    </div>
    <div class="financial-export-status" data-financial-export-status
        ${cfg.exportJob?'':'hidden'}>${cfg.exportJob||''}</div>
  </section>`;
  root.innerHTML=modulePage({
    module:cfg.module,route:cfg.route,active:cfg.active||cfg.route,
    title:String(cfg.title||''),crumb:cfg.crumb,sub:cfg.description,
    action:cfg.pageAction||'',body,
  });
  const statement=root.querySelector('[data-layout="financial-statement-v1"]');
  root.querySelector('[data-financial-filter-toggle]')?.addEventListener('click',()=>{
    statement?.classList.toggle('filters-open');
  });
  if(typeof cfg.afterRender==='function'){
    cfg.afterRender({
      root,statement,
      errorRoot:statement&&statement.querySelector('[data-financial-error]'),
      exportRoot:statement&&statement.querySelector('[data-financial-export-status]'),
    });
  }
  return statement;
}
window.financialStatementPage=financialStatementPage;

/* Compatibility bridge for long single-line document renderers. New detail
   screens emit an H1 directly; this upgrades the remaining title node without
   changing its localized child markup or event wiring. */
function promoteDocumentTitle(root){
  const current=root&&root.querySelector('.dh-row1 .dt:not(h1)');
  if(!current) return null;
  const heading=document.createElement('h1');
  heading.className=current.className;
  [...current.attributes].forEach(attribute=>{
    if(attribute.name!=='class') heading.setAttribute(attribute.name,attribute.value);
  });
  while(current.firstChild) heading.appendChild(current.firstChild);
  current.replaceWith(heading);
  return heading;
}
window.promoteDocumentTitle=promoteDocumentTitle;

/**
 * Page-level SSOT for canonical transaction registers.
 *
 * `modulePage()` owns the shared ERP shell and `buildTable()`/`wireTable()` own
 * the low-level grid. This helper owns the missing layer between them: title
 * action, KPI strip, filters, toolbar actions, table/empty state and pagination
 * regions. Screen modules provide facts and behaviour only; they must not
 * rebuild this chrome independently.
 */
function transactionListPage(root, config){
  if(!root) throw new Error('transactionListPage requires a render root.');
  const cfg=config||{};
  const value=(candidate,...args)=>typeof candidate==='function'?candidate(...args):candidate;
  const layout=cfg.layout||'transaction-list-v1';
  const detailPane=cfg.detailPane||null;
  const localeState=typeof window.erpGetLocaleRefreshState==='function'
    ?window.erpGetLocaleRefreshState(cfg.route):null;
  const configuredFilters=value(cfg.filters)||[];
  const filterKeys=configuredFilters.map(item=>Array.isArray(item)?item[0]:item.key);
  const restoredFilter=localeState?.list?.filter;
  let activeFilter=restoredFilter!=null
    &&(restoredFilter==='all'||filterKeys.includes(restoredFilter))
    ?restoredFilter:cfg.initialFilter||'all';
  let searchTerm=typeof localeState?.list?.search==='string'?localeState.list.search:'';
  let selectedId=localeState?.list?.selectedId??null;

  function allRows(){
    const rows=value(cfg.rows);
    return Array.isArray(rows)?rows:[];
  }
  function visibleRows(){
    let rows=allRows();
    if(activeFilter!=='all'&&typeof cfg.filterFn==='function') {
      rows=rows.filter(row=>cfg.filterFn(row,activeFilter));
    }
    const query=searchTerm.trim().toLocaleLowerCase();
    if(query&&cfg.search&&typeof cfg.search.match==='function') {
      rows=rows.filter(row=>cfg.search.match(row,query));
    }
    return rows;
  }
  function previewRecord(row,id){
    const columns=(value(cfg.columns,[row])||[]).map(column=>({
      ...column,
      label:value(column.label,column,[row]),
    })).filter(column=>String(column.label||'').trim());
    const fields=columns.map(column=>{
      const rendered=column.render?column.render(row):esc(row[column.key]);
      return `<div class="field transaction-record-preview-field">
        <span class="k">${esc(String(column.label))}</span>
        <div class="v" inert>${rendered==null?'—':rendered}</div>
      </div>`;
    }).join('');
    const title=String(value(cfg.title,allRows())||cfg.route||'');
    appModal({
      icon:'file',
      title:`${title} · ${id}`,
      body:`<div class="transaction-record-preview" data-record-preview data-record-id="${esc(String(id))}">
        ${fields||`<div class="statepanel empty">${ic('inbox')}<h3>${esc(String(id))}</h3></div>`}
      </div>`,
      actions:btn(t('common.close'),{cls:'soft',attrs:'onclick="closeModal()"'}),
      width:680,
    });
  }
  function rowActionFor(row,id){
    if(detailPane){
      const label=value(detailPane.rowLabel,row,id)
        ||value(cfg.rowLabel,row,id)
        ||`${t('common.open')} ${id}`;
      return {kind:'select',label:String(label),run:()=>select(id)};
    }
    const configured=cfg.rowAction;
    if(configured&&typeof configured.run==='function'){
      const enabled=configured.enabled==null||Boolean(value(configured.enabled,row,id));
      if(enabled){
        const label=value(configured.label,row,id)
          ||value(cfg.rowLabel,row,id)
          ||`${t('common.open')} ${id}`;
        return {
          kind:configured.kind||'open',
          label:String(label),
          run:()=>configured.run(row,id),
        };
      }
    }
    if(typeof cfg.onOpen==='function'){
      const label=value(cfg.rowLabel,row,id)||`${t('common.open')} ${id}`;
      return {kind:'open',label:String(label),run:()=>cfg.onOpen(row,id)};
    }
    if(layout==='transaction-list-v1'&&cfg.recordPreview!==false){
      const label=value(cfg.rowLabel,row,id)||`${t('common.open')} ${id}`;
      return {kind:'open',label:String(label),run:()=>previewRecord(row,id)};
    }
    return null;
  }
  function renderKpis(rows){
    const items=value(cfg.kpis,rows)||[];
    if(!items.length) return '<div class="so-kpibar" data-list-kpis hidden></div>';
    return `<div class="so-kpibar" data-list-kpis>${items.map(item=>{
      const filter=value(item.filter,item,rows);
      const hasAction=typeof item.onClick==='function'&&!item.disabled;
      const clickable=hasAction||filter!=null;
      const classes=[
        'so-kpi',clickable?'clickable':'',filter===activeFilter?'active':'',
        item.negative?'neg':'',item.accent?'accent':'',
      ].filter(Boolean).join(' ');
      const attrs=hasAction
        ?`data-list-kpi-action="${items.indexOf(item)}"`
        :filter!=null
          ?`data-list-kpi-filter="${esc(String(filter))}"`
          :'disabled';
      return `<button class="${classes}" ${attrs}>
        <small>${esc(String(value(item.label,item,rows)||''))}</small>
        <b class="tnum">${esc(String(value(item.value,item,rows)??''))}</b>
      </button>`;
    }).join('')}</div>`;
  }
  function renderFilters(){
    const chips=configuredFilters;
    if(!chips.length) return '<div class="filterchips" data-list-filters hidden></div>';
    return `<div class="filterchips" data-list-filters>${chips.map(item=>{
      const key=Array.isArray(item)?item[0]:item.key;
      const label=Array.isArray(item)?item[1]:item.label;
      return `<button class="chip ${key===activeFilter?'on':''}" data-list-filter="${esc(String(key))}">
        ${item&&item.businessText?`<span data-business-text>${esc(String(value(label,item)||''))}</span>`:esc(String(value(label,item)||''))}
      </button>`;
    }).join('')}</div>`;
  }
  function renderSearch(){
    if(!cfg.search) return '';
    const label=String(value(cfg.search.label)||value(cfg.search.placeholder)||'Search');
    return `<label class="transaction-list-search">
      ${ic('search')}
      <input type="search" value="${esc(searchTerm)}" placeholder="${esc(String(value(cfg.search.placeholder)||label))}"
        aria-label="${esc(label)}" data-list-search autocomplete="off">
    </label>`;
  }
  function renderToolbarActions(rows){
    const actions=value(cfg.toolbarActions,rows)||[];
    return actions.map((action,index)=>btn(String(value(action.label,action,rows)||''),{
      icon:action.icon||null,
      cls:action.cls||'soft',
      attrs:`data-list-toolbar-action="${index}"${action.disabled?' disabled':''}`,
    })).join('');
  }
  function renderEmpty(){
    const empty=searchTerm.trim()&&cfg.search&&cfg.search.empty?cfg.search.empty:(cfg.empty||{});
    return `<div class="statepanel empty" data-list-empty>
      ${ic(empty.icon||'inbox')}
      <h3>${esc(String(value(empty.title)||'No records'))}</h3>
      ${empty.description?`<p>${esc(String(value(empty.description)))}</p>`:''}
    </div>`;
  }
  function renderTable(rows){
    if(!rows.length) return renderEmpty();
    const columns=(value(cfg.columns,rows)||[]).map(column=>({
      ...column,
      label:value(column.label,column,rows),
    }));
    return buildTable({
      checkable:Boolean(cfg.checkable),
      rowId:cfg.rowId,
      rowInteraction:(row,id)=>{
        const action=rowActionFor(row,id);
        return action
          ?{kind:action.kind,label:action.label}
          :{kind:'none',label:''};
      },
      columns,
      rows,
    });
  }
  function renderPagination(rows){
    const pagination=value(cfg.pagination,rows);
    if(!pagination) return '<div class="transaction-list-pagination" data-list-pagination hidden></div>';
    return `<div class="transaction-list-pagination" data-list-pagination>${pagination}</div>`;
  }
  function selectedRow(rows=allRows()){
    return selectedId==null
      ? null
      : rows.find(row=>String(cfg.rowId(row))===String(selectedId))||null;
  }
  function renderDetail(rows){
    if(!detailPane) return '';
    const row=selectedRow(rows);
    const content=row
      ? value(detailPane.content,row,{selectedId,render,select})
      : value(detailPane.empty,{selectedId,render,select});
    return `<aside class="detail master-detail-register-detail ${row?'open':'is-empty'}"
        data-master-detail-panel>
      ${content||'<div class="detail-empty"></div>'}
    </aside>`;
  }
  function renderListBody(rows){
    const table=`<div class="sales-tablewrap" data-list-table>${renderTable(rows)}</div>`;
    const pagination=renderPagination(rows);
    if(!detailPane) return `${table}${pagination}`;
    return `<div class="master-detail-register-workspace" data-master-detail-workspace>
      <div class="master-detail-register-list">${table}${pagination}</div>
      ${renderDetail(rows)}
    </div>`;
  }
  function render(){
    const rows=visibleRows();
    const source=allRows();
    const primary=cfg.primaryAction;
    const primaryHtml=primary?btn(String(value(primary.label,source)||''),{
      icon:primary.icon||'plus',
      cls:primary.cls||'primary',
      attrs:`data-list-primary-action${primary.disabled?' disabled':''}`,
    }):'';
    const note=value(cfg.note,source);
    const toolbarContent=value(cfg.toolbarContent,rows,source)||'';
    const body=`<div class="sales-body transaction-list-body ${detailPane?'master-detail-register-body':''}"
        data-layout="${esc(layout)}" data-list-route="${esc(String(cfg.route||''))}">
      ${renderKpis(source)}
      <div class="toolbar" data-list-toolbar>
        ${renderSearch()}${renderFilters()}<div class="grow"></div>
        ${note?`<small class="transaction-list-note">${esc(String(note))}</small>`:''}
        ${toolbarContent}
        ${renderToolbarActions(rows)}
      </div>
      ${renderListBody(rows)}
    </div>`;
    root.innerHTML=modulePage({
      module:cfg.module,
      route:cfg.route,
      active:cfg.active||cfg.route,
      title:String(value(cfg.title,source)||''),
      crumb:value(cfg.crumb,source),
      sub:value(cfg.description,source),
      count:value(cfg.count,rows,source)??rows.length,
      action:primaryHtml,
      body,
    });
    wire(rows);
  }
  function setFilter(filter){
    activeFilter=filter||'all';
    const rows=visibleRows();
    if(detailPane&&Object.prototype.hasOwnProperty.call(detailPane,'selectionOnFilter')){
      const next=value(detailPane.selectionOnFilter,rows,activeFilter);
      selectedId=next==null?null:String(next);
    }else if(selectedId!=null&&!selectedRow(rows)){
      selectedId=null;
    }
    render();
  }
  function select(id){
    selectedId=id==null?null:String(id);
    render();
  }
  function wire(rows){
    const tableRoot=root.querySelector('[data-list-table]');
    if(rows.length){
      wireTable(tableRoot,{
        onRow:id=>{
          const row=rows.find(candidate=>String(cfg.rowId(candidate))===String(id));
          const action=row&&rowActionFor(row,id);
          if(action) action.run();
        },
        onSelectionChange:cfg.onSelectionChange,
      });
      if(detailPane&&selectedId!=null){
        tableRoot.querySelectorAll('.dt-r[data-row]').forEach(row=>{
          row.classList.toggle('sel',String(row.dataset.row)===String(selectedId));
        });
      }
    }
    root.querySelectorAll('[data-list-filter]').forEach(button=>button.addEventListener('click',()=>{
      setFilter(button.dataset.listFilter);
    }));
    root.querySelectorAll('[data-list-kpi-filter]').forEach(button=>button.addEventListener('click',()=>{
      setFilter(button.dataset.listKpiFilter);
    }));
    const kpiItems=value(cfg.kpis,allRows())||[];
    root.querySelectorAll('[data-list-kpi-action]').forEach(button=>button.addEventListener('click',event=>{
      const item=kpiItems[Number(button.dataset.listKpiAction)];
      if(item&&!item.disabled&&typeof item.onClick==='function') item.onClick(event,allRows());
    }));
    root.querySelector('[data-list-search]')?.addEventListener('input',event=>{
      const input=event.currentTarget;
      searchTerm=input.value;
      const caret=input.selectionStart;
      render();
      const next=root.querySelector('[data-list-search]');
      next?.focus();
      if(next&&caret!=null) next.setSelectionRange(caret,caret);
    });
    root.querySelector('[data-list-primary-action]')?.addEventListener('click',event=>{
      if(primaryEnabled(cfg.primaryAction)) cfg.primaryAction.onClick(event);
    });
    const actions=value(cfg.toolbarActions,rows)||[];
    root.querySelectorAll('[data-list-toolbar-action]').forEach(button=>button.addEventListener('click',event=>{
      const action=actions[Number(button.dataset.listToolbarAction)];
      if(action&&typeof action.onClick==='function'&&!action.disabled) action.onClick(event,rows);
    }));
    if(typeof cfg.rowMenu==='function'){
      tableRoot.querySelectorAll('.transaction-row-menu').forEach(button=>button.addEventListener('click',event=>{
        event.stopPropagation();
        const rowElement=button.closest('[data-row]');
        const row=rows.find(candidate=>String(cfg.rowId(candidate))===String(rowElement?.dataset.row));
        if(row) openTransactionRowMenu(button,cfg.rowMenu(row));
      }));
    }
    root.querySelector('[data-master-detail-close]')?.addEventListener('click',()=>select(null));
    if(detailPane&&typeof detailPane.afterRender==='function'){
      detailPane.afterRender({
        root,
        detailRoot:root.querySelector('[data-master-detail-panel]'),
        row:selectedRow(rows),
        selectedId,
        select,
        render,
      });
    }
    if(typeof cfg.afterRender==='function') cfg.afterRender({root,rows,allRows:allRows(),activeFilter,setFilter,render});
  }
  function primaryEnabled(primary){
    return primary&&typeof primary.onClick==='function'&&!primary.disabled;
  }

  if(detailPane){
    const initial=value(detailPane.initialSelectedId,allRows());
    if(initial!=null) selectedId=String(initial);
  }
  render();
  return {
    render,
    setFilter,
    getFilter:()=>activeFilter,
    getSearch:()=>searchTerm,
    rows:visibleRows,
    select,
    getSelected:()=>selectedRow(),
  };
}
window.transactionListPage=transactionListPage;

/**
 * Low-level SSOT for dense table listings that need the same interaction
 * contract outside a transaction register: searchable rows, explicit page
 * size, stable pagination, single-line cells and one horizontal scroll host.
 * Domain screens provide rows, columns, labels and row behaviour only.
 */
function tableListing(config){
  const cfg=config||{};
  if(!Array.isArray(cfg.columns)) throw new Error('tableListing requires columns.');
  const state=cfg.state||{};
  const rows=Array.isArray(cfg.rows)?cfg.rows:[];
  const rowId=typeof cfg.rowId==='function'?cfg.rowId:(row=>row.id);
  const pageSizes=(Array.isArray(cfg.pageSizeOptions)?cfg.pageSizeOptions:[10,25,50])
    .map(value=>Number(value)).filter(value=>Number.isFinite(value)&&value>0)
    .map(value=>Math.floor(value));
  const sizes=[...new Set(pageSizes.length?pageSizes:[10,25,50])];
  const labels=cfg.labels||{};
  const interpolate=(template,values)=>String(template||'').replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(match,key)=>values[key]??match);
  const search=cfg.search||{};
  const query=String(state.search||'').trim().toLocaleLowerCase();
  const filteredRows=query&&typeof search.match==='function'
    ?rows.filter(row=>Boolean(search.match(row,query)))
    :query
      ?rows.filter(row=>JSON.stringify(row).toLocaleLowerCase().includes(query))
      :rows.slice();
  const selectedPageSize=sizes.includes(Number(state.pageSize))?Number(state.pageSize):sizes[0];
  state.pageSize=selectedPageSize;
  const pageCount=Math.max(1,Math.ceil(filteredRows.length/selectedPageSize));
  const currentPage=Math.max(1,Math.min(pageCount,Number(state.page)||1));
  state.page=currentPage;
  const from=filteredRows.length?(currentPage-1)*selectedPageSize+1:0;
  const to=filteredRows.length?Math.min(currentPage*selectedPageSize,filteredRows.length):0;
  const pageRows=filteredRows.slice(from?from-1:0,to||undefined);
  const empty=cfg.empty||{};
  const emptyTitle=query?(empty.searchTitle||empty.title||'No matching records'):(empty.title||'No records');
  const emptyDescription=query?(empty.searchDescription||empty.description||''):(empty.description||'');
  const table=pageRows.length
    ?buildTable({
      columns:cfg.columns,
      rows:pageRows,
      rowId,
      rowSelected:(row,id)=>cfg.selectedId!=null&&String(cfg.selectedId)===String(id),
      rowInteraction:typeof cfg.onRow==='function'
        ?(row,id)=>({kind:'select',label:String(typeof cfg.rowLabel==='function'?cfg.rowLabel(row,id):id)})
        :()=>({kind:'none',label:''}),
    })
    :`<div class="statepanel empty" data-table-listing-empty>${ic(empty.icon||'inbox')}
      <h3>${esc(String(emptyTitle))}</h3>${emptyDescription?`<p>${esc(String(emptyDescription))}</p>`:''}</div>`;
  const showing=interpolate(labels.showing||'{from}–{to} of {total}',{from,to,total:filteredRows.length});
  const pageLabel=interpolate(labels.page||'Page {page} of {pages}',{page:currentPage,pages:pageCount});
  const html=`<section class="table-listing" data-table-listing data-table-listing-view="${esc(String(cfg.view||'list'))}"
      data-table-listing-page="${currentPage}" data-table-listing-page-size="${selectedPageSize}">
    <div class="table-listing-toolbar" data-table-listing-toolbar>
      <label class="table-listing-search" data-table-listing-search-wrap>
        ${ic('search')}<input type="search" value="${esc(String(state.search||''))}"
          placeholder="${esc(String(search.placeholder||labels.search||'Search'))}"
          aria-label="${esc(String(search.label||labels.search||'Search'))}"
          data-table-listing-search autocomplete="off" spellcheck="false">
      </label>
      <label class="table-listing-page-size"><span>${esc(String(labels.rowsPerPage||'Rows per page'))}</span>
        <select data-table-listing-page-size aria-label="${esc(String(labels.rowsPerPage||'Rows per page'))}">
          ${sizes.map(size=>`<option value="${size}" ${size===selectedPageSize?'selected':''}>${size}</option>`).join('')}
        </select>
      </label>
      <span class="table-listing-result-count" aria-live="polite">${esc(showing)}</span>
    </div>
    ${cfg.scrollHint?`<div class="table-listing-scroll-hint">${ic('info')}<span>${esc(String(cfg.scrollHint))}</span></div>`:''}
    <div class="table-listing-scroll" data-table-listing-table data-table-listing-scroll>${table}</div>
    <footer class="table-listing-pagination" data-table-listing-pagination>
      <span class="table-listing-page-label">${esc(pageLabel)}</span><div class="table-listing-page-actions">
        ${btn(String(labels.previous||'Previous'),{icon:'chevL',cls:'soft',attrs:`type="button" data-table-listing-page="prev"${currentPage<=1?' disabled':''}`})}
        ${btn(String(labels.next||'Next'),{icon:'chevR',cls:'soft',attrs:`type="button" data-table-listing-page="next"${currentPage>=pageCount?' disabled':''}`})}
      </div>
    </footer>
  </section>`;
  return {
    html,pageRows,filteredRows,currentPage,pageCount,
    wire(scope){
      const listing=scope?.matches?.('[data-table-listing]')?scope:scope?.querySelector?.('[data-table-listing]');
      if(!listing) return;
      const tableRoot=listing.querySelector('[data-table-listing-table]');
      if(pageRows.length&&typeof cfg.onRow==='function'){
        wireTable(tableRoot,{onRow:id=>{
          const row=pageRows.find(candidate=>String(rowId(candidate))===String(id));
          if(row) cfg.onRow(row,id);
        }});
      }
      listing.querySelector('[data-table-listing-search]')?.addEventListener('input',event=>{
        const input=event.currentTarget;
        state.search=input.value;
        state.page=1;
        cfg.onChange?.({reason:'search',caret:input.selectionStart??input.value.length,state});
      });
      listing.querySelector('[data-table-listing-page-size]')?.addEventListener('change',event=>{
        state.pageSize=Number(event.currentTarget.value)||sizes[0];
        state.page=1;
        cfg.onChange?.({reason:'page-size',state});
      });
      listing.querySelectorAll('[data-table-listing-page]').forEach(button=>button.addEventListener('click',()=>{
        if(button.disabled) return;
        state.page+=button.dataset.tableListingPage==='next'?1:-1;
        state.page=Math.max(1,Math.min(pageCount,state.page));
        cfg.onChange?.({reason:'pagination',state});
      }));
    },
  };
}
window.tableListing=tableListing;

/**
 * Return the final date of the fiscal period selected in the global context.
 * Transaction composers use this instead of the workstation clock so a Demo
 * opened after its accounting period does not silently default into a future
 * or locked period.
 */
function workingPeriodEndDate(){
  const fiscal=DB&&DB.fiscal;
  if(!fiscal) return new Date().toISOString().slice(0,10);
  const selected=Math.max(1,Number(fiscal.selectedPeriod||fiscal.currentPeriod||1));
  const quarterly=Number(fiscal.periodCount)===4;
  const monthsPerPeriod=quarterly?3:1;
  const startOffset=(Number(fiscal.startMonth||1)-1)+((selected-1)*monthsPerPeriod);
  const end=new Date(Date.UTC(Number(fiscal.startYear),startOffset+monthsPerPeriod,0));
  return end.toISOString().slice(0,10);
}
window.workingPeriodEndDate=workingPeriodEndDate;

function workingPeriodStartDate(){
  const fiscal=DB&&DB.fiscal;
  if(!fiscal) return new Date().toISOString().slice(0,10);
  const selected=Math.max(1,Number(fiscal.selectedPeriod||fiscal.currentPeriod||1));
  const quarterly=Number(fiscal.periodCount)===4;
  const monthsPerPeriod=quarterly?3:1;
  const startOffset=(Number(fiscal.startMonth||1)-1)+((selected-1)*monthsPerPeriod);
  return new Date(Date.UTC(Number(fiscal.startYear),startOffset,1)).toISOString().slice(0,10);
}
window.workingPeriodStartDate=workingPeriodStartDate;

/** Stable operational date for Demo; production/API mode follows the workstation. */
function workingBusinessDate(){
  const value=DB&&DB.erpSystem&&DB.erpSystem.demoPack&&DB.erpSystem.demoPack.businessDate;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))
    ? String(value)
    : new Date().toISOString().slice(0,10);
}
window.workingBusinessDate=workingBusinessDate;

/** Add a lightweight type-ahead filter in front of a large native select. */
function bindSelectFilter(input,select,emptyText){
  if(!input||!select) return;
  const source=[...select.options].map(option=>({
    value:option.value,text:option.textContent||'',disabled:option.disabled,
  }));
  const hasPlaceholder=source[0]&&String(source[0].value)==='';
  input.addEventListener('input',()=>{
    const query=input.value.trim().toLocaleLowerCase();
    const selected=select.value;
    const visible=source.filter((option,index)=>(hasPlaceholder&&index===0)||!query||option.text.toLocaleLowerCase().includes(query));
    select.innerHTML='';
    visible.forEach(option=>{
      const element=document.createElement('option');
      element.value=option.value;element.textContent=option.text;element.disabled=option.disabled;
      select.appendChild(element);
    });
    if(visible.length===(hasPlaceholder?1:0)&&query){
      const none=document.createElement('option');
      none.disabled=true;none.textContent=emptyText||'No matches';select.appendChild(none);
    }
    if(visible.some(option=>String(option.value)===String(selected))) select.value=selected;
  });
}
window.bindSelectFilter=bindSelectFilter;

/**
 * SSOT for registers whose row selection opens a persistent desktop detail pane
 * and a mobile drawer. It intentionally reuses transactionListPage() so KPI,
 * filter, toolbar, table, empty and pagination behaviour cannot drift.
 */
function masterDetailRegisterPage(root,config){
  return transactionListPage(root,{
    ...(config||{}),
    layout:'master-detail-register-v1',
    detailPane:(config||{}).detailPane||{},
  });
}
window.masterDetailRegisterPage=masterDetailRegisterPage;

/**
 * SSOT for tabular reports. It shares the approved register chrome without
 * pretending that an analytical snapshot is a mutable transaction register.
 */
function reportListPage(root,config){
  return transactionListPage(root,{
    ...(config||{}),
    layout:'report-list-v1',
  });
}
window.reportListPage=reportListPage;

/**
 * Shared team-calendar workspace. The helper owns the required layout regions,
 * month/week/list rendering, selection semantics and responsive detail drawer;
 * domain screens provide localized labels, rows, filters and governed actions.
 */
function calendarWorkspacePage(root,config){
  const cfg=config||{};
  const localeState=typeof window.erpGetLocaleRefreshState==='function'
    ?window.erpGetLocaleRefreshState(cfg.route):null;
  const scrollState=cfg.preserveScroll===false||typeof window.erpCaptureScrollState!=='function'
    ?null
    :window.erpCaptureScrollState(root,cfg.route);
  const rows=Array.isArray(cfg.rows)?cfg.rows:[];
  const view=['month','week','list'].includes(localeState?.calendar?.view)
    ?localeState.calendar.view
    :['month','week','list'].includes(cfg.view)?cfg.view:'month';
  const selectedId=localeState?.list?.selectedId??cfg.selectedId;
  const listConfig=cfg.listTable?{...cfg.listTable}:null;
  if(listConfig&&localeState?.tableListing){
    listConfig.state={...(listConfig.state||{}),...localeState.tableListing};
  }
  const listTable=view==='list'&&listConfig
    ?tableListing({...listConfig,selectedId,onRow:row=>cfg.onSelect?.(row.id),onChange:change=>cfg.onListChange?.(change)})
    :null;
  const selected=rows.find(row=>String(row.id)===String(selectedId))||null;
  const resolve=(candidate,...args)=>typeof candidate==='function'?candidate(...args):candidate;
  const iso=value=>{
    const date=value instanceof Date?value:new Date(`${String(value)}T00:00:00Z`);
    return date.toISOString().slice(0,10);
  };
  const shift=(date,days)=>{
    const next=new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate()+days);
    return iso(next);
  };
  const startOfWeek=date=>{
    const valueDate=new Date(`${date}T00:00:00Z`);
    const day=(valueDate.getUTCDay()+6)%7;
    valueDate.setUTCDate(valueDate.getUTCDate()-day);
    return iso(valueDate);
  };
  const cursor=localeState?.calendar?.cursor||cfg.cursor||iso(new Date());
  const businessDate=cfg.businessDate||iso(new Date());
  const eventLabel=row=>esc(String(resolve(cfg.eventLabel,row)||row.employeeName||row.employeeNo||'Unavailable'));
  const eventAriaLabel=row=>[
    row.employeeName||row.employeeNo||'Unavailable',
    resolve(cfg.eventAriaSubtitle,row)||row.leaveType,
    row.startDate&&row.endDate?`${row.startDate} → ${row.endDate}`:null,
    cfg.statusLabel(row.status),
  ].filter(Boolean).join(' · ');
  const eventTone=row=>typeof cfg.eventTone==='function'
    ?cfg.eventTone(row)
    :row.status==='approved'?'ok':row.status==='pending'?'warn':'neutral';
  const eventButton=row=>`<button class="calendar-event ${eventTone(row)}${String(row.id)===String(selectedId)?' selected':''}"
      data-calendar-event="${esc(String(row.id))}" aria-label="${esc(eventAriaLabel(row))}"
      aria-pressed="${String(row.id)===String(selectedId)?'true':'false'}">
    <i class="calendar-event-dot" aria-hidden="true"></i>
    <span class="calendar-event-copy"><b>${eventLabel(row)}</b><small>${esc(String(resolve(cfg.eventSubtitle,row)||row.leaveType||cfg.statusLabel(row.status)))}</small></span>
    ${row.conflict?`<strong title="${esc(String(cfg.labels.conflict))}">!</strong>`:''}
  </button>`;
  const rowsForDay=day=>rows.filter(row=>row.startDate<=day&&row.endDate>=day);
  function monthSurface(){
    const current=new Date(`${cursor}T00:00:00Z`);
    const first=iso(new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),1)));
    const start=startOfWeek(first);
    const days=Array.from({length:42},(_,index)=>shift(start,index));
    return `<div class="calendar-month-grid" role="grid">
      ${(cfg.labels.weekdays||[]).map(label=>`<div class="calendar-weekday" role="columnheader">${esc(label)}</div>`).join('')}
      ${days.map(day=>{
        const dayRows=rowsForDay(day);
        const outside=day.slice(0,7)!==cursor.slice(0,7);
        const today=day===businessDate;
        return `<div class="calendar-day${outside?' outside':''}${today?' today':''}" role="gridcell" data-calendar-day="${day}"${today?' aria-current="date"':''}>
          <div class="calendar-day-number"><span>${Number(day.slice(8))}</span>${today?`<small>${esc(cfg.labels.today)}</small>`:''}</div>
          ${dayRows.slice(0,3).map(eventButton).join('')}
          ${dayRows.length>3?`<small>+${dayRows.length-3} ${esc(cfg.labels.more)}</small>`:''}
        </div>`;
      }).join('')}
    </div>`;
  }
  function weekSurface(){
    const start=startOfWeek(cursor);
    return `<div class="calendar-week-grid">
      ${Array.from({length:7},(_,index)=>{
        const day=shift(start,index);
        const dayRows=rowsForDay(day);
        return `<section class="calendar-week-day" data-calendar-day="${day}">
          <header><b>${esc((cfg.labels.weekdays||[])[index]||'')}</b><span>${esc(day.slice(5))}</span></header>
          <div>${dayRows.length?dayRows.map(eventButton).join(''):`<small>${esc(cfg.labels.noEvents)}</small>`}</div>
        </section>`;
      }).join('')}
    </div>`;
  }
  function listSurface(){
    if(listTable) return listTable.html;
    return `<div class="calendar-list">
      ${rows.length?rows.map(row=>`<button class="calendar-list-row" data-calendar-event="${esc(String(row.id))}">
        <span class="tnum">${esc(row.startDate)} → ${esc(row.endDate)}</span>
        <b>${eventLabel(row)}</b><span>${esc(String(row.department||''))}</span>
        ${cap(String(cfg.statusLabel(row.status)),eventTone(row))}
        ${row.conflict?cap(String(cfg.labels.conflict),'danger'):''}
      </button>`).join(''):`<div class="empty"><div>${ic('calendar')}</div><h3>${esc(cfg.labels.noEvents)}</h3></div>`}
    </div>`;
  }
  const surface=view==='week'?weekSurface():view==='list'?listSurface():monthSurface();
  const summary=Object.assign({
    total:rows.length,
    away:rows.filter(row=>row.status==='approved'&&row.startDate<=businessDate&&row.endDate>=businessDate).length,
    pending:rows.filter(row=>row.status==='pending').length,
    conflicts:rows.filter(row=>row.conflict).length,
  },cfg.summaryValues||{});
  const summaryCards=cfg.summaryLabels?`<div class="calendar-workspace-summary" data-calendar-summary>
    <div class="calendar-summary-card"><span class="calendar-summary-icon blue">${ic('calendar')}</span><div><small>${esc(cfg.summaryLabels.total)}</small><b>${summary.total}</b></div></div>
    <div class="calendar-summary-card"><span class="calendar-summary-icon green">${ic('people')}</span><div><small>${esc(cfg.summaryLabels.away)}</small><b>${summary.away}</b></div></div>
    <div class="calendar-summary-card"><span class="calendar-summary-icon amber">${ic('clock')}</span><div><small>${esc(cfg.summaryLabels.pending)}</small><b>${summary.pending}</b></div></div>
    <div class="calendar-summary-card"><span class="calendar-summary-icon red">${ic('warn')}</span><div><small>${esc(cfg.summaryLabels.conflicts)}</small><b>${summary.conflicts}</b></div></div>
  </div>`:'';
  const detailMode=cfg.detailMode==='modal'?'modal':'panel';
  const detail=selected
    ?resolve(cfg.detail,selected)
    :resolve(cfg.emptyDetail,summary)||`<div class="detail-empty">${ic('calendar')}<div><b>${esc(cfg.labels.select)}</b><small>${esc(cfg.labels.selectBody)}</small></div></div>`;
  const footerActionList=detailMode==='modal'?(cfg.actions||[]).filter(action=>!action.modal):(cfg.actions||[]);
  const modalActionList=detailMode==='modal'?(cfg.actions||[]).filter(action=>action.modal):[];
  const actionButtons=(actionList,attribute)=>actionList.map((action,index)=>btn(String(action.label),{
    icon:action.icon||null,cls:action.cls||'soft',
    attrs:`${attribute}="${index}"${action.disabled?' disabled':''}`,
  })).join('');
  const actions=actionButtons(footerActionList,'data-calendar-action');
  const modalDetail=selected?resolve(cfg.detailModalBody||cfg.detail,selected):null;
  const modalTitle=selected?String(resolve(cfg.detailModalTitle,selected)||selected.name||selected.employeeName||cfg.labels.select):'';
  const modalActions=selected?`${btn(String(cfg.labels.close||'Close'),{cls:'soft',attrs:'data-calendar-modal-close'})}${actionButtons(modalActionList,'data-calendar-modal-action')}`:'';
  const body=`<div class="calendar-workspace" data-layout="calendar-workspace-v1"
      data-calendar-route="${esc(String(cfg.route||''))}" data-calendar-view="${esc(view)}"
      data-calendar-cursor="${esc(String(cursor))}">
    <div class="calendar-workspace-header" data-calendar-header>
      <div class="calendar-nav">
        ${btn(cfg.labels.previous,{icon:'chevL',cls:'soft',attrs:'data-calendar-nav="-1"'})}
        ${btn(cfg.labels.today,{cls:'soft',attrs:'data-calendar-nav="today"'})}
        ${btn(cfg.labels.next,{icon:'chevR',cls:'soft',attrs:'data-calendar-nav="1"'})}
        <b>${esc(String(cfg.periodLabel||cursor))}</b>
      </div>
      <div class="calendar-view-switch">
        ${['month','week','list'].map(mode=>btn(cfg.labels[mode],{
          cls:mode===view?'primary':'soft',attrs:`data-calendar-view="${mode}"`,
        })).join('')}
      </div>
    </div>
    ${summaryCards}
    <div class="calendar-workspace-filters" data-calendar-filters>${resolve(cfg.filters)||''}</div>
    <div class="calendar-workspace-main${detailMode==='modal'?' modal-detail':''}">
      <div class="calendar-workspace-surface" data-calendar-surface>${surface}</div>
      <aside class="detail calendar-workspace-detail ${selected?'open':'is-empty'}${detailMode==='modal'?' calendar-workspace-detail-modal-placeholder':''}" data-calendar-detail${detailMode==='modal'?' hidden':''}>${detailMode==='modal'?'':detail}</aside>
    </div>
    <div class="calendar-workspace-error" data-calendar-error ${cfg.error?'':'hidden'}>
      ${cfg.error?`<div class="alert danger">${ic('warn')}<span>${esc(String(cfg.error))}</span></div>`:''}
    </div>
    <div class="set-savebar calendar-workspace-actions" data-calendar-actions>
      <span class="muted">${esc(String(cfg.privacy||''))}</span><div class="grow"></div>${actions}
    </div>
  </div>`;
  root.innerHTML=modulePage({
    module:cfg.module,route:cfg.route,active:cfg.active||cfg.route,
    title:String(cfg.title||''),sub:String(cfg.description||''),
    count:cfg.countLabel||rows.length,body,
  });
  if(scrollState&&typeof window.erpRestoreScrollState==='function'){
    window.erpRestoreScrollState(root,scrollState);
  }
  root.querySelectorAll('[data-calendar-nav]').forEach(button=>button.addEventListener('click',()=>{
    cfg.onNavigate?.(button.dataset.calendarNav);
  }));
  root.querySelectorAll('button[data-calendar-view]').forEach(button=>button.addEventListener('click',()=>{
    cfg.onView?.(button.dataset.calendarView);
  }));
  root.querySelectorAll('[data-calendar-event]').forEach(button=>button.addEventListener('click',()=>{
    cfg.onSelect?.(button.dataset.calendarEvent);
  }));
  listTable?.wire(root);
  root.querySelectorAll('[data-calendar-action]').forEach(button=>button.addEventListener('click',()=>{
    const action=footerActionList[Number(button.dataset.calendarAction)];
    if(action&&!action.disabled) action.onClick?.(selected);
  }));
  if(detailMode==='modal'&&selected&&typeof appModal==='function'){
    appModal({
      icon:cfg.detailModalIcon||'calendar',title:modalTitle,body:modalDetail||'',
      actions:modalActions,width:cfg.detailModalWidth||'min(560px, calc(100vw - 24px))',
      onClose:()=>cfg.onDetailClose?.(selected),
    });
    const modal=$('#modalEl');
    modal?.classList.add('calendar-detail-modal');
    modal?.setAttribute('role','dialog');
    modal?.setAttribute('aria-modal','true');
    modal?.querySelector('[data-calendar-modal-close]')?.addEventListener('click',closeModal);
    modal?.querySelectorAll('[data-calendar-modal-action]').forEach(button=>button.addEventListener('click',()=>{
      const action=modalActionList[Number(button.dataset.calendarModalAction)];
      if(action&&!action.disabled){closeModal();action.onClick?.(selected);}
    }));
  }
  cfg.afterRender?.({root,selected});
}
window.calendarWorkspacePage=calendarWorkspacePage;

function transactionRowMenuButton(label){
  return `<span class="rowact"><button class="transaction-row-menu" data-tip="${esc(label||'Actions')}" aria-label="${esc(label||'Row actions')}">${ic('more')}</button></span>`;
}
window.transactionRowMenuButton=transactionRowMenuButton;

function openTransactionRowMenu(button,items){
  const entries=(items||[]).filter(Boolean);
  if(!entries.length) return;
  closeAllPops();
  const rect=button.getBoundingClientRect();
  const menu=document.createElement('div');
  menu.className='pop show somenu';
  menu.style.cssText=`width:212px;top:${rect.bottom+6}px;left:auto;right:${Math.max(8,window.innerWidth-rect.right)}px;padding:6px;transform-origin:top right`;
  menu.innerHTML=entries.map(item=>`${item.sep?'<div class="menusep"></div>':''}
    <button class="menu-item ${item.danger?'danger':''}" data-list-menu-id="${esc(String(item.id))}">
      ${ic(item.icon)}<span>${esc(item.label)}</span>
    </button>`).join('');
  document.body.appendChild(menu);
  const close=()=>{
    menu.remove();
    document.removeEventListener('click',outside);
  };
  const outside=event=>{
    if(!menu.contains(event.target)&&event.target!==button) close();
  };
  menu.querySelectorAll('[data-list-menu-id]').forEach(itemButton=>itemButton.addEventListener('click',()=>{
    const item=entries.find(candidate=>String(candidate.id)===itemButton.dataset.listMenuId);
    if(item&&typeof item.run==='function') item.run();
    close();
  }));
  setTimeout(()=>document.addEventListener('click',outside),10);
}

/**
 * Registers a data-backed transaction list screen while preserving the compact
 * declarative configs used by the Sales/Purchasing modules. This is registration
 * sugar only: every route renders through transactionListPage().
 */
function registerTransactionList(config){
  const cfg=config||{};
  SCREENS[cfg.route]=async function(root){
    if(typeof cfg.prepare==='function') await cfg.prepare();
    const value=(candidate,...args)=>typeof candidate==='function'?candidate(...args):candidate;
    const sourceRows=()=> {
      const rows=value(cfg.rows);
      return Array.isArray(rows)?rows:[];
    };
    const unit=()=>{
      const raw=value(cfg.unit);
      return raw?ts(String(raw)):raw;
    };
    const truncated=()=>Boolean(
      value(cfg.truncated)
      ||(cfg.module==='sales'&&DB.salesReadMeta&&DB.salesReadMeta.truncated)
      ||(cfg.module==='purchasing'&&DB.purchasingReadMeta&&DB.purchasingReadMeta.truncated)
    );
    transactionListPage(root,{
      module:cfg.module,
      route:cfg.route,
      active:cfg.active||cfg.route,
      title:()=>value(cfg.title),
      description:()=>value(cfg.sub),
      crumb:()=>value(cfg.crumb),
      rows:sourceRows,
      rowId:cfg.rowId,
      checkable:cfg.checkable!==false,
      count:rows=>`${rows.length}${truncated()?'+':''}${unit()?` ${unit()}`:''}`,
      primaryAction:cfg.newBtn?{
        label:()=>value(cfg.newBtn.label),
        icon:cfg.newBtn.icon||'plus',
        onClick:cfg.newBtn.onClick,
        disabled:cfg.newBtn.disabled,
      }:null,
      kpis:rows=>(value(cfg.kpis,rows)||[]).map(item=>({
        label:()=>value(item.label),
        value:()=>value(item.value??item.val),
        filter:item.filter??item.f,
        negative:item.negative??item.neg,
        accent:item.accent,
      })),
      filters:(value(cfg.chips)||[]).map(item=>[
        item[0],()=>value(item[1]),
      ]),
      filterFn:cfg.filterFn,
      columns:cfg.columns,
      toolbarContent:()=>value(cfg.actions)||'',
      toolbarActions:()=>value(cfg.toolbarActions)||[],
      empty:cfg.empty,
      pagination:cfg.pagination,
      rowAction:cfg.rowAction,
      rowLabel:cfg.rowLabel,
      onOpen:cfg.onOpen,
      rowMenu:cfg.rowMenu,
      onSelectionChange:cfg.onSelectionChange,
      afterRender:context=>{
        if(typeof cfg.wire==='function') cfg.wire(root,context.allRows);
        if(typeof cfg.afterRender==='function') cfg.afterRender(context);
      },
    });
  };
}
window.registerTransactionList=registerTransactionList;

/**
 * Shared horizontal comparison bars used by Sales and Purchasing dashboards.
 * This helper originally lived in the sample BI screen even though unrelated
 * modules called it through classic-script global scope. Keeping it here makes
 * the dependency explicit and prevents replacing a module screen from breaking
 * another module at runtime.
 */
function barList(rows){
  const values=(rows||[]).map(row=>Math.abs(Number(row.value)||0));
  const maximum=Math.max(1,...values);
  return `<div class="barchart">${(rows||[]).map(row=>{
    const value=Math.abs(Number(row.value)||0);
    return `<div class="barrow"${row.route?` data-route="${esc(row.route)}" style="cursor:pointer"`:''}>
      <span class="bl">${esc(row.label)}</span>
      <span class="bartrack"><i style="width:${Math.round(value/maximum*100)}%;background:${row.clr||'var(--accent)'}"></i></span>
      <span class="bv">${esc(row.text==null?'':row.text)}</span></div>`;
  }).join('')}</div>`;
}

/**
 * Replaces the copy-pasted if(!x){toast('X is required','danger');el.focus();return}
 * pattern scattered across form-modal save handlers (TASK-044). Returns true when
 * value is truthy; otherwise shows the danger toast, focuses focusTarget (a '#id'
 * selector resolved via the global $(), or an already-resolved element -- needed
 * because some call sites focus within a modal-scoped querySelector rather than
 * the document-global one) if given, and returns false so the caller can
 * `if(!requireField(...)) return;`. Only fits presence checks -- format/pattern
 * validation (e.g. an email regex) is a different kind of check and stays inline.
 */
function requireField(value, message, focusTarget){
  if(value) return true;
  toast(message,'danger');
  if(focusTarget){
    const el=typeof focusTarget==='string'?$(focusTarget):focusTarget;
    if(el&&typeof el.focus==='function') el.focus();
  }
  return false;
}

/**
 * Formats a date/timestamp column for display AS A PLAIN ISO STRING
 * ("2026-08-19"). PGlite/Drizzle return `date`/`timestamp` columns as live
 * Date objects, not strings -- naive template-literal interpolation
 * silently renders `Date.prototype.toString()` output ("Wed Aug 19 2026
 * 08:00:00 GMT+0800 (Malaysia Time)") instead of a clean date. Replaces six
 * near-identical copies each module independently grew while converting to
 * canonical data: crmDateValue, purchasingDateValue, financeDateValue,
 * salesDateValue, projectDateValue, serviceDateValue. warehouse.js's
 * displayDate() was already correct but is folded in too for one shared
 * implementation.
 *
 * Deliberately returns a re-parseable ISO string, not a localized label --
 * several existing call sites feed the result straight back into
 * `new Date(dateValue(x)+'T00:00:00')` for due-date arithmetic (e.g.
 * salesDueDate, serviceContractStatus), which a human-readable format like
 * "Aug 19, 2026" would silently break. For a pure-display, locale-aware
 * label with no further parsing, use dateLabel() below instead. Also useful
 * directly on two Date values for a chronological sort:
 * `dateValue(a.x).localeCompare(dateValue(b.x))` sorts correctly regardless
 * of whether the source is a Date object or an ISO string, where
 * `String(a.x).localeCompare(String(b.x))` would silently sort by a Date's
 * toString() weekday name instead.
 */
function dateValue(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const text=String(value==null?'':value);
  const match=text.match(/^\d{4}-\d{2}-\d{2}/);
  if(match) return match[0];
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?text:parsed.toISOString().slice(0,10);
}

/** Timestamp counterpart of dateValue() -- replaces purchasingDateTimeValue,
 * projectDateTimeValue, serviceDateTimeValue. */
function dateTimeValue(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())) return value.toISOString().slice(0,16).replace('T',' · ');
  const text=String(value==null?'':value);
  const match=text.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  if(match) return match[0].replace('T',' · ');
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?text:parsed.toISOString().slice(0,16).replace('T',' · ');
}

/**
 * Locale-aware display label ("Aug 19, 2026" / localized equivalent) for
 * pure-display contexts (table cells, detail panels) whose result is never
 * fed back into date arithmetic -- use dateValue() instead if it is.
 * Promoted from mfg-canonical.js/qc-canonical.js's own `dateLabel()`, fixing
 * a real bug along the way: the original built `new Date(String(value)+
 * 'T00:00:00')` unconditionally, which is exactly the toString()-garbling
 * bug this whole file exists to prevent when `value` is a real Date object
 * (its `String()` form isn't a parseable date-only string) -- it "looked"
 * fixed but wasn't. This version checks `instanceof Date` first, matching
 * dateValue()'s guard, before ever stringifying.
 */
function dateLabel(value){
  const lang=typeof getLang==='function'?getLang():'en';
  const date=value instanceof Date&&!Number.isNaN(value.getTime())?value:new Date(`${dateValue(value)}T00:00:00`);
  if(Number.isNaN(date.getTime())) return String(value==null?'—':value);
  return new Intl.DateTimeFormat(lang==='zh'?'zh-CN':lang==='ms'?'ms-MY':lang==='ja'?'ja-JP':lang==='vi'?'vi-VN':'en-SG',{
    year:'numeric',month:'short',day:'numeric',
  }).format(date);
}
