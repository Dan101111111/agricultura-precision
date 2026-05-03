'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

type ToastMessageItem = {
  id: string
  title: string
  description?: string
  type: ToastType
}

type ConfirmToastItem = {
  id: string
  title: string
  description?: string
  type: 'info'
  variant: 'confirm'
  confirmLabel?: string
  cancelLabel?: string
}

type ToastItem = ToastMessageItem | ConfirmToastItem

type ConfirmToastInput = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

type ToastContextValue = {
  showToast: (input: Omit<ToastMessageItem, 'id'>) => void
  confirmToast: (input: ConfirmToastInput) => Promise<boolean>
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastStyles: Record<ToastType, { wrapper: string; icon: React.ComponentType<{ className?: string }> }> = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-800',
    icon: AlertCircle,
  },
  info: {
    wrapper: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    icon: Info,
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const confirmResolvers = useRef(new Map<string, (value: boolean) => void>())

  const removeToast = useCallback((id: string, resolution?: boolean) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const resolver = confirmResolvers.current.get(id)
    if (resolver) {
      resolver(resolution ?? false)
      confirmResolvers.current.delete(id)
    }
  }, [])

  const showToast = useCallback((input: Omit<ToastMessageItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, ...input }])
    window.setTimeout(() => removeToast(id), 4200)
  }, [removeToast])

  const confirmToast = useCallback((input: ConfirmToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, {
      id,
      title: input.title,
      description: input.description,
      type: 'info',
      variant: 'confirm',
      confirmLabel: input.confirmLabel,
      cancelLabel: input.cancelLabel,
    }])
    return new Promise<boolean>((resolve) => {
      confirmResolvers.current.set(id, resolve)
    })
  }, [])

  const value = useMemo(() => ({ showToast, confirmToast }), [confirmToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] space-y-2">
        {toasts.map((toast) => {
          const style = toastStyles[toast.type]
          const Icon = style.icon
          return (
            <div
              key={toast.id}
              className={`w-[340px] rounded-xl border px-3 py-3 shadow-sm ${style.wrapper}`}
            >
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.description && (
                    <p className="text-xs mt-0.5 opacity-90">{toast.description}</p>
                  )}
                  {'variant' in toast && toast.variant === 'confirm' && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => removeToast(toast.id, false)}
                        className="rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
                      >
                        {toast.cancelLabel || 'Cancelar'}
                      </button>
                      <button
                        onClick={() => removeToast(toast.id, true)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                      >
                        {toast.confirmLabel || 'Confirmar'}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id, false)}
                  className="opacity-70 hover:opacity-100"
                  aria-label="Cerrar notificación"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context
}
