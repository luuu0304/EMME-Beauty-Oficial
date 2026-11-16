-- =======================================================================
-- MIGRACIÓN 06: AJUSTE MANUAL DE COMISIONES EN TURNOS PENDIENTES
-- Permite a gerencia ajustar la comisión de un turno por excepciones
-- =======================================================================

USE EmmE_Beauty_V2;
GO

IF COL_LENGTH('Turno', 'Comision_Ajustada') IS NULL
BEGIN
    ALTER TABLE Turno ADD Comision_Ajustada DECIMAL(10,2) NULL;
END
GO

IF COL_LENGTH('Turno', 'Motivo_Ajuste_Comision') IS NULL
BEGIN
    ALTER TABLE Turno ADD Motivo_Ajuste_Comision VARCHAR(255) NULL;
END
GO
