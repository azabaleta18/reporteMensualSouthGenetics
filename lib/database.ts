import { supabase } from './supabase'
import { RegistroBancario, ResumenDivisa, Divisa } from './types'

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

  const resumen: Record<Divisa, ResumenDivisa> = {} as Record<Divisa, ResumenDivisa>

  data?.forEach((registro) => {
    if (!resumen[registro.divisa]) {
      resumen[registro.divisa] = {
        divisa: registro.divisa,
        total: 0,
        cantidad_registros: 0,
      }
    }
    resumen[registro.divisa].total += registro.cantidad
    resumen[registro.divisa].cantidad_registros += 1
  })

  return Object.values(resumen)
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

