import { useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useApp } from '../context/AppContext';
import { Customer, Supplier, InventoryItem, Warehouse } from '../types';

export const useMasterData = () => {
    const { activeCompany } = useApp();

    // Data States
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    // UI States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCustomers = useCallback(async () => {
        if (!activeCompany?.id) return;
        setLoading(true);
        try {
            const res = await apiClient.get<{ customers: Customer[] }>(`/api/sales/customers?companyId=${activeCompany.id}`);
            setCustomers(res.customers || []);
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError('Failed to fetch customers');
        } finally {
            setLoading(false);
        }
    }, [activeCompany?.id]);

    // Placeholders for future APIs
    const fetchSuppliers = useCallback(async () => {
        // TODO: Implement API
        setSuppliers([]);
    }, []);

    const fetchItems = useCallback(async () => {
        // TODO: Implement API
        setItems([]);
    }, []);

    const fetchWarehouses = useCallback(async () => {
        // TODO: Implement API
        setWarehouses([]);
    }, []);

    return {
        customers,
        suppliers,
        items,
        warehouses,
        loading,
        error,
        fetchCustomers,
        fetchSuppliers,
        fetchItems,
        fetchWarehouses
    };
};
