
import React from 'react';
import { useApp } from '../context/AppContext';
import { PlatformDashboard } from '../components/Dashboard/PlatformDashboard';
import { ClientDashboard } from '../components/Dashboard/ClientDashboard';
import { CompanyDashboard } from '../components/Dashboard/CompanyDashboard';

interface DashboardProps {
    onNavigate?: (page: string, id?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { viewLevel, activeCompany, theme } = useApp();

  return (
    <div className="space-y-6 pb-20 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {viewLevel === 'PLATFORM' ? 'Platform Command' : viewLevel === 'CLIENT' ? 'Tenant Overview' : `Dashboard`}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
              {viewLevel === 'COMPANY' ? `Welcome back to ${activeCompany?.name}` : 'Real-time metrics and operational status'}
          </p>
        </div>
        <div className="flex gap-3">
             <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300">
                Download Report
             </button>
             <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm shadow-blue-500/20">
                Refresh Data
            </button>
        </div>
      </div>

      {viewLevel === 'PLATFORM' && <PlatformDashboard />}
      {viewLevel === 'CLIENT' && <ClientDashboard />}
      {viewLevel === 'COMPANY' && <CompanyDashboard theme={theme} onNavigate={onNavigate} />}
    </div>
  );
};
