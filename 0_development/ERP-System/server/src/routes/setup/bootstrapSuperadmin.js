import express from 'express';
import { promisify } from 'util';
import { exec } from 'child_process';

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { createClient } from './dbConfig.js';

const router = express.Router();
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSuperadminDbName() {
    return String(process.env.SUPERADMIN_DB_NAME || 'nexus_superadmin').trim() || 'nexus_superadmin';
}

async function getTableCount(client) {
    const countRes = await client.query(`
        SELECT COUNT(*)::int AS table_count
        FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
    `);
    return countRes.rows[0]?.table_count ?? 0;
}

async function applySchemaAndSeed(dbName) {
    const client = createClient(dbName);
    await client.connect();
    try {
        const tableCount = await getTableCount(client);
        if (tableCount > 0) {
            return { status: 'ready', tableCount };
        }

        const schemaPath = path.join(__dirname, '../../../../.database/migrations/001_init_schema.sql');
        const seedPath = path.join(__dirname, '../../../../.database/migrations/002_seed_superadmin.sql');

        const schemaSql = await fs.readFile(schemaPath, 'utf8');
        await client.query(schemaSql);

        const seedSql = await fs.readFile(seedPath, 'utf8');
        await client.query(seedSql);

        const after = await getTableCount(client);
        return { status: 'ready', tableCount: after };
    } finally {
        await client.end().catch(() => { });
    }
}

async function createDatabase(dbName) {
    const dbUser = process.env.DB_USER || process.env.USER;
    await execAsync(`createdb -U ${dbUser} ${dbName}`);
}

router.post('/', async (req, res) => {
    const db = getSuperadminDbName();

    try {
        const client = createClient(db);
        try {
            await client.connect();
            const tableCount = await getTableCount(client);
            await client.end().catch(() => { });

            if (tableCount > 0) {
                return res.json({
                    status: 'ready',
                    message: `Database '${db}' already initialized`,
                    database: db,
                    tableCount,
                    didCreate: false,
                    didApplySchema: false,
                    didApplySeed: false,
                });
            }

            const result = await applySchemaAndSeed(db);
            return res.json({
                status: result.status,
                message: `Schema+seed applied to existing database '${db}'`,
                database: db,
                tableCount: result.tableCount,
                didCreate: false,
                didApplySchema: true,
                didApplySeed: true,
            });
        } catch (error) {
            await client.end().catch(() => { });
            if (error?.code !== '3D000') throw error;
        }

        await createDatabase(db);
        const result = await applySchemaAndSeed(db);

        return res.json({
            status: result.status,
            message: `Database '${db}' created and initialized`,
            database: db,
            tableCount: result.tableCount,
            didCreate: true,
            didApplySchema: true,
            didApplySeed: true,
        });
    } catch (error) {
        const msg = String(error?.message || error || '');
        const alreadyExists = msg.toLowerCase().includes('already exists');
        if (alreadyExists) {
            try {
                const result = await applySchemaAndSeed(db);
                return res.json({
                    status: result.status,
                    message: `Database '${db}' already existed; schema+seed ensured`,
                    database: db,
                    tableCount: result.tableCount,
                    didCreate: false,
                    didApplySchema: true,
                    didApplySeed: true,
                });
            } catch (e) {
                // fall through
            }
        }

        console.error('Bootstrap superadmin error:', error);
        return res.status(500).json({
            status: 'error',
            message: error?.message || 'Bootstrap failed',
            database: db,
        });
    }
});

export default router;
