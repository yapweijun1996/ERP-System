import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from './dbConfig.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post('/', async (req, res) => {
    try {
        const { databaseName } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Database name is required'
            });
        }

        const client = createClient(databaseName);
        try {
            await client.connect();

            const result = await client.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('tenants', 'companies', 'users')
      `);

            const requiredTables = parseInt(result.rows[0].table_count);
            await client.end();

            if (requiredTables < 3) {
                return res.status(400).json({
                    error: 'Invalid Database',
                    message: 'This database does not appear to be a valid Nexus ERP database. Missing required tables.'
                });
            }

            const envPath = path.join(__dirname, '../../../.env');
            try {
                let envContent = await fs.readFile(envPath, 'utf8');
                envContent = envContent.replace(/DB_NAME=.*/, `DB_NAME=${databaseName}`);
                await fs.writeFile(envPath, envContent);
                console.log('✅ .env file updated');
                process.env.DB_NAME = databaseName;
            } catch (error) {
                console.error('Failed to update .env:', error);
            }

            res.json({
                success: true,
                message: `Now using database '${databaseName}'`,
                database: databaseName
            });

        } catch (error) {
            await client.end().catch(() => { });
            if (error.code === '3D000') {
                return res.status(404).json({
                    error: 'Database Not Found',
                    message: `Database '${databaseName}' does not exist`
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Use database error:', error);
        res.status(500).json({
            error: 'Configuration Failed',
            message: error.message
        });
    }
});

export default router;

