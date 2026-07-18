// Purchasing module: suppliers, purchase orders + lines, goods receipts, supplier
// invoices. Tenant-scoped. Mirrors sales.ts's shape (customer/sales_order/
// sales_order_line/invoice), but the purchasing lifecycle has three distinct
// temporal events instead of one: create the PO (commitment, no stock/GL impact),
// receive goods (stock impact, src/modules/purchasing/receiveGoods.ts), post the
// supplier invoice (GL impact, src/modules/purchasing/postSupplierInvoice.ts).
// See docs/DATA_MODEL.md.
import {
  pgTable, text, bigint, integer, numeric, date, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenant, timestamps } from './_shared';
import { product, warehouse } from './inventory';

export const supplier = pgTable('supplier', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_supplier_code').on(t.masterFn, t.companyFn, t.code),
]);

export const purchaseOrder = pgTable('purchase_order', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull().references(() => supplier.id),
  status: text('status').notNull().default('open'),   // open | received | cancelled
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
]);
