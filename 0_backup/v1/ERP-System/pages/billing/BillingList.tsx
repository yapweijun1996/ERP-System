
import React, { useState, useMemo } from 'react';
import { MOCK_INVOICES } from '../../constants';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId, Invoice } from '../../types';
import { Plus, Search, Filter, ArrowUpDown, MoreHorizontal, Mail, CreditCard, AlertCircle, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const BillingList: React.FC = () => {
    const { addToast } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'OVERDUE' | 'PAID'>('ALL');

    const filteredInvoices = useMemo(() => {
        return MOCK_INVOICES.filter(inv => {
            const matchesSearch = inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  inv.id.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;
            
            if (activeFilter === 'OVERDUE') return inv.status === 'Overdue';
            if (activeFilter === 'PAID') return inv.status === 'Paid';
            
            return true;
        });
    }, [searchTerm, activeFilter]);

    const handleSendReminder = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        addToast('Reminder Sent', `Payment reminder sent for invoice ${id}`, 'info');
    };

    const handleRecordPayment = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        addToast('Payment Recorded', `Payment successfully applied to ${id}`, 'success');
    };

    const stats = {
        totalDue: MOCK_INVOICES.filter(i => i.status !== 'Paid' && i.status !== 'Void').reduce((acc, i) => acc + i.amount, 0),
        overdue: MOCK_INVOICES.filter(i => i.status === 'Overdue').reduce((acc, i) => acc + i.amount, 0),
    };

    return (
        <FeatureGuard moduleId={ModuleId.BILLING}>
            <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
                {/* Header */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing & Invoices</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Manage customer invoices and payments</p>
                    </div>
                    <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
                        <Plus className="w-4 h-4" />
                        <span>Create Invoice</span>
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Outstanding</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">${stats.totalDue.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                         <p className="text-xs font-bold text-red-500 uppercase mb-1">Overdue Amount</p>
                         <div className="flex items-center gap-2">
                            <h3 className="text-2xl font-bold text-red-600 dark:text-red-500">${stats.overdue.toLocaleString()}</h3>
                            {stats.overdue > 0 && <AlertCircle className="w-5 h-5 text-red-500" />}
                         </div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-2 shrink-0">
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search invoice # or customer..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                             <button onClick={() => setActiveFilter('ALL')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>All</button>
                             <button onClick={() => setActiveFilter('OVERDUE')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeFilter === 'OVERDUE' ? 'bg-white dark:bg-slate-700 shadow text-red-600 dark:text-red-400' : 'text-slate-500'}`}>Overdue</button>
                             <button onClick={() => setActiveFilter('PAID')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeFilter === 'PAID' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>Paid</button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col transition-colors min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Invoice #</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Customer</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Date Issued</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Due Date</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Amount</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                            No invoices found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInvoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    <FileText className="w-4 h-4 text-slate-400" />
                                                    <span className="font-medium text-slate-900 dark:text-white">{inv.id}</span>
                                                </div>
                                                <div className="text-xs text-slate-400 pl-6">Ref: {inv.orderId}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{inv.customerName}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{inv.date}</td>
                                            <td className="px-6 py-4">
                                                <span className={`${inv.status === 'Overdue' ? 'text-red-600 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {inv.dueDate}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">
                                                ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={inv.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {inv.status !== 'Paid' && (
                                                        <>
                                                            <button 
                                                                onClick={(e) => handleSendReminder(e, inv.id)}
                                                                title="Send Reminder"
                                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600"
                                                            >
                                                                <Mail className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => handleRecordPayment(e, inv.id)}
                                                                title="Record Payment"
                                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-emerald-600"
                                                            >
                                                                <CreditCard className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </FeatureGuard>
    );
};
