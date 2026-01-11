import React, { useState, useEffect } from 'react';
import { DatabaseSetupWizard } from './DatabaseSetupWizard';
import { FirstAdminSetup } from './FirstAdminSetup';

interface DatabaseSetupGuardProps {
    children: React.ReactNode;
}

export const DatabaseSetupGuard: React.FC<DatabaseSetupGuardProps> = ({ children }) => {
    const [mode, setMode] = useState<'checking' | 'db-setup' | 'admin-setup' | 'ready'>('checking');
    const [companyId, setCompanyId] = useState<string | null>(null);

    useEffect(() => {
        const checkDatabaseSetup = async () => {
            try {
                const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:6601';
                const params = new URLSearchParams(window.location.search);
                const company = params.get('company')?.trim() || null;
                setCompanyId(company);

                if (!company) {
                    setMode('db-setup');
                    return;
                }

                const response = await fetch(
                    `${API_URL}/api/setup/db-status?company=${encodeURIComponent(company)}`,
                );
                const data = await response.json();

                if (data.status !== 'ready') {
                    setMode('db-setup');
                    return;
                }

                const userRes = await fetch(
                    `${API_URL}/api/setup/user-status?company=${encodeURIComponent(company)}`,
                );
                const userData = await userRes.json();
                const userCount = Number(userData?.userCount ?? 0);
                if (Number.isFinite(userCount) && userCount <= 0) {
                    setMode('admin-setup');
                    return;
                }

                setMode('ready');
            } catch (error) {
                // If backend is not running, show setup wizard
                console.error('Failed to check database status:', error);
                setMode('db-setup');
            }
        };

        checkDatabaseSetup();
    }, []);

    // Show loading while checking database status
    if (mode === 'checking') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">正在启动...</p>
                </div>
            </div>
        );
    }

    const handleRecheck = () => {
        setMode('checking');
        const event = new Event('recheck-db-setup');
        window.dispatchEvent(event);
        window.location.reload();
    };

    if (mode === 'admin-setup' && companyId) {
        return <FirstAdminSetup companyId={companyId} onComplete={handleRecheck} />;
    }

    if (mode === 'db-setup') {
        return (
            <DatabaseSetupWizard
                companyId={companyId}
                onComplete={handleRecheck}
            />
        );
    }

    // Database is ready, show the app
    return <>{children}</>;
};
