'use client'
import { useRouter } from 'next/navigation'
import { Bell, User, LogOut } from 'lucide-react'

export const Header = () => {
  const router = useRouter()
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  const user = userStr ? JSON.parse(userStr) : null

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        Sistema de Agricultura de Precisión
      </div>
      <div className="flex items-center gap-3">
        <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
            <User className="h-4 w-4 text-green-600" />
          </div>
          <span className="font-medium">{user?.nombre || 'Admin'}</span>
        </div>
        <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
