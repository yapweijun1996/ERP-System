
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { NotificationItem } from '../../components/Notifications/NotificationItem';
import { Search, CheckCircle, AlertOctagon, Inbox, CheckCheck, ArrowDownUp, SlidersHorizontal, X } from 'lucide-react';
import { NotificationCategory, ModuleId } from '../../types';

interface NotificationPageProps {
    onNavigate: (page: string, id?: string) => void;
}

export const NotificationPage: React.FC<NotificationPageProps> = ({ onNavigate }) => {
    const { notifications, notificationAction } = useApp();
    const [activeTab, setActiveTab] = useState<'ALL' | 'TASK' | 'EXCEPTION'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'UNREAD' | 'ALL' | 'ARCHIVED'>('UNREAD');
    
    // New State for Filters & Sort
    const [sortBy, setSortBy] = useState<'DATE' | 'PRIORITY'>('DATE');
    const [filterModule, setFilterModule] = useState<string>('ALL');
    const [filterPriority, setFilterPriority] = useState<string>('ALL');
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);

    const getPriorityValue = (p: string) => {
        switch(p) {
            case 'CRITICAL': return 4;
            case 'HIGH': return 3;
            case 'MEDIUM': return 2;
            case 'LOW': return 1;
            default: return 0;
        }
    };

    const filteredItems = useMemo(() => {
        let items = notifications.filter(n => {
            // Tab Filter
            if (activeTab === 'TASK' && n.category !== 'TASK') return false;
            if (activeTab === 'EXCEPTION' && n.category !== 'EXCEPTION') return false;
            
            // Status Filter
            if (filterStatus === 'UNREAD' && n.status !== 'UNREAD') return false;
            if (filterStatus === 'ARCHIVED' && n.status !== 'ARCHIVED') return false;
            if (filterStatus === 'ALL' && n.status === 'ARCHIVED') return false; // Show active

            // Search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!n.title.toLowerCase().includes(term) && 
                    !n.message.toLowerCase().includes(term) && 
                    !n.entityId?.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // Module Filter
            if (filterModule !== 'ALL' && n.module !== filterModule) return false;

            // Priority Filter
            if (filterPriority !== 'ALL' && n.priority !== filterPriority) return false;

            return true;
        });

        // Sorting
        return items.sort((a, b) => {
            if (sortBy === 'PRIORITY') {
                const pDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority);
                if (pDiff !== 0) return pDiff;
            }
            // Default to Date DESC
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
    }, [notifications, activeTab, filterStatus, searchTerm, filterModule, filterPriority, sortBy]);

    const handleAction = (id: string, action: string) => {
        notificationAction(id, action);
    };

    const markAllRead = () => {
        filteredItems.forEach(n => {
            if (n.status === 'UNREAD') notificationAction(n.id, 'ACKNOWLEDGE');
        });
    };

    const getStats = (cat: NotificationCategory) => notifications.filter(n => n.category === cat && n.status === 'UNREAD').length;

    // Get unique modules from notifications for the dropdown
    const availableModules = useMemo(() => {
        const mods = new Set(notifications.map(n => n.module));
        return Array.from(mods);
    }, [notifications]);

    const activeFiltersCount = (filterModule !== 'ALL' ? 1 : 0) + (filterPriority !== 'ALL' ? 1 : 0);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5 sticky top-0 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Inbox
                            <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                {notifications.filter(n => n.status === 'UNREAD').length} Unread
                            </span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage tasks, alerts, and system updates.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={markAllRead}
                            className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                            <CheckCheck className="w-4 h-4 mr-2" /> Mark all read
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-6 mt-6 border-b border-slate-100 dark:border-slate-800 -mb-5">
                    {[
                        { id: 'ALL', label: 'All', icon: Inbox, count: null },
                        { id: 'TASK', label: 'Tasks', icon: CheckCircle, count: getStats('TASK') },
                        { id: 'EXCEPTION', label: 'Exceptions', icon: AlertOctagon, count: getStats('EXCEPTION') },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-4 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 ${
                                activeTab === tab.id 
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== null && tab.count > 0 && (
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 rounded-full text-xs">{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="px-6 py-4 flex flex-col gap-4">
                {/* Search & Status Row */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search notifications..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Status Toggle */}
                        <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
                            <button 
                                onClick={() => setFilterStatus('UNREAD')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterStatus === 'UNREAD' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Unread
                            </button>
                            <button 
                                onClick={() => setFilterStatus('ALL')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterStatus === 'ALL' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                All Active
                            </button>
                            <button 
                                onClick={() => setFilterStatus('ARCHIVED')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterStatus === 'ARCHIVED' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Archived
                            </button>
                        </div>

                        {/* Filter Toggle Button */}
                        <button 
                            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                            className={`flex items-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                isFilterExpanded || activeFiltersCount > 0
                                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' 
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <SlidersHorizontal className="w-4 h-4 mr-2" />
                            Filters
                            {activeFiltersCount > 0 && (
                                <span className="ml-2 bg-blue-600 dark:bg-blue-500 text-white text-[10px] px-1.5 rounded-full">{activeFiltersCount}</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Expanded Filters Row */}
                {(isFilterExpanded || activeFiltersCount > 0) && (
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Sort By:</span>
                            <button 
                                onClick={() => setSortBy(sortBy === 'DATE' ? 'PRIORITY' : 'DATE')}
                                className="flex items-center px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                            >
                                <ArrowDownUp className="w-3 h-3 mr-2" />
                                {sortBy === 'DATE' ? 'Date (Newest)' : 'Priority (High to Low)'}
                            </button>
                        </div>

                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block"></div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Priority:</span>
                            <select 
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="ALL">All Priorities</option>
                                <option value="CRITICAL">Critical</option>
                                <option value="HIGH">High</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="LOW">Low</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Module:</span>
                            <select 
                                value={filterModule}
                                onChange={(e) => setFilterModule(e.target.value)}
                                className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="ALL">All Modules</option>
                                {availableModules.map(mod => (
                                    <option key={mod} value={mod}>{mod.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>

                        {activeFiltersCount > 0 && (
                            <button 
                                onClick={() => { setFilterModule('ALL'); setFilterPriority('ALL'); }}
                                className="ml-auto text-xs text-red-600 dark:text-red-400 hover:underline flex items-center"
                            >
                                <X className="w-3 h-3 mr-1" /> Clear Filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 space-y-3 custom-scrollbar">
                {filteredItems.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Inbox className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No notifications found</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            {activeFiltersCount > 0 ? "Try adjusting your filters." : "You're all caught up!"}
                        </p>
                        {activeFiltersCount > 0 && (
                            <button 
                                onClick={() => { setFilterModule('ALL'); setFilterPriority('ALL'); setSearchTerm(''); setFilterStatus('ALL'); }}
                                className="mt-4 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                Reset All Filters
                            </button>
                        )}
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <NotificationItem 
                            key={item.id} 
                            item={item} 
                            onAction={handleAction} 
                            onNavigate={onNavigate} 
                        />
                    ))
                )}
            </div>
        </div>
    );
};
