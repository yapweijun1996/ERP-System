import React from 'react';
import { ToastProvider, useToast, Toast } from './ToastContext';
import { UIProvider, useUI } from './UIContext';
import { AuthProvider, useAuth } from './AuthContext';

// Re-export types that were previously exported here or are commonly used
export type { Toast };

// --- Aggregated App Provider ---

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <ToastProvider>
            <UIProvider>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </UIProvider>
        </ToastProvider>
    );
};

// --- Unified Hook ---

export const useApp = () => {
    const auth = useAuth();
    const ui = useUI();
    const toast = useToast();

    return {
        ...auth,
        ...ui,
        ...toast,
    };
};
