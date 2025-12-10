import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface MovimientoExportar {
  Fecha: string
  Banco: string
  'N° Cuenta': string
  Divisa: string
  Categoría: string
  Concepto: string
  Comentarios: string
  Débito: number
  Crédito: number
  'Saldo Posterior': number
  'ID Odoo': string | number | null
}

/**
 * Exporta los movimientos a PDF con ajuste automático de tamaño
 */
export function exportarMovimientosAPDF(
  datos: MovimientoExportar[],
  nombreArchivo: string = 'movimientos_southgenetics.pdf'
): void {
  if (datos.length === 0) {
    alert('No hay datos para exportar')
    return
  }

  // Crear documento en landscape para más espacio horizontal
  const doc = new jsPDF('landscape', 'mm', 'a4')
  
  // Dimensiones de página en landscape A4
  const anchoPagina = 297 // mm
  const altoPagina = 210 // mm
  const margenIzquierdo = 10
  const margenDerecho = 10
  const margenSuperior = 20
  const margenInferior = 15
  const anchoDisponible = anchoPagina - margenIzquierdo - margenDerecho

  // Preparar encabezados
  const encabezados = ['Fecha', 'Banco', 'N° Cuenta', 'Divisa', 'Categoría', 'Concepto', 'Comentarios', 'Débito', 'Crédito', 'Saldo Posterior', 'ID Odoo']
  
  // Preparar filas de datos
  const filas = datos.map(item => [
    item.Fecha || '',
    item.Banco || '',
    item['N° Cuenta'] || '',
    item.Divisa || '',
    item.Categoría || '',
    (item.Concepto || '').substring(0, 30), // Limitar longitud del concepto
    (item.Comentarios || '').substring(0, 30), // Limitar longitud de comentarios
    typeof item.Débito === 'number' ? item.Débito.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(item.Débito || 0),
    typeof item.Crédito === 'number' ? item.Crédito.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(item.Crédito || 0),
    typeof item['Saldo Posterior'] === 'number' ? item['Saldo Posterior'].toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(item['Saldo Posterior'] || 0),
    item['ID Odoo'] ? String(item['ID Odoo']) : ''
  ])

  // Calcular ancho total estimado de las columnas
  const anchosEstimados = [
    25, // Fecha
    35, // Banco
    25, // N° Cuenta
    20, // Divisa
    30, // Categoría
    40, // Concepto
    40, // Comentarios
    30, // Débito
    30, // Crédito
    35, // Saldo Posterior
    25  // ID Odoo
  ]
  const anchoTotalEstimado = anchosEstimados.reduce((sum, ancho) => sum + ancho, 0)

  // Calcular factor de escala si es necesario
  let factorEscala = 1
  let fontSize = 7
  if (anchoTotalEstimado > anchoDisponible) {
    factorEscala = anchoDisponible / anchoTotalEstimado
    // Reducir tamaño de fuente proporcionalmente
    fontSize = Math.max(5, Math.floor(7 * factorEscala))
  }

  // Ajustar anchos de columnas
  const anchosColumnas = anchosEstimados.map(ancho => ancho * factorEscala)

  // Título del documento
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('SouthGenetics - Todos los Movimientos', margenIzquierdo, margenSuperior)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha de exportación: ${new Date().toLocaleDateString('es-ES')}`, margenIzquierdo, margenSuperior + 7)
  doc.text(`Total de movimientos: ${datos.length}`, margenIzquierdo, margenSuperior + 12)

  // Generar tabla con autoTable
  autoTable(doc, {
    head: [encabezados],
    body: filas,
    startY: margenSuperior + 20,
    margin: { left: margenIzquierdo, right: margenDerecho, top: margenSuperior + 20, bottom: margenInferior },
    styles: {
      fontSize: fontSize,
      cellPadding: factorEscala < 0.8 ? 1 : 2,
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    headStyles: {
      fillColor: [22, 101, 52], // Verde oscuro
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: fontSize + 1
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240]
    },
    columnStyles: {
      0: { cellWidth: anchosColumnas[0] }, // Fecha
      1: { cellWidth: anchosColumnas[1] }, // Banco
      2: { cellWidth: anchosColumnas[2] }, // N° Cuenta
      3: { cellWidth: anchosColumnas[3] }, // Divisa
      4: { cellWidth: anchosColumnas[4] }, // Categoría
      5: { cellWidth: anchosColumnas[5] }, // Concepto
      6: { cellWidth: anchosColumnas[6] }, // Comentarios
      7: { cellWidth: anchosColumnas[7], halign: 'right' }, // Débito
      8: { cellWidth: anchosColumnas[8], halign: 'right' }, // Crédito
      9: { cellWidth: anchosColumnas[9], halign: 'right' }, // Saldo Posterior
      10: { cellWidth: anchosColumnas[10], halign: 'center' } // ID Odoo
    },
    theme: 'striped',
    tableWidth: 'wrap',
    showHead: 'everyPage'
  })

  // Guardar PDF
  doc.save(nombreArchivo)
}

