import { useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useApp } from '../context/AppContext';
import { InventoryItem, Warehouse } from '../types';

export const useInventoryData = () => {
    const { activeCompany } = useApp();

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchInventory = useCallback(async () => {
        if (!activeCompany?.id) return;
        setLoading(true);
        try {
            const [itemsRes, whRes] = await Promise.all([
                apiClient.get<{ items: InventoryItem[] }>(`/api/inventory/items?companyId=${activeCompany.id}`),
                apiClient.get<{ warehouses: Warehouse[] }>(`/api/inventory/warehouses?companyId=${activeCompany.id}`)
            ]);

            setItems(itemsRes.items || []);
            setWarehouses(whRes.warehouses || []);
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError('Failed to fetch inventory data');
        } finally {
            setLoading(false);
        }
    }, [activeCompany?.id]);

    const postAdjustment = useCallback(async (data: { itemId: string; type: string; quantity: number; reference: string; notes?: string }) => {
        if (!activeCompany?.id) return;
        setLoading(true);
        try {
            await apiClient.post('/api/inventory/adjust', { ...data, companyId: activeCompany.id });
            await fetchInventory();
        } catch (err: any) {
            setError(err.message || 'Failed to post adjustment');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [activeCompany?.id, fetchInventory]);

    return {
        items,
        warehouses,
        loading,
        error,
        fetchInventory,
        postAdjustment
    };
};
