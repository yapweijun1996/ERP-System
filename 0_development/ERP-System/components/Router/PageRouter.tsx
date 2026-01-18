
import React from 'react';
import { useApp } from '../../context/AppContext';

// Pages
import { Dashboard } from '../../pages/Dashboard';
import { CompanyHome } from '../../pages/company/CompanyHome';
import { DashboardCustomize } from '../../pages/company/DashboardCustomize';
import { FeatureActivation } from '../../pages/FeatureActivation';
import { AnalyticsDashboard } from '../../pages/analytics/AnalyticsDashboard';
import { NotificationPage } from '../../pages/common/NotificationPage';
import { NotFound } from '../../pages/common/NotFound';

// Platform Pages
import { ClientManagement } from '../../pages/platform/ClientManagement';
import { AuditLog } from '../../pages/platform/AuditLog';
import { PlatformSettings } from '../../pages/platform/PlatformSettings';
import { SystemStatus } from '../../pages/platform/SystemStatus';
import { SecurityPolicies } from '../../pages/platform/SecurityPolicies';
import { SuperAdminConsole } from '../../pages/platform/SuperAdminConsole';

// Admin Pages
import { AdminClientList } from '../../pages/admin/AdminClientList';
import { AdminClientDetail } from '../../pages/admin/AdminClientDetail';
import { AdminLogs } from '../../pages/admin/AdminLogs';
import { AdminJobs } from '../../pages/admin/AdminJobs';

// Client Pages
import { UserManagement } from '../../pages/client/UserManagement';
import { CompanyList } from '../../pages/client/CompanyList';
import { Integrations } from '../../pages/client/Integrations';
import { ClientSettings } from '../../pages/client/ClientSettings';
import { BillingList } from '../../pages/billing/BillingList';

// Company Operations Pages
import { SalesList } from '../../pages/sales/SalesList';
import { SalesDetail } from '../../pages/sales/SalesDetail';
import { InventoryList } from '../../pages/inventory/InventoryList';
import { FinanceList } from '../../pages/finance/FinanceList';
import { PurchasingList } from '../../pages/purchasing/PurchasingList';
import { PurchasingDetail } from '../../pages/purchasing/PurchasingDetail';
import { AppFinder } from '../../pages/company/AppFinder';
import { CompanySettings } from '../../pages/company/settings/CompanySettings';
import { MasterData } from '../../pages/master/MasterData';

// Tools
import { ToolsCenter } from '../../pages/tools/ToolsCenter';
import { ToolsConfiguration } from '../../pages/tools/ToolsConfiguration';

// Support / Ticket Pages
import { TicketList } from '../../pages/support/TicketList';
import { TicketDetail } from '../../pages/support/TicketDetail';

// HR Pages
import { EmployeeList } from '../../pages/hr/EmployeeList';
import { EmployeeDetail } from '../../pages/hr/EmployeeDetail';
import { RoleManagement } from '../../pages/hr/RoleManagement';

interface PageRouterProps {
  currentPage: string;
  detailId: string | null;
  onNavigate: (page: string, id?: string) => void;
}

export const PageRouter: React.FC<PageRouterProps> = ({ currentPage, detailId, onNavigate }) => {
  const { viewLevel, supportSession } = useApp();

  // Redirect to company home if in support session targeting a specific company
  if (supportSession && viewLevel === 'COMPANY' && currentPage === 'dashboard') {
    return <CompanyHome onNavigate={onNavigate} />;
  }

  switch (currentPage) {
    // --- Dashboard / Home ---
    case 'dashboard':
      if (viewLevel === 'COMPANY') return <CompanyHome onNavigate={onNavigate} />;
      if (viewLevel === 'CLIENT') return <Dashboard onNavigate={onNavigate} />;
      return <Dashboard onNavigate={onNavigate} />;

    case 'dashboard-customize': return <DashboardCustomize />;

    // --- Common ---
    case 'notifications': return <NotificationPage onNavigate={onNavigate} />;

    // --- Platform Level (Super Admin) ---
    case 'superadmin-console': return <SuperAdminConsole />;
    case 'admin-clients': return <AdminClientList onNavigate={onNavigate} />;
    case 'admin-client-detail': return <AdminClientDetail clientId={detailId || ''} onBack={() => onNavigate('admin-clients')} />;
    case 'admin-logs': return <AdminLogs />;
    case 'admin-jobs': return <AdminJobs />;

    // Legacy Platform Routes mapped to new views if needed
    case 'clients': return <ClientManagement />;
    case 'audit': return <AuditLog />;
    case 'system-status': return <SystemStatus />;
    case 'security-policies': return <SecurityPolicies />;
    case 'settings':
      if (viewLevel === 'PLATFORM') return <PlatformSettings />;
      if (viewLevel === 'CLIENT') return <ClientSettings />;
      return <RoleManagement />; // Company View fallback

    // --- Client Level ---
    case 'users': return <UserManagement />;
    case 'companies': return <CompanyList />;
    case 'integrations': return <Integrations />;
    case 'billing': return <BillingList />;
    case 'tools-config': return <ToolsConfiguration />;

    // --- Company Level (Operations) ---
    case 'apps': return <AppFinder />;
    case 'company-settings': return <CompanySettings />;

    // SALES - Granular
    case 'sales': return <SalesList onNavigate={onNavigate} />;
    case 'sales-quotes': return <SalesList onNavigate={onNavigate} viewType="QUOTES" />;
    case 'sales-orders': return <SalesList onNavigate={onNavigate} viewType="ORDERS" />;
    case 'sales-invoices': return <SalesList onNavigate={onNavigate} viewType="INVOICES" />;
    case 'sales-delivery': return <SalesList onNavigate={onNavigate} viewType="DELIVERY" />;
    case 'sales-credit-notes': return <SalesList onNavigate={onNavigate} viewType="CREDIT_NOTES" />;

    case 'sales-detail': return <SalesDetail orderId={detailId || ''} onBack={() => onNavigate('sales')} />;

    // PURCHASING - Granular
    case 'purchasing': return <PurchasingList onNavigate={onNavigate} />;
    case 'purchasing-po': return <PurchasingList onNavigate={onNavigate} viewType="PO" />;
    case 'purchasing-grn': return <PurchasingList onNavigate={onNavigate} viewType="GRN" />;
    case 'purchasing-bills': return <PurchasingList onNavigate={onNavigate} viewType="BILLS" />;

    case 'purchasing-detail': return <PurchasingDetail id={detailId || ''} onBack={() => onNavigate('purchasing')} />;

    // INVENTORY - Granular
    case 'inventory': return <InventoryList />;
    case 'inventory-stock': return <InventoryList viewType="STOCK" />;
    case 'inventory-moves': return <InventoryList viewType="MOVES" />;
    case 'inventory-adjust': return <InventoryList viewType="ADJUST" />;

    case 'finance': return <FinanceList />;
    case 'features': return <FeatureActivation />;

    // --- Tools ---
    case 'tools-center': return <ToolsCenter initialToolId={detailId} />;

    // --- SUPPORT ---
    case 'support': return <TicketList onNavigate={onNavigate} />;
    case 'ticket-detail': return <TicketDetail id={detailId || ''} onBack={() => onNavigate('support')} />;

    // Master Data specific routes or general
    case 'master': return <MasterData />;
    case 'master-customers': return <MasterData initialTab="customers" />;
    case 'master-suppliers': return <MasterData initialTab="suppliers" />;
    case 'master-items': return <MasterData initialTab="items" />;
    case 'master-warehouses': return <MasterData initialTab="warehouses" />;

    case 'analytics': return <AnalyticsDashboard />;

    // --- HR & Org ---
    case 'employees': return <EmployeeList onNavigate={onNavigate} />;
    case 'employee-detail': return <EmployeeDetail empId={detailId || ''} onBack={() => onNavigate('employees')} />;
    case 'roles': return <RoleManagement />;

    default: return <NotFound onNavigate={onNavigate} />;
  }
};
