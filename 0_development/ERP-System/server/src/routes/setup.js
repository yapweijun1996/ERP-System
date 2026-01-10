import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const execAsync = promisify(exec);
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GET /api/setup/status
 * Check database setup status
 */
router.get('/status', async (req, res) => {
    try {
        // Try to connect to the configured database
        const client = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'nexus_erp',
            user: process.env.DB_USER || process.env.USER,
            password: process.env.DB_PASSWORD || '',
        });

        try {
            await client.connect();

            // Check if tables exist
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
            } else {
                return res.json({
                    status: 'empty',
                    message: 'Database exists but has no tables',
                    database: process.env.DB_NAME || 'nexus_erp',
                    tableCount: 0
                });
            }
        } catch (error) {
            await client.end().catch(() => { });

            if (error.code === '3D000') {
                // Database does not exist
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

/**
 * GET /api/setup/databases
 * List available databases
 */
router.get('/databases', async (req, res) => {
    try {
        const client = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: 'postgres', // Connect to default database
            user: process.env.DB_USER || process.env.USER,
            password: process.env.DB_PASSWORD || '',
        });

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

/**
 * POST /api/setup/create-database
 * Create a new database
 */
router.post('/create-database', async (req, res) => {
    try {
        const { databaseName, loadSeedData } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Database name is required'
            });
        }

        // Validate database name (alphanumeric and underscores only)
        if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Database name can only contain letters, numbers, and underscores'
            });
        }

        const dbUser = process.env.DB_USER || process.env.USER;

        // Create database using createdb command
        try {
            await execAsync(`createdb -U ${dbUser} ${databaseName}`);
            console.log(`✅ Database '${databaseName}' created`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    error: 'Database Already Exists',
                    message: `Database '${databaseName}' already exists`
                });
            }
            throw error;
        }

        // Run schema migration
        const schemaPath = path.join(__dirname, '../../../.database/migrations/001_init_schema.sql');
        try {
            await execAsync(`psql -U ${dbUser} -d ${databaseName} -f ${schemaPath}`);
            console.log('✅ Schema created');
        } catch (error) {
            console.error('Schema creation failed:', error);
            // Try to drop the database if schema creation failed
            await execAsync(`dropdb -U ${dbUser} ${databaseName}`).catch(() => { });
            throw new Error('Failed to create database schema');
        }

        // Load seed data if requested
        if (loadSeedData) {
            const seedPath = path.join(__dirname, '../../../.database/migrations/002_seed_data.sql');
            try {
                await execAsync(`psql -U ${dbUser} -d ${databaseName} -f ${seedPath}`);
                console.log('✅ Seed data loaded');
            } catch (error) {
                console.error('Seed data loading failed:', error);
                // Continue anyway, seed data is optional
            }
        }

        // Update .env file
        const envPath = path.join(__dirname, '../../.env');
        try {
            let envContent = await fs.readFile(envPath, 'utf8');
            envContent = envContent.replace(
                /DB_NAME=.*/,
                `DB_NAME=${databaseName}`
            );
            await fs.writeFile(envPath, envContent);
            console.log('✅ .env file updated');

            // Force update process.env for immediate effect
            process.env.DB_NAME = databaseName;
        } catch (error) {
            console.error('Failed to update .env:', error);
        }

        res.json({
            success: true,
            message: `Database '${databaseName}' created successfully`,
            database: databaseName,
            seedDataLoaded: loadSeedData
        });

    } catch (error) {
        console.error('Create database error:', error);
        res.status(500).json({
            error: 'Database Creation Failed',
            message: error.message
        });
    }
});

/**
 * POST /api/setup/use-database
 * Configure to use an existing database
 */
router.post('/use-database', async (req, res) => {
    try {
        const { databaseName } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Database name is required'
            });
        }

        // Test connection to the database
        const client = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: databaseName,
            user: process.env.DB_USER || process.env.USER,
            password: process.env.DB_PASSWORD || '',
        });

        try {
            await client.connect();

            // Check if it has the required tables
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

            // Update .env file
            const envPath = path.join(__dirname, '../../.env');
            try {
                let envContent = await fs.readFile(envPath, 'utf8');
                envContent = envContent.replace(
                    /DB_NAME=.*/,
                    `DB_NAME=${databaseName}`
                );
                await fs.writeFile(envPath, envContent);
                console.log('✅ .env file updated');

                // Force update process.env for immediate effect
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

/**
 * POST /api/setup/test-connection
 * Test database connection
 */
router.post('/test-connection', async (req, res) => {
    try {
        const { host, port, database, user, password } = req.body;

        const client = new Client({
            host: host || 'localhost',
            port: port || 5432,
            database: database || 'postgres',
            user: user || process.env.USER,
            password: password || '',
        });

        await client.connect();
        await client.query('SELECT NOW()');
        await client.end();

        res.json({
            success: true,
            message: 'Connection successful'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Connection Failed',
            message: error.message
        });
    }
});

export default router;
