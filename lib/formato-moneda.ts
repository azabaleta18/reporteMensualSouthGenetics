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

