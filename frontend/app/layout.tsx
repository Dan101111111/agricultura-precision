'use client'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { usePathname } from 'next/navigation'
import { ToastProvider } from '@/components/ui/toast-provider'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login'

  return (
    <html lang="es">
      <head>
        <title>AgriPrecision — Agricultura Inteligente</title>
        <meta name="description" content="Sistema de Agricultura de Precisión con IA" />
      </head>
      <body className={inter.className}>
        <ToastProvider>
          {isAuthPage ? (
            children
          ) : (
            <div className="flex h-screen overflow-hidden bg-gray-50">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                  {children}
                </main>
              </div>
            </div>
          )}
        </ToastProvider>
      </body>
    </html>
  )
}
