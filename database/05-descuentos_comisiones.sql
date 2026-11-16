-- =======================================================================
-- MIGRACIÓN 05: CONTROL DE DESCUENTOS Y AFECTACIÓN DE COMISIONES
-- Caso 1: Tarjetas de fidelidad / cortesía (No afecta comisión de empleada)
-- Caso 2: Promociones especiales (Afecta comisión de empleada)
-- =======================================================================

USE EmmE_Beauty_V2;
GO

IF COL_LENGTH('Turno', 'Descuento') IS NULL
BEGIN
    ALTER TABLE Turno ADD Descuento DECIMAL(10,2) NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('Turno', 'Tipo_Descuento') IS NULL
BEGIN
    ALTER TABLE Turno ADD Tipo_Descuento VARCHAR(20) NOT NULL DEFAULT 'Ninguno';
END
GO

IF COL_LENGTH('Turno', 'Descuento_Afecta_Comision') IS NULL
BEGIN
    ALTER TABLE Turno ADD Descuento_Afecta_Comision BIT NOT NULL DEFAULT 0;
END
GO
