import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  company, role, rolePermission, roleResourceScope, userCompanyRole, userCompanyRoleScope,
} from '../data/schema';
import type { SessionData } from './session';
import type { DataScope } from './accessCatalog';
import { PERMISSIONS } from './permissionKeys';
import { permissionCandidates, permissionDefinition } from './permissionRegistry';
import { activeRoleAssignmentCondition } from './roleAssignmentState';

export { PERMISSIONS } from './permissionKeys';

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | (string & {});

export async function hasPermission(
  db: DB,
  session: SessionData,
  permissionKey: PermissionKey,
  now = new Date(),
): Promise<boolean> {
  // Platform grants are evaluated only by the platform support boundary. A
  // tenant Superadmin must never turn a platform-domain key into tenant access.
  if (permissionDefinition(permissionKey)?.domain === 'platform') return false;
  const [superadminGrant] = await db.select({
    roleId: role.roleId,
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
  // Superadmin bypass is deliberately bounded to the current master/company
  // role grant above; it is never a cross-master bypass.
  if (superadminGrant) return true;

  const candidates = permissionCandidates(permissionKey);
  if (!candidates.length) return false;
  const [grant] = await db.select({ allowed: rolePermission.allowed })
    .from(userCompanyRole)
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .innerJoin(company, eq(company.companyFn, userCompanyRole.companyFn))
    .innerJoin(rolePermission, and(
      eq(rolePermission.roleId, userCompanyRole.roleId),
      eq(rolePermission.masterFn, session.masterFn),
    ))
    .where(and(
      eq(userCompanyRole.userId, session.userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
      eq(role.masterFn, session.masterFn),
      or(eq(role.companyFn, session.activeCompanyFn), isNull(role.companyFn)),
      eq(company.masterFn, session.masterFn),
      activeRoleAssignmentCondition(now),
      // Compatibility aliases are resolved by the application-owned registry;
      // role_permission never accepts arbitrary tenant-created permission codes.
      inArray(rolePermission.permissionKey, candidates),
      eq(rolePermission.allowed, true),
    ))
    .limit(1);
  return grant?.allowed === true;
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
  if (await isSuperadminSession(db, session, now)) {
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
  const scopes: Record<string, DataScope> = {};
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
  return {
    permissions: [...new Set(permissions.map((row) => row.permissionKey))].sort(),
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
