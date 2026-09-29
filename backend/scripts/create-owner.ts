import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { PrismaClient, AdminRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAdminDto } from '../src/modules/admins/dto/admin.dto';
import { hashPassword } from '../src/common/utils/credentials';
import { ADMIN_LOCK } from '../src/modules/auth/auth.types';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaClient();

async function main() {
  const dto = plainToInstance(CreateAdminDto, {
    name: process.env.BOOTSTRAP_OWNER_NAME,
    email: process.env.BOOTSTRAP_OWNER_EMAIL,
    password: process.env.BOOTSTRAP_OWNER_PASSWORD,
    role: AdminRole.OWNER,
  });
  if (validateSync(dto).length) throw new Error('Definí BOOTSTRAP_OWNER_NAME, BOOTSTRAP_OWNER_EMAIL y BOOTSTRAP_OWNER_PASSWORD (12 a 128 caracteres).');
  const passwordHash = await hashPassword(dto.password);
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
    if (await tx.administrator.count({ where: { role: AdminRole.OWNER } })) throw new Error('Ya existe un OWNER. Gestioná administradores desde la API.');
    await tx.administrator.create({ data: { name: dto.name, email: dto.email, passwordHash, role: AdminRole.OWNER } });
  });
  console.log('OWNER inicial creado. No se modificaron cuentas existentes.');
}

void main().catch(error => {
  // Nunca imprimir objetos Prisma que puedan contener credenciales.
  console.error(error instanceof Error && !error.constructor.name.startsWith('Prisma') ? error.message : 'No se pudo crear el OWNER inicial. Revisá la conexión y las migraciones.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
