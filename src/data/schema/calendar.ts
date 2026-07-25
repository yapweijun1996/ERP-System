import {
  pgTable, text, bigint, integer, boolean, timestamp, jsonb,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';
import { leaveRequest } from './hr';

/**
 * Optional one-way target for governed ERP calendar facts. Credentials stay in
 * deployment configuration; this row contains only the provider/calendar
 * locator required to route a bounded outbound job.
 */
export const calendarOutboundConnection = pgTable('calendar_outbound_connection', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  calendarRef: text('calendar_ref').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_calendar_outbound_connection')
    .on(t.masterFn, t.companyFn, t.provider, t.calendarRef),
  index('idx_calendar_outbound_connection_enabled')
    .on(t.masterFn, t.companyFn, t.isEnabled, t.id),
  check('ck_calendar_outbound_provider',
    sql`${t.provider} in ('generic', 'google', 'microsoft')`),
]);

/**
 * Durable one-way delivery projection. event_key makes every ERP transition
 * replay-safe; payload is a privacy-redacted snapshot, while the worker still
 * re-reads the source leave before delivery so ERP remains authoritative.
 */
export const calendarOutboundEvent = pgTable('calendar_outbound_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  connectionId: bigint('connection_id', { mode: 'number' }).notNull()
    .references(() => calendarOutboundConnection.id),
  leaveRequestId: bigint('leave_request_id', { mode: 'number' }).notNull()
    .references(() => leaveRequest.id),
  leaveRevisionNo: integer('leave_revision_no').notNull(),
  eventType: text('event_type').notNull(),
  eventKey: text('event_key').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  externalEventId: text('external_event_id'),
  attempts: integer('attempts').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  lastError: text('last_error'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_calendar_outbound_event_key')
    .on(t.masterFn, t.companyFn, t.eventKey),
  index('idx_calendar_outbound_event_pending')
    .on(t.status, t.availableAt, t.id),
  index('idx_calendar_outbound_event_leave')
    .on(t.masterFn, t.companyFn, t.leaveRequestId, t.id),
  index('idx_calendar_outbound_event_connection')
    .on(t.masterFn, t.companyFn, t.connectionId, t.id),
  check('ck_calendar_outbound_event_revision', sql`${t.leaveRevisionNo} > 0`),
  check('ck_calendar_outbound_event_type',
    sql`${t.eventType} in ('approved', 'changed', 'cancelled')`),
  check('ck_calendar_outbound_event_status',
    sql`${t.status} in ('pending', 'delivered', 'failed', 'superseded')`),
  check('ck_calendar_outbound_event_attempts', sql`${t.attempts} >= 0`),
]);
