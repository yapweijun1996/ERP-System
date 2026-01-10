import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/companies
 * Get companies for a tenant
 */
router.get('/', async (req, res) => {
    try {
        const { tenantId } = req.query;

        let sql = `SELECT id, tenant_id, name, currency, country, timezone, status, features, created_at
               FROM companies
               WHERE deleted_at IS NULL`;
        const params = [];

        if (tenantId) {
            sql += ' AND tenant_id = $1';
            params.push(tenantId);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await query(sql, params);

        res.json({
            companies: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch companies'
        });
    }
});

/**
 * GET /api/companies/:id
 * Get company by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT id, tenant_id, name, currency, country, timezone, status, features, created_at
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Company not found'
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch company'
        });
    }
});

export default router;
