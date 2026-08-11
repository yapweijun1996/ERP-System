// Production security and platform state. These tables are shared by PGlite and
// PostgreSQL so authentication, idempotency, permissions and audit semantics can
// be exercised against both engines. PostgreSQL-only RLS remains a separate
// production migration.
import {
  pgTable, text, bigint, integer, boolean, timestamp, jsonb,
  index, uniqueIndex, primaryKey, check, foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser, company, master, role } from './tenancy';

export const appSession = pgTable('app_session', {
  tokenHash: text('token_hash').primaryKey(),
  csrfHash: text('csrf_hash').notNull(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUser.userId),
  /** Original administrator while the session is temporarily viewing an employee workspace. */
  impersonatorUserId: bigint('impersonator_user_id', { mode: 'number' }).references(() => appUser.userId),
  impersonatedAt: timestamp('impersonated_at', { withTimezone: true }),
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

/**
 * Platform operators are deliberately not app_user rows. They do not belong to
 * a customer master, cannot be assigned a tenant role, and receive no customer
 * data access unless a separate, expiring support_access_grant authorizes it.
 */
export const platformPrincipal = pgTable('platform_principal', {
  principalId: bigint('principal_id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  principalKey: text('principal_key').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email'),
  /** Independent credential verifier for the platform realm. It is never an
   * app_user credential and is intentionally nullable for pre-login bootstrap
   * principals that can still receive an out-of-band bearer session. */
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_platform_principal_key').on(t.principalKey),
  index('idx_platform_principal_active').on(t.isActive, t.principalId),
]);

/** Application-owned platform role catalogue; tenant role administration never
 * reads or writes this table. TASK-171 may later move these keys to the global
 * permission registry without changing the authority boundary. */
export const platformRole = pgTable('platform_role', {
  platformRoleId: bigint('platform_role_id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isSystemRole: boolean('is_system_role').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_platform_role_code').on(t.code),
]);

export const platformRolePermission = pgTable('platform_role_permission', {
  platformRoleId: bigint('platform_role_id', { mode: 'number' })
    .notNull().references(() => platformRole.platformRoleId),
  permissionKey: text('permission_key').notNull(),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.platformRoleId, t.permissionKey] }),
  index('idx_platform_role_permission_key').on(t.permissionKey, t.platformRoleId),
]);

export const platformPrincipalRole = pgTable('platform_principal_role', {
  principalId: bigint('principal_id', { mode: 'number' })
    .notNull().references(() => platformPrincipal.principalId),
  platformRoleId: bigint('platform_role_id', { mode: 'number' })
    .notNull().references(() => platformRole.platformRoleId),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.principalId, t.platformRoleId] }),
  index('idx_platform_principal_role_role').on(t.platformRoleId, t.principalId),
]);

/** Hash-backed bearer sessions for the separate platform authorization domain. */
export const platformSession = pgTable('platform_session', {
  tokenHash: text('token_hash').primaryKey(),
  csrfHash: text('csrf_hash').notNull(),
  principalId: bigint('principal_id', { mode: 'number' })
    .notNull().references(() => platformPrincipal.principalId),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('idx_platform_session_principal').on(t.principalId, t.revokedAt),
  index('idx_platform_session_expiry').on(t.expiresAt, t.revokedAt),
]);

/** A short-lived platform-superadmin view of one exact tenant user. The
 * platform session remains distinct; this row never creates or mutates an
 * app_session and is revoked immediately when the operator returns. */
export const platformSimulationSession = pgTable('platform_simulation_session', {
  simulationId: bigint('simulation_id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  platformSessionHash: text('platform_session_hash').notNull()
    .references(() => platformSession.tokenHash),
  platformPrincipalId: bigint('platform_principal_id', { mode: 'number' })
    .notNull().references(() => platformPrincipal.principalId),
  targetUserId: bigint('target_user_id', { mode: 'number' })
    .notNull().references(() => appUser.userId),
  masterFn: text('master_fn').notNull().references(() => master.masterFn),
  companyFn: text('company_fn').notNull().references(() => company.companyFn),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_platform_simulation_company_master',
  }),
  uniqueIndex('uq_platform_simulation_active_session').on(t.platformSessionHash)
    .where(sql`${t.revokedAt} is null`),
  index('idx_platform_simulation_principal_window').on(
    t.platformPrincipalId, t.expiresAt, t.revokedAt,
  ),
  index('idx_platform_simulation_target_window').on(
    t.masterFn, t.companyFn, t.targetUserId, t.expiresAt, t.revokedAt,
  ),
]);

export const supportAccessGrant = pgTable('support_access_grant', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  platformPrincipalId: bigint('platform_principal_id', { mode: 'number' })
    .notNull().references(() => platformPrincipal.principalId),
  createdByPrincipalId: bigint('created_by_principal_id', { mode: 'number' })
    .notNull().references(() => platformPrincipal.principalId),
  masterFn: text('master_fn').notNull().references(() => master.masterFn),
  /** Null means the grant may cover any company in the target master. */
  companyFn: text('company_fn').references(() => company.companyFn),
  reason: text('reason').notNull(),
  ticketReference: text('ticket_reference').notNull(),
  mode: text('mode').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  sensitiveRestrictions: jsonb('sensitive_restrictions').notNull().default(sql`'{}'::jsonb`),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByPrincipalId: bigint('revoked_by_principal_id', { mode: 'number' })
    .references(() => platformPrincipal.principalId),
  revocationReason: text('revocation_reason'),
  ...timestamps,
}, (t) => [
  check('ck_support_access_grant_mode', sql`${t.mode} in ('read_only', 'restricted_write', 'break_glass')`),
  check('ck_support_access_grant_window', sql`${t.validUntil} > ${t.validFrom}`),
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_support_access_grant_company_master',
  }),
  index('idx_support_access_grant_principal_window').on(
    t.platformPrincipalId, t.validFrom, t.validUntil, t.revokedAt,
  ),
  index('idx_support_access_grant_tenant_window').on(
    t.masterFn, t.companyFn, t.validFrom, t.validUntil,
  ),
]);

/** Superadmin-controlled per-tenant module gate. Absence of a row for a
 *  (masterFn, moduleKey) pair means "enabled" (the default) -- only rows
 *  disabling a module need to exist. moduleKey matches web/public/assets/
 *  app.js's MODULE_DEFS keys (plus 'sales'/'purchasing'/'inventory', which
 *  today live outside MODULE_DEFS -- see TASK-045). */
export const masterModule = pgTable('master_module', {
  masterFn: text('master_fn').notNull(),
  moduleKey: text('module_key').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  defaultCompanyAllocated: boolean('default_company_allocated').notNull().default(false),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.masterFn, t.moduleKey] }),
  index('idx_master_module_master').on(t.masterFn),
  check('ck_master_module_version', sql`${t.version} > 0`),
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
  platformPrincipalId: bigint('platform_principal_id', { mode: 'number' })
    .references(() => platformPrincipal.principalId),
  requestId: text('request_id').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  action: text('action').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_audit_tenant_time').on(t.masterFn, t.companyFn, t.occurredAt, t.id),
  index('idx_audit_actor_activity').on(t.masterFn, t.companyFn, t.actorUserId, t.id),
  index('idx_audit_platform_activity').on(t.platformPrincipalId, t.occurredAt, t.id),
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

export const systemState = pgTable('system_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  ...timestamps,
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
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_outbox_pending').on(t.deliveredAt, t.availableAt, t.id),
  index('idx_outbox_lease').on(t.deliveredAt, t.lockedAt, t.availableAt, t.id),
  index('idx_outbox_tenant_aggregate').on(
    t.masterFn, t.companyFn, t.aggregateType, t.aggregateId, t.id,
  ),
  uniqueIndex('uq_outbox_document_signal').on(
    t.masterFn, t.companyFn, t.topic, t.aggregateType, t.aggregateId,
  ).where(sql`${t.topic} in (
    'document.scan.requested',
    'document.extraction.requested',
    'receipt.inbox.submitted'
  )`),
]);
