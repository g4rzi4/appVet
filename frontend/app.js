/* =============================================
   API CLIENT
   ============================================= */
const API_BASE = '/api';

const API = {
    _token: () => localStorage.getItem('vc_token'),

    _headers() {
        const t = this._token();
        return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
    },

    async _req(method, path, body) {
        const opts = { method, headers: this._headers() };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const r = await fetch(API_BASE + path, opts);
        if (r.status === 401) { Auth.logout(); return null; }
        const data = await r.json();
        if (!r.ok) throw data;
        return data;
    },

    get:    (path)        => API._req('GET',    path),
    post:   (path, body)  => API._req('POST',   path, body),
    put:    (path, body)  => API._req('PUT',    path, body),
    delete: (path)        => API._req('DELETE', path),
};

/* =============================================
   ESTADO GLOBAL
   ============================================= */
let state    = { user: null, role: null, view: null };
let _calData = { citas: [], pets: [], duenos: [], year: null, month: null, selectedDay: null };

/* =============================================
   LOADING OVERLAY
   ============================================= */
const Loading = {
    show() { document.getElementById('loading-overlay').style.display = 'flex'; },
    hide() { document.getElementById('loading-overlay').style.display = 'none'; },
};

/* =============================================
   UTILIDADES
   ============================================= */
function h(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(s) {
    if (!s) return '-';
    return new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
}

function dayOf(s)   { return s ? new Date(s + 'T00:00:00').getDate() : ''; }
function monthOf(s) { return s ? new Date(s + 'T00:00:00').toLocaleDateString('es-ES',{month:'short'}) : ''; }
function today()    { return new Date().toISOString().split('T')[0]; }

function petEmoji(especie) {
    return ({Perro:'🐕',Gato:'🐈',Conejo:'🐇',Ave:'🦜',Reptil:'🦎',Pez:'🐠',Hámster:'🐹'})[especie] || '🐾';
}

function estadoBadge(e) {
    return ({
        pendiente:  '<span class="badge badge-orange">Pendiente</span>',
        confirmada: '<span class="badge badge-blue">Confirmada</span>',
        completada: '<span class="badge badge-green">Completada</span>',
        cancelada:  '<span class="badge badge-red">Cancelada</span>',
    })[e] || `<span class="badge badge-gray">${h(e)}</span>`;
}

function timeSlots() {
    const s = [];
    for (let hr = 8; hr <= 18; hr++) {
        s.push(String(hr).padStart(2,'0') + ':00');
        if (hr < 18) s.push(String(hr).padStart(2,'0') + ':30');
    }
    return s;
}

function findIn(arr, id) { return (arr || []).find(x => x.id === id) || null; }

const ESPECIALIDADES = ['Medicina General','Cirugía General','Medicina Interna','Dermatología','Cardiología','Oftalmología','Odontología','Traumatología','Oncología','Neurología'];
const TAMANOS        = ['Muy Pequeño','Pequeño','Mediano','Grande','Extra Grande'];
const ESPECIES       = ['Perro','Gato','Conejo','Ave','Reptil','Pez','Hámster'];
const ESTADOS        = ['pendiente','confirmada','completada','cancelada'];

/* =============================================
   INICIALIZACIÓN
   ============================================= */
async function init() {
    const token = localStorage.getItem('vc_token');
    const user  = JSON.parse(localStorage.getItem('vc_user') || 'null');
    const role  = localStorage.getItem('vc_role');

    if (token && user && role) {
        state.user = user;
        state.role = role;
        await bootApp();
    } else {
        showAuth();
    }
}

/* =============================================
   AUTENTICACIÓN
   ============================================= */
const Auth = {
    async login(e) {
        e.preventDefault();
        const email    = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        Loading.show();
        try {
            const data = await API.post('/auth/login', { email, password });
            if (!data) return;
            saveSession(data);
            await bootApp();
        } catch (err) {
            Toast.show(err.error || 'Error al iniciar sesión', 'error');
        } finally {
            Loading.hide();
        }
    },

    async register(e) {
        e.preventDefault();
        const body = {
            nombre:    document.getElementById('reg-nombre').value.trim(),
            apellido:  document.getElementById('reg-apellido').value.trim(),
            email:     document.getElementById('reg-email').value.trim(),
            password:  document.getElementById('reg-password').value,
            telefono:  document.getElementById('reg-telefono').value.trim(),
            direccion: document.getElementById('reg-direccion').value.trim(),
        };
        Loading.show();
        try {
            const data = await API.post('/auth/register', body);
            if (!data) return;
            saveSession(data);
            await bootApp();
            Toast.show('¡Cuenta creada exitosamente!', 'success');
        } catch (err) {
            Toast.show(err.error || 'Error al registrarse', 'error');
        } finally {
            Loading.hide();
        }
    },

    logout() {
        ['vc_token','vc_user','vc_role'].forEach(k => localStorage.removeItem(k));
        state.user = null; state.role = null;
        showAuth();
    },
};

function saveSession({ token, user, role }) {
    localStorage.setItem('vc_token', token);
    localStorage.setItem('vc_user',  JSON.stringify(user));
    localStorage.setItem('vc_role',  role);
    state.user = user; state.role = role;
}

/* =============================================
   PANTALLAS
   ============================================= */
function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display   = 'none';
    Loading.hide();
    showPanel('login-panel');
}

function showPanel(id) {
    document.getElementById('login-panel').style.display    = id === 'login-panel'    ? 'block' : 'none';
    document.getElementById('register-panel').style.display = id === 'register-panel' ? 'block' : 'none';
}

async function bootApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').style.display   = 'flex';
    renderSidebar();
    renderUserInfo();
    await navigate(state.role === 'admin' ? 'dashboard' : state.role === 'vet' ? 'calendario' : 'misMascotas');
}

/* =============================================
   SIDEBAR Y NAVEGACIÓN
   ============================================= */
function renderSidebar() {
    const adminItems = [
        {id:'dashboard',    icon:'📊', label:'Dashboard'},
        {id:'veterinarios', icon:'👨‍⚕️', label:'Veterinarios'},
        {id:'duenos',       icon:'👥', label:'Dueños'},
        {id:'mascotas',     icon:'🐾', label:'Mascotas'},
        {id:'citas',        icon:'📅', label:'Citas'},
    ];
    const ownerItems = [
        {id:'misMascotas', icon:'🐾', label:'Mis Mascotas'},
        {id:'misCitas',    icon:'📅', label:'Mis Citas'},
        {id:'perfil',      icon:'👤', label:'Mi Perfil'},
    ];
    const vetItems = [
        {id:'calendario',   icon:'📅', label:'Calendario'},
        {id:'misPacientes', icon:'🐾', label:'Mis Pacientes'},
    ];
    const items = state.role === 'admin' ? adminItems : state.role === 'vet' ? vetItems : ownerItems;
    document.getElementById('sidebar-nav').innerHTML = items.map(it => `
        <button class="nav-item" id="nav-${it.id}" onclick="navigate('${it.id}')">
            <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
        </button>
    `).join('');
}

function renderUserInfo() {
    const full = `${state.user.nombre} ${state.user.apellido}`;
    document.getElementById('user-name').textContent       = full;
    document.getElementById('user-role-label').textContent = state.role === 'admin' ? 'Administrador' : 'Dueño';
    document.getElementById('user-avatar').textContent     = full.charAt(0).toUpperCase();
}

const PAGE_TITLES = {
    dashboard:'Dashboard', veterinarios:'Veterinarios', duenos:'Dueños',
    mascotas:'Mascotas', citas:'Citas',
    misMascotas:'Mis Mascotas', misCitas:'Mis Citas', perfil:'Mi Perfil',
    calendario:'Calendario', misPacientes:'Mis Pacientes',
};

async function navigate(view) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`nav-${view}`);
    if (btn) btn.classList.add('active');
    state.view = view;
    document.getElementById('page-title').textContent = PAGE_TITLES[view] || view;
    Loading.show();
    try {
        await Views[view]();
    } catch (err) {
        console.error(err);
        Toast.show('Error al cargar la vista', 'error');
    } finally {
        Loading.hide();
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

/* =============================================
   HELPERS DEL CALENDARIO
   ============================================= */
function buildCalGrid() {
    const { citas, year, month } = _calData;
    const firstDow  = (new Date(year, month, 1).getDay() + 6) % 7; // lunes=0
    const daysInMon = new Date(year, month + 1, 0).getDate();
    const todayD    = new Date();
    const monthName = new Date(year, month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    const byDay = {};
    citas.forEach(c => { if (!byDay[c.fecha]) byDay[c.fecha] = []; byDay[c.fecha].push(c); });

    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= daysInMon; d++) {
        const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday  = todayD.getFullYear()===year && todayD.getMonth()===month && todayD.getDate()===d;
        const isSel    = _calData.selectedDay === dateStr;
        const dayCitas = byDay[dateStr] || [];
        const pend     = dayCitas.filter(c => c.estado==='pendiente').length;
        const conf     = dayCitas.filter(c => c.estado==='confirmada').length;
        cells += `<div class="cal-day ${isToday?'today':''} ${isSel?'selected':''} ${dayCitas.length?'has-appts':''}"
                       onclick="calSelectDay('${dateStr}')">
            <span class="cal-day-num">${d}</span>
            <div class="cal-dots">
                ${pend ? `<span class="cal-dot orange" title="${pend} pendiente(s)"></span>` : ''}
                ${conf ? `<span class="cal-dot blue"   title="${conf} confirmada(s)"></span>` : ''}
            </div>
        </div>`;
    }

    return `
        <div class="cal-nav">
            <button onclick="calPrev()">‹</button>
            <span>${monthName}</span>
            <button onclick="calNext()">›</button>
        </div>
        <div class="cal-grid">
            <div class="cal-dow">Lu</div><div class="cal-dow">Ma</div><div class="cal-dow">Mi</div>
            <div class="cal-dow">Ju</div><div class="cal-dow">Vi</div><div class="cal-dow">Sá</div>
            <div class="cal-dow">Do</div>
            ${cells}
        </div>
        <div class="cal-legend">
            <span><span class="cal-dot orange" style="display:inline-block"></span> Pendiente</span>
            <span><span class="cal-dot blue"   style="display:inline-block"></span> Confirmada</span>
        </div>`;
}

function buildDayDetail(dateStr) {
    const { citas, pets, duenos } = _calData;
    const day = citas.filter(c => c.fecha === dateStr).sort((a,b) => a.hora.localeCompare(b.hora));
    if (!day.length) return '<p class="no-appts">Sin citas para este día.</p>';

    return day.map(c => {
        const pet   = findIn(pets, c.mascotaId);
        const dueno = pet ? findIn(duenos, pet.duenoId) : null;
        const canConfirm    = c.estado === 'pendiente';
        const canComplete   = c.estado === 'confirmada';
        const canReschedule = c.estado === 'pendiente' || c.estado === 'confirmada';
        return `<div class="appt-item">
            <div class="appt-time">${h(c.hora)}</div>
            <div class="appt-info">
                <div class="appt-pet">${pet ? petEmoji(pet.especie)+' '+h(pet.nombre) : '-'}</div>
                <div class="appt-owner">${dueno ? h(dueno.nombre)+' '+h(dueno.apellido) : ''}</div>
                <div class="appt-motivo">${h(c.motivo)}</div>
            </div>
            <div class="appt-side">
                ${estadoBadge(c.estado)}
                ${canConfirm    ? `<button class="btn btn-primary btn-sm" onclick="Appts.confirm('${c.id}')">Confirmar</button>` : ''}
                ${canComplete   ? `<button class="btn btn-success btn-sm" onclick="Appts.complete('${c.id}')">Completar</button>` : ''}
                ${canReschedule ? `<button class="btn btn-ghost btn-sm"   onclick="Appts.openReschedule('${c.id}')">Reprogramar</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function buildUpcoming(citas, pets, duenos) {
    const upcomingAll = citas
        .filter(c => c.fecha >= today() && ['pendiente','confirmada'].includes(c.estado))
        .sort((a,b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
        .slice(0, 8);
    if (!upcomingAll.length) return '<p class="no-appts">Sin citas próximas.</p>';
    return upcomingAll.map(c => {
        const pet = findIn(pets, c.mascotaId);
        return `<div class="appt-item">
            <div class="appt-time" style="min-width:70px;font-size:13px">
                <div style="font-weight:700">${dayOf(c.fecha)} ${monthOf(c.fecha)}</div>
                <div style="color:var(--text-muted)">${h(c.hora)}</div>
            </div>
            <div class="appt-info">
                <div class="appt-pet">${pet ? petEmoji(pet.especie)+' '+h(pet.nombre) : '-'}</div>
                <div class="appt-motivo">${h(c.motivo)}</div>
            </div>
            <div>${estadoBadge(c.estado)}</div>
        </div>`;
    }).join('');
}

function calSelectDay(dateStr) {
    _calData.selectedDay = dateStr;
    document.getElementById('cal-day-detail').innerHTML = buildDayDetail(dateStr);
    document.getElementById('cal-grid-wrap').innerHTML  = buildCalGrid();
}

function calPrev() {
    _calData.month--;
    if (_calData.month < 0) { _calData.month = 11; _calData.year--; }
    _calData.selectedDay = null;
    document.getElementById('cal-grid-wrap').innerHTML = buildCalGrid();
    document.getElementById('cal-day-detail').innerHTML = '<p class="no-appts">Selecciona un día en el calendario.</p>';
}

function calNext() {
    _calData.month++;
    if (_calData.month > 11) { _calData.month = 0; _calData.year++; }
    _calData.selectedDay = null;
    document.getElementById('cal-grid-wrap').innerHTML = buildCalGrid();
    document.getElementById('cal-day-detail').innerHTML = '<p class="no-appts">Selecciona un día en el calendario.</p>';
}

/* =============================================
   RENDER HELPERS
   ============================================= */
function vc(html) { document.getElementById('view-container').innerHTML = html; }

function entityView(title, btnLabel, addFn, cols, rows, count) {
    vc(`
        <div class="card">
            <div class="card-header">
                <div class="card-title">${title} <span style="color:var(--text-muted);font-weight:400;font-size:13px">(${count})</span></div>
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

function searchOf(obj) { return Object.values(obj).join(' ').toLowerCase(); }

function citasTableHTML(citas, pets, vets) {
    if (!citas.length) return '<p style="text-align:center;padding:20px;color:var(--text-muted)">No hay citas próximas</p>';
    return `<div class="table-container"><table class="data-table">
        <thead><tr><th>Fecha</th><th>Hora</th><th>Mascota</th><th>Veterinario</th><th>Motivo</th><th>Estado</th></tr></thead>
        <tbody>${citas.map(c => {
            const m = findIn(pets, c.mascotaId);
            const v = findIn(vets, c.veterinarioId);
            return `<tr><td>${fmtDate(c.fecha)}</td><td>${h(c.hora)}</td>
                <td>${m ? petEmoji(m.especie)+' '+h(m.nombre) : '-'}</td>
                <td>${v ? 'Dr. '+h(v.nombre)+' '+h(v.apellido) : '-'}</td>
                <td>${h(c.motivo)}</td><td>${estadoBadge(c.estado)}</td></tr>`;
        }).join('')}</tbody>
    </table></div>`;
}

/* =============================================
   VISTAS (todas async)
   ============================================= */
const Views = {

    async dashboard() {
        const [vets, duenos, pets, citas] = await Promise.all([
            API.get('/veterinarios'), API.get('/duenos'),
            API.get('/mascotas'),     API.get('/citas'),
        ]);
        const pend = citas.filter(c => c.estado === 'pendiente');
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
                ${citasTableHTML(pend.slice(0, 6), pets, vets)}
            </div>
        `);
    },

    async veterinarios() {
        const data = await API.get('/veterinarios');
        entityView('Veterinarios', '+ Agregar Veterinario', 'Vets.openAdd()',
            ['Nombre','Especialidad','Teléfono','Email','Horario','Acciones'],
            data.map(v => `
                <tr data-search="${h(searchOf(v))}">
                    <td><strong>${h(v.nombre)} ${h(v.apellido)}</strong></td>
                    <td><span class="badge badge-blue">${h(v.especialidad)}</span></td>
                    <td>${h(v.telefono||'-')}</td><td>${h(v.email)}</td><td>${h(v.horario||'-')}</td>
                    <td><div class="action-btns">
                        <button class="btn btn-ghost btn-sm" onclick="Vets.openEdit('${v.id}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="Vets.del('${v.id}')">Eliminar</button>
                    </div></td>
                </tr>`
            ), data.length
        );
    },

    async duenos() {
        const [duenos, pets] = await Promise.all([API.get('/duenos'), API.get('/mascotas')]);
        entityView('Dueños', '+ Agregar Dueño', 'Duenos.openAdd()',
            ['Nombre','Email','Teléfono','Dirección','Mascotas','Acciones'],
            duenos.map(d => {
                const cnt = pets.filter(m => m.duenoId === d.id).length;
                return `
                    <tr data-search="${h(searchOf(d))}">
                        <td><strong>${h(d.nombre)} ${h(d.apellido)}</strong></td>
                        <td>${h(d.email)}</td><td>${h(d.telefono||'-')}</td><td>${h(d.direccion||'-')}</td>
                        <td><span class="badge badge-purple">${cnt} mascota${cnt!==1?'s':''}</span></td>
                        <td><div class="action-btns">
                            <button class="btn btn-ghost btn-sm" onclick="Duenos.openEdit('${d.id}')">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="Duenos.del('${d.id}')">Eliminar</button>
                        </div></td>
                    </tr>`;
            }), duenos.length
        );
    },

    async mascotas() {
        const [pets, duenos] = await Promise.all([API.get('/mascotas'), API.get('/duenos')]);
        entityView('Mascotas', '+ Agregar Mascota', 'Pets.openAdd()',
            ['Nombre','Especie','Raza','Color','Edad','Tamaño','Dueño','Acciones'],
            pets.map(m => {
                const d = findIn(duenos, m.duenoId);
                return `
                    <tr data-search="${h(searchOf(m))}">
                        <td><strong>${h(m.nombre)}</strong></td>
                        <td>${petEmoji(m.especie)} ${h(m.especie)}</td>
                        <td>${h(m.raza||'-')}</td><td>${h(m.color||'-')}</td>
                        <td>${m.edad} año${m.edad!=1?'s':''}</td><td>${h(m.tamano||'-')}</td>
                        <td>${d ? h(d.nombre)+' '+h(d.apellido) : '-'}</td>
                        <td><div class="action-btns">
                            <button class="btn btn-ghost btn-sm" onclick="Pets.openEdit('${m.id}')">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="Pets.del('${m.id}')">Eliminar</button>
                        </div></td>
                    </tr>`;
            }), pets.length
        );
    },

    async citas() {
        const [citas, pets, vets] = await Promise.all([
            API.get('/citas'), API.get('/mascotas'), API.get('/veterinarios'),
        ]);
        const sorted = [...citas].sort((a,b) => a.fecha.localeCompare(b.fecha));
        entityView('Citas', '+ Agendar Cita', 'Appts.openAdd()',
            ['Fecha','Hora','Mascota','Veterinario','Motivo','Estado','Acciones'],
            sorted.map(c => {
                const m = findIn(pets, c.mascotaId);
                const v = findIn(vets, c.veterinarioId);
                return `
                    <tr data-search="${h(searchOf(c))}">
                        <td>${fmtDate(c.fecha)}</td><td>${h(c.hora)}</td>
                        <td>${m ? petEmoji(m.especie)+' '+h(m.nombre) : '-'}</td>
                        <td>${v ? 'Dr. '+h(v.nombre)+' '+h(v.apellido) : '-'}</td>
                        <td>${h(c.motivo)}</td><td>${estadoBadge(c.estado)}</td>
                        <td><div class="action-btns">
                            <button class="btn btn-ghost btn-sm" onclick="Appts.openEdit('${c.id}')">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="Appts.del('${c.id}')">Eliminar</button>
                        </div></td>
                    </tr>`;
            }), citas.length
        );
    },

    async misMascotas() {
        const pets = await API.get('/mascotas');
        let html = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-primary" onclick="Pets.openAdd()">+ Agregar Mascota</button>
        </div>`;
        if (!pets.length) {
            html += `<div class="empty-state"><div class="empty-icon">🐾</div>
                <p>No tienes mascotas registradas aún.</p>
                <button class="btn btn-primary" style="margin-top:16px" onclick="Pets.openAdd()">Agregar mi primera mascota</button>
            </div>`;
        } else {
            html += `<div class="pets-grid">` + pets.map(m => `
                <div class="pet-card">
                    <div class="pet-icon">${petEmoji(m.especie)}</div>
                    <div class="pet-name">${h(m.nombre)}</div>
                    <div class="pet-info">
                        ${h(m.especie)}${m.raza?' · '+h(m.raza):''}<br>
                        ${m.edad} año${m.edad!=1?'s':''} · ${h(m.tamano||'-')}<br>
                        Color: ${h(m.color||'-')}
                    </div>
                    <div class="pet-actions">
                        <button class="btn btn-ghost btn-sm" onclick="Pets.openEdit('${m.id}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="Pets.del('${m.id}')">Eliminar</button>
                    </div>
                </div>`).join('') + `</div>`;
        }
        vc(html);
    },

    async misCitas() {
        const [citas, pets, vets] = await Promise.all([
            API.get('/citas'), API.get('/mascotas'), API.get('/veterinarios'),
        ]);
        const sorted = [...citas].sort((a,b) => a.fecha.localeCompare(b.fecha));
        let html = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-primary" onclick="Appts.openAdd()">+ Agendar Cita</button>
        </div>`;
        if (!sorted.length) {
            html += `<div class="empty-state"><div class="empty-icon">📅</div>
                <p>No tienes citas agendadas.</p>
                <button class="btn btn-primary" style="margin-top:16px" onclick="Appts.openAdd()">Agendar cita</button>
            </div>`;
        } else {
            html += sorted.map(c => {
                const m = findIn(pets, c.mascotaId);
                const v = findIn(vets, c.veterinarioId);
                return `<div class="cita-card ${h(c.estado)}">
                    <div class="cita-date">
                        <div class="date-day">${dayOf(c.fecha)}</div>
                        <div class="date-month">${monthOf(c.fecha)}</div>
                    </div>
                    <div class="cita-info">
                        <div class="cita-title">${h(c.motivo)}</div>
                        <div class="cita-meta">
                            ${m ? petEmoji(m.especie)+' '+h(m.nombre) : '-'} &nbsp;·&nbsp;
                            ${v ? 'Dr. '+h(v.nombre)+' '+h(v.apellido) : '-'} &nbsp;·&nbsp; ${h(c.hora)}
                            ${c.notas ? '<br><em>'+h(c.notas)+'</em>' : ''}
                        </div>
                    </div>
                    <div class="cita-side">
                        ${estadoBadge(c.estado)}
                        ${c.estado==='pendiente' ? `<button class="btn btn-danger btn-sm" onclick="Appts.cancel('${c.id}')">Cancelar</button>` : ''}
                    </div>
                </div>`;
            }).join('');
        }
        vc(html);
    },

    async perfil() {
        const u = state.user;
        vc(`<div class="card profile-card">
            <div class="card-header">
                <div class="card-title">Mi Perfil</div>
                <button class="btn btn-primary btn-sm" onclick="Duenos.openSelfEdit()">Editar</button>
            </div>
            <div class="profile-header">
                <div class="profile-avatar">${h(u.nombre.charAt(0))}</div>
                <div><div class="profile-name">${h(u.nombre)} ${h(u.apellido)}</div>
                     <div class="profile-email">${h(u.email)}</div></div>
            </div>
            <div class="profile-field"><div class="profile-field-label">Teléfono</div>
                <div class="profile-field-value">${h(u.telefono||'No registrado')}</div></div>
            <div class="profile-field"><div class="profile-field-label">Dirección</div>
                <div class="profile-field-value">${h(u.direccion||'No registrada')}</div></div>
        </div>`);
    },

    async calendario() {
        const [citas, pets, duenos] = await Promise.all([
            API.get('/citas'), API.get('/mascotas'), API.get('/duenos'),
        ]);
        const now = new Date();
        _calData = { citas, pets, duenos, year: now.getFullYear(), month: now.getMonth(), selectedDay: null };

        vc(`<div class="cal-layout">
            <div>
                <div class="card" style="min-width:310px">
                    <div id="cal-grid-wrap">${buildCalGrid()}</div>
                </div>
            </div>
            <div style="flex:1;min-width:0">
                <div class="card">
                    <div class="card-title" style="margin-bottom:16px">Citas del día</div>
                    <div id="cal-day-detail"><p class="no-appts">Selecciona un día en el calendario.</p></div>
                </div>
                <div class="card">
                    <div class="card-title" style="margin-bottom:16px">Próximas citas</div>
                    ${buildUpcoming(citas, pets, duenos)}
                </div>
            </div>
        </div>`);
    },

    async misPacientes() {
        const [citas, pets, duenos] = await Promise.all([
            API.get('/citas'), API.get('/mascotas'), API.get('/duenos'),
        ]);
        const uniquePetIds = [...new Set(citas.map(c => c.mascotaId))];
        const myPets = pets.filter(p => uniquePetIds.includes(p.id));

        if (!myPets.length) {
            vc(`<div class="empty-state"><div class="empty-icon">🐾</div><p>Aún no tienes pacientes asignados.</p></div>`);
            return;
        }

        vc(`<div class="expedientes-grid">${myPets.map(pet => {
            const dueno    = findIn(duenos, pet.duenoId);
            const petCitas = citas.filter(c => c.mascotaId === pet.id).sort((a,b) => b.fecha.localeCompare(a.fecha));
            return `<div class="expediente-card">
                <div class="exp-header">
                    <div class="exp-icon">${petEmoji(pet.especie)}</div>
                    <div>
                        <div class="exp-name">${h(pet.nombre)}</div>
                        <div class="exp-species">${h(pet.especie)} · ${h(pet.raza||'-')} · ${pet.edad} años · ${h(pet.color||'-')}</div>
                    </div>
                </div>
                <div class="exp-owner">
                    <span class="exp-label">Dueño:</span> ${dueno ? h(dueno.nombre)+' '+h(dueno.apellido) : '-'}
                    ${dueno?.telefono ? `<br><span class="exp-label">Tel:</span> ${h(dueno.telefono)}` : ''}
                </div>
                <div class="exp-citas">
                    <div class="exp-label" style="margin-bottom:6px">Historial (${petCitas.length} citas)</div>
                    ${petCitas.length ? petCitas.map(c => `
                        <div class="exp-cita">
                            <span>${fmtDate(c.fecha)} ${h(c.hora)}</span>
                            <span style="flex:1">${h(c.motivo)}</span>
                            ${estadoBadge(c.estado)}
                        </div>`).join('') : '<p style="color:var(--text-muted);font-size:13px">Sin historial</p>'}
                </div>
            </div>`;
        }).join('')}</div>`);
    },
};

/* =============================================
   CRUD — VETERINARIOS
   ============================================= */
const Vets = {
    openAdd()    { Modal.open('Agregar Veterinario', vetForm({})); },
    async openEdit(id) {
        const v = await API.get(`/veterinarios/${id}`);
        if (v) Modal.open('Editar Veterinario', vetForm(v));
    },
    async save(e) {
        e.preventDefault();
        const data = fd(e.target);
        if (!data.email.endsWith('@vetcare.com')) {
            Toast.show('El email debe terminar en @vetcare.com', 'error');
            return;
        }
        if (!data.password) delete data.password;
        Loading.show();
        try {
            if (data.id) { await API.put(`/veterinarios/${data.id}`, data); Toast.show('Veterinario actualizado','success'); }
            else         { await API.post('/veterinarios', data);           Toast.show('Veterinario agregado','success'); }
            Modal.close();
            await navigate('veterinarios');
        } catch (err) { Toast.show(err.error||'Error al guardar','error'); }
        finally { Loading.hide(); }
    },
    async del(id) {
        if (!confirm('¿Eliminar este veterinario?')) return;
        Loading.show();
        try { await API.delete(`/veterinarios/${id}`); Toast.show('Veterinario eliminado'); await navigate('veterinarios'); }
        catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
};

function vetForm(v) {
    const eOpts = ESPECIALIDADES.map(e => `<option ${v.especialidad===e?'selected':''}>${h(e)}</option>`).join('');
    return `<form onsubmit="Vets.save(event)">
        <div class="form-row">
            <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(v.nombre||'')}" required></div>
            <div class="form-group"><label>Apellido</label><input name="apellido" type="text" value="${h(v.apellido||'')}" required></div>
        </div>
        <div class="form-group"><label>Especialidad</label>
            <select name="especialidad" required><option value="">Seleccionar...</option>${eOpts}</select>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Teléfono</label><input name="telefono" type="tel" value="${h(v.telefono||'')}"></div>
            <div class="form-group">
                <label>Email <small style="color:var(--text-muted)">(debe ser @vetcare.com)</small></label>
                <input name="email" type="email" value="${h(v.email||'')}" placeholder="nombre@vetcare.com" required>
            </div>
        </div>
        <div class="form-group"><label>Horario</label><input name="horario" type="text" value="${h(v.horario||'')}" placeholder="Ej: Lun-Vie 8:00-17:00"></div>
        <div class="form-group">
            <label>${v.id ? 'Nueva Contraseña (vacío = mantener)' : 'Contraseña de acceso'}</label>
            <input name="password" type="password" ${!v.id?'required minlength="6"':''} placeholder="Mínimo 6 caracteres">
        </div>
        <input type="hidden" name="id" value="${h(v.id||'')}">
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">${v.id?'Actualizar':'Guardar'}</button>
        </div>
    </form>`;
}

/* =============================================
   CRUD — DUEÑOS
   ============================================= */
const Duenos = {
    openAdd()    { Modal.open('Agregar Dueño', duenoForm({})); },
    async openEdit(id) {
        const d = await API.get(`/duenos/${id}`);
        if (d) Modal.open('Editar Dueño', duenoForm(d));
    },
    openSelfEdit() { Modal.open('Editar Perfil', selfForm(state.user)); },

    async save(e) {
        e.preventDefault();
        const data = fd(e.target);
        if (!data.password) delete data.password;
        Loading.show();
        try {
            if (data.id) { await API.put(`/duenos/${data.id}`, data); Toast.show('Dueño actualizado','success'); }
            else         { await API.post('/duenos', data);            Toast.show('Dueño agregado','success'); }
            Modal.close();
            await navigate('duenos');
        } catch(err) { Toast.show(err.error||'Error al guardar','error'); }
        finally { Loading.hide(); }
    },

    async saveSelf(e) {
        e.preventDefault();
        const data = fd(e.target);
        if (!data.password) delete data.password;
        Loading.show();
        try {
            const updated = await API.put(`/duenos/${state.user.id}`, data);
            if (!updated) return;
            state.user = { ...state.user, ...updated };
            localStorage.setItem('vc_user', JSON.stringify(state.user));
            renderUserInfo();
            Modal.close();
            await navigate('perfil');
            Toast.show('Perfil actualizado','success');
        } catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },

    async del(id) {
        if (!confirm('¿Eliminar este dueño? También se eliminarán sus mascotas y citas.')) return;
        Loading.show();
        try { await API.delete(`/duenos/${id}`); Toast.show('Dueño eliminado'); await navigate('duenos'); }
        catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
};

function duenoForm(d) {
    return `<form onsubmit="Duenos.save(event)">
        <div class="form-row">
            <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(d.nombre||'')}" required></div>
            <div class="form-group"><label>Apellido</label><input name="apellido" type="text" value="${h(d.apellido||'')}" required></div>
        </div>
        <div class="form-group"><label>Email</label><input name="email" type="email" value="${h(d.email||'')}" required></div>
        <div class="form-group"><label>Teléfono</label><input name="telefono" type="tel" value="${h(d.telefono||'')}"></div>
        <div class="form-group"><label>Dirección</label><input name="direccion" type="text" value="${h(d.direccion||'')}"></div>
        <div class="form-group">
            <label>${d.id ? 'Nueva Contraseña (vacío = mantener)' : 'Contraseña'}</label>
            <input name="password" type="password" ${!d.id?'required minlength="6"':''} placeholder="Mínimo 6 caracteres">
        </div>
        <input type="hidden" name="id" value="${h(d.id||'')}">
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">${d.id?'Actualizar':'Guardar'}</button>
        </div>
    </form>`;
}

function selfForm(u) {
    return `<form onsubmit="Duenos.saveSelf(event)">
        <div class="form-row">
            <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(u.nombre)}" required></div>
            <div class="form-group"><label>Apellido</label><input name="apellido" type="text" value="${h(u.apellido)}" required></div>
        </div>
        <div class="form-group"><label>Teléfono</label><input name="telefono" type="tel" value="${h(u.telefono||'')}"></div>
        <div class="form-group"><label>Dirección</label><input name="direccion" type="text" value="${h(u.direccion||'')}"></div>
        <div class="form-group"><label>Nueva Contraseña (vacío = mantener)</label><input name="password" type="password" minlength="6" placeholder="Mínimo 6 caracteres"></div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
    </form>`;
}

/* =============================================
   CRUD — MASCOTAS
   ============================================= */
const Pets = {
    async openAdd() {
        const duenos = state.role === 'admin' ? await API.get('/duenos') : [];
        Modal.open('Agregar Mascota', petForm({}, duenos));
    },
    async openEdit(id) {
        const [pet, duenos] = await Promise.all([
            API.get(`/mascotas/${id}`),
            state.role === 'admin' ? API.get('/duenos') : Promise.resolve([]),
        ]);
        if (pet) Modal.open('Editar Mascota', petForm(pet, duenos));
    },
    async save(e) {
        e.preventDefault();
        const data = fd(e.target);
        data.edad  = parseInt(data.edad, 10);
        Loading.show();
        try {
            if (data.id) { await API.put(`/mascotas/${data.id}`, data); Toast.show('Mascota actualizada','success'); }
            else         { await API.post('/mascotas', data);            Toast.show('Mascota agregada','success'); }
            Modal.close();
            await navigate(state.role === 'owner' ? 'misMascotas' : 'mascotas');
        } catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
    async del(id) {
        if (!confirm('¿Eliminar esta mascota? También se eliminarán sus citas.')) return;
        Loading.show();
        try { await API.delete(`/mascotas/${id}`); Toast.show('Mascota eliminada'); await navigate(state.view); }
        catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
};

function petForm(m, duenos) {
    const especieOpts = ESPECIES.map(e  => `<option ${m.especie===e?'selected':''}>${h(e)}</option>`).join('');
    const tamanoOpts  = TAMANOS.map(t   => `<option ${m.tamano===t?'selected':''}>${h(t)}</option>`).join('');
    const duenoField  = state.role !== 'admin'
        ? `<input type="hidden" name="duenoId" value="${h(m.duenoId||state.user.id)}">`
        : `<div class="form-group"><label>Dueño</label><select name="duenoId" required>
               <option value="">Seleccionar dueño...</option>
               ${duenos.map(d=>`<option value="${h(d.id)}" ${m.duenoId===d.id?'selected':''}>${h(d.nombre)} ${h(d.apellido)}</option>`).join('')}
           </select></div>`;
    /* JSON del objeto mascota: { id, raza, color, edad, nombre, tamano, especie, duenoId } */
    return `<form onsubmit="Pets.save(event)">
        <div class="form-group"><label>Nombre</label><input name="nombre" type="text" value="${h(m.nombre||'')}" required></div>
        <div class="form-row">
            <div class="form-group"><label>Especie</label>
                <select name="especie" required><option value="">Seleccionar...</option>${especieOpts}</select>
            </div>
            <div class="form-group"><label>Raza</label><input name="raza" type="text" value="${h(m.raza||'')}" placeholder="Ej: Labrador, Persa..."></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Color</label><input name="color" type="text" value="${h(m.color||'')}" required></div>
            <div class="form-group"><label>Edad (años)</label><input name="edad" type="number" value="${m.edad??''}" min="0" max="30" required></div>
        </div>
        <div class="form-group"><label>Tamaño</label>
            <select name="tamano" required><option value="">Seleccionar...</option>${tamanoOpts}</select>
        </div>
        ${duenoField}
        <input type="hidden" name="id" value="${h(m.id||'')}">
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">${m.id?'Actualizar':'Guardar'}</button>
        </div>
    </form>`;
}

/* =============================================
   CRUD — CITAS
   ============================================= */
const Appts = {
    async openAdd() {
        const [pets, vets] = await Promise.all([API.get('/mascotas'), API.get('/veterinarios')]);
        if (!pets.length) { Toast.show('Primero registra una mascota','error'); return; }
        if (!vets.length) { Toast.show('No hay veterinarios disponibles','error'); return; }
        Modal.open('Agendar Cita', apptForm({}, pets, vets));
    },
    async openEdit(id) {
        const [cita, pets, vets] = await Promise.all([
            API.get(`/citas/${id}`), API.get('/mascotas'), API.get('/veterinarios'),
        ]);
        if (cita) Modal.open('Editar Cita', apptForm(cita, pets, vets));
    },
    async save(e) {
        e.preventDefault();
        const data = fd(e.target);
        Loading.show();
        try {
            if (data.id) { await API.put(`/citas/${data.id}`, data); Toast.show('Cita actualizada','success'); }
            else         { await API.post('/citas', data);            Toast.show('Cita agendada','success'); }
            Modal.close();
            await navigate(state.role === 'owner' ? 'misCitas' : 'citas');
        } catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
    async confirm(id) {
        Loading.show();
        try {
            await API.put(`/citas/${id}`, { estado: 'confirmada' });
            Toast.show('Cita confirmada', 'success');
            _calData.citas = await API.get('/citas');
            const det = document.getElementById('cal-day-detail');
            if (det && _calData.selectedDay) det.innerHTML = buildDayDetail(_calData.selectedDay);
            document.getElementById('cal-grid-wrap').innerHTML = buildCalGrid();
        } catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
    async complete(id) {
        Loading.show();
        try {
            await API.put(`/citas/${id}`, { estado: 'completada' });
            Toast.show('Cita completada', 'success');
            _calData.citas = await API.get('/citas');
            const det = document.getElementById('cal-day-detail');
            if (det && _calData.selectedDay) det.innerHTML = buildDayDetail(_calData.selectedDay);
            document.getElementById('cal-grid-wrap').innerHTML = buildCalGrid();
        } catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
    async openReschedule(id) {
        const cita = _calData.citas.find(c => c.id === id);
        if (!cita) return;
        Modal.open('Reprogramar Cita', rescheduleForm(cita));
    },
    async saveReschedule(e) {
        e.preventDefault();
        const data = fd(e.target);
        Loading.show();
        try {
            await API.put(`/citas/${data.id}`, { fecha: data.fecha, hora: data.hora, notas: data.notas });
            Toast.show('Cita reprogramada', 'success');
            Modal.close();
            _calData.citas    = await API.get('/citas');
            _calData.selectedDay = data.fecha;
            document.getElementById('cal-grid-wrap').innerHTML  = buildCalGrid();
            document.getElementById('cal-day-detail').innerHTML = buildDayDetail(data.fecha);
        } catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
    async cancel(id) {
        if (!confirm('¿Cancelar esta cita?')) return;
        Loading.show();
        try { await API.put(`/citas/${id}`, { estado:'cancelada' }); Toast.show('Cita cancelada','warning'); await navigate('misCitas'); }
        catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
    async del(id) {
        if (!confirm('¿Eliminar esta cita?')) return;
        Loading.show();
        try { await API.delete(`/citas/${id}`); Toast.show('Cita eliminada'); await navigate(state.role==='owner'?'misCitas':'citas'); }
        catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
};

function apptForm(c, pets, vets) {
    const petOpts    = pets.map(m  => `<option value="${h(m.id)}"  ${c.mascotaId===m.id?'selected':''}>${petEmoji(m.especie)} ${h(m.nombre)} (${h(m.especie)})</option>`).join('');
    const vetOpts    = vets.map(v  => `<option value="${h(v.id)}"  ${c.veterinarioId===v.id?'selected':''}>Dr. ${h(v.nombre)} ${h(v.apellido)} — ${h(v.especialidad)}</option>`).join('');
    const horaOpts   = timeSlots().map(t  => `<option ${c.hora===t?'selected':''}>${t}</option>`).join('');
    const estadoOpts = ESTADOS.map(e => `<option ${(c.estado||'pendiente')===e?'selected':''}>${h(e)}</option>`).join('');
    return `<form onsubmit="Appts.save(event)">
        <div class="form-group"><label>Mascota</label>
            <select name="mascotaId" required><option value="">Seleccionar mascota...</option>${petOpts}</select>
        </div>
        <div class="form-group"><label>Veterinario</label>
            <select name="veterinarioId" required><option value="">Seleccionar veterinario...</option>${vetOpts}</select>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Fecha</label><input name="fecha" type="date" value="${h(c.fecha||today())}" min="${today()}" required></div>
            <div class="form-group"><label>Hora</label>
                <select name="hora" required><option value="">Seleccionar...</option>${horaOpts}</select>
            </div>
        </div>
        <div class="form-group"><label>Motivo</label><input name="motivo" type="text" value="${h(c.motivo||'')}" placeholder="Ej: Vacunación, Control, Cirugía..." required></div>
        ${state.role === 'admin'
            ? `<div class="form-group"><label>Estado</label><select name="estado">${estadoOpts}</select></div>`
            : `<input type="hidden" name="estado" value="${h(c.estado||'pendiente')}">`
        }
        <div class="form-group"><label>Notas adicionales</label><textarea name="notas" placeholder="Observaciones...">${h(c.notas||'')}</textarea></div>
        <input type="hidden" name="id" value="${h(c.id||'')}">
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">${c.id?'Actualizar':'Agendar'}</button>
        </div>
    </form>`;
}

function rescheduleForm(c) {
    const pet      = findIn(_calData.pets, c.mascotaId);
    const horaOpts = timeSlots().map(t => `<option ${c.hora===t?'selected':''}>${t}</option>`).join('');
    return `<form onsubmit="Appts.saveReschedule(event)">
        <p style="color:var(--text-muted);margin-bottom:16px">${pet ? petEmoji(pet.especie)+' <strong>'+h(pet.nombre)+'</strong>' : ''} — ${h(c.motivo)}</p>
        <div class="form-row">
            <div class="form-group"><label>Nueva Fecha</label><input name="fecha" type="date" value="${h(c.fecha)}" min="${today()}" required></div>
            <div class="form-group"><label>Nueva Hora</label>
                <select name="hora" required><option value="">Seleccionar...</option>${horaOpts}</select>
            </div>
        </div>
        <div class="form-group"><label>Notas adicionales</label><textarea name="notas" placeholder="Observaciones...">${h(c.notas||'')}</textarea></div>
        <input type="hidden" name="id" value="${h(c.id)}">
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Reprogramar</button>
        </div>
    </form>`;
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
    close() { document.getElementById('modal-overlay').classList.remove('show'); },
    closeOnOverlay(e) { if (e.target === document.getElementById('modal-overlay')) Modal.close(); },
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
   HELPER FORM DATA
   ============================================= */
function fd(form) { return Object.fromEntries(new FormData(form)); }

/* =============================================
   EVENTOS GLOBALES
   ============================================= */
document.addEventListener('keydown', e => { if (e.key === 'Escape') Modal.close(); });

/* =============================================
   ARRANQUE
   ============================================= */
init();
