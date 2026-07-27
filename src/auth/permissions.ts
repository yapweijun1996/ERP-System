import { and, eq, isNull, or } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  company, role, rolePermission, roleResourceScope, userCompanyRole,
} from '../data/schema';
import type { SessionData } from './session';
import type { DataScope } from './accessCatalog';

export const PERMISSIONS = {
  dashboardRead: 'dashboard.read',
  inventoryRead: 'inventory.read',
  inventoryWrite: 'inventory.write',
  inventoryAdjust: 'inventory.adjust',
  inventoryTransfer: 'inventory.transfer',
  inventoryTrack: 'inventory.track',
  salesRead: 'sales.read',
  salesWrite: 'sales.write',
  salesCommissionApprove: 'sales.commission.approve',
  financeRead: 'finance.read',
  financeWrite: 'finance.write',
  financeBudgetManage: 'finance.budget.manage',
  financeBudgetApprove: 'finance.budget.approve',
  financeReportExport: 'finance.report.export',
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
  employeeSelfRead: 'employee.self.read',
  employeeLeaveWrite: 'employee.leave.write',
  employeeReceiptsWrite: 'employee.receipts.write',
  employeeClaimsWrite: 'employee.claims.write',
  employeePayoutManage: 'employee.payout.manage',
  documentsGovernanceManage: 'documents.governance.manage',
  documentsRecordsManage: 'documents.records.manage',
  documentsFinanceReview: 'documents.finance.review',
  expensesPolicyManage: 'expenses.policy.manage',
  expensesFinanceVerify: 'expenses.finance.verify',
  expensesManagerApprove: 'expenses.approve.manager',
  expensesFinanceApprove: 'expenses.approve.finance',
  expensesBudgetApprove: 'expenses.approve.budget',
  expensesDuplicateOverride: 'expenses.duplicate.override',
  expensesCardManage: 'expenses.card.manage',
  expensesAllowanceManage: 'expenses.allowance.manage',
  expensesAdvanceManage: 'expenses.advance.manage',
  expensesPayoutVerify: 'expenses.payout.verify',
  expensesPayoutReveal: 'expenses.payout.reveal',
  expensesPaymentBatchPrepare: 'expenses.payment.prepare',
  expensesPaymentBatchRelease: 'expenses.payment.release',
  expensesPaymentTemplateManage: 'expenses.payment.template.manage',
  expensesPaymentExport: 'expenses.payment.export',
  expensesPaymentResultImport: 'expenses.payment.result.import',
  expensesPaymentArtifactDownload: 'expenses.payment.artifact.download',
  expensesTaxEvidenceGenerate: 'expenses.tax_evidence.generate',
  expensesTaxEvidenceAccess: 'expenses.tax_evidence.access',
  expensesTaxEvidenceGovernance: 'expenses.tax_evidence.governance',
  employeeTeamRead: 'employee.team.read',
  projectRead: 'project.read',
  projectWrite: 'project.write',
  serviceRead: 'service.read',
  serviceWrite: 'service.write',
  reportingRead: 'reporting.read',
  integrationRead: 'integration.read',
  integrationImport: 'integration.import',
  integrationManage: 'integration.manage',
  notificationsRead: 'notifications.read',
  notificationsManage: 'notifications.manage',
  payrollRead: 'payroll.read',
  payrollWrite: 'payroll.write',
  companySwitch: 'session.switch_company',
  auditRead: 'admin.audit.read',
  usersInvite: 'admin.users.invite',
  usersRead: 'admin.users.read',
  usersManage: 'admin.users.manage',
  rolesRead: 'admin.roles.read',
  rolesWrite: 'admin.roles.write',
  modulesManage: 'admin.modules.manage',
  masterControlRead: 'admin.master.read',
  settingsRead: 'settings.read',
  settingsManage: 'settings.manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | (string & {});

export async function hasPermission(
  db: DB,
  session: SessionData,
  permissionKey: PermissionKey,
): Promise<boolean> {
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
      eq(rolePermission.permissionKey, permissionKey),
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
