-- Migración para crear la tabla registro_bancario
-- Ejecutar en el editor SQL de Supabase

-- Crear tabla registro_bancario (en español y singular según convención)
CREATE TABLE IF NOT EXISTS registro_bancario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  banco TEXT NOT NULL,
  divisa TEXT NOT NULL CHECK (divisa IN ('ARS', 'CLP', 'COP', 'EUR', 'MXN', 'UYU', 'USD')),
  cantidad DECIMAL(15, 2) NOT NULL,
  fecha DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para mejorar las consultas por divisa
CREATE INDEX IF NOT EXISTS idx_registro_bancario_divisa ON registro_bancario(divisa);

-- Crear índice para mejorar las consultas por fecha
CREATE INDEX IF NOT EXISTS idx_registro_bancario_fecha ON registro_bancario(fecha DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE registro_bancario ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
-- NOTA: Ajusta esta política según tus necesidades de seguridad
CREATE POLICY "Permitir todas las operaciones" ON registro_bancario
  FOR ALL
  USING (true)
  WITH CHECK (true);

