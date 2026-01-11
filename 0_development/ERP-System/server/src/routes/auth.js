import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { getUserContext } from '../services/authService.js';
import { getCurrentDatabaseName } from '../db/context.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * User login with Username
 */
router.post('/login', async (req, res) => {
    try {
        const companyId = String(req.query?.company || '').trim();
        const { username, password } = req.body;

        if (!companyId) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'company is required in login url, e.g. /api/auth/login?company=comp-xxx'
            });
        }

        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Username and password are required'
            });
        }

        // 1. Validate credentials (minimal query)
        const authResult = await query(
            'SELECT id, password_hash, status FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username]
        );

        if (authResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Authentication Failed',
                message: 'User not found'
            });
        }

        const authUser = authResult.rows[0];

        if (authUser.status !== 'Active') {
            return res.status(403).json({
                error: 'Account Inactive',
                message: 'Your account has been suspended.'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, authUser.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Authentication Failed',
                message: 'Invalid password'
            });
        }

        // 2. Credentials valid, get full context
        const context = await getUserContext(authUser.id);

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [authUser.id]
        );

        // Generate Token
        const token = jwt.sign(
            {
                userId: context.user.id,
                username: context.user.username,
                tenantId: context.user.tenantId,
                companyId,
                roles: context.user.roles.map(r => r.id)
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            ...context
        });

    } catch (error) {
        console.error('Login error:', error);
        const dbName = getCurrentDatabaseName();
        const pgCode = error?.code;
        const isSchemaIssue =
            pgCode === '42703' || // undefined_column
            pgCode === '42P01' || // undefined_table
            pgCode === '3F000'; // invalid_schema_name

        if (isSchemaIssue) {
            return res.status(503).json({
                error: 'Database Not Ready',
                message: `Database schema not ready for this company. Please run migrations on database '${dbName || 'unknown'}'. Root error: ${error.message}`
            });
        }

        res.status(500).json({
            error: 'Server Error',
            message: `An error occurred during login: ${error.message}`
        });
    }
});

/**
 * POST /api/auth/register
 * User registration (for new tenants)
 */
router.post('/register', async (req, res) => {
    try {
        const companyId = String(req.query?.company || '').trim();
        const { username, email, password, name, companyName } = req.body;

        if (!companyId) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'company is required in register url, e.g. /api/auth/register?company=vantajas'
            });
        }

        // Validation
        if (!username || !password || !name || !companyName) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Username, password, name and company name are required'
            });
        }

        // Check availability
        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Username already taken'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create tenant
        const tenantId = `tenant-${Date.now()}`;
        await query(
            `INSERT INTO tenants (id, name, status, features)
       VALUES ($1, $2, 'Onboarding', '{"SALES": true, "FINANCE": true, "INVENTORY": true}')`,
            [tenantId, companyName]
        );

        // Create user
        const userId = `user-${Date.now()}`;
        await query(
            `INSERT INTO users (id, tenant_id, username, email, password_hash, name, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active')`,
            [userId, tenantId, username, email || null, passwordHash, name]
        );

        // Assign admin role
        const roleId = `role-admin-${tenantId}`;
        await query(
            `INSERT INTO roles (id, tenant_id, name, description, is_system_role)
       VALUES ($1, $2, 'Administrator', 'Tenant administrator', false)
       ON CONFLICT (id) DO NOTHING`,
            [roleId, tenantId]
        );

        await query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
            [userId, roleId]
        );

        // Generate token
        const token = jwt.sign(
            {
                userId,
                username,
                tenantId,
                companyId,
                roles: [roleId]
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: {
                id: userId,
                username,
                email,
                name,
                tenantId,
                status: 'Active'
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'An error occurred during registration'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info with context
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized', message: 'No token' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        const context = await getUserContext(decoded.userId);

        if (!context) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }

        res.json(context);

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        }
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
});

export default router;
