'use client'

import { useEffect, useState, useMemo } from 'react'
import { RegistroBancario, Divisa, CUENTAS_ORDENADAS, DIVISAS } from '@/lib/types'
import { obtenerRegistrosAgrupadosPorFecha } from '@/lib/database'
import { obtenerTasasCambio } from '@/lib/divisas'
import { TasaCambio } from '@/lib/types'

interface DatosPorFecha {
  fecha: string
  valores: Record<string, number> // clave: nombreCompleto de cuenta, valor: cantidad acumulada
  totalesPorDivisa: Record<Divisa, number>
  totalesPorBanco: Record<string, number>
  totalUSD: number
}

export default function TablaReporteDiario() {
  const [registrosPorFecha, setRegistrosPorFecha] = useState<Record<string, RegistroBancario[]>>({})
  const [tasasCambio, setTasasCambio] = useState<Record<Divisa, number>>({} as Record<Divisa, number>)
  const [loading, setLoading] = useState(true)

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
        tasasMap[t.codigo_divisa as Divisa] = t.unidades_por_usd
      })
      setTasasCambio(tasasMap)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const datosProcesados = useMemo(() => {
    const fechas = Object.keys(registrosPorFecha).sort()
    const datos: DatosPorFecha[] = []
    const valoresAcumulados: Record<string, number> = {}
    const totalesPorDivisaAcumulados: Record<Divisa, number> = {
      ARS: 0, CLP: 0, COP: 0, EUR: 0, MXN: 0, UYU: 0, USD: 0
    }
    const totalesPorBancoAcumulados: Record<string, number> = {}

    fechas.forEach((fecha) => {
      const registros = registrosPorFecha[fecha]
      
      // Inicializar valores del día (copia de acumulados anteriores)
      const valoresDia: Record<string, number> = { ...valoresAcumulados }
      const totalesPorDivisa: Record<Divisa, number> = { ...totalesPorDivisaAcumulados }
      const totalesPorBanco: Record<string, number> = { ...totalesPorBancoAcumulados }

      // Procesar cada registro del día
      registros.forEach((registro) => {
        // Buscar todas las cuentas que coincidan con banco y divisa
        const cuentasCoincidentes = CUENTAS_ORDENADAS.filter(
          c => c.banco === registro.banco && c.divisa === registro.divisa
        )

        if (cuentasCoincidentes.length > 0) {
          // Si hay múltiples cuentas, distribuir el valor entre ellas
          // Por ahora, asignamos el valor a la primera cuenta encontrada
          // En el futuro se podría mejorar para distribuir o usar un campo adicional
          const cuenta = cuentasCoincidentes[0]
          
          // Acumular valor para esta cuenta
          if (!valoresAcumulados[cuenta.nombreCompleto]) {
            valoresAcumulados[cuenta.nombreCompleto] = 0
          }
          valoresAcumulados[cuenta.nombreCompleto] += registro.cantidad
          valoresDia[cuenta.nombreCompleto] = valoresAcumulados[cuenta.nombreCompleto]

          // Acumular total por divisa
          totalesPorDivisaAcumulados[registro.divisa] += registro.cantidad
          totalesPorDivisa[registro.divisa] = totalesPorDivisaAcumulados[registro.divisa]

          // Acumular total por banco
          if (!totalesPorBancoAcumulados[registro.banco]) {
            totalesPorBancoAcumulados[registro.banco] = 0
          }
          totalesPorBancoAcumulados[registro.banco] += registro.cantidad
          totalesPorBanco[registro.banco] = totalesPorBancoAcumulados[registro.banco]
        }
      })

      // Calcular total en USD
      let totalUSD = 0
      Object.entries(totalesPorDivisa).forEach(([divisa, cantidad]) => {
        if (divisa === 'USD') {
          totalUSD += cantidad
        } else {
          const unidadesPorUSD = tasasCambio[divisa as Divisa] || 1
          if (unidadesPorUSD !== 0) {
            totalUSD += cantidad / unidadesPorUSD
          }
        }
      })

      datos.push({
        fecha,
        valores: { ...valoresDia },
        totalesPorDivisa: { ...totalesPorDivisa },
        totalesPorBanco: { ...totalesPorBanco },
        totalUSD,
      })
    })

    return datos
  }, [registrosPorFecha, tasasCambio])

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

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Cargando reporte diario...</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Reporte Diario de Cuentas Bancarias
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10 border-r border-gray-200 dark:border-gray-600">
                Fecha
              </th>
              {CUENTAS_ORDENADAS.map((cuenta) => (
                <th
                  key={cuenta.nombreCompleto}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px]">{cuenta.divisa}</span>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate">
                      {cuenta.nombreCompleto}
                    </span>
                  </div>
                </th>
              ))}
              {/* Totales por divisa */}
              {DIVISAS.map((divisa) => (
                <th
                  key={`total-${divisa.codigo}`}
                  className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 min-w-[100px]"
                >
                  Total {divisa.codigo}
                </th>
              ))}
              {/* Total USD */}
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-green-50 dark:bg-green-900/20 min-w-[120px]">
                Total USD
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {datosProcesados.length === 0 ? (
              <tr>
                <td colSpan={CUENTAS_ORDENADAS.length + DIVISAS.length + 2} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              datosProcesados.map((dato) => (
                <tr
                  key={dato.fecha}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-600">
                    {formatearFecha(dato.fecha)}
                  </td>
                  {CUENTAS_ORDENADAS.map((cuenta) => {
                    const valor = dato.valores[cuenta.nombreCompleto] || 0
                    return (
                      <td
                        key={cuenta.nombreCompleto}
                        className="px-3 py-2 text-right text-xs text-gray-900 dark:text-white"
                      >
                        {valor > 0 ? formatearMonto(valor) : '-'}
                      </td>
                    )
                  })}
                  {/* Totales por divisa */}
                  {DIVISAS.map((divisa) => {
                    const total = dato.totalesPorDivisa[divisa.codigo] || 0
                    return (
                      <td
                        key={`total-${divisa.codigo}`}
                        className="px-3 py-2 text-right text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20"
                      >
                        {total > 0 ? formatearMonto(total) : '-'}
                      </td>
                    )
                  })}
                  {/* Total USD */}
                  <td className="px-3 py-2 text-right text-xs font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20">
                    {formatearMonto(dato.totalUSD)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

