
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Wrench, ArrowRight, Lock, Box, Coins, Barcode } from 'lucide-react';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { VolumetricWeight } from '../../components/Tools/Calculators/VolumetricWeight';
import { ToolWrapper } from '../../components/Tools/ToolWrapper';

// Helper to render icons dynamically
const ToolIcon = ({ name }: { name: string }) => {
    switch(name) {
        case 'Box': return <Box className="w-8 h-8" />;
        case 'Coins': return <Coins className="w-8 h-8" />;
        case 'Barcode': return <Barcode className="w-8 h-8" />;
        default: return <Wrench className="w-8 h-8" />;
    }
};

interface ToolsCenterProps {
    initialToolId?: string | null;
}

export const ToolsCenter: React.FC<ToolsCenterProps> = ({ initialToolId }) => {
    const { activeCompany, getEnabledTools } = useApp();
    const [selectedToolId, setSelectedToolId] = useState<string | null>(initialToolId || null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialToolId) setSelectedToolId(initialToolId);
    }, [initialToolId]);

    const enabledTools = useMemo(() => {
        if (!activeCompany) return [];
        return getEnabledTools(activeCompany.id);
    }, [activeCompany, getEnabledTools]);

    const filteredTools = enabledTools.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // If a tool is selected, render the tool wrapper
    if (selectedToolId) {
        // Dispatch specific component based on ID
        let ToolComponent: React.ElementType = () => <div>Unknown Tool</div>;
        if (selectedToolId === 'tool-volumetric') ToolComponent = VolumetricWeight;
        // Add others here...

        return (
            <ToolWrapper toolId={selectedToolId} onBack={() => setSelectedToolId(null)}>
                <ToolComponent />
            </ToolWrapper>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-6 pb-20 p-4 md:p-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mini Tools & Utilities</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Helper applications enabled for {activeCompany?.name}</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Find a tool..." 
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredTools.map(tool => (
                    <div 
                        key={tool.id} 
                        onClick={() => setSelectedToolId(tool.id)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group flex flex-col h-48"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <ToolIcon name={tool.iconName} />
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                            </div>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{tool.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 flex-1">{tool.description}</p>
                        
                        <div className="flex items-center gap-2 pt-3 border-t border-slate-50 dark:border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                {tool.category}
                            </span>
                        </div>
                    </div>
                ))}

                {filteredTools.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No tools found matching your search or configuration.</p>
                        <p className="text-xs mt-1">Contact your admin to enable more tools.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
