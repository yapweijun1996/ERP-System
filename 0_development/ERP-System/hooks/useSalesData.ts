import { useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useApp } from '../context/AppContext';
import { SalesDocument } from '../types';

export const useSalesData = () => {
    const { activeCompany } = useApp();

    // Data States
    const [salesDocs, setSalesDocs] = useState<SalesDocument[]>([]);

    // UI States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSalesDocs = useCallback(async () => {
        if (!activeCompany?.id) return;
        setLoading(true);
        try {
            const res = await apiClient.get<{ documents: SalesDocument[] }>(`/api/sales/documents?companyId=${activeCompany.id}`);
            setSalesDocs(res.documents || []);
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError('Failed to fetch sales documents');
        } finally {
            setLoading(false);
        }
    }, [activeCompany?.id]);

    return {
        salesDocs,
        loading,
        error,
        fetchSalesDocs
    };
};
