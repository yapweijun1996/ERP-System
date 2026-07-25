/* ============================================================
   ERP-System data adapter — Phase 2 (TASK-002)

   Boots the CANONICAL demo database through the Vite ESM runtime
   (PGlite + Drizzle + shared TypeScript domain commands) in-browser,
   PostgreSQL, persisted to IndexedDB at idb://erp-system-demo):

     web/public/db/erp-system-schema.sql   (copy of drizzle/*.sql, all migrations)
     src/data/seed.ts's seedDemo() runs directly via the bundled runtime —
                                            no hand-written SQL mirror (TASK-034)
     web/public/db/erp-system-demo-txn.sql (SQL form of the src/demo.ts
                                            confirmed sales-order chain and
                                            purchasing chain — TASK-022/023)

   then READS the data back with async SQL and maps it into the
   user-owned Aria ERP `DB` contract. The numbers on screen come
   from the database, not from literals in this file.

   Fallback: if the bundled PGlite runtime cannot load —
   a static payload with the SAME canonical values keeps the demo
   rendering. `DB.erpSystem.dataMode` records which path ran.

   app.js defers boot until the adapter ready promise resolves.
   `window.ErpSystemData.reset()` drops the schema and reloads,
   which reseeds the canonical sample data on next boot.

   TASK-019: this file only runs in 'demo' data mode. In 'api' mode
   (VITE_DATA_MODE=api) it self-disables and erp-system-api-adapter.js
   sets the same formal window.ErpSystemData contract instead. The legacy
   window.ErpSystemDemo name remains a compatibility alias while screens
   migrate route-by-route.
   ============================================================ */
(function erpSystemDataAdapter(){
  if (typeof DB === 'undefined') return;
  if (typeof window.erpDataMode === 'function' && window.erpDataMode() !== 'demo') return;

  var PG_DATA_DIR = 'idb://erp-system-demo';
  var PG_IDB_NAME = '/pglite/erp-system-demo';
  var BOOT_TIMEOUT_MS = 20000;
  var DEMO_SCHEMA_VERSION = 57;

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
  function demoBase64Url(bytes){
    var binary=''; Array.prototype.forEach.call(bytes,function(b){binary+=String.fromCharCode(b);});
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function demoFromBase64Url(value){
    var padded=String(value).replace(/-/g,'+').replace(/_/g,'/');
    while(padded.length%4) padded+='=';
    var binary=atob(padded), bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return bytes;
  }
  async function demoCredentialKey(){
    var raw=null;
    try{ raw=localStorage.getItem('aria-demo-employee-credential-key'); }catch{}
    if(!raw){
      var bytes=crypto.getRandomValues(new Uint8Array(32));
      raw=demoBase64Url(bytes);
      try{ localStorage.setItem('aria-demo-employee-credential-key',raw); }catch{}
    }
    return crypto.subtle.importKey('raw',demoFromBase64Url(raw),{name:'AES-GCM'},false,['encrypt','decrypt']);
  }
  async function encryptDemoCredential(value){
    var iv=crypto.getRandomValues(new Uint8Array(12));
    var encrypted=new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-GCM',iv:iv},await demoCredentialKey(),new TextEncoder().encode(value)));
    var tag=encrypted.slice(encrypted.length-16), ciphertext=encrypted.slice(0,encrypted.length-16);
    return {v:1,alg:'A256GCM',iv:demoBase64Url(iv),ciphertext:demoBase64Url(ciphertext),tag:demoBase64Url(tag)};
  }
  async function decryptDemoCredential(envelope){
    var ciphertext=demoFromBase64Url(envelope.ciphertext), tag=demoFromBase64Url(envelope.tag);
    var combined=new Uint8Array(ciphertext.length+tag.length);
    combined.set(ciphertext); combined.set(tag,ciphertext.length);
    var plain=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:demoFromBase64Url(envelope.iv)},await demoCredentialKey(),combined);
    return new TextDecoder().decode(plain);
  }
  function newDemoTemporaryPassword(){
    return 'Aria-'+demoBase64Url(crypto.getRandomValues(new Uint8Array(12)))+'!';
  }
  var SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };

  /* db/*.sql lives next to assets/ — resolve relative to this script so the
     GitHub Pages base path (/<repo>/) needs no configuration. */
  var DB_BASE = (function(){
    try { return new URL('../db/', document.currentScript.src).href; }
    catch { return 'db/'; }
  })();

  var state = { db: null, orm: null, runtime: null, mode: 'pending', activeUserId: null };

  /* ---------------- PGlite boot ---------------- */

  function fetchSql(name){
    var separator=name.indexOf('?')===-1?'?':'&';
    return fetch(DB_BASE + name + separator + 'v=' + DEMO_SCHEMA_VERSION).then(function(r){
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
      var txn = await fetchSql('erp-system-demo-txn.sql');
      await db.exec(schema);
      await state.runtime.commands.seedDemo(state.orm);
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

  /* Upgrade IndexedDB databases created by older demo builds. Fresh databases
     already have the current flat schema, but persistent PGlite databases need
     the same incremental treatment as production PostgreSQL. The migration SQL
     is idempotent, so an interrupted boot can safely retry before the version
     marker is written. */
  async function ensureSchemaUpToDate(db){
    await db.exec(
      'create table if not exists "_erp_demo_migration" (' +
      '"version" integer primary key, "applied_at" timestamptz not null default now())');
    var row = (await db.query(
      'select coalesce(max("version"), 0)::int as version from "_erp_demo_migration"')).rows[0];
    var currentVersion = row ? Number(row.version) : 0;
    /* A service-worker update can briefly mix a newer adapter with an older
       cached migration asset. Never trust the version marker alone: verify the
       manufacturing/MRP/quality/sales/purchasing-control signature before declaring the schema current.
       Replaying the generated compatibility bundle is safe and repairs a
       marker that was written after a stale/no-op migration response. */
    var signature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('work_center','manufacturing_bom','bom_version','bom_component'," +
      "'manufacturing_routing','routing_operation','work_order'," +
      "'work_order_material','work_order_operation','mrp_run','mrp_suggestion'," +
      "'quality_inspection_plan','quality_inspection_plan_item'," +
      "'quality_inspection','quality_inspection_result'," +
      "'quality_ncr','quality_corrective_action'," +
      "'sales_enquiry','sales_quotation','sales_quotation_line'," +
      "'sales_delivery','sales_delivery_line'," +
      "'sales_return','sales_return_line','sales_credit_note','sales_credit_note_line'," +
      "'sales_debit_note','sales_price_list','sales_price_list_line'," +
      "'sales_discount_rule','sales_credit_profile')")).rows[0];
    var purchaseReturnSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('purchase_return','purchase_return_line','supplier_credit_note','supplier_credit_note_line')")).rows[0];
    var supplierPricingSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('supplier_price_list','supplier_price_list_line')")).rows[0];
    var projectTimeSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name='project_time_entry'")).rows[0];
    var importSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('import_job','import_job_row','import_row_error')")).rows[0];
    var reportingSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('financial_statement_account_map','budget_version','budget_line'," +
      "'consolidation_rate','report_job','report_artifact')")).rows[0];
    var calendarOutboundSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('calendar_outbound_connection','calendar_outbound_event')")).rows[0];
    var payrollLeaveSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('payroll_leave_source','payroll_run_leave_source')")).rows[0];
    var payrollRunLineSignature = (await db.query(
      "select count(*)::int as n from information_schema.columns " +
      "where table_schema='public' and table_name='payroll_run_line' and column_name in " +
      "('base_gross_pay','leave_earnings','leave_deductions')")).rows[0];
    var documentStorageSignature = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('managed_document','document_version','document_blob','document_file_location')")).rows[0];
    var hasCurrentSignature = signature && Number(signature.n) === 31
      && purchaseReturnSignature && Number(purchaseReturnSignature.n) === 4
      && supplierPricingSignature && Number(supplierPricingSignature.n) === 2
      && projectTimeSignature && Number(projectTimeSignature.n) === 1
      && importSignature && Number(importSignature.n) === 3
      && reportingSignature && Number(reportingSignature.n) === 6
      && calendarOutboundSignature && Number(calendarOutboundSignature.n) === 2
      && payrollLeaveSignature && Number(payrollLeaveSignature.n) === 2
      && payrollRunLineSignature && Number(payrollRunLineSignature.n) === 3
      && documentStorageSignature && Number(documentStorageSignature.n) === 4;
    if (currentVersion >= DEMO_SCHEMA_VERSION && hasCurrentSignature) return false;

    await db.exec(await fetchSql('erp-system-migrations.sql'));
    var appliedPayrollTables = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('payroll_leave_source','payroll_run_leave_source')")).rows[0];
    var appliedPayrollColumns = (await db.query(
      "select count(*)::int as n from information_schema.columns " +
      "where table_schema='public' and table_name='payroll_run_line' and column_name in " +
      "('base_gross_pay','leave_earnings','leave_deductions')")).rows[0];
    var appliedDocumentTables = (await db.query(
      "select count(*)::int as n from information_schema.tables " +
      "where table_schema='public' and table_name in " +
      "('managed_document','document_version','document_blob','document_file_location')")).rows[0];
    if (!appliedPayrollTables || Number(appliedPayrollTables.n) !== 2
      || !appliedPayrollColumns || Number(appliedPayrollColumns.n) !== 3) {
      throw new Error(
        'Persistent PGlite migration v' + DEMO_SCHEMA_VERSION +
        ' did not apply its required Payroll schema signature.');
    }
    if (!appliedDocumentTables || Number(appliedDocumentTables.n) !== 4) {
      throw new Error(
        'Persistent PGlite migration v' + DEMO_SCHEMA_VERSION +
        ' did not apply its required Document Storage schema signature.');
    }
    await db.query(
      'insert into "_erp_demo_migration" ("version") values ($1) on conflict ("version") do nothing',
      [DEMO_SCHEMA_VERSION]);
    console.info('[erp-system] ' +
      (currentVersion >= DEMO_SCHEMA_VERSION ? 'repaired' : 'upgraded') +
      ' persistent PGlite schema from v' + currentVersion + ' to v' + DEMO_SCHEMA_VERSION);
    return true;
  }

  async function ensureWarehousePickFixture(db){
    var row=(await db.query(
      "select count(*)::int as n from warehouse_pick " +
      "where master_fn='M1' and company_fn='C-SG' and doc_no='PICK-1'")).rows[0];
    if(!row||Number(row.n)===0){
      await db.exec(await fetchSql('erp-system-demo-picks.sql'));
    }
  }

  async function ensureManufacturingFixture(db){
    /* The fixture is entirely guarded by NOT EXISTS, so replay it on every
       boot. This also tops up newly required manufacturing accounts or
       snapshots in a persistent IndexedDB created by an earlier v9 build. */
    await db.exec(await fetchSql('erp-system-demo-manufacturing.sql'));
  }

  async function ensureQualityFixture(db){
    await db.exec(await fetchSql('erp-system-demo-quality.sql'));
  }

  async function ensureSalesFrontFixture(db){
    await db.exec(await fetchSql('erp-system-demo-sales-front.sql'));
  }

  async function ensureSalesDeliveryFixture(db){
    await db.exec(await fetchSql('erp-system-demo-sales-delivery.sql'));
  }

  async function ensureSalesReturnFixture(db){
    await db.exec(await fetchSql('erp-system-demo-sales-return.sql'));
  }

  async function ensureSalesDebitFixture(db){
    await db.exec(await fetchSql('erp-system-demo-sales-debit.sql'));
  }

  async function ensureSalesPricingFixture(db){
    await db.exec(await fetchSql('erp-system-demo-sales-pricing.sql'));
  }

  async function ensureSalesCreditFixture(db){
    await db.exec(await fetchSql('erp-system-demo-sales-credit.sql'));
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
      "select p.id, p.company_fn, p.sku, p.name, p.uom, p.standard_cost::float as standard_cost, " +
      "p.average_cost::float as average_cost, " +
      "p.tracking_type, coalesce(sum(s.qty),0)::float as on_hand " +
      "from product p left join stock_level s on s.product_id = p.id " +
      "where " + w('p') + " group by p.id, p.company_fn, p.sku, p.name, p.uom, " +
      "p.standard_cost, p.average_cost, p.tracking_type order by p.id");
    var warehouses = await rows(
      "select id, company_fn, code, name from warehouse where " + wc('warehouse') + " order by code");
    var stockLevels = await rows(
      "select s.id, s.product_id, s.warehouse_id, s.qty::float as qty " +
      "from stock_level s where " + wc('s') + " order by s.product_id, s.warehouse_id");
    var bins = await rows(
      "select id, warehouse_id, code, name, is_system, is_active " +
      "from warehouse_bin where " + wc('warehouse_bin') + " order by warehouse_id, code");
    var lots = await rows(
      "select id, product_id, lot_no, manufactured_date::text as manufactured_date, " +
      "expiry_date::text as expiry_date, quality_status from inventory_lot " +
      "where " + wc('inventory_lot') + " order by id");
    var serials = await rows(
      "select id, product_id, serial_no, lot_id, status from inventory_serial " +
      "where " + wc('inventory_serial') + " order by id");
    var locationBalances = await rows(
      "select id, product_id, warehouse_id, bin_id, tracking_key, lot_id, serial_id, " +
      "qty::float as qty from stock_location_balance where " + wc('stock_location_balance') +
      " order by product_id, warehouse_id, bin_id, tracking_key");
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

    /* TASK-023: purchasing chain (TASK-022's schema/business logic wired into
       the browser demo). Same shape/conventions as the sales queries above. */
    var suppliers = await rows(
      "select s.id, s.code, s.name, coalesce(sum(case when si.status='unpaid' then si.total_amount end),0)::float as balance " +
      "from supplier s left join supplier_invoice si on si.supplier_id = s.id " +
      "where " + wc('s') + " group by s.id, s.code, s.name order by s.id");
    var purchaseOrders = await rows(
      "select po.id, po.version, po.doc_no, po.status, po.order_date::text as order_date, po.currency, " +
      "po.net_amount::float as net, po.tax_amount::float as tax, po.total_amount::float as total, " +
      "s.name as supplier, s.code as supplier_code, " +
      "(select count(*)::int from purchase_order_line l where l.order_id = po.id) as line_count " +
      "from purchase_order po join supplier s on s.id = po.supplier_id " +
      "where " + wc('po') + " order by po.id");
    var purchaseOrderLines = await rows(
      "select l.order_id, l.line_no, p.sku, p.name, p.uom, l.qty::float as qty, " +
      "l.unit_cost::float as unit_cost, l.net_amount::float as net, " +
      "l.tax_rate::float as tax_rate, l.tax_amount::float as tax " +
      "from purchase_order_line l join product p on p.id = l.product_id " +
      "where " + wc('l') + " order by l.order_id, l.line_no");
    var goodsReceipts = await rows(
      "select gr.id, gr.order_id, gr.warehouse_id, gr.doc_no, gr.received_date::text as received_date, po.doc_no as po_no, " +
      "s.name as supplier, s.code as supplier_code, w.code as warehouse " +
      "from goods_receipt gr join purchase_order po on po.id = gr.order_id " +
      "join supplier s on s.id = po.supplier_id join warehouse w on w.id = gr.warehouse_id " +
      "where " + wc('gr') + " order by gr.id");
    var supplierInvoices = await rows(
      "select si.id, si.version, si.order_id, si.supplier_id, si.project_id, si.doc_no, si.status, si.invoice_date::text as invoice_date, si.currency, " +
      "si.net_amount::float as net, si.tax_amount::float as tax, si.total_amount::float as total, " +
      "s.name as supplier, s.code as supplier_code, po.doc_no as po_no " +
      "from supplier_invoice si join supplier s on s.id = si.supplier_id " +
      "join purchase_order po on po.id = si.order_id where " + wc('si') + " order by si.id");

    /* TASK-028: CRM chain (TASK-027's schema/business logic wired into the
       browser demo). owner is a left join — an opportunity may have no
       owner_user_id set. */
    var opportunities = await rows(
      "select o.id, o.doc_no, o.title, o.value::float as value, o.currency, o.stage, " +
      "o.probability::float as probability, o.close_date::text as close_date, " +
      "c.name as customer, c.code as customer_code, u.full_name as owner_name, u.email as owner_email " +
      "from opportunity o join customer c on c.id = o.customer_id " +
      "left join app_user u on u.user_id = o.owner_user_id " +
      "where " + wc('o') + " order by o.id");

    return { master: master, companies: companies, users: users, products: products,
             warehouses: warehouses, stockLevels: stockLevels, bins: bins, lots: lots,
             serials: serials, locationBalances: locationBalances, customers: customers,
             accounts: accounts, taxRules: taxRules, orders: orders, orderLines: orderLines,
             invoices: invoices, glLegs: glLegs, movements: movements,
             suppliers: suppliers, purchaseOrders: purchaseOrders, purchaseOrderLines: purchaseOrderLines,
             goodsReceipts: goodsReceipts, supplierInvoices: supplierInvoices,
             opportunities: opportunities };
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
        { id: 1, company_fn: 'C-SG', sku: 'SG-WIDGET', name: 'Widget (SG)', uom: 'unit', standard_cost: 6.5, tracking_type: 'none', on_hand: 95 },
        { id: 2, company_fn: 'C-SG', sku: 'SG-GADGET', name: 'Gadget (SG)', uom: 'box', standard_cost: 13, tracking_type: 'none', on_hand: 97 },
        { id: 3, company_fn: 'C-MY', sku: 'MY-WIDGET', name: 'Widget (MY)', uom: 'unit', standard_cost: 6, tracking_type: 'none', on_hand: 0 },
      ],
      warehouses: [{ id: 1, company_fn: 'C-SG', code: 'WH-SALES', name: 'Sales Warehouse' }],
      stockLevels: [
        { id: 1, product_id: 1, warehouse_id: 1, qty: 95 },
        { id: 2, product_id: 2, warehouse_id: 1, qty: 97 },
      ],
      bins: [{ id: 1, warehouse_id: 1, code: 'DEFAULT', name: 'Default Bin', is_system: true, is_active: true }],
      lots: [],
      serials: [],
      locationBalances: [
        { id: 1, product_id: 1, warehouse_id: 1, bin_id: 1, tracking_key: 'none', lot_id: null, serial_id: null, qty: 95 },
        { id: 2, product_id: 2, warehouse_id: 1, bin_id: 1, tracking_key: 'none', lot_id: null, serial_id: null, qty: 97 },
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
      suppliers: [{ id: 1, code: 'SUPP1', name: 'Gamma Supplies Pte Ltd', balance: 0 }],
      purchaseOrders: [{ id: 1, doc_no: 'PO-1', status: 'received', order_date: '2024-06-01', currency: 'SGD',
                          net: 120, tax: 10.8, total: 130.8, supplier: 'Gamma Supplies Pte Ltd', supplier_code: 'SUPP1', line_count: 1 }],
      purchaseOrderLines: [
        { order_id: 1, line_no: 1, sku: 'SG-WIDGET', name: 'Widget (SG)', uom: 'unit', qty: 20, unit_cost: 6, net: 120, tax_rate: 9, tax: 10.8 },
      ],
      goodsReceipts: [{ id: 1, order_id: 1, warehouse_id: 1, doc_no: 'GR-1', received_date: '2024-06-05', po_no: 'PO-1',
                         supplier: 'Gamma Supplies Pte Ltd', supplier_code: 'SUPP1', warehouse: 'WH-SALES' }],
      supplierInvoices: [{ id: 1, version: 1, order_id: 1, supplier_id: 1, project_id: null, doc_no: 'SINV-1', status: 'unpaid', invoice_date: '2024-06-06', currency: 'SGD',
                            net: 120, tax: 10.8, total: 130.8, supplier: 'Gamma Supplies Pte Ltd', supplier_code: 'SUPP1', po_no: 'PO-1' }],
      opportunities: [{ id: 1, doc_no: 'OPP-1', title: 'Widget supply expansion', value: 5000, currency: 'SGD',
                         stage: 'negotiation', probability: 75, close_date: '2024-06-15',
                         customer: 'Beta Pte Ltd', customer_code: 'CUST1', owner_name: 'Admin', owner_email: 'admin@acme.co' }],
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
    var orderTotal = so ? so.total : 0;

    DB.erpSystem = {
      source: 'ERP-System canonical demo seed',
      schema: 'src/data/schema (drizzle/0000_init.sql)',
      seed: 'src/data/seed.ts seedDemo() (runs directly, no SQL mirror)',
      transactionProof: 'web/public/db/erp-system-demo-txn.sql (mirrors src/demo.ts)',
      dataMode: mode,                          // 'pglite' | 'fallback'
      scope: SCOPE,
      master: d.master,
      companies: d.companies,
      users: d.users,
      products: d.products,
      warehouses: d.warehouses || [],
      stockLevels: d.stockLevels || [],
      bins: d.bins || [],
      lots: d.lots || [],
      serials: d.serials || [],
      locationBalances: d.locationBalances || [],
      customers: d.customers,
      accounts: d.accounts,
      taxRules: d.taxRules,
      suppliers: d.suppliers,
    };

    DB.company = {
      name: activeCompany.name,
      country: activeCompany.country,
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
    try { activeUserEmail = localStorage.getItem('aria-active-user-email'); } catch {}
    var activeUser = (d.users || []).filter(function(u){ return u.email === activeUserEmail; })[0]
      || (d.users || []).filter(function(u){ return u.is_superadmin; })[0]
      || (d.users || [])[0]
      || { email: 'admin@acme.co', full_name: 'Admin', is_superadmin: true };
    var userDisplayName = activeUser.full_name || activeUser.email;
    state.activeUserId = activeUser.user_id || null;
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
          id: p.id, sku: p.sku, name: p.name, cat: 'Finished Goods', uom: p.uom,
          onHand: p.on_hand, alloc: 0, reorder: x.reorder, roq: x.roq,
          cost: Number(p.average_cost == null ? p.standard_cost || 0 : p.average_cost), trackingType: p.tracking_type || 'none',
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

    /* TASK-023: purchasing chain (TASK-022's schema/business logic, wired into
       the browser demo for the first time). The canonical schema is deliberately
       minimal (code/name/balance for suppliers; doc/status/date/total for
       orders — no contact/rating/lead-time/buyer/approvers columns), so the
       decorative fields these list screens also render are neutral constants,
       not fake prototype data. suppliers/purchaseOrders/goodsReceipts/
       supplierInvoices are the only purchasing DB.* globals this adapter sets —
       the rest (RFQs, quotations, requisitions, returns, credit/debit notes,
       price lists, landed cost, vendor performance) have no schema yet and
       stay on their original sample data, same as every other still-mock
       module (see docs/STATUS.md). */
    DB.suppliers = (d.suppliers || []).map(function(s){
      return {
        code: s.code, name: s.name, contact: '—', phone: '—', email: '—',
        country: activeCompany.country, currency: activeCompany.currency,
        terms: 'Net 30', category: 'General', leadTime: 14, rating: 4.5,
        onTime: 95, approved: true, status: 'Active', balance: s.balance,
      };
    });
    var PO_STATUS_UI = {
      pending_approval: 'Pending Approval', open: 'Approved', received: 'Completed',
      rejected: 'Rejected', cancelled: 'Cancelled',
    };
    DB.purchaseOrders = (d.purchaseOrders || []).map(function(p){
      return {
        id: p.id, version: p.version, rawStatus: p.status,
        no: p.doc_no, supp: p.supplier, suppCode: p.supplier_code,
        date: p.order_date, expect: p.order_date, status: PO_STATUS_UI[p.status] || p.status,
        total: p.total, currency: p.currency, buyer: DB.user.name,
        items: p.line_count, recv: p.status === 'received' ? 100 : 0,
      };
    });
    DB.purchaseOrderLines = (d.purchaseOrderLines || []).map(function(line){
      return {
        id: line.id || line.line_no, orderId: line.order_id, lineNo: line.line_no,
        productId: line.product_id, sku: line.sku, name: line.name, uom: line.uom,
        qty: Number(line.qty || 0), unitCost: Number(line.unit_cost || 0),
        net: Number(line.net || 0), taxCode: line.tax_code || 'SR',
        taxRate: Number(line.tax_rate || 0), tax: Number(line.tax || 0),
      };
    });
    DB.goodsReceipts = (d.goodsReceipts || []).map(function(g){
      return {
        id: g.id, orderId: g.order_id, warehouseId: g.warehouse_id,
        no: g.doc_no, date: g.received_date, po: g.po_no,
        supplier: g.supplier, code: g.supplier_code, warehouse: g.warehouse,
        lines: 1, recvPct: 100, qc: 'Accepted', status: 'Posted',
      };
    });
    DB.supplierInvoices = (d.supplierInvoices || []).map(function(i){
      return {
        id: i.id, version: i.version, orderId: i.order_id, supplierId: i.supplier_id, projectId: i.project_id,
        no: i.doc_no, date: i.invoice_date, supplier: i.supplier, code: i.supplier_code,
        po: i.po_no, grn: null, net: i.net, tax: i.tax, total: i.total, currency: i.currency,
        due: i.invoice_date, match: 'Matched', status: i.status === 'paid' ? 'Paid' : 'Posted',
        rawStatus: i.status, outstanding: i.status === 'unpaid' ? Number(i.total || 0) : 0,
      };
    });

    /* TASK-028: CRM pipeline — same shape screens-crm.js's kanban already
       expects (stage, items:[{no,cust,custCode,title,value,owner,av,clr,
       close,prob}]), just sourced from real opportunity/customer/app_user
       rows instead of data-crm.js's Northwind mock. 'lost' opportunities are
       omitted from the board — the original mock kanban never had a Lost
       column either. Opportunity Detail now exposes the real terminal
       mark-lost action and activity timeline; the board still omits Lost. */
    var CRM_STAGE_UI = { lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won' };
    DB.pipeline = Object.keys(CRM_STAGE_UI).map(function(stageKey){
      var items = (d.opportunities || []).filter(function(o){ return o.stage === stageKey; }).map(function(o){
        var ownerName = o.owner_name || o.owner_email || DB.user.name;
        var initials = (ownerName.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2)
          .map(function(w){ return w[0]; }).join('').toUpperCase()) || 'U';
        return {
          no: o.doc_no, cust: o.customer, custCode: o.customer_code, title: o.title,
          value: o.value, currency: o.currency, owner: ownerName, av: initials, clr: '#0a84ff',
          close: o.close_date, prob: o.probability,
        };
      });
      return { stage: CRM_STAGE_UI[stageKey], items: items };
    });

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
    DB.arAging = d.customers.map(function(c){
      return { cust: c.name, code: c.code, cur: c.balance, b30: 0, b60: 0, b90: 0, b90p: 0 };
    });

    DB.approvals = [
      { no: 'SETUP-1', kind: 'Company setup wizard', who: 'Admin', amt: null, age: 'now', risk: 'low', route: 'settings' },
    ].concat(d.orders.filter(function(o){ return o.status !== 'confirmed'; }).map(function(o){
      return { no: o.doc_no, kind: 'Sales Order Draft', who: 'Admin', amt: o.net,
               age: 'today', risk: o.total > 1000 ? 'med' : 'low', route: 'sales-orders' };
    }));
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

  /* applied/appliedMode track which payload is currently on screen. Normally
     this only fires once. But if the BOOT_TIMEOUT_MS watchdog wins the race
     (slow WASM fetch, big seed, throttled network) and shows fallback data
     FIRST, bootPglite() itself keeps running in the background — when it
     later succeeds, its real data must still replace the fallback so the
     UI is never permanently stuck showing stale/mock values. A fallback ->
     pglite transition is the only override allowed; pglite is never
     replaced once shown. */
  var applied = false;
  var appliedMode = null;
  function applyOnce(payload, mode){
    if (applied && !(appliedMode === 'fallback' && mode === 'pglite')) return;
    applied = true;
    appliedMode = mode;
    applyData(payload, mode);
  }

  async function bootPglite(){
    var runtime = await window.ErpDemoRuntimeReady;
    if (!runtime || typeof runtime.openDatabase !== 'function') {
      throw new Error('Bundled ERP demo runtime is unavailable.');
    }
    var opened = runtime.openDatabase(PG_DATA_DIR);
    var db = opened.client;
    state.db = db;
    state.orm = opened.orm;
    state.runtime = runtime;
    try {
      var freshlySeeded = await ensureSeeded(db);
      await ensureSchemaUpToDate(db);
      await ensureWarehousePickFixture(db);
      await ensureManufacturingFixture(db);
      await ensureQualityFixture(db);
      await ensureSalesFrontFixture(db);
      await ensureSalesDeliveryFixture(db);
      await ensureSalesReturnFixture(db);
      await ensureSalesDebitFixture(db);
      await ensureSalesPricingFixture(db);
      await ensureSalesCreditFixture(db);
      var payload = await readPayload(db);
      if (!payload.master) throw new Error('PGlite payload empty (no master row)');
      var wasFallback = appliedMode === 'fallback';
      applyOnce(payload, 'pglite');
      console.info('[erp-system] demo data source: PGlite (' + PG_DATA_DIR + ')' +
        (freshlySeeded ? ' — freshly seeded' : ' — existing IndexedDB data') +
        (wasFallback ? ' (replacing fallback — late boot)' : ''));
      /* boot() already rendered the current screen off fallback data before
         this resolved late — re-render it so the swap is actually visible
         instead of sitting correct-but-unpainted in DB until the user
         happens to navigate elsewhere. */
      if (wasFallback && typeof navigate === 'function' && typeof CURRENT_ROUTE !== 'undefined' && CURRENT_ROUTE) {
        navigate(CURRENT_ROUTE);
      }
    } catch (e) {
      /* Never leave a failed or stale database writable through completeSetup()
         or another mutation after the UI falls back to static data. */
      state.db = null;
      state.orm = null;
      state.runtime = null;
      try { await db.close(); } catch {}
      throw e;
    }
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

  /* Confirm an existing DRAFT through the same TypeScript domain command used
     by PostgreSQL. The adapter resolves legacy document/warehouse codes only;
     stock, state, invoice and GL rules live in confirmOrder.ts. */
  async function confirmOrder(docNo){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Confirm needs PGlite.');
    var result = await state.db.transaction(async function(tx){
      var o = (await tx.query(
        'select id from sales_order where master_fn=$1 and company_fn=$2 and doc_no=$3',
        [SCOPE.masterFn, SCOPE.companyFn, docNo])).rows[0];
      if (!o) throw new Error('Sales order ' + docNo + ' not found');

      var wh = (await tx.query(
        "select id from warehouse where master_fn=$1 and company_fn=$2 and code='WH-SALES'",
        [SCOPE.masterFn, SCOPE.companyFn])).rows[0];
      if (!wh) throw new Error('Warehouse WH-SALES not found');

      return state.runtime.commands.confirmDraftSalesOrderWithin(
        state.runtime.createOrm(tx),
        SCOPE,
        {
          salesOrderId: o.id,
          warehouseId: wh.id,
        });
    });
    await refresh();
    return result;
  }

  /* Purchasing uses the same bundled TypeScript commands as the server. The
     adapter temporarily resolves legacy screen codes and document numbers,
     then executes each real-world event inside its own PGlite transaction. */

  async function nextDocNo(tx, table, prefix){
    var r = (await tx.query(
      'select count(*)::int as n from ' + table + ' where master_fn=$1 and company_fn=$2',
      [SCOPE.masterFn, SCOPE.companyFn])).rows[0];
    return prefix + '-' + (r.n + 1);
  }

  /* Header + lines with an effective-dated tax snapshot. No stock or GL impact
     yet. Legacy input: { supplierCode, orderDate, currency,
     lines: [{ sku, qty, unitCost, taxCode }] }. */
  async function createPurchaseOrder(input){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Create PO needs PGlite.');
    input = input || {};
    var lines = input.lines || [];
    if (!input.supplierCode) throw new Error('Supplier is required.');
    if (!lines.length) throw new Error('At least one order line is required.');

    var result = await state.db.transaction(async function(tx){
      var sup = (await tx.query(
        'select id from supplier where master_fn=$1 and company_fn=$2 and code=$3',
        [SCOPE.masterFn, SCOPE.companyFn, input.supplierCode])).rows[0];
      if (!sup) throw new Error('Supplier ' + input.supplierCode + ' not found');

      var docNo = await nextDocNo(tx, 'purchase_order', 'PO');
      var commandLines = [];
      for (var i = 0; i < lines.length; i++){
        var ln = lines[i];
        var prod = (await tx.query(
          'select id from product where master_fn=$1 and company_fn=$2 and sku=$3',
          [SCOPE.masterFn, SCOPE.companyFn, ln.sku])).rows[0];
        if (!prod) throw new Error('Product ' + ln.sku + ' not found');
        commandLines.push({
          productId: prod.id,
          qty: Number(ln.qty),
          unitCost: Number(ln.unitCost),
          taxCode: ln.taxCode,
        });
      }
      var created = await state.runtime.commands.createPurchaseOrderWithin(
        state.runtime.createOrm(tx),
        SCOPE,
        {
          docNo: docNo,
          supplierId: sup.id,
          orderDate: input.orderDate,
          currency: input.currency || 'SGD',
          lines: commandLines,
        });
      return Object.assign({ docNo: docNo }, created);
    });
    await refresh();
    return result;
  }

  /* Receives EVERY line of a PO in one transaction. Reuses
     WH-SALES (inventory screens aggregate on-hand across warehouses, so this
     is visibly the same stock the sales chain already deducted from — no
     separate purchasing warehouse needed for the demo). Guards against
     receiving the same PO twice inside the shared command. */
  async function receiveGoods(poDocNo){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Receive goods needs PGlite.');
    var result = await state.db.transaction(async function(tx){
      var po = (await tx.query(
        'select id from purchase_order where master_fn=$1 and company_fn=$2 and doc_no=$3',
        [SCOPE.masterFn, SCOPE.companyFn, poDocNo])).rows[0];
      if (!po) throw new Error('Purchase order ' + poDocNo + ' not found');

      var wh = (await tx.query(
        "select id from warehouse where master_fn=$1 and company_fn=$2 and code='WH-SALES'",
        [SCOPE.masterFn, SCOPE.companyFn])).rows[0];
      if (!wh) throw new Error('Warehouse WH-SALES not found');

      var docNo = await nextDocNo(tx, 'goods_receipt', 'GR');
      var received = await state.runtime.commands.receiveGoodsWithin(
        state.runtime.createOrm(tx),
        SCOPE,
        {
          purchaseOrderId: po.id,
          warehouseId: wh.id,
          docNo: docNo,
          receivedDate: new Date().toISOString().slice(0, 10),
        });
      return Object.assign({ docNo: docNo }, received);
    });
    await refresh();
    return result;
  }

  /* Balanced GL (Dr Inventory + Dr Input Tax = Cr
     Accounts Payable), gated on the PO already being 'received' — invoicing
     goods you haven't received is rejected inside the shared command. */
  async function postSupplierInvoice(poDocNo){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Post invoice needs PGlite.');
    var result = await state.db.transaction(async function(tx){
      var po = (await tx.query(
        'select id from purchase_order where master_fn=$1 and company_fn=$2 and doc_no=$3',
        [SCOPE.masterFn, SCOPE.companyFn, poDocNo])).rows[0];
      if (!po) throw new Error('Purchase order ' + poDocNo + ' not found');

      var docNo = await nextDocNo(tx, 'supplier_invoice', 'SINV');
      var posted = await state.runtime.commands.postSupplierInvoiceWithin(
        state.runtime.createOrm(tx),
        SCOPE,
        {
          purchaseOrderId: po.id,
          docNo: docNo,
          invoiceDate: new Date().toISOString().slice(0, 10),
        });
      return Object.assign({ docNo: docNo }, posted);
    });
    await refresh();
    return result;
  }

  /* CRM is the first demo vertical migrated to the bundled ESM runtime. Lookup
     and document-number compatibility stay here temporarily, while the writes
     below execute the exact shared TypeScript domain commands used by API mode. */

  /* createOpportunity.ts: a plain insert — stage starts at whatever the
     wizard's kanban-column choice was, no line items yet. */
  async function createOpportunity(input){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Create opportunity needs PGlite.');
    var result = await state.db.transaction(async function(tx){
      var cust = (await tx.query(
        'select id from customer where master_fn=$1 and company_fn=$2 and code=$3',
        [SCOPE.masterFn, SCOPE.companyFn, input.customerCode])).rows[0];
      if (!cust) throw new Error('Customer ' + input.customerCode + ' not found');

      var docNo = await nextDocNo(tx, 'opportunity', 'OPP');
      var stageMap = { Lead: 'lead', Qualified: 'qualified', Proposal: 'proposal', Negotiation: 'negotiation' };
      var stage = stageMap[input.stage] || 'lead';

      var created = await state.runtime.commands.createOpportunity(
        state.runtime.createOrm(tx),
        SCOPE,
        {
          docNo: docNo,
          customerId: cust.id,
          title: input.title,
          value: Number(input.value),
          currency: input.currency,
          stage: stage,
          probability: Number(input.probability || 0),
          closeDate: input.closeDate,
        });
      return { opportunityId: created.opportunityId, docNo: docNo };
    });
    await refresh();
    return result;
  }

  /* Conversion composes the shared CRM and sales commands inside this PGlite
     transaction: opportunity lock → order/line → stock → invoice → balanced
     GL → stage update. No browser-side copy of those business writes remains. */
  async function convertOpportunityToSalesOrder(opportunityNo, sku, qty, unitPrice){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Convert needs PGlite.');
    var result = await state.db.transaction(async function(tx){
      var opp = (await tx.query(
        'select id from opportunity where master_fn=$1 and company_fn=$2 and doc_no=$3',
        [SCOPE.masterFn, SCOPE.companyFn, opportunityNo])).rows[0];
      if (!opp) throw new Error('Opportunity ' + opportunityNo + ' not found');

      var prod = (await tx.query(
        'select id from product where master_fn=$1 and company_fn=$2 and sku=$3',
        [SCOPE.masterFn, SCOPE.companyFn, sku])).rows[0];
      if (!prod) throw new Error('Product ' + sku + ' not found');

      var wh = (await tx.query(
        "select id from warehouse where master_fn=$1 and company_fn=$2 and code='WH-SALES'",
        [SCOPE.masterFn, SCOPE.companyFn])).rows[0];
      if (!wh) throw new Error('Warehouse WH-SALES not found');

      var today = new Date().toISOString().slice(0, 10);
      var docNo = await nextDocNo(tx, 'sales_order', 'SO-CRM');
      var converted = await state.runtime.commands.convertOpportunityToSalesOrderWithin(
        state.runtime.createOrm(tx),
        SCOPE,
        {
          opportunityId: opp.id,
          docNo: docNo,
          orderDate: today,
          lines: [{
            productId: prod.id,
            warehouseId: wh.id,
            qty: Number(qty),
            unitPrice: Number(unitPrice),
            taxCode: 'SR',
          }],
        });
      return Object.assign({ docNo: docNo }, converted);
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

  /* Persist first-run setup wizard choices through the shared Drizzle command.
     Demo-adapter contract:
     completeSetup({
       masterName, organizationCode, companyName, country,
       adminName, adminUsername, adminEmail, language
     }) -> { masterFn, organizationCode, companyFn, userId, username }
     Production setup intentionally remains a different zero-user command that
     creates a new master; Demo setup adds a company to the seeded M1 master.
     Password hashing stays in Web Crypto, while all database rules execute in
     completeDemoSetupWithin. Any failure rolls the whole setup back. */
  async function completeSetup(input){
    if (!state.db) throw new Error('Demo database unavailable (offline fallback) — Setup needs PGlite.');
    input = input || {};
    var companyName = String(input.companyName || '').trim();
    var organizationCode = String(input.organizationCode || '').trim().toUpperCase();
    var adminName = String(input.adminName || '').trim();
    var adminUsername = String(input.adminUsername || '').trim().toLowerCase();
    var adminEmail = String(input.adminEmail || '').trim().toLowerCase();
    var adminPassword = String(input.adminPassword || '');
    if (!companyName) throw new Error('Company name is required.');
    if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(organizationCode)) throw new Error('Organization code is invalid.');
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(adminUsername)) throw new Error('Admin username is invalid.');
    if (!adminName || !adminEmail) throw new Error('Admin user name and email are required.');
    if (adminPassword.length < 8) throw new Error('Admin password must be at least 8 characters.');
    var adminPasswordHash = await hashPasswordBrowser(adminPassword);
    var country = input.country === 'MY' ? 'MY' : 'SG';
    var masterName = String(input.masterName || '').trim();
    var language = input.language || 'en';
    var slug = companyName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 16) || 'CO';
    var companyFn = 'C-' + slug + '-' + Date.now().toString(36).toUpperCase();

    var result = await state.db.transaction(async function(tx){
      return state.runtime.commands.completeDemoSetupWithin(
        state.runtime.createOrm(tx),
        {
          masterFn: SCOPE.masterFn,
          masterName: masterName,
          organizationCode: organizationCode,
          companyFn: companyFn,
          companyName: companyName,
          country: country,
          adminName: adminName,
          adminUsername: adminUsername,
          adminEmail: adminEmail,
          adminPasswordHash: adminPasswordHash,
          language: language,
        });
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
      try { indexedDB.deleteDatabase(PG_IDB_NAME); } catch {}
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
    } catch {}
    return { email: trimmed };
  }
  async function logout(){
    try { localStorage.removeItem('aria-demo-auth'); } catch {}
  }
  async function switchUser(email){
    var trimmed = String(email || '').trim().toLowerCase();
    if (!trimmed) return null;
    try { localStorage.setItem('aria-active-user-email', trimmed); } catch {}
    return refresh();
  }

  /* Formal resource contract used by new screens. Raw table access is strictly
     whitelisted; tenant scope is injected here and cannot be supplied by the
     caller. Existing vertical-slice helpers remain below as compatibility
     methods until every screen has moved to create()/action(). */
  var RESOURCE_TABLES = {
    'inventory/products':'product',
    'inventory/warehouses':'warehouse',
    'inventory/stock-levels':'stock_level',
    'inventory/stock-movements':'stock_movement',
    'inventory/bins':'warehouse_bin',
    'inventory/lots':'inventory_lot',
    'inventory/serials':'inventory_serial',
    'inventory/location-balances':'stock_location_balance',
    'inventory/adjustments':'inventory_adjustment',
    'inventory/transfers':'stock_transfer',
    'warehouse/picks':'warehouse_pick',
    'warehouse/pick-lines':'warehouse_pick_line',
    'warehouse/reservations':'stock_reservation',
    'sales/customers':'customer',
    'sales/orders':'sales_order',
    'sales/order-approvals':'sales_order_approval',
    'sales/order-lines':'sales_order_line',
    'sales/invoices':'invoice',
    'sales/enquiries':'sales_enquiry',
    'sales/quotations':'sales_quotation',
    'sales/quotation-lines':'sales_quotation_line',
    'sales/deliveries':'sales_delivery',
    'sales/delivery-lines':'sales_delivery_line',
    'sales/returns':'sales_return',
    'sales/return-lines':'sales_return_line',
    'sales/credit-notes':'sales_credit_note',
    'sales/credit-note-lines':'sales_credit_note_line',
    'sales/debit-notes':'sales_debit_note',
    'sales/price-lists':'sales_price_list',
    'sales/price-list-lines':'sales_price_list_line',
    'sales/discount-rules':'sales_discount_rule',
    'sales/credit-profiles':'sales_credit_profile',
    'sales/commission-plans':'sales_commission_plan',
    'sales/commission-runs':'sales_commission_run',
    'sales/commission-lines':'sales_commission_line',
    'sales/commission-sources':'sales_commission_source',
    'finance/accounts':'account',
    'finance/gl-entries':'gl_entry',
    'finance/journals':'journal_header',
    'finance/journal-lines':'journal_line',
    'finance/bank-statements':'bank_statement',
    'finance/bank-statement-lines':'bank_statement_line',
    'finance/bank-receipts':'bank_receipt',
    'finance/payment-vouchers':'payment_voucher',
    'finance/payment-voucher-lines':'payment_voucher_line',
    'purchasing/suppliers':'supplier',
    'purchasing/orders':'purchase_order',
    'purchasing/purchase-orders':'purchase_order',
    'purchasing/purchase-order-approvals':'purchase_order_approval',
    'purchasing/purchase-order-lines':'purchase_order_line',
    'purchasing/goods-receipts':'goods_receipt',
    'purchasing/supplier-invoices':'supplier_invoice',
    'purchasing/purchase-returns':'purchase_return',
    'purchasing/purchase-return-lines':'purchase_return_line',
    'purchasing/supplier-credit-notes':'supplier_credit_note',
    'purchasing/supplier-credit-note-lines':'supplier_credit_note_line',
    'purchasing/supplier-debit-notes':'supplier_debit_note',
    'purchasing/landed-costs':'landed_cost',
    'purchasing/landed-cost-lines':'landed_cost_line',
    'purchasing/supplier-price-lists':'supplier_price_list',
    'purchasing/supplier-price-list-lines':'supplier_price_list_line',
    'purchasing/purchase-requisitions':'purchase_requisition',
    'purchasing/purchase-requisition-lines':'purchase_requisition_line',
    'purchasing/rfqs':'purchase_rfq',
    'purchasing/rfq-lines':'purchase_rfq_line',
    'purchasing/rfq-suppliers':'purchase_rfq_supplier',
    'purchasing/supplier-quotations':'supplier_quotation',
    'purchasing/supplier-quotation-lines':'supplier_quotation_line',
    'crm/customers':'customer',
    'crm/opportunities':'opportunity',
    'crm/contacts':'contact',
    'crm/activities':'activity',
    'manufacturing/work-centers':'work_center',
    'manufacturing/boms':'manufacturing_bom',
    'manufacturing/bom-versions':'bom_version',
    'manufacturing/bom-components':'bom_component',
    'manufacturing/routings':'manufacturing_routing',
    'manufacturing/routing-operations':'routing_operation',
    'manufacturing/work-orders':'work_order',
    'manufacturing/work-order-materials':'work_order_material',
    'manufacturing/work-order-operations':'work_order_operation',
    'manufacturing/mrp-runs':'mrp_run',
    'manufacturing/mrp-suggestions':'mrp_suggestion',
    'quality/plans':'quality_inspection_plan',
    'quality/plan-items':'quality_inspection_plan_item',
    'quality/inspections':'quality_inspection',
    'quality/results':'quality_inspection_result',
    'quality/ncrs':'quality_ncr',
    'quality/corrective-actions':'quality_corrective_action',
    'assets/assets':'asset',
    'assets/depreciation-runs':'depreciation_run',
    'assets/depreciation-run-lines':'depreciation_run_line',
    'hr/employees':'employee',
    'hr/leave-requests':'leave_request',
    'payroll/runs':'payroll_run',
    'payroll/run-lines':'payroll_run_line',
    'payroll/leave-types':'leave_type',
    'payroll/leave-policies':'leave_policy_version',
    'payroll/leave-sources':'payroll_leave_source',
    'payroll/run-leave-sources':'payroll_run_leave_source',
    'project/projects':'project',
    'project/progress-claims':'progress_claim',
    'project/time-entries':'project_time_entry',
    'integration/import-jobs':'import_job',
    'integration/import-rows':'import_job_row',
    'integration/import-errors':'import_row_error',
    'service/contracts':'service_contract',
    'service/tickets':'service_ticket',
  };
  function normalizeResource(resource){
    return String(resource||'').replace(/^\/+|\/+$/g,'').replace(/^api\//,'');
  }
  function requireDemoDb(){
    if(!state.db) throw new Error('Demo database unavailable (offline fallback) — this operation needs PGlite.');
    return state.db;
  }
  function contractRow(row){
    var normalized={};
    Object.keys(row||{}).forEach(function(key){
      normalized[key.replace(/_([a-z])/g,function(_all,letter){ return letter.toUpperCase(); })]=row[key];
    });
    return normalized;
  }
  /* app_user/role/role_permission/audit_log are deliberately NOT in RESOURCE_TABLES
     (see routes/admin.ts's header comment) -- these bespoke branches mirror the
     production /api/admin/* routes instead of the generic table-scoped SQL below. */
  async function listAdminResource(key, query){
    query=query||{};
    if(key==='admin/users'){
      var users = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listCompanyUsers(state.runtime.createOrm(tx), SCOPE);
      });
      return {data:users,meta:{}};
    }
    if(key==='admin/roles'){
      var roles = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listRoles(state.runtime.createOrm(tx), SCOPE);
      });
      return {data:roles,meta:{}};
    }
    if(key==='admin/role-permissions'){
      var rolePermissions = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listRolePermissions(state.runtime.createOrm(tx), SCOPE);
      });
      return {data:rolePermissions,meta:{}};
    }
    if(key==='admin/audit-log'){
      var auditPage = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listAuditLog(state.runtime.createOrm(tx), SCOPE, {
          limit:query.limit,cursor:query.cursor,
        });
      });
      return {data:auditPage.data,meta:{nextCursor:auditPage.nextCursor}};
    }
    if(key==='admin/modules'){
      var modules = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listMasterModules(state.runtime.createOrm(tx), SCOPE);
      });
      return {data:modules,meta:{}};
    }
    if(key==='admin/master-control'){
      var masterControl = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.getMasterControlWithin(state.runtime.createOrm(tx), SCOPE);
      });
      return {data:masterControl,meta:{}};
    }
    if(key==='integration/connectors'){
      var connectors = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listConnectorsWithin(state.runtime.createOrm(tx), SCOPE);
      });
      return {data:connectors,meta:{}};
    }
    if(key==='settings/overview'){
      var settingsOverview = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.getSystemSettingsWithin(state.runtime.createOrm(tx), SCOPE);
      });
      return {data:settingsOverview,meta:{}};
    }
    return null;
  }
  async function list(resource, query){
    var key=normalizeResource(resource);
    var adminResult=await listAdminResource(key, query);
    if(adminResult) return adminResult;
    if(key==='account/activity'){
      query=query||{};
      var personalActorUserId=Number(state.activeUserId);
      if(!Number.isSafeInteger(personalActorUserId)||personalActorUserId<=0){
        throw new Error('An authenticated user is required.');
      }
      var activityPage=await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listPersonalActivityWithin(
          state.runtime.createOrm(tx),SCOPE,personalActorUserId,{
            limit:Math.max(1,Math.min(100,Number(query.limit)||50)),
            cursor:Number(query.cursor)||undefined,
          });
      });
      return {data:activityPage.data,meta:{
        nextCursor:activityPage.nextCursor==null?null:String(activityPage.nextCursor),
      }};
    }
    if(key==='account/notifications'){
      query=query||{};
      var notificationActorUserId=Number(state.activeUserId);
      if(!Number.isSafeInteger(notificationActorUserId)||notificationActorUserId<=0){
        throw new Error('An authenticated user is required.');
      }
      var notificationPage=await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.listNotificationsWithin(
          state.runtime.createOrm(tx),SCOPE,notificationActorUserId,{
            limit:Math.max(1,Math.min(100,Number(query.limit)||50)),
            cursor:Number(query.cursor)||undefined,
          });
      });
      return {data:notificationPage.data,meta:{
        nextCursor:notificationPage.nextCursor==null?null:String(notificationPage.nextCursor),
      }};
    }
    if(key==='sales/analytics'||key==='sales/salespeople'||key==='bi/analytics'||key==='integration/events'||key==='integration/import-jobs'||key==='purchasing/vendor-performance'||key==='purchasing/analytics'||key==='purchasing/price-variance'){
      query=query||{};
      var derivedCommand=key==='sales/analytics'
        ?state.runtime.commands.listSalesAnalyticsWithin
        :key==='sales/salespeople'
        ?state.runtime.commands.listSalespeopleWithin
        :key==='bi/analytics'
        ?state.runtime.commands.listReportingAnalyticsWithin
        :key==='integration/events'
        ?state.runtime.commands.listIntegrationEventsWithin
        :key==='integration/import-jobs'
        ?state.runtime.commands.listCustomerImportJobsWithin
        :key==='purchasing/vendor-performance'
        ?state.runtime.commands.listVendorPerformanceWithin
        :key==='purchasing/analytics'
          ?state.runtime.commands.listPurchasingAnalyticsWithin
          :state.runtime.commands.listPurchasePriceVarianceWithin;
      var performancePage=await requireDemoDb().transaction(function(tx){
        return derivedCommand(
          state.runtime.createOrm(tx),SCOPE,{
            cursor:Number(query.cursor)||0,
            limit:Math.max(1,Math.min(100,Number(query.limit)||50)),
          });
      });
      return {data:performancePage.data,meta:{
        nextCursor:performancePage.nextCursor==null?null:String(performancePage.nextCursor),
      }};
    }
    var table=RESOURCE_TABLES[key];
    if(!table) throw new Error('Unsupported ERP resource: '+key);
    query=query||{};
    var limit=Math.max(1,Math.min(100,Number(query.limit)||50));
    var cursor=Number(query.cursor)||0;
    var params=[SCOPE.masterFn,SCOPE.companyFn,cursor];
    var sql='select * from '+table+
      ' where master_fn=$1 and company_fn=$2 and id>$3';
    if(key==='project/time-entries'){
      var actorUserId=Number(state.activeUserId);
      if(!Number.isSafeInteger(actorUserId)||actorUserId<=0){
        throw new Error('An authenticated user is required.');
      }
      params.push(actorUserId);
      sql+=' and actor_user_id=$'+params.length;
      ['from','to'].forEach(function(filter){
        if(query[filter]==null||query[filter]==='') return;
        var value=String(query[filter]);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(filter+' must use YYYY-MM-DD.');
        var parsedDate=new Date(value+'T00:00:00Z');
        if(Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==value){
          throw new Error(filter+' must be a real calendar date.');
        }
        params.push(value);
        sql+=' and work_date '+(filter==='from'?'>=':'<=')+' $'+params.length;
      });
      if(query.from&&query.to&&String(query.from)>String(query.to)){
        throw new Error('from must be on or before to.');
      }
    }
    var numericFilters={
      'sales/commission-lines':{runId:'run_id'},
      'sales/commission-sources':{runId:'run_id'},
      'sales/quotations':{enquiryId:'enquiry_id'},
      'finance/journal-lines':{journalId:'journal_id'},
      'finance/gl-entries':{accountId:'account_id'},
      'finance/bank-statements':{bankAccountId:'bank_account_id'},
      'finance/bank-statement-lines':{statementId:'statement_id'},
      'integration/import-rows':{jobId:'job_id'},
      'integration/import-errors':{jobId:'job_id'},
    }[key]||{};
    Object.keys(numericFilters).forEach(function(filter){
      if(query[filter]==null||query[filter]==='') return;
      var value=Number(query[filter]);
      if(!Number.isSafeInteger(value)||value<=0){
        throw new Error(filter+' must be a positive integer.');
      }
      params.push(value);
      sql+=' and '+numericFilters[filter]+'=$'+params.length;
    });
    params.push(limit+1);
    sql+=' order by id asc limit $'+params.length;
    var rows=(await requireDemoDb().query(sql,params)).rows;
    var hasMore=rows.length>limit;
    var data=(hasMore?rows.slice(0,limit):rows).map(contractRow);
    return {data:data,meta:{nextCursor:hasMore?String(data[data.length-1].id):null}};
  }
  async function get(resource,id){
    var key=normalizeResource(resource);
    if(key==='hr/employee-accounts'){
      return {data:await state.runtime.commands.readEmployeeAccount(
        state.orm,SCOPE,Number(id)),meta:{}};
    }
    var table=RESOURCE_TABLES[key];
    if(!table) throw new Error('Unsupported ERP resource: '+key);
    var numericId=Number(id);
    if(!Number.isInteger(numericId)||numericId<=0) throw new Error('Resource id must be a positive integer.');
    var params=[SCOPE.masterFn,SCOPE.companyFn,numericId];
    var sql='select * from '+table+' where master_fn=$1 and company_fn=$2 and id=$3';
    if(key==='project/time-entries'){
      params.push(Number(state.activeUserId));
      sql+=' and actor_user_id=$4';
    }
    var row=(await requireDemoDb().query(sql+' limit 1',params)).rows[0];
    if(!row) throw new Error('ERP resource not found: '+key+'/'+numericId);
    return {data:contractRow(row),meta:{}};
  }
  /* Best-effort demo audit sink for create()/action() -- see appendDemoAudit's
     comment in erp-demo-runtime-impl.ts. Must never throw: an audit-write failure
     must not undo or block a create/action that already succeeded and already
     called refresh(). Skips admin/* resources: those business-logic functions
     (setUserActiveWithin, createRoleWithin, setRolePermissionWithin,
     createInvitationRecordWithin) already call appendAudit themselves, exactly
     mirroring how routes/admin.ts's production handlers never audit a second
     time either -- only routes/resources.ts's generic route layer (and this
     chokepoint, its demo-mode equivalent) audits on behalf of business logic
     that doesn't audit itself. */
  async function recordDemoAudit(entity, entityId, actionName){
    if(entity.indexOf('admin/')===0) return;
    try{
      await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.appendDemoAudit(
          state.runtime.createOrm(tx), SCOPE, state.activeUserId, entity, entityId, actionName);
      });
    }catch(e){
      if(typeof console!=='undefined'&&console.warn) console.warn('[erp-system] demo audit write failed', e);
    }
  }
  async function create(resource,payload){
    var result=await createInner(resource,payload);
    var entityId=result&&result.data&&(result.data.id!=null?result.data.id:null);
    await recordDemoAudit(normalizeResource(resource), entityId, 'create');
    return result;
  }
  async function createInner(resource,payload){
    var key=normalizeResource(resource);
    if(key==='integration/import-jobs'){
      var importJob = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createCustomerImportJobWithin(
          state.runtime.createOrm(tx), SCOPE, Number(state.activeUserId), payload);
      });
      return {data:importJob,meta:{}};
    }
    if(key==='admin/roles'){
      var newRole = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createRoleWithin(
          state.runtime.createOrm(tx), SCOPE, state.activeUserId, payload&&payload.name);
      });
      return {data:newRole,meta:{}};
    }
    if(key==='admin/invitations'){
      var newInvitation = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createInvitation(
          state.runtime.createOrm(tx), SCOPE, state.activeUserId, payload);
      });
      return {data:newInvitation,meta:{}};
    }
    if(key==='inventory/products'){
      var newProduct = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createProductWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newProduct,meta:{}};
    }
    if(key==='crm/contacts'){
      var newContact = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createContactWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newContact,meta:{}};
    }
    if(key==='crm/activities'){
      var newActivity = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createCustomerActivityWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newActivity,meta:{}};
    }
    if(key==='inventory/bins'){
      var bin = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createWarehouseBinWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:bin,meta:{}};
    }
    if(key==='inventory/lots'){
      var lot = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createInventoryLotWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:lot,meta:{}};
    }
    if(key==='inventory/serials'){
      var serial = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.registerInventorySerialWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:serial,meta:{}};
    }
    if(key==='inventory/adjustments'){
      var adjustment = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createInventoryAdjustmentWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:adjustment,meta:{}};
    }
    if(key==='inventory/transfers'){
      var transfer = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createStockTransferWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:transfer,meta:{}};
    }
    if(key==='warehouse/picks'){
      var warehousePick = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createWarehousePickWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:warehousePick,meta:{}};
    }
    if(key==='sales/orders'){
      var salesOrderDraft = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSalesOrderWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:salesOrderDraft,meta:{}};
    }
    if(key==='purchasing/orders'||key==='purchasing/purchase-orders'){
      if(Number.isSafeInteger(payload&&payload.supplierId)){
        var canonicalOrder = await requireDemoDb().transaction(function(tx){
          return state.runtime.commands.createPurchaseOrderWithin(
            state.runtime.createOrm(tx), SCOPE, payload);
        });
        await refresh();
        return {data:Object.assign({docNo:payload.docNo},canonicalOrder),meta:{}};
      }
      return {data:await createPurchaseOrder(payload),meta:{}};
    }
    if(key==='purchasing/purchase-returns'){
      var purchaseReturn = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createPurchaseReturnWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:purchaseReturn,meta:{}};
    }
    if(key==='purchasing/supplier-debit-notes'){
      var supplierDebitNote = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSupplierDebitNoteWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:supplierDebitNote,meta:{}};
    }
    if(key==='purchasing/landed-costs'){
      var landedCost = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createLandedCostWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:landedCost,meta:{}};
    }
    if(key==='crm/opportunities'){
      if(Number.isSafeInteger(payload&&payload.customerId)){
        var canonicalOpportunity = await requireDemoDb().transaction(function(tx){
          return state.runtime.commands.createOpportunity(
            state.runtime.createOrm(tx), SCOPE, payload);
        });
        await refresh();
        return {data:canonicalOpportunity,meta:{}};
      }
      return {data:await createOpportunity(payload),meta:{}};
    }
    if(key==='manufacturing/work-orders'){
      var manufacturingOrder = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createWorkOrderWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:manufacturingOrder,meta:{}};
    }
    if(key==='manufacturing/mrp-runs'){
      var mrp = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.runMrpWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:mrp,meta:{}};
    }
    if(key==='quality/inspections'){
      var inspection = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createInspectionWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:inspection,meta:{}};
    }
    if(key==='quality/ncrs'){
      var ncr = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createNcrWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:ncr,meta:{}};
    }
    if(key==='sales/enquiries'){
      var enquiry = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSalesEnquiryWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:enquiry,meta:{}};
    }
    if(key==='sales/quotations'){
      var quotation = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSalesQuotationWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:quotation,meta:{}};
    }
    if(key==='sales/returns'){
      var salesReturn = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSalesReturnWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:salesReturn,meta:{}};
    }
    if(key==='sales/debit-notes'){
      var debitNote = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSalesDebitNoteWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:debitNote,meta:{}};
    }
    if(key==='sales/price-lists'){
      var priceList = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createPriceListWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:priceList,meta:{}};
    }
    if(key==='purchasing/supplier-price-lists'){
      var supplierPriceList = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSupplierPriceListWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:supplierPriceList,meta:{}};
    }
    if(key==='sales/discount-rules'){
      var discountRule = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createDiscountRuleWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:discountRule,meta:{}};
    }
    if(key==='sales/credit-profiles'){
      var creditProfile = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createCreditProfileWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:creditProfile,meta:{}};
    }
    if(key==='sales/commission-plans'){
      var commissionPlan = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createCommissionPlanWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:commissionPlan,meta:{}};
    }
    if(key==='sales/commission-runs'){
      var commissionRun = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createCommissionRunWithin(
          state.runtime.createOrm(tx), SCOPE, payload, Number(state.activeUserId));
      });
      await refresh();
      return {data:commissionRun,meta:{}};
    }
    if(key==='assets/assets'){
      var newAsset = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createAssetWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newAsset,meta:{}};
    }
    if(key==='assets/depreciation-runs'){
      var depreciationRun = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createDepreciationRunWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:depreciationRun,meta:{}};
    }
    if(key==='hr/employees'){
      var newEmployee = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createEmployeeWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newEmployee,meta:{}};
    }
    if(key==='hr/leave-requests'){
      var newLeaveRequest = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createLeaveRequestWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newLeaveRequest,meta:{}};
    }
    if(key==='payroll/runs'){
      var newPayrollRun = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createPayrollRunWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newPayrollRun,meta:{}};
    }
    if(key==='payroll/leave-sources'){
      var newLeaveSource = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.approveLeaveEncashmentWithin(
          state.runtime.createOrm(tx), SCOPE, Object.assign({},payload,{
            actorUserId:state.activeUserId,
          }));
      });
      await refresh();
      return {data:newLeaveSource,meta:{}};
    }
    if(key==='project/projects'){
      var newProject = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createProjectWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newProject,meta:{}};
    }
    if(key==='project/progress-claims'){
      var newProgressClaim = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createProgressClaimWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newProgressClaim,meta:{}};
    }
    if(key==='project/time-entries'){
      var newTimeEntry = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createProjectTimeEntryWithin(
          state.runtime.createOrm(tx), SCOPE, Number(state.activeUserId), payload);
      });
      await refresh();
      return {data:newTimeEntry,meta:{}};
    }
    if(key==='service/contracts'){
      var newServiceContract = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createServiceContractWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newServiceContract,meta:{}};
    }
    if(key==='service/tickets'){
      var newServiceTicket = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createServiceTicketWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newServiceTicket,meta:{}};
    }
    if(key==='purchasing/purchase-requisitions'){
      var newPurchaseRequisition = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createPurchaseRequisitionWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newPurchaseRequisition,meta:{}};
    }
    if(key==='purchasing/rfqs'){
      var newPurchaseRfq = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createPurchaseRfqWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newPurchaseRfq,meta:{}};
    }
    if(key==='purchasing/supplier-quotations'){
      var newSupplierQuotation = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createSupplierQuotationWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newSupplierQuotation,meta:{}};
    }
    if(key==='finance/bank-receipts'){
      var newBankReceipt = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createBankReceiptWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newBankReceipt,meta:{}};
    }
    if(key==='finance/bank-statements'){
      var newBankStatement = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createBankStatementWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newBankStatement,meta:{}};
    }
    if(key==='finance/journals'){
      var newManualJournal = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createManualJournalWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newManualJournal,meta:{}};
    }
    if(key==='finance/payment-vouchers'){
      var newPaymentVoucher = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.createPaymentVoucherWithin(
          state.runtime.createOrm(tx), SCOPE, payload);
      });
      await refresh();
      return {data:newPaymentVoucher,meta:{}};
    }
    throw new Error('Create is not implemented for ERP resource: '+key);
  }
  async function update(resource){
    throw new Error('Update is not implemented for ERP resource: '+normalizeResource(resource));
  }
  async function action(resource,id,name,payload){
    var result=await actionInner(resource,id,name,payload);
    await recordDemoAudit(normalizeResource(resource), id, name);
    return result;
  }
  async function actionInner(resource,id,name,payload){
    var key=normalizeResource(resource);
    if(key==='hr/employee-accounts'){
      var employeeId=Number(id), actorUserId=Number(state.activeUserId);
      if(name==='create'){
        var initialPassword=newDemoTemporaryPassword();
        var createdAccount=await state.runtime.commands.createEmployeeAccount(state.orm,SCOPE,{
          employeeId:employeeId,
          username:String(payload&&payload.username||'').trim().toLowerCase(),
          passwordHash:await hashPasswordBrowser(initialPassword),
          credentialEnvelope:await encryptDemoCredential(initialPassword),
          expiresAt:new Date(Date.now()+7*24*60*60*1000),
          actorUserId:actorUserId,
        });
        return {data:createdAccount,meta:{}};
      }
      if(name==='reveal-temporary-password'){
        var secret=await state.runtime.commands.activeEmployeeSecret(state.orm,SCOPE,employeeId);
        return {data:{
          temporaryPassword:await decryptDemoCredential(secret.credentialEnvelope),
          purpose:secret.purpose,generation:secret.generation,
          expiresAt:secret.expiresAt,userId:secret.userId,
        },meta:{}};
      }
      if(name==='reset-password'){
        var resetPassword=newDemoTemporaryPassword();
        var resetAccount=await state.runtime.commands.resetEmployeeAccount(state.orm,SCOPE,{
          employeeId:employeeId,
          passwordHash:await hashPasswordBrowser(resetPassword),
          credentialEnvelope:await encryptDemoCredential(resetPassword),
          expiresAt:new Date(Date.now()+7*24*60*60*1000),
          actorUserId:actorUserId,
        });
        return {data:resetAccount,meta:{}};
      }
      if(name==='offboard'){
        var handoff=await state.runtime.commands.offboardEmployeeAccount(state.orm,SCOPE,{
          employeeId:employeeId,
          targetEmployeeId:Number(payload&&payload.targetEmployeeId),
          reason:String(payload&&payload.reason||'').trim(),
          actorUserId:actorUserId,
        });
        return {data:handoff,meta:{}};
      }
      throw new Error('Unknown employee account action.');
    }
    if(key==='integration/connectors'){
      if(name==='configure') throw new Error('Offline Demo never stores connector credentials. Use API mode with server-side encryption.');
      var connectorActor=Number(state.activeUserId);
      var connectorResult=await requireDemoDb().transaction(function(tx){
        if(name==='check-health') return state.runtime.commands.checkConnectorHealthWithin(
          state.runtime.createOrm(tx),SCOPE,connectorActor,Number(id));
        if(name==='pause'||name==='resume') return state.runtime.commands.setConnectorEnabledWithin(
          state.runtime.createOrm(tx),SCOPE,connectorActor,Number(id),name==='resume');
        throw new Error('Unknown connector action.');
      });
      return {data:connectorResult,meta:{}};
    }
    if(key==='settings/policy'&&name==='update'){
      var policyResult=await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.updateCompanyPolicyWithin(
          state.runtime.createOrm(tx),SCOPE,Number(state.activeUserId),payload||{});
      });
      return {data:policyResult,meta:{}};
    }
    if(key==='settings/sequences'&&name==='update'){
      var sequenceResult=await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.updateDocumentSequenceWithin(
          state.runtime.createOrm(tx),SCOPE,Number(state.activeUserId),Number(id),payload||{});
      });
      return {data:sequenceResult,meta:{}};
    }
    if(key==='settings/periods'&&name==='set-status'){
      var periodResult=await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.setAccountingPeriodStatusWithin(
          state.runtime.createOrm(tx),SCOPE,Number(state.activeUserId),Number(id),String(payload&&payload.status||''));
      });
      return {data:periodResult,meta:{}};
    }
    if(key==='account/notifications'&&(name==='mark-read'||name==='dismiss')){
      var notificationActorUserId=Number(state.activeUserId);
      if(!Number.isSafeInteger(notificationActorUserId)||notificationActorUserId<=0){
        throw new Error('An authenticated user is required.');
      }
      var notificationCommand=name==='mark-read'
        ?state.runtime.commands.markNotificationReadWithin
        :state.runtime.commands.dismissNotificationWithin;
      var updatedNotification=await requireDemoDb().transaction(function(tx){
        return notificationCommand(
          state.runtime.createOrm(tx),SCOPE,notificationActorUserId,Number(id));
      });
      return {data:updatedNotification,meta:{}};
    }
    if(key==='integration/import-jobs'&&name==='run'){
      var completedImport = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.runCustomerImportJobWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:completedImport,meta:{}};
    }
    if(key==='finance/bank-statements'&&name==='reconcile'){
      var reconciledBankStatement = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.reconcileBankStatementWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:reconciledBankStatement,meta:{}};
    }
    if(key==='finance/bank-statement-lines'&&name==='match'){
      var matchedBankLine = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.matchBankStatementLineWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload||{});
      });
      await refresh();
      return {data:matchedBankLine,meta:{}};
    }
    if(key==='finance/bank-statement-lines'&&name==='unmatch'){
      var unmatchedBankLine = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.unmatchBankStatementLineWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:unmatchedBankLine,meta:{}};
    }
    if(key==='finance/journals'&&name==='post'){
      var postedManualJournal = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.postManualJournalWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:postedManualJournal,meta:{}};
    }
    if(key==='finance/journals'&&name==='reverse'){
      var reversedManualJournal = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.reverseManualJournalWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload||{});
      });
      await refresh();
      return {data:reversedManualJournal,meta:{}};
    }
    if(key==='admin/users'&&name==='toggle-active'){
      var toggledUser = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.setUserActiveWithin(
          state.runtime.createOrm(tx), SCOPE, state.activeUserId, Number(id),
          !!(payload&&payload.isActive));
      });
      await refresh();
      return {data:toggledUser,meta:{}};
    }
    if(key==='admin/users'&&name==='set-roles'){
      var updatedUserRoles = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.setUserRolesWithin(
          state.runtime.createOrm(tx), SCOPE, state.activeUserId, Number(id),
          Array.isArray(payload&&payload.roleIds)?payload.roleIds.map(Number):[]);
      });
      await refresh();
      return {data:updatedUserRoles,meta:{}};
    }
    if(key==='admin/roles'&&name==='set-permission'){
      var updatedPermission = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.setRolePermissionWithin(
          state.runtime.createOrm(tx), SCOPE, state.activeUserId, Number(id),
          payload&&payload.permissionKey, !!(payload&&payload.allowed));
      });
      return {data:updatedPermission,meta:{}};
    }
    if(key==='admin/modules'&&name==='set-enabled'){
      var updatedModule = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.setMasterModuleWithin(
          state.runtime.createOrm(tx), SCOPE, state.activeUserId, String(id),
          !!(payload&&payload.enabled));
      });
      return {data:updatedModule,meta:{}};
    }
    if(key==='inventory/products'&&name==='update'){
      var updatedProduct = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.updateProductWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload);
      });
      await refresh();
      return {data:updatedProduct,meta:{}};
    }
    if(key==='inventory/adjustments'&&name==='post'){
      var posted = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.postInventoryAdjustmentWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:posted,meta:{}};
    }
    if(key==='inventory/transfers'&&name==='complete'){
      var completed = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.completeStockTransferWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:completed,meta:{}};
    }
    if(key==='warehouse/picks'&&name==='pick-line'){
      var pickedLine = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.recordWarehousePickWithin(
          state.runtime.createOrm(tx), SCOPE, {
            pickId:Number(id),
            lineId:Number(payload&&payload.lineId),
            qty:Number(payload&&payload.qty),
          });
      });
      await refresh();
      return {data:pickedLine,meta:{}};
    }
    if(key==='warehouse/picks'&&name==='complete'){
      var completedPick = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.completeWarehousePickWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:completedPick,meta:{}};
    }
    if(key==='manufacturing/work-orders'&&name==='release'){
      var releasedWorkOrder = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.releaseWorkOrderWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:releasedWorkOrder,meta:{}};
    }
    if(key==='manufacturing/work-orders'&&name==='issue-materials'){
      var issuedWorkOrderMaterials = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.issueWorkOrderMaterialsWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:issuedWorkOrderMaterials,meta:{}};
    }
    if(key==='manufacturing/work-orders'&&name==='report-operation'){
      var reportedWorkOrderOperation = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.reportWorkOrderOperationWithin(
          state.runtime.createOrm(tx), SCOPE, {
            workOrderId:Number(id),
            operationId:Number(payload&&payload.operationId),
            hours:payload&&payload.hours,
            complete:!!(payload&&payload.complete),
          });
      });
      await refresh();
      return {data:reportedWorkOrderOperation,meta:{}};
    }
    if(key==='manufacturing/work-orders'&&name==='complete'){
      var completedWorkOrder = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.completeWorkOrderWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:completedWorkOrder,meta:{}};
    }
    if(key==='quality/inspections'&&name==='complete'){
      var completedInspection = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.completeInspectionWithin(
          state.runtime.createOrm(tx), SCOPE, {
            inspectionId:Number(id),
            results:(payload&&payload.results)||[],
          });
      });
      await refresh();
      return {data:completedInspection,meta:{}};
    }
    if(key==='quality/ncrs'&&(name==='release'||name==='reject')){
      var disposedNcr = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.disposeNcrWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id),
          name==='release'?'release':'scrap');
      });
      await refresh();
      return {data:disposedNcr,meta:{}};
    }
    if(key==='sales/enquiries'&&name==='convert-to-quotation'){
      var convertedEnquiry = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.convertEnquiryToQuotationWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload);
      });
      await refresh();
      return {data:convertedEnquiry,meta:{}};
    }
    if(key==='sales/quotations'&&(name==='issue'||name==='accept')){
      var transitionedQuotation = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.transitionQuotationWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), name);
      });
      await refresh();
      return {data:transitionedQuotation,meta:{}};
    }
    if(key==='sales/quotations'&&name==='convert-to-order'){
      var convertedQuotation = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.convertQuotationToOrderWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload);
      });
      await refresh();
      return {data:convertedQuotation,meta:{}};
    }
    if(key==='sales/returns'&&name==='receive-and-credit'){
      var creditedReturn = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.receiveAndCreditSalesReturnWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload);
      });
      await refresh();
      return {data:creditedReturn,meta:{}};
    }
    if(key==='sales/returns'&&name==='reject'){
      var rejectedReturn = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.rejectSalesReturnWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:rejectedReturn,meta:{}};
    }
    if(key==='sales/debit-notes'&&name==='post'){
      var postedDebitNote = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.postSalesDebitNoteWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:postedDebitNote,meta:{}};
    }
    if(key==='sales/price-lists'&&name==='activate'){
      var activePriceList = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.activatePriceListWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:activePriceList,meta:{}};
    }
    if(key==='purchasing/supplier-price-lists'&&name==='activate'){
      var activeSupplierPriceList = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.activateSupplierPriceListWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:activeSupplierPriceList,meta:{}};
    }
    if(key==='sales/discount-rules'&&name==='activate'){
      var activeDiscountRule = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.activateDiscountRuleWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:activeDiscountRule,meta:{}};
    }
    if(key==='sales/credit-profiles'&&name==='hold'){
      var heldCredit = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.placeCreditHoldWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload.reason);
      });
      await refresh();
      return {data:heldCredit,meta:{}};
    }
    if(key==='sales/credit-profiles'&&name==='release'){
      var releasedCredit = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.releaseCreditHoldWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:releasedCredit,meta:{}};
    }
    if(key==='sales/commission-plans'&&name==='activate'){
      var activatedCommissionPlan = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.activateCommissionPlanWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:activatedCommissionPlan,meta:{}};
    }
    if(key==='sales/commission-runs'&&name==='approve'){
      var approvedCommissionRun = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.approveCommissionRunWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), {
            note:payload&&payload.note,
            actorUserId:Number(state.activeUserId),
          });
      });
      await refresh();
      return {data:approvedCommissionRun,meta:{}};
    }
    if(key==='assets/depreciation-runs'&&name==='post'){
      var postedDepreciationRun = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.postDepreciationRunWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:postedDepreciationRun,meta:{}};
    }
    if(key==='payroll/runs'&&name==='post'){
      var postedPayrollRun = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.postPayrollRunWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:postedPayrollRun,meta:{}};
    }
    if(key==='hr/leave-requests'&&name==='approve'){
      var approvedLeave = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.decideLeaveRequestWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), 'approved');
      });
      await refresh();
      return {data:approvedLeave,meta:{}};
    }
    if(key==='hr/leave-requests'&&name==='reject'){
      var rejectedLeave = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.decideLeaveRequestWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), 'rejected', payload&&payload.rejectionReason);
      });
      await refresh();
      return {data:rejectedLeave,meta:{}};
    }
    if(key==='project/progress-claims'&&name==='post'){
      var postedProgressClaim = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.postProgressClaimWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:postedProgressClaim,meta:{}};
    }
    if(key==='project/time-entries'&&name==='void'){
      var voidedTimeEntry = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.voidProjectTimeEntryWithin(
          state.runtime.createOrm(tx), SCOPE, Number(state.activeUserId),
          Number(id), payload&&payload.reason);
      });
      await refresh();
      return {data:voidedTimeEntry,meta:{}};
    }
    if(key==='service/tickets'&&name==='assign'){
      var assignedServiceTicket = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.assignServiceTicketWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload&&payload.technicianName);
      });
      await refresh();
      return {data:assignedServiceTicket,meta:{}};
    }
    if(key==='service/tickets'&&name==='resolve'){
      var resolvedServiceTicket = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.resolveServiceTicketWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload&&payload.diagnosis);
      });
      await refresh();
      return {data:resolvedServiceTicket,meta:{}};
    }
    if(key==='purchasing/purchase-requisitions'&&name==='approve'){
      var approvedRequisition = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.decidePurchaseRequisitionWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), 'approved');
      });
      await refresh();
      return {data:approvedRequisition,meta:{}};
    }
    if(key==='purchasing/purchase-requisitions'&&name==='reject'){
      var rejectedRequisition = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.decidePurchaseRequisitionWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), 'rejected', payload&&payload.rejectionReason);
      });
      await refresh();
      return {data:rejectedRequisition,meta:{}};
    }
    if(key==='purchasing/rfqs'&&(name==='issue'||name==='close')){
      var transitionedRfq = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.transitionPurchaseRfqWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), name);
      });
      await refresh();
      return {data:transitionedRfq,meta:{}};
    }
    if(key==='purchasing/supplier-quotations'&&name==='convert-to-purchase-order'){
      payload=payload||{};
      var convertedSupplierQuotation = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.convertSupplierQuotationToPurchaseOrderWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), {
            docNo:payload.docNo,
            orderDate:payload.orderDate,
          });
      });
      await refresh();
      return {data:convertedSupplierQuotation,meta:{}};
    }
    if(key==='purchasing/purchase-orders'&&(name==='approve'||name==='reject')){
      payload=payload||{};
      var decidedPurchaseOrder = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.decidePurchaseOrderWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), {
            decision:name==='approve'?'approve':'reject',
            note:payload.note,
            actorUserId:Number(state.activeUserId),
          });
      });
      await refresh();
      return {data:decidedPurchaseOrder,meta:{}};
    }
    if(key==='sales/orders'&&name==='confirm'){
      if(Number.isSafeInteger(Number(id))&&payload&&Number.isSafeInteger(payload.warehouseId)){
        var confirmedOrder = await requireDemoDb().transaction(function(tx){
          return state.runtime.commands.confirmDraftSalesOrderWithin(
            state.runtime.createOrm(tx), SCOPE, {
              salesOrderId:Number(id),
              warehouseId:payload.warehouseId,
            });
        });
        await refresh();
        return {data:confirmedOrder,meta:{}};
      }
      return {data:await confirmOrder(id),meta:{}};
    }
    if(key==='sales/orders'&&(name==='approve'||name==='reject')){
      payload=payload||{};
      var decidedSalesOrder = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.decideSalesOrderWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), {
            decision:name==='approve'?'approve':'reject',
            note:payload.note,
            actorUserId:Number(state.activeUserId),
          });
      });
      await refresh();
      return {data:decidedSalesOrder,meta:{}};
    }
    if((key==='purchasing/orders'||key==='purchasing/purchase-orders')&&name==='receive'){
      if(payload&&Number.isSafeInteger(payload.warehouseId)){
        var canonicalReceipt = await requireDemoDb().transaction(function(tx){
          return state.runtime.commands.receiveGoodsWithin(
            state.runtime.createOrm(tx), SCOPE, {
              purchaseOrderId:Number(id),
              warehouseId:payload.warehouseId,
              docNo:payload.docNo,
              receivedDate:payload.receivedDate,
            });
        });
        await refresh();
        return {data:Object.assign({docNo:payload.docNo},canonicalReceipt),meta:{}};
      }
      return {data:await receiveGoods(id),meta:{}};
    }
    if((key==='purchasing/orders'||key==='purchasing/purchase-orders')&&name==='post-invoice'){
      if(payload&&payload.docNo){
        var canonicalInvoice = await requireDemoDb().transaction(function(tx){
          return state.runtime.commands.postSupplierInvoiceWithin(
            state.runtime.createOrm(tx), SCOPE, {
              purchaseOrderId:Number(id),
              docNo:payload.docNo,
              invoiceDate:payload.invoiceDate,
            });
        });
        await refresh();
        return {data:Object.assign({docNo:payload.docNo},canonicalInvoice),meta:{}};
      }
      return {data:await postSupplierInvoice(id),meta:{}};
    }
    if(key==='purchasing/purchase-returns'&&name==='ship-and-credit'){
      payload=payload||{};
      var creditedPurchaseReturn = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.shipAndCreditPurchaseReturnWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload);
      });
      await refresh();
      return {data:creditedPurchaseReturn,meta:{}};
    }
    if(key==='purchasing/purchase-returns'&&name==='reject'){
      var rejectedPurchaseReturn = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.rejectPurchaseReturnWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:rejectedPurchaseReturn,meta:{}};
    }
    if(key==='purchasing/supplier-debit-notes'&&name==='post'){
      var postedSupplierDebitNote = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.postSupplierDebitNoteWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:postedSupplierDebitNote,meta:{}};
    }
    if(key==='purchasing/landed-costs'&&name==='allocate'){
      var allocatedLandedCost = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.allocateLandedCostWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id));
      });
      await refresh();
      return {data:allocatedLandedCost,meta:{}};
    }
    if(key==='crm/opportunities'&&name==='convert'){
      payload=payload||{};
      var convertedOpportunity = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.convertOpportunityToSalesOrderWithin(
          state.runtime.createOrm(tx), SCOPE, {
            opportunityId:Number(id),
            docNo:payload.docNo,
            orderDate:payload.orderDate,
            lines:payload.lines,
          });
      });
      await refresh();
      return {data:convertedOpportunity,meta:{}};
    }
    if(key==='crm/opportunities'&&name==='mark-lost'){
      payload=payload||{};
      var lostOpportunity = await requireDemoDb().transaction(function(tx){
        return state.runtime.commands.markOpportunityLostWithin(
          state.runtime.createOrm(tx), SCOPE, Number(id), payload.reason);
      });
      await refresh();
      return {data:lostOpportunity,meta:{}};
    }
    if(key==='crm/opportunities'&&name==='convert-to-sales-order'){
      payload=payload||{};
      return {data:await convertOpportunityToSalesOrder(id,payload.sku,payload.qty,payload.unitPrice),meta:{}};
    }
    throw new Error('Action is not implemented: '+key+'/'+id+'/'+name);
  }
  async function session(){
    return {
      user:DB.user||null,
      scope:{masterFn:SCOPE.masterFn,companyFn:SCOPE.companyFn},
      mode:state.mode,
    };
  }

  function reportActorUserId(){
    var actorUserId=Number(state.activeUserId);
    if(!Number.isSafeInteger(actorUserId)||actorUserId<=0){
      throw new Error('An authenticated demo user is required.');
    }
    return actorUserId;
  }
  async function profitLossOptions(){
    return {
      data:await state.runtime.commands.getProfitLossOptions(state.orm,{
        masterFn:SCOPE.masterFn,
        activeCompanyFn:SCOPE.companyFn,
        actorUserId:reportActorUserId(),
      }).then(function(data){
        return Object.assign({},data,{capabilities:{
          manageBudget:true,approveBudget:true,exportReport:true,
        }});
      }),
      meta:{},
    };
  }
  async function arAgingOptions(){
    return {
      data:await state.runtime.commands.getArAgingOptions(state.orm,{
        masterFn:SCOPE.masterFn,
        activeCompanyFn:SCOPE.companyFn,
        actorUserId:reportActorUserId(),
      }),
      meta:{},
    };
  }
  async function arAging(query){
    query=query||{};
    return state.runtime.commands.buildArAgingReport(state.orm,{
      masterFn:SCOPE.masterFn,
      activeCompanyFn:SCOPE.companyFn,
      actorUserId:reportActorUserId(),
      customerId:query.customerId==null||query.customerId===''?undefined:Number(query.customerId),
      cursor:query.cursor||undefined,
      limit:query.limit==null?undefined:Number(query.limit),
    });
  }
  async function profitLoss(query){
    query=query||{};
    return state.runtime.commands.buildProfitLossReport(state.orm,{
      masterFn:SCOPE.masterFn,
      activeCompanyFn:SCOPE.companyFn,
      actorUserId:reportActorUserId(),
      periodId:query.periodId==null?undefined:Number(query.periodId),
      companyFns:Array.isArray(query.companyFns)?query.companyFns:undefined,
      presentationCurrency:query.presentationCurrency,
      comparison:query.comparison,
    });
  }
  async function listBudgets(fiscalYear){
    var data=await requireDemoDb().transaction(function(tx){
      return state.runtime.commands.listBudgetVersionsWithin(
        state.runtime.createOrm(tx),SCOPE,fiscalYear==null?undefined:Number(fiscalYear));
    });
    return {data:data,meta:{}};
  }
  async function budgetLines(id){
    var data=await requireDemoDb().transaction(function(tx){
      return state.runtime.commands.listBudgetLinesWithin(
        state.runtime.createOrm(tx),SCOPE,Number(id));
    });
    return {data:data,meta:{}};
  }
  async function createBudget(payload){
    var data=await requireDemoDb().transaction(function(tx){
      return state.runtime.commands.createBudgetVersionWithin(
        state.runtime.createOrm(tx),SCOPE,payload||{});
    });
    return {data:data,meta:{}};
  }
  async function budgetAction(id,name,payload){
    var data=await requireDemoDb().transaction(function(tx){
      var orm=state.runtime.createOrm(tx);
      if(name==='import') return state.runtime.commands.importBudgetLinesWithin(
        orm,SCOPE,Number(id),Array.isArray(payload&&payload.rows)?payload.rows:[]);
      if(name==='approve') return state.runtime.commands.approveBudgetWithin(
        orm,SCOPE,Number(id),reportActorUserId());
      throw new Error('Unknown budget action.');
    });
    return {data:data,meta:{}};
  }
  async function exportProfitLoss(payload){
    payload=payload||{};
    var report=await profitLoss(payload.filters||{});
    if(payload.format==='xlsx'){
      var bytes=await state.runtime.commands.buildProfitLossXlsx(report);
      var url=URL.createObjectURL(new Blob([bytes],{
        type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      return {data:{status:'succeeded',format:'xlsx',downloadUrl:url,
        fileName:'profit-loss-'+report.data.period.fiscalYear+'-'+report.data.period.periodNo+'.xlsx'},meta:{}};
    }
    return {data:{status:'print-ready',format:'pdf',report:report},meta:{}};
  }
  var financeReports={
    arAgingOptions:arAgingOptions,
    arAging:arAging,
    options:profitLossOptions,
    profitLoss:profitLoss,
    listBudgets:listBudgets,
    budgetLines:budgetLines,
    createBudget:createBudget,
    budgetAction:budgetAction,
    exportProfitLoss:exportProfitLoss,
    reportJob:function(){return Promise.reject(new Error('Demo exports complete immediately.'));},
    artifactUrl:function(id){return String(id||'');},
  };
  function myActorUserId(){
    var actorUserId=Number(state.activeUserId);
    if(!Number.isSafeInteger(actorUserId)||actorUserId<=0){
      throw new Error('An authenticated demo user is required.');
    }
    return actorUserId;
  }
  async function withMyActor(work){
    var data=await requireDemoDb().transaction(async function(tx){
      var orm=state.runtime.createOrm(tx);
      var canReadSelf=await state.runtime.commands.hasPermissionWithin(
        orm,SCOPE,myActorUserId(),'employee.self.read');
      if(!canReadSelf) throw new Error('You cannot access Employee Self Service.');
      var actor=await state.runtime.commands.resolveActorEmployeeWithin(
        orm,SCOPE,myActorUserId());
      return work(orm,actor);
    });
    return data;
  }
  var my={
    context:async function(){
      var data=await withMyActor(async function(orm,actor){
        var canReadTeam=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.team.read');
        var canWriteLeave=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.leave.write');
        var canWriteReceipts=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.receipts.write');
        var teamEmployeeIds=canReadTeam
          ?await state.runtime.commands.resolveTeamEmployeeIdsWithin(orm,SCOPE,actor.id)
          :[];
        var leaveTypes=await state.runtime.commands.listAvailableLeaveTypesWithin(orm,SCOPE);
        return {
          company:{
            companyFn:SCOPE.companyFn,
            name:DB.company&&DB.company.name||SCOPE.companyFn,
            country:DB.company&&DB.company.country||'',
            currency:DB.company&&DB.company.currency||'',
            taxRegime:DB.company&&DB.company.taxRegime||'',
            locale:typeof getLang==='function'?getLang():'en',
          },
          employee:actor,
          leaveTypes:leaveTypes,
          capabilities:{
            leave:{available:true,writable:canWriteLeave},
            claims:{available:false,reason:'not_modelled'},
            receipts:{available:true,writable:canWriteReceipts},
            team:{available:canReadTeam,employeeCount:teamEmployeeIds.length},
          },
        };
      });
      return {data:data,meta:{actorDerived:true}};
    },
    leaveRequests:async function(){
      var data=await withMyActor(function(orm,actor){
        return state.runtime.commands.listActorLeaveWithin(orm,SCOPE,actor.id);
      });
      return {data:data,meta:{actorDerived:true,limit:100}};
    },
    leaveApplication:async function(id){
      var data=await withMyActor(function(orm,actor){
        return state.runtime.commands.readGovernedLeaveWithin(orm,SCOPE,{
          userId:myActorUserId(),employeeId:actor.id,
        },Number(id));
      });
      return {data:data,meta:{actorDerived:true,privacy:'owner_private'}};
    },
    createLeaveDraft:async function(payload){
      var data=await withMyActor(async function(orm,actor){
        var canWrite=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.leave.write');
        if(!canWrite) throw new Error('You cannot maintain your leave applications.');
        return state.runtime.commands.createLeaveDraftWithin(orm,SCOPE,{
          userId:myActorUserId(),employeeId:actor.id,
        },actor.id,payload||{});
      });
      return {data:data,meta:{actorDerived:true}};
    },
    leaveAction:async function(id,name,payload){
      payload=payload||{};
      var data=await withMyActor(async function(orm,actor){
        var canWrite=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.leave.write');
        if(!canWrite) throw new Error('You cannot maintain your leave applications.');
        var requestId=Number(id);
        var version=Number(payload.expectedVersion);
        var leaveActor={userId:myActorUserId(),employeeId:actor.id};
        if(name==='amend'){
          return state.runtime.commands.amendLeaveApplicationWithin(
            orm,SCOPE,leaveActor,requestId,version,payload);
        }
        if(name==='submit'){
          return state.runtime.commands.submitLeaveApplicationWithin(
            orm,SCOPE,leaveActor,requestId,version);
        }
        if(name==='withdraw'){
          return state.runtime.commands.withdrawLeaveApplicationWithin(
            orm,SCOPE,leaveActor,requestId,version,String(payload.reason||''));
        }
        if(name==='void'){
          return state.runtime.commands.voidOwnLeaveApplicationWithin(
            orm,SCOPE,leaveActor,requestId,version,String(payload.reason||''));
        }
        if(name==='request-cancellation'){
          return state.runtime.commands.requestApprovedLeaveCancellationWithin(
            orm,SCOPE,leaveActor,requestId,version,String(payload.reason||''));
        }
        throw new Error('Unsupported leave action.');
      });
      return {data:data,meta:{actorDerived:true}};
    },
    claims:async function(){
      await withMyActor(function(){ return null; });
      return {data:[],meta:{actorDerived:true,availability:'not_modelled',plannedEpic:'EPIC-055'}};
    },
    receipts:async function(){
      await withMyActor(function(){ return null; });
      var result=await requireDemoDb().query(
        `select d.id,d.document_key,d.original_file_name,d.current_version_no,
                d.retention_until,d.legal_hold,d.created_at,
                v.sha256,v.mime_type,v.size_bytes,v.page_count,v.storage_backend
         from managed_document d
         join document_version v
           on v.master_fn=d.master_fn and v.company_fn=d.company_fn
          and v.document_id=d.id and v.version_no=d.current_version_no
         where d.master_fn=$1 and d.company_fn=$2 and d.owner_user_id=$3
           and d.purpose='receipt'
         order by d.created_at desc,d.id desc limit 100`,
        [SCOPE.masterFn,SCOPE.companyFn,myActorUserId()]);
      return {data:result.rows.map(function(row){return {
        id:Number(row.id),documentKey:row.document_key,
        originalFileName:row.original_file_name,currentVersionNo:Number(row.current_version_no),
        retentionUntil:row.retention_until,legalHold:Boolean(row.legal_hold),createdAt:row.created_at,
        sha256:row.sha256,mimeType:row.mime_type,sizeBytes:Number(row.size_bytes),
        pageCount:Number(row.page_count),storageBackend:row.storage_backend,
      };}),meta:{actorDerived:true,availability:'capture',scanning:'planned_task_119',limit:100}};
    },
    uploadReceipt:async function(draft){
      draft=draft||{};
      var content=new Uint8Array(await draft.blob.arrayBuffer());
      var validated=await state.runtime.commands.validateReceiptUpload({
        fileName:String(draft.name||''),declaredMimeType:String(draft.type||''),content:content,
      });
      var draftId=String(draft.id||'');
      if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(draftId)){
        var idError=new Error('A stable client draft identifier is required.');
        idError.code='receipt_draft_id_invalid';throw idError;
      }
      var digest=new Uint8Array(await crypto.subtle.digest('SHA-256',validated.content));
      var hash=Array.from(digest).map(function(value){return value.toString(16).padStart(2,'0');}).join('');
      var result=await requireDemoDb().transaction(async function(tx){
        var orm=state.runtime.createOrm(tx);
        var canRead=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.self.read');
        var canWrite=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.receipts.write');
        if(!canRead||!canWrite) throw new Error('You cannot upload receipt evidence.');
        await state.runtime.commands.resolveActorEmployeeWithin(orm,SCOPE,myActorUserId());
        var key='receipt:'+myActorUserId()+':'+draftId;
        var existing=await tx.query(
          `select d.*,v.id as version_id,v.sha256,v.mime_type,v.size_bytes,
                  v.page_count,v.storage_backend
           from managed_document d join document_version v
             on v.master_fn=d.master_fn and v.company_fn=d.company_fn
            and v.document_id=d.id and v.version_no=1
           where d.master_fn=$1 and d.company_fn=$2 and d.document_key=$3 limit 1`,
          [SCOPE.masterFn,SCOPE.companyFn,key]);
        if(existing.rows[0]){
          var row=existing.rows[0];
          if(row.sha256!==hash||row.mime_type!==validated.mimeType
            ||Number(row.size_bytes)!==validated.content.byteLength
            ||Number(row.page_count)!==validated.pageCount){
            var conflict=new Error('This receipt draft key is already used by different content.');
            conflict.code='document_key_conflict';throw conflict;
          }
          return {row:row,replayed:true};
        }
        var retention=new Date();retention.setUTCFullYear(retention.getUTCFullYear()+7);
        var inserted=await tx.query(
          `insert into managed_document
             (master_fn,company_fn,document_key,purpose,owner_user_id,original_file_name,
              current_version_no,retention_until,legal_hold,created_by_user_id)
           values ($1,$2,$3,'receipt',$4,$5,1,$6,false,$4) returning *`,
          [SCOPE.masterFn,SCOPE.companyFn,key,myActorUserId(),validated.fileName,retention]);
        var documentRow=inserted.rows[0];
        var version=await tx.query(
          `insert into document_version
             (master_fn,company_fn,document_id,version_no,sha256,mime_type,size_bytes,
              page_count,storage_backend,created_by_user_id)
           values ($1,$2,$3,1,$4,$5,$6,$7,'database',$8) returning *`,
          [SCOPE.masterFn,SCOPE.companyFn,documentRow.id,hash,validated.mimeType,
           validated.content.byteLength,validated.pageCount,myActorUserId()]);
        await tx.query(
          `insert into document_blob (master_fn,company_fn,version_id,content)
           values ($1,$2,$3,$4)`,
          [SCOPE.masterFn,SCOPE.companyFn,version.rows[0].id,validated.content]);
        return {row:Object.assign({},documentRow,version.rows[0]),replayed:false};
      });
      return {data:{
        id:Number(result.row.document_id||result.row.id),
        documentKey:result.row.document_key,
        originalFileName:result.row.original_file_name||validated.fileName,
        versionNo:1,sha256:hash,mimeType:validated.mimeType,
        sizeBytes:validated.content.byteLength,pageCount:validated.pageCount,
        storageBackend:'database',createdAt:result.row.created_at,
      },meta:{actorDerived:true,replayed:result.replayed,scanning:'planned_task_119'}};
    },
    teamLeaveRequests:async function(){
      var data=await withMyActor(async function(orm,actor){
        var canReadTeam=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.team.read');
        if(!canReadTeam) throw new Error('You cannot read team leave.');
        var ids=await state.runtime.commands.resolveTeamEmployeeIdsWithin(orm,SCOPE,actor.id);
        return state.runtime.commands.listTeamLeaveWithin(orm,SCOPE,ids);
      });
      return {data:data,meta:{
        actorDerived:true,privacy:'reason_and_evidence_redacted',limit:100,
      }};
    },
    teamCalendar:async function(query){
      query=query||{};
      var response=await withMyActor(async function(orm,actor){
        var canReadTeam=await state.runtime.commands.hasPermissionWithin(
          orm,SCOPE,myActorUserId(),'employee.team.read');
        if(!canReadTeam) throw new Error('You cannot read the team calendar.');
        var directIds=await state.runtime.commands.resolveDirectReportEmployeeIdsWithin(
          orm,SCOPE,actor.id);
        var expandedIds=await state.runtime.commands.resolveTeamEmployeeIdsWithin(
          orm,SCOPE,actor.id);
        var directSet=new Set(directIds);
        var canExpand=expandedIds.some(function(id){return !directSet.has(id);});
        if(query.scope==='expanded'&&!canExpand){
          var scopeError=new Error('No active hierarchy grant authorizes an expanded reporting tree.');
          scopeError.code='calendar_scope_not_authorized';
          throw scopeError;
        }
        var data=await state.runtime.commands.listTeamCalendarWithin(
          orm,SCOPE,query.scope==='expanded'?expandedIds:directIds,{
            from:String(query.from||''),to:String(query.to||''),
            department:query.department||null,status:query.status||'all',
          });
        return {data:data,canExpand:canExpand,directCount:directIds.length};
      });
      return {data:response.data,meta:{
        actorDerived:true,privacy:'reason_and_evidence_redacted',
        scope:query.scope==='expanded'?'expanded':'direct',
        canExpand:response.canExpand,directReportCount:response.directCount,limit:300,
      }};
    },
    approvals:async function(){
      var data=await withMyActor(function(orm){
        return state.runtime.commands.listMyLeaveApprovalsWithin(
          orm,SCOPE,myActorUserId());
      });
      return {data:data,meta:{
        actorDerived:true,privacy:'reason_and_evidence_redacted',
        decisionCommands:true,limit:100,
      }};
    },
    approval:async function(id){
      var data=await withMyActor(function(orm){
        return state.runtime.commands.readMyLeaveApprovalWithin(
          orm,SCOPE,myActorUserId(),Number(id));
      });
      return {data:data,meta:{
        actorDerived:true,privacy:'reason_and_evidence_redacted',
      }};
    },
    approvalAction:async function(id,name,payload){
      payload=payload||{};
      var data=await withMyActor(function(orm,actor){
        return state.runtime.commands.decideGovernedLeaveWithin(
          orm,SCOPE,{userId:myActorUserId(),employeeId:actor.id},
          Number(id),Number(payload.expectedVersion),
          name==='approve'?'approved':'rejected',String(payload.reason||''));
      });
      return {data:data,meta:{actorDerived:true}};
    },
    approvalDelegations:async function(){
      var data=await withMyActor(function(orm,actor){
        return state.runtime.commands.listApprovalDelegationsWithin(
          orm,SCOPE,actor.id);
      });
      return {data:data,meta:{actorDerived:true,maximumDays:90}};
    },
    approvalDelegationCandidates:async function(){
      var data=await withMyActor(function(orm,actor){
        return state.runtime.commands.listApprovalDelegationCandidatesWithin(
          orm,SCOPE,actor.id);
      });
      return {data:data,meta:{actorDerived:true,fields:'business_identity_only'}};
    },
    createApprovalDelegation:async function(payload){
      payload=payload||{};
      var data=await withMyActor(function(orm,actor){
        return state.runtime.commands.createApprovalDelegationWithin(orm,SCOPE,{
          domain:String(payload.domain||'leave'),
          authorityEmployeeId:actor.id,
          delegateEmployeeId:Number(payload.delegateId),
          validFrom:new Date(String(payload.validFrom||'')),
          validTo:new Date(String(payload.validTo||'')),
          reason:String(payload.reason||''),
          createdByUserId:myActorUserId(),
        });
      });
      return {data:data,meta:{actorDerived:true}};
    },
    revokeApprovalDelegation:async function(id){
      var data=await withMyActor(function(orm,actor){
        return state.runtime.commands.revokeApprovalDelegationWithin(orm,SCOPE,{
          delegationId:Number(id),
          authorityEmployeeId:actor.id,
          actorUserId:myActorUserId(),
        });
      });
      return {data:data,meta:{actorDerived:true}};
    },
  };

  var adapter = {
    ready: ready,
    reset: reset,
    refresh: refresh,
    list: list,
    get: get,
    create: create,
    update: update,
    action: action,
    session: session,
    financeReports:financeReports,
    my:my,
    confirmOrder: confirmOrder,
    createPurchaseOrder: createPurchaseOrder,
    receiveGoods: receiveGoods,
    postSupplierInvoice: postSupplierInvoice,
    createOpportunity: createOpportunity,
    convertOpportunityToSalesOrder: convertOpportunityToSalesOrder,
    completeSetup: completeSetup,
    switchCompany: switchCompany,
    needsSetup: needsSetup,
    isSignedIn: isSignedIn,
    login: login,
    logout: logout,
    switchUser: switchUser,
    auth: {
      needsSetup:needsSetup,
      isSignedIn:isSignedIn,
      login:login,
      logout:logout,
    },
    get mode(){ return state.mode; },
    get db(){ return state.db; },
  };
  window.ErpSystemData = adapter;
  window.ErpSystemDemo = adapter;
  window.ErpSystemDataReady = ready;
  window.ErpSystemDemoReady = ready;
})();
