-- =======================================================================
-- SISTEMA EMME BEAUTY V2 - TARJETA DE FIDELIDAD (10 SELLOS MENSUALES)
-- =======================================================================

USE EmmE_Beauty_V2;
GO

IF OBJECT_ID('Sello_Fidelidad', 'U') IS NULL
BEGIN
    CREATE TABLE Sello_Fidelidad (
        Id_Sello INT IDENTITY(1,1) PRIMARY KEY,
        Id_Clienta INT NOT NULL FOREIGN KEY REFERENCES Clienta(Id_Clienta) ON DELETE CASCADE,
        Fecha_Sello DATE NOT NULL,
        Numero_Slot INT NOT NULL CHECK (Numero_Slot BETWEEN 1 AND 10),
        Activo BIT NOT NULL DEFAULT 1 -- 1 = tarjeta en curso, 0 = historial de tarjetas completadas o reiniciadas
    );

    CREATE INDEX IX_Sello_Fidelidad_Clienta_Activo
        ON Sello_Fidelidad (Id_Clienta, Activo, Numero_Slot);
END
GO
