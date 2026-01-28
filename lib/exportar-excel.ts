import * as XLSX from 'xlsx'

/**
 * Exporta un array de objetos a Excel
 */
export function exportarAExcel(
  datos: any[],
  nombreArchivo: string,
  nombreHoja: string = 'Datos',
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
      // Si es un número, mantenerlo como número
      if (typeof valor === 'number') {
        return valor
      }
      // Si es un string que parece número, intentar convertirlo
      const numVal = Number(valor)
      if (!isNaN(numVal) && valor.toString().trim() !== '') {
        return numVal
      }
      return String(valor)
    })
  })

  // Crear array de arrays para XLSX
  const datosParaExcel = [encabezados, ...filas]

  // Crear workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(datosParaExcel)

  // Ajustar ancho de columnas
  const colWidths = encabezados.map((_, i) => {
    // Calcular el ancho máximo de la columna
    const maxLength = Math.max(
      encabezados[i]?.length || 10,
      ...filas.map(fila => String(fila[i] || '').length)
    )
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) }
  })
  ws['!cols'] = colWidths

  // Estilo para el encabezado (opcional, requiere xlsx-style)
  // Por ahora solo ajustamos el ancho

  // Agregar hoja al workbook
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja)

  // Descargar archivo
  XLSX.writeFile(wb, nombreArchivo)
}











