
import React from 'react';
import { ArrowRight, CheckCircle, AlertTriangle, Clock, Search, ChevronRight, User } from 'lucide-react';

export const SectionHeader: React.FC<{ title: string; action?: { label: string; onClick: () => void } }> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{title}</h3>
    {action && (
      <button onClick={action.onClick} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
        {action.label}
      </button>
    )}
  </div>
);

export const ContextBar: React.FC<{
  clientName: string;
  companyName: string;
  role: string;
  onSearch: () => void;
}> = ({ clientName, companyName, role, onSearch }) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm mb-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          Good {now.getHours() < 12 ? 'Morning' : now.getHours() < 18 ? 'Afternoon' : 'Evening'}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span className="font-medium text-slate-700 dark:text-slate-300">{companyName}</span>
          <span className="text-slate-300">•</span>
          <span>{clientName}</span>
          <span className="text-slate-300">•</span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">{role}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right hidden md:block">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{dateStr}</div>
          <div className="text-xs text-slate-400">{Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
        </div>
        <button 
          onClick={onSearch}
          className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 transition-colors w-full md:w-auto"
        >
          <Search className="w-4 h-4" />
          <span>Quick Find...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-400">⌘K</kbd>
        </button>
      </div>
    </div>
  );
};

export const TaskItem: React.FC<{
  title: string;
  count?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  onClick: () => void;
  icon: React.ElementType;
}> = ({ title, count, priority, onClick, icon: Icon }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all group text-left">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${priority === 'HIGH' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</div>
        {priority && <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{priority} Priority</div>}
      </div>
    </div>
    <div className="flex items-center gap-3">
      {count !== undefined && <span className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{count}</span>}
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
    </div>
  </button>
);

export const AlertItem: React.FC<{
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING';
  onClick: () => void;
}> = ({ title, message, severity, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
    severity === 'CRITICAL' 
      ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:border-red-300' 
      : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 hover:border-amber-300'
  }`}>
    <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'}`} />
    <div>
      <div className={`text-sm font-bold ${severity === 'CRITICAL' ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}`}>{title}</div>
      <div className={`text-xs mt-1 ${severity === 'CRITICAL' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>{message}</div>
    </div>
  </button>
);

export const ActionButton: React.FC<{
  label: string;
  icon: React.ElementType;
  colorClass: string;
  onClick: () => void;
}> = ({ label, icon: Icon, colorClass, onClick }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all gap-3 h-28"
  >
    <div className={`p-3 rounded-full ${colorClass} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
    </div>
    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">{label}</span>
  </button>
);

export const ActivityItem: React.FC<{
  user: string;
  action: string;
  target: string;
  time: string;
}> = ({ user, action, target, time }) => (
  <div className="flex gap-3 py-3 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
      {user.charAt(0)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
        <span className="text-blue-600 dark:text-blue-400">{user}</span> {action}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{target}</div>
    </div>
    <div className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1">
      <Clock className="w-3 h-3" /> {time}
    </div>
  </div>
);

export const OnboardingChecklist: React.FC<{
  steps: { label: string; done: boolean; onClick?: () => void }[];
}> = ({ steps }) => (
  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border border-indigo-100 dark:border-slate-700">
    <h3 className="font-bold text-indigo-900 dark:text-indigo-100 text-lg mb-4">Let's get you set up</h3>
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm opacity-90">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${step.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
            {step.done && <CheckCircle className="w-3.5 h-3.5" />}
          </div>
          <span className={`text-sm font-medium flex-1 ${step.done ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
            {step.label}
          </span>
          {!step.done && step.onClick && (
            <button onClick={step.onClick} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded font-medium hover:bg-indigo-700 transition">
              Start
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);
