import React, { useState, useEffect } from 'react';
import { Shield, Check, Plus, Trash2, RefreshCw, Users as UsersIcon, Save } from 'lucide-react';
import { adminApi, Role, Permission, User } from '../../api/admin';
import { useApp } from '../../context/AppContext';

export const RoleManagement: React.FC = () => {
    const { addToast } = useApp();
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeView, setActiveView] = useState<'roles' | 'users'>('roles');

    // Fetch data
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rolesData, permsData, usersData] = await Promise.all([
                adminApi.getRoles(),
                adminApi.getPermissions(),
                adminApi.getUsers()
            ]);
            setRoles(rolesData.roles);
            setPermissions(permsData.permissions);
            setUsers(usersData.users);

            if (rolesData.roles.length > 0 && !selectedRole) {
                const firstRole = rolesData.roles[0];
                setSelectedRole(firstRole);
                setSelectedPermissions(firstRole.permissions || []);
            }
        } catch (error: any) {
            console.error('Failed to load data:', error);
            addToast('Error', error.message || 'Failed to load roles and permissions', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Group permissions by module
    const groupedPermissions = permissions.reduce((acc, perm) => {
        if (!acc[perm.module]) {
            acc[perm.module] = [];
        }
        acc[perm.module].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    const togglePermission = (permCode: string) => {
        if (selectedRole?.is_system_role) {
            addToast('Warning', 'Cannot modify system roles', 'warning');
            return;
        }

        setSelectedPermissions(prev =>
            prev.includes(permCode)
                ? prev.filter(p => p !== permCode)
                : [...prev, permCode]
        );
    };

    const handleSavePermissions = async () => {
        if (!selectedRole) return;

        setSaving(true);
        try {
            const result = await adminApi.updateRolePermissions(selectedRole.id, selectedPermissions);
            addToast('Success', result.message, 'success');
            await fetchData(); // Refresh data
        } catch (error: any) {
            console.error('Failed to save permissions:', error);
            addToast('Error', error.message || 'Failed to save permissions', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleRoleSelect = (role: Role) => {
        setSelectedRole(role);
        setSelectedPermissions(role.permissions || []);
    };

    const hasChanges = selectedRole &&
        JSON.stringify([...selectedPermissions].sort()) !==
        JSON.stringify([...(selectedRole.permissions || [])].sort());

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-4 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Role & Permission Management</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Define access rights and assign roles to users</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* View Tabs */}
            <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveView('roles')}
                    className={`px-4 py-2 border-b-2 text-sm font-medium transition-colors ${activeView === 'roles'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    <Shield className="w-4 h-4 inline mr-2" />
                    Roles & Permissions
                </button>
                <button
                    onClick={() => setActiveView('users')}
                    className={`px-4 py-2 border-b-2 text-sm font-medium transition-colors ${activeView === 'users'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    <UsersIcon className="w-4 h-4 inline mr-2" />
                    User Assignments
                </button>
            </div>

            {activeView === 'roles' ? (
                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                    {/* Role List */}
                    <div className="w-full md:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                            Roles ({roles.length})
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {roles.map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => handleRoleSelect(role)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedRole?.id === role.id
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span>{role.name}</span>
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                            {role.permission_count || 0}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Permission Matrix */}
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden">
                        {selectedRole && (
                            <>
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{selectedRole.name}</h2>
                                            <p className="text-sm text-slate-500">{selectedRole.description}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {selectedRole.is_system_role && (
                                                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded font-medium border border-amber-200 dark:border-amber-800">
                                                    System Role
                                                </span>
                                            )}
                                            {hasChanges && (
                                                <button
                                                    onClick={handleSavePermissions}
                                                    disabled={saving}
                                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    {saving ? 'Saving...' : 'Save Changes'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                    {Object.entries(groupedPermissions).map(([module, perms]) => (
                                        <div key={module}>
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{module}</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {(perms as Permission[]).map(perm => {
                                                    const isEnabled = selectedPermissions.includes(perm.code);
                                                    return (
                                                        <div
                                                            key={perm.code}
                                                            onClick={() => togglePermission(perm.code)}
                                                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${isEnabled
                                                                ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm'
                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60 hover:opacity-100'
                                                                } ${selectedRole.is_system_role ? 'cursor-not-allowed' : ''}`}
                                                        >
                                                            <div
                                                                className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${isEnabled
                                                                    ? 'bg-blue-600 border-blue-600'
                                                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                                                                    }`}
                                                            >
                                                                {isEnabled && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className={`text-sm ${isEnabled ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>
                                                                    {perm.code.replace(/_/g, ' ')}
                                                                </span>
                                                                {perm.description && (
                                                                    <p className="text-xs text-slate-400 mt-0.5">{perm.description}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">User Role Assignments</h3>
                    <div className="space-y-2">
                        {users.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">{user.name}</p>
                                    <p className="text-sm text-slate-500">@{user.username}</p>
                                </div>
                                <div className="flex gap-2">
                                    {(user.role_names as string[] | undefined)?.map((roleName, idx) => (
                                        <span key={idx} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded">
                                            {roleName}
                                        </span>
                                    )) || <span className="text-sm text-slate-400">No roles assigned</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};