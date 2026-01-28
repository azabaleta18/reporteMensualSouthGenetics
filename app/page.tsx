'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { LogOut, Loader2 } from 'lucide-react'
import TablaDivisasDiarias from '@/components/TablaDivisasDiarias'
import MenuNavegacion from '@/components/MenuNavegacion'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    
    // Escuchar cambios en la autenticación
    try {
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
    } catch (error) {
      console.error('Error al configurar listener de autenticación:', error)
      setLoading(false)
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
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Menú de navegación */}
      <MenuNavegacion />
      
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header con botón de cerrar sesión */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                SouthGenetics - Gestión Financiera
              </h1>
              <p className="text-gray-600">
                Sistema de saldos diarios por divisa
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de divisas diarias */}
        <TablaDivisasDiarias />
      </div>
    </main>
  )
}

