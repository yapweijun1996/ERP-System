import jwt from 'jsonwebtoken';

function getJwtSecret() {
    return process.env.JWT_SECRET || 'your-secret-key';
}

function getBearerToken(req) {
    const auth = req.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7).trim();
    return token || null;
}

export function requireSuperadmin() {
    return (req, res, next) => {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Missing token' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, getJwtSecret());
        } catch (e) {
            return res.status(401).json({ error: 'Unauthorized', message: e?.message || 'Invalid token' });
        }

        if (!decoded?.isSuperadmin) {
            return res.status(403).json({ error: 'Forbidden', message: 'Superadmin required' });
        }

        req.superadmin = { token, decoded };
        return next();
    };
}

