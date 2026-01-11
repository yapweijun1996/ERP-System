import { apiClient } from './client';
import { User, LoginCredentials, RegisterData } from '../types';

interface AuthResponse {
    user: User;
    token: string;
}

function getCompanyIdFromUrl() {
    try {
        if (typeof window === 'undefined') return null;
        const params = new URLSearchParams(window.location.search);
        const company = params.get('company');
        return company ? company.trim() : null;
    } catch {
        return null;
    }
}

export const authApi = {
    login: (credentials: LoginCredentials) => {
        const company = getCompanyIdFromUrl();
        const endpoint = company
            ? `/api/auth/login?company=${encodeURIComponent(company)}`
            : '/api/auth/login';
        return apiClient.post<AuthResponse>(endpoint, credentials);
    },

    register: (data: RegisterData) => {
        const company = getCompanyIdFromUrl();
        const endpoint = company
            ? `/api/auth/register?company=${encodeURIComponent(company)}`
            : '/api/auth/register';
        return apiClient.post<AuthResponse>(endpoint, data);
    },

    getCurrentUser: () => {
        return apiClient.get<{ user: User }>('/api/auth/me');
    }
};
