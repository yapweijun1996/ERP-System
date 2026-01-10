
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModuleId } from '../types';
import { Info, ChevronDown, ChevronRight } from 'lucide-react';

export const FeatureActivation: React.FC = () => {
  const { 
    viewLevel, 
    platform, activeClient, activeCompany, 
    toggleFeature, isModuleEnabled 
  } = useApp();

  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
      [ModuleId.SALES]: true,
      [ModuleId.PURCHASING]: true,
      [ModuleId.INVENTORY]: true
  });

  const MODULE_CONFIG = [
    { 
        id: ModuleId.SALES, 
        label: 'Sales & CRM', 
        desc: "Quote to Cash workflow.",
        subFeatures: [
            { key: 'SALES_QUOTATIONS', label: 'Quotations / Estimates' },
            { key: 'SALES_ORDERS', label: 'Sales Orders' },
            { key: 'SALES_DELIVERY', label: 'Delivery Notes' },
            { key: 'SALES_INVOICES', label: 'Invoices' },
            { key: 'SALES_CREDIT_NOTES', label: 'Credit Notes' }
        ]
    },
    { 
        id: ModuleId.PURCHASING, 
        label: 'Purchasing', 
        desc: "Procurement.",
        subFeatures: [
            { key: 'PURCHASING_PO', label: 'Purchase Orders' },
            { key: 'PURCHASING_GRN', label: 'Goods Receive Note (GRN)' },
            { key: 'PURCHASING_BILLS', label: 'Supplier Bills' }
        ]
    },
    { 
        id: ModuleId.INVENTORY, 
        label: 'Inventory', 
        desc: "Stock tracking.",
        subFeatures: [
            { key: 'INVENTORY_STOCK_ON_HAND', label: 'Stock Levels' },
            { key: 'INVENTORY_MOVEMENTS', label: 'Movements Log' },
            { key: 'INVENTORY_ADJUSTMENTS', label: 'Adjustments' },
            { key: 'INVENTORY_STOCK_TAKE', label: 'Stock Take / Counts' },
            { key: 'INVENTORY_WAREHOUSES', label: 'Multi-Warehouse' }
        ]
    },
    // Other modules without sub-features for now
    { id: ModuleId.FINANCE, label: 'Finance', desc: "General Ledger & Banking." },
    { id: ModuleId.MASTER_DATA, label: 'Master Data', desc: "Customers, Items, Suppliers." },
    { id: ModuleId.ANALYTICS, label: 'Analytics', desc: "BI & Reporting." },
    { id: ModuleId.BILLING, label: 'Billing', desc: "Recurring Subscriptions." },
    { id: ModuleId.SUPPORT, label: 'Support', desc: "Ticketing System." },
    { id: ModuleId.ORGANIZATION, label: 'Organization', desc: "Employees & Roles." },
  ];

  const getTargetEntity = () => {
    if (viewLevel === 'PLATFORM') return { name: platform.name, features: platform.features, id: platform.id };
    if (viewLevel === 'CLIENT') return activeClient ? { name: activeClient.name, features: activeClient.features, id: activeClient.id } : null;
    return activeCompany ? { name: activeCompany.name, features: activeCompany.features, id: activeCompany.id } : null;
  };

  const target = getTargetEntity();

  if (!target) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">No active context found.</div>;

  const toggleExpand = (id: string) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));

  // Generic toggle handler that uses the context-aware toggleFeature
  const handleToggle = (featureKey: string) => {
      // NOTE: Context logic currently expects ModuleId as 3rd param for `toggleFeature`. 
      // We need to cast our string key to ModuleId or update the context to accept strings. 
      // Since we updated FeatureFlags to allow string keys, we can cast here.
      toggleFeature(viewLevel, target.id, featureKey as ModuleId);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Feature Management</h1>
        <p className="text-slate-500 dark:text-slate-400">
            Controlling visibility for <span className="font-bold text-slate-700 dark:text-slate-300">{target.name}</span> ({viewLevel})
        </p>
      </div>

      <div className="grid gap-4">
        {MODULE_CONFIG.map((mod) => {
          const isModuleActive = target.features[mod.id] !== false; // Default true if undefined, unless logic says otherwise
          // Check inherited status for visual indication
          const effectiveStatus = isModuleEnabled(mod.id); 
          
          let parentLocked = false;
          // Simplistic parent lock check (if parent has it OFF, child cannot turn ON easily without admin override, but typically we hide it)
          // For now, we allow toggling, but visual cues help.

          return (
            <div key={mod.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm transition-colors overflow-hidden">
                <div className="flex items-center justify-between p-4">
                    <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(mod.id)}>
                        {mod.subFeatures && (
                            <button className="text-slate-400 hover:text-slate-600">
                                {expandedModules[mod.id] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            </button>
                        )}
                        <div>
                            <div className="flex items-center space-x-2">
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200">{mod.label}</h3>
                                {effectiveStatus ? (
                                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 rounded">Active</span>
                                ) : (
                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 rounded">Inactive</span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{mod.desc}</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => handleToggle(mod.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${target.features[mod.id] ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                        <span className={`${target.features[mod.id] ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </button>
                </div>

                {/* Sub Features */}
                {mod.subFeatures && expandedModules[mod.id] && target.features[mod.id] && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 px-4 py-2">
                        {mod.subFeatures.map(sub => (
                            <div key={sub.key} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 pl-8">
                                <span className="text-sm text-slate-600 dark:text-slate-300">{sub.label}</span>
                                <button 
                                    onClick={() => handleToggle(sub.key)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${target.features[sub.key] !== false ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`${target.features[sub.key] !== false ? 'translate-x-4' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
