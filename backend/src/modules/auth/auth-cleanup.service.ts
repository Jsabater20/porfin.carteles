import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ADMIN_LOCK } from './auth.types';

@Injectable()
export class AuthCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  onModuleInit() {
    if (this.config.get('NODE_ENV') !== 'test') this.timer = setInterval(() => { void this.runOnce(); }, 15 * 60000).unref();
  }
  async onModuleDestroy() { clearInterval(this.timer); await this.running; }
  runOnce(): Promise<void> {
    if (!this.running) this.running = this.clean().catch(() => { this.logger.warn('La limpieza de sesiones administrativas se reintentará.'); }).finally(() => { this.running = undefined; });
    return this.running;
  }
  private async clean() {
    const cutoff = new Date(Date.now() - 86400000);
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
      await tx.accessToken.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] } });
      await tx.adminSession.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] } });
      await tx.authRateLimit.deleteMany({ where: { expiresAt: { lt: cutoff } } });
    }, { timeout: 15000 });
  }
}