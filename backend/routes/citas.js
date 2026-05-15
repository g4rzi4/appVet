const express        = require('express');
const router         = express.Router();
const { read, write, uid }       = require('../data/db');
const { requireAuth, adminOnly } = require('../middleware/auth');

router.use(requireAuth);

function ownerPetIds(db, userId) {
    return db.mascotas.filter(m => m.duenoId === userId).map(m => m.id);
}

// Admin: todas. Owner: solo las de sus mascotas
router.get('/', (req, res) => {
    const db = read();
    if (req.user.role === 'admin') return res.json(db.citas);
    const ids = ownerPetIds(db, req.user.id);
    res.json(db.citas.filter(c => ids.includes(c.mascotaId)));
});

router.get('/:id', (req, res) => {
    const db   = read();
    const item = db.citas.find(c => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && !ownerPetIds(db, req.user.id).includes(item.mascotaId))
        return res.status(403).json({ error: 'Sin permiso' });
    res.json(item);
});

router.post('/', (req, res) => {
    const db = read();
    if (req.user.role !== 'admin') {
        const ids = ownerPetIds(db, req.user.id);
        if (!ids.includes(req.body.mascotaId))
            return res.status(403).json({ error: 'La mascota no te pertenece' });
    }
    const item = { ...req.body, id: uid() };
    db.citas.push(item);
    write(db);
    res.status(201).json(item);
});

router.put('/:id', (req, res) => {
    const db  = read();
    const idx = db.citas.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && !ownerPetIds(db, req.user.id).includes(db.citas[idx].mascotaId))
        return res.status(403).json({ error: 'Sin permiso' });
    db.citas[idx] = { ...db.citas[idx], ...req.body, id: req.params.id };
    write(db);
    res.json(db.citas[idx]);
});

router.delete('/:id', (req, res) => {
    const db  = read();
    const idx = db.citas.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && !ownerPetIds(db, req.user.id).includes(db.citas[idx].mascotaId))
        return res.status(403).json({ error: 'Sin permiso' });
    db.citas.splice(idx, 1);
    write(db);
    res.json({ ok: true });
});

module.exports = router;
