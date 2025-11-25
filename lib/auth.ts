import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export async function getSession(): Promise<{ user: User | null; session: any }> {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error al obtener sesión:', error)
    return { user: null, session: null }
  }

  return { user: session?.user ?? null, session }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error al cerrar sesión:', error)
    throw error
  }
}

