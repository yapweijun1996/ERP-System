
import React from 'react';
import { MOCK_TASKS, MOCK_FINANCE } from '../../../constants';
import { StatusBadge } from '../../../components/UI/StatusBadge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DollarSign, FileText, ArrowUpRight } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const FinanceWorkspace: React.FC = () => {
  const myTasks = MOCK_TASKS.filter(t => t.workspace === 'FINANCE');

  const cashFlowData = [
      { name: 'Operations', value: 400 },
      { name: 'Investments', value: 300 },
      { name: 'Financing', value: 300 },
      { name: 'Other', value: 200 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-600 rounded-xl p-6 text-white shadow-md">
            <p className="text-emerald-100 font-medium">Cash Position</p>
            <h3 className="text-3xl font-bold mt-2">$245,000</h3>
            <p className="text-sm text-emerald-100 mt-2 opacity-80">Available in operating accounts</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 font-medium">Accounts Receivable</p>
            <h3 className="text-3xl font-bold mt-2 text-slate-800 dark:text-white">$82,400</h3>
            <div className="mt-2 text-xs text-red-500 font-medium">
                $12k Overdue > 30 days
            </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 font-medium">Accounts Payable</p>
            <h3 className="text-3xl font-bold mt-2 text-slate-800 dark:text-white">$34,100</h3>
            <div className="mt-2 text-xs text-slate-500">
                Next run: Friday
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Work Queue */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" /> Approvals & Reviews
                  </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                 {myTasks.map(task => (
                    <div key={task.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200">{task.title}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{task.count} items awaiting review</p>
                        </div>
                        <button className="px-3 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Review
                        </button>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                   <h3 className="font-bold text-slate-800 dark:text-slate-100">Recent Postings</h3>
               </div>
               <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                           <tr>
                               <th className="px-6 py-3">Date</th>
                               <th className="px-6 py-3">Description</th>
                               <th className="px-6 py-3 text-right">Amount</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                           {MOCK_FINANCE.map(trx => (
                               <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                   <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{trx.date}</td>
                                   <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{trx.description}</td>
                                   <td className={`px-6 py-3 text-right font-bold ${trx.type === 'Income' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                       {trx.type === 'Expense' ? '-' : ''}${Math.abs(trx.amount).toLocaleString()}
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col items-center">
                 <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2 w-full text-left">Expense Breakdown</h3>
                 <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={cashFlowData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {cashFlowData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="grid grid-cols-2 gap-2 w-full mt-4">
                     {cashFlowData.map((d, i) => (
                         <div key={d.name} className="flex items-center text-xs text-slate-500">
                             <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[i] }}></div>
                             {d.name}
                         </div>
                     ))}
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};