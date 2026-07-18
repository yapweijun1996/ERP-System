// Production security and platform state. These tables are shared by PGlite and
// PostgreSQL so authentication, idempotency, permissions and audit semantics can
// be exercised against both engines. PostgreSQL-only RLS remains a separate
// production migration.
import {
  pgTable, text, bigint, integer, boolean, timestamp, jsonb,
  index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core';
import { tenant, timestamps } from './_shared';
import { appUser, company, role } from './tenancy';

export const appSession = pgTable('app_session', {
  tokenHash: text('token_hash').primaryKey(),
  csrfHash: text('csrf_hash').notNull(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  masterFn: text('master_fn').notNull(),
  activeCompanyFn: text('active_company_fn').notNull().references(() => company.companyFn),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  idleExpiresAt: timestamp('idle_expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  userAgentHash: text('user_agent_hash'),
  ...timestamps,
}, (t) => [
  index('idx_session_user').on(t.masterFn, t.userId, t.revokedAt),
  index('idx_session_expiry').on(t.expiresAt, t.idleExpiresAt),
]);

export const rolePermission = pgTable('role_permission', {
  masterFn: text('master_fn').notNull(),
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => role.roleId),
  permissionKey: text('permission_key').notNull(),
  allowed: boolean('allowed').notNull().default(true),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.roleId, t.permissionKey] }),
  index('idx_role_permission_master').on(t.masterFn, t.permissionKey, t.roleId),
]);

export const apiIdempotency = pgTable('api_idempotency', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  idempotencyKey: text('idempotency_key').notNull(),
  operation: text('operation').notNull(),
  requestHash: text('request_hash').notNull(),
  responseStatus: integer('response_status'),
  responseBody: jsonb('response_body'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_idempotency_actor_key').on(
    t.masterFn, t.companyFn, t.actorUserId, t.idempotencyKey,
  ),
  index('idx_idempotency_expiry').on(t.expiresAt),
]);

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  masterFn: text('master_fn').notNull(),
  companyFn: text('company_fn'),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).references(() => appUser.userId),
  requestId: text('request_id').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  action: text('action').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_audit_tenant_time').on(t.masterFn, t.companyFn, t.occurredAt, t.id),
  index('idx_audit_entity').on(t.masterFn, t.companyFn, t.entity, t.entityId, t.occurredAt),
  index('idx_audit_request').on(t.requestId),
]);

export const authRateLimit = pgTable('auth_rate_limit', {
  identifierHash: text('identifier_hash').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userInvitation = pgTable('user_invitation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  email: text('email').notNull(),
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => role.roleId),
  tokenHash: text('token_hash').notNull(),
  invitedByUserId: bigint('invited_by_user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_invitation_token').on(t.tokenHash),
  index('idx_invitation_tenant_email').on(t.masterFn, t.companyFn, t.email),
]);

export const passwordResetToken = pgTable('password_reset_token', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_password_reset_token').on(t.tokenHash),
  index('idx_password_reset_user').on(t.userId, t.expiresAt),
]);

export const outboxEvent = pgTable('outbox_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  topic: text('topic').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_outbox_pending').on(t.deliveredAt, t.availableAt, t.id),
  index('idx_outbox_tenant_aggregate').on(
    t.masterFn, t.companyFn, t.aggregateType, t.aggregateId, t.id,
  ),
]);
