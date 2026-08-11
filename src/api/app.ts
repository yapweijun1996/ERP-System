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
import { createAdminRouter } from './routes/admin';
import { createAuthRouter } from './routes/auth';
import { createResourceRouter } from './routes/resources';
import { parseTokenEncryptionKey } from '../auth/tokenCrypto';
import { createSetupRouter } from './routes/setup';
import { createAccountRouter } from './routes/account';
import { createIntegrationRouter } from './routes/integration';
import { createSettingsRouter } from './routes/settings';
import { createFinanceReportsRouter } from './routes/financeReports';
import { createReportingRouter } from './routes/reporting';
import { createHrRouter } from './routes/hr';
import { createMyRouter } from './routes/my';
import { createDocumentsRouter } from './routes/documents';
import { createExpensePoliciesRouter } from './routes/expensePolicies';
import { createExpenseApprovalsRouter } from './routes/expenseApprovals';
import { createCorporateCardsRouter } from './routes/corporateCards';
import { createAllowancesAdvancesRouter } from './routes/allowancesAdvances';
import { createPayoutProfilesRouter } from './routes/payoutProfiles';
import { createReimbursementBatchesRouter } from './routes/reimbursementBatches';
import { createReimbursementPaymentsRouter } from './routes/reimbursementPayments';
import { createTaxEvidenceRouter } from './routes/taxEvidence';
import { createOnboardingRouter } from './routes/onboarding';
import { createPlatformRouter } from './routes/platform';
import { createCompanyReceiptsRouter } from './routes/companyReceipts';
import { createTenantModuleEntitlementGate } from './moduleEntitlement';

export interface AppOptions {
  secureCookies?: boolean;
  trustProxy?: boolean;
  tokenEncryptionKey?: string;
  publicUrl?: string;
  setupToken?: string;
}

const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/invitations/actions/accept',
  '/api/auth/password-reset/actions/request',
  '/api/auth/password-reset/actions/confirm',
  '/api/setup/actions/complete',
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
    // Platform routes authenticate with their separate bearer session and run
    // their own platform-CSRF check; a tenant erp_session must never be used
    // as a platform credential or become their CSRF authority.
    if (req.path === '/api/platform' || req.path.startsWith('/api/platform/')) {
      next();
      return;
    }
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
  app.use('/api/setup', createSetupRouter(db, options.setupToken));

  const lifecycle = options.tokenEncryptionKey ? {
    tokenEncryptionKey: parseTokenEncryptionKey(options.tokenEncryptionKey),
    publicUrl: options.publicUrl ?? 'http://127.0.0.1:4173',
  } : undefined;

  app.use('/api/auth', createAuthRouter(db, {
    secureCookies: options.secureCookies ?? false,
    lifecycle,
  }));

  app.use('/api/platform', createPlatformRouter(db));
  app.use(createTenantModuleEntitlementGate(db));
  app.use('/api/admin', createAdminRouter(db, { lifecycle }));
  app.use('/api/account', createAccountRouter(db));
  app.use('/api/integration', createIntegrationRouter(db, lifecycle?.tokenEncryptionKey));
  app.use('/api/settings', createSettingsRouter(db));
  app.use('/api/hr', createHrRouter(db, {
    tokenEncryptionKey: lifecycle?.tokenEncryptionKey,
  }));
  app.use('/api/my', createMyRouter(db, {
    payoutEncryptionKey: lifecycle?.tokenEncryptionKey,
  }));
  app.use('/api/documents', createDocumentsRouter(db));
  app.use('/api/expense-policies', createExpensePoliciesRouter(db));
  app.use('/api/expense-approvals', createExpenseApprovalsRouter(db));
  app.use('/api/corporate-cards', createCorporateCardsRouter(db));
  app.use('/api/expense-settlements', createAllowancesAdvancesRouter(db));
  app.use('/api/payout-profiles', createPayoutProfilesRouter(db, {
    payoutEncryptionKey: lifecycle?.tokenEncryptionKey,
  }));
  app.use('/api/reimbursement-batches', createReimbursementBatchesRouter(db));
  app.use('/api/reimbursement-payments', createReimbursementPaymentsRouter(db, {
    encryptionKey: lifecycle?.tokenEncryptionKey,
  }));
  app.use('/api/tax-evidence', createTaxEvidenceRouter(db));
  app.use('/api/company-receipts', createCompanyReceiptsRouter(db));
  app.use('/api/finance', createFinanceReportsRouter(db));
  app.use('/api/reporting', createReportingRouter(db));
  app.use('/api/onboarding', createOnboardingRouter(db));

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
