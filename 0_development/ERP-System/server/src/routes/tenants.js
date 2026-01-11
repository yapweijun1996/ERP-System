import express from 'express';
import { query } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/tenants
 * Get all tenants (Platform admin only)
 */
router.get('/', requirePermission('PLATFORM_ADMIN'), async (req, res) => {
    try {
        const result = await query(
            `SELECT id, name, status, subscription_tier, features, created_at, updated_at
       FROM tenants
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
        );

        res.json({
            tenants: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get tenants error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch tenants'
        });
    }
});

/**
 * GET /api/tenants/:id
 * Get tenant by ID
 */
router.get('/:id', requirePermission('PLATFORM_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT id, name, status, subscription_tier, features, created_at, updated_at
       FROM tenants
       WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Tenant not found'
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get tenant error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch tenant'
        });
    }
});

export default router;
