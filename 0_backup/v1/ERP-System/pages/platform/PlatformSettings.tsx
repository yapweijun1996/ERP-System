
import React from 'react';
import { Save, Server, Shield, ToggleLeft, Globe, AlertTriangle } from 'lucide-react';
import { ModuleId } from '../../types';

export const PlatformSettings: React.FC = () => {
  const modules = Object.values(ModuleId);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Global configuration for Nexus ERP</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
          <Save className="w-4 h-4 mr-2" />
          <span>Save Configuration</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* General Identity */}
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" /> System Identity
                </h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Platform Name</label>
                        <input type="text" defaultValue="Nexus ERP" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Support Email</label>
                            <input type="email" defaultValue="support@nexuserp.io" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Documentation URL</label>
                            <input type="url" defaultValue="https://docs.nexuserp.io" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Security Policies */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" /> Security & Access
                </h3>
                <div className="space-y-4">
                     <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="text-sm">
                            <p className="font-medium text-slate-700 dark:text-slate-200">Force Global 2FA</p>
                            <p className="text-xs text-slate-500">Require Two-Factor Authentication for all tenant admins.</p>
                        </div>
                        <input type="checkbox" className="toggle" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-slate-500 uppercase">Min Password Length</label>
                             <input type="number" defaultValue={12} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                        </div>
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-slate-500 uppercase">Session Timeout (Mins)</label>
                             <input type="number" defaultValue={60} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                        </div>
                     </div>
                </div>
            </div>
        </div>

        {/* Global Module Defaults & Maintenance */}
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <ToggleLeft className="w-5 h-5 text-blue-600" /> Default Tenant Modules
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Select modules that are enabled by default when creating a new client tenant.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modules.map(mod => (
                        <label key={mod} className="flex items-center space-x-3 p-3 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                            <input type="checkbox" defaultChecked={[ModuleId.MASTER_DATA, ModuleId.SUPPORT].includes(mod)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{mod.replace('_', ' ').toLowerCase()}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-xl border border-amber-200 dark:border-amber-900/30">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5 text-amber-600" /> System Maintenance
                </h3>
                <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <p className="font-medium text-amber-800 dark:text-amber-200">Maintenance Mode</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">Prevent non-admin users from logging in.</p>
                        </div>
                        <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-amber-200 dark:bg-amber-800">
                             <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase">Global Announcement</label>
                        <input type="text" placeholder="e.g., Scheduled downtime at 2 AM..." className="w-full p-2 border border-amber-200 dark:border-amber-800 rounded bg-white dark:bg-slate-900 text-sm placeholder:text-slate-400" />
                     </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
