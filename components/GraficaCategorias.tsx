'use client'

import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Calendar } from 'lucide-react'

interface Movimiento {
  categoria_nombre: string
  fecha_mov: string
}

interface GraficaCategoriasProps {
  movimientos: Movimiento[]
}

export default function GraficaCategorias({ movimientos }: GraficaCategoriasProps) {
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  
  console.log('📊 GraficaCategorias renderizado con', movimientos.length, 'movimientos')
  
  // Calcular distribución por categoría (excluyendo "por defecto")
  const datosCategorias = useMemo(() => {
    console.log('🔍 Calculando datos de categorías...')
    const categoriasMap = new Map<string, number>()
    
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
    const datosOrdenados = datos.sort((a, b) => b.value - a.value)
    console.log('✅ Datos de categorías calculados (excluyendo "por defecto"):', datosOrdenados)
    return datosOrdenados
  }, [movimientos, fechaDesde, fechaHasta])

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

  console.log('📈 Datos de categorías para gráfica:', datosCategorias)

  if (datosCategorias.length === 0) {
    console.log('⚠️ No hay datos de categorías')
    return <p className="text-gray-500 text-center py-8">No hay datos para mostrar</p>
  }

  console.log('✅ Renderizando gráfica con', datosCategorias.length, 'categorías')

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
      
      <div style={{ width: '100%', height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datosCategorias}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, payload }: any) => `${name}: ${payload?.porcentaje || '0.0'}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {datosCategorias.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number, name: string, props: any) => [
                `${value} movimientos (${props.payload.porcentaje}%)`,
                'Cantidad'
              ]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry: any) => `${value} (${entry.payload.porcentaje}%)`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Tabla de resumen */}
      <div className="mt-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">Categoría</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 border">Cantidad</th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 border">Porcentaje</th>
            </tr>
          </thead>
          <tbody>
            {datosCategorias.map((categoria, index) => (
              <tr key={categoria.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 text-sm text-gray-700 border">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {categoria.name}
                  </div>
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-700 border">
                  {categoria.value}
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-700 font-semibold border">
                  {categoria.porcentaje}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

