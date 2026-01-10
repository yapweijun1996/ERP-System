
import { 
  LayoutDashboard, ShoppingCart, Package, Settings, Database, 
  BarChart3, ToggleLeft, LifeBuoy, Building, Users, CreditCard, 
  ShieldCheck, Factory, Receipt, Home, Grid, Network, Activity, Lock, Puzzle, 
  Search, Terminal, Archive, PlayCircle, Wrench, FileText, Truck, ClipboardList,
  ArrowRightLeft, AlertOctagon, Scale, BookOpen, Box
} from 'lucide-react';
import { ModuleId, ViewLevel } from '../types';

export type MenuItemConfig = {
    id: string;
    label: string;
    icon: any;
    moduleId?: ModuleId;
    featureFlag?: string; // Granular sub-feature key
    section?: string;
    children?: MenuItemConfig[];
    path?: string; // Explicit route path if different from ID
};

export const getMenuItems = (viewLevel: ViewLevel): MenuItemConfig[] => {
    if (viewLevel === 'PLATFORM') {
        return [
            // Tenant Ops
            { section: 'Tenant Ops', id: 'admin-clients', label: 'Clients', icon: Building },
            { section: 'Tenant Ops', id: 'admin-companies', label: 'Companies Directory', icon: Archive },
            { section: 'Tenant Ops', id: 'users', label: 'Users Directory', icon: Users },
            
            // Debug & Observability
            { section: 'Debug & Observability', id: 'admin-support-sessions', label: 'Support Sessions', icon: PlayCircle },
            { section: 'Debug & Observability', id: 'admin-logs', label: 'Logs Explorer', icon: Terminal },
            { section: 'Debug & Observability', id: 'admin-jobs', label: 'Jobs Monitor', icon: Activity },
            { section: 'Debug & Observability', id: 'audit', label: 'Events / Audit', icon: ShieldCheck },

            // Control Plane
            { section: 'Control Plane', id: 'features', label: 'Feature Catalog', icon: ToggleLeft },
            { section: 'Control Plane', id: 'security-policies', label: 'Security Policies', icon: Lock },
            { section: 'Control Plane', id: 'settings', label: 'Platform Settings', icon: Settings },
            
            // Support
            { section: 'Support', id: 'support', label: 'Ticket Console', icon: LifeBuoy },
        ];
    } 
    if (viewLevel === 'CLIENT') {
        return [
            { section: 'Tenant', id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { section: 'Tenant', id: 'companies', label: 'Companies', icon: Building },
            { section: 'Tenant', id: 'users', label: 'Users', icon: Users },
            { section: 'Configuration', id: 'features', label: 'Features', icon: ToggleLeft },
            { section: 'Configuration', id: 'tools-config', label: 'Tools Config', icon: Wrench }, 
            { section: 'Configuration', id: 'integrations', label: 'Integrations', icon: Puzzle },
            { section: 'Configuration', id: 'billing', label: 'Billing', icon: CreditCard, moduleId: ModuleId.BILLING },
            { section: 'System', id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
            { section: 'System', id: 'settings', label: 'Settings', icon: Settings },
        ];
    }
    // Company / ERP
    return [
        { section: 'Workspaces', id: 'dashboard', label: 'Work Center', icon: Home },
        { section: 'Workspaces', id: 'apps', label: 'All Apps', icon: Grid },
        
        // SALES MODULE TREE
        { 
            section: 'Operations', 
            id: 'sales', 
            label: 'Sales', 
            icon: ShoppingCart, 
            moduleId: ModuleId.SALES,
            children: [
                { id: 'sales-quotes', label: 'Quotations', icon: FileText, featureFlag: 'SALES_QUOTES' },
                { id: 'sales-orders', label: 'Sales Orders', icon: ClipboardList, featureFlag: 'SALES_ORDERS' },
                { id: 'sales-delivery', label: 'Deliveries', icon: Truck, featureFlag: 'SALES_DELIVERY' },
                { id: 'sales-invoices', label: 'Invoices', icon: Receipt, featureFlag: 'SALES_INVOICES' },
                { id: 'sales-credit-notes', label: 'Credit Notes', icon: ArrowRightLeft, featureFlag: 'SALES_CREDIT_NOTES' },
                { id: 'master-customers', label: 'Customers', icon: Users, featureFlag: 'SALES_ORDERS' } // Re-using Orders flag or create generic one
            ]
        },

        // PURCHASING MODULE TREE
        { 
            section: 'Operations', 
            id: 'purchasing', 
            label: 'Purchasing', 
            icon: Factory, 
            moduleId: ModuleId.PURCHASING,
            children: [
                { id: 'purchasing-po', label: 'Purchase Orders', icon: ClipboardList, featureFlag: 'PURCHASING_PO' },
                { id: 'purchasing-grn', label: 'Goods Receive', icon: Truck, featureFlag: 'PURCHASING_GRN' },
                { id: 'purchasing-bills', label: 'Supplier Bills', icon: Receipt, featureFlag: 'PURCHASING_BILLS' },
                { id: 'master-suppliers', label: 'Suppliers', icon: Building, featureFlag: 'PURCHASING_PO' }
            ]
        },

        // INVENTORY MODULE TREE
        { 
            section: 'Operations', 
            id: 'inventory', 
            label: 'Inventory', 
            icon: Package, 
            moduleId: ModuleId.INVENTORY,
            children: [
                { id: 'inventory-stock', label: 'Stock On Hand', icon: Box, featureFlag: 'INVENTORY_STOCK_ON_HAND' },
                { id: 'inventory-moves', label: 'Stock Movements', icon: ArrowRightLeft, featureFlag: 'INVENTORY_MOVEMENTS' },
                { id: 'inventory-adjust', label: 'Stock Adjustment', icon: Scale, featureFlag: 'INVENTORY_ADJUSTMENTS' },
                { id: 'inventory-take', label: 'Stock Take', icon: ClipboardList, featureFlag: 'INVENTORY_STOCK_TAKE' },
                { id: 'master-items', label: 'Items', icon: Package, featureFlag: 'INVENTORY_ITEMS' },
                { id: 'master-warehouses', label: 'Warehouses', icon: Building, featureFlag: 'INVENTORY_WAREHOUSES' }
            ]
        },

        { section: 'Finance', id: 'finance', label: 'Finance', icon: Receipt, moduleId: ModuleId.FINANCE },
        { section: 'Utilities', id: 'tools-center', label: 'Mini Tools', icon: Wrench }, 
        { section: 'HR', id: 'employees', label: 'Organization', icon: Network, moduleId: ModuleId.ORGANIZATION },
        { section: 'Analytics', id: 'analytics', label: 'Reports', icon: BarChart3, moduleId: ModuleId.ANALYTICS },
        { section: 'Data', id: 'master', label: 'Master Data', icon: Database, moduleId: ModuleId.MASTER_DATA },
        { section: 'Config', id: 'company-settings', label: 'Settings', icon: Settings },
        { section: 'Support', id: 'support', label: 'Help', icon: LifeBuoy, moduleId: ModuleId.SUPPORT },
    ];
};
