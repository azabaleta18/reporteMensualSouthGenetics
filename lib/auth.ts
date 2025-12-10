import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

// Tiempo de expiración en milisegundos (15 minutos)
const SESSION_TIMEOUT = 15 * 60 * 1000
const LAST_ACTIVITY_KEY = 'lastActivityTimestamp'

/**
 * Guarda el timestamp de la última actividad del usuario
 */
export function updateLastActivity(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
  }
}

/**
 * Verifica si la sesión ha expirado por inactividad
 * @returns true si la sesión ha expirado, false si aún es válida
 */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY)
  
  if (!lastActivity) {
    // Si no hay timestamp guardado, considerar como expirado
    return true
  }

  const lastActivityTime = parseInt(lastActivity, 10)
  const now = Date.now()
  const timeSinceLastActivity = now - lastActivityTime

  return timeSinceLastActivity > SESSION_TIMEOUT
}

/**
 * Obtiene la sesión actual verificando si ha expirado por inactividad
 */
export async function getSession(): Promise<{ user: User | null; session: any }> {
  // Verificar si la sesión ha expirado por inactividad
  if (isSessionExpired()) {
    // Si ha expirado, cerrar sesión automáticamente
    await signOut()
    // Limpiar el timestamp de actividad
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LAST_ACTIVITY_KEY)
    }
    return { user: null, session: null }
  }

  // Actualizar el timestamp de actividad al verificar la sesión
  updateLastActivity()

  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error al obtener sesión:', error)
    return { user: null, session: null }
  }

  return { user: session?.user ?? null, session }
}

/**
 * Inicia sesión y guarda el timestamp de actividad
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  // Guardar timestamp de actividad al iniciar sesión
  if (data.user) {
    updateLastActivity()
  }

  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error al cerrar sesión:', error)
    throw error
  }
  
  // Limpiar el timestamp de actividad al cerrar sesión
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LAST_ACTIVITY_KEY)
  }
}

