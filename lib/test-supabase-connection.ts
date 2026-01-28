// Script de test para verificar la conexión y datos de Supabase
import { supabase } from './supabase'

export async function testSupabaseConnection() {
  console.log('🔍 Iniciando test de conexión a Supabase...')
  
  try {
    // Test 1: Verificar fecha máxima en v_saldo_diario_cuentas_usd
    console.log('\n📅 Test 1: Verificando fecha máxima en v_saldo_diario_cuentas_usd...')
    const { data: fechaMax, error: errorFechaMax } = await supabase
      .from('v_saldo_diario_cuentas_usd')
      .select('fecha')
      .order('fecha', { ascending: false })
      .limit(1)

    if (errorFechaMax) {
      console.error('❌ Error al obtener fecha máxima:', errorFechaMax)
      return { success: false, error: errorFechaMax }
    }

    const fechaMaxima = fechaMax?.[0]?.fecha
    console.log(`✅ Fecha máxima encontrada: ${fechaMaxima}`)
    
    if (fechaMaxima && fechaMaxima > '2025-04-03') {
      console.log('✅ CORRECTO: Hay datos posteriores al 2025-04-03')
    } else {
      console.log('⚠️ ADVERTENCIA: No hay datos posteriores al 2025-04-03')
    }

    // Test 2: Contar total de registros
    console.log('\n📊 Test 2: Contando total de registros...')
    const { count, error: errorCount } = await supabase
      .from('v_saldo_diario_cuentas_usd')
      .select('*', { count: 'exact', head: true })

    if (errorCount) {
      console.error('❌ Error al contar registros:', errorCount)
    } else {
      console.log(`✅ Total de registros en v_saldo_diario_cuentas_usd: ${count}`)
    }

    // Test 3: Verificar rango de fechas
    console.log('\n📅 Test 3: Verificando rango de fechas...')
    const { data: fechaMin, error: errorFechaMin } = await supabase
      .from('v_saldo_diario_cuentas_usd')
      .select('fecha')
      .order('fecha', { ascending: true })
      .limit(1)

    if (errorFechaMin) {
      console.error('❌ Error al obtener fecha mínima:', errorFechaMin)
    } else {
      const fechaMinima = fechaMin?.[0]?.fecha
      console.log(`✅ Fecha mínima: ${fechaMinima}`)
      console.log(`✅ Fecha máxima: ${fechaMaxima}`)
      console.log(`✅ Rango completo: ${fechaMinima} → ${fechaMaxima}`)
    }

    // Test 4: Verificar consulta completa (la vista ya incluye nombre_banco y nombre_empresa)
    console.log('\n🔗 Test 4: Verificando consulta completa...')
    const { data: saldosTest, error: errorSaldos } = await supabase
      .from('v_saldo_diario_cuentas_usd')
      .select(`
        id_cuenta,
        fecha,
        saldo_divisa,
        saldo_usd,
        hubo_movimientos,
        nombre_banco,
        nombre_empresa
      `)
      .order('fecha', { ascending: false })
      .limit(5)

    if (errorSaldos) {
      console.error('❌ Error en consulta con joins:', errorSaldos)
    } else {
      console.log(`✅ Consulta con joins exitosa`)
      console.log(`✅ Registros obtenidos: ${saldosTest?.length || 0}`)
      if (saldosTest && saldosTest.length > 0) {
        console.log(`✅ Última fecha en resultado: ${saldosTest[0].fecha}`)
        console.log(`✅ Primera fecha en resultado: ${saldosTest[saldosTest.length - 1].fecha}`)
      }
    }

    return {
      success: true,
      fechaMaxima,
      totalRegistros: count,
      rangoFechas: {
        min: fechaMin?.[0]?.fecha,
        max: fechaMaxima
      }
    }

  } catch (error) {
    console.error('❌ Error general en test:', error)
    return { success: false, error }
  }
}

// Ejecutar test si se llama directamente
if (typeof window !== 'undefined') {
  console.log('Test de Supabase disponible. Llama a testSupabaseConnection() para ejecutar.')
}

