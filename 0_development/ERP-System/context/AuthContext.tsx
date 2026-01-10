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
import { useToast } from './ToastContext';

// --- Auth Context Interface ---

export interface AuthContextType {
    // Authentication
    isAuthenticated: boolean;
    isLoading: boolean;
    currentUser: User | null;

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
    logout: () => void;

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

    // Context State
    const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
    const [currentClient, setCurrentClient] = useState<Client | null>(null);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [viewLevel, setViewLevel] = useState<ViewLevel>('PLATFORM');
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

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
    }, []);

    // --- Auth Methods ---
    const login = async (username: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await authApi.login({ username, password });
            localStorage.setItem('auth_token', response.token);

            const contextData = response as any;
            setCurrentUser(contextData.user);
            setIsAuthenticated(true);

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
            addToast('error', 'Login Failed', 'Invalid username or password');
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

    const value: AuthContextType = {
        isAuthenticated,
        isLoading,
        currentUser,
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
        logout,
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
