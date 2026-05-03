'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { LayoutDashboard, MapPin, Droplet, Bell, TrendingUp, Leaf, RefreshCw, Activity, TriangleAlert, Clock3 } from 'lucide-react'
import { useToast } from '@/components/ui/toast-provider'

interface Metrics {
  totalFarms: number
  totalPlots: number
  unreadAlerts: number
  averageYield: number
  irrigationEfficiency: number
}

interface ChartsData {
  yieldHistory: Array<{ period: string; averageYield: number; maxYield: number; minYield: number }>
  irrigationData: Array<{ period: string; events: number; totalVolume: number; averageVolume: number }>
  efficiencyMetrics: {
    totalEvents: number
    totalVolumeM3: number
    averageEfficiency: number
    irrigationTypes: Record<string, number>
  } | null
}

interface AutomationOverview {
  configuration: {
    workflowSecretConfigured: boolean
    climateWebhookConfigured: boolean
    climateWebhookUrl: string | null
  }
  summary: {
    total: number
    completed: number
    partial: number
    failed: number
    running: number
  }
  systemStatus: 'sin_configurar' | 'atencion' | 'ejecutando' | 'activo'
  lastExecution: {
    workflowNombre: string
    estado: string
    inicioEjecucion: string
    finEjecucion?: string | null
    errorMensaje?: string | null
    durationMs?: number | null
  } | null
  recentExecutions: Array<{
    id: string
    workflowNombre: string
    estado: string
    inicioEjecucion: string
    finEjecucion?: string | null
    durationMs?: number | null
  }>
}

function getAutomationStatusMeta(status?: AutomationOverview['systemStatus']) {
  switch (status) {
    case 'activo':
      return { label: 'Activo', color: 'bg-green-500', tone: 'text-green-700 bg-green-50 border-green-200' }
    case 'ejecutando':
      return { label: 'Ejecutando', color: 'bg-blue-500', tone: 'text-blue-700 bg-blue-50 border-blue-200' }
    case 'atencion':
      return { label: 'Atención', color: 'bg-amber-500', tone: 'text-amber-700 bg-amber-50 border-amber-200' }
    default:
      return { label: 'Sin configurar', color: 'bg-gray-400', tone: 'text-gray-700 bg-gray-50 border-gray-200' }
  }
}

function formatAutomationTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' })
}

function formatDuration(durationMs?: number | null) {
  if (!durationMs || durationMs < 1000) return 'Menos de 1 s'
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)} s`
  return `${Math.round(durationMs / 60000)} min`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return '—'
  return `${(Number(value) * 100).toFixed(0)}%`
}

function getBarWidth(value: number, maxValue: number) {
  if (!maxValue || maxValue <= 0) return '0%'
  return `${Math.max(8, Math.round((value / maxValue) * 100))}%`
}

export default function DashboardPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [charts, setCharts] = useState<ChartsData | null>(null)
  const [automation, setAutomation] = useState<AutomationOverview | null>(null)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'ano'>('mes')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    const userData = localStorage.getItem('user')
    if (userData) setUser(JSON.parse(userData))
    fetchDashboardData('mes')
  }, [])

  const fetchDashboardData = async (selectedPeriod: 'semana' | 'mes' | 'ano', preserveView = false) => {
    if (preserveView) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const [metricsData, chartsData, automationData] = await Promise.all([
        apiClient.dashboard.getMetrics(),
        apiClient.dashboard.getCharts(selectedPeriod),
        apiClient.automation.getOverview(8),
      ])
      setMetrics(metricsData)
      setCharts(chartsData)
      setAutomation(automationData)
      setDashboardError('')
      setLastUpdated(new Date())
    } catch (error: any) {
      setDashboardError(error?.message || 'No se pudieron cargar las métricas del dashboard')
      if (!preserveView) {
        setMetrics({ totalFarms: 0, totalPlots: 0, unreadAlerts: 0, averageYield: 0, irrigationEfficiency: 0 })
        setCharts({ yieldHistory: [], irrigationData: [], efficiencyMetrics: null })
        setAutomation(null)
      }
      showToast({
        type: 'error',
        title: 'No se pudieron cargar las métricas del dashboard',
        description: preserveView ? 'Se mantienen los datos previos mientras se restablece la conexión.' : 'Mostrando valores por defecto.',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const statCards = [
    { label: 'Fincas', value: metrics?.totalFarms ?? '-', icon: MapPin, color: 'bg-blue-50 text-blue-600', border: 'border-blue-200' },
    { label: 'Lotes', value: metrics?.totalPlots ?? '-', icon: Leaf, color: 'bg-green-50 text-green-600', border: 'border-green-200' },
    { label: 'Rendimiento Promedio', value: metrics?.averageYield ? `${Number(metrics.averageYield).toFixed(1)} kg/ha` : '—', icon: TrendingUp, color: 'bg-purple-50 text-purple-600', border: 'border-purple-200' },
    { label: 'Alertas sin leer', value: metrics?.unreadAlerts ?? '-', icon: Bell, color: 'bg-amber-50 text-amber-600', border: 'border-amber-200' },
    { label: 'Eficiencia riego', value: metrics?.irrigationEfficiency ? `${(metrics.irrigationEfficiency * 100).toFixed(0)}%` : '—', icon: Droplet, color: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200' },
  ]
  const automationStatus = getAutomationStatusMeta(automation?.systemStatus)
  const systemRows = [
    { label: 'Backend API', status: 'Activo', color: 'bg-green-500' },
    { label: 'Base de datos', status: 'Activo', color: 'bg-green-500' },
    { label: 'ML Service', status: 'Activo', color: 'bg-green-500' },
    { label: 'n8n Workflows', status: automationStatus.label, color: automationStatus.color },
  ]
  const maxYield = Math.max(...(charts?.yieldHistory?.map((row) => Number(row.averageYield || 0)) || [0]))
  const maxIrrigation = Math.max(...(charts?.irrigationData?.map((row) => Number(row.totalVolume || 0)) || [0]))
  const insightCards = useMemo(() => {
    const unreadAlerts = metrics?.unreadAlerts ?? 0
    const efficiency = metrics?.irrigationEfficiency ?? 0
    const lastExecution = automation?.lastExecution
    return [
      {
        title: 'Prioridad operativa',
        value: unreadAlerts > 0 ? `${unreadAlerts} alertas` : 'Sin alertas',
        description: unreadAlerts > 0 ? 'Conviene revisar alertas y lotes con actividad reciente.' : 'La operación diaria se ve estable para seguimiento rutinario.',
        tone: unreadAlerts > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: unreadAlerts > 0 ? TriangleAlert : Bell,
      },
      {
        title: 'Riego',
        value: formatPercent(efficiency),
        description: efficiency >= 0.8 ? 'La eficiencia del riego está en buen nivel.' : 'Conviene revisar programación y volumen aplicado.',
        tone: efficiency >= 0.8 ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-blue-200 bg-blue-50 text-blue-800',
        icon: Droplet,
      },
      {
        title: 'Automatización',
        value: automationStatus.label,
        description: lastExecution ? `${lastExecution.workflowNombre} · ${formatDuration(lastExecution.durationMs)}` : 'Aún no hay ejecuciones recientes.',
        tone: automationStatus.tone,
        icon: Activity,
      },
    ]
  }, [automation?.lastExecution, automationStatus.label, automationStatus.tone, metrics?.irrigationEfficiency, metrics?.unreadAlerts])

  return (
    <div className="space-y-6">
      {dashboardError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {dashboardError}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-3xl bg-gradient-to-br from-green-600 via-emerald-600 to-green-700 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                Panel principal
              </div>
              <h1 className="mt-4 text-3xl font-bold">Dashboard</h1>
              <p className="mt-2 text-sm text-white/85">
                Bienvenido{user?.nombre ? `, ${user.nombre}` : ''}. Aquí tienes una vista rápida del sistema con foco en rendimiento, riego y operación agrícola.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/85">
                <span className="rounded-full bg-white/12 px-3 py-1">Periodo: {periodo}</span>
                <span className="rounded-full bg-white/12 px-3 py-1">Actualizado: {lastUpdated ? lastUpdated.toLocaleTimeString('es-PE', { timeZone: 'America/Lima' }) : '—'}</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Fincas</p>
                  <p className="mt-1 text-2xl font-bold">{metrics?.totalFarms ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Lotes</p>
                  <p className="mt-1 text-2xl font-bold">{metrics?.totalPlots ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Alertas</p>
                  <p className="mt-1 text-2xl font-bold">{metrics?.unreadAlerts ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-md rounded-3xl bg-white p-5 text-gray-900 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vista rápida</p>
                  <h2 className="mt-1 text-xl font-bold">Estado operativo</h2>
                </div>
                <LayoutDashboard className="h-5 w-5 text-green-600" />
              </div>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                  <span>Rendimiento promedio</span>
                  <span className="font-semibold text-gray-900">{metrics?.averageYield ? `${Number(metrics.averageYield).toFixed(1)} kg/ha` : '—'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                  <span>Eficiencia de riego</span>
                  <span className="font-semibold text-gray-900">{formatPercent(metrics?.irrigationEfficiency)}</span>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${automationStatus.tone}`}>
                  Automatización: {automationStatus.label}
                  {automation?.lastExecution ? ` · Último flujo ${automation.lastExecution.workflowNombre}` : ''}
                </div>
                <button
                  onClick={() => fetchDashboardData(periodo, true)}
                  disabled={refreshing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-green-300"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Actualizando panel...' : 'Actualizar panel'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Resumen del periodo</h2>
              <p className="mt-1 text-sm text-gray-500">Consulta las tendencias según el horizonte temporal seleccionado.</p>
            </div>
            <select
              value={periodo}
              onChange={async (e) => {
                const nextPeriod = e.target.value as 'semana' | 'mes' | 'ano'
                setPeriodo(nextPeriod)
                await fetchDashboardData(nextPeriod, true)
              }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-400"
            >
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="ano">Año</option>
            </select>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Eventos de riego</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{charts?.efficiencyMetrics?.totalEvents ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Volumen total</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{charts?.efficiencyMetrics?.totalVolumeM3 ? `${Number(charts.efficiencyMetrics.totalVolumeM3).toFixed(2)} m³` : '0.00 m³'}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {insightCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className={`rounded-2xl border p-4 ${card.tone}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" />
                    {card.title}
                  </div>
                  <p className="mt-2 text-lg font-bold">{card.value}</p>
                  <p className="mt-1 text-sm opacity-90">{card.description}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-900">Lectura rápida</p>
            <p className="mt-2 text-sm text-gray-600">
              {metrics?.unreadAlerts
                ? `Tienes ${metrics.unreadAlerts} alertas pendientes y conviene revisar lotes con mayor actividad antes de ejecutar nuevas acciones.`
                : 'No hay alertas pendientes. El sistema se encuentra estable para seguimiento rutinario.'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white border rounded-2xl p-5 animate-pulse shadow-sm">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className={`bg-white border ${card.border} rounded-2xl p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}>
                <div className={`inline-flex p-2 rounded-lg ${card.color} mb-3`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                <div className="text-sm text-gray-500 mt-1">{card.label}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tendencias</h2>
            <p className="mt-1 text-sm text-gray-500">Resumen compacto de rendimiento y riego para el periodo seleccionado.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-2xl p-4 bg-gradient-to-b from-white to-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">Rendimiento</h3>
            {!charts?.yieldHistory?.length ? (
              <p className="text-sm text-gray-500">Sin datos de predicción para el periodo seleccionado.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {charts.yieldHistory.slice(-6).map((row) => (
                  <div key={row.period} className="rounded-xl bg-white p-3 border border-gray-100">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-gray-500">{row.period}</span>
                      <span className="font-medium text-gray-900">{Number(row.averageYield).toFixed(1)} kg/ha</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-violet-500" style={{ width: getBarWidth(Number(row.averageYield || 0), maxYield) }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border border-gray-200 rounded-2xl p-4 bg-gradient-to-b from-white to-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">Riego</h3>
            {!charts?.irrigationData?.length ? (
              <p className="text-sm text-gray-500">Sin eventos de riego para el periodo seleccionado.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {charts.irrigationData.slice(-6).map((row) => (
                  <div key={row.period} className="rounded-xl bg-white p-3 border border-gray-100">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-gray-500">{row.period}</span>
                      <span className="font-medium text-gray-900">{Number(row.totalVolume).toFixed(2)} m³</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-cyan-500" style={{ width: getBarWidth(Number(row.totalVolume || 0), maxIrrigation) }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Ver Lotes', href: '/lotes', icon: MapPin, color: 'text-green-600' },
            { label: 'Gestionar Riego', href: '/riego', icon: Droplet, color: 'text-blue-600' },
            { label: 'Ver Alertas', href: '/alertas', icon: Bell, color: 'text-amber-600' },
            { label: 'Predicciones', href: '/predicciones', icon: TrendingUp, color: 'text-purple-600' },
            { label: 'Reportes', href: '/reportes', icon: LayoutDashboard, color: 'text-gray-600' },
            { label: 'Fincas', href: '/fincas', icon: Leaf, color: 'text-emerald-600' },
          ].map(action => {
            const Icon = action.icon
            return (
              <a
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                <Icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </a>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Estado del sistema</h2>
          <div className="space-y-3">
            {systemRows.map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{s.label}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="text-sm text-gray-700">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Secreto workflow</span>
              <span className="text-sm font-medium text-gray-900">{automation?.configuration.workflowSecretConfigured ? 'Configurado' : 'Pendiente'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Webhook climático</span>
              <span className="text-sm font-medium text-gray-900">{automation?.configuration.climateWebhookConfigured ? 'Disponible' : 'Pendiente'}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded-xl bg-white border border-gray-200 p-3">
                <div className="font-bold text-gray-900">{automation?.summary.completed ?? 0}</div>
                <div className="text-gray-500 text-xs">OK</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-3">
                <div className="font-bold text-gray-900">{automation?.summary.partial ?? 0}</div>
                <div className="text-gray-500 text-xs">Parcial</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-3">
                <div className="font-bold text-gray-900">{automation?.summary.failed ?? 0}</div>
                <div className="text-gray-500 text-xs">Fallido</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-3">
                <div className="font-bold text-gray-900">{automation?.summary.running ?? 0}</div>
                <div className="text-gray-500 text-xs">En curso</div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Última ejecución</p>
              <p className="mt-1 text-sm text-gray-600">
                {automation?.lastExecution
                  ? `${automation.lastExecution.workflowNombre} · ${automation.lastExecution.estado} · ${formatAutomationTime(automation.lastExecution.inicioEjecucion)}`
                  : 'Aún no hay ejecuciones registradas.'}
              </p>
              {automation?.lastExecution?.errorMensaje && (
                <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {automation.lastExecution.errorMensaje}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 text-white shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Actividad de automatización</h2>
          <p className="text-green-100 text-sm mb-4">
            Seguimiento rápido de los workflows que sostienen la actualización climática, reportes programados y predicciones automáticas.
          </p>
          <div className="space-y-3">
            {(automation?.recentExecutions?.length ? automation.recentExecutions : []).slice(0, 3).map((execution) => (
              <div key={execution.id} className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{execution.workflowNombre}</p>
                  <span className="text-xs text-green-100 uppercase tracking-wide">{execution.estado}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-green-100">
                  <span>{formatAutomationTime(execution.inicioEjecucion)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                    <Clock3 className="h-3 w-3" />
                    {formatDuration(execution.durationMs)}
                  </span>
                </div>
              </div>
            ))}
            {!automation?.recentExecutions?.length && (
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-green-100 backdrop-blur-sm">
                Todavía no hay actividad registrada de workflows.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
