import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '../../../components/UI/Modal';
import { InventoryItem } from '../../../types';

interface InventoryAdjustModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: InventoryItem[];
    initialSelectedItemId: string | null;
    loading: boolean;
    onAdjust: (data: {
        itemId: string;
        type: string;
        quantity: number;
        reference: string;
        notes: string;
    }) => Promise<void>;
}

export const InventoryAdjustModal: React.FC<InventoryAdjustModalProps> = ({
    isOpen,
    onClose,
    items,
    initialSelectedItemId,
    loading,
    onAdjust
}) => {
    const [modalTab, setModalTab] = useState<'adjust' | 'history'>('adjust');
    const [selectedItem, setSelectedItem] = useState<string | null>(initialSelectedItemId);
    const [adjustType, setAdjustType] = useState('ADJUST_IN');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustRef, setAdjustRef] = useState('');
    const [adjustNotes, setAdjustNotes] = useState('Found Inventory');

    useEffect(() => {
        setSelectedItem(initialSelectedItemId);
    }, [initialSelectedItemId]);

    const handleSubmit = async () => {
        if (!selectedItem || !adjustQty) return; // Validation handled by parent usually, or add toast here if needed
        await onAdjust({
            itemId: selectedItem,
            type: adjustType,
            quantity: parseFloat(adjustQty),
            reference: adjustRef,
            notes: adjustNotes
        });
        // Reset form
        setAdjustQty('');
        setAdjustRef('');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
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
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={loading}
                            onClick={handleSubmit}
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
                        <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Close</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};