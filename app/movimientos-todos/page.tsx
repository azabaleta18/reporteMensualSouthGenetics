'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertCircle, Filter, Calendar, Building2, Tag, DollarSign, Table2, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, Briefcase, Download } from 'lucide-react'
import { formatearMoneda } from '@/lib/formato-moneda'
import { exportarACSV } from '@/lib/exportar-csv'
import { exportarAExcel } from '@/lib/exportar-excel'
import { exportarMovimientosAPDF } from '@/lib/exportar-pdf-movimientos'
import Link from 'next/link'
import GraficaCategorias from '@/components/GraficaCategorias'

interface Movimiento {
  id_movimiento: number
  fecha_mov: string
  concepto: string
  comentarios: string | null
  debito: number | null
  credito: number | null
  saldo_posterior: number
  id_odoo: number | null
  numero_cuenta: string
  nombre_banco: string
  categoria_nombre: string
  codigo_divisa: string
  simbolo_divisa: string
  decimales_divisa: number
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

export default function MovimientosTodosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(false) // Cambiar a false inicialmente
  const [error, setError] = useState<string | null>(null)
  
  // Datos para filtros
  const [bancos, setBancos] = useState<Banco[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [divisas, setDivisas] = useState<Divisa[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  
  // Filtros activos (se aplican automáticamente)
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Set<number>>(new Set())
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<Set<number>>(new Set())
  const [divisasSeleccionadas, setDivisasSeleccionadas] = useState<Set<string>>(new Set())
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<Set<number>>(new Set())
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [cuentaIdSeleccionada, setCuentaIdSeleccionada] = useState<number | null>(null)

  // Ordenamiento
  type CampoOrdenamiento = 'fecha' | 'banco' | 'divisa' | 'categoria' | null
  const [campoOrdenamiento, setCampoOrdenamiento] = useState<CampoOrdenamiento>('fecha')
  const [direccionOrdenamiento, setDireccionOrdenamiento] = useState<'asc' | 'desc'>('asc')
  
  // Estado para mostrar/ocultar filtros
  const [filtrosVisibles, setFiltrosVisibles] = useState<boolean>(false)

  const cargarMovimientos = useCallback(async (
    filtrosBancos: Set<number> = bancosSeleccionados,
    filtrosCategorias: Set<number> = categoriasSeleccionadas,
    filtrosDivisas: Set<string> = divisasSeleccionadas,
    filtrosEmpresas: Set<number> = empresasSeleccionadas,
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
            saldo_posterior,
            id_odoo,
            id_categoria,
            cuenta (
              id_cuenta,
              id_empresa,
              numero_cuenta,
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
                  )
                )
              )
            ),
            categoria_movimiento (
              nombre
            )
          `)

        // Aplicar filtros
        if (filtroCuentaId) {
          query = query.eq('id_cuenta', filtroCuentaId)
          console.log(`   🏦 Filtrando por cuenta ID: ${filtroCuentaId}`)
        }

        if (filtrosCategorias.size > 0) {
          query = query.in('id_categoria', Array.from(filtrosCategorias))
          console.log(`   🏷️ Filtrando por categorías: ${Array.from(filtrosCategorias).join(', ')}`)
        }

        if (filtroFechaDesde) {
          query = query.gte('fecha_mov', filtroFechaDesde)
          console.log(`   📅 Filtrando desde fecha: ${filtroFechaDesde}`)
        }

        if (filtroFechaHasta) {
          query = query.lte('fecha_mov', filtroFechaHasta)
          console.log(`   📅 Filtrando hasta fecha: ${filtroFechaHasta}`)
        }

        const { data: movimientosPagina, error: errorMovimientos } = await query
          .order('fecha_mov', { ascending: true })
          .order('id_odoo', { ascending: true })
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
          
          // Si hay filtroCuentaId, verificar que coincida
          if (filtroCuentaId && cuenta.id_cuenta !== filtroCuentaId) {
            return false
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

          return true
        })
        .map(m => {
          const cuenta = m.cuenta as any
          const bancoPaisDivisa = cuenta?.banco_pais_divisa
          const banco = bancoPaisDivisa?.banco_pais?.banco
          const divisa = bancoPaisDivisa?.divisa
          const categoria = m.categoria_movimiento as any

          return {
            id_movimiento: m.id_movimiento,
            fecha_mov: m.fecha_mov,
            concepto: m.concepto || '',
            comentarios: m.comentarios || null,
            debito: m.debito,
            credito: m.credito,
            saldo_posterior: m.saldo_posterior,
            id_odoo: m.id_odoo,
            numero_cuenta: cuenta?.numero_cuenta || '',
            nombre_banco: banco?.nombre || '',
            categoria_nombre: categoria?.nombre || 'Sin categoría',
            codigo_divisa: divisa?.codigo_divisa || '',
            simbolo_divisa: divisa?.simbolo || '$',
            decimales_divisa: divisa?.decimales || 2
          }
        })

      console.log('✅ Movimientos filtrados:', movimientosFiltrados.length)
      setMovimientos(movimientosFiltrados)

    } catch (err: any) {
      console.error('❌ Error al cargar movimientos:', err)
      setError(err.message || 'Error al cargar los movimientos')
    } finally {
      setLoading(false)
    }
  }, [bancosSeleccionados, categoriasSeleccionadas, divisasSeleccionadas, empresasSeleccionadas, fechaDesde, fechaHasta, cuentaIdSeleccionada])

  // Leer parámetros de la URL al cargar la página
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      
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
              // Buscar la cuenta en Supabase para obtener el banco
              const { data: cuentaData, error: errorCuenta } = await supabase
                .from('cuenta')
                .select(`
                  id_cuenta,
                  banco_pais_divisa (
                    banco_pais (
                      banco (
                        id_banco
                      )
                    )
                  )
                `)
                .eq('id_cuenta', cuentaId)
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
        })
      }
    }
  }, [])

  useEffect(() => {
    // Solo cargar datos de filtros si no hay parámetros en la URL
    // (si hay parámetros, ya se cargarán en el otro useEffect)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tieneParametros = params.get('fechaDesde') || params.get('fechaHasta') || params.get('cuentaId') || params.get('bancoId') || params.get('categorias') || params.get('codigoDivisa')
      
      if (!tieneParametros) {
        cargarDatosFiltros()
      }
    }
  }, [])

  // Aplicar filtros automáticamente cuando cambian
  useEffect(() => {
    // Cargar movimientos si:
    // 1. Ya se cargaron los datos de filtros (bancos, categorias, divisas, empresas), O
    // 2. Hay filtros de fecha, cuentaId o divisa activos (vienen de URL)
    const tieneDatosFiltros = bancos.length > 0 || categorias.length > 0 || divisas.length > 0 || empresas.length > 0
    const tieneFiltrosActivos = fechaDesde || fechaHasta || cuentaIdSeleccionada || divisasSeleccionadas.size > 0
    
    console.log('🔍 useEffect - Verificando si cargar movimientos:', {
      tieneDatosFiltros,
      tieneFiltrosActivos,
      fechaDesde,
      fechaHasta,
      cuentaIdSeleccionada,
      divisasSeleccionadas: Array.from(divisasSeleccionadas),
      bancosLength: bancos.length,
      categoriasLength: categorias.length,
      divisasLength: divisas.length,
      empresasLength: empresas.length
    })
    
    // Si hay filtros activos, cargar movimientos incluso si los datos de filtros aún no están listos
    // (esto es importante cuando se viene desde la URL con parámetros)
    if (tieneFiltrosActivos || tieneDatosFiltros) {
      console.log('✅ Ejecutando cargarMovimientos()')
      cargarMovimientos()
    } else {
      console.log('⏸️ No se ejecuta cargarMovimientos() - esperando datos de filtros o filtros activos')
    }
  }, [bancosSeleccionados, categoriasSeleccionadas, divisasSeleccionadas, empresasSeleccionadas, fechaDesde, fechaHasta, cuentaIdSeleccionada, cargarMovimientos, bancos.length, categorias.length, divisas.length, empresas.length])

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
      Categoría: mov.categoria_nombre,
      Concepto: mov.concepto || '',
      Comentarios: mov.comentarios || '',
      Débito: mov.debito || 0,
      Crédito: mov.credito || 0,
      'Saldo Posterior': mov.saldo_posterior,
      'ID Odoo': mov.id_odoo || ''
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
      Categoría: mov.categoria_nombre,
      Concepto: mov.concepto || '',
      Comentarios: mov.comentarios || '',
      Débito: mov.debito || 0,
      Crédito: mov.credito || 0,
      'Saldo Posterior': mov.saldo_posterior,
      'ID Odoo': mov.id_odoo || ''
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
      Categoría: mov.categoria_nombre,
      Concepto: mov.concepto || '',
      Comentarios: mov.comentarios || '',
      Débito: mov.debito || 0,
      Crédito: mov.credito || 0,
      'Saldo Posterior': mov.saldo_posterior,
      'ID Odoo': mov.id_odoo || ''
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
    setFechaDesde('')
    setFechaHasta('')
    setCuentaIdSeleccionada(null)
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

  // Ordenar movimientos según el campo y dirección seleccionados
  const movimientosOrdenados = useMemo(() => {
    if (!campoOrdenamiento) return movimientos

    const movimientosCopia = [...movimientos]

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
      return direccionOrdenamiento === 'asc' ? comparacion : -comparacion
    })

    return movimientosCopia
  }, [movimientos, campoOrdenamiento, direccionOrdenamiento])

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
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
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
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Todos los Movimientos
            </h1>
            <div className="flex items-center gap-3">
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
                {(bancosSeleccionados.size > 0 || categoriasSeleccionadas.size > 0 || divisasSeleccionadas.size > 0 || empresasSeleccionadas.size > 0 || fechaDesde || fechaHasta) && (
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
            {(bancosSeleccionados.size > 0 || categoriasSeleccionadas.size > 0 || divisasSeleccionadas.size > 0 || empresasSeleccionadas.size > 0 || fechaDesde || fechaHasta) && (
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
              <div className="space-y-4">
                {/* Filtro de Fechas */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                Rango de Fechas
              </label>
              <div className="flex gap-4">
                <div>
                  <label className="text-xs text-gray-600">Desde:</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827', opacity: 1 }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Hasta:</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827', opacity: 1 }}
                  />
                </div>
              </div>
            </div>

            {/* Filtro de Bancos */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4" />
                Bancos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                {bancos.map(banco => (
                  <label
                    key={banco.id_banco}
                    className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={bancosSeleccionados.has(banco.id_banco)}
                      onChange={() => toggleBanco(banco.id_banco)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{banco.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro de Categorías */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4" />
                Categorías
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                {categorias.map(categoria => (
                  <label
                    key={categoria.id_categoria}
                    className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={categoriasSeleccionadas.has(categoria.id_categoria)}
                      onChange={() => toggleCategoria(categoria.id_categoria)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{categoria.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro de Divisas */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4" />
                Divisas
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {divisas.map(divisa => (
                  <label
                    key={divisa.codigo_divisa}
                    className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={divisasSeleccionadas.has(divisa.codigo_divisa)}
                      onChange={() => toggleDivisa(divisa.codigo_divisa)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{divisa.codigo_divisa}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro de Empresas */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4" />
                Empresas
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                {empresas.map(empresa => (
                  <label
                    key={empresa.id_empresa}
                    className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={empresasSeleccionadas.has(empresa.id_empresa)}
                      onChange={() => toggleEmpresa(empresa.id_empresa)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{empresa.nombre}</span>
                  </label>
                ))}
              </div>
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
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Total movimientos:</strong> {movimientos.length}
            </p>
          </div>
          
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
              className="overflow-auto max-h-[calc(100vh-300px)]" 
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
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleOrdenar('fecha')}
                    >
                      <div className="flex items-center gap-2">
                        Fecha
                        {obtenerIconoOrdenamiento('fecha')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleOrdenar('banco')}
                    >
                      <div className="flex items-center gap-2">
                        Banco
                        {obtenerIconoOrdenamiento('banco')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Cuenta</th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleOrdenar('divisa')}
                    >
                      <div className="flex items-center gap-2">
                        Divisa
                        {obtenerIconoOrdenamiento('divisa')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => handleOrdenar('categoria')}
                    >
                      <div className="flex items-center gap-2">
                        Categoría
                        {obtenerIconoOrdenamiento('categoria')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Concepto</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comentario</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Débito</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Crédito</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Saldo Posterior</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">ID Odoo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosOrdenados.map((mov, idx) => (
                    <tr
                      key={mov.id_movimiento}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {new Date(mov.fecha_mov + 'T00:00:00').toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {mov.nombre_banco}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {mov.numero_cuenta}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {mov.codigo_divisa}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {mov.categoria_nombre}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {mov.concepto}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {mov.comentarios || ''}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-red-600 whitespace-nowrap">
                        {mov.debito !== null ? formatearMoneda(mov.debito, mov.simbolo_divisa, mov.decimales_divisa) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-green-600 whitespace-nowrap">
                        {mov.credito !== null ? formatearMoneda(mov.credito, mov.simbolo_divisa, mov.decimales_divisa) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 font-semibold whitespace-nowrap">
                        {formatearMoneda(mov.saldo_posterior, mov.simbolo_divisa, mov.decimales_divisa)}
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-700">
                        {mov.id_odoo || '-'}
                      </td>
                    </tr>
                  ))}
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
    </main>
  )
}

