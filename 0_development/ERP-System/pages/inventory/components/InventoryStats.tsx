import React from 'react';
import { InventoryItem } from '../../../types';

interface InventoryStatsProps {
    items: InventoryItem[];
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({ items }) => {
    return (
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
    );
};