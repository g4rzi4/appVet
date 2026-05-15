# VetCare — Gestión de Hospital Veterinario

Aplicación web full-stack para administrar veterinarios, dueños, mascotas y citas médicas.

---

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- npm (viene incluido con Node.js)

---

## Instalación y ejecución

```bash
# 1. Entrar a la carpeta del backend
cd backend

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor
npm start
```

Abrir en el navegador: **http://localhost:3001**

> Para desarrollo con recarga automática usar `npm run dev` (nodemon ya incluido en devDependencies).

> Si ya existía un `db.json` de una versión anterior, elimínalo antes de iniciar para que se apliquen los datos de semilla actualizados.

---

## Estructura del proyecto

```
appVet/
├── frontend/               # Interfaz de usuario (HTML + CSS + JS)
│   ├── index.html
│   ├── style.css
│   └── app.js              # Lógica UI — fetch() y async/await
└── backend/                # API REST (Node.js + Express)
    ├── server.js           # Punto de entrada, sirve el frontend y la API
    ├── package.json
    ├── data/
    │   ├── db.js           # Lectura/escritura + migración automática
    │   └── db.json         # Base de datos JSON (se crea al iniciar)
    ├── middleware/
    │   └── auth.js         # Verificación JWT + helpers adminOnly
    └── routes/
        ├── auth.js         # POST /api/auth/login | /api/auth/register
        ├── veterinarios.js # CRUD /api/veterinarios
        ├── duenos.js       # CRUD /api/duenos
        ├── mascotas.js     # CRUD /api/mascotas
        └── citas.js        # CRUD /api/citas
```

---

## Accesos de prueba

| Rol           | Email                  | Contraseña | Registro       |
|---------------|------------------------|------------|----------------|
| Administrador | admin@vetcare.com      | admin123   | Hardcoded      |
| Veterinario   | carlos@vetcare.com     | vet123     | Solo via admin |
| Veterinario   | maria@vetcare.com      | vet123     | Solo via admin |
| Veterinario   | roberto@vetcare.com    | vet123     | Solo via admin |
| Dueño demo    | ana@example.com        | 123456     | Auto-registro  |

> Los veterinarios **solo pueden ser registrados por el administrador**. Sus emails deben terminar en `@vetcare.com`.  
> Los dueños pueden registrarse libremente desde la pantalla de login (no se permiten emails `@vetcare.com`).

---

## Roles y permisos

### Administrador
- CRUD completo sobre todas las entidades
- Crea veterinarios asignándoles email `@vetcare.com` y contraseña
- Puede cambiar el estado de cualquier cita

### Veterinario
- Accede con su email `@vetcare.com` y la contraseña asignada por el admin
- Ve su **calendario mensual** con las citas pendientes y confirmadas
- Puede **confirmar** (pendiente → confirmada) y **completar** (confirmada → completada) sus citas
- Ve los **expedientes** de sus pacientes: datos del animal, dueño e historial de citas

### Dueño
- Se registra libremente desde el login
- Gestiona sus propias mascotas (CRUD)
- Agenda y cancela citas para sus mascotas
- Edita su perfil personal

---

## API REST

Todas las rutas (excepto `/api/auth/*`) requieren `Authorization: Bearer <token>`.

| Método | Ruta                  | Admin | Vet              | Dueño          |
|--------|-----------------------|-------|------------------|----------------|
| POST   | /api/auth/login       | ✓     | ✓                | ✓              |
| POST   | /api/auth/register    | ✓     | ✓                | ✓              |
| GET    | /api/veterinarios     | todos | todos            | todos          |
| POST   | /api/veterinarios     | ✓     | ✗                | ✗              |
| PUT    | /api/veterinarios/:id | ✓     | ✗                | ✗              |
| DELETE | /api/veterinarios/:id | ✓     | ✗                | ✗              |
| GET    | /api/duenos           | todos | sus pacientes    | propio         |
| POST   | /api/duenos           | ✓     | ✗                | ✗              |
| PUT    | /api/duenos/:id       | ✓     | ✗                | propio         |
| DELETE | /api/duenos/:id       | ✓     | ✗                | ✗              |
| GET    | /api/mascotas         | todas | sus pacientes    | propias        |
| POST   | /api/mascotas         | ✓     | ✗                | ✓ (propias)    |
| PUT    | /api/mascotas/:id     | ✓     | ✗                | ✓ (propias)    |
| DELETE | /api/mascotas/:id     | ✓     | ✗                | ✓ (propias)    |
| GET    | /api/citas            | todas | las suyas        | sus mascotas   |
| POST   | /api/citas            | ✓     | ✗                | ✓ (sus mascotas)|
| PUT    | /api/citas/:id        | ✓     | solo `estado`    | ✓ (sus mascotas)|
| DELETE | /api/citas/:id        | ✓     | ✗                | ✓ (sus mascotas)|

---

## Modelos de datos

### Mascota
```json
{
  "id":       "m1",
  "nombre":   "Max",
  "especie":  "Perro",
  "raza":     "Labrador Retriever",
  "color":    "Dorado",
  "edad":     3,
  "tamano":   "Grande",
  "duenoId":  "o1"
}
```

### Veterinario
```json
{
  "id":           "v1",
  "nombre":       "Carlos",
  "apellido":     "García",
  "especialidad": "Cirugía General",
  "telefono":     "555-0101",
  "email":        "carlos@vetcare.com",
  "horario":      "Lun-Vie 8:00-17:00",
  "password":     "vet123"
}
```

### Cita
```json
{
  "id":             "c1",
  "mascotaId":      "m1",
  "veterinarioId":  "v1",
  "fecha":          "2026-05-20",
  "hora":           "10:00",
  "motivo":         "Vacunación anual",
  "estado":         "pendiente",
  "notas":          ""
}
```

Estados de cita: `pendiente` → `confirmada` → `completada` | `cancelada`

---

## Funcionalidades por vista

### Vista Administrador
- **Dashboard** — estadísticas en tiempo real: veterinarios, dueños, mascotas, citas pendientes
- **Veterinarios** — CRUD completo; email obligatorio `@vetcare.com`; contraseña de acceso asignada por el admin
- **Dueños** — CRUD completo; muestra cantidad de mascotas por dueño
- **Mascotas** — CRUD completo con referencia al dueño
- **Citas** — CRUD completo; selector de estado completo

### Vista Veterinario
- **Calendario** — cuadrícula mensual con navegación; puntos de color por estado (🟠 pendiente, 🔵 confirmada); detalle del día al hacer clic; botones Confirmar y Completar inline; panel de próximas citas
- **Mis Pacientes** — expedientes de cada mascota atendida: datos del animal, dueño, teléfono e historial de citas

### Vista Dueño
- **Mis Mascotas** — tarjetas visuales; CRUD solo sobre las propias
- **Mis Citas** — vista cronológica; agendar nuevas citas (estado fijo: pendiente); cancelar citas pendientes
- **Mi Perfil** — editar nombre, teléfono, dirección y contraseña
