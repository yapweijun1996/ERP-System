
import React from 'react';

export const FiscalSettings: React.FC = () => {
    return (
        <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Fiscal Configuration</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Set base currency and financial year rules.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Base Currency</label>
                        <select className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none">
                            <option>USD - US Dollar</option>
                            <option>EUR - Euro</option>
                            <option>GBP - British Pound</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fiscal Year End</label>
                        <select className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none">
                            <option>December 31</option>
                            <option>March 31</option>
                            <option>September 30</option>
                        </select>
                    </div>
                </div>
                
                <div className="pt-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-950 transition-colors cursor-pointer group">
                        <input type="checkbox" id="tax" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                        <label htmlFor="tax" className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Enable Tax Calculation Engine
                        </label>
                    </div>
                </div>
             </div>
        </div>
    );
};
