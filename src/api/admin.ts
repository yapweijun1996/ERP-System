// Admin read-model builder: plain functions, no ResourceDefinition (mirrors
// dashboard.ts's shape). app_user/role/role_permission/audit_log are deliberately
// excluded from the generic resource() framework -- see deploy/sql/production-rls.sql
// and src/api/routes/admin.ts's header comment for why.
import {
  and, desc, eq, gt, isNull, ne, or,
} from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appSession, appUser, auditLog, platformPrincipal, role, rolePermission, roleResourceScope, userCompany, userCompanyRole,
  userInvitation,
} from '../data/schema';

export async function listCompanyUsers(db: DB, masterFn: string, companyFn: string) {
  const users = await db.select({
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    fullName: appUser.fullName,
    isActive: appUser.isActive,
  }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(
      eq(userCompany.companyFn, companyFn),
      eq(appUser.masterFn, masterFn),
      eq(appUser.identityKind, 'human'),
    ))
    .orderBy(appUser.userId);
  const userRoleRows = await db.select({
    assignmentId: userCompanyRole.assignmentId,
    userId: userCompanyRole.userId,
    roleId: role.roleId,
    roleName: role.name,
    managedBySystem: userCompanyRole.managedBySystem,
    validFrom: userCompanyRole.validFrom,
    validUntil: userCompanyRole.validUntil,
    revokedAt: userCompanyRole.revokedAt,
    assignmentSource: userCompanyRole.assignmentSource,
    scopeBackfilledAt: userCompanyRole.scopeBackfilledAt,
  }).from(userCompanyRole)
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .where(and(
      eq(userCompanyRole.companyFn, companyFn),
      eq(role.masterFn, masterFn),
    ))
    .orderBy(userCompanyRole.userId, role.roleId);
  const rolesByUser = new Map<number, Array<{
    assignmentId: number;
    roleId: number;
    roleName: string;
    managedBySystem: boolean;
    validFrom: Date;
    validUntil: Date | null;
    revokedAt: Date | null;
    assignmentSource: string;
    scopeBackfilledAt: Date | null;
  }>>();
  for (const row of userRoleRows) {
    const grants = rolesByUser.get(row.userId) ?? [];
    grants.push({
      assignmentId: row.assignmentId,
      roleId: row.roleId,
      roleName: row.roleName,
      managedBySystem: row.managedBySystem,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      revokedAt: row.revokedAt,
      assignmentSource: row.assignmentSource,
      scopeBackfilledAt: row.scopeBackfilledAt,
    });
    rolesByUser.set(row.userId, grants);
  }

  const lastSeenRows = users.length ? await db.select({
    userId: appSession.userId,
    lastSeenAt: appSession.lastSeenAt,
  }).from(appSession)
    .where(and(
      eq(appSession.masterFn, masterFn),
      isNull(appSession.revokedAt),
    ))
    .orderBy(desc(appSession.lastSeenAt)) : [];
  const lastSeenByUser = new Map<number, Date>();
  for (const row of lastSeenRows) {
    if (!lastSeenByUser.has(row.userId)) lastSeenByUser.set(row.userId, row.lastSeenAt);
  }

  const invitations = await db.select({
    id: userInvitation.id,
    email: userInvitation.email,
    roleId: userInvitation.roleId,
    roleName: role.name,
    expiresAt: userInvitation.expiresAt,
  }).from(userInvitation)
    .innerJoin(role, eq(role.roleId, userInvitation.roleId))
    .where(and(
      eq(userInvitation.masterFn, masterFn),
      eq(userInvitation.companyFn, companyFn),
      isNull(userInvitation.acceptedAt),
      gt(userInvitation.expiresAt, new Date()),
    ))
    .orderBy(userInvitation.id);

  return {
    users: users.map((u) => {
      const grants = rolesByUser.get(u.userId) ?? [];
      return {
        kind: 'user' as const,
        id: u.userId,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        roleId: grants[0]?.roleId ?? null,
        roleName: grants.map((grant) => grant.roleName).join(', '),
        roles: grants,
        status: u.isActive ? 'Active' as const : 'Disabled' as const,
        lastActiveAt: lastSeenByUser.get(u.userId) ?? null,
      };
    }),
    invitations: invitations.map((i) => ({
      kind: 'invitation' as const,
      id: i.id,
      email: i.email,
      roleId: i.roleId,
      roleName: i.roleName,
      status: 'Invited' as const,
      expiresAt: i.expiresAt,
    })),
  };
}

export async function listRoles(db: DB, masterFn: string, companyFn: string) {
  return db.select({
    roleId: role.roleId,
    name: role.name,
    isSuperadmin: role.isSuperadmin,
    sourceTemplateKey: role.sourceTemplateKey,
  }).from(role).where(and(
    eq(role.masterFn, masterFn),
    eq(role.companyFn, companyFn),
    or(isNull(role.sourceTemplateKey), ne(role.sourceTemplateKey, 'platform_tenant_admin')),
  )).orderBy(role.roleId);
}

export async function listRolePermissions(db: DB, masterFn: string, companyFn: string) {
  return db.select({
    roleId: rolePermission.roleId,
    permissionKey: rolePermission.permissionKey,
    allowed: rolePermission.allowed,
  }).from(rolePermission)
    .innerJoin(role, eq(role.roleId, rolePermission.roleId))
    .where(and(
      eq(rolePermission.masterFn, masterFn),
      eq(role.companyFn, companyFn),
      or(isNull(role.sourceTemplateKey), ne(role.sourceTemplateKey, 'platform_tenant_admin')),
    ));
}

export async function listRoleScopes(db: DB, masterFn: string, companyFn: string) {
  return db.select({
    roleId: roleResourceScope.roleId,
    resourceKey: roleResourceScope.resourceKey,
    scope: roleResourceScope.scope,
  }).from(roleResourceScope)
    .innerJoin(role, eq(role.roleId, roleResourceScope.roleId))
    .where(and(
      eq(roleResourceScope.masterFn, masterFn),
      eq(roleResourceScope.companyFn, companyFn),
      eq(role.companyFn, companyFn),
      or(isNull(role.sourceTemplateKey), ne(role.sourceTemplateKey, 'platform_tenant_admin')),
    ));
}

export async function listAuditLog(
  db: DB,
  masterFn: string,
  companyFn: string,
  query: { limit?: number; cursor?: number } = {},
) {
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const cursor = query.cursor ?? 0;
  const rows = await db.select({
    id: auditLog.id,
    actorUserId: auditLog.actorUserId,
    platformPrincipalId: auditLog.platformPrincipalId,
    actorName: appUser.fullName,
    actorEmail: appUser.email,
    platformPrincipalKey: platformPrincipal.principalKey,
    platformDisplayName: platformPrincipal.displayName,
    entity: auditLog.entity,
    entityId: auditLog.entityId,
    action: auditLog.action,
    occurredAt: auditLog.occurredAt,
  }).from(auditLog)
    .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
    .leftJoin(platformPrincipal, eq(platformPrincipal.principalId, auditLog.platformPrincipalId))
    .where(and(
      eq(auditLog.masterFn, masterFn),
      eq(auditLog.companyFn, companyFn),
      gt(auditLog.id, cursor),
    ))
    .orderBy(auditLog.id)
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
    ...row,
    actorType: row.platformPrincipalId != null ? 'platform_superadmin' as const : 'tenant_user' as const,
    actorDisplay: row.platformPrincipalId != null
      ? `Platform Admin · P-${row.platformPrincipalId}`
      : row.actorName,
  }));
  return {
    data,
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
  };
}
