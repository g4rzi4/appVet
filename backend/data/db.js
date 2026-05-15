const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'db.json');

const SEED = {
    veterinarios: [
        { id: 'v1', nombre: 'Carlos',  apellido: 'García',   especialidad: 'Cirugía General', telefono: '555-0101', email: 'carlos@vetcare.com',  horario: 'Lun-Vie 8:00-17:00',  password: 'Vetcare1' },
        { id: 'v2', nombre: 'María',   apellido: 'López',    especialidad: 'Dermatología',     telefono: '555-0102', email: 'maria@vetcare.com',   horario: 'Mar-Sáb 9:00-18:00',  password: 'Vetcare1' },
        { id: 'v3', nombre: 'Roberto', apellido: 'Martínez', especialidad: 'Medicina Interna', telefono: '555-0103', email: 'roberto@vetcare.com', horario: 'Lun-Vie 10:00-19:00', password: 'Vetcare1' },
    ],
    duenos: [
        { id: 'o1', nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', password: 'Dueno123', telefono: '555-9999', direccion: 'Av. Principal 123' },
    ],
    mascotas: [
        { id: 'm1', nombre: 'Max',  especie: 'Perro', raza: 'Labrador Retriever', color: 'Dorado', edad: 3, tamano: 'Grande',  duenoId: 'o1' },
        { id: 'm2', nombre: 'Luna', especie: 'Gato',  raza: 'Persa',              color: 'Blanco', edad: 2, tamano: 'Pequeño', duenoId: 'o1' },
    ],
    citas: [
        { id: 'c1', mascotaId: 'm1', veterinarioId: 'v1', fecha: '2026-05-20', hora: '10:00', motivo: 'Vacunación anual',      estado: 'pendiente',  notas: '' },
        { id: 'c2', mascotaId: 'm2', veterinarioId: 'v2', fecha: '2026-05-22', hora: '14:30', motivo: 'Control dermatológico', estado: 'confirmada', notas: '' },
    ],
};

function read() {
    if (!fs.existsSync(FILE)) {
        fs.writeFileSync(FILE, JSON.stringify(SEED, null, 2));
        return JSON.parse(JSON.stringify(SEED));
    }
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

    // Migración: añadir contraseña por defecto a vets que no la tienen
    let changed = false;
    data.veterinarios = data.veterinarios.map(v => {
        if (!v.password) { changed = true; return { ...v, password: 'Vetcare1' }; }
        return v;
    });
    if (changed) write(data);

    return data;
}

function write(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = { read, write, uid };
