import { Injectable, UnauthorizedException, ConflictException } from
'@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
@Injectable()
export class AuthService {
 constructor(
 private prisma: PrismaService,
 private jwtService: JwtService,
 ) {}
 async login(email: string, password: string) {
 const usuario = await this.prisma.usuario.findUnique({
 where: { email },
 include: { rol: true },
 });
 if (!usuario) {
 throw new UnauthorizedException('Credenciales inválidas');
 }
 const passwordValid = await bcrypt.compare(password,
usuario.passwordHash);
 if (!passwordValid) {
 throw new UnauthorizedException('Credenciales inválidas');
 }
 const token = this.jwtService.sign({
 sub: usuario.id,
 email: usuario.email,
 rol: usuario.rol.nombre,
 });
 await this.prisma.usuario.update({
 where: { id: usuario.id },
 data: { ultimoAcceso: new Date() },
 });
 return {
 token,
 usuario: {
 id: usuario.id,
 email: usuario.email,
 nombre: usuario.nombre,
 apellido: usuario.apellido,
 rol: usuario.rol.nombre,
 },
 };
 }
 async register(data: { email: string; password: string; nombre: string; apellido:
string }) {
 const existingUser = await this.prisma.usuario.findUnique({
 where: { email: data.email },
 });
 if (existingUser) {
 throw new ConflictException('El email ya está registrado');
 }
 const hashedPassword = await bcrypt.hash(data.password, 10);
 const rolUsuario = await this.prisma.rol.findFirst({
 where: { nombre: 'usuario' },
 });
 if (!rolUsuario) {
 throw new Error('Rol de usuario no encontrado');
 }
 const usuario = await this.prisma.usuario.create({
 data: {
 email: data.email,
 passwordHash: hashedPassword,
 nombre: data.nombre,
 apellido: data.apellido,
 rolId: rolUsuario.id,
 },
 include: { rol: true },
 });
 const token = this.jwtService.sign({
 sub: usuario.id,
 email: usuario.email,
 rol: usuario.rol.nombre,
 });
 return {
 token,
 usuario: {
 id: usuario.id,
 email: usuario.email,
 nombre: usuario.nombre,
 apellido: usuario.apellido,
 rol: usuario.rol.nombre,
 },
 };
 }
 async getUser(id: string) {
 const usuario = await this.prisma.usuario.findUnique({
 where: { id },
 include: { rol: true },
 });
 if (!usuario) {
 throw new UnauthorizedException('Usuario no encontrado');
 }
 return {
 id: usuario.id,
 email: usuario.email,
 nombre: usuario.nombre,
 apellido: usuario.apellido,
 rol: usuario.rol.nombre,
 };
 }
}
