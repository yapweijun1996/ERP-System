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
        const useCookie = String((import.meta as any).env?.VITE_AUTH_USE_COOKIE || '').trim().toLowerCase();
        const cookieMode = ['1', 'true', 'yes', 'y', 'on'].includes(useCookie);
        const endpoint = company
            ? `/api/auth/login?company=${encodeURIComponent(company)}${cookieMode ? '&cookie=true' : ''}`
            : `/api/auth/login${cookieMode ? '?cookie=true' : ''}`;
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
