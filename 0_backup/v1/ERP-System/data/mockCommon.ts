
import { Task, Ticket, SecurityPolicy, IntegrationApp, SystemService, MonthlyMetric, RegionMetric, AuditLogEntry, ERPNotification, ModuleId } from '../types';

export const MOCK_NOTIFICATIONS: ERPNotification[] = [
  // --- TASKS (Approvals) ---
  {
    id: 'notif-1',
    category: 'TASK',
    priority: 'HIGH',
    status: 'UNREAD',
    title: 'Approval Request: SO-2310-0001',
    message: 'Bob Sales has requested approval for a 12% discount on Sales Order #SO-2310-0001.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    clientId: 'client-a', clientName: 'TechFlow Solutions',
    companyId: 'comp-a1', companyName: 'TechFlow US',
    module: ModuleId.SALES,
    entityId: 'SO-2310-0001-US',
    entityType: 'Sales Order',
    link: 'sales-detail',
    actions: ['APPROVE', 'REJECT', 'VIEW']
  },
  // ... (keeping existing notifications)
];

export const MOCK_TASKS: Task[] = [
  { id: 't1', title: 'Sales Orders to Approve', count: 3, priority: 'high', link: 'sales', type: 'approval', workspace: 'SALES' },
  { id: 't2', title: 'Stock Adjustments', count: 5, priority: 'medium', link: 'inventory', type: 'todo', workspace: 'INVENTORY' },
  { id: 't3', title: 'Pending Payments', count: 12, priority: 'high', link: 'finance', type: 'todo', workspace: 'FINANCE' },
];

// --- RICH TICKET MOCK DATA ---
export const MOCK_TICKETS: Ticket[] = [
  { 
    id: 'TKT-101', 
    title: 'Cannot generate PDF for Invoice #INV-292', 
    description: 'When I click print, I get a 500 error.',
    type: 'Bug',
    module: ModuleId.BILLING,
    status: 'In Progress',
    priority: 'High',
    creatorId: 'u2',
    creatorName: 'Bob Sales',
    created: '2023-10-24T09:00:00Z',
    updated: '2023-10-24T14:30:00Z',
    clientId: 'client-a',
    clientName: 'TechFlow Solutions',
    companyId: 'comp-a1',
    companyName: 'TechFlow US',
    assigneeId: 'support-1',
    assigneeName: 'Sarah Support',
    messages: [
        { id: 'm1', senderId: 'u2', senderName: 'Bob Sales', isInternal: false, message: 'I cannot print invoice INV-292. It spins and fails.', timestamp: '2023-10-24T09:00:00Z' },
        { id: 'm2', senderId: 'support-1', senderName: 'Sarah Support', isInternal: false, message: 'Hi Bob, we are looking into this. Is it happening for all invoices?', timestamp: '2023-10-24T09:15:00Z' },
        { id: 'm3', senderId: 'support-1', senderName: 'Sarah Support', isInternal: true, message: 'Logs show a timeout in the PDF render service. Escalating to Engineering.', timestamp: '2023-10-24T09:20:00Z' },
        { id: 'm4', senderId: 'eng-1', senderName: 'Mike Eng', isInternal: true, message: 'Restarting the render pod. Hold on.', timestamp: '2023-10-24T14:00:00Z' },
    ],
    timeline: [
        { id: 'tl1', action: 'Created', actorName: 'Bob Sales', timestamp: '2023-10-24T09:00:00Z', toStatus: 'Submitted' },
        { id: 'tl2', action: 'Triaged', actorName: 'Sarah Support', timestamp: '2023-10-24T09:10:00Z', fromStatus: 'Submitted', toStatus: 'Triaging' },
        { id: 'tl3', action: 'Assigned', actorName: 'Sarah Support', timestamp: '2023-10-24T09:10:00Z', fromStatus: 'Triaging', toStatus: 'In Progress' },
    ]
  },
  { 
    id: 'TKT-102', 
    title: 'Request for New User Roles', 
    description: 'Need a "Junior Accountant" role created.',
    type: 'Access',
    module: ModuleId.ORGANIZATION,
    status: 'Waiting Customer',
    priority: 'Low',
    creatorId: 'u1',
    creatorName: 'Alice Admin',
    created: '2023-10-25T10:00:00Z',
    updated: '2023-10-25T11:00:00Z',
    clientId: 'client-a',
    clientName: 'TechFlow Solutions',
    companyId: 'comp-a1',
    companyName: 'TechFlow US',
    assigneeId: 'support-2',
    assigneeName: 'John Ops',
    messages: [
        { id: 'm1', senderId: 'u1', senderName: 'Alice Admin', isInternal: false, message: 'Please create a role limited to viewing GL but not posting.', timestamp: '2023-10-25T10:00:00Z' },
        { id: 'm2', senderId: 'support-2', senderName: 'John Ops', isInternal: false, message: 'Sure. Should they have access to Banking module as well?', timestamp: '2023-10-25T11:00:00Z' },
    ],
    timeline: [
        { id: 'tl1', action: 'Created', actorName: 'Alice Admin', timestamp: '2023-10-25T10:00:00Z', toStatus: 'Submitted' },
        { id: 'tl2', action: 'Request Info', actorName: 'John Ops', timestamp: '2023-10-25T11:00:00Z', fromStatus: 'Triaging', toStatus: 'Waiting Customer' },
    ]
  },
  { 
    id: 'TKT-103', 
    title: 'Inventory Sync Error', 
    description: 'Stock count mismatch.',
    type: 'Bug',
    module: ModuleId.INVENTORY,
    status: 'Resolved',
    priority: 'Medium',
    creatorId: 'u4',
    creatorName: 'Dave Ops',
    created: '2023-10-20T08:00:00Z',
    updated: '2023-10-22T16:00:00Z',
    clientId: 'client-a',
    clientName: 'TechFlow Solutions',
    companyId: 'comp-a1',
    companyName: 'TechFlow US',
    assigneeId: 'support-1',
    assigneeName: 'Sarah Support',
    resolutionSummary: 'Run manual reconciliation job. Issue caused by network packet loss during sync.',
    messages: [
       { id: 'm1', senderId: 'u4', senderName: 'Dave Ops', isInternal: false, message: 'Stock mismatch in WH-001.', timestamp: '2023-10-20T08:00:00Z' },
       { id: 'm2', senderId: 'support-1', senderName: 'Sarah Support', isInternal: false, message: 'Fixed. Please verify.', timestamp: '2023-10-22T16:00:00Z' },
    ],
    timeline: [
        { id: 'tl1', action: 'Resolved', actorName: 'Sarah Support', timestamp: '2023-10-22T16:00:00Z', fromStatus: 'In Progress', toStatus: 'Resolved' },
    ]
  },
  { 
    id: 'TKT-104', 
    title: 'Setup EU VAT Codes', 
    description: 'Help needed configuring German tax rules.',
    type: 'Question',
    module: ModuleId.FINANCE,
    status: 'Submitted',
    priority: 'Medium',
    creatorId: 'u3',
    creatorName: 'Charlie EU',
    created: '2023-10-26T09:30:00Z',
    updated: '2023-10-26T09:30:00Z',
    clientId: 'client-a',
    clientName: 'TechFlow Solutions',
    companyId: 'comp-a2',
    companyName: 'TechFlow EU',
    messages: [],
    timeline: [
        { id: 'tl1', action: 'Created', actorName: 'Charlie EU', timestamp: '2023-10-26T09:30:00Z', toStatus: 'Submitted' },
    ]
  }
];

export const MOCK_SECURITY_POLICIES: SecurityPolicy[] = [
    { id: 'POL-001', name: 'Global Admin Access', type: 'Role', status: 'Active', usersCount: 3 },
];

export const MOCK_INTEGRATIONS: IntegrationApp[] = [
    { id: 'int-1', name: 'Stripe', category: 'Payment', status: 'Connected', icon: 'S' },
];

export const MOCK_SYSTEM_STATUS: SystemService[] = [
    { name: 'API Gateway', status: 'Operational', uptime: '99.99%', region: 'US-East' },
];

export const MOCK_ANALYTICS_MONTHLY: MonthlyMetric[] = [
    { month: 'Jan', revenue: 45000, expenses: 32000, profit: 13000 },
];

export const MOCK_ANALYTICS_REGIONS: RegionMetric[] = [
    { region: 'North America', value: 45 },
];

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
    { id: 'log-1', timestamp: '2023-10-24 09:12', user: 'Alice Admin', action: 'User Login', target: 'System', details: 'Logged in from 192.168.1.5' },
    { id: 'log-2', timestamp: '2023-10-24 10:30', user: 'Bob Sales', action: 'Create Document', target: 'SO-2310-0001-US', details: 'Created Sales Order' },
];
