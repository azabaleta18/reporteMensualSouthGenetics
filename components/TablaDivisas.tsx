'use client'

import { useEffect, useState } from 'react'
import { DivisaConEstado, Divisa } from '@/lib/types'
import { obtenerDivisasConEstado, actualizarEstadoDivisa, calcularTotalEnDolares } from '@/lib/divisas'
import { Save, DollarSign } from 'lucide-react'

export default function TablaDivisas() {
  const [divisas, setDivisas] = useState<DivisaConEstado[]>([])
  const [valoresEditados, setValoresEditados] = useState<Record<Divisa, string>>({} as Record<Divisa, string>)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<Divisa | null>(null)
  const [totalDolares, setTotalDolares] = useState(0)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    // Recalcular total cuando cambian las divisas
    const total = calcularTotalEnDolares(divisas)
    setTotalDolares(total)
  }, [divisas])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const data = await obtenerDivisasConEstado()
      setDivisas(data)
      // Inicializar valores editados con los valores actuales
      const valoresIniciales = {} as Record<Divisa, string>
      data.forEach(d => {
        valoresIniciales[d.divisa] = d.cantidad.toString()
      })
      setValoresEditados(valoresIniciales)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCambioValor = (divisa: Divisa, valor: string) => {
    setValoresEditados(prev => ({
      ...prev,
      [divisa]: valor
    }))
  }

  const handleGuardar = async (divisa: Divisa) => {
    const valorStr = valoresEditados[divisa]
    const valor = parseFloat(valorStr)

    if (isNaN(valor) || valor < 0) {
      alert('Por favor ingresa un valor numérico válido mayor o igual a 0')
      return
    }

    try {
      setGuardando(divisa)
      await actualizarEstadoDivisa(divisa, valor)
      
      // Actualizar el estado local
      setDivisas(prev => prev.map(d => {
        if (d.divisa === divisa) {
          const nuevaCantidad = valor
          const nuevoTotalUsd = nuevaCantidad * d.tasa_a_usd
          return {
            ...d,
            cantidad: nuevaCantidad,
            total_usd: nuevoTotalUsd
          }
        }
        return d
      }))
    } catch (error) {
      console.error('Error al guardar:', error)
      alert('Error al guardar el valor. Por favor, intenta nuevamente.')
    } finally {
      setGuardando(null)
    }
  }

  const formatearMonto = (monto: number, simbolo: string) => {
    return `${simbolo} ${monto.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatearTasa = (tasa: number) => {
    if (tasa >= 1) {
      return tasa.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } else {
      return tasa.toLocaleString('es-ES', {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })
    }
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Divisa
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Tasa de Cambio (a USD)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Total en USD
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {divisas.map((divisa) => {
                const valorEditado = valoresEditados[divisa.divisa] || divisa.cantidad.toString()
                const estaGuardando = guardando === divisa.divisa
                const haCambiado = parseFloat(valorEditado) !== divisa.cantidad

                return (
                  <tr 
                    key={divisa.divisa}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {divisa.nombre}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {divisa.divisa}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatearTasa(divisa.tasa_a_usd)} USD
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {divisa.simbolo}
                        </span>
                        <input
                          type="number"
                          value={valorEditado}
                          onChange={(e) => handleCambioValor(divisa.divisa, e.target.value)}
                          step="0.01"
                          min="0"
                          className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatearMonto(divisa.total_usd, 'US$')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleGuardar(divisa.divisa)}
                        disabled={estaGuardando || !haCambiado}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          haCambiado && !estaGuardando
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-4 h-4" />
                        {estaGuardando ? 'Guardando...' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-6 h-6" />
              <h2 className="text-lg font-semibold">Total General en Dólares</h2>
            </div>
            <div className="text-3xl font-bold">
              {formatearMonto(totalDolares, 'US$')}
            </div>
            <p className="text-sm text-green-100 mt-2">
              Suma de todas las divisas convertidas a dólares
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

