import express from 'express';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post('/', async (req, res) => {
    try {
        const { databaseName, loadSeedData } = req.body;

        if (!databaseName) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Database name is required'
            });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Database name can only contain letters, numbers, and underscores'
            });
        }

        const dbUser = process.env.DB_USER || process.env.USER;

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

        const schemaPath = path.join(__dirname, '../../../../.database/migrations/001_init_schema.sql');
        try {
            await execAsync(`psql -U ${dbUser} -d ${databaseName} -f ${schemaPath}`);
            console.log('✅ Schema created');
        } catch (error) {
            console.error('Schema creation failed:', error);
            await execAsync(`dropdb -U ${dbUser} ${databaseName}`).catch(() => { });
            throw new Error('Failed to create database schema');
        }

        if (loadSeedData) {
            const seedPath = path.join(__dirname, '../../../../.database/migrations/002_seed_data.sql');
            try {
                await execAsync(`psql -U ${dbUser} -d ${databaseName} -f ${seedPath}`);
                console.log('✅ Seed data loaded');
            } catch (error) {
                console.error('Seed data loading failed:', error);
            }
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

export default router;

