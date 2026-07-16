// Production API server (TASK-011, EPIC-005). Scaffold: GET /health + GET /api/dashboard
// against PostgreSQL via DATABASE_URL, using the SAME schema/repo code as the demo and
// src/demo.ts's proof script — no second query dialect to maintain.
//
// This is the server-side counterpart the frontend's erp-system-api-adapter.js
// (VITE_DATA_MODE=api) expects at its `{base}/health` check. Run:
//   DATABASE_URL=postgres://user:pass@host:5432/db PORT=3000 npm run server
//
// NOT YET DONE (tracked separately, see docs/STATUS.md): write endpoints
// (confirmOrder/completeSetup/switchCompany — the contract is defined in
// erp-system-api-adapter.js), session-derived tenant scope (TASK-024 auth; this
// scaffold accepts masterFn/companyFn as query params, which is fine for a health
// probe but must never ship like this for a write endpoint), Docker packaging
// (TASK-012) — including whether web reaches api same-origin through a reverse
// proxy (matches erp-system-api-adapter.js's default relative '/api' base) or
// needs CORS enabled here for a cross-origin browser fetch.
import express from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { createPostgresDb, type DB } from './data/db';
import { listCompanies } from './data/repo';
import { product, stockLevel, salesOrder, invoice, account, glEntry } from './data/schema';

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[erp-system-api] DATABASE_URL is required. Example:');
  console.error('  DATABASE_URL=postgres://user:pass@localhost:5432/erp_system npm run server');
  process.exit(1);
}

const db = await createPostgresDb(DATABASE_URL);

async function countProducts(masterFn: string, companyFn: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(product)
    .where(and(eq(product.masterFn, masterFn), eq(product.companyFn, companyFn)));
  return r?.n ?? 0;
}

async function openOrders(masterFn: string, companyFn: string) {
  const [r] = await db
    .select({
      count: sql<number>`count(*)::int`,
      value: sql<number>`coalesce(sum(${salesOrder.totalAmount}),0)::float`,
    })
    .from(salesOrder)
    .where(and(
      eq(salesOrder.masterFn, masterFn),
      eq(salesOrder.companyFn, companyFn),
      eq(salesOrder.status, 'draft'),
    ));
  return { count: r?.count ?? 0, value: r?.value ?? 0 };
}

async function openReceivables(masterFn: string, companyFn: string) {
  const [r] = await db
    .select({
      count: sql<number>`count(*)::int`,
      value: sql<number>`coalesce(sum(${invoice.totalAmount}),0)::float`,
    })
    .from(invoice)
    .where(and(
      eq(invoice.masterFn, masterFn),
      eq(invoice.companyFn, companyFn),
      eq(invoice.status, 'unpaid'),
    ));
  return { count: r?.count ?? 0, value: r?.value ?? 0 };
}

/** Net revenue (credit - debit) on the '4000' Revenue account — mirrors demo.ts's glBalance style. */
async function revenueTotal(masterFn: string, companyFn: string): Promise<number> {
  const [r] = await db
    .select({ net: sql<number>`coalesce(sum(${glEntry.credit}) - sum(${glEntry.debit}),0)::float` })
    .from(glEntry)
    .innerJoin(account, eq(account.id, glEntry.accountId))
    .where(and(
      eq(glEntry.masterFn, masterFn),
      eq(glEntry.companyFn, companyFn),
      eq(account.code, '4000'),
    ));
  return r?.net ?? 0;
}

/** Products whose total on-hand across warehouses is at or below a low-stock threshold. */
async function stockAlerts(masterFn: string, companyFn: string, threshold = 20) {
  return db
    .select({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      onHand: sql<number>`coalesce(sum(${stockLevel.qty}),0)::float`,
    })
    .from(product)
    .leftJoin(stockLevel, and(
      eq(stockLevel.productId, product.id),
      eq(stockLevel.masterFn, masterFn),
      eq(stockLevel.companyFn, companyFn),
    ))
    .where(and(eq(product.masterFn, masterFn), eq(product.companyFn, companyFn)))
    .groupBy(product.id, product.sku, product.name)
    .having(sql`coalesce(sum(${stockLevel.qty}),0) <= ${threshold}`);
}

async function buildDashboard(masterFn: string, companyFn: string) {
  const [companies, productCount, orders, receivables, revenue, alerts] = await Promise.all([
    listCompanies(db, masterFn),
    countProducts(masterFn, companyFn),
    openOrders(masterFn, companyFn),
    openReceivables(masterFn, companyFn),
    revenueTotal(masterFn, companyFn),
    stockAlerts(masterFn, companyFn),
  ]);
  return {
    scope: { masterFn, companyFn },
    companies,
    metrics: {
      productCount,
      openOrders: orders.count,
      openOrderValue: orders.value,
      openInvoices: receivables.count,
      arOpen: receivables.value,
      mtdRevenue: revenue,
      stockAlertCount: alerts.length,
    },
    stockAlerts: alerts,
    generatedAt: new Date().toISOString(),
  };
}

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'erp-system-api', time: new Date().toISOString() });
});

app.get('/api/dashboard', async (req, res) => {
  const masterFn = typeof req.query.masterFn === 'string' ? req.query.masterFn : 'M1';
  const companyFn = typeof req.query.companyFn === 'string' ? req.query.companyFn : 'C-SG';
  try {
    res.json(await buildDashboard(masterFn, companyFn));
  } catch (err) {
    console.error('[erp-system-api] GET /api/dashboard failed', err);
    res.status(500).json({ error: 'dashboard_query_failed', message: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`[erp-system-api] listening on :${PORT} — DATABASE_URL connected, GET /health + GET /api/dashboard ready`);
});
