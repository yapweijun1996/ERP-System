
import React, { useState, useMemo } from 'react';
import { MOCK_FINANCE } from '../../constants';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId } from '../../types';
import { ArrowUpRight, ArrowDownLeft, Receipt, Calendar, Download, Plus, Save, Search } from 'lucide-react';
import { Modal } from '../../components/UI/Modal';

export const FinanceList: React.FC = () => {
  const [isTxModalOpen, setTxModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFinance = useMemo(() => {
    return MOCK_FINANCE.filter(item => 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const totalIncome = MOCK_FINANCE.filter(t => t.type === 'Income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = MOCK_FINANCE.filter(t => t.type === 'Expense').reduce((acc, curr) => acc + Math.abs(curr.amount), 0);

  return (
    <FeatureGuard moduleId={ModuleId.FINANCE}>
      <div className="flex flex-col h-full p-4 md:p-6 gap-6 pb-20 md:pb-6">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financials</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">General Ledger & Transactions</p>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={() => setTxModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
            >
                <Plus className="w-4 h-4" /> New Entry
            </button>
            <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2">
                <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Income</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 mt-1">${totalIncome.toLocaleString()}</h3>
                <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded w-fit flex items-center">
                    <ArrowUpRight className="w-3 h-3 mr-1" /> +12% this month
                </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Expenses</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">${totalExpense.toLocaleString()}</h3>
                <div className="mt-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded w-fit flex items-center">
                    <ArrowUpRight className="w-3 h-3 mr-1" /> +5% this month
                </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Profit</p>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-500 mt-1">${(totalIncome - totalExpense).toLocaleString()}</h3>
                <p className="text-xs text-slate-400 mt-2">YTD Calculation</p>
            </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col transition-colors min-h-0">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
             <span className="font-semibold text-slate-800 dark:text-slate-200">Recent Transactions</span>
             <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search entries..." 
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                />
             </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Description</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFinance.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> {trx.date}
                        </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${trx.type === 'Income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                {trx.type === 'Income' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            </div>
                            {trx.description}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{trx.category}</td>
                    <td className="px-6 py-4">
                        <StatusBadge status={trx.status} />
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${trx.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {trx.type === 'Expense' ? '-' : '+'}${Math.abs(trx.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Modal */}
        <Modal
            isOpen={isTxModalOpen}
            onClose={() => setTxModalOpen(false)}
            title="Record Transaction"
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Type</label>
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <button className="flex-1 py-1 text-sm font-medium bg-white dark:bg-slate-700 shadow-sm rounded-md text-slate-800 dark:text-white">Expense</button>
                            <button className="flex-1 py-1 text-sm font-medium text-slate-500">Income</button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Amount</label>
                        <input type="number" placeholder="0.00" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                    <input type="text" placeholder="e.g. Office Supplies" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Category</label>
                        <select className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm">
                            <option>Office Expenses</option>
                            <option>Travel</option>
                            <option>Payroll</option>
                            <option>Software</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Date</label>
                        <input type="date" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <button 
                        onClick={() => setTxModalOpen(false)}
                        className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => setTxModalOpen(false)}
                        className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center"
                    >
                        <Save className="w-4 h-4 mr-2" /> Save Entry
                    </button>
                </div>
            </div>
        </Modal>

      </div>
    </FeatureGuard>
  );
};
