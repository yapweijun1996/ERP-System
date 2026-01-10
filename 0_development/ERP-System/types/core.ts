
import { ModuleId } from './enums';

export interface FeatureFlags {
  // Core Modules
  [ModuleId.SALES]: boolean;
  [ModuleId.INVENTORY]: boolean;
  [ModuleId.MASTER_DATA]: boolean;
  [ModuleId.ANALYTICS]: boolean;
  [ModuleId.BILLING]: boolean;
  [ModuleId.SUPPORT]: boolean;
  [ModuleId.PURCHASING]: boolean;
  [ModuleId.FINANCE]: boolean;
  [ModuleId.ORGANIZATION]?: boolean;
  
  // Granular Sub-Features
  // Sales
  'SALES_QUOTES'?: boolean;
  'SALES_ORDERS'?: boolean;
  'SALES_DELIVERY'?: boolean;
  'SALES_INVOICES'?: boolean;
  'SALES_CREDIT_NOTES'?: boolean;
  
  // Purchasing
  'PURCHASING_PO'?: boolean;
  'PURCHASING_GRN'?: boolean;
  'PURCHASING_BILLS'?: boolean;
  
  // Inventory
  'INVENTORY_STOCK_ON_HAND'?: boolean;
  'INVENTORY_MOVEMENTS'?: boolean;
  'INVENTORY_ADJUSTMENTS'?: boolean;
  'INVENTORY_STOCK_TAKE'?: boolean;
  'INVENTORY_ITEMS'?: boolean;
  'INVENTORY_WAREHOUSES'?: boolean;

  // Index signature for extensibility
  [key: string]: boolean | undefined;
}

export interface EntityBase {
  id: string;
  name: string;
  features: FeatureFlags;
}

export interface ScopedEntity {
    clientId: string;   // The Tenant (Hard Separation)
    companyId: string;  // The Legal Entity (Accounting/Config Separation)
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Company extends EntityBase {
  clientId: string;
  status: 'Setup_Pending' | 'Active' | 'Suspended';
  
  // Identity
  code?: string;
  regId?: string;
  logoUrl?: string;

  // Locale
  currency: string;
  timezone: string;
  country: string;
  language?: string;

  // Contact
  email?: string;
  phone?: string;
  website?: string;

  // Location
  address?: Address;
}

export interface Client extends EntityBase {
  companies: Company[];
  status: 'Onboarding' | 'Active' | 'Suspended';
}

export interface Platform extends EntityBase {
  clients: Client[];
}
