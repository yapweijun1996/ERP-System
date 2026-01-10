import React, { useState, useEffect } from 'react';
import { DatabaseSetupWizard } from './DatabaseSetupWizard';

interface DatabaseSetupGuardProps {
    children: React.ReactNode;
}

export const DatabaseSetupGuard: React.FC<DatabaseSetupGuardProps> = ({ children }) => {
    const [dbSetupNeeded, setDbSetupNeeded] = useState<boolean | null>(null);

    useEffect(() => {
        const checkDatabaseSetup = async () => {
            try {
                const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
                const response = await fetch(`${API_URL}/api/setup/status`);
                const data = await response.json();

                // If database is ready, no setup needed
                setDbSetupNeeded(data.status !== 'ready');
            } catch (error) {
                // If backend is not running, show setup wizard
                console.error('Failed to check database status:', error);
                setDbSetupNeeded(true);
            }
        };

        checkDatabaseSetup();
    }, []);

    // Show loading while checking database status
    if (dbSetupNeeded === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">正在启动...</p>
                </div>
            </div>
        );
    }

    // Show database setup wizard if needed
    if (dbSetupNeeded) {
        return <DatabaseSetupWizard onComplete={() => setDbSetupNeeded(false)} />;
    }

    // Database is ready, show the app
    return <>{children}</>;
};
