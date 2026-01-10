
import React, { useState } from 'react';
import { CompanyProfileSettings } from './components/CompanyProfileSettings';
import { FiscalSettings } from './components/FiscalSettings';
import { DocumentNumbering } from './components/DocumentNumbering';
import { Building, Receipt, FileText, MapPin, ShieldCheck, CreditCard } from 'lucide-react';

export const CompanySettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isDirty, setIsDirty] = useState(false);

  const navItems = [
    { id: 'profile', label: 'Company Profile', icon: Building, comp: CompanyProfileSettings },
    { id: 'fiscal', label: 'Fiscal & Tax', icon: Receipt, comp: FiscalSettings },
    { id: 'numbering', label: 'Document Numbering', icon: FileText, comp: DocumentNumbering },
    { id: 'warehouse', label: 'Locations / Warehouses', icon: MapPin, comp: () => <div className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Warehouse Configuration Module</div> },
    { id: 'approvals', label: 'Approval Rules', icon: ShieldCheck, comp: () => <div className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Approval Workflow Builder</div> },
    { id: 'payment', label: 'Payment Methods', icon: CreditCard, comp: () => <div className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Payment Gateway Setup</div> },
  ];

  const handleTabChange = (id: string) => {
      if (isDirty) {
          if (!window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
              return;
          }
          setIsDirty(false); // Reset dirty if confirmed
      }
      setActiveTab(id);
  };

  const ActiveComponent = navItems.find(i => i.id === activeTab)?.comp || CompanyProfileSettings;

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-8rem)] pb-0">
       <div className="w-full md:w-64 flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-10rem)]">
           <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/20">
               Settings
           </div>
           <nav className="p-2 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
               {navItems.map(item => (
                   <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${activeTab === item.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                   >
                       <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                       <span>{item.label}</span>
                   </button>
               ))}
           </nav>
       </div>

       <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
           <div className="mb-6 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{navItems.find(i => i.id === activeTab)?.label}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage operational configurations for this entity.</p>
           </div>
           <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* We pass onDirtyChange to children that support it */}
                <ActiveComponent onDirtyChange={setIsDirty} />
           </div>
       </div>
    </div>
  );
};
