
import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { Edit2, Check, Plus, Trash2, Copy } from 'lucide-react';
import { RunningNumberConfig, DateFormatOption, ResetFrequency, DocType } from '../../../../types';
import { Modal } from '../../../../components/UI/Modal';

export const DocumentNumbering: React.FC = () => {
    const { runningNumberConfigs, updateRunningNumberConfig, addRunningNumberConfig, deleteRunningNumberConfig, activeClient, activeCompany } = useApp();
    const [editingConfig, setEditingConfig] = useState<RunningNumberConfig | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [preview, setPreview] = useState('');

    useEffect(() => {
        if (!editingConfig) return;
        const date = new Date();
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        let datePart = '';
        if (editingConfig.dateFormat === 'YYYY') datePart = year;
        else if (editingConfig.dateFormat === 'YYMM') datePart = year.substr(-2) + month;
        else if (editingConfig.dateFormat === 'YYYYMM') datePart = year + month;
        else if (editingConfig.dateFormat === 'YYYYMMDD') datePart = year + month + day;

        const seq = editingConfig.nextSequence.toString().padStart(editingConfig.digits, '0');
        const sep = editingConfig.separator;
        
        const parts = [editingConfig.prefix];
        if (datePart) parts.push(datePart);
        parts.push(seq);
        
        let result = parts.join(sep);

        if (editingConfig.suffix) {
            const suffixSep = editingConfig.suffixSeparator !== undefined ? editingConfig.suffixSeparator : sep;
            result = `${result}${suffixSep}${editingConfig.suffix}`;
        }
        
        setPreview(result);
    }, [editingConfig]);

    const handleSave = () => {
        if (editingConfig) {
            if (isNew) {
                addRunningNumberConfig(editingConfig);
            } else {
                updateRunningNumberConfig(editingConfig);
            }
            setEditingConfig(null);
        }
    };

    const handleCreateNew = () => {
        setIsNew(true);
        setEditingConfig({
            id: `rn-${Date.now()}`,
            clientId: activeClient?.id || '',
            companyId: activeCompany?.id || '',
            docType: 'INV',
            name: 'New Sequence',
            isDefault: false,
            prefix: 'NEW',
            separator: '-',
            dateFormat: 'YYMM',
            digits: 4,
            nextSequence: 1,
            resetFrequency: 'Yearly'
        });
    };

    const handleEdit = (config: RunningNumberConfig) => {
        setIsNew(false);
        setEditingConfig({...config});
    };

    const handleDuplicate = (config: RunningNumberConfig) => {
        setIsNew(true);
        setEditingConfig({
            ...config,
            id: `rn-${Date.now()}`,
            name: `${config.name} (Copy)`,
            isDefault: false
        });
    };

    return (
        <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">Configure how document IDs are generated.</p>
                <button 
                    onClick={handleCreateNew}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span>Create Rule</span>
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                            <tr>
                                <th className="px-6 py-3">Profile Name</th>
                                <th className="px-6 py-3">Document</th>
                                <th className="px-6 py-3">Format Preview</th>
                                <th className="px-6 py-3 text-center">Default</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {runningNumberConfigs.map((seq) => {
                                const sep = seq.separator;
                                let sample = `${seq.prefix}${sep}${seq.dateFormat === 'YYMM' ? '2310' : '2023'}${sep}${'0'.repeat(seq.digits - 1)}1`;
                                if (seq.suffix) {
                                    sample += `${seq.suffixSeparator !== undefined ? seq.suffixSeparator : sep}${seq.suffix}`;
                                }
                                return (
                                <tr key={seq.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{seq.name}</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono border border-slate-200 dark:border-slate-700">{seq.docType}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-blue-600 dark:text-blue-400 font-mono text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">{sample}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {seq.isDefault ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => handleDuplicate(seq)} className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><Copy className="w-4 h-4" /></button>
                                            <button onClick={() => handleEdit(seq)} className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => deleteRunningNumberConfig(seq.id)} className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={!!editingConfig} onClose={() => setEditingConfig(null)} title={isNew ? "Create Numbering Series" : "Edit Numbering Series"}>
                {editingConfig && (
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Live Preview</span>
                            <div className="text-2xl font-mono font-bold text-slate-800 dark:text-white tracking-wide">{preview}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Profile Name</label>
                                <input type="text" value={editingConfig.name} onChange={(e) => setEditingConfig({...editingConfig, name: e.target.value})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Document Type</label>
                                <select value={editingConfig.docType} onChange={(e) => setEditingConfig({...editingConfig, docType: e.target.value as DocType})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm">
                                    <option value="SO">Sales Order</option>
                                    <option value="INV">Sales Invoice</option>
                                    <option value="DO">Delivery Order</option>
                                    <option value="PO">Purchase Order</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                             <input id="isDefault" type="checkbox" checked={editingConfig.isDefault} onChange={(e) => setEditingConfig({...editingConfig, isDefault: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                             <label htmlFor="isDefault" className="text-sm text-slate-700 dark:text-slate-300">Set as default for {editingConfig.docType}</label>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Prefix</label>
                                <input type="text" value={editingConfig.prefix} onChange={(e) => setEditingConfig({...editingConfig, prefix: e.target.value.toUpperCase()})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-mono" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Separator</label>
                                <select value={editingConfig.separator} onChange={(e) => setEditingConfig({...editingConfig, separator: e.target.value})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm">
                                    <option value="-">- (Dash)</option>
                                    <option value="/">/ (Slash)</option>
                                    <option value=".">. (Dot)</option>
                                    <option value="">(None)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Date Format</label>
                                <select value={editingConfig.dateFormat} onChange={(e) => setEditingConfig({...editingConfig, dateFormat: e.target.value as DateFormatOption})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm">
                                    <option value="None">None (Sequential Only)</option>
                                    <option value="YYYY">YYYY (Year)</option>
                                    <option value="YYMM">YYMM (Year-Month)</option>
                                    <option value="YYYYMM">YYYYMM</option>
                                    <option value="YYYYMMDD">YYYYMMDD</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Sequence Padding</label>
                                <select value={editingConfig.digits} onChange={(e) => setEditingConfig({...editingConfig, digits: parseInt(e.target.value)})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm">
                                    <option value={3}>3 Digits (001)</option>
                                    <option value={4}>4 Digits (0001)</option>
                                    <option value={5}>5 Digits (00001)</option>
                                    <option value={6}>6 Digits (000001)</option>
                                </select>
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Suffix (Optional)</label>
                                <input type="text" value={editingConfig.suffix || ''} onChange={(e) => setEditingConfig({...editingConfig, suffix: e.target.value.toUpperCase()})} placeholder="e.g. SG" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-mono" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Suffix Separator</label>
                                <select value={editingConfig.suffixSeparator ?? ''} onChange={(e) => setEditingConfig({...editingConfig, suffixSeparator: e.target.value || undefined})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm">
                                    <option value="">Same as Main</option>
                                    <option value="-">- (Dash)</option>
                                    <option value="/">/ (Slash)</option>
                                    <option value=".">. (Dot)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Next Number</label>
                                <input type="number" value={editingConfig.nextSequence} onChange={(e) => setEditingConfig({...editingConfig, nextSequence: parseInt(e.target.value)})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-mono" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Reset Frequency</label>
                                <select value={editingConfig.resetFrequency} onChange={(e) => setEditingConfig({...editingConfig, resetFrequency: e.target.value as ResetFrequency})} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm">
                                    <option value="Never">Never</option>
                                    <option value="Monthly">Monthly</option>
                                    <option value="Yearly">Yearly</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                             <button onClick={() => setEditingConfig(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center shadow-sm"><Check className="w-4 h-4 mr-2" /> {isNew ? 'Create Rule' : 'Update Rule'}</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
