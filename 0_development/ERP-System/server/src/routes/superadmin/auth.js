import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { runWithDbContext } from '../../db/context.js';
import { query } from '../../db/index.js';

import { requireSuperadmin } from '../../middleware/superadminAuth.js';
import { getUserContext } from '../../services/authService.js';

const router = express.Router();

function getSuperadminDbName() {
    return String(process.env.SUPERADMIN_DB_NAME || 'nexus_superadmin').trim() || 'nexus_superadmin';
}

function signSuperadminToken({ userId, username }) {
    return jwt.sign(
        {
            userId,
            username,
            isSuperadmin: true,
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' },
    );
}

router.post('/login', async (req, res) => {
    const databaseName = getSuperadminDbName();

    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Username and password are required',
            });
        }

        return runWithDbContext({ companyId: null, databaseName }, async () => {
            const authResult = await query(
                `SELECT id, username, password_hash, status
                 FROM users
                 WHERE username = $1 AND deleted_at IS NULL`,
                [String(username).trim()],
            );

            if (authResult.rows.length === 0) {
                return res.status(401).json({ error: 'Authentication Failed', message: 'User not found' });
            }

            const userRow = authResult.rows[0];
            if (userRow.status !== 'Active') {
                return res.status(403).json({ error: 'Account Inactive', message: 'Your account has been suspended.' });
            }

            const ok = await bcrypt.compare(String(password), userRow.password_hash);
            if (!ok) {
                return res.status(401).json({ error: 'Authentication Failed', message: 'Invalid password' });
            }

            await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [userRow.id]);

            const context = await getUserContext(userRow.id);
            const token = signSuperadminToken({ userId: userRow.id, username: userRow.username });

            return res.json({
                token,
                ...context,
                superadmin: true,
            });
        });
    } catch (error) {
        console.error('Superadmin login error:', error);
        return res.status(500).json({ error: 'Server Error', message: error?.message || 'Login failed' });
    }
});

router.get('/me', requireSuperadmin(), async (req, res) => {
    const databaseName = getSuperadminDbName();
    return runWithDbContext({ companyId: null, databaseName }, async () => {
        const userId = req.superadmin?.decoded?.userId;
        const context = userId ? await getUserContext(userId) : null;
        if (!context?.user?.id) {
            return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        }
        return res.json({ ...context, superadmin: true });
    });
});

export default router;

