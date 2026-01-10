
import React from 'react';
import { useApp } from '../../context/AppContext';
import { ToggleRight, Info, AlertTriangle } from 'lucide-react';

export const ToolsConfiguration: React.FC = () => {
    const { 
        viewLevel, activeClient, activeCompany, 
        availableTools, clientToolConfigs, companyToolConfigs, 
        toggleToolEnabled, platform
    } = useApp();

    if (viewLevel === 'PLATFORM') {
        return (
            <div className="p-8 text-center text-slate-500">
                <Info className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Platform Catalog</h2>
                <p className="max-w-md mx-auto mt-2">
                    Tools are defined in code (Catalog). To add new tools, update the codebase. 
                    Manage Client access via the Client Config diff view.
                </p>
            </div>
        );
    }

    const scope = viewLevel === 'CLIENT' ? 'CLIENT' : 'COMPANY';
    const entityId = viewLevel === 'CLIENT' ? activeClient?.id : activeCompany?.id;
    const currentConfig = viewLevel === 'CLIENT' ? clientToolConfigs : companyToolConfigs;

    if (!entityId) return <div>No context</div>;

    // For Company view, we must respect Client enablement
    const parentEnabledIds = viewLevel === 'COMPANY' && activeClient
        ? (clientToolConfigs[activeClient.id]?.enabledToolIds || [])
        : null;

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tools Configuration</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Enable or disable utilities for {viewLevel === 'CLIENT' ? activeClient?.name : activeCompany?.name}
                </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 grid gap-4">
                    {availableTools.map(tool => {
                        const isEnabledHere = currentConfig[entityId]?.enabledToolIds?.includes(tool.id);
                        
                        // Check parent restrictions
                        const isParentDisabled = parentEnabledIds ? !parentEnabledIds.includes(tool.id) : false;

                        return (
                            <div key={tool.id} className={`flex items-center justify-between p-4 border rounded-xl transition-all ${
                                isParentDisabled 
                                    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-60' 
                                    : isEnabledHere 
                                        ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' 
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">{tool.name}</h3>
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 border border-slate-200 dark:border-slate-700">{tool.category}</span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{tool.description}</p>
                                    
                                    {isParentDisabled && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-500">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span>Disabled at Client level</span>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={() => !isParentDisabled && toggleToolEnabled(scope, entityId, tool.id)}
                                    disabled={isParentDisabled}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEnabledHere ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'} ${isParentDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <span className={`${isEnabledHere ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
