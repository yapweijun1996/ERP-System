import { and, asc, eq, gt } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  account,
  activity,
  bankReceipt,
  contact,
  customer,
  glEntry,
  goodsReceipt,
  invoice,
  opportunity,
  paymentVoucher,
  paymentVoucherLine,
  product,
  inventoryLot,
  inventorySerial,
  inventoryAdjustment,
  purchaseOrder,
  purchaseOrderLine,
  purchaseRequisition,
  purchaseRequisitionLine,
  purchaseRfq,
  purchaseRfqLine,
  purchaseRfqSupplier,
  salesOrder,
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
  leaveRequest,
  payrollRun,
  payrollRunLine,
  project,
  progressClaim,
  serviceContract,
  serviceTicket,
} from '../data/schema';

export interface ApiScope {
  masterFn: string;
  companyFn: string;
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
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Canonical resources exposed by the phase-2 read API. The registry is an
 * allowlist: route parameters can never become SQL identifiers.
 */
const RESOURCE_DEFINITIONS: Record<string, ResourceDefinition> = {
  'inventory/products': resource(product, 'inventory.read', {
    versionColumn: product.version,
    allowedActions: ['update'],
    createPermission: 'inventory.write',
    updatePermission: 'inventory.write',
  }),
  'inventory/warehouses': resource(warehouse, 'inventory.read'),
  'inventory/stock-levels': resource(stockLevel, 'inventory.read'),
  'inventory/stock-movements': resource(stockMovement, 'inventory.read'),
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
    allowedActions: ['confirm'],
  }),
  'sales/customers': resource(customer, 'sales.read'),
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
  'sales/enquiries': resource(salesEnquiry, 'sales.read', {
    status: salesEnquiry.status,
    versionColumn: salesEnquiry.version,
    allowedActions: ['convert-to-quotation'],
    createPermission: 'sales.write',
  }),
  'sales/quotations': resource(salesQuotation, 'sales.read', {
    status: salesQuotation.status,
    versionColumn: salesQuotation.version,
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
  'finance/gl-entries': resource(glEntry, 'finance.read'),
  'finance/bank-receipts': resource(bankReceipt, 'finance.read', { createPermission: 'finance.write' }),
  'finance/payment-vouchers': resource(paymentVoucher, 'finance.read', { createPermission: 'finance.write' }),
  'finance/payment-voucher-lines': resource(paymentVoucherLine, 'finance.read'),
  'purchasing/suppliers': resource(supplier, 'purchasing.read'),
  'purchasing/purchase-orders': resource(purchaseOrder, 'purchasing.read', {
    status: purchaseOrder.status,
    versionColumn: purchaseOrder.version,
    allowedActions: ['receive', 'post-invoice'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/purchase-order-lines': resource(purchaseOrderLine, 'purchasing.read'),
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
  'purchasing/goods-receipts': resource(goodsReceipt, 'purchasing.read'),
  'purchasing/supplier-invoices': resource(supplierInvoice, 'purchasing.read', {
    status: supplierInvoice.status,
    versionColumn: supplierInvoice.version,
  }),
  'crm/opportunities': resource(opportunity, 'crm.read', {
    status: opportunity.stage,
    customerId: opportunity.customerId,
    versionColumn: opportunity.version,
    allowedActions: ['convert', 'mark-lost'],
    createPermission: 'crm.write',
    updatePermission: 'crm.write',
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
  'payroll/run-lines': resource(payrollRunLine, 'payroll.read'),
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
  'service/contracts': resource(serviceContract, 'service.read', {
    createPermission: 'service.write',
  }),
  'service/tickets': resource(serviceTicket, 'service.read', {
    status: serviceTicket.status,
    allowedActions: ['assign', 'resolve'],
    createPermission: 'service.write',
  }),
};

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
  } = {},
): ResourceDefinition {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const allowedFilters: string[] = [];
  if (options.status) allowedFilters.push('status');
  if (options.customerId) allowedFilters.push('customerId');
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

  const predicates = [
    eq(definition.table.masterFn, scope.masterFn),
    eq(definition.table.companyFn, scope.companyFn),
    gt(definition.idColumn, cursor),
  ];
  if (definition.status && typeof query.status === 'string' && query.status) {
    predicates.push(eq(definition.status, query.status));
  }
  if (definition.customerId && query.customerId != null && query.customerId !== '') {
    predicates.push(eq(definition.customerId, Number(query.customerId)));
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
  const resourceId = parsePositiveInteger(id, 0, 'id');
  if (resourceId < 1) throw new InvalidResourceQueryError('id must be a positive integer');

  const [row] = await db
    .select()
    .from(definition.table)
    .where(and(
      eq(definition.table.masterFn, scope.masterFn),
      eq(definition.table.companyFn, scope.companyFn),
      eq(definition.idColumn, resourceId),
    ))
    .limit(1);

  return row ? { data: row, meta: {} } : null;
}

export function isKnownResource(resource: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESOURCE_DEFINITIONS, resource);
}

export function readPermissionForResource(resource: string): string {
  return definitionFor(resource).readPermission;
}

export function resourceDefinitionFor(resource: string): ResourceDefinition {
  return definitionFor(resource);
}
