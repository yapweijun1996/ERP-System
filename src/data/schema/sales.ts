// Sales module: customers, sales orders + lines, invoices. Tenant-scoped.
// See docs/DATA_MODEL.md. Document-level totals are denormalized for reporting; lines hold
// the per-line tax snapshot so a confirmed order reproduces its tax even if rules change.
import {
  pgTable, text, bigint, integer, numeric, date, boolean, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { product, warehouse } from './inventory';
import { appUser } from './tenancy';

export const customer = pgTable('customer', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  industry: text('industry'),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_customer_code').on(t.masterFn, t.companyFn, t.code),
]);

export const salesOrder = pgTable('sales_order', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  status: text('status').notNull().default('draft'),   // draft | confirmed | cancelled
  version: integer('version').notNull().default(1),
  orderDate: date('order_date').notNull(),
  currency: text('currency').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_so_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_so_tenant_date').on(t.masterFn, t.companyFn, t.orderDate, t.id),
]);

export const salesOrderLine = pgTable('sales_order_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => salesOrder.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),   // snapshot
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  index('idx_sol_order').on(t.masterFn, t.companyFn, t.orderId),
]);

export const salesEnquiry = pgTable('sales_enquiry', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('new'), // new | quoted | lost
  version: integer('version').notNull().default(1),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  subject: text('subject').notNull(),
  channel: text('channel').notNull().default('direct'),
  estimatedValue: numeric('estimated_value', { precision: 18, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull(),
  ownerName: text('owner_name').notNull(),
  enquiryDate: date('enquiry_date').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_enquiry_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_sales_enquiry_status').on(t.masterFn, t.companyFn, t.status, t.enquiryDate, t.id),
  index('idx_sales_enquiry_customer').on(t.masterFn, t.companyFn, t.customerId, t.id),
  check('ck_sales_enquiry_status', sql`${t.status} in ('new', 'quoted', 'lost')`),
  check('ck_sales_enquiry_value', sql`${t.estimatedValue} >= 0`),
]);

export const salesQuotation = pgTable('sales_quotation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  enquiryId: bigint('enquiry_id', { mode: 'number' }).references(() => salesEnquiry.id),
  orderId: bigint('order_id', { mode: 'number' }).references(() => salesOrder.id),
  quoteDate: date('quote_date').notNull(),
  validUntil: date('valid_until').notNull(),
  currency: text('currency').notNull(),
  probability: numeric('probability', { precision: 5, scale: 2 }).notNull().default('50'),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_quotation_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_sales_quotation_enquiry').on(t.masterFn, t.companyFn, t.enquiryId),
  index('idx_sales_quotation_status').on(t.masterFn, t.companyFn, t.status, t.quoteDate, t.id),
  index('idx_sales_quotation_customer').on(t.masterFn, t.companyFn, t.customerId, t.id),
  check('ck_sales_quotation_status', sql`${t.status} in ('draft', 'sent', 'accepted', 'converted', 'rejected', 'expired')`),
  check('ck_sales_quotation_probability', sql`${t.probability} >= 0 and ${t.probability} <= 100`),
  check('ck_sales_quotation_dates', sql`${t.validUntil} >= ${t.quoteDate}`),
]);

export const salesQuotationLine = pgTable('sales_quotation_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  quotationId: bigint('quotation_id', { mode: 'number' }).notNull()
    .references(() => salesQuotation.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_quotation_line').on(
    t.masterFn, t.companyFn, t.quotationId, t.lineNo,
  ),
  index('idx_sales_quotation_line_product').on(
    t.masterFn, t.companyFn, t.productId, t.quotationId,
  ),
  check('ck_sales_quotation_line_qty', sql`${t.qty} > 0 and ${t.unitPrice} >= 0`),
]);

export const invoice = pgTable('invoice', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => salesOrder.id),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  status: text('status').notNull().default('unpaid'),  // unpaid | paid | cancelled
  version: integer('version').notNull().default(1),
  invoiceDate: date('invoice_date').notNull(),
  currency: text('currency').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_invoice_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_invoice_order').on(t.masterFn, t.companyFn, t.orderId),
]);

/**
 * Fulfilment proof created by the current atomic order-confirmation command.
 * The command issues stock and posts the invoice in the same transaction, so
 * these records describe the completed delivery rather than a second stock
 * mutation. Advanced pick/pack/partial delivery remains in the Warehouse slice.
 */
export const salesDelivery = pgTable('sales_delivery', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => salesOrder.id),
  invoiceId: bigint('invoice_id', { mode: 'number' }).references(() => invoice.id),
  status: text('status').notNull().default('draft'), // draft | delivered | cancelled
  version: integer('version').notNull().default(1),
  deliveryDate: date('delivery_date').notNull(),
  carrier: text('carrier'),
  trackingNo: text('tracking_no'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_delivery_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_sales_delivery_order').on(t.masterFn, t.companyFn, t.orderId),
  index('idx_sales_delivery_status').on(
    t.masterFn, t.companyFn, t.status, t.deliveryDate, t.id,
  ),
  check('ck_sales_delivery_status', sql`${t.status} in ('draft', 'delivered', 'cancelled')`),
]);

export const salesDeliveryLine = pgTable('sales_delivery_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  deliveryId: bigint('delivery_id', { mode: 'number' }).notNull()
    .references(() => salesDelivery.id),
  lineNo: integer('line_no').notNull(),
  orderLineId: bigint('order_line_id', { mode: 'number' }).notNull()
    .references(() => salesOrderLine.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull()
    .references(() => warehouse.id),
  deliveredQty: numeric('delivered_qty', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_delivery_line').on(
    t.masterFn, t.companyFn, t.deliveryId, t.lineNo,
  ),
  index('idx_sales_delivery_line_order').on(
    t.masterFn, t.companyFn, t.orderLineId, t.id,
  ),
  check('ck_sales_delivery_line_qty', sql`${t.deliveredQty} > 0`),
]);

export const salesReturn = pgTable('sales_return', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  deliveryId: bigint('delivery_id', { mode: 'number' }).notNull()
    .references(() => salesDelivery.id),
  invoiceId: bigint('invoice_id', { mode: 'number' }).notNull().references(() => invoice.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull()
    .references(() => warehouse.id),
  status: text('status').notNull().default('requested'), // requested | credited | rejected
  version: integer('version').notNull().default(1),
  returnDate: date('return_date').notNull(),
  reason: text('reason').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_return_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_sales_return_status').on(t.masterFn, t.companyFn, t.status, t.returnDate, t.id),
  index('idx_sales_return_delivery').on(t.masterFn, t.companyFn, t.deliveryId, t.id),
  check('ck_sales_return_status', sql`${t.status} in ('requested', 'credited', 'rejected')`),
]);

export const salesReturnLine = pgTable('sales_return_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  returnId: bigint('return_id', { mode: 'number' }).notNull().references(() => salesReturn.id),
  lineNo: integer('line_no').notNull(),
  deliveryLineId: bigint('delivery_line_id', { mode: 'number' }).notNull()
    .references(() => salesDeliveryLine.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxCode: text('tax_code').notNull(),
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_return_line').on(t.masterFn, t.companyFn, t.returnId, t.lineNo),
  index('idx_sales_return_line_delivery').on(
    t.masterFn, t.companyFn, t.deliveryLineId, t.id,
  ),
  check('ck_sales_return_line_qty', sql`${t.qty} > 0 and ${t.unitPrice} >= 0`),
]);

export const salesCreditNote = pgTable('sales_credit_note', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  returnId: bigint('return_id', { mode: 'number' }).notNull().references(() => salesReturn.id),
  invoiceId: bigint('invoice_id', { mode: 'number' }).notNull().references(() => invoice.id),
  status: text('status').notNull().default('posted'),
  version: integer('version').notNull().default(1),
  noteDate: date('note_date').notNull(),
  currency: text('currency').notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_credit_note_docno').on(t.masterFn, t.companyFn, t.docNo),
  uniqueIndex('uq_sales_credit_note_return').on(t.masterFn, t.companyFn, t.returnId),
  index('idx_sales_credit_note_invoice').on(t.masterFn, t.companyFn, t.invoiceId, t.id),
  check('ck_sales_credit_note_status', sql`${t.status} in ('posted', 'cancelled')`),
]);

export const salesCreditNoteLine = pgTable('sales_credit_note_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  creditNoteId: bigint('credit_note_id', { mode: 'number' }).notNull()
    .references(() => salesCreditNote.id),
  lineNo: integer('line_no').notNull(),
  returnLineId: bigint('return_line_id', { mode: 'number' }).notNull()
    .references(() => salesReturnLine.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_credit_note_line').on(
    t.masterFn, t.companyFn, t.creditNoteId, t.lineNo,
  ),
]);

export const salesDebitNote = pgTable('sales_debit_note', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  invoiceId: bigint('invoice_id', { mode: 'number' }).notNull().references(() => invoice.id),
  status: text('status').notNull().default('draft'), // draft | posted | cancelled
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
  uniqueIndex('uq_sales_debit_note_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_sales_debit_note_invoice').on(t.masterFn, t.companyFn, t.invoiceId, t.id),
  index('idx_sales_debit_note_status').on(t.masterFn, t.companyFn, t.status, t.noteDate, t.id),
  check('ck_sales_debit_note_status', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  check('ck_sales_debit_note_amount', sql`${t.netAmount} > 0 and ${t.taxAmount} >= 0`),
]);

export const salesPriceList = pgTable('sales_price_list', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  basis: text('basis').notNull().default('standard'), // standard | customer | promotion
  customerId: bigint('customer_id', { mode: 'number' }).references(() => customer.id),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('draft'), // draft | active | archived
  version: integer('version').notNull().default(1),
  isDefault: boolean('is_default').notNull().default(false),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_price_list_code').on(t.masterFn, t.companyFn, t.code),
  uniqueIndex('uq_sales_price_list_default_currency')
    .on(t.masterFn, t.companyFn, t.currency)
    .where(sql`${t.isDefault} = true`),
  index('idx_sales_price_list_status').on(
    t.masterFn, t.companyFn, t.status, t.effectiveFrom, t.id,
  ),
  index('idx_sales_price_list_customer').on(t.masterFn, t.companyFn, t.customerId, t.id),
  check('ck_sales_price_list_basis', sql`${t.basis} in ('standard', 'customer', 'promotion')`),
  check('ck_sales_price_list_status', sql`${t.status} in ('draft', 'active', 'archived')`),
  check(
    'ck_sales_price_list_dates',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
  ),
]);

export const salesPriceListLine = pgTable('sales_price_list_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  priceListId: bigint('price_list_id', { mode: 'number' }).notNull()
    .references(() => salesPriceList.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  minQty: numeric('min_qty', { precision: 18, scale: 4 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
  floorPrice: numeric('floor_price', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_price_list_line').on(
    t.masterFn, t.companyFn, t.priceListId, t.productId, t.minQty,
  ),
  index('idx_sales_price_list_line_product').on(
    t.masterFn, t.companyFn, t.productId, t.priceListId,
  ),
  check(
    'ck_sales_price_list_line_amounts',
    sql`${t.minQty} > 0 and ${t.unitPrice} >= 0 and ${t.floorPrice} >= 0`,
  ),
  check('ck_sales_price_list_floor', sql`${t.unitPrice} >= ${t.floorPrice}`),
]);

export const salesDiscountRule = pgTable('sales_discount_rule', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(), // standard | customer | product | quantity | campaign
  customerId: bigint('customer_id', { mode: 'number' }).references(() => customer.id),
  productId: bigint('product_id', { mode: 'number' }).references(() => product.id),
  minQty: numeric('min_qty', { precision: 18, scale: 4 }),
  minOrderAmount: numeric('min_order_amount', { precision: 18, scale: 2 }),
  discountPct: numeric('discount_pct', { precision: 6, scale: 3 }).notNull(),
  approvalThresholdPct: numeric('approval_threshold_pct', { precision: 6, scale: 3 }),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: text('status').notNull().default('draft'), // draft | active | inactive
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_discount_rule_code').on(t.masterFn, t.companyFn, t.code),
  index('idx_sales_discount_rule_status').on(
    t.masterFn, t.companyFn, t.status, t.effectiveFrom, t.id,
  ),
  check(
    'ck_sales_discount_rule_type',
    sql`${t.ruleType} in ('standard', 'customer', 'product', 'quantity', 'campaign')`,
  ),
  check('ck_sales_discount_rule_status', sql`${t.status} in ('draft', 'active', 'inactive')`),
  check(
    'ck_sales_discount_rule_pct',
    sql`${t.discountPct} >= 0 and ${t.discountPct} <= 100
      and (${t.approvalThresholdPct} is null
        or (${t.approvalThresholdPct} >= 0 and ${t.approvalThresholdPct} <= 100))`,
  ),
  check(
    'ck_sales_discount_rule_dates',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
  ),
]);

export const salesCreditProfile = pgTable('sales_credit_profile', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  currency: text('currency').notNull(),
  creditLimit: numeric('credit_limit', { precision: 18, scale: 2 }).notNull(),
  status: text('status').notNull().default('open'), // open | held
  holdReason: text('hold_reason'),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_sales_credit_profile_customer').on(
    t.masterFn, t.companyFn, t.customerId,
  ),
  index('idx_sales_credit_profile_status').on(
    t.masterFn, t.companyFn, t.status, t.customerId,
  ),
  check('ck_sales_credit_profile_status', sql`${t.status} in ('open', 'held')`),
  check('ck_sales_credit_profile_limit', sql`${t.creditLimit} >= 0`),
]);
