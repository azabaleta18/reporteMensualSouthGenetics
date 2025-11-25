import { Divisa } from './types'

export interface FiltrosReporte {
  fechaDesde: string | null
  fechaHasta: string | null
  divisas: Divisa[] // Array de divisas seleccionadas
}

export const FILTROS_INICIALES: FiltrosReporte = {
  fechaDesde: null,
  fechaHasta: null,
  divisas: [], // Array vacío = mostrar todas las divisas
}

// Función auxiliar para normalizar fechas a formato YYYY-MM-DD
function normalizarFecha(fecha: string): string {
  if (!fecha || typeof fecha !== 'string') {
    return fecha || ''
  }
  
  // Si la fecha ya está en formato YYYY-MM-DD, retornarla directamente
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha
  }
  
  // Si tiene hora (formato ISO), tomar solo la parte de la fecha
  const partes = fecha.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(partes)) {
    return partes
  }
  
  // Si está en formato DD/MM/YYYY, convertirla
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
    const [dia, mes, anio] = fecha.split('/')
    return `${anio}-${mes}-${dia}`
  }
  
  // Intentar parsear como Date (usar UTC para evitar problemas de zona horaria)
  try {
    // Si la fecha no tiene hora, agregar 'T00:00:00Z' para forzar UTC
    const fechaConHora = fecha.includes('T') ? fecha : fecha + 'T00:00:00Z'
    const date = new Date(fechaConHora)
    if (!isNaN(date.getTime())) {
      // Usar métodos UTC para obtener la fecha correcta sin importar la zona horaria
      const anio = date.getUTCFullYear()
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
      const dia = String(date.getUTCDate()).padStart(2, '0')
      return `${anio}-${mes}-${dia}`
    }
  } catch (e) {
    // Si falla el parseo, retornar la fecha original
  }
  
  return fecha
}

export function aplicarFiltros(
  datos: any[],
  filtros: FiltrosReporte
): any[] {
  if (!filtros.fechaDesde && !filtros.fechaHasta) {
    // Si no hay filtros de fecha, retornar todos los datos
    return datos
  }

  return datos.filter((dato) => {
    // Filtrar por rango de fechas
    // Si es una agrupación, verificar si alguna fecha dentro del rango coincide
    if (dato.esAgrupacion && dato.fechasAgrupadas) {
      if (filtros.fechaDesde || filtros.fechaHasta) {
        const tieneFechaEnRango = dato.fechasAgrupadas.some((fecha: string) => {
          const fechaNormalizada = normalizarFecha(fecha)
          
          if (filtros.fechaDesde) {
            const fechaDesdeNormalizada = normalizarFecha(filtros.fechaDesde)
            // Si fechaNormalizada es menor que fechaDesdeNormalizada, excluir
            if (fechaNormalizada < fechaDesdeNormalizada) return false
          }
          if (filtros.fechaHasta) {
            const fechaHastaNormalizada = normalizarFecha(filtros.fechaHasta)
            // Si fechaNormalizada es mayor que fechaHastaNormalizada, excluir
            if (fechaNormalizada > fechaHastaNormalizada) return false
          }
          return true
        })
        if (!tieneFechaEnRango) return false
      }
    } else {
      // Para fechas individuales, comparar usando strings normalizados
      // Las fechas en formato YYYY-MM-DD se pueden comparar directamente como strings
      const fechaDatoNormalizada = normalizarFecha(dato.fecha)
      
      if (filtros.fechaDesde) {
        const fechaDesdeNormalizada = normalizarFecha(filtros.fechaDesde)
        // Comparación directa de strings en formato YYYY-MM-DD
        // Si fechaDatoNormalizada es menor que fechaDesdeNormalizada, excluir (retornar false)
        // Esto significa que solo incluimos fechas >= fechaDesde
        // Ejemplo: si fechaDesde = "2025-11-20", excluimos "2025-11-19" pero incluimos "2025-11-20"
        if (fechaDatoNormalizada < fechaDesdeNormalizada) {
          return false
        }
      }
      if (filtros.fechaHasta) {
        const fechaHastaNormalizada = normalizarFecha(filtros.fechaHasta)
        // Comparación directa de strings en formato YYYY-MM-DD
        // Si fechaDatoNormalizada es mayor que fechaHastaNormalizada, excluir (retornar false)
        // Esto significa que solo incluimos fechas <= fechaHasta
        if (fechaDatoNormalizada > fechaHastaNormalizada) {
          return false
        }
      }
    }

    // Filtrar por divisas seleccionadas (si hay alguna seleccionada)
    // Nota: Este filtro ahora solo afecta qué columnas se muestran, no qué filas
    // Las filas se mantienen, pero las columnas de divisas no seleccionadas se ocultan

    return true
  })
}

