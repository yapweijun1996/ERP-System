import { PERMISSIONS } from './permissionKeys';
import {
  PERMISSION_ACTIONS,
  PERMISSION_CATALOG,
  canonicalPermissionForAction,
} from './permissionRegistry';

export { ACTION_PERMISSION_KEYS, PERMISSION_CATALOG } from './permissionRegistry';

export type DataScope = 'self' | 'team' | 'department' | 'company';
export const COMPANY_OWNER_ROLE_TEMPLATE_KEY = 'company_owner' as const;
export const MASTER_ADMIN_ROLE_TEMPLATE_KEY = 'master_admin' as const;

/**
 * Company Owner is a tenant administrator, not a business-approval bypass.
 * Keep the default bundle broad enough for one-person onboarding, while
 * requiring an explicit approval/payment/payroll grant for sensitive actions.
 */
const COMPANY_OWNER_RESTRICTED_PERMISSION_KEYS = new Set([
  ...PERMISSION_CATALOG.filter((permissionKey) =>
    permissionKey.endsWith('.approve')
      || permissionKey.endsWith('.pay')
      || permissionKey.startsWith('payroll.')),
  PERMISSIONS.salesApprove,
  PERMISSIONS.salesCommissionApprove,
  PERMISSIONS.purchasingApprove,
  PERMISSIONS.expensesManagerApprove,
  PERMISSIONS.expensesFinanceApprove,
  PERMISSIONS.expensesBudgetApprove,
  PERMISSIONS.expensesFinanceVerify,
  PERMISSIONS.expensesPayoutVerify,
  PERMISSIONS.expensesPayoutReveal,
  PERMISSIONS.expensesPaymentBatchRelease,
  PERMISSIONS.expensesPaymentResultImport,
  PERMISSIONS.employeePayoutManage,
  PERMISSIONS.payrollRead,
  PERMISSIONS.payrollWrite,
  PERMISSIONS.expensesTaxEvidenceAccess,
  PERMISSIONS.expensesTaxEvidenceGovernance,
  PERMISSIONS.expensesCompanyReceiptsReadOwn,
]);

export const COMPANY_OWNER_PERMISSION_KEYS = Object.freeze(
  PERMISSION_CATALOG.filter((permissionKey) =>
    !COMPANY_OWNER_RESTRICTED_PERMISSION_KEYS.has(permissionKey)),
);

/** Master Admin manages tenant configuration and identities across the
 * Master, but never receives business-module, workflow, payment, payroll or
 * commercial entitlement authority. Its effective scope remains the active
 * Company membership supplied by provisioning. */
export const MASTER_ADMIN_PERMISSION_KEYS = Object.freeze([
  PERMISSIONS.dashboardRead,
  PERMISSIONS.companySwitch,
  PERMISSIONS.usersInvite,
  PERMISSIONS.usersRead,
  PERMISSIONS.usersManage,
  PERMISSIONS.rolesRead,
  PERMISSIONS.rolesWrite,
  PERMISSIONS.auditRead,
  PERMISSIONS.settingsRead,
  PERMISSIONS.settingsManage,
]);

export type RoleTemplateKey =
  | 'superadmin' | 'company_owner' | 'master_admin' | 'company_admin' | 'manager' | 'sales' | 'buyer'
  | 'warehouse' | 'production' | 'finance_preparer' | 'finance_checker'
  | 'hr' | 'service' | 'viewer';

export interface RoleTemplate {
  key: RoleTemplateKey;
  name: string;
  isSuperadmin?: boolean;
  immutable?: boolean;
  deprecated?: boolean;
  permissions: readonly string[];
  scopes: Readonly<Record<string, DataScope>>;
}

const read = (...modules: string[]) => modules.map((moduleKey) => `${moduleKey}.read`);
const actions = (moduleKey: string, ...names: typeof PERMISSION_ACTIONS[number][]) =>
  names.map((name) => `${moduleKey}.${name}`);
const companyScopes = (...resources: string[]) =>
  Object.fromEntries(resources.map((resource) => [resource, 'company' as const]));

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: 'superadmin', name: 'Superadmin', isSuperadmin: true, immutable: true, deprecated: true,
    permissions: PERMISSION_CATALOG,
    scopes: companyScopes('*'),
  },
  {
    key: COMPANY_OWNER_ROLE_TEMPLATE_KEY, name: 'Company Owner', immutable: true,
    permissions: COMPANY_OWNER_PERMISSION_KEYS,
    scopes: companyScopes('*'),
  },
  {
    key: MASTER_ADMIN_ROLE_TEMPLATE_KEY, name: 'Master Admin', immutable: true,
    permissions: MASTER_ADMIN_PERMISSION_KEYS,
    scopes: companyScopes('admin/*', 'settings/*'),
  },
  {
    key: 'company_admin', name: 'Company Admin',
    permissions: [
      PERMISSIONS.dashboardRead, PERMISSIONS.usersInvite, PERMISSIONS.usersRead,
      PERMISSIONS.usersManage, PERMISSIONS.rolesRead, PERMISSIONS.rolesWrite,
      PERMISSIONS.auditRead, PERMISSIONS.settingsRead,
      PERMISSIONS.settingsManage, PERMISSIONS.companySwitch,
      PERMISSIONS.hrRead, PERMISSIONS.hrWrite,
    ],
    scopes: companyScopes('admin/*', 'hr/*'),
  },
  {
    key: 'manager', name: 'Manager',
    permissions: [
      PERMISSIONS.dashboardRead, PERMISSIONS.employeeSelfRead, PERMISSIONS.employeeTeamRead,
      PERMISSIONS.employeeLeaveWrite, PERMISSIONS.employeeReceiptsWrite,
      PERMISSIONS.expensesCompanyReceiptsReadOwn,
      PERMISSIONS.expensesCompanyReceiptsCreate, PERMISSIONS.expensesCompanyReceiptsEdit,
      PERMISSIONS.expensesCompanyReceiptsVoid,
      PERMISSIONS.employeeClaimsWrite, PERMISSIONS.expensesManagerApprove,
      ...read('sales', 'crm', 'inventory', 'project', 'service'),
      ...actions('sales', 'approve'), ...actions('purchasing', 'approve'),
      ...actions('project', 'approve'),
    ],
    // Generic module collections contain many reference/master-data rows that
    // do not have an owner column. A team scope therefore makes an otherwise
    // authorized manager request fail closed with data_scope_unavailable.
    // Keep the manager boundary on actor-derived My Work routes, while making
    // the explicitly granted read-only module lists usable at company scope.
    scopes: companyScopes(
      'sales/*', 'crm/*', 'inventory/*', 'warehouse/*', 'project/*', 'service/*',
    ),
  },
  {
    key: 'sales', name: 'Sales',
    permissions: [PERMISSIONS.dashboardRead, ...read('sales', 'crm'),
      PERMISSIONS.salesWrite, PERMISSIONS.crmWrite,
      ...actions('sales', 'create', 'edit', 'export'),
      ...actions('crm', 'create', 'edit', 'export')],
    scopes: { 'sales/*': 'self', 'crm/*': 'self' },
  },
  {
    key: 'buyer', name: 'Buyer',
    permissions: [PERMISSIONS.dashboardRead, ...read('purchasing', 'inventory'),
      PERMISSIONS.purchasingWrite,
      ...actions('purchasing', 'create', 'edit', 'export')],
    scopes: companyScopes('purchasing/*', 'inventory/*'),
  },
  {
    key: 'warehouse', name: 'Warehouse',
    permissions: [PERMISSIONS.dashboardRead, ...read('inventory', 'warehouse'),
      PERMISSIONS.inventoryWrite, PERMISSIONS.inventoryAdjust, PERMISSIONS.inventoryTransfer,
      PERMISSIONS.inventoryTrack, ...actions('inventory', 'create', 'edit', 'post'),
      ...actions('warehouse', 'create', 'edit', 'post')],
    scopes: companyScopes('inventory/*', 'warehouse/*'),
  },
  {
    key: 'production', name: 'Production',
    permissions: [PERMISSIONS.dashboardRead, ...read('manufacturing', 'inventory', 'warehouse', 'quality'),
      PERMISSIONS.manufacturingWrite, PERMISSIONS.qualityWrite,
      ...actions('manufacturing', 'create', 'edit', 'post'),
      ...actions('quality', 'create', 'edit', 'post')],
    scopes: companyScopes('manufacturing/*', 'inventory/*', 'warehouse/*', 'quality/*'),
  },
  {
    key: 'finance_preparer', name: 'Finance Preparer',
    permissions: [PERMISSIONS.dashboardRead, ...read('finance'), PERMISSIONS.financeWrite,
      PERMISSIONS.expensesFinanceVerify, PERMISSIONS.expensesPaymentBatchPrepare,
      PERMISSIONS.expensesPaymentExport, PERMISSIONS.financeReportExport,
      PERMISSIONS.expensesCompanyReceiptsReadCompany,
      ...actions('finance', 'create', 'edit', 'post', 'export')],
    scopes: companyScopes('finance/*', 'expenses/*'),
  },
  {
    key: 'finance_checker', name: 'Finance Checker',
    permissions: [PERMISSIONS.dashboardRead, ...read('finance'),
      PERMISSIONS.expensesFinanceApprove, PERMISSIONS.expensesPaymentBatchRelease,
      PERMISSIONS.expensesPaymentResultImport, PERMISSIONS.expensesTaxEvidenceAccess,
      PERMISSIONS.expensesCompanyReceiptsReadCompany,
      PERMISSIONS.financeBudgetApprove, ...actions('finance', 'approve', 'pay', 'export')],
    scopes: companyScopes('finance/*', 'expenses/*'),
  },
  {
    key: 'hr', name: 'HR',
    permissions: [PERMISSIONS.dashboardRead, ...read('hr', 'payroll'),
      PERMISSIONS.hrWrite, PERMISSIONS.payrollWrite, PERMISSIONS.usersRead,
      PERMISSIONS.rolesRead,
      ...actions('hr', 'create', 'edit', 'approve', 'export'),
      ...actions('payroll', 'create', 'edit', 'post', 'export')],
    scopes: companyScopes('hr/*', 'payroll/*'),
  },
  {
    key: 'service', name: 'Service',
    permissions: [PERMISSIONS.dashboardRead, ...read('service', 'crm'),
      PERMISSIONS.serviceWrite, ...actions('service', 'create', 'edit', 'post')],
    scopes: { 'service/*': 'self', 'crm/*': 'self' },
  },
  {
    key: 'viewer', name: 'Viewer',
    permissions: [PERMISSIONS.dashboardRead, ...read(
      'sales', 'purchasing', 'crm', 'inventory', 'manufacturing', 'quality',
      'finance', 'hr', 'project', 'service', 'asset', 'reporting', 'integration',
    )],
    scopes: companyScopes('*'),
  },
] as const;

export function roleTemplate(key: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find((template) => template.key === key);
}

export function isCompanyOwnerRole(sourceTemplateKey: string | null | undefined): boolean {
  return sourceTemplateKey === COMPANY_OWNER_ROLE_TEMPLATE_KEY;
}

export function isMasterAdminRole(sourceTemplateKey: string | null | undefined): boolean {
  return sourceTemplateKey === MASTER_ADMIN_ROLE_TEMPLATE_KEY;
}

export function isSystemManagedTenantRole(sourceTemplateKey: string | null | undefined): boolean {
  return isCompanyOwnerRole(sourceTemplateKey) || isMasterAdminRole(sourceTemplateKey);
}

export function fineGrainedActionPermission(
  resource: string,
  action: string,
  compatibilityCode?: string,
): string {
  return canonicalPermissionForAction(resource, action, compatibilityCode);
}
