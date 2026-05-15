const express              = require('express');
const router               = express.Router();
const { read, write, uid }        = require('../data/db');
const { requireAuth, adminOnly }  = require('../middleware/auth');

router.use(requireAuth);

function ownerPetIds(db, userId) {
    return db.mascotas.filter(m => m.duenoId === userId).map(m => m.id);
}

// GET: admin=todas, vet=las suyas, owner=las de sus mascotas
router.get('/', (req, res) => {
    const db = read();
    if (req.user.role === 'admin') return res.json(db.citas);
    if (req.user.role === 'vet')
        return res.json(db.citas.filter(c => c.veterinarioId === req.user.id));
    const ids = ownerPetIds(db, req.user.id);
    res.json(db.citas.filter(c => ids.includes(c.mascotaId)));
});

router.get('/:id', (req, res) => {
    const db   = read();
    const item = db.citas.find(c => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    if (req.user.role === 'vet' && item.veterinarioId !== req.user.id)
        return res.status(403).json({ error: 'Sin permiso' });
    if (req.user.role === 'owner' && !ownerPetIds(db, req.user.id).includes(item.mascotaId))
        return res.status(403).json({ error: 'Sin permiso' });

    res.json(item);
});

// POST: admin y owner (vet no agenda citas)
router.post('/', (req, res) => {
    if (req.user.role === 'vet')
        return res.status(403).json({ error: 'Los veterinarios no pueden agendar citas' });

    const db = read();
    if (req.user.role === 'owner') {
        const ids = ownerPetIds(db, req.user.id);
        if (!ids.includes(req.body.mascotaId))
            return res.status(403).json({ error: 'La mascota no te pertenece' });
    }
    const item = { ...req.body, id: uid() };
    db.citas.push(item);
    write(db);
    res.status(201).json(item);
});

// PUT: admin=todo, vet=solo estado de sus citas, owner=sus citas
router.put('/:id', (req, res) => {
    const db  = read();
    const idx = db.citas.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    const cita = db.citas[idx];

    if (req.user.role === 'vet') {
        if (cita.veterinarioId !== req.user.id)
            return res.status(403).json({ error: 'Sin permiso' });
        db.citas[idx] = {
            ...cita,
            estado: req.body.estado !== undefined ? req.body.estado : cita.estado,
            fecha:  req.body.fecha  !== undefined ? req.body.fecha  : cita.fecha,
            hora:   req.body.hora   !== undefined ? req.body.hora   : cita.hora,
            notas:  req.body.notas  !== undefined ? req.body.notas  : cita.notas,
        };
    } else if (req.user.role === 'owner') {
        if (!ownerPetIds(db, req.user.id).includes(cita.mascotaId))
            return res.status(403).json({ error: 'Sin permiso' });
        db.citas[idx] = { ...cita, ...req.body, id: req.params.id };
    } else {
        db.citas[idx] = { ...cita, ...req.body, id: req.params.id };
    }

    write(db);
    res.json(db.citas[idx]);
});

router.delete('/:id', (req, res) => {
    const db  = read();
    const idx = db.citas.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });

    if (req.user.role === 'vet')
        return res.status(403).json({ error: 'Sin permiso' });
    if (req.user.role === 'owner' && !ownerPetIds(db, req.user.id).includes(db.citas[idx].mascotaId))
        return res.status(403).json({ error: 'Sin permiso' });

    db.citas.splice(idx, 1);
    write(db);
    res.json({ ok: true });
});

module.exports = router;
