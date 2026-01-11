import { apiClient } from './client';

export interface Role {
    id: string;
    name: string;
    description: string;
    is_system_role: boolean;
    permission_count: number;
    permissions: string[];
    created_at: string;
}

export interface Permission {
    id: string;
    code: string;
    module: string;
    description: string;
}

export interface User {
    id: string;
    username: string;
    email: string;
    name: string;
    status: string;
    role_ids: string[];
    role_names: string[];
    created_at: string;
}

export const adminApi = {
    // Roles
    async getRoles(): Promise<{ roles: Role[] }> {
        return apiClient.get<{ roles: Role[] }>('/api/admin/roles');
    },

    async updateRolePermissions(roleId: string, permissionCodes: string[]): Promise<{ success: boolean; message: string }> {
        return apiClient.post<{ success: boolean; message: string }>(`/api/admin/roles/${roleId}/permissions`, {
            permissionCodes
        });
    },

    // Permissions
    async getPermissions(): Promise<{ permissions: Permission[] }> {
        return apiClient.get<{ permissions: Permission[] }>('/api/admin/permissions');
    },

    // Users
    async getUsers(): Promise<{ users: User[] }> {
        return apiClient.get<{ users: User[] }>('/api/admin/users');
    },

    async updateUserRoles(userId: string, roleIds: string[]): Promise<{ success: boolean; message: string }> {
        return apiClient.post<{ success: boolean; message: string }>(`/api/admin/users/${userId}/roles`, {
            roleIds
        });
    }
};
