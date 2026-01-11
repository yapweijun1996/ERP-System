import express from 'express';
import { query } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/admin/roles
 * Get all roles for the current tenant
 */
router.get('/roles', requirePermission('ADMIN_ROLES'), async (req, res) => {
    try {
        const tenantId = req.auth?.tenantId;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        // Get roles with permission counts
        const result = await query(
            `SELECT 
                r.id, 
                r.name, 
                r.description, 
                r.is_system_role,
                r.created_at,
                COUNT(rp.permission_id) as permission_count,
                array_agg(p.code) FILTER (WHERE p.code IS NOT NULL) as permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE r.tenant_id = $1 OR r.is_system_role = true
            GROUP BY r.id
            ORDER BY r.is_system_role DESC, r.name`,
            [tenantId]
        );

        res.json({ roles: result.rows });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

/**
 * GET /api/admin/permissions
 * Get all available permissions
 */
router.get('/permissions', requirePermission('ADMIN_ROLES'), async (req, res) => {
    try {
        const result = await query(
            `SELECT id, code, module, description
             FROM permissions
             ORDER BY module, code`
        );

        res.json({ permissions: result.rows });
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

/**
 * POST /api/admin/roles/:roleId/permissions
 * Update permissions for a role
 */
router.post('/roles/:roleId/permissions', requirePermission('ADMIN_ROLES'), async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissionCodes } = req.body;
        const tenantId = req.auth?.tenantId;

        if (!Array.isArray(permissionCodes)) {
            return res.status(400).json({ error: 'permissionCodes must be an array' });
        }

        // Verify role belongs to tenant (or is system role being modified by platform admin)
        const roleCheck = await query(
            'SELECT id, name, is_system_role, tenant_id FROM roles WHERE id = $1',
            [roleId]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const role = roleCheck.rows[0];

        // Prevent modification of system roles unless platform admin
        if (role.is_system_role && !req.auth.permissions?.includes('PLATFORM_ADMIN')) {
            return res.status(403).json({ error: 'Cannot modify system roles' });
        }

        // Verify role belongs to tenant
        if (role.tenant_id !== tenantId && !req.auth.permissions?.includes('PLATFORM_ADMIN')) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Start transaction
        await query('BEGIN');

        try {
            // Remove all existing permissions
            await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

            // Add new permissions
            if (permissionCodes.length > 0) {
                const permResult = await query(
                    'SELECT id FROM permissions WHERE code = ANY($1)',
                    [permissionCodes]
                );

                const permissionIds = permResult.rows.map(p => p.id);

                for (const permId of permissionIds) {
                    await query(
                        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
                        [roleId, permId]
                    );
                }
            }

            await query('COMMIT');

            res.json({
                success: true,
                message: `Updated permissions for role: ${role.name}`,
                permissionCount: permissionCodes.length
            });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Update role permissions error:', error);
        res.status(500).json({ error: 'Failed to update permissions' });
    }
});

/**
 * GET /api/admin/users
 * Get all users with their roles
 */
router.get('/users', requirePermission('ADMIN_USERS'), async (req, res) => {
    try {
        const tenantId = req.auth?.tenantId;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        const result = await query(
            `SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.name, 
                u.status,
                u.created_at,
                array_agg(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL) as role_ids,
                array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as role_names
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.tenant_id = $1 AND u.deleted_at IS NULL
            GROUP BY u.id
            ORDER BY u.created_at DESC`,
            [tenantId]
        );

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * POST /api/admin/users/:userId/roles
 * Update roles for a user
 */
router.post('/users/:userId/roles', requirePermission('ADMIN_USERS'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { roleIds } = req.body;
        const tenantId = req.auth?.tenantId;

        if (!Array.isArray(roleIds)) {
            return res.status(400).json({ error: 'roleIds must be an array' });
        }

        // Verify user belongs to tenant
        const userCheck = await query(
            'SELECT id, username, tenant_id FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userCheck.rows[0];

        if (user.tenant_id !== tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Start transaction
        await query('BEGIN');

        try {
            // Remove existing roles
            await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

            // Add new roles
            if (roleIds.length > 0) {
                for (const roleId of roleIds) {
                    await query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
                        [userId, roleId]
                    );
                }
            }

            await query('COMMIT');

            res.json({
                success: true,
                message: `Updated roles for user: ${user.username}`,
                roleCount: roleIds.length
            });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Update user roles error:', error);
        res.status(500).json({ error: 'Failed to update user roles' });
    }
});

export default router;
