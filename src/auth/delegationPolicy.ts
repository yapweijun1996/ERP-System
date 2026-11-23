import { and, eq, isNull, or } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  role,
  rolePermission,
  roleResourceScope,
  userCompanyRole,
  userCompanyRoleScope,
} from '../data/schema';
import {
  isSystemManagedTenantRole,
  type DataScope,
} from './accessCatalog';
import { AuthLifecycleError } from './authErrors';
import { authorizeWithin } from './authorization';
import { assertProvisionedCompanyOwnerAuthorityWithin } from './delegationAuthority';
import { PERMISSIONS } from './permissionKeys';
import { permissionCandidates } from './permissionRegistry';
import { activeRoleAssignmentCondition } from './roleAssignmentState';
import type { SessionData } from './session';

export interface DelegatedScope {
  resourceKey: string;
  scope: DataScope;
  targetType?: string;
  targetId?: string | number | null;
}

const NON_DELEGABLE_PERMISSION_KEYS = new Set<string>([
  PERMISSIONS.usersManage,
  PERMISSIONS.rolesWrite,
]);

function principal(session: SessionData) {
  return {
    userId: session.userId,
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  };
}

function inferredResourceKeys(permissionKey: string): string[] {
  return [...new Set(permissionCandidates(permissionKey).map((candidate) =>
    candidate === '*' ? '*' : `${candidate.split('.')[0]}/*`))];
}

function resourcePatternsOverlap(left: string, right: string): boolean {
  if (left === '*' || right === '*') return true;
  const leftPrefix = left.endsWith('/*') ? left.slice(0, -1) : left;
  const rightPrefix = right.endsWith('/*') ? right.slice(0, -1) : right;
  return left.startsWith(rightPrefix) || right.startsWith(leftPrefix);
}

function relevantScopes(permissionKey: string, scopes: readonly DelegatedScope[]) {
  const resources = inferredResourceKeys(permissionKey);
  return scopes.filter((scope) => resources.some((resource) =>
    resourcePatternsOverlap(scope.resourceKey, resource)));
}

function normalizedScopeTarget(
  session: SessionData,
  scope: DelegatedScope,
  subjectUserId: number | null | undefined,
) {
  const targetType = scope.targetType?.trim() || 'none';
  if (targetType === 'none' && scope.scope !== 'company' && subjectUserId !== session.userId) {
    // Relative self/team/organization grants resolve against the recipient, not
    // the delegator. Only company-wide authority can safely cover that unknown set.
    return { scope: 'company' as const, targetType: 'none', targetId: null };
  }
  return {
    scope: scope.scope,
    targetType,
    targetId: targetType === 'none' ? null : String(scope.targetId ?? ''),
  };
}

export async function assertCanDelegatePermissionWithin(
  exec: DB,
  session: SessionData,
  permissionKey: string,
  scope?: DelegatedScope,
  subjectUserId?: number | null,
  now = new Date(),
): Promise<void> {
  if (permissionCandidates(permissionKey).some((candidate) =>
    NON_DELEGABLE_PERMISSION_KEYS.has(candidate))) {
    await assertProvisionedCompanyOwnerAuthorityWithin(exec, session, now);
  }
  const resourceKeys = scope?.resourceKey.trim()
    ? [scope.resourceKey.trim()]
    : inferredResourceKeys(permissionKey);
  const scopeTarget = scope ? normalizedScopeTarget(session, scope, subjectUserId) : undefined;
  for (const resourceKey of resourceKeys.length ? resourceKeys : [null]) {
    const decision = await authorizeWithin(exec, principal(session), permissionKey, scope ? {
      resourceKey,
      requireScope: true,
      scopeTarget,
      now,
    } : { now });
    if (decision.allowed) return;
  }
  throw new AuthLifecycleError(
    403,
    'delegation_ceiling_exceeded',
    'You cannot grant a permission or data scope that you do not currently hold.',
  );
}

export async function assertCanDelegatePermissionSetWithin(
  exec: DB,
  session: SessionData,
  permissionKeys: readonly string[],
  scopes: readonly DelegatedScope[],
  subjectUserId?: number | null,
  now = new Date(),
): Promise<void> {
  for (const permissionKey of [...new Set(permissionKeys)]) {
    const permissionScopes = relevantScopes(permissionKey, scopes);
    if (!permissionScopes.length) {
      await assertCanDelegatePermissionWithin(
        exec, session, permissionKey, undefined, subjectUserId, now,
      );
      continue;
    }
    for (const scope of permissionScopes) {
      await assertCanDelegatePermissionWithin(
        exec, session, permissionKey, scope, subjectUserId, now,
      );
    }
  }
}

async function roleDefaultScopes(
  exec: DB,
  session: SessionData,
  roleId: number,
): Promise<DelegatedScope[]> {
  const rows = await exec.select({
    resourceKey: roleResourceScope.resourceKey,
    scope: roleResourceScope.scope,
  }).from(roleResourceScope).where(and(
    eq(roleResourceScope.masterFn, session.masterFn),
    eq(roleResourceScope.companyFn, session.activeCompanyFn),
    eq(roleResourceScope.roleId, roleId),
  ));
  return rows.map((row) => ({
    resourceKey: row.resourceKey,
    scope: row.scope as DataScope,
    targetType: 'none',
    targetId: null,
  }));
}

export async function assertCanDelegateRoleWithin(
  exec: DB,
  session: SessionData,
  roleId: number,
  scopes?: readonly DelegatedScope[],
  subjectUserId?: number | null,
  now = new Date(),
): Promise<void> {
  const [targetRole] = await exec.select({
    roleId: role.roleId,
    isSuperadmin: role.isSuperadmin,
    sourceTemplateKey: role.sourceTemplateKey,
  }).from(role).where(and(
    eq(role.roleId, roleId),
    eq(role.masterFn, session.masterFn),
    or(eq(role.companyFn, session.activeCompanyFn), isNull(role.companyFn)),
  )).limit(1);
  if (!targetRole) {
    throw new AuthLifecycleError(400, 'invalid_role', 'The selected role is unavailable.');
  }
  if (targetRole.isSuperadmin || isSystemManagedTenantRole(targetRole.sourceTemplateKey)) {
    throw new AuthLifecycleError(
      403,
      'protected_role_assignment',
      'System-managed owner and administrator roles cannot be delegated.',
    );
  }
  const permissions = await exec.select({ permissionKey: rolePermission.permissionKey })
    .from(rolePermission)
    .where(and(
      eq(rolePermission.masterFn, session.masterFn),
      eq(rolePermission.roleId, roleId),
      eq(rolePermission.allowed, true),
    ));
  await assertCanDelegatePermissionSetWithin(
    exec,
    session,
    permissions.map((row) => row.permissionKey),
    scopes ? [...scopes] : await roleDefaultScopes(exec, session, roleId),
    subjectUserId,
    now,
  );
}

export async function assertCanGrantPermissionToRoleWithin(
  exec: DB,
  session: SessionData,
  roleId: number,
  permissionKey: string,
  now = new Date(),
): Promise<void> {
  const defaults = await roleDefaultScopes(exec, session, roleId);
  await assertCanDelegatePermissionSetWithin(
    exec,
    session,
    [permissionKey],
    defaults,
    null,
    now,
  );
  const assignments = await exec.select({
    assignmentId: userCompanyRole.assignmentId,
    userId: userCompanyRole.userId,
  }).from(userCompanyRole).where(and(
    eq(userCompanyRole.companyFn, session.activeCompanyFn),
    eq(userCompanyRole.roleId, roleId),
    activeRoleAssignmentCondition(now),
  ));
  for (const assignment of assignments) {
    const scopes = await exec.select({
      resourceKey: userCompanyRoleScope.resourceKey,
      scope: userCompanyRoleScope.scope,
      targetType: userCompanyRoleScope.targetType,
      targetId: userCompanyRoleScope.targetId,
    }).from(userCompanyRoleScope).where(and(
      eq(userCompanyRoleScope.masterFn, session.masterFn),
      eq(userCompanyRoleScope.companyFn, session.activeCompanyFn),
      eq(userCompanyRoleScope.assignmentId, assignment.assignmentId),
    ));
    if (!scopes.length) continue;
    await assertCanDelegatePermissionSetWithin(
      exec,
      session,
      [permissionKey],
      scopes.map((scope) => ({ ...scope, scope: scope.scope as DataScope })),
      assignment.userId,
      now,
    );
  }
}

export async function assertCanSetRoleScopeWithin(
  exec: DB,
  session: SessionData,
  roleId: number,
  scope: DelegatedScope,
  now = new Date(),
): Promise<void> {
  const permissions = await exec.select({ permissionKey: rolePermission.permissionKey })
    .from(rolePermission)
    .where(and(
      eq(rolePermission.masterFn, session.masterFn),
      eq(rolePermission.roleId, roleId),
      eq(rolePermission.allowed, true),
    ));
  await assertCanDelegatePermissionSetWithin(
    exec,
    session,
    permissions.map((row) => row.permissionKey),
    [scope],
    null,
    now,
  );
}
