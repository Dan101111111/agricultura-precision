// Minimal client for calling the tRPC backend via HTTP
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function buildUrl(path: string, input?: unknown, method: 'GET' | 'POST' = 'POST') {
  const baseUrl = `${API_URL}/trpc/${path}`
  if (method !== 'GET' || input === undefined) return baseUrl
  return `${baseUrl}?input=${encodeURIComponent(JSON.stringify(input))}`
}

async function trpcCall(path: string, input?: unknown, method: 'GET' | 'POST' = 'POST') {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(buildUrl(path, input, method), {
    method,
    headers,
    body: method === 'POST' && input !== undefined ? JSON.stringify(input) : undefined,
  })
  const json = await res.json()
  if (json?.error) throw new Error(json.error.message || 'Error en el servidor')
  return json?.result?.data?.json ?? json?.result?.data ?? json
}

export const apiClient = {
  auth: {
    login: (email: string, password: string) =>
      trpcCall('auth.login', { email, password }),
    me: () => trpcCall('auth.me', undefined, 'GET'),
  },
  farms: {
    getAll: () => trpcCall('farms.getAll', undefined, 'GET'),
    create: (data: any) => trpcCall('farms.create', data),
  },
  plots: {
    getAll: () => trpcCall('plots.getAll', undefined, 'GET'),
    getAllByFarm: (fincaId: string) => trpcCall('plots.getAllByFarm', { fincaId }, 'GET'),
    getOne: (id: string) => trpcCall('plots.getOne', { id }, 'GET'),
    create: (data: any) => trpcCall('plots.create', data),
    update: (data: { id: string; nombre?: string; areaHectareas?: number; tipoSuelo?: string }) =>
      trpcCall('plots.update', data),
    delete: (id: string) => trpcCall('plots.delete', { id }),
  },
  sensors: {
    getLatestReadings: (loteId?: string) =>
      trpcCall('sensors.getLatestReadings', loteId ? { loteId } : undefined, 'GET'),
    create: (data: { codigo: string; tipo: string; loteId?: string | null; activo?: boolean; lat?: number; lon?: number }) =>
      trpcCall('sensors.create', data),
    assignPlot: (sensorId: string, loteId?: string | null) =>
      trpcCall('sensors.assignPlot', { sensorId, loteId: loteId ?? null }),
    refreshReadings: (loteId?: string) =>
      trpcCall('sensors.refreshReadings', loteId ? { loteId } : undefined),
  },
  predictions: {
    getCultivos: () => trpcCall('predictions.getCultivos', undefined, 'GET'),
    getActiveSeason: (loteId: string) => trpcCall('predictions.getActiveSeason', { loteId }, 'GET'),
    createActiveSeason: (data: { loteId: string; cultivoId: string; fechaSiembra: string }) =>
      trpcCall('predictions.createActiveSeason', data),
    getByPlot: (loteId: string) => trpcCall('predictions.getByPlot', { loteId }, 'GET'),
    getCurrent: (loteId: string) => trpcCall('predictions.getCurrent', { loteId }, 'GET'),
    trigger: (loteId: string) => trpcCall('predictions.trigger', { loteId }),
    getYieldHistory: (fincaId?: string, periodo: 'semana' | 'mes' | 'ano' = 'mes') =>
      trpcCall('predictions.getYieldHistory', { fincaId, periodo }, 'GET'),
  },
  irrigation: {
    getHistory: (fincaId?: string, periodo: 'semana' | 'mes' | 'ano' = 'mes') =>
      trpcCall('irrigation.getHistory', { fincaId, periodo }, 'GET'),
    getRecommendations: (loteId: string) => trpcCall('irrigation.getRecommendations', { loteId }, 'GET'),
    schedule: (data: { loteId: string; fechaHora: string; duracionMinutos: number; tipoRiego: 'goteo' | 'aspersion' | 'inundacion' | 'subterraneo' }) =>
      trpcCall('irrigation.schedule', data),
    getEfficiencyMetrics: (fincaId?: string) =>
      trpcCall('irrigation.getEfficiencyMetrics', fincaId ? { fincaId } : undefined, 'GET'),
  },
  reports: {
    getAll: () => trpcCall('reports.getAll', undefined, 'GET'),
    generate: (tipo: 'operacional' | 'gestion' | 'prediccion' | 'riego', formato: 'pdf' | 'csv' = 'pdf') =>
      trpcCall('reports.generate', { tipo, formato }),
    download: (reportId: string) =>
      trpcCall('reports.download', { reportId }, 'GET'),
    delete: (reportId: string) =>
      trpcCall('reports.delete', { reportId }),
  },
  alerts: {
    getUnread: () => trpcCall('alerts.getUnread', undefined, 'GET'),
    getAll: (limit = 100, offset = 0) => trpcCall('alerts.getAll', { limit, offset }, 'GET'),
    markAsRead: (alertId: string) => trpcCall('alerts.markAsRead', { alertId }),
    markAllAsRead: () => trpcCall('alerts.markAllAsRead'),
  },
  automation: {
    getOverview: (limit = 12) => trpcCall('automation.getOverview', { limit }, 'GET'),
    getExecutions: (limit = 20) => trpcCall('automation.getExecutions', { limit }, 'GET'),
  },
  dashboard: {
    getMetrics: () => trpcCall('dashboard.getMetrics', undefined, 'GET'),
    getCharts: (periodo: 'semana' | 'mes' | 'ano' = 'mes') =>
      trpcCall('dashboard.getCharts', { periodo }, 'GET'),
  },
}
