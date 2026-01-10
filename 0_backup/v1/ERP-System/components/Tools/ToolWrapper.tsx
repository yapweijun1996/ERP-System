
import React from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, Pin, History } from 'lucide-react';
import { MiniTool } from '../../types';

interface ToolWrapperProps {
  toolId: string;
  children: React.ReactNode;
  onBack: () => void;
}

export const ToolWrapper: React.FC<ToolWrapperProps> = ({ toolId, children, onBack }) => {
  const { availableTools, activeCompany, toggleToolPin, companyToolConfigs, toolHistory } = useApp();
  
  const tool = availableTools.find(t => t.id === toolId);
  const isPinned = activeCompany && companyToolConfigs[activeCompany.id]?.pinnedToolIds.includes(toolId);
  
  // Filter history for this tool
  const history = toolHistory.filter(h => h.toolId === toolId).slice(0, 5);

  if (!tool) return <div>Tool not found</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="group flex items-center gap-2 pr-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {tool.name}
            </h1>
            <p className="text-xs text-slate-500">{tool.description}</p>
          </div>
        </div>
        
        {activeCompany && (
            <button 
                onClick={() => toggleToolPin(activeCompany.id, toolId)}
                className={`p-2 rounded-lg transition-colors border ${isPinned ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'}`}
                title={isPinned ? "Unpin from Dashboard" : "Pin to Dashboard"}
            >
                <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
            </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              {children}
          </div>

          {/* History Sidebar */}
          <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex-shrink-0 overflow-y-auto hidden lg:block custom-scrollbar">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <History className="w-4 h-4" /> Recent Calculations
              </h3>
              
              {history.length === 0 ? (
                  <div className="text-sm text-slate-500 italic p-4 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      No history yet.
                  </div>
              ) : (
                  <div className="space-y-4">
                      {history.map(item => (
                          <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 hover:shadow-sm transition-shadow">
                              <div className="flex justify-between items-start mb-1">
                                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.summary}</div>
                                  <div className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                              </div>
                              <div className="text-xs text-slate-500 space-y-0.5">
                                  {Object.entries(item.details).map(([k, v]) => (
                                      <div key={k} className="flex justify-between">
                                          <span className="text-slate-400">{k}:</span>
                                          <span className="font-medium text-slate-600 dark:text-slate-300">{String(v)}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
