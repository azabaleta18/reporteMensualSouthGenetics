'use client'

import { useEffect } from 'react'
import { updateLastActivity, isSessionExpired, signOut } from './auth'
import { useRouter } from 'next/navigation'

/**
 * Hook para monitorear la actividad del usuario y actualizar el timestamp de última actividad
 * También verifica periódicamente si la sesión ha expirado
 */
export function useSessionMonitor() {
  const router = useRouter()

  useEffect(() => {
    // Verificar primero si la sesión ya expiró antes de actualizar
    // Esto evita que se actualice el timestamp si la página se carga después de 15 minutos
    if (isSessionExpired()) {
      // Si ya expiró, cerrar sesión inmediatamente
      signOut().then(() => {
        router.push('/login')
      }).catch((error) => {
        console.error('Error al cerrar sesión expirada:', error)
        router.push('/login')
      })
      return
    }

    // Si no ha expirado, actualizar actividad inicial
    updateLastActivity()

    // Eventos que indican actividad del usuario
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    // Función para actualizar la última actividad
    const handleActivity = () => {
      // Solo actualizar si la sesión no ha expirado
      if (!isSessionExpired()) {
        updateLastActivity()
      }
    }

    // Agregar listeners para eventos de actividad
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Verificar expiración periódicamente (cada minuto)
    const checkExpirationInterval = setInterval(() => {
      if (isSessionExpired()) {
        // Si la sesión ha expirado, cerrar sesión y redirigir
        signOut().then(() => {
          router.push('/login')
        }).catch((error) => {
          console.error('Error al cerrar sesión expirada:', error)
          router.push('/login')
        })
      }
    }, 60000) // Verificar cada minuto

    // Limpiar listeners al desmontar
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      clearInterval(checkExpirationInterval)
    }
  }, [router])
}

