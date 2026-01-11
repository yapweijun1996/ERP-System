import React from 'react';
import { Search, Filter } from 'lucide-react';

interface InventoryFilterBarProps {
    searchTerm: string;
    onSearchChange: (val: string) => void;
}

export const InventoryFilterBar: React.FC<InventoryFilterBarProps> = ({ searchTerm, onSearchChange }) => {
    return (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search items..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                />
            </div>
            <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Filter</span>
            </button>
        </div>
    );
};