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
    // and allow more than the adapter's bounded 20s fallback watchdog.
    await page.waitForSelector('.dashgrid', { timeout: 45000, state: 'visible' });
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
      const purchasingAnalyticsCanonical = Boolean(document.querySelector('[data-purchasing-analytics="canonical"]'))
        && !document.querySelector('[data-preview-banner]')
        && Array.isArray(purchasingAnalytics.data)
        && purchasingAnalytics.data.some((row) => row.kind === 'summary')
        && purchasingAnalytics.data.some((row) => row.kind === 'monthly-spend');
      await navigate('purchasing-reports');
      const purchasingReportsCanonical = Boolean(document.querySelector('[data-purchasing-reports="canonical"]'))
        && !document.querySelector('[data-preview-banner]')
        && Array.isArray(purchasingPriceVariance.data);
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
      const setup = await adapter.completeSetup({
        companyName: 'Smoke Setup Malaysia',
        country: 'MY',
        adminName: 'Smoke Administrator',
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
        'select password_hash, language from app_user where master_fn=$1 and email=$2',
        ['M1', 'smoke.setup@example.test'],
      )).rows[0];
      const stockBySku = (rows) => Object.fromEntries(rows.map((row) => [row.sku, Number(row.qty)]));
      const draftBeforeBySku = stockBySku(draftStockBefore);
      const draftAfterBySku = stockBySku(draftStockAfter);
      return {
        error: null,
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
        purchasingReportsCanonical,
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
          && setupAdmin?.language === 'vi'
          && /^pbkdf2\$/.test(setupAdmin?.password_hash || '')
          && setupAdmin?.password_hash !== 'smoke-pass-123',
      };
    }).catch((error) => ({ error: error.message || String(error) }));
    if (runtimeProof.error) {
      errors.push(`[demo-esm] ${runtimeProof.error}`);
    } else {
      if (runtimeProof.stockDelta !== -1) errors.push(`[demo-esm] expected stock delta -1, got ${runtimeProof.stockDelta}`);
      if (!runtimeProof.won) errors.push('[demo-esm] CRM opportunity was not atomically marked won and linked to its order');
      if (!runtimeProof.balanced) errors.push('[demo-esm] converted opportunity did not produce balanced GL entries');
      if (runtimeProof.purchaseStockDelta !== 2) errors.push(`[demo-esm] expected purchase stock delta +2, got ${runtimeProof.purchaseStockDelta}`);
      if (!runtimeProof.purchaseApprovalNoStock) errors.push('[demo-esm] PO approval did not stay stock-neutral');
      if (!runtimeProof.purchaseBalanced) errors.push('[demo-esm] supplier invoice did not produce balanced GL entries');
      if (!runtimeProof.receiptDetailCanonical) errors.push('[demo-esm] goods-receipt detail did not render its canonical stock trace');
      if (!runtimeProof.invoiceDetailCanonical) errors.push('[demo-esm] supplier-invoice detail did not render its balanced canonical GL trace');
      if (!runtimeProof.purchasingAnalyticsCanonical) errors.push('[demo-esm] purchasing dashboard did not render its canonical derived analytics');
      if (!runtimeProof.purchasingReportsCanonical) errors.push('[demo-esm] purchasing reports did not render from canonical derived resources');
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
  console.log(`Starting vite preview on ${BASE_URL} (serving web/dist/)...`);
  previewProc = await startPreviewServer();

  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      console.log(`Checking ${viewport.name} (${viewport.width}x${viewport.height})...`);
      const result = await checkViewport(browser, viewport);
      if (result.errors.length) {
        exitCode = 1;
        console.error(`FAIL [${result.viewport}] title="${result.title}" dashboardVisible=${result.dashboardVisible}`);
        for (const e of result.errors) console.error(`  ${e}`);
      } else {
        console.log(`PASS [${result.viewport}] title="${result.title}" — dashboard rendered, zero console/page errors.`);
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
