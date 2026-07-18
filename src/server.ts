// Production API server (TASK-011, EPIC-005; auth TASK-024). Health, session
// auth, dashboard and canonical keyset-paginated resource reads against
// PostgreSQL via DATABASE_URL, using the SAME schema/repo code as the demo and
// src/demo.ts's proof script — no second query dialect to maintain.
//
// This is the server-side counterpart the frontend's erp-system-api-adapter.js
// (VITE_DATA_MODE=api) expects at its `{base}/health` check. Run:
//   DATABASE_URL=postgres://user:pass@host:5432/db PORT=3000 npm run server
//
// NOT YET DONE (tracked separately, see docs/STATUS.md): write endpoints for
// stock/money (confirmOrder/completeSetup), DB-backed sessions, CSRF/RBAC,
// idempotency and append-only API audit events.
import express from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createPostgresDb, type DB } from './data/db';
import { listCompanies } from './data/repo';
import { product, stockLevel, salesOrder, invoice, account, glEntry, appUser, userCompany } from './data/schema';
import { verifyPassword } from './auth/password';
import { createSession, getSession, destroySession, parseCookies } from './auth/session';
import {
  InvalidResourceQueryError,
  UnknownResourceError,
  getResource,
  isKnownResource,
  listResource,
} from './api/resources';

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
    apiError(res, 401, 'not_authenticated', 'Sign in first (POST /api/auth/login).');
    return null;
  }
  return session;
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

function apiError(
  res: express.Response,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  res.status(status).json({
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      requestId: res.locals.requestId,
    },
  });
}

async function authorizedScope(req: express.Request, res: express.Response) {
  const session = requireSession(req, res);
  if (!session) return null;
  const allowed = await companiesForUser(session.userId);
  const requested = typeof req.query.companyFn === 'string' ? req.query.companyFn : null;
  const companyFn = requested && allowed.includes(requested) ? requested : allowed[0];
  if (!companyFn) {
    apiError(res, 403, 'no_company_access', 'This user has no company assignments.');
    return null;
  }
  return { masterFn: session.masterFn, companyFn };
}

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
    apiError(res, 500, 'setup_status_failed', 'Setup status could not be loaded.');
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    const fieldErrors: Record<string, string> = {};
    if (typeof email !== 'string' || !email.trim()) fieldErrors.email = 'Email is required.';
    if (typeof password !== 'string' || !password) fieldErrors.password = 'Password is required.';
    apiError(res, 400, 'invalid_request', 'Email and password are required.', fieldErrors);
    return;
  }
  try {
    const [user] = await db.select({
      userId: appUser.userId, masterFn: appUser.masterFn, email: appUser.email,
      fullName: appUser.fullName, passwordHash: appUser.passwordHash, isActive: appUser.isActive,
    }).from(appUser).where(eq(appUser.email, email.trim().toLowerCase()));

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      // Same response for "no such user" and "wrong password" — don't leak which one.
      apiError(res, 401, 'invalid_credentials', 'Incorrect email or password.');
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
    apiError(res, 500, 'login_failed', 'Sign in could not be completed.');
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
  try {
    // masterFn ALWAYS comes from the session. A requested companyFn is honored
    // only when user_company grants this session access to it.
    const scope = await authorizedScope(req, res);
    if (!scope) return;
    res.json(await buildDashboard(scope.masterFn, scope.companyFn));
  } catch (err) {
    console.error('[erp-system-api] GET /api/dashboard failed', err);
    apiError(res, 500, 'dashboard_query_failed', 'Dashboard data could not be loaded.');
  }
});

/**
 * Canonical read API. All resource names come from a static allowlist in
 * src/api/resources.ts, every query is tenant-scoped from the server session,
 * and list traversal is keyset-based (`id > cursor`) with limit capped at 100.
 */
app.get('/api/:module/:resource', async (req, res) => {
  const resource = `${req.params.module}/${req.params.resource}`;
  if (!isKnownResource(resource)) {
    apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
    return;
  }
  try {
    const scope = await authorizedScope(req, res);
    if (!scope) return;
    res.json(await listResource(db, scope, resource, req.query));
  } catch (err) {
    if (err instanceof InvalidResourceQueryError) {
      apiError(res, 400, 'invalid_query', err.message);
      return;
    }
    if (err instanceof UnknownResourceError) {
      apiError(res, 404, 'resource_not_found', err.message);
      return;
    }
    console.error(`[erp-system-api] GET /api/${resource} failed`, err);
    apiError(res, 500, 'resource_query_failed', 'The ERP resource could not be loaded.');
  }
});

app.get('/api/:module/:resource/:id', async (req, res) => {
  const resource = `${req.params.module}/${req.params.resource}`;
  if (!isKnownResource(resource)) {
    apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
    return;
  }
  try {
    const scope = await authorizedScope(req, res);
    if (!scope) return;
    const result = await getResource(db, scope, resource, req.params.id);
    if (!result) {
      apiError(res, 404, 'record_not_found', `No ${resource} record exists with id ${req.params.id}.`);
      return;
    }
    res.json(result);
  } catch (err) {
    if (err instanceof InvalidResourceQueryError) {
      apiError(res, 400, 'invalid_id', err.message, { id: err.message });
      return;
    }
    console.error(`[erp-system-api] GET /api/${resource}/${req.params.id} failed`, err);
    apiError(res, 500, 'resource_query_failed', 'The ERP resource could not be loaded.');
  }
});

app.listen(PORT, () => {
  console.log(`[erp-system-api] listening on :${PORT} — DATABASE_URL connected, auth + canonical read API ready`);
});
