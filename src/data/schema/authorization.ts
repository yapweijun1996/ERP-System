// Tenant authorization overrides. Role permissions remain the normal grant
// mechanism; these rows are exceptional, reasoned and time-bounded changes to
// one user's effective access.
import {
  pgTable, text, bigint, timestamp, index, foreignKey, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { appUser, company, userCompany } from './tenancy';
import { tenant, timestamps } from './_shared';

export const AUTHORIZATION_OVERRIDE_EFFECTS = ['allow', 'deny'] as const;
export const AUTHORIZATION_OVERRIDE_TARGET_TYPES = [
  'none', 'company', 'branch', 'department', 'team', 'employee',
  'region', 'business_unit', 'legal_entity', 'cost_center',
] as const;

/**
 * Explicit user-level exceptions. A deny is evaluated before every role grant;
 * an allow is evaluated after denies and before role permissions. A null
 * resource_key applies to the permission across the active company; a value
 * may narrow the exception to one registered resource path.
 */
export const userPermissionOverride = pgTable('user_permission_override', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  userId: bigint('user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  permissionKey: text('permission_key').notNull(),
  resourceKey: text('resource_key'),
  effect: text('effect').notNull(),
  scope: text('scope').notNull().default('company'),
  targetType: text('target_type').notNull().default('none'),
  targetId: text('target_id').notNull().default(''),
  reason: text('reason').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  assignedByUserId: bigint('assigned_by_user_id', { mode: 'number' })
    .notNull().references(() => appUser.userId),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: bigint('revoked_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  revocationReason: text('revocation_reason'),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_user_permission_override_company_master',
  }),
  foreignKey({
    columns: [t.userId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_user_permission_override_membership',
  }),
  index('idx_user_permission_override_lookup').on(
    t.masterFn, t.companyFn, t.userId, t.permissionKey, t.effect, t.validFrom, t.validUntil,
  ),
  index('idx_user_permission_override_resource').on(
    t.masterFn, t.companyFn, t.resourceKey, t.scope, t.targetType, t.targetId,
  ),
  check('ck_user_permission_override_effect', sql`${t.effect} in ('allow', 'deny')`),
  check('ck_user_permission_override_scope', sql`${t.scope} in ('self', 'team', 'department', 'company')`),
  check(
    'ck_user_permission_override_target_type',
    sql`${t.targetType} in ('none', 'company', 'branch', 'department', 'team', 'employee', 'region', 'business_unit', 'legal_entity', 'cost_center')`,
  ),
  check(
    'ck_user_permission_override_target',
    sql`(${t.targetType} = 'none' and ${t.targetId} = '') or (${t.targetType} <> 'none' and char_length(${t.targetId}) > 0)`,
  ),
  check(
    'ck_user_permission_override_window',
    sql`${t.validUntil} is null or ${t.validUntil} > ${t.validFrom}`,
  ),
  check(
    'ck_user_permission_override_revocation',
    sql`(${t.revokedAt} is null and ${t.revokedByUserId} is null and ${t.revocationReason} is null)
      or (${t.revokedAt} is not null and ${t.revokedByUserId} is not null and ${t.revocationReason} is not null)`,
  ),
]);
