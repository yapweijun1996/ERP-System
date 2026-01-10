
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Terminal, Search, Filter, RefreshCw } from 'lucide-react';

export const AdminLogs: React.FC = () => {
    const { systemLogs } = useApp();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLogs = systemLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.traceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.module.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getLevelColor = (level: string) => {
        switch(level) {
            case 'ERROR': return 'text-red-500';
            case 'WARN': return 'text-amber-500';
            case 'INFO': return 'text-blue-500';
            case 'DEBUG': return 'text-slate-500';
            default: return 'text-slate-500';
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logs Explorer</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">System-wide event tracing.</p>
                </div>
                <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="bg-slate-900 text-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col font-mono text-sm border border-slate-700 shadow-xl">
                <div className="p-2 border-b border-slate-700 flex gap-2 bg-slate-800">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Filter by trace ID, message..." 
                            className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-300 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold border border-slate-600">
                        1h
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="flex gap-4 hover:bg-slate-800 p-1 rounded cursor-pointer group">
                            <span className="text-slate-500 w-36 shrink-0">{log.timestamp.split('T')[1].replace('Z','')}</span>
                            <span className={`w-16 font-bold shrink-0 ${getLevelColor(log.level)}`}>{log.level}</span>
                            <span className="text-purple-400 w-24 shrink-0">{log.module}</span>
                            <span className="text-slate-300 flex-1 truncate">{log.message}</span>
                            <span className="text-slate-600 text-xs group-hover:text-slate-400">{log.traceId}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};