'use client'

import React from 'react'
import { Calendar, Building2, Filter, X, Tag, DollarSign, Briefcase, ChevronDown, ChevronUp, Globe } from 'lucide-react'

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

interface FiltrosTablaDivisasProps {
  divisasDisponibles: Array<{ codigo: string; nombre: string }>
  divisasSeleccionadas: Set<string>
  onToggleDivisa: (codigo: string) => void
  onExpandirTodosMeses: () => void
  onColapsarTodosMeses: () => void
  onExpandirTodasDivisas: () => void
  onColapsarTodasDivisas: () => void
  todosMesesExpandidos: boolean
  todasDivisasExpandidas: boolean
  categorias?: Categoria[]
  categoriasSeleccionadas?: Set<number>
  onToggleCategoria?: (idCategoria: number) => void
  bancos?: Banco[]
  bancosSeleccionados?: Set<number>
  onToggleBanco?: (idBanco: number) => void
  empresas?: Empresa[]
  empresasSeleccionadas?: Set<number>
  onToggleEmpresa?: (idEmpresa: number) => void
  paises?: string[]
  paisesSeleccionados?: Set<string>
  onTogglePais?: (nombrePais: string) => void
  fechaDesde?: string
  fechaHasta?: string
  onFechaDesdeChange?: (fecha: string) => void
  onFechaHastaChange?: (fecha: string) => void
  filtrosVisibles?: boolean
  onToggleFiltrosVisibles?: () => void
  loading?: boolean
  onConvertirTodoAUSD?: () => void
  onVolverTodoAOriginal?: () => void
  todasEnUSD?: boolean
}

export default function FiltrosTablaDivisas({
  divisasDisponibles,
  divisasSeleccionadas,
  onToggleDivisa,
  onExpandirTodosMeses,
  onColapsarTodosMeses,
  onExpandirTodasDivisas,
  onColapsarTodasDivisas,
  todosMesesExpandidos,
  todasDivisasExpandidas,
  categorias = [],
  categoriasSeleccionadas = new Set(),
  onToggleCategoria,
  bancos = [],
  bancosSeleccionados = new Set(),
  onToggleBanco,
  empresas = [],
  empresasSeleccionadas = new Set(),
  onToggleEmpresa,
  paises = [],
  paisesSeleccionados = new Set(),
  onTogglePais,
  fechaDesde = '',
  fechaHasta = '',
  onFechaDesdeChange,
  onFechaHastaChange,
  filtrosVisibles = false,
  onToggleFiltrosVisibles,
  loading = false,
  onConvertirTodoAUSD,
  onVolverTodoAOriginal,
  todasEnUSD = false
}: FiltrosTablaDivisasProps) {
  
  const todasSeleccionadas = divisasSeleccionadas.size === divisasDisponibles.length
  const algunaSeleccionada = divisasSeleccionadas.size > 0

  const toggleTodasDivisas = () => {
    if (todasSeleccionadas) {
      // Deseleccionar todas
      divisasDisponibles.forEach(d => {
        if (divisasSeleccionadas.has(d.codigo)) {
          onToggleDivisa(d.codigo)
        }
      })
    } else {
      // Seleccionar todas
      divisasDisponibles.forEach(d => {
        if (!divisasSeleccionadas.has(d.codigo)) {
          onToggleDivisa(d.codigo)
        }
      })
    }
  }

  const limpiarFiltros = () => {
    if (onToggleCategoria) {
      categoriasSeleccionadas.forEach(catId => {
        onToggleCategoria(catId)
      })
    }
    if (onToggleBanco) {
      bancosSeleccionados.forEach(bancoId => {
        onToggleBanco(bancoId)
      })
    }
    if (onToggleEmpresa) {
      empresasSeleccionadas.forEach(empresaId => {
        onToggleEmpresa(empresaId)
      })
    }
    if (onTogglePais) {
      paisesSeleccionados.forEach(nombrePais => {
        onTogglePais(nombrePais)
      })
    }
    if (onFechaDesdeChange) {
      onFechaDesdeChange('')
    }
    if (onFechaHastaChange) {
      onFechaHastaChange('')
    }
  }

  const tieneFiltrosActivos = categoriasSeleccionadas.size > 0 || 
    bancosSeleccionados.size > 0 || 
    empresasSeleccionadas.size > 0 || 
    paisesSeleccionados.size > 0 ||
    fechaDesde || 
    fechaHasta

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        {onToggleFiltrosVisibles && (
          <button
            onClick={onToggleFiltrosVisibles}
            className="ml-2 p-1 hover:bg-gray-100 rounded-md transition-colors"
            title={filtrosVisibles ? 'Ocultar filtros' : 'Mostrar filtros'}
          >
            {filtrosVisibles ? (
              <ChevronUp className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-600" />
            )}
          </button>
        )}
        <div className="ml-auto flex gap-3 items-center">
          {loading && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Aplicando filtros...</span>
            </div>
          )}
          {tieneFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium text-sm"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Indicador de filtros aplicados */}
      {tieneFiltrosActivos && (
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
            {empresasSeleccionadas.size > 0 && (
              <span className="px-2 py-1 bg-blue-100 rounded">
                {empresasSeleccionadas.size} empresa(s)
              </span>
            )}
            {paisesSeleccionados.size > 0 && (
              <span className="px-2 py-1 bg-blue-100 rounded">
                {paisesSeleccionados.size} país(es)
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

      {/* Filtros - Todos ocultos por defecto */}
      {filtrosVisibles && (
        <div className="space-y-6">
        {/* Filtro de Divisas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Divisas a Mostrar
            </label>
            <button
              onClick={toggleTodasDivisas}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {todasSeleccionadas ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {divisasDisponibles.map(divisa => (
              <label
                key={divisa.codigo}
                className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={divisasSeleccionadas.has(divisa.codigo)}
                  onChange={() => onToggleDivisa(divisa.codigo)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {divisa.codigo}
                </span>
              </label>
            ))}
          </div>

          {!algunaSeleccionada && (
            <p className="text-xs text-orange-600 mt-2">
              ⚠️ Debes seleccionar al menos una divisa
            </p>
          )}
        </div>

        {/* Filtro de Bancos */}
        {bancos.length > 0 && onToggleBanco && (
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
                    onChange={() => onToggleBanco(banco.id_banco)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{banco.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Filtro de Países */}
        {paises.length > 0 && onTogglePais && (
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4" />
              Países
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
              {paises.map(nombrePais => (
                <label
                  key={nombrePais}
                  className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={paisesSeleccionados.has(nombrePais)}
                    onChange={() => onTogglePais(nombrePais)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{nombrePais}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Filtro de Empresas */}
        {empresas.length > 0 && onToggleEmpresa && (
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
                    onChange={() => onToggleEmpresa(empresa.id_empresa)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{empresa.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Filtro de Categorías - Solo mostrar si se pasa onToggleCategoria (para tabla de movimientos) */}
        {categorias.length > 0 && onToggleCategoria && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Categorías de Movimientos
              </label>
              {categoriasSeleccionadas.size > 0 && (
                <button
                  onClick={() => {
                    categoriasSeleccionadas.forEach(catId => {
                      onToggleCategoria(catId)
                    })
                  }}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  Limpiar filtro
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {categorias.map(categoria => (
                <label
                  key={categoria.id_categoria}
                  className="flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={categoriasSeleccionadas.has(categoria.id_categoria)}
                    onChange={() => onToggleCategoria(categoria.id_categoria)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {categoria.nombre}
                  </span>
                </label>
              ))}
            </div>

            {categoriasSeleccionadas.size > 0 && (
              <p className="text-xs text-blue-600 mt-2">
                ℹ️ Mostrando solo saldos con movimientos de {categoriasSeleccionadas.size} categoría(s) seleccionada(s)
              </p>
            )}
          </div>
        )}

          {/* Filtro de Fechas */}
          {onFechaDesdeChange && onFechaHastaChange && (
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
                    onChange={(e) => onFechaDesdeChange(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    style={{ 
                      color: '#111827 !important',
                      WebkitTextFillColor: '#111827',
                      opacity: 1
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Hasta:</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => onFechaHastaChange(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    style={{ 
                      color: '#111827 !important',
                      WebkitTextFillColor: '#111827',
                      opacity: 1
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botones de Expansión - Siempre visibles */}
      <div className="flex flex-wrap gap-3 mt-4">
        {/* Expandir/Colapsar Meses */}
        <button
          onClick={todosMesesExpandidos ? onColapsarTodosMeses : onExpandirTodosMeses}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Calendar className="h-4 w-4" />
          {todosMesesExpandidos ? 'Colapsar Todos los Meses' : 'Expandir Todos los Meses'}
        </button>

        {/* Expandir/Colapsar Divisas */}
        <button
          onClick={todasDivisasExpandidas ? onColapsarTodasDivisas : onExpandirTodasDivisas}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          <Building2 className="h-4 w-4" />
          {todasDivisasExpandidas ? 'Colapsar Todas las Divisas' : 'Expandir Todas las Divisas'}
        </button>

        {/* Convertir Todo a USD */}
        {onConvertirTodoAUSD && onVolverTodoAOriginal && (
          <button
            onClick={todasEnUSD ? onVolverTodoAOriginal : onConvertirTodoAUSD}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            {todasEnUSD ? 'Volver a Monedas Originales' : 'Convertir Todo a USD'}
          </button>
        )}
      </div>
    </div>
  )
}

