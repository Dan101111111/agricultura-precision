import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AlertsService {
 constructor(private prisma: PrismaService) {}
 async getUnread(userId: string) {
 return this.prisma.alerta.findMany({
 where: {
 usuarioId: userId,
 leida: false,
 },
 include: {
 lote: {
 include: {
 finca: true,
 },
 },
 },
 orderBy: { creadaEn: 'desc' },
 });
 }
 async getAll(userId: string, limit?: number, offset?: number) {
 const where = { usuarioId: userId };
 const [alerts, total] = await Promise.all([
 this.prisma.alerta.findMany({
 where,
 include: {
 lote: {
 include: {
 finca: true,
 },
 },
 },
 orderBy: { creadaEn: 'desc' },
 take: limit,
 skip: offset,
 }),
 this.prisma.alerta.count({ where }),
 ]);
 return { alerts, total };
 }
 async getUnreadCount(userId: string): Promise<number> {
 return this.prisma.alerta.count({
 where: {
 usuarioId: userId,
 leida: false,
 },
 });
 }
 async markAsRead(alertId: string, userId: string) {
 return this.prisma.alerta.update({
 where: {
 id: alertId,
 usuarioId: userId,
 },
 data: {
 leida: true,
 leidaEn: new Date(),
 },
 });
 }
 async markAllAsRead(userId: string) {
 return this.prisma.alerta.updateMany({
 where: {
 usuarioId: userId,
 leida: false,
 },
 data: {
 leida: true,
 leidaEn: new Date(),
 },
 });
 }
 async createAlert(data: {
 usuarioId: string;
 loteId?: string;
 tipo: string;
 severidad: string;
 mensaje: string;
 datosContexto?: any;
 }) {
 return this.prisma.alerta.create({
 data: {
 usuarioId: data.usuarioId,
 loteId: data.loteId,
 tipo: data.tipo,
 severidad: data.severidad,
 mensaje: data.mensaje,
 datosContexto: data.datosContexto,
 },
 });
 }
}