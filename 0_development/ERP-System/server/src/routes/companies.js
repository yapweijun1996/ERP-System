import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/companies
 * List all companies for a tenant
 */
router.get('/', async (req, res) => {
    try {
        const { tenantId } = req.query;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        const result = await query(
            `SELECT * FROM companies WHERE tenant_id = $1 ORDER BY name ASC`,
            [tenantId]
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
router.post('/', async (req, res) => {
    try {
        const { tenantId, name, currency, timezone, country, features } = req.body;

        if (!tenantId || !name) {
            return res.status(400).json({ error: 'Tenant ID and Name are required' });
        }

        // Generate ID (Simple timestamp based for now)
        const id = `comp-${Date.now()}`;

        const result = await query(
            `INSERT INTO companies (id, tenant_id, name, currency, timezone, country, features, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
             RETURNING *`,
            [id, tenantId, name, currency || 'USD', timezone || 'UTC', country || 'US', JSON.stringify(features || {})]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Create company error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

export default router;
