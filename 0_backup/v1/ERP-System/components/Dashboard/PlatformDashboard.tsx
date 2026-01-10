
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building, DollarSign, Server, AlertTriangle } from 'lucide-react';
import { StatCard } from './StatCard';

const chartData = [
  { name: 'Mon', sales: 4000, stock: 2400 },
  { name: 'Tue', sales: 3000, stock: 1398 },
  { name: 'Wed', sales: 2000, stock: 9800 },
  { name: 'Thu', sales: 2780, stock: 3908 },
  { name: 'Fri', sales: 1890, stock: 4800 },
  { name: 'Sat', sales: 2390, stock: 3800 },
  { name: 'Sun', sales: 3490, stock: 4300 },
];

export const PlatformDashboard: React.FC = () => (
    <div className="grid gap-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Active Tenants" value="142" icon={Building} color="bg-indigo-600" subtext="Total registered" trend="+5%" />
            <StatCard title="Platform MRR" value="$1.2M" icon={DollarSign} color="bg-emerald-600" subtext="Monthly Recurring" trend="+12%" />
            <StatCard title="System Health" value="99.9%" icon={Server} color="bg-blue-500" subtext="All systems operational" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Tenant Growth</h3>
                    <select className="text-sm border border-slate-200 dark:border-slate-700 bg-transparent rounded-lg px-2 py-1 outline-none text-slate-600 dark:text-slate-300">
                        <option>Last 30 Days</option>
                        <option>Last Quarter</option>
                    </select>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} itemStyle={{color: '#fff'}} />
                            <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTraffic)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Security Alerts</h3>
                <div className="space-y-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-lg flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Unusual Login Activity</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Spike in failed attempts from region: APAC</p>
                        </div>
                    </div>
                    {[1,2,3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Policy Update Required</p>
                                <p className="text-xs text-slate-400">Tenant ID: client-a • 2h ago</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);
