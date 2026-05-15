const jwt    = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'vetcare-jwt-secret-2026';

function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
        return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(header.slice(7), SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Solo administradores' });
    next();
}

module.exports = { requireAuth, adminOnly, SECRET };
