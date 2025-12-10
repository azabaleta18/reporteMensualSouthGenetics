import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Configuración de la base de datos Supabase real
const SUPABASE_URL = 'https://flretkpedckirupwuhcy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZscmV0a3BlZGNraXJ1cHd1aGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTY0NTMsImV4cCI6MjA3OTU3MjQ1M30.plNXjOdR10vW0MKdP5eXUivDb-YbG27ELchbAIuHT0g'

// Función para crear el cliente de Supabase
function createSupabaseClient(): SupabaseClient {
  // Usar las variables de entorno si existen, si no, usar las credenciales reales
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY
  
  return createClient(url, key)
}

export const supabase = createSupabaseClient()

