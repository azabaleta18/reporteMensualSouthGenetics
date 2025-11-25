'use client'

import { useEffect, useState, useMemo } from 'react'
import { RegistroBancario, Divisa, BANCOS_POR_DIVISA, DIVISAS, CUENTAS_ORDENADAS } from '@/lib/types'
import { obtenerRegistrosAgrupadosPorFecha, obtenerRegistrosPorBancoYDivisa, crearRegistrosEjemplo } from '@/lib/database'
import { obtenerTasasCambio } from '@/lib/divisas'
import { ChevronRight, ChevronDown, Database, DollarSign, Eye, EyeOff, Calendar, Globe } from 'lucide-react'
import { COLORES_TABLA } from '@/lib/colores'

interface DatosPorFecha {
  fecha: string
  valores: Record<string, number> // clave: nombreCompleto de cuenta o divisa, valor: cantidad acumulada
  totalesPorDivisa: Record<Divisa, number>
  totalUSD: number
  esAgrupacion?: boolean // true si es una fila de agrupación por mes
  mesAnio?: string // formato "YYYY-MM" para agrupaciones
  fechasAgrupadas?: string[] // fechas que están agrupadas en esta fila
}

export default function TablaUnificada() {
  const [registrosPorFecha, setRegistrosPorFecha] = useState<Record<string, RegistroBancario[]>>({})
  const [tasasCambio, setTasasCambio] = useState<Record<Divisa, number>>({} as Record<Divisa, number>)
  const [loading, setLoading] = useState(true)
  const [divisasExpandidas, setDivisasExpandidas] = useState<Record<Divisa, boolean>>({
    ARS: false, CLP: false, COP: false, EUR: false, MXN: false, UYU: false, USD: false
  })
  const [divisasEnUSD, setDivisasEnUSD] = useState<Record<Divisa, boolean>>({
    ARS: false, CLP: false, COP: false, EUR: false, MXN: false, UYU: false, USD: false
  })
  const [registrosPorDivisa, setRegistrosPorDivisa] = useState<Record<Divisa, Record<string, RegistroBancario[]>>>({} as Record<Divisa, Record<string, RegistroBancario[]>>)
  const [generandoEjemplos, setGenerandoEjemplos] = useState(false)
  const [modoResumen, setModoResumen] = useState(false)
  const [agruparPorMes, setAgruparPorMes] = useState(true)
  const [mesesExpandidos, setMesesExpandidos] = useState<Record<string, boolean>>({})
  const [todoEnUSD, setTodoEnUSD] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const [registros, tasas] = await Promise.all([
        obtenerRegistrosAgrupadosPorFecha(),
        obtenerTasasCambio(),
      ])
      
      setRegistrosPorFecha(registros)
      
      const tasasMap: Record<Divisa, number> = {} as Record<Divisa, number>
      tasas.forEach(t => {
        tasasMap[t.divisa] = t.tasa_a_usd
      })
      setTasasCambio(tasasMap)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const generarDatosEjemplo = async () => {
    if (!confirm('¿Deseas generar 10 días de datos de ejemplo? Esto agregará registros a la base de datos.')) {
      return
    }

    try {
      setGenerandoEjemplos(true)
      await crearRegistrosEjemplo()
      alert('Datos de ejemplo generados exitosamente. Recargando...')
      await cargarDatos()
    } catch (error) {
      console.error('Error al generar datos de ejemplo:', error)
      alert('Error al generar datos de ejemplo. Por favor, intenta nuevamente.')
    } finally {
      setGenerandoEjemplos(false)
    }
  }

  const toggleDivisa = async (divisa: Divisa) => {
    const nuevoEstado = !divisasExpandidas[divisa]
    setDivisasExpandidas(prev => ({
      ...prev,
      [divisa]: nuevoEstado
    }))

    // Si se está expandiendo y no hay registros cargados, cargarlos
    if (nuevoEstado && !registrosPorDivisa[divisa]) {
      try {
        const registros = await obtenerRegistrosPorBancoYDivisa(divisa)
        setRegistrosPorDivisa(prev => ({
          ...prev,
          [divisa]: registros
        }))
      } catch (error) {
        console.error('Error al cargar registros de divisa:', error)
      }
    }
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
    // Si se activa "todo en USD", poner todas las divisas (excepto USD) en USD
    if (nuevoEstado) {
      const nuevasDivisasEnUSD: Record<Divisa, boolean> = {
        ARS: true,
        CLP: true,
        COP: true,
        EUR: true,
        MXN: true,
        UYU: true,
        USD: false // USD siempre se muestra en USD
      }
      setDivisasEnUSD(nuevasDivisasEnUSD)
    } else {
      // Si se desactiva, resetear todas a false
      setDivisasEnUSD({
        ARS: false,
        CLP: false,
        COP: false,
        EUR: false,
        MXN: false,
        UYU: false,
        USD: false
      })
    }
  }

  const obtenerSimboloDivisa = (divisa: Divisa) => {
    const infoDivisa = DIVISAS.find(d => d.codigo === divisa)
    return infoDivisa?.simbolo || ''
  }

  const convertirAUSD = (cantidad: number, divisa: Divisa): number => {
    const tasa = tasasCambio[divisa] || 1
    return cantidad * tasa
  }

  function obtenerMesAnio(fecha: string) {
    const d = new Date(fecha)
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

  const datosProcesados = useMemo(() => {
    const fechas = Object.keys(registrosPorFecha).sort()
    const datos: DatosPorFecha[] = []
    const valoresAcumulados: Record<string, number> = {}
    const totalesPorDivisaAcumulados: Record<Divisa, number> = {
      ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
    }

    if (agruparPorMes) {
      // Agrupar fechas por mes
      const fechasPorMes: Record<string, string[]> = {}
      fechas.forEach((fecha) => {
        const mesAnio = obtenerMesAnio(fecha)
        if (!fechasPorMes[mesAnio]) {
          fechasPorMes[mesAnio] = []
        }
        fechasPorMes[mesAnio].push(fecha)
      })

      // Procesar cada mes
      Object.keys(fechasPorMes).sort().forEach((mesAnio) => {
        const fechasDelMes = fechasPorMes[mesAnio].sort()
        
        // Calcular valores acumulados hasta el final del mes (procesando todas las fechas hasta el último día del mes)
        const valoresMes: Record<string, number> = {}
        const totalesPorDivisaMes: Record<Divisa, number> = {
          ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
        }

        // Procesar todas las fechas hasta el último día del mes (incluyendo meses anteriores)
        const ultimaFechaDelMes = fechasDelMes[fechasDelMes.length - 1]
        fechas.filter(f => f <= ultimaFechaDelMes).forEach((fecha) => {
          const registros = registrosPorFecha[fecha]
          
          registros.forEach((registro) => {
            const cuentasCoincidentes = CUENTAS_ORDENADAS.filter(
              c => c.banco === registro.banco && c.divisa === registro.divisa
            )

            if (cuentasCoincidentes.length > 0) {
              const cuenta = cuentasCoincidentes[0]
              
              if (!valoresAcumulados[cuenta.nombreCompleto]) {
                valoresAcumulados[cuenta.nombreCompleto] = 0
              }
              
              valoresAcumulados[cuenta.nombreCompleto] += registro.cantidad
              valoresMes[cuenta.nombreCompleto] = valoresAcumulados[cuenta.nombreCompleto]
              
              totalesPorDivisaAcumulados[registro.divisa] += registro.cantidad
              totalesPorDivisaMes[registro.divisa] = totalesPorDivisaAcumulados[registro.divisa]
            }
          })
        })

        // Calcular total USD del mes
        let totalUSD = 0
        Object.entries(totalesPorDivisaMes).forEach(([divisa, cantidad]) => {
          const tasa = tasasCambio[divisa as Divisa] || 1
          totalUSD += cantidad * tasa
        })

        // Agregar fila de agrupación por mes
        datos.push({
          fecha: obtenerNombreMes(mesAnio),
          valores: { ...valoresMes },
          totalesPorDivisa: { ...totalesPorDivisaMes },
          totalUSD,
          esAgrupacion: true,
          mesAnio,
          fechasAgrupadas: fechasDelMes,
        })

        // Si el mes está expandido, agregar las fechas individuales
        if (mesesExpandidos[mesAnio]) {
          // Resetear acumulados para recalcular desde el inicio
          const valoresAcumuladosParaFechas: Record<string, number> = {}
          const totalesPorDivisaParaFechas: Record<Divisa, number> = {
            ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
          }

          fechasDelMes.forEach((fecha) => {
            const registros = registrosPorFecha[fecha]
            
            registros.forEach((registro) => {
              const cuentasCoincidentes = CUENTAS_ORDENADAS.filter(
                c => c.banco === registro.banco && c.divisa === registro.divisa
              )
              
              if (cuentasCoincidentes.length > 0) {
                const cuenta = cuentasCoincidentes[0]
                
                if (!valoresAcumuladosParaFechas[cuenta.nombreCompleto]) {
                  valoresAcumuladosParaFechas[cuenta.nombreCompleto] = 0
                }
                valoresAcumuladosParaFechas[cuenta.nombreCompleto] += registro.cantidad
                totalesPorDivisaParaFechas[registro.divisa] += registro.cantidad
              }
            })

            // Calcular acumulados hasta esta fecha (incluyendo todas las fechas anteriores)
            const valoresHastaFecha: Record<string, number> = {}
            const totalesHastaFecha: Record<Divisa, number> = {
              ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
            }

            fechas.filter(f => f <= fecha).forEach((f) => {
              const regs = registrosPorFecha[f]
              regs.forEach((registro) => {
                const cuentasCoincidentes = CUENTAS_ORDENADAS.filter(
                  c => c.banco === registro.banco && c.divisa === registro.divisa
                )
                if (cuentasCoincidentes.length > 0) {
                  const cuenta = cuentasCoincidentes[0]
                  if (!valoresHastaFecha[cuenta.nombreCompleto]) {
                    valoresHastaFecha[cuenta.nombreCompleto] = 0
                  }
                  valoresHastaFecha[cuenta.nombreCompleto] += registro.cantidad
                  totalesHastaFecha[registro.divisa] += registro.cantidad
                }
              })
            })

            let totalUSDDia = 0
            Object.entries(totalesHastaFecha).forEach(([divisa, cantidad]) => {
              const tasa = tasasCambio[divisa as Divisa] || 1
              totalUSDDia += cantidad * tasa
            })

            datos.push({
              fecha,
              valores: { ...valoresHastaFecha },
              totalesPorDivisa: { ...totalesHastaFecha },
              totalUSD: totalUSDDia,
            })
          })
        }
      })
    } else {
      // Procesamiento normal sin agrupación
      fechas.forEach((fecha) => {
        const registros = registrosPorFecha[fecha]
        
        const valoresDia: Record<string, number> = { ...valoresAcumulados }
        const totalesPorDivisa: Record<Divisa, number> = { ...totalesPorDivisaAcumulados }

        registros.forEach((registro) => {
          const cuentasCoincidentes = CUENTAS_ORDENADAS.filter(
            c => c.banco === registro.banco && c.divisa === registro.divisa
          )

          if (cuentasCoincidentes.length > 0) {
            const cuenta = cuentasCoincidentes[0]
            
            if (!valoresAcumulados[cuenta.nombreCompleto]) {
              valoresAcumulados[cuenta.nombreCompleto] = 0
            }
            valoresAcumulados[cuenta.nombreCompleto] += registro.cantidad
            valoresDia[cuenta.nombreCompleto] = valoresAcumulados[cuenta.nombreCompleto]

            totalesPorDivisaAcumulados[registro.divisa] += registro.cantidad
            totalesPorDivisa[registro.divisa] = totalesPorDivisaAcumulados[registro.divisa]
          }
        })

        let totalUSD = 0
        Object.entries(totalesPorDivisa).forEach(([divisa, cantidad]) => {
          const tasa = tasasCambio[divisa as Divisa] || 1
          totalUSD += cantidad * tasa
        })

        datos.push({
          fecha,
          valores: { ...valoresDia },
          totalesPorDivisa: { ...totalesPorDivisa },
          totalUSD,
        })
      })
    }

    return datos
  }, [registrosPorFecha, tasasCambio, agruparPorMes, mesesExpandidos])

  const formatearMonto = (monto: number) => {
    return monto.toLocaleString('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // Obtener bancos para una divisa
  const obtenerBancosDivisa = (divisa: Divisa) => {
    return BANCOS_POR_DIVISA[divisa] || []
  }

  // Obtener cuentas para un banco y divisa
  const obtenerCuentasBanco = (banco: string, divisa: Divisa) => {
    return CUENTAS_ORDENADAS.filter(c => c.banco === banco && c.divisa === divisa)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Cargando reporte...</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl shadow-lg overflow-hidden border" style={{ backgroundColor: COLORES_TABLA.fondoGeneral, borderColor: COLORES_TABLA.bordeGeneral }}>
      <div className="p-5 border-b flex items-center justify-between" style={{ backgroundColor: COLORES_TABLA.fondoEncabezado, borderColor: COLORES_TABLA.bordeGeneral }}>
        <h2 className="text-xl font-semibold" style={{ color: COLORES_TABLA.textoGeneral }}>
          Reporte Mensual de Divisas
        </h2>
        <div className="flex items-center gap-3">
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
            onClick={() => setModoResumen(!modoResumen)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            style={{ backgroundColor: COLORES_TABLA.botonPrincipal }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal}
          >
            {modoResumen ? (
              <>
                <EyeOff className="w-4 h-4" />
                Ver Vista Completa
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Ver solo Totales
              </>
            )}
          </button>
          <button
            onClick={toggleTodoEnUSD}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            style={{ backgroundColor: todoEnUSD ? COLORES_TABLA.botonHover : COLORES_TABLA.botonPrincipal }}
            onMouseEnter={(e) => !todoEnUSD && (e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover)}
            onMouseLeave={(e) => !todoEnUSD && (e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal)}
          >
            <Globe className="w-4 h-4" />
            {todoEnUSD ? 'Ver en Divisas Originales' : 'Ver todo en Dólares'}
          </button>
          <button
            onClick={generarDatosEjemplo}
            disabled={generandoEjemplos}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: COLORES_TABLA.botonSecundario }}
            onMouseEnter={(e) => !generandoEjemplos && (e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover)}
            onMouseLeave={(e) => !generandoEjemplos && (e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario)}
          >
            <Database className="w-4 h-4" />
            {generandoEjemplos ? 'Generando...' : 'Generar 10 días de ejemplo'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            height: 14px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: ${COLORES_TABLA.fondoAlterno};
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: ${COLORES_TABLA.botonSecundario};
            border-radius: 4px;
            transition: background 0.2s;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: ${COLORES_TABLA.botonPrincipal};
          }
          .dark .custom-scrollbar::-webkit-scrollbar-track {
            background: #e2e8f0;
          }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
          }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: COLORES_TABLA.fondoEncabezado }}>
            {/* Primera fila: Divisas principales */}
            <tr>
              <th 
                rowSpan={Object.values(divisasExpandidas).some(v => v && !modoResumen) ? 2 : 1}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 z-20 border-r min-w-[100px] shadow-[2px_0_2px_rgba(0,0,0,0.05)]"
                style={{ backgroundColor: COLORES_TABLA.fondoEncabezado, color: COLORES_TABLA.textoGeneral, borderColor: COLORES_TABLA.bordeEncabezado }}
              >
                Fecha
              </th>
              {DIVISAS.map((divisaInfo) => {
                const divisa = divisaInfo.codigo
                const expandida = divisasExpandidas[divisa] && !modoResumen
                const bancos = obtenerBancosDivisa(divisa)
                const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
                // Número de columnas: cuentas + 1 columna de total si está expandida
                const numColumnas = expandida ? cuentasDivisa.length + 1 : 1
                
                return (
                  <th
                    key={divisa}
                    colSpan={numColumnas}
                    rowSpan={expandida ? 1 : (Object.values(divisasExpandidas).some(v => v && !modoResumen) ? 2 : 1)}
                    className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider border-l"
                    style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {!modoResumen && (
                        <button
                          onClick={() => toggleDivisa(divisa)}
                          className="p-1.5 rounded-md transition-all duration-200"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal + '80'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          title={expandida ? 'Colapsar' : 'Expandir'}
                        >
                          {expandida ? (
                            <ChevronDown className="w-4 h-4 text-white" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-white" />
                          )}
                        </button>
                      )}
                      <span className="font-bold text-white">{divisa}</span>
                      {divisa !== 'USD' && (
                        <button
                          onClick={() => toggleDivisaUSD(divisa)}
                          className="p-1.5 rounded-md transition-all duration-200"
                          style={{ 
                            backgroundColor: (todoEnUSD || divisasEnUSD[divisa]) ? COLORES_TABLA.botonPrincipal : 'transparent',
                            color: 'white'
                          }}
                          onMouseEnter={(e) => !todoEnUSD && !divisasEnUSD[divisa] && (e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal + '80')}
                          onMouseLeave={(e) => !todoEnUSD && !divisasEnUSD[divisa] && (e.currentTarget.style.backgroundColor = 'transparent')}
                          title={(todoEnUSD || divisasEnUSD[divisa]) ? 'Mostrar en ' + divisa : 'Mostrar en USD'}
                          disabled={todoEnUSD}
                        >
                          <DollarSign className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                  </th>
                )
              })}
              <th 
                rowSpan={Object.values(divisasExpandidas).some(v => v && !modoResumen) ? 2 : 1}
                className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider sticky right-0 z-20 border-l min-w-[120px] shadow-[-2px_0_2px_rgba(0,0,0,0.05)]"
                style={{ backgroundColor: COLORES_TABLA.fondoTotalUSD, borderColor: COLORES_TABLA.bordeEncabezado }}
              >
                Total USD
              </th>
            </tr>
            {/* Segunda fila: Subencabezados de cuentas bancarias cuando están expandidos */}
            {Object.values(divisasExpandidas).some(v => v && !modoResumen) && (
              <tr>
                {DIVISAS.map((divisaInfo) => {
                  const divisa = divisaInfo.codigo
                  const expandida = divisasExpandidas[divisa] && !modoResumen
                  
                  if (!expandida) {
                    return null
                  }
                  
                  const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
                  
                  return (
                    <>
                      {cuentasDivisa.map((cuenta) => (
                        <th
                          key={cuenta.nombreCompleto}
                          className="px-3 py-2 text-[10px] font-medium text-left whitespace-nowrap border-t border-l"
                          style={{ backgroundColor: COLORES_TABLA.fondoEncabezado, color: COLORES_TABLA.textoGeneral, borderColor: COLORES_TABLA.bordeEncabezado }}
                        >
                          {cuenta.nombreCompleto}
                        </th>
                      ))}
                      {/* Columna de total por divisa */}
                      <th
                        className="px-3 py-2 text-[10px] font-semibold text-white border-t border-l text-center whitespace-nowrap"
                        style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                      >
                        Total {divisa}
                      </th>
                    </>
                  )
                })}
              </tr>
            )}
          </thead>
          <tbody style={{ backgroundColor: COLORES_TABLA.fondoGeneral }} className="divide-y">
            {datosProcesados.length === 0 ? (
              <tr>
                <td 
                  colSpan={
                    1 + 
                    DIVISAS.reduce((sum, d) => {
                      const expandida = divisasExpandidas[d.codigo] && !modoResumen
                      if (expandida) {
                        const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === d.codigo)
                        return sum + cuentasDivisa.length + 1 // +1 para la columna de total
                      }
                      return sum + 1
                    }, 0) + 
                    1
                  } 
                  className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                >
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              datosProcesados.map((dato, index) => (
                <tr
                  key={dato.fecha}
                  className={`transition-colors duration-150 ${dato.esAgrupacion ? 'font-semibold' : ''}`}
                  style={{ 
                    backgroundColor: dato.esAgrupacion 
                      ? COLORES_TABLA.fondoEncabezado
                      : (index % 2 === 0 ? COLORES_TABLA.fondoGeneral : COLORES_TABLA.fondoAlterno)
                  }}
                >
                  <td 
                    className={`px-4 py-3 whitespace-nowrap text-xs font-medium sticky left-0 z-20 border-r shadow-[2px_0_2px_rgba(0,0,0,0.05)]`}
                    style={{ 
                      backgroundColor: dato.esAgrupacion 
                        ? COLORES_TABLA.fondoEncabezado
                        : (index % 2 === 0 ? COLORES_TABLA.fondoGeneral : COLORES_TABLA.fondoAlterno),
                      color: COLORES_TABLA.textoGeneral,
                      borderColor: COLORES_TABLA.bordeEncabezado
                    }}
                  >
                    {dato.esAgrupacion ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleMes(dato.mesAnio!)}
                          className="p-1 rounded transition-colors"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          title={mesesExpandidos[dato.mesAnio!] ? 'Colapsar' : 'Expandir'}
                        >
                          {mesesExpandidos[dato.mesAnio!] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <span className="capitalize">{dato.fecha}</span>
                      </div>
                    ) : (
                      formatearFecha(dato.fecha)
                    )}
                  </td>
                  {DIVISAS.map((divisaInfo) => {
                    const divisa = divisaInfo.codigo
                    const expandida = divisasExpandidas[divisa] && !modoResumen
                    const totalDivisa = dato.totalesPorDivisa[divisa] || 0
                    
                    const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
                    const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
                    
                    if (!expandida) {
                      const valorMostrar = mostrarEnUSD ? convertirAUSD(totalDivisa, divisa) : totalDivisa
                      return (
                        <td
                          key={divisa}
                          className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap border-l"
                          style={{ backgroundColor: COLORES_TABLA.fondoMonto, color: COLORES_TABLA.textoMonto, borderColor: COLORES_TABLA.bordeEncabezado }}
                        >
                          {valorMostrar > 0 ? `${simbolo} ${formatearMonto(valorMostrar)}` : '-'}
                        </td>
                      )
                    }
                    
                    // Mostrar columnas de cuentas bancarias expandidas
                    const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
                    
                    return (
                      <>
                        {cuentasDivisa.map((cuenta) => {
                          const valorOriginal = dato.valores[cuenta.nombreCompleto] || 0
                          const valorMostrar = mostrarEnUSD ? convertirAUSD(valorOriginal, divisa) : valorOriginal
                          return (
                            <td
                              key={cuenta.nombreCompleto}
                              className="px-3 py-2.5 text-right text-xs whitespace-nowrap border-l"
                              style={{ backgroundColor: COLORES_TABLA.fondoMonto, color: COLORES_TABLA.textoMonto, borderColor: COLORES_TABLA.bordeEncabezado }}
                            >
                              {valorMostrar > 0 ? `${simbolo} ${formatearMonto(valorMostrar)}` : '-'}
                            </td>
                          )
                        })}
                        {/* Columna de total por divisa */}
                        <td
                          className="px-3 py-2.5 text-right text-xs font-semibold text-white whitespace-nowrap border-l"
                          style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                        >
                          {totalDivisa > 0 ? `${simbolo} ${formatearMonto(mostrarEnUSD ? convertirAUSD(totalDivisa, divisa) : totalDivisa)}` : '-'}
                        </td>
                      </>
                    )
                  })}
                  <td 
                    className="px-4 py-3 text-right text-xs font-bold text-white sticky right-0 z-20 border-l shadow-[-2px_0_2px_rgba(0,0,0,0.05)] whitespace-nowrap"
                    style={{ backgroundColor: COLORES_TABLA.fondoTotalUSD, borderColor: COLORES_TABLA.bordeEncabezado }}
                  >
                    US$ {formatearMonto(dato.totalUSD)}
                  </td>
                </tr>
              ))
            )}
            {/* Fila de totales generales */}
            {datosProcesados.length > 0 && (
              <tr className="font-bold border-t-2" style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeTotal }}>
                <td 
                  className="px-4 py-3.5 text-xs font-bold text-white sticky left-0 z-20 border-r shadow-[2px_0_2px_rgba(0,0,0,0.05)] whitespace-nowrap"
                  style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                >
                  TOTAL
                </td>
                {DIVISAS.map((divisaInfo) => {
                  const divisa = divisaInfo.codigo
                  const expandida = divisasExpandidas[divisa] && !modoResumen
                  const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
                  const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
                  
                  // Calcular total acumulado de la divisa
                  // Si está agrupado por mes, usar el último valor de las filas agrupadas
                  // Si no está agrupado, usar el último valor de todas las filas
                  const totalFinal = agruparPorMes
                    ? (datosProcesados.filter(d => d.esAgrupacion).slice(-1)[0]?.totalesPorDivisa[divisa] || 0)
                    : (datosProcesados.filter(d => !d.esAgrupacion).slice(-1)[0]?.totalesPorDivisa[divisa] || 0)
                  
                  if (!expandida) {
                    const valorMostrar = mostrarEnUSD ? convertirAUSD(totalFinal, divisa) : totalFinal
                    return (
                      <td
                        key={divisa}
                        className="px-4 py-3.5 text-right text-xs font-bold text-white whitespace-nowrap border-l"
                        style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                      >
                        {valorMostrar > 0 ? `${simbolo} ${formatearMonto(valorMostrar)}` : '-'}
                      </td>
                    )
                  }
                  
                  // Mostrar columnas de cuentas bancarias expandidas con totales
                  const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
                  
                  return (
                    <>
                      {cuentasDivisa.map((cuenta) => {
                        const totalCuentaFinal = agruparPorMes
                          ? (datosProcesados.filter(d => d.esAgrupacion).slice(-1)[0]?.valores[cuenta.nombreCompleto] || 0)
                          : (datosProcesados.filter(d => !d.esAgrupacion).slice(-1)[0]?.valores[cuenta.nombreCompleto] || 0)
                        const valorMostrar = mostrarEnUSD ? convertirAUSD(totalCuentaFinal, divisa) : totalCuentaFinal
                        return (
                          <td
                            key={cuenta.nombreCompleto}
                            className="px-3 py-3 text-right text-xs font-semibold whitespace-nowrap border-l"
                            style={{ backgroundColor: COLORES_TABLA.fondoMonto, color: COLORES_TABLA.textoMonto, borderColor: COLORES_TABLA.bordeEncabezado }}
                          >
                            {valorMostrar > 0 ? `${simbolo} ${formatearMonto(valorMostrar)}` : '-'}
                          </td>
                        )
                      })}
                      {/* Columna de total por divisa */}
                      <td
                        className="px-3 py-3 text-right text-xs font-bold text-white whitespace-nowrap border-l"
                        style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                      >
                        {totalFinal > 0 ? `${simbolo} ${formatearMonto(mostrarEnUSD ? convertirAUSD(totalFinal, divisa) : totalFinal)}` : '-'}
                      </td>
                    </>
                  )
                })}
                {/* Total general en USD */}
                <td 
                  className="px-4 py-3.5 text-right text-xs font-bold text-white sticky right-0 z-20 border-l shadow-[-2px_0_2px_rgba(0,0,0,0.05)] whitespace-nowrap"
                  style={{ backgroundColor: COLORES_TABLA.fondoTotalUSD, borderColor: COLORES_TABLA.bordeEncabezado }}
                >
                  US$ {formatearMonto(
                    agruparPorMes
                      ? (datosProcesados.filter(d => d.esAgrupacion).slice(-1)[0]?.totalUSD || 0)
                      : (datosProcesados.filter(d => !d.esAgrupacion).slice(-1)[0]?.totalUSD || 0)
                  )}
                </td>
              </tr>
            )}
            {/* Fila de porcentajes del total USD */}
            {datosProcesados.length > 0 && (
              <tr className="border-t" style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeTotal }}>
                <td 
                  className="px-4 py-2.5 text-xs font-semibold text-white sticky left-0 z-20 border-r shadow-[2px_0_2px_rgba(0,0,0,0.05)] whitespace-nowrap"
                  style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                >
                  % del Total USD
                </td>
                {DIVISAS.map((divisaInfo) => {
                  const divisa = divisaInfo.codigo
                  const expandida = divisasExpandidas[divisa] && !modoResumen
                  
                  // Calcular total acumulado de la divisa en USD
                  const totalDivisaFinal = agruparPorMes
                    ? (datosProcesados.filter(d => d.esAgrupacion).slice(-1)[0]?.totalesPorDivisa[divisa] || 0)
                    : (datosProcesados.filter(d => !d.esAgrupacion).slice(-1)[0]?.totalesPorDivisa[divisa] || 0)
                  
                  const totalDivisaUSD = convertirAUSD(totalDivisaFinal, divisa)
                  
                  const totalGeneralUSD = agruparPorMes
                    ? (datosProcesados.filter(d => d.esAgrupacion).slice(-1)[0]?.totalUSD || 0)
                    : (datosProcesados.filter(d => !d.esAgrupacion).slice(-1)[0]?.totalUSD || 0)
                  const porcentaje = totalGeneralUSD > 0 ? (totalDivisaUSD / totalGeneralUSD) * 100 : 0
                  
                  if (!expandida) {
                    return (
                      <td
                        key={divisa}
                        className="px-4 py-2.5 text-right text-xs font-medium text-white whitespace-nowrap border-l"
                        style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                      >
                        {porcentaje > 0 ? `${porcentaje.toFixed(2)}%` : '-'}
                      </td>
                    )
                  }
                  
                  // Mostrar columnas de cuentas bancarias expandidas con porcentajes
                  const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
                  
                  return (
                    <>
                      {cuentasDivisa.map((cuenta) => {
                        const totalCuentaFinal = agruparPorMes
                          ? (datosProcesados.filter(d => d.esAgrupacion).slice(-1)[0]?.valores[cuenta.nombreCompleto] || 0)
                          : (datosProcesados.filter(d => !d.esAgrupacion).slice(-1)[0]?.valores[cuenta.nombreCompleto] || 0)
                        const totalCuentaUSD = convertirAUSD(totalCuentaFinal, divisa)
                        const porcentajeCuenta = totalGeneralUSD > 0 ? (totalCuentaUSD / totalGeneralUSD) * 100 : 0
                        return (
                          <td
                            key={cuenta.nombreCompleto}
                            className="px-3 py-2 text-right text-xs whitespace-nowrap border-l"
                            style={{ backgroundColor: COLORES_TABLA.fondoMonto, color: COLORES_TABLA.textoMonto, borderColor: COLORES_TABLA.bordeEncabezado }}
                          >
                            {porcentajeCuenta > 0 ? `${porcentajeCuenta.toFixed(2)}%` : '-'}
                          </td>
                        )
                      })}
                      {/* Columna de porcentaje total por divisa */}
                      <td
                        className="px-3 py-2 text-right text-xs font-semibold text-white whitespace-nowrap border-l"
                        style={{ backgroundColor: COLORES_TABLA.fondoTotalDivisa, borderColor: COLORES_TABLA.bordeEncabezado }}
                      >
                        {porcentaje > 0 ? `${porcentaje.toFixed(2)}%` : '-'}
                      </td>
                    </>
                  )
                })}
                {/* Porcentaje total (siempre 100%) */}
                <td 
                  className="px-4 py-2.5 text-right text-xs font-bold text-white sticky right-0 z-20 border-l shadow-[-2px_0_2px_rgba(0,0,0,0.05)] whitespace-nowrap"
                  style={{ backgroundColor: COLORES_TABLA.fondoTotalUSD, borderColor: COLORES_TABLA.bordeEncabezado }}
                >
                  100.00%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

