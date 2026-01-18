import express from 'express';
import bcrypt from 'bcryptjs';

import { createClient } from './dbConfig.js';

const router = express.Router();

function getSuperadminDbName() {
    return String(process.env.SUPERADMIN_DB_NAME || 'nexus_superadmin').trim() || 'nexus_superadmin';
}

const DEFAULT_SEED_PASSWORD_HASH =
    '$2a$10$6rF/9Fuqml6QhpgSBSfjU.cik7Lm6iXR/8VDGnGaHLDWvyos/BxXy';

function validatePassword(password) {
    const p = String(password || '');
    if (p.length < 10) return '密码至少 10 位';
    return null;
}

router.post('/', async (req, res) => {
    const db = getSuperadminDbName();
    const client = createClient(db);

    try {
        const { password, email } = req.body || {};
        const err = validatePassword(password);
        if (err) {
            return res.status(400).json({ error: 'Validation Error', message: err });
        }

        try {
            await client.connect();
        } catch (error) {
            if (error?.code === '3D000') {
                return res.status(400).json({
                    error: 'Database Not Found',
                    message: `Database '${db}' does not exist`,
                    database: db,
                });
            }
            throw error;
        }

        const userRes = await client.query(
            `SELECT id, password_hash
             FROM public.users
             WHERE username = 'superadmin' AND deleted_at IS NULL
             LIMIT 1`,
        );

        if (userRes.rows.length === 0) {
            return res.status(400).json({
                error: 'Superadmin Missing',
                message: 'superadmin user not found (seed data not applied?)',
            });
        }

        const user = userRes.rows[0];
        const currentHash = String(user.password_hash || '');
        const needsSetup = currentHash === DEFAULT_SEED_PASSWORD_HASH;
        if (!needsSetup) {
            return res.json({
                success: true,
                status: 'already_configured',
                message: 'Superadmin account already configured',
            });
        }

        const newHash = await bcrypt.hash(String(password), 10);
        const normalizedEmail = email ? String(email).trim() : null;

        await client.query(
            `UPDATE public.users
             SET password_hash = $1,
                 email = COALESCE($2, email),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newHash, normalizedEmail || null, user.id],
        );

        return res.json({
            success: true,
            status: 'configured',
            message: 'Superadmin password configured',
        });
    } catch (error) {
        console.error('Superadmin init account error:', error);
        return res.status(500).json({
            error: 'Server Error',
            message: error?.message || 'Failed to configure superadmin password',
        });
    } finally {
        await client.end().catch(() => { });
    }
});

export default router;

