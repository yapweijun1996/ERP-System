import { Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  effectiveCapabilities, scopeForResource, scopeGrantsForResource,
} from '../../auth/permissions';
import { hasAnyAuthorization, authorize, principalFromSession } from '../../auth/authorization';
import { resolveScopedUserIds, type ScopeTarget } from '../../auth/dataScope';
import { isModuleEnabled, moduleKeyForResourcePrefix } from '../../auth/moduleAccess';
import type { SessionData } from '../../auth/session';
import type { DataScope } from '../../auth/accessCatalog';
import {
  InvalidResourceQueryError,
  UnknownResourceError,
  getResource,
  isKnownResource,
  listResource,
  createPermissionForResource,
  readPermissionForResource,
  resourceDefinitionFor,
  updatePermissionForResource,
} from '../resources';
import { apiError, context, requireSession } from '../http';
import { actionDefinitionFor } from '../actions';
import { ActionDispatchError, dispatchAction } from '../actionDispatcher';
import { InvalidAssetStateError } from '../../modules/assets/createAsset';
import {
  InvalidDepreciationRunStateError,
  PostingError as AssetPostingError,
} from '../../modules/assets/depreciationRun';
import { InsufficientStockError } from '../../modules/inventory/stock';
import { InvalidOpportunityStateError } from '../../modules/crm/errors';
import { InvalidContactStateError } from '../../modules/crm/contact';
import { InvalidActivityStateError } from '../../modules/crm/activity';
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
import { ManufacturingWorkOrderError } from '../../modules/manufacturing/workOrder';
import { MrpRunError } from '../../modules/manufacturing/mrp';
import {
  getSalesEnquiryAggregateWithin,
  SalesQuotationError,
} from '../../modules/sales/quotation';
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
import { BankReceiptError } from '../../modules/finance/bankReceipt';
import { PaymentVoucherError } from '../../modules/finance/paymentVoucher';
import { BankReconciliationError } from '../../modules/finance/bankReconciliation';
import {
  InventoryProductConflictError,
  InventoryProductValidationError,
} from '../../modules/inventory/product';
import { ProjectTimeEntryError } from '../../modules/project/timeEntry';
import { InvalidProjectStateError } from '../../modules/project/project';
import { ProjectProgressClaimError } from '../../modules/project/progressClaim';
import { InvalidServiceContractStateError } from '../../modules/service/serviceContract';
import { InvalidServiceTicketStateError } from '../../modules/service/serviceTicket';
import {
  CustomerImportStateError,
  CustomerImportValidationError,
} from '../../modules/integration/customerImport';
import { NotificationError } from '../../modules/account/notification';
import { PayrollLeaveError } from '../../modules/payroll/payrollLeave';
import {
  InvalidPayrollRunStateError,
  PostingError as PayrollPostingError,
} from '../../modules/payroll/payrollRun';
import { InvalidLeaveRequestStateError } from '../../modules/hr/leaveRequest';
import { WarehousePickError } from '../../modules/warehouse/picking';
import { PurchasingRfqError } from '../../modules/purchasing/rfq';
import { PurchaseRequisitionError } from '../../modules/purchasing/purchaseRequisition';
import { PurchaseReturnError } from '../../modules/purchasing/purchaseReturn';
import { SupplierDebitNoteError } from '../../modules/purchasing/supplierDebitNote';
import { LandedCostError } from '../../modules/purchasing/landedCost';
import {
  EmployeeCreateError,
  InvalidEmployeeStateError,
} from '../../modules/hr/employee';
import { customer } from '../../data/schema';
import { InvalidCustomerStateError } from '../../modules/crm/customer';
import { InventoryProductUpdateError } from '../../modules/inventory/product';
import { SupplierUpdateError } from '../../modules/purchasing/supplier';
import { CustomerUpdateError } from '../../modules/crm/customer';
import { isResourceUpdateError } from '../updates';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';

export function createResourceRouter(db: DB): Router {
  const router = Router();

  async function scopedReadContext(session: SessionData, resource: string, exec: DB = db) {
    const definition = resourceDefinitionFor(resource);
    const capabilities = await effectiveCapabilities(exec, session);
    const accessScope = scopeForResource(capabilities, resource);
    const scopeGrants = scopeGrantsForResource(capabilities, resource);
    if (!accessScope) {
      throw new ActionDispatchError(403, 'data_scope_denied', 'No data scope is assigned for this resource.');
    }
    if (accessScope === 'company') {
      const incompatibleCompanyTarget = scopeGrants.some((grant) =>
        grant.scope === 'company'
        && grant.targetType !== 'none'
        && !(grant.targetType === 'company' && grant.targetId === session.activeCompanyFn));
      if (incompatibleCompanyTarget) {
        throw new ActionDispatchError(403, 'data_scope_denied', 'The assigned company scope does not include this company.');
      }
      return { accessScope };
    }
    if (!definition.scopeUserIdColumn) {
      throw new ActionDispatchError(
        403,
        'data_scope_unavailable',
        'This resource has no ownership field for the assigned restricted data scope.',
      );
    }
    const rank: Record<DataScope, number> = {
      self: 0, team: 1, department: 2, company: 3,
    };
    const grants = scopeGrants.length
      ? scopeGrants.filter((grant) => rank[grant.scope] <= rank[accessScope])
      : [{ scope: accessScope, targetType: 'none', targetId: null }];
    const allowedUserIds = new Set<number>();
    for (const grant of grants) {
      const target: ScopeTarget = {
        targetType: grant.targetType,
        targetId: grant.targetId,
      };
      for (const userId of await resolveScopedUserIds(exec, session, grant.scope, target)) {
        allowedUserIds.add(userId);
      }
    }
    return {
      accessScope,
      allowedUserIds: [...allowedUserIds].sort((left, right) => left - right),
    };
  }

  async function moduleAccessDenied(session: SessionData, modulePrefix: string): Promise<boolean> {
    const moduleKey = moduleKeyForResourcePrefix(modulePrefix);
    if (moduleKey === null) return false;
    return !await isModuleEnabled(
      db,
      session.masterFn,
      session.activeCompanyFn,
      moduleKey,
    );
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
      apiError(res, 403, 'module_not_enabled', `The ${req.params.module} module is not enabled for this organization.`);
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
    const idempotencyKey = req.get('idempotency-key')?.trim();
    if (createDefinition.idempotency === 'required' && !idempotencyKey) {
      apiError(res, 428, 'idempotency_key_required', 'Idempotency-Key is required for this create request.');
      return;
    }
    if (idempotencyKey && idempotencyKey.length > 200) {
      apiError(res, 400, 'idempotency_key_invalid', 'Idempotency-Key is too long.');
      return;
    }
    const scope = {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    };
    try {
      const dispatched = await withTenantTransaction(db, scope, async (tx) => {
        if (!await hasAnyAuthorization(tx, session, [
          createPermissionForResource(resource),
          createDefinition.permission,
        ], { resourceKey: resource })) {
          throw new ActionDispatchError(403, 'permission_denied', 'You cannot create this ERP resource.');
        }
        if (resourceDefinition.scopeUserIdColumn) {
          const access = await scopedReadContext(session, resource, tx);
          if (access.accessScope && access.accessScope !== 'company') {
            const customerId = Number((payload as Record<string, unknown>).customerId);
            if (resource === 'sales/customers') {
              // Customer quick-create assigns the current actor as owner in the
              // domain command, so restricted sales scopes can create their own
              // customer without supplying a customerId in the request.
            } else if ((resource === 'sales/orders' || resource === 'crm/opportunities')
              && Number.isSafeInteger(customerId) && customerId > 0
              && access.allowedUserIds?.length) {
              const [visibleCustomer] = await tx.select({ id: customer.id }).from(customer).where(and(
                eq(customer.id, customerId), eq(customer.masterFn, session.masterFn),
                eq(customer.companyFn, session.activeCompanyFn),
                inArray(customer.ownerUserId, access.allowedUserIds),
              )).limit(1);
              if (!visibleCustomer) {
                throw new ActionDispatchError(403, 'data_scope_denied', 'The referenced customer is outside your data scope.');
              }
            } else if (resource !== 'crm/opportunities') {
              throw new ActionDispatchError(403, 'data_scope_denied', 'Ownership cannot be established for this create request.');
            }
          }
        }
        let claimId: number | null = null;
        if (idempotencyKey) {
          const claim = await beginIdempotentRequest(tx, {
            ...scope,
            actorUserId: session.userId,
          }, idempotencyKey, `${resource}:create`, payload);
          if (claim.kind === 'replay') {
            return { status: claim.status, body: claim.body, replayed: true };
          }
          if (claim.kind === 'conflict') {
            throw new ActionDispatchError(
              409,
              claim.reason === 'different_request'
                ? 'idempotency_key_reused'
                : 'idempotency_request_in_progress',
              claim.reason === 'different_request'
                ? 'This Idempotency-Key was already used for a different request.'
                : 'An identical request is already in progress.',
            );
          }
          claimId = claim.recordId;
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
        const body = { data: created, meta: {} };
        if (claimId != null) {
          await completeIdempotentRequest(tx, claimId, 201, body);
        }
        return { status: 201, body, replayed: false };
      });
      if (dispatched.replayed) res.setHeader('Idempotency-Replayed', 'true');
      res.status(dispatched.status).json(dispatched.body);
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
      if (error instanceof InventoryProductConflictError) {
        apiError(res, 409, 'product_conflict', error.message);
        return;
      }
      if (error instanceof PayrollLeaveError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
      if (error instanceof EmployeeCreateError) {
        apiError(res, error.status, error.code, error.message, error.fieldErrors);
        return;
      }
      if (error instanceof InvalidEmployeeStateError) {
        apiError(res, 422, 'validation_failed', error.message);
        return;
      }
      if (
        error instanceof InventoryProductValidationError
        || error instanceof InvalidAssetStateError
        || error instanceof InvalidDepreciationRunStateError
        || error instanceof AssetPostingError
        || error instanceof CustomerImportValidationError
        || error instanceof CustomerImportStateError
        || error instanceof ProjectTimeEntryError
        || error instanceof InvalidProjectStateError
        || error instanceof ProjectProgressClaimError
        || error instanceof InvalidServiceContractStateError
        || error instanceof InvalidServiceTicketStateError
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
        || error instanceof InvalidCustomerStateError
        || error instanceof SalesOrderValidationError
        || error instanceof SalesCommissionError
        || error instanceof ManualJournalError
        || error instanceof BankReceiptError
        || error instanceof PaymentVoucherError
        || error instanceof BankReconciliationError
        || error instanceof WarehousePickError
        || error instanceof InvalidContactStateError
        || error instanceof InvalidActivityStateError
        || error instanceof ManufacturingWorkOrderError
        || error instanceof MrpRunError
        || error instanceof InvalidLeaveRequestStateError
        || error instanceof InvalidPayrollRunStateError
        || error instanceof PayrollPostingError
        || error instanceof PurchasingRfqError
        || error instanceof PurchaseRequisitionError
        || error instanceof PurchaseReturnError
        || error instanceof SupplierDebitNoteError
        || error instanceof LandedCostError
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
      if (!(await authorize(db, {
        principal: principalFromSession(session),
        permissionKey: readPermissionForResource(resource),
        resourceKey: resource,
      })).allowed) {
        apiError(res, 403, 'permission_denied', 'You cannot read this ERP resource.');
        return;
      }
      if (await moduleAccessDenied(session, req.params.module)) {
        apiError(res, 403, 'module_not_enabled', `The ${req.params.module} module is not enabled for this organization.`);
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.userId,
        ...await scopedReadContext(session, resource),
      };
      res.json(await withTenantTransaction(db, scope, (tx) =>
        listResource(tx, scope, resource, req.query)));
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
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

  router.patch('/:module/:resource/:id', async (req, res) => {
    const resource = `${req.params.module}/${req.params.resource}`;
    if (!isKnownResource(resource)) {
      apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
      return;
    }
    const definition = resourceDefinitionFor(resource);
    const update = definition.updateDefinition;
    if (!update) {
      apiError(res, 405, 'update_not_supported', `Updating ${resource} is not supported.`);
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
      apiError(res, 403, 'module_not_enabled', `The ${req.params.module} module is not enabled for this organization.`);
      return;
    }
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      apiError(res, 400, 'invalid_request', 'A JSON object body is required.');
      return;
    }
    const forbidden = ['id', 'masterFn', 'companyFn', 'createdAt', 'updatedAt', 'version']
      .find((field) => field in payload);
    if (forbidden) {
      apiError(res, 400, 'immutable_field', `${forbidden} cannot be changed from this editor.`);
      return;
    }
    const rawIfMatch = req.header('if-match')?.trim() ?? '';
    const token = rawIfMatch.replace(/^W\//i, '').replace(/^"|"$/g, '');
    if (!token || token === '*') {
      apiError(res, 428, 'if_match_required', 'If-Match is required when updating master data.');
      return;
    }
    if (update.concurrency === 'integer' && (!/^\d+$/.test(token) || Number(token) < 1)) {
      apiError(res, 400, 'if_match_invalid', 'If-Match must contain a positive integer version.');
      return;
    }
    if (update.concurrency === 'updated_at' && Number.isNaN(new Date(token).getTime())) {
      apiError(res, 400, 'if_match_invalid', 'If-Match must contain a valid updatedAt timestamp.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.userId,
        ...await scopedReadContext(session, resource),
      };
      const result = await withTenantTransaction(db, scope, async (tx) => {
        if (!await hasAnyAuthorization(tx, session, [
          updatePermissionForResource(resource),
          update.permission,
        ], { resourceKey: resource })) {
          throw new ActionDispatchError(403, 'permission_denied', 'You cannot update this ERP resource.');
        }
        const visible = await getResource(tx, scope, resource, resourceId);
        if (!visible) {
          throw new ActionDispatchError(404, 'record_not_found', 'The record is unavailable in your data scope.');
        }
        const result = await update.execute(tx, scope, resourceId, payload as Record<string, unknown>, token);
        await appendAudit(tx, {
          masterFn: scope.masterFn,
          companyFn: scope.companyFn,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: resource,
          entityId: resourceId,
          action: 'update',
          before: result.before,
          after: result.after,
        });
        return result;
      });
      const after = result.after as { version?: unknown; updatedAt?: unknown };
      const etagValue = update.concurrency === 'integer'
        ? after.version
        : after.updatedAt instanceof Date ? after.updatedAt.toISOString() : after.updatedAt;
      if (etagValue != null) res.setHeader('ETag', `"${String(etagValue)}"`);
      res.json({
        data: result.after,
        meta: { concurrency: update.concurrency },
      });
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
      if (isResourceUpdateError(error)) {
        apiError(res, error.status, error.code, error.message, error.fieldErrors);
        return;
      }
      if (error instanceof InventoryProductValidationError) {
        apiError(res, 422, 'validation_failed', error.message, error.fieldErrors);
        return;
      }
      if (error instanceof InvalidCustomerStateError || error instanceof SupplierUpdateError
        || error instanceof CustomerUpdateError || error instanceof InventoryProductUpdateError) {
        const updateError = error as Error & { status?: number; code?: string; fieldErrors?: Record<string, string> };
        apiError(
          res,
          updateError.status ?? 422,
          updateError.code ?? 'validation_failed',
          updateError.message,
          updateError.fieldErrors,
        );
        return;
      }
      if (error instanceof InvalidResourceQueryError) {
        apiError(res, 400, 'invalid_id', error.message, { id: error.message });
        return;
      }
      throw error;
    }
  });

  /** Canonical transaction read: one tenant-scoped aggregate instead of making
   * the browser assemble header, customer, lines and linked quotations. Product
   * master data remains a separate reference collection for the line editor. */
  router.get('/sales/enquiries/:id/aggregate', async (req, res) => {
    const resource = 'sales/enquiries';
    const resourceId = Number(req.params.id);
    if (!Number.isSafeInteger(resourceId) || resourceId <= 0) {
      apiError(res, 400, 'invalid_id', 'id must be a positive integer.', {
        id: 'id must be a positive integer.',
      });
      return;
    }
    try {
      const session = await requireSession(db, req, res);
      if (!session) return;
      if (!(await authorize(db, {
        principal: principalFromSession(session),
        permissionKey: readPermissionForResource(resource),
        resourceKey: resource,
      })).allowed) {
        apiError(res, 403, 'permission_denied', 'You cannot read this ERP resource.');
        return;
      }
      if (await moduleAccessDenied(session, 'sales')) {
        apiError(res, 403, 'module_not_enabled', 'The sales module is not enabled for this organization.');
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.userId,
        ...await scopedReadContext(session, resource),
      };
      const aggregate = await withTenantTransaction(db, scope, (tx) =>
        getSalesEnquiryAggregateWithin(tx, scope, resourceId));
      if (!aggregate) {
        apiError(res, 404, 'record_not_found', `No ${resource} record exists with id ${resourceId}.`);
        return;
      }
      res.setHeader('ETag', `"${aggregate.enquiry.version}"`);
      res.json({
        data: aggregate,
        meta: { aggregate: 'sales_enquiry', version: aggregate.enquiry.version },
      });
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message);
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
      if (!(await authorize(db, {
        principal: principalFromSession(session),
        permissionKey: readPermissionForResource(resource),
        resourceKey: resource,
      })).allowed) {
        apiError(res, 403, 'permission_denied', 'You cannot read this ERP resource.');
        return;
      }
      if (await moduleAccessDenied(session, req.params.module)) {
        apiError(res, 403, 'module_not_enabled', `The ${req.params.module} module is not enabled for this organization.`);
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.userId,
        ...await scopedReadContext(session, resource),
      };
      const result = await withTenantTransaction(db, scope, (tx) =>
        getResource(tx, scope, resource, req.params.id));
      if (!result) {
        apiError(res, 404, 'record_not_found', `No ${resource} record exists with id ${req.params.id}.`);
        return;
      }
      const version = (result.data as { version?: unknown }).version;
      if (typeof version === 'number') res.setHeader('ETag', `"${version}"`);
      else {
        const updatedAt = (result.data as { updatedAt?: unknown }).updatedAt;
        if (updatedAt instanceof Date) res.setHeader('ETag', `"${updatedAt.toISOString()}"`);
        else if (typeof updatedAt === 'string') res.setHeader('ETag', `"${updatedAt}"`);
      }
      res.json(result);
    } catch (error) {
      if (error instanceof ActionDispatchError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
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
      apiError(res, 403, 'module_not_enabled', `The ${req.params.module} module is not enabled for this organization.`);
      return;
    }
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      apiError(res, 400, 'invalid_request', 'A JSON object body is required.');
      return;
    }
    try {
      if (definition.scopeUserIdColumn) {
        const readScope = {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
          actorUserId: session.userId,
          ...await scopedReadContext(session, resource),
        };
        const visible = await withTenantTransaction(db, readScope, (tx) =>
          getResource(tx, readScope, resource, resourceId));
        if (!visible) {
          apiError(res, 404, 'record_not_found', 'The record is unavailable in your data scope.');
          return;
        }
      }
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
        || error instanceof WarehousePickError
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
