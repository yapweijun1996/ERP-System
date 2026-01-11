import express from 'express';
import { resolveDatabaseNameForCompanyId } from '../../db/companyDbMap.js';
import { createClient } from './dbConfig.js';

const router = express.Router();

function isStrict() {
    const v = String(process.env.DB_REQUIRE_COMPANY_DB_MAP || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

router.get('/', async (req, res) => {
    try {
        const companyId = String(req.query?.company || '').trim();
        if (!companyId) {
            return res.status(400).json({
                status: 'error',
                message: "company is required, e.g. /api/setup/user-status?company=vantajas"
            });
        }

        const databaseName = resolveDatabaseNameForCompanyId(companyId);
        if (isStrict() && !databaseName) {
            return res.status(400).json({
                status: 'not_configured',
                message: `No database mapping found for company '${companyId}'.`,
                companyId
            });
        }

        const db = databaseName || process.env.DB_NAME || 'nexus_erp';
        const client = createClient(db);

        try {
            await client.connect();
        } catch (error) {
            if (error.code === '3D000') {
                return res.status(404).json({
                    status: 'not_found',
                    message: `Database '${db}' does not exist`,
                    companyId,
                    database: db
                });
            }
            throw error;
        }

        try {
            const tableRes = await client.query(`SELECT to_regclass('public.users') as users_table`);
            const hasUsersTable = !!tableRes.rows[0]?.users_table;
            if (!hasUsersTable) {
                return res.json({
                    status: 'no_users_table',
                    companyId,
                    database: db,
                    userCount: 0
                });
            }

            const countRes = await client.query('SELECT COUNT(*)::int AS cnt FROM public.users');
            const userCount = countRes.rows[0]?.cnt ?? 0;
            return res.json({
                status: 'ok',
                companyId,
                database: db,
                userCount
            });
        } finally {
            await client.end().catch(() => { });
        }
    } catch (error) {
        console.error('User status error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

export default router;

