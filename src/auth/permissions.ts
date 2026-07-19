import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { company, role, rolePermission, userCompany } from '../data/schema';
import type { SessionData } from './session';

export const PERMISSIONS = {
  dashboardRead: 'dashboard.read',
  inventoryRead: 'inventory.read',
  inventoryWrite: 'inventory.write',
  inventoryAdjust: 'inventory.adjust',
  inventoryTransfer: 'inventory.transfer',
  inventoryTrack: 'inventory.track',
  salesRead: 'sales.read',
  salesWrite: 'sales.write',
  financeRead: 'finance.read',
  purchasingRead: 'purchasing.read',
  purchasingWrite: 'purchasing.write',
  crmRead: 'crm.read',
  crmWrite: 'crm.write',
  manufacturingRead: 'manufacturing.read',
  manufacturingWrite: 'manufacturing.write',
  qualityRead: 'quality.read',
  qualityWrite: 'quality.write',
  assetRead: 'asset.read',
  assetWrite: 'asset.write',
  hrRead: 'hr.read',
  hrWrite: 'hr.write',
  projectRead: 'project.read',
  projectWrite: 'project.write',
  companySwitch: 'session.switch_company',
  auditRead: 'admin.audit.read',
  usersInvite: 'admin.users.invite',
  usersRead: 'admin.users.read',
  usersManage: 'admin.users.manage',
  rolesRead: 'admin.roles.read',
  rolesWrite: 'admin.roles.write',
  modulesManage: 'admin.modules.manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | (string & {});

export async function hasPermission(
  db: DB,
  session: SessionData,
  permissionKey: PermissionKey,
): Promise<boolean> {
  const [assignment] = await db.select({
    roleId: role.roleId,
    roleMasterFn: role.masterFn,
    companyMasterFn: company.masterFn,
    isSuperadmin: role.isSuperadmin,
  }).from(userCompany)
    .innerJoin(role, eq(role.roleId, userCompany.roleId))
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(userCompany.userId, session.userId),
      eq(userCompany.companyFn, session.activeCompanyFn),
    ))
    .limit(1);

  if (!assignment) return false;
  if (
    assignment.roleMasterFn !== session.masterFn
    || assignment.companyMasterFn !== session.masterFn
  ) return false;
  // Superadmin bypass is deliberately bounded to the current master/company
  // assignment above; it is never a cross-master bypass.
  if (assignment.isSuperadmin) return true;

  const [grant] = await db.select({ allowed: rolePermission.allowed })
    .from(rolePermission)
    .where(and(
      eq(rolePermission.masterFn, session.masterFn),
      eq(rolePermission.roleId, assignment.roleId),
      eq(rolePermission.permissionKey, permissionKey),
      eq(rolePermission.allowed, true),
    ))
    .limit(1);
  return grant?.allowed === true;
}

/**
 * True only if the session's role for its *current* company assignment is
 * Superadmin (same tenant-bounded lookup hasPermission uses, never a
 * cross-master bypass). Used to exempt superadmins from tenant-level
 * restrictions that are meant to apply to a master's *other* users -- e.g.
 * module-access-control (EPIC-018): a superadmin can disable a module for
 * their organization's regular users without losing their own ability to
 * view/manage it.
 */
export async function isSuperadminSession(db: DB, session: SessionData): Promise<boolean> {
  const [assignment] = await db.select({
    roleMasterFn: role.masterFn,
    companyMasterFn: company.masterFn,
    isSuperadmin: role.isSuperadmin,
  }).from(userCompany)
    .innerJoin(role, eq(role.roleId, userCompany.roleId))
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(userCompany.userId, session.userId),
      eq(userCompany.companyFn, session.activeCompanyFn),
    ))
    .limit(1);
  if (!assignment) return false;
  if (
    assignment.roleMasterFn !== session.masterFn
    || assignment.companyMasterFn !== session.masterFn
  ) return false;
  return assignment.isSuperadmin;
}
