import type { Metadata } from 'next'
import './globals.css'
import SessionMonitor from '@/components/SessionMonitor'

export const metadata: Metadata = {
  title: 'SouthGenetics - Gestión Financiera',
  description: 'Sistema de gestión de registros bancarios por divisa',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <SessionMonitor />
        {children}
      </body>
    </html>
  )
}

