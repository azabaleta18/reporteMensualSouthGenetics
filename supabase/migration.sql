-- ============================================
-- MIGRACIÓN: Reestructuración completa del esquema de base de datos
-- ============================================
-- Esta migración elimina las tablas antiguas y crea el nuevo esquema
-- compuesto por: bancos, cuentas, balance
-- ============================================

-- ============================================
-- PASO 1: Eliminar tablas antiguas y sus dependencias
-- ============================================

-- Eliminar políticas RLS de las tablas antiguas (si existen)
DROP POLICY IF EXISTS "Permitir todas las operaciones" ON registro_bancario;
DROP POLICY IF EXISTS "Permitir todas las operaciones" ON estado_divisa;
DROP POLICY IF EXISTS "Permitir todas las operaciones" ON tasa_cambio;

-- Eliminar índices de las tablas antiguas (si existen)
DROP INDEX IF EXISTS idx_registro_bancario_divisa;
DROP INDEX IF EXISTS idx_registro_bancario_fecha;

-- Eliminar tablas antiguas (en orden para respetar dependencias si las hay)
DROP TABLE IF EXISTS registro_bancario CASCADE;
DROP TABLE IF EXISTS estado_divisa CASCADE;
DROP TABLE IF EXISTS tasa_cambio CASCADE;

-- ============================================
-- PASO 2: Crear nuevo esquema
-- ============================================

-- ============================================
-- Tabla: bancos
-- ============================================
-- Registra datos generales del banco, independientemente de la cuenta
CREATE TABLE bancos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  pais TEXT NOT NULL,
  divisa TEXT NOT NULL CHECK (divisa IN ('ARS', 'CLP', 'COP', 'EUR', 'MXN', 'USD', 'UYU')),
  identificador_formal TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios para documentación
COMMENT ON TABLE bancos IS 'Tabla que registra datos generales de los bancos';
COMMENT ON COLUMN bancos.nombre IS 'Nombre general del banco, ej: BBVA, DAVIVIENDA, CAIXA';
COMMENT ON COLUMN bancos.pais IS 'País donde opera el banco';
COMMENT ON COLUMN bancos.divisa IS 'Divisa principal del banco (ARS, CLP, COP, EUR, MXN, USD, UYU)';
COMMENT ON COLUMN bancos.identificador_formal IS 'Identificador base del banco/cuenta, ej: "BBVA SG MX MXN" (sin número de cuenta)';

-- Índices para mejorar consultas
CREATE INDEX idx_bancos_divisa ON bancos(divisa);
CREATE INDEX idx_bancos_pais ON bancos(pais);
CREATE INDEX idx_bancos_nombre ON bancos(nombre);

-- ============================================
-- Tabla: cuentas
-- ============================================
-- Representa cada cuenta específica del banco
CREATE TABLE cuentas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  banco_id UUID NOT NULL REFERENCES bancos(id) ON DELETE CASCADE,
  empresa_asociada TEXT NOT NULL,
  tipo_cuenta TEXT NOT NULL CHECK (tipo_cuenta IN ('CC', 'CA', 'RC', 'Recaudadora')),
  numero_cuenta TEXT NOT NULL,
  nombre_formal TEXT NOT NULL,
  ultimo_movimiento DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Constraint para asegurar unicidad de cuenta por banco
  UNIQUE(banco_id, numero_cuenta, tipo_cuenta)
);

-- Comentarios para documentación
COMMENT ON TABLE cuentas IS 'Tabla que representa cada cuenta específica del banco';
COMMENT ON COLUMN cuentas.banco_id IS 'Referencia al banco al que pertenece la cuenta';
COMMENT ON COLUMN cuentas.empresa_asociada IS 'Empresa asociada a la cuenta, ej: Southgenetics MX SA, NECBB International SAS';
COMMENT ON COLUMN cuentas.tipo_cuenta IS 'Tipo de cuenta: CC (Cuenta Corriente), CA (Caja de Ahorro), RC (Recaudadora), Recaudadora';
COMMENT ON COLUMN cuentas.numero_cuenta IS 'Número de cuenta bancaria';
COMMENT ON COLUMN cuentas.nombre_formal IS 'Nombre formal completo de la cuenta, ej: "BBVA SG MX MXN 3786 CC"';
COMMENT ON COLUMN cuentas.ultimo_movimiento IS 'Fecha del último movimiento conocido en la cuenta';

-- Índices para mejorar consultas
CREATE INDEX idx_cuentas_banco_id ON cuentas(banco_id);
CREATE INDEX idx_cuentas_empresa ON cuentas(empresa_asociada);
CREATE INDEX idx_cuentas_tipo ON cuentas(tipo_cuenta);
CREATE INDEX idx_cuentas_ultimo_movimiento ON cuentas(ultimo_movimiento);

-- ============================================
-- Tabla: balance
-- ============================================
-- Movimientos bancarios recapitulados desde Odoo
CREATE TABLE balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_id UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  monto NUMERIC(15, 2) NOT NULL,
  concepto TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios para documentación
COMMENT ON TABLE balance IS 'Tabla que almacena todos los movimientos bancarios recapitulados desde Odoo';
COMMENT ON COLUMN balance.cuenta_id IS 'Referencia a la cuenta bancaria del movimiento';
COMMENT ON COLUMN balance.fecha IS 'Fecha del movimiento bancario';
COMMENT ON COLUMN balance.monto IS 'Monto del movimiento (puede ser positivo o negativo)';
COMMENT ON COLUMN balance.concepto IS 'Concepto o descripción del movimiento';

-- Índices para mejorar consultas
CREATE INDEX idx_balance_cuenta_id ON balance(cuenta_id);
CREATE INDEX idx_balance_fecha ON balance(fecha DESC);
CREATE INDEX idx_balance_cuenta_fecha ON balance(cuenta_id, fecha DESC);

-- ============================================
-- PASO 3: Configurar Row Level Security (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todas las operaciones (ajustar según necesidades de seguridad)
-- Tabla: bancos
CREATE POLICY "Permitir todas las operaciones en bancos" ON bancos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tabla: cuentas
CREATE POLICY "Permitir todas las operaciones en cuentas" ON cuentas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tabla: balance
CREATE POLICY "Permitir todas las operaciones en balance" ON balance
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- PASO 4: Crear tabla de tasas de cambio
-- ============================================

CREATE TABLE tasa_cambio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  divisa TEXT NOT NULL UNIQUE CHECK (divisa IN ('ARS', 'CLP', 'COP', 'EUR', 'MXN', 'USD', 'UYU')),
  tasa_a_usd NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios para documentación
COMMENT ON TABLE tasa_cambio IS 'Tabla que almacena las tasas de cambio de cada divisa a USD';
COMMENT ON COLUMN tasa_cambio.divisa IS 'Código de la divisa (ARS, CLP, COP, EUR, MXN, USD, UYU)';
COMMENT ON COLUMN tasa_cambio.tasa_a_usd IS 'Tasa de cambio de la divisa a dólares estadounidenses (USD)';

-- Índice para mejorar consultas
CREATE INDEX idx_tasa_cambio_divisa ON tasa_cambio(divisa);

-- Habilitar RLS
ALTER TABLE tasa_cambio ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Permitir todas las operaciones en tasa_cambio" ON tasa_cambio
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insertar tasas de cambio iniciales
INSERT INTO tasa_cambio (divisa, tasa_a_usd) VALUES
  ('ARS', 1.380),
  ('CLP', 967.000),
  ('COP', 4.164),
  ('EUR', 1.160),
  ('MXN', 19.000),
  ('USD', 1.000),
  ('UYU', 40.000);

-- ============================================
-- MIGRACIÓN COMPLETADA
-- ============================================
-- Las tablas están creadas y listas para usar
-- La tabla tasa_cambio contiene los valores iniciales
-- ============================================
