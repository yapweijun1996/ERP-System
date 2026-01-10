
import React from 'react';
import { MOCK_CLIENTS } from '../../constants';
import { useApp } from '../../context/AppContext';
import { Building, LogIn, MoreHorizontal, Shield, ToggleLeft } from 'lucide-react';
import { StatusBadge } from '../../components/UI/StatusBadge';

export const ClientManagement: React.FC = () => {
  const { setSelectedClientId, setViewLevel, setSelectedCompanyId } = useApp();

  const handleLoginAs = (client: any) => {
    setSelectedClientId(client.id);
    if(client.companies.length > 0) {
        setSelectedCompanyId(client.companies[0].id);
    }
    setViewLevel('CLIENT');
  };

  return (
    <div className="space-y-6 pb-20">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Client Management</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Manage tenants and subscriptions</p>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-blue-700 transition">
                + Onboard Client
            </button>
        </div>

        <div className="grid gap-4">
            {MOCK_CLIENTS.map(client => (
                <div key={client.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-6 transition-colors">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Building className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{client.name}</h3>
                            <StatusBadge status="Active" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            ID: <span className="font-mono">{client.id}</span> • {client.companies.length} Companies
                        </p>
                        <div className="flex gap-2 mt-3">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                <Shield className="w-3 h-3 mr-1" /> Enterprise Plan
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-4 md:pt-0">
                         <button 
                            onClick={() => handleLoginAs(client)}
                            className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-sm font-medium"
                         >
                            <LogIn className="w-4 h-4" />
                            <span>Access Tenant</span>
                         </button>
                         <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                            <ToggleLeft className="w-5 h-5" />
                         </button>
                         <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                            <MoreHorizontal className="w-5 h-5" />
                         </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
