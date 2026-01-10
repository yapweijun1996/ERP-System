import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    User,
    AccessLevel,
    ModuleId,
    Platform,
    Client,
    Company,
    ViewLevel,
    ToastType
} from '../types';
import { authApi } from '../api/auth';

// --- Toast Types ---

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

// --- App State Interface ---

interface AppState {
    // Authentication
    isAuthenticated: boolean;
    isLoading: boolean;
    currentUser: User | null;

    // Context
    accessLevel: AccessLevel;
    currentPlatform: Platform | null;
    currentClient: Client | null;
    currentCompany: Company | null;

    // Aliases for compatibility with legacy components
    activeClient: Client | null;
    activeCompany: Company | null;
    platform: Platform | null;

    // Navigation State
    viewLevel: ViewLevel;

    // Data
    users: User[];
    companies: Company[];

    // UI State
    isSidebarCollapsed: boolean;
    toggleSidebarCollapse: () => void;
    isMobileMenuOpen: boolean;
    setMobileMenuOpen: (isOpen: boolean) => void;
    performanceMode: boolean;
    togglePerformanceMode: () => void;

    // Methods
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;

    // Navigation Methods
    navigateToPlatform: () => void;
    navigateToClient: (clientId: string) => void;
    navigateToCompany: (companyId: string) => void;

    // Feature flags helpers
    hasFeature: (feature: string) => boolean;
    hasModule: (module: ModuleId) => boolean;

    // Legacy alias
    isModuleEnabled: (module: ModuleId) => boolean;

    // Toast Methods
    toasts: Toast[];
    addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

// --- Initial State ---

const initialState: AppState = {
    // Auth
    isAuthenticated: false,
    isLoading: true,
    currentUser: null,
    accessLevel: AccessLevel.GUEST,
    currentPlatform: null,
    currentClient: null,
    currentCompany: null,
    activeClient: null,
    activeCompany: null,
    platform: null,
    viewLevel: 'PLATFORM',
    users: [],
    companies: [],

    // UI
    isSidebarCollapsed: false,
    toggleSidebarCollapse: () => { },
    isMobileMenuOpen: false,
    setMobileMenuOpen: () => { },
    performanceMode: false,
    togglePerformanceMode: () => { },

    // Methods
    login: async () => false,
    logout: () => { },
    navigateToPlatform: () => { },
    navigateToClient: () => { },
    navigateToCompany: () => { },
    hasFeature: () => false,
    hasModule: () => false,
    isModuleEnabled: () => false,
    toasts: [],
    addToast: () => { },
    removeToast: () => { }
};

const AppContext = createContext<AppState>(initialState);

export const useApp = () => useContext(AppContext);

// --- Provider ---

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Context State
    const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
    const [currentClient, setCurrentClient] = useState<Client | null>(null);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [viewLevel, setViewLevel] = useState<ViewLevel>('PLATFORM');
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

    // UI State
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [performanceMode, setPerformanceMode] = useState(false);

    // Toast State
    const [toasts, setToasts] = useState<Toast[]>([]);

    // --- UI Methods ---
    const toggleSidebarCollapse = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);
    const togglePerformanceMode = useCallback(() => setPerformanceMode(prev => !prev), []);

    // --- Toast Methods ---
    const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 5000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, type, title, message, duration }]);
        if (duration > 0) {
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // --- Helper Methods ---
    const hasModule = useCallback((module: ModuleId): boolean => {
        if (!currentCompany) return false;
        return !!currentCompany.features?.[module];
    }, [currentCompany]);

    const hasFeature = useCallback((feature: string): boolean => {
        if (!currentCompany) return false;
        return !!currentCompany.features?.[feature];
    }, [currentCompany]);

    // Authorization Initialization
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                const response = await authApi.getCurrentUser();
                const { user } = response as any;
                setCurrentUser(user);
                setIsAuthenticated(true);

                const contextData = response as any;

                if (contextData.tenant) {
                    setCurrentClient({
                        ...contextData.tenant,
                        clientId: 'platform',
                        companies: []
                    } as Client);
                }

                if (contextData.company) {
                    setCurrentCompany({
                        ...contextData.company,
                        clientId: contextData.tenant?.id || 'unknown'
                    } as Company);
                }

                if (contextData.company) setViewLevel('COMPANY');
                else if (contextData.tenant) setViewLevel('CLIENT');
                else setViewLevel('PLATFORM');

            } catch (error) {
                console.error('Session restoration failed:', error);
                localStorage.removeItem('auth_token');
            } finally {
                setIsLoading(false);
            }
        };
        initAuth();
    }, []);

    // --- Auth Methods ---
    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await authApi.login({ email, password });
            localStorage.setItem('auth_token', response.token);

            const contextData = response as any;
            setCurrentUser(contextData.user);
            setIsAuthenticated(true);

            if (contextData.tenant) {
                setCurrentClient({
                    ...contextData.tenant,
                    clientId: 'platform',
                    companies: []
                } as Client);
            }

            if (contextData.company) {
                setCurrentCompany({
                    ...contextData.company,
                    clientId: contextData.tenant?.id || 'unknown'
                } as Company);
                setViewLevel('COMPANY');
            } else if (contextData.tenant) {
                setViewLevel('CLIENT');
            } else {
                setViewLevel('PLATFORM');
            }

            addToast('success', 'Welcome back!', `Logged in as ${contextData.user.name}`);
            return true;
        } catch (error) {
            console.error('Login error:', error);
            addToast('error', 'Login Failed', 'Invalid email or password');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setCurrentClient(null);
        setCurrentCompany(null);
        setViewLevel('PLATFORM');
        addToast('info', 'Logged out', 'You have been successfully logged out');
    };

    const navigateToPlatform = () => { setViewLevel('PLATFORM'); setCurrentClient(null); setCurrentCompany(null); };
    const navigateToClient = (clientId: string) => { setViewLevel('CLIENT'); setCurrentCompany(null); };
    const navigateToCompany = (companyId: string) => { setViewLevel('COMPANY'); };

    const accessLevel = currentUser?.roles?.includes('Platform Admin') ? AccessLevel.PLATFORM_ADMIN :
        currentUser?.roles?.includes('Tenant Admin') ? AccessLevel.CLIENT_ADMIN :
            AccessLevel.USER;

    const value: AppState = {
        isAuthenticated,
        isLoading,
        currentUser,
        accessLevel,
        currentPlatform,
        currentClient,
        currentCompany,
        // Legacy aliases
        activeClient: currentClient,
        activeCompany: currentCompany,
        platform: currentPlatform, // Platform might be null if not loaded
        viewLevel,
        users,
        companies,
        // UI
        isSidebarCollapsed,
        toggleSidebarCollapse,
        isMobileMenuOpen,
        setMobileMenuOpen,
        performanceMode,
        togglePerformanceMode,
        // Methods
        login,
        logout,
        navigateToPlatform,
        navigateToClient,
        navigateToCompany,
        hasFeature,
        hasModule,
        isModuleEnabled: hasModule, // Alias
        toasts,
        addToast,
        removeToast
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
