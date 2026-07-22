// Purchasing module: suppliers, purchase orders + lines, goods receipts, supplier
// invoices. Tenant-scoped. Mirrors sales.ts's shape (customer/sales_order/
// sales_order_line/invoice), but the purchasing lifecycle has three distinct
// temporal events instead of one: create the PO (commitment, no stock/GL impact),
// receive goods (stock impact, src/modules/purchasing/receiveGoods.ts), post the
// supplier invoice (GL impact, src/modules/purchasing/postSupplierInvoice.ts).
// See docs/DATA_MODEL.md.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, boolean, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { product, warehouse } from './inventory';
import { project } from './project';
import { appUser } from './tenancy';

export const PURCHASE_REQUISITION_PRIORITIES = ['Urgent', 'Project', 'Stock'] as const;
export const PURCHASE_REQUISITION_STATUSES = ['submitted', 'approved', 'rejected'] as const;
export const PURCHASE_RFQ_STATUSES = ['draft', 'sent', 'responded', 'awarded', 'closed'] as const;
export const SUPPLIER_QUOTATION_STATUSES = ['received', 'converted', 'rejected'] as const;
export const PURCHASE_RETURN_STATUSES = ['requested', 'credited', 'rejected'] as const;
export const SUPPLIER_CREDIT_NOTE_STATUSES = ['posted'] as const;
export const SUPPLIER_DEBIT_NOTE_STATUSES = ['draft', 'posted', 'cancelled'] as const;
export const LANDED_COST_STATUSES = ['draft', 'allocated', 'cancelled'] as const;
export const LANDED_COST_ALLOCATION_BASES = ['value', 'quantity'] as const;
export const PURCHASE_ORDER_STATUSES = [
  'pending_approval', 'open', 'received', 'rejected', 'cancelled',
] as const;
export const PURCHASE_ORDER_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;

export const supplier = pgTable('supplier', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_code').on(t.masterFn, t.companyFn, t.code),
]);

/** Effective-dated supplier contract pricing. Purchase documents keep their own
 * immutable cost snapshots; these rows are the sourcing/defaulting policy used
 * before a PO is created, never a mechanism for rewriting an existing order. */
export const supplierPriceList = pgTable('supplier_price_list', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('draft'), // draft | active | archived
  version: integer('version').notNull().default(1),
  isPreferred: boolean('is_preferred').notNull().default(false),
  leadTimeDays: integer('lead_time_days').notNull().default(0),
  paymentTerms: text('payment_terms'),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_price_list_code').on(t.masterFn, t.companyFn, t.code),
  index('idx_supplier_price_list_supplier').on(
    t.masterFn, t.companyFn, t.supplierId, t.status, t.effectiveFrom, t.id,
  ),
  index('idx_supplier_price_list_status').on(
    t.masterFn, t.companyFn, t.status, t.effectiveFrom, t.id,
  ),
  check('ck_supplier_price_list_status', sql`${t.status} in ('draft', 'active', 'archived')`),
  check('ck_supplier_price_list_lead', sql`${t.leadTimeDays} >= 0`),
  check(
    'ck_supplier_price_list_dates',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
  ),
]);

export const supplierPriceListLine = pgTable('supplier_price_list_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  priceListId: bigint('price_list_id', { mode: 'number' }).notNull()
    .references(() => supplierPriceList.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  minQty: numeric('min_qty', { precision: 18, scale: 4 }).notNull().default('1'),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_price_list_line').on(
    t.masterFn, t.companyFn, t.priceListId, t.productId, t.minQty,
  ),
  index('idx_supplier_price_list_line_product').on(
    t.masterFn, t.companyFn, t.productId, t.priceListId,
  ),
  check(
    'ck_supplier_price_list_line_values',
    sql`${t.minQty} > 0 and ${t.unitCost} >= 0`,
  ),
]);

/** Internal purchase request — the upstream step before a purchase order. Plain-text
 *  requester/department (no app_user FK, matching project.ts's manager_name precedent).
 *  `estimated_value` is computed once at create time from the lines, mirroring
 *  purchase_order's own denormalized-totals convention. "Converted" is not a stored
 *  status — it's derived by checking whether any purchase_order.requisition_id points
 *  here (see purchase_order below), the same computed-not-stored precedent as
 *  project.billed_to_date's over-billed check and service_contract's expiry status. */
export const purchaseRequisition = pgTable('purchase_requisition', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  reqNo: text('req_no').notNull(),
  requestedByName: text('requested_by_name').notNull(),
  department: text('department').notNull(),
  neededByDate: date('needed_by_date').notNull(),
  priority: text('priority').notNull().default('Stock'),
  justification: text('justification'),
  status: text('status').notNull().default('submitted'),
  rejectionReason: text('rejection_reason'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  estimatedValue: numeric('estimated_value', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_purchase_requisition_no').on(t.masterFn, t.companyFn, t.reqNo),
  index('idx_purchase_requisition_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_purchase_requisition_priority', sql`${t.priority} in ('Urgent', 'Project', 'Stock')`),
  check('ck_purchase_requisition_status', sql`${t.status} in ('submitted', 'approved', 'rejected')`),
]);

export const purchaseRequisitionLine = pgTable('purchase_requisition_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  requisitionId: bigint('requisition_id', { mode: 'number' }).notNull().references(() => purchaseRequisition.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  estimatedUnitCost: numeric('estimated_unit_cost', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [
  index('idx_purchase_requisition_line_req').on(t.masterFn, t.companyFn, t.requisitionId),
]);

/** A sourcing request issued to one or more invited suppliers. An approved purchase
 *  requisition may feed exactly one RFQ; ad-hoc RFQs leave requisition_id null. */
export const purchaseRfq = pgTable('purchase_rfq', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  requisitionId: bigint('requisition_id', { mode: 'number' }).references(() => purchaseRequisition.id),
  subject: text('subject').notNull(),
  rfqDate: date('rfq_date').notNull(),
  responseDueDate: date('response_due_date').notNull(),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_purchase_rfq_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_purchase_rfq_requisition').on(t.masterFn, t.companyFn, t.requisitionId),
  index('idx_purchase_rfq_status').on(t.masterFn, t.companyFn, t.status, t.rfqDate, t.id),
  check('ck_purchase_rfq_status', sql`${t.status} in ('draft', 'sent', 'responded', 'awarded', 'closed')`),
  check('ck_purchase_rfq_dates', sql`${t.responseDueDate} >= ${t.rfqDate}`),
]);

export const purchaseRfqLine = pgTable('purchase_rfq_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  rfqId: bigint('rfq_id', { mode: 'number' }).notNull().references(() => purchaseRfq.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_purchase_rfq_line').on(t.masterFn, t.companyFn, t.rfqId, t.lineNo),
  index('idx_purchase_rfq_line_product').on(t.masterFn, t.companyFn, t.productId, t.rfqId),
  check('ck_purchase_rfq_line_qty', sql`${t.qty} > 0`),
]);

export const purchaseRfqSupplier = pgTable('purchase_rfq_supplier', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  rfqId: bigint('rfq_id', { mode: 'number' }).notNull().references(() => purchaseRfq.id),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_purchase_rfq_supplier').on(t.masterFn, t.companyFn, t.rfqId, t.supplierId),
  index('idx_purchase_rfq_supplier_supplier').on(t.masterFn, t.companyFn, t.supplierId, t.rfqId),
]);

/** A supplier response snapshots price and tax per requested line. The winning quote
 *  is linked from purchase_order.supplier_quotation_id when converted. */
export const supplierQuotation = pgTable('supplier_quotation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  rfqId: bigint('rfq_id', { mode: 'number' }).notNull().references(() => purchaseRfq.id),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  quoteDate: date('quote_date').notNull(),
  validUntil: date('valid_until').notNull(),
  currency: text('currency').notNull(),
  leadTimeDays: integer('lead_time_days').notNull(),
  paymentTerms: text('payment_terms').notNull(),
  warranty: text('warranty'),
  status: text('status').notNull().default('received'),
  version: integer('version').notNull().default(1),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_quotation_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_supplier_quotation_rfq_supplier').on(t.masterFn, t.companyFn, t.rfqId, t.supplierId),
  index('idx_supplier_quotation_status').on(t.masterFn, t.companyFn, t.status, t.quoteDate, t.id),
  check('ck_supplier_quotation_status', sql`${t.status} in ('received', 'converted', 'rejected')`),
  check('ck_supplier_quotation_dates', sql`${t.validUntil} >= ${t.quoteDate}`),
  check('ck_supplier_quotation_lead', sql`${t.leadTimeDays} >= 0`),
]);

export const supplierQuotationLine = pgTable('supplier_quotation_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  quotationId: bigint('quotation_id', { mode: 'number' }).notNull().references(() => supplierQuotation.id),
  rfqLineId: bigint('rfq_line_id', { mode: 'number' }).notNull().references(() => purchaseRfqLine.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_quotation_line').on(t.masterFn, t.companyFn, t.quotationId, t.lineNo),
  uniqueIndex('uq_supplier_quotation_rfq_line').on(t.masterFn, t.companyFn, t.quotationId, t.rfqLineId),
  index('idx_supplier_quotation_line_product').on(t.masterFn, t.companyFn, t.productId, t.quotationId),
  check('ck_supplier_quotation_line_values', sql`${t.qty} > 0 and ${t.unitCost} >= 0`),
]);

export const purchaseOrder = pgTable('purchase_order', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  requisitionId: bigint('requisition_id', { mode: 'number' }).references(() => purchaseRequisition.id),
  supplierQuotationId: bigint('supplier_quotation_id', { mode: 'number' }).references(() => supplierQuotation.id),
  projectId: bigint('project_id', { mode: 'number' }).references(() => project.id),
  status: text('status').notNull().default('pending_approval'),
  version: integer('version').notNull().default(1),
  orderDate: date('order_date').notNull(),
  currency: text('currency').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_po_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_po_tenant_date').on(t.masterFn, t.companyFn, t.orderDate, t.id),
  index('idx_po_requisition').on(t.masterFn, t.companyFn, t.requisitionId),
  uniqueIndex('uq_po_supplier_quotation').on(t.masterFn, t.companyFn, t.supplierQuotationId),
  index('idx_po_project').on(t.masterFn, t.companyFn, t.projectId),
  check('ck_purchase_order_status', sql`${t.status} in ('pending_approval', 'open', 'received', 'rejected', 'cancelled')`),
]);

/** One immutable submission/decision record per purchase order. New purchase orders
 *  always start pending and can only move to `open` through the audited approval
 *  command. `decided_by_name` is a historical display snapshot; the user FK remains
 *  the authoritative actor identity. Approval itself has no stock or GL effect. */
export const purchaseOrderApproval = pgTable('purchase_order_approval', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => purchaseOrder.id),
  status: text('status').notNull().default('pending'),
  version: integer('version').notNull().default(1),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedByUserId: bigint('decided_by_user_id', { mode: 'number' }).references(() => appUser.userId),
  decidedByName: text('decided_by_name'),
  decisionNote: text('decision_note'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_purchase_order_approval_order').on(t.masterFn, t.companyFn, t.orderId),
  index('idx_purchase_order_approval_status').on(t.masterFn, t.companyFn, t.status, t.submittedAt, t.id),
  check('ck_purchase_order_approval_status', sql`${t.status} in ('pending', 'approved', 'rejected')`),
]);

export const purchaseOrderLine = pgTable('purchase_order_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => purchaseOrder.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),   // snapshot
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  index('idx_pol_order').on(t.masterFn, t.companyFn, t.orderId),
]);

/** One receipt per PO — receives every line's full ordered qty in one transaction
 *  (mirrors confirmSalesOrder's all-lines-at-once shape). purchase_order.status
 *  guards against receiving the same PO twice. */
export const goodsReceipt = pgTable('goods_receipt', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => purchaseOrder.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  receivedDate: date('received_date').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_gr_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_gr_order').on(t.masterFn, t.companyFn, t.orderId),
]);

export const supplierInvoice = pgTable('supplier_invoice', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => purchaseOrder.id),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  projectId: bigint('project_id', { mode: 'number' }).references(() => project.id),
  status: text('status').notNull().default('unpaid'),  // unpaid | paid | cancelled
  version: integer('version').notNull().default(1),
  invoiceDate: date('invoice_date').notNull(),
  currency: text('currency').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_si_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_si_order').on(t.masterFn, t.companyFn, t.orderId),
  index('idx_si_project').on(t.masterFn, t.companyFn, t.projectId),
]);

/** A supplier return is anchored to the real goods receipt and its posted AP invoice.
 *  Quantities and purchase-cost/tax snapshots live on the lines so later PO edits cannot
 *  change the return valuation. `requested` has no stock or GL impact; the atomic
 *  ship-and-credit command performs both exactly once. */
export const purchaseReturn = pgTable('purchase_return', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  goodsReceiptId: bigint('goods_receipt_id', { mode: 'number' }).notNull().references(() => goodsReceipt.id),
  supplierInvoiceId: bigint('supplier_invoice_id', { mode: 'number' }).notNull().references(() => supplierInvoice.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  returnDate: date('return_date').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('requested'),
  version: integer('version').notNull().default(1),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_purchase_return_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_purchase_return_invoice').on(t.masterFn, t.companyFn, t.supplierInvoiceId, t.id),
  index('idx_purchase_return_status').on(t.masterFn, t.companyFn, t.status, t.returnDate, t.id),
  check('ck_purchase_return_status', sql`${t.status} in ('requested', 'credited', 'rejected')`),
]);

export const purchaseReturnLine = pgTable('purchase_return_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  returnId: bigint('return_id', { mode: 'number' }).notNull().references(() => purchaseReturn.id),
  lineNo: integer('line_no').notNull(),
  purchaseOrderLineId: bigint('purchase_order_line_id', { mode: 'number' }).notNull().references(() => purchaseOrderLine.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_purchase_return_line_no').on(t.masterFn, t.companyFn, t.returnId, t.lineNo),
  uniqueIndex('uq_purchase_return_source_line').on(t.masterFn, t.companyFn, t.returnId, t.purchaseOrderLineId),
  index('idx_purchase_return_line_product').on(t.masterFn, t.companyFn, t.productId, t.returnId),
  check('ck_purchase_return_line_values', sql`${t.qty} > 0 and ${t.unitCost} >= 0`),
]);

/** Posted AP credit created only by shipping an approved purchase return. It remains a
 *  separate immutable document rather than rewriting the supplier invoice. */
export const supplierCreditNote = pgTable('supplier_credit_note', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  returnId: bigint('return_id', { mode: 'number' }).notNull().references(() => purchaseReturn.id),
  supplierInvoiceId: bigint('supplier_invoice_id', { mode: 'number' }).notNull().references(() => supplierInvoice.id),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  status: text('status').notNull().default('posted'),
  noteDate: date('note_date').notNull(),
  currency: text('currency').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_credit_note_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_supplier_credit_note_return').on(t.masterFn, t.companyFn, t.returnId),
  index('idx_supplier_credit_note_invoice').on(t.masterFn, t.companyFn, t.supplierInvoiceId, t.id),
  check('ck_supplier_credit_note_status', sql`${t.status} = 'posted'`),
]);

export const supplierCreditNoteLine = pgTable('supplier_credit_note_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  creditNoteId: bigint('credit_note_id', { mode: 'number' }).notNull().references(() => supplierCreditNote.id),
  lineNo: integer('line_no').notNull(),
  returnLineId: bigint('return_line_id', { mode: 'number' }).notNull().references(() => purchaseReturnLine.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_credit_note_line').on(t.masterFn, t.companyFn, t.creditNoteId, t.lineNo),
  uniqueIndex('uq_supplier_credit_note_return_line').on(t.masterFn, t.companyFn, t.returnLineId),
  index('idx_supplier_credit_note_line_product').on(t.masterFn, t.companyFn, t.productId, t.creditNoteId),
]);

/** Buyer-issued commercial claim against one supplier invoice. Unlike a purchase
 *  return, this document never moves stock: posting reduces AP through the existing
 *  purchase-variance account and reverses the applicable input tax. */
export const supplierDebitNote = pgTable('supplier_debit_note', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  supplierInvoiceId: bigint('supplier_invoice_id', { mode: 'number' }).notNull().references(() => supplierInvoice.id),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  noteDate: date('note_date').notNull(),
  currency: text('currency').notNull(),
  reason: text('reason').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_debit_note_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_supplier_debit_note_invoice').on(t.masterFn, t.companyFn, t.supplierInvoiceId, t.status, t.id),
  index('idx_supplier_debit_note_status').on(t.masterFn, t.companyFn, t.status, t.noteDate, t.id),
  check('ck_supplier_debit_note_status', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  check('ck_supplier_debit_note_amounts', sql`${t.netAmount} > 0 and ${t.taxAmount} >= 0 and ${t.totalAmount} > 0`),
]);

/** Receipt-linked capitalization of freight, duty and handling. The document is
 * tax-exclusive: recoverable tax belongs to its supplier invoice, not this valuation
 * entry. Allocation revalues current on-hand but never changes quantity. */
export const landedCost = pgTable('landed_cost', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  goodsReceiptId: bigint('goods_receipt_id', { mode: 'number' }).notNull().references(() => goodsReceipt.id),
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => purchaseOrder.id),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  costDate: date('cost_date').notNull(),
  currency: text('currency').notNull(),
  allocationBasis: text('allocation_basis').notNull(),
  goodsValue: numeric('goods_value', { precision: 18, scale: 2 }).notNull(),
  freightAmount: numeric('freight_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  dutyAmount: numeric('duty_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  handlingAmount: numeric('handling_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  otherAmount: numeric('other_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  totalAddedCost: numeric('total_added_cost', { precision: 18, scale: 2 }).notNull(),
  allocatedAt: timestamp('allocated_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_landed_cost_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_landed_cost_receipt').on(t.masterFn, t.companyFn, t.goodsReceiptId, t.id),
  index('idx_landed_cost_status').on(t.masterFn, t.companyFn, t.status, t.costDate, t.id),
  check('ck_landed_cost_status', sql`${t.status} in ('draft', 'allocated', 'cancelled')`),
  check('ck_landed_cost_basis', sql`${t.allocationBasis} in ('value', 'quantity')`),
  check('ck_landed_cost_values', sql`
    ${t.goodsValue} > 0 and ${t.freightAmount} >= 0 and ${t.dutyAmount} >= 0
    and ${t.handlingAmount} >= 0 and ${t.otherAmount} >= 0 and ${t.totalAddedCost} > 0
  `),
]);

/** Immutable source/allocation snapshot. The three nullable valuation fields are
 * filled exactly once by allocate; source qty/value and allocated_amount never change. */
export const landedCostLine = pgTable('landed_cost_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  landedCostId: bigint('landed_cost_id', { mode: 'number' }).notNull().references(() => landedCost.id),
  lineNo: integer('line_no').notNull(),
  purchaseOrderLineId: bigint('purchase_order_line_id', { mode: 'number' }).notNull().references(() => purchaseOrderLine.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  receivedQty: numeric('received_qty', { precision: 18, scale: 4 }).notNull(),
  goodsValue: numeric('goods_value', { precision: 18, scale: 2 }).notNull(),
  allocatedAmount: numeric('allocated_amount', { precision: 18, scale: 2 }).notNull(),
  onHandQtyAtAllocation: numeric('on_hand_qty_at_allocation', { precision: 18, scale: 4 }),
  averageCostBefore: numeric('average_cost_before', { precision: 22, scale: 8 }),
  averageCostAfter: numeric('average_cost_after', { precision: 22, scale: 8 }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_landed_cost_line_no').on(t.masterFn, t.companyFn, t.landedCostId, t.lineNo),
  uniqueIndex('uq_landed_cost_source_line').on(t.masterFn, t.companyFn, t.landedCostId, t.purchaseOrderLineId),
  index('idx_landed_cost_line_product').on(t.masterFn, t.companyFn, t.productId, t.landedCostId),
  check('ck_landed_cost_line_values', sql`
    ${t.receivedQty} > 0 and ${t.goodsValue} >= 0 and ${t.allocatedAmount} >= 0
  `),
]);
