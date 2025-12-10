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

  const { data, error } = await supabase
    .from('tasa_cambio')
    .select('codigo_divisa, unidades_por_usd, fecha_actualizacion')
    .order('codigo_divisa', { ascending: true })

  if (error) {
    console.error('Error al obtener tasas de cambio:', error)
    throw error
  }

  return data || []
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

