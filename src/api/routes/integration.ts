import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { encryptToken } from '../../auth/tokenCrypto';
import {
  checkConnectorHealthWithin,
  configureConnectorWithin,
  ConnectorError,
  listConnectorsWithin,
  setConnectorEnabledWithin,
} from '../../modules/integration/connector';
import { apiError, context, requireSession } from '../http';
import { ActionDispatchError, dispatchAction } from '../actionDispatcher';

export function createIntegrationRouter(db: DB, encryptionKey?: Buffer): Router {
  const router = Router();

  router.get('/connectors', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.integrationRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read connectors.'); return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    res.json({ data: await withTenantTransaction(db, scope, (tx) => listConnectorsWithin(tx, scope)), meta: {} });
  });

  router.post('/connectors/:id/actions/:action', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) { apiError(res, 400, 'invalid_id', 'Connector id must be a positive integer.'); return; }
    const action = req.params.action;
    if (!['pause', 'resume', 'check-health', 'configure'].includes(action)) {
      apiError(res, 404, 'action_not_found', 'Unknown connector action.'); return;
    }
    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    try {
      const result = await dispatchAction({
        db, session, resource: 'integration/connectors', resourceId: id, action,
        payload, idempotencyKey: req.header('idempotency-key'), requestId: context(res).requestId,
      }, {
        permission: PERMISSIONS.integrationManage, idempotency: 'required', audit: 'none',
        execute: async (tx, scope, input) => {
          const actor = { userId: input.actorUserId, requestId: context(res).requestId };
          if (action === 'pause') return setConnectorEnabledWithin(tx, scope, actor, id, false);
          if (action === 'resume') return setConnectorEnabledWithin(tx, scope, actor, id, true);
          if (action === 'check-health') return checkConnectorHealthWithin(tx, scope, actor, id);
          if (!encryptionKey) throw new ConnectorError('encryption_unavailable', 'Server credential encryption is not configured.');
          const body = payload as { secret?: unknown; label?: unknown; endpointHost?: unknown };
          if (typeof body.secret !== 'string' || body.secret.length < 8 || body.secret.length > 4096) {
            throw new ConnectorError('invalid_secret', 'Credential must contain 8–4096 characters.');
          }
          return configureConnectorWithin(tx, scope, actor, id, {
            credentialEnvelope: encryptToken(body.secret, encryptionKey),
            credentialLabel: typeof body.label === 'string' ? body.label : '',
            endpointHost: typeof body.endpointHost === 'string' ? body.endpointHost : null,
          });
        },
      });
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
      res.status(result.status).json(result.body);
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message); return;
      }
      if (error instanceof ConnectorError) {
        const status = error.code === 'not_found' ? 404 : error.code === 'encryption_unavailable' ? 503 : 422;
        apiError(res, status, error.code, error.message); return;
      }
      throw error;
    }
  });
  return router;
}
