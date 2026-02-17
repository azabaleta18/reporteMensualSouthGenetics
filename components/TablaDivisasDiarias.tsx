'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronRight, Loader2, AlertCircle, DollarSign, ChevronUp, Briefcase, Download } from 'lucide-react'
import { formatearMoneda, construirNombreBanco, construirCodigoBanco } from '@/lib/formato-moneda'
import { obtenerTasasCambioUltimaFecha } from '@/lib/divisas'
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

// Funciones helper para obtener fechas por defecto
// Por defecto, mostrar desde el 1 de octubre de 2025
const obtenerFechaDesdePorDefecto = () => {
  return '2025-10-01'
}

const obtenerFechaHoy = () => {
  return new Date().toISOString().split('T')[0]
}

export default function TablaDivisasDiarias() {
  const [datos, setDatos] = useState<any[]>([]) // Datos directos de la vista v_saldo_diario_cuentas_usd
  const [tasasCambio, setTasasCambio] = useState<Map<string, number>>(new Map()) // codigo_divisa -> unidades_por_usd
  const [divisasInfo, setDivisasInfo] = useState<Map<string, { nombre: string; simbolo: string; decimales: number }>>(new Map())
  const [cuentasInfo, setCuentasInfo] = useState<Map<number, { id_tipo_cuenta: number; codigo_pais: string; id_banco: number; nombre_sheet_origen: string | null }>>(new Map())
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<Set<number>>(new Set())
  const [bancos, setBancos] = useState<Banco[]>([])
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Set<number>>(new Set())
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<Set<number>>(new Set())
  const [paises, setPaises] = useState<string[]>([])
  const [paisesSeleccionados, setPaisesSeleccionados] = useState<Set<string>>(new Set())
  const [codigoPaisToNombre, setCodigoPaisToNombre] = useState<Map<string, string>>(new Map())
  // Por defecto, mostrar desde el 1 de octubre de 2025
  // Usar estado para saber si es la primera carga (para aplicar valores por defecto)
  const [primeraCarga, setPrimeraCarga] = useState<boolean>(true)
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [filtrosVisibles, setFiltrosVisibles] = useState<boolean>(false)
  const [saldosPorCategoria, setSaldosPorCategoria] = useState<SaldoDiarioCuenta[]>([]) // Saldos calculados desde movimientos con categoría
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [advertenciaLimite, setAdvertenciaLimite] = useState(false)
  const [expandedCurrencies, setExpandedCurrencies] = useState<Set<string>>(new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [divisasSeleccionadas, setDivisasSeleccionadas] = useState<Set<string>>(new Set(ORDEN_DIVISAS))
  
  // Estado para conversión a USD
  const [mostrarEnUSD, setMostrarEnUSD] = useState<boolean>(false)

  useEffect(() => {
    cargarCategorias()
    cargarBancos()
    cargarEmpresas()
    cargarDivisasInfo()
    cargarCuentasInfo()
    cargarPaises()
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [fechaDesde, fechaHasta])

  // Cargar tasas de cambio cuando cambian las fechas
  useEffect(() => {
    const cargarTasasCambio = async () => {
      try {
        // Solo cargar tasas si hay fechas establecidas o si es la primera carga
        const fechaDesdeQuery = fechaDesde || (primeraCarga ? obtenerFechaDesdePorDefecto() : undefined)
        const fechaHastaQuery = fechaHasta || (primeraCarga ? obtenerFechaHoy() : undefined)
        const tasas = await obtenerTasasCambioUltimaFecha(fechaDesdeQuery, fechaHastaQuery)
        setTasasCambio(tasas)
      } catch (error) {
        console.error('Error al cargar tasas de cambio:', error)
      }
    }
    
    cargarTasasCambio()
  }, [fechaDesde, fechaHasta, primeraCarga])

  // Escuchar cambios en movimientos (eliminaciones, etc.) para recargar datos
  useEffect(() => {
    const handleMovimientosEliminados = () => {
      console.log('🔄 Movimientos eliminados detectados, recargando datos de la tabla...')
      cargarDatos()
    }

    // Escuchar evento personalizado
    window.addEventListener('movimientos-eliminados', handleMovimientosEliminados)

    // Escuchar cambios en localStorage (para otras pestañas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'movimientos-eliminados') {
        console.log('🔄 Cambio detectado en otra pestaña, recargando datos...')
        cargarDatos()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Verificar si hay cambios pendientes al montar
    const ultimaEliminacion = localStorage.getItem('movimientos-eliminados')
    if (ultimaEliminacion) {
      const timestamp = parseInt(ultimaEliminacion)
      const ahora = Date.now()
      // Si la eliminación fue hace menos de 5 segundos, recargar
      if (ahora - timestamp < 5000) {
        console.log('🔄 Eliminación reciente detectada, recargando datos...')
        cargarDatos()
      }
    }

    return () => {
      window.removeEventListener('movimientos-eliminados', handleMovimientosEliminados)
      window.removeEventListener('storage', handleStorageChange)
    }
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
    // En la primera carga, aplicar valores por defecto
    // Si el usuario limpia los filtros después, cargar toda la historia
    let fechaDesdeQuery: string | null = fechaDesde || null
    let fechaHastaQuery: string | null = fechaHasta || null

    // Solo aplicar valores por defecto en la primera carga
    if (primeraCarga && !fechaDesdeQuery && !fechaHastaQuery) {
      fechaDesdeQuery = obtenerFechaDesdePorDefecto()
      fechaHastaQuery = obtenerFechaHoy()
      // Establecer los valores en el estado para que se muestren en los inputs
      setFechaDesde(fechaDesdeQuery)
      setFechaHasta(fechaHastaQuery)
      setPrimeraCarga(false)
      console.log(`   📅 Primera carga: usando valores por defecto desde ${fechaDesdeQuery}`)
    } else if (primeraCarga) {
      // Si ya hay valores establecidos, no es la primera carga
      setPrimeraCarga(false)
    }

    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Iniciando carga de datos con paginación...')

      // Cargar tasas de cambio primero
      console.log('   💱 Cargando tasas de cambio...')
      const tasas = await obtenerTasasCambioUltimaFecha(fechaDesdeQuery || undefined, fechaHastaQuery || undefined)
      setTasasCambio(tasas)
      console.log(`   ✅ Cargadas ${tasas.size} tasas de cambio`)

      if (fechaDesdeQuery && fechaHastaQuery) {
        console.log(`   📅 Rango de fechas: ${fechaDesdeQuery} → ${fechaHastaQuery}`)
      } else {
        console.log(`   📅 Cargando toda la historia disponible (sin filtros de fecha)`)
      }

      // SOLUCIÓN: Usar paginación con filtros de fecha y límite máximo para evitar timeout
      // Límite máximo de 20,000 registros para evitar timeouts (reducido para mejorar rendimiento)
      const LIMITE_MAXIMO_REGISTROS = 20000
      let todosLosSaldos: any[] = []
      let desde = 0
      const tamañoPagina = 1000
      let hayMasDatos = true

      while (hayMasDatos && todosLosSaldos.length < LIMITE_MAXIMO_REGISTROS) {
        console.log(`   📄 Cargando página desde registro ${desde}...`)

        // Calcular cuántos registros podemos cargar en esta página sin exceder el límite
        const registrosRestantes = LIMITE_MAXIMO_REGISTROS - todosLosSaldos.length
        const tamañoPaginaActual = Math.min(tamañoPagina, registrosRestantes)

        let query = supabase
          .from('v_saldo_diario_cuentas_usd')
          .select(`
            id_cuenta,
            fecha,
            saldo_divisa,
            saldo_usd,
            hubo_movimientos,
            nombre_banco,
            nombre_empresa,
            codigo_divisa
          `)
        
        // Aplicar filtros de fecha solo si están definidos
        if (fechaDesdeQuery) {
          query = query.gte('fecha', fechaDesdeQuery)
        }
        if (fechaHastaQuery) {
          query = query.lte('fecha', fechaHastaQuery)
        }
        
        query = query
          .order('fecha', { ascending: true })
          .range(desde, desde + tamañoPaginaActual - 1)

        let saldosPagina
        let errorSaldos
        
        try {
          const resultado = await query
          saldosPagina = resultado.data
          errorSaldos = resultado.error
        } catch (err: any) {
          console.error('❌ ERROR en consulta Supabase (catch):', err)
          // Si es un error de timeout o red, mostrar mensaje más amigable
          if (err.message?.includes('fetch') || err.message?.includes('timeout') || err.message?.includes('network')) {
            const rangoTexto = fechaDesdeQuery && fechaHastaQuery 
              ? `${fechaDesdeQuery} → ${fechaHastaQuery}`
              : 'sin filtros de fecha'
            setError(`Error de conexión o timeout. Intenta usar un rango de fechas más pequeño (por ejemplo, últimos 3 meses). Rango actual: ${rangoTexto}`)
            setLoading(false)
            return
          }
          throw err
        }

        if (errorSaldos) {
          console.error('❌ ERROR en consulta Supabase:', errorSaldos)
          // Si es un error de timeout, mostrar mensaje más específico
          if (errorSaldos.message?.includes('timeout') || errorSaldos.message?.includes('fetch')) {
            const rangoTexto = fechaDesdeQuery && fechaHastaQuery 
              ? `${fechaDesdeQuery} → ${fechaHastaQuery}`
              : 'sin filtros de fecha'
            setError(`La consulta está tomando demasiado tiempo. Por favor, usa un rango de fechas más pequeño. Rango actual: ${rangoTexto}`)
            setLoading(false)
            return
          }
          throw errorSaldos
        }

        if (saldosPagina && saldosPagina.length > 0) {
          todosLosSaldos = [...todosLosSaldos, ...saldosPagina]
          console.log(`   ✅ Cargados ${saldosPagina.length} registros (Total acumulado: ${todosLosSaldos.length})`)
          
          // Si recibimos menos registros que el tamaño de página, ya no hay más datos
          if (saldosPagina.length < tamañoPaginaActual) {
            hayMasDatos = false
          } else if (todosLosSaldos.length >= LIMITE_MAXIMO_REGISTROS) {
            console.warn(`   ⚠️ Límite máximo de ${LIMITE_MAXIMO_REGISTROS} registros alcanzado. Algunos datos pueden no estar visibles.`)
            hayMasDatos = false
          } else {
            desde += tamañoPaginaActual
          }
        } else {
          hayMasDatos = false
        }
      }

      if (todosLosSaldos.length >= LIMITE_MAXIMO_REGISTROS) {
        console.warn(`   ⚠️ Se alcanzó el límite máximo de ${LIMITE_MAXIMO_REGISTROS} registros. Considera usar filtros de fecha más específicos.`)
        setAdvertenciaLimite(true)
        setError(`Se alcanzó el límite máximo de ${LIMITE_MAXIMO_REGISTROS.toLocaleString()} registros. Por favor, usa filtros de fecha más específicos para reducir la cantidad de datos. Por defecto se muestra desde el 1 de octubre de 2025.`)
        setLoading(false)
        return
      } else {
        setAdvertenciaLimite(false)
      }

      console.log('🔍 DEBUG - Datos recibidos de Supabase (con paginación):')
      console.log('   Total registros:', todosLosSaldos.length)
      if (todosLosSaldos.length > 0) {
        const fechas = todosLosSaldos.map(s => s.fecha).sort()
        console.log('   Primera fecha:', fechas[0])
        console.log('   Última fecha:', fechas[fechas.length - 1])
        console.log('   Fechas únicas:', new Set(fechas).size)
        // Mostrar algunos ejemplos de datos
        console.log('   Ejemplos de datos (primeros 3):', todosLosSaldos.slice(0, 3).map(s => ({
          id_cuenta: s.id_cuenta,
          fecha: s.fecha,
          saldo_divisa: s.saldo_divisa,
          saldo_usd: s.saldo_usd,
          nombre_banco: s.nombre_banco,
          nombre_empresa: s.nombre_empresa,
          codigo_divisa: s.codigo_divisa,
          hubo_movimientos: s.hubo_movimientos
        })))
      } else {
        console.warn('   ⚠️ No se cargaron registros de la vista')
      }

      setDatos(todosLosSaldos)
    } catch (err: any) {
      console.error('Error al cargar datos:', err)
      
      // Detectar errores específicos y mostrar mensajes más útiles
      const mensajeError = err.message || err.toString() || 'Error al cargar los datos'
      
      const rangoTexto = fechaDesdeQuery && fechaHastaQuery 
        ? `${fechaDesdeQuery} → ${fechaHastaQuery}`
        : 'sin filtros de fecha'
      
      if (mensajeError.includes('fetch') || mensajeError.includes('timeout') || mensajeError.includes('network') || mensajeError.includes('Failed to fetch')) {
        setError(`Error de conexión o timeout. La consulta está tomando demasiado tiempo. Por favor, intenta usar un rango de fechas más pequeño (por ejemplo, últimos 3 meses). Rango actual: ${rangoTexto}`)
      } else if (mensajeError.includes('limit') || mensajeError.includes('exceeded')) {
        setError(`Se alcanzó el límite máximo de registros. Por favor, usa filtros de fecha más específicos. Rango actual: ${rangoTexto}`)
      } else {
        setError(`Error al cargar los datos: ${mensajeError}. Intenta usar filtros de fecha más específicos.`)
      }
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

  // Cargar información de divisas (nombre, simbolo, decimales)
  const cargarDivisasInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('divisa')
        .select('codigo_divisa, nombre, simbolo, decimales')

      if (error) {
        console.error('Error al cargar información de divisas:', error)
        return
      }

      if (data) {
        const divisasMap = new Map<string, { nombre: string; simbolo: string; decimales: number }>()
        data.forEach(d => {
          divisasMap.set(d.codigo_divisa, {
            nombre: d.nombre,
            simbolo: d.simbolo,
            decimales: d.decimales
          })
        })
        setDivisasInfo(divisasMap)
        console.log(`✅ Cargada información de ${data.length} divisas`)
      }
    } catch (err: any) {
      console.error('Error al cargar información de divisas:', err)
    }
  }

  // Cargar información de cuentas (id_tipo_cuenta, codigo_pais, id_banco, nombre_sheet_origen) para construir codigo_banco
  // Solo cargar cuentas activas
  const cargarCuentasInfo = async () => {
    try {
      const { data: cuentas, error: errorCuentas } = await supabase
        .from('cuenta')
        .select('id_cuenta, id_tipo_cuenta, id_banco_pais_divisa, nombre_sheet_origen')
        .eq('activo', true)

      if (errorCuentas) {
        console.error('Error al cargar cuentas:', errorCuentas)
        return
      }

      // Cargar banco_pais_divisa para obtener codigo_pais
      const { data: bpd, error: errorBPD } = await supabase
        .from('banco_pais_divisa')
        .select('id_banco_pais_divisa, id_banco_pais')

      if (errorBPD) {
        console.error('Error al cargar banco_pais_divisa:', errorBPD)
        return
      }

      // Cargar banco_pais para obtener codigo_pais e id_banco
      const { data: bp, error: errorBP } = await supabase
        .from('banco_pais')
        .select('id_banco_pais, id_banco, codigo_pais')

      if (errorBP) {
        console.error('Error al cargar banco_pais:', errorBP)
        return
      }

      // Crear mapas para búsqueda rápida
      const bpdMap = new Map(bpd?.map(b => [b.id_banco_pais_divisa, b]) || [])
      const bpMap = new Map(bp?.map(b => [b.id_banco_pais, b]) || [])

      // Construir mapa de cuentas
      const cuentasMap = new Map<number, { id_tipo_cuenta: number; codigo_pais: string; id_banco: number; nombre_sheet_origen: string | null }>()
      cuentas?.forEach(cuenta => {
        const bpdItem = bpdMap.get(cuenta.id_banco_pais_divisa)
        if (bpdItem) {
          const bpItem = bpMap.get(bpdItem.id_banco_pais)
          if (bpItem) {
            cuentasMap.set(cuenta.id_cuenta, {
              id_tipo_cuenta: cuenta.id_tipo_cuenta,
              codigo_pais: bpItem.codigo_pais,
              id_banco: bpItem.id_banco,
              nombre_sheet_origen: cuenta.nombre_sheet_origen
            })
          }
        }
      })

      setCuentasInfo(cuentasMap)
      console.log(`✅ Cargada información de ${cuentasMap.size} cuentas`)
    } catch (err: any) {
      console.error('Error al cargar información de cuentas:', err)
    }
  }

  // Cargar países desde cuentas (igual que tabla-general y movimientos)
  const cargarPaises = async () => {
    try {
      const { data: cuentasPaisesData, error: errorCuentasPaises } = await supabase
        .from('cuenta')
        .select(`
          banco_pais_divisa (
            banco_pais (
              codigo_pais,
              pais (
                codigo_pais,
                nombre
              )
            )
          )
        `)
        .eq('activo', true)

      if (errorCuentasPaises) {
        console.error('Error al cargar países desde cuentas:', errorCuentasPaises)
        return
      }

      const paisesUnicos = new Set<string>()
      const codigoToNombre = new Map<string, string>()

      cuentasPaisesData?.forEach((c: any) => {
        const bancoPais = c.banco_pais_divisa?.banco_pais
        const pais = bancoPais?.pais
        const codigoPais = bancoPais?.codigo_pais || pais?.codigo_pais
        const nombrePais = (pais?.nombre || '').trim()
        if (nombrePais) {
          paisesUnicos.add(nombrePais)
          if (codigoPais) codigoToNombre.set(codigoPais, nombrePais)
        }
      })

      setPaises(Array.from(paisesUnicos).sort())
      setCodigoPaisToNombre(codigoToNombre)
    } catch (err: any) {
      console.error('Error al cargar países:', err)
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
            cuenta!inner (
              id_cuenta,
              id_banco_pais_divisa,
              id_empresa,
              id_tipo_cuenta,
              numero_cuenta,
              nombre_sheet_origen,
              activo,
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
          .eq('cuenta.activo', true)
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
            es_actual: true, // Mantener para compatibilidad con saldosPorCategoria
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
    const codigoNormalizado = codigoDivisa.toUpperCase().trim()
    const unidadesPorUSD = tasasCambio.get(codigoNormalizado)
    if (!unidadesPorUSD || unidadesPorUSD === 0) {
      console.warn(`⚠️ No se encontró tasa de cambio para ${codigoNormalizado}, usando 1`)
      return saldoDivisa // Fallback: asumir 1:1
    }
    return saldoDivisa / unidadesPorUSD
  }, [tasasCambio])

  // Función para formatear moneda con conversión a USD si está activada
  const formatearMonedaConConversion = (valor: number, codigoDivisa: string, simboloOriginal: string, decimalesOriginal: number): string => {
    if (mostrarEnUSD) {
      const valorUSD = calcularSaldoUSD(valor, codigoDivisa)
      return formatearMoneda(valorUSD, 'U$S', 2) // Cambiar símbolo a U$S cuando se muestra en USD
    }
    return formatearMoneda(valor, simboloOriginal, decimalesOriginal)
  }

  // Procesar datos para obtener registros planos (usar saldos calculados por categoría si aplica)
  const registrosBD = useMemo<RegistroBD[]>(() => {
    // Si hay categorías seleccionadas, usar los saldos calculados desde movimientos
    // Si no, usar los datos normales de la vista
    const datosAUsar = categoriasSeleccionadas.size > 0 && saldosPorCategoria.length > 0
      ? saldosPorCategoria
      : datos

    let registros = datosAUsar.map(saldo => {
      // Si viene de saldosPorCategoria, tiene estructura antigua con cuenta anidada
      // Si viene de datos, tiene estructura plana de la vista
      let id_cuenta: number
      let fecha: string
      let saldo_divisa: number
      let codigo_divisa: string
      let nombre_banco: string
      let nombre_empresa: string
      let id_empresa: number

      if ('cuenta' in saldo && saldo.cuenta) {
        // Estructura antigua (saldosPorCategoria)
        const cuenta = saldo.cuenta as any
        const bancoPaisDivisa = cuenta?.banco_pais_divisa
        const divisa = bancoPaisDivisa?.divisa
        const bancoPais = bancoPaisDivisa?.banco_pais
        const banco = bancoPais?.banco
        const pais = bancoPais?.pais

        id_cuenta = saldo.id_cuenta
        fecha = saldo.fecha
        saldo_divisa = saldo.saldo_divisa
        codigo_divisa = divisa?.codigo_divisa || 'XXX'
        nombre_empresa = cuenta?.empresa?.nombre || ''
        id_empresa = cuenta?.id_empresa || 0

        // Usar nombre_sheet_origen si está disponible, sino construir el nombre como fallback
        let nombre_banco: string
        if (cuenta?.nombre_sheet_origen) {
          nombre_banco = cuenta.nombre_sheet_origen
        } else {
          nombre_banco = banco?.nombre || 'Banco Desconocido'
          // Obtener descripción del tipo de cuenta
          let tipoCuentaDesc = ''
          if (cuenta?.id_tipo_cuenta === 1) {
            tipoCuentaDesc = 'CC'
          } else if (cuenta?.id_tipo_cuenta === 2) {
            tipoCuentaDesc = 'CA'
          }

          // Construir nombre del banco incluyendo país y empresa
          if (pais?.nombre) {
            nombre_banco += ` - ${pais.nombre}`
          }
          if (nombre_empresa) {
            nombre_banco += ` - ${nombre_empresa}`
          }
          if (tipoCuentaDesc) {
            nombre_banco += ` ${tipoCuentaDesc}`
          }
        }

        // Para agrupar correctamente, crear un código único por cuenta incluyendo id_cuenta
        // para que cada cuenta se muestre por separado (no se agrupen cuentas del mismo banco+empresa)
        const codigoBancoAgrupado = `${nombre_banco}|${nombre_empresa}|${codigo_divisa}|${id_cuenta}`.toLowerCase().replace(/\s+/g, '_')
        
        // También mantener el código original para otras funciones que lo necesiten
        const codigoBanco = construirCodigoBanco(
          banco?.id_banco || 0,
          cuenta?.id_tipo_cuenta || 0,
          pais?.codigo_pais || '',
          cuenta?.id_cuenta
        )

        const divisaInfo = divisasInfo.get(codigo_divisa) || { nombre: 'Desconocida', simbolo: '$', decimales: 2 }

        return {
          fecha,
          codigo_divisa,
          nombre_divisa: divisaInfo.nombre,
          simbolo_divisa: divisaInfo.simbolo,
          decimales_divisa: divisaInfo.decimales,
          nombre_banco,
          codigo_banco: codigoBancoAgrupado, // Usar código único por cuenta para que cada cuenta se muestre por separado
          saldo_divisa,
          id_banco: banco?.id_banco || 0,
          id_empresa,
          nombre_pais: pais?.nombre || null,
        }
      } else {
        // Estructura nueva (datos de la vista v_saldo_diario_cuentas_usd)
        id_cuenta = saldo.id_cuenta
        fecha = saldo.fecha
        // Convertir saldo_divisa a número, manejando strings y null/undefined
        saldo_divisa = saldo.saldo_divisa != null ? Number(saldo.saldo_divisa) : 0
        codigo_divisa = saldo.codigo_divisa || 'XXX'
        nombre_banco = saldo.nombre_banco || 'Banco Desconocido'
        nombre_empresa = saldo.nombre_empresa || ''
        id_empresa = saldo.id_empresa || 0

        // Obtener información de la cuenta para construir codigo_banco
        const cuentaInfo = cuentasInfo.get(id_cuenta)
        const id_tipo_cuenta = cuentaInfo?.id_tipo_cuenta || 0
        const codigo_pais = cuentaInfo?.codigo_pais || ''
        const id_banco = cuentaInfo?.id_banco || 0

        // Si no hay información de cuenta, intentar usar el nombre del banco directamente
        // pero esto puede causar problemas de agrupación
        if (!cuentaInfo) {
          console.warn(`⚠️ No se encontró información de cuenta para id_cuenta: ${id_cuenta}`)
        }

        // Usar nombre_sheet_origen si está disponible, sino usar el nombre construido como fallback
        let nombreBancoCompleto = cuentaInfo?.nombre_sheet_origen || nombre_banco
        if (!cuentaInfo?.nombre_sheet_origen && nombre_empresa) {
          nombreBancoCompleto += ` - ${nombre_empresa}`
        }
        if (!cuentaInfo?.nombre_sheet_origen) {
          let tipoCuentaDesc = ''
          if (id_tipo_cuenta === 1) {
            tipoCuentaDesc = 'CC'
          } else if (id_tipo_cuenta === 2) {
            tipoCuentaDesc = 'CA'
          }
          if (tipoCuentaDesc) {
            nombreBancoCompleto += ` ${tipoCuentaDesc}`
          }
        }

        // Para agrupar correctamente, crear un código único por cuenta incluyendo id_cuenta
        // para que cada cuenta se muestre por separado (no se agrupen cuentas del mismo banco+empresa)
        const codigoBancoAgrupado = `${nombre_banco}|${nombre_empresa}|${codigo_divisa}|${id_cuenta}`.toLowerCase().replace(/\s+/g, '_')
        
        // También mantener el código original para otras funciones que lo necesiten
        const codigoBanco = construirCodigoBanco(
          id_banco,
          id_tipo_cuenta,
          codigo_pais,
          id_cuenta
        )

        // Obtener información de la divisa
        const divisaInfo = divisasInfo.get(codigo_divisa) || { nombre: 'Desconocida', simbolo: '$', decimales: 2 }

        return {
          fecha,
          codigo_divisa,
          nombre_divisa: divisaInfo.nombre,
          simbolo_divisa: divisaInfo.simbolo,
          decimales_divisa: divisaInfo.decimales,
          nombre_banco: nombreBancoCompleto,
          codigo_banco: codigoBancoAgrupado, // Usar código único por cuenta para que cada cuenta se muestre por separado
          saldo_divisa,
          id_banco,
          id_empresa,
          nombre_pais: codigoPaisToNombre.get(codigo_pais || '') || null,
        }
      }
    })

    // Aplicar filtros de fecha, banco, empresa y país
    if (fechaDesde || fechaHasta || bancosSeleccionados.size > 0 || empresasSeleccionadas.size > 0 || paisesSeleccionados.size > 0) {
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
        
        // Filtro por país (igual que tabla-general y movimientos)
        if (paisesSeleccionados.size > 0) {
          const nombrePais = ((registro as any).nombre_pais || '').trim()
          if (!nombrePais || !paisesSeleccionados.has(nombrePais)) {
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
      // Mostrar algunos ejemplos de registros procesados
      console.log('   Ejemplos de registros procesados (primeros 3):', registros.slice(0, 3).map(r => ({
        fecha: r.fecha,
        codigo_divisa: r.codigo_divisa,
        nombre_banco: r.nombre_banco,
        codigo_banco: r.codigo_banco,
        saldo_divisa: r.saldo_divisa
      })))
      // Verificar si hay saldos distintos de cero
      const saldosNoCero = registros.filter(r => r.saldo_divisa !== 0)
      console.log(`   Registros con saldo distinto de cero: ${saldosNoCero.length} de ${registros.length}`)
      if (saldosNoCero.length > 0) {
        console.log('   Ejemplos de saldos no cero:', saldosNoCero.slice(0, 3).map(r => ({
          fecha: r.fecha,
          codigo_divisa: r.codigo_divisa,
          saldo_divisa: r.saldo_divisa
        })))
      }
    } else {
      console.warn('   ⚠️ No hay registros procesados. Verificar:')
      console.warn('      - ¿Se cargaron datos de la vista?', datos.length)
      console.warn('      - ¿Hay categorías seleccionadas?', categoriasSeleccionadas.size)
      console.warn('      - ¿Hay saldos por categoría?', saldosPorCategoria.length)
    }

    return registros
  }, [datos, categoriasSeleccionadas, saldosPorCategoria, fechaDesde, fechaHasta, bancosSeleccionados, empresasSeleccionadas, paisesSeleccionados, codigoPaisToNombre, divisasInfo, cuentasInfo])

  // Mapear datos crudos para acceder a saldo_usd por fecha (calculado dinámicamente)
  // IMPORTANTE: Solo calcular para divisas seleccionadas
  const datosConUSD = useMemo(() => {
    const mapa = new Map<string, number>() // fecha -> total_usd
    datos.forEach(d => {
      let codigoDivisa: string
      
      if ('cuenta' in d && d.cuenta) {
        // Estructura antigua (saldosPorCategoria)
        const cuenta = d.cuenta as any
        codigoDivisa = cuenta?.banco_pais_divisa?.divisa?.codigo_divisa || 'USD'
      } else {
        // Estructura nueva (vista)
        codigoDivisa = d.codigo_divisa || 'USD'
      }
      
      // Solo incluir si la divisa está seleccionada
      if (!divisasSeleccionadas.has(codigoDivisa)) {
        return
      }
      
      const saldoUSD = calcularSaldoUSD(d.saldo_divisa, codigoDivisa)
      const totalActual = mapa.get(d.fecha) || 0
      mapa.set(d.fecha, totalActual + saldoUSD)
    })
    return mapa
  }, [datos, calcularSaldoUSD, divisasSeleccionadas])

  // Mapear datos por fecha y divisa para calcular USD por divisa (calculado dinámicamente)
  const datosUSDPorDivisaFecha = useMemo(() => {
    const mapa = new Map<string, number>() // "fecha|codigo_divisa" -> total_usd_divisa
    datos.forEach(d => {
      let codigoDivisa: string
      let saldoDivisa: number

      if ('cuenta' in d && d.cuenta) {
        // Estructura antigua (saldosPorCategoria)
        const cuenta = d.cuenta as any
        codigoDivisa = cuenta?.banco_pais_divisa?.divisa?.codigo_divisa
        if (!codigoDivisa) return
        saldoDivisa = d.saldo_divisa
      } else {
        // Estructura nueva (vista)
        codigoDivisa = d.codigo_divisa
        if (!codigoDivisa) return
        if (d.saldo_usd !== null && d.saldo_usd !== undefined) {
          // Usar saldo_usd de la vista directamente
          const key = `${d.fecha}|${codigoDivisa}`
          const totalActual = mapa.get(key) || 0
          mapa.set(key, totalActual + Number(d.saldo_usd))
          return
        }
        saldoDivisa = Number(d.saldo_divisa)
      }

      const saldoUSD = calcularSaldoUSD(saldoDivisa, codigoDivisa)
      const key = `${d.fecha}|${codigoDivisa}`
      const totalActual = mapa.get(key) || 0
      mapa.set(key, totalActual + saldoUSD)
    })
    return mapa
  }, [datos, calcularSaldoUSD])

  // Mapear hubo_movimientos por fecha y cuenta
  const huboMovimientosMap = useMemo(() => {
    const mapa = new Map<string, boolean>() // "fecha|id_cuenta" -> hubo_movimientos
    datos.forEach(d => {
      const key = `${d.fecha}|${d.id_cuenta}`
      // La vista tiene hubo_movimientos, pero saldosPorCategoria tiene es_actual
      const huboMovimientos = d.hubo_movimientos !== undefined ? d.hubo_movimientos : (d as any).es_actual || false
      mapa.set(key, huboMovimientos)
    })
    return mapa
  }, [datos])

  // Función para verificar si un saldo específico tiene movimientos
  const verificarSiTieneMovimientos = (fecha: string, codigoBanco: string, codigoDivisa: string): boolean => {
    // Buscar en los datos originales si alguna cuenta de este banco/divisa en esta fecha tiene movimientos
    const saldosDelDia = datos.filter(d => d.fecha === fecha)
    for (const saldo of saldosDelDia) {
      let codigoDivisaActual: string
      let nombreBancoActual: string
      let nombreEmpresaActual: string
      let idCuentaActual: number

      if ('cuenta' in saldo && saldo.cuenta) {
        // Estructura antigua (saldosPorCategoria)
        const cuenta = saldo.cuenta as any
        const bancoPaisDivisa = cuenta?.banco_pais_divisa
        codigoDivisaActual = bancoPaisDivisa?.divisa?.codigo_divisa
        const bancoPais = bancoPaisDivisa?.banco_pais
        const banco = bancoPais?.banco
        const empresa = cuenta?.empresa
        
        nombreBancoActual = banco?.nombre || ''
        nombreEmpresaActual = empresa?.nombre || ''
        idCuentaActual = saldo.id_cuenta
        
        // Construir código agrupado (incluyendo id_cuenta)
        const codigoBancoActual = `${nombreBancoActual}|${nombreEmpresaActual}|${codigoDivisaActual}|${idCuentaActual}`.toLowerCase().replace(/\s+/g, '_')
        
        if (codigoBancoActual === codigoBanco && codigoDivisaActual === codigoDivisa) {
          const huboMovimientos = (saldo as any).es_actual !== undefined ? (saldo as any).es_actual : saldo.hubo_movimientos || false
          if (!huboMovimientos) {
            return false
          }
        }
      } else {
        // Estructura nueva (vista)
        codigoDivisaActual = saldo.codigo_divisa
        nombreBancoActual = saldo.nombre_banco || ''
        nombreEmpresaActual = saldo.nombre_empresa || ''
        idCuentaActual = saldo.id_cuenta

        // Construir código agrupado (incluyendo id_cuenta)
        const codigoBancoActual = `${nombreBancoActual}|${nombreEmpresaActual}|${codigoDivisaActual}|${idCuentaActual}`.toLowerCase().replace(/\s+/g, '_')

        if (codigoBancoActual === codigoBanco && codigoDivisaActual === codigoDivisa) {
          if (!saldo.hubo_movimientos) {
            return false
          }
        }
      }
    }
    return true
  }

  // Función para verificar si tiene movimientos actuales (hubo_movimientos = true)
  const tieneMovimientosActuales = (fecha: string, codigoBanco: string, codigoDivisa: string): boolean => {
    const saldosDelDia = datos.filter(d => d.fecha === fecha)
    for (const saldo of saldosDelDia) {
      let codigoDivisaActual: string
      let nombreBancoActual: string
      let nombreEmpresaActual: string
      let idCuentaActual: number

      if ('cuenta' in saldo && saldo.cuenta) {
        // Estructura antigua (saldosPorCategoria)
        const cuenta = saldo.cuenta as any
        const bancoPaisDivisa = cuenta?.banco_pais_divisa
        codigoDivisaActual = bancoPaisDivisa?.divisa?.codigo_divisa
        const bancoPais = bancoPaisDivisa?.banco_pais
        const banco = bancoPais?.banco
        const empresa = cuenta?.empresa
        
        nombreBancoActual = banco?.nombre || ''
        nombreEmpresaActual = empresa?.nombre || ''
        idCuentaActual = saldo.id_cuenta
        
        // Construir código agrupado (incluyendo id_cuenta)
        const codigoBancoActual = `${nombreBancoActual}|${nombreEmpresaActual}|${codigoDivisaActual}|${idCuentaActual}`.toLowerCase().replace(/\s+/g, '_')
        
        if (codigoBancoActual === codigoBanco && codigoDivisaActual === codigoDivisa) {
          const huboMovimientos = (saldo as any).es_actual !== undefined ? (saldo as any).es_actual : saldo.hubo_movimientos || false
          if (huboMovimientos) {
            return true
          }
        }
      } else {
        // Estructura nueva (vista)
        codigoDivisaActual = saldo.codigo_divisa
        nombreBancoActual = saldo.nombre_banco || ''
        nombreEmpresaActual = saldo.nombre_empresa || ''
        idCuentaActual = saldo.id_cuenta

        // Construir código agrupado (incluyendo id_cuenta)
        const codigoBancoActual = `${nombreBancoActual}|${nombreEmpresaActual}|${codigoDivisaActual}|${idCuentaActual}`.toLowerCase().replace(/\s+/g, '_')

        if (codigoBancoActual === codigoBanco && codigoDivisaActual === codigoDivisa) {
          if (saldo.hubo_movimientos) {
            return true
          }
        }
      }
    }
    return false
  }

  // Función para obtener el ID del banco desde el código agrupado
  const obtenerIdBanco = (codigoBanco: string, codigoDivisa: string): number => {
    // El codigoBanco ahora es "nombre_banco|nombre_empresa|codigo_divisa"
    // Buscar en registrosBD para encontrar un registro con este código
    for (const registro of registrosBD) {
      if (registro.codigo_banco === codigoBanco && registro.codigo_divisa === codigoDivisa) {
        return registro.id_banco || 0
      }
    }
    return 0
  }

  // Función para obtener el ID de la cuenta desde el código agrupado
  // El código agrupado ahora es "nombre_banco|nombre_empresa|codigo_divisa|id_cuenta"
  const obtenerIdCuenta = (codigoBanco: string, codigoDivisa: string): number | null => {
    // Extraer id_cuenta directamente del código
    // El formato es "nombre_banco|nombre_empresa|codigo_divisa|id_cuenta"
    const partes = codigoBanco.split('|')
    if (partes.length >= 4) {
      const idCuenta = parseInt(partes[partes.length - 1])
      if (!isNaN(idCuenta)) {
        return idCuenta
      }
    }
    
    // Fallback: buscar en los datos originales
    for (const saldo of datos) {
      if ('cuenta' in saldo && saldo.cuenta) {
        // Estructura antigua
        const cuenta = saldo.cuenta as any
        const bancoPaisDivisa = cuenta?.banco_pais_divisa
        const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
        
        if (divisa === codigoDivisa) {
          const bancoPais = bancoPaisDivisa?.banco_pais
          const banco = bancoPais?.banco
          const empresa = cuenta?.empresa
          if (banco && empresa) {
            const codigoBancoActual = `${banco.nombre}|${empresa.nombre}|${codigoDivisa}|${cuenta.id_cuenta}`.toLowerCase().replace(/\s+/g, '_')
            if (codigoBancoActual === codigoBanco) {
              return cuenta?.id_cuenta || null
            }
          }
        }
      } else {
        // Estructura nueva (vista)
        if (saldo.codigo_divisa === codigoDivisa) {
          const codigoBancoActual = `${saldo.nombre_banco}|${saldo.nombre_empresa}|${codigoDivisa}|${saldo.id_cuenta}`.toLowerCase().replace(/\s+/g, '_')
          if (codigoBancoActual === codigoBanco) {
            return saldo.id_cuenta || null
          }
        }
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
    
    // Construir URL con parámetros para /movimientos (sin filtrar por banco o divisa)
    const params = new URLSearchParams({
      fechaDesde: primerDia,
      fechaHasta: ultimoDia
    })

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos
    window.open(`/movimientos?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  // Función para manejar el click en la fecha de un día
  const handleFechaDiaClick = (fecha: string) => {
    console.log('🔍 Abriendo movimientos del día:', {
      fecha,
      categorias: Array.from(categoriasSeleccionadas)
    })

    // Construir URL con parámetros para /movimientos (sin filtrar por banco o divisa)
    const params = new URLSearchParams({
      fechaDesde: fecha,
      fechaHasta: fecha
    })

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos
    window.open(`/movimientos?${params.toString()}`, '_blank', 'noopener,noreferrer')
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

    // Construir URL con parámetros para /movimientos
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

    // Abrir en nueva pestaña en /movimientos
    window.open(`/movimientos?${params.toString()}`, '_blank', 'noopener,noreferrer')
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
    
    // Construir URL con parámetros para /movimientos
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

    // Abrir en nueva pestaña en /movimientos
    window.open(`/movimientos?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  // Función para manejar el click en el nombre del banco (todos los movimientos de la cuenta específica)
  const handleBancoClick = (nombreBanco: string, codigoBanco: string, codigoDivisa: string) => {
    const idCuenta = obtenerIdCuenta(codigoBanco, codigoDivisa)
    
    console.log('🔍 Abriendo todos los movimientos de la cuenta:', {
      nombreBanco,
      cuentaId: idCuenta,
      codigoDivisa,
      categorias: Array.from(categoriasSeleccionadas)
    })

    if (!idCuenta) {
      console.error('❌ No se pudo obtener el id_cuenta')
      return
    }

    // Construir URL con parámetros para /movimientos usando cuentaId
    const params = new URLSearchParams({
      cuentaId: idCuenta.toString(),
      codigoDivisa,
      bancoNombre: nombreBanco
    })

    // Agregar categorías seleccionadas si hay alguna
    if (categoriasSeleccionadas.size > 0) {
      const categoriasArray = Array.from(categoriasSeleccionadas)
      params.set('categorias', categoriasArray.join(','))
    }

    // Abrir en nueva pestaña en /movimientos
    window.open(`/movimientos?${params.toString()}`, '_blank', 'noopener,noreferrer')
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
      // Verificar si tiene movimientos (hubo_movimientos para vista, es_actual para saldosPorCategoria)
      const huboMovimientos = saldo.hubo_movimientos !== undefined ? saldo.hubo_movimientos : (saldo as any).es_actual || false
      
      if (huboMovimientos) {
        let codigoDivisa: string
        let codigoBanco: string

        if ('cuenta' in saldo && saldo.cuenta) {
          // Estructura antigua (saldosPorCategoria)
          const cuenta = saldo.cuenta as any
          const bancoPaisDivisa = cuenta?.banco_pais_divisa
          codigoDivisa = bancoPaisDivisa?.divisa?.codigo_divisa
          const bancoPais = bancoPaisDivisa?.banco_pais
          const banco = bancoPais?.banco
          const pais = bancoPais?.pais
          
          let tipoCuentaDesc = ''
          if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
          else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
          
          codigoBanco = construirCodigoBanco(
            banco?.id_banco || 0,
            cuenta?.id_tipo_cuenta || 0,
            pais?.codigo_pais || '',
            cuenta?.id_cuenta
          )
        } else {
          // Estructura nueva (vista)
          codigoDivisa = saldo.codigo_divisa
          const nombreBanco = saldo.nombre_banco || ''
          const nombreEmpresa = saldo.nombre_empresa || ''
          // Usar código agrupado (sin id_cuenta) para agrupar todas las cuentas del mismo banco+empresa
          codigoBanco = `${nombreBanco}|${nombreEmpresa}|${codigoDivisa}`.toLowerCase().replace(/\s+/g, '_')
        }
        
        if (codigoDivisa && codigoBanco) {
          cuentasConMovimientos.add(`${codigoBanco}|${codigoDivisa}`)
        }
      }
    })

    // Solo agregar bancos que tienen movimientos actuales
    registrosBD.forEach(registro => {
      // El código de banco ahora incluye id_cuenta: "nombre_banco|nombre_empresa|codigo_divisa|id_cuenta"
      // Extraer el código sin id_cuenta para comparar
      const partes = registro.codigo_banco.split('|')
      const codigoBancoSinId = partes.slice(0, 3).join('|') // Tomar las primeras 3 partes
      const key = `${codigoBancoSinId}|${registro.codigo_divisa}`
      if (cuentasConMovimientos.has(key)) {
        if (!mapa.has(registro.codigo_divisa)) {
          mapa.set(registro.codigo_divisa, new Set())
        }
        // Usar el código completo (con id_cuenta) para mostrar cada cuenta por separado
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
  }, [registrosBD, datos, cuentasInfo])

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


  // Exportar datos de la tabla a CSV
  const exportarTablaCSV = () => {
    const datosExportar: any[] = []

    // Recorrer todos los meses
    datosPorMes.forEach(datoMes => {
      // Recorrer todas las divisas visibles
      divisasUnicas.forEach(divisa => {
        const isExpanded = expandedCurrencies.has(divisa.codigo)
        const bancos = bancosPorDivisa.get(divisa.codigo) || []
        const enUSD = mostrarEnUSD
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
        mostrarEnUSD,
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
        const enUSD = mostrarEnUSD
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
            <p className="text-red-600 text-xs mt-2">
              💡 Sugerencia: Intenta usar filtros de fecha más específicos para reducir la cantidad de datos.
            </p>
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
          paises={paises}
          paisesSeleccionados={paisesSeleccionados}
          onTogglePais={(nombrePais) => {
            setPaisesSeleccionados(prev => {
              const newSet = new Set(prev)
              if (newSet.has(nombrePais)) {
                newSet.delete(nombrePais)
              } else {
                newSet.add(nombrePais)
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
        todasEnUSD={mostrarEnUSD}
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
            onClick={() => setMostrarEnUSD(!mostrarEnUSD)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium border-2 ${
              mostrarEnUSD
                ? 'bg-green-50 text-green-700 border-green-500 hover:bg-green-100'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            title={mostrarEnUSD ? 'Ocultar conversión a USD' : 'Mostrar valores en USD'}
          >
            {mostrarEnUSD ? (
              <>
                <span className="text-green-600">✓</span>
                <span>U$S Mostrar en USD</span>
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4" />
                <span>Mostrar en USD</span>
              </>
            )}
          </button>
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
      {advertenciaLimite && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-yellow-900 font-semibold mb-1">Límite de registros alcanzado</h3>
              <p className="text-yellow-700 text-sm">
                Se alcanzó el límite máximo de 20,000 registros. Para ver más datos, usa filtros de fecha más específicos en la sección de filtros.
              </p>
            </div>
          </div>
        </div>
      )}
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
        paises={paises}
        paisesSeleccionados={paisesSeleccionados}
        onTogglePais={(nombrePais) => {
          setPaisesSeleccionados(prev => {
            const newSet = new Set(prev)
            if (newSet.has(nombrePais)) {
              newSet.delete(nombrePais)
            } else {
              newSet.add(nombrePais)
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
        todasEnUSD={mostrarEnUSD}
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
                const enUSD = mostrarEnUSD

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
                return datos.some(d => {
                  if (d.fecha === datoFecha.fecha) {
                    const huboMovimientos = d.hubo_movimientos !== undefined ? d.hubo_movimientos : (d as any).es_actual || false
                    return huboMovimientos
                  }
                  return false
                })
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
                      const enUSD = mostrarEnUSD

                      if (isExpanded && bancos.length > 0) {
                        // Mostrar celdas de bancos + total
                        // Usar el último día del mes para obtener el balance final
                        const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
                        const divisaDataUltimoDia = ultimoDia?.divisas.get(divisa.codigo)
                        const totalDivisaMes = divisaDataUltimoDia?.total || 0
                        
                        // Calcular total USD del último día
                        const totalUSDDivisaMes = ultimoDia ? datos
                          .filter(d => d.fecha === ultimoDia.fecha)
                          .filter(d => {
                            if ('cuenta' in d && d.cuenta) {
                              const cuenta = d.cuenta as any
                              return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                            } else {
                              return d.codigo_divisa === divisa.codigo
                            }
                          })
                          .reduce((s, d) => s + calcularSaldoUSD(Number(d.saldo_divisa), divisa.codigo), 0) : 0
                        const ratio = totalDivisaMes > 0 ? totalUSDDivisaMes / totalDivisaMes : 0
                        
                        // Debug: verificar valores para todas las divisas
                        if (datoMes.mes === '2025-12') {
                          console.log(`🔍 DEBUG - Renderizando Mes ${datoMes.mes}, Divisa ${divisa.codigo}:`, {
                            ultimoDia: ultimoDia?.fecha,
                            totalDivisaMes,
                            totalUSDDivisaMes,
                            ratio,
                            bancosCount: divisaDataUltimoDia?.bancos.length || 0,
                            divisaDataExiste: !!divisaData,
                            divisaDataTotal: divisaData?.total,
                            divisaDataUltimoDiaTotal: divisaDataUltimoDia?.total
                          })
                        }

                        // Verificar si AL MENOS UNO de los días del mes tiene saldos actuales para esta divisa
                        const algunDiaConActual = datoMes.diasDelMes.some(datoFecha => {
                          const saldosDivisaDia = datos
                            .filter(d => d.fecha === datoFecha.fecha)
                            .filter(d => {
                              if ('cuenta' in d && d.cuenta) {
                                const cuenta = d.cuenta as any
                                return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                              } else {
                                return d.codigo_divisa === divisa.codigo
                              }
                            })
                          return saldosDivisaDia.some(d => {
                            const huboMovimientos = d.hubo_movimientos !== undefined ? d.hubo_movimientos : (d as any).es_actual || false
                            return huboMovimientos
                          })
                        })
                        
                        // Para el total de la divisa expandida: SIEMPRE gris (los totales siempre están en gris)
                        const fondoCeldaTotal = 'bg-gray-200'

                        return (
                          <React.Fragment key={`${datoMes.mes}-${divisa.codigo}`}>
                            {bancos.map((banco, bancoIdx) => {
                              // Usar el último día del mes para obtener el balance del banco
                              const bancoData = divisaDataUltimoDia?.bancos.find(
                                b => b.codigo_banco === banco.codigo
                              )
                              const valor = bancoData?.total || 0
                              
                              // Calcular USD directamente si ratio es 0 o no está disponible
                              let valorEnUSD: number
                              if (ratio > 0 && totalDivisaMes > 0) {
                                valorEnUSD = valor * ratio
                              } else {
                                valorEnUSD = calcularSaldoUSD(valor, divisa.codigo)
                              }

                              // Verificar si este banco específico tiene saldos actuales en algún día del mes
                              // Usar la función tieneMovimientosActuales para cada día del mes
                              const bancoTieneActual = datoMes.diasDelMes.some(datoFecha => {
                                return tieneMovimientosActuales(datoFecha.fecha, banco.codigo, divisa.codigo)
                              })
                              
                              // bancoTieneActual = true: fondo blanco, bancoTieneActual = false: fondo gris
                              const fondoCeldaBanco = bancoTieneActual ? 'bg-white' : 'bg-gray-200'

                              return (
                                <td
                                  key={banco.codigo}
                                  className={`px-4 py-3 text-sm text-right text-gray-900 font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:underline ${
                                    bancoIdx === 0 ? 'border-l-2 border-gray-400' : 'border-l border-gray-300'
                                  } ${fondoCeldaBanco}`}
                                  onClick={() => handleMonthCellClick(datoMes.mes, banco.nombre, banco.codigo, divisa.codigo)}
                                  title="Click para ver todos los movimientos del mes"
                                >
                                  {formatearMonedaConConversion(valor, divisa.codigo, divisa.simbolo, divisa.decimales)}
                                </td>
                              )
                            })}
                            {/* Celda Total */}
                            <td className={`px-4 py-3 text-sm text-right text-gray-900 font-bold border-l border-gray-400 whitespace-nowrap ${fondoCeldaTotal}`}>
                              {formatearMonedaConConversion(totalDivisaMes, divisa.codigo, divisa.simbolo, divisa.decimales)}
                            </td>
                          </React.Fragment>
                        )
                      } else {
                        // Mostrar celda de total de divisa
                        // Usar el último día del mes para obtener el balance final
                        const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
                        const divisaDataUltimoDia = ultimoDia?.divisas.get(divisa.codigo)
                        const total = divisaDataUltimoDia?.total || 0
                        
                        // Calcular total en USD para esta divisa en este mes (último día, no suma)
                        const totalUSDDivisa = ultimoDia ? datos
                          .filter(d => d.fecha === ultimoDia.fecha)
                          .filter(d => {
                            if ('cuenta' in d && d.cuenta) {
                              const cuenta = d.cuenta as any
                              return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                            } else {
                              return d.codigo_divisa === divisa.codigo
                            }
                          })
                          .reduce((s, d) => s + calcularSaldoUSD(Number(d.saldo_divisa), divisa.codigo), 0) : 0

                        // Verificar si AL MENOS UNO de los días del mes tiene saldos actuales para esta divisa
                        const algunDiaConActual = datoMes.diasDelMes.some(datoFecha => {
                          const saldosDivisaDia = datos
                            .filter(d => d.fecha === datoFecha.fecha)
                            .filter(d => {
                              if ('cuenta' in d && d.cuenta) {
                                const cuenta = d.cuenta as any
                                return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                              } else {
                                return d.codigo_divisa === divisa.codigo
                              }
                            })
                          return saldosDivisaDia.some(d => {
                            const huboMovimientos = d.hubo_movimientos !== undefined ? d.hubo_movimientos : (d as any).es_actual || false
                            return huboMovimientos
                          })
                        })
                        
                        // Para el total de la divisa colapsada: SIEMPRE gris (los totales siempre están en gris)
                        const fondoCelda = 'bg-gray-200'

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
                            {formatearMonedaConConversion(total, divisa.codigo, divisa.simbolo, divisa.decimales)}
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
                        return formatearMonedaConConversion(totalUSDUltimoDia, 'USD', 'U$S', 2)
                      })()}
                    </td>
                  </tr>

                  {/* Filas de días (solo si el mes está expandido) */}
                  {mesExpandido &&
                    datoMes.diasDelMes.map((datoFecha, idxDia) => {
                      // Verificar si este día tiene al menos un movimiento actual en alguna divisa
                      const diaTieneActuales = datos.some(d => {
                        if (d.fecha === datoFecha.fecha) {
                          const huboMovimientos = d.hubo_movimientos !== undefined ? d.hubo_movimientos : (d as any).es_actual || false
                          return huboMovimientos
                        }
                        return false
                      })
                      
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
                          const enUSD = mostrarEnUSD

                          if (isExpanded && bancos.length > 0) {
                            // Mostrar celdas de bancos + total
                            const totalDivisaDia = divisaData?.total || 0
                            const totalUSDDivisaDia = datos
                              .filter(d => d.fecha === datoFecha.fecha)
                              .filter(d => {
                                if ('cuenta' in d && d.cuenta) {
                                  const cuenta = d.cuenta as any
                                  return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                                } else {
                                  return d.codigo_divisa === divisa.codigo
                                }
                              })
                              .reduce((s, d) => s + calcularSaldoUSD(Number(d.saldo_divisa), divisa.codigo), 0)
                            const ratio = totalDivisaDia > 0 ? totalUSDDivisaDia / totalDivisaDia : 0

                            return (
                              <React.Fragment key={`${datoFecha.fecha}-${divisa.codigo}`}>
                                {bancos.map((banco, bancoIdx) => {
                                  const bancoData = divisaData?.bancos.find(
                                    b => b.codigo_banco === banco.codigo
                                  )
                                  const valor = bancoData?.total || 0
                                  
                                  // Calcular USD directamente si ratio es 0 o no está disponible
                                  let valorEnUSD: number
                                  if (ratio > 0 && totalDivisaDia > 0) {
                                    valorEnUSD = valor * ratio
                                  } else {
                                    valorEnUSD = calcularSaldoUSD(valor, divisa.codigo)
                                  }
                                  
                                  // Verificar si este banco tiene movimientos actuales (al menos uno)
                                  const tieneActuales = tieneMovimientosActuales(datoFecha.fecha, banco.codigo, divisa.codigo)
                                  // tieneActuales = true: fondo blanco, tieneActuales = false: fondo gris
                                  const fondoCelda = tieneActuales ? 'bg-white' : 'bg-gray-200'
                                  const esClickeable = tieneActuales ? 'cursor-pointer hover:bg-gray-100 hover:underline' : ''
                                  const bordeDivisa = bancoIdx === 0 ? 'border-l-2 border-gray-400' : 'border-l border-gray-300'

                                  return (
                                    <td
                                      key={banco.codigo}
                                      className={`px-4 py-2 text-sm text-right text-gray-700 whitespace-nowrap ${bordeDivisa} ${fondoCelda} ${esClickeable}`}
                                      onClick={() => tieneActuales && handleCellClick(datoFecha.fecha, banco.nombre, banco.codigo, divisa.codigo)}
                                      title={tieneActuales ? 'Click para ver movimientos detallados' : 'Sin movimientos actuales'}
                                    >
                                      {formatearMonedaConConversion(valor, divisa.codigo, divisa.simbolo, divisa.decimales)}
                                    </td>
                                  )
                                })}
                                {/* Celda Total - SIEMPRE gris */}
                                <td className={`px-4 py-2 text-sm text-right text-gray-700 font-bold border-l border-gray-400 whitespace-nowrap bg-gray-200`}>
                                  {formatearMonedaConConversion(totalDivisaDia, divisa.codigo, divisa.simbolo, divisa.decimales)}
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
                                if ('cuenta' in d && d.cuenta) {
                                  const cuenta = d.cuenta as any
                                  return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
                                } else {
                                  return d.codigo_divisa === divisa.codigo
                                }
                              })
                            const totalUSDDivisa = saldosDivisaDia.reduce((s, d) => s + calcularSaldoUSD(Number(d.saldo_divisa), divisa.codigo), 0)
                            
                            // Verificar si AL MENOS UNO de los saldos de esta divisa en este día es actual
                            const algunoActual = saldosDivisaDia.some(d => {
                              const huboMovimientos = d.hubo_movimientos !== undefined ? d.hubo_movimientos : (d as any).es_actual || false
                              return huboMovimientos
                            })
                            // algunoActual = true: fondo blanco, algunoActual = false: fondo gris
                            const fondoCelda = algunoActual ? 'bg-white' : 'bg-gray-200'
                            
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
                                {formatearMonedaConConversion(total, divisa.codigo, divisa.simbolo, divisa.decimales)}
                              </td>
                            )
                          }
                        })}
                        {/* Celda TOTAL USD para el día */}
                        <td className={`px-4 py-2 text-sm text-right text-gray-700 font-medium border-l-2 border-gray-400 whitespace-nowrap ${fondoFilaDia}`}>
                          {formatearMonedaConConversion(datosConUSD.get(datoFecha.fecha) || 0, 'USD', 'U$S', 2)}
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

                // Obtener el último día disponible (último balance)
                const ultimoDia = datosPorFecha.length > 0 ? datosPorFecha[datosPorFecha.length - 1] : null
                
                // Calcular el total USD de esta divisa usando el último balance disponible
                const totalUSDDivisa = ultimoDia ? (datosUSDPorDivisaFecha.get(`${ultimoDia.fecha}|${divisa.codigo}`) || 0) : 0

                // Calcular el total USD general usando el último balance disponible
                const totalUSDGeneral = ultimoDia ? (datosConUSD.get(ultimoDia.fecha) || 0) : 0

                const porcentaje = totalUSDGeneral > 0 ? (totalUSDDivisa / totalUSDGeneral) * 100 : 0

                if (isExpanded && bancos.length > 0) {
                  // Mostrar porcentajes por banco + total
                  return (
                    <React.Fragment key={`porcentaje-${divisa.codigo}`}>
                      {bancos.map((banco, bancoIdx) => {
                        // Calcular porcentaje de este banco específico usando el último balance disponible
                        let totalUSDBanco = 0
                        if (ultimoDia) {
                          const divisaData = ultimoDia.divisas.get(divisa.codigo)
                          if (divisaData) {
                            const bancoData = divisaData.bancos.find(b => b.codigo_banco === banco.codigo)
                            if (bancoData) {
                              const key = `${ultimoDia.fecha}|${divisa.codigo}`
                              const usdDivisa = datosUSDPorDivisaFecha.get(key) || 0
                              const totalDivisa = divisaData.total || 1
                              const ratio = totalDivisa > 0 ? usdDivisa / totalDivisa : 0
                              totalUSDBanco = bancoData.total * ratio
                            }
                          }
                        }

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

