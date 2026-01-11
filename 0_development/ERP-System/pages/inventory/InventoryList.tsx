
import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRightLeft, Plus, Search, Filter, Image as ImageIcon, AlertTriangle, Save, Scale, ClipboardList, RefreshCw } from 'lucide-react';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId, InventoryItem } from '../../types';
import { Modal } from '../../components/UI/Modal';
import { useApp } from '../../context/AppContext';
import { DataTable, Column } from '../../components/UI/DataTable';
import { useInventoryData } from '../../hooks/useInventoryData';

interface InventoryListProps {
    viewType?: 'STOCK' | 'MOVES' | 'ADJUST' | 'TAKE' | 'ITEMS';
}

export const InventoryList: React.FC<InventoryListProps> = ({ viewType = 'STOCK' }) => {
    const { addToast } = useApp();
    const { items, loading, fetchInventory, postAdjustment } = useInventoryData();

    const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [modalTab, setModalTab] = useState<'adjust' | 'history'>('adjust');
    const [searchTerm, setSearchTerm] = useState('');

    // Form States
    const [adjustType, setAdjustType] = useState('ADJUST_IN');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustRef, setAdjustRef] = useState('');
    const [adjustNotes, setAdjustNotes] = useState('Found Inventory');

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const getPageTitle = () => {
        switch (viewType) {
            case 'STOCK': return 'Stock On Hand';
            case 'MOVES': return 'Stock Movements';
            case 'ADJUST': return 'Stock Adjustments';
            case 'TAKE': return 'Stock Take';
            default: return 'Inventory Items';
        }
    };

    const handleAdjust = async () => {
        if (!selectedItem || !adjustQty) {
            addToast('Validation Error', 'Please select an item and quantity', 'error');
            return;
        }

        try {
            await postAdjustment({
                itemId: selectedItem,
                type: adjustType,
                quantity: parseFloat(adjustQty),
                reference: adjustRef || 'MANUAL',
                notes: adjustNotes
            });
            addToast('Stock Adjustment Posted', 'Inventory levels have been updated.', 'success');
            setAdjustModalOpen(false);
            setSelectedItem(null);
            setAdjustQty('');
            setAdjustRef('');
        } catch (error: any) {
            // Error handled by hook logic usually, but here we catch it to prevent unhandled promise
            // Hook automatically sets error state, but let's toast too
            addToast('Error', error.message || 'Failed to post adjustment', 'error');
        }
    };

    const filteredInventory = useMemo(() => {
        return items.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, searchTerm]);

    const columns: Column<InventoryItem>[] = [
        {
            header: '',
            className: 'w-16 pl-6',
            cell: () => (
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-5 h-5" />
                </div>
            )
        },
        {
            header: 'Item Details',
            cell: (item) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                    <span className="text-xs text-slate-500 font-mono">{item.sku}</span>
                </div>
            )
        },
        {
            header: 'Category',
            cell: (item) => (
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full">
                    {item.category || 'General'}
                </span>
            )
        },
        {
            header: 'Availability',
            cell: (item) => {
                const maxStock = 500;
                const percent = Math.min(100, (item.stock / maxStock) * 100);
                const isLow = item.stock < 10;
                return (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[100px] h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${percent}%` }}
                            ></div>
                        </div>
                        {isLow && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </div>
                );
            }
        },
        {
            header: 'Value',
            className: 'text-right text-slate-600 dark:text-slate-400 font-mono',
            headerClassName: 'text-right',
            cell: (item) => `$${(item.stock * item.price).toLocaleString()}`
        },
        {
            header: 'On Hand',
            className: 'text-right',
            headerClassName: 'text-right',
            cell: (item) => (
                <>
                    <span className={`font-bold ${item.stock < 10 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>{item.stock}</span>
                    <span className="text-slate-400 ml-1 text-xs">{item.unit}</span>
                </>
            )
        },
        {
            header: 'Actions',
            className: 'text-right',
            headerClassName: 'text-right',
            cell: (item) => (
                <button
                    onClick={(e) => { e.stopPropagation(); setSelectedItem(item.id); setModalTab('adjust'); setAdjustModalOpen(true); }}
                    className="inline-flex items-center space-x-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
                >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Adjust</span>
                </button>
            )
        }
    ];

    return (
        <FeatureGuard moduleId={ModuleId.INVENTORY}>
            <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{getPageTitle()}</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Stock control and visibility</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => fetchInventory()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {viewType === 'ADJUST' && (
                            <button
                                onClick={() => { setAdjustModalOpen(true); setModalTab('adjust'); }}
                                className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
                            >
                                <Scale className="w-4 h-4" /> Quick Adjust
                            </button>
                        )}
                        {viewType === 'TAKE' && (
                            <button className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                                <ClipboardList className="w-4 h-4" /> Start Count
                            </button>
                        )}
                        <button className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg md:hidden">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stats Row only for Main Stock View */}
                {viewType === 'STOCK' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Total SKUs</span>
                            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{items.length}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-amber-500">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Low Stock</span>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-500">{items.filter(i => i.stock < 10).length}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm hidden md:block">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Valuation</span>
                            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">${items.reduce((acc, i) => acc + (i.price * i.stock), 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm hidden md:block">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Turnover</span>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-500">-</div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col transition-colors min-h-0 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 z-10 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}

                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search items..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                            />
                        </div>
                        <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <Filter className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Filter</span>
                        </button>
                    </div>

                    <DataTable
                        data={filteredInventory}
                        columns={columns}
                        emptyMessage={loading ? "Loading inventory..." : "No inventory items found."}
                    />
                </div>

                {/* Adjustment Modal */}
                <Modal
                    isOpen={isAdjustModalOpen}
                    onClose={() => { setAdjustModalOpen(false); setSelectedItem(null); }}
                    title="Stock Management"
                >
                    <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700 mb-4">
                        <button
                            onClick={() => setModalTab('adjust')}
                            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${modalTab === 'adjust' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            New Adjustment
                        </button>
                        <button
                            onClick={() => setModalTab('history')}
                            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${modalTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Movement History
                        </button>
                    </div>

                    {modalTab === 'adjust' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Movement Type</label>
                                    <select
                                        value={adjustType}
                                        onChange={(e) => setAdjustType(e.target.value)}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                                    >
                                        <option value="ADJUST_IN">Adjustment In (+)</option>
                                        <option value="ADJUST_OUT">Adjustment Out (-)</option>
                                        <option value="SCRAP">Scrap / Damage</option>
                                        <option value="COUNT">Count Correction</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Reference</label>
                                    <input
                                        type="text"
                                        value={adjustRef}
                                        onChange={(e) => setAdjustRef(e.target.value)}
                                        placeholder="e.g. YEAR-END-COUNT"
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Item</label>
                                <select
                                    value={selectedItem || ""}
                                    onChange={(e) => setSelectedItem(e.target.value)}
                                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                                >
                                    <option value="" disabled>Select Product...</option>
                                    {items.map(i => <option key={i.id} value={i.id}>{i.sku} - {i.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Quantity</label>
                                    <input
                                        type="number"
                                        value={adjustQty}
                                        onChange={(e) => setAdjustQty(e.target.value)}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Reason / Notes</label>
                                    <select
                                        value={adjustNotes}
                                        onChange={(e) => setAdjustNotes(e.target.value)}
                                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                                    >
                                        <option value="Damaged Goods">Damaged Goods</option>
                                        <option value="Found Inventory">Found Inventory</option>
                                        <option value="Data Entry Error">Data Entry Error</option>
                                        <option value="Stock Take">Stock Take</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setAdjustModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={loading}
                                    onClick={handleAdjust}
                                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4 mr-2" /> {loading ? 'Posting...' : 'Post Adjustment'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-center p-8 text-slate-500">
                                No movement history available.
                            </div>
                            <div className="text-center">
                                <button onClick={() => setAdjustModalOpen(false)} className="text-sm text-blue-600 hover:underline">Close</button>
                            </div>
                        </div>
                    )}
                </Modal>

            </div>
        </FeatureGuard>
    );
};
