'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertCircle, Download, Filter } from 'lucide-react'
import { formatearMoneda } from '@/lib/formato-moneda'
import { obtenerTasasCambio } from '@/lib/divisas'
import { DIVISAS } from '@/lib/types'

// Orden específico de divisas
const ORDEN_DIVISAS = ['ARS', 'CLP', 'COP', 'EUR', 'MXN', 'USD', 'UYU']

interface DatoVista {
  id_empresa: number
  nombre_empresa: string
  id_categoria: number
  categoria: string
  concepto: string
  codigo_divisa: string
  nombre_banco: string
  fecha: string
  total_credito: number
  total_debito: number
  neto: number
}

interface Categoria {
  id_categoria: number
  nombre: string
  descripcion: string | null
}

// Estructura de columnas plana
interface Columna {
  divisa: string
  bankKey: string // `${codigo_divisa}||${nombre_banco}||${nombre_empresa}`
  nombre_banco: string
  nombre_empresa: string
  fecha: string | null // null para columna de total
  esTotal: boolean
}

// Estructura de ejes para headers
interface EjesColumnas {
  divisas: string[]
  bankKeysPorDivisa: Map<string, string[]> // divisa -> bankKeys[]
  fechasPorBankKey: Map<string, string[]> // bankKey -> fechas[]
  columnas: Columna[] // Lista plana de todas las columnas en orden
}

export default function TablaPorCategoria() {
  const [datos, setDatos] = useState<DatoVista[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tasasCambio, setTasasCambio] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [filtrosVisibles, setFiltrosVisibles] = useState<boolean>(false)
  const [divisasEnUSD, setDivisasEnUSD] = useState<Set<string>>(new Set())

  useEffect(() => {
    cargarDatos()
    cargarCategorias()
  }, [])

  useEffect(() => {
    if (fechaDesde || fechaHasta) {
      cargarDatos()
    }
  }, [fechaDesde, fechaHasta])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Cargando datos de v_pivot_base_categoria_empresa...')

      // Cargar tasas de cambio
      const tasas = await obtenerTasasCambio()
      const tasasMap = new Map<string, number>()
      tasas.forEach(t => {
        tasasMap.set(t.codigo_divisa, t.unidades_por_usd)
      })
      setTasasCambio(tasasMap)

      // Cargar datos de la vista con paginación
      let todosLosDatos: DatoVista[] = []
      let desde = 0
      const tamañoPagina = 1000
      let hayMasDatos = true

      while (hayMasDatos) {
        let query = supabase
          .from('v_pivot_base_categoria_empresa')
          .select('*')
          .order('fecha', { ascending: true })
          .range(desde, desde + tamañoPagina - 1)

        if (fechaDesde) {
          query = query.gte('fecha', fechaDesde)
        }

        if (fechaHasta) {
          query = query.lte('fecha', fechaHasta)
        }

        const { data: datosPagina, error: errorDatos } = await query

        if (errorDatos) {
          console.error('❌ ERROR en consulta Supabase:', errorDatos)
          throw errorDatos
        }

        if (datosPagina && datosPagina.length > 0) {
          todosLosDatos = [...todosLosDatos, ...datosPagina]

          if (datosPagina.length < tamañoPagina) {
            hayMasDatos = false
          } else {
            desde += tamañoPagina
          }
        } else {
          hayMasDatos = false
        }
      }

      console.log(`✅ Cargados ${todosLosDatos.length} registros de la vista`)
      setDatos(todosLosDatos)
    } catch (err: any) {
      console.error('Error al cargar datos:', err)
      setError(err.message || 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const cargarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categoria_movimiento')
        .select('id_categoria, nombre, descripcion')
        .order('nombre', { ascending: true })

      if (error) {
        console.error('Error al cargar categorías:', error)
        return
      }

      if (data) {
        setCategorias(data)
      }
    } catch (err: any) {
      console.error('Error al cargar categorías:', err)
    }
  }

  // Calcular saldo USD
  const calcularSaldoUSD = (valor: number, codigoDivisa: string): number => {
    if (codigoDivisa === 'USD') {
      return valor
    }
    const unidadesPorUSD = tasasCambio.get(codigoDivisa)
    if (!unidadesPorUSD || unidadesPorUSD === 0) {
      return valor
    }
    return valor / unidadesPorUSD
  }

  // Obtener símbolo de divisa
  const obtenerSimboloDivisa = (codigoDivisa: string): string => {
    const divisaInfo = DIVISAS.find(d => d.codigo === codigoDivisa)
    return divisaInfo?.simbolo || '$'
  }

  // Función buildAxes: construir estructura de columnas
  const buildAxes = useMemo((): EjesColumnas => {
    const divisasSet = new Set<string>()
    const bankKeysSet = new Set<string>()
    const bankKeysPorDivisa = new Map<string, Set<string>>()
    const fechasPorBankKey = new Map<string, Set<string>>()
    const bankInfoMap = new Map<string, { nombre_banco: string; nombre_empresa: string }>()

    // Recorrer datos para construir estructura
    datos.forEach(dato => {
      const divisa = dato.codigo_divisa
      const bankKey = `${divisa}||${dato.nombre_banco}||${dato.nombre_empresa}`

      divisasSet.add(divisa)
      bankKeysSet.add(bankKey)

      if (!bankKeysPorDivisa.has(divisa)) {
        bankKeysPorDivisa.set(divisa, new Set())
      }
      bankKeysPorDivisa.get(divisa)!.add(bankKey)

      if (!fechasPorBankKey.has(bankKey)) {
        fechasPorBankKey.set(bankKey, new Set())
      }
      fechasPorBankKey.get(bankKey)!.add(dato.fecha)

      if (!bankInfoMap.has(bankKey)) {
        bankInfoMap.set(bankKey, {
          nombre_banco: dato.nombre_banco,
          nombre_empresa: dato.nombre_empresa
        })
      }
    })

    // Ordenar divisas según ORDEN_DIVISAS
    const divisasOrdenadas = Array.from(divisasSet).sort((a, b) => {
      const indexA = ORDEN_DIVISAS.indexOf(a)
      const indexB = ORDEN_DIVISAS.indexOf(b)
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      return a.localeCompare(b)
    })

    // Construir lista plana de columnas
    const columnas: Columna[] = []

    divisasOrdenadas.forEach(divisa => {
      const bankKeys = Array.from(bankKeysPorDivisa.get(divisa) || [])
        .sort((a, b) => {
          const infoA = bankInfoMap.get(a)!
          const infoB = bankInfoMap.get(b)!
          const nombreA = `${infoA.nombre_banco} ${infoA.nombre_empresa}`
          const nombreB = `${infoB.nombre_banco} ${infoB.nombre_empresa}`
          return nombreA.localeCompare(nombreB)
        })

      bankKeys.forEach(bankKey => {
        const fechas = Array.from(fechasPorBankKey.get(bankKey) || []).sort()
        const info = bankInfoMap.get(bankKey)!

        // Agregar columnas de fechas
        fechas.forEach(fecha => {
          columnas.push({
            divisa,
            bankKey,
            nombre_banco: info.nombre_banco,
            nombre_empresa: info.nombre_empresa,
            fecha,
            esTotal: false
          })
        })

        // Agregar columna de total del banco
        columnas.push({
          divisa,
          bankKey,
          nombre_banco: info.nombre_banco,
          nombre_empresa: info.nombre_empresa,
          fecha: null,
          esTotal: true
        })
      })
    })

    // Convertir Sets a Arrays para el resultado
    const bankKeysPorDivisaArray = new Map<string, string[]>()
    bankKeysPorDivisa.forEach((set, divisa) => {
      bankKeysPorDivisaArray.set(divisa, Array.from(set))
    })

    const fechasPorBankKeyArray = new Map<string, string[]>()
    fechasPorBankKey.forEach((set, bankKey) => {
      fechasPorBankKeyArray.set(bankKey, Array.from(set).sort())
    })

    return {
      divisas: divisasOrdenadas,
      bankKeysPorDivisa: bankKeysPorDivisaArray,
      fechasPorBankKey: fechasPorBankKeyArray,
      columnas
    }
  }, [datos])

  // Función buildValueMap: construir mapa O(1) de valores
  const buildValueMap = useMemo(() => {
    const mapa = new Map<number, Map<string, number>>() // categoriaId -> bankKey|fecha -> neto

    datos.forEach(dato => {
      const categoriaId = dato.id_categoria
      const bankKey = `${dato.codigo_divisa}||${dato.nombre_banco}||${dato.nombre_empresa}`
      const key = `${bankKey}|${dato.fecha}`

      if (!mapa.has(categoriaId)) {
        mapa.set(categoriaId, new Map())
      }

      const categoriaMap = mapa.get(categoriaId)!
      const valorActual = categoriaMap.get(key) || 0
      categoriaMap.set(key, valorActual + dato.neto)
    })

    return mapa
  }, [datos])

  // Obtener categorías ordenadas
  const categoriasOrdenadas = useMemo(() => {
    const mapa = new Map<number, { id_categoria: number; nombre: string; descripcion: string | null }>()

    datos.forEach(dato => {
      if (!mapa.has(dato.id_categoria)) {
        const categoria = categorias.find(c => c.id_categoria === dato.id_categoria) || {
          id_categoria: dato.id_categoria,
          nombre: dato.categoria,
          descripcion: null
        }
        mapa.set(dato.id_categoria, {
          id_categoria: categoria.id_categoria,
          nombre: categoria.nombre,
          descripcion: categoria.descripcion
        })
      }
    })

    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [datos, categorias])

  // Obtener valor de una celda desde el mapa
  const obtenerValorDesdeMapa = (
    idCategoria: number,
    bankKey: string,
    fecha: string | null
  ): number => {
    const categoriaMap = buildValueMap.get(idCategoria)
    if (!categoriaMap) return 0

    if (fecha === null) {
      // Total del banco: sumar todas las fechas de ese banco
      let total = 0
      categoriaMap.forEach((valor, key) => {
        if (key.startsWith(`${bankKey}|`)) {
          total += valor
        }
      })
      return total
    }

    const key = `${bankKey}|${fecha}`
    return categoriaMap.get(key) || 0
  }

  const toggleDivisaEnUSD = (codigoDivisa: string) => {
    setDivisasEnUSD(prev => {
      const newSet = new Set(prev)
      if (newSet.has(codigoDivisa)) {
        newSet.delete(codigoDivisa)
      } else {
        newSet.add(codigoDivisa)
      }
      return newSet
    })
  }

  if (loading && datos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-red-900 font-semibold mb-1">Error al cargar datos</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con botones */}
      <div className="bg-white rounded-lg shadow-md p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Reporte por Categoría</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltrosVisibles(!filtrosVisibles)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            onClick={() => {
              // TODO: Implementar exportación
              alert('Exportación en desarrollo')
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      {filtrosVisibles && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-20">
              {/* Fila 1: Divisas */}
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-100 z-30 border-r border-gray-300">
                  Categoría
                </th>
                {buildAxes.divisas.map(divisa => {
                  const bankKeys = buildAxes.bankKeysPorDivisa.get(divisa) || []
                  const numColumnas = bankKeys.reduce((sum, bankKey) => {
                    const fechas = buildAxes.fechasPorBankKey.get(bankKey) || []
                    return sum + fechas.length + 1 // +1 para total del banco
                  }, 0)

                  return (
                    <th
                      key={divisa}
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-l-2 border-gray-400"
                      colSpan={numColumnas}
                    >
                      {divisa}
                      {divisasEnUSD.has(divisa) && divisa !== 'USD' && ' (USD)'}
                    </th>
                  )
                })}
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 bg-gray-200 border-l-2 border-gray-400">
                  TOTAL USD
                </th>
              </tr>

              {/* Fila 2: Bancos + Empresas */}
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-[56px] z-20">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 sticky left-0 bg-gray-50 z-30 border-r border-gray-300"></th>
                {buildAxes.divisas.map(divisa => {
                  const bankKeys = buildAxes.bankKeysPorDivisa.get(divisa) || []

                  return (
                    <React.Fragment key={`sub-${divisa}`}>
                      {bankKeys.map(bankKey => {
                        const fechas = buildAxes.fechasPorBankKey.get(bankKey) || []
                        const numColumnas = fechas.length + 1 // fechas + total
                        const partes = bankKey.split('||')
                        const nombreBanco = partes[1] || ''
                        const nombreEmpresa = partes[2] || ''

                        return (
                          <th
                            key={bankKey}
                            className="px-4 py-2 text-center text-xs font-medium text-gray-600 border-l-2 border-gray-400"
                            colSpan={numColumnas}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold">{nombreBanco}</span>
                              {nombreEmpresa && (
                                <span className="text-[10px] text-gray-500">{nombreEmpresa}</span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-900 bg-gray-200 border-l-2 border-gray-400">
                  Balance
                </th>
              </tr>

              {/* Fila 3: Fechas */}
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-[112px] z-20">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 sticky left-0 bg-gray-50 z-30 border-r border-gray-300"></th>
                {buildAxes.columnas.map((columna, idx) => {
                  if (columna.esTotal) {
                    return (
                      <th
                        key={`total-${columna.bankKey}-${idx}`}
                        className="px-2 py-1 text-center text-[10px] font-medium text-gray-900 bg-gray-100 border-l border-gray-400"
                      >
                        Total
                      </th>
                    )
                  }

                  return (
                    <th
                      key={`${columna.bankKey}-${columna.fecha}`}
                      className={`px-2 py-1 text-center text-[10px] font-medium text-gray-600 ${
                        idx === 0 || buildAxes.columnas[idx - 1]?.bankKey !== columna.bankKey
                          ? 'border-l-2 border-gray-400'
                          : 'border-l border-gray-300'
                      }`}
                      title={new Date(columna.fecha! + 'T00:00:00').toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    >
                      {new Date(columna.fecha! + 'T00:00:00').toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </th>
                  )
                })}
                <th className="px-2 py-1 text-center text-[10px] font-medium text-gray-900 bg-gray-200 border-l-2 border-gray-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {categoriasOrdenadas.map((categoria) => {
                return (
                  <tr key={categoria.id_categoria} className="border-b border-gray-200 hover:bg-gray-50 bg-white">
                    <td className="px-4 py-3 text-sm text-gray-900 font-semibold sticky left-0 bg-white z-10 border-r border-gray-300">
                      <span>{categoria.nombre}</span>
                      {categoria.descripcion && (
                        <span className="text-xs text-gray-500 ml-2">({categoria.descripcion})</span>
                      )}
                    </td>
                    {buildAxes.columnas.map((columna, idx) => {
                      const valor = obtenerValorDesdeMapa(categoria.id_categoria, columna.bankKey, columna.fecha)
                      const divisaInfo = DIVISAS.find(d => d.codigo === columna.divisa)
                      const simboloDivisa = divisaInfo?.simbolo || '$'
                      const mostrarEnUSD = divisasEnUSD.has(columna.divisa) || columna.divisa === 'USD'
                      const valorMostrar = mostrarEnUSD ? calcularSaldoUSD(valor, columna.divisa) : valor
                      const simboloMostrar = mostrarEnUSD ? '$' : simboloDivisa

                      return (
                        <td
                          key={`${categoria.id_categoria}-${columna.bankKey}-${columna.fecha || 'total'}-${idx}`}
                          className={`px-2 py-2 text-sm text-right text-gray-700 whitespace-nowrap ${
                            columna.esTotal ? 'font-semibold bg-gray-50' : ''
                          } ${
                            idx === 0 || buildAxes.columnas[idx - 1]?.bankKey !== columna.bankKey
                              ? 'border-l-2 border-gray-400'
                              : 'border-l border-gray-300'
                          }`}
                        >
                          {formatearMoneda(valorMostrar || 0, simboloMostrar, 2)}
                        </td>
                      )
                    })}
                    {/* Total USD de la categoría */}
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-bold bg-gray-200 border-l-2 border-gray-400 whitespace-nowrap">
                      {(() => {
                        const totalUSD = buildAxes.divisas.reduce((sum, divisa) => {
                          const bankKeys = buildAxes.bankKeysPorDivisa.get(divisa) || []
                          return sum + bankKeys.reduce((sumBanco, bankKey) => {
                            const fechas = buildAxes.fechasPorBankKey.get(bankKey) || []
                            return sumBanco + fechas.reduce((sumFecha, fecha) => {
                              const valor = obtenerValorDesdeMapa(categoria.id_categoria, bankKey, fecha)
                              return sumFecha + calcularSaldoUSD(valor, divisa)
                            }, 0)
                          }, 0)
                        }, 0)
                        return formatearMoneda(totalUSD, '$', 2)
                      })()}
                    </td>
                  </tr>
                )
              })}

              {/* Fila de totales generales */}
              <tr className="bg-yellow-50 border-t-4 border-yellow-400">
                <td className="px-4 py-3 text-sm text-gray-900 font-bold sticky left-0 bg-yellow-50 z-10 border-r border-gray-300">
                  TOTAL GENERAL
                </td>
                {buildAxes.columnas.map((columna, idx) => {
                  const total = categoriasOrdenadas.reduce((sum, categoria) => {
                    const valor = obtenerValorDesdeMapa(categoria.id_categoria, columna.bankKey, columna.fecha)
                    return sum + valor
                  }, 0)

                  const divisaInfo = DIVISAS.find(d => d.codigo === columna.divisa)
                  const simboloDivisa = divisaInfo?.simbolo || '$'
                  const mostrarEnUSD = divisasEnUSD.has(columna.divisa) || columna.divisa === 'USD'
                  const valorMostrar = mostrarEnUSD ? calcularSaldoUSD(total, columna.divisa) : total
                  const simboloMostrar = mostrarEnUSD ? '$' : simboloDivisa

                  return (
                    <td
                      key={`total-${columna.bankKey}-${columna.fecha || 'total'}-${idx}`}
                      className={`px-2 py-3 text-sm text-right text-gray-900 font-bold ${
                        columna.esTotal ? 'bg-yellow-100' : ''
                      } ${
                        idx === 0 || buildAxes.columnas[idx - 1]?.bankKey !== columna.bankKey
                          ? 'border-l-2 border-gray-400'
                          : 'border-l border-gray-300'
                      }`}
                    >
                      {formatearMoneda(valorMostrar || 0, simboloMostrar, 2)}
                    </td>
                  )
                })}
                {/* Total USD general */}
                <td className="px-4 py-3 text-sm text-right text-gray-900 font-bold bg-yellow-200 border-l-2 border-gray-400">
                  {(() => {
                    const totalUSD = buildAxes.divisas.reduce((sum, divisa) => {
                      const bankKeys = buildAxes.bankKeysPorDivisa.get(divisa) || []
                      return sum + bankKeys.reduce((sumBanco, bankKey) => {
                        const fechas = buildAxes.fechasPorBankKey.get(bankKey) || []
                        return sumBanco + fechas.reduce((sumFecha, fecha) => {
                          const total = categoriasOrdenadas.reduce((sumCat, categoria) => {
                            const valor = obtenerValorDesdeMapa(categoria.id_categoria, bankKey, fecha)
                            return sumCat + calcularSaldoUSD(valor, divisa)
                          }, 0)
                          return sumFecha + total
                        }, 0)
                      }, 0)
                    }, 0)
                    return formatearMoneda(totalUSD, '$', 2)
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


