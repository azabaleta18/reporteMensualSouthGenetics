// ============================================
// CONFIGURACIÓN DE COLORES DE LA TABLA
// ============================================
// Ajusta estos colores según tus preferencias
// Todos los colores de la aplicación están centralizados aquí

export const COLORES_TABLA = {
  // Fondos principales
  fondoGeneral: '#ffffff',           // Fondo general de la tabla y página (blanco)
  fondoFila: '#d0fdd7',               // Fondo de todas las filas de días
  fondoEncabezado: '#9bfab0',        // Fondo de encabezados
  fondoEncabezadoAlterno: '#bbfcc5', // Fondo alterno para encabezados de divisas (segunda divisa, cuarta, etc.)
  fondoAgrupacion: '#9bfab0',        // Fondo de filas de agrupación por mes
  
  // Fondos de celdas con montos
  fondoMonto: '#ffffff',              // Fondo blanco para celdas con números de dinero
  
  // Fondos de totales
  fondoTotalDivisa: '#9bfab0',        // Fondo para encabezados y porcentajes de totales por divisa
  fondoTotalDivisaNumeros: '#d0fdd7', // Fondo para números en columnas de totales por divisa
  fondoTotalUSD: '#9bfab0',           // Fondo para encabezado y porcentaje de columna Total USD
  fondoTotalUSDNumeros: '#34e06d',    // Fondo para números en columna Total USD
  fondoTotalFila: '#d0fdd7',          // Fondo de la fila TOTAL completa
  fondoTotalBancos: '#d0fdd7',        // Fondo de totales de bancos individuales en fila TOTAL
  
  // Fondos de porcentajes
  fondoPorcentajeTotal: '#9bfab0',    // Fondo de porcentajes totales por divisa
  fondoPorcentajeBancos: '#9bfab0',   // Fondo de porcentajes de bancos individuales
  
  // Colores de texto
  textoGeneral: '#166534',            // Texto general (verde oscuro)
  textoMonto: '#166534',              // Texto en celdas con montos
  textoTotal: '#166534',              // Texto en celdas de totales
  
  // Bordes
  bordeGeneral: '#9bfab0',            // Bordes generales
  bordeEncabezado: '#86efac',         // Bordes de encabezados
  bordeTotal: '#16a34a',              // Bordes de filas de totales
  
  // Botones
  botonPrincipal: '#22c55e',          // Fondo de botones principales
  botonHover: '#16a34a',              // Fondo de botones al hacer hover
  botonSecundario: '#86efac',         // Fondo de botones secundarios
  botonTransparente: 'transparent',   // Fondo transparente para botones
  botonPrincipalHover: '#22c55e80',   // Fondo de botones principales con opacidad (hover)
  botonSecundarioHover: '#86efac40',  // Fondo de botones secundarios con opacidad (hover)
  
  // Scrollbar
  scrollbarTrack: '#d0fdd7',          // Fondo del track del scrollbar
  scrollbarThumb: '#86efac',          // Fondo del thumb del scrollbar
  scrollbarThumbHover: '#22c55e',     // Fondo del thumb del scrollbar al hacer hover
  scrollbarDarkTrack: '#e2e8f0',      // Fondo del track del scrollbar en modo dark
  scrollbarDarkThumb: '#cbd5e1',      // Fondo del thumb del scrollbar en modo dark
  scrollbarDarkThumbHover: '#94a3b8', // Fondo del thumb del scrollbar en modo dark al hacer hover
}

