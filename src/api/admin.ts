// Admin read-model builder: plain functions, no ResourceDefinition (mirrors
// dashboard.ts's shape). app_user/role/role_permission/audit_log are deliberately
// excluded from the generic resource() framework -- see deploy/sql/production-rls.sql
// and src/api/routes/admin.ts's header comment for why.
import {
  and, desc, eq, gt, isNull,
} from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appSession, appUser, auditLog, role, rolePermission, userCompany, userCompanyRole,
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
    ))
    .orderBy(appUser.userId);
  const userRoleRows = await db.select({
    userId: userCompanyRole.userId,
    roleId: role.roleId,
    roleName: role.name,
  }).from(userCompanyRole)
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .where(and(
      eq(userCompanyRole.companyFn, companyFn),
      eq(role.masterFn, masterFn),
    ))
    .orderBy(userCompanyRole.userId, role.roleId);
  const rolesByUser = new Map<number, Array<{ roleId: number; roleName: string }>>();
  for (const row of userRoleRows) {
    const grants = rolesByUser.get(row.userId) ?? [];
    grants.push({ roleId: row.roleId, roleName: row.roleName });
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

export async function listRoles(db: DB, masterFn: string) {
  return db.select({
    roleId: role.roleId,
    name: role.name,
    isSuperadmin: role.isSuperadmin,
  }).from(role).where(eq(role.masterFn, masterFn)).orderBy(role.roleId);
}

export async function listRolePermissions(db: DB, masterFn: string) {
  return db.select({
    roleId: rolePermission.roleId,
    permissionKey: rolePermission.permissionKey,
    allowed: rolePermission.allowed,
  }).from(rolePermission).where(eq(rolePermission.masterFn, masterFn));
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
    actorName: appUser.fullName,
    actorEmail: appUser.email,
    entity: auditLog.entity,
    entityId: auditLog.entityId,
    action: auditLog.action,
    occurredAt: auditLog.occurredAt,
  }).from(auditLog)
    .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
    .where(and(
      eq(auditLog.masterFn, masterFn),
      eq(auditLog.companyFn, companyFn),
      gt(auditLog.id, cursor),
    ))
    .orderBy(auditLog.id)
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
  };
}
