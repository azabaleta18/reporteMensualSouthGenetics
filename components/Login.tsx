'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { COLORES_TABLA } from '@/lib/colores'
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react'
import { getSession } from '@/lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Verificar si ya está autenticado
    const checkAuth = async () => {
      const { user } = await getSession()
      if (user) {
        router.push('/')
      }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError('Error al iniciar sesión. Por favor, intenta nuevamente.')
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORES_TABLA.fondoGeneral }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: COLORES_TABLA.textoGeneral }} />
          <p style={{ color: COLORES_TABLA.textoGeneral }}>Verificando sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORES_TABLA.fondoGeneral }}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
            SouthGenetics
          </h2>
          <p style={{ color: COLORES_TABLA.textoGeneral }}>
            Inicia sesión para acceder al sistema
          </p>
        </div>

        <div className="rounded-xl shadow-lg overflow-hidden border" style={{ backgroundColor: COLORES_TABLA.fondoFila, borderColor: COLORES_TABLA.bordeGeneral }}>
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="p-3 rounded-md border" style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5' }}>
                  <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5" style={{ color: COLORES_TABLA.textoGeneral }} />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border rounded-md"
                    style={{ 
                      backgroundColor: COLORES_TABLA.fondoMonto,
                      borderColor: COLORES_TABLA.bordeEncabezado,
                      color: COLORES_TABLA.textoGeneral
                    }}
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5" style={{ color: COLORES_TABLA.textoGeneral }} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border rounded-md"
                    style={{ 
                      backgroundColor: COLORES_TABLA.fondoMonto,
                      borderColor: COLORES_TABLA.bordeEncabezado,
                      color: COLORES_TABLA.textoGeneral
                    }}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium transition-colors"
                  style={{ 
                    backgroundColor: loading ? COLORES_TABLA.botonSecundario : COLORES_TABLA.botonPrincipal,
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      Iniciar sesión
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

