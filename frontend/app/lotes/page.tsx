'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Plus, Leaf, Pencil, Trash2, Eye, X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast-provider'

const tiposSuelo = ['arcilloso', 'arenoso', 'limoso', 'franco', 'orgánico']

type PlotFormState = { nombre: string; areaHectareas: string; tipoSuelo: string }

export default function LotesPage() {
  const router = useRouter()
  const { showToast, confirmToast } = useToast()
  const [farms, setFarms] = useState<any[]>([])
  const [plots, setPlots] = useState<any[]>([])
  const [selectedFarm, setSelectedFarm] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [form, setForm] = useState<PlotFormState>({ nombre: '', areaHectareas: '', tipoSuelo: 'franco' })
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null)
  const [selectedPlotDetail, setSelectedPlotDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loadingPlots, setLoadingPlots] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    fetchFarms()
  }, [])

  useEffect(() => {
    if (selectedFarm) fetchPlots(selectedFarm)
    else setPlots([])
  }, [selectedFarm])

  const fetchFarms = async () => {
    try {
      const data = await apiClient.farms.getAll()
      const list = Array.isArray(data) ? data : []
      setFarms(list)
      if (list.length > 0) setSelectedFarm(list[0].id)
    } catch { setFarms([]) }
    finally { setLoading(false) }
  }

  const fetchPlots = async (farmId: string) => {
    setLoadingPlots(true)
    try {
      const data = await apiClient.plots.getAllByFarm(farmId)
      setPlots(Array.isArray(data) ? data : [])
      setError('')
    } catch {
      // Fallback defensivo: si falla endpoint por finca, usamos listado total y filtramos en cliente
      try {
        const allPlots = await apiClient.plots.getAll()
        const filtered = Array.isArray(allPlots)
          ? allPlots.filter((plot: any) => plot.fincaId === farmId)
          : []
        setPlots(filtered)
        setError('')
      } catch {
        setPlots([])
        setError('No se pudieron cargar los lotes de la finca seleccionada')
      }
    } finally {
      setLoadingPlots(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFarm) { setError('Selecciona una finca primero'); return }
    setSaving(true); setError('')
    try {
      const created = await apiClient.plots.create({
        nombre: form.nombre,
        areaHectareas: parseFloat(form.areaHectareas),
        tipoSuelo: form.tipoSuelo,
        fincaId: selectedFarm,
      })
      resetForm()
      setShowCreateForm(false)
      setPlots((prev) => [created, ...prev])
      await fetchPlots(selectedFarm)
      showToast({ type: 'success', title: 'Lote creado correctamente' })
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const openEdit = (plot: any) => {
    setEditingPlotId(plot.id)
    setForm({
      nombre: plot.nombre ?? '',
      areaHectareas: String(plot.areaHectareas ?? ''),
      tipoSuelo: plot.tipoSuelo ?? 'franco',
    })
    setError('')
    setShowEditForm(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlotId) return
    setSaving(true); setError('')
    try {
      await apiClient.plots.update({
        id: editingPlotId,
        nombre: form.nombre,
        areaHectareas: parseFloat(form.areaHectareas),
        tipoSuelo: form.tipoSuelo,
      })
      resetForm()
      setShowEditForm(false)
      setEditingPlotId(null)
      if (selectedFarm) fetchPlots(selectedFarm)
      showToast({ type: 'success', title: 'Lote actualizado correctamente' })
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar el lote')
      showToast({
        type: 'error',
        title: 'No se pudo actualizar el lote',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (plot: any) => {
    const confirmed = await confirmToast({
      title: `Eliminar lote ${plot.nombre}`,
      description: 'Esta acción no se puede deshacer y quitará el lote del listado actual.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    })
    if (!confirmed) return

    setDeletingId(plot.id)
    setError('')
    try {
      await apiClient.plots.delete(plot.id)
      if (selectedFarm) fetchPlots(selectedFarm)
      showToast({ type: 'success', title: 'Lote eliminado correctamente' })
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar el lote')
      showToast({
        type: 'error',
        title: 'No se pudo eliminar el lote',
        description: err.message || 'Verifica si tiene datos asociados.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleViewDetail = async (plotId: string) => {
    setShowDetail(true)
    setLoadingDetail(true)
    setSelectedPlotDetail(null)
    setError('')
    try {
      const detail = await apiClient.plots.getOne(plotId)
      setSelectedPlotDetail(detail)
    } catch (err: any) {
      setError(err.message || 'No se pudo obtener el detalle del lote')
      showToast({
        type: 'error',
        title: 'No se pudo cargar el detalle del lote',
        description: err.message || 'Intenta nuevamente.',
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  const resetForm = () => {
    setForm({ nombre: '', areaHectareas: '', tipoSuelo: 'franco' })
  }

  const closeEdit = () => {
    setShowEditForm(false)
    setEditingPlotId(null)
    setError('')
    resetForm()
  }

  const totalArea = plots.reduce((sum, plot) => sum + Number(plot.areaHectareas || 0), 0)
  const activeSeasons = plots.filter((plot) => plot.temporadas?.[0]?.estado === 'activo').length
  const withCrop = plots.filter((plot) => Boolean(plot.temporadas?.[0]?.cultivo?.nombre)).length
  const selectedFarmName = farms.find((farm) => farm.id === selectedFarm)?.nombre || 'Sin selección'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-gradient-to-br from-green-600 via-emerald-600 to-green-700 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                Gestión por finca
              </div>
              <h1 className="mt-4 text-3xl font-bold">Lotes</h1>
              <p className="mt-2 text-sm text-white/85">
                Administra los lotes activos por finca con una lectura rápida de superficie, temporadas y contexto operativo.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Lotes visibles</p>
                  <p className="mt-1 text-2xl font-bold">{plots.length}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Área visible</p>
                  <p className="mt-1 text-2xl font-bold">{totalArea.toFixed(2)} ha</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Temporadas activas</p>
                  <p className="mt-1 text-2xl font-bold">{activeSeasons}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-gray-900 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Finca activa</p>
              <h2 className="mt-1 text-xl font-bold">{selectedFarmName}</h2>
              <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Lotes con cultivo asignado: <span className="font-semibold text-gray-900">{withCrop}</span>
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                disabled={farms.length === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-gray-300"
              >
                <Plus className="h-4 w-4" /> Nuevo Lote
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Selector operativo</h2>
          <p className="mt-1 text-sm text-gray-500">Cambia de finca para concentrarte en los lotes visibles de esa unidad agrícola.</p>
          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">Finca</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-400"
              value={selectedFarm}
              onChange={e => setSelectedFarm(e.target.value)}
            >
              <option value="">Seleccionar finca...</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          {farms.length === 0 && !loading && (
            <a href="/fincas" className="mt-4 inline-block text-sm text-green-600 hover:underline">Crear una finca primero →</a>
          )}
        </div>
      </div>

      {!!selectedFarm && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Lotes visibles</p>
            <p className="text-2xl font-bold text-gray-900">{plots.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Área acumulada</p>
            <p className="text-2xl font-bold text-gray-900">{totalArea.toFixed(2)} ha</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Con temporada activa</p>
            <p className="text-2xl font-bold text-gray-900">{activeSeasons}</p>
          </div>
        </div>
      )}
      {!!selectedFarm && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
          <p className="font-medium">Resumen operativo</p>
          <p className="mt-1">Lotes con cultivo asignado: {withCrop}. Usa "Detalle" para validar sensores, riego y predicciones antes de ejecutar acciones.</p>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Crear nuevo lote</h2>
          <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área (ha) *</label>
              <input type="number" step="0.01" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.areaHectareas} onChange={e => setForm({ ...form, areaHectareas: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de suelo</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.tipoSuelo} onChange={e => setForm({ ...form, tipoSuelo: e.target.value })}>
                {tiposSuelo.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            {error && <div className="md:col-span-3 text-red-600 text-sm">{error}</div>}
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="border border-gray-200 px-4 py-2 rounded-xl text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {showEditForm && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Editar lote</h2>
          <form onSubmit={handleUpdate} className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área (ha) *</label>
              <input type="number" step="0.01" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.areaHectareas} onChange={e => setForm({ ...form, areaHectareas: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de suelo</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.tipoSuelo} onChange={e => setForm({ ...form, tipoSuelo: e.target.value })}>
                {tiposSuelo.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            {error && <div className="md:col-span-3 text-red-600 text-sm">{error}</div>}
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Actualizando...' : 'Actualizar'}
              </button>
              <button type="button" onClick={closeEdit} className="border border-gray-200 px-4 py-2 rounded-xl text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {!selectedFarm ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center shadow-sm">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Selecciona una finca para ver sus lotes</p>
        </div>
      ) : loading || loadingPlots ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white border rounded-2xl p-5 h-32 animate-pulse shadow-sm" />)}
        </div>
      ) : plots.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center shadow-sm">
          <Leaf className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Esta finca no tiene lotes aún.</p>
          <button onClick={() => setShowCreateForm(true)} className="mt-3 text-green-600 text-sm font-medium">+ Crear primer lote</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plots.map((plot: any) => (
            <div key={plot.id} className="bg-white border border-gray-200 rounded-3xl p-5 hover:shadow-md transition-all shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="inline-flex p-2 bg-green-50 rounded-xl">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 capitalize">
                  {plot.tipoSuelo || 'sin suelo'}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{plot.nombre}</h3>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Área</span>
                  <span className="font-medium">{plot.areaHectareas} ha</span>
                </div>
                <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Tipo de suelo</span>
                  <span className="font-medium capitalize">{plot.tipoSuelo || '—'}</span>
                </div>
                {plot.temporadas?.[0] && (
                  <>
                    <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                      <span className="text-gray-500">Cultivo</span>
                      <span className="font-medium">{plot.temporadas[0].cultivo?.nombre}</span>
                    </div>
                    <div className="flex justify-between text-sm rounded-xl bg-gray-50 px-3 py-2">
                      <span className="text-gray-500">Estado</span>
                      <span className={`font-medium capitalize px-2 py-0.5 rounded-full text-xs ${
                        plot.temporadas[0].estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>{plot.temporadas[0].estado}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleViewDetail(plot.id)}
                  className="inline-flex items-center gap-1 border border-gray-200 px-3 py-1.5 rounded-xl text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Detalle
                </button>
                <button
                  onClick={() => openEdit(plot)}
                  className="inline-flex items-center gap-1 border border-amber-200 px-3 py-1.5 rounded-xl text-xs text-amber-700 hover:bg-amber-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(plot)}
                  disabled={deletingId === plot.id}
                  className="inline-flex items-center gap-1 border border-red-200 px-3 py-1.5 rounded-xl text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === plot.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-gray-200 p-6 max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Detalle de lote</h2>
              <button onClick={() => setShowDetail(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingDetail ? (
              <p className="text-sm text-gray-500">Cargando detalle...</p>
            ) : !selectedPlotDetail ? (
              <p className="text-sm text-red-600">No se pudo cargar el detalle.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-2xl p-3">
                    <p className="text-gray-500">Nombre</p>
                    <p className="font-medium text-gray-900">{selectedPlotDetail.nombre}</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3">
                    <p className="text-gray-500">Finca</p>
                    <p className="font-medium text-gray-900">{selectedPlotDetail.finca?.nombre ?? '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3">
                    <p className="text-gray-500">Área</p>
                    <p className="font-medium text-gray-900">{selectedPlotDetail.areaHectareas} ha</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3">
                    <p className="text-gray-500">Tipo de suelo</p>
                    <p className="font-medium text-gray-900 capitalize">{selectedPlotDetail.tipoSuelo ?? '—'}</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="border border-gray-200 rounded-2xl p-3 bg-white">
                    <p className="text-gray-500">Sensores</p>
                    <p className="font-semibold text-gray-900">{selectedPlotDetail.sensores?.length ?? 0}</p>
                  </div>
                  <div className="border border-gray-200 rounded-2xl p-3 bg-white">
                    <p className="text-gray-500">Eventos de riego</p>
                    <p className="font-semibold text-gray-900">{selectedPlotDetail.eventosRiego?.length ?? 0}</p>
                  </div>
                  <div className="border border-gray-200 rounded-2xl p-3 bg-white">
                    <p className="text-gray-500">Predicciones</p>
                    <p className="font-semibold text-gray-900">{selectedPlotDetail.predicciones?.length ?? 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
