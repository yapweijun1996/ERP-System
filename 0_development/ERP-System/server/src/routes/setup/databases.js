import express from 'express';
import { createClient } from './dbConfig.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const client = createClient('postgres');
        await client.connect();

        const result = await client.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false 
      AND datname NOT IN ('postgres')
      ORDER BY datname
    `);

        await client.end();

        res.json({
            databases: result.rows.map(row => row.datname)
        });
    } catch (error) {
        console.error('List databases error:', error);
        res.status(500).json({
            error: 'Failed to list databases',
            message: error.message
        });
    }
});

export default router;

