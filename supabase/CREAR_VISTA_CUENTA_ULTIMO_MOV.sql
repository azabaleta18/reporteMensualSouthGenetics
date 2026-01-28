-- ============================================
-- CREAR VISTA: v_cuenta_ultimo_movimiento
-- ============================================
-- Esta vista calcula dinámicamente la fecha y el saldo del último movimiento por cuenta
-- 
-- INSTRUCCIONES:
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. La vista aparecerá en el panel izquierdo de Supabase bajo "Views"
-- ============================================

-- Eliminar la vista si ya existe
DROP VIEW IF EXISTS v_cuenta_ultimo_movimiento;

-- Crear la vista que calcula fecha y saldo del último movimiento
CREATE VIEW v_cuenta_ultimo_movimiento AS
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
    -- Saldo acumulado hasta el último movimiento (suma de créditos - suma de débitos)
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

-- Verificar que la vista se creó correctamente
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name = 'v_cuenta_ultimo_movimiento';
