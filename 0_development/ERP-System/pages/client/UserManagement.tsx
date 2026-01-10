import React from 'react';
import { MOCK_USERS } from '../../constants';
import { Users, Plus, MoreHorizontal, Mail, Shield } from 'lucide-react';
import { StatusBadge } from '../../components/UI/StatusBadge';

export const UserManagement: React.FC = () => {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage access and roles</p>
        </div>
        <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">User</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Role</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {MOCK_USERS.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            {user.name.charAt(0)}
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {user.email}
                            </div>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-fit">
                        <Shield className="w-3 h-3 text-slate-400" />
                        <span>{user.roles.length > 0 ? user.roles[0].replace('ROLE_', '') : 'No Role'}</span>
                    </div>
                    {user.roles.length > 1 && (
                      <div className="text-xs text-slate-400 mt-1">
                        +{user.roles.length - 1} more
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {user.lastLogin}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};