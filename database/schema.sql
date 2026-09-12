-- =======================================================================
-- SISTEMA EMME BEAUTY V2 - SCRIPT DE BASE DE DATOS
-- =======================================================================

-- =======================================================================
-- BLOQUE 1: INICIALIZACIÓN DE LA BASE DE DATOS
-- =======================================================================
--CREATE DATABASE EmmE_Beauty_V2;
--GO

USE EmmE_Beauty_V2;
GO

-- 1.1 Vaciamos las tablas para arrancar de cero sin conflictos (Comentado para seguridad)
-- DELETE FROM Turno_Extra;
-- DELETE FROM Turno;
-- DELETE FROM Ingreso;
-- DELETE FROM Gasto;
-- DELETE FROM Liquidacion_Sueldo;
-- DELETE FROM Empleada_Area;
-- DELETE FROM Servicio;
-- DELETE FROM Clienta;
-- DELETE FROM Empleada;

-- 1.2 Reiniciamos los contadores de ID para que arranquen en 1 de nuevo
-- DBCC CHECKIDENT ('Empleada', RESEED, 0);
-- DBCC CHECKIDENT ('Clienta', RESEED, 0);
-- DBCC CHECKIDENT ('Servicio', RESEED, 0);
-- GO


-- =======================================================================
-- BLOQUE 2: TABLAS PRINCIPALES (Entidades independientes)
-- =======================================================================

CREATE TABLE Clienta (
    Id_Clienta INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL,
    Apellido VARCHAR(50) NOT NULL,
    Fecha_Nac DATE NULL,
    Telefono VARCHAR(20) NULL,
    Observacion VARCHAR(50) NULL 
);

CREATE TABLE Empleada (
    Id_Empleada INT IDENTITY(1,1) PRIMARY KEY,
    Nombre_Ap VARCHAR(100) NOT NULL,
    DNI VARCHAR(15) UNIQUE NOT NULL,
    Telefono VARCHAR(20) NULL,
    Saldo_Acumulado DECIMAL(10,2) DEFAULT 0,
    Ultima_Fecha_Liq DATETIME NULL,
    Ultimo_Monto_Liq DECIMAL(10,2) NULL
);

CREATE TABLE Servicio (
    Id_Servicio INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Area VARCHAR(50) NOT NULL,
    Precio_Base DECIMAL(10,2) NOT NULL,
    Duracion_Minutos INT NOT NULL DEFAULT 30
);

CREATE TABLE Extra (
    Id_Extra INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Precio DECIMAL(10,2) NOT NULL
);

CREATE TABLE Categoria_Gasto (
    Id_Categoria INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL
);


-- =======================================================================
-- BLOQUE 3: TABLAS DEPENDIENTES (Relacionadas con las principales)
-- =======================================================================

CREATE TABLE Empleada_Area (
    Id_Empleada INT FOREIGN KEY REFERENCES Empleada(Id_Empleada) ON DELETE CASCADE,
    Area VARCHAR(50) NOT NULL,
    Porcentaje_Comision DECIMAL(3,2) DEFAULT 0.50,
    PRIMARY KEY (Id_Empleada, Area)
);

CREATE TABLE Turno (
    Id_Turno INT IDENTITY(1,1) PRIMARY KEY,
    Id_Clienta INT FOREIGN KEY REFERENCES Clienta(Id_Clienta) ON DELETE CASCADE,
    Id_Empleada INT FOREIGN KEY REFERENCES Empleada(Id_Empleada),
    Id_Servicio INT FOREIGN KEY REFERENCES Servicio(Id_Servicio),
    Fecha_Hora DATETIME NOT NULL,
    Fecha_Hora_Fin DATETIME NULL,
    Sena_Monto DECIMAL(10,2) DEFAULT 0,
    Estado VARCHAR(20) DEFAULT 'Pendiente',
    Color VARCHAR(100) NULL,
    Liquidado BIT DEFAULT 0,
    recordatorio_enviado BIT DEFAULT 0
);

CREATE TABLE Turno_Extra (
    Id_Turno INT FOREIGN KEY REFERENCES Turno(Id_Turno) ON DELETE CASCADE,
    Id_Extra INT FOREIGN KEY REFERENCES Extra(Id_Extra),
    Precio_Cobrado DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (Id_Turno, Id_Extra)
);

CREATE TABLE Ingreso (
    Id_Ingreso INT IDENTITY(1,1) PRIMARY KEY,
    Fecha DATETIME DEFAULT GETDATE(),
    Concepto VARCHAR(200) NOT NULL,
    Monto_Total DECIMAL(10,2) NOT NULL,
    Medio_Pago VARCHAR(50) NOT NULL,
    Id_Turno INT NULL FOREIGN KEY REFERENCES Turno(Id_Turno)
);

-- CREATE TABLE Gasto (
   -- Id_Gasto INT IDENTITY(1,1) PRIMARY KEY,
    -- Fecha DATE NOT NULL,
    -- Descripcion VARCHAR(200) NOT NULL,
    -- Monto DECIMAL(10,2) NOT NULL,
    -- Id_Categoria INT NULL FOREIGN KEY REFERENCES Categoria_Gasto(Id_Categoria)
-- );

-- CREATE TABLE Liquidacion_Sueldo (
    -- Id_Liquidacion INT IDENTITY(1,1) PRIMARY KEY,
    -- Id_Empleada INT FOREIGN KEY REFERENCES Empleada(Id_Empleada),
    -- Fecha DATETIME DEFAULT GETDATE(),
    -- Monto_Total DECIMAL(10,2) NOT NULL,
    -- Detalle_JSON NVARCHAR(MAX) NULL
-- );
-- GO

CREATE TABLE Usuario (
    Id_Usuario INT IDENTITY(1,1) PRIMARY KEY,
    Username VARCHAR(50) UNIQUE NOT NULL, -- Puede ser 'mili_admin' o el DNI de la empleada
    Password_Hash VARCHAR(255) NOT NULL,  -- Acá va el garabato encriptado
    Rol VARCHAR(20) NOT NULL CHECK (Rol IN ('Admin', 'Empleada')), -- Restringimos los tipos
    Id_Empleada INT NULL FOREIGN KEY REFERENCES Empleada(Id_Empleada) -- Si es Admin, esto queda en NULL
);


-- =======================================================================
-- BLOQUE 4: MIGRACIONES Y ACTUALIZACIONES
-- (Scripts que ejecutaste posteriormente para mejorar la base de datos)
-- =======================================================================

-- 4.1 Normalización de la tabla "Area" 
-- -- 1. Creamos la tabla maestra Area
-- CREATE TABLE Area (
--    Id_Area INT IDENTITY(1,1) PRIMARY KEY,
--    Nombre VARCHAR(50) NOT NULL
-- );

-- -- 2. Insertamos las áreas únicas que ya existen en tu tabla Servicio
-- INSERT INTO Area (Nombre)
-- SELECT DISTINCT Area FROM Servicio WHERE Area IS NOT NULL AND Area != '';

-- -- 3. Agregamos la nueva columna Id_Area a la tabla Servicio
-- ALTER TABLE Servicio ADD Id_Area INT;

-- -- 4. Actualizamos cada servicio vinculándolo con su nueva ID de Área
-- UPDATE s
-- SET s.Id_Area = a.Id_Area
-- FROM Servicio s
-- JOIN Area a ON s.Area = a.Nombre;

-- -- 5. Eliminamos la vieja columna de texto
-- ALTER TABLE Servicio DROP COLUMN Area;

-- -- 6. Establecemos la relación de llave foránea (Foreign Key)
-- ALTER TABLE Servicio
-- ADD CONSTRAINT FK_Servicio_Area FOREIGN KEY (Id_Area) REFERENCES Area(Id_Area);

-- SELECT * FROM Area;


-- 4.2 Horarios de Atención del Local
-- CREATE TABLE Horario_Atencion (
--    Id_Horario INT IDENTITY(1,1) PRIMARY KEY,
--    Dia_Semana VARCHAR(15) NOT NULL,
--    Hora_Apertura_1 TIME NULL,
--    Hora_Cierre_1 TIME NULL,
--    Hora_Apertura_2 TIME NULL,
--    Hora_Cierre_2 TIME NULL,
--    Laborable BIT DEFAULT 1
-- );

-- -- Insertamos los días por defecto con el corte al mediodía
-- INSERT INTO Horario_Atencion (Dia_Semana, Hora_Apertura_1, Hora_Cierre_1, Hora_Apertura_2, Hora_Cierre_2, Laborable) VALUES
-- ('Lunes', '09:30', '15:00', '18:00', '21:30', 1),
-- ('Martes', '09:30', '15:00', '18:00', '21:30', 1),
-- ('Miércoles', '09:30', '15:00', '18:00', '21:30', 1),
-- ('Jueves', '09:30', '15:00', '18:00', '21:30', 1),
-- ('Viernes', '09:30', '15:00', '18:00', '21:30', 1),
-- ('Sábado', '09:30', '15:00', '18:00', '21:30', 1),
-- ('Domingo', '00:00', '00:00', '00:00', '00:00', 0);


-- 4.3 Medios de Pago
-- -- 1. Creamos la tabla
-- CREATE TABLE Medio_Pago (
    -- Id_Medio_Pago INT IDENTITY(1,1) PRIMARY KEY,
    -- Nombre VARCHAR(50) NOT NULL,
    -- Activo BIT DEFAULT 1 -- Para que el día de mañana puedas "apagar" un medio de pago sin borrar el historial
-- );

-- -- 2. Insertamos los valores por defecto que ya usás
-- INSERT INTO Medio_Pago (Nombre) VALUES 
-- ('Efectivo'), 
-- ('Transferencia');


-- 4.4 Modificaciones de columnas en tablas existentes (ALTER TABLES)
-- Nota: "Observacion" ya figura creada en tu tabla original arriba.
-- EXEC sp_rename 'Clienta.Ig', 'Observacion', 'COLUMN';

-- ALTER TABLE Ingreso ADD Descuento DECIMAL(10,2) DEFAULT 0;
-- ALTER TABLE Turno ADD Comentario_Admin VARCHAR(500) NULL;
-- ALTER TABLE Turno ADD Comentario_Empleada VARCHAR(500) NULL;
ALTER TABLE Turno ADD Id_Liquidacion INT NULL;


-- =======================================================================
-- BLOQUE 5: INSERCIÓN DE DATOS INICIALES (Semillas / Seeding)
-- =======================================================================

-- -- 5.1 CARGA DE STAFF (Tus chicas oficiales)
-- INSERT INTO Empleada (Nombre_Ap, DNI) VALUES
-- ('Luciana', '11111111'),
-- ('Agustina', '22222222'),
-- ('Sandra', '33333333'),
-- ('Vani', '44444444'),
-- ('Anto', '55555555'),
-- ('Leyla', '66666666'),
-- ('Sil', '77777777'),
-- ('María Pia', '88888888');

-- -- 5.2 CARGA DE CLIENTAS FRECUENTES
-- INSERT INTO Clienta (Nombre, Apellido, Telefono, Fecha_Nac) VALUES
-- ('Monica', 'Cohen', '3874761251', '2026-05-04'),
-- ('Lulu', 'Cabrera', '3816073357', NULL),
-- ('Sofia', 'Causarano', NULL, NULL),
-- ('Miriam', 'Chacon', '3873524164', '2026-07-28'),
-- ('Maria del Mar', 'Cabrera', '3875807377', '2026-05-22'),
-- ('Sofi', 'Cespedes', '3875068176', NULL),
-- ('Tefi', 'Castillo', '3876296914', '2026-06-06'),
-- ('Anto', 'Cartaman', '387', '2026-05-05'),
-- ('Clau', 'Cansinos', '387401838', '2026-06-08'),
-- ('Carla', 'Cuellar', '3877546676', '2026-10-27'),
-- ('Fernanda ', 'Correa', '3874560501', '2026-02-02'),
-- ('Guadalupe', 'Carrizo', '387', '2026-04-17'),
-- ('Angelina', 'Castillo', '3874063431', '2026-01-27'),
-- ('Agustina', 'Casanova', '3875129666', NULL),
-- ('Camila', 'Cajade', '2215987424', '2026-09-22'),
-- ('Lupe', 'Carrizo', '3875200025', '2026-06-25'),
-- ('Marta', 'D aluisi', NULL, NULL),
-- ('Karina', 'De los Angeles', '3874563081', '2026-01-17'),
-- ('Sol', 'Ferrari', NULL, NULL),
-- ('Bernarda', 'Fuentes', NULL, NULL),
-- ('Canela', 'Falco', NULL, '2026-02-09'),
-- ('Yami', 'Felipe', '3815126798', '2026-06-22'),
-- ('Noemi', 'Filomarino', '3876100920', '2026-11-18'),
-- ('Josefina', 'Feres', NULL, '2026-09-02'),
-- ('Mariana', 'Huertas', '3885234571', '2026-12-26');

-- -- 5.3 CARGA DE SERVICIOS
-- INSERT INTO Servicio (Nombre, Area, Precio_Base, Duracion_Minutos) VALUES
-- ('Semi Permanente Manos', 'Manicura', 23000, 90),
-- ('Kapping Base', 'Manicura', 25000, 90),
-- ('Kapping Gel', 'Manicura', 27000, 90),
-- ('Soft', 'Manicura', 30000, 90),
-- ('Esculpidas', 'Manicura', 32000, 90),
-- ('Esmaltado Tradicional Manos', 'Manicura', 20000, 90),
-- ('Belleza de Manos', 'Manicura', 18000, 90),
-- ('Belleza de Pies', 'Pedicura', 19000, 90),
-- ('Esmaltado Tradicional Pies', 'Pedicura', 21000, 90),
-- ('Semi Permanente Pies', 'Pedicura', 26000, 90),
-- ('Podoestética sin Esmaltado', 'Pedicura', 5000, 90),
-- ('Podo estética con Tradicional', 'Pedicura', 31000, 90),
-- ('Podo estética con Semi', 'Pedicura', 36000, 90),
-- ('Spa Jelly', 'Pedicura', 5000, 90),
-- ('Lifting + Nutri', 'Cejas y Pestañas', 28000, 90),
-- ('Lifting + Nutri + Tinte', 'Cejas y Pestañas', 31000, 90),
-- ('Perfilado de cejas', 'Cejas y Pestañas', 20000, 90),
-- ('Laminado de cejas', 'Cejas y Pestañas', 23000, 90),
-- ('Pestañas pelo por pelo', 'Cejas y Pestañas', 28000, 90);
-- GO

-- -- 5.4 CARGA DE EXTRAS
-- INSERT INTO Extra (Nombre, Precio) VALUES
-- ('Francesitas', 3000),
-- ('Cat Eye', 3000),
-- ('Polvos', 3000),
-- ('Baby Boomer', 3000),
-- ('Full Diseño', 3000),
-- ('Retiro de otro salon', 3000);


-- =======================================================================
-- BLOQUE 6: CONSULTAS DE PRUEBA
-- =======================================================================

SELECT * FROM Empleada
    WHERE Id_Empleada = 2;