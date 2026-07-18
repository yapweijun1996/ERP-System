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
import {
  InvalidSalesOrderStateError,
  PostingError,
} from '../../modules/sales/confirmOrder';
import {
  InventoryAdjustmentValidationError,
  InventorySnapshotConflictError,
  InvalidInventoryAdjustmentStateError,
} from '../../modules/inventory/adjustment';
import {
  InvalidStockTransferStateError,
  StockTransferValidationError,
} from '../../modules/inventory/transfer';
import { createDefinitionFor } from '../creates';
import { appendAudit } from '../audit';
import { InventoryTrackingError } from '../../modules/inventory/tracking';
import {
  InvalidPurchaseOrderStateError,
  PostingError as PurchasingPostingError,
} from '../../modules/purchasing/errors';
import { QualityInspectionError } from '../../modules/quality/inspection';
import { SalesQuotationError } from '../../modules/sales/quotation';
import { SalesReturnError } from '../../modules/sales/return';

export function createResourceRouter(db: DB): Router {
  const router = Router();

  router.post('/:module/:resource', async (req, res) => {
    const resource = `${req.params.module}/${req.params.resource}`;
    if (!isKnownResource(resource)) {
      apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
      return;
    }
    const resourceDefinition = resourceDefinitionFor(resource);
    const createDefinition = createDefinitionFor(resource);
    if (!resourceDefinition.createPermission || !createDefinition) {
      apiError(res, 405, 'create_not_supported', `Creating ${resource} is not supported.`);
      return;
    }
    const session = await requireSession(db, req, res);
    if (!session) return;
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      apiError(res, 400, 'invalid_request', 'A JSON object body is required.');
      return;
    }
    if ('masterFn' in payload || 'companyFn' in payload) {
      apiError(res, 400, 'tenant_override_rejected', 'Tenant scope comes from the authenticated session.');
      return;
    }
    const scope = {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    };
    try {
      const result = await withTenantTransaction(db, scope, async (tx) => {
        if (!await hasPermission(tx, session, createDefinition.permission)) {
          throw new ActionDispatchError(403, 'permission_denied', 'You cannot create this ERP resource.');
        }
        const created = await createDefinition.execute(tx, scope, payload);
        const entityId = (created as { id?: unknown }).id;
        await appendAudit(tx, {
          masterFn: scope.masterFn,
          companyFn: scope.companyFn,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: resource,
          entityId: typeof entityId === 'number' ? entityId : null,
          action: 'create',
          after: created,
        });
        return created;
      });
      res.status(201).json({ data: result, meta: {} });
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
      if (
        error instanceof InventoryAdjustmentValidationError
        || error instanceof StockTransferValidationError
        || error instanceof InventoryTrackingError
        || error instanceof PurchasingPostingError
        || error instanceof InvalidOpportunityStateError
        || error instanceof QualityInspectionError
        || error instanceof SalesQuotationError
        || error instanceof SalesReturnError
        || error instanceof RangeError
      ) {
        apiError(res, 422, 'validation_failed', error.message);
        return;
      }
      throw error;
    }
  });

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
      if (error instanceof InvalidSalesOrderStateError) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      if (error instanceof PostingError) {
        apiError(res, 422, 'posting_failed', error.message);
        return;
      }
      if (
        error instanceof InvalidInventoryAdjustmentStateError
        || error instanceof InventorySnapshotConflictError
        || error instanceof InvalidStockTransferStateError
        || error instanceof InvalidPurchaseOrderStateError
      ) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      if (
        error instanceof InventoryAdjustmentValidationError
        || error instanceof StockTransferValidationError
        || error instanceof InventoryTrackingError
        || error instanceof QualityInspectionError
        || error instanceof RangeError
      ) {
        apiError(res, 422, 'validation_failed', error.message);
        return;
      }
      if (error instanceof PurchasingPostingError) {
        apiError(res, 422, 'posting_failed', error.message);
        return;
      }
      if (error instanceof SalesQuotationError) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      if (error instanceof SalesReturnError) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      throw error;
    }
  });

  return router;
}
