'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Brain, Activity } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast-provider'

export default function PrediccionesPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [farms, setFarms] = useState<any[]>([])
  const [plots, setPlots] = useState<any[]>([])
  const [selectedFarm, setSelectedFarm] = useState('')
  const [selectedPlot, setSelectedPlot] = useState('')
  const [prediction, setPrediction] = useState<any>(null)
  const [irrigationRec, setIrrigationRec] = useState<any>(null)
  const [yieldHistory, setYieldHistory] = useState<any[]>([])
  const [cultivos, setCultivos] = useState<any[]>([])
  const [selectedCultivoId, setSelectedCultivoId] = useState('')
  const [fechaSiembra, setFechaSiembra] = useState(() => new Date().toISOString().slice(0, 10))
  const [activeSeason, setActiveSeason] = useState<any>(null)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'ano'>('mes')
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [seasonSaving, setSeasonSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const activeSeasonForSelectedPlot =
    activeSeason &&
    activeSeason.loteId === selectedPlot &&
    activeSeason.cultivo &&
    activeSeason.cultivo.nombre
      ? activeSeason
      : null

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login')
      return
    }
    fetchFarms()
    fetchCultivos()
  }, [])

  useEffect(() => {
    if (!selectedFarm) {
      setPlots([])
      setSelectedPlot('')
      setYieldHistory([])
      setActiveSeason(null)
      return
    }
    fetchPlots(selectedFarm)
    fetchYieldHistory(selectedFarm, periodo)
  }, [selectedFarm])

  useEffect(() => {
    if (!selectedPlot) {
      setActiveSeason(null)
      return
    }
    fetchActiveSeason(selectedPlot)
  }, [selectedPlot])

  useEffect(() => {
    if (!selectedFarm) return
    fetchYieldHistory(selectedFarm, periodo)
  }, [periodo])

  const fetchFarms = async () => {
    try {
      const data = await apiClient.farms.getAll()
      const list = Array.isArray(data) ? data : []
      setFarms(list)
      if (list.length > 0) setSelectedFarm(list[0].id)
    } catch {
      setFarms([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPlots = async (farmId: string) => {
    try {
      const data = await apiClient.plots.getAllByFarm(farmId)
      const list = Array.isArray(data) ? data : []
      setPlots(list)
      if (list.length > 0) setSelectedPlot(list[0].id)
    } catch {
      setPlots([])
      setSelectedPlot('')
    }
  }

  const handlePredict = async () => {
    if (!selectedPlot) return
    if (!activeSeasonForSelectedPlot) {
      setError('Primero crea una temporada activa con cultivo para este lote')
      return
    }
    setActionLoading(true)
    setError('')
    try {
      const createdPrediction = await apiClient.predictions.trigger(selectedPlot)
      setPrediction(createdPrediction)
      const rec = await apiClient.irrigation.getRecommendations(selectedPlot)
      setIrrigationRec(rec)
      await fetchYieldHistory(selectedFarm || undefined, periodo)
      showToast({ type: 'success', title: 'Predicción generada correctamente' })
    } catch (err: any) {
      setError(err.message || 'No se pudo ejecutar la predicción')
      showToast({
        type: 'error',
        title: 'No se pudo ejecutar la predicción',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const fetchYieldHistory = async (farmId?: string, selectedPeriod: 'semana' | 'mes' | 'ano' = 'mes') => {
    try {
      setHistoryLoading(true)
      const data = await apiClient.predictions.getYieldHistory(farmId, selectedPeriod)
      setYieldHistory(Array.isArray(data) ? data : [])
    } catch {
      setYieldHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchCultivos = async () => {
    try {
      const data = await apiClient.predictions.getCultivos()
      const list = Array.isArray(data) ? data : []
      setCultivos(list)
      if (list.length > 0) setSelectedCultivoId(list[0].id)
    } catch {
      setCultivos([])
      setSelectedCultivoId('')
    }
  }

  const fetchActiveSeason = async (plotId: string) => {
    try {
      setSeasonLoading(true)
      const data = await apiClient.predictions.getActiveSeason(plotId)
      if (
        data &&
        data.loteId === plotId &&
        data.cultivo &&
        data.cultivo.nombre
      ) {
        setActiveSeason(data)
      } else {
        setActiveSeason(null)
      }
    } catch {
      setActiveSeason(null)
    } finally {
      setSeasonLoading(false)
    }
  }

  const handleCreateSeason = async () => {
    if (!selectedPlot || !selectedCultivoId || !fechaSiembra) {
      setError('Selecciona lote, cultivo y fecha de siembra')
      return
    }
    setSeasonSaving(true)
    setError('')
    try {
      const created = await apiClient.predictions.createActiveSeason({
        loteId: selectedPlot,
        cultivoId: selectedCultivoId,
        fechaSiembra,
      })
      if (
        created &&
        created.loteId === selectedPlot &&
        created.cultivo &&
        created.cultivo.nombre
      ) {
        setActiveSeason(created)
      } else {
        await fetchActiveSeason(selectedPlot)
      }
      showToast({ type: 'success', title: 'Temporada activada correctamente' })
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la temporada')
      showToast({
        type: 'error',
        title: 'No se pudo activar la temporada',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setSeasonSaving(false)
    }
  }

  const selectedPlotName = plots.find((plot) => plot.id === selectedPlot)?.nombre || 'Sin lote'
  const latestHistory = yieldHistory.length > 0 ? yieldHistory[yieldHistory.length - 1] : null

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                Analítica predictiva
              </div>
              <h1 className="mt-4 text-3xl font-bold">Predicciones ML</h1>
              <p className="mt-2 text-sm text-white/85">Modelos de IA para estimar rendimiento y apoyar decisiones de riego en el lote activo.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Lote</p>
                  <p className="mt-1 text-sm font-semibold truncate">{selectedPlotName}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Temporada</p>
                  <p className="mt-1 text-sm font-semibold">{activeSeasonForSelectedPlot?.cultivo?.nombre || 'Pendiente'}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Última predicción</p>
                  <p className="mt-1 text-sm font-semibold">{prediction ? `${Number(prediction.rendimientoEstimadoKgHa || 0).toFixed(1)} kg/ha` : 'Sin ejecutar'}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-gray-900 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lectura rápida</p>
              <h2 className="mt-1 text-xl font-bold">Estado del modelo</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="rounded-2xl bg-gray-50 px-4 py-3">
                  Histórico actual: <span className="font-semibold text-gray-900">{latestHistory ? `${Number(latestHistory.averageYield || 0).toFixed(1)} kg/ha` : 'Sin datos'}</span>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-violet-900">
                  Usa primero una temporada activa válida para habilitar predicción y recomendación asociada.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Resumen del lote</h2>
          <p className="mt-1 text-sm text-gray-500">Sigue el contexto productivo del lote antes de lanzar el modelo.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Lote en operación</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 truncate">{selectedPlotName}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Temporada activa</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{activeSeasonForSelectedPlot?.cultivo?.nombre || 'Pendiente'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Lote en operación</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{selectedPlotName}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Temporada activa</p>
          <p className="text-sm font-semibold text-gray-900">{activeSeasonForSelectedPlot?.cultivo?.nombre || 'Pendiente'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Última predicción</p>
          <p className="text-sm font-semibold text-gray-900">{prediction ? `${Number(prediction.rendimientoEstimadoKgHa || 0).toFixed(1)} kg/ha` : 'Sin ejecutar'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Histórico (periodo)</p>
          <p className="text-sm font-semibold text-gray-900">{latestHistory ? `${Number(latestHistory.averageYield || 0).toFixed(1)} kg/ha` : 'Sin datos'}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Selecciona finca y lote</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={selectedFarm}
              onChange={(e) => setSelectedFarm(e.target.value)}
              disabled={loading}
            >
              <option value="">Seleccionar finca...</option>
              {farms.map((farm: any) => (
                <option key={farm.id} value={farm.id}>{farm.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={selectedPlot}
              onChange={(e) => setSelectedPlot(e.target.value)}
              disabled={!selectedFarm}
            >
              <option value="">Seleccionar lote...</option>
              {plots.map((plot: any) => (
                <option key={plot.id} value={plot.id}>{plot.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 border border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Temporada y cultivo</h3>
            {seasonLoading ? (
              <span className="text-xs text-gray-500">Cargando temporada...</span>
            ) : activeSeasonForSelectedPlot ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Activa: {activeSeasonForSelectedPlot.cultivo.nombre}
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Sin temporada activa</span>
            )}
          </div>
          {!activeSeasonForSelectedPlot && (
            <div className="grid md:grid-cols-3 gap-3">
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={selectedCultivoId}
                onChange={(e) => setSelectedCultivoId(e.target.value)}
                disabled={!selectedPlot || seasonSaving}
              >
                <option value="">Seleccionar cultivo...</option>
                {cultivos.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.variedad ? ` - ${c.variedad}` : ''}</option>
                ))}
              </select>
              <input
                type="date"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={fechaSiembra}
                onChange={(e) => setFechaSiembra(e.target.value)}
                disabled={!selectedPlot || seasonSaving}
              />
              <button
                onClick={handleCreateSeason}
                disabled={!selectedPlot || !selectedCultivoId || !fechaSiembra || seasonSaving}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl px-3 py-2 text-sm font-medium"
              >
                {seasonSaving ? 'Creando...' : 'Activar temporada'}
              </button>
            </div>
          )}
          {activeSeasonForSelectedPlot && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-600">
                Si cambias de cultivo para este lote, puedes crear una nueva temporada activa para reemplazar la actual.
              </p>
              <button
                onClick={() => setActiveSeason(null)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
              >
                Cambiar temporada
              </button>
            </div>
          )}
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-xl">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Predicción de Rendimiento</h2>
              <p className="text-xs text-gray-500">Backend + servicio ML</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Ejecuta la predicción real en backend para el lote seleccionado.
          </p>
          {prediction && (
            <div className="space-y-3 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Rendimiento estimado</span>
                <span className="font-medium text-gray-900">{Number(prediction.rendimientoEstimadoKgHa || 0).toFixed(2)} kg/ha</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Precisión modelo</span>
                <span className="font-medium text-gray-900">{prediction.precisionModelo ? `${(Number(prediction.precisionModelo) * 100).toFixed(1)}%` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Modelo</span>
                <span className="font-medium text-gray-900">{prediction.modeloUtilizado || '—'}</span>
              </div>
            </div>
          )}
          <button
            onClick={handlePredict}
            disabled={!selectedPlot || actionLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {actionLoading ? 'Ejecutando...' : 'Ejecutar predicción'}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Optimización de Riego</h2>
              <p className="text-xs text-gray-500">Recomendación por lote</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Recomendación de riego calculada por backend para el mismo lote.
          </p>
          {irrigationRec ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Recomendación</span>
                <span className="font-medium text-gray-900 text-right">{irrigationRec.recommendation || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Humedad actual</span>
                <span className="font-medium text-gray-900">{irrigationRec.currentSoilMoisture ?? '—'}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Temperatura actual</span>
                <span className="font-medium text-gray-900">{irrigationRec.currentTemperature ?? '—'} °C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Volumen sugerido</span>
                <span className="font-medium text-gray-900">
                  {irrigationRec.recommendedVolumeM3 !== undefined
                    ? `${Number(irrigationRec.recommendedVolumeM3).toFixed(2)} m³`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hora sugerida</span>
                <span className="font-medium text-gray-900">{irrigationRec.optimalTime || '—'}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Ejecuta primero una predicción para ver la recomendación de riego.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Histórico de rendimiento</h2>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as 'semana' | 'mes' | 'ano')}
          >
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
            <option value="ano">Año</option>
          </select>
        </div>
        {historyLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : yieldHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Sin historial de predicciones para el periodo seleccionado.</p>
        ) : (
          <div className="space-y-2">
            {yieldHistory.slice(-8).map((row: any) => (
              <div key={row.period} className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50">
                <span className="text-gray-500">{row.period}</span>
                <span className="font-medium text-gray-900">{Number(row.averageYield || 0).toFixed(1)} kg/ha</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Brain className="h-6 w-6" />
          <h2 className="font-semibold">Sobre los modelos ML</h2>
        </div>
        <p className="text-sm text-purple-100 mb-3">
          El sistema utiliza un ensamble de modelos Random Forest y Gradient Boosting para estimar rendimiento
          y apoyar decisiones de riego en base a datos reales.
        </p>
      </div>
    </div>
  )
}
