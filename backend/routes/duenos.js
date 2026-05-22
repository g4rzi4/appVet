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

// GET: admin=todos, vet=dueños de sus pacientes, owner=solo el propio
router.get('/', (req, res) => {
    const db = read();
    if (req.user.role === 'admin') return res.json(db.duenos.map(strip));
    if (req.user.role === 'vet') {
        const petIds   = db.citas.filter(c => c.veterinarioId === req.user.id).map(c => c.mascotaId);
        const duenoIds = [...new Set(db.mascotas.filter(m => petIds.includes(m.id)).map(m => m.duenoId))];
        return res.json(db.duenos.filter(d => duenoIds.includes(d.id)).map(strip));
    }
    const own = db.duenos.find(d => d.id === req.user.id);
    res.json(own ? [strip(own)] : []);
});

router.get('/:id', (req, res) => {
    if (req.user.role === 'owner' && req.user.id !== req.params.id)
        return res.status(403).json({ error: 'Sin permiso' });
    const item = read().duenos.find(d => d.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(strip(item));
});

router.post('/', adminOnly, (req, res) => {
    const db = read();
    if (db.duenos.find(d => d.email === req.body.email))
        return res.status(400).json({ error: 'Email ya registrado' });
    const tempPassword = generateTempPassword();
    const item = { ...req.body, id: uid(), password: tempPassword, mustChangePassword: true };
    db.duenos.push(item);
    write(db);
    res.status(201).json({ ...strip(item), tempPassword });
});

// Admin=cualquiera, owner=solo el propio, vet=sin permiso
router.put('/:id', (req, res) => {
    if (req.user.role === 'vet') return res.status(403).json({ error: 'Sin permiso' });
    if (req.user.role === 'owner' && req.user.id !== req.params.id)
        return res.status(403).json({ error: 'Sin permiso' });

    const db  = read();
    const idx = db.duenos.findIndex(d => d.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });

    const upd = { ...db.duenos[idx], ...req.body, id: req.params.id };
    if (!req.body.password) upd.password = db.duenos[idx].password;
    db.duenos[idx] = upd;
    write(db);
    res.json(strip(upd));
});

router.delete('/:id', adminOnly, (req, res) => {
    const db     = read();
    const idx    = db.duenos.findIndex(d => d.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });

    const petIds = db.mascotas.filter(m => m.duenoId === req.params.id).map(m => m.id);
    db.mascotas  = db.mascotas.filter(m => m.duenoId !== req.params.id);
    db.citas     = db.citas.filter(c => !petIds.includes(c.mascotaId));
    db.duenos.splice(idx, 1);
    write(db);
    res.json({ ok: true });
});

module.exports = router;
