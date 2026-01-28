-- ============================================
-- MIGRACIÓN: Eliminar columna saldo_posterior de la tabla movimiento
-- ============================================
-- Esta migración elimina la columna saldo_posterior de la tabla movimiento
-- ya que el saldo se calculará dinámicamente desde débito y crédito
-- ============================================

-- Eliminar columna saldo_posterior si existe
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'movimiento' AND column_name = 'saldo_posterior'
  ) THEN
    ALTER TABLE movimiento DROP COLUMN saldo_posterior;
    
    RAISE NOTICE 'Columna saldo_posterior eliminada exitosamente de la tabla movimiento';
  ELSE
    RAISE NOTICE 'La columna saldo_posterior no existe en la tabla movimiento';
  END IF;
END $$;

