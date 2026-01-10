
import React from 'react';
import { TicketStatus } from '../../types';

export const TicketStatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
    const getStyles = (s: TicketStatus) => {
        switch (s) {
            case 'Draft': return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            case 'Submitted': return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900';
            case 'Triaging': return 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900';
            case 'Waiting Customer': return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900';
            case 'In Progress': return 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900';
            case 'Resolved': return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900';
            case 'Closed': return 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap shadow-sm ${getStyles(status)}`}>
            {status}
        </span>
    );
};
