import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
const prisma = new PrismaClient()
async function main() {
 // Crear roles
 const roles = await prisma.rol.createMany({
 data: [
 { nombre: 'admin', descripcion: 'Administrador del sistema' },
 { nombre: 'usuario', descripcion: 'Usuario regular' },
 { nombre: 'tecnico', descripcion: 'Técnico agrícola' },
 ],
 skipDuplicates: true,
 })
 // Crear usuario admin
 const adminRole = await prisma.rol.findFirst({ where: { nombre: 'admin' } })

 if (adminRole) {
 const hashedPassword = await bcrypt.hash('admin123', 10)
 await prisma.usuario.upsert({
 where: { email: 'admin@agricultura.com' },
 update: {},
 create: {
 email: 'admin@agricultura.com',
 passwordHash: hashedPassword,
 nombre: 'Administrador',
 apellido: 'Sistema',
 rolId: adminRole.id,
 },
 })
 }
 // Crear cultivos de ejemplo
 const cultivos = await prisma.cultivo.createMany({
 data: [
 { nombre: 'Maíz', variedad: 'Híbrido', cicloDias: 120, requerimientoAguaMm:
500, temperaturaOptima: 25, humedadOptima: 70 },
 { nombre: 'Soja', variedad: 'Intacta', cicloDias: 110, requerimientoAguaMm:
450, temperaturaOptima: 24, humedadOptima: 65 },
 { nombre: 'Trigo', variedad: 'Baguette', cicloDias: 130,
requerimientoAguaMm: 400, temperaturaOptima: 20, humedadOptima: 60 },
 { nombre: 'Girasol', variedad: 'Aceitero', cicloDias: 115,
requerimientoAguaMm: 480, temperaturaOptima: 22, humedadOptima: 55 },
 ],
 skipDuplicates: true,
 })
 console.log('Seed completado exitosamente')
}
main()
 .catch((e) => {
 console.error(e)
 process.exit(1)
 })
 .finally(async () => {
 await prisma.$disconnect()
 })
