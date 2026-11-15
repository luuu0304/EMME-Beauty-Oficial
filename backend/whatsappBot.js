// backend/whatsappBot.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Directorios fijos de autenticación y sesión
const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');
const SESSION_DIR = path.join(AUTH_DIR, 'session');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Variables de estado del bot
let client = null;
let estadoBot = 'Iniciando sistema...';
let qrActual = '';
let reiniciando = false;
let iniciando = false;

/**
 * Normaliza números telefónicos de Argentina al formato internacional de WhatsApp
 * (549 + código de área sin 0 + número sin 15)
 */
const normalizarTelefonoWhatsApp = (numero) => {
    if (!numero) return null;
    let limpio = String(numero).replace(/\D/g, '');

    if (limpio.startsWith('00')) {
        limpio = limpio.slice(2);
    }

    // Si empieza con 549 y ya tiene 13 dígitos (ej: 5493874123456)
    if (limpio.startsWith('549') && limpio.length >= 12) {
        return limpio;
    }

    // Si empieza con 54 pero sin el 9 móvil (ej: 543874123456)
    if (limpio.startsWith('54') && !limpio.startsWith('549') && limpio.length >= 11) {
        limpio = limpio.slice(2);
    }

    // Quitamos el 0 inicial del código de área (ej: 0387...)
    if (limpio.startsWith('0')) {
        limpio = limpio.slice(1);
    }

    // Si tiene 12 dígitos por incluir el prefijo 15 luego del código de área (ej: 387154123456)
    if (limpio.length === 12) {
        limpio = limpio.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    } else if (limpio.length === 11 && limpio.startsWith('15')) {
        limpio = limpio.slice(2);
    }

    if (limpio.length < 8) return null;

    if (!limpio.startsWith('549')) {
        limpio = `549${limpio}`;
    }

    return limpio;
};

/**
 * Elimina bloqueos residuales de Chromium (SingletonLock, SingletonSocket, SingletonCookie)
 * que impiden que Chrome vuelva a abrir con el mismo userDataDir si no cerró limpiamente.
 */
const limpiarBloqueosDeSesion = () => {
    try {
        if (!fs.existsSync(SESSION_DIR)) return;

        const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'DevToolsActivePort'];
        for (const file of lockFiles) {
            const filePath = path.join(SESSION_DIR, file);
            try {
                // lstatSync detecta tanto enlaces simbólicos como archivos comunes
                const stats = fs.lstatSync(filePath);
                if (stats.isSymbolicLink() || stats.isFile()) {
                    if (file === 'SingletonLock') {
                        try {
                            const linkTarget = fs.readlinkSync(filePath);
                            const parts = linkTarget.split('-');
                            const pid = parseInt(parts[parts.length - 1], 10);
                            if (pid && !isNaN(pid) && pid !== process.pid) {
                                try {
                                    // Verificamos si el proceso todavía existe
                                    process.kill(pid, 0);
                                    console.log(`[WhatsApp Bot] Detectado proceso residual de Chrome (PID ${pid}). Cerrándolo...`);
                                    try {
                                        process.kill(pid, 'SIGKILL');
                                    } catch (kErr) {}
                                } catch (e) {
                                    // ESRCH: el proceso ya no existe, sólo quedó el archivo
                                }
                            }
                        } catch (errLink) {}
                    }
                    fs.unlinkSync(filePath);
                    console.log(`[WhatsApp Bot] Bloqueo residual eliminado: ${file}`);
                }
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    // Silencioso si no existe
                }
            }
        }
    } catch (e) {
        console.warn('[WhatsApp Bot] Aviso limpiando bloqueos de sesión:', e.message);
    }
};

/**
 * Cierra limpiamente el cliente actual, matando el subproceso de Chrome si queda colgado
 * y liberando listeners de eventos para evitar fugas de memoria.
 */
const cerrarClienteActual = async () => {
    if (!client) return;

    console.log('[WhatsApp Bot] Cerrando instancia previa del bot...');
    const instanciaPrevia = client;
    client = null;

    let browserPid = null;
    try {
        if (instanciaPrevia.pupBrowser) {
            if (typeof instanciaPrevia.pupBrowser.process === 'function') {
                const proc = instanciaPrevia.pupBrowser.process();
                if (proc && proc.pid) browserPid = proc.pid;
            }
            if (typeof instanciaPrevia.pupBrowser.close === 'function') {
                await instanciaPrevia.pupBrowser.close().catch(() => {});
            }
        }
    } catch (e) {}

    try {
        await instanciaPrevia.destroy().catch(() => {});
    } catch (e) {}

    // Si el proceso de Chrome no finalizó, forzar su terminación
    if (browserPid) {
        try {
            process.kill(browserPid, 0);
            try {
                process.kill(browserPid, 'SIGKILL');
            } catch (e) {}
        } catch (e) {
            // Ya finalizó
        }
    }

    try {
        instanciaPrevia.removeAllListeners();
    } catch (e) {}

    // Pausa preventiva de 1.5s para que el SO libere locks y descriptores de archivo
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Limpiamos cualquier bloqueo residual en disco
    limpiarBloqueosDeSesion();
};

/**
 * Crea una nueva instancia fresca del cliente de WhatsApp y configura sus listeners
 */
const crearNuevoCliente = () => {
    const chromeExiste = fs.existsSync(CHROME_PATH);

    const puppeteerOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    };

    if (chromeExiste) {
        puppeteerOptions.executablePath = CHROME_PATH;
    }

    const nuevoCliente = new Client({
        authStrategy: new LocalAuth({
            dataPath: AUTH_DIR
        }),
        puppeteer: puppeteerOptions
    });

    // Evento 1: Generar QR y avisar al frontend
    nuevoCliente.on('qr', (qr) => {
        estadoBot = 'Esperando QR';
        qrActual = qr;
        console.log('Atención: Nuevo código QR generado. Esperando escaneo.');
        qrcode.generate(qr, { small: true });
    });

    // Evento 2: Conexión exitosa
    nuevoCliente.on('ready', () => {
        estadoBot = 'Conectado';
        qrActual = '';
        console.log('Bot conectado y listo para trabajar.');
    });

    // Evento 3: Fallo de autenticación
    nuevoCliente.on('auth_failure', (msg) => {
        estadoBot = 'Desconectado';
        qrActual = '';
        console.error('Fallo de autenticación en WhatsApp Bot:', msg);
    });

    // Evento 4: Desconexión (Por si se apaga el celular o se cierra sesión)
    nuevoCliente.on('disconnected', (reason) => {
        estadoBot = 'Desconectado';
        qrActual = '';
        console.log('Bot desconectado. Motivo:', reason);
    });

    // Evento 5 (De prueba): Escuchar mensajes y responder
    nuevoCliente.on('message', async (message) => {
        if (message.body && message.body.trim().toLowerCase() === '!prueba') {
            await message.reply('¡Hola! El bot de EMME Beauty funciona perfecto. 💅✨');
        }
    });

    client = nuevoCliente;
    return nuevoCliente;
};

// Función puente para entregar los datos al frontend
const getEstadoBot = () => {
    return { estado: estadoBot, qr: qrActual };
};

// Función para prender el motor del bot
const iniciarBot = async () => {
    if (iniciando || reiniciando) {
        console.log('[WhatsApp Bot] Ya se encuentra inicializándose...');
        return;
    }
    iniciando = true;
    console.log('Iniciando el motor de WhatsApp...');
    estadoBot = 'Iniciando sistema...';
    qrActual = '';

    try {
        limpiarBloqueosDeSesion();
        const cli = crearNuevoCliente();
        await cli.initialize();
    } catch (err) {
        console.error('Error al inicializar WhatsApp Bot:', err.message);
        estadoBot = 'Desconectado';

        // Si falló por bloqueo residual, limpiamos y reintentamos una vez automáticamente
        if (err.message && err.message.includes('already running')) {
            console.log('[WhatsApp Bot] Reintentando tras limpiar sesión bloqueada...');
            try {
                await cerrarClienteActual();
                limpiarBloqueosDeSesion();
                const cliReintento = crearNuevoCliente();
                await cliReintento.initialize();
            } catch (retryErr) {
                console.error('[WhatsApp Bot] Error en reintento de inicialización:', retryErr.message);
                estadoBot = 'Desconectado';
            }
        }
    } finally {
        iniciando = false;
    }
};

// Función para reiniciar o desvincular la sesión del bot desde el panel
const reiniciarBot = async (cerrarSesion = false) => {
    if (reiniciando) {
        return { ok: false, error: 'El bot ya se está reiniciando, aguardá unos segundos.' };
    }
    reiniciando = true;
    try {
        console.log(cerrarSesion ? '[WhatsApp Bot] Desvinculando sesión...' : '[WhatsApp Bot] Reiniciando conexión...');
        estadoBot = 'Iniciando sistema...';
        qrActual = '';

        if (cerrarSesion && client && estadoBot === 'Conectado') {
            try {
                await client.logout();
                console.log('[WhatsApp Bot] Sesión cerrada en WhatsApp Web.');
            } catch (e) {
                console.warn('Aviso al cerrar sesión de WhatsApp:', e.message);
            }
        }

        await cerrarClienteActual();
        limpiarBloqueosDeSesion();

        // Si se pidió desvincular/cerrar sesión, borramos la carpeta de sesión para empezar 100% de cero con nuevo QR
        if (cerrarSesion && fs.existsSync(SESSION_DIR)) {
            try {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                console.log('[WhatsApp Bot] Carpeta de sesión eliminada para nuevo escaneo QR.');
            } catch (errRm) {
                console.warn('[WhatsApp Bot] Aviso limpiando carpeta de sesión:', errRm.message);
            }
        }

        console.log('[WhatsApp Bot] Iniciando nueva conexión...');
        const cli = crearNuevoCliente();

        cli.initialize().catch(async (err) => {
            console.error('Error al reinicializar WhatsApp Bot:', err.message);
            estadoBot = 'Desconectado';

            if (err.message && err.message.includes('already running')) {
                console.log('[WhatsApp Bot] Reintentando autorecuperación tras bloqueo de sesión...');
                try {
                    await cerrarClienteActual();
                    limpiarBloqueosDeSesion();
                    const cliReintento = crearNuevoCliente();
                    await cliReintento.initialize();
                } catch (retryErr) {
                    console.error('[WhatsApp Bot] Fallo definitivo al recuperar sesión:', retryErr.message);
                    estadoBot = 'Desconectado';
                }
            }
        });

        return {
            ok: true,
            message: cerrarSesion
                ? 'Sesión cerrada. Generando nuevo código QR...'
                : 'Reiniciando conexión con WhatsApp...'
        };
    } catch (error) {
        console.error('Error durante el reinicio del bot:', error);
        estadoBot = 'Desconectado';
        return { ok: false, error: error.message || 'Error al reiniciar bot' };
    } finally {
        reiniciando = false;
    }
};

// Función para enviar mensajes a clientas y profesionales
const enviarMensaje = async (numero, mensaje) => {
    try {
        if (!client || estadoBot !== 'Conectado') {
            console.warn(`Envío omitido a ${numero}: el bot no está conectado (Estado actual: ${estadoBot}).`);
            return { ok: false, error: `El bot no está conectado (Estado: ${estadoBot})` };
        }

        const numeroNormalizado = normalizarTelefonoWhatsApp(numero);
        if (!numeroNormalizado) {
            console.warn(`Número inválido para WhatsApp: ${numero}`);
            return { ok: false, error: `Número de teléfono inválido (${numero})` };
        }

        let chatId = `${numeroNormalizado}@c.us`;
        try {
            const contactoRegistrado = await client.getNumberId(numeroNormalizado);
            if (contactoRegistrado && contactoRegistrado._serialized) {
                chatId = contactoRegistrado._serialized;
            }
        } catch (lookupError) {
            console.warn(`No se pudo verificar getNumberId para ${numeroNormalizado}, usando formato directo.`);
        }

        await client.sendMessage(chatId, mensaje);
        console.log(`Mensaje enviado a: ${chatId}`);
        return { ok: true, destino: chatId };
    } catch (error) {
        console.error(`Error enviando mensaje al numero ${numero}:`, error);
        return { ok: false, error: error.message || 'Error al enviar mensaje por WhatsApp' };
    }
};

// Cierre ordenado al detener el proceso en la terminal (Ctrl+C o kill)
const salirLimpio = async () => {
    if (client) {
        console.log('\n[WhatsApp Bot] Cerrando navegador antes de salir...');
        await cerrarClienteActual();
    }
};

process.on('SIGINT', async () => {
    await salirLimpio();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await salirLimpio();
    process.exit(0);
});

module.exports = {
    get client() {
        return client;
    },
    iniciarBot,
    reiniciarBot,
    enviarMensaje,
    getEstadoBot,
    normalizarTelefonoWhatsApp
};
