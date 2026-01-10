
import React, { useState } from 'react';
import { NotificationDrawer } from '../Notifications/NotificationDrawer';
import { TopBarBreadcrumbs } from './TopBarBreadcrumbs';
import { TopBarActionToolbar } from './TopBarActionToolbar';

interface TopBarProps {
    onOpenCommandPalette: () => void;
    onNavigate: (page: string, id?: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenCommandPalette, onNavigate }) => {
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  return (
    <>
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 h-16 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between h-full px-3 md:px-6">
        
        {/* Left Side: Mobile Menu & Breadcrumbs */}
        <TopBarBreadcrumbs />

        {/* Right Side: Actions Toolbar */}
        <TopBarActionToolbar 
            onOpenCommandPalette={onOpenCommandPalette} 
            onToggleNotifications={() => setIsNotificationDrawerOpen(true)} 
        />
      </div>
    </header>

    <NotificationDrawer 
        isOpen={isNotificationDrawerOpen} 
        onClose={() => setIsNotificationDrawerOpen(false)} 
        onNavigate={onNavigate}
        onDetailNavigate={onNavigate}
    />
    </>
  );
};
