import { BadRequestException, ConflictException, GoneException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, OrderStatus, QuoteStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../../database/prisma.service';
import { tokenHash } from '../../common/utils/credentials';
import { adminTransaction } from '../../common/utils/admin-transaction';
import { moneyJson } from '../../common/utils/money';
import { ADMIN_LOCK } from '../auth/auth.types';
import { CreateManualOrderDto, CreateOrderDto, CreateOrderQuoteDto } from './dto/order.dto';
import { DeliveryMethod, PreviewDto, PreviewResponseDto } from './dto/preview.dto';
import { PreviewService } from './preview.service';
import { OrderNotificationMailer } from './order-notification-mailer.service';

const SCOPE = 'ORDER_CREATE';
const CATEGORY_LABELS = { CARTEL: 'Cartel', PROP: 'Prop', COMBO: 'Combo' } as const;
const DISPLAY_TYPE_LABELS = { GENERIC: 'Genérico', PREDEFINED: 'Predeterminado', PREDEFINED_THREE_IMAGES: 'Predeterminado con 3 imágenes a elección', CUSTOM: 'Personalizado', COMBO: 'Combo' } as const;
const detail = { items: true, events: { orderBy: { createdAt: 'asc' as const } }, quotes: { orderBy: { version: 'asc' as const }, include: { items: true } }, payments: { orderBy: { occurredAt: 'asc' as const } } } satisfies Prisma.OrderInclude;
type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;
type WhatsAppItem = { quantity: number; productName: string; variantName: string; subtotalCents: number | null; category?: string; displayType?: string; attributes: [string, string][]; answers: { label: string; value: string }[] };

const amount = (cents: number) => (cents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const displayDate = (value: string | Date) => (value instanceof Date ? value.toISOString().slice(0, 10) : value).split('-').reverse().join('/');
function whatsappText(input: { reference: string; firstName: string; lastName: string; requestedDate: string | Date; deliveryMethod: string; notes?: string | null; knownSubtotalCents: number; items: WhatsAppItem[] }) {
  return [
    'Hola Por fin Carteles! Quisiera consultar este pedido:',
    input.reference,
    ...input.items.flatMap(item => [
      `${item.quantity} × ${item.productName} (${item.variantName}): ${item.subtotalCents === null ? 'A cotizar' : amount(item.subtotalCents)}`,
      ...(item.category ? ['  Categoría: ' + item.category] : []),
      ...(item.displayType ? ['  Tipo: ' + item.displayType] : []),
      ...item.attributes.map(([label, value]) => `  ${label}: ${value}`),
      ...item.answers.map(answer => `  ${answer.label}: ${answer.value}`),
    ]),
    '',
    'Nombre: ' + input.firstName,
    'Apellido: ' + input.lastName,
    'Lo necesitaría para: ' + displayDate(input.requestedDate),
    'Entrega: ' + (input.deliveryMethod === DeliveryMethod.PICKUP ? 'Retiro' : input.deliveryMethod === DeliveryMethod.SHIPPING ? 'Envío (correo)' : 'A coordinar'),
    ...(input.notes ? ['Observaciones: ' + input.notes] : []),
    'Subtotal conocido: ' + amount(input.knownSubtotalCents),
    '',
    'Entiendo que el pedido, la disponibilidad, la fecha y el precio final quedan pendientes de confirmación por la emprendedora en este chat. Y que para confirmar el pedido y comenzar con el diseño, se abona una seña del 50% del total.',
  ].join('\n');
}

function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as Prisma.JsonObject : {}; }
function stringValue(value: unknown) { return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''; }
function whatsappUrl(existing: string | null, message: string) {
  if (!existing) return null;
  try {
    const parsed = new URL(existing);
    const phone = parsed.hostname === 'wa.me' ? parsed.pathname.slice(1) : '';
    return /^[1-9][0-9]{7,14}$/.test(phone) ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
  } catch { return null; }
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService, private readonly previews: PreviewService, private readonly notifications: OrderNotificationMailer) {}

  async create(dto: CreateOrderDto, guestSessionId: string, idempotencyKey: string) {
    const key = idempotencyKey.toLowerCase();
    const requestHash = tokenHash(JSON.stringify({ previewId: dto.previewId, customerFirstName: dto.customerFirstName, customerLastName: dto.customerLastName, customerEmail: dto.customerEmail, customerBirthDate: dto.customerBirthDate ?? null, customerPhone: dto.customerPhone ?? null, requestedDate: dto.requestedDate, deliveryMethod: dto.deliveryMethod, deliveryAddress: dto.deliveryAddress ?? null, notes: dto.notes ?? null }));
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await this.prisma.$transaction(async tx => {
          // Comparte el bloqueo con las escrituras de catálogo y configuración.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
          const guest = await tx.guestSession.update({ where: { id: guestSessionId }, data: { lastSeenAt: new Date() } });
          if (guest.revokedAt || guest.expiresAt <= new Date()) throw new UnauthorizedException('La sesión de invitado ya no está activa.');
          const existing = await tx.orderRequest.findUnique({ where: { guestSessionId_scope_key: { guestSessionId, scope: SCOPE, key } }, include: { order: { include: { items: true } } } });
          if (existing) {
            if (existing.requestHash !== requestHash) throw new ConflictException('La clave de idempotencia ya se usó con otro pedido.');
            return { response: this.serialize(existing.order, key), recipient: null, notify: false };
          }
          const preview = await tx.orderPreview.findFirst({ where: { id: dto.previewId, guestSessionId }, select: { input: true, result: true, expiresAt: true } });
          if (!preview) throw new NotFoundException('Validación no encontrada.');
          if (preview.expiresAt <= new Date()) throw new GoneException('La validación venció. Recalculá el pedido.');
          const input = preview.input as unknown as PreviewDto;
          const result = preview.result as unknown as PreviewResponseDto;
          if (dto.deliveryMethod === DeliveryMethod.UNDECIDED || dto.deliveryMethod !== input.deliveryMethod) throw new BadRequestException('Elegí la entrega y volvé a validar el carrito.');
          const phone = dto.customerPhone.replace(/[^0-9]/g, '');
          if (!/^[1-9][0-9]{7,14}$/.test(phone)) throw new BadRequestException('Ingresá un teléfono válido.');
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
          if (dto.customerBirthDate > today) throw new BadRequestException('La fecha de nacimiento no puede estar en el futuro.');
          if (dto.requestedDate < today) throw new BadRequestException('La fecha solicitada no puede estar en el pasado.');
          const currentItems = [];
          try {
            for (const line of input.items) currentItems.push(await this.previews.line(line, tx));
          } catch (error) {
            if (error instanceof HttpException && [400, 404].includes(error.getStatus())) throw new ConflictException('El catálogo cambió. Volvé a validar el carrito.');
            throw error;
          }
          if (!isDeepStrictEqual(currentItems, result.items)) throw new ConflictException('El catálogo cambió. Volvé a validar el carrito.');
          const settings = await tx.storeSettings.findUnique({ where: { id: 1 } });
          if (settings?.deliveryMethods.length && !settings.deliveryMethods.includes(dto.deliveryMethod)) throw new ConflictException('La modalidad de entrega ya no está disponible.');
          const reference = 'CAR-' + randomUUID().toUpperCase();
          const whatsappMessage = whatsappText({
            reference, firstName: dto.customerFirstName, lastName: dto.customerLastName, requestedDate: dto.requestedDate,
            deliveryMethod: dto.deliveryMethod, notes: dto.notes, knownSubtotalCents: result.summary.knownSubtotalCents,
            items: currentItems.map(item => ({ quantity: item.quantity, productName: item.productName, variantName: item.variantName, subtotalCents: item.subtotalCents,
              category: item.category ? CATEGORY_LABELS[item.category] : undefined, displayType: DISPLAY_TYPE_LABELS[item.displayType],
              attributes: Object.entries(item.variantAttributes), answers: item.answers.map(answer => ({ label: answer.label, value: String(answer.displayValue) })) })),
          });
          const order = await tx.order.create({ data: {
            guestSessionId, reference, customerName: dto.customerFirstName + ' ' + dto.customerLastName, customerPhone: phone,
            customerFirstName: dto.customerFirstName, customerLastName: dto.customerLastName, customerEmail: dto.customerEmail,
            customerBirthDate: new Date(dto.customerBirthDate),
            requestedDate: new Date(dto.requestedDate), scheduledDate: new Date(dto.requestedDate), deliveryMethod: dto.deliveryMethod,
            deliveryAddress: dto.deliveryMethod === DeliveryMethod.SHIPPING ? dto.deliveryAddress : null, notes: dto.notes ?? null,
            knownSubtotalCents: result.summary.knownSubtotalCents, pendingQuoteCount: result.summary.pendingQuoteLines,
            shippingCents: dto.deliveryMethod === DeliveryMethod.PICKUP ? 0 : null,
            whatsappMessage, whatsappUrl: settings?.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}` : null,
            items: { create: currentItems.map(item => ({
              productId: item.productId, productName: item.productName,
              variantSnapshot: { id: item.variantId, name: item.variantName, attributes: item.variantAttributes, photoCount: item.photoCountPerUnit, pricingMode: item.pricingMode, baseUnitCents: item.baseUnitCents, unitPriceCents: item.unitPriceCents, category: item.category, displayType: item.displayType, occasions: item.occasions, careers: item.careers } as unknown as Prisma.InputJsonObject,
              customizationSnapshot: { answers: item.answers, selectedOptions: item.selectedOptions } as unknown as Prisma.InputJsonObject,
              componentsSnapshot: item.components as unknown as Prisma.InputJsonArray,
              pricingMode: item.pricingMode, unitPriceCents: item.unitPriceCents, quantity: item.quantity, subtotalCents: item.subtotalCents,
            })) },
            events: { create: { type: 'CREATED', details: { previewId: dto.previewId, source: 'preview' } } },
          }, include: { items: true } });
          await tx.orderRequest.create({ data: { guestSessionId, scope: SCOPE, key, requestHash, orderId: order.id } });
          return { response: this.serialize(order, key), recipient: settings?.contactEmail, notify: true };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000, maxWait: 5000 });
        if (result.notify && result.recipient) {
          try { await this.notifications.send(result.recipient, result.response); } catch { /* El pedido ya está guardado; el correo no debe impedir responder al cliente. */ }
        }
        return result.response;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') throw new UnauthorizedException('La sesión de invitado ya no está activa.');
          if (['P2034', 'P2002'].includes(error.code)) {
            if (attempt < 4) continue;
            throw new ConflictException('Reintentá con la misma clave de idempotencia.');
          }
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo crear el pedido.');
  }

  async guestGet(id: string, guestSessionId: string) {
    const order = await this.prisma.order.findFirst({ where: { id, guestSessionId, guestSession: { revokedAt: null, expiresAt: { gt: new Date() } } }, include: { items: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado.');
    return this.serialize(order);
  }
  async list(page = 1) {
    const where = {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, skip: (page - 1) * 25, take: 25, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, reference: true, customerName: true, status: true, requestedDate: true, scheduledDate: true, source: true, knownSubtotalCents: true, pendingQuoteCount: true, createdAt: true } }),
      this.prisma.order.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return moneyJson({ items, total, page, pageSize: 25 });
  }
  async calendar(from: string, to: string) {
    if (from > to) throw new BadRequestException('El rango del calendario no es válido.');
    const start = new Date(from), end = new Date(to);
    if ((end.getTime() - start.getTime()) / 86400000 > 62) throw new BadRequestException('El calendario admite rangos de hasta 62 días.');
    const items = await this.prisma.order.findMany({
      where: { scheduledDate: { gte: start, lte: end } },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, reference: true, customerName: true, status: true, requestedDate: true, scheduledDate: true, source: true, knownSubtotalCents: true, pendingQuoteCount: true, createdAt: true },
    });
    return moneyJson({ items });
  }
  createManual(dto: CreateManualOrderDto, sessionId: string) {
    return adminTransaction(this.prisma, sessionId, async (tx, administratorId) => {
      const reference = 'MAN-' + randomUUID().toUpperCase();
      const order = await tx.order.create({
        data: {
          reference, customerName: dto.customerName, customerEmail: dto.customerEmail ?? null, customerPhone: (dto.customerPhone ?? '').replace(/[^0-9]/g, ''),
          requestedDate: new Date(dto.scheduledDate), scheduledDate: new Date(dto.scheduledDate), source: 'MANUAL', deliveryMethod: dto.deliveryMethod,
          notes: dto.notes ?? null, knownSubtotalCents: 0, pendingQuoteCount: 1, status: dto.status,
          items: { create: { productName: dto.description, customizationSnapshot: { answers: [], selectedOptions: [] }, pricingMode: 'QUOTE', quantity: 1 } },
          events: { create: { type: 'MANUAL_ORDER_CREATED', details: { administratorId, description: dto.description, scheduledDate: dto.scheduledDate } } },
        },
        include: detail,
      });
      const { guestSessionId: _guest, payments, ...safe } = order;
      return moneyJson({ ...safe, payments: payments.map(({ idempotencyKey: _key, requestHash: _hash, ...payment }) => payment) });
    });
  }
  async adminGet(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: detail });
    if (!order) throw new NotFoundException('Pedido no encontrado.');
    const { guestSessionId: _guest, payments, ...safe } = order;
    return moneyJson({ ...safe, payments: payments.map(({ idempotencyKey: _key, requestHash: _hash, ...payment }) => payment) });
  }
  remove(orderId: string, reference: string, sessionId: string) {
    return adminTransaction(this.prisma, sessionId, async tx => {
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, reference: true } });
      if (!current) throw new NotFoundException('Pedido no encontrado.');
      if (current.reference !== reference) throw new ConflictException('La referencia no coincide con el pedido que querés eliminar.');
      await tx.order.delete({ where: { id: orderId } });
      return { id: current.id, reference: current.reference };
    });
  }
  updateStatus(orderId: string, nextStatus: OrderStatus, sessionId: string, reason?: string) {
    return adminTransaction(this.prisma, sessionId, async (tx, administratorId) => {
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (!current) throw new NotFoundException('Pedido no encontrado.');
      const allowed: Record<OrderStatus, OrderStatus[]> = {
        PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PENDING_CONFIRMATION', 'IN_PRODUCTION', 'CANCELLED'],
        IN_PRODUCTION: ['READY', 'CANCELLED'], READY: ['DELIVERED', 'CANCELLED'], DELIVERED: [], CANCELLED: [],
      };
      if (!allowed[current.status].includes(nextStatus)) throw new ConflictException('La transición de estado no es válida.');
      if (nextStatus === 'CANCELLED' && !reason?.trim()) throw new BadRequestException('Indicá el motivo de cancelación.');
      await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
      await tx.orderEvent.create({ data: { orderId, type: 'STATUS_CHANGED', details: { from: current.status, to: nextStatus, administratorId, reason: reason?.trim() || null } } });
      const updated = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, events: { orderBy: { createdAt: 'asc' } } } });
      return { ...this.serialize(updated), events: updated.events };
    });
  }
  updateSchedule(orderId: string, scheduledDate: string, sessionId: string) {
    return adminTransaction(this.prisma, sessionId, async (tx, administratorId) => {
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (!current) throw new NotFoundException('Pedido no encontrado.');
      const from = current.scheduledDate.toISOString().slice(0, 10);
      if (from === scheduledDate) return { id: current.id, scheduledDate: current.scheduledDate };
      const updated = await tx.order.update({ where: { id: orderId }, data: { scheduledDate: new Date(scheduledDate) } });
      await tx.orderEvent.create({ data: { orderId, type: 'DELIVERY_DATE_CHANGED', details: { from, to: scheduledDate, administratorId } } });
      return { id: updated.id, scheduledDate: updated.scheduledDate };
    });
  }
  createQuote(orderId: string, dto: CreateOrderQuoteDto, sessionId: string) {
    const items = dto.items.map(item => ({ ...item, description: item.description?.trim() || null, subtotalCents: item.quantity * item.unitPriceCents }));
    const totalCents = items.reduce((total, item) => total + item.subtotalCents, 0);
    if (!Number.isSafeInteger(totalCents)) throw new BadRequestException('El total supera el límite de cálculo.');
    return adminTransaction(this.prisma, sessionId, async (tx, administratorId) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      if (['CANCELLED', 'DELIVERED'].includes(order.status)) throw new ConflictException('No se puede presupuestar un pedido cerrado.');
      const latest = await tx.orderQuote.findFirst({ where: { orderId }, orderBy: { version: 'desc' } });
      const version = (latest?.version ?? 0) + 1;
      const quote = await tx.orderQuote.create({ data: { orderId, version, totalCents, notes: dto.notes?.trim() || null, administratorId, items: { create: items } }, include: { items: true } });
      await tx.orderEvent.create({ data: { orderId, type: 'QUOTE_CREATED', details: { quoteId: quote.id, version, totalCents, administratorId } } });
      return moneyJson(quote);
    });
  }
  updateQuoteStatus(orderId: string, quoteId: string, status: QuoteStatus, sessionId: string) {
    return adminTransaction(this.prisma, sessionId, async (tx, administratorId) => {
      const quote = await tx.orderQuote.findFirst({ where: { id: quoteId, orderId }, include: { order: true } });
      if (!quote) throw new NotFoundException('Presupuesto no encontrado.');
      if (['CANCELLED', 'DELIVERED'].includes(quote.order.status)) throw new ConflictException('El pedido está cerrado.');
      const allowed: Record<QuoteStatus, QuoteStatus[]> = { DRAFT: ['SENT', 'REJECTED'], SENT: ['ACCEPTED', 'REJECTED'], ACCEPTED: [], REJECTED: [] };
      if (!allowed[quote.status].includes(status)) throw new ConflictException('La transición del presupuesto no es válida.');
      if (status === 'ACCEPTED') {
        const latest = await tx.orderQuote.findFirst({ where: { orderId }, orderBy: { version: 'desc' } });
        if (latest?.id !== quote.id) throw new ConflictException('Solo se puede aceptar la última revisión.');
        const payments = await tx.paymentMovement.findMany({ where: { orderId } });
        const balance = payments.reduce((sum, item) => sum + (item.type === 'CHARGE' ? item.amountCents : -item.amountCents), 0);
        if (Number(quote.totalCents) < balance) throw new ConflictException('Devolvé el excedente antes de aceptar un total menor al saldo cobrado.');
      }
      const updated = await tx.orderQuote.update({ where: { id: quoteId }, data: { status }, include: { items: true } });
      await tx.orderEvent.create({ data: { orderId, type: 'QUOTE_STATUS_CHANGED', details: { quoteId, from: quote.status, to: status, administratorId } } });
      return moneyJson(updated);
    });
  }
  private currentWhatsapp(order: OrderWithItems) {
    const fallbackNames = order.customerName.trim().split(/\s+/);
    const message = whatsappText({
      reference: order.reference,
      firstName: order.customerFirstName ?? fallbackNames.shift() ?? order.customerName,
      lastName: order.customerLastName ?? fallbackNames.join(' '),
      requestedDate: order.requestedDate,
      deliveryMethod: order.deliveryMethod,
      notes: order.notes,
      knownSubtotalCents: Number(order.knownSubtotalCents),
      items: order.items.map(item => {
        const variant = jsonObject(item.variantSnapshot);
        const attributes = jsonObject(variant.attributes ?? null);
        const customization = jsonObject(item.customizationSnapshot);
        const answers = Array.isArray(customization.answers) ? customization.answers.map(answer => jsonObject(answer)).map(answer => ({ label: stringValue(answer.label), value: stringValue(answer.displayValue ?? answer.value) })).filter(answer => answer.label && answer.value) : [];
        const categoryKey = stringValue(variant.category) as keyof typeof CATEGORY_LABELS;
        const typeKey = stringValue(variant.displayType) as keyof typeof DISPLAY_TYPE_LABELS;
        return {
          quantity: item.quantity, productName: item.productName, variantName: stringValue(variant.name) || 'Variante', subtotalCents: item.subtotalCents === null ? null : Number(item.subtotalCents),
          category: CATEGORY_LABELS[categoryKey], displayType: DISPLAY_TYPE_LABELS[typeKey],
          attributes: Object.entries(attributes).map(([label, value]) => [label, stringValue(value)] as [string, string]).filter(([, value]) => value), answers,
        };
      }),
    });
    return { message, url: whatsappUrl(order.whatsappUrl, message) };
  }
  private serialize(order: OrderWithItems, idempotencyKey?: string) {
    const whatsapp = this.currentWhatsapp(order);
    return moneyJson({
      id: order.id, reference: order.reference, status: order.status, customerName: order.customerName,
      customerFirstName: order.customerFirstName, customerLastName: order.customerLastName, customerEmail: order.customerEmail, customerBirthDate: order.customerBirthDate,
      customerPhone: order.customerPhone, requestedDate: order.requestedDate, scheduledDate: order.scheduledDate, source: order.source, deliveryMethod: order.deliveryMethod,
      deliveryAddress: order.deliveryAddress, notes: order.notes,
      items: order.items.map(item => ({
        id: item.id, productId: item.productId, productName: item.productName,
        variantName: (item.variantSnapshot as Prisma.JsonObject)?.name ?? 'Variante',
        quantity: item.quantity, unitPriceCents: item.unitPriceCents, subtotalCents: item.subtotalCents,
        snapshot: { productId: item.productId, productName: item.productName, variantName: (item.variantSnapshot as Prisma.JsonObject)?.name ?? 'Variante', variant: item.variantSnapshot, customization: item.customizationSnapshot, components: item.componentsSnapshot, pricingMode: item.pricingMode },
      })),
      knownSubtotalCents: order.knownSubtotalCents, pendingQuoteCount: order.pendingQuoteCount, shippingCents: order.shippingCents,
      createdAt: order.createdAt, idempotencyKey, whatsapp,
    });
  }
}
