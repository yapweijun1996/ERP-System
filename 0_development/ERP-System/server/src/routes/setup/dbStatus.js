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
                message: "company is required, e.g. /api/setup/db-status?company=vantajas"
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
            const countRes = await client.query(`
        SELECT COUNT(*)::int AS table_count
        FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
      `);
            const tableCount = countRes.rows[0]?.table_count ?? 0;
            if (tableCount <= 0) {
                return res.json({
                    status: 'empty',
                    message: `Database '${db}' is empty`,
                    companyId,
                    database: db,
                    tableCount
                });
            }

            return res.json({
                status: 'ready',
                message: `Database '${db}' is ready`,
                companyId,
                database: db,
                tableCount
            });
        } finally {
            await client.end().catch(() => { });
        }
    } catch (error) {
        console.error('DB status error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

export default router;

