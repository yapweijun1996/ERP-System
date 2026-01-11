import jwt from 'jsonwebtoken';
import { getUserContext } from '../services/authService.js';

function envInt(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number.parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : fallback;
}

function getJwtSecret() {
    return process.env.JWT_SECRET || 'your-secret-key';
}

function getBearerToken(req) {
    const auth = req.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7).trim();
    return token || null;
}

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

function getCookieToken(req) {
    const cookieName = process.env.AUTH_COOKIE_NAME || 'auth_token';
    const cookies = parseCookieHeader(req.headers?.cookie);
    const token = cookies?.[cookieName];
    return token ? String(token).trim() : null;
}

function normalizeCompanyId(value) {
    const v = String(value ?? '').trim();
    return v ? v : null;
}

function getCompanyKeyFromRequest(req) {
    const fromHeader = normalizeCompanyId(req.headers?.['x-company-id']);
    const fromQuery = normalizeCompanyId(req.query?.company);
    return fromHeader || fromQuery || null;
}

function getCompanyDbIdFromRequest(req) {
    const fromQuery = normalizeCompanyId(req.query?.companyId);
    const fromBody = normalizeCompanyId(req.body?.companyId);
    return fromQuery || fromBody || null;
}

function toPermissionSet(roles) {
    const permissions = new Set();
    for (const role of roles || []) {
        for (const code of role?.permissions || []) {
            if (typeof code === 'string' && code.trim()) permissions.add(code.trim());
        }
    }
    return permissions;
}

function isPlatformAdmin(permissionSet) {
    return permissionSet?.has?.('PLATFORM_ADMIN') || false;
}

const contextCache = new Map();
const contextCacheTtlMs = envInt('AUTH_CONTEXT_CACHE_TTL_MS', 5000);
const contextCacheMax = envInt('AUTH_CONTEXT_CACHE_MAX', 500);

function cacheKey(userId, companyId) {
    return `${userId}::${companyId || ''}`;
}

async function getUserContextCached(userId, companyId) {
    const now = Date.now();
    const key = cacheKey(userId, companyId);
    const cached = contextCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    const value = await getUserContext(userId);
    contextCache.set(key, { expiresAt: now + contextCacheTtlMs, value });

    if (contextCache.size > contextCacheMax) {
        const oldestKey = contextCache.keys().next().value;
        if (oldestKey) contextCache.delete(oldestKey);
    }

    return value;
}

export function authenticate(options = {}) {
    const {
        requireCompanyMatch = true,
        requireActiveUser = true,
        requireTenantMatch = true,
        enforceAllowedCompanies = true,
    } = options;

    return async (req, res, next) => {
        try {
            const bearer = getBearerToken(req);
            const cookie = getCookieToken(req);
            const token = bearer || cookie;
            if (!token) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Missing token' });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, getJwtSecret());
            } catch (e) {
                return res.status(401).json({ error: 'Unauthorized', message: e?.message || 'Invalid token' });
            }

            const tokenCompanyKey = normalizeCompanyId(decoded?.companyKey ?? decoded?.companyId);
            const requestCompanyKey = getCompanyKeyFromRequest(req);

            if (
                requireCompanyMatch &&
                tokenCompanyKey &&
                requestCompanyKey &&
                tokenCompanyKey !== requestCompanyKey
            ) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Token companyId does not match request company',
                });
            }

            const context = await getUserContextCached(decoded.userId, tokenCompanyKey);
            if (!context?.user?.id) {
                return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
            }

            if (requireActiveUser && context.user.status !== 'Active') {
                return res.status(403).json({ error: 'Account Inactive', message: 'Your account has been suspended.' });
            }

            if (
                requireTenantMatch &&
                decoded?.tenantId &&
                context.user.tenantId &&
                String(decoded.tenantId) !== String(context.user.tenantId)
            ) {
                return res.status(403).json({ error: 'Forbidden', message: 'Token tenantId mismatch' });
            }

            const permissions = toPermissionSet(context.user.roles);
            const platformAdmin = isPlatformAdmin(permissions);
            const tenantAdmin = context.user.roles.some(r => r.name === 'Administrator');

            const requestCompanyDbId = getCompanyDbIdFromRequest(req);
            const tokenCompanyDbId = normalizeCompanyId(decoded?.companyDbId);
            const effectiveCompanyDbId =
                requestCompanyDbId ||
                tokenCompanyDbId ||
                normalizeCompanyId(context.user.defaultCompanyId) ||
                null;

            if (enforceAllowedCompanies && !platformAdmin && !tenantAdmin) {
                const allowed = Array.isArray(context.user.allowedCompanyIds)
                    ? context.user.allowedCompanyIds.map(String)
                    : [];
                if (effectiveCompanyDbId && allowed.length > 0 && !allowed.includes(String(effectiveCompanyDbId))) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: `No access to company '${effectiveCompanyDbId}'`,
                    });
                }
            }

            req.auth = {
                token,
                tokenSource: bearer ? 'bearer' : 'cookie',
                decoded,
                permissions,
                context,
                companyKey: tokenCompanyKey,
                companyDbId: effectiveCompanyDbId,
            };

            return next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            return res.status(500).json({ error: 'Server Error', message: 'Authentication failed' });
        }
    };
}

export function requirePermission(permissionCode) {
    return (req, res, next) => {
        const permissions = req.auth?.permissions;
        if (!permissions) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Missing auth context' });
        }
        if (permissions.has('PLATFORM_ADMIN') || permissions.has(permissionCode)) return next();
        return res.status(403).json({
            error: 'Forbidden',
            message: `Missing permission '${permissionCode}'`,
        });
    };
}

export function requireAnyPermission(permissionCodes) {
    const list = Array.isArray(permissionCodes) ? permissionCodes : [];
    return (req, res, next) => {
        const permissions = req.auth?.permissions;
        if (!permissions) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Missing auth context' });
        }
        if (permissions.has('PLATFORM_ADMIN')) return next();
        for (const code of list) {
            if (permissions.has(code)) return next();
        }
        return res.status(403).json({
            error: 'Forbidden',
            message: `Missing permissions: ${list.join(', ') || '(none)'}`,
        });
    };
}
