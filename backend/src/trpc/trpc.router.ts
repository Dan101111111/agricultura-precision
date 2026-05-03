import { Injectable } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { AuthService } from '../auth/auth.service';
import { FarmsService } from '../farms/farms.service';
import { PlotsService } from '../plots/plots.service';
import { PredictionsService } from '../predictions/predictions.service';
import { ReportsService } from '../reports/reports.service';
import { SensorsService } from '../sensors/sensors.service';
import { IrrigationService } from '../irrigation/irrigation.service';
import { AlertsService } from '../alerts/alerts.service';
import { AutomationService } from '../automation/automation.service';

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authService: AuthService,
    private readonly farmsService: FarmsService,
    private readonly plotsService: PlotsService,
    private readonly predictionsService: PredictionsService,
    private readonly reportsService: ReportsService,
    private readonly sensorsService: SensorsService,
    private readonly irrigationService: IrrigationService,
    private readonly alertsService: AlertsService,
    private readonly automationService: AutomationService,
  ) {}

  appRouter = this.trpc.router({
    auth: this.trpc.router({
      login: this.trpc.procedure
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input }) => {
          return this.authService.login(input.email, input.password);
        }),
      register: this.trpc.procedure
        .input(z.object({
          email: z.string().email(),
          password: z.string(),
          nombre: z.string(),
          apellido: z.string(),
        }))
        .mutation(async ({ input }: { input: any }) => {
          return this.authService.register(input);
        }),
      me: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .query(async ({ ctx }: { ctx: any }) => {
          return this.authService.getUser(ctx.user.id);
        }),
    }),
    farms: this.trpc.router({
      getAll: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .query(async ({ ctx }: { ctx: any }) => {
          return this.farmsService.findAll(ctx.user.id);
        }),
      create: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          nombre: z.string(),
          ubicacion: z.string().optional(),
          areaHectareas: z.number().positive(),
        }))
        .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
          return this.farmsService.create(input, ctx.user.id);
        }),
    }),
    plots: this.trpc.router({
      getAll: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .query(async ({ ctx }: { ctx: any }) => {
          return this.plotsService.findAllByUser(ctx.user.id);
        }),
      getAllByFarm: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ fincaId: z.string() }))
        .query(async ({ input, ctx }: { input: any; ctx: any }) => {
          return this.plotsService.findByFarm(input.fincaId, ctx.user.id);
        }),
      getOne: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }: { input: { id: string }; ctx: any }) => {
          return this.plotsService.findOne(input.id, ctx.user.id);
        }),
      create: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          nombre: z.string(),
          fincaId: z.string(),
          areaHectareas: z.number().positive(),
          tipoSuelo: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
          return this.plotsService.create(input, ctx.user.id);
        }),
      update: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          id: z.string(),
          nombre: z.string().min(1).optional(),
          areaHectareas: z.number().positive().optional(),
          tipoSuelo: z.string().min(1).optional(),
        }))
        .mutation(async ({ input, ctx }: { input: { id: string; nombre?: string; areaHectareas?: number; tipoSuelo?: string }; ctx: any }) => {
          const { id, ...data } = input;
          return this.plotsService.update(id, data, ctx.user.id);
        }),
      delete: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }: { input: { id: string }; ctx: any }) => {
          return this.plotsService.delete(input.id, ctx.user.id);
        }),
    }),
    sensors: this.trpc.router({
      getLatestReadings: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ loteId: z.string().optional() }).optional())
        .query(async ({ input, ctx }: { input?: { loteId?: string }; ctx: any }) => {
          return this.sensorsService.getLatestReadings(input?.loteId, ctx.user.id);
        }),
      create: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          codigo: z.string().min(2),
          tipo: z.string().min(2),
          loteId: z.string().optional().nullable(),
          activo: z.boolean().optional(),
          lat: z.number().optional(),
          lon: z.number().optional(),
        }))
        .mutation(async ({ input, ctx }: { input: { codigo: string; tipo: string; loteId?: string | null; activo?: boolean; lat?: number; lon?: number }; ctx: any }) => {
          return this.sensorsService.createSensor(input, ctx.user.id);
        }),
      assignPlot: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          sensorId: z.string(),
          loteId: z.string().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }: { input: { sensorId: string; loteId?: string | null }; ctx: any }) => {
          return this.sensorsService.assignPlot(input.sensorId, input.loteId, ctx.user.id);
        }),
      refreshReadings: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ loteId: z.string().optional() }).optional())
        .mutation(async ({ input, ctx }: { input?: { loteId?: string }; ctx: any }) => {
          return this.automationService.runClimateIngestWorkflow(ctx.user.id, input?.loteId);
        }),
    }),
    predictions: this.trpc.router({
      getCultivos: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .query(async () => {
          return this.predictionsService.getCultivos();
        }),
      getActiveSeason: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ loteId: z.string() }))
        .query(async ({ input, ctx }: { input: { loteId: string }; ctx: any }) => {
          return this.predictionsService.getActiveSeason(input.loteId, ctx.user.id);
        }),
      createActiveSeason: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          loteId: z.string(),
          cultivoId: z.string(),
          fechaSiembra: z.coerce.date(),
        }))
        .mutation(async ({ input, ctx }: { input: { loteId: string; cultivoId: string; fechaSiembra: Date }; ctx: any }) => {
          return this.predictionsService.createActiveSeason(
            input.loteId,
            input.cultivoId,
            input.fechaSiembra,
            ctx.user.id,
          );
        }),
      getByPlot: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ loteId: z.string() }))
        .query(async ({ input, ctx }: { input: { loteId: string }; ctx: any }) => {
          return this.predictionsService.findByPlot(input.loteId, ctx.user.id);
        }),
      getCurrent: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ loteId: z.string() }))
        .query(async ({ input, ctx }: { input: { loteId: string }; ctx: any }) => {
          return this.predictionsService.getCurrentPrediction(input.loteId, ctx.user.id);
        }),
      trigger: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ loteId: z.string() }))
        .mutation(async ({ input, ctx }: { input: { loteId: string }; ctx: any }) => {
          try {
            return await this.predictionsService.triggerPrediction(input.loteId, ctx.user.id);
          } catch (error: any) {
            const status = error?.status ?? error?.statusCode;
            if (status === 400) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
            }
            if (status === 404) {
              throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
            }
            throw error;
          }
        }),
      getYieldHistory: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          fincaId: z.string().optional(),
          periodo: z.enum(['semana', 'mes', 'ano']).optional(),
        }).optional())
        .query(async ({ input, ctx }: { input?: { fincaId?: string; periodo?: 'semana' | 'mes' | 'ano' }; ctx: any }) => {
          return this.predictionsService.getYieldHistory(
            ctx.user.id,
            input?.fincaId,
            input?.periodo ?? 'mes',
          );
        }),
    }),
    irrigation: this.trpc.router({
      getHistory: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          fincaId: z.string().optional(),
          periodo: z.enum(['semana', 'mes', 'ano']).optional(),
        }).optional())
        .query(async ({ input, ctx }: { input?: { fincaId?: string; periodo?: 'semana' | 'mes' | 'ano' }; ctx: any }) => {
          return this.irrigationService.getIrrigationData(
            ctx.user.id,
            input?.fincaId,
            input?.periodo ?? 'mes',
          );
        }),
      getRecommendations: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ loteId: z.string() }))
        .query(async ({ input, ctx }: { input: { loteId: string }; ctx: any }) => {
          return this.irrigationService.getRecommendations(input.loteId, ctx.user.id);
        }),
      schedule: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          loteId: z.string(),
          fechaHora: z.coerce.date(),
          duracionMinutos: z.number().int().positive(),
          tipoRiego: z.enum(['goteo', 'aspersion', 'inundacion', 'subterraneo']),
        }))
        .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
          return this.irrigationService.schedule(input, ctx.user.id);
        }),
      getEfficiencyMetrics: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ fincaId: z.string().optional() }).optional())
        .query(async ({ input, ctx }: { input?: { fincaId?: string }; ctx: any }) => {
          return this.irrigationService.getEfficiencyMetrics(ctx.user.id, input?.fincaId);
        }),
    }),
    reports: this.trpc.router({
      getAll: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .query(async ({ ctx }: { ctx: any }) => {
          return this.reportsService.getReports(ctx.user.id);
        }),
      generate: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          tipo: z.enum(['operacional', 'gestion', 'prediccion', 'riego']),
          formato: z.enum(['pdf', 'csv']).optional(),
        }))
        .mutation(async ({ ctx, input }: { ctx: any; input: { tipo: 'operacional' | 'gestion' | 'prediccion' | 'riego'; formato?: 'pdf' | 'csv' } }) => {
          return this.reportsService.generateReport(ctx.user.id, input);
        }),
      download: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ reportId: z.string() }))
        .query(async ({ ctx, input }: { ctx: any; input: { reportId: string } }) => {
          return this.reportsService.downloadReport(input.reportId, ctx.user.id);
        }),
      delete: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ reportId: z.string() }))
        .mutation(async ({ ctx, input }: { ctx: any; input: { reportId: string } }) => {
          return this.reportsService.deleteReport(input.reportId, ctx.user.id);
        }),
    }),
    alerts: this.trpc.router({
      getUnread: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .query(async ({ ctx }: { ctx: any }) => {
          return this.alertsService.getUnread(ctx.user.id);
        }),
      getAll: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({
          limit: z.number().int().positive().max(100).optional(),
          offset: z.number().int().min(0).optional(),
        }).optional())
        .query(async ({ input, ctx }: { input?: { limit?: number; offset?: number }; ctx: any }) => {
          return this.alertsService.getAll(ctx.user.id, input?.limit, input?.offset);
        }),
      markAsRead: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ alertId: z.string() }))
        .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
          return this.alertsService.markAsRead(input.alertId, ctx.user.id);
        }),
      markAllAsRead: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .mutation(async ({ ctx }: { ctx: any }) => {
          return this.alertsService.markAllAsRead(ctx.user.id);
        }),
    }),
    automation: this.trpc.router({
      getOverview: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ limit: z.number().int().positive().max(50).optional() }).optional())
        .query(async ({ input }: { input?: { limit?: number } }) => {
          return this.automationService.getOverview(input?.limit ?? 12);
        }),
      getExecutions: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ limit: z.number().int().positive().max(100).optional() }).optional())
        .query(async ({ input }: { input?: { limit?: number } }) => {
          return this.automationService.getExecutions(input?.limit ?? 20);
        }),
    }),
    dashboard: this.trpc.router({
      getMetrics: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .query(async ({ ctx }: { ctx: any }) => {
          const [farms, alerts, averageYield, irrigationEfficiency] = await Promise.all([
            this.farmsService.findAll(ctx.user.id),
            this.alertsService.getUnreadCount(ctx.user.id),
            this.predictionsService.getAverageYield(ctx.user.id),
            this.irrigationService.getWeeklyEfficiency(ctx.user.id),
          ]);
          const totalPlots = farms.reduce((sum: number, farm: any) => {
            return sum + (farm.lotes?.length ?? 0);
          }, 0);
          return {
            totalFarms: farms.length,
            totalPlots,
            averageYield,
            unreadAlerts: alerts,
            irrigationEfficiency,
          };
        }),
      getCharts: this.trpc.procedure
        .use(this.trpc.authMiddleware())
        .input(z.object({ periodo: z.enum(['semana', 'mes', 'ano']).optional() }).optional())
        .query(async ({ ctx, input }: { ctx: any; input?: { periodo?: 'semana' | 'mes' | 'ano' } }) => {
          const periodo = input?.periodo ?? 'mes';
          const [yieldHistory, irrigationData, efficiencyMetrics] = await Promise.all([
            this.predictionsService.getYieldHistory(ctx.user.id, undefined, periodo),
            this.irrigationService.getIrrigationData(ctx.user.id, undefined, periodo),
            this.irrigationService.getEfficiencyMetrics(ctx.user.id),
          ]);
          return {
            yieldHistory,
            irrigationData,
            climateData: null,
            efficiencyMetrics,
          };
        }),
    }),
  });
}
