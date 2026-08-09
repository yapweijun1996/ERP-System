import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  company, role, rolePermission, roleResourceScope, userCompanyRole,
} from '../data/schema';
import type { SessionData } from './session';
import type { DataScope } from './accessCatalog';
import { PERMISSIONS } from './permissionKeys';
import { permissionCandidates, permissionDefinition } from './permissionRegistry';

export { PERMISSIONS } from './permissionKeys';

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | (string & {});

export async function hasPermission(
  db: DB,
  session: SessionData,
  permissionKey: PermissionKey,
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
}

export async function effectiveCapabilities(
  db: DB,
  session: SessionData,
): Promise<EffectiveCapability> {
  if (await isSuperadminSession(db, session)) {
    return { permissions: ['*'], scopes: { '*': 'company' } };
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
    ));
  const scopeRows = await db.select({
    resourceKey: roleResourceScope.resourceKey,
    scope: roleResourceScope.scope,
  }).from(userCompanyRole)
    .innerJoin(roleResourceScope, and(
      eq(roleResourceScope.roleId, userCompanyRole.roleId),
      eq(roleResourceScope.masterFn, session.masterFn),
      eq(roleResourceScope.companyFn, session.activeCompanyFn),
    ))
    .where(and(
      eq(userCompanyRole.userId, session.userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
    ));
  const scopes: Record<string, DataScope> = {};
  for (const row of scopeRows) {
    const value = row.scope as DataScope;
    const current = scopes[row.resourceKey];
    if (!current || SCOPE_RANK[value] > SCOPE_RANK[current]) scopes[row.resourceKey] = value;
  }
  return {
    permissions: [...new Set(permissions.map((row) => row.permissionKey))].sort(),
    scopes,
  };
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

/**
 * True only if the session's role for its *current* company assignment is
 * Superadmin (same tenant-bounded lookup hasPermission uses, never a
 * cross-master bypass). Used by capabilities and administrative workflows
 * that need to distinguish the tenant's superadmin from ordinary role grants.
 */
export async function isSuperadminSession(db: DB, session: SessionData): Promise<boolean> {
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
    ))
    .limit(1);
  if (!assignment) return false;
  if (
    assignment.roleMasterFn !== session.masterFn
    || assignment.companyMasterFn !== session.masterFn
  ) return false;
  return assignment.isSuperadmin;
}
