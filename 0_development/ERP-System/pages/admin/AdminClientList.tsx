
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DataTable, Column } from '../../components/UI/DataTable';
import { Client } from '../../types';
import { Search, Filter, MoreHorizontal, PlayCircle, Activity, Building, Users, Plus } from 'lucide-react';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { CreateClientWizard } from './CreateClientWizard';
import { useTranslation } from 'react-i18next';

interface AdminClientListProps {
    onNavigate: (page: string, id?: string) => void;
}

export const AdminClientList: React.FC<AdminClientListProps> = ({ onNavigate }) => {
    const { platform, startSupportSession } = useApp();
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [isWizardOpen, setWizardOpen] = useState(false);

    const filteredClients = platform.clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns: Column<Client>[] = [
        {
            header: t('admin.client_tenant', 'Client / Tenant'),
            cell: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
                        {row.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{row.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{row.id}</div>
                    </div>
                </div>
            )
        },
        {
            header: t('admin.status', 'Status'),
            cell: (row) => <StatusBadge status={row.status} />
        },
        {
            header: 'Stats',
            cell: (row) => (
                <div className="flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {row.companies.length}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> 12</span>
                </div>
            )
        },
        {
            header: t('admin.health', 'Health'),
            cell: () => (
                <div className="flex items-center text-emerald-600 text-xs font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                    {t('admin.healthy', 'Healthy')}
                </div>
            )
        },
        {
            header: 'Actions',
            className: 'text-right',
            cell: (row) => (
                <div className="flex justify-end gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); startSupportSession(row.id); }}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded flex items-center gap-1 text-xs font-bold border border-transparent hover:border-amber-200 transition-colors"
                        title="Start Support Session"
                    >
                        <PlayCircle className="w-4 h-4" /> Support
                    </button>
                    <button className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col h-full p-4 md:p-6 gap-6 pb-20 md:pb-6">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('admin.tenant_ops', 'Tenant Operations')}</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('admin.tenant_ops_desc', 'Manage all registered clients across the platform.')}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setWizardOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
                    >
                        <Plus className="w-4 h-4" /> {t('admin.new_client', 'New Client')}
                    </button>
                </div>
            </div>

            <div className="flex gap-4 shrink-0">
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex-1">
                    <div className="text-xs font-bold text-slate-400 uppercase">{t('admin.total_active', 'Total Active')}</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{platform.clients.length}</div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex-1">
                    <div className="text-xs font-bold text-slate-400 uppercase">{t('admin.total_users', 'Total Users')}</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">48</div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex-1">
                    <div className="text-xs font-bold text-slate-400 uppercase">{t('admin.system_status', 'System Status')}</div>
                    <div className="text-sm font-bold text-emerald-500 mt-1 flex items-center"><Activity className="w-4 h-4 mr-1" /> 100% Uptime</div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            type="text"
                            placeholder={t('admin.search_placeholder', 'Find client by name or ID...')}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                        />
                    </div>
                    <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline text-sm">{t('admin.filter', 'Filter')}</span>
                    </button>
                </div>
                <DataTable
                    data={filteredClients}
                    columns={columns}
                    onRowClick={(row) => onNavigate('admin-client-detail', row.id)}
                />
            </div>

            <CreateClientWizard isOpen={isWizardOpen} onClose={() => setWizardOpen(false)} />
        </div>
    );
};
