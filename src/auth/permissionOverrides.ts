import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import {
  appUser,
  employee,
  userCompany,
  userPermissionOverride,
} from '../data/schema';
import { appendAudit } from '../api/audit';
import { AuthLifecycleError } from './authErrors';
import { permissionCandidates, permissionDefinition } from './permissionRegistry';
import type { DataScope } from './accessCatalog';
import type { SessionData } from './session';

export type PermissionOverrideEffect = 'allow' | 'deny';

export interface PermissionOverrideInput {
  userId: number;
  permissionKey: string;
  resourceKey?: string | null;
  effect: PermissionOverrideEffect;
  scope?: DataScope;
  targetType?: string;
  targetId?: string | number | null;
  validFrom?: Date;
  validUntil?: Date | null;
  reason: string;
}

const DATA_SCOPES: readonly DataScope[] = ['self', 'team', 'department', 'company'];
const TARGET_TYPES = ['none', 'company', 'department', 'team', 'employee'] as const;

function normalizeReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < 3 || clean.length > 500) {
    throw new AuthLifecycleError(400, 'invalid_reason', 'A reason between 3 and 500 characters is required.');
  }
  return clean;
}

function normalizeInput(input: PermissionOverrideInput, now: Date) {
  const permissionKey = input.permissionKey.trim();
  if (!permissionKey || !permissionCandidates(permissionKey).length
    || permissionDefinition(permissionKey)?.domain === 'platform') {
    throw new AuthLifecycleError(400, 'invalid_permission', 'The permission is not registered for tenant authorization.');
  }
  if (input.effect !== 'allow' && input.effect !== 'deny') {
    throw new AuthLifecycleError(400, 'invalid_effect', 'effect must be allow or deny.');
  }
  const scope = input.scope ?? 'company';
  if (!DATA_SCOPES.includes(scope)) {
    throw new AuthLifecycleError(400, 'invalid_scope', 'The data scope is not supported.');
  }
  const targetType = input.targetType?.trim() || 'none';
  if (!TARGET_TYPES.includes(targetType as typeof TARGET_TYPES[number])) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'The scope target type is not supported.');
  }
  const targetId = targetType === 'none' ? '' : String(input.targetId ?? '').trim();
  if (targetType !== 'none' && !targetId) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'A scope target id is required.');
  }
  if (scope === 'company' && targetType !== 'none' && targetType !== 'company') {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'A company scope requires a company target or none.');
  }
  if (scope === 'department' && !['none', 'department'].includes(targetType)) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'A department scope requires a department target or none.');
  }
  if (scope === 'team' && !['none', 'team', 'employee'].includes(targetType)) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'A team scope requires a team/employee target or none.');
  }
  if (scope === 'self' && !['none', 'employee'].includes(targetType)) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'A self scope requires an employee target or none.');
  }
  const resourceKey = input.resourceKey?.trim() || null;
  const hasControlCharacter = resourceKey
    ? [...resourceKey].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
    : false;
  if (resourceKey && (resourceKey.length > 180 || hasControlCharacter)) {
    throw new AuthLifecycleError(400, 'invalid_resource', 'resourceKey is invalid.');
  }
  const validFrom = input.validFrom ?? now;
  if (Number.isNaN(validFrom.getTime())
    || (input.validUntil != null && Number.isNaN(input.validUntil.getTime()))) {
    throw new AuthLifecycleError(400, 'invalid_validity_window', 'validFrom and validUntil must be valid dates.');
  }
  if (input.validUntil && input.validUntil <= validFrom) {
    throw new AuthLifecycleError(400, 'invalid_validity_window', 'validUntil must be later than validFrom.');
  }
  return {
    permissionKey,
    resourceKey,
    effect: input.effect,
    scope,
    targetType,
    targetId,
    validFrom,
    validUntil: input.validUntil ?? null,
    reason: normalizeReason(input.reason),
  };
}

async function validateTarget(
  exec: DB,
  session: SessionData,
  input: ReturnType<typeof normalizeInput>,
) {
  if (input.targetType === 'none') return;
  if (input.targetType === 'company') {
    if (input.targetId !== session.activeCompanyFn) {
      throw new AuthLifecycleError(400, 'invalid_scope_target', 'The target company is not active.');
    }
    return;
  }
  const employees = await exec.select({ id: employee.id, department: employee.department })
    .from(employee).where(and(
      eq(employee.masterFn, session.masterFn),
      eq(employee.companyFn, session.activeCompanyFn),
      eq(employee.isActive, true),
    ));
  if (input.targetType === 'department') {
    if (!employees.some((row) => row.department === input.targetId)) {
      throw new AuthLifecycleError(400, 'invalid_scope_target', 'The target department is not in the active company.');
    }
    return;
  }
  const id = Number(input.targetId);
  if (!Number.isSafeInteger(id) || id <= 0 || !employees.some((row) => row.id === id)) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'The target employee/team is not in the active company.');
  }
}

export async function createPermissionOverrideWithin(
  exec: DB,
  session: SessionData,
  input: PermissionOverrideInput,
  requestId: string,
  now = new Date(),
) {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new AuthLifecycleError(400, 'invalid_user', 'A valid user is required.');
  }
  const normalized = normalizeInput(input, now);
  const [target] = await exec.select({ userId: appUser.userId }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(
      eq(userCompany.userId, input.userId),
      eq(userCompany.companyFn, session.activeCompanyFn),
      eq(appUser.masterFn, session.masterFn),
      eq(appUser.isActive, true),
    )).limit(1);
  if (!target) throw new AuthLifecycleError(404, 'user_not_found', 'User not found in this company.');
  await validateTarget(exec, session, normalized);
  const [created] = await exec.insert(userPermissionOverride).values({
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    userId: input.userId,
    permissionKey: normalized.permissionKey,
    resourceKey: normalized.resourceKey,
    effect: normalized.effect,
    scope: normalized.scope,
    targetType: normalized.targetType,
    targetId: normalized.targetId,
    reason: normalized.reason,
    validFrom: normalized.validFrom,
    validUntil: normalized.validUntil,
    assignedByUserId: session.userId,
  }).returning({ id: userPermissionOverride.id });
  if (!created) throw new AuthLifecycleError(409, 'override_conflict', 'The permission override could not be saved.');
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'user_permission_override',
    entityId: created.id,
    action: normalized.effect === 'deny' ? 'explicit_deny_created' : 'explicit_allow_created',
    after: {
      userId: input.userId,
      permissionKey: normalized.permissionKey,
      resourceKey: normalized.resourceKey,
      effect: normalized.effect,
      scope: normalized.scope,
      targetType: normalized.targetType,
      targetId: normalized.targetId || null,
      validFrom: normalized.validFrom.toISOString(),
      validUntil: normalized.validUntil?.toISOString() ?? null,
      reason: normalized.reason,
    },
  });
  return { ...created, ...normalized, targetId: normalized.targetId || null };
}

export function createPermissionOverride(
  db: DB,
  session: SessionData,
  input: PermissionOverrideInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => createPermissionOverrideWithin(tx, session, input, requestId));
}

export async function revokePermissionOverrideWithin(
  exec: DB,
  session: SessionData,
  overrideId: number,
  reason: string,
  requestId: string,
  now = new Date(),
) {
  if (!Number.isSafeInteger(overrideId) || overrideId <= 0) {
    throw new AuthLifecycleError(400, 'invalid_id', 'overrideId must be a positive integer.');
  }
  const cleanReason = normalizeReason(reason);
  const [revoked] = await exec.update(userPermissionOverride).set({
    revokedAt: now,
    revokedByUserId: session.userId,
    revocationReason: cleanReason,
    updatedAt: now,
  }).where(and(
    eq(userPermissionOverride.id, overrideId),
    eq(userPermissionOverride.masterFn, session.masterFn),
    eq(userPermissionOverride.companyFn, session.activeCompanyFn),
    isNull(userPermissionOverride.revokedAt),
  )).returning({
    id: userPermissionOverride.id,
    userId: userPermissionOverride.userId,
    permissionKey: userPermissionOverride.permissionKey,
    effect: userPermissionOverride.effect,
  });
  if (!revoked) throw new AuthLifecycleError(404, 'override_not_found', 'Permission override not found or already revoked.');
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'user_permission_override',
    entityId: overrideId,
    action: 'revoked',
    after: { ...revoked, reason: cleanReason, revokedAt: now.toISOString() },
  });
  return { ...revoked, reason: cleanReason, revokedAt: now };
}

export function revokePermissionOverride(
  db: DB,
  session: SessionData,
  overrideId: number,
  reason: string,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => revokePermissionOverrideWithin(tx, session, overrideId, reason, requestId));
}
