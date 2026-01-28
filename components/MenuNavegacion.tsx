'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, List, Table2 } from 'lucide-react'

export default function MenuNavegacion() {
  const pathname = usePathname()

  const menuItems = [
    {
      href: '/',
      label: 'Saldos Diarios',
      icon: BarChart3,
      descripcion: 'Sistema de saldos diarios por divisa'
    },
    {
      href: '/movimientos',
      label: 'Movimientos',
      icon: List,
      descripcion: 'Ver movimientos detallados'
    },
    {
      href: '/tabla-general',
      label: 'Tabla General',
      icon: Table2,
      descripcion: 'Tabla general de información'
    }
  ]

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href === '/movimientos' && pathname?.startsWith('/movimientos'))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                  border-b-2
                  ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

