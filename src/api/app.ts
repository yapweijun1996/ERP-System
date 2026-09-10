import express, { type Express } from 'express';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import {
  SESSION_COOKIE,
  parseCookies,
  verifyCsrfToken,
} from '../auth/session';
import {
  PLATFORM_SESSION_COOKIE,
  verifyPlatformCsrfToken,
} from '../auth/platformSupport';
import { getPlatformSimulation } from '../auth/platformSimulation';
import {
  getPlatformTenantAccess,
  isSensitivePlatformMutation,
} from '../auth/platformTenantAccess';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { buildDashboard } from './dashboard';
import { apiError, context, requireSession } from './http';
import { createAdminRouter } from './routes/admin';
import { createAdminAgentsRouter } from './routes/adminAgents';
import { createAuthRouter } from './routes/auth';
import { createResourceRouter } from './routes/resources';
import { parseTokenEncryptionKey } from '../auth/tokenCrypto';
import { createSetupRouter } from './routes/setup';
import { getProductionSetupStatus } from '../modules/setup/setupState';
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
import { createAgentRouter } from './routes/agent';
import { createAssistantRouter, type ReceiptAssistantRouterOptions } from './routes/assistant';
import { createKnowledgeRouter } from './routes/knowledge';
import type { AgentCredentialAuthenticator } from '../auth/agentAuthentication';
import { createMcpRouter } from './routes/mcp';
import type { McpAuthorizationAdapter } from './mcpAuthorization';
import type { McpRateLimitPolicy } from './mcpRateLimit';
import { createTenantModuleEntitlementGate } from './moduleEntitlement';
import {
  configureAuditAttributionStorage,
  runWithAuditAttribution,
  type AuditAttribution,
} from './auditContext';

let auditAttributionStorageConfigured = false;

function ensureAuditAttributionStorage(): void {
  if (auditAttributionStorageConfigured) return;
  configureAuditAttributionStorage(new AsyncLocalStorage<AuditAttribution>());
  auditAttributionStorageConfigured = true;
}

export interface AppOptions {
  secureCookies?: boolean;
  trustProxy?: boolean;
  tokenEncryptionKey?: string;
  publicUrl?: string;
  revision?: string;
  /** Independent Agent issuer adapter; never falls back to the human session. */
  agentAuthenticator?: AgentCredentialAuthenticator;
  /** Independent MCP OAuth/OIDC resource-server adapter; never falls back to a browser session. */
  mcpAuthorization?: McpAuthorizationAdapter;
  /** Issuer advertised by the MCP Protected Resource Metadata document. */
  mcpIssuer?: string;
  /** Exact MCP resource audience. Defaults to publicUrl + /api/mcp/v1. */
  mcpResourceUri?: string;
  /** Process-local development guard; production should enforce the same policy at a shared gateway/store. */
  mcpRateLimit?: McpRateLimitPolicy;
  /** Exact server-approved egress hosts for OpenAI-compatible Agent providers. */
  agentAllowedEgressHosts?: readonly string[];
  /** Server-owned Receipt assistant adapter; absent means the assistant is unavailable. */
  receiptAssistant?: ReceiptAssistantRouterOptions;
}

const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/invitations/actions/accept',
  '/api/auth/password-reset/actions/request',
  '/api/auth/password-reset/actions/confirm',
  '/api/setup/actions/complete',
  '/api/setup/platform-superadmin/actions/complete',
  // Agent calls use their own bearer issuer and never use browser CSRF state.
  '/api/agent/actions',
  // MCP calls use their own bearer issuer and never use browser CSRF state.
  '/api/mcp/v1',
]);

function platformSessionToken(req: express.Request): string | undefined {
  const authorization = req.header('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const bearer = authorization.slice('Bearer '.length).trim();
    if (bearer) return bearer;
  }
  return parseCookies(req.headers.cookie)[PLATFORM_SESSION_COOKIE];
}

export function createApp(db: DB, options: AppOptions = {}): Express {
  ensureAuditAttributionStorage();
  const app = express();
  const releaseRevision = options.revision?.trim() || 'unknown';
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
    res.locals.erpContext = { requestId };
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  // A valid platform session gains tenant access only through one explicit,
  // active exact-user simulation or elevated tenant-access window. In both
  // cases target SessionData replaces rather than augments tenant identity,
  // while AsyncLocalStorage preserves the real Platform principal for every
  // existing appendAudit call reached by the request.
  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api/') || req.path === '/api/platform' || req.path.startsWith('/api/platform/')) {
      next();
      return;
    }
    try {
      const token = platformSessionToken(req);
      const simulation = await getPlatformSimulation(db, token, { touch: false });
      if (simulation) {
        context(res).platformSimulation = simulation;
        runWithAuditAttribution({ platformPrincipalId: simulation.platformPrincipalId }, () => next());
        return;
      }
      const tenantAccess = await getPlatformTenantAccess(db, token, { touch: false });
      if (!tenantAccess) { next(); return; }
      context(res).platformTenantAccess = tenantAccess;
      runWithAuditAttribution({ platformPrincipalId: tenantAccess.platformPrincipalId }, () => next());
    } catch (error) {
      next(error);
    }
  });

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
    const simulation = context(res).platformSimulation;
    const tenantAccess = context(res).platformTenantAccess;
    const cookies = parseCookies(req.headers.cookie);
    const valid = simulation || tenantAccess
      ? await verifyPlatformCsrfToken(
        db,
        platformSessionToken(req),
        req.header('x-platform-csrf-token'),
      )
      : await verifyCsrfToken(
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

  // Elevated Platform Admin uses ordinary tenant authorization for every
  // command. This extra gate protects only the centrally classified sensitive
  // mutation surface; it never replaces downstream workflow/business checks.
  app.use((req, res, next) => {
    const access = context(res).platformTenantAccess;
    if (!access || !isSensitivePlatformMutation(req.method, req.path)) {
      next();
      return;
    }
    if (!access.breakGlass) {
      apiError(
        res,
        403,
        'platform_break_glass_required',
        'Unlock sensitive Platform Admin mutations for this Company before continuing.',
      );
      return;
    }
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
      res.json({
        status: 'ok',
        service: 'erp-system-api',
        revision: releaseRevision,
        time: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'unavailable',
        service: 'erp-system-api',
        revision: releaseRevision,
      });
    }
  });

  app.get('/api/setup/status', async (_req, res) => {
    res.json(await getProductionSetupStatus(db));
  });
  app.use('/api/setup', createSetupRouter(db, {
    secureCookies: options.secureCookies ?? false,
  }));

  const lifecycle = options.tokenEncryptionKey ? {
    tokenEncryptionKey: parseTokenEncryptionKey(options.tokenEncryptionKey),
    publicUrl: options.publicUrl ?? 'http://127.0.0.1:4173',
  } : undefined;

  app.use('/api/auth', createAuthRouter(db, {
    secureCookies: options.secureCookies ?? false,
    lifecycle,
  }));

  app.use('/api/platform', createPlatformRouter(db, {
    secureCookies: options.secureCookies ?? false,
  }));
  // This route must run before the human-session module gate. The Agent
  // dispatcher derives its tenant from the independently authenticated issuer
  // and checks the module entitlement inside the same tenant transaction.
  app.use('/api/agent', createAgentRouter(db, {
    authenticator: options.agentAuthenticator,
  }));
  app.use('/api/knowledge', createKnowledgeRouter(db));
  // MCP follows the same independent bearer boundary as Agent. The route
  // remains before the human-session module gate; its dispatcher performs the
  // tenant/module/grant checks inside the authenticated tenant transaction.
  app.use(createMcpRouter(db, {
    authorization: options.mcpAuthorization,
    issuer: options.mcpIssuer,
    resourceUri: options.mcpResourceUri,
    publicUrl: options.publicUrl,
    rateLimit: options.mcpRateLimit,
  }));
  app.use(createTenantModuleEntitlementGate(db));
  app.use('/api/assistant', createAssistantRouter(db, options.receiptAssistant));
  app.use('/api/admin', createAdminAgentsRouter(db));
  app.use('/api/admin', createAdminRouter(db, { lifecycle }));
  app.use('/api/account', createAccountRouter(db));
  app.use('/api/integration', createIntegrationRouter(db, lifecycle?.tokenEncryptionKey, {
    agentAllowedEgressHosts: options.agentAllowedEgressHosts,
  }));
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
