import { apiClient } from './client';
import { User, LoginCredentials, RegisterData } from '../types';

interface AuthResponse {
    user: User;
    token: string;
}

export const authApi = {
    login: (credentials: LoginCredentials) => {
        return apiClient.post<AuthResponse>('/api/auth/login', credentials);
    },

    register: (data: RegisterData) => {
        return apiClient.post<AuthResponse>('/api/auth/register', data);
    },

    getCurrentUser: () => {
        return apiClient.get<{ user: User }>('/api/auth/me');
    }
};
