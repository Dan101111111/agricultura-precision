import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument = require('pdfkit');
import { SensorsService } from '../sensors/sensors.service';

const ALLOWED_REPORT_TYPES = ['operacional', 'gestion', 'prediccion', 'riego'] as const;
const ALLOWED_REPORT_FORMATS = ['pdf', 'csv'] as const;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private sensorsService: SensorsService,
  ) {}

  async getReports(usuarioId: string) {
    return this.prisma.reporte.findMany({
      where: { usuarioId },
      orderBy: { generadoEn: 'desc' },
    });
  }

  async generateReport(
    usuarioId: string,
    input: { tipo: 'operacional' | 'gestion' | 'prediccion' | 'riego'; formato?: 'pdf' | 'csv' },
  ) {
    const tipo = this.validateReportType(input.tipo);
    const formato = this.validateReportFormat(input.formato);
    const generatedAt = new Date();

    try {
      const snapshot = await this.buildSnapshot(usuarioId, tipo);
      const normalizedSnapshot = this.normalizeSnapshot(snapshot);
      const tamanioBytes = formato === 'pdf'
        ? (await this.snapshotToPdf(normalizedSnapshot)).length
        : Buffer.byteLength(this.snapshotToCsv(normalizedSnapshot), 'utf8');

      return this.prisma.reporte.create({
        data: {
          usuarioId,
          tipo,
          formato,
          tamanioBytes,
          parametrosFiltros: {
            source: 'dashboard',
            generatedAt: generatedAt.toISOString(),
            reportVersion: 'v2',
            renderProfile: {
              pageSize: 'A4',
              margin: 44,
              timezone: 'America/Lima',
            },
            summary: {
              sections: normalizedSnapshot.sections.length,
              highlights: normalizedSnapshot.highlights.length,
              notes: normalizedSnapshot.notes.length,
            },
            snapshot: normalizedSnapshot,
          },
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('No se pudo generar el reporte solicitado');
    }
  }

  async downloadReport(reportId: string, usuarioId: string) {
    const report = await this.prisma.reporte.findFirst({
      where: { id: reportId, usuarioId },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    try {
      const snapshot = (report.parametrosFiltros as any)?.snapshot;
      const finalSnapshot = this.normalizeSnapshot(
        snapshot ?? (await this.buildSnapshot(usuarioId, this.validateReportType(report.tipo))),
      );
      const isPdf = this.validateReportFormat(report.formato) === 'pdf';
      const content = isPdf
        ? await this.snapshotToPdf(finalSnapshot)
        : this.snapshotToCsv(finalSnapshot);

      await this.prisma.reporte.update({
        where: { id: report.id },
        data: {
          descargadoEn: new Date(),
          tamanioBytes: isPdf ? content.length : Buffer.byteLength(content, 'utf8'),
          parametrosFiltros: {
            ...((report.parametrosFiltros as any) ?? {}),
            lastDownloadedAt: new Date().toISOString(),
            snapshot: finalSnapshot,
          },
        },
      });

      const safeType = (report.tipo || 'reporte').toLowerCase();
      const extension = isPdf ? 'pdf' : 'csv';
      const fileName = `reporte-${safeType}-${report.id.slice(0, 8)}.${extension}`;
      return {
        fileName,
        mimeType: isPdf ? 'application/pdf' : 'text/csv;charset=utf-8',
        content: isPdf ? content.toString('base64') : content,
        encoding: isPdf ? 'base64' : 'utf8',
      };
    } catch (error) {
      throw new InternalServerErrorException('No se pudo preparar la descarga del reporte');
    }
  }

  async deleteReport(reportId: string, usuarioId: string) {
    const report = await this.prisma.reporte.findFirst({
      where: { id: reportId, usuarioId },
      select: { id: true },
    });
    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }
    await this.prisma.reporte.delete({
      where: { id: report.id },
    });
    return { success: true };
  }

  private async buildSnapshot(usuarioId: string, tipo: string) {
    const now = new Date();
    const [totalFarms, totalPlots, unreadAlerts, sensorsOverview, recentAlerts] = await Promise.all([
      this.prisma.finca.count({ where: { usuarioId } }),
      this.prisma.lote.count({ where: { finca: { usuarioId } } }),
      this.prisma.alerta.count({ where: { usuarioId, leida: false } }),
      this.sensorsService.getOverview(usuarioId),
      this.prisma.alerta.findMany({
        where: { usuarioId },
        include: {
          lote: {
            select: { nombre: true },
          },
        },
        orderBy: { creadaEn: 'desc' },
        take: 3,
      }),
    ]);
    const activeSensorRate = sensorsOverview.totalSensors > 0
      ? (sensorsOverview.activeSensors / sensorsOverview.totalSensors) * 100
      : 0;
    const averagePlotsPerFarm = totalFarms > 0 ? totalPlots / totalFarms : 0;

    const baseSections: Array<{ title: string; rows: Array<{ label: string; value: string }> }> = [
      {
        title: 'Resumen General',
        rows: [
          { label: 'Fincas registradas', value: String(totalFarms) },
          { label: 'Lotes registrados', value: String(totalPlots) },
          { label: 'Alertas sin leer', value: String(unreadAlerts) },
          { label: 'Promedio de lotes por finca', value: averagePlotsPerFarm.toFixed(1) },
        ],
      },
      {
        title: 'Estado de Sensores',
        rows: [
          { label: 'Sensores activos', value: String(sensorsOverview.activeSensors) },
          { label: 'Sensores totales', value: String(sensorsOverview.totalSensors) },
          { label: 'Lecturas en 24h', value: String(sensorsOverview.readings24h) },
          { label: 'Cobertura activa', value: `${activeSensorRate.toFixed(1)}%` },
        ],
      },
      {
        title: 'Contexto Operativo',
        rows: [
          { label: 'Fecha de emisión (Perú)', value: this.formatDateTime(now) },
          { label: 'Frecuencia sugerida', value: this.getSuggestedCadence(tipo) },
          { label: 'Enfoque del reporte', value: this.getReportSubtitle(tipo) },
        ],
      },
    ];

    const tipoEspecifico = await this.buildTypeSpecificSection(usuarioId, tipo);
    const latestAlerts = recentAlerts.length > 0
      ? recentAlerts.map((alert) => {
          const location = alert.lote?.nombre ? ` · ${alert.lote.nombre}` : '';
          return `${alert.tipo}${location}: ${alert.mensaje}`;
        })
      : [];

    return {
      tipo,
      generadoEn: now.toISOString(),
      titulo: this.getReportTitle(tipo),
      subtitulo: this.getReportSubtitle(tipo),
      highlights: [
        `${totalFarms} fincas y ${totalPlots} lotes se encuentran bajo seguimiento en el sistema.`,
        sensorsOverview.totalSensors > 0
          ? `${sensorsOverview.activeSensors} de ${sensorsOverview.totalSensors} sensores están activos (${activeSensorRate.toFixed(1)}% de cobertura).`
          : 'No se registran sensores activos actualmente.',
        unreadAlerts > 0
          ? `Existen ${unreadAlerts} alertas pendientes de revisión para priorizar acciones.`
          : 'No hay alertas pendientes al momento de la emisión del reporte.',
        ...tipoEspecifico.highlights,
      ],
      sections: [...baseSections, ...tipoEspecifico.sections],
      notes: [...this.getReportNotes(tipo), ...latestAlerts],
    };
  }

  private async buildTypeSpecificSection(usuarioId: string, tipo: string) {
    if (tipo === 'gestion') {
      const [fincaAgg, topFarms] = await Promise.all([
        this.prisma.finca.aggregate({
          where: { usuarioId },
          _sum: { areaHectareas: true },
          _avg: { areaHectareas: true },
        }),
        this.prisma.finca.findMany({
          where: { usuarioId },
          include: { lotes: true },
          orderBy: { areaHectareas: 'desc' },
          take: 3,
        }),
      ]);

      const rows = [
        { label: 'Area total (ha)', value: Number(fincaAgg._sum.areaHectareas ?? 0).toFixed(2) },
        { label: 'Area promedio por finca (ha)', value: Number(fincaAgg._avg.areaHectareas ?? 0).toFixed(2) },
        { label: 'Fincas analizadas', value: String(topFarms.length) },
      ];

      const highlightedFarms: Array<{ label: string; value: string }> = [];

      topFarms.forEach((farm, idx) => {
        rows.push({
          label: `Top ${idx + 1} finca`,
          value: `${farm.nombre} (${Number(farm.areaHectareas ?? 0).toFixed(2)} ha, ${farm.lotes.length} lotes)`,
        });
        highlightedFarms.push({
          label: farm.nombre,
          value: `${farm.ubicacion || 'Ubicación no registrada'} · ${farm.lotes.length} lotes · ${Number(farm.areaHectareas ?? 0).toFixed(2)} ha`,
        });
      });

      return {
        sections: [
          { title: 'Indicadores de Gestion', rows },
          { title: 'Fincas Destacadas', rows: highlightedFarms },
        ],
        highlights: [
          `La superficie agrícola consolidada asciende a ${Number(fincaAgg._sum.areaHectareas ?? 0).toFixed(2)} ha.`,
          topFarms[0]
            ? `La finca con mayor superficie es ${topFarms[0].nombre} con ${Number(topFarms[0].areaHectareas ?? 0).toFixed(2)} ha.`
            : 'No se encontraron fincas destacadas para este periodo.',
        ],
      };
    }

    if (tipo === 'prediccion') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [agg, latest] = await Promise.all([
        this.prisma.prediccionRendimiento.aggregate({
          where: {
            lote: { finca: { usuarioId } },
            fechaPrediccion: { gte: monthStart },
          },
          _count: { _all: true },
          _avg: { rendimientoEstimadoKgHa: true },
        }),
        this.prisma.prediccionRendimiento.findMany({
          where: { lote: { finca: { usuarioId } } },
          include: { lote: true },
          orderBy: { fechaPrediccion: 'desc' },
          take: 3,
        }),
      ]);

      const rows = [
        { label: 'Predicciones del mes', value: String(agg._count._all) },
        { label: 'Rendimiento promedio del mes (kg/ha)', value: Number(agg._avg.rendimientoEstimadoKgHa ?? 0).toFixed(2) },
      ];

      latest.forEach((item, idx) => {
        rows.push({
          label: `Prediccion reciente ${idx + 1}`,
          value: `${item.lote.nombre}: ${Number(item.rendimientoEstimadoKgHa ?? 0).toFixed(2)} kg/ha · ${this.formatDateOnly(item.fechaPrediccion)}`,
        });
        if (idx === 0) {
          rows.push({
            label: 'Precision de la ultima prediccion',
            value: item.precisionModelo ? `${(Number(item.precisionModelo) * 100).toFixed(1)}%` : '—',
          });
          rows.push({
            label: 'Modelo de la ultima prediccion',
            value: item.modeloUtilizado || '—',
          });
          rows.push({
            label: 'Intervalo de confianza de la ultima prediccion',
            value: item.intervaloConfianzaInf !== null && item.intervaloConfianzaSup !== null
              ? `${Number(item.intervaloConfianzaInf).toFixed(2)} - ${Number(item.intervaloConfianzaSup).toFixed(2)} kg/ha`
              : '—',
          });
        }
      });

      return {
        sections: [{ title: 'Analitica de Prediccion', rows }],
        highlights: [
          `Se registraron ${agg._count._all} predicciones en el mes actual.`,
          `El rendimiento promedio estimado del mes es ${Number(agg._avg.rendimientoEstimadoKgHa ?? 0).toFixed(2)} kg/ha.`,
          latest[0]
            ? `La predicción más reciente corresponde al lote ${latest[0].lote.nombre}.`
            : 'No se encontraron predicciones recientes.',
        ],
      };
    }

    if (tipo === 'riego') {
      const events = await this.prisma.eventoRiego.findMany({
        where: { lote: { finca: { usuarioId } } },
        include: {
          lote: {
            select: { nombre: true },
          },
        },
        orderBy: { fechaHora: 'desc' },
        take: 300,
      });

      const totalVolume = events.reduce((sum, e) => sum + Number(e.volumenM3 ?? 0), 0);
      const averageEfficiency = events.length > 0
        ? events.reduce((sum, e) => sum + Number(e.eficiencia ?? 0), 0) / events.length
        : 0;
      const byType: Record<string, number> = {};
      events.forEach((e) => {
        byType[e.tipoRiego] = (byType[e.tipoRiego] ?? 0) + 1;
      });

      const rows = [
        { label: 'Eventos de riego', value: String(events.length) },
        { label: 'Volumen total (m3)', value: totalVolume.toFixed(2) },
        { label: 'Eficiencia promedio', value: `${(averageEfficiency * 100).toFixed(1)}%` },
        { label: 'Duracion promedio (min)', value: events.length > 0 ? (events.reduce((sum, e) => sum + Number(e.duracionMinutos ?? 0), 0) / events.length).toFixed(1) : '0.0' },
      ];
      Object.entries(byType).forEach(([type, count]) => {
        rows.push({ label: `Eventos ${type}`, value: String(count) });
      });

      const recentEvents = events.slice(0, 5).map((event, idx) => ({
        label: `Evento reciente ${idx + 1}`,
        value: `${event.lote?.nombre || 'Lote sin nombre'} · ${event.tipoRiego} · ${this.formatDateTime(event.fechaHora)} · ${Number(event.volumenM3 ?? 0).toFixed(2)} m3`,
      }));

      return {
        sections: [
          { title: 'Indicadores de Riego', rows },
          { title: 'Trazabilidad de Eventos Recientes', rows: recentEvents },
        ],
        highlights: [
          `Se consolidaron ${events.length} eventos de riego para el análisis histórico.`,
          `El volumen acumulado alcanza ${totalVolume.toFixed(2)} m3 con una eficiencia media de ${(averageEfficiency * 100).toFixed(1)}%.`,
          events[0]
            ? `El último riego registrado ocurrió el ${this.formatDateTime(events[0].fechaHora)} en el lote ${events[0].lote?.nombre || 'sin identificar'}.`
            : 'No se registran eventos de riego recientes.',
        ],
      };
    }

    const [predAgg, irrAgg] = await Promise.all([
      this.prisma.prediccionRendimiento.aggregate({
        where: { lote: { finca: { usuarioId } } },
        _count: { _all: true },
        _avg: { rendimientoEstimadoKgHa: true },
      }),
      this.prisma.eventoRiego.aggregate({
        where: { lote: { finca: { usuarioId } } },
        _count: { _all: true },
        _sum: { volumenM3: true },
      }),
    ]);

    return {
      sections: [
        {
          title: 'Operacion del Sistema',
          rows: [
            { label: 'Predicciones registradas', value: String(predAgg._count._all) },
            { label: 'Rendimiento promedio (kg/ha)', value: Number(predAgg._avg.rendimientoEstimadoKgHa ?? 0).toFixed(2) },
            { label: 'Eventos de riego', value: String(irrAgg._count._all) },
            { label: 'Volumen de riego (m3)', value: Number(irrAgg._sum.volumenM3 ?? 0).toFixed(2) },
          ],
        },
      ],
      highlights: [
        `El sistema consolida ${predAgg._count._all} predicciones y ${irrAgg._count._all} eventos de riego registrados.`,
        `El volumen histórico de riego es ${Number(irrAgg._sum.volumenM3 ?? 0).toFixed(2)} m3.`,
      ],
    };
  }

  private snapshotToCsv(snapshot: Record<string, any>) {
    const normalized = this.normalizeSnapshot(snapshot);
    const lines = [['campo', 'valor']];
    lines.push(['titulo', this.escapeCsvValue(normalized.titulo)]);
    lines.push(['subtitulo', this.escapeCsvValue(normalized.subtitulo)]);
    lines.push(['tipo', this.escapeCsvValue(normalized.tipo)]);
    lines.push(['generadoEn', this.escapeCsvValue(normalized.generadoEn)]);
    lines.push(['generadoEnLocal', this.escapeCsvValue(this.formatDateTime(normalized.generadoEn))]);
    if (normalized.highlights.length > 0) {
      lines.push(['[Resumen ejecutivo]', '']);
      normalized.highlights.forEach((highlight, idx) => {
        lines.push([`Hallazgo ${idx + 1}`, this.escapeCsvValue(highlight)]);
      });
    }
    normalized.sections.forEach((section) => {
      lines.push([`[${section.title}]`, '']);
      section.rows.forEach((row) => {
        lines.push([this.escapeCsvValue(row.label), this.escapeCsvValue(row.value)]);
      });
    });
    if (normalized.notes.length > 0) {
      lines.push(['[Notas]', '']);
      normalized.notes.forEach((note, idx) => {
        lines.push([`Nota ${idx + 1}`, this.escapeCsvValue(note)]);
      });
    }
    return lines.map((row) => row.join(',')).join('\n');
  }

  private escapeCsvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private async snapshotToPdf(snapshot: Record<string, any>): Promise<Buffer> {
    const normalized = this.normalizeSnapshot(snapshot);
    const doc = new PDFDocument({ size: 'A4', margin: 44 });
    const chunks: Buffer[] = [];
    const generatedAt = this.formatDateTime(normalized.generadoEn);
    const reportType = String(normalized.tipo ?? 'general').toUpperCase();
    const palette = this.getReportPalette(normalized.tipo);
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const frameX = 26;
    const frameY = 24;
    const frameWidth = pageWidth - 52;
    const frameHeight = pageHeight - 48;
    const contentX = 44;
    const contentWidth = pageWidth - 88;
    const footerY = pageHeight - 56;
    const bottomLimit = pageHeight - 108;
    const sectionInset = 12;
    const headerCardWidth = 158;
    const headerCardHeight = 64;
    const headerCardX = contentX + contentWidth - headerCardWidth;
    const headerCardY = 40;
    const headerTextWidth = Math.max(220, headerCardX - contentX - 26);
    let pageNumber = 1;

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const drawPageFrame = (continuation = false) => {
        doc.roundedRect(frameX, frameY, frameWidth, frameHeight, 18).fillAndStroke('#ffffff', '#d1d5db');
        doc.roundedRect(frameX + 10, frameY + 10, frameWidth - 20, 26, 10).fill(continuation ? '#f8fafc' : '#f0fdf4');
        doc.fillColor(continuation ? '#475569' : palette.primary)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(
            continuation ? `${normalized.titulo || 'Reporte'} · Continuación` : 'Documento ejecutivo',
            frameX + 24,
            frameY + 18,
            { width: 260 },
          );
      };

      const drawFooter = () => {
        doc.fillColor('#6b7280')
          .font('Helvetica')
          .fontSize(8)
          .text(`Documento generado automáticamente por AgriPrecision · Página ${pageNumber}`, contentX, footerY, { align: 'center', width: contentWidth });
      };

      const ensureSpace = (requiredHeight: number, nextY: number) => {
        if (nextY + requiredHeight <= bottomLimit) {
          return nextY;
        }
        drawFooter();
        doc.addPage();
        pageNumber += 1;
        drawPageFrame(true);
        return 76;
      };

      drawPageFrame(false);
      doc.rect(0, 0, 595, 118).fill(palette.primary);
      doc.rect(0, 118, 595, 10).fill(palette.accent);
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('AgriPrecision', 50, 36)
        .fontSize(16)
        .text(normalized.titulo || 'Reporte', 50, 66, { width: headerTextWidth });
      doc.fillColor('#e5f7ef')
        .font('Helvetica')
        .fontSize(10)
        .text(normalized.subtitulo || 'Reporte consolidado del sistema agrícola.', 50, 92, { width: headerTextWidth, lineGap: 1 });

      doc.roundedRect(headerCardX, headerCardY, headerCardWidth, headerCardHeight, 12).fillAndStroke('#ffffff', '#e5e7eb');
      doc
        .fillColor(palette.primary)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Ficha del documento', headerCardX + 16, headerCardY + 15)
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(`Tipo: ${reportType}`, headerCardX + 16, headerCardY + 33)
        .text(`Emitido: ${generatedAt}`, headerCardX + 16, headerCardY + 47, { width: headerCardWidth - 28 });

      doc.roundedRect(50, 146, 495, 74, 12).fillAndStroke('#ffffff', '#dcfce7');
      doc.fillColor('#374151')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Resumen ejecutivo', 64, 162);
      doc.fillColor('#4b5563')
        .font('Helvetica')
        .fontSize(9)
        .text(`Fecha de generación: ${generatedAt}`, 64, 180)
        .text(`Secciones incluidas: ${normalized.sections.length}`, 250, 180)
        .text(`Notas y observaciones: ${normalized.notes.length}`, 420, 180, { width: 110, align: 'right' });

      let y = 244;
      if (normalized.highlights.length > 0) {
        const highlightsText = normalized.highlights.map((highlight, idx) => `${idx + 1}. ${highlight}`).join('\n');
        const highlightsHeight = Math.max(60, doc.heightOfString(highlightsText, { width: 455, align: 'left' }) + 28);
        y = ensureSpace(highlightsHeight + 18, y);
        doc.roundedRect(50, y, 495, highlightsHeight, 14).fillAndStroke(palette.soft, '#dbeafe');
        doc.fillColor(palette.primary)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text('Hallazgos clave', 64, y + 12);
        doc.fillColor('#374151')
          .font('Helvetica')
          .fontSize(9)
          .text(highlightsText, 64, y + 30, { width: 455, lineGap: 2 });
        y += highlightsHeight + 18;
      }

      normalized.sections.forEach((section) => {
        y = ensureSpace(40, y);

        doc.roundedRect(50, y, 495, 26, 10).fillAndStroke(palette.soft, '#d1d5db');
        doc
          .fillColor(palette.primary)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(section.title, 64, y + 7);
        y += 38;

        section.rows.forEach((row, idx) => {
          const rowLabel = String(row.label ?? '—');
          const rowValue = String(row.value ?? '—');
          const labelHeight = doc.heightOfString(rowLabel, { width: 196 });
          const valueHeight = doc.heightOfString(rowValue, { width: 223, align: 'right' });
          const rowHeight = Math.max(28, Math.max(labelHeight, valueHeight) + 18);
          y = ensureSpace(rowHeight + 8, y);
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.roundedRect(50, y, 495, rowHeight, 10).fillAndStroke(bg, '#e5e7eb');
          doc.fillColor('#4b5563').font('Helvetica').fontSize(10).text(rowLabel, 62, y + sectionInset, { width: 196 });
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text(rowValue, 310, y + sectionInset, { width: 223, align: 'right' });
          y += rowHeight + 8;
        });

        y += 16;
      });

      if (normalized.notes.length > 0) {
        y = ensureSpace(36, y);
        doc.roundedRect(50, y, 495, 26, 10).fillAndStroke('#f8fafc', '#d1d5db');
        doc.fillColor(palette.primary).font('Helvetica-Bold').fontSize(11).text('Notas', 64, y + 7);
        y += 40;
        normalized.notes.forEach((note) => {
          const noteText = `- ${note}`;
          const noteHeight = Math.max(18, doc.heightOfString(noteText, { width: 455, lineGap: 2 }) + 8);
          y = ensureSpace(noteHeight + 4, y);
          doc.roundedRect(50, y, 495, noteHeight, 8).fillAndStroke('#ffffff', '#e5e7eb');
          doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(noteText, 62, y + 5, { width: 455, lineGap: 2 });
          y += noteHeight + 4;
        });
      }

      drawFooter();
      doc.end();
    });
  }

  private normalizeSnapshot(snapshot: Record<string, any>) {
    if (snapshot?.sections && Array.isArray(snapshot.sections)) {
      return {
        tipo: snapshot.tipo ?? 'operacional',
        generadoEn: snapshot.generadoEn ?? new Date().toISOString(),
        titulo: snapshot.titulo ?? this.getReportTitle(snapshot.tipo ?? 'operacional'),
        subtitulo: snapshot.subtitulo ?? this.getReportSubtitle(snapshot.tipo ?? 'operacional'),
        highlights: Array.isArray(snapshot.highlights) ? snapshot.highlights.map((item: unknown) => String(item)) : [],
        sections: snapshot.sections.map((section: any) => ({
          title: String(section?.title ?? 'Sección'),
          rows: Array.isArray(section?.rows)
            ? section.rows.map((row: any) => ({
                label: String(row?.label ?? '—'),
                value: String(row?.value ?? '—'),
              }))
            : [],
        })),
        notes: Array.isArray(snapshot.notes) ? snapshot.notes.map((item: unknown) => String(item)) : [],
      };
    }

    const rows = Object.entries(snapshot)
      .filter(([key]) => key !== 'tipo')
      .map(([key, value]) => ({ label: this.formatLabel(key), value: String(value ?? '—') }));

    return {
      tipo: snapshot?.tipo ?? 'operacional',
      generadoEn: new Date().toISOString(),
      titulo: this.getReportTitle(snapshot?.tipo ?? 'operacional'),
      subtitulo: this.getReportSubtitle(snapshot?.tipo ?? 'operacional'),
      highlights: [],
      sections: [{ title: 'Resumen', rows }],
      notes: [],
    };
  }

  private getReportTitle(tipo: string) {
    const titles: Record<string, string> = {
      operacional: 'Reporte Operacional',
      gestion: 'Reporte de Gestión',
      prediccion: 'Reporte de Predicción',
      riego: 'Reporte de Riego',
    };
    return titles[tipo] ?? 'Reporte';
  }

   private validateReportType(tipo: string) {
     const normalized = String(tipo ?? '').trim().toLowerCase();
     if (!ALLOWED_REPORT_TYPES.includes(normalized as (typeof ALLOWED_REPORT_TYPES)[number])) {
       throw new BadRequestException('Tipo de reporte inválido');
     }
     return normalized;
   }

   private validateReportFormat(formato?: string | null) {
     const normalized = String(formato ?? 'pdf').trim().toLowerCase();
     if (!ALLOWED_REPORT_FORMATS.includes(normalized as (typeof ALLOWED_REPORT_FORMATS)[number])) {
       throw new BadRequestException('Formato de reporte inválido');
     }
     return normalized;
   }

  private getReportSubtitle(tipo: string) {
    const subtitles: Record<string, string> = {
      operacional: 'Visión consolidada del desempeño agrícola, sensores y actividad reciente.',
      gestion: 'Indicadores ejecutivos para seguimiento de superficie, fincas y capacidad operativa.',
      prediccion: 'Análisis de rendimiento estimado, precisión de modelo y señales de producción.',
      riego: 'Seguimiento detallado de eventos, volumen aplicado y eficiencia hídrica en campo.',
    };
    return subtitles[tipo] ?? 'Reporte consolidado del sistema agrícola.';
  }

  private getSuggestedCadence(tipo: string) {
    const cadences: Record<string, string> = {
      operacional: 'Monitoreo diario',
      gestion: 'Revisión semanal',
      prediccion: 'Validación por campaña o hito agronómico',
      riego: 'Control diario o por jornada de riego',
    };
    return cadences[tipo] ?? 'Seguimiento periódico';
  }

  private getReportNotes(tipo: string) {
    if (tipo === 'prediccion') {
      return [
        'Los valores de rendimiento son estimaciones basadas en el modelo de ML activo.',
        'Use este reporte como apoyo a decisiones agronómicas, no como valor absoluto.',
        'Revise el intervalo de confianza y el modelo utilizado antes de escalar decisiones de producción.',
      ];
    }
    if (tipo === 'riego') {
      return [
        'Los indicadores de eficiencia se calculan en base a eventos registrados.',
        'Se recomienda complementar con datos de humedad de suelo para mayor precisión.',
        'Las horas mostradas en este documento se presentan en la zona horaria de Perú (America/Lima).',
      ];
    }
    if (tipo === 'gestion') {
      return [
        'Utilice este reporte para evaluar capacidad productiva, distribución de superficie y priorización de recursos.',
      ];
    }
    return [
      'Reporte emitido para seguimiento operativo del sistema.',
      'Se recomienda contrastar estos indicadores con alertas y actividades recientes antes de tomar acciones correctivas.',
    ];
  }

  private getReportPalette(tipo: string) {
    const palettes: Record<string, { primary: string; accent: string; soft: string }> = {
      operacional: { primary: '#166534', accent: '#22c55e', soft: '#f0fdf4' },
      gestion: { primary: '#15803d', accent: '#4ade80', soft: '#ecfdf5' },
      prediccion: { primary: '#7c3aed', accent: '#a78bfa', soft: '#f5f3ff' },
      riego: { primary: '#0891b2', accent: '#22d3ee', soft: '#ecfeff' },
    };
    return palettes[tipo] ?? palettes.operacional;
  }

  private formatDateTime(value: Date | string) {
    return new Date(value).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDateOnly(value: Date | string) {
    return new Date(value).toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  private formatLabel(input: string) {
    return input
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
