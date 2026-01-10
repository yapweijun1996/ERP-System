
import React from 'react';
import { MOCK_SECURITY_POLICIES } from '../../constants';
import { Shield, Lock, Users, Plus, MoreHorizontal } from 'lucide-react';
import { StatusBadge } from '../../components/UI/StatusBadge';

export const SecurityPolicies: React.FC = () => {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Security Templates</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage roles and access policies globally</p>
        </div>
        <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
          <Plus className="w-4 h-4" />
          <span>New Policy</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MOCK_SECURITY_POLICIES.map(policy => (
              <div key={policy.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                          <Shield className="w-6 h-6" />
                      </div>
                      <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          <MoreHorizontal className="w-5 h-5" />
                      </button>
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{policy.name}</h3>
                  <div className="flex items-center gap-2 mb-4">
                      <StatusBadge status={policy.status} />
                      <span className="text-xs text-slate-400 px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded">{policy.type}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <Users className="w-4 h-4 mr-2" />
                      {policy.usersCount} Assigned Users
                  </div>
              </div>
          ))}
          
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
              <Plus className="w-8 h-8 mb-2" />
              <span className="font-medium">Create Template</span>
          </div>
      </div>
    </div>
  );
};
