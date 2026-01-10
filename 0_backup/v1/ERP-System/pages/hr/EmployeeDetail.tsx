import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, Save, User, Shield, Briefcase, Mail } from 'lucide-react';
import { Employee, Role } from '../../types';

interface EmployeeDetailProps {
    empId: string;
    onBack: () => void;
}

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ empId, onBack }) => {
    const { employees, departments, users, roles, updateEmployee, addToast, activeClient, activeCompany } = useApp();
    const [emp, setEmp] = useState<Employee | null>(null);
    const [linkedUser, setLinkedUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'access'>('profile');

    useEffect(() => {
        const found = employees.find(e => e.id === empId);
        if (found) {
            setEmp({ ...found });
            if (found.userId) {
                const u = users.find(user => user.id === found.userId);
                setLinkedUser(u);
            }
        } else if (empId === 'new') {
            setEmp({
                id: `EMP_${Math.floor(Math.random() * 1000)}`,
                clientId: activeClient?.id || '',
                companyId: activeCompany?.id || '',
                firstName: '',
                lastName: '',
                email: '',
                departmentId: '',
                jobTitle: '',
                status: 'Active',
                joinDate: new Date().toISOString().split('T')[0]
            });
        }
    }, [empId, employees, users, activeClient, activeCompany]);

    const handleSave = () => {
        if (emp) {
            updateEmployee(emp);
            addToast('Employee Saved', 'Profile updated successfully.', 'success');
        }
    };

    const toggleRole = (roleId: string) => {
        // In a real app, we would update the User object via API. 
        // Here we just mock the visual toggle for the prototype.
        if (linkedUser) {
            const hasRole = linkedUser.roles.includes(roleId);
            const newRoles = hasRole 
                ? linkedUser.roles.filter((r: string) => r !== roleId)
                : [...linkedUser.roles, roleId];
            
            setLinkedUser({ ...linkedUser, roles: newRoles });
            // Ideally update context too
        }
    };

    if (!emp) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {emp.firstName} {emp.lastName}
                        </h1>
                        <p className="text-xs text-slate-500">{emp.jobTitle || 'New Employee'}</p>
                    </div>
                </div>
                <button onClick={handleSave} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                    <Save className="w-4 h-4 mr-2" /> Save
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    {/* Tabs */}
                    <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                        <button 
                            onClick={() => setActiveTab('profile')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            Personal Profile
                        </button>
                        <button 
                            onClick={() => setActiveTab('access')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'access' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            System Access
                        </button>
                    </div>

                    {activeTab === 'profile' ? (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <Briefcase className="w-5 h-5 text-blue-600" /> Basic Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">First Name</label>
                                    <input 
                                        type="text" 
                                        value={emp.firstName} 
                                        onChange={e => setEmp({...emp, firstName: e.target.value})}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Last Name</label>
                                    <input 
                                        type="text" 
                                        value={emp.lastName} 
                                        onChange={e => setEmp({...emp, lastName: e.target.value})}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
                                    <input 
                                        type="email" 
                                        value={emp.email} 
                                        onChange={e => setEmp({...emp, email: e.target.value})}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Job Title</label>
                                    <input 
                                        type="text" 
                                        value={emp.jobTitle} 
                                        onChange={e => setEmp({...emp, jobTitle: e.target.value})}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Department</label>
                                    <select 
                                        value={emp.departmentId} 
                                        onChange={e => setEmp({...emp, departmentId: e.target.value})}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                                    >
                                        <option value="">Select...</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Reports To</label>
                                    <select 
                                        value={emp.managerId || ''} 
                                        onChange={e => setEmp({...emp, managerId: e.target.value})}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                                    >
                                        <option value="">None</option>
                                        {employees.filter(e => e.id !== emp.id).map(e => (
                                            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <User className="w-5 h-5 text-blue-600" /> User Account Linkage
                            </h3>
                            
                            {linkedUser ? (
                                <div className="space-y-6">
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-lg flex items-center gap-4">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                                            <Shield className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-emerald-900 dark:text-emerald-100">Linked to Account: {linkedUser.email}</p>
                                            <p className="text-xs text-emerald-700 dark:text-emerald-300">Last login: {linkedUser.lastLogin}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">Assigned Roles</h4>
                                        <div className="space-y-2">
                                            {roles.map(role => {
                                                const isAssigned = linkedUser.roles.includes(role.id);
                                                return (
                                                    <div 
                                                        key={role.id} 
                                                        onClick={() => toggleRole(role.id)}
                                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isAssigned ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
                                                    >
                                                        <div>
                                                            <div className={`font-medium ${isAssigned ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {role.name}
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">{role.description}</div>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${isAssigned ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                                                            {isAssigned && <Shield className="w-3 h-3 text-white" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                    <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h4 className="font-medium text-slate-700 dark:text-slate-200">No User Account Linked</h4>
                                    <p className="text-sm text-slate-500 mb-4">Create a login for this employee to allow system access.</p>
                                    <button className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:opacity-90 transition">
                                        Create User Account
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};