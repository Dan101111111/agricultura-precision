'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { Plus, MapPin, Leaf } from 'lucide-react'
import { useToast } from '@/components/ui/toast-provider'

export default function FincasPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [farms, setFarms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', ubicacion: '', areaHectareas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    fetchFarms()
  }, [])

  const fetchFarms = async () => {
    try {
      const data = await apiClient.farms.getAll()
      setFarms(Array.isArray(data) ? data : [])
    } catch {
      setFarms([])
      showToast({
        type: 'error',
        title: 'No se pudieron cargar las fincas',
        description: 'Verifica la conexión con el backend.',
      })
    }
    finally { setLoading(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await apiClient.farms.create({
        nombre: form.nombre,
        ubicacion: form.ubicacion,
        areaHectareas: parseFloat(form.areaHectareas),
      })
      showToast({ type: 'success', title: 'Finca creada correctamente' })
      setForm({ nombre: '', ubicacion: '', areaHectareas: '' })
      setShowForm(false)
      fetchFarms()
    } catch (err: any) {
      setError(err.message)
      showToast({
        type: 'error',
        title: 'No se pudo crear la finca',
        description: err.message,
      })
    }
    finally { setSaving(false) }
  }

  const totalArea = farms.reduce((sum, farm) => sum + Number(farm.areaHectareas || 0), 0)
  const totalLotes = farms.reduce((sum, farm) => sum + Number(farm.lotes?.length || 0), 0)
  const avgArea = farms.length > 0 ? totalArea / farms.length : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-gradient-to-br from-green-600 via-emerald-600 to-green-700 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                Gestión agrícola
              </div>
              <h1 className="mt-4 text-3xl font-bold">Fincas</h1>
              <p className="mt-2 text-sm text-white/85">
                Centraliza tus fincas con una vista clara de superficie, ubicación y relación con los lotes operativos.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Registradas</p>
                  <p className="mt-1 text-2xl font-bold">{farms.length}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Área total</p>
                  <p className="mt-1 text-2xl font-bold">{totalArea.toFixed(2)} ha</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Lotes</p>
                  <p className="mt-1 text-2xl font-bold">{totalLotes}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-gray-900 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resumen</p>
              <h2 className="mt-1 text-xl font-bold">Lectura rápida</h2>
              <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Promedio de área por finca: <span className="font-semibold text-gray-900">{avgArea.toFixed(2)} ha</span>
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <Plus className="h-4 w-4" /> Nueva Finca
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Panorama</h2>
          <p className="mt-1 text-sm text-gray-500">Mantén nombre, ubicación y área al día para mejorar filtros y reportes.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Área promedio</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{avgArea.toFixed(2)} ha</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Densidad de lotes</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{farms.length > 0 ? (totalLotes / farms.length).toFixed(1) : '0.0'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Fincas registradas</p>
          <p className="text-2xl font-bold text-gray-900">{farms.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Área total</p>
          <p className="text-2xl font-bold text-gray-900">{totalArea.toFixed(2)} ha</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Lotes asociados</p>
          <p className="text-2xl font-bold text-gray-900">{totalLotes}</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">
        <p className="font-medium">Resumen operativo</p>
        <p className="mt-1">Promedio de área por finca: {avgArea.toFixed(2)} ha. Mantén ubicación y área actualizadas para mejorar filtros de lotes, sensores y reportes.</p>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Crear nueva finca</h2>
          <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.ubicacion}
                onChange={e => setForm({ ...form, ubicacion: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área (ha) *</label>
              <input type="number" step="0.01" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={form.areaHectareas} onChange={e => setForm({ ...form, areaHectareas: e.target.value })} required />
            </div>
            {error && <div className="md:col-span-3 text-red-600 text-sm">{error}</div>}
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-200 px-4 py-2 rounded-xl text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white border rounded-2xl p-5 h-32 animate-pulse shadow-sm" />)}
        </div>
      ) : farms.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center shadow-sm">
          <Leaf className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No tienes fincas registradas.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-green-600 text-sm font-medium">+ Crear primera finca</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map((farm: any) => (
            <div key={farm.id} className="bg-white border border-gray-200 rounded-3xl p-5 hover:shadow-md transition-all shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="inline-flex p-2 bg-green-50 rounded-xl">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200">
                  {farm.lotes?.length || 0} lotes
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{farm.nombre}</h3>
              {farm.ubicacion && <p className="text-sm text-gray-500 mt-1">{farm.ubicacion}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 px-3 py-3 text-sm">
                  <p className="text-gray-500">Área</p>
                  <p className="mt-1 font-semibold text-gray-900">{farm.areaHectareas} ha</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-3 py-3 text-sm">
                  <p className="text-gray-500">Lotes</p>
                  <p className="mt-1 font-semibold text-gray-900">{farm.lotes?.length || 0}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
