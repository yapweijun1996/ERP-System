import express from 'express';
import { query } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/users
 * Get users
 */
router.get('/', requirePermission('ADMIN_USERS'), async (req, res) => {
    try {
        const tenantIdFromRequest = req.query?.tenantId;
        const tenantIdFromToken = req.auth?.context?.user?.tenantId || null;

        let sql = `SELECT id, tenant_id, email, name, status, last_login, default_company_id, created_at
               FROM users
               WHERE deleted_at IS NULL`;
        const params = [];

        if (tenantIdFromRequest && tenantIdFromToken && String(tenantIdFromRequest) !== String(tenantIdFromToken)) {
            return res.status(403).json({ error: 'Forbidden', message: 'tenantId mismatch' });
        }

        const tenantId = tenantIdFromRequest || tenantIdFromToken;
        if (tenantId) {
            sql += ' AND tenant_id = $1';
            params.push(tenantId);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await query(sql, params);

        res.json({
            users: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch users'
        });
    }
});

export default router;
