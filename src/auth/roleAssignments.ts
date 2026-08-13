import { and, eq, isNull, ne, or } from 'drizzle-orm';
import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import { appendAudit } from '../api/audit';
import {
  DATA_SCOPES,
  appUser,
  employee,
  role,
  roleResourceScope,
  userCompany,
  userCompanyRole,
  userCompanyRoleScope,
} from '../data/schema';
import { AuthLifecycleError } from './authErrors';
import { bumpAuthorizationVersionWithin } from './authorizationVersion';
import type { DataScope } from './accessCatalog';
import type { SessionData } from './session';

export interface RoleAssignmentScopeInput {
  resourceKey: string;
  scope: DataScope;
  targetType?: string;
  targetId?: string | number | null;
}

export interface CreateRoleAssignmentInput {
  userId: number;
  roleId: number;
  /** Omit to create a new independent assignment, even for the same role. */
  assignmentId?: number;
  validFrom?: Date;
  validUntil?: Date | null;
  reason?: string | null;
  scopes?: RoleAssignmentScopeInput[];
}

function normalizeTarget(input: RoleAssignmentScopeInput) {
  const targetType = input.targetType?.trim() || 'none';
  const stableTargetTypes = ['none', 'company', 'department', 'team', 'employee'] as const;
  if (!stableTargetTypes.includes(
    targetType as typeof stableTargetTypes[number],
  )) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'The scope target type is not supported.');
  }
  const targetId = targetType === 'none' ? '' : String(input.targetId ?? '').trim();
  if (targetType !== 'none' && !targetId) {
    throw new AuthLifecycleError(400, 'invalid_scope_target', 'A scope target id is required.');
  }
  return { targetType, targetId };
}

async function validateScopeTargets(
  exec: DB,
  session: SessionData,
  scopes: ReturnType<typeof normalizeScopes>,
) {
  const employees = scopes.some((scope) => ['department', 'team', 'employee'].includes(scope.targetType))
    ? await exec.select({
      id: employee.id,
      department: employee.department,
    }).from(employee).where(and(
      eq(employee.masterFn, session.masterFn),
      eq(employee.companyFn, session.activeCompanyFn),
      eq(employee.isActive, true),
    ))
    : [];
  for (const scope of scopes) {
    const validTargetForScope = scope.scope === 'company'
      ? scope.targetType === 'none'
        || (scope.targetType === 'company' && scope.targetId === session.activeCompanyFn)
      : scope.scope === 'department'
        ? scope.targetType === 'none' || scope.targetType === 'department'
        : scope.scope === 'team'
          ? scope.targetType === 'none' || scope.targetType === 'team' || scope.targetType === 'employee'
          : scope.targetType === 'none' || scope.targetType === 'employee';
    if (!validTargetForScope) {
      throw new AuthLifecycleError(400, 'invalid_scope_target', 'The scope target does not match the data scope.');
    }
    if (scope.targetType === 'company') {
      if (scope.targetId !== session.activeCompanyFn) {
        throw new AuthLifecycleError(400, 'invalid_scope_target', 'The assignment target must be the active company.');
      }
    } else if (scope.targetType === 'department') {
      if (!employees.some((row) => row.department === scope.targetId)) {
        throw new AuthLifecycleError(400, 'invalid_scope_target', 'The department target is not in the active company.');
      }
    } else if (scope.targetType === 'team' || scope.targetType === 'employee') {
      const targetEmployeeId = Number(scope.targetId);
      if (!Number.isSafeInteger(targetEmployeeId) || !employees.some((row) => row.id === targetEmployeeId)) {
        throw new AuthLifecycleError(400, 'invalid_scope_target', 'The employee/team target is not in the active company.');
      }
    }
  }
}

function normalizeScopes(scopes: RoleAssignmentScopeInput[] | undefined) {
  const rows = (scopes ?? []).map((input) => {
    const resourceKey = input.resourceKey.trim();
    if (!resourceKey || resourceKey.length > 180) {
      throw new AuthLifecycleError(400, 'invalid_scope', 'A valid resource key is required.');
    }
    if (!DATA_SCOPES.includes(input.scope)) {
      throw new AuthLifecycleError(400, 'invalid_scope', 'The data scope is not supported.');
    }
    return { resourceKey, scope: input.scope, ...normalizeTarget(input) };
  });
  const keys = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.resourceKey}|${row.targetType}|${row.targetId}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

async function roleDefaultScopes(exec: DB, masterFn: string, companyFn: string, roleId: number) {
  return exec.select({
    resourceKey: roleResourceScope.resourceKey,
    scope: roleResourceScope.scope,
  }).from(roleResourceScope).where(and(
    eq(roleResourceScope.masterFn, masterFn),
    eq(roleResourceScope.companyFn, companyFn),
    eq(roleResourceScope.roleId, roleId),
  ));
}

export async function createRoleAssignmentWithin(
  exec: DB,
  session: SessionData,
  input: CreateRoleAssignmentInput,
  requestId: string,
  now = new Date(),
) {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0
    || !Number.isSafeInteger(input.roleId) || input.roleId <= 0) {
    throw new AuthLifecycleError(400, 'invalid_request', 'A valid user and role are required.');
  }
  const validFrom = input.validFrom ?? now;
  if (input.validUntil && input.validUntil <= validFrom) {
    throw new AuthLifecycleError(400, 'invalid_validity_window', 'validUntil must be later than validFrom.');
  }
  const [target] = await exec.select({ userId: appUser.userId }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(
      eq(userCompany.userId, input.userId),
      eq(userCompany.companyFn, session.activeCompanyFn),
      eq(appUser.masterFn, session.masterFn),
      eq(appUser.isActive, true),
      eq(appUser.identityKind, 'human'),
    )).limit(1);
  if (!target) throw new AuthLifecycleError(404, 'user_not_found', 'User not found in this company.');

  const [availableRole] = await exec.select({ roleId: role.roleId }).from(role).where(and(
    eq(role.roleId, input.roleId),
    eq(role.masterFn, session.masterFn),
    or(eq(role.companyFn, session.activeCompanyFn), isNull(role.companyFn)),
    or(isNull(role.sourceTemplateKey), ne(role.sourceTemplateKey, 'platform_tenant_admin')),
  )).limit(1);
  if (!availableRole) throw new AuthLifecycleError(400, 'invalid_role', 'The selected role is unavailable.');

  const normalizedScopes = normalizeScopes(input.scopes);
  const scopes = normalizedScopes.length
    ? normalizedScopes
    : (await roleDefaultScopes(exec, session.masterFn, session.activeCompanyFn, input.roleId))
      .map((row) => ({
        resourceKey: row.resourceKey,
        scope: row.scope as DataScope,
        targetType: 'none',
        targetId: '',
      }));
  await validateScopeTargets(exec, session, scopes);

  if (input.assignmentId != null && (!Number.isSafeInteger(input.assignmentId) || input.assignmentId <= 0)) {
    throw new AuthLifecycleError(400, 'invalid_id', 'assignmentId must be a positive integer.');
  }
  const [existing] = input.assignmentId == null ? [] : await exec.select().from(userCompanyRole).where(and(
    eq(userCompanyRole.assignmentId, input.assignmentId),
    eq(userCompanyRole.userId, input.userId),
    eq(userCompanyRole.companyFn, session.activeCompanyFn),
    eq(userCompanyRole.roleId, input.roleId),
  )).limit(1);
  if (input.assignmentId != null && !existing) {
    throw new AuthLifecycleError(404, 'assignment_not_found', 'Role assignment not found.');
  }
  let assignment: typeof userCompanyRole.$inferSelect | undefined;
  if (existing) {
    [assignment] = await exec.update(userCompanyRole).set({
      validFrom,
      validUntil: input.validUntil ?? null,
      assignedByUserId: session.userId,
      assignmentSource: 'manual',
      assignmentReason: input.reason?.trim() || null,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
      scopeBackfilledAt: now,
      updatedAt: now,
    }).where(eq(userCompanyRole.assignmentId, existing.assignmentId)).returning();
  } else {
    [assignment] = await exec.insert(userCompanyRole).values({
      userId: input.userId,
      companyFn: session.activeCompanyFn,
      roleId: input.roleId,
      assignedByUserId: session.userId,
      assignmentSource: 'manual',
      assignmentReason: input.reason?.trim() || null,
      validFrom,
      validUntil: input.validUntil ?? null,
      scopeBackfilledAt: now,
    }).returning();
  }
  if (!assignment) throw new AuthLifecycleError(409, 'assignment_conflict', 'The role assignment could not be saved.');

  await exec.delete(userCompanyRoleScope).where(eq(
    userCompanyRoleScope.assignmentId,
    assignment.assignmentId,
  ));
  for (const scope of scopes) {
    await exec.insert(userCompanyRoleScope).values({
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      assignmentId: assignment.assignmentId,
      resourceKey: scope.resourceKey,
      scope: scope.scope,
      targetType: scope.targetType,
      targetId: scope.targetId,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [
        userCompanyRoleScope.assignmentId,
        userCompanyRoleScope.resourceKey,
        userCompanyRoleScope.targetType,
        userCompanyRoleScope.targetId,
      ],
      set: { scope: scope.scope, updatedAt: now },
    });
  }
  await bumpAuthorizationVersionWithin(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, now);
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'user_company_role',
    entityId: String(assignment.assignmentId),
    action: existing ? 'updated_assignment' : 'assigned_role',
    after: {
      userId: input.userId,
      roleId: input.roleId,
      validFrom: validFrom.toISOString(),
      validUntil: input.validUntil?.toISOString() ?? null,
      scopes: scopes.map((scope) => ({
        resourceKey: scope.resourceKey,
        scope: scope.scope,
        targetType: scope.targetType,
        targetId: scope.targetId || null,
      })),
    },
  });
  return {
    assignmentId: assignment.assignmentId,
    userId: assignment.userId,
    roleId: assignment.roleId,
    validFrom: assignment.validFrom,
    validUntil: assignment.validUntil,
    scopes,
  };
}

export function createRoleAssignment(
  db: DB,
  session: SessionData,
  input: CreateRoleAssignmentInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => createRoleAssignmentWithin(tx, session, input, requestId));
}

export async function revokeRoleAssignmentWithin(
  exec: DB,
  session: SessionData,
  assignmentId: number,
  reason: string,
  requestId: string,
  now = new Date(),
) {
  if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0) {
    throw new AuthLifecycleError(400, 'invalid_id', 'assignmentId must be a positive integer.');
  }
  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new AuthLifecycleError(400, 'invalid_reason', 'A revocation reason is required.');
  }
  const [assignment] = await exec.update(userCompanyRole).set({
    revokedAt: now,
    revokedByUserId: session.userId,
    revocationReason: cleanReason,
    updatedAt: now,
  }).where(and(
    eq(userCompanyRole.assignmentId, assignmentId),
    eq(userCompanyRole.companyFn, session.activeCompanyFn),
    isNull(userCompanyRole.revokedAt),
  )).returning({
    assignmentId: userCompanyRole.assignmentId,
    userId: userCompanyRole.userId,
    roleId: userCompanyRole.roleId,
  });
  if (!assignment) throw new AuthLifecycleError(404, 'assignment_not_found', 'Role assignment not found or already revoked.');
  await bumpAuthorizationVersionWithin(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, now);
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'user_company_role',
    entityId: String(assignmentId),
    action: 'revoked_assignment',
    after: { ...assignment, reason: cleanReason, revokedAt: now.toISOString() },
  });
  return { ...assignment, revokedAt: now, reason: cleanReason };
}

export function revokeRoleAssignment(
  db: DB,
  session: SessionData,
  assignmentId: number,
  reason: string,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => revokeRoleAssignmentWithin(tx, session, assignmentId, reason, requestId));
}
