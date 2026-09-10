import { Router } from 'express';
import type express from 'express';
import type { DB } from '../../data/db';
import { AuthLifecycleError } from '../../auth/authErrors';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import {
  createAgentGrant,
  createAgentPrincipal,
  listAgentPrincipals,
  revokeAgentGrant,
  rotateAgentCredential,
  setAgentPrincipalStatus,
  type RevokeAgentGrantInput,
  type RotateAgentCredentialInput,
  type SetAgentPrincipalStatusInput,
} from '../../modules/agent/agentIdentity';
import { apiError, context, requireSession } from '../http';

function positiveId(value: unknown, _field: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handleError(res: express.Response, error: unknown): void {
  if (error instanceof AuthLifecycleError) {
    apiError(res, error.status, error.code, error.message, error.fieldErrors);
    return;
  }
  throw error;
}

export function createAdminAgentsRouter(db: DB): Router {
  const router = Router();

  router.get('/agents', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersRead)
      && !await hasPermission(db, session, PERMISSIONS.usersManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot review Agent identities.');
      return;
    }
    try {
      const data = await listAgentPrincipals(db, session);
      res.json({ data, meta: { tenantScoped: true, secretFields: 'omitted' } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/agents', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      const data = await createAgentPrincipal(
        db,
        session,
        req.body ?? {},
        context(res).requestId,
      );
      res.status(201).json({ data, meta: { tenantScoped: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/agents/:agentId/grants', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const agentPrincipalId = positiveId(req.params.agentId, 'agentPrincipalId');
    if (agentPrincipalId == null) {
      apiError(res, 400, 'invalid_id', 'agentPrincipalId must be a positive integer.');
      return;
    }
    try {
      const data = await createAgentGrant(db, session, {
        ...(req.body ?? {}),
        agentPrincipalId,
      }, context(res).requestId);
      res.status(201).json({ data, meta: { tenantScoped: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/agents/:agentId/grants/:grantId/actions/revoke', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const agentPrincipalId = positiveId(req.params.agentId, 'agentPrincipalId');
    const grantId = positiveId(req.params.grantId, 'grantId');
    if (agentPrincipalId == null || grantId == null) {
      apiError(res, 400, 'invalid_id', 'Agent principal and grant ids must be positive integers.');
      return;
    }
    try {
      const data = await revokeAgentGrant(db, session, {
        ...(req.body ?? {}),
        agentPrincipalId,
        grantId,
      } satisfies RevokeAgentGrantInput, context(res).requestId);
      res.json({ data, meta: { tenantScoped: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/agents/:agentId/actions/:action', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const agentPrincipalId = positiveId(req.params.agentId, 'agentPrincipalId');
    if (agentPrincipalId == null) {
      apiError(res, 400, 'invalid_id', 'agentPrincipalId must be a positive integer.');
      return;
    }
    try {
      if (req.params.action === 'rotate-credential') {
        const data = await rotateAgentCredential(db, session, {
          ...(req.body ?? {}),
          agentPrincipalId,
        } satisfies RotateAgentCredentialInput, context(res).requestId);
        res.status(201).json({
          data,
          meta: {
            tenantScoped: true,
            credentialDelivery: 'show_once',
            warning: 'Store this token now. It cannot be retrieved again.',
          },
        });
        return;
      }
      const statusByAction: Record<string, SetAgentPrincipalStatusInput['status']> = {
        pause: 'paused',
        resume: 'active',
        disable: 'disabled',
        revoke: 'revoked',
      };
      const status = statusByAction[req.params.action];
      if (!status) {
        apiError(res, 400, 'agent_action_unknown', 'Agent lifecycle action is not supported.');
        return;
      }
      const data = await setAgentPrincipalStatus(db, session, {
        ...(req.body ?? {}),
        agentPrincipalId,
        status,
      }, context(res).requestId);
      res.json({ data, meta: { tenantScoped: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
