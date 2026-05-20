const express             = require('express');
const router              = express.Router();
const { read, write, uid } = require('../data/db');
const { requireAuth, adminOnly } = require('../middleware/auth');

router.use(requireAuth);

// GET: admin=todas, vet=las suyas, owner=las suyas
router.get('/', (req, res) => {
    const db = read();
    if (req.user.role === 'admin') return res.json(db.solicitudes);
    res.json(db.solicitudes.filter(s => s.solicitanteId === req.user.id));
});

// POST: vet u owner crean una solicitud de reprogramación
router.post('/', (req, res) => {
    if (req.user.role === 'admin')
        return res.status(403).json({ error: 'El admin gestiona solicitudes, no las crea' });

    const { citaId, fechaSolicitada, horaSolicitada, motivo } = req.body;
    if (!citaId || !fechaSolicitada || !horaSolicitada)
        return res.status(400).json({ error: 'citaId, fechaSolicitada y horaSolicitada son requeridos' });

    const db   = read();
    const cita = db.citas.find(c => c.id === citaId);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    // Verificar pertenencia
    if (req.user.role === 'vet' && cita.veterinarioId !== req.user.id)
        return res.status(403).json({ error: 'Sin permiso sobre esta cita' });
    if (req.user.role === 'owner') {
        const petIds = db.mascotas.filter(m => m.duenoId === req.user.id).map(m => m.id);
        if (!petIds.includes(cita.mascotaId))
            return res.status(403).json({ error: 'Sin permiso sobre esta cita' });
    }

    // No crear solicitud duplicada pendiente para la misma cita
    const yaExiste = db.solicitudes.some(
        s => s.citaId === citaId && s.estado === 'pendiente'
    );
    if (yaExiste)
        return res.status(409).json({ error: 'Ya existe una solicitud pendiente para esta cita' });

    const nueva = {
        id: uid(),
        citaId,
        solicitanteId:   req.user.id,
        solicitanteRole: req.user.role,
        fechaSolicitada,
        horaSolicitada,
        motivo:          motivo || '',
        estado:          'pendiente',
        creadaEn:        new Date().toISOString(),
    };
    db.solicitudes.push(nueva);
    write(db);
    res.status(201).json(nueva);
});

// PUT /:id — solo admin aprueba o rechaza
router.put('/:id', adminOnly, (req, res) => {
    const db  = read();
    const idx = db.solicitudes.findIndex(s => s.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const sol = db.solicitudes[idx];
    if (sol.estado !== 'pendiente')
        return res.status(400).json({ error: 'La solicitud ya fue procesada' });

    const { accion } = req.body; // 'aprobar' | 'rechazar'
    if (accion !== 'aprobar' && accion !== 'rechazar')
        return res.status(400).json({ error: 'accion debe ser "aprobar" o "rechazar"' });

    if (accion === 'aprobar') {
        const citaIdx = db.citas.findIndex(c => c.id === sol.citaId);
        if (citaIdx < 0)
            return res.status(404).json({ error: 'Cita asociada no encontrada' });
        db.citas[citaIdx] = {
            ...db.citas[citaIdx],
            fecha: sol.fechaSolicitada,
            hora:  sol.horaSolicitada,
        };
    }

    db.solicitudes[idx] = { ...sol, estado: accion === 'aprobar' ? 'aprobada' : 'rechazada' };
    write(db);
    res.json(db.solicitudes[idx]);
});

// DELETE /:id — el solicitante puede cancelar su solicitud pendiente
router.delete('/:id', (req, res) => {
    const db  = read();
    const idx = db.solicitudes.findIndex(s => s.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const sol = db.solicitudes[idx];
    if (req.user.role !== 'admin' && sol.solicitanteId !== req.user.id)
        return res.status(403).json({ error: 'Sin permiso' });
    if (sol.estado !== 'pendiente')
        return res.status(400).json({ error: 'Solo se pueden cancelar solicitudes pendientes' });
    db.solicitudes.splice(idx, 1);
    write(db);
    res.json({ ok: true });
});

module.exports = router;
