
import React from 'react';
import { MOCK_SYSTEM_STATUS } from '../../constants';
import { Server, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

export const SystemStatus: React.FC = () => {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Status</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Real-time infrastructure health</p>
        </div>
        <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">
            View Metrics
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MOCK_SYSTEM_STATUS.map((service, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
                  <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{service.name}</h3>
                      {service.status === 'Operational' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                  </div>
                  <div>
                      <div className="flex justify-between items-end">
                          <span className={`text-sm font-medium ${service.status === 'Operational' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {service.status}
                          </span>
                          <span className="text-xs text-slate-400">{service.uptime}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${service.status === 'Operational' ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                            style={{ width: service.uptime.replace('%', '') + '%' }}
                          ></div>
                      </div>
                  </div>
              </div>
          ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span>Incident History</span>
          </div>
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No incidents reported in the last 30 days.
          </div>
      </div>
    </div>
  );
};
