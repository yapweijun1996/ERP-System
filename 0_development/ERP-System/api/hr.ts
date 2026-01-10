import { apiClient } from './client';
import { Employee, Department } from '../types';

export const hrApi = {
    getEmployees: (companyId: string) => {
        return apiClient.get<Employee[]>(`/api/hr/employees?companyId=${companyId}`);
    },

    getDepartments: (companyId: string) => {
        return apiClient.get<Department[]>(`/api/hr/departments?companyId=${companyId}`);
    }
};
