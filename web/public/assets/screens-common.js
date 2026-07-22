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
