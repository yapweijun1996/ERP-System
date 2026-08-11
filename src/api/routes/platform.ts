// Platform-only authorization routes. These endpoints never accept the tenant
// erp_session cookie; they require a separate Authorization bearer token issued
// by the platform provisioning boundary in src/auth/platformSupport.ts.
import { Router } from 'express';
import type express from 'express';
import type { DB } from '../../data/db';
import {
  createSupportAccessGrant,
  evaluateSupportAccess,
  getPlatformSession,
  listSupportAccessGrants,
  PlatformAccessError,
  revokePlatformSession,
  revokeSupportAccessGrant,
  verifyPlatformCsrfToken,
  type SupportAccessMode,
} from '../../auth/platformSupport';
import {
  listCompanyAllocations,
  listMasterEntitlements,
  listPlatformTenants,
  setCompanyAllocation,
  setMasterEntitlement,
} from '../../auth/platformEntitlement';
import { apiError, context } from '../http';

function bearerToken(req: express.Request): string | undefined {
  const value = req.header('authorization');
  if (!value?.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length).trim();
  return token || undefined;
}

async function requirePlatformSession(
  db: DB,
  req: express.Request,
  res: express.Response,
  options: { mutate?: boolean } = {},
) {
  const token = bearerToken(req);
  const session = await getPlatformSession(db, token);
  if (!session) {
    apiError(res, 401, 'platform_not_authenticated', 'A valid platform session is required.');
    return null;
  }
  if (options.mutate && !await verifyPlatformCsrfToken(db, token, req.header('x-platform-csrf-token'))) {
    apiError(res, 403, 'platform_csrf_invalid', 'A valid platform CSRF token is required.');
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

export function createPlatformRouter(db: DB): Router {
  const router = Router();

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
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
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
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
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
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
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
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
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
    const auth = await requirePlatformSession(db, req, res, { mutate: true });
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

  // This endpoint is intentionally not a public login/provisioning flow. Platform
  // principal and session issuance belongs to deployment/SSO bootstrap code.
  router.post('/session', (_req, res) => {
    apiError(res, 405, 'platform_session_provisioning_only', 'Platform sessions are provisioned outside the tenant API.');
  });

  return router;
}
