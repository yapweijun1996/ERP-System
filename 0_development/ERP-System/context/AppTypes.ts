
import { ViewLevel, Platform, Client, Company, ModuleId, WorkspaceType, ToastMessage, ToastType, SalesDocument, RunningNumberConfig, Employee, Role, Permission, User, Department, InventoryItem, TaxCode, FinanceTransaction, Customer, Supplier, Warehouse, ERPNotification, SupportSession, SystemLog, BackgroundJob, MiniTool, ToolConfig, CalculationHistoryItem, DashboardLayout, WidgetDefinition, DashboardWidget } from '../types';

export type Theme = 'light' | 'dark';

export interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  performanceMode: boolean;
  togglePerformanceMode: () => void;
  
  // --- AUTH & USERS ---
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  register: (user: User) => Promise<void>;
  registerClient: (user: User, clientName: string) => Promise<void>;
  createClient: (clientData: Partial<Client>, adminEmail: string) => Promise<void>;
  completeOnboarding: (clientId: string, companyData: Partial<Company>) => void;
  currentUser: User;
  switchUser: (userId: string) => void;
  hasPermission: (permission: Permission) => boolean;
  users: User[];

  // --- HIERARCHY STATE ---
  viewLevel: ViewLevel;
  setViewLevel: (level: ViewLevel) => void;
  platform: Platform;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  activeClient: Client | null;
  activeCompany: Company | null;
  availableCompanies: Company[];
  updateCompany: (company: Company) => void;

  // --- SUPER ADMIN ---
  supportSession: SupportSession | null;
  startSupportSession: (clientId: string, companyId?: string) => void;
  endSupportSession: () => void;
  systemLogs: SystemLog[];
  backgroundJobs: BackgroundJob[];

  // --- DATA ---
  salesDocuments: SalesDocument[];
  inventory: InventoryItem[];
  customers: Customer[];
  suppliers: Supplier[];
  financeTransactions: FinanceTransaction[];
  warehouses: Warehouse[];
  employees: Employee[];
  departments: Department[];
  
  // --- NOTIFICATIONS ---
  notifications: ERPNotification[];
  markNotificationAsRead: (id: string) => void;
  archiveNotification: (id: string) => void;
  notificationAction: (id: string, action: string) => void;

  // --- ACTIONS ---
  postDocument: (doc: SalesDocument, configId?: string) => Promise<SalesDocument>;
  updateDocument: (doc: SalesDocument) => void;
  runningNumberConfigs: RunningNumberConfig[];
  getPreviewId: (configId: string) => string;
  updateRunningNumberConfig: (config: RunningNumberConfig) => void;
  addRunningNumberConfig: (config: RunningNumberConfig) => void;
  deleteRunningNumberConfig: (id: string) => void;
  taxCodes: TaxCode[];

  // Logic
  isModuleEnabled: (moduleId: ModuleId) => boolean;
  toggleFeature: (scope: ViewLevel, entityId: string, moduleId: ModuleId) => void;

  // --- MINI TOOLS ---
  availableTools: MiniTool[];
  clientToolConfigs: Record<string, ToolConfig>; // clientId -> config
  companyToolConfigs: Record<string, ToolConfig>; // companyId -> config
  toggleToolEnabled: (scope: 'CLIENT' | 'COMPANY', entityId: string, toolId: string) => void;
  toggleToolPin: (companyId: string, toolId: string) => void;
  getEnabledTools: (companyId: string) => MiniTool[]; // Helper to get fully resolved list
  toolHistory: CalculationHistoryItem[];
  addToolHistory: (item: CalculationHistoryItem) => void;

  // --- DASHBOARD ---
  dashboard: {
    layout: DashboardLayout;
    availableWidgets: WidgetDefinition[];
    updateLayout: (widgets: DashboardWidget[]) => void;
    resetLayout: () => void;
    canCustomize: boolean;
  };

  // UI State
  currentWorkspace: WorkspaceType;
  setCurrentWorkspace: (ws: WorkspaceType) => void;
  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (isOpen: boolean) => void;
  toasts: ToastMessage[];
  addToast: (title: string, message?: string, type?: ToastType) => void;
  removeToast: (id: string) => void;

  // HR
  roles: Role[];
  updateEmployee: (emp: Employee) => void;
  updateRole: (role: Role) => void;
  addRole: (role: Role) => void;
}
