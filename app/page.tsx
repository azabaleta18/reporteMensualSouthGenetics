'use client'

import TablaDivisas from '@/components/TablaDivisas'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            SouthGenetics - Gestión Financiera
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sistema de gestión de divisas y conversión a dólares
          </p>
        </header>

        <TablaDivisas />
      </div>
    </main>
  )
}

