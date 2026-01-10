
import React, { useState } from 'react';
import { CheckCircle, Building, MapPin, Globe, CreditCard, ToggleRight, UserPlus, X } from 'lucide-react';
import { ModuleId, FeatureFlags } from '../../types';
import { DEFAULT_FEATURES } from '../../constants';

// --- STEP 1: COMPANY BASICS ---
export const StepCompanyBasics = ({ data, onChange }: { data: any, onChange: (d: any) => void }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Legal Entity Name</label>
                <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={data.name}
                        onChange={e => onChange({ ...data, name: e.target.value })}
                        className="w-full pl-10 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Acme Corp Pte Ltd"
                    />
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Registration ID (Tax/SSM/UEN)</label>
                <input
                    type="text"
                    value={data.regId}
                    onChange={e => onChange({ ...data, regId: e.target.value })}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none"
                    placeholder="e.g. 2023000123A"
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Registered Address</label>
                <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                        value={data.address}
                        onChange={e => onChange({ ...data, address: e.target.value })}
                        className="w-full pl-10 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none resize-none"
                        rows={3}
                        placeholder="Full business address..."
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Base Currency</label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={data.currency}
                            onChange={e => onChange({ ...data, currency: e.target.value })}
                            className="w-full pl-10 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none appearance-none"
                        >
                            <option value="USD">USD - US Dollar</option>
                            <option value="MYR">MYR - Malaysian Ringgit</option>
                            <option value="SGD">SGD - Singapore Dollar</option>
                            <option value="CNY">CNY - Chinese Yuan</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Timezone</label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={data.timezone}
                            onChange={e => onChange({ ...data, timezone: e.target.value })}
                            className="w-full pl-10 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none appearance-none"
                        >
                            <option value="UTC">UTC (GMT+0)</option>
                            <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (GMT+8)</option>
                            <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                            <option value="Asia/Shanghai">Asia/Shanghai (GMT+8)</option>
                            <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                            <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                            <option value="Europe/London">Europe/London (GMT+0/+1)</option>
                            <option value="Europe/Paris">Europe/Paris (GMT+1/+2)</option>
                            <option value="Europe/Berlin">Europe/Berlin (GMT+1/+2)</option>
                            <option value="America/New_York">America/New_York (GMT-5/-4)</option>
                            <option value="America/Chicago">America/Chicago (GMT-6/-5)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (GMT-8/-7)</option>
                            <option value="Australia/Sydney">Australia/Sydney (GMT+10/+11)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// --- STEP 2: MODULES ---
// --- STEP 2: MODULES ---
const MODULE_DESCRIPTIONS: Record<string, string> = {
    SALES: 'Manage quotes, orders, and customer relationships.',
    INVENTORY: 'Track stock levels, warehouses, and product movements.',
    FINANCE: 'Comprehensive accounting, invoicing, and expenses tracking.',
    HR: 'Employee directory, payroll, and leave management.',
    CRM: 'Customer interaction tracking and lead management.',
    MANUFACTURING: 'Production planning, BOMs, and work orders.',
    PROJECTS: 'Task management, time tracking, and project planning.',
    MASTER_DATA: 'Essential shared data like Products and Customers.'
};

export const StepModules = ({ features, onChange }: { features: FeatureFlags, onChange: (f: FeatureFlags) => void }) => {
    const modules = Object.values(ModuleId);

    const toggle = (mid: ModuleId) => {
        onChange({ ...features, [mid]: !features[mid] });
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            {modules.map(mod => (
                <div key={mod} onClick={() => toggle(mod)} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${features[mod] ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${features[mod] ? 'bg-blue-100 dark:bg-blue-800 text-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                            <ToggleRight className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 capitalize">{mod.replace('_', ' ').toLowerCase()}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 pr-4">{MODULE_DESCRIPTIONS[mod] || 'Standard system module'}</p>
                            <p className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${features[mod] ? 'text-blue-600' : 'text-slate-400'}`}>
                                {features[mod] ? 'Enabled' : 'Disabled'}
                            </p>
                        </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors flex-shrink-0 ${features[mod] ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${features[mod] ? 'translate-x-6' : ''}`}></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- STEP 3: TEAM ---
export const StepTeam = ({ invites, onAdd, onRemove }: { invites: any[], onAdd: (email: string, role: string) => void, onRemove: (idx: number) => void }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('User');

    const handleAdd = () => {
        if (email) {
            onAdd(email, role);
            setEmail('');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex gap-2">
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none"
                />
                <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-32 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none"
                >
                    <option value="Admin">Admin</option>
                    <option value="User">User</option>
                    <option value="Viewer">Viewer</option>
                </select>
                <button onClick={handleAdd} className="bg-slate-800 dark:bg-slate-700 text-white p-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition">
                    <UserPlus className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {invites.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        No invitations yet. You can add them later.
                    </div>
                )}
                {invites.map((inv, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {inv.email[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{inv.email}</p>
                                <p className="text-xs text-slate-500">{inv.role}</p>
                            </div>
                        </div>
                        <button onClick={() => onRemove(idx)} className="text-slate-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
