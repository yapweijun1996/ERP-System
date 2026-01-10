
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, CheckCircle, Lock, Tag, Filter, FileText, Truck, ArrowRightLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId, SalesDocument } from '../../types';
import { DataTable, Column } from '../../components/UI/DataTable';

interface SalesListProps {
  onNavigate: (page: string, id?: string) => void;
  viewType?: 'ALL' | 'QUOTES' | 'ORDERS' | 'DELIVERY' | 'INVOICES' | 'CREDIT_NOTES';
}

type SalesTab = 'ALL' | 'DRAFT' | 'POSTED' | 'VOID';

export const SalesList: React.FC<SalesListProps> = ({ onNavigate, viewType = 'ALL' }) => {
  const { salesDocuments } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<SalesTab>('ALL');

  // Map viewType to document types or filters
  const getDocTypeFilter = (doc: SalesDocument) => {
      switch(viewType) {
          case 'QUOTES': return doc.type === 'SQ'; // Assume SQ for quote
          case 'ORDERS': return doc.type === 'SO';
          case 'DELIVERY': return doc.type === 'DO';
          case 'INVOICES': return doc.type === 'INV';
          case 'CREDIT_NOTES': return doc.type === 'CN';
          default: return true; // Show all
      }
  };

  const getPageTitle = () => {
      switch(viewType) {
          case 'QUOTES': return 'Sales Quotations';
          case 'ORDERS': return 'Sales Orders';
          case 'DELIVERY': return 'Deliveries';
          case 'INVOICES': return 'Sales Invoices';
          case 'CREDIT_NOTES': return 'Credit Notes';
          default: return 'Sales Documents';
      }
  };

  const filteredDocs = useMemo(() => {
      return salesDocuments.filter(doc => {
          // 1. Filter by viewType
          if (!getDocTypeFilter(doc)) return false;

          // 2. Filter by search
          const matchesSearch = doc.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                doc.id.toLowerCase().includes(searchTerm.toLowerCase());
          
          if (!matchesSearch) return false;

          // 3. Filter by tab status
          if (activeTab === 'DRAFT') return doc.status === 'Draft';
          if (activeTab === 'POSTED') return doc.status === 'Posted';
          if (activeTab === 'VOID') return doc.status === 'Void';
          
          return true;
      });
  }, [searchTerm, activeTab, salesDocuments, viewType]);

  const tabs = [
      { id: 'ALL', label: 'All' },
      { id: 'DRAFT', label: 'Drafts', icon: Tag },
      { id: 'POSTED', label: 'Posted', icon: CheckCircle },
      { id: 'VOID', label: 'Void', icon: Lock },
  ];

  const columns: Column<SalesDocument>[] = [
    { 
        header: 'Doc ID', 
        accessorKey: 'id', 
        className: 'font-medium text-slate-900 dark:text-slate-200 font-mono',
        cell: (doc) => (
            <div className="flex items-center gap-2">
                {doc.type === 'INV' && <FileText className="w-4 h-4 text-blue-500" />}
                {doc.type === 'SO' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                {doc.type === 'DO' && <Truck className="w-4 h-4 text-amber-500" />}
                <span>{doc.id}</span>
            </div>
        )
    },
    { header: 'Type', accessorKey: 'type', className: 'text-xs font-bold text-slate-500' },
    { header: 'Customer', accessorKey: 'customerName', className: 'text-slate-600 dark:text-slate-300 font-medium' },
    { header: 'Date', accessorKey: 'date', className: 'text-slate-500 dark:text-slate-400' },
    { header: 'Total', cell: (doc) => `$${doc.grandTotal.toFixed(2)}`, className: 'text-slate-900 dark:text-slate-200 font-mono font-medium text-right', headerClassName: 'text-right' },
    { header: 'Status', cell: (doc) => <StatusBadge status={doc.status} /> }
  ];

  return (
    <FeatureGuard moduleId={ModuleId.SALES}>
      <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{getPageTitle()}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage {getPageTitle().toLowerCase()}</p>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={() => onNavigate('sales-detail', 'new')}
                className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm w-full sm:w-auto"
            >
                <Plus className="w-4 h-4" />
                <span>Create New</span>
             </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col gap-4 shrink-0">
            {/* Tabs */}
            <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
                {tabs.map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as SalesTab)}
                        className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        {tab.icon && <tab.icon className="w-4 h-4 mr-2" />}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search Bar */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by ID or Customer..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                    />
                </div>
                <button className="flex items-center space-x-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent rounded-lg text-slate-600 dark:text-slate-300 transition-colors">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Filter</span>
                </button>
            </div>
        </div>

        {/* Table Content */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col transition-colors relative">
          <DataTable 
            data={filteredDocs} 
            columns={columns} 
            onRowClick={(doc) => onNavigate('sales-detail', doc.id)}
            emptyMessage={`No ${getPageTitle().toLowerCase()} found.`}
          />
        </div>
      </div>
    </FeatureGuard>
  );
};
