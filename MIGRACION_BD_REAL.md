# Migración a Base de Datos Real

Este documento explica cómo adaptar la aplicación para usar tu estructura de base de datos real.

## Estructura de Base de Datos Real

Tu base de datos tiene las siguientes tablas principales:

### Tablas de Configuración
- **`banco`**: Bancos (id_banco, nombre)
- **`pais`**: Países (codigo_pais, nombre)
- **`divisa`**: Divisas (codigo_divisa, nombre, simbolo, decimales)
- **`empresa`**: Empresas (id_empresa, nombre)
- **`tipo_cuenta`**: Tipos de cuenta (id_tipo_cuenta, codigo, descripcion)
- **`categoria_movimiento`**: Categorías de movimientos (id_categoria, nombre, descripcion)

### Tablas de Relación
- **`banco_pais`**: Relación banco-país (id_banco_pais, id_banco, codigo_pais)
- **`banco_pais_divisa`**: Relación banco-país-divisa (id_banco_pais_divisa, id_banco_pais, codigo_divisa)

### Tablas de Datos
- **`cuenta`**: Cuentas bancarias (id_cuenta, id_empresa, id_banco_pais_divisa, id_tipo_cuenta, numero_cuenta, nombre_sheet_origen, fecha_ultimo_mov, saldo_ultimo_mov, id_journal_odoo)
- **`movimiento`**: Movimientos bancarios (id_movimiento, id_cuenta, fecha_mov, concepto, id_categoria, debito, credito, saldo_posterior, id_odoo)
- **`saldo_diario_cuenta`**: Saldos diarios por cuenta (id_cuenta, fecha, saldo_divisa, saldo_usd, es_actual)
- **`tasa_cambio`**: Tasas de cambio (codigo_divisa, unidades_por_usd, fecha_actualizacion)

## Cambios Realizados

### 1. Actualización de Tipos (`lib/types.ts`)

Se actualizó la interfaz `TasaCambio` para que coincida con tu estructura:

```typescript
export interface TasaCambio {
  codigo_divisa: string
  unidades_por_usd: number  // Cuántas unidades de la divisa = 1 USD
  fecha_actualizacion: string
}
```

### 2. Actualización de Funciones de Divisas (`lib/divisas.ts`)

- `obtenerTasasCambio()`: Ahora consulta `codigo_divisa` y `unidades_por_usd`
- `actualizarTasaCambio()`: Actualiza `unidades_por_usd` y `fecha_actualizacion`
- `obtenerDivisasConEstado()`: Calcula correctamente usando `unidades_por_usd` (divide en lugar de multiplicar)

### 3. Nuevo Archivo de Base de Datos Real (`lib/database-real.ts`)

Este archivo contiene funciones para trabajar con tu estructura real:

#### Interfaces
- `Cuenta`: Estructura completa de una cuenta
- `SaldoDiarioCuenta`: Saldo de una cuenta en una fecha específica
- `CuentaCompleta`: Cuenta con información de banco, país y divisa

#### Funciones principales

**`obtenerCuentasCompletas()`**
- Obtiene todas las cuentas con información de banco, país y divisa
- Usa JOINs para traer datos relacionados

**`obtenerSaldosDiariosPorFecha(fechaDesde?, fechaHasta?)`**
- Obtiene saldos diarios agrupados por fecha
- Permite filtrar por rango de fechas

**`obtenerSaldosDiariosCompletos(fechaDesde?, fechaHasta?)`**
- Obtiene saldos con información completa de cuenta
- Incluye banco, divisa y país

**`obtenerDatosReporte(fechaDesde?, fechaHasta?, divisas?)`**
- Función principal para el reporte
- Retorna saldos agrupados por fecha y lista de cuentas
- Permite filtrar por divisas

### 4. Actualización del Editor de Tasas (`components/EditorTasasCambio.tsx`)

- Ahora muestra "Unidades por USD" en lugar de "Tasa a USD"
- Explica que los valores representan cuántas unidades de cada moneda equivalen a 1 USD
- Actualiza correctamente usando `codigo_divisa` y `unidades_por_usd`

## Próximos Pasos para Completar la Migración

### 1. Actualizar `TablaUnificada.tsx`

Reemplazar la función `cargarDatos()` para usar `obtenerDatosReporte()`:

```typescript
const cargarDatos = async () => {
  try {
    setLoading(true)
    const [datosReporte, tasas] = await Promise.all([
      obtenerDatosReporte(),
      obtenerTasasCambio(),
    ])
    
    // Convertir el formato de datosReporte a registrosPorFecha
    // ...
    
    const tasasMap: Record<Divisa, number> = {} as Record<Divisa, number>
    tasas.forEach(t => {
      tasasMap[t.codigo_divisa as Divisa] = t.unidades_por_usd
    })
    setTasasCambio(tasasMap)
  } catch (error) {
    console.error('Error al cargar datos:', error)
  } finally {
    setLoading(false)
  }
}
```

### 2. Mapear Cuentas

Necesitas crear un mapeo entre:
- `nombre_sheet_origen` de la tabla `cuenta` → Nombre para mostrar en la tabla
- O usar una combinación de banco + divisa + tipo de cuenta

### 3. Calcular Conversiones a USD

Con `unidades_por_usd`, la conversión es:
```typescript
const valorUSD = saldo_divisa / unidades_por_usd
```

Por ejemplo:
- Si tienes 1000 ARS y la tasa es 1000 ARS por USD
- Entonces: 1000 / 1000 = 1 USD

### 4. Actualizar Filtros

Los filtros ya están preparados para trabajar con fechas y divisas. Solo necesitas:
- Pasar `fechaDesde` y `fechaHasta` a `obtenerDatosReporte()`
- Pasar el array de `divisas` seleccionadas

### 5. Actualizar Exportación

Las funciones de exportación ya están preparadas. Solo necesitas asegurarte de que los datos tengan el formato correcto.

## Consideraciones Importantes

### Tasas de Cambio

En tu BD, `unidades_por_usd` significa:
- **ARS**: 1000 → 1000 pesos argentinos = 1 USD
- **EUR**: 0.85 → 0.85 euros = 1 USD
- **USD**: 1 → 1 dólar = 1 USD

Para convertir a USD:
```typescript
valorUSD = cantidad_divisa / unidades_por_usd
```

### Nombres de Cuentas

Puedes usar:
1. `nombre_sheet_origen` si está disponible
2. O construir un nombre como: `{banco_nombre} {codigo_pais} {codigo_divisa} {tipo_cuenta}`

### Saldos Diarios

La tabla `saldo_diario_cuenta` ya tiene:
- `saldo_divisa`: Saldo en la moneda original
- `saldo_usd`: Saldo convertido a USD (puede ser null)
- `es_actual`: Indica si es el saldo más reciente

Si `saldo_usd` es null, debes calcularlo usando la tasa de cambio.

## Ejemplo de Uso

```typescript
// Obtener datos del reporte para el mes actual, solo USD y EUR
const { saldosPorFecha, cuentas } = await obtenerDatosReporte(
  '2024-12-01',
  '2024-12-31',
  ['USD', 'EUR']
)

// saldosPorFecha tendrá la estructura:
// {
//   '2024-12-01': [
//     { id_cuenta: 1, nombre_cuenta: 'BBVA USD', banco: 'BBVA', divisa: 'USD', saldo_divisa: 10000, saldo_usd: 10000 },
//     { id_cuenta: 2, nombre_cuenta: 'CAIXA EUR', banco: 'CAIXA', divisa: 'EUR', saldo_divisa: 5000, saldo_usd: 5882 },
//   ],
//   '2024-12-02': [...],
//   ...
// }
```

## Testing

Antes de implementar en producción:

1. Verifica que las tasas de cambio se actualicen correctamente
2. Prueba los filtros de fecha y divisa
3. Verifica que las conversiones a USD sean correctas
4. Prueba la exportación a CSV, Excel y PDF
5. Verifica que la agrupación por mes funcione correctamente

## Notas Adicionales

- El componente `EditorTasasCambio` ya está completamente funcional
- Los filtros están listos y funcionando
- La exportación está preparada para trabajar con los datos reales
- Solo falta adaptar la carga de datos en `TablaUnificada`

