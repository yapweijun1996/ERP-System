import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  company, role, rolePermission, roleResourceScope, userCompanyRole, userCompanyRoleScope,
  userPermissionOverride,
} from '../data/schema';
import type { SessionData } from './session';
import type { DataScope } from './accessCatalog';
import { PERMISSIONS } from './permissionKeys';
import { PERMISSION_REGISTRY, permissionCandidates } from './permissionRegistry';
import { activeRoleAssignmentCondition } from './roleAssignmentState';
import { authorize, principalFromSession } from './authorization';

export { PERMISSIONS } from './permissionKeys';

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | (string & {});

export async function hasPermission(
  db: DB,
  session: SessionData,
  permissionKey: PermissionKey,
  now = new Date(),
): Promise<boolean> {
  return (await authorize(db, {
    principal: principalFromSession(session),
    permissionKey,
    now,
  })).allowed;
}

export async function hasAnyPermission(
  db: DB,
  session: SessionData,
  permissionKeys: readonly PermissionKey[],
): Promise<boolean> {
  for (const permissionKey of permissionKeys) {
    if (await hasPermission(db, session, permissionKey)) return true;
  }
  return false;
}

const SCOPE_RANK: Record<DataScope, number> = {
  self: 0,
  team: 1,
  department: 2,
  company: 3,
};

export interface EffectiveCapability {
  permissions: string[];
  scopes: Record<string, DataScope>;
  scopeGrants: Record<string, ScopeGrant[]>;
}

export interface ScopeGrant {
  scope: DataScope;
  targetType: string;
  targetId: string | null;
}

export async function effectiveCapabilities(
  db: DB,
  session: SessionData,
  now = new Date(),
): Promise<EffectiveCapability> {
  const superadmin = await isSuperadminSession(db, session, now);
  const overrides = await db.select().from(userPermissionOverride).where(and(
    eq(userPermissionOverride.masterFn, session.masterFn),
    eq(userPermissionOverride.companyFn, session.activeCompanyFn),
    eq(userPermissionOverride.userId, session.userId),
    lte(userPermissionOverride.validFrom, now),
    or(isNull(userPermissionOverride.validUntil), gt(userPermissionOverride.validUntil, now)),
    isNull(userPermissionOverride.revokedAt),
  ));
  // Capabilities are a UX/session snapshot, not the authorization source of
  // truth. A scoped deny is conservatively removed from the snapshot as a
  // whole so the UI cannot advertise access that the central decision service
  // will reject. Record-level evaluation remains in authorize().
  const deniedKeys = new Set(overrides
    .filter((row) => row.effect === 'deny')
    .flatMap((row) => permissionCandidates(row.permissionKey)));
  const allowedKeys = new Set(overrides
    .filter((row) => row.effect === 'allow')
    .flatMap((row) => permissionCandidates(row.permissionKey)));
  if (superadmin && !overrides.length) {
    return { permissions: ['*'], scopes: { '*': 'company' }, scopeGrants: {} };
  }
  const permissions = await db.select({ permissionKey: rolePermission.permissionKey })
    .from(userCompanyRole)
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .innerJoin(rolePermission, eq(rolePermission.roleId, role.roleId))
    .where(and(
      eq(userCompanyRole.userId, session.userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
      eq(role.masterFn, session.masterFn),
      or(eq(role.companyFn, session.activeCompanyFn), isNull(role.companyFn)),
      eq(rolePermission.allowed, true),
      activeRoleAssignmentCondition(now),
    ));
  const assignmentScopeRows = await db.select({
    resourceKey: userCompanyRoleScope.resourceKey,
    scope: userCompanyRoleScope.scope,
    targetType: userCompanyRoleScope.targetType,
    targetId: userCompanyRoleScope.targetId,
  }).from(userCompanyRole)
    .innerJoin(userCompanyRoleScope, eq(
      userCompanyRoleScope.assignmentId,
      userCompanyRole.assignmentId,
    ))
    .where(and(
      eq(userCompanyRole.userId, session.userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
      eq(userCompanyRoleScope.masterFn, session.masterFn),
      eq(userCompanyRoleScope.companyFn, session.activeCompanyFn),
      activeRoleAssignmentCondition(now),
    ));
  const legacyScopeRows = await db.select({
    resourceKey: roleResourceScope.resourceKey,
    scope: roleResourceScope.scope,
    targetType: roleResourceScope.resourceKey,
    targetId: roleResourceScope.resourceKey,
  }).from(userCompanyRole)
    .innerJoin(roleResourceScope, and(
      eq(roleResourceScope.roleId, userCompanyRole.roleId),
      eq(roleResourceScope.masterFn, session.masterFn),
      eq(roleResourceScope.companyFn, session.activeCompanyFn),
    ))
    .where(and(
      eq(userCompanyRole.userId, session.userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
      isNull(userCompanyRole.scopeBackfilledAt),
      activeRoleAssignmentCondition(now),
    ));
  const scopeRows: ScopeGrantRow[] = [
    ...assignmentScopeRows.map((row) => ({
      resourceKey: row.resourceKey,
      scope: row.scope,
      targetType: row.targetType,
      targetId: row.targetId,
    })),
    ...legacyScopeRows.map((row) => ({
      resourceKey: row.resourceKey,
      scope: row.scope,
      targetType: 'none',
      targetId: '',
    })),
  ];
  const capabilityPermissions = superadmin
    ? PERMISSION_REGISTRY
      .filter((definition) => definition.domain === 'tenant')
      .map((definition) => definition.code)
    : permissions.map((row) => row.permissionKey);
  const visiblePermissions = [...new Set([
    ...capabilityPermissions.filter((permissionKey) => permissionKey === '*' || !deniedKeys.has(permissionKey)),
    ...allowedKeys,
  ])].sort();
  const scopes: Record<string, DataScope> = superadmin ? { '*': 'company' } : {};
  const scopeGrants: Record<string, ScopeGrant[]> = {};
  for (const row of scopeRows) {
    const value = row.scope as DataScope;
    const current = scopes[row.resourceKey];
    if (!current || SCOPE_RANK[value] > SCOPE_RANK[current]) scopes[row.resourceKey] = value;
    const grants = scopeGrants[row.resourceKey] ?? [];
    if (!grants.some((grant) =>
      grant.scope === value
      && grant.targetType === row.targetType
      && grant.targetId === (row.targetId || null))) {
      grants.push({
        scope: value,
        targetType: row.targetType,
        targetId: row.targetId || null,
      });
    }
    scopeGrants[row.resourceKey] = grants;
  }
  for (const row of overrides.filter((override) => override.effect === 'allow')) {
    const resourceKey = row.resourceKey || '*';
    const value = row.scope as DataScope;
    const current = scopes[resourceKey];
    if (!current || SCOPE_RANK[value] > SCOPE_RANK[current]) scopes[resourceKey] = value;
    const grants = scopeGrants[resourceKey] ?? [];
    if (!grants.some((grant) =>
      grant.scope === value
      && grant.targetType === row.targetType
      && grant.targetId === (row.targetId || null))) {
      grants.push({
        scope: value,
        targetType: row.targetType,
        targetId: row.targetId || null,
      });
    }
    scopeGrants[resourceKey] = grants;
  }
  return {
    permissions: visiblePermissions,
    scopes,
    scopeGrants,
  };
}

interface ScopeGrantRow {
  resourceKey: string;
  scope: string;
  targetType: string;
  targetId: string;
}

export function scopeForResource(
  capabilities: EffectiveCapability,
  resource: string,
): DataScope | null {
  const candidates = [resource, `${resource.split('/')[0]}/*`, '*'];
  for (const candidate of candidates) {
    if (capabilities.scopes[candidate]) return capabilities.scopes[candidate];
  }
  return null;
}

export function scopeGrantsForResource(
  capabilities: EffectiveCapability,
  resource: string,
): ScopeGrant[] {
  const candidates = [resource, `${resource.split('/')[0]}/*`, '*'];
  for (const candidate of candidates) {
    if (capabilities.scopeGrants[candidate]) return capabilities.scopeGrants[candidate];
    if (capabilities.scopes[candidate]) {
      return [{ scope: capabilities.scopes[candidate], targetType: 'none', targetId: null }];
    }
  }
  return [];
}

/**
 * True only if the session's role for its *current* company assignment is
 * Superadmin (same tenant-bounded lookup hasPermission uses, never a
 * cross-master bypass). Used by capabilities and administrative workflows
 * that need to distinguish the tenant's superadmin from ordinary role grants.
 */
export async function isSuperadminSession(
  db: DB,
  session: SessionData,
  now = new Date(),
): Promise<boolean> {
  const [assignment] = await db.select({
    roleMasterFn: role.masterFn,
    companyMasterFn: company.masterFn,
    isSuperadmin: role.isSuperadmin,
  }).from(userCompanyRole)
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .innerJoin(company, eq(company.companyFn, userCompanyRole.companyFn))
    .where(and(
      eq(userCompanyRole.userId, session.userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
      eq(role.masterFn, session.masterFn),
      or(eq(role.companyFn, session.activeCompanyFn), isNull(role.companyFn)),
      eq(company.masterFn, session.masterFn),
      eq(role.isSuperadmin, true),
      activeRoleAssignmentCondition(now),
    ))
    .limit(1);
  if (!assignment) return false;
  if (
    assignment.roleMasterFn !== session.masterFn
    || assignment.companyMasterFn !== session.masterFn
  ) return false;
  return assignment.isSuperadmin;
}
