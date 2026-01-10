
import React from 'react';
import { useApp } from '../../context/AppContext';
import { ModuleId } from '../../types';
import { ShoppingCart, Package, Database, BarChart3, Receipt, Factory, LifeBuoy, CreditCard, Lock } from 'lucide-react';

export const AppFinder: React.FC = () => {
  const { isModuleEnabled, activeCompany } = useApp();

  const apps = [
    { id: ModuleId.SALES, label: 'Sales & CRM', icon: ShoppingCart, desc: 'Manage quotes, orders and customers.' },
    { id: ModuleId.INVENTORY, label: 'Inventory', icon: Package, desc: 'Stock levels, movements and adjustments.' },
    { id: ModuleId.PURCHASING, label: 'Purchasing', icon: Factory, desc: 'Purchase orders and supplier management.' },
    { id: ModuleId.FINANCE, label: 'Accounting', icon: Receipt, desc: 'General ledger, AP/AR and banking.' },
    { id: ModuleId.ANALYTICS, label: 'Reports', icon: BarChart3, desc: 'Business intelligence and dashboards.' },
    { id: ModuleId.MASTER_DATA, label: 'Master Data', icon: Database, desc: 'Core records for items and partners.' },
    { id: ModuleId.SUPPORT, label: 'Service Desk', icon: LifeBuoy, desc: 'Internal ticketing and support.' },
    { id: ModuleId.BILLING, label: 'Billing', icon: CreditCard, desc: 'Subscription and recurring invoices.' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div>
         <h1 className="text-2xl font-bold text-slate-900 dark:text-white">App Finder</h1>
         <p className="text-slate-500 dark:text-slate-400 text-sm">All available modules for {activeCompany?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {apps.map(app => {
            const enabled = isModuleEnabled(app.id);
            return (
                <div key={app.id} className={`bg-white dark:bg-slate-900 rounded-xl border p-6 flex flex-col justify-between transition-all ${enabled ? 'border-slate-200 dark:border-slate-800 hover:shadow-md cursor-pointer' : 'border-slate-100 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-800/50'}`}>
                    <div>
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${enabled ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            <app.icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">{app.label}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{app.desc}</p>
                    </div>
                    {!enabled && (
                        <div className="mt-4 flex items-center text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-fit">
                            <Lock className="w-3 h-3 mr-1" /> Not Enabled
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};