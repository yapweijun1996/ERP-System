import express from 'express';
import { getUserContext, registerTenant, loginUser } from '../services/authService.js';
import { getCurrentDatabaseName } from '../db/context.js';
import { authenticate } from '../middleware/auth.js';
import {
    clearAuthCookies,
    issueCsrfToken,
    setAuthCookies,
    shouldUseCookieAuth,
} from '../services/authCookieService.js';

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

        try {
            const { token, context } = await loginUser({
                username,
                password,
                companyId
            });

            const cookieMode = shouldUseCookieAuth(req);

            let csrfToken = null;
            if (cookieMode) {
                csrfToken = issueCsrfToken();
                setAuthCookies(res, { token, csrfToken });
            }

            res.json({
                token: cookieMode ? undefined : token,
                csrfToken,
                ...context
            });

        } catch (error) {
            if (error.code === 'USER_NOT_FOUND' || error.code === 'INVALID_PASSWORD') {
                return res.status(401).json({
                    error: 'Authentication Failed',
                    message: error.message
                });
            }
            if (error.code === 'ACCOUNT_INACTIVE') {
                return res.status(403).json({
                    error: 'Account Inactive',
                    message: error.message
                });
            }
            throw error; // Re-throw to be caught by outer catch block for database errors
        }

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
        try {
            const { token, user } = await registerTenant({
                username,
                email,
                password,
                name,
                companyName,
                routeCompanyId: companyId
            });

            res.status(201).json({
                token,
                user
            });
        } catch (error) {
            if (error.code === 'USERNAME_TAKEN') {
                return res.status(409).json({
                    error: 'Conflict',
                    message: 'Username already taken'
                });
            }
            throw error;
        }

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
router.get('/me', authenticate(), (req, res) => {
    res.json(req.auth.context);
});

/**
 * POST /api/auth/logout
 * Clear auth cookies (cookie mode)
 */
router.post('/logout', authenticate({ enforceAllowedCompanies: false }), (req, res) => {
    clearAuthCookies(res);
    res.json({ success: true });
});

export default router;
