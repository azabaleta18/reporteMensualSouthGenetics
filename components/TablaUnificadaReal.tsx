'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Divisa, DIVISAS } from '@/lib/types'
import { obtenerTasasCambio } from '@/lib/divisas'
import { obtenerDatosReporte, CuentaCompleta } from '@/lib/database-real'
import { ChevronRight, ChevronDown, DollarSign, Eye, EyeOff, Calendar } from 'lucide-react'
import { COLORES_TABLA } from '@/lib/colores'
import PanelFiltros from './PanelFiltros'
import BotonExportar from './BotonExportar'
import EditorTasasCambio from './EditorTasasCambio'
import { FiltrosReporte, FILTROS_INICIALES } from '@/lib/filtros'
import { OpcionesExportacion } from '@/lib/exportacion'

export interface DatosPorFecha {
  fecha: string
  valores: Record<string, number> // clave: id_cuenta (como string), valor: saldo
  totalesPorDivisa: Record<Divisa, number>
  totalUSD: number
  esAgrupacion?: boolean
  mesAnio?: string
  fechasAgrupadas?: string[]
}

export default function TablaUnificadaReal() {
  const [saldosPorFecha, setSaldosPorFecha] = useState<Record<string, Array<{
    id_cuenta: number
    nombre_cuenta: string
    banco: string
    divisa: Divisa
    saldo_divisa: number
    saldo_usd: number
  }>>>({})
  const [cuentas, setCuentas] = useState<CuentaCompleta[]>([])
  const [tasasCambio, setTasasCambio] = useState<Record<Divisa, number>>({} as Record<Divisa, number>)
  const [loading, setLoading] = useState(true)
  const [divisasExpandidas, setDivisasExpandidas] = useState<Record<Divisa, boolean>>({
    ARS: false, CLP: false, COP: false, EUR: false, MXN: false, UYU: false, USD: false
  })
  const [divisasTodasCuentas, setDivisasTodasCuentas] = useState<Record<Divisa, boolean>>({
    ARS: false, CLP: false, COP: false, EUR: false, MXN: false, UYU: false, USD: false
  })
  const [divisasEnUSD, setDivisasEnUSD] = useState<Record<Divisa, boolean>>({
    ARS: false, CLP: false, COP: false, EUR: false, MXN: false, UYU: false, USD: false
  })
  const [modoResumen, setModoResumen] = useState(false)
  const [agruparPorMes, setAgruparPorMes] = useState(true)
  const [mesesExpandidos, setMesesExpandidos] = useState<Record<string, boolean>>({})
  const [todoEnUSD, setTodoEnUSD] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosReporte>(FILTROS_INICIALES)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [filtros])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      // Si no hay fecha hasta definida, usar hoy
      const hoy = new Date().toISOString().split('T')[0]
      const [datosReporte, tasas] = await Promise.all([
        obtenerDatosReporte(
          filtros.fechaDesde || undefined,
          filtros.fechaHasta || hoy,
          filtros.divisas.length > 0 ? filtros.divisas : undefined
        ),
        obtenerTasasCambio(),
      ])
      
      setSaldosPorFecha(datosReporte.saldosPorFecha)
      setCuentas(datosReporte.cuentas)
      
      const tasasMap: Record<Divisa, number> = {} as Record<Divisa, number>
      tasas.forEach(t => {
        tasasMap[t.codigo_divisa as Divisa] = t.unidades_por_usd
      })
      setTasasCambio(tasasMap)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDivisa = (divisa: Divisa) => {
    setDivisasExpandidas(prev => ({
      ...prev,
      [divisa]: !prev[divisa]
    }))
  }

  const toggleTodasCuentas = (divisa: Divisa) => {
    setDivisasTodasCuentas(prev => ({
      ...prev,
      [divisa]: !prev[divisa]
    }))
  }

  const toggleDivisaUSD = (divisa: Divisa) => {
    setDivisasEnUSD(prev => ({
      ...prev,
      [divisa]: !prev[divisa]
    }))
  }

  const toggleTodoEnUSD = () => {
    const nuevoEstado = !todoEnUSD
    setTodoEnUSD(nuevoEstado)
    if (nuevoEstado) {
      const nuevasDivisasEnUSD: Record<Divisa, boolean> = {
        ARS: true, CLP: true, COP: true, EUR: true, MXN: true, UYU: true, USD: false
      }
      setDivisasEnUSD(nuevasDivisasEnUSD)
    } else {
      setDivisasEnUSD({
        ARS: false, CLP: false, COP: false, EUR: false, MXN: false, UYU: false, USD: false
      })
    }
  }

  const obtenerSimboloDivisa = (divisa: Divisa) => {
    const infoDivisa = DIVISAS.find(d => d.codigo === divisa)
    return infoDivisa?.simbolo || ''
  }

  const convertirAUSD = (cantidad: number, divisa: Divisa): number => {
    const tasa = tasasCambio[divisa] || 1
    // Como es unidades_por_usd, dividimos
    return cantidad / tasa
  }

  function obtenerMesAnio(fecha: string) {
    const d = new Date(fecha + 'T00:00:00')
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  function obtenerNombreMes(mesAnio: string) {
    const [anio, mes] = mesAnio.split('-')
    const fecha = new Date(parseInt(anio), parseInt(mes) - 1, 1)
    return fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  const toggleMes = (mesAnio: string) => {
    setMesesExpandidos(prev => ({
      ...prev,
      [mesAnio]: !prev[mesAnio]
    }))
  }

  // Obtener divisas a mostrar según filtros
  const divisasAMostrar = useMemo(() => {
    if (filtros.divisas.length === 0) {
      return DIVISAS
    }
    return DIVISAS.filter(d => filtros.divisas.includes(d.codigo))
  }, [filtros.divisas])

  // Obtener cuentas agrupadas por divisa
  const cuentasPorDivisa = useMemo(() => {
    const agrupadas: Record<Divisa, CuentaCompleta[]> = {
      ARS: [], CLP: [], COP: [], EUR: [], MXN: [], UYU: [], USD: []
    }
    cuentas.forEach(cuenta => {
      const divisa = cuenta.codigo_divisa as Divisa
      if (agrupadas[divisa]) {
        agrupadas[divisa].push(cuenta)
      }
    })
    return agrupadas
  }, [cuentas])

  // Identificar cuentas con movimientos (que aparecen en saldosPorFecha)
  const cuentasConMovimientos = useMemo(() => {
    const cuentasIds = new Set<number>()
    Object.values(saldosPorFecha).forEach(saldos => {
      saldos.forEach(saldo => {
        cuentasIds.add(saldo.id_cuenta)
      })
    })
    return cuentasIds
  }, [saldosPorFecha])

  // Obtener cuentas a mostrar por divisa (con o sin movimientos según el estado)
  const cuentasAMostrarPorDivisa = useMemo(() => {
    const resultado: Record<Divisa, CuentaCompleta[]> = {
      ARS: [], CLP: [], COP: [], EUR: [], MXN: [], UYU: [], USD: []
    }
    
    Object.keys(cuentasPorDivisa).forEach(divisa => {
      const divisaCodigo = divisa as Divisa
      const todasLasCuentas = cuentasPorDivisa[divisaCodigo]
      
      if (divisasTodasCuentas[divisaCodigo]) {
        // Mostrar todas las cuentas
        resultado[divisaCodigo] = todasLasCuentas
      } else {
        // Mostrar solo cuentas con movimientos
        resultado[divisaCodigo] = todasLasCuentas.filter(cuenta => 
          cuentasConMovimientos.has(cuenta.id_cuenta)
        )
      }
    })
    
    return resultado
  }, [cuentasPorDivisa, divisasTodasCuentas, cuentasConMovimientos])

  const datosProcesados = useMemo(() => {
    const fechas = Object.keys(saldosPorFecha).sort()
    const datos: DatosPorFecha[] = []

    if (agruparPorMes) {
      // Agrupar por mes
      const fechasPorMes: Record<string, string[]> = {}
      fechas.forEach((fecha) => {
        const mesAnio = obtenerMesAnio(fecha)
        if (!fechasPorMes[mesAnio]) {
          fechasPorMes[mesAnio] = []
        }
        fechasPorMes[mesAnio].push(fecha)
      })

      Object.keys(fechasPorMes).sort().forEach((mesAnio) => {
        const fechasDelMes = fechasPorMes[mesAnio].sort()
        const ultimaFecha = fechasDelMes[fechasDelMes.length - 1]
        const saldosUltimaFecha = saldosPorFecha[ultimaFecha] || []

        const valoresMes: Record<string, number> = {}
        const totalesPorDivisaMes: Record<Divisa, number> = {
          ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
        }

        saldosUltimaFecha.forEach(saldo => {
          valoresMes[saldo.id_cuenta.toString()] = saldo.saldo_divisa
          totalesPorDivisaMes[saldo.divisa] += saldo.saldo_divisa
        })

        let totalUSD = 0
        Object.entries(totalesPorDivisaMes).forEach(([divisa, cantidad]) => {
          totalUSD += convertirAUSD(cantidad, divisa as Divisa)
        })

        // Fila de agrupación por mes
        datos.push({
          fecha: ultimaFecha,
          valores: valoresMes,
          totalesPorDivisa: totalesPorDivisaMes,
          totalUSD,
          esAgrupacion: true,
          mesAnio,
          fechasAgrupadas: fechasDelMes
        })

        // Si el mes está expandido, agregar fechas individuales
        if (mesesExpandidos[mesAnio]) {
          fechasDelMes.forEach(fecha => {
            const saldosFecha = saldosPorFecha[fecha] || []
            const valoresFecha: Record<string, number> = {}
            const totalesPorDivisaFecha: Record<Divisa, number> = {
              ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
            }

            saldosFecha.forEach(saldo => {
              valoresFecha[saldo.id_cuenta.toString()] = saldo.saldo_divisa
              totalesPorDivisaFecha[saldo.divisa] += saldo.saldo_divisa
            })

            let totalUSDFecha = 0
            Object.entries(totalesPorDivisaFecha).forEach(([divisa, cantidad]) => {
              totalUSDFecha += convertirAUSD(cantidad, divisa as Divisa)
            })

            datos.push({
              fecha,
              valores: valoresFecha,
              totalesPorDivisa: totalesPorDivisaFecha,
              totalUSD: totalUSDFecha,
              esAgrupacion: false
            })
          })
        }
      })
    } else {
      // Sin agrupar, mostrar todas las fechas
      fechas.forEach(fecha => {
        const saldosFecha = saldosPorFecha[fecha] || []
        const valoresFecha: Record<string, number> = {}
        const totalesPorDivisaFecha: Record<Divisa, number> = {
          ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
        }

        saldosFecha.forEach(saldo => {
          valoresFecha[saldo.id_cuenta.toString()] = saldo.saldo_divisa
          totalesPorDivisaFecha[saldo.divisa] += saldo.saldo_divisa
        })

        let totalUSDFecha = 0
        Object.entries(totalesPorDivisaFecha).forEach(([divisa, cantidad]) => {
          totalUSDFecha += convertirAUSD(cantidad, divisa as Divisa)
        })

        datos.push({
          fecha,
          valores: valoresFecha,
          totalesPorDivisa: totalesPorDivisaFecha,
          totalUSD: totalUSDFecha,
          esAgrupacion: false
        })
      })
    }

    return datos
  }, [saldosPorFecha, agruparPorMes, mesesExpandidos, tasasCambio])

  const opcionesExportacion: OpcionesExportacion = {
    datos: datosProcesados,
    divisas: divisasAMostrar.map(d => d.codigo),
    divisasAMostrar: divisasAMostrar.map(d => d.codigo),
    cuentasPorDivisa: cuentasAMostrarPorDivisa,
    divisasExpandidas,
    divisasEnUSD,
    tasasCambio,
    obtenerSimboloDivisa,
    convertirAUSD,
    modoResumen
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORES_TABLA.fondoGeneral }}>
      <div className="p-5 border-b" style={{ backgroundColor: COLORES_TABLA.fondoEncabezado, borderColor: COLORES_TABLA.bordeGeneral }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: COLORES_TABLA.textoGeneral }}>
            Reporte Mensual de Divisas
          </h2>
          <BotonExportar opciones={opcionesExportacion} />
        </div>
        <PanelFiltros filtros={filtros} onFiltrosChange={setFiltros} />
        <EditorTasasCambio onTasasActualizadas={(nuevasTasas) => {
          setTasasCambio(nuevasTasas)
        }} />
        <div className="flex items-center gap-3 flex-wrap mt-4">
          <button
            onClick={() => setAgruparPorMes(!agruparPorMes)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            style={{ backgroundColor: COLORES_TABLA.botonPrincipal }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal}
          >
            <Calendar className="w-4 h-4" />
            {agruparPorMes ? 'Ver por Días' : 'Agrupar por Mes'}
          </button>
          <button
            onClick={toggleTodoEnUSD}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            style={{ backgroundColor: todoEnUSD ? COLORES_TABLA.botonPrincipal : COLORES_TABLA.botonSecundario }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = todoEnUSD ? COLORES_TABLA.botonPrincipal : COLORES_TABLA.botonSecundario}
          >
            <DollarSign className="w-4 h-4" />
            {todoEnUSD ? 'Mostrar Monedas Originales' : 'Convertir Todo a USD'}
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="overflow-x-auto custom-scrollbar" style={{ maxWidth: '100%' }}>
          <table className="w-full border-collapse" style={{ minWidth: '1200px' }}>
            <thead>
              {/* Encabezados principales */}
              <tr>
                <th
                  className="border px-3 py-2 text-sm font-semibold text-left sticky left-0 z-10"
                  style={{
                    backgroundColor: COLORES_TABLA.fondoEncabezado,
                    borderColor: COLORES_TABLA.bordeEncabezado,
                    color: COLORES_TABLA.textoGeneral,
                  }}
                >
                  Fecha
                </th>
                {divisasAMostrar.map((divisaInfo, idx) => {
                  const cuentasDivisa = cuentasAMostrarPorDivisa[divisaInfo.codigo] || []
                  const todasLasCuentas = cuentasPorDivisa[divisaInfo.codigo] || []
                  const numColumnas = divisasExpandidas[divisaInfo.codigo] ? cuentasDivisa.length + 1 : 1
                  const esAlterna = idx % 2 === 1
                  const hayMasCuentas = todasLasCuentas.length > cuentasDivisa.length
                  
                  return (
                    <th
                      key={divisaInfo.codigo}
                      colSpan={numColumnas}
                      className="border px-3 py-2 text-sm font-semibold text-center"
                      style={{
                        backgroundColor: esAlterna ? COLORES_TABLA.fondoEncabezadoAlterno : COLORES_TABLA.fondoTotalDivisa,
                        borderColor: COLORES_TABLA.bordeEncabezado,
                        color: COLORES_TABLA.textoGeneral,
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>{divisaInfo.codigo}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleDivisaUSD(divisaInfo.codigo)
                          }}
                          className="px-2 py-1 text-xs rounded transition-colors"
                          style={{
                            backgroundColor: divisasEnUSD[divisaInfo.codigo] ? COLORES_TABLA.botonPrincipal : COLORES_TABLA.botonSecundario,
                            color: '#ffffff',
                          }}
                          title={divisasEnUSD[divisaInfo.codigo] ? 'Mostrar en moneda original' : 'Convertir a USD'}
                        >
                          {divisasEnUSD[divisaInfo.codigo] ? 'USD' : divisaInfo.simbolo}
                        </button>
                        {hayMasCuentas && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleTodasCuentas(divisaInfo.codigo)
                            }}
                            className="px-2 py-1 text-xs rounded transition-colors"
                            style={{
                              backgroundColor: divisasTodasCuentas[divisaInfo.codigo] ? '#10b981' : '#6b7280',
                              color: '#ffffff',
                            }}
                            title={divisasTodasCuentas[divisaInfo.codigo] ? 'Mostrar solo con movimientos' : 'Mostrar todas las cuentas'}
                          >
                            {divisasTodasCuentas[divisaInfo.codigo] ? 'Todas' : `+${todasLasCuentas.length - cuentasDivisa.length}`}
                          </button>
                        )}
                      </div>
                    </th>
                  )
                })}
                <th
                  className="border px-3 py-2 text-sm font-semibold text-center"
                  style={{
                    backgroundColor: COLORES_TABLA.fondoTotalUSD,
                    borderColor: COLORES_TABLA.bordeEncabezado,
                    color: COLORES_TABLA.textoGeneral,
                  }}
                >
                  TOTAL USD
                </th>
              </tr>

              {/* Sub-encabezados */}
              <tr>
                <th
                  className="border px-3 py-2 text-xs font-medium sticky left-0 z-10"
                  style={{
                    backgroundColor: COLORES_TABLA.fondoEncabezado,
                    borderColor: COLORES_TABLA.bordeEncabezado,
                    color: COLORES_TABLA.textoGeneral,
                  }}
                >
                  {/* Vacío */}
                </th>
                {divisasAMostrar.map((divisaInfo, idx) => {
                  const cuentasDivisa = cuentasAMostrarPorDivisa[divisaInfo.codigo] || []
                  const expandida = divisasExpandidas[divisaInfo.codigo]
                  const esAlterna = idx % 2 === 1
                  const bgColor = esAlterna ? COLORES_TABLA.fondoEncabezadoAlterno : COLORES_TABLA.fondoTotalDivisa

                  return (
                    <React.Fragment key={divisaInfo.codigo}>
                      {expandida && cuentasDivisa.map((cuenta) => (
                        <th
                          key={cuenta.id_cuenta}
                          className="border px-2 py-1 text-xs font-medium text-center"
                          style={{
                            backgroundColor: bgColor,
                            borderColor: COLORES_TABLA.bordeEncabezado,
                            color: COLORES_TABLA.textoGeneral,
                            maxWidth: '150px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={cuenta.nombre_sheet_origen || `${cuenta.banco_nombre} - Cuenta ${cuenta.id_cuenta}`}
                        >
                          {cuenta.nombre_sheet_origen || `${cuenta.banco_nombre} ${cuenta.id_cuenta}`}
                        </th>
                      ))}
                      <th
                        className="border px-2 py-1 text-xs font-medium text-center cursor-pointer"
                        style={{
                          backgroundColor: bgColor,
                          borderColor: COLORES_TABLA.bordeEncabezado,
                          color: COLORES_TABLA.textoGeneral,
                        }}
                        onClick={() => toggleDivisa(divisaInfo.codigo)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {expandida ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          {divisasEnUSD[divisaInfo.codigo] ? 'Total USD' : `Total ${divisaInfo.codigo}`}
                        </div>
                      </th>
                    </React.Fragment>
                  )
                })}
                <th
                  className="border px-3 py-2 text-xs font-medium text-center"
                  style={{
                    backgroundColor: COLORES_TABLA.fondoTotalUSD,
                    borderColor: COLORES_TABLA.bordeEncabezado,
                    color: COLORES_TABLA.textoGeneral,
                  }}
                >
                  {/* Vacío */}
                </th>
              </tr>
            </thead>
            <tbody>
              {datosProcesados.length === 0 ? (
                <tr>
                  <td
                  colSpan={1 + divisasAMostrar.reduce((sum, d) => {
                    const cuentasDivisa = cuentasAMostrarPorDivisa[d.codigo] || []
                    return sum + (divisasExpandidas[d.codigo] ? cuentasDivisa.length + 1 : 1)
                  }, 0) + 1}
                    className="border px-4 py-8 text-center text-gray-500"
                    style={{ borderColor: COLORES_TABLA.bordeGeneral }}
                  >
                    No hay datos disponibles
                  </td>
                </tr>
              ) : (
                datosProcesados.map((dato, idx) => {
                  const esFilaPar = idx % 2 === 0
                  const esAgrupacion = dato.esAgrupacion

                  return (
                    <tr key={`${dato.fecha}-${idx}`}>
                      {/* Columna de fecha */}
                      <td
                        className="border px-3 py-2 text-sm sticky left-0 z-10"
                        style={{
                          backgroundColor: esAgrupacion ? COLORES_TABLA.fondoFilaAgrupada : (esFilaPar ? COLORES_TABLA.fondoFila : COLORES_TABLA.fondoFilaAlterna),
                          borderColor: COLORES_TABLA.bordeGeneral,
                          color: COLORES_TABLA.textoGeneral,
                          fontWeight: esAgrupacion ? 'bold' : 'normal',
                        }}
                      >
                        {esAgrupacion ? (
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => toggleMes(dato.mesAnio!)}
                          >
                            {mesesExpandidos[dato.mesAnio!] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            {obtenerNombreMes(dato.mesAnio!)}
                          </div>
                        ) : (
                          new Date(dato.fecha + 'T00:00:00').toLocaleDateString('es-ES')
                        )}
                      </td>

                      {/* Columnas de divisas */}
                      {divisasAMostrar.map((divisaInfo) => {
                        const cuentasDivisa = cuentasAMostrarPorDivisa[divisaInfo.codigo] || []
                        const expandida = divisasExpandidas[divisaInfo.codigo]
                        const totalDivisa = dato.totalesPorDivisa[divisaInfo.codigo] || 0
                        const totalUSDDivisa = convertirAUSD(totalDivisa, divisaInfo.codigo)
                        const mostrarEnUSD = divisasEnUSD[divisaInfo.codigo]

                        return (
                          <React.Fragment key={divisaInfo.codigo}>
                            {expandida && cuentasDivisa.map((cuenta) => {
                              const saldo = dato.valores[cuenta.id_cuenta.toString()] || 0
                              const saldoMostrar = mostrarEnUSD ? convertirAUSD(saldo, divisaInfo.codigo) : saldo
                              return (
                                <td
                                  key={cuenta.id_cuenta}
                                  className="border px-2 py-2 text-sm text-right"
                                  style={{
                                    backgroundColor: esAgrupacion ? COLORES_TABLA.fondoFilaAgrupada : (esFilaPar ? COLORES_TABLA.fondoFila : COLORES_TABLA.fondoFilaAlterna),
                                    borderColor: COLORES_TABLA.bordeGeneral,
                                    color: COLORES_TABLA.textoMonto,
                                  }}
                                >
                                  {saldo === 0 ? '-' : (
                                    mostrarEnUSD 
                                      ? `US$ ${saldoMostrar.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : saldoMostrar.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  )}
                                </td>
                              )
                            })}
                            <td
                              className="border px-2 py-2 text-sm text-right font-semibold"
                              style={{
                                backgroundColor: esAgrupacion ? COLORES_TABLA.fondoFilaAgrupada : COLORES_TABLA.fondoMonto,
                                borderColor: COLORES_TABLA.bordeGeneral,
                                color: COLORES_TABLA.textoMonto,
                              }}
                            >
                              {totalDivisa === 0 ? '-' : (
                                mostrarEnUSD
                                  ? `US$ ${totalUSDDivisa.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : `${obtenerSimboloDivisa(divisaInfo.codigo)} ${totalDivisa.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              )}
                            </td>
                            <td
                              className="border px-2 py-2 text-sm text-right"
                              style={{
                                backgroundColor: esAgrupacion ? COLORES_TABLA.fondoFilaAgrupada : (esFilaPar ? COLORES_TABLA.fondoFila : COLORES_TABLA.fondoFilaAlterna),
                                borderColor: COLORES_TABLA.bordeGeneral,
                                color: COLORES_TABLA.textoMonto,
                              }}
                            >
                              {divisasEnUSD[divisaInfo.codigo] ? (
                                totalUSDDivisa === 0 ? '-' : `US$ ${totalUSDDivisa.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              ) : '-'}
                            </td>
                          </React.Fragment>
                        )
                      })}

                      {/* Total USD */}
                      <td
                        className="border px-3 py-2 text-sm text-right font-bold"
                        style={{
                          backgroundColor: esAgrupacion ? COLORES_TABLA.fondoFilaAgrupada : COLORES_TABLA.fondoTotalUSD,
                          borderColor: COLORES_TABLA.bordeGeneral,
                          color: COLORES_TABLA.textoGeneral,
                        }}
                      >
                        US$ {dato.totalUSD.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${COLORES_TABLA.fondoFila};
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${COLORES_TABLA.bordeGeneral};
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${COLORES_TABLA.textoGeneral};
        }
      `}</style>
    </div>
  )
}

