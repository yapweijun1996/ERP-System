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
  const status=cfg.status&&cfg.status.label
    ? cap(String(cfg.status.label),cfg.status.tone||'neutral')
    : '';
  const hasOverview=Boolean(overview.title||overview.code||overview.meta||facts.length);
  const overviewHtml=hasOverview?`
    <div class="master-detail-editor-identity">
      <div>
        <h2>${esc(String(overview.title||''))}</h2>
        ${overview.code?`<span class="master-detail-editor-code">${esc(String(overview.code))}</span>`:''}
      </div>
      ${overview.meta?`<p>${esc(String(overview.meta))}</p>`:''}
    </div>
    <div class="master-detail-editor-facts">
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
    action:status,
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
  const hasOverview=Boolean(identity.title||identity.code||identity.meta||identity.related||statuses.length||facts.length);
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
    <div class="case-detail-facts">
      ${facts.map(fact=>`<div class="case-detail-fact">
        <small>${esc(String(fact.label||''))}</small>
        <b class="${fact.numeric?'tnum':''}">${esc(String(fact.value??'—'))}</b>
      </div>`).join('')}
    </div>`:'';
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
 * Page-level SSOT for immutable balanced accounting postings.
 *
 * The shell owns posting identity, status, facts, main/context placement,
 * responsive actions and standard empty/error states. Finance screens provide
 * only the journal-specific line, audit and action content.
 */
function postingDetailPage(root, config){
  if(!root) throw new Error('postingDetailPage requires a render root.');
  const cfg=config||{};
  const identity=cfg.identity||{};
  const facts=Array.isArray(cfg.facts)?cfg.facts:[];
  const actions=Array.isArray(cfg.actions)?cfg.actions:[];
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
  const errorHtml=error?`${ic('warn')}<div><b>${esc(String(error.title||'Posting unavailable'))}</b>
      ${error.description?`<span>${esc(String(error.description))}</span>`:''}</div>
      ${typeof error.onRetry==='function'?btn(String(error.retryLabel||'Retry'),{icon:'refresh',cls:'soft',attrs:'data-posting-retry'}):''}`:'';
  const emptyHtml=empty?`<div class="statepanel empty posting-detail-empty" data-posting-empty>
      ${ic(empty.icon||'book')}<h3>${esc(String(empty.title||'No posting available'))}</h3>
      ${empty.description?`<p>${esc(String(empty.description))}</p>`:''}
    </div>`:'';
  const body=`<section class="posting-detail"
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
    body,
  });
  const postingRoot=root.querySelector('[data-layout="posting-detail-v1"]');
  actions.forEach((action,index)=>{
    postingRoot?.querySelector(`[data-posting-action="${index}"]`)?.addEventListener('click',event=>{
      if(typeof action.onClick==='function'&&!action.disabled) action.onClick(event);
    });
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
  let activeFilter=cfg.initialFilter||'all';
  let selectedId=null;

  function allRows(){
    const rows=value(cfg.rows);
    return Array.isArray(rows)?rows:[];
  }
  function visibleRows(){
    const rows=allRows();
    if(activeFilter==='all'||typeof cfg.filterFn!=='function') return rows;
    return rows.filter(row=>cfg.filterFn(row,activeFilter));
  }
  function renderKpis(rows){
    const items=value(cfg.kpis,rows)||[];
    if(!items.length) return '<div class="so-kpibar" data-list-kpis hidden></div>';
    return `<div class="so-kpibar" data-list-kpis>${items.map(item=>{
      const filter=value(item.filter,item,rows);
      const clickable=filter!=null;
      const classes=[
        'so-kpi',clickable?'clickable':'',filter===activeFilter?'active':'',
        item.negative?'neg':'',item.accent?'accent':'',
      ].filter(Boolean).join(' ');
      return `<button class="${classes}" ${clickable?`data-list-kpi-filter="${esc(String(filter))}"`:'disabled'}>
        <small>${esc(String(value(item.label,item,rows)||''))}</small>
        <b class="tnum">${esc(String(value(item.value,item,rows)??''))}</b>
      </button>`;
    }).join('')}</div>`;
  }
  function renderFilters(){
    const chips=value(cfg.filters)||[];
    if(!chips.length) return '<div class="filterchips" data-list-filters hidden></div>';
    return `<div class="filterchips" data-list-filters>${chips.map(item=>{
      const key=Array.isArray(item)?item[0]:item.key;
      const label=Array.isArray(item)?item[1]:item.label;
      return `<button class="chip ${key===activeFilter?'on':''}" data-list-filter="${esc(String(key))}">
        ${esc(String(value(label,item)||''))}
      </button>`;
    }).join('')}</div>`;
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
    const empty=cfg.empty||{};
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
        ${renderFilters()}<div class="grow"></div>
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
    if(selectedId!=null&&!selectedRow(visibleRows())) selectedId=null;
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
        onRow:detailPane
          ? id=>select(id)
          : (typeof cfg.onOpen==='function'
            ? id=>cfg.onOpen(rows.find(row=>String(cfg.rowId(row))===String(id)),id)
            : null),
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
    rows:visibleRows,
    select,
    getSelected:()=>selectedRow(),
  };
}
window.transactionListPage=transactionListPage;

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
    const unit=()=>value(cfg.unit);
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
