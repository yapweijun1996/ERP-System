import { query } from '../db/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function registerTenant({ username, email, password, name, companyName, routeCompanyId }) {
    // Check availability
    const existingUser = await query(
        'SELECT id FROM users WHERE username = $1',
        [username]
    );

    if (existingUser.rows.length > 0) {
        const error = new Error('Username already taken');
        error.code = 'USERNAME_TAKEN';
        throw error;
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

    // Auto-assign all permissions to admin role (except PLATFORM_ADMIN)
    // This ensures new tenants have full access to all modules without manual setup
    await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code != 'PLATFORM_ADMIN'
         ON CONFLICT DO NOTHING`,
        [roleId]
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
            companyId: routeCompanyId,
            companyKey: routeCompanyId,
            companyDbId: null,
            roles: [roleId]
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
    );

    return {
        token,
        user: {
            id: userId,
            username,
            email,
            name,
            tenantId,
            status: 'Active'
        }
    };
}

export async function loginUser({ username, password, companyId }) {
    // 1. Validate credentials (minimal query)
    const authResult = await query(
        'SELECT id, password_hash, status FROM users WHERE username = $1 AND deleted_at IS NULL',
        [username]
    );

    if (authResult.rows.length === 0) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
    }

    const authUser = authResult.rows[0];

    if (authUser.status !== 'Active') {
        const error = new Error('Your account has been suspended.');
        error.code = 'ACCOUNT_INACTIVE';
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, authUser.password_hash);
    if (!isPasswordValid) {
        const error = new Error('Invalid password');
        error.code = 'INVALID_PASSWORD';
        throw error;
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
            companyKey: companyId,
            companyDbId: context.user.defaultCompanyId || null,
            roles: context.user.roles.map(r => r.id)
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
    );

    return {
        token,
        context
    };
}

export async function getUserContext(userId) {
    // Get user data with roles and company associations
    const userResult = await query(
        `SELECT u.id, u.username, u.email, u.name, u.status, u.tenant_id, u.default_company_id,
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

    // Get All Available Companies for the User
    let companies = [];
    if (user.tenant_id) {
        // If user is admin (has no explicit company assignment in user_companies but is active in tenant), 
        // they might should see all. But for now, let's stick to explicit assignments + tenant catch all if implemented.
        // Simplified: fetching all companies for the tenant for now to ensure lists work for demos, 
        // OR better: fetch based on user's authorized company list. 

        const companyIds = user.company_ids ? user.company_ids.filter(id => id !== null) : [];

        if (companyIds.length > 0) {
            const compsResult = await query(
                'SELECT id, name, currency, timezone, country, features, status FROM companies WHERE id = ANY($1)',
                [companyIds]
            );
            companies = compsResult.rows.map(c => ({ ...c, features: c.features || {} }));
        } else {
            // Fallback: if no direct assignment, check if admin or fetching all for tenant (optional policy)
            // For this specific 'alice' user who is admin, she might need all companies.
            // Let's just return matches for now.
        }
    }

    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            status: user.status,
            tenantId: user.tenant_id,
            defaultCompanyId: user.default_company_id,
            roles,
            allowedCompanyIds: user.company_ids ? user.company_ids.filter(id => id !== null) : []
        },
        tenant,
        company,
        companies
    };
}
