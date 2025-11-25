import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Función para crear el cliente de Supabase de forma segura
function createSupabaseClient(): SupabaseClient {
  // Si no hay variables de entorno, usar valores placeholder para evitar errores durante el build
  // Estos valores solo se usarán durante el prerenderizado, nunca en runtime
  const url = supabaseUrl || 'https://placeholder.supabase.co'
  const key = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder'
  
  return createClient(url, key)
}

export const supabase = createSupabaseClient()

