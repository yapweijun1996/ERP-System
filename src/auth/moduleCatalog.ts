/** Application-owned commercial module catalogue. Baseline workspace services are
 * intentionally absent: Home/Dashboard, My Work, Admin, Settings, Account and
 * Notifications are authenticated product services, not sellable entitlements. */
export const COMMERCIAL_MODULE_CATALOG = [
  { key: 'sales', name: 'Sales', dependencies: ['finance'] },
  { key: 'purchasing', name: 'Purchasing', dependencies: ['finance'] },
  { key: 'crm', name: 'CRM', dependencies: [] },
  { key: 'inventory', name: 'Inventory', dependencies: [] },
  { key: 'warehouse', name: 'Warehouse', dependencies: ['inventory'] },
  { key: 'manufacturing', name: 'Manufacturing', dependencies: ['inventory', 'warehouse'] },
  { key: 'quality', name: 'Quality', dependencies: ['inventory'] },
  { key: 'finance', name: 'Finance', dependencies: [] },
  { key: 'hr', name: 'Human Resources', dependencies: [] },
  { key: 'payroll', name: 'Payroll', dependencies: ['finance'] },
  { key: 'project', name: 'Projects', dependencies: ['finance'] },
  { key: 'service', name: 'Service', dependencies: ['crm'] },
  { key: 'asset', name: 'Assets', dependencies: ['finance'] },
  { key: 'workflow', name: 'Workflow', dependencies: [] },
  { key: 'bi', name: 'Business Intelligence', dependencies: [] },
  { key: 'integration', name: 'Integrations', dependencies: [] },
  { key: 'expenses_tax', name: 'Expenses & Tax', dependencies: [] },
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
