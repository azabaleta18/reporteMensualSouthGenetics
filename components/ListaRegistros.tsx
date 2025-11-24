'use client'

import { useEffect, useState } from 'react'
import { RegistroBancario, DIVISAS } from '@/lib/types'
import { obtenerRegistros, eliminarRegistro } from '@/lib/database'
import { Trash2, RefreshCw } from 'lucide-react'

export default function ListaRegistros({ onRegistroEliminado }: { onRegistroEliminado?: () => void }) {
  const [registros, setRegistros] = useState<RegistroBancario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarRegistros()
  }, [])

  const cargarRegistros = async () => {
    try {
      setLoading(true)
      const data = await obtenerRegistros()
      setRegistros(data)
    } catch (error) {
      console.error('Error al cargar registros:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) {
      return
    }

    try {
      await eliminarRegistro(id)
      setRegistros(registros.filter((r) => r.id !== id))
      onRegistroEliminado?.()
    } catch (error) {
      console.error('Error al eliminar registro:', error)
      alert('Error al eliminar el registro')
    }
  }

  const obtenerInfoDivisa = (codigo: string) => {
    return DIVISAS.find((d) => d.codigo === codigo) || {
      codigo: codigo as any,
      nombre: codigo,
      simbolo: '',
    }
  }

  const formatearMonto = (monto: number, simbolo: string) => {
    return `${simbolo} ${monto.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Cargando registros...</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Registros Bancarios</h2>
        <button
          onClick={cargarRegistros}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {registros.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No hay registros bancarios aún. Agrega uno usando el formulario de arriba.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Banco
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Divisa
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Cantidad
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Fecha
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => {
                const infoDivisa = obtenerInfoDivisa(registro.divisa)
                return (
                  <tr
                    key={registro.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {registro.banco}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {infoDivisa.nombre}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-gray-900 dark:text-white">
                      {formatearMonto(registro.cantidad, infoDivisa.simbolo)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {formatearFecha(registro.fecha)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleEliminar(registro.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

