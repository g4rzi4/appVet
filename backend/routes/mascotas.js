const express        = require('express');
const router         = express.Router();
const { read, write, uid }       = require('../data/db');
const { requireAuth, adminOnly } = require('../middleware/auth');

router.use(requireAuth);

// Admin: todas. Owner: solo las suyas
router.get('/', (req, res) => {
    const db = read();
    if (req.user.role === 'admin') return res.json(db.mascotas);
    res.json(db.mascotas.filter(m => m.duenoId === req.user.id));
});

router.get('/:id', (req, res) => {
    const db   = read();
    const item = db.mascotas.find(m => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && item.duenoId !== req.user.id)
        return res.status(403).json({ error: 'Sin permiso' });
    res.json(item);
});

router.post('/', (req, res) => {
    const db   = read();
    const item = { ...req.body, id: uid() };
    if (req.user.role !== 'admin') item.duenoId = req.user.id; // forzar duenoId propio
    db.mascotas.push(item);
    write(db);
    res.status(201).json(item);
});

router.put('/:id', (req, res) => {
    const db  = read();
    const idx = db.mascotas.findIndex(m => m.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && db.mascotas[idx].duenoId !== req.user.id)
        return res.status(403).json({ error: 'Sin permiso' });
    db.mascotas[idx] = { ...db.mascotas[idx], ...req.body, id: req.params.id };
    if (req.user.role !== 'admin') db.mascotas[idx].duenoId = req.user.id;
    write(db);
    res.json(db.mascotas[idx]);
});

router.delete('/:id', (req, res) => {
    const db  = read();
    const idx = db.mascotas.findIndex(m => m.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && db.mascotas[idx].duenoId !== req.user.id)
        return res.status(403).json({ error: 'Sin permiso' });
    db.citas = db.citas.filter(c => c.mascotaId !== req.params.id);
    db.mascotas.splice(idx, 1);
    write(db);
    res.json({ ok: true });
});

module.exports = router;
