import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import i18n from '../config/i18n';

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
    language: string;
    setLanguage: (lang: string) => void;
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
    const [language, setLanguageState] = useState(i18n.language || 'en');
    const [users, setUsers] = useState<any[]>([]); // Mock users for switching

    const toggleSidebarCollapse = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);
    const togglePerformanceMode = useCallback(() => setPerformanceMode(prev => !prev), []);
    const toggleTheme = useCallback(() => setTheme(prev => prev === 'light' ? 'dark' : 'light'), []);

    const setLanguage = useCallback((lang: string) => {
        i18n.changeLanguage(lang);
        setLanguageState(lang);
    }, []);

    // Sync with i18next changes if they happen outside
    useEffect(() => {
        const handleLangChange = (lang: string) => setLanguageState(lang);
        i18n.on('languageChanged', handleLangChange);
        return () => {
            i18n.off('languageChanged', handleLangChange);
        };
    }, []);

    React.useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const switchUser = useCallback((userId: string) => {
        console.log('Switch user:', userId);
    }, []);

    // Mock dashboard with empty widgets
    const dashboard = {
        layout: {
            widgets: []
        }
    };

    // Language wrapper (implementation will be handled by components using useTranslation, but exposing state here for global control if needed)
    // For now we rely on i18next internal state but could sync here. 
    // Let's just follow the request to implement infrastructure.

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
            language,
            setLanguage,
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
