
import React, { useState, useMemo } from 'react';
import { MOCK_PURCHASE_ORDERS, MOCK_SUPPLIERS } from '../../constants';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId } from '../../types';
import { Plus, Search, Factory, FileText, Save, Truck, Receipt } from 'lucide-react';
import { Modal } from '../../components/UI/Modal';
import { useApp } from '../../context/AppContext';

interface PurchasingListProps {
    onNavigate: (page: string, id?: string) => void;
    viewType?: 'PO' | 'GRN' | 'BILLS';
}

export const PurchasingList: React.FC<PurchasingListProps> = ({ onNavigate, viewType = 'PO' }) => {
  const { addToast } = useApp();
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  const getPageTitle = () => {
      switch(viewType) {
          case 'PO': return 'Purchase Orders';
          case 'GRN': return 'Goods Receive Notes';
          case 'BILLS': return 'Supplier Bills';
          default: return 'Purchasing';
      }
  };

  const handleCreatePO = () => {
      addToast('Document Created', 'Draft has been created successfully.', 'success');
      setCreateModalOpen(false);
  };

  return (
    <FeatureGuard moduleId={ModuleId.PURCHASING}>
      <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{getPageTitle()}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Procurement and Supplier Orders</p>
          </div>
          <button 
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create {viewType === 'PO' ? 'PO' : 'Document'}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col transition-colors min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              placeholder="Search..." 
              className="flex-1 outline-none text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" 
            />
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Document</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Supplier</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Date</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Total</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {MOCK_PURCHASE_ORDERS.map((po) => (
                  <tr 
                    key={po.id} 
                    onClick={() => onNavigate('purchasing-detail', po.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400">
                        <div className="flex items-center space-x-2">
                            {viewType === 'PO' ? <FileText className="w-4 h-4" /> : viewType === 'GRN' ? <Truck className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                            <span>{po.id}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                            <Factory className="w-4 h-4 text-slate-400" />
                            {po.supplierName}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{po.date}</td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-medium text-right">${po.total.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={po.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create PO Modal */}
        <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setCreateModalOpen(false)}
            title={`Create ${viewType === 'PO' ? 'Purchase Order' : 'Document'}`}
            size="lg"
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Supplier</label>
                        <select className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm">
                            <option value="" disabled selected>Select Supplier</option>
                            {MOCK_SUPPLIERS.map(sup => (
                                <option key={sup.id} value={sup.id}>{sup.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Expected Date</label>
                        <input type="date" className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                    </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 text-center text-slate-500 text-sm">
                    <p>Line item selection enabled after selecting a supplier.</p>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={() => setCreateModalOpen(false)}
                        className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleCreatePO}
                        className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center shadow-sm"
                    >
                        <Save className="w-4 h-4 mr-2" /> Save Draft
                    </button>
                </div>
            </div>
        </Modal>

      </div>
    </FeatureGuard>
  );
};
