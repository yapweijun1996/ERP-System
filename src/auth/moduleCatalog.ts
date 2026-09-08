/** Application-owned commercial module catalogue. Baseline workspace services are
 * intentionally absent: Home/Dashboard, My Work, Admin, Settings, Account and
 * Notifications are authenticated product services, not sellable entitlements. */
export const COMMERCIAL_MODULE_CATALOG = [
  { key: 'sales', name: 'Sales', dependencies: ['finance'], defaultCompanyAllocated: false },
  { key: 'purchasing', name: 'Purchasing', dependencies: ['finance'], defaultCompanyAllocated: false },
  { key: 'crm', name: 'CRM', dependencies: [], defaultCompanyAllocated: false },
  { key: 'inventory', name: 'Inventory', dependencies: [], defaultCompanyAllocated: false },
  { key: 'warehouse', name: 'Warehouse', dependencies: ['inventory'], defaultCompanyAllocated: false },
  { key: 'manufacturing', name: 'Manufacturing', dependencies: ['inventory', 'warehouse'], defaultCompanyAllocated: false },
  { key: 'quality', name: 'Quality', dependencies: ['inventory'], defaultCompanyAllocated: false },
  { key: 'finance', name: 'Finance', dependencies: [], defaultCompanyAllocated: false },
  { key: 'hr', name: 'Human Resources', dependencies: [], defaultCompanyAllocated: true },
  { key: 'payroll', name: 'Payroll', dependencies: ['finance'], defaultCompanyAllocated: false },
  { key: 'project', name: 'Projects', dependencies: ['finance'], defaultCompanyAllocated: false },
  { key: 'service', name: 'Service', dependencies: ['crm'], defaultCompanyAllocated: false },
  { key: 'asset', name: 'Assets', dependencies: ['finance'], defaultCompanyAllocated: false },
  { key: 'workflow', name: 'Workflow', dependencies: [], defaultCompanyAllocated: false },
  { key: 'bi', name: 'Business Intelligence', dependencies: [], defaultCompanyAllocated: false },
  { key: 'integration', name: 'Integrations', dependencies: [], defaultCompanyAllocated: false },
  { key: 'expenses_tax', name: 'Expenses & Tax', dependencies: [], defaultCompanyAllocated: true },
] as const;

export type CommercialModuleKey = typeof COMMERCIAL_MODULE_CATALOG[number]['key'];
export const COMMERCIAL_MODULE_KEYS = COMMERCIAL_MODULE_CATALOG.map((item) => item.key);
export const BASELINE_SERVICE_KEYS = [
  'home', 'dashboard', 'my-work', 'admin', 'settings', 'account', 'notifications',
] as const;

const BY_KEY = new Map<string, typeof COMMERCIAL_MODULE_CATALOG[number]>(
  COMMERCIAL_MODULE_CATALOG.map((item) => [item.key, item]),
);

export function commercialModuleDefinition(key: string) {
  return BY_KEY.get(key);
}

export function isCommercialModuleKey(key: string): key is CommercialModuleKey {
  return BY_KEY.has(key);
}
