
import { useState, useCallback, useEffect } from 'react';
import { ToastMessage, ToastType, WorkspaceType } from '../../types';
import { Theme } from '../AppTypes';

export const useUI = () => {
  // --- THEME ---
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('theme') as Theme) || 'light';
    return 'light';
  });

  // --- PERFORMANCE MODE ---
  const [performanceMode, setPerformanceMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('perf_mode') === 'true';
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(prev => prev === 'light' ? 'dark' : 'light'), []);

  const togglePerformanceMode = useCallback(() => {
    setPerformanceMode(prev => {
        const next = !prev;
        localStorage.setItem('perf_mode',String(next));
        return next;
    });
  }, []);

  // --- UI STATE ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleSidebarCollapse = useCallback(() => setIsSidebarCollapsed(p => !p), []);
  
  // --- TOASTS ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  
  const addToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  // --- WORKSPACE ---
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceType>('EXECUTIVE');

  return {
    theme, toggleTheme,
    performanceMode, togglePerformanceMode,
    isSidebarCollapsed, toggleSidebarCollapse,
    isMobileMenuOpen, setMobileMenuOpen,
    toasts, addToast, removeToast,
    currentWorkspace, setCurrentWorkspace
  };
};
