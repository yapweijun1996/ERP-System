
import { WidgetDefinition, DashboardLayout, ModuleId } from '../types';

export const WIDGET_LIBRARY: WidgetDefinition[] = [
  // --- KPIs ---
  {
    id: 'kpi-revenue',
    name: 'Revenue Snapshot',
    description: 'Current month revenue vs target.',
    type: 'KPI',
    defaultSize: 'SMALL',
    allowedSizes: ['SMALL', 'MEDIUM'],
    moduleId: ModuleId.SALES,
    defaultConfig: { title: 'Revenue' }
  },
  {
    id: 'kpi-orders',
    name: 'Open Orders',
    description: 'Count of orders pending processing.',
    type: 'KPI',
    defaultSize: 'SMALL',
    allowedSizes: ['SMALL'],
    moduleId: ModuleId.SALES,
    defaultConfig: { title: 'Open Orders' }
  },
  {
    id: 'kpi-stock-value',
    name: 'Inventory Value',
    description: 'Total value of stock on hand.',
    type: 'KPI',
    defaultSize: 'SMALL',
    allowedSizes: ['SMALL'],
    moduleId: ModuleId.INVENTORY,
    defaultConfig: { title: 'Stock Value' }
  },
  
  // --- LISTS ---
  {
    id: 'list-tasks',
    name: 'My Tasks',
    description: 'Pending approvals and assigned work.',
    type: 'LIST',
    defaultSize: 'MEDIUM',
    allowedSizes: ['MEDIUM', 'LARGE', 'FULL'],
    defaultConfig: { title: 'My Work Queue', limit: 5 }
  },
  {
    id: 'list-exceptions',
    name: 'Exceptions & Alerts',
    description: 'System warnings, low stock, overdue items.',
    type: 'ALERT',
    defaultSize: 'MEDIUM',
    allowedSizes: ['MEDIUM', 'LARGE'],
    defaultConfig: { title: 'Exceptions' }
  },
  {
    id: 'list-recent-sales',
    name: 'Recent Sales',
    description: 'Latest sales orders created or posted.',
    type: 'LIST',
    defaultSize: 'FULL',
    allowedSizes: ['MEDIUM', 'LARGE', 'FULL'],
    moduleId: ModuleId.SALES,
    defaultConfig: { title: 'Recent Activity' }
  },

  // --- SHORTCUTS ---
  {
    id: 'shortcuts-general',
    name: 'Quick Actions',
    description: 'Common actions like Create Order, Add User.',
    type: 'SHORTCUTS',
    defaultSize: 'FULL',
    allowedSizes: ['MEDIUM', 'LARGE', 'FULL'],
    defaultConfig: { title: 'Quick Actions' }
  },
  {
    id: 'tool-pinned',
    name: 'Pinned Tools',
    description: 'Access to pinned utility calculators.',
    type: 'SHORTCUTS',
    defaultSize: 'MEDIUM',
    allowedSizes: ['MEDIUM', 'LARGE'],
    defaultConfig: { title: 'Utilities' }
  }
];

export const DEFAULT_LAYOUTS: Record<string, DashboardLayout> = {
  'ROLE_SALES_MGR': {
    id: 'def-sales',
    widgets: [
      { id: 'w1', definitionId: 'kpi-revenue', size: 'SMALL', order: 0, config: {} },
      { id: 'w2', definitionId: 'kpi-orders', size: 'SMALL', order: 1, config: {} },
      { id: 'w3', definitionId: 'list-tasks', size: 'MEDIUM', order: 2, config: {} },
      { id: 'w4', definitionId: 'shortcuts-general', size: 'FULL', order: 3, config: {} },
      { id: 'w5', definitionId: 'list-recent-sales', size: 'FULL', order: 4, config: {} }
    ]
  },
  'ROLE_WH_MGR': {
    id: 'def-wh',
    widgets: [
      { id: 'w1', definitionId: 'kpi-stock-value', size: 'SMALL', order: 0, config: {} },
      { id: 'w2', definitionId: 'list-exceptions', size: 'MEDIUM', order: 1, config: {} },
      { id: 'w3', definitionId: 'list-tasks', size: 'MEDIUM', order: 2, config: {} },
      { id: 'w4', definitionId: 'shortcuts-general', size: 'FULL', order: 3, config: {} }
    ]
  },
  'DEFAULT': {
    id: 'def-gen',
    widgets: [
      { id: 'w1', definitionId: 'list-tasks', size: 'MEDIUM', order: 0, config: {} },
      { id: 'w2', definitionId: 'list-exceptions', size: 'MEDIUM', order: 1, config: {} },
      { id: 'w3', definitionId: 'shortcuts-general', size: 'FULL', order: 2, config: {} }
    ]
  }
};
