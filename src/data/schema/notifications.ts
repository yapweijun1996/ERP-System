// User-addressed application notifications. These are first-class delivery facts,
// deliberately separate from audit_log (what happened) and outbox_event (worker
// delivery). Read/dismiss state belongs to one recipient in one active company.
import {
  pgTable, text, bigint, integer, timestamp, index, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';

export const appNotification = pgTable('app_notification', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  recipientUserId: bigint('recipient_user_id', { mode: 'number' })
    .notNull().references(() => appUser.userId),
  kind: text('kind').notNull(),
  severity: text('severity').notNull().default('info'),
  subject: text('subject').notNull(),
  detail: text('detail').notNull(),
  route: text('route'),
  entityRef: text('entity_ref'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  index('idx_app_notification_recipient_feed')
    .on(t.masterFn, t.companyFn, t.recipientUserId, t.id),
  check(
    'ck_app_notification_kind',
    sql`${t.kind} in ('approval_required', 'inventory_attention', 'quality_attention', 'finance_attention', 'sales_attention', 'integration_completed', 'system_notice')`,
  ),
  check(
    'ck_app_notification_severity',
    sql`${t.severity} in ('info', 'success', 'warning', 'critical')`,
  ),
  check(
    'ck_app_notification_subject',
    sql`char_length(trim(${t.subject})) between 1 and 160`,
  ),
  check(
    'ck_app_notification_detail',
    sql`char_length(trim(${t.detail})) between 1 and 500`,
  ),
  check(
    'ck_app_notification_route',
    sql`${t.route} is null or ${t.route} ~ '^[a-z][a-z0-9-]{0,63}$'`,
  ),
  check(
    'ck_app_notification_entity_ref',
    sql`${t.entityRef} is null or char_length(${t.entityRef}) <= 80`,
  ),
  check('ck_app_notification_version', sql`${t.version} > 0`),
]);
