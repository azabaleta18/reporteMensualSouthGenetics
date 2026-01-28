'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function MovimientosTodosRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Redirigir a /movimientos preservando todos los parámetros de la URL
    const paramsString = searchParams.toString()
    const newUrl = paramsString ? `/movimientos?${paramsString}` : '/movimientos'
    router.replace(newUrl)
  }, [router, searchParams])

  // Mostrar un mensaje de carga mientras redirige
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600">Redirigiendo a Movimientos...</p>
      </div>
    </div>
  )
}

export default function MovimientosTodosRedirect() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <MovimientosTodosRedirectContent />
    </Suspense>
  )
}
