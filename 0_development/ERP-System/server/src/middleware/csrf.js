function normalizeHeaderName(name) {
    return String(name || '').trim().toLowerCase();
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

function getCookies(req) {
    return parseCookieHeader(req.headers?.cookie);
}

function getCsrfConfig() {
    return {
        cookieName: process.env.CSRF_COOKIE_NAME || 'csrf_token',
        headerName: normalizeHeaderName(process.env.CSRF_HEADER_NAME || 'x-csrf-token'),
        authCookieName: process.env.AUTH_COOKIE_NAME || 'auth_token',
    };
}

function shouldProtect(req) {
    const method = String(req.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;

    const path = req.path || '';
    if (path === '/health' || path === '/api') return false;
    if (path.startsWith('/api/setup')) return false;
    if (path.startsWith('/api/auth/login')) return false;
    if (path.startsWith('/api/auth/register')) return false;
    return true;
}

export function csrfProtection(req, res, next) {
    if (!shouldProtect(req)) return next();

    const { cookieName, headerName, authCookieName } = getCsrfConfig();
    const cookies = getCookies(req);

    const hasAuthCookie = !!cookies?.[authCookieName];
    if (!hasAuthCookie) return next();

    const csrfCookie = cookies?.[cookieName] || null;
    const csrfHeader = req.headers?.[headerName] || null;
    const csrfHeaderValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

    if (!csrfCookie || !csrfHeaderValue || String(csrfCookie) !== String(csrfHeaderValue)) {
        return res.status(403).json({
            error: 'CSRF Forbidden',
            message: 'Missing or invalid CSRF token',
        });
    }

    return next();
}

