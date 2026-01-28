-- ============================================
-- MIGRACIÓN: Eliminar columnas fecha_ultimo_mov y saldo_ultimo_mov
-- y crear vista que las calcula dinámicamente
-- ============================================
-- 
-- INSTRUCCIONES:
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. La vista v_cuenta_ultimo_movimiento aparecerá en el panel de Supabase
-- 3. Las columnas fecha_ultimo_mov y saldo_ultimo_mov se eliminarán de la tabla cuenta
--
-- ============================================

-- Vista que calcula dinámicamente fecha y saldo del último movimiento por cuenta
-- Usa subconsultas correlacionadas para mejor rendimiento
DROP VIEW IF EXISTS v_cuenta_ultimo_movimiento;

CREATE OR REPLACE VIEW v_cuenta_ultimo_movimiento AS
SELECT 
    c.id_cuenta,
    c.id_empresa,
    c.id_banco_pais_divisa,
    c.id_tipo_cuenta,
    c.numero_cuenta,
    c.nombre_sheet_origen,
    c.id_journal_odoo,
    c.activo,
    -- Fecha del último movimiento
    (
        SELECT MAX(fecha_mov)
        FROM movimiento
        WHERE id_cuenta = c.id_cuenta
    ) AS fecha_ultimo_mov,
    -- Saldo acumulado hasta el último movimiento (suma de créditos - débitos)
    -- El saldo se calcula sumando todos los créditos y restando todos los débitos
    COALESCE(
        (
            SELECT SUM(COALESCE(credito, 0)) - SUM(COALESCE(debito, 0))
            FROM movimiento
            WHERE id_cuenta = c.id_cuenta
        ),
        0
    ) AS saldo_ultimo_mov
FROM cuenta c
WHERE c.activo = true;

-- Eliminar las columnas de la tabla cuenta
-- Primero verificar si existen antes de eliminarlas
DO $$ 
BEGIN
    -- Eliminar fecha_ultimo_mov si existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cuenta' 
        AND column_name = 'fecha_ultimo_mov'
    ) THEN
        ALTER TABLE cuenta DROP COLUMN fecha_ultimo_mov;
        RAISE NOTICE 'Columna fecha_ultimo_mov eliminada';
    ELSE
        RAISE NOTICE 'Columna fecha_ultimo_mov no existe';
    END IF;

    -- Eliminar saldo_ultimo_mov si existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cuenta' 
        AND column_name = 'saldo_ultimo_mov'
    ) THEN
        ALTER TABLE cuenta DROP COLUMN saldo_ultimo_mov;
        RAISE NOTICE 'Columna saldo_ultimo_mov eliminada';
    ELSE
        RAISE NOTICE 'Columna saldo_ultimo_mov no existe';
    END IF;
END $$;
