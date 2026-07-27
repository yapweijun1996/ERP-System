import { PERMISSIONS } from './permissions';

export type DataScope = 'self' | 'team' | 'department' | 'company';
export type RoleTemplateKey =
  | 'superadmin' | 'company_admin' | 'manager' | 'sales' | 'buyer'
  | 'warehouse' | 'production' | 'finance_preparer' | 'finance_checker'
  | 'hr' | 'service' | 'viewer';

const ACTION_MODULES = [
  'sales', 'purchasing', 'crm', 'inventory', 'warehouse', 'manufacturing',
  'quality', 'finance', 'hr', 'payroll', 'project', 'service', 'asset',
] as const;
const ACTIONS = ['create', 'edit', 'approve', 'post', 'pay', 'export'] as const;

export const ACTION_PERMISSION_KEYS = ACTION_MODULES.flatMap((moduleKey) =>
  ACTIONS.map((action) => `${moduleKey}.${action}`));
export const PERMISSION_CATALOG = [
  ...Object.values(PERMISSIONS),
  ...ACTION_PERMISSION_KEYS,
] as const;

export interface RoleTemplate {
  key: RoleTemplateKey;
  name: string;
  isSuperadmin?: boolean;
  permissions: readonly string[];
  scopes: Readonly<Record<string, DataScope>>;
}

const read = (...modules: string[]) => modules.map((moduleKey) => `${moduleKey}.read`);
const actions = (moduleKey: string, ...names: typeof ACTIONS[number][]) =>
  names.map((name) => `${moduleKey}.${name}`);
const companyScopes = (...resources: string[]) =>
  Object.fromEntries(resources.map((resource) => [resource, 'company' as const]));

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: 'superadmin', name: 'Superadmin', isSuperadmin: true,
    permissions: PERMISSION_CATALOG,
    scopes: companyScopes('*'),
  },
  {
    key: 'company_admin', name: 'Company Admin',
    permissions: [
      PERMISSIONS.dashboardRead, PERMISSIONS.usersInvite, PERMISSIONS.usersRead,
      PERMISSIONS.usersManage, PERMISSIONS.rolesRead, PERMISSIONS.rolesWrite,
      PERMISSIONS.modulesManage, PERMISSIONS.auditRead, PERMISSIONS.settingsRead,
      PERMISSIONS.settingsManage, PERMISSIONS.companySwitch,
      PERMISSIONS.hrRead, PERMISSIONS.hrWrite,
    ],
    scopes: companyScopes('admin/*'),
  },
  {
    key: 'manager', name: 'Manager',
    permissions: [
      PERMISSIONS.dashboardRead, PERMISSIONS.employeeSelfRead, PERMISSIONS.employeeTeamRead,
      PERMISSIONS.employeeLeaveWrite, PERMISSIONS.employeeReceiptsWrite,
      PERMISSIONS.employeeClaimsWrite, PERMISSIONS.expensesManagerApprove,
      ...read('sales', 'crm', 'inventory', 'project', 'service'),
      ...actions('sales', 'approve'), ...actions('project', 'approve'),
    ],
    scopes: { '*': 'team' },
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
      ...actions('finance', 'create', 'edit', 'post', 'export')],
    scopes: companyScopes('finance/*', 'expenses/*'),
  },
  {
    key: 'finance_checker', name: 'Finance Checker',
    permissions: [PERMISSIONS.dashboardRead, ...read('finance'),
      PERMISSIONS.expensesFinanceApprove, PERMISSIONS.expensesPaymentBatchRelease,
      PERMISSIONS.expensesPaymentResultImport, PERMISSIONS.expensesTaxEvidenceAccess,
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

export function fineGrainedActionPermission(resource: string, action: string): string {
  const moduleKey = resource.split('/')[0] === 'assets' ? 'asset' : resource.split('/')[0];
  if (/approve|reject|decide/.test(action)) return `${moduleKey}.approve`;
  if (/export|download/.test(action)) return `${moduleKey}.export`;
  if (/pay|release-payment/.test(action)) return `${moduleKey}.pay`;
  if (/post|confirm|complete|release|reconcile/.test(action)) return `${moduleKey}.post`;
  return `${moduleKey}.edit`;
}
