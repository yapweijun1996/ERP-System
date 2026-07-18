import express, { type Express } from 'express';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import { appUser } from '../data/schema';
import {
  SESSION_COOKIE,
  parseCookies,
  verifyCsrfToken,
} from '../auth/session';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { buildDashboard } from './dashboard';
import { apiError, context, requireSession } from './http';
import { createAuthRouter } from './routes/auth';
import { createResourceRouter } from './routes/resources';

export interface AppOptions {
  secureCookies?: boolean;
  trustProxy?: boolean;
}

const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
]);

export function createApp(db: DB, options: AppOptions = {}): Express {
  const app = express();
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
    res.locals.erpContext = { requestId };
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.use(async (req, res, next) => {
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      || !req.path.startsWith('/api/')
      || CSRF_EXEMPT_PATHS.has(req.path)
    ) {
      next();
      return;
    }
    const cookies = parseCookies(req.headers.cookie);
    const valid = await verifyCsrfToken(
      db,
      cookies[SESSION_COOKIE],
      req.header('x-csrf-token'),
    );
    if (!valid) {
      apiError(res, 403, 'csrf_invalid', 'A valid CSRF token is required.');
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'erp-system-api', time: new Date().toISOString() });
  });

  app.get('/api/setup/status', async (_req, res) => {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(appUser);
    res.json({ hasAdmin: (row?.n ?? 0) > 0 });
  });

  app.use('/api/auth', createAuthRouter(db, {
    secureCookies: options.secureCookies ?? false,
  }));

  app.get('/api/dashboard', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.dashboardRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read this dashboard.');
      return;
    }
    const scope = {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    };
    res.json(await withTenantTransaction(db, scope, (tx) =>
      buildDashboard(tx, scope.masterFn, scope.companyFn)));
  });

  app.use('/api', createResourceRouter(db));

  app.use((_req, res) => {
    apiError(res, 404, 'route_not_found', 'API route not found.');
  });

  app.use((
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(`[erp-system-api] request ${context(res).requestId} failed`, error);
    if (!res.headersSent) {
      const httpError = error as { status?: number; type?: string };
      if (httpError.status === 400 && httpError.type === 'entity.parse.failed') {
        apiError(res, 400, 'invalid_json', 'Request body is not valid JSON.');
        return;
      }
      apiError(res, 500, 'internal_error', 'The request could not be completed.');
    }
  });

  return app;
}
