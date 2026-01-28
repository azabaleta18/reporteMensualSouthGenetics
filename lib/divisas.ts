import { supabase } from './supabase'
import { EstadoDivisa, TasaCambio, Divisa, DivisaConEstado } from './types'
import { DIVISAS } from './types'

export async function obtenerEstadosDivisas(): Promise<EstadoDivisa[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Variables de entorno de Supabase no configuradas')
    return []
  }

  const { data, error } = await supabase
    .from('estado_divisa')
    .select('*')
    .order('divisa', { ascending: true })

  if (error) {
    console.error('Error al obtener estados de divisas:', error)
    throw error
  }

  return data || []
}

export async function actualizarEstadoDivisa(divisa: Divisa, cantidad: number): Promise<EstadoDivisa> {
  const { data, error } = await supabase
    .from('estado_divisa')
    .update({ 
      cantidad,
      updated_at: new Date().toISOString()
    })
    .eq('divisa', divisa)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar estado de divisa:', error)
    throw error
  }

  return data
}

export async function obtenerTasasCambio(): Promise<TasaCambio[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Variables de entorno de Supabase no configuradas')
    return []
  }

  // Obtener las tasas más recientes para cada divisa
  const { data, error } = await supabase
    .from('tasa_cambio')
    .select('codigo_divisa, unidades_por_usd, fecha_actualizacion, fecha')
    .order('codigo_divisa', { ascending: true })
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error al obtener tasas de cambio:', error)
    throw error
  }

  // Agrupar por codigo_divisa y tomar la más reciente de cada una
  const tasasMap = new Map<string, TasaCambio>()
  if (data) {
    for (const tasa of data) {
      if (!tasasMap.has(tasa.codigo_divisa)) {
        tasasMap.set(tasa.codigo_divisa, tasa)
      }
    }
  }

  return Array.from(tasasMap.values())
}

/**
 * Obtiene las tasas de cambio para una fecha específica.
 * Si no hay tasa para esa fecha exacta, devuelve la más reciente anterior a esa fecha.
 * Si no hay ninguna tasa anterior, devuelve la más antigua disponible.
 */
export async function obtenerTasasCambioPorFecha(fechaReferencia: string): Promise<Map<string, number>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Variables de entorno de Supabase no configuradas')
    return new Map()
  }

  const fechaRef = new Date(fechaReferencia)
  fechaRef.setHours(0, 0, 0, 0)
  const fechaRefStr = fechaRef.toISOString().split('T')[0]

  console.log(`🔍 Consultando tasas de cambio para fecha: ${fechaRefStr}`)

  // Obtener todas las tasas de cambio usando paginación
  // Supabase tiene un límite de 1000 registros por consulta, así que necesitamos paginar
  const allData: Array<{ codigo_divisa: string; unidades_por_usd: number; fecha: string | null }> = []
  const pageSize = 1000
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('tasa_cambio')
      .select('codigo_divisa, unidades_por_usd, fecha')
      .order('codigo_divisa', { ascending: true })
      .order('fecha', { ascending: false, nullsFirst: false }) // Más reciente primero
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Error al obtener tasas de cambio por fecha:', error)
      throw error
    }

    if (pageData && pageData.length > 0) {
      allData.push(...pageData)
      console.log(`📄 Página obtenida: ${from} a ${from + pageData.length - 1} (${pageData.length} registros)`)
      
      // Si obtuvimos menos registros que el tamaño de página, no hay más datos
      if (pageData.length < pageSize) {
        hasMore = false
      } else {
        from += pageSize
      }
    } else {
      hasMore = false
    }
  }

  console.log(`✅ Total de registros obtenidos: ${allData.length}`)

  // Filtrar en JavaScript: incluir tasas con fecha <= fechaRefStr o fecha NULL
  const data = allData.filter(tasa => {
    if (!tasa.fecha) {
      // Si fecha es NULL, incluirla (puede ser una tasa sin fecha específica)
      return true
    }
    const tasaFecha = new Date(tasa.fecha)
    tasaFecha.setHours(0, 0, 0, 0)
    const fechaRef = new Date(fechaRefStr)
    fechaRef.setHours(0, 0, 0, 0)
    return tasaFecha <= fechaRef
  })

  console.log(`📥 Todos los datos obtenidos de Supabase (${allData.length} registros)`)
  console.log(`📋 Divisas encontradas en todos los datos:`, Array.from(new Set(allData.map(t => t.codigo_divisa))))
  console.log(`🔍 Datos filtrados por fecha (${data.length} registros)`)
  console.log(`📋 Divisas encontradas en datos filtrados:`, Array.from(new Set(data.map(t => t.codigo_divisa))))

  // Crear un mapa con la tasa más reciente para cada divisa
  const tasasMap = new Map<string, number>()
  
  if (data) {
    // Agrupar por codigo_divisa y tomar la primera (más reciente) de cada grupo
    const divisasProcesadas = new Set<string>()
    for (const tasa of data) {
      // Normalizar el código de divisa a mayúsculas para asegurar coincidencia
      const codigoNormalizado = tasa.codigo_divisa.toUpperCase()
      if (!divisasProcesadas.has(codigoNormalizado)) {
        tasasMap.set(codigoNormalizado, Number(tasa.unidades_por_usd))
        divisasProcesadas.add(codigoNormalizado)
        console.log(`✅ Tasa agregada: ${codigoNormalizado} = ${tasa.unidades_por_usd} (fecha: ${tasa.fecha})`)
      }
    }
  }

  console.log(`📊 Mapa final de tasas:`, Array.from(tasasMap.entries()))
  return tasasMap
}

/**
 * Obtiene las tasas de cambio para la última fecha visible según los filtros.
 * Si fechaHasta está definida, usa esa fecha. Si no, usa la fecha actual.
 */
export async function obtenerTasasCambioUltimaFecha(fechaDesde?: string, fechaHasta?: string): Promise<Map<string, number>> {
  let fechaReferencia: string
  
  if (fechaHasta) {
    fechaReferencia = fechaHasta
  } else if (fechaDesde) {
    // Si solo hay fechaDesde, usar esa fecha
    fechaReferencia = fechaDesde
  } else {
    // Si no hay filtros de fecha, usar la fecha actual
    fechaReferencia = new Date().toISOString().split('T')[0]
  }

  console.log(`📅 Fechas recibidas - Desde: ${fechaDesde || 'N/A'}, Hasta: ${fechaHasta || 'N/A'}, Referencia usada: ${fechaReferencia}`)

  return obtenerTasasCambioPorFecha(fechaReferencia)
}

export async function actualizarTasaCambio(divisa: Divisa, unidades_por_usd: number): Promise<TasaCambio> {
  const { data, error } = await supabase
    .from('tasa_cambio')
    .update({ 
      unidades_por_usd,
      fecha_actualizacion: new Date().toISOString()
    })
    .eq('codigo_divisa', divisa)
    .select('codigo_divisa, unidades_por_usd, fecha_actualizacion')
    .single()

  if (error) {
    console.error('Error al actualizar tasa de cambio:', error)
    throw error
  }

  return data
}

export async function obtenerDivisasConEstado(): Promise<DivisaConEstado[]> {
  const [estados, tasas] = await Promise.all([
    obtenerEstadosDivisas(),
    obtenerTasasCambio(),
  ])

  const tasasMap = new Map(tasas.map(t => [t.codigo_divisa, t.unidades_por_usd]))
  const estadosMap = new Map(estados.map(e => [e.divisa, e.cantidad]))

  return DIVISAS.map(divisaInfo => {
    const cantidad = estadosMap.get(divisaInfo.codigo) || 0
    const tasa = tasasMap.get(divisaInfo.codigo) || 1
    const total_usd = cantidad / tasa // Dividir porque es unidades_por_usd, no tasa_a_usd

    return {
      divisa: divisaInfo.codigo,
      nombre: divisaInfo.nombre,
      simbolo: divisaInfo.simbolo,
      cantidad,
      tasa_a_usd: tasa,
      total_usd,
    }
  })
}

export function calcularTotalEnDolares(divisas: DivisaConEstado[]): number {
  return divisas.reduce((total, d) => total + d.total_usd, 0)
}

