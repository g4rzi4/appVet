const express        = require('express');
const router         = express.Router();
const jwt            = require('jsonwebtoken');
const { read, write, uid } = require('../data/db');
const { SECRET }     = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email y contraseña requeridos' });

    if (email === 'admin@vetcare.com' && password === 'admin123') {
        const user  = { id: 'admin', nombre: 'Admin', apellido: 'VetCare', email };
        const token = jwt.sign({ ...user, role: 'admin' }, SECRET, { expiresIn: '24h' });
        return res.json({ token, user, role: 'admin' });
    }

    const db    = read();
    const dueno = db.duenos.find(d => d.email === email && d.password === password);
    if (!dueno) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const { password: _, ...safe } = dueno;
    const token = jwt.sign({ ...safe, role: 'owner' }, SECRET, { expiresIn: '24h' });
    res.json({ token, user: safe, role: 'owner' });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
    const { nombre, apellido, email, password, telefono, direccion } = req.body;
    if (!nombre || !email || !password)
        return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });

    if (email === 'admin@vetcare.com')
        return res.status(400).json({ error: 'Email no disponible' });

    const db = read();
    if (db.duenos.find(d => d.email === email))
        return res.status(400).json({ error: 'Email ya registrado' });

    const nuevo = { id: uid(), nombre, apellido, email, password, telefono: telefono || '', direccion: direccion || '' };
    db.duenos.push(nuevo);
    write(db);

    const { password: _, ...safe } = nuevo;
    const token = jwt.sign({ ...safe, role: 'owner' }, SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: safe, role: 'owner' });
});

module.exports = router;
