'use client'

import { useState } from 'react'
import { Divisa, DIVISAS } from '@/lib/types'
import { crearRegistro } from '@/lib/database'
import { Plus } from 'lucide-react'

interface FormularioRegistroProps {
  onRegistroCreado: () => void
}

export default function FormularioRegistro({ onRegistroCreado }: FormularioRegistroProps) {
  const [banco, setBanco] = useState('')
  const [divisa, setDivisa] = useState<Divisa>('USD')
  const [cantidad, setCantidad] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!banco.trim()) {
      setError('El nombre del banco es requerido')
      return
    }

    const cantidadNum = parseFloat(cantidad)
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      setError('La cantidad debe ser un número positivo')
      return
    }

    try {
      setLoading(true)
      await crearRegistro({
        banco: banco.trim(),
        divisa,
        cantidad: cantidadNum,
        fecha,
      })
      
      // Resetear formulario
      setBanco('')
      setCantidad('')
      setFecha(new Date().toISOString().split('T')[0])
      onRegistroCreado()
    } catch (err) {
      setError('Error al crear el registro. Por favor, intenta nuevamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5" />
        Nuevo Registro Bancario
      </h2>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="banco" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Banco
          </label>
          <input
            type="text"
            id="banco"
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Nombre del banco"
            required
          />
        </div>

        <div>
          <label htmlFor="divisa" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Divisa
          </label>
          <select
            id="divisa"
            value={divisa}
            onChange={(e) => setDivisa(e.target.value as Divisa)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {DIVISAS.map((d) => (
              <option key={d.codigo} value={d.codigo}>
                {d.nombre} ({d.codigo})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cantidad" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cantidad
          </label>
          <input
            type="number"
            id="cantidad"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fecha
          </label>
          <input
            type="date"
            id="fecha"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-gray-900"
            style={{ color: '#111827', opacity: 1 }}
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Guardando...' : 'Guardar Registro'}
      </button>
    </form>
  )
}

