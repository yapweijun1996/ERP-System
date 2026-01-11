export const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:6601';
const CSRF_COOKIE_NAME = (import.meta as any).env?.VITE_CSRF_COOKIE_NAME || 'csrf_token';
const CSRF_HEADER_NAME = (import.meta as any).env?.VITE_CSRF_HEADER_NAME || 'x-csrf-token';

function getCookie(name: string): string | null {
    try {
        if (typeof document === 'undefined') return null;
        const parts = document.cookie.split(';').map(p => p.trim());
        for (const p of parts) {
            if (!p) continue;
            const idx = p.indexOf('=');
            if (idx <= 0) continue;
            const k = p.slice(0, idx).trim();
            const v = p.slice(idx + 1).trim();
            if (k === name) return decodeURIComponent(v);
        }
        return null;
    } catch {
        return null;
    }
}

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

        const method = String(options.method || 'GET').toUpperCase();
        const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
        if (isWrite && !token) {
            const csrf = getCookie(CSRF_COOKIE_NAME);
            if (csrf) headers.set(CSRF_HEADER_NAME, csrf);
        }

        const config: RequestInit = {
            ...options,
            headers,
            credentials: 'include',
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
