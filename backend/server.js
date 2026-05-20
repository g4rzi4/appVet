const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Sirve el frontend como archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas de la API
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/veterinarios', require('./routes/veterinarios'));
app.use('/api/duenos',       require('./routes/duenos'));
app.use('/api/mascotas',     require('./routes/mascotas'));
app.use('/api/citas',        require('./routes/citas'));
app.use('/api/solicitudes',  require('./routes/solicitudes'));

// SPA fallback
app.get('*', (_, res) =>
    res.sendFile(path.join(__dirname, '../frontend/index.html'))
);

app.listen(PORT, () => {
    console.log(`\n  VetCare API  →  http://localhost:${PORT}\n`);
});
