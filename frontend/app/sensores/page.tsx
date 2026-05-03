'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Cpu, Wifi, WifiOff, Thermometer, Droplet, RefreshCw, Plus, Link2, Unlink } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast-provider'

const tipoConfig: Record<string, any> = {
  clima: { icon: Cpu, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Clima' },
  suelo: { icon: Droplet, color: 'text-brown-600', bg: 'bg-amber-50', label: 'Suelo' },
  humedad: { icon: Droplet, color: 'text-cyan-600', bg: 'bg-cyan-50', label: 'Humedad' },
  temperatura: { icon: Thermometer, color: 'text-red-500', bg: 'bg-red-50', label: 'Temperatura' },
}

interface SensorData {
  id: string
  codigo: string
  tipo: string
  activo: boolean
  loteId?: string | null
  lote: { nombre: string } | null
  ultimaLectura: {
    timestamp: string
    temperatura: number | null
    humedadAmbiente: number | null
    humedadSuelo?: number | null
  } | null
}

interface SyncSummary {
  targetedSensors: number
  successfulSensors: number
  failedSensors: number
  readingsCreated: number
  persistedReadings: number
  webhookReportedReadings: number
  workflowStatus?: string
  syncedAt: string
}

export default function SensoresPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [sensors, setSensors] = useState<SensorData[]>([])
  const [farms, setFarms] = useState<any[]>([])
  const [plots, setPlots] = useState<any[]>([])
  const [allPlots, setAllPlots] = useState<any[]>([])
  const [selectedFarm, setSelectedFarm] = useState('')
  const [selectedPlot, setSelectedPlot] = useState('')
  const [newSensor, setNewSensor] = useState({
    codigo: '',
    tipo: 'clima',
    loteId: '',
    lat: '',
    lon: '',
  })
  const [creatingSensor, setCreatingSensor] = useState(false)
  const [assigningSensorId, setAssigningSensorId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'clima' | 'suelo' | 'humedad' | 'temperatura'>('all')

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login')
      return
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (!selectedFarm) {
      setPlots([])
      setSelectedPlot('')
      return
    }
    fetchPlots(selectedFarm)
  }, [selectedFarm])

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchSensors(selectedPlot || undefined, true)
    }, 60000)
    return () => window.clearInterval(timer)
  }, [selectedPlot])

  useEffect(() => {
    if (loading) return
    fetchSensors(selectedPlot || undefined, true)
  }, [selectedPlot])

  const fetchInitialData = async () => {
    try {
      const [farmData, allPlotsData] = await Promise.all([
        apiClient.farms.getAll(),
        apiClient.plots.getAll(),
      ])
      const farmList = Array.isArray(farmData) ? farmData : []
      const allPlotsList = Array.isArray(allPlotsData) ? allPlotsData : []
      setFarms(farmList)
      setAllPlots(allPlotsList)
      if (farmList.length > 0) {
        setSelectedFarm(farmList[0].id)
      }
      await fetchSensors()
    } finally {
      setLoading(false)
    }
  }

  const fetchPlots = async (farmId: string) => {
    try {
      const plotData = await apiClient.plots.getAllByFarm(farmId)
      const plotList = Array.isArray(plotData) ? plotData : []
      setPlots(plotList)
      setSelectedPlot((prev) => (prev && plotList.some((p: any) => p.id === prev) ? prev : ''))
    } catch {
      setPlots([])
      setSelectedPlot('')
    }
  }

  const fetchSensors = async (loteId?: string, silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError('')
      const data = await apiClient.sensors.getLatestReadings(loteId)
      setSensors(Array.isArray(data) ? data : [])
      setLastSync(new Date())
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar los sensores')
      setSensors([])
      showToast({
        type: 'error',
        title: 'No se pudieron cargar los sensores',
        description: err.message || 'Verifica la conexión con el backend.',
      })
    } finally {
      if (!silent) setRefreshing(false)
    }
  }

  const handleRefreshReadings = async () => {
    setRefreshing(true)
    try {
      const result = await apiClient.sensors.refreshReadings(selectedPlot || undefined)
      await fetchSensors(selectedPlot || undefined, true)
      const persistedReadings = Number(result?.persistedReadings ?? result?.dbReadingsCreated ?? result?.readingsCreated ?? result?.createdReadings ?? 0)
      const webhookReportedReadings = Number(result?.webhookReportedReadings ?? result?.webhookReadingsCreated ?? 0)
      const targetedSensors = Number(result?.targetedSensors ?? 0)
      const successfulSensors = Number(result?.successfulSensors ?? targetedSensors)
      const failedSensors = Number(result?.failedSensors ?? Math.max(targetedSensors - successfulSensors, 0))
      setSyncSummary({
        targetedSensors,
        successfulSensors,
        failedSensors,
        readingsCreated: persistedReadings,
        persistedReadings,
        webhookReportedReadings,
        workflowStatus: result?.workflowStatus,
        syncedAt: new Date().toISOString(),
      })
      showToast({
        type: failedSensors > 0 ? 'info' : 'success',
        title: 'Lecturas actualizadas',
        description: `Se procesaron ${successfulSensors}/${targetedSensors} sensores y se guardaron ${persistedReadings} lecturas nuevas.`,
      })
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'No se pudieron actualizar las lecturas',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreateSensor = async () => {
    if (!newSensor.codigo.trim() || !newSensor.tipo.trim()) {
      showToast({
        type: 'error',
        title: 'Completa los datos del sensor',
        description: 'Código y tipo son obligatorios.',
      })
      return
    }

    const hasLat = newSensor.lat.trim() !== ''
    const hasLon = newSensor.lon.trim() !== ''
    if (hasLat !== hasLon) {
      showToast({
        type: 'error',
        title: 'Coordenadas incompletas',
        description: 'Debes indicar latitud y longitud juntas o dejar ambas vacías.',
      })
      return
    }

    if (hasLat && hasLon) {
      const lat = Number(newSensor.lat)
      const lon = Number(newSensor.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        showToast({
          type: 'error',
          title: 'Coordenadas inválidas',
          description: 'Verifica que la latitud y longitud tengan valores válidos.',
        })
        return
      }
    }

    setCreatingSensor(true)
    try {
      await apiClient.sensors.create({
        codigo: newSensor.codigo.trim(),
        tipo: newSensor.tipo.trim(),
        loteId: newSensor.loteId || null,
        lat: newSensor.lat ? Number(newSensor.lat) : undefined,
        lon: newSensor.lon ? Number(newSensor.lon) : undefined,
      })
      setNewSensor({ codigo: '', tipo: 'clima', loteId: '', lat: '', lon: '' })
      const updatedPlots = await apiClient.plots.getAll()
      setAllPlots(Array.isArray(updatedPlots) ? updatedPlots : [])
      await fetchSensors(selectedPlot || undefined, true)
      showToast({ type: 'success', title: 'Sensor creado correctamente' })
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'No se pudo crear el sensor',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setCreatingSensor(false)
    }
  }

  const handleAssignSensor = async (sensorId: string, loteId?: string | null) => {
    setAssigningSensorId(sensorId)
    try {
      await apiClient.sensors.assignPlot(sensorId, loteId ?? null)
      await fetchSensors(selectedPlot || undefined, true)
      showToast({
        type: 'success',
        title: loteId ? 'Sensor asignado al lote' : 'Sensor desasignado',
      })
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'No se pudo actualizar la asignación',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setAssigningSensorId(null)
    }
  }

  const filteredSensors = useMemo(() => {
    return sensors.filter((sensor) => {
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? sensor.activo
          : !sensor.activo
      const matchesType = typeFilter === 'all' ? true : sensor.tipo === typeFilter
      return matchesStatus && matchesType
    })
  }, [sensors, statusFilter, typeFilter])

  const active = sensors.filter((s) => s.activo).length
  const inactive = sensors.filter((s) => !s.activo).length
  const selectedFarmName = farms.find((farm) => farm.id === selectedFarm)?.nombre || 'Todas las fincas'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                Monitoreo IoT
              </div>
              <h1 className="mt-4 text-3xl font-bold">Sensores IoT</h1>
              <p className="mt-2 text-sm text-white/85">Supervisa el estado de los sensores, la última lectura y la asignación a lotes desde una vista más clara.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Totales</p>
                  <p className="mt-1 text-2xl font-bold">{sensors.length}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Activos</p>
                  <p className="mt-1 text-2xl font-bold">{active}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Inactivos</p>
                  <p className="mt-1 text-2xl font-bold">{inactive}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-gray-900 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filtro activo</p>
              <h2 className="mt-1 text-xl font-bold">{selectedFarmName}</h2>
              <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Última sincronización: <span className="font-semibold text-gray-900">{lastSync ? lastSync.toLocaleTimeString('es-PE', { timeZone: 'America/Lima' }) : '—'}</span>
              </p>
              <button
                onClick={handleRefreshReadings}
                disabled={refreshing}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white hover:bg-cyan-700 disabled:bg-cyan-300"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualizando...' : 'Actualizar lecturas'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Resumen de monitoreo</h2>
          <p className="mt-1 text-sm text-gray-500">Filtra por finca o lote y mantén el control de asignaciones y sincronización.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Finca</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{selectedFarmName}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Lote</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{plots.find((plot) => plot.id === selectedPlot)?.nombre || 'Todos los lotes'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-4 flex flex-wrap items-end gap-3 shadow-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Finca</label>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm min-w-[220px]"
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
          >
            <option value="">Todas las fincas</option>
            {farms.map((farm: any) => (
              <option key={farm.id} value={farm.id}>{farm.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Lote</label>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm min-w-[220px]"
            value={selectedPlot}
            onChange={(e) => setSelectedPlot(e.target.value)}
            disabled={!selectedFarm}
          >
            <option value="">Todos los lotes</option>
            {plots.map((plot: any) => (
              <option key={plot.id} value={plot.id}>{plot.nombre}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRefreshReadings}
          disabled={refreshing}
          className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-300 text-white px-3 py-2 rounded-xl text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar lecturas'}
        </button>
        <div className="text-xs text-gray-500 ml-auto">
          Última sincronización: {lastSync ? lastSync.toLocaleTimeString('es-PE', { timeZone: 'America/Lima' }) : '—'}
        </div>
      </div>

      <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 text-sm text-cyan-800">
        El botón dispara el workflow de ingesta climática en n8n y luego refresca las lecturas en la web:
        {' '}
        <a href="http://127.0.0.1:5678" target="_blank" rel="noreferrer" className="font-semibold underline">
          abrir n8n
        </a>
      </div>

      {syncSummary && (
        <div className="grid gap-3 rounded-3xl border border-cyan-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <div className="rounded-2xl bg-cyan-50 px-4 py-3">
            <p className="text-xs text-cyan-700">Sensores objetivo</p>
            <p className="mt-1 text-2xl font-bold text-cyan-900">{syncSummary.targetedSensors}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3">
            <p className="text-xs text-emerald-700">Sincronizados</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{syncSummary.successfulSensors}</p>
          </div>
          <div className="rounded-2xl bg-violet-50 px-4 py-3">
            <p className="text-xs text-violet-700">Lecturas guardadas</p>
            <p className="mt-1 text-2xl font-bold text-violet-900">{syncSummary.persistedReadings}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700">Fallos</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{syncSummary.failedSensors}</p>
          </div>
          <div className="md:col-span-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Última ejecución: <span className="font-semibold text-gray-900">{new Date(syncSummary.syncedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</span>
            {' · '}
            Workflow: <span className="font-semibold text-gray-900">{syncSummary.workflowStatus || 'completado'}</span>
            {' · '}
            Webhook reportó <span className="font-semibold text-gray-900">{syncSummary.webhookReportedReadings}</span> lecturas.
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-emerald-600" />
          <h2 className="font-semibold text-gray-900">Crear Sensor</h2>
        </div>
        <div className="grid md:grid-cols-6 gap-3">
          <input
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Código (ej. climate002)"
            value={newSensor.codigo}
            onChange={(e) => setNewSensor((prev) => ({ ...prev, codigo: e.target.value }))}
          />
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={newSensor.tipo}
            onChange={(e) => setNewSensor((prev) => ({ ...prev, tipo: e.target.value }))}
          >
            <option value="clima">Clima</option>
            <option value="suelo">Suelo</option>
            <option value="humedad">Humedad</option>
            <option value="temperatura">Temperatura</option>
          </select>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={newSensor.loteId}
            onChange={(e) => setNewSensor((prev) => ({ ...prev, loteId: e.target.value }))}
          >
            <option value="">Sin asignar</option>
            {allPlots.map((plot: any) => (
              <option key={plot.id} value={plot.id}>
                {plot.nombre}{plot.finca?.nombre ? ` (${plot.finca.nombre})` : ''}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="any"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Latitud (opcional)"
            value={newSensor.lat}
            onChange={(e) => setNewSensor((prev) => ({ ...prev, lat: e.target.value }))}
          />
          <input
            type="number"
            step="any"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Longitud (opcional)"
            value={newSensor.lon}
            onChange={(e) => setNewSensor((prev) => ({ ...prev, lon: e.target.value }))}
          />
          <button
            onClick={handleCreateSensor}
            disabled={creatingSensor}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-3 py-2 rounded-xl text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            {creatingSensor ? 'Creando...' : 'Crear sensor'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{sensors.length}</div>
          <div className="text-sm text-gray-500 mt-1">Sensores totales</div>
        </div>
        <div className="bg-white border border-green-200 rounded-2xl p-5 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{active}</div>
          <div className="text-sm text-gray-500 mt-1">Activos</div>
        </div>
        <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm">
          <div className="text-2xl font-bold text-red-500">{inactive}</div>
          <div className="text-sm text-gray-500 mt-1">Inactivos</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-4 flex flex-wrap items-end gap-3 shadow-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Estado</label>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm min-w-[180px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm min-w-[180px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'clima' | 'suelo' | 'humedad' | 'temperatura')}
          >
            <option value="all">Todos los tipos</option>
            <option value="clima">Clima</option>
            <option value="suelo">Suelo</option>
            <option value="humedad">Humedad</option>
            <option value="temperatura">Temperatura</option>
          </select>
        </div>
        <div className="text-xs text-gray-500 ml-auto">
          Mostrando {filteredSensors.length} de {sensors.length} sensores
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse shadow-sm">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      ) : filteredSensors.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center text-gray-500 shadow-sm">
          No hay sensores para los filtros seleccionados.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSensors.map((sensor) => {
            const cfg = tipoConfig[sensor.tipo] || tipoConfig.clima
            const Icon = cfg.icon
            return (
              <div key={sensor.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2 rounded-xl ${cfg.bg}`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${sensor.activo ? 'text-green-600' : 'text-red-500'}`}>
                    {sensor.activo ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                    {sensor.activo ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 font-mono">{sensor.codigo}</h3>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                    <span className="text-gray-500">Tipo</span>
                    <span className="font-medium">{cfg.label}</span>
                  </div>
                  <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                    <span className="text-gray-500">Lote</span>
                    <span className="font-medium">{sensor.lote?.nombre || 'Sin asignar'}</span>
                  </div>
                  <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                    <span className="text-gray-500">Temperatura</span>
                    <span className="font-medium">
                      {sensor.ultimaLectura?.temperatura !== null && sensor.ultimaLectura?.temperatura !== undefined
                        ? `${sensor.ultimaLectura.temperatura.toFixed(1)} °C`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                    <span className="text-gray-500">{sensor.tipo === 'suelo' ? 'Humedad suelo' : 'Humedad'}</span>
                    <span className="font-medium">
                      {((sensor.tipo === 'suelo'
                        ? sensor.ultimaLectura?.humedadSuelo
                        : sensor.ultimaLectura?.humedadAmbiente) !== null
                        && (sensor.tipo === 'suelo'
                          ? sensor.ultimaLectura?.humedadSuelo
                          : sensor.ultimaLectura?.humedadAmbiente) !== undefined)
                        ? `${sensor.tipo === 'suelo'
                          ? sensor.ultimaLectura?.humedadSuelo
                          : sensor.ultimaLectura?.humedadAmbiente}%`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                    <span className="text-gray-500">Última lectura</span>
                    <span className="font-medium">
                      {sensor.ultimaLectura?.timestamp
                        ? new Date(sensor.ultimaLectura.timestamp).toLocaleString('es-PE', { timeZone: 'America/Lima' })
                        : 'Sin lecturas'}
                    </span>
                  </div>
                </div>
                <div className="mt-4 border-t pt-3 space-y-2">
                  <div className="text-xs text-gray-500">Asignación de lote</div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border border-gray-200 rounded-xl px-2 py-1.5 text-xs flex-1"
                      value={sensor.loteId || ''}
                      onChange={(e) => handleAssignSensor(sensor.id, e.target.value || null)}
                      disabled={assigningSensorId === sensor.id}
                    >
                      <option value="">Sin asignar</option>
                      {allPlots.map((plot: any) => (
                        <option key={plot.id} value={plot.id}>
                          {plot.nombre}{plot.finca?.nombre ? ` (${plot.finca.nombre})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssignSensor(sensor.id, null)}
                      disabled={assigningSensorId === sensor.id}
                      className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Desasignar
                    </button>
                  </div>
                  {assigningSensorId === sensor.id && (
                    <div className="text-xs text-cyan-700 inline-flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      Guardando asignación...
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
