
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Plus, User, Briefcase, Mail, Filter } from 'lucide-react';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId } from '../../types';

interface EmployeeListProps {
    onNavigate: (page: string, id?: string) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({ onNavigate }) => {
    const { employees, departments } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDept, setFilterDept] = useState<string>('ALL');

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesSearch = 
                emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                emp.email.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesDept = filterDept === 'ALL' || emp.departmentId === filterDept;

            return matchesSearch && matchesDept;
        });
    }, [employees, searchTerm, filterDept]);

    const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id;

    return (
        <FeatureGuard moduleId={ModuleId.ORGANIZATION}>
            <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Directory</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Organization people and structure</p>
                    </div>
                    <button 
                        onClick={() => onNavigate('employee-detail', 'new')}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Employee</span>
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-2 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                        />
                    </div>
                    <select 
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="p-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-600 dark:text-slate-300"
                    >
                        <option value="ALL">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredEmployees.map(emp => (
                            <div 
                                key={emp.id} 
                                onClick={() => onNavigate('employee-detail', emp.id)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-800 shadow-sm">
                                            {emp.firstName[0]}{emp.lastName[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{emp.firstName} {emp.lastName}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{emp.jobTitle}</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={emp.status} />
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                                        <Briefcase className="w-4 h-4 mr-2 opacity-70" />
                                        <span>{getDepartmentName(emp.departmentId)}</span>
                                    </div>
                                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                                        <Mail className="w-4 h-4 mr-2 opacity-70" />
                                        <span>{emp.email}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <div className="text-xs text-slate-400">ID: <span className="font-mono">{emp.id}</span></div>
                                    {emp.userId ? (
                                        <span className="text-xs flex items-center text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                                            <User className="w-3 h-3 mr-1" /> User Linked
                                        </span>
                                    ) : (
                                        <span className="text-xs flex items-center text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                                            No Login
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </FeatureGuard>
    );
};
