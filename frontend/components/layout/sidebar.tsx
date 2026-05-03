'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, MapPin, Droplet, FileText, Bell, Leaf, TrendingUp, LogOut, Cpu } from 'lucide-react'

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fincas', label: 'Fincas', icon: Leaf },
  { href: '/lotes', label: 'Lotes', icon: MapPin },
  { href: '/riego', label: 'Riego', icon: Droplet },
  { href: '/alertas', label: 'Alertas', icon: Bell },
  { href: '/predicciones', label: 'Predicciones ML', icon: TrendingUp },
  { href: '/sensores', label: 'Sensores', icon: Cpu },
  { href: '/reportes', label: 'Reportes', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-green-900 border-r border-green-800 text-white flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-green-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">AgriPrecision</h1>
            <p className="text-xs text-green-200">Agricultura Inteligente</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {menuItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-700 text-white'
                  : 'text-green-100 hover:bg-green-800 hover:text-white'
               }`}
             >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-green-300'}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-green-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-green-100 hover:bg-green-800 hover:text-red-200 w-full transition-colors"
        >
          <LogOut className="h-4 w-4 text-green-300" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
