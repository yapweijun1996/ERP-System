
import React from 'react';
import { useApp } from '../../context/AppContext';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId } from '../../types';
import { MOCK_ANALYTICS_MONTHLY, MOCK_ANALYTICS_REGIONS } from '../../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Target, ArrowUpRight, Download, Calendar } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const AnalyticsDashboard: React.FC = () => {
  const { theme } = useApp();

  return (
    <FeatureGuard moduleId={ModuleId.ANALYTICS}>
      <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Business Intelligence</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Real-time performance metrics and insights</p>
            </div>
            <div className="flex gap-2">
                <button className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                    <Calendar className="w-4 h-4 mr-2 text-slate-500" />
                    <span className="text-slate-700 dark:text-slate-300">Last 6 Months</span>
                </button>
                <button className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                    <Download className="w-4 h-4 mr-2" /> Export
                </button>
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
                { label: 'Total Revenue', value: '$328,000', change: '+12.5%', icon: DollarSign, color: 'text-emerald-600' },
                { label: 'Total Profit', value: '$118,000', change: '+8.2%', icon: TrendingUp, color: 'text-blue-600' },
                { label: 'Active Customers', value: '1,240', change: '+3.1%', icon: Users, color: 'text-purple-600' },
                { label: 'Conversion Rate', value: '3.2%', change: '-0.4%', icon: Target, color: 'text-amber-600' }
            ].map((kpi, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${kpi.color}`}>
                            <kpi.icon className="w-6 h-6" />
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center ${kpi.change.startsWith('+') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                            {kpi.change} <ArrowUpRight className={`w-3 h-3 ml-1 ${kpi.change.startsWith('-') ? 'rotate-90' : ''}`} />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{kpi.label}</p>
                </div>
            ))}
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Revenue vs Expenses */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Revenue & Expenses Trend</h3>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={MOCK_ANALYTICS_MONTHLY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} 
                                itemStyle={{color: '#e2e8f0'}}
                                cursor={{fill: theme === 'dark' ? '#334155' : '#f1f5f9', opacity: 0.4}}
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Regional Distribution */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Regional Sales</h3>
                <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={MOCK_ANALYTICS_REGIONS as any[]}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {MOCK_ANALYTICS_REGIONS.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                    {MOCK_ANALYTICS_REGIONS.map((region, index) => (
                        <div key={region.region} className="flex items-center text-sm">
                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="text-slate-600 dark:text-slate-300 truncate">{region.region}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Profit Trend */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Net Profit Growth</h3>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_ANALYTICS_MONTHLY}>
                        <defs>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                </ResponsiveContainer>
             </div>
        </div>

      </div>
    </FeatureGuard>
  );
};
