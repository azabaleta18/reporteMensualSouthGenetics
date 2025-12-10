'use client'

import { useState, useEffect } from 'react'
import { Divisa, DIVISAS } from '@/lib/types'
import { obtenerTasasCambio, actualizarTasaCambio } from '@/lib/divisas'
import { COLORES_TABLA } from '@/lib/colores'
import { DollarSign, Edit2, Save, X, AlertTriangle } from 'lucide-react'

interface EditorTasasCambioProps {
  onTasasActualizadas?: (tasas: Record<Divisa, number>) => void
}

export default function EditorTasasCambio({ onTasasActualizadas }: EditorTasasCambioProps) {
  const [tasas, setTasas] = useState<Record<Divisa, number>>({} as Record<Divisa, number>)
  const [tasasEditadas, setTasasEditadas] = useState<Record<Divisa, number>>({} as Record<Divisa, number>)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarTasas()
  }, [])

  const cargarTasas = async () => {
    try {
      setLoading(true)
      const tasasData = await obtenerTasasCambio()
      const tasasMap: Record<Divisa, number> = {} as Record<Divisa, number>
      tasasData.forEach(t => {
        tasasMap[t.codigo_divisa as Divisa] = t.unidades_por_usd
      })
      setTasas(tasasMap)
      setTasasEditadas(tasasMap)
    } catch (error) {
      console.error('Error al cargar tasas de cambio:', error)
    } finally {
      setLoading(false)
    }
  }

  const iniciarEdicion = () => {
    setTasasEditadas({ ...tasas })
    setEditando(true)
  }

  const cancelarEdicion = () => {
    setTasasEditadas({ ...tasas })
    setEditando(false)
  }

  const actualizarTasa = (divisa: Divisa, valor: string) => {
    const numValor = parseFloat(valor)
    if (!isNaN(numValor) && numValor > 0) {
      setTasasEditadas(prev => ({
        ...prev,
        [divisa]: numValor
      }))
    }
  }

  const mostrarDialogoConfirmacion = () => {
    setMostrarConfirmacion(true)
  }

  const guardarCambios = async () => {
    try {
      setGuardando(true)
      setMostrarConfirmacion(false)

      // Actualizar cada tasa en la base de datos
      const promesas = Object.entries(tasasEditadas).map(([divisa, tasa]) =>
        actualizarTasaCambio(divisa as Divisa, tasa)
      )

      await Promise.all(promesas)

      // Actualizar el estado local
      setTasas({ ...tasasEditadas })
      setEditando(false)

      // Notificar al componente padre
      if (onTasasActualizadas) {
        onTasasActualizadas(tasasEditadas)
      }

      alert('Tasas de cambio actualizadas correctamente')
    } catch (error) {
      console.error('Error al guardar tasas de cambio:', error)
      alert('Error al guardar las tasas de cambio. Por favor, intenta nuevamente.')
    } finally {
      setGuardando(false)
    }
  }

  const hayCambios = () => {
    return Object.keys(tasasEditadas).some(
      divisa => tasasEditadas[divisa as Divisa] !== tasas[divisa as Divisa]
    )
  }

  if (loading) {
    return (
      <div
        className="p-4 rounded-lg border mb-4"
        style={{
          backgroundColor: COLORES_TABLA.fondoFila,
          borderColor: COLORES_TABLA.bordeGeneral,
        }}
      >
        <p style={{ color: COLORES_TABLA.textoGeneral }}>Cargando tasas de cambio...</p>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div
        className="p-4 rounded-lg border"
        style={{
          backgroundColor: COLORES_TABLA.fondoFila,
          borderColor: COLORES_TABLA.bordeGeneral,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" style={{ color: COLORES_TABLA.textoGeneral }} />
            <h3 className="text-lg font-semibold" style={{ color: COLORES_TABLA.textoGeneral }}>
              Tasas de Cambio (Unidades por USD)
            </h3>
          </div>
          {!editando ? (
            <button
              onClick={iniciarEdicion}
              className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
              style={{
                backgroundColor: COLORES_TABLA.botonSecundario,
                color: COLORES_TABLA.textoGeneral,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario}
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarEdicion}
                disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
                style={{
                  backgroundColor: COLORES_TABLA.botonSecundario,
                  color: COLORES_TABLA.textoGeneral,
                  opacity: guardando ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!guardando) {
                    e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover
                  }
                }}
                onMouseLeave={(e) => {
                  if (!guardando) {
                    e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario
                  }
                }}
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={mostrarDialogoConfirmacion}
                disabled={guardando || !hayCambios()}
                className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
                style={{
                  backgroundColor: hayCambios() && !guardando ? COLORES_TABLA.botonPrincipal : COLORES_TABLA.botonSecundario,
                  color: '#ffffff',
                  opacity: (!hayCambios() || guardando) ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (hayCambios() && !guardando) {
                    e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover
                  }
                }}
                onMouseLeave={(e) => {
                  if (hayCambios() && !guardando) {
                    e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal
                  }
                }}
              >
                <Save className="w-4 h-4" />
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {DIVISAS.map((divisaInfo) => {
            const tasa = editando ? tasasEditadas[divisaInfo.codigo] : tasas[divisaInfo.codigo]
            return (
              <div key={divisaInfo.codigo}>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: COLORES_TABLA.textoGeneral }}
                >
                  {divisaInfo.codigo}
                </label>
                {editando ? (
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={tasa || ''}
                    onChange={(e) => actualizarTasa(divisaInfo.codigo, e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    style={{
                      backgroundColor: COLORES_TABLA.fondoMonto,
                      borderColor: COLORES_TABLA.bordeEncabezado,
                      color: COLORES_TABLA.textoGeneral,
                    }}
                  />
                ) : (
                  <div
                    className="px-3 py-2 border rounded-md text-sm"
                    style={{
                      backgroundColor: COLORES_TABLA.fondoMonto,
                      borderColor: COLORES_TABLA.bordeEncabezado,
                      color: COLORES_TABLA.textoGeneral,
                    }}
                  >
                    {tasa?.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Diálogo de confirmación */}
      {mostrarConfirmacion && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setMostrarConfirmacion(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: COLORES_TABLA.fondoGeneral,
              border: `1px solid ${COLORES_TABLA.bordeGeneral}`,
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: COLORES_TABLA.textoGeneral }}>
                  Confirmar cambios en tasas de cambio
                </h3>
                <p className="text-sm mb-4" style={{ color: COLORES_TABLA.textoGeneral }}>
                  Estás a punto de actualizar las tasas de cambio. Esto afectará todos los cálculos de conversión a USD en la tabla. Los valores representan cuántas unidades de cada moneda equivalen a 1 USD.
                </p>
                <div className="space-y-2 mb-4">
                  {Object.entries(tasasEditadas).map(([divisa, nuevaTasa]) => {
                    const tasaAnterior = tasas[divisa as Divisa]
                    if (nuevaTasa === tasaAnterior) return null
                    return (
                      <div key={divisa} className="text-sm" style={{ color: COLORES_TABLA.textoGeneral }}>
                        <span className="font-medium">{divisa}:</span>{' '}
                        <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                          {tasaAnterior.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </span>
                        {' → '}
                        <span className="font-semibold" style={{ color: COLORES_TABLA.botonPrincipal }}>
                          {nuevaTasa.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setMostrarConfirmacion(false)}
                className="px-4 py-2 rounded-md transition-colors"
                style={{
                  backgroundColor: COLORES_TABLA.botonSecundario,
                  color: COLORES_TABLA.textoGeneral,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonSecundario}
              >
                Cancelar
              </button>
              <button
                onClick={guardarCambios}
                disabled={guardando}
                className="px-4 py-2 rounded-md transition-colors"
                style={{
                  backgroundColor: COLORES_TABLA.botonPrincipal,
                  color: '#ffffff',
                  opacity: guardando ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!guardando) {
                    e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover
                  }
                }}
                onMouseLeave={(e) => {
                  if (!guardando) {
                    e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal
                  }
                }}
              >
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

