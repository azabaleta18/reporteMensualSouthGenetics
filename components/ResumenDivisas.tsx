'use client'

import { useEffect, useState } from 'react'
import { ResumenDivisa, DIVISAS } from '@/lib/types'
import { obtenerResumenPorDivisa, obtenerTotalGeneral } from '@/lib/database'
import { DollarSign, TrendingUp } from 'lucide-react'

export default function ResumenDivisas() {
  const [resumenes, setResumenes] = useState<ResumenDivisa[]>([])
  const [totalGeneral, setTotalGeneral] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const [resumenesData, total] = await Promise.all([
        obtenerResumenPorDivisa(),
        obtenerTotalGeneral(),
      ])
      setResumenes(resumenesData)
      setTotalGeneral(total)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const obtenerInfoDivisa = (codigo: string) => {
    return DIVISAS.find((d) => d.codigo === codigo) || {
      codigo: codigo as any,
      nombre: codigo,
      simbolo: '',
    }
  }

  const formatearMonto = (monto: number, simbolo: string) => {
    return `${simbolo} ${monto.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DIVISAS.map((divisa) => {
          const resumen = resumenes.find((r) => r.divisa === divisa.codigo)
          const total = resumen?.total || 0

          return (
            <div
              key={divisa.codigo}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {divisa.nombre}
                </h3>
                <DollarSign className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatearMonto(total, divisa.simbolo)}
              </div>
              {resumen && resumen.cantidad_registros > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {resumen.cantidad_registros} registro{resumen.cantidad_registros !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-6 h-6" />
              <h2 className="text-lg font-semibold">Total General</h2>
            </div>
            <div className="text-3xl font-bold">
              {formatearMonto(totalGeneral, 'US$')}
            </div>
            <p className="text-sm text-blue-100 mt-2">
              Suma de todos los registros bancarios
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

