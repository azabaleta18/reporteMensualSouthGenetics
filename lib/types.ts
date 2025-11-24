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
  id: string
  divisa: Divisa
  tasa_a_usd: number
  updated_at: string
}

export interface DivisaConEstado {
  divisa: Divisa
  nombre: string
  simbolo: string
  cantidad: number
  tasa_a_usd: number
  total_usd: number
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

