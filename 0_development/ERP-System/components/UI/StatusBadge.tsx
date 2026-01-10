
import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = (s: string) => {
    switch (s.toLowerCase()) {
      case 'confirmed':
      case 'active':
      case 'shipped':
      case 'enabled':
      case 'resolved':
      case 'operational':
      case 'paid':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
      case 'draft':
      case 'pending':
      case 'pending approval':
      case 'in_progress':
      case 'degraded':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
      case 'disabled':
      case 'inactive':
      case 'cancelled':
      case 'down':
      case 'void':
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      case 'open':
      case 'issued':
      case 'sent':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
      case 'received':
        return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap shadow-sm ${getStyles(status)}`}>
      {status}
    </span>
  );
};
