const express              = require('express');
const router               = express.Router();
const { read, write, uid }        = require('../data/db');
const { requireAuth, adminOnly }  = require('../middleware/auth');

function generateTempPassword() {
    const upper  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower  = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    let pwd = '';
    for (let i = 0; i < 2; i++) pwd += upper[Math.floor(Math.random()  * upper.length)];
    for (let i = 0; i < 4; i++) pwd += lower[Math.floor(Math.random()  * lower.length)];
    for (let i = 0; i < 2; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

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

    const db = read();
    if (db.veterinarios.find(v => v.email === req.body.email))
        return res.status(400).json({ error: 'Email ya registrado' });

    const tempPassword = generateTempPassword();
    const item = { ...req.body, id: uid(), password: tempPassword, mustChangePassword: true };
    db.veterinarios.push(item);
    write(db);
    res.status(201).json({ ...strip(item), tempPassword });
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
