import { Router } from 'express';
import type express from 'express';
import type { DB } from '../../data/db';
import {
  AgentActionContractError,
} from '../../modules/agent/actionContracts';
import {
  dispatchAuthenticatedAgentAction,
  type AgentActionDispatchResult,
} from '../agentActions';
import { ActionDispatchError } from '../actionDispatcher';
import { runWithAuditAttribution } from '../auditContext';
import { AuthLifecycleError } from '../../auth/authErrors';
import {
  bearerAgentToken,
  createDatabaseAgentCredentialAuthenticator,
  type AgentCredentialAuthenticator,
  type AuthenticatedAgentIdentity,
} from '../../auth/agentAuthentication';
import { apiError, context } from '../http';
import { McpRateLimiter, type McpRateLimitPolicy } from '../mcpRateLimit';
import {
  ProductCaseError,
  appendAgentProductCaseEvidence,
  readAgentProductCase,
  submitAgentProductCase,
} from '../../modules/product/productCase';

const FORBIDDEN_IDENTITY_KEYS = new Set([
  'masterfn', 'companyfn', 'tenant', 'tenantid', 'masterid', 'companyid',
  'agentprincipalid', 'principalid', 'actoruserid', 'userid', 'owneruserid',
  'delegatoruserid', 'sessionid', 'role', 'permission', 'permissions',
  'authorization', 'delegation', 'delegatedby',
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function identityPath(value: unknown): string | null {
  const visited = new WeakSet<object>();
  function visit(current: unknown, path: string): string | null {
    if (current == null || typeof current !== 'object') return null;
    if (visited.has(current)) return null;
    visited.add(current);
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        const found = visit(current[index], `${path}[${index}]`);
        if (found) return found;
      }
      return null;
    }
    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      const next = `${path}.${key}`;
      if (FORBIDDEN_IDENTITY_KEYS.has(normalizedKey(key))) return next;
      const found = visit(nested, next);
      if (found) return found;
    }
    return null;
  }
  return visit(value, '$');
}

function validIdentity(value: AuthenticatedAgentIdentity): boolean {
  return Number.isSafeInteger(value.agentPrincipalId)
    && value.agentPrincipalId > 0
    && Boolean(value.masterFn?.trim())
    && Boolean(value.companyFn?.trim())
    && Boolean(value.issuer?.trim())
    && Boolean(value.audience?.trim())
    && Boolean(value.subject?.trim());
}

function handleAgentError(res: express.Response, error: unknown): void {
  if (error instanceof ProductCaseError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof ActionDispatchError || error instanceof AuthLifecycleError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof AgentActionContractError) {
    apiError(res, 400, error.code, error.message, { path: error.path });
    return;
  }
  throw error;
}

function sendAgentResult(res: express.Response, result: AgentActionDispatchResult): void {
  if (result.kind === 'binary') {
    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
    res.setHeader('X-Agent-Action', result.action);
    res.setHeader('X-Agent-Action-Version', String(result.version));
    res.status(result.status).send(Buffer.from(result.content));
    return;
  }
  res.status(result.status).json({
    action: result.action,
    version: result.version,
    body: result.body,
  });
}

export interface AgentRouterOptions {
  authenticator?: AgentCredentialAuthenticator;
  caseRateLimit?: {
    perAgent?: McpRateLimitPolicy;
    perCompany?: McpRateLimitPolicy;
  };
}

/**
 * Separate bearer boundary for Agent adapters. This route never accepts a
 * human browser session or a body-supplied principal. Credential validation is
 * delegated to the configured issuer adapter; ERP authorization starts only
 * after that adapter returns a verified principal claim.
 */
export function createAgentRouter(db: DB, options: AgentRouterOptions = {}): Router {
  const router = Router();
  const authenticator = options.authenticator ?? createDatabaseAgentCredentialAuthenticator(db);
  const agentCaseLimiter = new McpRateLimiter(options.caseRateLimit?.perAgent ?? {
    maxRequests: 10, windowMs: 60_000,
  });
  const companyCaseLimiter = new McpRateLimiter(options.caseRateLimit?.perCompany ?? {
    maxRequests: 50, windowMs: 60_000,
  });

  async function authenticateAgent(req: express.Request, res: express.Response) {
    const requestId = context(res).requestId;
    try {
      const identity = await authenticator.authenticate({
        bearerToken: bearerAgentToken(req),
        requestId,
        method: req.method,
        path: req.path,
      });
      if (identity && validIdentity(identity)) return identity;
    } catch {
      // Issuer details must never be reflected to the caller.
    }
    apiError(res, 401, 'agent_not_authenticated', 'A valid Agent credential is required.');
    return null;
  }

  router.post('/cases', async (req, res) => {
    const suppliedIdentity = identityPath(req.body);
    if (suppliedIdentity) {
      apiError(res, 400, 'agent_identity_in_body', 'Agent and tenant identity must come from the issuer.', { path: suppliedIdentity });
      return;
    }
    const identity = await authenticateAgent(req, res);
    if (!identity) return;
    const agentLimit = agentCaseLimiter.check(
      `${identity.masterFn}\0${identity.companyFn}\0${identity.agentPrincipalId}`,
    );
    const companyLimit = agentLimit.allowed
      ? companyCaseLimiter.check(`${identity.masterFn}\0${identity.companyFn}`)
      : null;
    res.setHeader('RateLimit-Limit', String(agentLimit.limit));
    res.setHeader('RateLimit-Remaining', String(agentLimit.remaining));
    const limited = !agentLimit.allowed ? agentLimit : companyLimit && !companyLimit.allowed ? companyLimit : null;
    if (limited) {
      res.setHeader('Retry-After', String(limited.retryAfterSeconds));
      apiError(res, 429, 'product_case_rate_limited', 'Product case intake rate limit exceeded.');
      return;
    }
    try {
      const result = await runWithAuditAttribution({
        agentPrincipalId: identity.agentPrincipalId,
      }, () => submitAgentProductCase(
        db, identity, req.body, req.header('idempotency-key'), context(res).requestId,
      ));
      res.setHeader('Cache-Control', 'no-store');
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      handleAgentError(res, error);
    }
  });

  router.get('/cases/:id', async (req, res) => {
    const identity = await authenticateAgent(req, res);
    if (!identity) return;
    try {
      const data = await readAgentProductCase(db, identity, req.params.id);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ data });
    } catch (error) {
      handleAgentError(res, error);
    }
  });

  router.post('/cases/:id/evidence', async (req, res) => {
    const suppliedIdentity = identityPath(req.body);
    if (suppliedIdentity) {
      apiError(res, 400, 'agent_identity_in_body', 'Agent and tenant identity must come from the issuer.', { path: suppliedIdentity });
      return;
    }
    const identity = await authenticateAgent(req, res);
    if (!identity) return;
    const agentLimit = agentCaseLimiter.check(
      `${identity.masterFn}\0${identity.companyFn}\0${identity.agentPrincipalId}`,
    );
    const companyLimit = agentLimit.allowed
      ? companyCaseLimiter.check(`${identity.masterFn}\0${identity.companyFn}`)
      : null;
    const limited = !agentLimit.allowed ? agentLimit : companyLimit && !companyLimit.allowed ? companyLimit : null;
    if (limited) {
      res.setHeader('Retry-After', String(limited.retryAfterSeconds));
      apiError(res, 429, 'product_case_rate_limited', 'Product case intake rate limit exceeded.');
      return;
    }
    try {
      const result = await runWithAuditAttribution({
        agentPrincipalId: identity.agentPrincipalId,
      }, () => appendAgentProductCaseEvidence(
        db, identity, req.params.id, req.body, req.header('idempotency-key'), context(res).requestId,
      ));
      res.setHeader('Cache-Control', 'no-store');
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      handleAgentError(res, error);
    }
  });

  router.post('/actions', async (req, res) => {
    const suppliedIdentity = identityPath(req.body);
    if (suppliedIdentity) {
      apiError(
        res,
        400,
        'agent_identity_in_body',
        'Agent actor and tenant identity must come from the authenticated issuer.',
        { path: suppliedIdentity },
      );
      return;
    }
    const requestId = context(res).requestId;
    let identity: AuthenticatedAgentIdentity | null;
    try {
      identity = await authenticator.authenticate({
        bearerToken: bearerAgentToken(req),
        requestId,
        method: req.method,
        path: req.path,
      });
    } catch {
      apiError(res, 401, 'agent_not_authenticated', 'A valid Agent credential is required.');
      return;
    }
    if (!identity || !validIdentity(identity)) {
      apiError(res, 401, 'agent_not_authenticated', 'A valid Agent credential is required.');
      return;
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const action = typeof body.action === 'string' ? body.action : '';
    try {
      const result = await runWithAuditAttribution({
        agentPrincipalId: identity.agentPrincipalId,
      }, () => dispatchAuthenticatedAgentAction(db, {
        identity,
        action,
        input: body.input,
        requestId,
      }));
      sendAgentResult(res, result);
    } catch (error) {
      handleAgentError(res, error);
    }
  });

  return router;
}
