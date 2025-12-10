'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
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

export default function MovimientosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nombresCategorias, setNombresCategorias] = useState<Map<number, string>>(new Map())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    console.log('🔧 Componente montado, estableciendo mounted = true')
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log('📊 Estado de movimientos:', {
      cantidad: movimientos.length,
      mounted: mounted,
      deberiaMostrarGrafica: movimientos.length > 0 && mounted
    })
  }, [movimientos.length, mounted])

  // Leer parámetros de la URL
  const fecha = searchParams.get('fecha')
  const mes = searchParams.get('mes')
  const cuentaId = searchParams.get('cuentaId')
  const bancoId = searchParams.get('bancoId') // Mantener compatibilidad con URLs antiguas
  const codigoDivisa = searchParams.get('codigoDivisa')
  const bancoNombre = searchParams.get('bancoNombre')
  const categoriasParam = searchParams.get('categorias') // IDs de categorías separados por coma

  // Parsear categorías de la URL
  const categoriasSeleccionadas = useMemo(() => {
    if (!categoriasParam) return []
    return categoriasParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
  }, [categoriasParam])

  useEffect(() => {
    console.log('📋 Página de Movimientos - Parámetros recibidos:', {
      fecha,
      mes,
      cuentaId,
      bancoId,
      codigoDivisa,
      bancoNombre,
      categorias: categoriasSeleccionadas
    })

    // Priorizar cuentaId sobre bancoId (nuevo vs antiguo)
    const idParaFiltrar = cuentaId || bancoId

    if (!idParaFiltrar || !codigoDivisa) {
      setError('Faltan parámetros requeridos (cuentaId o bancoId, codigoDivisa)')
      setLoading(false)
      return
    }

    if (categoriasSeleccionadas.length > 0) {
      cargarNombresCategorias()
    }
    cargarMovimientos()
  }, [fecha, mes, cuentaId, bancoId, codigoDivisa, categoriasSeleccionadas])

  const cargarNombresCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categoria_movimiento')
        .select('id_categoria, nombre')
        .in('id_categoria', categoriasSeleccionadas)

      if (error) {
        console.error('Error al cargar nombres de categorías:', error)
        return
      }

      if (data) {
        const mapa = new Map<number, string>()
        data.forEach(cat => {
          mapa.set(cat.id_categoria, cat.nombre)
        })
        setNombresCategorias(mapa)
      }
    } catch (err: any) {
      console.error('Error al cargar nombres de categorías:', err)
    }
  }

  const cargarMovimientos = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Cargando movimientos con paginación...')

      // Cargar movimientos con paginación (similar a saldo_diario_cuenta)
      let todosLosMovimientos: any[] = []
      let desde = 0
      const tamañoPagina = 1000
      let hayMasDatos = true

      while (hayMasDatos) {
        console.log(`   📄 Cargando página desde registro ${desde}...`)

        // Priorizar cuentaId sobre bancoId (nuevo vs antiguo)
        const idParaFiltrar = cuentaId || bancoId

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
            id_cuenta,
            id_categoria,
            cuenta (
              id_cuenta,
              numero_cuenta,
              banco_pais_divisa (
                codigo_divisa,
                divisa (
                  codigo_divisa,
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

        // Filtrar por categorías si hay alguna seleccionada
        if (categoriasSeleccionadas.length > 0) {
          query = query.in('id_categoria', categoriasSeleccionadas)
          console.log(`   🏷️ Filtrando por categorías: ${categoriasSeleccionadas.join(', ')}`)
        }

        // Filtrar por cuenta (preferido) o banco
        if (cuentaId) {
          // Filtrar directamente por id_cuenta (más específico y eficiente)
          query = query.eq('id_cuenta', parseInt(cuentaId))
          console.log(`   🏦 Filtrando por cuenta: ${cuentaId}`)
        } else if (bancoId) {
          // Filtrar por banco (compatibilidad con URLs antiguas)
          // Nota: Esto requiere filtrar en el cliente después
          console.log(`   🏦 Filtrando por banco: ${bancoId} (se filtrará en cliente)`)
        }

        // Si es un mes completo, filtrar por rango de fechas
        if (mes) {
          const [anio, mesNum] = mes.split('-')
          const fechaInicio = `${anio}-${mesNum}-01`
          const ultimoDia = new Date(parseInt(anio), parseInt(mesNum), 0).getDate()
          const fechaFin = `${anio}-${mesNum}-${ultimoDia.toString().padStart(2, '0')}`
          
          query = query.gte('fecha_mov', fechaInicio).lte('fecha_mov', fechaFin)
          console.log(`   📅 Filtrando por mes: ${fechaInicio} a ${fechaFin}`)
        } else if (fecha) {
          // Filtrar por fecha específica
          query = query.eq('fecha_mov', fecha)
          console.log(`   📅 Filtrando por fecha: ${fecha}`)
        } else {
          // Sin filtro de fecha: mostrar todos los movimientos de la cuenta/banco
          console.log(`   📅 Sin filtro de fecha: mostrando todos los movimientos`)
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
          console.log(`   ✅ Cargados ${movimientosPagina.length} registros (Total acumulado: ${todosLosMovimientos.length})`)
          
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

      // Si ya filtramos por cuentaId en Supabase, solo necesitamos verificar la divisa
      // Si usamos bancoId, necesitamos filtrar por banco y divisa en el cliente
      const movimientosFiltrados = todosLosMovimientos
        .filter(m => {
          const cuenta = m.cuenta as any
          const bancoPaisDivisa = cuenta?.banco_pais_divisa
          const divisa = bancoPaisDivisa?.divisa?.codigo_divisa
          
          // Si ya filtramos por cuentaId en Supabase, solo verificar divisa
          if (cuentaId) {
            return divisa === codigoDivisa
          }
          
          // Si usamos bancoId (compatibilidad con URLs antiguas), filtrar por banco y divisa
          if (bancoId) {
            const banco = bancoPaisDivisa?.banco_pais?.banco
            return banco?.id_banco === parseInt(bancoId) && divisa === codigoDivisa
          }
          
          return false
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
  }

  const formatearMoneda = (valor: number | null, simbolo: string, decimales: number): string => {
    if (valor === null) return '-'
    const valorFormateado = valor.toLocaleString('es-ES', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    return `${simbolo}\u00A0${valorFormateado}`
  }

  if (loading) {
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

  const primerMovimiento = movimientos[0]

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <button
            onClick={() => window.close()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Cerrar
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Movimientos Detallados
          </h1>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Banco:</strong> {bancoNombre || primerMovimiento?.nombre_banco}</p>
            <p><strong>Divisa:</strong> {codigoDivisa}</p>
            {mes ? (
              <p><strong>Período:</strong> {new Date(mes + '-01T00:00:00').toLocaleDateString('es-ES', {
                month: 'long',
                year: 'numeric'
              })}</p>
            ) : fecha ? (
              <p><strong>Fecha:</strong> {new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}</p>
            ) : (
              <p><strong>Período:</strong> Todos los movimientos</p>
            )}
            {categoriasSeleccionadas.length > 0 && (
              <p>
                <strong>Categorías:</strong>{' '}
                {categoriasSeleccionadas
                  .map(id => nombresCategorias.get(id) || `Categoría ${id}`)
                  .join(', ')}
              </p>
            )}
            <p><strong>Total movimientos:</strong> {movimientos.length}</p>
          </div>
        </div>

        {/* Tabla de movimientos */}
        {movimientos.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-yellow-900 font-semibold mb-1">Sin movimientos</h3>
                <p className="text-yellow-700 text-sm">
                  No se encontraron movimientos para este día y banco.
                </p>
              </div>
            </div>
          </div>
        ) : (
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
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Cuenta</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Concepto</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comentario</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Categoría</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Débito</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Crédito</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Saldo Posterior</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">ID Odoo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov, idx) => (
                    <tr
                      key={mov.id_movimiento}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {new Date(mov.fecha_mov + 'T00:00:00').toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {mov.numero_cuenta}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {mov.concepto}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {mov.comentarios || ''}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {mov.categoria_nombre}
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
          </div>
        )}

        {/* Gráfica circular de categorías */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Distribución de Movimientos por Categoría
          </h2>
          {movimientos.length > 0 ? (
            <GraficaCategorias movimientos={movimientos} />
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay movimientos para mostrar en la gráfica
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

