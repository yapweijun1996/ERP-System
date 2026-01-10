
import React from 'react';
import { useApp } from '../../context/AppContext';
import { ContextBar } from './WorkCenterWidgets';
import { renderWidget } from './Widgets/WidgetRegistry';
import { Settings2 } from 'lucide-react';

interface CompanyDashboardProps {
    theme: string;
    onNavigate?: (page: string, id?: string) => void;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ onNavigate }) => {
  const { 
    currentUser, activeCompany, activeClient, 
    dashboard, addToast
  } = useApp();

  const handleNav = (path: string, id?: string) => {
    if (onNavigate) onNavigate(path, id);
    else addToast('Navigating...', `Going to ${path}`);
  };

  const triggerGlobalSearch = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* Top Context Bar */}
      <ContextBar 
        clientName={activeClient?.name || 'Unknown Client'}
        companyName={activeCompany?.name || 'Unknown Company'}
        role={currentUser.roles[0]?.replace('ROLE_', '') || 'User'}
        onSearch={triggerGlobalSearch}
      />

      {/* Customization Trigger */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => handleNav('dashboard-customize')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
        >
          <Settings2 className="w-4 h-4" /> Customize Layout
        </button>
      </div>

      {/* Dynamic Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 grid-flow-row-dense">
        {dashboard.layout.widgets
          .sort((a, b) => a.order - b.order)
          .map(widget => (
            <React.Fragment key={widget.id}>
              {renderWidget(widget.definitionId, { 
                config: widget.config, 
                size: widget.size 
              })}
            </React.Fragment>
        ))}
      </div>
    </div>
  );
};
