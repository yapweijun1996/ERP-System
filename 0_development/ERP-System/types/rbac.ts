
import { ScopedEntity } from './core';

export type Permission = 
  | 'SALES_VIEW' | 'SALES_CREATE' | 'SALES_EDIT' | 'SALES_POST' | 'SALES_VOID' | 'SALES_DISCOUNT_APPROVE'
  | 'INV_VIEW' | 'INV_ADJUST' 
  | 'FIN_VIEW' | 'FIN_POST'
  | 'ORG_MANAGE_EMPLOYEES' | 'ORG_MANAGE_ROLES';

export interface Role {
  id: string;
  name: string;
  description: string;
  scope: 'SYSTEM' | 'CLIENT' | 'COMPANY';
  permissions: Permission[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  status: 'Active' | 'Inactive' | 'Locked' | 'Pending_Verification';
  lastLogin: string;
  avatar?: string;
  clientId: string;
  allowedCompanyIds: string[];
  defaultCompanyId?: string;
  roles: string[];
  employeeId?: string;
}

export interface Employee extends ScopedEntity {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  jobTitle: string;
  managerId?: string; 
  status: 'Active' | 'OnLeave' | 'Terminated';
  joinDate: string;
  avatar?: string;
  userId?: string; 
}

export interface Department extends ScopedEntity {
  id: string;
  name: string;
  managerId?: string; 
}
