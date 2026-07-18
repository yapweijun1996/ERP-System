import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { hasPermission } from '../../auth/permissions';
import {
  InvalidResourceQueryError,
  UnknownResourceError,
  getResource,
  isKnownResource,
  listResource,
  readPermissionForResource,
  resourceDefinitionFor,
} from '../resources';
import { apiError, context, requireSession } from '../http';
import { actionDefinitionFor } from '../actions';
import { ActionDispatchError, dispatchAction } from '../actionDispatcher';
import { InsufficientStockError } from '../../modules/inventory/stock';
import { InvalidOpportunityStateError } from '../../modules/crm/errors';
import { PostingError } from '../../modules/sales/confirmOrder';

export function createResourceRouter(db: DB): Router {
  const router = Router();

  router.get('/:module/:resource', async (req, res) => {
    const resource = `${req.params.module}/${req.params.resource}`;
    if (!isKnownResource(resource)) {
      apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
      return;
    }
    try {
      const session = await requireSession(db, req, res);
      if (!session) return;
      if (!await hasPermission(db, session, readPermissionForResource(resource))) {
        apiError(res, 403, 'permission_denied', 'You cannot read this ERP resource.');
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      res.json(await withTenantTransaction(db, scope, (tx) =>
        listResource(tx, scope, resource, req.query)));
    } catch (error) {
      if (error instanceof InvalidResourceQueryError) {
        apiError(res, 400, 'invalid_query', error.message);
        return;
      }
      if (error instanceof UnknownResourceError) {
        apiError(res, 404, 'resource_not_found', error.message);
        return;
      }
      throw error;
    }
  });

  router.get('/:module/:resource/:id', async (req, res) => {
    const resource = `${req.params.module}/${req.params.resource}`;
    if (!isKnownResource(resource)) {
      apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
      return;
    }
    try {
      const session = await requireSession(db, req, res);
      if (!session) return;
      if (!await hasPermission(db, session, readPermissionForResource(resource))) {
        apiError(res, 403, 'permission_denied', 'You cannot read this ERP resource.');
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const result = await withTenantTransaction(db, scope, (tx) =>
        getResource(tx, scope, resource, req.params.id));
      if (!result) {
        apiError(res, 404, 'record_not_found', `No ${resource} record exists with id ${req.params.id}.`);
        return;
      }
      const version = (result.data as { version?: unknown }).version;
      if (typeof version === 'number') res.setHeader('ETag', `"${version}"`);
      res.json(result);
    } catch (error) {
      if (error instanceof InvalidResourceQueryError) {
        apiError(res, 400, 'invalid_id', error.message, { id: error.message });
        return;
      }
      throw error;
    }
  });

  router.post('/:module/:resource/:id/actions/:action', async (req, res) => {
    const resource = `${req.params.module}/${req.params.resource}`;
    if (!isKnownResource(resource)) {
      apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
      return;
    }
    const definition = resourceDefinitionFor(resource);
    if (!definition.allowedActions.includes(req.params.action)) {
      apiError(res, 404, 'action_not_found', `Unknown action '${req.params.action}' for ${resource}.`);
      return;
    }
    const actionDefinition = actionDefinitionFor(resource, req.params.action);
    if (!actionDefinition) {
      apiError(res, 404, 'action_not_found', `Action '${req.params.action}' is not registered.`);
      return;
    }
    const resourceId = Number(req.params.id);
    if (!Number.isSafeInteger(resourceId) || resourceId <= 0) {
      apiError(res, 400, 'invalid_id', 'id must be a positive integer.', {
        id: 'id must be a positive integer.',
      });
      return;
    }
    const session = await requireSession(db, req, res);
    if (!session) return;
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      apiError(res, 400, 'invalid_request', 'A JSON object body is required.');
      return;
    }
    try {
      const result = await dispatchAction({
        db,
        session,
        resource,
        resourceId,
        action: req.params.action,
        payload,
        idempotencyKey: req.header('idempotency-key'),
        requestId: context(res).requestId,
      }, actionDefinition);
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
      res.status(result.status).json(result.body);
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
      if (error instanceof InsufficientStockError) {
        apiError(res, 409, 'insufficient_stock', error.message);
        return;
      }
      if (error instanceof InvalidOpportunityStateError) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      if (error instanceof PostingError) {
        apiError(res, 422, 'posting_failed', error.message);
        return;
      }
      throw error;
    }
  });

  return router;
}
