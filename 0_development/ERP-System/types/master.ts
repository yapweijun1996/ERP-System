
import { ScopedEntity, Address } from './core';

export interface Customer extends ScopedEntity {
  id: string;
  name: string;
  email: string;
  phone: string;
  segment: 'Retail' | 'Wholesale' | 'Distributor';
  status: 'Active' | 'Inactive';
  address: Address;
  terms: number;
}

export interface Supplier extends ScopedEntity {
  id: string;
  name: string;
  contact: string;
  email: string;
  category: string;
  status: 'Active' | 'Review' | 'Blacklisted';
}

export interface Warehouse extends ScopedEntity {
  id: string;
  code: string;
  name: string;
  location: string;
  manager: string;
  status: 'Operational' | 'Maintenance';
}

export interface InventoryItem extends ScopedEntity {
  id: string;
  sku: string;
  name: string;
  stock: number;
  unit: string;
  category: string; 
  price: number;    
}
