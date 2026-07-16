/* ============================================================
   ERP-System API adapter — TASK-019 (seam) + TASK-026 (real render)
   + TASK-024 (session auth)

   Runs only when VITE_DATA_MODE=api (see index.html's erpDataMode()).
   Talks to the production API (TASK-011/024, src/server.ts) over HTTP
   instead of booting PGlite in the browser.

   State machine (see `state.mode`):
     'api-unavailable' — GET /health failed or didn't return JSON. app.js
                          shows the "waiting for API" screen. Nothing else
                          is tried (there is no point checking auth against
                          an unreachable server).
     'api-reachable'   — health OK, but we don't yet know if this browser
                          has a valid session (dashboard needs one — this
                          is the fix for a real chicken-and-egg bug: the
                          adapter used to try loading the dashboard before
                          knowing whether a session existed, so a genuinely
                          reachable-but-logged-out server looked identical
                          to an unreachable one). app.js's boot() calls
                          isSignedIn()/needsSetup() from here.
     'api'              — health OK AND the dashboard has been loaded for
                          an authenticated session. DB.* is populated.

   Writes for stock/money (confirmOrder/completeSetup) still reject with a
   clear "not available yet" error — no such endpoints exist server-side
   (see docs/STATUS.md). switchCompany DOES work (a read with a different
   companyFn, authorized server-side against this session's user_company
   rows) and so does the TASK-024 auth flow (login/logout/needsSetup/
   isSignedIn) — real session cookies, not a local flag.

   window.ErpSystemDemo keeps the demo (PGlite) adapter's shape plus these
   auth additions — screens and the setup wizard never need to know which
   backend is active.
   ============================================================ */
(function erpSystemApiAdapter(){
  if (typeof DB === 'undefined') return;
  if (typeof window.erpDataMode === 'function' && window.erpDataMode() !== 'api') return;

  var API_BASE = window.__ERP_API_BASE__ || '/api';
  var HEALTH_URL = API_BASE.replace(/\/api\/?$/, '') + '/health';
  var SCOPE = { companyFn: null }; // masterFn is never client-held — it comes from the session, server-side, on every request
  var state = { mode: 'api-unavailable' };

  function notAvailable(action){
    return Promise.reject(new Error(
      'Production API is not available yet (' + action + '). ' +
      'The TASK-011 API server has no write endpoints for stock/money yet — see docs/STATUS.md.'));
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

  async function jsonBody(res){
    try { return await res.json(); } catch (e) { return null; }
  }

  async function fetchDashboard(){
    var url = API_BASE + '/dashboard' + (SCOPE.companyFn ? '?companyFn=' + encodeURIComponent(SCOPE.companyFn) : '');
    var res = await fetch(url, { method: 'GET', credentials: 'same-origin' });
    if (res.status === 401) throw new Error('not_authenticated');
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
  function applyDashboard(payload, sessionUser){
    var active = activeCompany(payload);
    SCOPE.companyFn = payload.scope.companyFn;

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

    /* Real signed-in user (TASK-024) — not a hardcoded name like the demo
       adapter's "Admin". initials computed the same way buildCompanyMenu()
       computes company initials, for a consistent avatar convention. */
    var name = (sessionUser && sessionUser.fullName) || (sessionUser && sessionUser.email) || 'Signed-in user';
    var initials = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(function(w){ return w[0]; }).join('').toUpperCase() || 'U';
    DB.user = {
      name: name, email: (sessionUser && sessionUser.email) || '', initials: initials || 'U', role: 'Signed in',
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

  async function fetchSession(){
    var res = await fetch(API_BASE + '/auth/session', { method: 'GET', credentials: 'same-origin' });
    if (!res.ok) return null;
    return jsonBody(res);
  }

  async function loadDashboard(){
    var session = await fetchSession();
    if (!session) throw new Error('not_authenticated');
    var payload = await fetchDashboard();
    applyDashboard(payload, session);
    state.mode = 'api';
    return payload;
  }

  var ready = checkHealth().then(function(reachable){
    state.mode = reachable ? 'api-reachable' : 'api-unavailable';
    console.info('[erp-system-api] mode=api, backend ' + (reachable ? 'reachable' : 'unreachable') + ' at ' + API_BASE +
      (reachable ? ' — checking session next.' : ' — showing the "waiting for API" screen (see TASK-011).'));
  });

  async function refresh(){
    if (state.mode === 'api-unavailable') return null;
    return loadDashboard();
  }

  async function switchCompany(companyFn){
    if (!companyFn || companyFn === SCOPE.companyFn) return null;
    if (state.mode === 'api-unavailable') throw new Error('Production API is not available yet (switchCompany).');
    var previous = SCOPE.companyFn;
    SCOPE.companyFn = companyFn;
    try {
      return await loadDashboard();
    } catch (e) {
      SCOPE.companyFn = previous; // don't leave SCOPE pointing at a company we failed to load
      throw e;
    }
  }

  /** True if the wizard should show — asks the server whether ANY admin
   *  exists yet, so the lock is real (not per-browser localStorage, which
   *  would let every new device re-offer "first-run" setup forever). */
  async function needsSetup(){
    if (state.mode === 'api-unavailable') return false; // renderApiUnavailable() already covers this
    try {
      var res = await fetch(API_BASE + '/setup/status', { method: 'GET', credentials: 'same-origin' });
      if (!res.ok) return false;
      var body = await jsonBody(res);
      return !(body && body.hasAdmin);
    } catch (e) {
      return false;
    }
  }

  /* Confirming a session exists AND loading the dashboard are combined here so
     boot() doesn't need an api-mode-specific "now go load the data" follow-up
     step — by the time isSignedIn() resolves true, DB.* is already populated. */
  async function isSignedIn(){
    if (state.mode === 'api-unavailable') return false;
    try {
      await loadDashboard();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function login(email, password){
    var res = await fetch(API_BASE + '/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });
    if (!res.ok){
      var body = await jsonBody(res);
      var message = (body && body.message) || (res.status === 401
        ? 'Incorrect email or password.'
        : 'Sign in failed (HTTP ' + res.status + ').');
      throw new Error(message);
    }
    return jsonBody(res);
  }

  async function logout(){
    try {
      await fetch(API_BASE + '/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) { /* best-effort — reloading clears client state regardless */ }
  }

  window.ErpSystemDemo = {
    ready: ready,
    reset: function(){ return notAvailable('reset'); },
    refresh: refresh,
    confirmOrder: function(){ return notAvailable('confirmOrder'); },
    completeSetup: function(){ return notAvailable('completeSetup'); },
    switchCompany: switchCompany,
    /* TASK-024 additions — demo adapter implements the same names locally. */
    needsSetup: needsSetup,
    isSignedIn: isSignedIn,
    login: login,
    logout: logout,
    switchUser: function(){ return Promise.reject(new Error('Switching user without signing in as them is not offered in production mode — sign out and sign in as the other user instead.')); },
    get mode(){ return state.mode; },
    get db(){ return null; },
  };
  window.ErpSystemDemoReady = ready;
})();
