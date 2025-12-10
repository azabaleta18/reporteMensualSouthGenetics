'use client'

import { useEffect, useState } from 'react'
import { DivisaConEstado, Divisa, BANCOS_POR_DIVISA } from '@/lib/types'
import { obtenerDivisasConEstado, actualizarEstadoDivisa, calcularTotalEnDolares } from '@/lib/divisas'
import { obtenerRegistrosPorBancoYDivisa } from '@/lib/database'
import { RegistroBancario } from '@/lib/types'
import { Save, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'

export default function TablaDivisas() {
  const [divisas, setDivisas] = useState<DivisaConEstado[]>([])
  const [valoresEditados, setValoresEditados] = useState<Record<Divisa, string>>({} as Record<Divisa, string>)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<Divisa | null>(null)
  const [totalDolares, setTotalDolares] = useState(0)
  const [registrosPorDivisa, setRegistrosPorDivisa] = useState<Record<Divisa, Record<string, RegistroBancario[]>>>({} as Record<Divisa, Record<string, RegistroBancario[]>>)
  const [dropdownsAbiertos, setDropdownsAbiertos] = useState<Record<Divisa, boolean>>({} as Record<Divisa, boolean>)
  const [cargandoRegistros, setCargandoRegistros] = useState<Record<Divisa, boolean>>({} as Record<Divisa, boolean>)

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
      // Inicializar dropdowns cerrados
      const dropdownsIniciales = {} as Record<Divisa, boolean>
      data.forEach(d => {
        dropdownsIniciales[d.divisa] = false
      })
      setDropdownsAbiertos(dropdownsIniciales)
      // Inicializar estado de carga de registros
      const cargandoIniciales = {} as Record<Divisa, boolean>
      data.forEach(d => {
        cargandoIniciales[d.divisa] = false
      })
      setCargandoRegistros(cargandoIniciales)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarRegistrosDivisa = async (divisa: Divisa) => {
    // Si ya están cargados, no volver a cargar
    if (registrosPorDivisa[divisa]) {
      return
    }

    try {
      setCargandoRegistros(prev => ({ ...prev, [divisa]: true }))
      const registros = await obtenerRegistrosPorBancoYDivisa(divisa)
      setRegistrosPorDivisa(prev => ({
        ...prev,
        [divisa]: registros
      }))
    } catch (error) {
      console.error('Error al cargar registros:', error)
    } finally {
      setCargandoRegistros(prev => ({ ...prev, [divisa]: false }))
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
          // tasa_a_usd contiene unidades_por_usd, por lo que debemos dividir
          const nuevoTotalUsd = d.divisa === 'USD' ? nuevaCantidad : nuevaCantidad / d.tasa_a_usd
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

  const toggleDropdown = async (divisa: Divisa) => {
    const nuevoEstado = !dropdownsAbiertos[divisa]
    setDropdownsAbiertos(prev => ({
      ...prev,
      [divisa]: nuevoEstado
    }))
    
    // Si se está abriendo y no hay registros cargados, cargarlos
    if (nuevoEstado && !registrosPorDivisa[divisa]) {
      await cargarRegistrosDivisa(divisa)
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
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {divisa.nombre}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {divisa.divisa}
                            </div>
                          </div>
                          {BANCOS_POR_DIVISA[divisa.divisa] && BANCOS_POR_DIVISA[divisa.divisa].length > 0 && (
                            <button
                              onClick={() => toggleDropdown(divisa.divisa)}
                              className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Ver bancos"
                            >
                              {dropdownsAbiertos[divisa.divisa] ? (
                                <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              )}
                            </button>
                          )}
                        </div>
                        {dropdownsAbiertos[divisa.divisa] && BANCOS_POR_DIVISA[divisa.divisa] && BANCOS_POR_DIVISA[divisa.divisa].length > 0 && (
                          <div className="mt-2 ml-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600">
                            {cargandoRegistros[divisa.divisa] ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">Cargando registros...</div>
                            ) : (
                              <div className="space-y-3">
                                {BANCOS_POR_DIVISA[divisa.divisa].map((banco) => {
                                  const registrosBanco = registrosPorDivisa[divisa.divisa]?.[banco] || []
                                  const totalBanco = registrosBanco.reduce((sum, r) => sum + r.cantidad, 0)
                                  
                                  return (
                                    <div key={banco} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0 pb-2 last:pb-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                          {banco}
                                        </div>
                                        <div className="text-xs font-medium text-gray-900 dark:text-white">
                                          Total: {formatearMonto(totalBanco, divisa.simbolo)}
                                        </div>
                                      </div>
                                      {registrosBanco.length > 0 ? (
                                        <div className="ml-2 space-y-1">
                                          {registrosBanco.map((registro) => (
                                            <div key={registro.id} className="text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                                              <span>
                                                {new Date(registro.fecha).toLocaleDateString('es-ES', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric'
                                                })}
                                              </span>
                                              <span className="ml-2">
                                                {formatearMonto(registro.cantidad, divisa.simbolo)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-400 dark:text-gray-500 ml-2 italic">
                                          Sin registros
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
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

