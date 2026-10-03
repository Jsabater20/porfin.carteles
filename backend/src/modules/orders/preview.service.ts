import { BadRequestException, ConflictException, GoneException, HttpException, Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { tokenHash } from '../../common/utils/credentials';
import { PricingService } from '../pricing/pricing.service';
import { PREVIEW_TTL_MS } from '../guest-sessions/guest.constants';
import { DeliveryMethod, PreviewDto, PreviewLineDto, PreviewLineResultDto, PreviewResponseDto } from './dto/preview.dto';
import { validatePersonalization } from './personalization';
import { catalogDisplayType } from '../../common/catalog-classification';

const SCOPE = 'ORDER_PREVIEW';

@Injectable()
export class PreviewService {
  constructor(private readonly prisma: PrismaService, private readonly pricing: PricingService) {}

  private canonical(dto: PreviewDto): PreviewDto {
    return {
      deliveryMethod: dto.deliveryMethod,
      items: dto.items.map(line => ({
        lineId: line.lineId, productId: line.productId, variantId: line.variantId, quantity: line.quantity,
        answers: line.answers.map(answer => ({ fieldKey: answer.fieldKey, value: typeof answer.value === 'string' ? answer.value.normalize('NFC').trim() : answer.value })).sort((a, b) => a.fieldKey.localeCompare(b.fieldKey, 'en')),
      })),
    };
  }

  async create(dto: PreviewDto, guestSessionId: string, idempotencyKey: string) {
    const input = this.canonical(dto);
    const requestHash = tokenHash(JSON.stringify(input));
    const key = idempotencyKey.toLowerCase();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(async tx => {
          // La escritura bloquea la sesión. Una carrera sobre la misma sesión
          // reinicia el snapshot para ver el registro idempotente recién creado.
          const guest = await tx.guestSession.update({ where: { id: guestSessionId }, data: { lastSeenAt: new Date() } });
          if (guest.revokedAt || guest.expiresAt <= new Date()) throw new UnauthorizedException('La sesión de invitado ya no está activa.');
          const previous = await tx.idempotentRequest.findUnique({ where: { guestSessionId_scope_key: { guestSessionId, scope: SCOPE, key } }, include: { preview: true } });
          if (previous) {
            if (previous.requestHash !== requestHash) throw new ConflictException('La clave de idempotencia ya se usó con otro carrito.');
            if (previous.preview.expiresAt <= new Date()) throw new GoneException('La validación venció. Recalculá con una clave nueva.');
            return previous.preview.result as unknown as PreviewResponseDto;
          }
          const items: PreviewLineResultDto[] = [], errors: string[] = [];
          for (const line of input.items) {
            try { items.push(await this.line(line, tx)); }
            catch (error) {
              if (error instanceof HttpException && [400, 404].includes(error.getStatus())) errors.push('Línea ' + line.lineId + ': ' + error.message);
              else throw error;
            }
          }
          if (errors.length) throw new UnprocessableEntityException({ message: errors });
          const knownSubtotalCents = items.reduce((total, item) => total + (item.subtotalCents ?? 0), 0);
          if (!Number.isSafeInteger(knownSubtotalCents)) throw new BadRequestException('El subtotal supera el límite de cálculo.');
          const expiresAt = new Date(Math.min(Date.now() + PREVIEW_TTL_MS, guest.expiresAt.getTime()));
          if (expiresAt <= new Date()) throw new UnauthorizedException('La sesión de invitado venció.');
          const result: PreviewResponseDto = {
            id: randomUUID(), expiresAt: expiresAt.toISOString(), currency: 'ARS', items,
            summary: {
              knownSubtotalCents, pendingQuoteLines: items.filter(item => item.status === 'PENDING_QUOTE').length,
              pendingQuoteQuantity: items.filter(item => item.status === 'PENDING_QUOTE').reduce((sum, item) => sum + item.quantity, 0),
              totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
              shipping: { method: input.deliveryMethod, status: input.deliveryMethod === DeliveryMethod.PICKUP ? 'NOT_REQUIRED' : 'TO_CONFIRM', amountCents: input.deliveryMethod === DeliveryMethod.PICKUP ? 0 : null },
              finalTotalCents: null, status: 'PENDING_CONFIRMATION',
            },
          };
          await tx.orderPreview.create({ data: { id: result.id, guestSessionId, expiresAt, input: input as unknown as Prisma.InputJsonObject, result: result as unknown as Prisma.InputJsonObject } });
          await tx.idempotentRequest.create({ data: { guestSessionId, scope: SCOPE, key, requestHash, previewId: result.id } });
          return result;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000, maxWait: 5000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') throw new UnauthorizedException('La sesión de invitado ya no está activa.');
          if (['P2034', 'P2002'].includes(error.code)) {
            if (attempt < 4) continue;
            throw new ConflictException('El carrito se está validando en otra solicitud. Reintentá con la misma clave.');
          }
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la validación.');
  }

  async line(line: PreviewLineDto, tx: Prisma.TransactionClient): Promise<PreviewLineResultDto> {
    const product = await tx.product.findFirst({
      where: { id: line.productId, status: 'PUBLISHED' },
      select: {
        slug: true, type: true, category: true,
        categories: { where: { category: { isOccasion: true } }, select: { category: { select: { id: true, name: true, slug: true } } } },
        careers: { select: { career: { select: { id: true, name: true, slug: true } } } },
        variants: { where: { id: line.variantId, active: true }, select: { photoCount: true, attributes: true } },
        fields: { orderBy: { position: 'asc' }, include: { options: true } },
        components: { orderBy: { position: 'asc' }, select: { key: true, name: true, quantity: true, position: true } },
      },
    });
    if (!product) throw new BadRequestException('Producto no disponible.');
    const variant = product.variants[0];
    if (!variant) throw new BadRequestException('Variante no disponible para este producto.');
    const answers = validatePersonalization(product.fields, line.answers);
    const priced = await this.pricing.calculate({
      productId: line.productId, variantId: line.variantId, quantity: line.quantity,
      selections: answers.filter(answer => answer.type === 'SELECT').map(answer => ({ fieldKey: answer.fieldKey, optionKey: answer.value as string })),
    }, tx);
    return {
      ...priced, variantAttributes: variant.attributes as Prisma.JsonObject, lineId: line.lineId, slug: product.slug,
      type: product.type, category: product.category, displayType: catalogDisplayType(product.category, product.type, variant.photoCount),
      occasions: product.category === 'CARTEL' && ['GENERIC', 'PREDEFINED'].includes(product.type) ? product.categories.map(item => item.category) : [],
      careers: product.category === 'CARTEL' && product.type === 'PREDEFINED' ? product.careers.map(item => item.career) : [],
      answers, components: product.components, photoCountPerUnit: variant.photoCount,
      photoCountTotal: variant.photoCount * line.quantity, photoDelivery: variant.photoCount ? 'WHATSAPP' : 'NONE',
    };
  }

  async get(id: string, guestSessionId: string) {
    const preview = await this.prisma.orderPreview.findFirst({ where: { id, guestSessionId, guestSession: { revokedAt: null, expiresAt: { gt: new Date() } } }, select: { expiresAt: true, result: true } });
    if (!preview) throw new NotFoundException('Validación no encontrada.');
    if (preview.expiresAt <= new Date()) throw new GoneException('La validación venció. Recalculá el carrito.');
    return preview.result as unknown as PreviewResponseDto;
  }
}
