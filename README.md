# appVet
Aplicacion de gestion de hospital veterinario

**Accesos

Administrador	admin@vetcare.com	password: admin123
Dueño demo	ana@example.com	
password: 123456

**Mascotas
El objeto mascota sigue exactamente la especificación:


{
  "id": "abc123",
  "nombre": "Max",
  "especie": "Perro",
  "raza": "Labrador Retriever",
  "color": "Dorado",
  "edad": 3,
  "tamano": "Grande",
  "duenoId": "o1"
}

**Vista Administrador
Dashboard — estadísticas en tiempo real (vets, dueños, mascotas, citas pendientes)
Veterinarios — CRUD completo (nombre, especialidad, teléfono, email, horario)
Dueños — CRUD completo + ve cuántas mascotas tiene cada uno
Mascotas — CRUD completo con referencia al dueño
Citas — CRUD completo con estado (pendiente / confirmada / completada / cancelada)

**Vista Dueño
Mis Mascotas — tarjetas visuales con CRUD propio (solo ve las suyas)
Mis Citas — vista cronológica, puede agendar y cancelar citas
Mi Perfil — editar sus datos personales
