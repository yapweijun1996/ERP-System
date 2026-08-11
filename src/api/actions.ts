import { ActionDispatchError, type ActionDefinition } from './actionDispatcher';
import { and, eq } from 'drizzle-orm';
import { employee, leaveRequest } from '../data/schema';
import {
  convertOpportunityToSalesOrderWithin,
  type ConvertOpportunityInput,
} from '../modules/crm/convertOpportunityToSalesOrder';
import { markOpportunityLostWithin } from '../modules/crm/opportunityLifecycle';
import {
  confirmDraftSalesOrderWithin,
} from '../modules/sales/confirmOrder';
import { decideSalesOrderWithin } from '../modules/sales/salesOrderApproval';
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
  rejectPurchaseReturnWithin,
  shipAndCreditPurchaseReturnWithin,
} from '../modules/purchasing/purchaseReturn';
import { postSupplierDebitNoteWithin } from '../modules/purchasing/supplierDebitNote';
import { allocateLandedCostWithin } from '../modules/purchasing/landedCost';
import { decidePurchaseOrderWithin } from '../modules/purchasing/purchaseOrderApproval';
import { activateSupplierPriceListWithin } from '../modules/purchasing/supplierPricing';
import { decidePurchaseRequisitionWithin } from '../modules/purchasing/purchaseRequisition';
import {
  convertSupplierQuotationToPurchaseOrderWithin,
  transitionPurchaseRfqWithin,
} from '../modules/purchasing/rfq';
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
  replaceSalesEnquiryLinesWithin,
  saveSalesEnquiryDraftWithin,
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
import {
  activateCommissionPlanWithin,
  approveCommissionRunWithin,
} from '../modules/sales/commission';
import { postDepreciationRunWithin } from '../modules/assets/depreciationRun';
import {
  InvalidLeaveRequestStateError,
  decideLeaveRequestWithin,
} from '../modules/hr/leaveRequest';
import {
  decideGovernedLeaveWithin,
  LeaveApplicationError,
} from '../modules/hr/leaveApplication';
import { ApprovalWorkflowError } from '../modules/approval/workflow';
import { postPayrollRunWithin } from '../modules/payroll/payrollRun';
import { postProgressClaimWithin } from '../modules/project/progressClaim';
import { voidProjectTimeEntryWithin } from '../modules/project/timeEntry';
import { assignServiceTicketWithin, resolveServiceTicketWithin } from '../modules/service/serviceTicket';
import {
  postManualJournalWithin,
  reverseManualJournalWithin,
  type ReverseManualJournalInput,
} from '../modules/finance/manualJournal';
import {
  matchBankStatementLineWithin,
  reconcileBankStatementWithin,
  unmatchBankStatementLineWithin,
  type MatchBankStatementLineInput,
} from '../modules/finance/bankReconciliation';
import {
  runCustomerImportJobWithin,
  CustomerImportStateError,
} from '../modules/integration/customerImport';
import {
  dismissNotificationWithin,
  markNotificationReadWithin,
} from '../modules/account/notification';

type HrLeaveDecisionPayload = {
  expectedVersion?: unknown;
  reason?: unknown;
  rejectionReason?: unknown;
};

/**
 * The HR leave register predates the governed leave-application workflow and
 * still uses the same resource action URL. Resolve the row inside the action
 * transaction so the old register can safely handle both generations without
 * bypassing version checks, approval policy or audit writes.
 */
async function decideHrLeaveRequestWithin(
  tx: Parameters<ActionDefinition['execute']>[0],
  scope: { masterFn: string; companyFn: string },
  input: { resourceId: number; payload: Record<string, unknown>; actorUserId: number },
  decision: 'approved' | 'rejected',
) {
  const [row] = await tx.select({
    id: leaveRequest.id,
    legacyPolicy: leaveRequest.legacyPolicy,
    version: leaveRequest.version,
  }).from(leaveRequest).where(and(
    eq(leaveRequest.id, input.resourceId),
    eq(leaveRequest.masterFn, scope.masterFn),
    eq(leaveRequest.companyFn, scope.companyFn),
  )).limit(1);
  if (!row) {
    throw new ActionDispatchError(404, 'leave_request_not_found', 'Leave request not found.');
  }

  const payload = input.payload as HrLeaveDecisionPayload;
  if (!row.legacyPolicy) {
    const expectedVersion = Number(payload.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      throw new ActionDispatchError(
        428,
        'expected_version_required',
        'A positive expectedVersion is required for governed leave decisions.',
      );
    }
    const reason = typeof payload.reason === 'string' ? payload.reason : null;
    const [linkedEmployee] = await tx.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.userId, input.actorUserId),
    )).limit(1);
    try {
      return await decideGovernedLeaveWithin(
        tx,
        scope,
        {
          userId: input.actorUserId,
          employeeId: linkedEmployee?.id ?? null,
          canManage: true,
        },
        input.resourceId,
        expectedVersion,
        decision,
        reason,
      );
    } catch (error) {
      if (error instanceof LeaveApplicationError || error instanceof ApprovalWorkflowError) {
        throw new ActionDispatchError(error.status, error.code, error.message);
      }
      throw error;
    }
  }

  const rejectionReason = decision === 'rejected'
    ? (typeof payload.rejectionReason === 'string'
      ? payload.rejectionReason
      : typeof payload.reason === 'string' ? payload.reason : null)
    : null;
  try {
    return await decideLeaveRequestWithin(
      tx,
      scope,
      input.resourceId,
      decision,
      rejectionReason,
    );
  } catch (error) {
    if (error instanceof InvalidLeaveRequestStateError) {
      throw new ActionDispatchError(409, 'invalid_leave_state', error.message);
    }
    throw error;
  }
}

const ACTIONS: Record<string, ActionDefinition> = {
  'account/notifications/mark-read': {
    /* Read/dismiss is an actor-owned attention state. It must not require an
       admin-only management grant, otherwise an ordinary employee can see a
       notification but clicking it fails before the drill-in navigation. */
    permission: 'notifications.read',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return markNotificationReadWithin(tx, scope, input.actorUserId, input.resourceId);
    },
  },
  'account/notifications/dismiss': {
    permission: 'notifications.read',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return dismissNotificationWithin(tx, scope, input.actorUserId, input.resourceId);
    },
  },
  'integration/import-jobs/run': {
    permission: 'integration.import',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      try {
        return await runCustomerImportJobWithin(tx, scope, input.resourceId);
      } catch (error) {
        if (error instanceof CustomerImportStateError) {
          throw new ActionDispatchError(409, 'invalid_import_state', error.message);
        }
        throw error;
      }
    },
  },
  'finance/bank-statements/reconcile': {
    permission: 'finance.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return reconcileBankStatementWithin(tx, scope, input.resourceId);
    },
  },
  'finance/bank-statement-lines/match': {
    permission: 'finance.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return matchBankStatementLineWithin(
        tx,
        scope,
        input.resourceId,
        input.payload as unknown as MatchBankStatementLineInput,
      );
    },
  },
  'finance/bank-statement-lines/unmatch': {
    permission: 'finance.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return unmatchBankStatementLineWithin(tx, scope, input.resourceId);
    },
  },
  'finance/journals/post': {
    permission: 'finance.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postManualJournalWithin(tx, scope, input.resourceId);
    },
  },
  'finance/journals/reverse': {
    permission: 'finance.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return reverseManualJournalWithin(
        tx,
        scope,
        input.resourceId,
        input.payload as unknown as ReverseManualJournalInput,
      );
    },
  },
  'sales/commission-plans/activate': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return activateCommissionPlanWithin(tx, scope, input.resourceId);
    },
  },
  'sales/commission-runs/approve': {
    permission: 'sales.commission.approve',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const note = (input.payload as { note?: unknown }).note;
      if (typeof note !== 'string' || !note.trim()) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'An approval note is required to approve a commission run.',
        );
      }
      return approveCommissionRunWithin(tx, scope, input.resourceId, {
        note,
        actorUserId: input.actorUserId,
      });
    },
  },
  'purchasing/supplier-price-lists/activate': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return activateSupplierPriceListWithin(tx, scope, input.resourceId);
    },
  },
  'purchasing/purchase-orders/approve': {
    permission: 'purchasing.approve',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const note = (input.payload as { note?: unknown }).note;
      if (typeof note !== 'string' || !note.trim()) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'A decision note is required to approve a purchase order.',
        );
      }
      return decidePurchaseOrderWithin(tx, scope, input.resourceId, {
        decision: 'approve',
        note,
        actorUserId: input.actorUserId,
      });
    },
  },
  'purchasing/purchase-orders/reject': {
    permission: 'purchasing.approve',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const note = (input.payload as { note?: unknown }).note;
      if (typeof note !== 'string' || !note.trim()) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'A decision note is required to reject a purchase order.',
        );
      }
      return decidePurchaseOrderWithin(tx, scope, input.resourceId, {
        decision: 'reject',
        note,
        actorUserId: input.actorUserId,
      });
    },
  },
  'purchasing/landed-costs/allocate': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return allocateLandedCostWithin(tx, scope, input.resourceId);
    },
  },
  'purchasing/supplier-debit-notes/post': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postSupplierDebitNoteWithin(tx, scope, input.resourceId);
    },
  },
  'assets/depreciation-runs/post': {
    permission: 'asset.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postDepreciationRunWithin(tx, scope, input.resourceId);
    },
  },
  'payroll/runs/post': {
    permission: 'payroll.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postPayrollRunWithin(tx, scope, input.resourceId);
    },
  },
  'inventory/products/update': {
    permission: 'inventory.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as unknown as UpdateProductInput;
      if (typeof payload.expectedVersion !== 'number'
        || !Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 1) {
        throw new ActionDispatchError(428, 'if_match_required', 'A product version is required when updating product master data.');
      }
      return updateProductWithin(
        tx,
        scope,
        input.resourceId,
        payload,
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
  'hr/leave-requests/approve': {
    permission: 'hr.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return decideHrLeaveRequestWithin(tx, scope, input, 'approved');
    },
  },
  'hr/leave-requests/reject': {
    permission: 'hr.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return decideHrLeaveRequestWithin(tx, scope, input, 'rejected');
    },
  },
  'project/progress-claims/post': {
    permission: 'project.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return postProgressClaimWithin(tx, scope, input.resourceId);
    },
  },
  'project/time-entries/void': {
    permission: 'project.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const reason = (input.payload as { reason?: unknown } | undefined)?.reason;
      if (typeof reason !== 'string' || !reason.trim()) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'A void reason is required.',
        );
      }
      return voidProjectTimeEntryWithin(
        tx,
        scope,
        input.actorUserId,
        input.resourceId,
        reason,
      );
    },
  },
  'service/tickets/assign': {
    permission: 'service.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const technicianName = (input.payload as { technicianName?: unknown } | undefined)?.technicianName;
      return assignServiceTicketWithin(
        tx, scope, input.resourceId, typeof technicianName === 'string' ? technicianName : '',
      );
    },
  },
  'service/tickets/resolve': {
    permission: 'service.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const diagnosis = (input.payload as { diagnosis?: unknown } | undefined)?.diagnosis;
      return resolveServiceTicketWithin(
        tx, scope, input.resourceId, typeof diagnosis === 'string' ? diagnosis : '',
      );
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
          lineType?: unknown;
          description?: unknown;
          uom?: unknown;
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
          lineType: line.lineType as 'stock' | 'non_stock' | undefined,
          productId: line.productId == null ? null : Number(line.productId),
          description: line.description == null ? undefined : String(line.description),
          uom: line.uom == null ? undefined : String(line.uom),
          qty: line.qty as string | number,
          unitPrice: line.unitPrice as string | number,
          taxCode: String(line.taxCode ?? ''),
        })),
      });
    },
  },
  'sales/enquiries/replace-lines': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as {
        expectedVersion?: unknown;
        lines?: Array<{
          productId?: unknown;
          lineType?: unknown;
          description?: unknown;
          uom?: unknown;
          qty?: unknown;
          estimatedUnitPrice?: unknown;
        }>;
      };
      if (!Number.isSafeInteger(payload.expectedVersion) || !Array.isArray(payload.lines)) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'expectedVersion and lines are required.',
        );
      }
      return replaceSalesEnquiryLinesWithin(tx, scope, input.resourceId, {
        expectedVersion: Number(payload.expectedVersion),
        lines: payload.lines.map((line) => ({
          lineType: line.lineType as 'stock' | 'non_stock' | undefined,
          productId: line.productId == null ? null : Number(line.productId),
          description: line.description == null ? undefined : String(line.description),
          uom: line.uom == null ? undefined : String(line.uom),
          qty: line.qty as string | number,
          estimatedUnitPrice: line.estimatedUnitPrice as string | number,
        })),
      });
    },
  },
  'sales/enquiries/save-draft': {
    permission: 'sales.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as {
        expectedVersion?: unknown;
        header?: {
          customerId?: unknown;
          subject?: unknown;
          channel?: unknown;
          currency?: unknown;
          ownerName?: unknown;
          enquiryDate?: unknown;
        };
        lines?: Array<{
          productId?: unknown;
          lineType?: unknown;
          description?: unknown;
          uom?: unknown;
          qty?: unknown;
          estimatedUnitPrice?: unknown;
        }>;
      };
      if (
        !Number.isSafeInteger(payload.expectedVersion)
        || !payload.header
        || !Array.isArray(payload.lines)
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'expectedVersion, header and lines are required.',
        );
      }
      const header = payload.header;
      if (
        !Number.isSafeInteger(header.customerId)
        || typeof header.subject !== 'string'
        || typeof header.channel !== 'string'
        || typeof header.currency !== 'string'
        || typeof header.ownerName !== 'string'
        || typeof header.enquiryDate !== 'string'
      ) {
        throw new ActionDispatchError(400, 'invalid_action_payload', 'A complete enquiry header is required.');
      }
      return saveSalesEnquiryDraftWithin(tx, scope, input.resourceId, {
        expectedVersion: Number(payload.expectedVersion),
        header: {
          customerId: Number(header.customerId),
          subject: header.subject,
          channel: header.channel,
          currency: header.currency,
          ownerName: header.ownerName,
          enquiryDate: header.enquiryDate,
        },
        lines: payload.lines.map((line) => ({
          lineType: line.lineType as 'stock' | 'non_stock' | undefined,
          productId: line.productId == null ? null : Number(line.productId),
          description: line.description == null ? undefined : String(line.description),
          uom: line.uom == null ? undefined : String(line.uom),
          qty: line.qty as string | number,
          estimatedUnitPrice: line.estimatedUnitPrice as string | number,
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
  'sales/orders/approve': {
    permission: 'sales.approve',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const note = (input.payload as { note?: unknown }).note;
      if (typeof note !== 'string' || !note.trim()) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'A decision note is required to approve a sales order.',
        );
      }
      return decideSalesOrderWithin(tx, scope, input.resourceId, {
        decision: 'approve',
        note,
        actorUserId: input.actorUserId,
      });
    },
  },
  'sales/orders/reject': {
    permission: 'sales.approve',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const note = (input.payload as { note?: unknown }).note;
      if (typeof note !== 'string' || !note.trim()) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'A decision note is required to reject a sales order.',
        );
      }
      return decideSalesOrderWithin(tx, scope, input.resourceId, {
        decision: 'reject',
        note,
        actorUserId: input.actorUserId,
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
  'purchasing/purchase-returns/ship-and-credit': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as {
        creditDocNo?: unknown;
        noteDate?: unknown;
        tracking?: unknown;
      };
      if (
        typeof payload.creditDocNo !== 'string'
        || !payload.creditDocNo.trim()
        || typeof payload.noteDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(payload.noteDate)
        || (payload.tracking !== undefined && !Array.isArray(payload.tracking))
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'creditDocNo and noteDate are required to ship and credit a purchase return.',
        );
      }
      return shipAndCreditPurchaseReturnWithin(tx, scope, input.resourceId, {
        creditDocNo: payload.creditDocNo,
        noteDate: payload.noteDate,
        tracking: payload.tracking as never,
      });
    },
  },
  'purchasing/purchase-returns/reject': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return rejectPurchaseReturnWithin(tx, scope, input.resourceId);
    },
  },
  'purchasing/purchase-requisitions/approve': {
    permission: 'purchasing.approve',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return decidePurchaseRequisitionWithin(tx, scope, input.resourceId, {
        decision: 'approved',
        actorUserId: input.actorUserId,
      });
    },
  },
  'purchasing/purchase-requisitions/reject': {
    permission: 'purchasing.approve',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const reason = (input.payload as { rejectionReason?: unknown } | undefined)?.rejectionReason;
      return decidePurchaseRequisitionWithin(
        tx,
        scope,
        input.resourceId,
        {
          decision: 'rejected',
          actorUserId: input.actorUserId,
          rejectionReason: typeof reason === 'string' ? reason : null,
        },
      );
    },
  },
  'purchasing/rfqs/issue': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return transitionPurchaseRfqWithin(tx, scope, input.resourceId, 'issue');
    },
  },
  'purchasing/rfqs/close': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      return transitionPurchaseRfqWithin(tx, scope, input.resourceId, 'close');
    },
  },
  'purchasing/supplier-quotations/convert-to-purchase-order': {
    permission: 'purchasing.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as { docNo?: unknown; orderDate?: unknown } | undefined;
      if (
        typeof payload?.docNo !== 'string'
        || !payload.docNo.trim()
        || typeof payload.orderDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(payload.orderDate)
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'docNo and orderDate are required to convert a supplier quotation.',
        );
      }
      return convertSupplierQuotationToPurchaseOrderWithin(tx, scope, input.resourceId, {
        docNo: payload.docNo,
        orderDate: payload.orderDate,
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
          || Number(line.productId) <= 0
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
  'crm/opportunities/mark-lost': {
    permission: 'crm.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const reason = (input.payload as { reason?: unknown } | undefined)?.reason;
      if (typeof reason !== 'string' || !reason.trim()) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'A loss reason is required.',
        );
      }
      return markOpportunityLostWithin(tx, scope, input.resourceId, reason);
    },
  },
};

export function actionDefinitionFor(
  resource: string,
  action: string,
): ActionDefinition | null {
  return ACTIONS[`${resource}/${action}`] ?? null;
}

export interface ActionPermissionContract {
  resource: string;
  action: string;
  permission: string;
}

export function listActionPermissionContracts(): readonly ActionPermissionContract[] {
  return Object.freeze(Object.entries(ACTIONS).map(([key, definition]) => {
    const separator = key.lastIndexOf('/');
    return {
      resource: key.slice(0, separator),
      action: key.slice(separator + 1),
      permission: definition.permission,
    };
  }));
}
