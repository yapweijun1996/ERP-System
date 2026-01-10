
import React from 'react';
import { useApp } from '../../context/AppContext';
import { WorkspaceType } from '../../types';
import { SalesWorkspace } from './workspaces/SalesWorkspace';
import { InventoryWorkspace } from './workspaces/InventoryWorkspace';
import { FinanceWorkspace } from './workspaces/FinanceWorkspace';
import { CompanyDashboard } from '../../components/Dashboard/CompanyDashboard';
import { LayoutDashboard, ShoppingCart, Package, Receipt } from 'lucide-react';

interface CompanyHomeProps {
    onNavigate?: (page: string, id?: string) => void;
}

export const CompanyHome: React.FC<CompanyHomeProps> = ({ onNavigate }) => {
  const { currentWorkspace, setCurrentWorkspace, theme } = useApp();

  const renderWorkspace = () => {
    switch (currentWorkspace) {
      case 'SALES': return <SalesWorkspace />;
      case 'INVENTORY': return <InventoryWorkspace />;
      case 'FINANCE': return <FinanceWorkspace />;
      case 'EXECUTIVE': 
      default: 
        return <CompanyDashboard theme={theme} onNavigate={onNavigate} />;
    }
  };

  const tabs: {id: WorkspaceType, label: string, icon: any}[] = [
      { id: 'EXECUTIVE', label: 'Work Center', icon: LayoutDashboard },
      { id: 'SALES', label: 'Sales', icon: ShoppingCart },
      { id: 'INVENTORY', label: 'Inventory', icon: Package },
      { id: 'FINANCE', label: 'Finance', icon: Receipt },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Workspace Selector Tabs - Sub-header */}
      <div className="bg-white dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors z-30">
          <div className="flex items-center space-x-1 px-4 md:px-8 overflow-x-auto no-scrollbar">
              {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentWorkspace(tab.id)}
                    className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                        currentWorkspace === tab.id 
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                      <tab.icon className={`w-4 h-4 mr-2 ${currentWorkspace === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                      {tab.label}
                  </button>
              ))}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-20 bg-slate-50 dark:bg-slate-950">
        {renderWorkspace()}
      </div>
    </div>
  );
};
