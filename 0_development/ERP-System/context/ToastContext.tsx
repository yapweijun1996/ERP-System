import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastType } from '../types';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

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

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
