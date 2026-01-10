
import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { Calculator, Package, RefreshCw } from 'lucide-react';

export const VolumetricWeight: React.FC = () => {
    const { addToolHistory } = useApp();
    
    // Inputs
    const [length, setLength] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);
    const [qty, setQty] = useState<number>(1);
    const [actualWeight, setActualWeight] = useState<number>(0);
    const [unit, setUnit] = useState<'cm' | 'in'>('cm');
    const [divisor, setDivisor] = useState<number>(5000);

    // Outputs
    const [volume, setVolume] = useState<number>(0);
    const [volWeight, setVolWeight] = useState<number>(0);
    const [chargeable, setChargeable] = useState<number>(0);

    useEffect(() => {
        calculate();
    }, [length, width, height, qty, actualWeight, unit, divisor]);

    const calculate = () => {
        // Normalize to CM
        let l = length, w = width, h = height;
        if (unit === 'in') {
            l = l * 2.54;
            w = w * 2.54;
            h = h * 2.54;
        }

        const volCm3 = l * w * h * qty;
        const vWeight = volCm3 / divisor;
        const cWeight = Math.max(vWeight, actualWeight * qty); // Assuming actual weight is per piece too or total? Let's assume input is TOTAL actual weight or PER PIECE? Usually per piece logic. Let's do total for simplicity or per piece. 
        // Standard Tool: Inputs usually per piece, but Actual Weight often entered as Total for shipment. 
        // Let's assume Dimensions are per Piece, Qty is count. Actual Weight is TOTAL for shipment for comparison.
        
        // Actually, usually you compare (Vol Weight Total) vs (Actual Weight Total).
        const totalActual = actualWeight * qty;
        const totalVolWeight = (l * w * h * qty) / divisor;
        
        setVolume(volCm3 / 1000000); // m3
        setVolWeight(totalVolWeight);
        setChargeable(Math.max(totalActual, totalVolWeight));
    };

    const handleSave = () => {
        addToolHistory({
            id: Date.now().toString(),
            toolId: 'tool-volumetric',
            timestamp: new Date().toISOString(),
            summary: `${chargeable.toFixed(2)} kg Chargeable`,
            details: {
                Dims: `${length}x${width}x${height} ${unit}`,
                Qty: qty,
                Divisor: divisor
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Inputs */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-blue-600" /> Shipment Details
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Length</label>
                            <input type="number" value={length || ''} onChange={e => setLength(parseFloat(e.target.value))} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" placeholder="0" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Width</label>
                            <input type="number" value={width || ''} onChange={e => setWidth(parseFloat(e.target.value))} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" placeholder="0" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Height</label>
                            <input type="number" value={height || ''} onChange={e => setHeight(parseFloat(e.target.value))} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" placeholder="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Unit</label>
                            <select value={unit} onChange={e => setUnit(e.target.value as any)} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm">
                                <option value="cm">cm / kg</option>
                                <option value="in">inch / kg</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Quantity</label>
                            <input type="number" value={qty} onChange={e => setQty(parseFloat(e.target.value))} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                        </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-xs font-bold text-slate-500 uppercase">Actual Weight (Per Piece)</label>
                        <input type="number" value={actualWeight || ''} onChange={e => setActualWeight(parseFloat(e.target.value))} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" placeholder="0.00 kg" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Divisor Factor</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setDivisor(5000)}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg border ${divisor === 5000 ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                5000 (Express)
                            </button>
                            <button 
                                onClick={() => setDivisor(6000)}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg border ${divisor === 6000 ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                6000 (Standard)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Outputs */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                            <Calculator className="w-5 h-5 text-emerald-600" /> Results
                        </h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 text-sm">Total Volume (CBM)</span>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{volume.toFixed(4)} m³</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 text-sm">Volumetric Weight</span>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{volWeight.toFixed(2)} kg</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 text-sm">Actual Weight Total</span>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{(actualWeight * qty).toFixed(2)} kg</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-center">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Chargeable Weight</p>
                        <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                            {chargeable.toFixed(2)} <span className="text-lg">kg</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={chargeable === 0}
                        className="w-full mt-4 flex items-center justify-center py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Calculation
                    </button>
                </div>
            </div>
        </div>
    );
};
