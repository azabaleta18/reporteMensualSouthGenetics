'use client'

import TablaUnificada from '@/components/TablaUnificada'
import { COLORES_TABLA } from '@/lib/colores'

export default function Home() {
  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORES_TABLA.fondoGeneral }}>
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center mb-8">
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

