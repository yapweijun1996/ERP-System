import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, Check, Plus, Trash2 } from 'lucide-react';
import { Permission, Role } from '../../types';

export const RoleManagement: React.FC = () => {
    const { roles, addRole, updateRole } = useApp();
    const [selectedRole, setSelectedRole] = useState<Role>(roles[0]);

    const allPermissions: Permission[] = [
        'SALES_VIEW', 'SALES_CREATE', 'SALES_EDIT', 'SALES_POST', 'SALES_VOID', 'SALES_DISCOUNT_APPROVE',
        'INV_VIEW', 'INV_ADJUST', 'FIN_VIEW', 'FIN_POST', 'ORG_MANAGE_EMPLOYEES', 'ORG_MANAGE_ROLES'
    ];

    const groupedPermissions = {
        'Sales': allPermissions.filter(p => p.startsWith('SALES')),
        'Inventory': allPermissions.filter(p => p.startsWith('INV')),
        'Finance': allPermissions.filter(p => p.startsWith('FIN')),
        'Organization': allPermissions.filter(p => p.startsWith('ORG')),
    };

    const togglePermission = (perm: Permission) => {
        if (selectedRole.scope === 'SYSTEM' && selectedRole.id === 'ROLE_ADMIN') return; // Protect Admin

        const has = selectedRole.permissions.includes(perm);
        const newPerms = has 
            ? selectedRole.permissions.filter(p => p !== perm)
            : [...selectedRole.permissions, perm];
        
        const updated = { ...selectedRole, permissions: newPerms };
        setSelectedRole(updated);
        updateRole(updated);
    };

    return (
        <div className="flex flex-col h-full space-y-4 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Role Management</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Define access rights and duties</p>
                </div>
                <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
                    <Plus className="w-4 h-4" />
                    <span>New Role</span>
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 h-[600px]">
                {/* Role List */}
                <div className="w-full md:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                        Roles
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {roles.map(role => (
                            <button
                                key={role.id}
                                onClick={() => setSelectedRole(role)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedRole.id === role.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                {role.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Matrix */}
                <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{selectedRole.name}</h2>
                                <p className="text-sm text-slate-500">{selectedRole.description}</p>
                            </div>
                            {selectedRole.scope === 'SYSTEM' && (
                                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded font-medium border border-amber-200 dark:border-amber-800">System Role</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {Object.entries(groupedPermissions).map(([group, perms]) => (
                            <div key={group}>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{group}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {perms.map(perm => {
                                        const isEnabled = selectedRole.permissions.includes(perm);
                                        return (
                                            <div 
                                                key={perm}
                                                onClick={() => togglePermission(perm)}
                                                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${isEnabled ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60 hover:opacity-100'}`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${isEnabled ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                                    {isEnabled && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={`text-sm ${isEnabled ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>
                                                    {perm.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};