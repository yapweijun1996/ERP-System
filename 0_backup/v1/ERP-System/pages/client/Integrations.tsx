
import React from 'react';
import { MOCK_INTEGRATIONS } from '../../constants';
import { Puzzle, Check, ExternalLink } from 'lucide-react';

export const Integrations: React.FC = () => {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Connect external apps and services</p>
        </div>
        <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">
            Browse Marketplace
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_INTEGRATIONS.map(app => (
              <div key={app.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div>
                      <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-300">
                              {app.icon}
                          </div>
                          {app.status === 'Connected' ? (
                              <span className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                                  <Check className="w-3 h-3 mr-1" /> Connected
                              </span>
                          ) : (
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                  Available
                              </span>
                          )}
                      </div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">{app.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{app.category}</p>
                  </div>
                  <button className={`w-full mt-6 py-2 rounded-lg text-sm font-medium border transition ${
                      app.status === 'Connected' 
                      ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50' 
                      : 'bg-blue-600 text-white border-transparent hover:bg-blue-700 shadow-sm'
                  }`}>
                      {app.status === 'Connected' ? 'Configure' : 'Connect'}
                  </button>
              </div>
          ))}
      </div>
    </div>
  );
};
