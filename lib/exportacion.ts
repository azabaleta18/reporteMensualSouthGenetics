import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DatosPorFecha } from '@/components/TablaUnificada'
import { DIVISAS, CUENTAS_ORDENADAS, Divisa } from './types'
import { COLORES_TABLA } from './colores'

export interface OpcionesExportacion {
  datos: DatosPorFecha[]
  divisasExpandidas: Record<Divisa, boolean>
  modoResumen: boolean
  todoEnUSD: boolean
  divisasEnUSD: Record<Divisa, boolean>
  tasasCambio: Record<Divisa, number>
  agruparPorMes: boolean
  divisasAMostrar?: Divisa[] // Divisas a mostrar (si está vacío, mostrar todas)
}

function obtenerSimboloDivisa(divisa: Divisa): string {
  const infoDivisa = DIVISAS.find(d => d.codigo === divisa)
  return infoDivisa?.simbolo || ''
}

function convertirAUSD(cantidad: number, divisa: Divisa, tasasCambio: Record<Divisa, number>): number {
  const tasa = tasasCambio[divisa] || 1
  return cantidad * tasa
}

function formatearMonto(valor: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

function formatearFecha(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function exportarCSV(opciones: OpcionesExportacion): void {
  const { datos, divisasExpandidas, modoResumen, todoEnUSD, divisasEnUSD, tasasCambio, divisasAMostrar } = opciones
  
  const filas: string[][] = []
  
  // Determinar qué divisas mostrar
  const divisasParaExportar = divisasAMostrar && divisasAMostrar.length > 0 
    ? DIVISAS.filter(d => divisasAMostrar.includes(d.codigo))
    : DIVISAS
  
  // Encabezado
  const encabezado = ['Fecha']
  divisasParaExportar.forEach((divisaInfo) => {
    const divisa = divisaInfo.codigo
    const expandida = divisasExpandidas[divisa] && !modoResumen
    const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
    const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
    
    if (!expandida) {
      encabezado.push(`${divisa} (${simbolo})`)
    } else {
      const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
      cuentasDivisa.forEach((cuenta) => {
        encabezado.push(`${cuenta.nombreCompleto} (${simbolo})`)
      })
      encabezado.push(`Total ${divisa} (${simbolo})`)
    }
  })
  encabezado.push('Total USD')
  filas.push(encabezado)
  
  // Datos
  datos.forEach((dato) => {
    const fila: string[] = [dato.esAgrupacion ? dato.fecha : formatearFecha(dato.fecha)]
    
    divisasParaExportar.forEach((divisaInfo) => {
      const divisa = divisaInfo.codigo
      const expandida = divisasExpandidas[divisa] && !modoResumen
      const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
      const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
      const totalDivisa = dato.totalesPorDivisa[divisa] || 0
      
      if (!expandida) {
        const valorMostrar = mostrarEnUSD ? convertirAUSD(totalDivisa, divisa, tasasCambio) : totalDivisa
        fila.push(valorMostrar > 0 ? formatearMonto(valorMostrar) : '-')
      } else {
        const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
        cuentasDivisa.forEach((cuenta) => {
          const valorOriginal = dato.valores[cuenta.nombreCompleto] || 0
          const valorMostrar = mostrarEnUSD ? convertirAUSD(valorOriginal, divisa, tasasCambio) : valorOriginal
          fila.push(valorMostrar > 0 ? formatearMonto(valorMostrar) : '-')
        })
        const valorTotal = mostrarEnUSD ? convertirAUSD(totalDivisa, divisa, tasasCambio) : totalDivisa
        fila.push(valorTotal > 0 ? formatearMonto(valorTotal) : '-')
      }
    })
    
    fila.push(formatearMonto(dato.totalUSD))
    filas.push(fila)
  })
  
  // Fila de porcentajes
  if (datos.length > 0) {
    const ultimaFecha = datos.filter(d => !d.esAgrupacion).slice(-1)[0] || datos.slice(-1)[0]
    const totalGeneralUSD = ultimaFecha?.totalUSD || 0
    const filaPorcentajes = ['% del Total USD']
    
    divisasParaExportar.forEach((divisaInfo) => {
      const divisa = divisaInfo.codigo
      const expandida = divisasExpandidas[divisa] && !modoResumen
      const totalDivisaFinal = ultimaFecha?.totalesPorDivisa[divisa] || 0
      const totalDivisaUSD = convertirAUSD(totalDivisaFinal, divisa, tasasCambio)
      const porcentaje = totalGeneralUSD > 0 ? (totalDivisaUSD / totalGeneralUSD) * 100 : 0
      
      if (!expandida) {
        filaPorcentajes.push(porcentaje > 0 ? `${porcentaje.toFixed(2)}%` : '-')
      } else {
        const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
        cuentasDivisa.forEach((cuenta) => {
          const totalCuentaFinal = ultimaFecha?.valores[cuenta.nombreCompleto] || 0
          const totalCuentaUSD = convertirAUSD(totalCuentaFinal, divisa, tasasCambio)
          const porcentajeCuenta = totalGeneralUSD > 0 ? (totalCuentaUSD / totalGeneralUSD) * 100 : 0
          filaPorcentajes.push(porcentajeCuenta > 0 ? `${porcentajeCuenta.toFixed(2)}%` : '0.00%')
        })
        filaPorcentajes.push(porcentaje > 0 ? `${porcentaje.toFixed(2)}%` : '-')
      }
    })
    filaPorcentajes.push(totalGeneralUSD > 0 ? '100.00%' : '-')
    filas.push(filaPorcentajes)
  }
  
  // Convertir a CSV
  const csvContent = filas.map(fila => 
    fila.map(celda => `"${celda}"`).join(',')
  ).join('\n')
  
  // Descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `reporte_southgenetics_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportarExcel(opciones: OpcionesExportacion): void {
  const { datos, divisasExpandidas, modoResumen, todoEnUSD, divisasEnUSD, tasasCambio, divisasAMostrar } = opciones
  
  const filas: any[][] = []
  
  // Determinar qué divisas mostrar
  const divisasParaExportar = divisasAMostrar && divisasAMostrar.length > 0 
    ? DIVISAS.filter(d => divisasAMostrar.includes(d.codigo))
    : DIVISAS
  
  // Encabezado
  const encabezado = ['Fecha']
  divisasParaExportar.forEach((divisaInfo) => {
    const divisa = divisaInfo.codigo
    const expandida = divisasExpandidas[divisa] && !modoResumen
    const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
    const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
    
    if (!expandida) {
      encabezado.push(`${divisa} (${simbolo})`)
    } else {
      const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
      cuentasDivisa.forEach((cuenta) => {
        encabezado.push(`${cuenta.nombreCompleto} (${simbolo})`)
      })
      encabezado.push(`Total ${divisa} (${simbolo})`)
    }
  })
  encabezado.push('Total USD')
  filas.push(encabezado)
  
  // Datos
  datos.forEach((dato) => {
    const fila: any[] = [dato.esAgrupacion ? dato.fecha : formatearFecha(dato.fecha)]
    
    divisasParaExportar.forEach((divisaInfo) => {
      const divisa = divisaInfo.codigo
      const expandida = divisasExpandidas[divisa] && !modoResumen
      const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
      const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
      const totalDivisa = dato.totalesPorDivisa[divisa] || 0
      
      if (!expandida) {
        const valorMostrar = mostrarEnUSD ? convertirAUSD(totalDivisa, divisa, tasasCambio) : totalDivisa
        fila.push(valorMostrar > 0 ? valorMostrar : 0)
      } else {
        const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
        cuentasDivisa.forEach((cuenta) => {
          const valorOriginal = dato.valores[cuenta.nombreCompleto] || 0
          const valorMostrar = mostrarEnUSD ? convertirAUSD(valorOriginal, divisa, tasasCambio) : valorOriginal
          fila.push(valorMostrar > 0 ? valorMostrar : 0)
        })
        const valorTotal = mostrarEnUSD ? convertirAUSD(totalDivisa, divisa, tasasCambio) : totalDivisa
        fila.push(valorTotal > 0 ? valorTotal : 0)
      }
    })
    
    fila.push(dato.totalUSD)
    filas.push(fila)
  })
  
  // Fila de porcentajes
  if (datos.length > 0) {
    const ultimaFecha = datos.filter(d => !d.esAgrupacion).slice(-1)[0] || datos.slice(-1)[0]
    const totalGeneralUSD = ultimaFecha?.totalUSD || 0
    const filaPorcentajes: any[] = ['% del Total USD']
    
    divisasParaExportar.forEach((divisaInfo) => {
      const divisa = divisaInfo.codigo
      const expandida = divisasExpandidas[divisa] && !modoResumen
      const totalDivisaFinal = ultimaFecha?.totalesPorDivisa[divisa] || 0
      const totalDivisaUSD = convertirAUSD(totalDivisaFinal, divisa, tasasCambio)
      const porcentaje = totalGeneralUSD > 0 ? (totalDivisaUSD / totalGeneralUSD) * 100 : 0
      
      if (!expandida) {
        filaPorcentajes.push(porcentaje > 0 ? porcentaje : 0)
      } else {
        const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
        cuentasDivisa.forEach((cuenta) => {
          const totalCuentaFinal = ultimaFecha?.valores[cuenta.nombreCompleto] || 0
          const totalCuentaUSD = convertirAUSD(totalCuentaFinal, divisa, tasasCambio)
          const porcentajeCuenta = totalGeneralUSD > 0 ? (totalCuentaUSD / totalGeneralUSD) * 100 : 0
          filaPorcentajes.push(porcentajeCuenta > 0 ? porcentajeCuenta : 0)
        })
        filaPorcentajes.push(porcentaje > 0 ? porcentaje : 0)
      }
    })
    filaPorcentajes.push(totalGeneralUSD > 0 ? 100 : 0)
    filas.push(filaPorcentajes)
  }
  
  // Crear workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(filas)
  
  // Ajustar ancho de columnas
  const colWidths = encabezado.map((_, i) => ({ wch: i === 0 ? 15 : 18 }))
  ws['!cols'] = colWidths
  
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  XLSX.writeFile(wb, `reporte_southgenetics_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Función auxiliar para convertir color hex a RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [0, 0, 0]
}

// Función para calcular el ancho máximo de columnas que caben en una página
function calcularColumnasPorPagina(
  encabezado: string[],
  anchoDisponible: number,
  anchoMinimoColumna: number = 20
): number {
  // Calcular ancho total estimado
  let anchoTotal = 0
  encabezado.forEach((col, index) => {
    // Primera columna (Fecha) más ancha
    if (index === 0) {
      anchoTotal += 30
    } else {
      // Estimar ancho basado en longitud del texto
      const anchoEstimado = Math.max(col.length * 1.5, anchoMinimoColumna)
      anchoTotal += anchoEstimado
    }
  })
  
  // Si cabe todo, retornar todas las columnas
  if (anchoTotal <= anchoDisponible) {
    return encabezado.length
  }
  
  // Calcular cuántas columnas caben
  let columnas = 1 // Siempre incluir columna de fecha
  let anchoAcumulado = 30 // Ancho de columna fecha
  
  for (let i = 1; i < encabezado.length; i++) {
    const anchoColumna = Math.max(encabezado[i].length * 1.5, anchoMinimoColumna)
    if (anchoAcumulado + anchoColumna <= anchoDisponible) {
      anchoAcumulado += anchoColumna
      columnas++
    } else {
      break
    }
  }
  
  return Math.max(columnas, 2) // Mínimo 2 columnas (Fecha + al menos 1 más)
}

export function exportarPDF(opciones: OpcionesExportacion): void {
  const { datos, divisasExpandidas, modoResumen, todoEnUSD, divisasEnUSD, tasasCambio, divisasAMostrar } = opciones
  
  // Determinar qué divisas mostrar
  const divisasParaExportar = divisasAMostrar && divisasAMostrar.length > 0 
    ? DIVISAS.filter(d => divisasAMostrar.includes(d.codigo))
    : DIVISAS
  
  // Preparar datos para la tabla
  const encabezado: string[] = ['Fecha']
  divisasParaExportar.forEach((divisaInfo) => {
    const divisa = divisaInfo.codigo
    const expandida = divisasExpandidas[divisa] && !modoResumen
    const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
    const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
    
    if (!expandida) {
      encabezado.push(`${divisa} (${simbolo})`)
    } else {
      const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
      cuentasDivisa.forEach((cuenta) => {
        encabezado.push(`${cuenta.nombreCompleto} (${simbolo})`)
      })
      encabezado.push(`Total ${divisa} (${simbolo})`)
    }
  })
  encabezado.push('Total USD')
  
  // Preparar filas de datos
  const filas: any[][] = []
  datos.forEach((dato) => {
    const fila: any[] = [dato.esAgrupacion ? dato.fecha : formatearFecha(dato.fecha)]
    
    divisasParaExportar.forEach((divisaInfo) => {
      const divisa = divisaInfo.codigo
      const expandida = divisasExpandidas[divisa] && !modoResumen
      const mostrarEnUSD = todoEnUSD || divisasEnUSD[divisa]
      const simbolo = mostrarEnUSD ? 'US$' : obtenerSimboloDivisa(divisa)
      const totalDivisa = dato.totalesPorDivisa[divisa] || 0
      
      if (!expandida) {
        const valorMostrar = mostrarEnUSD ? convertirAUSD(totalDivisa, divisa, tasasCambio) : totalDivisa
        fila.push(valorMostrar > 0 ? `${simbolo} ${formatearMonto(valorMostrar)}` : '-')
      } else {
        const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
        cuentasDivisa.forEach((cuenta) => {
          const valorOriginal = dato.valores[cuenta.nombreCompleto] || 0
          const valorMostrar = mostrarEnUSD ? convertirAUSD(valorOriginal, divisa, tasasCambio) : valorOriginal
          fila.push(valorMostrar > 0 ? `${simbolo} ${formatearMonto(valorMostrar)}` : '-')
        })
        const valorTotal = mostrarEnUSD ? convertirAUSD(totalDivisa, divisa, tasasCambio) : totalDivisa
        fila.push(valorTotal > 0 ? `${simbolo} ${formatearMonto(valorTotal)}` : '-')
      }
    })
    
    fila.push(`US$ ${formatearMonto(dato.totalUSD)}`)
    filas.push(fila)
  })
  
  // Fila de porcentajes
  if (datos.length > 0) {
    const ultimaFecha = datos.filter(d => !d.esAgrupacion).slice(-1)[0] || datos.slice(-1)[0]
    const totalGeneralUSD = ultimaFecha?.totalUSD || 0
    const filaPorcentajes = ['% del Total USD']
    
    divisasParaExportar.forEach((divisaInfo) => {
      const divisa = divisaInfo.codigo
      const expandida = divisasExpandidas[divisa] && !modoResumen
      const totalDivisaFinal = ultimaFecha?.totalesPorDivisa[divisa] || 0
      const totalDivisaUSD = convertirAUSD(totalDivisaFinal, divisa, tasasCambio)
      const porcentaje = totalGeneralUSD > 0 ? (totalDivisaUSD / totalGeneralUSD) * 100 : 0
      
      if (!expandida) {
        filaPorcentajes.push(porcentaje > 0 ? `${porcentaje.toFixed(2)}%` : '-')
      } else {
        const cuentasDivisa = CUENTAS_ORDENADAS.filter(c => c.divisa === divisa)
        cuentasDivisa.forEach((cuenta) => {
          const totalCuentaFinal = ultimaFecha?.valores[cuenta.nombreCompleto] || 0
          const totalCuentaUSD = convertirAUSD(totalCuentaFinal, divisa, tasasCambio)
          const porcentajeCuenta = totalGeneralUSD > 0 ? (totalCuentaUSD / totalGeneralUSD) * 100 : 0
          filaPorcentajes.push(porcentajeCuenta > 0 ? `${porcentajeCuenta.toFixed(2)}%` : '0.00%')
        })
        filaPorcentajes.push(porcentaje > 0 ? `${porcentaje.toFixed(2)}%` : '-')
      }
    })
    filaPorcentajes.push(totalGeneralUSD > 0 ? '100.00%' : '-')
    filas.push(filaPorcentajes)
  }
  
  // Crear documento en landscape
  const doc = new jsPDF('landscape', 'mm', 'a4')
  
  // Dimensiones de página en landscape A4
  const anchoPagina = 297 // mm
  const altoPagina = 210 // mm
  const margenIzquierdo = 10
  const margenDerecho = 10
  const margenSuperior = 25
  const margenInferior = 15
  const anchoDisponible = anchoPagina - margenIzquierdo - margenDerecho
  
  // Convertir colores hex a RGB
  const colorFondoEncabezado = hexToRgb(COLORES_TABLA.fondoEncabezado)
  const colorFondoFila = hexToRgb(COLORES_TABLA.fondoFila)
  const colorFondoAgrupacion = hexToRgb(COLORES_TABLA.fondoAgrupacion)
  const colorFondoTotalDivisa = hexToRgb(COLORES_TABLA.fondoTotalDivisa)
  const colorFondoTotalUSD = hexToRgb(COLORES_TABLA.fondoTotalUSD)
  const colorTexto = hexToRgb(COLORES_TABLA.textoGeneral)
  
  // Calcular cuántas columnas caben por página
  const columnasPorPagina = calcularColumnasPorPagina(encabezado, anchoDisponible, 25)
  const totalPaginas = Math.ceil(encabezado.length / columnasPorPagina)
  
  // Generar cada página
  for (let pagina = 0; pagina < totalPaginas; pagina++) {
    if (pagina > 0) {
      doc.addPage()
    }
    
    // Calcular índices de columnas para esta página
    const inicioColumna = pagina * columnasPorPagina
    const finColumna = Math.min(inicioColumna + columnasPorPagina, encabezado.length)
    
    // Encabezado del documento (solo en primera página o si es necesario)
    if (pagina === 0) {
      doc.setFontSize(18)
      doc.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2])
      doc.setFont('helvetica', 'bold')
      doc.text('SouthGenetics – Reporte Mensual de Divisas', margenIzquierdo, margenSuperior - 10)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Fecha de exportación: ${new Date().toLocaleDateString('es-ES')}`, margenIzquierdo, margenSuperior - 5)
      
      if (totalPaginas > 1) {
        doc.setFontSize(9)
        doc.text(`Página ${pagina + 1} de ${totalPaginas}`, anchoPagina - margenDerecho - 20, margenSuperior - 5, { align: 'right' })
      }
    } else {
      // En páginas siguientes, solo mostrar número de página
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Página ${pagina + 1} de ${totalPaginas}`, anchoPagina - margenDerecho - 20, margenSuperior - 5, { align: 'right' })
    }
    
    // Preparar encabezado y filas para esta página
    const encabezadoPagina = encabezado.slice(inicioColumna, finColumna)
    const filasPagina = filas.map(fila => fila.slice(inicioColumna, finColumna))
    
    // Calcular anchos de columna dinámicamente
    const anchosColumnas: number[] = []
    encabezadoPagina.forEach((col, index) => {
      if (index === 0) {
        // Primera columna (Fecha) más ancha
        anchosColumnas.push(30)
      } else {
        // Calcular ancho basado en contenido más largo
        let anchoMaximo = col.length * 1.5
        filasPagina.forEach(fila => {
          if (fila[index]) {
            anchoMaximo = Math.max(anchoMaximo, fila[index].toString().length * 1.2)
          }
        })
        anchosColumnas.push(Math.max(anchoMaximo, 25))
      }
    })
    
    // Ajustar anchos para que quepan en el ancho disponible
    const anchoTotalColumnas = anchosColumnas.reduce((sum, ancho) => sum + ancho, 0)
    const factorEscala = anchoDisponible / anchoTotalColumnas
    
    if (factorEscala < 1) {
      // Escalar proporcionalmente
      anchosColumnas.forEach((ancho, index) => {
        anchosColumnas[index] = ancho * factorEscala
      })
    }
    
    // Función para determinar el estilo de una fila
    const obtenerEstiloFila = (rowIndex: number, data: any[][]) => {
      const fila = data[rowIndex]
      const primeraCelda = fila[0]
      
      // Fila de porcentajes (última fila)
      if (rowIndex === data.length - 1 && primeraCelda === '% del Total USD') {
        return {
          fillColor: colorFondoTotalDivisa,
          textColor: colorTexto,
          fontStyle: 'bold' as const
        }
      }
      
      // Fila de agrupación (mes)
      if (typeof primeraCelda === 'string' && primeraCelda.toLowerCase().includes('de 202')) {
        return {
          fillColor: colorFondoAgrupacion,
          textColor: colorTexto,
          fontStyle: 'bold' as const
        }
      }
      
      // Filas normales alternadas
      return {
        fillColor: rowIndex % 2 === 0 ? colorFondoFila : [255, 255, 255],
        textColor: colorTexto,
        fontStyle: 'normal' as const
      }
    }
    
    // Agregar tabla con autoTable
    autoTable(doc, {
      head: [encabezadoPagina],
      body: filasPagina,
      startY: margenSuperior,
      styles: {
        fontSize: factorEscala < 0.8 ? 6 : factorEscala < 0.9 ? 7 : 8,
        cellPadding: factorEscala < 0.8 ? 1 : 2,
        overflow: 'linebreak' as const,
        cellWidth: 'wrap' as const,
        halign: 'left' as const,
      },
      headStyles: {
        fillColor: colorFondoEncabezado,
        textColor: colorTexto,
        fontStyle: 'bold' as const,
        halign: 'center' as const,
      },
      columnStyles: {
        0: { halign: 'left' as const, cellWidth: anchosColumnas[0] || 30 }, // Fecha
        ...Object.fromEntries(
          anchosColumnas.slice(1).map((ancho, index) => [
            index + 1,
            {
              halign: 'right' as const,
              cellWidth: ancho
            }
          ])
        )
      },
      didParseCell: (data: any) => {
        // Aplicar estilos personalizados por fila
        if (data.section === 'body') {
          const estilo = obtenerEstiloFila(data.row.index, filasPagina)
          data.cell.styles.fillColor = estilo.fillColor
          data.cell.styles.textColor = estilo.textColor
          data.cell.styles.fontStyle = estilo.fontStyle
          
          // Alinear números a la derecha (excepto primera columna y fila de porcentajes)
          if (data.column.index > 0 && data.row.index < filasPagina.length - 1) {
            data.cell.styles.halign = 'right'
          }
          
          // Columna Total USD siempre a la derecha
          if (data.column.index === encabezadoPagina.length - 1) {
            data.cell.styles.halign = 'right'
            data.cell.styles.fillColor = colorFondoTotalUSD
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
      margin: {
        top: margenSuperior,
        left: margenIzquierdo,
        right: margenDerecho,
        bottom: margenInferior
      },
      tableWidth: 'auto' as const,
      showHead: 'everyPage' as const, // Repetir encabezado en cada página
    })
  }
  
  // Guardar PDF
  doc.save(`reporte_southgenetics_${new Date().toISOString().split('T')[0]}.pdf`)
}

