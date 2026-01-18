import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    User,
    AccessLevel,
    ModuleId,
    Platform,
    Client,
    Company,
    ViewLevel
} from '../types';
import { authApi } from '../api/auth';
import { superadminApi } from '../api/superadmin';
import { useToast } from './ToastContext';

// --- Auth Context Interface ---

export interface AuthContextType {
    // Authentication
    isAuthenticated: boolean;
    isLoading: boolean;
    currentUser: User | null;
    isSuperadmin: boolean;

    // Context
    accessLevel: AccessLevel;
    currentPlatform: Platform | null;
    currentClient: Client | null;
    currentCompany: Company | null;

    // Aliases (for backward compatibility, though mainly handled by aggregator)
    activeClient: Client | null;
    activeCompany: Company | null;
    platform: Platform | null;

    // Navigation State
    viewLevel: ViewLevel;

    // Data (Consider moving these to separate DataContext later)
    users: User[];
    companies: Company[];

    // Methods
    login: (username: string, password: string) => Promise<boolean>;
    loginSuperadmin: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    completeOnboarding: (clientId: string, companyData: Partial<Company>) => void;

    // Navigation Methods
    navigateToPlatform: () => void;
    navigateToClient: (clientId: string) => void;
    navigateToCompany: (companyId: string) => void;

    // Feature flags helpers
    hasFeature: (feature: string) => boolean;
    hasModule: (module: ModuleId) => boolean;

    // Alias
    isModuleEnabled: (module: ModuleId) => boolean;
    availableCompanies: Company[]; // Alias for companies
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast(); // Use toast inside Auth

    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSuperadmin, setIsSuperadmin] = useState(false);

    // Context State
    const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
    const [currentClient, setCurrentClient] = useState<Client | null>(null);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [viewLevel, setViewLevel] = useState<ViewLevel>('PLATFORM');
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

    const getCookie = useCallback((name: string) => {
        try {
            if (typeof document === 'undefined') return null;
            const parts = document.cookie.split(';').map(p => p.trim());
            for (const p of parts) {
                if (!p) continue;
                const idx = p.indexOf('=');
                if (idx <= 0) continue;
                const k = p.slice(0, idx).trim();
                const v = p.slice(idx + 1).trim();
                if (k === name) return decodeURIComponent(v);
            }
            return null;
        } catch {
            return null;
        }
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
            try {
                const token = localStorage.getItem('auth_token');
                const hasCsrfCookie = !!getCookie('csrf_token');
                if (!token && !hasCsrfCookie) {
                    setIsLoading(false);
                    return;
                }

                let contextData: any = null;
                try {
                    contextData = await superadminApi.me();
                } catch {
                    contextData = await authApi.getCurrentUser();
                }

                const { user } = contextData as any;
                setCurrentUser(user);
                setIsAuthenticated(true);
                setIsSuperadmin(!!contextData?.superadmin);

                // Set available companies
                if (contextData.companies) {
                    setCompanies(contextData.companies);
                }

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
    }, [getCookie]);

    // --- Auth Methods ---
    const login = async (username: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await authApi.login({ username, password });
            if (response?.token) localStorage.setItem('auth_token', response.token);
            else localStorage.removeItem('auth_token');

            const contextData = response as any;
            setCurrentUser(contextData.user);
            setIsAuthenticated(true);
            setIsSuperadmin(false);

            // Set available companies
            if (contextData.companies) {
                setCompanies(contextData.companies);
            }

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
            const message = error instanceof Error ? error.message : 'Login failed';
            addToast('error', 'Login Failed', message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const loginSuperadmin = async (username: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await superadminApi.login({ username, password });
            if (response?.token) localStorage.setItem('auth_token', response.token);
            else localStorage.removeItem('auth_token');

            const contextData = response as any;
            setCurrentUser(contextData.user);
            setIsAuthenticated(true);
            setIsSuperadmin(true);
            setCurrentClient(null);
            setCurrentCompany(null);
            setCompanies([]);
            setViewLevel('PLATFORM');

            addToast('success', 'Welcome back!', `Logged in as ${contextData.user.name}`);
            return true;
        } catch (error) {
            console.error('Superadmin login error:', error);
            const message = error instanceof Error ? error.message : 'Login failed';
            addToast('error', 'Login Failed', message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const completeOnboarding = (clientId: string, companyData: Partial<Company>) => {
        if (!currentClient || currentClient.id !== clientId) {
            addToast('error', 'Onboarding Failed', 'Client not found in current session');
            return;
        }

        const newCompany: Company = {
            id: `comp-${Date.now()}`,
            clientId,
            name: companyData.name || 'My Company',
            currency: companyData.currency || 'USD',
            timezone: companyData.timezone || 'UTC',
            country: companyData.country || 'USA',
            status: 'Active',
            features: (companyData.features as any) || {},
        };

        setCurrentClient({
            ...currentClient,
            status: 'Active',
            companies: [newCompany],
        } as Client);
        setCurrentCompany(newCompany);
        setViewLevel('COMPANY');

        if (currentUser) {
            setCurrentUser({
                ...currentUser,
                status: 'Active',
                allowedCompanyIds: Array.from(new Set([...(currentUser.allowedCompanyIds || []), newCompany.id])),
                defaultCompanyId: newCompany.id,
            } as User);
        }

        addToast('success', 'Onboarding Completed', 'Workspace is now active');
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsSuperadmin(false);
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

    const value: AuthContextType = {
        isAuthenticated,
        isLoading,
        currentUser,
        isSuperadmin,
        accessLevel,
        currentPlatform,
        currentClient,
        currentCompany,
        // Aliases
        activeClient: currentClient,
        activeCompany: currentCompany,
        platform: currentPlatform,
        viewLevel,
        users,
        companies,
        login,
        loginSuperadmin,
        logout,
        completeOnboarding,
        navigateToPlatform,
        navigateToClient,
        navigateToCompany,
        hasFeature,
        hasModule,
        isModuleEnabled: hasModule,
        availableCompanies: companies // Expose alias
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
