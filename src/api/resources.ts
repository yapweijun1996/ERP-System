import { and, asc, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import type { DataScope } from '../auth/accessCatalog';
import {
  canonicalPermissionForAction,
  canonicalPermissionForResource,
  registerRoutePermission,
} from '../auth/permissionRegistry';
import type { DB } from '../data/db';
import {
  account,
  activity,
  bankReceipt,
  bankStatement,
  bankStatementLine,
  contact,
  customer,
  glEntry,
  journalHeader,
  journalLine,
  goodsReceipt,
  landedCost,
  landedCostLine,
  invoice,
  opportunity,
  paymentVoucher,
  paymentVoucherLine,
  product,
  inventoryLot,
  inventorySerial,
  inventoryAdjustment,
  purchaseOrder,
  purchaseOrderApproval,
  purchaseOrderLine,
  purchaseRequisition,
  purchaseRequisitionLine,
  purchaseReturn,
  purchaseReturnLine,
  purchaseRfq,
  purchaseRfqLine,
  purchaseRfqSupplier,
  salesOrder,
  salesOrderApproval,
  salesOrderLine,
  salesDelivery,
  salesDeliveryLine,
  salesReturn,
  salesReturnLine,
  salesCreditNote,
  salesCreditNoteLine,
  salesDebitNote,
  salesPriceList,
  salesPriceListLine,
  salesDiscountRule,
  salesCreditProfile,
  salesCommissionPlan,
  salesCommissionRun,
  salesCommissionLine,
  salesCommissionSource,
  salesEnquiry,
  salesQuotation,
  salesQuotationLine,
  stockLevel,
  stockMovement,
  stockLocationBalance,
  stockReservation,
  stockTransfer,
  warehouse,
  warehouseBin,
  warehousePick,
  warehousePickLine,
  supplier,
  supplierQuotation,
  supplierQuotationLine,
  supplierInvoice,
  supplierCreditNote,
  supplierCreditNoteLine,
  supplierDebitNote,
  supplierPriceList,
  supplierPriceListLine,
  workCenter,
  manufacturingBom,
  bomVersion,
  bomComponent,
  manufacturingRouting,
  routingOperation,
  workOrder,
  workOrderMaterial,
  workOrderOperation,
  mrpRun,
  mrpSuggestion,
  qualityInspectionPlan,
  qualityInspectionPlanItem,
  qualityInspection,
  qualityInspectionResult,
  qualityNcr,
  qualityCorrectiveAction,
  asset,
  depreciationRun,
  depreciationRunLine,
  employee,
  leavePolicyVersion,
  leaveRequest,
  leaveType,
  payrollLeaveSource,
  payrollRun,
  payrollRunLeaveSource,
  payrollRunLine,
  project,
  progressClaim,
  projectTimeEntry,
  outboxEvent,
  importJob,
  importJobRow,
  importRowError,
  serviceContract,
  serviceTicket,
  appNotification,
} from '../data/schema';
import { listVendorPerformanceWithin } from '../modules/purchasing/vendorPerformance';
import {
  listPurchasePriceVarianceWithin,
  listPurchasingAnalyticsWithin,
} from '../modules/purchasing/analytics';
import { listSalesAnalyticsWithin } from '../modules/sales/analytics';
import { listSalespeopleWithin } from '../modules/sales/commission';
import { listReportingAnalyticsWithin } from '../modules/reporting/analytics';
import { listIntegrationEventsWithin } from '../modules/integration/eventLog';
import { listCustomerImportJobsWithin } from '../modules/integration/customerImport';
import { listNotificationsWithin } from '../modules/account/notification';

export interface ApiScope {
  masterFn: string;
  companyFn: string;
  actorUserId?: number;
  accessScope?: DataScope;
  allowedUserIds?: number[];
}

export interface ResourceQuery {
  cursor?: unknown;
  limit?: unknown;
  sort?: unknown;
  status?: unknown;
  companyFn?: unknown;
  [key: string]: unknown;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- this registry is
   deliberately polymorphic across ~20 unrelated Drizzle tables; each one's
   real column/table type is a deeply parameterized PgTableWithColumns<...>
   with no shared supertype narrower than `any` that's worth the generic
   complexity here. */
export interface ResourceDefinition {
  table: any;
  idColumn: any;
  tenantScope: 'company';
  readPermission: string;
  createPermission: string | null;
  updatePermission: string | null;
  allowedFilters: readonly string[];
  allowedSorts: readonly string[];
  allowedActions: readonly string[];
  versionColumn?: any;
  versionPolicy: 'none' | 'integer';
  idempotencyPolicy: 'none' | 'required_for_actions';
  auditPolicy: 'none' | 'writes';
  status?: any;
  customerId?: any;
  numericFilters?: Record<string, any>;
  textFilters?: Record<string, any>;
    actorUserIdColumn?: any;
    scopeUserIdColumn?: any;
  dateRangeColumn?: any;
  listOnly?: boolean;
  listHandler?: (
    db: DB,
    scope: ApiScope,
    input: { cursor: number; limit: number },
  ) => Promise<{ data: unknown[]; nextCursor: number | null }>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Canonical resources exposed by the phase-2 read API. The registry is an
 * allowlist: route parameters can never become SQL identifiers.
 */
const RESOURCE_DEFINITIONS: Record<string, ResourceDefinition> = {
  'account/notifications': {
    ...resource(appNotification, 'notifications.read', {
      allowedActions: ['mark-read', 'dismiss'],
      actorUserIdColumn: appNotification.recipientUserId,
    }),
    listOnly: true,
    listHandler: (db, scope, input) => listNotificationsWithin(
      db,
      { masterFn: scope.masterFn, companyFn: scope.companyFn },
      Number(scope.actorUserId),
      input,
    ),
  },
  'inventory/products': resource(product, 'inventory.read', {
    versionColumn: product.version,
    allowedActions: ['update'],
    createPermission: 'inventory.write',
    updatePermission: 'inventory.write',
  }),
  'inventory/warehouses': resource(warehouse, 'inventory.read'),
  'inventory/stock-levels': resource(stockLevel, 'inventory.read'),
  'inventory/stock-movements': resource(stockMovement, 'inventory.read', {
    numericFilters: { refId: stockMovement.refId },
    textFilters: { refType: stockMovement.refType },
  }),
  'inventory/bins': resource(warehouseBin, 'inventory.read', {
    createPermission: 'inventory.track',
  }),
  'inventory/lots': resource(inventoryLot, 'inventory.read', {
    status: inventoryLot.qualityStatus,
    createPermission: 'inventory.track',
  }),
  'inventory/serials': resource(inventorySerial, 'inventory.read', {
    status: inventorySerial.status,
    createPermission: 'inventory.track',
  }),
  'inventory/location-balances': resource(stockLocationBalance, 'inventory.read'),
  'inventory/adjustments': resource(inventoryAdjustment, 'inventory.read', {
    status: inventoryAdjustment.status,
    versionColumn: inventoryAdjustment.version,
    allowedActions: ['post'],
    createPermission: 'inventory.adjust',
  }),
  'inventory/transfers': resource(stockTransfer, 'inventory.read', {
    status: stockTransfer.status,
    versionColumn: stockTransfer.version,
    allowedActions: ['complete'],
    createPermission: 'inventory.transfer',
  }),
  'warehouse/picks': resource(warehousePick, 'inventory.read', {
    status: warehousePick.status,
    versionColumn: warehousePick.version,
    allowedActions: ['pick-line', 'complete'],
    createPermission: 'inventory.transfer',
  }),
  'warehouse/pick-lines': resource(warehousePickLine, 'inventory.read'),
  'warehouse/reservations': resource(stockReservation, 'inventory.read', {
    status: stockReservation.status,
  }),
  'sales/orders': resource(salesOrder, 'sales.read', {
    status: salesOrder.status,
    customerId: salesOrder.customerId,
    versionColumn: salesOrder.version,
    allowedActions: ['approve', 'reject', 'confirm'],
    createPermission: 'sales.write',
    scopeUserIdColumn: salesOrder.salespersonUserId,
  }),
  'sales/order-approvals': resource(salesOrderApproval, 'sales.read', {
    status: salesOrderApproval.status,
    versionColumn: salesOrderApproval.version,
  }),
  'sales/analytics': derivedResource(
    salesOrder,
    'sales.read',
    (db, scope, input) => listSalesAnalyticsWithin(db, scope, input),
  ),
  'sales/salespeople': derivedResource(
    customer,
    'sales.read',
    (db, scope, input) => listSalespeopleWithin(db, scope, input),
  ),
  'bi/analytics': derivedResource(
    salesOrder,
    'reporting.read',
    (db, scope, input) => listReportingAnalyticsWithin(db, scope, input),
  ),
  'integration/events': derivedResource(
    outboxEvent,
    'integration.read',
    (db, scope, input) => listIntegrationEventsWithin(db, scope, input),
  ),
  'integration/import-jobs': {
    ...resource(importJob, 'integration.read', {
      status: importJob.status,
      versionColumn: importJob.version,
      allowedActions: ['run'],
      createPermission: 'integration.import',
    }),
    listHandler: (db, scope, input) => listCustomerImportJobsWithin(db, scope, input),
  },
  'integration/import-rows': resource(importJobRow, 'integration.read', {
    status: importJobRow.status,
    numericFilters: { jobId: importJobRow.jobId },
  }),
  'integration/import-errors': resource(importRowError, 'integration.read', {
    numericFilters: { jobId: importRowError.jobId },
  }),
  'sales/customers': resource(customer, 'sales.read', {
    scopeUserIdColumn: customer.ownerUserId,
  }),
  'sales/order-lines': resource(salesOrderLine, 'sales.read'),
  'sales/deliveries': resource(salesDelivery, 'sales.read', {
    status: salesDelivery.status,
    versionColumn: salesDelivery.version,
  }),
  'sales/delivery-lines': resource(salesDeliveryLine, 'sales.read'),
  'sales/returns': resource(salesReturn, 'sales.read', {
    status: salesReturn.status,
    versionColumn: salesReturn.version,
    allowedActions: ['receive-and-credit', 'reject'],
    createPermission: 'sales.write',
  }),
  'sales/return-lines': resource(salesReturnLine, 'sales.read'),
  'sales/credit-notes': resource(salesCreditNote, 'sales.read', {
    status: salesCreditNote.status,
    versionColumn: salesCreditNote.version,
  }),
  'sales/credit-note-lines': resource(salesCreditNoteLine, 'sales.read'),
  'sales/debit-notes': resource(salesDebitNote, 'sales.read', {
    status: salesDebitNote.status,
    versionColumn: salesDebitNote.version,
    allowedActions: ['post'],
    createPermission: 'sales.write',
  }),
  'sales/price-lists': resource(salesPriceList, 'sales.read', {
    status: salesPriceList.status,
    versionColumn: salesPriceList.version,
    allowedActions: ['activate'],
    createPermission: 'sales.write',
  }),
  'sales/price-list-lines': resource(salesPriceListLine, 'sales.read'),
  'sales/discount-rules': resource(salesDiscountRule, 'sales.read', {
    status: salesDiscountRule.status,
    versionColumn: salesDiscountRule.version,
    allowedActions: ['activate'],
    createPermission: 'sales.write',
  }),
  'sales/credit-profiles': resource(salesCreditProfile, 'sales.read', {
    status: salesCreditProfile.status,
    versionColumn: salesCreditProfile.version,
    allowedActions: ['hold', 'release'],
    createPermission: 'sales.write',
  }),
  'sales/commission-plans': resource(salesCommissionPlan, 'sales.read', {
    status: salesCommissionPlan.status,
    versionColumn: salesCommissionPlan.version,
    allowedActions: ['activate'],
    createPermission: 'sales.write',
  }),
  'sales/commission-runs': resource(salesCommissionRun, 'sales.read', {
    status: salesCommissionRun.status,
    versionColumn: salesCommissionRun.version,
    allowedActions: ['approve'],
    createPermission: 'sales.write',
  }),
  'sales/commission-lines': resource(salesCommissionLine, 'sales.read', {
    numericFilters: { runId: salesCommissionLine.runId },
  }),
  'sales/commission-sources': resource(salesCommissionSource, 'sales.read', {
    numericFilters: { runId: salesCommissionSource.runId },
  }),
  'sales/enquiries': resource(salesEnquiry, 'sales.read', {
    status: salesEnquiry.status,
    versionColumn: salesEnquiry.version,
    allowedActions: ['convert-to-quotation'],
    createPermission: 'sales.write',
  }),
  'sales/quotations': resource(salesQuotation, 'sales.read', {
    status: salesQuotation.status,
    versionColumn: salesQuotation.version,
    numericFilters: { enquiryId: salesQuotation.enquiryId },
    allowedActions: ['issue', 'accept', 'convert-to-order'],
    createPermission: 'sales.write',
  }),
  'sales/quotation-lines': resource(salesQuotationLine, 'sales.read'),
  'sales/invoices': resource(invoice, 'sales.read', {
    status: invoice.status,
    customerId: invoice.customerId,
    versionColumn: invoice.version,
  }),
  'crm/customers': resource(customer, 'crm.read'),
  'crm/contacts': resource(contact, 'crm.read', {
    customerId: contact.customerId,
    createPermission: 'crm.write',
  }),
  'crm/activities': resource(activity, 'crm.read', {
    customerId: activity.customerId,
    createPermission: 'crm.write',
  }),
  'finance/accounts': resource(account, 'finance.read'),
  'finance/gl-entries': resource(glEntry, 'finance.read', {
    numericFilters: { accountId: glEntry.accountId },
    textFilters: { journalRef: glEntry.journalRef },
  }),
  'finance/journals': resource(journalHeader, 'finance.read', {
    status: journalHeader.status,
    versionColumn: journalHeader.version,
    allowedActions: ['post', 'reverse'],
    createPermission: 'finance.write',
    textFilters: { docNo: journalHeader.docNo },
  }),
  'finance/journal-lines': resource(journalLine, 'finance.read', {
    numericFilters: { journalId: journalLine.journalId },
  }),
  'finance/bank-receipts': resource(bankReceipt, 'finance.read', { createPermission: 'finance.write' }),
  'finance/bank-statements': resource(bankStatement, 'finance.read', {
    status: bankStatement.status,
    versionColumn: bankStatement.version,
    numericFilters: { bankAccountId: bankStatement.bankAccountId },
    allowedActions: ['reconcile'],
    createPermission: 'finance.write',
  }),
  'finance/bank-statement-lines': resource(bankStatementLine, 'finance.read', {
    numericFilters: { statementId: bankStatementLine.statementId },
    allowedActions: ['match', 'unmatch'],
  }),
  'finance/payment-vouchers': resource(paymentVoucher, 'finance.read', { createPermission: 'finance.write' }),
  'finance/payment-voucher-lines': resource(paymentVoucherLine, 'finance.read'),
  'purchasing/suppliers': resource(supplier, 'purchasing.read'),
  'purchasing/purchase-orders': resource(purchaseOrder, 'purchasing.read', {
    status: purchaseOrder.status,
    versionColumn: purchaseOrder.version,
    allowedActions: ['approve', 'reject', 'receive', 'post-invoice'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/purchase-order-approvals': resource(purchaseOrderApproval, 'purchasing.read', {
    status: purchaseOrderApproval.status,
    versionColumn: purchaseOrderApproval.version,
  }),
  'purchasing/purchase-order-lines': resource(purchaseOrderLine, 'purchasing.read', {
    numericFilters: { orderId: purchaseOrderLine.orderId },
  }),
  'purchasing/purchase-requisitions': resource(purchaseRequisition, 'purchasing.read', {
    status: purchaseRequisition.status,
    allowedActions: ['approve', 'reject'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/purchase-requisition-lines': resource(purchaseRequisitionLine, 'purchasing.read'),
  'purchasing/rfqs': resource(purchaseRfq, 'purchasing.read', {
    status: purchaseRfq.status,
    versionColumn: purchaseRfq.version,
    allowedActions: ['issue', 'close'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/rfq-lines': resource(purchaseRfqLine, 'purchasing.read'),
  'purchasing/rfq-suppliers': resource(purchaseRfqSupplier, 'purchasing.read'),
  'purchasing/supplier-quotations': resource(supplierQuotation, 'purchasing.read', {
    status: supplierQuotation.status,
    versionColumn: supplierQuotation.version,
    allowedActions: ['convert-to-purchase-order'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/supplier-quotation-lines': resource(supplierQuotationLine, 'purchasing.read'),
  'purchasing/goods-receipts': resource(goodsReceipt, 'purchasing.read', {
    numericFilters: { orderId: goodsReceipt.orderId },
  }),
  'purchasing/supplier-invoices': resource(supplierInvoice, 'purchasing.read', {
    status: supplierInvoice.status,
    versionColumn: supplierInvoice.version,
  }),
  'purchasing/purchase-returns': resource(purchaseReturn, 'purchasing.read', {
    status: purchaseReturn.status,
    versionColumn: purchaseReturn.version,
    allowedActions: ['ship-and-credit', 'reject'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/purchase-return-lines': resource(purchaseReturnLine, 'purchasing.read'),
  'purchasing/supplier-credit-notes': resource(supplierCreditNote, 'purchasing.read', {
    status: supplierCreditNote.status,
  }),
  'purchasing/supplier-credit-note-lines': resource(supplierCreditNoteLine, 'purchasing.read'),
  'purchasing/supplier-debit-notes': resource(supplierDebitNote, 'purchasing.read', {
    status: supplierDebitNote.status,
    versionColumn: supplierDebitNote.version,
    allowedActions: ['post'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/landed-costs': resource(landedCost, 'purchasing.read', {
    status: landedCost.status,
    versionColumn: landedCost.version,
    allowedActions: ['allocate'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/landed-cost-lines': resource(landedCostLine, 'purchasing.read'),
  'purchasing/supplier-price-lists': resource(supplierPriceList, 'purchasing.read', {
    status: supplierPriceList.status,
    versionColumn: supplierPriceList.version,
    allowedActions: ['activate'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/supplier-price-list-lines': resource(supplierPriceListLine, 'purchasing.read'),
  'purchasing/vendor-performance': derivedResource(
    supplier,
    'purchasing.read',
    (db, scope, input) => listVendorPerformanceWithin(db, scope, input),
  ),
  'purchasing/analytics': derivedResource(
    purchaseOrder,
    'purchasing.read',
    (db, scope, input) => listPurchasingAnalyticsWithin(db, scope, input),
  ),
  'purchasing/price-variance': derivedResource(
    supplierInvoice,
    'purchasing.read',
    (db, scope, input) => listPurchasePriceVarianceWithin(db, scope, input),
  ),
  'crm/opportunities': resource(opportunity, 'crm.read', {
    status: opportunity.stage,
    customerId: opportunity.customerId,
    versionColumn: opportunity.version,
    allowedActions: ['convert', 'mark-lost'],
    createPermission: 'crm.write',
    updatePermission: 'crm.write',
    scopeUserIdColumn: opportunity.ownerUserId,
  }),
  'manufacturing/work-centers': resource(workCenter, 'manufacturing.read'),
  'manufacturing/boms': resource(manufacturingBom, 'manufacturing.read', {
    status: manufacturingBom.status,
  }),
  'manufacturing/bom-versions': resource(bomVersion, 'manufacturing.read', {
    status: bomVersion.status,
    versionColumn: bomVersion.version,
  }),
  'manufacturing/bom-components': resource(bomComponent, 'manufacturing.read'),
  'manufacturing/routings': resource(manufacturingRouting, 'manufacturing.read', {
    status: manufacturingRouting.status,
  }),
  'manufacturing/routing-operations': resource(routingOperation, 'manufacturing.read'),
  'manufacturing/work-orders': resource(workOrder, 'manufacturing.read', {
    status: workOrder.status,
    versionColumn: workOrder.version,
    allowedActions: ['release', 'issue-materials', 'report-operation', 'complete'],
    createPermission: 'manufacturing.write',
  }),
  'manufacturing/work-order-materials': resource(workOrderMaterial, 'manufacturing.read'),
  'manufacturing/work-order-operations': resource(workOrderOperation, 'manufacturing.read', {
    status: workOrderOperation.status,
  }),
  'manufacturing/mrp-runs': resource(mrpRun, 'manufacturing.read', {
    status: mrpRun.status,
    versionColumn: mrpRun.version,
    createPermission: 'manufacturing.write',
  }),
  'manufacturing/mrp-suggestions': resource(mrpSuggestion, 'manufacturing.read', {
    status: mrpSuggestion.status,
  }),
  'quality/plans': resource(qualityInspectionPlan, 'quality.read'),
  'quality/plan-items': resource(qualityInspectionPlanItem, 'quality.read'),
  'quality/inspections': resource(qualityInspection, 'quality.read', {
    status: qualityInspection.status,
    versionColumn: qualityInspection.version,
    allowedActions: ['complete'],
    createPermission: 'quality.write',
  }),
  'quality/results': resource(qualityInspectionResult, 'quality.read', {
    status: qualityInspectionResult.result,
  }),
  'quality/ncrs': resource(qualityNcr, 'quality.read', {
    status: qualityNcr.status,
    versionColumn: qualityNcr.version,
    allowedActions: ['release', 'reject'],
    createPermission: 'quality.write',
  }),
  'quality/corrective-actions': resource(qualityCorrectiveAction, 'quality.read', {
    status: qualityCorrectiveAction.status,
  }),
  'assets/assets': resource(asset, 'asset.read', {
    status: asset.status,
    versionColumn: asset.version,
    createPermission: 'asset.write',
  }),
  'assets/depreciation-runs': resource(depreciationRun, 'asset.read', {
    status: depreciationRun.status,
    versionColumn: depreciationRun.version,
    allowedActions: ['post'],
    createPermission: 'asset.write',
  }),
  'assets/depreciation-run-lines': resource(depreciationRunLine, 'asset.read'),
  'hr/employees': resource(employee, 'hr.read', {
    createPermission: 'hr.write',
  }),
  'hr/leave-requests': resource(leaveRequest, 'hr.read', {
    status: leaveRequest.status,
    allowedActions: ['approve', 'reject'],
    createPermission: 'hr.write',
  }),
  'payroll/runs': resource(payrollRun, 'payroll.read', {
    status: payrollRun.status,
    versionColumn: payrollRun.version,
    allowedActions: ['post'],
    createPermission: 'payroll.write',
  }),
  'payroll/run-lines': resource(payrollRunLine, 'payroll.read', {
    numericFilters: { runId: payrollRunLine.runId },
  }),
  'payroll/leave-types': resource(leaveType, 'payroll.read'),
  'payroll/leave-policies': resource(leavePolicyVersion, 'payroll.read'),
  'payroll/leave-sources': resource(payrollLeaveSource, 'payroll.read', {
    createPermission: 'payroll.write',
  }),
  'payroll/run-leave-sources': resource(payrollRunLeaveSource, 'payroll.read'),
  'project/projects': resource(project, 'project.read', {
    status: project.status,
    createPermission: 'project.write',
  }),
  'project/progress-claims': resource(progressClaim, 'project.read', {
    status: progressClaim.status,
    versionColumn: progressClaim.version,
    allowedActions: ['post'],
    createPermission: 'project.write',
  }),
  'project/time-entries': resource(projectTimeEntry, 'project.read', {
    status: projectTimeEntry.status,
    versionColumn: projectTimeEntry.version,
    allowedActions: ['void'],
    createPermission: 'project.write',
    actorUserIdColumn: projectTimeEntry.actorUserId,
    dateRangeColumn: projectTimeEntry.workDate,
  }),
  'service/contracts': resource(serviceContract, 'service.read', {
    createPermission: 'service.write',
  }),
  'service/tickets': resource(serviceTicket, 'service.read', {
    status: serviceTicket.status,
    allowedActions: ['assign', 'resolve'],
    createPermission: 'service.write',
  }),
};

// The resource registry is the only runtime registration point for
// resource-specific canonical permissions. This keeps a tenant role editor
// from treating an arbitrary three-segment string as a valid permission.
for (const [resource, definition] of Object.entries(RESOURCE_DEFINITIONS)) {
  registerRoutePermission(canonicalPermissionForResource(resource, 'view', definition.readPermission));
  if (definition.createPermission) {
    registerRoutePermission(canonicalPermissionForResource(resource, 'create', definition.createPermission));
  }
  if (definition.updatePermission) {
    registerRoutePermission(canonicalPermissionForResource(resource, 'edit', definition.updatePermission));
  }
  for (const action of definition.allowedActions) {
    registerRoutePermission(canonicalPermissionForResource(resource, action, definition.readPermission));
    registerRoutePermission(canonicalPermissionForAction(resource, action, definition.readPermission));
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors
   ResourceDefinition's own any usage above; this factory constructs one. */
function resource(
  table: any,
  readPermission: string,
  options: {
    status?: any;
    customerId?: any;
    versionColumn?: any;
    allowedActions?: readonly string[];
    createPermission?: string;
    updatePermission?: string;
    numericFilters?: Record<string, any>;
    textFilters?: Record<string, any>;
  actorUserIdColumn?: any;
  scopeUserIdColumn?: any;
    dateRangeColumn?: any;
  } = {},
): ResourceDefinition {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const allowedFilters: string[] = [];
  if (options.status) allowedFilters.push('status');
  if (options.customerId) allowedFilters.push('customerId');
  allowedFilters.push(...Object.keys(options.numericFilters ?? {}));
  allowedFilters.push(...Object.keys(options.textFilters ?? {}));
  if (options.dateRangeColumn) allowedFilters.push('from', 'to');
  return {
    table,
    idColumn: table.id,
    tenantScope: 'company',
    readPermission,
    createPermission: options.createPermission ?? null,
    updatePermission: options.updatePermission ?? null,
    allowedFilters,
    allowedSorts: ['id'],
    allowedActions: options.allowedActions ?? [],
    versionColumn: options.versionColumn,
    versionPolicy: options.versionColumn ? 'integer' : 'none',
    idempotencyPolicy: options.allowedActions?.length ? 'required_for_actions' : 'none',
    auditPolicy: options.allowedActions?.length ? 'writes' : 'none',
    status: options.status,
    customerId: options.customerId,
    numericFilters: options.numericFilters,
    textFilters: options.textFilters,
    actorUserIdColumn: options.actorUserIdColumn,
    scopeUserIdColumn: options.scopeUserIdColumn,
    dateRangeColumn: options.dateRangeColumn,
  };
}

function derivedResource(
  cursorTable: ResourceDefinition['table'],
  readPermission: string,
  listHandler: NonNullable<ResourceDefinition['listHandler']>,
): ResourceDefinition {
  return {
    ...resource(cursorTable, readPermission),
    listOnly: true,
    listHandler,
  };
}

export class UnknownResourceError extends Error {
  constructor(resource: string) {
    super(`Unknown ERP resource '${resource}'`);
    this.name = 'UnknownResourceError';
  }
}

export class InvalidResourceQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResourceQueryError';
  }
}

function definitionFor(resource: string): ResourceDefinition {
  const definition = RESOURCE_DEFINITIONS[resource];
  if (!definition) throw new UnknownResourceError(resource);
  return definition;
}

function parsePositiveInteger(value: unknown, fallback: number, label: string): number {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new InvalidResourceQueryError(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function decodeCursor(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value !== 'string') throw new InvalidResourceQueryError('cursor is invalid');
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      v?: unknown;
      id?: unknown;
    };
    if (parsed.v !== 1 || !Number.isSafeInteger(parsed.id) || Number(parsed.id) < 0) {
      throw new Error('invalid cursor');
    }
    return Number(parsed.id);
  } catch {
    throw new InvalidResourceQueryError('cursor is invalid');
  }
}

function encodeCursor(id: number): string {
  return Buffer.from(JSON.stringify({ v: 1, id }), 'utf8').toString('base64url');
}

function parseIsoDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidResourceQueryError(`${label} must use YYYY-MM-DD`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new InvalidResourceQueryError(`${label} must be a real calendar date`);
  }
  return value;
}

export async function listResource(
  db: DB,
  scope: ApiScope,
  resource: string,
  query: ResourceQuery = {},
) {
  const definition = definitionFor(resource);
  const supported = ['cursor', 'limit', 'sort', ...definition.allowedFilters];
  const unsupported = Object.keys(query).filter((key) => !supported.includes(key));
  if (unsupported.length) {
    throw new InvalidResourceQueryError(`unsupported filter(s): ${unsupported.join(', ')}`);
  }
  const cursor = decodeCursor(query.cursor);
  const limit = Math.min(100, Math.max(1, parsePositiveInteger(query.limit, 50, 'limit')));
  if (
    query.sort != null
    && query.sort !== ''
    && !definition.allowedSorts.includes(String(query.sort))
  ) {
    throw new InvalidResourceQueryError(
      `sort must be one of: ${definition.allowedSorts.join(', ')}`,
    );
  }
  if (query.status != null && !definition.status) {
    throw new InvalidResourceQueryError(`status is not a supported filter for '${resource}'`);
  }
  if (query.status != null && query.status !== '' && typeof query.status !== 'string') {
    throw new InvalidResourceQueryError('status must be a string');
  }
  if (query.customerId != null && !definition.customerId) {
    throw new InvalidResourceQueryError(`customerId is not a supported filter for '${resource}'`);
  }
  if (query.customerId != null && query.customerId !== '') {
    parsePositiveInteger(query.customerId, 0, 'customerId');
  }
  for (const key of Object.keys(definition.numericFilters ?? {})) {
    if (query[key] != null && query[key] !== '') {
      const parsed = parsePositiveInteger(query[key], 0, key);
      if (parsed < 1) throw new InvalidResourceQueryError(`${key} must be a positive integer`);
    }
  }
  let fromDate: string | null = null;
  let toDate: string | null = null;
  if (query.from != null || query.to != null) {
    if (!definition.dateRangeColumn) {
      throw new InvalidResourceQueryError(`date range is not supported for '${resource}'`);
    }
    fromDate = query.from == null || query.from === '' ? null : parseIsoDate(query.from, 'from');
    toDate = query.to == null || query.to === '' ? null : parseIsoDate(query.to, 'to');
    if (fromDate && toDate && fromDate > toDate) {
      throw new InvalidResourceQueryError('from must be on or before to');
    }
  }

  if (definition.listHandler) {
    const page = await definition.listHandler(db, scope, { cursor, limit });
    return {
      data: page.data,
      meta: {
        nextCursor: page.nextCursor == null ? null : encodeCursor(page.nextCursor),
      },
    };
  }

  const predicates = [
    eq(definition.table.masterFn, scope.masterFn),
    eq(definition.table.companyFn, scope.companyFn),
    gt(definition.idColumn, cursor),
  ];
  if (definition.actorUserIdColumn) {
    if (!Number.isSafeInteger(scope.actorUserId) || Number(scope.actorUserId) <= 0) {
      throw new InvalidResourceQueryError('actor user scope is required');
    }
    predicates.push(eq(definition.actorUserIdColumn, Number(scope.actorUserId)));
  }
  if (scope.accessScope && scope.accessScope !== 'company') {
    if (!definition.scopeUserIdColumn || !scope.allowedUserIds?.length) {
      predicates.push(sql`false`);
    } else {
      predicates.push(inArray(definition.scopeUserIdColumn, scope.allowedUserIds));
    }
  }
  if (definition.status && typeof query.status === 'string' && query.status) {
    predicates.push(eq(definition.status, query.status));
  }
  if (definition.customerId && query.customerId != null && query.customerId !== '') {
    predicates.push(eq(definition.customerId, Number(query.customerId)));
  }
  for (const [key, column] of Object.entries(definition.numericFilters ?? {})) {
    if (query[key] != null && query[key] !== '') {
      predicates.push(eq(column, Number(query[key])));
    }
  }
  for (const [key, column] of Object.entries(definition.textFilters ?? {})) {
    if (query[key] != null && query[key] !== '') {
      predicates.push(eq(column, String(query[key])));
    }
  }
  if (definition.dateRangeColumn && fromDate) {
    predicates.push(gte(definition.dateRangeColumn, fromDate));
  }
  if (definition.dateRangeColumn && toDate) {
    predicates.push(lte(definition.dateRangeColumn, toDate));
  }

  const rows = await db
    .select()
    .from(definition.table)
    .where(and(...predicates))
    .orderBy(asc(definition.idColumn))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1] as { id?: number } | undefined;

  return {
    data,
    meta: { nextCursor: hasMore && last?.id != null ? encodeCursor(last.id) : null },
  };
}

export async function getResource(db: DB, scope: ApiScope, resource: string, id: unknown) {
  const definition = definitionFor(resource);
  if (definition.listOnly) return null;
  const resourceId = parsePositiveInteger(id, 0, 'id');
  if (resourceId < 1) throw new InvalidResourceQueryError('id must be a positive integer');

  const predicates = [
    eq(definition.table.masterFn, scope.masterFn),
    eq(definition.table.companyFn, scope.companyFn),
    eq(definition.idColumn, resourceId),
  ];
  if (definition.actorUserIdColumn) {
    if (!Number.isSafeInteger(scope.actorUserId) || Number(scope.actorUserId) <= 0) {
      throw new InvalidResourceQueryError('actor user scope is required');
    }
    predicates.push(eq(definition.actorUserIdColumn, Number(scope.actorUserId)));
  }
  if (scope.accessScope && scope.accessScope !== 'company') {
    if (!definition.scopeUserIdColumn || !scope.allowedUserIds?.length) {
      predicates.push(sql`false`);
    } else {
      predicates.push(inArray(definition.scopeUserIdColumn, scope.allowedUserIds));
    }
  }
  const [row] = await db
    .select()
    .from(definition.table)
    .where(and(...predicates))
    .limit(1);

  return row ? { data: row, meta: {} } : null;
}

export function isKnownResource(resource: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESOURCE_DEFINITIONS, resource);
}

export function readPermissionForResource(resource: string): string {
  const definition = definitionFor(resource);
  return canonicalPermissionForResource(resource, 'view', definition.readPermission);
}

export function createPermissionForResource(resource: string): string {
  const definition = definitionFor(resource);
  if (!definition.createPermission) throw new Error(`Resource '${resource}' does not support create.`);
  return canonicalPermissionForResource(resource, 'create', definition.createPermission);
}

export function updatePermissionForResource(resource: string): string {
  const definition = definitionFor(resource);
  if (!definition.updatePermission) {
    throw new Error(`Resource '${resource}' does not support update.`);
  }
  return canonicalPermissionForResource(resource, 'edit', definition.updatePermission ?? undefined);
}

export function actionPermissionForResource(resource: string, action: string): string {
  const definition = definitionFor(resource);
  if (!definition.allowedActions.includes(action)) {
    throw new Error(`Action '${action}' is not registered for '${resource}'.`);
  }
  return canonicalPermissionForResource(resource, action, definition.readPermission);
}

export function resourceDefinitionFor(resource: string): ResourceDefinition {
  return definitionFor(resource);
}

/**
 * Read-only contract view used by permission-matrix audits and diagnostics.
 * Keep the route registry private while exposing the permission-bearing
 * surface in a stable, non-schema form for automated checks.
 */
export interface ResourcePermissionContract {
  resource: string;
  readPermission: string;
  createPermission: string | null;
  updatePermission: string | null;
  allowedActions: readonly string[];
  canonicalReadPermission: string;
  canonicalCreatePermission: string | null;
  canonicalUpdatePermission: string | null;
  canonicalActionPermissions: Readonly<Record<string, string>>;
}

export function listResourcePermissionContracts(): readonly ResourcePermissionContract[] {
  return Object.freeze(Object.entries(RESOURCE_DEFINITIONS).map(([resource, definition]) => ({
    resource,
    readPermission: definition.readPermission,
    createPermission: definition.createPermission,
    updatePermission: definition.updatePermission,
    allowedActions: [...definition.allowedActions],
    canonicalReadPermission: canonicalPermissionForResource(resource, 'view', definition.readPermission),
    canonicalCreatePermission: definition.createPermission
      ? canonicalPermissionForResource(resource, 'create', definition.createPermission)
      : null,
    canonicalUpdatePermission: definition.updatePermission
      ? canonicalPermissionForResource(resource, 'edit', definition.updatePermission ?? undefined)
      : null,
    canonicalActionPermissions: Object.freeze(Object.fromEntries(
      definition.allowedActions.map((action) => [
        action,
        canonicalPermissionForResource(resource, action, definition.readPermission),
      ]),
    )),
  })));
}
