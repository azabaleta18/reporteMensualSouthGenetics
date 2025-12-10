// Utilidades para exportar datos a CSV

/**
 * Exporta un array de objetos a CSV
 */
export function exportarACSV(
  datos: any[],
  nombreArchivo: string,
  mapeoColumnas?: { [key: string]: string } // Mapeo de claves a nombres de columnas
): void {
  if (datos.length === 0) {
    alert('No hay datos para exportar')
    return
  }

  // Obtener todas las claves únicas de todos los objetos
  const todasLasClaves = new Set<string>()
  datos.forEach(item => {
    Object.keys(item).forEach(key => todasLasClaves.add(key))
  })

  // Determinar las columnas a exportar
  const columnas = Array.from(todasLasClaves)

  // Crear encabezados
  const encabezados = columnas.map(col => mapeoColumnas?.[col] || col)

  // Crear filas de datos
  const filas = datos.map(item => {
    return columnas.map(col => {
      const valor = item[col]
      if (valor === null || valor === undefined) {
        return ''
      }
      // Convertir a string y escapar comillas
      return String(valor).replace(/"/g, '""')
    })
  })

  // Construir contenido CSV
  const contenido = [
    encabezados.map(h => `"${h}"`).join(','),
    ...filas.map(fila => fila.map(celda => `"${celda}"`).join(','))
  ].join('\n')

  // Crear blob y descargar
  // Usar UTF-8 sin BOM para CSV puro (el BOM hace que Excel lo abra como Excel)
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  // Asegurar que la extensión sea .csv
  const nombreArchivoFinal = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`
  link.setAttribute('download', nombreArchivoFinal)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}




