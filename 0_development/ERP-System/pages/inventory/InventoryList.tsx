
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Scale, ClipboardList, RefreshCw, PackagePlus } from 'lucide-react';
import { FeatureGuard } from '../../components/UI/FeatureGuard';
import { ModuleId, InventoryItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { DataTable } from '../../components/UI/DataTable';
import { useInventoryData } from '../../hooks/useInventoryData';
import { InventoryAdjustModal } from './components/InventoryAdjustModal';
import { InventoryStats } from './components/InventoryStats';
import { InventoryFilterBar } from './components/InventoryFilterBar';
import { getInventoryColumns } from './components/InventoryColumns';
import { CreateItemModal } from './components/CreateItemModal';
import { useTranslation } from 'react-i18next';

interface InventoryListProps {
    viewType?: 'STOCK' | 'MOVES' | 'ADJUST' | 'TAKE' | 'ITEMS';
}

export const InventoryList: React.FC<InventoryListProps> = ({ viewType = 'STOCK' }) => {
    const { addToast } = useApp();
    const { t } = useTranslation();
    const { items, loading, fetchInventory, postAdjustment } = useInventoryData();

    const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const getPageTitle = () => {
        switch (viewType) {
            case 'STOCK': return t('inventory.stock_on_hand', 'Stock On Hand');
            case 'MOVES': return t('inventory.stock_movements', 'Stock Movements');
            case 'ADJUST': return t('inventory.stock_adjustments', 'Stock Adjustments');
            case 'TAKE': return t('inventory.stock_take', 'Stock Take');
            default: return t('inventory.items', 'Inventory Items');
        }
    };

    const handleAdjustSubmit = async (data: { itemId: string; type: string; quantity: number; reference: string; notes: string }) => {
        try {
            await postAdjustment(data);
            addToast(t('inventory.adjust_success_title', 'Stock Adjustment Posted'), t('inventory.adjust_success_msg', 'Inventory levels have been updated'), 'success');
            setAdjustModalOpen(false);
            setSelectedItem(null);
        } catch (error: any) {
            addToast(t('common.error', 'Error'), error.message || 'Failed to post adjustment', 'error');
        }
    };

    const handleCreateItem = async (data: any) => {
        // TODO: Implement actual create API call in useInventoryData
        // For now simulate success
        await new Promise(resolve => setTimeout(resolve, 1000));
        addToast(t('inventory.create_success', 'Item Created'), t('inventory.create_success_msg', 'New inventory item has been added successfully.'), 'success');
        setCreateModalOpen(false);
        fetchInventory();
    };

    const filteredInventory = useMemo(() => {
        return items.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, searchTerm]);

    const columns = useMemo(() => getInventoryColumns((item) => {
        setSelectedItem(item.id);
        setAdjustModalOpen(true);
    }), []);

    return (
        <FeatureGuard moduleId={ModuleId.INVENTORY}>
            <div className="flex flex-col h-full p-4 md:p-6 gap-4 pb-20 md:pb-6">
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{getPageTitle()}</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('inventory.page_subtitle', 'Stock control and visibility')}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => fetchInventory()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {viewType === 'ADJUST' && (
                            <button
                                onClick={() => { setAdjustModalOpen(true); }}
                                className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
                            >
                                <Scale className="w-4 h-4" /> {t('inventory.quick_adjust', 'Quick Adjust')}
                            </button>
                        )}
                        {viewType === 'ITEMS' && (
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
                            >
                                <PackagePlus className="w-4 h-4" /> {t('inventory.new_item', 'New Item')}
                            </button>
                        )}
                        {viewType === 'TAKE' && (
                            <button className="hidden md:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                                <ClipboardList className="w-4 h-4" /> {t('inventory.start_count', 'Start Count')}
                            </button>
                        )}
                        <button className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg md:hidden">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {viewType === 'STOCK' && (
                    <InventoryStats items={items} />
                )}

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col transition-colors min-h-0 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 z-10 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}

                    <InventoryFilterBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

                    <DataTable
                        data={filteredInventory}
                        columns={columns}
                        emptyMessage={loading ? t('inventory.loading', "Loading inventory...") : t('inventory.no_items', "No inventory items found.")}
                    />
                </div>

                <InventoryAdjustModal
                    isOpen={isAdjustModalOpen}
                    onClose={() => { setAdjustModalOpen(false); setSelectedItem(null); }}
                    items={items}
                    initialSelectedItemId={selectedItem}
                    loading={loading}
                    onAdjust={handleAdjustSubmit}
                />

                <CreateItemModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setCreateModalOpen(false)}
                    onCreate={handleCreateItem}
                    loading={loading}
                />
            </div>
        </FeatureGuard>
    );
};
