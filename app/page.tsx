'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TablaUnificada from '@/components/TablaUnificada'
import { COLORES_TABLA } from '@/lib/colores'
import { getSession, signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { LogOut, Loader2 } from 'lucide-react'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    
    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session) {
        setUser(session.user)
      } else {
        setUser(null)
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const checkAuth = async () => {
    try {
      const { user: currentUser } = await getSession()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)
    } catch (error) {
      console.error('Error al verificar autenticación:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORES_TABLA.fondoGeneral }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: COLORES_TABLA.textoGeneral }} />
          <p style={{ color: COLORES_TABLA.textoGeneral }}>Cargando...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORES_TABLA.fondoGeneral }}>
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center mb-8 relative">
          <button
            onClick={handleLogout}
            className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
            style={{ 
              backgroundColor: COLORES_TABLA.botonSecundario,
              color: COLORES_TABLA.textoGeneral
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
          <h1 className="text-4xl font-bold mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
            SouthGenetics - Gestión Financiera
          </h1>
          <p style={{ color: COLORES_TABLA.textoGeneral }}>
            Sistema de gestión de divisas y conversión a dólares
          </p>
        </header>

        <TablaUnificada />
      </div>
    </main>
  )
}

