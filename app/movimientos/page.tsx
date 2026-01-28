'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertCircle, Filter, Calendar, Building2, Tag, DollarSign, Table2, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, Briefcase, Download, Trash2, X, Plus, CheckSquare, Square } from 'lucide-react'
import { formatearMoneda, formatMonedaInput, parseMonedaInput } from '@/lib/formato-moneda'
import { exportarACSV } from '@/lib/exportar-csv'
import { exportarAExcel } from '@/lib/exportar-excel'
import { exportarMovimientosAPDF } from '@/lib/exportar-pdf-movimientos'
import { obtenerTasasCambioUltimaFecha } from '@/lib/divisas'
import Link from 'next/link'
import GraficaCategorias from '@/components/GraficaCategorias'
import MenuNavegacion from '@/components/MenuNavegacion'

interface Movimiento {
  id_movimiento: number
  fecha_mov: string
  concepto: string
  comentarios: string | null
  debito: number | null
  credito: number | null
  saldo: number // Calculado desde crédito/débito
  id_cuenta: number
  id_odoo: number | null
  id_categoria: number | null
  numero_cuenta: string
  nombre_banco: string
  categoria_nombre: string
  codigo_divisa: string
  simbolo_divisa: string
  decimales_divisa: number
  nombre_empresa: string | null
  nombre_pais: string | null
  nombre_sheet_origen: string | null
}

interface Banco {
  id_banco: number
  nombre: string
}

interface Categoria {
  id_categoria: number
  nombre: string
  descripcion: string | null
}

interface Divisa {
  codigo_divisa: string
  nombre: string
  simbolo: string
  decimales: number
}

interface Empresa {
  id_empresa: number
  nombre: string
}

interface CuentaOption {
  id_cuenta: number
  label: string
}

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  // Inicializar loading en true si hay parámetros en la URL para evitar mostrar datos incorrectos
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.toString().length > 0 // Si hay parámetros, empezar cargando
    }
    return false
  })
  const [error, setError] = useState<string | null>(null)
  const [filtrosConfigurados, setFiltrosConfigurados] = useState(false)
  
  // Datos para filtros
  const [bancos, setBancos] = useState<Banco[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [divisas, setDivisas] = useState<Divisa[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [nombresSheetOrigen, setNombresSheetOrigen] = useState<string[]>([])
  
  // Filtros activos (se aplican automáticamente)
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Set<number>>(new Set())
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<Set<number>>(new Set())
  const [divisasSeleccionadas, setDivisasSeleccionadas] = useState<Set<string>>(new Set())
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<Set<number>>(new Set())
  const [nombresSheetOrigenSeleccionados, setNombresSheetOrigenSeleccionados] = useState<Set<string>>(new Set())
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [cuentaIdSeleccionada, setCuentaIdSeleccionada] = useState<number | null>(null)

  // Ordenamiento
  type CampoOrdenamiento = 'fecha' | 'banco' | 'divisa' | 'categoria' | null
  const [campoOrdenamiento, setCampoOrdenamiento] = useState<CampoOrdenamiento>('fecha')
  const [direccionOrdenamiento, setDireccionOrdenamiento] = useState<'asc' | 'desc'>('asc')
  
  // Estado para mostrar/ocultar filtros
  const [filtrosVisibles, setFiltrosVisibles] = useState<boolean>(false)
  
  // Estado para controlar qué secciones de filtros están abiertas
  const [seccionesFiltrosAbiertas, setSeccionesFiltrosAbiertas] = useState({
    fechas: true,
    bancos: true,
    categorias: true,
    divisas: true,
    empresas: true,
    nombresSheetOrigen: true,
    columnasVisibles: true
  })

  const toggleSeccionFiltro = (seccion: keyof typeof seccionesFiltrosAbiertas) => {
    setSeccionesFiltrosAbiertas(prev => ({
      ...prev,
      [seccion]: !prev[seccion]
    }))
  }
  
  // Estado para controlar visibilidad de columnas (valores por defecto según imagen)
  const [columnasVisibles, setColumnasVisibles] = useState({
    fecha: true,
    banco: true,
    numeroCuenta: false,
    divisa: true,
    concepto: true,
    debito: true,
    credito: true,
    saldoPosterior: true,
    comentario: false,
    categoria: true,
    idOdoo: false,
    empresa: false,
    pais: false,
    nombreSheetOrigen: false
  })
  
  // Estado para selección de movimientos
  const [movimientosSeleccionados, setMovimientosSeleccionados] = useState<Set<number>>(new Set())
  const [ultimoIndiceSeleccionado, setUltimoIndiceSeleccionado] = useState<number | null>(null)
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // Estado para paginación
  const [itemsPerPage, setItemsPerPage] = useState<number>(100)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [editingItemsPerPage, setEditingItemsPerPage] = useState<boolean>(false)
  const [tempItemsPerPage, setTempItemsPerPage] = useState<string>('100')
  const [editingStartIndex, setEditingStartIndex] = useState<boolean>(false)
  const [tempStartIndex, setTempStartIndex] = useState<string>('1')

  // Sincronizar tempItemsPerPage cuando cambia itemsPerPage
  useEffect(() => {
    if (!editingItemsPerPage) {
      setTempItemsPerPage(itemsPerPage.toString())
    }
  }, [itemsPerPage, editingItemsPerPage])

  // Modal crear movimiento
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false)
  const [creando, setCreando] = useState(false)
  const [cuentasLista, setCuentasLista] = useState<CuentaOption[]>([])
  const [formCrear, setFormCrear] = useState({
    fecha_mov: new Date().toISOString().split('T')[0],
    id_cuenta: '' as number | '',
    id_categoria: '' as number | '',
    concepto: '',
    comentarios: '',
    debito: '',
    credito: '',
    id_odoo: ''
  })

  const cargarMovimientos = useCallback(async (
    filtrosBancos: Set<number> = bancosSeleccionados,
    filtrosCategorias: Set<number> = categoriasSeleccionadas,
    filtrosDivisas: Set<string> = divisasSeleccionadas,
    filtrosEmpresas: Set<number> = empresasSeleccionadas,
    filtrosNombresSheetOrigen: Set<string> = nombresSheetOrigenSeleccionados,
    filtroFechaDesde: string = fechaDesde,
    filtroFechaHasta: string = fechaHasta,
    filtroCuentaId: number | null = cuentaIdSeleccionada
  ) => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Cargando todos los movimientos con filtros...')
      console.log('   Filtros:', {
        bancos: Array.from(filtrosBancos),
        categorias: Array.from(filtrosCategorias),
        divisas: Array.from(filtrosDivisas),
        fechaDesde: filtroFechaDesde,
        fechaHasta: filtroFechaHasta
      })

      // Cargar movimientos con paginación
      let todosLosMovimientos: any[] = []
      let desde = 0
      const tamañoPagina = 1000
      let hayMasDatos = true

      while (hayMasDatos) {
        console.log(`   📄 Cargando página desde registro ${desde}...`)

        // Construir query base
        let query = supabase
          .from('movimiento')
          .select(`
            id_movimiento,
            fecha_mov,
            concepto,
            comentarios,
            debito,
            credito,
            id_cuenta,
            id_odoo,
            id_categoria,
            cuenta!inner (
              id_cuenta,
              id_empresa,
              numero_cuenta,
              nombre_sheet_origen,
              activo,
              empresa (
                id_empresa,
                nombre
              ),
              banco_pais_divisa (
                codigo_divisa,
                divisa (
                  codigo_divisa,
                  nombre,
                  simbolo,
                  decimales
                ),
                banco_pais (
                  banco (
                    id_banco,
                    nombre
                  ),
                  pais (
                    codigo_pais,
                    nombre
                  )
                )
              )
            ),
            categoria_movimiento (
              nombre
            )
          `)
          .eq('cuenta.activo', true)

        // Aplicar filtros
        if (filtroCuentaId) {
          query = query.eq('id_cuenta', filtroCuentaId)
          console.log(`   🏦 Filtrando por cuenta ID: ${filtroCuentaId}`)
        }

        // NO filtrar por categoría aquí - necesitamos todos los movimientos para calcular el saldo correctamente
        // El filtro de categoría se aplicará después en el cliente

        if (filtroFechaDesde) {
          query = query.gte('fecha_mov', filtroFechaDesde)
          console.log(`   📅 Filtrando desde fecha: ${filtroFechaDesde}`)
        }

        if (filtroFechaHasta) {
          query = query.lte('fecha_mov', filtroFechaHasta)
          console.log(`   📅 Filtrando hasta fecha: ${filtroFechaHasta}`)
        }

        // Ordenar por fecha descendente (más recientes primero)
        // Nota: Supabase no permite múltiples .order() encadenados, así que ordenamos en el frontend
        const { data: movimientosPagina, error: errorMovimientos } = await query
          .order('fecha_mov', { ascending: false })
          .range(desde, desde + tamañoPagina - 1)

        if (errorMovimientos) {
          console.error('❌ ERROR en consulta Supabase:', errorMovimientos)
          throw errorMovimientos
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

      console.log('✅ Movimientos cargados:', todosLosMovimientos.length)

      // Filtrar por banco y divisa en el cliente (ya que requiere joins)
      // Nota: Si hay filtroCuentaId, ya está filtrado en la query, pero aún necesitamos filtrar por banco y divisa
      const movimientosFiltrados = todosLosMovimientos
        .filter(m => {
          const cuenta = m.cuenta as any
          if (!cuenta) return false
          
          // Si hay filtroCuentaId, verificar que coincida (id_cuenta está en m directamente)
          if (filtroCuentaId) {
            const idCuenta = (m as any).id_cuenta ?? cuenta?.id_cuenta
            if (idCuenta !== filtroCuentaId) {
              return false
            }
          }
          
          const bancoPaisDivisa = cuenta?.banco_pais_divisa
          if (!bancoPaisDivisa) return false
          
          const banco = bancoPaisDivisa?.banco_pais?.banco
          const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
          
          // Filtrar por banco (si hay bancos seleccionados y no hay filtroCuentaId)
          if (filtrosBancos.size > 0 && !filtroCuentaId) {
            if (!banco?.id_banco || !filtrosBancos.has(banco.id_banco)) {
              return false
            }
          }

          // Filtrar por divisa (si hay divisas seleccionadas)
          if (filtrosDivisas.size > 0) {
            if (!divisa || !filtrosDivisas.has(divisa)) {
              return false
            }
          }

          // Filtrar por empresa (si hay empresas seleccionadas)
          if (filtrosEmpresas.size > 0) {
            if (!cuenta.id_empresa || !filtrosEmpresas.has(cuenta.id_empresa)) {
          return false
            }
          }

          // Filtrar por nombre_sheet_origen (si hay nombres seleccionados)
          if (filtrosNombresSheetOrigen.size > 0) {
            const nombreSheet = cuenta?.nombre_sheet_origen
            if (!nombreSheet || !filtrosNombresSheetOrigen.has(nombreSheet)) {
              return false
            }
          }

          return true
        })
        .map(m => {
          const cuenta = m.cuenta as any
          const bancoPaisDivisa = cuenta?.banco_pais_divisa
          const banco = bancoPaisDivisa?.banco_pais?.banco
          const pais = bancoPaisDivisa?.banco_pais?.pais
          const divisa = bancoPaisDivisa?.divisa
          const categoria = m.categoria_movimiento as any
          const empresa = cuenta?.empresa

          return {
            id_movimiento: m.id_movimiento,
            fecha_mov: m.fecha_mov,
            concepto: m.concepto || '',
            comentarios: m.comentarios || null,
            debito: m.debito,
            credito: m.credito,
            id_cuenta: (m as any).id_cuenta ?? cuenta?.id_cuenta ?? 0,
            id_odoo: m.id_odoo,
            id_categoria: m.id_categoria || null,
            numero_cuenta: cuenta?.numero_cuenta || '',
            nombre_banco: banco?.nombre || '',
            categoria_nombre: categoria?.nombre || 'Sin categoría',
            codigo_divisa: divisa?.codigo_divisa || '',
            simbolo_divisa: divisa?.simbolo || '$',
            decimales_divisa: divisa?.decimales || 2,
            nombre_empresa: empresa?.nombre || null,
            nombre_pais: pais?.nombre || null,
            nombre_sheet_origen: cuenta?.nombre_sheet_origen || null,
            saldo: 0 // Se calculará después
          }
        })

      // Si hay filtro "desde fecha", cargar TODOS los movimientos anteriores a esa fecha
      // de las mismas cuentas, para calcular el saldo inicial y que el Saldo Posterior
      // refleje siempre el saldo real de la cuenta (no reiniciado por el filtro).
      const saldoAnteriorPorCuenta = new Map<number, number>()
      if (filtroFechaDesde && movimientosFiltrados.length > 0) {
        const cuentasSet = new Set(movimientosFiltrados.map(m => m.id_cuenta))
        let desdeAnt = 0
        let hayMasAnt = true
        while (hayMasAnt) {
          const { data: anterior, error: errAnt } = await supabase
            .from('movimiento')
            .select('id_cuenta, credito, debito')
            .in('id_cuenta', Array.from(cuentasSet))
            .lt('fecha_mov', filtroFechaDesde)
            .range(desdeAnt, desdeAnt + tamañoPagina - 1)
          if (errAnt) {
            console.warn('⚠️ Error al cargar movimientos anteriores para saldo:', errAnt)
            break
          }
          if (anterior && anterior.length > 0) {
            anterior.forEach((m: any) => {
              const id = m.id_cuenta
              const c = m.credito ?? 0
              const d = m.debito ?? 0
              saldoAnteriorPorCuenta.set(id, (saldoAnteriorPorCuenta.get(id) ?? 0) + (c - d))
            })
            if (anterior.length < tamañoPagina) hayMasAnt = false
            else desdeAnt += tamañoPagina
          } else {
            hayMasAnt = false
          }
        }
        console.log('✅ Saldo anterior por cuenta (movimientos < ' + filtroFechaDesde + '):', Object.fromEntries(saldoAnteriorPorCuenta))
      }

      // Calcular saldo usando TODOS los movimientos de la cuenta (incl. anteriores al filtro de fecha)
      // Esto asegura que el saldo mostrado sea el saldo real del banco
      const movimientosParaCalculoSaldo = [...movimientosFiltrados].sort((a, b) => {
        // Primero por cuenta
        if (a.id_cuenta !== b.id_cuenta) {
          return a.id_cuenta - b.id_cuenta
        }
        // Luego por fecha (ascendente) - del más antiguo al más reciente
        const fechaA = new Date(a.fecha_mov).getTime()
        const fechaB = new Date(b.fecha_mov).getTime()
        if (fechaA !== fechaB) {
          return fechaA - fechaB
        }
        // Finalmente por id_odoo (ascendente) - menor a mayor, para que coincida con el orden de visualización
        // Si no tiene id_odoo, tratarlo como el valor más grande (último movimiento)
        const idOdooA = a.id_odoo ?? Number.MAX_SAFE_INTEGER
        const idOdooB = b.id_odoo ?? Number.MAX_SAFE_INTEGER
        return idOdooA - idOdooB
      })

      // Calcular saldo acumulativo por cuenta: empezar con el saldo anterior (movimientos previos al filtro)
      // y luego sumar los movimientos del rango mostrado.
      const saldosPorMovimiento = new Map<number, number>()
      const saldosPorCuenta = new Map<number, number>()
      saldoAnteriorPorCuenta.forEach((s, id) => saldosPorCuenta.set(id, s))
      
      movimientosParaCalculoSaldo.forEach(mov => {
        const saldoAnterior = saldosPorCuenta.get(mov.id_cuenta) ?? 0
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        const nuevoSaldo = saldoAnterior + (credito - debito)
        saldosPorCuenta.set(mov.id_cuenta, nuevoSaldo)
        // Guardar el saldo calculado para este movimiento específico
        saldosPorMovimiento.set(mov.id_movimiento, nuevoSaldo)
        mov.saldo = nuevoSaldo
      })

      // Ahora filtrar por categoría (si hay categorías seleccionadas) SOLO para la visualización
      // pero manteniendo los saldos calculados con todos los movimientos
      let movimientosParaMostrar = movimientosParaCalculoSaldo
      if (filtrosCategorias.size > 0) {
        movimientosParaMostrar = movimientosParaCalculoSaldo.filter(mov => {
          const idCategoria = mov.id_categoria
          return idCategoria && filtrosCategorias.has(idCategoria)
        })
        // Asignar los saldos correctos a los movimientos filtrados
        movimientosParaMostrar.forEach(mov => {
          mov.saldo = saldosPorMovimiento.get(mov.id_movimiento) || 0
        })
      }

      // Ordenar por fecha descendente y luego por id_odoo descendente ANTES de setear el estado
      const movimientosOrdenados = movimientosParaMostrar.sort((a, b) => {
        // Primero ordenar por fecha descendente (más recientes primero)
        const fechaA = new Date(a.fecha_mov).getTime()
        const fechaB = new Date(b.fecha_mov).getTime()
        if (fechaA !== fechaB) {
          return fechaB - fechaA // Descendente: más recientes primero
        }
        // Si las fechas son iguales, ordenar por id_odoo descendente (de mayor a menor)
        // Si no tiene id_odoo, tratarlo como el valor más grande (último movimiento)
        const idOdooA = a.id_odoo ?? Number.MAX_SAFE_INTEGER
        const idOdooB = b.id_odoo ?? Number.MAX_SAFE_INTEGER
        return idOdooB - idOdooA
      })

      console.log('✅ Movimientos filtrados y ordenados:', movimientosOrdenados.length)
      setMovimientos(movimientosOrdenados)

    } catch (err: any) {
      console.error('❌ Error al cargar movimientos:', err)
      setError(err.message || 'Error al cargar los movimientos')
    } finally {
      setLoading(false)
    }
  }, [bancosSeleccionados, categoriasSeleccionadas, divisasSeleccionadas, empresasSeleccionadas, nombresSheetOrigenSeleccionados, fechaDesde, fechaHasta, cuentaIdSeleccionada])

  // Leer parámetros de la URL al cargar la página
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      
      // Si hay parámetros, activar loading y marcar que los filtros no están configurados
      const tieneParametros = params.toString().length > 0
      if (tieneParametros) {
        setLoading(true)
        setFiltrosConfigurados(false)
      }
      
      // Leer fechaDesde y fechaHasta
      const fechaDesdeParam = params.get('fechaDesde')
      const fechaHastaParam = params.get('fechaHasta')
      if (fechaDesdeParam) {
        setFechaDesde(fechaDesdeParam)
      }
      if (fechaHastaParam) {
        setFechaHasta(fechaHastaParam)
      }
      
      // Leer cuentaId o bancoId
      const cuentaIdParam = params.get('cuentaId')
      const bancoIdParam = params.get('bancoId')
      
      // Leer categorías
      const categoriasParam = params.get('categorias')
      if (categoriasParam) {
        const categoriasArray = categoriasParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))
        const categoriasSet = new Set(categoriasArray)
        setCategoriasSeleccionadas(categoriasSet)
      }
      
      // Leer divisa
      const codigoDivisaParam = params.get('codigoDivisa')
      if (codigoDivisaParam) {
        const divisaSet = new Set([codigoDivisaParam])
        setDivisasSeleccionadas(divisaSet)
      }
      
      // Leer cuentaId y aplicarlo directamente
      if (cuentaIdParam) {
        const cuentaId = parseInt(cuentaIdParam)
        if (!isNaN(cuentaId)) {
          setCuentaIdSeleccionada(cuentaId)
        }
      }
      
      // Si hay parámetros, cargar datos de filtros y luego aplicar
      if (fechaDesdeParam || fechaHastaParam || cuentaIdParam || bancoIdParam || categoriasParam || codigoDivisaParam) {
        // Cargar datos de filtros primero
        cargarDatosFiltros().then(async () => {
          // Si hay cuentaId, buscar el banco correspondiente a esta cuenta
          if (cuentaIdParam) {
            const cuentaId = parseInt(cuentaIdParam)
            if (!isNaN(cuentaId)) {
              // Buscar la cuenta en Supabase para obtener el banco (solo si está activa)
              const { data: cuentaData, error: errorCuenta } = await supabase
                .from('cuenta')
                .select(`
                  id_cuenta,
                  activo,
                  banco_pais_divisa (
                    banco_pais (
                      banco (
                        id_banco
                      )
                    )
                  )
                `)
                .eq('id_cuenta', cuentaId)
                .eq('activo', true)
                .single()
              
              if (!errorCuenta && cuentaData) {
                const bancoId = (cuentaData.banco_pais_divisa as any)?.banco_pais?.banco?.id_banco
                if (bancoId) {
                  setBancosSeleccionados(prev => new Set([...prev, bancoId]))
                }
              }
            }
          }
          
          if (bancoIdParam) {
            const bancoId = parseInt(bancoIdParam)
            if (!isNaN(bancoId)) {
              setBancosSeleccionados(prev => new Set([...prev, bancoId]))
            }
          }
          
          // Marcar que los filtros están configurados
          setFiltrosConfigurados(true)
        })
      } else {
        // Si no hay parámetros, marcar como configurado inmediatamente
        setFiltrosConfigurados(true)
      }
    }
  }, [])

  // Cargar datos de filtros siempre al montar (solo si no hay parámetros en URL, 
  // porque si hay parámetros ya se carga en el useEffect anterior)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tieneParametros = params.toString().length > 0
      
      // Solo cargar aquí si NO hay parámetros (si hay parámetros, ya se carga en el otro useEffect)
      if (!tieneParametros) {
        cargarDatosFiltros().then(() => {
          setFiltrosConfigurados(true)
        })
      }
    }
  }, [])

  // Limpiar selección cuando cambian los movimientos
  useEffect(() => {
    setMovimientosSeleccionados(new Set())
    setUltimoIndiceSeleccionado(null)
  }, [movimientos])

  // Aplicar filtros automáticamente cuando cambian
  useEffect(() => {
    // No cargar movimientos hasta que los filtros estén configurados (si venían de URL)
    if (!filtrosConfigurados) {
      console.log('⏳ Esperando a que los filtros se configuren...')
      return
    }
    
    // Cargar movimientos siempre
    // Si hay filtros activos, cargar inmediatamente
    // Si no hay filtros activos, también cargar (todos los movimientos)
    const tieneFiltrosActivos = fechaDesde || fechaHasta || cuentaIdSeleccionada || divisasSeleccionadas.size > 0 || bancosSeleccionados.size > 0 || categoriasSeleccionadas.size > 0 || empresasSeleccionadas.size > 0 || nombresSheetOrigenSeleccionados.size > 0
    
    console.log('🔍 useEffect - Verificando si cargar movimientos:', {
      tieneFiltrosActivos,
      fechaDesde,
      fechaHasta,
      cuentaIdSeleccionada,
      divisasSeleccionadas: Array.from(divisasSeleccionadas),
      bancosSeleccionados: Array.from(bancosSeleccionados),
      categoriasSeleccionadas: Array.from(categoriasSeleccionadas),
      empresasSeleccionadas: Array.from(empresasSeleccionadas),
      nombresSheetOrigenSeleccionados: Array.from(nombresSheetOrigenSeleccionados),
      filtrosConfigurados
    })
    
    // Siempre cargar movimientos (con o sin filtros)
    console.log('✅ Ejecutando cargarMovimientos()')
    cargarMovimientos()
  }, [bancosSeleccionados, categoriasSeleccionadas, divisasSeleccionadas, empresasSeleccionadas, nombresSheetOrigenSeleccionados, fechaDesde, fechaHasta, cuentaIdSeleccionada, filtrosConfigurados, cargarMovimientos])

  // Cargar tasas de cambio según la última fecha visible
  useEffect(() => {
    const cargarTasasCambio = async () => {
      try {
        const tasas = await obtenerTasasCambioUltimaFecha(fechaDesde || undefined, fechaHasta || undefined)
        setTasasCambio(tasas)
      } catch (error) {
        console.error('Error al cargar tasas de cambio:', error)
      }
    }
    
    cargarTasasCambio()
  }, [fechaDesde, fechaHasta])

  const cargarDatosFiltros = async () => {
    try {
      // Cargar bancos
      const { data: bancosData, error: errorBancos } = await supabase
        .from('banco')
        .select('id_banco, nombre')
        .order('nombre', { ascending: true })

      if (errorBancos) {
        console.error('Error al cargar bancos:', errorBancos)
      } else if (bancosData) {
        setBancos(bancosData)
      }

      // Cargar categorías
      const { data: categoriasData, error: errorCategorias } = await supabase
        .from('categoria_movimiento')
        .select('id_categoria, nombre, descripcion')
        .order('nombre', { ascending: true })

      if (errorCategorias) {
        console.error('Error al cargar categorías:', errorCategorias)
      } else if (categoriasData) {
        setCategorias(categoriasData)
      }

      // Cargar divisas
      const { data: divisasData, error: errorDivisas } = await supabase
        .from('divisa')
        .select('codigo_divisa, nombre, simbolo, decimales')
        .order('codigo_divisa', { ascending: true })

      if (errorDivisas) {
        console.error('Error al cargar divisas:', errorDivisas)
      } else if (divisasData) {
        setDivisas(divisasData)
      }

      // Cargar empresas
      const { data: empresasData, error: errorEmpresas } = await supabase
        .from('empresa')
        .select('id_empresa, nombre')
        .order('nombre', { ascending: true })

      if (errorEmpresas) {
        console.error('Error al cargar empresas:', errorEmpresas)
      } else if (empresasData) {
        setEmpresas(empresasData)
      }

      // Cargar nombres de sheet origen únicos
      const { data: cuentasData, error: errorCuentas } = await supabase
        .from('cuenta')
        .select('nombre_sheet_origen')
        .eq('activo', true)
        .not('nombre_sheet_origen', 'is', null)

      if (errorCuentas) {
        console.error('Error al cargar nombres sheet origen:', errorCuentas)
      } else if (cuentasData) {
        // Obtener valores únicos y ordenados
        const nombresUnicos = Array.from(
          new Set(
            cuentasData
              .map(c => c.nombre_sheet_origen)
              .filter((nombre): nombre is string => nombre !== null)
          )
        ).sort()
        setNombresSheetOrigen(nombresUnicos)
      }
    } catch (err: any) {
      console.error('Error al cargar datos de filtros:', err)
    }
  }

  // Funciones para modificar filtros
  const toggleBanco = (idBanco: number) => {
    setBancosSeleccionados(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idBanco)) {
        newSet.delete(idBanco)
      } else {
        newSet.add(idBanco)
      }
      return newSet
    })
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

  const toggleDivisa = (codigoDivisa: string) => {
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

  const toggleEmpresa = (idEmpresa: number) => {
    setEmpresasSeleccionadas(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idEmpresa)) {
        newSet.delete(idEmpresa)
      } else {
        newSet.add(idEmpresa)
      }
      return newSet
    })
  }

  const toggleNombreSheetOrigen = (nombreSheet: string) => {
    setNombresSheetOrigenSeleccionados(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nombreSheet)) {
        newSet.delete(nombreSheet)
      } else {
        newSet.add(nombreSheet)
      }
      return newSet
    })
  }

  // Función para alternar visibilidad de columnas
  const toggleColumna = (columna: keyof typeof columnasVisibles) => {
    setColumnasVisibles(prev => ({
      ...prev,
      [columna]: !prev[columna]
    }))
  }

  // Limpiar filtros
  // Exportar movimientos a CSV
  const exportarMovimientosCSV = () => {
    if (movimientosOrdenados.length === 0) {
      alert('No hay movimientos para exportar')
      return
    }

    const datosExportar = movimientosOrdenados.map(mov => ({
      Fecha: mov.fecha_mov,
      Banco: mov.nombre_banco,
      'N° Cuenta': mov.numero_cuenta,
      Divisa: mov.codigo_divisa,
      Concepto: mov.concepto || '',
      Débito: mov.debito || 0,
      Crédito: mov.credito || 0,
      'Saldo Posterior': mov.saldo,
      Comentarios: mov.comentarios || '',
      Categoría: mov.categoria_nombre,
      'ID Odoo': mov.id_odoo || '',
      Empresa: mov.nombre_empresa || '',
      País: mov.nombre_pais || '',
      'Nombre Sheet Origen': mov.nombre_sheet_origen || ''
    }))

    const fechaActual = new Date().toISOString().split('T')[0]
    exportarACSV(
      datosExportar,
      `movimientos_southgenetics_${fechaActual}.csv`
    )
  }

  // Exportar movimientos a Excel
  const exportarMovimientosExcel = () => {
    if (movimientosOrdenados.length === 0) {
      alert('No hay movimientos para exportar')
      return
    }

    const datosExportar = movimientosOrdenados.map(mov => ({
      Fecha: mov.fecha_mov,
      Banco: mov.nombre_banco,
      'N° Cuenta': mov.numero_cuenta,
      Divisa: mov.codigo_divisa,
      Concepto: mov.concepto || '',
      Débito: mov.debito || 0,
      Crédito: mov.credito || 0,
      'Saldo Posterior': mov.saldo,
      Comentarios: mov.comentarios || '',
      Categoría: mov.categoria_nombre,
      'ID Odoo': mov.id_odoo || '',
      Empresa: mov.nombre_empresa || '',
      País: mov.nombre_pais || '',
      'Nombre Sheet Origen': mov.nombre_sheet_origen || ''
    }))

    const fechaActual = new Date().toISOString().split('T')[0]
    exportarAExcel(
      datosExportar,
      `movimientos_southgenetics_${fechaActual}.xlsx`,
      'Movimientos'
    )
  }

  // Exportar movimientos a PDF
  const exportarMovimientosPDF = () => {
    if (movimientosOrdenados.length === 0) {
      alert('No hay movimientos para exportar')
      return
    }

    const datosExportar = movimientosOrdenados.map(mov => ({
      Fecha: mov.fecha_mov,
      Banco: mov.nombre_banco,
      'N° Cuenta': mov.numero_cuenta,
      Divisa: mov.codigo_divisa,
      Concepto: mov.concepto || '',
      Débito: mov.debito || 0,
      Crédito: mov.credito || 0,
      'Saldo Posterior': mov.saldo,
      Comentarios: mov.comentarios || '',
      Categoría: mov.categoria_nombre,
      'ID Odoo': mov.id_odoo || '',
      Empresa: mov.nombre_empresa || '',
      País: mov.nombre_pais || '',
      'Nombre Sheet Origen': mov.nombre_sheet_origen || ''
    }))

    const fechaActual = new Date().toISOString().split('T')[0]
    exportarMovimientosAPDF(
      datosExportar,
      `movimientos_southgenetics_${fechaActual}.pdf`
    )
  }

  const limpiarFiltros = () => {
    setBancosSeleccionados(new Set())
    setCategoriasSeleccionadas(new Set())
    setDivisasSeleccionadas(new Set())
    setEmpresasSeleccionadas(new Set())
    setNombresSheetOrigenSeleccionados(new Set())
    setFechaDesde('')
    setFechaHasta('')
    setCuentaIdSeleccionada(null)
  }

  // Funciones para selección de movimientos
  const toggleSeleccionMovimiento = (idMovimiento: number, indiceEnArray?: number, esShiftClick: boolean = false) => {
    setMovimientosSeleccionados(prev => {
      const nuevo = new Set(prev)
      
      // Si es Shift+clic y hay un último índice seleccionado
      if (esShiftClick && ultimoIndiceSeleccionado !== null && indiceEnArray !== undefined) {
        const inicio = Math.min(ultimoIndiceSeleccionado, indiceEnArray)
        const fin = Math.max(ultimoIndiceSeleccionado, indiceEnArray)
        
        // Seleccionar todos los movimientos en el rango
        for (let i = inicio; i <= fin; i++) {
          if (i < movimientosOrdenados.length) {
            nuevo.add(movimientosOrdenados[i].id_movimiento)
          }
        }
        
        // Actualizar el último índice al final del rango seleccionado
        setUltimoIndiceSeleccionado(indiceEnArray)
      } else {
        // Comportamiento normal: toggle individual
        if (nuevo.has(idMovimiento)) {
          nuevo.delete(idMovimiento)
        } else {
          nuevo.add(idMovimiento)
        }
        
        // Actualizar el último índice seleccionado
        if (indiceEnArray !== undefined) {
          setUltimoIndiceSeleccionado(indiceEnArray)
        }
      }
      
      return nuevo
    })
  }

  const seleccionarTodos = () => {
    // Calcular los movimientos de la página actual (igual que movimientosPaginados)
    const inicio = customStartOffset !== null 
      ? customStartOffset - 1 
      : (currentPage - 1) * itemsPerPage
    const fin = customStartOffset !== null
      ? customStartOffset - 1 + itemsPerPage
      : currentPage * itemsPerPage
    
    const movimientosPaginaActual = movimientosOrdenados.slice(inicio, fin)
    
    // Agregar los movimientos de la página actual a la selección existente
    const nuevosSeleccionados = new Set(movimientosSeleccionados)
    movimientosPaginaActual.forEach(mov => {
      nuevosSeleccionados.add(mov.id_movimiento)
    })
    
    setMovimientosSeleccionados(nuevosSeleccionados)
    
    // Establecer el último índice como el último elemento de la página actual
    if (movimientosPaginaActual.length > 0) {
      const ultimoIndice = movimientosOrdenados.findIndex(m => m.id_movimiento === movimientosPaginaActual[movimientosPaginaActual.length - 1].id_movimiento)
      if (ultimoIndice !== -1) {
        setUltimoIndiceSeleccionado(ultimoIndice)
      }
    }
  }
  
  const deseleccionarTodos = () => {
    // Solo deseleccionar los movimientos de la página actual
    const inicio = customStartOffset !== null 
      ? customStartOffset - 1 
      : (currentPage - 1) * itemsPerPage
    const fin = customStartOffset !== null
      ? customStartOffset - 1 + itemsPerPage
      : currentPage * itemsPerPage
    
    const movimientosPaginaActual = movimientosOrdenados.slice(inicio, fin)
    const idsPaginaActual = new Set(movimientosPaginaActual.map(m => m.id_movimiento))
    
    // Remover solo los movimientos de la página actual
    setMovimientosSeleccionados(prev => {
      const nuevo = new Set(prev)
      idsPaginaActual.forEach(id => nuevo.delete(id))
      
      // Limpiar el último índice si ya no hay selecciones después de deseleccionar
      if (nuevo.size === 0) {
        setUltimoIndiceSeleccionado(null)
      }
      
      return nuevo
    })
  }


  const abrirModalEliminar = () => {
    if (movimientosSeleccionados.size === 0) {
      alert('Por favor selecciona al menos un movimiento para eliminar')
      return
    }
    setMostrarModalConfirmacion(true)
  }

  const cerrarModalConfirmacion = () => {
    setMostrarModalConfirmacion(false)
  }

  const cargarCuentasParaCrear = async () => {
    const { data, error } = await supabase
      .from('cuenta')
      .select(`
        id_cuenta,
        numero_cuenta,
        banco_pais_divisa (
          divisa ( codigo_divisa ),
          banco_pais ( banco ( nombre ) )
        )
      `)
      .eq('activo', true)
      .order('numero_cuenta', { ascending: true })
    if (error) {
      console.error('Error al cargar cuentas:', error)
      return
    }
    const opts: CuentaOption[] = (data || []).map((c: any) => {
      const bpd = c.banco_pais_divisa
      const banco = bpd?.banco_pais?.banco?.nombre || ''
      const div = bpd?.divisa?.codigo_divisa || ''
      return { id_cuenta: c.id_cuenta, label: `${banco} - ${c.numero_cuenta} - ${div}` }
    })
    setCuentasLista(opts)
  }

  const abrirModalCrear = async () => {
    setFormCrear({
      fecha_mov: new Date().toISOString().split('T')[0],
      id_cuenta: '',
      id_categoria: '',
      concepto: '',
      comentarios: '',
      debito: '',
      credito: '',
      id_odoo: ''
    })
    await cargarCuentasParaCrear()
    setMostrarModalCrear(true)
  }

  const cerrarModalCrear = () => {
    setMostrarModalCrear(false)
  }

  const crearMovimiento = async () => {
    const { fecha_mov, id_cuenta, id_categoria, concepto, comentarios, debito, credito, id_odoo } = formCrear
    if (!fecha_mov || !id_cuenta || !concepto.trim()) {
      alert('Completa: Fecha, Cuenta y Concepto.')
      return
    }
    const d = parseMonedaInput(debito)
    const c = parseMonedaInput(credito)
    if (d === 0 && c === 0) {
      alert('Indica Débito o Crédito (al menos uno distinto de 0).')
      return
    }
    try {
      setCreando(true)
      const { error } = await supabase
        .from('movimiento')
        .insert({
          fecha_mov,
          id_cuenta: Number(id_cuenta),
          id_categoria: id_categoria ? Number(id_categoria) : null,
          concepto: concepto.trim(),
          comentarios: comentarios.trim() || null,
          debito: d > 0 ? d : null,
          credito: c > 0 ? c : null,
          id_odoo: id_odoo.trim() ? parseInt(id_odoo, 10) || null : null
        })
      if (error) throw error
      cerrarModalCrear()
      await cargarMovimientos()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('movimientos-eliminados'))
        localStorage.setItem('movimientos-eliminados', Date.now().toString())
      }
    } catch (err: any) {
      console.error('Error al crear movimiento:', err)
      alert('Error al crear el movimiento: ' + (err.message || 'Error desconocido'))
    } finally {
      setCreando(false)
    }
  }

  const eliminarMovimientosSeleccionados = async () => {
    if (movimientosSeleccionados.size === 0) return

    try {
      setEliminando(true)
      
      // Convertir Set a Array para la consulta
      const idsAEliminar = Array.from(movimientosSeleccionados)
      
      console.log('🗑️ Eliminando movimientos:', idsAEliminar)

      // Eliminar movimientos de la base de datos
      const { error } = await supabase
        .from('movimiento')
        .delete()
        .in('id_movimiento', idsAEliminar)

      if (error) {
        console.error('❌ Error al eliminar movimientos:', error)
        throw error
      }

      console.log('✅ Movimientos eliminados exitosamente')
      
      // Limpiar selección
      setMovimientosSeleccionados(new Set())
      
      // Cerrar modal
      setMostrarModalConfirmacion(false)
      
      // Recargar movimientos
      await cargarMovimientos()
      
      // Notificar a otras pestañas/componentes que se eliminaron movimientos
      // Esto hará que la tabla principal se recargue automáticamente
      if (typeof window !== 'undefined') {
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('movimientos-eliminados'))
        
        // También usar localStorage para notificar a otras pestañas
        localStorage.setItem('movimientos-eliminados', Date.now().toString())
      }
      
    } catch (err: any) {
      console.error('❌ Error al eliminar movimientos:', err)
      alert('Error al eliminar los movimientos: ' + (err.message || 'Error desconocido'))
    } finally {
      setEliminando(false)
    }
  }

  // Función para manejar el ordenamiento
  const handleOrdenar = (campo: CampoOrdenamiento) => {
    if (campoOrdenamiento === campo) {
      // Si ya está ordenado por este campo, cambiar la dirección
      setDireccionOrdenamiento(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // Si es un campo nuevo, ordenar ascendente por defecto
      setCampoOrdenamiento(campo)
      setDireccionOrdenamiento('asc')
    }
  }

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [bancosSeleccionados, categoriasSeleccionadas, divisasSeleccionadas, empresasSeleccionadas, fechaDesde, fechaHasta, cuentaIdSeleccionada])

  // Ordenar movimientos según el campo y dirección seleccionados
  // Por defecto: ordenar por fecha descendente y luego por id_odoo descendente
  const movimientosOrdenados = useMemo(() => {
    const movimientosCopia = [...movimientos]

    // Si no hay campo de ordenamiento seleccionado, usar ordenamiento por defecto
    if (!campoOrdenamiento) {
      movimientosCopia.sort((a, b) => {
        // Primero ordenar por fecha descendente (más recientes primero)
        const fechaA = new Date(a.fecha_mov).getTime()
        const fechaB = new Date(b.fecha_mov).getTime()
        if (fechaA !== fechaB) {
          return fechaB - fechaA // Descendente: más recientes primero
        }
        // Si las fechas son iguales, ordenar por id_odoo descendente (de mayor a menor)
        // Si no tiene id_odoo, tratarlo como el valor más grande (último movimiento)
        const idOdooA = a.id_odoo ?? Number.MAX_SAFE_INTEGER
        const idOdooB = b.id_odoo ?? Number.MAX_SAFE_INTEGER
        return idOdooB - idOdooA
      })
      return movimientosCopia
    }

    // Si hay campo de ordenamiento seleccionado, usar ese
    movimientosCopia.sort((a, b) => {
      let valorA: any
      let valorB: any

      switch (campoOrdenamiento) {
        case 'fecha':
          valorA = a.fecha_mov
          valorB = b.fecha_mov
          break
        case 'banco':
          valorA = a.nombre_banco || ''
          valorB = b.nombre_banco || ''
          break
        case 'divisa':
          valorA = a.codigo_divisa || ''
          valorB = b.codigo_divisa || ''
          break
        case 'categoria':
          valorA = a.categoria_nombre || ''
          valorB = b.categoria_nombre || ''
          break
        default:
          return 0
      }

      // Comparar valores
      let comparacion = 0
      if (typeof valorA === 'string' && typeof valorB === 'string') {
        comparacion = valorA.localeCompare(valorB)
      } else {
        comparacion = valorA < valorB ? -1 : valorA > valorB ? 1 : 0
      }

      // Aplicar dirección de ordenamiento
      let resultado = direccionOrdenamiento === 'asc' ? comparacion : -comparacion

      // Cuando se ordena por fecha: si las fechas son iguales, desempatar por id_odoo
      // con la misma dirección (fecha asc → id_odoo asc, fecha desc → id_odoo desc)
      // Si no tiene id_odoo, tratarlo como el valor más grande (último movimiento)
      if (campoOrdenamiento === 'fecha' && resultado === 0) {
        const idOdooA = a.id_odoo ?? Number.MAX_SAFE_INTEGER
        const idOdooB = b.id_odoo ?? Number.MAX_SAFE_INTEGER
        resultado = direccionOrdenamiento === 'asc' ? idOdooA - idOdooB : idOdooB - idOdooA
      }

      return resultado
    })

    return movimientosCopia
  }, [movimientos, campoOrdenamiento, direccionOrdenamiento])

  // Estado para offset personalizado (cuando el usuario edita el startIndex)
  const [customStartOffset, setCustomStartOffset] = useState<number | null>(null)

  // Estado para conversión a USD
  const [mostrarEnUSD, setMostrarEnUSD] = useState<boolean>(false)
  const [tasasCambio, setTasasCambio] = useState<Map<string, number>>(new Map())

  // Función para convertir un valor a USD según la divisa
  const convertirAUSD = (valor: number, codigoDivisa: string): number => {
    if (!mostrarEnUSD || codigoDivisa === 'USD') {
      return valor
    }
    
    // Normalizar el código de divisa a mayúsculas para asegurar coincidencia
    const codigoNormalizado = codigoDivisa.toUpperCase().trim()
    const tasa = tasasCambio.get(codigoNormalizado)
    
    if (!tasa || tasa === 0) {
      return valor // Si no hay tasa, devolver el valor original
    }
    
    // Dividir porque unidades_por_usd significa cuántas unidades de la divisa equivalen a 1 USD
    const valorConvertido = valor / tasa
    return valorConvertido
  }

  // Función para formatear moneda con conversión a USD si está activada
  const formatearMonedaConConversion = (valor: number, codigoDivisa: string, simboloOriginal: string, decimalesOriginal: number): string => {
    if (mostrarEnUSD) {
      const valorUSD = convertirAUSD(valor, codigoDivisa)
      return formatearMoneda(valorUSD, 'U$S', 2) // Cambiar símbolo a U$S cuando se muestra en USD
    }
    return formatearMoneda(valor, simboloOriginal, decimalesOriginal)
  }

  // Calcular movimientos paginados
  const movimientosPaginados = useMemo(() => {
    let startIndex: number
    if (customStartOffset !== null) {
      // Si hay un offset personalizado, usarlo directamente
      startIndex = customStartOffset - 1 // -1 porque slice usa índice base 0
    } else {
      // Lógica normal de paginación
      startIndex = (currentPage - 1) * itemsPerPage
    }
    const endIndex = startIndex + itemsPerPage
    return movimientosOrdenados.slice(startIndex, endIndex)
  }, [movimientosOrdenados, currentPage, itemsPerPage, customStartOffset])

  // Calcular total de páginas
  const totalPages = useMemo(() => {
    if (itemsPerPage <= 0) return 1
    return Math.ceil(movimientosOrdenados.length / itemsPerPage)
  }, [movimientosOrdenados.length, itemsPerPage])

  // Ajustar página actual si es necesario (solo si no hay offset personalizado)
  useEffect(() => {
    if (customStartOffset === null && currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages, customStartOffset])

  // Funciones de paginación
  const irAPaginaAnterior = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      // Limpiar offset personalizado cuando se navega con botones
      setCustomStartOffset(null)
    }
  }

  const irAPaginaSiguiente = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
      // Limpiar offset personalizado cuando se navega con botones
      setCustomStartOffset(null)
    }
  }

  const handleItemsPerPageChange = (value: string) => {
    // Solo permitir números
    const numericValue = value.replace(/[^0-9]/g, '')
    setTempItemsPerPage(numericValue)
  }

  const handleItemsPerPageBlur = () => {
    const numValue = parseInt(tempItemsPerPage)
    if (!isNaN(numValue) && numValue > 0) {
      // El valor editado es el endIndex deseado, así que itemsPerPage = numValue - startIndex + 1
      const total = movimientosOrdenados.length
      const currentStartIndex = customStartOffset !== null 
        ? customStartOffset 
        : (currentPage - 1) * itemsPerPage + 1
      const newItemsPerPage = numValue - currentStartIndex + 1
      
      if (newItemsPerPage > 0 && newItemsPerPage <= total) {
        setItemsPerPage(newItemsPerPage)
        // Si hay un offset personalizado, mantenerlo; si no, resetear a página 1
        if (customStartOffset === null) {
          setCurrentPage(1)
        }
      } else if (numValue >= total) {
        // Si el valor es mayor o igual al total, mostrar todas las filas desde el startIndex actual
        const remainingItems = total - currentStartIndex + 1
        if (remainingItems > 0) {
          setItemsPerPage(remainingItems)
        } else {
          setItemsPerPage(total)
          setCustomStartOffset(null)
          setCurrentPage(1)
        }
      } else {
        // Si está vacío o inválido, restaurar el endIndex actual
        const endIndex = customStartOffset !== null
          ? customStartOffset + itemsPerPage - 1
          : Math.min(currentPage * itemsPerPage, total)
        setTempItemsPerPage(endIndex.toString())
      }
    } else {
      // Si está vacío o inválido, restaurar el endIndex actual
      const endIndex = customStartOffset !== null
        ? customStartOffset + itemsPerPage - 1
        : Math.min(currentPage * itemsPerPage, movimientosOrdenados.length)
      setTempItemsPerPage(endIndex.toString())
    }
    setEditingItemsPerPage(false)
  }

  const handleItemsPerPageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleItemsPerPageBlur()
    } else if (e.key === 'Escape') {
      const endIndex = customStartOffset !== null
        ? customStartOffset + itemsPerPage - 1
        : Math.min(currentPage * itemsPerPage, movimientosOrdenados.length)
      setTempItemsPerPage(endIndex.toString())
      setEditingItemsPerPage(false)
    }
  }

  const handleItemsPerPageClick = () => {
    setEditingItemsPerPage(true)
    // Inicializar con el endIndex actual, no itemsPerPage
    const endIndex = customStartOffset !== null
      ? customStartOffset + itemsPerPage - 1
      : Math.min(currentPage * itemsPerPage, movimientosOrdenados.length)
    setTempItemsPerPage(endIndex.toString())
  }

  const handleStartIndexChange = (value: string) => {
    // Solo permitir números
    const numericValue = value.replace(/[^0-9]/g, '')
    setTempStartIndex(numericValue)
  }

  const handleStartIndexBlur = () => {
    const numValue = parseInt(tempStartIndex)
    const total = movimientosOrdenados.length
    if (!isNaN(numValue) && numValue > 0 && numValue <= total) {
      // Cuando el usuario ingresa un número, simplemente establecer ese número como inicio
      // y mantener el itemsPerPage actual para calcular el fin
      setCustomStartOffset(numValue)
      // Mantener itemsPerPage como está (no cambiarlo)
      // Resetear a página 1 ya que estamos usando offset personalizado
      setCurrentPage(1)
    } else {
      // Si está vacío o inválido, restaurar el startIndex actual
      const startIndex = customStartOffset !== null 
        ? customStartOffset 
        : (currentPage - 1) * itemsPerPage + 1
      setTempStartIndex(startIndex.toString())
    }
    setEditingStartIndex(false)
  }

  const handleStartIndexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartIndexBlur()
    } else if (e.key === 'Escape') {
      const startIndex = customStartOffset !== null 
        ? customStartOffset 
        : (currentPage - 1) * itemsPerPage + 1
      setTempStartIndex(startIndex.toString())
      setEditingStartIndex(false)
    }
  }

  const handleStartIndexClick = () => {
    setEditingStartIndex(true)
    const startIndex = customStartOffset !== null 
      ? customStartOffset 
      : (currentPage - 1) * itemsPerPage + 1
    setTempStartIndex(startIndex.toString())
  }

  // Función para obtener el ícono de ordenamiento
  const obtenerIconoOrdenamiento = (campo: CampoOrdenamiento) => {
    if (campoOrdenamiento !== campo) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return direccionOrdenamiento === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />
  }

  if (loading && movimientos.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50">
        <MenuNavegacion />
        <div className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Cargando movimientos...</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50">
        <MenuNavegacion />
        <div className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-red-900 font-semibold mb-1">Error al cargar movimientos</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <MenuNavegacion />
      <div className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Todos los Movimientos
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={abrirModalCrear}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium"
                title="Crear nuevo movimiento"
              >
                <Plus className="h-4 w-4" />
                Crear
              </button>
              {movimientosSeleccionados.size > 0 && (
                <button
                  onClick={abrirModalEliminar}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                  title={`Eliminar ${movimientosSeleccionados.size} movimiento(s) seleccionado(s)`}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar ({movimientosSeleccionados.size})
                </button>
              )}
              <button
                onClick={exportarMovimientosCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                title="Exportar movimientos actuales a CSV"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
              <button
                onClick={exportarMovimientosExcel}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                title="Exportar movimientos actuales a Excel"
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </button>
              <button
                onClick={exportarMovimientosPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                title="Exportar movimientos actuales a PDF"
              >
                <Download className="h-4 w-4" />
                Exportar PDF
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
              >
                <Table2 className="h-4 w-4" />
                Ir a Tabla de Balances
              </Link>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
              <button
                onClick={() => setFiltrosVisibles(!filtrosVisibles)}
                className="ml-2 p-1 hover:bg-gray-100 rounded-md transition-colors"
                title={filtrosVisibles ? 'Ocultar filtros' : 'Mostrar filtros'}
              >
                {filtrosVisibles ? (
                  <ChevronUp className="h-5 w-5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                )}
              </button>
              <div className="ml-auto flex gap-3 items-center">
                {loading && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Aplicando filtros...</span>
                  </div>
                )}
                {(bancosSeleccionados.size > 0 || categoriasSeleccionadas.size > 0 || divisasSeleccionadas.size > 0 || empresasSeleccionadas.size > 0 || nombresSheetOrigenSeleccionados.size > 0 || fechaDesde || fechaHasta) && (
                  <button
                    onClick={limpiarFiltros}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>
            </div>
            
            {/* Indicador de filtros aplicados */}
            {(bancosSeleccionados.size > 0 || categoriasSeleccionadas.size > 0 || divisasSeleccionadas.size > 0 || empresasSeleccionadas.size > 0 || nombresSheetOrigenSeleccionados.size > 0 || fechaDesde || fechaHasta) && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium mb-1">Filtros aplicados:</p>
                <div className="flex flex-wrap gap-2 text-xs text-blue-700">
                  {bancosSeleccionados.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {bancosSeleccionados.size} banco(s)
                    </span>
                  )}
                  {categoriasSeleccionadas.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {categoriasSeleccionadas.size} categoría(s)
                    </span>
                  )}
                  {divisasSeleccionadas.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {Array.from(divisasSeleccionadas).join(', ')}
                    </span>
                  )}
                  {empresasSeleccionadas.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {empresasSeleccionadas.size} empresa(s)
                    </span>
                  )}
                  {nombresSheetOrigenSeleccionados.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {nombresSheetOrigenSeleccionados.size} nombre(s) sheet origen
                    </span>
                  )}
                  {fechaDesde && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      Desde: {new Date(fechaDesde).toLocaleDateString('es-ES')}
                    </span>
                  )}
                  {fechaHasta && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      Hasta: {new Date(fechaHasta).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contenedor de filtros con dropdown */}
            {filtrosVisibles && (
              <div className="space-y-3">
                {/* Filtro de Fechas */}
            <div className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleSeccionFiltro('fechas')}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
              >
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                  <Calendar className="h-3.5 w-3.5" />
                  Rango de Fechas
                </label>
                {seccionesFiltrosAbiertas.fechas ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </button>
              {seccionesFiltrosAbiertas.fechas && (
                <div className="p-2 pt-0">
                  <div className="flex gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Desde:</label>
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="mt-0.5 block w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        style={{ color: '#111827', WebkitTextFillColor: '#111827', opacity: 1 }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Hasta:</label>
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="mt-0.5 block w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        style={{ color: '#111827', WebkitTextFillColor: '#111827', opacity: 1 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Bancos */}
            <div className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleSeccionFiltro('bancos')}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
              >
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                  <Building2 className="h-3.5 w-3.5" />
                  Bancos
                </label>
                {seccionesFiltrosAbiertas.bancos ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </button>
              {seccionesFiltrosAbiertas.bancos && (
                <div className="p-1.5 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-1.5">
                    {bancos.map(banco => (
                      <label
                        key={banco.id_banco}
                        className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={bancosSeleccionados.has(banco.id_banco)}
                          onChange={() => toggleBanco(banco.id_banco)}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{banco.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Categorías */}
            <div className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleSeccionFiltro('categorias')}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
              >
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                  <Tag className="h-3.5 w-3.5" />
                  Categorías
                </label>
                {seccionesFiltrosAbiertas.categorias ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </button>
              {seccionesFiltrosAbiertas.categorias && (
                <div className="p-1.5 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-1.5">
                    {categorias.map(categoria => (
                      <label
                        key={categoria.id_categoria}
                        className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={categoriasSeleccionadas.has(categoria.id_categoria)}
                          onChange={() => toggleCategoria(categoria.id_categoria)}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{categoria.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Divisas */}
            <div className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleSeccionFiltro('divisas')}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
              >
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                  <DollarSign className="h-3.5 w-3.5" />
                  Divisas
                </label>
                {seccionesFiltrosAbiertas.divisas ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </button>
              {seccionesFiltrosAbiertas.divisas && (
                <div className="p-1.5 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">
                    {divisas.map(divisa => (
                      <label
                        key={divisa.codigo_divisa}
                        className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={divisasSeleccionadas.has(divisa.codigo_divisa)}
                          onChange={() => toggleDivisa(divisa.codigo_divisa)}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-gray-700">{divisa.codigo_divisa}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Empresas */}
            <div className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleSeccionFiltro('empresas')}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
              >
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                  <Briefcase className="h-3.5 w-3.5" />
                  Empresas
                </label>
                {seccionesFiltrosAbiertas.empresas ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </button>
              {seccionesFiltrosAbiertas.empresas && (
                <div className="p-1.5 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 border border-gray-200 rounded-md p-1.5">
                    {empresas.map(empresa => (
                      <label
                        key={empresa.id_empresa}
                        className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={empresasSeleccionadas.has(empresa.id_empresa)}
                          onChange={() => toggleEmpresa(empresa.id_empresa)}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{empresa.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Nombres Sheet Origen */}
            <div className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleSeccionFiltro('nombresSheetOrigen')}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
              >
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                  <Table2 className="h-3.5 w-3.5" />
                  Nombre Sheet Origen
                </label>
                {seccionesFiltrosAbiertas.nombresSheetOrigen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </button>
              {seccionesFiltrosAbiertas.nombresSheetOrigen && (
                <div className="p-1.5 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 border border-gray-200 rounded-md p-1.5">
                    {nombresSheetOrigen.map(nombreSheet => (
                      <label
                        key={nombreSheet}
                        className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={nombresSheetOrigenSeleccionados.has(nombreSheet)}
                          onChange={() => toggleNombreSheetOrigen(nombreSheet)}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{nombreSheet}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Controles de Columnas Visibles */}
            <div className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleSeccionFiltro('columnasVisibles')}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
              >
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                  <Table2 className="h-3.5 w-3.5" />
                  Columnas Visibles
                </label>
                {seccionesFiltrosAbiertas.columnasVisibles ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </button>
              {seccionesFiltrosAbiertas.columnasVisibles && (
                <div className="p-1.5 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 border border-gray-200 rounded-md p-1.5">
                    <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.fecha}
                    onChange={() => toggleColumna('fecha')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Fecha</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.banco}
                    onChange={() => toggleColumna('banco')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Banco</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.numeroCuenta}
                    onChange={() => toggleColumna('numeroCuenta')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">N° Cuenta</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.divisa}
                    onChange={() => toggleColumna('divisa')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Divisa</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.concepto}
                    onChange={() => toggleColumna('concepto')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Concepto</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.debito}
                    onChange={() => toggleColumna('debito')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Débito</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.credito}
                    onChange={() => toggleColumna('credito')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Crédito</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.saldoPosterior}
                    onChange={() => toggleColumna('saldoPosterior')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Saldo Posterior</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.comentario}
                    onChange={() => toggleColumna('comentario')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Comentario</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.categoria}
                    onChange={() => toggleColumna('categoria')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Categoría</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.idOdoo}
                    onChange={() => toggleColumna('idOdoo')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">ID Odoo</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.empresa}
                    onChange={() => toggleColumna('empresa')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Empresa</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.pais}
                    onChange={() => toggleColumna('pais')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">País</span>
                </label>
                <label className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.nombreSheetOrigen}
                    onChange={() => toggleColumna('nombreSheetOrigen')}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                  />
                    <span className="text-xs text-gray-700">Nombre Sheet Origen</span>
                  </label>
                  </div>
                </div>
              )}
            </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de movimientos */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden relative">
          {/* Indicador de carga cuando se están aplicando filtros */}
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-gray-700 font-medium">Aplicando filtros...</p>
              </div>
            </div>
          )}
          {/* Paginación */}
          {movimientosOrdenados.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Botón Mostrar en USD */}
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
                  
                  {/* Botones Seleccionar/Deseleccionar Todo */}
                  {movimientosOrdenados.length > 0 && (() => {
                    // Calcular los movimientos de la página actual
                    const inicio = customStartOffset !== null 
                      ? customStartOffset - 1 
                      : (currentPage - 1) * itemsPerPage
                    const fin = customStartOffset !== null
                      ? customStartOffset - 1 + itemsPerPage
                      : currentPage * itemsPerPage
                    const movimientosPaginaActual = movimientosOrdenados.slice(inicio, fin)
                    const todosSeleccionadosEnPagina = movimientosPaginaActual.length > 0 && 
                      movimientosPaginaActual.every(m => movimientosSeleccionados.has(m.id_movimiento))
                    
                    return (
                      <>
                        {!todosSeleccionadosEnPagina ? (
                          <button
                            onClick={seleccionarTodos}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                            title={`Seleccionar todos los movimientos de esta página (${movimientosPaginaActual.length})`}
                          >
                            <CheckSquare className="h-4 w-4" />
                            Seleccionar Todo ({movimientosPaginaActual.length})
                          </button>
                        ) : (
                          <button
                            onClick={deseleccionarTodos}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
                            title={`Deseleccionar todos los movimientos de esta página (${movimientosPaginaActual.length})`}
                          >
                            <Square className="h-4 w-4" />
                            Deseleccionar Todo ({movimientosPaginaActual.length})
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
                {/* Índice de paginación */}
                <div className="flex items-center gap-2">
                <span className="text-sm text-black">
                  {(() => {
                    const startIndex = customStartOffset !== null 
                      ? customStartOffset 
                      : (currentPage - 1) * itemsPerPage + 1
                    const endIndex = customStartOffset !== null
                      ? Math.min(customStartOffset + itemsPerPage - 1, movimientosOrdenados.length)
                      : Math.min(currentPage * itemsPerPage, movimientosOrdenados.length)
                    const total = movimientosOrdenados.length
                    return (
                      <>
                        {editingStartIndex ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={tempStartIndex}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '')
                              if (value === '' || parseInt(value) > 0) {
                                handleStartIndexChange(value)
                              }
                            }}
                            onBlur={handleStartIndexBlur}
                            onKeyDown={handleStartIndexKeyDown}
                            className="inline-block w-auto px-0 py-0 text-sm border-0 border-b border-gray-400 focus:outline-none focus:border-gray-600 text-black bg-transparent text-center"
                            autoFocus
                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', minWidth: '2ch', maxWidth: '4ch' }}
                          />
                        ) : (
                          <span
                            onClick={handleStartIndexClick}
                            className="cursor-pointer text-black hover:underline border-b border-transparent hover:border-gray-400"
                            title="Click para editar"
                          >
                            {startIndex}
                          </span>
                        )}
                        -
                        {editingItemsPerPage ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={tempItemsPerPage}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '')
                              if (value === '' || parseInt(value) > 0) {
                                handleItemsPerPageChange(value)
                              }
                            }}
                            onBlur={handleItemsPerPageBlur}
                            onKeyDown={handleItemsPerPageKeyDown}
                            className="inline-block w-auto px-0 py-0 text-sm border-0 border-b border-gray-400 focus:outline-none focus:border-gray-600 text-black bg-transparent text-center"
                            autoFocus
                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', minWidth: '2ch', maxWidth: '4ch' }}
                          />
                        ) : (
                          <span
                            onClick={handleItemsPerPageClick}
                            className="cursor-pointer text-black hover:underline border-b border-transparent hover:border-gray-400"
                            title="Click para editar"
                          >
                            {endIndex}
                          </span>
                        )}
                        {' '}/ <span className="text-black">{total}</span>
                      </>
                    )
                  })()}
                </span>
                <button
                  onClick={irAPaginaAnterior}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded border transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Página anterior"
                >
                  &lt;
                </button>
                <button
                  onClick={irAPaginaSiguiente}
                  disabled={currentPage >= totalPages}
                  className={`px-3 py-1.5 rounded border transition-colors ${
                    currentPage >= totalPages
                      ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Página siguiente"
                >
                  &gt;
                </button>
                </div>
              </div>
            </div>
          )}
          
        {movimientos.length === 0 ? (
            <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-yellow-900 font-semibold mb-1">Sin movimientos</h3>
                <p className="text-yellow-700 text-sm">
                      No se encontraron movimientos con los filtros seleccionados.
                </p>
                  </div>
              </div>
            </div>
          </div>
        ) : (
            <div 
              className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]" 
              style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  height: 20px;
                  width: 12px;
                  -webkit-appearance: none;
                }
                div::-webkit-scrollbar-track {
                  background: #f1f5f9;
                  border-radius: 10px;
                }
                div::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 10px;
                  border: 2px solid #f1f5f9;
                }
                div::-webkit-scrollbar-thumb:hover {
                  background: #94a3b8;
                }
                /* Forzar visibilidad de scrollbar en Firefox */
                div {
                  scrollbar-width: thin;
                  scrollbar-color: #cbd5e1 #f1f5f9;
                }
              `}</style>
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-16 sticky left-0 bg-gray-100 z-20 border-r-2 border-gray-300">
                      #
                    </th>
                    <th className="px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={movimientosPaginados.length > 0 && movimientosPaginados.every(m => movimientosSeleccionados.has(m.id_movimiento))}
                        onChange={() => {
                          if (movimientosPaginados.every(m => movimientosSeleccionados.has(m.id_movimiento))) {
                            // Deseleccionar todos los de la página actual
                            const nuevosSeleccionados = new Set(movimientosSeleccionados)
                            movimientosPaginados.forEach(m => nuevosSeleccionados.delete(m.id_movimiento))
                            setMovimientosSeleccionados(nuevosSeleccionados)
                          } else {
                            // Seleccionar todos los de la página actual
                            const nuevosSeleccionados = new Set(movimientosSeleccionados)
                            movimientosPaginados.forEach(m => nuevosSeleccionados.add(m.id_movimiento))
                            setMovimientosSeleccionados(nuevosSeleccionados)
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        title="Seleccionar todos los de esta página"
                      />
                    </th>
                    {columnasVisibles.fecha && (
                      <th 
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => handleOrdenar('fecha')}
                      >
                        <div className="flex items-center gap-2">
                          Fecha
                          {obtenerIconoOrdenamiento('fecha')}
                        </div>
                      </th>
                    )}
                    {columnasVisibles.banco && (
                      <th 
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => handleOrdenar('banco')}
                      >
                        <div className="flex items-center gap-2">
                          Banco
                          {obtenerIconoOrdenamiento('banco')}
                        </div>
                      </th>
                    )}
                    {columnasVisibles.numeroCuenta && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Cuenta</th>
                    )}
                    {columnasVisibles.divisa && (
                      <th 
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => handleOrdenar('divisa')}
                      >
                        <div className="flex items-center gap-2">
                          Divisa
                          {obtenerIconoOrdenamiento('divisa')}
                        </div>
                      </th>
                    )}
                    {columnasVisibles.concepto && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Concepto</th>
                    )}
                    {columnasVisibles.debito && (
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Débito</th>
                    )}
                    {columnasVisibles.credito && (
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Crédito</th>
                    )}
                    {columnasVisibles.saldoPosterior && (
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Saldo Posterior</th>
                    )}
                    {columnasVisibles.comentario && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comentario</th>
                    )}
                    {columnasVisibles.categoria && (
                      <th 
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => handleOrdenar('categoria')}
                      >
                        <div className="flex items-center gap-2">
                          Categoría
                          {obtenerIconoOrdenamiento('categoria')}
                        </div>
                      </th>
                    )}
                    {columnasVisibles.idOdoo && (
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">ID Odoo</th>
                    )}
                    {columnasVisibles.empresa && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Empresa</th>
                    )}
                    {columnasVisibles.pais && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">País</th>
                    )}
                    {columnasVisibles.nombreSheetOrigen && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nombre Sheet Origen</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {movimientosPaginados.map((mov, idx) => {
                    const startIndex = customStartOffset !== null 
                      ? customStartOffset 
                      : (currentPage - 1) * itemsPerPage + 1
                    const numeroFila = startIndex + idx
                    // Encontrar el índice real en movimientosOrdenados
                    const indiceReal = movimientosOrdenados.findIndex(m => m.id_movimiento === mov.id_movimiento)
                    
                    return (
                      <tr
                        key={mov.id_movimiento}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${movimientosSeleccionados.has(mov.id_movimiento) ? 'bg-blue-50' : ''} cursor-pointer hover:bg-blue-100 transition-colors`}
                        onClick={(e) => {
                          // Solo manejar clic en la fila si no es en el checkbox o en un input
                          const target = e.target as HTMLElement
                          if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON' && !target.closest('input')) {
                            const esShiftClick = e.shiftKey
                            toggleSeleccionMovimiento(mov.id_movimiento, indiceReal, esShiftClick)
                          }
                        }}
                      >
                        <td className={`px-4 py-2 text-center text-sm text-gray-700 sticky left-0 z-10 border-r-2 border-gray-300 ${idx % 2 === 0 ? (movimientosSeleccionados.has(mov.id_movimiento) ? 'bg-blue-50' : 'bg-white') : (movimientosSeleccionados.has(mov.id_movimiento) ? 'bg-blue-50' : 'bg-gray-50')}`}>
                          {numeroFila}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={movimientosSeleccionados.has(mov.id_movimiento)}
                            onChange={() => {
                              // onChange se ejecuta después del click, así que usamos el estado del evento
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              const esShiftClick = e.shiftKey
                              // Si el checkbox está marcado, desmarcarlo; si no, marcarlo
                              const estabaSeleccionado = movimientosSeleccionados.has(mov.id_movimiento)
                              if (!esShiftClick) {
                                // Comportamiento normal: toggle
                                toggleSeleccionMovimiento(mov.id_movimiento, indiceReal, false)
                              } else {
                                // Shift+clic: seleccionar rango
                                toggleSeleccionMovimiento(mov.id_movimiento, indiceReal, true)
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      {columnasVisibles.fecha && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {new Date(mov.fecha_mov + 'T00:00:00').toLocaleDateString('es-ES')}
                        </td>
                      )}
                      {columnasVisibles.banco && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {mov.nombre_banco}
                        </td>
                      )}
                      {columnasVisibles.numeroCuenta && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {mov.numero_cuenta}
                        </td>
                      )}
                      {columnasVisibles.divisa && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {mov.codigo_divisa}
                        </td>
                      )}
                      {columnasVisibles.concepto && (
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {mov.concepto}
                        </td>
                      )}
                      {columnasVisibles.debito && (
                        <td className="px-4 py-2 text-sm text-right text-red-600 whitespace-nowrap">
                          {mov.debito !== null ? `-${formatearMonedaConConversion(mov.debito, mov.codigo_divisa, mov.simbolo_divisa, mov.decimales_divisa)}` : '-'}
                        </td>
                      )}
                      {columnasVisibles.credito && (
                        <td className="px-4 py-2 text-sm text-right text-green-600 whitespace-nowrap">
                          {mov.credito !== null ? formatearMonedaConConversion(mov.credito, mov.codigo_divisa, mov.simbolo_divisa, mov.decimales_divisa) : '-'}
                        </td>
                      )}
                      {columnasVisibles.saldoPosterior && (
                        <td className="px-4 py-2 text-sm text-right text-gray-900 font-semibold whitespace-nowrap">
                          {formatearMonedaConConversion(mov.saldo, mov.codigo_divisa, mov.simbolo_divisa, mov.decimales_divisa)}
                        </td>
                      )}
                      {columnasVisibles.comentario && (
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {mov.comentarios || ''}
                        </td>
                      )}
                      {columnasVisibles.categoria && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {mov.categoria_nombre}
                        </td>
                      )}
                      {columnasVisibles.idOdoo && (
                        <td className="px-4 py-2 text-sm text-center text-gray-700">
                          {mov.id_odoo || '-'}
                        </td>
                      )}
                      {columnasVisibles.empresa && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {mov.nombre_empresa || '-'}
                        </td>
                      )}
                      {columnasVisibles.pais && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {mov.nombre_pais || '-'}
                        </td>
                      )}
                      {columnasVisibles.nombreSheetOrigen && (
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {mov.nombre_sheet_origen || '-'}
                        </td>
                      )}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
          </div>
        )}
        </div>

        {/* Gráfica circular de categorías */}
        {movimientos.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Distribución de Movimientos por Categoría
          </h2>
            <GraficaCategorias movimientos={movimientos} />
          </div>
          )}
        </div>

      {/* Modal de confirmación de eliminación */}
      {mostrarModalConfirmacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Confirmar Eliminación</h3>
                <button
                  onClick={cerrarModalConfirmacion}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={eliminando}
                >
                  <X className="h-5 w-5" />
                </button>
      </div>
              
              <div className="mb-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-700 mb-2">
                      ¿Estás seguro de que deseas eliminar <strong>{movimientosSeleccionados.size}</strong> movimiento(s) seleccionado(s)?
                    </p>
                    <p className="text-sm text-red-600 font-semibold">
                      Esta acción eliminará permanentemente los movimientos de la base de datos y no se puede deshacer.
                    </p>
            </div>
          </div>
        </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={cerrarModalConfirmacion}
                  disabled={eliminando}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={eliminarMovimientosSeleccionados}
                  disabled={eliminando}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {eliminando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear movimiento */}
      {mostrarModalCrear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Crear movimiento</h3>
                <button
                  onClick={cerrarModalCrear}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={creando}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                    <input
                      type="date"
                      value={formCrear.fecha_mov}
                      onChange={e => setFormCrear(f => ({ ...f, fecha_mov: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta *</label>
                    <select
                      value={formCrear.id_cuenta}
                      onChange={e => setFormCrear(f => ({ ...f, id_cuenta: e.target.value ? Number(e.target.value) : '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    >
                      <option value="">Seleccione cuenta</option>
                      {cuentasLista.map(c => (
                        <option key={c.id_cuenta} value={c.id_cuenta}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={formCrear.id_categoria}
                    onChange={e => setFormCrear(f => ({ ...f, id_categoria: e.target.value ? Number(e.target.value) : '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map(cat => (
                      <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
                  <input
                    type="text"
                    value={formCrear.concepto}
                    onChange={e => setFormCrear(f => ({ ...f, concepto: e.target.value }))}
                    placeholder="Descripción del movimiento"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
                  <textarea
                    value={formCrear.comentarios}
                    onChange={e => setFormCrear(f => ({ ...f, comentarios: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Débito</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formCrear.debito}
                      onChange={e => setFormCrear(f => ({ ...f, debito: formatMonedaInput(e.target.value) }))}
                      placeholder="0 o 0,00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Crédito</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formCrear.credito}
                      onChange={e => setFormCrear(f => ({ ...f, credito: formatMonedaInput(e.target.value) }))}
                      placeholder="0 o 0,00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Odoo</label>
                    <input
                      type="text"
                      value={formCrear.id_odoo}
                      onChange={e => setFormCrear(f => ({ ...f, id_odoo: e.target.value }))}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={cerrarModalCrear}
                  disabled={creando}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearMovimiento}
                  disabled={creando}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {creando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Crear movimiento
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
  )
}
