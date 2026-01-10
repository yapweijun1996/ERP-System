import { apiClient } from './client';
import { Company } from '../types';

export const companiesApi = {
    list: (tenantId: string) => {
        return apiClient.get<Company[]>(`/api/companies?tenantId=${tenantId}`);
    },

    create: (data: Partial<Company> & { tenantId: string }) => {
        return apiClient.post<Company>('/api/companies', data);
    }
};
