/* ============================================================
   ERP-System API adapter — TASK-019 (seam) + TASK-026 (real render)

   Runs only when VITE_DATA_MODE=api (see index.html's erpDataMode()).
   Talks to the production API (TASK-011, src/server.ts) over HTTP
   instead of booting PGlite in the browser.

   On ready: health-checks GET {base}/health, then reads
   GET {base}/dashboard?masterFn=&companyFn= and maps it onto the Aria
   `DB` contract — same idea as erp-system-data-adapter.js's
   applyData(), just from a much smaller payload (the API only exposes
   dashboard-shaped reads today, no full module data yet). If EITHER
   call fails, app.js's renderApiUnavailable() shows a "waiting for
   API" screen instead of pretending to have data.

   Writes (confirmOrder/completeSetup) still reject with a clear "not
   available yet" error — there are no write endpoints server-side yet
   (see docs/STATUS.md). switchCompany DOES work: it is just a
   read with a different companyFn, no server change needed.

   window.ErpSystemDemo keeps the EXACT same shape as the demo (PGlite)
   adapter — ready/reset/refresh/confirmOrder/completeSetup/
   switchCompany/mode/db — so screens and the setup wizard never need
   to know which backend is active.
   ============================================================ */
(function erpSystemApiAdapter(){
  if (typeof DB === 'undefined') return;
  if (typeof window.erpDataMode === 'function' && window.erpDataMode() !== 'api') return;

  var API_BASE = window.__ERP_API_BASE__ || '/api';
  var HEALTH_URL = API_BASE.replace(/\/api\/?$/, '') + '/health';
  var SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };
  var state = { mode: 'api-unavailable' };

  function notAvailable(action){
    return Promise.reject(new Error(
      'Production API is not available yet (' + action + '). ' +
      'The TASK-011 API server has no write endpoints yet — see docs/STATUS.md.'));
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

  async function fetchDashboard(scope){
    var url = API_BASE + '/dashboard?masterFn=' + encodeURIComponent(scope.masterFn) +
      '&companyFn=' + encodeURIComponent(scope.companyFn);
    var res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('GET ' + url + ' -> HTTP ' + res.status);
    var payload = await res.json();
    if (!payload || !Array.isArray(payload.companies)) throw new Error('Unexpected /api/dashboard shape');
    return payload;
  }

  function activeCompany(payload){
    return payload.companies.filter(function(c){ return c.companyFn === payload.scope.companyFn; })[0]
      || payload.companies[0]
      || { name: 'Unknown company', currency: 'USD', country: '' };
  }

  /* Payload -> Aria DB contract. Deliberately minimal: only what the
     dashboard/home screen and the app shell need. Other modules
     (inventory/sales/finance) have no api-mode data source yet — that
     is real remaining scope, not silently faked here. */
  function applyDashboard(payload){
    var active = activeCompany(payload);

    DB.erpSystem = {
      source: 'ERP-System production API',
      dataMode: 'api',
      scope: payload.scope,
      companies: payload.companies,
    };

    DB.company = {
      name: active.name,
      branch: active.country === 'MY' ? 'Kuala Lumpur HQ' : active.country === 'SG' ? 'Singapore HQ' : 'HQ',
      currency: active.currency,
      taxRegime: active.taxRegime,
      period: 'Live',
      periodLabel: 'Live data',
      env: 'PRODUCTION',
    };

    /* No session/auth yet (TASK-024) — a clearly-labeled placeholder, not a
       fabricated named person, unlike the demo adapter's "Admin". */
    DB.user = {
      name: 'API User', email: '-', initials: 'AU', role: 'Viewer',
      perms: { post: false, approve: false, salaryView: false, costView: false },
    };

    var currencySymbols = { SGD: 'S$', MYR: 'RM', USD: '$' };
    money = function erpApiMoney(n, cur){
      if (n == null) return '-';
      var code = cur || DB.company.currency || 'USD';
      var symbol = currencySymbols[code] || (code + ' ');
      return symbol + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    money0 = function erpApiMoney0(n){
      var symbol = currencySymbols[DB.company.currency] || (DB.company.currency + ' ');
      return symbol + Math.round(n).toLocaleString('en-US');
    };

    /* dashboard screen does DB.approvals.length / .slice(0,5).map(...) unconditionally */
    DB.approvals = [];

    var m = payload.metrics || {};
    DB.dashboardMetrics = {
      /* not modeled server-side yet — 0 is the honest "not tracked", not a guess */
      approvals: 0, glIssues: 0, openDeliveries: 0, goodsReceipts: 0,
      pickTasks: 0, leaveRequests: 0, cash: 0, cleared: 0,
      /* real, from GET /api/dashboard */
      stockAlerts: m.stockAlertCount || 0,
      arOpen: m.arOpen || 0,
      openOrderValue: m.openOrderValue || 0,
      mtdSales: m.mtdRevenue || 0,
    };

    document.title = 'ERP System - ' + active.name;
  }

  async function loadDashboard(scope){
    var payload = await fetchDashboard(scope);
    applyDashboard(payload);
    return payload;
  }

  var ready = checkHealth().then(async function(reachable){
    if (!reachable){
      state.mode = 'api-unavailable';
      console.info('[erp-system-api] mode=api, backend unreachable at ' + API_BASE +
        ' — showing the "waiting for API" screen (see TASK-011).');
      return;
    }
    try {
      await loadDashboard(SCOPE);
      state.mode = 'api';
      console.info('[erp-system-api] mode=api, backend reachable at ' + API_BASE + ' — dashboard loaded.');
    } catch (e) {
      state.mode = 'api-unavailable';
      console.warn('[erp-system-api] health OK but GET /api/dashboard failed — showing the "waiting for API" screen.', e && e.message ? e.message : e);
    }
  });

  async function refresh(){
    if (state.mode !== 'api') return null;
    return loadDashboard(SCOPE);
  }

  async function switchCompany(companyFn){
    if (!companyFn || companyFn === SCOPE.companyFn) return null;
    if (state.mode !== 'api') throw new Error('Production API is not available yet (switchCompany).');
    SCOPE.companyFn = companyFn;
    return loadDashboard(SCOPE);
  }

  window.ErpSystemDemo = {
    ready: ready,
    reset: function(){ return notAvailable('reset'); },
    refresh: refresh,
    confirmOrder: function(){ return notAvailable('confirmOrder'); },
    completeSetup: function(){ return notAvailable('completeSetup'); },
    switchCompany: switchCompany,
    get mode(){ return state.mode; },
    get db(){ return null; },
  };
  window.ErpSystemDemoReady = ready;
})();
