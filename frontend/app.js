// ==========================================================================
// ÍNDICE DEL CONTROLADOR FRONTEND (APP.JS) - EMME BEAUTY
// ==========================================================================
// 1. UTILIDADES GLOBALES Y SEGURIDAD (Login, Toasts, Confirmaciones)
// 2. INICIALIZACIÓN GLOBAL (Eventos de arranque de la SPA)
// 3. NAVEGACIÓN Y ROUTER (Menú Lateral y Cambio de Vistas)
// 4. MÓDULO DE TURNOS Y AGENDA (Diaria, Semanal y Validaciones)
// 5. MÓDULO DE COBROS Y CHECK-OUT (Señas, Extras, Descuentos)
// 6. MÓDULO DE CLIENTAS (CRM, Retención e Historial Estético)
// 7. MÓDULO DE EMPLEADAS (Liquidaciones, Saldos y Mis Pagos)
// 8. MÓDULO DE FINANZAS (Registro de Gastos e Ingresos manuales)
// 9. MÓDULO DE DASHBOARD Y MÉTRICAS (Gráficos)
// 10. MÓDULO DE CONFIGURACIÓN (Servicios, Áreas, Horarios, Pagos)
// 11. MÓDULO DE WHATSAPP BOT (Estado, QR y Envío de Mensajes)
// ==========================================================================

// ==========================================================================
// 1. UTILIDADES GLOBALES Y SEGURIDAD
// ==========================================================================

// --- Sistema de Notificaciones (Toasts) ---
function mostrarNotificacion(mensaje, tipo = 'success') {
    const contenedor = document.getElementById('toastContainer');
    if (!contenedor) return;

    const toast = document.createElement('div');
    toast.classList.add('toast', tipo);
    toast.textContent = mensaje;

    contenedor.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'deslizarDesaparecer 0.4s forwards';
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3500);
}

// --- Sistema de Confirmación Personalizado ---
function pedirConfirmacion(mensaje) {
    return new Promise((resolve) => {
        const modalConf = document.getElementById('modalConfirmacion');
        const textoConf = document.getElementById('textoConfirmacion');
        const btnAceptar = document.getElementById('btnAceptarConfirmacion');
        const btnCancelar = document.getElementById('btnCancelarConfirmacion');

        textoConf.textContent = mensaje;
        modalConf.classList.add('active');

        btnAceptar.onclick = () => {
            modalConf.classList.remove('active');
            resolve(true);
        };

        btnCancelar.onclick = () => {
            modalConf.classList.remove('active');
            resolve(false);
        };
    });
}

// --- Seguridad y Autenticación ---
async function iniciarSesion() {
    const inputUsuario = document.getElementById('loginUsuario').value.trim();
    const inputPassword = document.getElementById('loginPassword').value.trim();
    const btn = event.currentTarget;

    if (!inputUsuario || !inputPassword) {
        mostrarNotificacion("Completá todos los campos", "warning");
        return;
    }

    const textoOriginal = btn.textContent;
    btn.textContent = 'Verificando...';
    btn.style.opacity = '0.7';

    try {
        const respuesta = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Username: inputUsuario, Password: inputPassword })
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            localStorage.setItem('emme_token', datos.token);
            localStorage.setItem('emme_rol', datos.rol);
            
            mostrarNotificacion("¡Bienvenida al sistema!", "success");

            setTimeout(() => {
                window.location.reload();
            }, 800);

        } else {
            mostrarNotificacion(datos.error || "Error al iniciar sesión", "error");
        }
    } catch (error) {
        console.error("Error:", error);
        mostrarNotificacion("Error de conexión con el servidor", "error");
    } finally {
        btn.textContent = textoOriginal;
        btn.style.opacity = '1';
    }
}

function aplicarPermisos(rol) {
    console.log("Configurando interfaz para rol:", rol);

    const botonesMenu = document.querySelectorAll('.menu-item');
    const btnNuevoTurno = document.getElementById('btnNuevoTurno'); 

    if (rol === 'Empleada') {
        document.body.classList.add('is-empleada');
    } else {
        document.body.classList.remove('is-empleada');
    }

    botonesMenu.forEach(boton => {
        const textoMenu = boton.textContent.trim();
        if (rol === 'Empleada') {
            if (['Clientas', 'Gastos', 'Ingresos', 'Configuración', 'Empleados', 'Empleadas'].includes(textoMenu)) {
                boton.style.display = 'none';
            } else {
                boton.style.display = 'flex'; 
            }
        } else {
            if (textoMenu === 'Mis Pagos') {
                boton.style.display = 'none';
            } else {
                boton.style.display = 'flex';
            }
        }
    });

    if (rol === 'Empleada') {
        if (btnNuevoTurno) btnNuevoTurno.style.display = 'none';
    } else {
        if (btnNuevoTurno) btnNuevoTurno.style.display = 'block';
    }

    if (rol === 'Empleada') {
        const botonesTabs = document.querySelectorAll('.btn-tab');
        botonesTabs.forEach(btn => {
            const textoBoton = btn.textContent.trim();
            if (textoBoton === 'Agenda Diaria') {
                btn.style.display = 'none'; 
            }
            if (textoBoton === 'Agenda Semanal') {
                setTimeout(() => { btn.click(); }, 100);
            }
        });
    }
}

function cerrarSesion() {
    localStorage.removeItem('emme_token');
    localStorage.removeItem('emme_rol');
    localStorage.removeItem('emme_seccion_activa');
    window.location.reload(); 
}


// ==========================================================================
// 2. INICIALIZACIÓN GLOBAL (Motor de arranque)
// ==========================================================================

window.addEventListener('DOMContentLoaded', () => {
    // 2.1. CHEQUEO DE SEGURIDAD
    const token = localStorage.getItem('emme_token');
    const rol = localStorage.getItem('emme_rol');
    const pantallaLogin = document.getElementById('pantallaLogin');

    if (!token || !rol) {
        pantallaLogin.style.display = 'flex';
        pantallaLogin.style.opacity = '1';
    } else {
        pantallaLogin.style.display = 'none';
        aplicarPermisos(rol);
        
        // 2.2. CARGA DE DATOS BASE
        cargarClientas();
        cargarEmpleadas();
        cargarServicios();
        cargarCategoriasGasto();
        cargarExtrasDisponibles();
        cargarMediosDePago();
        cargarDatosDashboard();

        // 2.3. INICIALIZACIÓN DE CALENDARIOS (Agenda)
        inicializarFechaAgenda();
        if (rol === 'Empleada') {
            inicializarAgendaSemanal();
        } else {
            inicializarAgendaDiaria();
        }
        
        // 2.4. INICIALIZACIÓN DE FILTROS FLATPICKR (Rango de Fechas)
        const inputRango = document.getElementById('rangoFechasCustomDash');
        if (inputRango) {
            flatpickr(inputRango, {
                mode: "range", locale: "es", dateFormat: "Y-m-d", 
                onChange: function(selectedDates) {
                    if (selectedDates.length === 2) {
                        const desde = formatoFechaSQL(selectedDates[0]);
                        const hasta = formatoFechaSQL(selectedDates[1]);
                        cargarDatosDashboard(desde, hasta); 
                    }
                }
            });
        }

        const inputRangoCobros = document.getElementById('rangoFechaCobros');
        if (inputRangoCobros) {
            flatpickr(inputRangoCobros, {
                mode: "range", locale: "es", dateFormat: "Y-m-d",
                onChange: function(selectedDates) {
                    if (selectedDates.length === 2 || selectedDates.length === 0) {
                        aplicarFiltrosCobros();
                    }
                }
            });
        }

        const inputRangoGastos = document.getElementById('rangoFechaGastos');
        if (inputRangoGastos) {
            flatpickr(inputRangoGastos, {
                mode: "range", locale: "es", dateFormat: "Y-m-d",
                onChange: function(selectedDates) {
                    if (selectedDates.length === 2) aplicarFiltrosGastos();
                }
            });
        }

        const inputRangoIngresos = document.getElementById('rangoFechaIngresos');
        if (inputRangoIngresos) {
            flatpickr(inputRangoIngresos, {
                mode: "range", locale: "es", dateFormat: "Y-m-d",
                onChange: function(selectedDates) {
                    if (selectedDates.length === 2) filtrarIngresos(); 
                }
            });
        }

        // Lógica del desplegable rápido del Dashboard
        const selectFiltroDash = document.getElementById('filtroRapidoDash');
        if (selectFiltroDash) {
            selectFiltroDash.addEventListener('change', (e) => {
                if (e.target.value === 'personalizado') {
                    inputRango.style.display = 'block';
                } else {
                    inputRango.style.display = 'none';
                    cargarDatosDashboard(); 
                }
            });
        }

        // 2.5. RESTAURAR ÚLTIMA SECCIÓN VISITADA
        const seccionGuardada = localStorage.getItem('emme_seccion_activa');
        const botonesMenu = document.querySelectorAll('.menu-item'); 
        
        if (seccionGuardada) {
            const botonSeleccionado = Array.from(botonesMenu).find(b => b.textContent.trim() === seccionGuardada);
            if (botonSeleccionado) {
                botonSeleccionado.click();
            } else if (botonesMenu.length > 0) {
                botonesMenu[0].click(); 
            }
        } else if (botonesMenu.length > 0) {
            botonesMenu[0].click();
        }
    }
});

// Inicialización de FullCalendar (Alternativa de Agenda Visual)
document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendario');
    if (calendarEl) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
            slotMinTime: '09:30:00', slotMaxTime: '21:30:00', allDaySlot: false, 
            events: 'http://localhost:3000/api/turnos', eventColor: 'var(--mostaza)'
        });
        calendar.render();
    }
});

// Inicialización del Menú Hamburguesa (Mobile)
document.addEventListener('DOMContentLoaded', () => {
    const btnMenu = document.getElementById('btnToggleMenu');
    const sidebar = document.getElementById('sidebar');

    if (btnMenu && sidebar) {
        btnMenu.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('mobile-open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }
});


// ==========================================================================
// 3. NAVEGACIÓN Y ROUTER (Control de Vistas)
// ==========================================================================

const botonesMenu = document.querySelectorAll('.menu-item');
const seccionTurnos = document.getElementById('seccionTurnos');
const seccionClientas = document.getElementById('seccionClientas');
const seccionEmpleados = document.getElementById('seccionEmpleados');
const seccionGastos = document.getElementById('seccionGastos');
const seccionIngresos = document.getElementById('seccionIngresos');
const seccionResumenes = document.getElementById('seccionResumenes');
const seccionConfiguracion = document.getElementById('seccionConfiguracion');

const tituloHeader = document.querySelector('.header h1');
const btnNuevoTurno = document.getElementById('btnNuevoTurno');
const btnNuevaClienta = document.getElementById('btnNuevaClienta');
const buscadorClientas = document.getElementById('buscadorClientas');
const buscadorEmpleadas = document.getElementById('buscadorEmpleadas');
const btnNuevaEmpleada = document.getElementById('btnNuevaEmpleada');
const btnNuevoGasto = document.getElementById('btnNuevoGasto');
const btnNuevoIngreso = document.getElementById('btnNuevoIngreso');

const rutas = {
    '/': 'seccionTurnos',
    '/turnos': 'seccionTurnos',
    '/clientas': 'seccionClientas',
    '/empleados': 'seccionEmpleados',
    '/gastos': 'seccionGastos',
    '/ingresos': 'seccionIngresos',
    '/resumenes': 'seccionResumenes',
    '/configuracion': 'seccionConfiguracion',
    '/mis-pagos': 'seccion-mis-pagos'
};

function router() {
    let path = window.location.pathname.replace('/frontend/index.html', '') || '/';
    if (path === '') path = '/';

    let idSeccion = rutas[path] || 'seccionTurnos';
    if (path === '/mis-pagos') idSeccion = 'seccion-mis-pagos';

    const todasLasSecciones = [
        'seccionTurnos', 'seccionClientas', 'seccionEmpleados', 
        'seccionGastos', 'seccionIngresos', 'seccionResumenes', 'seccionConfiguracion',
        'seccion-mis-pagos' 
    ];
    
    todasLasSecciones.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.style.display = 'none';
    });

    const seccionActiva = document.getElementById(idSeccion);
    if (seccionActiva) seccionActiva.style.display = 'block';

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-link') === path) {
            item.classList.add('active');
        }
    });

    actualizarCabecera(path);

    if (path === '/mis-pagos') {
        cargarMisPagos();
    }
}

function actualizarCabecera(ruta) {
    const tituloHeader = document.querySelector('.header h1');
    
    document.getElementById('buscadorClientas').style.display = 'none';
    document.getElementById('buscadorEmpleadas').style.display = 'none';
    document.getElementById('btnNuevaClienta').style.display = 'none';
    document.getElementById('btnNuevoTurno').style.display = 'none';
    document.getElementById('btnNuevaEmpleada').style.display = 'none';
    document.getElementById('btnNuevoGasto').style.display = 'none';
    document.getElementById('btnNuevoIngreso').style.display = 'none';

    switch (ruta) {
        case '/':
        case '/turnos':
            if (tituloHeader) tituloHeader.textContent = 'Gestión de Turnos';
            document.getElementById('btnNuevoTurno').style.display = 'block';
            break;
        case '/clientas':
            if (tituloHeader) tituloHeader.textContent = 'Gestión de Clientas';
            document.getElementById('buscadorClientas').style.display = 'block';
            document.getElementById('btnNuevaClienta').style.display = 'block';
            break;
        case '/empleados':
            if (tituloHeader) tituloHeader.textContent = 'Gestión de Profesionales';
            document.getElementById('buscadorEmpleadas').style.display = 'block';
            document.getElementById('btnNuevaEmpleada').style.display = 'block';
            break;
        case '/gastos':
            if (tituloHeader) tituloHeader.textContent = 'Gestión de Gastos';
            document.getElementById('btnNuevoGasto').style.display = 'block';
            break;
        case '/ingresos':
            if (tituloHeader) tituloHeader.textContent = 'Gestión de Ingresos';
            document.getElementById('btnNuevoIngreso').style.display = 'block';
            break;
        case '/resumenes':
            if (tituloHeader) tituloHeader.textContent = 'Panel de Control';
            break;
        case '/configuracion':
            if (tituloHeader) tituloHeader.textContent = 'Configuración del Sistema';
            break;
        case '/mis-pagos':
            if (tituloHeader) tituloHeader.textContent = 'Mis Pagos y Liquidaciones';
            break;
    }
}

botonesMenu.forEach(boton => {
    boton.addEventListener('click', () => {
        botonesMenu.forEach(b => b.classList.remove('active'));
        boton.classList.add('active');

        seccionTurnos.style.display = 'none';
        seccionClientas.style.display = 'none';
        seccionEmpleados.style.display = 'none';
        seccionGastos.style.display = 'none';
        if(seccionIngresos) seccionIngresos.style.display = 'none';
        if(seccionResumenes) seccionResumenes.style.display = 'none';
        if(seccionConfiguracion) seccionConfiguracion.style.display = 'none';
        
        const seccionMisPagos = document.getElementById('seccion-mis-pagos');
        if(seccionMisPagos) seccionMisPagos.style.display = 'none';

        btnNuevoTurno.style.display = 'none';
        btnNuevaClienta.style.display = 'none';
        btnNuevaEmpleada.style.display = 'none';
        btnNuevoGasto.style.display = 'none';
        buscadorClientas.style.display = 'none';
        if (btnNuevoIngreso) btnNuevoIngreso.style.display = 'none';
        if (buscadorEmpleadas) buscadorEmpleadas.style.display = 'none'; 

        const opcionSeleccionada = boton.textContent.trim();
        localStorage.setItem('emme_seccion_activa', opcionSeleccionada);

        if (opcionSeleccionada === 'Turnos') {
            seccionTurnos.style.display = 'block';
            tituloHeader.textContent = 'Gestión de Turnos';
            btnNuevoTurno.style.display = 'block'; 

        } else if (opcionSeleccionada === 'Clientas') {
            seccionClientas.style.display = 'block';
            tituloHeader.textContent = 'Gestión de Clientas';
            btnNuevaClienta.style.display = 'block'; 
            buscadorClientas.style.display = 'block'; 
            cargarClientas();

        } else if (opcionSeleccionada === 'Empleados') {
            seccionEmpleados.style.display = 'block';
            tituloHeader.textContent = 'Gestión de Empleados';
            btnNuevaEmpleada.style.display = 'block'; 
            if (buscadorEmpleadas) buscadorEmpleadas.style.display = 'block';
            cargarEmpleadas();

        } else if (opcionSeleccionada === 'Gastos') {
            seccionGastos.style.display = 'block';
            tituloHeader.textContent = 'Gestión de Gastos';
            btnNuevoGasto.style.display = 'block'; 
            cargarGastos(); 
            
        } else if (opcionSeleccionada === 'Ingresos') {
            if(seccionIngresos) seccionIngresos.style.display = 'block';
            tituloHeader.textContent = 'Gestión de Ingresos';
            if (btnNuevoIngreso) btnNuevoIngreso.style.display = 'block'; 
            cargarIngresos();
            
        } else if (opcionSeleccionada === 'Resúmenes') {
            if(seccionResumenes) seccionResumenes.style.display = 'block';
            tituloHeader.textContent = 'Panel de Control';
            
        } else if (opcionSeleccionada === 'Configuración') {
            if(seccionConfiguracion) seccionConfiguracion.style.display = 'block';
            tituloHeader.textContent = 'Configuración General';
            cargarTablaConfigCategorias();
            
        } else if (opcionSeleccionada === 'Mis Pagos') {
            if(seccionMisPagos) seccionMisPagos.style.display = 'block';
            tituloHeader.textContent = 'Mis Pagos y Liquidaciones';
            cargarMisPagos(); 
        }
    });
});


// ==========================================================================
// 4. MÓDULO DE TURNOS Y AGENDA
// ==========================================================================

let listaServiciosGlobal = [];
let empleadasAgendaGlobal = [];
let horariosAgendaGlobal = [];
let filtroAgendaActual = 'Todo';

const modalTurno = document.getElementById('modalNuevoTurno');
const btnNuevaExpress = document.getElementById('btnNuevaClientaExpress');
const btnCancelarExpress = document.getElementById('btnCancelarExpress');
const grupoSeleccion = document.getElementById('grupoSeleccionClienta');
const grupoExpress = document.getElementById('grupoClientaExpress');
const inputNombreExpress = document.getElementById('nombreExpress');
const inputApellidoExpress = document.getElementById('apellidoExpress');
const inputFechaTurno = document.getElementById('fechaTurnoInput');

if (modalTurno) {
    modalTurno.addEventListener('click', function(e) {
        if(e.target === modalTurno) cerrarModalTurno();
    });
}

if (inputFechaTurno) {
    const hoy = new Date().toISOString().split('T')[0];
    inputFechaTurno.setAttribute('min', hoy);
}

if (btnNuevaExpress) {
    btnNuevaExpress.addEventListener('click', () => {
        grupoSeleccion.style.display = 'none';
        grupoExpress.style.display = 'block'; 
    });
}

if (btnCancelarExpress) {
    btnCancelarExpress.addEventListener('click', () => {
        grupoExpress.style.display = 'none';  
        grupoSeleccion.style.display = 'block';
        inputNombreExpress.value = '';
        inputApellidoExpress.value = '';
    });
}

function abrirModalTurno() {
    document.getElementById('modalNuevoTurno').querySelector('h2').textContent = 'Agendar Nuevo Turno';
    document.getElementById('idTurnoAEditarOculto').value = '';
    document.getElementById('btnNuevaClientaExpress').style.display = 'block';
    document.getElementById('selectClientaTurno').disabled = false;
    document.getElementById('inputBuscarClientaTurno').disabled = false;
    document.getElementById('inputBuscarClientaTurno').value = '';
    document.getElementById('senaTurnoInput').disabled = false;
    document.getElementById('modalNuevoTurno').classList.add('active');
}

function cerrarModalTurno() {
    if (modalTurno) modalTurno.classList.remove('active');
}

async function abrirEdicionTurno() {
    const idTurno = document.getElementById('idTurnoCobroOculto').value;
    if (!idTurno) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/turnos/${idTurno}`);
        if (!respuesta.ok) throw new Error("No se pudo traer el turno");
        const turno = await respuesta.json();

        cerrarModalDetalleTurno();
        
        document.getElementById('modalNuevoTurno').querySelector('h2').textContent = 'Editar Turno';
        document.getElementById('idTurnoAEditarOculto').value = turno.Id_Turno;

        document.getElementById('selectClientaTurno').value = turno.Id_Clienta;
        document.getElementById('inputBuscarClientaTurno').value = turno.NombreClienta;
        document.getElementById('inputBuscarClientaTurno').disabled = true;
        document.getElementById('btnNuevaClientaExpress').style.display = 'none';
        document.getElementById('senaTurnoInput').disabled = true;

        const fechaObj = new Date(turno.Fecha_Hora);
        document.getElementById('fechaTurnoInput').value = formatoFechaSQL(fechaObj);
        document.getElementById('horaTurnoInput').value = `${String(fechaObj.getHours()).padStart(2, '0')}:${String(fechaObj.getMinutes()).padStart(2, '0')}`;

        document.getElementById('areaTurno').value = turno.Id_Area;
        filtrarServiciosPorAreaEnModal(); 
        
        document.getElementById('servicioTurno').value = turno.Id_Servicio;
        await filtrarProfesionalesPorServicio(); 
        
        document.getElementById('empleadaTurno').value = turno.Id_Empleada;

        document.getElementById('modalNuevoTurno').classList.add('active');
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error al abrir la edición", "error");
    }
}

async function cargarServicios() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/servicios');
        listaServiciosGlobal = await respuesta.json(); 
        await cargarAreasEnModalTurno();
    } catch (error) {
        console.error("Error conectando con la API de servicios:", error);
    }
}

async function cargarAreasEnModalTurno() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/areas');
        const areas = await respuesta.json();
        
        const selectArea = document.getElementById('areaTurno');
        if (selectArea) {
            selectArea.innerHTML = '<option value="">Seleccione un área...</option>';
            areas.forEach(area => {
                const opcion = document.createElement('option');
                opcion.value = area.Id_Area;
                opcion.textContent = area.Nombre || area.Nombre_Area || area.Area || area.Descripcion || "Área sin nombre"; 
                selectArea.appendChild(opcion);
            });
        }
    } catch (error) {
        console.error("Error cargando áreas:", error);
    }
}

function filtrarServiciosPorAreaEnModal() {
    const idAreaSeleccionada = document.getElementById('areaTurno').value;
    const selectServicio = document.getElementById('servicioTurno');
    const selectEmpleada = document.getElementById('empleadaTurno');
    
    selectServicio.innerHTML = '<option value="">Seleccione un servicio...</option>';
    selectEmpleada.innerHTML = '<option value="">Primero elija un servicio...</option>';
    
    selectEmpleada.disabled = true;
    selectEmpleada.style.backgroundColor = '#f8f9fa';

    if (!idAreaSeleccionada) {
        selectServicio.disabled = true;
        selectServicio.style.backgroundColor = '#f8f9fa';
        return;
    }

    const serviciosFiltrados = listaServiciosGlobal.filter(s => s.Id_Area == idAreaSeleccionada);

    serviciosFiltrados.forEach(servicio => {
        const opcion = document.createElement('option');
        opcion.value = servicio.Id_Servicio;
        opcion.textContent = servicio.Nombre;
        selectServicio.appendChild(opcion);
    });

    selectServicio.disabled = false;
    selectServicio.style.backgroundColor = 'white';
}

async function filtrarProfesionalesPorServicio() {
    const idServicio = document.getElementById('servicioTurno').value;
    const selectEmpleada = document.getElementById('empleadaTurno');
    
    if (!idServicio) {
        selectEmpleada.innerHTML = '<option value="">Elegí el servicio primero...</option>';
        selectEmpleada.disabled = true;
        selectEmpleada.style.backgroundColor = "#f8f9fa";
        return;
    }

    try {
        const respuesta = await fetch(`http://localhost:3000/api/empleadas/servicio/${idServicio}`);
        const empleadasHabilitadas = await respuesta.json();
        
        selectEmpleada.innerHTML = '<option value="">Seleccioná a la profesional...</option>';
        
        if (empleadasHabilitadas.length === 0) {
            selectEmpleada.innerHTML = '<option value="">Ninguna profesional habilitada</option>';
            selectEmpleada.disabled = true;
            return;
        }

        empleadasHabilitadas.forEach(emp => {
            const opcion = document.createElement('option');
            opcion.value = emp.Id_Empleada;
            opcion.textContent = `${emp.Nombre} ${emp.Apellido}`;
            selectEmpleada.appendChild(opcion);
        });
        
        selectEmpleada.disabled = false;
        selectEmpleada.style.backgroundColor = "#ffffff";
        
    } catch (error) {
        console.error("Error al buscar profesionales:", error);
    }
}

async function guardarTurno() {
    let idClientaFinal;
    const grupoExpress = document.getElementById('grupoClientaExpress');

    if (grupoExpress && (grupoExpress.style.display === 'block' || grupoExpress.style.display === '')) {
        const inputNombreExpress = document.getElementById('nombreExpress');
        const inputApellidoExpress = document.getElementById('apellidoExpress');
        
        const nombreExp = inputNombreExpress ? inputNombreExpress.value.trim() : '';
        const apellidoExp = inputApellidoExpress ? inputApellidoExpress.value.trim() : '';
        
        if (!nombreExp || !apellidoExp) {
            mostrarNotificacion("Por favor, completá nombre y apellido de la nueva clienta.", "warning");
            return; 
        }
        
        try {
            const respuestaClienta = await fetch('http://localhost:3000/api/clientas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Nombre: nombreExp, Apellido: apellidoExp, Telefono: "", Email: "" })
            });

            if (respuestaClienta.ok) {
                const dataClienta = await respuestaClienta.json();
                idClientaFinal = dataClienta.id || dataClienta.Id_Clienta; 
            } else {
                mostrarNotificacion("Hubo un error al registrar la clienta nueva.", "error");
                return;
            }
        } catch (error) {
            console.error("Error creando clienta:", error);
            mostrarNotificacion("No se pudo conectar con el servidor.", "error");
            return;
        }
    } else {
        const selectClienta = document.getElementById('selectClientaTurno');
        idClientaFinal = selectClienta ? selectClienta.value : null;
        if (!idClientaFinal) {
            mostrarNotificacion("Por favor, seleccioná una clienta de la lista.", "warning");
            return;
        }
    }

    const idServicio = document.getElementById('servicioTurno').value;
    const idEmpleada = document.getElementById('empleadaTurno').value;
    const fecha = document.getElementById('fechaTurnoInput').value;
    const hora = document.getElementById('horaTurnoInput').value;

    if (!idClientaFinal || !idEmpleada || !idServicio || !fecha || !hora) {
        mostrarNotificacion("¡Por favor completá todos los campos para agendar el turno!", "warning");
        return;
    }

    try {
        const resHorarios = await fetch('http://localhost:3000/api/horarios');
        const horariosVal = await resHorarios.json();
        
        const idDia = obtenerIdDiaSemana(fecha);
        const horarioDiaElegido = horariosVal.find(h => h.Id_Horario === idDia);

        if (!horarioDiaElegido || !horarioDiaElegido.Laborable) {
            mostrarNotificacion("El local se encuentra cerrado el día seleccionado.", "warning");
            return; 
        }

        const ap1 = limpiarHoraSQL(horarioDiaElegido.Hora_Apertura_1);
        const ci1 = limpiarHoraSQL(horarioDiaElegido.Hora_Cierre_1);
        const ap2 = limpiarHoraSQL(horarioDiaElegido.Hora_Apertura_2);
        const ci2 = limpiarHoraSQL(horarioDiaElegido.Hora_Cierre_2);

        const [hTurno, mTurno] = hora.split(':').map(Number);
        const minTurno = hTurno * 60 + mTurno;

        let enTurno1 = false;
        let enTurno2 = false;

        if (ap1 && ci1) {
            const minAp1 = parseInt(ap1.split(':')[0]) * 60 + parseInt(ap1.split(':')[1]);
            const minCi1 = parseInt(ci1.split(':')[0]) * 60 + parseInt(ci1.split(':')[1]);
            if (minTurno >= minAp1 && minTurno < minCi1) enTurno1 = true;
        }

        if (ap2 && ci2) {
            const minAp2 = parseInt(ap2.split(':')[0]) * 60 + parseInt(ap2.split(':')[1]);
            const minCi2 = parseInt(ci2.split(':')[0]) * 60 + parseInt(ci2.split(':')[1]);
            if (minTurno >= minAp2 && minTurno < minCi2) enTurno2 = true;
        }

        if (!enTurno1 && !enTurno2) {
            mostrarNotificacion("El horario seleccionado está fuera de la franja de atención de este día.", "warning");
            return; 
        }
    } catch (err) {
        console.error("Error al validar horarios dinámicos:", err);
    }

    const idAEditar = document.getElementById('idTurnoAEditarOculto').value;
    const inputSenaTurno = document.getElementById('senaTurnoInput');
    const montoSena = inputSenaTurno && inputSenaTurno.value ? parseFloat(inputSenaTurno.value) : 0;

    const fechaHoraCompleta = `${fecha}T${hora}:00`;
    
    const datosFinales = idAEditar ? {
        Id_Servicio: parseInt(idServicio),
        Id_Empleada: parseInt(idEmpleada),
        Fecha_Hora: fechaHoraCompleta
    } : {
        Id_Clienta: parseInt(idClientaFinal), 
        Id_Empleada: parseInt(idEmpleada),
        Id_Servicio: parseInt(idServicio),
        Fecha_Hora: fechaHoraCompleta,
        Sena_Monto: montoSena 
    };

    const url = idAEditar ? `http://localhost:3000/api/turnos/${idAEditar}` : 'http://localhost:3000/api/turnos';
    const metodo = idAEditar ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosFinales)
        });

        if (respuesta.ok) {
            mostrarNotificacion(idAEditar ? "Turno modificado con éxito." : "Turno agendado con éxito.", "success");
            cerrarModalTurno();
            setTimeout(() => { location.reload(); }, 1200);
        } else {
            const mensajeError = await respuesta.text();
            mostrarNotificacion(`Error: ${mensajeError}`, "error");
        }
    } catch (error) {
        console.error("Error enviando el turno:", error);
        mostrarNotificacion("No se pudo conectar con el servidor.", "error");
    }
}

function agendarTurnoRapido(idClienta, nombre, apellido) {
    const grupoSeleccion = document.getElementById('grupoSeleccionClienta');
    const grupoExpress = document.getElementById('grupoClientaExpress');
    
    if (grupoSeleccion && grupoExpress) {
        grupoExpress.style.display = 'none';
        grupoSeleccion.style.display = 'block';
    }

    const inputOculto = document.getElementById('selectClientaTurno');
    const inputBuscar = document.getElementById('inputBuscarClientaTurno');
    if (inputOculto && inputBuscar) {
        inputOculto.value = idClienta;
        inputBuscar.value = nombre + (apellido ? ' ' + apellido : '');
    }

    abrirModalTurno();
}

async function cargarBotonesAreasAgenda() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/areas');
        const areas = await respuesta.json();
        const contenedorFiltros = document.getElementById('filtrosEspecialidad');
        
        if (!contenedorFiltros) return;

        areas.forEach(area => {
            const nombreArea = area.Nombre || area.Nombre_Area || area.Area || "Área sin nombre";
            
            const boton = document.createElement('button');
            boton.className = 'btn-secundario filtro-btn';
            boton.style.cssText = 'border-radius: 20px; background: white; border: 1px solid #ccc; padding: 6px 15px; cursor: pointer;';
            boton.textContent = nombreArea;
            
            boton.onclick = function() { 
                filtrarAgendaPorArea(nombreArea, this); 
            };
            
            contenedorFiltros.appendChild(boton);
        });
    } catch (error) {
        console.error("Error cargando los botones de áreas:", error);
    }
}

function obtenerIdDiaSemana(fechaStr) {
    const [y, m, d] = fechaStr.split('-');
    const fecha = new Date(y, m - 1, d);
    let diaJS = fecha.getDay(); 
    return diaJS === 0 ? 7 : diaJS; 
}

function generarBloques(apertura, cierre) {
    if (!apertura || !cierre) return [];
    let bloques = [];
    let [hAp, mAp] = apertura.split(':').map(Number);
    let [hCi, mCi] = cierre.split(':').map(Number);
    
    let minActual = hAp * 60 + mAp;
    let minCierre = hCi * 60 + mCi;

    while (minActual < minCierre) {
        let h = Math.floor(minActual / 60).toString().padStart(2, '0');
        let m = (minActual % 60).toString().padStart(2, '0');
        bloques.push(`${h}:${m}`);
        minActual += 30; 
    }
    return bloques;
}

async function inicializarAgendaDiaria() {
    try {
        await cargarBotonesAreasAgenda();
        const resEmp = await fetch('http://localhost:3000/api/empleadas');
        empleadasAgendaGlobal = await resEmp.json();

        const resHor = await fetch('http://localhost:3000/api/horarios');
        horariosAgendaGlobal = await resHor.json();

        const agendaHeader = document.getElementById('agendaHeader');
        if (agendaHeader) {
            agendaHeader.innerHTML = '<div class="hora-col">Hora</div>';
            empleadasAgendaGlobal.forEach(emp => {
                agendaHeader.innerHTML += `<div class="col-emp-${emp.Id_Empleada}" data-areas="${emp.Areas || ''}" style="font-weight: 600; color: #333;">${emp.Nombre_Ap}</div>`;
            });
        }

        const inputFecha = document.getElementById('fechaAgendaInput');
        const btnAnterior = document.getElementById('btnDiaAnterior');
        const btnSiguiente = document.getElementById('btnDiaSiguiente');

        if (inputFecha) {
            inputFecha.addEventListener('change', actualizarGrillaDiaria);
            
            if (btnAnterior) {
                const newBtnAnterior = btnAnterior.cloneNode(true);
                btnAnterior.parentNode.replaceChild(newBtnAnterior, btnAnterior);
                newBtnAnterior.addEventListener('click', () => {
                    const fechaActual = new Date(inputFecha.value + 'T00:00:00');
                    fechaActual.setDate(fechaActual.getDate() - 1);
                    const yyyy = fechaActual.getFullYear();
                    const mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
                    const dd = String(fechaActual.getDate()).padStart(2, '0');
                    inputFecha.value = `${yyyy}-${mm}-${dd}`;
                    actualizarGrillaDiaria(); 
                });
            }

            if (btnSiguiente) {
                const newBtnSiguiente = btnSiguiente.cloneNode(true);
                btnSiguiente.parentNode.replaceChild(newBtnSiguiente, btnSiguiente);
                newBtnSiguiente.addEventListener('click', () => {
                    const fechaActual = new Date(inputFecha.value + 'T00:00:00');
                    fechaActual.setDate(fechaActual.getDate() + 1);
                    const yyyy = fechaActual.getFullYear();
                    const mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
                    const dd = String(fechaActual.getDate()).padStart(2, '0');
                    inputFecha.value = `${yyyy}-${mm}-${dd}`;
                    actualizarGrillaDiaria(); 
                });
            }
        }

        actualizarGrillaDiaria();
    } catch (error) {
        console.error("Error al cargar la agenda diaria:", error);
    }
}

function enfocarHoraActual() {
    const ahora = new Date();
    let hora = ahora.getHours();
    let minutos = ahora.getMinutes();

    const minStr = minutos < 30 ? '00' : '30';
    const horaStr = `${String(hora).padStart(2, '0')}:${minStr}`;

    const vistaDiaria = document.getElementById('vistaDiaria');
    if (vistaDiaria && vistaDiaria.style.display !== 'none') {
        const contenedorDiario = document.querySelector('#vistaDiaria .agenda-container');
        const filasDiarias = document.querySelectorAll('#agendaBody .agenda-row');
        
        for (let fila of filasDiarias) {
            const colHora = fila.querySelector('.hora-col');
            if (colHora && colHora.textContent.trim() === horaStr) {
                contenedorDiario.scrollTo({ top: fila.offsetTop - 50, behavior: 'smooth' });
                fila.style.backgroundColor = '#fffaf0';
                fila.style.borderLeft = '3px solid var(--mostaza)';
                break;
            }
        }
    }

    const vistaSemanal = document.getElementById('vistaSemanal');
    if (vistaSemanal && vistaSemanal.style.display !== 'none') {
        const contenedorSemanal = document.querySelector('#vistaSemanal .agenda-container');
        const filasSemanales = document.querySelectorAll('#agendaSemanalBody > div'); 
        
        for (let fila of filasSemanales) {
            const colHora = fila.querySelector('.hora-col');
            if (colHora && colHora.textContent.trim() === horaStr) {
                contenedorSemanal.scrollTo({ top: fila.offsetTop - 50, behavior: 'smooth' });
                fila.style.backgroundColor = '#fffaf0'; 
                break;
            }
        }
    }
}

async function actualizarGrillaDiaria() {
    const inputFecha = document.getElementById('fechaAgendaInput');
    if (!inputFecha || !inputFecha.value) return;

    const idDia = obtenerIdDiaSemana(inputFecha.value);
    const horarioHoy = horariosAgendaGlobal.find(h => h.Id_Horario === idDia);

    const agendaBody = document.getElementById('agendaBody');
    if (!agendaBody) return;
    agendaBody.innerHTML = ''; 

    if (!horarioHoy || !horarioHoy.Laborable) {
        agendaBody.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: #dc3545; background: #fff8f8; border-radius: 8px; width: 100%; border: 1px dashed #f5c6cb;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">LOCAL CERRADO ESTE DÍA</span>
            </div>
        `;
        return;
    }

    let ap1 = limpiarHoraSQL(horarioHoy.Hora_Apertura_1);
    let ci1 = limpiarHoraSQL(horarioHoy.Hora_Cierre_1);
    let ap2 = limpiarHoraSQL(horarioHoy.Hora_Apertura_2);
    let ci2 = limpiarHoraSQL(horarioHoy.Hora_Cierre_2);

    let bloques = [
        ...generarBloques(ap1, ci1),
        ...generarBloques(ap2, ci2)
    ];

    let ultimoMinuto = -1;

    bloques.forEach(horaStr => {
        let [h, m] = horaStr.split(':').map(Number);
        let minActual = h * 60 + m;

        if (ultimoMinuto !== -1 && (minActual - ultimoMinuto) > 30) {
            let divSiesta = document.createElement('div');
            divSiesta.style.padding = '20px';
            divSiesta.style.backgroundColor = '#fcfcfc';
            divSiesta.style.textAlign = 'center';
            divSiesta.style.color = '#aaa';
            divSiesta.style.fontSize = '12px';
            divSiesta.style.fontStyle = 'italic';
            divSiesta.style.borderBottom = '1px solid #eee';
            divSiesta.style.width = '100%';
            divSiesta.style.display = 'block'; 
            divSiesta.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>Horario de corte / Descanso</span>
                </div>
            `;
            agendaBody.appendChild(divSiesta);
        }
        ultimoMinuto = minActual;

        let fila = document.createElement('div');
        fila.className = m === 0 ? 'agenda-row hora-en-punto' : 'agenda-row';
        
        let htmlFila = `<div class="hora-col">${horaStr}</div>`;
        
        empleadasAgendaGlobal.forEach(emp => {
            htmlFila += `<div class="agenda-celda col-emp-${emp.Id_Empleada}" data-hora="${horaStr}" data-id-empleada="${emp.Id_Empleada}"></div>`;
        });
        
        fila.innerHTML = htmlFila;
        agendaBody.appendChild(fila);
    });

    await cargarTurnosAgenda();

    const fechaHoy = new Date().toISOString().split('T')[0];
    if (inputFecha.value === fechaHoy) {
        setTimeout(enfocarHoraActual, 100); 
    }
}

function filtrarAgendaPorArea(areaSeleccionada, btnPulsado) {
    filtroAgendaActual = areaSeleccionada;

    if (btnPulsado) {
        const botones = document.querySelectorAll('#filtrosEspecialidad .filtro-btn');
        botones.forEach(b => {
            b.style.background = 'white';
            b.style.border = '1px solid #ccc';
            b.style.color = '#333';
        });
        
        btnPulsado.style.background = 'var(--mostaza, #d4af37)'; 
        btnPulsado.style.border = '1px solid var(--mostaza, #d4af37)';
        btnPulsado.style.color = 'white';
    }

    if (typeof empleadasAgendaGlobal !== 'undefined') {
        empleadasAgendaGlobal.forEach(emp => {
            const areasDeLaEmpleada = (emp.Areas || '').toLowerCase();
            const areaBuscada = areaSeleccionada.toLowerCase();
            
            const debeMostrar = (areaSeleccionada === 'Todo' || areasDeLaEmpleada.includes(areaBuscada));

            const celdas = document.querySelectorAll(`.col-emp-${emp.Id_Empleada}`);
            
            celdas.forEach(celda => {
                celda.style.display = debeMostrar ? '' : 'none';
            });
        });
    }
}

function inicializarFechaAgenda() {
    const inputFecha = document.getElementById('fechaAgendaInput');
    if (inputFecha) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        
        inputFecha.value = `${yyyy}-${mm}-${dd}`;
    }
}

function cambiarVistaAgenda(vista) {
    const vistaDiaria = document.getElementById('vistaDiaria');
    const vistaSemanal = document.getElementById('vistaSemanal');
    const btnDiaria = document.getElementById('btnVistaDiaria');
    const btnSemanal = document.getElementById('btnVistaSemanal');
    const filtros = document.getElementById('filtrosEspecialidad'); 

    if (vista === 'diaria') {
        vistaDiaria.style.display = 'block';
        vistaSemanal.style.display = 'none';
        btnDiaria.classList.add('active');
        btnSemanal.classList.remove('active');
        
        filtros.style.display = 'flex'; 
    } else if (vista === 'semanal') {
        vistaDiaria.style.display = 'none';
        vistaSemanal.style.display = 'block';
        btnSemanal.classList.add('active');
        btnDiaria.classList.remove('active');
        
        filtros.style.display = 'none'; 
        
        inicializarAgendaSemanal();
        cargarTurnosSemana();
        setTimeout(enfocarHoraActual, 100);
    }
}

async function cargarTurnosSemana() {
    const inputFecha = document.getElementById('fechaAgendaInput');
    if (!inputFecha || !inputFecha.value) return;

    const rolUsuario = localStorage.getItem('emme_rol');
    const token = localStorage.getItem('emme_token');
    let idEmpleadaLogueada = null;
    
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            idEmpleadaLogueada = payload.idEmpleada;
        } catch (e) {
            console.error("Error leyendo token:", e);
        }
    }

    try {
        const [año, mes, dia] = inputFecha.value.split('-');
        const fechaElegida = new Date(año, mes - 1, dia);
        
        const diaSemanaActual = fechaElegida.getDay() || 7; 
        const fechaLunes = new Date(fechaElegida);
        fechaLunes.setDate(fechaElegida.getDate() - diaSemanaActual + 1);

        document.querySelectorAll('.celda-semanal').forEach(celda => {
            celda.innerHTML = '';
            celda.turnosAgrupados = []; 
        });

        let todosLosTurnos = [];
        for (let i = 0; i < 6; i++) { 
            const fechaDia = new Date(fechaLunes);
            fechaDia.setDate(fechaLunes.getDate() + i);
            
            const fAño = fechaDia.getFullYear();
            const fMes = String(fechaDia.getMonth() + 1).padStart(2, '0');
            const fDia = String(fechaDia.getDate()).padStart(2, '0');
            const fechaStr = `${fAño}-${fMes}-${fDia}`;

            const respuesta = await fetch(`http://localhost:3000/api/turnos/fecha/${fechaStr}`);
            if (respuesta.ok) {
                const turnosDia = await respuesta.json();
                todosLosTurnos.push(...turnosDia); 
            }
        }

        if (rolUsuario === 'Empleada' && idEmpleadaLogueada) {
            todosLosTurnos = todosLosTurnos.filter(t => t.Id_Empleada === idEmpleadaLogueada);
        }

        todosLosTurnos.forEach(turno => {
            const fechaObj = new Date(turno.Fecha_Hora);
            const diaSemana = fechaObj.getDay(); 
            
            const horas = fechaObj.getHours().toString().padStart(2, '0');
            const minutos = fechaObj.getMinutes() < 30 ? '00' : '30';
            const horaFormateada = `${horas}:${minutos}`;

            const celda = document.getElementById(`celda-sem-${diaSemana}-${horaFormateada}`);
            
            if (celda) {
                if (!celda.turnosAgrupados) celda.turnosAgrupados = [];
                celda.turnosAgrupados.push(turno);
            }
        });

        document.querySelectorAll('.celda-semanal').forEach(celda => {
            const turnos = celda.turnosAgrupados || [];
            const cantidad = turnos.length;
            
            if (cantidad > 0) {
                if (rolUsuario === 'Empleada') {
                    turnos.forEach(turno => {
                        const tarjeta = document.createElement('div');
                        tarjeta.className = 'tarjeta-turno-empleada'; 
                        
                        const duracionMinutos = turno.Duracion_Minutos || 60;
                        const cantidadBloques = duracionMinutos / 30;
                        
                        tarjeta.style.position = 'absolute';
                        tarjeta.style.top = '0';
                        tarjeta.style.left = '4px';
                        tarjeta.style.width = 'calc(100% - 8px)';
                        tarjeta.style.zIndex = '10';
                        tarjeta.style.height = `calc(${cantidadBloques * 100}% + ${cantidadBloques - 1}px)`;

                        if (turno.Color && turno.Color !== 'null') {
                            tarjeta.style.borderLeft = `4px solid ${turno.Color.split(' | ')[0]}`; 
                        }
                        
                        tarjeta.innerHTML = `
                            <span class="nombre-clienta">${turno.Nombre_Clienta || 'Clienta'}</span>
                            <span class="servicio-detalle">${turno.Nombre_Servicio || 'Servicio'}</span>
                        `;
                        
                        tarjeta.onclick = () => {
                            const precioServicio = turno.Precio_Base || 0; 
                            const senaPagada = turno.Sena_Monto || 0;
                            abrirModalDetalleTurno(
                                turno.Id_Turno, 
                                turno.Nombre_Clienta, 
                                turno.Nombre_Servicio, 
                                precioServicio, 
                                turno.Estado, 
                                turno.Color, 
                                senaPagada, 
                                turno.Comentario_Admin,
                                turno.Nombre_Area || ''
                            );
                        };
                        celda.appendChild(tarjeta);
                    });
                } else {
                    const boton = document.createElement('button');
                    boton.style.width = '90%';
                    boton.style.padding = '5px';
                    boton.style.backgroundColor = '#fdf3e1';
                    boton.style.border = '1px solid #f6c23e';
                    boton.style.borderRadius = '6px';
                    boton.style.cursor = 'pointer';
                    boton.style.fontWeight = 'bold';
                    boton.style.color = '#d69e2e';
                    boton.style.fontSize = '12px';
                    boton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    
                    boton.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px; margin-bottom: 2px;">
                            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/>
                        </svg>
                        ${cantidad} Turno${cantidad > 1 ? 's' : ''}
                    `;
                    
                    boton.onclick = () => abrirModalTurnosAgrupados(celda.turnosAgrupados);
                    celda.appendChild(boton);
                }
            }
        });

    } catch (error) {
        console.error("Error inyectando turnos semanales:", error);
    }
}

function abrirModalTurnosAgrupados(turnos) {
    const modal = document.getElementById('modalTurnos');
    const contenido = document.getElementById('contenidoModalTurnos');
    const titulo = document.getElementById('tituloModalTurnos');
    
    contenido.innerHTML = ''; 
    
    const fechaObj = new Date(turnos[0].Fecha_Hora);
    const horas = fechaObj.getHours().toString().padStart(2, '0');
    const minutos = fechaObj.getMinutes() < 30 ? '00' : '30';
    titulo.textContent = `Turnos de las ${horas}:${minutos} hs`;

    turnos.forEach(turno => {
        const tarjeta = document.createElement('div');
        tarjeta.style.padding = '15px';
        tarjeta.style.border = '1px solid #eee';
        tarjeta.style.borderRadius = '8px';
        tarjeta.style.borderLeft = `4px solid ${turno.Color ? turno.Color.split(' | ')[0] : '#f6c23e'}`;
        tarjeta.style.backgroundColor = '#fafafa';
        tarjeta.style.cursor = 'pointer'; 

        tarjeta.onclick = () => {
            modal.style.display = 'none'; 
            
            const precioServicio = turno.Precio_Base || 0; 
            const senaPagada = turno.Sena_Monto || 0;
            
            abrirModalDetalleTurno(
                turno.Id_Turno, 
                turno.Nombre_Clienta, 
                turno.Nombre_Servicio, 
                precioServicio,
                turno.Estado, 
                turno.Color,
                senaPagada,
                turno.Comentario_Admin,
                turno.Nombre_Area || '' 
            );
        };
        
        tarjeta.innerHTML = `
            <div style="font-weight: bold; color: #333; margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>${turno.Nombre_Clienta || 'Clienta'}</span>
                <span style="font-size: 12px; font-weight: normal; background: #eee; padding: 2px 8px; border-radius: 10px;">${turno.Estado || 'Agendado'}</span>
            </div>
            
            <div style="font-size: 13px; color: #666; margin-bottom: 6px; display: flex; align-items: center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#d69e2e" style="margin-right: 6px;">
                    <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.41l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.36-.36.59-.86.59-1.41s-.23-1.06-.59-1.41zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/>
                </svg>
                ${turno.Nombre_Servicio || 'Servicio'}
            </div>
            
            <div style="font-size: 13px; color: #999; display: flex; align-items: center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#999" style="margin-right: 6px;">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                ${turno.Nombre_Ap || 'Profesional no asignada'} 
            </div>
        `;
        
        contenido.appendChild(tarjeta);
    });
    
    modal.style.display = 'flex';
}

const modalTurnosAgrupados = document.getElementById('modalTurnos');
if (modalTurnosAgrupados) {
    modalTurnosAgrupados.addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
}

async function inicializarAgendaSemanal() {
    const agendaBody = document.getElementById('agendaSemanalBody');
    const headerSemanal = document.getElementById('agendaSemanalHeader');
    const fechaCalendario = document.getElementById('fechaAgendaInput').value; 

    if (!agendaBody || !headerSemanal || !fechaCalendario) return;
    
    agendaBody.innerHTML = ''; 

    let fechaBase = new Date(fechaCalendario + 'T00:00:00'); 
    let diaDeLaSemana = fechaBase.getDay();
    let diferenciaAlLunes = diaDeLaSemana === 0 ? -6 : 1 - diaDeLaSemana;
    let lunesDeEstaSemana = new Date(fechaBase);
    lunesDeEstaSemana.setDate(fechaBase.getDate() + diferenciaAlLunes);

    let htmlHeader = `<div class="hora-col" style="color: #999;">Hora</div>`;
    const nombresDias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    
    for (let i = 0; i < 6; i++) {
        let diaIterado = new Date(lunesDeEstaSemana);
        diaIterado.setDate(lunesDeEstaSemana.getDate() + i);
        
        let diaNum = diaIterado.getDate().toString().padStart(2, '0');
        let mesNum = (diaIterado.getMonth() + 1).toString().padStart(2, '0');
        
        htmlHeader += `
            <div style="display: flex; flex-direction: column;">
                <span>${nombresDias[i]}</span>
                <span style="font-size: 12px; font-weight: normal; color: #666; margin-top: 4px;">${diaNum}/${mesNum}</span>
            </div>
        `;
    }
    headerSemanal.innerHTML = htmlHeader;

    try {
        const resHor = await fetch('http://localhost:3000/api/horarios');
        const horarios = await resHor.json();
        const horarioRef = horarios.find(h => h.Laborable === true) || horarios[0];

        const extraerHoraMin = (valorTime) => {
            if (!valorTime) return null;
            if (valorTime.includes('T')) {
                const fecha = new Date(valorTime);
                return { h: fecha.getHours(), m: fecha.getMinutes() };
            } else {
                const [h, m] = valorTime.split(':').map(Number);
                return { h, m };
            }
        };

        const generarFilasRango = (apertura, cierre) => {
            const inicio = extraerHoraMin(apertura);
            const fin = extraerHoraMin(cierre);
            if (!inicio || !fin) return;
            
            let minInicio = inicio.h * 60 + inicio.m;
            let minFin = fin.h * 60 + fin.m;

            for (let min = minInicio; min < minFin; min += 30) {
                let hora = Math.floor(min / 60);
                let minutos = min % 60;
                let stringHora = `${hora.toString().padStart(2, '0')}:${minutos === 0 ? '00' : '30'}`;
                agendaBody.appendChild(crearFilaSemanal(stringHora));
            }
        };

        generarFilasRango(horarioRef.Hora_Apertura_1, horarioRef.Hora_Cierre_1);

        if (horarioRef.Hora_Apertura_2) {
            let divSiesta = document.createElement('div');
            divSiesta.style.padding = '20px';
            divSiesta.style.backgroundColor = '#fcfcfc';
            divSiesta.style.textAlign = 'center';
            divSiesta.style.color = '#aaa';
            divSiesta.style.fontSize = '12px';
            divSiesta.style.fontStyle = 'italic';
            divSiesta.style.borderBottom = '1px solid #eee';
            divSiesta.style.width = '100%';
            divSiesta.style.display = 'block'; 
            divSiesta.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>Horario de corte / Descanso</span>
                </div>
            `;
            agendaBody.appendChild(divSiesta);
        }

        generarFilasRango(horarioRef.Hora_Apertura_2, horarioRef.Hora_Cierre_2);

    } catch (err) {
        console.error("Error al inicializar la grilla semanal:", err);
    }
}

function crearFilaSemanal(hora) {
    let fila = document.createElement('div');
    fila.style.display = 'grid';
    fila.style.gridTemplateColumns = '80px repeat(6, 1fr)'; 
    fila.style.borderBottom = '1px solid #f0f0f0';

    let htmlFila = `<div class="hora-col" style="padding: 10px; color: #666; text-align: center; border-right: 1px solid #eee;">${hora}</div>`;

    for (let dia = 1; dia <= 6; dia++) {
        htmlFila += `<div id="celda-sem-${dia}-${hora}" class="celda-semanal" style="padding: 5px; border-right: 1px solid #eee; min-height: 40px; display: flex; justify-content: center; align-items: center;"></div>`;
    }
    
    fila.innerHTML = htmlFila;
    return fila;
}

async function cargarTurnosAgenda() {
    const inputFecha = document.getElementById('fechaAgendaInput');
    if (!inputFecha || !inputFecha.value) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/turnos/fecha/${inputFecha.value}`);
        const turnos = await respuesta.json();

        document.querySelectorAll('.turno-card').forEach(card => card.remove());

        turnos.forEach(turno => {
            const fechaObj = new Date(turno.Fecha_Hora);
            const horas = fechaObj.getHours().toString().padStart(2, '0');
            const minutosReales = fechaObj.getMinutes();
            const minutosCelda = minutosReales < 30 ? '00' : '30';
            const horaFormateada = `${horas}:${minutosCelda}`;
            
            const celdaDestino = document.querySelector(`.agenda-celda[data-hora="${horaFormateada}"][data-id-empleada="${turno.Id_Empleada}"]`);

            if (celdaDestino) {
                celdaDestino.style.position = 'relative'; 
                const alturaPixeles = (turno.Duracion_Minutos || 30) * 2; 

                const tarjeta = document.createElement('div');
                tarjeta.className = 'turno-card';
                tarjeta.style.height = `${alturaPixeles}px`;
                tarjeta.style.cursor = 'pointer';

                tarjeta.onclick = () => {
                    const precioServicio = turno.Precio_Base || 0; 
                    const senaPagada = turno.Sena_Monto || 0; 
                    abrirModalDetalleTurno(
                        turno.Id_Turno, 
                        turno.Nombre_Clienta, 
                        turno.Nombre_Servicio, 
                        precioServicio,
                        turno.Estado, 
                        turno.Color || '',
                        senaPagada,
                        turno.Comentario_Admin || '',
                        turno.Nombre_Area || '' 
                    );
                };

                // --- NUEVA LÓGICA DE SEMÁFORO VISUAL ---
                let badgeColorBg = '#ffeeba'; // Amarillo por defecto (Pendiente)
                let badgeColorText = '#856404';
                let textoEstado = turno.Estado || 'Pendiente';

                if (textoEstado === 'Pagado') {
                    badgeColorBg = '#d4edda'; // Verde
                    badgeColorText = '#155724';
                } else if (textoEstado === 'En progreso') {
                    badgeColorBg = '#cce5ff'; // Azul
                    badgeColorText = '#004085';
                } else if (textoEstado === 'Cancelado') {
                    badgeColorBg = '#f8d7da'; // Rojo
                    badgeColorText = '#721c24';
                }

                // Armamos el HTML del globito de estado
                const badgeHTML = `
                    <div style="margin-top: 5px;">
                        <span style="display: inline-block; font-size: 10px; font-weight: 700; background: ${badgeColorBg}; color: ${badgeColorText}; padding: 3px 8px; border-radius: 12px; border: 1px solid ${badgeColorText}40; letter-spacing: 0.3px;">
                            ${textoEstado}
                        </span>
                    </div>
                `;

                // Inyectamos el título, el detalle y ahora el nuevo badge
                tarjeta.innerHTML = `
                    <div class="turno-titulo" style="font-weight: 600; color: #333; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${turno.Nombre_Clienta}</div>
                    <div class="turno-detalle" style="color: #666; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${turno.Nombre_Servicio}</div>
                    ${badgeHTML}
                `;

                celdaDestino.appendChild(tarjeta);
            }
        });
    } catch (error) {
        console.error("Error inyectando turnos en la agenda:", error);
    }
}

async function cargarHorariosDisponibles() {
    const selectHora = document.getElementById('horaTurnoInput');
    const fechaInput = document.getElementById('fechaTurnoInput').value; 
    const idEmpleada = document.getElementById('empleadaTurno').value;

    if (!fechaInput || !idEmpleada) {
        selectHora.innerHTML = '<option value="">Elija fecha y profesional...</option>';
        selectHora.disabled = true;
        return;
    }

    selectHora.innerHTML = '<option value="">Calculando...</option>';
    selectHora.disabled = true;

    try {
        const respHorarios = await fetch('http://localhost:3000/api/horarios');
        const horariosSemana = await respHorarios.json();

        const fechaObj = new Date(fechaInput + 'T00:00:00'); 
        let diaSemanaJS = fechaObj.getDay(); 
        let idDiaBD = diaSemanaJS === 0 ? 7 : diaSemanaJS; 
        
        const configDia = horariosSemana.find(h => h.Id_Horario === idDiaBD);

        if (!configDia || !configDia.Laborable) {
            selectHora.innerHTML = '<option value="">Local cerrado este día</option>';
            return;
        }

        const extraerMinutos = (fechaSql) => {
            if (!fechaSql) return null;
            const fecha = new Date(fechaSql);
            return fecha.getHours() * 60 + fecha.getMinutes();
        };

        const apertura1 = extraerMinutos(configDia.Hora_Apertura_1);
        const cierre1 = extraerMinutos(configDia.Hora_Cierre_1);
        const apertura2 = extraerMinutos(configDia.Hora_Apertura_2);
        const cierre2 = extraerMinutos(configDia.Hora_Cierre_2);

        const respTurnos = await fetch(`http://localhost:3000/api/empleadas/${idEmpleada}/agenda/${fechaInput}`);
        const turnosOcupados = await respTurnos.json();

        let horariosPosibles = [];
        
        if (apertura1 !== null && cierre1 !== null) {
            for (let m = apertura1; m < cierre1; m += 30) horariosPosibles.push(m);
        }
        if (apertura2 !== null && cierre2 !== null) {
            for (let m = apertura2; m < cierre2; m += 30) horariosPosibles.push(m);
        }

        const horariosFiltrados = horariosPosibles.filter(minutoEvaluado => {
            const estaOcupado = turnosOcupados.some(turno => {
                const inicioOcupado = extraerMinutos(turno.Fecha_Hora);
                const finOcupado = inicioOcupado + turno.Duracion_Minutos;
                
                return minutoEvaluado >= inicioOcupado && minutoEvaluado < finOcupado;
            });
            return !estaOcupado;
        });

        selectHora.innerHTML = '<option value="">Seleccione un horario...</option>';
        if (horariosFiltrados.length === 0) {
            selectHora.innerHTML = '<option value="">Sin horarios disponibles</option>';
        } else {
            horariosFiltrados.forEach(minutos => {
                const horasFormat = Math.floor(minutos / 60).toString().padStart(2, '0');
                const minFormat = (minutos % 60).toString().padStart(2, '0');
                const textoHora = `${horasFormat}:${minFormat}`;
                selectHora.innerHTML += `<option value="${textoHora}">${textoHora}</option>`;
            });
        }
        
        selectHora.disabled = false;
        selectHora.style.backgroundColor = 'white';

    } catch (error) {
        console.error("Error al calcular horarios:", error);
        selectHora.innerHTML = '<option value="">Error al cargar</option>';
    }
}


// ==========================================================================
// 5. MÓDULO DE COBROS Y CHECK-OUT (Señas, Extras, Descuentos)
// ==========================================================================

let precioBaseActual = 0;
const modalDetalleTurno = document.getElementById('modalDetalleTurno');

if (modalDetalleTurno) {
    modalDetalleTurno.addEventListener('click', function(e) {
        if(e.target === modalDetalleTurno) cerrarModalDetalleTurno();
    });
}

function abrirModalDetalleTurno(idTurno, nombreClienta, nombreServicio, precioBase, estado, color, sena = 0, comentarioAdmin = '', nombreArea = '') {
    precioBaseActual = parseFloat(precioBase) || 0;
    const senaActual = parseFloat(sena) || 0;
    
    document.getElementById('idTurnoCobroOculto').value = idTurno;
    document.getElementById('nombreClientaCobro').textContent = `Clienta: ${nombreClienta}`;
    
    document.getElementById('servicioBaseCobro').textContent = `Servicio Base: ${nombreServicio}`;
    document.getElementById('precioBaseCobro').textContent = `Precio Base: $${precioBaseActual.toLocaleString('es-AR')}`;
    
    const inputSena = document.getElementById('senaDetalleInput');
    if (inputSena) inputSena.value = senaActual;
    
    const textoDetalleSena = document.getElementById('textoDetalleSena');
    if (textoDetalleSena) {
        textoDetalleSena.textContent = `Seña abonada: -$${senaActual.toLocaleString('es-AR')}`;
    }

    let areaDefinitiva = nombreArea;
    
    if (!areaDefinitiva || areaDefinitiva === 'null' || areaDefinitiva === 'undefined') {
        if (typeof listaServiciosGlobal !== 'undefined') {
            const srv = listaServiciosGlobal.find(s => s.Nombre === nombreServicio);
            if (srv) {
                areaDefinitiva = srv.Area || srv.area || srv.Nombre_Area || '';
            }
        }
    }
    
    const nombreSrvLow = (nombreServicio || '').toLowerCase();
    const esUñas = nombreSrvLow.includes('kapping') || nombreSrvLow.includes('esmaltado') || nombreSrvLow.includes('soft') || nombreSrvLow.includes('esculpidas');

    const divExtras = document.getElementById('seccionExtras');
    if (divExtras) {
        if (areaDefinitiva === 'Manicura' || areaDefinitiva === 'Pedicura' || esUñas) {
            divExtras.style.display = 'flex'; 
        } else {
            divExtras.style.display = 'none'; 
        }
    }

    document.getElementById('inputNuevoColor').value = '';
    const contenedorColores = document.getElementById('contenedorChipsColores');
    const inputOcultoColores = document.getElementById('coloresGuardados');
    
    contenedorColores.innerHTML = ''; 
    inputOcultoColores.value = '';

    if (color && color !== 'null') {
        const arrayColores = color.split('|');
        arrayColores.forEach(c => {
            if(c.trim()) agregarChipColor(c.trim());
        });
    }

    const inputComentario = document.getElementById('comentarioAdminInput');
    if (inputComentario) {
        inputComentario.value = (comentarioAdmin && comentarioAdmin !== 'null') ? comentarioAdmin : '';
    }
    
    const badgeEstado = document.getElementById('estadoTurnoBadge');
    badgeEstado.textContent = estado || 'Pendiente';
    
    const btnCobrar = document.getElementById('btnConfirmarCobro'); 
    const btnGuardar = document.getElementById('btnGuardarDetalles');
    const inputColor = document.getElementById('inputNuevoColor'); 
    const inputDescuento = document.getElementById('descuentoCobroInput');
    const inputRecargo = document.getElementById('recargoCobroInput'); 
    const checkboxes = document.querySelectorAll('.check-extra');
    
    const btnActualizarSena = document.querySelector('button[onclick="guardarSenaIndependiente()"]');
    const btnEditar = document.getElementById('btnEditarDatosTurno');
    
    if (estado === 'Pagado') {
        badgeEstado.style.background = '#d4edda';
        badgeEstado.style.color = '#155724';
        
        btnCobrar.disabled = true;
        btnCobrar.style.background = '#ccc';
        btnCobrar.textContent = 'Turno ya cobrado';
        btnCobrar.style.cursor = 'not-allowed';
        
        btnGuardar.style.display = 'none';
        inputColor.disabled = true;
        inputDescuento.disabled = true;
        if (inputRecargo) inputRecargo.disabled = true;
        if (inputComentario) inputComentario.disabled = true; 
        if (inputSena) inputSena.disabled = true;
        if (btnActualizarSena) btnActualizarSena.disabled = true;
        checkboxes.forEach(chk => chk.disabled = true);
        
        if (btnEditar) btnEditar.style.display = 'none'; 
    } else {
        badgeEstado.style.background = estado === 'En progreso' ? '#cce5ff' : '#ffeeba';
        badgeEstado.style.color = estado === 'En progreso' ? '#004085' : '#856404';
        
        btnCobrar.disabled = false;
        btnCobrar.style.background = '#28a745'; 
        btnCobrar.textContent = 'Confirmar y Cobrar';
        btnCobrar.style.cursor = 'pointer';
        
        btnGuardar.style.display = 'inline-block';
        inputColor.disabled = false;
        inputDescuento.disabled = false;
        if (inputRecargo) inputRecargo.disabled = false;
        if (inputComentario) inputComentario.disabled = false; 
        if (inputSena) inputSena.disabled = false;
        if (btnActualizarSena) btnActualizarSena.disabled = false;
        checkboxes.forEach(chk => chk.disabled = false);
        
        if (btnEditar) btnEditar.style.display = 'block'; 
    }

    document.getElementById('descuentoCobroInput').value = 0;
    if(inputRecargo) inputRecargo.value = 0;
    checkboxes.forEach(chk => chk.checked = false);
    
    if (typeof recalcularTotalCobro === 'function') {
        recalcularTotalCobro();
    }
    
    if (modalDetalleTurno) modalDetalleTurno.classList.add('active');
}

async function guardarDetallesTurno() {
    const idTurno = document.getElementById('idTurnoCobroOculto').value;
    const coloresFinales = document.getElementById('coloresGuardados').value; 
    const comentario = document.getElementById('comentarioAdminInput').value;
    
    if (!coloresFinales.trim() && !comentario.trim()) {
        mostrarNotificacion("Escribí un color o comentario para guardar", "warning");
        return;
    }
    
    try {
        const respuesta = await fetch(`http://localhost:3000/api/turnos/${idTurno}/detalles`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                Color: coloresFinales,
                Comentario_Admin: comentario 
            })
        });
        
        if (respuesta.ok) {
            mostrarNotificacion("¡Detalles guardados!", "success");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            mostrarNotificacion("Hubo un error al guardar.", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}

function cerrarModalDetalleTurno() {
    if (modalDetalleTurno) modalDetalleTurno.classList.remove('active');
}

function manejarEnterColor(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        const input = document.getElementById('inputNuevoColor');
        const color = input.value.trim();
        
        if (color) {
            agregarChipColor(color);
            input.value = ''; 
        }
    }
}

function agregarChipColor(color) {
    const contenedor = document.getElementById('contenedorChipsColores');
    const chip = document.createElement('div');
    chip.className = 'chip-color';
    chip.style.cssText = 'background: #e9ecef; color: #333; padding: 5px 12px; border-radius: 16px; font-size: 13px; display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';
    
    chip.innerHTML = `
        ${color}
        <span style="cursor: pointer; font-weight: bold; color: #999; font-size: 16px; line-height: 1;" onclick="eliminarChipColor(this)">×</span>
    `;
    
    contenedor.appendChild(chip);
    actualizarInputOcultoColores();
}

function eliminarChipColor(cruzElement) {
    cruzElement.parentElement.remove(); 
    actualizarInputOcultoColores(); 
}

function actualizarInputOcultoColores() {
    const chips = document.querySelectorAll('#contenedorChipsColores .chip-color');
    const colores = Array.from(chips).map(chip => chip.innerText.replace('×', '').trim());
    document.getElementById('coloresGuardados').value = colores.join(' | ');
}

async function cargarExtrasDisponibles() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/extras');
        const extras = await respuesta.json();

        const contenedor = document.getElementById('contenedorExtras');
        if (!contenedor) return;

        contenedor.innerHTML = ''; 

        extras.forEach(extra => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.padding = '8px 0';
            div.style.borderBottom = '1px solid #f9f9f9';

            div.innerHTML = `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
                    <input type="checkbox" class="check-extra" value="${extra.Precio}" data-id="${extra.Id_Extra}" onchange="recalcularTotalCobro()" style="cursor: pointer;">
                    ${extra.Nombre}
                </label>
                <span style="color: #888; font-size: 13px;">+$${extra.Precio.toLocaleString('es-AR')}</span>
            `;
            contenedor.appendChild(div);
        });
    } catch (error) {
        console.error("Error cargando extras:", error);
    }
}

function recalcularTotalCobro() {
    let sumaExtras = 0;
    
    const checkboxes = document.querySelectorAll('.check-extra:checked');
    checkboxes.forEach(chk => {
        sumaExtras += parseFloat(chk.value);
    });

    const descuentoInput = document.getElementById('descuentoCobroInput').value;
    const descuento = descuentoInput ? parseFloat(descuentoInput) : 0;

    const recargoInput = document.getElementById('recargoCobroInput').value; 
    const recargo = recargoInput ? parseFloat(recargoInput) : 0; 

    const senaInput = document.getElementById('senaDetalleInput').value;
    const senaAbonada = senaInput ? parseFloat(senaInput) : 0;

    let totalFinal = precioBaseActual + sumaExtras + recargo - descuento - senaAbonada;
    
    if (totalFinal < 0) totalFinal = 0;

    document.getElementById('totalFinalCobro').textContent = `$${totalFinal.toLocaleString('es-AR')}`;
}

const inputDescuento = document.getElementById('descuentoCobroInput');
if (inputDescuento) {
    inputDescuento.addEventListener('input', recalcularTotalCobro);
}

const inputSenaDetalle = document.getElementById('senaDetalleInput');
if (inputSenaDetalle) {
    inputSenaDetalle.addEventListener('input', recalcularTotalCobro);
}

async function confirmarCobroTurno() {
    const idTurno = document.getElementById('idTurnoCobroOculto').value;
    const medioPago = document.getElementById('selectMedioPago').value;
    
    const descuentoInput = document.getElementById('descuentoCobroInput').value;
    const descuento = descuentoInput ? parseFloat(descuentoInput) : 0;

    const recargoInput = document.getElementById('recargoCobroInput').value; 
    const recargo = recargoInput ? parseFloat(recargoInput) : 0; 
    
    const senaInput = document.getElementById('senaDetalleInput').value;
    const senaAbonada = senaInput ? parseFloat(senaInput) : 0;
    
    const extrasSeleccionados = [];
    let sumaExtras = 0;
    
    const checkboxes = document.querySelectorAll('.check-extra:checked');
    checkboxes.forEach(chk => {
        extrasSeleccionados.push(parseInt(chk.getAttribute('data-id')));
        sumaExtras += parseFloat(chk.value);
    });

    let totalFinal = precioBaseActual + sumaExtras + recargo - descuento - senaAbonada;
    if (totalFinal < 0) totalFinal = 0;

    const datosCobro = {
        idTurno: parseInt(idTurno),
        montoTotal: totalFinal,
        medioPago: medioPago,
        descuento: descuento,
        recargo: recargo, 
        extras: extrasSeleccionados
    };

    try {
        const respuesta = await fetch('http://localhost:3000/api/cobrar-turno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCobro)
        });

        if (respuesta.ok) {
            mostrarNotificacion("¡Cobro registrado con éxito!", "success"); 
            cerrarModalDetalleTurno();

            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            mostrarNotificacion("Hubo un error al intentar cobrar.", "error");
        }
    } catch (error) {
        console.error("Error conectando con el servidor:", error);
        mostrarNotificacion("Error de conexión con el servidor.", "error");
    }
}

async function guardarSenaIndependiente() {
    const idTurno = document.getElementById('idTurnoCobroOculto').value;
    const inputSena = document.getElementById('senaDetalleInput');
    const nuevaSena = parseFloat(inputSena.value) || 0;
    
    let nombreClienta = document.getElementById('nombreClientaCobro').textContent;
    nombreClienta = nombreClienta.replace('Clienta: ', '').trim();

    if (!idTurno) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/turnos/${idTurno}/sena`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                Sena_Monto: nuevaSena, 
                Nombre_Clienta: nombreClienta 
            })
        });

        if (respuesta.ok) {
            mostrarNotificacion("¡Seña actualizada y registrada en Ingresos!", "success");
            
            const textoSena = document.getElementById('textoDetalleSena');
            if(textoSena) textoSena.textContent = `Seña abonada: -$${nuevaSena.toLocaleString('es-AR')}`;
            
        } else {
            mostrarNotificacion("Error al guardar la seña.", "error");
        }
    } catch (error) {
        console.error("Error guardando la seña:", error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}


// ==========================================================================
// 6. MÓDULO DE CLIENTAS (CRM e Historial)
// ==========================================================================

let listaGlobalClientas = []; 
const modal = document.getElementById('modalNuevaClienta');
const inputBuscador = document.getElementById('buscadorClientas');

if (modal) {
    modal.addEventListener('click', function(e) {
        if(e.target === modal) cerrarModal();
    });
}

function abrirModal() {
    if (modal) modal.classList.add('active');
}

function cerrarModal() {
    if (modal) modal.classList.remove('active');
}

function prepararNuevaClienta() {
    document.getElementById('idClientaOculto').value = ''; 
    document.getElementById('nombreInput').value = '';
    document.getElementById('apellidoInput').value = '';
    document.getElementById('cumpleInput').value = '';
    document.getElementById('telefonoInput').value = '';
    document.getElementById('obsInput').value = '';    
    document.getElementById('tituloModalClienta').textContent = 'Registre un nuevo Cliente';
    document.getElementById('btnGuardarClienta').textContent = 'Registrar';
    
    abrirModal();
}

function abrirModalEditarClienta(id, nombre, apellido, fechaNac, telefono, observacion) {
    document.getElementById('idClientaOculto').value = id; 
    document.getElementById('nombreInput').value = nombre;
    document.getElementById('apellidoInput').value = apellido;
    
    if (fechaNac && fechaNac !== 'null' && fechaNac !== 'undefined') {
        document.getElementById('cumpleInput').value = fechaNac.split('T')[0];
    } else {
        document.getElementById('cumpleInput').value = '';
    }

    document.getElementById('telefonoInput').value = (telefono === 'null' || !telefono || telefono === 'undefined') ? '' : telefono;
    document.getElementById('obsInput').value = (observacion === 'null' || !observacion || observacion === 'undefined') ? '' : observacion;    
    document.getElementById('tituloModalClienta').textContent = 'Editar Clienta';
    document.getElementById('btnGuardarClienta').textContent = 'Actualizar';
    
    abrirModal();
}

function cerrarModalPerfil() {
    const modalPerfil = document.getElementById('modalPerfilClienta');
    if (modalPerfil) {
        modalPerfil.classList.remove('active');
    }
}

window.addEventListener('click', function(e) {
    const modalPerfil = document.getElementById('modalPerfilClienta');
    if (e.target === modalPerfil) {
        cerrarModalPerfil();
    }
});

async function verPerfilClienta(idClienta, nombre, apellido) {
    document.getElementById('nombrePerfilClienta').textContent = `Historial de ${nombre} ${apellido}`;
    
    const listaHistorial = document.getElementById('listaHistorialClienta');
    listaHistorial.innerHTML = '<p style="text-align:center; color:#888;">Cargando historial...</p>';
    
    const modalPerfil = document.getElementById('modalPerfilClienta');
    if (modalPerfil) {
        modalPerfil.classList.add('active');
    }

    try {
        const respuesta = await fetch(`http://localhost:3000/api/clientas/${idClienta}/historial`);
        const historial = await respuesta.json();

        listaHistorial.innerHTML = ''; 

        if (historial.length === 0) {
            listaHistorial.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Esta clienta aún no tiene turnos registrados.</p>';
            return;
        }

        historial.forEach(turno => {
            const fechaObj = new Date(turno.Fecha_Hora);
            const fechaLimpia = fechaObj.toLocaleDateString('es-AR');
            const horaLimpia = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

            let tagsHTML = '';
            if (turno.Color) {
                const detalles = turno.Color.split(' | ');
                detalles.forEach(detalle => {
                    if(detalle.trim() !== '') {
                        tagsHTML += `<span style="background: #f0e6d2; color: #8b6d3b; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-right: 5px; display: inline-block; margin-top: 8px;">${detalle.trim()}</span>`;
                    }
                });
            }

            let notaHTML = '';
            if (turno.Comentario_Admin) {
                notaHTML = `
                    <div style="background: #fff8e1; border-left: 3px solid #ffeeba; padding: 8px 12px; margin-top: 10px; border-radius: 4px; font-size: 12px; color: #856404;">
                        <span style="font-weight: 700; display: block; margin-bottom: 3px;">Nota Interna (Admin):</span>
                        ${turno.Comentario_Admin}
                    </div>
                `;
            }

            const itemHTML = `
                <div style="background-color: #f9f9f9; border-left: 4px solid var(--mostaza); padding: 10px 15px; margin-bottom: 10px; border-radius: 4px;">
                    <div style="font-weight: bold; color: #333; margin-bottom: 5px;">${turno.Nombre_Servicio}</div>
                    <div style="font-size: 13px; color: #666; display: flex; justify-content: space-between;">
                        <span>Fecha: ${fechaLimpia} a las ${horaLimpia} hs</span>
                        <span>Profesional: ${turno.Nombre_Ap}</span>
                    </div>
                    <div>
                        ${tagsHTML}
                    </div>
                    ${notaHTML}
                </div>
            `;
            listaHistorial.innerHTML += itemHTML;
        });

    } catch (error) {
        console.error("Error cargando historial:", error);
        listaHistorial.innerHTML = '<p style="text-align:center; color:#d9534f;">Hubo un error al cargar los datos.</p>';
    }
}

function cambiarVistaClientas(vista) {
    const vistaTarjetas = document.getElementById('vistaClientasTarjetas');
    const vistaLista = document.getElementById('vistaClientasListado');
    const btnTarjetas = document.getElementById('btnVistaTarjetas');
    const btnLista = document.getElementById('btnVistaLista');

    if (vista === 'tarjetas') {
        vistaTarjetas.style.display = 'grid'; 
        vistaLista.style.display = 'none';
        btnTarjetas.classList.add('active');
        btnLista.classList.remove('active');
    } else {
        vistaTarjetas.style.display = 'none';
        vistaLista.style.display = 'block';
        btnLista.classList.add('active');
        btnTarjetas.classList.remove('active');
    }
}

async function cargarClientas() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/clientas');
        listaGlobalClientas = await respuesta.json();
        renderizarClientas(listaGlobalClientas);
    } catch (error) {
        console.error("Error conectando con la API de clientas:", error);
    }
}

function renderizarClientas(clientasParaMostrar) {
    const contenedorTarjetas = document.getElementById('vistaClientasTarjetas');
    const tbodyLista = document.getElementById('tablaClientasBody');
    
    if (contenedorTarjetas) contenedorTarjetas.innerHTML = '';
    if (tbodyLista) tbodyLista.innerHTML = '';

    if (clientasParaMostrar.length === 0) {
        const trVacio = document.createElement('tr');
        trVacio.innerHTML = `<td colspan="5" style="text-align:center; padding:30px; color:#888;">No hay clientas que coincidan con este filtro.</td>`;
        if (tbodyLista) tbodyLista.appendChild(trVacio);
        if (contenedorTarjetas) contenedorTarjetas.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #888;">No hay clientas que coincidan con este filtro.</div>';
        return;
    }
    
    clientasParaMostrar.forEach(clienta => {
        let fechaNac = '-';
        if (clienta.Fecha_Nac) {
            const fechaLimpia = clienta.Fecha_Nac.split('T')[0];
            const opcionesFecha = { day: '2-digit', month: 'long' };
            fechaNac = new Date(fechaLimpia + 'T12:00:00').toLocaleDateString('es-AR', opcionesFecha);
        }
        const iniciales = `${clienta.Nombre[0]}${clienta.Apellido[0]}`.toUpperCase();

        const tarjetaHTML = `
            <div class="card item-clienta-busqueda"> 
                <div class="card-header">
                    <div class="avatar">${iniciales}</div>
                    <div class="client-info">
                        <h3 class="nombre-para-buscar">${clienta.Nombre} ${clienta.Apellido}</h3>
                        <span>Cumple: ${fechaNac}</span>
                    </div>
                </div>
                <div class="visit-info">
                    <p>Observación: <strong>${clienta.Observacion || '-'}</strong></p>
                    <p>Teléfono: <strong>${clienta.Telefono || '-'}</strong></p>
                </div>
               <div class="card-actions" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; justify-content: center; gap: 10px; display: flex;">
                    <button class="btn-icon" style="color: var(--mostaza); font-weight: bold;" onclick="agendarTurnoRapido('${clienta.Id_Clienta}', '${clienta.Nombre}', '${clienta.Apellido}')">+ Turno</button>
                    <button class="btn-icon" onclick="verPerfilClienta('${clienta.Id_Clienta}', '${clienta.Nombre}', '${clienta.Apellido}')">Ver</button>
                    <button class="btn-icon" onclick="abrirModalEditarClienta('${clienta.Id_Clienta}', '${clienta.Nombre}', '${clienta.Apellido}', '${clienta.Fecha_Nac}', '${clienta.Telefono}', '${clienta.Observacion}')">Editar</button>
                </div>
            </div>
        `;
        if (contenedorTarjetas) contenedorTarjetas.innerHTML += tarjetaHTML;

        const filaHTML = `
            <tr class="item-clienta-busqueda" style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px 15px; font-weight: bold; color: #333;" class="nombre-para-buscar">${clienta.Nombre} ${clienta.Apellido}</td>
                <td style="padding: 12px 15px;">${clienta.Telefono || '-'}</td>
                <td style="padding: 12px 15px;">${clienta.Observacion || '-'}</td>
                <td style="padding: 12px 15px;">${fechaNac}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <button class="btn-icon" style="color: var(--mostaza); font-weight: bold;" onclick="agendarTurnoRapido('${clienta.Id_Clienta}', '${clienta.Nombre}', '${clienta.Apellido}')">+ Turno</button>
                    <button class="btn-icon" title="Ver Historial" onclick="verPerfilClienta('${clienta.Id_Clienta}', '${clienta.Nombre}', '${clienta.Apellido}')">Ver</button>
                    <button class="btn-icon" title="Editar" onclick="abrirModalEditarClienta('${clienta.Id_Clienta}', '${clienta.Nombre}', '${clienta.Apellido}', '${clienta.Fecha_Nac}', '${clienta.Telefono}', '${clienta.Observacion}')">Editar</button>
                </td>
            </tr>
        `;
        if (tbodyLista) tbodyLista.innerHTML += filaHTML;
    });
}

function aplicarFiltroClientas() {
    const filtroElegido = document.getElementById('filtroRetencionClientas').value;
    const hoy = new Date();
    
    if (filtroElegido === 'todas') {
        renderizarClientas(listaGlobalClientas);
        return;
    }

    const clientasFiltradas = listaGlobalClientas.filter(clienta => {
        const fechaUltimoVisita = clienta.Fecha_Ultimo_Turno;
        if (!fechaUltimoVisita) return false;

        const fechaObj = new Date(fechaUltimoVisita);
        const milisegundos = hoy.getTime() - fechaObj.getTime();
        const diasPasados = Math.floor(milisegundos / (1000 * 60 * 60 * 24));

        if (filtroElegido === 'este_mes') {
            return fechaObj.getMonth() === hoy.getMonth() && fechaObj.getFullYear() === hoy.getFullYear();
        } 
        else if (filtroElegido === '15_dias') {
            return diasPasados >= 15 && diasPasados < 30;
        } 
        else if (filtroElegido === '30_dias') {
            return diasPasados >= 30 && diasPasados < 60;
        } 
        else if (filtroElegido === '60_dias') {
            return diasPasados >= 60;
        }
        
        return true;
    });

    renderizarClientas(clientasFiltradas);
}

async function guardarClienta() {
    const idOculto = document.getElementById('idClientaOculto').value;
    const nombre = document.getElementById('nombreInput').value.trim();
    const apellido = document.getElementById('apellidoInput').value.trim();
    const fechaNac = document.getElementById('cumpleInput').value;
    const telefono = document.getElementById('telefonoInput').value.trim();
    const observacion = document.getElementById('obsInput').value.trim();

    if (!nombre || !apellido) {
        mostrarNotificacion("¡Por favor completá el Nombre y el Apellido!", "warning");
        return; 
    }

    const clientaData = {
        Nombre: nombre,
        Apellido: apellido,
        Fecha_Nac: fechaNac ? fechaNac : null,
        Telefono: telefono ? telefono : null,
        Observacion: observacion ? observacion : null
    };

    const url = idOculto 
        ? `http://localhost:3000/api/clientas/${idOculto}` 
        : 'http://localhost:3000/api/clientas';
        
    const metodoElegido = idOculto ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodoElegido,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientaData)
        });

        if (respuesta.ok) {
            const mensajeExito = idOculto ? "¡Datos actualizados con éxito!" : "Clienta registrada con éxito.";
            mostrarNotificacion(mensajeExito, "success");
            cerrarModal(); 
            cargarClientas(); 
        } else {
            mostrarNotificacion("Hubo un error al guardar en la base de datos.", "error");
        }
    } catch (error) {
        console.error("Error en el envío:", error);
        mostrarNotificacion("No se pudo conectar con el servidor.", "error");
    }
}

if (inputBuscador) {
    inputBuscador.addEventListener('input', function(evento) {
        const textoBuscado = evento.target.value.toLowerCase();
        const elementosClienta = document.querySelectorAll('.item-clienta-busqueda');
        
        elementosClienta.forEach(elemento => {
            const nombreClienta = elemento.querySelector('.nombre-para-buscar').textContent.toLowerCase();
            if (nombreClienta.includes(textoBuscado)) {
                elemento.style.display = ''; 
            } else {
                elemento.style.display = 'none'; 
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const inputBuscarClienta = document.getElementById('inputBuscarClientaTurno');
    const dropdownClientas = document.getElementById('dropdownClientas');
    const inputClientaOculto = document.getElementById('selectClientaTurno');

    if (inputBuscarClienta) {
        inputBuscarClienta.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase();
            dropdownClientas.innerHTML = '';
            
            if (texto.length < 2) {
                dropdownClientas.style.display = 'none';
                inputClientaOculto.value = ''; 
                return;
            }
            
            const filtradas = listaGlobalClientas.filter(c => 
                c.Nombre.toLowerCase().includes(texto) || 
                (c.Apellido && c.Apellido.toLowerCase().includes(texto))
            );
            
            if (filtradas.length === 0) {
                dropdownClientas.innerHTML = '<div style="padding: 10px; color: #888; font-size: 13px;">No se encontraron clientas...</div>';
                dropdownClientas.style.display = 'block';
                return;
            }
            
            filtradas.forEach(c => {
                const item = document.createElement('div');
                item.style.padding = '10px';
                item.style.cursor = 'pointer';
                item.style.borderBottom = '1px solid #eee';
                item.textContent = `${c.Nombre} ${c.Apellido || ''}`;
                
                item.onmouseover = () => item.style.backgroundColor = '#f8f9fa';
                item.onmouseout = () => item.style.backgroundColor = 'white';
                
                item.onclick = () => {
                    inputBuscarClienta.value = `${c.Nombre} ${c.Apellido || ''}`;
                    inputClientaOculto.value = c.Id_Clienta;
                    dropdownClientas.style.display = 'none';
                };
                dropdownClientas.appendChild(item);
            });
            dropdownClientas.style.display = 'block';
        });

        document.addEventListener('click', (e) => {
            if(e.target !== inputBuscarClienta && e.target !== dropdownClientas) {
                dropdownClientas.style.display = 'none';
            }
        });
    }
});


// ==========================================================================
// 7. MÓDULO DE EMPLEADAS Y LIQUIDACIONES
// ==========================================================================

let memoriaLiquidaciones = [];
const modalEmpleada = document.getElementById('modalNuevaEmpleada');

if (modalEmpleada) {
    modalEmpleada.addEventListener('click', function(e) {
        if(e.target === modalEmpleada) cerrarModalEmpleada();
    });
}

function abrirModalEmpleada() {
    if (modalEmpleada) modalEmpleada.classList.add('active');
}

function cerrarModalEmpleada() {
    if (modalEmpleada) modalEmpleada.classList.remove('active');
}

function prepararNuevaEmpleada() {
    document.getElementById('idEmpleadaOculto').value = ''; 
    document.getElementById('nombreEmpleadaInput').value = '';
    document.getElementById('dniEmpleadaInput').value = '';
    
    document.getElementById('tituloModalEmpleada').textContent = 'Registrar Nueva Profesional';
    document.getElementById('btnGuardarEmpleada').textContent = 'Registrar';
    
    abrirModalEmpleada();
}

function abrirModalEditarEmpleada(id, nombre, dni) {
    document.getElementById('idEmpleadaOculto').value = id; 
    document.getElementById('nombreEmpleadaInput').value = nombre;
    document.getElementById('dniEmpleadaInput').value = (dni === '-' || !dni) ? '' : dni;
    
    document.getElementById('tituloModalEmpleada').textContent = 'Editar Profesional';
    document.getElementById('btnGuardarEmpleada').textContent = 'Actualizar';
    
    abrirModalEmpleada();
}

async function guardarEmpleada() {
    const idOculto = document.getElementById('idEmpleadaOculto').value;
    const nombre = document.getElementById('nombreEmpleadaInput').value.trim();
    const dni = document.getElementById('dniEmpleadaInput').value.trim();

    if (!nombre) {
        mostrarNotificacion("¡Por favor ingresá el nombre de la profesional!", "warning");
        return;
    }

    if (dni){
        const dniRegex = /^\d{7,8}$/; 
        if (!dniRegex.test(dni)) {
            mostrarNotificacion("Por favor, ingresá un DNI válido (7 u 8 números).", "warning");
            return; 
        }
    }

    const url = idOculto 
        ? `http://localhost:3000/api/empleadas/${idOculto}` 
        : 'http://localhost:3000/api/empleadas';
        
    const metodoElegido = idOculto ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: metodoElegido,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Nombre_Ap: nombre, Dni: dni || null })
        });

        if (response.ok) {
            const mensajeExito = idOculto ? "¡Datos actualizados con éxito!" : "Profesional registrada con éxito.";
            mostrarNotificacion(mensajeExito, "success");
            
            cerrarModalEmpleada();
            cargarEmpleadas(); 
        } else {
            mostrarNotificacion("Hubo un error al guardar en el servidor.", "error");
        }
    } catch (error) {
        console.error("Error guardando empleada:", error);
        mostrarNotificacion("No se pudo conectar con el servidor.", "error");
    }
}

async function cargarEmpleadas() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/empleadas');
        const empleadas = await respuesta.json();

        const selectEmpleada = document.getElementById('selectEmpleadaTurno');
        if (selectEmpleada) {
            selectEmpleada.innerHTML = '<option value="">Seleccione...</option>';
            empleadas.forEach(empleada => {
                const opcion = document.createElement('option');
                opcion.value = empleada.Id_Empleada; 
                opcion.textContent = empleada.Nombre_Ap; 
                selectEmpleada.appendChild(opcion);
            });
        }
        
        const contenedor = document.getElementById('contenedorEmpleadas');
        if (!contenedor) return; 
        
        contenedor.innerHTML = '';
        
        empleadas.forEach(empleada => {
            const inicial = empleada.Nombre_Ap[0].toUpperCase();
            const dniText = empleada.DNI || empleada.dni || '-';

            let infoUltimaLiq = '<span style="font-size: 12px; color: #aaa; font-style: italic;">Sin pagos previos registrados</span>';
            
            if (empleada.Ultima_Fecha_Liq) {
                const fechaObj = new Date(empleada.Ultima_Fecha_Liq);
                const fechaLimpia = fechaObj.toLocaleDateString('es-AR');
                const montoLimpio = empleada.Ultimo_Monto_Liq.toLocaleString('es-AR');
                
                infoUltimaLiq = `<span style="font-size: 12px; color: #666; font-weight: 500;">Última liq: <strong>$${montoLimpio}</strong> el ${fechaLimpia}</span>`;
            }

            const tarjetaHTML = `
                <div class="card">
                    <div class="card-header">
                        <div class="avatar" style="background-color: var(--mostaza); color: white;">${inicial}</div>
                        <div class="client-info">
                            <h3>${empleada.Nombre_Ap}</h3>
                            <span>DNI: ${dniText}</span>
                        </div>
                    </div>
                    
                    <div style="background-color: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-top: 15px; text-align: center;">
                        <span style="font-size: 13px; color: #666; display: block; margin-bottom: 5px;">Saldo Acumulado</span>
                        
                        <strong style="font-size: 26px; color: #28a745; display: block; margin-bottom: 5px;">
                            $${empleada.Saldo_Acumulado.toLocaleString('es-AR')}
                        </strong>
                        
                        <div style="margin-bottom: 15px; border-top: 1px dashed #ddd; padding-top: 8px;">
                            ${infoUltimaLiq}
                        </div>
                        
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn-icon" style="background-color: #28a745; color: white; border: none; font-weight: bold; padding: 6px 12px;" onclick="liquidarSueldo(${empleada.Id_Empleada}, '${empleada.Nombre_Ap}')">Liquidar</button>
                            <button class="btn-icon" onclick="verDetalleSueldo(${empleada.Id_Empleada}, '${empleada.Nombre_Ap}')">Detalle</button>
                        </div>
                    </div>

                    <div class="card-actions" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; justify-content: center;">
                        <button class="btn-icon" onclick="abrirModalEditarEmpleada('${empleada.Id_Empleada}', '${empleada.Nombre_Ap}', '${dniText}')"> Editar</button>
                        <button class="btn-icon" style="color: #d9534f;" onclick="eliminarEmpleada(${empleada.Id_Empleada})">Dar de baja</button>
                        <button class="btn-icon" onclick="abrirModalEspecialidades(${empleada.Id_Empleada}, '${empleada.Nombre_Ap}')">Configurar Áreas</button>
                    </div>
                </div>
            `;
            contenedor.innerHTML += tarjetaHTML;
        });
    } catch (error) {
        console.error("Error conectando con la API de empleadas:", error);
    }
}

async function eliminarEmpleada(id) {
    const confirmacion = await pedirConfirmacion("¿Estás segura de que querés dar de baja a esta profesional? Esta acción no se puede deshacer.");
    
    if (!confirmacion) return; 

    try {
        const respuesta = await fetch(`http://localhost:3000/api/empleadas/${id}`, {
            method: 'DELETE'
        });

        if (respuesta.ok) {
            mostrarNotificacion("Profesional dada de baja con éxito.", "success");
            cargarEmpleadas(); 
        } else {
            mostrarNotificacion("Hubo un error al intentar eliminar en la base de datos.", "error");
        }
    } catch (error) {
        console.error("Error eliminando empleada:", error);
        mostrarNotificacion("No se pudo conectar con el servidor.", "error");
    }
}

function cerrarModalDetalleSueldo() {
    const modal = document.getElementById('modalDetalleSueldo');
    if (modal) modal.classList.remove('active');
}

async function verDetalleSueldo(idEmpleada, nombre) {
    document.getElementById('tituloModalDetalleSueldo').textContent = `Detalle de ${nombre}`;
    const tbody = document.getElementById('tablaDetalleSueldoBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #888;">Cargando historial...</td></tr>';
    
    const modal = document.getElementById('modalDetalleSueldo');
    if (modal) modal.classList.add('active');

    try {
        const respuesta = await fetch(`http://localhost:3000/api/empleadas/${idEmpleada}/sueldo-detalle`);
        const detalles = await respuesta.json();
        
        tbody.innerHTML = '';
        
        if (detalles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #888;">No hay comisiones pendientes de cobro.</td></tr>';
            return;
        }
        
        detalles.forEach(d => {
            const fechaObj = new Date(d.Fecha_Hora);
            const fechaLimpia = fechaObj.toLocaleDateString('es-AR') + ' ' + fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${fechaLimpia}</td>
                    <td style="padding: 10px; font-weight: 500;">${d.Nombre_Clienta}</td>
                    <td style="padding: 10px; color: #555;">${d.Nombre_Servicio}</td>
                    <td style="padding: 10px; text-align: right;">$${d.Total_Abonado.toLocaleString('es-AR')}</td>
                    <td style="padding: 10px; text-align: center; color: var(--mostaza); font-weight: bold;">${d.Porcentaje_Comision * 100}%</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #28a745;">$${d.A_Cobrar.toLocaleString('es-AR')}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #d9534f; padding: 20px;">Error al cargar los datos.</td></tr>';
    }
}

async function liquidarSueldo(idEmpleada, nombre) {
    const confirmacion = await pedirConfirmacion(`¿Confirmás la liquidación del sueldo pendiente para ${nombre}? Esta acción dejará su caja en cero.`);
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/empleadas/${idEmpleada}/liquidar`, { 
            method: 'POST' 
        });
        
        if (respuesta.ok) {
            mostrarNotificacion("¡Sueldo liquidado con éxito!", "success");
            cargarEmpleadas(); 
        } else {
            mostrarNotificacion("Error al liquidar el sueldo o la caja ya estaba en cero.", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error de conexión con el servidor.", "error");
    }
}

function cerrarModalEspecialidades() {
    const modal = document.getElementById('modalEspecialidades');
    if (modal) modal.classList.remove('active');
}

async function abrirModalEspecialidades(idEmpleada, nombre) {
    document.getElementById('idEspecialidadOculto').value = idEmpleada;
    document.getElementById('tituloModalEspecialidades').textContent = `Áreas de ${nombre}`;
    
    const contenedor = document.getElementById('contenedorListaAreas');
    contenedor.innerHTML = '<p style="text-align:center; color:#888;">Cargando áreas...</p>';
    
    const modal = document.getElementById('modalEspecialidades');
    if (modal) modal.classList.add('active');

    try {
        const resAreas = await fetch('http://localhost:3000/api/areas');
        const areasDisponibles = await resAreas.json();
        
        const resAsignadas = await fetch(`http://localhost:3000/api/empleadas/${idEmpleada}/areas`);
        const areasAsignadas = await resAsignadas.json();
        
        contenedor.innerHTML = '';
        
        if(areasDisponibles.length === 0) {
            contenedor.innerHTML = '<p style="text-align:center; color:#888;">No hay áreas registradas en los servicios.</p>';
            return;
        }

        areasDisponibles.forEach(areaObj => {
            const nombreArea = areaObj.Area;
            const asignada = areasAsignadas.find(a => a.Area === nombreArea);
            
            const estaChequeado = asignada ? 'checked' : '';
            const comisionValor = asignada ? asignada.Porcentaje_Comision : '0.50'; 

            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.padding = '10px';
            div.style.borderBottom = '1px solid #f9f9f9';

            div.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; font-size:14px; cursor:pointer;">
                    <input type="checkbox" class="check-area" value="${nombreArea}" ${estaChequeado}>
                    ${nombreArea}
                </label>
                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; color:#666;">Comisión:</span>
                    <input type="number" step="0.05" min="0" max="1" class="input-comision" data-area="${nombreArea}" value="${comisionValor}" style="width: 70px; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" ${estaChequeado ? '' : 'disabled'}>
                </div>
            `;
            contenedor.appendChild(div);
        });

        const checkboxes = contenedor.querySelectorAll('.check-area');
        checkboxes.forEach(chk => {
            chk.addEventListener('change', function() {
                const inputRelacionado = contenedor.querySelector(`.input-comision[data-area="${this.value}"]`);
                if (inputRelacionado) {
                    inputRelacionado.disabled = !this.checked;
                }
            });
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = '<p style="text-align:center; color:#d9534f;">Error al cargar la información.</p>';
    }
}

async function guardarEspecialidades() {
    const idEmpleada = document.getElementById('idEspecialidadOculto').value;
    const contenedor = document.getElementById('contenedorListaAreas');
    
    const checkboxes = contenedor.querySelectorAll('.check-area:checked');
    const areasParaGuardar = [];

    checkboxes.forEach(chk => {
        const nombreArea = chk.value;
        const inputComision = contenedor.querySelector(`.input-comision[data-area="${nombreArea}"]`);
        const valorComision = inputComision ? parseFloat(inputComision.value) : 0.50;
        
        areasParaGuardar.push({
            area: nombreArea,
            comision: valorComision
        });
    });

    try {
        const respuesta = await fetch(`http://localhost:3000/api/empleadas/${idEmpleada}/areas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areas: areasParaGuardar })
        });

        if (respuesta.ok) {
            mostrarNotificacion("Áreas actualizadas correctamente.", "success");
            cerrarModalEspecialidades();
        } else {
            mostrarNotificacion("Error al guardar la configuración.", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}

function cambiarVistaEmpleadas(vista) {
    const vistaSaldos = document.getElementById('vistaSaldosEmpleadas');
    const vistaCobros = document.getElementById('vistaCobrosEmpleadas');
    const btnSaldos = document.getElementById('btnVistaSaldos');
    const btnCobros = document.getElementById('btnVistaCobros');
    
    const buscadorPrincipal = document.getElementById('buscadorEmpleadas'); 
    const btnNueva = document.getElementById('btnNuevaEmpleada');

    if (vista === 'saldos') {
        vistaSaldos.style.display = 'block';
        vistaCobros.style.display = 'none';
        btnSaldos.classList.add('active');
        btnCobros.classList.remove('active');
        
        if (buscadorPrincipal) buscadorPrincipal.style.display = 'inline-block';
        if (btnNueva) btnNueva.style.display = 'inline-block';
        
    } else if (vista === 'cobros') {
        vistaSaldos.style.display = 'none';
        vistaCobros.style.display = 'block';
        btnCobros.classList.add('active');
        btnSaldos.classList.remove('active');
        
        if (buscadorPrincipal) buscadorPrincipal.style.display = 'none';
        if (btnNueva) btnNueva.style.display = 'none';
        
        cargarHistorialCobros(); 
    }
}

async function cargarHistorialCobros() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/liquidaciones');
        memoriaLiquidaciones = await respuesta.json();
        aplicarFiltrosCobros(); 
    } catch (error) {
        console.error("Error al cargar historial:", error);
        document.getElementById('tablaHistorialCobrosBody').innerHTML = '<tr><td colspan="3" style="text-align:center; color:#d9534f; padding: 20px;">Error de conexión con el servidor.</td></tr>';
    }
}

function aplicarFiltrosCobros() {
    const textoBuscado = document.getElementById('buscadorHistorialCobros').value.toLowerCase();
    const rangoValor = document.getElementById('rangoFechaCobros').value;
    let fechaDesde = null, fechaHasta = null;

    if (rangoValor) {
        if (rangoValor.includes(' a ')) {
            [fechaDesde, fechaHasta] = rangoValor.split(' a ');
        } else if (rangoValor.includes(' to ')) {
            [fechaDesde, fechaHasta] = rangoValor.split(' to ');
        } else if (rangoValor.length === 10) {
            fechaDesde = rangoValor;
            fechaHasta = rangoValor;
        }
    }

    const filtradas = memoriaLiquidaciones.filter(liq => {
        const cumpleTexto = liq.Nombre_Ap.toLowerCase().includes(textoBuscado);
        let cumpleFecha = true;

        if (fechaDesde && fechaHasta) {
            const fechaLiq = liq.Fecha.split('T')[0];
            cumpleFecha = (fechaLiq >= fechaDesde) && (fechaLiq <= fechaHasta);
        }

        return cumpleTexto && cumpleFecha;
    });

    dibujarTablaCobros(filtradas);
}

function dibujarTablaCobros(lista) {
    const tbody = document.getElementById('tablaHistorialCobrosBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#888;">No se encontraron registros de cobro con esos filtros.</td></tr>';
        return;
    }

    lista.forEach(liq => {
        const fechaObj = new Date(liq.Fecha);
        const fechaLimpia = new Date(fechaObj.getTime() + fechaObj.getTimezoneOffset() * 60000).toLocaleDateString('es-AR');
        
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee; transition: background-color 0.2s;">
                <td style="padding: 15px; color: #555;">${fechaLimpia}</td>
                <td style="padding: 15px; font-weight: 500; color: #333;">${liq.Nombre_Ap}</td>
                <td style="padding: 15px; font-weight: 600; color: #28a745;">$${liq.Monto_Total.toLocaleString('es-AR')}</td>
                <td style="padding: 15px; text-align: center;">
                    <button class="btn-icon" onclick="abrirDetalleCobro(${liq.Id_Liquidacion})" title="Ver servicios" style="color: #d4a347; border: none; background: transparent; cursor: pointer;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    });
}

async function abrirDetalleCobro(idLiquidacion) {
    const modal = document.getElementById('modalDetalleHistorial');
    const tbody = document.getElementById('tablaDetalleHistorialBody');
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #888;">Cargando detalles de los turnos...</td></tr>';
    modal.classList.add('active'); 

    try {
        const respuesta = await fetch(`http://localhost:3000/api/liquidaciones/${idLiquidacion}/detalles`);
        
        if (!respuesta.ok) {
            throw new Error("Error en la respuesta del servidor");
        }
        
        const detalles = await respuesta.json();
        
        tbody.innerHTML = '';
        
        if (detalles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #888; font-style: italic;">No se encontraron detalles para este cobro (posiblemente sea un registro antiguo).</td></tr>';
            return;
        }
        
        detalles.forEach(item => {
            const fechaObj = new Date(item.Fecha_Hora);
            const fechaLimpia = new Date(fechaObj.getTime() + fechaObj.getTimezoneOffset() * 60000).toLocaleDateString('es-AR');
            
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px 15px; color: #555;">${fechaLimpia}</td>
                    <td style="padding: 12px 15px;">${item.Nombre_Clienta}</td>
                    <td style="padding: 12px 15px; color: #666;">${item.Nombre_Servicio}</td>
                    <td style="padding: 12px 15px; text-align: right;">$${item.Monto_Abonado.toLocaleString('es-AR')}</td>
                    <td style="padding: 12px 15px; text-align: center; color: #888;">${item.Porcentaje}%</td>
                    <td style="padding: 12px 15px; text-align: right; font-weight: 600; color: #28a745;">$${item.Comision.toLocaleString('es-AR')}</td>
                </tr>
            `;
        });
        
    } catch (error) {
        console.error("Error al buscar el desglose:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #d9534f;">Hubo un error al cargar la información.</td></tr>';
    }
}

function cerrarModalHistorial() {
    const modal = document.getElementById('modalDetalleHistorial');
    modal.classList.remove('active');
}

async function cargarMisPagos() {
    const tbody = document.getElementById('tablaMisPagosBody');
    if (!tbody) return;

    const token = localStorage.getItem('emme_token');
    if (!token) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const idEmpleada = payload.Id_Empleada || payload.id; 

        const respuesta = await fetch(`http://localhost:3000/api/empleadas/${idEmpleada}/liquidaciones`);
        
        if (!respuesta.ok) throw new Error("Error al traer los pagos");
        
        const pagos = await respuesta.json();
        
        tbody.innerHTML = '';
        
        if (pagos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 30px; color: #888; font-style: italic;">Todavía no tenés pagos registrados.</td></tr>';
            return;
        }
        
        pagos.forEach(pago => {
            const fechaObj = new Date(pago.Fecha);
            const fechaLimpia = new Date(fechaObj.getTime() + fechaObj.getTimezoneOffset() * 60000).toLocaleDateString('es-AR');
            
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee; transition: background-color 0.2s;">
                    <td style="padding: 15px; color: #555;">${fechaLimpia}</td>
                    <td style="padding: 15px; font-weight: 600; color: #28a745;">$${pago.Monto_Total.toLocaleString('es-AR')}</td>
                    <td style="padding: 15px; text-align: center;">
                        <button class="btn-icon" onclick="abrirDetalleCobro(${pago.Id_Liquidacion})" title="Ver servicios" style="color: #d4a347; border: none; background: transparent; cursor: pointer;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error al cargar Mis Pagos:", error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 30px; color: #d9534f;">Hubo un problema de conexión. Intentá nuevamente.</td></tr>';
    }
}

if (buscadorEmpleadas) {
    buscadorEmpleadas.addEventListener('input', function(e) {
        const textoBuscado = e.target.value.toLowerCase();
        const tarjetas = document.querySelectorAll('#contenedorEmpleadas .card');
        
        tarjetas.forEach(tarjeta => {
            const nombre = tarjeta.querySelector('h3').textContent.toLowerCase();
            if (nombre.includes(textoBuscado)) {
                tarjeta.style.display = '';
            } else {
                tarjeta.style.display = 'none';
            }
        });
    });
}


// ==========================================================================
// 8. MÓDULO DE FINANZAS (Gastos e Ingresos)
// ==========================================================================

let memoriaGastos = [];
const modalGasto = document.getElementById('modalNuevoGasto');
const modalNuevoIngreso = document.getElementById('modalNuevoIngreso');

if (modalGasto) {
    modalGasto.addEventListener('click', function(e) {
        if(e.target === modalGasto) cerrarModalGasto();
    });
}

function abrirModalGasto() {
    if (modalGasto) modalGasto.classList.add('active');
}

function cerrarModalGasto() {
    if (modalGasto) modalGasto.classList.remove('active');
}

function prepararNuevoGasto() {
    document.getElementById('idGastoOculto').value = '';
    document.getElementById('descGastoInput').value = '';
    document.getElementById('montoGastoInput').value = '';
    document.getElementById('selectCategoriaGasto').value = '';
    
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    document.getElementById('fechaGastoInput').value = `${yyyy}-${mm}-${dd}`;
    
    document.getElementById('tituloModalGasto').textContent = 'Registrar Nuevo Gasto';
    abrirModalGasto();
}

async function cargarCategoriasGasto() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/categorias-gastos');
        const categorias = await respuesta.json();
        
        const selectModal = document.getElementById('selectCategoriaGasto');
        const selectFiltro = document.getElementById('filtroCategoriaGasto');
        
        if (selectModal) {
            selectModal.innerHTML = '<option value="">Seleccione...</option>';
            categorias.forEach(cat => selectModal.innerHTML += `<option value="${cat.Id_Categoria}">${cat.Nombre}</option>`);
        }
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="todas">Todas las categorías</option>';
            categorias.forEach(cat => selectFiltro.innerHTML += `<option value="${cat.Nombre}">${cat.Nombre}</option>`);
        }
    } catch (error) {
        console.error("Error conectando con la API de categorías:", error);
    }
}

async function cargarGastos() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/gastos');
        memoriaGastos = await respuesta.json(); 
        aplicarFiltrosGastos(); 
    } catch (error) {
        console.error("Error conectando con la API de gastos:", error);
    }
}

// Filtros estandarizados de la UI
const modoGastos = document.getElementById('modoFechaGastos');
if (modoGastos) {
    modoGastos.addEventListener('change', (e) => {
        const inputRangoGastos = document.getElementById('rangoFechaGastos');
        if (e.target.value === 'rango') {
            document.getElementById('contenedorMesGastos').style.display = 'none';
            inputRangoGastos.style.display = 'block';
        } else {
            document.getElementById('contenedorMesGastos').style.display = 'flex';
            inputRangoGastos.style.display = 'none';
            aplicarFiltrosGastos(); 
        }
    });
}

function aplicarFiltrosGastos() {
    const catSeleccionada = document.getElementById('filtroCategoriaGasto').value;
    const modoFecha = document.getElementById('modoFechaGastos').value;

    const mesSeleccionado = document.getElementById('filtroMesGasto').value;
    const anioSeleccionado = document.getElementById('filtroAnioGasto').value;

    const rangoValor = document.getElementById('rangoFechaGastos').value;
    let fechaDesde = null, fechaHasta = null;

    if (modoFecha === 'rango' && rangoValor) {
        if (rangoValor.includes(' a ')) {
            [fechaDesde, fechaHasta] = rangoValor.split(' a ');
        } else if (rangoValor.includes(' to ')) {
            [fechaDesde, fechaHasta] = rangoValor.split(' to ');
        } else if (rangoValor.length === 10) {
            fechaDesde = rangoValor;
            fechaHasta = rangoValor;
        }
    }

    const gastosFiltrados = memoriaGastos.filter(gasto => {
        const categoriaGasto = gasto.Nombre_Categoria || 'Sin tipo';
        const pasaFiltroCat = (catSeleccionada === 'todas') || (categoriaGasto === catSeleccionada);

        let pasaFiltroFecha = true;
        
        const fechaObj = new Date(gasto.Fecha);
        const anioGasto = fechaObj.getUTCFullYear().toString();
        const mesGasto = fechaObj.getUTCMonth().toString();
        const diaStr = String(fechaObj.getUTCDate()).padStart(2, '0');
        const mesStr = String(fechaObj.getUTCMonth() + 1).padStart(2, '0');
        const fechaGastoFormateada = `${anioGasto}-${mesStr}-${diaStr}`;

        if (modoFecha === 'mes') {
            const pasaMes = (mesSeleccionado === 'todos') || (mesGasto === mesSeleccionado);
            const pasaAnio = (anioSeleccionado === 'todos') || (anioGasto === anioSeleccionado);
            pasaFiltroFecha = pasaMes && pasaAnio;
        } else if (modoFecha === 'rango' && fechaDesde && fechaHasta) {
            pasaFiltroFecha = (fechaGastoFormateada >= fechaDesde) && (fechaGastoFormateada <= fechaHasta);
        }

        return pasaFiltroCat && pasaFiltroFecha;
    });
    
    dibujarTablaGastos(gastosFiltrados);
}

function dibujarTablaGastos(listaGastos) {
    const tbody = document.getElementById('tablaGastosBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (listaGastos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #888;">No se encontraron gastos para estos filtros.</td></tr>';
        return;
    }

    listaGastos.forEach(gasto => {
        const fechaObj = new Date(gasto.Fecha);
        const fechaLimpia = new Date(fechaObj.getTime() + fechaObj.getTimezoneOffset() * 60000).toLocaleDateString('es-AR');
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        
        tr.innerHTML = `
            <td style="padding: 12px;">${fechaLimpia}</td>
            <td style="padding: 12px;"><span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #555;">${gasto.Nombre_Categoria || 'Sin tipo'}</span></td>
            <td style="padding: 12px;">${gasto.Descripcion}</td>
            <td style="padding: 12px; font-weight: bold; color: #d9534f;">$${gasto.Monto.toLocaleString('es-AR')}</td>
            <td style="padding: 12px; text-align: center;">
                <button class="btn-icon" style="color: #dc3545; border-color: #f5c6cb;" onclick="eliminarGasto(${gasto.Id_Gasto})" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function guardarGasto() {
    const desc = document.getElementById('descGastoInput').value.trim();
    const fecha = document.getElementById('fechaGastoInput').value;
    const monto = document.getElementById('montoGastoInput').value;
    const idCategoria = document.getElementById('selectCategoriaGasto').value;

    if (!desc || !fecha || !monto) {
        mostrarNotificacion("Por favor completá los campos obligatorios (*).", "warning");
        return;
    }

    const nuevoGasto = {
        Fecha: fecha,
        Descripcion: desc,
        Monto: parseFloat(monto),
        Id_Categoria: idCategoria ? parseInt(idCategoria) : null
    };

    try {
        const respuesta = await fetch('http://localhost:3000/api/gastos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoGasto)
        });

        if (respuesta.ok) {
            mostrarNotificacion("¡Gasto registrado con éxito!", "success");
            cerrarModalGasto();
            cargarGastos(); 
        } else {
            mostrarNotificacion("Hubo un error al guardar el gasto.", "error");
        }
    } catch (error) {
        console.error("Error en el envío:", error);
        mostrarNotificacion("No se pudo conectar con el servidor.", "error");
    }
}

async function eliminarGasto(id) {
    const confirmacion = await pedirConfirmacion("¿Estás segura de que querés borrar este registro de gasto?");
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/gastos/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            mostrarNotificacion("Gasto eliminado con éxito.", "success");
            cargarGastos();
        } else {
            mostrarNotificacion("No se pudo eliminar el gasto.", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

async function cargarIngresos() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/ingresos');
        const ingresos = await respuesta.json();
        
        const tbody = document.getElementById('tablaIngresosBody');
        if (!tbody) return;

        tbody.innerHTML = ''; 

        if (ingresos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Aún no hay cobros registrados.</td></tr>`;
            return;
        }

        ingresos.forEach(ingreso => {
            const fechaCorta = ingreso.Fecha.split('T')[0]; 
            const partes = fechaCorta.split('-');
            const fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;

            const clientaMostrar = ingreso.Nombre_Clienta ? ingreso.Nombre_Clienta : '<span style="color:#aaa;">- Mostrador -</span>';
            const servicioMostrar = ingreso.Concepto ? ingreso.Concepto : (ingreso.Nombre_Servicio || '-');

            const filaHTML = `
                <tr style="border-bottom: 1px solid #eee;" data-fecha="${fechaCorta}">
                    <td style="padding: 12px;">${fechaFormateada}</td>
                    <td style="padding: 12px; font-weight: 500;">${clientaMostrar}</td>
                    <td style="padding: 12px; color: #555;">${servicioMostrar}</td>
                    <td style="padding: 12px;">
                        <span style="background: #eef2f5; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${ingreso.Medio_Pago}</span>
                    </td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; color: #28a745;">
                        $${ingreso.Monto_Total.toLocaleString('es-AR')}
                    </td>
                </tr>
            `;
            tbody.innerHTML += filaHTML;
        }); 
        
        filtrarIngresos();

    } catch (error) {
        console.error("Error al cargar los ingresos:", error);
        document.getElementById('tablaIngresosBody').innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error al cargar los datos.</td></tr>`;
    }
}

const modoIngresos = document.getElementById('modoFechaIngresos');
if (modoIngresos) {
    modoIngresos.addEventListener('change', (e) => {
        const inputRangoIngresos = document.getElementById('rangoFechaIngresos');
        if (e.target.value === 'rango') {
            document.getElementById('contenedorMesIngresos').style.display = 'none';
            inputRangoIngresos.style.display = 'block';
        } else {
            document.getElementById('contenedorMesIngresos').style.display = 'flex';
            inputRangoIngresos.style.display = 'none';
            filtrarIngresos(); 
        }
    });
}

function filtrarIngresos() {
    const inputBuscador = document.getElementById('buscadorIngresosTexto');
    const textoBuscado = inputBuscador ? inputBuscador.value.toLowerCase() : '';
    
    const modoFecha = document.getElementById('modoFechaIngresos').value;
    const mesSeleccionado = document.getElementById('filtroMesIngreso').value;
    const anioSeleccionado = document.getElementById('filtroAnioIngreso').value;
    
    const rangoValor = document.getElementById('rangoFechaIngresos').value;
    let fechaDesde = null, fechaHasta = null;

    if (modoFecha === 'rango' && rangoValor) {
        if (rangoValor.includes(' a ')) {
            [fechaDesde, fechaHasta] = rangoValor.split(' a ');
        } else if (rangoValor.includes(' to ')) {
            [fechaDesde, fechaHasta] = rangoValor.split(' to ');
        } else if (rangoValor.length === 10) {
            fechaDesde = rangoValor;
            fechaHasta = rangoValor;
        }
    }

    const filas = document.querySelectorAll('#tablaIngresosBody tr');
    let sumaTotal = 0; 

    filas.forEach(fila => {
        if (fila.cells.length === 1) return;

        const contenidoFila = fila.textContent.toLowerCase();
        const fechaFila = fila.getAttribute('data-fecha'); 

        const cumpleTexto = contenidoFila.includes(textoBuscado);

        let cumpleFecha = true;
        if (fechaFila) {
            if (modoFecha === 'mes') {
                const anioFila = fechaFila.substring(0, 4);
                const mesFila = (parseInt(fechaFila.substring(5, 7)) - 1).toString(); 
                
                const pasaMes = (mesSeleccionado === 'todos') || (mesFila === mesSeleccionado);
                const pasaAnio = (anioSeleccionado === 'todos') || (anioFila === anioSeleccionado);
                cumpleFecha = pasaMes && pasaAnio;
            } else if (modoFecha === 'rango' && fechaDesde && fechaHasta) {
                cumpleFecha = (fechaFila >= fechaDesde) && (fechaFila <= fechaHasta);
            }
        }

        if (cumpleTexto && cumpleFecha) {
            fila.style.display = '';
            
            const textoMonto = fila.cells[4].textContent;
            const numeroLimpio = parseFloat(textoMonto.replace('$', '').replace(/\./g, '').replace(',', '.'));
            
            if (!isNaN(numeroLimpio)) {
                sumaTotal += numeroLimpio;
            }
        } else {
            fila.style.display = 'none';
        }
    });

    const celdaTotal = document.getElementById('totalIngresosFiltrados');
    if (celdaTotal) {
        celdaTotal.textContent = '$' + sumaTotal.toLocaleString('es-AR');
    }
}

async function cargarMediosDePago() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/medios-pago');
        const medios = await respuesta.json();
        
        const selectCobroTurno = document.getElementById('selectMedioPago');
        const selectNuevoIngreso = document.getElementById('pagoIngresoManual');
        
        let opcionesHTML = '';
        if (medios.length === 0) {
            opcionesHTML = '<option value="">No hay medios cargados</option>';
        } else {
            medios.forEach(medio => {
                opcionesHTML += `<option value="${medio.Nombre}">${medio.Nombre}</option>`;
            });
        }
        
        if (selectCobroTurno) selectCobroTurno.innerHTML = opcionesHTML;
        if (selectNuevoIngreso) selectNuevoIngreso.innerHTML = opcionesHTML;
        
    } catch (error) {
        console.error("Error al cargar los medios de pago:", error);
    }
}

async function cargarTablaMediosPago() {
    const tbody = document.getElementById('tablaConfigPagosBody');
    if (!tbody) return;
    
    try {
        const respuesta = await fetch('http://localhost:3000/api/medios-pago');
        const medios = await respuesta.json();
        
        tbody.innerHTML = '';
        
        if (medios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--texto-claro);">No hay medios de pago registrados.</td></tr>';
            return;
        }
        
        medios.forEach(medio => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--borde)';
            
            const nombreMedio = String(medio.Nombre ?? '').replace(/'/g, "\\'");
            
            tr.innerHTML = `
                <td style="padding: 8px 15px; color: var(--texto-claro); font-weight: 500;">${medio.Id_Medio_Pago}</td>
                <td style="padding: 8px 15px; font-weight: 500; color: var(--texto-oscuro);">${medio.Nombre}</td>
                <td style="padding: 8px 15px; text-align: center;">
                    <button class="btn-icon" style="color: #17a2b8; border-color: #b8daff; margin-right: 8px;" onclick="abrirModalMedioPago(${medio.Id_Medio_Pago}, '${nombreMedio}')" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon" style="color: #dc3545; border-color: #f5c6cb;" onclick="eliminarMedioPago(${medio.Id_Medio_Pago})" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error cargando tabla de medios:", error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#d9534f;">Error al cargar la tabla.</td></tr>';
    }
}

function abrirModalNuevoIngreso() {
    document.getElementById('conceptoIngresoManual').value = '';
    document.getElementById('montoIngresoManual').value = '';
    
    if (modalNuevoIngreso) {
        modalNuevoIngreso.classList.add('active');
    }
}

function cerrarModalNuevoIngreso() {
    if (modalNuevoIngreso) {
        modalNuevoIngreso.classList.remove('active');
    }
}

async function guardarIngresoManual() {
    const concepto = document.getElementById('conceptoIngresoManual').value;
    const monto = document.getElementById('montoIngresoManual').value;
    const medioPago = document.getElementById('pagoIngresoManual').value;

    if (!concepto || !monto) {
        mostrarNotificacion("Por favor completá el concepto y el monto.", "error");
        return;
    }

    // 👉 NUEVO: Calculamos la fecha de hoy para mandársela a la Base de Datos
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const fechaActual = `${yyyy}-${mm}-${dd}`;

    try {
        const respuesta = await fetch('http://localhost:3000/api/ingresos/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Concepto: concepto,
                Monto_Total: parseFloat(monto),
                Medio_Pago: medioPago,
                Fecha: fechaActual // 👉 Le sumamos la fecha al paquete
            })
        });

        if (respuesta.ok) {
            mostrarNotificacion("¡Ingreso extra registrado!", "success");
            cerrarModalNuevoIngreso();
            cargarIngresos(); 
        } else {
            mostrarNotificacion("Error al guardar el ingreso.", "error");
        }
    } catch (error) {
        console.error("Error:", error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}


// ==========================================================================
// 9. MÓDULO DE DASHBOARD Y MÉTRICAS
// ==========================================================================

let graficoIngresosInstancia = null;
let graficoTurnosInstancia = null;
let graficoServiciosInstancia = null;
let graficoEmpleadasInstancia = null;

const formatoFechaSQL = (fecha) => {
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

function obtenerFechasFiltroRapido(tipoFiltro) {
    const hoy = new Date();
    let desde = new Date();
    let hasta = new Date();

    if (tipoFiltro === 'hoy') {
    } else if (tipoFiltro === 'ultimos_7_dias') {
        desde.setDate(hoy.getDate() - 7);
    } else if (tipoFiltro === 'este_mes') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (tipoFiltro === 'ultimo_mes') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0); 
    }
    
    return { desde: formatoFechaSQL(desde), hasta: formatoFechaSQL(hasta) };
}

async function cargarDatosDashboard(desdeCustom = null, hastaCustom = null) {
    let desde, hasta;

    if (desdeCustom && hastaCustom) {
        desde = desdeCustom;
        hasta = hastaCustom;
    } else {
        const selectFiltro = document.getElementById('filtroRapidoDash');
        if (selectFiltro && selectFiltro.value !== 'personalizado') {
            const fechas = obtenerFechasFiltroRapido(selectFiltro.value);
            desde = fechas.desde;
            hasta = fechas.hasta;
        } else {
            return; 
        }
    }

    try {
        const respuesta = await fetch(`http://localhost:3000/api/dashboard/kpis?desde=${desde}&hasta=${hasta}`);
        const kpis = await respuesta.json();

        document.getElementById('dashIngresos').textContent = `$${kpis.Ingresos.toLocaleString('es-AR')}`;
        document.getElementById('dashGastos').textContent = `$${kpis.Gastos.toLocaleString('es-AR')}`;
        document.getElementById('dashSueldos').textContent = `$${kpis.Sueldos.toLocaleString('es-AR')}`;
        document.getElementById('dashGanancia').textContent = `$${kpis.GananciaNeta.toLocaleString('es-AR')}`;

        cargarGraficoDashboard(desde, hasta);

    } catch (error) {
        console.error("Error cargando métricas del dashboard:", error);
    }
}

async function cargarGraficoDashboard(desde, hasta) {
    try {
        const respuesta = await fetch(`http://localhost:3000/api/dashboard/grafico-ingresos?desde=${desde}&hasta=${hasta}`);
        
        if (!respuesta.ok) return;

        const datos = await respuesta.json();

        const etiquetasIngresos = datos.map(d => d.Dia);
        const valoresIngresos = datos.map(d => d.Total);

        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const valoresTurnos = [0, 0, 0, 0, 0, 0, 0]; 

        datos.forEach(d => {
            if (d.Turnos > 0) {
                const fechaObj = new Date(d.FechaCompleta + 'T00:00:00');
                let diaIdx = fechaObj.getDay(); 
                diaIdx = diaIdx === 0 ? 6 : diaIdx - 1;
                valoresTurnos[diaIdx] += d.Turnos;
            }
        });

        // 1. GRÁFICO DE INGRESOS
        const ctxIngresos = document.getElementById('graficoIngresos').getContext('2d');
        if (graficoIngresosInstancia) graficoIngresosInstancia.destroy();

        graficoIngresosInstancia = new Chart(ctxIngresos, {
            type: 'line', 
            data: {
                labels: etiquetasIngresos,
                datasets: [{
                    label: 'Ingresos ($)',
                    data: valoresIngresos,
                    borderColor: '#D4A347', 
                    backgroundColor: 'rgba(212, 163, 71, 0.2)', 
                    borderWidth: 3,
                    tension: 0.4, 
                    fill: true, 
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#D4A347',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f0f0f0' },
                        ticks: { callback: function(value) { return '$' + value.toLocaleString('es-AR'); } }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // 2. GRÁFICO DE TURNOS
        const ctxTurnos = document.getElementById('graficoTurnos').getContext('2d');
        if (graficoTurnosInstancia) graficoTurnosInstancia.destroy();

        graficoTurnosInstancia = new Chart(ctxTurnos, {
            type: 'bar', 
            data: {
                labels: diasSemana, 
                datasets: [{
                    label: 'Cantidad de Turnos',
                    data: valoresTurnos, 
                    backgroundColor: '#daab53', 
                    borderRadius: 6 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f0f0f0' },
                        ticks: { stepSize: 1 } 
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // 3. GRÁFICO DE SERVICIOS ESTRELLA
        const respServicios = await fetch(`http://localhost:3000/api/dashboard/servicios-estrella?desde=${desde}&hasta=${hasta}`);
        if (respServicios.ok) {
            const datosServicios = await respServicios.json();
            
            const etiquetasServicios = datosServicios.map(d => d.Nombre);
            const valoresCantidades = datosServicios.map(d => d.Cantidad);

            const ctxServicios = document.getElementById('graficoServicios').getContext('2d');
            if (graficoServiciosInstancia) graficoServiciosInstancia.destroy();

            graficoServiciosInstancia = new Chart(ctxServicios, {
                type: 'bar', 
                data: {
                    labels: etiquetasServicios,
                    datasets: [{
                        label: 'Veces realizado',
                        data: valoresCantidades,
                        backgroundColor: 'rgba(40, 167, 69, 0.7)', 
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y', 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: '#f0f0f0' },
                            ticks: { stepSize: 1 }
                        },
                        y: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        // 4. GRÁFICO DE TOP EMPLEADAS
        const respEmp = await fetch(`http://localhost:3000/api/dashboard/top-empleadas?desde=${desde}&hasta=${hasta}`);
        if (respEmp.ok) {
            const datosEmp = await respEmp.json();
            const ctxEmpleadas = document.getElementById('graficoEmpleadas').getContext('2d');
            
            if (graficoEmpleadasInstancia) graficoEmpleadasInstancia.destroy();
            
            graficoEmpleadasInstancia = new Chart(ctxEmpleadas, {
                type: 'doughnut', 
                data: {
                    labels: datosEmp.map(d => d.Nombre),
                    datasets: [{ 
                        data: datosEmp.map(d => d.Cantidad), 
                        backgroundColor: ['#d4af37', '#17a2b8', '#28a745', '#e6c875', '#6c757d'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                }, 
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } 
                    },
                    cutout: '65%' 
                }
            });
        }

    } catch (error) {
        console.error("Error cargando los gráficos:", error);
    }
}


// ==========================================================================
// 10. MÓDULO DE CONFIGURACIÓN GENERAL (Config / Ajustes)
// ==========================================================================

function cambiarVistaConfig(vista) {
    // 1. Agregamos las variables para la sección del bot
    const vistaGastos = document.getElementById('vistaConfigGastos');
    const vistaServicios = document.getElementById('vistaConfigServicios');
    const vistaHorarios = document.getElementById('vistaConfigHorarios');
    const vistaPagos = document.getElementById('vistaConfigPagos'); 
    const vistaBot = document.getElementById('seccion-bot'); // <-- Contenedor del bot
    
    const btnGastos = document.getElementById('btnVistaConfigGastos');
    const btnServicios = document.getElementById('btnVistaConfigServicios');
    const btnHorarios = document.getElementById('btnVistaConfigHorarios');
    const btnPagos = document.getElementById('btnVistaConfigPagos'); 
    const btnBot = document.getElementById('btnVistaConfigBot');

    if (vistaGastos) vistaGastos.style.display = 'none';
    if (vistaServicios) vistaServicios.style.display = 'none';
    if (vistaHorarios) vistaHorarios.style.display = 'none';
    if (vistaPagos) vistaPagos.style.display = 'none';
    if (vistaBot) vistaBot.style.display = 'none';
    
    if (btnGastos) btnGastos.classList.remove('active');
    if (btnServicios) btnServicios.classList.remove('active');
    if (btnHorarios) btnHorarios.classList.remove('active');
    if (btnPagos) btnPagos.classList.remove('active');
    if (btnBot) btnBot.classList.remove('active');

    // 3. Mostramos solo la vista que el usuario seleccionó
    if (vista === 'gastos') {
        if (vistaGastos) vistaGastos.style.display = 'block';
        if (btnGastos) btnGastos.classList.add('active');
    
    } else if (vista === 'servicios') {
        if (vistaServicios) vistaServicios.style.display = 'block';
        if (btnServicios) btnServicios.classList.add('active');
        cargarTablaConfigServicios();
        cargarTablaConfigAreas();
    
    } else if (vista === 'horarios') {
        if (vistaHorarios) vistaHorarios.style.display = 'block';
        if (btnHorarios) btnHorarios.classList.add('active');
        cargarTablaConfigHorarios();
        
    } else if (vista === 'pagos') {
        if (vistaPagos) vistaPagos.style.display = 'block';
        if (btnPagos) btnPagos.classList.add('active');
        cargarTablaMediosPago(); 
        
    } else if (vista === 'bot') {
        if (vistaBot) vistaBot.style.display = 'block';
        if (btnBot) btnBot.classList.add('active');
        
        if (typeof chequearEstadoBot === 'function') chequearEstadoBot();
        if (typeof cargarTablaPlantillasBot === 'function') cargarTablaPlantillasBot(); // <-- ¡LÍNEA NUEVA!
    }
}

// --- CONFIG: CATEGORÍAS GASTOS ---
const modalCategoria = document.getElementById('modalNuevaCategoria');

async function cargarTablaConfigCategorias() {
    const tbody = document.getElementById('tablaConfigCategoriasBody');
    if (!tbody) return;
    
    try {
        const respuesta = await fetch('http://localhost:3000/api/categorias-gastos');
        const categorias = await respuesta.json();
        
        tbody.innerHTML = '';
        
        if (categorias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--texto-claro);">No hay categorías registradas.</td></tr>';
            return;
        }
        
        categorias.forEach(cat => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--borde)';
            const nombreCategoria = String(cat.Nombre ?? '').replace(/'/g, "\\'");
            tr.innerHTML = `
                <td style="padding: 8px 15px; color: var(--texto-claro); font-weight: 500;">${cat.Id_Categoria}</td>
                <td style="padding: 8px 15px; font-weight: 500; color: var(--texto-oscuro);">${cat.Nombre}</td>
                <td style="padding: 8px 15px; text-align: center;">
                    <button class="btn-icon" style="color: #17a2b8; border-color: #b8daff; margin-right: 8px;" onclick="editarCategoriaGasto(${cat.Id_Categoria}, '${nombreCategoria}')" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon" style="color: #dc3545; border-color: #f5c6cb;" onclick="eliminarCategoriaGasto(${cat.Id_Categoria})" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#d9534f;">Error al cargar la tabla.</td></tr>';
    }
}

function abrirModalNuevaCategoria() { 
    document.querySelector('#modalNuevaCategoria h2').textContent = 'Nueva Categoría';
    document.getElementById('idCategoriaOculto').value = ''; 
    document.getElementById('nombreNuevaCategoriaInput').value = ''; 
    document.getElementById('modalNuevaCategoria').classList.add('active'); 
}

function editarCategoriaGasto(id, nombre) {
    document.querySelector('#modalNuevaCategoria h2').textContent = 'Editar Categoría';
    document.getElementById('idCategoriaOculto').value = id;
    document.getElementById('nombreNuevaCategoriaInput').value = nombre;
    if (modalCategoria) modalCategoria.classList.add('active');
}

function cerrarModalNuevaCategoria() {
    if (modalCategoria) modalCategoria.classList.remove('active');
}

async function guardarNuevaCategoria() {
    const idOculto = document.getElementById('idCategoriaOculto').value;
    const nombre = document.getElementById('nombreNuevaCategoriaInput').value.trim();
    
    if (!nombre) {
        mostrarNotificacion("Por favor, escribí un nombre para la categoría.", "warning");
        return;
    }

    const url = idOculto 
        ? `http://localhost:3000/api/categorias-gastos/${idOculto}` 
        : 'http://localhost:3000/api/categorias-gastos';
    const metodoElegido = idOculto ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodoElegido,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Nombre: nombre })
        });

        if (respuesta.ok) {
            mostrarNotificacion(idOculto ? "Categoría actualizada." : "¡Categoría creada!", "success");
            cerrarModalNuevaCategoria();
            cargarTablaConfigCategorias(); 
            cargarCategoriasGasto();       
        } else {
            mostrarNotificacion("Hubo un error al guardar la categoría.", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}

async function eliminarCategoriaGasto(id) {
    const confirmacion = await pedirConfirmacion("¿Estás segura de que querés borrar esta categoría? Si hay gastos registrados con ella, podrían quedar sin tipo.");
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/categorias-gastos/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            mostrarNotificacion("Categoría eliminada con éxito.", "success");
            cargarTablaConfigCategorias();
            cargarCategoriasGasto();
        } else {
            mostrarNotificacion("No se pudo eliminar la categoría.", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

// --- CONFIG: SERVICIOS ---
const modalServicio = document.getElementById('modalNuevoServicio');

async function cargarTablaConfigServicios() {
    const tbody = document.getElementById('tablaConfigServiciosBody');
    if (!tbody) return;
    
    try {
        const respuesta = await fetch('http://localhost:3000/api/servicios');
        const servicios = await respuesta.json();
        
        tbody.innerHTML = '';
        
        if (servicios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--texto-claro);">No hay servicios registrados.</td></tr>';
            return;
        }
        
        servicios.forEach(srv => {
            const precioSeguro = Number(srv.Precio_Base || srv.precio_base || srv.precioBase || srv.Precio || srv.precio || 0);
            const areaSegura = srv.Area || srv.area || srv.Id_Area || srv.id_area || 'Sin área';
            const nombreServicio = String(srv.Nombre || srv.nombre || '').replace(/'/g, "\\'");

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--borde)';
            tr.innerHTML = `
                <td style="padding: 8px 15px; color: var(--texto-claro); font-weight: 500;">${srv.Id_Servicio || srv.id_servicio}</td>
                <td style="padding: 8px 15px; font-weight: 500; color: var(--texto-oscuro);">${srv.Nombre || srv.nombre}</td>
                <td style="padding: 8px 15px; color: var(--texto-claro);"><span style="background: #eef2f5; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #555;">${areaSegura}</span></td>
                <td style="padding: 8px 15px; font-weight: 600; color: #333;">$${precioSeguro.toLocaleString('es-AR')}</td>
                <td style="padding: 8px 15px; text-align: center;">
                    <button class="btn-icon" style="color: #17a2b8; border-color: #b8daff; margin-right: 8px;" onclick="editarServicio(${srv.Id_Servicio || srv.id_servicio}, '${nombreServicio}', '${srv.Id_Area || srv.id_area || ''}', ${precioSeguro})" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon" style="color: #dc3545; border-color: #f5c6cb;" onclick="eliminarServicio(${srv.Id_Servicio || srv.id_servicio})" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#d9534f;">Error al cargar la tabla.</td></tr>';
    }
}

async function cargarAreasEnModal() {
    try {
        const res = await fetch('http://localhost:3000/api/areas'); 
        const areas = await res.json();
        const select = document.getElementById('areaNuevoServicioInput');
        select.innerHTML = '<option value="">Seleccionar área...</option>';
        areas.forEach(a => {
            select.innerHTML += `<option value="${a.Id_Area || a.id_area}">${a.Area || a.area}</option>`; 
        });
    } catch(error) {
        console.error("Error al cargar las áreas:", error);
    }
}

async function abrirModalNuevoServicio() {
    document.getElementById('tituloModalServicio').textContent = 'Nuevo Servicio';
    document.getElementById('idServicioOculto').value = '';
    document.getElementById('nombreNuevoServicioInput').value = '';
    document.getElementById('precioNuevoServicioInput').value = '';
    await cargarAreasEnModal();
    if (modalServicio) modalServicio.classList.add('active');
}

async function editarServicio(id, nombre, area, precio) {
    document.getElementById('tituloModalServicio').textContent = 'Editar Servicio';
    document.getElementById('idServicioOculto').value = id;
    document.getElementById('nombreNuevoServicioInput').value = nombre;
    document.getElementById('precioNuevoServicioInput').value = precio;
    await cargarAreasEnModal();
    document.getElementById('areaNuevoServicioInput').value = area;
    if (modalServicio) modalServicio.classList.add('active');
}

function cerrarModalNuevoServicio() {
    if (modalServicio) modalServicio.classList.remove('active');
}

async function guardarNuevoServicio() {
    const idOculto = document.getElementById('idServicioOculto').value;
    const nombre = document.getElementById('nombreNuevoServicioInput').value.trim();
    const area = document.getElementById('areaNuevoServicioInput').value;
    const precio = document.getElementById('precioNuevoServicioInput').value;
    
    if (!nombre || !area || !precio) {
        mostrarNotificacion("Por favor completá todos los campos.", "warning");
        return;
    }

    const url = idOculto 
        ? `http://localhost:3000/api/servicios/${idOculto}` 
        : 'http://localhost:3000/api/servicios';
    const metodoElegido = idOculto ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodoElegido,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Nombre: nombre, Id_Area: area, Precio_Base: parseFloat(precio) })
        });

        if (respuesta.ok) {
            mostrarNotificacion(idOculto ? "Servicio actualizado con éxito." : "¡Servicio creado!", "success");
            cerrarModalNuevoServicio();
            cargarTablaConfigServicios(); 
        } else {
            mostrarNotificacion("Hubo un error al guardar.", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}

async function eliminarServicio(id) {
    const confirmacion = await pedirConfirmacion("¿Atención: estás segura de que querés borrar este servicio? Esto podría afectar turnos e ingresos pasados vinculados.");
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/servicios/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            mostrarNotificacion("Servicio eliminado con éxito.", "success");
            cargarTablaConfigServicios();
        } else {
            mostrarNotificacion("No se pudo eliminar el servicio.", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

// --- CONFIG: ÁREAS ---
const modalArea = document.getElementById('modalNuevaArea');

async function cargarTablaConfigAreas() {
    const tbody = document.getElementById('tablaConfigAreasBody');
    if (!tbody) return;
    
    try {
        const respuesta = await fetch('http://localhost:3000/api/areas');
        const areas = await respuesta.json();
        
        tbody.innerHTML = '';
        
        if (areas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--texto-claro);">No hay áreas registradas.</td></tr>';
            return;
        }
        
        areas.forEach(a => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--borde)';
            const nombreArea = String(a.Area || a.area || '').replace(/'/g, "\\'");
            tr.innerHTML = `
                <td style="padding: 8px 15px; color: var(--texto-claro); font-weight: 500;">${a.Id_Area || a.id_area}</td>
                <td style="padding: 8px 15px; font-weight: 500; color: var(--texto-oscuro);">${a.Area || a.area}</td>
                <td style="padding: 8px 15px; text-align: center;">
                    <button class="btn-icon" style="color: #17a2b8; border-color: #b8daff; margin-right: 8px;" onclick="editarArea(${a.Id_Area || a.id_area}, '${nombreArea}')" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon" style="color: #dc3545; border-color: #f5c6cb;" onclick="eliminarArea(${a.Id_Area || a.id_area})" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#d9534f;">Error al cargar la tabla de áreas.</td></tr>';
    }
}

function abrirModalNuevaArea() {
    document.getElementById('tituloModalArea').textContent = 'Nueva Área';
    document.getElementById('idAreaOculto').value = '';
    document.getElementById('nombreNuevaAreaInput').value = '';
    if (modalArea) modalArea.classList.add('active');
}

function editarArea(id, nombre) {
    document.getElementById('tituloModalArea').textContent = 'Editar Área';
    document.getElementById('idAreaOculto').value = id;
    document.getElementById('nombreNuevaAreaInput').value = nombre;
    if (modalArea) modalArea.classList.add('active');
}

function cerrarModalArea() {
    if (modalArea) modalArea.classList.remove('active');
}

async function guardarArea() {
    const idOculto = document.getElementById('idAreaOculto').value;
    const nombre = document.getElementById('nombreNuevaAreaInput').value.trim();
    
    if (!nombre) {
        mostrarNotificacion("Por favor ingresá un nombre para el área.", "warning");
        return;
    }

    const url = idOculto 
        ? `http://localhost:3000/api/areas/${idOculto}`
        : 'http://localhost:3000/api/areas';
    const metodoElegido = idOculto ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodoElegido,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Area: nombre })
        });

        if (respuesta.ok) {
            mostrarNotificacion(idOculto ? "Área actualizada." : "Área creada.", "success");
            cerrarModalArea();
            cargarTablaConfigAreas(); 
            if (typeof cargarAreasEnModal === 'function') cargarAreasEnModal();
        } else {
            mostrarNotificacion("Hubo un error al guardar el área.", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}

async function eliminarArea(id) {
    const confirmacion = await pedirConfirmacion("¿Atención: borrar esta área podría dejar a los servicios asociados sin categoría. ¿Confirmás?");
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/areas/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            mostrarNotificacion("Área eliminada.", "success");
            cargarTablaConfigAreas();
            if (typeof cargarAreasEnModal === 'function') cargarAreasEnModal();
        } else {
            mostrarNotificacion("No se pudo eliminar el área.", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

// --- CONFIG: HORARIOS DE ATENCIÓN ---
function limpiarHoraSQL(valor) {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (!isNaN(fecha.getTime())) {
        const horas = String(fecha.getHours()).padStart(2, '0');
        const minutos = String(fecha.getMinutes()).padStart(2, '0');
        return `${horas}:${minutos}`;
    }
    return '';
}

function cargarEventosBotonesDias() {
    document.querySelectorAll('.btn-dia-horario').forEach(btn => {
        btn.onclick = function() {
            this.classList.toggle('active');
        };
    });
}

function toggleCerrado() {
    const isCerrado = document.getElementById('checkCerrado').checked;
    ['horarioAp1', 'horarioCi1', 'horarioAp2', 'horarioCi2'].forEach(id => {
        document.getElementById(id).disabled = isCerrado;
    });
}

async function cargarTablaConfigHorarios() {
    const visor = document.getElementById('visorHorariosActuales');
    if (!visor) return;

    try {
        const respuesta = await fetch('http://localhost:3000/api/horarios');
        const horarios = await respuesta.json();

        visor.innerHTML = '';
        horarios.forEach(dia => {
            const esLaborable = dia.Laborable;
            
            let textoHorario = esLaborable 
                ? `<span style="color:#28a745; font-weight:500;">${limpiarHoraSQL(dia.Hora_Apertura_1)} a ${limpiarHoraSQL(dia.Hora_Cierre_1)}</span>` 
                : '<span style="color:#dc3545; font-weight:500;">Cerrado</span>';
            
            if (esLaborable && dia.Hora_Apertura_2 && dia.Hora_Cierre_2) {
                textoHorario += `<br><span style="color:#17a2b8; font-weight:500;">${limpiarHoraSQL(dia.Hora_Apertura_2)} a ${limpiarHoraSQL(dia.Hora_Cierre_2)}</span>`;
            }

            visor.innerHTML += `
                <div style="font-size: 13px; line-height: 1.5; padding: 10px; background: #fff; border: 1px solid #f0f0f0; border-radius: 6px;">
                    <strong style="display:block; color:#333; margin-bottom: 4px;">${dia.Dia_Semana}</strong>
                    ${textoHorario}
                </div>
            `;
        });
        
        cargarEventosBotonesDias();

    } catch (error) {
        console.error("Error cargando horarios", error);
    }
}

async function guardarHorarioEnLote() {
    const botonesActivos = document.querySelectorAll('.btn-dia-horario.active');
    const diasIds = Array.from(botonesActivos).map(b => parseInt(b.getAttribute('data-id')));

    if (diasIds.length === 0) {
        mostrarNotificacion("Seleccioná al menos un día para actualizar.", "warning");
        return;
    }

    const esCerrado = document.getElementById('checkCerrado').checked;
    const ap1 = document.getElementById('horarioAp1').value;
    const ci1 = document.getElementById('horarioCi1').value;
    const ap2 = document.getElementById('horarioAp2').value;
    const ci2 = document.getElementById('horarioCi2').value;

    if (!esCerrado && (!ap1 || !ci1)) {
        mostrarNotificacion("Para días laborables, el Turno 1 (Mañana) es obligatorio.", "warning");
        return;
    }

    const payload = {
        diasIds: diasIds,
        Laborable: !esCerrado,
        Hora_Apertura_1: esCerrado ? null : (ap1 || null),
        Hora_Cierre_1: esCerrado ? null : (ci1 || null),
        Hora_Apertura_2: esCerrado ? null : (ap2 || null),
        Hora_Cierre_2: esCerrado ? null : (ci2 || null)
    };

    try {
        const btnGuardar = event.currentTarget; 
        const textoOriginal = btnGuardar.textContent;
        btnGuardar.textContent = 'Guardando...';
        btnGuardar.style.opacity = '0.7';

        const respuesta = await fetch('http://localhost:3000/api/horarios/bulk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (respuesta.ok) {
            mostrarNotificacion("Horarios actualizados con éxito.", "success");
            cargarTablaConfigHorarios(); 
        } else {
            mostrarNotificacion("Error al actualizar la base de datos.", "error");
        }

        btnGuardar.textContent = textoOriginal;
        btnGuardar.style.opacity = '1';

    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error de conexión.", "error");
    }
}

// --- CONFIG: MEDIOS DE PAGO ---
function abrirModalMedioPago(id = '', nombre = '') {
    document.getElementById('idMedioPagoOculto').value = id;
    document.getElementById('nombreMedioPagoInput').value = nombre;

    const titulo = document.getElementById('tituloModalMedioPago');
    if (titulo) {
        titulo.textContent = id ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago';
    }

    const modal = document.getElementById('modalMedioPago');
    if (modal) modal.classList.add('active');
}

function cerrarModalMedioPago() {
    const modal = document.getElementById('modalMedioPago');
    if (modal) modal.classList.remove('active');
}

async function guardarMedioPago() {
    const id = document.getElementById('idMedioPagoOculto').value;
    const nombre = document.getElementById('nombreMedioPagoInput').value.trim();

    if (!nombre) {
        mostrarNotificacion('Por favor, ingresá un nombre.', 'warning');
        return;
    }

    const url = id ? `http://localhost:3000/api/medios-pago/${id}` : 'http://localhost:3000/api/medios-pago';
    const metodo = id ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Nombre: nombre })
        });

        if (respuesta.ok) {
            mostrarNotificacion(id ? 'Método actualizado con éxito' : 'Nuevo método guardado', 'success');
            cerrarModalMedioPago(); 
            cargarTablaMediosPago(); 
            cargarMediosDePago(); 
        } else {
            mostrarNotificacion('Error al guardar en el servidor', 'error');
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion('No se pudo conectar con el servidor', 'error');
    }
}

async function eliminarMedioPago(id) {
    const confirmacion = await pedirConfirmacion('¿Estás segura de que querés borrar este método de pago?');
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(`http://localhost:3000/api/medios-pago/${id}`, {
            method: 'DELETE'
        });

        if (respuesta.ok) {
            mostrarNotificacion('Método de pago eliminado', 'success');
            cargarTablaMediosPago();
            cargarMediosDePago();
        } else {
            mostrarNotificacion('Error al intentar eliminar', 'error');
        }
    } catch (error) {
        console.error(error);
        mostrarNotificacion('No se pudo conectar con el servidor', 'error');
    }
}

// ==========================================================================
// 11. MÓDULO DE WHATSAPP BOT (Estado, QR y Envío de Mensajes)
// ==========================================================================

// CONTROLADOR DEL PANEL DEL BOT DE WHATSAPP (FRONTEND)
const chequearEstadoBot = async () => {
    try {
        // Consultamos la ruta que creamos en el backend
        const respuesta = await fetch('http://localhost:3000/api/bot/status');
        const data = await respuesta.json();
        
        const spanEstado = document.getElementById('bot-estado-texto');
        const contenedorQr = document.getElementById('bot-qr-container');
        const imgQr = document.getElementById('bot-qr-img');

        if (!spanEstado || !contenedorQr || !imgQr) return; // Por si no estamos en la pestaña de configuración

        spanEstado.innerText = data.estado;

        // Si está esperando QR, usamos una API gratuita para dibujar la imagen
        if (data.estado === 'Esperando QR' && data.qr) {
            imgQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr)}`;
            contenedorQr.style.display = 'block';
            spanEstado.style.color = '#e67e22'; // Naranja
        } 
        // Si el bot ya está conectado, escondemos el QR
        else if (data.estado === 'Conectado') {
            contenedorQr.style.display = 'none';
            spanEstado.style.color = '#27ae60'; // Verde
        } 
        // Si está desconectado o apagado
        else {
            contenedorQr.style.display = 'none';
            spanEstado.style.color = '#e74c3c'; // Rojo
        }
    } catch (error) {
        console.error('Error al consultar el estado del bot:', error);
        document.getElementById('bot-estado-texto').innerText = 'Backend apagado';
    }
};

// Hacemos que la página chequee el estado automáticamente cada 3 segundos
setInterval(chequearEstadoBot, 3000);

// Ejecutamos la primera consulta apenas carga la página
chequearEstadoBot();

// CONTROLADORES DEL MODAL DE PLANTILLAS DEL BOT
let plantillasEnMemoria = []; // Guardamos los datos temporalmente para no volver a consultar

// Modificamos sutilmente la función anterior para guardar los datos en memoria
const cargarTablaPlantillasBot = async () => {
    const tbody = document.getElementById('tablaPlantillasBotBody');
    if (!tbody) return;

    try {
        const respuesta = await fetch('http://localhost:3000/api/bot/plantillas');
        const plantillas = await respuesta.json();
        
        plantillasEnMemoria = plantillas; // Guardamos en la variable global
        tbody.innerHTML = ''; 

        if (plantillas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--texto-claro);">No hay plantillas configuradas.</td></tr>';
            return;
        }

        plantillas.forEach(plan => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--borde)';
            
            tr.innerHTML = `
                <td style="padding: 12px 15px; color: var(--texto-oscuro); font-weight: 500;">${plan.Nombre_Funcion}</td>
                <td style="padding: 12px 15px; color: var(--texto-claro); max-width: 400px; white-space: pre-wrap;">${plan.Texto_Mensaje}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <button onclick="abrirModalEditarPlantilla(${plan.Id_Plantilla})" style="background: none; border: none; cursor: pointer; color: #666;" title="Editar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar plantillas:', error);
    }
};

const abrirModalEditarPlantilla = (id) => {
    const plantilla = plantillasEnMemoria.find(p => p.Id_Plantilla === id);
    if (!plantilla) return;
    
    document.getElementById('idPlantillaEdit').value = plantilla.Id_Plantilla;
    document.getElementById('textoPlantillaEdit').value = plantilla.Texto_Mensaje;
    
    document.getElementById('modalEditarPlantillaBot').style.display = 'flex';
};

const cerrarModalPlantillaBot = () => {
    document.getElementById('modalEditarPlantillaBot').style.display = 'none';
};

const guardarPlantillaBot = async () => {
    const id = document.getElementById('idPlantillaEdit').value;
    const nuevoTexto = document.getElementById('textoPlantillaEdit').value;
    
    try {
        const response = await fetch(`http://localhost:3000/api/bot/plantillas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto: nuevoTexto })
        });
        
        if (response.ok) {
            cerrarModalPlantillaBot();
            cargarTablaPlantillasBot(); // Recargamos la tabla para ver el texto nuevo
        } else {
            console.error('Error al guardar en el servidor');
        }
    } catch (error) {
        console.error('Error de conexión:', error);
    }
};