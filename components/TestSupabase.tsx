'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export default function TestSupabase() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<any>(null)

  const runTest = async () => {
    setTesting(true)
    setResults(null)

    try {
      console.log('🔍 Iniciando test de conexión a Supabase...')
      
      // Test 1: Verificar fecha máxima
      const { data: fechaMax, error: errorFechaMax } = await supabase
        .from('saldo_diario_cuenta')
        .select('fecha')
        .order('fecha', { ascending: false })
        .limit(1)

      if (errorFechaMax) {
        throw new Error(`Error al obtener fecha máxima: ${errorFechaMax.message}`)
      }

      const fechaMaxima = fechaMax?.[0]?.fecha

      // Test 2: Contar total de registros
      const { count, error: errorCount } = await supabase
        .from('saldo_diario_cuenta')
        .select('*', { count: 'exact', head: true })

      if (errorCount) {
        throw new Error(`Error al contar registros: ${errorCount.message}`)
      }

      // Test 3: Verificar fecha mínima
      const { data: fechaMin, error: errorFechaMin } = await supabase
        .from('saldo_diario_cuenta')
        .select('fecha')
        .order('fecha', { ascending: true })
        .limit(1)

      if (errorFechaMin) {
        throw new Error(`Error al obtener fecha mínima: ${errorFechaMin.message}`)
      }

      const fechaMinima = fechaMin?.[0]?.fecha

      // Test 4: Verificar consulta completa con joins
      const { data: saldosTest, error: errorSaldos } = await supabase
        .from('saldo_diario_cuenta')
        .select(`
          id_cuenta,
          fecha,
          saldo_divisa,
          saldo_usd,
          es_actual,
          cuenta (
            id_cuenta,
            id_banco_pais_divisa,
            id_empresa,
            id_tipo_cuenta,
            numero_cuenta,
            banco_pais_divisa (
              id_banco_pais_divisa,
              codigo_divisa,
              banco_pais (
                id_banco_pais,
                codigo_pais,
                banco (
                  id_banco,
                  nombre
                ),
                pais (
                  codigo_pais,
                  nombre
                )
              ),
              divisa (
                codigo_divisa,
                nombre,
                simbolo,
                decimales
              )
            )
          )
        `)
        .order('fecha', { ascending: false })
        .limit(5)

      if (errorSaldos) {
        throw new Error(`Error en consulta con joins: ${errorSaldos.message}`)
      }

      const testResults = {
        success: true,
        fechaMinima,
        fechaMaxima,
        totalRegistros: count,
        registrosConJoins: saldosTest?.length || 0,
        hayDatosDespuesDel20250403: fechaMaxima && fechaMaxima > '2025-04-03',
        ultimasFechas: saldosTest?.map(s => s.fecha) || []
      }

      console.log('✅ Test completado:', testResults)
      setResults(testResults)

    } catch (error: any) {
      console.error('❌ Error en test:', error)
      setResults({
        success: false,
        error: error.message
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        🧪 Test de Conexión Supabase
      </h2>
      
      <button
        onClick={runTest}
        disabled={testing}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
      >
        {testing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ejecutando test...
          </>
        ) : (
          'Ejecutar Test'
        )}
      </button>

      {results && (
        <div className="mt-6 space-y-4">
          {results.success ? (
            <>
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 mb-2">✅ Test Exitoso</h3>
                  <div className="space-y-2 text-sm text-green-800">
                    <p><strong>Total de registros:</strong> {results.totalRegistros}</p>
                    <p><strong>Fecha mínima:</strong> {results.fechaMinima}</p>
                    <p><strong>Fecha máxima:</strong> {results.fechaMaxima}</p>
                    <p><strong>Registros con JOINs:</strong> {results.registrosConJoins}</p>
                    <p>
                      <strong>¿Hay datos después del 2025-04-03?</strong>{' '}
                      {results.hayDatosDespuesDel20250403 ? (
                        <span className="text-green-700 font-bold">✅ SÍ</span>
                      ) : (
                        <span className="text-orange-700 font-bold">⚠️ NO</span>
                      )}
                    </p>
                    {results.ultimasFechas.length > 0 && (
                      <div>
                        <strong>Últimas 5 fechas:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          {results.ultimasFechas.map((fecha: string, idx: number) => (
                            <li key={idx}>{fecha}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">❌ Test Fallido</h3>
                <p className="text-sm text-red-700">{results.error}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

