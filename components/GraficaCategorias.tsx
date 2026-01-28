'use client'

import { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatearMoneda } from '@/lib/formato-moneda'

interface Movimiento {
  categoria_nombre: string
  fecha_mov: string
}

interface GraficaCategoriasProps {
  movimientos: Movimiento[]
}

interface DatosCategoriaUSD {
  categoria: string
  monto_usd: number
  cantidad: number
}

export default function GraficaCategorias({ movimientos }: GraficaCategoriasProps) {
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [datosCategoriasUSD, setDatosCategoriasUSD] = useState<DatosCategoriaUSD[]>([])
  const [loading, setLoading] = useState(false)
  
  console.log('📊 GraficaCategorias renderizado con', movimientos.length, 'movimientos')
  
  // Cargar datos de la vista v_movimientos_categorizados_usd
  useEffect(() => {
    const cargarDatosUSD = async () => {
      try {
        setLoading(true)
        
        // Construir query base
        let query = supabase
          .from('v_movimientos_categorizados_usd')
          .select('categoria, monto_usd, fecha_mov')
        
        // Aplicar filtros de fecha si existen
        if (fechaDesde) {
          query = query.gte('fecha_mov', fechaDesde)
        }
        if (fechaHasta) {
          query = query.lte('fecha_mov', fechaHasta)
        }
        
        const { data, error } = await query
        
        if (error) {
          console.error('Error al cargar datos de categorías USD:', error)
          return
        }
        
        if (data) {
          // Agrupar por categoría y sumar montos USD
          const categoriasMap = new Map<string, { monto_usd: number; cantidad: number }>()
          
          data.forEach((mov: any) => {
            const categoria = mov.categoria || 'Sin categoría'
            // Excluir categorías que contengan "por defecto"
            if (categoria.toLowerCase().includes('por defecto')) {
              return
            }
            
            const montoUSD = mov.monto_usd || 0
            const actual = categoriasMap.get(categoria) || { monto_usd: 0, cantidad: 0 }
            categoriasMap.set(categoria, {
              monto_usd: actual.monto_usd + Number(montoUSD),
              cantidad: actual.cantidad + 1
            })
          })
          
          const datos = Array.from(categoriasMap.entries()).map(([categoria, datos]) => ({
            categoria,
            monto_usd: datos.monto_usd,
            cantidad: datos.cantidad
          }))
          
          // Ordenar por monto USD descendente
          datos.sort((a, b) => b.monto_usd - a.monto_usd)
          
          setDatosCategoriasUSD(datos)
          console.log('✅ Datos de categorías USD cargados:', datos)
        }
      } catch (err) {
        console.error('Error al cargar datos USD:', err)
      } finally {
        setLoading(false)
      }
    }
    
    cargarDatosUSD()
  }, [fechaDesde, fechaHasta])
  
  // Calcular distribución por cantidad de movimientos
  const datosCategoriasCantidad = useMemo(() => {
    // Filtrar movimientos por rango de fechas y excluyendo la categoría "por defecto"
    const movimientosFiltrados = movimientos.filter(mov => {
      // Filtro por fecha
      if (fechaDesde && mov.fecha_mov < fechaDesde) {
        return false
      }
      if (fechaHasta && mov.fecha_mov > fechaHasta) {
        return false
      }
      
      // Excluir categorías que contengan "por defecto" (case-insensitive)
      const categoria = mov.categoria_nombre || 'Sin categoría'
      return !categoria.toLowerCase().includes('por defecto')
    })
    
    const categoriasMap = new Map<string, number>()
    
    movimientosFiltrados.forEach(mov => {
      const categoria = mov.categoria_nombre || 'Sin categoría'
      categoriasMap.set(categoria, (categoriasMap.get(categoria) || 0) + 1)
    })

    const total = movimientosFiltrados.length
    const datos = Array.from(categoriasMap.entries()).map(([nombre, cantidad]) => ({
      name: nombre,
      value: cantidad,
      porcentaje: total > 0 ? ((cantidad / total) * 100).toFixed(1) : '0.0'
    }))

    // Ordenar por cantidad descendente
    return datos.sort((a, b) => b.value - a.value)
  }, [movimientos, fechaDesde, fechaHasta])

  // Calcular distribución por categoría con montos USD
  const datosCategoriasUSDGrafica = useMemo(() => {
    if (datosCategoriasUSD.length === 0) return []
    
    const totalUSD = datosCategoriasUSD.reduce((sum, cat) => sum + cat.monto_usd, 0)
    
    return datosCategoriasUSD.map(cat => ({
      name: cat.categoria,
      value: cat.monto_usd,
      cantidad: cat.cantidad,
      porcentaje: totalUSD !== 0 ? ((cat.monto_usd / totalUSD) * 100).toFixed(1) : '0.0'
    }))
  }, [datosCategoriasUSD])

  // Combinar datos para la tabla (unificar por categoría)
  const datosCombinados = useMemo(() => {
    const mapa = new Map<string, { cantidad: number; montoUSD: number; porcentajeCantidad: string; porcentajeUSD: string }>()
    
    // Agregar datos de cantidad
    datosCategoriasCantidad.forEach(cat => {
      mapa.set(cat.name, {
        cantidad: cat.value,
        montoUSD: 0,
        porcentajeCantidad: cat.porcentaje,
        porcentajeUSD: '0.0'
      })
    })
    
    // Agregar datos de USD
    datosCategoriasUSDGrafica.forEach(cat => {
      const actual = mapa.get(cat.name) || {
        cantidad: 0,
        montoUSD: 0,
        porcentajeCantidad: '0.0',
        porcentajeUSD: '0.0'
      }
      mapa.set(cat.name, {
        ...actual,
        montoUSD: cat.value,
        porcentajeUSD: cat.porcentaje
      })
    })
    
    return Array.from(mapa.entries()).map(([name, datos]) => ({
      name,
      ...datos
    })).sort((a, b) => b.montoUSD - a.montoUSD)
  }, [datosCategoriasCantidad, datosCategoriasUSDGrafica])

  // Calcular totales
  const totales = useMemo(() => {
    const totalCantidad = datosCombinados.reduce((sum, cat) => sum + cat.cantidad, 0)
    const totalMontoUSD = datosCombinados.reduce((sum, cat) => sum + cat.montoUSD, 0)
    return {
      cantidad: totalCantidad,
      montoUSD: totalMontoUSD
    }
  }, [datosCombinados])

  // Colores para las categorías
  const COLORS = [
    '#3b82f6', // azul
    '#10b981', // verde
    '#f59e0b', // amarillo
    '#ef4444', // rojo
    '#8b5cf6', // púrpura
    '#ec4899', // rosa
    '#06b6d4', // cyan
    '#84cc16', // lima
    '#f97316', // naranja
    '#6366f1', // índigo
  ]

  console.log('📈 Datos de categorías para gráfica:', datosCategoriasCantidad, datosCategoriasUSDGrafica)

  if (loading) {
    return <p className="text-gray-500 text-center py-8">Cargando datos...</p>
  }

  if (datosCategoriasCantidad.length === 0 && datosCategoriasUSDGrafica.length === 0) {
    console.log('⚠️ No hay datos de categorías')
    return <p className="text-gray-500 text-center py-8">No hay datos para mostrar</p>
  }

  console.log('✅ Renderizando gráficas con', datosCategoriasCantidad.length, 'categorías (cantidad) y', datosCategoriasUSDGrafica.length, 'categorías (USD)')

  return (
    <div className="w-full">
      {/* Filtro de fechas */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-700">Filtro de fechas:</label>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              style={{ color: '#111827', opacity: 1 }}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              style={{ color: '#111827', opacity: 1 }}
            />
          </div>
          
          {(fechaDesde || fechaHasta) && (
            <button
              onClick={() => {
                setFechaDesde('')
                setFechaHasta('')
              }}
              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            >
              Limpiar filtro
            </button>
          )}
        </div>
        
        {(fechaDesde || fechaHasta) && (
          <div className="mt-2 text-xs text-gray-500">
            Mostrando movimientos desde{' '}
            {fechaDesde ? new Date(fechaDesde).toLocaleDateString('es-ES') : 'inicio'}{' '}
            hasta{' '}
            {fechaHasta ? new Date(fechaHasta).toLocaleDateString('es-ES') : 'fin'}
          </div>
        )}
      </div>
      
      {/* Dos gráficas lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        {/* Gráfica de cantidad de movimientos */}
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            Por Cantidad de Movimientos
          </h3>
          <div style={{ width: '100%', height: '400px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosCategoriasCantidad}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, payload }: any) => `${name}: ${payload?.porcentaje || '0.0'}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {datosCategoriasCantidad.map((entry, index) => (
                    <Cell key={`cell-cantidad-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value} movimientos (${props.payload.porcentaje}%)`,
                    'Cantidad'
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica de monto USD */}
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            Por Monto USD
          </h3>
          <div style={{ width: '100%', height: '400px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosCategoriasUSDGrafica}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, payload }: any) => `${name}: ${payload?.porcentaje || '0.0'}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {datosCategoriasUSDGrafica.map((entry, index) => (
                    <Cell key={`cell-usd-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${formatearMoneda(value, '$', 2)} (${props.payload.porcentaje}%)`,
                    'Monto USD'
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Tabla de resumen */}
      <div className="mt-12">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">Categoría</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 border">Cantidad</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 border">% Cantidad</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 border">Monto USD</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 border">% USD</th>
            </tr>
          </thead>
          <tbody>
            {datosCombinados.map((categoria, index) => {
              // Encontrar el índice del color basado en el nombre de la categoría
              const colorIndex = datosCategoriasCantidad.findIndex(c => c.name === categoria.name)
              const finalColorIndex = colorIndex !== -1 ? colorIndex : index
              
              return (
                <tr key={categoria.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 text-sm text-gray-700 border">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[finalColorIndex % COLORS.length] }}
                      />
                      {categoria.name}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700 border">
                    {categoria.cantidad}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700 font-semibold border">
                    {categoria.porcentajeCantidad}%
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700 font-semibold border">
                    {formatearMoneda(categoria.montoUSD, '$', 2)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700 font-semibold border">
                    {categoria.porcentajeUSD}%
                  </td>
                </tr>
              )
            })}
            {/* Fila de totales */}
            <tr className="bg-gray-200 font-bold">
              <td className="px-4 py-2 text-sm text-gray-900 border">
                TOTAL
              </td>
              <td className="px-4 py-2 text-sm text-right text-gray-900 border">
                {totales.cantidad}
              </td>
              <td className="px-4 py-2 text-sm text-right text-gray-900 border">
                100.0%
              </td>
              <td className="px-4 py-2 text-sm text-right text-gray-900 border">
                {formatearMoneda(totales.montoUSD, '$', 2)}
              </td>
              <td className="px-4 py-2 text-sm text-right text-gray-900 border">
                100.0%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

