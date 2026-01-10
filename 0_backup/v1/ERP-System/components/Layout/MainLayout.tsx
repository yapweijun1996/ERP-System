
import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { TopBar } from './TopBar';
import { CommandPalette } from '../UI/CommandPalette';
import { ToastContainer } from '../UI/Toast';
import { OfflineIndicator } from '../UI/OfflineIndicator';
import { TopBarSupportBanner } from './TopBarSupportBanner';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string, id?: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pages that control their own container/padding (Data Grids, Dashboards, Tools)
  const fullPageRoutes = [
      'dashboard', 'dashboard-customize', 'company-settings', 'tools-center',
      'sales', 'inventory', 'finance', 'purchasing', 'billing', 
      'master', 'employees', 'roles', 'support', 
      'users', 'admin-clients', 'admin-logs', 'admin-jobs', 'audit'
  ];

  const isFullPage = fullPageRoutes.some(route => 
      currentPage === route || currentPage.startsWith(route + '-')
  ) || currentPage.includes('detail');

  return (
    // Root container
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-200 font-sans">
      
      {/* Global Banner pushes everything down equally */}
      <TopBarSupportBanner />

      <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar (Desktop) */}
          <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full relative">
            <TopBar onOpenCommandPalette={() => setCommandPaletteOpen(true)} onNavigate={onNavigate} />
            
            {/* Scrollable Page Content */}
            <main className="flex-1 overflow-y-auto p-0 scroll-smooth custom-scrollbar bg-slate-50 dark:bg-slate-950">
                <div className={`
                    ${isFullPage ? 'h-full flex flex-col' : 'min-h-full p-4 md:p-8'} 
                    animate-in fade-in duration-300
                `}>
                    {children}
                </div>
            </main>
            
            {/* Mobile Navigation (Bottom) */}
            <MobileNav currentPage={currentPage} onNavigate={onNavigate} />
            
            {/* Global Overlays */}
            <CommandPalette 
              isOpen={isCommandPaletteOpen} 
              onClose={() => setCommandPaletteOpen(false)} 
              onNavigate={onNavigate} 
            />
            <ToastContainer />
            <OfflineIndicator />
          </div>
      </div>
    </div>
  );
};
