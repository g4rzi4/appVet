/* =============================================
   DATABASE (localStorage)
   ============================================= */
const DB = {
    get:    (key)       => JSON.parse(localStorage.getItem(key) || '[]'),
    set:    (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    getOne: (key, id)   => DB.get(key).find(item => item.id === id) || null,
};

/* =============================================
   ESTADO GLOBAL
   ============================================= */
let state = { user: null, role: null, view: null };

/* =============================================
   UTILIDADES
   ============================================= */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(s) {
    if (!s) return '-';
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dayOf(s)   { return s ? new Date(s + 'T00:00:00').getDate() : ''; }
function monthOf(s) { return s ? new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short' }) : ''; }

function h(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function timeSlots() {
    const slots = [];
    for (let hr = 8; hr <= 18; hr++) {
        slots.push(String(hr).padStart(2,'0') + ':00');
        if (hr < 18) slots.push(String(hr).padStart(2,'0') + ':30');
    }
    return slots;
}

function petEmoji(especie) {
    const m = { Perro:'🐕', Gato:'🐈', Conejo:'🐇', Ave:'🦜', Reptil:'🦎', Pez:'🐠', Hámster:'🐹' };
    return m[especie] || '🐾';
}

function estadoBadge(estado) {
    const m = {
        pendiente:  '<span class="badge badge-orange">Pendiente</span>',
        confirmada: '<span class="badge badge-blue">Confirmada</span>',
        completada: '<span class="badge badge-green">Completada</span>',
        cancelada:  '<span class="badge badge-red">Cancelada</span>',
    };
    return m[estado] || `<span class="badge badge-gray">${h(estado)}</span>`;
}

const ESPECIALIDADES = [
    'Medicina General', 'Cirugía General', 'Medicina Interna',
    'Dermatología', 'Cardiología', 'Oftalmología',
    'Odontología', 'Traumatología', 'Oncología', 'Neurología',
];

const TAMANOS = ['Muy Pequeño', 'Pequeño', 'Mediano', 'Grande', 'Extra Grande'];
const ESPECIES = ['Perro', 'Gato', 'Conejo', 'Ave', 'Reptil', 'Pez', 'Hámster'];
const ESTADOS  = ['pendiente', 'confirmada', 'completada', 'cancelada'];

/* =============================================
   INICIALIZACIÓN Y DATOS SEMILLA
   ============================================= */
function init() {
    if (!localStorage.getItem('vc_init')) {
        DB.set('veterinarios', [
            { id: 'v1', nombre: 'Carlos',  apellido: 'García',   especialidad: 'Cirugía General',  telefono: '555-0101', email: 'carlos@vetcare.com',  horario: 'Lun-Vie 8:00-17:00'  },
            { id: 'v2', nombre: 'María',   apellido: 'López',    especialidad: 'Dermatología',      telefono: '555-0102', email: 'maria@vetcare.com',   horario: 'Mar-Sáb 9:00-18:00'  },
            { id: 'v3', nombre: 'Roberto', apellido: 'Martínez', especialidad: 'Medicina Interna',  telefono: '555-0103', email: 'roberto@vetcare.com', horario: 'Lun-Vie 10:00-19:00' },
        ]);

        DB.set('duenos', [{
            id: 'o1', nombre: 'Ana', apellido: 'Pérez',
            email: 'ana@example.com', password: '123456',
            telefono: '555-9999', direccion: 'Av. Principal 123',
        }]);

        DB.set('mascotas', [
            { id: 'm1', nombre: 'Max',  especie: 'Perro', raza: 'Labrador Retriever', color: 'Dorado',  edad: 3, tamano: 'Grande',   duenoId: 'o1' },
            { id: 'm2', nombre: 'Luna', especie: 'Gato',  raza: 'Persa',              color: 'Blanco',  edad: 2, tamano: 'Pequeño',  duenoId: 'o1' },
        ]);

        DB.set('citas', [
            { id: 'c1', mascotaId: 'm1', veterinarioId: 'v1', fecha: '2026-05-20', hora: '10:00', motivo: 'Vacunación anual',      estado: 'pendiente',  notas: '' },
            { id: 'c2', mascotaId: 'm2', veterinarioId: 'v2', fecha: '2026-05-22', hora: '14:30', motivo: 'Control dermatológico', estado: 'confirmada', notas: '' },
        ]);

        localStorage.setItem('vc_init', '1');
    }

    const sess = JSON.parse(localStorage.getItem('vc_session') || 'null');
    if (sess) {
        state.user = sess.user;
        state.role = sess.role;
        bootApp();
    } else {
        showAuth();
    }
}

/* =============================================
   AUTENTICACIÓN
   ============================================= */
const Auth = {
    login(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pwd   = document.getElementById('login-password').value;

        if (email === 'admin@vetcare.com' && pwd === 'admin123') {
            state.user = { id: 'admin', nombre: 'Admin', apellido: 'VetCare', email };
            state.role = 'admin';
            saveSession();
            bootApp();
            return;
        }

        const owner = DB.get('duenos').find(d => d.email === email && d.password === pwd);
        if (owner) {
            state.user = owner;
            state.role = 'owner';
            saveSession();
            bootApp();
            return;
        }

        Toast.show('Email o contraseña incorrectos', 'error');
    },

    register(e) {
        e.preventDefault();
        const email  = document.getElementById('reg-email').value.trim();
        const duenos = DB.get('duenos');

        if (email === 'admin@vetcare.com') { Toast.show('Email no disponible', 'error'); return; }
        if (duenos.find(d => d.email === email)) { Toast.show('Ya existe una cuenta con ese email', 'error'); return; }

        const nuevo = {
            id:        uid(),
            nombre:    document.getElementById('reg-nombre').value.trim(),
            apellido:  document.getElementById('reg-apellido').value.trim(),
            email,
            password:  document.getElementById('reg-password').value,
            telefono:  document.getElementById('reg-telefono').value.trim(),
            direccion: document.getElementById('reg-direccion').value.trim(),
        };
        duenos.push(nuevo);
        DB.set('duenos', duenos);

        state.user = nuevo;
        state.role = 'owner';
        saveSession();
        bootApp();
        Toast.show('¡Cuenta creada exitosamente!', 'success');
    },

    logout() {
        state.user = null;
        state.role = null;
        localStorage.removeItem('vc_session');
        showAuth();
    },
};

function saveSession() {
    localStorage.setItem('vc_session', JSON.stringify({ user: state.user, role: state.role }));
}

/* =============================================
   PANTALLAS PRINCIPALES
   ============================================= */
function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display   = 'none';
    showPanel('login-panel');
}

function showPanel(id) {
    document.getElementById('login-panel').style.display    = id === 'login-panel'    ? 'block' : 'none';
    document.getElementById('register-panel').style.display = id === 'register-panel' ? 'block' : 'none';
}

function bootApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').style.display   = 'flex';
    renderSidebar();
    renderUserInfo();
    navigate(state.role === 'admin' ? 'dashboard' : 'misMascotas');
}

/* =============================================
   SIDEBAR Y NAVEGACIÓN
   ============================================= */
function renderSidebar() {
    const adminItems = [
        { id: 'dashboard',    icon: '📊', label: 'Dashboard'    },
        { id: 'veterinarios', icon: '👨‍⚕️', label: 'Veterinarios' },
        { id: 'duenos',       icon: '👥', label: 'Dueños'        },
        { id: 'mascotas',     icon: '🐾', label: 'Mascotas'      },
        { id: 'citas',        icon: '📅', label: 'Citas'         },
    ];
    const ownerItems = [
        { id: 'misMascotas', icon: '🐾', label: 'Mis Mascotas' },
        { id: 'misCitas',    icon: '📅', label: 'Mis Citas'    },
        { id: 'perfil',      icon: '👤', label: 'Mi Perfil'    },
    ];

    const items = state.role === 'admin' ? adminItems : ownerItems;
    document.getElementById('sidebar-nav').innerHTML = items.map(item => `
        <button class="nav-item" id="nav-${item.id}" onclick="navigate('${item.id}')">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
        </button>
    `).join('');
}

function renderUserInfo() {
    const full = `${state.user.nombre} ${state.user.apellido}`;
    document.getElementById('user-name').textContent        = full;
    document.getElementById('user-role-label').textContent  = state.role === 'admin' ? 'Administrador' : 'Dueño';
    document.getElementById('user-avatar').textContent      = full.charAt(0).toUpperCase();
}

const PAGE_TITLES = {
    dashboard: 'Dashboard', veterinarios: 'Veterinarios', duenos: 'Dueños',
    mascotas: 'Mascotas', citas: 'Citas',
    misMascotas: 'Mis Mascotas', misCitas: 'Mis Citas', perfil: 'Mi Perfil',
};

function navigate(view) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`nav-${view}`);
    if (btn) btn.classList.add('active');

    state.view = view;
    document.getElementById('page-title').textContent = PAGE_TITLES[view] || view;

    const map = {
        dashboard:    Views.dashboard,
        veterinarios: Views.veterinarios,
        duenos:       Views.duenos,
        mascotas:     Views.mascotas,
        citas:        Views.citas,
        misMascotas:  Views.misMascotas,
        misCitas:     Views.misCitas,
        perfil:       Views.perfil,
    };
    if (map[view]) map[view]();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

/* =============================================
   VISTAS
   ============================================= */
const Views = {

    dashboard() {
        const vets    = DB.get('veterinarios');
        const duenos  = DB.get('duenos');
        const pets    = DB.get('mascotas');
        const citas   = DB.get('citas');
        const pend    = citas.filter(c => c.estado === 'pendiente');

        vc(`
            <div class="stats-grid">
                <div class="stat-card blue">
                    <div class="stat-icon">👨‍⚕️</div>
                    <div><div class="stat-value">${vets.length}</div><div class="stat-label">Veterinarios</div></div>
                </div>
                <div class="stat-card green">
                    <div class="stat-icon">👥</div>
                    <div><div class="stat-value">${duenos.length}</div><div class="stat-label">Dueños</div></div>
                </div>
                <div class="stat-card purple">
                    <div class="stat-icon">🐾</div>
                    <div><div class="stat-value">${pets.length}</div><div class="stat-label">Mascotas</div></div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-icon">📅</div>
                    <div><div class="stat-value">${pend.length}</div><div class="stat-label">Citas Pendientes</div></div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Próximas Citas</div>
                    <button class="btn btn-primary btn-sm" onclick="navigate('citas')">Ver todas</button>
                </div>
                ${citasTable(pend.slice(0, 6))}
            </div>
        `);
    },

    veterinarios() {
        const data = DB.get('veterinarios');
        entityView('veterinarios', 'Veterinarios', '+ Agregar Veterinario', 'Vets.openAdd()',
            ['Nombre', 'Especialidad', 'Teléfono', 'Email', 'Horario', 'Acciones'],
            data.map(v => `
                <tr data-search="${h(searchOf(v))}">
                    <td><strong>${h(v.nombre)} ${h(v.apellido)}</strong></td>
                    <td><span class="badge badge-blue">${h(v.especialidad)}</span></td>
                    <td>${h(v.telefono||'-')}</td>
                    <td>${h(v.email)}</td>
                    <td>${h(v.horario||'-')}</td>
                    <td><div class="action-btns">
                        <button class="btn btn-ghost btn-sm" onclick="Vets.openEdit('${v.id}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="Vets.del('${v.id}')">Eliminar</button>
                    </div></td>
                </tr>
            `).join('')
        );
    },

    duenos() {
        const data = DB.get('duenos');
        entityView('duenos', 'Dueños', '+ Agregar Dueño', 'Duenos.openAdd()',
            ['Nombre', 'Email', 'Teléfono', 'Dirección', 'Mascotas', 'Acciones'],
            data.map(d => {
                const cnt = DB.get('mascotas').filter(m => m.duenoId === d.id).length;
                return `
                    <tr data-search="${h(searchOf(d))}">
                        <td><strong>${h(d.nombre)} ${h(d.apellido)}</strong></td>
                        <td>${h(d.email)}</td>
                        <td>${h(d.telefono||'-')}</td>
                        <td>${h(d.direccion||'-')}</td>
                        <td><span class="badge badge-purple">${cnt} mascota${cnt!==1?'s':''}</span></td>
                        <td><div class="action-btns">
                            <button class="btn btn-ghost btn-sm" onclick="Duenos.openEdit('${d.id}')">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="Duenos.del('${d.id}')">Eliminar</button>
                        </div></td>
                    </tr>
                `;
            }).join('')
        );
    },

    mascotas() {
        const data = DB.get('mascotas');
        entityView('mascotas', 'Mascotas', '+ Agregar Mascota', 'Pets.openAdd()',
            ['Nombre', 'Especie', 'Raza', 'Color', 'Edad', 'Tamaño', 'Dueño', 'Acciones'],
            data.map(m => {
                const dueno = DB.getOne('duenos', m.duenoId);
                const dname = dueno ? `${dueno.nombre} ${dueno.apellido}` : 'Sin dueño';
                return `
                    <tr data-search="${h(searchOf(m) + ' ' + dname)}">
                        <td><strong>${h(m.nombre)}</strong></td>
                        <td>${petEmoji(m.especie)} ${h(m.especie)}</td>
                        <td>${h(m.raza||'-')}</td>
                        <td>${h(m.color||'-')}</td>
                        <td>${m.edad} año${m.edad!=1?'s':''}</td>
                        <td>${h(m.tamano||'-')}</td>
                        <td>${h(dname)}</td>
                        <td><div class="action-btns">
                            <button class="btn btn-ghost btn-sm" onclick="Pets.openEdit('${m.id}')">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="Pets.del('${m.id}')">Eliminar</button>
                        </div></td>
                    </tr>
                `;
            }).join('')
        );
    },

    citas() {
        const data = DB.get('citas').sort((a,b) => a.fecha.localeCompare(b.fecha));
        entityView('citas', 'Citas', '+ Agendar Cita', 'Appts.openAdd()',
            ['Fecha', 'Hora', 'Mascota', 'Veterinario', 'Motivo', 'Estado', 'Acciones'],
            data.map(c => {
                const mas = DB.getOne('mascotas', c.mascotaId);
                const vet = DB.getOne('veterinarios', c.veterinarioId);
                return `
                    <tr data-search="${h(searchOf(c))}">
                        <td>${fmtDate(c.fecha)}</td>
                        <td>${h(c.hora)}</td>
                        <td>${mas ? petEmoji(mas.especie)+' '+h(mas.nombre) : '-'}</td>
                        <td>${vet ? 'Dr. '+h(vet.nombre)+' '+h(vet.apellido) : '-'}</td>
                        <td>${h(c.motivo)}</td>
                        <td>${estadoBadge(c.estado)}</td>
                        <td><div class="action-btns">
                            <button class="btn btn-ghost btn-sm" onclick="Appts.openEdit('${c.id}')">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="Appts.del('${c.id}')">Eliminar</button>
                        </div></td>
                    </tr>
                `;
            }).join('')
        );
    },

    misMascotas() {
        const pets = DB.get('mascotas').filter(m => m.duenoId === state.user.id);
        let html = `
            <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
                <button class="btn btn-primary" onclick="Pets.openAdd()">+ Agregar Mascota</button>
            </div>
        `;
        if (!pets.length) {
            html += `<div class="empty-state">
                <div class="empty-icon">🐾</div>
                <p>No tienes mascotas registradas aún.</p>
                <button class="btn btn-primary" style="margin-top:16px" onclick="Pets.openAdd()">Agregar mi primera mascota</button>
            </div>`;
        } else {
            html += `<div class="pets-grid">` + pets.map(m => `
                <div class="pet-card">
                    <div class="pet-icon">${petEmoji(m.especie)}</div>
                    <div class="pet-name">${h(m.nombre)}</div>
                    <div class="pet-info">
                        ${h(m.especie)}${m.raza ? ' · '+h(m.raza) : ''}<br>
                        ${m.edad} año${m.edad!=1?'s':''} · ${h(m.tamano||'-')}<br>
                        Color: ${h(m.color||'-')}
                    </div>
                    <div class="pet-actions">
                        <button class="btn btn-ghost btn-sm" onclick="Pets.openEdit('${m.id}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="Pets.del('${m.id}')">Eliminar</button>
                    </div>
                </div>
            `).join('') + `</div>`;
        }
        vc(html);
    },

    misCitas() {
        const myPetIds = DB.get('mascotas').filter(m => m.duenoId === state.user.id).map(m => m.id);
        const citas    = DB.get('citas').filter(c => myPetIds.includes(c.mascotaId))
                                        .sort((a,b) => a.fecha.localeCompare(b.fecha));
        let html = `
            <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
                <button class="btn btn-primary" onclick="Appts.openAdd()">+ Agendar Cita</button>
            </div>
        `;
        if (!citas.length) {
            html += `<div class="empty-state">
                <div class="empty-icon">📅</div>
                <p>No tienes citas agendadas.</p>
                <button class="btn btn-primary" style="margin-top:16px" onclick="Appts.openAdd()">Agendar cita</button>
            </div>`;
        } else {
            html += citas.map(c => {
                const mas = DB.getOne('mascotas', c.mascotaId);
                const vet = DB.getOne('veterinarios', c.veterinarioId);
                return `
                    <div class="cita-card ${h(c.estado)}">
                        <div class="cita-date">
                            <div class="date-day">${dayOf(c.fecha)}</div>
                            <div class="date-month">${monthOf(c.fecha)}</div>
                        </div>
                        <div class="cita-info">
                            <div class="cita-title">${h(c.motivo)}</div>
                            <div class="cita-meta">
                                ${mas ? petEmoji(mas.especie)+' '+h(mas.nombre) : '-'} &nbsp;·&nbsp;
                                ${vet ? 'Dr. '+h(vet.nombre)+' '+h(vet.apellido) : '-'} &nbsp;·&nbsp;
                                ${h(c.hora)}
                                ${c.notas ? '<br><em>'+h(c.notas)+'</em>' : ''}
                            </div>
                        </div>
                        <div class="cita-side">
                            ${estadoBadge(c.estado)}
                            ${c.estado==='pendiente' ? `<button class="btn btn-danger btn-sm" onclick="Appts.cancel('${c.id}')">Cancelar</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
        vc(html);
    },

    perfil() {
        const u = state.user;
        vc(`
            <div class="card profile-card">
                <div class="card-header">
                    <div class="card-title">Mi Perfil</div>
                    <button class="btn btn-primary btn-sm" onclick="Duenos.openSelfEdit()">Editar</button>
                </div>
                <div class="profile-header">
                    <div class="profile-avatar">${h(u.nombre.charAt(0))}</div>
                    <div>
                        <div class="profile-name">${h(u.nombre)} ${h(u.apellido)}</div>
                        <div class="profile-email">${h(u.email)}</div>
                    </div>
                </div>
                <div class="profile-field">
                    <div class="profile-field-label">Teléfono</div>
                    <div class="profile-field-value">${h(u.telefono||'No registrado')}</div>
                </div>
                <div class="profile-field">
                    <div class="profile-field-label">Dirección</div>
                    <div class="profile-field-value">${h(u.direccion||'No registrada')}</div>
                </div>
            </div>
        `);
    },
};

/* =============================================
   HELPERS DE RENDERIZADO
   ============================================= */
function vc(html) {
    document.getElementById('view-container').innerHTML = html;
}

function entityView(key, title, btnLabel, addFn, cols, rows) {
    vc(`
        <div class="card">
            <div class="card-header">
                <div class="card-title">${title} <span style="color:var(--text-muted);font-weight:400;font-size:13px">(${DB.get(key).length})</span></div>
                <button class="btn btn-primary btn-sm" onclick="${addFn}">${btnLabel}</button>
            </div>
            <div class="search-bar">
                <input type="text" placeholder="Buscar..." oninput="filterRows(this.value)">
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
                    <tbody id="tbl-body">
                        ${rows.length ? rows.join('') : `<tr><td colspan="${cols.length}" style="text-align:center;padding:40px;color:var(--text-muted)">Sin registros</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `);
}

function filterRows(q) {
    document.querySelectorAll('#tbl-body tr[data-search]').forEach(tr => {
        tr.style.display = tr.dataset.search.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
}

function citasTable(citas) {
    if (!citas.length) return '<p style="text-align:center;padding:20px;color:var(--text-muted)">No hay citas próximas</p>';
    return `
        <div class="table-container">
            <table class="data-table">
                <thead><tr><th>Fecha</th><th>Hora</th><th>Mascota</th><th>Veterinario</th><th>Motivo</th><th>Estado</th></tr></thead>
                <tbody>
                    ${citas.map(c => {
                        const m = DB.getOne('mascotas',c.mascotaId);
                        const v = DB.getOne('veterinarios',c.veterinarioId);
                        return `<tr>
                            <td>${fmtDate(c.fecha)}</td><td>${h(c.hora)}</td>
                            <td>${m?petEmoji(m.especie)+' '+h(m.nombre):'-'}</td>
                            <td>${v?'Dr. '+h(v.nombre)+' '+h(v.apellido):'-'}</td>
                            <td>${h(c.motivo)}</td><td>${estadoBadge(c.estado)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function searchOf(obj) {
    return Object.values(obj).join(' ').toLowerCase();
}

/* =============================================
   CRUD — VETERINARIOS
   ============================================= */
const Vets = {
    openAdd() {
        Modal.open('Agregar Veterinario', vetForm(null));
    },
    openEdit(id) {
        Modal.open('Editar Veterinario', vetForm(DB.getOne('veterinarios', id)));
    },
    save(e) {
        e.preventDefault();
        const data = formData(e.target);
        const list = DB.get('veterinarios');
        if (data.id) {
            const idx = list.findIndex(v => v.id === data.id);
            list[idx] = { ...list[idx], ...data };
            Toast.show('Veterinario actualizado', 'success');
        } else {
            list.push({ ...data, id: uid() });
            Toast.show('Veterinario agregado', 'success');
        }
        DB.set('veterinarios', list);
        Modal.close();
        navigate('veterinarios');
    },
    del(id) {
        if (!confirm('¿Eliminar este veterinario?')) return;
        DB.set('veterinarios', DB.get('veterinarios').filter(v => v.id !== id));
        Toast.show('Veterinario eliminado');
        navigate('veterinarios');
    },
};

function vetForm(vet) {
    const v = vet || {};
    const eOpts = ESPECIALIDADES.map(e =>
        `<option value="${h(e)}" ${v.especialidad===e?'selected':''}>${h(e)}</option>`
    ).join('');
    return `
        <form onsubmit="Vets.save(event)">
            <div class="form-row">
                <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(v.nombre||'')}" required></div>
                <div class="form-group"><label>Apellido</label><input name="apellido" type="text" value="${h(v.apellido||'')}" required></div>
            </div>
            <div class="form-group"><label>Especialidad</label>
                <select name="especialidad" required>
                    <option value="">Seleccionar...</option>${eOpts}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Teléfono</label><input name="telefono" type="tel" value="${h(v.telefono||'')}"></div>
                <div class="form-group"><label>Email</label><input name="email" type="email" value="${h(v.email||'')}" required></div>
            </div>
            <div class="form-group"><label>Horario</label><input name="horario" type="text" value="${h(v.horario||'')}" placeholder="Ej: Lun-Vie 8:00-17:00"></div>
            <input type="hidden" name="id" value="${h(v.id||'')}">
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">${v.id ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;
}

/* =============================================
   CRUD — DUEÑOS
   ============================================= */
const Duenos = {
    openAdd() {
        Modal.open('Agregar Dueño', duenoForm(null));
    },
    openEdit(id) {
        Modal.open('Editar Dueño', duenoForm(DB.getOne('duenos', id)));
    },
    openSelfEdit() {
        Modal.open('Editar Perfil', selfForm(state.user));
    },
    save(e) {
        e.preventDefault();
        const data  = formData(e.target);
        const list  = DB.get('duenos');

        if (data.id) {
            const idx = list.findIndex(d => d.id === data.id);
            const upd = { ...list[idx], ...data };
            if (!data.password) upd.password = list[idx].password;
            list[idx] = upd;
            Toast.show('Dueño actualizado', 'success');
        } else {
            if (list.find(d => d.email === data.email)) { Toast.show('Email ya registrado', 'error'); return; }
            list.push({ ...data, id: uid() });
            Toast.show('Dueño agregado', 'success');
        }
        DB.set('duenos', list);
        Modal.close();
        navigate('duenos');
    },
    saveSelf(e) {
        e.preventDefault();
        const data = formData(e.target);
        const list = DB.get('duenos');
        const idx  = list.findIndex(d => d.id === state.user.id);
        const upd  = { ...list[idx], ...data };
        if (!data.password) upd.password = list[idx].password;
        list[idx] = upd;
        DB.set('duenos', list);
        state.user = upd;
        saveSession();
        renderUserInfo();
        Modal.close();
        navigate('perfil');
        Toast.show('Perfil actualizado', 'success');
    },
    del(id) {
        if (!confirm('¿Eliminar este dueño? También se eliminarán sus mascotas y citas.')) return;
        const petIds = DB.get('mascotas').filter(m => m.duenoId === id).map(m => m.id);
        DB.set('mascotas', DB.get('mascotas').filter(m => m.duenoId !== id));
        DB.set('citas',    DB.get('citas').filter(c => !petIds.includes(c.mascotaId)));
        DB.set('duenos',   DB.get('duenos').filter(d => d.id !== id));
        Toast.show('Dueño eliminado');
        navigate('duenos');
    },
};

function duenoForm(dueno) {
    const d = dueno || {};
    return `
        <form onsubmit="Duenos.save(event)">
            <div class="form-row">
                <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(d.nombre||'')}" required></div>
                <div class="form-group"><label>Apellido</label><input name="apellido" type="text" value="${h(d.apellido||'')}" required></div>
            </div>
            <div class="form-group"><label>Email</label><input name="email" type="email" value="${h(d.email||'')}" required></div>
            <div class="form-group"><label>Teléfono</label><input name="telefono" type="tel" value="${h(d.telefono||'')}"></div>
            <div class="form-group"><label>Dirección</label><input name="direccion" type="text" value="${h(d.direccion||'')}"></div>
            <div class="form-group">
                <label>${d.id ? 'Nueva Contraseña (vacío = mantener actual)' : 'Contraseña'}</label>
                <input name="password" type="password" ${!d.id?'required minlength="6"':''} placeholder="Mínimo 6 caracteres">
            </div>
            <input type="hidden" name="id" value="${h(d.id||'')}">
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">${d.id ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;
}

function selfForm(u) {
    return `
        <form onsubmit="Duenos.saveSelf(event)">
            <div class="form-row">
                <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(u.nombre)}" required></div>
                <div class="form-group"><label>Apellido</label><input name="apellido" type="text" value="${h(u.apellido)}" required></div>
            </div>
            <div class="form-group"><label>Teléfono</label><input name="telefono" type="tel" value="${h(u.telefono||'')}"></div>
            <div class="form-group"><label>Dirección</label><input name="direccion" type="text" value="${h(u.direccion||'')}"></div>
            <div class="form-group"><label>Nueva Contraseña (vacío = mantener actual)</label><input name="password" type="password" minlength="6" placeholder="Mínimo 6 caracteres"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>
    `;
}

/* =============================================
   CRUD — MASCOTAS
   ============================================= */
const Pets = {
    openAdd() {
        Modal.open('Agregar Mascota', petForm(null));
    },
    openEdit(id) {
        Modal.open('Editar Mascota', petForm(DB.getOne('mascotas', id)));
    },
    save(e) {
        e.preventDefault();
        const data = formData(e.target);
        data.edad  = parseInt(data.edad, 10);
        if (state.role === 'owner' && !data.duenoId) data.duenoId = state.user.id;
        const list = DB.get('mascotas');
        if (data.id) {
            const idx = list.findIndex(m => m.id === data.id);
            list[idx] = { ...list[idx], ...data };
            Toast.show('Mascota actualizada', 'success');
        } else {
            list.push({ ...data, id: uid() });
            Toast.show('Mascota agregada', 'success');
        }
        DB.set('mascotas', list);
        Modal.close();
        navigate(state.role === 'owner' ? 'misMascotas' : 'mascotas');
    },
    del(id) {
        if (!confirm('¿Eliminar esta mascota? También se eliminarán sus citas.')) return;
        DB.set('mascotas', DB.get('mascotas').filter(m => m.id !== id));
        DB.set('citas',    DB.get('citas').filter(c => c.mascotaId !== id));
        Toast.show('Mascota eliminada');
        navigate(state.view);
    },
};

function petForm(pet) {
    const m       = pet || {};
    const isOwner = state.role === 'owner';
    const duenos  = DB.get('duenos');

    const especieOpts = ESPECIES.map(e =>
        `<option ${m.especie===e?'selected':''}>${h(e)}</option>`
    ).join('');
    const tamanoOpts  = TAMANOS.map(t =>
        `<option ${m.tamano===t?'selected':''}>${h(t)}</option>`
    ).join('');
    const duenoField  = isOwner
        ? `<input type="hidden" name="duenoId" value="${h(m.duenoId||state.user.id)}">`
        : `<div class="form-group"><label>Dueño</label>
               <select name="duenoId" required>
                   <option value="">Seleccionar dueño...</option>
                   ${duenos.map(d=>`<option value="${h(d.id)}" ${m.duenoId===d.id?'selected':''}>${h(d.nombre)} ${h(d.apellido)}</option>`).join('')}
               </select>
           </div>`;

    /*
     * JSON del objeto mascota (según especificación):
     * { id, raza, color, edad, nombre, tamano, especie, duenoId }
     */
    return `
        <form onsubmit="Pets.save(event)">
            <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(m.nombre||'')}" required></div>
            <div class="form-row">
                <div class="form-group"><label>Especie</label>
                    <select name="especie" required>
                        <option value="">Seleccionar...</option>${especieOpts}
                    </select>
                </div>
                <div class="form-group"><label>Raza</label><input name="raza" type="text" value="${h(m.raza||'')}" placeholder="Ej: Labrador, Persa..."></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Color</label><input name="color" type="text" value="${h(m.color||'')}" required></div>
                <div class="form-group"><label>Edad (años)</label><input name="edad" type="number" value="${m.edad??''}" min="0" max="30" required></div>
            </div>
            <div class="form-group"><label>Tamaño</label>
                <select name="tamano" required>
                    <option value="">Seleccionar...</option>${tamanoOpts}
                </select>
            </div>
            ${duenoField}
            <input type="hidden" name="id" value="${h(m.id||'')}">
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">${m.id ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;
}

/* =============================================
   CRUD — CITAS
   ============================================= */
const Appts = {
    openAdd() {
        const myPets = state.role === 'owner'
            ? DB.get('mascotas').filter(m => m.duenoId === state.user.id)
            : DB.get('mascotas');
        if (!myPets.length) { Toast.show('Primero registra una mascota', 'error'); return; }
        if (!DB.get('veterinarios').length) { Toast.show('No hay veterinarios disponibles', 'error'); return; }
        Modal.open('Agendar Cita', apptForm(null));
    },
    openEdit(id) {
        Modal.open('Editar Cita', apptForm(DB.getOne('citas', id)));
    },
    save(e) {
        e.preventDefault();
        const data = formData(e.target);
        const list = DB.get('citas');
        if (data.id) {
            const idx = list.findIndex(c => c.id === data.id);
            list[idx] = { ...list[idx], ...data };
            Toast.show('Cita actualizada', 'success');
        } else {
            list.push({ ...data, id: uid() });
            Toast.show('Cita agendada', 'success');
        }
        DB.set('citas', list);
        Modal.close();
        navigate(state.role === 'owner' ? 'misCitas' : 'citas');
    },
    cancel(id) {
        if (!confirm('¿Cancelar esta cita?')) return;
        const list = DB.get('citas');
        const idx  = list.findIndex(c => c.id === id);
        list[idx].estado = 'cancelada';
        DB.set('citas', list);
        Toast.show('Cita cancelada', 'warning');
        navigate('misCitas');
    },
    del(id) {
        if (!confirm('¿Eliminar esta cita?')) return;
        DB.set('citas', DB.get('citas').filter(c => c.id !== id));
        Toast.show('Cita eliminada');
        navigate(state.role === 'owner' ? 'misCitas' : 'citas');
    },
};

function apptForm(cita) {
    const c    = cita || {};
    const vets = DB.get('veterinarios');
    const pets = state.role === 'owner'
        ? DB.get('mascotas').filter(m => m.duenoId === state.user.id)
        : DB.get('mascotas');

    const petOpts    = pets.map(m =>
        `<option value="${h(m.id)}" ${c.mascotaId===m.id?'selected':''}>${petEmoji(m.especie)} ${h(m.nombre)} (${h(m.especie)})</option>`
    ).join('');
    const vetOpts    = vets.map(v =>
        `<option value="${h(v.id)}" ${c.veterinarioId===v.id?'selected':''}>Dr. ${h(v.nombre)} ${h(v.apellido)} — ${h(v.especialidad)}</option>`
    ).join('');
    const horaOpts   = timeSlots().map(t =>
        `<option ${c.hora===t?'selected':''}>${t}</option>`
    ).join('');
    const estadoOpts = ESTADOS.map(e =>
        `<option ${c.estado===e?'selected':''}>${h(e)}</option>`
    ).join('');

    return `
        <form onsubmit="Appts.save(event)">
            <div class="form-group"><label>Mascota</label>
                <select name="mascotaId" required>
                    <option value="">Seleccionar mascota...</option>${petOpts}
                </select>
            </div>
            <div class="form-group"><label>Veterinario</label>
                <select name="veterinarioId" required>
                    <option value="">Seleccionar veterinario...</option>${vetOpts}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Fecha</label><input name="fecha" type="date" value="${h(c.fecha||today())}" min="${today()}" required></div>
                <div class="form-group"><label>Hora</label>
                    <select name="hora" required>
                        <option value="">Seleccionar...</option>${horaOpts}
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Motivo</label><input name="motivo" type="text" value="${h(c.motivo||'')}" placeholder="Ej: Vacunación, Control, Cirugía..." required></div>
            <div class="form-group"><label>Estado</label>
                <select name="estado">${estadoOpts||'<option>pendiente</option>'}</select>
            </div>
            <div class="form-group"><label>Notas adicionales</label><textarea name="notas" placeholder="Observaciones, síntomas, indicaciones...">${h(c.notas||'')}</textarea></div>
            <input type="hidden" name="id" value="${h(c.id||'')}">
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">${c.id ? 'Actualizar' : 'Agendar'}</button>
            </div>
        </form>
    `;
}

/* =============================================
   MODAL
   ============================================= */
const Modal = {
    open(title, body) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML    = body;
        document.getElementById('modal-overlay').classList.add('show');
    },
    close() {
        document.getElementById('modal-overlay').classList.remove('show');
    },
    closeOnOverlay(e) {
        if (e.target === document.getElementById('modal-overlay')) Modal.close();
    },
};

/* =============================================
   TOAST
   ============================================= */
const Toast = {
    show(msg, type = 'info') {
        const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
        const el    = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span>${icons[type]||'ℹ'}</span> ${h(msg)}`;
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; }, 2700);
        setTimeout(() => el.remove(), 3000);
    },
};

/* =============================================
   HELPERS
   ============================================= */
function formData(form) {
    return Object.fromEntries(new FormData(form));
}

/* =============================================
   EVENTOS GLOBALES
   ============================================= */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') Modal.close();
});

/* =============================================
   ARRANQUE
   ============================================= */
init();
