import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron } from '@nestjs/schedule';
@Injectable()
export class PredictionsService {
 private readonly ML_SERVICE_URL = process.env.ML_SERVICE_URL ||
'http://ml-service:5000';
 constructor(
 private prisma: PrismaService,
 private httpService: HttpService,
 ) {}

 async getCultivos() {
 const cultivos = await this.prisma.cultivo.findMany({
 orderBy: [{ nombre: 'asc' }, { variedad: 'asc' }],
 });
 const seen = new Set<string>();
 return cultivos.filter((cultivo) => {
 const key = `${cultivo.nombre.toLowerCase()}::${(cultivo.variedad ?? '').toLowerCase()}`;
 if (seen.has(key)) return false;
 seen.add(key);
 return true;
 });
 }

 async getActiveSeason(loteId: string, userId: string) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id: loteId,
 finca: {
 usuarioId: userId,
 },
 },
 });
 if (!lote) {
 throw new HttpException('Lote no encontrado', HttpStatus.NOT_FOUND);
 }
 return this.prisma.temporada.findFirst({
 where: {
 loteId,
 estado: 'activo',
 },
 include: {
 cultivo: true,
 },
 orderBy: { createdAt: 'desc' },
 });
 }

 async createActiveSeason(
 loteId: string,
 cultivoId: string,
 fechaSiembra: Date,
 userId: string,
 ) {
 const [lote, cultivo] = await Promise.all([
 this.prisma.lote.findFirst({
 where: {
 id: loteId,
 finca: {
 usuarioId: userId,
 },
 },
 }),
 this.prisma.cultivo.findUnique({
 where: { id: cultivoId },
 }),
 ]);

 if (!lote) {
 throw new HttpException('Lote no encontrado', HttpStatus.NOT_FOUND);
 }
 if (!cultivo) {
 throw new HttpException('Cultivo no encontrado', HttpStatus.NOT_FOUND);
 }

 const normalizedFechaSiembra = new Date(fechaSiembra);
 normalizedFechaSiembra.setHours(0, 0, 0, 0);

 const fechaCosechaEstimada = cultivo.cicloDias
 ? new Date(normalizedFechaSiembra.getTime() + cultivo.cicloDias * 24 * 60 * 60 * 1000)
 : null;

 return this.prisma.$transaction(async (tx) => {
 const existingSameDate = await tx.temporada.findFirst({
 where: {
 loteId,
 fechaSiembra: normalizedFechaSiembra,
 },
 });

 await tx.temporada.updateMany({
 where: {
 loteId,
 estado: 'activo',
 ...(existingSameDate ? { NOT: { id: existingSameDate.id } } : {}),
 },
 data: {
 estado: 'cosechado',
 },
 });

 if (existingSameDate) {
 return tx.temporada.update({
 where: { id: existingSameDate.id },
 data: {
 cultivoId,
 fechaCosechaEstimada,
 estado: 'activo',
 },
 include: {
 cultivo: true,
 },
 });
 }

 return tx.temporada.create({
 data: {
 loteId,
 cultivoId,
 fechaSiembra: normalizedFechaSiembra,
 fechaCosechaEstimada,
 estado: 'activo',
 },
 include: {
 cultivo: true,
 },
 });
 });
 }
 async findByPlot(loteId: string, userId: string) {
 // Verificar que el lote pertenece al usuario
 const lote = await this.prisma.lote.findFirst({
 where: {
 id: loteId,
 finca: {
 usuarioId: userId,
 },
 },
 });
 if (!lote) {
 throw new HttpException('Lote no encontrado', HttpStatus.NOT_FOUND);
 }
 return this.prisma.prediccionRendimiento.findMany({
 where: { loteId },
 include: {
 temporada: {
 include: {
 cultivo: true,
 },
 },
 },
 orderBy: { fechaPrediccion: 'desc' },
 });
 }
 async getCurrentPrediction(loteId: string, userId: string) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id: loteId,
 finca: {
 usuarioId: userId,
 },
 },
 include: {
 temporadas: {
 where: { estado: 'activo' },
 include: { cultivo: true },
 take: 1,
 },
 },
 });
 if (!lote) {
 throw new HttpException('Lote no encontrado', HttpStatus.NOT_FOUND);
 }
 if (lote.temporadas.length === 0) {
 return null;
 }
 const temporada = lote.temporadas[0];
 return this.prisma.prediccionRendimiento.findFirst({
 where: {
 loteId,
 temporadaId: temporada.id,
 },
 orderBy: { fechaPrediccion: 'desc' },
 });
 }
 async triggerPrediction(loteId: string, userId: string) {
    let lote = await this.prisma.lote.findFirst({
      where: {
        id: loteId,
        finca: {
          usuarioId: userId,
        },
      },
      include: {
        temporadas: {
          where: { estado: 'activo' },
          include: { cultivo: true },
          take: 1,
        },
        sensores: {
          include: {
            lecturas: {
              orderBy: { timestamp: 'desc' },
              take: 30,
            },
          },
        },
        eventosRiego: {
          where: {
            fechaHora: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });
    if (!lote) {
      throw new HttpException('Lote no encontrado', HttpStatus.NOT_FOUND);
    }
    if (!lote.temporadas?.length || !lote.temporadas[0]?.cultivo) {
      const cultivoDefault = await this.prisma.cultivo.findFirst({
        where: { nombre: 'Maíz' },
      }) ?? await this.prisma.cultivo.findFirst();

      if (!cultivoDefault) {
        throw new HttpException(
          'No hay cultivos disponibles para crear una temporada automática',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.createActiveSeason(loteId, cultivoDefault.id, new Date(), userId);
      lote = await this.prisma.lote.findFirst({
        where: {
          id: loteId,
          finca: {
            usuarioId: userId,
          },
        },
        include: {
          temporadas: {
            where: { estado: 'activo' },
            include: { cultivo: true },
            take: 1,
          },
          sensores: {
            include: {
              lecturas: {
                orderBy: { timestamp: 'desc' },
                take: 30,
              },
            },
          },
          eventosRiego: {
            where: {
              fechaHora: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      });
    }
    if (!lote || !lote.temporadas?.length || !lote.temporadas[0]?.cultivo) {
      throw new HttpException(
        'El lote no tiene una temporada activa con cultivo asociado',
        HttpStatus.BAD_REQUEST,
      );
    }
 // Preparar datos para el modelo ML
 const features = this.prepareFeatures(lote);
 try {
 const response = await firstValueFrom(
 this.httpService.post(`${this.ML_SERVICE_URL}/predict/yield`, features)
 );
 const prediction = response.data;
      const nuevaPrediccion = await this.prisma.prediccionRendimiento.create({
 data: {
 loteId,
 temporadaId: lote.temporadas[0].id,
 fechaPrediccion: new Date(),
 rendimientoEstimadoKgHa: prediction.yield,
 intervaloConfianzaInf: prediction.confidence_interval[0],
 intervaloConfianzaSup: prediction.confidence_interval[1],
 factoresInfluencia: prediction.factors,
 modeloUtilizado: prediction.model,
 precisionModelo: prediction.accuracy,
 },
 });
 // Generar alerta si el rendimiento es bajo
 if (prediction.yield < 5000) {
 await this.prisma.alerta.create({
 data: {
 usuarioId: userId,
 loteId,
 tipo: 'rendimiento',
 severidad: 'advertencia',
 mensaje: `Rendimiento estimado bajo (${prediction.yield} kg/ha) para el
lote ${lote.nombre}`,
 datosContexto: prediction.factors,
 },
 });
 }
 return nuevaPrediccion;
 } catch (error: any) {
 const mlMessage = error?.response?.data?.error || error?.message;
 throw new HttpException(
 mlMessage ? `Error al generar predicción: ${mlMessage}` : 'Error al generar predicción',
 HttpStatus.INTERNAL_SERVER_ERROR
 );
 }
 }
 private prepareFeatures(lote: any) {
 // Preparar features para el modelo ML
 const sensorData = lote.sensores.flatMap(sensor =>
 sensor.lecturas.map(lectura => ({
 temperature: this.toNumber(lectura.temperatura),
 humidity: this.toNumber(lectura.humedadSuelo),
 precipitation: this.toNumber(lectura.precipitacion),
 timestamp: lectura.timestamp,
 }))
 );
    const avgTemp = sensorData.length > 0
      ? sensorData.reduce((acc, d) => acc + (d.temperature ?? 0), 0) / sensorData.length
      : 0;
    const avgHumidity = sensorData.length > 0
      ? sensorData.reduce((acc, d) => acc + (d.humidity ?? 0), 0) / sensorData.length
      : 0;
 const totalIrrigation = lote.eventosRiego.reduce((acc, e) => acc +
this.toNumber(e.volumenM3), 0);
 return {
 crop_type: lote.temporadas[0].cultivo.nombre,
 soil_type: lote.tipoSuelo,
 area: this.toNumber(lote.areaHectareas),
 avg_temperature: avgTemp,
 avg_humidity: avgHumidity,
 total_irrigation: totalIrrigation,
 days_after_planting: Math.floor((Date.now() -
lote.temporadas[0].fechaSiembra.getTime()) / (1000 * 60 * 60 * 24)),
 };
 }
 private toNumber(value: unknown): number {
 if (value === null || value === undefined || value === '') return 0;
 const num = Number(value);
 return Number.isFinite(num) ? num : 0;
 }
 @Cron('0 2 * * *') // Ejecutar diariamente a las 2 AM
 async scheduledPredictions() {
 const lotesActivos = await this.prisma.lote.findMany({
 where: {
 temporadas: {
 some: {
 estado: 'activo',
 },
 },
 },
 include: {
 finca: {
 include: {
 usuario: true,
 },
 },
 },
 });
 for (const lote of lotesActivos) {
 await this.triggerPrediction(lote.id, lote.finca.usuarioId);
 }
 }
 async getAverageYield(userId: string, fincaId?: string): Promise<number> {
 const where: any = {
 lote: {
 finca: {
 usuarioId: userId,
 },
 },
 };
 if (fincaId) {
 where.lote.fincaId = fincaId;
 }
 const result = await this.prisma.prediccionRendimiento.aggregate({
 where,
 _avg: {
 rendimientoEstimadoKgHa: true,
 },
 });
 return Number(result._avg.rendimientoEstimadoKgHa ?? 0);
 }
 async getYieldHistory(userId: string, fincaId?: string, periodo: string = 'mes') {
 const where: any = {
 lote: {
 finca: {
 usuarioId: userId,
 },
 },
 };
 if (fincaId) {
 where.lote.fincaId = fincaId;
 }
 const predictions = await this.prisma.prediccionRendimiento.findMany({
 where,
 include: {
 lote: true,
 temporada: {
 include: {
 cultivo: true,
 },
 },
 },
 orderBy: { fechaPrediccion: 'asc' },
 });
 // Agrupar por periodo
 const grouped = this.groupByPeriod(predictions, periodo);

 return grouped;
 }
 private groupByPeriod(data: any[], periodo: string) {
 const groups = new Map();

 data.forEach(item => {
 let key;
 const date = new Date(item.fechaPrediccion);

 switch(periodo) {
 case 'semana':
 const weekNumber = this.getWeekNumber(date);
 key = `${date.getFullYear()}-W${weekNumber}`;
 break;
 case 'ano':
 key = date.getFullYear().toString();
 break;
 default: // mes
 key = `${date.getFullYear()}-${date.getMonth() + 1}`;
 }

 if (!groups.has(key)) {
 groups.set(key, []);
 }
 groups.get(key).push(item.rendimientoEstimadoKgHa);
 });

 return Array.from(groups.entries()).map(([period, yields]) => ({
 period,
 averageYield: yields.reduce((a, b) => a + Number(b || 0), 0) / (yields.length || 1),
 maxYield: Math.max(...yields.map((v) => Number(v || 0))),
 minYield: Math.min(...yields.map((v) => Number(v || 0))),
 }));
 }
 private getWeekNumber(date: Date): number {
 const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
 const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) /
86400000;
 return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
 }
}
