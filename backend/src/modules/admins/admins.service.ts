import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AdminRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { hashPassword } from '../../common/utils/credentials';
import { ADMIN_LOCK, adminSelect } from '../auth/auth.types';
import { AdminListQuery, CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  private async lockOwner(tx: Prisma.TransactionClient, sessionId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
    const session = await tx.adminSession.findFirst({ where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() }, administrator: { active: true, role: AdminRole.OWNER } } });
    if (!session) throw new ForbiddenException('Se requiere una sesión vigente de OWNER.');
  }

  private duplicate(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Ya existe un administrador con ese email.');
    throw error;
  }

  async list(query: AdminListQuery) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.administrator.findMany({ select: { ...adminSelect, createdAt: true, updatedAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.administrator.count(),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async create(dto: CreateAdminDto, sessionId: string) {
    const passwordHash = await hashPassword(dto.password);
    try {
      return await this.prisma.$transaction(async tx => {
        await this.lockOwner(tx, sessionId);
        return tx.administrator.create({ data: { name: dto.name, email: dto.email, passwordHash, role: dto.role ?? AdminRole.ADMIN }, select: adminSelect });
      });
    } catch (error) { this.duplicate(error); }
  }

  async update(id: string, dto: UpdateAdminDto, sessionId: string) {
    if (!Object.values(dto).some(value => value !== undefined)) throw new BadRequestException('Indicá al menos un campo para actualizar.');
    const passwordHash = dto.password !== undefined ? await hashPassword(dto.password) : undefined;
    try {
      return await this.prisma.$transaction(async tx => {
        await this.lockOwner(tx, sessionId);
        const target = await tx.administrator.findUnique({ where: { id } });
        if (!target) throw new NotFoundException('Administrador no encontrado.');
        if (target.active && target.role === AdminRole.OWNER && (dto.active === false || dto.role === AdminRole.ADMIN)) {
          const owners = await tx.administrator.count({ where: { role: AdminRole.OWNER, active: true } });
          if (owners <= 1) throw new ConflictException('Debe quedar al menos un OWNER activo.');
        }
        const result = await tx.administrator.update({ where: { id }, data: { name: dto.name, email: dto.email, role: dto.role, active: dto.active, passwordHash }, select: adminSelect });
        if (passwordHash || (dto.email !== undefined && dto.email !== target.email) || (dto.role !== undefined && dto.role !== target.role) || dto.active === false) {
          const now = new Date();
          await tx.adminSession.updateMany({ where: { administratorId: id, revokedAt: null }, data: { revokedAt: now } });
          await tx.accessToken.updateMany({ where: { administratorId: id, usedAt: null }, data: { usedAt: now } });
        }
        return result;
      });
    } catch (error) { this.duplicate(error); }
  }
}
