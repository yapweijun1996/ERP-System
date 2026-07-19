// CRM module: sales pipeline opportunities and a lightweight activity log.
// Tenant-scoped. An opportunity is a single-value estimate (no line items) while
// it's in the pipeline — src/modules/crm/convertOpportunityToSalesOrder.ts asks the
// caller for real product lines at conversion time, since that's when a deal's exact
// SKUs/qty are actually decided, not when it's first estimated. See docs/DATA_MODEL.md.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { customer, salesOrder } from './sales';
import { appUser } from './tenancy';

export const opportunity = pgTable('opportunity', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  title: text('title').notNull(),
  value: numeric('value', { precision: 18, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  stage: text('stage').notNull().default('lead'),  // lead | qualified | proposal | negotiation | won | lost
  version: integer('version').notNull().default(1),
  probability: numeric('probability', { precision: 5, scale: 2 }).notNull().default('0'),
  closeDate: date('close_date').notNull(),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).references(() => appUser.userId),
  /** Set once converted — the sales order this opportunity became. Null while open. */
  orderId: bigint('order_id', { mode: 'number' }).references(() => salesOrder.id),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_opp_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_opp_tenant_stage').on(t.masterFn, t.companyFn, t.stage, t.id),
  index('idx_opp_customer').on(t.masterFn, t.companyFn, t.customerId),
]);

/** A person at a customer account — surfaced on Customer-360, not on the pipeline. */
export const contact = pgTable('contact', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  name: text('name').notNull(),
  role: text('role').notNull(),
  email: text('email'),
  phone: text('phone'),
  ...timestamps,
}, (t) => [
  index('idx_contact_customer').on(t.masterFn, t.companyFn, t.customerId),
]);

/**
 * opportunity_id and customer_id are both nullable so the same lightweight log can
 * back an opportunity's timeline (existing use) or a customer's Customer-360 timeline
 * (new use) — ck_activity_target requires at least one target, never neither.
 */
export const activity = pgTable('activity', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  opportunityId: bigint('opportunity_id', { mode: 'number' }).references(() => opportunity.id),
  customerId: bigint('customer_id', { mode: 'number' }).references(() => customer.id),
  kind: text('kind').notNull(),   // note | call | email | system
  body: text('body').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  index('idx_activity_opportunity').on(t.masterFn, t.companyFn, t.opportunityId, t.occurredAt),
  index('idx_activity_customer').on(t.masterFn, t.companyFn, t.customerId, t.occurredAt),
  check(
    'ck_activity_target',
    sql`${t.opportunityId} is not null or ${t.customerId} is not null`,
  ),
]);
