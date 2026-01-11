function safeJsonParse(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function normalizeCompanyId(companyId) {
    return String(companyId || '').trim().toLowerCase();
}

function sanitizeDbSuffix(companyId) {
    const raw = String(companyId || '').trim();
    if (!raw) return null;
    const normalized = raw.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    if (!normalized) return null;
    if (/^[a-z_]/.test(normalized)) return normalized;
    return `c_${normalized}`;
}

function databaseNameByPrefix(companyId) {
    const suffix = sanitizeDbSuffix(companyId);
    if (!suffix) return null;
    const base = process.env.DB_NAME_PREFIX || `${process.env.DB_NAME || 'nexus_erp'}__`;
    return `${base}${suffix}`;
}

export function resolveDatabaseNameForCompanyId(companyId) {
    const key = normalizeCompanyId(companyId);
    if (!key) return null;

    const requireMap = String(process.env.DB_REQUIRE_COMPANY_DB_MAP || '')
        .trim()
        .toLowerCase();
    const strict = ['1', 'true', 'yes', 'y', 'on'].includes(requireMap);

    const map = safeJsonParse(process.env.DB_COMPANY_DB_MAP);
    if (map && typeof map === 'object') {
        const direct = map[key] ?? map[String(companyId || '').trim()] ?? null;
        if (typeof direct === 'string' && direct.trim()) return direct.trim();
    }

    if (strict) return null;
    return databaseNameByPrefix(companyId);
}
