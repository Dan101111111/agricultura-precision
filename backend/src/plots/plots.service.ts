import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class PlotsService {
 constructor(private prisma: PrismaService) {}
 async findByFarm(fincaId: string, userId: string) {
 const finca = await this.prisma.finca.findFirst({
 where: { id: fincaId, usuarioId: userId },
 });
 if (!finca) {
 throw new NotFoundException('Finca no encontrada');
 }
 return this.prisma.lote.findMany({
 where: { fincaId },
 include: {
 temporadas: {
 where: { estado: 'activo' },
 include: { cultivo: true },
 },
 sensores: true,
 },
 orderBy: { createdAt: 'desc' },
 });
 }
 async findAllByUser(userId: string) {
 return this.prisma.lote.findMany({
 where: {
 finca: {
 usuarioId: userId,
 },
 },
 include: {
 finca: true,
 temporadas: {
 include: { cultivo: true },
 take: 1,
 },
 },
 });
 }
 async findOne(id: string, userId: string) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id,
 finca: {
 usuarioId: userId,
 },
 },
 include: {
 finca: true,
 temporadas: {
 include: { cultivo: true },
 },
 sensores: {
 include: {
 lecturas: {
 orderBy: { timestamp: 'desc' },
 take: 10,
 },
 },
 },
 eventosRiego: {
 orderBy: { fechaHora: 'desc' },
 take: 20,
 },
 predicciones: {
 orderBy: { fechaPrediccion: 'desc' },
 take: 5,
 },
 },
 });
 if (!lote) {
 throw new NotFoundException('Lote no encontrado');
 }
 return lote;
 }
 async create(
 data: {
 nombre: string;
 fincaId: string;
 areaHectareas: number;
 tipoSuelo: string;
 coordenadasPoligono?: any;
 },
 userId: string,
 ) {
 const finca = await this.prisma.finca.findFirst({
 where: { id: data.fincaId, usuarioId: userId },
 });
 if (!finca) {
 throw new NotFoundException('Finca no encontrada');
 }
 return this.prisma.lote.create({
 data: {
 nombre: data.nombre,
 fincaId: data.fincaId,
 areaHectareas: data.areaHectareas,
 tipoSuelo: data.tipoSuelo,
 coordenadasPoligono: data.coordenadasPoligono,
 },
 });
 }
 async update(id: string, data: Partial<{ nombre: string; areaHectareas:
number; tipoSuelo: string }>, userId: string) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id,
 finca: {
 usuarioId: userId,
 },
 },
 });
 if (!lote) {
 throw new NotFoundException('Lote no encontrado');
 }
 return this.prisma.lote.update({
 where: { id },
 data,
 });
 }
 async delete(id: string, userId: string) {
 const lote = await this.prisma.lote.findFirst({
 where: {
 id,
 finca: {
 usuarioId: userId,
 },
 },
 include: {
 temporadas: true,
 sensores: true,
 },
 });
 if (!lote) {
 throw new NotFoundException('Lote no encontrado');
 }
 if (lote.temporadas.length > 0 || lote.sensores.length > 0) {
 throw new ForbiddenException('No se puede eliminar un lote con datos asociados');
 }
 return this.prisma.lote.delete({ where: { id } });
 }
}