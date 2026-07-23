// Canonical connector and company-control-plane state. Secrets remain encrypted
// server-side and are never selected into browser-facing read models.
import {
  pgTable, text, bigint, integer, boolean, numeric, date, timestamp, jsonb,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';

export const integrationConnector = pgTable('integration_connector', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  connectorKey: text('connector_key').notNull(),
  displayName: text('display_name').notNull(),
  category: text('category').notNull(),
  direction: text('direction').notNull(),
  schedule: text('schedule').notNull().default('manual'),
  status: text('status').notNull().default('setup'),
  health: text('health').notNull().default('unknown'),
  endpointHost: text('endpoint_host'),
  credentialRequired: boolean('credential_required').notNull().default(true),
  credentialEnvelope: jsonb('credential_envelope'),
  credentialLabel: text('credential_label'),
  recordsProcessed: integer('records_processed').notNull().default(0),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_integration_connector_key').on(t.masterFn, t.companyFn, t.connectorKey),
  index('idx_integration_connector_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_integration_connector_direction', sql`${t.direction} in ('inbound','outbound','two_way')`),
  check('ck_integration_connector_status', sql`${t.status} in ('setup','connected','paused','error')`),
  check('ck_integration_connector_health', sql`${t.health} in ('unknown','healthy','warning','error')`),
  check('ck_integration_connector_records', sql`${t.recordsProcessed} >= 0`),
]);

export const companyPolicy = pgTable('company_policy', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  dateFormat: text('date_format').notNull().default('YYYY-MM-DD'),
  negativeStockPolicy: text('negative_stock_policy').notNull().default('block'),
  approvalThreshold: numeric('approval_threshold', { precision: 18, scale: 2 }).notNull().default('0'),
  sessionTimeoutMinutes: integer('session_timeout_minutes').notNull().default(30),
  defaultWarehouseCode: text('default_warehouse_code'),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_company_policy_company').on(t.masterFn, t.companyFn),
  check('ck_company_policy_date_format', sql`${t.dateFormat} in ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY')`),
  check('ck_company_policy_negative_stock', sql`${t.negativeStockPolicy} in ('block','warn')`),
  check('ck_company_policy_threshold', sql`${t.approvalThreshold} >= 0`),
  check('ck_company_policy_timeout', sql`${t.sessionTimeoutMinutes} between 15 and 1440`),
]);

export const documentSequence = pgTable('document_sequence', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  documentType: text('document_type').notNull(),
  prefix: text('prefix').notNull(),
  nextNumber: integer('next_number').notNull().default(1),
  padding: integer('padding').notNull().default(4),
  resetPolicy: text('reset_policy').notNull().default('yearly'),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_document_sequence_type').on(t.masterFn, t.companyFn, t.documentType),
  index('idx_document_sequence_company').on(t.masterFn, t.companyFn, t.id),
  check('ck_document_sequence_next', sql`${t.nextNumber} > 0`),
  check('ck_document_sequence_padding', sql`${t.padding} between 2 and 10`),
  check('ck_document_sequence_reset', sql`${t.resetPolicy} in ('never','yearly','monthly')`),
]);

export const accountingPeriod = pgTable('accounting_period', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  fiscalYear: integer('fiscal_year').notNull(),
  periodNo: integer('period_no').notNull(),
  label: text('label').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: text('status').notNull().default('open'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedByUserId: bigint('locked_by_user_id', { mode: 'number' }).references(() => appUser.userId),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_accounting_period').on(t.masterFn, t.companyFn, t.fiscalYear, t.periodNo),
  index('idx_accounting_period_status').on(t.masterFn, t.companyFn, t.status, t.startDate, t.id),
  check('ck_accounting_period_number', sql`${t.periodNo} between 1 and 53`),
  check('ck_accounting_period_dates', sql`${t.endDate} >= ${t.startDate}`),
  check('ck_accounting_period_status', sql`${t.status} in ('open','locked')`),
]);
