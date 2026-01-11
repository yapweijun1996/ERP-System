import express from 'express';
import { createClient } from './dbConfig.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const client = createClient(process.env.DB_NAME || 'nexus_erp');
        try {
            await client.connect();
            const result = await client.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);

            const tableCount = parseInt(result.rows[0].table_count);
            await client.end();

            if (tableCount > 0) {
                return res.json({
                    status: 'ready',
                    message: 'Database is configured and ready',
                    database: process.env.DB_NAME || 'nexus_erp',
                    tableCount
                });
            }

            return res.json({
                status: 'empty',
                message: 'Database exists but has no tables',
                database: process.env.DB_NAME || 'nexus_erp',
                tableCount: 0
            });
        } catch (error) {
            await client.end().catch(() => { });
            if (error.code === '3D000') {
                return res.json({
                    status: 'not_configured',
                    message: 'Database does not exist',
                    database: process.env.DB_NAME || 'nexus_erp'
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Database status check error:', error);
        res.json({
            status: 'error',
            message: 'Cannot connect to PostgreSQL server',
            error: error.message
        });
    }
});

export default router;

