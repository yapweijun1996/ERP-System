
import React, { useMemo } from 'react';
import { DetailLayout } from '../../components/UI/DetailLayout';
import { TimelineEvent, RelatedDoc } from '../../types';
import { MOCK_PURCHASE_ORDERS } from '../../constants';
import { Printer, CheckCircle, AlertCircle } from 'lucide-react';

interface PurchasingDetailProps {
  id: string;
  onBack: () => void;
}

export const PurchasingDetail: React.FC<PurchasingDetailProps> = ({ id, onBack }) => {
  const po = useMemo(() => MOCK_PURCHASE_ORDERS.find(p => p.id === id), [id]);

  if (!po) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
          <h2 className="text-xl font-semibold">PO Not Found</h2>
          <button onClick={onBack} className="text-blue-600 hover:underline mt-2">Go Back</button>
        </div>
    );
  }

  const mockTimeline: TimelineEvent[] = [
    { id: '1', date: `${po.date}, 09:00 AM`, user: 'Purchasing Mgr', action: 'PO Created' },
    { id: '2', date: `${po.date}, 02:00 PM`, user: 'System', action: 'Email Sent to Supplier' },
  ];

  const mockRelated: RelatedDoc[] = [
    { id: `GRN-${id.split('-')[1]}`, type: 'Goods Receipt', status: 'Pending' },
  ];

  const Actions = (
    <div className="flex items-center space-x-2">
      <button className="hidden sm:flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
        <Printer className="w-4 h-4 mr-2" /> Print
      </button>
      <button className="flex items-center px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
        <CheckCircle className="w-4 h-4 mr-2" /> Receive
      </button>
    </div>
  );

  const MainContent = (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase">Supplier</label>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{po.supplierName}</div>
            <div className="text-sm text-slate-500">Vendor Ref: {po.supplierName.substring(0,3).toUpperCase()}-001</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase">PO Date</label>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{po.date}</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase">Warehouse</label>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">Main Hub (SF)</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-100">
            Line Items
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-medium border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3">Item</th>
              <th className="px-6 py-3 text-right">Qty</th>
              <th className="px-6 py-3 text-right">Unit Cost</th>
              <th className="px-6 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr>
              <td className="px-6 py-4">
                <div className="font-medium text-slate-800 dark:text-slate-200">Standard Material Order</div>
                <div className="text-xs text-slate-400">SKU: GEN-MAT-01</div>
              </td>
              <td className="px-6 py-4 text-right text-slate-800 dark:text-slate-200">1</td>
              <td className="px-6 py-4 text-right text-slate-800 dark:text-slate-200">${po.total.toLocaleString()}</td>
              <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-slate-100">${po.total.toLocaleString()}</td>
            </tr>
          </tbody>
          <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
             <tr>
              <td colSpan={3} className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-100">Total</td>
              <td className="px-6 py-4 text-right font-bold text-blue-600 dark:text-blue-400">${po.total.toLocaleString()}</td>
             </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  return (
    <DetailLayout
      title="Purchase Order"
      id={id}
      status={po.status}
      onBack={onBack}
      actions={Actions}
      mainContent={MainContent}
      timeline={mockTimeline}
      relatedDocs={mockRelated}
    />
  );
};
