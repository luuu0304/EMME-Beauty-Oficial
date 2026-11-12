// backend/whatsappBot.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Inicializamos el cliente apuntando al Chrome real de tu Mac
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

// Variables para memorizar el estado para el frontend
let estadoBot = 'Iniciando sistema...';
let qrActual = '';
let reiniciando = false;

// Evento 1: Generar QR y avisar al frontend
client.on('qr', (qr) => {
    estadoBot = 'Esperando QR';
    qrActual = qr; 
    console.log('Atencion: Nuevo codigo QR generado. Esperando escaneo.');
    qrcode.generate(qr, { small: true }); 
});

// Evento 2: Conexión exitosa
client.on('ready', () => {
    estadoBot = 'Conectado';
    qrActual = ''; 
    console.log('Bot conectado y listo para trabajar.');
});

// Evento 3: Fallo de autenticación
client.on('auth_failure', (msg) => {
    estadoBot = 'Desconectado';
    qrActual = '';
    console.error('Fallo de autenticacion en WhatsApp Bot:', msg);
});

// Evento 4: Desconexión (Por si se apaga el celular o se cierra sesión)
client.on('disconnected', (reason) => {
    estadoBot = 'Desconectado';
    qrActual = '';
    console.log('Bot desconectado. Motivo: ', reason);
});

// Evento 5 (De prueba): Escuchar mensajes y responder
client.on('message', async (message) => {
    if (message.body && message.body.trim().toLowerCase() === '!prueba') {
        await message.reply('¡Hola! El bot de EMME Beauty funciona perfecto. 💅✨');
    }
});

// Normaliza números telefónicos de Argentina al formato internacional de WhatsApp (549 + código de área sin 0 + número sin 15)
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
        // Caso en que hayan cargado 15 + 9 dígitos sin característica o similar
        limpio = limpio.slice(2);
    }

    if (limpio.length < 8) return null;

    if (!limpio.startsWith('549')) {
        limpio = `549${limpio}`;
    }

    return limpio;
};

// Función puente para entregar los datos al frontend
const getEstadoBot = () => {
    return { estado: estadoBot, qr: qrActual };
};

// Función para prender el motor del bot
const iniciarBot = () => {
    console.log('Iniciando el motor de WhatsApp...');
    estadoBot = 'Iniciando sistema...';
    client.initialize().catch((err) => {
        console.error('Error al inicializar WhatsApp Bot:', err.message);
        estadoBot = 'Desconectado';
    });
};

// Función para reiniciar o desvincular la sesión del bot desde el panel
const reiniciarBot = async (cerrarSesion = false) => {
    if (reiniciando) {
        return { ok: false, error: 'El bot ya se está reiniciando, aguardá unos segundos.' };
    }
    reiniciando = true;
    try {
        if (cerrarSesion && estadoBot === 'Conectado') {
            try {
                await client.logout();
            } catch (e) {
                console.warn('Aviso al cerrar sesión de WhatsApp:', e.message);
            }
        }
        try {
            await client.destroy();
        } catch (e) {
            console.warn('Aviso al detener cliente de WhatsApp:', e.message);
        }

        estadoBot = 'Iniciando sistema...';
        qrActual = '';

        client.initialize().catch((err) => {
            console.error('Error al reinicializar WhatsApp Bot:', err.message);
            estadoBot = 'Desconectado';
        });

        return { ok: true, message: cerrarSesion ? 'Sesión cerrada. Generando nuevo código QR...' : 'Reiniciando conexión con WhatsApp...' };
    } finally {
        reiniciando = false;
    }
};

// Función para enviar mensajes a clientas y profesionales
const enviarMensaje = async (numero, mensaje) => {
    try {
        if (estadoBot !== 'Conectado') {
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

module.exports = { client, iniciarBot, reiniciarBot, enviarMensaje, getEstadoBot, normalizarTelefonoWhatsApp };