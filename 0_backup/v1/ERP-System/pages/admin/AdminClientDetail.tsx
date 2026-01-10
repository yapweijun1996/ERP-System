
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, PlayCircle, Building, Users, Server, Shield, Activity, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { DEFAULT_FEATURES } from '../../constants';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { ModuleId } from '../../types';

interface AdminClientDetailProps {
    clientId: string;
    onBack: () => void;
}

export const AdminClientDetail: React.FC<AdminClientDetailProps> = ({ clientId, onBack }) => {
    const { platform, startSupportSession } = useApp();
    const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'companies'>('overview');
    
    const client = platform.clients.find(c => c.id === clientId);

    if (!client) return <div>Client not found</div>;

    const renderConfigDiff = () => {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300 flex items-center gap-3">
                    <ToggleLeft className="w-5 h-5" />
                    <p>Comparing <strong>{client.name}</strong> configuration against <strong>Global Defaults</strong>.</p>
                </div>
                
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Feature Module</th>
                                <th className="px-6 py-3 font-semibold">Default</th>
                                <th className="px-6 py-3 font-semibold">Client Override</th>
                                <th className="px-6 py-3 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {Object.values(ModuleId).map(mod => {
                                const defaultVal = DEFAULT_FEATURES[mod] || false;
                                const clientVal = client.features[mod] || false;
                                const isDiff = defaultVal !== clientVal;
                                
                                return (
                                    <tr key={mod} className={isDiff ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                                        <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-300">{mod}</td>
                                        <td className="px-6 py-3 text-slate-500">{defaultVal ? 'Enabled' : 'Disabled'}</td>
                                        <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200">{clientVal ? 'Enabled' : 'Disabled'}</td>
                                        <td className="px-6 py-3">
                                            {isDiff ? (
                                                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded font-bold">OVERRIDE</span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">Match</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
                            <StatusBadge status={client.status} />
                        </div>
                        <div className="text-sm text-slate-500 font-mono mt-1">{client.id}</div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => startSupportSession(client.id)}
                        className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition shadow-sm"
                    >
                        <PlayCircle className="w-4 h-4 mr-2" /> Start Support Session
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Overview</button>
                <button onClick={() => setActiveTab('companies')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'companies' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Companies</button>
                <button onClick={() => setActiveTab('config')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Config Diff</button>
            </div>

            {/* Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-600" /> Recent Activity
                            </h3>
                            <div className="space-y-4">
                                {[1,2,3].map(i => (
                                    <div key={i} className="flex gap-4 border-l-2 border-slate-100 dark:border-slate-800 pl-4">
                                        <div className="text-xs text-slate-400 whitespace-nowrap mt-0.5">2 hours ago</div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">User Login (Alice)</p>
                                            <p className="text-xs text-slate-500">Successful authentication from 192.168.1.1</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Vital Stats</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Companies</span>
                                    <span className="font-mono font-medium">{client.companies.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Users</span>
                                    <span className="font-mono font-medium">12</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Storage</span>
                                    <span className="font-mono font-medium">45.2 GB</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Plan</span>
                                    <span className="font-mono font-medium text-emerald-600">Enterprise</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'companies' && (
                <div className="grid gap-4">
                    {client.companies.map(comp => (
                        <div key={comp.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                                    <Building className="w-5 h-5 text-slate-500" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{comp.name}</h4>
                                    <div className="flex gap-2 text-xs text-slate-500">
                                        <span>{comp.country}</span> • <span>{comp.currency}</span> • <span className="font-mono">{comp.id}</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => startSupportSession(client.id, comp.id)}
                                className="text-xs font-bold text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded border border-amber-200 transition-colors"
                            >
                                Session
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'config' && renderConfigDiff()}
        </div>
    );
};