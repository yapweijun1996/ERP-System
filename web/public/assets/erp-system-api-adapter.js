/* ============================================================
   ERP-System API adapter — TASK-019 (EPIC-007 data-seam integrity)

   Runs only when VITE_DATA_MODE=api (see index.html's erpDataMode()).
   Talks to the production API over HTTP instead of booting PGlite in
   the browser. The API server itself (GET /health, GET /api/dashboard,
   POST /api/sales-orders/:doc/confirm, POST /api/setup/complete,
   POST /api/companies/switch) is TASK-011 — not built yet — so every
   write here rejects with a clear "not available yet" error instead
   of silently no-op'ing, and app.js shows a dedicated "waiting for
   API" screen instead of pretending to have data.

   window.ErpSystemDemo keeps the EXACT same shape as the demo (PGlite)
   adapter in erp-system-data-adapter.js — ready/reset/refresh/
   confirmOrder/completeSetup/switchCompany/mode/db — so screens and
   the setup wizard never need to know which backend is active. This
   is the contract TASK-011's server-side implementation must satisfy.
   ============================================================ */
(function erpSystemApiAdapter(){
  if (typeof DB === 'undefined') return;
  if (typeof window.erpDataMode === 'function' && window.erpDataMode() !== 'api') return;

  var API_BASE = window.__ERP_API_BASE__ || '/api';
  var HEALTH_URL = API_BASE.replace(/\/api\/?$/, '') + '/health';
  var state = { mode: 'api-unavailable' };

  function notAvailable(action){
    return Promise.reject(new Error(
      'Production API is not available yet (' + action + '). ' +
      'VITE_DATA_MODE=api requires the TASK-011 API server — see docs/STATUS.md.'));
  }

  async function checkHealth(){
    /* res.ok alone is not enough: a static host / dev-preview server's SPA
       fallback returns 200 + index.html for ANY unmatched path (including
       /health when no real API exists), which would look "reachable". Require
       an actual JSON body too. */
    try {
      var res = await fetch(HEALTH_URL, { method: 'GET' });
      if (!res || !res.ok) return false;
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('json') === -1) return false;
      await res.json();
      return true;
    } catch (e) {
      return false;
    }
  }

  var ready = checkHealth().then(function(reachable){
    state.mode = reachable ? 'api' : 'api-unavailable';
    console.info('[erp-system-api] mode=api, backend ' + (reachable ? 'reachable' : 'unreachable') +
      ' at ' + API_BASE + (reachable ? '' : ' — showing the "waiting for API" screen (see TASK-011).'));
  });

  window.ErpSystemDemo = {
    ready: ready,
    reset: function(){ return notAvailable('reset'); },
    refresh: function(){ return notAvailable('refresh'); },
    confirmOrder: function(){ return notAvailable('confirmOrder'); },
    completeSetup: function(){ return notAvailable('completeSetup'); },
    switchCompany: function(){ return notAvailable('switchCompany'); },
    get mode(){ return state.mode; },
    get db(){ return null; },
  };
  window.ErpSystemDemoReady = ready;
})();
