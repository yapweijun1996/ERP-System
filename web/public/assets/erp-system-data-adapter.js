/* ============================================================
   ERP-System data adapter — Phase 2 (TASK-002)

   Boots the CANONICAL demo database in PGlite (in-browser
   PostgreSQL, persisted to IndexedDB at idb://erp-system-demo):

     web/public/db/erp-system-schema.sql   (copy of drizzle/0000_init.sql)
     web/public/db/erp-system-seed.sql     (SQL form of src/data/seed.ts)
     web/public/db/erp-system-demo-txn.sql (SQL form of the src/demo.ts
                                            confirmed-order chain)

   then READS the data back with async SQL and maps it into the
   user-owned Aria ERP `DB` contract. The numbers on screen come
   from the database, not from literals in this file.

   Fallback: if PGlite (CDN WASM) cannot load — e.g. offline —
   a static payload with the SAME canonical values keeps the demo
   rendering. `DB.erpSystem.dataMode` records which path ran.

   app.js defers boot until `window.ErpSystemDemoReady` resolves.
   `window.ErpSystemDemo.reset()` drops the schema and reloads,
   which reseeds the canonical sample data on next boot.

   TASK-019: this file only runs in 'demo' data mode. In 'api' mode
   (VITE_DATA_MODE=api) it self-disables and erp-system-api-adapter.js
   sets window.ErpSystemDemo instead — see index.html's erpDataMode().
   ============================================================ */
(function erpSystemDataAdapter(){
  if (typeof DB === 'undefined') return;
  if (typeof window.erpDataMode === 'function' && window.erpDataMode() !== 'demo') return;

  var PGLITE_URL = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js';
  var PG_DATA_DIR = 'idb://erp-system-demo';
  var PG_IDB_NAME = '/pglite/erp-system-demo';
  var BOOT_TIMEOUT_MS = 20000;

  /* Same PBKDF2-HMAC-SHA256 scheme and "pbkdf2$<iterations>$<saltHex>$<hashHex>"
     format as src/auth/password.ts (TASK-024), via the browser's native Web
     Crypto API — no dependency needed. This is what completeSetup() uses to
     store a REAL password hash for a wizard-created admin, matching the
     schema's password_hash NOT NULL constraint. The demo login form still does
     not verify passwords (see screens-ops.js / renderLogin) — this hash exists
     so the demo's data shape matches production's, not to gate demo access. */
  async function hashPasswordBrowser(password){
    var PBKDF2_ITERATIONS = 100000;
    var enc = new TextEncoder();
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial, 32 * 8);
    function toHex(bytes){
      return Array.prototype.map.call(bytes, function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    return 'pbkdf2$' + PBKDF2_ITERATIONS + '$' + toHex(salt) + '$' + toHex(new Uint8Array(bits));
  }
  var SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };

  /* db/*.sql lives next to assets/ — resolve relative to this script so the
     GitHub Pages base path (/<repo>/) needs no configuration. */
  var DB_BASE = (function(){
    try { return new URL('../db/', document.currentScript.src).href; }
    catch (e) { return 'db/'; }
  })();

  var state = { db: null, mode: 'pending' };

  /* ---------------- PGlite boot ---------------- */

  function fetchSql(name){
    return fetch(DB_BASE + name).then(function(r){
      if (!r.ok) throw new Error('fetch ' + name + ' -> HTTP ' + r.status);
      return r.text();
    });
  }

  async function ensureSeeded(db){
    var t = await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name='master'");
    var seeded = false;
    if (t.rows[0].n > 0) {
      var m = await db.query('select count(*)::int as n from master');
      seeded = m.rows[0].n > 0;
    }
    if (!seeded) {
      var schema = await fetchSql('erp-system-schema.sql');
      var seed = await fetchSql('erp-system-seed.sql');
      var txn = await fetchSql('erp-system-demo-txn.sql');
      await db.exec(schema);
      await db.exec(seed);
      await db.exec(txn);
    }
    /* top-up: demo draft orders (idempotent — skips existing doc_no's), so
       databases seeded before TASK-007 gain the Confirm-flow drafts too */
    var drafts = await db.query(
      "select count(*)::int as n from sales_order " +
      "where master_fn='M1' and company_fn='C-SG' and doc_no in ('SO-2','SO-3')");
    if (drafts.rows[0].n < 2) await db.exec(await fetchSql('erp-system-demo-drafts.sql'));
    return !seeded;
  }

  /* Read everything the Aria screens need, tenant-scoped, numbers cast in SQL. */
  async function readPayload(db){
    async function rows(sql){ return (await db.query(sql)).rows; }
    /* alias-qualified tenant scope, safe inside joins */
    function w(a){ return a + ".master_fn='" + SCOPE.masterFn + "'"; }
    function wc(a){ return w(a) + " and " + a + ".company_fn='" + SCOPE.companyFn + "'"; }

    var master = (await rows("select master_fn, name from master order by master_fn limit 1"))[0];
    var companies = await rows(
      "select company_fn, master_fn, name, country, currency, tax_regime, locale " +
      "from company where " + w('company') + " order by company_fn");
    /* TASK-024: real seeded users (password_hash never selected — it never needs
       to leave the server, and the demo login form doesn't check it anyway,
       matching "auto-login a labeled demo user"). */
    var users = await rows(
      "select u.user_id, u.email, u.full_name, u.language, " +
      "coalesce(bool_or(r.is_superadmin), false) as is_superadmin " +
      "from app_user u left join user_company uc on uc.user_id = u.user_id " +
      "left join role r on r.role_id = uc.role_id " +
      "where " + w('u') + " and u.is_active " +
      "group by u.user_id, u.email, u.full_name, u.language order by u.user_id");
    var products = await rows(
      "select p.id, p.company_fn, p.sku, p.name, p.uom, coalesce(sum(s.qty),0)::float as on_hand " +
      "from product p left join stock_level s on s.product_id = p.id " +
      "where " + w('p') + " group by p.id, p.company_fn, p.sku, p.name, p.uom order by p.id");
    var customers = await rows(
      "select c.id, c.code, c.name, coalesce(sum(case when i.status='unpaid' then i.total_amount end),0)::float as balance " +
      "from customer c left join invoice i on i.customer_id = c.id " +
      "where " + wc('c') + " group by c.id, c.code, c.name order by c.id");
    var accounts = await rows(
      "select a.id, a.code, a.name, a.type, coalesce(sum(g.debit),0)::float as debit, " +
      "coalesce(sum(g.credit),0)::float as credit " +
      "from account a left join gl_entry g on g.account_id = a.id " +
      "where " + wc('a') + " group by a.id, a.code, a.name, a.type order by a.code");
    var taxRules = await rows(
      "select company_fn, tax_regime, tax_code, rate::float as rate, valid_from::text as valid_from, " +
      "valid_to::text as valid_to from tax_rule where " + w('tax_rule') + " order by company_fn, tax_code, valid_from");
    var orders = await rows(
      "select o.id, o.doc_no, o.status, o.order_date::text as order_date, o.currency, " +
      "o.net_amount::float as net, o.tax_amount::float as tax, o.total_amount::float as total, " +
      "c.name as customer, c.code as customer_code, " +
      "(select count(*)::int from sales_order_line l where l.order_id = o.id) as line_count " +
      "from sales_order o join customer c on c.id = o.customer_id " +
      "where " + wc('o') + " order by o.id");
    var orderLines = await rows(
      "select l.order_id, l.line_no, p.sku, p.name, p.uom, l.qty::float as qty, " +
      "l.unit_price::float as unit_price, l.net_amount::float as net, " +
      "l.tax_rate::float as tax_rate, l.tax_amount::float as tax, " +
      "coalesce((select sum(s.qty) from stock_level s where s.product_id = p.id),0)::float as avail " +
      "from sales_order_line l join product p on p.id = l.product_id " +
      "where " + wc('l') + " order by l.order_id, l.line_no");
    var invoices = await rows(
      "select i.doc_no, i.status, i.invoice_date::text as invoice_date, i.currency, " +
      "i.net_amount::float as net, i.tax_amount::float as tax, i.total_amount::float as total, " +
      "c.name as customer, c.code as customer_code, o.doc_no as order_no " +
      "from invoice i join customer c on c.id = i.customer_id " +
      "join sales_order o on o.id = i.order_id where " + wc('i') + " order by i.id");
    var glLegs = await rows(
      "select g.journal_ref, a.code, a.name, g.debit::float as debit, g.credit::float as credit, g.memo " +
      "from gl_entry g join account a on a.id = g.account_id " +
      "where " + wc('g') + " order by g.id");
    var movements = await rows(
      "select m.id, m.qty::float as qty, m.direction, m.ref_type, m.ref_id, m.moved_at::text as moved_at, " +
      "p.sku, p.name, w.code as warehouse " +
      "from stock_movement m join product p on p.id = m.product_id " +
      "join warehouse w on w.id = m.warehouse_id where " + wc('m') + " order by m.id");

    return { master: master, companies: companies, users: users, products: products, customers: customers,
             accounts: accounts, taxRules: taxRules, orders: orders, orderLines: orderLines,
             invoices: invoices, glLegs: glLegs, movements: movements };
  }

  /* ---------------- static fallback (same canonical values) ---------------- */

  function fallbackPayload(){
    var lines = [
      { order_id: 1, line_no: 1, sku: 'SG-WIDGET', name: 'Widget (SG)', uom: 'unit', qty: 5, unit_price: 10, net: 50, tax_rate: 9, tax: 4.5, avail: 95 },
      { order_id: 1, line_no: 2, sku: 'SG-GADGET', name: 'Gadget (SG)', uom: 'box', qty: 3, unit_price: 20, net: 60, tax_rate: 9, tax: 5.4, avail: 97 },
    ];
    return {
      master: { master_fn: 'M1', name: 'Acme Group' },
      companies: [
        { company_fn: 'C-SG', master_fn: 'M1', name: 'Acme Singapore', country: 'SG', currency: 'SGD', tax_regime: 'GST', locale: 'en' },
        { company_fn: 'C-MY', master_fn: 'M1', name: 'Acme Malaysia', country: 'MY', currency: 'MYR', tax_regime: 'SST', locale: 'ms' },
      ],
      users: [
        { user_id: 1, email: 'admin@acme.co', full_name: 'Admin', language: 'zh', is_superadmin: true },
        { user_id: 2, email: 'viewer@acme.co', full_name: 'Demo Viewer', language: 'en', is_superadmin: false },
      ],
      products: [
        { id: 1, company_fn: 'C-SG', sku: 'SG-WIDGET', name: 'Widget (SG)', uom: 'unit', on_hand: 95 },
        { id: 2, company_fn: 'C-SG', sku: 'SG-GADGET', name: 'Gadget (SG)', uom: 'box', on_hand: 97 },
        { id: 3, company_fn: 'C-MY', sku: 'MY-WIDGET', name: 'Widget (MY)', uom: 'unit', on_hand: 0 },
      ],
      customers: [{ id: 1, code: 'CUST1', name: 'Beta Pte Ltd', balance: 119.9 }],
      accounts: [
        { id: 1, code: '1100', name: 'Accounts Receivable', type: 'asset', debit: 119.9, credit: 0 },
        { id: 3, code: '2200', name: 'GST Output Tax', type: 'liability', debit: 0, credit: 9.9 },
        { id: 2, code: '4000', name: 'Revenue', type: 'income', debit: 0, credit: 110 },
      ],
      taxRules: [
        { company_fn: 'C-MY', tax_regime: 'SST', tax_code: 'SV', rate: 8, valid_from: '2025-07-01', valid_to: null },
        { company_fn: 'C-SG', tax_regime: 'GST', tax_code: 'SR', rate: 8, valid_from: '2023-01-01', valid_to: '2024-01-01' },
        { company_fn: 'C-SG', tax_regime: 'GST', tax_code: 'SR', rate: 9, valid_from: '2024-01-01', valid_to: null },
      ],
      orders: [{ id: 1, doc_no: 'SO-1', status: 'confirmed', order_date: '2024-06-01', currency: 'SGD',
                 net: 110, tax: 9.9, total: 119.9, customer: 'Beta Pte Ltd', customer_code: 'CUST1', line_count: 2 }],
      orderLines: lines,
      invoices: [{ doc_no: 'INV-SO-1', status: 'unpaid', invoice_date: '2024-06-01', currency: 'SGD',
                   net: 110, tax: 9.9, total: 119.9, customer: 'Beta Pte Ltd', customer_code: 'CUST1', order_no: 'SO-1' }],
      glLegs: [
        { journal_ref: 'INV-SO-1', code: '1100', name: 'Accounts Receivable', debit: 119.9, credit: 0, memo: 'AR' },
        { journal_ref: 'INV-SO-1', code: '4000', name: 'Revenue', debit: 0, credit: 110, memo: 'Revenue' },
        { journal_ref: 'INV-SO-1', code: '2200', name: 'GST Output Tax', debit: 0, credit: 9.9, memo: 'Output tax' },
      ],
      movements: [
        { id: 1, qty: 5, direction: 'out', ref_type: 'sales_order', ref_id: 1, moved_at: '2024-06-01 09:00', sku: 'SG-WIDGET', name: 'Widget (SG)', warehouse: 'WH-SALES' },
        { id: 2, qty: 3, direction: 'out', ref_type: 'sales_order', ref_id: 1, moved_at: '2024-06-01 09:00', sku: 'SG-GADGET', name: 'Gadget (SG)', warehouse: 'WH-SALES' },
      ],
    };
  }

  /* ---------------- payload → Aria DB mapping ---------------- */

  function applyData(d, mode){
    state.mode = mode;
    var activeCompany = d.companies.filter(function(c){ return c.company_fn === SCOPE.companyFn; })[0] || d.companies[0];
    /* fallback keeps applyData() safe for a freshly wizard-created company that
       has no customers yet — every beta.* use below is a display string, never
       a query key, so a stub is enough (no crash on an empty company). */
    var beta = d.customers[0] || { id: null, code: '—', name: 'No customers yet', balance: 0 };
    var confirmed = d.orders.filter(function(o){ return o.status === 'confirmed'; });
    var so = confirmed[0] || d.orders[0];
    var inv = d.invoices[0];
    var soLines = so ? d.orderLines.filter(function(l){ return l.order_id === so.id; }) : [];
    var orderNet = so ? so.net : 0;
    var orderTax = so ? so.tax : 0;
    var orderTotal = so ? so.total : 0;

    DB.erpSystem = {
      source: 'ERP-System canonical demo seed',
      schema: 'src/data/schema (drizzle/0000_init.sql)',
      seed: 'web/public/db/erp-system-seed.sql (mirrors src/data/seed.ts)',
      transactionProof: 'web/public/db/erp-system-demo-txn.sql (mirrors src/demo.ts)',
      dataMode: mode,                          // 'pglite' | 'fallback'
      scope: SCOPE,
      master: d.master,
      companies: d.companies,
      users: d.users,
      products: d.products,
      customers: d.customers,
      accounts: d.accounts,
      taxRules: d.taxRules,
    };

    DB.company = {
      name: activeCompany.name,
      branch: activeCompany.country === 'MY' ? 'Kuala Lumpur HQ' : 'Singapore HQ',
      currency: activeCompany.currency,
      taxRegime: activeCompany.tax_regime,
      period: 'FY2026 · P06',
      periodLabel: 'June 2026',
      env: 'DEMO',
    };

    /* TASK-024: real seeded user (was hardcoded "Admin" before), with a
       browser-persisted "switch demo user" selection. Defaults to whichever
       seeded user is Superadmin, preserving the pre-TASK-024 default
       experience for anyone who never switches. */
    var activeUserEmail = null;
    try { activeUserEmail = localStorage.getItem('aria-active-user-email'); } catch (e) {}
    var activeUser = (d.users || []).filter(function(u){ return u.email === activeUserEmail; })[0]
      || (d.users || []).filter(function(u){ return u.is_superadmin; })[0]
      || (d.users || [])[0]
      || { email: 'admin@acme.co', full_name: 'Admin', is_superadmin: true };
    var userDisplayName = activeUser.full_name || activeUser.email;
    DB.user = {
      name: userDisplayName,
      email: activeUser.email,
      initials: (userDisplayName.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2)
        .map(function(w){ return w[0]; }).join('').toUpperCase()) || 'U',
      role: activeUser.is_superadmin ? 'Superadmin' : 'Viewer',
      perms: { post: !!activeUser.is_superadmin, approve: !!activeUser.is_superadmin, salaryView: false, costView: !!activeUser.is_superadmin },
    };
    var currencySymbols = { SGD: 'S$', MYR: 'RM', USD: '$' };
    money = function erpSystemMoney(n, cur){
      if (n == null) return '-';
      var code = cur || DB.company.currency || 'SGD';
      var symbol = currencySymbols[code] || (code + ' ');
      return symbol + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    money0 = function erpSystemMoney0(n){
      var symbol = currencySymbols[DB.company.currency] || (DB.company.currency + ' ');
      return symbol + Math.round(n).toLocaleString('en-US');
    };

    /* presentational-only defaults the canonical schema does not model yet */
    var display = {
      'SG-WIDGET': { reorder: 20, roq: 100, cost: 6.5, price: 10, bin: 'SG-A-01' },
      'SG-GADGET': { reorder: 20, roq: 100, cost: 13, price: 20, bin: 'SG-A-02' },
    };

    DB.items = d.products
      .filter(function(p){ return p.company_fn === SCOPE.companyFn; })
      .map(function(p){
        var x = display[p.sku] || { reorder: 0, roq: 0, cost: 0, price: 0, bin: 'SG-A-00' };
        return {
          sku: p.sku, name: p.name, cat: 'Finished Goods', uom: p.uom,
          onHand: p.on_hand, alloc: 0, reorder: x.reorder, roq: x.roq, cost: x.cost,
          status: p.on_hand <= x.reorder ? 'Reorder' : 'In stock',
          bins: [[x.bin, p.on_hand]],
        };
      });
    DB.customers = d.customers.map(function(c){
      return { code: c.code, name: c.name, terms: 'Net 30', limit: 50000,
               balance: c.balance, overdue: 0, status: 'Active' };
    });
    /* TASK-018: the new-quotation screen's Owner dropdown (screens-quotation-crud.js)
       reads DB.salesReps — was sales-data.js's static prototype roster
       (J. Okafor/L. Tan/M. Silva/Dana Reyes), never overridden here. Use the
       real seeded users instead so the dropdown matches who can actually sign in. */
    DB.salesReps = (d.users || []).map(function(u){ return u.full_name || u.email; }).filter(Boolean);
    if (!DB.salesReps.length) DB.salesReps = [DB.user.name];

    function linesFor(orderId){
      return d.orderLines.filter(function(l){ return l.order_id === orderId; }).map(function(l){
        return { item: l.sku, name: l.name, qty: l.qty, uom: l.uom, price: l.unit_price, disc: 0, avail: l.avail };
      });
    }
    var uiLines = so ? linesFor(so.id) : [];

    DB.soNow = '2026-06-28';
    DB.salesOrders = d.orders.map(function(o){
      return { no: o.doc_no, cust: o.customer, custCode: o.customer_code, date: o.order_date,
               deliver: o.order_date === '2024-06-01' ? '2024-06-03' : o.order_date,
               status: o.status === 'confirmed' ? 'Closed' : 'Draft',
               total: o.total, currency: o.currency, owner: 'Admin',
               items: o.line_count, done: o.status === 'confirmed' ? o.line_count : 0,
               posted: o.status === 'confirmed', payStatus: o.status === 'confirmed' ? 'Unpaid' : '-' };
    });

    var demoAddr = {
      billTo: { name: beta.name, line1: 'Singapore demo billing address', line2: '', city: 'Singapore', state: '', post: '000000', country: 'Singapore', contact: 'Accounts Payable', email: 'ap@beta.example', tax: 'GST demo' },
      shipTo: { name: beta.name, line1: 'Singapore demo warehouse', line2: '', city: 'Singapore', state: '', post: '000000', country: 'Singapore', contact: 'Goods Inwards', email: 'receiving@beta.example' },
    };
    /* one detail document per order, keyed by doc no — the sales-order screen
       renders these; Confirm runs against drafts via ErpSystemDemo.confirmOrder */
    DB.salesOrderDocs = {};
    d.orders.forEach(function(o){
      var isDraft = o.status !== 'confirmed';
      var ls = linesFor(o.id);
      var firstLine = d.orderLines.filter(function(l){ return l.order_id === o.id; })[0];
      var ratePct = firstLine ? firstLine.tax_rate : 9;
      DB.salesOrderDocs[o.doc_no] = {
        no: o.doc_no, cust: DB.customers[0], date: o.order_date,
        deliver: o.order_date === '2024-06-01' ? '2024-06-03' : o.order_date,
        ref: isDraft ? 'Demo draft order' : 'Canonical demo transaction',
        status: isDraft ? 'Draft' : 'Closed', owner: 'Admin', warehouse: 'WH-SALES',
        currency: o.currency, rate: 1, terms: 'Net 30', lines: ls, discountPct: 0, shipping: 0,
        taxRate: ratePct / 100,
        billTo: demoAddr.billTo, shipTo: demoAddr.shipTo,
        note: isDraft
          ? 'Draft order — Confirm runs the canonical cross-module transaction: stock issue, invoice and GL post atomically (or roll back together).'
          : 'Confirmed by ERP-System demo transaction: stock, invoice and GL are committed atomically.',
        memo: 'Net ' + money(o.net) + ' + ' + ratePct + '% ' + activeCompany.tax_regime + ' ' + money(o.tax) + ' = ' + money(o.total) + '.',
      };
    });
    DB.so0418 = so ? DB.salesOrderDocs[so.doc_no] : null;
    DB.quote0188 = so ? {
      no: 'Q-1', cust: beta.name, code: beta.code, owner: 'Admin',
      date: 'Jun 1, 2024', valid: 'Jun 15, 2024', status: 'Converted', terms: 'Net 30',
      currency: so.currency, taxRate: soLines.length ? soLines[0].tax_rate / 100 : 0.09, shipping: 0,
      contact: { name: 'Accounts Payable', role: 'Finance', email: 'ap@beta.example' },
      lines: uiLines,
    } : null;
    DB.delivery0204 = so ? {
      no: 'DO-1', so: so.doc_no, cust: beta.name, code: beta.code,
      date: 'Jun 2, 2024', warehouse: 'WH-SALES', carrier: 'Demo delivery', tracking: 'DEMO-DO-1',
      weight: '-', packages: 1, status: 'Delivered', eta: 'Jun 3, 2024', picker: 'Admin',
      lines: uiLines.map(function(l){ return { item: l.item, name: l.name, ordered: l.qty, delivered: l.qty, uom: l.uom }; }),
    } : null;
    function addDays(iso, n){
      var t = new Date(iso + 'T00:00:00Z');
      t.setUTCDate(t.getUTCDate() + n);
      return t.toISOString().slice(0, 10);
    }
    /* one invoice document per generated invoice, keyed by doc no */
    DB.salesInvoiceDocs = {};
    d.invoices.forEach(function(i){
      var ord = d.orders.filter(function(o){ return o.doc_no === i.order_no; })[0];
      var fl = ord ? d.orderLines.filter(function(l){ return l.order_id === ord.id; })[0] : null;
      DB.salesInvoiceDocs[i.doc_no] = {
        no: i.doc_no, so: i.order_no, do: i.order_no === 'SO-1' ? 'DO-1' : '—',
        cust: i.customer, code: i.customer_code,
        date: i.invoice_date, due: addDays(i.invoice_date, 30), terms: 'Net 30', currency: i.currency,
        taxRate: (fl ? fl.tax_rate : 9) / 100, shipping: 0,
        status: 'Posted', paid: 0, owner: 'Admin', custBalance: beta.balance, custLimit: 50000,
        lines: ord ? linesFor(ord.id) : [],
      };
    });
    DB.invoice0331 = inv ? DB.salesInvoiceDocs[inv.doc_no] : null;
    DB.quotations = so ? [
      { no: 'Q-1', date: so.order_date, cust: beta.name, custCode: beta.code, valid: '2024-06-15',
        owner: 'Admin', total: orderTotal, prob: 100, status: 'Converted', doc: true },
    ] : [];
    DB.deliveries = so ? [
      { no: 'DO-1', date: '2024-06-02', cust: beta.name, custCode: beta.code, so: so.doc_no,
        warehouse: 'WH-SALES', carrier: 'Demo delivery', items: uiLines.length, done: uiLines.length,
        status: 'Delivered', doc: true },
    ] : [];
    DB.salesInvoices = d.invoices.map(function(i){
      return { no: i.doc_no, date: i.invoice_date, due: addDays(i.invoice_date, 30), cust: i.customer,
               custCode: i.customer_code, so: i.order_no, total: i.total, paid: 0,
               status: 'Posted', doc: true };
    });
    DB.enquiries = [
      { no: 'ENQ-1', date: '2026-06-28', cust: beta.name, custCode: beta.code,
        subject: 'Demo reorder enquiry', channel: 'Demo', owner: 'Admin', value: orderNet, status: 'New' },
    ];

    /* movements: reconstruct running balance per SKU backwards from current on-hand */
    var onHandBySku = {};
    d.products.forEach(function(p){ onHandBySku[p.sku] = p.on_hand; });
    var delta = {};
    d.movements.forEach(function(m){
      delta[m.sku] = (delta[m.sku] || 0) + (m.direction === 'out' ? m.qty : -m.qty);
    });
    var running = {};
    Object.keys(delta).forEach(function(sku){ running[sku] = (onHandBySku[sku] || 0) + delta[sku]; });
    DB.movements = d.movements.map(function(m, i){
      running[m.sku] += (m.direction === 'out' ? -m.qty : m.qty);
      return {
        no: 'SM-' + (m.ref_type === 'sales_order' ? 'SO-' + m.ref_id + '-' + (i + 1) : m.id),
        date: String(m.moved_at).slice(0, 16).replace('T', ' '),
        item: m.sku, name: m.name,
        type: m.direction === 'out' ? 'Goods Issue' : 'Goods Receipt',
        ref: m.ref_type === 'sales_order' && so ? so.doc_no : (m.ref_type || '-'),
        qty: m.direction === 'out' ? -m.qty : m.qty,
        bal: running[m.sku], by: 'System', wh: m.warehouse,
      };
    });
    DB.valuation = [
      { cat: 'Finished Goods', items: DB.items.map(function(it){ return { sku: it.sku, name: it.name, qty: it.onHand, cost: it.cost }; }) },
    ];

    /* GL from gl_entry / account aggregates */
    var typeGroup = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses' };
    var groups = {};
    d.accounts.forEach(function(a){
      var g = typeGroup[a.type] || a.type;
      (groups[g] = groups[g] || []).push({
        code: a.code, name: a.name,
        mvt: Math.max(a.debit, a.credit), bal: Math.abs(a.debit - a.credit),
        dc: a.debit >= a.credit ? 'Dr' : 'Cr',
      });
    });
    DB.coa = Object.keys(groups).map(function(g){ return { grp: g, accts: groups[g] }; });

    var journalRefs = [];
    d.glLegs.forEach(function(l){ if (journalRefs.indexOf(l.journal_ref) < 0) journalRefs.push(l.journal_ref); });
    function journalDate(ref){
      var i = d.invoices.filter(function(x){ return x.doc_no === ref; })[0];
      return i ? i.invoice_date : (so ? so.order_date : '');
    }
    DB.journals = journalRefs.map(function(ref){
      var legs = d.glLegs.filter(function(l){ return l.journal_ref === ref; });
      var dr = legs.reduce(function(s, l){ return s + l.debit; }, 0);
      return { no: ref, date: journalDate(ref), memo: 'Post sales invoice ' + ref.replace(/^INV-/, ''),
               status: 'Posted', dr: Math.round(dr * 100) / 100, period: 'P06', by: 'System' };
    });
    /* one journal document per posting, keyed by journal ref */
    DB.journalDocs = {};
    journalRefs.forEach(function(ref){
      DB.journalDocs[ref] = {
        no: ref, date: journalDate(ref), memo: 'Post sales invoice ' + ref.replace(/^INV-/, ''),
        period: 'P06', status: 'Posted', by: 'System', source: 'Sales confirmation',
        lines: d.glLegs.filter(function(l){ return l.journal_ref === ref; }).map(function(l){
          return { acct: l.code, name: l.name, dr: l.debit, cr: l.credit,
                   dim: l.memo === 'AR' ? beta.name : (l.memo === 'Revenue' ? 'Sales' : 'GST') };
        }),
      };
    });
    DB.je0611 = journalRefs.length ? DB.journalDocs[journalRefs[0]] : null;
    /* one ledger document per account that has postings, keyed by account code */
    DB.acctLedgerDocs = {};
    d.accounts.forEach(function(a){
      var legs = d.glLegs.filter(function(l){ return l.code === a.code; });
      if (!legs.length) return;
      DB.acctLedgerDocs[a.code] = {
        code: a.code, name: a.name, period: 'FY2026 · P06', open: 0,
        close: Math.round((a.debit - a.credit) * 100) / 100,
        rows: legs.map(function(l){
          return { date: journalDate(l.journal_ref), je: l.journal_ref,
                   memo: l.memo === 'AR' ? 'Invoice ' + beta.name : l.memo, dr: l.debit, cr: l.credit };
        }),
      };
    });
    DB.acctLedger = DB.acctLedgerDocs['1100'] || null;
    DB.bankRec = {
      account: 'Demo operating account', period: 'June 2026', stmtClose: 842000, bookClose: 842000,
      lines: [{ date: 'Jun 01', desc: 'Opening demo balance', amount: 842000, je: 'OPENING', matched: true }],
    };
    var revAcct = d.accounts.filter(function(a){ return a.code === '4000'; })[0];
    var revenueTotal = revAcct ? Math.round((revAcct.credit - revAcct.debit) * 100) / 100 : orderNet;
    /* shape must match the pnl screen: [0] revenue, [1] cost of sales,
       [2] gross-profit subtotal, [3] opex, [4] operating-profit subtotal */
    DB.pnl = [
      { grp: 'Revenue', kind: 'head', rows: [{ name: 'Product sales', cur: revenueTotal, ytd: revenueTotal, bud: revenueTotal }], total: 'Net revenue' },
      { grp: 'Cost of sales', kind: 'head', rows: [{ name: 'Cost of goods sold', cur: 0, ytd: 0, bud: 0 }], total: 'Cost of sales' },
      { grp: 'Gross profit', kind: 'subtotal' },
      { grp: 'Operating expenses', kind: 'head', rows: [{ name: 'Operating costs (not modelled in canonical seed yet)', cur: 0, ytd: 0, bud: 0 }], total: 'Total opex' },
      { grp: 'Operating profit', kind: 'subtotal' },
    ];
    DB.arAging = d.customers.map(function(c){
      return { cust: c.name, code: c.code, cur: c.balance, b30: 0, b60: 0, b90: 0, b90p: 0 };
    });

    DB.approvals = [
      { no: 'SETUP-1', kind: 'Company setup wizard', who: 'Admin', amt: null, age: 'now', risk: 'low', route: 'settings' },
    ].concat(d.orders.filter(function(o){ return o.status !== 'confirmed'; }).map(function(o){
      return { no: o.doc_no, kind: 'Sales Order Draft', who: 'Admin', amt: o.net,
               age: 'today', risk: o.total > 1000 ? 'med' : 'low', route: 'sales-orders' };
    }));
    DB.notifications = [
      { id: 'erp1', ic: 'checkc', clr: 'ok', cat: 'system', group: 'today',
        title: mode === 'pglite' ? 'PGlite demo database ready' : 'ERP-System demo seed loaded (offline fallback)',
        body: mode === 'pglite'
          ? 'Canonical schema seeded into in-browser PostgreSQL (IndexedDB).'
          : 'PGlite unavailable — showing the same canonical values statically.',
        t: 'now', unread: true, route: 'dashboard' },
      { id: 'erp2', ic: 'receipt', clr: 'accent', cat: 'finance', group: 'today',
        title: (inv ? inv.doc_no : 'INV-SO-1') + ' posted',
        body: money(orderTotal) + ' balanced to AR, revenue and GST output tax.',
        t: 'now', unread: true, route: 'gl' },
    ];
    if (typeof window.applyNotificationState === 'function') window.applyNotificationState();

    DB.salesByMonth = [
      { m: 'Jan', val: 0 }, { m: 'Feb', val: 0 }, { m: 'Mar', val: 0 },
      { m: 'Apr', val: 0 }, { m: 'May', val: 0 }, { m: 'Jun', val: revenueTotal },
      { m: 'Jul', val: 220, fc: true }, { m: 'Aug', val: 330, fc: true },
      { m: 'Sep', val: 440, fc: true }, { m: 'Oct', val: 550, fc: true },
      { m: 'Nov', val: 660, fc: true }, { m: 'Dec', val: 770, fc: true },
    ];
    DB.salesByRep = [{ rep: 'Admin', sales: revenueTotal, target: 500, deals: d.invoices.length }];
    DB.topCustomers = [{ cust: beta.name, custCode: beta.code, ytd: revenueTotal, share: 100 }];

    DB.dashboardMetrics = {
      approvals: DB.approvals.length,
      glIssues: 0,
      stockAlerts: DB.items.filter(function(it){ return it.onHand - it.alloc <= it.reorder; }).length,
      arOpen: DB.salesInvoices.reduce(function(sum, i){ return sum + Math.max(0, i.total - (i.paid || 0)); }, 0),
      openDeliveries: DB.deliveries.filter(function(dd){ return dd.status !== 'Delivered' && dd.status !== 'Cancelled'; }).length,
      goodsReceipts: 0,
      pickTasks: 0,
      leaveRequests: 0,
      openOrderValue: DB.salesOrders.filter(function(o){ return o.status !== 'Closed' && o.status !== 'Cancelled'; })
        .reduce(function(sum, o){ return sum + o.total; }, 0),
      cash: 842000,
      mtdSales: revenueTotal,
      cleared: 1,
    };

    document.title = 'ERP System - Acme Singapore Demo';
  }

  /* ---------------- boot orchestration ---------------- */

  var applied = false;
  function applyOnce(payload, mode){
    if (applied) return;
    applied = true;
    applyData(payload, mode);
  }

  async function bootPglite(){
    var mod = await import(PGLITE_URL);
    var db = new mod.PGlite(PG_DATA_DIR);
    state.db = db;
    var freshlySeeded = await ensureSeeded(db);
    var payload = await readPayload(db);
    if (!payload.master) throw new Error('PGlite payload empty (no master row)');
    applyOnce(payload, 'pglite');
    console.info('[erp-system] demo data source: PGlite (' + PG_DATA_DIR + ')' +
      (freshlySeeded ? ' — freshly seeded' : ' — existing IndexedDB data'));
  }

  var ready = new Promise(function(resolve){
    var timer = setTimeout(function(){
      console.warn('[erp-system] PGlite boot exceeded ' + BOOT_TIMEOUT_MS + 'ms — using static fallback.');
      applyOnce(fallbackPayload(), 'fallback');
      resolve();
    }, BOOT_TIMEOUT_MS);
    bootPglite().then(function(){
      clearTimeout(timer);
      resolve();
    }).catch(function(e){
      clearTimeout(timer);
      console.warn('[erp-system] PGlite unavailable — using static fallback.', e && e.message ? e.message : e);
      applyOnce(fallbackPayload(), 'fallback');
      resolve();
    });
  });

  /* Re-read everything from PGlite and re-apply to the Aria DB contract.
     Call after any write so the next render shows fresh data. */
  async function refresh(){
    if (!state.db) return null;
    var payload = await readPayload(state.db);
    applyData(payload, 'pglite');
    return payload;
  }

  /* Confirm a DRAFT sales order — the live counterpart of
     src/modules/sales/confirmOrder.ts, in ONE PGlite transaction:
     lock+deduct stock per line → movements → status confirmed →
     invoice → balanced GL. Any failure (insufficient stock) rolls
     the ENTIRE chain back. */
  async function confirmOrder(docNo){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Confirm needs PGlite.');
    var result = await state.db.transaction(async function(tx){
      var o = (await tx.query(
        "select id, doc_no, order_date::text as order_date, currency, customer_id, " +
        "net_amount::float as net, tax_amount::float as tax, total_amount::float as total " +
        "from sales_order where master_fn=$1 and company_fn=$2 and doc_no=$3 and status='draft'",
        [SCOPE.masterFn, SCOPE.companyFn, docNo])).rows[0];
      if (!o) throw new Error('Draft order ' + docNo + ' not found (already confirmed?)');

      var wh = (await tx.query(
        "select id from warehouse where master_fn=$1 and company_fn=$2 and code='WH-SALES'",
        [SCOPE.masterFn, SCOPE.companyFn])).rows[0];
      if (!wh) throw new Error('Warehouse WH-SALES not found');

      var lines = (await tx.query(
        "select l.product_id, l.qty::float as qty, p.sku from sales_order_line l " +
        "join product p on p.id = l.product_id " +
        "where l.master_fn=$1 and l.company_fn=$2 and l.order_id=$3 order by l.line_no",
        [SCOPE.masterFn, SCOPE.companyFn, o.id])).rows;

      for (var i = 0; i < lines.length; i++){
        var ln = lines[i];
        var lvl = (await tx.query(
          "select id, qty::float as qty from stock_level " +
          "where master_fn=$1 and company_fn=$2 and product_id=$3 and warehouse_id=$4 for update",
          [SCOPE.masterFn, SCOPE.companyFn, ln.product_id, wh.id])).rows[0];
        var avail = lvl ? lvl.qty : 0;
        if (!lvl || avail < ln.qty){
          var err = new Error('Insufficient stock for ' + ln.sku + ': have ' + avail + ', need ' + ln.qty + ' — order rolled back, nothing was committed.');
          err.name = 'InsufficientStockError';
          throw err; // → whole transaction rolls back
        }
        await tx.query("update stock_level set qty = qty - $1, updated_at = now() where id = $2", [ln.qty, lvl.id]);
        await tx.query(
          "insert into stock_movement (master_fn, company_fn, product_id, warehouse_id, qty, direction, ref_type, ref_id) " +
          "values ($1,$2,$3,$4,$5,'out','sales_order',$6)",
          [SCOPE.masterFn, SCOPE.companyFn, ln.product_id, wh.id, ln.qty, o.id]);
      }

      await tx.query("update sales_order set status='confirmed', updated_at=now() where id=$1", [o.id]);

      var invDoc = 'INV-' + o.doc_no;
      await tx.query(
        "insert into invoice (master_fn, company_fn, doc_no, order_id, customer_id, status, invoice_date, currency, net_amount, tax_amount, total_amount) " +
        "values ($1,$2,$3,$4,$5,'unpaid',$6,$7,$8,$9,$10)",
        [SCOPE.masterFn, SCOPE.companyFn, invDoc, o.id, o.customer_id, o.order_date, o.currency, o.net, o.tax, o.total]);

      var acct = {};
      (await tx.query(
        "select code, id from account where master_fn=$1 and company_fn=$2 and code in ('1100','4000','2200')",
        [SCOPE.masterFn, SCOPE.companyFn])).rows.forEach(function(a){ acct[a.code] = a.id; });
      if (!acct['1100'] || !acct['4000'] || !acct['2200']) throw new Error('Chart of accounts not configured');
      await tx.query(
        "insert into gl_entry (master_fn, company_fn, journal_ref, account_id, debit, credit, memo) values " +
        "($1,$2,$3,$4,$5,0,'AR'), ($1,$2,$3,$6,0,$7,'Revenue'), ($1,$2,$3,$8,0,$9,'Output tax')",
        [SCOPE.masterFn, SCOPE.companyFn, invDoc, acct['1100'], o.total, acct['4000'], o.net, acct['2200'], o.tax]);

      return { invDocNo: invDoc, net: o.net, tax: o.tax, total: o.total, lines: lines.length };
    });
    await refresh();
    return result;
  }

  /* Switch the active company scope (topbar company switcher) and re-read.
     Same-master only today — SCOPE.masterFn stays fixed, matching the single-
     org demo model. */
  function switchCompany(companyFn){
    if (!companyFn || companyFn === SCOPE.companyFn) return Promise.resolve(null);
    SCOPE.companyFn = companyFn;
    return refresh();
  }

  /* Persist first-run setup wizard choices (TASK-010). Demo-adapter contract:
     completeSetup({ masterName, companyName, country, adminName, adminEmail, language })
       -> { masterFn, companyFn, userId }
     A production/API adapter (TASK-011/EPIC-007) must implement the same input
     shape and return the same result shape, so screens-setup-wizard.js does not
     need to know which backend is active. One transaction: rename the existing
     master (masterFn is fixed — this demo models a single org), insert the new
     company (SG -> SGD/GST 9%, MY -> MYR/SST 8%; both currencies are already
     seeded so no currency insert is needed), a starter chart of accounts so
     Finance is not empty, the effective-dated tax rule, the admin app_user
     (idempotent on master_fn+email), a Superadmin role (created once), and the
     user<->company link. Any failure rolls the whole setup back. */
  async function completeSetup(input){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Setup needs PGlite.');
    input = input || {};
    var companyName = String(input.companyName || '').trim();
    var adminName = String(input.adminName || '').trim();
    var adminEmail = String(input.adminEmail || '').trim().toLowerCase();
    var adminPassword = String(input.adminPassword || '');
    if (!companyName) throw new Error('Company name is required.');
    if (!adminName || !adminEmail) throw new Error('Admin user name and email are required.');
    if (adminPassword.length < 8) throw new Error('Admin password must be at least 8 characters.');
    var adminPasswordHash = await hashPasswordBrowser(adminPassword);
    var country = input.country === 'MY' ? 'MY' : 'SG';
    var currency = country === 'MY' ? 'MYR' : 'SGD';
    var taxRegime = country === 'MY' ? 'SST' : 'GST';
    var taxCode = country === 'MY' ? 'SV' : 'SR';
    var taxRate = country === 'MY' ? 8 : 9;
    var masterName = String(input.masterName || '').trim();
    var language = input.language || 'en';
    var slug = companyName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 16) || 'CO';
    var companyFn = 'C-' + slug + '-' + Date.now().toString(36).toUpperCase();

    var result = await state.db.transaction(async function(tx){
      if (masterName) {
        await tx.query('update master set name=$1, updated_at=now() where master_fn=$2', [masterName, SCOPE.masterFn]);
      }
      await tx.query(
        'insert into company (company_fn, master_fn, name, country, currency, tax_regime, locale) values ($1,$2,$3,$4,$5,$6,$7)',
        [companyFn, SCOPE.masterFn, companyName, country, currency, taxRegime, language]);

      var today = new Date().toISOString().slice(0, 10);
      await tx.query(
        'insert into tax_rule (master_fn, company_fn, tax_regime, tax_code, rate, valid_from) values ($1,$2,$3,$4,$5,$6)',
        [SCOPE.masterFn, companyFn, taxRegime, taxCode, taxRate, today]);

      var starterAccounts = [
        ['1100', 'Accounts Receivable', 'asset'],
        ['4000', 'Revenue', 'income'],
        ['2200', taxRegime + ' Output Tax', 'liability'],
      ];
      for (var i = 0; i < starterAccounts.length; i++){
        await tx.query(
          'insert into account (master_fn, company_fn, code, name, type) values ($1,$2,$3,$4,$5)',
          [SCOPE.masterFn, companyFn, starterAccounts[i][0], starterAccounts[i][1], starterAccounts[i][2]]);
      }

      var roleRow = (await tx.query(
        "select role_id from role where master_fn=$1 and name='Superadmin'", [SCOPE.masterFn])).rows[0];
      var roleId = roleRow ? roleRow.role_id : (await tx.query(
        "insert into role (master_fn, name, is_superadmin) values ($1,'Superadmin',true) returning role_id",
        [SCOPE.masterFn])).rows[0].role_id;

      var userRow = (await tx.query(
        'select user_id from app_user where master_fn=$1 and email=$2', [SCOPE.masterFn, adminEmail])).rows[0];
      /* An existing user (re-running setup with the same email) keeps their
         current password — never silently overwrite it here. */
      var userId = userRow ? userRow.user_id : (await tx.query(
        'insert into app_user (master_fn, email, full_name, password_hash, language) values ($1,$2,$3,$4,$5) returning user_id',
        [SCOPE.masterFn, adminEmail, adminName, adminPasswordHash, language])).rows[0].user_id;

      await tx.query(
        'insert into user_company (user_id, company_fn, role_id) values ($1,$2,$3) on conflict (user_id, company_fn) do nothing',
        [userId, companyFn, roleId]);

      return { masterFn: SCOPE.masterFn, companyFn: companyFn, userId: userId };
    });
    await refresh();
    return result;
  }

  /* Reset demo: drop the canonical schema and reload — next boot reseeds. */
  async function reset(){
    try {
      if (state.db) {
        await state.db.exec('drop schema public cascade; create schema public;');
        await state.db.close();
      } else if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase(PG_IDB_NAME);
      }
    } catch (e) {
      console.warn('[erp-system] reset: drop failed, deleting IndexedDB instead.', e);
      try { indexedDB.deleteDatabase(PG_IDB_NAME); } catch (e2) {}
    }
    location.reload();
  }

  /* TASK-024 — demo-mode auth. "Auto-login a clearly-labeled demo user, allow
     switching among seeded users" (no password check in demo: there is no real
     security boundary in a client-only demo — see docs/STATUS.md). login()
     still recognizes a known seeded email and switches identity to it, so
     entering a different seeded email in the login form does something real. */
  async function needsSetup(){
    return (typeof needsSetupWizard === 'function') ? needsSetupWizard() : false;
  }
  async function isSignedIn(){
    return (typeof isDemoSignedIn === 'function') ? isDemoSignedIn() : false;
  }
  async function login(email){
    var trimmed = String(email || '').trim().toLowerCase();
    try {
      if (trimmed) localStorage.setItem('aria-active-user-email', trimmed);
      localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: trimmed || 'admin@acme.co', at: new Date().toISOString() }));
    } catch (e) {}
    return { email: trimmed };
  }
  async function logout(){
    try { localStorage.removeItem('aria-demo-auth'); } catch (e) {}
  }
  async function switchUser(email){
    var trimmed = String(email || '').trim().toLowerCase();
    if (!trimmed) return null;
    try { localStorage.setItem('aria-active-user-email', trimmed); } catch (e) {}
    return refresh();
  }

  window.ErpSystemDemo = {
    ready: ready,
    reset: reset,
    refresh: refresh,
    confirmOrder: confirmOrder,
    completeSetup: completeSetup,
    switchCompany: switchCompany,
    needsSetup: needsSetup,
    isSignedIn: isSignedIn,
    login: login,
    logout: logout,
    switchUser: switchUser,
    get mode(){ return state.mode; },
    get db(){ return state.db; },
  };
  window.ErpSystemDemoReady = ready;
})();
