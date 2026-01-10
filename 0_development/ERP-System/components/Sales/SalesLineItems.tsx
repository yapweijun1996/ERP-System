
import React from 'react';
import { Trash2, Plus, FileText } from 'lucide-react';
import { SalesLineItem, InventoryItem, TaxCode } from '../../types';

interface SalesLineItemsProps {
  items: SalesLineItem[];
  isLocked: boolean;
  inventory: InventoryItem[];
  taxCodes: TaxCode[];
  onUpdateLine: (id: string, field: keyof SalesLineItem, value: any) => void;
  onRemoveLine: (id: string) => void;
  onAddLine: () => void;
}

export const SalesLineItems: React.FC<SalesLineItemsProps> = ({ 
  items, isLocked, inventory, taxCodes, onUpdateLine, onRemoveLine, onAddLine 
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Order Lines
            </h3>
        </div>

        <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="px-4 py-3 w-40">Item</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 w-20 text-right">Qty</th>
                        <th className="px-4 py-3 w-28 text-right">Price</th>
                        <th className="px-4 py-3 w-40 text-center">Discount</th>
                        <th className="px-4 py-3 w-24 text-center">Tax</th>
                        <th className="px-4 py-3 w-32 text-right">Net</th>
                        <th className="px-4 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item) => (
                        <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-2 align-top">
                                {isLocked ? <div className="py-2">{item.stockCode}</div> : (
                                    <select 
                                      value={item.stockCode}
                                      onChange={(e) => onUpdateLine(item.id, 'stockCode', e.target.value)}
                                      className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                                    >
                                        <option value="" disabled>Select...</option>
                                        {inventory.map(i => <option key={i.id} value={i.id}>{i.sku}</option>)}
                                    </select>
                                )}
                            </td>
                            <td className="px-4 py-2 align-top">
                                {isLocked ? <div className="py-2">{item.description}</div> : (
                                    <textarea 
                                      rows={1}
                                      value={item.description}
                                      onChange={(e) => onUpdateLine(item.id, 'description', e.target.value)}
                                      className="w-full p-1.5 bg-transparent border-b border-transparent focus:border-blue-500 outline-none resize-none"
                                    />
                                )}
                            </td>
                            <td className="px-4 py-2 align-top">
                                <input 
                                  type="number"
                                  value={item.qty}
                                  disabled={isLocked}
                                  onChange={(e) => onUpdateLine(item.id, 'qty', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right p-1.5 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-blue-500 outline-none"
                                />
                            </td>
                            <td className="px-4 py-2 align-top">
                                 <input 
                                  type="number"
                                  value={item.unitPrice}
                                  disabled={isLocked}
                                  onChange={(e) => onUpdateLine(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right p-1.5 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-blue-500 outline-none"
                                />
                            </td>
                            <td className="px-4 py-2 align-top">
                                 <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 overflow-hidden">
                                      <input 
                                          type="number"
                                          disabled={isLocked}
                                          value={item.discountValue}
                                          onChange={(e) => onUpdateLine(item.id, 'discountValue', parseFloat(e.target.value) || 0)}
                                          className="w-full min-w-0 p-1.5 text-right outline-none bg-transparent text-xs"
                                      />
                                      <button 
                                          onClick={() => !isLocked && onUpdateLine(item.id, 'discountType', item.discountType === 'PERCENT' ? 'FIXED' : 'PERCENT')}
                                          className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700 flex-shrink-0 w-8 flex justify-center"
                                          title="Toggle Discount Type"
                                      >
                                          {item.discountType === 'PERCENT' ? '%' : '$'}
                                      </button>
                                 </div>
                            </td>
                            <td className="px-4 py-2 align-top text-center">
                                <select
                                  value={item.taxCode}
                                  disabled={isLocked}
                                  onChange={(e) => onUpdateLine(item.id, 'taxCode', e.target.value)}
                                  className="w-full p-1.5 bg-transparent text-xs text-center border-b border-slate-200 dark:border-slate-700 focus:border-blue-500 outline-none"
                                >
                                    {taxCodes.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
                                </select>
                            </td>
                            <td className="px-4 py-2 align-top text-right font-medium text-slate-800 dark:text-slate-200">
                                {item.lineTotal.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 align-top text-center">
                                {!isLocked && (
                                    <button onClick={() => onRemoveLine(item.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {!isLocked && (
                        <tr>
                            <td colSpan={8} className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20">
                                <button onClick={onAddLine} className="flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                                    <Plus className="w-4 h-4 mr-1" /> Add Item Line
                                </button>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};
