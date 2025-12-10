export type Divisa = 
  | 'ARS' // Pesos argentinos
  | 'CLP' // Pesos chilenos
  | 'COP' // Pesos colombianos
  | 'EUR' // Euros
  | 'MXN' // Pesos mexicanos
  | 'UYU' // Pesos uruguayos
  | 'USD' // Dólares

export interface EstadoDivisa {
  id: string
  divisa: Divisa
  cantidad: number
  updated_at: string
}

export interface TasaCambio {
  codigo_divisa: string
  unidades_por_usd: number
  fecha_actualizacion: string
}

export interface DivisaConEstado {
  divisa: Divisa
  nombre: string
  simbolo: string
  cantidad: number
  tasa_a_usd: number
  total_usd: number
}

export interface RegistroBancario {
  id: string
  banco: string
  divisa: Divisa
  cantidad: number
  fecha: string
  created_at: string
  updated_at: string
}

export interface ResumenDivisa {
  divisa: Divisa
  total: number
  cantidad_registros: number
}

export const DIVISAS: { codigo: Divisa; nombre: string; simbolo: string }[] = [
  { codigo: 'ARS', nombre: 'Pesos Argentinos', simbolo: '$' },
  { codigo: 'CLP', nombre: 'Pesos Chilenos', simbolo: '$' },
  { codigo: 'COP', nombre: 'Pesos Colombianos', simbolo: '$' },
  { codigo: 'EUR', nombre: 'Euros', simbolo: '€' },
  { codigo: 'MXN', nombre: 'Pesos Mexicanos', simbolo: '$' },
  { codigo: 'UYU', nombre: 'Pesos Uruguayos', simbolo: '$' },
  { codigo: 'USD', nombre: 'Dólares', simbolo: 'US$' },
]

// Mapeo estático de bancos por divisa
export const BANCOS_POR_DIVISA: Record<Divisa, string[]> = {
  ARS: ['BBVA', 'GALICIA', 'SANTANDER'],
  CLP: ['SANTANDER', 'AGRICOLA'],
  COP: ['BANCOLOMBIA', 'DAVIVIENDA'],
  EUR: ['CAIXA', 'BBVA'],
  MXN: ['BBVA', 'SANTANDER'],
  UYU: ['ITAU'],
  USD: ['DAVIVIENDA', 'CAIXA', 'BANESCO', 'BROU', 'ITAU', 'ABANCA', 'BELMONT', 'BOFA', 'PERSHING'],
}

// Mapeo de cuentas bancarias con nombres completos para el reporte
export interface CuentaBancaria {
  banco: string
  divisa: Divisa
  nombreCompleto: string
  orden: number
}

export const CUENTAS_BANCARIAS: CuentaBancaria[] = [
  // ARS
  { banco: 'BBVA', divisa: 'ARS', nombreCompleto: 'BBVA SG SRL ARS CC', orden: 1 },
  { banco: 'GALICIA', divisa: 'ARS', nombreCompleto: 'GALICIA SG SRL ARS CC', orden: 2 },
  { banco: 'SANTANDER', divisa: 'ARS', nombreCompleto: 'SANTANDER SG SRL ARS CC', orden: 3 },
  // CLP
  { banco: 'SANTANDER', divisa: 'CLP', nombreCompleto: 'SANTANDER PG CLP CC', orden: 4 },
  { banco: 'AGRICOLA', divisa: 'CLP', nombreCompleto: 'AGRICOLA PG CLP CC', orden: 5 },
  // COP
  { banco: 'BANCOLOMBIA', divisa: 'COP', nombreCompleto: 'BANCOLOMBIA NECBB COP CC', orden: 6 },
  { banco: 'DAVIVIENDA', divisa: 'COP', nombreCompleto: 'DAVIVIENDA NECBB COP CC', orden: 7 },
  { banco: 'DAVIVIENDA', divisa: 'COP', nombreCompleto: 'DAVIVIENDA NECBB COP CA', orden: 8 },
  // EUR
  { banco: 'CAIXA', divisa: 'EUR', nombreCompleto: 'CAIXA SG LC EUR', orden: 9 },
  { banco: 'BBVA', divisa: 'EUR', nombreCompleto: 'BBVA SG LC EUR', orden: 10 },
  // MXN
  { banco: 'BBVA', divisa: 'MXN', nombreCompleto: 'BBVA SG MX MXN 3786 CC', orden: 11 },
  { banco: 'BBVA', divisa: 'MXN', nombreCompleto: 'BBVA SG MX MXN 6674 CC', orden: 12 },
  { banco: 'SANTANDER', divisa: 'MXN', nombreCompleto: 'SANTANDER PG MXN CC', orden: 13 },
  // USD
  { banco: 'SANTANDER', divisa: 'USD', nombreCompleto: 'SANTANDER PG USD CC', orden: 14 },
  { banco: 'AGRICOLA', divisa: 'USD', nombreCompleto: 'BANCOAGRICOLA SG ELS SA DE CV', orden: 15 },
  { banco: 'CAIXA', divisa: 'USD', nombreCompleto: 'CAIXA SG LC USD', orden: 16 },
  { banco: 'BBVA', divisa: 'USD', nombreCompleto: 'BBVA MX USD CC', orden: 17 },
  { banco: 'BANESCO', divisa: 'USD', nombreCompleto: 'BANESCO UNI USD CC', orden: 18 },
  { banco: 'BROU', divisa: 'USD', nombreCompleto: 'BROU DNT USD CA', orden: 19 },
  { banco: 'ITAU', divisa: 'USD', nombreCompleto: 'ITAU DNT USD CC', orden: 20 },
  { banco: 'ITAU', divisa: 'USD', nombreCompleto: 'ITAU DNT USD RC', orden: 21 },
  { banco: 'ITAU', divisa: 'USD', nombreCompleto: 'ITAU SG LTDA USD CC', orden: 22 },
  { banco: 'ITAU', divisa: 'USD', nombreCompleto: 'ITAU SG LTDA DNAFIT USD CC', orden: 23 },
  { banco: 'ITAU', divisa: 'USD', nombreCompleto: 'ITAU SG SAS USD RC', orden: 24 },
  { banco: 'ITAU', divisa: 'USD', nombreCompleto: 'ITAU SG SAS USD CC', orden: 25 },
  { banco: 'ABANCA', divisa: 'USD', nombreCompleto: 'ABANCA NG LLC USD CC', orden: 26 },
  { banco: 'ABANCA', divisa: 'USD', nombreCompleto: 'ABANCA SG LLC USD CC', orden: 27 },
  { banco: 'ABANCA', divisa: 'USD', nombreCompleto: 'ABANCA MX USD CC', orden: 28 },
  { banco: 'BELMONT', divisa: 'USD', nombreCompleto: 'BELMONT SG LLC USD', orden: 29 },
  { banco: 'BOFA', divisa: 'USD', nombreCompleto: 'BOFA SG LLC USD CC', orden: 30 },
  { banco: 'PERSHING', divisa: 'USD', nombreCompleto: 'PERSHING', orden: 31 },
  // UYU
  { banco: 'ITAU', divisa: 'UYU', nombreCompleto: 'ITAU DNT UYU CC', orden: 32 },
  { banco: 'ITAU', divisa: 'UYU', nombreCompleto: 'ITAU SG LTDA UYU CC', orden: 33 },
  { banco: 'ITAU', divisa: 'UYU', nombreCompleto: 'ITAU SG SAS UYU CC', orden: 34 },
]

// Ordenar cuentas por orden
export const CUENTAS_ORDENADAS = CUENTAS_BANCARIAS.sort((a, b) => a.orden - b.orden)

