import { ActionDispatchError, type ActionDefinition } from './actionDispatcher';
import {
  convertOpportunityToSalesOrderWithin,
  type ConvertOpportunityInput,
} from '../modules/crm/convertOpportunityToSalesOrder';
import {
  confirmDraftSalesOrderWithin,
} from '../modules/sales/confirmOrder';
import { postInventoryAdjustmentWithin } from '../modules/inventory/adjustment';
import { completeStockTransferWithin } from '../modules/inventory/transfer';
import {
  receiveGoodsWithin,
  type ReceiveGoodsInput,
} from '../modules/purchasing/receiveGoods';
import {
  postSupplierInvoiceWithin,
  type PostSupplierInvoiceInput,
} from '../modules/purchasing/postSupplierInvoice';
import {
  completeWarehousePickWithin,
  recordWarehousePickWithin,
} from '../modules/warehouse/picking';
import {
  completeWorkOrderWithin,
  issueWorkOrderMaterialsWithin,
  releaseWorkOrderWithin,
  reportWorkOrderOperationWithin,
} from '../modules/manufacturing/workOrder';

const ACTIONS: Record<string, ActionDefinition> = {
  'inventory/adjustments/post': {
    permission: 'inventory.adjust',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postInventoryAdjustmentWithin(tx, scope, input.resourceId);
    },
  },
  'inventory/transfers/complete': {
    permission: 'inventory.transfer',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return completeStockTransferWithin(tx, scope, input.resourceId);
    },
  },
  'warehouse/picks/pick-line': {
    permission: 'inventory.transfer',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as { lineId?: unknown; qty?: unknown };
      if (
        !Number.isSafeInteger(payload.lineId)
        || Number(payload.lineId) <= 0
        || !Number.isFinite(payload.qty)
        || Number(payload.qty) <= 0
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'lineId and a positive qty are required.',
        );
      }
      return recordWarehousePickWithin(tx, scope, {
        pickId: input.resourceId,
        lineId: Number(payload.lineId),
        qty: Number(payload.qty),
      });
    },
  },
  'warehouse/picks/complete': {
    permission: 'inventory.transfer',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return completeWarehousePickWithin(tx, scope, input.resourceId);
    },
  },
  'manufacturing/work-orders/release': {
    permission: 'manufacturing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return releaseWorkOrderWithin(tx, scope, input.resourceId);
    },
  },
  'manufacturing/work-orders/issue-materials': {
    permission: 'manufacturing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return issueWorkOrderMaterialsWithin(tx, scope, input.resourceId);
    },
  },
  'manufacturing/work-orders/report-operation': {
    permission: 'manufacturing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as { operationId?: unknown; hours?: unknown; complete?: unknown };
      if (
        !Number.isSafeInteger(payload.operationId)
        || Number(payload.operationId) <= 0
        || !['string', 'number'].includes(typeof payload.hours)
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'operationId and positive hours are required.',
        );
      }
      return reportWorkOrderOperationWithin(tx, scope, {
        workOrderId: input.resourceId,
        operationId: Number(payload.operationId),
        hours: payload.hours as string | number,
        complete: payload.complete === true,
      });
    },
  },
  'manufacturing/work-orders/complete': {
    permission: 'manufacturing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return completeWorkOrderWithin(tx, scope, input.resourceId);
    },
  },
  'sales/orders/confirm': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as { warehouseId?: unknown };
      if (
        !Number.isSafeInteger(payload.warehouseId)
        || Number(payload.warehouseId) <= 0
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'warehouseId must be a positive integer.',
        );
      }
      return confirmDraftSalesOrderWithin(tx, scope, {
        salesOrderId: input.resourceId,
        warehouseId: Number(payload.warehouseId),
      });
    },
  },
  'purchasing/purchase-orders/receive': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as unknown as Omit<ReceiveGoodsInput, 'purchaseOrderId'>;
      if (
        !Number.isSafeInteger(payload.warehouseId)
        || payload.warehouseId <= 0
        || typeof payload.docNo !== 'string'
        || !payload.docNo.trim()
        || typeof payload.receivedDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(payload.receivedDate)
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'warehouseId, docNo and receivedDate are required to receive a purchase order.',
        );
      }
      return receiveGoodsWithin(tx, scope, {
        purchaseOrderId: input.resourceId,
        warehouseId: payload.warehouseId,
        docNo: payload.docNo,
        receivedDate: payload.receivedDate,
      });
    },
  },
  'purchasing/purchase-orders/post-invoice': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as unknown as Omit<PostSupplierInvoiceInput, 'purchaseOrderId'>;
      if (
        typeof payload.docNo !== 'string'
        || !payload.docNo.trim()
        || typeof payload.invoiceDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(payload.invoiceDate)
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'docNo and invoiceDate are required to post a supplier invoice.',
        );
      }
      return postSupplierInvoiceWithin(tx, scope, {
        purchaseOrderId: input.resourceId,
        docNo: payload.docNo,
        invoiceDate: payload.invoiceDate,
      });
    },
  },
  'crm/opportunities/convert': {
    permission: 'crm.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as unknown as Omit<ConvertOpportunityInput, 'opportunityId'>;
      if (
        typeof payload.docNo !== 'string'
        || !payload.docNo.trim()
        || typeof payload.orderDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(payload.orderDate)
        || !Array.isArray(payload.lines)
        || payload.lines.length === 0
        || payload.lines.some((line) =>
          !line
          || typeof line !== 'object'
          || !Number.isSafeInteger(line.productId)
          || line.productId <= 0
          || !Number.isSafeInteger(line.warehouseId)
          || line.warehouseId <= 0
          || !Number.isFinite(line.qty)
          || line.qty <= 0
          || !Number.isFinite(line.unitPrice)
          || line.unitPrice < 0
          || typeof line.taxCode !== 'string'
          || !line.taxCode)
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'docNo, orderDate and at least one valid order line are required.',
        );
      }
      return convertOpportunityToSalesOrderWithin(tx, scope, {
        opportunityId: input.resourceId,
        docNo: payload.docNo,
        orderDate: payload.orderDate,
        lines: payload.lines,
      });
    },
  },
};

export function actionDefinitionFor(
  resource: string,
  action: string,
): ActionDefinition | null {
  return ACTIONS[`${resource}/${action}`] ?? null;
}
