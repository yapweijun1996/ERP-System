import React from 'react';
import { useApp } from '../../context/AppContext';
import { Save, Building, Globe, Mail, Shield, Bell } from 'lucide-react';

export const ClientSettings: React.FC = () => {
  const { activeClient } = useApp();

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tenant Settings</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Configuration for {activeClient?.name}</p>
         </div>
         <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Save className="w-4 h-4 mr-2" /> Save Changes
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6 lg:col-span-2">
              
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Building className="w-5 h-5 text-blue-600" /> Organization Profile
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Tenant Name</label>
                          <input type="text" defaultValue={activeClient?.name} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Primary Contact Email</label>
                          <input type="email" defaultValue="admin@techflow.com" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                      </div>
                  </div>
              </div>

              {/* Preferences */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-600" /> Regional & Defaults
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Default Language</label>
                          <select className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm">
                              <option>English (US)</option>
                              <option>Spanish</option>
                              <option>German</option>
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Timezone</label>
                          <select className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm">
                              <option>UTC-8 (Pacific Time)</option>
                              <option>UTC+0 (GMT)</option>
                              <option>UTC+1 (CET)</option>
                          </select>
                      </div>
                  </div>
              </div>

              {/* Security */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" /> Security Policies
                  </h3>
                  <div className="space-y-3">
                       <div className="flex items-center justify-between">
                           <span className="text-sm text-slate-700 dark:text-slate-300">Enforce Multi-Factor Authentication (MFA)</span>
                           <input type="checkbox" className="toggle" />
                       </div>
                       <div className="flex items-center justify-between">
                           <span className="text-sm text-slate-700 dark:text-slate-300">Session Timeout (Minutes)</span>
                           <input type="number" defaultValue={30} className="w-20 p-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                       </div>
                  </div>
              </div>

          </div>
          
          <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">Subscription Plan</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">You are currently on the <strong>Enterprise Plan</strong>.</p>
                  <button className="w-full py-2 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-slate-700 transition">
                      Manage Subscription
                  </button>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                   <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-amber-500" /> Notification Defaults
                  </h3>
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <label className="flex items-center space-x-2">
                          <input type="checkbox" defaultChecked />
                          <span>Email Alerts for System Issues</span>
                      </label>
                      <label className="flex items-center space-x-2">
                          <input type="checkbox" defaultChecked />
                          <span>Weekly Usage Reports</span>
                      </label>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};