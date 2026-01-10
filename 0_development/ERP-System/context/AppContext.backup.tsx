
import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { ViewLevel, Client, Company, ModuleId, SalesDocument, RunningNumberConfig, Employee, Role, Permission, User, SupportSession, CalculationHistoryItem, MiniTool, SystemLog } from '../types';
import { DEFAULT_FEATURES, MOCK_TOOL_CATALOG } from '../constants';
import { generateNextIdString } from '../utils/salesUtils';
import { seedUsersIfEmpty, getAllUsers, saveUser } from '../storage/db';
import { AppContextType } from './AppTypes';
import { useUI } from './hooks/useUI';
import { useDataState } from './hooks/useDataState';
import { useDashboard } from './hooks/useDashboard';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- HOOKS ---
  const ui = useUI();
  const data = useDataState();

  // --- USERS & AUTH ---
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [supportSession, setSupportSession] = useState<SupportSession | null>(null);

  // --- HIERARCHY STATE ---
  const [viewLevel, setViewLevel] = useState<ViewLevel>('COMPANY');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const activeClient = useMemo(() => data.platformData.clients.find(c => c.id === selectedClientId) || null, [data.platformData.clients, selectedClientId]);
  const activeCompany = useMemo(() => activeClient?.companies.find(c => c.id === selectedCompanyId) || null, [activeClient, selectedCompanyId]);

  const availableCompanies = useMemo(() => {
     if (!activeClient || !currentUser) return [];
     const userRoles = data.roles.filter(r => currentUser.roles.includes(r.id));
     const isSystemAdmin = userRoles.some(r => r.id === 'ROLE_ADMIN'); 
     if (isSystemAdmin) return activeClient.companies;
     return activeClient.companies.filter(c => currentUser.allowedCompanyIds.includes(c.id));
  }, [activeClient, currentUser, data.roles]);

  // Initialize DB
  useEffect(() => {
    const initUsers = async () => {
        try {
            const loaded = await seedUsersIfEmpty();
            setUsers(loaded);
            const storedId = localStorage.getItem('session_uid');
            if (storedId) {
                const found = loaded.find(u => u.id === storedId);
                if (found) {
                    setCurrentUser(found);
                    setIsAuthenticated(true);
                    
                    // Restore correct context based on role
                    if (found.roles.includes('ROLE_PLATFORM_ADMIN')) {
                        setViewLevel('PLATFORM');
                        setSelectedClientId(null);
                        setSelectedCompanyId(null);
                    } else {
                        setSelectedClientId(found.clientId);
                        setSelectedCompanyId(found.defaultCompanyId || (found.allowedCompanyIds.length > 0 ? found.allowedCompanyIds[0] : null));
                        setViewLevel(found.clientId ? 'COMPANY' : 'PLATFORM'); // Fallback logic
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load users", err);
        }
    };
    initUsers();
  }, []);

  const login = useCallback(async (email: string, pass: string): Promise<boolean> => {
      const currentUsers = await getAllUsers();
      setUsers(currentUsers);
      const user = currentUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user && (user.password === pass || !user.password)) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          localStorage.setItem('session_uid', user.id);
          
          // Role-based routing
          if (user.roles.includes('ROLE_PLATFORM_ADMIN')) {
              setViewLevel('PLATFORM');
              setSelectedClientId(null);
              setSelectedCompanyId(null);
          } else {
              setSelectedClientId(user.clientId);
              setSelectedCompanyId(user.defaultCompanyId || (user.allowedCompanyIds.length > 0 ? user.allowedCompanyIds[0] : null));
              setViewLevel(user.defaultCompanyId ? 'COMPANY' : 'CLIENT');
          }
          return true;
      }
      return false;
  }, []);

  const logout = useCallback(() => {
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('session_uid');
      setSupportSession(null);
  }, []);

  const register = useCallback(async (newUser: User) => {
      await saveUser(newUser);
      setUsers(prev => [...prev, newUser]);
      await login(newUser.email, newUser.password || '');
  }, [login]);

  const registerClient = useCallback(async (user: User, clientName: string) => {
      const newClientId = `client-${Date.now()}`;
      const newClient: Client = {
          id: newClientId, name: clientName, status: 'Onboarding',
          features: { ...DEFAULT_FEATURES, [ModuleId.SALES]: true }, companies: []
      };
      data.setPlatformData(prev => ({ ...prev, clients: [...prev.clients, newClient] }));
      const userWithClient: User = { ...user, clientId: newClientId, allowedCompanyIds: [] };
      await saveUser(userWithClient);
      setUsers(prev => [...prev, userWithClient]);
      setCurrentUser(userWithClient);
      setIsAuthenticated(true);
      setSelectedClientId(newClientId);
      localStorage.setItem('session_uid', userWithClient.id);
  }, [data.setPlatformData]);

  // SUPER ADMIN ACTION
  const createClient = useCallback(async (clientData: Partial<Client>, adminEmail: string) => {
      const newClientId = `C-${Date.now().toString().slice(-6)}`;
      const newClient: Client = {
          id: newClientId,
          name: clientData.name || 'New Client',
          status: 'Active',
          features: clientData.features || DEFAULT_FEATURES,
          companies: []
      };

      // Add to platform data
      data.setPlatformData(prev => ({ ...prev, clients: [...prev.clients, newClient] }));

      // Create Admin User for this client
      const newAdminUser: User = {
          id: `u-${Date.now()}`,
          name: 'Tenant Admin',
          email: adminEmail,
          password: 'password', // Default
          status: 'Active',
          lastLogin: 'Never',
          clientId: newClientId,
          allowedCompanyIds: [],
          roles: ['ROLE_ADMIN']
      };
      await saveUser(newAdminUser);
      setUsers(prev => [...prev, newAdminUser]);

      // Audit Log
      const auditLog: SystemLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          module: 'PLATFORM',
          message: `Created new client tenant: ${newClient.name} (${newClientId})`,
          traceId: `req-${Date.now()}`,
          clientId: 'platform'
      };
      
      ui.addToast('Client Created', `Tenant ${newClient.name} is now active.`, 'success');
  }, [data.setPlatformData, ui.addToast]);

  const completeOnboarding = useCallback((clientId: string, companyData: Partial<Company>) => {
      const newCompanyId = `comp-${Date.now()}`;
      const newCompany: Company = {
          id: newCompanyId, name: companyData.name || 'My Company', clientId: clientId,
          currency: companyData.currency || 'USD', country: companyData.country || 'USA',
          timezone: companyData.timezone || 'UTC', status: 'Active',
          features: { ...DEFAULT_FEATURES, ...(companyData.features || {}) }
      };
      data.setPlatformData(prev => ({ ...prev, clients: prev.clients.map(c => c.id === clientId ? { ...c, status: 'Active', companies: [newCompany] } : c) }));
      if (currentUser) {
          const updatedUser = { ...currentUser, status: 'Active' as const, allowedCompanyIds: [newCompanyId], defaultCompanyId: newCompanyId };
          saveUser(updatedUser).then(() => {
            setCurrentUser(updatedUser);
            setSelectedCompanyId(newCompanyId);
            setViewLevel('COMPANY');
          });
      }
  }, [currentUser, data.setPlatformData]);

  const switchUser = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setCurrentUser(user);
    if (user.roles.includes('ROLE_PLATFORM_ADMIN')) {
        setSelectedClientId(null);
        setSelectedCompanyId(null);
        setViewLevel('PLATFORM');
    } else {
        setSelectedClientId(user.clientId);
        setSelectedCompanyId(user.defaultCompanyId && user.allowedCompanyIds.includes(user.defaultCompanyId) ? user.defaultCompanyId : (user.allowedCompanyIds[0] || null));
        setViewLevel('COMPANY');
    }
  }, [users]);

  // --- PERMISSIONS & SUPPORT ---
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (supportSession?.isReadOnly && (permission.includes('_CREATE') || permission.includes('_EDIT') || permission.includes('_POST') || permission.includes('_ADJUST'))) return false;
    if (!currentUser || !currentUser.roles) return false;
    
    // Platform admin has all permissions implicitly or strictly scoped
    if (currentUser.roles.includes('ROLE_PLATFORM_ADMIN')) return true;

    const userPermissions = new Set<string>();
    currentUser.roles.forEach(roleId => {
      const role = data.roles.find(r => r.id === roleId);
      if (role) role.permissions.forEach(p => userPermissions.add(p));
    });
    return userPermissions.has(permission);
  }, [currentUser, data.roles, supportSession]);

  const startSupportSession = useCallback((clientId: string, companyId?: string) => {
      if (!currentUser) return;
      setSupportSession({
          isActive: true, originalUser: currentUser, targetClientId: clientId, targetCompanyId: companyId,
          startTime: new Date().toISOString(), expiryTime: new Date(Date.now() + 30 * 60000).toISOString(), isReadOnly: true
      });
      setSelectedClientId(clientId);
      if (companyId) { setSelectedCompanyId(companyId); setViewLevel('COMPANY'); } else { setViewLevel('CLIENT'); }
      ui.addToast('Support Session Started', 'You are now in read-only debug mode.', 'warning');
  }, [currentUser, ui.addToast]);

  const endSupportSession = useCallback(() => {
      if (!supportSession) return;
      setSupportSession(null);
      setSelectedClientId(null); setSelectedCompanyId(null); 
      // Return to platform view
      setViewLevel('PLATFORM');
      ui.addToast('Session Ended', 'Returned to Platform Console.', 'info');
  }, [supportSession, ui.addToast]);

  // --- DATA FILTERING & ACTIONS ---
  const filterByContext = useCallback(<T extends { clientId: string, companyId?: string }>(items: T[]): T[] => {
      if (viewLevel === 'PLATFORM' && !supportSession) return items; // Platform sees all in lists generally, or we filter in UI
      if (viewLevel === 'CLIENT') return items.filter(d => d.clientId === activeClient?.id);
      return items.filter(d => d.companyId === activeCompany?.id);
  }, [viewLevel, activeClient?.id, activeCompany?.id, supportSession]);

  const getPreviewId = useCallback((configId: string): string => {
    const config = data.allRunningNumbers.find(c => c.id === configId);
    return config ? generateNextIdString(config) : 'UNKNOWN';
  }, [data.allRunningNumbers]);

  const postDocument = useCallback(async (doc: SalesDocument, configId?: string): Promise<SalesDocument> => {
      return new Promise((resolve, reject) => {
          if (!activeCompany || !activeClient) { reject(new Error("No active company context")); return; }
          setTimeout(() => {
              data.setAllRunningNumbers(prev => {
                  let configIndex = -1;
                  const companyConfigs = prev.filter(c => c.companyId === activeCompany.id);
                  if (configId) configIndex = prev.findIndex(c => c.id === configId);
                  else {
                      const def = companyConfigs.find(c => c.docType === doc.type && c.isDefault) || companyConfigs.find(c => c.docType === doc.type);
                      if (def) configIndex = prev.findIndex(c => c.id === def.id);
                  }
                  if (configIndex === -1) { reject(new Error(`No running number configuration found for ${doc.type}`)); return prev; }
                  const currentConfig = prev[configIndex];
                  const finalId = generateNextIdString(currentConfig);
                  const newConfigs = [...prev];
                  newConfigs[configIndex] = { ...currentConfig, nextSequence: currentConfig.nextSequence + 1 };
                  const postedDoc = { ...doc, id: finalId, seriesId: currentConfig.id, status: 'Posted', clientId: activeClient.id, companyId: activeCompany.id } as SalesDocument;
                  data.setAllSalesDocs(prevDocs => [...prevDocs.filter(d => d.id !== doc.id), postedDoc]);
                  resolve(postedDoc);
                  return newConfigs;
              });
          }, 400);
      });
  }, [activeCompany, activeClient, data.setAllRunningNumbers, data.setAllSalesDocs]);

  const updateDocument = useCallback((doc: SalesDocument) => {
      const contextualDoc = { ...doc, clientId: doc.clientId || activeClient?.id || '', companyId: doc.companyId || activeCompany?.id || '' };
      data.setAllSalesDocs(prev => prev.some(d => d.id === doc.id) ? prev.map(d => d.id === doc.id ? contextualDoc : d) : [...prev, contextualDoc]);
  }, [activeClient?.id, activeCompany?.id, data.setAllSalesDocs]);

  const updateRunningNumberConfig = useCallback((newConfig: RunningNumberConfig) => {
      data.setAllRunningNumbers(prev => {
          if (newConfig.isDefault) {
              return prev.map(c => (c.companyId === newConfig.companyId && c.docType === newConfig.docType && c.id !== newConfig.id) ? { ...c, isDefault: false } : (c.id === newConfig.id ? newConfig : c));
          }
          return prev.map(c => c.id === newConfig.id ? newConfig : c);
      });
      ui.addToast('Configuration Saved', `${newConfig.name} updated.`, 'success');
  }, [ui.addToast, data.setAllRunningNumbers]);

  const addRunningNumberConfig = useCallback((config: RunningNumberConfig) => {
      if (!activeClient || !activeCompany) return;
      const contextualConfig = { ...config, clientId: activeClient.id, companyId: activeCompany.id };
      data.setAllRunningNumbers(prev => {
          const newConfigs = contextualConfig.isDefault ? prev.map(c => (c.companyId === contextualConfig.companyId && c.docType === contextualConfig.docType) ? { ...c, isDefault: false } : c) : [...prev];
          return [...newConfigs, contextualConfig];
      });
      ui.addToast('Rule Added', `${config.name} created.`, 'success');
  }, [activeClient, activeCompany, ui.addToast, data.setAllRunningNumbers]);

  const deleteRunningNumberConfig = useCallback((id: string) => {
      data.setAllRunningNumbers(prev => prev.filter(c => c.id !== id));
      ui.addToast('Rule Deleted', 'Configuration removed.', 'info');
  }, [ui.addToast, data.setAllRunningNumbers]);

  const updateCompany = useCallback((company: Company) => {
      data.setPlatformData(prev => ({ ...prev, clients: prev.clients.map(c => c.id === company.clientId ? { ...c, companies: c.companies.map(comp => comp.id === company.id ? company : comp) } : c) }));
  }, [data.setPlatformData]);

  const isModuleEnabled = useCallback((moduleId: ModuleId): boolean => {
    if (!data.platformData.features[moduleId]) return false;
    if (viewLevel !== 'PLATFORM') { if (!activeClient || !activeClient.features[moduleId]) return false; }
    if (viewLevel === 'COMPANY') { if (!activeCompany || !activeCompany.features[moduleId]) return false; }
    return true;
  }, [data.platformData, viewLevel, activeClient, activeCompany]);

  const toggleFeature = useCallback((scope: ViewLevel, entityId: string, moduleId: ModuleId) => {
    data.setPlatformData(prev => {
      const next = { ...prev };
      if (scope === 'PLATFORM') next.features = { ...next.features, [moduleId]: !next.features[moduleId] };
      else if (scope === 'CLIENT') {
        const cIdx = next.clients.findIndex(c => c.id === entityId);
        if (cIdx > -1) next.clients[cIdx].features = { ...next.clients[cIdx].features, [moduleId]: !next.clients[cIdx].features[moduleId] };
      } else if (scope === 'COMPANY') {
        next.clients = next.clients.map(client => {
          const cIdx = client.companies.findIndex(c => c.id === entityId);
          if (cIdx > -1) {
             const updated = [...client.companies];
             updated[cIdx] = { ...updated[cIdx], features: { ...updated[cIdx].features, [moduleId]: !updated[cIdx].features[moduleId] } };
             return { ...client, companies: updated };
          }
          return client;
        });
      }
      return next;
    });
  }, [data.setPlatformData]);

  const notificationAction = useCallback((id: string, action: string) => {
      const notif = data.allNotifications.find(n => n.id === id);
      if (!notif) return;
      if (action === 'APPROVE') { ui.addToast('Task Approved', `${notif.entityType} ${notif.entityId} has been approved.`, 'success'); data.setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'ARCHIVED' } : n)); }
      else if (action === 'REJECT') { ui.addToast('Task Rejected', `${notif.entityType} ${notif.entityId} returned to draft.`, 'warning'); data.setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'ARCHIVED' } : n)); }
      else if (action === 'SNOOZE') { ui.addToast('Snoozed', 'Notification hidden for 24 hours.', 'info'); data.setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'ARCHIVED' } : n)); }
      else if (action === 'ACKNOWLEDGE') { data.setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'READ' } : n)); }
  }, [data.allNotifications, ui.addToast, data.setAllNotifications]);

  // --- TOOL LOGIC ---
  const toggleToolEnabled = useCallback((scope: 'CLIENT' | 'COMPANY', entityId: string, toolId: string) => {
      if (scope === 'CLIENT') {
          data.setClientToolConfigs(prev => {
              const current = prev[entityId]?.enabledToolIds || [];
              const newIds = current.includes(toolId) ? current.filter(id => id !== toolId) : [...current, toolId];
              return { ...prev, [entityId]: { ...prev[entityId], enabledToolIds: newIds } };
          });
      } else {
          data.setCompanyToolConfigs(prev => {
              const current = prev[entityId]?.enabledToolIds || [];
              const newIds = current.includes(toolId) ? current.filter(id => id !== toolId) : [...current, toolId];
              return { ...prev, [entityId]: { ...prev[entityId], enabledToolIds: newIds } };
          });
      }
  }, [data.setClientToolConfigs, data.setCompanyToolConfigs]);

  const toggleToolPin = useCallback((companyId: string, toolId: string) => {
      data.setCompanyToolConfigs(prev => {
          const current = prev[companyId]?.pinnedToolIds || [];
          const newIds = current.includes(toolId) ? current.filter(id => id !== toolId) : [...current, toolId];
          return { ...prev, [companyId]: { ...prev[companyId], pinnedToolIds: newIds } };
      });
      const isPinned = data.companyToolConfigs[companyId]?.pinnedToolIds.includes(toolId);
      ui.addToast(isPinned ? 'Tool Unpinned' : 'Tool Pinned', 'Dashboard updated', 'info');
  }, [data.companyToolConfigs, data.setCompanyToolConfigs, ui.addToast]);

  const getEnabledTools = useCallback((companyId: string): MiniTool[] => {
      // 1. Get Company -> Client
      const comp = availableCompanies.find(c => c.id === companyId);
      if (!comp) return [];
      const clientId = comp.clientId;

      // 2. Get Configs
      const clientEnabled = data.clientToolConfigs[clientId]?.enabledToolIds || [];
      const companyEnabled = data.companyToolConfigs[companyId]?.enabledToolIds || [];

      // 3. Filter Platform Catalog
      return MOCK_TOOL_CATALOG.filter(tool => {
          // Inheritance check: Must be enabled at Client AND Company level
          return clientEnabled.includes(tool.id) && companyEnabled.includes(tool.id);
      });
  }, [availableCompanies, data.clientToolConfigs, data.companyToolConfigs]);

  const addToolHistory = useCallback((item: CalculationHistoryItem) => {
      data.setToolHistory(prev => [item, ...prev].slice(0, 50)); // Keep last 50
  }, [data.setToolHistory]);

  // --- DASHBOARD LOGIC ---
  const dashboard = useDashboard(currentUser, activeCompany, isModuleEnabled, hasPermission);

  const value: AppContextType = useMemo(() => ({
    ...ui,
    isAuthenticated, login, logout, register, registerClient, completeOnboarding, createClient,
    viewLevel, setViewLevel, platform: data.platformData, selectedClientId, setSelectedClientId, selectedCompanyId, setSelectedCompanyId,
    activeClient, activeCompany, currentUser: currentUser!, switchUser, hasPermission, availableCompanies,
    supportSession, startSupportSession, endSupportSession, systemLogs: data.systemLogs, backgroundJobs: data.backgroundJobs,
    isModuleEnabled, toggleFeature,
    salesDocuments: filterByContext(data.allSalesDocs), inventory: filterByContext(data.allInventory),
    customers: filterByContext(data.allCustomers), suppliers: filterByContext(data.allSuppliers),
    financeTransactions: filterByContext(data.allFinance), warehouses: filterByContext(data.allWarehouses),
    employees: filterByContext(data.allEmployees), departments: filterByContext(data.allDepartments),
    runningNumberConfigs: filterByContext(data.allRunningNumbers), taxCodes: filterByContext(data.allTaxCodes),
    postDocument, updateDocument, updateRunningNumberConfig, addRunningNumberConfig, deleteRunningNumberConfig, getPreviewId,
    roles: data.roles, updateEmployee: (emp) => data.setAllEmployees(prev => prev.map(e => e.id === emp.id ? emp : e)),
    updateRole: (role) => data.setRoles(prev => prev.map(r => r.id === role.id ? role : r)),
    addRole: (role) => data.setRoles(prev => [...prev, role]), users,
    notifications: filterByContext(data.allNotifications),
    markNotificationAsRead: (id) => data.setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'READ' } : n)),
    archiveNotification: (id) => data.setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'ARCHIVED' } : n)),
    notificationAction, updateCompany,
    // Tools
    availableTools: MOCK_TOOL_CATALOG,
    clientToolConfigs: data.clientToolConfigs,
    companyToolConfigs: data.companyToolConfigs,
    toggleToolEnabled, toggleToolPin, getEnabledTools,
    toolHistory: data.toolHistory, addToolHistory,
    // Dashboard
    dashboard: {
      layout: dashboard.effectiveLayout,
      availableWidgets: dashboard.availableWidgets,
      updateLayout: dashboard.updateLayout,
      resetLayout: dashboard.resetLayout,
      canCustomize: dashboard.canCustomize
    }
  }), [
    ui, isAuthenticated, currentUser, viewLevel, data, selectedClientId, selectedCompanyId, activeClient, activeCompany,
    supportSession, isModuleEnabled, toggleFeature, filterByContext, postDocument, updateDocument, updateRunningNumberConfig,
    addRunningNumberConfig, deleteRunningNumberConfig, getPreviewId, users, notificationAction, updateCompany, registerClient, 
    completeOnboarding, createClient, toggleToolEnabled, toggleToolPin, getEnabledTools, addToolHistory, dashboard
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
