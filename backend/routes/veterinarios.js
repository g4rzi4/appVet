const express              = require('express');
const router               = express.Router();
const { read, write, uid }        = require('../data/db');
const { requireAuth, adminOnly }  = require('../middleware/auth');

router.use(requireAuth);

const strip = ({ password, ...rest }) => rest;

// Todos los roles pueden listar veterinarios (para selects de citas, etc.)
router.get('/', (req, res) => {
    res.json(read().veterinarios.map(strip));
});

router.get('/:id', (req, res) => {
    // Vet solo puede ver su propio perfil
    if (req.user.role === 'vet' && req.user.id !== req.params.id)
        return res.status(403).json({ error: 'Sin permiso' });
    const item = read().veterinarios.find(v => v.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(strip(item));
});

// Solo admin puede crear/editar/eliminar veterinarios
router.post('/', adminOnly, (req, res) => {
    if (!req.body.email || !req.body.email.endsWith('@vetcare.com'))
        return res.status(400).json({ error: 'El email debe terminar en @vetcare.com' });
    if (!req.body.password)
        return res.status(400).json({ error: 'La contraseña es requerida' });
    if (req.body.password.length < 8 || !/[A-Z]/.test(req.body.password))
        return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres y al menos una mayúscula' });

    const db   = read();
    const item = { ...req.body, id: uid() };
    db.veterinarios.push(item);
    write(db);
    res.status(201).json(strip(item));
});

router.put('/:id', adminOnly, (req, res) => {
    if (req.body.email && !req.body.email.endsWith('@vetcare.com'))
        return res.status(400).json({ error: 'El email debe terminar en @vetcare.com' });

    const db  = read();
    const idx = db.veterinarios.findIndex(v => v.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });

    const upd = { ...db.veterinarios[idx], ...req.body, id: req.params.id };
    if (!req.body.password) upd.password = db.veterinarios[idx].password;
    db.veterinarios[idx] = upd;
    write(db);
    res.json(strip(upd));
});

router.delete('/:id', adminOnly, (req, res) => {
    const db  = read();
    const idx = db.veterinarios.findIndex(v => v.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    db.veterinarios.splice(idx, 1);
    write(db);
    res.json({ ok: true });
});

module.exports = router;
