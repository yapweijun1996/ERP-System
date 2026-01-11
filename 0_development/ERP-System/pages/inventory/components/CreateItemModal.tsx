
import React, { useState } from 'react';
import { Modal } from '../../../components/UI/Modal';
import { Package, Tag, Hash, Ruler, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CreateItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (itemData: any) => Promise<void>;
    loading: boolean;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({ isOpen, onClose, onCreate, loading }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '',
        unit: 'pcs',
        salesPrice: 0,
        costPrice: 0
    });

    const handleChange = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('inventory.create_item_title', 'Create Inventory Item')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('inventory.item_name', 'Item Name')}</label>
                    <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => handleChange('name', e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            placeholder="e.g. Wireless Mouse"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('inventory.item_sku', 'SKU Code')}</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                required
                                type="text"
                                value={formData.sku}
                                onChange={e => handleChange('sku', e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="e.g. WM-001"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('inventory.item_category', 'Category')}</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                required
                                type="text"
                                value={formData.category}
                                onChange={e => handleChange('category', e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="e.g. Electronics"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('inventory.item_unit', 'Unit of Measure')}</label>
                    <div className="relative">
                        <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={formData.unit}
                            onChange={e => handleChange('unit', e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="pcs">Pieces (pcs)</option>
                            <option value="kg">Kilograms (kg)</option>
                            <option value="l">Liters (l)</option>
                            <option value="m">Meters (m)</option>
                            <option value="box">Box</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('inventory.item_price', 'Selling Price')}</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                min="0" step="0.01"
                                value={formData.salesPrice}
                                onChange={e => handleChange('salesPrice', parseFloat(e.target.value))}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('inventory.item_cost', 'Cost Price')}</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                min="0" step="0.01"
                                value={formData.costPrice}
                                onChange={e => handleChange('costPrice', parseFloat(e.target.value))}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                        {loading ? t('common.loading', 'Loading...') : t('common.create', 'Create')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
