import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class FarmsService {
 constructor(private prisma: PrismaService) {}
 async findAll(userId: string) {
 return this.prisma.finca.findMany({
 where: { usuarioId: userId },
 include: {
 lotes: true,
 },
 orderBy: { createdAt: 'desc' },
 });
 }
 async findOne(id: string, userId: string) {
 const finca = await this.prisma.finca.findFirst({
 where: {
 id,
 usuarioId: userId,
 },
 include: {
 lotes: {
 include: {
 temporadas: {
 include: {
 cultivo: true,
 },
 take: 1,
 },
 },
 },
 },
 });
 if (!finca) {
 throw new NotFoundException('Finca no encontrada');
 }
 return finca;
 }
 async create(data: { nombre: string; ubicacion?: string; areaHectareas:
number; coordenadas?: any }, userId: string) {
 return this.prisma.finca.create({
 data: {
 nombre: data.nombre,
 ubicacion: data.ubicacion,
 areaHectareas: data.areaHectareas,
 coordenadas: data.coordenadas,
 usuarioId: userId,
 },
 });
 }
 async update(id: string, data: Partial<{ nombre: string; ubicacion: string;
areaHectareas: number }>, userId: string) {
 const finca = await this.prisma.finca.findFirst({
 where: { id, usuarioId: userId },
 });
 if (!finca) {
 throw new NotFoundException('Finca no encontrada');
 }
 return this.prisma.finca.update({
 where: { id },
 data,
 });
 }
 async delete(id: string, userId: string) {
 const finca = await this.prisma.finca.findFirst({
 where: { id, usuarioId: userId },
 include: { lotes: true },
 });
 if (!finca) {
 throw new NotFoundException('Finca no encontrada');
 }
 if (finca.lotes.length > 0) {
 throw new ForbiddenException('No se puede eliminar una finca con lotes asociados');
 }
 return this.prisma.finca.delete({ where: { id } });
 }
}