const express              = require('express');
const router               = express.Router();
const { read, write, uid }        = require('../data/db');
const { requireAuth, adminOnly }  = require('../middleware/auth');

router.use(requireAuth);

function ownerPetIds(db, userId) {
    return db.mascotas.filter(m => m.duenoId === userId).map(m => m.id);
}

const _DIAS = { Lun:1, Mar:2, 'Mié':3, Jue:4, Vie:5, 'Sáb':6, Dom:0 };

function parseHorario(s) {
    if (!s) return null;
    const m = s.match(/([^\s-]+)-([^\s-]+)\s+(\d+):(\d+)-(\d+):(\d+)/);
    if (!m) return null;
    const sd = _DIAS[m[1]], ed = _DIAS[m[2]];
    if (sd == null || ed == null) return null;
    return { sd, ed, sh:+m[3], sm:+m[4], eh:+m[5], em:+m[6] };
}

function hasVetConflict(db, veterinarioId, fecha, hora, excludeId) {
    return db.citas.some(c =>
        c.id !== excludeId &&
        c.veterinarioId === veterinarioId &&
        c.fecha === fecha &&
        c.hora  === hora  &&
        c.estado !== 'cancelada' &&
        c.estado !== 'completada'
    );
}

function hasPetConflict(db, mascotaId, fecha, hora, excludeId) {
    return db.citas.some(c =>
        c.id !== excludeId &&
        c.mascotaId === mascotaId &&
        c.fecha === fecha &&
        c.hora  === hora  &&
        c.estado !== 'cancelada' &&
        c.estado !== 'completada'
    );
}

function validateAppt(horario, fecha, hora) {
    const h = parseHorario(horario);
    if (!h) return null; // horario no parseable, no se bloquea
    const dow = new Date(fecha + 'T00:00:00').getDay();
    const days = [];
    if (h.sd <= h.ed) { for (let d = h.sd; d <= h.ed; d++) days.push(d); }
    else { for (let d = h.sd; d <= 6; d++) days.push(d); for (let d = 0; d <= h.ed; d++) days.push(d); }
    if (!days.includes(dow))
        return 'El veterinario no atiende ese día de la semana';
    const [hh, mm] = hora.split(':').map(Number);
    const apptMin = hh * 60 + mm, startMin = h.sh * 60 + h.sm, endMin = h.eh * 60 + h.em;
    if (apptMin < startMin || apptMin > endMin)
        return 'La hora está fuera del horario de atención del veterinario';
    return null;
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

    const vet = db.veterinarios.find(v => v.id === req.body.veterinarioId);
    if (vet) {
        const err = validateAppt(vet.horario, req.body.fecha, req.body.hora);
        if (err) return res.status(400).json({ error: err });
    }

    if (hasVetConflict(db, req.body.veterinarioId, req.body.fecha, req.body.hora, null))
        return res.status(409).json({ error: 'El veterinario ya tiene una cita en ese horario' });

    if (hasPetConflict(db, req.body.mascotaId, req.body.fecha, req.body.hora, null))
        return res.status(409).json({ error: 'La mascota ya tiene una cita en ese horario' });

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
        const updFecha = req.body.fecha !== undefined ? req.body.fecha : cita.fecha;
        const updHora  = req.body.hora  !== undefined ? req.body.hora  : cita.hora;
        const vet = db.veterinarios.find(v => v.id === cita.veterinarioId);
        if (vet && (req.body.fecha !== undefined || req.body.hora !== undefined)) {
            const err = validateAppt(vet.horario, updFecha, updHora);
            if (err) return res.status(400).json({ error: err });
        }
        if (req.body.fecha !== undefined || req.body.hora !== undefined) {
            if (hasVetConflict(db, cita.veterinarioId, updFecha, updHora, req.params.id))
                return res.status(409).json({ error: 'El veterinario ya tiene una cita en ese horario' });
            if (hasPetConflict(db, cita.mascotaId, updFecha, updHora, req.params.id))
                return res.status(409).json({ error: 'La mascota ya tiene una cita en ese horario' });
        }
        db.citas[idx] = {
            ...cita,
            estado: req.body.estado !== undefined ? req.body.estado : cita.estado,
            fecha:  updFecha,
            hora:   updHora,
            notas:  req.body.notas  !== undefined ? req.body.notas  : cita.notas,
        };
    } else if (req.user.role === 'owner') {
        if (!ownerPetIds(db, req.user.id).includes(cita.mascotaId))
            return res.status(403).json({ error: 'Sin permiso' });
        const updVetId   = req.body.veterinarioId || cita.veterinarioId;
        const updPetId   = req.body.mascotaId     || cita.mascotaId;
        const updFecha = req.body.fecha || cita.fecha;
        const updHora  = req.body.hora  || cita.hora;
        const vet = db.veterinarios.find(v => v.id === updVetId);
        if (vet) {
            const err = validateAppt(vet.horario, updFecha, updHora);
            if (err) return res.status(400).json({ error: err });
        }
        if (hasVetConflict(db, updVetId, updFecha, updHora, req.params.id))
            return res.status(409).json({ error: 'El veterinario ya tiene una cita en ese horario' });
        if (hasPetConflict(db, updPetId, updFecha, updHora, req.params.id))
            return res.status(409).json({ error: 'La mascota ya tiene una cita en ese horario' });
        db.citas[idx] = { ...cita, ...req.body, id: req.params.id };
    } else {
        const updVetId   = req.body.veterinarioId || cita.veterinarioId;
        const updPetId   = req.body.mascotaId     || cita.mascotaId;
        const updFecha = req.body.fecha || cita.fecha;
        const updHora  = req.body.hora  || cita.hora;
        const vet = db.veterinarios.find(v => v.id === updVetId);
        if (vet) {
            const err = validateAppt(vet.horario, updFecha, updHora);
            if (err) return res.status(400).json({ error: err });
        }
        if (hasVetConflict(db, updVetId, updFecha, updHora, req.params.id))
            return res.status(409).json({ error: 'El veterinario ya tiene una cita en ese horario' });
        if (hasPetConflict(db, updPetId, updFecha, updHora, req.params.id))
            return res.status(409).json({ error: 'La mascota ya tiene una cita en ese horario' });
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
