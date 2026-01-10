
import React from 'react';
import { Globe, Users, DollarSign, ShieldCheck } from 'lucide-react';
import { StatCard } from './StatCard';

export const ClientDashboard: React.FC = () => (
    <div className="grid gap-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <StatCard title="Companies" value="2" icon={Globe} color="bg-violet-500" subtext="Operational entities" />
             <StatCard title="License Usage" value="45/50" icon={Users} color="bg-blue-500" subtext="5 seats remaining" trend="90%" />
             <StatCard title="Current Bill" value="$450" icon={DollarSign} color="bg-slate-500" subtext="Next invoice: Nov 1" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Module Utilization</h3>
                <div className="space-y-6">
                    {[
                        { name: 'Sales & CRM', usage: 85, color: 'bg-blue-500' },
                        { name: 'Inventory Management', usage: 45, color: 'bg-emerald-500' },
                        { name: 'Financials', usage: 60, color: 'bg-amber-500' }
                    ].map(m => (
                        <div key={m.name}>
                            <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                                <span className="text-slate-500 dark:text-slate-400">{m.usage}% Active Users</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.usage}%`}}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Audit Trail</h3>
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                </div>
                 <div className="space-y-0">
                    {[
                        { user: 'Admin User', action: 'Enabled Module: Finance', time: '10 mins ago' },
                        { user: 'John Doe', action: 'Invited 3 new users', time: '2 hours ago' },
                        { user: 'System', action: 'Backup Completed', time: '5 hours ago' },
                        { user: 'Sarah Connor', action: 'Updated Company Settings', time: '1 day ago' }
                    ].map((log, i) => (
                        <div key={i} className="flex gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                            <div className="flex flex-col items-center">
                                <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5"></div>
                                <div className="w-px h-full bg-slate-200 dark:bg-slate-700 my-1 last:hidden"></div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{log.action}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">by {log.user} • {log.time}</p>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    </div>
);
