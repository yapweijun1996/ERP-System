
import React from 'react';
import { MOCK_TASKS, MOCK_ORDERS } from '../../../constants';
import { StatusBadge } from '../../../components/UI/StatusBadge';
import { CheckCircle, AlertTriangle, FileText, TrendingUp, Clock, Plus } from 'lucide-react';

export const SalesWorkspace: React.FC = () => {
  const myTasks = MOCK_TASKS.filter(t => t.workspace === 'SALES');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
               <p className="text-blue-100 font-medium">Monthly Revenue</p>
               <h3 className="text-3xl font-bold mt-2">$84,230</h3>
               <div className="mt-4 flex items-center text-sm text-blue-200 bg-blue-800/30 w-fit px-2 py-1 rounded">
                 <TrendingUp className="w-4 h-4 mr-1" /> +14% vs Target
               </div>
            </div>
            <div className="p-3 bg-white/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
           <div>
               <p className="text-slate-500 dark:text-slate-400 font-medium">Pending Approvals</p>
               <h3 className="text-3xl font-bold mt-2 text-slate-800 dark:text-white">5</h3>
           </div>
           <div className="mt-4 text-sm text-slate-500">
             3 Quotes require margin approval
           </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
           <div>
               <p className="text-slate-500 dark:text-slate-400 font-medium">Open Opportunities</p>
               <h3 className="text-3xl font-bold mt-2 text-slate-800 dark:text-white">12</h3>
           </div>
           <div className="mt-4 text-sm text-slate-500">
             $450k in pipeline closing this month
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Work Queue */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600" /> My Tasks
                  </h3>
                  <button className="text-sm text-blue-600 dark:text-blue-400 font-medium">View All</button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                 {myTasks.length === 0 ? (
                     <div className="p-6 text-center text-slate-500">No pending tasks. Great job!</div>
                 ) : myTasks.map(task => (
                    <div key={task.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between group cursor-pointer transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${task.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/20' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/20'}`}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200">{task.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Due today • {task.count} items</p>
                            </div>
                        </div>
                        <button className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-600 dark:text-slate-300">
                            Action
                        </button>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                   <h3 className="font-bold text-slate-800 dark:text-slate-100">Recent Orders</h3>
               </div>
               <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                           <tr>
                               <th className="px-6 py-3">Order</th>
                               <th className="px-6 py-3">Customer</th>
                               <th className="px-6 py-3">Status</th>
                               <th className="px-6 py-3 text-right">Amount</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                           {MOCK_ORDERS.map(order => (
                               <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                   <td className="px-6 py-3 font-medium text-blue-600 dark:text-blue-400">{order.id}</td>
                                   <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{order.customerName}</td>
                                   <td className="px-6 py-3"><StatusBadge status={order.status} /></td>
                                   <td className="px-6 py-3 text-right text-slate-800 dark:text-slate-200 font-medium">${order.total.toLocaleString()}</td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                 <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" /> Exceptions
                 </h3>
                 <ul className="space-y-3">
                     <li className="flex justify-between items-center text-sm p-2 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/20">
                         <span className="text-red-700 dark:text-red-400">Credit Hold: Acme Corp</span>
                         <span className="font-bold text-red-700 dark:text-red-400">Overdue</span>
                     </li>
                     <li className="flex justify-between items-center text-sm p-2 bg-amber-50 dark:bg-amber-900/10 rounded border border-amber-100 dark:border-amber-900/20">
                         <span className="text-amber-700 dark:text-amber-400">Expiring Quotes</span>
                         <span className="font-bold text-amber-700 dark:text-amber-400">4</span>
                     </li>
                 </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Quick Links</h3>
                <div className="space-y-2">
                    <button className="w-full flex items-center text-sm p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition">
                        <Plus className="w-4 h-4 mr-2 text-blue-500" /> Create Quotation
                    </button>
                    <button className="w-full flex items-center text-sm p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition">
                        <FileText className="w-4 h-4 mr-2 text-blue-500" /> Customer Price List
                    </button>
                    <button className="w-full flex items-center text-sm p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition">
                        <Clock className="w-4 h-4 mr-2 text-blue-500" /> Sales History
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};