// CRM module: sales pipeline opportunities and a lightweight activity log.
// Tenant-scoped. An opportunity is a single-value estimate (no line items) while
// it's in the pipeline — src/modules/crm/convertOpportunityToSalesOrder.ts asks the
// caller for real product lines at conversion time, since that's when a deal's exact
// SKUs/qty are actually decided, not when it's first estimated. See docs/DATA_MODEL.md.
import {
  pgTable, text, bigint, numeric, date, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
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

export const activity = pgTable('activity', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  opportunityId: bigint('opportunity_id', { mode: 'number' }).notNull().references(() => opportunity.id),
  kind: text('kind').notNull(),   // note | call | email | system
  body: text('body').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  index('idx_activity_opportunity').on(t.masterFn, t.companyFn, t.opportunityId, t.occurredAt),
]);
