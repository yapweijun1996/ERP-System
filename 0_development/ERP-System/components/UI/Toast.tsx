
import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ToastType } from '../../types';

const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    default: return <Info className="w-5 h-5 text-blue-500" />;
  }
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right-10 fade-in duration-300"
        >
          <div className="shrink-0 mt-0.5">
            <ToastIcon type={toast.type} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{toast.title}</h4>
            {toast.message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{toast.message}</p>}
          </div>
          <button 
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
