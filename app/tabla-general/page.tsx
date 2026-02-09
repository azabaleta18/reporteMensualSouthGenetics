'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { LogOut, Loader2, ChevronDown, ChevronRight, ChevronUp, AlertCircle, Filter, Calendar, Building2, Tag, DollarSign, ChevronsDown, ChevronsUp, Briefcase, Table2, Globe } from 'lucide-react'
import MenuNavegacion from '@/components/MenuNavegacion'
import { formatearMoneda } from '@/lib/formato-moneda'
import { obtenerTasasCambioUltimaFecha } from '@/lib/divisas'

interface Movimiento {
  id_movimiento: number
  fecha_mov: string
  concepto: string
  comentarios: string | null
  debito: number | null
  credito: number | null
  id_cuenta: number
  id_empresa: number | null
  id_odoo: number | null
  id_categoria: number
  categoria_nombre: string
  codigo_divisa: string
  nombre_banco: string
  nombre_sheet_origen: string | null
  nombre_pais: string | null
  simbolo_divisa: string
  decimales_divisa: number
  id_banco: number
}

interface Categoria {
  id_categoria: number
  nombre: string
  descripcion: string | null
}

interface ColumnaTabla {
  divisa: string
  banco: string
  fecha: string
  key: string // "divisa|banco|fecha"
}

interface Banco {
  id_banco: number
  nombre: string
}

interface Divisa {
  codigo_divisa: string
  nombre: string
  simbolo: string
  decimales: number
}

export default function TablaGeneral() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [movimientosFiltrados, setMovimientosFiltrados] = useState<Movimiento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [divisas, setDivisas] = useState<Divisa[]>([])
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<number>>(new Set())
  const [divisasExpandidas, setDivisasExpandidas] = useState<Set<string>>(new Set())
  const [bancosExpandidos, setBancosExpandidos] = useState<Set<string>>(new Set()) // "divisa|banco"
  const [anosExpandidos, setAnosExpandidos] = useState<Set<string>>(new Set()) // "divisa|banco|año"
  const [mesesExpandidos, setMesesExpandidos] = useState<Set<string>>(new Set()) // "divisa|banco|año|mes"
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  
  // Estado para paginación de movimientos individuales
  const [itemsPerPageMovimientos, setItemsPerPageMovimientos] = useState<number>(100)
  const [currentPageMovimientos, setCurrentPageMovimientos] = useState<number>(1)
  const [editingItemsPerPageMovimientos, setEditingItemsPerPageMovimientos] = useState<boolean>(false)
  const [tempItemsPerPageMovimientos, setTempItemsPerPageMovimientos] = useState<string>('100')
  const [editingStartIndexMovimientos, setEditingStartIndexMovimientos] = useState<boolean>(false)
  const [tempStartIndexMovimientos, setTempStartIndexMovimientos] = useState<string>('1')
  const [customStartOffsetMovimientos, setCustomStartOffsetMovimientos] = useState<number | null>(null)
  
  // Filtros
  const [filtrosVisibles, setFiltrosVisibles] = useState<boolean>(false)
  // Por defecto: filtrar solo movimientos de 2026
  const [fechaDesde, setFechaDesde] = useState<string>('2026-01-01')
  const [fechaHasta, setFechaHasta] = useState<string>('2026-12-31')
  const [divisasSeleccionadas, setDivisasSeleccionadas] = useState<Set<string>>(new Set())
  const [bancosSheetSeleccionados, setBancosSheetSeleccionados] = useState<Set<string>>(new Set()) // nombre_sheet_origen o nombre_banco
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Set<number>>(new Set()) // Por id_banco
  const [paisesSeleccionados, setPaisesSeleccionados] = useState<Set<string>>(new Set())
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<Set<number>>(new Set())
  const [empresas, setEmpresas] = useState<Array<{ id_empresa: number; nombre: string }>>([])
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<Set<number>>(new Set())
  const [bancosSheet, setBancosSheet] = useState<string[]>([]) // nombre_sheet_origen o nombre_banco
  const [paises, setPaises] = useState<string[]>([])
  
  // Estado para controlar qué secciones de filtros están abiertas
  const [seccionesFiltrosAbiertas, setSeccionesFiltrosAbiertas] = useState({
    fechas: true,
    bancosSheet: true,
    bancos: true,
    pais: true,
    categorias: true,
    divisas: true,
    empresas: true
  })

  const toggleSeccionFiltro = (seccion: keyof typeof seccionesFiltrosAbiertas) => {
    setSeccionesFiltrosAbiertas(prev => ({
      ...prev,
      [seccion]: !prev[seccion]
    }))
  }
  
  // Estado para conversión a USD
  const [mostrarEnUSD, setMostrarEnUSD] = useState<boolean>(false)
  const [tasasCambio, setTasasCambio] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session) {
        setUser(session.user)
      } else {
        setUser(null)
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (user && movimientos.length === 0 && categorias.length === 0) {
      cargarDatos()
    }
  }, [user])

  // Cargar tasas de cambio según la última fecha visible
  useEffect(() => {
    const cargarTasasCambio = async () => {
      try {
        const tasas = await obtenerTasasCambioUltimaFecha(fechaDesde, fechaHasta)
        setTasasCambio(tasas)
        console.log('✅ Tasas de cambio cargadas:', tasas)
        console.log('📊 Tasas disponibles:', Array.from(tasas.entries()))
        console.log('🔍 Verificando tasas específicas:')
        console.log('  - EUR:', tasas.get('EUR'))
        console.log('  - MXN:', tasas.get('MXN'))
        console.log('  - UYU:', tasas.get('UYU'))
        console.log('  - ARS:', tasas.get('ARS'))
        console.log('  - CLP:', tasas.get('CLP'))
        console.log('  - COP:', tasas.get('COP'))
      } catch (error) {
        console.error('Error al cargar tasas de cambio:', error)
      }
    }
    
    if (user) {
      cargarTasasCambio()
    }
  }, [user, fechaDesde, fechaHasta])

  const checkAuth = async () => {
    try {
      const { user: currentUser } = await getSession()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)
    } catch (error) {
      console.error('Error al verificar autenticación:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const cargarDatos = async () => {
    try {
      setLoading(true)
      console.log('🔍 Iniciando carga de datos...')
      
      // Cargar categorías
      console.log('📋 Cargando categorías...')
      const { data: categoriasData, error: errorCategorias } = await supabase
        .from('categoria_movimiento')
        .select('id_categoria, nombre, descripcion')
        .order('nombre', { ascending: true })

      if (errorCategorias) {
        console.error('❌ Error al cargar categorías:', errorCategorias)
      } else {
        console.log(`✅ Cargadas ${categoriasData?.length || 0} categorías:`, categoriasData)
        // Excluir categorías eliminadas: GENERAL, POR DEFECTO, TRANSFERENCIA
        const categoriasExcluidas = ['general', 'por defecto', 'transferencia']
        const categoriasFiltradas = categoriasData?.filter(c => 
          !categoriasExcluidas.includes(c.nombre.toLowerCase())
        ) || []
        
        // Ordenar categorías: Pendientes anteúltima (penúltima)
        // Primero separar Pendientes del resto
        const pendientes = categoriasFiltradas.find(c => c.nombre.toLowerCase() === 'pendientes')
        const otrasCategorias = categoriasFiltradas.filter(c => c.nombre.toLowerCase() !== 'pendientes') || []
        
        // Ordenar las otras categorías alfabéticamente
        const otrasOrdenadas = otrasCategorias.sort((a, b) => 
          a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
        )
        
        // Si hay Pendientes y hay al menos una otra categoría, poner Pendientes en la anteúltima posición
        let categoriasOrdenadas: Categoria[]
        if (pendientes && otrasOrdenadas.length > 0) {
          // Insertar Pendientes en la anteúltima posición
          const posicionAnteultima = otrasOrdenadas.length
          otrasOrdenadas.splice(posicionAnteultima, 0, pendientes)
          categoriasOrdenadas = otrasOrdenadas
        } else if (pendientes) {
          // Si solo hay Pendientes, ponerla al final
          categoriasOrdenadas = [pendientes]
        } else {
          // Si no hay Pendientes, usar las otras ordenadas
          categoriasOrdenadas = otrasOrdenadas
        }
        
        setCategorias(categoriasOrdenadas)
      }

      // Cargar todos los movimientos
      console.log('💾 Cargando movimientos...')
      let todosLosMovimientos: any[] = []
      let desde = 0
      const tamañoPagina = 1000
      let hayMasDatos = true
      let paginaNum = 1

      while (hayMasDatos) {
        console.log(`📄 Cargando página ${paginaNum} (desde ${desde} hasta ${desde + tamañoPagina - 1})...`)
        
        const { data: movimientosPagina, error: errorMovimientos } = await supabase
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
              activo,
              nombre_sheet_origen,
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
              id_categoria,
              nombre
            )
          `)
          .eq('cuenta.activo', true)
          .order('fecha_mov', { ascending: true })
          .order('id_odoo', { ascending: true })
          .range(desde, desde + tamañoPagina - 1)

        if (errorMovimientos) {
          console.error('❌ Error al cargar movimientos:', errorMovimientos)
          console.error('   Detalles del error:', JSON.stringify(errorMovimientos, null, 2))
          break
        }
        
        console.log(`   📊 Página ${paginaNum}: ${movimientosPagina?.length || 0} movimientos cargados`)
        if (movimientosPagina && movimientosPagina.length > 0) {
          console.log(`   📝 Primer movimiento de ejemplo:`, {
            id_movimiento: movimientosPagina[0].id_movimiento,
            fecha_mov: movimientosPagina[0].fecha_mov,
            tiene_cuenta: !!movimientosPagina[0].cuenta,
            tiene_categoria: !!(movimientosPagina[0] as any).categoria_movimiento
          })
        }

        if (movimientosPagina && movimientosPagina.length > 0) {
          console.log(`   🔄 Mapeando ${movimientosPagina.length} movimientos...`)
          let movimientosMapeadosConError = 0
          
          const movimientosMapeados = movimientosPagina.map((m: any, idx: number) => {
            try {
              const cuenta = m.cuenta as any
              const bancoPaisDivisa = cuenta?.banco_pais_divisa
              const divisa = bancoPaisDivisa?.divisa
              const bancoPais = bancoPaisDivisa?.banco_pais
              const banco = bancoPais?.banco
              const categoria = m.categoria_movimiento as any

              // Usar nombre_sheet_origen si está disponible, sino usar nombre del banco
              const nombreBanco = cuenta?.nombre_sheet_origen || banco?.nombre || ''

              // DEBUG: Verificar si este es el movimiento problemático (id_odoo=61335)
              if (m.id_odoo === 61335) {
                console.log(`   🔍 DEBUG: Movimiento id_odoo=61335 encontrado:`, {
                  id_movimiento: m.id_movimiento,
                  fecha_mov: m.fecha_mov,
                  id_categoria: m.id_categoria,
                  tiene_cuenta: !!cuenta,
                  cuenta_activo: cuenta?.activo,
                  tiene_banco_pais_divisa: !!bancoPaisDivisa,
                  tiene_divisa: !!divisa,
                  codigo_divisa: divisa?.codigo_divisa,
                  tiene_banco: !!banco,
                  nombre_banco: banco?.nombre,
                  nombre_sheet_origen: cuenta?.nombre_sheet_origen,
                  tiene_categoria: !!categoria,
                  categoria_nombre: categoria?.nombre,
                  debito: m.debito,
                  credito: m.credito
                })
              }

              if (idx === 0) {
                console.log(`   🔍 Estructura del primer movimiento:`, {
                  tiene_cuenta: !!cuenta,
                  tiene_banco_pais_divisa: !!bancoPaisDivisa,
                  tiene_divisa: !!divisa,
                  tiene_banco: !!banco,
                  tiene_categoria: !!categoria,
                  nombreBanco,
                  codigo_divisa: divisa?.codigo_divisa,
                  categoria_nombre: categoria?.nombre
                })
              }

              return {
                id_movimiento: m.id_movimiento,
                fecha_mov: m.fecha_mov,
                concepto: m.concepto || '',
                comentarios: m.comentarios || null,
                debito: m.debito,
                credito: m.credito,
                id_cuenta: cuenta?.id_cuenta || 0,
                id_empresa: cuenta?.id_empresa || null,
                id_odoo: m.id_odoo,
                id_categoria: m.id_categoria || 0,
                categoria_nombre: categoria?.nombre || 'Sin categoría',
                codigo_divisa: divisa?.codigo_divisa || '',
                nombre_banco: nombreBanco,
                nombre_sheet_origen: cuenta?.nombre_sheet_origen || null,
                simbolo_divisa: divisa?.simbolo || '$',
                decimales_divisa: divisa?.decimales || 2,
                id_banco: banco?.id_banco || 0,
              }
            } catch (err: any) {
              movimientosMapeadosConError++
              // DEBUG: Si es el movimiento problemático, mostrar más detalles del error
              if (m.id_odoo === 61335) {
                console.error(`   ⚠️ ERROR al mapear movimiento id_odoo=61335 (id_movimiento=${m.id_movimiento}):`, err)
                console.error(`   ⚠️ Datos del movimiento antes del error:`, {
                  id_movimiento: m.id_movimiento,
                  fecha_mov: m.fecha_mov,
                  id_categoria: m.id_categoria,
                  tiene_cuenta: !!m.cuenta,
                  cuenta: m.cuenta
                })
              } else {
                console.error(`   ⚠️ Error al mapear movimiento ${m.id_movimiento}:`, err)
              }
              return null
            }
          }).filter((m): m is Movimiento => m !== null)

          if (movimientosMapeadosConError > 0) {
            console.warn(`   ⚠️ ${movimientosMapeadosConError} movimientos tuvieron errores al mapear`)
          }

          todosLosMovimientos = [...todosLosMovimientos, ...movimientosMapeados]
          console.log(`   ✅ ${movimientosMapeados.length} movimientos mapeados correctamente`)
          
          if (movimientosPagina.length < tamañoPagina) {
            hayMasDatos = false
            console.log(`   🏁 Última página alcanzada`)
          } else {
            desde += tamañoPagina
            paginaNum++
          }
        } else {
          console.log(`   ℹ️ No hay más movimientos (página vacía)`)
          hayMasDatos = false
        }
      }

      console.log(`✅ Total de movimientos cargados: ${todosLosMovimientos.length}`)
      
      // DEBUG: Verificar si el movimiento problemático está en los movimientos cargados
      const movimiento61335 = todosLosMovimientos.find(m => m.id_odoo === 61335)
      if (movimiento61335) {
        console.log(`   ✅ DEBUG: Movimiento id_odoo=61335 encontrado en movimientos cargados:`, {
          id_movimiento: movimiento61335.id_movimiento,
          fecha_mov: movimiento61335.fecha_mov,
          id_categoria: movimiento61335.id_categoria,
          categoria_nombre: movimiento61335.categoria_nombre,
          codigo_divisa: movimiento61335.codigo_divisa,
          nombre_banco: movimiento61335.nombre_banco,
          nombre_sheet_origen: movimiento61335.nombre_sheet_origen,
          debito: movimiento61335.debito,
          credito: movimiento61335.credito
        })
      } else {
        console.warn(`   ⚠️ DEBUG: Movimiento id_odoo=61335 NO encontrado en movimientos cargados`)
      }
      
      if (todosLosMovimientos.length > 0) {
        console.log(`📊 Resumen de movimientos:`, {
          divisas: Array.from(new Set(todosLosMovimientos.map(m => m.codigo_divisa))),
          bancos: Array.from(new Set(todosLosMovimientos.map(m => m.nombre_banco))),
          categorias: Array.from(new Set(todosLosMovimientos.map(m => m.categoria_nombre))),
          fechas: {
            primera: todosLosMovimientos[0]?.fecha_mov,
            ultima: todosLosMovimientos[todosLosMovimientos.length - 1]?.fecha_mov
          }
        })
        
        // Cargar bancos que tienen al menos una cuenta activa
        const { data: cuentasBancosData, error: errorCuentasBancos } = await supabase
          .from('cuenta')
          .select(`
            banco_pais_divisa (
              banco_pais (
                banco (
                  id_banco,
                  nombre
                )
              )
            )
          `)
          .eq('activo', true)

        if (errorCuentasBancos) {
          console.error('Error al cargar bancos desde cuentas:', errorCuentasBancos)
        } else if (cuentasBancosData) {
          const bancosMap = new Map<number, { id_banco: number; nombre: string }>()
          cuentasBancosData.forEach(c => {
            const banco = (c.banco_pais_divisa as any)?.banco_pais?.banco
            if (banco && banco.id_banco && banco.nombre) {
              bancosMap.set(banco.id_banco, { id_banco: banco.id_banco, nombre: banco.nombre })
            }
          })
          const bancosUnicos = Array.from(bancosMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
          setBancos(bancosUnicos)
        }
        
        // Crear lista de bancos/sheets (nombre_sheet_origen o nombre_banco)
        const bancosSheetUnicos = Array.from(new Set(
          todosLosMovimientos.map(m => m.nombre_sheet_origen || m.nombre_banco).filter(Boolean)
        )).sort()
        setBancosSheet(bancosSheetUnicos)
        
        // Cargar países que tienen al menos una cuenta activa
        const { data: cuentasPaisesData, error: errorCuentasPaises } = await supabase
          .from('cuenta')
          .select(`
            banco_pais_divisa (
              banco_pais (
                pais (
                  nombre
                )
              )
            )
          `)
          .eq('activo', true)

        if (errorCuentasPaises) {
          console.error('Error al cargar países desde cuentas:', errorCuentasPaises)
        } else if (cuentasPaisesData) {
          const paisesUnicos = new Set<string>()
          cuentasPaisesData.forEach(c => {
            const nombrePais = (c.banco_pais_divisa as any)?.banco_pais?.pais?.nombre
            if (nombrePais) paisesUnicos.add(nombrePais)
          })
          setPaises(Array.from(paisesUnicos).sort())
        }
        
        // Crear lista de divisas únicas basada en los movimientos
        const divisasMap = new Map<string, { nombre: string; simbolo: string; decimales: number }>()
        todosLosMovimientos.forEach(mov => {
          if (mov.codigo_divisa && !divisasMap.has(mov.codigo_divisa)) {
            divisasMap.set(mov.codigo_divisa, {
              nombre: mov.codigo_divisa, // Usar código como nombre por defecto
              simbolo: mov.simbolo_divisa || '$',
              decimales: mov.decimales_divisa || 2
            })
          }
        })
        
        // Convertir a formato Divisa para el filtro
        const divisasParaFiltro: Divisa[] = Array.from(divisasMap.entries())
          .map(([codigo, datos]) => ({
            codigo_divisa: codigo,
            nombre: datos.nombre,
            simbolo: datos.simbolo,
            decimales: datos.decimales
          }))
          .sort((a, b) => a.codigo_divisa.localeCompare(b.codigo_divisa))
        
        setDivisas(divisasParaFiltro)
        
        // Cargar empresas que tienen al menos un banco activo
        console.log('🏢 Cargando empresas con bancos activos...')
        const empresasUnicas = Array.from(new Set(
          todosLosMovimientos.map(m => m.id_empresa).filter((id): id is number => id !== null && id !== undefined)
        ))
        
        if (empresasUnicas.length > 0) {
          const { data: empresasData, error: errorEmpresas } = await supabase
            .from('empresa')
            .select('id_empresa, nombre')
            .in('id_empresa', empresasUnicas)
            .order('nombre', { ascending: true })
          
          if (errorEmpresas) {
            console.error('❌ Error al cargar empresas:', errorEmpresas)
          } else if (empresasData) {
            console.log(`✅ Cargadas ${empresasData.length} empresas con bancos activos`)
            setEmpresas(empresasData)
          }
        } else {
          console.log('ℹ️ No se encontraron empresas con bancos activos')
          setEmpresas([])
        }
      }
      
      setMovimientos(todosLosMovimientos)
      
      if (todosLosMovimientos.length === 0) {
        console.warn('⚠️ No se encontraron movimientos en la base de datos')
        setError('No se encontraron movimientos en la base de datos')
      } else {
        setError(null)
      }
    } catch (err: any) {
      console.error('Error al cargar datos:', err)
      setError(`Error al cargar datos: ${err.message || 'Error desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtros a los movimientos
  useEffect(() => {
    let movimientosFilt = [...movimientos]
    
    // Filtrar por fechas
    if (fechaDesde) {
      const fechaDesdeDate = parsearFechaLocal(fechaDesde)
      fechaDesdeDate.setHours(0, 0, 0, 0)
      movimientosFilt = movimientosFilt.filter(mov => {
        const fechaMov = parsearFechaLocal(mov.fecha_mov)
        fechaMov.setHours(0, 0, 0, 0)
        return fechaMov.getTime() >= fechaDesdeDate.getTime()
      })
    }
    
    if (fechaHasta) {
      const fechaHastaDate = parsearFechaLocal(fechaHasta)
      fechaHastaDate.setHours(23, 59, 59, 999)
      movimientosFilt = movimientosFilt.filter(mov => {
        const fechaMov = parsearFechaLocal(mov.fecha_mov)
        fechaMov.setHours(0, 0, 0, 0)
        return fechaMov.getTime() <= fechaHastaDate.getTime()
      })
    }
    
    // Filtrar por divisas
    if (divisasSeleccionadas.size > 0) {
      movimientosFilt = movimientosFilt.filter(mov => 
        divisasSeleccionadas.has(mov.codigo_divisa)
      )
    }
    
    // Filtrar por bancos/sheets (nombre_sheet_origen o nombre_banco)
    if (bancosSheetSeleccionados.size > 0) {
      movimientosFilt = movimientosFilt.filter(mov => {
        const nombreBancoSheet = mov.nombre_sheet_origen || mov.nombre_banco
        return nombreBancoSheet && bancosSheetSeleccionados.has(nombreBancoSheet)
      })
    }
    
    // Filtrar por bancos (id_banco)
    if (bancosSeleccionados.size > 0) {
      movimientosFilt = movimientosFilt.filter(mov => {
        return mov.id_banco && bancosSeleccionados.has(mov.id_banco)
      })
    }
    
    // Filtrar por país
    if (paisesSeleccionados.size > 0) {
      movimientosFilt = movimientosFilt.filter(mov => {
        const nombrePais = mov.nombre_pais
        return nombrePais && paisesSeleccionados.has(nombrePais)
      })
    }
    
    // Filtrar por categorías
    if (categoriasSeleccionadas.size > 0) {
      movimientosFilt = movimientosFilt.filter(mov => 
        categoriasSeleccionadas.has(mov.id_categoria)
      )
    }
    
    // Filtrar por empresas
    if (empresasSeleccionadas.size > 0) {
      movimientosFilt = movimientosFilt.filter(mov => 
        mov.id_empresa !== null && mov.id_empresa !== undefined && empresasSeleccionadas.has(mov.id_empresa)
      )
    }
    
    setMovimientosFiltrados(movimientosFilt)
  }, [movimientos, fechaDesde, fechaHasta, divisasSeleccionadas, bancosSheetSeleccionados, bancosSeleccionados, paisesSeleccionados, categoriasSeleccionadas, empresasSeleccionadas])

  // Usar movimientosFiltrados solo para determinar qué mostrar (columnas, filas)
  // PERO los cálculos de saldo siempre usan TODOS los movimientos (sin filtrar)
  const movimientosParaCalcular = movimientosFiltrados.length > 0 || 
    (fechaDesde || fechaHasta || divisasSeleccionadas.size > 0 || bancosSeleccionados.size > 0 || categoriasSeleccionadas.size > 0)
    ? movimientosFiltrados 
    : movimientos

  // Generar estructura de columnas: Divisa > Banco > Fecha
  const columnas = useMemo(() => {
    const columnasMap = new Map<string, ColumnaTabla>()
    
    movimientosParaCalcular.forEach(mov => {
      const key = `${mov.codigo_divisa}|${mov.nombre_banco}|${mov.fecha_mov}`
      if (!columnasMap.has(key)) {
        columnasMap.set(key, {
          divisa: mov.codigo_divisa,
          banco: mov.nombre_banco,
          fecha: mov.fecha_mov,
          key,
        })
      }
    })

    // Ordenar columnas: primero por divisa, luego por banco, luego por fecha
    return Array.from(columnasMap.values()).sort((a, b) => {
      if (a.divisa !== b.divisa) {
        return a.divisa.localeCompare(b.divisa)
      }
      if (a.banco !== b.banco) {
        return a.banco.localeCompare(b.banco)
      }
      return a.fecha.localeCompare(b.fecha)
    })
  }, [movimientosParaCalcular])

  // Función helper para normalizar código de divisa
  const normalizarCodigoDivisa = (codigo: string | null | undefined): string => {
    if (!codigo) return ''
    return codigo.toUpperCase().trim()
  }

  // Obtener divisas únicas (mantener formato original para comparaciones)
  const divisasUnicas = useMemo(() => {
    const divisas = Array.from(new Set(movimientosParaCalcular.map(m => m.codigo_divisa))).sort()
    console.log('🔍 Divisas únicas encontradas:', divisas)
    return divisas
  }, [movimientosParaCalcular])

  // Obtener bancos por divisa
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  const bancosPorDivisa = useMemo(() => {
    const mapa = new Map<string, string[]>()
    movimientosParaCalcular.forEach(mov => {
      // Usar nombre_sheet_origen si está disponible, sino usar nombre_banco
      const nombreBanco = mov.nombre_sheet_origen || mov.nombre_banco
      if (!mapa.has(mov.codigo_divisa)) {
        mapa.set(mov.codigo_divisa, [])
      }
      const bancos = mapa.get(mov.codigo_divisa)!
      if (!bancos.includes(nombreBanco)) {
        bancos.push(nombreBanco)
      }
    })
    // Ordenar bancos dentro de cada divisa
    mapa.forEach((bancos, divisa) => {
      bancos.sort()
    })
    return mapa
  }, [movimientosParaCalcular])

  // Obtener años por banco y divisa
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // Función auxiliar para parsear fechas sin problemas de zona horaria
  const parsearFechaLocal = (fechaString: string): Date => {
    // Parsear la fecha como YYYY-MM-DD directamente sin conversión de zona horaria
    const partes = fechaString.split('T')[0].split('-')
    const año = parseInt(partes[0], 10)
    const mes = parseInt(partes[1], 10) - 1 // Mes es 0-indexed en Date
    const dia = parseInt(partes[2], 10)
    return new Date(año, mes, dia, 12, 0, 0, 0) // Usar mediodía para evitar problemas de zona horaria
  }

  // Función auxiliar para normalizar fecha a YYYY-MM-DD
  const normalizarFecha = (fechaString: string): string => {
    return fechaString.split('T')[0]
  }

  const anosPorBancoDivisa = useMemo(() => {
    const mapa = new Map<string, number[]>() // "divisa|banco" -> años[]
    movimientosParaCalcular.forEach(mov => {
      const nombreBanco = mov.nombre_sheet_origen || mov.nombre_banco
      const key = `${mov.codigo_divisa}|${nombreBanco}`
      const fecha = parsearFechaLocal(mov.fecha_mov)
      const año = fecha.getFullYear()
      if (!mapa.has(key)) {
        mapa.set(key, [])
      }
      const años = mapa.get(key)!
      if (!años.includes(año)) {
        años.push(año)
      }
    })
    // Ordenar años dentro de cada banco
    mapa.forEach((años, key) => {
      años.sort((a, b) => b - a) // Descendente (más reciente primero)
    })
    return mapa
  }, [movimientosParaCalcular])

  // Obtener meses por año, banco y divisa
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  const mesesPorAnoBancoDivisa = useMemo(() => {
    const mapa = new Map<string, number[]>() // "divisa|banco|año" -> meses[]
    movimientosParaCalcular.forEach(mov => {
      const nombreBanco = mov.nombre_sheet_origen || mov.nombre_banco
      const key = `${mov.codigo_divisa}|${nombreBanco}`
      const fecha = parsearFechaLocal(mov.fecha_mov)
      const año = fecha.getFullYear()
      const mes = fecha.getMonth() + 1 // 1-12
      const keyAno = `${key}|${año}`
      if (!mapa.has(keyAno)) {
        mapa.set(keyAno, [])
      }
      const meses = mapa.get(keyAno)!
      if (!meses.includes(mes)) {
        meses.push(mes)
      }
    })
    // Ordenar meses dentro de cada año
    mapa.forEach((meses, key) => {
      meses.sort((a, b) => b - a) // Descendente (más reciente primero)
    })
    return mapa
  }, [movimientosParaCalcular])

  // Obtener fechas por mes, año, banco y divisa
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  const fechasPorMesAnoBancoDivisa = useMemo(() => {
    const mapa = new Map<string, string[]>() // "divisa|banco|año|mes" -> fechas[]
    // IMPORTANTE: Usar TODOS los movimientos (no solo los filtrados) para construir las fechas
    // Esto asegura que cuando se expande un mes, se muestren todas las fechas disponibles
    movimientos.forEach(mov => {
      const nombreBanco = mov.nombre_sheet_origen || mov.nombre_banco
      const fecha = parsearFechaLocal(mov.fecha_mov)
      const año = fecha.getFullYear()
      const mes = fecha.getMonth() + 1
      const key = `${mov.codigo_divisa}|${nombreBanco}|${año}|${mes}`
      if (!mapa.has(key)) {
        mapa.set(key, [])
      }
      const fechas = mapa.get(key)!
      // Usar solo la parte de la fecha (YYYY-MM-DD) para evitar problemas de zona horaria
      const fechaString = normalizarFecha(mov.fecha_mov)
      if (!fechas.includes(fechaString)) {
        fechas.push(fechaString)
      }
    })
    // Ordenar fechas dentro de cada mes
    mapa.forEach((fechas, key) => {
      fechas.sort((a, b) => {
        const fechaA = parsearFechaLocal(a)
        const fechaB = parsearFechaLocal(b)
        return fechaB.getTime() - fechaA.getTime() // Descendente
      })
    })
    return mapa
  }, [movimientos])

  // Agrupar movimientos por categoría (para determinar qué mostrar)
  const movimientosPorCategoria = useMemo(() => {
    const mapa = new Map<number, Movimiento[]>()
    
    movimientosParaCalcular.forEach(mov => {
      const categoriaId = mov.id_categoria || 0
      if (!mapa.has(categoriaId)) {
        mapa.set(categoriaId, [])
      }
      mapa.get(categoriaId)!.push(mov)
    })

    return mapa
  }, [movimientosParaCalcular])

  // Agrupar TODOS los movimientos por categoría (sin filtrar) para cálculos de saldo
  // Los saldos siempre se calculan usando todos los movimientos del banco
  const movimientosPorCategoriaTotal = useMemo(() => {
    const mapa = new Map<number, Movimiento[]>()
    
    movimientos.forEach(mov => {
      const categoriaId = mov.id_categoria || 0
      if (!mapa.has(categoriaId)) {
        mapa.set(categoriaId, [])
      }
      mapa.get(categoriaId)!.push(mov)
    })

    return mapa
  }, [movimientos])

  // Función para obtener la cantidad de movimientos de una categoría según los filtros aplicados
  const obtenerCantidadMovimientosCategoria = (categoriaId: number): number => {
    const movsCategoria = movimientosFiltrados.filter(m => (m.id_categoria || 0) === categoriaId)
    return movsCategoria.length
  }

  // Mapa de nombre_banco -> id_banco para navegación
  const mapaBancoId = useMemo(() => {
    const mapa = new Map<string, number>()
    movimientos.forEach(mov => {
      const nombreBanco = mov.nombre_sheet_origen || mov.nombre_banco
      if (nombreBanco && mov.id_banco && !mapa.has(nombreBanco)) {
        mapa.set(nombreBanco, mov.id_banco)
      }
    })
    return mapa
  }, [movimientos])

  // Función para navegar a la página de movimientos con filtros
  const navegarAMovimientos = (
    fecha?: string,
    bancoNombre?: string,
    categoriaId?: number,
    divisa?: string,
    movimientoId?: number
  ) => {
    const params = new URLSearchParams()
    
    if (fecha) {
      params.set('fechaDesde', fecha)
      params.set('fechaHasta', fecha)
    }
    
    if (bancoNombre) {
      const bancoId = mapaBancoId.get(bancoNombre)
      if (bancoId) {
        params.set('bancoId', bancoId.toString())
      }
    }
    
    if (categoriaId) {
      params.set('categorias', categoriaId.toString())
    }
    
    if (divisa) {
      params.set('codigoDivisa', divisa)
    }
    
    if (movimientoId) {
      params.set('cuentaId', movimientoId.toString())
    }
    
    router.push(`/movimientos?${params.toString()}`)
  }

  // Calcular saldo por categoría, divisa, banco y fecha
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularSaldo = (categoriaId: number, divisa: string, banco: string, fecha: string): number => {
    const movsCategoria = movimientosPorCategoriaTotal.get(categoriaId) || []
    const fechaNormalizada = normalizarFecha(fecha)
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movsCategoria
      .filter(m => {
        const fechaMovNormalizada = normalizarFecha(m.fecha_mov)
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada || fechaMovNormalizada !== fechaNormalizada) return false
        // Usar nombre_sheet_origen si está disponible, sino usar nombre_banco
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        return nombreBancoMov === banco
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo total por categoría y divisa (suma neta de movimientos del período filtrado)
  // Si hay filtros de fecha, usar movimientos filtrados; sino usar todos
  const calcularSaldoPorDivisa = (categoriaId: number, divisa: string): number => {
    // Usar movimientos filtrados si hay filtros activos, sino usar todos
    const movimientosAUsar = (fechaDesde || fechaHasta) ? movimientosFiltrados : movimientos
    const movsCategoria = movimientosAUsar.filter(m => (m.id_categoria || 0) === categoriaId)
    // Normalizar divisa para comparación (case-insensitive)
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movsCategoria
      .filter(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo total por categoría, divisa y banco (suma neta de movimientos del período filtrado)
  // Si hay filtros de fecha, usar movimientos filtrados; sino usar todos
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  const calcularSaldoPorBanco = (categoriaId: number, divisa: string, banco: string): number => {
    // Usar movimientos filtrados si hay filtros activos, sino usar todos
    const movimientosAUsar = (fechaDesde || fechaHasta) ? movimientosFiltrados : movimientos
    const movsCategoria = movimientosAUsar.filter(m => (m.id_categoria || 0) === categoriaId)
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movsCategoria
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        return nombreBancoMov === banco
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo total por categoría, divisa, banco y año
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularSaldoPorAno = (categoriaId: number, divisa: string, banco: string, año: number): number => {
    const movsCategoria = movimientosPorCategoriaTotal.get(categoriaId) || []
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movsCategoria
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fecha = parsearFechaLocal(m.fecha_mov)
        return fecha.getFullYear() === año
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo total por categoría, divisa, banco, año y mes
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularSaldoPorMes = (categoriaId: number, divisa: string, banco: string, año: number, mes: number): number => {
    const movsCategoria = movimientosPorCategoriaTotal.get(categoriaId) || []
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movsCategoria
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fecha = parsearFechaLocal(m.fecha_mov)
        return fecha.getFullYear() === año && fecha.getMonth() + 1 === mes
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo inicial de una categoría (suma de todos los movimientos anteriores a la primera fecha)
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularSaldoInicial = (categoriaId: number, divisa: string, banco: string, primeraFecha: string): number => {
    const movsCategoria = movimientosPorCategoriaTotal.get(categoriaId) || []
    const primeraFechaDate = parsearFechaLocal(primeraFecha)
    primeraFechaDate.setHours(0, 0, 0, 0)
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    
    return movsCategoria
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fechaMov = parsearFechaLocal(m.fecha_mov)
        fechaMov.setHours(0, 0, 0, 0)
        return fechaMov < primeraFechaDate
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular el saldo neto de un día específico (suma de movimientos de ese día solamente)
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularSaldoAlFinalDelDia = (categoriaId: number, divisa: string, banco: string, fecha: string): number => {
    const movsCategoria = movimientosPorCategoriaTotal.get(categoriaId) || []
    const fechaDate = parsearFechaLocal(fecha)
    fechaDate.setHours(0, 0, 0, 0)
    const fechaFin = new Date(fechaDate)
    fechaFin.setHours(23, 59, 59, 999)
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    
    return movsCategoria
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fechaMov = parsearFechaLocal(m.fecha_mov)
        fechaMov.setHours(0, 0, 0, 0)
        // Solo incluir movimientos de ese día específico
        return fechaMov.getTime() === fechaDate.getTime()
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo inicial de un día específico (saldo al final del día anterior)
  const calcularSaldoInicialDelDia = (categoriaId: number, divisa: string, banco: string, fecha: string, todasLasFechas: string[]): number => {
    // Ordenar fechas
    const fechasOrdenadas = [...todasLasFechas].sort((a, b) => {
      const fechaA = parsearFechaLocal(a)
      const fechaB = parsearFechaLocal(b)
      return fechaA.getTime() - fechaB.getTime()
    })
    const indiceFecha = fechasOrdenadas.indexOf(fecha)
    
    // Si es la primera fecha, usar el saldo acumulado antes de esa fecha
    if (indiceFecha === 0) {
      return calcularSaldoInicial(categoriaId, divisa, banco, fecha)
    }
    
    // Si no es la primera fecha, el saldo inicial es el saldo al final del día anterior
    const fechaAnterior = fechasOrdenadas[indiceFecha - 1]
    return calcularSaldoAlFinalDelDia(categoriaId, divisa, banco, fechaAnterior)
  }

  // Funciones para calcular totales SIN filtrar por categoría
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularTotalPorDivisa = (divisa: string): number => {
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movimientos
      .filter(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularTotalPorBanco = (divisa: string, banco: string): number => {
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movimientos
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        return nombreBancoMov === banco
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo final total del banco (saldo acumulado hasta la fecha más reciente)
  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  const calcularSaldoFinalTotalBanco = (divisa: string, banco: string): number => {
    // IMPORTANTE: Usar TODOS los movimientos (no solo los filtrados) para encontrar la fecha más reciente
    // Esto asegura que el saldo final coincida con la tabla de saldos diarios
    const movimientosBanco = movimientos.filter(m => {
      if (m.codigo_divisa !== divisa) return false
      const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
      return nombreBancoMov === banco
    })
    
    if (movimientosBanco.length === 0) return 0
    
    // Encontrar la fecha más reciente de TODOS los movimientos (no solo los filtrados)
    const fechas = movimientosBanco.map(m => m.fecha_mov)
    const fechasOrdenadas = [...fechas].sort((a, b) => {
      const fechaA = parsearFechaLocal(a)
      const fechaB = parsearFechaLocal(b)
      return fechaB.getTime() - fechaA.getTime() // Orden descendente
    })
    const fechaMasReciente = fechasOrdenadas[0]
    
    if (!fechaMasReciente) return 0
    
    // Si hay filtro de fecha hasta, usar esa fecha; sino usar la fecha más reciente de todos los movimientos
    const fechaReferencia = fechaHasta || fechaMasReciente
    
    // Calcular el saldo hasta esa fecha usando todos los movimientos
    // para que coincida con la tabla de saldos diarios
    return calcularTotalAlFinalDelDia(divisa, banco, fechaReferencia)
  }

  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularTotalPorAno = (divisa: string, banco: string, año: number): number => {
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movimientos
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fecha = parsearFechaLocal(m.fecha_mov)
        return fecha.getFullYear() === año
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular el saldo final acumulado de un año (usando la última fecha del año para que coincida con saldos diarios)
  const calcularSaldoFinalPorAno = (divisa: string, banco: string, año: number, añosOrdenados: number[]): number => {
    // Obtener todos los meses de este año para este banco/divisa
    const key = `${divisa}|${banco}`
    const años = anosPorBancoDivisa.get(key) || []
    if (!años.includes(año)) return 0
    
    const keyAno = `${key}|${año}`
    const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
    
    if (meses.length === 0) {
      // Si no hay meses, usar la lógica acumulativa como fallback
      const saldoInicialAno = calcularSaldoInicialPorAno(divisa, banco, año, añosOrdenados)
      const movimientosAno = calcularTotalPorAno(divisa, banco, año)
      return saldoInicialAno + movimientosAno
    }
    
    // Encontrar el último mes del año
    const mesesOrdenados = [...meses].sort((a, b) => b - a) // Descendente
    const ultimoMes = mesesOrdenados[0]
    
    // Obtener la última fecha del último mes
    const keyUltimoMes = `${keyAno}|${ultimoMes}`
    const fechas = fechasPorMesAnoBancoDivisa.get(keyUltimoMes) || []
    
    if (fechas.length === 0) {
      // Si no hay fechas, usar la lógica acumulativa como fallback
      const saldoInicialAno = calcularSaldoInicialPorAno(divisa, banco, año, añosOrdenados)
      const movimientosAno = calcularTotalPorAno(divisa, banco, año)
      return saldoInicialAno + movimientosAno
    }
    
    // Ordenar fechas y usar la última fecha del año
    const fechasOrdenadas = [...fechas].sort((a, b) => {
      const fechaA = parsearFechaLocal(a)
      const fechaB = parsearFechaLocal(b)
      return fechaB.getTime() - fechaA.getTime() // Descendente
    })
    const ultimaFechaDelAno = fechasOrdenadas[0]
    
    // Calcular el saldo hasta el final de esa fecha usando todos los movimientos
    // Esto asegura que coincida con la tabla de saldos diarios
    return calcularTotalAlFinalDelDia(divisa, banco, ultimaFechaDelAno)
  }

  // Calcular el saldo inicial de un año (si es el primer año, usar calcularSaldoInicialTotal; si no, usar el saldo final del año anterior)
  const calcularSaldoInicialPorAno = (divisa: string, banco: string, año: number, añosOrdenados: number[]): number => {
    // Encontrar el índice del año en el array ordenado
    const indiceAno = añosOrdenados.indexOf(año)
    
    // Si es el primer año (más antiguo), calcular el saldo antes de la primera fecha
    if (indiceAno === 0 || indiceAno === -1) {
      // Encontrar la primera fecha de este año (la más temprana)
      const keyAno = `${divisa}|${banco}|${año}`
      const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
      
      // Obtener todas las fechas del año y encontrar la más temprana
      let primeraFecha = ''
      for (const mes of meses) {
        const fechas = fechasPorMesAnoBancoDivisa.get(`${keyAno}|${mes}`) || []
        if (fechas.length > 0) {
          const fechasOrdenadas = [...fechas].sort((a, b) => {
            const fechaA = parsearFechaLocal(a)
            const fechaB = parsearFechaLocal(b)
            return fechaA.getTime() - fechaB.getTime()
          })
          const fechaDelMes = fechasOrdenadas[0]
          if (!primeraFecha || new Date(fechaDelMes) < new Date(primeraFecha)) {
            primeraFecha = fechaDelMes
          }
        }
      }
      
      if (!primeraFecha) return 0
      return calcularSaldoInicialTotal(divisa, banco, primeraFecha)
    }
    
    // Si no es el primer año, el saldo inicial es el saldo final del año anterior
    const añoAnterior = añosOrdenados[indiceAno - 1]
    return calcularSaldoFinalPorAno(divisa, banco, añoAnterior, añosOrdenados)
  }

  // Usar nombre_sheet_origen si está disponible para que coincida con la tabla de saldos diarios
  // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularTotalPorMes = (divisa: string, banco: string, año: number, mes: number): number => {
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movimientos
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fecha = parsearFechaLocal(m.fecha_mov)
        return fecha.getFullYear() === año && fecha.getMonth() + 1 === mes
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo inicial de un mes (saldo final del mes anterior, o saldo inicial del año si es el primer mes)
  const calcularSaldoInicialPorMes = (divisa: string, banco: string, año: number, mes: number, mesesOrdenados: number[]): number => {
    const indiceMes = mesesOrdenados.indexOf(mes)
    
    // Si es el primer mes del año, el saldo inicial es el saldo inicial del año
    if (indiceMes === 0 || indiceMes === -1) {
      const años = anosPorBancoDivisa.get(`${divisa}|${banco}`) || []
      const añosOrdenados = [...años].sort((a, b) => a - b)
      
      // Si este es el primer año, calcular el saldo inicial antes de la primera fecha
      if (añosOrdenados[0] === año) {
        const keyMes = `${divisa}|${banco}|${año}|${mes}`
        const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
        if (fechas.length === 0) return 0
        
        // Encontrar la primera fecha del mes
        const fechasOrdenadas = [...fechas].sort((a, b) => {
          const fechaA = parsearFechaLocal(a)
          const fechaB = parsearFechaLocal(b)
          return fechaA.getTime() - fechaB.getTime()
        })
        const primeraFecha = fechasOrdenadas[0]
        return calcularSaldoInicialTotal(divisa, banco, primeraFecha)
      } else {
        // Si no es el primer año, el saldo inicial del primer mes es el saldo final del año anterior
        const añoAnterior = añosOrdenados[añosOrdenados.indexOf(año) - 1]
        return calcularSaldoFinalPorAno(divisa, banco, añoAnterior, añosOrdenados)
      }
    }
    
    // Si no es el primer mes, el saldo inicial es el saldo final del mes anterior
    const mesAnterior = mesesOrdenados[indiceMes - 1]
    return calcularSaldoFinalPorMes(divisa, banco, año, mesAnterior, mesesOrdenados)
  }

  // Calcular saldo final de un mes (usando la última fecha del mes para que coincida con saldos diarios)
  const calcularSaldoFinalPorMes = (divisa: string, banco: string, año: number, mes: number, mesesOrdenados: number[]): number => {
    // Obtener todas las fechas de este mes para este banco/divisa
    const key = `${divisa}|${banco}|${año}|${mes}`
    const fechas = fechasPorMesAnoBancoDivisa.get(key) || []
    
    if (fechas.length === 0) {
      // Si no hay fechas, usar la lógica acumulativa como fallback
      const saldoInicialMes = calcularSaldoInicialPorMes(divisa, banco, año, mes, mesesOrdenados)
      const movimientosMes = calcularTotalPorMes(divisa, banco, año, mes)
      return saldoInicialMes + movimientosMes
    }
    
    // Ordenar fechas y usar la última fecha del mes
    const fechasOrdenadas = [...fechas].sort((a, b) => {
      const fechaA = parsearFechaLocal(a)
      const fechaB = parsearFechaLocal(b)
      return fechaB.getTime() - fechaA.getTime() // Descendente
    })
    const ultimaFechaDelMes = fechasOrdenadas[0]
    
    // Calcular el saldo hasta el final de esa fecha usando todos los movimientos
    // Esto asegura que coincida con la tabla de saldos diarios
    return calcularTotalAlFinalDelDia(divisa, banco, ultimaFechaDelMes)
  }

  const calcularTotalAlFinalDelDia = (divisa: string, banco: string, fecha: string): number => {
    const fechaDate = parsearFechaLocal(fecha)
    fechaDate.setHours(23, 59, 59, 999)
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    
    // En la tabla de saldos diarios, el banco es identificado por nombre_sheet_origen
    // Por lo tanto, debemos filtrar por nombre_sheet_origen en lugar de solo nombre_banco
    // pero el parámetro 'banco' viene de nombre_banco que es nombre_sheet_origen cuando está disponible
    // IMPORTANTE: Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
    return movimientos
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        // Usar nombre_sheet_origen si está disponible, sino usar nombre_banco
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fechaMov = parsearFechaLocal(m.fecha_mov)
        fechaMov.setHours(0, 0, 0, 0)
        return fechaMov.getTime() <= fechaDate.getTime()
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo inicial total (sin filtrar por categoría) - saldo antes de la primera fecha
  // IMPORTANTE: Usa el parámetro primeraFecha para cada periodo (ej: para feb = saldo final de ene)
  // Usa TODOS los movimientos (sin filtrar) para calcular el saldo correcto
  const calcularSaldoInicialTotal = (divisa: string, banco: string, primeraFecha: string): number => {
    // Si no hay fecha de referencia, el saldo inicial es 0
    if (!primeraFecha || primeraFecha === '') {
      return 0
    }
    
    // Usar la primera fecha del periodo como referencia (balance antes de esta fecha)
    // Así, el saldo inicial de febrero = saldo final de enero (movimientos antes del 1° de feb)
    const fechaReferenciaDate = parsearFechaLocal(primeraFecha)
    fechaReferenciaDate.setHours(0, 0, 0, 0)
    
    // Si la fecha de referencia es el 1 de enero de 2025 o anterior, el saldo inicial es 0
    // porque todos los bancos empezaron con saldo 0 en esa fecha
    const fechaInicioSistema = parsearFechaLocal('2025-01-01')
    fechaInicioSistema.setHours(0, 0, 0, 0)
    
    if (fechaReferenciaDate.getTime() <= fechaInicioSistema.getTime()) {
      return 0
    }
    
    // Calcular el saldo inicial sumando todos los movimientos anteriores a la fecha de referencia
    const divisaNormalizada = normalizarCodigoDivisa(divisa)
    return movimientos
      .filter(m => {
        if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
        const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
        if (nombreBancoMov !== banco) return false
        const fechaMov = parsearFechaLocal(m.fecha_mov)
        fechaMov.setHours(0, 0, 0, 0)
        return fechaMov < fechaReferenciaDate
      })
      .reduce((suma, mov) => {
        const credito = mov.credito || 0
        const debito = mov.debito || 0
        return suma + (credito - debito)
      }, 0)
  }

  // Calcular saldo inicial de un día específico (saldo al final del día anterior) - total sin categoría
  const calcularSaldoInicialDelDiaTotal = (divisa: string, banco: string, fecha: string, todasLasFechas: string[]): number => {
    const fechasOrdenadas = [...todasLasFechas].sort((a, b) => {
      const fechaA = parsearFechaLocal(a)
      const fechaB = parsearFechaLocal(b)
      return fechaA.getTime() - fechaB.getTime()
    })
    const indiceFecha = fechasOrdenadas.indexOf(fecha)
    
    if (indiceFecha === 0) {
      return calcularSaldoInicialTotal(divisa, banco, fecha)
    }
    
    const fechaAnterior = fechasOrdenadas[indiceFecha - 1]
    return calcularTotalAlFinalDelDia(divisa, banco, fechaAnterior)
  }

  // Función helper para obtener el color según el signo del número
  const obtenerColorPorSigno = (valor: number): string => {
    if (valor > 0) return 'text-green-600'
    if (valor < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // Función para convertir un valor a USD según la divisa
  const convertirAUSD = (valor: number, codigoDivisa: string): number => {
    if (!mostrarEnUSD || codigoDivisa === 'USD') {
      return valor
    }
    
    // Normalizar el código de divisa a mayúsculas para asegurar coincidencia
    const codigoNormalizado = codigoDivisa.toUpperCase().trim()
    const tasa = tasasCambio.get(codigoNormalizado)
    
    if (!tasa || tasa === 0) {
      console.warn(`⚠️ No hay tasa de cambio para ${codigoNormalizado} (original: "${codigoDivisa}"), usando valor original`)
      console.log(`📋 Tasas disponibles:`, Array.from(tasasCambio.keys()))
      console.log(`🔍 Tamaño del mapa de tasas:`, tasasCambio.size)
      return valor // Si no hay tasa, devolver el valor original
    }
    
    // Dividir porque unidades_por_usd significa cuántas unidades de la divisa equivalen a 1 USD
    const valorConvertido = valor / tasa
    if (codigoNormalizado === 'EUR' || codigoNormalizado === 'MXN' || codigoNormalizado === 'UYU') {
      console.log(`💱 Conversión ${codigoNormalizado}: ${valor} / ${tasa} = ${valorConvertido}`)
    }
    return valorConvertido
  }

  // Función helper para formatear moneda con conversión a USD opcional
  const formatearMonedaConConversion = (valor: number, codigoDivisa: string, simboloOriginal: string, decimalesOriginal: number): string => {
    if (mostrarEnUSD) {
      const valorUSD = convertirAUSD(valor, codigoDivisa)
      return formatearMoneda(valorUSD, 'U$S', 2)
    }
    return formatearMoneda(valor, simboloOriginal, decimalesOriginal)
  }

  // Obtener movimientos de una categoría para una columna específica
  const obtenerMovimientosColumna = (categoriaId: number, divisa: string, banco: string, fecha: string): Movimiento[] => {
    const movsCategoria = movimientosPorCategoria.get(categoriaId) || []
    const fechaNormalizada = normalizarFecha(fecha)
    return movsCategoria.filter(m => {
      if (m.codigo_divisa !== divisa) return false
      const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
      if (nombreBancoMov !== banco) return false
      const fechaMovNormalizada = normalizarFecha(m.fecha_mov)
      return fechaMovNormalizada === fechaNormalizada
    }).sort((a, b) => {
      // Ordenar por id_odoo descendente dentro de la misma fecha
      const idOdooA = a.id_odoo ?? 0
      const idOdooB = b.id_odoo ?? 0
      return idOdooB - idOdooA
    })
  }

  const toggleCategoria = (categoriaId: number) => {
    setCategoriasExpandidas(prev => {
      const nuevo = new Set(prev)
      const estabaExpandida = nuevo.has(categoriaId)
      if (estabaExpandida) {
        nuevo.delete(categoriaId)
      } else {
        nuevo.add(categoriaId)
        // Resetear paginación cuando se expande una nueva categoría
        setCurrentPageMovimientos(1)
      }
      return nuevo
    })
  }
  
  // Resetear página cuando cambia la categoría expandida
  useEffect(() => {
    setCurrentPageMovimientos(1)
  }, [categoriasExpandidas])

  const toggleDivisa = (divisa: string) => {
    setDivisasExpandidas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(divisa)) {
        nuevo.delete(divisa)
      } else {
        nuevo.add(divisa)
      }
      return nuevo
    })
  }

  const toggleBanco = (divisa: string, banco: string) => {
    const key = `${divisa}|${banco}`
    setBancosExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(key)) {
        nuevo.delete(key)
      } else {
        nuevo.add(key)
      }
      return nuevo
    })
  }

  const toggleCategoriaFiltro = (categoriaId: number) => {
    setCategoriasSeleccionadas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(categoriaId)) {
        nuevo.delete(categoriaId)
      } else {
        nuevo.add(categoriaId)
      }
      return nuevo
    })
  }

  const toggleDivisaFiltro = (divisa: string) => {
    setDivisasSeleccionadas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(divisa)) {
        nuevo.delete(divisa)
      } else {
        nuevo.add(divisa)
      }
      return nuevo
    })
  }

  const toggleEmpresaFiltro = (empresaId: number) => {
    setEmpresasSeleccionadas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(empresaId)) {
        nuevo.delete(empresaId)
      } else {
        nuevo.add(empresaId)
      }
      return nuevo
    })
  }

  const toggleBancoSheetFiltro = (nombreBancoSheet: string) => {
    setBancosSheetSeleccionados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(nombreBancoSheet)) {
        nuevo.delete(nombreBancoSheet)
      } else {
        nuevo.add(nombreBancoSheet)
      }
      return nuevo
    })
  }

  const toggleBancoFiltro = (idBanco: number) => {
    setBancosSeleccionados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(idBanco)) {
        nuevo.delete(idBanco)
      } else {
        nuevo.add(idBanco)
      }
      return nuevo
    })
  }

  const togglePaisFiltro = (nombrePais: string) => {
    setPaisesSeleccionados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(nombrePais)) {
        nuevo.delete(nombrePais)
      } else {
        nuevo.add(nombrePais)
      }
      return nuevo
    })
  }

  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setDivisasSeleccionadas(new Set())
    setBancosSheetSeleccionados(new Set())
    setBancosSeleccionados(new Set())
    setPaisesSeleccionados(new Set())
    setCategoriasSeleccionadas(new Set())
    setEmpresasSeleccionadas(new Set())
  }

  const expandirUnNivel = () => {
    const todasDivisas = new Set(divisasUnicas)
    const todosBancos = new Set<string>()
    const todosAnos = new Set<string>()
    const todosMeses = new Set<string>()
    divisasUnicas.forEach(divisa => {
      (bancosPorDivisa.get(divisa) || []).forEach(banco => {
        const keyBanco = `${divisa}|${banco}`
        todosBancos.add(keyBanco)
        ;(anosPorBancoDivisa.get(keyBanco) || []).forEach(año => {
          const keyAno = `${keyBanco}|${año}`
          todosAnos.add(keyAno)
          ;(mesesPorAnoBancoDivisa.get(keyAno) || []).forEach(mes => {
            todosMeses.add(`${keyAno}|${mes}`)
          })
        })
      })
    })
    // Un nivel cada vez: 1) bancos, 2) años, 3) meses, 4) fechas
    if (divisasExpandidas.size < todasDivisas.size) {
      setDivisasExpandidas(todasDivisas)
      return
    }
    if (bancosExpandidos.size < todosBancos.size) {
      setBancosExpandidos(todosBancos)
      return
    }
    if (anosExpandidos.size < todosAnos.size) {
      setAnosExpandidos(todosAnos)
      return
    }
    if (mesesExpandidos.size < todosMeses.size) {
      setMesesExpandidos(todosMeses)
      return
    }
  }

  const replegarUnNivel = () => {
    // Un nivel cada vez, del más profundo al más alto
    if (mesesExpandidos.size > 0) {
      setMesesExpandidos(new Set())
      return
    }
    if (anosExpandidos.size > 0) {
      setAnosExpandidos(new Set())
      return
    }
    if (bancosExpandidos.size > 0) {
      setBancosExpandidos(new Set())
      return
    }
    if (divisasExpandidas.size > 0) {
      setDivisasExpandidas(new Set())
    }
  }

  const toggleAno = (divisa: string, banco: string, año: number) => {
    const key = `${divisa}|${banco}|${año}`
    setAnosExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(key)) {
        nuevo.delete(key)
      } else {
        nuevo.add(key)
      }
      return nuevo
    })
  }

  const toggleMes = (divisa: string, banco: string, año: number, mes: number) => {
    const key = `${divisa}|${banco}|${año}|${mes}`
    setMesesExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(key)) {
        nuevo.delete(key)
      } else {
        nuevo.add(key)
      }
      return nuevo
    })
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <MenuNavegacion />
      
      <div className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                SouthGenetics - Gestión Financiera
              </h1>
              <p className="text-gray-600">Tabla General</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
                {(divisasSeleccionadas.size > 0 || bancosSheetSeleccionados.size > 0 || bancosSeleccionados.size > 0 || paisesSeleccionados.size > 0 || categoriasSeleccionadas.size > 0 || empresasSeleccionadas.size > 0 || fechaDesde || fechaHasta) && (
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
            {(divisasSeleccionadas.size > 0 || bancosSheetSeleccionados.size > 0 || bancosSeleccionados.size > 0 || paisesSeleccionados.size > 0 || categoriasSeleccionadas.size > 0 || empresasSeleccionadas.size > 0 || fechaDesde || fechaHasta) && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium mb-1">Filtros aplicados:</p>
                <div className="flex flex-wrap gap-2 text-xs text-blue-700">
                  {divisasSeleccionadas.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {Array.from(divisasSeleccionadas).join(', ')}
                    </span>
                  )}
                  {bancosSheetSeleccionados.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {bancosSheetSeleccionados.size} banco(s)/sheet(s)
                    </span>
                  )}
                  {bancosSeleccionados.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {bancosSeleccionados.size} banco(s)
                    </span>
                  )}
                  {paisesSeleccionados.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {paisesSeleccionados.size} país(es)
                    </span>
                  )}
                  {categoriasSeleccionadas.size > 0 && (
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      {categoriasSeleccionadas.size} categoría(s)
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
                              onChange={() => toggleDivisaFiltro(divisa.codigo_divisa)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-gray-700">{divisa.codigo_divisa}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro de Bancos / Sheet */}
                <div className="border border-gray-200 rounded-md">
                  <button
                    onClick={() => toggleSeccionFiltro('bancosSheet')}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
                  >
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                      <Table2 className="h-3.5 w-3.5" />
                      Bancos / Sheet
                    </label>
                    {seccionesFiltrosAbiertas.bancosSheet ? (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                    )}
                  </button>
                  {seccionesFiltrosAbiertas.bancosSheet && (
                    <div className="p-1.5 pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 border border-gray-200 rounded-md p-1.5">
                        {bancosSheet.map(nombreBancoSheet => (
                          <label
                            key={nombreBancoSheet}
                            className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={bancosSheetSeleccionados.has(nombreBancoSheet)}
                              onChange={() => toggleBancoSheetFiltro(nombreBancoSheet)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700">{nombreBancoSheet}</span>
                          </label>
                        ))}
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
                              onChange={() => toggleBancoFiltro(banco.id_banco)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700">{banco.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro de País */}
                <div className="border border-gray-200 rounded-md">
                  <button
                    onClick={() => toggleSeccionFiltro('pais')}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
                  >
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
                      <Globe className="h-3.5 w-3.5" />
                      País
                    </label>
                    {seccionesFiltrosAbiertas.pais ? (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                    )}
                  </button>
                  {seccionesFiltrosAbiertas.pais && (
                    <div className="p-1.5 pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 border border-gray-200 rounded-md p-1.5">
                        {paises.map(nombrePais => (
                          <label
                            key={nombrePais}
                            className="flex items-center gap-1.5 p-1 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={paisesSeleccionados.has(nombrePais)}
                              onChange={() => togglePaisFiltro(nombrePais)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700">{nombrePais}</span>
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
                              onChange={() => toggleCategoriaFiltro(categoria.id_categoria)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700">{categoria.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro de Empresas */}
                {empresas.length > 0 && (
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
                                onChange={() => toggleEmpresaFiltro(empresa.id_empresa)}
                                className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">{empresa.nombre}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {!error && movimientos.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={expandirUnNivel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-200 hover:bg-indigo-300 text-indigo-900 rounded-lg border border-indigo-400"
              title="Expandir un nivel más (bancos → años → meses → fechas)"
            >
              <ChevronsDown className="h-4 w-4" />
              Expandir
            </button>
            <button
              type="button"
              onClick={replegarUnNivel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-200 hover:bg-indigo-300 text-indigo-900 rounded-lg border border-indigo-400"
              title="Replegar un nivel (fechas → meses → años → bancos → divisas)"
            >
              <ChevronsUp className="h-4 w-4" />
              Replegar
            </button>
          </div>
        )}
        
        {!error && (
          <div className="flex items-center justify-end gap-2 mb-4">
            <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-100 hover:bg-green-200 text-green-900 rounded-lg border border-green-400 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={mostrarEnUSD}
                onChange={(e) => setMostrarEnUSD(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
              />
              <DollarSign className="h-4 w-4" />
              <span>Mostrar en USD</span>
            </label>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-red-900 font-semibold mb-1">Error</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!error && movimientos.length === 0 && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-yellow-900 font-semibold mb-1">Sin datos</h3>
                <p className="text-yellow-700 text-sm">
                  No se encontraron movimientos en la base de datos.
                </p>
              </div>
            </div>
          </div>
        )}

        {!error && movimientos.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden relative">
          <div 
            className="overflow-x-auto overflow-y-auto tabla-general-scroll" 
            style={{ 
              scrollbarWidth: 'thin', 
              scrollbarColor: '#cbd5e1 #f1f5f9',
              maxHeight: 'calc(100vh - 300px)'
            }}
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 z-20">
                {/* Fila de divisas (agrupadas) */}
                <tr className="bg-indigo-100">
                  <th rowSpan={5} 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sticky left-0 bg-indigo-100 z-30 border-r-2 border-indigo-600">
                    Categoría
                  </th>
                  {divisasUnicas.map((divisa, idx) => {
                    const estaDivisaExpandida = divisasExpandidas.has(divisa)
                    const bancosDivisa = bancosPorDivisa.get(divisa) || []
                    const totalColumnasDivisa = estaDivisaExpandida 
                      ? bancosDivisa.reduce((sum, banco) => {
                          const key = `${divisa}|${banco}`
                          const estaBancoExpandido = bancosExpandidos.has(key)
                          if (estaBancoExpandido) {
                            const años = anosPorBancoDivisa.get(key) || []
                            return sum + años.reduce((sumAno, año) => {
                              const keyAno = `${key}|${año}`
                              const estaAnoExpandido = anosExpandidos.has(keyAno)
                              if (estaAnoExpandido) {
                                const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                                return sumAno + meses.reduce((sumMes, mes) => {
                                  const keyMes = `${keyAno}|${mes}`
                                  const estaMesExpandido = mesesExpandidos.has(keyMes)
                                  if (estaMesExpandido) {
                                    const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                                    return sumMes + fechas.length
                                  }
                                  return sumMes + 1
                                }, 0)
                              }
                              return sumAno + 1
                            }, 0)
                          }
                          return sum + 1
                        }, 0)
                      : 1
                    
                    return (
                      <th
                        key={`divisa-${divisa}`}
                        colSpan={totalColumnasDivisa}
                        className={`px-2 py-2 text-center text-xs font-medium text-indigo-900 uppercase border-l-2 border-indigo-300 bg-indigo-200 ${
                          idx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                        }`}
                      >
                        <button
                          onClick={() => toggleDivisa(divisa)}
                          className="flex items-center justify-center gap-2 hover:text-blue-600 w-full"
                        >
                          {estaDivisaExpandida ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {divisa}
                        </button>
                      </th>
                    )
                  })}
                </tr>
                
                {/* Fila de bancos */}
                {divisasUnicas.some(d => divisasExpandidas.has(d)) && (
                  <tr className="bg-blue-100">
                    {divisasUnicas.map((divisa, divisaIdx) => {
                      const estaDivisaExpandida = divisasExpandidas.has(divisa)
                      if (!estaDivisaExpandida) {
                        // Si la divisa no está expandida, mostrar una celda vacía con colSpan=1
                        return (
                          <td
                            key={`banco-empty-${divisa}`}
                            colSpan={1}
                            className={`px-2 py-2 border-l-2 border-indigo-300 bg-indigo-200 ${
                              divisaIdx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                            }`}
                          />
                        )
                      }
                      
                      const bancosDivisa = bancosPorDivisa.get(divisa) || []
                      return bancosDivisa.map((banco, bancoIdx) => {
                        const key = `${divisa}|${banco}`
                        const estaBancoExpandido = bancosExpandidos.has(key)
                        const años = anosPorBancoDivisa.get(key) || []
                        const totalColumnasBanco = estaBancoExpandido
                          ? años.reduce((sum, año) => {
                              const keyAno = `${key}|${año}`
                              const estaAnoExpandido = anosExpandidos.has(keyAno)
                              if (estaAnoExpandido) {
                                const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                                return sum + meses.reduce((sumMes, mes) => {
                                  const keyMes = `${keyAno}|${mes}`
                                  const estaMesExpandido = mesesExpandidos.has(keyMes)
                                  if (estaMesExpandido) {
                                    const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                                    return sumMes + fechas.length
                                  }
                                  return sumMes + 1
                                }, 0)
                              }
                              return sum + 1
                            }, 0)
                          : 1
                        
                        return (
                          <th
                            key={`banco-${key}`}
                            colSpan={totalColumnasBanco}
                            className={`px-2 py-2 text-center text-xs font-medium text-blue-900 border-l border-blue-300 bg-blue-200 ${
                              bancoIdx === 0 ? 'border-l-2 border-blue-400' : ''
                            } ${bancoIdx === bancosDivisa.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                          >
                            <button
                              onClick={() => toggleBanco(divisa, banco)}
                              className="flex items-center justify-center gap-2 hover:text-blue-600 w-full"
                            >
                              {estaBancoExpandido ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              {banco}
                            </button>
                          </th>
                        )
                      })
                    })}
                  </tr>
                )}
                
                {/* Fila de años */}
                {divisasUnicas.some(d => {
                  if (!divisasExpandidas.has(d)) return false
                  const bancosDivisa = bancosPorDivisa.get(d) || []
                  return bancosDivisa.some(banco => bancosExpandidos.has(`${d}|${banco}`))
                }) && (
                  <tr className="bg-cyan-100">
                    {divisasUnicas.map((divisa, divisaIdx) => {
                      const estaDivisaExpandida = divisasExpandidas.has(divisa)
                      if (!estaDivisaExpandida) {
                        return (
                          <td
                            key={`año-empty-divisa-${divisa}`}
                            colSpan={1}
                            className={`px-2 py-2 border-l-2 border-indigo-300 bg-indigo-200 ${
                              divisaIdx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                            }`}
                          />
                        )
                      }
                      
                      const bancosDivisa = bancosPorDivisa.get(divisa) || []
                      return bancosDivisa.map((banco, bancoIdx) => {
                        const key = `${divisa}|${banco}`
                        const estaBancoExpandido = bancosExpandidos.has(key)
                        if (!estaBancoExpandido) {
                          // Si el banco no está expandido, mostrar una celda vacía con colSpan=1
                          return (
                            <td
                              key={`año-empty-banco-${key}`}
                              colSpan={1}
                              className={`px-2 py-2 border-l border-blue-300 bg-blue-200 ${
                                bancoIdx === 0 ? 'border-l-2 border-blue-400' : ''
                              } ${bancoIdx === bancosDivisa.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                            />
                          )
                        }
                        
                        const años = anosPorBancoDivisa.get(key) || []
                        return años.map((año, añoIdx) => {
                          const keyAno = `${key}|${año}`
                          const estaAnoExpandido = anosExpandidos.has(keyAno)
                          const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                          const totalColumnasAno = estaAnoExpandido
                            ? meses.reduce((sum, mes) => {
                                const keyMes = `${keyAno}|${mes}`
                                const estaMesExpandido = mesesExpandidos.has(keyMes)
                                if (estaMesExpandido) {
                                  const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                                  return sum + fechas.length
                                }
                                return sum + 1
                              }, 0)
                            : 1
                          
                          return (
                            <th
                              key={`año-${keyAno}`}
                              colSpan={totalColumnasAno}
                              className={`px-2 py-2 text-center text-xs font-medium text-cyan-900 border-l border-cyan-300 bg-cyan-200 ${
                                añoIdx === 0 ? 'border-l-2 border-cyan-400' : ''
                              } ${añoIdx === años.length - 1 ? 'border-r-2 border-cyan-400' : ''}`}
                            >
                              <button
                                onClick={() => toggleAno(divisa, banco, año)}
                                className="flex items-center justify-center gap-2 hover:text-blue-600 w-full"
                              >
                                {estaAnoExpandido ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                {año}
                              </button>
                            </th>
                          )
                        })
                      })
                    })}
                  </tr>
                )}
                
                {/* Fila de meses */}
                {divisasUnicas.some(d => {
                  if (!divisasExpandidas.has(d)) return false
                  const bancosDivisa = bancosPorDivisa.get(d) || []
                  return bancosDivisa.some(banco => {
                    const key = `${d}|${banco}`
                    if (!bancosExpandidos.has(key)) return false
                    const años = anosPorBancoDivisa.get(key) || []
                    return años.some(año => anosExpandidos.has(`${key}|${año}`))
                  })
                }) && (
                  <tr className="bg-emerald-100">
                    {divisasUnicas.map((divisa, divisaIdx) => {
                      const estaDivisaExpandida = divisasExpandidas.has(divisa)
                      if (!estaDivisaExpandida) {
                        return (
                          <td
                            key={`mes-empty-divisa-${divisa}`}
                            colSpan={1}
                            className={`px-2 py-2 border-l-2 border-indigo-300 bg-indigo-200 ${
                              divisaIdx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                            }`}
                          />
                        )
                      }
                      
                      const bancosDivisa = bancosPorDivisa.get(divisa) || []
                      return bancosDivisa.map((banco, bancoIdx) => {
                        const key = `${divisa}|${banco}`
                        const estaBancoExpandido = bancosExpandidos.has(key)
                        if (!estaBancoExpandido) {
                          return (
                            <td
                              key={`mes-empty-banco-${key}`}
                              colSpan={1}
                              className={`px-2 py-2 border-l border-blue-300 bg-blue-200 ${
                                bancoIdx === 0 ? 'border-l-2 border-blue-400' : ''
                              } ${bancoIdx === bancosDivisa.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                            />
                          )
                        }
                        
                        const años = anosPorBancoDivisa.get(key) || []
                        return años.map((año, añoIdx) => {
                          const keyAno = `${key}|${año}`
                          const estaAnoExpandido = anosExpandidos.has(keyAno)
                          if (!estaAnoExpandido) {
                            return (
                              <td
                                key={`mes-empty-año-${keyAno}`}
                                colSpan={1}
                                className={`px-2 py-2 border-l border-cyan-300 bg-cyan-200 ${
                                  añoIdx === 0 ? 'border-l-2 border-cyan-400' : ''
                                } ${añoIdx === años.length - 1 ? 'border-r-2 border-cyan-400' : ''}`}
                              />
                            )
                          }
                          
                          const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                          const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
                          return meses.map((mes, mesIdx) => {
                            const keyMes = `${keyAno}|${mes}`
                            const estaMesExpandido = mesesExpandidos.has(keyMes)
                            const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                            const totalColumnasMes = estaMesExpandido ? fechas.length : 1
                            
                            return (
                              <th
                                key={`mes-${keyMes}`}
                                colSpan={totalColumnasMes}
                                className={`px-2 py-2 text-center text-xs font-medium text-emerald-900 border-l border-emerald-300 bg-emerald-200 ${
                                  mesIdx === 0 ? 'border-l-2 border-emerald-400' : ''
                                } ${mesIdx === meses.length - 1 ? 'border-r-2 border-emerald-400' : ''}`}
                              >
                                <button
                                  onClick={() => toggleMes(divisa, banco, año, mes)}
                                  className="flex items-center justify-center gap-2 hover:text-blue-600 w-full"
                                >
                                  {estaMesExpandido ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                  {nombresMeses[mes - 1]}
                                </button>
                              </th>
                            )
                          })
                        })
                      })
                    })}
                  </tr>
                )}
                
                {/* Fila de fechas */}
                {divisasUnicas.some(d => {
                  if (!divisasExpandidas.has(d)) return false
                  const bancosDivisa = bancosPorDivisa.get(d) || []
                  return bancosDivisa.some(banco => {
                    const key = `${d}|${banco}`
                    if (!bancosExpandidos.has(key)) return false
                    const años = anosPorBancoDivisa.get(key) || []
                    return años.some(año => {
                      const keyAno = `${key}|${año}`
                      if (!anosExpandidos.has(keyAno)) return false
                      const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                      return meses.some(mes => mesesExpandidos.has(`${keyAno}|${mes}`))
                    })
                  })
                }) && (
                  <tr className="bg-teal-100">
                    {divisasUnicas.map((divisa, divisaIdx) => {
                      const estaDivisaExpandida = divisasExpandidas.has(divisa)
                      if (!estaDivisaExpandida) {
                        return (
                          <td
                            key={`fecha-empty-divisa-${divisa}`}
                            colSpan={1}
                            className={`px-2 py-2 border-l-2 border-indigo-300 bg-indigo-200 ${
                              divisaIdx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                            }`}
                          />
                        )
                      }
                      
                      const bancosDivisa = bancosPorDivisa.get(divisa) || []
                      return bancosDivisa.map((banco, bancoIdx) => {
                        const key = `${divisa}|${banco}`
                        const estaBancoExpandido = bancosExpandidos.has(key)
                        if (!estaBancoExpandido) {
                          return (
                            <td
                              key={`fecha-empty-banco-${key}`}
                              colSpan={1}
                              className={`px-2 py-2 border-l border-blue-300 bg-blue-200 ${
                                bancoIdx === 0 ? 'border-l-2 border-blue-400' : ''
                              } ${bancoIdx === bancosDivisa.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                            />
                          )
                        }
                        
                        const años = anosPorBancoDivisa.get(key) || []
                        return años.map((año, añoIdx) => {
                          const keyAno = `${key}|${año}`
                          const estaAnoExpandido = anosExpandidos.has(keyAno)
                          if (!estaAnoExpandido) {
                            return (
                              <td
                                key={`fecha-empty-año-${keyAno}`}
                                colSpan={1}
                                className={`px-2 py-2 border-l border-cyan-300 bg-cyan-200 ${
                                  añoIdx === 0 ? 'border-l-2 border-cyan-400' : ''
                                } ${añoIdx === años.length - 1 ? 'border-r-2 border-cyan-400' : ''}`}
                              />
                            )
                          }
                          
                          const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                          return meses.map((mes, mesIdx) => {
                            const keyMes = `${keyAno}|${mes}`
                            const estaMesExpandido = mesesExpandidos.has(keyMes)
                            if (!estaMesExpandido) {
                              return (
                                <td
                                  key={`fecha-empty-mes-${keyMes}`}
                                  colSpan={1}
                                  className={`px-2 py-2 border-l border-emerald-300 bg-emerald-200 ${
                                    mesIdx === 0 ? 'border-l-2 border-emerald-400' : ''
                                  } ${mesIdx === meses.length - 1 ? 'border-r-2 border-emerald-400' : ''}`}
                                />
                              )
                            }
                            
                            const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                            return fechas.map((fecha, fechaIdx) => {
                              const fechaObj = parsearFechaLocal(fecha)
                              const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { 
                                day: '2-digit', 
                                month: '2-digit' 
                              })
                              
                              return (
                                <th
                                  key={`fecha-${divisa}-${banco}-${año}-${mes}-${fecha}`}
                                  className={`px-2 py-2 text-center text-xs font-medium text-teal-900 border-l border-teal-300 bg-teal-200 ${
                                    fechaIdx === 0 ? 'border-l-2 border-teal-400' : ''
                                  } ${fechaIdx === fechas.length - 1 ? 'border-r-2 border-teal-400' : ''}`}
                                >
                                  {fechaFormateada}
                                </th>
                              )
                            })
                          })
                        })
                      })
                    })}
                  </tr>
                )}
              </thead>
              
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Fila de Saldo Inicial (antes de todas las categorías) */}
                <tr className="bg-amber-100 border-b-2 border-amber-400">
                  <td className="px-4 py-3 text-sm font-bold text-amber-900 sticky left-0 bg-amber-100 z-10 border-r-2 border-indigo-600">
                    Saldo Inicial
                  </td>
                  {divisasUnicas.map((divisa, idx) => {
                    const estaDivisaExpandida = divisasExpandidas.has(divisa)
                    const bancosDivisa = bancosPorDivisa.get(divisa) || []
                    const divisaNormalizada = normalizarCodigoDivisa(divisa)
                    const simbolo = movimientosParaCalcular.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.simbolo_divisa || movimientos.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.simbolo_divisa || '$'
                    const decimales = movimientosParaCalcular.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.decimales_divisa || movimientos.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.decimales_divisa || 2
                    
                    if (!estaDivisaExpandida) {
                      // Saldo inicial total por divisa (suma de todos los bancos)
                      const saldoInicialTotal = bancosDivisa.reduce((suma, banco) => {
                        const keyBanco = `${divisa}|${banco}`
                        const años = anosPorBancoDivisa.get(keyBanco) || []
                        // Usar la fecha desde si está definida, sino usar la primera fecha de los movimientos
                        const fechaReferencia = fechaDesde || (años.length > 0 
                          ? (() => {
                              const keyAno = `${keyBanco}|${años[0]}`
                              const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                              return meses.length > 0 
                                ? (fechasPorMesAnoBancoDivisa.get(`${keyAno}|${meses[0]}`) || [])[0] || ''
                                : ''
                            })()
                          : '')
                        if (!fechaReferencia) return suma
                        return suma + calcularSaldoInicialTotal(divisa, banco, fechaReferencia)
                      }, 0)
                      
                      const colorTexto = obtenerColorPorSigno(saldoInicialTotal)
                      
                      return (
                        <td
                          key={`saldo-inicial-total-divisa-${divisa}`}
                          colSpan={1}
                          className={`px-2 py-2 text-sm text-right font-bold border-l-2 border-indigo-300 bg-amber-100 ${colorTexto} ${
                            idx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                          }`}
                        >
                          {saldoInicialTotal !== 0 ? formatearMonedaConConversion(saldoInicialTotal, divisa, simbolo, decimales) : '-'}
                        </td>
                      )
                    }
                    
                    // Divisa expandida: mostrar por banco
                    return bancosDivisa.map((banco, bancoIdx) => {
                      const key = `${divisa}|${banco}`
                      const estaBancoExpandido = bancosExpandidos.has(key)
                      const años = anosPorBancoDivisa.get(key) || []
                      
                      if (!estaBancoExpandido) {
                        // Saldo inicial total por banco (suma de todos los años)
                        const saldoInicialBanco = años.reduce((suma, año) => {
                          const keyAno = `${key}|${año}`
                          const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                          const primeraFecha = meses.length > 0 
                            ? (fechasPorMesAnoBancoDivisa.get(`${keyAno}|${meses[0]}`) || [])[0] || ''
                            : ''
                          if (!primeraFecha) return suma
                          return suma + calcularSaldoInicialTotal(divisa, banco, primeraFecha)
                        }, 0)
                        
                        const colorTexto = obtenerColorPorSigno(saldoInicialBanco)
                        
                        return (
                          <td
                            key={`saldo-inicial-total-banco-${key}`}
                            colSpan={1}
                            className={`px-2 py-2 text-sm text-right font-bold border-l border-blue-300 bg-amber-100 ${colorTexto} ${
                              bancoIdx === 0 ? 'border-l-2 border-blue-400' : ''
                            } ${bancoIdx === bancosDivisa.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                          >
                            {saldoInicialBanco !== 0 ? formatearMonedaConConversion(saldoInicialBanco, divisa, simbolo, decimales) : '-'}
                          </td>
                        )
                      }
                      
                      // Banco expandido: mostrar años
                      return años.map((año, añoIdx) => {
                        const keyAno = `${key}|${año}`
                        const estaAnoExpandido = anosExpandidos.has(keyAno)
                        const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                        
                        if (!estaAnoExpandido) {
                          // Saldo inicial total por año
                          // Ordenar años de forma ascendente para calcular correctamente (el más antiguo primero)
                          const añosOrdenados = [...años].sort((a, b) => a - b)
                          const saldoInicialAno = calcularSaldoInicialPorAno(divisa, banco, año, añosOrdenados)
                          
                          const colorTexto = obtenerColorPorSigno(saldoInicialAno)
                          
                          return (
                            <td
                              key={`saldo-inicial-total-año-${keyAno}`}
                              colSpan={1}
                              className={`px-2 py-2 text-sm text-right font-bold border-l border-cyan-300 bg-amber-100 ${colorTexto} ${
                                añoIdx === 0 ? 'border-l-2 border-cyan-400' : ''
                              } ${añoIdx === años.length - 1 ? 'border-r-2 border-cyan-400' : ''}`}
                            >
                              {saldoInicialAno !== 0 ? formatearMonedaConConversion(saldoInicialAno, divisa, simbolo, decimales) : '-'}
                            </td>
                          )
                        }
                        
                        // Año expandido: mostrar meses
                        return meses.map((mes, mesIdx) => {
                          const keyMes = `${keyAno}|${mes}`
                          const estaMesExpandido = mesesExpandidos.has(keyMes)
                          const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                          const fechasAscendentes = [...fechas].sort((a, b) => {
                            const fechaA = new Date(a)
                            const fechaB = new Date(b)
                            return fechaA.getTime() - fechaB.getTime()
                          })
                          // Usar el primer día del mes para que saldo inicial feb = saldo final ene
                          const primerDiaDelMes = `${año}-${String(mes).padStart(2, '0')}-01`
                          
                          if (!estaMesExpandido) {
                            // Saldo inicial total por mes (balance antes del 1° del mes = saldo final mes anterior)
                            const saldoInicialMes = calcularSaldoInicialTotal(divisa, banco, primerDiaDelMes)
                            
                            const colorTexto = obtenerColorPorSigno(saldoInicialMes)
                            
                            return (
                              <td
                                key={`saldo-inicial-total-mes-${keyMes}`}
                                colSpan={1}
                                className={`px-2 py-2 text-sm text-right font-bold border-l border-emerald-300 bg-amber-100 ${colorTexto} ${
                                  mesIdx === 0 ? 'border-l-2 border-emerald-400' : ''
                                } ${mesIdx === meses.length - 1 ? 'border-r-2 border-emerald-400' : ''}`}
                              >
                                {saldoInicialMes !== 0 ? formatearMonedaConConversion(saldoInicialMes, divisa, simbolo, decimales) : '-'}
                              </td>
                            )
                          }
                          
                          // Mes expandido: mostrar por fecha (saldo inicial de cada día)
                          return fechas.map((fecha, fechaIdx) => {
                            const saldoInicial = calcularSaldoInicialDelDiaTotal(divisa, banco, fecha, fechasAscendentes)
                            const colorTexto = obtenerColorPorSigno(saldoInicial)
                            
                            return (
                              <td
                                key={`saldo-inicial-total-${divisa}-${banco}-${año}-${mes}-${fecha}`}
                                className={`px-2 py-2 text-sm text-right font-bold border-l border-teal-300 bg-amber-100 ${colorTexto} ${
                                  fechaIdx === 0 ? 'border-l-2 border-teal-400' : ''
                                } ${fechaIdx === fechas.length - 1 ? 'border-r-2 border-teal-400' : ''}`}
                              >
                                {saldoInicial !== 0 ? formatearMonedaConConversion(saldoInicial, divisa, simbolo, decimales) : '-'}
                              </td>
                            )
                          })
                        })
                      })
                    })
                  })}
                </tr>
                
                {categorias
                  .filter(categoria => {
                    // Si hay categorías seleccionadas, solo mostrar las seleccionadas
                    // Si no hay categorías seleccionadas, mostrar todas
                    if (categoriasSeleccionadas.size > 0) {
                      return categoriasSeleccionadas.has(categoria.id_categoria)
                    }
                    return true
                  })
                  .map(categoria => {
                  const estaExpandida = categoriasExpandidas.has(categoria.id_categoria)
                  const movsCategoria = movimientosPorCategoria.get(categoria.id_categoria) || []
                  
                  // Solo mostrar movimientos individuales si la categoría está expandida
                  // Si no está expandida, solo mostrar el saldo total en la fila de categoría
                  
                  // Obtener la primera fecha para calcular saldo inicial
                  const fechasCategoria = Array.from(new Set(movsCategoria.map(m => m.fecha_mov))).sort()
                  const primeraFecha = fechasCategoria[0] || ''
                  
                  return (
                    <React.Fragment key={categoria.id_categoria}>
                      {/* Fila de categoría (resumen o expandida) */}
                      <tr className="hover:bg-purple-50 bg-purple-50">
                        <td className="px-4 py-3 text-sm font-medium text-purple-900 sticky left-0 bg-purple-50 z-10 border-r-2 border-indigo-600">
                          <button
                            onClick={() => toggleCategoria(categoria.id_categoria)}
                            className="flex items-center gap-2 hover:text-blue-600"
                          >
                            {estaExpandida ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {categoria.nombre}
                            {(() => {
                              const cantidad = obtenerCantidadMovimientosCategoria(categoria.id_categoria)
                              return cantidad > 0 ? ` (${cantidad})` : ''
                            })()}
                          </button>
                        </td>
                        
                        {divisasUnicas.map((divisa, idx) => {
                          const estaDivisaExpandida = divisasExpandidas.has(divisa)
                          const bancosDivisa = bancosPorDivisa.get(divisa) || []
                          const divisaNormalizada = normalizarCodigoDivisa(divisa)
                          const simbolo = movsCategoria.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.simbolo_divisa || '$'
                          const decimales = movsCategoria.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.decimales_divisa || 2
                          
                          if (!estaDivisaExpandida) {
                            // Mostrar total por divisa
                            const saldoTotal = calcularSaldoPorDivisa(categoria.id_categoria, divisa)
                            const colorTexto = obtenerColorPorSigno(saldoTotal)
                            // Contar movimientos de esta categoría y divisa
                            const cantidadMovimientos = movsCategoria.filter(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada).length
                            return (
                              <td
                                key={`${categoria.id_categoria}-divisa-${divisa}`}
                                onClick={() => navegarAMovimientos(undefined, undefined, categoria.id_categoria, divisa)}
                                colSpan={1}
                                className={`px-2 py-2 text-sm text-right font-medium border-l-2 border-indigo-300 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors ${colorTexto} ${
                                  idx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                                }`}
                                title="Click para ver movimientos de esta divisa"
                              >
                                <div className="flex items-center justify-end gap-1">
                                  {saldoTotal !== 0 ? formatearMonedaConConversion(saldoTotal, divisa, simbolo, decimales) : '-'}
                                  {cantidadMovimientos > 0 && (
                                    <span className="text-xs text-gray-500">({cantidadMovimientos})</span>
                                  )}
                                </div>
                              </td>
                            )
                          }
                          
                          // Divisa expandida: mostrar bancos
                          return bancosDivisa.map((banco, bancoIdx) => {
                            const key = `${divisa}|${banco}`
                            const estaBancoExpandido = bancosExpandidos.has(key)
                            const años = anosPorBancoDivisa.get(key) || []
                            
                            if (!estaBancoExpandido) {
                              // Mostrar total por banco
                              const saldoBanco = calcularSaldoPorBanco(categoria.id_categoria, divisa, banco)
                              const colorTexto = obtenerColorPorSigno(saldoBanco)
                              // Contar movimientos de esta categoría, divisa y banco
                              const nombreBancoMov = banco
                              const cantidadMovimientos = movsCategoria.filter(m => 
                                normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada && 
                                (m.nombre_sheet_origen === nombreBancoMov || m.nombre_banco === nombreBancoMov)
                              ).length
                              return (
                                <td
                                  key={`${categoria.id_categoria}-banco-${key}`}
                                  onClick={() => navegarAMovimientos(undefined, banco, categoria.id_categoria, divisa)}
                                  colSpan={1}
                                  className={`px-2 py-2 text-sm text-right border-l border-blue-300 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors ${colorTexto} ${
                                    bancoIdx === 0 ? 'border-l-2 border-blue-400' : ''
                                  } ${bancoIdx === bancosDivisa.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                                  title="Click para ver movimientos de este banco"
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    {saldoBanco !== 0 ? formatearMonedaConConversion(saldoBanco, divisa, simbolo, decimales) : '-'}
                                    {cantidadMovimientos > 0 && (
                                      <span className="text-xs text-gray-500">({cantidadMovimientos})</span>
                                    )}
                                  </div>
                                </td>
                              )
                            }
                            
                            // Banco expandido: mostrar años
                            return años.map((año, añoIdx) => {
                              const keyAno = `${key}|${año}`
                              const estaAnoExpandido = anosExpandidos.has(keyAno)
                              const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                              
                              if (!estaAnoExpandido) {
                                // Mostrar total por año
                                const saldoAno = calcularSaldoPorAno(categoria.id_categoria, divisa, banco, año)
                                const colorTexto = obtenerColorPorSigno(saldoAno)
                                // Contar movimientos de esta categoría, divisa, banco y año
                                const nombreBancoMov = banco
                                const cantidadMovimientos = movsCategoria.filter(m => {
                                  const fechaMov = parsearFechaLocal(m.fecha_mov)
                                  return normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada && 
                                         (m.nombre_sheet_origen === nombreBancoMov || m.nombre_banco === nombreBancoMov) &&
                                         fechaMov.getFullYear() === año
                                }).length
                                return (
                                  <td
                                    key={`${categoria.id_categoria}-año-${keyAno}`}
                                    onClick={() => {
                                      const params = new URLSearchParams()
                                      params.set('fechaDesde', `${año}-01-01`)
                                      params.set('fechaHasta', `${año}-12-31`)
                                      const bancoId = mapaBancoId.get(banco)
                                      if (bancoId) params.set('bancoId', bancoId.toString())
                                      params.set('categorias', categoria.id_categoria.toString())
                                      params.set('codigoDivisa', divisa)
                                      router.push(`/movimientos?${params.toString()}`)
                                    }}
                                    colSpan={1}
                                    className={`px-2 py-2 text-sm text-right border-l border-cyan-300 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors ${colorTexto} ${
                                      añoIdx === 0 ? 'border-l-2 border-cyan-400' : ''
                                    } ${añoIdx === años.length - 1 ? 'border-r-2 border-cyan-400' : ''}`}
                                    title="Click para ver movimientos de este año"
                                  >
                                    <div className="flex items-center justify-end gap-1">
                                      {saldoAno !== 0 ? formatearMonedaConConversion(saldoAno, divisa, simbolo, decimales) : '-'}
                                      {cantidadMovimientos > 0 && (
                                        <span className="text-xs text-gray-500">({cantidadMovimientos})</span>
                                      )}
                                    </div>
                                  </td>
                                )
                              }
                              
                              // Año expandido: mostrar meses
                              return meses.map((mes, mesIdx) => {
                                const keyMes = `${keyAno}|${mes}`
                                const estaMesExpandido = mesesExpandidos.has(keyMes)
                                const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                                
                                if (!estaMesExpandido) {
                                  // Mostrar total por mes
                                  const saldoMes = calcularSaldoPorMes(categoria.id_categoria, divisa, banco, año, mes)
                                  const colorTexto = obtenerColorPorSigno(saldoMes)
                                  // Obtener primera y última fecha del mes para el filtro
                                  const fechasMes = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                                  const fechasOrdenadas = [...fechasMes].sort()
                                  const fechaInicioMes = fechasOrdenadas[0] || ''
                                  const fechaFinMes = fechasOrdenadas[fechasOrdenadas.length - 1] || ''
                                  // IMPORTANTE: Contar movimientos usando TODOS los movimientos (movimientosPorCategoriaTotal)
                                  // para que coincida con el cálculo del saldo y no se pierdan movimientos
                                  const movsCategoriaTotal = movimientosPorCategoriaTotal.get(categoria.id_categoria) || []
                                  const cantidadMovimientos = movsCategoriaTotal.filter(m => {
                                    if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
                                    // Usar la misma lógica que en calcularSaldoPorMes para identificar el banco
                                    const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
                                    if (nombreBancoMov !== banco) return false
                                    const fechaMov = parsearFechaLocal(m.fecha_mov)
                                    return fechaMov.getFullYear() === año &&
                                           fechaMov.getMonth() + 1 === mes
                                  }).length
                                  return (
                                    <td
                                      key={`${categoria.id_categoria}-mes-${keyMes}`}
                                      onClick={() => {
                                        if (fechaInicioMes && fechaFinMes) {
                                          const params = new URLSearchParams()
                                          params.set('fechaDesde', fechaInicioMes)
                                          params.set('fechaHasta', fechaFinMes)
                                          const bancoId = mapaBancoId.get(banco)
                                          if (bancoId) params.set('bancoId', bancoId.toString())
                                          params.set('categorias', categoria.id_categoria.toString())
                                          params.set('codigoDivisa', divisa)
                                          router.push(`/movimientos?${params.toString()}`)
                                        }
                                      }}
                                      colSpan={1}
                                      className={`px-2 py-2 text-sm text-right border-l border-emerald-300 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors ${colorTexto} ${
                                        mesIdx === 0 ? 'border-l-2 border-emerald-400' : ''
                                      } ${mesIdx === meses.length - 1 ? 'border-r-2 border-emerald-400' : ''}`}
                                      title="Click para ver movimientos de este mes"
                                    >
                                      <div className="flex items-center justify-end gap-1">
                                        {saldoMes !== 0 ? formatearMonedaConConversion(saldoMes, divisa, simbolo, decimales) : '-'}
                                        {cantidadMovimientos > 0 && (
                                          <span className="text-xs text-gray-500">({cantidadMovimientos})</span>
                                        )}
                                      </div>
                                    </td>
                                  )
                                }
                                
                                // Mes expandido: mostrar fechas (suma neta de movimientos de ese día)
                                return fechas.map((fecha, fechaIdx) => {
                                  // Calcular la suma neta de movimientos de ese día específico
                                  const saldoAcumulado = calcularSaldoAlFinalDelDia(categoria.id_categoria, divisa, banco, fecha)
                                  const colorTexto = obtenerColorPorSigno(saldoAcumulado)
                                  // IMPORTANTE: Contar movimientos usando la MISMA fuente de datos y lógica exacta que calcularSaldoAlFinalDelDia
                                  // para que coincida exactamente con el cálculo del saldo y no se pierdan movimientos
                                  // Usar movimientosPorCategoriaTotal.get() igual que calcularSaldoAlFinalDelDia
                                  // Manejar null/undefined de la misma manera que en movimientosPorCategoriaTotal
                                  const categoriaId = categoria.id_categoria || 0
                                  const movsCategoria = movimientosPorCategoriaTotal.get(categoriaId) || []
                                  const cantidadMovimientos = movsCategoria.filter(m => {
                                    // Usar la misma lógica exacta que en calcularSaldoAlFinalDelDia
                                    if (normalizarCodigoDivisa(m.codigo_divisa) !== divisaNormalizada) return false
                                    const nombreBancoMov = m.nombre_sheet_origen || m.nombre_banco
                                    if (nombreBancoMov !== banco) return false
                                    const fechaMov = parsearFechaLocal(m.fecha_mov)
                                    fechaMov.setHours(0, 0, 0, 0)
                                    const fechaDate = parsearFechaLocal(fecha)
                                    fechaDate.setHours(0, 0, 0, 0)
                                    return fechaMov.getTime() === fechaDate.getTime()
                                  }).length
                                  return (
                                    <td
                                      key={`${categoria.id_categoria}-${divisa}-${banco}-${año}-${mes}-${fecha}`}
                                      onClick={() => navegarAMovimientos(fecha, banco, categoria.id_categoria, divisa)}
                                      className={`px-2 py-2 text-sm text-right border-l border-teal-300 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors ${colorTexto} ${
                                        fechaIdx === 0 ? 'border-l-2 border-teal-400' : ''
                                      } ${fechaIdx === fechas.length - 1 ? 'border-r-2 border-teal-400' : ''}`}
                                      title="Click para ver movimientos de esta fecha"
                                    >
                                      <div className="flex items-center justify-end gap-1">
                                        {saldoAcumulado !== 0 ? formatearMonedaConConversion(saldoAcumulado, divisa, simbolo, decimales) : '-'}
                                        {cantidadMovimientos > 0 && (
                                          <span className="text-xs text-gray-500">({cantidadMovimientos})</span>
                                        )}
                                      </div>
                                    </td>
                                  )
                                })
                              })
                            })
                          })
                        })}
                      </tr>
                      
                      {/* Filas de movimientos individuales (si está expandida) */}
                      {estaExpandida && (
                        <>
                          {/* Controles de paginación para movimientos individuales - ubicados justo después de la fila de categoría */}
                          {(() => {
                            // Calcular totales para la paginación
                            const todosMovimientosCategoria = movsCategoria
                            const movimientosPorColumna = new Map<string, Array<{
                              mov: Movimiento
                              divisa: string
                              banco: string
                              año: number
                              mes: number
                              fecha: string
                            }>>()
                            
                            // Agrupar movimientos según el nivel de expansión actual (código simplificado para calcular total)
                            todosMovimientosCategoria.forEach(mov => {
                              const divisa = mov.codigo_divisa
                              const nombreBanco = mov.nombre_sheet_origen || mov.nombre_banco
                              const fechaMov = parsearFechaLocal(mov.fecha_mov)
                              const año = fechaMov.getFullYear()
                              const mes = fechaMov.getMonth() + 1
                              const fecha = mov.fecha_mov
                              
                              const estaDivisaExpandida = divisasExpandidas.has(divisa)
                              
                              if (!estaDivisaExpandida) {
                                const columnaKey = `${divisa}`
                                if (!movimientosPorColumna.has(columnaKey)) {
                                  movimientosPorColumna.set(columnaKey, [])
                                }
                                movimientosPorColumna.get(columnaKey)!.push({
                                  mov,
                                  divisa,
                                  banco: nombreBanco,
                                  año,
                                  mes,
                                  fecha
                                })
                              } else {
                                const bancosDivisa = bancosPorDivisa.get(divisa) || []
                                const key = `${divisa}|${nombreBanco}`
                                const estaBancoExpandido = bancosExpandidos.has(key)
                                
                                if (!estaBancoExpandido) {
                                  const columnaKey = `${divisa}|${nombreBanco}`
                                  if (!movimientosPorColumna.has(columnaKey)) {
                                    movimientosPorColumna.set(columnaKey, [])
                                  }
                                  movimientosPorColumna.get(columnaKey)!.push({
                                    mov,
                                    divisa,
                                    banco: nombreBanco,
                                    año,
                                    mes,
                                    fecha
                                  })
                                } else {
                                  const años = anosPorBancoDivisa.get(key) || []
                                  const keyAno = `${key}|${año}`
                                  const estaAnoExpandido = anosExpandidos.has(keyAno)
                                  
                                  if (!estaAnoExpandido) {
                                    const columnaKey = `${divisa}|${nombreBanco}|${año}`
                                    if (!movimientosPorColumna.has(columnaKey)) {
                                      movimientosPorColumna.set(columnaKey, [])
                                    }
                                    movimientosPorColumna.get(columnaKey)!.push({
                                      mov,
                                      divisa,
                                      banco: nombreBanco,
                                      año,
                                      mes,
                                      fecha
                                    })
                                  } else {
                                    const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                                    const keyMes = `${keyAno}|${mes}`
                                    const estaMesExpandido = mesesExpandidos.has(keyMes)
                                    
                                    if (!estaMesExpandido) {
                                      const columnaKey = `${divisa}|${nombreBanco}|${año}|${mes}`
                                      if (!movimientosPorColumna.has(columnaKey)) {
                                        movimientosPorColumna.set(columnaKey, [])
                                      }
                                      movimientosPorColumna.get(columnaKey)!.push({
                                        mov,
                                        divisa,
                                        banco: nombreBanco,
                                        año,
                                        mes,
                                        fecha
                                      })
                                    } else {
                                      const columnaKey = `${divisa}|${nombreBanco}|${año}|${mes}|${fecha}`
                                      if (!movimientosPorColumna.has(columnaKey)) {
                                        movimientosPorColumna.set(columnaKey, [])
                                      }
                                      movimientosPorColumna.get(columnaKey)!.push({
                                        mov,
                                        divisa,
                                        banco: nombreBanco,
                                        año,
                                        mes,
                                        fecha
                                      })
                                    }
                                  }
                                }
                              }
                            })
                            
                            // Calcular total de filas usando la misma lógica que se usa más abajo
                            const filasTemp: Array<Map<string, any>> = []
                            movimientosPorColumna.forEach((movsArray, columnaKey) => {
                              movsArray.forEach(movimiento => {
                                let filaEncontrada = false
                                for (const fila of filasTemp) {
                                  if (!fila.has(columnaKey)) {
                                    fila.set(columnaKey, movimiento)
                                    filaEncontrada = true
                                    break
                                  }
                                }
                                if (!filaEncontrada) {
                                  const nuevaFila = new Map()
                                  nuevaFila.set(columnaKey, movimiento)
                                  filasTemp.push(nuevaFila)
                                }
                              })
                            })
                            
                            const totalFilas = filasTemp.length
                            const totalPagesMovimientos = Math.ceil(totalFilas / itemsPerPageMovimientos)
                            
                            const irAPaginaAnteriorMovimientos = () => {
                              if (currentPageMovimientos > 1) {
                                setCurrentPageMovimientos(currentPageMovimientos - 1)
                              }
                            }
                            
                            const irAPaginaSiguienteMovimientos = () => {
                              if (currentPageMovimientos < totalPagesMovimientos) {
                                setCurrentPageMovimientos(currentPageMovimientos + 1)
                              }
                            }
                            
                            const handleItemsPerPageChangeMovimientos = (value: string) => {
                              // Solo permitir números
                              const numericValue = value.replace(/[^0-9]/g, '')
                              setTempItemsPerPageMovimientos(numericValue)
                            }
                            
                            const handleItemsPerPageBlurMovimientos = () => {
                              const numValue = parseInt(tempItemsPerPageMovimientos)
                              if (!isNaN(numValue) && numValue > 0) {
                                // El valor editado es el endIndex deseado, así que itemsPerPageMovimientos = numValue - startIndex + 1
                                const currentStartIndex = customStartOffsetMovimientos !== null 
                                  ? customStartOffsetMovimientos 
                                  : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                const newItemsPerPage = numValue - currentStartIndex + 1
                                
                                if (newItemsPerPage > 0 && newItemsPerPage <= totalFilas) {
                                  setItemsPerPageMovimientos(newItemsPerPage)
                                  // Si hay un offset personalizado, mantenerlo; si no, resetear a página 1
                                  if (customStartOffsetMovimientos === null) {
                                    setCurrentPageMovimientos(1)
                                  }
                                } else if (numValue >= totalFilas) {
                                  // Si el valor es mayor o igual al total, mostrar todas las filas desde el startIndex actual
                                  const remainingItems = totalFilas - currentStartIndex + 1
                                  if (remainingItems > 0) {
                                    setItemsPerPageMovimientos(remainingItems)
                                  } else {
                                    setItemsPerPageMovimientos(totalFilas)
                                    setCustomStartOffsetMovimientos(null)
                                    setCurrentPageMovimientos(1)
                                  }
                                } else {
                                  // Si está vacío o inválido, restaurar el endIndex actual
                                  const endIndex = customStartOffsetMovimientos !== null
                                    ? customStartOffsetMovimientos + itemsPerPageMovimientos - 1
                                    : Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                                  setTempItemsPerPageMovimientos(endIndex.toString())
                                }
                              } else {
                                // Si está vacío o inválido, restaurar el endIndex actual
                                const endIndex = customStartOffsetMovimientos !== null
                                  ? customStartOffsetMovimientos + itemsPerPageMovimientos - 1
                                  : Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                                setTempItemsPerPageMovimientos(endIndex.toString())
                              }
                              setEditingItemsPerPageMovimientos(false)
                            }
                            
                            const handleItemsPerPageKeyDownMovimientos = (e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                handleItemsPerPageBlurMovimientos()
                              } else if (e.key === 'Escape') {
                                const endIndex = Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                                setTempItemsPerPageMovimientos(endIndex.toString())
                                setEditingItemsPerPageMovimientos(false)
                              }
                            }
                            
                            const handleItemsPerPageClickMovimientos = () => {
                              setEditingItemsPerPageMovimientos(true)
                              // Inicializar con el endIndex actual, no itemsPerPageMovimientos
                              const endIndex = customStartOffsetMovimientos !== null
                                ? customStartOffsetMovimientos + itemsPerPageMovimientos - 1
                                : Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                              setTempItemsPerPageMovimientos(endIndex.toString())
                            }

                            const handleStartIndexChangeMovimientos = (value: string) => {
                              // Solo permitir números
                              const numericValue = value.replace(/[^0-9]/g, '')
                              setTempStartIndexMovimientos(numericValue)
                            }

                            const handleStartIndexBlurMovimientos = () => {
                              const numValue = parseInt(tempStartIndexMovimientos)
                              if (!isNaN(numValue) && numValue > 0 && numValue <= totalFilas) {
                                // Cuando el usuario ingresa un número, simplemente establecer ese número como inicio
                                // y mantener el itemsPerPageMovimientos actual para calcular el fin
                                setCustomStartOffsetMovimientos(numValue)
                                // Mantener itemsPerPageMovimientos como está (no cambiarlo)
                                // Resetear a página 1 ya que estamos usando offset personalizado
                                setCurrentPageMovimientos(1)
                              } else {
                                // Si está vacío o inválido, restaurar el startIndex actual
                                const startIndex = customStartOffsetMovimientos !== null 
                                  ? customStartOffsetMovimientos 
                                  : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                setTempStartIndexMovimientos(startIndex.toString())
                              }
                              setEditingStartIndexMovimientos(false)
                            }

                            const handleStartIndexKeyDownMovimientos = (e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                handleStartIndexBlurMovimientos()
                              } else if (e.key === 'Escape') {
                                const startIndex = customStartOffsetMovimientos !== null 
                                  ? customStartOffsetMovimientos 
                                  : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                setTempStartIndexMovimientos(startIndex.toString())
                                setEditingStartIndexMovimientos(false)
                              }
                            }
                            
                            const handleStartIndexClickMovimientos = () => {
                              setEditingStartIndexMovimientos(true)
                              const startIndex = customStartOffsetMovimientos !== null 
                                ? customStartOffsetMovimientos 
                                : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                              setTempStartIndexMovimientos(startIndex.toString())
                            }
                            
                            return totalFilas > 0 ? (
                              <tr className="bg-slate-50 border-b-2 border-indigo-300">
                                <td colSpan={1000} className="px-4 py-2 bg-slate-50" style={{ position: 'relative', textAlign: 'right', paddingRight: '20px' }}>
                                  <div className="flex items-center justify-end gap-2" style={{ 
                                    position: 'sticky', 
                                    right: 0,
                                    backgroundColor: 'rgb(241 245 249)', 
                                    padding: '4px 8px', 
                                    borderRadius: '4px',
                                    zIndex: 15,
                                    width: 'fit-content',
                                    display: 'inline-flex',
                                    whiteSpace: 'nowrap',
                                    marginLeft: 'auto',
                                    flexShrink: 0
                                  }}>
                                    <span className="text-sm text-black whitespace-nowrap">
                                      {(() => {
                                        const startIndex = customStartOffsetMovimientos !== null 
                                          ? customStartOffsetMovimientos 
                                          : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                        const endIndex = customStartOffsetMovimientos !== null
                                          ? Math.min(customStartOffsetMovimientos + itemsPerPageMovimientos - 1, totalFilas)
                                          : Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                                        return (
                                          <>
                                            {editingStartIndexMovimientos ? (
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={tempStartIndexMovimientos}
                                                onChange={(e) => {
                                                  const value = e.target.value.replace(/[^0-9]/g, '')
                                                  if (value === '' || parseInt(value) > 0) {
                                                    handleStartIndexChangeMovimientos(value)
                                                  }
                                                }}
                                                onBlur={handleStartIndexBlurMovimientos}
                                                onKeyDown={handleStartIndexKeyDownMovimientos}
                                                className="inline-block w-auto px-0 py-0 text-sm border-0 border-b border-gray-400 focus:outline-none focus:border-gray-600 text-black bg-transparent text-center"
                                                autoFocus
                                                style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', minWidth: '2ch', maxWidth: '4ch' }}
                                              />
                                            ) : (
                                              <span
                                                onClick={handleStartIndexClickMovimientos}
                                                className="cursor-pointer text-black hover:underline border-b border-transparent hover:border-gray-400 whitespace-nowrap"
                                                title="Click para editar"
                                              >
                                                {startIndex}
                                              </span>
                                            )}
                                            <span className="whitespace-nowrap"> - </span>
                                            {editingItemsPerPageMovimientos ? (
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={tempItemsPerPageMovimientos}
                                                onChange={(e) => {
                                                  const value = e.target.value.replace(/[^0-9]/g, '')
                                                  if (value === '' || parseInt(value) > 0) {
                                                    handleItemsPerPageChangeMovimientos(value)
                                                  }
                                                }}
                                                onBlur={handleItemsPerPageBlurMovimientos}
                                                onKeyDown={handleItemsPerPageKeyDownMovimientos}
                                                className="inline-block w-auto px-0 py-0 text-sm border-0 border-b border-gray-400 focus:outline-none focus:border-gray-600 text-black bg-transparent text-center"
                                                autoFocus
                                                style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', minWidth: '2ch', maxWidth: '4ch' }}
                                              />
                                            ) : (
                                              <span
                                                onClick={handleItemsPerPageClickMovimientos}
                                                className="cursor-pointer text-black hover:underline border-b border-transparent hover:border-gray-400 whitespace-nowrap"
                                                title="Click para editar"
                                              >
                                                {endIndex}
                                              </span>
                                            )}
                                            <span className="whitespace-nowrap"> / </span>
                                            <span className="text-black whitespace-nowrap">{totalFilas}</span>
                                          </>
                                        )
                                      })()}
                                    </span>
                                    <button
                                      onClick={irAPaginaAnteriorMovimientos}
                                      disabled={currentPageMovimientos === 1}
                                      className={`px-3 py-1.5 rounded border transition-colors ${
                                        currentPageMovimientos === 1
                                          ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                      }`}
                                      title="Página anterior"
                                    >
                                      &lt;
                                    </button>
                                    <button
                                      onClick={irAPaginaSiguienteMovimientos}
                                      disabled={currentPageMovimientos >= totalPagesMovimientos}
                                      className={`px-3 py-1.5 rounded border transition-colors ${
                                        currentPageMovimientos >= totalPagesMovimientos
                                          ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                      }`}
                                      title="Página siguiente"
                                    >
                                      &gt;
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : null
                          })()}
                          
                          {/* Mostrar movimientos directamente en las celdas correspondientes */}
                          {(() => {
                            // Obtener todos los movimientos de esta categoría
                            const todosMovimientosCategoria = movsCategoria
                            
                            // Recopilar todos los movimientos agrupados por su columna según el nivel de expansión actual
                            const movimientosPorColumna = new Map<string, Array<{
                              mov: Movimiento
                              divisa: string
                              banco: string
                              año: number
                              mes: number
                              fecha: string
                            }>>()
                            
                            // Agrupar movimientos según el nivel de expansión actual
                            todosMovimientosCategoria.forEach(mov => {
                              const divisa = mov.codigo_divisa
                              const nombreBanco = mov.nombre_sheet_origen || mov.nombre_banco
                              const fechaMov = parsearFechaLocal(mov.fecha_mov)
                              const año = fechaMov.getFullYear()
                              const mes = fechaMov.getMonth() + 1
                              const fecha = mov.fecha_mov
                              
                              // Determinar la clave de columna según el nivel de expansión
                              const estaDivisaExpandida = divisasExpandidas.has(divisa)
                              
                              if (!estaDivisaExpandida) {
                                // Si la divisa no está expandida, agrupar todos los movimientos de esa divisa
                                const columnaKey = `${divisa}`
                                if (!movimientosPorColumna.has(columnaKey)) {
                                  movimientosPorColumna.set(columnaKey, [])
                                }
                                movimientosPorColumna.get(columnaKey)!.push({
                                  mov,
                                  divisa,
                                  banco: nombreBanco,
                                  año,
                                  mes,
                                  fecha
                                })
                              } else {
                                const bancosDivisa = bancosPorDivisa.get(divisa) || []
                                const key = `${divisa}|${nombreBanco}`
                                const estaBancoExpandido = bancosExpandidos.has(key)
                                
                                if (!estaBancoExpandido) {
                                  // Si el banco no está expandido, agrupar todos los movimientos de ese banco
                                  const columnaKey = `${divisa}|${nombreBanco}`
                                  if (!movimientosPorColumna.has(columnaKey)) {
                                    movimientosPorColumna.set(columnaKey, [])
                                  }
                                  movimientosPorColumna.get(columnaKey)!.push({
                                    mov,
                                    divisa,
                                    banco: nombreBanco,
                                    año,
                                    mes,
                                    fecha
                                  })
                                } else {
                                  const años = anosPorBancoDivisa.get(key) || []
                                  const keyAno = `${key}|${año}`
                                  const estaAnoExpandido = anosExpandidos.has(keyAno)
                                  
                                  if (!estaAnoExpandido) {
                                    // Si el año no está expandido, agrupar todos los movimientos de ese año
                                    const columnaKey = `${divisa}|${nombreBanco}|${año}`
                                    if (!movimientosPorColumna.has(columnaKey)) {
                                      movimientosPorColumna.set(columnaKey, [])
                                    }
                                    movimientosPorColumna.get(columnaKey)!.push({
                                      mov,
                                      divisa,
                                      banco: nombreBanco,
                                      año,
                                      mes,
                                      fecha
                                    })
                                  } else {
                                    const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                                    const keyMes = `${keyAno}|${mes}`
                                    const estaMesExpandido = mesesExpandidos.has(keyMes)
                                    
                                    if (!estaMesExpandido) {
                                      // Si el mes no está expandido, agrupar todos los movimientos de ese mes
                                      const columnaKey = `${divisa}|${nombreBanco}|${año}|${mes}`
                                      if (!movimientosPorColumna.has(columnaKey)) {
                                        movimientosPorColumna.set(columnaKey, [])
                                      }
                                      movimientosPorColumna.get(columnaKey)!.push({
                                        mov,
                                        divisa,
                                        banco: nombreBanco,
                                        año,
                                        mes,
                                        fecha
                                      })
                                    } else {
                                      // Si el mes está expandido, agrupar por fecha
                                      const columnaKey = `${divisa}|${nombreBanco}|${año}|${mes}|${fecha}`
                                      if (!movimientosPorColumna.has(columnaKey)) {
                                        movimientosPorColumna.set(columnaKey, [])
                                      }
                                      movimientosPorColumna.get(columnaKey)!.push({
                                        mov,
                                        divisa,
                                        banco: nombreBanco,
                                        año,
                                        mes,
                                        fecha
                                      })
                                    }
                                  }
                                }
                              }
                            })
                            
                            // Calcular totales de movimientos por columna para mostrar conteo
                            const totalesPorColumna = new Map<string, number>()
                            movimientosPorColumna.forEach((movsArray, columnaKey) => {
                              totalesPorColumna.set(columnaKey, movsArray.length)
                            })
                            
                            // Crear filas dinámicamente para minimizar espacio vertical
                            // Agrupar movimientos por su fecha para crear filas más eficientes
                            const filas: Array<Map<string, {
                              mov: Movimiento
                              divisa: string
                              banco: string
                              año: number
                              mes: number
                              fecha: string
                            }>> = []
                            
                            // Recorrer todas las columnas para encontrar movimientos
                            movimientosPorColumna.forEach((movsArray, columnaKey) => {
                              movsArray.forEach(movimiento => {
                                // Buscar una fila existente que tenga espacio en esta columna
                                let filaEncontrada = false
                                for (const fila of filas) {
                                  if (!fila.has(columnaKey)) {
                                    fila.set(columnaKey, movimiento)
                                    filaEncontrada = true
                                    break
                                  }
                                }
                                
                                // Si no se encontró una fila con espacio, crear una nueva
                                if (!filaEncontrada) {
                                  const nuevaFila = new Map<string, {
                                    mov: Movimiento
                                    divisa: string
                                    banco: string
                                    año: number
                                    mes: number
                                    fecha: string
                                  }>()
                                  nuevaFila.set(columnaKey, movimiento)
                                  filas.push(nuevaFila)
                                }
                              })
                            })
                            
                            // Aplicar paginación a las filas
                            const totalFilas = filas.length
                            const totalPagesMovimientos = Math.ceil(totalFilas / itemsPerPageMovimientos)
                            let startIndex: number
                            if (customStartOffsetMovimientos !== null) {
                              // Si hay un offset personalizado, usarlo directamente
                              startIndex = customStartOffsetMovimientos - 1 // -1 porque slice usa índice base 0
                            } else {
                              // Lógica normal de paginación
                              startIndex = (currentPageMovimientos - 1) * itemsPerPageMovimientos
                            }
                            const endIndex = startIndex + itemsPerPageMovimientos
                            const filasPaginadas = filas.slice(startIndex, endIndex)
                            
                            // Funciones de paginación
                            const irAPaginaAnteriorMovimientos = () => {
                              if (currentPageMovimientos > 1) {
                                setCurrentPageMovimientos(currentPageMovimientos - 1)
                              }
                            }
                            
                            const irAPaginaSiguienteMovimientos = () => {
                              if (currentPageMovimientos < totalPagesMovimientos) {
                                setCurrentPageMovimientos(currentPageMovimientos + 1)
                              }
                            }
                            
                            const handleItemsPerPageChangeMovimientos = (value: string) => {
                              // Solo permitir números
                              const numericValue = value.replace(/[^0-9]/g, '')
                              setTempItemsPerPageMovimientos(numericValue)
                            }
                            
                            const handleItemsPerPageBlurMovimientos = () => {
                              const numValue = parseInt(tempItemsPerPageMovimientos)
                              if (!isNaN(numValue) && numValue > 0) {
                                // El valor editado es el endIndex deseado, así que itemsPerPageMovimientos = numValue - startIndex + 1
                                const currentStartIndex = customStartOffsetMovimientos !== null 
                                  ? customStartOffsetMovimientos 
                                  : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                const newItemsPerPage = numValue - currentStartIndex + 1
                                
                                if (newItemsPerPage > 0 && newItemsPerPage <= totalFilas) {
                                  setItemsPerPageMovimientos(newItemsPerPage)
                                  // Si hay un offset personalizado, mantenerlo; si no, resetear a página 1
                                  if (customStartOffsetMovimientos === null) {
                                    setCurrentPageMovimientos(1)
                                  }
                                } else if (numValue >= totalFilas) {
                                  // Si el valor es mayor o igual al total, mostrar todas las filas desde el startIndex actual
                                  const remainingItems = totalFilas - currentStartIndex + 1
                                  if (remainingItems > 0) {
                                    setItemsPerPageMovimientos(remainingItems)
                                  } else {
                                    setItemsPerPageMovimientos(totalFilas)
                                    setCustomStartOffsetMovimientos(null)
                                    setCurrentPageMovimientos(1)
                                  }
                                } else {
                                  // Si está vacío o inválido, restaurar el endIndex actual
                                  const endIndex = customStartOffsetMovimientos !== null
                                    ? customStartOffsetMovimientos + itemsPerPageMovimientos - 1
                                    : Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                                  setTempItemsPerPageMovimientos(endIndex.toString())
                                }
                              } else {
                                // Si está vacío o inválido, restaurar el endIndex actual
                                const endIndex = customStartOffsetMovimientos !== null
                                  ? customStartOffsetMovimientos + itemsPerPageMovimientos - 1
                                  : Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                                setTempItemsPerPageMovimientos(endIndex.toString())
                              }
                              setEditingItemsPerPageMovimientos(false)
                            }
                            
                            const handleItemsPerPageKeyDownMovimientos = (e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                handleItemsPerPageBlurMovimientos()
                              } else if (e.key === 'Escape') {
                                const endIndex = Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                                setTempItemsPerPageMovimientos(endIndex.toString())
                                setEditingItemsPerPageMovimientos(false)
                              }
                            }
                            
                            const handleItemsPerPageClickMovimientos = () => {
                              setEditingItemsPerPageMovimientos(true)
                              // Inicializar con el endIndex actual, no itemsPerPageMovimientos
                              const endIndex = customStartOffsetMovimientos !== null
                                ? customStartOffsetMovimientos + itemsPerPageMovimientos - 1
                                : Math.min(currentPageMovimientos * itemsPerPageMovimientos, totalFilas)
                              setTempItemsPerPageMovimientos(endIndex.toString())
                            }

                            const handleStartIndexChangeMovimientos = (value: string) => {
                              // Solo permitir números
                              const numericValue = value.replace(/[^0-9]/g, '')
                              setTempStartIndexMovimientos(numericValue)
                            }

                            const handleStartIndexBlurMovimientos = () => {
                              const numValue = parseInt(tempStartIndexMovimientos)
                              if (!isNaN(numValue) && numValue > 0 && numValue <= totalFilas) {
                                // Cuando el usuario ingresa un número, simplemente establecer ese número como inicio
                                // y mantener el itemsPerPageMovimientos actual para calcular el fin
                                setCustomStartOffsetMovimientos(numValue)
                                // Mantener itemsPerPageMovimientos como está (no cambiarlo)
                                // Resetear a página 1 ya que estamos usando offset personalizado
                                setCurrentPageMovimientos(1)
                              } else {
                                // Si está vacío o inválido, restaurar el startIndex actual
                                const startIndex = customStartOffsetMovimientos !== null 
                                  ? customStartOffsetMovimientos 
                                  : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                setTempStartIndexMovimientos(startIndex.toString())
                              }
                              setEditingStartIndexMovimientos(false)
                            }

                            const handleStartIndexKeyDownMovimientos = (e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                handleStartIndexBlurMovimientos()
                              } else if (e.key === 'Escape') {
                                const startIndex = customStartOffsetMovimientos !== null 
                                  ? customStartOffsetMovimientos 
                                  : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                setTempStartIndexMovimientos(startIndex.toString())
                                setEditingStartIndexMovimientos(false)
                              }
                            }
                            
                            const handleStartIndexClickMovimientos = () => {
                              setEditingStartIndexMovimientos(true)
                              const startIndex = customStartOffsetMovimientos !== null 
                                ? customStartOffsetMovimientos 
                                : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                              setTempStartIndexMovimientos(startIndex.toString())
                            }
                            
                            // Renderizar las filas
                            return (
                              <>
                                {filasPaginadas.map((fila, filaIdx) => {
                                  const startIndexMovimientos = customStartOffsetMovimientos !== null 
                                    ? customStartOffsetMovimientos 
                                    : (currentPageMovimientos - 1) * itemsPerPageMovimientos + 1
                                  const numeroFila = startIndexMovimientos + filaIdx
                                  return (
                                    <tr key={`mov-fila-${filaIdx}`} className="bg-slate-50">
                                      <td className="px-4 py-2 text-center text-sm text-gray-700 sticky left-0 bg-slate-50 z-10 border-r-2 border-indigo-600">
                                        {numeroFila}
                                      </td>
                                      
                                      {/* Renderizar todas las columnas */}
                                      {divisasUnicas.map((divisaCol, idxCol) => {
                                    const estaDivisaExpandidaCol = divisasExpandidas.has(divisaCol)
                                    const bancosDivisaCol = bancosPorDivisa.get(divisaCol) || []
                                    
                                    if (!estaDivisaExpandidaCol) {
                                      // Divisa no expandida: buscar movimientos agrupados por divisa
                                      const columnaKey = `${divisaCol}`
                                      const movimientoEnCelda = fila.get(columnaKey)
                                      
                                      if (movimientoEnCelda) {
                                        const { mov } = movimientoEnCelda
                                        const credito = mov.credito || 0
                                        const debito = mov.debito || 0
                                        const concepto = mov.concepto || '-'
                                        const simbolo = mov.simbolo_divisa || '$'
                                        const decimales = mov.decimales_divisa || 2
                                        
                                        let conceptoLinea1 = concepto
                                        let conceptoLinea2 = ''
                                        if (concepto.length > 25) {
                                          const puntoMedio = Math.floor(concepto.length / 2)
                                          let mejorDivision = puntoMedio
                                          for (let i = Math.max(0, puntoMedio - 10); i <= Math.min(concepto.length, puntoMedio + 10); i++) {
                                            if (concepto[i] === ' ') {
                                              mejorDivision = i
                                              break
                                            }
                                          }
                                          if (mejorDivision > 0 && mejorDivision < concepto.length) {
                                            conceptoLinea1 = concepto.substring(0, mejorDivision)
                                            conceptoLinea2 = concepto.substring(mejorDivision + 1)
                                          } else {
                                            conceptoLinea1 = concepto.substring(0, puntoMedio)
                                            conceptoLinea2 = concepto.substring(puntoMedio)
                                          }
                                        }
                                        
                                        let importeTexto: string
                                        let esNegativo = false
                                        const codigoDivisaMov = mov.codigo_divisa || divisaCol
                                        if (credito > 0) {
                                          importeTexto = formatearMonedaConConversion(credito, codigoDivisaMov, simbolo, decimales)
                                        } else if (debito > 0) {
                                          importeTexto = formatearMonedaConConversion(debito, codigoDivisaMov, simbolo, decimales)
                                          esNegativo = true
                                        } else {
                                          importeTexto = formatearMonedaConConversion(0, codigoDivisaMov, simbolo, decimales)
                                        }
                                        if (esNegativo) importeTexto = `- ${importeTexto}`
                                        
                                        const anchoMinimo = Math.max(100, Math.min(350, Math.max(conceptoLinea1.length, conceptoLinea2.length, importeTexto.length) * 6.5 + 16))
                                        
                                        return (
                                          <td
                                            key={`mov-cell-divisa-${divisaCol}-${filaIdx}`}
                                            onClick={() => navegarAMovimientos(undefined, undefined, categoria.id_categoria, divisaCol)}
                                            className={`px-2 py-1 text-xs text-left border-l-2 border-indigo-300 bg-slate-50 align-top cursor-pointer hover:bg-slate-100 transition-colors ${
                                              idxCol === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                                            }`}
                                            style={{ minHeight: '60px', maxHeight: '60px', width: `${anchoMinimo}px` }}
                                            title="Click para ver movimientos"
                                          >
                                            <div className="flex flex-col h-full justify-between" style={{ height: '100%' }}>
                                              <div>
                                                {conceptoLinea1 && (
                                                  <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">
                                                    {conceptoLinea1}
                                                  </div>
                                                )}
                                                {conceptoLinea2 && <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">{conceptoLinea2}</div>}
                                              </div>
                                              <div className={`font-semibold leading-tight whitespace-nowrap ${esNegativo ? 'text-red-600' : 'text-green-600'}`}>
                                                {importeTexto}
                                              </div>
                                            </div>
                                          </td>
                                        )
                                      }
                                      
                                      return (
                                        <td
                                          key={`mov-empty-divisa-${divisaCol}-${filaIdx}`}
                                          colSpan={1}
                                          className={`px-2 py-2 text-sm border-l-2 border-indigo-300 bg-slate-50 ${
                                            idxCol === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                                          }`}
                                        />
                                      )
                                    }
                                    
                                    return bancosDivisaCol.map((bancoCol, bancoIdxCol) => {
                                      const keyCol = `${divisaCol}|${bancoCol}`
                                      const estaBancoExpandidoCol = bancosExpandidos.has(keyCol)
                                      if (!estaBancoExpandidoCol) {
                                        // Banco no expandido: buscar movimientos agrupados por banco
                                        const columnaKey = `${divisaCol}|${bancoCol}`
                                        const movimientoEnCelda = fila.get(columnaKey)
                                        
                                        if (movimientoEnCelda) {
                                          const { mov } = movimientoEnCelda
                                          const credito = mov.credito || 0
                                          const debito = mov.debito || 0
                                          const concepto = mov.concepto || '-'
                                          const simbolo = mov.simbolo_divisa || '$'
                                          const decimales = mov.decimales_divisa || 2
                                          
                                          let conceptoLinea1 = concepto
                                          let conceptoLinea2 = ''
                                          if (concepto.length > 25) {
                                            const puntoMedio = Math.floor(concepto.length / 2)
                                            let mejorDivision = puntoMedio
                                            for (let i = Math.max(0, puntoMedio - 10); i <= Math.min(concepto.length, puntoMedio + 10); i++) {
                                              if (concepto[i] === ' ') {
                                                mejorDivision = i
                                                break
                                              }
                                            }
                                            if (mejorDivision > 0 && mejorDivision < concepto.length) {
                                              conceptoLinea1 = concepto.substring(0, mejorDivision)
                                              conceptoLinea2 = concepto.substring(mejorDivision + 1)
                                            } else {
                                              conceptoLinea1 = concepto.substring(0, puntoMedio)
                                              conceptoLinea2 = concepto.substring(puntoMedio)
                                            }
                                          }
                                          
                                          let importeTexto: string
                                          let esNegativo = false
                                          const codigoDivisaMov = mov.codigo_divisa || divisaCol
                                          if (credito > 0) {
                                            importeTexto = formatearMonedaConConversion(credito, codigoDivisaMov, simbolo, decimales)
                                          } else if (debito > 0) {
                                            importeTexto = formatearMonedaConConversion(debito, codigoDivisaMov, simbolo, decimales)
                                            esNegativo = true
                                          } else {
                                            importeTexto = formatearMonedaConConversion(0, codigoDivisaMov, simbolo, decimales)
                                          }
                                          if (esNegativo) importeTexto = `- ${importeTexto}`
                                          
                                          const anchoMinimo = Math.max(100, Math.min(350, Math.max(conceptoLinea1.length, conceptoLinea2.length, importeTexto.length) * 6.5 + 16))
                                          
                                          return (
                                            <td
                                              key={`mov-cell-banco-${keyCol}-${filaIdx}`}
                                              onClick={() => navegarAMovimientos(undefined, bancoCol, categoria.id_categoria, divisaCol)}
                                              className={`px-2 py-1 text-xs text-left border-l border-blue-300 bg-slate-50 align-top cursor-pointer hover:bg-slate-100 transition-colors ${
                                                bancoIdxCol === 0 ? 'border-l-2 border-blue-400' : ''
                                              } ${bancoIdxCol === bancosDivisaCol.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                                              style={{ minHeight: '60px', maxHeight: '60px', width: `${anchoMinimo}px` }}
                                              title="Click para ver movimientos"
                                            >
                                              <div className="flex flex-col h-full justify-between" style={{ height: '100%' }}>
                                                <div>
                                                      {conceptoLinea1 && (
                                                        <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">
                                                          {conceptoLinea1}
                                                        </div>
                                                      )}
                                                  {conceptoLinea2 && <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">{conceptoLinea2}</div>}
                                                </div>
                                                <div className={`font-semibold leading-tight whitespace-nowrap ${esNegativo ? 'text-red-600' : 'text-green-600'}`}>
                                                  {importeTexto}
                                                </div>
                                              </div>
                                            </td>
                                          )
                                        }
                                        
                                        return (
                                          <td
                                            key={`mov-empty-banco-${keyCol}-${filaIdx}`}
                                            colSpan={1}
                                            className={`px-2 py-2 text-sm border-l border-blue-300 bg-slate-50 ${
                                              bancoIdxCol === 0 ? 'border-l-2 border-blue-400' : ''
                                            } ${bancoIdxCol === bancosDivisaCol.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                                          />
                                        )
                                      }
                                      
                                      const añosCol = anosPorBancoDivisa.get(keyCol) || []
                                      return añosCol.map(añoCol => {
                                        const keyAnoCol = `${keyCol}|${añoCol}`
                                        const estaAnoExpandidoCol = anosExpandidos.has(keyAnoCol)
                                        if (!estaAnoExpandidoCol) {
                                          // Año no expandido: buscar movimientos agrupados por año
                                          const columnaKey = `${divisaCol}|${bancoCol}|${añoCol}`
                                          const movimientoEnCelda = fila.get(columnaKey)
                                          
                                          if (movimientoEnCelda) {
                                            const { mov } = movimientoEnCelda
                                            const credito = mov.credito || 0
                                            const debito = mov.debito || 0
                                            const concepto = mov.concepto || '-'
                                            const simbolo = mov.simbolo_divisa || '$'
                                            const decimales = mov.decimales_divisa || 2
                                            
                                            let conceptoLinea1 = concepto
                                            let conceptoLinea2 = ''
                                            if (concepto.length > 25) {
                                              const puntoMedio = Math.floor(concepto.length / 2)
                                              let mejorDivision = puntoMedio
                                              for (let i = Math.max(0, puntoMedio - 10); i <= Math.min(concepto.length, puntoMedio + 10); i++) {
                                                if (concepto[i] === ' ') {
                                                  mejorDivision = i
                                                  break
                                                }
                                              }
                                              if (mejorDivision > 0 && mejorDivision < concepto.length) {
                                                conceptoLinea1 = concepto.substring(0, mejorDivision)
                                                conceptoLinea2 = concepto.substring(mejorDivision + 1)
                                              } else {
                                                conceptoLinea1 = concepto.substring(0, puntoMedio)
                                                conceptoLinea2 = concepto.substring(puntoMedio)
                                              }
                                            }
                                            
                                            let importeTexto: string
                                            let esNegativo = false
                                            const codigoDivisaMov = mov.codigo_divisa || divisaCol
                                            if (credito > 0) {
                                              importeTexto = formatearMonedaConConversion(credito, codigoDivisaMov, simbolo, decimales)
                                            } else if (debito > 0) {
                                              importeTexto = formatearMonedaConConversion(debito, codigoDivisaMov, simbolo, decimales)
                                              esNegativo = true
                                            } else {
                                              importeTexto = formatearMonedaConConversion(0, codigoDivisaMov, simbolo, decimales)
                                            }
                                            if (esNegativo) importeTexto = `- ${importeTexto}`
                                            
                                            const anchoMinimo = Math.max(100, Math.min(350, Math.max(conceptoLinea1.length, conceptoLinea2.length, importeTexto.length) * 6.5 + 16))
                                            
                                            return (
                                              <td
                                                key={`mov-cell-año-${keyAnoCol}-${filaIdx}`}
                                                onClick={() => {
                                                  const params = new URLSearchParams()
                                                  params.set('fechaDesde', `${añoCol}-01-01`)
                                                  params.set('fechaHasta', `${añoCol}-12-31`)
                                                  const bancoId = mapaBancoId.get(bancoCol)
                                                  if (bancoId) params.set('bancoId', bancoId.toString())
                                                  params.set('categorias', categoria.id_categoria.toString())
                                                  params.set('codigoDivisa', divisaCol)
                                                  router.push(`/movimientos?${params.toString()}`)
                                                }}
                                                className="px-2 py-1 text-xs text-left border-l border-cyan-300 bg-slate-50 align-top cursor-pointer hover:bg-slate-100 transition-colors"
                                                style={{ minHeight: '60px', maxHeight: '60px', width: `${anchoMinimo}px` }}
                                                title="Click para ver movimientos"
                                              >
                                                <div className="flex flex-col h-full justify-between" style={{ height: '100%' }}>
                                                  <div>
                                                      {conceptoLinea1 && (
                                                        <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">
                                                          {conceptoLinea1}
                                                        </div>
                                                      )}
                                                    {conceptoLinea2 && <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">{conceptoLinea2}</div>}
                                                  </div>
                                                  <div className={`font-semibold leading-tight whitespace-nowrap ${esNegativo ? 'text-red-600' : 'text-green-600'}`}>
                                                    {importeTexto}
                                                  </div>
                                                </div>
                                              </td>
                                            )
                                          }
                                          
                                          return (
                                            <td
                                              key={`mov-empty-año-${keyAnoCol}-${filaIdx}`}
                                              colSpan={1}
                                              className="px-2 py-2 text-sm border-l border-cyan-300 bg-slate-50"
                                            />
                                          )
                                        }
                                        
                                        const mesesCol = mesesPorAnoBancoDivisa.get(keyAnoCol) || []
                                        return mesesCol.map(mesCol => {
                                          const keyMesCol = `${keyAnoCol}|${mesCol}`
                                          const estaMesExpandidoCol = mesesExpandidos.has(keyMesCol)
                                          if (!estaMesExpandidoCol) {
                                            // Mes no expandido: buscar movimientos agrupados por mes
                                            const columnaKey = `${divisaCol}|${bancoCol}|${añoCol}|${mesCol}`
                                            const movimientoEnCelda = fila.get(columnaKey)
                                            
                                            if (movimientoEnCelda) {
                                              const { mov } = movimientoEnCelda
                                              const credito = mov.credito || 0
                                              const debito = mov.debito || 0
                                              const concepto = mov.concepto || '-'
                                              const simbolo = mov.simbolo_divisa || '$'
                                              const decimales = mov.decimales_divisa || 2
                                              
                                              let conceptoLinea1 = concepto
                                              let conceptoLinea2 = ''
                                              if (concepto.length > 25) {
                                                const puntoMedio = Math.floor(concepto.length / 2)
                                                let mejorDivision = puntoMedio
                                                for (let i = Math.max(0, puntoMedio - 10); i <= Math.min(concepto.length, puntoMedio + 10); i++) {
                                                  if (concepto[i] === ' ') {
                                                    mejorDivision = i
                                                    break
                                                  }
                                                }
                                                if (mejorDivision > 0 && mejorDivision < concepto.length) {
                                                  conceptoLinea1 = concepto.substring(0, mejorDivision)
                                                  conceptoLinea2 = concepto.substring(mejorDivision + 1)
                                                } else {
                                                  conceptoLinea1 = concepto.substring(0, puntoMedio)
                                                  conceptoLinea2 = concepto.substring(puntoMedio)
                                                }
                                              }
                                              
                                              let importeTexto: string
                                              let esNegativo = false
                                              const codigoDivisaMov = mov.codigo_divisa || divisaCol
                                              if (credito > 0) {
                                                importeTexto = formatearMonedaConConversion(credito, codigoDivisaMov, simbolo, decimales)
                                              } else if (debito > 0) {
                                                importeTexto = formatearMonedaConConversion(debito, codigoDivisaMov, simbolo, decimales)
                                                esNegativo = true
                                              } else {
                                                importeTexto = formatearMonedaConConversion(0, codigoDivisaMov, simbolo, decimales)
                                              }
                                              if (esNegativo) importeTexto = `- ${importeTexto}`
                                              
                                              const anchoMinimo = Math.max(100, Math.min(350, Math.max(conceptoLinea1.length, conceptoLinea2.length, importeTexto.length) * 6.5 + 16))
                                              
                                              return (
                                                <td
                                                  key={`mov-cell-mes-${keyMesCol}-${filaIdx}`}
                                                  onClick={() => {
                                                    const fechasMes = fechasPorMesAnoBancoDivisa.get(keyMesCol) || []
                                                    const fechasOrdenadas = [...fechasMes].sort()
                                                    const fechaInicioMes = fechasOrdenadas[0] || ''
                                                    const fechaFinMes = fechasOrdenadas[fechasOrdenadas.length - 1] || ''
                                                    if (fechaInicioMes && fechaFinMes) {
                                                      const params = new URLSearchParams()
                                                      params.set('fechaDesde', fechaInicioMes)
                                                      params.set('fechaHasta', fechaFinMes)
                                                      const bancoId = mapaBancoId.get(bancoCol)
                                                      if (bancoId) params.set('bancoId', bancoId.toString())
                                                      params.set('categorias', categoria.id_categoria.toString())
                                                      params.set('codigoDivisa', divisaCol)
                                                      router.push(`/movimientos?${params.toString()}`)
                                                    }
                                                  }}
                                                  className="px-2 py-1 text-xs text-left border-l border-emerald-300 bg-slate-50 align-top cursor-pointer hover:bg-slate-100 transition-colors"
                                                  style={{ minHeight: '60px', maxHeight: '60px', width: `${anchoMinimo}px` }}
                                                  title="Click para ver movimientos"
                                                >
                                                  <div className="flex flex-col h-full justify-between" style={{ height: '100%' }}>
                                                    <div>
                                                      {conceptoLinea1 && <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">{conceptoLinea1}</div>}
                                                      {conceptoLinea2 && <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">{conceptoLinea2}</div>}
                                                    </div>
                                                    <div className={`font-semibold leading-tight whitespace-nowrap ${esNegativo ? 'text-red-600' : 'text-green-600'}`}>
                                                      {importeTexto}
                                                    </div>
                                                  </div>
                                                </td>
                                              )
                                            }
                                            
                                            return (
                                              <td
                                                key={`mov-empty-mes-${keyMesCol}-${filaIdx}`}
                                                colSpan={1}
                                                className="px-2 py-2 text-sm border-l border-emerald-300 bg-slate-50"
                                              />
                                            )
                                          }
                                          
                                          const fechasCol = fechasPorMesAnoBancoDivisa.get(keyMesCol) || []
                                          return fechasCol.map((fechaCol, fechaIdxCol) => {
                                            const columnaKey = `${divisaCol}|${bancoCol}|${añoCol}|${mesCol}|${fechaCol}`
                                            const movimientoEnCelda = fila.get(columnaKey)
                                            
                                            if (movimientoEnCelda) {
                                              const { mov } = movimientoEnCelda
                                              const credito = mov.credito || 0
                                              const debito = mov.debito || 0
                                              const monto = credito - debito
                                              const concepto = mov.concepto || '-'
                                              const simbolo = mov.simbolo_divisa || '$'
                                              const decimales = mov.decimales_divisa || 2
                                              
                                              // Dividir el concepto en exactamente 2 líneas de manera eficiente
                                              let conceptoLinea1 = concepto
                                              let conceptoLinea2 = ''
                                              
                                              // Si el concepto es corto, solo una línea
                                              if (concepto.length <= 25) {
                                                conceptoLinea1 = concepto
                                                conceptoLinea2 = ''
                                              } else {
                                                // Dividir el concepto en 2 líneas balanceadas
                                                const puntoMedio = Math.floor(concepto.length / 2)
                                                
                                                // Buscar el mejor punto de división cerca del medio
                                                let mejorDivision = puntoMedio
                                                let mejorDiferencia = concepto.length
                                                
                                                // Buscar espacios cerca del medio (hasta 10 caracteres a cada lado)
                                                for (let i = Math.max(0, puntoMedio - 10); i <= Math.min(concepto.length, puntoMedio + 10); i++) {
                                                  if (concepto[i] === ' ') {
                                                    const longLinea1 = i
                                                    const longLinea2 = concepto.length - i - 1
                                                    const diferencia = Math.abs(longLinea1 - longLinea2)
                                                    if (diferencia < mejorDiferencia) {
                                                      mejorDiferencia = diferencia
                                                      mejorDivision = i
                                                    }
                                                  }
                                                }
                                                
                                                if (mejorDivision > 0 && mejorDivision < concepto.length) {
                                                  conceptoLinea1 = concepto.substring(0, mejorDivision)
                                                  conceptoLinea2 = concepto.substring(mejorDivision + 1)
                                                } else {
                                                  // Si no hay espacios, dividir por la mitad
                                                  conceptoLinea1 = concepto.substring(0, puntoMedio)
                                                  conceptoLinea2 = concepto.substring(puntoMedio)
                                                }
                                              }
                                              
                                              // Formatear el importe
                                              let importeTexto: string
                                              let esNegativo = false
                                              const codigoDivisaMov = mov.codigo_divisa || divisaCol
                                              
                                              if (credito > 0) {
                                                importeTexto = formatearMonedaConConversion(credito, codigoDivisaMov, simbolo, decimales)
                                                esNegativo = false
                                              } else if (debito > 0) {
                                                importeTexto = formatearMonedaConConversion(debito, codigoDivisaMov, simbolo, decimales)
                                                esNegativo = true
                                              } else {
                                                importeTexto = formatearMonedaConConversion(0, codigoDivisaMov, simbolo, decimales)
                                                esNegativo = false
                                              }
                                              
                                              // Si es negativo, agregar el signo "-" antes del importe
                                              if (esNegativo) {
                                                importeTexto = `- ${importeTexto}`
                                              }
                                              
                                              // Calcular el ancho mínimo necesario basado en la línea más larga
                                              const longLinea1 = conceptoLinea1.length
                                              const longLinea2 = conceptoLinea2.length
                                              const longImporte = importeTexto.length
                                              const longMaxima = Math.max(longLinea1, longLinea2, longImporte)
                                              
                                              // Calcular ancho: ~6.5px por carácter en text-xs + padding
                                              const anchoMinimo = Math.max(100, Math.min(350, longMaxima * 6.5 + 16))
                                              
                                              return (
                                                <td
                                                  key={`mov-cell-${mov.id_movimiento}-${columnaKey}-${filaIdx}`}
                                                  onClick={() => navegarAMovimientos(fechaCol, bancoCol, categoria.id_categoria, divisaCol, mov.id_cuenta)}
                                                  className={`px-2 py-1 text-xs text-left border-l border-teal-300 bg-slate-50 align-top cursor-pointer hover:bg-slate-100 transition-colors ${
                                                    fechaIdxCol === 0 ? 'border-l-2 border-teal-400' : ''
                                                  } ${fechaIdxCol === fechasCol.length - 1 ? 'border-r-2 border-teal-400' : ''}`}
                                                  style={{ 
                                                    minHeight: '60px', 
                                                    maxHeight: '60px', 
                                                    width: `${anchoMinimo}px`
                                                  }}
                                                  title="Click para ver movimientos"
                                                >
                                                  <div className="flex flex-col h-full justify-between" style={{ height: '100%' }}>
                                                    <div>
                                                      {conceptoLinea1 && (
                                                        <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">
                                                          {conceptoLinea1}
                                                        </div>
                                                      )}
                                                      {conceptoLinea2 && (
                                                        <div className="text-gray-700 leading-tight mb-0.5 whitespace-nowrap">
                                                          {conceptoLinea2}
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div className={`font-semibold leading-tight whitespace-nowrap ${
                                                      esNegativo ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                      {importeTexto}
                                                    </div>
                                                  </div>
                                                </td>
                                              )
                                            }
                                            
                                            return (
                                              <td
                                                key={`mov-empty-${columnaKey}-${filaIdx}`}
                                                className={`px-2 py-2 text-sm border-l border-teal-300 bg-slate-50 ${
                                                  fechaIdxCol === 0 ? 'border-l-2 border-teal-400' : ''
                                                } ${fechaIdxCol === fechasCol.length - 1 ? 'border-r-2 border-teal-400' : ''}`}
                                              />
                                            )
                                          })
                                        })
                                      })
                                    })
                                  })}
                                    </tr>
                                  )
                                })}
                              </>
                            )
                          })()}
                        </>
                      )}
                    </React.Fragment>
                  )
                })}
                
                {/* Fila de Saldo Final (después de todas las categorías) */}
                <tr className="bg-emerald-100 border-t-2 border-b-2 border-emerald-400">
                  <td className="px-4 py-3 text-sm font-bold text-emerald-900 sticky left-0 bg-emerald-100 z-10 border-r-2 border-indigo-600">
                    Saldo Final
                  </td>
                  {divisasUnicas.map((divisa, idx) => {
                    const estaDivisaExpandida = divisasExpandidas.has(divisa)
                    const bancosDivisa = bancosPorDivisa.get(divisa) || []
                    const divisaNormalizada = normalizarCodigoDivisa(divisa)
                    const simbolo = movimientosParaCalcular.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.simbolo_divisa || movimientos.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.simbolo_divisa || '$'
                    const decimales = movimientosParaCalcular.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.decimales_divisa || movimientos.find(m => normalizarCodigoDivisa(m.codigo_divisa) === divisaNormalizada)?.decimales_divisa || 2
                    
                    if (!estaDivisaExpandida) {
                      // Saldo final total por divisa (suma de todos los bancos)
                      const saldoFinalTotal = calcularTotalPorDivisa(divisa)
                      const colorTexto = obtenerColorPorSigno(saldoFinalTotal)
                      
                      return (
                        <td
                          key={`saldo-final-total-divisa-${divisa}`}
                          colSpan={1}
                          className={`px-2 py-2 text-sm text-right font-bold border-l-2 border-indigo-300 bg-emerald-100 ${colorTexto} ${
                            idx === divisasUnicas.length - 1 ? 'border-r-2 border-indigo-300' : ''
                          }`}
                        >
                          {saldoFinalTotal !== 0 ? formatearMonedaConConversion(saldoFinalTotal, divisa, simbolo, decimales) : '-'}
                        </td>
                      )
                    }
                    
                    // Divisa expandida: mostrar bancos
                    return bancosDivisa.map((banco, bancoIdx) => {
                      const key = `${divisa}|${banco}`
                      const estaBancoExpandido = bancosExpandidos.has(key)
                      const años = anosPorBancoDivisa.get(key) || []
                      
                      if (!estaBancoExpandido) {
                        // Saldo final total por banco (saldo acumulado hasta la fecha más reciente)
                        const saldoFinalBanco = calcularSaldoFinalTotalBanco(divisa, banco)
                        const colorTexto = obtenerColorPorSigno(saldoFinalBanco)
                        
                        return (
                          <td
                            key={`saldo-final-total-banco-${key}`}
                            colSpan={1}
                            className={`px-2 py-2 text-sm text-right font-bold border-l border-blue-300 bg-emerald-100 ${colorTexto} ${
                              bancoIdx === 0 ? 'border-l-2 border-blue-400' : ''
                            } ${bancoIdx === bancosDivisa.length - 1 ? 'border-r-2 border-blue-400' : ''}`}
                          >
                            {saldoFinalBanco !== 0 ? formatearMonedaConConversion(saldoFinalBanco, divisa, simbolo, decimales) : '-'}
                          </td>
                        )
                      }
                      
                      // Banco expandido: mostrar años
                      return años.map((año, añoIdx) => {
                        const keyAno = `${key}|${año}`
                        const estaAnoExpandido = anosExpandidos.has(keyAno)
                        const meses = mesesPorAnoBancoDivisa.get(keyAno) || []
                        
                        if (!estaAnoExpandido) {
                          // Saldo final total por año
                          // Ordenar años de forma ascendente para calcular correctamente (el más antiguo primero)
                          const añosOrdenados = [...años].sort((a, b) => a - b)
                          const saldoFinalAno = calcularSaldoFinalPorAno(divisa, banco, año, añosOrdenados)
                          const colorTexto = obtenerColorPorSigno(saldoFinalAno)
                          
                          return (
                            <td
                              key={`saldo-final-total-año-${keyAno}`}
                              colSpan={1}
                              className={`px-2 py-2 text-sm text-right font-bold border-l border-cyan-300 bg-emerald-100 ${colorTexto} ${
                                añoIdx === 0 ? 'border-l-2 border-cyan-400' : ''
                              } ${añoIdx === años.length - 1 ? 'border-r-2 border-cyan-400' : ''}`}
                            >
                              {saldoFinalAno !== 0 ? formatearMonedaConConversion(saldoFinalAno, divisa, simbolo, decimales) : '-'}
                            </td>
                          )
                        }
                        
                        // Año expandido: mostrar meses
                        return meses.map((mes, mesIdx) => {
                          const keyMes = `${keyAno}|${mes}`
                          const estaMesExpandido = mesesExpandidos.has(keyMes)
                          const fechas = fechasPorMesAnoBancoDivisa.get(keyMes) || []
                          
                          if (!estaMesExpandido) {
                            // Saldo final total por mes (saldo inicial + movimientos del mes)
                            const mesesOrdenados = [...meses].sort((a, b) => a - b) // Ascendente para calcular correctamente
                            const saldoFinalMes = calcularSaldoFinalPorMes(divisa, banco, año, mes, mesesOrdenados)
                            const colorTexto = obtenerColorPorSigno(saldoFinalMes)
                            
                            return (
                              <td
                                key={`saldo-final-total-mes-${keyMes}`}
                                colSpan={1}
                                className={`px-2 py-2 text-sm text-right font-bold border-l border-emerald-300 bg-emerald-100 ${colorTexto} ${
                                  mesIdx === 0 ? 'border-l-2 border-emerald-400' : ''
                                } ${mesIdx === meses.length - 1 ? 'border-r-2 border-emerald-400' : ''}`}
                              >
                                {saldoFinalMes !== 0 ? formatearMonedaConConversion(saldoFinalMes, divisa, simbolo, decimales) : '-'}
                              </td>
                            )
                          }
                          
                          // Mes expandido: mostrar fechas (balance acumulado hasta ese día)
                          const fechasAscendentes = [...fechas].sort((a, b) => {
                            const fechaA = new Date(a)
                            const fechaB = new Date(b)
                            return fechaA.getTime() - fechaB.getTime()
                          })
                          
                          return fechas.map((fecha, fechaIdx) => {
                            // Calcular el balance acumulado hasta el final de ese día
                            const saldoFinalAcumulado = calcularTotalAlFinalDelDia(divisa, banco, fecha)
                            const colorTexto = obtenerColorPorSigno(saldoFinalAcumulado)
                            
                            return (
                              <td
                                key={`saldo-final-total-${divisa}-${banco}-${año}-${mes}-${fecha}`}
                                className={`px-2 py-2 text-sm text-right font-bold border-l border-teal-300 bg-emerald-100 ${colorTexto} ${
                                  fechaIdx === 0 ? 'border-l-2 border-teal-400' : ''
                                } ${fechaIdx === fechas.length - 1 ? 'border-r-2 border-teal-400' : ''}`}
                              >
                                {saldoFinalAcumulado !== 0 ? formatearMonedaConConversion(saldoFinalAcumulado, divisa, simbolo, decimales) : '-'}
                              </td>
                            )
                          })
                        })
                      })
                    })
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </main>
  )
}
