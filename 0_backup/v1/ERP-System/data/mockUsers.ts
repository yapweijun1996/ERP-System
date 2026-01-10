
import { Role, User, Employee } from '../types';

export const MOCK_ROLES: Role[] = [
  { 
    id: 'ROLE_PLATFORM_ADMIN', 
    name: 'Platform Super Admin', 
    description: 'Complete control over the multi-tenant environment.',
    scope: 'SYSTEM',
    permissions: [
      'SALES_VIEW', 'SALES_CREATE', 'SALES_EDIT', 'SALES_POST', 'SALES_VOID', 'SALES_DISCOUNT_APPROVE',
      'INV_VIEW', 'INV_ADJUST', 'FIN_VIEW', 'FIN_POST', 'ORG_MANAGE_EMPLOYEES', 'ORG_MANAGE_ROLES'
    ]
  },
  { 
    id: 'ROLE_ADMIN', 
    name: 'System Administrator', 
    description: 'Full access to all modules and configurations.',
    scope: 'CLIENT',
    permissions: [
      'SALES_VIEW', 'SALES_CREATE', 'SALES_EDIT', 'SALES_POST', 'SALES_VOID', 'SALES_DISCOUNT_APPROVE',
      'INV_VIEW', 'INV_ADJUST', 'FIN_VIEW', 'FIN_POST', 'ORG_MANAGE_EMPLOYEES', 'ORG_MANAGE_ROLES'
    ]
  },
  { 
    id: 'ROLE_SALES_MGR', 
    name: 'Sales Manager', 
    description: 'Can manage sales team, approve discounts, and post orders.',
    scope: 'COMPANY',
    permissions: [
      'SALES_VIEW', 'SALES_CREATE', 'SALES_EDIT', 'SALES_POST', 'SALES_DISCOUNT_APPROVE'
    ]
  },
  { 
    id: 'ROLE_SALES_REP', 
    name: 'Sales Representative', 
    description: 'Can create and edit draft orders.',
    scope: 'COMPANY',
    permissions: [
      'SALES_VIEW', 'SALES_CREATE', 'SALES_EDIT'
    ]
  },
  {
    id: 'ROLE_WH_MGR',
    name: 'Warehouse Manager',
    description: 'Manage inventory and stock adjustments.',
    scope: 'COMPANY',
    permissions: [
      'INV_VIEW', 'INV_ADJUST'
    ]
  }
];

export const MOCK_USERS: User[] = [
    { 
        id: 'u0', name: 'Super Admin', email: 'super@nexuserp.io', status: 'Active', lastLogin: 'Just now', 
        clientId: 'platform', allowedCompanyIds: [], 
        roles: ['ROLE_PLATFORM_ADMIN'] 
    },
    { 
        id: 'u1', name: 'Alice Admin', email: 'alice@techflow.com', status: 'Active', lastLogin: '2 mins ago', 
        clientId: 'client-a', allowedCompanyIds: ['comp-a1', 'comp-a2'], defaultCompanyId: 'comp-a1',
        roles: ['ROLE_ADMIN'], employeeId: 'EMP_001' 
    },
    { 
        id: 'u2', name: 'Bob Sales (US)', email: 'bob@techflow.com', status: 'Active', lastLogin: '4 hours ago', 
        clientId: 'client-a', allowedCompanyIds: ['comp-a1'], defaultCompanyId: 'comp-a1',
        roles: ['ROLE_SALES_MGR'], employeeId: 'EMP_002' 
    },
    { 
        id: 'u3', name: 'Charlie EU', email: 'charlie@techflow.eu', status: 'Active', lastLogin: '5 days ago', 
        clientId: 'client-a', allowedCompanyIds: ['comp-a2'], defaultCompanyId: 'comp-a2',
        roles: ['ROLE_SALES_MGR'], employeeId: 'EMP_003' 
    },
    { 
        id: 'u4', name: 'Dave Ops', email: 'dave@techflow.com', status: 'Active', lastLogin: '1 day ago', 
        clientId: 'client-a', allowedCompanyIds: ['comp-a1'], defaultCompanyId: 'comp-a1',
        roles: ['ROLE_WH_MGR'], employeeId: 'EMP_004' 
    },
    { 
        id: 'u5', name: 'Eve Construct', email: 'eve@construct.com', status: 'Active', lastLogin: 'Just now', 
        clientId: 'client-b', allowedCompanyIds: ['comp-b1'], defaultCompanyId: 'comp-b1',
        roles: ['ROLE_ADMIN'], employeeId: 'EMP_005' 
    },
];

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 'EMP_001', firstName: 'Alice', lastName: 'Admin', email: 'alice@techflow.com', departmentId: 'DEPT_EXEC', jobTitle: 'CTO', status: 'Active', joinDate: '2020-01-15', userId: 'u1', clientId: 'client-a', companyId: 'comp-a1' },
  { id: 'EMP_002', firstName: 'Bob', lastName: 'Sales', email: 'bob@techflow.com', departmentId: 'DEPT_SALES', jobTitle: 'Sales Director', status: 'Active', joinDate: '2021-03-10', userId: 'u2', clientId: 'client-a', companyId: 'comp-a1' },
  { id: 'EMP_003', firstName: 'Charlie', lastName: 'Finance', email: 'charlie@techflow.com', departmentId: 'DEPT_FIN', jobTitle: 'CFO', status: 'OnLeave', joinDate: '2020-06-01', userId: 'u3', clientId: 'client-a', companyId: 'comp-a2' },
  { id: 'EMP_004', firstName: 'Dave', lastName: 'Ops', email: 'dave@techflow.com', departmentId: 'DEPT_OPS', jobTitle: 'Ops Manager', status: 'Active', joinDate: '2022-01-20', userId: 'u4', clientId: 'client-a', companyId: 'comp-a1' },
  { id: 'EMP_005', firstName: 'Eve', lastName: 'Construct', email: 'eve@construct.com', departmentId: 'DEPT_EXEC', jobTitle: 'CEO', status: 'Active', joinDate: '2023-02-15', userId: 'u5', clientId: 'client-b', companyId: 'comp-b1' },
];
