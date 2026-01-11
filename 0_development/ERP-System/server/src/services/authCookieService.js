import crypto from 'node:crypto';

function boolFromEnv(name, fallback = false) {
    const raw = String(process.env[name] ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function cookieSecure() {
    if (process.env.AUTH_COOKIE_SECURE !== undefined) return boolFromEnv('AUTH_COOKIE_SECURE', false);
    return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function cookieSameSite() {
    const v = String(process.env.AUTH_COOKIE_SAMESITE || '').trim().toLowerCase();
    if (v === 'none') return 'none';
    if (v === 'strict') return 'strict';
    if (v === 'lax') return 'lax';
    return 'lax';
}

function cookieDomain() {
    const v = String(process.env.AUTH_COOKIE_DOMAIN || '').trim();
    return v || undefined;
}

function cookieMaxAgeMs() {
    const raw = process.env.AUTH_COOKIE_MAX_AGE_MS;
    if (raw === undefined || raw === null || raw === '') return 24 * 60 * 60 * 1000;
    const n = Number.parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : 24 * 60 * 60 * 1000;
}

export function shouldUseCookieAuth(req) {
    const queryFlag = String(req.query?.cookie || '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(queryFlag)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(queryFlag)) return false;
    return boolFromEnv('AUTH_USE_COOKIE', false);
}

export function issueCsrfToken() {
    return crypto.randomUUID();
}

export function setAuthCookies(res, { token, csrfToken }) {
    const secure = cookieSecure();
    const sameSite = cookieSameSite();
    const domain = cookieDomain();
    const maxAge = cookieMaxAgeMs();
    const authCookieName = process.env.AUTH_COOKIE_NAME || 'auth_token';
    const csrfCookieName = process.env.CSRF_COOKIE_NAME || 'csrf_token';

    res.cookie(authCookieName, token, {
        httpOnly: true,
        secure,
        sameSite,
        domain,
        maxAge,
        path: '/',
    });

    res.cookie(csrfCookieName, csrfToken, {
        httpOnly: false,
        secure,
        sameSite,
        domain,
        maxAge,
        path: '/',
    });
}

export function clearAuthCookies(res) {
    const secure = cookieSecure();
    const sameSite = cookieSameSite();
    const domain = cookieDomain();
    const authCookieName = process.env.AUTH_COOKIE_NAME || 'auth_token';
    const csrfCookieName = process.env.CSRF_COOKIE_NAME || 'csrf_token';

    res.clearCookie(authCookieName, { path: '/', secure, sameSite, domain });
    res.clearCookie(csrfCookieName, { path: '/', secure, sameSite, domain });
}

