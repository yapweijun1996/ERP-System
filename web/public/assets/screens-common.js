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
  let activeFilter=cfg.initialFilter||'all';

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
    const body=`<div class="sales-body transaction-list-body"
        data-layout="transaction-list-v1" data-list-route="${esc(String(cfg.route||''))}">
      ${renderKpis(source)}
      <div class="toolbar" data-list-toolbar>
        ${renderFilters()}<div class="grow"></div>
        ${note?`<small class="transaction-list-note">${esc(String(note))}</small>`:''}
        ${toolbarContent}
        ${renderToolbarActions(rows)}
      </div>
      <div class="sales-tablewrap" data-list-table>${renderTable(rows)}</div>
      ${renderPagination(rows)}
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
    render();
  }
  function wire(rows){
    const tableRoot=root.querySelector('[data-list-table]');
    if(rows.length){
      wireTable(tableRoot,{
        onRow:typeof cfg.onOpen==='function'
          ? id=>cfg.onOpen(rows.find(row=>String(cfg.rowId(row))===String(id)),id)
          : null,
        onSelectionChange:cfg.onSelectionChange,
      });
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
    if(typeof cfg.afterRender==='function') cfg.afterRender({root,rows,allRows:allRows(),activeFilter,setFilter,render});
  }
  function primaryEnabled(primary){
    return primary&&typeof primary.onClick==='function'&&!primary.disabled;
  }

  render();
  return {render,setFilter,getFilter:()=>activeFilter,rows:visibleRows};
}
window.transactionListPage=transactionListPage;

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
