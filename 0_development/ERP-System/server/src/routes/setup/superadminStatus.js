import express from 'express';
import { createClient } from './dbConfig.js';

const router = express.Router();

function getSuperadminDbName() {
    return String(process.env.SUPERADMIN_DB_NAME || 'nexus_superadmin').trim() || 'nexus_superadmin';
}

router.get('/', async (req, res) => {
    const db = getSuperadminDbName();
    const client = createClient(db);

    try {
        try {
            await client.connect();
        } catch (error) {
            if (error?.code === '3D000') {
                // Use 200 to avoid fetch treating this as "error" in the browser console.
                return res.json({
                    status: 'not_found',
                    message: `Database '${db}' does not exist`,
                    database: db,
                });
            }
            throw error;
        }

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
                database: db,
                tableCount,
            });
        }

        return res.json({
            status: 'ready',
            message: `Database '${db}' is ready`,
            database: db,
            tableCount,
        });
    } catch (error) {
        console.error('Superadmin status error:', error);
        return res.status(500).json({
            status: 'error',
            message: error?.message || 'Failed to check superadmin status',
            database: db,
        });
    } finally {
        await client.end().catch(() => { });
    }
});

export default router;
