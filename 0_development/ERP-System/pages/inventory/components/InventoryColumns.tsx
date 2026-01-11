import React from 'react';
import { Image as ImageIcon, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Column } from '../../../components/UI/DataTable';
import { InventoryItem } from '../../../types';

export const getInventoryColumns = (
    onAdjustClick: (item: InventoryItem) => void
): Column<InventoryItem>[] => [
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
                onClick={(e) => {
                    e.stopPropagation();
                    onAdjustClick(item);
                }}
                className="inline-flex items-center space-x-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
            >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Adjust</span>
            </button>
        )
    }
];
