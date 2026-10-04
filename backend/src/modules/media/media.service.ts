import { BadRequestException, ConflictException, ForbiddenException, GoneException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MediaUpload, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { ADMIN_LOCK } from '../auth/auth.types';
import { CloudinaryAsset, CloudinaryService } from './cloudinary.service';
import { CompleteUploadDto, ImageMetadataDto, ImageOrderDto, UploadSignatureDto } from './dto/media.dto';
import { MEDIA_CLEANUP_DELAY_MS, MEDIA_FORMATS, MEDIA_INTENT_TTL_MS, MEDIA_MAX_BYTES, MEDIA_MAX_IMAGES, MEDIA_MAX_PIXELS } from './media.constants';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, private readonly cloud: CloudinaryService) {}

  private write<T>(sessionId: string, action: (tx: Prisma.TransactionClient, administratorId: string) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
      const session = await tx.adminSession.findFirst({ where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() }, administrator: { active: true } } });
      if (!session) throw new ForbiddenException('La sesión administrativa ya no está activa.');
      return action(tx, session.administratorId);
    }, { timeout: 15000 });
  }

  private async product(tx: Prisma.TransactionClient, id: string) {
    if (!await tx.product.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundException('Producto no encontrado.');
  }

  async signature(dto: UploadSignatureDto, sessionId: string) {
    // Las llamadas externas no mantienen transacciones ni locks de PostgreSQL.
    await this.cloud.validatePreset();
    return this.write(sessionId, async (tx, administratorId) => {
      await this.product(tx, dto.productId);
      const now = new Date();
      const recent = await tx.mediaUpload.count({ where: { administratorId, createdAt: { gt: new Date(now.getTime() - 3600000) } } });
      if (recent >= 60) throw new HttpException('Alcanzaste el límite de 60 autorizaciones por hora.', 429);
      const images = await tx.productImage.count({ where: { productId: dto.productId } });
      const pending = await tx.mediaUpload.count({ where: { productId: dto.productId, confirmedAt: null, cancelledAt: null, expiresAt: { gt: now } } });
      if (images + pending >= MEDIA_MAX_IMAGES) throw new ConflictException('El producto admite hasta 12 imágenes, incluidas las cargas pendientes.');
      const upload = await tx.mediaUpload.create({ data: {
        productId: dto.productId, administratorId, cloudName: this.cloud.cloudName,
        publicId: `porfin/products/${dto.productId}/${randomUUID()}`,
        expiresAt: new Date(now.getTime() + MEDIA_INTENT_TTL_MS),
        cleanupAfter: new Date(now.getTime() + MEDIA_CLEANUP_DELAY_MS),
      } });
      return { uploadId: upload.id, expiresAt: upload.expiresAt, maxBytes: MEDIA_MAX_BYTES, formats: MEDIA_FORMATS, ...this.cloud.sign(upload.publicId, Math.floor(now.getTime() / 1000)) };
    });
  }

  private async ownedUpload(tx: Prisma.TransactionClient, id: string, administratorId: string) {
    const upload = await tx.mediaUpload.findUnique({ where: { id }, include: { image: true } });
    if (!upload || upload.administratorId !== administratorId) throw new NotFoundException('Carga no encontrada.');
    return upload;
  }

  private pending(upload: MediaUpload) {
    if (upload.cancelledAt || upload.cleanedAt || !upload.productId || upload.confirmedAt) throw new ConflictException('La carga ya no está disponible.');
    if (upload.expiresAt <= new Date()) throw new GoneException('La autorización de carga venció. Solicitá una nueva.');
    if (!this.cloud.enabled || upload.cloudName !== this.cloud.cloudName) throw new ServiceUnavailableException('La cuenta de Cloudinary de esta carga no está configurada.');
  }

  private validAsset(asset: CloudinaryAsset, upload: MediaUpload): boolean {
    try {
      const url = new URL(asset.secure_url);
      return asset.public_id === upload.publicId && typeof asset.asset_id === 'string' && asset.asset_id.length > 0 && asset.asset_id.length <= 200 && asset.resource_type === 'image' && asset.type === 'upload'
        && MEDIA_FORMATS.includes(asset.format) && Number.isInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= MEDIA_MAX_BYTES
        && Number.isInteger(asset.width) && Number.isInteger(asset.height) && asset.width > 0 && asset.height > 0 && asset.width * asset.height <= MEDIA_MAX_PIXELS
        && url.origin === 'https://res.cloudinary.com' && !url.username && !url.password && url.pathname.startsWith(`/${upload.cloudName}/image/upload/`);
    } catch { return false; }
  }

  async complete(dto: CompleteUploadDto, sessionId: string) {
    const upload = await this.write(sessionId, async (tx, adminId) => {
      const current = await this.ownedUpload(tx, dto.uploadId, adminId);
      if (!current.image) this.pending(current);
      return current;
    });
    if (upload.image) return upload.image;
    const asset = await this.cloud.inspect(upload.publicId);
    if (!this.validAsset(asset, upload)) {
      await this.write(sessionId, async (tx, adminId) => {
        const current = await this.ownedUpload(tx, upload.id, adminId);
        if (!current.image) await tx.mediaUpload.update({ where: { id: upload.id }, data: { cancelledAt: new Date() } });
      });
      throw new BadRequestException('Imagen inválida: usá JPG, PNG o WebP, hasta 5 MiB y 40 megapíxeles.');
    }
    return this.write(sessionId, async (tx, adminId) => {
      const current = await this.ownedUpload(tx, upload.id, adminId);
      if (current.image) return current.image;
      this.pending(current);
      const productId = current.productId!;
      const count = await tx.productImage.count({ where: { productId } });
      if (count >= MEDIA_MAX_IMAGES) throw new ConflictException('La galería está completa.');
      const image = await tx.productImage.create({ data: { productId, uploadId: current.id, publicId: current.publicId, assetId: asset.asset_id, url: asset.secure_url, format: asset.format, bytes: asset.bytes, width: asset.width, height: asset.height, altText: dto.altText.trim(), shape: dto.shape ?? null, position: count, cover: count === 0 } });
      await tx.mediaUpload.update({ where: { id: current.id }, data: { confirmedAt: new Date() } });
      return image;
    });
  }

  cancel(uploadId: string, sessionId: string) {
    return this.write(sessionId, async (tx, adminId) => {
      const upload = await this.ownedUpload(tx, uploadId, adminId);
      if (upload.image) throw new ConflictException('La imagen ya integra la galería; eliminala desde el producto.');
      await tx.mediaUpload.update({ where: { id: uploadId }, data: { cancelledAt: upload.cancelledAt ?? new Date() } });
    });
  }

  async list(productId: string) {
    await this.product(this.prisma, productId);
    return this.prisma.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
  }

  private async image(tx: Prisma.TransactionClient, productId: string, id: string) {
    const image = await tx.productImage.findFirst({ where: { id, productId } });
    if (!image) throw new NotFoundException('Imagen no encontrada en este producto.');
    return image;
  }

  updateMetadata(productId: string, id: string, dto: ImageMetadataDto, sessionId: string) {
    return this.write(sessionId, async tx => {
      await this.image(tx, productId, id);
      return tx.productImage.update({ where: { id }, data: { altText: dto.altText.trim(), ...(dto.shape !== undefined ? { shape: dto.shape } : {}) } });
    });
  }

  private async arrange(tx: Prisma.TransactionClient, productId: string, ids: string[]) {
    await tx.productImage.updateMany({ where: { productId, cover: true }, data: { cover: false } });
    for (const [position, id] of ids.entries()) await tx.productImage.update({ where: { id }, data: { position, cover: position === 0 } });
    return tx.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
  }

  reorder(productId: string, dto: ImageOrderDto, sessionId: string) {
    return this.write(sessionId, async tx => {
      await this.product(tx, productId);
      const images = await tx.productImage.findMany({ where: { productId }, select: { id: true } });
      if (images.length !== dto.imageIds.length || images.some(image => !dto.imageIds.includes(image.id))) throw new ConflictException('Enviá todos los IDs actuales de la galería una sola vez.');
      return this.arrange(tx, productId, dto.imageIds);
    });
  }

  remove(productId: string, id: string, sessionId: string) {
    return this.write(sessionId, async tx => {
      const image = await this.image(tx, productId, id);
      // Desvincular y programar limpieza en la misma transacción: no se pierde
      // el trabajo si Cloudinary está caído o el proceso se reinicia.
      await tx.mediaUpload.update({ where: { id: image.uploadId }, data: { cancelledAt: new Date() } });
      await tx.productImage.delete({ where: { id } });
      const remaining = await tx.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' }, select: { id: true } });
      await this.arrange(tx, productId, remaining.map(item => item.id));
    });
  }
}
