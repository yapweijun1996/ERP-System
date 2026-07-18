// Sales module: customers, sales orders + lines, invoices. Tenant-scoped.
// See docs/DATA_MODEL.md. Document-level totals are denormalized for reporting; lines hold
// the per-line tax snapshot so a confirmed order reproduces its tax even if rules change.
import {
  pgTable, text, bigint, integer, numeric, date, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenant, timestamps } from './_shared';
import { product } from './inventory';

export const customer = pgTable('customer', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
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
