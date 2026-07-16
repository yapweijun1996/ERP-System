// Production API server (TASK-011, EPIC-005; auth TASK-024). GET /health +
// GET /api/dashboard + minimal session auth against PostgreSQL via DATABASE_URL,
// using the SAME schema/repo code as the demo and src/demo.ts's proof script — no
// second query dialect to maintain.
//
// This is the server-side counterpart the frontend's erp-system-api-adapter.js
// (VITE_DATA_MODE=api) expects at its `{base}/health` check. Run:
//   DATABASE_URL=postgres://user:pass@host:5432/db PORT=3000 npm run server
//
// NOT YET DONE (tracked separately, see docs/STATUS.md): write endpoints for
// stock/money (confirmOrder/completeSetup — the contract is defined in
// erp-system-api-adapter.js), Docker packaging is TASK-012 (done — including
// whether web reaches api same-origin through a reverse proxy, which it does).
import express from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { createPostgresDb, type DB } from './data/db';
import { listCompanies } from './data/repo';
import { product, stockLevel, salesOrder, invoice, account, glEntry, appUser, userCompany } from './data/schema';
import { verifyPassword } from './auth/password';
import { createSession, getSession, destroySession, parseCookies } from './auth/session';

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_COOKIE = 'erp_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h

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

/** Companies this user actually has access to (drives dashboard scoping + the
 *  frontend company switcher's authorization check). */
async function companiesForUser(userId: number): Promise<string[]> {
  const rows = await db.select({ companyFn: userCompany.companyFn }).from(userCompany)
    .where(eq(userCompany.userId, userId));
  return rows.map((r) => r.companyFn);
}

/** Reads the session cookie and looks it up. Sends 401 and returns null if absent/invalid —
 *  callers should `if (!session) return;` immediately. */
function requireSession(req: express.Request, res: express.Response) {
  const cookies = parseCookies(req.headers.cookie);
  const session = getSession(cookies[SESSION_COOKIE]);
  if (!session) {
    res.status(401).json({ error: 'not_authenticated', message: 'Sign in first (POST /api/auth/login).' });
    return null;
  }
  return session;
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'erp-system-api', time: new Date().toISOString() });
});

/** No auth required by design — used by the wizard gate (TASK-024) to decide
 *  whether first-run setup should still be offered. Exposes only a boolean. */
app.get('/api/setup/status', async (_req, res) => {
  try {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(appUser);
    res.json({ hasAdmin: (row?.n ?? 0) > 0 });
  } catch (err) {
    console.error('[erp-system-api] GET /api/setup/status failed', err);
    res.status(500).json({ error: 'setup_status_failed', message: (err as Error).message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    res.status(400).json({ error: 'invalid_request', message: 'email and password are required' });
    return;
  }
  try {
    const [user] = await db.select({
      userId: appUser.userId, masterFn: appUser.masterFn, email: appUser.email,
      fullName: appUser.fullName, passwordHash: appUser.passwordHash, isActive: appUser.isActive,
    }).from(appUser).where(eq(appUser.email, email.trim().toLowerCase()));

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      // Same response for "no such user" and "wrong password" — don't leak which one.
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const sessionId = createSession({
      userId: user.userId, masterFn: user.masterFn, email: user.email, fullName: user.fullName,
    });
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE_MS,
      // secure:true requires HTTPS — off by default so local/dev HTTP still works;
      // set behind a TLS-terminating proxy in a real deployment.
    });
    res.json({ userId: user.userId, email: user.email, fullName: user.fullName, masterFn: user.masterFn });
  } catch (err) {
    console.error('[erp-system-api] POST /api/auth/login failed', err);
    res.status(500).json({ error: 'login_failed', message: (err as Error).message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  destroySession(cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/session', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  res.json(session);
});

app.get('/api/dashboard', async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  try {
    // masterFn ALWAYS from the session — never client input. companyFn may be
    // requested via query (the frontend's switchCompany()) but only honored if
    // this session's user actually has access to it via user_company.
    const allowed = await companiesForUser(session.userId);
    const requested = typeof req.query.companyFn === 'string' ? req.query.companyFn : null;
    const companyFn = requested && allowed.includes(requested) ? requested : allowed[0];
    if (!companyFn) {
      res.status(403).json({ error: 'no_company_access', message: 'This user has no company assignments.' });
      return;
    }
    res.json(await buildDashboard(session.masterFn, companyFn));
  } catch (err) {
    console.error('[erp-system-api] GET /api/dashboard failed', err);
    res.status(500).json({ error: 'dashboard_query_failed', message: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`[erp-system-api] listening on :${PORT} — DATABASE_URL connected, auth + GET /api/dashboard ready`);
});
