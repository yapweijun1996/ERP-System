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
  updateProductWithin,
  type UpdateProductInput,
} from '../modules/inventory/product';
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
import {
  completeInspectionWithin,
  disposeNcrWithin,
} from '../modules/quality/inspection';
import {
  convertEnquiryToQuotationWithin,
  convertQuotationToOrderWithin,
  transitionQuotationWithin,
} from '../modules/sales/quotation';
import {
  receiveAndCreditSalesReturnWithin,
  rejectSalesReturnWithin,
} from '../modules/sales/return';
import { postSalesDebitNoteWithin } from '../modules/sales/debitNote';
import {
  activateDiscountRuleWithin,
  activatePriceListWithin,
} from '../modules/sales/pricing';
import {
  placeCreditHoldWithin,
  releaseCreditHoldWithin,
} from '../modules/sales/creditControl';
import { postDepreciationRunWithin } from '../modules/assets/depreciationRun';

const ACTIONS: Record<string, ActionDefinition> = {
  'assets/depreciation-runs/post': {
    permission: 'asset.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postDepreciationRunWithin(tx, scope, input.resourceId);
    },
  },
  'inventory/products/update': {
    permission: 'inventory.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return updateProductWithin(
        tx,
        scope,
        input.resourceId,
        input.payload as unknown as UpdateProductInput,
      );
    },
  },
  'sales/credit-profiles/hold': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const reason = (input.payload as { reason?: unknown }).reason;
      if (typeof reason !== 'string' || !reason.trim()) {
        throw new ActionDispatchError(400, 'invalid_action_payload', 'Hold reason is required.');
      }
      return placeCreditHoldWithin(tx, scope, input.resourceId, reason);
    },
  },
  'sales/credit-profiles/release': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return releaseCreditHoldWithin(tx, scope, input.resourceId);
    },
  },
  'sales/price-lists/activate': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return activatePriceListWithin(tx, scope, input.resourceId);
    },
  },
  'sales/discount-rules/activate': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return activateDiscountRuleWithin(tx, scope, input.resourceId);
    },
  },
  'sales/debit-notes/post': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postSalesDebitNoteWithin(tx, scope, input.resourceId);
    },
  },
  'sales/returns/receive-and-credit': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as {
        creditDocNo?: unknown;
        noteDate?: unknown;
        tracking?: unknown;
      };
      if (typeof payload.creditDocNo !== 'string' || typeof payload.noteDate !== 'string') {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'Credit note number and noteDate are required.',
        );
      }
      return receiveAndCreditSalesReturnWithin(tx, scope, input.resourceId, {
        creditDocNo: payload.creditDocNo,
        noteDate: payload.noteDate,
        tracking: Array.isArray(payload.tracking) ? payload.tracking as never : undefined,
      });
    },
  },
  'sales/returns/reject': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return rejectSalesReturnWithin(tx, scope, input.resourceId);
    },
  },
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
  'quality/inspections/complete': {
    permission: 'quality.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as {
        results?: Array<{
          resultId?: unknown;
          measuredValue?: unknown;
          result?: unknown;
          defectClass?: unknown;
        }>;
      };
      if (
        !Array.isArray(payload.results)
        || payload.results.length === 0
        || payload.results.some((row) =>
          !Number.isSafeInteger(row.resultId)
          || Number(row.resultId) <= 0
          || typeof row.measuredValue !== 'string'
          || !row.measuredValue.trim()
          || !['pass', 'fail'].includes(String(row.result))
          || (row.defectClass != null
            && !['critical', 'major', 'minor'].includes(String(row.defectClass))))
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'Every result requires resultId, measuredValue and pass/fail outcome.',
        );
      }
      return completeInspectionWithin(tx, scope, {
        inspectionId: input.resourceId,
        results: payload.results.map((row) => ({
          resultId: Number(row.resultId),
          measuredValue: String(row.measuredValue),
          result: row.result as 'pass' | 'fail',
          defectClass: row.defectClass as
            | 'critical'
            | 'major'
            | 'minor'
            | null
            | undefined,
        })),
      });
    },
  },
  'quality/ncrs/release': {
    permission: 'quality.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return disposeNcrWithin(tx, scope, input.resourceId, 'release');
    },
  },
  'quality/ncrs/reject': {
    permission: 'quality.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return disposeNcrWithin(tx, scope, input.resourceId, 'scrap');
    },
  },
  'sales/enquiries/convert-to-quotation': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as {
        docNo?: unknown;
        quoteDate?: unknown;
        validUntil?: unknown;
        currency?: unknown;
        probability?: unknown;
        lines?: Array<{
          productId?: unknown;
          qty?: unknown;
          unitPrice?: unknown;
          taxCode?: unknown;
        }>;
      };
      if (
        typeof payload.docNo !== 'string'
        || typeof payload.quoteDate !== 'string'
        || typeof payload.validUntil !== 'string'
        || typeof payload.currency !== 'string'
        || !Array.isArray(payload.lines)
        || payload.lines.length === 0
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'Quotation number, dates, currency and at least one line are required.',
        );
      }
      return convertEnquiryToQuotationWithin(tx, scope, input.resourceId, {
        docNo: payload.docNo,
        quoteDate: payload.quoteDate,
        validUntil: payload.validUntil,
        currency: payload.currency,
        probability: payload.probability as string | number | undefined,
        lines: payload.lines.map((line) => ({
          productId: Number(line.productId),
          qty: line.qty as string | number,
          unitPrice: line.unitPrice as string | number,
          taxCode: String(line.taxCode ?? ''),
        })),
      });
    },
  },
  'sales/quotations/issue': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return transitionQuotationWithin(tx, scope, input.resourceId, 'issue');
    },
  },
  'sales/quotations/accept': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return transitionQuotationWithin(tx, scope, input.resourceId, 'accept');
    },
  },
  'sales/quotations/convert-to-order': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as { docNo?: unknown; orderDate?: unknown };
      if (typeof payload.docNo !== 'string' || typeof payload.orderDate !== 'string') {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'Sales order number and orderDate are required.',
        );
      }
      return convertQuotationToOrderWithin(tx, scope, input.resourceId, {
        docNo: payload.docNo,
        orderDate: payload.orderDate,
      });
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
