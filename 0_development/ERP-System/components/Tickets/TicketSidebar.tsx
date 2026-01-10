
import React from 'react';
import { Ticket } from '../../types';
import { User } from 'lucide-react';

interface TicketSidebarProps {
  ticket: Ticket;
  isSupport: boolean;
}

export const TicketSidebar: React.FC<TicketSidebarProps> = ({ ticket, isSupport }) => {
  return (
    <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 space-y-6 overflow-y-auto">
        
        {/* Attributes */}
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Details</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-slate-500">Module</label>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{ticket.module}</div>
                </div>
                <div>
                    <label className="text-xs text-slate-500">Type</label>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{ticket.type}</div>
                </div>
                <div>
                    <label className="text-xs text-slate-500">Priority</label>
                    <div className={`text-sm font-medium ${ticket.priority === 'High' || ticket.priority === 'Critical' ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {ticket.priority}
                    </div>
                </div>
                <div>
                    <label className="text-xs text-slate-500">Assignee</label>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <User className="w-3 h-3" /> {ticket.assigneeName || 'Unassigned'}
                    </div>
                </div>
            </div>
        </div>

        {isSupport && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Internal Context</h3>
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Client:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{ticket.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Company:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{ticket.companyName}</span>
                    </div>
                </div>
            </div>
        )}

        {/* Timeline */}
        <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Audit Timeline</h3>
            <div className="space-y-4">
                {ticket.timeline.map((event, i) => (
                    <div key={event.id} className="relative pl-4 border-l border-slate-200 dark:border-slate-800">
                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-900"></div>
                        <div className="text-xs">
                            <p className="font-medium text-slate-700 dark:text-slate-300">{event.action}</p>
                            <p className="text-slate-500 mt-0.5">by {event.actorName}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{new Date(event.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
