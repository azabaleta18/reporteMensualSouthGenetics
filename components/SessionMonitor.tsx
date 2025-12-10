'use client'

import { useSessionMonitor } from '@/lib/session-monitor'

/**
 * Componente que monitorea la sesión del usuario
 * Debe incluirse en el layout para que funcione en toda la aplicación
 */
export default function SessionMonitor() {
  useSessionMonitor()
  return null
}

