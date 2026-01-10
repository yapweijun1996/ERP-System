
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTicketLogic } from '../../hooks/useTicketLogic';
import { Plus, Search, Filter, AlertCircle, Inbox } from 'lucide-react';
import { TicketStatusBadge } from '../../components/Tickets/TicketStatusBadge';
import { Modal } from '../../components/UI/Modal';
import { ModuleId, TicketPriority, TicketType } from '../../types';

interface TicketListProps {
    onNavigate: (page: string, id?: string) => void;
}

export const TicketList: React.FC<TicketListProps> = ({ onNavigate }) => {
    const { viewLevel, platform, activeClient, activeCompany } = useApp();
    const { tickets, createTicket } = useTicketLogic();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateOpen, setCreateOpen] = useState(false);
    
    // Create Form State
    const [newTicket, setNewTicket] = useState({
        title: '',
        description: '',
        priority: 'Medium' as TicketPriority,
        type: 'Question' as TicketType,
        module: ModuleId.SUPPORT
    });

    const filteredTickets = useMemo(() => {
        let items = tickets;
        
        // Scope Filter
        if (viewLevel === 'COMPANY') {
            items = items.filter(t => t.companyId === activeCompany?.id);
        } else if (viewLevel === 'CLIENT') {
            items = items.filter(t => t.clientId === activeClient?.id);
        }
        
        // Search Filter
        if (searchTerm) {
            items = items.filter(t => 
                t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                t.id.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        return items;
    }, [tickets, viewLevel, activeCompany, activeClient, searchTerm]);

    const handleSubmit = () => {
        createTicket(newTicket);
        setCreateOpen(false);
    };

    return (
        <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {viewLevel === 'PLATFORM' ? 'Support Console' : 'Help Desk'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {viewLevel === 'PLATFORM' ? 'Global ticket queue' : 'My Support Tickets'}
                    </p>
                </div>
                {viewLevel !== 'PLATFORM' && (
                    <button 
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Raise Ticket</span>
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tickets..." 
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                        />
                    </div>
                    <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline text-sm">Filter</span>
                    </button>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 sticky top-0">
                            <tr>
                                <th className="px-6 py-4 font-semibold w-24">ID</th>
                                <th className="px-6 py-4 font-semibold">Subject</th>
                                {viewLevel === 'PLATFORM' && <th className="px-6 py-4 font-semibold">Client</th>}
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Priority</th>
                                <th className="px-6 py-4 font-semibold text-right">Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredTickets.map(ticket => (
                                <tr 
                                    key={ticket.id} 
                                    onClick={() => onNavigate('ticket-detail', ticket.id)}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 font-mono font-medium text-blue-600 dark:text-blue-400">
                                        {ticket.id}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900 dark:text-slate-100">{ticket.title}</div>
                                        <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                                            <span>{ticket.module}</span>
                                            <span>•</span>
                                            <span>{ticket.type}</span>
                                        </div>
                                    </td>
                                    {viewLevel === 'PLATFORM' && (
                                        <td className="px-6 py-4">
                                            <div className="text-slate-800 dark:text-slate-200">{ticket.clientName}</div>
                                            <div className="text-xs text-slate-500">{ticket.companyName}</div>
                                        </td>
                                    )}
                                    <td className="px-6 py-4">
                                        <TicketStatusBadge status={ticket.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-semibold ${ticket.priority === 'Critical' || ticket.priority === 'High' ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
                                            {ticket.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-500 dark:text-slate-400 text-xs">
                                        {new Date(ticket.updated).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredTickets.length === 0 && (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                            <Inbox className="w-12 h-12 mb-2 opacity-50" />
                            <p>No tickets found.</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="New Support Ticket">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                        <input 
                            value={newTicket.title}
                            onChange={(e) => setNewTicket({...newTicket, title: e.target.value})}
                            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800"
                            placeholder="Brief summary of the issue"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Module</label>
                            <select 
                                value={newTicket.module}
                                onChange={(e) => setNewTicket({...newTicket, module: e.target.value as ModuleId})}
                                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800"
                            >
                                {Object.values(ModuleId).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                            <select 
                                value={newTicket.type}
                                onChange={(e) => setNewTicket({...newTicket, type: e.target.value as TicketType})}
                                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800"
                            >
                                <option>Bug</option>
                                <option>Question</option>
                                <option>Feature Request</option>
                                <option>Access</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                        <textarea 
                            value={newTicket.description}
                            onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                            rows={4}
                            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 resize-none"
                            placeholder="Details about the issue..."
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                        <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                        <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit Ticket</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
