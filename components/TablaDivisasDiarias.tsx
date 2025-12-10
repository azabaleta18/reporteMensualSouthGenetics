'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronRight, Loader2, AlertCircle, DollarSign, ChevronUp, Briefcase, Download } from 'lucide-react'
import { formatearMoneda, construirNombreBanco, construirCodigoBanco } from '@/lib/formato-moneda'
import { obtenerTasasCambio } from '@/lib/divisas'
import { exportarACSV } from '@/lib/exportar-csv'
import { exportarAExcel } from '@/lib/exportar-excel'
import { exportarTablaDivisasAPDF } from '@/lib/exportar-pdf-tabla-divisas'
import FiltrosTablaDivisas from './FiltrosTablaDivisas'
import type { 
  SaldoDiarioCuenta, 
  RegistroBD, 
  TotalDivisaDia, 
  DatosPorFecha 
} from '@/lib/tipos-divisas-diarias'

interface DatosPorMes {
  mes: string // formato: "2025-03"
  nombreMes: string // formato: "Marzo 2025"
  divisas: Map<string, TotalDivisaDia>
  diasDelMes: DatosPorFecha[]
}

// Orden específico de divisas
const ORDEN_DIVISAS = ['ARS', 'CLP', 'COP', 'EUR', 'MXN', 'USD', 'UYU']

interface Categoria {
  id_categoria: number
  nombre: string
  descripcion: string | null
}

interface Banco {
  id_banco: number
  nombre: string
}

interface Empresa {
  id_empresa: number
  nombre: string
}

export default function TablaDivisasDiarias() {
  const [datos, setDatos] = useState<SaldoDiarioCuenta[]>([])
  const [tasasCambio, setTasasCambio] = useState<Map<string, number>>(new Map()) // codigo_divisa -> unidades_por_usd
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<Set<number>>(new Set())
  const [bancos, setBancos] = useState<Banco[]>([])
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Set<number>>(new Set())
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<Set<number>>(new Set())
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [filtrosVisibles, setFiltrosVisibles] = useState<boolean>(false)
  const [saldosPorCategoria, setSaldosPorCategoria] = useState<SaldoDiarioCuenta[]>([]) // Saldos calculados desde movimientos con categoría
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCurrencies, setExpandedCurrencies] = useState<Set<string>>(new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [divisasEnUSD, setDivisasEnUSD] = useState<Set<string>>(new Set())
  const [divisasSeleccionadas, setDivisasSeleccionadas] = useState<Set<string>>(new Set(ORDEN_DIVISAS))

  useEffect(() => {
    cargarDatos()
    cargarCategorias()
    cargarBancos()
    cargarEmpresas()
  }, [])

  // Cargar y calcular saldos cuando cambian las categorías seleccionadas
  useEffect(() => {
    if (categoriasSeleccionadas.size > 0) {
      calcularSaldosPorCategoria()
    } else {
      // Si no hay categorías seleccionadas, limpiar los saldos calculados
      setSaldosPorCategoria([])
    }
  }, [categoriasSeleccionadas, datos])

  // Test de verificación (solo en desarrollo)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && datos.length > 0) {
      const fechas = datos.map(d => d.fecha).sort()
      const fechaMin = fechas[0]
      const fechaMax = fechas[fechas.length - 1]
      console.log('📊 Datos cargados en TablaDivisasDiarias:')
      console.log(`   Total registros: ${datos.length}`)
      console.log(`   Rango de fechas: ${fechaMin} → ${fechaMax}`)
      console.log(`   ¿Hay datos después del 2025-04-03? ${fechaMax > '2025-04-03' ? '✅ SÍ' : '❌ NO'}`)
    }
  }, [datos])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Iniciando carga de datos con paginación...')

      // Cargar tasas de cambio primero
      console.log('   💱 Cargando tasas de cambio...')
      const tasas = await obtenerTasasCambio()
      const tasasMap = new Map<string, number>()
      tasas.forEach(t => {
        tasasMap.set(t.codigo_divisa, t.unidades_por_usd)
      })
      setTasasCambio(tasasMap)
      console.log(`   ✅ Cargadas ${tasas.length} tasas de cambio`)

      // SOLUCIÓN: Usar paginación para obtener TODOS los datos
      // Supabase tiene un límite máximo por consulta, así que hacemos múltiples consultas
      let todosLosSaldos: any[] = []
      let desde = 0
      const tamañoPagina = 1000
      let hayMasDatos = true

      while (hayMasDatos) {
        console.log(`   📄 Cargando página desde registro ${desde}...`)

        const { data: saldosPagina, error: errorSaldos } = await supabase
          .from('saldo_diario_cuenta')
          .select(`
            id_cuenta,
            fecha,
            saldo_divisa,
            es_actual,
            cuenta (
              id_cuenta,
              id_banco_pais_divisa,
              id_empresa,
              id_tipo_cuenta,
              numero_cuenta,
              empresa (
                id_empresa,
                nombre
              ),
              banco_pais_divisa (
                id_banco_pais_divisa,
                codigo_divisa,
                banco_pais (
                  id_banco_pais,
                  codigo_pais,
                  banco (
                    id_banco,
                    nombre
                  ),
                  pais (
                    codigo_pais,
                    nombre
                  )
                ),
                divisa (
                  codigo_divisa,
                  nombre,
                  simbolo,
                  decimales
                )
              )
            )
          `)
          .order('fecha', { ascending: true })
          .range(desde, desde + tamañoPagina - 1)

        if (errorSaldos) {
          console.error('❌ ERROR en consulta Supabase:', errorSaldos)
          throw errorSaldos
        }

        if (saldosPagina && saldosPagina.length > 0) {
          todosLosSaldos = [...todosLosSaldos, ...saldosPagina]
          console.log(`   ✅ Cargados ${saldosPagina.length} registros (Total acumulado: ${todosLosSaldos.length})`)
          
          // Si recibimos menos registros que el tamaño de página, ya no hay más datos
          if (saldosPagina.length < tamañoPagina) {
            hayMasDatos = false
          } else {
            desde += tamañoPagina
          }
        } else {
          hayMasDatos = false
        }
      }

      console.log('🔍 DEBUG - Datos recibidos de Supabase (con paginación):')
      console.log('   Total registros:', todosLosSaldos.length)
      if (todosLosSaldos.length > 0) {
        const fechas = todosLosSaldos.map(s => s.fecha).sort()
        console.log('   Primera fecha:', fechas[0])
        console.log('   Última fecha:', fechas[fechas.length - 1])
        console.log('   Fechas únicas:', new Set(fechas).size)
      }

      setDatos(todosLosSaldos)
    } catch (err: any) {
      console.error('Error al cargar datos:', err)
      setError(err.message || 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  // Cargar categorías disponibles
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
        console.log(`✅ Cargadas ${data.length} categorías`)
      }
    } catch (err: any) {
      console.error('Error al cargar categorías:', err)
    }
  }

  const cargarBancos = async () => {
    try {
      const { data, error } = await supabase
        .from('banco')
        .select('id_banco, nombre')
        .order('nombre', { ascending: true })

      if (error) {
        console.error('Error al cargar bancos:', error)
        return
      }

      if (data) {
        setBancos(data)
        console.log(`✅ Cargados ${data.length} bancos`)
      }
    } catch (err: any) {
      console.error('Error al cargar bancos:', err)
    }
  }

  const cargarEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresa')
        .select('id_empresa, nombre')
        .order('nombre', { ascending: true })

      if (error) {
        console.error('Error al cargar empresas:', error)
        return
      }

      if (data) {
        setEmpresas(data)
        console.log(`✅ Cargadas ${data.length} empresas`)
      }
    } catch (err: any) {
      console.error('Error al cargar empresas:', err)
    }
  }

  // Calcular saldos desde movimientos con categorías seleccionadas
  const calcularSaldosPorCategoria = async () => {
    try {
      console.log('🔍 Calculando saldos desde movimientos con categorías seleccionadas...')
      
      const categoriasArray = Array.from(categoriasSeleccionadas)
      if (categoriasArray.length === 0) {
        setSaldosPorCategoria([])
        return
      }

      // Cargar TODOS los movimientos con las categorías seleccionadas (con paginación)
      let todosLosMovimientos: any[] = []
      let desde = 0
      const tamañoPagina = 1000
      let hayMasDatos = true

      while (hayMasDatos) {
        const { data: movimientosPagina, error: errorMovimientos } = await supabase
          .from('movimiento')
          .select(`
            id_movimiento,
            id_cuenta,
            fecha_mov,
            debito,
            credito,
            cuenta (
              id_cuenta,
              id_banco_pais_divisa,
              id_empresa,
              id_tipo_cuenta,
              numero_cuenta,
              empresa (
                id_empresa,
                nombre
              ),
              banco_pais_divisa (
                id_banco_pais_divisa,
                codigo_divisa,
                banco_pais (
                  id_banco_pais,
                  codigo_pais,
                  banco (
                    id_banco,
                    nombre
                  ),
                  pais (
                    codigo_pais,
                    nombre
                  )
                ),
                divisa (
                  codigo_divisa,
                  nombre,
                  simbolo,
                  decimales
                )
              )
            )
          `)
          .in('id_categoria', categoriasArray)
          .order('fecha_mov', { ascending: true })
          .order('id_odoo', { ascending: true })
          .range(desde, desde + tamañoPagina - 1)

        if (errorMovimientos) {
          console.error('❌ ERROR al cargar movimientos:', errorMovimientos)
          break
        }

        if (movimientosPagina && movimientosPagina.length > 0) {
          todosLosMovimientos = [...todosLosMovimientos, ...movimientosPagina]
          
          if (movimientosPagina.length < tamañoPagina) {
            hayMasDatos = false
          } else {
            desde += tamañoPagina
          }
        } else {
          hayMasDatos = false
        }
      }

      console.log(`✅ Cargados ${todosLosMovimientos.length} movimientos con categorías seleccionadas`)

      // Ordenar todos los movimientos por fecha y luego por id_odoo
      todosLosMovimientos.sort((a, b) => {
        const fechaCompare = a.fecha_mov.localeCompare(b.fecha_mov)
        if (fechaCompare !== 0) return fechaCompare
        return (a.id_odoo || 0) - (b.id_odoo || 0)
      })

      // Agrupar movimientos por fecha y cuenta
      const movimientosPorFechaCuenta = new Map<string, any[]>()
      
      todosLosMovimientos.forEach(mov => {
        const key = `${mov.fecha_mov}|${mov.id_cuenta}`
        if (!movimientosPorFechaCuenta.has(key)) {
          movimientosPorFechaCuenta.set(key, [])
        }
        movimientosPorFechaCuenta.get(key)!.push(mov)
      })

      // Ordenar las fechas
      const fechasOrdenadas = Array.from(movimientosPorFechaCuenta.keys())
        .map(key => key.split('|')[0])
        .filter((fecha, index, self) => self.indexOf(fecha) === index)
        .sort()

      // Calcular saldo acumulado por cuenta y fecha
      // IMPORTANTE: El saldo debe empezar desde 0 y solo acumular movimientos con la categoría seleccionada
      // Estructura: Map<"id_cuenta", Map<"fecha", saldo>>
      const saldosPorCuenta = new Map<number, Map<string, number>>()
      const cuentasInfo = new Map<number, any>()

      // Agrupar movimientos por cuenta y fecha para procesarlos correctamente
      // Necesitamos procesar todos los movimientos de una fecha antes de pasar a la siguiente
      const movimientosPorCuentaFecha = new Map<string, any[]>()
      
      todosLosMovimientos.forEach(mov => {
        const key = `${mov.id_cuenta}|${mov.fecha_mov}`
        if (!movimientosPorCuentaFecha.has(key)) {
          movimientosPorCuentaFecha.set(key, [])
        }
        movimientosPorCuentaFecha.get(key)!.push(mov)
        
        // Guardar info de la cuenta
        if (!cuentasInfo.has(mov.id_cuenta)) {
          cuentasInfo.set(mov.id_cuenta, mov.cuenta)
        }
      })

      // Ordenar las claves (cuenta|fecha) para procesar en orden cronológico
      const clavesOrdenadas = Array.from(movimientosPorCuentaFecha.keys()).sort((a, b) => {
        const [, fechaA] = a.split('|')
        const [, fechaB] = b.split('|')
        const fechaCompare = fechaA.localeCompare(fechaB)
        if (fechaCompare !== 0) return fechaCompare
        // Si es la misma fecha, mantener el orden original
        return 0
      })

      // Procesar cada grupo de movimientos (por cuenta y fecha) en orden cronológico
      clavesOrdenadas.forEach(key => {
        const [idCuentaStr, fecha] = key.split('|')
        const idCuenta = parseInt(idCuentaStr)
        const movimientos = movimientosPorCuentaFecha.get(key)!
        
        // Inicializar mapa de saldos para esta cuenta si no existe
        if (!saldosPorCuenta.has(idCuenta)) {
          saldosPorCuenta.set(idCuenta, new Map())
        }
        
        const saldosFechas = saldosPorCuenta.get(idCuenta)!
        
        // Obtener saldo anterior (última fecha antes de esta para esta cuenta)
        let saldoAnterior = 0
        const fechasAnteriores = Array.from(saldosFechas.keys())
          .filter(f => f < fecha)
          .sort()
        
        if (fechasAnteriores.length > 0) {
          // Obtener el saldo de la última fecha anterior
          const ultimaFechaAnterior = fechasAnteriores[fechasAnteriores.length - 1]
          saldoAnterior = saldosFechas.get(ultimaFechaAnterior) || 0
        }

        // Calcular el impacto total de todos los movimientos de esta fecha para esta cuenta
        let totalMovimientosFecha = 0
        movimientos.forEach(mov => {
          const credito = mov.credito || 0
          const debito = mov.debito || 0
          totalMovimientosFecha += credito - debito
        })

        // Saldo acumulado = saldo anterior + total de movimientos de esta fecha
        const saldoAcumulado = saldoAnterior + totalMovimientosFecha
        saldosFechas.set(fecha, saldoAcumulado)
      })

      // Convertir a formato SaldoDiarioCuenta[]
      const saldosCalculados: SaldoDiarioCuenta[] = []
      saldosPorCuenta.forEach((saldosFechas, idCuenta) => {
        const cuenta = cuentasInfo.get(idCuenta)
        saldosFechas.forEach((saldo, fecha) => {
          saldosCalculados.push({
            id_cuenta: idCuenta,
            fecha: fecha,
            saldo_divisa: saldo,
            es_actual: true,
            cuenta: cuenta
          })
        })
      })

      console.log(`✅ Calculados ${saldosCalculados.length} saldos desde movimientos con categorías`)
      
      // Debug: mostrar algunos saldos calculados
      if (saldosCalculados.length > 0) {
        console.log('📊 Ejemplo de saldos calculados (primeros 5):')
        saldosCalculados.slice(0, 5).forEach(s => {
          console.log(`   ${s.fecha} - Cuenta ${s.id_cuenta}: ${s.saldo_divisa}`)
        })
        
        // Encontrar el saldo máximo para cada cuenta
        const saldosMaximosPorCuenta = new Map<number, { fecha: string; saldo: number }>()
        saldosCalculados.forEach(s => {
          const actual = saldosMaximosPorCuenta.get(s.id_cuenta)
          if (!actual || s.saldo_divisa > actual.saldo) {
            saldosMaximosPorCuenta.set(s.id_cuenta, { fecha: s.fecha, saldo: s.saldo_divisa })
          }
        })
        
        console.log('📊 Saldos máximos por cuenta:')
        saldosMaximosPorCuenta.forEach((valor, idCuenta) => {
          console.log(`   Cuenta ${idCuenta}: ${valor.saldo} (fecha: ${valor.fecha})`)
        })
      }
      
      setSaldosPorCategoria(saldosCalculados)
    } catch (err: any) {
      console.error('Error al calcular saldos por categoría:', err)
      setSaldosPorCategoria([])
    }
  }

  // Función helper para calcular saldo_usd desde saldo_divisa y código de divisa
  const calcularSaldoUSD = useCallback((saldoDivisa: number, codigoDivisa: string): number => {
    if (codigoDivisa === 'USD') {
      return saldoDivisa // USD ya está en USD
    }
    const unidadesPorUSD = tasasCambio.get(codigoDivisa)
    if (!unidadesPorUSD || unidadesPorUSD === 0) {
      console.warn(`⚠️ No se encontró tasa de cambio para ${codigoDivisa}, usando 1`)
      return saldoDivisa // Fallback: asumir 1:1
    }
    return saldoDivisa / unidadesPorUSD
  }, [tasasCambio])

  // Procesar datos para obtener registros planos (usar saldos calculados por categoría si aplica)
  const registrosBD = useMemo<RegistroBD[]>(() => {
    // Si hay categorías seleccionadas, usar los saldos calculados desde movimientos
    // Si no, usar los datos normales
    const datosAUsar = categoriasSeleccionadas.size > 0 && saldosPorCategoria.length > 0
      ? saldosPorCategoria
      : datos

    let registros = datosAUsar.map(saldo => {
      const cuenta = saldo.cuenta as any
      const bancoPaisDivisa = cuenta?.banco_pais_divisa
      const divisa = bancoPaisDivisa?.divisa
      const bancoPais = bancoPaisDivisa?.banco_pais
      const banco = bancoPais?.banco
      const pais = bancoPais?.pais

      // Obtener descripción del tipo de cuenta
      let tipoCuentaDesc = ''
      if (cuenta?.id_tipo_cuenta === 1) {
        tipoCuentaDesc = 'CC' // Cuenta Corriente
      } else if (cuenta?.id_tipo_cuenta === 2) {
        tipoCuentaDesc = 'CA' // Caja de Ahorro
      }

      // Obtener información de la empresa
      const empresa = cuenta?.empresa
      const nombreEmpresa = empresa?.nombre || null
      
      // Construir nombre del banco incluyendo país y empresa
      let nombreBancoBase = banco?.nombre || 'Banco Desconocido'
      
      // Agregar país si está disponible
      if (pais?.nombre) {
        nombreBancoBase += ` - ${pais.nombre}`
      }
      
      // Agregar empresa si está disponible
      if (nombreEmpresa) {
        nombreBancoBase += ` - ${nombreEmpresa}`
      }
      
      // Agregar tipo de cuenta si está disponible
      if (tipoCuentaDesc) {
        nombreBancoBase += ` ${tipoCuentaDesc}`
      }

      const codigoBanco = construirCodigoBanco(
        banco?.id_banco || 0,
        cuenta?.id_tipo_cuenta || 0,
        pais?.codigo_pais || '',
        cuenta?.id_cuenta
      )

      return {
        fecha: saldo.fecha,
        codigo_divisa: divisa?.codigo_divisa || 'XXX',
        nombre_divisa: divisa?.nombre || 'Desconocida',
        simbolo_divisa: divisa?.simbolo || '$',
        decimales_divisa: divisa?.decimales || 2,
        nombre_banco: nombreBancoBase,
        codigo_banco: codigoBanco,
        saldo_divisa: saldo.saldo_divisa,
        id_banco: banco?.id_banco || 0,
        id_empresa: cuenta?.id_empresa || 0,
      }
    })

    // Aplicar filtros de fecha, banco y empresa
    if (fechaDesde || fechaHasta || bancosSeleccionados.size > 0 || empresasSeleccionadas.size > 0) {
      registros = registros.filter(registro => {
        // Filtro por fecha
        if (fechaDesde && registro.fecha < fechaDesde) {
          return false
        }
        if (fechaHasta && registro.fecha > fechaHasta) {
          return false
        }
        
        // Filtro por banco
        if (bancosSeleccionados.size > 0) {
          const bancoId = registro.id_banco
          if (!bancoId || !bancosSeleccionados.has(bancoId)) {
            return false
          }
        }
        
        // Filtro por empresa
        if (empresasSeleccionadas.size > 0) {
          const empresaId = registro.id_empresa
          if (!empresaId || !empresasSeleccionadas.has(empresaId)) {
            return false
          }
        }
        
        return true
      })
    }

    console.log('🔍 DEBUG - Registros procesados (registrosBD):')
    console.log('   Total registros:', registros.length)
    if (registros.length > 0) {
      const fechas = registros.map(r => r.fecha).sort()
      console.log('   Primera fecha:', fechas[0])
      console.log('   Última fecha:', fechas[fechas.length - 1])
      console.log('   Fechas únicas:', new Set(fechas).size)
    }

    return registros
  }, [datos, categoriasSeleccionadas, saldosPorCategoria, fechaDesde, fechaHasta, bancosSeleccionados, empresasSeleccionadas])

  // Mapear datos crudos para acceder a saldo_usd por fecha (calculado dinámicamente)
  const datosConUSD = useMemo(() => {
    const mapa = new Map<string, number>() // fecha -> total_usd
    datos.forEach(d => {
      const cuenta = d.cuenta as any
      const codigoDivisa = cuenta?.banco_pais_divisa?.divisa?.codigo_divisa || 'USD'
      const saldoUSD = calcularSaldoUSD(d.saldo_divisa, codigoDivisa)
      const totalActual = mapa.get(d.fecha) || 0
      mapa.set(d.fecha, totalActual + saldoUSD)
    })
    return mapa
  }, [datos, calcularSaldoUSD])

  // Mapear datos por fecha y divisa para calcular USD por divisa (calculado dinámicamente)
  const datosUSDPorDivisaFecha = useMemo(() => {
    const mapa = new Map<string, number>() // "fecha|codigo_divisa" -> total_usd_divisa
    datos.forEach(d => {
      const cuenta = d.cuenta as any
      const codigoDivisa = cuenta?.banco_pais_divisa?.divisa?.codigo_divisa
      if (codigoDivisa) {
        const saldoUSD = calcularSaldoUSD(d.saldo_divisa, codigoDivisa)
        const key = `${d.fecha}|${codigoDivisa}`
        const totalActual = mapa.get(key) || 0
        mapa.set(key, totalActual + saldoUSD)
      }
    })
    return mapa
  }, [datos, calcularSaldoUSD])

  // Mapear es_actual por fecha y cuenta
  const esActualMap = useMemo(() => {
    const mapa = new Map<string, boolean>() // "fecha|id_cuenta" -> es_actual
    datos.forEach(d => {
      const key = `${d.fecha}|${d.id_cuenta}`
      mapa.set(key, d.es_actual)
    })
    return mapa
  }, [datos])

  // Función para verificar si un saldo específico es actual
  const verificarSiEsActual = (fecha: string, codigoBanco: string, codigoDivisa: string): boolean => {
    // Buscar en los datos originales si alguna cuenta de este banco/divisa en esta fecha es no actual
    const saldosDelDia = datos.filter(d => d.fecha === fecha)
    for (const saldo of saldosDelDia) {
      const cuenta = saldo.cuenta as any
      const bancoPaisDivisa = cuenta?.banco_pais_divisa
      const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
      const bancoPais = bancoPaisDivisa?.banco_pais
      const banco = bancoPais?.banco
      const pais = bancoPais?.pais
      
      let tipoCuentaDesc = ''
      if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
      else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
      
      const codigoBancoActual = construirCodigoBanco(
        banco?.id_banco || 0,
        cuenta?.id_tipo_cuenta || 0,
        pais?.codigo_pais || '',
        cuenta?.id_cuenta
      )
      
      if (codigoBancoActual === codigoBanco && divisa === codigoDivisa) {
        if (!saldo.es_actual) {
          return false // No es actual
        }
      }
    }
    return true // Es actual
  }

  // Función para verificar si tiene movimientos actuales (es_actual = true)
  const tieneMovimientosActuales = (fecha: string, codigoBanco: string, codigoDivisa: string): boolean => {
    const saldosDelDia = datos.filter(d => d.fecha === fecha)
    for (const saldo of saldosDelDia) {
      const cuenta = saldo.cuenta as any
      const bancoPaisDivisa = cuenta?.banco_pais_divisa
      const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
      const bancoPais = bancoPaisDivisa?.banco_pais
      const banco = bancoPais?.banco
      const pais = bancoPais?.pais
      
      let tipoCuentaDesc = ''
      if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
      else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
      
      const codigoBancoActual = construirCodigoBanco(
        banco?.id_banco || 0,
        cuenta?.id_tipo_cuenta || 0,
        pais?.codigo_pais || '',
        cuenta?.id_cuenta
      )
      
      if (codigoBancoActual === codigoBanco && divisa === codigoDivisa) {
        if (saldo.es_actual) {
          return true // Tiene al menos un saldo actual
        }
      }
    }
    return false // No tiene saldos actuales
  }

  // Función para obtener el ID del banco
  const obtenerIdBanco = (codigoBanco: string, codigoDivisa: string): number => {
    for (const saldo of datos) {
      const cuenta = saldo.cuenta as any
      const bancoPaisDivisa = cuenta?.banco_pais_divisa
      const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
      const bancoPais = bancoPaisDivisa?.banco_pais
      const banco = bancoPais?.banco
      const pais = bancoPais?.pais
      
      let tipoCuentaDesc = ''
      if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
      else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
      
      const codigoBancoActual = construirCodigoBanco(
        banco?.id_banco || 0,
        cuenta?.id_tipo_cuenta || 0,
        pais?.codigo_pais || '',
        cuenta?.id_cuenta
      )
      
      if (codigoBancoActual === codigoBanco && divisa === codigoDivisa) {
        return banco?.id_banco || 0
      }
    }
    return 0
  }

  // Función para obtener el ID de la cuenta
  const obtenerIdCuenta = (codigoBanco: string, codigoDivisa: string): number | null => {
    for (const saldo of datos) {
      const cuenta = saldo.cuenta as any
      const bancoPaisDivisa = cuenta?.banco_pais_divisa
      const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
      const bancoPais = bancoPaisDivisa?.banco_pais
      const banco = bancoPais?.banco
      const pais = bancoPais?.pais
      
      const codigoBancoActual = construirCodigoBanco(
        banco?.id_banco || 0,
        cuenta?.id_tipo_cuenta || 0,
        pais?.codigo_pais || '',
        cuenta?.id_cuenta
      )
      
      if (codigoBancoActual === codigoBanco && divisa === codigoDivisa) {
        return cuenta?.id_cuenta || null
      }
    }
    return null
  }

  // Función para manejar el click en la fecha de un mes
  const handleFechaMesClick = (mes: string) => {
    console.log('🔍 Abriendo movimientos del mes:', {
      mes,
      categorias: Array.from(categoriasSeleccionadas)
    })

    // Calcular primer y último día del mes
    const [año, mesNum] = mes.split('-')
    const primerDia = `${año}-${mesNum}-01`
    const ultimoDia = new Date(parseInt(año), parseInt(mesNum), 0).toISOString().split('T')[0]
    
    // Construir URL con parámetros para /movimientos-todos (sin filtrar por banco o divisa)
    const params = new URLSearchParams({
      fechaDesde: primerDia,
      fechaHasta: ultimoDia
    })

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos-todos
    window.open(`/movimientos-todos?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  // Función para manejar el click en la fecha de un día
  const handleFechaDiaClick = (fecha: string) => {
    console.log('🔍 Abriendo movimientos del día:', {
      fecha,
      categorias: Array.from(categoriasSeleccionadas)
    })

    // Construir URL con parámetros para /movimientos-todos (sin filtrar por banco o divisa)
    const params = new URLSearchParams({
      fechaDesde: fecha,
      fechaHasta: fecha
    })

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos-todos
    window.open(`/movimientos-todos?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  // Función para manejar el click en una celda de día
  const handleCellClick = (fecha: string, nombreBanco: string, codigoBanco: string, codigoDivisa: string) => {
    const tieneActuales = tieneMovimientosActuales(fecha, codigoBanco, codigoDivisa)
    
    if (!tieneActuales) {
      console.log('⚠️ Esta celda no tiene movimientos actuales (es_actual = false)')
      return
    }

    const idCuenta = obtenerIdCuenta(codigoBanco, codigoDivisa)
    
    if (!idCuenta) {
      console.error('❌ No se pudo obtener el id_cuenta')
      return
    }
    
    console.log('🔍 Abriendo movimientos del día:', {
      fecha,
      nombreBanco,
      cuentaId: idCuenta,
      codigoDivisa,
      categorias: Array.from(categoriasSeleccionadas)
    })

    // Construir URL con parámetros para /movimientos-todos
    const params = new URLSearchParams({
      fechaDesde: fecha,
      fechaHasta: fecha,
      cuentaId: idCuenta.toString(),
      codigoDivisa,
      bancoNombre: nombreBanco
    })

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos-todos
    window.open(`/movimientos-todos?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  // Función para manejar el click en una celda de mes (todos los movimientos del mes)
  const handleMonthCellClick = (mes: string, nombreBanco: string, codigoBanco: string, codigoDivisa: string, soloDivisa: boolean = false) => {
    console.log('🔍 Abriendo movimientos del mes completo:', {
      mes,
      nombreBanco,
      codigoDivisa,
      soloDivisa,
      categorias: Array.from(categoriasSeleccionadas)
    })

    // Calcular primer y último día del mes
    const [año, mesNum] = mes.split('-')
    const primerDia = `${año}-${mesNum}-01`
    const ultimoDia = new Date(parseInt(año), parseInt(mesNum), 0).toISOString().split('T')[0]
    
    // Construir URL con parámetros para /movimientos-todos
    const params = new URLSearchParams({
      fechaDesde: primerDia,
      fechaHasta: ultimoDia,
      codigoDivisa
    })

    // Solo agregar cuentaId si NO es solo por divisa (es decir, si se hace clic en una celda de banco específica)
    if (!soloDivisa) {
      const idCuenta = obtenerIdCuenta(codigoBanco, codigoDivisa)
      if (idCuenta) {
        params.set('cuentaId', idCuenta.toString())
        params.set('bancoNombre', nombreBanco)
      }
    }

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos-todos
    window.open(`/movimientos-todos?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  // Función para manejar el click en el nombre del banco (todos los movimientos del banco)
  const handleBancoClick = (nombreBanco: string, codigoBanco: string, codigoDivisa: string) => {
    const idBanco = obtenerIdBanco(codigoBanco, codigoDivisa)
    
    console.log('🔍 Abriendo todos los movimientos del banco:', {
      nombreBanco,
      bancoId: idBanco,
      codigoDivisa,
      categorias: Array.from(categoriasSeleccionadas)
    })

    // Construir URL con parámetros para /movimientos-todos
    const params = new URLSearchParams({
      bancoId: idBanco.toString(),
      codigoDivisa,
      bancoNombre: nombreBanco
    })

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos-todos
    window.open(`/movimientos-todos?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  // Agrupar datos por fecha (nivel diario)
  const datosPorFecha = useMemo<DatosPorFecha[]>(() => {
    const mapa = new Map<string, Map<string, TotalDivisaDia>>()

    // Agrupar por fecha y divisa
    registrosBD.forEach(registro => {
      if (!mapa.has(registro.fecha)) {
        mapa.set(registro.fecha, new Map())
      }

      const divisasPorFecha = mapa.get(registro.fecha)!

      if (!divisasPorFecha.has(registro.codigo_divisa)) {
        divisasPorFecha.set(registro.codigo_divisa, {
          fecha: registro.fecha,
          codigo_divisa: registro.codigo_divisa,
          total: 0,
          bancos: [],
        })
      }

      const divisaData = divisasPorFecha.get(registro.codigo_divisa)!
      divisaData.total += registro.saldo_divisa

      // Buscar si ya existe este banco
      const bancoExistente = divisaData.bancos.find(
        b => b.codigo_banco === registro.codigo_banco
      )

      if (bancoExistente) {
        bancoExistente.total += registro.saldo_divisa
      } else {
        divisaData.bancos.push({
          fecha: registro.fecha,
          codigo_banco: registro.codigo_banco,
          nombre_banco: registro.nombre_banco,
          total: registro.saldo_divisa,
        })
      }
    })

    // Convertir a array y ordenar por fecha
    const resultado = Array.from(mapa.entries())
      .map(([fecha, divisas]) => ({
        fecha,
        divisas,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    console.log('🔍 DEBUG - Datos por fecha (datosPorFecha):')
    console.log('   Total fechas:', resultado.length)
    if (resultado.length > 0) {
      console.log('   Primera fecha:', resultado[0].fecha)
      console.log('   Última fecha:', resultado[resultado.length - 1].fecha)
    }

    return resultado
  }, [registrosBD])

  // Agrupar datos por mes (vista mensual)
  const datosPorMes = useMemo<DatosPorMes[]>(() => {
    const mapaMeses = new Map<string, DatosPorMes>()

    datosPorFecha.forEach(datoFecha => {
      // Extraer año-mes de la fecha (formato: "2025-03")
      const mes = datoFecha.fecha.substring(0, 7)

      if (!mapaMeses.has(mes)) {
        // Crear objeto de mes con formato MM/YYYY
        const [anio, mesNum] = mes.split('-')
        const nombreMes = `${mesNum}/${anio}` // Formato: 12/2025

        mapaMeses.set(mes, {
          mes,
          nombreMes: nombreMes,
          divisas: new Map(),
          diasDelMes: [],
        })
      }

      const mesData = mapaMeses.get(mes)!

      // Agregar día a la lista de días del mes
      mesData.diasDelMes.push(datoFecha)

      // Siempre actualizar con el día más reciente (último balance)
      // Como los datos vienen ordenados por fecha, el último que procese será el más reciente
      datoFecha.divisas.forEach((divisaData, codigoDivisa) => {
        mesData.divisas.set(codigoDivisa, {
          fecha: datoFecha.fecha, // Guardar la fecha del último día
          codigo_divisa: codigoDivisa,
          total: divisaData.total, // Balance del último día
          bancos: divisaData.bancos.map(b => ({ ...b })), // Copiar bancos con sus balances del último día
        })
      })
    })

    // Convertir a array y ordenar por mes (más antiguo primero, más reciente abajo)
    const resultado = Array.from(mapaMeses.values()).sort((a, b) => a.mes.localeCompare(b.mes))

    console.log('🔍 DEBUG - Datos por mes (datosPorMes):')
    console.log('   Total meses:', resultado.length)
    if (resultado.length > 0) {
      console.log('   Primer mes (arriba):', resultado[0].mes, '-', resultado[0].nombreMes)
      console.log('   Último mes (abajo):', resultado[resultado.length - 1].mes, '-', resultado[resultado.length - 1].nombreMes)
      console.log('   Meses:', resultado.map(m => m.mes).join(', '))
    }

    return resultado
  }, [datosPorFecha])

  // Obtener lista única de divisas ORDENADAS según ORDEN_DIVISAS
  const todasLasDivisas = useMemo(() => {
    const divisasSet = new Set<string>()
    const divisasInfo = new Map<string, { nombre: string; simbolo: string; decimales: number }>()

    registrosBD.forEach(registro => {
      divisasSet.add(registro.codigo_divisa)
      if (!divisasInfo.has(registro.codigo_divisa)) {
        divisasInfo.set(registro.codigo_divisa, {
          nombre: registro.nombre_divisa,
          simbolo: registro.simbolo_divisa,
          decimales: registro.decimales_divisa,
        })
      }
    })

    // Ordenar según ORDEN_DIVISAS
    const divisasArray = Array.from(divisasSet).map(codigo => ({
      codigo,
      ...divisasInfo.get(codigo)!,
    }))

    return divisasArray.sort((a, b) => {
      const indexA = ORDEN_DIVISAS.indexOf(a.codigo)
      const indexB = ORDEN_DIVISAS.indexOf(b.codigo)
      
      // Si ambas están en el orden, usar ese orden
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      }
      // Si solo A está en el orden, A va primero
      if (indexA !== -1) return -1
      // Si solo B está en el orden, B va primero
      if (indexB !== -1) return 1
      // Si ninguna está en el orden, ordenar alfabéticamente
      return a.codigo.localeCompare(b.codigo)
    })
  }, [registrosBD])

  // Filtrar divisas según selección
  const divisasUnicas = useMemo(() => {
    return todasLasDivisas.filter(d => divisasSeleccionadas.has(d.codigo))
  }, [todasLasDivisas, divisasSeleccionadas])

  // Obtener lista de bancos por divisa (solo los que tienen movimientos actuales)
  const bancosPorDivisa = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    const nombresMap = new Map<string, string>()

    // Primero, identificar qué cuentas tienen movimientos actuales
    const cuentasConMovimientos = new Set<string>() // "codigo_banco|codigo_divisa"
    
    datos.forEach(saldo => {
      if (saldo.es_actual) {
        const cuenta = saldo.cuenta as any
        const bancoPaisDivisa = cuenta?.banco_pais_divisa
        const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
        const bancoPais = bancoPaisDivisa?.banco_pais
        const banco = bancoPais?.banco
        const pais = bancoPais?.pais
        
        let tipoCuentaDesc = ''
        if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
        else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
        
        const codigoBanco = construirCodigoBanco(
          banco?.id_banco || 0,
          cuenta?.id_tipo_cuenta || 0,
          pais?.codigo_pais || '',
          cuenta?.id_cuenta
        )
        
        if (divisa) {
          cuentasConMovimientos.add(`${codigoBanco}|${divisa}`)
        }
      }
    })

    // Solo agregar bancos que tienen movimientos actuales
    registrosBD.forEach(registro => {
      const key = `${registro.codigo_banco}|${registro.codigo_divisa}`
      if (cuentasConMovimientos.has(key)) {
        if (!mapa.has(registro.codigo_divisa)) {
          mapa.set(registro.codigo_divisa, new Set())
        }
        mapa.get(registro.codigo_divisa)!.add(registro.codigo_banco)
        nombresMap.set(registro.codigo_banco, registro.nombre_banco)
      }
    })

    const resultado = new Map<string, Array<{ codigo: string; nombre: string }>>()
    mapa.forEach((bancos, divisa) => {
      resultado.set(
        divisa,
        Array.from(bancos).map(codigo => ({
          codigo,
          nombre: nombresMap.get(codigo) || codigo,
        }))
      )
    })

    return resultado
  }, [registrosBD, datos])

  const toggleDivisa = (codigoDivisa: string) => {
    setExpandedCurrencies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(codigoDivisa)) {
        newSet.delete(codigoDivisa)
      } else {
        newSet.add(codigoDivisa)
      }
      return newSet
    })
  }

  const toggleMes = (mes: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(mes)) {
        newSet.delete(mes)
      } else {
        newSet.add(mes)
      }
      return newSet
    })
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

  const toggleDivisaSeleccionada = (codigoDivisa: string) => {
    setDivisasSeleccionadas(prev => {
      const newSet = new Set(prev)
      if (newSet.has(codigoDivisa)) {
        newSet.delete(codigoDivisa)
      } else {
        newSet.add(codigoDivisa)
      }
      return newSet
    })
  }

  // Convertir todas las divisas a USD
  const convertirTodoAUSD = () => {
    const todasLasDivisas = Array.from(divisasSeleccionadas).filter(d => d !== 'USD')
    setDivisasEnUSD(new Set(todasLasDivisas))
  }

  // Volver todas las divisas a su moneda original
  const volverTodoAOriginal = () => {
    setDivisasEnUSD(new Set())
  }

  // Exportar datos de la tabla a CSV
  const exportarTablaCSV = () => {
    const datosExportar: any[] = []

    // Recorrer todos los meses
    datosPorMes.forEach(datoMes => {
      // Recorrer todas las divisas visibles
      divisasUnicas.forEach(divisa => {
        const isExpanded = expandedCurrencies.has(divisa.codigo)
        const bancos = bancosPorDivisa.get(divisa.codigo) || []
        const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)
        const divisaData = datoMes.divisas.get(divisa.codigo)
        
        if (isExpanded && bancos.length > 0) {
          // Exportar datos por banco
          bancos.forEach(banco => {
            const bancoData = divisaData?.bancos.find(b => b.codigo_banco === banco.codigo)
            const valor = bancoData?.total || 0
            const tasa = tasasCambio.get(divisa.codigo) || 1
            const valorEnUSD = valor / tasa

            datosExportar.push({
              Periodo: datoMes.nombreMes,
              Tipo: 'Banco',
              Divisa: divisa.codigo,
              Banco: banco.nombre,
              Valor: enUSD ? valorEnUSD : valor,
              Moneda: enUSD ? 'USD' : divisa.codigo,
              ValorUSD: valorEnUSD
            })
          })
          
          // Exportar total de la divisa
          const totalDivisa = divisaData?.total || 0
          const totalUSDDivisa = totalDivisa / (tasasCambio.get(divisa.codigo) || 1)
          
          datosExportar.push({
            Periodo: datoMes.nombreMes,
            Tipo: 'Total Divisa',
            Divisa: divisa.codigo,
            Banco: '-',
            Valor: enUSD ? totalUSDDivisa : totalDivisa,
            Moneda: enUSD ? 'USD' : divisa.codigo,
            ValorUSD: totalUSDDivisa
          })
        } else {
          // Exportar total de la divisa (no expandida)
          const totalDivisa = divisaData?.total || 0
          const totalUSDDivisa = totalDivisa / (tasasCambio.get(divisa.codigo) || 1)
          
          datosExportar.push({
            Periodo: datoMes.nombreMes,
            Tipo: 'Total Divisa',
            Divisa: divisa.codigo,
            Banco: '-',
            Valor: enUSD ? totalUSDDivisa : totalDivisa,
            Moneda: enUSD ? 'USD' : divisa.codigo,
            ValorUSD: totalUSDDivisa
          })
        }
      })
    })

    // Agregar fila de porcentajes si hay datos
    if (datosPorMes.length > 0 && divisasUnicas.length > 0) {
      const ultimoMes = datosPorMes[datosPorMes.length - 1]
      let totalGeneralUSD = 0
      
      divisasUnicas.forEach(divisa => {
        const divisaData = ultimoMes.divisas.get(divisa.codigo)
        const totalDivisa = divisaData?.total || 0
        const tasa = tasasCambio.get(divisa.codigo) || 1
        totalGeneralUSD += totalDivisa / tasa
      })

      divisasUnicas.forEach(divisa => {
        const divisaData = ultimoMes.divisas.get(divisa.codigo)
        const totalDivisa = divisaData?.total || 0
        const tasa = tasasCambio.get(divisa.codigo) || 1
        const totalUSDDivisa = totalDivisa / tasa
        const porcentaje = totalGeneralUSD > 0 ? (totalUSDDivisa / totalGeneralUSD) * 100 : 0

        datosExportar.push({
          Periodo: '% del Total USD',
          Tipo: 'Porcentaje',
          Divisa: divisa.codigo,
          Banco: '-',
          Valor: porcentaje.toFixed(2) + '%',
          Moneda: 'USD',
          ValorUSD: porcentaje
        })
      })
    }

    const fechaActual = new Date().toISOString().split('T')[0]
    exportarACSV(
      datosExportar,
      `balances_southgenetics_${fechaActual}.csv`,
      {
        Periodo: 'Período',
        Tipo: 'Tipo',
        Divisa: 'Divisa',
        Banco: 'Banco',
        Valor: 'Valor',
        Moneda: 'Moneda',
        ValorUSD: 'Valor USD'
      }
    )
  }

  // Exportar datos de la tabla a PDF
  const exportarTablaPDF = () => {
    const fechaActual = new Date().toISOString().split('T')[0]
    
    exportarTablaDivisasAPDF(
      {
        datosPorMes,
        divisasUnicas,
        bancosPorDivisa,
        expandedMonths,
        expandedCurrencies,
        divisasEnUSD,
        tasasCambio,
        datos,
        calcularSaldoUSD
      },
      `balances_southgenetics_${fechaActual}.pdf`
    )
  }

  // Exportar datos de la tabla a Excel
  const exportarTablaExcel = () => {
    const datosExportar: any[] = []

    // Recorrer todos los meses
    datosPorMes.forEach(datoMes => {
      // Recorrer todas las divisas visibles
      divisasUnicas.forEach(divisa => {
        const isExpanded = expandedCurrencies.has(divisa.codigo)
        const bancos = bancosPorDivisa.get(divisa.codigo) || []
        const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)
        const divisaData = datoMes.divisas.get(divisa.codigo)
        
        if (isExpanded && bancos.length > 0) {
          // Exportar datos por banco
          bancos.forEach(banco => {
            const bancoData = divisaData?.bancos.find(b => b.codigo_banco === banco.codigo)
            const valor = bancoData?.total || 0
            const tasa = tasasCambio.get(divisa.codigo) || 1
            const valorEnUSD = valor / tasa

            datosExportar.push({
              Periodo: datoMes.nombreMes,
              Tipo: 'Banco',
              Divisa: divisa.codigo,
              Banco: banco.nombre,
              Valor: enUSD ? valorEnUSD : valor,
              Moneda: enUSD ? 'USD' : divisa.codigo,
              ValorUSD: valorEnUSD
            })
          })
          
          // Exportar total de la divisa
          const totalDivisa = divisaData?.total || 0
          const totalUSDDivisa = totalDivisa / (tasasCambio.get(divisa.codigo) || 1)
          
          datosExportar.push({
            Periodo: datoMes.nombreMes,
            Tipo: 'Total Divisa',
            Divisa: divisa.codigo,
            Banco: '-',
            Valor: enUSD ? totalUSDDivisa : totalDivisa,
            Moneda: enUSD ? 'USD' : divisa.codigo,
            ValorUSD: totalUSDDivisa
          })
        } else {
          // Exportar total de la divisa (no expandida)
          const totalDivisa = divisaData?.total || 0
          const totalUSDDivisa = totalDivisa / (tasasCambio.get(divisa.codigo) || 1)
          
          datosExportar.push({
            Periodo: datoMes.nombreMes,
            Tipo: 'Total Divisa',
            Divisa: divisa.codigo,
            Banco: '-',
            Valor: enUSD ? totalUSDDivisa : totalDivisa,
            Moneda: enUSD ? 'USD' : divisa.codigo,
            ValorUSD: totalUSDDivisa
          })
        }
      })
    })

    // Agregar fila de porcentajes si hay datos
    if (datosPorMes.length > 0 && divisasUnicas.length > 0) {
      const ultimoMes = datosPorMes[datosPorMes.length - 1]
      let totalGeneralUSD = 0
      
      divisasUnicas.forEach(divisa => {
        const divisaData = ultimoMes.divisas.get(divisa.codigo)
        const totalDivisa = divisaData?.total || 0
        const tasa = tasasCambio.get(divisa.codigo) || 1
        totalGeneralUSD += totalDivisa / tasa
      })

      divisasUnicas.forEach(divisa => {
        const divisaData = ultimoMes.divisas.get(divisa.codigo)
        const totalDivisa = divisaData?.total || 0
        const tasa = tasasCambio.get(divisa.codigo) || 1
        const totalUSDDivisa = totalDivisa / tasa
        const porcentaje = totalGeneralUSD > 0 ? (totalUSDDivisa / totalGeneralUSD) * 100 : 0

        datosExportar.push({
          Periodo: '% del Total USD',
          Tipo: 'Porcentaje',
          Divisa: divisa.codigo,
          Banco: '-',
          Valor: porcentaje,
          Moneda: 'USD',
          ValorUSD: porcentaje
        })
      })
    }

    const fechaActual = new Date().toISOString().split('T')[0]
    exportarAExcel(
      datosExportar,
      `balances_southgenetics_${fechaActual}.xlsx`,
      'Balances',
      {
        Periodo: 'Período',
        Tipo: 'Tipo',
        Divisa: 'Divisa',
        Banco: 'Banco',
        Valor: 'Valor',
        Moneda: 'Moneda',
        ValorUSD: 'Valor USD'
      }
    )
  }

  const toggleCategoria = (idCategoria: number) => {
    setCategoriasSeleccionadas(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idCategoria)) {
        newSet.delete(idCategoria)
      } else {
        newSet.add(idCategoria)
      }
      return newSet
    })
  }

  const expandirTodosMeses = () => {
    const todosMeses = new Set(datosPorMes.map(m => m.mes))
    setExpandedMonths(todosMeses)
  }

  const colapsarTodosMeses = () => {
    setExpandedMonths(new Set())
  }

  const expandirTodasDivisas = () => {
    const todasDivisas = new Set(divisasUnicas.filter(d => divisasSeleccionadas.has(d.codigo)).map(d => d.codigo))
    setExpandedCurrencies(todasDivisas)
  }

  const colapsarTodasDivisas = () => {
    setExpandedCurrencies(new Set())
  }

  if (loading) {
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

  if (datosPorMes.length === 0) {
    return (
      <>
        <FiltrosTablaDivisas
          divisasDisponibles={todasLasDivisas}
          divisasSeleccionadas={divisasSeleccionadas}
          onToggleDivisa={toggleDivisaSeleccionada}
          onExpandirTodosMeses={expandirTodosMeses}
          onColapsarTodosMeses={colapsarTodosMeses}
          onExpandirTodasDivisas={expandirTodasDivisas}
          onColapsarTodasDivisas={colapsarTodasDivisas}
          todosMesesExpandidos={expandedMonths.size === datosPorMes.length}
          todasDivisasExpandidas={expandedCurrencies.size === divisasUnicas.length}
          categorias={categorias}
          categoriasSeleccionadas={categoriasSeleccionadas}
          onToggleCategoria={toggleCategoria}
          bancos={bancos}
          bancosSeleccionados={bancosSeleccionados}
          onToggleBanco={(idBanco) => {
            setBancosSeleccionados(prev => {
              const newSet = new Set(prev)
              if (newSet.has(idBanco)) {
                newSet.delete(idBanco)
              } else {
                newSet.add(idBanco)
              }
              return newSet
            })
          }}
          empresas={empresas}
          empresasSeleccionadas={empresasSeleccionadas}
          onToggleEmpresa={(idEmpresa) => {
            setEmpresasSeleccionadas(prev => {
              const newSet = new Set(prev)
              if (newSet.has(idEmpresa)) {
                newSet.delete(idEmpresa)
              } else {
                newSet.add(idEmpresa)
              }
              return newSet
            })
          }}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          onFechaDesdeChange={setFechaDesde}
        onFechaHastaChange={setFechaHasta}
        filtrosVisibles={filtrosVisibles}
        onToggleFiltrosVisibles={() => setFiltrosVisibles(!filtrosVisibles)}
        loading={loading}
        onConvertirTodoAUSD={convertirTodoAUSD}
        onVolverTodoAOriginal={volverTodoAOriginal}
        todasEnUSD={divisasSeleccionadas.size > 0 && Array.from(divisasSeleccionadas).filter(d => d !== 'USD').every(d => divisasEnUSD.has(d))}
      />
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-yellow-900 font-semibold mb-1">Sin datos</h3>
              <p className="text-yellow-700 text-sm">
                No hay saldos diarios registrados en la base de datos.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const todosMesesExpandidos = expandedMonths.size === datosPorMes.length
  const todasDivisasExpandidas = expandedCurrencies.size === divisasUnicas.length

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Tabla de Balances</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarTablaCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            title="Exportar tabla actual a CSV"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            onClick={exportarTablaExcel}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="Exportar tabla actual a Excel"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
          <button
            onClick={exportarTablaPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            title="Exportar tabla actual a PDF"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>
      </div>
      <FiltrosTablaDivisas
        divisasDisponibles={todasLasDivisas}
        divisasSeleccionadas={divisasSeleccionadas}
        onToggleDivisa={toggleDivisaSeleccionada}
        onExpandirTodosMeses={expandirTodosMeses}
        onColapsarTodosMeses={colapsarTodosMeses}
        onExpandirTodasDivisas={expandirTodasDivisas}
        onColapsarTodasDivisas={colapsarTodasDivisas}
        todosMesesExpandidos={todosMesesExpandidos}
        todasDivisasExpandidas={todasDivisasExpandidas}
        // No pasar categorías para la tabla de balances
        // categorias={categorias}
        // categoriasSeleccionadas={categoriasSeleccionadas}
        // onToggleCategoria={toggleCategoria}
        bancos={bancos}
        bancosSeleccionados={bancosSeleccionados}
        onToggleBanco={(idBanco) => {
          setBancosSeleccionados(prev => {
            const newSet = new Set(prev)
            if (newSet.has(idBanco)) {
              newSet.delete(idBanco)
            } else {
              newSet.add(idBanco)
            }
            return newSet
          })
        }}
        empresas={empresas}
        empresasSeleccionadas={empresasSeleccionadas}
        onToggleEmpresa={(idEmpresa) => {
          setEmpresasSeleccionadas(prev => {
            const newSet = new Set(prev)
            if (newSet.has(idEmpresa)) {
              newSet.delete(idEmpresa)
            } else {
              newSet.add(idEmpresa)
            }
            return newSet
          })
        }}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onFechaDesdeChange={setFechaDesde}
        onFechaHastaChange={setFechaHasta}
        filtrosVisibles={filtrosVisibles}
        onToggleFiltrosVisibles={() => setFiltrosVisibles(!filtrosVisibles)}
        loading={loading}
        onConvertirTodoAUSD={convertirTodoAUSD}
        onVolverTodoAOriginal={volverTodoAOriginal}
        todasEnUSD={divisasSeleccionadas.size > 0 && Array.from(divisasSeleccionadas).filter(d => d !== 'USD').every(d => divisasEnUSD.has(d))}
      />
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="overflow-auto max-h-[calc(100vh-200px)]" 
        style={{ 
          scrollbarWidth: 'auto',
          scrollbarColor: '#94a3b8 #e2e8f0'
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            height: 20px;
            width: 12px;
            -webkit-appearance: none;
          }
          div::-webkit-scrollbar-track {
            background: #e2e8f0;
            border-radius: 10px;
          }
          div::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 10px;
            border: 2px solid #e2e8f0;
          }
          div::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
          /* Forzar visibilidad de scrollbar en Firefox */
          div {
            scrollbar-width: thin;
            scrollbar-color: #94a3b8 #e2e8f0;
          }
        `}</style>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-100 z-30">
                Período
              </th>
              {divisasUnicas.map(divisa => {
                const isExpanded = expandedCurrencies.has(divisa.codigo)
                const bancos = bancosPorDivisa.get(divisa.codigo) || []
                // USD siempre se muestra en USD (no necesita conversión)
                const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)

                if (isExpanded && bancos.length > 0) {
                  // Mostrar columnas de bancos + columna total
                  return (
                    <React.Fragment key={divisa.codigo}>
                      <th
                        className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-l-2 border-gray-400"
                        colSpan={bancos.length + 1}
                      >
                        <div className="flex items-center justify-center gap-2 min-h-[32px]">
                          <button
                            onClick={() => toggleDivisa(divisa.codigo)}
                            className="hover:bg-gray-200 rounded p-1 transition-colors flex-shrink-0"
                            title="Colapsar divisa"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <span className="whitespace-nowrap">
                            {divisa.codigo} {enUSD && divisa.codigo !== 'USD' && '(USD)'}
                          </span>
                          {divisa.codigo !== 'USD' && (
                            <button
                              onClick={() => toggleDivisaEnUSD(divisa.codigo)}
                              className={`hover:bg-gray-200 rounded p-1 transition-colors flex-shrink-0 ${
                                enUSD ? 'bg-green-200 text-green-700' : ''
                              }`}
                              title={enUSD ? 'Mostrar en divisa original' : 'Mostrar en USD'}
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </th>
                    </React.Fragment>
                  )
                } else {
                  // Mostrar columna de divisa normal
                  return (
                    <th
                      key={divisa.codigo}
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-l-2 border-gray-400"
                    >
                      <div className="flex items-center justify-center gap-2 min-h-[32px]">
                        {bancos.length > 0 && (
                          <button
                            onClick={() => toggleDivisa(divisa.codigo)}
                            className="hover:bg-gray-200 rounded p-1 transition-colors flex-shrink-0"
                            title="Expandir divisa"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                        <span className="whitespace-nowrap">
                          {divisa.codigo} {enUSD && divisa.codigo !== 'USD' && '(USD)'}
                        </span>
                        {divisa.codigo !== 'USD' && (
                          <button
                            onClick={() => toggleDivisaEnUSD(divisa.codigo)}
                            className={`hover:bg-gray-200 rounded p-1 transition-colors flex-shrink-0 ${
                              enUSD ? 'bg-green-200 text-green-700' : ''
                            }`}
                            title={enUSD ? 'Mostrar en divisa original' : 'Mostrar en USD'}
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </th>
                  )
                }
              })}
              {/* Columna TOTAL USD */}
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 bg-gray-200 border-l-2 border-gray-400">
                TOTAL USD
              </th>
            </tr>
            {/* Fila de subencabezados para bancos expandidos */}
            <tr className="bg-gray-50 border-b border-gray-200 sticky top-[56px] z-20">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 sticky left-0 bg-gray-50 z-30"></th>
              {divisasUnicas.map(divisa => {
                const isExpanded = expandedCurrencies.has(divisa.codigo)
                const bancos = bancosPorDivisa.get(divisa.codigo) || []

                if (isExpanded && bancos.length > 0) {
                  return (
                    <React.Fragment key={`sub-${divisa.codigo}`}>
                      {bancos.map((banco, bancoIdx) => (
                        <th
                          key={banco.codigo}
                          className={`px-4 py-2 text-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 hover:underline transition-colors ${
                            bancoIdx === 0 ? 'border-l-2 border-gray-400' : 'border-l border-gray-300'
                          }`}
                          onClick={() => handleBancoClick(banco.nombre, banco.codigo, divisa.codigo)}
                          title="Click para ver todos los movimientos de este banco"
                        >
                          {banco.nombre}
                        </th>
                      ))}
                      {/* Columna Total */}
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-900 bg-gray-100 border-l border-gray-400">
                        Total {divisa.codigo}
                      </th>
                    </React.Fragment>
                  )
                } else {
                  return (
                    <th
                      key={`sub-${divisa.codigo}`}
                      className="px-4 py-2 text-center text-xs font-medium text-gray-600 border-l-2 border-gray-400"
                    >
                      Total
                    </th>
                  )
                }
              })}
              {/* Subencabezado TOTAL USD */}
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-900 bg-gray-200 border-l-2 border-gray-400">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {datosPorMes.map((datoMes, idxMes) => {
              const mesExpandido = expandedMonths.has(datoMes.mes)

              // Verificar si el mes tiene al menos un día con movimientos actuales en alguna divisa
              const mesTieneActuales = datoMes.diasDelMes.some(datoFecha => {
                return datos.some(d => d.fecha === datoFecha.fecha && d.es_actual)
              })
              
              // Fondo de la fila del mes: blanco si tiene movimientos actuales, gris si no
              const fondoFilaMes = mesTieneActuales ? 'bg-white' : 'bg-gray-200'
              
              return (
                <React.Fragment key={datoMes.mes}>
                  {/* Fila del mes (resumen mensual) */}
                  <tr className={`${fondoFilaMes} border-t-2 border-gray-300 hover:bg-gray-100 transition-colors`}>
                    <td 
                      className={`px-4 py-3 text-sm text-gray-900 font-bold sticky left-0 ${fondoFilaMes} hover:bg-gray-100 z-10 border-r border-gray-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] cursor-pointer`}
                      onClick={() => handleFechaMesClick(datoMes.mes)}
                      title="Click para ver todos los movimientos del mes"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMes(datoMes.mes)
                          }}
                          className="hover:bg-gray-300 rounded p-1 transition-colors"
                          title={mesExpandido ? 'Colapsar mes' : 'Expandir mes'}
                        >
                          {mesExpandido ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <span>{datoMes.nombreMes}</span>
                      </div>
                    </td>
                    {divisasUnicas.map(divisa => {
                      const isExpanded = expandedCurrencies.has(divisa.codigo)
                      const bancos = bancosPorDivisa.get(divisa.codigo) || []
                      const divisaData = datoMes.divisas.get(divisa.codigo)
                      // USD siempre se muestra en USD (no necesita conversión)
                      const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)

                      if (isExpanded && bancos.length > 0) {
                        // Mostrar celdas de bancos + total
                        const totalDivisaMes = divisaData?.total || 0
                        // Usar el último día del mes (no sumar todos los días)
                        const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
                        const totalUSDDivisaMes = ultimoDia ? datos
                          .filter(d => d.fecha === ultimoDia.fecha)
                          .filter(d => {
                            const cuenta = d.cuenta as any
                            return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                          })
                          .reduce((s, d) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0) : 0
                        const ratio = totalUSDDivisaMes / (totalDivisaMes || 1)

                        // Verificar si AL MENOS UNO de los días del mes tiene saldos actuales para esta divisa
                        const algunDiaConActual = datoMes.diasDelMes.some(datoFecha => {
                          const saldosDivisaDia = datos
                            .filter(d => d.fecha === datoFecha.fecha)
                            .filter(d => {
                              const cuenta = d.cuenta as any
                              return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                            })
                          return saldosDivisaDia.some(d => d.es_actual)
                        })
                        
                        // Para el total de la divisa expandida: fondo blanco si algún día tiene actuales
                        const fondoCeldaTotal = algunDiaConActual ? 'bg-inherit' : 'bg-gray-200'

                        return (
                          <React.Fragment key={`${datoMes.mes}-${divisa.codigo}`}>
                            {bancos.map((banco, bancoIdx) => {
                              const bancoData = divisaData?.bancos.find(
                                b => b.codigo_banco === banco.codigo
                              )
                              const valor = bancoData?.total || 0
                              const valorEnUSD = valor * ratio

                              // Verificar si este banco específico tiene saldos actuales en algún día del mes
                              const bancoTieneActual = datoMes.diasDelMes.some(datoFecha => {
                                const saldosBancoDia = datos
                                  .filter(d => d.fecha === datoFecha.fecha)
                                  .filter(d => {
                                    const cuenta = d.cuenta as any
                                    const bancoPaisDivisa = cuenta?.banco_pais_divisa
                                    const divisaBanco = bancoPaisDivisa?.divisa?.codigo_divisa
                                    const bancoPais = bancoPaisDivisa?.banco_pais
                                    const bancoObj = bancoPais?.banco
                                    const pais = bancoPais?.pais
                                    
                                    let tipoCuentaDesc = ''
                                    if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
                                    else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
                                    
                                    const codigoBancoActual = construirCodigoBanco(
                                      bancoObj?.id_banco || 0,
                                      cuenta?.id_tipo_cuenta || 0,
                                      pais?.codigo_pais || '',
                                      cuenta?.id_cuenta
                                    )
                                    
                                    return divisaBanco === divisa.codigo && codigoBancoActual === banco.codigo
                                  })
                                return saldosBancoDia.some(d => d.es_actual)
                              })
                              
                              // bancoTieneActual = true: fondo blanco (hereda de la fila), bancoTieneActual = false: fondo más oscuro
                              const fondoCeldaBanco = bancoTieneActual ? 'bg-inherit' : 'bg-gray-200'

                              return (
                                <td
                                  key={banco.codigo}
                                  className={`px-4 py-3 text-sm text-right text-gray-900 font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:underline ${
                                    bancoIdx === 0 ? 'border-l-2 border-gray-400' : 'border-l border-gray-300'
                                  } ${fondoCeldaBanco}`}
                                  onClick={() => handleMonthCellClick(datoMes.mes, banco.nombre, banco.codigo, divisa.codigo)}
                                  title="Click para ver todos los movimientos del mes"
                                >
                                  {enUSD 
                                    ? formatearMoneda(valorEnUSD, '$', 2)
                                    : formatearMoneda(valor, divisa.simbolo, divisa.decimales)
                                  }
                                </td>
                              )
                            })}
                            {/* Celda Total */}
                            <td className={`px-4 py-3 text-sm text-right text-gray-900 font-bold border-l border-gray-400 whitespace-nowrap ${fondoCeldaTotal}`}>
                              {enUSD 
                                ? formatearMoneda(totalUSDDivisaMes, '$', 2)
                                : formatearMoneda(totalDivisaMes, divisa.simbolo, divisa.decimales)
                              }
                            </td>
                          </React.Fragment>
                        )
                      } else {
                        // Mostrar celda de total de divisa
                        const total = divisaData?.total || 0
                        
                        // Calcular total en USD para esta divisa en este mes (último día, no suma)
                        const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
                        const totalUSDDivisa = ultimoDia ? datos
                          .filter(d => d.fecha === ultimoDia.fecha)
                          .filter(d => {
                            const cuenta = d.cuenta as any
                            return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                          })
                          .reduce((s, d) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0) : 0

                        // Verificar si AL MENOS UNO de los días del mes tiene saldos actuales para esta divisa
                        const algunDiaConActual = datoMes.diasDelMes.some(datoFecha => {
                          const saldosDivisaDia = datos
                            .filter(d => d.fecha === datoFecha.fecha)
                            .filter(d => {
                              const cuenta = d.cuenta as any
                              return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                            })
                          return saldosDivisaDia.some(d => d.es_actual)
                        })
                        
                        // algunDiaConActual = true: fondo blanco (hereda de la fila), algunDiaConActual = false: fondo más oscuro
                        const fondoCelda = algunDiaConActual ? 'bg-inherit' : 'bg-gray-200'

                        // Obtener el primer banco para el onClick
                        const bancosDivisa = bancosPorDivisa.get(divisa.codigo) || []
                        const primerBanco = bancosDivisa[0]

                        return (
                          <td
                            key={`${datoMes.mes}-${divisa.codigo}`}
                            className={`px-4 py-3 text-sm text-right text-gray-900 font-bold border-l-2 border-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:underline ${fondoCelda}`}
                            onClick={() => primerBanco && handleMonthCellClick(datoMes.mes, primerBanco.nombre, primerBanco.codigo, divisa.codigo, true)}
                            title="Click para ver todos los movimientos del mes de esta divisa"
                          >
                            {enUSD 
                              ? formatearMoneda(totalUSDDivisa, '$', 2)
                              : formatearMoneda(total, divisa.simbolo, divisa.decimales)
                            }
                          </td>
                        )
                      }
                    })}
                    {/* Celda TOTAL USD para el mes - ÚLTIMO BALANCE DEL MES */}
                    <td className={`px-4 py-3 text-sm text-right text-gray-900 font-bold border-l-2 border-gray-400 whitespace-nowrap ${fondoFilaMes}`}>
                      {(() => {
                        // Obtener el último día del mes con datos
                        const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
                        const totalUSDUltimoDia = ultimoDia ? (datosConUSD.get(ultimoDia.fecha) || 0) : 0
                        return formatearMoneda(totalUSDUltimoDia, '$', 2)
                      })()}
                    </td>
                  </tr>

                  {/* Filas de días (solo si el mes está expandido) */}
                  {mesExpandido &&
                    datoMes.diasDelMes.map((datoFecha, idxDia) => {
                      // Verificar si este día tiene al menos un movimiento actual en alguna divisa
                      const diaTieneActuales = datos.some(d => d.fecha === datoFecha.fecha && d.es_actual)
                      
                      // Fondo de la fila del día: blanco si tiene movimientos actuales, gris si no
                      const fondoFilaDia = diaTieneActuales ? 'bg-white' : 'bg-gray-200'
                      
                      return (
                      <tr
                        key={datoFecha.fecha}
                        className={fondoFilaDia}
                      >
                        <td 
                          className={`px-4 py-2 text-sm text-gray-700 sticky left-0 ${fondoFilaDia} z-10 border-r border-gray-200 pl-12 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-gray-100`}
                          onClick={() => handleFechaDiaClick(datoFecha.fecha)}
                          title="Click para ver todos los movimientos del día"
                        >
                          {new Date(datoFecha.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        {divisasUnicas.map(divisa => {
                          const isExpanded = expandedCurrencies.has(divisa.codigo)
                          const bancos = bancosPorDivisa.get(divisa.codigo) || []
                          const divisaData = datoFecha.divisas.get(divisa.codigo)
                          // USD siempre se muestra en USD (no necesita conversión)
                          const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)

                          if (isExpanded && bancos.length > 0) {
                            // Mostrar celdas de bancos + total
                            const totalDivisaDia = divisaData?.total || 0
                            const totalUSDDivisaDia = datos
                              .filter(d => d.fecha === datoFecha.fecha)
                              .filter(d => {
                                const cuenta = d.cuenta as any
                                return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                              })
                              .reduce((s, d) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0)
                            const ratio = totalUSDDivisaDia / (totalDivisaDia || 1)

                            return (
                              <React.Fragment key={`${datoFecha.fecha}-${divisa.codigo}`}>
                                {bancos.map((banco, bancoIdx) => {
                                  const bancoData = divisaData?.bancos.find(
                                    b => b.codigo_banco === banco.codigo
                                  )
                                  const valor = bancoData?.total || 0
                                  const valorEnUSD = valor * ratio
                                  
                                  // Verificar si este banco tiene movimientos actuales (al menos uno)
                                  const tieneActuales = tieneMovimientosActuales(datoFecha.fecha, banco.codigo, divisa.codigo)
                                  // tieneActuales = true: fondo blanco (hereda de la fila), tieneActuales = false: fondo más oscuro
                                  const fondoCelda = tieneActuales ? 'bg-inherit' : 'bg-gray-200'
                                  const esClickeable = tieneActuales ? 'cursor-pointer hover:bg-gray-100 hover:underline' : ''
                                  const bordeDivisa = bancoIdx === 0 ? 'border-l-2 border-gray-400' : 'border-l border-gray-300'

                                  return (
                                    <td
                                      key={banco.codigo}
                                      className={`px-4 py-2 text-sm text-right text-gray-700 whitespace-nowrap ${bordeDivisa} ${fondoCelda} ${esClickeable}`}
                                      onClick={() => tieneActuales && handleCellClick(datoFecha.fecha, banco.nombre, banco.codigo, divisa.codigo)}
                                      title={tieneActuales ? 'Click para ver movimientos detallados' : 'Sin movimientos actuales'}
                                    >
                                      {enUSD 
                                        ? formatearMoneda(valorEnUSD, '$', 2)
                                        : formatearMoneda(valor, divisa.simbolo, divisa.decimales)
                                      }
                                    </td>
                                  )
                                })}
                                {/* Celda Total */}
                                <td className={`px-4 py-2 text-sm text-right text-gray-700 font-bold border-l border-gray-400 whitespace-nowrap ${fondoFilaDia}`}>
                                  {enUSD 
                                    ? formatearMoneda(totalUSDDivisaDia, '$', 2)
                                    : formatearMoneda(totalDivisaDia, divisa.simbolo, divisa.decimales)
                                  }
                                </td>
                              </React.Fragment>
                            )
                          } else {
                            // Mostrar celda de total de divisa
                            const total = divisaData?.total || 0
                            
                            // Calcular total en USD para esta divisa en este día
                            const saldosDivisaDia = datos
                              .filter(d => d.fecha === datoFecha.fecha)
                              .filter(d => {
                                const cuenta = d.cuenta as any
                                return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                              })
                            const totalUSDDivisa = saldosDivisaDia.reduce((s, d) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0)
                            
                            // Verificar si AL MENOS UNO de los saldos de esta divisa en este día es actual
                            const algunoActual = saldosDivisaDia.some(d => d.es_actual)
                            // algunoActual = true: fondo blanco (hereda de la fila), algunoActual = false: fondo más oscuro
                            const fondoCelda = algunoActual ? 'bg-inherit' : 'bg-gray-200'
                            
                            // Para divisa total, solo es clickeable si tiene bancos y alguno es actual
                            const bancosDivisa = bancosPorDivisa.get(divisa.codigo) || []
                            const primerBanco = bancosDivisa[0]
                            const esClickeable = algunoActual && primerBanco ? 'cursor-pointer hover:bg-gray-100 hover:underline' : ''

                            return (
                              <td
                                key={`${datoFecha.fecha}-${divisa.codigo}`}
                                className={`px-4 py-2 text-sm text-right text-gray-700 border-l-2 border-gray-400 whitespace-nowrap ${fondoCelda} ${esClickeable}`}
                                onClick={() => algunoActual && primerBanco && handleCellClick(datoFecha.fecha, primerBanco.nombre, primerBanco.codigo, divisa.codigo)}
                                title={algunoActual ? 'Click para ver movimientos detallados' : 'Sin movimientos actuales'}
                              >
                                {enUSD 
                                  ? formatearMoneda(totalUSDDivisa, '$', 2)
                                  : formatearMoneda(total, divisa.simbolo, divisa.decimales)
                                }
                              </td>
                            )
                          }
                        })}
                        {/* Celda TOTAL USD para el día */}
                        <td className={`px-4 py-2 text-sm text-right text-gray-700 font-medium border-l-2 border-gray-400 whitespace-nowrap ${fondoFilaDia}`}>
                          {formatearMoneda(datosConUSD.get(datoFecha.fecha) || 0, '$', 2)}
                        </td>
                      </tr>
                      )
                    })}
                </React.Fragment>
              )
            })}
            
            {/* Fila de porcentajes al final */}
            <tr className="bg-yellow-50 border-t-4 border-yellow-400">
              <td className="px-4 py-3 text-sm text-gray-900 font-bold sticky left-0 bg-yellow-50 z-10 border-r border-gray-300">
                % del Total USD
              </td>
              {divisasUnicas.map(divisa => {
                const isExpanded = expandedCurrencies.has(divisa.codigo)
                const bancos = bancosPorDivisa.get(divisa.codigo) || []

                // Calcular el total USD de esta divisa sumando todos los días
                const totalUSDDivisa = datosPorFecha.reduce((sum, datoFecha) => {
                  const key = `${datoFecha.fecha}|${divisa.codigo}`
                  return sum + (datosUSDPorDivisaFecha.get(key) || 0)
                }, 0)

                // Calcular el total USD general de toda la tabla
                const totalUSDGeneral = datosPorFecha.reduce((sum, datoFecha) => {
                  return sum + (datosConUSD.get(datoFecha.fecha) || 0)
                }, 0)

                const porcentaje = totalUSDGeneral > 0 ? (totalUSDDivisa / totalUSDGeneral) * 100 : 0

                if (isExpanded && bancos.length > 0) {
                  // Mostrar porcentajes por banco + total
                  return (
                    <React.Fragment key={`porcentaje-${divisa.codigo}`}>
                      {bancos.map((banco, bancoIdx) => {
                        // Calcular porcentaje de este banco específico
                        const totalUSDBanco = datosPorFecha.reduce((sum, datoFecha) => {
                          const divisaData = datoFecha.divisas.get(divisa.codigo)
                          if (!divisaData) return sum
                          const bancoData = divisaData.bancos.find(b => b.codigo_banco === banco.codigo)
                          if (bancoData) {
                            const key = `${datoFecha.fecha}|${divisa.codigo}`
                            const usdDivisa = datosUSDPorDivisaFecha.get(key) || 0
                            const totalDivisa = divisaData.total || 1
                            const ratio = usdDivisa / totalDivisa
                            return sum + (bancoData.total * ratio)
                          }
                          return sum
                        }, 0)

                        const porcentajeBanco = totalUSDGeneral > 0 ? (totalUSDBanco / totalUSDGeneral) * 100 : 0

                        return (
                          <td
                            key={banco.codigo}
                            className={`px-4 py-3 text-sm text-center text-gray-700 font-semibold bg-yellow-50 whitespace-nowrap ${
                              bancoIdx === 0 ? 'border-l-2 border-gray-400' : 'border-l border-gray-300'
                            }`}
                          >
                            {porcentajeBanco.toFixed(2)}%
                          </td>
                        )
                      })}
                      {/* Porcentaje total de la divisa */}
                      <td className="px-4 py-3 text-sm text-center text-gray-900 font-bold bg-yellow-100 border-l border-gray-400 whitespace-nowrap">
                        {porcentaje.toFixed(2)}%
                      </td>
                    </React.Fragment>
                  )
                } else {
                  // Mostrar porcentaje total de divisa
                  return (
                    <td
                      key={`porcentaje-${divisa.codigo}`}
                      className="px-4 py-3 text-sm text-center text-gray-900 font-bold bg-yellow-50 border-l-2 border-gray-400 whitespace-nowrap"
                    >
                      {porcentaje.toFixed(2)}%
                    </td>
                  )
                }
              })}
              {/* Total USD: siempre 100% */}
              <td className="px-4 py-3 text-sm text-center text-gray-900 font-bold bg-yellow-100 border-l-2 border-gray-400 whitespace-nowrap">
                100.00%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </>
  )
}

