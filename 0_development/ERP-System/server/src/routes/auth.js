import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * User login
 */
// Helper to get full user context
async function getUserContext(userId) {
    // Get user data with roles and company associations
    const userResult = await query(
        `SELECT u.id, u.email, u.name, u.status, u.tenant_id, u.default_company_id,
              array_agg(DISTINCT ur.role_id) as role_ids,
              array_agg(DISTINCT uc.company_id) as company_ids
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN user_companies uc ON u.id = uc.user_id
       WHERE u.id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id`,
        [userId]
    );

    if (userResult.rows.length === 0) return null;
    const user = userResult.rows[0];

    // Get Tenant details
    let tenant = null;
    if (user.tenant_id) {
        const tenantResult = await query(
            'SELECT id, name, status, subscription_tier, features FROM tenants WHERE id = $1',
            [user.tenant_id]
        );
        if (tenantResult.rows.length > 0) {
            tenant = tenantResult.rows[0];
            // Normalize features structure
            if (!tenant.features) tenant.features = {};
        }
    }

    // Get Default Company details
    let company = null;
    if (user.default_company_id) {
        const companyResult = await query(
            'SELECT id, name, currency, timezone, country, features, status FROM companies WHERE id = $1',
            [user.default_company_id]
        );
        if (companyResult.rows.length > 0) {
            company = companyResult.rows[0];
            // Normalize features structure
            if (!company.features) company.features = {};
        }
    }

    // Get Roles detailed info
    let roles = [];
    if (user.role_ids && user.role_ids.length > 0 && user.role_ids[0] !== null) {
        const rolesResult = await query(
            `SELECT r.id, r.name, array_agg(p.code) as permissions
             FROM roles r
             LEFT JOIN role_permissions rp ON r.id = rp.role_id
             LEFT JOIN permissions p ON rp.permission_id = p.id
             WHERE r.id = ANY($1)
             GROUP BY r.id`,
            [user.role_ids]
        );
        roles = rolesResult.rows;
    }

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            tenantId: user.tenant_id,
            defaultCompanyId: user.default_company_id,
            roles,
            allowedCompanyIds: user.company_ids ? user.company_ids.filter(id => id !== null) : []
        },
        tenant,
        company
    };
}

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Email and password are required'
            });
        }

        // 1. Validate credentials first (minimal query)
        const authResult = await query(
            'SELECT id, password_hash, status FROM users WHERE email = $1 AND deleted_at IS NULL',
            [email.toLowerCase()]
        );

        if (authResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Authentication Failed',
                message: 'Invalid email or password'
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
                message: 'Invalid email or password'
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
                email: context.user.email,
                tenantId: context.user.tenantId,
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
        res.status(500).json({
            error: 'Server Error',
            message: 'An error occurred during login'
        });
    }
});

// ... register endpoint remains same ...

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

/**
 * POST /api/auth/register
 * User registration (for new tenants)
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, companyName } = req.body;

        // Validation
        if (!email || !password || !name || !companyName) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'All fields are required'
            });
        }

        // Check if email already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Email already registered'
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
            `INSERT INTO users (id, tenant_id, email, password_hash, name, status)
       VALUES ($1, $2, $3, $4, $5, 'Active')`,
            [userId, tenantId, email.toLowerCase(), passwordHash, name]
        );

        // Assign admin role (create if doesn't exist)
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
                email: email.toLowerCase(),
                tenantId,
                roles: [roleId]
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: {
                id: userId,
                email: email.toLowerCase(),
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
 * Get current user info (requires authentication)
 */
router.get('/me', async (req, res) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        // Get user data
        const userResult = await query(
            `SELECT u.id, u.email, u.name, u.status, u.tenant_id, u.default_company_id,
              array_agg(DISTINCT ur.role_id) as role_ids,
              array_agg(DISTINCT uc.company_id) as company_ids
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN user_companies uc ON u.id = uc.user_id
       WHERE u.id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id`,
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                status: user.status,
                tenantId: user.tenant_id,
                defaultCompanyId: user.default_company_id,
                roleIds: user.role_ids.filter(id => id !== null),
                allowedCompanyIds: user.company_ids.filter(id => id !== null)
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token'
            });
        }

        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'An error occurred'
        });
    }
});

export default router;
