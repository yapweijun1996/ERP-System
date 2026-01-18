import jwt from 'jsonwebtoken';
import { runWithDbContext } from '../db/context.js';
import { resolveDatabaseNameForCompanyId } from '../db/companyDbMap.js';

function parseCookieHeader(headerValue) {
    const raw = String(headerValue || '');
    if (!raw) return {};
    const out = {};
    for (const part of raw.split(';')) {
        const idx = part.indexOf('=');
        if (idx <= 0) continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) continue;
        out[key] = decodeURIComponent(value);
    }
    return out;
}

function tryGetCompanyIdFromToken(req) {
    const auth = req.headers?.authorization;
    let token = null;
    if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
    if (!token) {
        const cookieName = process.env.AUTH_COOKIE_NAME || 'auth_token';
        const cookies = parseCookieHeader(req.headers?.cookie);
        token = cookies?.[cookieName] || null;
    }
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        return decoded?.companyId || null;
    } catch {
        return null;
    }
}

export function companyDbContextMiddleware(req, res, next) {
    if (req.path?.startsWith('/api/setup')) return next();
    if (req.path?.startsWith('/api/superadmin')) return next();

    const requireMap = String(process.env.DB_REQUIRE_COMPANY_DB_MAP || '')
        .trim()
        .toLowerCase();
    const strict = ['1', 'true', 'yes', 'y', 'on'].includes(requireMap);

    const isApi = req.path?.startsWith('/api/');
    const isPublic =
        req.path === '/health' ||
        req.path === '/api' ||
        req.path?.startsWith('/api/auth/register') ||
        req.path?.startsWith('/api/auth/login');

    const companyIdFromToken = tryGetCompanyIdFromToken(req);
    const companyIdFromHeader = req.headers?.['x-company-id'];
    const companyIdFromQuery = req.query?.company;
    const companyId = companyIdFromToken || companyIdFromHeader || companyIdFromQuery || null;
    const databaseName = companyId ? resolveDatabaseNameForCompanyId(companyId) : null;

    if (strict && isApi && !isPublic && !companyId) {
        return res.status(400).json({
            error: 'Company Required',
            message: "Missing company identifier. Use '?company=...' or 'x-company-id' header.",
        });
    }

    if (strict && companyId && !databaseName) {
        return res.status(400).json({
            error: 'Database Not Configured',
            message: `No database mapping found for company '${companyId}'.`,
        });
    }

    return runWithDbContext(
        {
            companyId,
            databaseName
        },
        () => next()
    );
}
