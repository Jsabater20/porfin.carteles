import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class MediaCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(private readonly prisma: PrismaService, private readonly cloud: CloudinaryService, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.cloud.enabled && this.config.get('NODE_ENV') !== 'test') this.timer = setInterval(() => { void this.runOnce(); }, 60000).unref();
  }

  async onModuleDestroy() { clearInterval(this.timer); await this.running; }

  runOnce(): Promise<void> {
    if (!this.cloud.enabled) return Promise.resolve();
    if (!this.running) this.running = this.clean().catch(() => { this.logger.warn('No se pudo ejecutar la limpieza de imágenes; se reintentará.'); }).finally(() => { this.running = undefined; });
    return this.running;
  }

  private async clean() {
    const now = new Date();
    const where = { cloudName: this.cloud.cloudName, cleanedAt: null, cleanupAfter: { lte: now }, image: null, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] };
    const uploads = await this.prisma.mediaUpload.findMany({ where, take: 20, orderBy: { cleanupAfter: 'asc' } });
    for (const upload of uploads) {
      // Lease atómico compartido por réplicas; las operaciones externas son idempotentes.
      const claimed = await this.prisma.mediaUpload.updateMany({ where: { ...where, id: upload.id }, data: { leaseUntil: new Date(Date.now() + 60000), cleanupAttempts: { increment: 1 } } });
      if (!claimed.count) continue;
      try {
        await this.cloud.destroy(upload.publicId);
        await this.prisma.mediaUpload.update({ where: { id: upload.id }, data: { cleanedAt: new Date(), leaseUntil: null } });
      } catch {
        await this.prisma.mediaUpload.update({ where: { id: upload.id }, data: { leaseUntil: null, cleanupAfter: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(upload.cleanupAttempts, 6))) } });
        this.logger.warn('Una imagen quedó pendiente de limpieza; se reintentará automáticamente.');
      }
    }
  }
}
