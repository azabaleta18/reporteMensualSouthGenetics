# Migración del Esquema de Base de Datos

Este documento explica cómo aplicar la migración que reestructura completamente el esquema de la base de datos.

## 📋 Resumen de Cambios

### Tablas Eliminadas
- `registro_bancario`
- `estado_divisa`
- `tasa_cambio`

### Nuevas Tablas Creadas
1. **`bancos`** - Datos generales de los bancos
2. **`cuentas`** - Cuentas específicas de cada banco
3. **`balance`** - Movimientos bancarios desde Odoo

## 🚀 Cómo Aplicar la Migración

### Opción 1: Usando el Editor SQL de Supabase (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor** en el menú lateral
3. Haz clic en **New Query**
4. Copia y pega todo el contenido del archivo `migration.sql`
5. Haz clic en **Run** o presiona `Ctrl+Enter` (Windows/Linux) o `Cmd+Enter` (Mac)
6. Verifica que no haya errores en la consola

### Opción 2: Usando Supabase CLI

Si tienes Supabase CLI configurado:

```bash
# Asegúrate de estar en el directorio del proyecto
cd reporteMensualSouthGenetics

# Aplicar la migración
supabase db push
```

### Opción 3: Usando el MCP de Supabase (si está configurado)

Puedes usar las herramientas MCP de Supabase para aplicar la migración directamente desde el editor.

## ⚠️ Advertencias Importantes

1. **Backup**: Esta migración **ELIMINA** las tablas antiguas. Si tienes datos importantes, haz un backup antes de ejecutar la migración.

2. **Datos Perdidos**: Todos los datos en las tablas antiguas (`registro_bancario`, `estado_divisa`, `tasa_cambio`) se perderán permanentemente.

3. **Aplicación**: Después de aplicar esta migración, la aplicación actual **NO funcionará** hasta que se actualicen los componentes del código para usar las nuevas tablas.

## 📊 Estructura de las Nuevas Tablas

### Tabla: `bancos`
- `id` (UUID, PK)
- `nombre` (TEXT) - Nombre del banco (ej: BBVA, DAVIVIENDA)
- `pais` (TEXT) - País donde opera
- `divisa` (TEXT) - Divisa principal (ARS, CLP, COP, EUR, MXN, USD, UYU)
- `identificador_formal` (TEXT) - Identificador base del banco
- `created_at` (TIMESTAMP)

### Tabla: `cuentas`
- `id` (UUID, PK)
- `banco_id` (UUID, FK → bancos.id)
- `empresa_asociada` (TEXT) - Empresa asociada
- `tipo_cuenta` (TEXT) - CC, CA, RC, Recaudadora
- `numero_cuenta` (TEXT) - Número de cuenta
- `nombre_formal` (TEXT) - Nombre completo de la cuenta
- `ultimo_movimiento` (DATE, NULLABLE)
- `created_at` (TIMESTAMP)

### Tabla: `balance`
- `id` (UUID, PK)
- `cuenta_id` (UUID, FK → cuentas.id)
- `fecha` (DATE)
- `monto` (NUMERIC) - Monto del movimiento
- `concepto` (TEXT) - Descripción del movimiento
- `created_at` (TIMESTAMP)

## 🔒 Seguridad

Todas las tablas tienen Row Level Security (RLS) habilitado con políticas que permiten todas las operaciones. **Ajusta estas políticas según tus necesidades de seguridad** antes de usar en producción.

## ✅ Verificación Post-Migración

Después de aplicar la migración, verifica:

1. Las tablas antiguas fueron eliminadas:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('registro_bancario', 'estado_divisa', 'tasa_cambio');
   ```
   Debe retornar 0 filas.

2. Las nuevas tablas fueron creadas:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('bancos', 'cuentas', 'balance')
   ORDER BY table_name;
   ```
   Debe retornar 3 filas.

3. Las tablas están vacías (como se solicitó):
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM bancos) as bancos_count,
     (SELECT COUNT(*) FROM cuentas) as cuentas_count,
     (SELECT COUNT(*) FROM balance) as balance_count;
   ```
   Todos los conteos deben ser 0.

## 📝 Próximos Pasos

Después de aplicar esta migración, necesitarás:

1. Actualizar los tipos TypeScript en `lib/types.ts`
2. Actualizar las funciones en `lib/database.ts` para usar las nuevas tablas
3. Actualizar los componentes que consumen estos datos
4. Actualizar cualquier otra referencia a las tablas antiguas

