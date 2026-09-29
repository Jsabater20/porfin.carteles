import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PREVIEW_RETENTION_MS } from './guest.constants';

@Injectable()
export class GuestCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GuestCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  onModuleInit() {
    if (this.config.get('NODE_ENV') !== 'test') this.timer = setInterval(() => { void this.runOnce(); }, 15 * 60000).unref();
  }
  async onModuleDestroy() { clearInterval(this.timer); await this.running; }
  runOnce(): Promise<void> {
    if (!this.running) this.running = this.clean().catch(() => { this.logger.warn('La limpieza de sesiones invitadas se reintentará.'); }).finally(() => { this.running = undefined; });
    return this.running;
  }
  private async clean() {
    const now = new Date();
    await this.prisma.orderPreview.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - PREVIEW_RETENTION_MS) } } });
    await this.prisma.guestSession.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] } });
    await this.prisma.guestRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
  }
}
