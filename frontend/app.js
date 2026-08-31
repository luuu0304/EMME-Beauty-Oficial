// ==========================================================================
// ÍNDICE DEL DOCUMENTO
// 1. UTILIDADES GLOBALES Y NOTIFICACIONES
// 2. NAVEGACIÓN Y MENÚ LATERAL
// 3. MÓDULO DE TURNOS Y CALENDARIO
// 4. MÓDULO DE CLIENTAS (Incluye Perfil e Historial)
// 5. MÓDULO DE EMPLEADAS
// 6. MÓDULO DE GASTOS
// 7. MÓDULO DE INGRESOS
// 8. MÓDULO DE COBRO Y EXTRAS
// 9. MÓDULO CONFIGURACIÓN
// 10. SECCIÓN: DASHBOARD Y MÉTRICAS
// ==========================================================================


// ==========================================================================
// 1. UTILIDADES GLOBALES Y NOTIFICACIONES
// ==========================================================================

// Sistema de notificaciones (Toasts)
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

// Inicialización general al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    cargarClientas();
    cargarEmpleadas();
    cargarServicios();
    cargarCategoriasGasto();
    cargarExtrasDisponibles();
    inicializarFechaAgenda();
    inicializarAgendaDiaria();
    cargarDatosDashboard();
    cargarMediosDePago();
    
    // Leer el anotador al arrancar
    const seccionGuardada = localStorage.getItem('emme_seccion_activa');
    if (seccionGuardada) {
        // Buscamos el botón que tenga ese mismo texto y le hacemos un "clic fantasma"
        const botonSeleccionado = Array.from(botonesMenu).find(b => b.textContent.trim() === seccionGuardada);
        if (botonSeleccionado) {
            botonSeleccionado.click();
        }
    }
    //  Inicializar el calendario de rango (Flatpickr)
    const inputRango = document.getElementById('rangoFechasCustomDash');
    if (inputRango) {
        flatpickr(inputRango, {
            mode: "range",
            locale: "es", 
            dateFormat: "Y-m-d", 
            onChange: function(selectedDates, dateStr, instance) {
                // Cuando eligen LAS DOS fechas, llamamos al servidor
                if (selectedDates.length === 2) {
                    const desde = formatoFechaSQL(selectedDates[0]);
                    const hasta = formatoFechaSQL(selectedDates[1]);
                    cargarDatosDashboard(desde, hasta); 
                }
            }
        });
    }

    // Inicializar Flatpickr para el Historial de Cobros
    const inputRangoCobros = document.getElementById('rangoFechaCobros');
    if (inputRangoCobros) {
        flatpickr(inputRangoCobros, {
            mode: "range",
            locale: "es",
            dateFormat: "Y-m-d",
            onChange: function(selectedDates) {
                if (selectedDates.length === 2 || selectedDates.length === 0) {
                    aplicarFiltrosCobros();
                }
            }
        });
    }

    // Lógica del desplegable
    const selectFiltroDash = document.getElementById('filtroRapidoDash');
    if (selectFiltroDash) {
        selectFiltroDash.addEventListener('change', (e) => {
            if (e.target.value === 'personalizado') {
                inputRango.style.display = 'block';
            } else {
                inputRango.style.display = 'none';
                cargarDatosDashboard(); // Si elige un rango rápido, carga de nuevo
            }
        });
    }
});

// Sistema de Confirmación Personalizado (Promesa)
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

// ---------------------------------------------------------
// LÓGICA DE FILTROS ESTANDARIZADOS (Gastos e Ingresos)
// ---------------------------------------------------------

// Inicializar Flatpickr para Gastos
const inputRangoGastos = document.getElementById('rangoFechaGastos');
if (inputRangoGastos) {
    flatpickr(inputRangoGastos, {
        mode: "range",
        locale: "es",
        dateFormat: "Y-m-d",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) aplicarFiltrosGastos(); // Llama a tu función de filtrado
        }
    });
}

// Alternar vista de filtros en Gastos
const modoGastos = document.getElementById('modoFechaGastos');
if (modoGastos) {
    modoGastos.addEventListener('change', (e) => {
        if (e.target.value === 'rango') {
            document.getElementById('contenedorMesGastos').style.display = 'none';
            inputRangoGastos.style.display = 'block';
        } else {
            document.getElementById('contenedorMesGastos').style.display = 'flex';
            inputRangoGastos.style.display = 'none';
            aplicarFiltrosGastos(); // Recalcula si volvemos a "Mes"
        }
    });
}

// Inicializar Flatpickr para Ingresos
const inputRangoIngresos = document.getElementById('rangoFechaIngresos');
if (inputRangoIngresos) {
    flatpickr(inputRangoIngresos, {
        mode: "range",
        locale: "es",
        dateFormat: "Y-m-d",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) filtrarIngresos(); // Llama a tu función de filtrado
        }
    });
}

// Alternar vista de filtros en Ingresos
const modoIngresos = document.getElementById('modoFechaIngresos');
if (modoIngresos) {
    modoIngresos.addEventListener('change', (e) => {
        if (e.target.value === 'rango') {
            document.getElementById('contenedorMesIngresos').style.display = 'none';
            inputRangoIngresos.style.display = 'block';
        } else {
            document.getElementById('contenedorMesIngresos').style.display = 'flex';
            inputRangoIngresos.style.display = 'none';
            filtrarIngresos(); // Recalcula si volvemos a "Mes"
        }
    });
}

// ==========================================================================
// 2. NAVEGACIÓN, MENÚ LATERAL Y PERSISTENCIA DE ESTADO
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
const btnMenuConfig = document.getElementById('btnMenuConfig');

// ==========================================
// ROUTER DE LA APLICACIÓN (History API)
// ==========================================

const rutas = {
    '/': 'seccionTurnos',
    '/turnos': 'seccionTurnos',
    '/clientas': 'seccionClientas',
    '/empleados': 'seccionEmpleados',
    '/gastos': 'seccionGastos',
    '/ingresos': 'seccionIngresos',
    '/resumenes': 'seccionResumenes',
    '/configuracion': 'seccionConfiguracion'
};

function router() {
    let path = window.location.pathname.replace('/frontend/index.html', '') || '/';
    if (path === '') path = '/';

    const idSeccion = rutas[path] || 'seccionTurnos';

    // 1. Ocultamos todas las secciones
    const todasLasSecciones = [
        'seccionTurnos', 'seccionClientas', 'seccionEmpleados', 
        'seccionGastos', 'seccionIngresos', 'seccionResumenes', 'seccionConfiguracion'
    ];
    
    todasLasSecciones.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.style.display = 'none';
    });

    // 2. Mostramos solo la sección activa
    const seccionActiva = document.getElementById(idSeccion);
    if (seccionActiva) seccionActiva.style.display = 'block';

    // 3. Pintamos de mostaza el menú correspondiente
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-link') === path) {
            item.classList.add('active');
        }
    });

    // 4. ¡NUEVO! Actualizamos el Título y los Botones de la Cabecera
    actualizarCabecera(path);
}

// Función que controla la UI del Header según donde estemos parados
function actualizarCabecera(ruta) {
    const tituloHeader = document.querySelector('.header h1');
    
    // Primero apagamos todos los botones y buscadores
    document.getElementById('buscadorClientas').style.display = 'none';
    document.getElementById('buscadorEmpleadas').style.display = 'none';
    document.getElementById('btnNuevaClienta').style.display = 'none';
    document.getElementById('btnNuevoTurno').style.display = 'none';
    document.getElementById('btnNuevaEmpleada').style.display = 'none';
    document.getElementById('btnNuevoGasto').style.display = 'none';
    document.getElementById('btnNuevoIngreso').style.display = 'none';

    // Luego prendemos solo lo que corresponde según la ruta actual
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
    }
}

// Función principal del menú
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

        btnNuevoTurno.style.display = 'none';
        btnNuevaClienta.style.display = 'none';
        btnNuevaEmpleada.style.display = 'none';
        btnNuevoGasto.style.display = 'none';
        buscadorClientas.style.display = 'none';
        if (btnNuevoIngreso) btnNuevoIngreso.style.display = 'none';
        
        if (buscadorEmpleadas) buscadorEmpleadas.style.display = 'none'; 

        const opcionSeleccionada = boton.textContent.trim();

        // Guardamos dónde hizo clic el usuario
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
        }
    });
});

// Lógica del buscador de empleadas
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
// 3. MÓDULO DE TURNOS Y CALENDARIO
// ==========================================================================

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendario');
    
    if (calendarEl) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            locale: 'es', 
            height: 'auto',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridWeek,timeGridDay'
            },
            slotMinTime: '09:30:00', 
            slotMaxTime: '21:30:00', 
            allDaySlot: false, 
            events: 'http://localhost:3000/api/turnos',
            eventColor: 'var(--mostaza)'
        });
        calendar.render();
    }
});

const modalTurno = document.getElementById('modalNuevoTurno');

function abrirModalTurno() {
    if (modalTurno) modalTurno.classList.add('active');
}

function cerrarModalTurno() {
    if (modalTurno) modalTurno.classList.remove('active');
}

if (modalTurno) {
    modalTurno.addEventListener('click', function(e) {
        if(e.target === modalTurno) cerrarModalTurno();
    });
}

const inputFechaTurno = document.getElementById('fechaTurnoInput');
if (inputFechaTurno) {
    const hoy = new Date().toISOString().split('T')[0];
    inputFechaTurno.setAttribute('min', hoy);
}

const btnNuevaExpress = document.getElementById('btnNuevaClientaExpress');
const btnCancelarExpress = document.getElementById('btnCancelarExpress');
const grupoSeleccion = document.getElementById('grupoSeleccionClienta');
const grupoExpress = document.getElementById('grupoClientaExpress');
const inputNombreExpress = document.getElementById('nombreExpress');
const inputApellidoExpress = document.getElementById('apellidoExpress');

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

    // --- NUEVA VALIDACIÓN DINÁMICA DE HORARIOS ---
    try {
        const resHorarios = await fetch('http://localhost:3000/api/horarios');
        const horariosVal = await resHorarios.json();
        
        const idDia = obtenerIdDiaSemana(fecha);
        const horarioDiaElegido = horariosVal.find(h => h.Id_Horario === idDia);

        if (!horarioDiaElegido || !horarioDiaElegido.Laborable) {
            mostrarNotificacion("El local se encuentra cerrado el día seleccionado.", "warning");
            return; // Cortamos la ejecución acá, no se guarda el turno
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
            return; // Cortamos la ejecución acá, no se guarda el turno
        }
    } catch (err) {
        console.error("Error al validar horarios dinámicos:", err);
    }
    // ----------------------------------------------

    const inputSenaTurno = document.getElementById('senaTurnoInput');
    const montoSena = inputSenaTurno && inputSenaTurno.value ? parseFloat(inputSenaTurno.value) : 0;

    const fechaHoraCompleta = `${fecha}T${hora}:00`;
    const nuevoTurno = {
        Id_Clienta: parseInt(idClientaFinal), 
        Id_Empleada: parseInt(idEmpleada),
        Id_Servicio: parseInt(idServicio),
        Fecha_Hora: fechaHoraCompleta,
        Sena_Monto: montoSena 
    };

    try {
        const respuesta = await fetch('http://localhost:3000/api/turnos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoTurno)
        });

        if (respuesta.ok) {
            mostrarNotificacion("Turno agendado con éxito.", "success");
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

// 1. Variable global para guardar los servicios en memoria
let listaServiciosGlobal = [];

// 2. Reemplazamos tu cargarServicios original
async function cargarServicios() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/servicios');
        listaServiciosGlobal = await respuesta.json(); // Guardamos TODOS los servicios acá
        
        // Llenamos el primer select (Áreas)
        await cargarAreasEnModalTurno();
    } catch (error) {
        console.error("Error conectando con la API de servicios:", error);
    }
}

// 3. NUEVA FUNCIÓN: Trae las áreas para el primer select
async function cargarAreasEnModalTurno() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/areas');
        const areas = await respuesta.json();
        
        const selectArea = document.getElementById('areaTurno');
        if (selectArea) {
            selectArea.innerHTML = '<option value="">Seleccione un área...</option>';
            areas.forEach(area => {
                // Imprimimos el fantasma en la consola para ver su verdadera identidad
                console.log("Datos del área recibida:", area); 

                const opcion = document.createElement('option');
                opcion.value = area.Id_Area;
                
                // Le decimos que intente con las variaciones más comunes de tu DB
                opcion.textContent = area.Nombre || area.Nombre_Area || area.Area || area.Descripcion || "Área sin nombre"; 
                
                selectArea.appendChild(opcion);
            });
        }
    } catch (error) {
        console.error("Error cargando áreas:", error);
    }
}

// 4. NUEVA FUNCIÓN: Se ejecuta al elegir un Área y desbloquea los Servicios
function filtrarServiciosPorAreaEnModal() {
    const idAreaSeleccionada = document.getElementById('areaTurno').value;
    const selectServicio = document.getElementById('servicioTurno');
    const selectEmpleada = document.getElementById('empleadaTurno');
    
    // Reseteamos los selects dependientes
    selectServicio.innerHTML = '<option value="">Seleccione un servicio...</option>';
    selectEmpleada.innerHTML = '<option value="">Primero elija un servicio...</option>';
    
    // Bloqueamos a la profesional por seguridad
    selectEmpleada.disabled = true;
    selectEmpleada.style.backgroundColor = '#f8f9fa';

    // Si vuelve a la opción vacía, bloqueamos el servicio y cortamos acá
    if (!idAreaSeleccionada) {
        selectServicio.disabled = true;
        selectServicio.style.backgroundColor = '#f8f9fa';
        return;
    }

    // Filtramos la lista global buscando solo los servicios de esa área
    const serviciosFiltrados = listaServiciosGlobal.filter(s => s.Id_Area == idAreaSeleccionada);

    // Llenamos el select con el resultado
    serviciosFiltrados.forEach(servicio => {
        const opcion = document.createElement('option');
        opcion.value = servicio.Id_Servicio;
        opcion.textContent = servicio.Nombre;
        selectServicio.appendChild(opcion);
    });

    // ¡Habilitamos el select de servicios para que puedan elegir!
    selectServicio.disabled = false;
    selectServicio.style.backgroundColor = 'white';
}

async function cargarBotonesAreasAgenda() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/areas');
        const areas = await respuesta.json();
        
        const contenedorFiltros = document.getElementById('filtrosEspecialidad');
        
        if (!contenedorFiltros) return;

        // Por cada área que venga de la base de datos, creamos un botón
        areas.forEach(area => {
            const nombreArea = area.Nombre || area.Nombre_Area || area.Area || "Área sin nombre";
            
            const boton = document.createElement('button');
            boton.className = 'btn-secundario filtro-btn';
            
            // Le damos el estilo de "inactivo" por defecto (fondo blanco, borde gris)
            boton.style.cssText = 'border-radius: 20px; background: white; border: 1px solid #ccc; padding: 6px 15px; cursor: pointer;';
            boton.textContent = nombreArea;
            
            // Le conectamos tu función que ya funciona perfecto
            boton.onclick = function() { 
                filtrarAgendaPorArea(nombreArea, this); 
            };
            
            contenedorFiltros.appendChild(boton);
        });
    } catch (error) {
        console.error("Error cargando los botones de áreas:", error);
    }
}

// ==========================================================================
// VARIABLES GLOBALES Y HELPERS DE LA NUEVA AGENDA DINÁMICA
// ==========================================================================
let empleadasAgendaGlobal = [];
let horariosAgendaGlobal = [];

// Helper para saber qué día de la semana es en la fecha seleccionada
function obtenerIdDiaSemana(fechaStr) {
    const [y, m, d] = fechaStr.split('-');
    const fecha = new Date(y, m - 1, d);
    let diaJS = fecha.getDay(); // JS nos dice: 0 = Domingo, 1 = Lunes
    return diaJS === 0 ? 7 : diaJS; // Lo pasamos al formato de nuestra base (1 al 7)
}

// Helper para generar los intervalos de 30 minutos
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
        minActual += 30; // Saltos de a media hora
    }
    return bloques;
}

// ==========================================================================
// INICIALIZACIÓN DE LA AGENDA
// ==========================================================================
async function inicializarAgendaDiaria() {
    try {
        await cargarBotonesAreasAgenda();
        // 1. Traemos las profesionales
        const resEmp = await fetch('http://localhost:3000/api/empleadas');
        empleadasAgendaGlobal = await resEmp.json();

        // 2. Traemos la configuración de los horarios (El "Cerebro")
        const resHor = await fetch('http://localhost:3000/api/horarios');
        horariosAgendaGlobal = await resHor.json();

        // 3. Dibujamos el encabezado de las profesionales
        const agendaHeader = document.getElementById('agendaHeader');
        if (agendaHeader) {
            agendaHeader.innerHTML = '<div class="hora-col">Hora</div>';
            empleadasAgendaGlobal.forEach(emp => {
                agendaHeader.innerHTML += `<div class="col-emp-${emp.Id_Empleada}" data-areas="${emp.Areas || ''}" style="font-weight: 600; color: #333;">${emp.Nombre_Ap}</div>`;
            });
        }

        // 4. Configuramos los botones de las fechas
        const inputFecha = document.getElementById('fechaAgendaInput');
        const btnAnterior = document.getElementById('btnDiaAnterior');
        const btnSiguiente = document.getElementById('btnDiaSiguiente');

        if (inputFecha) {
            inputFecha.addEventListener('change', actualizarGrillaDiaria);
            
            if (btnAnterior) {
                // Borramos eventos viejos clonando el botón para evitar que salte 2 días seguidos
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

        // 5. Arrancamos el dibujo del día de hoy
        actualizarGrillaDiaria();
    } catch (error) {
        console.error("Error al cargar la agenda diaria:", error);
    }
}

// ==========================================
// AUTO-SCROLL A LA HORA ACTUAL (V.2)
// ==========================================
function enfocarHoraActual() {
    const ahora = new Date();
    let hora = ahora.getHours();
    let minutos = ahora.getMinutes();

    const minStr = minutos < 30 ? '00' : '30';
    const horaStr = `${String(hora).padStart(2, '0')}:${minStr}`;

    // 1. Lógica para la Vista Diaria
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

    // 2. Lógica para la Vista Semanal
    const vistaSemanal = document.getElementById('vistaSemanal');
    if (vistaSemanal && vistaSemanal.style.display !== 'none') {
        const contenedorSemanal = document.querySelector('#vistaSemanal .agenda-container');
        const filasSemanales = document.querySelectorAll('#agendaSemanalBody > div'); // Las filas de la semana
        
        for (let fila of filasSemanales) {
            const colHora = fila.querySelector('.hora-col');
            if (colHora && colHora.textContent.trim() === horaStr) {
                contenedorSemanal.scrollTo({ top: fila.offsetTop - 50, behavior: 'smooth' });
                fila.style.backgroundColor = '#fffaf0'; // Le damos un fondito cálido
                break;
            }
        }
    }
}

// LA MAGIA DE LA GRILLA DINÁMICA
async function actualizarGrillaDiaria() {
    const inputFecha = document.getElementById('fechaAgendaInput');
    if (!inputFecha || !inputFecha.value) return;

    // Buscamos las reglas del día elegido
    const idDia = obtenerIdDiaSemana(inputFecha.value);
    const horarioHoy = horariosAgendaGlobal.find(h => h.Id_Horario === idDia);

    const agendaBody = document.getElementById('agendaBody');
    if (!agendaBody) return;
    agendaBody.innerHTML = ''; 

    // Regla 1: ¿Está cerrado?
    if (!horarioHoy || !horarioHoy.Laborable) {
        agendaBody.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: #dc3545; background: #fff8f8; border-radius: 8px; width: 100%; border: 1px dashed #f5c6cb;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">LOCAL CERRADO ESTE DÍA</span>
            </div>
        `;
        return;
    }

    // Regla 2: Extraemos y limpiamos las horas (usando tu función del Módulo 9)
    let ap1 = limpiarHoraSQL(horarioHoy.Hora_Apertura_1);
    let ci1 = limpiarHoraSQL(horarioHoy.Hora_Cierre_1);
    let ap2 = limpiarHoraSQL(horarioHoy.Hora_Apertura_2);
    let ci2 = limpiarHoraSQL(horarioHoy.Hora_Cierre_2);

    // Regla 3: Generamos los bloques combinados
    let bloques = [
        ...generarBloques(ap1, ci1),
        ...generarBloques(ap2, ci2)
    ];

    let ultimoMinuto = -1;

    // Regla 4: Dibujamos las filas
    bloques.forEach(horaStr => {
        let [h, m] = horaStr.split(':').map(Number);
        let minActual = h * 60 + m;

        // ¡DETALLE PREMIUM! Si detectamos un salto mayor a 30 min, dibujamos la Siesta
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

    // 5. Inyectamos los turnos sobre la nueva grilla flexible
    await cargarTurnosAgenda();

    // 6. Si la fecha que estamos viendo es HOY, hacemos el auto-scroll
    const fechaHoy = new Date().toISOString().split('T')[0];
    if (inputFecha.value === fechaHoy) {
        // Le damos un respiro de 100ms para asegurar que el DOM terminó de pintar los turnos
        setTimeout(enfocarHoraActual, 100); 
    }
}

let filtroAgendaActual = 'Todo';

function filtrarAgendaPorArea(areaSeleccionada, btnPulsado) {
    filtroAgendaActual = areaSeleccionada;

    // 1. Efecto visual: despintamos todos los botones y pintamos el que tocaste
    if (btnPulsado) {
        const botones = document.querySelectorAll('#filtrosEspecialidad .filtro-btn');
        botones.forEach(b => {
            // Volvemos todos al estado inactivo (fondo blanco, texto oscuro)
            b.style.background = 'white';
            b.style.border = '1px solid #ccc';
            b.style.color = '#333';
        });
        
        // Pintamos el botón presionado con el color de EMME
        btnPulsado.style.background = 'var(--mostaza, #d4af37)'; 
        btnPulsado.style.border = '1px solid var(--mostaza, #d4af37)';
        btnPulsado.style.color = 'white';
    }

    // 2. Lógica de filtrado: recorremos a las chicas
    if (typeof empleadasAgendaGlobal !== 'undefined') {
        empleadasAgendaGlobal.forEach(emp => {
            const areasDeLaEmpleada = (emp.Areas || '').toLowerCase();
            const areaBuscada = areaSeleccionada.toLowerCase();
            
            // Chequeamos si pasa el filtro
            const debeMostrar = (areaSeleccionada === 'Todo' || areasDeLaEmpleada.includes(areaBuscada));

            // 3. Ocultamos o mostramos TODAS sus celdas (las de arriba y las de abajo)
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

    if (vista === 'diaria') {
        vistaDiaria.style.display = 'block';
        vistaSemanal.style.display = 'none';
        btnDiaria.classList.add('active');
        btnSemanal.classList.remove('active');
    } else if (vista === 'semanal') {
        vistaDiaria.style.display = 'none';
        vistaSemanal.style.display = 'block';
        btnSemanal.classList.add('active');
        btnDiaria.classList.remove('active');
        
        inicializarAgendaSemanal();
        cargarTurnosSemana();
        setTimeout(enfocarHoraActual, 100);
    }
}

// LÓGICA DE TURNOS SEMANALES Y MODAL AGRUPADO
async function cargarTurnosSemana() {
    const inputFecha = document.getElementById('fechaAgendaInput');
    if (!inputFecha || !inputFecha.value) return;

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

        const todosLosTurnos = [];
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
            const cantidad = celda.turnosAgrupados ? celda.turnosAgrupados.length : 0;
            
            if (cantidad > 0) {
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
        tarjeta.style.borderLeft = `4px solid ${turno.Color || '#f6c23e'}`;
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
                turno.Comentario_Admin
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

// Cerrar modal de turnos agrupados al hacer clic afuera
const modalTurnosAgrupados = document.getElementById('modalTurnos');
if (modalTurnosAgrupados) {
    modalTurnosAgrupados.addEventListener('click', function(e) {
        // e.target es exactamente el elemento que recibió el clic.
        // Si es el fondo oscuro (el modal-overlay en sí) y no la tarjeta blanca de adentro, lo cerramos.
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
}

function inicializarAgendaSemanal() {
    const agendaBody = document.getElementById('agendaSemanalBody');
    if (!agendaBody) return;
    
    agendaBody.innerHTML = ''; 

    const horaInicio = 9; 
    const horaFin = 20;   

    for (let hora = horaInicio; hora <= horaFin; hora++) {
        let stringHoraEnPunto = hora.toString().padStart(2, '0') + ':00';
        agendaBody.appendChild(crearFilaSemanal(stringHoraEnPunto));
        
        if (hora < horaFin) {
            let stringHoraMedia = hora.toString().padStart(2, '0') + ':30';
            agendaBody.appendChild(crearFilaSemanal(stringHoraMedia));
        }
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
                        turno.Comentario_Admin || ''
                    );
                };
                tarjeta.innerHTML = `
                    <div class="turno-titulo">${turno.Nombre_Clienta}</div>
                    <div class="turno-detalle">${turno.Nombre_Servicio}</div>
                `;

                celdaDestino.appendChild(tarjeta);
            }
        });
    } catch (error) {
        console.error("Error inyectando turnos en la agenda:", error);
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
// 4. MÓDULO DE CLIENTAS
// ==========================================================================

const modal = document.getElementById('modalNuevaClienta');

function abrirModal() {
    if (modal) modal.classList.add('active');
}

function cerrarModal() {
    if (modal) modal.classList.remove('active');
}

if (modal) {
    modal.addEventListener('click', function(e) {
        if(e.target === modal) cerrarModal();
    });
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

// --- Lógica del Historial Estético (Modal Perfil) ---
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
                // Pequeña corrección acá: separamos por ' | ' que es lo que guarda la nueva ruta
                const detalles = turno.Color.split(' | ');
                detalles.forEach(detalle => {
                    if(detalle.trim() !== '') {
                        tagsHTML += `<span style="background: #f0e6d2; color: #8b6d3b; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-right: 5px; display: inline-block; margin-top: 8px;">${detalle.trim()}</span>`;
                    }
                });
            }

            // NUEVO: Dibujamos la nota interna si existe
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
        
        // Llamamos a la función que dibuja el HTML por primera vez con TODAS las clientas
        renderizarClientas(listaGlobalClientas);
    } catch (error) {
        console.error("Error conectando con la API de clientas:", error);
    }
}

// Sacamos toda la lógica de dibujo a una función separada para poder reutilizarla
function renderizarClientas(clientasParaMostrar) {
    const contenedorTarjetas = document.getElementById('vistaClientasTarjetas');
    const tbodyLista = document.getElementById('tablaClientasBody');
    
    if (contenedorTarjetas) contenedorTarjetas.innerHTML = '';
    if (tbodyLista) tbodyLista.innerHTML = '';

    // Si el filtro no encuentra a nadie, mostramos un mensajito amigable
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
            // Cortamos la fecha para quedarnos solo con el "YYYY-MM-DD"
            const fechaLimpia = clienta.Fecha_Nac.split('T')[0];
            
            // Configuramos para que solo muestre el día y el mes (Ej: "04 de mayo")
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

// La función mágica del CRM
function aplicarFiltroClientas() {
    const filtroElegido = document.getElementById('filtroRetencionClientas').value;
    const hoy = new Date();
    
    // Si elige "todas", mandamos la lista global entera
    if (filtroElegido === 'todas') {
        renderizarClientas(listaGlobalClientas);
        return;
    }

    const clientasFiltradas = listaGlobalClientas.filter(clienta => {
        // Asegurate de que este nombre (Fecha_Ultimo_Turno) sea el que manda tu backend. 
        // Si se llama Ultimo_Turno o Fecha, cambialo acá abajo:
        const fechaUltimoVisita = clienta.Fecha_Ultimo_Turno;
        // Si la clienta es nueva y nunca tuvo un turno, la filtramos para que no rompa la matemática
        if (!fechaUltimoVisita) return false;

        const fechaObj = new Date(fechaUltimoVisita);
        
        // Calculamos cuántos días de diferencia hay entre hoy y su último turno
        const milisegundos = hoy.getTime() - fechaObj.getTime();
        const diasPasados = Math.floor(milisegundos / (1000 * 60 * 60 * 24));

        if (filtroElegido === 'este_mes') {
            return fechaObj.getMonth() === hoy.getMonth() && fechaObj.getFullYear() === hoy.getFullYear();
        } 
        else if (filtroElegido === '15_dias') {
            // Vino hace más de 15 días, pero menos de 30
            return diasPasados >= 15 && diasPasados < 30;
        } 
        else if (filtroElegido === '30_dias') {
            // Vino hace más de un mes, pero menos de dos
            return diasPasados >= 30 && diasPasados < 60;
        } 
        else if (filtroElegido === '60_dias') {
            // Colgada total, hace más de dos meses que no viene
            return diasPasados >= 60;
        }
        
        return true;
    });

    // Dibujamos solo las que pasaron el filtro
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

const inputBuscador = document.getElementById('buscadorClientas');
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

let listaGlobalClientas = []; 

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
// 5. MÓDULO DE EMPLEADAS
// ==========================================================================

const modalEmpleada = document.getElementById('modalNuevaEmpleada');

function abrirModalEmpleada() {
    if (modalEmpleada) modalEmpleada.classList.add('active');
}

function cerrarModalEmpleada() {
    if (modalEmpleada) modalEmpleada.classList.remove('active');
}

if (modalEmpleada) {
    modalEmpleada.addEventListener('click', function(e) {
        if(e.target === modalEmpleada) cerrarModalEmpleada();
    });
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

// --- Modal de Detalle de Sueldo ---
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

// --- Modal de Especialidades y Comisiones ---
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

// ==========================================
// HISTORIAL DE COBROS (EMPLEADAS)
// ==========================================
let memoriaLiquidaciones = [];

function cambiarVistaEmpleadas(vista) {
    const vistaSaldos = document.getElementById('vistaSaldosEmpleadas');
    const vistaCobros = document.getElementById('vistaCobrosEmpleadas');
    const btnSaldos = document.getElementById('btnVistaSaldos');
    const btnCobros = document.getElementById('btnVistaCobros');
    
    // Agarramos los controles GLOBALES del header
    const buscadorPrincipal = document.getElementById('buscadorEmpleadas'); 
    const btnNueva = document.getElementById('btnNuevaEmpleada');

    if (vista === 'saldos') {
        vistaSaldos.style.display = 'block';
        vistaCobros.style.display = 'none';
        btnSaldos.classList.add('active');
        btnCobros.classList.remove('active');
        
        // Mostramos los controles globales
        if (buscadorPrincipal) buscadorPrincipal.style.display = 'inline-block';
        if (btnNueva) btnNueva.style.display = 'inline-block';
        
    } else if (vista === 'cobros') {
        vistaSaldos.style.display = 'none';
        vistaCobros.style.display = 'block';
        btnCobros.classList.add('active');
        btnSaldos.classList.remove('active');
        
        // Ocultamos los controles globales porque acá tenemos filtros propios
        if (buscadorPrincipal) buscadorPrincipal.style.display = 'none';
        if (btnNueva) btnNueva.style.display = 'none';
        
        cargarHistorialCobros(); 
    }
}

async function cargarHistorialCobros() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/liquidaciones');
        memoriaLiquidaciones = await respuesta.json();
        aplicarFiltrosCobros(); // Dibuja la tabla inicial
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
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#888;">No se encontraron registros de cobro con esos filtros.</td></tr>';
        return;
    }

    lista.forEach(liq => {
        const fechaObj = new Date(liq.Fecha);
        const fechaLimpia = new Date(fechaObj.getTime() + fechaObj.getTimezoneOffset() * 60000).toLocaleDateString('es-AR');
        
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 15px; color: #555;">${fechaLimpia}</td>
                <td style="padding: 15px; font-weight: 500; color: #333;">${liq.Nombre_Ap}</td>
                <td style="padding: 15px; text-align: right; font-weight: 600; color: #28a745;">$${liq.Monto_Total.toLocaleString('es-AR')}</td>
            </tr>
        `;
    });
}

// ==========================================================================
// 6. MÓDULO DE GASTOS
// ==========================================================================

const modalGasto = document.getElementById('modalNuevoGasto');

function abrirModalGasto() {
    if (modalGasto) modalGasto.classList.add('active');
}

function cerrarModalGasto() {
    if (modalGasto) modalGasto.classList.remove('active');
}

if (modalGasto) {
    modalGasto.addEventListener('click', function(e) {
        if(e.target === modalGasto) cerrarModalGasto();
    });
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

let memoriaGastos = [];

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


// ==========================================================================
// 7. MÓDULO DE INGRESOS
// ==========================================================================

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
            
            // Si hay concepto lo mostramos tal cual (ej: "Turno: Manicura"), sino usamos el nombre del servicio.
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
        
        // Buscamos los dos <select> que tenemos en el HTML
        const selectCobroTurno = document.getElementById('selectMedioPago');
        const selectNuevoIngreso = document.getElementById('pagoIngresoManual');
        
        // Armamos las opciones en HTML
        let opcionesHTML = '';
        if (medios.length === 0) {
            opcionesHTML = '<option value="">No hay medios cargados</option>';
        } else {
            medios.forEach(medio => {
                // Guardamos el Nombre en el value para no romper la lógica actual de guardado
                opcionesHTML += `<option value="${medio.Nombre}">${medio.Nombre}</option>`;
            });
        }
        
        // Inyectamos las opciones si los select existen
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
            
            // Limpiamos el nombre por si tiene comillas (buena práctica que tenías en tu código)
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

// ==========================================================================
// 8. MÓDULO DE COBRO Y EXTRAS
// ==========================================================================

const modalDetalleTurno = document.getElementById('modalDetalleTurno');
let precioBaseActual = 0;

// 1. Agregamos el parámetro comentarioAdmin al final
function abrirModalDetalleTurno(idTurno, nombreClienta, nombreServicio, precioBase, estado, color, sena = 0, comentarioAdmin = '') {
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

    document.getElementById('colorTurnoInput').value = '';
    
    // Asignamos el valor al nuevo input de la nota adhesiva
    const inputComentario = document.getElementById('comentarioAdminInput');
    if (inputComentario) {
        inputComentario.value = (comentarioAdmin && comentarioAdmin !== 'null') ? comentarioAdmin : '';
    }
    
    const contenedorColores = document.getElementById('listaColoresGuardados');
    contenedorColores.innerHTML = ''; 
    
    if (color && color !== 'null') {
        const arrayColores = color.split(' | ');
        arrayColores.forEach(c => {
            contenedorColores.innerHTML += `<span style="background: #e2e3e5; color: #383d41; padding: 4px 10px; border-radius: 15px; font-size: 12px;"> ${c}</span>`;
        });
    }
    const badgeEstado = document.getElementById('estadoTurnoBadge');
    badgeEstado.textContent = estado || 'Pendiente';
    
    const btnCobrar = document.getElementById('btnConfirmarCobro'); 
    const btnGuardar = document.getElementById('btnGuardarDetalles');
    const inputColor = document.getElementById('colorTurnoInput');
    const inputDescuento = document.getElementById('descuentoCobroInput');
    const checkboxes = document.querySelectorAll('.check-extra');
    
    const btnActualizarSena = document.querySelector('button[onclick="guardarSenaIndependiente()"]');
    
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
        if (inputComentario) inputComentario.disabled = true; // Bloqueamos la nota si está pagado
        if (inputSena) inputSena.disabled = true;
        if (btnActualizarSena) btnActualizarSena.disabled = true;
        checkboxes.forEach(chk => chk.disabled = true);
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
        if (inputComentario) inputComentario.disabled = false; // Habilitamos la nota
        if (inputSena) inputSena.disabled = false;
        if (btnActualizarSena) btnActualizarSena.disabled = false;
        checkboxes.forEach(chk => chk.disabled = false);
    }

    document.getElementById('descuentoCobroInput').value = 0;
    checkboxes.forEach(chk => chk.checked = false);
    
    if (typeof recalcularTotalCobro === 'function') {
        recalcularTotalCobro();
    }
    
    const modalDetalleTurno = document.getElementById('modalDetalleTurno');
    if (modalDetalleTurno) modalDetalleTurno.classList.add('active');
}

// 2. Modificamos para enviar la nota al backend
async function guardarDetallesTurno() {
    const idTurno = document.getElementById('idTurnoCobroOculto').value;
    const colorElegido = document.getElementById('colorTurnoInput').value;
    const comentario = document.getElementById('comentarioAdminInput').value;
    
    // Ahora permite guardar si hay un color O un comentario
    if (!colorElegido.trim() && !comentario.trim()) {
        mostrarNotificacion("Escribí un color o comentario para guardar", "warning");
        return;
    }
    
    try {
        const respuesta = await fetch(`http://localhost:3000/api/turnos/${idTurno}/detalles`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                Color: colorElegido,
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

if (modalDetalleTurno) {
    modalDetalleTurno.addEventListener('click', function(e) {
        if(e.target === modalDetalleTurno) cerrarModalDetalleTurno();
    });
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

    const senaInput = document.getElementById('senaDetalleInput').value;
    const senaAbonada = senaInput ? parseFloat(senaInput) : 0;

    let totalFinal = precioBaseActual + sumaExtras - descuento - senaAbonada;
    
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
    
    const senaInput = document.getElementById('senaDetalleInput').value;
    const senaAbonada = senaInput ? parseFloat(senaInput) : 0;
    
    const extrasSeleccionados = [];
    let sumaExtras = 0;
    
    const checkboxes = document.querySelectorAll('.check-extra:checked');
    checkboxes.forEach(chk => {
        extrasSeleccionados.push(parseInt(chk.getAttribute('data-id')));
        sumaExtras += parseFloat(chk.value);
    });

    let totalFinal = precioBaseActual + sumaExtras - descuento - senaAbonada;
    if (totalFinal < 0) totalFinal = 0;

    const datosCobro = {
        idTurno: parseInt(idTurno),
        montoTotal: totalFinal,
        medioPago: medioPago,
        descuento: descuento,
        extras: extrasSeleccionados
    };

    try {
        const respuesta = await fetch('http://localhost:3000/api/cobrar-turno', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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

const modalNuevoIngreso = document.getElementById('modalNuevoIngreso');

function abrirModalNuevoIngreso() {
    document.getElementById('conceptoIngresoManual').value = '';
    document.getElementById('montoIngresoManual').value = '';
    
    const modal = document.getElementById('modalNuevoIngreso');
    
    if (modal) {
        modal.classList.add('active');
    } else {
        console.error("¡Ojo! No encontré el modal. Revisá que el ID en el HTML sea 'modalNuevoIngreso'.");
    }
}

function cerrarModalNuevoIngreso() {
    const modal = document.getElementById('modalNuevoIngreso');
    if (modal) {
        modal.classList.remove('active');
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

    try {
        const respuesta = await fetch('http://localhost:3000/api/ingresos/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Concepto: concepto,
                Monto_Total: parseFloat(monto),
                Medio_Pago: medioPago
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
// 9. MÓDULO DE CONFIGURACIÓN
// ==========================================================================

// --- NAVEGACIÓN INTERNA DE CONFIGURACIÓN ---
function cambiarVistaConfig(vista) {
    const vistaGastos = document.getElementById('vistaConfigGastos');
    const vistaServicios = document.getElementById('vistaConfigServicios');
    const vistaHorarios = document.getElementById('vistaConfigHorarios');
    const vistaPagos = document.getElementById('vistaConfigPagos'); // Agregamos la nueva
    
    const btnGastos = document.getElementById('btnVistaConfigGastos');
    const btnServicios = document.getElementById('btnVistaConfigServicios');
    const btnHorarios = document.getElementById('btnVistaConfigHorarios');
    const btnPagos = document.getElementById('btnVistaConfigPagos'); // Agregamos el nuevo

    // Apagamos todo de forma segura
    if (vistaGastos) vistaGastos.style.display = 'none';
    if (vistaServicios) vistaServicios.style.display = 'none';
    if (vistaHorarios) vistaHorarios.style.display = 'none';
    if (vistaPagos) vistaPagos.style.display = 'none';
    
    if (btnGastos) btnGastos.classList.remove('active');
    if (btnServicios) btnServicios.classList.remove('active');
    if (btnHorarios) btnHorarios.classList.remove('active');
    if (btnPagos) btnPagos.classList.remove('active');

    // Prendemos solo lo que toca
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
        // ¡Acá llamamos a la función que vamos a crear ya mismo!
        cargarTablaMediosPago(); 
    }
}

// ==========================================
// CONFIGURACIÓN DE GASTOS (CATEGORÍAS)
// ==========================================
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
    document.getElementById('idCategoriaOculto').value = '';
    document.getElementById('nombreNuevaCategoriaInput').value = '';
    if (modalCategoria) modalCategoria.classList.add('active');
}

function editarCategoriaGasto(id, nombre) {
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


// ==========================================
// CONFIGURACIÓN DE SERVICIOS
// ==========================================
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

// ==========================================
// CONFIGURACIÓN DE ÁREAS (CATEGORÍAS)
// ==========================================
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

// ==========================================
// CONFIGURACIÓN DE HORARIOS DE ATENCIÓN
// ==========================================

function limpiarHoraSQL(valor) {
    if (!valor) return '';
    // La BD manda "1970-01-01T12:30:00.000Z" (que en Salta es 09:30 local).
    // Al crear new Date(), JS aplica el offset de tu zona horaria y devuelve la hora correcta.
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

// ==========================================
// CONFIGURACIÓN DE MEDIOS DE PAGO
// ==========================================

function abrirModalMedioPago(id = '', nombre = '') {
    document.getElementById('idMedioPagoOculto').value = id;
    document.getElementById('nombreMedioPagoInput').value = nombre;

    const titulo = document.getElementById('tituloModalMedioPago');
    if (titulo) {
        titulo.textContent = id ? 'Editar Medio de Pago' : 'Nuevo Medio de Pago';
    }

    // ARREGLO 1: Usamos classList.add('active') en vez de display flex
    const modal = document.getElementById('modalMedioPago');
    if (modal) modal.classList.add('active');
}

// Agregamos la función para cerrar correctamente
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
            cerrarModalMedioPago(); // Usamos la nueva función
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
    // ARREGLO 2: Usamos tu cartel de confirmación lindo en vez de confirm()
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
// 10. SECCIÓN: DASHBOARD Y MÉTRICAS
// ==========================================================================

// Helper: Formatea una fecha de JS a 'YYYY-MM-DD'
const formatoFechaSQL = (fecha) => {
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// Obtiene las fechas de inicio y fin según el filtro rápido seleccionado
function obtenerFechasFiltroRapido(tipoFiltro) {
    const hoy = new Date();
    let desde = new Date();
    let hasta = new Date();

    if (tipoFiltro === 'hoy') {
        // 'desde' y 'hasta' ya son hoy
    } else if (tipoFiltro === 'ultimos_7_dias') {
        desde.setDate(hoy.getDate() - 7);
    } else if (tipoFiltro === 'este_mes') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (tipoFiltro === 'ultimo_mes') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0); // El día 0 es el último día del mes anterior
    }
    
    return { desde: formatoFechaSQL(desde), hasta: formatoFechaSQL(hasta) };
}

// Llama al servidor y actualiza las tarjetitas
async function cargarDatosDashboard(desdeCustom = null, hastaCustom = null) {
    let desde, hasta;

    if (desdeCustom && hastaCustom) {
        // Si usamos el calendario de rango (Flatpickr)
        desde = desdeCustom;
        hasta = hastaCustom;
    } else {
        // Si usamos el menú desplegable rápido
        const selectFiltro = document.getElementById('filtroRapidoDash');
        if (selectFiltro && selectFiltro.value !== 'personalizado') {
            const fechas = obtenerFechasFiltroRapido(selectFiltro.value);
            desde = fechas.desde;
            hasta = fechas.hasta;
        } else {
            return; // Está en 'personalizado' pero aún no eligió fechas, no hacemos nada
        }
    }

    try {
        const respuesta = await fetch(`http://localhost:3000/api/dashboard/kpis?desde=${desde}&hasta=${hasta}`);
        const kpis = await respuesta.json();

        // Actualizamos el HTML formateando los números con separadores de miles
        document.getElementById('dashIngresos').textContent = `$${kpis.Ingresos.toLocaleString('es-AR')}`;
        document.getElementById('dashGastos').textContent = `$${kpis.Gastos.toLocaleString('es-AR')}`;
        document.getElementById('dashSueldos').textContent = `$${kpis.Sueldos.toLocaleString('es-AR')}`;
        document.getElementById('dashGanancia').textContent = `$${kpis.GananciaNeta.toLocaleString('es-AR')}`;

        // Llamamos a que se dibuje el gráfico con las mismas fechas
        cargarGraficoDashboard(desde, hasta);

    } catch (error) {
        console.error("Error cargando métricas del dashboard:", error);
    }
}

// Variables globales para guardar los gráficos
let graficoIngresosInstancia = null;
let graficoTurnosInstancia = null;
let graficoServiciosInstancia = null;

// Llama al servidor y dibuja AMBOS gráficos
async function cargarGraficoDashboard(desde, hasta) {
    try {
        const respuesta = await fetch(`http://localhost:3000/api/dashboard/grafico-ingresos?desde=${desde}&hasta=${hasta}`);
        
        if (!respuesta.ok) return;

        const datos = await respuesta.json();

        // ==========================================
        // DATOS PARA GRÁFICO 1 (Ingresos por fecha)
        // ==========================================
        const etiquetasIngresos = datos.map(d => d.Dia);
        const valoresIngresos = datos.map(d => d.Total);

        // ==========================================
        // DATOS PARA GRÁFICO 2 (Turnos por Día Fijo)
        // ==========================================
        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const valoresTurnos = [0, 0, 0, 0, 0, 0, 0]; // Empezamos todo en cero

        // Recorremos los datos de la base de datos y los acomodamos en su día correspondiente
        datos.forEach(d => {
            if (d.Turnos > 0) {
                // Le agregamos la hora T00:00:00 para evitar que JavaScript se confunda con la zona horaria
                const fechaObj = new Date(d.FechaCompleta + 'T00:00:00');
                let diaIdx = fechaObj.getDay(); // JS nos devuelve: 0 = Domingo, 1 = Lunes, etc.
                
                // Lo acomodamos para que encaje con nuestro array (Lunes = 0, Domingo = 6)
                diaIdx = diaIdx === 0 ? 6 : diaIdx - 1;
                
                // Sumamos los turnos de esa fecha a la cajita de su día
                valoresTurnos[diaIdx] += d.Turnos;
            }
        });

        // ==========================================
        // 1. GRÁFICO DE INGRESOS (Ola Mostaza)
        // ==========================================
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

        // ==========================================
        // 2. GRÁFICO DE TURNOS (Barras Fijas L a D)
        // ==========================================
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

        // ==========================================
        // 3. GRÁFICO DE SERVICIOS ESTRELLA (Horizontal)
        // ==========================================
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

    } catch (error) {
        console.error("Error cargando los gráficos:", error);
    }
}

// ==========================================
// LÓGICA DEL MENÚ DESPLEGABLE / HAMBURGUESA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnMenu = document.getElementById('btnToggleMenu');
    const sidebar = document.getElementById('sidebar');

    if (btnMenu && sidebar) {
        btnMenu.addEventListener('click', () => {
            // Si estamos en celular, abrimos/cerramos tipo cajón
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('mobile-open');
            } else {
                // Si estamos en la compu, colapsamos/expandimos la barra
                sidebar.classList.toggle('collapsed');
            }
        });
    }
});