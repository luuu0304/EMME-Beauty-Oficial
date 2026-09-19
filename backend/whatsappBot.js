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

// Evento 3: Desconexión (Por si se apaga el celular o se cierra sesión)
client.on('disconnected', (reason) => {
    estadoBot = 'Desconectado';
    console.log('Bot desconectado. Motivo: ', reason);
});

// Evento 4 (De prueba): Escuchar mensajes y responder
client.on('message', async (message) => {
    if (message.body.toLowerCase() === '!prueba') {
        // Este mensaje mantiene los emojis porque es lo que lee la clienta en WhatsApp
        await message.reply('¡Hola! El bot de EMME Beauty funciona perfecto. 💅✨');
    }
});

// Funcion puente para entregar los datos al frontend
const getEstadoBot = () => {
    return { estado: estadoBot, qr: qrActual };
};

// Función para prender el motor del bot
const iniciarBot = () => {
    console.log('Iniciando el motor de WhatsApp...');
    client.initialize();
};

// Función para enviar mensajes a clientas
const enviarMensaje = async (numero, mensaje) => {
    try {
        const numeroLimpio = numero.replace(/\D/g, ''); 
        const numeroFormateado = `549${numeroLimpio}@c.us`;

        await client.sendMessage(numeroFormateado, mensaje);
        console.log(`Mensaje enviado a: ${numeroFormateado}`);
    } catch (error) {
        console.error(`Error enviando mensaje al numero ${numero}:`, error);
    }
};

module.exports = { client, iniciarBot, enviarMensaje, getEstadoBot };