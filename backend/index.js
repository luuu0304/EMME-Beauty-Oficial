const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // Carga las variables de entorno (secretos) desde el archivo .env
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const { iniciarBot, reiniciarBot, enviarMensaje, getEstadoBot } = require('./whatsappBot');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY; // Llave secreta para firmar los tokens de sesión

// ==========================================================================
// ÍNDICE DEL BACKEND (API REST) - EMME BEAUTY V2
// ==========================================================================
// 1. CONFIGURACIÓN Y MIDDLEWARES (Conexión a BD, CORS)
// 2. MÓDULO DE SEGURIDAD (Login y Registro)
// 3. MÓDULO DE CLIENTAS (Directorio e Historial)
// 4. MÓDULO DE STAFF Y LIQUIDACIONES (Empleadas, Comisiones y Pagos)
// 5. MÓDULO DE CATÁLOGO (Áreas, Servicios y Extras)
// 6. MÓDULO DE AGENDA (Turnos, Disponibilidad y Señas)
// 7. MÓDULO DE FINANZAS (Caja, Ingresos, Gastos y Cobro de turnos)
// 8. MÓDULO DE CONFIGURACIÓN GENERAL (Horarios del local y Medios de Pago)
// 9. MÓDULO DE ESTADÍSTICAS (Dashboard y KPIs)
// 10. INICIO DEL SERVIDOR
// ==========================================================================

// ==========================================================================
// 1. CONFIGURACIÓN Y MIDDLEWARES
// ==========================================================================
app.use(cors()); // Permite que el Frontend (que corre en otro puerto/dominio) consulte esta API
app.use(express.json()); // Habilita la lectura de datos en formato JSON desde el req.body
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// Configuración de la base de datos leyendo desde el .env por seguridad
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

// RUTA PARA EL PANEL DE CONFIGURACIÓN DEL BOT (FRONTEND)
app.get('/api/bot/status', (req, res) => {
    const estado = getEstadoBot();
    res.json(estado);
});

// RUTA PARA OBTENER LAS PLANTILLAS DEL BOT
app.get('/api/bot/plantillas', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT Id_Plantilla, Nombre_Funcion, Texto_Mensaje FROM Plantillas_Bot');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error obteniendo plantillas:', error);
        res.status(500).json({ error: 'Error al obtener plantillas' });
    }
});

// RUTA PARA ACTUALIZAR UNA PLANTILLA DEL BOT
app.put('/api/bot/plantillas/:id', async (req, res) => {
    const { id } = req.params;
    const { texto } = req.body;

    if (!texto || !String(texto).trim()) {
        return res.status(400).json({ error: 'El texto de la plantilla no puede estar vacío' });
    }
    
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .input('texto', sql.NVarChar, String(texto).trim())
            .query('UPDATE Plantillas_Bot SET Texto_Mensaje = @texto WHERE Id_Plantilla = @id');
            
        res.json({ success: true, message: 'Plantilla actualizada correctamente' });
    } catch (error) {
        console.error('Error actualizando plantilla:', error);
        res.status(500).json({ error: 'Error al actualizar la plantilla en la base de datos' });
    }
});

// RUTA PARA REINICIAR O CERRAR SESIÓN DEL BOT DE WHATSAPP
app.post('/api/bot/reiniciar', async (req, res) => {
    try {
        const cerrarSesion = Boolean(req.body && req.body.cerrarSesion);
        const resultado = await reiniciarBot(cerrarSesion);
        if (!resultado.ok) {
            return res.status(400).json({ error: resultado.error });
        }
        res.json(resultado);
    } catch (error) {
        console.error('Error reiniciando bot:', error);
        res.status(500).json({ error: 'No se pudo reiniciar el bot de WhatsApp' });
    }
});

// RUTA PARA ENVIAR UN MENSAJE DE PRUEBA DESDE EL PANEL
app.post('/api/bot/probar', async (req, res) => {
    const { telefono, mensaje } = req.body || {};
    if (!telefono || !String(telefono).trim()) {
        return res.status(400).json({ error: 'Ingresá un número de teléfono válido para la prueba.' });
    }

    const textoEnvio = (mensaje && String(mensaje).trim())
        ? String(mensaje).trim()
        : '¡Hola! Este es un mensaje de prueba enviado desde el panel de EMME Beauty. ✨💅';

    try {
        const resultado = await enviarMensaje(String(telefono).trim(), textoEnvio);
        if (!resultado || !resultado.ok) {
            return res.status(400).json({ error: (resultado && resultado.error) || 'No se pudo enviar el mensaje. Verificá que el bot esté Conectado.' });
        }
        res.json({ ok: true, message: 'Mensaje de prueba enviado con éxito.' });
    } catch (error) {
        console.error('Error en prueba de bot:', error);
        res.status(500).json({ error: 'Error interno al enviar el mensaje de prueba.' });
    }
});

// RUTA PARA EJECUTAR MANUALMENTE UNA RUTINA DEL BOT DESDE EL PANEL
app.post('/api/bot/ejecutar-rutina', async (req, res) => {
    const { rutina } = req.body || {};
    try {
        let resultado;
        if (rutina === 'recordatorios') {
            resultado = await ejecutarRecordatorios24hs();
        } else if (rutina === 'retorno') {
            resultado = await ejecutarRetorno15Dias();
        } else if (rutina === 'empleadas') {
            resultado = await ejecutarAvisoEmpleadas();
        } else {
            return res.status(400).json({ error: 'Rutina no reconocida.' });
        }

        if (!resultado.ok) {
            return res.status(400).json({ error: resultado.error });
        }
        res.json(resultado);
    } catch (error) {
        console.error('Error ejecutando rutina manual del bot:', error);
        res.status(500).json({ error: 'Error al ejecutar la rutina solicitada.' });
    }
});

// ==========================================================================
// 2. MÓDULO DE SEGURIDAD (AUTH)
// ==========================================================================

// Asegura que la tabla Usuario tenga la columna Nombre (distinto de Username)
async function asegurarColumnaNombreUsuario(pool) {
    try {
        await pool.request().query(`
            IF COL_LENGTH('Usuario', 'Nombre') IS NULL
            BEGIN
                ALTER TABLE Usuario ADD Nombre VARCHAR(100) NULL;
            END
        `);
    } catch (e) {
        console.warn("Aviso al verificar columna Nombre en Usuario:", e.message);
    }
}

// Middleware para verificar el token JWT en operaciones de perfil y seguridad
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

    if (!token) {
        return res.status(401).json({ error: "Sesión no válida o expirada. Iniciá sesión nuevamente." });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.usuario = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Tu sesión expiró. Por favor, volvé a iniciar sesión." });
    }
}

// Registrar un nuevo usuario (Usado para crear el Admin por primera vez o accesos de empleadas)
app.post('/api/auth/register', async (req, res) => {
    const { Username, Password, Rol, Id_Empleada, Nombre } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(Password, 10);
        
        let pool = await sql.connect(dbConfig);
        await asegurarColumnaNombreUsuario(pool);

        await pool.request()
            .input('Username', sql.VarChar, Username)
            .input('PasswordHash', sql.VarChar, hashedPassword)
            .input('Rol', sql.VarChar, Rol)
            .input('Id_Empleada', sql.Int, Id_Empleada || null)
            .input('Nombre', sql.VarChar, Nombre || null)
            .query(`
                INSERT INTO Usuario (Username, Password_Hash, Rol, Id_Empleada, Nombre)
                VALUES (@Username, @PasswordHash, @Rol, @Id_Empleada, @Nombre)
            `);
            
        res.status(201).json({ message: "Usuario creado con éxito" });
    } catch (err) {
        console.error("Error al registrar:", err);
        res.status(500).json({ error: "Error al registrar usuario" });
    }
});

// Login de usuario y generación de Token de sesión
app.post('/api/auth/login', async (req, res) => {
    const { Username, Password } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        await asegurarColumnaNombreUsuario(pool);

        const result = await pool.request()
            .input('Username', sql.VarChar, Username)
            .query(`
                SELECT u.*, e.Nombre_Ap
                FROM Usuario u
                LEFT JOIN Empleada e ON u.Id_Empleada = e.Id_Empleada
                WHERE u.Username = @Username
            `);
            
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }
        
        const usuario = result.recordset[0];
        const passwordValida = await bcrypt.compare(Password, usuario.Password_Hash);
        
        if (!passwordValida) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        const nombreVisible = usuario.Nombre_Ap || usuario.Nombre || usuario.Username;
        
        // Genera el token JWT que el frontend guardará en localStorage
        const token = jwt.sign(
            {
                id: usuario.Id_Usuario,
                username: usuario.Username,
                nombre: nombreVisible,
                rol: usuario.Rol,
                idEmpleada: usuario.Id_Empleada,
                Id_Empleada: usuario.Id_Empleada
            },
            SECRET_KEY,
            { expiresIn: '12h' }
        );
        
        res.json({
            message: "Login exitoso",
            token,
            rol: usuario.Rol,
            nombre: nombreVisible,
            username: usuario.Username
        });
    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// Obtener los datos del perfil del usuario autenticado
app.get('/api/auth/perfil', verificarToken, async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        await asegurarColumnaNombreUsuario(pool);

        const result = await pool.request()
            .input('Id_Usuario', sql.Int, req.usuario.id)
            .query(`
                SELECT 
                    u.Id_Usuario,
                    u.Username,
                    u.Rol,
                    u.Id_Empleada,
                    u.Nombre AS Nombre_Usuario,
                    e.Nombre_Ap AS Nombre_Empleada,
                    e.DNI,
                    e.Telefono
                FROM Usuario u
                LEFT JOIN Empleada e ON u.Id_Empleada = e.Id_Empleada
                WHERE u.Id_Usuario = @Id_Usuario
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const u = result.recordset[0];
        const nombreVisible = u.Nombre_Empleada || u.Nombre_Usuario || u.Username;

        res.json({
            idUsuario: u.Id_Usuario,
            username: u.Username,
            rol: u.Rol,
            idEmpleada: u.Id_Empleada,
            nombre: nombreVisible,
            dni: u.DNI || null,
            telefono: u.Telefono || null
        });
    } catch (err) {
        console.error("Error obteniendo perfil:", err);
        res.status(500).json({ error: "Error al obtener los datos del perfil" });
    }
});

// Actualizar nombre visible (distinto de Username) y/o contraseña del usuario autenticado
app.put('/api/auth/perfil', verificarToken, async (req, res) => {
    const { nombre, passwordActual, passwordNueva } = req.body;
    const nombreLimpio = (nombre || '').trim();

    if (!nombreLimpio) {
        return res.status(400).json({ error: "El nombre no puede estar vacío" });
    }

    try {
        let pool = await sql.connect(dbConfig);
        await asegurarColumnaNombreUsuario(pool);

        const userResult = await pool.request()
            .input('Id_Usuario', sql.Int, req.usuario.id)
            .query(`SELECT * FROM Usuario WHERE Id_Usuario = @Id_Usuario`);

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const usuario = userResult.recordset[0];

        // Si el usuario desea cambiar su contraseña, validamos la contraseña actual
        let nuevoHash = null;
        if (passwordNueva && passwordNueva.trim() !== '') {
            if (!passwordActual) {
                return res.status(400).json({ error: "Ingresá tu contraseña actual para poder cambiarla" });
            }

            const passwordValida = await bcrypt.compare(passwordActual, usuario.Password_Hash);
            if (!passwordValida) {
                return res.status(400).json({ error: "La contraseña actual ingresada es incorrecta" });
            }

            if (passwordNueva.trim().length < 4) {
                return res.status(400).json({ error: "La nueva contraseña debe tener al menos 4 caracteres" });
            }

            nuevoHash = await bcrypt.hash(passwordNueva.trim(), 10);
        }

        // Actualizamos Usuario (Nombre y opcionalmente Password_Hash)
        if (nuevoHash) {
            await pool.request()
                .input('Id_Usuario', sql.Int, usuario.Id_Usuario)
                .input('Nombre', sql.VarChar, nombreLimpio)
                .input('PasswordHash', sql.VarChar, nuevoHash)
                .query(`
                    UPDATE Usuario
                    SET Nombre = @Nombre, Password_Hash = @PasswordHash
                    WHERE Id_Usuario = @Id_Usuario
                `);
        } else {
            await pool.request()
                .input('Id_Usuario', sql.Int, usuario.Id_Usuario)
                .input('Nombre', sql.VarChar, nombreLimpio)
                .query(`
                    UPDATE Usuario
                    SET Nombre = @Nombre
                    WHERE Id_Usuario = @Id_Usuario
                `);
        }

        // Si el usuario está vinculado a una Empleada, sincronizamos su Nombre_Ap en la tabla Empleada
        if (usuario.Id_Empleada) {
            await pool.request()
                .input('Id_Empleada', sql.Int, usuario.Id_Empleada)
                .input('Nombre_Ap', sql.VarChar, nombreLimpio)
                .query(`
                    UPDATE Empleada
                    SET Nombre_Ap = @Nombre_Ap
                    WHERE Id_Empleada = @Id_Empleada
                `);
        }

        // Emitimos un nuevo token con el nombre actualizado
        const nuevoToken = jwt.sign(
            {
                id: usuario.Id_Usuario,
                username: usuario.Username,
                nombre: nombreLimpio,
                rol: usuario.Rol,
                idEmpleada: usuario.Id_Empleada,
                Id_Empleada: usuario.Id_Empleada
            },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        res.json({
            message: "Perfil actualizado correctamente",
            nombre: nombreLimpio,
            username: usuario.Username,
            token: nuevoToken
        });
    } catch (err) {
        console.error("Error actualizando perfil:", err);
        res.status(500).json({ error: "Error interno al actualizar el perfil" });
    }
});

// ==========================================================================
// 3. MÓDULO DE CLIENTAS
// ==========================================================================

// Extrae únicamente YYYY-MM-DD para evitar desplazamientos de zona horaria en columnas tipo DATE
function normalizarFechaISO(valor) {
    if (!valor) return null;
    const texto = String(valor).trim();
    if (!texto || texto === 'null' || texto === 'undefined') return null;
    const coincidencia = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    return coincidencia ? coincidencia[1] : null;
}

// Obtener todas las clientas (Calcula la fecha de su último turno automáticamente)
app.get('/api/clientas', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                c.Id_Clienta, c.Nombre, c.Apellido, c.Telefono, c.Observacion,
                CONVERT(VARCHAR(10), c.Fecha_Nac, 23) AS Fecha_Nac,
                MAX(t.Fecha_Hora) AS Fecha_Ultimo_Turno
            FROM Clienta c
            LEFT JOIN Turno t ON c.Id_Clienta = t.Id_Clienta
            GROUP BY c.Id_Clienta, c.Nombre, c.Apellido, c.Telefono, c.Observacion, c.Fecha_Nac
            ORDER BY c.Nombre ASC, c.Apellido ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo clientas:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Registrar una nueva clienta
app.post('/api/clientas', async (req, res) => {
    try {
        const { Nombre, Apellido, Fecha_Nac, Telefono, Observacion } = req.body;
        const fechaNacISO = normalizarFechaISO(Fecha_Nac);
        let pool = await sql.connect(dbConfig);
        
        const resultado = await pool.request()
            .input('Nombre', sql.VarChar, Nombre)
            .input('Apellido', sql.VarChar, Apellido)
            .input('Fecha_Nac', sql.VarChar(10), fechaNacISO)
            .input('Telefono', sql.VarChar, Telefono || null)
            .input('Observacion', sql.VarChar, Observacion || null)
            .query(`
                INSERT INTO Clienta (Nombre, Apellido, Fecha_Nac, Telefono, Observacion)
                OUTPUT inserted.Id_Clienta
                VALUES (@Nombre, @Apellido, TRY_CONVERT(DATE, @Fecha_Nac, 23), @Telefono, @Observacion)
            `);
            
        res.status(201).json({ mensaje: "Clienta creada con éxito", Id_Clienta: resultado.recordset[0].Id_Clienta });
    } catch (error) {
        console.error("Error al insertar clienta:", error);
        res.status(500).send("Error interno al guardar la clienta");
    }
});

// Actualizar una clienta existente
app.put('/api/clientas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre, Apellido, Fecha_Nac, Telefono, Observacion } = req.body;
        const fechaNacISO = normalizarFechaISO(Fecha_Nac);
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Id_Clienta', sql.Int, id)
            .input('Nombre', sql.VarChar, Nombre)
            .input('Apellido', sql.VarChar, Apellido)
            .input('Fecha_Nac', sql.VarChar(10), fechaNacISO)
            .input('Telefono', sql.VarChar, Telefono || null)
            .input('Observacion', sql.VarChar, Observacion || null)
            .query(`
                UPDATE Clienta 
                SET Nombre = @Nombre, Apellido = @Apellido, Fecha_Nac = TRY_CONVERT(DATE, @Fecha_Nac, 23), Telefono = @Telefono, Observacion = @Observacion
                WHERE Id_Clienta = @Id_Clienta
            `);
            
        res.status(200).send("Clienta actualizada correctamente");
    } catch (error) {
        console.error("Error al actualizar clienta:", error);
        res.status(500).send("Error interno al actualizar");
    }
});

// Obtener el historial estético de una clienta específica
app.get('/api/clientas/:id/historial', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        
        let result = await pool.request()
            .input('Id_Clienta', sql.Int, id)
            .query(`
                SELECT t.Fecha_Hora, s.Nombre AS Nombre_Servicio, e.Nombre_Ap, t.Color, t.Comentario_Admin, t.Estado
                FROM Turno t
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada
                WHERE t.Id_Clienta = @Id_Clienta
                ORDER BY t.Fecha_Hora DESC
            `);
            
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo historial: ", err);
        res.status(500).send("Error conectando a la base de datos");
    }
});

// ==========================================================================
// 3.1. TARJETA DE FIDELIDAD (10 SELLOS MENSUALES)
// ==========================================================================

let tablaSelloVerificada = false;
async function asegurarTablaSelloFidelidad(pool) {
    if (tablaSelloVerificada) return;
    try {
        await pool.request().query(`
            IF OBJECT_ID('Sello_Fidelidad', 'U') IS NULL
            BEGIN
                CREATE TABLE Sello_Fidelidad (
                    Id_Sello INT IDENTITY(1,1) PRIMARY KEY,
                    Id_Clienta INT NOT NULL FOREIGN KEY REFERENCES Clienta(Id_Clienta) ON DELETE CASCADE,
                    Fecha_Sello DATE NOT NULL,
                    Numero_Slot INT NOT NULL CHECK (Numero_Slot BETWEEN 1 AND 10),
                    Activo BIT NOT NULL DEFAULT 1
                );
                CREATE INDEX IX_Sello_Fidelidad_Clienta_Activo
                    ON Sello_Fidelidad (Id_Clienta, Activo, Numero_Slot);
            END
        `);
        tablaSelloVerificada = true;
    } catch (e) {
        console.warn("Aviso al verificar tabla Sello_Fidelidad:", e.message);
    }
}

let columnasDescuentoVerificadas = false;
async function asegurarColumnasDescuentoTurno(pool) {
    if (columnasDescuentoVerificadas) return;
    try {
        await pool.request().query(`
            IF COL_LENGTH('Turno', 'Descuento') IS NULL
                ALTER TABLE Turno ADD Descuento DECIMAL(10,2) NOT NULL DEFAULT 0;
            IF COL_LENGTH('Turno', 'Tipo_Descuento') IS NULL
                ALTER TABLE Turno ADD Tipo_Descuento VARCHAR(20) NOT NULL DEFAULT 'Ninguno';
            IF COL_LENGTH('Turno', 'Descuento_Afecta_Comision') IS NULL
                ALTER TABLE Turno ADD Descuento_Afecta_Comision BIT NOT NULL DEFAULT 0;
        `);
        columnasDescuentoVerificadas = true;
    } catch (e) {
        console.warn("Aviso al verificar columnas de descuento en Turno:", e.message);
    }
}

function calcularMetadatosFidelidad(sellosActivos = []) {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1; // 1..12
    const indiceMesActual = anioActual * 12 + (mesActual - 1);

    let yaTieneSelloEsteMes = false;
    let maxIndiceMesSello = -1;

    for (const sello of sellosActivos) {
        const fechaStr = normalizarFechaISO(sello.Fecha_Sello);
        if (fechaStr) {
            const [y, m] = fechaStr.split('-').map(Number);
            if (y === anioActual && m === mesActual) {
                yaTieneSelloEsteMes = true;
            }
            const idx = y * 12 + (m - 1);
            if (idx > maxIndiceMesSello) {
                maxIndiceMesSello = idx;
            }
        }
    }

    const cantidadSellos = sellosActivos.length;
    const tarjetaCompleta = cantidadSellos >= 10;

    // Detecta si tiene sellos activos en curso (< 10), no sumó este mes y su último sello es anterior al mes calendario previo
    const mesPasadoSinSello = (
        cantidadSellos > 0 &&
        !tarjetaCompleta &&
        !yaTieneSelloEsteMes &&
        maxIndiceMesSello !== -1 &&
        maxIndiceMesSello < (indiceMesActual - 1)
    );

    let proximoSlot = 1;
    if (!tarjetaCompleta && cantidadSellos > 0) {
        const slotsOcupados = new Set(sellosActivos.map(s => Number(s.Numero_Slot)));
        const maxSlot = Math.max(...Array.from(slotsOcupados));
        if (maxSlot < 10 && !slotsOcupados.has(maxSlot + 1)) {
            proximoSlot = maxSlot + 1;
        } else {
            for (let slot = 1; slot <= 10; slot++) {
                if (!slotsOcupados.has(slot)) {
                    proximoSlot = slot;
                    break;
                }
            }
        }
    }

    return {
        cantidadSellos,
        yaTieneSelloEsteMes,
        mesPasadoSinSello,
        proximoSlot,
        tarjetaCompleta
    };
}

// Obtener sellos activos y metadatos de fidelidad de una clienta
app.get('/api/clientas/:id/fidelidad', async (req, res) => {
    try {
        const idClienta = parseInt(req.params.id, 10);
        if (isNaN(idClienta)) {
            return res.status(400).json({ error: "ID de clienta inválido" });
        }

        let pool = await sql.connect(dbConfig);
        await asegurarTablaSelloFidelidad(pool);

        const resultSellos = await pool.request()
            .input('Id_Clienta', sql.Int, idClienta)
            .query(`
                SELECT 
                    Id_Sello,
                    Id_Clienta,
                    CONVERT(VARCHAR(10), Fecha_Sello, 23) AS Fecha_Sello,
                    CONVERT(VARCHAR(5), Fecha_Sello, 103) AS Fecha_Formateada,
                    Numero_Slot,
                    Activo
                FROM Sello_Fidelidad
                WHERE Id_Clienta = @Id_Clienta AND Activo = 1
                ORDER BY Numero_Slot ASC
            `);

        const resultClienta = await pool.request()
            .input('Id_Clienta', sql.Int, idClienta)
            .query(`SELECT Nombre, Apellido, Telefono FROM Clienta WHERE Id_Clienta = @Id_Clienta`);

        const sellos = resultSellos.recordset || [];
        const meta = calcularMetadatosFidelidad(sellos);
        const infoClienta = resultClienta.recordset[0] || null;

        res.json({
            sellos,
            ...meta,
            telefonoClienta: infoClienta ? infoClienta.Telefono : null
        });
    } catch (err) {
        console.error("Error obteniendo fidelidad de la clienta:", err);
        res.status(500).json({ error: "Error al consultar la tarjeta de fidelidad" });
    }
});

// Agregar, editar o quitar un sello manualmente desde el perfil de la clienta
app.post('/api/clientas/:id/fidelidad/sello', async (req, res) => {
    try {
        const idClienta = parseInt(req.params.id, 10);
        const { numeroSlot, fechaSello, accion } = req.body || {};
        const slot = parseInt(numeroSlot, 10);

        if (isNaN(idClienta) || isNaN(slot) || slot < 1 || slot > 10) {
            return res.status(400).json({ error: "Datos de cliente o número de casillero (1-10) inválidos." });
        }

        let pool = await sql.connect(dbConfig);
        await asegurarTablaSelloFidelidad(pool);

        if (accion === 'eliminar' || accion === 'quitar') {
            await pool.request()
                .input('Id_Clienta', sql.Int, idClienta)
                .input('Numero_Slot', sql.Int, slot)
                .query(`
                    DELETE FROM Sello_Fidelidad
                    WHERE Id_Clienta = @Id_Clienta AND Numero_Slot = @Numero_Slot AND Activo = 1
                `);
            return res.json({ ok: true, message: `Sello #${slot} eliminado correctamente.` });
        }

        const hoy = new Date();
        const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const fechaISO = normalizarFechaISO(fechaSello) || hoyISO;

        const existente = await pool.request()
            .input('Id_Clienta', sql.Int, idClienta)
            .input('Numero_Slot', sql.Int, slot)
            .query(`
                SELECT Id_Sello
                FROM Sello_Fidelidad
                WHERE Id_Clienta = @Id_Clienta AND Numero_Slot = @Numero_Slot AND Activo = 1
            `);

        if (existente.recordset.length > 0) {
            await pool.request()
                .input('Id_Sello', sql.Int, existente.recordset[0].Id_Sello)
                .input('Fecha_Sello', sql.VarChar(10), fechaISO)
                .query(`
                    UPDATE Sello_Fidelidad
                    SET Fecha_Sello = TRY_CONVERT(DATE, @Fecha_Sello, 23)
                    WHERE Id_Sello = @Id_Sello
                `);
            return res.json({ ok: true, message: `Fecha del sello #${slot} actualizada.` });
        } else {
            await pool.request()
                .input('Id_Clienta', sql.Int, idClienta)
                .input('Numero_Slot', sql.Int, slot)
                .input('Fecha_Sello', sql.VarChar(10), fechaISO)
                .query(`
                    INSERT INTO Sello_Fidelidad (Id_Clienta, Fecha_Sello, Numero_Slot, Activo)
                    VALUES (@Id_Clienta, TRY_CONVERT(DATE, @Fecha_Sello, 23), @Numero_Slot, 1)
                `);
            return res.status(201).json({ ok: true, message: `Sello #${slot} registrado correctamente.` });
        }
    } catch (err) {
        console.error("Error guardando sello manual:", err);
        res.status(500).json({ error: "Error interno al guardar el sello." });
    }
});

// Reiniciar la tarjeta de fidelidad (archiva los sellos actuales con Activo = 0)
app.post('/api/clientas/:id/fidelidad/reiniciar', async (req, res) => {
    try {
        const idClienta = parseInt(req.params.id, 10);
        if (isNaN(idClienta)) {
            return res.status(400).json({ error: "ID de clienta inválido" });
        }

        let pool = await sql.connect(dbConfig);
        await asegurarTablaSelloFidelidad(pool);

        await pool.request()
            .input('Id_Clienta', sql.Int, idClienta)
            .query(`
                UPDATE Sello_Fidelidad
                SET Activo = 0
                WHERE Id_Clienta = @Id_Clienta AND Activo = 1
            `);

        res.json({ ok: true, message: "Tarjeta de fidelidad reiniciada con éxito." });
    } catch (err) {
        console.error("Error reiniciando tarjeta de fidelidad:", err);
        res.status(500).json({ error: "Error interno al reiniciar la tarjeta." });
    }
});

// Endpoint público para que las clientas consulten su tarjeta de fidelidad por teléfono
app.get('/api/public/fidelidad/:telefono', async (req, res) => {
    try {
        const telLimpio = String(req.params.telefono || '').replace(/\D/g, '');
        if (!telLimpio || telLimpio.length < 6) {
            return res.status(400).json({ error: "Por favor ingresá un número de WhatsApp válido." });
        }

        let pool = await sql.connect(dbConfig);
        await asegurarTablaSelloFidelidad(pool);

        // Limpiamos caracteres no numéricos comunes en la base de datos y buscamos coincidencia exacta o por últimos dígitos
        const sufijoBusqueda = telLimpio.length >= 8 ? telLimpio.slice(-8) : telLimpio;
        const resultClientas = await pool.request()
            .input('TelExacto', sql.VarChar(30), telLimpio)
            .input('TelSufijo', sql.VarChar(30), `%${sufijoBusqueda}`)
            .query(`
                SELECT 
                    Id_Clienta,
                    Nombre,
                    Apellido,
                    Telefono,
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(Telefono, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') AS Tel_Normalizado
                FROM Clienta
                WHERE Telefono IS NOT NULL
                  AND LTRIM(RTRIM(Telefono)) != ''
                  AND (
                      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(Telefono, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = @TelExacto
                      OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(Telefono, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') LIKE @TelSufijo
                  )
            `);

        if (resultClientas.recordset.length === 0) {
            return res.status(404).json({ error: "No encontramos una tarjeta asociada a ese número de WhatsApp." });
        }

        // Priorizamos coincidencia exacta sobre coincidencia por sufijo
        const clienta = resultClientas.recordset.find(c => c.Tel_Normalizado === telLimpio) || resultClientas.recordset[0];

        const resultSellos = await pool.request()
            .input('Id_Clienta', sql.Int, clienta.Id_Clienta)
            .query(`
                SELECT 
                    Numero_Slot,
                    CONVERT(VARCHAR(10), Fecha_Sello, 23) AS Fecha_Sello,
                    CONVERT(VARCHAR(5), Fecha_Sello, 103) AS Fecha_Formateada
                FROM Sello_Fidelidad
                WHERE Id_Clienta = @Id_Clienta AND Activo = 1
                ORDER BY Numero_Slot ASC
            `);

        const resultVisitas = await pool.request()
            .input('Id_Clienta', sql.Int, clienta.Id_Clienta)
            .query(`
                SELECT TOP 5
                    t.Id_Turno,
                    t.Fecha_Hora,
                    CONVERT(VARCHAR(10), t.Fecha_Hora, 103) AS Fecha_Formateada,
                    CONVERT(VARCHAR(5), t.Fecha_Hora, 108) AS Hora_Formateada,
                    s.Nombre AS Nombre_Servicio,
                    e.Nombre_Ap AS Nombre_Empleada,
                    t.Color
                FROM Turno t
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                LEFT JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada
                WHERE t.Id_Clienta = @Id_Clienta
                  AND t.Estado IN ('Pagado', 'Completado')
                ORDER BY t.Fecha_Hora DESC
            `);

        const sellos = resultSellos.recordset || [];
        const meta = calcularMetadatosFidelidad(sellos);

        res.json({
            clienta: {
                Id_Clienta: clienta.Id_Clienta,
                Nombre: clienta.Nombre,
                Apellido: clienta.Apellido,
                Nombre_Completo: `${clienta.Nombre || ''} ${clienta.Apellido || ''}`.trim(),
                Telefono: clienta.Telefono
            },
            sellos,
            ...meta,
            ultimasVisitas: resultVisitas.recordset || []
        });
    } catch (err) {
        console.error("Error en consulta pública de fidelidad:", err);
        res.status(500).json({ error: "Error interno al consultar la tarjeta." });
    }
});

// ==========================================================================
// 4. MÓDULO DE STAFF Y LIQUIDACIONES (EMPLEADAS)
// ==========================================================================

// Obtener todas las empleadas con su saldo acumulado, última liquidación y áreas
app.get('/api/empleadas', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        await asegurarColumnasDescuentoTurno(pool);
        let result = await pool.request().query(`
            SELECT 
                e.Id_Empleada, e.Nombre_Ap, e.DNI, e.Telefono,
                ISNULL(Saldo.Saldo_Acumulado, 0) AS Saldo_Acumulado,
                UltimaLiq.Fecha AS Ultima_Fecha_Liq,
                UltimaLiq.Monto_Total AS Ultimo_Monto_Liq,
                AreasInfo.Areas
            FROM Empleada e
            LEFT JOIN (
                SELECT t.Id_Empleada, SUM(
                    (CASE 
                        WHEN ISNULL(t.Descuento_Afecta_Comision, 0) = 1 THEN 
                            CASE WHEN (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) < 0 THEN 0
                                 ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) END
                        ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0))
                    END) * ISNULL(ea.Porcentaje_Comision, 0.50)
                ) AS Saldo_Acumulado
                FROM Turno t
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                LEFT JOIN Area a ON s.Id_Area = a.Id_Area 
                LEFT JOIN Empleada_Area ea ON t.Id_Empleada = ea.Id_Empleada AND a.Nombre = ea.Area 
                LEFT JOIN (
                    SELECT Id_Turno, SUM(Precio) as Total_Extras
                    FROM Turno_Extra te
                    JOIN Extra ex ON te.Id_Extra = ex.Id_Extra
                    GROUP BY Id_Turno
                ) Extras ON t.Id_Turno = Extras.Id_Turno
                WHERE t.Estado = 'Pagado' AND t.Liquidado = 0
                GROUP BY t.Id_Empleada
            ) Saldo ON e.Id_Empleada = Saldo.Id_Empleada
            OUTER APPLY (
                SELECT TOP 1 Fecha, Monto_Total FROM Liquidacion_Sueldo ls
                WHERE ls.Id_Empleada = e.Id_Empleada ORDER BY Fecha DESC
            ) UltimaLiq
            OUTER APPLY (
                SELECT STRING_AGG(ea.Area, ',') AS Areas FROM Empleada_Area ea
                WHERE ea.Id_Empleada = e.Id_Empleada
            ) AreasInfo
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo empleadas y saldos: ", err);
        res.status(500).send("Error conectando a la base de datos");
    }
});

// Filtrar empleadas habilitadas para realizar un servicio específico
app.get('/api/empleadas/servicio/:idServicio', async (req, res) => {
    try {
        const { idServicio } = req.params;
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('Id_Servicio', sql.Int, idServicio)
            .query(`
                SELECT e.Id_Empleada, e.Nombre_Ap AS Nombre, '' AS Apellido 
                FROM Empleada e
                JOIN Empleada_Area ea ON e.Id_Empleada = ea.Id_Empleada
                JOIN Area a ON ea.Area = a.Nombre
                JOIN Servicio s ON a.Id_Area = s.Id_Area
                WHERE s.Id_Servicio = @Id_Servicio
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error filtrando empleadas por servicio:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Actualizar (Editar) Empleada
app.put('/api/empleadas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre_Ap, Dni, Telefono } = req.body; // <-- Leemos las 3 variables

        let pool = await sql.connect(dbConfig);
        await asegurarColumnaNombreUsuario(pool);

        await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .input('Nombre_Ap', sql.VarChar, Nombre_Ap)
            .input('Dni', sql.VarChar, Dni)
            .input('Telefono', sql.VarChar, Telefono)
            .query(`UPDATE Empleada SET Nombre_Ap = @Nombre_Ap, Dni = @Dni, Telefono = @Telefono WHERE Id_Empleada = @Id_Empleada`);

        await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .input('Nombre', sql.VarChar, Nombre_Ap)
            .query(`UPDATE Usuario SET Nombre = @Nombre WHERE Id_Empleada = @Id_Empleada`);
            
        res.status(200).send("Profesional actualizada correctamente");
    } catch (error) {
        console.error("Error al actualizar empleada:", error);
        res.status(500).send("Error interno al actualizar");
    }
});

// Registrar (Nueva) Empleada (Revisá si ya tenías un POST y actualizalo a esto)
app.post('/api/empleadas', async (req, res) => {
    try {
        const { Nombre_Ap, Dni, Telefono } = req.body;
        
        let pool = await sql.connect(dbConfig);
        await asegurarColumnaNombreUsuario(pool);

        const insEmp = await pool.request()
            .input('Nombre_Ap', sql.VarChar, Nombre_Ap)
            .input('Dni', sql.VarChar, Dni)
            .input('Telefono', sql.VarChar, Telefono)
            .query(`
                INSERT INTO Empleada (Nombre_Ap, DNI, Telefono, Saldo_Acumulado)
                OUTPUT inserted.Id_Empleada
                VALUES (@Nombre_Ap, @Dni, @Telefono, 0)
            `);

        const nuevoIdEmpleada = insEmp.recordset?.[0]?.Id_Empleada;

        // Si se ingresó DNI, creamos automáticamente su acceso en Usuario (si no existe) con usuario y clave = DNI
        if (nuevoIdEmpleada && Dni && String(Dni).trim() !== '') {
            const usernameDni = String(Dni).trim();
            const existeUser = await pool.request()
                .input('Username', sql.VarChar, usernameDni)
                .query(`SELECT Id_Usuario FROM Usuario WHERE Username = @Username`);

            if (existeUser.recordset.length === 0) {
                const hashedPass = await bcrypt.hash(usernameDni, 10);
                await pool.request()
                    .input('Username', sql.VarChar, usernameDni)
                    .input('PasswordHash', sql.VarChar, hashedPass)
                    .input('Rol', sql.VarChar, 'Empleada')
                    .input('Id_Empleada', sql.Int, nuevoIdEmpleada)
                    .input('Nombre', sql.VarChar, Nombre_Ap)
                    .query(`
                        INSERT INTO Usuario (Username, Password_Hash, Rol, Id_Empleada, Nombre)
                        VALUES (@Username, @PasswordHash, @Rol, @Id_Empleada, @Nombre)
                    `);
            }
        }
            
        res.status(200).send("Profesional creada correctamente");
    } catch (error) {
        console.error("Error al crear empleada:", error);
        res.status(500).send("Error interno al crear");
    }
});

app.delete('/api/empleadas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .query(`DELETE FROM Empleada WHERE Id_Empleada = @Id_Empleada`);
        res.status(200).send("Profesional dada de baja correctamente");
    } catch (error) {
        console.error("Error al eliminar empleada:", error);
        res.status(500).send("Error interno al eliminar la empleada");
    }
});

// Configuración de Áreas y Comisiones por Empleada
app.get('/api/empleadas/:id/areas', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().input('Id_Empleada', sql.Int, id)
            .query("SELECT Area, Porcentaje_Comision FROM Empleada_Area WHERE Id_Empleada = @Id_Empleada");
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo áreas de la empleada:", err);
        res.status(500).send("Error interno del servidor");
    }
});

app.post('/api/empleadas/:id/areas', async (req, res) => {
    const { id } = req.params;
    const { areas } = req.body; 
    try {
        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await new sql.Request(transaction)
                .input('Id_Empleada', sql.Int, id)
                .query("DELETE FROM Empleada_Area WHERE Id_Empleada = @Id_Empleada");
            if (areas && areas.length > 0) {
                for (let item of areas) {
                    await new sql.Request(transaction)
                        .input('Id_Empleada', sql.Int, id)
                        .input('Area', sql.VarChar, item.area)
                        .input('Comision', sql.Decimal(3,2), item.comision)
                        .query("INSERT INTO Empleada_Area (Id_Empleada, Area, Porcentaje_Comision) VALUES (@Id_Empleada, @Area, @Comision)");
                }
            }
            await transaction.commit();
            res.status(200).send("Configuración guardada correctamente");
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error guardando áreas:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Liquidaciones de Sueldos
app.get('/api/empleadas/:id/sueldo-detalle', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await asegurarColumnasDescuentoTurno(pool);
        let result = await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .query(`
                SELECT 
                    t.Id_Turno, t.Fecha_Hora, c.Nombre + ' ' + c.Apellido AS Nombre_Clienta,
                    s.Nombre AS Nombre_Servicio, 
                    (s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) AS Total_Abonado,
                    (s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) AS Total_Servicio,
                    ISNULL(t.Descuento, 0) AS Descuento,
                    ISNULL(t.Tipo_Descuento, 'Ninguno') AS Tipo_Descuento,
                    ISNULL(t.Descuento_Afecta_Comision, 0) AS Descuento_Afecta_Comision,
                    (CASE 
                        WHEN ISNULL(t.Descuento_Afecta_Comision, 0) = 1 THEN 
                            CASE WHEN (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) < 0 THEN 0
                                 ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) END
                        ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0))
                    END) AS Base_Comisionable,
                    ISNULL(ea.Porcentaje_Comision, 0.50) AS Porcentaje_Comision,
                    ((CASE 
                        WHEN ISNULL(t.Descuento_Afecta_Comision, 0) = 1 THEN 
                            CASE WHEN (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) < 0 THEN 0
                                 ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) END
                        ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0))
                    END) * ISNULL(ea.Porcentaje_Comision, 0.50)) AS A_Cobrar
                FROM Turno t
                JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                LEFT JOIN Area a ON s.Id_Area = a.Id_Area
                LEFT JOIN Empleada_Area ea ON t.Id_Empleada = ea.Id_Empleada AND a.Nombre = ea.Area
                LEFT JOIN (
                    SELECT Id_Turno, SUM(Precio) as Total_Extras FROM Turno_Extra te
                    JOIN Extra ex ON te.Id_Extra = ex.Id_Extra GROUP BY Id_Turno
                ) Extras ON t.Id_Turno = Extras.Id_Turno
                WHERE t.Id_Empleada = @Id_Empleada AND t.Estado = 'Pagado' AND t.Liquidado = 0
                ORDER BY t.Fecha_Hora DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo detalle de sueldo: ", err);
        res.status(500).send("Error interno del servidor");
    }
});

app.post('/api/empleadas/:id/liquidar', async (req, res) => {
    const { id } = req.params;
    try {
        let pool = await sql.connect(dbConfig);
        await asegurarColumnasDescuentoTurno(pool);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const requestCalc = new sql.Request(transaction);
            const resultCalc = await requestCalc.input('Id_Empleada', sql.Int, id).query(`
                    SELECT ISNULL(SUM(
                        (CASE 
                            WHEN ISNULL(t.Descuento_Afecta_Comision, 0) = 1 THEN 
                                CASE WHEN (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) < 0 THEN 0
                                     ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) END
                            ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0))
                        END) * ISNULL(ea.Porcentaje_Comision, 0.50)
                    ), 0) AS Monto_A_Pagar
                    FROM Turno t
                    JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                    LEFT JOIN Area a ON s.Id_Area = a.Id_Area
                    LEFT JOIN Empleada_Area ea ON t.Id_Empleada = ea.Id_Empleada AND a.Nombre = ea.Area
                    LEFT JOIN (
                        SELECT Id_Turno, SUM(Precio) as Total_Extras FROM Turno_Extra te
                        JOIN Extra ex ON te.Id_Extra = ex.Id_Extra GROUP BY Id_Turno
                    ) Extras ON t.Id_Turno = Extras.Id_Turno
                    WHERE t.Id_Empleada = @Id_Empleada AND t.Estado = 'Pagado' AND t.Liquidado = 0
                `);
            const montoTotal = resultCalc.recordset[0].Monto_A_Pagar;
            if (montoTotal <= 0) {
                await transaction.rollback();
                return res.status(400).send("No hay saldo pendiente para liquidar.");
            }

            const requestLiq = new sql.Request(transaction);
            const resultLiq = await requestLiq
                .input('Id_Empleada', sql.Int, id)
                .input('Monto', sql.Decimal(12, 2), montoTotal)
                .query(`
                    INSERT INTO Liquidacion_Sueldo (Id_Empleada, Monto_Total)
                    OUTPUT INSERTED.Id_Liquidacion
                    VALUES (@Id_Empleada, @Monto)
                `);
            const idLiquidacionGenerada = resultLiq.recordset[0].Id_Liquidacion;

            const requestUpdate = new sql.Request(transaction);
            await requestUpdate
                .input('Id_Empleada', sql.Int, id)
                .input('Id_Liquidacion', sql.Int, idLiquidacionGenerada)
                .query(`
                    UPDATE Turno SET Liquidado = 1, Id_Liquidacion = @Id_Liquidacion
                    WHERE Id_Empleada = @Id_Empleada AND Estado = 'Pagado' AND Liquidado = 0
                `);
                
            await transaction.commit();
            res.status(200).json({ message: "Sueldo liquidado con éxito" });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error al liquidar sueldo:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Historiales de Liquidaciones
app.get('/api/liquidaciones', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT ls.Id_Liquidacion, ls.Fecha, ls.Monto_Total, e.Nombre_Ap
            FROM Liquidacion_Sueldo ls
            JOIN Empleada e ON ls.Id_Empleada = e.Id_Empleada
            ORDER BY ls.Fecha DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo liquidaciones:", err);
        res.status(500).send("Error interno del servidor");
    }
});

app.get('/api/empleadas/:id/liquidaciones', async (req, res) => {
    const { id } = req.params;
    try {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .query(`SELECT Id_Liquidacion, Fecha, Monto_Total FROM Liquidacion_Sueldo WHERE Id_Empleada = @Id_Empleada ORDER BY Fecha DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo los pagos de la empleada:", err);
        res.status(500).send("Error interno del servidor");
    }
});

app.get('/api/liquidaciones/:id/detalles', async (req, res) => {
    const { id } = req.params;
    try {
        let pool = await sql.connect(dbConfig);
        await asegurarColumnasDescuentoTurno(pool);
        const result = await pool.request()
            .input('Id_Liquidacion', sql.Int, id)
            .query(`
                SELECT t.Fecha_Hora, c.Nombre + ' ' + c.Apellido AS Nombre_Clienta, s.Nombre AS Nombre_Servicio,
                    (s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) AS Monto_Abonado,
                    (s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) AS Total_Servicio,
                    ISNULL(t.Descuento, 0) AS Descuento,
                    ISNULL(t.Tipo_Descuento, 'Ninguno') AS Tipo_Descuento,
                    ISNULL(t.Descuento_Afecta_Comision, 0) AS Descuento_Afecta_Comision,
                    (CASE 
                        WHEN ISNULL(t.Descuento_Afecta_Comision, 0) = 1 THEN 
                            CASE WHEN (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) < 0 THEN 0
                                 ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) END
                        ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0))
                    END) AS Base_Comisionable,
                    ISNULL(ea.Porcentaje_Comision, 0.50) * 100 AS Porcentaje,
                    ((CASE 
                        WHEN ISNULL(t.Descuento_Afecta_Comision, 0) = 1 THEN 
                            CASE WHEN (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) < 0 THEN 0
                                 ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0) - ISNULL(t.Descuento, 0)) END
                        ELSE (s.Precio_Base + ISNULL(Extras.Total_Extras, 0))
                    END) * ISNULL(ea.Porcentaje_Comision, 0.50)) AS Comision
                FROM Turno t
                JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                LEFT JOIN Area a ON s.Id_Area = a.Id_Area
                LEFT JOIN Empleada_Area ea ON t.Id_Empleada = ea.Id_Empleada AND a.Nombre = ea.Area
                LEFT JOIN (
                    SELECT Id_Turno, SUM(Precio) as Total_Extras FROM Turno_Extra te
                    JOIN Extra ex ON te.Id_Extra = ex.Id_Extra GROUP BY Id_Turno
                ) Extras ON t.Id_Turno = Extras.Id_Turno
                WHERE t.Id_Liquidacion = @Id_Liquidacion ORDER BY t.Fecha_Hora DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo detalles de liquidación:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// ==========================================================================
// 5. MÓDULO DE CATÁLOGO (ÁREAS, SERVICIOS Y EXTRAS)
// ==========================================================================

// Gestión de Áreas
app.get('/api/areas', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT Id_Area, Nombre AS Area FROM Area ORDER BY Nombre');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error interno del servidor");
    }
});

app.post('/api/areas', async (req, res) => {
    try {
        const { Area } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request().input('Nombre', sql.VarChar, Area).query(`INSERT INTO Area (Nombre) VALUES (@Nombre)`);
        res.status(201).send("Área creada");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al crear área");
    }
});

app.put('/api/areas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Area } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Area', sql.Int, id).input('Nombre', sql.VarChar, Area)
            .query(`UPDATE Area SET Nombre = @Nombre WHERE Id_Area = @Id_Area`);
        res.status(200).send("Área actualizada");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al actualizar área");
    }
});

app.delete('/api/areas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await pool.request().input('Id_Area', sql.Int, id).query(`DELETE FROM Area WHERE Id_Area = @Id_Area`);
        res.status(200).send("Área eliminada");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al eliminar área");
    }
});

// Gestión de Servicios
app.get('/api/servicios', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT s.Id_Servicio, s.Nombre, s.Precio_Base, ISNULL(s.Duracion_Minutos, 30) AS Duracion_Minutos, s.Id_Area, a.Nombre AS Area
            FROM Servicio s LEFT JOIN Area a ON s.Id_Area = a.Id_Area
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error interno del servidor");
    }
});

app.post('/api/servicios', async (req, res) => {
    try {
        const { Nombre, Id_Area, Precio_Base, Duracion_Minutos } = req.body;
        const duracionValida = Math.max(5, parseInt(Duracion_Minutos, 10) || 30);
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Nombre', sql.VarChar, Nombre)
            .input('Id_Area', sql.Int, Id_Area)
            .input('Precio_Base', sql.Decimal(10,2), Precio_Base)
            .input('Duracion_Minutos', sql.Int, duracionValida)
            .query(`INSERT INTO Servicio (Nombre, Id_Area, Precio_Base, Duracion_Minutos) VALUES (@Nombre, @Id_Area, @Precio_Base, @Duracion_Minutos)`);
        res.status(201).send("Servicio creado");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al crear servicio");
    }
});

app.put('/api/servicios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre, Id_Area, Precio_Base, Duracion_Minutos } = req.body;
        const duracionValida = Math.max(5, parseInt(Duracion_Minutos, 10) || 30);
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Servicio', sql.Int, id)
            .input('Nombre', sql.VarChar, Nombre)
            .input('Id_Area', sql.Int, Id_Area)
            .input('Precio_Base', sql.Decimal(10,2), Precio_Base)
            .input('Duracion_Minutos', sql.Int, duracionValida)
            .query(`UPDATE Servicio SET Nombre = @Nombre, Id_Area = @Id_Area, Precio_Base = @Precio_Base, Duracion_Minutos = @Duracion_Minutos WHERE Id_Servicio = @Id_Servicio`);
        res.status(200).send("Servicio actualizado");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al actualizar servicio");
    }
});

app.delete('/api/servicios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await pool.request().input('Id_Servicio', sql.Int, id).query(`DELETE FROM Servicio WHERE Id_Servicio = @Id_Servicio`);
        res.status(200).send("Servicio eliminado");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al eliminar servicio");
    }
});

// Extras (Adicionales)
app.get('/api/extras', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT * FROM Extra ORDER BY Nombre");
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo extras:", err);
        res.status(500).send("Error interno del servidor");
    }
});

app.post('/api/extras', async (req, res) => {
    try {
        const { Nombre, Precio } = req.body;
        if (!Nombre || Precio === undefined || isNaN(Precio)) {
            return res.status(400).send("Nombre y precio son requeridos");
        }
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Nombre', sql.VarChar, Nombre.trim())
            .input('Precio', sql.Decimal(10, 2), Precio)
            .query(`INSERT INTO Extra (Nombre, Precio) VALUES (@Nombre, @Precio)`);
        res.status(201).send("Extra creado");
    } catch (err) {
        console.error("Error al crear extra:", err);
        res.status(500).send("Error al crear extra");
    }
});

app.put('/api/extras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre, Precio } = req.body;
        if (!Nombre || Precio === undefined || isNaN(Precio)) {
            return res.status(400).send("Nombre y precio son requeridos");
        }
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Extra', sql.Int, id)
            .input('Nombre', sql.VarChar, Nombre.trim())
            .input('Precio', sql.Decimal(10, 2), Precio)
            .query(`UPDATE Extra SET Nombre = @Nombre, Precio = @Precio WHERE Id_Extra = @Id_Extra`);
        res.status(200).send("Extra actualizado");
    } catch (err) {
        console.error("Error al actualizar extra:", err);
        res.status(500).send("Error al actualizar extra");
    }
});

app.delete('/api/extras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);

        const checkUso = await pool.request()
            .input('Id_Extra', sql.Int, id)
            .query(`SELECT COUNT(*) AS total FROM Turno_Extra WHERE Id_Extra = @Id_Extra`);

        if (checkUso.recordset[0].total > 0) {
            return res.status(400).send("No se puede eliminar el extra porque ya está asociado a turnos registrados.");
        }

        await pool.request()
            .input('Id_Extra', sql.Int, id)
            .query(`DELETE FROM Extra WHERE Id_Extra = @Id_Extra`);
        res.status(200).send("Extra eliminado");
    } catch (err) {
        console.error("Error al eliminar extra:", err);
        res.status(500).send("Error al eliminar extra");
    }
});

// ==========================================================================
// 6. MÓDULO DE AGENDA Y TURNOS
// ==========================================================================

// Vista de Agenda Semanal (Formato para FullCalendar)
app.get('/api/turnos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const resultado = await pool.request().query(`
            SELECT 
                t.Id_Turno AS id, t.Id_Turno, t.Id_Clienta, t.Id_Empleada,
                c.Nombre + ' ' + c.Apellido + ' - ' + s.Nombre + ' (' + e.Nombre_Ap + ')' AS title,
                t.Fecha_Hora AS start, t.Fecha_Hora_Fin AS [end],
                c.Nombre + ' ' + c.Apellido AS Nombre_Clienta, s.Nombre AS Nombre_Servicio, s.Precio_Base AS Precio
            FROM Turno t
            JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
            JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada
            JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
            WHERE t.Estado != 'Cancelado'
        `);
        res.json(resultado.recordset);
    } catch (error) {
        console.error("Error trayendo turnos:", error);
        res.status(500).send("Error interno del servidor");
    }
});

// Vista de Agenda Diaria
app.get('/api/turnos/fecha/:fecha', async (req, res) => {
    try {
        const { fecha } = req.params; 
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('FechaBuscada', sql.VarChar, fecha)
            .query(`
                SELECT 
                    t.Id_Turno, t.Id_Clienta, t.Fecha_Hora, c.Nombre + ' ' + c.Apellido AS Nombre_Clienta,
                    s.Nombre AS Nombre_Servicio, s.Duracion_Minutos, s.Precio_Base, 
                    t.Id_Empleada, e.Nombre_Ap, t.Estado, t.Color, t.Sena_Monto, t.Comentario_Admin,
                    a.Nombre AS Nombre_Area
                FROM Turno t
                JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                LEFT JOIN Area a ON s.Id_Area = a.Id_Area
                JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada 
                WHERE CAST(t.Fecha_Hora AS DATE) = @FechaBuscada AND t.Estado != 'Cancelado'
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo turnos de la agenda: ", err);
        res.status(500).send("Error conectando a la base de datos");
    }
});

// Consultar turnos ocupados de una profesional para evitar solapamientos
app.get('/api/empleadas/:id/agenda/:fecha', async (req, res) => {
    try {
        const { id, fecha } = req.params;
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .input('Fecha', sql.VarChar, fecha) 
            .query(`
                SELECT t.Id_Turno, t.Fecha_Hora, s.Duracion_Minutos FROM Turno t JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                WHERE t.Id_Empleada = @Id_Empleada AND CAST(t.Fecha_Hora AS DATE) = @Fecha AND t.Estado != 'Cancelado'
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error consultando disponibilidad:", error);
        res.status(500).send("Error interno");
    }
});

// Crear Turno Nuevo y registrar seña si existe
app.post('/api/turnos', async (req, res) => {
    const { Id_Clienta, Id_Empleada, Id_Servicio, Fecha_Hora, Sena_Monto } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        const infoServicio = await pool.request().input('Id_Servicio', sql.Int, Id_Servicio).query(`SELECT Duracion_Minutos FROM Servicio WHERE Id_Servicio = @Id_Servicio`);
        if (infoServicio.recordset.length === 0) {
            return res.status(404).send("Servicio no encontrado");
        }
        const duracionNueva = infoServicio.recordset[0].Duracion_Minutos;

        const chequeo = await pool.request()
            .input('Id_Empleada', sql.Int, Id_Empleada)
            .input('NuevaFechaInicio', sql.DateTime, Fecha_Hora)
            .input('DuracionNueva', sql.Int, duracionNueva)
            .query(`
                SELECT t.Id_Turno FROM Turno t JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                WHERE t.Id_Empleada = @Id_Empleada AND t.Estado != 'Cancelado' AND (
                    @NuevaFechaInicio < DATEADD(MINUTE, s.Duracion_Minutos, t.Fecha_Hora)
                    AND DATEADD(MINUTE, @DuracionNueva, @NuevaFechaInicio) > t.Fecha_Hora
                )
            `);

        if (chequeo.recordset.length > 0) return res.status(400).send("La profesional ya tiene un turno que se superpone en ese horario.");

        await pool.request()
            .input('Id_Clienta', sql.Int, Id_Clienta)
            .input('Id_Empleada', sql.Int, Id_Empleada)
            .input('Id_Servicio', sql.Int, Id_Servicio)
            .input('Fecha_Hora', sql.DateTime, Fecha_Hora)
            .input('DuracionNueva', sql.Int, duracionNueva)
            .input('Sena_Monto', sql.Decimal(10,2), Sena_Monto || 0)
            .query(`
                INSERT INTO Turno (Id_Clienta, Id_Empleada, Id_Servicio, Fecha_Hora, Fecha_Hora_Fin, Sena_Monto) 
                VALUES (@Id_Clienta, @Id_Empleada, @Id_Servicio, @Fecha_Hora, DATEADD(MINUTE, @DuracionNueva, @Fecha_Hora), @Sena_Monto);
                
                IF (@Sena_Monto > 0) BEGIN
                    DECLARE @NuevoIdTurno INT = SCOPE_IDENTITY();
                    DECLARE @NombreC VARCHAR(100);
                    SELECT @NombreC = Nombre + ' ' + Apellido FROM Clienta WHERE Id_Clienta = @Id_Clienta;
                    -- Buscamos dinámicamente el ID de 'Transferencia' en la nueva tabla
                    DECLARE @IdTransferencia INT = (SELECT TOP 1 Id_Medio_Pago FROM Medio_Pago WHERE Nombre = 'Transferencia');
                    
                    INSERT INTO Ingreso (Id_Turno, Concepto, Monto_Total, Fecha, Id_Medio_Pago) 
                    VALUES (@NuevoIdTurno, 'Seña abonada - ' + @NombreC, @Sena_Monto, GETDATE(), @IdTransferencia);
                END
            `);
        res.status(201).json({ message: "¡Turno creado exitosamente!" });
    } catch (err) {
        console.error("Error al crear turno:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Consultar datos core para editar un turno
app.get('/api/turnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().input('Id_Turno', sql.Int, id).query(`
                SELECT t.Id_Turno, t.Id_Clienta, c.Nombre + ' ' + c.Apellido AS NombreClienta,
                       t.Id_Empleada, t.Id_Servicio, s.Id_Area, t.Fecha_Hora
                FROM Turno t JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
                WHERE t.Id_Turno = @Id_Turno
            `);
        if(result.recordset.length === 0) return res.status(404).send("Turno no encontrado");
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error interno");
    }
});

// Actualizar datos de un turno (Reprogramación)
app.put('/api/turnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Id_Servicio, Id_Empleada, Fecha_Hora } = req.body;
        let pool = await sql.connect(dbConfig);
        
        const infoS = await pool.request().input('Id', sql.Int, Id_Servicio).query(`SELECT Duracion_Minutos FROM Servicio WHERE Id_Servicio = @Id`);
        if (infoS.recordset.length === 0) {
            return res.status(404).send("Servicio no encontrado");
        }
        const dur = infoS.recordset[0].Duracion_Minutos;

        const chk = await pool.request()
            .input('IdE', sql.Int, Id_Empleada).input('NFI', sql.DateTime, Fecha_Hora).input('Dur', sql.Int, dur).input('IdTurno', sql.Int, id)
            .query(`
                SELECT t.Id_Turno FROM Turno t JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio 
                WHERE t.Id_Empleada = @IdE AND t.Id_Turno != @IdTurno AND t.Estado != 'Cancelado'
                AND (@NFI < DATEADD(MINUTE, s.Duracion_Minutos, t.Fecha_Hora) AND DATEADD(MINUTE, @Dur, @NFI) > t.Fecha_Hora)
            `);
        if (chk.recordset.length > 0) return res.status(400).send("La profesional ya tiene un turno en ese horario.");

        await pool.request()
            .input('Id', sql.Int, id).input('IdS', sql.Int, Id_Servicio).input('IdE', sql.Int, Id_Empleada).input('FH', sql.DateTime, Fecha_Hora).input('Dur', sql.Int, dur)
            .query(`UPDATE Turno SET Id_Servicio = @IdS, Id_Empleada = @IdE, Fecha_Hora = @FH, Fecha_Hora_Fin = DATEADD(MINUTE, @Dur, @FH) WHERE Id_Turno = @Id`);
        res.status(200).json({ message: "Turno modificado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error interno al actualizar");
    }
});

// Guardar notas internas y colores en el turno
app.put('/api/turnos/:id/detalles', async (req, res) => {
    try {
        const { id } = req.params;
        const { Color, Comentario_Admin } = req.body; 
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Turno', sql.Int, id)
            .input('NuevoColor', sql.VarChar, Color !== undefined ? Color.trim() : '') 
            .input('Comentario', sql.VarChar, Comentario_Admin || '')
            .query(`
                UPDATE Turno 
                SET Color = NULLIF(@NuevoColor, ''),
                    Comentario_Admin = @Comentario,
                    Estado = CASE WHEN Estado = 'Pendiente' THEN 'En progreso' ELSE Estado END
                WHERE Id_Turno = @Id_Turno AND Estado != 'Pagado'
            `);
        res.status(200).send("Detalles y comentarios actualizados.");
    } catch (error) {
        console.error("Error al guardar detalles:", error);
        res.status(500).send("Error interno al actualizar el turno");
    }
});

// Registrar o actualizar seña tardía (Calculando la diferencia)
app.put('/api/turnos/:id/sena', async (req, res) => {
    const { id } = req.params;
    const { Sena_Monto, Nombre_Clienta } = req.body; 
    
    try {
        const senaNumerica = parseFloat(Sena_Monto);
        if (isNaN(senaNumerica) || senaNumerica < 0) {
            return res.status(400).send("El monto de la seña debe ser un número mayor o igual a 0.");
        }

        let pool = await sql.connect(dbConfig);
        
        // 1. Consultamos cuánta seña y estado ya tenía registrada este turno
        const turnoActual = await pool.request()
            .input('Id', sql.Int, id)
            .query('SELECT Sena_Monto, Estado FROM Turno WHERE Id_Turno = @Id');
            
        if (turnoActual.recordset.length === 0) return res.status(404).send("Turno no encontrado");
        
        const estadoTurno = turnoActual.recordset[0].Estado;
        if (estadoTurno === 'Pagado') {
            return res.status(400).send("No se puede modificar la seña de un turno ya pagado.");
        }
        if (estadoTurno === 'Cancelado') {
            return res.status(400).send("No se puede modificar la seña de un turno cancelado.");
        }

        const senaPrevia = turnoActual.recordset[0].Sena_Monto || 0;
        const diferencia = senaNumerica - senaPrevia; // Calculamos la plata real que está ingresando ahora
        
        // 2. Actualizamos el Turno con el nuevo monto total de la seña
        await pool.request()
            .input('Id', sql.Int, id)
            .input('Monto', sql.Decimal(10,2), senaNumerica)
            .query('UPDATE Turno SET Sena_Monto = @Monto WHERE Id_Turno = @Id'); 
            
        // 3. Registramos el ingreso SOLO si la clienta agregó plata (diferencia positiva)
        if (diferencia > 0) {
            await pool.request()
                .input('Id_Turno', sql.Int, id)
                .input('Concepto', sql.VarChar, `Seña abonada (Agregado) - ${Nombre_Clienta || ''}`)
                .input('Monto', sql.Decimal(10,2), diferencia)
                .query(`
                    DECLARE @IdTransferencia INT = (SELECT TOP 1 Id_Medio_Pago FROM Medio_Pago WHERE Nombre = 'Transferencia');
                    
                    INSERT INTO Ingreso (Id_Turno, Concepto, Monto_Total, Fecha, Id_Medio_Pago) 
                    VALUES (@Id_Turno, @Concepto, @Monto, GETDATE(), @IdTransferencia)
                `);
        }
        
        res.json({ message: "Seña actualizada y diferencia registrada en caja" });
    } catch (err) {
        console.error("Error al actualizar seña:", err);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// Cancelar un turno (soporta PUT /cancelar, POST /cancelar y DELETE /api/turnos/:id)
const cancelarTurnoHandler = async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);

        const turnoActual = await pool.request()
            .input('Id', sql.Int, id)
            .query('SELECT Estado FROM Turno WHERE Id_Turno = @Id');

        if (turnoActual.recordset.length === 0) {
            return res.status(404).send("Turno no encontrado");
        }

        if (turnoActual.recordset[0].Estado === 'Pagado') {
            return res.status(400).send("No se puede cancelar un turno que ya fue cobrado.");
        }

        await pool.request()
            .input('Id', sql.Int, id)
            .query("UPDATE Turno SET Estado = 'Cancelado' WHERE Id_Turno = @Id");

        res.status(200).json({ message: "Turno cancelado exitosamente" });
    } catch (err) {
        console.error("Error al cancelar turno:", err);
        res.status(500).send("Error interno al cancelar el turno");
    }
};

app.put('/api/turnos/:id/cancelar', cancelarTurnoHandler);
app.post('/api/turnos/:id/cancelar', cancelarTurnoHandler);
app.delete('/api/turnos/:id', cancelarTurnoHandler);

// ==========================================================================
// 7. MÓDULO DE FINANZAS (Caja, Ingresos, Gastos y Cobro de turnos)
// ==========================================================================

// --- GASTOS Y CATEGORÍAS ---
app.get('/api/categorias-gastos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT * FROM Categoria_Gasto ORDER BY Nombre");
        res.json(result.recordset);
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.post('/api/categorias-gastos', async (req, res) => {
    try {
        const { Nombre } = req.body;
        if (!Nombre) return res.status(400).send("El nombre es obligatorio");
        let pool = await sql.connect(dbConfig);
        await pool.request().input('Nombre', sql.VarChar, Nombre).query(`INSERT INTO Categoria_Gasto (Nombre) VALUES (@Nombre)`);
        res.status(201).json({ message: "¡Categoría creada exitosamente!" });
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.put('/api/categorias-gastos/:id', async (req, res) => {
    try {
        const { id } = req.params; const { Nombre } = req.body;
        if (!Nombre) return res.status(400).send("El nombre es obligatorio");
        let pool = await sql.connect(dbConfig);
        await pool.request().input('Id_Categoria', sql.Int, id).input('Nombre', sql.VarChar, Nombre).query(`UPDATE Categoria_Gasto SET Nombre = @Nombre WHERE Id_Categoria = @Id_Categoria`);
        res.status(200).json({ message: "Categoría actualizada exitosamente" });
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.delete('/api/categorias-gastos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await pool.request().input('Id_Categoria', sql.Int, id).query(`DELETE FROM Categoria_Gasto WHERE Id_Categoria = @Id_Categoria`);
        res.status(200).json({ message: "Categoría eliminada con éxito" });
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.get('/api/gastos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                g.Id_Gasto, 
                g.Fecha, 
                g.Descripcion, 
                g.Monto, 
                c.Nombre AS Nombre_Categoria,
                mp.Nombre AS Medio_Pago /* <-- Traemos el nombre del medio de pago */
            FROM Gasto g 
            LEFT JOIN Categoria_Gasto c ON g.Id_Categoria = c.Id_Categoria
            LEFT JOIN Medio_Pago mp ON g.Id_Medio_Pago = mp.Id_Medio_Pago /* <-- Relación agregada */
            ORDER BY g.Fecha DESC, g.Id_Gasto DESC
        `);
        res.json(result.recordset);
    } catch (err) { 
        console.error(err); 
        res.status(500).send("Error interno"); 
    }
});

app.post('/api/gastos', async (req, res) => {
    try {
        const { Fecha, Descripcion, Monto, Id_Categoria, Id_Medio_Pago } = req.body; // Agregamos Id_Medio_Pago
        const fechaISO = normalizarFechaISO(Fecha);
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Fecha', sql.VarChar(10), fechaISO)
            .input('Descripcion', sql.VarChar, Descripcion)
            .input('Monto', sql.Decimal(12, 2), Monto)
            .input('Id_Categoria', sql.Int, Id_Categoria || null)
            .input('Id_Medio_Pago', sql.Int, Id_Medio_Pago || null) // Lo pasamos al query
            .query(`INSERT INTO Gasto (Fecha, Descripcion, Monto, Id_Categoria, Id_Medio_Pago) VALUES (TRY_CONVERT(DATE, @Fecha, 23), @Descripcion, @Monto, @Id_Categoria, @Id_Medio_Pago)`);
        res.status(201).send("Gasto registrado correctamente");
    } catch (error) { console.error(error); res.status(500).send("Error al registrar"); }
});

app.delete('/api/gastos/:id', async (req, res) => {
    try {
        const { id } = req.params; let pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id_Gasto', sql.Int, id).query(`DELETE FROM Gasto WHERE Id_Gasto = @Id_Gasto`);
        if (result.rowsAffected[0] > 0) res.status(200).json({ message: "Gasto eliminado con éxito" });
        else res.status(404).send("Gasto no encontrado");
    } catch (err) { console.error(err); res.status(500).send("Error al eliminar"); }
});

// --- INGRESOS Y COBROS ---
app.get('/api/ingresos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                i.Id_Ingreso, 
                i.Fecha, 
                i.Monto_Total, 
                mp.Nombre AS Medio_Pago, /* <-- Traemos el nombre desde la nueva tabla */
                i.Concepto, 
                c.Nombre + ' ' + c.Apellido AS Nombre_Clienta, 
                s.Nombre AS Nombre_Servicio
            FROM Ingreso i 
            LEFT JOIN Turno t ON i.Id_Turno = t.Id_Turno 
            LEFT JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta 
            LEFT JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
            LEFT JOIN Medio_Pago mp ON i.Id_Medio_Pago = mp.Id_Medio_Pago /* <-- Nueva conexión */
            ORDER BY i.Fecha DESC, i.Id_Ingreso DESC
        `);
        res.json(result.recordset);
    } catch (err) { 
        console.error(err); 
        res.status(500).send("Error interno"); 
    }
});

app.post('/api/ingresos/manual', async (req, res) => {
    try {
        const { Concepto, Monto_Total, Id_Medio_Pago } = req.body; // Recibimos el ID numérico
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Concepto', sql.VarChar, Concepto)
            .input('Monto_Total', sql.Decimal(10,2), Monto_Total)
            .input('Id_Medio_Pago', sql.Int, Id_Medio_Pago)
            .query(`INSERT INTO Ingreso (Fecha, Monto_Total, Id_Medio_Pago, Concepto) VALUES (GETDATE(), @Monto_Total, @Id_Medio_Pago, @Concepto)`);
        
        res.status(201).json({ message: "Ingreso manual registrado" });
    } catch (err) { 
        console.error(err); 
        res.status(500).send("Error interno"); 
    }
});

app.post('/api/cobrar-turno', async (req, res) => {
    try {
        const { 
            idTurno, montoTotal, idMedioPago, descuento, 
            tipoDescuento, descuentoAfectaComision,
            extras, color, comentarioAdmin, sumarSello, reiniciarRachaPrevia 
        } = req.body;
        const colorFinal = color !== undefined ? color : req.body.Color;
        const comentarioFinal = comentarioAdmin !== undefined ? comentarioAdmin : req.body.Comentario_Admin;
        let pool = await sql.connect(dbConfig);
        await asegurarTablaSelloFidelidad(pool);
        await asegurarColumnasDescuentoTurno(pool);
        
        const chequeo = await pool.request().input('Id_Turno', sql.Int, idTurno).query(`
                SELECT t.Estado, t.Id_Clienta, s.Nombre AS NombreServicio
                FROM Turno t
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                WHERE t.Id_Turno = @Id_Turno
            `);
        if (chequeo.recordset.length === 0) return res.status(404).send("Turno no encontrado");
        if (chequeo.recordset[0].Estado === 'Pagado') return res.status(400).send("¡Ojo! Este turno ya fue cobrado.");

        const idClientaTurno = chequeo.recordset[0].Id_Clienta;
        const nombreDelServicio = chequeo.recordset[0].NombreServicio;
        const conceptoDinamico = `Turno: ${nombreDelServicio}`;

        const descuentoNum = parseFloat(descuento) || 0;
        const tipoDescuentoFinal = (descuentoNum > 0) ? (tipoDescuento || 'Ninguno') : 'Ninguno';
        const afectaComisionFinal = (descuentoNum > 0 && Boolean(descuentoAfectaComision)) ? 1 : 0;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const requestIngreso = new sql.Request(transaction);
            await requestIngreso
                .input('Id_Turno', sql.Int, idTurno)
                .input('Concepto', sql.VarChar, conceptoDinamico)
                .input('Monto_Total', sql.Decimal(12, 2), montoTotal)
                .input('Id_Medio_Pago', sql.Int, idMedioPago) // Usamos la columna nueva
                .input('Descuento', sql.Decimal(12, 2), descuentoNum)
                .query(`INSERT INTO Ingreso (Id_Turno, Fecha, Concepto, Monto_Total, Id_Medio_Pago, Descuento) VALUES (@Id_Turno, GETDATE(), @Concepto, @Monto_Total, @Id_Medio_Pago, @Descuento)`);
            
            if (extras && extras.length > 0) {
                for (let idEx of extras) {
                    await new sql.Request(transaction).input('IdT', sql.Int, idTurno).input('IdE', sql.Int, idEx)
                        .query(`INSERT INTO Turno_Extra (Id_Turno, Id_Extra, Precio_Cobrado) SELECT @IdT, @IdE, Precio FROM Extra WHERE Id_Extra = @IdE`);
                }
            }
            const requestEstado = new sql.Request(transaction);
            await requestEstado
                .input('Id_Turno', sql.Int, idTurno)
                .input('Descuento', sql.Decimal(10, 2), descuentoNum)
                .input('Tipo_Descuento', sql.VarChar(20), tipoDescuentoFinal)
                .input('Descuento_Afecta_Comision', sql.Bit, afectaComisionFinal)
                .input('Color', sql.VarChar, colorFinal !== undefined && colorFinal !== null ? colorFinal.trim() : null)
                .input('Comentario', sql.VarChar, comentarioFinal !== undefined && comentarioFinal !== null ? comentarioFinal.trim() : null)
                .query(`
                    UPDATE Turno 
                    SET Estado = 'Pagado',
                        Descuento = @Descuento,
                        Tipo_Descuento = @Tipo_Descuento,
                        Descuento_Afecta_Comision = @Descuento_Afecta_Comision,
                        Color = CASE 
                            WHEN @Color IS NOT NULL THEN NULLIF(@Color, '') 
                            ELSE Color 
                        END,
                        Comentario_Admin = CASE 
                            WHEN @Comentario IS NOT NULL THEN NULLIF(@Comentario, '') 
                            ELSE Comentario_Admin 
                        END
                    WHERE Id_Turno = @Id_Turno
                `);

            // --- LÓGICA DE TARJETA DE FIDELIDAD ---
            if (idClientaTurno) {
                if (Boolean(reiniciarRachaPrevia)) {
                    await new sql.Request(transaction)
                        .input('Id_Clienta', sql.Int, idClientaTurno)
                        .query(`
                            UPDATE Sello_Fidelidad
                            SET Activo = 0
                            WHERE Id_Clienta = @Id_Clienta AND Activo = 1
                        `);
                }

                if (Boolean(sumarSello)) {
                    const sellosRes = await new sql.Request(transaction)
                        .input('Id_Clienta', sql.Int, idClientaTurno)
                        .query(`
                            SELECT Id_Sello, Numero_Slot, CONVERT(VARCHAR(10), Fecha_Sello, 23) AS Fecha_Sello
                            FROM Sello_Fidelidad
                            WHERE Id_Clienta = @Id_Clienta AND Activo = 1
                            ORDER BY Numero_Slot ASC
                        `);

                    let sellosActivos = sellosRes.recordset || [];
                    const metaActual = calcularMetadatosFidelidad(sellosActivos);

                    if (!metaActual.yaTieneSelloEsteMes) {
                        // Si ya tenía los 10 sellos completos de meses previos, archivamos esa tarjeta y empezamos en 1
                        if (sellosActivos.length >= 10) {
                            await new sql.Request(transaction)
                                .input('Id_Clienta', sql.Int, idClientaTurno)
                                .query(`
                                    UPDATE Sello_Fidelidad
                                    SET Activo = 0
                                    WHERE Id_Clienta = @Id_Clienta AND Activo = 1
                                `);
                            sellosActivos = [];
                        }

                        const metaParaInsertar = calcularMetadatosFidelidad(sellosActivos);
                        const slotCorrespondiente = metaParaInsertar.proximoSlot;

                        await new sql.Request(transaction)
                            .input('Id_Clienta', sql.Int, idClientaTurno)
                            .input('Numero_Slot', sql.Int, slotCorrespondiente)
                            .query(`
                                INSERT INTO Sello_Fidelidad (Id_Clienta, Fecha_Sello, Numero_Slot, Activo)
                                VALUES (@Id_Clienta, CAST(GETDATE() AS DATE), @Numero_Slot, 1)
                            `);
                    }
                }
            }
            
            await transaction.commit(); res.status(200).json({ message: "¡Cobro registrado exitosamente!" });
        } catch (err) { await transaction.rollback(); throw err; }
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

// ==========================================================================
// 8. MÓDULO DE CONFIGURACIÓN GENERAL (Horarios del local y Medios de Pago)
// ==========================================================================

// --- HORARIOS DE ATENCIÓN ---
app.get('/api/horarios', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT * FROM Horario_Atencion ORDER BY Id_Horario");
        res.json(result.recordset);
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.put('/api/horarios/bulk', async (req, res) => {
    try {
        const { diasIds, Laborable, Hora_Apertura_1, Hora_Cierre_1, Hora_Apertura_2, Hora_Cierre_2 } = req.body;
        if (!diasIds || diasIds.length === 0) return res.status(400).send("No se seleccionaron días");

        let pool = await sql.connect(dbConfig); 
        const transaction = new sql.Transaction(pool); 
        await transaction.begin();
        
        try {
            for (let id of diasIds) {
                const request = new sql.Request(transaction);
                await request
                    .input('Id', sql.Int, id)
                    .input('Laborable', sql.Bit, Laborable)
                    .input('Apertura1', sql.VarChar, Hora_Apertura_1 || null) // Cambiado a VarChar
                    .input('Cierre1', sql.VarChar, Hora_Cierre_1 || null)     // Cambiado a VarChar
                    .input('Apertura2', sql.VarChar, Hora_Apertura_2 || null) // Cambiado a VarChar
                    .input('Cierre2', sql.VarChar, Hora_Cierre_2 || null)     // Cambiado a VarChar
                    .query(`UPDATE Horario_Atencion SET Laborable = @Laborable, Hora_Apertura_1 = @Apertura1, Hora_Cierre_1 = @Cierre1, Hora_Apertura_2 = @Apertura2, Hora_Cierre_2 = @Cierre2 WHERE Id_Horario = @Id`);
            }
            await transaction.commit(); 
            res.status(200).send("Horarios actualizados exitosamente");
        } catch (err) { 
            await transaction.rollback(); 
            throw err; 
        }
    } catch (err) { 
        console.error(err); 
        res.status(500).send("Error interno"); 
    }
});
// --- MEDIOS DE PAGO ---
app.get('/api/medios-pago', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`SELECT Id_Medio_Pago, Nombre FROM Medio_Pago WHERE Activo = 1 ORDER BY Nombre ASC`);
        res.json(result.recordset);
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.post('/api/medios-pago', async (req, res) => {
    try {
        const { Nombre } = req.body; let pool = await sql.connect(dbConfig);
        await pool.request().input('Nombre', sql.VarChar, Nombre).query('INSERT INTO Medio_Pago (Nombre, Activo) VALUES (@Nombre, 1)');
        res.status(201).send("Creado");
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.put('/api/medios-pago/:id', async (req, res) => {
    try {
        const { id } = req.params; const { Nombre } = req.body; let pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.Int, id).input('Nombre', sql.VarChar, Nombre).query('UPDATE Medio_Pago SET Nombre = @Nombre WHERE Id_Medio_Pago = @Id');
        res.status(200).send("Actualizado");
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

app.delete('/api/medios-pago/:id', async (req, res) => {
    try {
        const { id } = req.params; let pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.Int, id).query('UPDATE Medio_Pago SET Activo = 0 WHERE Id_Medio_Pago = @Id');
        res.status(200).send("Desactivado");
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

// ==========================================================================
// 9. MÓDULO DE ESTADÍSTICAS (DASHBOARD)
// ==========================================================================
app.get('/api/dashboard/kpis', async (req, res) => {
    const { desde, hasta, idEmpleada } = req.query;
    try {
        let pool = await sql.connect(dbConfig);
        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';
        
        if (idEmpleada) {
            // Lógica exclusiva para la Profesional
            const query = `
                DECLARE @MisGanancias DECIMAL(12,2) = (SELECT ISNULL(SUM(Monto_Total), 0) FROM Liquidacion_Sueldo WHERE Id_Empleada = @Id AND Fecha >= @Desde AND Fecha <= @Hasta);
                DECLARE @MisTurnos INT = (SELECT COUNT(*) FROM Turno WHERE Id_Empleada = @Id AND Estado IN ('Completado', 'Pagado') AND Fecha_Hora >= @Desde AND Fecha_Hora <= @Hasta);
                DECLARE @DiasTrabajados INT = (SELECT COUNT(DISTINCT CAST(Fecha_Hora AS DATE)) FROM Turno WHERE Id_Empleada = @Id AND Estado IN ('Completado', 'Pagado') AND Fecha_Hora >= @Desde AND Fecha_Hora <= @Hasta);
                DECLARE @MiPromedio DECIMAL(5,2) = CASE WHEN @DiasTrabajados > 0 THEN CAST(@MisTurnos AS DECIMAL(5,2)) / @DiasTrabajados ELSE 0 END;
                SELECT @MisGanancias AS MisGanancias, @MisTurnos AS MisTurnos, @MiPromedio AS MiPromedio;
            `;
            let result = await pool.request().input('Desde', sql.DateTime, fechaDesde).input('Hasta', sql.DateTime, fechaHasta).input('Id', sql.Int, idEmpleada).query(query);
            res.json(result.recordset[0]);
        } else {
            // Lógica original para la Administradora
            const query = `
                DECLARE @TotalIngresos DECIMAL(12,2) = (SELECT ISNULL(SUM(Monto_Total), 0) FROM Ingreso WHERE Fecha >= @Desde AND Fecha <= @Hasta);
                DECLARE @TotalGastos DECIMAL(12,2) = (SELECT ISNULL(SUM(Monto), 0) FROM Gasto WHERE Fecha >= @Desde AND Fecha <= @Hasta);
                DECLARE @TotalSueldos DECIMAL(12,2) = (SELECT ISNULL(SUM(Monto_Total), 0) FROM Liquidacion_Sueldo WHERE Fecha >= @Desde AND Fecha <= @Hasta);
                SELECT @TotalIngresos AS Ingresos, @TotalGastos AS Gastos, @TotalSueldos AS Sueldos, (@TotalIngresos - @TotalGastos - @TotalSueldos) AS GananciaNeta;
            `;
            let result = await pool.request().input('Desde', sql.DateTime, fechaDesde).input('Hasta', sql.DateTime, fechaHasta).query(query);
            res.json(result.recordset[0]);
        }
    } catch (err) { console.error(err); res.status(500).send("Error interno"); }
});

// Gráfico de Ingresos y Turnos (Solo Admin, queda igual)
app.get('/api/dashboard/grafico-ingresos', async (req, res) => {
    const { desde, hasta } = req.query;
    try {
        let pool = await sql.connect(dbConfig);
        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';
        const query = `
            WITH IngresosDiarios AS (SELECT CAST(Fecha AS DATE) as FechaDia, SUM(Monto_Total) as Total FROM Ingreso WHERE Fecha >= @Desde AND Fecha <= @Hasta GROUP BY CAST(Fecha AS DATE)),
            TurnosDiarios AS (SELECT CAST(Fecha_Hora AS DATE) as FechaDia, COUNT(Id_Turno) as Cantidad FROM Turno WHERE Fecha_Hora >= @Desde AND Fecha_Hora <= @Hasta GROUP BY CAST(Fecha_Hora AS DATE))
            SELECT CONVERT(VARCHAR(5), ISNULL(i.FechaDia, t.FechaDia), 103) as Dia, CONVERT(VARCHAR(10), ISNULL(i.FechaDia, t.FechaDia), 23) as FechaCompleta, ISNULL(i.Total, 0) as Total, ISNULL(t.Cantidad, 0) as Turnos
            FROM IngresosDiarios i FULL OUTER JOIN TurnosDiarios t ON i.FechaDia = t.FechaDia ORDER BY ISNULL(i.FechaDia, t.FechaDia) ASC
        `;
        let result = await pool.request().input('Desde', sql.DateTime, fechaDesde).input('Hasta', sql.DateTime, fechaHasta).query(query);
        res.json(result.recordset);
    } catch (err) { console.error(err); res.status(500).json({ error: "Error interno" }); }
});

// Servicios Estrella (Adaptado para recibir IdEmpleada opcional)
app.get('/api/dashboard/servicios-estrella', async (req, res) => {
    const { desde, hasta, idEmpleada } = req.query;
    try {
        let pool = await sql.connect(dbConfig);
        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';
        
        let request = pool.request().input('Desde', sql.DateTime, fechaDesde).input('Hasta', sql.DateTime, fechaHasta);
        let query = '';
        
        if (idEmpleada) {
            query = `SELECT TOP 5 s.Nombre, COUNT(t.Id_Turno) as Cantidad FROM Turno t JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio WHERE t.Id_Empleada = @Id AND t.Estado IN ('Completado', 'Pagado') AND t.Fecha_Hora >= @Desde AND t.Fecha_Hora <= @Hasta GROUP BY s.Nombre ORDER BY Cantidad DESC`;
            request.input('Id', sql.Int, idEmpleada);
        } else {
            query = `SELECT TOP 5 s.Nombre, COUNT(t.Id_Turno) as Cantidad FROM Turno t JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio WHERE t.Fecha_Hora >= @Desde AND t.Fecha_Hora <= @Hasta GROUP BY s.Nombre ORDER BY Cantidad DESC`;
        }
        
        let result = await request.query(query);
        res.json(result.recordset);
    } catch (err) { console.error(err); res.status(500).json({ error: "Error interno" }); }
});

// Top Empleadas (Solo Admin, queda igual)
app.get('/api/dashboard/top-empleadas', async (req, res) => {
    const { desde, hasta } = req.query;
    try {
        let pool = await sql.connect(dbConfig);
        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';
        const query = `
            SELECT TOP 5 e.Nombre_Ap AS Nombre, COUNT(t.Id_Turno) as Cantidad FROM Turno t JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada
            WHERE t.Estado IN ('Completado', 'Pagado') AND t.Fecha_Hora >= @Desde AND t.Fecha_Hora <= @Hasta GROUP BY e.Nombre_Ap ORDER BY Cantidad DESC
        `;
        let result = await pool.request().input('Desde', sql.DateTime, fechaDesde).input('Hasta', sql.DateTime, fechaHasta).query(query);
        res.json(result.recordset);
    } catch (err) { console.error(err); res.status(500).json({ error: "Error interno" }); }
});

// NUEVA RUTA: Horarios Frecuentes (Exclusiva Empleada)
app.get('/api/dashboard/horarios-frecuentes', async (req, res) => {
    const { desde, hasta, idEmpleada } = req.query;
    try {
        let pool = await sql.connect(dbConfig);
        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';
        
        const query = `
            SELECT TOP 5 CONVERT(VARCHAR(5), t.Fecha_Hora, 108) AS Horario, COUNT(t.Id_Turno) as Cantidad 
            FROM Turno t
            WHERE t.Id_Empleada = @Id AND t.Estado IN ('Completado', 'Pagado') AND t.Fecha_Hora >= @Desde AND t.Fecha_Hora <= @Hasta
            GROUP BY CONVERT(VARCHAR(5), t.Fecha_Hora, 108)
            ORDER BY Cantidad DESC
        `;
        let result = await pool.request()
            .input('Desde', sql.DateTime, fechaDesde)
            .input('Hasta', sql.DateTime, fechaHasta)
            .input('Id', sql.Int, idEmpleada)
            .query(query);
        res.json(result.recordset);
    } catch (err) { console.error(err); res.status(500).json({ error: "Error interno" }); }
});

// Ingresos por Medio de Pago
app.get('/api/dashboard/medios-pago-usados', async (req, res) => {
    const { desde, hasta } = req.query;
    try {
        let pool = await sql.connect(dbConfig);
        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';
        
        // Sumamos los montos de la tabla Ingreso agrupados por medio de pago
        const query = `
            SELECT mp.Nombre, ISNULL(SUM(i.Monto_Total), 0) AS Total
            FROM Ingreso i
            JOIN Medio_Pago mp ON i.Id_Medio_Pago = mp.Id_Medio_Pago
            WHERE i.Fecha >= @Desde AND i.Fecha <= @Hasta
            GROUP BY mp.Nombre
            ORDER BY Total DESC
        `;
        
        let result = await pool.request()
            .input('Desde', sql.DateTime, fechaDesde)
            .input('Hasta', sql.DateTime, fechaHasta)
            .query(query);
            
        res.json(result.recordset);
    } catch (err) { 
        console.error(err); 
        res.status(500).json({ error: "Error interno" }); 
    }
});

// ==========================================================================
// 10. INICIO DEL SERVIDOR
// ==========================================================================

// =========================================================================
// RUTINAS DE MENSAJERÍA AUTOMÁTICA Y BAJO DEMANDA (WHATSAPP BOT)
// =========================================================================

// Función auxiliar para reemplazar todas las ocurrencias de comodines en plantillas
function reemplazarVariablesPlantilla(textoBase, variables) {
    let resultado = String(textoBase || '');
    for (const [clave, valor] of Object.entries(variables)) {
        resultado = resultado.replaceAll(clave, valor !== undefined && valor !== null ? String(valor) : '');
    }
    return resultado;
}

// 1. Recordatorios a clientas con turnos pendientes para mañana
const ejecutarRecordatorios24hs = async () => {
    console.log('Ejecutando rutina de recordatorios diarios (Turnos de mañana)...');
    try {
        const estadoActual = getEstadoBot();
        if (estadoActual.estado !== 'Conectado') {
            return { ok: false, error: `El bot no está conectado (Estado: ${estadoActual.estado}).` };
        }

        let pool = await sql.connect(dbConfig);
        
        const resultPlantilla = await pool.request()
            .input('funcion', sql.VarChar, 'Recordatorio_24hs')
            .query('SELECT Texto_Mensaje FROM Plantillas_Bot WHERE Nombre_Funcion = @funcion');
        
        if (resultPlantilla.recordset.length === 0) {
            return { ok: false, error: 'No se encontró la plantilla Recordatorio_24hs en la base de datos.' };
        }
        const textoBase = resultPlantilla.recordset[0].Texto_Mensaje;

        const resultTurnos = await pool.request().query(`
            SELECT t.Id_Turno, c.Nombre AS Nombre_Clienta, c.Telefono, s.Nombre AS Nombre_Servicio, e.Nombre_Ap AS Nombre_Empleada, t.Fecha_Hora
            FROM Turno t
            INNER JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
            INNER JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
            LEFT JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada
            WHERE CAST(t.Fecha_Hora AS DATE) = CAST(DATEADD(day, 1, GETDATE()) AS DATE)
            AND t.Estado = 'Pendiente'
            ORDER BY t.Fecha_Hora ASC
        `);

        const turnosManana = resultTurnos.recordset;

        if (turnosManana.length === 0) {
            console.log('No hay turnos pendientes para mañana. Nada que enviar.');
            return { ok: true, enviados: 0, total: 0, message: 'No hay turnos pendientes agendados para mañana.' };
        }

        let enviados = 0;
        for (let turno of turnosManana) {
            if (turno.Telefono && String(turno.Telefono).replace(/\D/g, '').length >= 8) {
                const fechaTurno = new Date(turno.Fecha_Hora);
                const horaFormateada = fechaTurno.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

                const mensajeFinal = reemplazarVariablesPlantilla(textoBase, {
                    '{Nombre_Clienta}': turno.Nombre_Clienta,
                    '{Nombre_Servicio}': turno.Nombre_Servicio,
                    '{Hora}': horaFormateada,
                    '{Nombre_Empleada}': turno.Nombre_Empleada || ''
                });

                const resEnvio = await enviarMensaje(turno.Telefono, mensajeFinal);
                if (resEnvio && resEnvio.ok) enviados++;
            }
        }
        console.log(`Rutina de recordatorios finalizada: ${enviados}/${turnosManana.length} enviados.`);
        return {
            ok: true,
            enviados,
            total: turnosManana.length,
            message: `Recordatorios enviados: ${enviados} de ${turnosManana.length} turnos para mañana.`
        };
    } catch (error) {
        console.error('Error al ejecutar la rutina de recordatorios:', error);
        return { ok: false, error: 'Error interno al procesar los recordatorios.' };
    }
};

// 2. Fidelización: retorno a los 15 días de un turno completado/pagado
const ejecutarRetorno15Dias = async () => {
    console.log('Ejecutando rutina de fidelización: 15 días...');
    try {
        const estadoActual = getEstadoBot();
        if (estadoActual.estado !== 'Conectado') {
            return { ok: false, error: `El bot no está conectado (Estado: ${estadoActual.estado}).` };
        }

        let pool = await sql.connect(dbConfig);
        
        const resultPlantilla = await pool.request()
            .input('funcion', sql.VarChar, 'Retorno_15_Dias')
            .query('SELECT Texto_Mensaje FROM Plantillas_Bot WHERE Nombre_Funcion = @funcion');
        
        if (resultPlantilla.recordset.length === 0) {
            return { ok: false, error: 'No se encontró la plantilla Retorno_15_Dias en la base de datos.' };
        }
        const textoBase = resultPlantilla.recordset[0].Texto_Mensaje;

        // Considera tanto 'Pagado' (estado al cobrar turno) como 'Completado', y evita enviar si la clienta ya tiene un turno posterior o futuro agendado
        const resultTurnos = await pool.request().query(`
            SELECT c.Id_Clienta, c.Telefono, c.Nombre AS Nombre_Clienta, MAX(s.Nombre) AS Nombre_Servicio
            FROM Turno t
            INNER JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
            INNER JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
            WHERE CAST(t.Fecha_Hora AS DATE) = CAST(DATEADD(day, -15, GETDATE()) AS DATE)
            AND t.Estado IN ('Completado', 'Pagado')
            AND NOT EXISTS (
                SELECT 1 FROM Turno t2
                WHERE t2.Id_Clienta = t.Id_Clienta
                AND t2.Estado != 'Cancelado'
                AND CAST(t2.Fecha_Hora AS DATE) > CAST(DATEADD(day, -15, GETDATE()) AS DATE)
            )
            GROUP BY c.Id_Clienta, c.Telefono, c.Nombre
        `);

        const turnos15Dias = resultTurnos.recordset;
        if (turnos15Dias.length === 0) {
            return { ok: true, enviados: 0, total: 0, message: 'No hay clientas cumplidas hace 15 días pendientes de contacto hoy.' };
        }

        let enviados = 0;
        for (let turno of turnos15Dias) {
            if (turno.Telefono && String(turno.Telefono).replace(/\D/g, '').length >= 8) {
                const mensajeFinal = reemplazarVariablesPlantilla(textoBase, {
                    '{Nombre_Clienta}': turno.Nombre_Clienta,
                    '{Nombre_Servicio}': turno.Nombre_Servicio
                });
                const resEnvio = await enviarMensaje(turno.Telefono, mensajeFinal);
                if (resEnvio && resEnvio.ok) enviados++;
            }
        }

        return {
            ok: true,
            enviados,
            total: turnos15Dias.length,
            message: `Mensajes de fidelización enviados: ${enviados} de ${turnos15Dias.length} clientas.`
        };
    } catch (error) {
        console.error('Error en rutina 15 días:', error);
        return { ok: false, error: 'Error interno al procesar la rutina de 15 días.' };
    }
};

// 3. Envío de agenda del día siguiente a cada profesional
const ejecutarAvisoEmpleadas = async () => {
    console.log('Ejecutando envío de agenda a empleadas (Turnos de mañana)...');
    try {
        const estadoActual = getEstadoBot();
        if (estadoActual.estado !== 'Conectado') {
            return { ok: false, error: `El bot no está conectado (Estado: ${estadoActual.estado}).` };
        }

        let pool = await sql.connect(dbConfig);
        
        const resultPlantilla = await pool.request()
            .input('funcion', sql.VarChar, 'Aviso_Empleadas')
            .query('SELECT Texto_Mensaje FROM Plantillas_Bot WHERE Nombre_Funcion = @funcion');
        
        if (resultPlantilla.recordset.length === 0) {
            return { ok: false, error: 'No se encontró la plantilla Aviso_Empleadas en la base de datos.' };
        }
        const textoBase = resultPlantilla.recordset[0].Texto_Mensaje;

        const resultTurnos = await pool.request().query(`
            SELECT e.Id_Empleada, e.Nombre_Ap AS Nombre_Empleada, e.Telefono, c.Nombre + ' ' + ISNULL(c.Apellido, '') AS Nombre_Clienta, 
                   s.Nombre AS Nombre_Servicio, t.Fecha_Hora
            FROM Turno t
            INNER JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada 
            INNER JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
            INNER JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
            WHERE CAST(t.Fecha_Hora AS DATE) = CAST(DATEADD(day, 1, GETDATE()) AS DATE)
            AND t.Estado = 'Pendiente'
            ORDER BY e.Id_Empleada, t.Fecha_Hora
        `);

        if (resultTurnos.recordset.length === 0) {
            return { ok: true, enviados: 0, total: 0, message: 'No hay turnos pendientes para mañana para enviar a las profesionales.' };
        }

        // Agrupamos los turnos por el ID de cada empleada
        const agendaPorEmpleada = {};
        for (let row of resultTurnos.recordset) {
            const key = row.Id_Empleada;
            if (!agendaPorEmpleada[key]) {
                agendaPorEmpleada[key] = {
                    nombre: row.Nombre_Empleada,
                    telefono: row.Telefono,
                    turnos: []
                };
            }
            const hora = new Date(row.Fecha_Hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
            agendaPorEmpleada[key].turnos.push(`- ${hora} hs: ${row.Nombre_Clienta.trim()} (${row.Nombre_Servicio})`);
        }

        const totalProfesionales = Object.keys(agendaPorEmpleada).length;
        let enviados = 0;

        for (let key in agendaPorEmpleada) {
            const datos = agendaPorEmpleada[key];
            if (datos.telefono && String(datos.telefono).replace(/\D/g, '').length >= 8) {
                const listaTexto = datos.turnos.join('\n');
                const mensajeFinal = reemplazarVariablesPlantilla(textoBase, {
                    '{Nombre_Empleada}': datos.nombre,
                    '{Lista_Turnos}': listaTexto
                });

                const resEnvio = await enviarMensaje(datos.telefono, mensajeFinal);
                if (resEnvio && resEnvio.ok) enviados++;
            }
        }

        return {
            ok: true,
            enviados,
            total: totalProfesionales,
            message: `Agendas enviadas a ${enviados} de ${totalProfesionales} profesionales con turnos mañana.`
        };
    } catch (error) {
        console.error('Error enviando agenda a empleadas:', error);
        return { ok: false, error: 'Error interno al enviar la agenda a las empleadas.' };
    }
};

// Programación automática diaria con node-cron
const programarRecordatorios = () => {
    cron.schedule('0 10 * * *', () => {
        ejecutarRecordatorios24hs();
    });
};

const programarRetorno15Dias = () => {
    cron.schedule('0 11 * * *', () => {
        ejecutarRetorno15Dias();
    });
};

const programarAvisoEmpleadas = () => {
    cron.schedule('0 22 * * *', () => {
        ejecutarAvisoEmpleadas();
    });
};

// Arrancamos los motores
iniciarBot();
programarRecordatorios();
programarRetorno15Dias();
programarAvisoEmpleadas();

const server = app.listen(port, () => {
    console.log(`Servidor corriendo impecable en http://localhost:${port} `);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[ERROR CRÍTICO] El puerto ${port} ya está en uso por otro proceso.`);
        console.error(`Asegurate de cerrar cualquier otra terminal o proceso de Node que esté corriendo el servidor.\n`);
    } else {
        console.error('Error al iniciar el servidor:', err);
    }
    process.exit(1);
});