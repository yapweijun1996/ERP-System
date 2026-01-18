import express from 'express';

import { runWithDbContext } from '../../db/context.js';
import { query } from '../../db/index.js';
import { requireSuperadmin } from '../../middleware/superadminAuth.js';

const router = express.Router();

function getSuperadminDbName() {
    return String(process.env.SUPERADMIN_DB_NAME || 'nexus_superadmin').trim() || 'nexus_superadmin';
}

function withSuperadminDb(fn) {
    const databaseName = getSuperadminDbName();
    return (req, res, next) =>
        runWithDbContext({ companyId: null, databaseName }, () => fn(req, res, next));
}

router.get('/', requireSuperadmin(), withSuperadminDb(async (req, res) => {
    const result = await query(
        `SELECT id, name, status, subscription_tier, features, created_at, updated_at
         FROM tenants
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC`,
    );
    res.json({ masters: result.rows, total: result.rowCount });
}));

router.post('/', requireSuperadmin(), withSuperadminDb(async (req, res) => {
    const { name, subscription_tier, features } = req.body || {};
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'name is required' });
    }

    const id = `master-${Date.now()}`;
    const result = await query(
        `INSERT INTO tenants (id, name, status, subscription_tier, features)
         VALUES ($1, $2, 'Active', $3, $4::jsonb)
         RETURNING id, name, status, subscription_tier, features, created_at, updated_at`,
        [id, String(name).trim(), subscription_tier || null, JSON.stringify(features || {})],
    );
    return res.status(201).json(result.rows[0]);
}));

router.get('/:id/companies', requireSuperadmin(), withSuperadminDb(async (req, res) => {
    const masterId = String(req.params?.id || '').trim();
    if (!masterId) return res.status(400).json({ error: 'Validation Error', message: 'master id required' });

    const result = await query(
        `SELECT id, tenant_id, name, currency, country, timezone, status, features, created_at, updated_at
         FROM companies
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [masterId],
    );
    return res.json({ companies: result.rows, total: result.rowCount });
}));

router.post('/:id/companies', requireSuperadmin(), withSuperadminDb(async (req, res) => {
    const masterId = String(req.params?.id || '').trim();
    if (!masterId) return res.status(400).json({ error: 'Validation Error', message: 'master id required' });

    const { name, currency, timezone, country, features } = req.body || {};
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'name is required' });
    }

    const id = `comp-${Date.now()}`;
    const result = await query(
        `INSERT INTO companies (id, tenant_id, name, currency, timezone, country, features, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'Active')
         RETURNING id, tenant_id, name, currency, timezone, country, status, features, created_at, updated_at`,
        [
            id,
            masterId,
            String(name).trim(),
            currency || 'USD',
            timezone || 'UTC',
            country || 'US',
            JSON.stringify(features || {}),
        ],
    );
    return res.status(201).json(result.rows[0]);
}));

export default router;

