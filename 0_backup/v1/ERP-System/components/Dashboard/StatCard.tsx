
import React from 'react';
import { TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtext, trend }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between transition-all hover:shadow-md">
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
      <div className="flex items-center mt-2 gap-2">
         {trend && (
             <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded flex items-center">
                 <TrendingUp className="w-3 h-3 mr-1" /> {trend}
             </span>
         )}
         <p className="text-xs text-slate-400 dark:text-slate-500">{subtext}</p>
      </div>
    </div>
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
  </div>
);
