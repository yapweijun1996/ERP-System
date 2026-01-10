import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UIContextType {
    isSidebarCollapsed: boolean;
    toggleSidebarCollapse: () => void;
    isMobileMenuOpen: boolean;
    setMobileMenuOpen: (isOpen: boolean) => void;
    performanceMode: boolean;
    togglePerformanceMode: () => void;
    notifications: any[];
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    dashboard: {
        layout: {
            widgets: any[];
        };
    };
    switchUser?: (userId: string) => void;
    users?: any[];
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [performanceMode, setPerformanceMode] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]); // Mock notifications
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [users, setUsers] = useState<any[]>([]); // Mock users for switching

    const toggleSidebarCollapse = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);
    const togglePerformanceMode = useCallback(() => setPerformanceMode(prev => !prev), []);
    const toggleTheme = useCallback(() => setTheme(prev => prev === 'light' ? 'dark' : 'light'), []);

    const switchUser = useCallback((userId: string) => {
        console.log('Switch user:', userId);
    }, []);

    // Mock dashboard with empty widgets
    const dashboard = {
        layout: {
            widgets: []
        }
    };

    return (
        <UIContext.Provider value={{
            isSidebarCollapsed,
            toggleSidebarCollapse,
            isMobileMenuOpen,
            setMobileMenuOpen,
            performanceMode,
            togglePerformanceMode,
            notifications,
            theme,
            toggleTheme,
            dashboard,
            switchUser,
            users
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
};
