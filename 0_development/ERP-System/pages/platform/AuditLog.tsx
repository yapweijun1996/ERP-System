
import React from 'react';
import { MOCK_AUDIT_LOGS } from '../../constants';
import { ShieldCheck, Search, Filter } from 'lucide-react';

export const AuditLog: React.FC = () => {
  return (
    <div className="flex flex-col h-full space-y-4 pb-20">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">System-wide security and action events</p>
        </div>
        <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filter</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search logs by user, action or details..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none text-sm"
                />
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Timestamp</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">User</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Action</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Target</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {MOCK_AUDIT_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{log.timestamp}</td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{log.user}</td>
                  <td className="px-6 py-4 text-blue-600 dark:text-blue-400 font-medium">{log.action}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{log.target}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
