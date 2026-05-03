import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionsService } from '../predictions/predictions.service';
import axios from 'axios';

const KNOWN_WORKFLOWS = [
  'workflow-climate-ingest',
  'workflow-predicciones-diario',
  'workflow-reportes-programado',
  'workflow-climate-ingest-debug',
] as const;

const ALLOWED_REPORT_PERIODS = ['diario', 'semanal', 'mensual'] as const;

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly predictionsService: PredictionsService,
  ) {}

  validateSecret(secret?: string) {
    const expected = this.ensureWorkflowSecretConfigured();
    if (secret !== expected) {
      throw new UnauthorizedException('Invalid workflow secret');
    }
  }

  async runPredictionsWorkflow() {
    const startedAt = new Date();
    const execution = await this.createExecution('workflow-predicciones-diario', {
      trigger: 'n8n',
    }, startedAt);

    try {
      await this.predictionsService.scheduledPredictions();
      const predictionsCreated = await this.prisma.prediccionRendimiento.count({
        where: { createdAt: { gte: execution.inicioEjecucion } },
      });

      await this.finishExecution(execution.id, 'completado', startedAt, {
        predictionsCreated,
        durationMs: this.getDurationMs(startedAt),
      });

      return {
        executionId: execution.id,
        workflowStatus: 'completado',
        predictionsCreated,
      };
    } catch (error: any) {
      await this.failExecution(execution.id, error, {
        workflowNombre: 'workflow-predicciones-diario',
      });
      throw new InternalServerErrorException('Error running predictions workflow');
    }
  }

  async runReportsWorkflow(periodo: string = 'semanal') {
    const normalizedPeriod = this.validateReportPeriod(periodo);
    const startedAt = new Date();
    const execution = await this.createExecution('workflow-reportes-programado', {
      trigger: 'n8n',
      periodo: normalizedPeriod,
    }, startedAt);

    try {
      const users = await this.prisma.usuario.findMany({
        where: { activo: true },
        select: { id: true },
      });

      const results = await Promise.all(
        users.map(async (user) => {
          try {
            await this.prisma.reporte.create({
              data: {
                usuarioId: user.id,
                workflowEjecucionId: execution.id,
                tipo: 'operacional',
                formato: 'pdf',
                parametrosFiltros: { periodo: normalizedPeriod, trigger: 'n8n' },
              },
            });
            return { ok: true as const, userId: user.id };
          } catch (error: any) {
            return {
              ok: false as const,
              userId: user.id,
              error: this.buildErrorDetails(error),
            };
          }
        }),
      );

      const generatedReports = results.filter((result) => result.ok);
      const failedReports = results.filter((result) => !result.ok);
      const workflowStatus = failedReports.length === 0
        ? 'completado'
        : generatedReports.length > 0
          ? 'parcial'
          : 'fallido';

      const resultPayload = {
        reportsGenerated: generatedReports.length,
        failedReports: failedReports.length,
        failedTargets: failedReports.slice(0, 10).map((result) => ({
          userId: result.userId,
          error: result.error,
        })),
        period: normalizedPeriod,
        durationMs: this.getDurationMs(startedAt),
      };

      await this.finishExecution(execution.id, workflowStatus, startedAt, resultPayload);

      if (workflowStatus === 'fallido') {
        throw new InternalServerErrorException('Error running reports workflow');
      }

      return {
        executionId: execution.id,
        workflowStatus,
        reportsGenerated: generatedReports.length,
        failedReports: failedReports.length,
        period: normalizedPeriod,
      };
    } catch (error: any) {
      await this.failExecution(execution.id, error, {
        workflowNombre: 'workflow-reportes-programado',
        periodo: normalizedPeriod,
      });
      throw new InternalServerErrorException('Error running reports workflow');
    }
  }

  async runClimateIngestWorkflow(userId: string, loteId?: string) {
    if (loteId) {
      const lote = await this.prisma.lote.findFirst({
        where: {
          id: loteId,
          finca: { usuarioId: userId },
        },
      });
      if (!lote) {
        throw new NotFoundException('Lote no encontrado');
      }
    }

    const secret = this.ensureWorkflowSecretConfigured();
    const webhookUrl = this.getClimateWebhookUrl();
    const startedAt = new Date();
    const sensors = await this.prisma.sensor.findMany({
      where: loteId
        ? {
            activo: true,
            loteId,
            lote: { finca: { usuarioId: userId } },
          }
        : {
            activo: true,
            OR: [
              { lote: { finca: { usuarioId: userId } } },
              { loteId: null },
            ],
          },
      select: {
        id: true,
        codigo: true,
        tipo: true,
        loteId: true,
        ubicacion: true,
      },
    });

    if (sensors.length === 0) {
      return {
        workflowTriggered: false,
        readingsCreated: 0,
        createdReadings: 0,
        persistedReadings: 0,
        webhookReportedReadings: 0,
        targetedSensors: 0,
        successfulSensors: 0,
        failedSensors: 0,
        reason: 'No hay sensores activos para actualizar',
      };
    }

    const execution = await this.createExecution('workflow-climate-ingest', {
      trigger: 'app',
      userId,
      loteId: loteId ?? null,
    }, startedAt);

    try {
      const responses = await Promise.all(
        sensors.map(async (sensor) => {
          const coords = this.extractCoordinates(sensor.ubicacion);
          try {
            const response = await axios.post(
              webhookUrl,
              {
                userId,
                loteId: sensor.loteId ?? null,
                sensor_id: sensor.id,
                sensorId: sensor.id,
                sensorCode: sensor.codigo,
                sensor_type: sensor.tipo,
                sensorType: sensor.tipo,
                lat: coords.lat,
                lon: coords.lon,
                source: 'agri-precision',
              },
              {
                timeout: 20000,
                headers: { 'x-workflow-secret': secret },
              },
            );
            await this.ensureReadingForTargetSensor(sensor, response.data);
            return {
              ok: true as const,
              sensorId: sensor.id,
              sensorCode: sensor.codigo,
              payload: response.data,
              webhookStatus: response.status,
            };
          } catch (error: any) {
            return {
              ok: false as const,
              sensorId: sensor.id,
              sensorCode: sensor.codigo,
              error: this.buildErrorDetails(error),
            };
          }
        }),
      );

      const successfulResponses = responses.filter((response) => response.ok);
      const failedResponses = responses.filter((response) => !response.ok);

      const dbReadingsCreated = await this.prisma.lecturaSensor.count({
        where: {
          timestamp: { gte: startedAt },
          sensorId: { in: successfulResponses.map((response) => response.sensorId) },
        },
      });
      const webhookReadingsCreated = successfulResponses.reduce(
        (sum, response) => sum + this.extractReadingsCount(response.payload),
        0,
      );
      const readingsCreated = dbReadingsCreated;
      const workflowStatus = failedResponses.length === 0
        ? 'completado'
        : successfulResponses.length > 0
          ? 'parcial'
          : 'fallido';

      const resultPayload = {
        readingsCreated,
        dbReadingsCreated,
        webhookReadingsCreated,
        persistedReadings: dbReadingsCreated,
        webhookReportedReadings: webhookReadingsCreated,
        targetedSensors: sensors.length,
        successfulSensors: successfulResponses.length,
        failedSensors: failedResponses.length,
        failedTargets: failedResponses.slice(0, 10).map((response) => ({
          sensorId: response.sensorId,
          sensorCode: response.sensorCode,
          error: response.error,
        })),
        webhookUrl,
        durationMs: this.getDurationMs(startedAt),
      };

      await this.finishExecution(execution.id, workflowStatus, startedAt, resultPayload);

      if (workflowStatus === 'fallido') {
        throw new InternalServerErrorException(
          'No se pudo ejecutar el workflow de ingesta climática en n8n',
        );
      }

      return {
        executionId: execution.id,
        workflowTriggered: true,
        workflowStatus,
        readingsCreated,
        createdReadings: readingsCreated,
        dbReadingsCreated,
        webhookReadingsCreated,
        persistedReadings: dbReadingsCreated,
        webhookReportedReadings: webhookReadingsCreated,
        targetedSensors: sensors.length,
        successfulSensors: successfulResponses.length,
        failedSensors: failedResponses.length,
        webhookUrl,
      };
    } catch (error: any) {
      await this.failExecution(execution.id, error, {
        workflowNombre: 'workflow-climate-ingest',
        loteId: loteId ?? null,
        userId,
        webhookUrl,
      });
      throw new InternalServerErrorException(
        'No se pudo ejecutar el workflow de ingesta climática en n8n',
      );
    }
  }

  async getExecutions(limit = 20) {
    const executions = await this.prisma.workflowEjecucion.findMany({
      orderBy: { inicioEjecucion: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return executions.map((execution) => this.serializeExecution(execution));
  }

  async getOverview(limit = 12) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const executions = await this.prisma.workflowEjecucion.findMany({
      orderBy: { inicioEjecucion: 'desc' },
      take: safeLimit,
    });

    const workflowSecretConfigured = Boolean(process.env.WORKFLOW_SECRET?.trim());
    const climateWebhookUrl = this.tryGetClimateWebhookUrl();
    const climateWebhookConfigured = Boolean(climateWebhookUrl);
    const summary = executions.reduce(
      (acc, execution) => {
        acc.total += 1;
        if (execution.estado === 'completado') acc.completed += 1;
        else if (execution.estado === 'parcial') acc.partial += 1;
        else if (execution.estado === 'fallido') acc.failed += 1;
        else if (execution.estado === 'ejecutando') acc.running += 1;
        return acc;
      },
      { total: 0, completed: 0, partial: 0, failed: 0, running: 0 },
    );

    const workflows = KNOWN_WORKFLOWS.map((workflowNombre) => ({
      workflowNombre,
      latestExecution: this.serializeExecution(
        executions.find((execution) => execution.workflowNombre === workflowNombre) ?? null,
      ),
    }));

    const systemStatus = !workflowSecretConfigured || !climateWebhookConfigured
      ? 'sin_configurar'
      : executions.some((execution) => execution.estado === 'fallido' || execution.estado === 'parcial')
        ? 'atencion'
        : executions.some((execution) => execution.estado === 'ejecutando')
          ? 'ejecutando'
          : 'activo';

    return {
      configuration: {
        workflowSecretConfigured,
        climateWebhookConfigured,
        climateWebhookUrl,
      },
      summary,
      systemStatus,
      lastExecution: this.serializeExecution(executions[0] ?? null),
      workflows,
      recentExecutions: executions.slice(0, 5).map((execution) => this.serializeExecution(execution)),
    };
  }

  private getClimateWebhookUrl() {
    const webhookUrl = this.tryGetClimateWebhookUrl();
    if (!webhookUrl) {
      throw new InternalServerErrorException(
        'No se encontró una URL válida para el workflow climático de n8n',
      );
    }
    return webhookUrl;
  }

  private extractCoordinates(ubicacion: unknown): { lat: number; lon: number } {
    if (ubicacion && typeof ubicacion === 'object') {
      const data = ubicacion as Record<string, unknown>;
      const lat = Number(data.lat ?? data.latitude);
      const lon = Number(data.lon ?? data.lng ?? data.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { lat, lon };
      }
    }
    return { lat: -8.1159, lon: -79.03 };
  }

  async runClimateIngestWorkflowDebug(input?: { userId?: string; loteId?: string }) {
    const userId = input?.userId;
    const loteId = input?.loteId;
    const secret = this.ensureWorkflowSecretConfigured();
    const webhookUrl = this.getClimateWebhookUrl();
    const startedAt = new Date();

    const execution = await this.createExecution('workflow-climate-ingest-debug', {
      trigger: 'debug-endpoint',
      userId: userId ?? null,
      loteId: loteId ?? null,
    }, startedAt);

    try {
      const response = await axios.post(
        webhookUrl,
        { loteId, userId, source: 'agri-precision-debug' },
        {
          timeout: 20000,
          headers: { 'x-workflow-secret': secret },
        },
      );

      const dbReadingsCreated = await this.prisma.lecturaSensor.count({
        where: {
          timestamp: { gte: startedAt },
          ...(loteId ? { sensor: { loteId } } : {}),
          ...(userId
            ? {
                sensor: {
                  OR: [
                    { lote: { finca: { usuarioId: userId } } },
                    { loteId: null },
                  ],
                  ...(loteId ? { loteId } : {}),
                },
              }
            : {}),
        },
      });
      const webhookReadingsCreated = this.extractReadingsCount(response.data);
      const readingsCreated = dbReadingsCreated;

      const debugResult = {
        executionId: execution.id,
        workflowTriggered: true,
        readingsCreated,
        dbReadingsCreated,
        webhookReadingsCreated,
        persistedReadings: dbReadingsCreated,
        webhookReportedReadings: webhookReadingsCreated,
        webhookUrl,
        webhookStatus: response.status,
        webhookData: response.data,
        durationMs: this.getDurationMs(startedAt),
      };

      await this.finishExecution(execution.id, 'completado', startedAt, debugResult);

      return debugResult;
    } catch (error: any) {
      await this.failExecution(execution.id, error, {
        workflowNombre: 'workflow-climate-ingest-debug',
        loteId: loteId ?? null,
        userId: userId ?? null,
        webhookUrl,
      });
      throw new InternalServerErrorException(
        'No se pudo ejecutar el debug del workflow de ingesta climática',
      );
    }
  }

  private extractReadingsCount(payload: unknown): number {
    if (Array.isArray(payload)) {
      return payload.length;
    }
    if (payload && typeof payload === 'object') {
      const data = payload as Record<string, unknown>;
      const directCount = Number(data.createdReadings ?? data.readingsCreated ?? data.count);
      if (Number.isFinite(directCount) && directCount > 0) {
        return directCount;
      }
      if (data.id || data.sensor_id || data.sensorId) {
        return 1;
      }
    }
    return 0;
  }

  private toNumberOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toIntOrNull(value: unknown) {
    const num = this.toNumberOrNull(value);
    return num === null ? null : Math.round(num);
  }

  private ensureWorkflowSecretConfigured() {
    const secret = process.env.WORKFLOW_SECRET?.trim();
    if (!secret) {
      throw new InternalServerErrorException('WORKFLOW_SECRET no está configurado');
    }
    return secret;
  }

  private validateReportPeriod(periodo: string) {
    const normalized = periodo.trim().toLowerCase();
    if (!ALLOWED_REPORT_PERIODS.includes(normalized as (typeof ALLOWED_REPORT_PERIODS)[number])) {
      throw new BadRequestException('Periodo inválido para workflow de reportes');
    }
    return normalized;
  }

  private tryGetClimateWebhookUrl() {
    const specific = process.env.N8N_CLIMATE_WEBHOOK_URL?.trim();
    if (specific) {
      return this.normalizeUrl(specific);
    }
    const generic = process.env.N8N_WEBHOOK_URL?.trim().replace(/\/$/, '');
    if (generic) {
      return this.normalizeUrl(`${generic}/climate-ingest`);
    }
    return this.normalizeUrl('http://n8n:5678/webhook/climate-ingest');
  }

  private normalizeUrl(value: string) {
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }

  private async ensureReadingForTargetSensor(
    sensor: { id: string },
    payload: unknown,
  ) {
    const readingData = this.buildReadingData(sensor.id, payload);
    if (!readingData) {
      return null;
    }

    const existingReading = await this.prisma.lecturaSensor.findFirst({
      where: {
        sensorId: sensor.id,
        timestamp: readingData.timestamp,
      },
      select: { id: true },
    });

    if (existingReading) {
      return existingReading;
    }

    return this.prisma.lecturaSensor.create({
      data: readingData,
      select: { id: true },
    });
  }

  private async createExecution(workflowNombre: string, parametrosEntrada: Record<string, unknown>, startedAt: Date) {
    return this.prisma.workflowEjecucion.create({
      data: {
        workflowNombre,
        inicioEjecucion: startedAt,
        estado: 'ejecutando',
        parametrosEntrada: this.toJsonValue(parametrosEntrada),
      },
    });
  }

  private async finishExecution(
    executionId: string,
    estado: 'completado' | 'parcial' | 'fallido',
    startedAt: Date,
    resultadoSalida: Record<string, unknown>,
  ) {
    await this.prisma.workflowEjecucion.update({
      where: { id: executionId },
      data: {
        estado,
        finEjecucion: new Date(),
        resultadoSalida: this.toJsonValue({
          ...resultadoSalida,
          durationMs: resultadoSalida.durationMs ?? this.getDurationMs(startedAt),
        }),
      },
    });
  }

  private async failExecution(executionId: string, error: any, context: Record<string, unknown> = {}) {
    await this.prisma.workflowEjecucion.update({
      where: { id: executionId },
      data: {
        estado: 'fallido',
        finEjecucion: new Date(),
        errorMensaje: error?.message ?? 'Unknown error',
        resultadoSalida: this.toJsonValue({
          error: this.buildErrorDetails(error, context),
        }),
      },
    });
  }

  private buildErrorDetails(error: any, context: Record<string, unknown> = {}) {
    return {
      message: error?.message ?? 'Unknown error',
      code: error?.code ?? error?.name ?? null,
      status: error?.response?.status ?? error?.status ?? error?.statusCode ?? null,
      responseData: error?.response?.data ?? null,
      context,
    };
  }

  private serializeExecution(execution: any) {
    if (!execution) {
      return null;
    }
    return {
      id: execution.id,
      workflowNombre: execution.workflowNombre,
      estado: execution.estado,
      inicioEjecucion: execution.inicioEjecucion,
      finEjecucion: execution.finEjecucion,
      errorMensaje: execution.errorMensaje,
      parametrosEntrada: execution.parametrosEntrada,
      resultadoSalida: execution.resultadoSalida,
      durationMs: execution.finEjecucion
        ? this.getDurationMs(execution.inicioEjecucion, execution.finEjecucion)
        : null,
    };
  }

  private getDurationMs(startedAt: Date, finishedAt = new Date()) {
    return Math.max(0, finishedAt.getTime() - startedAt.getTime());
  }

  private buildReadingData(sensorId: string, payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const timestampValue = data.timestamp;
    const parsedTimestamp = timestampValue ? new Date(String(timestampValue)) : new Date();
    const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;

    return {
      sensorId,
      timestamp,
      temperatura: this.toNumberOrNull(data.temperatura ?? data.temperature),
      humedadSuelo: this.toIntOrNull(data.humedad_suelo ?? data.humedadSuelo ?? data.soil_moisture),
      humedadAmbiente: this.toIntOrNull(data.humedad_ambiente ?? data.humedadAmbiente ?? data.humidity),
      precipitacion: this.toNumberOrNull(data.precipitacion ?? data.precipitation),
      radiacionSolar: this.toNumberOrNull(data.radiacion_solar ?? data.radiacionSolar),
      velocidadViento: this.toNumberOrNull(data.velocidad_viento ?? data.velocidadViento ?? data.wind_speed),
      presionAtmosferica: this.toNumberOrNull(data.presion_atmosferica ?? data.presionAtmosferica ?? data.pressure),
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    const normalized = this.normalizeJsonValue(value);
    if (normalized === undefined) {
      return null;
    }
    return normalized as Prisma.InputJsonValue;
  }

  private normalizeJsonValue(value: unknown): unknown {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.normalizeJsonValue(item))
        .filter((item) => item !== undefined);
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, entry]) => {
        const normalizedEntry = this.normalizeJsonValue(entry);
        if (normalizedEntry !== undefined) {
          acc[key] = normalizedEntry;
        }
        return acc;
      }, {});
    }
    return String(value);
  }
}
