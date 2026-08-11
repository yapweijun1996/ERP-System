// Platform-only authorization routes. These endpoints never accept the tenant
// erp_session cookie. Interactive sign-in uses independent platform_principal
// credentials/cookies; bearer sessions remain supported for deployment bootstrap
// and API integration tests.
import { Router } from 'express';
import type express from 'express';
import type { DB } from '../../data/db';
import {
  authenticatePlatformPrincipal,
  createPlatformSession,
  createSupportAccessGrant,
  evaluateSupportAccess,
  getPlatformSession,
  PLATFORM_CSRF_COOKIE,
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_TTL_MS,
  listSupportAccessGrants,
  PlatformAccessError,
  revokePlatformSession,
  revokeSupportAccessGrant,
  verifyPlatformCsrfToken,
  type SupportAccessMode,
} from '../../auth/platformSupport';
import {
  endPlatformSimulation,
  getPlatformSimulation,
  listPlatformSimulationTargets,
  platformSimulationIsActive,
  startPlatformSimulation,
} from '../../auth/platformSimulation';
import {
  listCompanyAllocations,
  listMasterEntitlements,
  listPlatformTenants,
  setCompanyAllocation,
  setMasterEntitlement,
} from '../../auth/platformEntitlement';
import { parseCookies } from '../../auth/session';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  loginIdentifierHash,
  recordLoginFailure,
} from '../../auth/rateLimit';
import { apiError, context } from '../http';

function bearerToken(req: express.Request): string | undefined {
  const value = req.header('authorization');
  if (!value?.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length).trim();
  return token || undefined;
}

function platformToken(req: express.Request): string | undefined {
  return bearerToken(req) ?? parseCookies(req.headers.cookie)[PLATFORM_SESSION_COOKIE];
}

function clientIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function requirePlatformSession(
  db: DB,
  req: express.Request,
  res: express.Response,
  options: { mutate?: boolean; workspaceOnly?: boolean } = {},
) {
  const token = platformToken(req);
  const session = await getPlatformSession(db, token);
  if (!session) {
    apiError(res, 401, 'platform_not_authenticated', 'A valid platform session is required.');
    return null;
  }
  if (options.mutate && !await verifyPlatformCsrfToken(db, token, req.header('x-platform-csrf-token'))) {
    apiError(res, 403, 'platform_csrf_invalid', 'A valid platform CSRF token is required.');
    return null;
  }
  if (options.workspaceOnly && await platformSimulationIsActive(db, token)) {
    apiError(
      res,
      409,
      'platform_simulation_active',
      'Return to the Platform workspace before changing platform state.',
    );
    return null;
  }
  return { session, token: token! };
}

function handlePlatformError(res: express.Response, error: unknown): void {
  if (error instanceof PlatformAccessError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  throw error;
}

export function createPlatformRouter(db: DB, options: { secureCookies: boolean }): Router {
  const router = Router();
  const cookieCommon = { sameSite: 'strict' as const, secure: options.secureCookies, path: '/' };
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    next();
  });

  function clearPlatformCookies(res: express.Response): void {
    res.clearCookie(PLATFORM_SESSION_COOKIE, { ...cookieCommon, httpOnly: true });
    res.clearCookie(PLATFORM_CSRF_COOKIE, { ...cookieCommon, httpOnly: false });
  }

  router.post('/login', async (req, res) => {
    const body = (req.body ?? {}) as { principalKey?: unknown; password?: unknown; rememberDevice?: unknown };
    if (typeof body.principalKey !== 'string' || typeof body.password !== 'string'
      || body.principalKey.trim().length === 0 || body.password.length === 0) {
      apiError(res, 400, 'invalid_request', 'Platform principal key and password are required.');
      return;
    }
    // The platform realm deliberately has no Remember Me option. Treat an
    // attempted flag as invalid instead of silently extending a session.
    if (body.rememberDevice != null && body.rememberDevice !== false) {
      apiError(res, 400, 'platform_remember_me_not_supported', 'Platform sessions cannot be remembered.');
      return;
    }
    const identifier = loginIdentifierHash(`platform:${body.principalKey.trim().toLowerCase()}`, clientIp(req));
    const rateLimit = await checkLoginRateLimit(db, identifier);
    if (!rateLimit.allowed) {
      res.setHeader('retry-after', String(rateLimit.retryAfterSeconds));
      apiError(res, 429, 'login_rate_limited', 'Too many sign-in attempts. Try again later.');
      return;
    }
    const principal = await authenticatePlatformPrincipal(db, body.principalKey, body.password);
    if (!principal) {
      const failure = await recordLoginFailure(db, identifier);
      if (failure.blocked) res.setHeader('retry-after', String(failure.retryAfterSeconds));
      apiError(res, 401, 'invalid_credentials', 'Incorrect platform principal key or password.');
      return;
    }
    await clearLoginFailures(db, identifier);
    const created = await createPlatformSession(db, principal.principalId);
    res.cookie(PLATFORM_SESSION_COOKIE, created.token, {
      ...cookieCommon,
      httpOnly: true,
      maxAge: PLATFORM_SESSION_TTL_MS,
    });
    res.cookie(PLATFORM_CSRF_COOKIE, created.csrfToken, {
      ...cookieCommon,
      httpOnly: false,
      maxAge: PLATFORM_SESSION_TTL_MS,
    });
    res.json({
      data: {
        realm: 'platform',
        principalId: principal.principalId,
        principalKey: principal.principalKey,
        displayName: principal.displayName,
        expiresAt: created.expiresAt,
        rememberDevice: false,
      },
      meta: {},
    });
  });

  router.get('/session', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res);
    if (!auth) return;
    const simulation = await getPlatformSimulation(db, auth.token, { touch: false });
    res.json({
      data: {
        realm: 'platform',
        principalId: auth.session.principalId,
        principalKey: auth.session.principalKey,
        displayName: auth.session.displayName,
        permissions: auth.session.permissions,
        expiresAt: auth.session.expiresAt,
        simulation: simulation ? {
          simulationId: simulation.simulationId,
          expiresAt: simulation.expiresAt,
          target: simulation.target,
        } : null,
      },
      meta: {},
    });
  });

  router.post('/logout', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
    if (!auth) return;
    await revokePlatformSession(db, auth.token);
    clearPlatformCookies(res);
    res.json({ data: { ok: true }, meta: {} });
  });

  router.get('/entitlements', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res);
    if (!auth) return;
    try {
      res.json({ data: await listPlatformTenants(db, auth.session), meta: { realm: 'platform' } });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.get('/masters/:masterFn/modules', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res);
    if (!auth) return;
    try {
      res.json({ data: await listMasterEntitlements(db, auth.session, String(req.params.masterFn)), meta: { realm: 'platform' } });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.patch('/masters/:masterFn/modules/:moduleKey', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true, workspaceOnly: true });
    if (!auth) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      if (typeof body.enabled !== 'boolean' || typeof body.defaultCompanyAllocated !== 'boolean') {
        throw new PlatformAccessError(400, 'invalid_request', 'enabled and defaultCompanyAllocated must be booleans.');
      }
      const data = await setMasterEntitlement(db, auth.session, {
        masterFn: String(req.params.masterFn), moduleKey: String(req.params.moduleKey),
        enabled: body.enabled, defaultCompanyAllocated: body.defaultCompanyAllocated,
        expectedVersion: body.expectedVersion,
      }, context(res).requestId);
      res.json({ data, meta: { realm: 'platform', immediate: true } });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.get('/masters/:masterFn/companies/:companyFn/modules', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res);
    if (!auth) return;
    try {
      const data = await listCompanyAllocations(
        db, auth.session, String(req.params.masterFn), String(req.params.companyFn),
      );
      res.json({ data, meta: { realm: 'platform' } });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.patch('/masters/:masterFn/companies/:companyFn/modules/:moduleKey', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true, workspaceOnly: true });
    if (!auth) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      if (typeof body.allocated !== 'boolean') {
        throw new PlatformAccessError(400, 'invalid_request', 'allocated must be a boolean.');
      }
      const data = await setCompanyAllocation(db, auth.session, {
        masterFn: String(req.params.masterFn), companyFn: String(req.params.companyFn),
        moduleKey: String(req.params.moduleKey), allocated: body.allocated,
        expectedVersion: body.expectedVersion,
      }, context(res).requestId);
      res.json({ data, meta: { realm: 'platform', immediate: true } });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.get('/support-grants', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res);
    if (!auth) return;
    try {
      const masterValue = typeof req.query.masterFn === 'string' ? req.query.masterFn : undefined;
      const companyValue = typeof req.query.companyFn === 'string' ? req.query.companyFn : undefined;
      const companyFn = companyValue === 'null' ? null : companyValue;
      res.json({ data: await listSupportAccessGrants(db, auth.session, { masterFn: masterValue, companyFn }), meta: {} });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.post('/support-grants', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true, workspaceOnly: true });
    if (!auth) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const grant = await createSupportAccessGrant(db, auth.session, {
        masterFn: typeof body.masterFn === 'string' ? body.masterFn : '',
        companyFn: body.companyFn == null ? null : String(body.companyFn),
        grantedPrincipalId: body.grantedPrincipalId == null ? undefined : Number(body.grantedPrincipalId),
        reason: typeof body.reason === 'string' ? body.reason : '',
        ticketReference: typeof body.ticketReference === 'string' ? body.ticketReference : '',
        mode: body.mode as SupportAccessMode,
        validFrom: typeof body.validFrom === 'string' ? body.validFrom : '',
        validUntil: typeof body.validUntil === 'string' ? body.validUntil : '',
        restrictions: typeof body.restrictions === 'object' && body.restrictions != null
          ? body.restrictions as {
            blockedSensitiveFields?: readonly string[];
            allowedOperations?: readonly string[];
            breakGlassApprovalReference?: string;
          }
          : undefined,
      }, context(res).requestId);
      res.status(201).json({ data: grant, meta: {} });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.post('/support-grants/:grantId/actions/revoke', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true, workspaceOnly: true });
    if (!auth) return;
    const grantId = Number(req.params.grantId);
    const reason = (req.body as { reason?: unknown } | undefined)?.reason;
    try {
      if (!Number.isSafeInteger(grantId) || grantId <= 0 || typeof reason !== 'string') {
        throw new PlatformAccessError(400, 'invalid_request', 'grantId and reason are required.');
      }
      await revokeSupportAccessGrant(db, auth.session, grantId, reason, context(res).requestId);
      res.json({ data: { id: grantId, revoked: true }, meta: {} });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.post('/support-grants/:grantId/actions/check', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true, workspaceOnly: true });
    if (!auth) return;
    const grantId = Number(req.params.grantId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      if (!Number.isSafeInteger(grantId) || grantId <= 0
        || typeof body.masterFn !== 'string'
        || typeof body.companyFn !== 'string'
        || typeof body.operation !== 'string') {
        throw new PlatformAccessError(400, 'invalid_request', 'grantId, masterFn, companyFn and operation are required.');
      }
      const decision = await evaluateSupportAccess(db, auth.session, {
        grantId,
        masterFn: body.masterFn,
        companyFn: body.companyFn,
        operation: body.operation,
        sensitiveField: typeof body.sensitiveField === 'string' ? body.sensitiveField : undefined,
      }, context(res).requestId);
      if (!decision.allowed) {
        apiError(res, 403, 'support_access_denied', 'Support access is not authorized.');
        return;
      }
      res.json({ data: decision, meta: {} });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.post('/session/actions/revoke', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
    if (!auth) return;
    await revokePlatformSession(db, auth.token);
    res.json({ data: { revoked: true }, meta: {} });
  });

  router.get('/simulation-targets', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res);
    if (!auth) return;
    const masterFn = typeof req.query.masterFn === 'string' ? req.query.masterFn : '';
    const companyFn = typeof req.query.companyFn === 'string' ? req.query.companyFn : '';
    try {
      res.json({
        data: await listPlatformSimulationTargets(db, auth.session, { masterFn, companyFn }),
        meta: { realm: 'platform' },
      });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.post('/simulations', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true, workspaceOnly: true });
    if (!auth) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const simulation = await startPlatformSimulation(db, auth.session, auth.token, {
        masterFn: typeof body.masterFn === 'string' ? body.masterFn : '',
        companyFn: typeof body.companyFn === 'string' ? body.companyFn : '',
        targetUserId: typeof body.targetUserId === 'number' ? body.targetUserId : Number.NaN,
      }, context(res).requestId);
      res.status(201).json({
        data: {
          simulationId: simulation.simulationId,
          expiresAt: simulation.expiresAt,
          target: simulation.target,
        },
        meta: { realm: 'tenant_simulation' },
      });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  router.post('/simulations/actions/return', async (req, res) => {
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
    if (!auth) return;
    try {
      const returned = await endPlatformSimulation(db, auth.session, auth.token, context(res).requestId);
      res.json({ data: { returned }, meta: { realm: 'platform' } });
    } catch (error) {
      handlePlatformError(res, error);
    }
  });

  // This endpoint is intentionally not a public login/provisioning flow. Platform
  // principal and session issuance belongs to deployment/SSO bootstrap code.
  router.post('/session', (_req, res) => {
    apiError(res, 405, 'platform_session_provisioning_only', 'Platform sessions are provisioned outside the tenant API.');
  });

  return router;
}
