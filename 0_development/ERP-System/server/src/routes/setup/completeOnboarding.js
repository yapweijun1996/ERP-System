import express from 'express';
import jwt from 'jsonwebtoken';
import { resolveDatabaseNameForCompanyId } from '../../db/companyDbMap.js';
import { createClient } from './dbConfig.js';

const router = express.Router();

function isStrict() {
    const v = String(process.env.DB_REQUIRE_COMPANY_DB_MAP || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

function requireUser(req) {
    const auth = req.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
        return null;
    }
}

router.post('/', async (req, res) => {
    try {
        const companyId = String(req.query?.company || '').trim();
        if (!companyId) {
            return res.status(400).json({
                error: 'Validation Error',
                message: "company is required, e.g. /api/setup/complete-onboarding?company=vantajas",
            });
        }

        const user = requireUser(req);
        if (!user?.userId || !user?.tenantId) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        }
        if (user.companyId && String(user.companyId) !== companyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Token companyId does not match request company',
            });
        }

        const databaseName = resolveDatabaseNameForCompanyId(companyId);
        if (isStrict() && !databaseName) {
            return res.status(400).json({
                error: 'Database Not Configured',
                message: `No database mapping found for company '${companyId}'.`,
            });
        }

        const db = databaseName || process.env.DB_NAME || 'nexus_erp';
        const client = createClient(db);
        await client.connect();

        try {
            const { name, currency, timezone, country, features } = req.body || {};
            if (!name || !String(name).trim()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Company name is required',
                });
            }

            const companyDbId = `comp-${Date.now()}`;
            const featuresJson = JSON.stringify(features || {});

            await client.query('BEGIN');

            await client.query(
                `UPDATE tenants SET status = 'Active', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [user.tenantId],
            );

            await client.query(
                `INSERT INTO companies (id, tenant_id, name, currency, timezone, country, features, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'Active')`,
                [
                    companyDbId,
                    user.tenantId,
                    String(name).trim(),
                    currency || 'USD',
                    timezone || 'UTC',
                    country || 'USA',
                    featuresJson,
                ],
            );

            await client.query(
                `UPDATE users SET default_company_id = $1, status = 'Active', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [companyDbId, user.userId],
            );

            await client.query(
                `INSERT INTO user_companies (user_id, company_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [user.userId, companyDbId],
            );

            await client.query('COMMIT');

            return res.json({
                success: true,
                tenantId: user.tenantId,
                companyId: companyDbId,
                database: db,
            });
        } catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        } finally {
            await client.end().catch(() => { });
        }
    } catch (error) {
        console.error('Complete onboarding error:', error);
        res.status(500).json({
            error: 'Complete Onboarding Failed',
            message: error.message,
        });
    }
});

export default router;

