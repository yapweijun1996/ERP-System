#!/usr/bin/env node
// Browser smoke test (TASK-015). Serves the already-built demo bundle
// (web/dist/, from `npm run build:demo`) with `vite preview`, then drives a
// real headless browser at desktop and mobile viewports and asserts:
//   - the app boots straight to a rendered dashboard (bypassing the first-run
//     wizard and login via a pre-set localStorage flag — this is a smoke test
//     for "does the shell render", not a wizard/login flow test)
//   - zero browser console errors and zero uncaught page errors
//   - the dashboard's own content actually appears (not just "no errors")
//
// Usage: npm run build:demo && npm run smoke
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.SMOKE_PORT || '4310';
/* "localhost", not "127.0.0.1": vite preview binds only the IPv6 loopback
   ([::1]), not IPv4, so a literal 127.0.0.1 connection is refused. */
const BASE_URL = `http://localhost:${PORT}`;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

if (!existsSync(DIST_INDEX)) {
  console.error(`web/dist/index.html not found. Run "npm run build:demo" before "npm run smoke".`);
  process.exit(1);
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() < deadline) {
        try {
          const res = await fetch(url, { method: 'GET' });
          if (res) { resolve(); return; }
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 300));
      }
      reject(new Error(`${url} did not respond within ${timeoutMs}ms`));
    })();
  });
}

async function startPreviewServer() {
  const viteBin = path.join(WEB_DIR, 'node_modules', '.bin', 'vite');
  if (!existsSync(viteBin)) {
    throw new Error(`${viteBin} not found — run "npm ci --prefix web" first.`);
  }
  const proc = spawn(
    viteBin, ['preview', '--port', PORT, '--strictPort'],
    { cwd: WEB_DIR, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderrOutput = '';
  proc.stderr.on('data', (buf) => { stderrOutput += buf.toString(); });
  let exitedEarly = false;
  proc.on('exit', () => { exitedEarly = true; });

  /* Actual HTTP polling, not stdout pattern-matching — "printed the URL" and
     "actually accepting connections" are not guaranteed to be the same moment. */
  try {
    await waitForServer(BASE_URL, 15000);
  } catch (e) {
    proc.kill();
    throw exitedEarly
      ? new Error(`vite preview exited before becoming ready. stderr:\n${stderrOutput}`)
      : e;
  }
  return proc;
}

async function checkViewport(browser, viewport) {
  const errors = [];
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  /* Bypass the first-run wizard and demo login — this is a shell/dashboard
     smoke test, not a wizard/login flow test (those are covered by manual
     verification in each task's own description). Setting localStorage before
     any page script runs, then navigating, lands directly on the dashboard. */
  await page.addInitScript(() => {
    try {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
    } catch { /* ignore */ }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });

  let dashboardVisible = false;
  try {
    // Network idle does not mean the WASM database finished its cold start.
    // Keep the DOM locator alive across a possible service-worker navigation
    // and allow more than the adapter's bounded 45s fallback watchdog.
    await page.waitForSelector('.dashgrid', { timeout: 60000, state: 'visible' });
    dashboardVisible = true;
  } catch (e) {
    errors.push(`[content] .dashgrid (dashboard cards) never appeared: ${e.message}`);
  }

  const title = await page.title();
  if (!/Acme/i.test(title)) {
    errors.push(`[content] document.title "${title}" does not mention the seeded company (expected "Acme...")`);
  }

  if (viewport.name === 'desktop' && errors.length === 0) {
    const runtimeProof = await page.evaluate(async () => {
      const runtime = window.ErpDemoRuntime;
      const adapter = window.ErpSystemData;
      if (!runtime || typeof runtime.createOrm !== 'function') {
        return { error: 'bundled ErpDemoRuntime is not installed' };
      }
      if (!adapter || adapter.mode !== 'pglite' || !adapter.db) {
        return { error: `demo adapter did not boot PGlite (mode=${adapter?.mode || 'missing'})` };
      }
      const newItemSku = `SMOKE-ITEM-${Date.now()}`;
      await navigate('new-item');
      for (let attempt = 0; attempt < 50 && !document.querySelector('#niCreate'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const newItemScreenCanonical = Boolean(document.querySelector('[data-canonical-new-item="true"]'))
        && !document.querySelector('[data-preview-banner]');
      const skuField = document.querySelector('#niSku');
      const nameField = document.querySelector('#niName');
      const costField = document.querySelector('#niCost');
      const reorderField = document.querySelector('#niReorder');
      const reorderQtyField = document.querySelector('#niRoq');
      if (!skuField || !nameField || !costField || !reorderField || !reorderQtyField) {
        return { error: 'canonical new-item form fields did not render' };
      }
      skuField.value = newItemSku;
      nameField.value = 'Smoke Canonical Item';
      costField.value = '3.2500';
      reorderField.value = '5';
      reorderQtyField.value = '20';
      skuField.dispatchEvent(new Event('input', { bubbles: true }));
      nameField.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#niCreate').click();
      let newItemRow;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        newItemRow = (await adapter.db.query(
          'select id, standard_cost, reorder_point, reorder_qty from product where master_fn=$1 and company_fn=$2 and sku=$3',
          ['M1', 'C-SG', newItemSku],
        )).rows[0];
        if (newItemRow) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const newItemStockFacts = newItemRow ? (await adapter.db.query(
        'select (select count(*)::int from stock_level where product_id=$1) as levels, (select count(*)::int from stock_movement where product_id=$1) as movements',
        [newItemRow.id],
      )).rows[0] : null;
      const newItemCanonical = newItemScreenCanonical
        && Number(newItemRow?.standard_cost) === 3.25
        && Number(newItemRow?.reorder_point) === 5
        && Number(newItemRow?.reorder_qty) === 20
        && Number(newItemStockFacts?.levels) === 0
        && Number(newItemStockFacts?.movements) === 0;
      const before = Number((await adapter.db.query(
        "select coalesce(sum(s.qty),0)::float as qty from stock_level s join product p on p.id=s.product_id where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'",
      )).rows[0].qty);
      const created = await adapter.create('crm/opportunities', {
        customerCode: 'CUST1',
        title: 'ESM runtime proof',
        value: 250,
        currency: 'SGD',
        stage: 'Qualified',
        probability: 60,
        closeDate: '2026-07-31',
      });
      const opportunityNo = created.data.docNo;
      const createdRow = (await adapter.db.query(
        'select id, stage from opportunity where master_fn=$1 and company_fn=$2 and doc_no=$3',
        ['M1', 'C-SG', opportunityNo],
      )).rows[0];
      if (!createdRow || createdRow.stage !== 'qualified') {
        return { error: 'shared createOpportunity command did not preserve the selected stage' };
      }
      const converted = await adapter.action(
        'crm/opportunities',
        opportunityNo,
        'convert-to-sales-order',
        { sku: 'SG-WIDGET', qty: 1, unitPrice: 100 },
      );
      const after = Number((await adapter.db.query(
        "select coalesce(sum(s.qty),0)::float as qty from stock_level s join product p on p.id=s.product_id where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'",
      )).rows[0].qty);
      const won = (await adapter.db.query(
        'select stage, order_id from opportunity where id=$1',
        [createdRow.id],
      )).rows[0];
      const invoiceNo = `INV-${converted.data.docNo}`;
      const gl = (await adapter.db.query(
        'select coalesce(sum(debit),0)::float as debit, coalesce(sum(credit),0)::float as credit from gl_entry where master_fn=$1 and company_fn=$2 and journal_ref=$3',
        ['M1', 'C-SG', invoiceNo],
      )).rows[0];
      const purchaseBefore = after;
      const purchaseOrder = await adapter.create('purchasing/purchase-orders', {
        supplierCode: 'SUPP1',
        orderDate: '2026-07-18',
        currency: 'SGD',
        lines: [{ sku: 'SG-WIDGET', qty: 2, unitCost: 30, taxCode: 'SR' }],
      });
      await adapter.action(
        'purchasing/purchase-orders',
        purchaseOrder.data.orderId,
        'approve',
        { note: 'Smoke proof approval before stock receipt.' },
      );
      const approvedPurchase = (await adapter.db.query(
        'select po.status, pa.status as approval_status from purchase_order po join purchase_order_approval pa on pa.order_id=po.id where po.id=$1',
        [purchaseOrder.data.orderId],
      )).rows[0];
      const purchaseAfterApproval = Number((await adapter.db.query(
        "select coalesce(sum(s.qty),0)::float as qty from stock_level s join product p on p.id=s.product_id where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'",
      )).rows[0].qty);
      const receiptPosting = await adapter.action(
        'purchasing/purchase-orders',
        purchaseOrder.data.docNo,
        'receive',
        {},
      );
      const supplierPosting = await adapter.action(
        'purchasing/purchase-orders',
        purchaseOrder.data.docNo,
        'post-invoice',
        {},
      );
      let duplicateInvoiceBlocked = false;
      try {
        await adapter.action(
          'purchasing/purchase-orders',
          purchaseOrder.data.docNo,
          'post-invoice',
          {},
        );
      } catch (error) {
        duplicateInvoiceBlocked = /already has a supplier invoice/i.test(error?.message || '');
      }
      const purchaseAfter = Number((await adapter.db.query(
        "select coalesce(sum(s.qty),0)::float as qty from stock_level s join product p on p.id=s.product_id where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'",
      )).rows[0].qty);
      const purchaseGl = (await adapter.db.query(
        'select coalesce(sum(debit),0)::float as debit, coalesce(sum(credit),0)::float as credit from gl_entry where master_fn=$1 and company_fn=$2 and journal_ref=$3',
        ['M1', 'C-SG', supplierPosting.data.docNo],
      )).rows[0];
      await navigate('goods-receipt', { receiptId: receiptPosting.data.receiptId });
      const receiptDetail = document.querySelector('[data-purchasing-detail="goods-receipt"]');
      const receiptDetailCanonical = receiptDetail?.dataset.docNo === receiptPosting.data.docNo
        && Number(receiptDetail?.dataset.traceCount) === 1
        && !document.querySelector('[data-preview-banner]');
      await navigate('supplier-invoice', { invoiceId: supplierPosting.data.invoiceId });
      const invoiceDetail = document.querySelector('[data-purchasing-detail="supplier-invoice"]');
      const invoiceDetailCanonical = invoiceDetail?.dataset.docNo === supplierPosting.data.docNo
        && Number(invoiceDetail?.dataset.traceCount) === 3
        && invoiceDetail?.dataset.journalBalanced === 'true'
        && !document.querySelector('[data-preview-banner]');
      const purchasingAnalytics = await adapter.list('purchasing/analytics', { limit: 50 });
      const purchasingPriceVariance = await adapter.list('purchasing/price-variance', { limit: 50 });
      await navigate('purchasing-home');
      const purchasingScreenCanonicalSource = String(SCREENS['purchasing-home'])
        .includes('data-purchasing-analytics');
      const purchasingAnalyticsMarker = Boolean(document.querySelector('[data-purchasing-analytics="canonical"]'));
      const purchasingErrorAtCheck = document.querySelector('#viewRoot .screen-render-error')
        ?.textContent?.trim() || null;
      const purchasingAnalyticsSummary = Array.isArray(purchasingAnalytics.data)
        && purchasingAnalytics.data.some((row) => row.kind === 'summary');
      const purchasingAnalyticsMonthly = Array.isArray(purchasingAnalytics.data)
        && purchasingAnalytics.data.some((row) => row.kind === 'monthly-spend');
      const purchasingAnalyticsCanonical = purchasingAnalyticsMarker
        && !document.querySelector('[data-preview-banner]')
        && purchasingAnalyticsSummary
        && purchasingAnalyticsMonthly;
      await navigate('purchasing-reports');
      const purchasingReportsCanonical = Boolean(document.querySelector('[data-purchasing-reports="canonical"]'))
        && !document.querySelector('[data-preview-banner]')
        && Array.isArray(purchasingPriceVariance.data);
      const salesApprovalStockBefore = Number((await adapter.db.query(
        "select coalesce(sum(qty),0)::float as qty from stock_movement where master_fn='M1' and company_fn='C-SG'",
      )).rows[0].qty);
      const salesApprovalGlBefore = Number((await adapter.db.query(
        "select count(*)::int as count from gl_entry where master_fn='M1' and company_fn='C-SG'",
      )).rows[0].count);
      const salesApprovalRefs = (await adapter.db.query(
        "select c.id as customer_id, p.id as product_id from customer c cross join product p where c.master_fn='M1' and c.company_fn='C-SG' and c.code='CUST1' and p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'",
      )).rows[0];
      const directSalesOrder = await adapter.create('sales/orders', {
        docNo: 'SO-SMOKE-APPROVAL',
        customerId: Number(salesApprovalRefs.customer_id),
        orderDate: '2026-07-22',
        currency: 'SGD',
        approvalReason: 'Smoke proof for the direct-order approval boundary.',
        lines: [{
          productId: Number(salesApprovalRefs.product_id),
          qty: '3',
          unitPrice: '12.50',
          taxCode: 'SR',
        }],
      });
      await navigate('new-sales-order');
      const salesOrderAuthoringCanonical = Boolean(document.querySelector('[data-canonical-sales-order-authoring="true"]'))
        && !document.querySelector('[data-preview-banner]');
      await navigate('so-approvals');
      const salesOrderApprovalCanonical = Boolean(document.querySelector('[data-canonical-sales-order-approval="true"]'))
        && document.body.textContent.includes('SO-SMOKE-APPROVAL')
        && !document.querySelector('[data-preview-banner]');
      await adapter.action(
        'sales/orders',
        directSalesOrder.data.orderId,
        'approve',
        { note: 'Smoke reviewer confirmed the commercial order details.' },
        'smoke-sales-order-approval',
      );
      const salesApprovalState = (await adapter.db.query(
        'select so.status, soa.status as approval_status, soa.decision_note from sales_order so join sales_order_approval soa on soa.order_id=so.id where so.id=$1',
        [directSalesOrder.data.orderId],
      )).rows[0];
      const salesApprovalStockAfter = Number((await adapter.db.query(
        "select coalesce(sum(qty),0)::float as qty from stock_movement where master_fn='M1' and company_fn='C-SG'",
      )).rows[0].qty);
      const salesApprovalGlAfter = Number((await adapter.db.query(
        "select count(*)::int as count from gl_entry where master_fn='M1' and company_fn='C-SG'",
      )).rows[0].count);
      const workspaceEnquiry = await adapter.create('sales/enquiries', {
        docNo: 'ENQ-SMOKE-WORKSPACE',
        customerId: Number(salesApprovalRefs.customer_id),
        subject: 'Canonical enquiry workspace browser proof',
        channel: 'web',
        estimatedValue: '37.50',
        currency: 'SGD',
        ownerName: 'Smoke Sales',
        enquiryDate: '2026-07-22',
      });
      const workspaceConversion = await adapter.action(
        'sales/enquiries',
        workspaceEnquiry.data.id,
        'convert-to-quotation',
        {
          docNo: 'Q-SMOKE-WORKSPACE',
          quoteDate: '2026-07-22',
          validUntil: '2026-08-22',
          currency: 'SGD',
          probability: '50',
          lines: [{
            productId: Number(salesApprovalRefs.product_id),
            qty: '1',
            unitPrice: '37.50',
            taxCode: 'SR',
          }],
        },
        'smoke-enquiry-workspace-convert',
      );
      await openTxn('enquiry', { id: workspaceEnquiry.data.id });
      const salesTransaction = document.querySelector('[data-sales-transaction="canonical"]');
      const salesTransactionCanonical = Number(salesTransaction?.dataset.recordId) === Number(workspaceEnquiry.data.id)
        && Number(salesTransaction?.dataset.relatedCount) === 1
        && document.body.textContent.includes('ENQ-SMOKE-WORKSPACE')
        && document.body.textContent.includes('Q-SMOKE-WORKSPACE')
        && Number(workspaceConversion.data.quotationId) > 0
        && !document.querySelector('[data-preview-banner]');
      const draftStockBefore = (await adapter.db.query(
        "select p.sku, s.qty::float as qty from stock_level s join product p on p.id=s.product_id join warehouse w on w.id=s.warehouse_id where p.master_fn='M1' and p.company_fn='C-SG' and w.code='WH-SALES' and p.sku in ('SG-WIDGET','SG-GADGET') order by p.sku",
      )).rows;
      const salesPosting = await adapter.action(
        'sales/orders',
        'SO-2',
        'confirm',
        {},
        'smoke-confirm-SO-2',
      );
      let duplicateSalesConfirmBlocked = false;
      try {
        await adapter.action(
          'sales/orders',
          'SO-2',
          'confirm',
          {},
          'smoke-confirm-SO-2-duplicate',
        );
      } catch (error) {
        duplicateSalesConfirmBlocked = /not 'draft'/i.test(error?.message || '');
      }
      const draftStockAfter = (await adapter.db.query(
        "select p.sku, s.qty::float as qty from stock_level s join product p on p.id=s.product_id join warehouse w on w.id=s.warehouse_id where p.master_fn='M1' and p.company_fn='C-SG' and w.code='WH-SALES' and p.sku in ('SG-WIDGET','SG-GADGET') order by p.sku",
      )).rows;
      const salesGl = (await adapter.db.query(
        'select coalesce(sum(debit),0)::float as debit, coalesce(sum(credit),0)::float as credit from gl_entry where master_fn=$1 and company_fn=$2 and journal_ref=$3',
        ['M1', 'C-SG', salesPosting.data.invDocNo],
      )).rows[0];
      let insufficientDraftBlocked = false;
      try {
        await adapter.action(
          'sales/orders',
          'SO-3',
          'confirm',
          {},
          'smoke-confirm-SO-3',
        );
      } catch (error) {
        insufficientDraftBlocked = error?.name === 'InsufficientStockError'
          || /insufficient stock/i.test(error?.message || '');
      }
      const overstockDraft = (await adapter.db.query(
        "select status, version from sales_order where master_fn='M1' and company_fn='C-SG' and doc_no='SO-3'",
      )).rows[0];
      const salesAnalytics = await adapter.list('sales/analytics', { limit: 100 });
      await navigate('sales-home');
      const salesAnalyticsCanonical = Boolean(document.querySelector('[data-sales-analytics="canonical"]'))
        && !document.querySelector('[data-preview-banner]')
        && salesAnalytics.data.some((row) => row.kind === 'summary' && Number(row.recognizedRevenue) > 0)
        && salesAnalytics.data.some((row) => row.kind === 'customer-revenue');
      await navigate('sales-reports');
      const salesReportsCanonical = Boolean(document.querySelector('[data-sales-reports="canonical"]'))
        && !document.querySelector('[data-preview-banner]');
      const reportMarkers = [];
      for (const route of ['report-sales-customer', 'report-sales-rep', 'report-quote-conversion', 'report-generic']) {
        await navigate(route);
        reportMarkers.push(Boolean(document.querySelector('[data-sales-report]'))
          && !document.querySelector('[data-preview-banner]'));
      }
      const commissionPeople = await adapter.list('sales/salespeople', { limit: 100 });
      const commissionPerson = commissionPeople.data.find((row) => row.email === 'admin@example.test')
        || commissionPeople.data[0];
      const commissionPlan = await adapter.create('sales/commission-plans', {
        code: 'COMM-SMOKE-2024',
        name: 'Smoke recognized revenue plan',
        salespersonUserId: Number(commissionPerson.userId),
        ratePct: '5',
        effectiveFrom: '2024-01-01',
        effectiveTo: '2024-12-31',
      });
      await adapter.action(
        'sales/commission-plans',
        commissionPlan.data.id,
        'activate',
        {},
        'smoke-commission-plan-activate',
      );
      const commissionRun = await adapter.create('sales/commission-runs', {
        docNo: 'COMRUN-SMOKE-2024-06',
        periodStart: '2024-06-01',
        periodEnd: '2024-06-30',
        currency: 'SGD',
      });
      const commissionGlBefore = Number((await adapter.db.query(
        "select count(*)::int as count from gl_entry where master_fn='M1' and company_fn='C-SG'",
      )).rows[0].count);
      await adapter.action(
        'sales/commission-runs',
        commissionRun.data.id,
        'approve',
        { note: 'Smoke reviewer verified every immutable source document.' },
        'smoke-commission-run-approve',
      );
      const commissionGlAfter = Number((await adapter.db.query(
        "select count(*)::int as count from gl_entry where master_fn='M1' and company_fn='C-SG'",
      )).rows[0].count);
      const commissionLines = await adapter.list('sales/commission-lines', {
        limit: 100,
        runId: commissionRun.data.id,
      });
      const commissionSources = await adapter.list('sales/commission-sources', {
        limit: 100,
        runId: commissionRun.data.id,
      });
      await navigate('sales-commission');
      const commissionCanonical = Boolean(document.querySelector('[data-sales-commission="canonical"]'))
        && !document.querySelector('[data-preview-banner]')
        && document.body.textContent.includes('COMRUN-SMOKE-2024-06');
      const financeAccounts = await adapter.list('finance/accounts', { limit: 100 });
      const arAccount = financeAccounts.data.find((row) => row.code === '1100');
      const revenueAccount = financeAccounts.data.find((row) => row.code === '4000');
      const manualJournal = await adapter.create('finance/journals', {
        docNo: 'MJ-SMOKE-1', postingDate: '2026-07-22', journalType: 'standard',
        memo: 'Smoke manual journal', reference: 'SMOKE',
        lines: [
          { accountId: arAccount.id, dimension: 'SG', debit: '42.50', credit: '0' },
          { accountId: revenueAccount.id, dimension: 'SG', debit: '0', credit: '42.50' },
        ],
      });
      const manualBefore = Number((await adapter.db.query(
        "select count(*)::int as count from gl_entry where master_fn='M1' and company_fn='C-SG' and journal_ref='MJ-SMOKE-1'",
      )).rows[0].count);
      await adapter.action('finance/journals', manualJournal.data.id, 'post', {}, 'smoke-manual-post');
      const manualPosting = (await adapter.db.query(
        "select count(*)::int as count, coalesce(sum(debit),0)::float as debit, coalesce(sum(credit),0)::float as credit from gl_entry where master_fn='M1' and company_fn='C-SG' and journal_ref='MJ-SMOKE-1'",
      )).rows[0];
      const reversedManual = await adapter.action(
        'finance/journals', manualJournal.data.id, 'reverse',
        { docNo: 'MJ-SMOKE-REV-1', postingDate: '2026-07-23', reason: 'Smoke correction' },
        'smoke-manual-reverse',
      );
      const reversalPosting = (await adapter.db.query(
        "select count(*)::int as count, coalesce(sum(debit),0)::float as debit, coalesce(sum(credit),0)::float as credit from gl_entry where master_fn='M1' and company_fn='C-SG' and journal_ref='MJ-SMOKE-REV-1'",
      )).rows[0];
      await navigate('new-journal-entry');
      const manualJournalComposerCanonical = Boolean(document.querySelector('[data-manual-journal="canonical"]'))
        && !document.querySelector('[data-preview-banner]');
      await navigate('journal-entry', { no: 'MJ-SMOKE-REV-1' });
      const manualJournalDetailCanonical = Boolean(document.querySelector('[data-manual-journal-detail="canonical"]'))
        && !document.querySelector('[data-manual-journal-reverse]');
      const bankAccount = financeAccounts.data.find((row) => row.code === '1000');
      const bankJournal = await adapter.create('finance/journals', {
        docNo: 'MJ-SMOKE-BANK-1', postingDate: '2026-07-22', journalType: 'standard',
        memo: 'Smoke bank receipt for reconciliation', reference: 'BANK-SMOKE',
        lines: [
          { accountId: bankAccount.id, dimension: 'SG', debit: '17.25', credit: '0' },
          { accountId: revenueAccount.id, dimension: 'SG', debit: '0', credit: '17.25' },
        ],
      });
      await adapter.action('finance/journals', bankJournal.data.id, 'post', {}, 'smoke-bank-journal-post');
      const bankGl = await adapter.list('finance/gl-entries', { limit: 100, accountId: bankAccount.id });
      const bankLeg = bankGl.data.find((row) => row.journalRef === 'MJ-SMOKE-BANK-1');
      const bankStatement = await adapter.create('finance/bank-statements', {
        statementNo: 'BS-SMOKE-1', bankAccountId: bankAccount.id, currency: 'SGD',
        periodStart: '2026-07-01', periodEnd: '2026-07-31',
        openingBalance: '0.00', closingBalance: '17.25',
        lines: [{
          transactionDate: '2026-07-22', reference: 'BANK-SMOKE',
          description: 'Smoke customer receipt', amount: '17.25',
        }],
      });
      const bankLines = await adapter.list('finance/bank-statement-lines', {
        limit: 100, statementId: bankStatement.data.id,
      });
      await adapter.action(
        'finance/bank-statement-lines', bankLines.data[0].id, 'match',
        { glEntryId: bankLeg.id }, 'smoke-bank-match',
      );
      const bankReconciled = await adapter.action(
        'finance/bank-statements', bankStatement.data.id, 'reconcile', {}, 'smoke-bank-reconcile',
      );
      await navigate('bank-rec', { statementId: bankStatement.data.id });
      const bankReconciliationCanonical = Boolean(document.querySelector('[data-bank-reconciliation="canonical"]'))
        && document.querySelector('[data-bank-status="reconciled"]')
        && document.body.textContent.includes('BS-SMOKE-1')
        && !document.querySelector('[data-preview-banner]');
      const reportingAnalytics = await adapter.list('bi/analytics', { limit: 100 });
      await navigate('bi-dashboard');
      const biDashboardCanonical = Boolean(document.querySelector('[data-bi-dashboard="canonical"]'))
        && !document.querySelector('[data-preview-banner]');
      await navigate('sales-analysis');
      const biSalesAnalysisCanonical = Boolean(document.querySelector('[data-bi-sales-analysis="canonical"]'))
        && !document.querySelector('[data-preview-banner]');
      await navigate('stock-aging');
      const biStockAgingCanonical = Boolean(document.querySelector('[data-bi-stock-aging="canonical"]'))
        && !document.querySelector('[data-preview-banner]');
      const timeProjects = await adapter.list('project/projects', { limit: 100 });
      const openTimeProject = timeProjects.data.find((row) => row.status === 'open');
      if (!openTimeProject) return { error: 'no open project is available for the timesheet smoke proof' };
      const timeEntry = await adapter.create('project/time-entries', {
        projectId: openTimeProject.id,
        workDate: '2026-07-23',
        task: 'Smoke commissioning review',
        hours: '2.50',
      });
      await navigate('timesheet', { weekStart: '2026-07-20' });
      for (let attempt = 0; attempt < 50 && !document.querySelector('[data-canonical-timesheet="true"]'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const timesheetBeforeVoid = Boolean(document.querySelector('[data-canonical-timesheet="true"]'))
        && document.body.textContent.includes('Smoke commissioning review')
        && !document.querySelector('[data-preview-banner]');
      const timeVoided = await adapter.action(
        'project/time-entries', timeEntry.data.id, 'void',
        { reason: 'Smoke correction keeps the original fact.' },
        `smoke-void-time-${timeEntry.data.id}`,
      );
      await navigate('timesheet', { weekStart: '2026-07-20' });
      for (let attempt = 0; attempt < 50 && !document.querySelector('[data-canonical-timesheet="true"]'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const storedTimeEntry = (await adapter.db.query(
        'select actor_user_id, hours, status, version, void_reason from project_time_entry where master_fn=$1 and company_fn=$2 and id=$3',
        ['M1', 'C-SG', timeEntry.data.id],
      )).rows[0];
      const signedInUser = (await adapter.db.query(
        'select user_id from app_user where master_fn=$1 and email=$2',
        ['M1', 'admin@acme.co'],
      )).rows[0];
      const timesheetCanonical = timesheetBeforeVoid
        && document.body.textContent.includes('Smoke commissioning review')
        && document.body.textContent.includes('Voided')
        && timeVoided.data.status === 'voided'
        && Number(storedTimeEntry?.actor_user_id) === Number(signedInUser?.user_id)
        && Number(storedTimeEntry?.hours) === 2.5
        && storedTimeEntry?.status === 'voided'
        && Number(storedTimeEntry?.version) === 2
        && storedTimeEntry?.void_reason === 'Smoke correction keeps the original fact.';
      await adapter.db.query(
        "insert into outbox_event (master_fn,company_fn,topic,aggregate_type,aggregate_id,payload,attempts,delivered_at) values ($1,$2,$3,$4,$5,$6::jsonb,1,now())",
        ['M1', 'C-SG', 'smoke.delivery.completed', 'smoke_proof', '81', JSON.stringify({ token: 'SMOKE-SECRET-MUST-NOT-RENDER' })],
      );
      const integrationEvents = await adapter.list('integration/events', { limit: 100 });
      await navigate('integration-logs');
      for (let attempt = 0; attempt < 50 && !document.querySelector('[data-integration-events-canonical="true"]'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const integrationLogCanonical = Boolean(document.querySelector('[data-integration-events-canonical="true"]'))
        && document.body.textContent.includes('smoke.delivery.completed')
        && !document.body.textContent.includes('SMOKE-SECRET-MUST-NOT-RENDER')
        && !JSON.stringify(integrationEvents).includes('SMOKE-SECRET-MUST-NOT-RENDER')
        && !document.querySelector('[data-preview-banner]');
      const importCode = `SMOKE-CUST-${Date.now()}`;
      const customerImport = await adapter.create('integration/import-jobs', {
        fileName: 'smoke-customers.csv',
        duplicateStrategy: 'update_existing',
        rows: [
          { code: importCode, name: 'Smoke Fictional Customer', industry: 'Testing' },
          { code: '', name: 'Persisted invalid row' },
        ],
      });
      await navigate('data-import');
      for (let attempt = 0; attempt < 50 && !document.querySelector('[data-customer-import-canonical="true"]'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const customerImportBeforeRun = Boolean(document.querySelector('[data-customer-import-canonical="true"]'))
        && document.body.textContent.includes('smoke-customers.csv')
        && !document.querySelector('[data-preview-banner]');
      const customerImportCompleted = await adapter.action(
        'integration/import-jobs', customerImport.data.id, 'run', {},
        `smoke-customer-import-${customerImport.data.id}`,
      );
      await navigate('data-import');
      for (let attempt = 0; attempt < 50 && !document.body.textContent.includes('Smoke Fictional Customer'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const importedCustomer = (await adapter.db.query(
        'select code, name from customer where master_fn=$1 and company_fn=$2 and code=$3',
        ['M1', 'C-SG', importCode],
      )).rows[0];
      const persistedImportError = (await adapter.db.query(
        'select error_code from import_row_error where master_fn=$1 and company_fn=$2 and job_id=$3',
        ['M1', 'C-SG', customerImport.data.id],
      )).rows[0];
      const customerImportCanonical = customerImportBeforeRun
        && customerImportCompleted.data.status === 'completed'
        && Number(customerImportCompleted.data.importedRows) === 1
        && Number(customerImportCompleted.data.errorRows) === 1
        && importedCustomer?.name === 'Smoke Fictional Customer'
        && persistedImportError?.error_code === 'required'
        && document.body.textContent.includes('Smoke Fictional Customer')
        && !document.querySelector('[data-preview-banner]');
      const setup = await adapter.completeSetup({
        organizationCode: 'SMOKE-ORG',
        companyName: 'Smoke Setup Malaysia',
        country: 'MY',
        adminName: 'Smoke Administrator',
        adminUsername: 'smoke.admin',
        adminEmail: 'smoke.setup@example.test',
        adminPassword: 'smoke-pass-123',
        language: 'vi',
      });
      const setupCompany = (await adapter.db.query(
        'select country, currency, tax_regime, locale from company where master_fn=$1 and company_fn=$2',
        ['M1', setup.companyFn],
      )).rows[0];
      const setupAccountCount = Number((await adapter.db.query(
        'select count(*)::int as n from account where master_fn=$1 and company_fn=$2',
        ['M1', setup.companyFn],
      )).rows[0].n);
      const setupAdmin = (await adapter.db.query(
        `select app_user.username, app_user.password_hash, app_user.language,
                master.login_code,
                count(user_company_role.role_id)::int as role_count
         from app_user
         join master on master.master_fn = app_user.master_fn
         join user_company_role on user_company_role.user_id = app_user.user_id
           and user_company_role.company_fn = $3
         where app_user.master_fn=$1 and app_user.email=$2
         group by app_user.user_id, master.login_code`,
        ['M1', 'smoke.setup@example.test', setup.companyFn],
      )).rows[0];
      const stockBySku = (rows) => Object.fromEntries(rows.map((row) => [row.sku, Number(row.qty)]));
      const draftBeforeBySku = stockBySku(draftStockBefore);
      const draftAfterBySku = stockBySku(draftStockAfter);
      return {
        error: null,
        newItemCanonical,
        stockDelta: after - before,
        won: won?.stage === 'won' && Number(won.order_id) === Number(converted.data.orderId),
        balanced: Number(gl.debit) === Number(gl.credit) && Number(gl.debit) > 0,
        purchaseStockDelta: purchaseAfter - purchaseBefore,
        purchaseApprovalNoStock: approvedPurchase?.status === 'open'
          && approvedPurchase?.approval_status === 'approved'
          && purchaseAfterApproval === purchaseBefore,
        purchaseBalanced: Number(purchaseGl.debit) === Number(purchaseGl.credit) && Number(purchaseGl.debit) > 0,
        receiptDetailCanonical,
        invoiceDetailCanonical,
        purchasingAnalyticsCanonical,
        purchasingAnalyticsMarker,
        purchasingAnalyticsSummary,
        purchasingAnalyticsMonthly,
        purchasingScreenCanonicalSource,
        purchasingErrorAtCheck,
        purchasingReportsCanonical,
        salesOrderAuthoringCanonical,
        salesOrderApprovalCanonical,
        salesTransactionCanonical,
        salesAnalyticsCanonical,
        salesReportsCanonical,
        salesReportRoutesCanonical: reportMarkers.every(Boolean),
        commissionCanonical,
        commissionTrace: Number(commissionRun.data.sourceCount) === commissionSources.data.length
          && commissionSources.data.length >= 2
          && commissionLines.data.length === 1
          && Number(commissionRun.data.commissionAmount) > 0
          && commissionGlAfter === commissionGlBefore,
        manualJournalCanonical: manualJournalComposerCanonical && manualJournalDetailCanonical
          && manualBefore === 0
          && Number(manualPosting.count) === 2
          && Number(manualPosting.debit) === 42.5
          && Number(manualPosting.credit) === 42.5
          && reversedManual.data.original.status === 'reversed'
          && Number(reversalPosting.count) === 2
          && Number(reversalPosting.debit) === 42.5
          && Number(reversalPosting.credit) === 42.5,
        bankReconciliationCanonical: bankReconciliationCanonical
          && bankReconciled.data.status === 'reconciled'
          && Number(bankReconciled.data.matchedLineCount) === 1,
        reportingAnalyticsCanonical: biDashboardCanonical
          && biSalesAnalysisCanonical
          && biStockAgingCanonical
          && reportingAnalytics.data.some((row) => row.kind === 'summary'
            && Number(row.recognizedRevenue) > 0
            && Number(row.inventoryValue) > 0)
          && reportingAnalytics.data.some((row) => row.kind === 'sales-category'
            && Number(row.productRevenue) > 0)
          && reportingAnalytics.data.some((row) => row.kind === 'stock-aging'
            && Number(row.inventoryValue) > 0),
        timesheetCanonical,
        integrationLogCanonical,
        customerImportCanonical,
        salesApprovalBoundary: salesApprovalState?.status === 'draft'
          && salesApprovalState?.approval_status === 'approved'
          && salesApprovalState?.decision_note === 'Smoke reviewer confirmed the commercial order details.'
          && salesApprovalStockAfter === salesApprovalStockBefore
          && salesApprovalGlAfter === salesApprovalGlBefore,
        duplicateInvoiceBlocked,
        salesDraftWidgetDelta: draftAfterBySku['SG-WIDGET'] - draftBeforeBySku['SG-WIDGET'],
        salesDraftGadgetDelta: draftAfterBySku['SG-GADGET'] - draftBeforeBySku['SG-GADGET'],
        salesDraftBalanced: Number(salesGl.debit) === Number(salesGl.credit) && Number(salesGl.debit) > 0,
        duplicateSalesConfirmBlocked,
        insufficientDraftBlocked,
        overstockDraftUntouched: overstockDraft?.status === 'draft' && Number(overstockDraft?.version) === 1,
        setupCanonical: setupCompany?.country === 'MY'
          && setupCompany?.currency === 'MYR'
          && setupCompany?.tax_regime === 'SST'
          && setupCompany?.locale === 'vi'
          && setupAccountCount === 11
          && setupAdmin?.username === 'smoke.admin'
          && setupAdmin?.login_code === 'SMOKE-ORG'
          && Number(setupAdmin?.role_count) === 1
          && setupAdmin?.language === 'vi'
          && /^pbkdf2\$/.test(setupAdmin?.password_hash || '')
          && setupAdmin?.password_hash !== 'smoke-pass-123',
      };
    }).catch((error) => ({ error: error.message || String(error) }));
    if (runtimeProof.error) {
      errors.push(`[demo-esm] ${runtimeProof.error}`);
    } else {
      if (!runtimeProof.newItemCanonical) {
        errors.push('[demo-esm] new-item did not create audited canonical product master data with zero opening stock');
      }
      if (runtimeProof.stockDelta !== -1) errors.push(`[demo-esm] expected stock delta -1, got ${runtimeProof.stockDelta}`);
      if (!runtimeProof.won) errors.push('[demo-esm] CRM opportunity was not atomically marked won and linked to its order');
      if (!runtimeProof.balanced) errors.push('[demo-esm] converted opportunity did not produce balanced GL entries');
      if (runtimeProof.purchaseStockDelta !== 2) errors.push(`[demo-esm] expected purchase stock delta +2, got ${runtimeProof.purchaseStockDelta}`);
      if (!runtimeProof.purchaseApprovalNoStock) errors.push('[demo-esm] PO approval did not stay stock-neutral');
      if (!runtimeProof.purchaseBalanced) errors.push('[demo-esm] supplier invoice did not produce balanced GL entries');
      if (!runtimeProof.receiptDetailCanonical) errors.push('[demo-esm] goods-receipt detail did not render its canonical stock trace');
      if (!runtimeProof.invoiceDetailCanonical) errors.push('[demo-esm] supplier-invoice detail did not render its balanced canonical GL trace');
      if (!runtimeProof.purchasingAnalyticsCanonical) {
        errors.push(`[demo-esm] purchasing dashboard did not render its canonical derived analytics (source=${runtimeProof.purchasingScreenCanonicalSource}, marker=${runtimeProof.purchasingAnalyticsMarker}, summary=${runtimeProof.purchasingAnalyticsSummary}, monthly=${runtimeProof.purchasingAnalyticsMonthly}, error=${runtimeProof.purchasingErrorAtCheck || 'none'})`);
      }
      if (!runtimeProof.purchasingReportsCanonical) errors.push('[demo-esm] purchasing reports did not render from canonical derived resources');
      if (!runtimeProof.salesOrderAuthoringCanonical) errors.push('[demo-esm] new sales order did not render its Canonical authoring workspace');
      if (!runtimeProof.salesOrderApprovalCanonical) errors.push('[demo-esm] sales order approval queue did not render the created canonical order');
      if (!runtimeProof.salesTransactionCanonical) errors.push('[demo-esm] sales txn-view did not render its selected canonical enquiry and linked quotation');
      if (!runtimeProof.salesAnalyticsCanonical) errors.push('[demo-esm] sales dashboard did not render canonical derived analytics');
      if (!runtimeProof.salesReportsCanonical || !runtimeProof.salesReportRoutesCanonical) {
        errors.push('[demo-esm] one or more sales analytics reports did not render as Canonical routes');
      }
      if (!runtimeProof.commissionCanonical || !runtimeProof.commissionTrace) {
        errors.push('[demo-esm] Sales commission did not render an immutable canonical source trace without GL posting');
      }
      if (!runtimeProof.manualJournalCanonical) {
        errors.push('[demo-esm] manual journal draft/post/reversal or its Canonical composer/detail boundary failed');
      }
      if (!runtimeProof.bankReconciliationCanonical) {
        errors.push('[demo-esm] bank statement import/match/reconcile or its Canonical screen boundary failed');
      }
      if (!runtimeProof.reportingAnalyticsCanonical) {
        errors.push('[demo-esm] Reporting/BI did not rebuild and render canonical management, category and stock-aging facts');
      }
      if (!runtimeProof.timesheetCanonical) {
        errors.push('[demo-esm] timesheet did not preserve an actor-owned Decimal entry and auditable void in its Canonical screen');
      }
      if (!runtimeProof.integrationLogCanonical) {
        errors.push('[demo-esm] integration log did not render bounded sanitized transactional outbox facts');
      }
      if (!runtimeProof.customerImportCanonical) {
        errors.push('[demo-esm] customer CSV import did not persist validation facts and atomically import ready rows');
      }
      if (!runtimeProof.salesApprovalBoundary) errors.push('[demo-esm] sales approval did not preserve the no-stock/no-GL boundary');
      if (!runtimeProof.duplicateInvoiceBlocked) errors.push('[demo-esm] duplicate supplier invoice was not blocked');
      if (runtimeProof.salesDraftWidgetDelta !== -5 || runtimeProof.salesDraftGadgetDelta !== -3) {
        errors.push(`[demo-esm] expected draft sales stock deltas -5/-3, got ${runtimeProof.salesDraftWidgetDelta}/${runtimeProof.salesDraftGadgetDelta}`);
      }
      if (!runtimeProof.salesDraftBalanced) errors.push('[demo-esm] draft sales confirmation did not produce balanced GL entries');
      if (!runtimeProof.duplicateSalesConfirmBlocked) errors.push('[demo-esm] duplicate draft sales confirmation was not blocked');
      if (!runtimeProof.insufficientDraftBlocked || !runtimeProof.overstockDraftUntouched) {
        errors.push('[demo-esm] insufficient draft confirmation did not roll back to untouched draft state');
      }
      if (!runtimeProof.setupCanonical) {
        errors.push('[demo-esm] setup did not create canonical MY company, accounts and hashed admin through the shared command');
      }
    }

    const offlineAssets = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator) || !('caches' in window)) return [];
      await navigator.serviceWorker.ready;
      const keys = await caches.keys();
      const requests = (await Promise.all(keys.map(async (key) => {
        const cache = await caches.open(key);
        return cache.keys();
      }))).flat();
      return requests.map((request) => new URL(request.url).pathname);
    });
    for (const expected of [
      /erp-demo-runtime-impl-.*\.js$/,
      /pglite-.*\.wasm$/,
      /pglite-.*\.data$/,
    ]) {
      if (!offlineAssets.some((pathname) => expected.test(pathname))) {
        errors.push(`[offline] service worker did not precache ${expected}`);
      }
    }
  }

  await context.close();
  return { viewport: viewport.name, dashboardVisible, title, errors };
}

let previewProc;
let exitCode = 0;
try {
  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      console.log(`Starting vite preview on ${BASE_URL} (serving web/dist/)...`);
      previewProc = await startPreviewServer();
      console.log(`Checking ${viewport.name} (${viewport.width}x${viewport.height})...`);
      try {
        const result = await checkViewport(browser, viewport);
        if (result.errors.length) {
          exitCode = 1;
          console.error(`FAIL [${result.viewport}] title="${result.title}" dashboardVisible=${result.dashboardVisible}`);
          for (const e of result.errors) console.error(`  ${e}`);
        } else {
          console.log(`PASS [${result.viewport}] title="${result.title}" — dashboard rendered, zero console/page errors.`);
        }
      } finally {
        if (previewProc) {
          const stopped = new Promise((resolve) => previewProc.once('exit', resolve));
          previewProc.kill();
          if (previewProc.exitCode == null) await stopped;
          previewProc = null;
        }
      }
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  console.error('Smoke test crashed:', e.message);
  exitCode = 1;
} finally {
  if (previewProc) previewProc.kill();
}

console.log(exitCode === 0 ? '\nSmoke test PASSED ✅' : '\nSmoke test FAILED ❌');
process.exit(exitCode);
