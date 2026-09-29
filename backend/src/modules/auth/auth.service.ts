import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { csrfToken, hashPassword, opaqueToken, tokenHash, verifyPassword } from '../../common/utils/credentials';
import { ADMIN_LOCK, adminSelect } from './auth.types';
import { RecoveryMailer } from './recovery-mailer.service';
import { LoginDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly mailer: RecoveryMailer) {}

  async login(dto: LoginDto, previousToken?: string) {
    const candidate = await this.prisma.administrator.findUnique({ where: { email: dto.email } });
    const matches = await verifyPassword(dto.password, candidate?.passwordHash);
    if (!matches || !candidate?.active) throw new UnauthorizedException('Email o contraseña incorrectos.');
    const token = opaqueToken();
    const expiresAt = new Date(Date.now() + this.config.get<number>('SESSION_TTL_HOURS', 8) * 3600000);
    const admin = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
      const current = await tx.administrator.findUnique({ where: { id: candidate.id } });
      if (!current?.active || current.passwordHash !== candidate.passwordHash) throw new UnauthorizedException('Email o contraseña incorrectos.');
      if (previousToken) await tx.adminSession.updateMany({ where: { tokenHash: tokenHash(previousToken), revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.adminSession.create({ data: { administratorId: current.id, tokenHash: tokenHash(token), expiresAt } });
      return tx.administrator.findUniqueOrThrow({ where: { id: current.id }, select: adminSelect });
    });
    return { admin, token, expiresAt, csrfToken: csrfToken(token) };
  }

  async authenticate(token?: string) {
    if (!token) throw new UnauthorizedException('Iniciá sesión para continuar.');
    const session = await this.prisma.adminSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { administrator: { select: adminSelect } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.administrator.active) throw new UnauthorizedException('La sesión no es válida o venció.');
    return { admin: session.administrator, session: { id: session.id, token, expiresAt: session.expiresAt } };
  }

  async logout(id: string) {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
      await tx.adminSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async recover(email: string) {
    this.mailer.assertAvailable();
    const token = opaqueToken();
    const result = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
      const admin = await tx.administrator.findUnique({ where: { email } });
      if (!admin?.active) return null;
      await tx.accessToken.updateMany({ where: { administratorId: admin.id, usedAt: null }, data: { usedAt: new Date() } });
      const record = await tx.accessToken.create({ data: { administratorId: admin.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
      return { recordId: record.id, email: admin.email };
    });
    if (result) {
      try { await this.mailer.send(result.email, token); }
      catch {
        await this.prisma.accessToken.updateMany({ where: { id: result.recordId, usedAt: null }, data: { usedAt: new Date() } });
        this.logger.error('No se pudo entregar un correo de recuperación. Revisar el proveedor SMTP.');
      }
    }
    // Misma respuesta para cuentas activas, inactivas e inexistentes.
    return { message: 'Si la cuenta está habilitada, recibirás un enlace para recuperar el acceso.' };
  }

  async reset(dto: ResetPasswordDto) {
    const passwordHash = await hashPassword(dto.password);
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
      const token = await tx.accessToken.findUnique({ where: { tokenHash: tokenHash(dto.token) }, include: { administrator: true } });
      if (!token || token.purpose !== 'PASSWORD_RESET' || token.usedAt || token.expiresAt <= new Date() || !token.administrator.active) throw new BadRequestException('El enlace no es válido o venció.');
      const now = new Date();
      await tx.accessToken.updateMany({ where: { administratorId: token.administratorId, usedAt: null }, data: { usedAt: now } });
      await tx.administrator.update({ where: { id: token.administratorId }, data: { passwordHash } });
      await tx.adminSession.updateMany({ where: { administratorId: token.administratorId, revokedAt: null }, data: { revokedAt: now } });
    });
    return { message: 'Contraseña actualizada. Iniciá sesión nuevamente.' };
  }
}
