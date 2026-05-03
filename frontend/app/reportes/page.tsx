'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast-provider'

const reportTypeConfig: Record<string, {
  label: string
  badge: string
  card: string
  soft: string
  accent: string
  button: string
  border: string
  description: string
  insight: string
}> = {
  operacional: {
    label: 'Operacional',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    card: 'bg-gradient-to-br from-emerald-600 to-green-700 text-white',
    soft: 'bg-emerald-50',
    accent: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400',
    border: 'border-emerald-200',
    description: 'Supervisión diaria del estado del sistema, alertas activas y operación agrícola.',
    insight: 'Ideal para decisiones rápidas de monitoreo, control y seguimiento cotidiano.',
  },
  riego: {
    label: 'Riego',
    badge: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    card: 'bg-gradient-to-br from-cyan-600 to-sky-700 text-white',
    soft: 'bg-cyan-50',
    accent: 'text-cyan-700',
    button: 'bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400',
    border: 'border-cyan-200',
    description: 'Trazabilidad hídrica con volumen, eficiencia y eventos recientes registrados.',
    insight: 'Úsalo para validar ejecución de riego y mantener consistencia horaria de campo.',
  },
  prediccion: {
    label: 'Predicción',
    badge: 'bg-violet-50 text-violet-700 border border-violet-200',
    card: 'bg-gradient-to-br from-violet-600 to-purple-700 text-white',
    soft: 'bg-violet-50',
    accent: 'text-violet-700',
    button: 'bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400',
    border: 'border-violet-200',
    description: 'Resultados de modelos, rendimiento estimado y soporte analítico para cultivo.',
    insight: 'Recomendado para revisar tendencias productivas y señales de la campaña.',
  },
  gestion: {
    label: 'Gestión',
    badge: 'bg-green-50 text-green-700 border border-green-200',
    card: 'bg-gradient-to-br from-green-600 to-lime-700 text-white',
    soft: 'bg-green-50',
    accent: 'text-green-700',
    button: 'bg-green-600 hover:bg-green-700 disabled:bg-green-400',
    border: 'border-green-200',
    description: 'Indicadores ejecutivos para superficie, fincas, lotes y seguimiento consolidado.',
    insight: 'Útil para revisiones semanales, gerenciales y priorización de recursos.',
  },
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatLocalDate(value?: string | Date | null) {
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

function getTypeConfig(tipo: string) {
  return reportTypeConfig[tipo] || reportTypeConfig.operacional
}

export default function ReportesPage() {
  const router = useRouter()
  const { showToast, confirmToast } = useToast()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reportType, setReportType] = useState<'operacional' | 'gestion' | 'prediccion' | 'riego'>('operacional')
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login')
      return
    }
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const data = await apiClient.reports.getAll()
      setReports(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setReports([])
      setError(err?.message || 'No se pudieron cargar los reportes')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      await apiClient.reports.generate(reportType, reportFormat)
      await fetchReports()
      showToast({ type: 'success', title: `Reporte ${reportFormat.toUpperCase()} generado` })
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el reporte')
      showToast({
        type: 'error',
        title: 'No se pudo generar el reporte',
        description: err?.message || 'Intenta nuevamente.',
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (report: any) => {
    if (report.urlArchivo) {
      window.open(report.urlArchivo, '_blank', 'noopener,noreferrer')
      return
    }
    setDownloadingId(report.id)
    setError('')
    try {
      const file = await apiClient.reports.download(report.id)
      const content = file.encoding === 'base64'
        ? Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0))
        : file.content
      const blob = new Blob([content], { type: file.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.fileName || `reporte-${report.id}.${report.formato || 'pdf'}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      await fetchReports()
      showToast({ type: 'success', title: 'Reporte descargado correctamente' })
    } catch (err: any) {
      setError(err?.message || 'No se pudo descargar el reporte')
      showToast({
        type: 'error',
        title: 'No se pudo descargar el reporte',
        description: err?.message || 'Intenta nuevamente.',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (report: any) => {
    const ok = await confirmToast({
      title: `Eliminar reporte ${report.tipo.toUpperCase()}`,
      description: `Se eliminará el reporte ${report.id.slice(0, 8)} del historial. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    })
    if (!ok) return
    setDeletingId(report.id)
    setError('')
    try {
      await apiClient.reports.delete(report.id)
      setReports((prev) => prev.filter((r) => r.id !== report.id))
      showToast({ type: 'success', title: 'Reporte eliminado correctamente' })
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el reporte')
      showToast({
        type: 'error',
        title: 'No se pudo eliminar el reporte',
        description: err?.message || 'Intenta nuevamente.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const totalReports = reports.length
  const pdfCount = reports.filter((report) => report.formato === 'pdf').length
  const csvCount = reports.filter((report) => report.formato === 'csv').length
  const latestGenerated = formatLocalDate(reports[0]?.generadoEn)
  const downloadedCount = reports.filter((report) => report.descargadoEn).length
  const selectedTypeConfig = getTypeConfig(reportType)
  const countsByType = Object.keys(reportTypeConfig).map((tipo) => ({
    tipo,
    total: reports.filter((report) => report.tipo === tipo).length,
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <div className={`${selectedTypeConfig.card} rounded-3xl p-6 shadow-sm`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                Centro de reportes
              </div>
              <h1 className="mt-4 text-3xl font-bold">Reportes más visuales, descriptivos y listos para descargar</h1>
              <p className="mt-3 text-sm text-white/85">
                Genera documentos con mejor presentación, mayor contexto y un estilo adaptable al tipo de reporte.
                El historial también conserva la misma lógica visual para identificar rápidamente qué descargaste.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Reportes totales</p>
                  <p className="mt-1 text-2xl font-bold">{totalReports}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Última emisión</p>
                  <p className="mt-1 text-sm font-semibold">{latestGenerated}</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-white/70">Descargados</p>
                  <p className="mt-1 text-2xl font-bold">{downloadedCount}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-md rounded-3xl bg-white p-5 text-gray-900 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vista previa del tipo</p>
                  <h2 className="mt-1 text-xl font-bold">{selectedTypeConfig.label}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedTypeConfig.badge}`}>
                  {reportFormat.toUpperCase()}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">{selectedTypeConfig.description}</p>
              <p className="mt-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {selectedTypeConfig.insight}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as 'operacional' | 'gestion' | 'prediccion' | 'riego')}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                >
                  <option value="operacional">Operacional</option>
                  <option value="gestion">Gestión</option>
                  <option value="prediccion">Predicción</option>
                  <option value="riego">Riego</option>
                </select>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value as 'pdf' | 'csv')}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors ${selectedTypeConfig.button}`}
              >
                <FileText className="h-4 w-4" /> {generating ? 'Generando reporte...' : 'Generar reporte'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Resumen del módulo</h2>
            <p className="mt-1 text-sm text-gray-500">Indicadores rápidos del historial disponible y del comportamiento de descarga.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">PDF generados</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{pdfCount}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">CSV generados</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{csvCount}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Tasa de descarga</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{totalReports > 0 ? `${Math.round((downloadedCount / totalReports) * 100)}%` : '0%'}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Última generación</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{latestGenerated}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {countsByType.map(({ tipo, total }) => {
              const config = getTypeConfig(tipo)
              const percentage = totalReports > 0 ? Math.round((total / totalReports) * 100) : 0
              return (
                <div key={tipo} className="rounded-2xl border border-gray-100 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${config.badge}`}>{config.label}</span>
                    <span className="text-sm font-semibold text-gray-700">{total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className={`h-2 rounded-full ${config.soft.replace('bg-', 'bg-').includes('emerald') ? 'bg-emerald-500' : config.soft.includes('cyan') ? 'bg-cyan-500' : config.soft.includes('violet') ? 'bg-violet-500' : 'bg-green-500'}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total reportes</p>
          <p className="text-2xl font-bold text-gray-900">{totalReports}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">PDF</p>
          <p className="text-2xl font-bold text-gray-900">{pdfCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">CSV</p>
          <p className="text-2xl font-bold text-gray-900">{csvCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Última generación</p>
          <p className="text-sm font-semibold text-gray-900">{latestGenerated}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          <p className="font-semibold">Uso recomendado</p>
          <p className="mt-2">
            Operacional para control diario, Predicción para decisiones de cultivo, Riego para seguimiento hídrico y Gestión para revisión ejecutiva.
            Cada descarga ahora refuerza visualmente ese contexto según su tipo.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700 shadow-sm">
          <p className="font-semibold text-gray-900">Qué encontrarás en los reportes</p>
          <div className="mt-3 space-y-2">
            <p>Resumen ejecutivo con hallazgos clave.</p>
            <p>Secciones más detalladas por dominio.</p>
            <p>Fechas y horas consistentes en horario de Perú.</p>
          </div>
        </div>
      </div>

      {/* Report types info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(reportTypeConfig).map(([key, config]) => (
          <div key={key} className={`border ${config.border} ${config.soft} rounded-2xl p-5 shadow-sm`}>
            <FileText className={`mb-3 h-5 w-5 ${config.accent}`} />
            <div className={`text-sm font-semibold ${config.accent}`}>{config.label}</div>
            <div className="mt-1 text-xs text-gray-600">{config.description}</div>
            <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-gray-700">
              {config.insight}
            </div>
          </div>
        ))}
      </div>

      {/* Reports table */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200 flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <div>
            <h2 className="font-semibold text-gray-900">Historial de reportes</h2>
            <p className="mt-1 text-sm text-gray-500">Consulta formato, tipo, fecha local y estado de descarga de cada documento generado.</p>
          </div>
          <div className="text-xs text-gray-500">
            Horario visualizado: <span className="font-semibold text-gray-700">America/Lima</span>
          </div>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No hay reportes generados todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Tipo</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Detalle</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Formato</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Generado</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Descargado</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Tamaño</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report: any) => {
                const config = getTypeConfig(report.tipo)
                return (
                <tr key={report.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${config.badge}`}>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="max-w-xs">
                      <p className="font-medium text-gray-900">{config.description}</p>
                      <p className="mt-1 text-xs text-gray-500">ID {report.id.slice(0, 8)} · {report.urlArchivo ? 'archivo externo' : 'generación interna'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3 uppercase text-xs font-mono text-gray-600">{report.formato}</td>
                  <td className="px-6 py-3 text-gray-600">{formatLocalDate(report.generadoEn)}</td>
                  <td className="px-6 py-3 text-gray-600">{formatLocalDate(report.descargadoEn)}</td>
                  <td className="px-6 py-3 text-gray-600">{report.tamanioBytes ? formatBytes(report.tamanioBytes) : '—'}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDownload(report)}
                        disabled={downloadingId === report.id}
                        className="flex items-center gap-1 text-green-600 hover:text-green-700 disabled:text-gray-400 text-xs font-medium"
                      >
                        <Download className="h-3.5 w-3.5" /> {downloadingId === report.id ? 'Descargando...' : 'Descargar'}
                      </button>
                      <button
                        onClick={() => handleDelete(report)}
                        disabled={deletingId === report.id}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:text-gray-400 text-xs font-medium"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {deletingId === report.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
