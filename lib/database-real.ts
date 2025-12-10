import { supabase } from './supabase'
import { Divisa } from './types'

// Interfaces que coinciden con tu estructura de base de datos real
export interface Cuenta {
  id_cuenta: number
  id_empresa: number
  id_banco_pais_divisa: number
  id_tipo_cuenta: number
  numero_cuenta: string | null
  nombre_sheet_origen: string | null
  fecha_ultimo_mov: string | null
  saldo_ultimo_mov: number | null
  id_journal_odoo: number | null
}

export interface SaldoDiarioCuenta {
  id_cuenta: number
  fecha: string
  saldo_divisa: number
  saldo_usd: number | null
  es_actual: boolean
}

export interface BancoPaisDivisa {
  id_banco_pais_divisa: number
  id_banco_pais: number
  codigo_divisa: string
}

export interface BancoPais {
  id_banco_pais: number
  id_banco: number
  codigo_pais: string
}

export interface Banco {
  id_banco: number
  nombre: string
}

export interface CuentaCompleta extends Cuenta {
  banco_nombre: string
  codigo_divisa: string
  codigo_pais: string
}

/**
 * Obtiene todas las cuentas con su información de banco, país y divisa
 * Usa consultas separadas porque Supabase no soporta JOINs complejos en el cliente
 */
export async function obtenerCuentasCompletas(): Promise<CuentaCompleta[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Variables de entorno de Supabase no configuradas')
    return []
  }

  try {
    // Obtener todas las cuentas
    const { data: cuentas, error: errorCuentas } = await supabase
      .from('cuenta')
      .select('*')

    if (errorCuentas) throw errorCuentas

    // Obtener banco_pais_divisa
    const { data: bancoPaisDivisa, error: errorBPD } = await supabase
      .from('banco_pais_divisa')
      .select('*')

    if (errorBPD) throw errorBPD

    // Obtener banco_pais
    const { data: bancoPais, error: errorBP } = await supabase
      .from('banco_pais')
      .select('*')

    if (errorBP) throw errorBP

    // Obtener bancos
    const { data: bancos, error: errorBancos } = await supabase
      .from('banco')
      .select('*')

    if (errorBancos) throw errorBancos

    // Crear mapas para búsqueda rápida
    const bpdMap = new Map(bancoPaisDivisa?.map(b => [b.id_banco_pais_divisa, b]) || [])
    const bpMap = new Map(bancoPais?.map(b => [b.id_banco_pais, b]) || [])
    const bancoMap = new Map(bancos?.map(b => [b.id_banco, b]) || [])

    // Combinar los datos manualmente
    const cuentasCompletas: CuentaCompleta[] = (cuentas || []).map((cuenta: any) => {
      const bpd = bpdMap.get(cuenta.id_banco_pais_divisa)
      const bp = bpd ? bpMap.get(bpd.id_banco_pais) : null
      const banco = bp ? bancoMap.get(bp.id_banco) : null

      return {
        ...cuenta,
        banco_nombre: banco?.nombre || '',
        codigo_divisa: bpd?.codigo_divisa || '',
        codigo_pais: bp?.codigo_pais || '',
      }
    })

    return cuentasCompletas
  } catch (error) {
    console.error('Error al obtener cuentas completas:', error)
    return []
  }
}

/**
 * Obtiene los saldos diarios agrupados por fecha
 */
export async function obtenerSaldosDiariosPorFecha(
  fechaDesde?: string,
  fechaHasta?: string
): Promise<Record<string, SaldoDiarioCuenta[]>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Variables de entorno de Supabase no configuradas')
    return {}
  }

  let query = supabase
    .from('saldo_diario_cuenta')
    .select('*')
    .order('fecha', { ascending: true })

  if (fechaDesde) {
    query = query.gte('fecha', fechaDesde)
  }

  if (fechaHasta) {
    query = query.lte('fecha', fechaHasta)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener saldos diarios:', error)
    throw error
  }

  // Agrupar por fecha
  const saldosPorFecha: Record<string, SaldoDiarioCuenta[]> = {}
  
  ;(data || []).forEach((saldo: any) => {
    const fecha = saldo.fecha
    if (!saldosPorFecha[fecha]) {
      saldosPorFecha[fecha] = []
    }
    saldosPorFecha[fecha].push(saldo)
  })

  return saldosPorFecha
}

/**
 * Obtiene los saldos diarios con información completa de cuenta, banco y divisa
 * Usa consultas separadas y las combina manualmente
 */
export async function obtenerSaldosDiariosCompletos(
  fechaDesde?: string,
  fechaHasta?: string
): Promise<Array<SaldoDiarioCuenta & { cuenta: CuentaCompleta }>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Variables de entorno de Supabase no configuradas')
    return []
  }

  try {
    // Obtener saldos diarios
    let querySaldos = supabase
      .from('saldo_diario_cuenta')
      .select('*')
      .order('fecha', { ascending: true })

    if (fechaDesde) {
      querySaldos = querySaldos.gte('fecha', fechaDesde)
    }

    if (fechaHasta) {
      querySaldos = querySaldos.lte('fecha', fechaHasta)
    }

    const { data: saldos, error: errorSaldos } = await querySaldos

    if (errorSaldos) throw errorSaldos

    // Obtener cuentas completas
    const cuentasCompletas = await obtenerCuentasCompletas()
    const cuentaMap = new Map(cuentasCompletas.map(c => [c.id_cuenta, c]))

    // Combinar saldos con cuentas
    const saldosCompletos = (saldos || [])
      .map((saldo: any) => {
        const cuenta = cuentaMap.get(saldo.id_cuenta)
        if (!cuenta) return null

        return {
          id_cuenta: saldo.id_cuenta,
          fecha: saldo.fecha,
          saldo_divisa: saldo.saldo_divisa,
          saldo_usd: saldo.saldo_usd,
          es_actual: saldo.es_actual,
          cuenta
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    return saldosCompletos
  } catch (error) {
    console.error('Error al obtener saldos diarios completos:', error)
    return []
  }
}

/**
 * Obtiene los saldos agrupados por fecha para el reporte
 * Retorna un objeto con fechas como claves y arrays de saldos por cuenta
 */
export async function obtenerDatosReporte(
  fechaDesde?: string,
  fechaHasta?: string,
  divisas?: Divisa[]
): Promise<{
  saldosPorFecha: Record<string, Array<{
    id_cuenta: number
    nombre_cuenta: string
    banco: string
    divisa: Divisa
    saldo_divisa: number
    saldo_usd: number
  }>>
  cuentas: CuentaCompleta[]
}> {
  const saldosCompletos = await obtenerSaldosDiariosCompletos(fechaDesde, fechaHasta)
  
  // Filtrar por divisas si se especificaron
  const saldosFiltrados = divisas && divisas.length > 0
    ? saldosCompletos.filter(s => divisas.includes(s.cuenta.codigo_divisa as Divisa))
    : saldosCompletos

  // Agrupar por fecha
  const saldosPorFecha: Record<string, Array<{
    id_cuenta: number
    nombre_cuenta: string
    banco: string
    divisa: Divisa
    saldo_divisa: number
    saldo_usd: number
  }>> = {}

  const cuentasMap = new Map<number, CuentaCompleta>()

  saldosFiltrados.forEach(saldo => {
    const fecha = saldo.fecha
    if (!saldosPorFecha[fecha]) {
      saldosPorFecha[fecha] = []
    }

    // Guardar cuenta en el mapa
    if (!cuentasMap.has(saldo.id_cuenta)) {
      cuentasMap.set(saldo.id_cuenta, saldo.cuenta)
    }

    saldosPorFecha[fecha].push({
      id_cuenta: saldo.id_cuenta,
      nombre_cuenta: saldo.cuenta.nombre_sheet_origen || `Cuenta ${saldo.id_cuenta}`,
      banco: saldo.cuenta.banco_nombre,
      divisa: saldo.cuenta.codigo_divisa as Divisa,
      saldo_divisa: saldo.saldo_divisa,
      saldo_usd: saldo.saldo_usd || 0
    })
  })

  return {
    saldosPorFecha,
    cuentas: Array.from(cuentasMap.values())
  }
}

