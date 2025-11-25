'use client'

import { useState } from 'react'
import { FiltrosReporte, FILTROS_INICIALES } from '@/lib/filtros'
import { DIVISAS, Divisa } from '@/lib/types'
import { COLORES_TABLA } from '@/lib/colores'
import { Filter, X, Calendar, ChevronRight, ChevronDown } from 'lucide-react'

interface PanelFiltrosProps {
  filtros: FiltrosReporte
  onFiltrosChange: (filtros: FiltrosReporte) => void
}

export default function PanelFiltros({ filtros, onFiltrosChange }: PanelFiltrosProps) {
  const [mostrarPanel, setMostrarPanel] = useState(false)

  const actualizarFiltro = (campo: keyof FiltrosReporte, valor: any) => {
    onFiltrosChange({
      ...filtros,
      [campo]: valor,
    })
  }

  const limpiarFiltros = () => {
    onFiltrosChange(FILTROS_INICIALES)
  }

  const tieneFiltrosActivos = 
    filtros.fechaDesde !== null ||
    filtros.fechaHasta !== null ||
    filtros.divisas.length > 0

  const toggleDivisa = (divisa: Divisa) => {
    const nuevasDivisas = filtros.divisas.includes(divisa)
      ? filtros.divisas.filter(d => d !== divisa)
      : [...filtros.divisas, divisa]
    actualizarFiltro('divisas', nuevasDivisas)
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setMostrarPanel(!mostrarPanel)}
        className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors mb-2"
        style={{
          backgroundColor: COLORES_TABLA.botonSecundario,
          color: COLORES_TABLA.textoGeneral,
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario}
      >
        <Filter className="w-4 h-4" />
        Filtros {tieneFiltrosActivos && `(${[
          filtros.fechaDesde !== null ? 1 : 0,
          filtros.fechaHasta !== null ? 1 : 0,
          filtros.divisas.length > 0 ? 1 : 0
        ].reduce((a, b) => a + b, 0)})`}
        {mostrarPanel ? (
          <ChevronDown className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronRight className="w-4 h-4 ml-auto" />
        )}
      </button>

      {mostrarPanel && (
        <div
          className="p-4 rounded-lg border mb-4"
          style={{
            backgroundColor: COLORES_TABLA.fondoFila,
            borderColor: COLORES_TABLA.bordeGeneral,
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro de fecha desde */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha desde
              </label>
              <input
                type="date"
                value={filtros.fechaDesde || ''}
                onChange={(e) => actualizarFiltro('fechaDesde', e.target.value || null)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{
                  backgroundColor: COLORES_TABLA.fondoMonto,
                  borderColor: COLORES_TABLA.bordeEncabezado,
                  color: COLORES_TABLA.textoGeneral,
                }}
              />
            </div>

            {/* Filtro de fecha hasta */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha hasta
              </label>
              <input
                type="date"
                value={filtros.fechaHasta || ''}
                onChange={(e) => actualizarFiltro('fechaHasta', e.target.value || null)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                style={{
                  backgroundColor: COLORES_TABLA.fondoMonto,
                  borderColor: COLORES_TABLA.bordeEncabezado,
                  color: COLORES_TABLA.textoGeneral,
                }}
              />
            </div>

            {/* Filtro de divisas (múltiple) */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
                Monedas a mostrar
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 p-3 rounded-md border" style={{ backgroundColor: COLORES_TABLA.fondoMonto, borderColor: COLORES_TABLA.bordeEncabezado }}>
                {DIVISAS.map((divisaInfo) => {
                  const estaSeleccionada = filtros.divisas.includes(divisaInfo.codigo)
                  return (
                    <label
                      key={divisaInfo.codigo}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      style={{ color: COLORES_TABLA.textoGeneral }}
                    >
                      <input
                        type="checkbox"
                        checked={estaSeleccionada}
                        onChange={() => toggleDivisa(divisaInfo.codigo)}
                        className="w-4 h-4"
                        style={{ accentColor: COLORES_TABLA.botonPrincipal }}
                      />
                      <span>{divisaInfo.codigo}</span>
                    </label>
                  )
                })}
              </div>
              {filtros.divisas.length === 0 && (
                <p className="text-xs mt-1" style={{ color: COLORES_TABLA.textoGeneral, opacity: 0.7 }}>
                  Si no seleccionas ninguna, se mostrarán todas las monedas
                </p>
              )}
            </div>

          </div>

          {/* Botón limpiar filtros */}
          {tieneFiltrosActivos && (
            <div className="mt-4">
              <button
                onClick={limpiarFiltros}
                className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
                style={{
                  backgroundColor: COLORES_TABLA.botonSecundario,
                  color: COLORES_TABLA.textoGeneral,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario}
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

