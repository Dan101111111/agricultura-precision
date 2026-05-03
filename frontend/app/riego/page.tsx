'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Droplet, Plus, Clock, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast-provider'

const tiposRiego: Array<'goteo' | 'aspersion' | 'inundacion' | 'subterraneo'> = ['goteo', 'aspersion', 'inundacion', 'subterraneo']

function getLocalDateTimeInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

export default function RiegoPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [history, setHistory] = useState<any[]>([])
  const [farms, setFarms] = useState<any[]>([])
  const [plots, setPlots] = useState<any[]>([])
  const [efficiency, setEfficiency] = useState<any>(null)
  const [selectedFarm, setSelectedFarm] = useState('')
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'ano'>('mes')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    loteId: '',
    fechaHora: getLocalDateTimeInputValue(),
    duracionMinutos: 30,
    tipoRiego: 'goteo' as 'goteo' | 'aspersion' | 'inundacion' | 'subterraneo',
  })

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login')
      return
    }
    fetchFarmsAndHistory()
  }, [])

  useEffect(() => {
    if (!selectedFarm) {
      setPlots([])
      setForm((prev) => ({ ...prev, loteId: '' }))
      refreshIrrigationData(undefined, periodo)
    } else {
      fetchPlots(selectedFarm)
      refreshIrrigationData(selectedFarm, periodo)
    }
  }, [selectedFarm])

  useEffect(() => {
    refreshIrrigationData(selectedFarm || undefined, periodo)
  }, [periodo])

  const fetchFarmsAndHistory = async () => {
    try {
      const [farmData] = await Promise.all([
        apiClient.farms.getAll(),
      ])
      const farmList = Array.isArray(farmData) ? farmData : []
      setFarms(farmList)
      if (farmList.length > 0) setSelectedFarm(farmList[0].id)
      await refreshIrrigationData(farmList[0]?.id, periodo)
    } catch {
      setFarms([])
      setHistory([])
      setEfficiency(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshIrrigationData = async (farmId?: string, selectedPeriod: 'semana' | 'mes' | 'ano' = 'mes') => {
    try {
      const [historyData, efficiencyData] = await Promise.all([
        apiClient.irrigation.getHistory(farmId, selectedPeriod),
        apiClient.irrigation.getEfficiencyMetrics(farmId),
      ])
      setHistory(Array.isArray(historyData) ? historyData : [])
      setEfficiency(efficiencyData || null)
    } catch {
      setHistory([])
      setEfficiency(null)
    }
  }

  const fetchPlots = async (farmId: string) => {
    try {
      const data = await apiClient.plots.getAllByFarm(farmId)
      const list = Array.isArray(data) ? data : []
      setPlots(list)
      setForm((prev) => ({ ...prev, loteId: list[0]?.id || '' }))
    } catch {
      setPlots([])
      setForm((prev) => ({ ...prev, loteId: '' }))
    }
  }

  const handleSchedule = async () => {
    if (!form.loteId) {
      setError('Selecciona un lote')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiClient.irrigation.schedule({
        loteId: form.loteId,
        fechaHora: new Date(form.fechaHora).toISOString(),
        duracionMinutos: Number(form.duracionMinutos),
        tipoRiego: form.tipoRiego,
      })
      setShowForm(false)
      setForm((prev) => ({
        ...prev,
        fechaHora: getLocalDateTimeInputValue(),
        duracionMinutos: 30,
        tipoRiego: 'goteo',
      }))
      await refreshIrrigationData(selectedFarm || undefined, periodo)
      showToast({ type: 'success', title: 'Evento de riego registrado' })
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar el evento')
      showToast({
        type: 'error',
        title: 'No se pudo registrar el evento',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const totalEvents = history.reduce((sum, item) => sum + Number(item.events || 0), 0)
  const totalVolume = history.reduce((sum, item) => sum + Number(item.totalVolume || 0), 0)
  const avgVolume = totalEvents > 0 ? totalVolume / totalEvents : 0
  const efficiencyPct = efficiency?.averageEfficiency ? (Number(efficiency.averageEfficiency) * 100).toFixed(0) : null
  const selectedFarmName = farms.find((farm) => farm.id === selectedFarm)?.nombre || 'Todas las fincas'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-gradient-to-br from-cyan-600 via-sky-600 to-blue-700 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                Gestión hídrica
              </div>
              <h1 className="mt-4 text-3xl font-bold">Gestión de Riego</h1>
              <p className="mt-2 text-sm text-white/85">Historial, seguimiento de eficiencia y registro manual de eventos de riego con una vista más clara y ejecutiva.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Eventos</p>
                  <p className="mt-1 text-2xl font-bold">{totalEvents}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Volumen total</p>
                  <p className="mt-1 text-2xl font-bold">{totalVolume.toFixed(2)} m³</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Promedio</p>
                  <p className="mt-1 text-2xl font-bold">{avgVolume.toFixed(2)} m³</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-gray-900 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Finca activa</p>
              <h2 className="mt-1 text-xl font-bold">{selectedFarmName}</h2>
              <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {efficiencyPct ? `Eficiencia estimada: ${efficiencyPct}%.` : 'Aún no hay eficiencia calculada para el filtro actual.'}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
              >
                <Plus className="h-4 w-4" /> Registrar Riego
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Resumen del riego</h2>
          <p className="mt-1 text-sm text-gray-500">Controla volumen, eficiencia y periodo sin saturar la vista con elementos extra.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Eficiencia promedio</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{efficiency?.averageEfficiency ? `${(Number(efficiency.averageEfficiency) * 100).toFixed(0)}%` : '—'}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Volumen acumulado</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{efficiency?.totalVolumeM3 ? `${Number(efficiency.totalVolumeM3).toFixed(2)} m³` : '—'}</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-900">
            Mantén este módulo como panel operativo: historial arriba, registro manual y métricas rápidas en el mismo contexto.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm">
          <div className="inline-flex p-2 bg-blue-50 rounded-lg mb-3">
            <Droplet className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalEvents}</div>
          <div className="text-sm text-gray-500 mt-1">Eventos totales</div>
        </div>
        <div className="bg-white border border-cyan-200 rounded-2xl p-5 shadow-sm">
          <div className="inline-flex p-2 bg-cyan-50 rounded-lg mb-3">
            <Clock className="h-5 w-5 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalVolume.toFixed(2)} m³</div>
          <div className="text-sm text-gray-500 mt-1">Volumen total</div>
        </div>
        <div className="bg-white border border-teal-200 rounded-2xl p-5 shadow-sm">
          <div className="inline-flex p-2 bg-teal-50 rounded-lg mb-3">
            <TrendingUp className="h-5 w-5 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{avgVolume.toFixed(2)} m³</div>
          <div className="text-sm text-gray-500 mt-1">Promedio por evento</div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <p className="font-medium">Resumen operativo</p>
        <p className="mt-1">
          Filtro activo: {selectedFarm ? 'finca seleccionada' : 'todas las fincas'} · periodo {periodo}. 
          {efficiencyPct ? ` Eficiencia estimada: ${efficiencyPct}%.` : ' Sin eficiencia calculada aún.'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Eficiencia promedio</h3>
          <p className="text-2xl font-bold text-gray-900">
            {efficiency?.averageEfficiency ? `${(Number(efficiency.averageEfficiency) * 100).toFixed(0)}%` : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Volumen acumulado</h3>
          <p className="text-2xl font-bold text-gray-900">
            {efficiency?.totalVolumeM3 ? `${Number(efficiency.totalVolumeM3).toFixed(2)} m³` : '—'}
          </p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Registrar evento de riego</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={selectedFarm}
                onChange={(e) => setSelectedFarm(e.target.value)}
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
                value={form.loteId}
                onChange={(e) => setForm({ ...form, loteId: e.target.value })}
              >
                <option value="">Seleccionar lote...</option>
                {plots.map((plot: any) => (
                  <option key={plot.id} value={plot.id}>{plot.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.fechaHora}
                onChange={(e) => setForm({ ...form, fechaHora: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración (minutos)</label>
              <input
                type="number"
                min="1"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.duracionMinutos}
                onChange={(e) => setForm({ ...form, duracionMinutos: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de riego</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.tipoRiego}
                onChange={(e) => setForm({ ...form, tipoRiego: e.target.value as any })}
              >
                {tiposRiego.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSchedule}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Registrar'}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-gray-200 px-4 py-2 rounded-xl text-sm">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Historial de riego por periodo</h2>
            <p className="mt-1 text-sm text-gray-500">Consulta la evolución del riego según el periodo activo.</p>
          </div>
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
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <Droplet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Sin eventos de riego registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Periodo</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Eventos</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Volumen total (m³)</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Promedio (m³)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((row: any) => (
                <tr key={row.period} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{row.period}</td>
                  <td className="px-6 py-3">{row.events}</td>
                  <td className="px-6 py-3">{Number(row.totalVolume || 0).toFixed(2)}</td>
                  <td className="px-6 py-3">{Number(row.averageVolume || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
