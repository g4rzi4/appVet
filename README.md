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

> Para desarrollo con recarga automática usar `npm run dev` (requiere nodemon, ya incluido en devDependencies).

---

## Estructura del proyecto

```
appVet/
├── frontend/               # Interfaz de usuario (HTML + CSS + JS)
│   ├── index.html
│   ├── style.css
│   └── app.js              # Lógica UI con fetch() y async/await
└── backend/                # API REST (Node.js + Express)
    ├── server.js           # Punto de entrada, sirve el frontend y la API
    ├── package.json
    ├── data/
    │   ├── db.js           # Lectura/escritura del archivo de datos
    │   └── db.json         # Base de datos (se crea automáticamente al iniciar)
    ├── middleware/
    │   └── auth.js         # Autenticación JWT
    └── routes/
        ├── auth.js         # POST /api/auth/login  |  /api/auth/register
        ├── veterinarios.js # CRUD /api/veterinarios
        ├── duenos.js       # CRUD /api/duenos
        ├── mascotas.js     # CRUD /api/mascotas
        └── citas.js        # CRUD /api/citas
```

---

## Accesos de prueba

| Rol           | Email                  | Contraseña |
|---------------|------------------------|------------|
| Administrador | admin@vetcare.com      | admin123   |
| Dueño demo    | ana@example.com        | 123456     |

> Los dueños pueden registrarse desde la pantalla de login.

---

## API REST

Todas las rutas requieren un token JWT en el header `Authorization: Bearer <token>`.

| Método | Ruta                      | Acceso        |
|--------|---------------------------|---------------|
| POST   | /api/auth/login           | Público       |
| POST   | /api/auth/register        | Público       |
| GET    | /api/veterinarios         | Todos         |
| POST   | /api/veterinarios         | Admin         |
| PUT    | /api/veterinarios/:id     | Admin         |
| DELETE | /api/veterinarios/:id     | Admin         |
| GET    | /api/duenos               | Admin / propio|
| POST   | /api/duenos               | Admin         |
| PUT    | /api/duenos/:id           | Admin / propio|
| DELETE | /api/duenos/:id           | Admin         |
| GET    | /api/mascotas             | Admin / propias|
| POST   | /api/mascotas             | Todos         |
| PUT    | /api/mascotas/:id         | Admin / propio|
| DELETE | /api/mascotas/:id         | Admin / propio|
| GET    | /api/citas                | Admin / propias|
| POST   | /api/citas                | Todos         |
| PUT    | /api/citas/:id            | Admin / propio|
| DELETE | /api/citas/:id            | Admin / propio|

---

## Modelo de datos — Mascota

```json
{
  "id":      "abc123",
  "nombre":  "Max",
  "especie": "Perro",
  "raza":    "Labrador Retriever",
  "color":   "Dorado",
  "edad":    3,
  "tamano":  "Grande",
  "duenoId": "o1"
}
```

---

## Funcionalidades

### Vista Administrador
- **Dashboard** — estadísticas en tiempo real (veterinarios, dueños, mascotas, citas pendientes)
- **Veterinarios** — CRUD completo (nombre, especialidad, teléfono, email, horario)
- **Dueños** — CRUD completo, muestra cantidad de mascotas por dueño
- **Mascotas** — CRUD completo con referencia al dueño
- **Citas** — CRUD completo con estados: `pendiente | confirmada | completada | cancelada`

### Vista Dueño
- **Mis Mascotas** — tarjetas visuales, CRUD solo sobre las propias
- **Mis Citas** — vista cronológica, agendar y cancelar citas
- **Mi Perfil** — editar datos personales
