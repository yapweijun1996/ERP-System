export const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
    token?: string;
}

export const apiClient = {
    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const token = options.token || localStorage.getItem('auth_token');

        const headers = new Headers(options.headers);
        headers.set('Content-Type', 'application/json');
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        const config: RequestInit = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(`${API_URL}${endpoint}`, config);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error(`API Request failed for ${endpoint}:`, error);
            throw error;
        }
    },

    get<T>(endpoint: string) {
        return this.request<T>(endpoint, { method: 'GET' });
    },

    post<T>(endpoint: string, data: any) {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    put<T>(endpoint: string, data: any) {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete<T>(endpoint: string) {
        return this.request<T>(endpoint, { method: 'DELETE' });
    },
};
