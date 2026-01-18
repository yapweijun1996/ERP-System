import { apiClient } from './client';

export interface SuperadminMaster {
    id: string;
    name: string;
    status: string;
    subscription_tier?: string | null;
    features?: any;
    created_at?: string;
    updated_at?: string;
}

export interface SuperadminCompany {
    id: string;
    tenant_id: string;
    name: string;
    currency?: string;
    country?: string;
    timezone?: string;
    status?: string;
    features?: any;
    created_at?: string;
    updated_at?: string;
}

export const superadminApi = {
    login: (credentials: { username: string; password: string }) => {
        return apiClient.post<any>('/api/superadmin/auth/login', credentials);
    },

    me: () => {
        return apiClient.get<any>('/api/superadmin/auth/me');
    },

    listMasters: () => {
        return apiClient.get<{ masters: SuperadminMaster[]; total: number }>('/api/superadmin');
    },

    createMaster: (data: { name: string; subscription_tier?: string | null; features?: any }) => {
        return apiClient.post<SuperadminMaster>('/api/superadmin', data);
    },

    listCompanies: (masterId: string) => {
        return apiClient.get<{ companies: SuperadminCompany[]; total: number }>(
            `/api/superadmin/${encodeURIComponent(masterId)}/companies`,
        );
    },

    createCompany: (
        masterId: string,
        data: { name: string; currency?: string; timezone?: string; country?: string; features?: any },
    ) => {
        return apiClient.post<SuperadminCompany>(`/api/superadmin/${encodeURIComponent(masterId)}/companies`, data);
    },
};

