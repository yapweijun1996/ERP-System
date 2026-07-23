import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { hasPermission, isSuperadminSession } from '../../auth/permissions';
import { isModuleEnabled, moduleKeyForResourcePrefix } from '../../auth/moduleAccess';
import type { SessionData } from '../../auth/session';
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
import { SalesDebitNoteError } from '../../modules/sales/debitNote';
import { SalesPricingError } from '../../modules/sales/pricing';
import { SalesCreditError } from '../../modules/sales/creditControl';
import { SalesOrderValidationError } from '../../modules/sales/createSalesOrder';
import { SalesOrderApprovalError } from '../../modules/sales/salesOrderApproval';
import { PurchaseOrderApprovalError } from '../../modules/purchasing/purchaseOrderApproval';
import { SupplierPricingError } from '../../modules/purchasing/supplierPricing';
import { SalesCommissionError } from '../../modules/sales/commission';
import { ManualJournalError } from '../../modules/finance/manualJournal';
import { BankReconciliationError } from '../../modules/finance/bankReconciliation';
import {
  InventoryProductConflictError,
  InventoryProductValidationError,
} from '../../modules/inventory/product';
import { ProjectTimeEntryError } from '../../modules/project/timeEntry';
import { CustomerImportValidationError } from '../../modules/integration/customerImport';
import { NotificationError } from '../../modules/account/notification';

export function createResourceRouter(db: DB): Router {
  const router = Router();

  // Superadmins are exempt: this gate restricts what a master's *other* users can
  // reach, not the superadmin's own visibility (EPIC-018).
  async function moduleAccessDenied(session: SessionData, modulePrefix: string): Promise<boolean> {
    if (await isModuleEnabled(db, session.masterFn, moduleKeyForResourcePrefix(modulePrefix))) return false;
    return !await isSuperadminSession(db, session);
  }

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
    if (await moduleAccessDenied(session, req.params.module)) {
      apiError(res, 403, 'module_disabled', `The ${req.params.module} module is disabled for this organization.`);
      return;
    }
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
        const created = await createDefinition.execute(tx, scope, payload, session.userId);
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
      if (error instanceof InventoryProductConflictError) {
        apiError(res, 409, 'product_conflict', error.message);
        return;
      }
      if (
        error instanceof InventoryProductValidationError
        || error instanceof CustomerImportValidationError
        || error instanceof ProjectTimeEntryError
        || error instanceof InventoryAdjustmentValidationError
        || error instanceof StockTransferValidationError
        || error instanceof InventoryTrackingError
        || error instanceof PurchasingPostingError
        || error instanceof InvalidOpportunityStateError
        || error instanceof QualityInspectionError
        || error instanceof SalesQuotationError
        || error instanceof SalesReturnError
        || error instanceof SalesDebitNoteError
        || error instanceof SalesPricingError
        || error instanceof SupplierPricingError
        || error instanceof SalesCreditError
        || error instanceof SalesOrderValidationError
        || error instanceof SalesCommissionError
        || error instanceof ManualJournalError
        || error instanceof BankReconciliationError
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
      if (await moduleAccessDenied(session, req.params.module)) {
        apiError(res, 403, 'module_disabled', `The ${req.params.module} module is disabled for this organization.`);
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.userId,
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
      if (await moduleAccessDenied(session, req.params.module)) {
        apiError(res, 403, 'module_disabled', `The ${req.params.module} module is disabled for this organization.`);
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.userId,
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
    if (await moduleAccessDenied(session, req.params.module)) {
      apiError(res, 403, 'module_disabled', `The ${req.params.module} module is disabled for this organization.`);
      return;
    }
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
      if (error instanceof NotificationError) {
        const unavailable = error.message.includes('unavailable');
        apiError(
          res,
          unavailable ? 404 : 409,
          unavailable ? 'notification_not_found' : 'notification_conflict',
          error.message,
        );
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
        error instanceof InventoryProductConflictError
        || error instanceof ProjectTimeEntryError
        || error instanceof InvalidInventoryAdjustmentStateError
        || error instanceof InventorySnapshotConflictError
        || error instanceof InvalidStockTransferStateError
        || error instanceof InvalidPurchaseOrderStateError
        || error instanceof PurchaseOrderApprovalError
        || error instanceof SalesOrderApprovalError
        || error instanceof SupplierPricingError
        || error instanceof SalesCommissionError
        || error instanceof ManualJournalError
        || error instanceof BankReconciliationError
      ) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      if (
        error instanceof InventoryProductValidationError
        || error instanceof InventoryAdjustmentValidationError
        || error instanceof StockTransferValidationError
        || error instanceof InventoryTrackingError
        || error instanceof QualityInspectionError
        || error instanceof SalesOrderValidationError
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
      if (error instanceof SalesDebitNoteError) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      if (error instanceof SalesPricingError) {
        apiError(res, 409, 'invalid_state', error.message);
        return;
      }
      if (error instanceof SalesCreditError) {
        apiError(res, 409, 'credit_control', error.message);
        return;
      }
      throw error;
    }
  });

  return router;
}
