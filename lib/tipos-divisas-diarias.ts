// Tipos para el componente TablaDivisasDiarias

export interface Divisa {
  codigo_divisa: string
  nombre: string
  simbolo: string
  decimales: number
}

export interface Banco {
  id_banco: number
  nombre: string
}

export interface Pais {
  codigo_pais: string
  nombre: string
}

export interface BancoPais {
  id_banco_pais: number
  id_banco: number
  codigo_pais: string
  banco?: Banco
  pais?: Pais
}

export interface BancoPaisDivisa {
  id_banco_pais_divisa: number
  id_banco_pais: number
  codigo_divisa: string
  banco_pais?: BancoPais
  divisa?: Divisa
}

export interface TipoCuenta {
  id_tipo_cuenta: number
  descripcion: string
}

export interface Cuenta {
  id_cuenta: number
  id_empresa: number
  id_banco_pais_divisa: number
  id_tipo_cuenta: number
  numero_cuenta: string
  nombre_sheet_origen: string | null
  fecha_ultimo_mov: string | null
  saldo_ultimo_mov: number | null
  id_journal_odoo: number | null
  banco_pais_divisa?: BancoPaisDivisa
}

export interface SaldoDiarioCuenta {
  id_cuenta: number
  fecha: string
  saldo_divisa: number
  saldo_usd?: number // Opcional: ahora se calcula dinámicamente desde tasa_cambio
  es_actual: boolean
  cuenta?: Cuenta
}

// Tipos procesados para la tabla
export interface RegistroBD {
  fecha: string
  codigo_divisa: string
  nombre_divisa: string
  simbolo_divisa: string
  decimales_divisa: number
  nombre_banco: string
  codigo_banco: string // identificador único para el banco (ej: "bancolombia_co", "davivienda_cc_co")
  saldo_divisa: number
  id_banco?: number
  id_empresa?: number
}

export interface TotalBancoDia {
  fecha: string
  codigo_banco: string
  nombre_banco: string
  total: number
}

export interface TotalDivisaDia {
  fecha: string
  codigo_divisa: string
  total: number
  bancos: TotalBancoDia[]
}

export interface DatosPorFecha {
  fecha: string
  divisas: Map<string, TotalDivisaDia>
}

