import { supabase } from './supabase'
import { RegistroBancario, ResumenDivisa, Divisa, CUENTAS_BANCARIAS } from './types'

export async function obtenerRegistros(): Promise<RegistroBancario[]> {
  const { data, error } = await supabase
    .from('registro_bancario')
    .select('*')
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error al obtener registros:', error)
    throw error
  }

  return data || []
}

export async function crearRegistro(registro: Omit<RegistroBancario, 'id' | 'created_at' | 'updated_at'>): Promise<RegistroBancario> {
  const { data, error } = await supabase
    .from('registro_bancario')
    .insert([registro])
    .select()
    .single()

  if (error) {
    console.error('Error al crear registro:', error)
    throw error
  }

  return data
}

export async function actualizarRegistro(id: string, registro: Partial<RegistroBancario>): Promise<RegistroBancario> {
  const { data, error } = await supabase
    .from('registro_bancario')
    .update({ ...registro, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar registro:', error)
    throw error
  }

  return data
}

export async function eliminarRegistro(id: string): Promise<void> {
  const { error } = await supabase
    .from('registro_bancario')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error al eliminar registro:', error)
    throw error
  }
}

export async function obtenerResumenPorDivisa(): Promise<ResumenDivisa[]> {
  const { data, error } = await supabase
    .from('registro_bancario')
    .select('divisa, cantidad')

  if (error) {
    console.error('Error al obtener resumen:', error)
    throw error
  }

  const resumen: Partial<Record<Divisa, ResumenDivisa>> = {}

  data?.forEach((registro) => {
    const divisa = registro.divisa as Divisa
    if (!resumen[divisa]) {
      resumen[divisa] = {
        divisa: divisa,
        total: 0,
        cantidad_registros: 0,
      }
    }
    if (resumen[divisa]) {
      resumen[divisa]!.total += registro.cantidad
      resumen[divisa]!.cantidad_registros += 1
    }
  })

  return Object.values(resumen) as ResumenDivisa[]
}

export async function obtenerTotalGeneral(): Promise<number> {
  const { data, error } = await supabase
    .from('registro_bancario')
    .select('cantidad')

  if (error) {
    console.error('Error al obtener total general:', error)
    throw error
  }

  return data?.reduce((sum, registro) => sum + registro.cantidad, 0) || 0
}

export async function obtenerRegistrosPorBancoYDivisa(divisa: Divisa): Promise<Record<string, RegistroBancario[]>> {
  const { data, error } = await supabase
    .from('registro_bancario')
    .select('*')
    .eq('divisa', divisa)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error al obtener registros por banco y divisa:', error)
    throw error
  }

  const registrosPorBanco: Record<string, RegistroBancario[]> = {}

  data?.forEach((registro) => {
    if (!registrosPorBanco[registro.banco]) {
      registrosPorBanco[registro.banco] = []
    }
    registrosPorBanco[registro.banco].push(registro)
  })

  return registrosPorBanco
}

export async function obtenerRegistrosAgrupadosPorFecha(): Promise<Record<string, RegistroBancario[]>> {
  const { data, error } = await supabase
    .from('registro_bancario')
    .select('*')
    .order('fecha', { ascending: true })

  if (error) {
    console.error('Error al obtener registros agrupados por fecha:', error)
    throw error
  }

  const registrosPorFecha: Record<string, RegistroBancario[]> = {}

  data?.forEach((registro) => {
    const fecha = registro.fecha
    if (!registrosPorFecha[fecha]) {
      registrosPorFecha[fecha] = []
    }
    registrosPorFecha[fecha].push(registro)
  })

  return registrosPorFecha
}

export async function crearRegistrosEjemplo(): Promise<void> {
  // Generar 10 días de datos (últimos 10 días desde hoy)
  const fechas: string[] = []
  const hoy = new Date()
  for (let i = 9; i >= 0; i--) {
    const fecha = new Date(hoy)
    fecha.setDate(fecha.getDate() - i)
    fechas.push(fecha.toISOString().split('T')[0])
  }

  // Valores base por tipo de divisa (para generar datos realistas)
  const valoresBase: Record<Divisa, { min: number; max: number }> = {
    ARS: { min: 500000, max: 5000000 },
    CLP: { min: 50000000, max: 150000000 },
    COP: { min: 1000000, max: 100000000 },
    EUR: { min: 50000, max: 200000 },
    MXN: { min: 1000000, max: 10000000 },
    UYU: { min: 30000, max: 200000 },
    USD: { min: 5000, max: 500000 },
  }

  const registros: Omit<RegistroBancario, 'id' | 'created_at' | 'updated_at'>[] = []

  fechas.forEach((fecha, diaIndex) => {
    CUENTAS_BANCARIAS.forEach((cuenta) => {
      const base = valoresBase[cuenta.divisa]
      // Generar valores que varíen ligeramente día a día
      const variacion = 1 + (Math.random() * 0.2 - 0.1) // ±10% de variación
      const valorBase = base.min + (base.max - base.min) * (0.3 + Math.random() * 0.4)
      const cantidad = Math.round(valorBase * variacion * (1 + diaIndex * 0.05)) // Incremento gradual día a día

      registros.push({
        banco: cuenta.banco,
        divisa: cuenta.divisa,
        cantidad: cantidad,
        fecha: fecha,
      })
    })
  })

  // Insertar en lotes de 100 para evitar problemas de tamaño
  const loteSize = 100
  for (let i = 0; i < registros.length; i += loteSize) {
    const lote = registros.slice(i, i + loteSize)
    const { error } = await supabase
      .from('registro_bancario')
      .insert(lote)

    if (error) {
      console.error('Error al insertar registros de ejemplo:', error)
      throw error
    }
  }
}

