

import React from 'react';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { Save, Printer, ArrowLeft, Copy, RefreshCw, Hash, ShieldAlert, FileText, ChevronDown } from 'lucide-react';
import { PermissionGuard } from '../../components/UI/PermissionGuard';
import { SalesLineItems } from '../../components/Sales/SalesLineItems';
import { SalesDocHeader } from '../../components/Sales/SalesDocHeader';
import { SalesDocFooter } from '../../components/Sales/SalesDocFooter';
import { useSalesLogic } from '../../hooks/useSalesLogic';

interface SalesDetailProps {
  orderId: string;
  onBack: () => void;
}

export const SalesDetail: React.FC<SalesDetailProps> = ({ orderId, onBack }) => {
  const {
      doc, setDoc, isLocked, isPosting,
      selectedSeriesId, setSelectedSeriesId, previewId,
      updateLineItem, addLine, removeLine, updateHeader,
      handleSaveDraft, handlePost, checkApprovalNeeded,
      availableSeries, activeCompany, customers, inventory, taxCodes, hasPermission
  } = useSalesLogic(orderId);

  if (!doc) return <div className="p-8 text-center text-slate-500">Loading document...</div>;

  const approvalTriggered = checkApprovalNeeded();

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header Actions */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 z-20 shadow-sm gap-4">
         <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                 <ArrowLeft className="w-5 h-5" />
             </button>
             <div>
                 <div className="flex items-center gap-3">
                     <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                         {doc.type === 'INV' ? 'Sales Invoice' : 'Sales Order'}
                     </h1>
                     <StatusBadge status={doc.status} />
                 </div>
                 <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>{isLocked ? 'View Only' : 'Editing Mode'}</span>
                    {doc.customerName && <span className="opacity-50">• {doc.customerName}</span>}
                 </div>
             </div>
         </div>
         
         <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
             {isLocked ? (
                 <>
                    <button className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                        <Printer className="w-4 h-4 mr-2" /> Print
                    </button>
                    <PermissionGuard permission="SALES_CREATE" showLock>
                        <button className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                        </button>
                    </PermissionGuard>
                 </>
             ) : (
                 <>
                    <PermissionGuard permission="SALES_CREATE" showLock>
                        <button onClick={handleSaveDraft} className="flex items-center px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition">
                            <Save className="w-4 h-4 mr-2" /> Save Draft
                        </button>
                    </PermissionGuard>
                    
                    <PermissionGuard permission="SALES_POST" showLock>
                        <button 
                            onClick={handlePost} 
                            disabled={isPosting}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50 ${approvalTriggered && !hasPermission('SALES_DISCOUNT_APPROVE') ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                        >
                            {isPosting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : approvalTriggered && !hasPermission('SALES_DISCOUNT_APPROVE') ? <ShieldAlert className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                            {isPosting ? 'Processing...' : approvalTriggered && !hasPermission('SALES_DISCOUNT_APPROVE') ? 'Request Approval' : 'Post Final'}
                        </button>
                    </PermissionGuard>
                 </>
             )}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Document Identity Block */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Hash className="w-24 h-24 text-blue-600 dark:text-blue-400" />
                </div>
                
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2 relative z-10">
                    <Hash className="w-4 h-4 text-blue-600" /> Document Identity
                </h3>

                <div className="space-y-4 relative z-10">
                    {isLocked ? (
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Final Document Number</label>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tracking-tight select-all">
                                    {doc.id}
                                </span>
                                <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-600" title="Copy">
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Draft ID</label>
                                <div className="font-mono text-sm text-slate-600 dark:text-slate-300 mt-1 select-all bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded w-fit">
                                    {doc.id}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Numbering Series ({activeCompany?.name})</label>
                                <div className="relative">
                                    <select 
                                        value={selectedSeriesId}
                                        onChange={(e) => setSelectedSeriesId(e.target.value)}
                                        className="w-full appearance-none p-2.5 pr-8 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
                                    >
                                        {availableSeries.map(s => <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>)}
                                        {availableSeries.length === 0 && <option disabled>No series configured</option>}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        <div className="pt-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Target Document No.</label>
                                <div className="mt-1 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg flex items-center justify-between">
                                    <span className="text-xl font-mono font-bold text-amber-700 dark:text-amber-500 tracking-tight">
                                        {previewId}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-amber-600/60 tracking-wider">
                                        Preview
                                    </span>
                                </div>
                        </div>
                        </>
                    )}
                </div>
            </div>

          <SalesDocHeader 
            doc={doc} 
            isLocked={isLocked} 
            activeCompany={activeCompany} 
            customers={customers} 
            updateHeader={updateHeader} 
          />

          <SalesLineItems 
            items={doc.items}
            inventory={inventory}
            taxCodes={taxCodes}
            isLocked={isLocked}
            onAddLine={addLine}
            onRemoveLine={removeLine}
            onUpdateLine={updateLineItem}
          />
          
          <SalesDocFooter 
            doc={doc} 
            setDoc={setDoc} 
            approvalTriggered={approvalTriggered} 
          />
      </div>
    </div>
  );
};