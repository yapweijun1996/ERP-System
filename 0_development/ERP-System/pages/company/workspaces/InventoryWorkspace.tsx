
import React from 'react';
import { MOCK_TASKS, MOCK_INVENTORY } from '../../../constants';
import { StatusBadge } from '../../../components/UI/StatusBadge';
import { Package, AlertOctagon, Truck, ArrowRightLeft } from 'lucide-react';

export const InventoryWorkspace: React.FC = () => {
  const myTasks = MOCK_TASKS.filter(t => t.workspace === 'INVENTORY');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">Stock Value</div>
             <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">$1.2M</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">To Receive</div>
             <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">14 Orders</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">To Ship</div>
             <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">8 Orders</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1">Stock Low</div>
             <div className="text-2xl font-bold text-red-600 dark:text-red-500">4 SKUs</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Work Queue */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-blue-600" /> Inbound / Outbound Queue
                  </h3>
              </div>
              <div className="p-4 grid gap-4">
                 {myTasks.length === 0 ? (
                    <div className="text-center py-4 text-slate-500">Queue empty.</div>
                 ) : myTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center gap-4">
                           <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400">
                              <Package className="w-6 h-6" />
                           </div>
                           <div>
                              <h4 className="font-bold text-slate-800 dark:text-slate-200">{task.title}</h4>
                              <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                 <span>{task.count} Pending</span>
                                 <span className="text-slate-300">•</span>
                                 <span className={`${task.priority === 'high' ? 'text-red-500' : 'text-amber-500'}`}>Priority: {task.priority}</span>
                              </div>
                           </div>
                        </div>
                        <button className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition">Process</button>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                   <h3 className="font-bold text-slate-800 dark:text-slate-100">Stock Alerts</h3>
               </div>
               <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                           <tr>
                               <th className="px-6 py-3">SKU</th>
                               <th className="px-6 py-3">Name</th>
                               <th className="px-6 py-3 text-right">On Hand</th>
                               <th className="px-6 py-3 text-center">Status</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                           {MOCK_INVENTORY.filter(i => i.stock < 100).map(item => (
                               <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                   <td className="px-6 py-3 font-mono text-slate-500">{item.sku}</td>
                                   <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{item.name}</td>
                                   <td className="px-6 py-3 text-right font-bold text-slate-800 dark:text-slate-200">{item.stock}</td>
                                   <td className="px-6 py-3 text-center">
                                       <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/30">Low Stock</span>
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
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                 <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                    <ArrowRightLeft className="w-4 h-4 mr-2 text-slate-500" /> Recent Movements
                 </h3>
                 <div className="space-y-4">
                     {[1,2,3].map(i => (
                         <div key={i} className="flex gap-3 items-start border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                             <div className="text-xs text-slate-400 dark:text-slate-500">10:30 AM</div>
                             <div>
                                 <p className="text-sm font-medium text-slate-800 dark:text-slate-200">GRN-8821 Received</p>
                                 <p className="text-xs text-slate-500">Supplier: Steel Works Ltd</p>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};