
import React, { useState, useEffect } from 'react';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId, Customer, Supplier, InventoryItem, Warehouse } from '../../types';
import { MOCK_CUSTOMERS, MOCK_SUPPLIERS, MOCK_INVENTORY, MOCK_WAREHOUSES } from '../../constants';
import { StatusBadge } from '../../components/UI/StatusBadge';
import { Search, Plus, Users, Factory, Package, MapPin, MoreHorizontal, Filter } from 'lucide-react';
import { DataTable, Column } from '../../components/UI/DataTable';

interface MasterDataProps {
    initialTab?: 'customers' | 'suppliers' | 'items' | 'warehouses';
}

export const MasterData: React.FC<MasterDataProps> = ({ initialTab = 'customers' }) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'items' | 'warehouses'>(initialTab);

  useEffect(() => {
      if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const tabs = [
    { id: 'customers', label: 'Customers', icon: Users, count: MOCK_CUSTOMERS.length },
    { id: 'suppliers', label: 'Suppliers', icon: Factory, count: MOCK_SUPPLIERS.length },
    { id: 'items', label: 'Items', icon: Package, count: MOCK_INVENTORY.length },
    { id: 'warehouses', label: 'Warehouses', icon: MapPin, count: MOCK_WAREHOUSES.length },
  ];

  // --- Column Definitions ---

  const actionColumn = {
    header: 'Actions',
    className: 'text-right',
    headerClassName: 'text-right',
    cell: () => (
      <button className="text-slate-400 hover:text-blue-600 transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
    )
  };

  const customerColumns: Column<Customer>[] = [
    { header: 'ID', accessorKey: 'id', className: 'font-mono text-xs text-slate-500' },
    { header: 'Name', accessorKey: 'name', className: 'font-medium text-slate-800 dark:text-slate-200' },
    { header: 'Contact', cell: (row) => (
        <div>
            <div className="text-slate-600 dark:text-slate-400">{row.email}</div>
            <div className="text-xs text-slate-500">{row.phone}</div>
        </div>
    )},
    { header: 'Segment', accessorKey: 'segment', className: 'text-slate-600 dark:text-slate-400' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    actionColumn
  ];

  const supplierColumns: Column<Supplier>[] = [
    { header: 'ID', accessorKey: 'id', className: 'font-mono text-xs text-slate-500' },
    { header: 'Name', accessorKey: 'name', className: 'font-medium text-slate-800 dark:text-slate-200' },
    { header: 'Contact', cell: (row) => (
        <div>
            <div className="text-slate-600 dark:text-slate-400">{row.contact}</div>
            <div className="text-xs text-slate-500">{row.email}</div>
        </div>
    )},
    { header: 'Category', accessorKey: 'category', className: 'text-slate-600 dark:text-slate-400' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    actionColumn
  ];

  const itemColumns: Column<InventoryItem>[] = [
    { header: 'SKU', accessorKey: 'sku', className: 'font-mono text-xs text-slate-500' },
    { header: 'Name', accessorKey: 'name', className: 'font-medium text-slate-800 dark:text-slate-200' },
    { header: 'Unit', accessorKey: 'unit', className: 'text-slate-600 dark:text-slate-400' },
    { header: 'Default Stock', cell: (row) => <span className="text-slate-600 dark:text-slate-400">{row.stock} (Current)</span> },
    actionColumn
  ];

  const warehouseColumns: Column<Warehouse>[] = [
    { header: 'Code', accessorKey: 'code', className: 'font-mono text-xs text-slate-500' },
    { header: 'Name', accessorKey: 'name', className: 'font-medium text-slate-800 dark:text-slate-200' },
    { header: 'Location', accessorKey: 'location', className: 'text-slate-600 dark:text-slate-400' },
    { header: 'Manager', accessorKey: 'manager', className: 'text-slate-600 dark:text-slate-400' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    actionColumn
  ];

  return (
    <FeatureGuard moduleId={ModuleId.MASTER_DATA}>
      <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Master Data</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Manage core business entities and definitions</p>
            </div>
            <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
                <Plus className="w-4 h-4" />
                <span>Create New</span>
            </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shrink-0">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs">{tab.count}</span>
                </button>
            ))}
        </div>

        {/* Filter Bar */}
        <div className="flex gap-2 shrink-0">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder={`Search ${activeTab}...`} 
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm"
                />
            </div>
            <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Filter</span>
            </button>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col transition-colors min-h-0">
            {activeTab === 'customers' && <DataTable data={MOCK_CUSTOMERS} columns={customerColumns} />}
            {activeTab === 'suppliers' && <DataTable data={MOCK_SUPPLIERS} columns={supplierColumns} />}
            {activeTab === 'items' && <DataTable data={MOCK_INVENTORY} columns={itemColumns} />}
            {activeTab === 'warehouses' && <DataTable data={MOCK_WAREHOUSES} columns={warehouseColumns} />}
        </div>
      </div>
    </FeatureGuard>
  );
};
