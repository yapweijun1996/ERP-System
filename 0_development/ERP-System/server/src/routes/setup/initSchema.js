import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveDatabaseNameForCompanyId } from '../../db/companyDbMap.js';
import { createClient } from './dbConfig.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isStrict() {
    const v = String(process.env.DB_REQUIRE_COMPANY_DB_MAP || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

router.post('/', async (req, res) => {
    try {
        const companyId = String(req.query?.company || req.body?.companyId || '').trim();
        const loadSeedData = !!req.body?.loadSeedData;

        if (!companyId) {
            return res.status(400).json({
                error: 'Validation Error',
                message: "company is required, e.g. /api/setup/init-schema?company=vantajas"
            });
        }

        const databaseName = resolveDatabaseNameForCompanyId(companyId);
        if (isStrict() && !databaseName) {
            return res.status(400).json({
                error: 'Database Not Configured',
                message: `No database mapping found for company '${companyId}'.`
            });
        }

        const db = databaseName || process.env.DB_NAME || 'nexus_erp';
        const client = createClient(db);

        try {
            await client.connect();
        } catch (error) {
            if (error.code === '3D000') {
                return res.status(404).json({
                    error: 'Database Not Found',
                    message: `Database '${db}' does not exist`
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
            if (tableCount > 0) {
                return res.json({
                    success: true,
                    status: 'already_initialized',
                    message: `Database '${db}' already has tables`,
                    database: db,
                    tableCount
                });
            }

            const schemaPath = path.join(__dirname, '../../../../.database/migrations/001_init_schema.sql');
            const schemaSql = await fs.readFile(schemaPath, 'utf8');
            await client.query(schemaSql);

            if (loadSeedData) {
                const seedPath = path.join(__dirname, '../../../../.database/migrations/002_seed_data.sql');
                const seedSql = await fs.readFile(seedPath, 'utf8');
                await client.query(seedSql);
            }

            const afterRes = await client.query(`
        SELECT COUNT(*)::int AS table_count
        FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
      `);

            return res.json({
                success: true,
                status: 'initialized',
                message: `Schema applied to database '${db}'`,
                database: db,
                tableCount: afterRes.rows[0]?.table_count ?? null,
                seedDataLoaded: loadSeedData
            });
        } finally {
            await client.end().catch(() => { });
        }
    } catch (error) {
        console.error('Init schema error:', error);
        res.status(500).json({
            error: 'Init Schema Failed',
            message: error.message
        });
    }
});

export default router;

