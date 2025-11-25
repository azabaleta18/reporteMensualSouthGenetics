'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react'
import { COLORES_TABLA } from '@/lib/colores'
import { exportarCSV, exportarExcel, exportarPDF } from '@/lib/exportacion'
import { OpcionesExportacion } from '@/lib/exportacion'

interface BotonExportarProps {
  opciones: OpcionesExportacion
}

export default function BotonExportar({ opciones }: BotonExportarProps) {
  const [mostrarMenu, setMostrarMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleExportar = (formato: 'csv' | 'excel' | 'pdf') => {
    try {
      switch (formato) {
        case 'csv':
          exportarCSV(opciones)
          break
        case 'excel':
          exportarExcel(opciones)
          break
        case 'pdf':
          exportarPDF(opciones)
          break
      }
      setMostrarMenu(false)
    } catch (error) {
      console.error('Error al exportar:', error)
      alert('Error al exportar el reporte. Por favor, intenta nuevamente.')
    }
  }

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMostrarMenu(false)
      }
    }

    if (mostrarMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mostrarMenu])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMostrarMenu(!mostrarMenu)}
        className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
        style={{
          backgroundColor: COLORES_TABLA.botonPrincipal,
          color: '#ffffff',
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonHover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORES_TABLA.botonPrincipal}
      >
        <Download className="w-4 h-4" />
        Exportar Reporte
      </button>

      {mostrarMenu && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-md shadow-lg z-50 border"
          style={{
            backgroundColor: COLORES_TABLA.fondoMonto,
            borderColor: COLORES_TABLA.bordeGeneral,
          }}
        >
          <div className="py-1">
            <button
              onClick={() => handleExportar('csv')}
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{ color: COLORES_TABLA.textoGeneral }}
            >
              <FileText className="w-4 h-4" />
              Exportar como CSV
            </button>
            <button
              onClick={() => handleExportar('excel')}
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{ color: COLORES_TABLA.textoGeneral }}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar como Excel
            </button>
            <button
              onClick={() => handleExportar('pdf')}
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{ color: COLORES_TABLA.textoGeneral }}
            >
              <File className="w-4 h-4" />
              Exportar como PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

