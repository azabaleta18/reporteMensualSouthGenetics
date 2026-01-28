// Helpers para input de Débito/Crédito: miles con . y decimales con ,
// - Mientras se escribe: 2000 -> "2.000", 1068809 -> "1.068.809"
// - Una coma indica decimales: "1.068.809,50"

export function formatMonedaInput(val: string): string {
  if (!val) return ''
  const s = val.replace(/\./g, '')
  const idx = s.lastIndexOf(',')
  const intPart = (idx >= 0 ? s.slice(0, idx) : s).replace(/\D/g, '')
  const decPart = idx >= 0 ? s.slice(idx + 1).replace(/\D/g, '').slice(0, 2) : ''
  const fmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return idx >= 0 ? fmt + ',' + decPart : fmt
}

export function parseMonedaInput(val: string): number {
  if (!val || !val.trim()) return 0
  const t = val.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return isNaN(n) ? 0 : n
}

// Helper para formatear moneda según los datos de la divisa

export function formatearMoneda(
  valor: number,
  simbolo: string,
  decimales: number
): string {
  const valorFormateado = valor.toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
  
  // Usar espacio no separable (non-breaking space) para evitar saltos de línea
  return `${simbolo}\u00A0${valorFormateado}`
}

export function construirNombreBanco(
  nombreBanco: string,
  codigoPais: string,
  tipoCuenta?: string
): string {
  // Construir nombre formal del banco
  let nombre = nombreBanco
  
  // Si hay tipo de cuenta, agregarlo
  if (tipoCuenta) {
    nombre += ` ${tipoCuenta}`
  }
  
  return nombre
}

export function construirCodigoBanco(
  idBanco: number,
  idTipoCuenta: number,
  codigoPais: string,
  idCuenta?: number
): string {
  // Crear un identificador único para cada banco/cuenta
  // Si se proporciona id_cuenta, incluirlo para diferenciar cuentas únicas
  if (idCuenta !== undefined) {
    return `${idBanco}_${idTipoCuenta}_${codigoPais}_${idCuenta}`.toLowerCase()
  }
  return `${idBanco}_${idTipoCuenta}_${codigoPais}`.toLowerCase()
}

