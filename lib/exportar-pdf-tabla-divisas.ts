import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatearMoneda, construirCodigoBanco } from './formato-moneda'
import { TotalBancoDia, SaldoDiarioCuenta } from './tipos-divisas-diarias'

interface DatosPorMes {
  mes: string
  nombreMes: string
  divisas: Map<string, any>
  diasDelMes: any[]
}

interface DivisaInfo {
  codigo: string
  nombre: string
  simbolo: string
  decimales: number
}

interface BancoInfo {
  codigo: string
  nombre: string
}

interface OpcionesExportacionPDF {
  datosPorMes: DatosPorMes[]
  divisasUnicas: DivisaInfo[]
  bancosPorDivisa: Map<string, BancoInfo[]>
  expandedMonths: Set<string>
  expandedCurrencies: Set<string>
  divisasEnUSD: Set<string>
  tasasCambio: Map<string, number>
  datos: any[] // Datos originales para calcular USD
  calcularSaldoUSD: (saldoDivisa: number, codigoDivisa: string) => number
}

/**
 * Exporta los datos de TablaDivisasDiarias a PDF con la misma estructura que la tabla web
 * Filas: días/meses, Columnas: divisas (con bancos si están expandidos)
 */
export function exportarTablaDivisasAPDF(
  opciones: OpcionesExportacionPDF,
  nombreArchivo: string = 'balances_southgenetics.pdf'
): void {
  const {
    datosPorMes,
    divisasUnicas,
    bancosPorDivisa,
    expandedMonths,
    expandedCurrencies,
    divisasEnUSD,
    tasasCambio,
    datos,
    calcularSaldoUSD
  } = opciones

  if (datosPorMes.length === 0) {
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

  // Construir encabezados de columnas
  const encabezados: string[] = ['Período']
  
  divisasUnicas.forEach(divisa => {
    const isExpanded = expandedCurrencies.has(divisa.codigo)
    const bancos = bancosPorDivisa.get(divisa.codigo) || []
    const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)
    const simbolo = enUSD ? 'US$' : divisa.simbolo
    
    if (isExpanded && bancos.length > 0) {
      // Agregar columnas para cada banco
      bancos.forEach(banco => {
        encabezados.push(`${banco.nombre} (${simbolo})`)
      })
      // Agregar columna de total de la divisa
      encabezados.push(`Total ${divisa.codigo} (${simbolo})`)
    } else {
      // Agregar solo columna de total de divisa
      encabezados.push(`${divisa.codigo} (${simbolo})`)
    }
  })
  
  // Agregar columna de Total USD
  encabezados.push('Total USD')

  // Construir filas de datos
  const filas: any[][] = []
  
  datosPorMes.forEach(datoMes => {
    const mesExpandido = expandedMonths.has(datoMes.mes)
    
    if (mesExpandido && datoMes.diasDelMes.length > 0) {
      // Si el mes está expandido, agregar filas para cada día
      datoMes.diasDelMes.forEach(datoFecha => {
        const fechaFormateada = new Date(datoFecha.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        
        const fila: any[] = [fechaFormateada]
        
        // Calcular total USD del día
        const totalUSDDia = datos
          .filter((d: SaldoDiarioCuenta) => d.fecha === datoFecha.fecha)
          .reduce((sum: number, d: SaldoDiarioCuenta) => {
            const cuenta = d.cuenta as any
            const codigoDivisa = cuenta?.banco_pais_divisa?.divisa?.codigo_divisa || 'USD'
            return sum + calcularSaldoUSD(d.saldo_divisa, codigoDivisa)
          }, 0)
        
        divisasUnicas.forEach(divisa => {
          const isExpanded = expandedCurrencies.has(divisa.codigo)
          const bancos = bancosPorDivisa.get(divisa.codigo) || []
          const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)
          const divisaData = datoFecha.divisas.get(divisa.codigo)
          
          if (isExpanded && bancos.length > 0) {
            // Agregar valores por banco
            bancos.forEach(banco => {
              const bancoData = divisaData?.bancos.find((b: TotalBancoDia) => b.codigo_banco === banco.codigo)
              const valor = bancoData?.total || 0
              
              // Calcular valor en USD para este banco en este día
              const saldosBancoDia = datos
                .filter((d: SaldoDiarioCuenta) => d.fecha === datoFecha.fecha)
                .filter((d: SaldoDiarioCuenta) => {
                  const cuenta = d.cuenta as any
                  const bancoPaisDivisa = cuenta?.banco_pais_divisa
                  const divisaBanco = bancoPaisDivisa?.divisa?.codigo_divisa
                  const bancoPais = bancoPaisDivisa?.banco_pais
                  const bancoObj = bancoPais?.banco
                  const pais = bancoPais?.pais
                  
                  let tipoCuentaDesc = ''
                  if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
                  else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
                  
                  const codigoBancoActual = construirCodigoBanco(
                    bancoObj?.id_banco || 0,
                    cuenta?.id_tipo_cuenta || 0,
                    pais?.codigo_pais || '',
                    cuenta?.id_cuenta
                  )
                  
                  return divisaBanco === divisa.codigo && codigoBancoActual === banco.codigo
                })
              
              const valorEnUSD = saldosBancoDia.reduce((sum: number, d: SaldoDiarioCuenta) => sum + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0)
              const valorMostrar = enUSD ? valorEnUSD : valor
              
              fila.push(valorMostrar > 0 ? formatearMoneda(valorMostrar, enUSD ? 'US$' : divisa.simbolo, divisa.decimales) : '-')
            })
            
            // Agregar total de la divisa del día
            const totalDivisaDia = divisaData?.total || 0
            const totalUSDDivisaDia = datos
              .filter(d => d.fecha === datoFecha.fecha)
              .filter(d => {
                const cuenta = d.cuenta as any
                return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
              })
              .reduce((s, d) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0)
            
            const totalMostrar = enUSD ? totalUSDDivisaDia : totalDivisaDia
            fila.push(totalMostrar > 0 ? formatearMoneda(totalMostrar, enUSD ? 'US$' : divisa.simbolo, divisa.decimales) : '-')
          } else {
            // Agregar solo total de divisa del día
            const totalDivisaDia = divisaData?.total || 0
            const totalUSDDivisaDia = datos
              .filter(d => d.fecha === datoFecha.fecha)
              .filter(d => {
                const cuenta = d.cuenta as any
                return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
              })
              .reduce((s, d) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0)
            
            const totalMostrar = enUSD ? totalUSDDivisaDia : totalDivisaDia
            fila.push(totalMostrar > 0 ? formatearMoneda(totalMostrar, enUSD ? 'US$' : divisa.simbolo, divisa.decimales) : '-')
          }
        })
        
        // Agregar total USD del día
        fila.push(formatearMoneda(totalUSDDia, 'US$', 2))
        filas.push(fila)
      })
    } else {
      // Si el mes NO está expandido, agregar solo fila del mes
      const fila: any[] = [datoMes.nombreMes]
      
      // Calcular total USD del mes (último día)
      const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
      const totalUSDMes = ultimoDia ? datos
        .filter((d: SaldoDiarioCuenta) => d.fecha === ultimoDia.fecha)
        .reduce((sum: number, d: SaldoDiarioCuenta) => {
          const cuenta = d.cuenta as any
          const codigoDivisa = cuenta?.banco_pais_divisa?.divisa?.codigo_divisa || 'USD'
          return sum + calcularSaldoUSD(d.saldo_divisa, codigoDivisa)
        }, 0) : 0
      
      divisasUnicas.forEach(divisa => {
        const isExpanded = expandedCurrencies.has(divisa.codigo)
        const bancos = bancosPorDivisa.get(divisa.codigo) || []
        const enUSD = divisa.codigo === 'USD' ? true : divisasEnUSD.has(divisa.codigo)
        const divisaData = datoMes.divisas.get(divisa.codigo)
        
        if (isExpanded && bancos.length > 0) {
          // Agregar valores por banco del mes
          bancos.forEach(banco => {
            const bancoData = divisaData?.bancos.find((b: TotalBancoDia) => b.codigo_banco === banco.codigo)
            const valor = bancoData?.total || 0
            
            // Calcular valor en USD para este banco en el último día del mes
            const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
            const saldosBancoMes = ultimoDia ? datos
              .filter((d: SaldoDiarioCuenta) => d.fecha === ultimoDia.fecha)
              .filter((d: SaldoDiarioCuenta) => {
                const cuenta = d.cuenta as any
                const bancoPaisDivisa = cuenta?.banco_pais_divisa
                const divisaBanco = bancoPaisDivisa?.divisa?.codigo_divisa
                const bancoPais = bancoPaisDivisa?.banco_pais
                const bancoObj = bancoPais?.banco
                const pais = bancoPais?.pais
                
                let tipoCuentaDesc = ''
                if (cuenta?.id_tipo_cuenta === 1) tipoCuentaDesc = 'CC'
                else if (cuenta?.id_tipo_cuenta === 2) tipoCuentaDesc = 'CA'
                
                const codigoBancoActual = construirCodigoBanco(
                  bancoObj?.id_banco || 0,
                  cuenta?.id_tipo_cuenta || 0,
                  pais?.codigo_pais || '',
                  cuenta?.id_cuenta
                )
                
                return divisaBanco === divisa.codigo && codigoBancoActual === banco.codigo
              }) : []
            
            const valorEnUSD = saldosBancoMes.reduce((sum: number, d: SaldoDiarioCuenta) => sum + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0)
            const valorMostrar = enUSD ? valorEnUSD : valor
            
            fila.push(valorMostrar > 0 ? formatearMoneda(valorMostrar, enUSD ? 'US$' : divisa.simbolo, divisa.decimales) : '-')
          })
          
          // Agregar total de la divisa del mes
          const totalDivisaMes = divisaData?.total || 0
          const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
          const totalUSDDivisaMes = ultimoDia ? datos
            .filter((d: SaldoDiarioCuenta) => d.fecha === ultimoDia.fecha)
            .filter((d: SaldoDiarioCuenta) => {
              const cuenta = d.cuenta as any
              return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
            })
            .reduce((s: number, d: SaldoDiarioCuenta) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0) : 0
          
          const totalMostrar = enUSD ? totalUSDDivisaMes : totalDivisaMes
          fila.push(totalMostrar > 0 ? formatearMoneda(totalMostrar, enUSD ? 'US$' : divisa.simbolo, divisa.decimales) : '-')
        } else {
          // Agregar solo total de divisa del mes
          const totalDivisaMes = divisaData?.total || 0
          const ultimoDia = datoMes.diasDelMes[datoMes.diasDelMes.length - 1]
          const totalUSDDivisaMes = ultimoDia ? datos
            .filter((d: SaldoDiarioCuenta) => d.fecha === ultimoDia.fecha)
            .filter((d: SaldoDiarioCuenta) => {
              const cuenta = d.cuenta as any
              return cuenta?.banco_pais_divisa?.codigo_divisa === divisa.codigo
            })
            .reduce((s: number, d: SaldoDiarioCuenta) => s + calcularSaldoUSD(d.saldo_divisa, divisa.codigo), 0) : 0
          
          const totalMostrar = enUSD ? totalUSDDivisaMes : totalDivisaMes
          fila.push(totalMostrar > 0 ? formatearMoneda(totalMostrar, enUSD ? 'US$' : divisa.simbolo, divisa.decimales) : '-')
        }
      })
      
      // Agregar total USD del mes
      fila.push(formatearMoneda(totalUSDMes, 'US$', 2))
      filas.push(fila)
    }
  })

  // Calcular anchos de columnas dinámicamente
  const anchosColumnas: number[] = []
  encabezados.forEach((col, index) => {
    if (index === 0) {
      // Primera columna (Período) más ancha
      anchosColumnas.push(30)
    } else {
      // Calcular ancho basado en contenido más largo
      let anchoMaximo = col.length * 1.5
      filas.forEach(fila => {
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

  let fontSize = 8
  if (factorEscala < 1) {
    // Escalar proporcionalmente
    anchosColumnas.forEach((ancho, index) => {
      anchosColumnas[index] = ancho * factorEscala
    })
    // Reducir tamaño de fuente proporcionalmente
    fontSize = Math.max(5, Math.floor(8 * factorEscala))
  }

  // Título del documento
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('SouthGenetics - Balances por Divisa', margenIzquierdo, margenSuperior)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha de exportación: ${new Date().toLocaleDateString('es-ES')}`, margenIzquierdo, margenSuperior + 7)

  // Construir estilos de columnas
  const columnStyles: any = {
    0: { cellWidth: anchosColumnas[0], halign: 'left' } // Período
  }
  
  let colIndex = 1
  divisasUnicas.forEach(divisa => {
    const isExpanded = expandedCurrencies.has(divisa.codigo)
    const bancos = bancosPorDivisa.get(divisa.codigo) || []
    
    if (isExpanded && bancos.length > 0) {
      // Columnas de bancos
      bancos.forEach(() => {
        columnStyles[colIndex] = { cellWidth: anchosColumnas[colIndex] || 30, halign: 'right' }
        colIndex++
      })
      // Columna de total divisa
      columnStyles[colIndex] = { cellWidth: anchosColumnas[colIndex] || 30, halign: 'right', fontStyle: 'bold' }
      colIndex++
    } else {
      // Columna de total divisa
      columnStyles[colIndex] = { cellWidth: anchosColumnas[colIndex] || 30, halign: 'right', fontStyle: 'bold' }
      colIndex++
    }
  })
  
  // Columna Total USD
  columnStyles[colIndex] = { cellWidth: anchosColumnas[colIndex] || 30, halign: 'right', fontStyle: 'bold' }

  // Generar tabla con autoTable
  autoTable(doc, {
    head: [encabezados],
    body: filas,
    startY: margenSuperior + 15,
    margin: { left: margenIzquierdo, right: margenDerecho, top: margenSuperior + 15, bottom: margenInferior },
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
    columnStyles: columnStyles,
    theme: 'striped',
    tableWidth: 'wrap',
    showHead: 'everyPage'
  })

  // Guardar PDF
  doc.save(nombreArchivo)
}
