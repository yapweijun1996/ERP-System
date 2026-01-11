import express from 'express';
import { query } from '../db/index.js';
import { requireAnyPermission, requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/companies
 * List all companies for a tenant
 */
router.get(
    '/',
    requireAnyPermission(['ADMIN_SETTINGS', 'ADMIN_USERS', 'SALES_VIEW', 'FINANCE_VIEW', 'INVENTORY_VIEW']),
    async (req, res) => {
    try {
        const tenantIdFromRequest = req.query?.tenantId;
        const tenantIdFromToken = req.auth?.context?.user?.tenantId || null;

        if (!tenantIdFromToken) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }
        if (tenantIdFromRequest && String(tenantIdFromRequest) !== String(tenantIdFromToken)) {
            return res.status(403).json({ error: 'Forbidden', message: 'tenantId mismatch' });
        }

        const result = await query(
            `SELECT * FROM companies WHERE tenant_id = $1 ORDER BY name ASC`,
            [tenantIdFromToken]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/companies
 * Create a new company
 */
router.post('/', requirePermission('ADMIN_SETTINGS'), async (req, res) => {
    try {
        const { tenantId, name, currency, timezone, country, features } = req.body;
        const tenantIdFromToken = req.auth?.context?.user?.tenantId || null;

        if (!tenantIdFromToken || !name) {
            return res.status(400).json({ error: 'Tenant ID and Name are required' });
        }
        if (tenantId && String(tenantId) !== String(tenantIdFromToken)) {
            return res.status(403).json({ error: 'Forbidden', message: 'tenantId mismatch' });
        }

        // Generate ID (Simple timestamp based for now)
        const id = `comp-${Date.now()}`;

        const result = await query(
            `INSERT INTO companies (id, tenant_id, name, currency, timezone, country, features, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
             RETURNING *`,
            [id, tenantIdFromToken, name, currency || 'USD', timezone || 'UTC', country || 'US', JSON.stringify(features || {})]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Create company error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

export default router;
