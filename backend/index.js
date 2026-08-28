const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const port = 3000;

// ==========================================================================
// ÍNDICE DEL BACKEND (API REST)
// 1. MIDDLEWARES & CONFIGURACIÓN
// 2. RUTAS: CLIENTAS
// 3. RUTAS: EMPLEADAS
// 4. RUTAS: SERVICIOS, ÁREAS & EXTRAS
// 5. RUTAS: TURNOS & AGENDA
// 6. RUTAS: GASTOS & CATEGORÍAS
// 7. RUTAS: INGRESOS & COBROS
// 8. RUTAS: DASHBOARD Y RESÚMENES
// 9. INICIO DEL SERVIDOR
// ==========================================================================


// ==========================================================================
// 1. MIDDLEWARES & CONFIGURACIÓN DE LA BASE DE DATOS
// ==========================================================================
app.use(cors());
app.use(express.json());

const dbConfig = {
    user: 'sa',
    password: 'TThmA4bmPfPUk*',
    server: 'localhost', 
    database: 'EmmE_Beauty_V2',
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

// Ruta base de testeo
app.get('/', (req, res) => {
    res.send('¡Hola! El backend de EMME Beauty está vivo ');
});


// ==========================================================================
// 2. RUTAS: CLIENTAS
// ==========================================================================

// Obtener todas las clientas (con la fecha de su último turno)
app.get('/api/clientas', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                c.Id_Clienta,
                c.Nombre,
                c.Apellido,
                c.Telefono,
                c.Ig,
                c.Fecha_Nac,
                MAX(t.Fecha_Hora) AS Fecha_Ultimo_Turno
            FROM Clienta c
            LEFT JOIN Turno t ON c.Id_Clienta = t.Id_Clienta
            GROUP BY 
                c.Id_Clienta, 
                c.Nombre, 
                c.Apellido, 
                c.Telefono, 
                c.Ig, 
                c.Fecha_Nac
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
        const { Nombre, Apellido, Fecha_Nac, Telefono, Ig } = req.body;
        let pool = await sql.connect(dbConfig);
        
        const resultado = await pool.request()
            .input('Nombre', sql.VarChar, Nombre)
            .input('Apellido', sql.VarChar, Apellido)
            .input('Fecha_Nac', sql.Date, Fecha_Nac || null)
            .input('Telefono', sql.VarChar, Telefono || null)
            .input('Ig', sql.VarChar, Ig || null)
            .query(`
                INSERT INTO Clienta (Nombre, Apellido, Fecha_Nac, Telefono, Ig)
                OUTPUT inserted.Id_Clienta
                VALUES (@Nombre, @Apellido, @Fecha_Nac, @Telefono, @Ig)
            `);
            
        res.status(201).json({ 
            mensaje: "Clienta creada con éxito",
            Id_Clienta: resultado.recordset[0].Id_Clienta 
        });
    } catch (error) {
        console.error("Error al insertar clienta:", error);
        res.status(500).send("Error interno al guardar la clienta");
    }
});

// Actualizar una clienta existente
app.put('/api/clientas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre, Apellido, Fecha_Nac, Telefono, Ig } = req.body;
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Id_Clienta', sql.Int, id)
            .input('Nombre', sql.VarChar, Nombre)
            .input('Apellido', sql.VarChar, Apellido)
            .input('Fecha_Nac', sql.Date, Fecha_Nac || null)
            .input('Telefono', sql.VarChar, Telefono || null)
            .input('Ig', sql.VarChar, Ig || null)
            .query(`
                UPDATE Clienta 
                SET Nombre = @Nombre, Apellido = @Apellido, Fecha_Nac = @Fecha_Nac, Telefono = @Telefono, Ig = @Ig
                WHERE Id_Clienta = @Id_Clienta
            `);
            
        res.status(200).send("Clienta actualizada correctamente");
    } catch (error) {
        console.error("Error al actualizar clienta:", error);
        res.status(500).send("Error interno al actualizar");
    }
});

// Obtener el historial estético de una clienta
app.get('/api/clientas/:id/historial', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        
        let result = await pool.request()
            .input('Id_Clienta', sql.Int, id)
            .query(`
                SELECT 
                    t.Fecha_Hora, 
                    s.Nombre AS Nombre_Servicio, 
                    e.Nombre_Ap,
                    t.Color
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
// 3. RUTAS: EMPLEADAS
// ==========================================================================

// Obtener todas las empleadas con su saldo acumulado, info de su última liquidación y sus áreas
app.get('/api/empleadas', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        
        let result = await pool.request().query(`
            SELECT 
                e.Id_Empleada,
                e.Nombre_Ap,
                e.DNI,
                e.Telefono,
                ISNULL(Saldo.Saldo_Acumulado, 0) AS Saldo_Acumulado,
                UltimaLiq.Fecha AS Ultima_Fecha_Liq,
                UltimaLiq.Monto_Total AS Ultimo_Monto_Liq,
                AreasInfo.Areas
            FROM Empleada e
            
            LEFT JOIN (
                SELECT 
                    t.Id_Empleada, 
                    SUM((s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) * ISNULL(ea.Porcentaje_Comision, 0.50)) AS Saldo_Acumulado
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
                SELECT TOP 1 Fecha, Monto_Total
                FROM Liquidacion_Sueldo ls
                WHERE ls.Id_Empleada = e.Id_Empleada
                ORDER BY Fecha DESC
            ) UltimaLiq

            OUTER APPLY (
                SELECT STRING_AGG(ea.Area, ',') AS Areas
                FROM Empleada_Area ea
                WHERE ea.Id_Empleada = e.Id_Empleada
            ) AreasInfo
        `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo empleadas y saldos: ", err);
        res.status(500).send("Error conectando a la base de datos");
    }
});

// Obtener empleadas habilitadas según el servicio
app.get('/api/empleadas/servicio/:idServicio', async (req, res) => {
    try {
        const { idServicio } = req.params;
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('Id_Servicio', sql.Int, idServicio)
            .query(`
                SELECT 
                    e.Id_Empleada, 
                    e.Nombre_Ap AS Nombre, 
                    '' AS Apellido 
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

// Registrar una nueva empleada
app.post('/api/empleadas', async (req, res) => {
    try {
        const { Nombre_Ap, Dni } = req.body;
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Nombre_Ap', sql.VarChar, Nombre_Ap)
            .input('Dni', sql.VarChar, Dni || null)
            .query(`INSERT INTO Empleada (Nombre_Ap, Dni) VALUES (@Nombre_Ap, @Dni)`);
            
        res.status(201).send("Empleada creada correctamente");
    } catch (error) {
        console.error("Error al insertar empleada:", error);
        res.status(500).send("Error interno al guardar la empleada");
    }
});

// Actualizar una empleada existente
app.put('/api/empleadas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre_Ap, Dni } = req.body;
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .input('Nombre_Ap', sql.VarChar, Nombre_Ap)
            .input('Dni', sql.VarChar, Dni || null)
            .query(`
                UPDATE Empleada 
                SET Nombre_Ap = @Nombre_Ap, Dni = @Dni
                WHERE Id_Empleada = @Id_Empleada
            `);
            
        res.status(200).send("Profesional actualizada correctamente");
    } catch (error) {
        console.error("Error al actualizar empleada:", error);
        res.status(500).send("Error interno al actualizar");
    }
});

// Eliminar (Dar de baja) una empleada
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

// Obtener el detalle de los turnos pendientes de cobro para una empleada
app.get('/api/empleadas/:id/sueldo-detalle', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        
        let result = await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .query(`
                SELECT 
                    t.Id_Turno,
                    t.Fecha_Hora,
                    c.Nombre + ' ' + c.Apellido AS Nombre_Clienta,
                    s.Nombre AS Nombre_Servicio,
                    (s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) AS Total_Abonado,
                    ISNULL(ea.Porcentaje_Comision, 0.50) AS Porcentaje_Comision,
                    ((s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) * ISNULL(ea.Porcentaje_Comision, 0.50)) AS A_Cobrar
                FROM Turno t
                JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                LEFT JOIN Area a ON s.Id_Area = a.Id_Area
                LEFT JOIN Empleada_Area ea ON t.Id_Empleada = ea.Id_Empleada AND a.Nombre = ea.Area
                LEFT JOIN (
                    SELECT Id_Turno, SUM(Precio) as Total_Extras
                    FROM Turno_Extra te
                    JOIN Extra ex ON te.Id_Extra = ex.Id_Extra
                    GROUP BY Id_Turno
                ) Extras ON t.Id_Turno = Extras.Id_Turno
                WHERE t.Id_Empleada = @Id_Empleada 
                  AND t.Estado = 'Pagado' 
                  AND t.Liquidado = 0
                ORDER BY t.Fecha_Hora DESC
            `);
            
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo detalle de sueldo: ", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Liquidar el sueldo pendiente de una empleada
app.post('/api/empleadas/:id/liquidar', async (req, res) => {
    const { id } = req.params;
    
    try {
        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            // 1. Calculamos cuánto hay que pagarle
            const requestCalc = new sql.Request(transaction);
            const resultCalc = await requestCalc
                .input('Id_Empleada', sql.Int, id)
                .query(`
                    SELECT 
                        ISNULL(SUM((s.Precio_Base + ISNULL(Extras.Total_Extras, 0)) * ISNULL(ea.Porcentaje_Comision, 0.50)), 0) AS Monto_A_Pagar
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
                    WHERE t.Id_Empleada = @Id_Empleada AND t.Estado = 'Pagado' AND t.Liquidado = 0
                `);
            
            const montoTotal = resultCalc.recordset[0].Monto_A_Pagar;
            
            if (montoTotal <= 0) {
                await transaction.rollback();
                return res.status(400).send("No hay saldo pendiente para liquidar.");
            }

            // 2. Guardamos el registro en el historial de liquidaciones
            const requestLiq = new sql.Request(transaction);
            await requestLiq
                .input('Id_Empleada', sql.Int, id)
                .input('Monto', sql.Decimal(12, 2), montoTotal)
                .query(`
                    INSERT INTO Liquidacion_Sueldo (Id_Empleada, Monto_Total)
                    VALUES (@Id_Empleada, @Monto)
                `);
                
            // 3. Marcamos los turnos como liquidados (simplificado)
            const requestUpdate = new sql.Request(transaction);
            await requestUpdate
                .input('Id_Empleada', sql.Int, id)
                .query(`
                    UPDATE Turno 
                    SET Liquidado = 1
                    WHERE Id_Empleada = @Id_Empleada 
                      AND Estado = 'Pagado' 
                      AND Liquidado = 0
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

// Obtener las áreas y comisiones asignadas a una empleada específica
app.get('/api/empleadas/:id/areas', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('Id_Empleada', sql.Int, id)
            .query("SELECT Area, Porcentaje_Comision FROM Empleada_Area WHERE Id_Empleada = @Id_Empleada");
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo áreas de la empleada:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Guardar la nueva configuración de áreas y comisiones
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

// Obtener el historial completo de liquidaciones (Cobros)
app.get('/api/liquidaciones', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                ls.Id_Liquidacion,
                ls.Fecha,
                ls.Monto_Total,
                e.Nombre_Ap
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


// ==========================================================================
// 4. RUTAS: SERVICIOS, ÁREAS & EXTRAS
// ==========================================================================

// ----------------------------------------------------
// A. GESTIÓN DE ÁREAS
// ----------------------------------------------------

// Obtener todas las áreas
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

// Crear una nueva área
app.post('/api/areas', async (req, res) => {
    try {
        const { Area } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Nombre', sql.VarChar, Area)
            .query(`INSERT INTO Area (Nombre) VALUES (@Nombre)`);
        res.status(201).send("Área creada");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al crear área");
    }
});

// Editar un área
app.put('/api/areas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Area } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Area', sql.Int, id)
            .input('Nombre', sql.VarChar, Area)
            .query(`UPDATE Area SET Nombre = @Nombre WHERE Id_Area = @Id_Area`);
        res.status(200).send("Área actualizada");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al actualizar área");
    }
});

// Eliminar un área
app.delete('/api/areas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Area', sql.Int, id)
            .query(`DELETE FROM Area WHERE Id_Area = @Id_Area`);
        res.status(200).send("Área eliminada");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al eliminar área");
    }
});

// ----------------------------------------------------
// B. GESTIÓN DE SERVICIOS
// ----------------------------------------------------

// Obtener todos los servicios
app.get('/api/servicios', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                s.Id_Servicio, 
                s.Nombre, 
                s.Precio_Base, 
                s.Id_Area, 
                a.Nombre AS Area
            FROM Servicio s
            LEFT JOIN Area a ON s.Id_Area = a.Id_Area
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error interno del servidor");
    }
});

// Crear un nuevo servicio
app.post('/api/servicios', async (req, res) => {
    try {
        const { Nombre, Id_Area, Precio_Base } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Nombre', sql.VarChar, Nombre)
            .input('Id_Area', sql.Int, Id_Area)
            .input('Precio_Base', sql.Decimal(10,2), Precio_Base)
            .query(`
                INSERT INTO Servicio (Nombre, Id_Area, Precio_Base, Duracion_Minutos)
                VALUES (@Nombre, @Id_Area, @Precio_Base, 30)
            `);
        res.status(201).send("Servicio creado");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al crear servicio");
    }
});

// Editar un servicio
app.put('/api/servicios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre, Id_Area, Precio_Base } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Servicio', sql.Int, id)
            .input('Nombre', sql.VarChar, Nombre)
            .input('Id_Area', sql.Int, Id_Area)
            .input('Precio_Base', sql.Decimal(10,2), Precio_Base)
            .query(`
                UPDATE Servicio 
                SET Nombre = @Nombre, Id_Area = @Id_Area, Precio_Base = @Precio_Base
                WHERE Id_Servicio = @Id_Servicio
            `);
        res.status(200).send("Servicio actualizado");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al actualizar servicio");
    }
});

// Eliminar un servicio
app.delete('/api/servicios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Servicio', sql.Int, id)
            .query(`DELETE FROM Servicio WHERE Id_Servicio = @Id_Servicio`);
        res.status(200).send("Servicio eliminado");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al eliminar servicio");
    }
});

// ----------------------------------------------------
// C. EXTRAS
// ----------------------------------------------------
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


// ==========================================================================
// 5. RUTAS: TURNOS & AGENDA
// ==========================================================================

// Obtener todos los turnos formateados para la Agenda Semanal (FullCalendar)
app.get('/api/turnos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const resultado = await pool.request().query(`
            SELECT 
                t.Id_Turno AS id,
                t.Id_Turno,
                t.Id_Empleada,
                c.Nombre + ' ' + c.Apellido + ' - ' + s.Nombre + ' (' + e.Nombre_Ap + ')' AS title,
                t.Fecha_Hora AS start,
                t.Fecha_Hora_Fin AS [end],
                c.Nombre + ' ' + c.Apellido AS Nombre_Clienta,
                s.Nombre AS Nombre_Servicio,
                s.Precio_Base AS Precio
            FROM Turno t
            JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
            JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada
            JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
        `);
        res.json(resultado.recordset);
    } catch (error) {
        console.error("Error trayendo turnos:", error);
        res.status(500).send("Error interno del servidor");
    }
});

// Obtener los turnos de una fecha específica (Agenda Diaria)
app.get('/api/turnos/fecha/:fecha', async (req, res) => {
    try {
        const { fecha } = req.params; 
        let pool = await sql.connect(dbConfig);
        
        let result = await pool.request()
            .input('FechaBuscada', sql.VarChar, fecha)
            .query(`
                SELECT 
                    t.Id_Turno, 
                    t.Fecha_Hora, 
                    c.Nombre + ' ' + c.Apellido AS Nombre_Clienta,
                    s.Nombre AS Nombre_Servicio, 
                    s.Duracion_Minutos,
                    s.Precio_Base, 
                    t.Id_Empleada,
                    e.Nombre_Ap, 
                    t.Estado,
                    t.Color,
                    t.Sena_Monto
                FROM Turno t
                JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                JOIN Empleada e ON t.Id_Empleada = e.Id_Empleada 
                WHERE CAST(t.Fecha_Hora AS DATE) = @FechaBuscada
            `);
            
        res.json(result.recordset);
    } catch (err) {
        console.error("Error trayendo turnos de la agenda: ", err);
        res.status(500).send("Error conectando a la base de datos");
    }
});

// Crear un nuevo turno (Con validación de rango de tiempo y registro de Ingreso)
app.post('/api/turnos', async (req, res) => {
    const { Id_Clienta, Id_Empleada, Id_Servicio, Fecha_Hora, Sena_Monto } = req.body;

    try {
        let pool = await sql.connect(dbConfig);

        const infoServicio = await pool.request()
            .input('Id_Servicio', sql.Int, Id_Servicio)
            .query(`SELECT Duracion_Minutos FROM Servicio WHERE Id_Servicio = @Id_Servicio`);
        
        const duracionNueva = infoServicio.recordset[0].Duracion_Minutos;

        const chequeo = await pool.request()
            .input('Id_Empleada', sql.Int, Id_Empleada)
            .input('NuevaFechaInicio', sql.DateTime, Fecha_Hora)
            .input('DuracionNueva', sql.Int, duracionNueva)
            .query(`
                SELECT t.Id_Turno 
                FROM Turno t
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                WHERE t.Id_Empleada = @Id_Empleada
                AND (
                    @NuevaFechaInicio < DATEADD(MINUTE, s.Duracion_Minutos, t.Fecha_Hora)
                    AND DATEADD(MINUTE, @DuracionNueva, @NuevaFechaInicio) > t.Fecha_Hora
                )
            `);

        if (chequeo.recordset.length > 0) {
            return res.status(400).send("La profesional ya tiene un turno que se superpone en ese horario.");
        }

        await pool.request()
            .input('Id_Clienta', sql.Int, Id_Clienta)
            .input('Id_Empleada', sql.Int, Id_Empleada)
            .input('Id_Servicio', sql.Int, Id_Servicio)
            .input('Fecha_Hora', sql.DateTime, Fecha_Hora)
            .input('Sena_Monto', sql.Decimal(10,2), Sena_Monto || 0)
            .query(`
                INSERT INTO Turno (Id_Clienta, Id_Empleada, Id_Servicio, Fecha_Hora, Sena_Monto) 
                VALUES (@Id_Clienta, @Id_Empleada, @Id_Servicio, @Fecha_Hora, @Sena_Monto);

                IF (@Sena_Monto > 0)
                BEGIN
                    DECLARE @NombreC VARCHAR(100);
                    SELECT @NombreC = Nombre + ' ' + Apellido FROM Clienta WHERE Id_Clienta = @Id_Clienta;
                    
                    INSERT INTO Ingreso (Concepto, Monto_Total, Fecha, Medio_Pago) 
                    VALUES ('Seña abonada - ' + @NombreC, @Sena_Monto, GETDATE(), 'Transferencia');
                END
            `);
        
        res.status(201).json({ message: "¡Turno creado exitosamente!" });
    } catch (err) {
        console.error("Error al crear turno:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Actualizar detalles del turno durante la sesión
app.put('/api/turnos/:id/detalles', async (req, res) => {
    try {
        const { id } = req.params;
        const { Color } = req.body; 
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Id_Turno', sql.Int, id)
            .input('NuevoColor', sql.VarChar, Color)
            .query(`
                UPDATE Turno 
                SET Color = CASE 
                                WHEN Color IS NULL OR Color = '' THEN @NuevoColor 
                                ELSE Color + ' | ' + @NuevoColor 
                            END,
                    Estado = CASE WHEN Estado = 'Pendiente' THEN 'En progreso' ELSE Estado END
                WHERE Id_Turno = @Id_Turno AND Estado != 'Pagado'
            `);
            
        res.status(200).send("Color agregado a la sesión.");
    } catch (error) {
        console.error("Error al guardar detalles:", error);
        res.status(500).send("Error interno al actualizar el turno");
    }
});

// ACTUALIZAR SEÑA DE UN TURNO
app.put('/api/turnos/:id/sena', async (req, res) => {
    const { id } = req.params;
    const { Sena_Monto, Nombre_Clienta } = req.body; 
    
    try {
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Id', sql.Int, id)
            .input('Monto', sql.Decimal(10,2), Sena_Monto)
            .query('UPDATE Turno SET Sena_Monto = @Monto WHERE Id_Turno = @Id'); 
            
        if (Sena_Monto > 0) {
            await pool.request()
                .input('Concepto', sql.VarChar, `Seña abonada - ${Nombre_Clienta}`)
                .input('Monto', sql.Decimal(10,2), Sena_Monto)
                .input('Medio', sql.VarChar, 'Transferencia') 
                .query(`INSERT INTO Ingreso (Concepto, Monto_Total, Fecha, Medio_Pago) 
                        VALUES (@Concepto, @Monto, GETDATE(), @Medio)`);
        }
        
        res.json({ message: "Seña guardada e ingreso registrado" });
    } catch (err) {
        console.error("Error al actualizar seña:", err);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// ==========================================================================
// 6. RUTAS: GASTOS & CATEGORÍAS
// ==========================================================================

// Obtener categorías de gastos
app.get('/api/categorias-gastos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT * FROM Categoria_Gasto ORDER BY Nombre");
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo categorías de gastos:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Crear nueva categoría de gasto
app.post('/api/categorias-gastos', async (req, res) => {
    try {
        const { Nombre } = req.body;
        if (!Nombre) return res.status(400).send("El nombre es obligatorio");

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Nombre', sql.VarChar, Nombre)
            .query(`INSERT INTO Categoria_Gasto (Nombre) VALUES (@Nombre)`);
            
        res.status(201).json({ message: "¡Categoría creada exitosamente!" });
    } catch (err) {
        console.error("Error creando categoría:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Editar categoría de gasto
app.put('/api/categorias-gastos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Nombre } = req.body;
        if (!Nombre) return res.status(400).send("El nombre es obligatorio");

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Categoria', sql.Int, id)
            .input('Nombre', sql.VarChar, Nombre)
            .query(`UPDATE Categoria_Gasto SET Nombre = @Nombre WHERE Id_Categoria = @Id_Categoria`);
            
        res.status(200).json({ message: "Categoría actualizada exitosamente" });
    } catch (err) {
        console.error("Error actualizando categoría:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Eliminar categoría de gasto
app.delete('/api/categorias-gastos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id_Categoria', sql.Int, id)
            .query(`DELETE FROM Categoria_Gasto WHERE Id_Categoria = @Id_Categoria`);
            
        res.status(200).json({ message: "Categoría eliminada con éxito" });
    } catch (err) {
        console.error("Error eliminando categoría:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Obtener todos los gastos
app.get('/api/gastos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                g.Id_Gasto, 
                g.Fecha, 
                g.Descripcion, 
                g.Monto, 
                c.Nombre AS Nombre_Categoria
            FROM Gasto g
            LEFT JOIN Categoria_Gasto c ON g.Id_Categoria = c.Id_Categoria
            ORDER BY g.Fecha DESC, g.Id_Gasto DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo gastos:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Registrar un nuevo gasto
app.post('/api/gastos', async (req, res) => {
    try {
        const { Fecha, Descripcion, Monto, Id_Categoria } = req.body;
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Fecha', sql.Date, Fecha)
            .input('Descripcion', sql.VarChar, Descripcion)
            .input('Monto', sql.Decimal(12, 2), Monto)
            .input('Id_Categoria', sql.Int, Id_Categoria || null)
            .query(`
                INSERT INTO Gasto (Fecha, Descripcion, Monto, Id_Categoria)
                VALUES (@Fecha, @Descripcion, @Monto, @Id_Categoria)
            `);
            
        res.status(201).send("Gasto registrado correctamente");
    } catch (error) {
        console.error("Error al registrar gasto:", error);
        res.status(500).send("Error interno al guardar el gasto");
    }
});

// Eliminar un gasto
app.delete('/api/gastos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('Id_Gasto', sql.Int, id)
            .query(`DELETE FROM Gasto WHERE Id_Gasto = @Id_Gasto`);

        if (result.rowsAffected[0] > 0) {
            res.status(200).json({ message: "Gasto eliminado con éxito" });
        } else {
            res.status(404).send("Gasto no encontrado");
        }
    } catch (err) {
        console.error("Error al eliminar el gasto:", err);
        res.status(500).send("Error interno del servidor al intentar eliminar");
    }
});


// ==========================================================================
// 7. RUTAS: INGRESOS & COBROS
// ==========================================================================

// Obtener todos los ingresos
app.get('/api/ingresos', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT 
                i.Id_Ingreso, 
                i.Fecha, 
                i.Monto_Total, 
                i.Medio_Pago,
                i.Concepto, 
                c.Nombre + ' ' + c.Apellido AS Nombre_Clienta,
                s.Nombre AS Nombre_Servicio
            FROM Ingreso i
            LEFT JOIN Turno t ON i.Id_Turno = t.Id_Turno
            LEFT JOIN Clienta c ON t.Id_Clienta = c.Id_Clienta
            LEFT JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
            ORDER BY i.Fecha DESC, i.Id_Ingreso DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo ingresos:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Registrar un ingreso manual 
app.post('/api/ingresos/manual', async (req, res) => {
    try {
        const { Concepto, Monto_Total, Medio_Pago } = req.body;
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('Concepto', sql.VarChar, Concepto)
            .input('Monto_Total', sql.Decimal(10,2), Monto_Total)
            .input('Medio_Pago', sql.VarChar, Medio_Pago)
            .query(`
                INSERT INTO Ingreso (Fecha, Monto_Total, Medio_Pago, Descuento_Aplicado, Concepto)
                VALUES (GETDATE(), @Monto_Total, @Medio_Pago, 0, @Concepto)
            `);
            
        res.status(201).json({ message: "Ingreso manual registrado" });
    } catch (err) {
        console.error("Error al registrar ingreso manual:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Cobrar un turno completo 
app.post('/api/cobrar-turno', async (req, res) => {
    try {
        const { idTurno, montoTotal, medioPago, descuento, extras } = req.body;
        let pool = await sql.connect(dbConfig);
        
        // 1. Magia Nueva: Ahora no solo traemos el Estado, sino también el Nombre del Servicio
        const chequeo = await pool.request()
            .input('Id_Turno', sql.Int, idTurno)
            .query(`
                SELECT t.Estado, s.Nombre AS NombreServicio 
                FROM Turno t
                JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
                WHERE t.Id_Turno = @Id_Turno
            `);
        
        if (chequeo.recordset.length === 0) return res.status(404).send("Turno no encontrado");
        if (chequeo.recordset[0].Estado === 'Pagado') {
            return res.status(400).send("¡Ojo! Este turno ya fue cobrado.");
        }

        // 2. Armamos el texto exacto que queremos que aparezca en la tabla de Ingresos
        const nombreDelServicio = chequeo.recordset[0].NombreServicio;
        const conceptoDinamico = `Turno: ${nombreDelServicio}`;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            const requestIngreso = new sql.Request(transaction);
            await requestIngreso
                .input('Id_Turno', sql.Int, idTurno)
                .input('Concepto', sql.VarChar, conceptoDinamico) // <-- Acá mandamos el nombre real
                .input('Monto_Total', sql.Decimal(12, 2), montoTotal)
                .input('Medio_Pago', sql.VarChar, medioPago)
                .input('Descuento', sql.Decimal(12, 2), descuento)
                .query(`
                    INSERT INTO Ingreso (Id_Turno, Fecha, Concepto, Monto_Total, Medio_Pago, Descuento)
                    VALUES (@Id_Turno, GETDATE(), @Concepto, @Monto_Total, @Medio_Pago, @Descuento)
                `);
            
            if (extras && extras.length > 0) {
                for (let idExtra of extras) {
                    const requestExtra = new sql.Request(transaction);
                    await requestExtra
                        .input('Id_Turno', sql.Int, idTurno)
                        .input('Id_Extra', sql.Int, idExtra)
                        .query(`INSERT INTO Turno_Extra (Id_Turno, Id_Extra) VALUES (@Id_Turno, @Id_Extra)`);
                }
            }
            
            const requestEstado = new sql.Request(transaction);
            await requestEstado
                .input('Id_Turno', sql.Int, idTurno)
                .query(`UPDATE Turno SET Estado = 'Pagado' WHERE Id_Turno = @Id_Turno`);
            
            await transaction.commit();
            res.status(200).json({ message: "¡Cobro registrado exitosamente!" });
            
        } catch (err) {
            await transaction.rollback();
            throw err; 
        }
    } catch (err) {
        console.error("Error al registrar el cobro:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// ==========================================================================
// 7.5. RUTAS: HORARIOS DE ATENCIÓN
// ==========================================================================

// Obtener la configuración semanal
app.get('/api/horarios', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        // Ordenamos por ID para que siempre salga de Lunes a Domingo
        let result = await pool.request().query("SELECT * FROM Horario_Atencion ORDER BY Id_Horario");
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo horarios:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// Actualizar múltiples días en lote (Bulk Edit)
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
                    .input('Apertura1', sql.Time, Hora_Apertura_1 || null)
                    .input('Cierre1', sql.Time, Hora_Cierre_1 || null)
                    .input('Apertura2', sql.Time, Hora_Apertura_2 || null)
                    .input('Cierre2', sql.Time, Hora_Cierre_2 || null)
                    .query(`
                        UPDATE Horario_Atencion 
                        SET Laborable = @Laborable, 
                            Hora_Apertura_1 = @Apertura1, Hora_Cierre_1 = @Cierre1, 
                            Hora_Apertura_2 = @Apertura2, Hora_Cierre_2 = @Cierre2
                        WHERE Id_Horario = @Id
                    `);
            }
            await transaction.commit();
            res.status(200).send("Horarios actualizados exitosamente");
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error actualizando horarios:", err);
        res.status(500).send("Error interno del servidor");
    }
});

// ==========================================================================
// 8. RUTAS: DASHBOARD Y RESÚMENES
// ==========================================================================
app.get('/api/dashboard/kpis', async (req, res) => {
    const { desde, hasta } = req.query;
    try {
        let pool = await sql.connect(dbConfig);

        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';

        const query = `
            DECLARE @TotalIngresos DECIMAL(12,2) = (
                SELECT ISNULL(SUM(Monto_Total), 0) FROM Ingreso
                WHERE Fecha >= @Desde AND Fecha <= @Hasta
            );

            DECLARE @TotalGastos DECIMAL(12,2) = (
                SELECT ISNULL(SUM(Monto), 0) FROM Gasto
                WHERE Fecha >= @Desde AND Fecha <= @Hasta
            );

            DECLARE @TotalSueldos DECIMAL(12,2) = (
                SELECT ISNULL(SUM(Monto_Total), 0) FROM Liquidacion_Sueldo
                WHERE Fecha >= @Desde AND Fecha <= @Hasta
            );

            SELECT 
                @TotalIngresos AS Ingresos,
                @TotalGastos AS Gastos,
                @TotalSueldos AS Sueldos,
                (@TotalIngresos - @TotalGastos - @TotalSueldos) AS GananciaNeta;
        `;

        let result = await pool.request()
            .input('Desde', sql.DateTime, fechaDesde)
            .input('Hasta', sql.DateTime, fechaHasta)
            .query(query);

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error cargando KPIs del dashboard:", err);
        res.status(500).send("Error interno del servidor");
    }
});

app.get('/api/dashboard/grafico-ingresos', async (req, res) => {
    const { desde, hasta } = req.query;
    try {
        let pool = await sql.connect(dbConfig);

        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';

        const query = `
            WITH IngresosDiarios AS (
                SELECT CAST(Fecha AS DATE) as FechaDia, SUM(Monto_Total) as Total
                FROM Ingreso
                WHERE Fecha >= @Desde AND Fecha <= @Hasta
                GROUP BY CAST(Fecha AS DATE)
            ),
            TurnosDiarios AS (
                SELECT CAST(Fecha_Hora AS DATE) as FechaDia, COUNT(Id_Turno) as Cantidad
                FROM Turno
                WHERE Fecha_Hora >= @Desde AND Fecha_Hora <= @Hasta
                GROUP BY CAST(Fecha_Hora AS DATE)
            )
            SELECT 
                CONVERT(VARCHAR(5), ISNULL(i.FechaDia, t.FechaDia), 103) as Dia,
                CONVERT(VARCHAR(10), ISNULL(i.FechaDia, t.FechaDia), 23) as FechaCompleta, 
                ISNULL(i.Total, 0) as Total,
                ISNULL(t.Cantidad, 0) as Turnos
            FROM IngresosDiarios i
            FULL OUTER JOIN TurnosDiarios t ON i.FechaDia = t.FechaDia
            ORDER BY ISNULL(i.FechaDia, t.FechaDia) ASC
        `;

        let result = await pool.request()
            .input('Desde', sql.DateTime, fechaDesde)
            .input('Hasta', sql.DateTime, fechaHasta)
            .query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error cargando datos del gráfico:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.get('/api/dashboard/servicios-estrella', async (req, res) => {
    const { desde, hasta } = req.query;
    try {
        let pool = await sql.connect(dbConfig);

        const fechaDesde = desde ? `${desde} 00:00:00` : '2000-01-01 00:00:00';
        const fechaHasta = hasta ? `${hasta} 23:59:59` : '2099-12-31 23:59:59';

        const query = `
            SELECT TOP 5 
                s.Nombre, 
                COUNT(t.Id_Turno) as Cantidad
            FROM Turno t
            JOIN Servicio s ON t.Id_Servicio = s.Id_Servicio
            WHERE t.Fecha_Hora >= @Desde AND t.Fecha_Hora <= @Hasta
            GROUP BY s.Nombre
            ORDER BY Cantidad DESC
        `;

        let result = await pool.request()
            .input('Desde', sql.DateTime, fechaDesde)
            .input('Hasta', sql.DateTime, fechaHasta)
            .query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error cargando servicios estrella:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// ==========================================================================
// 9. INICIO DEL SERVIDOR
// ==========================================================================

app.listen(port, () => {
    console.log(`Servidor corriendo impecable en http://localhost:${port} `);
});