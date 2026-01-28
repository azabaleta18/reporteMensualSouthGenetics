-- ============================================
-- MIGRACIÓN: Agregar campo activo a la tabla cuenta
-- ============================================
-- Esta migración agrega el campo "activo" a la tabla cuenta
-- para poder filtrar cuentas inactivas en las consultas
-- ============================================

-- Agregar columna activo si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cuenta' AND column_name = 'activo'
  ) THEN
    ALTER TABLE cuenta ADD COLUMN activo BOOLEAN DEFAULT true NOT NULL;
    
    -- Comentario para documentación
    COMMENT ON COLUMN cuenta.activo IS 'Indica si la cuenta está activa. Las cuentas inactivas no se mostrarán en los reportes.';
    
    -- Crear índice para mejorar consultas
    CREATE INDEX IF NOT EXISTS idx_cuenta_activo ON cuenta(activo);
  END IF;
END $$;

