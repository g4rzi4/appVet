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

const _DAY_IDX = { Lun:1, Mar:2, 'Mié':3, Jue:4, Vie:5, 'Sáb':6, Dom:0 };
let _formVets = [];

function parseHorario(horario) {
    if (!horario) return null;
    const m = horario.match(/([^\s-]+)-([^\s-]+)\s+(\d+):(\d+)-(\d+):(\d+)/);
    if (!m) return null;
    const sd = _DAY_IDX[m[1]], ed = _DAY_IDX[m[2]];
    if (sd == null || ed == null) return null;
    return { sd, ed, sh:+m[3], sm:+m[4], eh:+m[5], em:+m[6] };
}

function timeSlotsForVet(horario) {
    const h = parseHorario(horario);
    if (!h) return timeSlots();
    const slots = [];
    const start = h.sh * 60 + h.sm, end = h.eh * 60 + h.em;
    for (let hr = h.sh; hr <= h.eh; hr++) {
        for (const min of [0, 30]) {
            const t = hr * 60 + min;
            if (t >= start && t <= end)
                slots.push(String(hr).padStart(2,'0') + ':' + String(min).padStart(2,'0'));
        }
    }
    return slots;
}

function vetWorkDays(horario) {
    const h = parseHorario(horario);
    if (!h) return null;
    const days = [];
    if (h.sd <= h.ed) { for (let d = h.sd; d <= h.ed; d++) days.push(d); }
    else { for (let d = h.sd; d <= 6; d++) days.push(d); for (let d = 0; d <= h.ed; d++) days.push(d); }
    return days;
}

function updateAppointmentVet(vetId) {
    const vet = _formVets.find(v => v.id === vetId);
    const horaSelect = document.getElementById('appt-hora');
    if (!horaSelect) return;
    const prev = horaSelect.value;
    const slots = vet ? timeSlotsForVet(vet.horario) : timeSlots();
    horaSelect.innerHTML = '<option value="">Seleccionar...</option>' +
        slots.map(t => `<option${prev === t ? ' selected' : ''}>${t}</option>`).join('');
    checkApptDate();
}

function checkApptDate() {
    const vetSel  = document.getElementById('appt-vet');
    const dateIn  = document.getElementById('appt-fecha');
    if (!vetSel || !dateIn || !dateIn.value || !vetSel.value) return;
    const vet  = _formVets.find(v => v.id === vetSel.value);
    if (!vet || !vet.horario) return;
    const days = vetWorkDays(vet.horario);
    if (!days) return;
    const dow  = new Date(dateIn.value + 'T00:00:00').getDay();
    if (!days.includes(dow)) {
        const nombres = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
        Toast.show(`El Dr. ${h(vet.nombre)} no atiende los ${nombres[dow]}`, 'error');
        dateIn.value = '';
    }
}

function findIn(arr, id) { return (arr || []).find(x => x.id === id) || null; }

function validPassword(p) { return p.length >= 8 && /[A-Z]/.test(p); }

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
        if (!validPassword(body.password)) {
            Toast.show('La contraseña debe tener mínimo 8 caracteres y al menos una mayúscula', 'error');
            return;
        }
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
        {id:'solicitudes',  icon:'🔄', label:'Solicitudes'},
    ];
    const ownerItems = [
        {id:'misMascotas',    icon:'🐾', label:'Mis Mascotas'},
        {id:'misCitas',       icon:'📅', label:'Mis Citas'},
        {id:'misSolicitudes', icon:'🔄', label:'Mis Solicitudes'},
        {id:'perfil',         icon:'👤', label:'Mi Perfil'},
    ];
    const vetItems = [
        {id:'calendario',     icon:'📅', label:'Calendario'},
        {id:'misPacientes',   icon:'🐾', label:'Mis Pacientes'},
        {id:'misSolicitudes', icon:'🔄', label:'Mis Solicitudes'},
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
    mascotas:'Mascotas', citas:'Citas', solicitudes:'Solicitudes de Reprogramación',
    misMascotas:'Mis Mascotas', misCitas:'Mis Citas', misSolicitudes:'Mis Solicitudes', perfil:'Mi Perfil',
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
function buildCalGrid(mode = 'vet') {
    const selectFn = mode === 'owner' ? 'ownerCalSelectDay' : 'calSelectDay';
    const prevFn   = mode === 'owner' ? 'ownerCalPrev'      : 'calPrev';
    const nextFn   = mode === 'owner' ? 'ownerCalNext'      : 'calNext';

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
                       onclick="${selectFn}('${dateStr}')">
            <span class="cal-day-num">${d}</span>
            <div class="cal-dots">
                ${pend ? `<span class="cal-dot orange" title="${pend} pendiente(s)"></span>` : ''}
                ${conf ? `<span class="cal-dot blue"   title="${conf} confirmada(s)"></span>` : ''}
            </div>
        </div>`;
    }

    return `
        <div class="cal-nav">
            <button onclick="${prevFn}()">‹</button>
            <span>${monthName}</span>
            <button onclick="${nextFn}()">›</button>
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
        const canCancel     = c.estado === 'pendiente' || c.estado === 'confirmada';
        return `<div class="appt-item">
            <div class="appt-time">${h(c.hora)}</div>
            <div class="appt-info">
                <div class="appt-pet">${pet ? petEmoji(pet.especie)+' '+h(pet.nombre) : '-'}</div>
                <div class="appt-owner">${dueno ? h(dueno.nombre)+' '+h(dueno.apellido) : ''}</div>
                <div class="appt-motivo">${h(c.motivo)}</div>
            </div>
            <div class="appt-side">
                ${estadoBadge(c.estado)}
                ${pet ? `<button class="btn btn-ghost btn-sm" onclick="PetHistorial.open('${c.mascotaId}','${h(pet.nombre)}')">Historial</button>` : ''}
                ${canConfirm    ? `<button class="btn btn-primary btn-sm" onclick="Appts.confirm('${c.id}')">Confirmar</button>` : ''}
                ${canComplete   ? `<button class="btn btn-success btn-sm" onclick="Appts.complete('${c.id}')">Completar</button>` : ''}
                ${canReschedule ? `<button class="btn btn-ghost btn-sm" onclick="Sols.openNew('${c.id}')">Reprogramar</button>` : ''}
                ${canCancel     ? `<button class="btn btn-danger btn-sm" onclick="Appts.vetCancel('${c.id}')">Cancelar</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function buildOwnerDayDetail(dateStr) {
    const { citas, pets, vets } = _calData;
    const day = citas.filter(c => c.fecha === dateStr).sort((a,b) => a.hora.localeCompare(b.hora));
    if (!day.length) return '<p class="no-appts">Sin citas para este día.</p>';
    return day.map(c => {
        const pet = findIn(pets, c.mascotaId);
        const vet = findIn(vets, c.veterinarioId);
        const canCancel = c.estado === 'pendiente';
        return `<div class="appt-item">
            <div class="appt-time">${h(c.hora)}</div>
            <div class="appt-info">
                <div class="appt-pet">${pet ? petEmoji(pet.especie)+' '+h(pet.nombre) : '-'}</div>
                <div class="appt-owner">${vet ? 'Dr. '+h(vet.nombre)+' '+h(vet.apellido) : ''}</div>
                <div class="appt-motivo">${h(c.motivo)}</div>
            </div>
            <div class="appt-side">
                ${estadoBadge(c.estado)}
                ${pet ? `<button class="btn btn-ghost btn-sm" onclick="PetHistorial.open('${c.mascotaId}','${h(pet.nombre)}')">Historial</button>` : ''}
                ${canCancel ? `<button class="btn btn-danger btn-sm" onclick="Appts.ownerCalCancel('${c.id}')">Cancelar</button>` : ''}
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

function ownerCalSelectDay(dateStr) {
    _calData.selectedDay = dateStr;
    document.getElementById('cal-day-detail').innerHTML = buildOwnerDayDetail(dateStr);
    document.getElementById('cal-grid-wrap').innerHTML  = buildCalGrid('owner');
}

function ownerCalPrev() {
    _calData.month--;
    if (_calData.month < 0) { _calData.month = 11; _calData.year--; }
    _calData.selectedDay = null;
    document.getElementById('cal-grid-wrap').innerHTML  = buildCalGrid('owner');
    document.getElementById('cal-day-detail').innerHTML = '<p class="no-appts">Selecciona un día en el calendario.</p>';
}

function ownerCalNext() {
    _calData.month++;
    if (_calData.month > 11) { _calData.month = 0; _calData.year++; }
    _calData.selectedDay = null;
    document.getElementById('cal-grid-wrap').innerHTML  = buildCalGrid('owner');
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
        const [vets, duenos, pets, citas, sols] = await Promise.all([
            API.get('/veterinarios'), API.get('/duenos'),
            API.get('/mascotas'),     API.get('/citas'), API.get('/solicitudes'),
        ]);
        const pend      = citas.filter(c => c.estado === 'pendiente');
        const pendSols  = sols.filter(s => s.estado === 'pendiente');
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
                ${pendSols.length ? `<div class="stat-card" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;cursor:pointer" onclick="navigate('solicitudes')">
                    <div class="stat-icon">🔄</div>
                    <div><div class="stat-value">${pendSols.length}</div><div class="stat-label">Solicitudes Pendientes</div></div>
                </div>` : ''}
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
                            <button class="btn btn-ghost btn-sm" onclick="PetHistorial.open('${m.id}','${h(m.nombre)}')">Historial</button>
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
                            ${m ? `<button class="btn btn-ghost btn-sm" onclick="PetHistorial.open('${m.id}','${h(m.nombre)}')">Historial</button>` : ''}
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
                        <button class="btn btn-ghost btn-sm" onclick="PetHistorial.open('${m.id}','${h(m.nombre)}')">Historial</button>
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
        const now = new Date();
        _calData = { citas, pets, vets, year: now.getFullYear(), month: now.getMonth(), selectedDay: null };

        vc(`<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
                <button class="btn btn-primary btn-sm" onclick="Appts.openAdd()">+ Agendar Cita</button>
            </div>
            <div class="cal-layout">
                <div>
                    <div class="card" style="min-width:310px">
                        <div id="cal-grid-wrap">${buildCalGrid('owner')}</div>
                    </div>
                </div>
                <div style="flex:1;min-width:0">
                    <div class="card">
                        <div class="card-title" style="margin-bottom:16px">Citas del día</div>
                        <div id="cal-day-detail"><p class="no-appts">Selecciona un día en el calendario.</p></div>
                    </div>
                </div>
            </div>`);
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
        const [citas, pets, duenos, vets] = await Promise.all([
            API.get('/citas'), API.get('/mascotas'), API.get('/duenos'), API.get('/veterinarios'),
        ]);
        _formVets = vets;
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

    async solicitudes() {
        const [sols, citas, pets, vets, duenos] = await Promise.all([
            API.get('/solicitudes'), API.get('/citas'),
            API.get('/mascotas'),    API.get('/veterinarios'), API.get('/duenos'),
        ]);
        const pendientes = sols.filter(s => s.estado === 'pendiente');
        const resto      = sols.filter(s => s.estado !== 'pendiente')
                              .sort((a,b) => b.creadaEn.localeCompare(a.creadaEn))
                              .slice(0, 20);

        function solRow(s, pending) {
            const cita   = findIn(citas, s.citaId);
            const pet    = cita ? findIn(pets,  cita.mascotaId)    : null;
            const vet    = cita ? findIn(vets,  cita.veterinarioId): null;
            const dueno  = pet  ? findIn(duenos, pet.duenoId)      : null;
            const quien  = s.solicitanteRole === 'vet'
                ? (findIn(vets,   s.solicitanteId) || {})
                : (findIn(duenos, s.solicitanteId) || {});
            const quienLabel = s.solicitanteRole === 'vet'
                ? `Dr. ${h(quien.nombre||'')} ${h(quien.apellido||'')}`
                : `${h(quien.nombre||'')} ${h(quien.apellido||'')}`;
            const estadoBadgeLocal = {
                pendiente: '<span class="badge badge-orange">Pendiente</span>',
                aprobada:  '<span class="badge badge-green">Aprobada</span>',
                rechazada: '<span class="badge badge-red">Rechazada</span>',
            }[s.estado] || '';
            return `<tr>
                <td>${quienLabel}<br><small style="color:var(--text-muted)">${h(s.solicitanteRole)}</small></td>
                <td>${pet ? petEmoji(pet.especie)+' '+h(pet.nombre) : '-'}</td>
                <td>${vet ? 'Dr. '+h(vet.nombre)+' '+h(vet.apellido) : '-'}</td>
                <td>${cita ? fmtDate(cita.fecha)+' '+h(cita.hora) : '-'}</td>
                <td><strong>${fmtDate(s.fechaSolicitada)} ${h(s.horaSolicitada)}</strong></td>
                <td>${h(s.motivo||'-')}</td>
                <td>${estadoBadgeLocal}</td>
                ${pending ? `<td><div class="action-btns">
                    <button class="btn btn-success btn-sm" onclick="Sols.aprobar('${s.id}')">Aprobar</button>
                    <button class="btn btn-danger  btn-sm" onclick="Sols.rechazar('${s.id}')">Rechazar</button>
                </div></td>` : '<td>—</td>'}
            </tr>`;
        }

        vc(`
            ${pendientes.length ? `
            <div class="card" style="margin-bottom:20px">
                <div class="card-header"><div class="card-title">Pendientes (${pendientes.length})</div></div>
                <div class="table-container"><table class="data-table">
                    <thead><tr><th>Solicitante</th><th>Mascota</th><th>Veterinario</th><th>Cita actual</th><th>Solicita</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${pendientes.map(s => solRow(s, true)).join('')}</tbody>
                </table></div>
            </div>` : `<div class="empty-state" style="margin-bottom:20px"><div class="empty-icon">✅</div><p>Sin solicitudes pendientes.</p></div>`}
            ${resto.length ? `
            <div class="card">
                <div class="card-header"><div class="card-title">Historial reciente</div></div>
                <div class="table-container"><table class="data-table">
                    <thead><tr><th>Solicitante</th><th>Mascota</th><th>Veterinario</th><th>Cita actual</th><th>Solicitó</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
                    <tbody>${resto.map(s => solRow(s, false)).join('')}</tbody>
                </table></div>
            </div>` : ''}
        `);
    },

    async misSolicitudes() {
        const [sols, citas, pets, vets] = await Promise.all([
            API.get('/solicitudes'), API.get('/citas'),
            API.get('/mascotas'),    API.get('/veterinarios'),
        ]);
        const sorted = [...sols].sort((a,b) => b.creadaEn.localeCompare(a.creadaEn));
        const estadoColor = { pendiente:'badge-orange', aprobada:'badge-green', rechazada:'badge-red' };
        let html = '';
        if (!sorted.length) {
            html = `<div class="empty-state"><div class="empty-icon">🔄</div><p>No tienes solicitudes de reprogramación.</p></div>`;
        } else {
            html = sorted.map(s => {
                const cita = findIn(citas, s.citaId);
                const pet  = cita ? findIn(pets, cita.mascotaId)    : null;
                const vet  = cita ? findIn(vets, cita.veterinarioId): null;
                return `<div class="cita-card" style="border-left:4px solid var(--${s.estado==='pendiente'?'warning':'estado'==='aprobada'?'success':'danger'}-color,#aaa)">
                    <div class="cita-date">
                        <div class="date-day">${fmtDate(s.fechaSolicitada).split(' ')[0]}</div>
                        <div class="date-month">${fmtDate(s.fechaSolicitada).split(' ')[1]||''}</div>
                    </div>
                    <div class="cita-info">
                        <div class="cita-title">Reprogramar a: ${fmtDate(s.fechaSolicitada)} ${h(s.horaSolicitada)}</div>
                        <div class="cita-meta">
                            ${pet ? petEmoji(pet.especie)+' '+h(pet.nombre) : '-'} &nbsp;·&nbsp;
                            ${vet ? 'Dr. '+h(vet.nombre)+' '+h(vet.apellido) : '-'}
                            ${cita ? ' &nbsp;·&nbsp; Cita actual: '+fmtDate(cita.fecha)+' '+h(cita.hora) : ''}
                            ${s.motivo ? '<br><em>'+h(s.motivo)+'</em>' : ''}
                        </div>
                    </div>
                    <div class="cita-side">
                        <span class="badge ${estadoColor[s.estado]||'badge-gray'}">${h(s.estado)}</span>
                        ${s.estado === 'pendiente'
                            ? `<button class="btn btn-danger btn-sm" onclick="Sols.cancelar('${s.id}')">Cancelar</button>`
                            : ''}
                    </div>
                </div>`;
            }).join('');
        }
        vc(`<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-ghost btn-sm" onclick="navigate('${state.role==='vet'?'calendario':'misCitas'}')">← Volver a citas</button>
        </div>${html}`);
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
                    <div style="flex:1">
                        <div class="exp-name">${h(pet.nombre)}</div>
                        <div class="exp-species">${h(pet.especie)} · ${h(pet.raza||'-')} · ${pet.edad} años · ${h(pet.color||'-')}</div>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="PetHistorial.open('${pet.id}','${h(pet.nombre)}')">Ver historial completo</button>
                </div>
                <div class="exp-owner">
                    <span class="exp-label">Dueño:</span> ${dueno ? h(dueno.nombre)+' '+h(dueno.apellido) : '-'}
                    ${dueno?.telefono ? `<br><span class="exp-label">Tel:</span> ${h(dueno.telefono)}` : ''}
                </div>
                <div class="exp-citas">
                    <div class="exp-label" style="margin-bottom:6px">Mis consultas con este paciente (${petCitas.length})</div>
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
        if (data.password && !validPassword(data.password)) {
            Toast.show('La contraseña debe tener mínimo 8 caracteres y al menos una mayúscula', 'error');
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
            <input name="password" type="password" ${!v.id?'required minlength="8"':''} placeholder="Mínimo 8 caracteres, una mayúscula">
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
        if (data.password && !validPassword(data.password)) {
            Toast.show('La contraseña debe tener mínimo 8 caracteres y al menos una mayúscula', 'error');
            return;
        }
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
        if (data.password && !validPassword(data.password)) {
            Toast.show('La contraseña debe tener mínimo 8 caracteres y al menos una mayúscula', 'error');
            return;
        }
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
            <input name="password" type="password" ${!d.id?'required minlength="8"':''} placeholder="Mínimo 8 caracteres, una mayúscula">
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
        <div class="form-group"><label>Nueva Contraseña (vacío = mantener)</label><input name="password" type="password" minlength="8" placeholder="Mínimo 8 caracteres, una mayúscula"></div>
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
        _formVets = vets;
        const myPets = state.role === 'owner' ? pets.filter(p => p.duenoId === state.user.id) : pets;
        if (!myPets.length) { Toast.show('Primero registra una mascota','error'); return; }
        if (!vets.length) { Toast.show('No hay veterinarios disponibles','error'); return; }
        Modal.open('Agendar Cita', apptForm({}, myPets, vets));
    },
    async openEdit(id) {
        const [cita, pets, vets] = await Promise.all([
            API.get(`/citas/${id}`), API.get('/mascotas'), API.get('/veterinarios'),
        ]);
        _formVets = vets;
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
    async vetCancel(id) {
        if (!confirm('¿Cancelar esta cita?')) return;
        Loading.show();
        try {
            await API.put(`/citas/${id}`, { estado: 'cancelada' });
            Toast.show('Cita cancelada', 'warning');
            _calData.citas = await API.get('/citas');
            const det = document.getElementById('cal-day-detail');
            if (det && _calData.selectedDay) det.innerHTML = buildDayDetail(_calData.selectedDay);
            document.getElementById('cal-grid-wrap').innerHTML = buildCalGrid();
        } catch(err) { Toast.show(err.error||'Error','error'); }
        finally { Loading.hide(); }
    },
    async ownerCalCancel(id) {
        if (!confirm('¿Cancelar esta cita?')) return;
        Loading.show();
        try {
            await API.put(`/citas/${id}`, { estado: 'cancelada' });
            Toast.show('Cita cancelada', 'warning');
            _calData.citas = await API.get('/citas');
            const det = document.getElementById('cal-day-detail');
            if (det && _calData.selectedDay) det.innerHTML = buildOwnerDayDetail(_calData.selectedDay);
            document.getElementById('cal-grid-wrap').innerHTML = buildCalGrid('owner');
        } catch(err) { Toast.show(err.error||'Error','error'); }
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
    const selVet     = vets.find(v => v.id === c.veterinarioId);
    const vetOpts    = vets.map(v  => `<option value="${h(v.id)}"  ${c.veterinarioId===v.id?'selected':''}>Dr. ${h(v.nombre)} ${h(v.apellido)} — ${h(v.especialidad)}</option>`).join('');
    const horaSlots  = selVet ? timeSlotsForVet(selVet.horario) : timeSlots();
    const horaOpts   = horaSlots.map(t => `<option ${c.hora===t?'selected':''}>${t}</option>`).join('');
    const estadoOpts = ESTADOS.map(e => `<option ${(c.estado||'pendiente')===e?'selected':''}>${h(e)}</option>`).join('');
    return `<form onsubmit="Appts.save(event)">
        <div class="form-group"><label>Mascota</label>
            <select name="mascotaId" required><option value="">Seleccionar mascota...</option>${petOpts}</select>
        </div>
        <div class="form-group"><label>Veterinario</label>
            <select id="appt-vet" name="veterinarioId" required onchange="updateAppointmentVet(this.value)">
                <option value="">Seleccionar veterinario...</option>${vetOpts}
            </select>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Fecha</label>
                <input id="appt-fecha" name="fecha" type="date" value="${h(c.fecha||today())}" min="${today()}" required onchange="checkApptDate()">
            </div>
            <div class="form-group"><label>Hora</label>
                <select id="appt-hora" name="hora" required><option value="">Seleccionar...</option>${horaOpts}</select>
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
    const vet      = findIn(_formVets, c.veterinarioId);
    const horaOpts = timeSlotsForVet(vet ? vet.horario : null).map(t => `<option ${c.hora===t?'selected':''}>${t}</option>`).join('');
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
   HISTORIAL CLÍNICO
   ============================================= */
const PetHistorial = {
    async open(petId, petNombre) {
        Loading.show();
        try {
            const [citas, vets] = await Promise.all([
                API.get(`/citas?mascotaId=${encodeURIComponent(petId)}`),
                API.get('/veterinarios'),
            ]);
            const sorted = [...citas].sort((a, b) =>
                b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora)
            );
            Modal.open(`Historial Clínico — ${h(petNombre)}`, PetHistorial._render(sorted, vets), 'lg');
        } catch(err) { Toast.show(err.error || 'Error al cargar historial', 'error'); }
        finally { Loading.hide(); }
    },

    _render(citas, vets) {
        const rows = citas.length ? citas.map(c => {
            const v = findIn(vets, c.veterinarioId);
            return `<tr>
                <td>${fmtDate(c.fecha)}</td>
                <td>${h(c.hora)}</td>
                <td>${v ? 'Dr. '+h(v.nombre)+' '+h(v.apellido) : '-'}</td>
                <td>${h(c.motivo)}</td>
                <td>${estadoBadge(c.estado)}</td>
                <td style="max-width:200px;font-size:12px;color:var(--text-muted)">${h(c.notas||'—')}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Sin historial registrado.</td></tr>`;

        return `<div class="table-container"><table class="data-table">
            <thead><tr>
                <th>Fecha</th><th>Hora</th><th>Veterinario</th>
                <th>Motivo</th><th>Estado</th><th>Notas</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.close()">Cerrar</button>
        </div>`;
    },
};

/* =============================================
   CRUD — SOLICITUDES DE REPROGRAMACIÓN
   ============================================= */
const Sols = {
    async openNew(citaId) {
        const [citas, pets, vets] = await Promise.all([
            API.get('/citas'), API.get('/mascotas'), API.get('/veterinarios'),
        ]);
        _formVets = vets;
        const cita = citas.find(c => c.id === citaId);
        if (!cita) { Toast.show('Cita no encontrada', 'error'); return; }
        const pet = findIn(pets, cita.mascotaId);
        const vet = findIn(vets, cita.veterinarioId);
        Modal.open('Solicitar Reprogramación', solForm(cita, pet, vet));
    },

    async save(e) {
        e.preventDefault();
        const data = fd(e.target);
        Loading.show();
        try {
            await API.post('/solicitudes', {
                citaId:          data.citaId,
                fechaSolicitada: data.fecha,
                horaSolicitada:  data.hora,
                motivo:          data.motivo,
            });
            Modal.close();
            Toast.show('Solicitud enviada al administrador', 'success');
            await navigate(state.role === 'vet' ? 'misSolicitudes' : 'misSolicitudes');
        } catch(err) { Toast.show(err.error || 'Error al enviar solicitud', 'error'); }
        finally { Loading.hide(); }
    },

    async aprobar(id) {
        if (!confirm('¿Aprobar esta solicitud? Se actualizará la fecha y hora de la cita.')) return;
        Loading.show();
        try {
            await API.put(`/solicitudes/${id}`, { accion: 'aprobar' });
            Toast.show('Solicitud aprobada y cita actualizada', 'success');
            await navigate('solicitudes');
        } catch(err) { Toast.show(err.error || 'Error', 'error'); }
        finally { Loading.hide(); }
    },

    async rechazar(id) {
        if (!confirm('¿Rechazar esta solicitud?')) return;
        Loading.show();
        try {
            await API.put(`/solicitudes/${id}`, { accion: 'rechazar' });
            Toast.show('Solicitud rechazada', 'warning');
            await navigate('solicitudes');
        } catch(err) { Toast.show(err.error || 'Error', 'error'); }
        finally { Loading.hide(); }
    },

    async cancelar(id) {
        if (!confirm('¿Cancelar esta solicitud?')) return;
        Loading.show();
        try {
            await API.delete(`/solicitudes/${id}`);
            Toast.show('Solicitud cancelada', 'warning');
            await navigate('misSolicitudes');
        } catch(err) { Toast.show(err.error || 'Error', 'error'); }
        finally { Loading.hide(); }
    },
};

function solForm(cita, pet, vet) {
    const vetHorario = vet ? vet.horario : null;
    const horaOpts   = timeSlotsForVet(vetHorario).map(t => `<option>${t}</option>`).join('');
    return `<form onsubmit="Sols.save(event)">
        <p style="color:var(--text-muted);margin-bottom:16px">
            ${pet ? petEmoji(pet.especie)+' <strong>'+h(pet.nombre)+'</strong>' : ''}
            ${vet ? ' &nbsp;·&nbsp; Dr. '+h(vet.nombre)+' '+h(vet.apellido) : ''}
            <br><small>Cita actual: ${fmtDate(cita.fecha)} a las ${h(cita.hora)}</small>
        </p>
        <div class="form-row">
            <div class="form-group"><label>Nueva Fecha</label>
                <input id="appt-fecha" name="fecha" type="date" value="" min="${today()}" required onchange="checkApptDate()">
            </div>
            <div class="form-group"><label>Nueva Hora</label>
                <select id="appt-hora" name="hora" required>
                    <option value="">Seleccionar...</option>${horaOpts}
                </select>
            </div>
        </div>
        <div class="form-group"><label>Motivo de la solicitud</label>
            <textarea name="motivo" placeholder="Explica por qué necesitas reprogramar..." required></textarea>
        </div>
        <input type="hidden" name="citaId" value="${h(cita.id)}">
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Enviar solicitud</button>
        </div>
    </form>`;
}

/* =============================================
   MODAL
   ============================================= */
const Modal = {
    open(title, body, size = '') {
        const box = document.getElementById('modal-box');
        box.classList.toggle('modal-lg', size === 'lg');
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
