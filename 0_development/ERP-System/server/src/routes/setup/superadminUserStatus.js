import express from 'express';

import { createClient } from './dbConfig.js';

const router = express.Router();

function getSuperadminDbName() {
    return String(process.env.SUPERADMIN_DB_NAME || 'nexus_superadmin').trim() || 'nexus_superadmin';
}

// Same bcrypt hash as `.database/migrations/002_seed_superadmin.sql` default password ("password").
const DEFAULT_SEED_PASSWORD_HASH =
    '$2a$10$6rF/9Fuqml6QhpgSBSfjU.cik7Lm6iXR/8VDGnGaHLDWvyos/BxXy';

router.get('/', async (req, res) => {
    const db = getSuperadminDbName();
    const client = createClient(db);

    try {
        try {
            await client.connect();
        } catch (error) {
            if (error?.code === '3D000') {
                return res.json({
                    status: 'not_found',
                    message: `Database '${db}' does not exist`,
                    database: db,
                });
            }
            throw error;
        }

        const userRes = await client.query(
            `SELECT id, username, email, password_hash
             FROM public.users
             WHERE username = 'superadmin' AND deleted_at IS NULL
             LIMIT 1`,
        );

        if (userRes.rows.length === 0) {
            return res.json({
                status: 'no_superadmin_user',
                database: db,
                needsSetup: true,
            });
        }

        const user = userRes.rows[0];
        const needsSetup = String(user.password_hash || '') === DEFAULT_SEED_PASSWORD_HASH;

        return res.json({
            status: 'ok',
            database: db,
            needsSetup,
            user: {
                id: user.id,
                username: user.username,
                email: user.email || null,
            },
        });
    } catch (error) {
        console.error('Superadmin user status error:', error);
        return res.status(500).json({
            status: 'error',
            message: error?.message || 'Failed to check superadmin user status',
            database: db,
        });
    } finally {
        await client.end().catch(() => { });
    }
});

export default router;
