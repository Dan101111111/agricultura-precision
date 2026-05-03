import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
@Injectable()
export class IrrigationService {
 private readonly ML_SERVICE_URL = process.env.ML_SERVICE_URL ||
'http://ml-service:5000';
 constructor(
 private prisma: PrismaService,
 private httpService: HttpService,
 ) {}
 async getEvents(loteId: string, startDate: Date, endDate: Date, userId: string) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id: loteId,
 finca: {
 usuarioId: userId,
 },
 },
 });
 if (!lote) {
 throw new NotFoundException('Lote no encontrado');
 }
 return this.prisma.eventoRiego.findMany({
 where: {
 loteId,
 fechaHora: {
 gte: startDate,
 lte: endDate,
 },
 },
 orderBy: { fechaHora: 'desc' },
 });
 }
 async getRecommendations(loteId: string, userId: string) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id: loteId,
 finca: {
 usuarioId: userId,
 },
 },
 include: {
 sensores: {
 include: {
 lecturas: {
 orderBy: { timestamp: 'desc' },
 take: 1,
 },
 },
 },
 temporadas: {
 where: { estado: 'activo' },
 include: { cultivo: true },
 take: 1,
 },
 },
 });
 if (!lote) {
 throw new NotFoundException('Lote no encontrado');
 }
 const latestReadings = lote.sensores
 .map((sensor) => sensor.lecturas[0])
 .filter(Boolean);
 const latestHumidityReading = latestReadings
 .filter((reading: any) => reading.humedadSuelo !== null && reading.humedadSuelo !== undefined)
 .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
 const latestTemperatureReading = latestReadings
 .filter((reading: any) => reading.temperatura !== null && reading.temperatura !== undefined)
 .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

 const currentSoilMoisture = this.toNumber(latestHumidityReading?.humedadSuelo, 50);
 const currentTemperature = this.toNumber(latestTemperatureReading?.temperatura, 25);
 const cultivo = lote.temporadas[0]?.cultivo;
 if (!cultivo) {
 return {
 recommendation: 'Datos insuficientes para generar recomendación',
 needIrrigation: false,
 currentSoilMoisture: null,
 currentTemperature: null,
 };
 }
 try {
 const response = await firstValueFrom(
 this.httpService.post(`${this.ML_SERVICE_URL}/predict/irrigation`, {
 humedad_suelo: currentSoilMoisture,
 temperatura: currentTemperature,
 dias_cosecha: this.calculateDaysToHarvest(lote.temporadas[0]),
 cultivo_tipo: cultivo.nombre,
 etapa_crecimiento: this.getGrowthStage(lote.temporadas[0]),
 }),
 );
 const volume = this.toNumber(response.data.recommended_volume_m3, 0);
 const urgency = response.data.urgency || (volume > 30 ? 'high' : volume > 10 ? 'medium' : 'low');
 const optimalTime = response.data.optimal_time || (urgency === 'high' ? '06:00' : '18:00');
 const context = this.buildRecommendationContext(urgency, optimalTime);
 return {
 ...response.data,
 currentSoilMoisture,
 currentTemperature,
 cropType: cultivo.nombre,
 recommendedVolumeM3: volume,
 urgency,
 optimalTime,
 recommendation: volume > 0
 ? `Se recomienda regar con ${volume.toFixed(2)} m³ de agua. ${context}`
 : 'No se requiere riego en este momento',
 };
 } catch {
 const fallback = this.buildFallbackRecommendation(currentSoilMoisture, currentTemperature);
 return {
 recommendation: fallback.recommendation,
 needIrrigation: fallback.needIrrigation,
 recommendedVolumeM3: fallback.recommendedVolumeM3,
 urgency: fallback.urgency,
 optimalTime: fallback.optimalTime,
 currentSoilMoisture,
 currentTemperature,
 cropType: cultivo.nombre,
 };
 }
 }
 async schedule(
 data: {
 loteId: string;
 fechaHora: Date;
 duracionMinutos: number;
 tipoRiego: string;
 },
 userId: string,
 ) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id: data.loteId,
 finca: {
 usuarioId: userId,
 },
 },
 });
 if (!lote) {
 throw new NotFoundException('Lote no encontrado');
 }
 const volumenM3 = this.calculateVolume(data.duracionMinutos, Number(lote.areaHectareas));
 return this.prisma.eventoRiego.create({
 data: {
 loteId: data.loteId,
 fechaHora: data.fechaHora,
 duracionMinutos: data.duracionMinutos,
 volumenM3,
 tipoRiego: data.tipoRiego,
 origenDecision: 'manual',
 eficiencia: 0.85,
 },
 });
 }
 async getWeeklyEfficiency(userId: string) {
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - 7);
 const eventos = await this.prisma.eventoRiego.findMany({
 where: {
 lote: {
 finca: {
 usuarioId: userId,
 },
 },
 fechaHora: {
 gte: startDate,
 },
 },
 });
 if (eventos.length === 0) return 0;
 const totalEfficiency = eventos.reduce((sum, e) => sum + Number(e.eficiencia || 0), 0);
 return totalEfficiency / eventos.length;
 }
 async getIrrigationData(userId: string, fincaId?: string, periodo: string = 'mes') {
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
 const eventos = await this.prisma.eventoRiego.findMany({
 where,
 include: {
 lote: true,
 },
 orderBy: { fechaHora: 'asc' },
 });
 const grouped = this.groupIrrigationByPeriod(eventos, periodo);
 return grouped;
 }
 async getEfficiencyMetrics(userId: string, fincaId?: string) {
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
 const eventos = await this.prisma.eventoRiego.findMany({
 where,
 });
 const totalEvents = eventos.length;
 const totalVolume = eventos.reduce((sum, e) => sum + Number(e.volumenM3 || 0), 0);
 const avgEfficiency = eventos.reduce((sum, e) => sum + Number(e.eficiencia || 0), 0) / (totalEvents || 1);
 return {
 totalEvents,
 totalVolumeM3: totalVolume,
 averageEfficiency: avgEfficiency,
 irrigationTypes: this.countByType(eventos),
 };
 }
 private calculateVolume(duracionMinutos: number, areaHectareas: number):
number {
 const flowRatePerHectare = 10; // m³ por hora por hectárea
 const hours = duracionMinutos / 60;
 return flowRatePerHectare * areaHectareas * hours;
 }
 private calculateDaysToHarvest(temporada: any): number {
 if (!temporada.fechaCosechaEstimada) return 30;
 const today = new Date();
 const harvestDate = new Date(temporada.fechaCosechaEstimada);
 const diffTime = harvestDate.getTime() - today.getTime();
 return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
 }
 private getGrowthStage(temporada: any): string {
 const plantingDate = new Date(temporada.fechaSiembra);
 const today = new Date();
 const daysSincePlanting = Math.floor((today.getTime() -
plantingDate.getTime()) / (1000 * 60 * 60 * 24));
 const totalCycle = temporada.cultivo.cicloDias || 120;
 if (daysSincePlanting < totalCycle * 0.25) return 'vegetativo';
 if (daysSincePlanting < totalCycle * 0.75) return 'floracion';
 return 'madurez';
 }
 private groupIrrigationByPeriod(eventos: any[], periodo: string) {
 const groups = new Map();
 eventos.forEach(evento => {
 let key;
 const date = new Date(evento.fechaHora);
 switch (periodo) {
 case 'semana':
 const weekNumber = this.getWeekNumber(date);
 key = `${date.getFullYear()}-W${weekNumber}`;
 break;
 case 'ano':
 key = date.getFullYear().toString();
 break;
 default:
 key = `${date.getFullYear()}-${date.getMonth() + 1}`;
 }
 if (!groups.has(key)) {
 groups.set(key, []);
 }
 groups.get(key).push(evento.volumenM3 || 0);
 });
 return Array.from(groups.entries()).map(([period, volumes]) => ({
 period,
 totalVolume: volumes.reduce((a, b) => a + b, 0),
 averageVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
 events: volumes.length,
 }));
 }
 private getWeekNumber(date: Date): number {
 const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
 const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) /
86400000;
 return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
 }
 private countByType(eventos: any[]): Record<string, number> {
 const counts: Record<string, number> = {};
 eventos.forEach(e => {
 counts[e.tipoRiego] = (counts[e.tipoRiego] || 0) + 1;
 });
 return counts;
 }

 private toNumber(value: unknown, fallback = 0): number {
 if (value === null || value === undefined || value === '') return fallback;
 const num = Number(value);
 return Number.isFinite(num) ? num : fallback;
 }

 private buildFallbackRecommendation(currentSoilMoisture: number, currentTemperature: number) {
 let recommendedVolumeM3 = 0;
 let urgency: 'low' | 'medium' | 'high' = 'low';
 if (currentSoilMoisture < 30) {
 recommendedVolumeM3 = 55;
 urgency = 'high';
 } else if (currentSoilMoisture < 45) {
 recommendedVolumeM3 = 30;
 urgency = 'medium';
 } else if (currentTemperature > 32) {
 recommendedVolumeM3 = 12;
 urgency = 'medium';
 }
 const optimalTime = urgency === 'high' ? '06:00' : '18:00';
 const context = this.buildRecommendationContext(urgency, optimalTime);
 return {
 needIrrigation: recommendedVolumeM3 > 0,
 recommendedVolumeM3,
 urgency,
 optimalTime,
 recommendation: recommendedVolumeM3 > 0
 ? `Recomendación estimada (fallback): aplicar ${recommendedVolumeM3.toFixed(2)} m³. ${context}`
 : `No se recomienda riego inmediato. ${context}`,
 };
 }

 private buildRecommendationContext(urgency: string, optimalTime: string) {
 const urgencyMap: Record<string, string> = {
 high: 'alta',
 medium: 'media',
 low: 'baja',
 };
 const urgencyLabel = urgencyMap[urgency] ?? urgency;
 return `Prioridad ${urgencyLabel}. Hora sugerida: ${optimalTime}.`;
 }
}
