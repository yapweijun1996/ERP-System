/**
 * Cross-layer authorization contract for the production ERP shell.
 *
 * Each entry describes the user-visible route and, where the route opens
 * persisted records, the canonical API collection/detail pair behind it.  The
 * Vitest contract exercises the API pair; the Playwright contract exercises
 * routeAllowed() against the same permission requirements.  Keeping this in
 * one dependency-light module prevents a notification, nav item, and drill-in
 * from silently acquiring different access rules.
 */

export type AccessMatrixApiProbe = {
  listPath: string;
  detailPath?: (id: string | number) => string;
  rowId?: (row: Record<string, unknown>) => string | number | null;
  requiresRow?: boolean;
  /** Only rows matching this scalar field are clickable drill-in records. */
  detailWhen?: { field: string; equals: string | number | boolean | null };
};

export type AccessMatrixEntry = {
  id: string;
  route: string;
  module: string;
  requiredAny?: readonly string[];
  requiredAll?: readonly string[];
  /** Signed-in account routes may intentionally have no module permission. */
  authenticated?: boolean;
  /** Actor-derived routes can only be opened by these role fixtures. */
  allowedRoles?: readonly string[];
  api?: AccessMatrixApiProbe;
  /** Team calendar availability is a capability in addition to permissions. */
  teamCapability?: boolean;
};

const rowScalar = (value: unknown): string | number | null =>
  typeof value === 'string' || typeof value === 'number' ? value : null;

const resourceProbe = (
  route: string,
  module: string,
  resource: string,
  permission: string,
  options: Omit<AccessMatrixApiProbe, 'listPath'> = {},
): AccessMatrixEntry => ({
  id: `route:${route}`,
  route,
  module,
  requiredAny: [permission],
  api: {
    listPath: `/api/${resource}?limit=1`,
    detailPath: (id) => `/api/${resource}/${id}`,
    ...options,
  },
});

export const ACCESS_MATRIX: readonly AccessMatrixEntry[] = [
  {
    id: 'dashboard', route: 'dashboard', module: 'home',
    requiredAny: ['dashboard.read'],
  },
  {
    id: 'notifications', route: 'notifications', module: 'account',
    requiredAny: ['notifications.read'],
    api: { listPath: '/api/account/notifications?limit=1' },
  },
  {
    id: 'my-activity', route: 'my-activity', module: 'account',
    authenticated: true,
    api: { listPath: '/api/account/activity?limit=1' },
  },

  resourceProbe('sales-orders', 'sales', 'sales/orders', 'sales.read'),
  resourceProbe('sales-order', 'sales', 'sales/orders', 'sales.read'),
  resourceProbe('txn-view', 'sales', 'sales/enquiries', 'sales.read', {
    detailPath: (id) => `/api/sales/enquiries/${id}/aggregate`,
  }),
  resourceProbe('quotations', 'sales', 'sales/quotations', 'sales.read'),
  resourceProbe('quotation', 'sales', 'sales/quotations', 'sales.read'),
  resourceProbe('delivery-orders', 'sales', 'sales/deliveries', 'sales.read'),
  resourceProbe('delivery-order', 'sales', 'sales/deliveries', 'sales.read'),
  resourceProbe('sales-invoices', 'sales', 'sales/invoices', 'sales.read'),
  resourceProbe('sales-invoice', 'sales', 'sales/invoices', 'sales.read'),

  resourceProbe('crm-customer', 'crm', 'crm/customers', 'crm.read', { requiresRow: true }),
  resourceProbe('opportunity', 'crm', 'crm/opportunities', 'crm.read', { requiresRow: true }),

  resourceProbe('suppliers', 'purchasing', 'purchasing/suppliers', 'purchasing.read', { requiresRow: true }),
  resourceProbe('supplier', 'purchasing', 'purchasing/suppliers', 'purchasing.read'),
  resourceProbe('purchase-orders', 'purchasing', 'purchasing/purchase-orders', 'purchasing.read', { requiresRow: true }),
  resourceProbe('pur-txn-view', 'purchasing', 'purchasing/purchase-orders', 'purchasing.read'),
  resourceProbe('goods-receipts', 'purchasing', 'purchasing/goods-receipts', 'purchasing.read'),
  resourceProbe('goods-receipt', 'purchasing', 'purchasing/goods-receipts', 'purchasing.read'),
  resourceProbe('supplier-invoices', 'purchasing', 'purchasing/supplier-invoices', 'purchasing.read', { requiresRow: true }),
  resourceProbe('supplier-invoice', 'purchasing', 'purchasing/supplier-invoices', 'purchasing.read'),

  resourceProbe('stock-on-hand', 'inventory', 'inventory/stock-levels', 'inventory.read'),
  resourceProbe('stock-movement', 'inventory', 'inventory/stock-movements', 'inventory.read'),
  resourceProbe('work-orders', 'manufacturing', 'manufacturing/work-orders', 'manufacturing.read'),
  resourceProbe('work-order', 'manufacturing', 'manufacturing/work-orders', 'manufacturing.read'),
  resourceProbe('qc-inspection', 'quality', 'quality/inspections', 'quality.read'),
  resourceProbe('qc-report', 'quality', 'quality/inspections', 'quality.read'),
  resourceProbe('ncr', 'quality', 'quality/ncrs', 'quality.read'),

  resourceProbe('account-ledger', 'finance', 'finance/accounts', 'finance.read', { requiresRow: true }),
  resourceProbe('journal-entry', 'finance', 'finance/journals', 'finance.read'),
  resourceProbe('payment-voucher', 'finance', 'finance/payment-vouchers', 'finance.read'),

  resourceProbe('project-detail', 'project', 'project/projects', 'project.read', { requiresRow: true }),
  resourceProbe('service-order', 'service', 'service/tickets', 'service.read', { requiresRow: true }),
  resourceProbe('service-contract', 'service', 'service/contracts', 'service.read', { requiresRow: true }),
  resourceProbe('asset-detail', 'asset', 'assets/assets', 'asset.read', { requiresRow: true }),

  resourceProbe('employee', 'hr', 'hr/employees', 'hr.read', { requiresRow: true }),
  resourceProbe('payroll-run', 'hr', 'payroll/runs', 'payroll.read', { requiresRow: true }),
  {
    id: 'hr-calendar-holidays', route: 'hr-calendar', module: 'hr',
    requiredAny: ['hr.read'],
    api: { listPath: '/api/hr/calendar/holidays?from=2026-01-01&to=2026-12-31' },
  },
  {
    id: 'hr-staff-calendar', route: 'staff-calendar', module: 'hr',
    requiredAny: ['hr.read'],
    api: { listPath: '/api/hr/calendar/staff?from=2026-01-01&to=2026-12-31' },
  },
  {
    id: 'hr-leave-approval', route: 'leave-approval', module: 'hr',
    requiredAny: ['hr.read'],
    api: {
      listPath: '/api/hr/leave-approval-queue',
      detailPath: (id) => `/api/hr/leave-applications/${id}`,
      rowId: (row) => rowScalar(row.requestId) ?? rowScalar(row.id),
    },
  },

  {
    id: 'my-leave', route: 'my-leave', module: 'mywork',
    requiredAny: ['employee.self.read'],
    allowedRoles: ['company_owner', 'superadmin', 'employee', 'manager'],
    api: {
      listPath: '/api/my/leave-requests',
      detailPath: (id) => `/api/my/leave-requests/${id}`,
      // Legacy HR-register rows remain visible as history, but the UI does not
      // offer a drill-in because the governed detail API intentionally excludes them.
      detailWhen: { field: 'legacyPolicy', equals: false },
    },
  },
  {
    id: 'my-claims', route: 'my-claims', module: 'mywork',
    requiredAny: ['employee.self.read'],
    allowedRoles: ['company_owner', 'superadmin', 'employee', 'manager'],
    api: {
      listPath: '/api/my/claims',
      detailPath: (id) => `/api/my/claims/${id}`,
    },
  },
  {
    id: 'my-receipts', route: 'my-receipts', module: 'mywork',
    requiredAny: ['employee.self.read'],
    allowedRoles: ['company_owner', 'superadmin', 'employee', 'manager'],
    api: { listPath: '/api/my/receipts' },
  },
  {
    id: 'company-receipts', route: 'company-receipts', module: 'expenses_tax',
    requiredAny: [
      'expenses.company_receipts.read_company',
      'expenses.company_receipts.read_own',
    ],
    api: {
      listPath: '/api/company-receipts?limit=1',
      detailPath: (id) => `/api/company-receipts/${id}`,
    },
  },
  {
    id: 'my-approvals', route: 'my-approvals', module: 'mywork',
    requiredAny: ['employee.self.read'],
    allowedRoles: ['company_owner', 'superadmin', 'employee', 'manager'],
    api: {
      listPath: '/api/my/approvals',
      detailPath: (id) => `/api/my/approvals/${id}`,
      rowId: (row) => rowScalar(row.requestId) ?? rowScalar(row.id),
    },
  },
  {
    id: 'team-calendar', route: 'team-calendar', module: 'mywork',
    requiredAny: ['employee.self.read'],
    allowedRoles: ['company_owner', 'superadmin', 'manager'],
    teamCapability: true,
    api: {
      listPath: '/api/my/team/calendar?from=2026-01-01&to=2026-12-31',
    },
  },

  {
    id: 'approval-inbox', route: 'approval-inbox', module: 'workflow',
    requiredAny: [
      'sales.approve', 'purchasing.approve', 'finance.approve', 'hr.approve',
      'project.approve', 'employee.team.read', 'expenses.approve.manager',
      'expenses.approve.finance',
    ],
  },
  {
    id: 'settings', route: 'settings', module: 'settings',
    requiredAny: ['settings.read'],
  },
  {
    id: 'user-mgmt', route: 'user-mgmt', module: 'admin',
    requiredAll: ['admin.users.read'],
  },
  {
    id: 'role-permission', route: 'role-permission', module: 'admin',
    requiredAll: ['admin.roles.read'],
  },
  {
    id: 'company-onboarding', route: 'company-onboarding', module: 'admin',
    requiredAll: ['admin.roles.write'],
  },
  // Create/action routes deliberately share the same guard contract as their
  // parent module. They do not get a detail probe because no record exists yet.
  {
    id: 'new-sales-order', route: 'new-sales-order', module: 'sales',
    requiredAll: ['sales.read'], requiredAny: ['sales.create', 'sales.write'],
  },
  {
    id: 'new-quotation', route: 'new-quotation', module: 'sales',
    requiredAll: ['sales.read'], requiredAny: ['sales.create', 'sales.write'],
  },
  {
    id: 'new-purchase-order', route: 'new-purchase-order', module: 'purchasing',
    requiredAll: ['purchasing.read'], requiredAny: ['purchasing.create', 'purchasing.write'],
  },
  {
    id: 'new-item', route: 'new-item', module: 'inventory',
    requiredAll: ['inventory.read'], requiredAny: ['inventory.create', 'inventory.write'],
  },
  {
    id: 'new-journal-entry', route: 'new-journal-entry', module: 'finance',
    requiredAll: ['finance.read'], requiredAny: ['finance.create', 'finance.write'],
  },
  {
    id: 'new-payment-voucher', route: 'new-payment-voucher', module: 'finance',
    requiredAll: ['finance.read'], requiredAny: ['finance.create', 'finance.write'],
  },
  {
    id: 'new-employee', route: 'new-employee', module: 'hr',
    requiredAll: ['hr.read'], requiredAny: ['hr.create', 'hr.write'],
  },
];

const duplicateIds = ACCESS_MATRIX.filter((entry, index, rows) =>
  rows.findIndex((candidate) => candidate.id === entry.id) !== index);
if (duplicateIds.length) {
  throw new Error(`Duplicate access matrix ids: ${duplicateIds.map((entry) => entry.id).join(', ')}`);
}
