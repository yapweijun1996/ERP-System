
import React from 'react';
import { SalesDocument } from '../../types';
import { ShieldAlert } from 'lucide-react';

interface SalesDocFooterProps {
  doc: SalesDocument;
  setDoc: (doc: SalesDocument) => void;
  approvalTriggered: boolean;
}

export const SalesDocFooter: React.FC<SalesDocFooterProps> = ({ doc, setDoc, approvalTriggered }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase">Internal Notes</label>
          <textarea 
            rows={3}
            value={doc.remarks || ''}
            onChange={(e) => setDoc({...doc, remarks: e.target.value})}
            className="w-full mt-1 p-2 text-sm bg-slate-50 dark:bg-slate-800 border-none rounded resize-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
            placeholder="Add notes visible to team only..."
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Subtotal (Gross)</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{doc.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total Discount</span>
          <span className="font-medium text-red-500">-{doc.discountTotal.toFixed(2)}</span>
        </div>
        
        {approvalTriggered && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 text-xs rounded">
            <ShieldAlert className="w-3 h-3" />
            <span>Discount exceeds approval threshold (10%)</span>
          </div>
        )}
        
        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
        
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Taxable Amount</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{doc.taxableAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total Tax</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{doc.taxTotal.toFixed(2)}</span>
        </div>
        
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
        
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-slate-800 dark:text-white">Grand Total</span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{doc.currency} {doc.grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
