const express        = require('express');
const router         = express.Router();
const { read, write, uid }       = require('../data/db');
const { requireAuth, adminOnly } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
    res.json(read().veterinarios);
});

router.get('/:id', (req, res) => {
    const item = read().veterinarios.find(v => v.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
});

router.post('/', adminOnly, (req, res) => {
    const db   = read();
    const item = { ...req.body, id: uid() };
    db.veterinarios.push(item);
    write(db);
    res.status(201).json(item);
});

router.put('/:id', adminOnly, (req, res) => {
    const db  = read();
    const idx = db.veterinarios.findIndex(v => v.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    db.veterinarios[idx] = { ...db.veterinarios[idx], ...req.body, id: req.params.id };
    write(db);
    res.json(db.veterinarios[idx]);
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
