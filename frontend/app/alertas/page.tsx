'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, AlertTriangle, Info, Zap } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast-provider'

const severityConfig: Record<string, any> = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Información' },
  advertencia: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Advertencia' },
  critica: { icon: Zap, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: 'Crítica' },
  emergencia: { icon: Zap, color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300', label: 'Emergencia' },
}

type ViewFilter = 'unread' | 'all'
type SeverityFilter = 'all' | 'info' | 'advertencia' | 'critica' | 'emergencia'

function formatAlertDate(value?: string | Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AlertasPage() {
  const router = useRouter()
  const { showToast, confirmToast } = useToast()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('unread')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    fetchAlerts()
  }, [viewFilter])

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const data = viewFilter === 'all'
        ? await apiClient.alerts.getAll(100, 0)
        : await apiClient.alerts.getUnread()
      const list = Array.isArray(data) ? data : Array.isArray(data?.alerts) ? data.alerts : []
      setAlerts(list)
      setError('')
    } catch (err: any) {
      setAlerts([])
      setError(err?.message || 'No se pudieron cargar las alertas')
      showToast({
        type: 'error',
        title: 'No se pudieron cargar las alertas',
        description: err?.message || 'Intenta nuevamente.',
      })
    } finally { setLoading(false) }
  }

  const markAsRead = async (alertId: string) => {
    setMarkingId(alertId)
    try {
      await apiClient.alerts.markAsRead(alertId)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      showToast({ type: 'success', title: 'Alerta marcada como leída' })
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'No se pudo actualizar la alerta',
        description: err?.message || 'Intenta nuevamente.',
      })
    } finally {
      setMarkingId(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    const confirmed = await confirmToast({
      title: 'Marcar alertas como leídas',
      description: 'Se marcarán como leídas todas las alertas visibles en tu bandeja.',
      confirmLabel: 'Marcar todas',
      cancelLabel: 'Cancelar',
    })
    if (!confirmed) return

    setMarkingAll(true)
    try {
      await apiClient.alerts.markAllAsRead()
      await fetchAlerts()
      showToast({ type: 'success', title: 'Alertas marcadas como leídas' })
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'No se pudieron actualizar las alertas',
        description: err?.message || 'Intenta nuevamente.',
      })
    } finally {
      setMarkingAll(false)
    }
  }

  const filteredAlerts = useMemo(() => {
    if (severityFilter === 'all') return alerts
    return alerts.filter((alert) => alert.severidad === severityFilter)
  }, [alerts, severityFilter])

  const criticalCount = alerts.filter((alert) => alert.severidad === 'critica' || alert.severidad === 'emergencia').length
  const warningCount = alerts.filter((alert) => alert.severidad === 'advertencia').length
  const infoCount = alerts.filter((alert) => alert.severidad === 'info').length
  const latestAlertTime = formatAlertDate(alerts[0]?.creadaEn)

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
          <p className="text-gray-500 text-sm mt-1">{filteredAlerts.length} alertas en la vista actual</p>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll || viewFilter === 'all'}
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <CheckCheck className="h-4 w-4" /> {markingAll ? 'Actualizando...' : 'Marcar todas como leídas'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewFilter('unread')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewFilter === 'unread' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setViewFilter('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Todas
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Severidad</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-400"
          >
            <option value="all">Todas</option>
            <option value="info">Información</option>
            <option value="advertencia">Advertencia</option>
            <option value="critica">Crítica</option>
            <option value="emergencia">Emergencia</option>
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Pendientes</p>
          <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600">Críticas</p>
          <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-600">Advertencias</p>
          <p className="text-2xl font-bold text-amber-700">{warningCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Última alerta</p>
          <p className="text-sm font-semibold text-gray-900">{latestAlertTime}</p>
        </div>
      </div>
      {infoCount > 0 && (
        <p className="text-xs text-gray-500">Alertas informativas en la bandeja: {infoCount}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white border rounded-xl p-4 h-20 animate-pulse" />)}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay alertas para los filtros actuales</p>
          <p className="text-gray-400 text-sm mt-1">Prueba cambiar la vista o la severidad seleccionada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert: any) => {
            const cfg = severityConfig[alert.severidad] || severityConfig.info
            const Icon = cfg.icon
            return (
              <div key={alert.id} className={`bg-white border ${cfg.border} rounded-xl p-4 flex items-start gap-4`}>
                <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {alert.lote?.nombre && `Lote: ${alert.lote.nombre}`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{alert.mensaje}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatAlertDate(alert.creadaEn)}
                  </p>
                </div>
                <button
                  onClick={() => markAsRead(alert.id)}
                  disabled={markingId === alert.id || alert.leida}
                  className="text-gray-400 hover:text-gray-600 disabled:text-gray-300 flex-shrink-0 p-1"
                  title="Marcar como leída"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
