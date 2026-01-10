
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Ticket } from '../../types';
import { TicketStatusBadge } from './TicketStatusBadge';

interface TicketHeaderProps {
  ticket: Ticket;
  onBack: () => void;
  availableTransitions: { action: string; to: string; variant: string }[];
  onTransition: (action: string) => void;
}

export const TicketHeader: React.FC<TicketHeaderProps> = ({ 
  ticket, 
  onBack, 
  availableTransitions, 
  onTransition 
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500 text-sm">{ticket.id}</span>
                    <TicketStatusBadge status={ticket.status} />
                </div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">{ticket.title}</h1>
            </div>
        </div>
        
        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
            {availableTransitions.map(t => (
                <button
                    key={t.action}
                    onClick={() => onTransition(t.action)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm ${
                        t.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                        t.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                        'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                >
                    {t.action}
                </button>
            ))}
        </div>
    </div>
  );
};
