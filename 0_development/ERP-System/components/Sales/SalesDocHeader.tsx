
import React from 'react';
import { SalesDocument, Customer, Company } from '../../types';

interface SalesDocHeaderProps {
  doc: SalesDocument;
  isLocked: boolean;
  activeCompany: Company | null;
  customers: Customer[];
  updateHeader: (field: keyof SalesDocument, value: any) => void;
}

export const SalesDocHeader: React.FC<SalesDocHeaderProps> = ({ 
  doc, isLocked, activeCompany, customers, updateHeader 
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Customer</label>
            {isLocked ? (
              <div className="font-medium text-slate-900 dark:text-white p-2 bg-slate-50 dark:bg-slate-800 rounded border border-transparent">
                {doc.customerName}
              </div>
            ) : (
              <select 
                value={doc.customerId} 
                onChange={(e) => updateHeader('customerId', e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select Customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Doc Date</label>
              <input 
                type="date" 
                value={doc.date}
                disabled={isLocked}
                onChange={(e) => updateHeader('date', e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Due Date</label>
              <input 
                type="date" 
                value={doc.dueDate}
                disabled={isLocked}
                onChange={(e) => updateHeader('dueDate', e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="md:col-span-2 space-y-4 border-l border-slate-100 dark:border-slate-800 pl-0 md:pl-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Reference / PO</label>
              <input 
                type="text" 
                value={doc.customerPO || ''}
                disabled={isLocked}
                onChange={(e) => updateHeader('customerPO', e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Currency</label>
              <div className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300">
                {doc.currency}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Billing Address</label>
            <div className="text-sm text-slate-500 dark:text-slate-400 p-2 bg-slate-50 dark:bg-slate-800/50 rounded h-16 overflow-y-auto">
              {doc.billingAddress ? `${doc.billingAddress.street}, ${doc.billingAddress.city}, ${doc.billingAddress.state}` : '...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
