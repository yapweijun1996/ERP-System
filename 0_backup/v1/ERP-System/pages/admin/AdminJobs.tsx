
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Activity, RefreshCw, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

export const AdminJobs: React.FC = () => {
    const { backgroundJobs } = useApp();

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'COMPLETED': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
            case 'FAILED': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'RUNNING': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
            default: return <Clock className="w-5 h-5 text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jobs Monitor</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Background tasks and queue status.</p>
                </div>
                <button className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Job Name</th>
                            <th className="px-6 py-4 font-semibold">Client</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold">Progress</th>
                            <th className="px-6 py-4 font-semibold">Started</th>
                            <th className="px-6 py-4 font-semibold text-right">Retry</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {backgroundJobs.map(job => (
                            <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">{job.name}</div>
                                    <div className="text-xs text-slate-500 font-mono">{job.id}</div>
                                    {job.error && <div className="text-xs text-red-500 mt-1">{job.error}</div>}
                                </td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{job.clientId}</td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    {getStatusIcon(job.status)}
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{job.status}</span>
                                </td>
                                <td className="px-6 py-4 w-48">
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${job.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-600'}`} style={{width: `${job.progress}%`}}></div>
                                    </div>
                                    <div className="text-right text-xs text-slate-400 mt-1">{job.progress}%</div>
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs">
                                    {new Date(job.startedAt).toLocaleTimeString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {job.status === 'FAILED' && (
                                        <button className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">Retry</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};