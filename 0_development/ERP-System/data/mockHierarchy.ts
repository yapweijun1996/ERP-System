
import { FeatureFlags, ModuleId, Platform, Client, Company, Department } from '../types';

export const DEFAULT_FEATURES: FeatureFlags = {
  // Modules
  [ModuleId.SALES]: false,
  [ModuleId.INVENTORY]: false,
  [ModuleId.MASTER_DATA]: true,
  [ModuleId.ANALYTICS]: false,
  [ModuleId.BILLING]: false,
  [ModuleId.SUPPORT]: true,
  [ModuleId.PURCHASING]: false,
  [ModuleId.FINANCE]: false,
  [ModuleId.ORGANIZATION]: true,

  // Sales Defaults
  'SALES_QUOTES': true,
  'SALES_ORDERS': true,
  'SALES_DELIVERY': true,
  'SALES_INVOICES': true,
  'SALES_CREDIT_NOTES': false,

  // Purchasing Defaults
  'PURCHASING_PO': true,
  'PURCHASING_GRN': true,
  'PURCHASING_BILLS': false,

  // Inventory Defaults
  'INVENTORY_STOCK_ON_HAND': true,
  'INVENTORY_MOVEMENTS': true,
  'INVENTORY_ADJUSTMENTS': true,
  'INVENTORY_STOCK_TAKE': false,
  'INVENTORY_ITEMS': true,
  'INVENTORY_WAREHOUSES': true,
};

const mockCompaniesClientA: Company[] = [
  {
    id: 'comp-a1',
    name: 'TechFlow US',
    code: 'TF-US',
    regId: 'US-88291-X',
    clientId: 'client-a',
    currency: 'USD',
    country: 'USA',
    language: 'en-US',
    timezone: 'UTC-8',
    email: 'finance@techflow.us',
    phone: '+1 415 555 0199',
    website: 'www.techflow.us',
    address: {
        street: '100 Innovation Drive',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'USA'
    },
    status: 'Active',
    features: { 
        ...DEFAULT_FEATURES, 
        [ModuleId.SALES]: true, 
        [ModuleId.INVENTORY]: true, 
        [ModuleId.PURCHASING]: true, 
        [ModuleId.FINANCE]: true, 
        [ModuleId.ANALYTICS]: true, 
        [ModuleId.BILLING]: true,
        // Specific Overrides for US
        'SALES_CREDIT_NOTES': true,
        'INVENTORY_STOCK_TAKE': true
    },
  },
  {
    id: 'comp-a2',
    name: 'TechFlow EU',
    code: 'TF-EU',
    regId: 'DE8129291',
    clientId: 'client-a',
    currency: 'EUR',
    country: 'DE',
    language: 'de-DE',
    timezone: 'UTC+1',
    email: 'kontakt@techflow.eu',
    phone: '+49 30 1234 5678',
    website: 'www.techflow.eu',
    address: {
        street: 'Alexanderplatz 1',
        city: 'Berlin',
        state: 'Berlin',
        zip: '10178',
        country: 'DE'
    },
    status: 'Active',
    features: { 
        ...DEFAULT_FEATURES, 
        [ModuleId.SALES]: true, 
        [ModuleId.INVENTORY]: false, 
        [ModuleId.FINANCE]: true,
        // EU has restricted features
        'SALES_QUOTES': false, 
        'SALES_DELIVERY': false 
    },
  },
];

const mockCompaniesClientB: Company[] = [
  {
    id: 'comp-b1',
    name: 'ConstructCo Main',
    code: 'CC-MAIN',
    regId: 'US-99123-B',
    clientId: 'client-b',
    currency: 'USD',
    country: 'USA',
    language: 'en-US',
    timezone: 'UTC-5',
    email: 'admin@constructco.com',
    status: 'Active',
    features: { 
        ...DEFAULT_FEATURES, 
        [ModuleId.SALES]: true, 
        [ModuleId.BILLING]: true,
        'SALES_DELIVERY': false,
        'SALES_QUOTES': true
    },
  },
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-a',
    name: 'TechFlow Solutions',
    status: 'Active',
    features: { ...DEFAULT_FEATURES, [ModuleId.SALES]: true, [ModuleId.INVENTORY]: true, [ModuleId.ANALYTICS]: true, [ModuleId.PURCHASING]: true, [ModuleId.FINANCE]: true, [ModuleId.BILLING]: true },
    companies: mockCompaniesClientA,
  },
  {
    id: 'client-b',
    name: 'ConstructCo',
    status: 'Active',
    features: { ...DEFAULT_FEATURES, [ModuleId.SALES]: true, [ModuleId.BILLING]: true },
    companies: mockCompaniesClientB,
  },
];

export const MOCK_PLATFORM: Platform = {
  id: 'platform',
  name: 'Nexus ERP Master',
  features: { 
    ...DEFAULT_FEATURES,
    [ModuleId.SALES]: true, 
    [ModuleId.INVENTORY]: true, 
    [ModuleId.MASTER_DATA]: true, 
    [ModuleId.ANALYTICS]: true, 
    [ModuleId.BILLING]: true,
    [ModuleId.SUPPORT]: true,
    [ModuleId.PURCHASING]: true,
    [ModuleId.FINANCE]: true,
    [ModuleId.ORGANIZATION]: true,
  },
  clients: MOCK_CLIENTS,
};

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 'DEPT_EXEC', name: 'Executive', managerId: 'EMP_001', clientId: 'client-a', companyId: 'comp-a1' },
  { id: 'DEPT_SALES', name: 'Sales & Marketing', managerId: 'EMP_002', clientId: 'client-a', companyId: 'comp-a1' },
  { id: 'DEPT_OPS', name: 'Operations', managerId: 'EMP_004', clientId: 'client-a', companyId: 'comp-a1' },
  { id: 'DEPT_FIN', name: 'Finance', managerId: 'EMP_003', clientId: 'client-a', companyId: 'comp-a1' },
];
