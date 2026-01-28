# Migración: Eliminar columnas fecha_ultimo_mov y saldo_ultimo_mov

## Resumen

Esta migración elimina las columnas `fecha_ultimo_mov` y `saldo_ultimo_mov` de la tabla `cuenta` y las reemplaza con una vista calculada dinámicamente.

## Razón del cambio

Las columnas `fecha_ultimo_mov` y `saldo_ultimo_mov` se estaban guardando en la tabla `cuenta`, pero estos valores deben calcularse dinámicamente desde la tabla `movimiento` para mantener la consistencia de los datos.

## Cambios realizados

### 1. Vista creada: `v_cuenta_ultimo_movimiento`

Esta vista calcula dinámicamente:
- **fecha_ultimo_mov**: La fecha del movimiento más reciente para cada cuenta
- **saldo_ultimo_mov**: El saldo acumulado (suma de créditos - suma de débitos) para cada cuenta

La vista solo incluye cuentas con `activo = true`.

### 2. Eliminación de columnas

Las columnas `fecha_ultimo_mov` y `saldo_ultimo_mov` se eliminan de la tabla `cuenta`.

### 3. Cambios en el código TypeScript

- **Interfaces actualizadas**:
  - `Cuenta`: Ya no incluye `fecha_ultimo_mov` y `saldo_ultimo_mov`
  - `CuentaUltimoMovimiento`: Nueva interfaz que extiende `Cuenta` con estos campos calculados
  - `CuentaCompletaUltimoMovimiento`: Nueva interfaz que extiende `CuentaCompleta` con estos campos

- **Nueva función helper**:
  - `obtenerCuentasCompletasConUltimoMovimiento()`: Obtiene cuentas completas con información de último movimiento desde la vista

## Cómo aplicar la migración

```sql
-- Ejecutar el archivo SQL de migración
\i supabase/eliminar_columnas_ultimo_mov.sql
```

O ejecutar directamente en Supabase SQL Editor:

```sql
-- Ver el contenido del archivo eliminar_columnas_ultimo_mov.sql
```

## Uso en el código

### Para obtener cuentas con último movimiento:

```typescript
import { obtenerCuentasCompletasConUltimoMovimiento } from '@/lib/database-real'

const cuentas = await obtenerCuentasCompletasConUltimoMovimiento()
cuentas.forEach(cuenta => {
  console.log(cuenta.fecha_ultimo_mov)
  console.log(cuenta.saldo_ultimo_mov)
})
```

### Para consultar la vista directamente:

```typescript
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase
  .from('v_cuenta_ultimo_movimiento')
  .select('*')
```

## Notas importantes

- La vista calcula los valores dinámicamente cada vez que se consulta
- Los valores siempre reflejan el estado actual de los movimientos
- No es necesario actualizar estos valores manualmente
- Solo se incluyen cuentas activas (`activo = true`) en la vista
