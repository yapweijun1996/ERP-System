import jwt from 'jsonwebtoken';
import { runWithDbContext } from '../db/context.js';
import { resolveDatabaseNameForCompanyId } from '../db/companyDbMap.js';

function tryGetCompanyIdFromToken(req) {
    const auth = req.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        return decoded?.companyId || null;
    } catch {
        return null;
    }
}

export function companyDbContextMiddleware(req, res, next) {
    if (req.path?.startsWith('/api/setup')) return next();

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
