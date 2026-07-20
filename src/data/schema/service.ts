// Service module: warranty/maintenance contract register + service tickets.
// Tenant-scoped. Every contract and ticket belongs to a customer — unlike
// Project, there is no "Internal" case here. Contract status
// (Active/Expiring/Expired) is computed from expiry_date at read time, never
// stored, mirroring Project's over-billed alert and HR's hrIsOnLeaveToday.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { customer } from './sales';

export const SERVICE_CONTRACT_PLANS = ['Gold', 'Silver', 'Bronze'] as const;
export const SERVICE_TICKET_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export const SERVICE_TICKET_COVERAGES = ['in_warranty', 'contract', 'out_of_warranty'] as const;
export const SERVICE_TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;

export const serviceContract = pgTable('service_contract', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  contractNo: text('contract_no').notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  plan: text('plan').notNull(),
  slaResponseHours: integer('sla_response_hours'),
  assetsCovered: integer('assets_covered').notNull().default(0),
  startDate: date('start_date').notNull(),
  expiryDate: date('expiry_date').notNull(),
  annualValue: numeric('annual_value', { precision: 18, scale: 2 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_service_contract_no').on(t.masterFn, t.companyFn, t.contractNo),
  index('idx_service_contract_customer').on(t.masterFn, t.companyFn, t.customerId),
  index('idx_service_contract_expiry').on(t.masterFn, t.companyFn, t.expiryDate),
  check('ck_service_contract_plan', sql`${t.plan} in ('Gold', 'Silver', 'Bronze')`),
  check('ck_service_contract_sla', sql`${t.slaResponseHours} is null or ${t.slaResponseHours} > 0`),
  check('ck_service_contract_assets', sql`${t.assetsCovered} >= 0`),
]);

export const serviceTicket = pgTable('service_ticket', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  ticketNo: text('ticket_no').notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customer.id),
  contractId: bigint('contract_id', { mode: 'number' }).references(() => serviceContract.id),
  assetDescription: text('asset_description').notNull(),
  serialNo: text('serial_no'),
  issue: text('issue').notNull(),
  diagnosis: text('diagnosis'),
  priority: text('priority').notNull().default('Medium'),
  coverage: text('coverage').notNull().default('out_of_warranty'),
  status: text('status').notNull().default('open'),
  technicianName: text('technician_name'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_service_ticket_no').on(t.masterFn, t.companyFn, t.ticketNo),
  index('idx_service_ticket_customer').on(t.masterFn, t.companyFn, t.customerId),
  index('idx_service_ticket_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_service_ticket_priority', sql`${t.priority} in ('Critical', 'High', 'Medium', 'Low')`),
  check('ck_service_ticket_coverage', sql`${t.coverage} in ('in_warranty', 'contract', 'out_of_warranty')`),
  check('ck_service_ticket_status', sql`${t.status} in ('open', 'in_progress', 'closed')`),
]);
