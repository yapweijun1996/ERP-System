
import React from 'react';
import { Search, Command, Sun, Moon, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TopBarUserMenu } from './TopBarUserMenu';

interface TopBarActionToolbarProps {
    onOpenCommandPalette: () => void;
    onToggleNotifications: () => void;
}

export const TopBarActionToolbar: React.FC<TopBarActionToolbarProps> = ({ onOpenCommandPalette, onToggleNotifications }) => {
  const { viewLevel, theme, toggleTheme, notifications } = useApp();
  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;

  return (
    <div className="flex items-center gap-1 sm:gap-2 md:gap-4 ml-auto flex-shrink-0 bg-white dark:bg-slate-900 pl-2">
        {/* Search - Desktop */}
        <div className="hidden lg:block relative">
            <button 
                onClick={onOpenCommandPalette} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white hover:border-slate-300 dark:hover:bg-slate-700 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400 text-sm transition-all group w-48 shadow-sm"
            >
                <Search className="w-3.5 h-3.5 group-hover:text-blue-500 transition-colors" />
                <span>{viewLevel === 'PLATFORM' ? 'Global Search...' : 'Search...'}</span>
                <div className="ml-auto flex items-center gap-1 opacity-60">
                    <Command className="w-3 h-3" />
                    <span className="text-[10px]">K</span>
                </div>
            </button>
        </div>

        {/* Search - Mobile Icon */}
        <button 
            onClick={onOpenCommandPalette}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Search"
        >
            <Search className="w-5 h-5" />
        </button>
        
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
        
        {/* Theme */}
        <button 
            onClick={toggleTheme} 
            className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle Theme"
        >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative">
            <button 
                onClick={onToggleNotifications}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                )}
            </button>
        </div>
        
        {/* User Menu */}
        <div className="pl-1 sm:pl-2">
            <TopBarUserMenu />
        </div>
    </div>
  );
};
